#!/usr/bin/env bash
# Phase 198 SPEC-6 -- surface parity transcript scaffold.
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
# WAVE 0 CONTRACT: authored before any 198 module lands. Each step is
# individually run_if-gated on the module it needs; a missing module SKIPs,
# never FAILs. This script SKIPs cleanly today (zero 198 modules exist yet) and
# tightens as each wave lands its module. The real cross-host execution (running
# this same sequence on Claude Code CLI AND VS Code / MCP Inspector, then
# diffing the resulting graph writes + gate sequence) is a navigator-run
# verification step once the substrate is live -- this script documents and
# gates the sequence, it does not itself drive a second host process.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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

echo "========================================"
echo "  Summary (198 parity transcript scaffold)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
