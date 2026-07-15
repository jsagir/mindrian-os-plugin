#!/usr/bin/env bash
# Phase 223 verification aggregator -- the ONE-COMMAND PASS/FAIL/SKIP gate for
# the jtbd-driven intelligence pipeline + governed double-fan bono (the two
# born-wired surfaces sharing one close-the-loop graph-write spine). Mirrors
# tests/run-all-224.sh's run/run_if aggregator shape and its comment-stripped
# grep-sweep legs.
#
# The two-part contract this gate proves (all legs green = the phase gate):
#   (1) Every per-plan node proof (the five tests/test-223-*.cjs legs across
#       Reqs 1-4) passes as a run_if-guarded leg, partial-landing safe.
#   (2) The phase's constitutional constraints are PERMANENT tripwires:
#         - Part 8 (persona research is SIGNAL->LOCAL): no network primitive on
#           an executable line in any of the five phase-223 surfaces.
#         - Part 9 (chokepoint-only writes): consumer surfaces hold NO raw
#           INSERT INTO edges/nodes and no node:sqlite; close-loop-writer
#           requires navigation.cjs; the typed-open-question writer (chokepoint
#           internals, navigation/ family) may write nodes but NEVER edges.
#         - D-03 (no retired compute path): intel-pipeline.cjs carries no
#           compute-hsi / python / .py token on an executable line.
#         - Req 6 (missing source dir never referenced): zero mindrian-designs
#           tokens anywhere in commands/, skills/, lib/core/bono/.
#         - DESENSITIZE convention (build-skill-mirrors): commands/bono.md
#           keeps SENS-05 while its mirror keeps sensor_triggers: [] -- the
#           asymmetry is asserted, never converged.
#         - Zero new dependencies: a git-diff leg on package.json/lock.
#         - Req 5 structural gates: build-connector-registry --check,
#           check-shape-declaration (WITHOUT --strict; advisory-WARN per Phase
#           210), build-orchestration-projection --check, check-render-coverage,
#           and a doctor --acceptance no-new-regression subset leg.
#
# DELIBERATE exclusions (the run-all-217.sh written-reason idiom):
#   - tests/run-all-164.sh is NOT a leg: it carries a pre-existing stale
#     canon-version assertion (expects the v1.13-era MINDRIAN-CANON.md header;
#     canon moved to v1.23+ via Phases 190/195/210) that fails 3 of its 20
#     checks on a clean pre-223 tree. Verified pre-existing 2026-07-15
#     (223-01/223-02 deferred-items). A Phase-164 regression caused BY 223 is
#     still covered: the bono seams are exercised by test-223-hat-governance
#     and the shipped engines are asserted unmodified there.
#   - tests/test-219-banking.cjs Test 4 is NOT a leg: pre-existing Phase-224
#     edges-schema drift, verified failing identically against the pre-223 file.
#   - doctor --acceptance baseline {coverage-gate, verify-release-clean-tree}:
#     pre-existing, environment-driven; the leg passes iff the failing set is a
#     SUBSET of that baseline (a NEW failure still fails the leg).
#
# bash only. No network. No model downloads. No emoji. No em-dashes
# (CLAUDE.md HARD RULE). Hyphens only.

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
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Node proof legs (the five tests/test-223-*.cjs across Reqs 1-4).
# ---------------------------------------------------------------------------
run_if "223-01 hat-governance (Req 1 governed seams + heterogeneity + CR-01)" "tests/test-223-hat-governance.cjs" \
  node tests/test-223-hat-governance.cjs
run_if "223-01 part8-egress (persona research SIGNAL->LOCAL)" "tests/test-223-part8-egress.cjs" \
  node tests/test-223-part8-egress.cjs
run_if "223-02 close-loop (Req 4 D-01 dual store + D-02 proposed edges)" "tests/test-223-close-loop.cjs" \
  node tests/test-223-close-loop.cjs
run_if "223-02 supersedes-chain (Req 2 walker + D-04 NULL review_status)" "tests/test-223-supersedes-chain.cjs" \
  node tests/test-223-supersedes-chain.cjs
