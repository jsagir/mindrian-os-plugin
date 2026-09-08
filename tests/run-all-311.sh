#!/usr/bin/env bash
# Phase 311 (SEED-052 smallest slice) verification aggregator -- wires the
# already-declared `visibility: admin` command frontmatter field through
# data/command-registry.json into the D4 recommendation scorer
# (lib/workflow/f-selector-ranker.cjs), so a non-admin navigator is never
# offered /mos:admin or /mos:dogfood-flush as a recommendation. Modeled on
# tests/run-all-298.sh. bash only. No em-dashes.

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

run "311 registry drift tripwire" node scripts/build-command-registry.cjs --check
run_if "311 admin-visibility case set" "tests/test-311-admin-visibility.cjs" \
  node tests/test-311-admin-visibility.cjs

# Scope leg: the fourth ranker call site + the execution-time gate must show
# zero working-tree change. Complements the pinned sha256 hashes in case 11
# by also catching an uncommitted edit, not just a committed one.
echo "--- 311 scope boundary git diff ---"
SCOPE_DIFF="$(git diff --stat HEAD -- lib/hmi/dial-reach-orchestrator.cjs scripts/admin-command-gate.cjs)"
if [ -z "$SCOPE_DIFF" ]; then
  echo ">>> 311 scope boundary git diff: PASSED"; PASS=$((PASS+1))
else
  echo "$SCOPE_DIFF"
  echo ">>> 311 scope boundary git diff: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# Em-dash guard across every file this phase touched.
echo "--- 311 em-dash guard ---"
EMDASH_FILES="scripts/build-command-registry.cjs data/command-registry.json lib/workflow/f-selector-ranker.cjs lib/core/navigation-engine-offer.cjs lib/core/unknowns/orchestrator.cjs scripts/suggest-next-command.cjs tests/test-311-admin-visibility.cjs tests/run-all-311.sh"
EMDASH_HIT=0
for f in $EMDASH_FILES; do
  if [ -f "$f" ] && grep -qP '\x{2014}' "$f" 2>/dev/null; then
    echo "em-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 311 em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 311 em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 311: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
