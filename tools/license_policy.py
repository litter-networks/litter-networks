# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import pathlib
import subprocess
from typing import Iterable, Iterator, List, Sequence, Set

TARGET_LICENSE_LINES: Sequence[str] = (
    "Copyright Clean and Green Communities CIC / Litter Networks",
    "SPDX-License-Identifier: Apache-2.0",
)

COMMENT_STYLES: dict[str, str] = {
    ".ts": "// ",
    ".tsx": "// ",
    ".js": "// ",
    ".jsx": "// ",
    ".mjs": "// ",
    ".cjs": "// ",
    ".py": "# ",
    ".sh": "# ",
    ".bash": "# ",
    ".zsh": "# ",
    ".ps1": "# ",
}

COMMENT_PREFIXES: list[str] = ["//", "#", "/*", "*", "<!--", "--"]

SKIP_PATH_PREFIXES: tuple[str, ...] = ("web/lnweb-react/public/3rd-party",)


def repo_root() -> pathlib.Path:
    """Return the Git repo root for the current working tree."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )
    return pathlib.Path(result.stdout.strip())


def _git_list_files(root: pathlib.Path) -> list[pathlib.Path]:
    result = subprocess.run(
        ["git", "ls-files"],
        check=True,
        capture_output=True,
        text=True,
        cwd=root,
    )
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return [root / pathlib.Path(line) for line in lines]


def iter_source_files(root: pathlib.Path) -> Iterator[pathlib.Path]:
    """Iterate all tracked source files that should have the license header."""
    for path in _git_list_files(root):
        suffix = path.suffix.lower()
        if suffix in COMMENT_STYLES and not _should_skip_path(path, root):
            yield path


def _should_skip_path(path: pathlib.Path, root: pathlib.Path) -> bool:
    relative = path.relative_to(root).as_posix()
    return any(relative.startswith(prefix) for prefix in SKIP_PATH_PREFIXES)


def _read_first_lines(path: pathlib.Path, limit: int = 16) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    return lines[:limit]


def _normalize_line(line: str) -> str:
    trimmed = line.lstrip()
    for prefix in COMMENT_PREFIXES:
        if trimmed.startswith(prefix):
            trimmed = trimmed[len(prefix) :].lstrip()
            break
    if trimmed.endswith("*/"):
        trimmed = trimmed[:-2].rstrip()
    if trimmed.endswith("-->"):
        trimmed = trimmed[:-3].rstrip()
    return trimmed


def find_license_lines(path: pathlib.Path) -> list[str]:
    lines = _read_first_lines(path)
    start_index = 0
    if lines and lines[0].startswith("#!"):
        start_index = 1
    found: list[str] = []
    for line in lines[start_index:]:
        normalized = _normalize_line(line)
        if not normalized:
            continue
        found.append(normalized)
        if len(found) == len(TARGET_LICENSE_LINES):
            break
    return found


def has_license_header(path: pathlib.Path) -> bool:
    return find_license_lines(path) == list(TARGET_LICENSE_LINES)


def comment_prefix_for_path(path: pathlib.Path) -> str | None:
    return COMMENT_STYLES.get(path.suffix.lower())


def add_license_header(path: pathlib.Path) -> None:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    has_shebang = bool(lines and lines[0].startswith("#!"))
    start_idx = 1 if has_shebang else 0
    rest = lines[start_idx:]
    prefix = comment_prefix_for_path(path)
    if prefix is None:
        raise RuntimeError(f"Unsupported file extension for {path}")
    header_lines = [f"{prefix}{line}" for line in TARGET_LICENSE_LINES]
    new_lines: list[str] = []
    if has_shebang:
        new_lines.append(lines[0])
    new_lines.extend(header_lines)
    new_lines.append("")
    new_lines.extend(rest)
    output = "\n".join(new_lines).rstrip("\n") + "\n"
    path.write_text(output, encoding="utf-8")


def supported_extensions() -> Set[str]:
    return set(COMMENT_STYLES.keys())
