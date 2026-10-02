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
# Plan 355-27 (HIPS-10, SPEC AC13) note: a live doctor --acceptance run during
# this plan's own execution (2026-09-25) additionally surfaced
# `icm-ruling-eval-fresh` FAILING ("plugin_version has fallen more than one
# release behind") -- NOT present in the BASE_355 baseline above. Root cause:
# concurrent peer sessions in this shared tree cut plugin releases
# (v2.0.0-beta.49, v2.0.0-beta.50) past evals/icm/last-run.json's stamped
# 2.0.0-beta.48 without re-running the eval that refreshes it. That eval
# (`scripts/eval-icm-writers.cjs`) is Phase 353/356 peer territory --
# confirmed peer-owned by 355-BASELINE.md's own D-57 gate sweep -- and the
# SAME root cause (`plugin_version drift: ledger=2.0.0-beta.48
# repo=2.0.0-beta.50`) independently fails tests/run-all-353.sh's own
# `section-command-ledger` leg live today, even though tests/run-all-353.sh
# was recorded green (PASS=22 FAIL=0) at Phase 353's own close-out, before
# BASE_355. Per this plan's own action text ("never re-baseline"), this leg
# below is NOT added to the accepted doctor baseline set -- the gap is real,
# named here, and left FAILING so the gate stays honest; it is not caused by,
# or fixable within, any Phase 355 file. tests/run-all-353.sh is likewise NOT
# added to the no-regression legs in section (8) below for the same reason
# (see that leg's own comment).
#
# Legs (every 355-specific leg SKIPs cleanly on a partial tree):
#   (1) glob loop over tests/test-355-*.cjs (run_if, exit 77 = SKIP)
#   (2) Part 8 sweep: no egress token in the 355 target list (hard `run`,
#       a missing target FAILS -- HIPS-10, plan 355-27)
#   (3) Part 9 sweep: no node:sqlite / DatabaseSync / INSERT INTO in the same
#       list (hard `run`), plus the navigation-chokepoint check on
#       lib/core/research-planner/filing-stamped.cjs (the one stamped filer
#       since Phase 366-27 retired the standalone runner; still requires
#       navigation.cjs, the one write door) and
#       lib/core/eureka/opportunity-harvest.cjs (still zero
#       INSERT/UPDATE/DELETE -- read-only by contract)
#   (4) package.json / package-lock.json unchanged (zero new dependencies)
#   (5) --check replays of the 355 dev-time scripts (run_if per script existing)
#   (6) structural gates (connector registry, orchestration projection,
#       shape declaration advisory-WARN, render coverage)
#   (7) doctor_acceptance_no_new_regression, this phase's baseline (never
#       re-baselined by plan 355-27; see the icm-ruling-eval-fresh note above)
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
#     target list. HARD `run` as of plan 355-27 (HIPS-10): every target below
#     must exist on disk now that the phase is closing; a MISSING target
#     FAILS the leg instead of skipping.
# ---------------------------------------------------------------------------
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
PART8_TARGETS=(
  "lib/core/direction-convention.cjs"
  "lib/core/verification-stamp.cjs"
  "lib/core/verification-stamp-format.cjs"
  "lib/core/floor-disclosure.cjs"
  "scripts/stamp-connections.cjs"
  "scripts/check-cross-connection-honesty.cjs"
)
part8_sweep_one() {
  local tgt="$1"
  if [ ! -f "$tgt" ]; then
    echo "    MISSING 355 target (HIPS-10 hard gate): $tgt"
    return 1
  fi
  if strip_comments "$tgt" | grep -nE "$PART8_RE" >/dev/null 2>&1; then
    echo "    FORBIDDEN egress token on an executable line in: $tgt"
    return 1
  fi
  return 0
}
echo "--- Part 8 sweep: no egress in the 355 target list (hard gate) ---"
for tgt in "${PART8_TARGETS[@]}"; do
  run "Part 8 sweep: $tgt" part8_sweep_one "$tgt"
done

# ---------------------------------------------------------------------------
# (3) Part 9 sweep -- no node:sqlite / DatabaseSync / INSERT INTO on an
#     executable line in the same target list (comment-stripped). HARD `run`
#     as of plan 355-27 (HIPS-10): a missing target FAILS the leg.
# ---------------------------------------------------------------------------
part9_sweep_one() {
  local tgt="$1"
  if [ ! -f "$tgt" ]; then
    echo "    MISSING 355 target (HIPS-10 hard gate): $tgt"
    return 1
  fi
  if strip_comments "$tgt" | grep -niE "require\(['\"]node:sqlite|\bDatabaseSync\b|insert[[:space:]]+into[[:space:]]+" >/dev/null 2>&1; then
    echo "    FORBIDDEN direct-db token on an executable line in: $tgt"
    return 1
  fi
  return 0
}
echo "--- Part 9 sweep: no direct-db token in the 355 target list (hard gate) ---"
for tgt in "${PART8_TARGETS[@]}"; do
  run "Part 9 sweep: $tgt" part9_sweep_one "$tgt"
