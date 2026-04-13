---
phase: 80-vault-import-obsidian-to-data-room
plan: 01
subsystem: import
tags: [vault-import, manifest, icm-pipeline, gray-matter, test-fixtures, wave-0]

requires:
  - phase: 79-native-filing-wikilinks
    provides: lib/vault/wikilink-builder.cjs, zero-dep Node assert test pattern

provides:
  - MANIFEST.json schema + read/write/update/reverse module (lib/import/manifest.cjs)
  - Deterministic vault scanner (lib/import/vault-scanner.cjs) emitting Stage 02-ready files[] array
  - classifications-sync helper that round-trips Larry review-gate edits into the manifest (Locked Fix 4)
  - Layer 3 import-config reference (thresholds, role buckets, frontmatter promotion map)
  - Four stage contract CONTEXT.md templates (01-ingest, 02-classify, 03-route, 04-enrich)
  - Three test fixture vaults (tiny-vault, obsidian-vault, collision-vault) with deterministic person + collision seeds
  - Zero-dep run-all-tests runner that spawns each *.test.cjs in a child process
  - PRECONDITIONS.md recording bin/mindrian-tools.cjs better-sqlite3 MODULE_NOT_FOUND for 80-05 routing

affects: [80-02, 80-03, 80-04, 80-05, 80-06]

tech-stack:
  added: [gray-matter@^4.0.3 (already present in package.json, first use in import pipeline)]
  patterns:
    - "Zero-dep Node built-in assert test modules under lib/import/*.test.cjs"
    - "child_process-spawned test runner so module-level failures do not short-circuit the suite"
    - "JSON Schema Draft 2020-12 as shape documentation + runtime schema_version assertion (no ajv)"
    - "Atomic writeManifest via .tmp + rename"
    - "Layer 3 reference files carry ICM frontmatter (icm_layer: 3)"

key-files:
  created:
    - lib/import/manifest.cjs
    - lib/import/manifest.schema.json
    - lib/import/manifest.test.cjs
    - lib/import/vault-scanner.cjs
    - lib/import/vault-scanner.test.cjs
    - lib/import/classifications-sync.cjs
    - lib/import/classifications-sync.test.cjs
    - lib/import/run-all-tests.cjs
    - lib/import/PRECONDITIONS.md
    - lib/import/test-fixtures/tiny-vault/notes/onboarding.md
    - lib/import/test-fixtures/tiny-vault/notes/pricing.md
    - lib/import/test-fixtures/tiny-vault/notes/2026-01-15-team-sync.md
    - lib/import/test-fixtures/tiny-vault/notes/random.md
    - lib/import/test-fixtures/tiny-vault/notes/empty.md
    - lib/import/test-fixtures/obsidian-vault/.obsidian/workspace.json
    - lib/import/test-fixtures/obsidian-vault/notes/with-wikilinks.md
    - lib/import/test-fixtures/collision-vault/source/onboarding.md
    - lib/import/test-fixtures/collision-vault/preexisting-room/STATE.md
    - lib/import/test-fixtures/collision-vault/preexisting-room/problem-definition/onboarding/onboarding.md
    - references/import-config.md
    - templates/import/stage-contracts/01-ingest.md
    - templates/import/stage-contracts/02-classify.md
    - templates/import/stage-contracts/03-route.md
    - templates/import/stage-contracts/04-enrich.md
  modified: []

key-decisions:
  - "MANIFEST schema_version 1.0 locked; writeManifest refuses any manifest without it"
  - "run-all-tests spawns each test file as a child process (isolates assertion failures, enables per-file PASS/FAIL reporting)"
  - "reverseManifest walks files[] in reverse insertion order so undo mirrors Stage 03 route order"
  - "classifications-sync treats an empty trailing line as the end of the table to allow blank-separated markdown below"
  - "PRECONDITIONS.md records the mindrian-tools.cjs MODULE_NOT_FOUND (better-sqlite3 via lazygraph-ops chain) rather than fixing it: 80-05 will route /mos:vault import directly through scripts/vault-import.cjs"

