---
kind: rca
slug: ignite-frontdoor-bypassed-methodology-overfire
title: "Larry bypasses ignite's F.1 front door and over-fires a methodology orchestrator on an explore-invitation"
created: 2026-06-24
severity: HIGH
status: partially-fixed
classification: NEW FAILURE (regression)
introduced_in: "v1.14.0-beta.3 (2026-06-19, commit b526d20a) - Phase 163 shipped /mos:trending-to-absurd with a loose auto-activating description. Latent from beta.3 onward (present in beta.7 AND beta.9). Run 1 (clean) was v1.13.1, BEFORE the skill existed. beta.9 (Phase 177 Wave 1: dial/HUD/persona-prior) is NOT the cause - orthogonal plumbing, never touched skill activation. The bad run surfaced on beta.9 = the build now finalized to stable 1.14.0, so the regression is LIVE to all users until the fix ships in 1.15.0 (navigator chose roll-into-1.15.0, no hotfix)."
fix_landed: "7868dfbb (2026-06-24) - activation + doctrine: trending-to-absurd description tightened to explicit-intent-only (closes the native skill-auto-loader bypass of the governed CIRS path); When-does-NOT-activate restraint + follow-the-learner-on-horizons + no-compliment; conversation-mode Mode 2 scaffold-follows-learner."
fix_remaining: "(1) orchestrator.cjs code-level honor-the-chosen-horizon (stop mechanically forcing near/mid/long); (2) SYSTEMIC sweep: other methodology skills for the same loose-description bypass (CIRS R4 no-second-selection-brain); (3) land the parked Brain pedagogy write (needs admin key) for the prose no-compliment principle; (4) re-run tester Test 4 to confirm the clean ignite-F.1 first-touch is restored."
canon_parts: [3, 7, 10]
related: 177-larry-behavioral-channel (engine-side enabler; NOT the fix for this defect)
---

# RCA: Ignite front door bypassed + methodology over-fire

## 1. Summary

A tester running a learning-efficiency exploration (Test 4, A/B pre-update vs post-update)
documented a regression: post-update, Larry (a) opened with a compliment, (b) reached for
`/mos:trending-to-absurd` as the FIRST move on an explore-invitation, and (c) imposed a
persona gate + three time horizons the student had to wave away. The pre-update run was
cleaner: no methodology named, the student's questions built the decomposition hierarchy,
and the depth gate fired naturally. Tester's synthesis: "the scaffold must follow the
learner, not the other way around" - the first run followed the learner, the second
followed the tool.

## 2. Root cause (CONFIRMED against live code, not inferred)

The failure is NOT an engine auto-fire and NOT a broken ignite gate. Three grounded facts:

- `commands/ignite.md` Gate B1 (Starting Point) is correctly designed: it calls
  `pickShape('F.1')` with three clean options (solution-looking-for-problem /
  domain-or-interest-to-explore / defined-venture) + free-text, on the runChain spine
  (ignite.md:70-91). It references trending-to-absurd NOWHERE.
- `skills/trending-to-absurd/SKILL.md` connector carries `sensor_triggers: []`
  (SKILL.md:23) - it does NOT auto-fire from the navigation engine. The engine cannot and
  did not force it from a casual "cool opportunities" remark.
- Therefore Larry-THE-MODEL reached for `/mos:trending-to-absurd` by conversational
  discretion (prompt-level routing), bypassing ignite's clean F.1 front door. Once invoked,
  its orchestrator (`lib/core/trending-to-absurd/orchestrator.cjs` TREND_HORIZON_SPEC,
  near/mid/long, :87-92) generated all three horizons, and the skill's own gate imposed the
  persona/path selection.

Meta-cause: v1.14.0 shipped the ASSERTIVE surfaces (the trending-to-absurd harness, Phase
163) ahead of the RESTRAINT mechanism (Phase 177's behavioral channel, Waves 4-5, gated
behind BCH-CAL). The cure lags the disease. Pre-update Larry stayed conversational because
he had fewer assertive tools to grab.

## 3. Scope and Impact

