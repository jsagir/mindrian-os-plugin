---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 08
subsystem: part8-egress
tags: [part8, shape-packet, closed-enum, builder, validator, theo, tdd]

# Dependency graph
requires:
  - phase: 392 (plan 02)
    provides: data/brain-shape-vocabulary.json (problem_type, stage, stage_map, role, role_map, domain_tag, constraint_categories, problem_type_aliases) and the drift test
  - phase: 90 (plan 01)
    provides: lib/core/brain-derivation.cjs classifyProblemType (UDP/IDP/WDP) and the jtbd goal.rung read shape (:414)
  - phase: 88
    provides: lib/core/folder-memory.cjs readTriple (STATE.md + MINTO.md scalars)
  - phase: 354 (plan 10)
    provides: lib/core/strategy/rung-vocabulary.cjs isTheoRung
  - phase: Theo 48 (plan 48-01)
    provides: src/mcp/content/shape-packet.ts, the seal the packet must satisfy
provides:
  - lib/core/brain-shape-packet.cjs: buildShapePacket (one builder, from the bound room only) and validateShapePacket (exact membership, typed refusals)
  - tests/test-392-shape-packet.cjs (83 checks) and three synthetic fixture rooms under tests/fixtures/392-shape-rooms/
  - data/brain-shape-vocabulary.json role_default and constraint_keyword_map, pinned by drift leg V12
affects: [392-09 guard arm, 392-11 hook and lexicon, 392-12 wire and shim, Theo 48]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-vocabulary builder: every emitted member is an enum member of one file; sources are labels; room text never leaves the function"
    - "Typed refusal, never repair: {ok:false, field, reason, members} with the accepted list; no default, no coercion, no trimming (the eureka-critic validateCriticPayload pattern, Theo validates-never-repairs twin)"
    - "Model-supplied input is reported, not read: ignored_input plus ignored_keys (names only)"

key-files:
  created:
    - lib/core/brain-shape-packet.cjs
    - tests/test-392-shape-packet.cjs
    - tests/fixtures/392-shape-rooms/README.md
    - tests/fixtures/392-shape-rooms/room-a/STATE.md
    - tests/fixtures/392-shape-rooms/room-a/USER.md
    - tests/fixtures/392-shape-rooms/room-a/.mindrian/jtbd-state.json
    - tests/fixtures/392-shape-rooms/room-b/STATE.md
    - tests/fixtures/392-shape-rooms/room-b/USER.md
    - tests/fixtures/392-shape-rooms/room-empty/STATE.md
  modified:
    - data/brain-shape-vocabulary.json
    - tests/test-392-vocabulary-drift.cjs

key-decisions:
  - "role_default is founder (the first role_blend axis); the owner may change it in the vocabulary file, drift leg V12 only requires a role member"
  - "A role_blend tie falls back to canonical_role through role_map before role_default; readUserMd is called with ignoreOverride so the navigator persona override never writes the packet"
  - "When a room has no MINTO.md, the four reasoning scalars classifyProblemType reads are taken from the STATE.md frontmatter (governing_thought reduced to an existence flag at that line); MINTO.md wins when present"
  - "stage maps through stage_map only; legacy_stage_map is not consulted by the builder (plan 392-12 routes the legacy lists); unknown or missing venture_stage is Phase0"
  - "constraint keywords match as whole lowercase words; a keyword lives in one category only (V12) so the packet never depends on iteration order"

patterns-established:
  - "Fixture-tree hash before and after a builder run proves the builder does not write"
  - "A 60-character line cap on synthetic fixture files keeps invented values short and scannable"

requirements-completed: [392-SC3]

# Metrics
duration: 16min
completed: 2026-11-08
---

# Phase 392 Plan 08: Shape packet builder and validator Summary

