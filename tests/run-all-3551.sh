#!/usr/bin/env bash
# Phase 355.1 verification aggregator (Ambient trigger: the room starts the
# breakthrough run) -- mirrors tests/run-all-355.sh's run/run_if shape and
# doctor_acceptance_no_new_regression leg exactly, with this phase's own
# baseline (355.1-BASELINE.md).
#
# BASE_3551 = 6e0401525 (2026-09-25), the commit Task 1 of plan 355.1-01 ran
# the gate and the doctor baseline capture against. Full detail lives in
# .planning/phases/355.1-.../355.1-BASELINE.md -- this header carries only
# the summary a reader needs to judge the doctor leg below.
#
# Doctor acceptance baseline at BASE_3551 (failing-point set, sorted):
#   icm-ruling-eval-fresh, verify-release-clean-tree
# (both inherited unchanged from 355-27's own note in tests/run-all-355.sh:
# concurrent peer sessions in this shared tree drive both gaps, neither
# caused by, or fixable within, any Phase 355 or 355.1 file. Never
# re-baselined here; see 355.1-BASELINE.md's "Doctor acceptance baseline"
# section for the full account.)
#
# Measured Phase 117 child runtime at BASE_3551 (355.1-BASELINE.md): n=134,
# p50=8.31s, p90=11.25s, max=19.40s (fresh sample; research's own recorded
# max was 166s and the ambient mode's time budget is derived against that
# wider figure, not this narrower fresh sample).
#
# Legs (every 355.1-specific leg SKIPs cleanly on a partial tree, per plan
# 355.1-01's SKELETON task; later 355.1 plans flip the run_if-guarded legs to
# hard `run` once each target exists on disk, the 355-27 precedent):
#   (1) glob loop over tests/test-3551-*.cjs (run_if, exit 77 = SKIP)
#   (2) Part 8 sweep: no egress token in the 355.1 target list (run_if per
#       target existing -- none but the two EXTENDED files exist yet)
#   (3) Part 9 sweep: no node:sqlite / DatabaseSync / INSERT INTO in the
#       same target list (run_if per target existing)
#   (4) package.json / package-lock.json unchanged (zero new dependencies)
#   (5) check-floor-ledger --check
#   (6) structural gates (connector registry, orchestration projection,
#       shape declaration advisory-WARN, render coverage, CIRS declaration
#       over every existing 355.1-*-PLAN.md)
#   (7) doctor_acceptance_no_new_regression, this phase's baseline
#   (8) no-regression legs against sibling phases and shared surfaces
#   (9) em-dash leg over every file this phase adds/touches
#   (10) glob-collision guard: tests/test-355-1-*.cjs must match nothing
#        (the decimal form would collide with run-all-355.sh's own glob)
#
# bash only. No network. No model downloads. No emoji. No em-dashes
# (CLAUDE.md HARD RULE). Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_3551="6e0401525"

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
# (1) Per-test glob loop over tests/test-3551-*.cjs. Exit 77 counts as SKIP
#     (via run()'s exit-code branch above), a real failure counts as FAIL.
# ---------------------------------------------------------------------------
shopt -s nullglob
TEST_3551_FILES=(tests/test-3551-*.cjs)
shopt -u nullglob
if [ "${#TEST_3551_FILES[@]}" -eq 0 ]; then
  echo "--- 355.1-specific tests ---"; echo ">>> 355.1-specific tests: SKIPPED (no tests/test-3551-*.cjs yet)"; SKIP=$((SKIP+1)); echo ""
else
  for f in tests/test-3551-*.cjs; do
    run_if "$(basename "$f")" "$f" node "$f"
  done
fi

