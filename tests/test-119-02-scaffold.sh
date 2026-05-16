#!/usr/bin/env bash
# Phase 119-02 -- 6-gate shell harness for the room-skeleton-scaffold module.
#
# Verifies the structural invariants of the Plan 119-02 deliverables:
#   Gate 1: the 5 templates exist with non-zero size.
#   Gate 2: the verbatim D-05 voice line is present (runtime-equal, not source-grep).
#   Gate 3: no Brain MCP coupling (Canon Part 8).
#   Gate 4: no direct room-db.cjs require (Canon Part 9 chokepoint preserved).
#   Gate 5: zero em-dash characters across new files (HARD RULE).
#   Gate 6: SECTION_NAMES has 8 entries; IDENTITY_DIRECTORIES has 5.

set -e
cd "$(dirname "$0")/.."

fail() { echo "FAIL gate $1: $2" >&2; exit 1; }

# Gate 1: 5 templates exist with non-zero size
for f in \
  templates/room-skeleton/STATE.md.tmpl \
  templates/room-skeleton/MINTO.md.tmpl \
  templates/room-skeleton/ROOM.md.section.tmpl \
  templates/room-skeleton/ROOM.md.identity.tmpl \
  templates/room-skeleton/USER.md.tmpl; do
  [ -s "$f" ] || fail 1 "template missing or empty: $f"
done

# Gate 2: runtime verbatim voice line check (more reliable than source-grep
# because the source uses string concat for readability)
VOICE=$(node -e "process.stdout.write(require('./lib/core/larry-thinness-acknowledgment.cjs').THINNESS_VOICE_LINE)")
EXPECTED="I made a room around this -- it's mostly empty until we have more to work with. Want to keep going and see what fills in?"
[ "$VOICE" = "$EXPECTED" ] || fail 2 "voice line drift -- got: [$VOICE]"

# Gate 3: zero Brain MCP coupling (Canon Part 8)
if grep -qE "require\([^)]*brain-client|fetch\([^)]*brain\.mindrian" \
  lib/core/room-skeleton-scaffold.cjs \
  lib/core/larry-thinness-acknowledgment.cjs; then
  fail 3 "Brain MCP coupling detected"
fi

# Gate 4: no direct room-db.cjs require in the scaffold module (Canon Part 9)
if grep -qE "require\([^)]*room-db\.cjs" lib/core/room-skeleton-scaffold.cjs; then
  fail 4 "room-db.cjs require found (chokepoint violation)"
fi

# Gate 5: zero em-dash characters across new files (HARD RULE)
# Use grep -l so it reports files containing the char, not counts (counts are
# noisy because templates use ASCII -- as the canonical double-hyphen substitute)
EMDASH_FILES=$(grep -l "$(printf '\xe2\x80\x94')" \
  lib/core/room-skeleton-scaffold.cjs \
  lib/core/larry-thinness-acknowledgment.cjs \
  lib/core/larry-thinness-acknowledgment.test.cjs \
  templates/room-skeleton/*.tmpl 2>/dev/null || true)
[ -z "$EMDASH_FILES" ] || fail 5 "em-dash U+2014 in: $EMDASH_FILES"

# Gate 6: 8 sections + 5 identity dirs
node -e "
  const s = require('./lib/core/room-skeleton-scaffold.cjs');
  if (s.SECTION_NAMES.length !== 8) { console.error('SECTION_NAMES != 8: ' + s.SECTION_NAMES.length); process.exit(1); }
  if (Object.keys(s.IDENTITY_DIRECTORIES).length !== 5) { console.error('IDENTITY_DIRECTORIES != 5: ' + Object.keys(s.IDENTITY_DIRECTORIES).length); process.exit(1); }
" || fail 6 "section / identity counts wrong"

echo "OK: 119-02 scaffold complete (5 templates + skeleton orchestrator + thinness voice + chokepoint invariant + 8 ICM sections + zero em-dashes)"
exit 0
