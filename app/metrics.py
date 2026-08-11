from __future__ import annotations

from collections import Counter
from statistics import mean

REQUEST_LATENCIES: list[int] = []
REQUEST_COSTS: list[float] = []
REQUEST_TOKENS_IN: list[int] = []
REQUEST_TOKENS_OUT: list[int] = []
ERRORS: Counter[str] = Counter()
TRAFFIC: int = 0
QUALITY_SCORES: list[float] = []

MODEL_STATS: dict[str, dict] = {
    "gpt-4o": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
    "gpt-4o-mini": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
    "claude-3.5": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
    "embedding-3": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
    "vision-1": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
    "voyage-1": {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0},
}


def record_request(latency_ms: int, cost_usd: float, tokens_in: int, tokens_out: int, quality_score: float, model: str = "gpt-4o") -> None:
    global TRAFFIC
    TRAFFIC += 1
    REQUEST_LATENCIES.append(latency_ms)
    if len(REQUEST_LATENCIES) > 10:
        REQUEST_LATENCIES.pop(0)

    REQUEST_COSTS.append(cost_usd)
    REQUEST_TOKENS_IN.append(tokens_in)
    REQUEST_TOKENS_OUT.append(tokens_out)
    QUALITY_SCORES.append(quality_score)

    if model not in MODEL_STATS:
        MODEL_STATS[model] = {"requests": 0, "latencies": [], "recent_statuses": [], "errors": 0, "cost": 0.0}
    
    m_stat = MODEL_STATS[model]
    m_stat["requests"] += 1
    m_stat["latencies"].append(latency_ms)
    m_stat["recent_statuses"].append(1)  # 1 = success

    if len(m_stat["latencies"]) > 10:
        m_stat["latencies"] = m_stat["latencies"][-10:]
    if len(m_stat["recent_statuses"]) > 10:
        m_stat["recent_statuses"] = m_stat["recent_statuses"][-10:]

    m_stat["cost"] = round(m_stat["cost"] + cost_usd, 4)


def record_error(error_type: str, model: str = "gpt-4o") -> None:
    ERRORS[error_type] += 1
    if model in MODEL_STATS:
        MODEL_STATS[model]["errors"] += 1
        MODEL_STATS[model]["recent_statuses"].append(0)  # 0 = error
        if len(MODEL_STATS[model]["recent_statuses"]) > 10:
            MODEL_STATS[model]["recent_statuses"] = MODEL_STATS[model]["recent_statuses"][-10:]


def percentile(values: list[int], p: int) -> float:
    if not values:
        return 0.0
    items = sorted(values)
    idx = max(0, min(len(items) - 1, round((p / 100) * len(items) + 0.5) - 1))
    return float(items[idx])


def snapshot() -> dict:
    # Compute active breakdown with recent window stats and true P95
    active_breakdown = {}
    all_recent_latencies: list[int] = []
    
    for name, m in MODEL_STATS.items():
        recent_lat = m["latencies"]
        all_recent_latencies.extend(recent_lat)
        recent_st = m["recent_statuses"]
        err_count_recent = recent_st.count(0)
        recent_err_rate = round((err_count_recent / max(1, len(recent_st))) * 100, 2)
        model_p95 = round(percentile(recent_lat, 95)) if recent_lat else 0
        
        active_breakdown[name] = {
            "requests": m["requests"],
            "latencies": recent_lat,
            "latency_p95": model_p95,
            "errors": m["errors"],
            "recent_error_rate": recent_err_rate,
            "cost": m["cost"],
        }

    model_p95s = [b["latency_p95"] for b in active_breakdown.values() if b["latency_p95"] > 0]
    global_p95 = round(mean(model_p95s)) if model_p95s else round(percentile(REQUEST_LATENCIES, 95))

    return {
        "traffic": TRAFFIC,
        "latency_p50": percentile(all_recent_latencies if all_recent_latencies else REQUEST_LATENCIES, 50),
        "latency_p95": global_p95,
        "latency_p99": percentile(all_recent_latencies if all_recent_latencies else REQUEST_LATENCIES, 99),
        "avg_cost_usd": round(mean(REQUEST_COSTS), 4) if REQUEST_COSTS else 0.0,
        "total_cost_usd": round(sum(REQUEST_COSTS), 4),
        "tokens_in_total": sum(REQUEST_TOKENS_IN),
        "tokens_out_total": sum(REQUEST_TOKENS_OUT),
        "error_breakdown": dict(ERRORS),
        "quality_avg": round(mean(QUALITY_SCORES), 4) if QUALITY_SCORES else 0.0,
        "model_breakdown": active_breakdown,
    }


