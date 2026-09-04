#!/usr/bin/env bash
# Phase 119-02 -- 6-gate shell harness for the room-skeleton-scaffold module.
#
# Verifies the structural invariants of the Plan 119-02 deliverables:
#   Gate 1: the 5 templates exist with non-zero size.
#   Gate 2: the verbatim D-05 voice line is present (runtime-equal, not source-grep).
#   Gate 3: no Brain MCP coupling (Canon Part 8).
#   Gate 4: no direct room-db.cjs require (Canon Part 9 chokepoint preserved).
#   Gate 5: zero em-dash characters across new files (HARD RULE).
#   Gate 6: the section/identity tables cannot drift apart (SECTION_METADATA
#     covers every SECTION_NAMES entry with real fields; every
#     IDENTITY_DIRECTORIES entry carries its required fields). This gate
#     proves table drift is impossible, not any particular count -- the
#     sanctioned home of the exactly-N count assertions is
#     lib/core/room-skeleton-scaffold.test.cjs's Bonus Test 15.

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

# Gate 6: table-drift invariant -- SECTION_METADATA cannot fall out of sync
# with SECTION_NAMES, and every IDENTITY_DIRECTORIES entry carries its
# required fields. This proves the tables cannot drift apart; it does not
# restate any particular count (that literal's one sanctioned home is
# lib/core/room-skeleton-scaffold.test.cjs's Bonus Test 15).
node -e "
  const s = require('./lib/core/room-skeleton-scaffold.cjs');

  if (s.SECTION_NAMES.length <= 0) {
    console.error('SECTION_NAMES must be non-empty');
    process.exit(1);
  }

  const metaKeys = Object.keys(s.SECTION_METADATA);
  if (metaKeys.length !== s.SECTION_NAMES.length) {
    console.error('SECTION_METADATA key count (' + metaKeys.length + ') does not match SECTION_NAMES length (' + s.SECTION_NAMES.length + ')');
    process.exit(1);
  }

  for (const slug of s.SECTION_NAMES) {
    const meta = s.SECTION_METADATA[slug];
    if (!meta) {
      console.error('SECTION_METADATA missing entry for SECTION_NAMES slug: ' + slug);
      process.exit(1);
    }
    if (typeof meta.purpose !== 'string' || meta.purpose.length === 0) {
      console.error('SECTION_METADATA[' + slug + '].purpose must be a non-empty string');
      process.exit(1);
    }
    if (typeof meta.statement !== 'string' || meta.statement.length === 0) {
      console.error('SECTION_METADATA[' + slug + '].statement must be a non-empty string');
      process.exit(1);
    }
    if (!Array.isArray(meta.stage_relevance)) {
      console.error('SECTION_METADATA[' + slug + '].stage_relevance must be an array');
      process.exit(1);
    }
    if (!Array.isArray(meta.default_methodologies)) {
      console.error('SECTION_METADATA[' + slug + '].default_methodologies must be an array');
      process.exit(1);
    }
  }

  const identityKeys = Object.keys(s.IDENTITY_DIRECTORIES);
  if (identityKeys.length <= 0) {
    console.error('IDENTITY_DIRECTORIES must be non-empty');
    process.exit(1);
  }
  for (const name of identityKeys) {
    const entry = s.IDENTITY_DIRECTORIES[name];
    if (typeof entry.directory_type !== 'string' || entry.directory_type.length === 0) {
      console.error('IDENTITY_DIRECTORIES[' + name + '].directory_type must be a non-empty string');
      process.exit(1);
    }
    if (typeof entry.purpose !== 'string' || entry.purpose.length === 0) {
      console.error('IDENTITY_DIRECTORIES[' + name + '].purpose must be a non-empty string');
      process.exit(1);
    }
  }
" || fail 6 "SECTION_METADATA / IDENTITY_DIRECTORIES table drift detected"

echo "OK: 119-02 scaffold complete (5 templates + skeleton orchestrator + thinness voice + chokepoint invariant + SECTION_METADATA/IDENTITY_DIRECTORIES drift-proof + zero em-dashes)"
exit 0
