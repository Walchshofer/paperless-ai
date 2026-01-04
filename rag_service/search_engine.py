import os
import pickle
import time
import traceback
from typing import List
import psycopg2
from psycopg2.pool import SimpleConnectionPool

import numpy as np
from tqdm import tqdm
from rank_bm25 import BM25Okapi
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

from .logging_utils import logger
from .models import SearchRequest, SearchResult
from .settings import BM25_FILE, BM25_WEIGHT, SEMANTIC_WEIGHT, MAX_RESULTS
from .state import global_state


class SearchEngine:
    def __init__(self, data_manager, initialize_on_start=False):
        self.data_manager = data_manager
        self.db_pool = data_manager.db_pool  # Use shared connection pool
        self.documents = None
        self.bm25 = None
        self.tokenized_corpus = None
        self.is_initialized = False
        self.bm25_initialized = False

        # Wenn True, initialisiere beim Start
        if initialize_on_start and self.data_manager.is_initialized:
            self.initialize()

    def validate_state(self):
        """Validate the state of the search engine components"""
        logger.info("Validating search engine state")
        valid = True

        # Check documents
        if not self.documents or len(self.documents) == 0:
            logger.error("Documents not loaded or empty")
            valid = False

        # Check pgvector
        if not self.db_pool:
            logger.error("PostgreSQL + pgvector not initialized")
            global_state.system_status.pgvector_ready = False
            valid = False
        else:
            try:
                conn = self.db_pool.getconn()
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM document_embeddings;")
                count = cursor.fetchone()[0]
                cursor.close()
                self.db_pool.putconn(conn)

                if count == 0:
                    logger.error("pgvector table is empty")
                    global_state.system_status.pgvector_ready = False
                    valid = False
                else:
                    logger.info(
                        "pgvector table contains %s documents",
                        count,
                    )
                    global_state.system_status.pgvector_ready = True
            except Exception as e:
                logger.error(f"Error accessing pgvector: {str(e)}")
                global_state.system_status.pgvector_ready = False
                valid = False

        # Check BM25
        if (
            not self.bm25
            or not self.tokenized_corpus
            or len(self.tokenized_corpus) == 0
        ):
            logger.error("BM25 index not properly initialized")
            valid = False
        else:
            # Check if BM25 corpus matches document count
            if len(self.tokenized_corpus) != len(self.documents):
                logger.error(
                    "BM25 corpus size mismatch: %s vs %s documents",
                    len(self.tokenized_corpus),
                    len(self.documents),
                )
                valid = False
            else:
                logger.info(
                    "BM25 index contains %s documents",
                    len(self.tokenized_corpus),
                )

        # Set states based on validation
        if valid:
            logger.info("Search engine validation successful")
            self.is_initialized = True
            self.bm25_initialized = self.bm25 is not None
            global_state.system_status.index_ready = True
            global_state.system_status.bm25_ready = self.bm25_initialized
        else:
            logger.warning("Search engine validation failed")

        return valid

    def initialize(self, force_update=False):
        """Initialize search engine with pgvector."""
        try:
            # Ensure we have documents
            if not self.data_manager.documents:
                self.documents = self.data_manager.load_documents()
            else:
                self.documents = self.data_manager.documents

            if not self.documents or len(self.documents) == 0:
                logger.error("No documents loaded")
                return False

            # Add documents to pgvector
            if force_update or not self._pgvector_initialized():
                logger.info("Initializing pgvector with documents")
                success = self.data_manager._add_documents_to_pgvector(
                    self.documents
                )
                if not success:
                    logger.error("Failed to add documents to pgvector")
                    return False

            # Load or create BM25 index
            bm25_loaded = False
            if os.path.exists(BM25_FILE) and not force_update:
                try:
                    bm25_loaded = self._load_bm25()
                    if (
                        bm25_loaded
                        and self.tokenized_corpus
                        and len(self.tokenized_corpus) != len(self.documents)
                    ):
                        logger.warning(
                            "BM25 corpus size mismatch: %s vs %s documents",
                            len(self.tokenized_corpus),
                            len(self.documents),
                        )
                        bm25_loaded = False
                        self._setup_bm25()
                except Exception as e:
                    logger.error(f"Error loading BM25 index: {str(e)}")
                    bm25_loaded = False

            if not bm25_loaded:
                logger.info("Setting up BM25 from scratch")
                self._setup_bm25()

            # Validate the search engine state
            valid = self.validate_state()

            if valid:
                self.is_initialized = True
                global_state.system_status.index_ready = True
                global_state.save_state()
                logger.info("Search engine initialized successfully")
                return True
            else:
                logger.error("Search engine initialization failed validation")
                return False

        except Exception as e:
            logger.error(f"Error initializing search engine: {str(e)}")
            logger.error(traceback.format_exc())
            self.is_initialized = False
            global_state.system_status.index_ready = False
            global_state.save_state()
            return False

    def _pgvector_initialized(self) -> bool:
        """Check if pgvector has documents indexed."""
        try:
            conn = self.db_pool.getconn()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM document_embeddings;")
            count = cursor.fetchone()[0]
            cursor.close()
            self.db_pool.putconn(conn)
            return count > 0
        except Exception as e:
            logger.error(f"Error checking pgvector: {str(e)}")
            return False

    def _setup_bm25(self):
        """Set up BM25 index"""
        logger.info("Initializing BM25 index")

        # Make sure we have documents
        if not self.documents or len(self.documents) == 0:
            logger.error("Cannot set up BM25 with empty documents list")
            self.bm25_initialized = False
            global_state.system_status.bm25_ready = False
            return False

        # Prepare corpus for BM25
        self.tokenized_corpus = []

        # Get stopwords for multiple languages
        stop_words = set()
        for lang in ["english", "german", "french", "spanish", "italian"]:
            try:
                stop_words.update(stopwords.words(lang))
            except BaseException:
                pass

        # Tokenize documents
        for doc in tqdm(self.documents, desc="Tokenizing documents for BM25"):
            # Combine title, correspondent and content for search
            text = f"{doc['title']} {doc['correspondent']} {doc['content']}"

            # Tokenize and filter stopwords
            tokens = word_tokenize(text.lower())
            filtered_tokens = [
                token for token in tokens if token not in stop_words
            ]

            self.tokenized_corpus.append(filtered_tokens)

        # Create BM25 index
        self.bm25 = BM25Okapi(self.tokenized_corpus)
        self.bm25_initialized = True
        global_state.system_status.bm25_ready = True

        # Save BM25 index to disk
        self._save_bm25()

        logger.info("BM25 index initialized and saved to disk")
        return True

    def _save_bm25(self):
        """Save BM25 index to disk"""
        # Ensure directory exists
        os.makedirs(os.path.dirname(BM25_FILE), exist_ok=True)

        try:
            # Save both the BM25 object and the tokenized corpus
            with open(BM25_FILE, "wb") as f:
                pickle.dump(
                    {
                        "bm25": self.bm25,
                        "tokenized_corpus": self.tokenized_corpus,
                    },
                    f,
                )
            logger.info(f"Saved BM25 index to {BM25_FILE}")
            return True
        except Exception as e:
            logger.error(f"Error saving BM25 index: {str(e)}")
            return False

    def _load_bm25(self):
        """Load BM25 index from disk"""
        logger.info(f"Loading BM25 index from {BM25_FILE}")
        try:
            with open(BM25_FILE, "rb") as f:
                data = pickle.load(f)

            self.bm25 = data["bm25"]
            self.tokenized_corpus = data["tokenized_corpus"]

            # Validate BM25 index
            if (
                not self.bm25
                or not self.tokenized_corpus
                or len(self.tokenized_corpus) == 0
            ):
                logger.error("Loaded BM25 index is invalid or empty")
                self.bm25_initialized = False
                global_state.system_status.bm25_ready = False
                return False

            # Check if tokenized corpus matches our document count
            if len(self.tokenized_corpus) != len(self.documents):
                logger.warning(
                    "BM25 corpus size mismatch: %s vs %s documents",
                    len(self.tokenized_corpus),
                    len(self.documents),
                )
                # Don't fail here, the calling method will handle this

            self.bm25_initialized = True
            global_state.system_status.bm25_ready = True

            logger.info("BM25 index loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading BM25 index: {str(e)}")
            logger.error(traceback.format_exc())
            self.bm25_initialized = False
            global_state.system_status.bm25_ready = False
            return False

    def _add_new_documents_to_bm25(self):
        """Add only new documents to the BM25 index"""
        try:
            logger.info(
                "Adding %s new documents to BM25 index",
                len(self.data_manager.new_document_ids),
            )

            # If we don't have a tokenized corpus yet, we can't add to it
            if (
                not hasattr(self, "tokenized_corpus")
                or not self.tokenized_corpus
            ):
                logger.error("No existing tokenized corpus for BM25 update")
                self._setup_bm25()  # Rebuild from scratch
                return

            # Get stopwords for multiple languages
            stop_words = set()
            for lang in ["english", "german", "french", "spanish", "italian"]:
                try:
                    stop_words.update(stopwords.words(lang))
                except BaseException:
                    pass

            # Create a map for quick document lookup by ID
            documents_by_id = {doc["id"]: doc for doc in self.documents}

            # Process each new document
            new_docs_processed = 0
            for doc_id in self.data_manager.new_document_ids:
                if doc_id in documents_by_id:
                    doc = documents_by_id[doc_id]

                    # Tokenize the document
                    text = (
                        f"{doc['title']} {doc['correspondent']} "
                        f"{doc['content']}"
                    )
                    tokens = word_tokenize(text.lower())
                    filtered_tokens = [
                        token for token in tokens if token not in stop_words
                    ]

                    # Add to the tokenized corpus
                    self.tokenized_corpus.append(filtered_tokens)
                    new_docs_processed += 1

            # Rebuild BM25 with the updated corpus
            if new_docs_processed > 0:
                self.bm25 = BM25Okapi(self.tokenized_corpus)
                self.bm25_initialized = True
                global_state.system_status.bm25_ready = True

                # Save the updated BM25 index
                self._save_bm25()

                logger.info(
                    "BM25 index updated with %s new documents",
                    new_docs_processed,
                )
            else:
                logger.info("No new documents were processed for BM25")

        except Exception as e:
            logger.error(f"Error adding new documents to BM25: {str(e)}")
            logger.error(traceback.format_exc())
            # If anything goes wrong, rebuild from scratch
            self._setup_bm25()

    def keyword_search(self, query, top_k=MAX_RESULTS):
        """Perform keyword search using BM25"""
        if not self.is_initialized:
            logger.error("Search engine not initialized for keyword search")
            raise Exception("Search engine not initialized")

        if (
            not self.bm25_initialized
            or not self.bm25
            or not self.tokenized_corpus
        ):
            logger.error("BM25 index not properly initialized")
            raise Exception("BM25 index not properly initialized")

        # Ensure documents match tokenized corpus
        if len(self.tokenized_corpus) != len(self.documents):
            logger.error(
                "BM25 corpus size mismatch: %s vs %s documents",
                len(self.tokenized_corpus),
                len(self.documents),
            )
            raise Exception("BM25 index does not match document count")

        # Tokenize query
        query_tokens = word_tokenize(query.lower())

        # Get BM25 scores
        scores = self.bm25.get_scores(query_tokens)

        # Check if scores is a valid array
        if not isinstance(scores, np.ndarray) or len(scores) != len(
            self.documents
        ):
            if hasattr(scores, "__len__"):
                length_str = len(scores)
            else:
                length_str = "unknown"
            logger.error(
                "Invalid BM25 scores: %s, length %s",
                type(scores),
                length_str,
            )
            raise Exception("BM25 returned invalid scores")

        # Get document indices sorted by score
        doc_scores = [(i, score) for i, score in enumerate(scores)]
        doc_scores.sort(key=lambda x: x[1], reverse=True)

        # Get top-k documents
        results = []
        for i, score in doc_scores[:top_k]:
            if score > 0:  # Only include documents with non-zero scores
                try:
                    doc = self.documents[i]
                    results.append(
                        {
                            "id": doc["id"],
                            "title": doc["title"],
                            "correspondent": doc["correspondent"],
                            "date": doc["created"],
                            "score": float(score),
                            "content": doc["content"],
                        }
                    )
                except IndexError as e:
                    logger.error(
                        "Document index out of range: %s (max: %s)",
                        i,
                        len(self.documents) - 1,
                    )
                except Exception as e:
                    logger.error(
                        f"Error processing document at index {i}: {str(e)}"
                    )

        logger.info(f"Keyword search found {len(results)} results")
        return results

    def semantic_search(self, query, top_k=MAX_RESULTS):
        """Perform semantic search using PostgreSQL + pgvector"""
        if not self.is_initialized:
            logger.error("Search engine not initialized for semantic search")
            raise Exception("Search engine not initialized")

        if not self.db_pool:
            logger.error("PostgreSQL + pgvector not properly initialized")
            raise Exception("PostgreSQL + pgvector not properly initialized")

        try:
            # Generate embedding for query
            query_embedding = self.data_manager.sentence_transformer.encode(query)

            conn = self.db_pool.getconn()
            cursor = conn.cursor()

            # Perform vector similarity search using cosine distance
            cursor.execute("""
                SELECT 
                    doc_id,
                    title,
                    correspondent,
                    created,
                    content,
                    1 - (embedding <=> %s::vector) as similarity_score
                FROM document_embeddings
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
            """, (query_embedding.tolist(), query_embedding.tolist(), top_k))

            results = []
            for row in cursor.fetchall():
                doc_id, title, correspondent, created, content, score = row

                # Find document in our list for additional metadata
                doc = next(
                    (d for d in self.documents if d["id"] == doc_id),
                    None,
                )

                if doc:
                    results.append({
                        "id": doc_id,
                        "title": title,
                        "correspondent": correspondent,
                        "date": created.isoformat() if created else "",
                        "score": float(score),
                        "content": content,
                    })

            cursor.close()
            self.db_pool.putconn(conn)

            logger.info(f"Semantic search found {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Error in semantic search: {str(e)}")
            logger.error(traceback.format_exc())
            return []

    def hybrid_search(self, query, top_k=MAX_RESULTS):
        """Perform hybrid search combining BM25 and pgvector"""
        logger.info(f"Performing hybrid search for query: '{query}'")

        if not self.is_initialized:
            logger.error("Search engine not initialized for hybrid search")
            self.initialize(force_update=False)
            if not self.is_initialized:
                raise Exception("Search engine could not be initialized")

        # Ensure both search components are ready
        if not self.bm25_initialized:
            logger.error("BM25 not initialized for hybrid search")
            self._setup_bm25()
            if not self.bm25_initialized:
                logger.warning("Falling back to semantic search only")
                return self.semantic_search(query, top_k)

        if not self.db_pool:
            logger.error("pgvector not available for hybrid search")
            logger.warning("Falling back to keyword search only")
            return self.keyword_search(query, top_k)

        # Get results from both search methods
        try:
            keyword_results = self.keyword_search(query, top_k=top_k * 2)
        except Exception as e:
            logger.error(f"Keyword search failed: {str(e)}")
            keyword_results = []

        try:
            semantic_results = self.semantic_search(query, top_k=top_k * 2)
        except Exception as e:
            logger.error(f"Semantic search failed: {str(e)}")
            semantic_results = []

        # If both searches failed, return a proper error
        if not keyword_results and not semantic_results:
            logger.error("Both search methods failed")
            raise Exception("All search methods failed")

        # Combine results (same logic as before)
        results_map = {}

        # Normalize scores
        if keyword_results:
            max_keyword_score = max(
                (r["score"] for r in keyword_results), default=1.0
            )
            for r in keyword_results:
                r["score"] = (
                    r["score"] / max_keyword_score
                    if max_keyword_score > 0
                    else 0
                )

        if semantic_results:
            for r in semantic_results:
                r["score"] = r["score"] if r["score"] <= 1 else 0

        # Add keyword results with weight
        for result in keyword_results:
            doc_id = result["id"]
            results_map[doc_id] = {
                **result,
                "score": result["score"] * BM25_WEIGHT,
            }

        # Add semantic results with weight
        for result in semantic_results:
            doc_id = result["id"]
            if doc_id in results_map:
                results_map[doc_id]["score"] += (
                    result["score"] * SEMANTIC_WEIGHT
                )
            else:
                results_map[doc_id] = {
                    **result,
                    "score": result["score"] * SEMANTIC_WEIGHT,
                }

        # Convert map to list and sort by score
        combined_results = list(results_map.values())
        combined_results.sort(key=lambda x: x["score"], reverse=True)

        logger.info(f"Hybrid search found {len(combined_results)} results")
        return combined_results[:top_k]

    def rerank_results(self, query, results, top_k=MAX_RESULTS):
        """Rerank results using cross-encoder"""
        # More defensive check
        if not results or len(results) == 0:
            logger.warning("No results to rerank")
            return []

        try:
            # Prepare pairs for cross-encoder
            pairs = [
                (
                    query,
                    (
                        f"{result['title']} {result['content'][:500]}"
                        if "content" in result and result["content"]
                        else result.get("title", "")
                    ),
                )
                for result in results
            ]

            # Make sure we have valid pairs
            if not pairs:
                logger.warning("No valid pairs to rerank")
                return results  # Return original results without reranking

            # Get cross-encoder scores
            cross_scores = self.data_manager.cross_encoder.predict(pairs)

            # Make sure we got valid scores
            if not isinstance(cross_scores, np.ndarray) or len(
                cross_scores
            ) != len(results):
                if hasattr(cross_scores, "__len__"):
                    cross_len = len(cross_scores)
                else:
                    cross_len = "invalid"
                msg = "Invalid cross-encoder scores for %s results (got %s)"
                logger.error(msg, len(results), cross_len)
                for result in results:
                    result["cross_score"] = 0.5  # Default score
                return results  # Return original results with default scores

            # Add cross-encoder scores to results
            for i, score in enumerate(cross_scores):
                if i < len(results):  # Make sure we don't go out of bounds
                    # Convert score to a positive value by taking the sigmoid
                    # This maps any score to a value between 0 and 1
                    # For cross-encoders, higher should be better matches
                    norm_score = 1.0 / (1.0 + np.exp(-score))
                    results[i]["cross_score"] = float(norm_score)

            # Fill in any missing scores
            for i in range(len(results)):
                if "cross_score" not in results[i]:
                    results[i]["cross_score"] = 0.5  # Default score

            # Sort by cross-encoder score
            results.sort(key=lambda x: x["cross_score"], reverse=True)

            logger.info(f"Reranked {len(results)} results")
            return results[:top_k]

        except Exception as e:
            logger.error(f"Error reranking results: {str(e)}")
            logger.error(traceback.format_exc())

            # Add default cross scores and return the original results
            for result in results:
                result["cross_score"] = 0.5  # Default score

            return results[:top_k]

    def create_snippet(self, query, content, max_len=200):
        """Create a relevant snippet from the document content"""
        if not content:
            return ""

        try:
            # Get query terms
            query_terms = set(word_tokenize(query.lower()))

            # Split content into sentences
            sentences = content.split(". ")

            # Score sentences by number of query terms
            sentence_scores = []
            for sentence in sentences:
                sentence_terms = set(word_tokenize(sentence.lower()))
                score = len(query_terms.intersection(sentence_terms))
                sentence_scores.append((sentence, score))

            # Sort sentences by score
            sentence_scores.sort(key=lambda x: x[1], reverse=True)

            # Create snippet from top sentences
            snippet = ""
            for sentence, _ in sentence_scores:
                if len(snippet) + len(sentence) <= max_len:
                    snippet += sentence + ". "
                else:
                    break

            # If snippet is empty (no term matches), just use the beginning of
            # the content
            if not snippet and content:
                snippet = content[:max_len] + "..."

            return snippet.strip()

        except Exception as e:
            logger.error(f"Error creating snippet: {str(e)}")
            # Fallback to simple snippet creation
            if content:
                return content[:max_len] + "..."
            return ""

    def search(self, request: SearchRequest):
        """Perform full search with filters and reranking"""
        if not self.is_initialized:
            logger.error("Search engine not initialized")
            # Try to initialize before failing
            success = self.initialize(force_update=False)
            if not success:
                raise Exception("Search engine could not be initialized")

        query = request.query
        logger.info(f"Performing search for: '{query}'")

        try:
            # Perform hybrid search
            results = self.hybrid_search(query)

            # Check if we got valid results
            if not results:
                logger.warning("Hybrid search returned no results")
                return []

            # Apply filters
            if request.from_date or request.to_date or request.correspondent:
                filtered_results = []
                for result in results:
                    include = True

                    # Filter by date range
                    if request.from_date and result["date"]:
                        try:
                            doc_date = result["date"].split("T")[
                                0
                            ]  # Get date part only
                            if doc_date < request.from_date:
                                include = False
                        except BaseException:
                            pass

                    if request.to_date and result["date"]:
                        try:
                            doc_date = result["date"].split("T")[
                                0
                            ]  # Get date part only
                            if doc_date > request.to_date:
                                include = False
                        except BaseException:
                            pass

                    # Filter by correspondent
                    if request.correspondent and result["correspondent"]:
                        if (
                            request.correspondent.lower()
                            not in result["correspondent"].lower()
                        ):
                            include = False

                    if include:
                        filtered_results.append(result)

                results = filtered_results

            # Check if we still have results after filtering
            if not results:
                logger.warning("No results after applying filters")
                return []

            # Rerank results
            reranked_results = self.rerank_results(query, results)

            # Format results
            formatted_results = []
            for result in reranked_results:
                try:
                    snippet = self.create_snippet(query, result["content"])

                    formatted_results.append(
                        SearchResult(
                            title=result["title"] or "Untitled",
                            correspondent=result["correspondent"] or "",
                            date=result["date"] or "",
                            score=result["score"],
                            cross_score=result.get("cross_score", 0.5),
                            snippet=snippet,
                            doc_id=result["id"],
                        )
                    )
                except Exception as item_e:
                    logger.error(
                        f"Error formatting search result: {str(item_e)}"
                    )

            logger.info(f"Returning {len(formatted_results)} search results")
            return formatted_results

        except Exception as e:
            logger.error(f"Error in search: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Search failed: {str(e)}",
            )


# Indexierung als Hintergrundaufgabe
