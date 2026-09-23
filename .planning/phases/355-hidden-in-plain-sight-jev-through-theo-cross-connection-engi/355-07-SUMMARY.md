---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 07
subsystem: dev-tooling
tags: [jev, dev-time, egress-ceiling, zod, d-57-file, hsi-thinking-mode, citation-check, usefulness-judge]

requires:
  - phase: 355-01
    provides: "lib/core/direction-convention.cjs (DIRECTIONS, DIRECTION_MEANING, NONE), tests/helpers/hygiene-355.cjs"
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs's _renderNodes pattern (non-Framework node -> '[' + label + ']'), reused by hopsFromTheoPath"
provides:
  - "scripts/jev-devtime-client.cjs: three additive EGRESS_PROFILES entries (hsi_thinking_mode, citation_check, usefulness_judge), each pinned to jev-1.13.0; jev()'s two default-off options timeoutMs (AbortSignal.timeout) and honorRetryAfter"
  - "scripts/jev-question-ceilings.cjs: PINNED_MODEL, THINKING_MODE_LABELS, THINKING_MODE_QUESTIONS, CITATION_RULE, CITATION_QUESTIONS_STATED/WITHHELD, USEFULNESS_QUESTIONS, renderClaim, hopsFromTheoPath, makeSentenceCeiling, makeCitationCeiling, makeUsefulnessCeiling, composeGuard, questionSha256"
  - "scripts/jev-response-schema.cjs: zod JevResponse, parseJevResponse(res, expected)"
  - "tests/test-355-jev-ceilings.cjs: 132 assertions, zero fetch attempts, proves every ceiling refuses before fetch()"
affects: [355-15, 355-26]

tech-stack:
  added: []
  patterns:
    - "Purely additive D-57 shared-file edit: new fetch-init key and a new pre-check if-block inserted around unmodified lines, so `git diff` shows zero removed code lines against the pre-edit file"
    - "Per-question ceiling = composeGuard(makeEgressGuard(EGRESS_PROFILES.<id>), closure): the profile guard enforces shape (top-level keys, model, state/question key sets, string lengths); the closure adds membership/equality checks a bare shape guard cannot express"
    - "Snapshot-fixture regression guard for a shared multi-builder file: tests/fixtures/355/pre-355-07-egress-profiles-snapshot.json captures the four pre-existing profiles from CURRENT HEAD (not BASE_355) before editing, since a later peer's legitimate addition (357's card_fire_replay) must not be mistaken for drift"

key-files:
  created:
    - scripts/jev-question-ceilings.cjs
    - scripts/jev-response-schema.cjs
    - tests/test-355-jev-ceilings.cjs
    - tests/fixtures/355/pre-355-07-egress-profiles-snapshot.json
  modified:
    - scripts/jev-devtime-client.cjs
    - tests/test-353-tripwires.cjs
    - .planning/ROADMAP.md

key-decisions:
  - "Direction ids and phrases for renderClaim/citation come from lib/core/direction-convention.cjs's real, already-wired DIRECTIONS (structural_transfer/semantic_implementation) and DIRECTION_MEANING, superseding the AI-SPEC Section 3 illustrative code's placeholder ids (meaning_bridge/term_collision), per the plan's own read_first note and D-01"
  - "hopsFromTheoPath renders a non-Framework path node as '[' + label + ']' by checking theoPath.pathLabels[i] === 'Framework', mirroring lib/core/verification-stamp.cjs's own _renderNodes exactly (T-355-29) rather than inventing a second rule for the same non-Framework-node problem"
  - "makeUsefulnessCeiling(pairMap) proves membership by content equality (a_excerpt/b_excerpt/direction_phrase byte-equal to some entry in the map), not by a pair_id state key, since the usefulness_judge profile's state_keys carry no pair_id -- this is a design decision made while writing the closure, not a bug found after the fact (Rule 2 territory, documented since the plan's behavior text does not spell out how the closure locates the pairing without an id in state)"
  - "jev-devtime-client.cjs's edit is provably additive: `git diff scripts/jev-devtime-client.cjs | grep '^-' | grep -v '^---' | grep -vcE \"^-\\s*(//|$)\"` prints 0 -- the fetch-init `signal` key was added as a new object-literal line rather than replacing the literal, and the honorRetryAfter branch was inserted as a new if-block before the untouched original 429 backoff line, so neither existing line changed"
  - "The pre-existing-profiles-unchanged check compares against a fixture snapshot captured from CURRENT HEAD at plan-start time (tests/fixtures/355/pre-355-07-egress-profiles-snapshot.json, source_commit db937d405), not BASE_355, per the shared_tree_rules note that 357's card_fire_replay profile landed after BASE_355 and is legitimate"

