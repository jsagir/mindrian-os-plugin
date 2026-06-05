#!/usr/bin/env bash
# Phase 140-02 HARD-01 regression smoke test.
# Reproduces the line-132 arithmetic abort: when the PREVIOUS snapshot has ZERO
# edge-keyword matches, scripts/sentinel-health-check ran
#   previous_edges=$(grep -ciE '...' "$PREVIOUS" || echo "0")
# which yields a TWO-LINE "0\n0" (grep -c prints 0 AND exits 1, so || echo 0
# appends a second line). Under set -euo pipefail the delta $((current - previous))
# then aborts with "syntax error in expression".
#
# Contract: against a zero-edge snapshot the script must exit 0, write a valid
# health report, and emit no "syntax error in expression" / "unbound variable".
# RED before Task 2; GREEN after.
#
# Self-contained: builds a fixture room under mktemp, cleans up on exit.
# Uses exit-code based pass/fail (exit 1 on any failed assertion).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/sentinel-health-check"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$SCRIPT" ] || fail "sentinel-health-check script not found at $SCRIPT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ROOM="$WORK/room"
mkdir -p "$ROOM/.snapshots"

# Current STATE.md: a couple of edge keywords present (nonzero current_edges),
# plus an entry-count line so the entry-delta arithmetic also runs.
cat > "$ROOM/STATE.md" <<'EOF'
---
venture_stage: exploration
---
# Room State

| section | status | entries |
|---------|--------|---------|
| market  | active | 3 entries |

This artifact INFORMS the market section and CONVERGES on a theme.
EOF

# PREVIOUS snapshot: ZERO edge keywords on purpose (the exact Pitfall 1 trigger).
# No INFORMS / CONTRADICTS / CONVERGES / ENABLES / INVALIDATES anywhere.
cat > "$ROOM/.snapshots/STATE-2026-01-01.md" <<'EOF'
---
venture_stage: exploration
---
# Room State Snapshot

| section | status | entries |
|---------|--------|---------|
| market  | active | 1 entries |

A plain note with no relationship keywords at all.
EOF

# Run the script, capturing combined output and exit code.
OUT="$WORK/out.txt"
set +e
bash "$SCRIPT" "$ROOM" > "$OUT" 2>&1
RC=$?
set -e 2>/dev/null || true

# Assertion 1: exit 0 (no abort under set -euo pipefail).
if [ "$RC" -ne 0 ]; then
  echo "----- script output -----" >&2
  cat "$OUT" >&2
  fail "sentinel-health-check exited $RC on a zero-edge snapshot (expected 0)"
fi

# Assertion 2: no arithmetic syntax error and no unbound-variable abort.
if grep -qi "syntax error in expression" "$OUT"; then
  cat "$OUT" >&2
  fail "output contains 'syntax error in expression' (the HARD-01 abort)"
fi
if grep -qi "unbound variable" "$OUT"; then
  cat "$OUT" >&2
  fail "output contains 'unbound variable'"
fi

# Assertion 3: a valid health report file was written.
REPORT="$(find "$ROOM/.intelligence" -name 'health-*.md' 2>/dev/null | head -1)"
[ -n "$REPORT" ] || fail "no health-*.md report written under .intelligence/"
grep -q "HEALTH_STATUS:" "$REPORT" || fail "report missing HEALTH_STATUS line: $REPORT"
grep -q "## Edge Counts" "$REPORT" || fail "report missing Edge Counts section: $REPORT"

echo "OK: HARD-01 -- sentinel-health-check survives a zero-edge snapshot and writes a valid report"
exit 0
