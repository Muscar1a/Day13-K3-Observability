from __future__ import annotations

import json
import math
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

LOG_PATH = Path(os.getenv("LOG_PATH", "data/logs.jsonl"))


def calculate_percentile(values: List[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(sorted_vals[int(k)], 2)
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return round(d0 + d1, 2)


def get_dashboard_metrics() -> Dict[str, Any]:
    if not LOG_PATH.exists():
        records: List[Dict[str, Any]] = []
    else:
        records = []
        for line in LOG_PATH.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    received_events = [r for r in records if r.get("event") == "request_received"]
    sent_events = [r for r in records if r.get("event") == "response_sent"]
    failed_events = [r for r in records if r.get("event") == "request_failed"]

    # Latency percentiles
    latencies = [float(r["latency_ms"]) for r in sent_events if "latency_ms" in r]
    p50 = calculate_percentile(latencies, 50)
    p95 = calculate_percentile(latencies, 95)
    p99 = calculate_percentile(latencies, 99)

    # Traffic
    total_received = len(received_events)

    # Errors
    total_failed = len(failed_events)
    error_rate_pct = round((total_failed / total_received * 100), 2) if total_received > 0 else 0.0
    error_breakdown: Dict[str, int] = {}
    for f in failed_events:
        err = f.get("error_type", "UnknownError")
        error_breakdown[err] = error_breakdown.get(err, 0) + 1

    # Cost
    costs = [float(r["cost_usd"]) for r in sent_events if "cost_usd" in r]
    total_cost_usd = round(sum(costs), 4)

    # Tokens
    tokens_in = sum(int(r.get("tokens_in", 0)) for r in sent_events)
    tokens_out = sum(int(r.get("tokens_out", 0)) for r in sent_events)

    # Quality
    qualities = [float(r["quality_score"]) for r in sent_events if "quality_score" in r]
    mean_quality = round(sum(qualities) / len(qualities), 2) if qualities else 1.0

    # Time series bucketing (by 1-minute intervals)
    time_series: Dict[str, Dict[str, Any]] = {}
    for r in records:
        ts_str = r.get("ts")
        if not ts_str:
            continue
        try:
            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            minute_key = dt.strftime("%H:%M")
        except Exception:
            continue

        if minute_key not in time_series:
            time_series[minute_key] = {
                "minute": minute_key,
                "requests": 0,
                "latencies": [],
                "cost": 0.0,
                "tokens_in": 0,
                "tokens_out": 0,
                "errors": 0,
            }

        evt = r.get("event")
        if evt == "request_received":
            time_series[minute_key]["requests"] += 1
        elif evt == "response_sent":
            if "latency_ms" in r:
                time_series[minute_key]["latencies"].append(float(r["latency_ms"]))
            if "cost_usd" in r:
                time_series[minute_key]["cost"] += float(r["cost_usd"])
            time_series[minute_key]["tokens_in"] += int(r.get("tokens_in", 0))
            time_series[minute_key]["tokens_out"] += int(r.get("tokens_out", 0))
        elif evt == "request_failed":
            time_series[minute_key]["errors"] += 1

    series_data = []
    for k in sorted(time_series.keys()):
        item = time_series[k]
        lats = item["latencies"]
        item["p95_latency"] = calculate_percentile(lats, 95) if lats else 0.0
        item["cost"] = round(item["cost"], 4)
        del item["latencies"]
        series_data.append(item)

    return {
        "summary": {
            "total_requests": total_received,
            "latency_p50": p50,
            "latency_p95": p95,
            "latency_p99": p99,
            "error_rate_pct": error_rate_pct,
            "total_cost_usd": total_cost_usd,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "total_tokens": tokens_in + tokens_out,
            "mean_quality": mean_quality,
        },
        "error_breakdown": error_breakdown,
        "time_series": series_data,
        "contract_thresholds": {
            "latency_p95_max": 3000,
            "error_rate_pct_max": 2.0,
            "cost_max": 2.50,
            "tokens_max": 50000,
            "quality_min": 0.75,
        },
    }
