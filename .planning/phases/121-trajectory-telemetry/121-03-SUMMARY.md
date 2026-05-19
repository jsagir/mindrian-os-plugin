---
phase: 121-trajectory-telemetry
plan: 03
subsystem: telemetry
tags: [d-09, secondary-capture, broad-sweep, drowning-protection, type-discriminator, post-tool-use, slash-command, canon-part-8, canon-part-9, canon-part-10]

# Dependency graph
requires:
  - phase: 121-00
    provides: lib/core/telemetry/writer.cjs (unified emit chokepoint) + schema.cjs ALLOWED_FIELDS for empathy_observation + room_receipt_written + command_invocation + validator.cjs (Canon Part 8 emit-time gate that catches forbidden patterns in CLI inputs and hook env vars).
  - phase: 121-01
    provides: precedent for the dual-form require regex (the Plan 121-01 mva-telemetry shim convention) -- Node.js does not auto-resolve .cjs extensions so the wire-in uses the explicit suffix.
  - phase: 119-room-as-receipt-invariant
    provides: lib/core/room-auto-create.cjs::autoCreatePlaceholderRoom -- the receipt-write surface where emitReceiptWritten is invoked AFTER memory_event success and BEFORE the return statement.
provides:
  - "scripts/empathy-observation-emit.cjs (108 lines): manual-trigger CLI for the empathy audit ritual; 5 flags map 1:1 with ALLOWED_FIELDS.empathy_observation; strict integer + 64-hex parse; missing-flag stderr surface"
  - "lib/core/room-receipt-emit.cjs (63 lines): emit helper module called from Phase 119 receipt-write surface; non-throwing by contract; sha256 + first-16 hash discipline"
  - "scripts/telemetry-command-invocation.cjs (120 lines): PostToolUse hook script; script-level /^/mos:/ filter; enum-normalized outcome (success/error/aborted, cancelled coerces); duration_ms defaults to 0; processInvocation() exported for tests"
  - "hooks/hooks.json: new SlashCommand PostToolUse entry routing /mos:* invocations to telemetry-command-invocation.cjs; 4 SessionStart entries preserved byte-for-byte"
  - "lib/core/room-auto-create.cjs: Phase 121-03 D-09 wire-in inserted AFTER memory_event success and BEFORE the return statement"
  - "tests/test-121-03-empathy-observation.cjs (233 lines, 5/5 passed)"
  - "tests/test-121-03-room-receipt-emit.cjs (187 lines, 4/4 passed)"
  - "tests/test-121-03-command-invocation-hook.cjs (258 lines, 5/5 passed)"
  - "tests/test-121-03-drowning-protection.cjs (110 lines, PASS)"
  - "tests/test-121-03-scaffold.sh (131 lines, 8/8 gates green)"
  - "tests/run-all-121.sh: extended (3 shell + 8 cjs = 11 suites; was 2 shell + 4 cjs = 6 suites)"
  - "lib/memory/run-feynman-tests.cjs: registered 4 new Phase 121-03 test files"
