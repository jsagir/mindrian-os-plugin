#!/usr/bin/env bash
# Phase 224 verification aggregator -- the ONE-COMMAND PASS/FAIL/SKIP gate for
# the graph-derivation harness (room.db's typed-node derivation: normal prose
# writes now derive proposed CONVERGES/INFORMS edges through the navigation
# chokepoint, disclosed-not-guessed when the encoder is missing). Mirrors
# tests/run-all-222.sh's run/run_if aggregator shape and tests/run-all-158.sh's
# comment-stripped grep-sweep legs.
#
# The two-part contract this gate proves (all legs green = the phase gate):
#   (1) Every per-plan node proof (the eight tests/test-224-*.cjs legs across
#       Reqs 1-4, 6) passes as a run_if-guarded leg, partial-landing safe.
#   (2) The phase's constitutional constraints are PERMANENT tripwires, not
#       one-time reviews:
#         - Part 8 (Req 5, no egress in the five new derivation surfaces): a
#           comment-stripped fetch/http/curl/wget sweep over all five files.
#         - Part 9 (chokepoint-only edge writes): the classifier holds NO
#           direct-db token, drain + backfill hold NO raw INSERT INTO edges,
#           and graph-derivation.cjs still requires navigation.cjs (edge writes
#           ride navigation.writeEdge only).
#         - Req 4 (zero new dependencies): a git-diff leg on package.json /
#           package-lock.json fails the harness on any drift.
#         - Req 7 structural gates: build-connector-registry --check,
#           check-shape-declaration --check (advisory-WARN as of Phase 210, run
#           WITHOUT --strict), and a doctor --acceptance no-new-regression leg.
#
# Comment lines are stripped BEFORE every grep so header prose mentioning
# fetch/sqlite/INSERT never trips OR masks a gate (the run-all-158.sh
# grep-gate-hygiene idiom; run-all-222.sh:49-53).
#
# DELIBERATE doctor --acceptance handling (the run-all-217.sh written-reason
# idiom): doctor --acceptance carries TWO pre-existing, environment-driven gate
# gaps that Phase 224 neither caused nor can clear -- coverage-gate (the
# skill-mirrors sub-gate) and verify-release-clean-tree (a dirty working tree is
# inherent to running mid-development). The doctor leg therefore PASSES iff the
# reported failing-gate set is a SUBSET of that documented baseline; a NEW
# acceptance failure fails the leg. This catches regressions without a
# pre-existing environmental gap defeating the whole harness (additional_notes:
# "pre-existing documented gaps are acceptable per repo convention; new
# regressions are not").
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

