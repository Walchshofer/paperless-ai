"""
Qdrant Adapter for Python RAG Service

Replaces pgVector for vector storage in the Python RAGZ text search service.

Collections:
- document_embeddings: Text RAG (384 dimensions, cosine)
- visual_overlays: Visual overlay embeddings (320 dimensions, cosine)
- visual_pages: Visual RAG sidecar page embeddings (320 dimensions, dot)

Usage:
    from qdrant_adapter import qdrant_adapter

    # Initialize (creates collections if needed)
    await qdrant_adapter.initialize()

    # Upsert embeddings
    await qdrant_adapter.upsert_document_embeddings([
        {"id": "doc_1", "embedding": [...], "payload": {"title": "Doc 1"}}
    ])

    # Search
    results = await qdrant_adapter.search_document_embeddings(query_vector, limit=10)
"""

import os
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)

logger = logging.getLogger(__name__)


@dataclass
class CollectionConfig:
    """Configuration for a Qdrant collection."""
    name: str
    vector_size: int
    distance: Distance
    description: str


# Collection configurations
COLLECTIONS = {
    "document_embeddings": CollectionConfig(
        name="document_embeddings",
        vector_size=384,
        distance=Distance.COSINE,
        description="Text RAG embeddings (paraphrase-multilingual-MiniLM-L12-v2)"
    ),
    "visual_overlays": CollectionConfig(
        name="visual_overlays",
        vector_size=320,
        distance=Distance.COSINE,
        description="Visual overlay embeddings (ColQwen3)"
    ),
    "visual_pages": CollectionConfig(
        name="visual_pages",
        vector_size=320,
        distance=Distance.DOT,
        description="Visual RAG sidecar page embeddings (ColQwen3)"
    ),
}


