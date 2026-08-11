from __future__ import annotations

import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from structlog.contextvars import bind_contextvars, clear_contextvars


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        clear_contextvars()

        correlation_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id")
        if not correlation_id:
            correlation_id = f"req-{uuid.uuid4().hex[:8]}"

        bind_contextvars(correlation_id=correlation_id)
        request.state.correlation_id = correlation_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            response.headers["x-request-id"] = correlation_id
            response.headers["x-correlation-id"] = correlation_id
            response.headers["x-response-time-ms"] = str(elapsed_ms)
            return response
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            import structlog
            structlog.get_logger().error("request_failed", error=str(e), duration_ms=elapsed_ms)
            raise