done

# ---------------------------------------------------------------------------
# (3b) Part 9 navigation-chokepoint check (plan 355-27, HIPS-02/HIPS-04): the
#      two banking-adjacent files still route every write through
#      lib/core/navigation.cjs, the one SQL write door (architecture.md).
#      Phase 366-27 retargeted the first leg: the standalone runner that
#      banked findings is retired, and the stamped opportunity mutation now
#      lives in lib/core/research-planner/filing-stamped.cjs
#      (fileStampedOpportunity), which must still `require` navigation.cjs;
#      lib/core/eureka/opportunity-harvest.cjs is READ-ONLY BY CONTRACT
#      (T-219-10, its own docstring) and must carry zero INSERT/UPDATE/DELETE
#      on an executable line, exactly like the Part 9 sweep above.
# ---------------------------------------------------------------------------
echo "--- Part 9 navigation chokepoint: filing-stamped.cjs + opportunity-harvest.cjs ---"
nav_chokepoint_report() {
  local tgt="lib/core/research-planner/filing-stamped.cjs"
  if [ ! -f "$tgt" ]; then echo "    MISSING: $tgt"; return 1; fi
  if strip_comments "$tgt" | grep -nE "require\(.*navigation\.cjs" >/dev/null 2>&1; then
    return 0
  fi
  echo "    $tgt no longer requires navigation.cjs -- the stamped filing write path may have bypassed the chokepoint"
  return 1
}
run "Part 9 navigation chokepoint: filing-stamped.cjs requires navigation.cjs" nav_chokepoint_report
nav_chokepoint_harvest() {
  local tgt="lib/core/eureka/opportunity-harvest.cjs"
  if [ ! -f "$tgt" ]; then echo "    MISSING: $tgt"; return 1; fi
  if strip_comments "$tgt" | grep -niE "insert[[:space:]]+into[[:space:]]+|update[[:space:]]+\w+[[:space:]]+set[[:space:]]+|delete[[:space:]]+from[[:space:]]+" >/dev/null 2>&1; then
    echo "    $tgt carries a direct write statement -- no longer read-only by contract (T-219-10)"
    return 1
  fi
  return 0
}
run "Part 9 navigation chokepoint: opportunity-harvest.cjs stays read-only (zero direct writes)" nav_chokepoint_harvest

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

# Plan 355-27 (HIPS-01) amended-test no-regression legs: the tests earlier
# 355 plans edited in place (direction fixtures swapped, D-47 flip, D-07
# re-derivation) rather than authoring a new tests/test-355-*.cjs file.
run_if "no-regression: 272-hsi-lsa-algorithm.test.cjs" "tests/272-hsi-lsa-algorithm.test.cjs" \
  node tests/272-hsi-lsa-algorithm.test.cjs
run_if "no-regression: test-211-measured-differential.cjs" "tests/test-211-measured-differential.cjs" \
  node tests/test-211-measured-differential.cjs
run_if "no-regression: test-215-score.cjs" "tests/test-215-score.cjs" \
  node tests/test-215-score.cjs
run_if "no-regression: test-213-part8-boundary.cjs" "tests/test-213-part8-boundary.cjs" \
  node tests/test-213-part8-boundary.cjs
run_if "no-regression: test-scout-cadence-fires.cjs" "tests/test-scout-cadence-fires.cjs" \
  node tests/test-scout-cadence-fires.cjs
run_if "no-regression: test-dial-label-bank-drift.cjs" "tests/test-dial-label-bank-drift.cjs" \
  node tests/test-dial-label-bank-drift.cjs
run_if "no-regression: lib/memory/test-rs-innovation-classifier.cjs" "lib/memory/test-rs-innovation-classifier.cjs" \
  node lib/memory/test-rs-innovation-classifier.cjs

# tests/run-all-353.sh is deliberately NOT added here. It was recorded green
# (PASS=22 FAIL=0 SKIP=0) at Phase 353's own close-out (355-VERIFICATION.md
# precedent: 353-VERIFICATION.md, 2026-09-17, before BASE_355) and the file
# itself is unchanged since (git-stash-free evidence: the file's last commit
# is an ancestor of BASE_355). But a live re-run during this plan's own
# execution (2026-09-25) shows it FAILING today
# (`section-command-ledger: FAILED (plugin_version drift: ledger=2.0.0-beta.48
# repo=2.0.0-beta.50)`) -- the identical environment-driven version-lockstep
# gap documented in this file's header for doctor's `icm-ruling-eval-fresh`
# point, caused by concurrent peer sessions cutting plugin releases past the
# ledger's stamped version, not by any Phase 355 file. Adding a leg that is
# known to fail today for a reason wholly outside this phase's scope would
# conflate that drift with 355's own proof, so it stays excluded; see the
# header note above for the full account.

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
