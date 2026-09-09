#!/usr/bin/env bash
# Phase 341 (install and update overhaul: npm-source plugin artifact, heavy-dep
# cut, one install location, transactional update) verification aggregator.
# Decision ids gated: D-02, D-03, D-04, D-06, D-07, D-08, D-09, D-10, D-11, D-12.
# Modeled on tests/run-all-310.sh. bash only.
# Zero real git-push, zero real remote, zero npm-publish call, zero GitHub call.
#
# Legs: syntax + regression legs (always green), the two D-04/D-03 EXPECTED-RED
# tripwires (guarded on npm-shrinkwrap.json -- they trip today and can only be
# made green by the real packaging cut in plan 341-04), the artifact-guarded
# legs that SKIP until their own artifact lands, the test-file-guarded legs
# that SKIP until a later plan authors them, the Phase 341 step-block tripwire
# (guarded on its own fixture), and the em-dash guard.
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
REDX=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# Semantics (label, artifact-guard, cmd...):
#   guard EXISTS            -> behaves exactly like `run` (a failure is a FAIL).
#   guard ABSENT, cmd FAILS -> EXPECTED-RED, REDX++, not a FAIL. This is the
#                              honest state of a tripwire pinning a change that
#                              has not landed yet.
#   guard ABSENT, cmd PASSES -> FAILED, FAIL++. A tripwire that stops tripping
#                              while its artifact is still absent is a defect
#                              in the tripwire, not a pass.
run_red_until() {
  local label="$1"; local guard="$2"; shift 2
  echo "--- $label ---"
  if [ -f "$guard" ]; then
    if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  else
    if "$@"; then
      echo ">>> $label: FAILED (tripwire passed while $guard is still absent - the tripwire is not testing what it claims)"
      FAIL=$((FAIL+1))
    else
      echo ">>> $label: EXPECTED-RED (artifact $guard not landed yet)"
      REDX=$((REDX+1))
    fi
  fi
  echo ""
}

RELEASE_SH="scripts/release.sh"
FIXTURE_341="tests/fixtures/341-release-step-block-hashes.txt"

# The em-dash guard's file list. Every path this phase touches, later waves
# included; entries that do not exist yet are skipped (later waves create
# them). tests/test-341-*.cjs is discovered by glob, not hand-enumerated here.
PHASE_341_SURFACES=(
  "package.json"
  "scripts/release.sh"
  "scripts/check-release-payload-ceiling.cjs"
  "scripts/check-registry-drift.cjs"
  "scripts/eureka-command.cjs"
  "scripts/migrate-legacy-install-location.cjs"
  "lib/core/eureka-deps-resolver.cjs"
  "lib/core/eureka/eureka-enable.cjs"
  "lib/core/eureka/embedding-spine.cjs"
  "lib/core/doctor/class-s-eureka-smoke.cjs"
  "commands/update.md"
  "commands/eureka.md"
  "commands/doctor.md"
  "data/harness-policies/release-payload-ceiling.json"
  "data/harness-policies/registry-drift.json"
  "tests/run-all-341.sh"
)

# --- Always-green regression legs -------------------------------------------

run "341: syntax (scripts/release.sh)" bash -n "$RELEASE_SH"
run "341: syntax (tests/run-all-341.sh)" bash -n "tests/run-all-341.sh"
run "341: run-harness --check (regression, standalone)" node scripts/run-harness.cjs --check
run "341: build-harness-manifest --check (regression)" node scripts/build-harness-manifest.cjs --check
run "341: check-shape-declaration --check (advisory CIRS R16 lint, exits 0)" node scripts/check-shape-declaration.cjs --check
run "341: run-all-310.sh (pre-existing release-ceremony suite, its 2 SKIPs are expected, FAIL must be 0)" bash tests/run-all-310.sh

# --- EXPECTED-RED tripwires (D-04 / D-03, guard: npm-shrinkwrap.json) --------

run_red_until "341: D-04 shrinkwrap-in-payload tripwire" "npm-shrinkwrap.json" \
  node tests/test-341-payload-shrinkwrap-present.cjs
run_red_until "341: D-03 heavy-dependency tripwire" "npm-shrinkwrap.json" \
  node tests/test-341-no-heavy-dep.cjs

# --- Artifact-guarded legs (SKIP until their own artifact lands) ------------

run_if "341: shrinkwrap has zero dev entries" "npm-shrinkwrap.json" \
  node tests/test-341-shrinkwrap-no-dev.cjs
run_if "341: shrinkwrap carries platform coverage" "npm-shrinkwrap.json" \
  node tests/test-341-shrinkwrap-platform-coverage.cjs
run_if "341: payload ceiling policy" "scripts/check-release-payload-ceiling.cjs" \
  node tests/test-341-payload-ceiling.cjs
run_if "341: registry-drift policy" "scripts/check-registry-drift.cjs" \
  node tests/test-341-registry-drift.cjs

# --- Test-file-guarded legs (SKIP until a later plan authors them) ---------

run_if "341: eureka-deps-resolver" "tests/test-341-eureka-deps-resolver.cjs" \
  node tests/test-341-eureka-deps-resolver.cjs
run_if "341: eureka-enable-argv" "tests/test-341-eureka-enable-argv.cjs" \
  node tests/test-341-eureka-enable-argv.cjs
run_if "341: class-s-layer-split" "tests/test-341-class-s-layer-split.cjs" \
  node tests/test-341-class-s-layer-split.cjs
