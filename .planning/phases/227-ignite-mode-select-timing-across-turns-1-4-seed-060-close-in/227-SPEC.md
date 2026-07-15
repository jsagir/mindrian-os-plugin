# Phase 227: Ignite / mode-select timing across turns 1-4 (SEED-060) — Specification

**Created:** 2026-07-15
**Ambiguity score:** 0.155 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Close the two remaining open items from `intern-w1-mode-gate-skip.md` (resolved) and
`ignite-frontdoor-bypassed-methodology-overfire.md` (partially-fixed), plus SEED-056's
handed-off ignite-naming gap: give the session-start mode-selection Decision Gate
(Just Talk / Explore+Capture / Build a Room) a structural, advisory-only backstop against
silent skips; sweep methodology skills for the same loose-description auto-fire bypass that
caused the trending-to-absurd over-fire and fix the trivial instances found; prove with a
scripted fixture that the clean ignite-F.1 first-touch (tester Test 4) is restored; and
document, with real Hooked-Model (Fogg B=MAP / TARI) reasoning, why the gate fires when it
does and never as a heavyweight ask.

## Background

Two debug sessions this cycle diagnosed real, confirmed defects in this exact surface:

- `intern-w1-mode-gate-skip.md` (RESOLVED 2026-07-11): the session-start mode-selection gate
  (`skills/conversation-mode/SKILL.md`, `hitl_shape: "F.1"`) was enforced by prose alone. Two
  of three structural gaps were closed (registry now scans `skills/*/SKILL.md`; a
  hasShape+excluded contradiction predicate now fires advisory WARN). The third gap — "give
  the mode-selection gate an actual code-level firing checkpoint... so a silent skip has
  SOMETHING structural to catch, not just prose" — was explicitly deferred to a follow-up
  phase. That follow-up is this phase's Requirement 1.
- `ignite-frontdoor-bypassed-methodology-overfire.md` (partially-fixed 2026-06-24): Larry
  bypassed ignite's clean F.1 front door and reached for `/mos:trending-to-absurd` on a casual
  explore-invitation, imposing an opening compliment and a forced 3-horizon/persona gate.
  FIX 1 (conversational restraint doctrine) and FIX 2 (trending-to-absurd's own trigger
  tightening) landed 2026-06-24. Two items remain, verbatim from the file's own
  `fix_remaining`: "(2) SYSTEMIC sweep: other methodology skills for the same loose-description
  bypass (CIRS R4 no-second-selection-brain); ... (4) re-run tester Test 4 to confirm the clean
  ignite-F.1 first-touch is restored." These are this phase's Requirements 2 and 3.
- SEED-056 (persona-coverage audit) separately confirmed and handed off two related gaps,
  live as of 2026-07-15: `grep -i "ignite" skills/larry-personality/SKILL.md` returns zero
  matches (the gate is never named in Larry's own personality doc, so there is no documented
  reasoning for its timing), and `skills/conversation-mode/SKILL.md` Mode 3 still invokes
  `/mos:new-project` directly instead of routing through ignite's front door. These are
  Requirements 4 and 5.

Hooked-Model audit finding (this session, applied before locking the spec): firing the gate
at turn 1 is the RIGHT timing, but only when framed correctly. The gate is a **Prompt** (Fogg
B=MAP), not an **Investment** — the Hook Model's own sequencing rule ("Investment always AFTER
Reward; never ask for effort before value is delivered") would be violated by a heavyweight
forced ask, but a single-click, 3-4-option lane-pick fired ONLY when the user's opener doesn't
already signal a lane is friction-minimized routing, matching this codebase's own
`detect_dual_path` precedent (infer from signal, ask only when genuinely ambiguous). The actual
defect these debug files describe is not "asks too early" — it's the third failure mode: the
gate neither fires a card NOR states a default, a fully silent skip. Requirement 1's checkpoint
targets exactly that failure mode; Requirement 4's documentation must state this framing, not
generic Hooked-Model name-dropping.

## Requirements

