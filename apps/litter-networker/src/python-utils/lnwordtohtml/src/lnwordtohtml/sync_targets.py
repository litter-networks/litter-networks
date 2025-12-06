# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

"""S3 and DynamoDB sync stubs."""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Set

from .artifacts import ConvertedDocument
from .aws_clients import AwsContext
from .config import Config
from .hierarchy import build_hierarchy, serialize_child_pages

logger = logging.getLogger(__name__)


@dataclass
class S3Sync:
    config: Config
    aws: AwsContext
    dry_run: bool = True

    def sync_documents(self, documents: Iterable[ConvertedDocument]) -> None:
        documents = list(documents)
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
            if doc.css_bundle:
                css_key = f"docs/styles/{doc.css_bundle.name}.css"
                css_body = doc.css_bundle.to_text().encode("utf-8")
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


    def _html_key(self, relative_path: Path) -> str:
        html_path = relative_path.with_suffix(".html")
        return f"docs/{html_path.as_posix()}"


@dataclass
class DynamoSync:
    config: Config
    aws: AwsContext
    dry_run: bool = True

    def update_documents(self, documents: Iterable[ConvertedDocument]) -> None:
        hierarchy = build_hierarchy(documents)
        table = None if self.dry_run else self.aws.dynamodb.Table(self.config.aws.dynamodb_table)

        for unique_id, node in hierarchy.items():
            item = {
                "uniqueId": unique_id,
                "title": node.page_title or "",
                "description": node.page_description or "",
            }
            if node.child_pages:
                item["childPages"] = serialize_child_pages(node)
            if self.dry_run:
                logger.info("[dry-run] would upsert DDB item %s", unique_id)
                continue
            table.put_item(Item=item)
            logger.info("Updated DynamoDB item %s", unique_id)


@dataclass
class CloudfrontInvalidator:
    config: Config
    aws: AwsContext
    dry_run: bool = True

    def invalidate(self) -> None:
        targets = self.config.aws.get_cloudfront_targets()
        if not targets:
            logger.info("No CloudFront distribution configured; skipping invalidation.")
            return

        if self.dry_run:
            for target in targets:
                logger.info(
                    "[dry-run] would invalidate %s paths on distribution %s",
                    target.paths or ["/docs/*"],
                    target.distribution_id,
                )
            return

        invalidation_promises = []
        for target in targets:
            distribution_id = target.distribution_id
            paths = target.paths or ["/docs/*"]
            caller_reference = f"lnwordtohtml-{distribution_id}-{uuid.uuid4().hex[:8]}"
            logger.info(
                "Requesting invalidation %s for %s (paths %s)",
                caller_reference,
                distribution_id,
                paths,
            )
            response = self.aws.cloudfront.create_invalidation(
                DistributionId=distribution_id,
                InvalidationBatch={
                    "CallerReference": caller_reference,
                    "Paths": {"Quantity": len(paths), "Items": paths},
                },
            )
            invalidation_id = response["Invalidation"]["Id"]
            waiter = self.aws.cloudfront.get_waiter("invalidation_completed")
            invalidation_promises.append((distribution_id, invalidation_id, waiter))

        for distribution_id, invalidation_id, waiter in invalidation_promises:
            logger.info("Waiting for invalidation %s on %s to complete...", invalidation_id, distribution_id)
            waiter.wait(DistributionId=distribution_id, Id=invalidation_id)
            logger.info("CloudFront invalidation %s complete for %s", invalidation_id, distribution_id)


__all__ = ["S3Sync", "DynamoSync", "CloudfrontInvalidator"]
