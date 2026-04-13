---
phase: 80-vault-import-obsidian-to-data-room
plan: 04
plan_id: 80-04
wave: 2
subsystem: vault-import
status: complete
completed: 2026-04-13
tags: [orchestrator, vault-import, stage-03b, stage-03c, room-md, blocker-fixes, integration-test]
requirements: [IMPORT-02, IMPORT-12]

dependency_graph:
  requires:
    - "80-01 (manifest, vault-scanner, classifications-sync, stage-contract templates, fixtures, PRECONDITIONS.md)"
    - "80-02 (person-detector, meeting-detector)"
    - "80-03 (router, enricher, scripts/create-speaker-profile --layout=import)"
  provides:
    - "scripts/vault-import.cjs -- CJS orchestrator entry point for the full 4-stage ICM pipeline"
    - "lib/import/room-md-scaffolder.cjs -- writeImportsRoomMd(dir, label, importId, stage, purpose) Decision 15 helper"
    - "lib/import/integration.test.cjs -- subprocess-driven end-to-end fixture test (6 cases)"
  affects:
    - "80-05 (commands/vault.md will shell out to scripts/vault-import.cjs per PRECONDITIONS.md guidance)"
    - "80-06 (branding + smoke test will hook into the orchestrator's post-enrich point)"

tech-stack:
  added: []
  patterns:
    - "Subprocess-driven integration test via spawnSync(process.execPath, [script, ...])"
    - "Idempotent imports/{id}/ tree builder + ROOM.md scaffolder on every mkdir"
    - "Role re-inference fallback pass in the orchestrator to cover 80-02 narrow-window limitation"
    - "Direct-copy meeting filing fallback when bin/mindrian-tools.cjs is broken per PRECONDITIONS.md"

key-files:
  created:
    - scripts/vault-import.cjs
    - lib/import/room-md-scaffolder.cjs
    - lib/import/integration.test.cjs
  modified: []

decisions:
  - "Role re-inference runs in the orchestrator (not person-detector) so the 80-02 module stays untouched. The fallback scans every occurrence of a detected name across a wider 240-char window (120 before, 120 after) and checks all role bucket keywords. Required for Jane Doe to land in team/core-team/ from the tiny-vault fixture."
  - "Stage 03c uses direct-copy fallback as the default path because PRECONDITIONS.md flags bin/mindrian-tools.cjs as broken (lazygraph-ops/better-sqlite3 MODULE_NOT_FOUND). The orchestrator still tries the optimistic file-meeting CLI path first when preconditions are clean, so 80-05 or a later plan can remove the fallback once lazygraph-ops is fixed."
  - "Collision fixture pre-rewrite in the integration test: the shipped collision-vault source has title 'Onboarding pain' which slugs to 'onboarding-pain' and never collides with the preexisting room's onboarding/ folder. The integration test rewrites the source file with title 'onboarding' before running the pipeline, documenting that the fixture is owned by unit tests and integration tests shape their own collision conditions on top."
  - "Stub classifier prefers frontmatter.section, then tag hints (business-model, pricing, activation, dror), then falls back to inbox/unclassified at 0.30. This is deterministic and independent of Larry so the pipeline is self-contained in test environments without an AI backend."
  - "imports/{id}/meetings-pending/ gets a ROOM.md after routeFiles runs (scaffolder called from the orchestrator, not from router.cjs). This keeps 80-03's router pure while still honoring Decision 15 across the full imports/ tree."

metrics:
  duration_minutes: 30
  tasks_completed: 2
  test_files_added: 1
  total_test_assertions: 25
  commits: 2

requirements-completed: [IMPORT-02, IMPORT-12]
---

# Phase 80 Plan 04: Wave 2 Orchestrator Summary

