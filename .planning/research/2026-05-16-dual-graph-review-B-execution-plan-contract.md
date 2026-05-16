---
type: architectural-review-B
reviewer: execution-plan-contract-auditor
target: dual-graph proposal (2026-05-16-dual-graph-architectural-proposal.md)
created: 2026-05-16
scope: ONLY v1.13.1 execution plan contract violations (canon + adversarial framing handled by sibling reviewers)
authority: .planning/v1.13.1-EXECUTION-PLAN.md (frontmatter `status: canonical (2026-05-14 design-locked)`, line 2; `supersedes: scattered beta_target frontmatter`, line 7) + memory rule `feedback_v1131_execution_plan_is_contract.md` ("the plan wins")
---

# Review B -- Execution-Plan Contract Audit of the Dual-Graph Proposal

## Verdict

**PLAN-COMPLIANT-WITH-CONSTRAINTS**

The proposal's chosen path (Path 6.A) is structured as five one-paragraph CONTEXT.md amendments + one reserved-slot stub on Phase 125 (already shipped). No new phases, no new code, no new beta cuts. As written it does NOT expand any phase past its locked beta target, does NOT reorder waves, and DOES defer the only piece that needed v1.14.0 (learned-weights feedback loop). The plan envelope (12 phases / ~11 weeks, line 57) holds. Constraints below are required to keep it compliant during execution; without them, scope creep is the live risk.

## Q1 -- Per-phase scope-vs-beta-target walk

The plan's authority for beta targets sits at lines 30-36 (Synthesis-Plan Absorption table) and lines 267-273, 309-321, 338-361, 364-437. Each phase walked against the proposal's amendment text in Section 6.A of the proposal:

**Phase 127.1 (beta.2, plan line 31 N/A -- this is a pre-existing decimal-insert, not in the absorption block; beta target in its CONTEXT.md frontmatter line 9 `beta_target: 1.13.1-beta.2`).** Proposal amendment: "Vector substrate unification is a precondition for dual-lens ensemble scoring..." This is a forward-looking architectural acknowledgment, not a code or test additions. CONTEXT.md goal (line 34) already states server-side substrate swap with 4 locks + 20-query harness. The amendment adds vocabulary, not work. **Scope-fit: YES** -- amendment is one paragraph asserting an architectural intent that the existing acceptance criteria (CONTEXT.md lines 68-76) already deliver. No scope expansion.

**Phase 128 (beta.3, plan line 32).** Proposal amendment: "Substrate contract reserves a lens-class registry surface. Future lens classes (ASSOCIATION_LENS, TRANSITION_LENS) plug in through the navigation.cjs chokepoint." 128-CONTEXT.md (lines 56-65) ships an ADR + CI guard + pre-commit hook + 5 test cases. The amendment names two future lens classes; CONTEXT.md acceptance criteria (lines 74-79) do NOT today require the ADR to enumerate ASSOCIATION_LENS/TRANSITION_LENS. **Scope-fit: YES, conditional** -- if the amendment is a one-paragraph forward-reference in the ADR prose, no work added. If it requires registry slot reservations enforced by the CI guard, that IS scope expansion (the guard becomes responsible for two more pattern checks). **CONSTRAINT REQUIRED.**

**Phase 129 (beta.3, plan line 33).** Proposal amendment: "memory_event emission on every transition is the data plane the TRANSITION_LENS reads in Phase 130; this phase's payload is load-bearing for dual-lens ensemble scoring downstream." 129-CONTEXT.md already delivers `memory_event` emission on every spine transition (lines 47-57). The amendment is purely a forward-reference. The plan line 33 caps net new event types at 5 (`EVENT_TYPES additive: cap at 5 new types`, line 320). The amendment does NOT name new event types. **Scope-fit: YES** -- forward-reference only, no code touch.

