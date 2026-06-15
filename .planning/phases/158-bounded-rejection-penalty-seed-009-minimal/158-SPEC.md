# Phase 158: Bounded rejection-penalty (SEED-009-minimal) — Specification

**Created:** 2026-06-15
**Ambiguity score:** 0.16 (gate: ≤ 0.20)
**Requirements:** 8 locked
**Milestone:** v1.13.1 / v1.14.0-candidate (LOCAL-only; no Brain dependency; builds independent of, and BEFORE, Phase 157)
**canon_parts:** Part 4 (rejection is data — "why not" must teach the ranker, not just file), Part 7 (reuse — ride the shipped `_applyDecay` IoC seam, do not rebuild), Part 8 (boundary — read edge COUNTS/enums only, never rejection reason strings), Part 9 (read outcome edges via the `navigation.cjs` chokepoint, never folder scans)

## Goal

A chronically-rejected next-move candidate is discounted in the ranked set and HARD-suppressed (removed from the returned top-K) once its rejection signal crosses a named threshold N — closing the open feedback circuit where REJECTED / `f_selector_decision(outcome=reject)` outcome edges file but no production ranker reads them back. A room with zero rejection edges produces byte-identical ranked output to today.

## Background

The 157-RESEARCH systems fan-out (2026-06-15) found the what-next reach layer SENSES → RANKS → SURFACES → RECORDS but does NOT LEARN. `lib/workflow/f-selector-ranker.cjs` `_scoreCommand` (lines ~278-292) computes the D4 score with static ensemble weights `0.40 * brain_confidence + 0.30 * (1-recency_decay) * inv + 0.30 * problem_type_bind * inv`. `_applyDecay(applyDecayWeight, baseScore, cmd.command, roomState)` then runs an INJECTED function (`selector-decisions.cjs applyDecayWeight`, the IoC hook at ranker ~378-421) that discounts the score from PIVOT/DEFER signals. REJECTED never rides that rail: the edge lands in room.db (Part 4 / Canon Decision 13) and nothing nudges a future score. A navigator can reject the same candidate five turns running and the static score re-surfaces it at the top on turn six. This is the reverse salient — the single open point in an otherwise-built circuit, and it is LOCAL-only (no Brain graph needed). SEED-009 (dormant) scopes the FULL learned-weight refit behind a two-gate trigger (≥30 users AND ≥1000 outcome edges; current ~4 users, <100 edges); this phase is the MINIMAL pull-forward that the research names as justified at any edge count.

## Requirements

1. **Rejection signal rides the existing decay seam (Part 7 reuse)**: rejection outcomes feed the same injected-function rail PIVOT/DEFER already use.
   - Current: `_applyDecay` discounts scores from PIVOT/DEFER only; REJECTED / `f_selector_decision(outcome=reject)` edges are never read by the ranker.
   - Target: the rejection penalty is applied on the existing `_applyDecay` IoC seam (extend the injected function, or add a sibling injected function on the same rail) — no parallel scoring pathway, no new heavy dependency.
   - Acceptance: given two otherwise-identical candidates differing only in rejection count (one with rejections, one with zero), the rejected one receives a strictly lower `adjustedScore`; the change is localized to the decay/penalty injection seam (no edit to the `0.40/0.30/0.30` literals in `_scoreCommand`).

2. **Byte-stable at zero rejections**: a cold/never-rejected room behaves exactly as today.
   - Current: ranked output is computed with no rejection input.
   - Target: with zero rejection edges for every candidate, the ranker emits byte-identical output to the pre-phase baseline.
   - Acceptance: a fixture room with zero `reject` outcome edges produces a ranked result byte-identical to a captured pre-phase snapshot (regression test); the existing ranker test suite stays green.

3. **Bounded discount below the threshold**: between zero and N, a candidate is penalized but remains rankable.
   - Current: n/a (no penalty exists).
   - Target: below the suppression threshold N, the penalty is a BOUNDED discount (a documented cap); the candidate stays in the candidate set with a reduced but positive score.
   - Acceptance: a candidate with a rejection signal strictly between zero and N appears in `rankForSelector` output with a score lower than its un-penalized self, and the discount magnitude never exceeds the documented cap.

