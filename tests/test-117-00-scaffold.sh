#!/usr/bin/env bash
# Phase 117-00 Wave 0 scaffold harness. Asserts the 16 deliverables landed.
# Mirrors tests/test-116-00-scaffold.sh pattern (5 gates, em-dash-free via printf encoding).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: EVENT_TYPES strings present in memory-events.cjs (literal grep)
for s in auto_explore_fired auto_explore_finding_surfaced auto_explore_user_response auto_explore_skipped brain_canon_drift_observed; do
  if ! grep -qF "'$s'" lib/core/navigation/memory-events.cjs; then
    fail "missing $s in memory-events.cjs"
  fi
done

# Gate 2: TEST_FILES registration in run-feynman-tests.cjs (EXACTLY 12 stubs from Section 5 + Section 8)
expected_count=12
actual_count=$(grep -cE "test-auto-explore-|test-explored-materials-store|test-cross-domain-|test-finding-hsi-|test-f1-bq-|test-detection-routing-|test-brain-canon-drift-" lib/memory/run-feynman-tests.cjs || true)
if [ "$actual_count" != "$expected_count" ]; then
  fail "expected exactly $expected_count test stub registrations, found $actual_count"
fi

# Gate 3: 16 Wave-0 deliverable files present (12 stubs + scaffold + cypher + snapshot + 2 modified)
for f in \
  lib/core/navigation/memory-events.cjs \
  lib/memory/run-feynman-tests.cjs \
  tests/test-auto-explore-event-types.cjs \
  tests/test-auto-explore-fingerprint.cjs \
  tests/test-explored-materials-store.cjs \
  tests/test-auto-explore-fire.cjs \
  tests/test-auto-explore-compose.cjs \
  tests/test-auto-explore-f1-integration.cjs \
  tests/test-auto-explore-canonical-order.cjs \
  tests/test-cross-domain-formula.cjs \
  tests/test-finding-hsi-schema.cjs \
  tests/test-f1-bq-template.cjs \
  tests/test-detection-routing-local-only.cjs \
  tests/test-brain-canon-drift-event.cjs \
  cypher/phase117-auto-explore-completion.cypher \
  .mindrian/auto-explore-framework-snapshot.json
do
  [ -f "$f" ] || fail "missing file: $f"
done

# Gate 4: EVENT_TYPES.size === 31 (runtime check)
actual_size=$(node -e "console.log(require('./lib/core/navigation/memory-events.cjs').EVENT_TYPES.size)")
if [ "$actual_size" != "31" ]; then
  fail "EVENT_TYPES.size expected 31, got $actual_size"
fi

# Gate 5: 0 em-dashes in 117-00 deliverables (U+2014 detected via printf-encoded literal
# to keep this script em-dash-free per memory rule feedback_no_emdashes)
EMDASH=$(printf '\xe2\x80\x94')
for f in \
  tests/test-auto-explore-event-types.cjs \
  tests/test-auto-explore-fingerprint.cjs \
  tests/test-explored-materials-store.cjs \
  tests/test-auto-explore-fire.cjs \
  tests/test-auto-explore-compose.cjs \
  tests/test-auto-explore-f1-integration.cjs \
  tests/test-auto-explore-canonical-order.cjs \
  tests/test-cross-domain-formula.cjs \
  tests/test-finding-hsi-schema.cjs \
  tests/test-f1-bq-template.cjs \
  tests/test-detection-routing-local-only.cjs \
  tests/test-brain-canon-drift-event.cjs \
  cypher/phase117-auto-explore-completion.cypher \
  .mindrian/auto-explore-framework-snapshot.json
do
  if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
    fail "em-dash present in $f (memory rule feedback_no_emdashes)"
  fi
done

echo "OK: 117-00 scaffold complete (5 EVENT_TYPES strings + 12 test stubs + Feynman registration + size 31 + zero em-dashes)"
exit 0