Stage orchestrator `scripts/vault-import.cjs` ships as the single CJS entry point for the full 4-stage vault import pipeline, with all four Locked Fix blockers resolved (ROOM.md everywhere in imports/, team materialization, meeting filing, Larry-edited classifications). The subprocess-driven integration test verifies happy path, collision path, dry-run, nested-room refusal, missing-arg handling, and the .approved marker skipStub flow against the tiny-vault and collision-vault fixtures.

## What Shipped

### Task 1 -- Orchestrator + scaffolder (commit 406d1c1)

`scripts/vault-import.cjs`:

- **parseArgs** handling `--path`, `--room`, `--yes`, `--dry-run`, `--move`, `--copy`, `--topic`, `--import-id`, `--undo`, `--help`
- **Cases A-D** from CONTEXT.md gray area #3:
  - A (no existing room) -> scaffoldRoom writes minimal STATE.md + ROOM.md
  - B (existing room) -> pipeline runs as-is
  - C (nested room detected via parent-walk for STATE.md) -> exit 2 with "nested inside" stderr
  - D (source has .obsidian/) -> stdout "obsidian vault detected", treated like A
- **Stage 01 ingest**: createManifest, scanVault, write MANIFEST.json + source-tree.md, ensureFullImportTree scaffolds every directory under `imports/{id}/` with ROOM.md via writeImportsRoomMd (Blocker 1 Locked Fix)
- **Stage CONTEXT.md hydration**: templates/import/stage-contracts/\*.md are read, placeholders ({{IMPORT_ID}}, {{TIMESTAMP}}, {{SOURCE_PATH}}, {{MODE}}) substituted, written into each of the 4 stage folders
- **Stage 02 classify with skipStub**: if `02-classify/output/.approved` exists, call syncClassificationsToManifest to round-trip Larry edits back into MANIFEST, skip stubClassify entirely. Otherwise, if the first manifest file already has a classification.section set (re-run case), skip stubClassify too. Otherwise run the deterministic stubClassify (Blocker 4 Locked Fix). detectPeople + detectMeetings always run.
- **Role re-inference fallback**: reinferPeopleRoles scans every occurrence of each unassigned person's name across their mention files with a 240-char window and checks all role bucket keywords from references/import-config.md. This closes the 80-02 narrow-window limitation so Jane Doe ("Jane Doe, co-founder") lands in core-team.
- **Stage 02 review gate**: `--dry-run` stops after writing classifications.md. Without `--yes` and without `.approved`, returns 0 with a review_gate summary. With `--yes` or `.approved`, continues.
- **Stage 03 route**: routeFiles from 80-03 moves classified files into the Decision 16 nested layout. writeImportsRoomMd is then called on `imports/{id}/meetings-pending/` because router.cjs creates that folder but doesn't scaffold ROOM.md there.
- **Stage 03b team materialization** (Blocker 2 Locked Fix): for each entry in manifest.people[], execFileSync shells out to `bash scripts/create-speaker-profile <roomDir> --layout=import --role-bucket=<bucket> <slug> <name>`. Success sets p.profile_materialized = true + p.profile_path. Failure is logged to manifest.warnings and the pipeline continues.
- **Stage 03c meeting filing** (Blocker 5 Locked Fix): for each entry in manifest.meetings[], the routed staging file at imports/{id}/meetings-pending/ is either (a) piped through `node bin/mindrian-tools.cjs file-meeting --file <staging> --non-interactive` if PRECONDITIONS.md is clean, or (b) copied directly into `room/meetings/{date}-{slug}/{date}-{slug}.md` with its own ROOM.md via the scaffolder. `m.filed_via` records which path was taken. `room/meetings/` itself gets a ROOM.md.
- **Stage 04 enrich**: calls enrichRoom from 80-03 with roomDir
- **Final report**: minimal IMPORT-REPORT.md with frontmatter (date, main_topic, source_vault, total_files, status) + summary counts + stage_states JSON block (full render deferred to 80-05)
- **PRECONDITIONS.md awareness**: checkPreconditions greps PRECONDITIONS.md for lazygraph-ops/better-sqlite3/MODULE_NOT_FOUND patterns and prints a stderr warning + switches Stage 03c to fallback mode

