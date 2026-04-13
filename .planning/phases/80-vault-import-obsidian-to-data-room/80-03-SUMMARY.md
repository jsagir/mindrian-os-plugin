---
phase: 80-vault-import-obsidian-to-data-room
plan_id: 80-03
plan: 3
wave: 1
status: complete
completed: 2026-04-13
requirements: [IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-08, IMPORT-09]
subsystem: import
tags: [router, enricher, wikilink, inbox, room-md, state-md, minto, speaker-profile]
dependency_graph:
  requires: [80-01]
  provides:
    - "lib/import/router.cjs::routeFiles"
    - "lib/import/enricher.cjs::enrichRoom"
    - "scripts/wikilink-batch.cjs CLI"
    - "scripts/create-speaker-profile --layout=import"
  affects: [80-04, 80-06]
tech_stack:
  added: []
  patterns:
    - "Decision 16 nested artifact layout (section/slug/slug.md)"
    - "Decision 15 ROOM.md everywhere (intermediate folders included)"
    - "writeIfMissing idempotency guard"
    - "Phase 79 buildTeamLinks adapter via teamProfilesFromManifest"
    - "MWP canonical edge declaration (INFORMS, CONVERGES) in ROOM.md HTML comment"
key_files:
  created:
    - lib/import/router.cjs
    - lib/import/router.test.cjs
    - lib/import/enricher.cjs
    - lib/import/enricher.test.cjs
    - scripts/wikilink-batch.cjs
  modified:
    - scripts/create-speaker-profile
decisions:
  - "MWP edges on ROOM.md scaffolds use canonical names INFORMS + CONVERGES (not invented PART_OF/MENTIONS from plan draft) per docs/MWP-SPECIFICATION.md"
  - "Adapter teamProfilesFromManifest converts manifest.people[] {slug, displayName, role_bucket} to wikilink-builder shape {name, displayName, path, category}"
  - "destination_section on routed files records the TOP-LEVEL section (inbox), with sub-branch (suggested/unclassified) preserved in destination_folder"
  - "Move-mode unlink also runs for meeting-detoured files, not just regular routed files"
metrics:
  duration_minutes: 22
  tasks_completed: 3
  test_files_added: 2
  total_test_assertions: 24
  commits: 3
---

# Phase 80 Plan 03: Wave 1 Routing + Enrichment Summary

Stage 03 deterministic router and Stage 04 enricher both ship, completing the per-file routing and folder-scaffolding half of the vault import pipeline. Wikilink injection reuses the Phase 79 builder via a thin adapter; create-speaker-profile gains a Decision-15-and-16-compliant `--layout=import` mode that materializes the full team profile tree on disk.

## What Shipped

### Task 1 -- Router (commit 6a71d8b)

`lib/import/router.cjs` exports `routeFiles(manifest, opts)` which:

- Refuses to operate without `destination_room/STATE.md` (raises before touching disk)
- Slugifies titles via frontmatter override -> filename stem fallback
- Branches inbox routing on `INBOX_SUGGESTED_THRESHOLD = 0.45`:
  - `>= 0.45` -> `inbox/suggested/{slug}/{slug}.md`
  - `< 0.45`  -> `inbox/unclassified/{slug}/{slug}.md`
- Handles collisions with `-imported-{YYYY-MM-DD}` suffix, then `-2`, `-3`, ...
- Records every collision via `recordCollision` with `reason: 'destination_folder_exists'`
- Routes meetings (manifest.meetings[]) into `imports/{import_id}/meetings-pending/` instead of room sections, ready for the 80-04 Stage 03c orchestrator to pipe through `/mos:file-meeting`
- Injects `_imported_from` frontmatter (source_path, source_vault, import_date)
- Honors `mode: 'move'` by unlinking source after a successful target write

`scripts/create-speaker-profile` now accepts `--layout=import --role-bucket=<bucket>` and materializes the complete tree per Blocker 2 locked fix:

```
team/{bucket}/{slug}/
  ROOM.md
  {slug}.md
  mentions.md
  responsibilities.md
  contracts/ROOM.md
```

Legacy 4-positional invocations are unchanged (no regression).

**Tests:** 14 router tests (slug rules, frontmatter override, nested layout, inbox high/low/edge confidence, collision N+1, refuse no STATE.md, provenance, copy/move modes, meetings detour, manifest update, direct nextNonCollidingFolder) + 2 create-speaker-profile smoke tests (full tree materialization, missing --role-bucket failure mode). All green.

### Task 2 -- Enricher (commit f01e0d0)

`lib/import/enricher.cjs` exports `enrichRoom(manifest, opts)` returning stats `{rooms_md_created, state_md_created, minto_stubs_created, wikilinks_added, unresolved_wikilinks}`. It performs six passes over the manifest:

