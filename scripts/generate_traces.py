import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from app.agent import LabAgent
from app.tracing import get_langfuse_client, tracing_enabled


def main() -> None:
    print("=== Langfuse Trace Generator ===")
    if not tracing_enabled():
        print("ERROR: Tracing is disabled! Check LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env")
        sys.exit(1)

    host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    prompt_name = os.getenv("LANGFUSE_PROMPT_NAME", "day13-chat")
    prompt_label = os.getenv("LANGFUSE_PROMPT_LABEL", "production")

    print(f"Connecting to Host: {host}")
    print(f"Prompt Name:       {prompt_name}")
    print(f"Prompt Label:      {prompt_label}")

    client = get_langfuse_client()
    agent = LabAgent()

    test_messages = [
        "What is your refund policy? My email is test@example.com",
        "Explain why metrics traces and logs work together",
        "Summarize the monitoring policy for production logging",
        "Can I get help with policy and monitoring?",
        "Here is my phone 0901234567, what should be logged?",
        "Give me a short summary of the observability workflow",
        "What should not appear in app logs?",
        "How do I debug tail latency?",
        "What is the policy for PII and credit card 4111-2222-3333-4444?",
        "How should alerts be designed?",
    ]

    print(f"\nSending {len(test_messages)} requests and generating traces...")
    for i, msg in enumerate(test_messages, 1):
        result = agent.run(
            user_id=f"student-{i:02d}",
            feature="qa" if i % 2 == 1 else "summary",
            session_id=f"session-{i:02d}",
            message=msg,
        )
        print(f"[{i:02d}/{len(test_messages)}] Answered in {result.latency_ms}ms (tokens: {result.tokens_in}/{result.tokens_out})")

    print("\nFlushing traces to Langfuse Cloud...")
    if hasattr(client, "flush"):
        client.flush()
    print("SUCCESS: 10 traces flushed to Langfuse Cloud!")
    print("Open https://cloud.langfuse.com -> Traces tab to view your traces.")


if __name__ == "__main__":
    main()
