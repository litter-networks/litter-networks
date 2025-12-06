#!/usr/bin/env python3
# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import argparse
import pathlib

import license_policy


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Insert the SPDX header into supported files."
    )
    parser.add_argument(
        "--root",
        type=pathlib.Path,
        default=None,
        help="Repository root (defaults to git toplevel).",
    )
    parser.add_argument(
        "--files",
        nargs="+",
        type=pathlib.Path,
        default=None,
        help="Specific files to fix (paths relative to --root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report which files need headers without modifying them.",
    )
    args = parser.parse_args()

    root = args.root or license_policy.repo_root()

    if args.files:
        target_files = [root / path for path in args.files]
    else:
        target_files = list(license_policy.iter_source_files(root))

    missing_files = []
    for path in target_files:
        if not path.exists():
            continue
        if license_policy.has_license_header(path):
            continue
        missing_files.append(path)

    if not missing_files:
        print("All files already carry the SPDX header.")
        return 0

    if args.dry_run:
        print("Files missing the SPDX header:")
        for path in missing_files:
            print(f"  {path.relative_to(root)}")
        return 1

    for path in missing_files:
        license_policy.add_license_header(path)
        print(f"Added header to {path.relative_to(root)}")

    print(f"Inserted headers into {len(missing_files)} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
