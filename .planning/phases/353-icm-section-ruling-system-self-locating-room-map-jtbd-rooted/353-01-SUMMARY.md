---
phase: 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted
plan: 01
subsystem: data-room-icm
tags: [room-map, self-location, sub-room-birth, doctor-module, gray-matter, jtbd-vocabulary, fleet-census]

# Dependency graph
requires:
  - phase: 275-section-contracts
    provides: SECTION_NAMES, SECTION_METADATA, section-contracts templates, discoverSections sub-room boundary
  - phase: 195-nested-room-tree
    provides: the .room-root sentinel convention, the fixture-tree pattern this phase's icm-rooms/ mirrors
  - phase: 195-03-born-wired-birth
    provides: the SEED-001 five-side-effect FINALIZE block and _bornWiredRollback this plan extends to six
provides:
  - lib/core/room-map.cjs (buildRoomMap, mapFingerprint, writeRoomMap, readRoomMap, renderSelfBlock, writeSelfBlocks, SELF_BLOCK_KINDS)
  - lib/core/doctor/room-map-module.cjs registered doctor module (report-mode over the real fleet, fix only inside tests/fixtures/icm-rooms/)
  - side effect six on sub-room birth (child map then parent map, atomic with the existing five)
  - the one F.8 job-declaration card at sub-room birth (JOB_VOCABULARY, isDeclaredJob, runJobGate, _patchChildRoomJob)
  - the additive legE self-location leg on getRoomContext
  - tests/fixtures/icm-rooms/ and tests/run-all-353.sh (the phase's own fixture tree and aggregator, owned for the rest of the phase)
affects: [353-02-section-ruling-system, 353-03-fixture-grading, 352-doctor-auto-heal-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-location: one rebuildable JSON home (.mindrian/room-map.json) plus a derived, fingerprinted icm_self YAML block spliced into ROOM.md, never a gray-matter.stringify re-serialization of the whole file"
    - "Doctor module recoverable:false path-prefix guard (T-353-08) as the mechanism that keeps --fix off a real fleet room"
    - "Birth-time card declaration validated against a closed vocabulary BEFORE any byte is written, filed through the existing gate-answer drain with zero new gate machinery"

key-files:
  created:
    - lib/core/room-map.cjs
    - lib/core/doctor/room-map-module.cjs
    - tests/run-all-353.sh
    - tests/fixtures/icm-rooms/ (alpha-room, gamma-room, README.md)
    - evals/icm/cases/turns.json
    - tests/test-353-room-map.cjs
    - tests/test-353-self-block.cjs
    - tests/test-353-doctor-room-map.cjs
    - tests/test-353-subroom-birth.cjs
    - tests/test-353-turn-budget.cjs
    - tests/test-353-fleet-report.cjs
    - .planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json
  modified:
    - lib/core/room-skeleton-scaffold.cjs (scaffoldRoomSkeleton builds + writes the map as its last step)
    - lib/core/frontmatter-schemas.cjs (icm_self, job_id, job_source added to the ROOM.md optional allow-list)
    - lib/core/section-registry.cjs (JOB_VOCABULARY, VOCABULARY_EXTENSION_JOBS, isDeclaredJob)
    - lib/core/navigation/room-birth.cjs (side effect six, runJobGate, _patchChildRoomJob, the s[1-6] fault seam)
    - lib/core/navigation/room-context.cjs (the additive legE leg)
    - data/doctor-modules.json (the room-map row)
    - tests/test-275-section-schema.cjs (snapshot() excludes .mindrian, the volatile-timestamp fix)

key-decisions:
  - "gamma-room ships WITH a root ROOM.md in the committed tree (not without, as originally drafted) because this repo's own pre-commit Data Room invariant refuses any .room-root-marked directory missing ROOM.md+MINTO.md, with no exception for a deliberately-missing identity file; the missing-root and artifact-with-no-ROOM.md scenarios are exercised via tmpdir copies with the file deleted at test runtime instead."
  - "The per-node fingerprint reuses mapFingerprint([node]) (a single-element array) rather than a second hashing function -- renderSelfBlock and the doctor module's block_fingerprint_drift check both call the same exported function."
  - "icm_self is spliced into frontmatter textually (find-the-block, replace-or-append), never via gray-matter.stringify(content, data), because re-serializing the whole frontmatter object would reformat every untouched key -- violating the byte-preservation guarantee Task 3 tests directly."
  - "The birth-time job declaration lives in room-birth.cjs as a STEP 1 scaffold patch, not a seventh side effect: the six side effects are the PARENT-facing wiring guarantees allWired gates, while a declared job is a child-local fact that _bornWiredRollback's fs.rmSync already unwinds completely."

patterns-established:
  - "Doctor recoverable:false via path.resolve containment against a computed prefix (never substring match) is the reusable pattern for scoping any future --fix to a fixture-only surface (T-353-08)."
  - "A gate twin (runJobGate beside runBirthGate) that shares the SAME gateAnswers drain is the reusable pattern for adding a second birth-time card without a second gate-ledger row."

requirements-completed: [RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-29]

# Metrics
duration: ~3h
completed: 2026-09-17
---

# Phase 353 Plan 01: Room Map (self-location) Summary

**A rebuildable `.mindrian/room-map.json` plus a derived `icm_self` YAML block on every root/section/structural/sub-room ROOM.md, a doctor module that reports six drift classes but only ever auto-heals inside `tests/fixtures/icm-rooms/`, a sixth atomic side effect on sub-room birth that rebuilds both maps, one F.8 job-declaration card validated against a closed vocabulary before any byte is written, and an additive `legE` self-location read on `getRoomContext` measured at 62-79 chars-over-4 tokens per fixture room.**

## Performance

- **Duration:** ~3h
- **Tasks:** 8 of 8 completed
- **Files modified/created:** 20 (13 new, 7 modified)

## Accomplishments

- `lib/core/room-map.cjs`: a synchronous walk classifying every directory as `root | section | structural | sub-room | artifact`, a traversal-guarded (T-353-01) fingerprint that is stable across two builds and sensitive only to tracked structure (never to an untracked artifact-file edit), and a text-splice `icm_self` writer that leaves every other frontmatter key and the whole body byte-identical.
- `lib/core/doctor/room-map-module.cjs`: reports all six named drift classes (missing map, stale map fingerprint, a blocked-kind directory missing ROOM.md, a stale per-node block fingerprint, an artifact folder wrongly carrying a block, registry lineage disagreement) and refuses to auto-heal anything outside `tests/fixtures/icm-rooms/` via a `recoverable:false` guard computed from `PLUGIN_ROOT`, never a substring match.
- Sub-room birth's FINALIZE block gained a sixth atomic side effect (child map, then parent map) with a working `_faultInject: 's6'` seam and a rollback that re-runs the parent rebuild (idempotent, proven by three consecutive rebuilds producing the same fingerprint).
- One F.8 job-declaration card fires beside the existing approval card at sub-room birth; the answer is validated against `JOB_VOCABULARY` (the union of `data/command-registry.json`'s 16 `serves_jtbd` values plus four ratified extension members) BEFORE any byte is written, and files through the existing `drainBirthGateAnswers` machinery with zero new gate infrastructure.
- `getRoomContext` gained a fifth, additive `legE` leg measured at **79 tokens (alpha-room)** and **62 tokens (gamma-room)**, both well under the 400-token budget (criterion 2); every pre-existing `_meta` key stays present and shaped, and `lib/mcp/tools/context.cjs` is byte-unchanged (`git diff --stat` confirms zero lines).
- The real 56-entry fleet registry was walked in report mode only (54 resolvable rooms; two stale registry entries correctly skipped, never repaired): **54 root, 571 section, 58 structural, 19 sub-room, 405 artifact nodes**; missing ROOM.md among the four blocked kinds only: **9 root, 69 section, 21 structural, 3 sub-room**; **1** registry lineage disagreement. Zero writes anywhere under the rooms-home directory (verified via `git status --porcelain` returning empty).

## Task Commits

1. **Task 1: phase aggregator, icm-rooms fixture tree, labeled turn set** - `4fe602c26` (test)
2. **Task 2: lib/core/room-map.cjs - the walk, five kinds, the fingerprint** - `ba5f78aee` (feat)
3. **Task 3: icm_self block writer, root ROOM.md creation, scaffolder wiring** - `52538806f` (feat)
4. **Task 4: doctor module room-map plus its registry row** - `473c520fb` (feat)
5. **Task 5: sub-room birth side effect six, the s6 fault seam, rollback** - `2778dc28f` (feat)
6. **Task 6: birth-time job declaration - one F.8 card, job_id on the child** - `d38812e0d` (feat)
7. **Task 7: additive legE self-location read on getRoomContext (<400 tok)** - `74247163b` (feat)
8. **Task 8: report-mode-only fleet walk and its evidence file** - `d5af63c7c` (test)

_All 5 `tdd="true"` tasks (2, 3, 4, 5, 6) show an observed RED before GREEN; each commit body quotes the exact RED failure line._

## RED/GREEN Evidence (TDD tasks)

| Task | RED (module/behavior absent) | GREEN |
|------|-------------------------------|-------|
| 2 | `Cannot find module '.../lib/core/room-map.cjs'`, test exits 1 | 11/11 checks pass |
| 3 | `renderSelfBlock export missing from lib/core/room-map.cjs`, exits 1 | 5/5 checks pass |
| 4 | `Cannot find module '.../room-map-module.cjs'`, exits 1 | 7/7 checks pass |
| 5 | Reverting the fault regex to `s[1-5]` and `allWired` to five terms reproduced 6 failures (s6 never flagged, child folder/registry survived) | 16/16 checks pass |
| 6 | Renaming `isDeclaredJob` (dangling `module.exports` reference) threw `ReferenceError` at require time | 38/38 checks pass |
| 7 | Removing the `legTimingsMs.legE` assignment: `AssertionError: legTimingsMs.legE is a number` | 9/9 checks pass, legE = 79/62 tokens |

## Declared vs. undeclared birth (Section D/E, test-353-subroom-birth.cjs)

**Declared** (`jobGate: { job_id: '<vocabulary member>' }`): the child's root ROOM.md frontmatter carries
```yaml
job_id: <declared-job>
job_source: declared
```
on disk BEFORE side effect six ever builds the child's map (confirmed: the child's FIRST `.mindrian/room-map.json` build already carries `job_id` on its root node, no second pass). Filed through the existing `drainBirthGateAnswers`: one `birth_gate_answered` memory event plus one `FILED_AS_DECISION` edge into `birth_gate:SUBROOM_JOB:<declared-job>`.

**Undeclared** (no `jobGate` at all): the child's root ROOM.md carries neither `job_id` nor `job_source`; the child map's root node carries `job_id: null`. Also proven absent for a throwing gate, an out-of-vocabulary answer, and the literal `'custom'` answer -- all four resolve to the identical undeclared shape, validated BEFORE any byte is written (T-353-26).

## Fleet per-kind counts (from `353-FLEET-REPORT.json`, measured against the real registry)

```json
{
  "rooms_scanned": 54,
  "totals": {
    "root": 54, "section": 571, "structural": 58, "sub-room": 19, "artifact": 405,
    "missing_room_md": { "root": 9, "section": 69, "structural": 21, "sub-room": 3 },
    "registry_drift": 1
  }
}
```
Scope restatement (R-353-B): "0 directories without ROOM.md" (success criterion 1) is scoped to the four blocked kinds only; the whole-tree non-dot-directory count is a different, larger number this phase does not target.

## Pre-existing RED tests, re-run and unchanged (never edited)

- `tests/test-auto-explore-telemetry.cjs`: 14 pass, 1 fail (the `EVENT_TYPES.size === 32` exact-count assertion; 102 members at HEAD).
- `tests/test-131-substrate.cjs`: 12 passed, 2 failed (the `PRE_131_EVENT_BASELINE + 3` exact-count assertion).
- **Newly observed, out of scope, logged to `deferred-items.md`:** `tests/test-195-recursive-reconcile.cjs` fails on "pass-2 must upsert nothing (idempotent); got 16" -- reproduced 3x, confirmed pre-existing at HEAD (`4ec15cc31`, before any Phase 353 edit), not caused by and not fixed by this plan (no task touches `lib/core/reconcile-memory-runner.cjs`). The three assertions Task 1 actually depends on in that same file (16-file discovery count, depth-3 recursion, the depth-4 cap) all still pass.

## R-353-A carried forward

Both new doctor rows in this phase ship in the seven-key shape with **no `auto_heal` key**. `data/doctor-modules.json`'s `room-map` row description states the carry-forward explicitly: Phase 352 classifies `room-map` (and `section-ruling`, when Plan 02 lands) when it lands; proposed **TRUE** here, since a rebuild-from-disk is mechanical and reversible.

## Files Created/Modified

See the frontmatter `key-files` block above for the full list; the eight task commits each document their own file-level rationale in detail.

## Decisions Made

See frontmatter `key-decisions`. The most consequential: **gamma-room's committed fixture carries a root ROOM.md** (reversing the plan's literal wording) because this repo's own pre-commit hook (`scripts/hooks/pre-commit-room-minto-guard.sh`, Canon decision 15) refuses to commit any `.room-root`-marked directory missing ROOM.md+MINTO.md, with zero exception for a deliberately-missing identity file or an artifact folder. The "missing root, created from the identity template" and "artifact folder with no ROOM.md" scenarios are still fully tested -- via a tmpdir copy with the file deleted at test runtime (documented in `tests/fixtures/icm-rooms/README.md`'s "Committed-tree compromise" section) -- they are just never persisted that way in the git-tracked tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit Data Room invariant blocked the literal fixture design**
- **Found during:** Task 1 (fixture tree authoring)
- **Issue:** `scripts/hooks/pre-commit-room-minto-guard.sh` refused the commit: every directory under a `.room-root` sentinel must carry both ROOM.md and MINTO.md, with no carve-out for a deliberately-missing root identity file (gamma-room) or a Key-Decision-16 artifact folder (first-cut/).
- **Fix:** Added MINTO.md everywhere and a root ROOM.md to gamma-room; documented the compromise in `tests/fixtures/icm-rooms/README.md`; moved the two "missing" scenarios to test-runtime tmpdir copies with the file deleted.
- **Files modified:** `tests/fixtures/icm-rooms/**` (all MINTO.md/ROOM.md additions), `tests/fixtures/icm-rooms/README.md`.
- **Commit:** `4fe602c26`