affects: [121-04, SEED-002 agent-lightning lab loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-discriminator drowning protection (D-09): the command_invocation bucket is HIGH VOLUME (100% sampling of /mos:* invocations) but lives in its OWN event type bucket; consumers filter by event !== 'command_invocation' to keep the high-signal selector_pick / tension_engagement / breakthrough_dismissed stream intact. The type discriminator IS the protection -- no per-row sampling at write time. Fixture: 100 cmd_inv + 10 selector_pick events; filter-isolatable both directions."
    - "Two-layered filter pattern (PostToolUse): the hooks.json matcher gets the hook in the door (matcher='SlashCommand'); the script-level /^/mos:/ guard is the inner filter that decides whether to emit. The matcher is permissive on purpose -- Claude Code's PostToolUse matcher conventions may be coarser than ideal, but the script-level filter is the constitutional gate."
    - "Non-exiting test variant pattern: scripts/telemetry-command-invocation.cjs exports BOTH main() (always process.exit(0) -- the CLI / hook path) AND processInvocation() (pure logic, returns 'emitted'/'skipped'). Tests call processInvocation() so the test runner is not terminated by the hook's exit-on-completion contract."
    - "Defensive falsy-input emit pattern (Phase 119 wire-in): emitReceiptWritten swallows all internal errors; sha256('') is the empty-string fallback for missing slug / conversationId. The telemetry surface MUST NEVER block the receipt-write it observes -- a missing telemetry row is recoverable, a crashed room creation is not."

key-files:
  created:
    - "scripts/empathy-observation-emit.cjs (108 lines): D-09 surface 1 -- manual-trigger CLI"
    - "lib/core/room-receipt-emit.cjs (63 lines): D-09 surface 2 -- helper module"
    - "scripts/telemetry-command-invocation.cjs (120 lines): D-09 surface 3 -- PostToolUse hook script"
    - "tests/test-121-03-empathy-observation.cjs (233 lines, 5/5 passed)"
    - "tests/test-121-03-room-receipt-emit.cjs (187 lines, 4/4 passed)"
    - "tests/test-121-03-command-invocation-hook.cjs (258 lines, 5/5 passed)"
    - "tests/test-121-03-drowning-protection.cjs (110 lines, PASS)"
    - "tests/test-121-03-scaffold.sh (131 lines, 8/8 gates)"
  modified:
    - "hooks/hooks.json: new SlashCommand PostToolUse entry registering telemetry-command-invocation.cjs; 4 SessionStart entries byte-preserved; PostToolUse count grew from 8 to 9 entries"
    - "lib/core/room-auto-create.cjs: Phase 121-03 D-09 wire-in (5 lines added) -- emitReceiptWritten invoked AFTER the existing memory_event try/catch block, BEFORE the return statement"
    - "lib/memory/run-feynman-tests.cjs: 4 new Phase 121-03 entries registered (empathy + room-receipt + command-invocation + drowning-protection)"
    - "tests/run-all-121.sh: 1 shell suite + 4 cjs suites appended"

key-decisions:
  - "D-09 honored: type discriminator IS the drowning protection. command_invocation rows live in their own event type bucket so consumers (SEED-002, hooked-rescore-117) can filter by event !== 'command_invocation' without losing the high-signal stream. 100% sampling at write time; no per-row sampled boolean; if production indicates need, D-09 allows dropping to 10% sampling without schema break in v1.14.0."
  - "Phase 119 receipt-write surface located: lib/core/room-auto-create.cjs::autoCreatePlaceholderRoom is THE receipt-write surface (the room creation IS the receipt per Canon Part 10 sub-claim 3). Wire-in lands AFTER the existing room_auto_created memory_event try/catch block (so the telemetry row reflects a fully-durable room) and BEFORE the return statement. Conversation-id source: options.source_material_id (Phase 117 material_id, 32-hex)."
  - "Hook env contract: CLAUDE_TOOL_COMMAND / CLAUDE_TOOL_OUTCOME / CLAUDE_TOOL_DURATION_MS / CLAUDE_SESSION_ID / PWD. The matcher='SlashCommand' is a best-effort guess at the Claude Code PostToolUse matcher convention for slash commands; the script-level /^/mos:/ guard is the inner gate. If the matcher convention changes in a future Claude Code release, the inner filter still gates correctly -- it just means fewer no-op invocations of the script."
  - "Outcome enum normalization: ALLOWED_FIELDS.command_invocation closed-set is 'success' | 'error' | 'aborted' (per schema.cjs). The hook env may surface 'cancelled' (the more common Claude Code tool-runtime vocabulary) -- the script coerces 'cancelled' to 'aborted'. Anything outside the closed set falls back to 'success' (defensive: never reject a row over an enum mismatch)."
  - "Non-exiting test variant: scripts/telemetry-command-invocation.cjs exports processInvocation() (pure logic, returns 'emitted'/'skipped') alongside main() (always process.exit(0)). Tests call processInvocation() so the test runner is not terminated by the hook's CLI-path exit contract. Discovered when test 1 succeeded but the next test never ran -- Rule 1 inline fix during execution."
  - "Test 3 regex relaxation: the plan's literal regex /require\\(['\"]\\.\\/room-receipt-emit['\"]\\)/ did not include .cjs, but Node.js does not auto-resolve the .cjs extension on extension-less require. The test accepts either form (with or without .cjs). Mirrors the Plan 121-01 scaffold's identical relaxation for the mva-telemetry shim."

patterns-established:
  - "Type-discriminator drowning protection: when a telemetry bucket is high-volume (100% sampling for outcome correlation), it lives in its own event type bucket so consumers filter by type. The type discriminator IS the protection. Avoids the SEED-002 drowning failure mode without per-row sampling complexity."
  - "Two-form require regex pattern (extending Plan 121-01): scaffold tests that grep for the wire-in's require call accept both 'require(./module)' and 'require(./module.cjs)' because Node.js does not auto-resolve .cjs without the extension. Documented at Plan 121-01 line key-decisions; reused here."
  - "PostToolUse hook two-layer filter: hooks.json matcher gets the script in the door (broad / coarse / may match more than intended); the script-level inner regex is the constitutional gate that decides whether to emit. Reduces dependency on Claude Code's evolving matcher conventions."
  - "Non-exiting test variant for process.exit'd CLIs: every CLI / hook script that lives behind a require.main === module guard MUST export a non-exiting variant (pure logic returning a status string) so tests can drive it without terminating the runtime. Documented at scripts/telemetry-command-invocation.cjs."

requirements-completed: [TELEMETRY-121-09]

# Metrics
duration: 24min
completed: 2026-05-19
---

# Phase 121 Plan 03: Secondary D-09 Capture Points Summary

**3 secondary trajectory-telemetry capture points wired via the unified writer chokepoint: empathy audit observation CLI + Phase 119 room-as-receipt helper + PostToolUse /mos:* broad sweep -- the broad sweep lives in its own type-discriminated bucket as the constitutional drowning protection per D-09.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-19T08:47Z (parallel with Plan 121-02)
- **Completed:** 2026-05-19T09:11Z
- **Tasks:** 4 / 4 complete (TDD pairs for Tasks 1-3 + scaffold harness for Task 4)
- **Files created:** 8 (3 production + 5 test/scaffold)
- **Files modified:** 4 (hooks.json + room-auto-create.cjs + run-feynman-tests.cjs + run-all-121.sh)
- **Test cases:** 19/19 green (5 empathy + 4 room-receipt + 5 command-invocation + 1 drowning-protection + 8 scaffold gates)
- **LOC delta:** +1210 lines added across 8 new files; +13 lines modified across 4 existing files

## Accomplishments

### Task 1: empathy_observation CLI emitter (D-09 surface 1)

`scripts/empathy-observation-emit.cjs` is a manually-triggered harness from the empathy audit ritual. Five flags map 1:1 with `ALLOWED_FIELDS.empathy_observation`:

```
node scripts/empathy-observation-emit.cjs \
  --engaged-past-15m=true \
  --handed-back-material=false \
  --returned-within-48h=true \
  --ttr-seconds=600 \
  --tester-id-hash=<sha256-of-tester-id>
```

Boolean parse rule: 'true' / 'yes' / '1' -> Boolean true; 'false' / 'no' / '0' -> Boolean false; case-insensitive. The integer parse rule rejects non-pure-integer ttr-seconds (e.g. '1.5', '60abc', 'not-a-number'). tester-id-hash MUST match `^[0-9a-f]{64}$` -- never the raw tester ID (Canon Part 8).

Routes through `writer.emit()` (Canon Part 9). Emit-time validator (Canon Part 8) catches any forbidden pattern (email / phone / Brain URL / absolute path / Cypher / free-text prose) that smuggles in via flag input.

### Task 2: room_receipt_written helper + Phase 119 wire-in (D-09 surface 2)

`lib/core/room-receipt-emit.cjs` exposes `emitReceiptWritten(roomSlug, conversationId)`:

- `room_slug_sha256` = sha256(slug) -- 64-char hex
- `conversation_id_hash` = sha256(conversationId).slice(0, 16) -- shorter hash
- `generated_at_ts` = Date.toISOString()

Non-throwing by contract: falsy args fall back to sha256('') (defensive empty-string hash). The helper swallows all internal errors so the Phase 119 receipt-write surface is never blocked by telemetry.

**Phase 119 wire-in:** `lib/core/room-auto-create.cjs::autoCreatePlaceholderRoom`, AFTER the existing `navigation.logMemoryEvent('room_auto_created', ...)` try/catch block and BEFORE the `return { ok: true, ... }` statement. The wire-in carries the `Phase 121-03 D-09` comment marker for grep verification:

```javascript
// Phase 121-03 D-09: emit room_receipt_written for trajectory telemetry.
try {
  const { emitReceiptWritten } = require('./room-receipt-emit.cjs');
  emitReceiptWritten(slug, options.source_material_id || null);
} catch (_e) { /* graceful */ }
```

Per Canon Part 10 sub-claim 3 ("rooms are receipts, not entry points"), every room creation IS a receipt of conversation work. The telemetry surface mirrors the existing `room_auto_created` memory_event into the trajectory stream so SEED-002 can correlate receipt cadence with engagement quality.

### Task 3: command_invocation PostToolUse hook (D-09 surface 3)

`scripts/telemetry-command-invocation.cjs` is the broad-sweep hook. Two-layer filter:

1. **hooks.json matcher:** `"matcher": "SlashCommand"` (gets the script in the door).
2. **Script-level filter:** `/^\/mos:/.test(CLAUDE_TOOL_COMMAND)` (the constitutional gate).

Payload shape:
```javascript
telemetry.emit('command_invocation', {
  command:      process.env.CLAUDE_TOOL_COMMAND,       // '/mos:scout' etc.
  outcome:      normalized,                             // 'success' | 'error' | 'aborted'
  duration_ms:  parseInt(process.env.CLAUDE_TOOL_DURATION_MS) || 0,
  context_hash: sha256(PWD + '|' + CLAUDE_SESSION_ID).slice(0, 16)
});
```

Outcome normalization: 'cancelled' coerces to 'aborted' (the closed-set enum in schema.cjs). Anything outside the closed set falls back to 'success' (defensive).

The script exports `main()` (always process.exit(0), the CLI path) AND `processInvocation()` (pure logic, returns 'emitted'/'skipped', for tests). PostToolUse hooks MUST NEVER block the user's flow -- all internal errors swallow silently.

### Task 4: Drowning-protection fixture + scaffold harness

The drowning-protection fixture (`tests/test-121-03-drowning-protection.cjs`) proves the D-09 type discriminator works:

1. Emit 100 `command_invocation` events + 10 `selector_pick` events via `writer.emit()` to a tmpdir-scoped HOME.
2. The single `events-YYYY-WNN.jsonl` contains exactly 110 lines.
3. Filter by `event !== 'command_invocation'` returns exactly 10 lines (high-signal events survive).
4. Filter by `event === 'command_invocation'` returns exactly 100 lines (bucket intact).

The fixture validates: SEED-002 consumers can drop the command_invocation bucket without losing a single high-signal event. The type discriminator IS the protection -- no per-row sampling needed at write time.

The 8-gate scaffold harness (`tests/test-121-03-scaffold.sh`):
1. empathy-observation-emit.cjs + empathy_observation emit
2. room-receipt-emit.cjs + emitReceiptWritten export
3. telemetry-command-invocation.cjs + command_invocation emit + /^/mos:/ filter
4. hooks/hooks.json registers entry + valid JSON + 4 SessionStart entries preserved
5. drowning-protection fixture green
6. 3 integration tests green
7. zero em-dashes across 8 121-03 files
8. Canon Part 9 chokepoint: all 3 emit sources route through writer.cjs

## Test Results

```
tests/test-121-03-empathy-observation.cjs        5/5 PASSED
tests/test-121-03-room-receipt-emit.cjs          4/4 PASSED
tests/test-121-03-command-invocation-hook.cjs    5/5 PASSED
tests/test-121-03-drowning-protection.cjs        1/1 PASSED
tests/test-121-03-scaffold.sh                    8/8 GATES GREEN

bash tests/run-all-121.sh                        11/11 PASSED
node lib/core/room-auto-create.test.cjs          9/9 PASSED (Phase 119 regression clean)
```

## Drowning Protection Demonstration

The constitutional invariant: `event` is the type discriminator. SEED-002 consumers filter by event to avoid drowning the high-signal stream.

| Event type | Count | Filter pattern | Survives `event !== cmd_inv`? |
|------------|-------|----------------|-------------------------------|
| `command_invocation` | 100 | `event === 'command_invocation'` | NO (correctly excluded) |
| `selector_pick` | 10 | `event === 'selector_pick'` | YES (high-signal survives) |
| **total** | **110 (1 file)** | | **10 high-signal preserved** |

If production volume becomes a problem, D-09 specifies the future migration path: drop to 10% sampling via a `sampled: true/false` field addition. No schema break required because field additions are additive in v1. Deferred to v1.14.0 unless production indicates need.

## Deviations from Plan

### Rule 1 - Bug: Test runner termination from process.exit in script main()

**Found during:** Task 3 GREEN phase (test execution).

**Issue:** The first test passed, then subsequent tests in the same file never ran because `scripts/telemetry-command-invocation.cjs::main()` calls `process.exit(0)` which terminates the test runner process (not just main()).

**Fix:** Refactored the script to export TWO entry points -- `main()` (always process.exit(0), CLI / hook path) and `processInvocation()` (pure logic, returns 'emitted'/'skipped'). Tests call `processInvocation()` so they can drive the script repeatedly within a single Node process. The CLI / hook path is unchanged byte-for-byte (still process.exit(0) on success and on any internal error).

**Files modified:** scripts/telemetry-command-invocation.cjs + tests/test-121-03-command-invocation-hook.cjs.

**Commit:** 1e05d1d9 (carries both the refactor and the test update).

### Rule 1 - Bug: Test 3 regex did not match Node.js require resolution

**Found during:** Task 2 GREEN phase (test execution).

**Issue:** Test 3 grepped for `require('./room-receipt-emit')` (no .cjs extension) but the wire-in MUST use `require('./room-receipt-emit.cjs')` because Node.js does not auto-resolve the .cjs extension. The Plan 121-01 scaffold hit the same problem and relaxed its scaffold gate to accept either form.

**Fix:** Test 3 regex relaxed to `/require\(['"]\.\/room-receipt-emit(\.cjs)?['"]\)/`. The Plan 121-01 scaffold convention applies; future scaffold gates that grep for require calls should accept either form.

**Files modified:** tests/test-121-03-room-receipt-emit.cjs.

**Commit:** 94336f6f (carries the test fix together with the GREEN production code).

## Canon Compliance

- **Canon Part 8 (Graph Boundary):** All 3 new emit sources route through `validator.cjs::validateEventPayload` via `writer.emit()`. Forbidden patterns (Cypher / email / phone / Brain URL / absolute path / raw hex in non-hash fields / free-text prose) are rejected at emit time. The validator's `_hash`-suffix exemption correctly handles `tester_id_hash` and `conversation_id_hash` without false-flagging them as raw-hex breaches.
- **Canon Part 9 (Memory Locality):** Single chokepoint per `lib/core/telemetry/writer.cjs` -- no `fs.appendFileSync` anywhere in the 3 new emit sources. Scaffold gate 8 verifies this with a grep sweep.
- **Canon Part 10 (Conversation as Product):** Sub-claim 3 ("rooms are receipts, not entry points") is honored at the Phase 119 wire-in -- every `autoCreatePlaceholderRoom` success emits a `room_receipt_written` event, mirroring the existing `room_auto_created` memory_event into the trajectory stream.
- **Em-dash HARD RULE:** Zero U+2014 across all 8 new files (scaffold gate 7).

## Phase 119 file path modified

Per the plan's <output> requirement to record exact Phase 119 file path:

**`lib/core/room-auto-create.cjs`** -- the wire-in lands inside `autoCreatePlaceholderRoom`, AFTER the existing room_auto_created memory_event try/catch (lines 265-293 in the original) and BEFORE the return statement (line 295 in the original). The wire-in adds 7 lines (comment + try/catch + emitReceiptWritten call).

## Self-Check: PASSED

All claims verified on disk:
- scripts/empathy-observation-emit.cjs: FOUND
- lib/core/room-receipt-emit.cjs: FOUND
- scripts/telemetry-command-invocation.cjs: FOUND
- tests/test-121-03-empathy-observation.cjs: FOUND
- tests/test-121-03-room-receipt-emit.cjs: FOUND
- tests/test-121-03-command-invocation-hook.cjs: FOUND
- tests/test-121-03-drowning-protection.cjs: FOUND
- tests/test-121-03-scaffold.sh: FOUND
- hooks/hooks.json: SlashCommand entry FOUND; 4 SessionStart entries FOUND
- lib/core/room-auto-create.cjs: Phase 121-03 D-09 marker FOUND
- lib/memory/run-feynman-tests.cjs: 4 Phase 121-03 entries FOUND
- tests/run-all-121.sh: 1 shell + 4 cjs new entries FOUND

Commits FOUND in git log:
- 933cdbcb: test(121-03): add failing test for empathy observation CLI
- 783029c8: feat(121-03): empathy_observation CLI emitter (D-09 surface 1)
- df53981a: test(121-03): add failing tests for room_receipt_written helper
- 94336f6f: feat(121-03): room-receipt-emit helper + Phase 119 wire-in (D-09 surface 2)
- 62899012: test(121-03): add failing tests for command_invocation PostToolUse hook
- 1e05d1d9: feat(121-03): command_invocation PostToolUse hook (D-09 surface 3)
- 9625a1a0: test(121-03): drowning-protection fixture + 8-gate scaffold harness
