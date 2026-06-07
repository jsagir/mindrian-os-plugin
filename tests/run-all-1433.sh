#!/usr/bin/env bash
# Phase 143.3 verification aggregator -- the single PASS/FAIL gate proving the
# connector spine + the intelligence orchestrator are correct and that the
# constitutional boundary (Canon Part 8) holds across the new spine.
#
# Mirrors tests/run-all-122.sh and tests/run-all-143.sh: a bash PASS/FAIL loop
# that runs each constituent to completion and exits non-zero if any failed.
#
# It composes:
#   (a) the CI tripwire as a direct invocation:
#         node scripts/build-connector-registry.cjs --check
#   (b) the five CJS suites (Plan 01/02 + the Plan 04 net-new):
#         test-connector-registry.cjs              -> Plan 01 registry shape + frozen banks
#         test-dispatch-framework-map-drift.cjs    -> Plan 01 OPEN-1 slug-to-name drift fence
#         test-connector-tripwire.cjs              -> Plan 02 four-validation tripwire
#         test-connector-part8-boundary.cjs        -> Plan 04 Part-8 boundary scan (4 threat paths)
#         test-orchestrator-doctrine-presence.cjs  -> Plan 04 ORCH-01..04 presence gate
#   (c) the CARRIED drift fences (the reach-drift / posture-drift hard fences the
#       suite MUST compose per the phase contract):
#         test-reach-ids-drift.cjs                 -> frozen 5 reach_ids (no 6th)
#         test-posture-ids-drift.cjs               -> frozen 3 postures (no 4th)
#   (d) a standalone Part-8 grep sweep over the new artifacts for forbidden
#       user-content-to-Brain patterns. (Advisory LOW-3: run-all-143.sh has no
#       single Part-8 grep line -- it delegates to a CJS sweep -- so this suite
#       adds a standalone grep sweep rather than mirroring a nonexistent line.)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and a final tally; it exits 1 if any failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

CJS_SUITES=(
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
echo "  Phase 143.3 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (a) The CI tripwire -- direct invocation (the registry must not be stale and
#     every connector must pass the four CONN-03 validations).
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
# (b) + (c) The CJS suites + the carried drift fences.
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
# (d) Standalone Part-8 grep sweep over the new spine artifacts. Any forbidden
#     user-content-to-Brain pattern (a brain-client require, an egress projection
#     token, or a hashing call) in the generator OUTSIDE the refresh-names branch
#     would be a Part-8 breach. Here we sweep the generated artifacts + the skill
#     for free-text body channels and projection tokens that must never appear.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (new spine artifacts) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "data/connector-registry.json"
  "data/dispatch-framework-map.json"
  "skills/intelligence-orchestrator/SKILL.md"
)
# Forbidden egress-projection tokens (mirrors tests/test-sensors-part8-sweep.cjs).
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
if grep -nE '"(summary|content|body|text|note|description)"[[:space:]]*:' "$REPO_ROOT/data/connector-registry.json" >/dev/null 2>&1; then
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
echo "  Summary (143.3 verification)"
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
