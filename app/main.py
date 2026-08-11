from __future__ import annotations

import asyncio
import json
import os
import random
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from structlog.contextvars import bind_contextvars, clear_contextvars

from .agent import LabAgent
from .dashboard_aggregator import get_dashboard_metrics
from .incidents import disable, enable, status
from .logging_config import LOG_PATH, configure_logging, get_logger
from .metrics import record_error, snapshot
from .middleware import CorrelationIdMiddleware
from .pii import hash_user_id, summarize_text
from .schemas import ChatRequest, ChatResponse
from .tracing import flush_langfuse, tracing_enabled

configure_logging()
log = get_logger()
app = FastAPI(title="Day 13 Observability Lab")
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
agent = LabAgent()

AVAILABLE_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-3.5",
    "embedding-3",
    "vision-1",
    "voyage-1",
]

SIMULATOR_MESSAGES = [
    "What is the refund policy for digital goods?",
    "Please update my shipping address to 123 Main St.",
    "How do I reset my password?",
    "I need a refund for my order #12345.",
    "Show me system monitoring metrics.",
    "What is the policy on data retention?",
]


async def background_traffic_simulator() -> None:
    """Continuously generates realistic background synthetic traffic across all models."""
    log.info("background_traffic_simulator_started")
    step = 0
    while True:
        try:
            await asyncio.sleep(random.uniform(0.4, 0.8))
            clear_contextvars()
            cid = f"req-{uuid.uuid4().hex[:8]}"
            model_choice = random.choice(AVAILABLE_MODELS)
            msg = SIMULATOR_MESSAGES[step % len(SIMULATOR_MESSAGES)]
            feat = "refund" if "refund" in msg else "general"
            user_id = f"user_{random.randint(100, 999)}"
            session_id = f"sess_{random.randint(10, 99)}"
            user_id_hash = hash_user_id(user_id)

            bind_contextvars(
                correlation_id=cid,
                user_id_hash=user_id_hash,
                session_id=session_id,
                feature=feat,
                model=model_choice,
                env=os.getenv("APP_ENV", "dev"),
            )

            # Create agent for specific model
            model_agent = LabAgent(model=model_choice)
            try:
                res = await asyncio.to_thread(
                    model_agent.run,
                    user_id=user_id,
                    feature=feat,
                    session_id=session_id,
                    message=msg,
                )
                log.info(
                    "response_sent",
                    service="api",
                    feature=feat,
                    model=model_choice,
                    latency_ms=res.latency_ms,
                    tokens_in=res.tokens_in,
                    tokens_out=res.tokens_out,
                    cost_usd=res.cost_usd,
                    quality_score=res.quality_score,
                    payload={"answer_preview": summarize_text(res.answer)},
                )
            except Exception as exc:
                record_error(type(exc).__name__, model=model_choice)
                log.error(
                    "request_failed",
                    service="api",
                    model=model_choice,
                    error_type=type(exc).__name__,
                    payload={"detail": str(exc)},
                )
            step += 1
            if step % 5 == 0:
                flush_langfuse()
            clear_contextvars()
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.error("background_simulator_error", error=str(e))



@app.on_event("startup")
async def startup() -> None:
    log.info(
        "app_started",
        service=os.getenv("APP_NAME", "day13-observability-lab"),
        env=os.getenv("APP_ENV", "dev"),
        payload={"tracing_enabled": tracing_enabled()},
    )
    asyncio.create_task(background_traffic_simulator())


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "tracing_enabled": tracing_enabled(), "incidents": status()}


@app.get("/metrics")
async def metrics() -> dict:
    data = snapshot()
    models_stats = data.get("model_breakdown", {})
    
    total_reqs = data.get("traffic", 0)
    total_errors = sum(m.get("errors", 0) for m in models_stats.values())
    error_rate_pct = round((total_errors / max(1, total_reqs)) * 100, 2)

    summary = {
        "total_requests": total_reqs,
        "latency_p95_ms": data.get("latency_p95", 0),
        "total_cost_usd": data.get("total_cost_usd", 0.0),
        "error_rate_pct": error_rate_pct,
        "model_breakdown": models_stats,
        "raw_snapshot": data,
    }
    return {"summary": summary, "snapshot": data}



@app.get("/logs")
async def get_logs(correlation_id: str | None = None, limit: int = 100) -> list[dict]:
    if not LOG_PATH.exists():
        return []
    records = []
    with LOG_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if correlation_id and data.get("correlation_id") != correlation_id:
                    continue
                records.append(data)
            except json.JSONDecodeError:
                continue
    return records[-limit:]


@app.get("/traces")
async def get_traces(limit: int = 50) -> list[dict]:
    if not LOG_PATH.exists():
        return []

    traces_map: dict[str, list[dict]] = {}
    with LOG_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                cid = data.get("correlation_id")
                if cid:
                    if cid not in traces_map:
                        traces_map[cid] = []
                    traces_map[cid].append(data)
            except json.JSONDecodeError:
                continue

    result = []
    for cid, events in list(traces_map.items())[-limit:]:
        start_ts = events[0].get("ts", "")
        feature = events[0].get("feature", "general")
        user_id_hash = events[0].get("user_id_hash", "anonymous")

        latency_ms = 0
        has_error = False
        has_slow_rag = False

        for ev in events:
            if ev.get("level") == "error":
                has_error = True
            if "latency_ms" in ev:
                latency_ms = max(latency_ms, ev.get("latency_ms", 0))
            if ev.get("event") == "rag_retrieval_done" and ev.get("latency_ms", 0) > 2000:
                has_slow_rag = True

        result.append(
            {
                "correlation_id": cid,
                "timestamp": start_ts,
                "feature": feature,
                "user_id_hash": user_id_hash,
                "latency_ms": latency_ms,
                "events_count": len(events),
                "has_error": has_error,
                "has_slow_rag": has_slow_rag,
                "status": "degraded" if (has_slow_rag or latency_ms > 2000 or has_error) else "healthy",
                "spans": events,
            }
        )
    return list(reversed(result))


