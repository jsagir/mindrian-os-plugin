#!/usr/bin/env bash
# tests/test-deadline-monitor-planning-state.sh
# ==============================================
# HARD-05 regression smoke test (Phase 140-03).
#
# Proves the deadline monitor (scripts/sentinel-deadline-monitor) reports a
# phase deadline read from .planning/STATE.md -- not just funding/ +
# opportunity-bank/. Before the source fix the monitor never reads
# .planning/STATE.md, so a near phase deadline shows as CLEAR (RED). After the
# fix the deadline surfaces as DUE / URGENT / UPCOMING through the existing
# alerts[] report path (GREEN).
#
# The monitor resolves the planning-state file from $PLANNING_STATE_FILE when
# set (test seam), else from the repo root's .planning/STATE.md. The test sets
# the env var to a fixture so it never depends on the live (gitignored) state.
#
# Exit 0 = GREEN (phase deadline surfaced). Exit non-zero = RED.
#
# No em-dashes (HARD RULE).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITOR="$REPO_ROOT/scripts/sentinel-deadline-monitor"

if [ ! -x "$MONITOR" ] && [ ! -f "$MONITOR" ]; then
  echo "FAIL: monitor not found at $MONITOR" >&2
  exit 1
fi

# ---- Fixture: a throwaway room + a .planning/STATE.md with a near deadline ----

FIXTURE="$(mktemp -d)"
cleanup() { rm -rf "$FIXTURE"; }
trap cleanup EXIT

ROOM_DIR="$FIXTURE/room"
mkdir -p "$ROOM_DIR"

# A phase deadline 3 days out -- well inside the default 7-day alert window.
NEAR_DEADLINE="$(date -u -d '+3 days' +%Y-%m-%d 2>/dev/null \
  || date -u -v+3d +%Y-%m-%d 2>/dev/null \
  || python3 -c "from datetime import datetime,timedelta; print((datetime.utcnow()+timedelta(days=3)).strftime('%Y-%m-%d'))")"

mkdir -p "$FIXTURE/.planning"
STATE_FILE="$FIXTURE/.planning/STATE.md"
cat > "$STATE_FILE" <<EOF
# Project STATE

Some prose about the current phase.

Hard deadline: ${NEAR_DEADLINE} (Fixture phase deadline for HARD-05 smoke test)
Soft deadline: -- (placeholder, must be skipped, not fatal)

More prose below.
EOF

# ---- Invoke the monitor with the planning-state seam pointed at the fixture --

set +e
OUTPUT="$(PLANNING_STATE_FILE="$STATE_FILE" bash "$MONITOR" "$ROOM_DIR" 7 2>&1)"
STATUS=$?
set -e

echo "---- monitor output ----"
echo "$OUTPUT"
echo "------------------------"

if [ "$STATUS" -ne 0 ]; then
  echo "FAIL: monitor exited non-zero ($STATUS)" >&2
  exit 1
fi

# RED condition: the monitor reports CLEAR while a near phase deadline exists.
if echo "$OUTPUT" | grep -q "DEADLINES:CLEAR"; then
  echo "FAIL (RED): monitor reported CLEAR while a phase deadline is ${NEAR_DEADLINE}" >&2
  exit 1
fi

# GREEN condition: an alert fired AND it is sourced from the phase scan.
if ! echo "$OUTPUT" | grep -q "DEADLINES:ALERT"; then
  echo "FAIL: monitor did not emit DEADLINES:ALERT for the phase deadline" >&2
  exit 1
fi

# The phase deadline must render through the report with a distinct 'phase'
# source label (not silently merged into funding/opportunity).
REPORT_LINE="$(echo "$OUTPUT" | grep '^REPORT:' | head -1 | sed 's/^REPORT://')"
if [ -z "$REPORT_LINE" ] || [ ! -f "$REPORT_LINE" ]; then
  echo "FAIL: no report file produced" >&2
  exit 1
fi

if ! grep -qi "phase" "$REPORT_LINE"; then
  echo "FAIL: report does not carry a 'phase' source label" >&2
  echo "---- report ----"; cat "$REPORT_LINE"; echo "----------------"
  exit 1
fi

# ---- Resilience: absent .planning/STATE.md must NOT error (exit 0) ----------

set +e
PLANNING_STATE_FILE="$FIXTURE/.planning/DOES-NOT-EXIST.md" bash "$MONITOR" "$ROOM_DIR" 7 >/dev/null 2>&1
ABSENT_STATUS=$?
set -e
if [ "$ABSENT_STATUS" -ne 0 ]; then
  echo "FAIL: monitor errored when .planning/STATE.md is absent (must skip silently)" >&2
  exit 1
fi

echo "HARD-05 GREEN"
exit 0