# Strip whole-line comments (// or block-comment body lines starting with
# optional whitespace then // or * or /*) so header prose never trips a grep.
strip_comments() {
  grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Node proof legs (the eight tests/test-224-*.cjs across Reqs 1-4, 6). Each is
# run_if-guarded on its file so a partially-landed phase exits cleanly with
# SKIPs rather than a crash.
# ---------------------------------------------------------------------------
run_if "224-01 migration (Req 4 review_status column + writeEdge)" "tests/test-224-migration.cjs" \
  node tests/test-224-migration.cjs
run_if "224-01 classifier (Req 2 D-01 CONVERGES/INFORMS-only)" "tests/test-224-classifier.cjs" \
  node tests/test-224-classifier.cjs
run_if "224-02 encoder-skip (D-04 disclose-not-guess)" "tests/test-224-encoder-skip.cjs" \
  node tests/test-224-encoder-skip.cjs
run_if "224-02 per-write-derive (Req 1 cascade Step 2b)" "tests/test-224-per-write-derive.cjs" \
  node tests/test-224-per-write-derive.cjs
run_if "224-02 cost-bound (Req 6 O(n) new-vs-existing)" "tests/test-224-cost-bound.cjs" \
  node tests/test-224-cost-bound.cjs
run_if "224-03 backfill-idempotent (Req 2 deriver swap + Ralph)" "tests/test-224-backfill-idempotent.cjs" \
  node tests/test-224-backfill-idempotent.cjs
run_if "224-03 resolver-fallback (Req 3 canonical resolveWriteRoom)" "tests/test-224-resolver-fallback.cjs" \
  node tests/test-224-resolver-fallback.cjs
run_if "224-03 proposed-only (Req 4 no auto-confirm)" "tests/test-224-proposed-only.cjs" \
  node tests/test-224-proposed-only.cjs

# ---------------------------------------------------------------------------
# The five phase-224 derivation surfaces the constitutional sweeps pin.
# ---------------------------------------------------------------------------
CLASSIFIER="lib/core/graph-derive-classifier.cjs"
MIGRATION="lib/core/migrations/phase-224-edge-review-status.cjs"
DRAIN="scripts/gsd-graph-derive-drain.cjs"
SWEEP="scripts/gsd-graph-derive-sweep.cjs"
BACKFILL="lib/core/graph-backfill.cjs"
DERIVATION="lib/core/graph-derivation.cjs"

# ---------------------------------------------------------------------------
# (a) Part 8 sweep (Req 5) -- NONE of the five new derivation surfaces may hold a
#     network primitive: fetch(, an http/https URL scheme, a require of
#     node:http / node:https, or a network-capable child_process call (curl /
#     wget). Comment lines stripped first; a MISSING target fails the leg (never
#     a silent skip) per T-224-15.
# ---------------------------------------------------------------------------
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
echo "--- Part 8 sweep (Req 5): no egress in the five derivation surfaces ---"
PART8_OK=1
for tgt in "$CLASSIFIER" "$MIGRATION" "$DRAIN" "$SWEEP" "$BACKFILL"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART8_OK=0
  elif strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"; PART8_OK=0
  fi
done
if [ "$PART8_OK" -eq 1 ]; then echo ">>> Part 8 sweep (Req 5): PASSED"; PASS=$((PASS+1)); else echo ">>> Part 8 sweep (Req 5): FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# ---------------------------------------------------------------------------
# (b) Part 9 sweep -- edge writes ride the navigation.cjs chokepoint ONLY:
#     (i)   the classifier holds NO node:sqlite / DatabaseSync / raw INSERT INTO
#           edges token (it is pure classification + fs enumeration);
#     (ii)  the drain and the backfill hold NO raw INSERT INTO edges token
#           (they write edges only via graph-derivation -> navigation.writeEdge);
#     (iii) graph-derivation.cjs still requires navigation.cjs (the chokepoint).
#     Comment lines stripped first; a MISSING target fails the leg.
# ---------------------------------------------------------------------------
echo "--- Part 9 sweep: chokepoint-only edge writes ---"
PART9_OK=1
if [ ! -f "$CLASSIFIER" ]; then
  echo "    MISSING sweep target: $CLASSIFIER"; PART9_OK=0
elif strip_comments "$CLASSIFIER" | grep -niE "require\(['\"]node:sqlite|\bDatabaseSync\b|insert[[:space:]]+into[[:space:]]+edges" >/dev/null 2>&1; then
  echo "    FORBIDDEN direct-db token on an executable line in: $CLASSIFIER"; PART9_OK=0
fi
for tgt in "$DRAIN" "$BACKFILL"; do
  if [ ! -f "$tgt" ]; then
    echo "    MISSING sweep target: $tgt"; PART9_OK=0
  elif strip_comments "$tgt" | grep -niE "insert[[:space:]]+into[[:space:]]+edges" >/dev/null 2>&1; then
    echo "    FORBIDDEN raw INSERT INTO edges on an executable line in: $tgt"; PART9_OK=0
  fi
done
if [ ! -f "$DERIVATION" ]; then
  echo "    MISSING sweep target: $DERIVATION"; PART9_OK=0
elif ! strip_comments "$DERIVATION" | grep -qE "require\(['\"]\./navigation\.cjs['\"]\)"; then
  echo "    MISSING navigation.cjs chokepoint require in: $DERIVATION"; PART9_OK=0
fi
if [ "$PART9_OK" -eq 1 ]; then echo ">>> Part 9 sweep: PASSED"; PASS=$((PASS+1)); else echo ">>> Part 9 sweep: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

# ---------------------------------------------------------------------------
# (c) Req 4 dependency-diff leg -- package.json / package-lock.json must not have
#     drifted. Fails the harness if either changed (zero new dependencies).
# ---------------------------------------------------------------------------
echo "--- Req 4 dependency-diff: package.json + package-lock.json unchanged ---"
if git diff --quiet package.json package-lock.json; then
  echo ">>> Req 4 dependency-diff: PASSED"; PASS=$((PASS+1))
else
  echo "    package.json or package-lock.json drifted -- Phase 224 ships ZERO new deps"; echo ">>> Req 4 dependency-diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# (d) Req 7 structural gates -- each its own leg so a failure names the gate.
#     build-connector-registry --check and check-shape-declaration --check are
#     hard exit-0 gates (the latter runs WITHOUT --strict: advisory-WARN as of
#     Phase 210 / CLAUDE.md Part 11, so a WARN is exit 0). doctor --acceptance is
#     a no-new-regression subset check (see the header note).
# ---------------------------------------------------------------------------
run "Req 7 build-connector-registry --check" \
  node scripts/build-connector-registry.cjs --check
run "Req 7 check-shape-declaration --check (advisory-WARN, no --strict)" \
  node scripts/check-shape-declaration.cjs --check

# doctor --acceptance no-new-regression leg. Passes iff the reported failing-gate
# set is a subset of the documented baseline {coverage-gate,
# verify-release-clean-tree}.
doctor_acceptance_no_new_regression() {
  local out failed_line tok
  out="$(node scripts/doctor.cjs --acceptance 2>&1)"
  # The roll-up line reads: "Acceptance full: X/Y points passed; failed: a, b."
  failed_line="$(printf '%s\n' "$out" | grep -iE 'failed:' | tail -n 1)"
  if [ -z "$failed_line" ]; then
    echo "    doctor --acceptance: all points passed (no failed: line)"
    return 0
  fi
  # Extract the comma-list after "failed:" and trim the trailing period.
  local list
  list="$(printf '%s\n' "$failed_line" | sed -E 's/.*failed:[[:space:]]*//; s/\.[[:space:]]*$//')"
  local new_regression=0
  local IFS=','
  for tok in $list; do
    tok="$(printf '%s' "$tok" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    [ -z "$tok" ] && continue
    case "$tok" in
      coverage-gate|verify-release-clean-tree)
        echo "    doctor --acceptance: known pre-existing gap (baseline): $tok" ;;
      *)
        echo "    doctor --acceptance: NEW acceptance regression: $tok"; new_regression=1 ;;
    esac
  done
  return "$new_regression"
}
run "Req 7 doctor --acceptance (no-new-regression vs documented baseline)" \
  doctor_acceptance_no_new_regression

# ---------------------------------------------------------------------------
# (e) No-regression legs (224-VALIDATION pre-verify contract): the reach-ranking
#     phase gate, the shared room.db write-safety path (Phase 218), and the
#     Phase-169 derive queue round-trip contract.
# ---------------------------------------------------------------------------
run_if "no-regression: run-all-222.sh (reach-ranking phase gate)" "tests/run-all-222.sh" \
  bash tests/run-all-222.sh
run_if "no-regression: test-218-write-safety (shared room.db write path)" "tests/test-218-write-safety.cjs" \
  node tests/test-218-write-safety.cjs
run_if "no-regression: test-graph-derive-sweep (Phase-169 queue contract)" "tests/test-graph-derive-sweep.cjs" \
  node tests/test-graph-derive-sweep.cjs

echo "======================================"
echo "Phase 224: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
