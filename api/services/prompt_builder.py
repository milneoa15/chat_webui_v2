"""Prompt builder pipeline utilities."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Sequence

from ..models import MessageRole


@dataclass(slots=True)
class PromptFragment:
    """Represents a single chunk contributing to the prompt."""

    role: MessageRole
    content: str
    source: str = "base"
    priority: int = 100
    metadata: dict[str, str] = field(default_factory=dict)


class PromptBuilder:
    """Builds ordered prompts from core messages + plugin fragments."""

    def build(
        self,
        base_messages: Sequence[PromptFragment],
        plugin_fragments: Iterable[PromptFragment] | None = None,
    ) -> list[PromptFragment]:
        prompt: list[PromptFragment] = list(base_messages)
        if plugin_fragments:
            plugin_sorted = sorted(
                plugin_fragments, key=lambda fragment: (fragment.priority, fragment.source)
            )
            prompt.extend(plugin_sorted)
        return prompt

    @staticmethod
    def serialize(fragments: Sequence[PromptFragment]) -> list[dict[str, str]]:
        """Convert prompt fragments to ChatML-like dictionaries."""
        serialized: list[dict[str, str]] = []
        for fragment in fragments:
            role = fragment.role.value if isinstance(fragment.role, Enum) else fragment.role
            serialized.append({"role": str(role), "content": fragment.content})
        return serialized
