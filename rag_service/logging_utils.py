import logging

_configured = False


def configure_logging():
    global _configured
    if _configured:
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )
    _configured = True


def get_logger(name="RAGZ"):
    configure_logging()
    return logging.getLogger(name)


logger = get_logger()
