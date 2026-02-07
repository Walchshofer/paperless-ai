import logging
import os
from typing import Any, Dict, List, Optional, Union

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)


class QdrantAdapter:
    """Adapter for Qdrant vector database operations."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        api_key: Optional[str] = None
    ) -> None:
        """Initialize Qdrant client and ensure collection exists."""
        self.host = host or os.getenv("QDRANT_HOST", "qdrant")
        self.port = port or int(os.getenv("QDRANT_PORT", "6333"))
        self.api_key = api_key or os.getenv("QDRANT_API_KEY")

        self.client = QdrantClient(
            host=self.host,
            port=self.port,
            api_key=self.api_key
        )
        self.collection_name = 'document_embeddings'
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """Ensure collection exists with correct distance metric."""
        try:
            collections = self.client.get_collections()
            exists = any(
                c.name == self.collection_name
                for c in collections.collections
            )

            if exists:
                info = self.client.get_collection(self.collection_name)
                vectors_config = info.config.params.vectors

                # Validate distance metric lock
                current_dist = None
                if isinstance(vectors_config, VectorParams):
                    current_dist = vectors_config.distance
                elif isinstance(vectors_config, dict):
                    current_dist = vectors_config.get('distance')

                # Check against expected COSINE
                if current_dist != Distance.COSINE:
                    msg = (
                        f"Distance Metric Lock violation: Collection "
                        f"'{self.collection_name}' has distance "
                        f"'{current_dist}' but expected 'Cosine'."
                    )
                    logger.error(msg)
                    raise ValueError(msg)

                logger.info(
                    f"Collection '{self.collection_name}' verified."
                )
            else:
                logger.info(
                    f"Creating collection '{self.collection_name}'"
                )
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=384,
                        distance=Distance.COSINE
                    ),
                )

            self._create_payload_indexes()

        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            raise

    def _create_payload_indexes(self) -> None:
        """Create payload indexes for filtering fields."""
        fields = [
            ("doc_id", PayloadSchemaType.INTEGER),
            ("correspondent_id", PayloadSchemaType.INTEGER),
            ("tag_ids", PayloadSchemaType.INTEGER),
        ]

        for field_name, schema_type in fields:
            try:
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=schema_type,
                )
                logger.info(f"Ensured index for field '{field_name}'")
            except Exception as e:
                # Log warning but continue if index creation fails
                # (e.g. already exists)
                logger.warning(
                    f"Could not create index for '{field_name}': {e}"
                )

    def upsert_document(
        self,
        doc_id: int,
        embedding: Union[List[float], Any],
        metadata: Dict[str, Any]
    ) -> None:
        """Upsert a document embedding with metadata."""
        try:
            # Ensure embedding is a list (handle numpy arrays)
            if hasattr(embedding, 'tolist'):
                embedding = embedding.tolist()

            payload = {
                'doc_id': doc_id,
                'title': metadata.get('title'),
                'correspondent_id': metadata.get('correspondent_id'),
                'tag_ids': metadata.get('tag_ids', []),
                'created': metadata.get('created'),
                'content_preview': metadata.get('content', '')[:200]
            }

            point = PointStruct(
                id=doc_id,
                vector=embedding,
                payload=payload
            )

            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            logger.info(f"Upserted document {doc_id} to Qdrant.")
        except Exception as e:
            logger.error(f"Failed to upsert document {doc_id}: {e}")
            raise

    def upsert_documents(
        self,
        documents: List[Dict[str, Any]]
    ) -> None:
        """Batch upsert documents."""
        try:
            points = []
            for doc in documents:
                doc_id = doc['doc_id']
                embedding = doc['embedding']
                metadata = doc['metadata']
                
                if hasattr(embedding, 'tolist'):
                    embedding = embedding.tolist()

                payload = {
                    'doc_id': doc_id,
                    'title': metadata.get('title'),
                    'correspondent_id': metadata.get('correspondent_id'),
                    'tag_ids': metadata.get('tag_ids', []),
                    'created': metadata.get('created'),
                    'content_preview': metadata.get('content', '')[:200]
                }

                points.append(PointStruct(
                    id=doc_id,
                    vector=embedding,
                    payload=payload
                ))

            if points:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
                logger.info(f"Upserted batch of {len(points)} documents to Qdrant.")
        except Exception as e:
            logger.error(f"Failed to batch upsert documents: {e}")
            raise

    def search(
        self,
        query_embedding: Union[List[float], Any],
        k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar documents with optional filters."""
        try:
            # Ensure query_embedding is a list
            if hasattr(query_embedding, 'tolist'):
                query_embedding = query_embedding.tolist()

            query_filter = None
            if filters:
                conditions = []
                if 'correspondent_id' in filters:
                    conditions.append(
                        FieldCondition(
                            key='correspondent_id',
                            match=MatchValue(
                                value=filters['correspondent_id']
                            )
                        )
                    )

                if 'tag_ids' in filters and filters['tag_ids']:
                    # AND logic: document must have all provided tags
                    for tag_id in filters['tag_ids']:
                        conditions.append(
                            FieldCondition(
                                key='tag_ids',
                                match=MatchValue(value=tag_id)
                            )
                        )

                if conditions:
                    query_filter = Filter(must=conditions)

            results = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                query_filter=query_filter,
                limit=k
            ).points

            return [
                {
                    'doc_id': point.id,
                    'score': point.score,
                    'payload': point.payload
                }
                for point in results
            ]
        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise

    def update_payload(
        self,
        doc_id: int,
        metadata: Dict[str, Any]
    ) -> None:
        """Update payload for a specific document."""
        try:
            update_data = {}
            if 'correspondent_id' in metadata:
                update_data['correspondent_id'] = metadata['correspondent_id']
            if 'tag_ids' in metadata:
                update_data['tag_ids'] = metadata['tag_ids']

            if not update_data:
                return

            self.client.set_payload(
                collection_name=self.collection_name,
                payload=update_data,
                points=[doc_id]
            )
            logger.info(f"Updated payload for document {doc_id}.")
        except Exception as e:
            logger.error(
                f"Failed to update payload for document {doc_id}: {e}"
            )
            raise

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics for the document_embeddings collection."""
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "exists": True,
                "point_count": info.points_count,
                "status": info.status
            }
        except Exception:
            return {"exists": False, "point_count": 0}

    def health_check(self) -> Dict[str, Any]:
        """Check Qdrant connectivity and collection status.

        Returns a dict with the overall `healthy` boolean, a mapping of
        `collections` to their status, and an aggregated `point_count`.
        """
        try:
            collections = self.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            details: Dict[str, Any] = {}
            total_points = 0

            # Gather stats for all collections reported by the server
            for cname in collection_names:
                try:
                    info = self.client.get_collection(cname)
                    points = int(getattr(info, "points_count", 0) or 0)
                    details[cname] = {
                        "exists": True,
                        "point_count": points,
                        "status": str(info.status),
                    }
                    total_points += points
                except Exception as e:
                    # If a single collection query fails, still continue
                    logger.warning(
                        "Could not fetch stats for collection '%s': %s",
                        cname,
                        str(e),
                    )
                    details[cname] = {
                        "exists": False,
                        "point_count": 0,
                        "status": "error",
                    }

            # Ensure our expected collection is present in the response
            if self.collection_name not in details:
                try:
                    info = self.client.get_collection(self.collection_name)
                    points = int(getattr(info, "points_count", 0) or 0)
                    details[self.collection_name] = {
                        "exists": True,
                        "point_count": points,
                        "status": str(info.status),
                    }
                    total_points += points
                except Exception:
                    details[self.collection_name] = {
                        "exists": False,
                        "point_count": 0,
                        "status": "missing",
                    }

            return {
                "healthy": True,
                "collections": details,
                "point_count": total_points,
            }
        except Exception as e:
            logger.error("Health check failed: %s", str(e))
            return {"healthy": False, "error": str(e)}


# Singleton instance
qdrant_adapter = QdrantAdapter()