**One builder reads the bound room (jtbd goal rung, STATE.md venture_stage, USER.md role_blend, domain key, constraint lines) and emits a six-key packet whose every member is in data/brain-shape-vocabulary.json; one validator refuses by exact membership with the field and the member list, never a repair; a model-supplied shape is ignored and reported.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-11-08T17:37Z (approximate, first read)
- **Completed:** 2026-11-08T17:53Z
- **Tasks:** 2 of 2
- **Files created:** 9
- **Files modified:** 2

## Accomplishments

- lib/core/brain-shape-packet.cjs (465 lines, above the 120-line floor) exports buildShapePacket, validateShapePacket, SHAPE_KEYS, loadVocabulary (plus SHAPE_SCHEMA_VERSION, CONSTRAINT_CATEGORIES_MAX and a _test surface). Docblock names D-01, D-02, the standing rule (one builder, from the bound room, in the process that owns the binding) and Theo's twin (Phase 48 T1).
- loadVocabulary reads the file once relative to the module, checks schema_version 1 and the shape of every list it uses, deep-freezes and caches (eureka-critic loadCriticTags pattern).
- Three synthetic fixture rooms with invented values only; every fixture line is 60 characters or shorter; the README names every value as invented.
- The module requires no network and writes no file: the test hashes the fixture tree before and after and the hashes are equal.
- Drift test extended with leg V12 (4 checks) for the two keys this plan added to the vocabulary file; 93 checks, 0 failed, Theo's five enums still equal.

## Task Commits

1. **Task 1 RED: fixtures and the failing test** - `da312e7a7` (test)
2. **Task 2 GREEN: builder, validator, vocabulary additions, drift leg V12** - `df40e6954` (feat)

Plan metadata (this SUMMARY): see the final commit on the branch.

## RED line (recorded)

Before lib/core/brain-shape-packet.cjs existed:

```
test-392-shape-packet
  FAIL [S0] lib/core/brain-shape-packet.cjs is missing at /home/jsagi/dev/MindrianOS-Plugin/lib/core/brain-shape-packet.cjs
FAIL: test-392-shape-packet (module missing)
exit 1
```

## The three built packets (GREEN)

| Room | Packet | Sources |
|------|--------|---------|
| room-a | `{"schema_version":1,"problem_type":"WellDefined","stage":"Phase3","role":"investor","domain_tag":"finance","constraint_categories":["regulatory","capital"]}` | problem_type jtbd_goal, stage state_md, role user_md, domain_tag state_md, constraint_categories state_md |
| room-b | `{"schema_version":1,"problem_type":"IllDefined","stage":"Phase2","role":"founder","domain_tag":"unknown","constraint_categories":[]}` | problem_type classify, stage state_md, role default (tie), domain_tag default, constraint_categories default |
| room-empty | `{"schema_version":1,"problem_type":"UnDefined","stage":"Phase0","role":"founder","domain_tag":"unknown","constraint_categories":[]}` | problem_type classify, every other member default |

classifyProblemType default for the empty room: `UDP`, mapped through problem_type_aliases to `UnDefined` (the function returns UDP when the triple has no governing_thought; brain-derivation.cjs:205, :215).

A model-supplied shape `{problem_type: 'Wicked', stage: 'Phase5'}` beside roomDir of room-a: `ignored_input: true`, `ignored_keys: ["shape"]`, packet identical to the room-built room-a packet (problem_type WellDefined). Any other argument (`problem_type`, `question`) behaves the same; only key names are reported.

A missing room directory builds the all-default packet without a throw.

## Validator refusals (every case typed with the field)

| Case | field | members |
|------|-------|---------|
| extra key `extra` | extra | SHAPE_KEYS |
| problem_type `Undefined` (wrong case) | problem_type | the 4 rung ids (also in the reason text) |
| stage `Phase6` | stage | Phase0..Phase5 |
| constraint_categories `"capital"` (string) | constraint_categories | the 9 categories |
| six constraint members | constraint_categories | the 9 categories |
| repeated member `["capital","capital"]` | constraint_categories | the 9 categories |
| non-member `["money"]` | constraint_categories | the 9 categories |
| role `Investor` (wrong case) | role | the 7 roles |
| domain_tag `Finance` (wrong case) | domain_tag | the 11 tags |
| missing schema_version | schema_version | SHAPE_KEYS |
| schema_version 2 | schema_version | [1] |
| schema_version `"1"` (string) | schema_version | [1] |
| stage `"Phase3 "` (trailing space) | stage | Phase0..Phase5 |
| null, array, string | shape | SHAPE_KEYS |

