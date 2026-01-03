"""
Guidance AI Code Snippets
Ready-to-use templates for common patterns
"""

# =============================================================================
# MODEL INITIALIZATION
# =============================================================================

def init_ollama_model(model_name: str = "neural-chat", host: str = "host.docker.internal"):
    """Initialize Ollama model via LiteLLM"""
    import guidance
    
    config = {
        "model_name": model_name,
        "litellm_params": {
            "model": f"ollama/{model_name}",
            "api_base": f"http://{host}:11434/v1",
            "api_key": "ollama",
        }
    }
    return guidance.models.experimental.LiteLLM(
        model_description=config,
        echo=False,
        max_tokens=2048
    )


# =============================================================================
# CLASSIFICATION
# =============================================================================

def classify_document(lm, content: str, options: list = None):
    """Generic document classification"""
    from guidance import system, user, assistant, select
    
    options = options or ["Invoice", "Contract", "Report", "Memo", "Other"]
    
    with system():
        lm += "You are a document classifier."
    with user():
        lm += f"Classify:\n{content[:500]}"
    with assistant():
        lm += "Type: " + select(options=options, name="doc_type")
        lm += "\nPriority: " + select(options=["High", "Medium", "Low"], name="priority")
    
    return {"type": lm["doc_type"], "priority": lm["priority"]}


# =============================================================================
# EXTRACTION
# =============================================================================

EXTRACTION_PATTERNS = {
    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "phone": r"\+?1?\d{9,15}",
    "date": r"\d{1,2}[-/]\d{1,2}[-/]\d{2,4}",
    "amount": r"\$?[\d,]+\.?\d*",
    "url": r"https?://[^\s]+",
}

def extract_fields(lm, content: str, fields: list):
    """Extract specified fields from content"""
    from guidance import system, user, assistant, gen
    
    with system():
        lm += "Extract fields precisely. Return only values."
    with user():
        lm += f"Extract from:\n{content}"
    with assistant():
        results = {}
        for field in fields:
            pattern = EXTRACTION_PATTERNS.get(field)
            if pattern:
                lm += f"{field}: " + gen(name=field, regex=pattern, max_tokens=50, stop="\n")
            else:
                lm += f"{field}: " + gen(name=field, max_tokens=50, stop="\n")
            lm += "\n"
            results[field] = lm[field]
    
    return results


# =============================================================================
# THINKING MODEL ANALYSIS
# =============================================================================

def deep_analysis(lm, content: str, max_thinking_tokens: int = 2000):
    """Deep analysis using thinking model with explicit reasoning"""
    from guidance import system, user, assistant, gen, select
    
    with system():
        lm += "Analyze thoroughly. Show your reasoning."
    with user():
        lm += f"Analyze:\n{content}"
    with assistant():
        lm += "<thinking>\n"
        lm += gen(name="reasoning", max_tokens=max_thinking_tokens, stop="</thinking>")
        lm += "\n</thinking>\n\n"
        lm += "Summary: " + gen(name="summary", max_tokens=300, temperature=0.1)
        lm += "\nRisk: " + select(options=["Low", "Medium", "High"], name="risk")
    
    return {
        "reasoning": lm["reasoning"],
        "summary": lm["summary"],
        "risk": lm["risk"]
    }


# =============================================================================
# RETRY WRAPPER
# =============================================================================

async def with_retry(func, *args, max_retries=3, timeout=30, fallback=None, **kwargs):
    """Execute function with exponential backoff retry"""
    import asyncio
    
    for attempt in range(max_retries):
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(func, *args, **kwargs),
                timeout=timeout
            )
        except Exception as e:
            if attempt == max_retries - 1:
                if fallback is not None:
                    return fallback
                raise
            await asyncio.sleep(2 ** attempt)


# =============================================================================
# EMBEDDING UTILITIES
# =============================================================================

def get_embedder(model_name: str = "all-MiniLM-L6-v2"):
    """Get sentence transformer embedder"""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name)

def embed_text(embedder, text: str) -> list:
    """Generate embedding for text"""
    return embedder.encode(text).tolist()

def embed_batch(embedder, texts: list) -> list:
    """Generate embeddings for multiple texts"""
    return embedder.encode(texts).tolist()


# =============================================================================
# DATABASE HELPERS
# =============================================================================

def create_db_session(database_url: str):
    """Create SQLAlchemy session"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(database_url, pool_pre_ping=True)
    return sessionmaker(bind=engine)()


# =============================================================================
# FASTAPI TEMPLATES
# =============================================================================

FASTAPI_TEMPLATE = '''
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

app = FastAPI(title="DMS with Guidance AI")

class DocumentRequest(BaseModel):
    title: str
    content: str

@app.post("/api/documents/process")
async def process_document(request: DocumentRequest):
    try:
        # Classification
        classification = classify_document(instruction_model, request.content)
        # Extraction
        fields = extract_fields(instruction_model, request.content, ["email", "date", "amount"])
        
        return {
            "classification": classification,
            "extracted_fields": fields
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy"}
'''


# =============================================================================
# DOCKER COMPOSE TEMPLATE
# =============================================================================

DOCKER_COMPOSE_TEMPLATE = '''
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_HOST=host.docker.internal
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
    depends_on:
      - postgres

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    environment:
      - OLLAMA_HOST=0.0.0.0:11434

volumes:
  postgres_data:
'''


# =============================================================================
# USAGE EXAMPLES
# =============================================================================

if __name__ == "__main__":
    # Initialize model
    lm = init_ollama_model("neural-chat")
    
    # Test classification
    result = classify_document(lm, "Invoice #123 for $5000 from Acme Corp")
    print(f"Classification: {result}")
    
    # Test extraction
    fields = extract_fields(lm, "Contact: john@example.com, Date: 01/15/2024", ["email", "date"])
    print(f"Extracted: {fields}")