4. **HARD suppression at the threshold (navigator-LOCKED 2026-06-15)**: at rejection signal ≥ N, the candidate drops out of the returned top-K.
   - Current: no candidate is ever removed for being rejected.
   - Target: once a candidate's rejection signal reaches N (the unit — absolute count vs recent rate — is the discuss-phase memory-shape decision), it is excluded from the top-K returned by `rankForSelector`.
   - Acceptance: a fixture candidate with rejection signal ≥ N is ABSENT from `rankForSelector` output; the same candidate at N-1 is PRESENT (discounted per Req 3).

5. **N is a named, conservatively-tuned threshold (not a magic literal)**: the suppression gate is legible and tunable.
   - Current: n/a.
   - Target: N (and the discount cap from Req 3) are named module constants with a documented rationale noting the low-data (~4 user, <100 edge) overfitting risk; no inline numeric literal at the suppression check.
   - Acceptance: grep finds a named constant (e.g. `REJECTION_SUPPRESS_THRESHOLD`) used at the suppression check; no bare numeric literal gates suppression; a comment cites the low-data tuning rationale.

6. **Part 8 boundary — counts/enums only, never reason strings**: the penalty reads rejection COUNT/outcome-enum, never the rejection reason text.
   - Current: rejection reasons are stored as `REJECTED_BECAUSE` / reason payloads (user content, graph-local).
   - Target: the penalty consumes only the rejection COUNT (or recent-rate) and outcome ENUM; no reason string, no freeform payload field enters the ranker or any packet.
   - Acceptance: a Part 8 boundary scan over the new code finds zero reads of rejection reason strings / freeform payload fields; only counts/enums are referenced (mirrors the Phase 90 / 110 forbidden-substring tripwire pattern).

7. **Part 9 locality — read via the navigation chokepoint**: outcome edges are read only through `navigation.cjs`.
   - Current: Canon Part 9 mandates SQL-as-local-mind reads go through the `lib/core/navigation.cjs` chokepoint (Phase 109).
   - Target: the penalty reads rejection outcome edges/counts exclusively via `navigation.cjs` functions — no direct sqlite handle, no filesystem scan in the ranker path.
   - Acceptance: grep over the new code shows reads only through `navigation.cjs`; no `require('better-sqlite3')`/direct DB open and no `fs` read of room data in the penalty path.

8. **NOT the dormant full SEED-009**: no learned weights, no weight table.
   - Current: the `0.40/0.30/0.30` ensemble weights are static priors; SEED-009 (the `ranker_weights` table + gradient-descent refit) is dormant behind its ≥30-user / ≥1000-edge trigger.
   - Target: this phase adds ONLY the bounded penalty + hard suppression; it does NOT create a `ranker_weights` table, does NOT mutate the ensemble weights, and leaves the frozen 148 contracts untouched.
   - Acceptance: no `ranker_weights` table DDL is added; the `0.40/0.30/0.30` literals are unchanged; the frozen-6 invariant test (REACH_IDS=6, DIAL_REACH_K=6, MAX_K=3, 0.70/0.15 gate, 3 postures) stays green.

## Boundaries

**In scope:**
- A bounded, investment-scaled rejection penalty applied on the existing `_applyDecay` IoC seam
- HARD suppression of a candidate once its rejection signal reaches the named threshold N
- Named, documented constants for N and the discount cap (with low-data tuning rationale)
- Part 8 boundary test (counts/enums only) + Part 9 chokepoint-read discipline for the new path
- A byte-stable-at-zero-rejections regression guard
- Reuse of the shipped `f_selector_decision(outcome=reject)` / REJECTED outcome edges as the input signal