# ---------------------------------------------------------------------------
# (2) Part 8 sweep -- no egress token on an executable line in the 355.1
#     target list. run_if per target: a MISSING target SKIPs until plan
#     355.1-15 flips this leg to a hard `run` once every target exists.
# ---------------------------------------------------------------------------
# The target list mixes genuinely NEW 355.1 files (which do not exist yet;
# run_if SKIPs them) with the two files this phase EXTENDS
# (scripts/auto-explore-fire.cjs, scripts/scout-cadence-guard.cjs, both
# already on disk pre-355.1). A whole-file scan of an EXTENDED file would
# judge PRE-EXISTING content this phase has not touched -- exactly the
# SCOPE BOUNDARY a new phase's own sweep must not cross (mirrors the
# em-dash leg's own added-lines-only idiom, section 9 below). So: a target
# that already existed AT BASE_3551 is scanned on ADDED LINES ONLY (git diff
# BASE_3551..working tree); a target that is genuinely new to this phase is
# scanned WHOLE (100% of it is new). Either way the check's real intent
# holds: 355.1 never ADDS an egress or direct-db token, regardless of what
# it inherits.
# ---------------------------------------------------------------------------
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
PART9_RE="require\(['\"]node:sqlite|\bDatabaseSync\b|insert[[:space:]]+into[[:space:]]+"
PART8_TARGETS=(
  "lib/core/navigation/room-delta-facts.cjs"
  "lib/core/sensors/sensor-room-delta.cjs"
  "lib/core/ambient-framing.cjs"
  "lib/core/ambient-trigger.cjs"
  "lib/core/ambient-run.cjs"
  "scripts/ambient-stop.cjs"
  "scripts/auto-explore-fire.cjs"
  "scripts/scout-cadence-guard.cjs"
)
# Targets that already existed at BASE_3551 (355.1 EXTENDS them, never
# authors them fresh) -- scanned on added lines only.
PART8_PREEXISTING_TARGETS=(
  "scripts/auto-explore-fire.cjs"
  "scripts/scout-cadence-guard.cjs"
)
is_preexisting_target() {
  local tgt="$1"
  local p
  for p in "${PART8_PREEXISTING_TARGETS[@]}"; do
    [ "$p" = "$tgt" ] && return 0
  done
  return 1
}
target_added_lines() {
  local tgt="$1"
  git diff "$BASE_3551" -- "$tgt" 2>/dev/null | grep '^+' | grep -v '^+++' | sed 's/^\+//'
}
sweep_one() {
  local tgt="$1"; local re="$2"; local what="$3"
  local hay
  if is_preexisting_target "$tgt"; then
    hay="$(target_added_lines "$tgt" | grep -vE '^[[:space:]]*(//|\*|/\*)')"
  else
    hay="$(strip_comments "$tgt")"
  fi
  if printf '%s\n' "$hay" | grep -niE "$re" >/dev/null 2>&1; then
    echo "    FORBIDDEN $what token on an executable/added line in: $tgt"
    return 1
  fi
  return 0
}
part8_sweep_one() { sweep_one "$1" "$PART8_RE" "egress"; }
part9_sweep_one() { sweep_one "$1" "$PART9_RE" "direct-db"; }
echo "--- Part 8 sweep: no egress in the 355.1 target list (run_if per target) ---"
for tgt in "${PART8_TARGETS[@]}"; do
  run_if "Part 8 sweep: $tgt" "$tgt" part8_sweep_one "$tgt"
done

# ---------------------------------------------------------------------------
# (3) Part 9 sweep -- no node:sqlite / DatabaseSync / INSERT INTO on an
#     executable line in the same target list (comment-stripped, or
#     added-lines-only for the two pre-existing EXTEND targets -- see the
#     note above section (2)). run_if per target existing.
# ---------------------------------------------------------------------------
echo "--- Part 9 sweep: no direct-db token in the 355.1 target list (run_if per target) ---"
for tgt in "${PART8_TARGETS[@]}"; do
  run_if "Part 9 sweep: $tgt" "$tgt" part9_sweep_one "$tgt"
done

# ---------------------------------------------------------------------------
# (4) dependency-diff leg -- zero new dependencies.
# ---------------------------------------------------------------------------
echo "--- dependency-diff: package.json + package-lock.json unchanged ---"
if git diff --quiet "$BASE_3551" -- package.json package-lock.json; then
  echo ">>> dependency-diff: PASSED"; PASS=$((PASS+1))
else
  echo "    package.json or package-lock.json drifted since BASE_3551 -- Phase 355.1 ships ZERO new deps"
  echo ">>> dependency-diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# (5) check-floor-ledger --check (the two 355.1 floor-ledger rows a later
