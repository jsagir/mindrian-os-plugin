---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 07
subsystem: graph-provenance
tags: [b2, frame-provenance, governing-question, decision-gate, sqlite, room-graph]

# Dependency graph
requires:
  - phase: 358-01..05 (B1)
    provides: the B1 checking-record substrate and render-line conventions this plan mirrors (rungInfo/frameOriginInfo idiom, BEGIN IMMEDIATE ownership idiom)
provides:
  - "The room's ONE governing-question record: substrate (typed-frame.cjs role branch) + the single write door (frame-provenance.cjs setGoverningQuestion)"
  - "readGoverningQuestion / readQuestionHistory / renderQuestionLines / renderHistoryLines for 358-08 (CLI) and 358-09 (MCP) to call"
  - "renderQuestionChangeCard: the one SEED-020 pickShape call site for the question-change Decision Gate"
affects: [358-08 (CLI surface), 358-09 (MCP surfaces), 358-10 (registries/skill), 358-11 (go/no-go runbook)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One write door, one role branch: setGoverningQuestion is the only caller of the strict, immutable governing_question role on writeFrameNode (mirrors the B1 rungInfo/VERIFICATION_RUNGS one-constant idiom)"
    - "Artifact-not-property: question/account prose lives only under <room>/.mindrian/frames/, node/edge properties carry only hashes and generated handles"
    - "Card-emission-as-refusal: a changed question is refused until answered, the refusal itself IS the Decision Gate card (shape F.1 through selector-dispatcher.cjs pickShape, never a hand-built widget)"

key-files:
  created:
    - lib/core/frame-provenance.cjs
    - tests/test-358-b2-core.cjs
    - tests/test-358-b2-render.cjs
    - tests/test-358-b2-part8.cjs
  modified:
    - lib/core/navigation/typed-frame.cjs
    - lib/core/navigation.cjs
    - tests/test-b2-frame-provenance.cjs
    - tests/run-all-358.sh
    - data/render-coverage-registry.json

key-decisions:
  - "F.1 instead of F.0 for the question-change card (navigator's own requirement named F.0): F.0 is closed-vocabulary (Approve/Reject/Defer) and captures its Reject reason as a REJECTED_BECAUSE edge property, which would put the officer's account prose into graph metadata and break the artifact-only account rule. Documented in the plan's own context block and restated in the file header; not a plan deviation, the plan already called this out."
  - "readGoverningQuestionVersions is a SEPARATE reader from readFrameProvenance (not a filtered call into it): keeps the general FUSION-frame reader untouched while giving the governing-question record its own ordered, typed shape."
  - "based_on_version supplied with no prior question at all refuses question_changed_meanwhile (current: null) rather than falling through to no_previous_question: not explicitly specified by the plan for that specific combination, chosen as the more honest refusal (the caller referenced a version that cannot exist)."

patterns-established:
  - "Pattern: role-scoped node write branch. A single node TYPE (frame) can carry a strict, immutable-per-version write branch (governing_question) alongside a lenient, upsertable one (FUSION), gated purely on a frameRole discriminator checked first in writeFrameNode."
  - "Pattern: refusal-carries-its-own-card. A validation refusal that requires a Decision Gate builds and returns the rendered card inline in the refusal object (card:), so the caller never has to make a second call to learn what to show."

requirements-completed: [B2-01, B2-02, B2-03, B2-04, B2-07, B2-09, B2-10]

# Metrics
duration: ~30min
completed: 2026-09-23
---

# Phase 358 Plan 07: Frame Provenance Substrate and the One Write Door Summary

**Hardened `lib/core/navigation/typed-frame.cjs` with an immutable, origin-required `governing_question` role and built `lib/core/frame-provenance.cjs` as the single door (set/read/history/render/card) for the room's one governing-question record, with the question-change refusal rendered as a single F.1 Decision Gate card through the SEED-020 `pickShape` door.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-23T20:12:44Z (last task commit, UTC)
- **Tasks:** 3 (RED, GREEN substrate, GREEN door)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- The room's governing question is now a real, room-level, immutable-per-version record with a REQUIRED origin (chosen/tasking/prompt/inherited, one `FRAME_ORIGINS_ORDERED` constant, `TODO(358)` until the paper author confirms the labels) -- B2-01.
- `setGoverningQuestion` is the ONLY writer: the same question is a no-op (`unchanged`); a changed question with neither an account nor `relocate:true` is REFUSED (`change_needs_account`) with the exact ask, the previous and proposed question, a pending marker on disk, and the question-change card; an account files the change as `refines` (account stored as an artifact, only its hash/handle ever touch a node property); `relocate:true` files it as `relocates`; both together is `ambiguous_change`; a missing choice never defaults to either path -- B2-02, B2-03.
- The refusal's ask renders as ONE Decision Gate card through `lib/hmi/selector-dispatcher.cjs pickShape` (shape F.1, tier 2, no recommended option, Free-Text last); `data/render-coverage-registry.json` now covers it as `card-emission` (16 -> 17 entries) -- navigator requirement item 1.
- A written version is never rewritten (`version_exists`, `on_conflict: 'nothing'`); the only edges are `REFINES` and `FOLLOWS_FROM` new-version -> prior-version; `SUPERSEDES` never appears anywhere in the cycle -- B2-07.
- `readGoverningQuestion` / `readQuestionHistory` surface the waiting change FIRST (with its card), then the current question with origin/label/time, then every version oldest-first with its change kind and (for refines) the account text; both renderers never use a ranking word and never say "governing thought"; an out-of-band artifact edit or a missing artifact surfaces as `Unresolved` -- B2-04.
- Zero question/account prose in any node or edge property (verified by a live prose scan of the room.db after a full cycle); zero direct requires of a Brain/network module; a full set/refuse/refines/relocates/read cycle (card rendering included) makes zero network calls; the B1 room portrait's counts are unchanged after a full question cycle -- B2-09.
- `tests/run-all-358.sh` re-opened exactly once for B2 (per the plan's own ruling): all seven B2 test files named up front, the CIRS glob widened to `358-[0-9][0-9]-PLAN.md`, the em-dash glob widened to `test-358-b[12]-*.cjs`, `PHASE_358_SURFACES` grown with the B2 non-test files -- B2-10 (runner part).

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: RED - core, render and Part 8 tests; re-open the phase runner once** - `0f7a00cad` (test)
2. **Task 2: GREEN (substrate) - harden typed-frame.cjs, origin constant, navigation.cjs re-export** - `142d78afb` (feat)
3. **Task 3: GREEN (door) - lib/core/frame-provenance.cjs, regenerate render-coverage registry** - `75a49b704` (feat)

_TDD Gate Compliance: RED commit (`0f7a00cad`) precedes both GREEN commits (`142d78afb`, `75a49b704`) in git history. No REFACTOR commit was needed (Task 2 and Task 3 each passed on the first implementation)._

## Files Created/Modified

- `lib/core/frame-provenance.cjs` - the one write door: `setGoverningQuestion`, `readGoverningQuestion`, `readQuestionHistory`, `renderQuestionLines`, `renderHistoryLines`, `renderQuestionChangeCard`, `questionHash`, `normalizeQuestion`, plus the exported constants
- `lib/core/navigation/typed-frame.cjs` - `FRAME_ORIGINS_ORDERED` (TODO(358)), `frameOriginInfo`, `GOVERNING_QUESTION_ROLE`/`NODE_ID`, the strict `writeGoverningQuestionRole` branch, `readGoverningQuestionVersions`, an ordered `readFrameProvenance`, and a `readOpenFrames` exclusion for `governing_question` rows (the lenient FUSION path is byte-for-byte unchanged)
- `lib/core/navigation.cjs` - additive re-export block (`FRAME_ORIGINS_ORDERED`, `frameOriginInfo`, `GOVERNING_QUESTION_ROLE`, `GOVERNING_QUESTION_NODE_ID`, `readGoverningQuestionVersions`)
- `tests/test-358-b2-core.cjs` - S1-S5 substrate legs, D1-D13 door legs (18 checks)
- `tests/test-358-b2-render.cjs` - R1-R8 reader/render legs, C1-C2 card legs (10 checks)
- `tests/test-358-b2-part8.cjs` - P1-P7 Part 8 legs: prose scan, static require scan, substrate guard, one-door scan, zero-network cycle, B1-portrait-unchanged, one-constant rule (7 checks)
- `tests/test-b2-frame-provenance.cjs` - updated for the hardened substrate (created_at/set_at assertions, one role-write round-trip)
- `tests/run-all-358.sh` - the one deliberate B2 re-open (see Accomplishments)
- `data/render-coverage-registry.json` - regenerated, +1 `card-emission` entry for `lib/core/frame-provenance.cjs`, no other diff

## Decisions Made

See `key-decisions` in the frontmatter above. In short: F.1-not-F.0 for the card (plan-specified, not a new deviation), a separate `readGoverningQuestionVersions` reader (keeps the FUSION reader untouched), and a `question_changed_meanwhile` refusal for a `based_on_version` reference against an empty room (an edge case the plan's ordering left slightly ambiguous; chosen as the more honest of the two readings).

## Deviations from Plan

None that changed behavior. One internal wording fix during self-verification:

**1. [Rule 1 - Bug] A doc comment inside `setGoverningQuestion` accidentally tripped its own acceptance-criteria grep**
- **Found during:** Task 3 self-check (the plan's own acceptance criterion `awk '/^function setGoverningQuestion/,/^}/' ... | grep -c "navigation\.write"` must equal exactly 2)
- **Issue:** A comment line inside the function read `... navigation.writeFrameNode( and navigation.writeEdge( calls directly.`, which is literal text matching the same grep the acceptance criterion runs, producing a count of 3 instead of 2. The two REAL call sites were correct; only the comment's own wording was the problem.
- **Fix:** Reworded the comment to describe the same intent ("the frame-node and edge write calls below") without repeating the `navigation.write` literal.
- **Files modified:** `lib/core/frame-provenance.cjs`
- **Verification:** `awk '/^function setGoverningQuestion/,/^}/' lib/core/frame-provenance.cjs | grep -c "navigation\.write"` now returns 2; all three B2 test files still exit 0.
- **Committed in:** `75a49b704` (part of the Task 3 commit; fixed before commit, not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug, comment wording only)
**Impact on plan:** Zero behavior change. No scope creep.

## Issues Encountered

None. Every task's implementation passed its own verify block and acceptance criteria on the first or second attempt (S1-S5 and D1-D13 all passed on the first run of Task 2/3's implementation; only the acceptance-criteria comment wording above needed a follow-up edit).

## User Setup Required

None - no external service configuration required. Zero Brain/network calls anywhere in this plan (verified live by P5's http/https/net/fetch wrap).

## Next Phase Readiness

- 358-08 (CLI surface) and 358-09 (MCP surfaces) can call `lib/core/frame-provenance.cjs` directly against the exact contract this plan's Task 1 interface block specified; nothing in that interface changed during implementation.
- `tests/run-all-358.sh` already names all seven B2 test files and both non-test surfaces those plans create (`scripts/room-question.cjs`, `lib/mcp/tools/question.cjs`) in `PHASE_358_SURFACES` and the em-dash guard; 358-08/09 should NOT re-open the runner again (358-10 owns the registries/skill regeneration pass).
- `bash tests/run-all-358.sh` currently exits 77 (SKIPPED=4: the four B2 test files 358-08/358-09 create) with FAILED=0 -- this is the expected, plan-documented state at the end of 358-07.
- No blockers. Rulings 4 and 6 (Phase 345 goal.parent_question, the chain_run pending-change halt) remain untouched, as scoped.

## Self-Check: PASSED

- FOUND: `lib/core/frame-provenance.cjs`
- FOUND: `lib/core/navigation/typed-frame.cjs` (modified)
- FOUND: `lib/core/navigation.cjs` (modified)
- FOUND: `tests/test-358-b2-core.cjs`
- FOUND: `tests/test-358-b2-render.cjs`
- FOUND: `tests/test-358-b2-part8.cjs`
- FOUND: `tests/test-b2-frame-provenance.cjs` (modified)
- FOUND: `tests/run-all-358.sh` (modified)
- FOUND: `data/render-coverage-registry.json` (modified)
- FOUND commit `0f7a00cad` (test RED)
- FOUND commit `142d78afb` (feat substrate GREEN)
- FOUND commit `75a49b704` (feat door GREEN)
- All three B2 test files exit 0; `test-b2-frame-provenance.cjs`, `test-205-frame-node.cjs`, `test-205-fusion-router.cjs`, `test-348-one-supersession-door.cjs`, `test-358-b1-core.cjs`, `test-358-b1-portrait.cjs` all exit 0
- `node scripts/check-render-coverage.cjs --check` and `node scripts/build-render-coverage.cjs --check` both exit 0
- `bash tests/run-all-358.sh` exits 77, `PASSED=35 FAILED=0 SKIPPED=4`

---
*Phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible*
*Completed: 2026-09-23*
