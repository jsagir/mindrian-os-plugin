---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - lib/core/mode-select-sidechannel.cjs
  - lib/core/doctor/mode-select-checkpoint-module.cjs
  - data/doctor-modules.json
  - lib/hmi/selector-dispatcher.cjs
  - skills/conversation-mode/SKILL.md
  - skills/larry-personality/SKILL.md
  - scripts/sweep-skill-descriptions.cjs
  - skills/MOSDeckEngine/SKILL.md
  - skills/client-discovery-interview/SKILL.md
  - skills/mullins-scaffold/SKILL.md
  - tests/test-227-mode-select-checkpoint.cjs
  - tests/test-227-frontdoor-restraint.cjs
  - lib/memory/run-feynman-tests.cjs
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 227: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

`lib/core/mode-select-sidechannel.cjs` and `lib/core/doctor/mode-select-checkpoint-module.cjs`
(Requirement 1's core infra) are solid: every fs operation is genuinely wrapped, the doctor
check genuinely never returns anything but `ok`/`warn`, and the doctor's exit-code path
(`scripts/doctor.cjs`) confirms this new `cadence:always, flag:null` module cannot force a
non-zero exit on a bare run or on `--acceptance` (the 7-point checklist is hand-picked and does
not include this module). All shipped 227 tests pass, the skill-description sweep script runs
clean with a working self-test, and the 3 "trivial" description tightenings do not collide with
any test or programmatic string match elsewhere in the repo.

The two producer-side wiring changes that are supposed to make Requirement 1 "observe reality"
(Plan 227-04) both have real gaps, one severe enough to plausibly defeat the whole plan's stated
purpose:

1. The `selector-dispatcher.cjs` "card-fired" recorder is scoped to a literal substring match
   ("brainstorming" + "building something") against text that is never demonstrably rendered by
   any code path for the mode-select gate -- the gate is described only in prose in
   `conversation-mode/SKILL.md`, with no scripted `pickShape('F.1', ...)` call site (unlike
   `commands/ignite.md`'s explicit `call pickShape('F.1')` instructions elsewhere in this same
   repo). There is also zero test coverage proving this specific block ever fires.
2. Mode 3's routing text unconditionally claims "already-established conversational context
   (persona, problem, venture)" to justify bypassing Gate B1, but Mode 3 is directly reachable
   from the Lane Picker's first turn ("Building something" pick, `SKILL.md` line 52) with zero
   prior exploration -- a case the same file's Mode 3 section itself names ("No exploratory
   conversation needed"). The plan's own D-11 justification narrows this to "Mode 3 is reached
   only after conversation-mode's own Mode 2-to-Mode-3 transition," which is not true of the
   Lane Picker's direct third option.

## Critical Issues

### CR-01: Mode 3 routing text assumes established context that may not exist, risking an incorrect Gate B1 bypass

**File:** `skills/conversation-mode/SKILL.md:101-104`
**Issue:** Mode 3's instruction says: "invoke `/mos:ignite --express`, carrying the
already-established conversational context (persona, problem, venture) forward as the blueprint
seed... this Directive path has a determinable role/venture and therefore bypasses Gate B1
entirely." This is only true when Mode 3 is reached via the Mode 2-to-Mode-3 upgrade transition
(where persona/problem have actually been established through conversation). But the same
file's Lane Picker (lines 44-56) offers "Building something" as one of the THREE initial lane
picks available on turn 1 -- a navigator can select it with zero prior exchange. Mode 3's own
body text acknowledges this directly: "No exploratory conversation needed." In that direct-pick
case there is no persona, no problem, no venture established -- the instruction still
unconditionally tells Larry to invoke `--express` and claims a "determinable role/venture,"
which per `commands/ignite.md:97` ("Directive paths with a determinable role/venture (--express
with strong context...) bypass B1") is the wrong precondition for a bypass. The practical
failure mode: Larry either (a) fabricates/asserts a role/venture that does not exist to justify
the bypass, sending `--express` with a near-empty blueprint seed straight to Gate B2 (skipping
the four-door persona pick that Gate B1 exists to run), or (b) the ignite side legitimately
falls back to B1's four-door card anyway because the context is thin, silently contradicting
what this SKILL.md line told Larry to expect. This is exactly the class of gate-bypass defect
this phase's own doctor checkpoint and RCA history (`intern-w1-mode-gate-skip`,
`ignite-frontdoor-bypassed-methodology-overfire`) target -- the fix should not itself introduce
a new bypass-without-basis path.
**Fix:** Branch Mode 3's routing instruction on whether the session actually passed through Mode
2 (i.e. persona/problem/venture were genuinely detected) versus a direct first-turn "Building
something" pick with no prior exchange. In the direct-pick case, either drop the "already
established... determinable role/venture" claim (let ignite's own B1 four-door card run
normally, which is the honest behavior for a cold start) or have Larry ask the one or two
clarifying questions needed to genuinely determine role/venture before invoking `--express`.
Example:
```markdown
## Mode 3: Build a Room

- If this Mode 3 was reached via the Mode 2-to-Mode-3 upgrade transition (persona, problem, and
  venture were established through conversation), invoke /mos:ignite --express, carrying that
  established context forward as the blueprint seed -- ignite's own Gate B1 rule ("Directive
  paths with a determinable role/venture ... bypass B1") applies and the Directive path proceeds
  straight to Gate B2.
- If "Building something" was picked directly at the Lane Picker with no prior conversation,
  there is no established role/venture yet -- invoke /mos:ignite normally and let Gate B1's
  four-door card run (do not claim a bypass that has no basis).
```

