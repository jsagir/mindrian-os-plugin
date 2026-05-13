---
phase: 110-brain-context-packet-contract
plan: "02"
subsystem: brain-context-packet
tags: [canon-part-8, canon-part-9, canon-part-3, canon-part-4, brain-wire-contract, privacy-mode, memory-events, navigation-api, packet-builder]
dependency_graph:
  requires:
    - "Phase 109 (navigation chokepoint + buildBrainPacket builder + EVENT_TYPES Set)"
    - "Phase 110-00 (substrate -- requirements scaffolding for PACKET-110-06 + PACKET-110-07)"
    - "Phase 110-01 (data/brain-packet-schema.json -- the schema this plan's packet emissions must validate against)"
  provides:
    - "lib/core/navigation/packet.cjs::buildBrainPacket return shape now carries top-level origin: 'navigation_api' (D-08 layer 1) and privacy_mode (one of D-03's 3 enum values) -- the shape matches the 110-01 schema's $defs[job].in.required for every shipped D-02 job"
    - "lib/core/navigation/packet.cjs::resolvePrivacyMode(db, roomDir, opts) helper -- per-call > .config.json preferences.brain_privacy_mode > default local_summary_only; allow_excerpts caps down to allow_filenames/local_summary_only absent a Part-3 brain_excerpts APPROVE row ('config caps, never raises')"
    - "lib/core/navigation/packet.cjs::readRoomConfigPrivacyMode + roomHasExcerptApproval (exported sub-helpers)"
    - "lib/core/navigation/memory-events.cjs::EVENT_TYPES Set extended by 3 additive strings: brain_packet_rejected / brain_response_rejected / brain_legacy_path_used (size 32 -> 35) -- the wire-decision telemetry mirror Phase 110-03 sendPacket consumes"
  affects:
    - "Phase 110-03 (sendPacket reads origin + the 3 new EVENT_TYPES; the schema's $defs[job].in.properties.privacy_mode const validates that the resolved mode is the narrower of {request, job's declared mode})"
    - "Phase 110-04 (pre-commit hook enforces 'no sendPacket without buildBrainPacket')"
    - "Phase 110-05 (per-job round-trip + Part-8 invariant suite cross-checks this exact shape against the 110-01 schema)"
tech_stack:
  added:
    - "node:fs (require added to packet.cjs for .config.json read)"
  patterns:
    - "Additive enum extension idiom (Phase 116-00 / 117-00 / 89-07-00 precedent): never reorder, never delete; size grows monotonically; tests assert floor + named membership, never exact size"
    - "Single-chokepoint helper (resolvePrivacyMode) exported for downstream reuse; sub-helpers (readRoomConfigPrivacyMode, roomHasExcerptApproval) also exported so Phase 110-05's per-job round-trip tests can introspect resolution order"
    - "Reuse-before-build (Canon Part 7): .config.json path reuses lib/core/model-profiles.cjs::loadRoomConfig precedent -- no new config file; brain_excerpts approval row reuses the existing local-graph SELECT pattern"
key_files:
  created: []
  modified:
    - "lib/core/navigation/packet.cjs (added fs require + PRIVACY_MODES + readRoomConfigPrivacyMode + roomHasExcerptApproval + resolvePrivacyMode helpers; buildBrainPacket return object gains origin + privacy_mode; module.exports extended)"
    - "lib/core/navigation/memory-events.cjs (EVENT_TYPES Set +3: brain_packet_rejected / brain_response_rejected / brain_legacy_path_used)"
    - "tests/test-navigation-packet-builder.cjs (test1_shape top-level key set extended; 6 new tests 11-16 covering origin stamp, privacy default, per-call override, config read, allow_excerpts cap-down, unrecognized fallback)"
    - "tests/test-navigation-memory-events.cjs (test1_enumCount floor bumped 19 -> 22 + required[] +3; new test10 brain_* acceptance check)"
decisions:
  - "Reused the established .config.json path (preferences.brain_privacy_mode key) instead of introducing a new config file -- Canon Part 7 reuse-before-build + lib/core/model-profiles.cjs::loadRoomConfig precedent"
  - "Stored allow_excerpts approval as a single guarded SELECT against decision/memory_event nodes with review_status='confirmed' AND created_by='user' AND properties LIKE '%brain_excerpts%' -- reuses the existing local-graph access pattern; no new index or migration"
  - "Did NOT touch tests/test-navigation-packet-part8-leak.cjs -- the leak test runs grep-tripwires against JSON.stringify(packet) and does NOT enumerate top-level keys, so the new short-constant fields (origin = 'navigation_api', privacy_mode = 'local_summary_only') trip none of the 8 tripwires. Verified by running it (PASS, 8 tripwires)."
  - "Exported sub-helpers (readRoomConfigPrivacyMode, roomHasExcerptApproval, PRIVACY_MODES) in addition to resolvePrivacyMode so Phase 110-05's tests and Phase 110-03's sendPacket can introspect / reuse the resolution order without duplicating logic"
