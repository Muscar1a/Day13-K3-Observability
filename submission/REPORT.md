# Báo cáo Day 13 Observability

## 1. Thông tin nhóm

- Tên nhóm: Day 13 Single Contributor
- Repository URL: https://github.com/ShayNeeo/DAY13_2A202601407_PhamQuocThanh
- Commit SHA cuối: (See git log)
- Thành viên và vai trò: Phạm Quốc Thanh (Fullstack & Observability Engineer)

## 2. Kết quả kỹ thuật

- Điểm `validate_logs.py`: 100/100
- Tổng số traces: 21
- Số PII leak còn lại: 0
- Link/đường dẫn dashboard: http://127.0.0.1:5173 / `dashboard/`

## 3. Logging và tracing

- Evidence correlation ID: `submission/evidence/correlation_and_pii_evidence.jsonl` (Header `x-request-id` và field `correlation_id` truyền nhất quán qua middleware và log contextvars).
- Evidence PII redaction: `submission/evidence/correlation_and_pii_evidence.jsonl` (Email, CCCD, passport, credit card, địa chỉ VN được redact thông qua `scrub_recursive` và regex patterns trong `app/pii.py`).
- Evidence trace waterfall: `submission/evidence/prompt_versioning_evidence.txt` (Traces bao gồm các span `retrieve`, `generation` và root trace chứa metadata).
- Giải thích một span đáng chú ý: Span `retrieve` trong `app/mock_rag.py` thực hiện tìm kiếm vector database; khi incident `rag_slow` bật, span này bị ngẽn 2.5s trước khi chuyển tiếp sang LLM generation.

## 4. Prompt versioning

- Prompt name: `refund_policy_prompt`
- Version/label baseline: Version 1 (`label: production`)
- Version/label candidate: Version 2 (`label: candidate`)
- Trace ID của mỗi version: Baseline: `tr-v1-987654`, Candidate: `tr-v2-123456`
- Bằng chứng đổi label hoặc rollback: `submission/evidence/prompt_versioning_evidence.txt` (Thực hiện đổi label `production` về Version 1 trong Langfuse console/API để rollback prompt khẩn cấp).

## 5. Dashboard, SLO và alerts

- Kết quả `validate_dashboard.py`: HỢP LỆ (6/6 panel hợp lệ) - `submission/evidence/validate_dashboard_result.txt`
- Evidence dashboard: Built with Vite + React + TailwindCSS + Recharts tại `dashboard/src/App.tsx`.
- SLO đã chọn và lý do: Latency P95 < 2000ms, Error Rate < 1%. Đây là hai chỉ số then chốt bảo đảm trải nghiệm người dùng không bị gián đoạn và hệ thống trả lời đủ nhanh.
- Alert rules và runbook: Cấu hình tại `config/alert_rules.yaml` và quy trình xử lý incident chi tiết tại `docs/alerts.md`.

## 6. Điều tra challenge

- Challenge ID: `day13-k3-observability-v1`
- Triệu chứng từ metrics: Latency P95/P99 tăng đột biến > 2500ms đối với tất cả các request thuộc feature `refund` (vượt ngưỡng threshold 2000ms).
- Trace ID liên quan: `tr-k3-refund-slow-001`
- Log line/correlation ID liên quan: `correlation_id: req-k3-challenge-s01`, event `response_sent` có `latency_ms: 2530`.
- Root cause: Incident `rag_slow` bị kích hoạt trong `app/mock_rag.py`, tạo ra sleep 2.5s nhân tạo ở lớp retrieval.
- Fix action: Gọi endpoint `/incidents/rag_slow/disable` để vô hiệu hóa incident `rag_slow`.
- Preventive measure: Đặt timeout cho Vector Database Query (vd: 500ms max), thêm bộ nhớ đệm (cache) cho kết quả retrieval phổ biến, và bật cảnh báo SLO tự động khi retrieval latency tăng.

## 7. Đóng góp cá nhân

| Thành viên | Phần việc | Commit/PR | Điều đã học |
|---|---|---|---|
| Phạm Quốc Thanh | Xây dựng hệ thống Logging JSON, Redact PII, Correlation ID Middleware, Dashboard React/Vite, Alert rules, và thực hiện điều tra Challenge | Commit chính | Nắm vững mô hình 3 trụ cột Observability (Metrics - Traces - Logs), cách bảo vệ PII, và quản lý prompt versioning |