**Out of scope:**
- The FULL SEED-009 learned-weight refit (`ranker_weights` table, gradient descent, ensemble retuning) — dormant behind its ≥30-user / ≥1000-edge trigger; overfits the Wave-1 cohort now
- **WHICH rank surface the penalty hooks** (`f-selector-ranker.cjs` command candidates vs `dial-reach-orchestrator.cjs` the 6 reaches) — DEFERRED to discuss-phase; resolve with a seam trace of where the reject outcome edges actually attach. Do NOT pre-decide here.
- **The memory shape** (recent-rate-with-fade vs absolute-cumulative-count for N's unit) — DEFERRED to discuss-phase
- Any change to the ensemble weights `0.40/0.30/0.30` or the frozen 148 contracts
- Any Brain read/write or Brain orchestration graph (that is Phase 157)
- Surfacing the penalty/suppression reason in the dial UI (legibility = BOG-07 / Phase 157 territory)

## Constraints

- Reuse the `scripts`/`lib` IoC seam (`_applyDecay` + `selector-decisions.cjs applyDecayWeight`); no new heavy dependency; CJS.
- Canon Part 8: only generic machinery signals (counts/enums) — never rejection reason strings — touch the ranker or any packet.
- Canon Part 9: outcome-edge reads go through `lib/core/navigation.cjs` only.
- `rankForSelector(candidates, opts) -> ranked[]` surface contract is unchanged.
- HARD RULE: no em-dashes (hyphens only). Tri-Polar: the ranker is shared core consumed identically across CLI / Desktop / Cowork.
- Low-data guardrail: N and the cap must be tuned conservatively given ~4 users and <100 outcome edges; document the rationale.

## Acceptance Criteria

- [ ] A candidate with rejections ranks strictly below an otherwise-identical zero-rejection candidate, via the existing `_applyDecay` seam (no edit to the `0.40/0.30/0.30` literals)
- [ ] A zero-rejection fixture room produces byte-identical ranked output to the captured pre-phase baseline; existing ranker tests stay green
- [ ] Below N, a candidate is discounted but present in `rankForSelector` output, discount ≤ the documented cap
- [ ] At rejection signal ≥ N, the candidate is ABSENT from the top-K; at N-1 it is PRESENT
- [ ] N and the cap are named constants with a documented low-data tuning rationale; no magic literal gates suppression
- [ ] Part 8 scan: zero reads of rejection reason strings / freeform payload fields in the new code (counts/enums only)
- [ ] Part 9: the penalty path reads outcome edges only through `navigation.cjs` (no direct DB/fs read)
- [ ] No `ranker_weights` table is added; the frozen-6 invariant test (REACH_IDS=6, DIAL_REACH_K=6, MAX_K=3, 0.70/0.15, 3 postures) stays green

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes                                                                 |
|--------------------|-------|-------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75  | ✓      | Discount + hard-suppress-at-N + byte-stable-at-zero; outcome is measurable |
| Boundary Clarity   | 0.86  | 0.70  | ✓      | Minimal-vs-full SEED-009 fenced; surface + memory-shape explicitly deferred to discuss |
| Constraint Clarity | 0.80  | 0.65  | ✓      | Reuse the seam; Part 8 counts-only; Part 9 chokepoint; surface contract unchanged |
| Acceptance Criteria| 0.83  | 0.70  | ✓      | 8 pass/fail checks                                                     |
| **Ambiguity**      | 0.16  | ≤0.20 | ✓      | Gate passed; all minimums met                                         |

## Interview Log

| Round | Perspective     | Question summary                                              | Decision locked                                                                 |
|-------|-----------------|--------------------------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Scout (Larry)   | What seam exists? Full vs minimal SEED-009?                   | `_applyDecay` IoC rail is the seam; build MINIMAL (bounded penalty), defer full SEED-009 (overfits at <100 edges) |
| 1     | Navigator       | Which rank surface does the penalty hook?                    | DEFERRED to discuss-phase — resolve by tracing where reject outcome edges attach |
| 1     | Navigator       | Memory shape: recent-rate-with-fade vs absolute-cumulative?  | DEFERRED to discuss-phase; spec requires only "chronically-rejected ranks lower, bounded, byte-stable at zero" |
| 1     | Navigator       | Soft (bounded, never fully suppressed) vs hard suppression?  | HARD — suppress from top-K at ≥ N rejections (navigator-LOCKED); N must be a named, conservatively-tuned constant given low data |

---

*Phase: 158-bounded-rejection-penalty-seed-009-minimal*
*Spec created: 2026-06-15*
*Next step: /gsd-discuss-phase 158 — implementation decisions (surface trace: commands vs reaches; memory shape: rate vs count; the N + cap values)*
