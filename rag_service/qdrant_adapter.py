import os
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from .logging_utils import logger

class QdrantAdapter:
    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self.collection_name = "document_embeddings"
        # 384 dimensions for paraphrase-multilingual-MiniLM-L12-v2
        self.vector_size = 384

    def initialize(self) -> bool:
        """Initialize Qdrant client and ensure collection exists."""
        try:
            host = os.getenv("QDRANT_HOST", "qdrant")
            port = int(os.getenv("QDRANT_PORT", 6333))
            api_key = os.getenv("QDRANT_API_KEY")

            logger.info(f"Connecting to Qdrant at {host}:{port}")
            self.client = QdrantClient(host=host, port=port, api_key=api_key)

            # Check/Create collection
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            visual_pages_exists = any(c.name == "visual_pages" for c in collections)
            visual_overlays_exists = any(c.name == "visual_overlays" for c in collections)

            if not exists:
                logger.info(f"Creating collection '{self.collection_name}'")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    ),
                )
            
            if not visual_pages_exists:
                logger.info("Creating collection 'visual_pages'")
                self.client.create_collection(
                    collection_name="visual_pages",
                    vectors_config={
                        "page_embedding": VectorParams(size=320, distance=Distance.DOT)
                    },
                )

            if not visual_overlays_exists:
                logger.info("Creating collection 'visual_overlays'")
                self.client.create_collection(
                    collection_name="visual_overlays",
                    vectors_config=VectorParams(size=320, distance=Distance.COSINE),
                )

            return True
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant adapter: {e}")
            return False

    def upsert_document_embeddings(self, points_data: List[Dict[str, Any]]) -> bool:
        """Upsert points into the Qdrant collection."""
        if not self.client:
            logger.error("Qdrant client is not initialized")
            return False

        try:
            points = []
            for p in points_data:
                # Ensure ID is integer if possible (Paperless IDs are ints)
                try:
                    p_id = int(p["id"])
                except (ValueError, TypeError):
                    p_id = p["id"]

                points.append(PointStruct(
                    id=p_id,
                    vector=p["embedding"],
                    payload=p["payload"]
                ))

            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            return True
        except Exception as e:
            logger.error(f"Error upserting to Qdrant: {e}")
            return False

    def health_check(self) -> Dict[str, Any]:
        """Check Qdrant connectivity and collection status."""
        if not self.client:
            return {"healthy": False, "message": "Client not initialized"}
        
        try:
            collections = self.client.get_collections().collections
            coll_names = [c.name for c in collections]
            
            status = {"healthy": True, "collections": {}}
            
            # Check document_embeddings
            if self.collection_name in coll_names:
                info = self.client.get_collection(self.collection_name)
                status["collections"][self.collection_name] = {
                    "exists": True,
                    "point_count": info.points_count,
                    "vectors_count": info.vectors_count
                }
            else:
                status["collections"][self.collection_name] = {"exists": False}
                
            return status
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {"healthy": False, "error": str(e)}

    def search_document_embeddings(self, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar documents using embeddings."""
        if not self.client:
            return []
        
        try:
            hits = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=limit,
                with_payload=True
            )
            
            return [{"id": hit.id, "score": hit.score, "payload": hit.payload} for hit in hits]
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

qdrant_adapter = QdrantAdapter()