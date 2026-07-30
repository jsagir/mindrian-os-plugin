#!/usr/bin/env bash
# tests/test-240.1-hook-write-site.sh -- Phase 240.1 Plan 03 (CTXL-01).
#
# 240.1-RESEARCH.md Pitfall 2's documented warning sign is "a test that only
# calls computeState()". Plan 240.1-02's tests are exactly that -- they drive
# lib/core/state-ops.cjs::computeState() directly and never exercise a real
# hook write site. This file drives THREE REAL hook scripts
# (scripts/on-task-complete, scripts/on-stop, scripts/on-agent-complete)
# end to end against a sandboxed HOME, and proves the gsd_state_version /
# status stamp survives a regeneration triggered by each of them.
#
# Sandbox discipline: every leg runs with HOME="$TMPROOT" and
# `env -u MINDRIAN_ROOMS_HOME` (plus `-u MINDRIAN_MCP_FIRST` so on-stop takes
# its default legacy path), so scripts/compute-state:37's
# ROOMS_HOME="${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}" default resolves
# entirely inside the sandbox. Nothing under the real rooms home may be read
# or written; a canary assertion confirms $HOME is the sandbox before each
# leg runs anything.
#
# Environment SKIP discipline: if a required interpreter is genuinely absent
# in this environment, print a line beginning with the literal SKIP and exit
# 0. A missing assertion during a normal run is a FAIL, never a SKIP -- SKIP
# exists for environment gaps, not for papering over a real regression.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${REPO_ROOT}/scripts"
ON_TASK_COMPLETE="${SCRIPTS_DIR}/on-task-complete"
ON_STOP="${SCRIPTS_DIR}/on-stop"
ON_AGENT_COMPLETE="${SCRIPTS_DIR}/on-agent-complete"

PASS=0
FAIL=0

# --- Environment SKIP discipline -------------------------------------------
for interp in node python3 jq bash; do
  if ! command -v "$interp" >/dev/null 2>&1; then
    echo "SKIP: required interpreter '$interp' not found in this environment -- structural legs cannot run"
    exit 0
  fi
done

TMPROOT="$(mktemp -d -t ctxl2401-XXXXXX)"
trap 'rm -rf "$TMPROOT"' EXIT

ROOM_SLUG="ctxl2401-fixture-room"
ROOMS_HOME="${TMPROOT}/MindrianRooms"
ROOM_DIR="${ROOMS_HOME}/${ROOM_SLUG}"

# --- Fixture: byte-identical to scripts/room-registry:127-131's seeded
# STATE.md block (gsd_state_version: 1.0, status: active), plus one freshly
# modified .md file so scripts/on-agent-complete's 30-second cutoff window
# dispatches at least one cascade and reaches its STATE.md recompute block.
seed_room() {
  rm -rf "$ROOM_DIR"
  mkdir -p "${ROOM_DIR}/.mindrian"
  mkdir -p "${ROOM_DIR}/problem-definition"
  : > "${ROOM_DIR}/.room-root"
  cat > "${ROOM_DIR}/ROOM.md" <<'ROOM_EOF'
# Fixture Room

Phase 240.1 Plan 03 hook-write-site integration fixture. Never a real user
room; lives entirely under a sandboxed HOME.
ROOM_EOF
  cat > "${ROOM_DIR}/STATE.md" <<'STATE_EOF'
---
gsd_state_version: 1.0
status: active
---

# State

## Decisions

(none yet)
STATE_EOF
  cat > "${ROOM_DIR}/problem-definition/note.md" <<'NOTE_EOF'
# Fixture Note

A recently-modified artifact so on-agent-complete's cascade dispatch fires.
NOTE_EOF
  mkdir -p "${ROOMS_HOME}/.rooms"
  cat > "${ROOMS_HOME}/.rooms/registry.json" <<REG_EOF
{
  "version": 1,
  "active": "${ROOM_SLUG}",
  "rooms": {
    "${ROOM_SLUG}": {
      "path": "${ROOM_SLUG}",
      "status": "active"
    }
  }
}
REG_EOF
}

# --- Sandbox canary: $HOME resolves to the sandbox, never the real home. ---
assert_sandbox_home() {
  local actual
  actual=$(HOME="$TMPROOT" env -u MINDRIAN_ROOMS_HOME -u MINDRIAN_MCP_FIRST bash -c 'printf %s "$HOME"')
  if [ "$actual" != "$TMPROOT" ]; then
    echo "FAIL: sandbox canary: HOME resolved to '$actual' inside the leg, expected '$TMPROOT'"
    FAIL=$((FAIL + 1))
    return 1
  fi
  return 0
}

