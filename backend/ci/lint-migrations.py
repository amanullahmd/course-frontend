#!/usr/bin/env python3
"""Lint the Flyway migrations in backend/src/main/resources/db/migration.

Checks:
  * every file is named V<version>__<snake_case>.sql (no repeatable/undo scripts, no stray files)
  * versions are unique and contiguous, starting at 1
  * no file is empty (or contains only whitespace / SQL comments)
  * with --base-ref <ref>: no migration that exists on <ref> was modified, renamed or deleted
    (applied migrations are immutable: Flyway validation would fail on every existing database)

Usage:
  python3 backend/ci/lint-migrations.py                          # naming, versions, empty files
  python3 backend/ci/lint-migrations.py --base-ref origin/main   # + immutability against the base branch

Exit code 0 = clean, 1 = violations found, 2 = usage / git error.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

MIGRATION_DIR = "backend/src/main/resources/db/migration"
NAME_PATTERN = re.compile(r"^V(?P<version>[1-9][0-9]*)__(?P<desc>[a-z0-9]+(?:_[a-z0-9]+)*)\.sql$")


def repo_root() -> Path:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True
        ).stdout.strip()
        return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Not a git checkout: assume the script lives in <root>/backend/ci/
        return Path(__file__).resolve().parents[2]


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", "", sql)
    return sql.strip()


def lint_files(directory: Path) -> list[str]:
    errors: list[str] = []
    if not directory.is_dir():
        return [f"migration directory not found: {directory}"]

    versions: dict[int, str] = {}
    for path in sorted(directory.iterdir()):
        name = path.name
        if path.is_dir():
            errors.append(f"{name}: sub-directories are not allowed in {MIGRATION_DIR}")
            continue
        match = NAME_PATTERN.match(name)
        if not match:
            errors.append(
                f"{name}: invalid name, expected V<n>__<snake_case>.sql "
                "(lower-case letters, digits and single underscores, e.g. V4__add_course_tags.sql)"
            )
            continue
        version = int(match.group("version"))
        if version in versions:
            errors.append(f"{name}: duplicate version {version} (also used by {versions[version]})")
        else:
            versions[version] = name
        content = path.read_text(encoding="utf-8", errors="replace")
        if not strip_sql_comments(content):
            errors.append(f"{name}: file is empty (only whitespace or comments)")

    if versions:
        expected = list(range(1, max(versions) + 1))
        missing = [v for v in expected if v not in versions]
        if missing:
            errors.append(
                "versions are not contiguous, missing: " + ", ".join(f"V{v}" for v in missing)
            )
    else:
        errors.append(f"no migrations found in {MIGRATION_DIR}")
    return errors


def lint_immutability(root: Path, base_ref: str) -> list[str]:
    try:
        subprocess.run(
            ["git", "rev-parse", "--verify", "--quiet", f"{base_ref}^{{commit}}"],
            cwd=root, check=True, capture_output=True, text=True,
        )
    except subprocess.CalledProcessError:
        print(f"error: base ref '{base_ref}' not found (fetch it first, e.g. fetch-depth: 0)", file=sys.stderr)
        sys.exit(2)

    # Compare the merge base with the working tree, so only changes made on this branch count.
    merge_base = subprocess.run(
        ["git", "merge-base", base_ref, "HEAD"], cwd=root, capture_output=True, text=True
    ).stdout.strip() or base_ref
    diff = subprocess.run(
        ["git", "diff", "--name-status", "--no-renames", merge_base, "--", MIGRATION_DIR],
        cwd=root, check=True, capture_output=True, text=True,
    ).stdout
    errors: list[str] = []
    for line in diff.splitlines():
        status, _, path = line.partition("\t")
        name = Path(path).name
        if status.startswith("M"):
            errors.append(f"{name}: modified, but it already exists on {base_ref}; add a new migration instead")
        elif status.startswith("D"):
            errors.append(f"{name}: deleted, but it already exists on {base_ref}; migrations are immutable")
        elif status.startswith("T"):
            errors.append(f"{name}: file type changed, but it already exists on {base_ref}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-ref", help="git ref of the base branch (e.g. origin/main) for the immutability check")
    args = parser.parse_args()

    root = repo_root()
    directory = root / MIGRATION_DIR
    errors = lint_files(directory)
    if args.base_ref:
        errors += lint_immutability(root, args.base_ref)

    count = len(list(directory.glob("*.sql"))) if directory.is_dir() else 0
    if errors:
        print(f"Flyway migration lint: {len(errors)} problem(s) in {MIGRATION_DIR}")
        for error in errors:
            print(f"  - {error}")
            if "GITHUB_ACTIONS" in os.environ:
                print(f"::error title=migrations:lint::{error}")
        return 1
    suffix = f", none of the migrations on {args.base_ref} changed" if args.base_ref else ""
    print(f"Flyway migration lint: {count} migration(s) OK{suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
