#!/usr/bin/env bash
# Quick 261030-eo7 verification aggregator: the four command-injection fixes.
#
#   H1  lib/core/git-ops.cjs commitArtifact      (commit message, file and room as argv, not shell text)
#   H2  scripts/research-speaker urlencode        (speaker name as sys.argv[1], not python program text)
#   N1  scripts/research-speaker --apply          (project context to awk through the environment)
#   N2  scripts/git-ops get-auto-push             (registry, room and workspace paths as argv)
#
# DISCOVERY IS BY GLOB (the run-all-381 pattern): every tests/test-261030-eo7-*.cjs file is run.
# Adding one needs no edit here. A run that discovers nothing FAILS (found-eq-0 guard);
# EO7_PREFIX exists only so that guard is provable.
#
# THE ORACLE. Each test compares NEW bytes with the OLD scripts cut with `git archive` of a base
# commit (default bc75d431ea8bc5e4218c01a51f5c0a37b74d2295, the main commit before the fixes).
# EO7_ORACLE_SHA overrides it. If that commit is not reachable in this checkout (a shallow clone,
# a pruned repo), the tests cannot prove byte identity. This runner then does NOT pass silently:
# it prints a loud SKIP banner for every test, counts them under SKIP, and
#   - exits 0 by default (the same meaning SKIP has in run-all-381.sh),
#   - exits 1 when EO7_REQUIRE_ORACLE=1 (use this switch in any release gate).
#
# DASH FENCE: the files this quick adds are swept for U+2014 and U+2013.
# Offline: the run-all-216 idiom, the offline preload is inherited by every leg (the tests also
# stub curl through PATH). Bash 3.2 compatible: no associative arrays, no mapfile.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PREFIX="${EO7_PREFIX:-tests/test-261030-eo7-}"
ORACLE_SHA="${EO7_ORACLE_SHA:-bc75d431ea8bc5e4218c01a51f5c0a37b74d2295}"

PASS=0
FAIL=0
SKIP=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

ORACLE_OK=1
if ! git cat-file -e "${ORACLE_SHA}^{commit}" 2>/dev/null; then
  ORACLE_OK=0
fi

DISCOVERED=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED+=("$t")
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no eo7 test files discovered (EO7_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

if [ "$ORACLE_OK" -eq 0 ]; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "!!! SKIP: the oracle commit ${ORACLE_SHA} is not reachable in this checkout."
  echo "!!! The byte-identity legs cannot run; NOTHING was proved. Set EO7_ORACLE_SHA to a"
  echo "!!! reachable commit that still holds the OLD scripts (the parent of the eo7 fixes)."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  for t in "${DISCOVERED[@]}"; do
    echo "SKIP $(basename "$t") (oracle unreachable)"
    SKIP=$((SKIP+1))
  done
else
  for t in "${DISCOVERED[@]}"; do
    run "$(basename "$t")" node "$t"
  done
fi

echo "--- eo7 dash fence ---"
DASH_HITS=0
for f in "${DISCOVERED[@]}" tests/run-all-eo7.sh; do
  if [ -f "$f" ] && LC_ALL=C.UTF-8 grep -q -P '\x{2014}|\x{2013}' "$f" 2>/dev/null; then
    echo "dash found in $f"
    DASH_HITS=$((DASH_HITS+1))
  fi
done
if [ "$DASH_HITS" -eq 0 ]; then echo ">>> eo7 dash fence: PASSED"; PASS=$((PASS+1)); else echo ">>> eo7 dash fence: FAILED"; FAIL=$((FAIL+1)); fi
echo ""

echo "======================================"
echo "Quick 261030-eo7: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
if [ "$ORACLE_OK" -eq 0 ] && [ "${EO7_REQUIRE_ORACLE:-}" = "1" ]; then
  echo "!!! EO7_REQUIRE_ORACLE=1 and the oracle is unreachable: failing"
  exit 1
fi
exit 0
