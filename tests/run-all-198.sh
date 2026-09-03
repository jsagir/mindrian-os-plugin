#!/usr/bin/env bash
# Phase 198 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# MCP-first invocation substrate cluster. Cloned verbatim from
# tests/run-all-194.sh (run/run_if helpers byte-identical, lines 34-57),
# retargeted to the SPEC-1..8 test map (198-RESEARCH.md "Phase Requirements ->
# Test Map").
#
# Phase 198 moves the governed invocation spine onto ONE MCP substrate: a
# versioned mindrian-core server carries rooms, graph, chains, gates, sensors,
# and views; the Claude Code plugin shrinks to a thin adapter; parity is proven
# on Claude Code CLI plus one non-Anthropic MCP host -- all behind a default-OFF
# flag (MINDRIAN_MCP_FIRST) with a rehearsed rollback.
#
# WAVE 0 CONTRACT: this runner is authored before any 198 module lands. Every
# module leg is run_if (SKIP-safe until the enabling file exists), so Wave 0
# exits cleanly with SKIPs. Each leg's run_if gates on the NET-NEW artifact its
# wave introduces; missing files SKIP, they never FAIL. As the waves land, the
# SKIPs flip to real runs and the gate tightens.
#
# Two legs are HARD floors that must PASS in Wave 0 (always run, never run_if):
#   (1) the Part 8 local-only source-grep floor (test-198-local-only.test.cjs)
#       -- authored to PASS green in Wave 0 (zero 198 lib/mcp modules exist yet,
#       so nothing to flag), and it stays green as each new module lands clean;
#   (2) the aggregator's own self-check (the run/run_if helpers are wired and
#       usable) plus the parity-198.sh scaffold (SKIP-safe internally, always
#       exits 0 today).
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

# ---------------------------------------------------------------------------
# FLOOR 1 (self-check, HARD). Proves the run/run_if helpers above are wired
# before anything else in this aggregator executes.
# ---------------------------------------------------------------------------
run "198 aggregator self-check (run/run_if helpers wired)" bash -c 'true'

# ---------------------------------------------------------------------------
# FLOOR 2 (Part 8 local-only, HARD, green in Wave 0). Source-greps every NEW
# 198 lib/mcp module that exists for a Brain/network token and FAILs if one
# appears. Green today because zero 198 modules exist yet; stays green as each
# lands clean.
# ---------------------------------------------------------------------------
run "198 Part 8 local-only floor (zero Brain/network token in new lib/mcp modules)" \
  node tests/test-198-local-only.test.cjs

# ---------------------------------------------------------------------------
# FLOOR 3 (parity transcript scaffold, HARD, SKIP-safe internally). Always
# exits 0 today; each of its own steps is individually run_if-gated inside the
# script.
# ---------------------------------------------------------------------------
run "198 parity transcript scaffold (SPEC-6, SKIP-safe internally)" \
  bash tests/parity-198.sh

# ---------------------------------------------------------------------------
# SPEC-1 -- per-session room binding, driven through the MCP tool surface.
# Gates on the session-registry module (198-02, SEED-039 MCP consumption).
# ---------------------------------------------------------------------------
run_if "SPEC-1 two-session concurrency guard (MCP tool surface)" \
  lib/mcp/session-registry.cjs \
  node tests/test-198-concurrency-mcp.test.cjs

# ---------------------------------------------------------------------------
# SPEC-2 -- versioned mindrian-core contract (schema validity + chokepoint).
# ---------------------------------------------------------------------------
run_if "SPEC-2 contract-version + per-tool schema validity" \
  lib/mcp/contract-version.cjs \
  node tests/test-198-contract-schema.test.cjs

run_if "SPEC-2 graph write chokepoint guard (navigation.cjs only)" \
  lib/mcp/tools/graph.cjs \
  node tests/test-198-chokepoint-guard.test.cjs

