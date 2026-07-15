---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
fixed_at: 2026-07-15T22:41:31Z
review_path: .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 227: Code Review Fix Report

**Fixed at:** 2026-07-15T22:41:31Z
**Source review:** .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical_warning): 4 (CR-01, CR-02, WR-01, WR-02)
- Fixed: 3 (CR-01, CR-02, WR-01)
- Skipped (accepted, no code change per review's own judgment): 1 (WR-02)
- Out of scope (Info tier, not attempted): 1 (IN-01)

Both CRITICAL findings traced to design decisions made during this phase's own
discuss-phase, not implementation slips -- the actual logic was fixed, not just
the symptom, per the explicit guidance for this fix run.

## Fixed Issues

### CR-01: Mode 3 routing text assumes established context that may not exist, risking an incorrect Gate B1 bypass

**Files modified:** `skills/conversation-mode/SKILL.md`
**Commit:** 4e86d44f
**Applied fix:** Branched Mode 3's routing instruction on how the mode was actually
reached. When Mode 3 is reached via the Mode 2-to-Mode-3 upgrade transition (persona,
problem, venture genuinely established through conversation), the instruction still
invokes `/mos:ignite --express` and claims the Gate B1 bypass -- that basis is real.
When "Building something" is picked directly at the Lane Picker with no prior
conversation, the instruction now invokes `/mos:ignite` normally (no `--express`) and
explicitly says not to claim a bypass that has no basis, letting Gate B1's own
four-door card run -- the honest cold-start behavior. Applied close to the review's
own suggested fix text.

**Verification:** Tier 1 (re-read, isolated 2-line diff, no corruption) + Tier 3
(prose instruction file, no syntax checker applicable; behavior is a routing branch
in Larry's own instructions, not machine-testable code).

**Status note:** This is a logic/routing branch in behavioral instructions (not
executable code), so it is flagged `fixed: requires human verification` -- the branch
condition is correct per the review's own analysis and mirrors ignite.md's documented
Gate B1 rule, but only live session behavior can fully confirm Larry follows the
branch correctly in practice.

### CR-02: The mode-select "card-fired" producer wiring in selector-dispatcher.cjs is unverified and likely unreachable for its stated target

**Files modified:** `skills/conversation-mode/SKILL.md`, `tests/test-227-mode-select-checkpoint.cjs`
**Commit:** 875e4e08
**Applied fix:** Applied fix option (a) from the review. Added an explicit `node -e`
invocation instruction to the Lane Picker section that calls
`pickShape('F.1', {payload: {header, verbs, emitTelemetry: true}})` with the exact
lane-picker card text ("Are we just chatting, brainstorming, or building
something?"), mirroring the same file's own adjacent "default-stated" `node -e`
bullet and `commands/ignite.md:178`'s explicit `pickShape('F.1')` convention. Read
`selector-dispatcher.cjs`'s `pickShape` signature/JSDoc (around line 55) and the
`dispatchShapeFSubShape` F.1 branch (payload.header/payload.verbs threading into
`renderShapeF1`) before writing the instruction, confirming the payload shape
genuinely trips the existing subject-text scoping check (both "brainstorming" and
"building something" present in header+body, case-insensitive).

Added regression test `(f)` to `tests/test-227-mode-select-checkpoint.cjs` that
drives `selector-dispatcher.cjs`'s `pickShape('F.1', ...)` end-to-end with the
lane-picker text and asserts `mode-select-sidechannel.cjs`'s store gets a
`card-fired` record (via the `MODE_SELECT_SIDECHANNEL_PATH` test seam, since the
producer call site has no sessionId in scope and records under `NO_SESSION_KEY`).

**Verification:** Tier 1 (re-read, clean diff) + functional verification: manually
ran the exact `node -e` snippet from the SKILL.md instruction against the real
`pickShape` export before committing, confirmed the rendered header/body actually
contains both required substrings and that `mode-select-sidechannel.cjs`'s store
received a `card-fired` record. Then ran `node tests/test-227-mode-select-checkpoint.cjs`
-- all 7 assertions (including new test `(f)`) pass.

### WR-01: doctor checkpoint's `has_user_turn` default ignores an explicitly-provided `session_id`

**Files modified:** `lib/core/doctor/mode-select-checkpoint-module.cjs`, `tests/test-227-mode-select-checkpoint.cjs`
**Commit:** 720588fd
**Applied fix:** Applied the review's exact one-line diff -- `hasUserTurn`'s default
now derives from the already-resolved `sessionId` (`c.session_id` first, `envSessionId`
fallback) instead of re-checking the raw `envSessionId` directly.

Extended `tests/test-227-mode-select-checkpoint.cjs` with regression test `(g)`:
an explicit `ctx.session_id` with no `ctx.has_user_turn` and `CLAUDE_SESSION_ID`
unset must default `has_user_turn` to `true` and warn on a silent skip (not
short-circuit to `ok`). Confirmed the test catches the regression by temporarily
reverting the fix and re-running -- test `(g)` failed with `actual: 'ok', expected:
'warn'` on the pre-fix code, then re-applied the fix and confirmed all 8 assertions
pass.

**Verification:** Tier 1 (re-read) + Tier 2 (`node -c` syntax check passed) +
functional regression proof (test fails pre-fix, passes post-fix).

## Skipped Issues (reviewed and accepted, no code change)

### WR-02: Skill-description tightening narrows activation to an explicit trigger list, which may under-fire on equivalent phrasing

**Files:** `skills/MOSDeckEngine/SKILL.md`, `skills/client-discovery-interview/SKILL.md`, `skills/mullins-scaffold/SKILL.md`
**Reason:** No code change required per the review's own verdict -- this is a
judgment-call tradeoff the plan explicitly delegated to executor discretion
(`sweep-skill-descriptions.cjs`'s own doc comment: "a 'loose' classification alone
is a candidate for a human look, not an automatic verdict"). The review confirms all
three trigger lists are reasonably broad and no test or programmatic string match in
the repo depends on the old wording. Not touched, per explicit instruction. Worth a
future human spot-check against paraphrased asks before treating Requirement 2 as
fully closed across the remaining 120 "loose" skills (per the review's own fix note).

## Out of Scope

### IN-01: `data/doctor-modules.json`'s header note is stale relative to its own contents

**File:** `data/doctor-modules.json:2`
**Reason:** Info-tier finding, outside `fix_scope: critical_warning` for this run.
Not attempted per explicit instruction. Pre-existing staleness (not introduced by
Phase 227); the review itself marks it not blocking.

## Test Verification

Both required test suites, plus the newly-extended checkpoint test, pass after all
fixes:

- `node tests/test-227-mode-select-checkpoint.cjs` -- 8/8 assertions pass (2 new:
  `(f)` CR-02 producer wiring, `(g)` WR-01 regression).
- `node tests/test-227-frontdoor-restraint.cjs` -- 4/4 assertions pass.

Adjacent selector-dispatcher suites re-run as a sanity check (not required by scope,
but touched code borders selector-dispatcher.cjs's F.1 dispatch path):

- `node tests/test-doctor-module-contract-parity.cjs` -- pass (all 15 registry
  modules pass the 9-rule contract).
- `node --test tests/test-selector-dispatcher.cjs` -- 9/9 pass.
- `node --test tests/test-selector-dispatcher-88-2-04.cjs` -- 19/19 pass.
- `node --test tests/test-selector-dispatcher-88-2-05.cjs` -- pass, 0 failures.
- `node --test tests/test-selector-dispatcher-88-2-06.cjs` -- pass, 0 failures.
- `node --test tests/test-selector-dispatcher-120-01.cjs` -- 1 pre-existing failure
  (`T1: F_SUBSHAPES contains F.7 as the 8th entry`, expects array length 9, actual
  11 -- a stale assertion from before F.0/F.8/F.9 were added to `F_SUBSHAPES`).
  Confirmed this failure is NOT caused by this fix run: reproduced the identical
  failure against commit `deb08556` (the pre-fix state, before any of this run's
  commits) with the exact same expected/actual values. Pre-existing, out of scope
  for this review-fix pass.

## Notes

- No em-dashes used anywhere in this report or in any edited file (verified via
  `grep` after each edit).
- All three fix commits are on `gsd-reviewfix/227-<pid>` in an isolated git worktree
  and will be fast-forwarded into `main` by the cleanup tail.
- A stray line-ending-only diff on `references/personality/pws-lexicon-full.md`
  (CRLF -> LF) was observed in the worktree, unrelated to any finding in this
  review and never staged or committed by this run.

---

_Fixed: 2026-07-15T22:41:31Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
