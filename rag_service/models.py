from typing import Optional

from pydantic import BaseModel


class IndexingStatus(BaseModel):
    running: bool = False
    last_indexed: Optional[str] = None
    documents_count: int = 0
    up_to_date: bool = False
    message: str = ""


class SystemStatus(BaseModel):
    server_up: bool = True
    data_loaded: bool = False
    index_ready: bool = False
    pgvector_ready: bool = False
    bm25_ready: bool = False
    indexing_status: IndexingStatus = IndexingStatus()


class SearchRequest(BaseModel):
    query: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    correspondent: Optional[str] = None


class IndexingRequest(BaseModel):
    force: bool = False
    background: bool = True


class AskQuestionRequest(BaseModel):
    question: str
    max_sources: int = 5


class SearchResult(BaseModel):
    title: str
    correspondent: str
    date: str
    score: float
    cross_score: float
    snippet: str
    doc_id: Optional[int] = None
