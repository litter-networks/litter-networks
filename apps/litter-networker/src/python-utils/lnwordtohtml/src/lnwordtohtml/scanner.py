"""Source directory scanning utilities."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List


@dataclass(frozen=True)
class SourceDocument:
    path: Path
    relative_path: Path


class SourceScanner:
    """Walks the OneDrive docs tree and finds DOCX files."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def scan(self) -> List[SourceDocument]:
        docs: List[SourceDocument] = []
        for path in self._iter_docx(self.root):
            docs.append(SourceDocument(path=path, relative_path=path.relative_to(self.root)))
        return docs

    def _iter_docx(self, root: Path) -> Iterable[Path]:
        for path in root.rglob("*.docx"):
            if path.name.startswith("~$"):
                # Word lock files
                continue
            yield path


__all__ = ["SourceScanner", "SourceDocument"]
