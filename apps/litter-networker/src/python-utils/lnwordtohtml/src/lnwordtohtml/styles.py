"""CSS registry helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class StyleRegistry:
    _rules: Dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.ensure_class("ln-shell", "max-width:700px;margin:0 auto;padding:0 1rem;")
        self.ensure_class("ln-align-justify", "text-align:justify;")
        self.ensure_class("ln-align-left", "text-align:left;")
        self.ensure_class("ln-align-right", "text-align:right;")
        self.ensure_class("ln-align-center", "text-align:center;")

    def ensure_class(self, name: str, declaration: str) -> str:
        self._rules.setdefault(name, declaration)
        return name

    def alignment_class(self, alignment: str | None) -> str:
        mapping = {
            "center": "ln-align-center",
            "right": "ln-align-right",
            "left": "ln-align-left",
            "justify": "ln-align-justify",
        }
        key = (alignment or "justify").lower()
        klass = mapping.get(key, "ln-align-justify")
        return self.ensure_class(klass, self._rules[klass])

    def shell_class(self) -> str:
        return "ln-shell"

    def rules(self) -> Dict[str, str]:
        return dict(self._rules)


__all__ = ["StyleRegistry"]
