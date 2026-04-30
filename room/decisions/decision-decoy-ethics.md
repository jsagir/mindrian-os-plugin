---
decision_id: decoy-ethics
filed: 2026-04-29
session: 2026-04-29 post-v1.11.2 ship, mid-survey
verdict: HIDE_DURING_SELF_TEACH_AFTER_LOCAL_ONLY_PROFILE
canon_parts:
  - "Part 5 -- Evidence Is Graded By Context"
  - "Part 8 -- The Graph Boundary (Security Constitution)"
  - "Decision 13 (CLAUDE.md) -- Rejection is data"
status: confirmed
applies_to:
  - Phase 88.2 (uiux-selector-block) -- F.6 Plan Review Round (proposed)
  - Phase 96 (browser capture pack) -- decoy nodes in graph view
  - Phase 96.5 (selector roundtrip pack) -- session-start decoy probes
  - Phase 99 (BRAIN.md decision card view) -- decoy decision-card mixed with real
  - Any future surface that uses the gamified-review pattern
related_research: .planning/research/gamified-review-via-askuserquestion.md
---

# Decision -- Decoy Calibration Ethics

## Question

The gamified-review pattern (auq questions framed as user-stories, real items mixed with decoys) requires DECOYS -- questions that do not actually appear in the underlying artifact. Should the navigator be told, before the round starts, that some questions are calibration probes? Or kept blind?

## Verdict

**Hide during the round. Self-teach after. Calibration data is graph-local. The navigator owns the profile.**

Three rules, in order of precedence:

1. **Hide during** -- decoys are not flagged at presentation. The navigator answers each question without knowing which are real.
2. **Self-teach after** -- at the end of every round, the system surfaces a debrief: "K of N were calibration probes. You caught Q/K." The navigator learns what was tested, why, and how they did. No round ever ends in silence about its own calibration.
3. **Local only** -- the navigator's decoy-failure history NEVER leaves their LOCAL graph. The Brain receives only generic anonymized aggregates, and only with explicit opt-in. The navigator can view their profile via /mos:status, can reset it, can opt out of decoy probes entirely.

## Four-voice consultation

```
voice              what it said
---------------    --------------------------------------------------------------
ROOM (mindrianos-  No prior artifact on decoy ethics. Gap. (The gap itself is
venture)           informative -- this question has not been wrestled with in
                   prior decisions. New territory; precedent set here.)

USER FOLDER        feedback_terminal_ux_patterns.md item 13 -- the admin panel
                   pattern -- HIDDEN AND SELF-TEACHING. Hidden because admin
                   tools are calibration infrastructure, not user features.
                   Self-teaching because every action shows consequences before
                   executing. The pattern: hide the mechanism, transparent
                   about the effect.

BRAIN (teaching    Educational psychology canon. Bloom 1956 + retrieval-practice
graph)             literature: comprehension probes are standard pedagogy. Pre-
                   disclosure DESTROYS the calibration signal. Post-debrief is
                   the ethical floor. Aronhime's classroom uses surprise quizzes
                   followed by debrief -- the methodology IP includes this
                   exact pattern.

LARRY (synthesis)  Canon Part 5 grades evidence by context. A decoy is evidence-
                   tier "calibration probe." Its existence is hidden during
                   capture; its existence is disclosed in debrief. Standard
                   A/B-testing ethics: do not tell users they are in the test;
                   DO tell them after; NEVER use the result against them. Canon
                   Part 8 protects the privacy floor: the navigator's profile
                   stays local, period.
```

## Implementation contract

For any surface that uses decoys:

1. **Decoy generation tier:** match the round to the available tier.
   - **Tier 0** (Brain unreachable): pattern-based perturbation from the underlying artifact. Substitute a wrong owner, a wrong dependency, a wrong success criterion. Algorithmic, no calibration data.
   - **Tier 1** (Brain reachable): teaching-graph-aware decoys keyed off framework chaining rules. Pulls from the 21K-node Brain to find plausible-but-wrong substitutions calibrated against real student-grading data.
   - **Tier 2** (cross-session memory): personalized decoys keyed off the navigator's prior comprehension profile. Harder decoys in their weak spots, easier in their strong spots.

2. **Round structure:** every round carries metadata `{total: N, real: R, decoys: D, distribution_seed: <hash>}`. Real and decoys are interleaved, not blocked together. The navigator never sees `total`, `real`, `decoys`, or `distribution_seed` during the round.

3. **Debrief surface:** Shape A (Action Report) renders at round end. Schema:

```
                     ┌─ ROUND 14 -- DEBRIEF ──────────────────────────────┐
                     │                                                    │
                     │  20 questions answered. 17 real, 3 calibration.    │
                     │                                                    │
                     │  Calibration caught:  2 of 3                       │
                     │                                                    │
                     │  ▶  Q11  decoy detected -- you rejected as wrong   │
                     │  ▷  Q14  decoy missed   -- you confirmed (was wrong)│
                     │  ▶  Q19  decoy detected -- you flagged "discuss"   │
                     │                                                    │
                     │  Comprehension tier on this artifact:  B           │
                     │  Trend across last 5 rounds:           B+ -> B     │
                     │                                                    │
                     │  ── Next ──                                        │
                     │    1) Review missed decoy (Q14)                    │
                     │    2) View comprehension profile                   │
                     │    3) Reset profile (start fresh)                  │
                     │    4) Opt out of decoy probes                      │
                     │                                                    │
                     └────────────────────────────────────────────────────┘
```

4. **Privacy contract (Part 8 enforcement):**
   - Decoy-failure events are typed edges in the LOCAL room graph only.
   - The Brain receives only counts in anonymized aggregate form, and only with explicit opt-in via /mos:setup.
   - The navigator's profile is graph-readable via /mos:status, and only by them.
   - The navigator can reset the profile at any time.
   - The navigator can opt out of all decoy probes via /mos:setup.
   - Comprehension tier is NEVER shown to other actors in a Cowork-shared room.

## Why this is moat, not dark pattern

Three reasons.

1. **Disclosure is post hoc, not absent.** The navigator always learns what was tested. No deception at the meta-level; only the per-question hiding required for the calibration signal to exist.
2. **The data stays with the navigator.** Their profile is theirs. Brain learns generic patterns from anonymized aggregates only. This is structurally different from any consumer A/B-testing surface.
3. **The calibration tier is the moat.** Tier 0 is shippable today. Tier 1 needs the Brain. Tier 2 needs the navigator's own history. The competitor who copies the surface gets Tier 0. The competitor who copies the Brain gets the methodology but not the per-user calibration. The compounding moat is the per-user history multiplied by the framework-chaining graph -- exactly the moat formula in /home/jsagi/MindrianOS-Plugin/.claude/includes/moat.md.

## Out of scope (explicitly NOT decided here)

- Decoy-distribution algorithm (uniform vs. clustered vs. adversarial) -- engineering detail for the implementing phase.
- Round-size tuning (20-30 was Jonathan's instinct; Brain has student-grading attention-decay data; query when scaffolding the implementing phase).
- Aggregate Brain-feedback opt-in flow -- Phase 96+ decision.

## Provenance

Same session as decision-cowork-round-locking.md. User instruction: "ask the brain & larry!" The four-voice consultation transcript IS the evidence trail.
