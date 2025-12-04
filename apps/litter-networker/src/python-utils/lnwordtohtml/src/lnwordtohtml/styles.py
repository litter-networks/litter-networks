# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

"""CSS registry helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class StyleRegistry:
    _rules: Dict[str, str] = field(default_factory=dict)

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
        return klass

    def shell_class(self) -> str:
        return "ln-shell"

    def rules(self) -> Dict[str, str]:
        return dict(self._rules)


__all__ = ["StyleRegistry"]
