import logging
import sys
from pythonjsonlogger import jsonlogger

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    logHandler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={
            "levelname": "level",
            "asctime": "timestamp"
        }
    )
    logHandler.setFormatter(formatter)
    
    # Remove existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.addHandler(logHandler)
    
    # Disable uvicorn default loggers from printing plain text
    logging.getLogger("uvicorn.access").handlers = [logHandler]
    logging.getLogger("uvicorn.error").handlers = [logHandler]
    
    return logger