requirements-completed: [HIPS-08, HIPS-09]

duration: 55min
completed: 2026-09-23
---

# Phase 355 Plan 07: Jev Dev-Time Client Profiles, Ceilings, Response Parser Summary

**Three additive `EGRESS_PROFILES` entries (`hsi_thinking_mode`, `citation_check`, `usefulness_judge`) and two default-off `jev()` options land in the shared `scripts/jev-devtime-client.cjs` with zero removed code lines; `scripts/jev-question-ceilings.cjs` and `scripts/jev-response-schema.cjs` ship the frozen questions, per-question closure ceilings and the vendor response parser that let 355-15 and 355-26 later run a real Jev question with nothing but Theo Framework names, one enum phrase, and Claude-written fixture sentences ever crossing the wire.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-23T19:20:00Z (approx)
- **Completed:** 2026-09-23T20:18:00Z (approx)
- **Tasks:** 2 completed (both `tdd="true"`: RED then GREEN)
- **Files modified:** 4 created, 3 modified

## Accomplishments

- `scripts/jev-devtime-client.cjs` gains three frozen `EGRESS_PROFILES` entries (`hsi_thinking_mode`, `citation_check`, `usefulness_judge`), each pinned to `model: 'jev-1.13.0'`, plus `jev()`'s two default-off options: `timeoutMs` (adds `signal: AbortSignal.timeout(o.timeoutMs)` to the fetch init) and `honorRetryAfter` (a 429/529 carrying a numeric positive `retry-after` header sleeps that many seconds instead of the exponential backoff, only when opted in). The edit is provably additive: `git diff` shows zero removed non-comment code lines against the pre-edit file, and the four pre-existing profiles (`section_command_ledger`, `material_step_ledger`, `framework_command_ledger`, `card_fire_replay`) are byte-identical to a snapshot fixture captured from HEAD before the edit
- `scripts/jev-question-ceilings.cjs` ships `PINNED_MODEL`, `THINKING_MODE_LABELS` (the six labels including `none`), `THINKING_MODE_QUESTIONS` (fresh examples, none drawn from the gold/tuning fixtures -- proved with a SKIP-when-absent leg since 355-03 has not landed those files yet), `CITATION_RULE` + `CITATION_QUESTIONS_STATED`/`WITHHELD`, `USEFULNESS_QUESTIONS`, `renderClaim` (templated from two names + `lib/core/direction-convention.cjs`'s real `DIRECTION_MEANING` phrase, throws on `none` or an unknown direction), `hopsFromTheoPath` (named `{from, relation, to}` hops, non-Framework nodes rendered `'[' + label + ']'` mirroring `verification-stamp.cjs`'s `_renderNodes`), `makeSentenceCeiling`/`makeCitationCeiling`/`makeUsefulnessCeiling` (each `composeGuard(makeEgressGuard(EGRESS_PROFILES.<id>), closure)`), `composeGuard`, and `questionSha256` (stable 64-hex sha256 of the canonicalized question object)
- `scripts/jev-response-schema.cjs` ships the zod `JevResponse` (Choice/Noul discriminated union, versioned model regex) and `parseJevResponse(res, expected)`, importing `PINNED_MODEL` from `jev-question-ceilings.cjs`; every failure path (non-200, schema miss, choice outside criteria, probability keys differing, sum off by more than 0.02, missing usage, model drift) returns `{ok: false, reason}` naming the failure, never throws
- `tests/test-355-jev-ceilings.cjs` (14 legs, A through N, 132/132 PASS): profile shapes, guard refusals (model drift, extra/missing state key, extra question id, criteria key outside its list) on all three new profiles, the pre-existing-profiles-unchanged snapshot check, `timeoutMs`/`honorRetryAfter` behavior, `tests/test-356-jev-client.cjs` staying green as a subprocess leg, every ceiling function's refusal/pass behavior, `composeGuard`, `questionSha256`, `parseJevResponse`'s eight outcome branches, and the lib/hooks non-reference sweep. Ends with `installNetGuard().attempts() === 0` -- zero network across the whole run
- Peer contract (Phase 356 D-19) honored in the same commit that creates the two scripts: `jev-question-ceilings` and `jev-response-schema` appended to `HOOKS_BANNED_LEDGER_SCRIPTS` in `tests/test-353-tripwires.cjs`; `node tests/test-353-tripwires.cjs` stays green (5/5)
- `bash tests/run-all-355.sh`: `PASS=31 FAIL=3 SKIP=7` (up from 355-06's `PASS=30 FAIL=3 SKIP=7`; the 3 FAILs are the same three pre-existing documented failures in `deferred-items.md`, none touching a file this plan created or modified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Three additive profiles and two default-off client options (D-55, D-57)** - RED `6c1d4b5dd` (test, combined with Task 2's RED legs -- see Deviations), GREEN `c4d6e4126` (feat)
2. **Task 2: Frozen questions, per-question closure ceilings, response parser (D-44, D-46, AI-SPEC Section 4b)** - GREEN `19d46264e` (feat, includes the `tests/test-353-tripwires.cjs` peer-contract ledger append in the same commit)