run_if "223-04 intel-pipeline (Req 3 dry-run + 3 gate halts + quality-low HALT)" "tests/test-223-intel-pipeline.cjs" \
  node tests/test-223-intel-pipeline.cjs

# ---------------------------------------------------------------------------
# The five phase-223 surfaces the constitutional sweeps pin.
# ---------------------------------------------------------------------------
HATGOV="lib/core/bono/hat-governance.cjs"
PERSONA="lib/core/bono/persona-research.cjs"
CLW="lib/core/close-loop-writer.cjs"
TOQ="lib/core/navigation/typed-open-question.cjs"
IPL="lib/core/intel-pipeline.cjs"

# (a) Part 8 sweep -- no network primitive on an executable line in any of the
#     five surfaces. A MISSING target fails the leg (never a silent skip).
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
echo "--- Part 8 sweep: no egress in the five phase-223 surfaces ---"
PART8_OK=1
for tgt in "$HATGOV" "$PERSONA" "$CLW" "$TOQ" "$IPL"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART8_OK=0
  elif strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"; PART8_OK=0
  fi
done
if [ "$PART8_OK" -eq 1 ]; then echo ">>> Part 8 sweep: PASSED"; PASS=$((PASS+1)); else echo ">>> Part 8 sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# (b) Part 9 sweep -- chokepoint-only writes:
#     (i)   consumer surfaces (hat-governance, persona-research,
#           close-loop-writer, intel-pipeline) hold NO raw INSERT INTO
#           edges/nodes and no node:sqlite / DatabaseSync token;
#     (ii)  close-loop-writer requires navigation.cjs (the chokepoint);
#     (iii) typed-open-question.cjs (chokepoint INTERNALS, navigation/ family,
#           typed-claim.cjs's sibling) may write nodes but NEVER edges.
echo "--- Part 9 sweep: chokepoint-only writes ---"
PART9_OK=1
for tgt in "$HATGOV" "$PERSONA" "$CLW" "$IPL"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART9_OK=0
  elif strip_comments "$tgt" | grep -niE "insert[[:space:]]+into[[:space:]]+(edges|nodes)|require\(['\"]node:sqlite|\bDatabaseSync\b" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db token on an executable line in: $tgt"; PART9_OK=0
  fi
done
if [ ! -f "$CLW" ]; then
  echo "    MISSING sweep target: $CLW"; PART9_OK=0
elif ! strip_comments "$CLW" | grep -qE "require\(['\"]\./navigation\.cjs['\"]\)"; then
  echo "    MISSING navigation.cjs chokepoint require in: $CLW"; PART9_OK=0
fi
if [ ! -f "$TOQ" ]; then
  echo "    MISSING sweep target: $TOQ"; PART9_OK=0
elif strip_comments "$TOQ" | grep -niE "insert[[:space:]]+into[[:space:]]+edges" >/dev/null 2>&1; then
  echo "    FORBIDDEN edge write in the typed-open-question node writer: $TOQ"; PART9_OK=0
fi
if [ "$PART9_OK" -eq 1 ]; then echo ">>> Part 9 sweep: PASSED"; PASS=$((PASS+1)); else echo ">>> Part 9 sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# (c) D-03 sweep -- intel-pipeline carries no retired compute path.
echo "--- D-03 sweep: no compute-hsi / python in intel-pipeline ---"
if [ ! -f "$IPL" ]; then
  echo "    MISSING sweep target: $IPL"; echo ">>> D-03 sweep: FAILED"; FAIL=$((FAIL+1))
elif strip_comments "$IPL" | grep -niE "compute-hsi|python|\.py\b" >/dev/null 2>&1; then
  echo "    FORBIDDEN retired-compute token on an executable line in: $IPL"; echo ">>> D-03 sweep: FAILED"; FAIL=$((FAIL+1))
else
  echo ">>> D-03 sweep: PASSED"; PASS=$((PASS+1))
fi
echo ""

# (d) Req 6 sweep -- the missing source dir is never referenced in shipped code.
echo "--- Req 6 sweep: zero mindrian-designs refs in shipped tree ---"
if grep -r "mindrian-designs" commands/ skills/ lib/core/bono/ >/dev/null 2>&1; then
  echo "    FORBIDDEN mindrian-designs reference found"; echo ">>> Req 6 sweep: FAILED"; FAIL=$((FAIL+1))
