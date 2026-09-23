---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 13
subsystem: testing
tags: [fixture-rooms, hit-rate, d-34, d-35, d-48, icm-rooms-pattern]

requires:
  - phase: 355-02
    provides: "PWS author's phrase ruling (D-35 step 3 gate: rooms authored only after the phrase ruling)"
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs extractCarried/resolveEndpoint (D-48 frontmatter resolution)"
  - phase: 355-08
    provides: "data/framework-names.json live snapshot (the exact framework names resolveEndpoint checks against)"
provides:
  - "tests/fixtures/355-rooms/room-ill-defined/, room-extend/, room-control/: three Claude-authored synthetic Data Rooms, icm-rooms .room-root/ROOM.md/MINTO.md pattern, 4 sections of 3-4 artifacts each (12-16 total, 150-300 words per artifact)"
  - "tests/fixtures/355-rooms/planted-cases.json: room-control's ground truth (4 meaning bridges, 4 false friends), joined only after judging"
  - "tests/fixtures/355-rooms/README.md: case index, never-run-in-place rule, no-peeking rule"
  - "tests/test-355-fixture-rooms.cjs: the structure/size/frontmatter-resolution/discovery proof all three rooms satisfy"
affects: [355-24, 355-25]

tech-stack:
  added: []
  patterns:
    - "Fixture rooms are always discovered/measured on an fs.cpSync copy under fs.mkdtempSync(os.tmpdir()), never in place (the icm-rooms README rule, reused here for a second fixture-room family)"
    - "D-48 frontmatter mix: half an artifact's population carries a leading framework:/methodology: block that resolves exactly against data/framework-names.json or data/command-registry.json, half carries none, so both resolveEndpoint outcomes get exercised"
    - "Planted ground truth (meaning bridges, false friends) lives only in a sibling planted-cases.json, never inside the room text itself; a banned-word grep (planted/false friend/bridge case) is the acceptance gate that keeps it that way"

key-files:
  created:
    - tests/test-355-fixture-rooms.cjs
    - tests/fixtures/355-rooms/README.md
    - tests/fixtures/355-rooms/planted-cases.json
    - tests/fixtures/355-rooms/room-ill-defined/ (4 sections, 12 artifacts)
    - tests/fixtures/355-rooms/room-extend/ (4 sections, 12 artifacts)
    - tests/fixtures/355-rooms/room-control/ (4 sections, 16 artifacts)
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "Went with 3 artifacts per section (12 per room) for room-ill-defined and room-extend, 4 per section (16) for room-control, all within the plan's 12-16 discoverArtifacts band -- room-control needed the extra headroom because 4 meaning bridges + 4 false friends each need a dedicated artifact per side (8 distinct topics), one per domain slot, to keep each planted case's shared word or mechanism unambiguous to a labeler rather than folded into an artifact serving double duty"
  - "D-48 split 6 resolvable / 6 non-resolvable for room-ill-defined and room-extend, 8/8 for room-control -- comfortably over the plan's >= 4 / >= 4 floor in every room, so a single frontmatter typo could not silently drop a room below the bar"
  - "planted-cases.json paths are room-relative (e.g. cell-biology/immune-memory.md), matching discoverArtifacts' own `path` field exactly, so the same string join works for both the structure test and any future consumer (355-24/355-25) without a second path convention"
  - "The four meaning bridges and four false friends were each given their own dedicated artifact per side (8 + 8 = 16 artifacts in room-control) rather than reusing an artifact for two different planted cases, so every case reads as one clean, natural working note and the labeler is never asked to spot two different signals inside the same short document"
  - "ROADMAP.md's 355-13 row and Plans counter were staged via git apply --cached against a clean HEAD copy (355-10/11/12 precedent), then the working tree was reconciled to the same two lines by direct Edit so disk matches the new HEAD, while a peer session's unrelated blank-line-removal hunk near Phase 267 was left untouched in the working tree both before and after"

patterns-established:
  - "Second fixture-room family in the repo (after Phase 353's tests/fixtures/icm-rooms/): same .room-root + ROOM.md + MINTO.md-in-every-directory contract, same never-run-in-place rule, same 'exercise the missing case at runtime on a tmpdir copy, never commit an invariant-violating tree' idiom"

requirements-completed: [HIPS-07]

duration: 55min
completed: 2026-09-24
---

# Phase 355 Plan 13: Fixture Rooms for the First Human-Judged Hit Rate Summary

