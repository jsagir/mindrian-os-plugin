# Phase 179: Ignite B1 Starting-Point Fix — Specification

**Created:** 2026-06-25
**Ambiguity score:** 0.125 (gate: ≤ 0.20)
**Requirements:** 12 locked
**Absorbs:** Phase 174 (hypothesis-based ignite) — its hypothesis door becomes Door 3 here.

## Goal

`/mos:ignite` B1 changes from a flat ASCII box that the model can silently render instead of firing the card, into (1) a machine-ENFORCED interactive card across all reachable Shape F gates and (2) a persona-first 4-door starting point (Persona / CV / Hypothesis / Free-Text) whose `{role_blend, blueprintFamily, arrival_asset, hypothesis_text}` survive to B2 and thread into the existing `birthRoom` contract.

## Background

A live v1.15.0-beta.3 repro (statusline-confirmed) showed B1 rendering as a flat ASCII box ("type 1, 2, or 3") instead of firing the AskUserQuestion selector — on the SAME build that shipped the Phase 178 R15 render-coverage gate. R15 build-fails a gate surface not WIRED to emit a card, but it cannot force the model to FIRE the card at runtime (the named **R-1 residual**). A prose stopgap shipped (commit e22b9ea4) and the agent ignored it.

Verified against the live tree (2026-06-25):
- **R-1 confirmed:** `grep AskUserQuestion lib/ scripts/` returns only comments/prose — ZERO tool-call sites. Card-firing is agent-honored, not machine-enforced.
- **Scratchpad drop confirmed:** `lib/core/scratchpad-ops.cjs` `writeScratchpadBirthAnswer` persists only `free_text` + `arrival_asset` (lines 225-226). `role_blend` + `blueprint_family` are passed by `ignite.md` and SILENTLY dropped — B1 signal dies before B2.
- **8 blueprint families, no `hypothesis`:** `data/room-blueprints.json` = exploration, solution-first, problem-first, business-first, portfolio, venture, program, case-study. Door 3 needs a net-new family.
- **CV parser detects 4 of 7 roles:** `lib/core/shallow-doc-parser.cjs` parseRoleHints covers Founder/Investor/Researcher/Operator; `blendFromCanonicalRole` yields single-axis `{key:1.0}`.
- **7 frozen role keys:** `lib/core/persona-override.cjs` ROLE_BLEND_KEYS (founder/researcher/operator/investor/mentor/domain_expert/student) — import, never redefine.

Reuse posture: ~80% reuse / ~15-20% net-new (full file:line map in `179-RESEARCH.md`).

## Requirements

1. **GA-4 card-fire interceptor (the R-1 cure, Wave 1)**: A turn-scan interceptor detects a reached-Decision-Gate turn with no fired AskUserQuestion card and forces the card.
   - Current: card-firing is agent-honored prose only; the no-card path is undetected at runtime
   - Target: an interceptor (Stop-hook-class turn-scan: gate-reached signal present AND AskUserQuestion call absent) HARD-BLOCKS turn completion and re-prompts to force the card; after N bounded retries it degrades gracefully (log + allow) so a genuinely card-incapable surface cannot trap the navigator; coverage = ALL reachable Shape F gates, keyed off the Phase 178 R15 render-coverage registry that already enumerates them
   - Acceptance: a reached-gate-no-card fixture turn is intercepted and forced (not merely logged); a non-gate turn produces ZERO forced cards (negative test); the bounded escape releases after N retries without infinite loop