1. **Folder bookkeeping** -- groups manifest.files by destination_folder, walks every ancestor segment so intermediate folders (e.g. `inbox`, `inbox/suggested`) are tracked alongside leaves.
2. **ROOM.md scaffolds (IMPORT-03)** -- writes deterministic ROOM.md at every touched folder. Leaves list direct artifact children; intermediates list direct sub-folders. Each scaffold carries `icm_layer: 0` frontmatter and a `<!-- mwp_edges: INFORMS, CONVERGES -->` comment declaring which canonical MWP edges the folder participates in.
3. **Per-section STATE.md (IMPORT-04)** -- one per top-level section that received 1+ artifacts, listing every leaf slug as a wikilink.
4. **MINTO.md stubs (IMPORT-05)** -- one per populated top-level section, containing the literal `> WARNING: Empty scaffold. Run \`/mos:reason {section}\` to populate.` line so /mos:reason can later target the stub.
5. **Team wikilink injection (IMPORT-08)** -- adapts manifest.people[] to the Phase 79 buildTeamLinks shape via `teamProfilesFromManifest` and runs the builder against every routed artifact. Self-link suppression is preserved via `ownProfilePath`.
6. **Source `[[wikilink]]` rewrite (IMPORT-08)** -- for every preserved source link, looks up either a routed artifact (by leaf folder name) or a person (by slug/name) and appends a `Related: [[...]]` line. Unresolved links land in `stats.unresolved_wikilinks` for the Stage 04 enrichment-log.

`writeIfMissing` makes the entire pass idempotent: rerunning enrichRoom on the same manifest produces zero new ROOM.md/STATE.md/MINTO.md files.

**Tests:** 10 enricher tests including the idempotency check, inbox sub-branch ROOM.md coverage, MWP edge declaration, source wikilink rewrite with unresolved tracking, and failure tolerance (a phantom file with a non-existent destination_abs_path does not abort the pass). All green.

### Task 3 -- wikilink-batch (commit 7d5859c)

`scripts/wikilink-batch.cjs` is a single-process CLI that walks `room/team/{bucket}/{slug}/{slug}.md` to build the team profile list once, then runs `buildTeamLinks` against every input file in the same Node process. Failed individual files are logged to stderr and skipped; the script exits 0 unless every input failed (then exit 2). Replaces the per-file spawn cost of Phase 79's `wikilink-file.cjs` for large vault imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MWP edge names corrected**
- **Found during:** Task 2 (MWP spec verification step required by the plan)
- **Issue:** Plan draft told the enricher to declare `mwp_edges: PART_OF, MENTIONS`. Neither name is in the 9 canonical MWP edge types listed in docs/MWP-SPECIFICATION.md (lines 266-352). PART_OF and MENTIONS would have been invented edge names, violating the explicit plan instruction "Do NOT invent new edge names."
- **Fix:** Used `INFORMS` (artifact references another section via wikilink) and `CONVERGES` (theme appears across artifacts) as the two canonical edges that legitimately describe a folder full of related artifacts. Documented the choice in a header comment block on enricher.cjs explaining why the other 7 canonical edges (CONTRADICTS, ENABLES, INVALIDATES, REASONING_INFORMS, HSI_CONNECTION, REVERSE_SALIENT, CO_OCCURS) are artifact-level, not folder-level.
- **Files modified:** lib/import/enricher.cjs
- **Commit:** f01e0d0

**2. [Rule 1 - Bug] buildTeamLinks shape adapter**
- **Found during:** Task 2
- **Issue:** Plan's `<interfaces>` block documented `buildTeamLinks(text, [{name, slug, profilePath}], opts)` but the actual Phase 79 API in lib/vault/wikilink-builder.cjs:114 expects `[{name, displayName, path, category}]` and only matches when `displayName && name && category` are all present. Passing the plan's shape would have produced zero substitutions (every entry would be filtered out by the `.filter(p => p && p.displayName && p.name && p.category)` guard).
- **Fix:** Added `teamProfilesFromManifest(manifest)` adapter that maps `manifest.people[].slug -> name`, `displayName -> displayName`, `role_bucket -> category`, `profile_path -> path`. Test 5 `test_wikilink_invocation` proves the resulting wikilink (`[[team/core-team/jane-doe/jane-doe.md|Jane Doe]]`) is actually injected.
- **Files modified:** lib/import/enricher.cjs, lib/import/enricher.test.cjs
- **Commit:** f01e0d0

**3. [Rule 2 - Critical] Move-mode unlink for meetings detour**
- **Found during:** Task 1
- **Issue:** Plan's reference implementation only unlinked source files for normal routing, not for the meetings detour branch. In move mode, every meeting source file would be left orphaned in the source vault.
- **Fix:** Added the same `mode === 'move'` unlink block to the meetings detour path.
- **Files modified:** lib/import/router.cjs
- **Commit:** 6a71d8b

### Plan Errata Fixed in Tests

- Plan's `interfaces` block sample shape for `buildTeamLinks` was inaccurate (see Deviation 2 above). Tests assert against the real Phase 79 API.
- Plan's collision N+1 test sketch did not set `source_frontmatter.title: 'onboarding'` on the second file, so the slug would have been `onboarding-2` (no collision). Test now sets the override so the second file slugs to `onboarding` and triggers the `-2` suffix path.

## Verification

```
files-ok
individual-ok
all-tests-ok
speaker-profile-extended
inbox-branching-ok
per-section-state-ok
mwp-edges-named
no-emdashes-ok
```

`node lib/import/run-all-tests.cjs`: 7/7 test files passed (manifest, classifications-sync, vault-scanner, person-detector or related from 80-02, router, enricher, plus pre-existing).

## Self-Check: PASSED

- lib/import/router.cjs FOUND
- lib/import/router.test.cjs FOUND
- lib/import/enricher.cjs FOUND
- lib/import/enricher.test.cjs FOUND
- scripts/wikilink-batch.cjs FOUND
- scripts/create-speaker-profile FOUND with --layout=import
- commit 6a71d8b FOUND
- commit f01e0d0 FOUND
- commit 7d5859c FOUND