## Changes to the vocabulary file and the drift test (with reason)

- **data/brain-shape-vocabulary.json** gained two keys, both named in the plan: `role_default: "founder"` (the plan's truth "a room with no USER.md gets the vocabulary role_default" needs the key; 392-02 did not add it) and `constraint_keyword_map` (the plan's Task 2 action: "add constraint_keyword_map ... only if absent"; it was absent). 9 categories, 54 closed lowercase keywords, no keyword in two categories. The `_note` describes both. schema_version stays 1: the five wire enums did not change, so Theo's seal is unaffected (both repos compare equal in V7).
- **tests/test-392-vocabulary-drift.cjs** gained leg V12 (4 checks): role_default is a role member; constraint_keyword_map keys equal constraint_categories as a set; every keyword is a lowercase word; no keyword appears twice. Reason: the plan allows the change "only if the map needs a pin"; without the pin a keyword could drift to a category outside the enum or into two categories and the packet would depend on iteration order. 89 checks became 93; 0 failed; 0 skips.

## Decisions Made

- `role_default` is `founder`. The plan names the key, not the value; founder is the first role_blend axis and the plugin's primary persona. One edit in the file changes it; V12 only requires a role member.
- Role resolution order: role_blend argmax (strict winner above 0) -> canonical_role through role_map (or a bare role id) -> role_default. readUserMd runs with `ignoreOverride: true` so the navigator's synthetic persona override (persona-override.cjs) never writes a packet.
- problem_type when the room has no jtbd goal: classifyProblemType over folder-memory readTriple; when MINTO.md is absent (reasoning.exists false) the STATE.md frontmatter scalars `governing_thought` (existence only), `mece_status`, `arguments_count`, `evidence_density` feed it. This is how the plan's room-b ("STATE.md frontmatter scalars that make classifyProblemType return IllDefined") is satisfied without a MINTO.md, which is outside the plan's file list.
- The builder uses a minimal frontmatter reader of its own (flat scalars, inline lists, block lists) for the STATE.md keys it needs; user-md-ops parseFrontmatter is not exported and folder-memory parseStateMd reads only its own four keys.
- The `.mindrian/jtbd-state.json` read is the same four lines as brain-derivation.cjs readRoomRung (:412-419), which is not exported (not even on `_test`); the read is repeated here rather than exporting from a file outside this plan's list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.mindrian/` is gitignored (.gitignore:41), so the plan-listed fixture `room-a/.mindrian/jtbd-state.json` could not be staged with plain `git add`**
- **Found during:** Task 1 commit
- **Fix:** that one path was staged with `git add -f`; tracked precedent `tests/fixtures/graph-export-golden-room/.mindrian/room.db`. Every other path used plain `git add`. The commit message names it.
- **Committed in:** da312e7a7

**2. [Rule 1 - Bug] The editor's PostToolUse room-cascade hook wrote `.mindrian/last-cascade.json` into each fixture room when STATE.md and USER.md were written**
- **Found during:** first GREEN run (S6 "the three rooms hold 6 fixture files" and the 60-character line cap failed on three 300-plus-character JSON lines)
- **Fix:** the three untracked litter files (and two empty `.mindrian/` dirs) were removed; they were never staged. The builder's own before/after hash leg had already passed, so the writes were the editor hook's, not the builder's.
- **Files modified:** none committed

**3. [Rule 1 - Bug] The test source carried a literal em dash character inside the no-em-dash regex, against the repo rule**
- **Found during:** the no-em-dash grep after Task 2
- **Fix:** replaced by the six-character JavaScript unicode escape for U+2014 (the Edit and Write tools turn that escape back into the character, so the one-line patch ran through node). Repo files of this plan now hold 0 em dashes.
- **Committed in:** df40e6954

