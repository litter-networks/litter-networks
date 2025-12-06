# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

"""Configuration helpers for lnwordtohtml."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import yaml


@dataclass(slots=True)
class CloudfrontTarget:
    distribution_id: str
    paths: List[str] = field(default_factory=lambda: ["/docs/*"])


@dataclass(slots=True)
class AwsConfig:
    profile: Optional[str] = "ln"
    region: Optional[str] = None
    s3_bucket: str = "lnweb-docs"
    dynamodb_table: str = "LN-Knowledge"
    cloudfront_distribution_id: Optional[str] = "E38XGOGM7XNRC5"
    cloudfront_targets: Optional[List[CloudfrontTarget]] = None

    def get_cloudfront_targets(self) -> List[CloudfrontTarget]:
        if self.cloudfront_targets:
            return self.cloudfront_targets
        return _default_targets(self)


def _default_targets(aws_config: AwsConfig) -> List[CloudfrontTarget]:
    targets: List[CloudfrontTarget] = [
        CloudfrontTarget("EWXIG6ZADYHMA", paths=["/docs/*"])
    ]
    if aws_config.cloudfront_distribution_id:
        targets.append(
            CloudfrontTarget(
                aws_config.cloudfront_distribution_id,
                paths=["/api/knowledge/*"],
            )
        )
    return targets

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
        aws_data = data.get("aws", {}) or {}
        targets_data = aws_data.pop("cloudfront_targets", None)
        aws = AwsConfig(**aws_data)
        if targets_data:
            aws.cloudfront_targets = [
                CloudfrontTarget(**target) for target in targets_data
            ]
        defaults = PathsConfig()
        paths_data = data.get("paths", {})
        paths = PathsConfig(
            source_root=Path(paths_data.get("source_root", defaults.source_root)),
            build_root=Path(paths_data.get("build_root", defaults.build_root)),
        )
        return cls(aws=aws, paths=paths)


__all__ = ["Config", "CloudfrontTarget", "resolve_path"]
def resolve_path(path: Path) -> Path:
    """Resolve repo-relative paths, honoring LN_REPO_ROOT if provided."""
    if path.is_absolute():
        return path
    env_root = os.getenv("LN_REPO_ROOT")
    base = Path(env_root).expanduser() if env_root else Path.cwd()
    return (base / path).resolve()
