---
phase: 119-room-as-receipt-invariant
plan: "02"
subsystem: room-as-receipt-invariant
tags: [phase-119, plan-02, wave-1, room-as-receipt, skeleton-scaffold, larry-thinness, canon-part-10, icm-layer-0]
one_liner: "skeleton scaffold for placeholder rooms (8 ICM sections + 5 identity dirs + STATE/MINTO/USER) + Larry thinness-acknowledgment voice line (D-05 verbatim) + auto-explore-fire wiring closing Blocker 1+4 phantom-wiring"
dependency_graph:
  requires:
    - "Plan 119-00 autoCreatePlaceholderRoom (creates the placeholder dir + .room-root + .mindrian/room.db that this plan scaffolds INTO)"
    - "Phase 88 feynman-minto-invariants (the mos:minto-begin/end sentinel contract MINTO.md.tmpl honors)"
    - "Phase 124-02 timeline-runner.cjs (the atomic-write tmp+rename idiom this plan inherits)"
    - "Phase 117 composeAutoExploreFinding (returns the auto-explore-finding JSON whose shape feeds the thinness detector)"
  provides:
    - "lib/core/room-skeleton-scaffold.cjs: scaffoldRoomSkeleton(roomDir, opts) -> {ok, sections_created, identity_files_created, state_written, minto_written, user_written, thinness_acknowledged, errors}"
    - "lib/core/larry-thinness-acknowledgment.cjs: THINNESS_VOICE_LINE (locked verbatim D-05 string) + voiceLine() + shouldAcknowledgeThinness(autoExploreFinding) -> boolean"
    - "templates/room-skeleton/{STATE.md,MINTO.md,ROOM.md.section,ROOM.md.identity,USER.md}.tmpl: 5 templates with {{KEY}} substitution + Canon decision 15 ICM Layer 0 provenance + Phase 88 mos:minto-begin/end sentinels"
    - "Wired callsite: scripts/auto-explore-fire.cjs invokes scaffoldRoomSkeleton(roomDir, ...) AFTER composeAutoExploreFinding returns AND BEFORE atomicWriteJson(findingPath) -- closes Blocker 1+4 phantom wiring"
  affects:
    - "Plan 119-01 inherits the contract: F.1 selector reads result.thinness_acknowledged to decide whether to render Larry's voice line"
    - "Plan 119-00 sibling hook lands BEFORE auto-explore fire spawns; this plan's wiring lands AFTER composeAutoExploreFinding returns -- the two hooks are NOT in conflict"
    - "Phase 117 auto-explore-fire pipeline now ALWAYS leaves a fully-scaffolded room behind (8 sections + 5 identity dirs + STATE/MINTO/USER) regardless of finding quality (D-05 invariant)"
tech_stack:
  added: []  # zero new runtime dependencies (per CLAUDE.md "Reuse Before Build" + Canon Part 7)
  patterns:
    - "Atomic-write idiom (tmp + rename) inherited from Phase 124-02 timeline-runner.cjs"
    - "{{KEY}} template substitution with renderTemplate(content, subs) pure function"
    - "Reentrancy via isStateAuthored(roomDir) -- frontmatter auto_created:false (or absent) = human-authored; byte-preserved across re-invocation"
    - "LAZY require inside try/catch in scripts/auto-explore-fire.cjs preserves startup budget AND provides graceful degradation"
    - "Single-source-of-truth voice line: THINNESS_VOICE_LINE constant + voiceLine() wrapper -- callers MUST use these (avoids cross-file string drift)"
    - "Em-dash test self-immunity: String.fromCharCode(0x2014) in test source so the test does not self-trip its own grep invariant"
key_files:
  created:
    - lib/core/room-skeleton-scaffold.cjs
    - lib/core/room-skeleton-scaffold.test.cjs
    - lib/core/larry-thinness-acknowledgment.cjs
    - lib/core/larry-thinness-acknowledgment.test.cjs
    - templates/room-skeleton/STATE.md.tmpl
    - templates/room-skeleton/MINTO.md.tmpl
    - templates/room-skeleton/ROOM.md.section.tmpl
    - templates/room-skeleton/ROOM.md.identity.tmpl
    - templates/room-skeleton/USER.md.tmpl
    - tests/test-room-skeleton-scaffold-integration.cjs
    - tests/test-119-02-scaffold.sh
    - tests/test-119-02-auto-explore-fire-wiring.cjs
  modified:
    - scripts/auto-explore-fire.cjs  # Task 3 wiring: scaffoldRoomSkeleton callsite added AFTER composeAutoExploreFinding success branch + BEFORE atomicWriteJson(findingPath); reentrancy-guarded; graceful-degradation-wrapped; LAZY require
    - lib/memory/run-feynman-tests.cjs  # registered 4 new Phase 119-02 test files in additive-tail block
