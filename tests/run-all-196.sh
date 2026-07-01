#!/usr/bin/env bash
# Phase 196 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# part8-runtime-slm-guardrail cluster. Models on tests/run-all-188.sh.
#
# Phase 196 ships the runtime Part-8 boundary guardrail: a pure LOCAL classifier
# (part8-egress-guard), a PreToolUse hook (part8-egress-guard-hook), a scalars-only
# telemetry writer (part8-egress-ontology), and a Shape F.1 ambiguous-egress gate.
# No runtime code opens a Brain wire at classify time (D-01). Plurai is BUILD/CI
# only, synthetic data only, never on the runtime path (D-04/D-06/D-07/D-10a).
#
# WAVE 0 CONTRACT: this runner is authored BEFORE the modules land (Nyquist: tests
# precede implementation). Every module leg is run_if, GUARDED ON THE RUNTIME MODULE
# FILE (not the test file), so Wave 0 exits cleanly with SKIPs. As later waves land
# each runtime module, its leg flips from SKIP to a real run and the gate tightens.
#
# The one leg that MUST be green the moment the classifier exists is the grep-guard:
# PB8-02 no private FORBIDDEN_PATTERNS copy. It is a pure read-only assertion over
# the tracked classifier source; it never mutates anything. It is run_if-guarded on
# the classifier so it SKIPs cleanly in Wave 0 and binds the instant the module lands.
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
# Classifier unit + CSV parity (PB8-01/02/03/05/09). run_if guarded on the
# RUNTIME module (lib/core/part8-egress-guard.cjs), not the test file, so the
# leg SKIPs until 196-03 lands the classifier. The test file itself is also
# SKIP-safe (require-in-try/catch), but guarding on the module keeps the runner
# intent explicit: nothing to prove until the thing under test exists.
# ---------------------------------------------------------------------------
run_if "PB8-01/03/05/09 classifier unit + CSV parity" \
  lib/core/part8-egress-guard.cjs \
  node lib/core/part8-egress-guard.test.cjs

# ---------------------------------------------------------------------------
# Telemetry ontology (PB8-06 scalars-only writes through navigation.cjs).
# run_if guarded on lib/core/part8-egress-ontology.cjs (lands in 196-04).
# ---------------------------------------------------------------------------
run_if "PB8-06 telemetry ontology (scalars + slugs only)" \
  lib/core/part8-egress-ontology.cjs \
  node lib/core/part8-egress-ontology.test.cjs

# ---------------------------------------------------------------------------
# PreToolUse hook + F.1 gate + Brain-less degrade (PB8-04/05/07/08). run_if
# guarded on the hook module (scripts/part8-egress-guard-hook.cjs, lands 196-04;
# the F.1 gate lands 196-05). The test file itself further guards the gate and
# degrade legs behind their own module-presence checks.
# ---------------------------------------------------------------------------
run_if "PB8-04/05/07/08 hook + F.1 gate + degrade" \
  scripts/part8-egress-guard-hook.cjs \
  node tests/part8-egress-guard-hook.test.cjs

# ---------------------------------------------------------------------------
# PB8-02: no private FORBIDDEN_PATTERNS copy. The classifier MUST import the
# pattern set from rs-egress-prompts (re-exported byte-for-byte from
# cross-room-aggregator); a private local copy silently drifts and defeats the
# Part 7 reuse invariant. Modeled on run-all-188.sh membrane_grep (pure read-only).
#
# To avoid comment self-invalidation, strip comment lines (optional leading
# whitespace then //) BEFORE matching, then test for a literal assignment
# "FORBIDDEN_PATTERNS =". The leg PASSES when no such assignment survives the
# comment filter (the classifier imports, never declares, the pattern set).
# run_if-guarded on the classifier so it is SKIP-safe in Wave 0.
# ---------------------------------------------------------------------------
noprivate_regex() {
  ! grep -vE '^[[:space:]]*//' lib/core/part8-egress-guard.cjs \
    | grep -qE 'FORBIDDEN_PATTERNS[[:space:]]*='
}
run_if "PB8-02 no private FORBIDDEN_PATTERNS copy" \
  lib/core/part8-egress-guard.cjs \
  noprivate_regex

# ---------------------------------------------------------------------------
# Wave 3 end-to-end synthetic smoke leg (owned by plan 196-05). Drives a
# CONTENT-SET fixture and a MOVE-SET fixture through the LOCAL classify() path
# (asserts block / allow) and renders the ambiguous F.1 gate {Reformulate,
# Cancel} -- proving the full runtime path with no real room and no Brain wire.
# run_if-guarded on the F.1 gate module (lands here in 196-05) so it stays
# SKIP-safe if the gate is ever absent.
# ---------------------------------------------------------------------------
run_if "PB8-07/10 e2e synthetic smoke (CONTENT blocked, MOVE passes)" \
  lib/hmi/part8-egress-gate.cjs \
  node tests/part8-egress-e2e-smoke.test.cjs

echo "========================================"
echo "  Summary (196 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