### CR-02: The mode-select "card-fired" producer wiring in selector-dispatcher.cjs is unverified and likely unreachable for its stated target

**File:** `lib/hmi/selector-dispatcher.cjs:1101-1133`
**Issue:** This block scopes the `recordLanePick({lane: 'card-fired'})` call to
`result.shape === 'F.1'` AND the joined `zones.header + zones.body` text containing both
`"brainstorming"` and `"building something"` (case-insensitive) -- the exact wording of the Lane
Picker's card text as described in `conversation-mode/SKILL.md`: `"Are we just chatting,
brainstorming, or building something?"`. This substring match can only ever fire if some code
path actually calls `pickShape('F.1', {payload: {header/verbs containing that text,
emitTelemetry: true}, ...})`. Searching the repo for any call site that constructs this text:
  - `conversation-mode/SKILL.md`'s Lane Picker section (lines 44-56) only describes the card in
    prose ("Larry surfaces a Shape F.1 selector... reuse renderShapeF1 / the host primitive")
    with no scripted invocation instruction (no `node -e` snippet, no explicit `call
    pickShape('F.1')` directive) -- unlike this same SKILL.md's own adjacent "default-stated"
    bullet (which DOES give an explicit `node -e "require(...).recordLanePick(...)"` one-liner),
    and unlike `commands/ignite.md:178` ("call `pickShape('F.1')` with the dial now LIVE...")
    which is explicit about the JS call site for its own F.1 gates.
  - `lib/hmi/shape-f1-renderer.cjs`'s default header is the generic
    `'-- mindrianOS -- next move -- pick a verb --'`, not the lane-picker question; nothing
    threads lane-specific verb labels (`Just chatting` / `Brainstorming` / `Building something`)
    through `renderShapeF1`'s `verbs` argument anywhere in the repo.
  - There is zero test coverage: `grep` across `tests/`, `test/`, and `lib/hmi/*.test.cjs` for
    `mode-select-sidechannel` or `recordLanePick` finds only
    `tests/test-227-mode-select-checkpoint.cjs`, which tests the sidechannel/doctor modules in
    isolation and never exercises `selector-dispatcher.cjs`'s new block at all.
  Plan 227-04's own stated purpose was: "without this plan, plan 227-01's sidechannel and doctor
  check exist but nothing ever calls recordLanePick in a real session... This plan is what makes
  Requirement 1 actually observe reality, not just be capable of observing it in a test." If the
  mode-select F.1 card is actually presented by Larry firing the AskUserQuestion tool directly
  from the SKILL.md prose (the SEED-021/SEED-020 convention this codebase uses elsewhere for
  ambient, non-scripted gates), rather than through a JS `pickShape()` call carrying this exact
  text, then this producer never fires for its intended target and the checkpoint continues to
  warn on every session that resolves via the card (only the "default-stated" path, which does
  have an explicit script instruction, would ever record anything) -- the precise "checkpoint
  always reports warn" failure mode the plan says this change fixes.
