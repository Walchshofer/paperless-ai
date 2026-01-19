from logging_utils import configure_logging
from settings import load_environment, ensure_nltk_resources

configure_logging()
load_environment()
ensure_nltk_resources()
