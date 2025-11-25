"""High-level orchestration for lnwordtohtml."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .aws_clients import AwsContext
from .converter import DocxConverter
from .scanner import SourceScanner
from .sync_targets import CloudfrontInvalidator, DynamoSync, S3Sync
from .styles import StyleRegistry
from tqdm import tqdm

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Runner:
    config: Config
    source_dir: Path
    dry_run: bool = True
    dump_dir: Optional[Path] = None

    def run(self) -> None:
        logger.info("Starting lnwordtohtml sync", extra={"dry_run": self.dry_run})
        scanner = SourceScanner(root=self.source_dir)
        documents = scanner.scan()
        logger.info("Discovered %s DOCX files", len(documents))
        # Conversion + AWS sync are wired in later steps.
        if not documents:
            logger.warning("No DOCX files found under %s", self.source_dir)
            return

        registry = StyleRegistry()
        converter = DocxConverter(registry=registry)
        converted_docs = []
        for doc in tqdm(documents, desc="Converting", unit="doc"):
            converted_docs.append(converter.convert(doc.path, doc.relative_path))

        logger.info("Converted %s documents", len(converted_docs))

        if self.dump_dir:
            self._dump_artifacts(converted_docs)

        aws = AwsContext(config=self.config.aws)
        s3_sync = S3Sync(config=self.config, aws=aws, dry_run=self.dry_run)
        dynamo_sync = DynamoSync(config=self.config, aws=aws, dry_run=self.dry_run)
        invalidator = CloudfrontInvalidator(config=self.config, aws=aws, dry_run=self.dry_run)

        s3_sync.sync_documents(converted_docs)
        dynamo_sync.update_documents(converted_docs)
        if not self.dry_run:
            invalidator.invalidate()

        logger.info(
            "Dry run complete" if self.dry_run else "Sync complete",
        )

    def _dump_artifacts(self, documents):
        base = self.dump_dir
        if not base:
            return
        base.mkdir(parents=True, exist_ok=True)
        for doc in documents:
            html_path = base / doc.relative_path.with_suffix(".html")
            html_path.parent.mkdir(parents=True, exist_ok=True)
            html_path.write_text(doc.html, encoding="utf-8")
            for asset in doc.assets:
                local = self._asset_dump_path(base, asset.key)
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(asset.body)
            if doc.css_bundle:
                css_path = base / "styles" / f"{doc.css_bundle.name}.css"
                css_path.parent.mkdir(parents=True, exist_ok=True)
                css_path.write_text(doc.css_bundle.to_text(), encoding="utf-8")
        logger.info("Dumped HTML/assets to %s", base)

    def _asset_dump_path(self, base: Path, key: str) -> Path:
        if key.startswith("docs/images/"):
            rel = key[len("docs/images/") :]
            return base / "images" / rel
        return base / key


__all__ = ["Runner"]
