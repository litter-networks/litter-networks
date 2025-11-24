#!/usr/bin/env python3
"""Synchronise the built SPA assets with S3 and ensure metadata is correct."""

from __future__ import annotations

import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import boto3
from botocore.exceptions import ClientError

ALLOWED_EXTENSIONS = {
    ".css",
    ".gif",
    ".html",
    ".ico",
    ".jpg",
    ".jpeg",
    ".js",
    ".json",
    ".map",
    ".png",
    ".svg",
    ".txt",
    ".webmanifest",
    ".webp",
    ".woff",
    ".woff2",
}

BUCKET_NAME = os.environ.get("DEPLOY_BUCKET")
DISTRIBUTION_ID = os.environ.get("DISTRIBUTION_ID")
SOURCE_DIR = Path(os.environ.get("SOURCE_DIR", "./dist")).resolve()
ASSET_CACHE_CONTROL = os.environ.get("ASSET_CACHE_CONTROL", "public, max-age=3600, immutable")
HTML_CACHE_CONTROL = os.environ.get("HTML_CACHE_CONTROL", "public, max-age=60, must-revalidate")
CONTENT_DISPOSITION = os.environ.get("CONTENT_DISPOSITION", "inline")

if not BUCKET_NAME:
    print("DEPLOY_BUCKET environment variable is required.", file=sys.stderr)
    sys.exit(2)

if not SOURCE_DIR.exists():
    print(f"Source directory '{SOURCE_DIR}' does not exist. Run npm run build first.", file=sys.stderr)
    sys.exit(2)

s3_client = boto3.client("s3")
cloudfront_client = boto3.client("cloudfront") if DISTRIBUTION_ID else None

modified_paths: set[str] = set()
files_uploaded = False


def _cache_control_for_key(key: str) -> str:
    return HTML_CACHE_CONTROL if key.endswith(".html") else ASSET_CACHE_CONTROL


def _invalidate_path_for_key(key: str) -> Iterable[str]:
    if "/" in key:
        # Keep invalidations broad (folder-level) to avoid per-file limits while
        # still being narrow enough to avoid wiping the whole distribution.
        prefix = key.split("/", 1)[0]
        yield f"/{prefix}/*"
    else:
        yield f"/{key}"
        if key == "index.html":
            yield "/"


def _track_invalidation(key: str) -> None:
    for path in _invalidate_path_for_key(key):
        modified_paths.add(path)


def _allowed(file_path: Path) -> bool:
    return file_path.suffix.lower() in ALLOWED_EXTENSIONS


def _mime_type(file_path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return mime_type or "application/octet-stream"


def _should_upload(file_path: Path, key: str) -> bool:
    if not _allowed(file_path):
        return False

    try:
        response = s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
    except ClientError as exc:  # pragma: no cover - network failure
        if exc.response["Error"]["Code"] == "404":
            print(f"[sync] {key} missing from bucket, scheduling upload")
            return True
        print(f"[sync] error fetching metadata for {key}: {exc}")
        return False

    s3_last_modified = response["LastModified"]
    local_last_modified = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
    if local_last_modified > s3_last_modified:
        print(f"[sync] {key} older in bucket, scheduling upload")
        return True
    return False


def _upload(file_path: Path, key: str) -> None:
    global files_uploaded
    cache_control = _cache_control_for_key(key)
    try:
        with file_path.open("rb") as handle:
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=key,
                Body=handle,
                ContentType=_mime_type(file_path),
                CacheControl=cache_control,
                ContentDisposition=CONTENT_DISPOSITION,
            )
        print(f"[upload] {file_path} -> s3://{BUCKET_NAME}/{key}")
        files_uploaded = True
        _track_invalidation(key)
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[upload] failed for {file_path}: {exc}")


def _refresh_metadata(key: str) -> None:
    cache_control = _cache_control_for_key(key)
    try:
        response = s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
    except ClientError as exc:  # pragma: no cover - network failure
        if exc.response["Error"]["Code"] != "404":
            print(f"[metadata] unable to read {key}: {exc}")
        return

    expected_content_type = _mime_type(Path(key))
    current_cache_control = response.get("CacheControl")
    current_content_disposition = response.get("ContentDisposition")
    current_content_type = response.get("ContentType")

    if (
        current_cache_control == cache_control
        and current_content_disposition == CONTENT_DISPOSITION
        and current_content_type == expected_content_type
    ):
        return

    try:
        s3_client.copy_object(
            Bucket=BUCKET_NAME,
            CopySource={"Bucket": BUCKET_NAME, "Key": key},
            Key=key,
            CacheControl=cache_control,
            ContentDisposition=CONTENT_DISPOSITION,
            ContentType=expected_content_type,
            MetadataDirective="REPLACE",
        )
        print(f"[metadata] refreshed s3://{BUCKET_NAME}/{key}")
        _track_invalidation(key)
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[metadata] failed for {key}: {exc}")


def _sync_file(file_path: Path) -> None:
    key = str(file_path.relative_to(SOURCE_DIR)).replace("\\", "/")
    if _should_upload(file_path, key):
        _upload(file_path, key)
    else:
        _refresh_metadata(key)


def _all_files() -> list[Path]:
    return [path for path in SOURCE_DIR.rglob("*") if path.is_file() and _allowed(path)]


def _invalidate_cloudfront() -> None:
    if not cloudfront_client or not modified_paths:
        print("[cf] no invalidation required")
        return

    sorted_paths = sorted(modified_paths)
    print(f"[cf] invalidating {sorted_paths}")
    try:
        invalidation = cloudfront_client.create_invalidation(
            DistributionId=DISTRIBUTION_ID,
            InvalidationBatch={
                "Paths": {"Quantity": len(sorted_paths), "Items": sorted_paths},
                "CallerReference": f"lnweb-react-{datetime.utcnow().timestamp()}",
            },
        )
        invalidation_id = invalidation["Invalidation"]["Id"]
        waiter = cloudfront_client.get_waiter("invalidation_completed")
        waiter.wait(DistributionId=DISTRIBUTION_ID, Id=invalidation_id)
        print(f"[cf] invalidation {invalidation_id} completed")
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[cf] invalidation failed: {exc}")


def main() -> int:
    files = _all_files()
    if not files:
        print("[sync] no files to upload; ensure the dist directory is populated.")
        return 1

    with ThreadPoolExecutor(max_workers=min(32, len(files))) as executor:
        list(executor.map(_sync_file, files))

    _invalidate_cloudfront()

    result = "changed" if files_uploaded or modified_paths else "unchanged"
    print(f"SYNC_RESULT:{result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
