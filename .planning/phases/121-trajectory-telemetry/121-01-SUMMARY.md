---
phase: 121-trajectory-telemetry
plan: 01
subsystem: telemetry
tags: [migration, idempotent, atomic-cutover, canon-part-7, canon-part-8, canon-part-9, shim, dual-write, iso-week]

# Dependency graph
requires:
  - phase: 121-00
    provides: lib/core/telemetry/writer.cjs (the unified emit chokepoint that this plan consolidates the 4 piecemeal writers into) + schema.cjs ALLOWED_FIELDS (the normalization target for migrated rows) + validator.cjs validateEventPayload (the Canon Part 8 emit-time gate invoked inline in the migration path).
  - phase: 118-30-second-mva-reward-before-investment
    provides: lib/core/mva-telemetry.cjs original ALLOWED_FIELDS shape (preserved byte-identically in the shim subset) + lib/core/mva-option-router.cjs surface contract (18 tests held green throughout the cutover).
  - phase: 117-auto-explore-domains-on-first-material
    provides: scripts/hooked-rescore-117.cjs read-path target for repointing to the unified events-YYYY-WNN.jsonl stream.
provides:
  - "scripts/migrate-telemetry-v1.cjs: one-time idempotent merge of the 4 piecemeal telemetry sources (mva.jsonl, selector.jsonl, navigation-bypass.jsonl, query-efficiency.jsonl) into the unified events-YYYY-WNN.jsonl stream"
  - "scripts/migrate-telemetry-v1.test.cjs: 8 fixture tests covering empty source, legacy normalization, mva timestamp-order, source rename to .pre-v121.bak, sha256 fingerprint idempotence, mixed-week ISO split, Canon Part 8 quarantine, stdout summary JSON"
  - "lib/core/mva-telemetry.cjs: 58-LOC shim delegating emit() to writer.cjs (Canon Part 9 chokepoint) with a legacy dual-write to mva.jsonl so Phase 118 byte-functional compatibility is preserved"
  - "scripts/hooked-rescore-117.cjs: read path repointed to events-YYYY-WNN.jsonl (regex-anchored glob); RELEVANT_EVENTS expanded to recognize both legacy event_type and unified event fields"
  - "tests/test-121-01-scaffold.sh: 6-gate scaffold harness (migration idempotent + validator inline + mva shim contract + hooked-rescore repoint + Phase 118 still green + zero em-dashes)"
  - "tests/run-all-121.sh: aggregator extended with the 121-01 scaffold + the migration fixture test (6 suites total, 6/6 green)"
  - "lib/memory/run-feynman-tests.cjs: registered scripts/migrate-telemetry-v1.test.cjs"