@app.post("/simulate")
async def simulate_traffic(attack: bool = False, count: int = 3) -> dict:
    if attack:
        enable("rag_slow")
        log.warning("attack_simulation_started", service="control", payload={"incident": "rag_slow"})
    else:
        disable("rag_slow")

    test_messages = [
        "What is the refund policy for digital goods?",
        "Please update my shipping address to 123 Main St.",
        "How do I reset my password?",
        "I need a refund for my order #12345.",
    ]

    for i in range(count):
        msg = test_messages[i % len(test_messages)]
        feat = "refund" if ("refund" in msg and attack) else "general"
        user_id = f"user_{i+100}"
        session_id = f"sess_{i+1}"
        user_id_hash = hash_user_id(user_id)
        bind_contextvars(
            user_id_hash=user_id_hash,
            session_id=session_id,
            feature=feat,
            model=agent.model,
            env=os.getenv("APP_ENV", "dev"),
        )
        try:
            res = agent.run(
                user_id=user_id,
                feature=feat,
                session_id=session_id,
                message=msg,
            )
            log.info(
                "response_sent",
                service="api",
                feature=feat,
                latency_ms=res.latency_ms,
                tokens_in=res.tokens_in,
                tokens_out=res.tokens_out,
                cost_usd=res.cost_usd,
                quality_score=res.quality_score,
                payload={"answer_preview": summarize_text(res.answer)},
            )
        except Exception as exc:  # pragma: no cover
            record_error(type(exc).__name__)
            log.error(
                "request_failed",
                service="api",
                error_type=type(exc).__name__,
                payload={"detail": str(exc)},
            )

    return {"ok": True, "attack_mode": attack, "count": count, "incidents": status()}


@app.get("/dashboard")
async def dashboard_page():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Dashboard UI not found")


@app.get("/api/dashboard-data")
async def dashboard_data():
    return get_dashboard_metrics()


@app.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    user_id_hash = hash_user_id(body.user_id)
    bind_contextvars(
        user_id_hash=user_id_hash,
        session_id=body.session_id,
        feature=body.feature,
        model=agent.model,
        env=os.getenv("APP_ENV", "dev"),
    )
    
    log.info(
        "request_received",
        service="api",
        payload={"message_preview": summarize_text(body.message)},
    )
    try:
        result = agent.run(
            user_id=body.user_id,
            feature=body.feature,
            session_id=body.session_id,
            message=body.message,
        )
        log.info(
            "response_sent",
            service="api",
            latency_ms=result.latency_ms,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=result.cost_usd,
            quality_score=result.quality_score,
            payload={"answer_preview": summarize_text(result.answer)},
        )
        return ChatResponse(
            answer=result.answer,
            correlation_id=request.state.correlation_id,
            latency_ms=result.latency_ms,
            tokens_in=result.tokens_in,
            tokens_out=result.tokens_out,
            cost_usd=result.cost_usd,
            quality_score=result.quality_score,
        )
    except Exception as exc:  # pragma: no cover
        error_type = type(exc).__name__
        record_error(error_type)
        log.error(
            "request_failed",
            service="api",
            error_type=error_type,
            payload={"detail": str(exc), "message_preview": summarize_text(body.message)},
        )
        raise HTTPException(status_code=500, detail=error_type) from exc


@app.post("/incidents/{name}/enable")
async def enable_incident(name: str) -> JSONResponse:
    try:
        enable(name)
        log.warning("incident_enabled", service="control", payload={"name": name})
        return JSONResponse({"ok": True, "incidents": status()})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/incidents/{name}/disable")
async def disable_incident(name: str) -> JSONResponse:
    try:
        disable(name)
        log.warning("incident_disabled", service="control", payload={"name": name})
        return JSONResponse({"ok": True, "incidents": status()})
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def _auto_recover(delay_seconds: int = 12) -> None:
    await asyncio.sleep(delay_seconds)
    disable("rag_slow")
    disable("cost_spike")
    disable("tool_fail")
    log.info("incident_auto_recovered_to_normal", service="control")


@app.post("/incidents/demo_attack")
async def demo_attack() -> dict:
    enable("rag_slow")
    enable("cost_spike")
    log.warning("demo_attack_triggered", service="control", payload={"incidents": ["rag_slow", "cost_spike"]})

    # Auto recover back to normal after 12 seconds
    asyncio.create_task(_auto_recover(12))

    # Immediate burst execution for demonstration
    test_models = ["gpt-4o", "gpt-4o-mini", "claude-3.5"]
    for i, m in enumerate(test_models):
        user_id = f"user_attack_{i}"
        session_id = f"sess_attack_{i}"
        user_id_hash = hash_user_id(user_id)
        bind_contextvars(
            user_id_hash=user_id_hash,
            session_id=session_id,
            feature="refund",
            model=m,
            env=os.getenv("APP_ENV", "dev"),
        )
        try:
            model_agent = LabAgent(model=m)
            res = await asyncio.to_thread(model_agent.run, user_id=user_id, feature="refund", session_id=session_id, message="I need a refund for my order #12345.")
            log.info("response_sent", service="api", feature="refund", model=m, latency_ms=res.latency_ms, cost_usd=res.cost_usd)
        except Exception as exc:
            record_error(type(exc).__name__, model=m)
            log.error("request_failed", service="api", model=m, error_type=type(exc).__name__, payload={"detail": str(exc)})

    return {"ok": True, "message": "Cascading incident (rag_slow + cost_spike) triggered!", "incidents": status()}

