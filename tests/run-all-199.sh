#!/usr/bin/env bash
# Phase 199 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# AgentShield Scanner cluster (SEED-016 graduation). Cloned from the run()/run_if()
# scaffold of tests/run-all-196.sh.
#
# Phase 199 generalizes the shipped Phase-196 Part-8 brain-boundary guardrail into
# a plugin-wide security scanner. ONE engine (scanSurface) reads ONE versioned
# external rules source (references/security/cve-db.json); it never declares a
# private per-surface pattern copy (Part 7 reuse-before-build). The Brain surface
# (brain_egress) becomes one of six surfaces the engine covers alongside
# mcp_tool_description, hook_scope, skill_injection, claudemd_permission, and
# supply_chain. No runtime code opens a network wire at scan time (Part 8).
#
# WAVE 0 CONTRACT: this runner is authored BEFORE the modules land (Nyquist: tests
# precede implementation). Every module leg is run_if, GUARDED ON THE RUNTIME MODULE
# FILE (not the test file), so Wave 0 exits cleanly with SKIPs. As later waves land
# each runtime module, its leg flips from SKIP to a real run and the gate tightens.
#
# The one leg that MUST be green the moment the engine exists is the grep-guard:
# AS-02 no private per-surface pattern array. It is a pure read-only assertion over
# the tracked engine source; it never mutates anything. It is run_if-guarded on the
# engine so it SKIPs cleanly in Wave 0 and binds the instant the module lands.
#
# Requirement coverage (AS-01..AS-09), one named leg each:
#   AS-01 one generalized scanSurface() engine .......... scanner core test (Task 1)
#   AS-02 one versioned external rules source ........... grep-guard leg (Task 1)
#   AS-03 5 gatherers + runAgentShieldScan orchestrator . adapters test (Task 2)
#   AS-04 Part-6 dog-food live self-scan is clean ....... adapters test (Task 2)
#   AS-05 SessionStart drift gate (informs, exit 0) ..... sessionstart hook test (Task 2)
#   AS-06 CSV parity, frozen-scalar byte-identical ...... scanner core test (Task 1)
#   AS-07 zero-network proof + sub-500ms perf gate ...... scanner core test (Task 1)
#   AS-08 /mos:agentshield born-wired + doctor Class O .. Wave-3 leg (owned by 199-05)
#   AS-09 PR-gate CLI + final e2e smoke ................. Wave-4 leg (owned by 199-07)
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
# AS-01/06/07: the generalized scanSurface() engine contract, CSV parity, the
# zero-network proof, and the perf gate. run_if guarded on the RUNTIME module
# (lib/core/security/agentshield-scanner.cjs), not the test file, so the leg
# SKIPs until 199-03 lands the engine. The test file itself is also SKIP-safe
# (require-in-try/catch + CSV-presence guards), but guarding on the module keeps
# the runner intent explicit: nothing to prove until the thing under test exists.
# ---------------------------------------------------------------------------
run_if "AS-01/06/07 scanSurface engine + CSV parity + zero-network + perf" \
  lib/core/security/agentshield-scanner.cjs \
  node lib/core/security/agentshield-scanner.test.cjs

# ---------------------------------------------------------------------------
# AS-03/04: the 5 gatherers + runAgentShieldScan() orchestrator contract, and
# the Part-6 dog-food live self-scan (the shipped repo's own surfaces are clean).
# run_if guarded on the orchestrator module (lib/core/security/agentshield-run.cjs,
# lands 199-04).
# ---------------------------------------------------------------------------
run_if "AS-03/04 gatherers + orchestrator + dog-food self-scan" \
  lib/core/security/agentshield-run.cjs \
  node lib/core/security/agentshield-adapters.test.cjs

# ---------------------------------------------------------------------------
# AS-05: the SessionStart drift-scan hook stdin -> exit-code contract. A
# SessionStart hook INFORMS, it never blocks a session: it ALWAYS exits 0. It
# renders a Shape F.1 drift gate on stdout ONLY when a NEW flagged finding exists
# since the last locally-cached scan. run_if guarded on the hook module
# (scripts/agentshield-sessionstart-scan.cjs, lands 199-06). The test file itself
# further guards the drift-gate render leg behind lib/hmi/agentshield-drift-gate.cjs.
# ---------------------------------------------------------------------------
run_if "AS-05 SessionStart drift-scan hook (informs, always exit 0)" \
  scripts/agentshield-sessionstart-scan.cjs \
  node tests/agentshield-sessionstart-hook.test.cjs

# ---------------------------------------------------------------------------
# AS-02: no private per-surface pattern-array copy. The generalized engine MUST
# require(...) the versioned references/security/cve-db.json; declaring a private
# inline pattern array (MCP_PATTERNS / HOOK_PATTERNS / SKILL_PATTERNS /
# CLAUDEMD_PATTERNS = ...) silently drifts from the reviewable rules source and
# defeats the Part 7 reuse invariant + the AS-01/AS-02 "one engine, one versioned
# external rules source" gate. Modeled on run-all-196.sh noprivate_regex (pure
# read-only).
#
# To avoid comment self-invalidation, strip comment lines (optional leading
# whitespace then //) BEFORE matching, then test for a literal per-surface pattern
# assignment. The leg PASSES when no such assignment survives the comment filter
# (the engine requires, never declares, the pattern set). run_if-guarded on the
# engine so it is SKIP-safe in Wave 0.
# ---------------------------------------------------------------------------
noprivate_regex() {
  ! grep -vE '^[[:space:]]*//' lib/core/security/agentshield-scanner.cjs \
    | grep -qE '(MCP|HOOK|SKILL|CLAUDEMD)_PATTERNS[[:space:]]*='
}
run_if "AS-02 no private per-surface pattern array (engine requires cve-db.json)" \
  lib/core/security/agentshield-scanner.cjs \
  noprivate_regex

# ---------------------------------------------------------------------------
# AS-08 (Wave 3, owned by 199-05/199-06): /mos:agentshield command born-wired
# (Part 11 CIRS R1/R2) + the doctor.cjs Class O "all-surfaces-clean" acceptance
# point, plus the SessionStart drift gate (already covered by the AS-05 run_if leg
# above -- this placeholder documents which plan lands which leg). 199-05/199-06
# APPEND their legs here rather than re-authoring this file. Placeholder only.
# run_if "AS-08 /mos:agentshield born-wired + doctor Class O" \
#   scripts/doctor.cjs \
#   node tests/agentshield-command-wired.test.cjs

# ---------------------------------------------------------------------------
# AS-09 (Wave 4, owned by 199-07): the PR-gate CLI (paths-filtered GHA scan with
# baseline-delta) + the final end-to-end smoke that drives all six surfaces
# through scanSurface() (fixtures only, no live repo mutation, no network wire),
# renders the drift gate {Investigate, Defer}, and asserts the shipped CLI exits 0
# against the live repo (clean at the committed baseline). run_if guarded on the
# scan-CLI module so it stays SKIP-safe if the CLI is ever absent.
# ---------------------------------------------------------------------------
run_if "AS-09 PR-gate CLI + final e2e smoke (6 surfaces, drift gate, live CLI exit 0)" \
  scripts/agentshield-scan-cli.cjs \
  node tests/agentshield-e2e-smoke.test.cjs

echo "========================================"
echo "  Summary (199 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
