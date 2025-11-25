"""S3 and DynamoDB sync stubs."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Set

from .artifacts import ConvertedDocument, CssBundle
from .aws_clients import AwsContext
from .config import Config

logger = logging.getLogger(__name__)


@dataclass
class S3Sync:
    config: Config
    aws: AwsContext
    dry_run: bool = True

    def sync_documents(self, documents: Iterable[ConvertedDocument], css: Optional[CssBundle]) -> None:
        uploaded_assets: Set[str] = set()
        for doc in documents:
            for asset in doc.assets:
                if asset.key in uploaded_assets:
                    continue
                if self.dry_run:
                    logger.info("[dry-run] would upload asset %s (%s bytes)", asset.key, len(asset.body))
                else:
                    self.aws.s3.put_object(
                        Bucket=self.config.aws.s3_bucket,
                        Key=asset.key,
                        Body=asset.body,
                        ContentType=asset.content_type,
                        CacheControl="public, max-age=3600, immutable",
                        ContentDisposition="inline",
                    )
                    logger.info("Uploaded %s", asset.key)
                uploaded_assets.add(asset.key)

        for doc in documents:
            key = self._html_key(doc.relative_path)
            if self.dry_run:
                logger.info("[dry-run] would upload %s (%s bytes)", key, len(doc.html))
                continue
            self.aws.s3.put_object(
                Bucket=self.config.aws.s3_bucket,
                Key=key,
                Body=doc.html.encode("utf-8"),
                ContentType="text/html; charset=utf-8",
                CacheControl="public, max-age=3600, immutable",
                ContentDisposition="inline",
            )
            logger.info("Uploaded %s", key)

        if css:
            css_key = f"docs/assets/{css.name}.css"
            css_body = css.to_text().encode("utf-8")
            if self.dry_run:
                logger.info("[dry-run] would upload CSS %s", css_key)
            else:
                self.aws.s3.put_object(
                    Bucket=self.config.aws.s3_bucket,
                    Key=css_key,
                    Body=css_body,
                    ContentType="text/css; charset=utf-8",
                    CacheControl="public, max-age=3600, immutable",
                )
                logger.info("Uploaded %s", css_key)

    def _html_key(self, relative_path: Path) -> str:
        html_path = relative_path.with_suffix(".html")
        return f"docs/{html_path.as_posix()}"


@dataclass
class DynamoSync:
    config: Config
    aws: AwsContext
    dry_run: bool = True

    def update_documents(self, documents: Iterable[ConvertedDocument]) -> None:
        table = None if self.dry_run else self.aws.dynamodb.Table(self.config.aws.dynamodb_table)

        for doc in documents:
            item = {
                "uniqueId": f"docs/{doc.relative_path.with_suffix('').as_posix()}",
                "title": doc.title or "",
                "description": doc.subtitle or "",
            }
            if self.dry_run:
                logger.info("[dry-run] would upsert DDB item %s", item["uniqueId"])
                continue
            table.put_item(Item=item)
            logger.info("Updated DynamoDB item %s", item["uniqueId"])


__all__ = ["S3Sync", "DynamoSync"]
