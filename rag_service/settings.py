import os
import nltk
from dotenv import load_dotenv

from .logging_utils import logger

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")

DOCUMENTS_FILE = os.path.join(DATA_DIR, "documents.json")
CHROMADB_DIR = os.path.join(DATA_DIR, "chromadb")
BM25_FILE = os.path.join(DATA_DIR, "bm25_index.pkl")
STATE_FILE = os.path.join(DATA_DIR, "system_state.json")

EMBEDDING_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
CROSS_ENCODER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
COLLECTION_NAME = "documents"
BM25_WEIGHT = 0.3
SEMANTIC_WEIGHT = 0.7
MAX_RESULTS = 20


def load_environment():
    data_env_path = os.path.join(DATA_DIR, ".env")
    if os.path.exists(data_env_path):
        load_dotenv(dotenv_path=data_env_path, verbose=True)
        logger.info(f"Loaded environment variables from {data_env_path}")
    else:
        local_env_path = os.path.join(ROOT_DIR, ".env")
        if os.path.exists(local_env_path):
            load_dotenv(dotenv_path=local_env_path, verbose=True)
            logger.info(f"Loaded environment variables from {local_env_path}")
        else:
            logger.warning("No .env file found in data directory or locally")

    logger.info(f"Loaded PAPERLESS_URL: {os.getenv('PAPERLESS_URL')}")
    logger.info(f"Loaded PAPERLESS_NGX_URL: {os.getenv('PAPERLESS_NGX_URL')}")
    logger.info(f"Loaded PAPERLESS_HOST: {os.getenv('PAPERLESS_HOST')}")
    logger.info(
        "Loaded PAPERLESS_API_TOKEN: %s",
        "[SET]" if os.getenv("PAPERLESS_API_TOKEN") else "[NOT SET]",
    )


def ensure_nltk_resources():
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    nltk.download("stopwords", quiet=True)
