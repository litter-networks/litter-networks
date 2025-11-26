#!/usr/bin/env python3
"""Synchronise the built SPA assets with S3 and ensure metadata is correct."""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
import time
from urllib import request as urllib_request
from urllib.error import URLError
from urllib.parse import urljoin, urlparse

import boto3
from botocore.exceptions import ClientError, WaiterError

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
BUILD_INFO_JSON = os.environ.get("BUILD_INFO_JSON")
SMOKE_TEST_URL = os.environ.get("SMOKE_TEST_URL")
ACCESS_CONTROL_ALLOW_ORIGIN = os.environ.get("ACCESS_CONTROL_ALLOW_ORIGIN", "*")

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
aws_errors_detected = False


def _mark_error() -> None:
    global aws_errors_detected
    aws_errors_detected = True


def _cache_control_for_key(key: str) -> str:
    return HTML_CACHE_CONTROL if key.endswith(".html") else ASSET_CACHE_CONTROL


def _expected_metadata() -> dict[str, str]:
    metadata: dict[str, str] = {}
    if ACCESS_CONTROL_ALLOW_ORIGIN:
        metadata["access-control-allow-origin"] = ACCESS_CONTROL_ALLOW_ORIGIN
    return metadata


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
        _mark_error()
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
    metadata = _expected_metadata()
    try:
        with file_path.open("rb") as handle:
            put_kwargs = dict(
                Bucket=BUCKET_NAME,
                Key=key,
                Body=handle,
                ContentType=_mime_type(file_path),
                CacheControl=cache_control,
                ContentDisposition=CONTENT_DISPOSITION,
            )
            if metadata:
                put_kwargs["Metadata"] = metadata
            s3_client.put_object(**put_kwargs)
        print(f"[upload] {file_path} -> s3://{BUCKET_NAME}/{key}")
        files_uploaded = True
        _track_invalidation(key)
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[upload] failed for {file_path}: {exc}")
        _mark_error()


def _refresh_metadata(key: str) -> None:
    cache_control = _cache_control_for_key(key)
    metadata = _expected_metadata()
    try:
        response = s3_client.head_object(Bucket=BUCKET_NAME, Key=key)
    except ClientError as exc:  # pragma: no cover - network failure
        if exc.response["Error"]["Code"] != "404":
            print(f"[metadata] unable to read {key}: {exc}")
            _mark_error()
        return

    expected_content_type = _mime_type(Path(key))
    current_cache_control = response.get("CacheControl")
    current_content_disposition = response.get("ContentDisposition")
    current_content_type = response.get("ContentType")
    current_metadata = response.get("Metadata", {})
    metadata_matches = all(current_metadata.get(k) == v for k, v in metadata.items())

    if (
        current_cache_control == cache_control
        and current_content_disposition == CONTENT_DISPOSITION
        and current_content_type == expected_content_type
        and metadata_matches
    ):
        return

    try:
        copy_kwargs = dict(
            Bucket=BUCKET_NAME,
            CopySource={"Bucket": BUCKET_NAME, "Key": key},
            Key=key,
            CacheControl=cache_control,
            ContentDisposition=CONTENT_DISPOSITION,
            ContentType=expected_content_type,
            MetadataDirective="REPLACE",
        )
        if metadata:
            copy_kwargs["Metadata"] = metadata
        s3_client.copy_object(**copy_kwargs)
        print(f"[metadata] refreshed s3://{BUCKET_NAME}/{key}")
        _track_invalidation(key)
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[metadata] failed for {key}: {exc}")
        _mark_error()


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
                "CallerReference": f"lnweb-react-{datetime.now(timezone.utc).timestamp()}",
            },
        )
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[cf] invalidation failed: {exc}")
        _mark_error()
        return

    invalidation_id = invalidation["Invalidation"]["Id"]
    waiter = cloudfront_client.get_waiter("invalidation_completed")
    try:
        waiter.wait(
            DistributionId=DISTRIBUTION_ID,
            Id=invalidation_id,
            WaiterConfig={"Delay": 10, "MaxAttempts": 30},
        )
        print(f"[cf] invalidation {invalidation_id} completed")
    except WaiterError as exc:
        print(f"[cf] invalidation {invalidation_id} did not complete within the configured wait: {exc}")
        _mark_error()
    except ClientError as exc:  # pragma: no cover - network failure
        print(f"[cf] invalidation wait failed: {exc}")
        _mark_error()


