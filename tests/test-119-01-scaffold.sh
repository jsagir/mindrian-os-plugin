#!/usr/bin/env bash
# Phase 119-01 Wave 2 scaffold harness.
# Mirrors tests/test-119-00-scaffold.sh (7 gates, em-dash-free via printf encoding).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Gate 1: room_discard_partial_failure EVENT_TYPES string present in memory-events.cjs (literal grep)
if ! grep -qF "'room_discard_partial_failure'" lib/core/navigation/memory-events.cjs; then
  fail "missing 'room_discard_partial_failure' in memory-events.cjs"
fi

# Gate 2: Provenance comment present in memory-events.cjs (Phase 119-01 block landed)
if ! grep -qF "Phase 119-01 Wave 2 extension" lib/core/navigation/memory-events.cjs; then
  fail "missing 'Phase 119-01 Wave 2 extension' provenance comment in memory-events.cjs"
fi

# Gate 3: Canon Part 8 invariant -- zero brain-client / brain.mindrian / fetch.+brain in the
# new files. Files-created-in-subsequent-tasks (validator / discard cascade / naming-selector)
# are checked only when they exist (defensive for partial-execution flows).
CHECK_FILES_PART8=(
  lib/core/llm-name-suggester.cjs
)
for f in lib/core/room-name-validator.cjs lib/core/room-discard-cascade.cjs lib/core/room-naming-selector.cjs scripts/room-naming-selector.cjs; do
  if [ -f "$f" ]; then
    CHECK_FILES_PART8+=("$f")
  fi
done
for f in "${CHECK_FILES_PART8[@]}"; do
  # Use literal-substring greps (-F) to avoid regex ambiguity with the dot in
  # brain.mindrian (which would match brain<anychar>mindrian too).
  if grep -qF "brain.mindrian" "$f"; then
    fail "Canon Part 8 breach: brain.mindrian substring in $f"
  fi
  if grep -qE "require\([^)]*brain-client[^)]*\)" "$f"; then
    fail "Canon Part 8 breach: brain-client require in $f"
  fi
  if grep -qE "fetch\([^)]*['\"][^'\"]*brain[^'\"]*['\"]" "$f"; then
    fail "Canon Part 8 breach: fetch to brain.* host in $f"
  fi
done

# Gate 4: HAIKU_MODEL_ID present in llm-name-suggester.cjs >= 2 times (constant declaration + export)
HMID_COUNT=$(grep -c "HAIKU_MODEL_ID" lib/core/llm-name-suggester.cjs || true)
if [ "${HMID_COUNT:-0}" -lt 2 ]; then
  fail "HAIKU_MODEL_ID appears $HMID_COUNT times in lib/core/llm-name-suggester.cjs (expected >= 2)"
fi

# Gate 5: FALLBACK_SUGGESTION present >= 2 times (constant + export)
FB_COUNT=$(grep -c "FALLBACK_SUGGESTION" lib/core/llm-name-suggester.cjs || true)
if [ "${FB_COUNT:-0}" -lt 2 ]; then
  fail "FALLBACK_SUGGESTION appears $FB_COUNT times in lib/core/llm-name-suggester.cjs (expected >= 2)"
fi

# Gate 6: F.1 verbatim option labels present in room-naming-selector.cjs (end-of-plan acceptance).
# Defensive: skip when the file does not yet exist (Task 3 creates it).
if [ -f lib/core/room-naming-selector.cjs ]; then
  LABEL_COUNT=$(grep -cE "\[name this room:|\[type your own name\]|\[keep as untitled\]|\[discard room\]" lib/core/room-naming-selector.cjs || true)
  if [ "${LABEL_COUNT:-0}" -lt 4 ]; then
    fail "F.1 verbatim labels missing in lib/core/room-naming-selector.cjs (got $LABEL_COUNT, expected >= 4)"
  fi
fi

# Gate 7: em-dash invariant (HARD RULE per memory feedback_no_emdashes.md).
# U+2014 detected via printf-encoded literal so this script stays em-dash-free.
EMDASH=$(printf '\xe2\x80\x94')
EMDASH_FILES=(
  lib/core/llm-name-suggester.cjs
  lib/core/llm-name-suggester.test.cjs
  tests/test-119-01-scaffold.sh
)
for f in lib/core/room-name-validator.cjs lib/core/room-name-validator.test.cjs lib/core/room-discard-cascade.cjs lib/core/room-discard-cascade.test.cjs lib/core/room-naming-selector.cjs lib/core/room-naming-selector.test.cjs scripts/room-naming-selector.cjs scripts/check-pending-naming-decision.cjs tests/test-room-naming-selector-integration.cjs; do
  if [ -f "$f" ]; then
    EMDASH_FILES+=("$f")
  fi
done
for f in "${EMDASH_FILES[@]}"; do
  if grep -F "$EMDASH" "$f" >/dev/null 2>&1; then
    fail "em-dash present in $f (HARD RULE feedback_no_emdashes)"
  fi
done

echo "OK: 119-01 scaffold complete (1 EVENT_TYPES string + llm-name-suggester LOCAL invariant + Haiku 4.5 model ID + verbatim F.1 labels reserved + zero em-dashes)"
exit 0