1. **Session-start firing checkpoint (advisory, doctor.cjs class)**: A new `doctor.cjs` check
   class detects whether the mode-selection lane pick was recorded for the current session,
   mirroring the `lib/core/card-fire-sidechannel.cjs` pattern already used elsewhere.
   - Current: no structural signal exists anywhere (not in `data/render-coverage-registry.json`
     card-fire detection, not in any doctor check) that a silent mode-select skip occurred; the
     gate is enforced by prose instruction alone (per `intern-w1-mode-gate-skip.md`'s confirmed
     root cause).
   - Target: a new doctor.cjs module (own registry row in `data/doctor-modules.json`, own runner
     under `lib/core/doctor/`) checks whether a lane-pick record exists for the session; if
     absent, emits an advisory WARN (never blocks, never re-fires the gate itself, never
     escalates to hard-fail) — matching Phase 210's reverted-enforcement pattern, where five
     mechanisms were deliberately walked back from HARD-FAIL/BINDING to advisory/soft-fail.
   - Acceptance: a scripted test simulating a silent skip (no lane-pick record written) shows
     the new doctor check returning `warn`; a scripted test simulating a normal recorded lane
     pick shows the same check returning `ok`; `node scripts/doctor.cjs --all` (or the class's
     own flag) exits 0 in both cases (advisory only, never non-zero on this check alone).

