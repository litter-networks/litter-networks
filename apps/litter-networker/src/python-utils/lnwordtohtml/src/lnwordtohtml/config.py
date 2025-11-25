"""Configuration helpers for lnwordtohtml."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


@dataclass(slots=True)
class AwsConfig:
    profile: Optional[str] = "ln"
    region: Optional[str] = None
    s3_bucket: str = "lnweb-docs"
    dynamodb_table: str = "LN-Knowledge"
    cloudfront_distribution_id: Optional[str] = "E38XGOGM7XNRC5"


@dataclass(slots=True)
class PathsConfig:
    source_root: Path = Path("one-drive/Core Team Shared/Litter Networks/_web_docs")
    build_root: Path = Path(".lnwordtohtml-build")


@dataclass(slots=True)
class Config:
    aws: AwsConfig = field(default_factory=AwsConfig)
    paths: PathsConfig = field(default_factory=PathsConfig)

    @classmethod
    def from_file(cls, path: Path) -> "Config":
        data = yaml.safe_load(path.read_text()) if path.exists() else {}
        aws = AwsConfig(**data.get("aws", {}))
        defaults = PathsConfig()
        paths_data = data.get("paths", {})
        paths = PathsConfig(
            source_root=Path(paths_data.get("source_root", defaults.source_root)),
            build_root=Path(paths_data.get("build_root", defaults.build_root)),
        )
        return cls(aws=aws, paths=paths)


__all__ = ["Config", "resolve_path"]
def resolve_path(path: Path) -> Path:
    """Resolve repo-relative paths, honoring LN_REPO_ROOT if provided."""
    if path.is_absolute():
        return path
    env_root = os.getenv("LN_REPO_ROOT")
    base = Path(env_root).expanduser() if env_root else Path.cwd()
    return (base / path).resolve()