#     plan adds: claim floor N=5, throttle 1/room/60min).
# ---------------------------------------------------------------------------
run "check-floor-ledger --check" node scripts/check-floor-ledger.cjs --check

# ---------------------------------------------------------------------------
# (6) Structural gates: born-wired / projection / shape / render / CIRS.
#     check-shape-declaration runs WITHOUT --strict (advisory-WARN, Phase 210).
#     check-render-coverage runs with no flag (CONTEXT/PLAN wording).
# ---------------------------------------------------------------------------
run "structural: build-connector-registry --check" \
  node scripts/build-connector-registry.cjs --check
run "structural: build-orchestration-projection --check" \
  node scripts/build-orchestration-projection.cjs --check
run "structural: check-shape-declaration --check (advisory-WARN, no --strict)" \
  node scripts/check-shape-declaration.cjs --check
run "structural: check-render-coverage" \
  node scripts/check-render-coverage.cjs

echo "--- 355.1: CIRS declaration (existing 355.1-NN-PLAN.md files) ---"
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find .planning/phases/355.1-*/ -maxdepth 1 -name '355.1-[0-9][0-9]-PLAN.md' -print0 2>/dev/null)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo ">>> 355.1: CIRS declaration: SKIPPED (no 355.1-NN-PLAN.md found)"; SKIP=$((SKIP+1))
else
  node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
  CIRS_STATUS=$?
  if [ "$CIRS_STATUS" -eq 0 ]; then
    echo ">>> 355.1: CIRS declaration: PASSED"; PASS=$((PASS+1))
  elif [ "$CIRS_STATUS" -eq 77 ]; then
    echo ">>> 355.1: CIRS declaration: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> 355.1: CIRS declaration: FAILED"; FAIL=$((FAIL+1))
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# (7) doctor_acceptance_no_new_regression -- this phase's baseline set,
#     inherited unchanged from 355-27's own note (both points are a shared,
#     concurrent-session environment gap, not a 355 or 355.1 file).
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
      icm-ruling-eval-fresh|verify-release-clean-tree)
        echo "    doctor --acceptance: known pre-existing gap (BASE_3551 baseline): $tok" ;;
      *)
        echo "    doctor --acceptance: NEW acceptance regression vs BASE_3551: $tok"; new_regression=1 ;;
    esac
  done
  return "$new_regression"
}
run "doctor --acceptance (no-new-regression vs BASE_3551 baseline)" \
  doctor_acceptance_no_new_regression

# ---------------------------------------------------------------------------
# (8) No-regression legs against sibling phases and shared surfaces, each
#     run_if-guarded on the target existing.
# ---------------------------------------------------------------------------
run_if "no-regression: run-all-355.sh" "tests/run-all-355.sh" \
  bash tests/run-all-355.sh
run_if "no-regression: test-213-sensor-eureka.cjs" "tests/test-213-sensor-eureka.cjs" \
  node tests/test-213-sensor-eureka.cjs
run_if "no-regression: test-219-harvest-sensor.cjs" "tests/test-219-harvest-sensor.cjs" \
  node tests/test-219-harvest-sensor.cjs
run_if "no-regression: test-345-lockstep.cjs" "tests/test-345-lockstep.cjs" \
  node tests/test-345-lockstep.cjs
run_if "no-regression: test-245-priority-complete.cjs" "tests/test-245-priority-complete.cjs" \
  node tests/test-245-priority-complete.cjs
run_if "no-regression: test-sensors-part8-sweep.cjs" "tests/test-sensors-part8-sweep.cjs" \
  node tests/test-sensors-part8-sweep.cjs
run_if "no-regression: test-sensors-routing-fence.cjs" "tests/test-sensors-routing-fence.cjs" \
  node tests/test-sensors-routing-fence.cjs
run_if "no-regression: test-auto-explore-fingerprint.cjs" "tests/test-auto-explore-fingerprint.cjs" \
  node tests/test-auto-explore-fingerprint.cjs
