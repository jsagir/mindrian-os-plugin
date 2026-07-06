---
created: 2026-06-28T12:10:00.000Z
title: section-artifact title/status frontmatter requirement uncovered
area: room
version_found: 1.15.0-beta.10
parent_finding: room-md-artifact-frontmatter-schema-drift (F-03)
files:
  - lib/core/frontmatter-schemas.cjs (artifact-default.required)
---

## Problem

Named follow-on debt split out of F-03 (ROOM.md schema drift). F-03's rework fixes the
ROOM.md half (name/type/section via a shared renderRoomMdFrontmatter chokepoint repointed
across all ~8 emitters). It deliberately does NOT fix the SECTION-ARTIFACT half:

The frontmatter schema validator's artifact-default schema requires `title` (and the live
hook flagged `title`/`status`) on section artifacts, but the documented new-project artifact
frontmatter and several artifact writers omit them. The scaffold itself emits no artifacts,
so this did not surface in the scaffold test, but Larry-filed artifacts and any artifact
emitter that hand-rolls frontmatter will still trip "schema violation: title, status".

## Solution

TBD. Same chokepoint pattern as the ROOM.md fix:
- Decide the canonical artifact frontmatter required set (read artifact-default.required in
  lib/core/frontmatter-schemas.cjs; treat it as canonical or relax it deliberately).
- Add a shared artifact-frontmatter renderer (sibling of renderRoomMdFrontmatter) and repoint
  artifact emitters through it so every filed artifact carries the required keys.
- Update the documented artifact frontmatter in commands/new-project.md to match.
- Add a regression test asserting filed artifacts pass the validator with zero violations.
- Consider whether the validator message should name required-missing vs unexpected keys
  (the warning currently just lists keys, ambiguous to act on).