2. **Persona-first 4-door B1 (one canonical gate)**: B1 fires AskUserQuestion "Who are you arriving as?" with four doors — Persona pick, CV, Hypothesis, Free-Text — each resolving to `{role_blend, blueprintFamily, arrival_asset}`.
   - Current: `ignite.md` B1 has the persona-first prose stopgap (e22b9ea4) but no enforced card; Hypothesis door does not exist
   - Target: one card, four doors; Door 1 sets `role_blend` from ROLE_BLEND_KEYS and derives `blueprintFamily` (researcher/student/domain_expert→exploration; founder-business/operator/investor→venture); Door 4 free-text routes via Larry
   - Acceptance: B1 fires the card (caught by Req 1's interceptor if it does not); each door produces a valid `{role_blend, blueprintFamily, arrival_asset}` tuple threaded into `birthRoom` opts

3. **Single-axis role_blend threading (weighting deferred)**: The captured role resolves to a single-axis `{key:1.0}` blend written exactly once at birth.
   - Current: `blendFromCanonicalRole` already yields single-axis `{key:1.0}`; written once at `room-birth.cjs:420-433` STEP 1
   - Target: B1 passes `opts.roleBlend` (single-axis) through the untouched 7-step birth txn; the weighted multi-axis computer and the 3 missing CV detectors (Mentor/Domain Expert/Student) are OUT (fast-follow)
   - Acceptance: a birthed room's USER.md carries the single-axis `role_blend`; the 7-step txn and approvedBy gate are byte-unchanged; no weighted-blend code lands

4. **CV-second-select domain gate (multiSelect / checkbox)**: After a CV parse, a Shape F multiSelect asks which 2-3 domains pull the navigator, consuming `extractDomains()`.
   - Current: `extractDomains` produces domain handles; the multiSelect gate has ZERO code (grep-confirmed)
   - Target: Door 2 runs detect_dual_path → extract_shallow (reuse verbatim), then fires a Shape F multiSelect (AskUserQuestion `multiSelect:true` — CHECKBOX selection, arrow-key navigable) over `extractDomains()` output, then auto-fires the Engine 1 math (Req 8)
   - Acceptance: a CV fixture yields domain handles; the multiSelect renders them as checkboxes (multiSelect:true), is arrow-key navigable, and records the navigator's 2-3 picks to the scratchpad

5. **Hypothesis blueprint family + truth-claim filing (Door 3 core)**: A new `hypothesis` blueprint family exists and the captured "I believe ___" files as a truth-claim node.
   - Current: no `hypothesis` family and no `hypothesis` arrival_asset (grep-confirmed); `room-blueprints.json` has 8 families
   - Target: add a `hypothesis` family (sections = problem-definition seeded + assumptions + opportunity-bank; default_methodologies = structure-argument / challenge-assumptions / validate / research), CI-green via `check-room-blueprints.cjs`; the falsifiable "I believe ___" files via `writeClaimNode` at `review_status: proposed` (Part 9)
   - Acceptance: `check-room-blueprints.cjs` stays green with the new family; the scaffold resolves its section set; the hypothesis node is `proposed`, never `confirmed` without human byUser

6. **Instances-vs-structures abstraction gate (Door 3, in scope this phase)**: A 3-option Shape F selector captures the navigator's abstraction level, with a committed domain-neutral fixture.
   - Current: no such surface exists
   - Target: a Shape F.x card — "Are you testing specific INSTANCES, the general STRUCTURE, or unsure?"; fixture = a generic "I believe X drives Y" example with ZERO venture content; any AION-specific content stays user-local, never the plugin repo
   - Acceptance: the gate renders 3 options and records the pick; a grep gate proves the committed fixture is domain-neutral (no user/venture-specific strings); the abstraction-level value persists with the hypothesis node

7. **Per-role hypothesis framing**: Door 3's hypothesis prompt auto-selects framing from the captured `role_blend`.
   - Current: no hypothesis prompt exists
   - Target: researcher→testable claim, founder→market bet, investor→thesis precondition (reuse the Door 1 `role_blend`); falls back to a generic "I believe ___ because ___" when `role_blend` is empty
   - Acceptance: each of the 3 named roles produces its distinct framing; an empty `role_blend` produces the generic prompt

8. **Auto-fire Engine 1 math, gate the results**: Arrival auto-runs the Act 1 triple-filter math; findings surface at the next Decision Gate.
   - Current: Engine 1 (`/mos:explore-domains`) is shipped but not auto-fired on arrival
   - Target: arrival (persona/CV/hypothesis) auto-fires the decomposition/whitespace/reverse-salient math (Part 10 sub-claim 5) in the background; results surface at the next Decision Gate for APPROVE/REJECT/DEFER (Part 3) — never cascaded silently
   - Acceptance: arrival triggers the math without an explicit command; findings appear at a gate, not auto-written to the room

9. **Widen the scratchpad whitelist**: `writeScratchpadBirthAnswer` persists `role_blend` + `blueprint_family` + `hypothesis_text`.
   - Current: only `free_text` + `arrival_asset` persisted (scratchpad-ops.cjs:225-226); `role_blend` + `blueprint_family` silently dropped
   - Target: the whitelist adds `role_blend`, `blueprint_family`, `hypothesis_text`; `drainBirthGateAnswers` recovers them at B2
   - Acceptance: a round-trip test writes then drains all three new fields intact across a session boundary

10. **Reconcile the two B1 specs**: `ignite.md` persona-first is the ONE canonical B1; `new-project.md` demotes to a pure B2 scaffold backend.
    - Current: `ignite.md:80-98` (persona-first, role_blend) and `new-project.md:147-188` (arriving-with, no role_blend) both describe a B1
    - Target: `new-project.md` no longer renders a competing B1; it keeps only the B2 scaffold backend
    - Acceptance: grep confirms `new-project.md` carries no persona-first B1 gate prose; one canonical B1 remains

11. **Part 8 clean + CIRS R12 conformance**: All touched surfaces egress zero user content; the phase declares a conformant `cirs_relationship` block.
    - Current: `179-CONTEXT.md` already carries the `cirs_relationship` block (surfaces added/modified, spine consumed, gate impact)
    - Target: CV/domain/hypothesis handles via auditQueryString; `role_blend` weights + user_id NEVER cross to Brain (only the Larry/Brain scalar via translateLarryToBrain); the GA-4 interceptor opens no Brain wire
    - Acceptance: a Part 8 sweep over all touched surfaces returns zero user-content egress; the CIRS born-wired gate passes (every new/modified surface WIRED or EXCLUDED)

12. **Shape F keyboard + checkbox contract (every gate in this phase)**: Every Shape F selector this phase touches renders through the AskUserQuestion primitive — arrow-key toggle for single-pick gates, multiSelect checkboxes where multiple picks are relevant. No bespoke selector, no ASCII-box-only render.
    - Current: B1 ships the ASCII-box anti-pattern; the F.1 keyboard contract + multiSelect:true checkbox primitive exist but are not enforced at B1
    - Target: single-pick gates (Door 1 persona pick, Door 3 abstraction 3-option, Door 4 routing) are arrow-key navigable single-select cards; the CV-second-select domain gate (Req 4) is a multiSelect:true CHECKBOX card; all route through the AskUserQuestion primitive (Phase 88.2 invariant), honoring the frozen F.1 keyboard contract
    - Acceptance: each single-pick gate renders as an arrow-key-navigable single-select card; the domain gate renders as a multiSelect:true checkbox card; no gate in this phase renders as an ASCII box only (caught by Req 1's interceptor)

## Boundaries

**In scope:**
- The GA-4 card-fire interceptor (hard-block + bounded escape, ALL reachable Shape F gates) — Wave 1
- Persona-first 4-door B1 (Persona / CV / Hypothesis / Free-Text) fired as one enforced card
- Single-axis `role_blend` threading through the untouched birth txn
- CV-second-select domain multiSelect over `extractDomains()`
- `hypothesis` blueprint family + truth-claim node filing (proposed)
- Instances-vs-structures 3-option Shape F gate + domain-neutral fixture + grep gate
- Per-role hypothesis framing auto-selected from `role_blend`
- Auto-fire Engine 1 math; gate the results
- Widen the scratchpad whitelist (role_blend + blueprint_family + hypothesis_text)
- Reconcile the two B1 specs (ignite.md canonical; new-project.md → B2 backend)

**Out of scope:**
- Weighted multi-axis `role_blend` computer — deferred fast-follow (single-axis stub ships; weighting is net-new complexity not required for the doors to work)
- The 3 missing CV role detectors (Mentor / Domain Expert / Student) — deferred with the weighting (single-axis covers the shipped 4)
- Journey-stage inference — stays inert at 'Ordinary World'; that is Phase 91 territory (keeps this phase on the role-blend axis only)
- Cross-room expert/persona reuse — Part-8-gated deferred amendment, room-local only here
- Hypothesis sub-hypotheses / meta-hypothesis reframe — Door 3 captures a single falsifiable statement this phase
- Changing any frozen Part 3 contract (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs) — untouched

## Constraints

- `role_blend` written EXACTLY ONCE at birth (`room-birth.cjs:420-433`) before the confirmNode batch; the 7-step txn and approvedBy gate must stay byte-unchanged.
- The 7 ROLE_BLEND_KEYS are a FROZEN vocabulary (`persona-override.cjs`) — import, never redefine.
- `blueprintFamily` must resolve to a known family or fall back to frozen SECTION_NAMES.
- The hypothesis node files via `writeClaimNode` at `review_status: proposed`; only a human byUser promotes to `confirmed` (Part 9 role 5).
- Part 8: CV/domain/hypothesis handles via auditQueryString; `role_blend` weights + user_id NEVER cross to Brain; the GA-4 interceptor opens no Brain wire.
- The abstraction-gate fixture must be domain-neutral; AION-specific content never enters the plugin repo (enforced by a grep gate).
- The GA-4 interceptor coverage is keyed off the Phase 178 R15 render-coverage registry — reuse the enumeration, do not hand-maintain a gate list.
- No new orchestration framework, reach, edge type, or node type minted (Part 11; the hypothesis family is data, not a frozen-set move).
- Every Shape F selector renders through the AskUserQuestion primitive (Phase 88.2 invariant): single-pick gates are arrow-key-toggle single-select; multi-pick gates (the CV-second-select domain gate) are `multiSelect:true` checkboxes. The frozen F.1 keyboard contract is honored, not redefined. No bespoke dialog, no ASCII-box-only render.

## Acceptance Criteria

- [ ] A reached-gate-no-card fixture turn is intercepted and the card is forced (not merely logged)
- [ ] A non-gate turn produces ZERO forced cards (negative test passes)
- [ ] The GA-4 bounded escape releases after N retries — no infinite loop on a card-incapable surface
- [ ] B1 fires AskUserQuestion with the four doors; each door yields a valid `{role_blend, blueprintFamily, arrival_asset}` tuple
- [ ] `writeScratchpadBirthAnswer` + `drainBirthGateAnswers` round-trip `role_blend` + `blueprint_family` + `hypothesis_text` intact
- [ ] `check-room-blueprints.cjs` stays green with the new `hypothesis` family; scaffold resolves its section set
- [ ] The "I believe ___" hypothesis files as a truth-claim node at `review_status: proposed`
- [ ] The instances-vs-structures gate renders 3 options; the committed fixture passes a domain-neutral grep gate
- [ ] Single-pick gates (persona, abstraction, routing) render as arrow-key-navigable single-select AskUserQuestion cards
- [ ] The CV-second-select domain gate renders as a `multiSelect:true` checkbox card
- [ ] No gate in this phase renders as an ASCII box only (the keyboard/checkbox card always fires)
- [ ] Per-role hypothesis framing differs for researcher/founder/investor; empty `role_blend` → generic prompt
- [ ] Arrival auto-fires the Engine 1 math; findings surface at a Decision Gate (not auto-cascaded)
- [ ] `new-project.md` carries no competing persona-first B1 gate; one canonical B1 remains
- [ ] The 7-step birth txn + approvedBy gate are byte-unchanged
- [ ] A Part 8 sweep over all touched surfaces returns zero user-content egress
- [ ] The CIRS born-wired gate passes (every new/modified surface WIRED or EXCLUDED)
- [ ] All frozen Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 gate, 6-reach bank, glyphs) verified unchanged

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                              |
|--------------------|-------|------|--------|----------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | GA-4 Wave 1 + 4 doors + single-axis + abstraction gate |
| Boundary Clarity   | 0.88  | 0.70 | ✓      | GA-4 scope (all gates via R15) locked; explicit out-of-scope |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Birth-txn invariants, Part 8, frozen Part 3, grep gate |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 15 pass/fail criteria, one per failure mode        |
| **Ambiguity**      | 0.125 | ≤0.20| ✓      |                                                    |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective       | Question summary                          | Decision locked                                        |
|-------|-------------------|-------------------------------------------|--------------------------------------------------------|
| 0     | Researcher (scout)| Verify the 4 load-bearing research claims | R-1 (no tool-call sites), scratchpad drop, 8 families no-hypothesis, 4-of-7 CV roles — ALL confirmed live |
| 1     | Simplifier        | GA-4 here, sibling, or deferred?          | GA-4 in this phase as Wave 1 — cure precedes the redesign that depends on it |
| 1     | Simplifier        | Weighted blend now or single-axis stub?   | Single-axis stub now; weighting + 3 missing detectors deferred |
| 1     | Boundary Keeper   | Abstraction gate in scope or deferred?    | INCLUDE this phase (navigator override) — fenced to a domain-neutral fixture |
| 2     | Boundary Keeper   | Engine 1 auto-fire or gate?               | Auto-fire the math, gate the results (Part 10 math + Part 3 gate) |
| 2     | Boundary Keeper   | Hypothesis framing per-role or generic?   | Auto-select per role from the Door 1 role_blend; generic fallback |
| 2     | Boundary Keeper   | Journey-stage in scope?                   | Stay inert at 'Ordinary World' — Phase 91 territory    |
| 2     | Boundary Keeper   | (locked defaults)                         | #9 widen scratchpad whitelist + #10 reconcile B1 specs — non-negotiable includes |
| 3     | Failure Analyst   | What breaks if requirements are wrong?    | 8 failure modes → 15 falsifiable acceptance criteria   |
| 4     | Seed Closer       | GA-4 enforcement action?                  | Hard-block + re-prompt with bounded escape             |
| 4     | Seed Closer       | GA-4 gate coverage?                       | All reachable Shape F gates (via Phase 178 R15 registry) |
| 4     | Seed Closer       | Abstraction gate shape + fixture?         | 3-option Shape F selector + grep-guarded neutral fixture |

---

*Phase: 179-ignite-b1-starting-point-fix*
*Spec created: 2026-06-25*
*Absorbs Phase 174 (hypothesis door → Door 3)*
*Next step: /gsd-discuss-phase 179 — implementation decisions (how to build what's specified above)*
