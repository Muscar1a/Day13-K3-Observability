from __future__ import annotations

import random
import time
from dataclasses import dataclass

from .incidents import STATE


@dataclass
class FakeUsage:
    input_tokens: int
    output_tokens: int


@dataclass
class FakeResponse:
    text: str
    usage: FakeUsage
    model: str


class FakeLLM:
    def __init__(self, model: str = "claude-sonnet-4-5") -> None:
        self.model = model

    def generate(self, prompt: str) -> FakeResponse:
        if STATE.get("llm_degraded", False):
            delay = max(0.4, random.gauss(0.8, 0.2))
            time.sleep(delay)
            if random.random() < 0.10:
                raise RuntimeError("LLM Provider Timeout")
        else:
            delay = max(0.05, random.gauss(0.12, 0.03))
            time.sleep(delay)

        input_tokens = max(20, int(len(prompt) // 4 + random.gauss(10, 3)))
        output_tokens = max(30, int(random.gauss(120, 25)))
        if STATE.get("cost_spike", False):
            output_tokens *= 4

        answer = (
            "Starter answer. Teams should improve this output logic and add better quality checks. "
            "Use retrieved context and keep responses concise."
        )
        return FakeResponse(text=answer, usage=FakeUsage(input_tokens, output_tokens), model=self.model)