decisions:
  - "Voice line locked verbatim at 121 ASCII chars: `I made a room around this -- it's mostly empty until we have more to work with. Want to keep going and see what fills in?` (no em-dashes, no smart quotes, ASCII apostrophe)"
  - "D-05 threshold: thin = null OR <= 1 finding (the 2+ findings substantive threshold matches the plan Test 6 + Test 7)"
  - "Reentrancy signal: auto_created:false frontmatter flag (or absent auto_created entirely) marks the file as human-authored; auto_created:true marks it as Phase 119 output and safe to overwrite (Canon Part 9 `files preserve meaning`)"
  - "Lazy require in scripts/auto-explore-fire.cjs preserves the 4-top-level-require startup-budget invariant AND adds graceful degradation: skeleton-scaffold failure logs to stderr but does NOT regress the auto-explore pipeline"
  - "Test 14 em-dash invariant uses String.fromCharCode(0x2014) so the test source itself does not contain the literal em-dash (which would self-trip the invariant)"
  - "Task 3 inserted between line 234 close-brace `if (!finding) {...process.exit(0);}` and line 236 `// Phase 117-05 telemetry: a finding emerged` comment; ordering invariant verified (composeAutoExploreFinding < scaffoldRoomSkeleton < atomicWriteJson(findingPath))"
patterns_established:
  - "Atomic-write idiom continued from Phase 124-02 (tmp + rename for file-substrate writes)"
  - "Mid-pipeline lazy-require + graceful-degradation try/catch for non-critical wiring inserts (mirrors the Phase 117-05 emitBrainCanonDrift pattern at line 240)"
  - "Phase 119-XX block in lib/memory/run-feynman-tests.cjs follows the additive-tail-append precedent set by Phase 117-00 + Phase 124-02 + Phase 125"
requirements_completed:
  - ROOMRECEIPT-119-05  # Skeleton scaffold even with thin material (D-05) + Larry thinness-acknowledgment voice line
duration: "10 minutes"
completed: "2026-05-16T19:03:40Z"
---

# Phase 119 Plan 02: Room-as-Receipt Invariant -- Skeleton Scaffold + Larry Thinness Voice Summary

## Performance

- **Duration:** ~10 minutes (18:53Z -> 19:03Z; well under typical Wave 1 plan budget)
- **Tasks completed:** 3 of 3 (Task 1 templates + thinness module + RED tests; Task 2 scaffold orchestrator + 22 unit + 3 integration tests + 6-gate shell harness; Task 3 auto-explore-fire wiring + 10 wiring tests)
- **Files created:** 12 (5 templates + 4 source modules + 3 test files + 1 shell harness)
- **Files modified:** 2 (scripts/auto-explore-fire.cjs wiring insertion + lib/memory/run-feynman-tests.cjs test registration)
- **Test count:** 44 tests across 4 test files (12 thinness + 19 scaffold-unit + 3 scaffold-integration + 10 wiring); 44/44 GREEN. Shell harness `tests/test-119-02-scaffold.sh`: 6/6 gates GREEN. Phase 118 regression: 16/16 GREEN (no regression).
- **Per-task commits:** 7 (RED + GREEN per task; TDD strict cadence)

## Template Directory Tree

