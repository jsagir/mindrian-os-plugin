---
kind: seed
status: open
severity: high
created: 2026-07-14
canon_parts: [3, 10, 11, 12]
related: [SEED-056 (Larry behavior contract -- sibling: 056 is mid-conversation engine-reach timing, this seed is session-BOOTSTRAPPING timing, first 1-4 turns specifically, deliberately kept separate rather than folded in), SEED-059 (fallback-disclosure convention -- Site 1's "gate-firing inconsistent catch rate" finding is THE SAME underlying gap this seed's Turn-1 fix targets, see below), SEED-021 (F.7-max atomic render coupling -- adjacent, narrower scope)]
proving_case: "Two independently-filed RCAs this repo already has, cross-referenced here rather than duplicated: .planning/debug/resolved/intern-w1-mode-gate-skip.md (session-start mode-selection gate, RESOLVED for detection, prose-enforcement gap remains) and .planning/debug/ignite-frontdoor-bypassed-methodology-overfire.md (PARTIALLY FIXED, 4 remaining items). Plus the interns-homework-tracker's David session (2026-07-14): B2 blueprint gate fired 'only after 3 rounds of build a new room -- should have fired on the first substantive answer.'"
source: "navigator-directed 2026-07-14: 'look at interns convo, we need to add to larry behavior when to invoke ignite, mainly in the early first 1-4 turns. also remember and utilize the hooked skill to figure out how and in what context and what shapes.' Hooked Model skill invoked directly (Trigger/Action/Variable-Reward/Investment + Fogg B=MAP) as the navigator explicitly requested, per the standing HARD RULE that the Hooked Model is the mandatory design lens for the first step of any Mindrian surface."
---

# SEED-060: Ignite / mode-select timing across turns 1-4, Hooked-Model-grounded

## Why this is a separate seed, not folded into SEED-056

SEED-056 is about mid-conversation "dark capability" -- Larry's persona not knowing WHEN to
reach for a shipped ENGINE (219/220/221, eureka) once a room exists and a conversation is
underway. This seed is about SESSION BOOTSTRAPPING -- the first 1-4 turns, before or right as
a room comes into existence, where the question is not "which engine" but "which lane, and
when does the ask-for-structure moment arrive." Different failure surface, different fix
targets (`skills/conversation-mode/SKILL.md`, `commands/ignite.md`'s gate sequencing, NOT
`lib/core/bono/*` or the eureka engine). Keeping them separate avoids SEED-056 becoming an
unfocused catch-all for "anything about Larry's behavior," which this session has already
broadened once (the eureka addition) and should not broaden indefinitely.

## What already exists (verified this session, do not re-diagnose)

Two real RCAs already cover large parts of this territory. Read them before touching any
code -- this seed's job is to connect them, apply the Hooked Model lens the navigator asked
for, and name what's STILL open, not to re-derive either from scratch.

