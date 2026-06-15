# Phase 158: bounded rejection-penalty (SEED-009-minimal) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the open rejection->ranking feedback loop with the SMALLEST fix: a bounded, accumulating REJECT penalty on the shipped `_applyDecay` IoC seam, plus hard-suppression-with-parole gated by low-data bias fences. The seam trace (this discussion) found ONE rejection sink (`f_selector_decision` per command, in `selector-decisions.cjs`) that BOTH the command-candidate surface and the 6-reach dial surface feed, and an existing recency decay that forgets prior rejections. This phase makes REJECT accumulate and persist instead of silently recovering. LOCAL-only; no Brain dependency; builds BEFORE Phase 157.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `158-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `158-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** bounded investment-scaled reject penalty on the existing `_applyDecay` seam; hard suppression at named threshold N; named/documented constants for N + discount cap (low-data rationale); Part 8 boundary test (counts/enums only) + Part 9 chokepoint reads; byte-stable-at-zero regression guard; reuse of the shipped `f_selector_decision(outcome=reject)` / REJECTED edges as the input signal.
**Out of scope (from SPEC.md):** the FULL SEED-009 learned-weight refit (`ranker_weights` table, gradient descent); any change to the `0.40/0.30/0.30` weights or the frozen 148 contracts; any Brain read/write or the Phase 157 orchestration graph; dial-UI surfacing of the suppression reason (BOG-07 / Phase 157 territory).

</spec_lock>

<decisions>
## Implementation Decisions