```
templates/room-skeleton/                    NEW directory
├── STATE.md.tmpl                           (1289 bytes) cold-start state with {{AUTO_CREATED_AT_ISO}}, {{PLACEHOLDER_SLUG}}, {{SOURCE_MATERIAL_ID}} substitutions
├── MINTO.md.tmpl                           (733 bytes) sentinel-bounded skeleton: <!-- mos:minto-begin --> ... <!-- mos:minto-end --> (Phase 88 contract)
├── ROOM.md.section.tmpl                    (678 bytes) per-section identity with {{SECTION_NAME}}, {{SECTION_NAME_TITLE_CASE}}, {{SECTION_PURPOSE}}, {{STAGE_RELEVANCE_LIST}}, {{DEFAULT_METHODOLOGIES_LIST}}
├── ROOM.md.identity.tmpl                   (325 bytes) per non-ICM directory identity with {{DIRECTORY_TYPE}}, {{DIRECTORY_PURPOSE}}
└── USER.md.tmpl                            (679 bytes) cold-start user-context placeholder (Phase 115 dual-path inference reads this)

lib/core/room-skeleton-scaffold.cjs         NEW (~270 LOC)
├── SECTION_NAMES (frozen 8-entry array)
│   ├── 'problem-definition'
│   ├── 'market-analysis'
│   ├── 'solution-design'
│   ├── 'business-model'
│   ├── 'competitive-analysis'
│   ├── 'team-execution'
│   ├── 'legal-ip'
│   └── 'financial-model'
├── SECTION_METADATA (frozen 8-section lookup) -- pairs section name to {purpose, stage_relevance[], default_methodologies[]}
│   feeds ROOM.md.section.tmpl renderer at scaffold time
├── IDENTITY_DIRECTORIES (frozen 5-entry map) -- non-ICM dirs that still need ROOM.md per Canon decision 15
│   ├── 'team'          (the people layer)
│   ├── 'assets'        (binary file storage)
│   ├── '.intelligence' (sentinel alerts + digests)
│   ├── '.snapshots'    (weekly STATE.md copies)
│   └── '.context'      (per-session conversational state)
├── scaffoldRoomSkeleton(roomDir, opts) -- the entry point
├── renderTemplate(content, subs)         -- pure {{KEY}} substitution
├── atomicWrite(filePath, content)        -- Phase 124-02 tmp+rename idiom
└── isStateAuthored(roomDir)              -- reentrancy gate (auto_created:false OR absent => authored)

lib/core/larry-thinness-acknowledgment.cjs  NEW (~70 LOC)
├── THINNESS_VOICE_LINE                   -- the LOCKED verbatim D-05 string (121 ASCII chars)
├── voiceLine()                           -- single-source-of-truth wrapper
└── shouldAcknowledgeThinness(finding)    -- thin = null OR <= 1 finding (D-05 threshold)
```

### The lookup-table -> template relationship

The renderer in `scaffoldRoomSkeleton()` reads `SECTION_METADATA[section]` for each of the 8 ICM sections and substitutes:

```
SECTION_METADATA['problem-definition'] = {
  purpose: 'Define the core problem this venture addresses.',
  stage_relevance: ['Pre-Opportunity', 'Discovery'],
  default_methodologies: ['domain-explorer', 'beautiful-question', 'trending-to-absurd'],
}
       |
       v rendered through ROOM.md.section.tmpl with these subs:
       |   {{SECTION_NAME}} -> 'problem-definition'
       |   {{SECTION_NAME_TITLE_CASE}} -> 'Problem Definition'
       |   {{SECTION_PURPOSE}} -> 'Define the core problem this venture addresses.'
       |   {{STAGE_RELEVANCE_LIST}} -> '  - Pre-Opportunity\n  - Discovery'
       |   {{DEFAULT_METHODOLOGIES_LIST}} -> '  - domain-explorer\n  - beautiful-question\n  - trending-to-absurd'
       v
roomDir/problem-definition/ROOM.md          (final on-disk artifact)
```

The same pattern fires for each of the 8 sections + the 5 identity directories (which use `ROOM.md.identity.tmpl` with the simpler 2-key substitution).

## Task 3 Wiring Detail (Blocker 1+4 Closure)

The frontmatter `key_links` block declares an edge from `scripts/auto-explore-fire.cjs` to `lib/core/room-skeleton-scaffold.cjs::scaffoldRoomSkeleton`. Task 3 makes that edge real:

**Insertion point** (between lines 234 + 236 of scripts/auto-explore-fire.cjs):

```
    if (!finding) {                                       <-- line 229
      try { store.markFailed(...); } catch (_e) {}
      try { agent.emitSkipped(...); } catch (_e) {}
      process.exit(0);
    }                                                     <-- line 234
                                                          <-- TASK 3 INSERTION HERE
    if (!fs.existsSync(path.join(roomDir, 'STATE.md'))) {     reentrancy guard
      try {                                                   graceful-degradation try
        const { scaffoldRoomSkeleton } = require(...);        LAZY require (preserves startup budget)
        scaffoldRoomSkeleton(roomDir, {
          placeholder_slug: path.basename(roomDir),
          source_material_id: material_id,
          auto_explore_finding: finding,
        });
      } catch (scaffoldErr) {
        process.stderr.write('[auto-explore-fire] room-skeleton-scaffold failed (non-fatal): ...');
      }                                                       no rethrow -- graceful degradation
    }
                                                          <-- line 236 in original file
    // Phase 117-05 telemetry: a finding emerged -- ...
```

