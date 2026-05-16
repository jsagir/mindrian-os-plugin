---
phase: 119-room-as-receipt-invariant
plan: "01"
subsystem: room-as-receipt-invariant
tags: [phase-119, plan-01, wave-2, room-as-receipt, retroactive-naming, f1-selector, discard-cascade, tri-surface, canon-part-3, canon-part-8, canon-part-9, canon-part-10, directive-file-handoff]
one_liner: "post-MVA retroactive F.1 selector (4 LOCKED verbatim labels) + LOCAL Haiku 4.5 name suggester + 4-class name validator + transactionally-safe discard cascade w/ rooms-meta.db partial-failure recovery + tri-surface directive-file/INSTRUCTION-FOR-LARRY handoff"

# Dependency graph
dependency_graph:
  requires:
    - "Plan 119-00 autoCreatePlaceholderRoom (creates untitled-{TS} placeholder + .room-root + .mindrian/room.db + registry entry that this plan renames / discards) + PLACEHOLDER_SLUG_RE export (the discard cascade refuses non-placeholder slugs)"
    - "Plan 119-00 EVENT_TYPES strings (room_naming_decided + room_discarded already landed in chokepoint enum)"
    - "Plan 119-02 larry-thinness-acknowledgment.cjs (voiceLine() function + THINNESS_VOICE_LINE constant); STATE.md frontmatter auto_explore_thin flag"
    - "Phase 88.2 selector-dispatcher.cjs (F.1 dispatch primitive)"
    - "Phase 109 navigation.cjs::logMemoryEvent chokepoint + room-db.cjs::openRoomDb canonical opener"
    - "Phase 118 mva-orchestrator runPipeline + mva_brief_rendered telemetry emit (the upstream signal this plan subscribes to)"
  provides:
    - "lib/core/llm-name-suggester.cjs::suggestRoomName: one-shot Haiku 4.5 call seeded with LOCAL Phase 117 + Phase 118 output; returns {ok, suggested_name, model_used, latency_ms}; LOCAL-only (Canon Part 8); graceful degradation to 'untitled' on any failure path"
    - "lib/core/room-name-validator.cjs::validateRoomName: 4 rejection classes (collision / fs-unsafe / reserved-prefix / empty) + Windows-reserved defense-in-depth class"
    - "lib/core/room-discard-cascade.cjs::discardPlaceholderRoom: SQLite-transactional cascade wrapping memory_event emission + registry purge + fs.rmSync; partial-failure recovery via rooms-home/.rooms/_meta/.mindrian/room.db (rooms-meta.db); guards non-placeholder slugs"
    - "lib/core/room-naming-selector.cjs::fireNamingSelector: orchestrator with 4 LOCKED option labels per CONTEXT.md D-06 (F1_OPTION_LABELS) + 4-value DECISION_PATHS enum + IN-path bypass (userPick + suggestedName args) for Larry resume-from-directive duplex"
    - "scripts/room-naming-selector.cjs: tri-surface CLI shim that writes <roomDir>/.context/pending-naming-decision.md directive file (INSTRUCTION FOR LARRY block + 4 verbatim verbs); Larry dispatches AskUserQuestion at next turn"
    - "scripts/check-pending-naming-decision.cjs: session-start cascade scanner for orphaned F.1 directives across session boundaries"
    - "lib/core/mva-orchestrator.cjs phase-119-01-naming-selector-hook: detached + unref'd spawn AFTER mva_brief_rendered emit + BEFORE state.json write; entire block wrapped try/catch -- Phase 119-01 failure NEVER regresses Phase 118"
    - "+1 EVENT_TYPES string (room_discard_partial_failure); set size grows 41 -> 42 (additive tail-append precedent)"
  affects:
    - "v1.13.0 housekeeping pass: /mos:doctor --orphaned-room-cleanup recovery command consumes room_discard_partial_failure memory_events from .rooms/_meta/.mindrian/room.db"
    - "Phase 121 trajectory telemetry consumes room_naming_decided memory_events (decision_path enum: llm-suggested / user-typed / kept-untitled / discarded)"
    - "Phase 121.5 terminal-coherence-capstone: F.1 selector primitive proven end-to-end via the rooms-as-receipt closing flow"
    - "Phase 127 architectural shift may consolidate the rooms-meta.db fallback into the central registry-host db"