metrics:
  duration_seconds: 848
  duration_human: "14m 8s"
  tasks_completed: 2
  files_modified: 4
  files_created: 0
  completed_date: "2026-05-13"
  tests_added: 7
  tests_total_after: "16/16 (packet-builder) + 10/10 (memory-events) + 8/8 (part8-leak tripwires)"
  event_types_size_before: 32
  event_types_size_after: 35
---

# Phase 110 Plan 02: Brain-Client Wire-Shape Alignment + EVENT_TYPES Extension Summary

**One-liner:** Add `origin: 'navigation_api'` (D-08 layer-1 provenance stamp) + a new top-level `privacy_mode` field to `buildBrainPacket`, ship `resolvePrivacyMode(db, roomDir, opts)` with per-call > `.config.json` > `'local_summary_only'` precedence (allow_excerpts caps down absent a Part-3 brain_excerpts APPROVE row), and additively extend the frozen `EVENT_TYPES` Set by 3 brain_* telemetry strings -- so the 110-01 schema's `$defs[job].in` shape and Phase 110-03 sendPacket's logEvent calls have matching shipped substrate.

## What Shipped

### Task 1 -- `buildBrainPacket` gains two top-level fields + `resolvePrivacyMode` helper

**File:** `lib/core/navigation/packet.cjs` (modified, +87 lines)

The return object of `buildBrainPacket(db, job, focusNodeId, opts)` now carries two new top-level fields adjacent to `packet_version: '1.0'` / `job` / `room_stage`:

```javascript
{
  packet_version: '1.0',
  job,
  room_stage: getRoomStage(db),
  origin: 'navigation_api',              // NEW -- D-08 layer 1 (closed enum in schema)
  privacy_mode: resolvePrivacyMode(...), // NEW -- D-09 (one of D-03's 3 enum values)
  active_context: { ... },
  local_graph_summary: { ... },
  constraints: { privacy: 'no_raw_artifact_text', max_tokens: 1200 }, // UNCHANGED
}
```

- `origin: 'navigation_api'` is the canonical Layer-1 provenance stamp. The 110-01 schema's `$defs.Origin` enum constrains the legal values; brain-client.sendPacket (110-03) will refuse anything outside the allowlist (Layer 3); a pre-commit hook (110-04) catches bare `sendPacket(` call-sites not preceded by a `buildBrainPacket(` (Layer 2). Defense-in-depth, no crypto.
- `privacy_mode` is the resolved D-03 mode (`local_summary_only` | `allow_filenames` | `allow_excerpts`) for THIS packet. It is a NEW top-level field; `constraints.privacy: 'no_raw_artifact_text'` stays as the separate human-readable note (RESEARCH "Open Question" 6).
- `constraints: { privacy: 'no_raw_artifact_text', max_tokens: 1200 }` is byte-identical to before -- the new field is additive.

**`resolvePrivacyMode(db, roomDir, opts)` resolution order:**

1. **Per-call** -- `opts.privacyMode`, if a valid mode, wins.
2. **Config** -- `roomDir/.config.json` -> `preferences.brain_privacy_mode`, if a valid mode and per-call absent.
3. **Default** -- `'local_summary_only'`.
4. **`allow_excerpts` cap-down** -- if the resolved mode would be `allow_excerpts` but `roomHasExcerptApproval(db, roomDir)` returns false (no `brain_excerpts`-tagged APPROVE row in the local graph), the helper caps to `'allow_filenames'` if config said `allow_filenames`, otherwise to `'local_summary_only'`.

"Config caps, never raises" -- the schema's per-job `$def.in.properties.privacy_mode` is `{ "const": "local_summary_only" }` for every shipped job, so a packet whose resolved mode is `'allow_filenames'` for a job that only allows `'local_summary_only'` will FAIL ajv validation in Phase 110-03 sendPacket. The enforcement is structural, not just procedural.

**Sub-helpers also exported:**