class QdrantAdapter:
    """
    Adapter for Qdrant vector database operations.

    Provides methods for upserting, searching, and deleting embeddings
    across three collections: document_embeddings, visual_overlays, and visual_pages.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        api_key: Optional[str] = None,
    ):
        """
        Initialize the Qdrant adapter.

        Args:
            host: Qdrant host (default: QDRANT_HOST env or 'localhost')
            port: Qdrant port (default: QDRANT_PORT env or 6333)
            api_key: Optional API key for cloud deployments
        """
        self.host = host or os.getenv("QDRANT_HOST", "localhost")
        self.port = port or int(os.getenv("QDRANT_PORT", "6333"))
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")

        self.client = QdrantClient(
            host=self.host,
            port=self.port,
            api_key=self.api_key,
        )
        self._initialized = False

        logger.info(f"[QdrantAdapter] Configured for {self.host}:{self.port}")

    # =========================================================================
    # Initialization & Health
    # =========================================================================

    def initialize(self) -> bool:
        """
        Initialize all collections.

        Returns:
            bool: Success status
        """
        if self._initialized:
            return True

        try:
            logger.info("[QdrantAdapter] Initializing collections...")

            for key, config in COLLECTIONS.items():
                self._ensure_collection(config)

            self._initialized = True
            logger.info("[QdrantAdapter] All collections initialized")
            return True
        except Exception as e:
            logger.error(f"[QdrantAdapter] Initialization failed: {e}")
            raise

    def health_check(self) -> Dict[str, Any]:
        """
        Check if Qdrant is healthy and accessible.

        Returns:
            dict: Health status including collection info
        """
        try:
            collections = self.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            status = {
                "healthy": True,
                "host": self.host,
                "port": self.port,
                "collections": {},
            }

            for key, config in COLLECTIONS.items():
                exists = config.name in collection_names
                status["collections"][config.name] = {
                    "exists": exists,
                    "vector_size": config.vector_size,
                    "distance": config.distance.name,
                }

                if exists:
                    info = self.client.get_collection(config.name)
                    status["collections"][config.name]["point_count"] = info.points_count

            return status
        except Exception as e:
            logger.error(f"[QdrantAdapter] Health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "host": self.host,
                "port": self.port,
            }

    def _ensure_collection(self, config: CollectionConfig) -> None:
        """Ensure a collection exists with correct configuration."""
        try:
            collections = self.client.get_collections()
            exists = any(c.name == config.name for c in collections.collections)

            if exists:
                logger.debug(f"[QdrantAdapter] Collection {config.name} already exists")
                return

            self.client.create_collection(
                collection_name=config.name,
                vectors_config=VectorParams(
                    size=config.vector_size,
                    distance=config.distance,
                ),
            )

            logger.info(
                f"[QdrantAdapter] Created collection: {config.name} "
                f"({config.vector_size}D, {config.distance.name})"
            )
        except Exception as e:
            # Collection might already exist (race condition)
            if "already exists" not in str(e).lower():
                raise

    # =========================================================================
    # Document Embeddings (Text RAG - 384D)
    # =========================================================================

    def upsert_document_embeddings(
        self, documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Upsert document embeddings for text RAG.

        Args:
            documents: List of {"id": str, "embedding": List[float], "payload": dict}

        Returns:
            dict: Operation result
        """
        return self._upsert(COLLECTIONS["document_embeddings"].name, documents)

    def search_document_embeddings(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search document embeddings.

        Args:
            query_vector: Query embedding (384D)
            limit: Maximum results
            score_threshold: Minimum score
            filter_conditions: Optional filter

        Returns:
            list: Search results
        """
        return self._search(
            COLLECTIONS["document_embeddings"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_document_embeddings(self, ids: List[str]) -> Dict[str, Any]:
        """
        Delete document embeddings by ID.

        Args:
            ids: Point IDs to delete

        Returns:
            dict: Operation result
        """
        return self._delete(COLLECTIONS["document_embeddings"].name, ids)

    # =========================================================================
    # Visual Overlays (320D)
    # =========================================================================

    def upsert_visual_overlays(
        self, overlays: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Upsert visual overlay embeddings.

        Args:
            overlays: List of {"id": str, "embedding": List[float], "payload": dict}

        Returns:
            dict: Operation result
        """
        return self._upsert(COLLECTIONS["visual_overlays"].name, overlays)

    def search_visual_overlays(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search visual overlays by embedding.

        Args:
            query_vector: Query embedding (320D)
            limit: Maximum results
            score_threshold: Minimum score
            filter_conditions: Optional filter

        Returns:
            list: Search results
        """
        return self._search(
            COLLECTIONS["visual_overlays"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_visual_overlays_by_doc_id(self, doc_id: int) -> Dict[str, Any]:
        """
        Delete visual overlays by document ID.

        Args:
            doc_id: Document ID

        Returns:
            dict: Operation result
        """
        return self._delete_by_filter(
            COLLECTIONS["visual_overlays"].name,
            Filter(
                must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
            ),
        )

    # =========================================================================
    # Visual Pages (Sidecar - 320D)
    # =========================================================================

    def upsert_visual_pages(self, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upsert visual page embeddings from sidecar.

        Args:
            pages: List of {"id": str, "embedding": List[float], "payload": dict}

        Returns:
            dict: Operation result
        """
        return self._upsert(COLLECTIONS["visual_pages"].name, pages)

    def search_visual_pages(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search visual pages by embedding.

        Args:
            query_vector: Query embedding (320D)
            limit: Maximum results
            score_threshold: Minimum score
            filter_conditions: Optional filter

        Returns:
            list: Search results
        """
        return self._search(
            COLLECTIONS["visual_pages"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_visual_pages_by_doc_id(self, doc_id: int) -> Dict[str, Any]:
        """
        Delete visual pages by document ID.

        Args:
            doc_id: Document ID

        Returns:
            dict: Operation result
        """
        return self._delete_by_filter(
            COLLECTIONS["visual_pages"].name,
            Filter(
                must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
            ),
        )

    # =========================================================================
    # Generic Operations
    # =========================================================================

    def _upsert(
        self, collection_name: str, points: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generic upsert operation."""
        if not points:
            return {"status": "ok", "count": 0}

        try:
            formatted_points = [
                PointStruct(
                    id=str(p["id"]),
                    vector=p.get("embedding") or p.get("vector"),
                    payload=p.get("payload", {}),
                )
                for p in points
            ]

            self.client.upsert(
                collection_name=collection_name,
                wait=True,
                points=formatted_points,
            )

            logger.debug(
                f"[QdrantAdapter] Upserted {len(points)} points to {collection_name}"
            )
            return {"status": "ok", "count": len(points)}
        except Exception as e:
            logger.error(f"[QdrantAdapter] Upsert failed for {collection_name}: {e}")
            raise

    def _search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """Generic search operation."""
        try:
            search_params = {
                "collection_name": collection_name,
                "query_vector": query_vector,
                "limit": limit,
                "with_payload": True,
            }

            if score_threshold > 0:
                search_params["score_threshold"] = score_threshold

            if filter_conditions:
                search_params["query_filter"] = filter_conditions

            results = self.client.search(**search_params)

            return [
                {"id": r.id, "score": r.score, "payload": r.payload}
                for r in results
            ]
        except Exception as e:
            logger.error(f"[QdrantAdapter] Search failed for {collection_name}: {e}")
            raise

    def _delete(
        self, collection_name: str, ids: List[str]
    ) -> Dict[str, Any]:
        """Generic delete by IDs."""
        if not ids:
            return {"status": "ok", "count": 0}

        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=[str(id) for id in ids],
                wait=True,
            )

            logger.debug(
                f"[QdrantAdapter] Deleted {len(ids)} points from {collection_name}"
            )
            return {"status": "ok", "count": len(ids)}
        except Exception as e:
            logger.error(f"[QdrantAdapter] Delete failed for {collection_name}: {e}")
            raise

    def _delete_by_filter(
        self, collection_name: str, filter_obj: Filter
    ) -> Dict[str, Any]:
        """Generic delete by filter."""
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=filter_obj,
                wait=True,
            )

            logger.debug(
                f"[QdrantAdapter] Deleted points by filter from {collection_name}"
            )
            return {"status": "ok"}
        except Exception as e:
            logger.error(
                f"[QdrantAdapter] Delete by filter failed for {collection_name}: {e}"
            )
            raise

    def get_collection_info(self, collection_name: str) -> Dict[str, Any]:
        """
        Get collection info.

        Args:
            collection_name: Collection name

        Returns:
            dict: Collection info
        """
        try:
            info = self.client.get_collection(collection_name)
            return {
                "name": collection_name,
                "points_count": info.points_count,
                "vectors_count": info.vectors_count,
                "status": info.status.name,
            }
        except Exception as e:
            logger.error(
                f"[QdrantAdapter] Get collection info failed for {collection_name}: {e}"
            )
            raise

    def get_point(
        self, collection_name: str, point_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get point by ID.

        Args:
            collection_name: Collection name
            point_id: Point ID

        Returns:
            dict or None: Point data or None
        """
        try:
            results = self.client.retrieve(
                collection_name=collection_name,
                ids=[str(point_id)],
                with_payload=True,
                with_vectors=True,
            )
            if results:
                r = results[0]
                return {"id": r.id, "vector": r.vector, "payload": r.payload}
            return None
        except Exception as e:
            logger.error(f"[QdrantAdapter] Get point failed: {e}")
            return None


# Singleton instance
qdrant_adapter = QdrantAdapter()