- Surfaces: the conversational first-touch (Part 10) + `/mos:trending-to-absurd` skill +
  `/mos:ignite` front-door routing.
- Personas hit hardest: Student (the tester's case) - exploration arrivals where the right
  move is to stay in conversation and let decomposition emerge.
- Blast radius: any explore-invitation ("cool opportunities here", "what's interesting in
  X", a domain remark) risks being railroaded onto a methodology orchestrator.
- NOT fixed by Phase 177's waves: 177 governs what the ENGINE fires; this is model-prose
  routing + a skill orchestrator over-asserting. 177 is the engine-side enabler for OTHER
  cases (engine over-fire), not this one.

## 4. Required Code Changes (two fixes, both independent of the gated 177 waves)

FIX 1 - Larry conversational restraint (the pedagogy contract).
- Targets: `skills/mos/conversation-mode/SKILL.md`, `skills/mos/larry-personality/SKILL.md`,
  `agents/larry-extended.md` (the routing-discretion doctrine).
- Change: on an explore-invitation with no explicit methodology ask, DO NOT open a
  methodology orchestrator. If no room exists, route through ignite's F.1 starting gate
  (option 2, domain-or-interest-to-explore). If a room exists, stay in conversation and let
  decomposition emerge from the student's questions (their moves become the structure). No
  opening compliment (amplify the pivot, do not applaud it).
- Companion: land the parked Brain pedagogy write (14-BRAIN-PEDAGOGY-WRITE.md; needs an
  admin/write key) so the no-compliment / meet-with-material / follow-the-learner principles
  live in the teaching graph.

FIX 2 - trending-to-absurd restraint.
- Targets: `skills/trending-to-absurd/SKILL.md` (trigger doctrine) +
  `lib/core/trending-to-absurd/orchestrator.cjs` (horizon + persona gate).
- Change: the skill activates ONLY on an explicit "push this to the absurd / extreme"
  intent, not on a casual opportunity remark. When it does fire, follow the learner on
  horizons - ask or default to the navigator's requested horizon (near-only when that is all
  they want) instead of forcing all three; collapse the persona/path gate to a single
  optional, skippable prompt (or drop it for the conversational path).

## 5. Tests (how to verify the fix)

- Behavior: an explore-invitation in a fresh context routes to ignite's F.1 starting gate
  (or stays in conversation), and does NOT invoke `/mos:trending-to-absurd`.
- Behavior: `/mos:trending-to-absurd` fires only on explicit absurd/extreme intent.
- Behavior: when it fires, horizons follow the navigator's ask (near-only is honored), not
  all three forced.
- Behavior: no opening compliment in the first turn.
- Regression: ignite B1 F.1 still renders its 3 clean options; the frozen 6 reaches / 3
  postures untouched; no Brain egress (Part 8).
- Calibration: this exact tester run ("student says cool opportunities -> Larry fires
  trending-to-absurd -> student rejects it") is the canonical labeled mis-fire for the
  Phase 177 BCH-04 shadow log / BCH-CAL set.

## 6. Non-code follow-ups

- The Phase 163 trending-to-absurd UX (persona gate + 3 horizons) is a design-debt candidate
  for its own small phase if FIX 2's restraint is not enough.
- Confirm with the tester (re-run Test 4) that the clean ignite-F.1 first-touch is restored.

## 7. MindrianOS gates (RCA template Section 5)

- Canon Part 8 (Brain boundary): both fixes are LOCAL prose/skill changes; FIX 1's pedagogy
  write is generic methodology only (Part 8 clean). No user-data egress.
- Tri-Polar (CLI / Desktop / Cowork): the conversational restraint applies on all three;
  the F.1 gate degrades to its named-tag form on non-TTY.
- Cross-platform: doc/prompt + pure-CJS orchestrator changes; no platform-specific code.
- Release lockstep: ships in the v1.15.0 train (or a hotfix beta) once fixed.
- No em-dashes; reuse-before-build (repoints ignite's existing F.1 + the existing skill, no
  net-new surface).

## Resume

`/gsd-debug ignite-frontdoor-bypassed-methodology-overfire`