**Plan metadata:** committed separately below (docs: complete plan)

## Files Created/Modified

- `scripts/jev-devtime-client.cjs` - three additive `EGRESS_PROFILES` entries, `jev()` `timeoutMs`/`honorRetryAfter`
- `scripts/jev-question-ceilings.cjs` - frozen questions, `renderClaim`, `hopsFromTheoPath`, per-question closure ceilings, `composeGuard`, `questionSha256`
- `scripts/jev-response-schema.cjs` - zod `JevResponse`, `parseJevResponse`
- `tests/test-355-jev-ceilings.cjs` - 132-assertion gate for both tasks
- `tests/fixtures/355/pre-355-07-egress-profiles-snapshot.json` - the four pre-existing profiles' snapshot, captured from HEAD before this plan's edit
- `tests/test-353-tripwires.cjs` - `HOOKS_BANNED_LEDGER_SCRIPTS` gains `jev-question-ceilings`, `jev-response-schema` (peer contract, same commit as the scripts that need it)
- `.planning/ROADMAP.md` - 355-07 row checked, Plans counter 5/28 -> 6/28

## Decisions Made

See key-decisions in frontmatter for the five implementation calls (direction ids from the real module vs the AI-SPEC's placeholders, the non-Framework node rendering rule reused from 355-06, the usefulness-ceiling content-equality lookup design, the additive-diff proof for the shared client file, and the CURRENT-HEAD-not-BASE_355 snapshot point).

## Deviations from Plan

### Auto-fixed Issues

None - both tasks' action steps were followed as written. No Rule 1/2/3 auto-fixes were needed.

### Documented departures from literal task boundary (no functional impact)

**1. [Documented departure] Task 2's RED legs landed in Task 1's RED commit, not a separate one**

- **Found during:** Writing `tests/test-355-jev-ceilings.cjs`
- **Issue:** The plan structures Task 1's RED (profile/client legs) and Task 2's RED (ceilings/schema legs) as separate steps within separate tasks. Writing the full test file once, with both tasks' legs present from the start, was simpler than writing a Task-1-only file and then extending it moments later with no behavior change to the already-written legs in between. The Task 2 legs (G through N) genuinely failed loudly (`FAIL: scripts/jev-question-ceilings.cjs exists`, etc.) from the very first commit until Task 2's GREEN commit landed the two scripts, confirmed by the intermediate run captured between the two commits (see the RED-run transcript above: 87 PASS / 2 FAIL, both FAILs being the two missing-file legs). The RED-before-GREEN discipline held in substance for both tasks; only the git-commit boundary differs from the plan's literal per-task split. This is the same pattern 355-04 documented for the same reason.
- **Why not restructured:** Splitting the test file into a Task-1-only version and a Task-2 diff moments later would add a redundant intermediate commit with no functional difference; the RED failures for Task 2's own legs were real and independently confirmed.
- **Files modified:** `tests/test-355-jev-ceilings.cjs` (one commit, not two)
- **Verification:** `git log --oneline -- tests/test-355-jev-ceilings.cjs scripts/jev-devtime-client.cjs scripts/jev-question-ceilings.cjs scripts/jev-response-schema.cjs` shows `test(355-07)` -> `feat(355-07)` (client) -> `feat(355-07)` (ceilings + schema); the intermediate run between the second and third commits was captured and showed exactly the two Task-2-file-missing FAILs, zero others
- **Committed in:** `6c1d4b5dd` (test), `19d46264e` (feat, makes the Task 2 legs green)

**2. [Documented, out of scope] `lib/core/verification-stamp.cjs` already references `jev-devtime-client` in a comment**

- **Found during:** Verifying the plan's own `grep -rlE "jev-question-ceilings|jev-response-schema|jev-devtime-client" lib hooks` acceptance line
- **Issue:** The grep finds one hit: `lib/core/verification-stamp.cjs:90`, a comment ("n workers pull from ... `pool` [from] `scripts/jev-devtime-client.cjs`'s own `pool`") landed by 355-06 (`d67036f12`), not by this plan. It is a comment, not a `require`, and `verification-stamp.cjs` does not actually import the client.
- **Why not fixed:** `lib/core/verification-stamp.cjs` is 355-06's file, out of this plan's declared `files_modified`, and editing another plan's already-shipped, already-reviewed comment is out of scope. This plan's own new files (`jev-question-ceilings.cjs`, `jev-response-schema.cjs`) are confirmed clean of any `lib/`/`hooks/` reference (`tests/test-355-jev-ceilings.cjs` leg N, which scopes the check to those two script names specifically, passes).
- **Files modified:** none (documented only)
- **Verification:** `grep -n "jev-question-ceilings\|jev-response-schema\|jev-devtime-client" lib/core/verification-stamp.cjs` shows the one comment line; `git log --oneline -1 -- lib/core/verification-stamp.cjs` confirms it predates this plan (`d67036f12`, Phase 355-06)
- **Committed in:** n/a (nothing to commit; documented here)

---

**Total deviations:** 0 auto-fixed; 2 documented (one commit-boundary note matching 355-04's precedent, one pre-existing out-of-scope grep hit from 355-06's own file).
**Impact on plan:** None on this plan's own deliverables - `node tests/test-355-jev-ceilings.cjs` (132/132 PASS), `node tests/test-356-jev-client.cjs` (127/127 PASS), `node tests/test-353-tripwires.cjs` (5/5 PASS), the verify one-liner (three frozen profiles pinned to `jev-1.13.0`), the additive-diff grep (0), the `meaning_bridge|term_collision` grep (0), and the `jev-latest`-outside-comments grep (0) all pass exactly as specified.

## Issues Encountered

None beyond the 3 pre-existing `tests/run-all-355.sh` no-regression-leg failures already logged in `deferred-items.md` by 355-01 (`test-355-direction-agreement.cjs` RED by design until wave 3, `run-all-272.sh`'s `@huggingface/transformers` version gap, `PB8-03` in `part8-egress-guard.cjs`) - none of the three touches a file this plan created or modified.

## User Setup Required

None - no external service configuration required. No vendor key is used or required by this plan; every test drives an offline `fetchImpl`/`installNetGuard()` double.

## Next Phase Readiness

- `scripts/jev-question-ceilings.cjs` and `scripts/jev-response-schema.cjs` are ready for 355-15 (`measure-hsi-thinking-mode.cjs`, the live HSI thinking-mode run against `makeSentenceCeiling`) and 355-26 (`calibrate-citation-check.cjs`/`judge-355-usefulness.cjs`, the citation and usefulness calibration runs against `makeCitationCeiling`/`makeUsefulnessCeiling`) to call with a real dev-time vendor key
- The three new `EGRESS_PROFILES` entries and `jev()`'s `timeoutMs`/`honorRetryAfter` options are live in the shared client for any later 355 script that needs them; no other builder's profile was touched
- No blocker carried forward from this plan; the pre-existing `tests/run-all-355.sh` failures logged in `deferred-items.md` remain exactly as 355-06 left them, untouched by this plan's files. STATE.md was left untouched this run, following 355-06's own precedent: multiple sessions are executing Phases 355/357/358/361 concurrently in this shared tree, and a `state.*` write racing a peer's own write has previously reverted uncommitted peer work in this exact scenario (per the tracked feedback file on two-session tree collisions); `.planning/ROADMAP.md`'s phase-355-scoped checklist row (edited, committed) is the durable progress record for this plan instead

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 created files verified present on disk (`scripts/jev-question-ceilings.cjs`,
`scripts/jev-response-schema.cjs`, `tests/test-355-jev-ceilings.cjs`,
`tests/fixtures/355/pre-355-07-egress-profiles-snapshot.json`); all 4
commits (`6c1d4b5dd`, `c4d6e4126`, `19d46264e`, `cd1a99e74`) verified
present in `git log`.