affects: [121-02, 121-03, 121-04, SEED-002 agent-lightning lab loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-name-prefixed sha256 fingerprint pattern: idempotence detection hashes 'source.name + first-5-timestamps' so two source files with coincidentally-identical timestamp prefixes do not collide in the seen-list (real-world case caught by Test 4 when all 4 sources shared 2026-05-10T12:00:00.000Z as the first row)"
    - "Dual-write shim pattern: the mva-telemetry shim routes through writer.emit() FIRST (Canon Part 8 gate + unified events-YYYY-WNN.jsonl append) AND ALSO appends to the legacy mva.jsonl path for backward compatibility with Phase 118 readers (mva-option-router, mva-detect, mva-orchestrator tests, dror-harness). v1.14.0 will remove the shim once every consumer is repointed."
    - "Canon Part 9 chokepoint exception (scoped): the migration script bypasses writer.emit() to preserve historical timestamps (writer.emit overwrites timestamp with `new Date()`). The exception is documented in the migration script header + this SUMMARY. validateEventPayload is invoked inline before every fs.appendFileSync so Canon Part 8 remains structurally enforced. Runtime emit paths (Plans 121-02 / 121-03) route through writer.emit() unchanged -- the exception is scoped to this one-shot migration."
    - "Quarantine-without-abort pattern: forbidden-pattern rows (Cypher / email / phone / Brain URL / abs path / raw hex / free-text prose) append to .quarantine-<source>.jsonl with a short reason hash; the migration continues with remaining rows. The source's fingerprint is recorded only AFTER processing so a re-run does not retry the bad rows."

key-files:
  created:
    - "scripts/migrate-telemetry-v1.cjs (291 lines): the migration script. 4 normalizers (mva passthrough; selector + query-efficiency coerce to command_invocation; navigation-bypass adds event:'nav_bypass'). Per-row validateEventPayload call. Per-source sha256 fingerprint of first-5-timestamps for idempotence. .pre-v121.bak rename on success."
    - "scripts/migrate-telemetry-v1.test.cjs (356 lines): 8 fixture tests; hermetic per-test tmpdir + HOME swap; mirrors lib/core/telemetry/writer.test.cjs scaffolding shape."
    - "tests/test-121-01-scaffold.sh (94 lines): 6 invariant gates; em-dash-free per memory rule."
  modified:
    - "lib/core/mva-telemetry.cjs: 170 LOC -> 58 LOC. Pure shim delegating to writer.emit() + legacy dual-write to mva.jsonl. Re-exports public surface byte-for-byte (emit, validateEventPayload, EVENT_TYPES, ALLOWED_FIELDS, telemetryDir, telemetryFile)."
    - "scripts/hooked-rescore-117.cjs: readJsonlEvents() renamed to readUnifiedStreamEvents(); regex-anchored filter ^events-\\d{4}-W\\d{2}\\.jsonl$ (was generic *.jsonl); RELEVANT_EVENTS expanded to recognize both legacy event_type and unified event fields. Phase 121-01 marker comment + 3 inline references."
    - "tests/run-all-121.sh: SHELL_SUITES gains test-121-01-scaffold.sh; CJS_SUITES gains scripts/migrate-telemetry-v1.test.cjs."
    - "lib/memory/run-feynman-tests.cjs: TEST_FILES gains scripts/migrate-telemetry-v1.test.cjs."

key-decisions:
  - "D-02 honored: atomic cutover -- migration script + mva-telemetry shim conversion + hooked-rescore-117 repoint all ship in ONE plan. No half-migrated state where the consumer reads stale data."
  - "Source-name-prefixed fingerprint: discovered in Test 4 (all 4 fixture sources used the same first timestamp). Sha256 fingerprint had to incorporate source.name to avoid collision. Sourced as a Rule 1 bug fix during execution; fixed inline."
  - "Dual-write shim instead of pure delegation: pure delegation to writer.emit() would have broken Phase 118 byte-functional compatibility (the test reads mva.jsonl; writer.emit writes to events-YYYY-WNN.jsonl). Added a legacy mva.jsonl append after the writer.emit call to preserve backward compatibility with the 7+ existing readers (mva-option-router, mva-detect, mva-orchestrator test, dror-harness, mva-detect smoke test, mva-telemetry test, mva-option-router test). The shim documents the dual-write as scoped to v1.14.0 deprecation."
  - "require('./telemetry/writer.cjs') vs the plan's literal regex '/require\\\\(\\\\.\\\\/telemetry\\\\/writer\\\\)/' which doesn't include .cjs: Node.js does not auto-resolve .cjs files on extension-less require. The shim therefore uses the explicit .cjs extension. The Task 3 scaffold gate accepts either form (greps for require('./telemetry/writer' without the closing parenthesis)."
  - "Canon Part 9 chokepoint exception scoped to migration: writer.emit() would overwrite the historical timestamp. The migration appends directly via fs.appendFileSync AFTER validateEventPayload dispatch. Runtime emit paths (Plans 121-02 / 121-03) route through writer.emit() unchanged -- the exception is scoped to this one-shot migration script."

patterns-established:
  - "Atomic-cutover plan pattern: when a migration alters where the data lands AND a consumer reads from that location, the migration script + consumer repoint must ship in the same plan. Splitting them risks a half-migrated state where the consumer reads stale data. Plan 121-01 is the reference: 3 tasks (migration + shim + consumer repoint) committed atomically."
  - "Dual-write shim transition pattern: when collapsing N writers into 1 chokepoint without breaking N readers, the shim writes to BOTH the new chokepoint AND the legacy path during a deprecation window. Removes one consumer at a time across milestones; v1.14.0 retires the shim when every reader is repointed."
  - "Per-source fingerprint key pattern: idempotence detection must include a per-source discriminator (the source name) in addition to the timestamp content, because timestamp prefixes can legitimately collide across sources."

requirements-completed: [TELEMETRY-121-02, TELEMETRY-121-08]

# Metrics
duration: 11min
completed: 2026-05-19
---

# Phase 121 Plan 01: Atomic Cutover Summary

**Idempotent migration of 4 piecemeal telemetry sources into the unified events-YYYY-WNN.jsonl stream, with mva-telemetry shim conversion and hooked-rescore-117 read-path repoint -- all shipped atomically in ONE plan.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-19T08:41:29Z
- **Completed:** 2026-05-19T08:53:22Z
- **Tasks:** 3 / 3 complete
- **Files created:** 3 (migrate-telemetry-v1.cjs + .test.cjs + test-121-01-scaffold.sh)
- **Files modified:** 4 (mva-telemetry.cjs + hooked-rescore-117.cjs + run-all-121.sh + run-feynman-tests.cjs)
- **Test cases:** 8/8 fixture tests + 6/6 scaffold gates + 18/18 Phase 118 regression + 5/5 mva-telemetry regression = 37/37 green
- **Total LOC delta:** +643 lines added (3 new files) / -143 lines removed (mva-telemetry trim 170 -> 58 = -112 lines plus minor edits)

## Accomplishments

- **Atomic cutover landed.** Migration script + shim conversion + consumer repoint all in the same commit chain. No half-migrated state risk -- a consumer cannot read stale data because the consumer was repointed in the same plan that produced the new data shape.
- **Idempotence is proven by fixture.** Test 5 writes 3 rows, runs migrateOne (3 migrated + renamed), restores the source, runs migrateOne again (0 migrated + idempotent_skipped: 1). Zero duplicate rows in events-YYYY-WNN.jsonl.
- **Canon Part 8 enforcement is preserved on historical data.** Test 7 plants a forbidden-pattern row (email in the command field, which after normalization becomes the command_invocation.command field that validator rejects via the EMAIL_RE detector). The row quarantines to .quarantine-selector.jsonl with the reason captured; the migration continues with the clean row.
- **Phase 118 byte-functional compatibility is preserved.** The shim's legacy dual-write to ~/.mindrian/telemetry/v1.13/mva.jsonl keeps every existing reader (mva-option-router, mva-detect, mva-orchestrator test, dror harness) operational. 18/18 mva-option-router tests + 5/5 mva-telemetry tests + 21/21 mva-orchestrator tests + 1/1 mva-detect smoke test all green.

## Task Commits

Each task was committed atomically with TDD discipline (RED then GREEN for Task 1; structural-edit-with-immediate-verify for Tasks 2 and 3):

1. **Task 1 RED: failing tests for migration script** -- `2f76d8db` (test). scripts/migrate-telemetry-v1.test.cjs, 356 lines, 8 fixture tests. All 8 failed with "Cannot find module" (the migration script did not yet exist).
2. **Task 1 GREEN: migration script implementation** -- `806ca678` (feat). scripts/migrate-telemetry-v1.cjs, 291 lines. 8/8 tests pass after the source-name-prefixed fingerprint fix. lib/memory/run-feynman-tests.cjs registers the test.
3. **Task 2: mva-telemetry shim conversion** -- `ed29bbc2` (refactor). lib/core/mva-telemetry.cjs trimmed from 170 to 58 LOC; pure delegation to writer.emit() PLUS a legacy mva.jsonl dual-write. 18/18 Phase 118 tests still green.
4. **Task 3: hooked-rescore-117 repoint + scaffold harness** -- `7dce34ed` (feat). scripts/hooked-rescore-117.cjs reads events-YYYY-WNN.jsonl via anchored regex; tests/test-121-01-scaffold.sh ships with 6 gates; tests/run-all-121.sh aggregates the new harness + the migration fixture test.

## Migration Normalization Map

| Source | Original schema | Target event type | Transform |
|--------|-----------------|-------------------|-----------|
| ~/.mindrian/telemetry/v1.13/mva.jsonl | `{event:'mva_*', timestamp, sentence_sha256, ...}` | `mva_*` (passthrough, 6 event types) | event field preserved; ALLOWED_FIELDS whitelist filters extras |
| ~/.mindrian/telemetry/selector.jsonl | `{event:'query.served', ts, command:'/mos:*', ratio, room_slug}` | `command_invocation` | command preserved (sliced to 64 chars); ts -> timestamp; ratio -> duration_ms (rounded); room_slug -> context_hash (sha256 first 16 chars); outcome='served' |
| ~/.mindrian/telemetry/navigation-bypass.jsonl | `{op, reason, caller_hash, timestamp}` | `nav_bypass` (event added) | op + reason sliced to 64 chars; caller_hash sliced to 16; room_slug_sha256 derived from any `room` field (or empty-string sha256 as fallback) |
| ~/.mindrian/telemetry/query-efficiency.jsonl | Same shape as selector.jsonl | `command_invocation` | Identical normalization to selector |

## Idempotence Mechanism

- **Fingerprint key:** `sha256(source.name + '|' + first-5-timestamps.join('|'))`.
- **Why source.name is prefixed:** real-world case caught in Test 4 -- if four source files share an identical first timestamp prefix (e.g. all populated from the same boot event), the non-prefixed fingerprint would collide and only the first source would migrate. The prefix ensures each source has its own unit of idempotence.
- **Persistence:** seen fingerprints write to ~/.mindrian/telemetry/v1.13/.migration-fingerprints.json.
- **On re-run:** if the fingerprint is already in the seen list, migrateOne returns immediately with idempotent_skipped: 1 and no append occurs. Verified by Test 5 (3 rows migrated on first run; 0 migrated on second run with identical content; events file unchanged).

## Quarantine Behavior

- **Trigger:** any row that fails validateEventPayload after normalization.
- **Reasons captured (matching validator.cjs forbidden-pattern names):** unknown_event, unknown_field, sha256_length_invalid, error_short_too_long, string_too_long, forbidden_pattern:cypher, forbidden_pattern:email, forbidden_pattern:phone, forbidden_pattern:brain_url, forbidden_pattern:absolute_path, forbidden_pattern:raw_hex, free_text_prose_suspected.
- **Output path:** ~/.mindrian/telemetry/v1.13/.quarantine-<source>.jsonl with one line per quarantined row.
- **Row shape:** `{source: <name>, reason: <short>, original_sha256: <sha256-of-full-original-row>}`. The original payload is hashed, not stored, so quarantine remains audit-grade without re-introducing Part 8 risk.
- **Continuation:** the migration does NOT abort on a quarantined row. Clean rows from the same source still merge to events-YYYY-WNN.jsonl; the source's fingerprint is recorded after processing so a re-run does not retry quarantined rows.

## Repointed Consumer

- **scripts/hooked-rescore-117.cjs:**
  - Before: `readdirSync(TELEMETRY_DIR).filter(n => n.endsWith('.jsonl'))` -- pulled every *.jsonl shard including legacy mva.jsonl + the new events files (would double-count after the shim's dual-write started).
  - After: `readdirSync(TELEMETRY_DIR).filter(n => /^events-\d{4}-W\d{2}\.jsonl$/.test(n))` -- anchored to the unified stream only.
  - Per-line filter: now reads BOTH `evt.event` (unified field) and `evt.event_type` (legacy field) and back-fills event_type for downstream Hooked-axis computation that still references it.
  - RELEVANT_EVENTS expanded with the Phase 121 unified types: auto_explore_decision, selector_pick, mva_option_selected, breakthrough_dismissed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-name-prefixed fingerprint**

- **Found during:** Task 1, Test 4 (first GREEN run).
- **Issue:** Test 4 wrote 4 source files all with the same first timestamp `2026-05-10T12:00:00.000Z`. The original sourceFingerprint hashed only the timestamps. After mva migrated and recorded its fingerprint, the next 3 sources hit the SAME fingerprint and got flagged as alreadyMerged -- only mva migrated, the other 3 skipped.
- **Fix:** sourceFingerprint now hashes `source.name + '|' + timestamps.join('|')`. Per-source idempotence units; no collision.
- **Files modified:** scripts/migrate-telemetry-v1.cjs (sourceFingerprint signature + caller).
- **Commit:** 806ca678 (the GREEN commit included this fix; Test 4 went from FAIL to PASS).

**2. [Rule 3 - Blocking issue] mva-telemetry shim must dual-write to legacy mva.jsonl**

- **Found during:** Task 2, first naive-shim attempt.
- **Issue:** Pure delegation to writer.emit() landed mva_option_selected events in events-YYYY-WNN.jsonl. But the Phase 118 mva-option-router test's `readTelemetryLines` (test line 92-96) reads from mva.jsonl looking for mva_option_selected, and `_readLastBriefRenderedEvent` in mva-option-router.cjs (line 155-174) also reads mva.jsonl. 13/18 Phase 118 tests failed. Eight production consumers reference mva.jsonl across mva-detect.cjs, mva-orchestrator.test, mva-detect.smoke.test, mva-option-router.test, mva-telemetry.test, tests/test-mva-dror-harness.cjs, and the router itself.
- **Fix:** The shim writes to BOTH paths: writer.emit() first (Canon Part 8 gate + unified events-YYYY-WNN.jsonl append) AND a best-effort `fs.appendFileSync` to legacy mva.jsonl after. This preserves Phase 118 byte-functional compatibility (the `phase_118_safety` hard floor in the spawn prompt) while delivering the unified-stream upgrade. v1.14.0 will retire both the shim and the legacy dual-write when every reader is repointed.
- **Why not Rule 4 (architectural):** the dual-write is a transitional pattern, not an architectural change. Migration deprecation patterns are explicitly anticipated by the plan ("Deprecation timeline: this shim deletes in v1.14.0"). The dual-write is the missing operational detail that the plan author did not include but that the safety constraint requires.
- **Files modified:** lib/core/mva-telemetry.cjs (the shim, 58 LOC).
- **Commit:** ed29bbc2.

**3. [Rule 3 - Blocking issue] require('./telemetry/writer.cjs') with explicit .cjs extension**

- **Found during:** Task 2 first compile.
- **Issue:** The plan's spec used `require('./telemetry/writer')` literally (without .cjs). The plan's acceptance criterion regex `grep -c "require\\(['\"]\\./telemetry/writer['\"]\\)"` matches that literal form. But Node.js does NOT resolve .cjs files on extension-less require -- 13/18 Phase 118 tests failed with `Cannot find module './telemetry/writer'`.
- **Fix:** The shim uses `require('./telemetry/writer.cjs')` (explicit extension). The Task 3 scaffold gate 3 uses a looser regex `grep -c "require('./telemetry/writer"` that accepts both forms.
- **Plan acceptance regex divergence:** the plan's literal regex `require\\(['\"]\\./telemetry/writer['\"]\\)` returns 0 against the shim (because the shim uses .cjs). The plan author's intent (the shim wires to the writer module) IS satisfied -- the regex is a transcription artifact, not the intent.
- **Files modified:** lib/core/mva-telemetry.cjs (all 3 require lines use .cjs explicitly: writer.cjs, validator.cjs, schema.cjs).

### Canon Part 9 Chokepoint Exception (scoped, documented)

- **Where:** scripts/migrate-telemetry-v1.cjs `appendUnified()` writes via direct `fs.appendFileSync` instead of routing through writer.emit().
- **Why:** writer.emit() overwrites the `timestamp` field with `new Date()`. To preserve the historical timestamp from the source row, the migration must bypass that overwrite. The Plan-checker's recommended fix (extend writer.emit with `opts.historicalTimestamp`) would have required a 4th file change (writer.cjs itself) and re-touched a Plan 121-00 module that was already shipped and tested -- materially expanding plan scope.
- **Canon Part 8 still enforced:** the migration calls `validateEventPayload(eventType, payload)` BEFORE every `fs.appendFileSync`. Rejected rows quarantine. The constitutional gate runs on every historical row, not just runtime emits.
- **Scope:** the exception is scoped to this one-shot migration script. Runtime emit paths (Plans 121-02 / 121-03) route through writer.emit() unchanged. The exception is documented in the migration script's header comment block.
- **Footnote for the verifier:** if a later plan needs the same historical-timestamp affordance, the cleaner fix is to extend writer.emit() with an `opts.historicalTimestamp` parameter at that time -- the migration script's appendUnified function can then collapse to a single writer.emit() call.

## Production Data Touched

No production data was touched during plan execution. The migration script and tests were exercised against hermetic tmpdir fixtures only (HOME pointed at fresh mkdtempSync directories for every test, cleaned up via fs.rmSync(force:true) in finally blocks). The migration is ready for first invocation post-release: when a developer or user runs `node scripts/migrate-telemetry-v1.cjs` on a machine that has accumulated mva.jsonl / selector.jsonl / navigation-bypass.jsonl / query-efficiency.jsonl shards over the v1.13.0-beta.x train, the script will merge them into events-YYYY-WNN.jsonl, record fingerprints, and rename originals to *.pre-v121.bak. Idempotent on subsequent runs.

## Verification

- `node scripts/migrate-telemetry-v1.test.cjs` -> 8/8 tests passed
- `node --test lib/core/mva-option-router.test.cjs` -> 18/18 (Phase 118 regression fence green)
- `node lib/core/mva-telemetry.test.cjs` -> 5/5 (legacy mva.jsonl dual-write regression fence green)
- `node --test lib/core/mva-orchestrator.test.cjs` -> 21/21
- `node --test lib/core/mva-detect.smoke.test.cjs` -> 1/1
- `bash tests/test-121-01-scaffold.sh` -> 6/6 gates green
- `bash tests/run-all-121.sh` -> 6/6 suites green (test-121-00-scaffold + test-121-01-scaffold + schema.test + validator.test + writer.test + migrate-telemetry-v1.test)
- `grep -P "\x{2014}"` across the 4 modified files -> 0 em-dashes
- `grep -cE "fetch\(|http\.|brain\.mindrian"` on migrate-telemetry-v1.cjs -> 0 (zero network surface)
- `grep -c "validateEventPayload" scripts/migrate-telemetry-v1.cjs` -> 5 (Canon Part 8 gate inline)
- `grep -c "alreadyMerged\|sourceFingerprint" scripts/migrate-telemetry-v1.cjs` -> 6 (idempotence wired)

## Self-Check: PASSED

- [x] scripts/migrate-telemetry-v1.cjs exists and is 291 lines: FOUND
- [x] scripts/migrate-telemetry-v1.test.cjs exists and is 356 lines: FOUND
- [x] tests/test-121-01-scaffold.sh exists and is executable: FOUND
- [x] lib/core/mva-telemetry.cjs is 58 lines (shim): FOUND
- [x] scripts/hooked-rescore-117.cjs has 'Phase 121-01:' marker: FOUND (3 inline references)
- [x] tests/run-all-121.sh references test-121-01-scaffold.sh: FOUND
- [x] tests/run-all-121.sh references migrate-telemetry-v1.test.cjs: FOUND
- [x] lib/memory/run-feynman-tests.cjs registers migrate-telemetry-v1.test.cjs: FOUND
- [x] Commit 2f76d8db (RED) exists: FOUND
- [x] Commit 806ca678 (GREEN Task 1) exists: FOUND
- [x] Commit ed29bbc2 (Task 2 shim) exists: FOUND
- [x] Commit 7dce34ed (Task 3 repoint) exists: FOUND
