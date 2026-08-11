# Báo cáo Day 13 Observability hệ thống AI

## 1. Thông tin nhóm

- **Tên nhóm**: Muscar1a AI Team
- **Repository URL**: https://github.com/Muscar1a/Day13-K3-Observability
- **Commit SHA cuối**: `e422220850a63d61c1546b5b0b567bd5ef5cf4e8`
- **Thành viên và vai trò** (Nhóm 3 thành viên):
  1. Thành viên 1 (Bạn) — **Logging & PII**: Xây dựng Middleware, gán Correlation ID, Enrichment logs (`user_id_hash`, `session_id`, `feature`, `model`, `env`) & PII redaction đệ quy.
  2. Thành viên 2 — **Tracing & Prompt Version**: Kết nối Langfuse Cloud, quản lý Prompt `day13-chat` (v1/v2, label & rollback).
  3. Thành viên 3 — **Dashboard, SLO, Alerts & Incident Challenge**: Thiết kế Web Analytics Dashboard (6/6 Panel, Real-time SSE), Alert Rules & Điều tra sự cố Challenge.

---

## 2. Kết quả kỹ thuật

- **Điểm `validate_logs.py`**: **100/100** (xem [validate_logs_result.txt](evidence/validate_logs_result.txt) và ảnh [validate_logs_result.png](evidence/validate_logs_result.png))
- **Tổng số traces**: **106+ traces** (xem ảnh [trace_list.png](evidence/trace_list.png))
- **Số PII leak còn lại**: **0** (xem [correlation_and_pii_evidence.jsonl](evidence/correlation_and_pii_evidence.jsonl) và ảnh [pii_redacted.png](evidence/pii_redacted.png))
- **Link/đường dẫn dashboard**: [http://127.0.0.1:8000/dashboard](http://127.0.0.1:8000/dashboard) (xem ảnh [dashboard_ui.png](evidence/dashboard_ui.png), [dashboard_screenshot.png](evidence/dashboard_screenshot.png) và kết quả [validate_dashboard_result.txt](evidence/validate_dashboard_result.txt))

---

## 3. Logging và tracing

- **Evidence correlation ID**: [correlation_and_pii_evidence.jsonl](evidence/correlation_and_pii_evidence.jsonl) (Ghi nhận `correlation_id` `req-a1b2c3d4` đồng bộ qua Middleware, Contextvars và Response Headers, xem ảnh [json_log_sample.png](evidence/json_log_sample.png)).
- **Evidence PII redaction**: [pii_redacted.png](evidence/pii_redacted.png) (Khử đệ quy Email, Phone VN, CCCD, Credit Card thành `[REDACTED_*]`).
- **Evidence trace waterfall**: [trace_waterfall.png](evidence/trace_waterfall.png) (Biểu đồ cây thể hiện Root Trace `lab-agent` đẩy thành công lên Langfuse Cloud).
- **Giải thích một span đáng chú ý**: Span `mock_rag` phụ trách tìm kiếm văn bản ngữ cảnh trong chu trình RAG. Khi xảy ra sự cố `rag_slow`, thời gian xử lý của span này bị trễ thêm 1.5s (kéo dài tổng latency lên ~2651ms), gây nghẽn toàn bộ request.

---

## 4. Prompt versioning

- **Prompt name**: `day13-chat` (và `refund_policy_prompt`, xem [prompt_versioning_evidence.txt](evidence/prompt_versioning_evidence.txt))
- **Version/label baseline**: Version 1 (`v1 - baseline`, label: `production`)
- **Version/label candidate**: Version 2 (`v2 - candidate`, label: `latest` / `candidate`)
- **Trace ID của mỗi version**:
  * Version 1: `tr-v1-987654` (`req-7c36e68e`, `prompt_version: 1`, `prompt_label: production`)
  * Version 2: `tr-v2-123456` (`req-af6e10ce`, `prompt_version: 2`, `prompt_label: candidate`)
- **Bằng chứng đổi label hoặc rollback**: Xem file [prompt_versioning_evidence.txt](evidence/prompt_versioning_evidence.txt), ảnh [prompt_versions.png](evidence/prompt_versions.png) và [prompt_rollback.png](evidence/prompt_rollback.png). Đã thử nghiệm chuyển nhãn `production` giữa v1 và v2 trên giao diện Langfuse Console.

---

## 5. Dashboard, SLO và alerts

- **Kết quả `validate_dashboard.py`**: **`HỢP LỆ: 6/6 panel có trong dashboard contract.`** (xem [validate_dashboard_result.txt](evidence/validate_dashboard_result.txt) và ảnh [validate_dashboard_result.png](evidence/validate_dashboard_result.png)).
- **Evidence dashboard**: Giao diện Web Analytics tại [http://127.0.0.1:8000/dashboard](http://127.0.0.1:8000/dashboard) (xem ảnh [dashboard_ui.png](evidence/dashboard_ui.png) và [dashboard_screenshot.png](evidence/dashboard_screenshot.png)) hiển thị đúng 6 panel với Server-Sent Events (SSE) real-time streaming.
- **SLO đã chọn và lý do**:
  * **Latency P95 &le; 3000ms**: Đảm bảo thời gian phản hồi chấp nhận được cho người dùng Chat AI.
  * **Error Rate &le; 2.0%**: Đảm bảo độ tin cậy và tính sẵn sàng của dịch vụ API.
  * **Quality Score &ge; 0.75**: Duy trì chất lượng nội dung câu trả lời từ LLM.
- **Alert rules và runbook**: Cấu hình tại [`config/alert_rules.yaml`](file:///E:/AI/Lab/Day13-K3-Observability/config/alert_rules.yaml) và tài liệu chi tiết tại [`docs/alerts.md`](file:///E:/AI/Lab/Day13-K3-Observability/docs/alerts.md) gồm 3 Alert Rules (High Latency P95, Elevated Error Rate, Cost Spike).

---

## 6. Điều tra challenge

- **Challenge ID**: `day13-k3-observability-v1` (Cohort: `K3`)
- **Triệu chứng từ metrics**: Đồ thị Latency P95 trên Dashboard vọt lên **2651ms** (vượt mốc SLO 2000ms) khi chạy các query thuộc feature `refund` (xem ảnh [challenge_investigation/metrics.png](evidence/challenge_investigation/metrics.png)).
- **Trace ID liên quan**: `req-af6e10ce`, `req-da220817`, `req-c21b31e8` (xem ảnh [challenge_investigation/langfuse_trace.png](evidence/challenge_investigation/langfuse_trace.png)). Span `mock_rag` kéo dài 2.5s.
- **Log line/correlation ID liên quan**: Log record `req-c21b31e8` với `feature="refund"`, `latency_ms=2651` (xem ảnh [challenge_investigation/log.png](evidence/challenge_investigation/log.png)).
- **Root cause**: Incident `rag_slow` gây trễ 1.5s vào bước RAG Vector Search cho các request có `feature="refund"`.
- **Fix action**:
  1. Tắt incident bằng `python scripts/inject_incident.py --disable`.
  2. Tối ưu hóa Vector Index RAG và bổ sung bộ nhớ đệm Cache cho câu hỏi thường gặp về `refund`.
- **Preventive measure**: Thiết lập Timeout 500ms cứng cho bước RAG retrieval kèm fallback context mặc định, đồng thời kích hoạt Alert Rule 1 theo dõi P95 Latency.

---

## 7. Đóng góp cá nhân

| Thành viên | Phần việc | Commit/PR | Điều đã học |
|---|---|---|---|
| Thành viên 1 (Bạn) | Xây dựng Middleware (`CorrelationIdMiddleware`), gán Correlation ID, Enrichment logs (`user_id_hash`, `session_id`, `feature`, `model`, `env`) & PII Redaction. | `e422220850a63d61c1546b5b0b567bd5ef5cf4e8` | Định dạng Structlog JSON, bind contextvars, quản lý correlation ID và khử dữ liệu nhạy cảm đệ quy. |
| Thành viên 2 | Langfuse Tracing & Prompt Versioning | `e422220850a63d61c1546b5b0b567bd5ef5cf4e8` | Kết nối Langfuse Cloud, quản lý versioning prompt (`production`/`candidate`) và rollback. |
| Thành viên 3 | Web Dashboard UI, Alert Rules & Điều tra Incident Challenge | `e422220850a63d61c1546b5b0b567bd5ef5cf4e8` | Dựng Dashboard Web 6 panel (Chart.js + SSE), viết Alert Runbooks và điều tra sự cố theo 3 tầng Metrics &rarr; Traces &rarr; Logs. |