#!/usr/bin/env bash
# Phase 116-00 Wave 0 scaffold harness. Asserts the 9 deliverables landed.
# Mirrors tests/test-89-07-00-scaffold.sh pattern (5 gates, em-dash-free via printf encoding).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: EVENT_TYPES strings present in memory-events.cjs (literal grep)
for s in tension_detected tension_surfaced tension_resolved tension_decayed tension_skipped; do
  if ! grep -qF "'$s'" lib/core/navigation/memory-events.cjs; then
    fail "missing $s in memory-events.cjs"
  fi
done

# Gate 2: TEST_FILES registration in run-feynman-tests.cjs (>= 5 hits)
expected_count=5
actual_count=$(grep -c "test-tension-hook-" lib/memory/run-feynman-tests.cjs || true)
if [ "$actual_count" -lt "$expected_count" ]; then
  fail "expected $expected_count test-tension-hook- registrations, found $actual_count"
fi

# Gate 3: 9 Wave-0 deliverable files present
for f in \
  lib/core/navigation/memory-events.cjs \
  lib/memory/run-feynman-tests.cjs \
  tests/test-tension-hook-detection.cjs \
  tests/test-tension-hook-decay.cjs \
  tests/test-tension-hook-telemetry.cjs \
  tests/test-tension-hook-f1-integration.cjs \
  tests/test-tension-hook-rendering.cjs \
  cypher/phase116-tension-hook-completion.cypher \
  .mindrian/tension-framework-snapshot.json
do
  [ -f "$f" ] || fail "missing file: $f"
done

# Gate 4: EVENT_TYPES.size === 26 (runtime check)
actual_size=$(node -e "console.log(require('./lib/core/navigation/memory-events.cjs').EVENT_TYPES.size)")
if [ "$actual_size" != "26" ]; then
  fail "EVENT_TYPES.size expected 26, got $actual_size"
fi

# Gate 5: 0 em-dashes in 116-00 deliverables (U+2014 detected via printf-encoded literal
# to keep this script em-dash-free per memory rule feedback_no_emdashes)
EMDASH=$(printf '\xe2\x80\x94')
for f in \
  tests/test-tension-hook-detection.cjs \
  tests/test-tension-hook-decay.cjs \
  tests/test-tension-hook-telemetry.cjs \
  tests/test-tension-hook-f1-integration.cjs \
  tests/test-tension-hook-rendering.cjs \
  cypher/phase116-tension-hook-completion.cypher \
  .mindrian/tension-framework-snapshot.json
do
  if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
    fail "em-dash present in $f (memory rule feedback_no_emdashes)"
  fi
done

echo "OK: 116-00 scaffold complete (5 EVENT_TYPES strings + 5 test stubs + Feynman registration + size 26 + zero em-dashes)"
exit 0
