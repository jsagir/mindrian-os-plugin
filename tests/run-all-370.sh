#!/usr/bin/env bash
# Phase 370 verification aggregator (review contract for /mos:grade and /mos:deep-grade).
#
# WHAT THIS PHASE HAS TO PROVE: the fixed shape and the internal-name denylist
# of a grade or deep-grade review are enforced by CODE (lib/core/review-contract.cjs),
# the contract is DATA (data/review-contract.json), and the denylist is generated
# from disk, never frozen.
#
# DISCOVERY IS BY GLOB, NOT BY LIST (model: tests/run-all-265.sh). This runner
# globs every tests/test-370-* file (.cjs and .sh) and runs it. Adding a
# tests/test-370-* file needs NO edit here.
#
# THE found-equals-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that finds nothing must FAIL, not print green. Prove it with:
#   TEST_370_PREFIX=tests/test-370-nonexistent- bash tests/run-all-370.sh   (exit 1)
#
# NO-DASH FENCE: every file this phase touches is scanned for U+2013 and U+2014
# by codepoint escape. A missing named target is skipped, unless
# TEST_370_REQUIRE_ALL=1 is set (plan 370-11 runs it that way). The optional
# hook script is required under that flag only when hooks/hooks.json names it.
#
# bash only. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The prefix is a variable ONLY so the found-equals-0 guard is provable.
PREFIX="${TEST_370_PREFIX:-tests/test-370-}"

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
# DISCOVERY: bare `node "$t"` (every Phase 370 test is a plain script that
# calls process.exit(1) on failure), `bash` for shell tests.
# ---------------------------------------------------------------------------
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node "$t"
done
for t in "$PREFIX"*.sh; do
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
echo "discovered $found test file(s) under ${PREFIX}*"
echo ""

# ---------------------------------------------------------------------------
# ALWAYS-PRESENT GATE LINE (pre-existing gate, no test-370 prefix).
# ---------------------------------------------------------------------------
run "skill mirrors drift --check (commands-to-mirrors)" node scripts/build-skill-mirrors.cjs --check

# ---------------------------------------------------------------------------
# NO-DASH FENCE
# ---------------------------------------------------------------------------
echo "--- 370 no-dash fence ---"
DASH_OK=1
DASH_MISSING=0
DASH_TARGETS=(
  "data/review-contract.json"
  "lib/core/review-contract.cjs"
  "scripts/check-review-contract.cjs"
  "scripts/review-contract-hook.cjs"
  "tests/run-all-370.sh"
  "tests/helpers/review-contract-370.cjs"
  "agents/grading.md"
  "commands/grade.md"
  "commands/deep-grade.md"
  "references/methodology/grade.md"
)
for t in "${DASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '[\x{2013}\x{2014}]' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      DASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN dash character in: $t"
      DASH_OK=0
    fi
  else
    # The hook script is optional: required only when hooks/hooks.json names it.
    if [ "$t" = "scripts/review-contract-hook.cjs" ] && ! grep -q 'review-contract-hook' "$ROOT/hooks/hooks.json" 2>/dev/null; then
      echo "    OPTIONAL (hook not wired): $t"
    else
      echo "    MISSING: $t"
      DASH_MISSING=$((DASH_MISSING+1))
    fi
  fi
done
# Glob targets: every test file, every fixture. Never "missing".
shopt -s nullglob
for f in "$ROOT"/tests/test-370-*.cjs "$ROOT"/tests/test-370-*.sh "$ROOT"/tests/fixtures/370/*; do
  [ -f "$f" ] || continue
  hits="$(LC_ALL=C.UTF-8 grep -lP '[\x{2013}\x{2014}]' "$f" 2>/dev/null)"; rc=$?
  if [ "$rc" -ge 2 ]; then
    echo "    SCAN BROKE (rc=$rc) on: ${f#$ROOT/}"
    DASH_OK=0
  elif [ -n "$hits" ]; then
    echo "    FORBIDDEN dash character in: ${f#$ROOT/}"
    DASH_OK=0
  fi
done
shopt -u nullglob
if [ "$DASH_MISSING" -gt 0 ] && [ "${TEST_370_REQUIRE_ALL:-0}" = "1" ]; then
  echo "    $DASH_MISSING named target(s) missing and TEST_370_REQUIRE_ALL=1"
  DASH_OK=0
fi
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 370 no-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 370 no-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 370: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