else
  echo ">>> Req 6 sweep: PASSED"; PASS=$((PASS+1))
fi
echo ""

# (e) DESENSITIZE asymmetry -- the mirror-generator convention is asserted,
#     never converged: command carries SENS-05, mirror carries [].
echo "--- DESENSITIZE asymmetry: bono command SENS-05 vs mirror [] ---"
DESENS_OK=1
grep -q "SENS-05" commands/bono.md 2>/dev/null || { echo "    commands/bono.md lost its SENS-05 sensor trigger"; DESENS_OK=0; }
grep -qE "sensor_triggers:[[:space:]]*\[\]" skills/bono/SKILL.md 2>/dev/null || { echo "    skills/bono/SKILL.md mirror lost its DESENSITIZED sensor_triggers: []"; DESENS_OK=0; }
if [ "$DESENS_OK" -eq 1 ]; then echo ">>> DESENSITIZE asymmetry: PASSED"; PASS=$((PASS+1)); else echo ">>> DESENSITIZE asymmetry: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# (f) Zero new dependencies.
echo "--- dependency-diff: package.json + package-lock.json unchanged ---"
if git diff --quiet package.json package-lock.json; then
  echo ">>> dependency-diff: PASSED"; PASS=$((PASS+1))
else
  echo "    package.json or package-lock.json drifted -- Phase 223 ships ZERO new deps"; echo ">>> dependency-diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# (g) Req 5 structural gates -- each its own leg so a failure names the gate.
run "Req 5 build-connector-registry --check" \
  node scripts/build-connector-registry.cjs --check
run "Req 5 check-shape-declaration (advisory, no --strict)" \
  node scripts/check-shape-declaration.cjs --check
run "Req 5 build-orchestration-projection --check" \
  node scripts/build-orchestration-projection.cjs --check
run "Req 5 check-render-coverage" \
  node scripts/check-render-coverage.cjs

# doctor --acceptance: no-new-regression subset check against the documented
# environmental baseline (coverage-gate, verify-release-clean-tree).
doctor_acceptance_no_new_regression() {
  local out new_regression=0
  out=$(node scripts/doctor.cjs --acceptance 2>&1)
  # Parse the summary line "...; failed: a, b, c." -- far more robust than
  # scraping per-row FAIL lines.
  local failing
  failing=$(printf '%s\n' "$out" | grep -oE 'failed: [a-z0-9, -]+' | tail -1 | sed 's/^failed: //; s/,/ /g')
  for tok in $failing; do
    case "$tok" in
      coverage-gate|verify-release-clean-tree) : ;;
      activation-reached-the-wire)
        # Environment-driven flake: the L4 MCP stdio handshake times out under
        # heavy machine load (10s budget). Retry it once in isolation before
        # calling it a regression; only a REPRODUCED failure fails the leg.
        if node scripts/doctor.cjs --acceptance 2>&1 | grep -oE 'failed: [a-z0-9, -]+' | tail -1 | grep -q 'activation-reached-the-wire'; then
          echo "    doctor --acceptance: activation-reached-the-wire failed twice (not a flake)"; new_regression=1
        else
          echo "    doctor --acceptance: activation-reached-the-wire passed on retry (load flake, excused)"
        fi ;;
      ''|' ') : ;;
      *)
        echo "    doctor --acceptance: NEW acceptance regression: $tok"; new_regression=1 ;;
    esac
  done
  return "$new_regression"
}
run "Req 5 doctor --acceptance (no-new-regression vs documented baseline)" \
  doctor_acceptance_no_new_regression

# (h) No-regression legs: the Phase-224 gate (shared edges/derivation path) and
#     the Phase-169 derive queue round-trip contract.
run_if "no-regression: run-all-224.sh (graph-derivation phase gate)" "tests/run-all-224.sh" \
  bash tests/run-all-224.sh
run_if "no-regression: test-graph-derive-sweep (Phase-169 queue contract)" "tests/test-graph-derive-sweep.cjs" \
  node tests/test-graph-derive-sweep.cjs

echo "======================================"
echo "Phase 223: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
