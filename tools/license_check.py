#!/usr/bin/env python3
# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import argparse
import pathlib
import sys

import license_policy


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ensure files expose the SPDX license header."
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
        help="Specific files to check (paths relative to --root).",
    )
    args = parser.parse_args()

    root = args.root or license_policy.repo_root()

    if args.files:
        target_files = [root / path for path in args.files]
    else:
        target_files = list(license_policy.iter_source_files(root))

    violations: list[pathlib.Path] = []
    for path in target_files:
        if not path.exists():
            print(f"[warning] Missing file skipped: {path}")
            continue
        if not license_policy.has_license_header(path):
            violations.append(path)

    if violations:
        print("License header check failed for the following files:")
        for path in violations:
            print(f"  {path.relative_to(root)}")
        print(
            "Run tools/license_fix.py to insert the required two-line header "
            "before rerunning this check."
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
