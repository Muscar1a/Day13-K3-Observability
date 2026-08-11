from __future__ import annotations

import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from structlog.contextvars import bind_contextvars, clear_contextvars


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        clear_contextvars()

        req_id_header = request.headers.get("x-request-id")
        if req_id_header:
            correlation_id = req_id_header
        else:
            correlation_id = f"req-{uuid.uuid4().hex[:8]}"
        
        bind_contextvars(correlation_id=correlation_id)
        
        request.state.correlation_id = correlation_id
        
        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            response.headers["x-request-id"] = correlation_id
            response.headers["x-response-time-ms"] = str(duration_ms)
            return response
        except Exception as e:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            import structlog
            structlog.get_logger().error("request_failed", error=str(e), duration_ms=duration_ms)
            raise