**Phase 130 (beta.5/beta.5b, plan line 34 + lines 340-361).** Proposal amendment: "Expand lens-engine skeleton scope to name ASSOCIATION_LENS and TRANSITION_LENS as first-class lens classes alongside the cognitive family Phase 130 implements." This is the only amendment with explicit scope-expansion language ("Expand ... scope to name ... as first-class lens classes"). 130-CONTEXT.md (lines 36-38) is explicit: "engine ships with **one populated lens family (cognitive)**; the other 4 families ... get registry slots and stay empty until their v1.14.0 migrations." Plan line 358-359 reinforces: "Other 4 lens families ... are SCHEDULED for v1.14.0 migration; registry slots reserved, no clients yet." Adding TWO MORE lens classes (ASSOCIATION_LENS, TRANSITION_LENS) beyond the 5 already on the roster (domain/cognitive/source/framework/trend, 130-CONTEXT.md line 54) is registry surface expansion. If "name as first-class" means a registry slot only, that fits the existing pattern (4 empty slots already reserved per acceptance line 105). If it means populated lens classes, that's net-new work past beta.5b. **Scope-fit: ACCEPT-WITH-EDITS REQUIRED.** Amendment must explicitly say "registry slot only, populated in v1.14.0."

**Phase 131 (beta.5c, plan line 35 + lines 364-437).** Proposal amendment: "Define 'graph-native' as dual-lens reading -- source-lens + association-lens + transition-lens, ensemble-scored. Phase 131 becomes the canonical pilot consumer." 131-CONTEXT.md ships the source-lens family pilot via /mos:research (line 41). Plan line 366 caps it: "The source-lens family's PILOT via /mos:research." Adding association-lens + transition-lens to the ensemble at Phase 131 implicitly drags Phase 130 work past the beta.5b boundary AND pulls v1.14.0 family migrations forward. The plan is unambiguous: only source-lens is in scope for v1.13.1 (line 55: "P13 source-lens migration REMAINDER ... defer to v1.14.0"). **Scope-fit: REJECT as written.** Defining graph-native as a TRI-lens ensemble (source + association + transition) at Phase 131 is the most direct contract violation in the proposal. The amendment must redefine graph-native using only the source-lens substrate + the existing edge taxonomy (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES/REJECTED/DEFERRED) without naming association-lens or transition-lens as first-class lens classes within the ensemble.

## Q2 -- Wave dependency / ordering

Plan critical path (line 572): `125-finish → 126 → v1.13.0 → 127 → 114 → 117 → 118 → 119 → 121.5 → v1.13.1`. Line 577: "9 sequential layers. Phase 127 in the middle (architectural anchor). Phase 121.5 at the end (user-facing anchor)."

Plan wave dependencies relevant to the proposal:
- Phase 128 / 129 are W4 (Stream E / Stream F, parallel; lines 309-321), beta.3
- Phase 130 is W6.5 (deps: 109 + 128 + 129, line 341), beta.5b
- Phase 131 is W6.7 (deps: 109 + 110 + 127 + 128 + 129 + 130, line 367), beta.5c

The proposal does NOT propose new phases, so it cannot reorder waves directly. The risk is implicit: if Phase 130's amendment IS interpreted as scope expansion (Q1 finding), then 131's beta.5c gate could slip, and 131 is the last code phase before 121.5 (W7). A slip in 131 cascades to 121.5 (line 442), which cascades to v1.13.1 FINAL (line 565). **Wave-dependency-chain risk: present but indirect.** Plan-compliant only if Q1 constraints on Phase 130 + 131 hold.

Phase 121.5 hold-flag retraction in proposal Path 6.A (proposal line 149) does NOT modify 121.5's scope -- it converts a hold-flag into a verdict record. The F-selector ranker contract slot reservation (`transition_lens_contribution`) names Phase 125 (already shipped, plan line 70: "Phase 125 F-Selector Ranker ✓ ... 12/12 must-haves, 8/8 GREEN"). Modifying a shipped phase's contract post-release without a version bump is irregular but the proposal explicitly says "no implementation; signal to keep the surface extensible" (proposal line 149). **Wave order: not violated, but constraint needed.**

## Q3 -- Scope absorption on top of scope absorption

Plan lines 26-57 (Synthesis-Plan Absorption block) added 4 phases on 2026-05-16 (128/129/130/131). Plan line 57: "Final shape: 12 phases in v1.13.1, ~11 weeks. Up from 11 phases / 10 weeks before the Phase 131 absorption. Up from 8 phases / 7-8 weeks in the original pre-synthesis plan."

