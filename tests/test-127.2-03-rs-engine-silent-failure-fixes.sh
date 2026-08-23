#!/usr/bin/env bash
# Phase 127.2 Plan 03 smoke test -- RS-engine silent-failure HOTFIX (F1 + F2 + F7).
#
# Verifies the three landed artifacts from the Windows tester 2026-05-23
# silent-failure RCA:
#   F1 -- scripts/doctor.cjs gains --check-rs-engine pre-flight with actionable fix line.
#   F2 -- lib/agents/reverse-salient-agent.cjs forwards stderr last 200 chars to result.detail.diagnostic.
#   F7 -- commands/find-bottlenecks.md empty-result UX mentions /mos:doctor --check-rs-engine.
#
# Plus functional probe: `node scripts/doctor.cjs --check-rs-engine --json` returns valid JSON.
#
# Exit 0 = all checks pass; exit 1 = any check failed.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL  $1"; }

echo "Phase 127.2 Plan 03 smoke test -- RS-engine silent-failure HOTFIX"
echo "Repo: $REPO_ROOT"
echo ""

# Check 1: F1 -- doctor.cjs has --check-rs-engine flag handler.
if grep -q 'check-rs-engine' scripts/doctor.cjs; then
  pass "F1 doctor.cjs has --check-rs-engine flag handler"
else
  fail "F1 doctor.cjs missing --check-rs-engine flag handler"
fi

# Check 2: F1 -- actionable fix line embedded in doctor.cjs.
if grep -q 'pip install -r requirements-hsi.txt' scripts/doctor.cjs; then
  pass "F1 actionable fix line embedded in doctor.cjs"
else
  fail "F1 actionable fix line missing from doctor.cjs"
fi

# Check 3: F2 -- reverse-salient-agent.cjs forwards stderr to result.detail.diagnostic.
if grep -q 'diagnostic' lib/agents/reverse-salient-agent.cjs; then
  pass "F2 reverse-salient-agent.cjs references diagnostic field"
else
  fail "F2 reverse-salient-agent.cjs missing diagnostic field reference"
fi

# Check 4: F2 -- agent captures stderr (not just e.message).
if grep -qE 'e\.stderr|stderrRaw' lib/agents/reverse-salient-agent.cjs; then
  pass "F2 reverse-salient-agent.cjs captures child stderr"
else
  fail "F2 reverse-salient-agent.cjs does NOT capture child stderr"
fi

# Check 5: F7 -- find-bottlenecks.md empty-result copy mentions check-rs-engine.
if grep -q 'check-rs-engine' commands/find-bottlenecks.md; then
  pass "F7 find-bottlenecks.md mentions /mos:doctor --check-rs-engine"
else
  # Fallback: agent file may carry the copy instead.
  if grep -q 'check-rs-engine' lib/agents/reverse-salient-agent.cjs; then
    pass "F7 reverse-salient-agent.cjs mentions /mos:doctor --check-rs-engine (alt surface)"
  else
    fail "F7 neither find-bottlenecks.md nor reverse-salient-agent.cjs mentions /mos:doctor --check-rs-engine"
  fi
fi

# Check 6: functional probe -- doctor.cjs --check-rs-engine --json returns valid JSON.
PROBE_OUTPUT="$(node scripts/doctor.cjs --check-rs-engine --json 2>&1 | head -40)"
PROBE_EXIT=$?
if echo "$PROBE_OUTPUT" | head -1 | grep -q '^{'; then
  # Verify it parses as JSON via node.
  if node -e "JSON.parse(process.argv[1])" "$PROBE_OUTPUT" 2>/dev/null; then
    pass "functional probe: --check-rs-engine --json returns valid JSON (exit $PROBE_EXIT)"
  else
    # Multi-line JSON; try assembling it differently.
    if node -e "const o = JSON.parse(\`$(node scripts/doctor.cjs --check-rs-engine --json 2>/dev/null)\`); if (typeof o.ok === 'boolean') process.exit(0); process.exit(1);" 2>/dev/null; then
      pass "functional probe: --check-rs-engine --json returns valid multi-line JSON (exit $PROBE_EXIT)"
    else
      fail "functional probe: output looks JSON-ish but does not parse: $PROBE_OUTPUT"
    fi
  fi
else
  fail "functional probe: --check-rs-engine --json did NOT return JSON. Output: $PROBE_OUTPUT"
fi

# Check 7: functional probe -- --check-rs-engine --help text mentions actionable fix.
HELP_OUTPUT="$(node scripts/doctor.cjs --help 2>&1)"
if echo "$HELP_OUTPUT" | grep -q 'check-rs-engine'; then
  pass "--help documents --check-rs-engine"
else
  fail "--help does NOT document --check-rs-engine"
fi

# Check 8 (RCA rs-engine-python-insert-not-null-and-detail-drop-regression,
# 2026-08-24): detectAndSurface's failure-path early return must forward
# rs.detail, not just rs.reason -- otherwise the F2 fix above is unreachable
# from the public entry point /mos:find-bottlenecks actually calls, and the
# empty-result UX (commands/find-bottlenecks.md) has nothing to disambiguate
# "no findings" from "analyzer down" with. Functional coverage (both the
# string-detail and { message, diagnostic }-object-detail shapes) lives in
# tests/test-reverse-salient-agent.cjs; this is the fast static guard.
if grep -q 'reason: rs.reason, detail: rs.detail' lib/agents/reverse-salient-agent.cjs; then
  pass "F2-regression detectAndSurface forwards rs.detail on failure"
else
  fail "F2-regression detectAndSurface does NOT forward rs.detail on failure (detail-drop regression is back)"
fi

echo ""
echo "Results: $PASS pass, $FAIL fail"

if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
fi
echo "SOME CHECKS FAILED"
exit 1