patterns-established:
  - "Import stage contract template convention: YAML frontmatter with icm_layer, stage, import_id, created placeholders"
  - "Layer 3 reference convention: top frontmatter block declaring icm_layer, purpose, audience, editable"
  - "Test fixture vaults under lib/import/test-fixtures/ with one fixture directory per behavior class"

requirements-completed: [IMPORT-02]

duration: ~20min
completed: 2026-04-13
---

# Phase 80 Plan 01: Wave 0 Foundation Summary

**MANIFEST schema module, deterministic vault scanner, classifications-sync round-trip helper, Layer 3 import-config reference, 4 stage-contract CONTEXT.md templates, 3 fixture vaults with deterministic person and collision seeds, and a zero-dep child-process test runner (15/15 tests green)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-13T10:15Z
- **Completed:** 2026-04-13T10:34Z
- **Tasks:** 2
- **Files created:** 24

## Accomplishments

- lib/import/manifest.cjs covers createManifest, readManifest, writeManifest (atomic .tmp+rename with schema_version guard), updateFile, recordCollision, reverseManifest. 6/6 unit tests passing.
- lib/import/vault-scanner.cjs walks .md/.markdown files, skips .obsidian/.git/node_modules/hidden dirs, extracts source_wikilinks via [[x]] regex, parses frontmatter via gray-matter with malformed-YAML fallback, emits sha1:hex hashes. 4/4 unit tests passing against tiny-vault + obsidian-vault fixtures.
- lib/import/classifications-sync.cjs (Locked Fix 4) parses the Stage 02 classifications.md table, matches rows to manifest.files by source_path, writes edited section/confidence/decision back into manifest.files[].classification, increments stage_states.classify.edits_count, and sets human_edited when any row diverges from the prior value. 5/5 unit tests passing including round-trip, section edit, decision edit, malformed row throw, and confidence number coercion.
- references/import-config.md declares auto_threshold 0.75, suggest_threshold 0.45, 6 role buckets (core-team, consultants, advisors, investors, board, unassigned) with keyword lists, and the 8-field frontmatter promotion map.
- 4 stage contract templates with {{IMPORT_ID}}, {{TIMESTAMP}}, {{SOURCE_PATH}}, {{MODE}} placeholders intact. Stage 03 template already includes the inbox/suggested vs inbox/unclassified confidence branch from Locked Fix 3. Stage 02 template already references classifications-sync from Locked Fix 4.
- 3 fixture vaults: tiny-vault (5 .md files, deterministic Jane Doe attendees seed in 2026-01-15-team-sync.md), obsidian-vault (with .obsidian/workspace.json that must be skipped, plus with-wikilinks.md containing [[dror-cohen]] and [[activation-funnel]]), collision-vault (source/onboarding.md has section:problem-definition frontmatter, preexisting-room/problem-definition/onboarding/onboarding.md is the collision target).
- lib/import/run-all-tests.cjs spawns each *.test.cjs in a child process so a thrown assert doesn't abort the whole suite. Reports `3/3 test files passed`.
- lib/import/PRECONDITIONS.md records the bin/mindrian-tools.cjs better-sqlite3 MODULE_NOT_FOUND (through lib/core/lazygraph-ops.cjs) so Plan 80-05 knows to route `/mos:vault import` through scripts/vault-import.cjs directly.

## Task Commits

1. **Task 1: Manifest, scanner, classifications-sync, config, stage-contract templates** - `abcf547` (feat)
2. **Task 2: Test fixtures, run-all-tests runner, mindrian-tools.cjs sanity check** - `634b78b` (feat)

## Files Created/Modified

See `key-files.created` in frontmatter for the complete list (24 new files).

## Decisions Made

- Lazy-run vault-scanner tests during Task 2 rather than Task 1 (they need fixtures, which are a Task 2 deliverable). Task 1 commit ran only manifest + classifications-sync tests; full suite green at Task 2 commit.
- Chose `spawnSync(process.execPath, [testFile], { stdio: 'inherit' })` for run-all-tests so module-level throws in one test file don't corrupt others. This also keeps failure output streaming in real time.
- Used `Number.isFinite()` + `Number()` coercion in classifications-sync so `"0.84"` parses as `0.84`. Any non-numeric confidence throws `malformed classifications row (confidence not numeric)` per behavior spec.
- reverseManifest emits moves in reverse `files[]` insertion order and collects one MINTO stub removal per unique destination_section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug context] mindrian-tools.cjs root cause documented precisely**