# Tech tracking
tech_stack:
  added: []  # zero new runtime dependencies (Canon Part 7 / CLAUDE.md "Reuse Before Build")
  patterns:
    - "Additive EVENT_TYPES tail-append precedent extended by 1 (Phase 110-02 / 116-00 / 117-00 / 124-02 / 125-06 / 125-07 / 119-00 idiom)"
    - "Direct-fetch LLM transport (api.anthropic.com/v1/messages with x-api-key + anthropic-version + AbortController) mirrors lib/core/mva-classifier.cjs::_callHaiku lines 209-257; zero new dependencies"
    - "SQLite-transactional cascade with reverse-order rollback: BEGIN -> logMemoryEvent inside transaction -> COMMIT -> close handle -> registry purge -> fs.rmSync LAST (irreversible step)"
    - "rooms-meta.db fallback artifact: synthetic _meta room at .rooms/_meta/.mindrian/room.db for partial-failure recovery; consumed by /mos:doctor --orphaned-room-cleanup (deferred to v1.13.0 housekeeping pass)"
    - "Directive-file/INSTRUCTION-FOR-LARRY full-duplex handoff (REVISION 2026-05-16 Blocker 3 Option A; precedent: scripts/auto-explore-drain.cjs lines 105-135 + scripts/preflight-tension-surface.cjs lines 95-110): CJS shim writes durable directive at <roomDir>/.context/pending-naming-decision.md; Larry dispatches native AskUserQuestion at next turn; fireNamingSelector accepts userPick arg as the IN-path closure"
    - "Tri-surface JSON envelope contract: CLI / Desktop / Cowork all consume the same shim output + directive file; the consuming surface decides how to render"
    - "F1_OPTION_LABELS Object.freeze + verbatim verb constants per CONTEXT.md D-06 (locked vocabulary precedent from Phase 88.2)"

key_files:
  created:
    - lib/core/llm-name-suggester.cjs
    - lib/core/llm-name-suggester.test.cjs
    - lib/core/room-name-validator.cjs
    - lib/core/room-name-validator.test.cjs
    - lib/core/room-discard-cascade.cjs
    - lib/core/room-discard-cascade.test.cjs
    - lib/core/room-naming-selector.cjs
    - lib/core/room-naming-selector.test.cjs
    - scripts/room-naming-selector.cjs
    - scripts/check-pending-naming-decision.cjs
    - tests/test-room-naming-selector-integration.cjs
    - tests/test-119-01-scaffold.sh
  modified:
    - lib/core/navigation/memory-events.cjs  # +1 string (room_discard_partial_failure) + 13-line provenance comment
    - lib/core/mva-orchestrator.cjs          # phase-119-01-naming-selector-hook block (~40 LOC) AFTER mva_brief_rendered emit, BEFORE CRITICAL-3 state.json write
    - lib/memory/run-feynman-tests.cjs       # +5 test file registrations in Phase 119-01 Wave 2 block

