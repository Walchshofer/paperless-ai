import hashlib
import json
import os
import traceback
from datetime import datetime
from typing import Tuple

import psycopg2
import requests
from psycopg2.extras import execute_values
from psycopg2.pool import SimpleConnectionPool
from sentence_transformers import CrossEncoder, SentenceTransformer
from tqdm import tqdm

from .logging_utils import logger
from .settings import (
    CROSS_ENCODER_MODEL_NAME,
    DOCUMENTS_FILE,
    EMBEDDING_MODEL_NAME,
)
from .state import global_state


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

        self.documents = []
        self.document_hashes = {}
        self.last_sync = None
        self.is_initialized = False
        self.db_pool = None
        self.db_host = os.getenv("POSTGRES_HOST", "db")
        self.db_port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.db_name = os.getenv("POSTGRES_DB", "paperless")
        self.db_user = os.getenv("POSTGRES_USER", "paperless")
        self.db_password = os.getenv("POSTGRES_PASSWORD", "")

        self.sentence_transformer = None
        self.cross_encoder = None

        self.indexed_document_ids = (
            global_state._indexed_document_ids
            if global_state._indexed_document_ids
            else set()
        )
        self.new_document_ids = set()

        if initialize_on_start:
            self.initialize_models()

    def initialize_models(self) -> bool:
        """Initialize NLP models and PostgreSQL + pgvector."""
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

            # Initialize PostgreSQL + pgvector connection pool
            if self.db_pool is None:
                logger.info("Initializing PostgreSQL + pgvector connection pool")
                self.db_pool = SimpleConnectionPool(
                    1, 20,
                    host=self.db_host,
                    port=self.db_port,
                    database=self.db_name,
                    user=self.db_user,
                    password=self.db_password
                )

                # Ensure pgvector extension and schema are initialized
                self._ensure_pgvector_schema()

            self.is_initialized = True
            global_state.save_state()
            return True
        except Exception as exc:
            logger.error("Error initializing models: %s", str(exc))
            self.is_initialized = False
            return False

    def _ensure_pgvector_schema(self) -> bool:
        """Ensure pgvector extension and document_embeddings table exist."""
        try:
            conn = self.db_pool.getconn()
            cursor = conn.cursor()

            # Enable pgvector extension
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            # Create document_embeddings table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_embeddings (
                    id SERIAL PRIMARY KEY,
                    doc_id INTEGER NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    correspondent TEXT,
                    created DATE,
                    content TEXT,
                    embedding vector(384),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Create index for vector similarity search
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_embedding_cosine 
                ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """)

            conn.commit()
            cursor.close()
            self.db_pool.putconn(conn)

            logger.info("pgvector schema initialized successfully")
            return True
        except Exception as exc:
            logger.error("Error ensuring pgvector schema: %s", str(exc))
            return False

    def _get_headers(self) -> dict:
        return {"Authorization": f"Token {self.paperless_token}"}

    def _compute_document_hash(self, doc: dict) -> str:
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

    def fetch_documents_from_api(self) -> list:
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

    def _check_for_new_documents(self) -> list:
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
    ):
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

    def _add_documents_to_pgvector(self, documents) -> bool:
        """Add documents and embeddings to PostgreSQL + pgvector."""
        try:
            conn = self.db_pool.getconn()
            cursor = conn.cursor()

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

                # Generate embeddings for batch
                texts = [
                    f"{doc['title']} {doc['correspondent']} {doc['content']}"
                    for doc in batch
                ]
                embeddings = self.sentence_transformer.encode(texts)

                # Prepare data for insertion
                data = [
                    (
                        doc["id"],
                        doc["title"],
                        doc["correspondent"],
                        doc["created"],
                        doc["content"],
                        embedding.tolist()
                    )
                    for doc, embedding in zip(batch, embeddings)
                ]

                # Upsert documents and embeddings
                execute_values(
                    cursor,
                    """
                    INSERT INTO document_embeddings 
                    (doc_id, title, correspondent, created, content, embedding)
                    VALUES %s
                    ON CONFLICT (doc_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        correspondent = EXCLUDED.correspondent,
                        created = EXCLUDED.created,
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    data
                )
                conn.commit()

            cursor.close()
            self.db_pool.putconn(conn)

            logger.info(
                "Added/updated %s documents to pgvector",
                total_docs,
            )
            return True
        except Exception as exc:
            logger.error("Error adding documents to pgvector: %s", str(exc))
            return False


# Search Engine
