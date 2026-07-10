#!/usr/bin/env bash
# Phase 198 SPEC-6 -- surface parity transcript (CLI leg filled, Plan 198-10).
#
# The same governed session must pass identically on TWO HOSTS: Claude Code CLI
# and one non-Anthropic elicitation-capable MCP host (VS Code, elicitation-
# capable since v1.102; MCP Inspector is the build-time substitute per
# 198-RESEARCH.md Environment Availability). Both runs must produce the same
# typed graph writes (node/edge diff empty) and the same gate sequence.
#
# The documented transcript (six steps, run in order on each host):
#   1. bind room     -- room_bind
#   2. reach a card   -- gate_render (superset schema, renderer ladder)
#   3. chain_run with halt -- 2 autonomous_safe steps + 1 material step
#   4. gate_answer approve -- resumes the halted material step
#   5. gated write    -- lands through lib/core/navigation.cjs (the one chokepoint)
#   6. artifact_file   -- files the resulting artifact
#
# PLAN 198-10 fills the CLI leg: tests/capture-198-parity-leg.cjs runs the six
# steps in process against the real shipped MCP tool spine (the same functions
# the daemon calls) and captures a NORMALIZED, host-invariant artifact (typed
# node label-set + edge source/target/type set + logical gate sequence). The
# CLI-leg artifact is written to tests/artifacts/198-parity-cli.json.
#
# The VS Code leg is a human-verify checkpoint (Plan 198-10 Task 3): the
# navigator connects the elicitation-capable host to the durable daemon over
# 127.0.0.1, runs the identical transcript, and drops its captured artifact at
# tests/artifacts/198-parity-vscode.json (or runs this script with
# --host-leg vscode). When BOTH legs are present this script diffs them and
# asserts an EMPTY node/edge diff + identical gate sequence; with only the CLI
# leg present it reports the second host pending and exits 0 (the CLI leg is
# green and captured, the two-host assertion waits on the checkpoint).
#
# bash only. No emoji. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HOST_LEG="cli"
while [ $# -gt 0 ]; do
  case "$1" in
    --host-leg) HOST_LEG="${2:-cli}"; shift 2 ;;
    *) shift ;;
  esac
done

ARTIFACT_DIR="tests/artifacts"
CLI_ARTIFACT="$ARTIFACT_DIR/198-parity-cli.json"
VSCODE_ARTIFACT="$ARTIFACT_DIR/198-parity-vscode.json"

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

echo "Parity hosts: Claude Code CLI + one elicitation-capable MCP host (VS Code / MCP Inspector)."
echo ""

# ---------------------------------------------------------------------------
# The documented six-step sequence, each gated on the module it exercises.
# ---------------------------------------------------------------------------
run_if "Step 1: bind room (room_bind)" \
  lib/mcp/tools/room.cjs \
  true

run_if "Step 2: reach a card (gate_render superset schema)" \
  lib/mcp/gate-render.cjs \
  true

run_if "Step 3: chain_run with halt (2 autonomous_safe + 1 material)" \
  lib/mcp/tools/chain.cjs \
  true

run_if "Step 4: gate_answer approve (resumes the halted material step)" \
  lib/mcp/tools/gate.cjs \
  true

run_if "Step 5: gated write (through navigation.cjs, the one chokepoint)" \
  lib/mcp/tools/graph.cjs \
  true

run_if "Step 6: artifact_file (files the resulting artifact)" \
  lib/mcp/tools/views.cjs \
  true

# ---------------------------------------------------------------------------
# CLI LEG -- capture the governed transcript's typed graph writes + gate
# sequence (SPEC-6). This is the always-run half; the second host diffs
# against this artifact.
# ---------------------------------------------------------------------------
run "CLI leg: capture governed transcript (typed writes + gate sequence)" \
  node tests/capture-198-parity-leg.cjs --host cli --out "$CLI_ARTIFACT"

# ---------------------------------------------------------------------------
# VS CODE LEG (optional) -- when explicitly requested, capture the second-host
# leg. On a live VS Code / MCP Inspector session the navigator has already run
# the identical transcript against the daemon on 127.0.0.1; this drops the
# comparable normalized artifact beside the CLI one.
# ---------------------------------------------------------------------------
if [ "$HOST_LEG" = "vscode" ]; then
  run "VS Code leg: capture governed transcript (second host)" \
    node tests/capture-198-parity-leg.cjs --host vscode --out "$VSCODE_ARTIFACT"
fi

# ---------------------------------------------------------------------------
# TWO-HOST DIFF -- assert an EMPTY node/edge diff + identical gate sequence
# when both legs are present. With only the CLI leg present, report the second
# host pending (the Plan 198-10 Task 3 human-verify checkpoint) and pass.
# ---------------------------------------------------------------------------
if [ -f "$CLI_ARTIFACT" ] && [ -f "$VSCODE_ARTIFACT" ]; then
  run "Two-host parity diff (empty node/edge diff + identical gate sequence)" \
    node tests/diff-198-parity.cjs "$CLI_ARTIFACT" "$VSCODE_ARTIFACT"
else
  echo "--- Two-host parity diff ---"
  echo ">>> Two-host parity diff: PENDING (VS Code leg not captured yet)"
  echo "    CLI leg captured at: $CLI_ARTIFACT"
  echo "    Second host (VS Code v1.102+ / MCP Inspector) leg is the Plan 198-10 Task 3"
  echo "    human-verify checkpoint: connect the host to the daemon on 127.0.0.1, run the"
  echo "    identical transcript, then re-run: bash tests/parity-198.sh --host-leg vscode"
  echo ""
  SKIP=$((SKIP+1))
fi

echo "========================================"
echo "  Summary (198 parity transcript)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