**Three Claude-authored synthetic Data Rooms (an ill-defined rural-clinic referral problem, an existing cold-chain service reviewed for extension, and a four-domain control room planting 4 meaning bridges and 4 false friends) with a 34-check structure test, giving 355-24/355-25 something real to measure RS/HSI/whitespace usefulness against.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-24 (sequential executor on the shared main tree)
- **Completed:** 2026-09-24
- **Tasks:** 3 completed
- **Files modified:** 75 created (3 rooms x [1 .room-root + 1 root ROOM.md + 1 root MINTO.md + 4 sections x (ROOM.md + MINTO.md + 3-4 artifacts)] + README.md + planted-cases.json + the test file), 1 modified (ROADMAP.md)

## Accomplishments

- `tests/test-355-fixture-rooms.cjs` pins the full contract from the plan's `must_haves`: `.room-root` presence, every directory carrying `ROOM.md` + `MINTO.md`, exactly 4 sections of 3-4 artifacts each, every artifact body 150-300 words (frontmatter stripped), `discoverArtifacts()` returning 12-16 per room, at least 4 artifacts per room resolving through `resolveEndpoint` via `framework`/`methodology` and at least 4 resolving through nothing, the `pws_stage` D-40 contract on each root `ROOM.md`, no `planted`/`false friend`/`bridge case` text leak, and `planted-cases.json`'s own shape -- all discovery runs on an `fs.cpSync` copy under `fs.mkdtempSync(os.tmpdir())`, deleted after, per the icm-rooms README rule
- `tests/fixtures/355-rooms/room-ill-defined/`: a rural clinic network losing patients between referral and follow-up, across `patient-flow`, `transport-logistics`, `community-trust`, `staffing` (12 artifacts, 6 with a resolvable `framework:`/`methodology:`, 6 without); root `ROOM.md` carries `pws_stage: ill_defined`
- `tests/fixtures/355-rooms/room-extend/`: an existing, working cold-chain delivery service reviewed for how its phase-change buffering capability, route density, and compliance build could extend to an adjacent market, across `operations`, `materials-science`, `retail-demand`, `regulation` (12 artifacts, 6/6 split); root `ROOM.md` carries `pws_stage: extend_opportunity`; includes cross-section passages (the buffering mechanism, the auditor's regulatory aside) that hint at a transfer without naming one
- `tests/fixtures/355-rooms/room-control/`: four deliberately distant domains (`cell-biology`, `computer-security`, `retail-marketing`, `river-hydrology`, 16 artifacts, 8/8 split), no `pws_stage`; plants 4 meaning bridges (immune memory <-> signature detection, rate limiting <-> spillway regulation, a trip-wire offer <-> a chemoattractant gradient, a watershed funnel <-> an attribution funnel) and 4 false friends (`virus`, `channel` x2, `bank`), each pair naming two real artifact paths, never named as planted in the room text itself
- `tests/fixtures/355-rooms/planted-cases.json` carries the ground-truth `meaning_bridges`/`false_friends` array (paths, mechanism/shared_word/meanings), with the `_note` telling a labeler not to open it before judging
- `tests/fixtures/355-rooms/README.md` is the case index: never-run-in-place, no real names, do-not-open-`planted-cases.json`-before-judging, and the D-48 frontmatter-mix note
- `node tests/test-355-fixture-rooms.cjs`: PASS 34 FAIL 0, exit 0 (all three rooms fully green together)
- `node scripts/feynman-minto-guardian.cjs pre-commit tests/fixtures/355-rooms/<room>` exits 0 for all three rooms
- `grep -rliE "planted|false friend|bridge case" tests/fixtures/355-rooms/room-*` prints nothing
- A surname/proper-noun sweep (`grep -rEo '\b[A-Z][a-z]+ [A-Z][a-z]+\b'`) over the whole `tests/fixtures/355-rooms/` tree turns up only section titles, framework names and doc headers (e.g. "Systems Thinking", "Community Trust") -- no person, company, or real place name anywhere

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: Structure test (RED), README, planted-cases.json and room-ill-defined** - `657ff4321` (test)
2. **Task 2: room-extend** - `ce02c9bd4` (test)
3. **Task 3: room-control with planted bridges and false friends; all structure checks green** - `da385d6c9` (test)

**Plan metadata:** `0b864b868` (docs: ROADMAP.md 355-13 row checked, Plans counter 11/28 -> 12/28)

## Files Created/Modified

- `tests/test-355-fixture-rooms.cjs` - the structure/size/resolution/discovery/no-leak proof, 34 checks across 3 rooms + planted-cases.json
- `tests/fixtures/355-rooms/README.md` - case index and the never-run-in-place / no-peeking rules
- `tests/fixtures/355-rooms/planted-cases.json` - 4 meaning bridges, 4 false friends, joined only after judging
- `tests/fixtures/355-rooms/room-ill-defined/` - 4 sections, 12 artifacts, `pws_stage: ill_defined`
- `tests/fixtures/355-rooms/room-extend/` - 4 sections, 12 artifacts, `pws_stage: extend_opportunity`
- `tests/fixtures/355-rooms/room-control/` - 4 sections, 16 artifacts, no `pws_stage`
- `.planning/ROADMAP.md` - 355-13 row checked, Plans counter 11/28 -> 12/28

## Decisions Made

See key-decisions in frontmatter: the 12/12/16 artifact-count split, the 6/6 and 8/8 D-48 frontmatter mixes, the room-relative path convention in `planted-cases.json`, giving every planted case its own dedicated artifact per side, and the `git apply --cached` + working-tree reconciliation used for the ROADMAP.md row.

## Deviations from Plan

### Auto-fixed Issues

None - all three tasks' action steps were followed as written; every structure check passed on the first authoring pass (no rework needed after the guardian or the structure test).

### Documented scope note (no functional impact)

**1. [Scope note, not a fix] ROADMAP.md's 355-13 line text says "with the path guard"; `guardRoomPath` is 355-24's own deliverable, not this plan's**
- **Found during:** Updating the ROADMAP.md row for this plan
- **Issue:** The wave-1-era ROADMAP.md line for 355-13 reads "...with the path guard", but re-reading `355-13-PLAN.md`'s own `files_modified`, tasks, and `must_haves` confirms this plan's stated surface is the three rooms, the README, and `planted-cases.json` only. `guardRoomPath` (the `--room` realpath/separator-prefix refusal) is `scripts/measure-355-hit-rate.cjs`'s own deliverable, explicitly scoped to plan 355-24's `must_haves` and `artifacts` (`exports: ["guardRoomPath", ...]`).
- **Why not fixed:** Not a defect to fix -- the original ROADMAP wording predates the final plan split and is mildly imprecise, not wrong (the rooms this plan built are exactly what 355-24's guard will refuse to let outside its own tree). Left the original phrase in place and appended a note in the same row rather than rewriting wave-1 planning history.
- **Files modified:** none beyond the ROADMAP.md row itself, already covered in the Task-metadata commit.
- **Verification:** `355-24-PLAN.md`'s own `artifacts` block: `scripts/measure-355-hit-rate.cjs` exports `guardRoomPath`; this plan's own `files_modified` list has no `scripts/` entry.
- **Committed in:** `0b864b868` (ROADMAP.md commit)

---

**Total deviations:** 0 auto-fixed; 1 documented scope note (a pre-existing ROADMAP wording precision, not a code change).
**Impact on plan:** None on this plan's own acceptance criteria -- both the automated structure test and every task's own `<verify>`/`<acceptance_criteria>` line pass exactly as specified.

## Issues Encountered

- `git apply --cached` (the 355-10/11/12 ROADMAP.md precedent) only updates the git index, not the working-tree file; after committing the index directly, the on-disk `ROADMAP.md` still carried the pre-edit "11/28" / unchecked-box text for this plan's two lines (while correctly still carrying the peer's own unrelated hunk). Reconciled by applying the identical two edits directly to the working-tree file via `Edit`, then re-diffed to confirm the working tree now differs from HEAD by exactly the peer's original unrelated hunk and nothing else -- no new commit needed, since the content now matches what `0b864b868` already recorded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/fixtures/355-rooms/{room-ill-defined,room-extend,room-control}/` and `planted-cases.json` are ready for 355-24 (`scripts/measure-355-hit-rate.cjs`'s `export --unstamped` pass) and 355-25 (stamping, sitting 2, the hit-rate record) to run RS/HSI/whitespace against, always on a temp copy per the same never-run-in-place rule this plan's own test already enforces
- `tests/test-355-fixture-rooms.cjs` is a standing regression guard: any future edit to a room's artifacts, section count, or frontmatter mix that breaks the D-34/D-40/D-48/D-32 contract will fail this test before it reaches 355-24/355-25
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; a `state.*` write has previously reverted a peer's uncommitted work in this exact scenario). `.planning/ROADMAP.md`'s phase-355 checklist row (355-13 checked, Plans counter 12/28) is the durable progress record instead.
- Blocker/concern carried forward: none blocking 355-14 or any other 355 plan; the one documented scope note above (the "with the path guard" wording) does not affect any dependent plan's own stated scope.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 6 spot-checked created files verified present on disk
(`tests/test-355-fixture-rooms.cjs`, `tests/fixtures/355-rooms/README.md`,
`tests/fixtures/355-rooms/planted-cases.json`, and each room's root
`ROOM.md`); all 4 commits (`657ff4321`, `ce02c9bd4`, `da385d6c9`,
`0b864b868`) verified present in `git log`. `node tests/test-355-fixture-rooms.cjs`
re-confirmed PASS 34 FAIL 0 immediately before this SUMMARY was written.