**Ordering invariant verified by Test 2:**
- `composeAutoExploreFinding(` first occurrence at offset 707 (in module docstring)
- `scaffoldRoomSkeleton(roomDir` at offset 10444 (the new wiring)
- `atomicWriteJson(findingPath` at offset 11435 (the existing finding-JSON write)

So: 707 < 10444 < 11435. Scaffold lands AFTER compose AND BEFORE atomic-write of the finding JSON. This guarantees the placeholder room's STATE.md materializes BEFORE the finding JSON is consumable -- so any downstream reader of `auto-explore-<material_id>.json` is reading from a real scaffolded room, not a bare placeholder.

## What Plan 119-01 Inherits

When Plan 119-01 (the post-MVA naming selector + F.1 rename ceremony) runs, the following are guaranteed by Plan 119-02:

1. **`scaffoldRoomSkeleton` is callable directly.** Plan 119-01 doesn't need to call it -- Task 3's wiring fires it from `scripts/auto-explore-fire.cjs` automatically. But if Plan 119-01 needs to re-scaffold (e.g. after a rename), the function is idempotent + reentrant.

2. **`THINNESS_VOICE_LINE` is available for Larry's render.** Plan 119-01's F.1 selector can read `result.thinness_acknowledged` from the scaffold output (passed via the auto-explore-<material_id>.json side-file or the room's MINTO ledger) and conditionally prepend the verbatim voice line to Larry's first-touch message.

3. **`IDENTITY_DIRECTORIES` enumerates the 5 non-ICM directories** (`team`, `assets`, `.intelligence`, `.snapshots`, `.context`) so any further "fill the room" work (Plan 119-01's rename ceremony, or a future Plan 119-03 thickening) has the canonical list.

4. **The placeholder slug is encoded in STATE.md.** When the rename happens, Plan 119-01 walks STATE.md frontmatter, reads `placeholder_slug:`, and uses it to wire the registry entry + the renamed directory.

5. **MINTO.md sentinel boundaries are intact.** The sentinel-bounded section is empty by design at scaffold time; Plan 119-01 (or Larry's first turn) populates the Governing Thought + Supporting Arguments. The Phase 88 byte-preservation contract is satisfied byte-1.

6. **The reentrancy guard means re-firing is safe.** If `scripts/auto-explore-fire.cjs` re-fires on a placeholder room that already has STATE.md, the entire scaffold block is skipped -- no overwrite, no double-render, no thrash.

7. **Larry's first turn can be substantive even on thin material.** D-05's mandate is honored: Phase 119's job is to make the user's first action durable, not to gate the room behind material-quality thresholds. The voice line `"I made a room around this -- it's mostly empty until we have more to work with. Want to keep going and see what fills in?"` is the conversational anchor that makes that mandate feel honest rather than apologetic.

## Self-Check: PASSED

Files verified:
- lib/core/room-skeleton-scaffold.cjs: FOUND
- lib/core/larry-thinness-acknowledgment.cjs: FOUND
- templates/room-skeleton/STATE.md.tmpl: FOUND
- templates/room-skeleton/MINTO.md.tmpl: FOUND
- templates/room-skeleton/ROOM.md.section.tmpl: FOUND
- templates/room-skeleton/ROOM.md.identity.tmpl: FOUND
- templates/room-skeleton/USER.md.tmpl: FOUND
- scripts/auto-explore-fire.cjs (wired): FOUND (scaffoldRoomSkeleton call site at offset 10444)
- tests/test-119-02-scaffold.sh: FOUND
- tests/test-119-02-auto-explore-fire-wiring.cjs: FOUND
- tests/test-room-skeleton-scaffold-integration.cjs: FOUND

Commits verified:
- 9c10ad76 test(119-02): add failing tests for larry-thinness-acknowledgment (RED): FOUND
- fe8ed07a feat(119-02): implement larry-thinness-acknowledgment + 5 room-skeleton templates (GREEN): FOUND
- b8f93b2b test(119-02): add failing tests for room-skeleton-scaffold (RED): FOUND
- 39309b8f feat(119-02): implement room-skeleton-scaffold orchestrator (GREEN): FOUND
- 06ad298f test(119-02): add failing tests for auto-explore-fire scaffold wiring (RED): FOUND
- f81914c0 feat(119-02): wire scaffoldRoomSkeleton into auto-explore-fire success path (GREEN): FOUND

All 44 tests GREEN; shell harness exits 0; Phase 118 regression check 16/16 GREEN.