run_if "341: slim-install-honest-degrade" "tests/test-341-slim-install-honest-degrade.cjs" \
  node tests/test-341-slim-install-honest-degrade.cjs
run_if "341: eureka-no-brain-reach" "tests/test-341-eureka-no-brain-reach.cjs" \
  node tests/test-341-eureka-no-brain-reach.cjs
run_if "341: release-shrinkwrap-gate" "tests/test-341-release-shrinkwrap-gate.cjs" \
  node tests/test-341-release-shrinkwrap-gate.cjs
run_if "341: marketplace-npm-source" "tests/test-341-marketplace-npm-source.cjs" \
  node tests/test-341-marketplace-npm-source.cjs
run_if "341: version-of-record-source-version" "tests/test-341-version-of-record-source-version.cjs" \
  node tests/test-341-version-of-record-source-version.cjs
run_if "341: cold-install-evidence" "tests/test-341-cold-install-evidence.cjs" \
  node tests/test-341-cold-install-evidence.cjs
run_if "341: legacy-install-teardown" "tests/test-341-legacy-install-teardown.cjs" \
  node tests/test-341-legacy-install-teardown.cjs
run_if "341: install-sh-retired" "tests/test-341-install-sh-retired.cjs" \
  node tests/test-341-install-sh-retired.cjs
run_if "341: update-collapsed" "tests/test-341-update-collapsed.cjs" \
  node tests/test-341-update-collapsed.cjs
run_if "341: retired-classes-a-h" "tests/test-341-retired-classes-a-h.cjs" \
  node tests/test-341-retired-classes-a-h.cjs
run_if "341: retired-topology-halves" "tests/test-341-retired-topology-halves.cjs" \
  node tests/test-341-retired-topology-halves.cjs

# --- Phase 341 step-block tripwire (guarded on its own fixture) ------------
#
# Clones tests/run-all-310.sh leg 3's algorithm: split scripts/release.sh on
# `^# --- Step` keyed by header text (line-number independent), hash each
# block with sha256sum, compare against the fixture, assert set-equality both
# directions, and assert the header count equals the count recorded on the
# fixture's own STEP_BLOCK_COUNT data line rather than a literal baked into
# this script. Reading the count from the fixture is deliberate: plan 341-05
# deletes Step 6.7, so a hard-coded count here would be a second thing to
# edit and a second thing to forget.
leg_341_step_block_tripwire() {
  local f="$RELEASE_SH"
  local total_lines
  total_lines="$(wc -l < "$f")"
  mapfile -t lines < <(grep -n '^# --- Step' "$f" | cut -d: -f1)
  local n="${#lines[@]}"

  local -A fix_hash
  local fix_headers=()
  local expected_count=""
  while IFS= read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    if [[ "$line" == *"STEP_BLOCK_COUNT"* ]]; then
      expected_count="$(echo "$line" | awk '{print $1}')"
      continue
    fi
    local hash="${line:0:64}"
    local header="${line:66}"
    fix_hash["$header"]="$hash"
    fix_headers+=("$header")
  done < "$FIXTURE_341"

  local mismatch=0
  local cur_headers=()
  local i start end header hash
  for ((i = 0; i < n; i++)); do
    start="${lines[$i]}"
    if (( i + 1 < n )); then end=$(( ${lines[$((i+1))]} - 1 )); else end="$total_lines"; fi
    header="$(sed -n "${start}p" "$f")"
    cur_headers+=("$header")
    hash="$(sed -n "${start},${end}p" "$f" | sha256sum | awk '{print $1}')"

    if [[ -z "${fix_hash[$header]:-}" ]]; then
      echo "block added or renamed (not in fixture): $header"
      mismatch=1
      continue
    fi
    if [[ "$hash" != "${fix_hash[$header]}" ]]; then
      echo "HASH MISMATCH (block weakened/changed outside authorized scope): $header"
      mismatch=1
    fi
  done

  local fh found ch
  for fh in "${fix_headers[@]}"; do
    found=0
    for ch in "${cur_headers[@]}"; do
      if [[ "$ch" == "$fh" ]]; then found=1; break; fi
    done
    if [[ "$found" -eq 0 ]]; then
      echo "block present in fixture but MISSING from current release.sh: $fh"
      mismatch=1
    fi
  done

  if [[ -n "$expected_count" ]] && [[ "$n" -ne "$expected_count" ]]; then
    echo "expected $expected_count step-block headers (per fixture STEP_BLOCK_COUNT), found $n"
    mismatch=1
  fi

  return "$mismatch"
}
run_if "341: step-block tripwire (release.sh Step blocks pinned to the 341 fixture)" "$FIXTURE_341" \
  leg_341_step_block_tripwire

# --- Em-dash guard (always) -------------------------------------------------

echo "--- 341: em-dash guard ---"
EMDASH_HIT=0
EMDASH_FILES=("${PHASE_341_SURFACES[@]}")
while IFS= read -r -d '' f; do
  EMDASH_FILES+=("$f")
done < <(find tests -maxdepth 1 -name 'test-341-*.cjs' -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lq "$(printf '\xe2\x80\x94')" "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 341: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 341: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary -----------------------------------------------------------------

echo "======================================"
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP EXPECTED-RED=$REDX"
echo "======================================"
if [ "$REDX" -gt 0 ]; then
  echo "EXPECTED-RED legs remain: the D-02/D-03/D-04 packaging cut (plan 341-04) has not landed yet."
fi
exit $(( FAIL > 0 ? 1 : 0 ))
