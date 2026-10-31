"""Request diagnostics and safe errors inside the CORS middleware."""
import logging
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("backend")


async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    context = {
        "endpoint": request.url.path,
        "method": request.method,
        "request_id": request_id,
    }
    logger.info("Request started", extra=context)
    try:
        response = await call_next(request)
    except Exception:
        # Return through the outer CORS layer. Otherwise Starlette's outermost
        # error handler produces a 500 without CORS headers, hiding the status
        # from the frontend and making server failures look like network errors.
        logger.exception("Request failed [%s] %s %s", request_id, request.method, request.url.path, extra=context)
        response = JSONResponse(
            status_code=500,
            content={"detail": "The server could not complete this request. Please try again.", "request_id": request_id},
        )
    response.headers["X-Request-ID"] = request_id
    logger.info("Request completed", extra={**context, "status_code": response.status_code})
    return response
