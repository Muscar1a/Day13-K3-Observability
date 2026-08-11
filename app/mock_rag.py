from __future__ import annotations

import random
import time
import structlog

from .incidents import STATE

log = structlog.get_logger()

CORPUS = {
    "refund": ["Refunds are available within 7 days with proof of purchase."],
    "monitoring": ["Metrics detect incidents, traces localize them, logs explain root cause."],
    "policy": ["Do not expose PII in logs. Use sanitized summaries only."],
}


def retrieve(message: str) -> list[str]:
    started = time.perf_counter()
    if STATE.get("tool_fail", False):
        raise RuntimeError("Vector store timeout")
    if STATE.get("rag_slow", False):
        delay = max(1.5, random.gauss(2.5, 0.4))
        time.sleep(delay)
        if random.random() < 0.15:
            raise RuntimeError("Vector Store Connection Timeout")
    else:
        delay = max(0.01, random.gauss(0.04, 0.01))
        time.sleep(delay)

    lowered = message.lower()
    docs_res = ["No domain document matched. Use general fallback answer."]
    for key, docs in CORPUS.items():
        if key in lowered:
            docs_res = docs
            break
            
    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info("rag_retrieval_done", latency_ms=latency_ms, doc_count=len(docs_res))
    return docs_res

