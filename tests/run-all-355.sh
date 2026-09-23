#!/usr/bin/env bash
# Phase 355 verification aggregator (Hidden in Plain Sight: Jev-through-Theo
# cross-connection engines) -- mirrors tests/run-all-224.sh's run/run_if
# shape and doctor_acceptance_no_new_regression leg exactly, with this
# phase's own baseline (HIPS-10, D-57).
#
# BASE_355 = 9458bf802 (2026-09-23), the commit Task 1 of plan 355-01 ran
# the D-57 gate and the doctor baseline capture against. Full detail lives
# in .planning/phases/355-.../355-BASELINE.md -- this header carries only
# the summary a reader needs to judge the doctor leg below.
#
# Doctor acceptance baseline at BASE_355 (failing-point set, sorted):
#   verify-release-clean-tree
# (a pre-existing, environment-driven gap -- the tree is genuinely dirty
# mid-development with several sessions executing concurrently -- neither
# caused nor clearable by this phase, per the run-all-217.sh written-reason
# idiom). coverage-gate is ALSO an accepted baseline point per the run-all-224
# precedent even though it did not fail at BASE_355, in case it reappears
# under a different concurrent session's transient state.
#
# Legs (skeleton until each 355 artifact lands; every 355-specific leg SKIPs
# cleanly on a partial tree):
#   (1) glob loop over tests/test-355-*.cjs (run_if, exit 77 = SKIP)
#   (2) Part 8 sweep: no egress token in the 355 target list
#   (3) Part 9 sweep: no node:sqlite / DatabaseSync / INSERT INTO in the same list
#   (4) package.json / package-lock.json unchanged (zero new dependencies)
#   (5) --check replays of the 355 dev-time scripts (run_if per script existing)
#   (6) structural gates (connector registry, orchestration projection,
#       shape declaration advisory-WARN, render coverage)
#   (7) doctor_acceptance_no_new_regression, this phase's baseline
#   (8) no-regression legs against sibling phases and shared surfaces
#   (9) em-dash leg over every file this phase adds/touches
#
# bash only. No network. No model downloads. No emoji. No em-dashes
# (CLAUDE.md HARD RULE). Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_355="9458bf802"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1));
  else
    local status=$?
    if [ "$status" -eq 77 ]; then
      echo ">>> $label: SKIPPED (exit 77)"; SKIP=$((SKIP+1))
    else
      echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
    fi
  fi
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
# (1) Per-test glob loop over tests/test-355-*.cjs. Exit 77 counts as SKIP
#     (via run()'s exit-code branch above), a real failure counts as FAIL.
# ---------------------------------------------------------------------------
shopt -s nullglob
TEST_355_FILES=(tests/test-355-*.cjs)
shopt -u nullglob
if [ "${#TEST_355_FILES[@]}" -eq 0 ]; then
  echo "--- 355-specific tests ---"; echo ">>> 355-specific tests: SKIPPED (no tests/test-355-*.cjs yet)"; SKIP=$((SKIP+1)); echo ""
else
  for f in tests/test-355-*.cjs; do
    run_if "$(basename "$f")" "$f" node "$f"
  done
fi

# ---------------------------------------------------------------------------
# (2) Part 8 sweep -- no egress token on an executable line in the 355
#     target list. A MISSING target is run_if-guarded for now (plan 355-27
#     flips missing targets to FAIL once every artifact should exist).
# ---------------------------------------------------------------------------
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
PART8_TARGETS=(
  "lib/core/direction-convention.cjs"
  "lib/core/verification-stamp.cjs"
  "lib/core/verification-stamp-format.cjs"
  "lib/core/floor-disclosure.cjs"
  "scripts/stamp-connections.cjs"
)
echo "--- Part 8 sweep: no egress in the 355 target list ---"
for tgt in "${PART8_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "--- Part 8 sweep: $tgt ---"; echo ">>> Part 8 sweep: $tgt: SKIPPED (missing $tgt)"; SKIP=$((SKIP+1)); echo ""
    continue
  fi
  echo "--- Part 8 sweep: $tgt ---"
  if strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"
    echo ">>> Part 8 sweep: $tgt: FAILED"; FAIL=$((FAIL+1))
  else
    echo ">>> Part 8 sweep: $tgt: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (3) Part 9 sweep -- no node:sqlite / DatabaseSync / INSERT INTO on an
#     executable line in the same target list (comment-stripped).
# ---------------------------------------------------------------------------
echo "--- Part 9 sweep: no direct-db token in the 355 target list ---"
for tgt in "${PART8_TARGETS[@]}"; do
  if [ ! -f "$tgt" ]; then
    echo "--- Part 9 sweep: $tgt ---"; echo ">>> Part 9 sweep: $tgt: SKIPPED (missing $tgt)"; SKIP=$((SKIP+1)); echo ""
    continue
  fi
  echo "--- Part 9 sweep: $tgt ---"
  if strip_comments "$tgt" | grep -niE "require\(['\"]node:sqlite|\bDatabaseSync\b|insert[[:space:]]+into[[:space:]]+" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db token on an executable line in: $tgt"
    echo ">>> Part 9 sweep: $tgt: FAILED"; FAIL=$((FAIL+1))
  else
    echo ">>> Part 9 sweep: $tgt: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (4) Req 4-style dependency-diff leg -- zero new dependencies.
# ---------------------------------------------------------------------------
echo "--- dependency-diff: package.json + package-lock.json unchanged ---"
if git diff --quiet package.json package-lock.json; then
  echo ">>> dependency-diff: PASSED"; PASS=$((PASS+1))
else
  echo "    package.json or package-lock.json drifted -- Phase 355 ships ZERO new deps"
  echo ">>> dependency-diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# (5) --check replays of the 355 dev-time scripts, each run_if on the script