- `readRoomConfigPrivacyMode(roomDir)` -- single-shot read of `.config.json`. Returns null on absent / parse-error / unrecognized.
- `roomHasExcerptApproval(db, roomDir)` -- single guarded SELECT for the Part-3 APPROVE row (`type IN ('decision','memory_event')`, `review_status='confirmed'`, `created_by='user'`, `properties LIKE '%brain_excerpts%'`). Returns false on any error or absent row. As of v1.13.0-beta.3 there is NO shipped consumer of `allow_excerpts` -- so this returns false until a Part-3 gate is wired in a future plan.

**Commit:** `a2c744f feat(110-02): add origin + privacy_mode to buildBrainPacket (D-08 + D-09)`

Plus the TDD-RED preceding commit: `b01a69d test(110-02): add RED tests for origin + privacy_mode in buildBrainPacket` (6 new tests 11-16 + test1_shape top-level key extension).

### Task 2 -- `EVENT_TYPES` extended by 3; regression test bumped

**File:** `lib/core/navigation/memory-events.cjs` (modified, +18 lines including the comment block)

The frozen `Object.freeze(new Set([...]))` literal gained a Phase-110-02 extension block, matching the comment-block style used by Phase 88.2-00 (4 selector_* strings), 89-07-00 (2 reverse_salient_* strings), 116-00 (5 tension_* strings), and 117-00 (6 auto_explore_* / brain_canon_drift_observed strings):

```javascript
  // Phase 110-02 extension (Brain Context Packet Contract; D-07 + D-10 telemetry mirror):
  //   brain_packet_rejected   -> outbound packet failed in-schema validation in
  //                              brain-client.sendPacket (reject hard -- thrown error).
  //   brain_response_rejected -> Brain response failed out-schema validation -> degraded
  //                              soft, NOT ingested, no partial-ingest.
  //   brain_legacy_path_used  -> forward-looking deprecation guard (no current call site
  //                              shipped in 110-02; see brain-client.cjs).
  'brain_packet_rejected',
  'brain_response_rejected',
  'brain_legacy_path_used',
```

The in-file size-invariant comment (which was stale -- said "size 31 invariant" from 117-00) was rewritten to "additive set; downstream phases extend; tests assert FLOOR + named membership, not exact count." The Set size grew **32 -> 35** (additive only). `logEvent` and `findRecentChanges` are byte-identical -- the 3 new strings are accepted only because they are now IN the Set.

**File:** `tests/test-navigation-memory-events.cjs` (modified, +14 lines)

- `test1_enumCount`: floor bumped from `>= 19` to `>= 22` (closed-enum size assertion +3); the `required[]` hardcoded list extended by `brain_packet_rejected`, `brain_response_rejected`, `brain_legacy_path_used`. The test still asserts a FLOOR + named membership (the Phase 109 pattern), never an exact count -- so future enum extensions cannot regress this baseline.
- `test10_phase110BrainEventsAccepted`: NEW. Explicit acceptance check that `logEvent(db, 'brain_packet_rejected', ...)`, `logEvent(db, 'brain_response_rejected', ...)`, and `logEvent(db, 'brain_legacy_path_used', ...)` each return `{ ok: true, eventId: 'memory_event:<type>:...' }`. Mirrors the test2 valid-enum-acceptance idiom but pins the Phase 110-02 additions specifically.

**Commit:** `f1ca01c feat(110-02): extend EVENT_TYPES by 3 brain_* strings + bump regression test`

### tests/test-navigation-packet-part8-leak.cjs -- no edit needed

The Part-8 leak test runs eight grep-style tripwires against `JSON.stringify(packet)`. It does NOT enumerate top-level keys via `Object.keys(packet)`. The two new short-constant fields (`origin = 'navigation_api'`, `privacy_mode = 'local_summary_only'`) trip none of the tripwires (no SECRET marker, no absolute path, no email, no >500-char string, etc.). Verified by running the test against the post-Task-1 packet builder: **PASS (8 tripwires)**. Documented as a deliberate non-edit in the Task 2 commit message.

## Tests / Verification