The proposal's Path 6.A (proposal line 153) self-reports: "Cost: ~5 hours of CONTEXT.md editing + Canon-Phase-Map updates. No new code; no scope expansion past locked beta targets; additive vocabulary only." If that self-report holds (and Q1 constraints are applied), the envelope is preserved -- 5 hours of doc edits does not move the 11-week calendar.

If the proposal's amendments are interpreted maximally (e.g., Phase 130 lens-engine skeleton actually IMPLEMENTS two more lens classes; Phase 131 ensemble actually rotates over three lens classes), the envelope cracks. Plan line 596-611 (calendar table) has 5-7 day windows for W4/W5/W6/W7 each; absorbing two more lens classes into Phase 130 alone is realistically +2-3 days, pushing 130 from beta.5b into beta.6 territory and cascading to 121.5. **Absorption-on-absorption risk: latent.** Plan-compliant only under "additive vocabulary only" reading -- which IS what the proposal states it intends.

## Q4 -- v1.14.0 deferral consistency

Plan line 622-626 ("What this plan does NOT include -- deferred to v1.14.0"):
- Local-first SQLite snapshot of Brain methodology (Tier 0.5 offline)
- Collapsing 6 user-facing Brain tools to brain_ask only
- Phase 100 jtbd-inference-engine

Plan line 55 also names: P9 framework-lens migration, P10 trend-lens consolidation, P11 SAPPhIRE, P13 source-lens REMAINDER (the 13 surfaces not covered by 131 pilot), P14 audit-engine consolidation, P15 score-innovation reconnection, P16 file-meeting graph rewrite.

The proposal defers "learned-weights feedback loop" to v1.14.0 as plant-seed (proposal line 151) with the rationale that it needs accumulated tester-usage outcome data first. This deferral pattern is consistent with how the plan handles other "needs data" items (e.g., line 622, Tier 0.5 needs methodology snapshot data; Phase 100 needs JTBD inference training). The proposal's plant-seed trigger condition (Path 6.C line 174: ">= 30 days of memory_event data + >= 100 F.0/F.1/F.2 outcome edges") is more concrete than most v1.14.0 deferrals in the plan, which strengthens rather than weakens consistency.

The risk: the proposal's amendments to Phase 128/130/131 implicitly "reserve" surface area (a lens-class registry, ensemble slots in the ranker contract) for the v1.14.0 work to land on. The plan does not authorize v1.13.1 to pre-shape v1.14.0 work beyond the existing registry slot pattern (line 358: "registry slots reserved, no clients yet"). **As-stated deferral is plan-consistent.** If the reserved slots cross from "named placeholder" into "functioning interface stub that v1.14.0 fills in," that creates implicit v1.13.1 dependencies the plan does not authorize. **CONSTRAINT REQUIRED.**

## Q5 -- Phase 131 "graph-native" redefinition

131-CONTEXT.md goal (line 39): "Transform `/mos:research` from a standalone topic-string-to-prose command into the canonical workflow step that other methodologies can dispatch." Plan line 366-370 frames it identically: "The source-lens family's PILOT via /mos:research. After this phase, /mos:research is no longer a fortune-cookie command -- it is the canonical workflow step that other methodologies can dispatch."

The term "graph-native" appears in plan line 35 within "context-aware + workflow-aware + graph-native" as a triple descriptor. It is NOT defined in 131-CONTEXT.md or in the plan. The proposal correctly identifies this as an undefined term that needs definition.

The question is HOW to define it. The proposal's amendment (proposal line 148: "dual-lens reading -- source-lens + association-lens + transition-lens, ensemble-scored") imports two lens classes (association + transition) that DO NOT EXIST in v1.13.1's Phase 130 deliverables. Per 130-CONTEXT.md line 37: "engine ships with **one populated lens family (cognitive)**." Phase 131 plugs into Phase 130 (line 367); it cannot read from lens classes Phase 130 hasn't built. Defining "graph-native" as a tri-lens ensemble at Phase 131 is therefore a REDEFINITION that pulls work forward, NOT a clarification of an undefined term.

A plan-compliant clarification of "graph-native" at Phase 131 would use only: (a) the source-lens substrate Phase 130 actually ships, and (b) the existing typed cascade edges (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES, plus REJECTED/DEFERRED from Phase 125 D7). The proposal's tri-lens definition violates this constraint. **Verdict: REDEFINITION, not clarification.**

