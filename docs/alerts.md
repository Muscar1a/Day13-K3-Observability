# Alert Rules và Runbook Observability

Mỗi alert dựa trên triệu chứng người dùng và vi phạm cam kết SLO (Service Level Objective).

## Alert 1: High Latency P95 Degradation

- **Tên**: High Latency P95 Degradation
- **Severity**: P1 - Critical
- **SLI/SLO liên quan**: Latency P95 &le; 3000ms (cửa sổ 60 phút)
- **Điều kiện và thời gian duy trì**: P95 latency > 3000ms duy trì liên tục trong 5 phút
- **Ảnh hưởng tới người dùng**: Người dùng phản hồi hệ thống phản hồi cực kỳ chậm, trải nghiệm nhắn tin hỏi đáp AI bị gián đoạn.
- **Ba bước kiểm tra đầu tiên**:
  1. Mở Panel 1 (Latency Percentiles) trên Dashboard xem P50, P95, P99 tăng đồng loạt hay chỉ bị spike ở P95/P99.
  2. Mở Langfuse Traces, tìm span kéo dài bất thường (ví dụ: `mock_rag` retrieval hay `mock_llm` generation span).
  3. Trích xuất `correlation_id` từ trace bị chậm, lọc log trong `data/logs.jsonl` để kiểm tra chi tiết request context.
- **Mitigation tạm thời**: Kích hoạt fallback retrieval hoặc tạm thời giảm độ dài ngữ cảnh prompt.
- **Owner**: Platform / On-call Engineer

## Alert 2: Elevated API Error Rate

- **Tên**: Elevated API Error Rate
- **Severity**: P1 - Critical
- **SLI/SLO liên quan**: Error Rate &le; 2.0%
- **Điều kiện và thời gian duy trì**: Tỷ lệ request lỗi (`request_failed` / `request_received`) > 2.0% trong 3 phút
- **Ảnh hưởng tới người dùng**: Người dùng gặp thông báo lỗi HTTP 500 khi sử dụng tính năng Chat AI.
- **Ba bước kiểm tra đầu tiên**:
  1. Xem Panel 3 (Error Rate & Breakdown) trên Dashboard để xác định phân rã `error_type` gây ra lỗi chính.
  2. Tìm các log record có `event="request_failed"`, đọc `correlation_id` và `payload.detail` để xem chi tiết ngoại lệ.
  3. Mở Langfuse Trace xem span nào bị ném exception hoặc dừng đột ngột.
- **Mitigation tạm thời**: Tắt bớt incident hoặc switch sang model/prompt dự phòng an toàn.
- **Owner**: AI Agent / Backend Team

## Alert 3: Unexpected LLM Cost Spike

- **Tên**: Unexpected LLM Cost Spike
- **Severity**: P2 - Warning
- **SLI/SLO liên quan**: Total Cost &le; $2.50 / cửa sổ 60 phút
- **Điều kiện và thời gian duy trì**: Tổng chi phí vượt quá $2.50 trong cửa sổ 60 phút
- **Ảnh hưởng tới người dùng**: Không ảnh hưởng trực tiếp tới giao diện nhưng rủi ro vượt ngân sách vận hành API.
- **Ba bước kiểm tra đầu tiên**:
  1. Xem Panel 4 (Cost) và Panel 5 (Tokens) trên Dashboard để phân tích `tokens_in` hay `tokens_out` tăng bất thường.
  2. Lọc log `response_sent` có `cost_usd` cao nhất, xem `user_id_hash` và `feature` tương ứng.
  3. Mở trace metadata kiểm tra prompt version hiện tại có bị phình đại độ dài ngữ cảnh hay lặp lặp từ ngữ hay không.
- **Mitigation tạm thời**: Áp dụng giới hạn `max_tokens` ngắn hơn hoặc rollback prompt về phiên bản chuẩn (`baseline`).
- **Owner**: FinOps / Tech Lead
