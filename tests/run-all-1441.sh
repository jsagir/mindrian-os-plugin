#!/usr/bin/env bash
# Phase 144.1 verification aggregator -- the single PASS/FAIL gate proving the
# connector-retrofit sweep is complete: the registry is fully populated
# (commands + skills + agents), the exhaustive-coverage count gate proves every
# live surface is wired-or-allowlisted, the Part-8 boundary holds over the
# populated registry, and the carried 143.3 frozen-bank + drift fences still
# pass. This is the baton for the Phase 146 fully-wired acceptance gate.
#
# Mirrors tests/run-all-1433.sh: a bash PASS/FAIL loop that runs each
# constituent to completion and exits non-zero if any failed.
#
# It composes:
#   (a) the CI tripwire as a direct invocation:
#         node scripts/build-connector-registry.cjs --check
#   (b) the four NEW 144.1 suites:
#         test-connector-agents-walk.cjs           -> Plan 04 agents/-walk
#         test-connector-tier-d-hooks.cjs          -> Plan 06 Tier-D firing
#         test-connector-filing-sweep.cjs          -> Plan 07 filing sweep
#         test-connector-exhaustive-coverage.cjs   -> Plan 08 count gate (RETRO-07c)
#       PLUS the carried 143.3 connector + drift + Part-8 suites (re-run over the
#       now-populated registry so the frozen-bank + Part-8 fences re-validate):
#         test-connector-registry.cjs              -> registry shape + frozen banks
#         test-dispatch-framework-map-drift.cjs    -> OPEN-1 slug-to-name drift fence
#         test-connector-tripwire.cjs              -> four-validation tripwire
#         test-connector-part8-boundary.cjs        -> Part-8 boundary scan (4 threat paths)
#         test-orchestrator-doctrine-presence.cjs  -> ORCH-01..04 presence gate
#         test-reach-ids-drift.cjs                 -> frozen 5 reach_ids (no 6th)
#         test-posture-ids-drift.cjs               -> frozen 3 postures (no 4th)
#   (c) a standalone Part-8 grep sweep over the populated registry + the
#       allow-list for forbidden free-text body fields and egress-projection
#       tokens (mirrors the run-all-1433.sh grep sweep).
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and a final tally; it exits 1 if any failed.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
  test-connector-agents-walk.cjs
  test-connector-tier-d-hooks.cjs
  test-connector-filing-sweep.cjs
  test-connector-exhaustive-coverage.cjs
  test-connector-registry.cjs
  test-dispatch-framework-map-drift.cjs
  test-connector-tripwire.cjs
  test-connector-part8-boundary.cjs
  test-orchestrator-doctrine-presence.cjs
  test-reach-ids-drift.cjs
  test-posture-ids-drift.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 144.1 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The CI tripwire -- direct invocation (the populated registry must not be
#     stale and every connector must pass the four CONN-03 validations).
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: connector-registry --check (CI tripwire) ---"
if node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check; then
  ((PASSED++)); echo ">>> connector-registry --check: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("connector-registry --check"); echo ">>> connector-registry --check: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# (b) The four new 144.1 suites + the carried 143.3 connector/drift/part8 suites.
# ---------------------------------------------------------------------------
for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  ((TOTAL++))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# (c) Standalone Part-8 grep sweep over the populated registry + the allow-list.
#     Any forbidden egress-projection/hash token or free-text body channel in the
#     generated registry or the allow-list would be a Part-8 breach.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (populated registry + allow-list) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "data/connector-registry.json"
  "data/connector-out-of-spine-allowlist.json"
)
# Forbidden egress-projection tokens (mirrors tests/run-all-1433.sh).
FORBIDDEN_TOKENS='projectText|safeNodeProjection|safeContradictionProjection|safeUnsupportedProjection|createHash'
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$FORBIDDEN_TOKENS" "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN projection/hash token in: $t"; PART8_OK=0
  fi
done
# The generated registry must NOT carry a free-text body channel on a connector.
if grep -nE '"(summary|content|body|text|note|description|evidence|turn)"[[:space:]]*:' "$REPO_ROOT/data/connector-registry.json" >/dev/null 2>&1; then
  echo "    FORBIDDEN free-text body field in: data/connector-registry.json"; PART8_OK=0
fi
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (144.1 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
