import logging
import os
from datetime import datetime


def configure_logging() -> None:
    """
    Configure application-wide logging to write into the logs/ directory.
    """
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
    os.makedirs(logs_dir, exist_ok=True)

    log_filename = datetime.now().strftime("app_%Y-%m-%d.log")
    log_path = os.path.join(logs_dir, log_filename)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


