#!/usr/bin/env bash
# Phase 127.2 Plan 02 -- smoke test for the 3 fixes that close findings
# A, B, C from the v1.13.0-beta.26 post-ship QA sweep.
#
# Verifies:
#   Finding B  doctor uses `git describe --tags` for version-of-record
#   Finding C  doctor npx-roundtrip accepts package-executed signal
#   QA sweep doc moved to resolved/ + knowledge-base entry present
#
# Finding A (website) lives in a separate repo (~/mindrian-website) and
# is verified out-of-process via curl against the live Vercel URL --
# documented in Plan 127.2-02 acceptance criteria, not asserted here.
#
# Run from repo root: bash tests/test-127.2-02-qa-sweep-fixes.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "Phase 127.2 Plan 02 smoke test (repo: $REPO_ROOT)"
echo ""

# Finding B: doctor reads last shipped tag, not plugin.json
echo "Finding B -- doctor version-of-record via git describe:"
if grep -q "git', \['-C', pluginRoot, 'describe', '--tags', '--abbrev=0', '--match=v\*'\]" scripts/doctor.cjs; then
  pass "version-of-record-published uses git describe (last shipped tag)"
else
  fail "version-of-record-published still reads plugin.json placeholder"
fi
# Check that the fix is also in npx-roundtrip (Finding B mirrored)
if grep -c "git', \['-C', pluginRoot, 'describe', '--tags', '--abbrev=0', '--match=v\*'\]" scripts/doctor.cjs | grep -q "^[2-9]$\|^[1-9][0-9]"; then
  pass "git describe pattern present in BOTH version-of-record AND npx-roundtrip call sites"
else
  fail "git describe pattern only landed at one call site (expected two)"
fi

# Finding C: doctor accepts package-executed signal regardless of exit code
echo ""
echo "Finding C -- doctor npx-roundtrip accepts package-executed signal:"
if grep -q "Installing the MindrianOS plugin" scripts/doctor.cjs; then
  pass "Installing-plugin signal pattern present"
else
  fail "package-executed signal pattern MISSING"
fi
if grep -q "packageExecuted" scripts/doctor.cjs; then
  pass "packageExecuted variable wired into success check"
else
  fail "packageExecuted variable NOT wired"
fi

# QA sweep doc closeout
echo ""
echo "QA sweep closeout:"
if [[ -f ".planning/debug/resolved/v1.13.0-beta.26-post-ship-qa-sweep.md" ]]; then
  pass "QA sweep doc in resolved/"
else
  fail "QA sweep doc NOT in resolved/"
fi
if [[ -f ".planning/debug/v1.13.0-beta.26-post-ship-qa-sweep.md" ]]; then
  fail "QA sweep doc STILL in .planning/debug/ (should be moved)"
else
  pass "QA sweep doc removed from .planning/debug/"
fi
if grep -q "resolved_by: phase-127.2 Plan 127.2-02" .planning/debug/resolved/v1.13.0-beta.26-post-ship-qa-sweep.md; then
  pass "resolved_by frontmatter set"
else
  fail "resolved_by frontmatter MISSING"
fi
if grep -q "^## v1.13.0-beta.26-post-ship-qa-sweep" .planning/debug/knowledge-base.md; then
  pass "knowledge-base entry for QA sweep"
else
  fail "knowledge-base entry MISSING"
fi

# Plan + CONTEXT still present
echo ""
echo "Phase 127.2 scaffolding intact:"
if [[ -f ".planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-02-PLAN.md" ]]; then
  pass "Plan 127.2-02 file present"
else
  fail "Plan 127.2-02 file MISSING"
fi

echo ""
echo "=========================================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "=========================================="

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