### Plan-context notes

- The plan's Task 1 behavior text says room-b carries "problem_definition and complexity scalars"; classifyProblemType reads governing_thought, mece_status, arguments_count and evidence_density (brain-derivation.cjs:204-221), so the fixture carries those four keys. No code deviation; the decision above records how they reach the function.

**Total deviations:** 3 auto-fixed (1 Rule 3, 2 Rule 1), 1 note.
**Impact on plan:** none on scope.

## Issues Encountered

- tests/run-all-392.sh ran while plan 392-03 was in its RED stage: PASS=6 FAIL=1 (test-392-bypass-1-unicode-tokens.cjs, not this plan's file). After peer commit 2d10fc084 landed, that test passes (6 passed, 0 failed), so all 7 discovered test-392 files are green at 17:53Z.

## Verification

- `node tests/test-392-shape-packet.cjs`: exit 0, Checks 83, Failed 0 (PROVEN).
- `node tests/test-392-vocabulary-drift.cjs`: exit 0, Checks 93, Failed 0, Skips 0; Theo five enums equal, SHAPE_SCHEMA_VERSION 1 (PROVEN).
- Plan inline verify (Wicked packet validates; lowercase `wicked` refused on field problem_type): `inline verify ok`, exit 0 (PROVEN).
- `bash tests/run-all-392.sh`: discovered 7, PASS=6 FAIL=1 at run time (the peer RED test); the failing file passes after the peer GREEN commit (PROVEN, see Issues).
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0 (PROVEN).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed (no hook reaches the new module) (PROVEN).
- Fixture tree hash unchanged after the test run (S6 leg) (PROVEN).
- Room-slug scan of the five new or changed paths against the 45 directory names under ~/MindrianRooms: 3 string hits, all false positives ("Opportunity" is inside the VALID_STAGES member `Pre-Opportunity`, present since 392-02; "rooms" is inside the fixture directory name `392-shape-rooms`); no room slug, no person, no URL, no Brain identifier (PROVEN).
- Em dash count 0 in lib/core/brain-shape-packet.cjs, tests/test-392-shape-packet.cjs, tests/test-392-vocabulary-drift.cjs, data/brain-shape-vocabulary.json and the fixture tree (PROVEN).
- Post-commit deletion check on da312e7a7 and df40e6954: no deletions (PROVEN).

## TDD Gate Compliance

- RED gate: `da312e7a7` (test). GREEN gate: `df40e6954` (feat), after it. No refactor commit was needed.

## Known Stubs

None. Every packet member is derived from the room or is a declared default from the vocabulary file.

## Threat Flags

None. No new network endpoint, auth path or schema at a trust boundary. The threat register's three mitigations are implemented: T-392-21 (every field is an enum member, sources are labels, S7 asserts no room line appears in a result), T-392-22 (ignored_input, roomDir is the only argument read, S5), T-392-23 (schema_version check, drift test V12).

## Next Phase Readiness

- Plan 392-09 (guard arm `{question, shape}`) can call validateShapePacket for the shape leaf.
- Plan 392-12 (wire and shim) calls buildShapePacket({roomDir}) in the process that owns the session binding and attaches the result's `shape`; `ignored_input` is the signal for a model-supplied shape.
- Plan 392-11 (hook) must keep the module out of hook cold-start paths or measure it: the module lazy-requires brain-derivation, folder-memory, user-md-ops and rung-vocabulary at call time (24 ms load measured for the three readers).
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited (the orchestrator updates them per wave; 392-WAVES.md is the branch ledger).

## Self-Check: PASSED

- FOUND: all 9 created files, data/brain-shape-vocabulary.json, tests/test-392-vocabulary-drift.cjs, this SUMMARY
- FOUND: commits da312e7a7, df40e6954 on work/part8-shape-packet
- SUMMARY em dash count 0; SUMMARY is under .planning/* (force-tracked), added with git add -f
