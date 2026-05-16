#!/usr/bin/env bash
# Phase 119-00 Wave 1 scaffold harness.
# Mirrors tests/test-117-00-scaffold.sh (5 gates, em-dash-free via printf encoding).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: 3 Phase 119 EVENT_TYPES strings present in memory-events.cjs (literal grep)
for s in room_auto_created room_naming_decided room_discarded; do
  if ! grep -qF "'$s'" lib/core/navigation/memory-events.cjs; then
    fail "missing $s in memory-events.cjs"
  fi
done

# Gate 2: Canon Part 8 invariant -- zero brain-client require in the new files.
# The Task 2 file (room-auto-create.cjs) is checked at end-of-plan acceptance.
# At this gate, we check the files that exist; venture-shape-nudge.cjs is mandatory.
if grep -qE "require\(.*brain-client" lib/core/venture-shape-nudge.cjs; then
  fail "Canon Part 8 breach: brain-client require in venture-shape-nudge.cjs"
fi
if [ -f lib/core/room-auto-create.cjs ] && grep -qE "require\(.*brain-client" lib/core/room-auto-create.cjs; then
  fail "Canon Part 8 breach: brain-client require in room-auto-create.cjs"
fi

# Gate 3: Canon Part 9 invariant -- zero direct room-db.cjs require in production new files.
# Tests are exempt (per Phase 109-06 pre-commit hook allow-list for tests/).
if grep -qE "require\(.*room-db\.cjs" lib/core/venture-shape-nudge.cjs; then
  fail "Canon Part 9 breach: direct room-db.cjs require in venture-shape-nudge.cjs"
fi
if [ -f lib/core/room-auto-create.cjs ] && grep -qE "require\(.*room-db\.cjs" lib/core/room-auto-create.cjs; then
  fail "Canon Part 9 breach: direct room-db.cjs require in room-auto-create.cjs"
fi

# Gate 4: em-dash invariant (HARD RULE per memory feedback_no_emdashes.md).
# U+2014 detected via printf-encoded literal to keep this script em-dash-free.
EMDASH=$(printf '\xe2\x80\x94')
check_files=(
  lib/core/venture-shape-nudge.cjs
  lib/core/venture-shape-nudge.test.cjs
  tests/test-room-auto-create-event-types.cjs
  tests/test-119-00-scaffold.sh
)
if [ -f lib/core/room-auto-create.cjs ]; then
  check_files+=(lib/core/room-auto-create.cjs)
fi
if [ -f lib/core/room-auto-create.test.cjs ]; then
  check_files+=(lib/core/room-auto-create.test.cjs)
fi
if [ -f scripts/room-auto-create-nudge.cjs ]; then
  check_files+=(scripts/room-auto-create-nudge.cjs)
fi
if [ -f tests/test-room-auto-create-fingerprint-integration.cjs ]; then
  check_files+=(tests/test-room-auto-create-fingerprint-integration.cjs)
fi
for f in "${check_files[@]}"; do
  if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
    fail "em-dash present in $f (HARD RULE feedback_no_emdashes)"
  fi
done

# Gate 5: provenance comment present in memory-events.cjs.
if ! grep -qF "Phase 119-00 Wave 1 extension" lib/core/navigation/memory-events.cjs; then
  fail "missing 'Phase 119-00 Wave 1 extension' provenance comment in memory-events.cjs"
fi

echo "OK: 119-00 scaffold complete (3 EVENT_TYPES strings + venture-shape-nudge module + chokepoint invariant + zero em-dashes)"
exit 0