`lib/import/room-md-scaffolder.cjs`:

- `writeImportsRoomMd(dirPath, layerLabel, importId, stageName, purpose)` -- idempotent, deterministic ROOM.md with YAML frontmatter (icm_layer: 0, import_id, stage, generated_by) and a short Markdown body (layer label heading, purpose line). Returns true if written, false if the file already existed. Creates the directory if missing.

### Task 2 -- Integration test (commit ccf2c13)

`lib/import/integration.test.cjs`: six subprocess-driven tests using `spawnSync(process.execPath, [script, ...])` with tmp src + tmp dst directories per test and best-effort cleanup.

1. **Happy path + Blockers 1/2/5** against tiny-vault with --yes -- verifies exit 0, IMPORT-REPORT.md exists, MANIFEST stage_states.enrich.status === 'complete', team/core-team/jane-doe/ tree is materialized with all 5 expected files/dirs, meeting count in room/meetings/ matches manifest.meetings.length, and every subdir under imports/ has ROOM.md via walkRoomMdMissing.
2. **Collision path** against collision-vault -- the test pre-rewrites the source onboarding.md with title: "onboarding" so its slug matches the preexisting room's problem-definition/onboarding/ folder, then verifies manifest.collisions is non-empty and the colliding file's destination_folder contains "-imported-".
3. **Dry-run** -- verifies exit 0, classifications.md exists, and that NO section folders (problem-definition, business-model, inbox, team, meetings) were created.
4. **Case C nested room refusal** -- inner room inside outer room exits 2 with "nested inside" stderr.
5. **Missing --path** -- exits 1 with "--path is required" stderr.
6. **Blocker 4 skipStub** -- runs the pipeline twice; between runs the test edits random.md's row in classifications.md to section=problem-definition / decision=AUTO, touches .approved, and re-runs with --yes. Final manifest has random.md.classification.section === 'problem-definition', decision === 'AUTO', and destination_section === 'problem-definition' (Larry edit actually routed).

## Verification