decisions:
  - "D-03 enforced (retroactive naming): F.1 selector fires AFTER Phase 118's mva_brief_rendered emit, NOT at room creation. The user names the room AFTER seeing value (the MVA brief), honoring Canon Part 10 sub-claim 3."
  - "D-06 enforced (4 LOCKED option labels per CONTEXT.md verbatim): [name this room: <LLM-suggested>] / [type your own name] / [keep as untitled] / [discard room]. F1_OPTION_LABELS Object.freeze + interpolateLlmSuggested for {{SUGGESTED}} placeholder substitution at render time."
  - "REVISION 2026-05-16 Blocker 3 (directive-file/INSTRUCTION-FOR-LARRY full-duplex pattern): CJS shim cannot call AskUserQuestion directly (only the Claude Code parent session has that primitive). Instead it WRITES a directive at <roomDir>/.context/pending-naming-decision.md. Larry reads the directive at the next conversational turn via the session-start cascade scanner (scripts/check-pending-naming-decision.cjs) and dispatches AskUserQuestion natively. fireNamingSelector accepts an additional userPick + suggestedName args to bypass dispatcher + channel when called from the IN-path. This honors D-03 + D-06 at execution time, NOT at a hypothetical v1.14.0."
  - "REVISION 2026-05-16 Blocker 2 (LLM client factory): mva-agent-contract.cjs does NOT export createLlmClient; the project-wide LLM-call idiom is direct fetch to api.anthropic.com (precedent: lib/core/mva-classifier.cjs::_callHaiku lines 209-257). _resolveProductionLlmClient mirrors that pattern verbatim. No @anthropic-ai/sdk dependency added."
  - "REVISION 2026-05-16 Warning 5 (Canon Part 8 boundary comment): Brain MCP boundary covers the Mindrian-owned Brain MCP host ONLY; api.anthropic.com is the LOCAL Anthropic LLM transport per the standard plugin LLM usage pattern. Both surfaces are distinct: Brain must never receive user data; api.anthropic.com is a stateless LLM transport. The scaffold harness Gate 3 uses literal-substring greps, so production code body avoids the literal Brain-host hostname entirely."
  - "Cowork first-responder semantics in v1.13.0 (5-minute consensus window deferred to v1.14.0 per CONTEXT.md item 3): decided_by sources from process.env.USER on the first machine to respond; logged in the room_naming_decided memory_event payload."
  - "Partial-failure recovery via rooms-home/.rooms/_meta/.mindrian/room.db (synthetic _meta room). The plan invoked a fictitious lazygraph-ops.bootstrapRoomDb function; canonical opener is room-db.cjs::openRoomDb which auto-bootstraps (Plan 119-00 Rule 3 precedent). The _meta sub-directory pattern (a regular room dir containing a real room.db) lets the cascade use the standard opener without inventing a new bootstrap surface."

patterns_established:
  - "Directive-file/INSTRUCTION-FOR-LARRY full-duplex (REVISION 2026-05-16 Blocker 3 Option A) mirrors auto-explore-drain.cjs + preflight-tension-surface.cjs precedents; the CJS shim writes a durable directive; Larry consumes at the next conversational turn; the orchestrator function exposes a userPick IN-path for resume-after-AskUserQuestion. Pattern is reusable by any phase that needs to surface an F.X selector from a CJS shim AFTER the conversational context has unwound."
  - "Session-start cascade scanner pattern (scripts/check-pending-naming-decision.cjs; precedent: scripts/check-onboard-statusline.cjs from Phase 106-05) handles cross-session continuity: a user who closes Claude before answering the F.1 selector gets the same selector back on next session start."
  - "Defense-in-depth multi-rejection compounding in validator (untitled/with-slash trips BOTH reserved_prefix:untitled- AND fs_unsafe_chars; UI can choose which to render first)."
  - "Synthetic _meta room dir pattern (.rooms/_meta/.mindrian/room.db) for fallback memory_event databases at the rooms-home level; reuses the canonical openRoomDb opener without inventing a new bootstrap surface."

requirements_completed:
  - ROOMRECEIPT-119-04  # Retroactive-naming F.1 selector after MVA pipeline (D-03 + D-06)
  - ROOMRECEIPT-119-06  # Discard-room cascade (D-06 fourth option -- atomic / transactionally-safe)
  - ROOMRECEIPT-119-07  # Cross-surface adaptation (CLI / Desktop / Cowork) for the F.1 selector

# Metrics
duration: "13 minutes"
completed: "2026-05-16T19:38:04Z"
---

# Phase 119 Plan 01: Room-as-Receipt Invariant -- Retroactive Naming F.1 Selector Summary

**Post-MVA retroactive F.1 selector (4 LOCKED verbatim labels) + LOCAL Haiku 4.5 name suggester + 4-class name validator + transactionally-safe discard cascade w/ rooms-meta.db partial-failure recovery + tri-surface directive-file/INSTRUCTION-FOR-LARRY handoff.**

## Performance

- **Duration:** 13 min (started 19:24:55Z; completed 19:38:04Z)
- **Tasks:** 4 of 4 atomic commits (each task TDD: RED tests + GREEN implementation)
- **Files created:** 12 (5 source modules + 5 test files + 2 CLI shims; one shell harness counted alongside)
- **Files modified:** 3 (memory-events.cjs +1 string; mva-orchestrator.cjs hook block; run-feynman-tests.cjs +5 test registrations)
- **Tests:** 48/48 GREEN across 5 test files (11 llm-name-suggester + 11 room-name-validator + 6 room-discard-cascade + 14 room-naming-selector + 6 integration)
- **Scaffold harness:** tests/test-119-01-scaffold.sh exits 0 (7/7 gates green)
- **Phase 118 regression:** tests/run-all-118.sh 16/16 GREEN (zero regression introduced by the hook insertion)

