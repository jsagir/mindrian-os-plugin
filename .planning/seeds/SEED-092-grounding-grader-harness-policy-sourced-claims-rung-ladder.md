---
id: SEED-092
status: dormant
planted: 2026-09-08
planted_during: "Phase 298 (SEED-032: Harness-as-Code), wave 1 execution"
trigger_when: "Phase 303 (SEED-040, HITL Memory Governance) planning: folded into 303's scope 2026-09-08 (ROADMAP.md edit, this same review session) rather than left as an independent phase, since 303 already owns the F.8 basket surface this grader feeds. Also fires standalone if 303 is delayed and a second slice of data/harness-policies/ is scoped after Phase 298 ships first (the eleven slice-1 policies are the 298-09 set; this would be the first slice-2 candidate); or when SEED-086 (hedge-laundered fabrication, no detector reaches it) is promoted, since this seed is the harness-side home for that detector; or when the Sourced Claims floor test (tests/test-canon-entry-38-sourced-claims-floor.cjs) is next revised"
scope: medium
home_phase: 303
---

# SEED-092: A grounding-grader harness policy: promote the Sourced Claims rule from a stated rung to a logged one through the Phase 298 rung ladder

## Why This Matters

The Sourced Claims rule (Part 12 HARD requirement, stated in agents/larry-extended.md and the
larry-personality skill) is today enforced only by prompt: rung 1, "stated where the model
speaks". Nothing in the repo logs whether a given Larry turn's numbers were actually sourced,
so there is no evidence trail to read when deciding whether the rule deserves a gate.

The navigator-supplied "Nine Techniques" reference (2026-09-08) frames agentic RAG around two
cheap grader calls, "are these sources relevant?" and "is this answer grounded in these
sources?", and calls the grader loop "the whole point". MindrianOS already has the first
grader in structural form (dispatchSensors -> decide(), the reach engine decides what is
relevant). It has no runtime form of the second. The Sourced Claims rule IS that second
grader, at rung 1 only.

Phase 298 builds exactly the promotion path such a rule needs: a policy file with a rung, an
append-only evidence log under MINDRIAN_HOME, and a promotion_rule (window_runs,
max_false_positive_rate, min_true_positives) that a human reads before editing the rung. The
voice-hyphens-only and voice-glyph-present policies are the slice-1 precedent: stated, then
logged by scripts/check-voice-style.cjs, never auto-promoted. A grounding grader would be the
first slice-2 policy and the first one whose detector reasons about content, not surface form.

Relation to SEED-086: that seed names the gap (a hedge word on an unsourced number is a
fabrication category no detector in the tool-honesty family reaches). This seed names WHERE
the detector lives once built: a harness policy at rung 2, reading the last assistant turn
through lib/hmi/turn-text.cjs, the single transcript reader 298-03 lifted for precisely this
reuse.

Grounding note: the langtalks corpus (2026-08-27 snapshot) has no entry for "agentic RAG"
yet; the grader-loop framing comes from the navigator-supplied reference only. LLM-as-judge
appears in the corpus via one source (data4sci, "Building an Advanced Agentic Harness").

## When to Surface

**Trigger:** see frontmatter. Earliest natural moment: the first planning session that opens
data/harness-policies/ to add a policy beyond the slice-1 eleven.

Not a Phase 298 task. 298's scope is locked to slice 1 (298-SPEC.md), and a content-level
detector needs its own research pass: what counts as "a number", what counts as "sourced"
(a citation in the turn, a room artifact id, a Brain handle), and the false-positive rate on
Larry's real turns before any promotion_rule is credible.

## Scope Estimate

**Medium**: one policy JSON (schema already closed by 298-09), one rung-2 Stop-hook detector
mirroring scripts/check-voice-style.cjs (298-07 pattern, reusing lib/hmi/turn-text.cjs and
lib/hmi/voice-style-log.cjs or a sibling log), one test, one doctor-module line. The
research pass on what "sourced" means is the real cost, not the code.

## Breadcrumbs

- agents/larry-extended.md, "Sourced Claims (Part 12 HARD requirement)" section: the rung-1 statement
- skills/larry-personality/SKILL.md: the doctrine home the agent body points to
- tests/test-canon-entry-38-sourced-claims-floor.cjs: the presence floor (asserts the rule is STATED, not that it held)
- lib/hmi/turn-text.cjs (298-03): the single transcript reader a rung-2 detector must consume
- scripts/check-voice-style.cjs and lib/hmi/voice-style-log.cjs (298-07/08): the rung-2 hook + evidence-log + evaluatePromotion pattern to mirror
- data/harness-policies/_schema.json and CONTEXT.md (298-09): the closed policy schema and the rung vocabulary
- .planning/seeds/SEED-086-fabrication-hedge-laundering-prose-output-not-covered-by-tool-honesty-detector.md: the gap this policy would close
- .planning/phases/298-.../298-SPEC.md: the slice-1 lock this seed deliberately sits outside

## Notes

Captured during Phase 298 wave 1 from a Larry review of the navigator-supplied "Nine
Techniques to Master Modern AI Systems" reference, grounded against the langtalks graph.
Sibling seed: SEED-093 (re-run the evidence window when the underlying model version changes).