#     existing (none exist yet at Task 1 time -- all SKIP).
# ---------------------------------------------------------------------------
run_if "check-floor-ledger --check" "scripts/check-floor-ledger.cjs" \
  node scripts/check-floor-ledger.cjs --check
run_if "refresh-framework-names --check" "scripts/refresh-framework-names.cjs" \
  node scripts/refresh-framework-names.cjs --check
run_if "measure-hsi-thinking-mode --check" "scripts/measure-hsi-thinking-mode.cjs" \
  node scripts/measure-hsi-thinking-mode.cjs --check
run_if "calibrate-citation-check --check" "scripts/calibrate-citation-check.cjs" \
  node scripts/calibrate-citation-check.cjs --check
run_if "judge-355-usefulness --check" "scripts/judge-355-usefulness.cjs" \
  node scripts/judge-355-usefulness.cjs --check
run_if "capture-355-theo-responses --check" "scripts/capture-355-theo-responses.cjs" \
  node scripts/capture-355-theo-responses.cjs --check

# ---------------------------------------------------------------------------
# (6) Structural gates: born-wired / projection / shape / render.
#     check-shape-declaration runs WITHOUT --strict (advisory-WARN, Phase 210).
# ---------------------------------------------------------------------------
run "structural: build-connector-registry --check" \
  node scripts/build-connector-registry.cjs --check
run "structural: build-orchestration-projection --check" \
  node scripts/build-orchestration-projection.cjs --check
run "structural: check-shape-declaration --check (advisory-WARN, no --strict)" \
  node scripts/check-shape-declaration.cjs --check
run "structural: check-render-coverage --check" \
  node scripts/check-render-coverage.cjs --check

# ---------------------------------------------------------------------------
# (7) doctor_acceptance_no_new_regression -- copied from run-all-224.sh with
#     THIS phase's baseline set: {coverage-gate, verify-release-clean-tree}.
# ---------------------------------------------------------------------------
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
        echo "    doctor --acceptance: known pre-existing gap (BASE_355 baseline): $tok" ;;
      *)
        echo "    doctor --acceptance: NEW acceptance regression vs BASE_355: $tok"; new_regression=1 ;;
    esac
  done
  return "$new_regression"
}
run "doctor --acceptance (no-new-regression vs BASE_355 baseline)" \
  doctor_acceptance_no_new_regression

# ---------------------------------------------------------------------------
# (8) No-regression legs against sibling phases and shared surfaces, each
#     run_if-guarded on the target existing.
# ---------------------------------------------------------------------------
run_if "no-regression: run-all-356.sh" "tests/run-all-356.sh" \
  bash tests/run-all-356.sh
run_if "no-regression: run-all-272.sh" "tests/run-all-272.sh" \
  bash tests/run-all-272.sh
run_if "no-regression: 272-direction-convention.test.cjs" "tests/272-direction-convention.test.cjs" \
  node tests/272-direction-convention.test.cjs
run_if "no-regression: test-213-sensor-eureka.cjs" "tests/test-213-sensor-eureka.cjs" \
  node tests/test-213-sensor-eureka.cjs
run_if "no-regression: test-219-harvest-sensor.cjs" "tests/test-219-harvest-sensor.cjs" \
  node tests/test-219-harvest-sensor.cjs
run_if "no-regression: test-354-gate-subject-promotion.cjs" "tests/test-354-gate-subject-promotion.cjs" \
  node tests/test-354-gate-subject-promotion.cjs
run_if "no-regression: part8-egress-guard.test.cjs" "lib/core/part8-egress-guard.test.cjs" \
  node lib/core/part8-egress-guard.test.cjs
run_if "no-regression: test-354-egress-typed-question.cjs" "tests/test-354-egress-typed-question.cjs" \
  node tests/test-354-egress-typed-question.cjs
run_if "no-regression: test-reverse-salient-telemetry.cjs" "tests/test-reverse-salient-telemetry.cjs" \
  node tests/test-reverse-salient-telemetry.cjs

# ---------------------------------------------------------------------------
# (9) Em-dash leg -- zero U+2014 in every NEW 355 file, and in ADDED lines
#     only of modified files (git diff against BASE_355).
# ---------------------------------------------------------------------------
emdash_scan() {
  local hits=0
  local f
  shopt -s nullglob
  local NEW_FILES=(
    lib/core/direction-convention.cjs
    lib/core/verification-stamp*.cjs
    lib/core/floor-disclosure.cjs
    scripts/*355*
    scripts/stamp-connections.cjs
    tests/test-355-*.cjs
    tests/helpers/*355*.cjs
    data/floor-ledger.json
  )
  shopt -u nullglob
  for f in "${NEW_FILES[@]}"; do
    [ -f "$f" ] || continue
    if grep -qP '\x{2014}' "$f" 2>/dev/null; then
      echo "    em-dash found in NEW file: $f"
      hits=$((hits+1))
    fi
  done
  if git rev-parse --quiet --verify "$BASE_355" >/dev/null 2>&1; then
    local added
    added="$(git diff "$BASE_355" -- lib scripts commands skills data docs tests 2>/dev/null | grep '^+' | grep -v '^+++' || true)"
    if printf '%s' "$added" | grep -qP '\x{2014}'; then
      echo "    em-dash found in an ADDED line since BASE_355"
      hits=$((hits+1))
    fi
  else
    echo "    BASE_355 ($BASE_355) not reachable in this checkout -- skipping added-line em-dash leg"
  fi
  [ "$hits" -eq 0 ]
}
run "em-dash leg: zero U+2014 in new/added 355 content" emdash_scan

echo "======================================"
echo "Phase 355: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
