import os
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, cast

# Surgical ignore for unresolved third-party imports
from qdrant_client import QdrantClient  # type: ignore
from qdrant_client.models import (  # type: ignore
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)

REQUIRED_PAYLOAD_FIELDS = ("doc_id", "correspondent_id", "tag_ids")


@dataclass
class CollectionConfig:
    """Configuration for a Qdrant collection."""

    name: str
    vector_size: int
    distance: Any
    description: str


# Collection configurations - Wrapped to satisfy Flake8 E501
COLLECTIONS = {
    "document_embeddings": CollectionConfig(
        name="document_embeddings",
        vector_size=384,
        distance=Distance.COSINE,  # type: ignore
        description="Text RAG (paraphrase-multilingual-MiniLM-L12-v2)",
    ),
    "visual_overlays": CollectionConfig(
        name="visual_overlays",
        vector_size=320,
        distance=Distance.COSINE,  # type: ignore
        description="Visual overlay embeddings (ColQwen3)",
    ),
    "visual_pages": CollectionConfig(
        name="visual_pages",
        vector_size=320,
        distance=Distance.DOT,  # type: ignore
        description="Visual RAG sidecar page embeddings (ColQwen3)",
    ),
}


class QdrantAdapter:
    """
    Adapter for Qdrant vector database operations.

    Provides methods for upserting, searching, and deleting embeddings.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """Initialize the Qdrant adapter."""
        self.host = host or os.getenv("QDRANT_HOST", "localhost")
        self.port = port or int(os.getenv("QDRANT_PORT", "6333"))
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")

        # Client cast to Any to silence unknown member errors
        self.client: Any = QdrantClient(
            host=self.host,
            port=self.port,
            api_key=self.api_key,
        )
        self._initialized = False

        logger.info(
            "[QdrantAdapter] Configured for %s:%s",
            self.host,
            self.port,
        )

    # --- Initialization & Health ---

    def initialize(self) -> bool:
        """Initialize all collections."""
        if self._initialized:
            return True

        try:
            logger.info("[QdrantAdapter] Initializing collections...")
            for config in COLLECTIONS.values():
                self._ensure_collection(config)
                self._ensure_payload_indexes(config.name)
            self._initialized = True
            return True
        except Exception as exc:
            logger.error("[QdrantAdapter] Init failed: %s", exc)
            raise

    def health_check(self) -> Dict[str, Any]:
        """Check if Qdrant is healthy and accessible."""
        try:
            colls_res = self.client.get_collections()
            col_names = [c.name for c in colls_res.collections]

            status: Dict[str, Any] = {
                "healthy": True,
                "host": self.host,
                "port": self.port,
                "collections": {},
            }

            for config in COLLECTIONS.values():
                exists = config.name in col_names
                status["collections"][config.name] = {
                    "exists": exists,
                    "vector_size": config.vector_size,
                    "distance": config.distance.name,
                }
                if exists:
                    info = self.client.get_collection(config.name)
                    status["collections"][config.name]["point_count"] = (
                        info.points_count
                    )
            return status
        except Exception as exc:
            logger.error("[QdrantAdapter] Health check failed: %s", exc)
            return {"healthy": False, "error": str(exc)}

    def _ensure_collection(self, config: CollectionConfig) -> None:
        """Ensure a collection exists with correct configuration."""
        colls = self.client.get_collections()
        exists = any(c.name == config.name for c in colls.collections)

        if not exists:
            self.client.create_collection(
                collection_name=config.name,
                vectors_config=VectorParams(  # type: ignore
                    size=config.vector_size,
                    distance=config.distance,
                ),
            )

        self._verify_collection_config(config)

    def _verify_collection_config(self, config: CollectionConfig) -> None:
        """Enforce the Distance Metric Lock at startup."""
        info = self.client.get_collection(config.name)
        params = self._get_vector_params(info)
        actual_distance = params.distance
        actual_size = params.size

        if (
            actual_distance != config.distance
            or actual_size != config.vector_size
        ):
            expected = f"{config.vector_size}D {config.distance.name}"
            actual_name = getattr(
                actual_distance,
                "name",
                str(actual_distance),
            )
            actual = f"{actual_size}D {actual_name}"
            raise RuntimeError(
                "Qdrant collection mismatch for "
                f"{config.name}: expected {expected}, got {actual}"
            )

    def _get_vector_params(self, info: Any) -> VectorParams:
        vectors = cast(Any, info.config.params.vectors)
        if isinstance(vectors, dict):
            if "page_embedding" in vectors:
                return cast(VectorParams, vectors["page_embedding"])
            return cast(VectorParams, next(iter(vectors.values())))
        return cast(VectorParams, vectors)

    def _ensure_payload_indexes(self, collection_name: str) -> None:
        for field in REQUIRED_PAYLOAD_FIELDS:
            try:
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=PayloadSchemaType.INTEGER,  # type: ignore
                )
            except Exception as exc:
                if "already exists" in str(exc).lower():
                    continue
                raise

    def _normalize_payload(self, point: Dict[str, Any]) -> Dict[str, Any]:
        payload = dict(point.get("payload") or {})
        doc_id = (
            point.get("doc_id")
            or point.get("docId")
            or payload.get("doc_id")
            or payload.get("docId")
        )
        if doc_id is None:
            raise ValueError("Qdrant payload requires doc_id")
        payload["doc_id"] = int(doc_id)

        correspondent_id = (
            point.get("correspondent_id")
            or point.get("correspondentId")
            or payload.get("correspondent_id")
            or payload.get("correspondentId")
        )
        payload["correspondent_id"] = (
            int(correspondent_id)
            if correspondent_id is not None
            else None
        )

        tag_ids = (
            point.get("tag_ids")
            or point.get("tagIds")
            or payload.get("tag_ids")
            or payload.get("tagIds")
        )
        if tag_ids is None:
            payload["tag_ids"] = []
        elif isinstance(tag_ids, list):
            payload["tag_ids"] = [
                int(tag)
                for tag in tag_ids
                if tag is not None
            ]
        else:
            payload["tag_ids"] = [int(tag_ids)]

        return payload

    # --- Document Embeddings (384D) ---

    def upsert_document_embeddings(
        self, documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Upsert text RAG embeddings."""
        return self._upsert(COLLECTIONS["document_embeddings"].name, documents)

    def search_document_embeddings(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict[Any, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search text RAG (384D)."""
        return self._search(
            COLLECTIONS["document_embeddings"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_document_embeddings(self, ids: List[str]) -> Dict[str, Any]:
        """Delete text RAG embeddings."""
        return self._delete(COLLECTIONS["document_embeddings"].name, ids)

    # --- Visual Overlays (320D) ---

    def upsert_visual_overlays(
        self, overlays: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Upsert visual overlay embeddings."""
        return self._upsert(COLLECTIONS["visual_overlays"].name, overlays)

    def search_visual_overlays(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict[Any, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search visual overlays (320D)."""
        return self._search(
            COLLECTIONS["visual_overlays"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_visual_overlays_by_doc_id(self, doc_id: int) -> Dict[str, Any]:
        """Delete visual overlays by document ID."""
        filt = Filter(  # type: ignore
            must=[
                FieldCondition(  # type: ignore
                    key="doc_id",
                    match=MatchValue(value=doc_id),  # type: ignore
                )
            ]
        )
        return self._delete_by_filter(
            COLLECTIONS["visual_overlays"].name,
            filt,
        )

    # --- Visual Pages (320D) ---

    def upsert_visual_pages(
        self, pages: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Upsert visual page embeddings."""
        return self._upsert(COLLECTIONS["visual_pages"].name, pages)

    def search_visual_pages(
        self,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict[Any, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search visual pages (320D)."""
        return self._search(
            COLLECTIONS["visual_pages"].name,
            query_vector,
            limit=limit,
            score_threshold=score_threshold,
            filter_conditions=filter_conditions,
        )

    def delete_visual_pages_by_doc_id(self, doc_id: int) -> Dict[str, Any]:
        """Delete visual pages by document ID."""
        filt = Filter(  # type: ignore
            must=[
                FieldCondition(  # type: ignore
                    key="doc_id",
                    match=MatchValue(value=doc_id),  # type: ignore
                )
            ]
        )
        return self._delete_by_filter(
            COLLECTIONS["visual_pages"].name,
            filt,
        )

    # --- Core Ops ---

    def _upsert(
        self, col: str, points: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generic upsert operation."""
        if not points:
            return {"status": "ok", "count": 0}

        f_points: List[Any] = []
        for point in points:
            payload = self._normalize_payload(point)
            ps = PointStruct(  # type: ignore
                id=str(point["id"]),
                vector=point.get("embedding") or point.get("vector"),
                payload=payload,
            )
            f_points.append(ps)

        self.client.upsert(collection_name=col, wait=True, points=f_points)
        return {"status": "ok", "count": len(points)}

    def _search(
        self,
        col: str,
        vec: List[float],
        limit: int = 10,
        score_threshold: float = 0.0,
        filter_conditions: Optional[Dict[Any, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Generic search operation."""
        params: Dict[str, Any] = {
            "collection_name": col,
            "query_vector": vec,
            "limit": limit,
            "with_payload": True,
        }
        if score_threshold > 0:
            params["score_threshold"] = score_threshold
        if filter_conditions:
            params["query_filter"] = filter_conditions
        res = self.client.search(**params)
        return [
            {"id": r.id, "score": r.score, "payload": r.payload}
            for r in res
        ]

    def _delete(self, col: str, ids: List[str]) -> Dict[str, Any]:
        """Delete by IDs."""
        self.client.delete(
            collection_name=col,
            points_selector=[str(i) for i in ids],
            wait=True,
        )
        return {"status": "ok", "count": len(ids)}

    def _delete_by_filter(self, col: str, f_obj: Any) -> Dict[str, Any]:
        """Delete by filter."""
        self.client.delete(
            collection_name=col,
            points_selector=f_obj,
            wait=True,
        )
        return {"status": "ok"}

    def get_collection_info(self, col: str) -> Dict[str, Any]:
        """Get collection info."""
        try:
            info = self.client.get_collection(col)
            return {
                "name": col,
                "points_count": info.points_count,
                "vectors_count": info.vectors_count,
                "status": info.status.name,
            }
        except Exception as exc:
            logger.error("[QdrantAdapter] Info failed: %s", exc)
            raise

    def get_point(self, col: str, p_id: str) -> Optional[Dict[str, Any]]:
        """Get point by ID."""
        try:
            res = self.client.retrieve(
                collection_name=col,
                ids=[str(p_id)],
                with_payload=True,
            )
            if res:
                row = res[0]
                return {
                    "id": row.id,
                    "vector": row.vector,
                    "payload": row.payload,
                }
            return None
        except Exception as exc:
            logger.error("[QdrantAdapter] Get point failed: %s", exc)
            return None


# Singleton instance
qdrant_adapter = QdrantAdapter()