- **Found during:** Task 2 sanity check
- **Issue:** The plan anticipated "lazygraph-ops MODULE_NOT_FOUND" (Phase 78-02 carryover) but the actual failing module in this env is `better-sqlite3`, required at module load time by `lib/core/lazygraph-ops.cjs`, which is eagerly loaded through `lib/core/graph-ops.cjs` from `bin/mindrian-tools.cjs`. Same surface (mindrian-tools.cjs crashes on --help through the lazygraph-ops chain) but different root missing module.
- **Fix:** Recorded the exact error, require stack, and workaround in `lib/import/PRECONDITIONS.md` as instructed by the Task 2 action step. No code fix attempted (out of Wave 0 scope).
- **Files modified:** lib/import/PRECONDITIONS.md
- **Verification:** `node bin/mindrian-tools.cjs --help` confirmed to crash with the recorded error; Plan 80-05 now has an authoritative record.
- **Committed in:** 634b78b

---

**Total deviations:** 1 precondition recording (no code changed).
**Impact on plan:** None. Task 2 explicitly instructs "this task does NOT fix lazygraph-ops; it records the situation so 80-05 can branch correctly." The only variation from the plan's prediction was the specific missing module name, which is now captured accurately.

## Issues Encountered

None. All 15 tests pass on first run. Em-dash scan across the full `lib/import/`, `references/import-config.md`, and `templates/import/` tree exits non-zero (grep-PROT meaning "no matches"), confirming the hard rule was honored.

## User Setup Required

None. All fixtures are committed, all modules are pure CJS with only in-repo dependencies (`gray-matter` already in `package.json`).

## Next Phase Readiness

- **80-02 (AI classifier)** can call `scanVault()` and receive a ready-to-classify file array.
- **80-03 (router)** can read MANIFEST via `readManifest`, branch on `classification.section === 'inbox'` per confidence, call `recordCollision` when a destination folder already exists, and rely on the collision-vault fixture to validate both branches.
- **80-04 (enricher + orchestrator)** can persist human edits from the review gate via `syncClassificationsToManifest` and trust that `stage_states.classify.edits_count` advances. Jane Doe is the deterministic person seed for team/core-team/jane-doe/ materialization.
- **80-05 (command wiring)** MUST consume PRECONDITIONS.md and route `/mos:vault import` through `scripts/vault-import.cjs` directly, not through `bin/mindrian-tools.cjs`.
- **80-06 (branding + smoke test)** can reuse the tiny-vault fixture for the post-import /mos:room-state smoke test.

## Self-Check: PASSED

- lib/import/manifest.cjs FOUND
- lib/import/manifest.schema.json FOUND
- lib/import/vault-scanner.cjs FOUND
- lib/import/classifications-sync.cjs FOUND
- lib/import/run-all-tests.cjs FOUND
- references/import-config.md FOUND
- templates/import/stage-contracts/01-ingest.md FOUND
- templates/import/stage-contracts/02-classify.md FOUND
- templates/import/stage-contracts/03-route.md FOUND
- templates/import/stage-contracts/04-enrich.md FOUND
- lib/import/test-fixtures/tiny-vault/notes/* (5 files) FOUND
- lib/import/test-fixtures/obsidian-vault/.obsidian/workspace.json FOUND
- lib/import/test-fixtures/collision-vault/source/onboarding.md with section:problem-definition FOUND
- lib/import/test-fixtures/collision-vault/preexisting-room/STATE.md FOUND
- Commit abcf547 FOUND (Task 1)
- Commit 634b78b FOUND (Task 2)
- node lib/import/run-all-tests.cjs: 3/3 test files, 15/15 tests PASSED
- em-dash scan: no matches across lib/import/, references/import-config.md, templates/import/

---
*Phase: 80-vault-import-obsidian-to-data-room*
*Completed: 2026-04-13*