```
node scripts/vault-import.cjs --help        -> exit 0, prints usage
node scripts/vault-import.cjs               -> exit 1, "--path is required"
node lib/import/integration.test.cjs        -> 6 passed, 0 failed
node lib/import/run-all-tests.cjs           -> 8/8 test files passing
grep -P "\xe2\x80\x94" [new files]          -> no matches
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Person-detector narrow-window role-bucket miss**

- **Found during:** Task 1 end-to-end smoke test. Jane Doe's role_guess came back as "unassigned" even though the tiny-vault fixture explicitly says "Jane Doe, co-founder."
- **Root cause:** 80-02 person-detector.cjs inferRole uses `haystack.indexOf(needle)` which returns only the first occurrence, and checks a 160-char window (80 before + 80 after). In the tiny-vault fixture, the first "Jane Doe" appears inside the YAML frontmatter around character 28. The window spans roughly characters 0-116 but "co-founder" is at around character 152, so the match is missed.
- **Fix:** Added `reinferPeopleRoles(manifest)` to the orchestrator as a post-detection pass. For each person whose role_guess is still 'unassigned', it scans EVERY occurrence of the name across that person's mention_files with a wider 240-char window (120 before, 120 after) and checks all role bucket keywords from references/import-config.md. The orchestrator embeds its own ROLE_BUCKETS_ORCH copy so it stays decoupled from person-detector's internals. The fix is self-contained in scripts/vault-import.cjs and does not touch 80-02 code.
- **Files modified:** scripts/vault-import.cjs only
- **Commit:** 406d1c1
- **Verification:** The integration test's Blocker 2 assertion on `team/core-team/jane-doe/jane-doe.md` now passes.

**2. [Rule 3 - Blocking] meetings-pending/ missing ROOM.md**

- **Found during:** Task 1 end-to-end smoke test.
- **Root cause:** lib/import/router.cjs routes detected meetings into `imports/{id}/meetings-pending/{basename}` by calling fs.mkdirSync recursively. It does NOT call the scaffolder, because room-md-scaffolder is a 80-04 deliverable and router is owned by 80-03. The integration test's walkRoomMdMissing assertion under `imports/` caught it.
- **Fix:** After routeFiles returns, the orchestrator explicitly calls writeImportsRoomMd on `imports/{id}/meetings-pending/` if it exists. Keeps router.cjs pure, keeps Decision 15 intact across the full imports/ tree.
- **Files modified:** scripts/vault-import.cjs only
- **Commit:** 406d1c1

### Plan-vs-Reality Notes

- Plan Task 2 Test 2 called for `collision-vault/source/onboarding.md` to carry `section: problem-definition` AND a title that slugs to `onboarding`. The fixture (shipped by 80-01) has `section: problem-definition` correctly but a title `"Onboarding pain"` that slugs to `onboarding-pain`. The 80-03 router unit test has the same issue and already documented it. The integration test owns its own collision shape by rewriting the source file before running the pipeline -- this is cleaner than editing the shared fixture, which other unit tests depend on.
- `file-meeting` has no `--non-interactive` flag (it is a Claude-agent slash command, not a pure CJS entry). Stage 03c's optimistic file-meeting-cli branch is therefore guarded by the PRECONDITIONS.md check and, in the current environment, never runs. The fallback direct-copy path is the effective implementation. This matches the plan's explicit fallback contract.
- IMPORT-08 (wikilink preserve/convert) is NOT claimed here -- that requirement is owned by 80-03 enricher (which runs as Stage 04 of this orchestrator). Plan 80-04's requirements frontmatter lists only IMPORT-02 and IMPORT-12.

## Known Stubs

- `stubClassify` in scripts/vault-import.cjs is a deterministic frontmatter + tag-hint classifier. It is NOT the Larry-driven AI classifier that the plan contemplates for Stage 02 in production. The stub is sufficient for all 6 integration tests and for any run where the user sets `section:` in frontmatter, but a future plan (likely 80-05 or a dedicated 80-xx follow-up) should wire in the actual AI classifier behind a flag. The review-gate and .approved-marker flow already work because the stub's output lands in classifications.md as a first-pass draft that Larry can edit.
- The `--undo` flag is parsed but not implemented in this plan. reverseManifest (80-01) exists; 80-05 will wire it in.

## Deferred Issues

None. All 6 integration tests pass, all 8 run-all-tests suites pass, zero em-dashes, both blockers and gray-area decisions honored.

## Commits

1. **406d1c1** `feat(80-04): vault-import orchestrator + room-md-scaffolder`
2. **ccf2c13** `test(80-04): integration test covering happy path, blockers, dry-run, nested`

## Files Created

See `key-files.created` in frontmatter.

## Next Phase Readiness

- **80-05 (command wiring)** can now wire `commands/vault.md` to shell out to `node scripts/vault-import.cjs` per PRECONDITIONS.md guidance. The orchestrator exports parseArgs, run, and all the stage helpers so 80-05 can call them directly if a command-layer integration wants to avoid subprocess overhead.
- **80-06 (branding + smoke test)** has a clean post-enrich hook point. The orchestrator sets `manifest.status = 'complete'` and writes IMPORT-REPORT.md as the last step; 80-06 can inject footer injection + frontmatter normalization between Stage 04 enrich and IMPORT-REPORT write, and append its `/mos: Usability Check` section to the report.

## Self-Check: PASSED

- scripts/vault-import.cjs FOUND
- lib/import/room-md-scaffolder.cjs FOUND
- lib/import/integration.test.cjs FOUND
- commit 406d1c1 FOUND
- commit ccf2c13 FOUND
- node scripts/vault-import.cjs --help -> exit 0
- node lib/import/integration.test.cjs -> 6/6 passed
- node lib/import/run-all-tests.cjs -> 8/8 test files passed
- No em-dashes in any new file