**Fix:** Either (a) add the missing explicit invocation instruction to `conversation-mode/
SKILL.md`'s Lane Picker section -- a `node -e` or bash snippet that actually calls
`pickShape('F.1', {payload: {header: ..., verbs: [...], emitTelemetry: true}})` so the rendered
text really does flow through `selector-dispatcher.cjs` and trip this substring check, mirroring
the explicit call-out pattern `commands/ignite.md:178` already uses; or (b) if Larry is expected
to fire the card directly via the AskUserQuestion tool without going through `pickShape()`, move
the mode-select "card-fired" recording to wherever that path IS observable (for example a
PostToolUse-style interceptor akin to `check-card-fire.cjs`, which already exists for a related
purpose per `data/doctor-modules.json`'s `card-fire-health` entry), and add a regression test
that actually drives `selector-dispatcher.cjs`'s `pickShape('F.1', ...)` with the lane-picker
text and asserts `mode-select-sidechannel.cjs`'s store gets a `card-fired` record.

## Warnings

### WR-01: doctor checkpoint's `has_user_turn` default ignores an explicitly-provided `session_id`

**File:** `lib/core/doctor/mode-select-checkpoint-module.cjs:71-75`
**Issue:**
```js
const sessionId =
  typeof c.session_id === 'string' && c.session_id.length > 0 ? c.session_id : envSessionId;

const hasUserTurn =
  typeof c.has_user_turn === 'boolean' ? c.has_user_turn : envSessionId.length > 0;
```
`sessionId` correctly falls back through `c.session_id` first, then `envSessionId`. But
`hasUserTurn`'s default re-checks the raw `envSessionId` directly instead of the already-resolved
`sessionId`. If a caller supplies `ctx.session_id` explicitly (a documented "test seam that wins
when explicitly provided" per this file's own docstring) without also supplying
`ctx.has_user_turn`, and `CLAUDE_SESSION_ID` happens to be unset in that process's environment,
`hasUserTurn` silently defaults to `false` and the check short-circuits to `ok` regardless of
whether a lane pick was actually recorded -- even though a session id was explicitly given. The
shipped test suite always passes both fields together (`test-227-mode-select-checkpoint.cjs`
cases a-c), so this gap is not currently exercised, but it is a real inconsistency between the
two "test seam" fields this module documents as independent overrides.
**Fix:** Derive the default from the already-resolved `sessionId`, not the raw env var:
```js
const hasUserTurn =
  typeof c.has_user_turn === 'boolean' ? c.has_user_turn : sessionId.length > 0;
```

### WR-02: Skill-description tightening narrows activation to an explicit trigger list, which may under-fire on equivalent phrasing

**Files:** `skills/MOSDeckEngine/SKILL.md`, `skills/client-discovery-interview/SKILL.md`,
`skills/mullins-scaffold/SKILL.md`
**Issue:** All three fixes correctly close the loose-bypass pattern (confirmed: the sweep
script's own `TIGHT_MARKERS` self-test classifies all three as "tight" post-fix, and no test or
programmatic string match in the repo depends on the old wording). The tradeoff is real, though:
each description now gates on an explicit, closed trigger phrase list (e.g. "pitch deck,
investor presentation, simplify for investors, technical storytelling, demo day, fundraising
deck" for MOSDeckEngine). A semantically equivalent but differently-worded ask -- "can you make
this pitch-ready" or "help me sell this to investors" without the word "deck" or "pitch" -- would
now plausibly fail to trigger where the old looser description might have caught it. This is a
judgment call the plan explicitly delegated to the executor's discretion (per
`sweep-skill-descriptions.cjs`'s own doc comment: "a 'loose' classification alone is a candidate
for a human look, not an automatic verdict"), and the three chosen trigger lists are reasonably
broad, so this is not a blocking defect -- flagging it so the tradeoff is visible rather than
assumed away.
**Fix:** No code change required. Worth a human spot-check against a few realistic paraphrased
asks per skill (not just the literal trigger words) before treating Requirement 2 as fully closed
across future skill-description sweeps of the remaining 120 "loose" skills.

## Info

### IN-01: `data/doctor-modules.json`'s header note is stale relative to its own contents

**File:** `data/doctor-modules.json:2`
**Issue:** The `$schema_note` field still says "SEEDED EMPTY: Plan 03 registers module #1
(umbilical). Do NOT invent organ modules here beyond umbilical..." The registry now carries 15
modules including this phase's new `mode-select-checkpoint` row. This is pre-existing staleness
(not introduced by Phase 227) but the new row makes the drift more visible; a future doc pass
should retire or update that historical seeding note now that the registry is well past its
seeded-empty state.
**Fix:** Update or remove the stale seeding sentence in a future docs/maintenance pass; not
blocking for this phase.

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
