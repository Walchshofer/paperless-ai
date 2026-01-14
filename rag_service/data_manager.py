import hashlib
import json
import os
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from sentence_transformers import CrossEncoder, SentenceTransformer
from tqdm import tqdm

from .logging_utils import logger
from .settings import (
    CROSS_ENCODER_MODEL_NAME,
    DOCUMENTS_FILE,
    EMBEDDING_MODEL_NAME,
)
from .state import global_state
from .qdrant_adapter import qdrant_adapter


class DataManager:
    def __init__(self, initialize_on_start: bool = False) -> None:
        paperless_api_url = (
            os.getenv("PAPERLESS_API_URL")
            or os.getenv("PAPERLESS_URL")
            or os.getenv("PAPERLESS_NGX_URL")
            or os.getenv("PAPERLESS_HOST")
        )

        if paperless_api_url and paperless_api_url.endswith("/api"):
            paperless_api_url = paperless_api_url[:-4]
            logger.info(
                "Removed '/api' suffix from URL: %s",
                paperless_api_url,
            )

        self.paperless_url = paperless_api_url
        self.paperless_token = (
            os.getenv("PAPERLESS_TOKEN")
            or os.getenv("PAPERLESS_API_TOKEN")
            or os.getenv("PAPERLESS_APIKEY")
        )

        logger.info(
            "Environment variables: PAPERLESS_API_URL=%s, PAPERLESS_URL=%s, "
            "PAPERLESS_NGX_URL=%s, PAPERLESS_HOST=%s",
            os.getenv("PAPERLESS_API_URL"),
            os.getenv("PAPERLESS_URL"),
            os.getenv("PAPERLESS_NGX_URL"),
            os.getenv("PAPERLESS_HOST"),
        )
        logger.info(
            "Environment variables: PAPERLESS_TOKEN=%s, "
            "PAPERLESS_API_TOKEN=%s, PAPERLESS_APIKEY=%s",
            "[SET]" if os.getenv("PAPERLESS_TOKEN") else "[NOT SET]",
            "[SET]" if os.getenv("PAPERLESS_API_TOKEN") else "[NOT SET]",
            "[SET]" if os.getenv("PAPERLESS_APIKEY") else "[NOT SET]",
        )

        if not self.paperless_url or not self.paperless_token:
            logger.error(
                "Missing PAPERLESS_API_URL/PAPERLESS_URL or "
                "PAPERLESS_API_TOKEN in .env file",
            )
            raise ValueError(
                "Missing Paperless API configuration in .env file",
            )

        self.documents: List[Dict[str, Any]] = []
        self.document_hashes: Dict[str, str] = {}
        self.last_sync: Optional[str] = None
        self.is_initialized = False
        self.sentence_transformer: Any = None
        self.cross_encoder: Any = None

        self.indexed_document_ids: Set[int] = (
            global_state._indexed_document_ids  # type: ignore
            if global_state._indexed_document_ids  # type: ignore
            else set()
        )
        self.new_document_ids: Set[int] = set()

        if initialize_on_start:
            self.initialize_models()

    def initialize_models(self) -> bool:
        """Initialize NLP models and Qdrant + PostgreSQL (metadata)."""
        try:
            if self.sentence_transformer is None:
                logger.info("Initializing sentence transformer model")
                self.sentence_transformer = SentenceTransformer(
                    EMBEDDING_MODEL_NAME
                )

            if self.cross_encoder is None:
                logger.info("Initializing cross-encoder model")
                self.cross_encoder = CrossEncoder(
                    CROSS_ENCODER_MODEL_NAME
                )

            # Initialize Qdrant for vector storage
            logger.info("Initializing Qdrant vector store")
            qdrant_initialized = qdrant_adapter.initialize()
            if qdrant_initialized:
                logger.info("Qdrant initialized successfully")
            else:
                logger.warning(
                    "Qdrant initialization failed - vector search may not work"
                )

            self.is_initialized = True
            global_state.save_state()
            return True
        except Exception as exc:
            logger.error("Error initializing models: %s", str(exc))
            self.is_initialized = False
            return False

    def _extract_correspondent_id(self, doc: Dict[str, Any]) -> Optional[int]:
        value = doc.get("correspondent_id", doc.get("correspondent"))
        if isinstance(value, dict):
            value = value.get("id")
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _extract_tag_ids(self, doc: Dict[str, Any]) -> List[int]:
        tags = doc.get("tag_ids", doc.get("tags", []))
        if tags is None:
            return []
        if isinstance(tags, dict):
            tags = tags.get("results") or list(tags.values())
        if not isinstance(tags, list):
            try:
                return [int(tags)]
            except (TypeError, ValueError):
                return []

        tag_ids: List[int] = []
        for tag in tags:
            tag_id = tag.get("id") if isinstance(tag, dict) else tag
            if tag_id is None:
                continue
            try:
                tag_ids.append(int(tag_id))
            except (TypeError, ValueError):
                continue
        return tag_ids

    def _get_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Token {self.paperless_token}"}

    def _compute_document_hash(self, doc: Dict[str, Any]) -> str:
        """Compute a hash for a document to track changes."""
        content = f"{doc['title']}{doc['content']}{doc['correspondent']}"
        return hashlib.sha256(content.encode()).hexdigest()

    def check_for_updates(self) -> Tuple[bool, str]:
        """Check whether new documents exist without downloading them."""
        logger.info("Checking for document updates")
        try:
            url = f"{self.paperless_url}/api/documents/?page=1&page_size=10"
            response = requests.get(
                url,
                headers=self._get_headers(),
                timeout=10,
            )

            if response.status_code != 200:
                return False, f"API error: {response.status_code}"

            data = response.json()
            results = data.get("results", [])

            if not results:
                return False, "No documents found in API"

            newest_doc = results[0]
            newest_id = newest_doc.get("id")

            if newest_id in self.indexed_document_ids:
                return False, "No new documents detected"
            return True, "New documents detected"
        except Exception as exc:
            logger.error("Error checking for updates: %s", str(exc))
            return False, f"Error: {str(exc)}"

    def fetch_documents_from_api(self) -> List[Dict[str, Any]]:
        """Fetch all documents from Paperless-NGX API with pagination."""
        logger.info(
            "Fetching documents from Paperless-NGX API: %s",
            self.paperless_url,
        )

        documents = []
        page = 1
        has_next = True

        while has_next:
            logger.info("Fetching page %s", page)
            try:
                url = (
                    f"{self.paperless_url}/api/documents/"
                    f"?page={page}&page_size=100"
                )
                logger.info("Making request to: %s", url)

                response = requests.get(
                    url,
                    headers=self._get_headers(),
                    timeout=30,
                )

                logger.info(
                    "Response status code: %s",
                    response.status_code,
                )

                if response.status_code != 200:
                    logger.error(
                        "Failed to fetch documents: %s - %s",
                        response.status_code,
                        response.text,
                    )
                    raise Exception(
                        "API error: "
                        f"{response.status_code} - {response.text}"
                    )

                if not response.text:
                    logger.error("API returned empty response")
                    raise Exception("API returned empty response")

                try:
                    data = response.json()
                except requests.exceptions.JSONDecodeError as exc:
                    logger.error("JSON decode error: %s", str(exc))
                    logger.error("Response content: %s", response.text)
                    raise Exception(
                        "Could not parse API response as JSON: "
                        f"{str(exc)}"
                    )

                results = data.get("results", [])
                documents.extend(results)

                if data.get("next"):
                    page += 1
                else:
                    has_next = False

            except requests.exceptions.RequestException as exc:
                logger.error("Request error: %s", str(exc))
                raise Exception(f"API request failed: {str(exc)}")

        processed_docs = []
        for doc in tqdm(documents, desc="Processing documents"):
            if "content" not in doc or not doc["content"]:
                download_url = (
                    f"{self.paperless_url}/api/documents/"
                    f"{doc['id']}/download/txt/"
                )
                content_response = requests.get(
                    download_url,
                    headers=self._get_headers(),
                    timeout=30,
                )

                if content_response.status_code == 200:
                    content = content_response.text
                else:
                    logger.warning(
                        "Could not fetch content for document %s",
                        doc["id"],
                    )
                    content = ""
            else:
                content = doc.get("content", "")

            correspondent = ""
            if doc.get("correspondent"):
                corr_id = doc["correspondent"]
                corr_response = requests.get(
                    f"{self.paperless_url}/api/correspondents/{corr_id}/",
                    headers=self._get_headers(),
                    timeout=10,
                )
                if corr_response.status_code == 200:
                    correspondent = corr_response.json().get(
                        "name",
                        "",
                    )

            tags = []
            if doc.get("tags"):
                for tag_id in doc["tags"]:
                    tag_response = requests.get(
                        f"{self.paperless_url}/api/tags/{tag_id}/",
                        headers=self._get_headers(),
                        timeout=10,
                    )
                    if tag_response.status_code == 200:
                        tags.append(
                            tag_response.json().get("name", "")
                        )

            processed_doc = {
                "id": doc.get("id"),
                "title": doc.get("title", ""),
                "content": content,
                "correspondent": correspondent,
                "created": doc.get(
                    "created_date",
                    doc.get("created", ""),
                ),
                "tags": tags,
                "last_updated": doc.get("modified", ""),
            }
            processed_doc["hash"] = self._compute_document_hash(
                processed_doc
            )
            processed_docs.append(processed_doc)

        return processed_docs

    def _check_for_new_documents(self) -> List[Dict[str, Any]]:
        """Check for new documents that haven't been indexed yet."""
        logger.info("Checking for new documents")
        try:
            api_documents = self.fetch_documents_from_api()

            new_docs = []
            self.new_document_ids.clear()

            for doc in api_documents:
                if doc["id"] not in self.indexed_document_ids:
                    new_docs.append(doc)
                    self.new_document_ids.add(doc["id"])
                    self.indexed_document_ids.add(doc["id"])

            logger.info(
                "Found %s new documents to index",
                len(new_docs),
            )
            return new_docs
        except Exception as exc:
            logger.error(
                "Error checking for new documents: %s",
                str(exc),
            )
            return []

    def load_documents(
        self,
        force_refresh: bool = False,
        check_new: bool = False,
    ) -> List[Dict[str, Any]]:
        """Load documents from file or API.

        Optionally checks for new documents.
        """
        if os.path.exists(DOCUMENTS_FILE) and not force_refresh:
            logger.info("Loading documents from %s", DOCUMENTS_FILE)
            try:
                with open(
                    DOCUMENTS_FILE,
                    "r",
                    encoding="utf-8",
                ) as file_obj:
                    local_documents = json.load(file_obj)

                invalid_structure = (
                    not isinstance(local_documents, list)
                    or (
                        local_documents
                        and not isinstance(local_documents[0], dict)
                    )
                )
                if invalid_structure:
                    logger.error(
                        "Invalid document structure in documents.json"
                    )
                    return []

                if not self.indexed_document_ids:
                    self.indexed_document_ids = {
                        doc["id"]
                        for doc in local_documents
                        if "id" in doc
                    }
                    logger.info(
                        "Initialized indexed_document_ids with %s IDs",
                        len(self.indexed_document_ids),
                    )

                self.last_sync = datetime.now().isoformat()
                self.documents = local_documents

                if check_new:
                    logger.info("Explicitly checking for new documents")
                    new_docs = self._check_for_new_documents()
                    if new_docs:
                        logger.info(
                            "Found %s new documents",
                            len(new_docs),
                        )
                        self.documents.extend(new_docs)
                        self.save_documents()
                    else:
                        logger.info("No new documents found")
                else:
                    logger.info("Skipping check for new documents")
                    self.new_document_ids = set()

                global_state.system_status.data_loaded = True
                global_state.indexing_status.documents_count = len(
                    self.documents
                )
                global_state.indexing_status.last_indexed = (
                    self.last_sync
                )
                global_state.save_state()

                return self.documents
            except Exception as exc:
                logger.error("Error loading documents: %s", str(exc))
                logger.error(traceback.format_exc())
                return []

        if force_refresh:
            logger.info("Forcing full refresh from API")
            self.documents = self.fetch_documents_from_api()
            self.indexed_document_ids = {
                doc["id"] for doc in self.documents
            }
            self.new_document_ids = self.indexed_document_ids.copy()
            self.save_documents()
        else:
            logger.info("No local documents found, fetching from API")
            self.documents = self.fetch_documents_from_api()
            self.indexed_document_ids = {
                doc["id"] for doc in self.documents
            }
            self.new_document_ids = self.indexed_document_ids.copy()
            self.save_documents()

        global_state.system_status.data_loaded = True
        global_state.indexing_status.documents_count = len(self.documents)
        global_state.indexing_status.last_indexed = (
            datetime.now().isoformat()
        )
        global_state.save_state()

        return self.documents

    def save_documents(self) -> None:
        """Save documents to file."""
        os.makedirs(os.path.dirname(DOCUMENTS_FILE), exist_ok=True)
        with open(DOCUMENTS_FILE, "w", encoding="utf-8") as file_obj:
            json.dump(
                self.documents,
                file_obj,
                ensure_ascii=False,
                indent=2,
            )
        logger.info(
            "Saved %s documents to %s",
            len(self.documents),
            DOCUMENTS_FILE,
        )

    def _add_documents_to_qdrant(self, documents: List[Dict[str, Any]]) -> bool:
        """Add documents and embeddings to Qdrant."""
        try:
            batch_size = 100
            total_docs = len(documents)

            for i in range(0, total_docs, batch_size):
                batch = documents[i:i + batch_size]
                logger.info(
                    "Processing batch %s/%s (%s documents)",
                    i // batch_size + 1,
                    (total_docs - 1) // batch_size + 1,
                    len(batch),
                )

                texts = [
                    f"{doc['title']} {doc['correspondent']} {doc['content']}"
                    for doc in batch
                ]
                embeddings = self.sentence_transformer.encode(texts)

                points = []
                for doc, embedding in zip(batch, embeddings):
                    doc_id = doc["id"]
                    correspondent_id = self._extract_correspondent_id(doc)
                    tag_ids = self._extract_tag_ids(doc)
                    points.append(
                        {
                            "id": doc_id,
                            "embedding": embedding.tolist(),
                            "payload": {
                                "doc_id": doc_id,
                                "correspondent_id": correspondent_id,
                                "tag_ids": tag_ids,
                            },
                            "doc_id": doc_id,
                            "correspondent_id": correspondent_id,
                            "tag_ids": tag_ids,
                        }
                    )

                qdrant_adapter.upsert_document_embeddings(points)

            logger.info(
                "Added/updated %s documents to Qdrant",
                total_docs,
            )
            return True
        except Exception as exc:
            logger.error("Error adding documents to Qdrant: %s", str(exc))
            return False


# Search Engine
