#!/usr/bin/env bash
# Phase 127.2 Plan 00 (Brain Edge Bundle) -- smoke test.
#
# Verifies the three landed cleanups:
#   D-08  brain_ask description names DirectiveEnvelope return contract
#   D-09  BRAIN_MAX_TOPK cap present at both Pinecone forward sites
#   D-10  Source-of-Truth Preamble present in docs/RCA-TEMPLATE.md
#
# Also verifies the three debug docs were moved from .planning/debug/ to
# .planning/debug/resolved/ as part of the closeout.
#
# Run from repo root: bash tests/test-127.2-00-brain-edge-bundle.sh

set -uo pipefail

# Resolve repo root from script location so the test is location-independent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "Phase 127.2 Plan 00 smoke test (repo: $REPO_ROOT)"
echo ""

# D-08: brain_ask description names DirectiveEnvelope
echo "D-08 brain_ask description rewrite:"
if grep -q "DirectiveEnvelope" mcp-server-brain/lib/brain-ask.cjs; then
  pass "brain-ask.cjs description names DirectiveEnvelope"
else
  fail "brain-ask.cjs description does NOT name DirectiveEnvelope"
fi

# D-09: BRAIN_MAX_TOPK cap at both forward sites
echo ""
echo "D-09 BRAIN_MAX_TOPK cap:"
if grep -q "BRAIN_MAX_TOPK" mcp-server-brain/lib/brain-ask.cjs; then
  pass "BRAIN_MAX_TOPK present in brain-ask.cjs"
else
  fail "BRAIN_MAX_TOPK MISSING from brain-ask.cjs"
fi
if grep -q "BRAIN_MAX_TOPK" mcp-server-brain/lib/pinecone-tools.cjs; then
  pass "BRAIN_MAX_TOPK present in pinecone-tools.cjs"
else
  fail "BRAIN_MAX_TOPK MISSING from pinecone-tools.cjs"
fi
# Both sites must use Math.min to apply the cap.
if grep -q "Math.min" mcp-server-brain/lib/brain-ask.cjs && \
   grep -q "Math.min" mcp-server-brain/lib/pinecone-tools.cjs; then
  pass "Math.min cap pattern applied at both forward sites"
else
  fail "Math.min cap pattern MISSING from one or both forward sites"
fi

# D-10: Source-of-Truth Preamble in RCA-TEMPLATE.md
echo ""
echo "D-10 Source-of-Truth Preamble in RCA-TEMPLATE:"
if grep -q "Source-of-Truth Preamble" docs/RCA-TEMPLATE.md; then
  pass "Source-of-Truth Preamble section present in docs/RCA-TEMPLATE.md"
else
  fail "Source-of-Truth Preamble section MISSING from docs/RCA-TEMPLATE.md"
fi
if grep -q "Source-of-Truth Preamble filled before any finding filed" docs/RCA-TEMPLATE.md; then
  pass "checklist row added"
else
  fail "checklist row MISSING"
fi

# Debug-doc closeouts: all three moved to resolved/
echo ""
echo "Debug-doc closeouts:"
for slug in brain-ask-contract-mismatch-rename brain-topk-uncapped-advisory stale-install-cache-audit-anti-pattern; do
  if [[ -f ".planning/debug/resolved/${slug}.md" ]]; then
    pass "${slug}.md in resolved/"
  else
    fail "${slug}.md NOT in resolved/"
  fi
  if [[ -f ".planning/debug/${slug}.md" ]]; then
    fail "${slug}.md STILL in .planning/debug/ (should be moved)"
  else
    pass "${slug}.md removed from .planning/debug/"
  fi
done

# knowledge-base.md carries 3 new entries
echo ""
echo "knowledge-base.md resolved-pattern entries:"
for slug in brain-ask-contract-mismatch-rename brain-topk-uncapped-advisory stale-install-cache-audit-anti-pattern; do
  if grep -q "^## ${slug}" .planning/debug/knowledge-base.md; then
    pass "knowledge-base entry for ${slug}"
  else
    fail "knowledge-base entry for ${slug} MISSING"
  fi
done

# Part 8 forbidden-substring scan: BRAIN_MAX_TOPK code path must not introduce
# user-content reads. Scoped to the BRAIN_MAX_TOPK + Math.min lines themselves
# (the surface this plan added); broader file-level scan would trip on
# pre-existing prose-comments about envelope payload shapes.
echo ""
echo "Canon Part 8 forbidden-substring scan (D-09 surface only):"
SCAN_PATTERN="USER\.md|room\.db|opportunity-bank|meeting-transcript|process\.env\.HOME"
# Extract just the BRAIN_MAX_TOPK block (the lines this plan added) from each file.
BLOCK_BRAIN_ASK=$(grep -B1 -A2 "BRAIN_MAX_TOPK" mcp-server-brain/lib/brain-ask.cjs 2>/dev/null)
BLOCK_PINECONE=$(grep -B1 -A2 "BRAIN_MAX_TOPK" mcp-server-brain/lib/pinecone-tools.cjs 2>/dev/null)
if echo "$BLOCK_BRAIN_ASK" "$BLOCK_PINECONE" | grep -nE "$SCAN_PATTERN" 2>/dev/null; then
  fail "Part 8 forbidden-substring match in D-09 added code"
else
  pass "Part 8 forbidden-substring scan: ZERO matches in D-09 added code"
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