| Test                                      | Before  | After   | Notes |
|-------------------------------------------|---------|---------|-------|
| tests/test-navigation-packet-builder.cjs  | 10/10   | 16/16   | +6 (Tests 11-16) covering origin + privacy_mode resolution |
| tests/test-navigation-memory-events.cjs   | 9/9     | 10/10   | +1 (test10) explicit Phase-110-02 acceptance check |
| tests/test-navigation-packet-part8-leak.cjs | PASS (8 tripwires) | PASS (8 tripwires) | unchanged -- leak invariants hold |
| scripts/build-brain-packet-schema.cjs --check | OK    | OK      | no schema drift; the new packet shape matches the 110-01 schema |
| Phase-109 spot-check (focus, neighborhood, insights, acceptance) | all PASS | all PASS | zero regression |
| `node -c lib/core/navigation/memory-events.cjs` | syntax OK | syntax OK | |
| `grep -P "[\x{2014}\x{2013}]"` across 5 touched files | 0 matches | 0 matches | no em-dashes / en-dashes |
| `grep '"ajv"' package.json` | 0 matches | 0 matches | ajv NOT in direct deps (transitive only via MCP SDK) |

The Phase 110-04 / 110-05 stub tests (`test-brain-packet-validation-per-job.cjs`, `test-brain-packet-part8-invariant-per-job.cjs`, `test-brain-packet-precommit-hook.cjs`) remain RED -- correct per the plan's verification block ("the new Phase-110 stubs are still RED -- 110-04 / 110-05 fill them").

## Deviations from Plan

None. Plan executed exactly as written. Three notes:

1. **Part-8 leak test edit was not needed.** The plan's Task 2 STEP 3 said: "Run it. If it passes unchanged, leave it (note in the SUMMARY that no edit was needed). If it enumerates the packet's top-level keys (a `Object.keys(packet)` assertion), add `origin` and `privacy_mode` to the expected list." The test does NOT enumerate top-level keys -- it runs adversarial grep tripwires against `JSON.stringify(packet)` -- so no edit was needed. The test passes unchanged. This is the documented expected outcome of the plan's branch-on-need step.
2. **`fs` require was added.** `packet.cjs` already required `node:path` and `node:crypto` but not `node:fs`. The plan's Task 1 step 1 says: "Add `const fs = require('node:fs'); const path = require('node:path');` at the top if not already present (the file may already require some of these -- check; do not duplicate)." `fs` was added; `path` was already present (not duplicated).
3. **In-file size-invariant comment refreshed.** The plan said: "Update any in-file 'set size N invariant' comment (the Phase 117 block has one saying 'size 31 invariant' -- bump to reflect 116's +5 and 117's +6 and 110's +3 as appropriate, OR just say 'additive; downstream phases extend'." Took the second option -- replaced the stale "size 31 invariant" wording with an additive-set explanation that names the contributing phases (88.2-00, 89-07-00, 116-00, 117-00, 110-02). This is more durable than another exact-size-bump.

## Authentication Gates

None. The plan was fully automatable (no auth or network needed; all tests are hermetic with tmpdir room.dbs).

## Known Stubs

None introduced by this plan. The Phase 110-04 / 110-05 stub test files (`test-brain-packet-validation-per-job.cjs`, etc.) are intentionally still RED -- those plans will fill them; the plan's verification block explicitly notes this is the correct state at end-of-110-02.

The `roomHasExcerptApproval` helper deliberately returns false until a Part-3 brain_excerpts gate is wired in a future plan. This is NOT a stub -- it is a documented escape-hatch implementation per D-09 + RESEARCH "Implementation Approach" 8: `allow_excerpts` has no shipped consumer in v1.13.0-beta.3, so the helper correctly caps every request down to `local_summary_only` (or `allow_filenames` if config said that). The behavior is tested explicitly (Test 15 `privacyModeAllowExcerptsCapsDown`).

## Self-Check: PASSED

- File `lib/core/navigation/packet.cjs` exists: FOUND (modified, exports `resolvePrivacyMode`, `readRoomConfigPrivacyMode`, `roomHasExcerptApproval`, `PRIVACY_MODES`).
- File `lib/core/navigation/memory-events.cjs` exists: FOUND (modified, `EVENT_TYPES.size === 35`).
- File `tests/test-navigation-packet-builder.cjs` exists: FOUND (modified, 16 tests, all green).
- File `tests/test-navigation-memory-events.cjs` exists: FOUND (modified, 10 tests, all green).
- Commit `b01a69d` (RED tests): FOUND on main.
- Commit `a2c744f` (Task 1 GREEN): FOUND on main.
- Commit `f1ca01c` (Task 2 GREEN): FOUND on main.
- `node scripts/build-brain-packet-schema.cjs --check`: OK.
- `grep -P "[\x{2014}\x{2013}]"` across all 4 touched files: 0 matches.
- ajv NOT in `package.json` direct dependencies: confirmed.