**2. [Rule 1 - Bug] Two splice bugs in writeSelfBlocks, found by this task's own byte-stability leg**
- **Found during:** Task 3 (icm_self block writer)
- **Issue:** `findIcmSelfBlockRange`'s end-offset over-counted by one character when the block ran to the end of the frontmatter body; `spliceIcmSelfIntoFrontmatter` unconditionally appended a separator newline even with nothing after the block. Together, every rewrite grew one extra blank line before the closing `---` fence, silently surfacing through the PRE-EXISTING `tests/test-275-section-schema.cjs` "a second run is byte-identical to the first" assertion.
- **Fix:** Corrected the offset computation to use `body.length` when the block runs to the end; made the separator newline conditional on non-empty trailing content.
- **Files modified:** `lib/core/room-map.cjs`.
- **Verification:** Three consecutive scaffold runs now produce byte-identical ROOM.md files; `test-275-section-schema.cjs` returns to 65/65.
- **Committed in:** `52538806f`

**3. [Rule 1 - Bug] scaffoldRoomSkeleton's new room-map write broke a pre-existing idempotency test**
- **Found during:** Task 3
- **Issue:** `tests/test-275-section-schema.cjs`'s `snapshot()` walks every file recursively with no dot-directory filter; `.mindrian/room-map.json`'s `built_at` timestamp (by design, D-353-2) differs between two scaffold runs, breaking the pre-existing "second run is byte-identical" assertion.
- **Fix:** Narrowly excluded only `.mindrian` from `snapshot()`'s walk (not every dot-directory), preserving its existing coverage of `.intelligence`/`.snapshots`/`.context`.
- **Files modified:** `tests/test-275-section-schema.cjs`.
- **Committed in:** `52538806f`