1. **`.planning/debug/resolved/intern-w1-mode-gate-skip.md`** -- the Turn-1 mode-selection
   gate (Just Talk / Explore+Capture / Build a Room, `skills/conversation-mode/SKILL.md`,
   `hitl_shape: F.1`) was found completely invisible to enforcement: it never registered in
   `render-coverage-registry.json` (skills weren't scanned), a CI contradiction predicate was
   self-disabled by the SAME `connector.excluded:true` flag that also blocks registration, and
   the Stop-hook backstop only catches gate-SHAPED TEXT -- a fully silent skip (Larry
   proceeding straight into conversation with nothing gate-shaped to pattern-match) produces
   no signal at either layer. **RESOLVED**: registry-scan gap closed (skills now register),
   CI contradiction predicate added (advisory WARN). **NOT resolved, explicitly named as
   future work in that file's own candidate fix #3**: "Give the mode-selection gate an actual
   code-level firing checkpoint... so a silent skip has SOMETHING structural to catch, not
   just prose." This is still true today -- the gate can still be silently skipped at runtime;
   only its DECLARATION is now checkable, not its actual per-session firing.

2. **`.planning/debug/ignite-frontdoor-bypassed-methodology-overfire.md`** -- status
   `partially-fixed`. Root cause: Larry (prompt-level routing, not an engine auto-fire)
   bypassed ignite's clean F.1 front door and reached for a heavy methodology orchestrator
   (`/mos:trending-to-absurd`) on a casual explore-invitation, imposing a persona gate + 3
   forced horizons the student had to wave away. `fix_landed` closed the specific
   trending-to-absurd trigger looseness and added `conversation-mode` Mode 2's
   "scaffold-follows-learner" doctrine (confirmed present, read directly this session:
   `skills/conversation-mode/SKILL.md:92`, "Reach for a methodology only once the navigator's
   own moves have surfaced a specific, named thing they explicitly want a tool applied to").
   **`fix_remaining` (verbatim, still open as of this seed's filing):** (1) orchestrator
   code-level honor-the-chosen-horizon; (2) a SYSTEMIC sweep for the same loose-description
   bypass across OTHER methodology skills, not just trending-to-absurd; (3) the parked Brain
   pedagogy write; (4) re-run the tester's Test 4 to confirm the clean ignite-F.1 first-touch
   is actually restored end to end.

3. **`skills/larry-personality/SKILL.md` (448 lines, grepped in full this session): zero
   mentions of "ignite," "B2," or the mode-selection gate by name.** Same dark-capability
   shape as SEED-056's eureka finding, a third confirmed instance of the same pattern this
   session keeps finding: real, shipped, even partially-fixed machinery that Larry's own
   top-level persona contract never names.

## The Hooked Model lens, applied (navigator-requested, `hooked-model` skill invoked directly)

**Trigger.** Turn 1 has no classic external trigger (no push/email bringing a returning user
back) -- this is cold-start, which the Hooked Model itself is honestly not built for (it
audits RETENTION loops). The useful translation for a FIRST session: the navigator's own
opening utterance IS the trigger event, and Larry's job is to read it as a lane signal
(matching what `conversation-mode/SKILL.md`'s F.1 lane picker already does correctly when it
fires). The LONGER-ARC internal trigger MindrianOS wants to own, stated in Larry's own voice
elsewhere in this codebase, is "a stuck decision -> I open Larry." Turns 1-4 are where that
internal trigger either starts forming or gets damaged, disproportionate to their small
number.

**Action (B=MAP).** A first-time navigator has maximum uncertainty and near-zero invested
context -- Ability must be maximized (low brain-cycles, low non-routine-ness) BEFORE
Motivation can be assumed. The F.1 lane picker (3 options, one line each) is correctly
designed for this. The failure modes found in real evidence are NOT design failures of the
gate itself, they are PROMPT-timing failures around it: Intern-1's session shows the prompt
never appearing at all (zero Ability cost paid because the cue never arrived); David's session
shows the B2 blueprint prompt arriving LATE (after 3 rounds of restating "build a new room"),
which is an Ability failure of a different kind -- forcing repeated, non-routine effort
(re-explaining yourself to a tool that should have already understood) before the actual
low-cost action (answering the gate) becomes available.

**Variable Reward.** A correctly-timed gate IS itself a small Hunt-type reward -- "it
understood me, it's already offering the right next move" (this is close to verbatim what
Intern-4's session praised: "recognized her 'undecided' state, offered side-by-side
comparison"). A skipped or late gate is not neutral, it is a NEGATIVE signal -- David's own
Part-A read ("commands felt like real actions") coexisted with a Part-B report showing the B2
gate fired late and the closing Eureka gate skipped entirely; the human-side read was
generous, but the actual first-touch experience was measurably worse than it could have been.
This is the mechanism by which mistimed early gates work directly against the internal-trigger
formation the product depends on for retention -- not a minor UX nit.

**Investment.** Answering the lane pick or the B2 blueprint gate is a real navigator
investment (committing to a mode, or providing room-defining information), and per the
Hooked Model's own house rule, **investment must come AFTER reward, never before.** This is
the precise, evidence-grounded reason ignite-frontdoor-bypass's root cause was actually
harmful, not just stylistic: reaching for a heavy methodology orchestrator (persona gate + 3
forced horizons) on a casual remark asks for investment before any reward has been delivered
-- exactly the anti-pattern the Hooked Model skill's own "Common Mistakes" table names
("Investment before reward -- users haven't received value; resist effort"). Conversely, B2
firing on the FIRST substantive answer (not the 4th restatement) is investment arriving
exactly when a reward (being understood) should already have landed.

## What this seed proposes (NOT a phase yet -- scoping input only)

1. **Close mode-gate-skip's own named remaining item**: a code-level firing checkpoint for
   the Turn-1 lane pick (candidate fix #3 in that RCA, still open). This is the SAME shape of
   fix as SEED-059's fallback-disclosure convention -- "did the expected structural event
   happen, and if not, say so" -- applied to the mode-selection gate specifically rather than
   Phase 222's weight-state read. Whoever picks up SEED-059's general convention should
   treat this as its first concrete instance, or build them together.
2. **Close ignite-frontdoor-bypass's remaining items 2 and 4** specifically (the systemic
   sweep for other methodology skills with the same loose-trigger bypass risk, and the
   tester re-run confirming the fix holds) -- items 1 and 3 are narrower/separately owned
   (orchestrator horizon-honoring, the parked Brain pedagogy write) and not blocking for
   this seed's purpose.
3. **Add ignite, the B2 gate, and the mode-selection lane picker by name to
   `skills/larry-personality/SKILL.md`**, with the Hooked-Model timing reasoning above: fire
   the lane pick on turn 1 (or explicitly state a default and why, never silent), stay
   conversational through Explore+Capture per the already-fixed scaffold-follows-learner
   doctrine, and fire B2 on the FIRST substantive room-defining answer, not after repeated
   restatement.
4. **Behavioral acceptance target, directly testable**: a fixture session where the
   navigator's first message is unambiguous (a real venture description, not a blank "hi")
   should reach a B2-equivalent gate within that SAME turn or the very next one, not after
   3 rounds of the navigator repeating themselves -- this is the concrete, numeric version of
   "mainly the early first 1-4 turns."

## What Could Make This Seed Die

- If items 2 and 4 of ignite-frontdoor-bypass's own remaining work, once closed, turn out to
  already fully cover the B2-timing-lateness failure mode David's session showed -- i.e., if
  the systemic sweep + tester re-confirmation already catches this without new persona prose.
- If a code-level firing checkpoint for Turn-1 (item 1 above) is judged not worth building
  before SEED-059's general convention exists in some concrete form -- in that case this
  seed's item 1 folds into whichever phase builds SEED-059, rather than shipping twice.

## Provenance

Filed 2026-07-14, navigator-directed, same session as SEED-056's eureka broadening, SEED-059's
filing, and Phase 222's plan-phase work. Synthesizes two pre-existing RCAs (one resolved, one
partially-fixed) plus this week's interns-homework-tracker evidence plus a direct invocation
of this repo's own `hooked-model` skill, per the standing HARD RULE that the Hooked Model is
the mandatory lens for any Mindrian surface's first step.