## Wire Diagram

```
Phase 118 mva-orchestrator.cjs::runPipeline
        |
        | telemetry.emit('mva_brief_rendered', {sentence_sha256, total_duration_ms, ...})
        |
        v
+--------------------------------------------------+
| Phase 119-01 phase-119-01-naming-selector-hook   |
|  (try/catch wraps the entire block;              |
|   Phase 119 failure NEVER regresses Phase 118)   |
|                                                  |
|  1. resolve roomsHome + activeRoomDir            |
|     from .rooms/registry.json                    |
|  2. cp.spawn('node', [shimPath, --room-dir, ...] |
|     {detached:true, stdio:'ignore'}).unref()     |
+--------------------------------------------------+
        |
        v
scripts/room-naming-selector.cjs (detached child)
        |
        | 1. parse --room-dir + --sentence-sha256
        | 2. readAutoExploreFinding (Phase 117 finding JSON)
        | 3. readMvaBriefSentence  (Phase 118 brief sidecar)
        | 4. suggestRoomName({finding, sentence})
        |      |
        |      v
        | lib/core/llm-name-suggester.cjs
        |   one-shot Haiku 4.5 via direct fetch to
        |   api.anthropic.com (mirrors mva-classifier
        |   pattern; LOCAL-only; graceful degradation
        |   to 'untitled' on any failure)
        | 5. read STATE.md auto_explore_thin flag
        |    -> maybe prepend THINNESS_VOICE_LINE
        | 6. compose directive (4 verbatim verbs +
        |    INSTRUCTION FOR LARRY block)
        | 7. atomicWrite to
        |    <roomDir>/.context/pending-naming-decision.md
        | 8. stdout JSON envelope; exit 0
        v
(Larry reads the directive at the next conversational turn
 via session-start cascade scanner OR direct directive
 consumption; dispatches native AskUserQuestion with the
 four verbs; user picks an option)
        |
        | Larry calls back into:
        v
lib/core/room-naming-selector.cjs::fireNamingSelector({
  roomDir, decidedBy, surface,
  userPick: '<verb-string>',   <-- IN-path arg; bypasses
  suggestedName: '<slug>',         dispatcher + channel
})
        |
        v
+----------------+---------------+-------------------+
| choice         | branch        | side effect       |
+----------------+---------------+-------------------+
| [name this     | _resolveRename| (a) validateRoomName
|  room: X]      | decision_path | (b) bash room-registry
|                | 'llm-suggested'    update venture_name
|                |                (c) direct registry
|                |                    JSON mutation
|                |                (d) fs.renameSync
|                |                    (preserves room.db
|                |                     row IDs atomically)
|                |                (e) navigation.logMemory
|                |                    Event 'room_naming_
|                |                    decided' to NEW
|                |                    .mindrian/room.db
+----------------+---------------+-------------------+
| [type your own | _resolveUserTyped -> _resolveRename
|  name]         | decision_path = 'user-typed';
|                | validation failure -> re-prompt
|                | inline (NO silent fallback)
+----------------+---------------+-------------------+
| [keep as       | no rename     | navigation.logMemory
|  untitled]     | decision_path | Event 'room_naming_
|                | 'kept-untitled'    decided' with
|                |                    previous_slug ==
|                |                    new_slug; original
|                |                    placeholder room
|                |                    preserved
+----------------+---------------+-------------------+
| [discard room] | discardPlace- | (a) BEGIN sqlite txn
|                | holderRoom    | (b) logMemoryEvent
|                | decision_path |     'room_discarded'
|                | 'discarded'   |     INSIDE txn
|                |               | (c) COMMIT
|                |               | (d) close db handle
|                |               | (e) registry purge
|                |               |     (CLI archive +
|                |               |      direct JSON key
|                |               |      removal)
|                |               | (f) fs.rmSync LAST
|                |               |     (irreversible);
|                |               |     on EACCES -> emit
|                |               |     room_discard_
|                |               |     partial_failure to
|                |               |     rooms-meta.db
|                |               |     fallback
|                |               | (g) logMemoryEvent
|                |               |     'room_naming_
|                |               |     decided' to
|                |               |     rooms-meta.db
|                |               |     (the room.db is
|                |               |     gone)
+----------------+---------------+-------------------+
```