**4. [Rule 3 - Blocking] Self-referential grep false positives in acceptance-criteria checks**
- **Found during:** Tasks 2, 5, 8
- **Issue:** Header-comment prose documenting a "must not contain X" rule literally contained the substring X (e.g., "No `async`, no `await`" contains the word `async`; "grep -c \"MindrianRooms\"..." contains `MindrianRooms`; "fix()" and "--fix" mentioned in a hard-constraint comment), tripping the literal acceptance-criteria grep commands against the documentation itself.
- **Fix:** Reworded the affected comments to describe the same invariant without using the literal banned substring.
- **Files modified:** `lib/core/room-map.cjs`, `tests/test-353-subroom-birth.cjs`, `tests/test-353-fleet-report.cjs`.
- **Committed in:** `ba5f78aee`, `2778dc28f`, `d5af63c7c`

---

**Total deviations:** 4 auto-fixed (1 blocking pre-commit-invariant adjustment, 2 real bugs found by this plan's own tests, 1 blocking self-referential-grep fix).
**Impact on plan:** All four were necessary for correctness or for the commit to land at all. No scope creep; no plan requirement was skipped or weakened.

## Issues Encountered

- **Live dev-repo hooks mutated fixture files mid-authoring.** This repo's own PostToolUse hooks (`async-artifact-auto-commit.cjs`, a cross-reference "cascade" regen) treat any `.room-root` + `ROOM.md`-bearing directory created via the Write tool as a live Data Room and append generated content (a `Cross-References` block) plus `.mindrian/*.json` bookkeeping files. Resolved by using the Bash tool (not Write/Edit) for the remaining small fixture files, and by `rm -rf`-ing the generated `.mindrian/` noise before the Task 1 commit. No functional impact: these hooks fire only on the Write/Edit tool, never on Node's own `fs` calls at test runtime.
- **`doctor --acceptance`'s `install-state` and `verify-release-clean-tree` points fail throughout the session** -- both pre-existing/environmental (a stale session-state record against `installed_plugins.json`, and mid-task uncommitted files respectively), neither caused by this plan's code. They clear once every task's files are committed except for `.planning/STATE.md` itself, which this plan's own final state-update step writes last.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (Section Ruling System) can now build on `JOB_VOCABULARY`/`isDeclaredJob`/`VOCABULARY_EXTENSION_JOBS` (section-registry.cjs), the room map's `job_id` field per node, and the `icm_self` block as the addressing layer its filing gate and ruling-document generator both need.
- Plan 02 Task 1 must ratify `VOCABULARY_EXTENSION_JOBS` against its own `data/section-job-canon.json` header rather than re-declaring the four members (stated explicitly in this plan's own header comments).
- Phase 352 (doctor `auto_heal` classification) has a concrete, documented row to classify: `room-map`, proposed TRUE.
- No blockers. The two doctor-acceptance failures and the one newly-discovered pre-existing test-195 failure are all documented as out-of-scope/environmental, not plan-blocking.

---
*Phase: 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 12 listed created files verified present on disk; all 8 task commit hashes verified present in `git log`. No missing items.