run_if "no-regression: test-auto-explore-fire.cjs" "tests/test-auto-explore-fire.cjs" \
  node tests/test-auto-explore-fire.cjs
run_if "no-regression: test-detection-routing-local-only.cjs" "tests/test-detection-routing-local-only.cjs" \
  node tests/test-detection-routing-local-only.cjs
run_if "no-regression: test-connector-tier-d-hooks.cjs" "tests/test-connector-tier-d-hooks.cjs" \
  node tests/test-connector-tier-d-hooks.cjs
run_if "no-regression: test-198-adapter-budget.test.cjs" "tests/test-198-adapter-budget.test.cjs" \
  node tests/test-198-adapter-budget.test.cjs
run_if "no-regression: test-355-side-channel-v2.cjs" "tests/test-355-side-channel-v2.cjs" \
  node tests/test-355-side-channel-v2.cjs
run_if "no-regression: test-355-filing.cjs" "tests/test-355-filing.cjs" \
  node tests/test-355-filing.cjs
run_if "no-regression: test-355-sens13-fire-once.cjs" "tests/test-355-sens13-fire-once.cjs" \
  node tests/test-355-sens13-fire-once.cjs
run_if "no-regression: test-355-no-decimal.cjs" "tests/test-355-no-decimal.cjs" \
  node tests/test-355-no-decimal.cjs
run_if "no-regression: test-355-tri-polar.cjs" "tests/test-355-tri-polar.cjs" \
  node tests/test-355-tri-polar.cjs
run_if "no-regression: test-dial-label-bank-drift.cjs" "tests/test-dial-label-bank-drift.cjs" \
  node tests/test-dial-label-bank-drift.cjs

# ---------------------------------------------------------------------------
# (9) Em-dash leg -- zero U+2014 in every NEW 355.1 file, and in ADDED lines
#     only of modified files (git diff against BASE_3551).
# ---------------------------------------------------------------------------
emdash_scan() {
  local hits=0
  local f
  shopt -s nullglob
  local NEW_FILES=(
    tests/test-3551-*.cjs
    tests/helpers/*3551*.cjs
    tests/fixtures/3551
    lib/core/navigation/room-delta-facts.cjs
    lib/core/sensors/sensor-room-delta.cjs
    lib/core/ambient-*.cjs
    scripts/ambient-stop.cjs
    .planning/phases/355.1-*/355.1-BASELINE.md
  )
  shopt -u nullglob
  for f in "${NEW_FILES[@]}"; do
    [ -f "$f" ] || continue
    if grep -qP '\x{2014}' "$f" 2>/dev/null; then
      echo "    em-dash found in NEW file: $f"
      hits=$((hits+1))
    fi
  done
  if git rev-parse --quiet --verify "$BASE_3551" >/dev/null 2>&1; then
    local added
    added="$(git diff "$BASE_3551" -- lib scripts commands skills hooks data docs tests 2>/dev/null | grep '^+' | grep -v '^+++' || true)"
    if printf '%s' "$added" | grep -qP '\x{2014}'; then
      echo "    em-dash found in an ADDED line since BASE_3551"
      hits=$((hits+1))
    fi
  else
    echo "    BASE_3551 ($BASE_3551) not reachable in this checkout -- skipping added-line em-dash leg"
  fi
  [ "$hits" -eq 0 ]
}
run "em-dash leg: zero U+2014 in new/added 355.1 content" emdash_scan

# ---------------------------------------------------------------------------
# (10) glob-collision guard (research Pitfall 11): the decimal test-name form
#      would collide with run-all-355.sh's own tests/test-355-*.cjs glob.
# ---------------------------------------------------------------------------
glob_collision_guard() {
  shopt -s nullglob
  local collisions=(tests/test-355-1-*.cjs)
  shopt -u nullglob
  if [ "${#collisions[@]}" -gt 0 ]; then
    echo "    glob-collision: tests/test-355-1-*.cjs matched ${#collisions[@]} file(s): ${collisions[*]}"
    return 1
  fi
  return 0
}
run "glob-collision guard: tests/test-355-1-*.cjs matches nothing" glob_collision_guard

echo "======================================"
echo "Phase 355.1: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
