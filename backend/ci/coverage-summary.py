#!/usr/bin/env python3
"""Print a Markdown coverage summary of a JaCoCo XML report (for $GITHUB_STEP_SUMMARY).

Usage: python3 backend/ci/coverage-summary.py backend/target/site/jacoco/jacoco.xml >> "$GITHUB_STEP_SUMMARY"
"""

import sys
import xml.etree.ElementTree as ET

COUNTERS = ["INSTRUCTION", "BRANCH", "LINE", "METHOD", "CLASS"]


def counters(element):
    result = {}
    for counter in element.findall("counter"):
        missed, covered = int(counter.get("missed")), int(counter.get("covered"))
        result[counter.get("type")] = (covered, missed + covered)
    return result


def pct(covered, total):
    return f"{100.0 * covered / total:.1f} %" if total else "n/a"


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    # JaCoCo reports reference a DTD; ElementTree does not resolve external entities.
    root = ET.parse(sys.argv[1]).getroot()
    totals = counters(root)

    print("## Backend test coverage (JaCoCo)\n")
    print("| Counter | Covered | Total | Coverage |")
    print("|---|---:|---:|---:|")
    for name in COUNTERS:
        covered, total = totals.get(name, (0, 0))
        print(f"| {name.title()} | {covered} | {total} | {pct(covered, total)} |")

    print("\n<details><summary>Line coverage by package</summary>\n")
    print("| Package | Lines | Coverage |")
    print("|---|---:|---:|")
    packages = []
    for package in root.findall("package"):
        covered, total = counters(package).get("LINE", (0, 0))
        packages.append((package.get("name").replace("/", "."), covered, total))
    for name, covered, total in sorted(packages, key=lambda p: (p[1] / p[2]) if p[2] else 1.0):
        print(f"| `{name}` | {covered}/{total} | {pct(covered, total)} |")
    print("\n</details>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
