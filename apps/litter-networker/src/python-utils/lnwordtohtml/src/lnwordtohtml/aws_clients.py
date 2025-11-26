"""AWS session helpers."""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from typing import Optional

import boto3

from .config import AwsConfig


@dataclass
class AwsContext:
    config: AwsConfig

    @cached_property
    def session(self):  # type: ignore[override]
        return boto3.Session(
            profile_name=self.config.profile,
            region_name=self.config.region,
        )

    @cached_property
    def s3(self):  # type: ignore[override]
        return self.session.client("s3")

    @cached_property
    def dynamodb(self):  # type: ignore[override]
        return self.session.resource("dynamodb")

    @cached_property
    def cloudfront(self):  # type: ignore[override]
        return self.session.client("cloudfront")


__all__ = ["AwsContext"]