2. **Systemic sweep + trivial fixes (CIRS R4 loose-description bypass)**: Every methodology
   skill is scanned for the same auto-activation pattern that let `trending-to-absurd` bypass
   ignite's F.1 front door before its 2026-06-24 fix (a loose, broadly-matching `description`
   or permissive `sensor_triggers` that fires on casual conversational remarks rather than
   explicit intent).
   - Current: no sweep has been run against the full skill set; `trending-to-absurd` was fixed
     as a single confirmed instance, not as part of a systemic pass.
   - Target: a findings report lists every skill carrying a similarly loose activation pattern.
     Trivial instances are fixed inline within this phase: (a) a one-line `description` or
     `sensor_triggers` tightening to explicit-intent-only (the same shape as
     `trending-to-absurd`'s own FIX 2), and (b) simple in-file orchestrator-level restraint
     additions (e.g. a horizon/persona-gate softening comparable to `trending-to-absurd`'s own
     restraint fix) when the pattern is shallow and self-contained. Anything requiring new code,
     new gates, cross-file changes, or genuine design work is named in the report and explicitly
     deferred, not fixed here — mirroring the precedent in `intern-w1-mode-gate-skip.md`, where
     a related sweep found 55 pre-existing contradictions and only the one named instance was
     resolved in-session.
   - Acceptance: a written findings report (in this phase's directory) lists every skill
     scanned, flags each as `clean` / `fixed-trivial` / `deferred-real-work`, and states the
     fix commit for every `fixed-trivial` entry. Zero skills are silently skipped from the scan.

3. **Scripted regression fixture for tester Test 4**: A deterministic test replays the
   `ignite-frontdoor-bypassed-methodology-overfire.md` Test 4 scenario (an explore-invitation
   in a fresh context) and asserts the fix holds, without requiring a live human tester session.
   - Current: the fix (`FIX 1` + `FIX 2`, commit `7868dfbb`) landed 2026-06-24 with no automated
     regression coverage; verification has only ever been a human tester re-run.
   - Target: a new test file drives the documented Test 4 assertions from the debug file's own
     Section 5: no opening compliment in the first turn; an explore-invitation with no explicit
     methodology ask does NOT invoke `/mos:trending-to-absurd`; it routes to ignite's F.1
     starting gate (or stays in conversation) instead; when `trending-to-absurd` IS explicitly
     invoked elsewhere, it still respects a requested single horizon rather than forcing all
     three (regression floor on FIX 2).
   - Acceptance: the new test file passes (exit 0) against current code, and is registered in
     this phase's own aggregator / `run-feynman-tests.cjs` TEST_FILES so it becomes a permanent
     regression floor, not a one-time check.

4. **Ignite named + Hooked-Model timing reasoning in `larry-personality.md`**: The skill that
   currently never mentions "ignite" gains a section documenting, with the B=MAP/TARI framing
   this session's hooked-model audit produced, why the mode-select gate fires when it does.
   - Current: `grep -i "ignite" skills/larry-personality/SKILL.md` returns zero matches; no
     Hooked-Model (or any other) reasoning exists anywhere for the gate's turn-1-through-4
     timing.
   - Target: a new section in `skills/larry-personality/SKILL.md` (a) names ignite as the front
     door, (b) states the gate is a Fogg **Prompt**, not a Hook Model **Investment** (Investment
     always comes after Reward; a forced heavyweight ask before any value is delivered is the
     anti-pattern), (c) states the ambiguous-vs-already-signaled distinction (fire the card only
     when the user's opener doesn't already signal a lane, matching the existing
     `detect_dual_path` precedent — infer and proceed when the signal is clear), and (d) names
     the silent-skip failure mode (neither a card fires nor a default is stated) as the actual
     defect Requirement 1's checkpoint exists to catch — not "the gate fires too early."
   - Acceptance: `grep -ci "ignite" skills/larry-personality/SKILL.md` > 0; the new section
     contains the Prompt-not-Investment framing, the ambiguous-vs-signaled distinction, and
     names the silent-skip failure mode explicitly (not generic Hooked-Model summary text).

5. **`conversation-mode` Mode 3 routes through ignite**: Mode 3 (Build a Room) stops calling
   `/mos:new-project` directly and routes through ignite's front door instead, written with a
   light seam for a future Phase 223 entry point without adding any speculative 223 code.
   - Current: `skills/conversation-mode/SKILL.md` Mode 3 invokes `/mos:new-project` directly
     (confirmed live, line ~52/97 area); ignite's F.1 gate is bypassed for this path entirely.
   - Target: Mode 3 routes through ignite's existing F.1 starting gate instead of calling
     `/mos:new-project` directly. The routing point is written generically enough (e.g. a single
     named entry function/step, not new-project-specific branching baked in) that a future
     Phase 223 surface could register as an additional destination without requiring this
     phase's code to be reworked — but no 223-specific branch, flag, or reference is added now
     (223 has zero confirmed "ignite" surface today per `grep -i "ignite"` across
     `223-SPEC.md`/`223-BUILD-BRIEF.md`).
   - Acceptance: `grep "new-project" skills/conversation-mode/SKILL.md` no longer shows a direct
     Mode-3 invocation bypassing ignite; a scripted or manual trace of Mode 3 confirms it enters
     through ignite's F.1 gate; `commands/ignite.md`'s existing Gate B1 (three clean options +
     free-text) is unmodified and still the single front door.

## Boundaries

**In scope:**
- A new advisory-only doctor.cjs check class for the mode-select firing checkpoint (Req 1).
- A full sweep of methodology skills for the CIRS R4 loose-description bypass pattern, with
  trivial fixes (one-line description/frontmatter tightening, simple in-file orchestrator
  restraint) applied inline (Req 2).
- A scripted regression fixture proving Test 4's fix holds, registered as a permanent test
  (Req 3).
- Naming ignite and documenting real Hooked-Model timing reasoning in `larry-personality.md`
  (Req 4).
- Routing `conversation-mode` Mode 3 through ignite instead of calling `/mos:new-project`
  directly, with a light architectural seam for a future 223 entry point (Req 5).

**Out of scope:**
- Fixing every skill the sweep finds, regardless of complexity — anything beyond a one-line
  description/frontmatter edit or a simple in-file restraint addition is reported and deferred
  to its own follow-up phase or seed, not fixed here (mirrors the 55-instance precedent from
  `intern-w1-mode-gate-skip.md`).
- A live human-tester re-run of Test 4 — Requirement 3 is satisfied by a scripted fixture; no
  human-verify checkpoint is required to close this phase.
- Any code, branch, flag, or reference specific to Phase 223's not-yet-existing ignite surface
  — 223 has zero confirmed "ignite" mentions today; building toward it now would be speculative
  design against an ungrounded target. Only a generic, reusable seam is permitted (Req 5).
- Escalating the new firing-checkpoint (Req 1) or the sweep's contradiction predicate beyond
  advisory WARN — Phase 210 deliberately reverted five HARD-FAIL/BINDING mechanisms to
  advisory/soft-fail/score-only; this phase must not reintroduce a new blocking gate in the
  same family.
- The parked Brain pedagogy write (`14-BRAIN-PEDAGOGY-WRITE.md`, needs an admin/write key) named
  as a non-code follow-up in `ignite-frontdoor-bypassed-methodology-overfire.md` — explicitly a
  separate, credentialed task, not this phase's scope.
- `orchestrator.cjs`'s code-level "honor the chosen horizon" fix (item 1 in the same debug
  file's `fix_remaining`) — that item was not carried into this phase's ROADMAP scope
  (confirmed: only items 2 and 4 are named) and stays open for its own pickup.

## Constraints

- **Advisory-only, never hard-fail.** Every new detection mechanism this phase adds (the
  firing checkpoint, any sweep-driven predicate) must ship as advisory WARN, matching Phase
  210's reverted-enforcement pattern. No `--strict`-only escape hatch is required, but none of
  this phase's new checks may exit non-zero on their own by default.
- **No em-dashes** anywhere in touched files (standing repo-wide rule).
- **CJS only**, no TypeScript, `process.argv` switch-case for any new CLI surface (standing repo
  convention, per `doctor.cjs`'s own extension architecture: one registry row + one runner file,
  no script-body edits).
- **Zero Brain egress.** All work in this phase is LOCAL-only (skill docs, doctor checks, test
  fixtures, routing fixes) — no Brain MCP calls, no user-content egress (Canon Part 8).
- **Hooked-Model framing constraint (Req 4).** The documented reasoning must use the
  Prompt-vs-Investment distinction and the ambiguous-vs-signaled routing rule established by
  this session's hooked-model audit — not a generic restatement of the Hook Model's four
  phases with no connection to this specific gate's design.

## Acceptance Criteria

- [ ] `node scripts/doctor.cjs` (with whatever flag the new class registers under) reports
      `warn` on a scripted silent-skip fixture and `ok` on a scripted normal-recording fixture;
      exits 0 in both cases.
- [ ] A written sweep findings report exists in this phase's directory, covers every methodology
      skill, classifies each `clean` / `fixed-trivial` / `deferred-real-work`, and every
      `fixed-trivial` entry cites its fix commit.
- [ ] A new scripted test replaying tester Test 4's scenario passes (exit 0) and is registered
      in this phase's test aggregator / `run-feynman-tests.cjs` TEST_FILES.
- [ ] `grep -ci "ignite" skills/larry-personality/SKILL.md` > 0, and the new section states the
      Prompt-not-Investment framing, the ambiguous-vs-signaled distinction, and the silent-skip
      failure mode by name.
- [ ] `skills/conversation-mode/SKILL.md` Mode 3 no longer calls `/mos:new-project` directly;
      it routes through ignite's existing F.1 gate; `commands/ignite.md` Gate B1 is unmodified.
- [ ] No new hard-fail / blocking gate introduced anywhere in this phase's changes (advisory
      WARN only, consistent with Phase 210).
- [ ] Zero em-dashes in any file this phase touches.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|---------------------|-------|------|--------|------------------------------------|
| Goal Clarity        | 0.90  | 0.75 | OK     | 5 concrete deliverables, each with current/target already grounded in confirmed-live code reads |
| Boundary Clarity    | 0.80  | 0.70 | OK     | Sweep fix-vs-defer bar, Test-4 verification method, and 223-anticipation boundary all locked by interview |
| Constraint Clarity  | 0.85  | 0.65 | OK     | Phase 210 advisory-only constraint is explicit and non-negotiable; hooked-model framing constrains Req 4's content |
| Acceptance Criteria | 0.80  | 0.70 | OK     | Every requirement has a pass/fail check; doctor-check acceptance grounded in the doctor.cjs module contract (check/fix pair + registry row) |
| **Ambiguity**       | 0.155 | <=0.20| OK    | Gate passed after 2 interview rounds + 1 hooked-model audit pass |

Status: OK = met minimum on all 4 dimensions; gate passed.

## Interview Log

| Round | Perspective              | Question summary                                                                 | Decision locked                                                                 |
|-------|---------------------------|-----------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| 1     | Boundary Keeper / Simplifier | Sweep scope: report-only vs. fix-everything vs. fix-trivial-inline               | Report + fix trivial cases inline (one-line description edits + simple orchestrator restraint) |
| 1     | Boundary Keeper           | Test 4 verification: scripted fixture vs. human-verify checkpoint vs. both        | Scripted regression fixture only, no human session required                     |
| 1     | Boundary Keeper           | Should 227 build anything speculative toward Phase 223's not-yet-existing ignite surface | Design with a light 223 seam (generic entry point), no speculative 223-specific code |
| 2     | Failure Analyst            | What exactly counts as PASS for the new firing-checkpoint hook                    | Wire into doctor.cjs as a new check class (not a bare standalone hook)          |
| 2     | Failure Analyst            | What counts as "trivial" for the sweep's inline-fix bar                           | Extends to simple in-file orchestrator-level restraint additions, not description-only |
| —     | Hooked-Model audit (`/hooked-model` skill, explicit request) | Does turn-1 gate timing violate Investment-before-Reward; what should the documented reasoning say | Turn-1 firing is correct when framed as a Prompt (not Investment), fired only on genuine ambiguity; the real defect is the silent-skip failure mode, not gate timing — this framing is now Req 4's acceptance bar |

---

*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Spec created: 2026-07-15*
*Next step: /gsd-discuss-phase 227 — implementation decisions (how to build what's specified above)*
