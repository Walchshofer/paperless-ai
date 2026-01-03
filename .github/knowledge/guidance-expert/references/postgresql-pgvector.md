# PostgreSQL + pgvector Integration

## Setup with Docker

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dms_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: dms_database
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
```

## Schema Definition

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Documents table with vector support
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_vector vector(384),  -- For all-MiniLM-L6-v2
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classification results
CREATE TABLE document_classification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20),
    confidence FLOAT,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted fields
CREATE TABLE extracted_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT NOT NULL,
    confidence FLOAT
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector index (HNSW for similarity)
CREATE INDEX idx_content_vector ON documents 
USING hnsw (content_vector vector_cosine_ops);
```

## SQLAlchemy Models

```python
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
import uuid

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(String(50), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    content_vector = Column(Vector(384))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    classifications = relationship("DocumentClassification", back_populates="document")
    extracted_fields = relationship("ExtractedField", back_populates="document")
```

## Database Connection

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

DATABASE_URL = "postgresql://dms_user:password@localhost:5432/dms_database"

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## Vector Repository

```python
from sqlalchemy import func
from typing import List, Optional
import hashlib

class VectorRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def store_embedding(self, doc_id: str, embedding: List[float]) -> Document:
        doc = self.db.query(Document).filter(Document.document_id == doc_id).first()
        if doc:
            doc.content_vector = embedding
            self.db.commit()
        return doc
    
    def similarity_search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        threshold: float = 0.5
    ) -> List[tuple]:
        results = self.db.query(
            Document,
            func.cosine_distance(Document.content_vector, query_embedding).label("distance")
        ).filter(
            Document.content_vector.is_not(None)
        ).order_by(
            func.cosine_distance(Document.content_vector, query_embedding)
        ).limit(limit).all()
        
        return [(doc, 1 - dist) for doc, dist in results if (1 - dist) >= threshold]
    
    def cache_embedding(self, content: str, embedding: List[float], model: str):
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        # Store in embeddings_cache table
```

## Document Repository

```python
class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_document(self, title: str, content: str) -> Document:
        doc_id = f"DOC{self.get_next_id():06d}"
        doc = Document(document_id=doc_id, title=title, content=content)
        self.db.add(doc)
        self.db.commit()
        return doc
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        return self.db.query(Document).filter(Document.document_id == doc_id).first()
    
    def search_documents(self, query: str, limit: int = 20) -> List[Document]:
        return self.db.query(Document).filter(
            (Document.title.ilike(f"%{query}%")) |
            (Document.content.ilike(f"%{query}%"))
        ).limit(limit).all()
    
    def get_next_id(self) -> int:
        result = self.db.query(func.max(
            func.cast(func.substring(Document.document_id, 4), 'integer')
        )).scalar()
        return (result or 0) + 1
```

## Complete DMS Service

```python
from sentence_transformers import SentenceTransformer

class DMSService:
    def __init__(self, db: Session):
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.vector_repo = VectorRepository(db)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
    
    async def process_document(self, title: str, content: str) -> Dict:
        # Create document
        doc = self.doc_repo.create_document(title, content)
        
        # Generate and store embedding
        embedding = self.embedder.encode(content).tolist()
        self.vector_repo.store_embedding(doc.document_id, embedding)
        
        return {"document_id": doc.document_id, "status": "created"}
    
    async def semantic_search(self, query: str, limit: int = 10) -> List[Dict]:
        query_embedding = self.embedder.encode(query).tolist()
        results = self.vector_repo.similarity_search(query_embedding, limit)
        return [
            {"document_id": doc.document_id, "title": doc.title, "score": score}
            for doc, score in results
        ]
```

## Performance Tuning

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT ... FROM documents WHERE ...;

-- Vacuum and cleanup
VACUUM ANALYZE documents;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_blk_read, idx_blk_hit
FROM pg_statio_user_indexes;

-- Reindex
REINDEX INDEX idx_content_vector;
```

## Common Queries

```python
# Get high-risk documents
docs = db.query(Document).join(DocumentAnalysis).filter(
    DocumentAnalysis.risk_assessment == "High"
).all()

# Documents by type
docs = db.query(Document).join(DocumentClassification).filter(
    DocumentClassification.doc_type == "Invoice"
).all()

# Recent documents with embeddings
docs = db.query(Document).filter(
    Document.content_vector.is_not(None),
    Document.created_at >= cutoff_date
).order_by(Document.created_at.desc()).all()
```