### SURFACE CORRECTION (navigator-LOCKED 2026-06-15, AFTER plan-check) - SUPERSEDES D-01/D-02/D-04/D-07 below
The first plan-check (gsd-plan-checker) red-teamed the plans and found the command-surface premise WRONG for the suppression + counter halves. The navigator chose to target THE 6-REACH DIAL (what the user sees). This block supersedes the command-surface framing in D-01/D-02/D-04/D-07 below (kept for history):
- **SC-01 (surface):** the penalty + hard-suppression target the DIAL REACH surface: `lib/hmi/dial-reach-orchestrator.cjs` `_resolveReachScore(def, roomState)` (reads `roomState.reachScores[reach_id]`) + `buildReachList`. NOT `rankForSelector` / the `_applyDecay` command rail. The dial renders the 6 fixed `reach_id`s (context_block / contradiction / cross_room / brain_consult / deep_research / hats); reaches are NOT commands.
- **SC-02 (re-key cmd -> reach_id):** the reject signal, the count-in-window, the penalty, and the presentation counter all key by `reach_id`, NOT `cmd:<command>`. (Confirm at close: that the rejected reach's `reach_id` is captured - research item.)
- **SC-03 (injection point):** discount the rejected reach_id's score inside `_resolveReachScore`; hard-suppression DROPS the reach_id from the ranked set BEFORE the top-K slice in `buildReachList`, analogous to the command-side drop-before-sort/slice (D-08b).
- **SC-04 (dormant rail = moot here, but still a latent finding):** BLOCKER 2 (no production consumer injects `_applyDecayWeight`, so the shipped PIVOT/DEFER recency decay is inert in production) NO LONGER blocks this phase - we are off that rail. It remains a real latent bug worth its own follow-up (note in deferred).
- **SC-05 (FROZEN-148 guard - LOAD-BEARING):** `_resolveReachScore` / `buildReachList` is the frozen-148 surface. Suppression may discount a score and drop a reach from the RENDERED top-K, but MUST NOT change DIAL_REACH_K=6 (the bank stays 6), MAX_K=3, the 0.70/0.15 gate semantics, or the 6 REACH_IDS. The frozen-6 invariant test MUST stay green (it asserts the BANK is 6, not that 6 always render). Research must confirm.
- **SC-06 (db + counter seam):** the render seam `scripts/intent-classifier.cjs:896` calls `buildReachList({tierMode, reachScores})` with NO db; the LIVE engine arm (~1331-1478) holds `roomState.db`. The `reach_presented` counter (keyed by reach_id) must fire where db exists on the live arm - research locates it.

### SC-07 (resolved data flow - keep buildReachList PURE; reach-surface research 2026-06-15, HIGH confidence)
- **Pure orchestrator, fold upstream:** do ALL db work on the LIVE engine arm (`runNavigationEngine`, db open `intent-classifier.cjs:1341` / closed `:1488`, render at `:1757`). There: (1) read per-`reach_id` reject-counts + presentation-counts via `navigation.findRecentChanges` filtered by `properties.reach_id` (the shipped command-scan idiom); (2) compute the bounded discount + a `suppressedReachIds` set; (3) FOLD the discount into `roomState.reachScores` and pass `suppressedReachIds` so the PURE `buildReachList` drops them before its sort (`:241`) / `_applyFrozenGate` (`:244`). db is NEVER threaded into `dial-reach-orchestrator`.
- **Injection:** discount multiplies `roomState.reachScores[reach_id]` (folded upstream, or in `_resolveReachScore:143`); hard-suppress DROPS the reach_id in `buildReachList` BEFORE sort + frozen gate. NO recency factor exists on the reach surface, so the penalty is the SOLE multiplier (`score * (1 - countPenalty)`) - simpler than the command-rail LAYER.
- **reach_presented counter:** fire on the live arm (db present), keyed by `reach_id`, one additive memory_event; the pure render path never writes.
- **closeReach reach_id forwarding (the minimal keying fix):** add an OPTIONAL `reach_id` enum to `recordSelectorDecision` (off-`REACH_IDS` ignored; FIX-05 optional-merge idiom; Part 8 enum-only) and forward `reach.reach_id` from `closeReach`'s reject branch. PLANNER MUST PIN FIRST: the offer->close two-turn propagation (the `renderF1` payload at `intent-classifier.cjs:1692-1710` -> next-turn `closeReach`) so `reach_id` survives the turn boundary. Value exists; it is propagation, not a new lookup.
- **Constants re-confirmed for 6 reaches / MAX_K=3:** N=3 counts rejects of ONE reach_id, so the 6-bank size is irrelevant to N (D-09 values stand).
- **BLOCKER 2 (dormant _applyDecay rail) is OUT of this phase** (SC-04); noted in deferred as a separate latent finding.

### Surface (commands vs reaches) - the spec-deferred fork, RESOLVED BY TRACE [SUPERSEDED by SC-01]
- **D-01:** Hook the penalty into the command-level `_applyDecay` seam (`f-selector-ranker.cjs` consuming `selector-decisions.applyDecayWeight`). Evidence: `closeReach` (`dial-close-reach.cjs:236`) delegates a REACH reject to `recordSelectorDecision` keyed by `reach.command`, writing the REJECTED edge + `f_selector_decision` row on `cmd:<command>`; `applyDecayWeight` reads those rows per command. So reaches collapse to their command key - ONE penalty at the command seam covers BOTH surfaces. There is no separate decay path in `dial-reach-orchestrator`. The commands-vs-reaches question dissolves: it is the command seam, and reaches feed it.
- **D-01a (no-command guard):** when a reach has no `reach.command` (e.g. a render-only family), the penalty must degrade to ZERO (no penalty), never throw. Graceful by construction.

### Decay strategy (Area 2) - LAYER, do not replace
- **D-02:** LAYER a new persistent count-penalty factor on top of the shipped transient recency factor; do NOT rewrite `applyDecayWeight`'s core. Shape: `adjusted = base * recencyFactor * (1 - countPenalty)`, where `recencyFactor = 1 - exp(-(n / DECAY_WINDOW))` is the EXISTING transient signal (just-rejected dip -> recover) and `countPenalty` is the NEW persistent, bounded discount that grows with the REJECT count. Rationale: Part 7 reuse + byte-stable-at-zero (Req 2) + lowest regression risk to the tested Phase 125 D7 contract.
- **D-02a (combined-suppression floor):** below the hard-suppression threshold, the combined multiplicative suppression is clamped by a documented floor so a heavily-rejected-but-recovering command does not land at exactly 0 by accident (0 is reserved for the hard-suppress path).

### Outcome differentiation (Area 3) - REJECT accumulates; DEFER/PIVOT unchanged
- **D-03:** The new `countPenalty` counts REJECT outcomes ONLY. DEFER keeps its existing transient decay + 30d expiry; PIVOT keeps its single-term nudge. REJECT is the one signal that persists and accumulates - that is the operative meaning of Canon Decision 13 ("rejection is data"), distinct from the two softer signals. The count reads the outcome ENUM (`edge_semantic` / decision) from the `f_selector_decision` payload - never the reason string (Part 8).

### Memory shape (spec-deferred) - RESOLVED as count-within-window
- **D-04:** The rejection signal is the REJECT count WITHIN the trailing recency-aging window W (D-05), not a lifetime cumulative count and not a per-presentation rate computed separately. Count-within-window is a rate in disguise and is what both the accumulation (D-03) and the aging fence (D-05) consume. This resolves the spec's deferred rate-vs-count question.

### Hard suppression + bias fences (Area 4) - hard-drop-with-parole, ALL fences
- **D-05:** Hard-suppress (drop from the returned top-K) at REJECT count >= N within window W, gated by ALL FOUR bias-control fences (navigator chose every fence):
  - **(M) min-presentations floor** - a candidate is suppression-eligible only after it has been PRESENTED >= M times. Defuses the "1-2 noisy rejects nuke a useful reach" attack at small sample.
  - **(W) recency-aging window** - only rejections inside the trailing window W count toward N, so suppression EXPIRES and the reach gets parole. The primary fix for the confirmation-bias loop.
  - **periodic parole re-surface** - independently of aging, every Pth presentation a suppressed reach is forced back into the candidate set to re-test the navigator. Extra insurance against the loop.
  - **per-room scope only** - suppression state is room-local, NEVER aggregated across rooms (Canon Part 8 constitutional fence; called out explicitly).
- **D-06 (parole determinism - red-team-driven):** parole MUST be deterministic - keyed on a presentation counter (every Pth presentation), NOT `Math.random()`. Reason: RNG injects non-determinism into ranking and breaks testability. Parole only fires for already-suppressed reaches (which require rejections), so byte-stable-at-zero (Req 2) is preserved.

### Red-Team / Bias-Control Ledger (navigator requested red-teaming + bias control)
Attacks considered and the fence that defuses each:
- **Noise attack** (a couple of off-turn rejects permanently hide a useful reach) -> M (min-presentations floor) + W (aging).
- **Confirmation-bias loop** (suppressed -> never shown -> never earns accept data -> stays suppressed forever) -> W (aging expires the streak) + periodic parole (forces re-test). THE central low-data risk; double-fenced.
- **Cold-start over-suppression** (near-zero data, suppression fires too eagerly) -> M floor + byte-stable-at-zero default.
- **Cross-room leakage** (one room's rejections bias another) -> per-room scope (Part 8); not optional.
- **Double-crush** (transient recency factor x count penalty over-suppresses) -> combined-suppression floor (D-02a); the two factors are complementary (transient vs persistent), not redundant.
- **Non-determinism from parole** (RNG makes ranking unstable/untestable) -> deterministic parole counter (D-06).
- **Overfitting the Wave-1 cohort** (the reason the FULL SEED-009 stays dormant) -> this phase adds NO learned weights; only a bounded heuristic penalty justified at any edge count.

### Post-research scope decision (navigator-LOCKED 2026-06-15, after 158-RESEARCH.md)
- **D-07 (presentation counter IS in-scope):** the navigator chose FULL scope (all 4 fences). The research confirmed the landmine: NO existing signal records that a specific reach/command was OFFERED (the dial render path is pure; `selector_presentation` is command-anonymous; `suggestion_surfaced` / `f_selector_miss` fire on other paths). M-floor + periodic parole REQUIRE a presentations count, so this phase ADDS one lightweight additive `reach_presented` memory_event at the dial-render seam, keyed to `cmd:<command>` (same collapse as `closeReach`), Part 8 enum/scalar-only. This is the enabler of the locked fences, not scope creep. (Note: hard-suppress + W-aging alone could run on the existing invocation signal, but FULL scope unifies M/W/parole on presentation-units.)
- **D-08 (seam-bug fixes the plan MUST carry, from research):**
  - (a) the existing `_invocationsSinceDecision` counts ALL `f_selector_decision` rows (defer + reject); the NEW reject count must filter `decision === 'reject'` / `edge_semantic === 'REJECTED'` itself (the enum IS in the payload - D-03 + Part 8 both satisfiable without reading `reason`).
  - (b) hard-suppression must DROP the candidate inside the scoring loop BEFORE `scored.sort` (`f-selector-ranker.cjs:451`) and `slice(0,k)` (`:465`), not after - else a suppressed item rides or leaves a hole. The drop is distinct from the D-02a combined-suppression floor (which deliberately keeps below-threshold scores off 0).
- **D-09 (constant starting values, tunable-later):** N=3 (hard-suppress threshold), M=2 (min-presentations floor), W=8 (recency window), P=5 (parole period), CAP=0.6 (countPenalty cap), FLOOR=0.05 (combined-suppression floor). Grounded against shipped reference points DECAY_WINDOW=5 and PIVOT_PENALTY_FLOOR=0.2; conservative for ~4 users / <100 edges; flagged tunable from telemetry later. All are NAMED constants per RJP-05.
- **D-10 (open questions resolved):** (Q1) the W window unit is PRESENTATION-units, consistent with M + parole now that the counter exists. (Q2) the planner's FIRST task locates where the dial CONSUMER holds `roomState.db` (the seam that fires `reach_presented`) - the one scope-risk the research named; do NOT thread db into the pure orchestrator. (Q3) `reach_suppressed` / `reach_paroled` observability events are DEFERRED unless trivially cheap (planner discretion) - not required for the fences to work.

### Claude's Discretion
- The precise bounded shape of `countPenalty` (linear `min(CAP, count/SOMETHING)` vs a gentler curve) - left to plan, must be bounded by CAP (D-09).
- Plan/wave structure (the research suggests the counter could be an isolated first wave; the navigator chose Full without mandating that split - planner decides sequencing).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/158-bounded-rejection-penalty-seed-009-minimal/158-SPEC.md` - locked requirements (RJP / 8 reqs) - MUST read before planning

### Authority (why this phase exists, and the minimal-vs-full boundary)
- `.planning/phases/157-brain-orchestration-graph-and-methodology-tiers/157-RESEARCH.md` - the reverse-salient finding + leverage point 1 (the layer records but does not learn)
- `.planning/seeds/SEED-009-learned-ranker-weights-from-outcome-edges.md` - the FULL refit boundary + the two-gate dormancy trigger (>=30 users AND >=1000 edges)

### The seam to extend (Part 7 reuse)
- `lib/workflow/f-selector-ranker.cjs` - `_applyDecay` (lines ~205, ~421) the IoC seam; `_scoreCommand` (~278-292) the D4 weights to leave UNTOUCHED
- `lib/workflow/selector-decisions.cjs` - `applyDecayWeight` + `_invocationsSinceDecision` (the recency factor to LAYER on); `recordSelectorDecision` (writes the REJECTED edge + `f_selector_decision` row); `DECAY_WINDOW` constant idiom
- `lib/workflow/dial-close-reach.cjs` - `closeReach` reject/defer path (line ~236) delegating to `recordSelectorDecision` keyed by `reach.command` (the proof reaches collapse to command keys)
- `lib/core/navigation.cjs` - `findRecentChanges` / `writeEdge` / `logMemoryEvent` (the Part 9 chokepoint; the ONLY read path)
- `lib/hmi/reach-component-map.json` - reach -> command mapping (relevant to the D-01a no-command guard)

### Canon (the constitutional fences)
- `docs/MINDRIAN-CANON.md` Part 4 (Decision 13 "rejection is data" - the obligation this phase honors), Part 8 (per-room scope / counts-not-reasons boundary), Part 9 (chokepoint locality)
- `docs/MINDRIAN-CANON.md` Appendix D entry 15 + the frozen 148 contracts (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, 6 reaches, 3 postures) - MUST stay green

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_applyDecay(applyDecayWeight, baseScore, commandId, roomState)` (f-selector-ranker.cjs): the injected-function seam; the penalty rides here (extend the injected fn or add a sibling on the same rail).
- `applyDecayWeight` + `_invocationsSinceDecision` (selector-decisions.cjs): the transient recency factor to layer on; already reads `f_selector_decision` per command via `navigation.findRecentChanges`.
- `recordSelectorDecision` (selector-decisions.cjs): already writes the REJECTED edge + `f_selector_decision(decision/edge_semantic)` enum payload - the input signal exists; no new writer needed.
- `closeReach` (dial-close-reach.cjs): reach reject -> `recordSelectorDecision` keyed by `reach.command` - proves the single-sink finding.

### Established Patterns
- Byte-stable-at-zero idiom: "no decision recorded -> return base_score unchanged" (the pattern the count penalty must preserve).
- Named-constant idiom: `DECAY_WINDOW` (N / M / W / P / cap follow the same named-constant discipline; no magic literals).
- Part 8 enum/scalar-only payloads + the Phase 90/110 forbidden-substring tripwire test pattern (the boundary test mirrors it).
- Frozen-6 invariant test (must stay green; this phase touches none of the frozen constants).

### Integration Points
- One seam: the penalty plugs into `_applyDecay`; no parallel scoring path.
- One read path: outcome edges read only through `navigation.cjs` (Part 9).
- No schema change: NO `ranker_weights` table (that is the dormant full SEED-009). Suppression state derives from existing `f_selector_decision` + presentation counts.

</code_context>

<specifics>
## Specific Ideas

- The concrete failure to kill: a command rejected 5 turns running re-surfaces at the top on turn 6 because the shipped recency factor recovers fully (factor -> 1 as invocations grow) and counts only the LAST decision. After this phase a >= N-rejected (within W) command stays out of the top-K, subject to parole.
- "Hard suppression" becomes "hard suppression WITH parole" - the synthesis of the navigator's hard-drop choice (158-SPEC Req 4) and the four bias fences (D-05).

</specifics>

<deferred>
## Deferred Ideas

- FULL SEED-009: the `ranker_weights` table + gradient-descent ensemble refit - dormant behind >=30 active users AND >=1000 outcome edges (we have ~4 / <100). Re-surface at that trigger.
- Legibility (BOG-07 / Phase 157): surfacing the suppression/penalty reason in the dial "why" block so the navigator sees WHY a reach was dropped. Out of this minimal phase.
- Cross-navigator rejection pattern detection ("N other navigators rejected this reach") - Canon Part 8 separate-product / separate-installer territory (157-RESEARCH open question 5). Explicitly OUT.
- Re-tuning N / M / W / P from real telemetry once the outcome-edge count grows - a future calibration pass, not this build.
- **LATENT BUG (found by the 158 plan-check, 2026-06-15): the `_applyDecayWeight` IoC rail is DORMANT in production** - no consumer injects `_applyDecayWeight` into `rankForSelector` (`navigation-engine-offer.cjs:113`, `dial-reach-orchestrator.cjs:123`, `suggest-next-command.cjs:322` all call it without the hook), so the shipped Phase 125 PIVOT/DEFER recency decay never fires on the command-suggestion surfaces. OUT of Phase 158 (we target the reach surface). Worth its own small follow-up: either wire the rail or retire the dead code. Capture as a seed/debug item.

</deferred>

---

*Phase: 158-bounded-rejection-penalty-seed-009-minimal*
*Context gathered: 2026-06-15*
*Next step: /gsd-plan-phase 158 - break the decisions above into an executable plan*