def upload_build_info() -> None:
    if not BUILD_INFO_JSON:
        return
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key="build-info.json",
            Body=BUILD_INFO_JSON.encode("utf-8"),
            ContentType="application/json",
            CacheControl="public, max-age=60, must-revalidate",
            ContentDisposition="inline",
        )
        print(f"[upload] build info -> s3://{BUCKET_NAME}/build-info.json")
        _track_invalidation("build-info.json")
    except ClientError as exc:
        print(f"[upload] failed for build info: {exc}")
        _mark_error()


def fetch_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError(f"Only http(s) schemes are allowed for smoke-test URLs; got {url}")
    response = urllib_request.urlopen(url, timeout=30)
    charset = response.headers.get_content_charset() or "utf-8"
    body = response.read().decode(charset, errors="ignore")
    return body


def verify_spa_shell():
    if not SMOKE_TEST_URL:
        print("[smoke] skipping SPA shell check (no SMOKE_TEST_URL provided).")
        return
    print(f"[smoke] Verifying SPA shell at {SMOKE_TEST_URL}...")
    marker = 'x-ln-app" content="lnweb-react-spa"'
    for attempt in range(3):
        try:
            body = fetch_url(SMOKE_TEST_URL)
        except URLError as exc:
            if attempt == 2:
                raise RuntimeError(f"Failed to fetch {SMOKE_TEST_URL}: {exc}") from exc
            time.sleep(5)
            continue
        if marker in body:
            print("[smoke] SPA shell marker found. \033[32mOK\033[0m")
            return
        time.sleep(5)
    raise RuntimeError(f"SPA marker not found in {SMOKE_TEST_URL}")


def verify_build_info():
    if not (SMOKE_TEST_URL and BUILD_INFO_JSON):
        print("[smoke] Skipping build-info check (missing SMOKE_TEST_URL or BUILD_INFO_JSON).")
        return
    expected = json.loads(BUILD_INFO_JSON)
    info_url = urljoin(SMOKE_TEST_URL.rstrip("/") + "/", "build-info.json")
    print(f"[smoke] Verifying build info at {info_url}...")
    try:
        body = fetch_url(info_url)
        actual = json.loads(body)
    except URLError as exc:
        raise RuntimeError(f"Failed to fetch {info_url}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON returned from {info_url}: {exc}") from exc

    if actual != expected:
        raise RuntimeError(f"Build info mismatch.\nExpected: {expected}\nActual:   {actual}")
    print("[smoke] Build info matches latest upload. \033[32mOK\033[0m")


def run_smoke_tests():
    print("\nSmoke tests --------------")
    if not SMOKE_TEST_URL:
        print("[smoke] Skipping smoke tests (SMOKE_TEST_URL not set).")
        return
    try:
        verify_spa_shell()
    except RuntimeError as exc:
        print(f"[smoke] SPA shell check failed. \033[31mFAIL\033[0m\n{exc}")
        raise
    try:
        verify_build_info()
    except RuntimeError as exc:
        print(f"[smoke] Build info check failed. \033[31mFAIL\033[0m\n{exc}")
        raise


def main() -> int:
    files = _all_files()
    if not files:
        print("[sync] no files to upload; ensure the dist directory is populated.")
        return 1

    with ThreadPoolExecutor(max_workers=min(32, len(files))) as executor:
        list(executor.map(_sync_file, files))

    upload_build_info()
    _invalidate_cloudfront()

    result = "changed" if files_uploaded or modified_paths else "unchanged"
    print(f"SYNC_RESULT:{result}")
    run_smoke_tests()
    if aws_errors_detected:
        print("[sync] Completed with AWS errors; see log output for details.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
