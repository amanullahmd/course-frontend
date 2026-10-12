#!/usr/bin/env python3
"""Print a Markdown coverage summary of a JaCoCo CSV report (for $GITHUB_STEP_SUMMARY).

Uses jacoco.csv (one row per class) instead of jacoco.xml, so no XML parsing is involved.

Usage: python3 backend/ci/coverage-summary.py backend/target/site/jacoco/jacoco.csv >> "$GITHUB_STEP_SUMMARY"
"""

import csv
import sys
from collections import defaultdict

COUNTERS = ["INSTRUCTION", "BRANCH", "LINE", "METHOD"]


def pct(covered, total):
    return f"{100.0 * covered / total:.1f} %" if total else "n/a"


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    totals = defaultdict(lambda: [0, 0])  # counter -> [covered, total]
    packages = defaultdict(lambda: [0, 0])  # package -> line [covered, total]
    classes = [0, 0]
    with open(sys.argv[1], newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            for name in COUNTERS:
                missed, covered = int(row[f"{name}_MISSED"]), int(row[f"{name}_COVERED"])
                totals[name][0] += covered
                totals[name][1] += missed + covered
            line_missed, line_covered = int(row["LINE_MISSED"]), int(row["LINE_COVERED"])
            packages[row["PACKAGE"]][0] += line_covered
            packages[row["PACKAGE"]][1] += line_missed + line_covered
            classes[1] += 1
            if int(row["INSTRUCTION_COVERED"]) > 0:
                classes[0] += 1

    print("## Backend test coverage (JaCoCo)\n")
    print("| Counter | Covered | Total | Coverage |")
    print("|---|---:|---:|---:|")
    for name in COUNTERS:
        covered, total = totals[name]
        print(f"| {name.title()} | {covered} | {total} | {pct(covered, total)} |")
    print(f"| Class | {classes[0]} | {classes[1]} | {pct(*classes)} |")

    print("\n<details><summary>Line coverage by package</summary>\n")
    print("| Package | Lines | Coverage |")
    print("|---|---:|---:|")
    for name, (covered, total) in sorted(packages.items(), key=lambda p: (p[1][0] / p[1][1]) if p[1][1] else 1.0):
        print(f"| `{name}` | {covered}/{total} | {pct(covered, total)} |")
    print("\n</details>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
