#!/usr/bin/env bash
# Phase 127 scoped runner -- run before each 127 task commit. Expect GREEN
# once all 4 plans land (each plan adds its own test suite here):
#   test-127-00-shim-handshake.sh          -> Plan 127-00 (stdio shim + DirectiveEnvelope + .mcp.json)
#   test-127-01-migration-safety.sh        -> Plan 127-01 (auto-migration + 4 safety guards SG-1..SG-4)
#   test-127-02-doctor-class-m.sh          -> Plan 127-02 (Doctor Class M Brain smoke + Tier-0 chokepoint)
#   test-127-03-acceptance-gates.sh        -> Plan 127-03 (4-fixture acceptance gates 1-5)
#   test-127-03-canon-part-8-adversarial.sh -> Plan 127-03 (Canon Part 8 delegation property)
#   test-127-03-no-em-dashes.sh            -> Plan 127-03 (HARD RULE no em-dashes)
#
# CJS unit suites (cross-plan; resolved relative to repo root):
#   ../lib/core/mindrian-brain-shim.test.cjs                -> Plan 127-00 (shim transport)
#   ../lib/core/directive-envelope.test.cjs                 -> Plan 127-00 (envelope wire)
#   ../scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs -> Plan 127-01 (migration logic)
#   ../lib/core/migration-snapshot.test.cjs                 -> Plan 127-01 (snapshot serializer)
#   ../lib/core/doctor/class-m-brain-smoke.test.cjs         -> Plan 127-02 (5-layer probe)
#   ../lib/core/refusal-messaging.test.cjs                  -> Plan 127-02 (Tier-0 chokepoint; renamed 252-01)
#
# Phase 127.1 family (server-side substrate swap; Pinecone -> Neo4j HNSW):
#   127.1-embedding-integrity.test.cjs   -> Plan 127.1-01 produces embedding-manifest.fixture.json
#   127.1-index-config.test.cjs          -> Plan 127.1-02 produces index-config.fixture.json
#   127.1-query-embedder.test.cjs        -> Plan 127.1-03 produces mcp-server-brain/lib/query-embedder.cjs (server-side e5-large query embedding; hermetic, mocked transport)
#   127.1-graphrag-overlap.test.cjs      -> Plan 127.1-03 produces overlap-baseline + overlap-neo4j fixtures (BLOCKING cutover gate)
#
# This runner MUST run to completion (no crash) even when any suite fails; it
# prints a per-suite PASS/FAIL line and exits non-zero if any suite failed.
#
# CJS_SUITES entries are resolved relative to this directory (tests/); an entry
# may be "../lib/..." to reach a suite that lives under lib/.
#
# Note: the plan-checker spec named bin/mindrian-brain-mcp-client.test.cjs for
# the shim test; the actual file shipped by Plan 127-00 is
# lib/core/mindrian-brain-shim.test.cjs (the shim's unit test lives next to
# the chokepoint it covers, not next to the shim bin). Rule 1 deviation
# documented in 127-03-SUMMARY.md.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_TIME=$(date +%s)

SHELL_SUITES=(
  test-127-00-shim-handshake.sh
  test-127-01-migration-safety.sh
  test-127-02-doctor-class-m.sh
  test-127-03-acceptance-gates.sh
  test-127-03-canon-part-8-adversarial.sh
  test-127-03-no-em-dashes.sh
)
CJS_SUITES=(
  ../lib/core/mindrian-brain-shim.test.cjs
  ../lib/core/directive-envelope.test.cjs
  ../scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs
  ../lib/core/migration-snapshot.test.cjs
  ../lib/core/doctor/class-m-brain-smoke.test.cjs
  ../lib/core/refusal-messaging.test.cjs
  127.1-embedding-integrity.test.cjs
  127.1-index-config.test.cjs
  127.1-query-embedder.test.cjs
  127.1-graphrag-overlap.test.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 127 scoped test runner"
echo "========================================"
echo ""

for s in "${SHELL_SUITES[@]}"; do
  p="$SCRIPT_DIR/$s"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: $s ---"
  if [[ ! -f "$p" ]]; then
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$s (missing)")
    echo ">>> $s: MISSING"
    echo ""
    continue
  fi
  if bash "$p"; then
    PASSED=$((PASSED + 1))
    echo ">>> $s: PASSED"
  else
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$s")
    echo ">>> $s: FAILED"
  fi
  echo ""
done

for c in "${CJS_SUITES[@]}"; do
  p="$SCRIPT_DIR/$c"
  TOTAL=$((TOTAL + 1))
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$c (missing)")
    echo ">>> $c: MISSING"
    echo ""
    continue
  fi
  if node "$p"; then
    PASSED=$((PASSED + 1))
    echo ">>> $c: PASSED"
  else
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$c")
    echo ">>> $c: FAILED"
  fi
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (127 scoped)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed (see header for plan ownership):"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