## Per-phase amendment-acceptance table

| Phase | Verdict | Rationale |
|---|---|---|
| **127.1** | **ACCEPT** | One-paragraph forward-reference to dual-lens ensemble preconditioning; existing acceptance criteria (CONTEXT.md lines 68-76) already deliver the substrate unification. No new work. |
| **128** | **ACCEPT-WITH-EDITS** | Amendment must read "ADR PROSE forward-references future lens-class registry"; if the CI guard `scripts/check-substrate.cjs` is asked to enforce new patterns for ASSOCIATION_LENS/TRANSITION_LENS, that is scope expansion. Restrict to prose-only. |
| **129** | **ACCEPT** | Forward-reference; no new event types beyond the 5-cap (plan line 320); no code change to the 7-script refactor. |
| **130** | **ACCEPT-WITH-EDITS** | Amendment must explicitly state "registry slot only, populated in v1.14.0" for ASSOCIATION_LENS + TRANSITION_LENS. If populated lens classes in this phase, beta.5b slips and W6.5 budget (4-5 days, plan line 360) cracks. |
| **131** | **REJECT (as written) -- accept rewrite** | "Graph-native = source + association + transition, ensemble-scored" pulls Phase 130 v1.14.0 work forward. Acceptable rewrite: "graph-native = source-lens reads via navigation.cjs + writes typed EvidenceClaim nodes + cascade edges per Canon Part 4." Use only the substrate Phase 130 actually ships. |

## Constraints the proposal must honor if approved

1. **No populated lens classes beyond cognitive in v1.13.1.** ASSOCIATION_LENS + TRANSITION_LENS are registry slot reservations only, in the same pattern as the 4 empty slots already reserved per plan line 358. Population deferred to v1.14.0 per the existing fan-out schedule.

2. **No scope expansion of `scripts/check-substrate.cjs`.** Phase 128's CI guard scans for the patterns listed in 128-CONTEXT.md lines 58-62 only. New lens-class enforcement is a v1.14.0 amendment to the guard, not a v1.13.1 amendment.

3. **No new event types in Phase 129 beyond the 5-cap.** Plan line 320 hard-caps additive event types at 5 ("EVENT_TYPES additive: cap at 5 new types"). The dual-graph amendments cannot introduce `transition_recorded`, `association_observed`, or similar net-new types in v1.13.1.

4. **Phase 131's "graph-native" definition must rely only on Phase 130's actual deliverables.** No reference to ASSOCIATION_LENS or TRANSITION_LENS as functional ensemble inputs. The definition uses source-lens + existing cascade edge taxonomy + EvidenceClaim node type.

5. **The F-selector ranker `transition_lens_contribution` slot reservation on Phase 125 (shipped) is a prose-only contract addendum.** No code change to `lib/workflow/f-selector-ranker.cjs`; no version bump to Phase 125's release. Slot reservation lives in the Phase 125 plan-summary appendix or a new ADR cross-referenced from Phase 125, never in shipped code in v1.13.1.

6. **Total amendment work cap: 5 hours.** Per the proposal's self-reported cost (Path 6.A, line 153). Any amendment work exceeding 5 hours triggers re-audit because it indicates scope expansion beyond "additive vocabulary only."

7. **Plant-seed for v1.14.0 must use the existing /gsd:plant-seed mechanism with the trigger conditions from Path 6.C line 174.** No invented surface for "learned-weights" inside v1.13.1.

8. **Canon-Phase-Map updates land in the same commit as the CONTEXT.md amendments**, per the plan's authority-for-canon-mapping pattern (CANON-PHASE-MAP.md "Forward-compatibility rule"). One commit, five CONTEXT.md edits, one CANON-PHASE-MAP.md edit, one plant-seed entry.

## Final read

The proposal's Path 6.A (cross-phase amendments) is plan-compliant ONLY if treated as additive vocabulary on top of phase scopes that already deliver the substrate; the Phase 131 amendment as written redefines "graph-native" past what Phase 130 ships and must be rewritten to use only source-lens + existing cascade-edge taxonomy, after which the plan envelope (12 phases / ~11 weeks) holds and the wave-dependency chain stays intact.
