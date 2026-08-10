#!/usr/bin/env bash
# Phase 248 verification aggregator -- the single PASS/FAIL/SKIP gate for
# MCP-First Room Resolution (CTX-01 nine-copy collapse, CTX-02 honest
# room_bind, CTX-03 live before/after). Cloned from tests/run-all-237.sh
# (run/run_if helpers byte-identical, lines 30-57 there).
#
# WAVE 0 CONTRACT (deliberately DIFFERENT from run-all-237.sh's per-leg-own-file
# gating): every 248-owned leg below is run_if gated on lib/mcp/session-room.cjs
# EXISTING -- the ONE net-new artifact this phase's collapse hinges on -- not on
# each leg's own test file. That is because Task 1 (this commit) authors
# tests/test-248-resolver-census.cjs and tests/test-248-room-bind-session-
# authoritative.cjs BEFORE session-room.cjs exists, and both are RED at this
# commit for the right reasons (the census counts nine copies with no shared
# module; the authority test proves a bound session is ignored flag-off). A
# per-leg-own-file gate would make this runner FAIL red at Task 1; gating on
# session-room.cjs instead makes it SKIP clean, and both tests still run
# directly (and fail) per Task 1's own <verify> command. As Task 2 lands
# session-room.cjs, every gated leg flips from SKIP to a real run.
#
# The plan 248-02 tests (honest room_bind return, surface probes) are NOT yet
# authored at this commit, so THEIR legs use the normal own-file run_if gate
# (SKIP-safe until authored, same as run-all-237.sh's convention).
#
# Every leg command is a hard-coded literal argv. bash only. No emoji. No
# em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SESSION_ROOM="lib/mcp/session-room.cjs"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# 248-01 legs -- gated on session-room.cjs existing (Wave 0 contract above).
# ---------------------------------------------------------------------------

run_if "CTX-01 resolver census (source-grep tripwire)" \
  "$SESSION_ROOM" \
  node tests/test-248-resolver-census.cjs

run_if "CTX-01/CTX-02 bound-session authority proof" \
  "$SESSION_ROOM" \
  node tests/test-248-room-bind-session-authoritative.cjs

# ---------------------------------------------------------------------------
# 248-02 legs -- own-file run_if gate (not yet authored at this commit).
# ---------------------------------------------------------------------------

run_if "CTX-02 honest room_bind return" \
  tests/test-248-room-bind-honest-return.cjs \
  node tests/test-248-room-bind-honest-return.cjs

run_if "CTX-03 surface probes" \
  tests/test-248-surface-probes.cjs \
  node tests/test-248-surface-probes.cjs

# ---------------------------------------------------------------------------
# Always-run legacy legs -- exercise the shared core ladder and the
# resolver-collapse's blast radius. Their files already exist today, so a
# SKIP here would be a lie.
# ---------------------------------------------------------------------------

run "REGRESSION 198 flag-off parity (re-pointed doctrine, Task 3)" \
  node tests/test-198-flag-off-parity.test.cjs

run "REGRESSION tool-router active-room misroute" \
  node tests/test-tool-router-active-room-misroute.cjs

run "REGRESSION room-state active-room misroute" \
  node tests/test-room-state-active-room-misroute.cjs

run "REGRESSION room-state no-registry regression" \
  node tests/test-room-state-no-registry-regression.cjs

run "REGRESSION resolve-active-room canonical (rar.* tripwires)" \
  node tests/test-resolve-active-room-canonical.cjs

# ---------------------------------------------------------------------------
# Hard floor: em-dash sweep on Phase 248's own artifacts. Never run_if -- a
# floor that could SKIP is not a floor. Matched via codepoint escape (U+2014,
# bash ANSI-C quoting) so this runner carries no literal em-dash to trip its
# own sweep.
# ---------------------------------------------------------------------------
em_dash_sweep() {
  local EMDASH=$'\u2014'
  local EMDASH_OK=1
  local EMDASH_TARGETS=(
    "lib/mcp/session-room.cjs"
    "tests/test-248-resolver-census.cjs"
    "tests/test-248-room-bind-session-authoritative.cjs"
    "tests/test-248-room-bind-honest-return.cjs"
    "tests/run-all-248.sh"
  )
  local t f
  for t in "${EMDASH_TARGETS[@]}"; do
    f="$ROOT/$t"
    if [ -f "$f" ] && grep -q "$EMDASH" "$f"; then
      echo "    FORBIDDEN em-dash in: $t"; EMDASH_OK=0
    fi
  done
  [ "$EMDASH_OK" -eq 1 ]
}
run "248 em-dash sweep (Phase 248 artifacts)" em_dash_sweep

echo "========================================"
echo "  Summary (248 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
