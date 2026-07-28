#!/usr/bin/env bash
# Phase 237 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# Reach Mechanism cluster (REACH-01 fake chain execution, REACH-02 dual
# autonomy authority, REACH-03 session-scoped signals). Cloned from
# tests/run-all-198.sh (run/run_if helpers byte-identical, lines 30-57),
# retargeted to 237-VALIDATION.md's Per-Task Verification Map.
#
# v1.16.0 "Infrastructure Remediation" exists because gates that could not
# fail were reading green. This aggregator is the meta-gate for Phase 237:
# it is authored FIRST, before any Phase 237 code lands, so every subsequent
# plan has a real place to report and the phase can never reach "done" on a
# suite that was never wired.
#
# WAVE 0 CONTRACT: this runner is authored before any 237 module lands. Every
# module leg is run_if (SKIP-safe until the enabling file exists), so Wave 0
# exits cleanly with SKIPs. Each leg's run_if gates on the NET-NEW artifact
# its wave introduces; missing files SKIP, they never FAIL. As the waves
# land, the SKIPs flip to real runs and the gate tightens.
#
# Every leg command is a hard-coded literal argv (node tests/test-237-<name>.cjs).
# No leg path is derived from a glob, an env var, or file contents -- see
# tests/run-all-241.sh for the glob-discovery pattern this file deliberately
# does NOT copy (it breaks the Wave-0 SKIP-safe contract by exiting 1 when
# zero tests/test-241-*.cjs files are found).
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
# Nine module legs, each run_if-gated on its own test file so the aggregator
# is green-with-SKIPs before any Phase 237 code lands.
# ---------------------------------------------------------------------------

run_if "REACH-02 autonomy parity walk + mutation" \
  tests/test-237-autonomy-parity.cjs \
  node tests/test-237-autonomy-parity.cjs

run_if "REACH-02 one-authority source fence" \
  tests/test-237-one-authority-fence.cjs \
  node tests/test-237-one-authority-fence.cjs

run_if "REACH-01 decide() call-site census + seam preservation" \
  tests/test-237-decide-census.cjs \
  node tests/test-237-decide-census.cjs

run_if "REACH-01 executable seam-liveness" \
  tests/test-237-executable-seam.cjs \
  node tests/test-237-executable-seam.cjs

run_if "REACH-01 dispatcher tier honesty" \
  tests/test-237-dispatcher-tiers.cjs \
  node tests/test-237-dispatcher-tiers.cjs

run_if "REACH-01 approve-to-execute + mutation" \
  tests/test-237-approve-executes.cjs \
  node tests/test-237-approve-executes.cjs

run_if "REACH-03 two-process session scope + mutation" \
  tests/test-237-session-scope.cjs \
  node tests/test-237-session-scope.cjs

run_if "REACH-03 fail-open degrade legs" \
  tests/test-237-session-scope-degrade.cjs \
  node tests/test-237-session-scope-degrade.cjs

run_if "REACH-03 post-write session stamp" \
  tests/test-237-post-write-session-stamp.cjs \
  node tests/test-237-post-write-session-stamp.cjs

# ---------------------------------------------------------------------------
# Three regression legs, plain run (their files already exist today, so a
# SKIP here would be a lie).
# ---------------------------------------------------------------------------

run "REGRESSION chain_run halt (retargeted to the one authority)" \
  node tests/test-198-chain-run-halt.test.cjs

run "REGRESSION act-command adapted decideFn still reaches decide()" \
  node tests/test-act-on-runchain.cjs

run "REGRESSION recipe-maps is the posture authority" \
  node tests/test-recipe-maps-authority.cjs

# ---------------------------------------------------------------------------
# Three ALWAYS-RUN hard floors, ahead of the summary tail. Never run_if -- a
# floor that could SKIP is not a floor.
# ---------------------------------------------------------------------------

# Floor 1 (self-check, HARD). Proves the run/run_if helpers above are wired
# before anything else in this aggregator executes. This exists so the
# aggregator can never report a zero-leg green.
run "237 aggregator self-check (run/run_if helpers wired)" bash -c 'true'

# Floor 2 (Part 8 local-only, HARD). Extended in this same plan to name
# lib/core/chain-step-dispatcher.cjs (Plan 07's net-new module) while
# tolerating its current absence.
run "237 Canon Part 8 local-only floor" \
  node tests/test-198-local-only.test.cjs

# Floor 3 (em-dash sweep, HARD). The forbidden glyph is matched via its
# codepoint escape (U+2014, bash ANSI-C quoting) so this runner itself
# carries no literal em-dash to trip its own sweep. Pattern from
# tests/run-all-164.sh:352-395.
em_dash_sweep() {
  local EMDASH=$'\u2014'
  local EMDASH_OK=1
  local EMDASH_TARGETS=(
    "lib/core/chain-step-dispatcher.cjs"
    "lib/mcp/tools/chain.cjs"
    "lib/core/chain-executor.cjs"
    "lib/core/insight-sensors.cjs"
    "scripts/post-write"
    "scripts/auto-explore-fingerprint.cjs"
    "scripts/auto-explore-fire.cjs"
    "scripts/build-command-registry.cjs"
    "commands/snapshot.md"
    "tests/run-all-237.sh"
    "tests/test-237-autonomy-parity.cjs"
    "tests/test-237-one-authority-fence.cjs"
    "tests/test-237-decide-census.cjs"
    "tests/test-237-executable-seam.cjs"
    "tests/test-237-dispatcher-tiers.cjs"
    "tests/test-237-approve-executes.cjs"
    "tests/test-237-session-scope.cjs"
    "tests/test-237-session-scope.worker.cjs"
    "tests/test-237-session-scope-degrade.cjs"
    "tests/test-237-post-write-session-stamp.cjs"
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
run "237 em-dash sweep (Phase 237 artifacts)" em_dash_sweep

echo "========================================"
echo "  Summary (237 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
