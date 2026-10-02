#!/usr/bin/env bash
# Phase 363.1 verification aggregator (beta.51 scaffold-as-content bug
# cluster: the system counted its own scaffold as the navigator's content).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   D-01: one shared scaffold predicate (lib/core/scaffold-predicate.cjs,
#     library plus bash CLI) answers "is this file scaffold?" for every
#     caller.
#   D-02: the FEYNMAN.md room birth writes, with its auto Timeline and Dial
#     Memory blocks, is recognised as scaffold; one authored line makes it
#     content.
#   D-10: every fix lands with a failing tests/test-363.1-*.cjs first, and
#     the existing suites stay as green as they were at the phase base.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-270.sh). Every
# tests/test-363.1-*.cjs file is discovered and run. Adding one needs NO edit
# here. The found-eq-0 guard is load-bearing: a run that discovers nothing
# FAILS, it never prints green. TEST_363_1_PREFIX exists only so that guard is
# provable without editing this file.
#
# PART 8 SOURCE SWEEP: this phase's new production files are swept for
# Brain/network egress tokens. A target that does not exist yet is SKIPPED
# and does not fail the leg (it lands in a later plan of this phase).
#
# DASH FENCE: every source file this phase touches is swept for U+2014 and
# U+2013. A target that does not exist yet is skipped (listed as such).
#
# REGRESSION BLOCK (opt-in, RUN_363_1_REGRESSIONS=1): the D-10 regression
# targets run SEQUENTIALLY (parallel runs cause 216/219 timeouts from CPU
# contention). Each failing leg is compared against BASELINE_RED, the
# failing-leg set measured at the phase base (Plan 01 Task 1). A listed leg
# that fails prints BASELINE-RED and does not count. An unlisted failing leg
# counts as FAIL. A listed leg that now PASSES counts as FAIL too, with
# "NOW GREEN: remove from BASELINE_RED", so the list can never go stale
# silently. The only exception is a `|flaky` entry (used only for the two
# vault-section-minto-generator tests, whose failure is the second-resolution
# last_generated_at race): accepted either way, printed as FLAKY.
#
# Bash 3.2 compatible: no associative arrays, no mapfile. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (the run-all-216 idiom): the offline preload is
# inherited by every spawned leg and every detached eureka child.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PREFIX="${TEST_363_1_PREFIX:-tests/test-363.1-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# DISCOVERY
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 363.1 test files discovered (TEST_363_1_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP (the run-all-270 forbidden-token regex)
# ---------------------------------------------------------------------------
echo "--- 363.1 Part 8 source sweep ---"
PART8_OK=1
PART8_TARGETS=(
  "lib/core/scaffold-predicate.cjs"
  "lib/core/eureka/candidate-exclusion.cjs"
)
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
    if [ "$hits" -gt 0 ]; then
      echo "    FORBIDDEN egress token(s) in: $t ($hits match(es))"
      PART8_OK=0
    else
      echo "    clean: $t"
    fi
  else
    echo "    SKIPPED (not yet created, does not fail this leg): $t"
  fi
done
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 363.1 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 363.1 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# DASH FENCE (U+2014 em-dash, U+2013 en-dash) over this phase's sources
# ---------------------------------------------------------------------------
echo "--- 363.1 dash fence ---"
DASH_OK=1
DASH_TARGETS=(
  "lib/core/scaffold-predicate.cjs"
  "lib/core/eureka/candidate-exclusion.cjs"
  "lib/core/eureka/scaffold-template-index.cjs"
  "lib/core/navigation/room-birth.cjs"
  "lib/core/eureka/reasoning-mode.cjs"
  "scripts/eureka-portfolio-report.cjs"
  "lib/core/eureka/room-native-substrate.cjs"
  "lib/core/eureka/tail-quadrant.cjs"
  "lib/core/eureka/opportunity-statement.cjs"
  "scripts/eureka-command.cjs"
  "scripts/compute-state"
  "lib/core/folder-memory-shared.cjs"
  "scripts/vault-section-minto-generator.cjs"
  "agents/framework-runner.md"
  "agents/research.md"
  "agents/opportunity-scanner.md"
  "tests/run-all-363.1.sh"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  DASH_TARGETS+=("$t")
done
for t in "${DASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -cP '\x{2014}|\x{2013}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      DASH_OK=0
    elif [ "${hits:-0}" -gt 0 ]; then
      echo "    FORBIDDEN dash ($hits line(s)) in: $t"
      DASH_OK=0
    fi
  else
    echo "    SKIPPED (not present): $t"
  fi
done
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 363.1 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 363.1 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# REGRESSION BLOCK (opt-in): RUN_363_1_REGRESSIONS=1
# ---------------------------------------------------------------------------
# BASELINE_RED: `target|label` for a pre-existing failing leg (suites), or
# `target|<file name>` for a single-file target, or `target|flaky`. Each
# entry has a parallel BASELINE_RED_REASON entry at the same index and a
# one-line written reason comment (the run-all-217 idiom). Measured at the
# phase base by Plan 01 Task 1; see 363.1-01-SUMMARY.md for the table.
BASELINE_RED=()
BASELINE_RED_REASON=()
# Measured at PHASE_BASE c7d8ac12b (2026-09-30), Plan 01 Task 1; see 363.1-01-SUMMARY.md.
# Canon Part 11 advisory conflict: 13 skills declare hitl_shape and connector.excluded together
BASELINE_RED+=("run-all-216.sh|216-03 gate: shape declaration (strict)")
BASELINE_RED_REASON+=("Canon Part 11 advisory conflict: 13 skills declare hitl_shape and connector.excluded together")
# pre-existing: leg 5 expects state done or failed but a no-encoder run parks in reasoning_await_mappings (encoder_unavailable degrade), unrelated to R17-02
BASELINE_RED+=("run-all-218.sh|T-218-VD-5 auto-extract pre-step + extraction-error surfacing")
BASELINE_RED_REASON+=("pre-existing: leg 5 expects state done or failed but a no-encoder run parks in reasoning_await_mappings (encoder_unavailable degrade), unrelated to R17-02")
# nested 218 suite: its only failing leg is T-218-VD-5 (reasoning_await_mappings, see that entry)
BASELINE_RED+=("run-all-219.sh|218 substrate no-regression")
BASELINE_RED_REASON+=("nested 218 suite: its only failing leg is T-218-VD-5 (reasoning_await_mappings, see that entry)")
# pre-existing: leg 5 expects state done or failed but a no-encoder run parks in reasoning_await_mappings (encoder_unavailable degrade), unrelated to R17-02
BASELINE_RED+=("run-all-219.sh|T-218-VD-5 auto-extract pre-step + extraction-error surfacing")
BASELINE_RED_REASON+=("pre-existing: leg 5 expects state done or failed but a no-encoder run parks in reasoning_await_mappings (encoder_unavailable degrade), unrelated to R17-02")
# installed @huggingface/transformers lacks ModelRegistry.is_pipeline_cached
BASELINE_RED+=("run-all-355.sh|272-cache-probe.test.cjs")
BASELINE_RED_REASON+=("installed @huggingface/transformers lacks ModelRegistry.is_pipeline_cached")
# nested 272 suite, same missing is_pipeline_cached
BASELINE_RED+=("run-all-355.sh|no-regression: run-all-272.sh")
BASELINE_RED_REASON+=("nested 272 suite, same missing is_pipeline_cached")
# PB8-03 generic framework question not ALLOWed
BASELINE_RED+=("run-all-355.sh|no-regression: part8-egress-guard.test.cjs")
BASELINE_RED_REASON+=("PB8-03 generic framework question not ALLOWed")
# H-rule hit in lib/core/rs-chain-feeder.cjs
BASELINE_RED+=("run-all-355.sh|test-355-direction-agreement.cjs")
BASELINE_RED_REASON+=("H-rule hit in lib/core/rs-chain-feeder.cjs")
# second-resolution last_generated_at race between consecutive --write runs (green at re-measure, red at planning time)
BASELINE_RED+=("vault-section-minto-generator.test.cjs|flaky")
BASELINE_RED_REASON+=("second-resolution last_generated_at race between consecutive --write runs (green at re-measure, red at planning time)")
# second-resolution last_generated_at race between consecutive --write runs (green at re-measure, red at planning time)
BASELINE_RED+=("vault-section-minto-generator.integration.test.cjs|flaky")
BASELINE_RED_REASON+=("second-resolution last_generated_at race between consecutive --write runs (green at re-measure, red at planning time)")

MINTO_RESIDUE="test-fixtures/feynman/sections/fixture-small/problem-definition/MINTO.md"
clean_minto_residue() {
  # Remove the residue file ONLY when git does not track it (a failed run of
  # a vault-section-minto-generator test leaves it behind). Never touches a
  # tracked file.
  if [ -e "$MINTO_RESIDUE" ] && ! git ls-files --error-unmatch -- "$MINTO_RESIDUE" >/dev/null 2>&1; then
    rm -f -- "$MINTO_RESIDUE"
    echo "    removed untracked residue: $MINTO_RESIDUE"
  fi
}

# baseline_index TARGET LABEL -> prints the BASELINE_RED index, or nothing.
baseline_index() {
  local want="$1|$2" i=0
  while [ $i -lt ${#BASELINE_RED[@]} ]; do
    if [ "${BASELINE_RED[$i]}" = "$want" ]; then echo "$i"; return 0; fi
    i=$((i+1))
  done
  return 1
}

# judge_target TARGET RC FAILED_LABELS_FILE
judge_target() {
  local target="$1" rc="$2" labels_file="$3" idx label entry i
  idx="$(baseline_index "$target" "flaky" || true)"
  if [ -n "$idx" ]; then
    if [ "$rc" -eq 0 ]; then
      echo ">>> regression $target: PASSED (FLAKY (tolerated): ${BASELINE_RED_REASON[$idx]})"
    else
      echo ">>> regression $target: FLAKY (tolerated): ${BASELINE_RED_REASON[$idx]}"
    fi
    PASS=$((PASS+1))
    return 0
  fi
  local bad=0
  while IFS= read -r label; do
    [ -z "$label" ] && continue
    idx="$(baseline_index "$target" "$label" || true)"
    if [ -n "$idx" ]; then
      echo "    BASELINE-RED (pre-existing): $target | $label -- ${BASELINE_RED_REASON[$idx]}"
    else
      echo "    NEW FAILURE: $target | $label"
      bad=1
    fi
  done < "$labels_file"
  # A listed leg that no longer fails means the list is stale.
  i=0
  while [ $i -lt ${#BASELINE_RED[@]} ]; do
    entry="${BASELINE_RED[$i]}"
    case "$entry" in
      "$target|"*)
        label="${entry#"$target|"}"
        if ! grep -qxF -- "$label" "$labels_file"; then
          echo "    NOW GREEN: remove from BASELINE_RED: $entry"
          bad=1
        fi
        ;;
    esac
    i=$((i+1))
  done
  if [ "$rc" -ne 0 ] && [ ! -s "$labels_file" ]; then
    echo "    NEW FAILURE: $target exited rc=$rc with no failing leg label"
    bad=1
  fi
  if [ "$bad" -eq 0 ]; then
    echo ">>> regression $target: PASSED"; PASS=$((PASS+1))
  else
    echo ">>> regression $target: FAILED"; FAIL=$((FAIL+1))
  fi
}

# regress_suite TARGET (a tests/run-all-*.sh); labels from `>>> X: FAILED`.
regress_suite() {
  local target="$1" out labels rc
  out="$(mktemp)"; labels="$(mktemp)"
  echo "--- regression $target ---"
  bash "tests/$target" > "$out" 2>&1; rc=$?
  grep -E '^>>> .*: FAILED$' "$out" | sed -e 's/^>>> //' -e 's/: FAILED$//' | sort -u > "$labels"
  echo "    rc=$rc, failing legs: $(wc -l < "$labels" | tr -d ' ')"
  judge_target "$target" "$rc" "$labels"
  rm -f "$out" "$labels"
  echo ""
}

# regress_file TARGET_PATH; the label is the file name.
regress_file() {
  local rel="$1" target out labels rc
  target="$(basename "$rel")"
  out="$(mktemp)"; labels="$(mktemp)"
  echo "--- regression $target ---"
  node "$rel" > "$out" 2>&1; rc=$?
  if [ "$rc" -ne 0 ]; then echo "$target" > "$labels"; else : > "$labels"; fi
  echo "    rc=$rc"
  if [ "$rc" -ne 0 ]; then tail -5 "$out" | sed 's/^/    | /'; fi
  judge_target "$target" "$rc" "$labels"
  rm -f "$out" "$labels"
  echo ""
}

if [ "${RUN_363_1_REGRESSIONS:-0}" = "1" ]; then
  for s in run-all-215.sh run-all-216.sh run-all-218.sh run-all-219.sh run-all-226.sh run-all-355.sh; do
    regress_suite "$s"
  done
  for f in \
    tests/test-341-eureka-no-brain-reach.cjs \
    tests/test-215-tail.cjs \
    tests/test-compute-state-persists.cjs \
    tests/test-eureka-scaffold-entity-noise.cjs \
    lib/memory/vault-section-minto-generator-atomic.test.cjs \
    lib/memory/folder-memory.test.cjs \
    tests/test-connector-agents-walk.cjs \
    tests/test-216-room-substrate.cjs \
    tests/test-215-opp-statement.cjs; do
    regress_file "$f"
  done
  for f in scripts/vault-section-minto-generator.test.cjs scripts/vault-section-minto-generator.integration.test.cjs; do
    regress_file "$f"
    clean_minto_residue
  done
else
  echo "--- 363.1 regression block: SKIPPED (set RUN_363_1_REGRESSIONS=1 to run) ---"
  SKIP=$((SKIP+1))
  echo ""
fi

echo "======================================"
echo "Phase 363.1: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
