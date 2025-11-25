"""Dataclasses for converted outputs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class CssBundle:
    name: str
    rules: Dict[str, str]

    def to_text(self) -> str:
        return "\n".join(f".{klass} {{{decl}}}" for klass, decl in sorted(self.rules.items()))


@dataclass(frozen=True)
class AssetUpload:
    key: str
    body: bytes
    content_type: str


@dataclass(frozen=True)
class ConvertedDocument:
    source: Path
    relative_path: Path
    html: str
    title: str
    subtitle: str
    css_bundle: CssBundle
    assets: List[AssetUpload]


__all__ = ["ConvertedDocument", "CssBundle", "AssetUpload"]