# --- Post-hook assertions: gsd_state_version + status survive, and a fresh
# computed: line proves a real regeneration happened (not a skipped write).
check_after() {
  local label="$1"
  local ok=1
  if [ ! -f "${ROOM_DIR}/STATE.md" ]; then
    echo "FAIL: ${label}: STATE.md missing after hook run"
    FAIL=$((FAIL + 1))
    return 1
  fi
  if ! grep -q '^gsd_state_version: 1.0$' "${ROOM_DIR}/STATE.md"; then
    echo "FAIL: ${label}: gsd_state_version: 1.0 not found in regenerated STATE.md"
    ok=0
  fi
  if ! grep -q '^status: active$' "${ROOM_DIR}/STATE.md"; then
    echo "FAIL: ${label}: status: active not found in regenerated STATE.md"
    ok=0
  fi
  if ! grep -q '^computed:' "${ROOM_DIR}/STATE.md"; then
    echo "FAIL: ${label}: no computed: line found -- regeneration did not happen"
    ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "PASS: ${label}"
    PASS=$((PASS + 1))
    return 0
  fi
  FAIL=$((FAIL + 1))
  return 1
}

run_hook() {
  local hook_path="$1"
  timeout 20 env -u MINDRIAN_ROOMS_HOME -u MINDRIAN_MCP_FIRST HOME="$TMPROOT" bash "$hook_path" >/dev/null 2>&1 || true
}

# --- Scenario 1: scripts/on-task-complete ----------------------------------
scenario1() {
  seed_room
  assert_sandbox_home || return 0
  run_hook "$ON_TASK_COMPLETE"
  check_after "scenario 1 (on-task-complete)" || true
}

# --- Scenario 2: scripts/on-stop -------------------------------------------
scenario2() {
  seed_room
  assert_sandbox_home || return 0
  run_hook "$ON_STOP"
  check_after "scenario 2 (on-stop)" || true
}

# --- Scenario 3: scripts/on-agent-complete (hardest leg: the write happens
# inside a `( sleep 1 ; ... ) &` background subshell, so poll bounded rather
# than sleep a fixed amount. A bounded-wait expiry is a FAIL naming the
# background subshell, never a SKIP.
poll_for_regen() {
  local waited_ms=0
  local max_ms=10000
  local interval_s=0.2
  while [ "$waited_ms" -lt "$max_ms" ]; do
    if [ -f "${ROOM_DIR}/STATE.md" ] && grep -q '^computed:' "${ROOM_DIR}/STATE.md" 2>/dev/null; then
      return 0
    fi
    sleep "$interval_s"
    waited_ms=$((waited_ms + 200))
  done
  return 1
}

scenario3() {
  seed_room
  assert_sandbox_home || return 0
  run_hook "$ON_AGENT_COMPLETE"
  if poll_for_regen; then
    check_after "scenario 3 (on-agent-complete)" || true
  else
    echo "FAIL: scenario 3 (on-agent-complete): bounded 10s poll expired waiting for the background \`( sleep 1 ; ... ) &\` subshell in on-agent-complete to write a regenerated computed: line"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# MUTATION_MODE (unset in normal operation) lets the executor's own mutation
# proofs (transcribed in the plan summary, per the 240.1-02 precedent -- a
# mutation applied OUTSIDE this file, then this file run as a whole and its
# exit code observed) run exactly the same scenario code as a normal pass.
# Set to "m1" or "m2" to run only the affected scenario, so a caller who has
# ALREADY reverted scripts/on-agent-complete or scripts/on-task-complete on
# disk gets a plain nonzero exit from THIS FILE, not a self-mutating one.
# ---------------------------------------------------------------------------
echo "=== Phase 240.1 Plan 03: hook-write-site integration (CTXL-01) ==="
case "${MUTATION_MODE:-}" in
  m1)
    scenario3
    ;;
  m2)
    scenario1
    ;;
  *)
    scenario1
    scenario2
    scenario3
    ;;
esac

echo ""
echo "passed: ${PASS}  failed: ${FAIL}"
if [ "$FAIL" -eq 0 ]; then
  echo "PASS test-240.1-hook-write-site.sh"
  exit 0
else
  echo "FAIL test-240.1-hook-write-site.sh"
  exit 1
fi