## Cross-Surface Envelope Contract

The same JSON envelope shape ships across CLI, Desktop, and Cowork. The consuming surface decides how to render; the orchestrator never invents surface-specific code paths.

**Envelope structure (emitted on shim stdout + persisted in the directive file):**

```json
{
  "shape": "F.1",
  "surface": "cli" | "desktop" | "cowork",
  "phase": "119-01",
  "placeholder_slug": "untitled-2026-05-16-1845",
  "suggested_name": "<LLM-suggested>",
  "directive_path": "<roomDir>/.context/pending-naming-decision.md",
  "thinness_prepended": true | false,
  "awaiting_input": true,
  "envelope": {
    "verbs": [
      "[name this room: <LLM-suggested>]",
      "[type your own name]",
      "[keep as untitled]",
      "[discard room]"
    ]
  }
}
```

**Per-surface rendering (consumer-side, NOT in this plan's code):**

| Surface | Render | decided_by source |
|---------|--------|-------------------|
| CLI | Larry reads directive, dispatches AskUserQuestion with the four verbs as a numbered menu | `process.env.USER` |
| Desktop | Larry paraphrases the envelope conversationally ("Want me to name this 'X', let you type your own, keep it as untitled, or scrap the whole thing?") | `process.env.USER` |
| Cowork | shared-state choice point in `<roomDir>/.context/`; first-responder collaborator's AskUserQuestion answer wins | `process.env.USER` on the first machine to respond |

**Deferred to v1.14.0:** 5-minute Cowork consensus window (currently first-responder semantics ship in v1.13.0 per CONTEXT.md item 3). Per-user collaborator-identity sourcing in shared-state Cowork rooms is also deferred; v1.13.0 sources `decided_by` from `process.env.USER` on the first responder only.

## What v1.13.0 Housekeeping Pass Inherits

When `/mos:doctor --orphaned-room-cleanup` ships (deferred to the v1.13.0 housekeeping pass), the following are guaranteed by this plan:

1. **room_discard_partial_failure memory_event channel exists** in EVENT_TYPES; logged via the navigation.cjs chokepoint.
2. **rooms-meta.db at `<roomsHome>/.rooms/_meta/.mindrian/room.db`** is the durable recovery signal location. The doctor command queries this database for memory_events of type `room_discard_partial_failure`, joins against the on-disk room directories under `<roomsHome>/untitled-*`, and offers the user a recovery action (re-run cascade OR force-delete OR ignore).
3. **Partial-state inventory** is captured in the event payload (`{fs_removed, registry_purged, db_dropped}`) so the recovery command can resume mid-cascade rather than starting over.
4. **Pending F.1 directive scanner exists** (`scripts/check-pending-naming-decision.cjs`); session-start cascade can surface orphaned directives to Larry as a decision_gate_pending operator state.

The recovery command itself is NOT shipped in Plan 119-01. The plan ships the recovery SIGNAL.

## Accomplishments

- **+1 EVENT_TYPES string** landed via the additive tail-append precedent (set size 41 -> 42 from Plan 119-00 baseline; Object.freeze invariant preserved; the three Plan 119-00 strings preserved byte-identical).
- **LLM-name-suggester** (140 LOC) ships LOCAL one-shot Haiku 4.5 calls with direct-fetch transport (zero new dependencies); cost ~$0.0005 per first-MVA completion; graceful degradation to FALLBACK_SUGGESTION='untitled' on any failure path; Canon Part 8 invariant proven by scaffold harness Gate 3.
- **Four-class name validator** (120 LOC) covers collision / fs-unsafe / reserved-prefix / empty plus Windows-reserved defense-in-depth for tri-surface sync; multi-rejection compounding surfaced (e.g. `untitled/with-slash` trips BOTH `fs_unsafe_chars` AND `reserved_prefix:untitled-`).
- **Transactionally-safe discard cascade** (200 LOC) wraps memory_event INSIDE sqlite BEGIN/COMMIT; fs.rmSync runs LAST as the only irreversible step; partial-failure recovery via rooms-meta.db fallback at `<roomsHome>/.rooms/_meta/.mindrian/room.db` (synthetic _meta room dir using canonical openRoomDb opener).
- **Naming-selector orchestrator** (280 LOC) exposes `fireNamingSelector` with two modes: (a) full F.1 dispatch with userInputChannel + dispatcher injection (tests + production-via-Larry); (b) IN-path resume-from-userPick where the verb-string is mapped to the decision branch directly (Larry calls this after her AskUserQuestion returns). F1_OPTION_LABELS LOCKED VERBATIM per CONTEXT.md D-06.
- **Tri-surface CLI shim** (160 LOC) uses the directive-file/INSTRUCTION-FOR-LARRY pattern: writes `<roomDir>/.context/pending-naming-decision.md` with the 4 verbatim verbs + INSTRUCTION FOR LARRY block + AskUserQuestion contract trailer. Same envelope renders across CLI / Desktop / Cowork.
- **Session-start cascade scanner** detects orphaned F.1 directives across session boundaries; a user who closes Claude before answering the F.1 selector gets the same selector back on next session start.
- **mva-orchestrator hook** lands at the unique insertion point AFTER `telemetry.emit('mva_brief_rendered', ...)` and BEFORE the CRITICAL-3 state.json manifest write; entire block wrapped try/catch so Phase 119-01 failures NEVER regress Phase 118 (proven by 16/16 GREEN regression check).

## Task Commits

Each task committed atomically with `--no-verify` (Wave 2 serialized executor; orchestrator validates hooks at phase-end):

1. **Task 1: extend EVENT_TYPES + llm-name-suggester + scaffold harness** -- `17c95c44`
2. **Task 2: room-name-validator + transactional room-discard-cascade w/ partial-failure recovery** -- `d4f96890`
3. **Task 3: naming-selector orchestrator + tri-surface CLI shim + session-start cascade scanner** -- `143185eb`
4. **Task 4: wire phase-119-01-naming-selector-hook into mva-orchestrator + end-to-end integration tests** -- `bd468d62`

## Decisions Made

1. **HAIKU_MODEL_ID inlined as a literal constant** (Rule 1 deviation). The plan's REVISION 2026-05-16 Blocker 2 instructed importing `HAIKU_MODEL` from `lib/core/mva-classifier.cjs`. Inspection of that module's exports (lines 359-370) shows `HAIKU_MODEL` is a module-internal const NOT in module.exports. Inlining the literal `'claude-haiku-4-5'` with provenance comment pointing at `mva-classifier.cjs:53` preserves the single-source-of-truth intent at execution time. If a future phase exports the constant, the inline can be replaced with a require.

2. **rooms-meta.db lives at `<roomsHome>/.rooms/_meta/.mindrian/room.db`** (synthetic _meta room dir; Rule 1 deviation). The plan invoked a fictitious `lazygraph-ops.bootstrapRoomDb` factory. The canonical room.db opener is `lib/core/room-db.cjs::openRoomDb` (Plan 119-00 Rule 3 precedent). The opener takes a roomDir argument and auto-bootstraps the `.mindrian/room.db` file inside. By using `.rooms/_meta` as a synthetic room dir, the cascade reuses the canonical opener (with Phase 109 nodes-provenance + session_focus migrations applied) without inventing a new bootstrap surface.

3. **Reserved-prefix validator handles untitled-prefix AND untitled-namespace-escape** vectors. The naive `startsWith('untitled-')` check would let `untitled/with-slash` through. The validator now matches `untitled` followed by any non-alphanumeric separator. Plan Test 7 (multi-rejection compounding) drove this fix.

4. **CLI shim integration test ordering check uses indexOf(needle, fromIndex)** to skip the file docstring header where `CRITICAL-3 wire` appears as documentation. The actual wire comment is at the post-emit insertion point. Test 1 of the integration suite was updated to find the second occurrence (the real wire comment), not the first (the docstring mention).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HAIKU_MODEL inlined as literal (not imported)**

- **Found during:** Task 1 (llm-name-suggester implementation)
- **Issue:** The plan's REVISION 2026-05-16 Blocker 2 instruction `const { HAIKU_MODEL } = require('./mva-classifier.cjs')` fails because `HAIKU_MODEL` is module-internal in `lib/core/mva-classifier.cjs` (verified at lines 359-370: only `classify`, `classifyAsync`, `isVentureSentence`, `loadHeuristic`, `resolveAnthropicKey`, `_test` are exported). The require would yield `undefined`.
- **Fix:** Inlined `'claude-haiku-4-5'` literal with provenance comment pointing at `lib/core/mva-classifier.cjs:53` as the source-of-truth declaration. If a future phase exports the constant, the inline can be replaced with the require.
- **Files modified:** `lib/core/llm-name-suggester.cjs` (constant declaration line + provenance comment).
- **Verification:** Test 5 asserts `HAIKU_MODEL_ID === 'claude-haiku-4-5'`; tests pass; matches the documented value.
- **Committed in:** `17c95c44` (Task 1 commit).

**2. [Rule 1 - Bug] rooms-meta.db opener uses synthetic _meta room dir**

- **Found during:** Task 2 (room-discard-cascade implementation)
- **Issue:** The plan's directive `lazyOps.bootstrapRoomDb(metaDbPath)` references a function that does not exist in `lib/core/lazygraph-ops.cjs` (verified by grep: only `openGraph` is exported, and it does not apply the Phase 109 migrations the memory_event log depends on). The plan's Plan 119-00 closure already documented this same issue (Rule 3 deviation in 119-00-SUMMARY.md item 1).
- **Fix:** Used `lib/core/room-db.cjs::openRoomDb(metaRoomDir)` -- the canonical opener that auto-bootstraps. The cascade synthesizes a `_meta` room dir at `<roomsHome>/.rooms/_meta` containing a real `.mindrian/room.db`. The opener applies all Phase 109 migrations transparently.
- **Files modified:** `lib/core/room-discard-cascade.cjs` (`_emitPartialFailure` helper).
- **Verification:** Test 11 (monkey-patched fs.rmSync EACCES) asserts `partial_failure_event_id` is populated AND the rooms-meta.db file materializes at `<roomsHome>/.rooms/_meta/.mindrian/room.db`. Test passes.
- **Committed in:** `d4f96890` (Task 2 commit).

**3. [Rule 1 - Bug] Reserved-prefix validator handles untitled-namespace escape**

- **Found during:** Task 2 (room-name-validator Test 7)
- **Issue:** The naive `normalized.indexOf('untitled-') === 0` check rejects `untitled-mything` but lets `untitled/with-slash` and `untitled.foo` through (they don't start with the hyphen). Plan Test 7 expects BOTH rejections to fire for `untitled/with-slash`.
- **Fix:** Added a second check after the prefix loop: `if (normalized === 'untitled' || /^untitled[^a-z0-9]/.test(normalized))` to catch bare-untitled AND untitled-followed-by-non-alphanumeric. Closes the namespace-escape vectors while still allowing names like `untitledly` to pass the reserved-prefix gate (they would still hit fs_unsafe_chars if non-canonical).
- **Files modified:** `lib/core/room-name-validator.cjs` (Rejection class 3 block).
- **Verification:** Test 7 passes; Tests 5 (untitled-mything + bare untitled) still pass; Test 8 (acme-robotics happy path) still passes.
- **Committed in:** `d4f96890` (Task 2 commit).

**4. [Rule 1 - Bug] Integration Test 1 ordering check fix**

- **Found during:** Task 4 (integration test development)
- **Issue:** The first occurrence of `CRITICAL-3 wire` in `lib/core/mva-orchestrator.cjs` is at line 19 (file docstring header), BEFORE the `telemetry.emit('mva_brief_rendered', ...)` call at line 298. The naive `src.indexOf('CRITICAL-3 wire')` returns the docstring index, causing the hook-AFTER-emit-AFTER-state-write ordering check to fail.
- **Fix:** Use `src.indexOf('CRITICAL-3 wire', emitIdx)` to find the actual wire-comment after the emit. The check is now correct.
- **Files modified:** `tests/test-room-naming-selector-integration.cjs` (Test 1).
- **Verification:** Test 1 passes; the ordering invariant (emit < hook < wire) is correctly enforced.
- **Committed in:** `bd468d62` (Task 4 commit).

---

**Total deviations:** 4 auto-fixed (all Rule 1 bugs caught at execution time; plan-author errors or test-author bugs).
**Impact on plan:** All four fixes preserve every plan invariant (D-03 + D-06 LOCKED verbatim labels; Canon Part 8 + Part 9 boundaries; em-dash HARD RULE; transactional safety; tri-surface contract). No scope creep.

## Known Stubs

None. All production functions are fully wired and tested.

- The IN-path arm `_resolveFromUserPick(userPick)` of `fireNamingSelector` IS the deliberate hook for Larry's resume-after-AskUserQuestion path. Larry (the conversational layer) is responsible for invoking it; that is not a stub but the duplex's OTHER half.
- The `/mos:doctor --orphaned-room-cleanup` recovery command consumes the `room_discard_partial_failure` memory_events this plan ships; the recovery command itself is deferred to the v1.13.0 housekeeping pass (documented in the Wire Diagram and the housekeeping section).

## Issues Encountered

1. **HAIKU_MODEL is module-internal in mva-classifier.cjs.** The plan referenced importing it. Fix documented as Rule 1 deviation #1.
2. **lazygraph-ops.bootstrapRoomDb does not exist.** Same Plan 119-00 issue. Fix documented as Rule 1 deviation #2.
3. **Reserved-prefix validator namespace-escape vectors.** Initial implementation only caught the hyphenated form. Fix documented as Rule 1 deviation #3.
4. **Integration Test 1 ordering check.** Docstring-header false-positive. Fix documented as Rule 1 deviation #4.
5. **Scaffold harness Gate 3 literal-substring greps.** Production code must avoid the literal Brain-host hostname even in commentary. Fixed by rewriting the Canon Part 8 documentation in `llm-name-suggester.cjs` to use "Mindrian-owned Brain MCP host" phrasing.

## Next Phase Readiness

### What ships now (v1.13.0)
- F.1 selector with 4 LOCKED verbatim labels fires after every Phase 118 MVA completion.
- Tri-surface directive-file handoff: Larry consumes the directive at the next conversational turn.
- Discard cascade is transactionally safe; partial failures land in rooms-meta.db for recovery.
- Phase 118 acceptance harness stays 16/16 GREEN.

### What ships in v1.13.0 housekeeping pass
- `/mos:doctor --orphaned-room-cleanup` recovery command consuming `room_discard_partial_failure` events.

### Open for v1.14.0
- **Cowork 5-minute consensus window** (currently first-responder semantics).
- **Per-user collaborator-identity sourcing** for shared-state Cowork rooms (currently `process.env.USER` on first responder).
- **Brain-MCP-aware suggested-name pipeline** (currently LOCAL Haiku call ONLY; no Brain consultation per Canon Part 8). If a future phase ships a Brain methodology for venture-naming that takes only generic handles (problem-type + stage), the suggester could route through it. This is explicitly out-of-scope for v1.13.0 per Canon Part 8.

## Self-Check: PASSED

Files verified present:
- lib/core/llm-name-suggester.cjs: FOUND
- lib/core/llm-name-suggester.test.cjs: FOUND
- lib/core/room-name-validator.cjs: FOUND
- lib/core/room-name-validator.test.cjs: FOUND
- lib/core/room-discard-cascade.cjs: FOUND
- lib/core/room-discard-cascade.test.cjs: FOUND
- lib/core/room-naming-selector.cjs: FOUND
- lib/core/room-naming-selector.test.cjs: FOUND
- scripts/room-naming-selector.cjs: FOUND (executable)
- scripts/check-pending-naming-decision.cjs: FOUND (executable)
- tests/test-room-naming-selector-integration.cjs: FOUND
- tests/test-119-01-scaffold.sh: FOUND (executable; exits 0 with 7/7 gates green)

Commits verified in git log:
- 17c95c44 feat(119-01): extend EVENT_TYPES +1 (room_discard_partial_failure) + llm-name-suggester + scaffold harness
- d4f96890 feat(119-01): ship room-name-validator + transactional room-discard-cascade with partial-failure recovery
- 143185eb feat(119-01): naming-selector orchestrator + tri-surface CLI shim + session-start cascade scanner
- bd468d62 feat(119-01): wire phase-119-01-naming-selector-hook into mva-orchestrator + end-to-end integration tests

All 48 plan tests GREEN; scaffold harness exits 0; Phase 118 regression check 16/16 GREEN.

---
*Phase: 119-room-as-receipt-invariant Plan 01*
*Completed: 2026-05-16*
