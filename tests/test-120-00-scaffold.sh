#!/usr/bin/env bash
# Phase 120-00 Wave 1 scaffold harness.
# Mirrors tests/test-119-00-scaffold.sh (5 gates, em-dash-free via printf encoding).
# Asserts 9 gates: 6 EVENT_TYPES + 1 ALLOWED_EDGE_TYPES + zero Brain client require +
# zero em-dashes across all new files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gates 1-6: 6 Phase 120 EVENT_TYPES strings present in memory-events.cjs.
for s in breakthrough_detected_soft breakthrough_surfaced breakthrough_confirmed breakthrough_dismissed breakthrough_filed_as_decision breakthrough_throttled; do
  if ! grep -qF "'$s'" lib/core/navigation/memory-events.cjs; then
    fail "missing $s in memory-events.cjs"
  fi
done

# Gate 7: DERIVED_FROM present in edges.cjs.
if ! grep -qF "'DERIVED_FROM'" lib/core/navigation/edges.cjs; then
  fail "missing DERIVED_FROM in lib/core/navigation/edges.cjs"
fi

# Gate 8: Canon Part 8 invariant -- zero brain-client require + zero brain.mindrian
# fetch across the new breakthrough/ files and the two scaffold test files.
# The detectors + schema files may not exist yet at Task 1 commit time; check
# conditionally so this harness can run after each task lands.
SCAN_TARGETS=(
  tests/test-breakthrough-event-types.cjs
  tests/test-breakthrough-edge-types.cjs
)
if [ -d lib/core/breakthrough ]; then
  while IFS= read -r f; do
    SCAN_TARGETS+=("$f")
  done < <(find lib/core/breakthrough -type f -name '*.cjs' 2>/dev/null || true)
fi
for f in "${SCAN_TARGETS[@]}"; do
  if [ -f "$f" ] && grep -qE 'require\([^)]*brain-client|fetch\([^)]*brain\.mindrian' "$f"; then
    fail "Canon Part 8 breach: brain-client require or brain.mindrian fetch in $f"
  fi
done

# Gate 9: em-dash invariant (HARD RULE per memory feedback_no_emdashes.md).
# U+2014 detected via printf-encoded literal to keep this script em-dash-free.
EMDASH=$(printf '\xe2\x80\x94')
EM_CHECK_FILES=(
  tests/test-breakthrough-event-types.cjs
  tests/test-breakthrough-edge-types.cjs
  tests/test-120-00-scaffold.sh
)
if [ -d lib/core/breakthrough ]; then
  while IFS= read -r f; do
    EM_CHECK_FILES+=("$f")
  done < <(find lib/core/breakthrough -type f -name '*.cjs' 2>/dev/null || true)
fi
for f in "${EM_CHECK_FILES[@]}"; do
  if [ -f "$f" ] && grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
    fail "em-dash present in $f (HARD RULE feedback_no_emdashes)"
  fi
done

# Provenance comment gates.
if ! grep -qF "Phase 120-00 Wave 1 extension" lib/core/navigation/memory-events.cjs; then
  fail "missing 'Phase 120-00 Wave 1 extension' provenance comment in memory-events.cjs"
fi
if ! grep -qF "Phase 120-00 Wave 1 extension" lib/core/navigation/edges.cjs; then
  fail "missing 'Phase 120-00 Wave 1 extension' provenance comment in edges.cjs"
fi

echo "OK: 120-00 scaffold complete (6 EVENT_TYPES + 1 ALLOWED_EDGE_TYPES + zero Brain client require + zero em-dashes)"
exit 0
