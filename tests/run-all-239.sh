#!/usr/bin/env bash
# Phase 239 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# brain-access-surface cluster. Models on tests/run-all-196.sh.
#
# Phase 239 fixes the Brain-access surface: BRAIN-01 (the dead
# mcp__brain_.* hook matchers, three layers deep -- hooks.json x2 plus the
# isBrainTool in-hook re-check), BRAIN-02 (query() carries zero Part-8
# guard, two production doors push user content to the wire uninspected),
# and BRAIN-03 (sendPacket has zero production callers -- park it, do not
# wire it to a new job inside a remediation-only milestone).
#
# WAVE 0 CONTRACT: this runner is authored BEFORE the modules land (Nyquist:
# tests precede implementation). Every phase-test-file leg is run_if,
# GUARDED ON THE TEST FILE ITSELF (not a runtime module), so Wave 1 exits
# cleanly with SKIPs for every tests/test-239-*.cjs file not yet authored.
# As later plans in this phase land each test file, its leg flips from SKIP
# to a real run and the gate tightens.
#
# TWO LEGS BELOW BIND IMMEDIATELY AND ARE NOT run_if-GUARDED. Guarding every
# leg on its own test file would let this phase report all-green with zero
# tests written, which is precisely the vacuous-coverage shape (RESEARCH.md
# T7) this milestone's rigor standard exists to catch:
#
#   Leg A "BRAIN-01 dead-matcher literal census" -- fails today because
#   hooks/hooks.json still has the dead "mcp__brain_.*" matcher and
#   lib/core/brain-response-sanitize.cjs still has the dead
#   indexOf('mcp__brain_') prefix test. Turns GREEN when 239-02 lands.
#
#   Leg B "239 test-file completeness" -- fails today because none of the
#   five tests/test-239-*.cjs files exist yet. Turns GREEN when 239-07
#   lands (the last plan to author one of the five).
#
# A green Leg A or Leg B with no sibling plan (239-02 / 239-07) executed
# would itself be a bug in this runner -- if that ever happens, treat it as
# a regression in this script, not as progress.
#
# bash only. No emoji. No em-dashes.

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
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# LEG A (BINDS IMMEDIATELY, not run_if): BRAIN-01 dead-matcher literal
# census. Modeled on run-all-196.sh's noprivate_regex grep-guard idiom.
# Filters comment lines first (grep -vE '^[[:space:]]*(//|#)') so a header
# comment mentioning the old string cannot self-invalidate the gate, then
# does a literal (-F) match for the two dead-matcher forms.
# EXPECTED RED today. Turns GREEN when 239-02 lands (BRAIN-01 fix).
# ---------------------------------------------------------------------------
brain01_dead_matcher_census() {
  local bad=0
  if grep -vE '^[[:space:]]*(//|#)' hooks/hooks.json 2>/dev/null | grep -qF 'mcp__brain_.*'; then
    echo "hooks/hooks.json still contains the dead literal matcher: mcp__brain_.*"
    bad=1
  fi
  if grep -vE '^[[:space:]]*(//|#)' lib/core/brain-response-sanitize.cjs 2>/dev/null | grep -qF "indexOf('mcp__brain_')"; then
    echo "lib/core/brain-response-sanitize.cjs still contains the dead prefix test: indexOf('mcp__brain_')"
    bad=1
  fi
  [ "$bad" -eq 0 ]
}
run "BRAIN-01 dead-matcher literal census" brain01_dead_matcher_census

# ---------------------------------------------------------------------------
# LEG B (BINDS IMMEDIATELY, not run_if): 239 test-file completeness.
# Fails if any of the five tests/test-239-*.cjs files this phase is
# contracted to ship is absent. EXPECTED RED today. Turns GREEN when 239-07
# lands (the last of the five to be authored).
# ---------------------------------------------------------------------------
PHASE_239_TEST_FILES="
tests/test-239-brain-tool-liveness.cjs
tests/test-239-pii-sanitizer-liveness.cjs
tests/test-239-query-egress-canary.cjs
tests/test-239-sendpacket-parked.cjs
tests/test-239-verify-release-section-18.cjs
"
test239_completeness() {
  local missing=0
  local f
  for f in $PHASE_239_TEST_FILES; do
    if [ ! -f "$f" ]; then
      echo "missing: $f"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ]
}
run "239 test-file completeness" test239_completeness

