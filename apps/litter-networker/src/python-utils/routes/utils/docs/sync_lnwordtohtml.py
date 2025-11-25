#!/usr/bin/env python3
"""Helper script to run the lnwordtohtml sync inside python-utils."""

from __future__ import annotations

import argparse
from pathlib import Path

from lnwordtohtml.config import Config, resolve_path
from lnwordtohtml.runner import Runner


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sync LN knowledge docs to S3/DynamoDB.")
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Optional YAML config overriding defaults.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Root folder containing DOCX sources (defaults to config.paths.source_root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log planned uploads without pushing to AWS.",
    )
    parser.add_argument(
        "--no-dry-run",
        dest="dry_run",
        action="store_false",
        help="Perform real uploads.",
    )
    parser.set_defaults(dry_run=False)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    config = Config.from_file(args.config) if args.config else Config()
    source_root = resolve_path(args.source or config.paths.source_root)
    runner = Runner(
        config=config,
        source_dir=source_root.expanduser().resolve(),
        dry_run=args.dry_run,
    )
    runner.run()


if __name__ == "__main__":
    main()