# room_search rank-then-cap regression (graph-query-results-unranked, room_search
# leg): a relevant match in a late-walked folder must survive the 50-slot cap
# instead of being dropped in raw filesystem-arrival order.
run_if "SPEC-2 room_search ranks before capping (late relevant match survives)" \
  lib/mcp/tools/room.cjs \
  node tests/test-room-search-rank-before-cap.cjs

# ---------------------------------------------------------------------------
# SPEC-3 -- server-side chain execution honoring postures (halt-at-material).
# ---------------------------------------------------------------------------
run_if "SPEC-3 chain_run halts at material step, resumes after gate_answer approve" \
  lib/mcp/tools/chain.cjs \
  node tests/test-198-chain-run-halt.test.cjs

# ---------------------------------------------------------------------------
# SPEC-4 -- gate superset schema + the three-renderer ladder.
# ---------------------------------------------------------------------------
run_if "SPEC-4 gate renderer ladder (elicitation / thin-adapter card / structured text)" \
  lib/mcp/gate-render.cjs \
  node tests/test-198-gate-renderers.test.cjs

# quick task 260903-h27 -- T2 gate-card schema half: subjectNodeId /
# evidenceNodeIds carried on the normalized superset card + threaded through
# the four gate-card call sites.
run_if "SPEC-4 T2 gate-card node fields (subjectNodeId/evidenceNodeIds)" \
  lib/mcp/gate-render.cjs \
  node tests/test-h27-gate-card-node-fields.cjs

# ---------------------------------------------------------------------------
# SPEC-5 -- thin-plugin adapter (hooks carry zero business logic). Gates on
# the D-06 import-audit + line-count budget module the owning plan lands.
# ---------------------------------------------------------------------------
run_if "SPEC-5 hooks/ adapter-only budget (import audit + line-count)" \
  lib/mcp/hook-adapter-audit.cjs \
  node tests/test-198-adapter-budget.test.cjs

# SPEC-5 / D-05 bounded escape (mcp-first-path-retry-ceiling-hardcoded-zero,
# 2026-07-28). The Stop-gate handler used to hardcode BOTH bounded-escape
# counters to zero before every classifyCardFire call, so MAX_FORCE_RETRIES and
# MAX_SESSION_INTERCEPTS were structurally unreachable on the MCP-first path: a
# measured pre-fix run forced 36 cards against ceilings of 3 and 12. This leg
# drives the REAL handleStopEvent through repeated force-fire loops (both the
# stable-key per-gate case and the flapping-key session case) and counts the
# cards actually forced, so the guarantee is proven behaviorally rather than by
# source inspection. It matters most while MINDRIAN_MCP_FIRST is still unset:
# the ceiling must be closed BEFORE that flag is ever switched on.
run_if "SPEC-5 Stop-gate bounded escape reaches BOTH ceilings on the MCP-first path" \
  lib/mcp/stop-gate-handler.cjs \
  node tests/test-198-stop-gate-retry-ceiling.test.cjs

# ---------------------------------------------------------------------------
# SPEC-7 -- reversibility contract (flag off = byte-identical legacy).
# ---------------------------------------------------------------------------
run_if "SPEC-7 flag-off byte-identical parity + rollback rehearsal" \
  lib/mcp/mcp-first-flag.cjs \
  node tests/test-198-flag-off-parity.test.cjs

# ---------------------------------------------------------------------------
# SPEC-8 -- Plurai eval gate (roadmap mandate). Gates on the gate-check script
# itself (198-01 Task 2 lands it in this same plan, so this leg SKIPs only
# until Task 2 commits, then flips to a real PASS on the seeded
# baseline_deferred verdict).
# ---------------------------------------------------------------------------
run_if "SPEC-8 198 Plurai invocation-parity gate" \
  scripts/198-plurai-gate-check.cjs \
  node scripts/198-plurai-gate-check.cjs

echo "========================================"
echo "  Summary (198 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