# ---------------------------------------------------------------------------
# BRAIN-01: live tools/list handshake + checkHookMatcherLiveness verdict +
# both mutation legs (rename a live tool, stale one matcher). run_if
# guarded on the TEST FILE itself (not yet authored in Wave 1).
# ---------------------------------------------------------------------------
run_if "BRAIN-01 tool liveness handshake + mutations" \
  tests/test-239-brain-tool-liveness.cjs \
  node tests/test-239-brain-tool-liveness.cjs

# ---------------------------------------------------------------------------
# BRAIN-01: isBrainTool() true for both plugin-scoped and project-scoped
# live names, false for a foreign server name. Already exists; the
# inversion of its dead-name fixtures is owned by a sibling plan, but the
# file itself is present today so this leg RUNS (not SKIPPED).
# ---------------------------------------------------------------------------
run_if "BRAIN-01 isBrainTool matcher unit (mcp__brain_response_sanitize)" \
  tests/test-brain-response-sanitize.cjs \
  node tests/test-brain-response-sanitize.cjs

# ---------------------------------------------------------------------------
# BRAIN-01: PostToolUse PII-sanitizer hook fires on a live tool name.
# run_if guarded on the TEST FILE itself (not yet authored in Wave 1).
# ---------------------------------------------------------------------------
run_if "BRAIN-01 PII sanitizer hook liveness" \
  tests/test-239-pii-sanitizer-liveness.cjs \
  node tests/test-239-pii-sanitizer-liveness.cjs

# ---------------------------------------------------------------------------
# BRAIN-02: canary in opportunity.domain and in a Blue Hat methodology_notes
# entry is caught before the wire; capture server records zero canary
# bytes; mutation removing query() coverage turns it red; both regression
# legs (template laundering, sanitize-before-classify ordering). run_if
# guarded on the TEST FILE itself (not yet authored in Wave 1).
# ---------------------------------------------------------------------------
run_if "BRAIN-02 query egress canary + regressions" \
  tests/test-239-query-egress-canary.cjs \
  node tests/test-239-query-egress-canary.cjs

# ---------------------------------------------------------------------------
# BRAIN-03: census asserts zero production sendPacket( call sites outside
# the allowlist; dated park note exists at the call surface and in docs;
# the two contradictory in-repo claims are reconciled. run_if guarded on
# the TEST FILE itself (not yet authored in Wave 1).
# ---------------------------------------------------------------------------
run_if "BRAIN-03 sendPacket parked census" \
  tests/test-239-sendpacket-parked.cjs \
  node tests/test-239-sendpacket-parked.cjs

# ---------------------------------------------------------------------------
# BRAIN-01: SC1 liveness gate is load-bearing -- wired into a real blocking
# gate (scripts/verify-release section 18), not only a phase-local test.
# run_if guarded on the TEST FILE itself (not yet authored in Wave 1).
# ---------------------------------------------------------------------------
run_if "BRAIN-01 verify-release section 18 wiring" \
  tests/test-239-verify-release-section-18.cjs \
  node tests/test-239-verify-release-section-18.cjs

# ---------------------------------------------------------------------------
# seam-liveness.cjs unit suite. Phase 239 is its FIRST production consumer
# (per 239-RESEARCH.md); this file is already shipped and already green,
# so this leg RUNS today per 239-VALIDATION.md's per-task-commit sampling
# rate, not merely SKIPS.
# ---------------------------------------------------------------------------
run_if "seam-liveness unit suite (shipped, first 239 consumer)" \
  lib/core/seam-liveness.test.cjs \
  node lib/core/seam-liveness.test.cjs

echo "========================================"
echo "  Summary (239 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
