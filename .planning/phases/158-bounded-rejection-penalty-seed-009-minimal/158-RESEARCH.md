# Phase 158: bounded rejection-penalty (SEED-009-minimal) - Research

**Researched:** 2026-06-15
**Re-scoped:** 2026-06-15 (AFTER plan-check; SURFACE CORRECTION SC-01..06 in CONTEXT.md)
**Domain:** Local DIAL-REACH feedback loop -- bounded REJECT penalty + hard-suppression-with-parole on the FROZEN dial-reach surface (`lib/hmi/dial-reach-orchestrator.cjs` `_resolveReachScore` / `buildReachList`), keyed by `reach_id`, gated by four low-data bias fences. Generic plugin machinery; no user data, no Brain queries.
**Confidence:** HIGH (every load-bearing claim is `[VERIFIED: codebase grep/read]` against shipped code in this repo)

---

> ## RE-SCOPE BANNER (read first)
>
> The first plan-check red-teamed the prior (command-surface) framing and found it
> wrong for the suppression + counter halves. The penalty + hard-suppression now
> target the **6-REACH DIAL** the navigator actually sees, keyed by `reach_id`, NOT
> the command-ranker `rankForSelector` rail. This document is REVISED IN PLACE:
>
> - **KEPT (still valid):** the constants (N/M/W/P/CAP/FLOOR), the Part 8 grep-sweep
>   idiom, the deterministic-test discipline, the byte-stable-at-zero idiom, the
>   EVENT_TYPES additive-floor idiom, the frozen-148 contract idioms.
> - **SUPERSEDED (command-surface; struck through / marked):** every section that
>   keyed off `rankForSelector` / `f-selector-ranker.cjs` `_applyDecay` / `cmd:<command>`
>   as the injection point. These are marked `[SUPERSEDED by SC-01..06]` inline and
>   kept for history.
> - **NEW (reach-surface):** the `## Reach-Surface Findings (SC-01..06)` section below
>   (priorities 1-7), and a rewritten `## Validation Architecture`.
> - **ABANDONED RAIL:** `_applyDecayWeight` / the command `_applyDecay` IoC seam is
>   DORMANT in production (no consumer injects it) and is OFF the critical path now.
>   It remains a latent bug (BLOCKER 2) worth its own follow-up; see Deferred.
>
> The 6 reaches are **reach_ids**, NOT commands:
> `context_block / contradiction / cross_room / brain_consult / deep_research / hats`
> `[VERIFIED: dial-reach-orchestrator.cjs:74-83 REACH_DEFS / REACH_IDS]`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### SURFACE CORRECTION (navigator-LOCKED 2026-06-15, AFTER plan-check) -- SUPERSEDES D-01/D-02/D-04/D-07
- **SC-01 (surface, LOCKED):** the penalty + hard-suppression target the DIAL REACH surface -- `lib/hmi/dial-reach-orchestrator.cjs` `_resolveReachScore(def, roomState)` (reads `roomState.reachScores[reach_id]`) + `buildReachList`. NOT `rankForSelector` / the `_applyDecay` command rail. The dial renders the 6 fixed reach_ids; reaches are NOT commands. (Surface decision LOCKED -- do NOT relitigate command-vs-reach.)
- **SC-02 (re-key cmd -> reach_id):** reject signal, count-in-window, penalty, presentation counter ALL key by `reach_id`. Research conclusion (b): `reach_id` is NOT captured at close today; `closeReach` + `recordSelectorDecision` must carry an OPTIONAL `reach_id` enum (Priority 1 above).
- **SC-03 (injection point):** discount in `_resolveReachScore`; hard-suppression DROPS the reach_id from `buildReachList` BEFORE the desc-sort (:241) + the frozen gate (:244). NO recency multiplier on this surface -- the penalty is the sole multiplier (Priority 2).
- **SC-04 (dormant rail abandoned):** the `_applyDecayWeight` command IoC rail has no production consumer; we are OFF that rail. Remains a latent bug -> Deferred follow-up.
- **SC-05 (frozen-148 guard, LOAD-BEARING):** discount + drop must NOT change `DIAL_REACH_K=6`, `MAX_K=3`, the 0.70/0.15 gate, or the 6 `REACH_IDS`. The frozen-6 invariant test asserts the BANK is 6 (the CONSTANT), not that 6 always render -- so a drop is safe (Priority 3, adversarially verified).
- **SC-06 (db + counter seam):** the `reach_presented` counter (keyed by reach_id) fires on the LIVE engine arm inside `runNavigationEngine` (intent-classifier.cjs:1339-1488) where `roomDb` is open; reject-counts are read upstream there and folded into `reachScores` + a `suppressedReachIds` set passed into the PURE `buildReachList` -- db is NEVER threaded into the orchestrator (Priority 4).

### Locked Decisions (D-01/D-02/D-04/D-07 SUPERSEDED by SC-01..06; re-interpreted below)
- ~~**D-01 / D-01a (command seam + no-command guard):**~~ `[SUPERSEDED by SC-01/SC-02]` -- the command-key collapse is abandoned. The reach surface keys by `reach_id`; the analogue of the no-command guard is: a reach with no resolvable `reach_id` (or off-`REACH_IDS`) yields penalty 0, never throws (enum-gate idiom).
- ~~**D-02 (layer on recency factor):**~~ `[SUPERSEDED by SC-03]` -- there is NO recency factor on the reach surface; the shape collapses to `adjusted = baseReachScore * (1 - countPenalty)`.
- **D-02a (combined-suppression floor):** STILL APPLIES, re-keyed -- below N, `adjusted` is clamped to >= `base * FLOOR` so a heavily-rejected-but-below-N reach never lands at exactly 0 (0 reserved for the hard-suppress drop).
- **D-03 (REJECT-only):** STILL APPLIES, re-keyed -- `countPenalty` counts `f_selector_decision(decision='reject' / edge_semantic='REJECTED')` rows for THIS reach_id only; DEFER/PIVOT do not contribute. Enum read only, never `reason` (Part 8).
- ~~**D-04 (count-within-window):**~~ re-keyed under SC-02 -- the reject count is WITHIN the trailing W presentations OF THIS reach_id (presentation-units, Priority 5).
- **D-05 (four fences):** STILL APPLIES, re-keyed -- hard-suppress (DROP from the rendered top-K) at reject-count >= N within W per reach_id, gated by (M) min-presentations, (W) aging, (P) deterministic parole, (per-room) scope.
- **D-06 (deterministic parole):** STILL APPLIES, re-keyed -- parole fires on `presentationsCount(reach_id) % P === 0`, never RNG. Byte-stable-at-zero preserved.
- **D-09 (constants):** STILL APPLY, re-keyed per reach_id (N=3, M=2, W=8, P=5, CAP=0.6, FLOOR=0.05) -- re-confirmed for 6 reaches / MAX_K=3 in Priority 7.

### Claude's Discretion
- The exact values of N, M, W, parole period P, the `countPenalty` cap, and the combined-suppression floor -- tuned CONSERVATIVELY given ~4 users / <100 outcome edges (documented rationale required). Lean: small N, M >= a couple of presentations, W short enough that stale streaks expire within a working session or two.
- The precise bounded shape of `countPenalty` (linear `min(1, count/CAP)` vs a gentler curve) -- must be bounded.
- Whether to emit a `memory_event` (`reach_suppressed` / `reach_paroled`) for observability per Part 4 -- lean YES but minimal (enum/scalar payload only).

### Deferred Ideas (OUT OF SCOPE)
- FULL SEED-009: the `ranker_weights` table + gradient-descent ensemble refit -- dormant behind >=30 active users AND >=1000 outcome edges.
- Legibility (BOG-07 / Phase 157): surfacing the suppression/penalty reason in the dial "why" block.
- Cross-navigator rejection pattern detection -- Canon Part 8 separate-product territory.
- Re-tuning N / M / W / P from real telemetry once the outcome-edge count grows.
- **(SC-04, NEW) Dormant `_applyDecayWeight` command rail.** The shipped command-side recency decay (`f-selector-ranker.cjs` `_applyDecay` consuming `selector-decisions.applyDecayWeight`) has NO production consumer injecting `opts._applyDecayWeight`, so the PIVOT/DEFER recency decay is inert in production. This phase is OFF that rail (we use the reach surface). The dormant rail remains a real latent bug worth its own follow-up phase (wire a consumer or remove the dead seam) -- recorded here so it is not lost.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

> RJP-01..08 re-interpreted with "candidate" = `reach_id` (SC-02). The seam moves
> from the command `_applyDecay` rail to the dial-reach `_resolveReachScore` /
> `buildReachList` surface.

| ID | Description (reach-surface reading) | Research Support |
|----|-------------|------------------|
| RJP-01 | Rejection signal rides the dial-reach scoring seam (Part 7 reuse) | Inject the discount in `_resolveReachScore` (dial-reach-orchestrator.cjs:143-151); read reject-counts upstream on the live arm. No `rankForSelector` edit. See Priority 1+2+4. |
| RJP-02 | Byte-stable at zero rejections | Zero REJECT for a reach_id -> `countPenalty=0` -> `score*(1-0)=score` -> identical `buildReachList` output. Validation: reach byte-baseline test. |
| RJP-03 | Bounded discount below N | `countPenalty = min(CAP, count/DENOM)` per reach_id, bounded by CAP=0.6. Below N the reach stays present with a reduced positive score (D-02a floor). |
| RJP-04 | HARD suppression at N (DROP from top-K) | Drop the reach_id from `buildReachList`'s `reaches` BEFORE the `.sort` (:241) + `_applyFrozenGate` (:244). See Priority 2/3. |
| RJP-05 | N is a named, conservatively-tuned constant | Mirror the `DECAY_WINDOW = 5` named-constant idiom (selector-decisions.cjs:61). Constants re-confirmed for 6 reaches in Priority 7. |
| RJP-06 | Part 8 -- counts/enums only, never reason strings | Read `decision`/`edge_semantic`/`reach_id` ENUMS; NEVER `properties.reason`. The new `reach_id` field is a generic machine enum (Part 8 safe). Validation: forbidden-substring scan. |
| RJP-07 | Part 9 -- read via `navigation.cjs` chokepoint | Read reach reject-counts + `reach_presented` counts only via `navigation.findRecentChanges`. Orchestrator stays PURE (no db). No direct sqlite, no fs. |
| RJP-08 | NOT the dormant full SEED-009; frozen-148 green | No `ranker_weights` table; `DIAL_REACH_K=6`/`MAX_K=3`/0.70/0.15/6-bank untouched (Priority 3, SC-05). `0.40/0.30/0.30` command weights untouched. |
</phase_requirements>

---

## Summary

RE-SCOPED to the reach surface (SC-01..06). The penalty + hard-suppression now target the 6-reach dial (`dial-reach-orchestrator.cjs` `_resolveReachScore` / `buildReachList`), keyed by `reach_id`. Four findings dominate.

**(1) KEYING is solvable with a minimal additive change (the make-or-break, SC-02).** The rejected dial reach object ALREADY carries `reach_id` (dial-reach-orchestrator.cjs:229-237), but `closeReach` drops it -- the reject path forwards only `reach.command`/`reach.framework` to `recordSelectorDecision`, which writes NO `reach_id` (dial-close-reach.cjs:236-250; selector-decisions.cjs:211-247) `[VERIFIED]`. Conclusion (b): extend `recordSelectorDecision` with an OPTIONAL `reach_id` enum (FIX-05 optional-merge idiom, off-`REACH_IDS` ignored) and forward `reach.reach_id` from `closeReach`. Additive, signature-compatible, Part-8-clean. NOT a blocker.

**(2) The injection point + the db/counter seam are resolved (SC-03/SC-06).** The discount multiplies `roomState.reachScores[reach_id]` inside `_resolveReachScore` (the ONLY multiplier -- there is NO recency factor on the reach surface, unlike the command rail). Hard-suppression DROPS the reach_id from `buildReachList`'s `reaches` BEFORE the desc-sort (:241) and the frozen gate (:244). The reject-count read + the `reach_presented` write fire on the LIVE engine arm inside `runNavigationEngine` (intent-classifier.cjs:1339-1488) where `roomDb` is open; the discount + a `suppressedReachIds` set are folded into `reachScores` and passed into the PURE `buildReachList` -- db is NEVER threaded into the orchestrator (the render seam at :869-939 has no db; db is closed at :1488 before render at :1757) `[VERIFIED]`.

**(3) The frozen-148 guard holds under a discount + drop (SC-05, adversarially verified).** `test-148-frozen-contracts.cjs` asserts the CONSTANTS (`DIAL_REACH_K===6`, `MAX_K===3`, 0.70/0.15) and `test-reach-ids-drift.cjs` asserts the doctrine BANK is the 6 reach_ids -- NEITHER asserts "6 always render" `[VERIFIED: read in full]`. Dropping a reach from the runtime `reaches` array touches none of them. Four adversarial edge cases (bank below chooser budget, M-floor interaction, empty recommended slot, footer desync) all resolve to already-supported states (Priority 3).

**(4) The validation architecture is fully deterministic, re-keyed to reach_id.** Every fence injects `roomState.reachScores` (the shipped pure seam) + stubbed `rejectCountInWindow[reach_id]` / `presentationsCount[reach_id]` (mirroring `_invocationsSinceDecision`'s seam). Byte-stable-at-zero mirrors `test-drift-baseline.cjs` on `buildReachList`; the Part 8 scan mirrors `run-all-148.sh` step d + `test-navigation-packet-part8-leak.cjs`; the frozen invariant carries `run-all-148.sh`.

**Primary recommendation (SUPERSEDED -- see the reach-surface recommendation below):** ~~Add a thin presentation-counter `memory_event` at the dial-render seam, then layer a bounded `countPenalty` reader (REJECT-only, count-within-W, fence-gated) on the `_applyDecay` rail, hard-dropping at N before truncation.~~ `[SUPERSEDED by SC-01..06]`

**Primary recommendation (RE-SCOPED, reach-surface):** Key the reject signal, the count-in-window, the penalty, the parole counter, and the presentation counter ALL by `reach_id`. (1) Extend `closeReach` + `recordSelectorDecision` to carry an OPTIONAL `reach_id` enum into the `f_selector_decision` payload (Part 8 enum/scalar; the rejected dial reach object already carries `reach_id` -- it is dropped today). (2) Apply the bounded reject DISCOUNT to `roomState.reachScores[reach_id]` INSIDE `_resolveReachScore` (dial-reach-orchestrator.cjs:143), and DROP a hard-suppressed `reach_id` from the ranked array in `buildReachList` BEFORE the desc-sort + before `_applyFrozenGate` (:241-244). (3) Fire the `reach_presented` counter (one event per rendered reach_id) on the LIVE engine arm INSIDE `runNavigationEngine` where `roomDb` is open (intent-classifier.cjs:1339-1488), NOT at the pure render seam (db is already closed there). Mirror the shipped drift-baseline, EVENT_TYPES additive-floor, frozen-148, and Part 8 grep-sweep idioms verbatim.

---

## Reach-Surface Findings (SC-01..06) -- the re-scoped core

> This section answers the 7 priority questions for the reach surface. It is the
> authoritative implementation spec; the command-surface sections further down are
> kept only for history and are marked `[SUPERSEDED]`.

### Reach-surface data flow (the actual build)

```
 LIVE ENGINE ARM  (runNavigationEngine, intent-classifier.cjs:1339-1488 -- roomDb OPEN)
  roomDb = openRoomDbForCaller(roomDir)            (:1341)
   |
   |  decide() ... cortexNodes extracted           (:1481-1485)
   |  [NEW] reach-reject-reader (db live):
   |     per reach_id: rejectCountInWindow(W) + presentationsCount  via navigation.findRecentChanges
   |     -> countPenalty(reach_id), isHardSuppressed(reach_id)  (4 fences: M / W / P / per-room)
   |  [NEW] fire reach_presented per offered top-3 reach_id      navigation.logMemoryEvent(roomDb,...)
   |  fold: reachScores[reach_id] *= (1 - countPenalty);  suppressedReachIds = {...}
   v  (roomDb CLOSED in finally :1488)               threaded out: cortexNodes + discounted reachScores + suppressedReachIds
 PURE RENDER SEAM (renderEngineDecisionWithDial :869-939 -- NO db)
   reachScores (already discounted)  ->  buildReachList({tierMode, reachScores, suppressedReachIds})
        |   _resolveReachScore -> already-discounted score   (dial-reach-orchestrator.cjs:143)
        |   DROP suppressedReachIds BEFORE .sort (:241) + _applyFrozenGate (:244)   <-- SC-03/SC-05
        v
   reaches[<=6, post-drop]  ->  renderDial  ->  AskUserQuestion (top-3)
        |
        v  navigator picks / pivots / rejects a reach (carries reach_id)
   closeReach(outcome='reject', reach{command, framework, reach_id})   <-- SC-02 (NEW reach_id)
        |
   recordSelectorDecision({decision:'reject', command, framework, reach_id})  <-- writes reach_id enum
        |   f_selector_decision payload now carries reach_id (Part 8 enum)
        v   (read back next turn by the reach-reject-reader, keyed by reach_id)
```

The three `[NEW]` boxes are the entire build: the reach-reject-reader on the live arm,
the `reach_presented` write on the live arm, and the optional `reach_id` on the close write.
The orchestrator stays PURE (it receives a discounted `reachScores` + a `suppressedReachIds` set;
it never opens db).

### Priority 1 -- KEYING (SC-02): can the reject signal be keyed by `reach_id`? CONCLUSION: (b) closeReach + recordSelectorDecision must be MINIMALLY extended.

**The trace, end to end:**

1. The dial reach object DOES carry `reach_id`. `buildReachList` returns reaches each shaped `{reach_id, canonical_verb, score, source, brain_component, local_component, recommended}` `[VERIFIED: dial-reach-orchestrator.cjs:229-237]`. So at RENDER time `reach_id` is in hand.

2. At CLOSE time the `reach_id` is **available but dropped**. `closeReach({outcome:'reject', reach, ...})` reads `o.reach` and, on the defer/reject branch, calls `recordSelectorDecision({decision, command: reach.command, framework: reach.framework, reason, roomState})` `[VERIFIED: dial-close-reach.cjs:236-250]`. It forwards ONLY `reach.command` + `reach.framework`. It NEVER reads `reach.reach_id`. The caller that builds the `reach` object for closeReach is the consumer surface (the F.1 closer payload persisted at intent-classifier.cjs:1697-1710 / the offer-closer); whatever object it hands to closeReach can carry `reach_id` because the dial reach already has it -- but TODAY the close path is keyed to `command`, so the field is simply not propagated.

3. The sink writes NO `reach_id`. `recordSelectorDecision` writes the `f_selector_decision` payload `{decision, command, framework, reason, edge_semantic, expires_at, score_at_decision, investment_level_at_decision, source_path:'f-selector:'+command, created_by}` plus the cascade edge `cmd:<command> -REJECTED-> framework:<framework>` `[VERIFIED: selector-decisions.cjs:211-247]`. There is NO `reach_id` field anywhere in the payload or the edge.

**Therefore (a) is FALSE and (b) is the answer.** `reach_id` is NOT already captured at close in a graph-queryable form. The minimal change is:

- **(C1) `recordSelectorDecision`:** accept an OPTIONAL `reach_id` arg; when present and a member of the frozen `REACH_IDS` 6-set, add `reach_id` to the `f_selector_decision` payload as an enum scalar (Part 8 safe -- it is a generic machine token, the same class as `decision`/`edge_semantic`). When absent, add NOTHING (byte-stable for every non-dial caller; mirrors the FIX-05 `ventureFields` optional-merge idiom at selector-decisions.cjs:185-193, 211-222 verbatim). Off-enum value -> ignore (mirror the cortex-reach-adapter KNOWLEDGE_TYPES enum-gate at cortex-reach-adapter.cjs:228-234).
- **(C2) `closeReach`:** on the defer/reject branch, forward `reach.reach_id` (when the caller's `reach` carries it) into the `recordSelectorDecision` call. One added line in the args object at dial-close-reach.cjs:239-245. No signature break (it is an additive optional field).
- **(C3) the consumer caller:** ensure the `reach` object handed to `closeReach` carries `reach_id`. Since the F.1 closer payload is built from the rendered dial (which has `reach_id` per finding #1), this is a propagation-only change in the closer payload assembly, not a new lookup. The planner's FIRST task locates the exact closer line (offer-closer.cjs / the renderF1 payload at intent-classifier.cjs:1692-1710) and threads `reach_id` through.

**Consistency requirement (SC-02, load-bearing):** the SAME `reach_id` keys ALL FIVE counters:
| Counter | Where keyed | Read/write |
|---------|-------------|------------|
| reject count-in-window | `f_selector_decision.reach_id` (NEW) | write at close (C1/C2); read at score-time |
| penalty (discount) | `roomState.reachScores[reach_id]` | applied in `_resolveReachScore` |
| hard-suppression | the `reach_id` dropped from `buildReachList` | drop before sort |
| presentation count | `reach_presented.reach_id` (NEW event) | write at live engine arm; read at score-time |
| parole counter | `reach_presented` count % P per `reach_id` | read at score-time |

All five agree because they all key by the frozen `reach_id` enum, written at close (reject) and at render (presentation), read at the next score-time. The `command`-keyed `cmd:<command>` collapse from the OLD plan is ABANDONED.

**Not a blocker.** The change is additive, optional-field, Part-8-clean, and signature-compatible. No large refactor; no schema migration (memory_event payloads are schemaless JSON via `logMemoryEvent`).

### Priority 2 -- INJECTION POINT (SC-03): confirmed `_resolveReachScore` + `buildReachList` drop-before-slice.

**The discount goes in `_resolveReachScore(def, roomState)` (dial-reach-orchestrator.cjs:143-151).** Today it returns `_clamp01(reachScores[reach_id])` or the registry-only default. The bounded reject discount multiplies that score:

```
adjusted_reach_score = baseReachScore * (1 - countPenalty(reach_id))
```

This is the ONLY multiplier on the reach surface. **Confirmed: there is NO recency factor on the reach surface** (unlike the command rail's `applyDecayWeight`). `_resolveReachScore` reads a pre-baked prior from `roomState.reachScores` (built by `cortex-reach-adapter.buildReachScoresFromCortex`, intent-classifier.cjs:888) and clamps it; there is no exponential recency term `[VERIFIED: dial-reach-orchestrator.cjs:143-151 -- single clamp, no exp()]`. So the LAYER shape collapses to `score * (1 - countPenalty)` -- the count penalty is the sole multiplier. (D-02's `recencyFactor` term from the old command-rail shape DROPS OUT; D-02a's combined-suppression floor still applies as `max(adjusted, base * FLOOR)` below N so an accidental 0 is reserved for the hard-suppress drop.)

**Hard-suppression DROPS the `reach_id` from the ranked array in `buildReachList` BEFORE the slice/gate.** Exact anchors:
- the reaches are built by `REACH_DEFS.map(...)` at :219-238;
- sorted desc at `reaches.sort((a,b) => b.score - a.score)` at :241;
- the frozen gate is applied at `_applyFrozenGate(reaches, tierMode)` at :244;
- `total_count`/`offered_count` are computed at :246-247.

**Insertion:** filter the hard-suppressed reach_ids OUT of the `reaches` array immediately AFTER the `.map` (:238) and BEFORE the `.sort` (:241) -- i.e. `reaches = reaches.filter(r => !isHardSuppressed(r.reach_id, roomState))` (subject to the parole fence, which re-admits). This guarantees: (1) the dropped reach_id is absent from the sort, the gate, and the top-K; (2) `total_count` reflects the post-drop bank size for THIS turn (the "top-3 of N" footer honestly shows the reduced N); (3) the frozen `_applyFrozenGate` runs on the surviving set, so the 0.70/0.15 markers are computed on the reaches the navigator can actually pick. NOTE: this is a DROP, not a score-to-zero -- the D-02a floor deliberately keeps below-threshold (discounted-but-present) reaches off exactly 0, so the only way to leave the rendered set is the explicit hard-suppress filter.

**Why before the gate, not after:** if you dropped after `_applyFrozenGate`, a suppressed reach could have already consumed the reach#1 or reach#2 RECOMMENDED slot (the gate only marks the top two by score), leaving the surviving set with zero markers when a legitimately-strong reach existed. Dropping first lets the gate mark the strongest SURVIVING reaches.

### Priority 3 -- FROZEN-148 GUARD (SC-05): suppression does NOT violate the invariant. Adversarial read below.

**What the frozen-148 test actually asserts (read in full):**
- `ranker.MAX_K === 3` `[VERIFIED: test-148-frozen-contracts.cjs:53-55]`
- `orchestrator.RECOMMEND_FLOOR === 0.70` `[:57-60]`
- `orchestrator.MARGIN_THRESHOLD === 0.15` `[:62-65]`
- `orchestrator.DIAL_REACH_K === 6` `[:67-70]`
- `DIAL_REACH_K !== MAX_K` (6 != 3) `[:72-75]`
- no bespoke AskUserQuestion construction outside the dispatcher `[:97-110]`

**And the reach-id BANK test:** `test-reach-ids-drift.cjs` asserts the reach-id set in SKILL.md is EXACTLY the 6 `{brain_consult, context_block, contradiction, cross_room, deep_research, hats}` `[VERIFIED: test-reach-ids-drift.cjs:26, 66-72]`. It reads the DOCTRINE bank (the SKILL.md code-span tokens), NOT the render output.

**Conclusion: dropping a `reach_id` from the RENDERED top-K does NOT touch any frozen assertion.**
- `DIAL_REACH_K` is a MODULE CONSTANT (`const DIAL_REACH_K = 6`, dial-reach-orchestrator.cjs:56) exported and asserted directly. Suppression NEVER reassigns it -- the bank is still defined as 6; we filter the RUNTIME `reaches` array. `[VERIFIED: the constant is asserted, not the array length]`
- `REACH_IDS` / `REACH_DEFS` stay length-6 (the `.map` source at :219 is untouched). The drift test reads SKILL.md doctrine, which is unchanged. So "the BANK is 6" holds; "6 always render" was NEVER asserted.
- `MAX_K=3`, `RECOMMEND_FLOOR=0.70`, `MARGIN_THRESHOLD=0.15` are constants -- a score discount + a drop touch none of them. The gate still uses 0.70/0.15 on the surviving set.

**Adversarial edge cases (be paranoid):**
1. **Could suppression drop the bank below the chooser budget?** Worst case all-but-one suppressed -> `reaches.length === 1` -> `offered_count = min(1, 3) = 1`. The chooser renders 1 row. This is ALREADY a supported state: `dial-presenter.renderDial` slices `reaches.slice(0, OFFERED_K)` and the footer reads `top-<min(OFFERED_K, offered.length)> of N` `[VERIFIED: dial-presenter.cjs:244, 296]`. No invariant requires >= 3 rows. The cold-room S3/S4 framing already renders <3 rows intentionally. SAFE.
2. **Could the M-floor + the 6-reach bank interact badly?** With only 6 reaches and MAX_K=3 rendered, a reach must be PRESENTED >= M times before it is suppression-eligible. Each dial render presents the TOP 3 (the `offered.slice(0, OFFERED_K=3)`), not all 6. So a reach ranked 4th-6th is never "presented" in the M sense even though it is in the bank. This is CORRECT: a reach the navigator never saw cannot have been rejected, so it cannot accrue a reject-in-window count either. The M floor and the reject count are both gated on the same `reach_presented` signal, so they stay consistent. (Design note: count "presented" = "in the offered top-3", NOT "in the 6-bank" -- see Priority 4.)
3. **Could a drop empty the recommended slot and read as broken?** No -- the gate runs after the drop on the survivors; if a survivor clears 0.70 it is marked. If none clear 0.70 the dial honestly shows zero markers (already the cold-room contract, "looks intentional", dial-presenter.cjs:131-134). SAFE.
4. **Could suppression desync the "top-3 of N" footer?** The footer reads `total_count` which is `reaches.length` AFTER the drop. So N shrinks honestly. The navigator sees "top-3 of 5" when one reach is suppressed -- truthful, not a contract breach. SAFE.

**The one thing the planner MUST verify in code:** that the drop happens to the `reaches` array INSIDE `buildReachList` and that `DIAL_REACH_K` / `REACH_DEFS` / `REACH_IDS` exports are byte-unchanged, so `test-148-frozen-contracts.cjs` and `test-reach-ids-drift.cjs` stay green. Add a 158 assertion that mirrors them (re-run both as carried fences).

### Priority 4 -- DB + reach_presented COUNTER SEAM (SC-06): resolve the data flow.

**The two seams, precisely:**
- **Pure render seam (NO db):** `renderEngineDecisionWithDial` (intent-classifier.cjs:869-939) builds `reachScores` from `ctx.cortexNodes` via the adapter (:888), calls `buildReachList({tierMode, reachScores})` (:896) and `renderDial` (:901). It has NO `roomDb` -- it receives only `cortexNodes` on `ctx` `[VERIFIED: :887, the function never opens db]`. This seam runs at :1757, AFTER the db was closed.
- **Live engine arm (db OPEN):** `runNavigationEngine` opens `roomDb = openRoomDbForCaller(roomDir)` at :1339-1345, holds it through `decide()`, threads `cortexNodes` out at :1481-1485, and CLOSES it in the finally `closeRoomDbHandle` at :1488 `[VERIFIED: intent-classifier.cjs:1339-1345, 1481-1488]`.

**Resolution of the data flow (who does what):**
1. **Who opens db:** `runNavigationEngine` already does (:1341). No new open.
2. **Who reads reject-counts + presentation-counts for the SCORE discount:** this is the subtle part. The score discount is applied in `_resolveReachScore`, which is PURE (no db, by canon -- dial-reach-orchestrator.cjs:28-30, 209). So the reject-count + presentation-count must be read UPSTREAM (where db is live) and folded INTO `roomState.reachScores` (and a parallel suppression set) BEFORE `buildReachList` runs. The cleanest seam: a NEW thin reader (mirroring `cortex-reach-adapter`) that runs on the live engine arm, reads the `f_selector_decision` (reach_id-keyed) + `reach_presented` counts via `navigation.findRecentChanges`, computes per-reach `countPenalty` + `isHardSuppressed`, and threads the result out alongside `cortexNodes`. Then `renderEngineDecisionWithDial` applies the discount to `reachScores` and passes a `suppressedReachIds` set into `buildReachList`. **Do NOT thread `db` into the pure orchestrator** -- that breaks its purity invariant (Part 9: "this module just ranks what is on the table"). Read upstream, pass scalars/sets in. This mirrors EXACTLY how `reachScores` is already built upstream by the adapter and passed in (intent-classifier.cjs:888, 896-899).
3. **Who writes `reach_presented`:** the LIVE engine arm, inside `runNavigationEngine` while `roomDb` is open. The cleanest point: after `decide()` settles and the cortex/reachScores are known but BEFORE the finally closes db (i.e. in the `.then(function (decision) {...})` block at :1446-1485, where `cortexNodes` is already extracted at :1481). Compute the would-be-rendered top-3 reach_ids there (run `buildReachList` on the same `reachScores`, take `offered.slice(0,3)`), and `navigation.logMemoryEvent(roomDb, 'reach_presented', {reach_id, source_path:'dial:presented:'+reach_id, created_by:'system'})` once per offered reach_id. **One event per RENDERED (offered top-3) reach_id, per turn.** Because db is live here, this is the seam SC-06 names.

**Does `buildReachList` need to RECEIVE `roomState.db`?** NO. The reject-count read happens upstream (item 2); the discount + suppression-set are passed in as already-computed `reachScores` (discounted) + a `suppressedReachIds` set. `buildReachList` stays pure. This is the resolved answer to the SC-06 fork.

**The single net-new write substrate:** the `reach_presented` event type. Add it ADDITIVELY to the `EVENT_TYPES` frozen Set (memory-events.cjs:10-...; the floor-not-size contract at :51-53 makes this safe -- `[VERIFIED: tests assert a FLOOR + named membership, never exact size]`). Enum/scalar payload only.

### Priority 5 -- W UNIT + presentation counting on the reach surface.

With `reach_id` keying, **M (min-presentations), W (window), P (parole) all count `reach_presented` events per `reach_id`.** A presentation-unit = one `reach_presented` event for that reach_id (fired once per turn it lands in the offered top-3). This works because:
- `reach_presented` is written per offered reach_id at the live arm (Priority 4);
- counts are read back via `navigation.findRecentChanges(db, 0, {eventType:'reach_presented', limit})` filtered by `properties.reach_id === reach_id` -- the exact idiom `_invocationsSinceDecision` uses for `f_selector_decision` (selector-decisions.cjs:290-301) `[VERIFIED]`;
- W ("rejects within the trailing W presentations") is read as: among the `reach_presented` timeline for this reach_id, count `f_selector_decision(reach_id, decision='reject')` rows newer than the W-th-most-recent presentation. This unifies M, W, and P on ONE counter (the presentation timeline), exactly as the prior research's A3 recommended -- and is even cleaner here because there is no competing `framework_invoked` invocation-unit on the reach surface.

**Confirmed readable via `navigation.findRecentChanges` by reach_id:** yes -- `findRecentChanges` returns rows with parsed `properties` (memory-events.cjs:484-512, re-exported at navigation.cjs:70) and accepts an `eventType` filter; the reach_id filter is a `properties.reach_id ===` scan, identical to the shipped `command` scan at selector-decisions.cjs:296.

### Priority 6 -- VALIDATION ARCHITECTURE (reach surface): see the rewritten `## Validation Architecture` section below.

### Priority 7 -- KEEP-from-prior constants, re-confirmed for 6 reaches / MAX_K=3.

The constants (N=3, M=2, W=8, P=5, CAP=0.6, FLOOR=0.05) carry over. Re-confirmation under the reach-surface reality (6 reaches, only top-3 rendered):

| Constant | Value | Re-confirmation for the reach surface |
|----------|-------|----------------------------------------|
| N (suppress threshold) | **3** | **STILL RIGHT.** Concern: "is N=3 right when only 6 reaches exist?" -- yes, because N counts REJECTS OF ONE reach_id WITHIN W, not reaches in the bank. A navigator who rejects `deep_research` 3 times within the last 8 times it was offered is a real, deliberate pattern; the bank size (6) is irrelevant to a per-reach reject count. N=3 is conservative for <100 edges and clears the CONTEXT failure case ("rejected N turns running"). |
| M (min-presentations) | **2** | Slightly more important on the reach surface: a reach must land in the offered top-3 twice before it is suppression-eligible. With only top-3 of 6 rendered per turn, a rank-4 reach accrues presentations slowly -- which is correct (it is rarely shown, so it is rarely rejected, so it is rarely near suppression). M=2 defuses a 1-2 noisy-reject nuke. |
| W (window) | **8** | Presentation-units of THIS reach_id. Wide enough that a genuine N=3 streak fits; narrow enough a stale streak ages out within a working session. Comparable to DECAY_WINDOW=5 order. |
| P (parole) | **5** | Every 5th presentation of a suppressed reach_id force-re-admits it. Deterministic (`presentationsCount % P === 0`), no RNG (D-06). |
| CAP (countPenalty cap) | **0.6** | Below N, the reach score discount tops at 60% -- strong nudge, still rankable. Leaves headroom above the registry-only 0.5 default so a discounted blend reach can fall below a fresh registry reach. |
| FLOOR (combined-suppress floor) | **0.05** | The discounted reach score is clamped to >= 5% of base below N, so an accidental exact-0 never happens (0 is reserved for the explicit hard-suppress DROP). |

All remain NAMED constants (RJP-05); the low-data rationale is unchanged. Tunable-later (Deferred).

**KEEP idioms (unchanged, still load-bearing):** the Part 8 grep-sweep (`run-all-148.sh` step d, :124-175), the deterministic-test discipline (inject counters via `roomState`, no db, no RNG), the byte-stable-at-zero idiom (zero rejects -> `countPenalty=0` -> score unchanged -> identical `reaches`), the EVENT_TYPES additive-floor idiom, and the frozen-148 carried fences.

---

## Architectural Responsibility Map

> REVISED for the reach surface (SC-01..06).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| REJECT count read (within W, per reach_id) | Shared core (new reach reader, sibling to `cortex-reach-adapter.cjs`), run on the LIVE engine arm | `lib/core/navigation.cjs` `findRecentChanges` (Part 9) | The count is generic machinery; reads go through the single navigation door, where db is open (intent-classifier.cjs:1339-1488). |
| `reach_presented` counter write (per reach_id) | LIVE engine arm (`runNavigationEngine`, db open) via `navigation.logMemoryEvent` | `lib/core/navigation/memory-events.cjs` EVENT_TYPES additive entry | A presentation IS graph data (Part 4); written via the chokepoint (Part 9) where db is live -- NOT at the pure render seam (db closed there). |
| `countPenalty` math + fences (per reach_id) | Shared core (new reach reader; pure) | -- | Pure, synchronous, testable. Folded into `reachScores` before `buildReachList`. |
| Discount application | Shared core (`dial-reach-orchestrator.cjs` `_resolveReachScore`) | -- | The single reach-score resolution point; the penalty is the sole multiplier (no recency term). |
| Hard-suppression (DROP from rendered top-K) | Shared core (`dial-reach-orchestrator.cjs` `buildReachList`) | -- | The reach array is built + sorted + gated here; the drop must precede the sort + gate. |
| reach_id keying at close | Shared core (`dial-close-reach.cjs` `closeReach` + `selector-decisions.cjs` `recordSelectorDecision`) | `lib/core/navigation.cjs` (writes) | The reject write must carry the reach_id enum so close + render counters agree (SC-02). |
| Constants N/M/W/P/CAP/FLOOR | Shared core named module constants | -- | Mirror `DECAY_WINDOW`; Tri-Polar -- one core consumed identically CLI/Desktop/Cowork. |

---

## Standard Stack

This is internal plugin machinery. No external packages. Node.js CJS only (CLAUDE.md: no TypeScript, no new heavy dependency, `node:sqlite` DatabaseSync via the chokepoint, never `better-sqlite3`).

| Module | Role in this phase (REACH-SURFACE) | Status |
|--------|--------------------|--------|
| `lib/hmi/dial-reach-orchestrator.cjs` | **THE injection surface.** `_resolveReachScore` (:143-151, apply discount), `buildReachList` (:211-255, drop before sort :241 / gate :244). `DIAL_REACH_K=6` / `RECOMMEND_FLOOR=0.70` / `MARGIN_THRESHOLD=0.15` / `REACH_IDS` are FROZEN -- untouched. PURE (no db). | shipped `[VERIFIED: read]` |
| `lib/workflow/dial-close-reach.cjs` | `closeReach` reject path (:236-250) -> must forward optional `reach.reach_id` into `recordSelectorDecision` (SC-02, Priority 1). | shipped `[VERIFIED: read]` |
| `lib/workflow/selector-decisions.cjs` | `recordSelectorDecision` (:104-262, add optional `reach_id` enum to payload via the FIX-05 optional-merge idiom :185-193,:211-222), `DECAY_WINDOW` named-constant idiom (:61). `_invocationsSinceDecision` (:276, do NOT reuse -- write a reach_id+REJECT-only reader). | shipped `[VERIFIED: read]` |
| `lib/hmi/cortex-reach-adapter.cjs` | How `roomState.reachScores` is built (`buildReachScoresFromCortex` :194-259). The reach reject-reader + discount fold mirror its shape; KNOWLEDGE_TYPES enum-gate (:228-234) is the off-enum-ignore idiom for the `reach_id` keying. | shipped `[VERIFIED: read]` |
| `lib/core/navigation.cjs` | Part 9 chokepoint: `findRecentChanges` (:70 read counts), `logMemoryEvent` (:89 write `reach_presented`). | shipped `[VERIFIED: read]` |
| `lib/core/navigation/memory-events.cjs` | `EVENT_TYPES` frozen Set (:10) + floor-not-size contract (:51-53). Add `'reach_presented'` additively. | shipped `[VERIFIED: read]` |
| `scripts/intent-classifier.cjs` | The two seams: PURE render seam (:869-939, NO db) + LIVE engine arm (`runNavigationEngine` :1339-1488, db OPEN). The reject-read + `reach_presented` write fire on the LIVE arm; the discount + suppressedReachIds are folded into `reachScores` before `buildReachList` (:888-899). | shipped `[VERIFIED: read]` |
| `lib/workflow/f-selector-ranker.cjs` | `[OFF-RAIL]` the OLD command surface. `rankForSelector` (:359) / `_applyDecay` (:205) / `MAX_K=3` (:77) / `slice(0,k)` (:465) -- UNTOUCHED. The `_d4SignalFloor` advisory call (dial-reach-orchestrator.cjs:120-135) does NOT change which reaches render. | shipped `[VERIFIED: read]` |

**Installation:** none. No `npm install`. (Package Legitimacy Audit section omitted -- this phase installs zero external packages.)

---

## Architecture Patterns

> **`[SUPERSEDED by SC-01..06]`** -- the diagram + patterns below describe the OLD
> command-surface (`_applyDecay` rail, `cmd:<command>` keying). The reach-surface
> equivalents are in `## Reach-Surface Findings` above. Kept for history.

### System Architecture Diagram (command-surface; SUPERSEDED)

```
                       (each turn, dial render)
  buildReachList(roomState)  ->  reaches[6 ranked]  ->  renderDial -> AskUserQuestion
        |                                                     |
        |  [NEW: presentation counter write]                  |
        |  for each offered cmd:<command>                     |
        |  navigation.logMemoryEvent('reach_presented',{...}) |
        v                                                     v
   room.db memory_event log  <----------------------  navigator picks / pivots / rejects
        ^                                                     |
        |                                          closeReach(outcome='reject')
        |                                                     |
        |                              recordSelectorDecision(decision='reject')
        |                              writes f_selector_decision row (decision enum)
        |                              + REJECTED cascade edge on cmd:<command>
        |                                                     |
        |   (next turn ranking)                               v
   rankForSelector(candidates)
        |  baseScore = _scoreCommand (UNTOUCHED 0.40/0.30/0.30)
        |  recencyFactor = applyDecayWeight  (UNTOUCHED transient signal)
        |  [NEW] countPenalty = rejectCountInWindow(W, cmd) gated by 4 fences:
        |       (M) presentationsCount(cmd) >= M  ELSE penalty = 0
        |       (W) only REJECTs inside trailing window W count
        |       (P) every Pth presentation -> force-eligible (parole), penalty waived this turn
        |       (room) reads only THIS room.db (Part 8)
        |  adjusted = base * recencyFactor * (1 - countPenalty)   [floored by D-02a]
        |  HARD-SUPPRESS: if rejectCountInWindow >= N AND fences pass -> DROP candidate
        |       (BEFORE sort + BEFORE slice(0,k))   <-- landmine #5
        v
   ranked[] (top-K)
```

The diagram's two `[NEW]` boxes are the entire build: the presentation-counter write at the dial seam, and the fence-gated `countPenalty` + hard-drop reader on the existing `_applyDecay` rail.

### Recommended Project Structure (files touched) -- REACH SURFACE

```
lib/workflow/reach-reject-reader.cjs  # NEW (sibling to cortex-reach-adapter): per-reach_id
                                       #   rejectCountInWindow + presentationsCount + countPenalty +
                                       #   isHardSuppressed + named constants N/M/W/P/CAP/FLOOR.
                                       #   Pure; test-injection seams (roomState.rejectCountInWindow /
                                       #   .presentationsCount). Reads via navigation.findRecentChanges.
lib/hmi/dial-reach-orchestrator.cjs   # EDIT: _resolveReachScore applies the discount; buildReachList
                                       #   DROPS suppressed reach_ids BEFORE the .sort (:241) + gate (:244).
                                       #   FROZEN constants (DIAL_REACH_K/MAX_K/0.70/0.15/REACH_IDS) untouched.
lib/workflow/selector-decisions.cjs   # EDIT: recordSelectorDecision gains an OPTIONAL reach_id enum
                                       #   (additive, FIX-05 optional-merge idiom; off-REACH_IDS ignored).
lib/workflow/dial-close-reach.cjs     # EDIT: reject branch forwards reach.reach_id (one line, additive).
lib/core/navigation/memory-events.cjs # EDIT: additive EVENT_TYPES entry 'reach_presented'.
scripts/intent-classifier.cjs         # EDIT (live engine arm only): read reject-counts upstream, fold the
                                       #   discount + suppressedReachIds into reachScores before buildReachList,
                                       #   fire reach_presented per offered top-3 reach_id (db OPEN, :1446-1485).
                                       #   The PURE render seam (:869-939) gets the pre-folded reachScores; no db.
[consumer closer]                      # EDIT: thread reach_id onto the reach object handed to closeReach
                                       #   (offer-closer.cjs / renderF1 payload at intent-classifier.cjs:1692-1710).
tests/test-158-reach-*.cjs + tests/run-all-158.sh   # NEW: the validation architecture
```

### Pattern 1: `[SUPERSEDED by SC-03]` Layer on the IoC rail

~~`rankForSelector` calls `_applyDecay(...)`; compose a fn on `opts._applyDecayWeight`.~~ The reach surface has NO IoC rail and NO recency factor. Reach-surface equivalent: fold the discount onto `roomState.reachScores[reach_id]` upstream (live arm), and `_resolveReachScore` consumes the already-discounted score (Priority 2). Kept for history.

### Pattern 2: Deterministic parole counter (D-06) -- re-keyed to reach_id

Parole fires when `presentationsCount(reach_id) % P === 0` (modular, NOT `Math.random`). A paroled reach_id is force-re-admitted to the rendered set that one turn. Because parole only acts on already-suppressed reach_ids (which require >= N rejects, which require presentations), a zero-reject room never triggers parole -> byte-stable-at-zero holds (D-06).

### Anti-Patterns to Avoid (reach surface; command-rail anchors SUPERSEDED)
- **Reusing `_invocationsSinceDecision` for the REJECT count.** It counts ALL `f_selector_decision` rows and keys by `command`, never by `decision` enum nor `reach_id`. `[VERIFIED: selector-decisions.cjs:287-301]`. Write a NEW reach_id+REJECT-only reader.
- **Dropping after the gate/slice.** `[SUPERSEDED anchor]` On the reach surface drop the reach_id from `buildReachList`'s `reaches` BEFORE `.sort` (dial-reach-orchestrator.cjs:241) and BEFORE `_applyFrozenGate` (:244) -- NOT the `f-selector-ranker.cjs:451/465` command slice.
- **Reading `row.properties.reason`.** Part 8 breach (RJP-06). Read `decision`/`edge_semantic`/`reach_id` enums only.
- **Threading `db` into `dial-reach-orchestrator.cjs`.** Breaks its purity invariant (Part 9). Read reject-counts upstream on the live arm; pass discounted `reachScores` + `suppressedReachIds` in.
- **Editing any frozen-148 constant** (`DIAL_REACH_K`, `MAX_K`, 0.70, 0.15, the 6-bank) or the `0.40/0.30/0.30` command weights. RJP-08 / SC-05.
- **Persisting suppression state in a new table.** That is dormant SEED-009. Suppression derives from `f_selector_decision` (reach_id) rows + `reach_presented` counts at score-time (No schema change).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading REJECT outcome rows (per reach_id) | Direct sqlite query / fs scan | `navigation.findRecentChanges(db, since, {eventType:'f_selector_decision', limit})` filtered by `properties.reach_id` + `properties.decision==='reject'` | Part 9 chokepoint; the same scan idiom `_invocationsSinceDecision` uses (`:290-301`). |
| Writing the presentation counter (per reach_id) | A new JSONL ledger / a new table | `navigation.logMemoryEvent(db, 'reach_presented', {reach_id,...})` on the LIVE engine arm | Part 4 (choice is graph data) + Part 9 (chokepoint). `EVENT_TYPES` extension is the shipped additive idiom. |
| Applying the discount | A new ranking path | the existing `_resolveReachScore` (`dial-reach-orchestrator.cjs:143`) score it already resolves | SC-03; the penalty is the sole multiplier (no recency term to layer on). |
| Building `roomState.reachScores` | A bespoke prior builder | the shipped `cortex-reach-adapter.buildReachScoresFromCortex`; fold the discount onto its output | the prior map is already built upstream and passed into `buildReachList` (intent-classifier.cjs:888). |
| AskUserQuestion payload | A bespoke widget | `selector-dispatcher.cjs` (the ONLY sanctioned door) | `test-148-frozen-contracts.cjs` asserts construction marker appears ONLY in the dispatcher. This phase must NOT add one. |
| Investment-scaled penalty curve | A new investment reader | the `PIVOT_PENALTY_FLOOR` idiom in `dial-close-reach.cjs:79-94` | a shipped investment-scaled-penalty pattern already exists; mirror its shape for the cap rationale. |

**Key insight:** every input signal this phase needs (REJECT enum, the reach prior map, the chokepoint reads/writes) is already shipped. The ONLY genuinely net-new substrate is the per-`reach_id` presentation counter (`reach_presented`) plus the optional `reach_id` field on the reject write -- because nothing today records which reach was offered, nor keys a reject by reach_id.

---

## Runtime State Inventory

Not a rename/refactor phase -- this section is N/A for the migration sense. But the analogous "what runtime state must exist for the fences to work" question is the landmine below, answered in full in Common Pitfalls.

---

## Common Pitfalls

### Pitfall 1 (THE LANDMINE): presentations are NOT recoverable from existing signals `[PARTIALLY SUPERSEDED]`

> The landmine FINDING is still TRUE (no existing signal records which reach was
> offered) and the FIX still holds (add a `reach_presented` event). But on the
> reach surface the event is keyed by `reach_id` (NOT `cmd:<command>`) and fires
> on the LIVE engine arm (Priority 4 above), not via the `cmd` collapse. Read the
> reach-surface resolution in Priority 4; the command-keyed details below are
> superseded.


**What goes wrong:** The plan assumes the four fences (M min-presentations, parole-every-Pth, count-rate-within-W) can read an existing "how many times was this reach offered" count. They cannot.

**Evidence (exhaustive trace):**
- `selector_presentation` memory_event + `recordPresentation` JSONL (`selector-telemetry.cjs:113-132`, `selector-dispatcher.cjs:490-511`): payload is `{sub_shape, mode, options_count, recommended_present, operator?}` + a sha256 *room* hash. **Command-anonymous.** It records HOW MANY options, never WHICH. `[VERIFIED: read]`
- The dial path (`buildReachList` at `dial-reach-orchestrator.cjs:211`, `renderDial` at `dial-presenter.cjs:233`) is PURE -- "No Brain call, no fs write, no db write" (`:209`) and "reads no room.db" (`:51`). It emits NO presentation event whatsoever. `[VERIFIED: read]`
- `suggestion_surfaced` (`scripts/suggest-next-command.cjs:115`, via `navigation.logSuggestionSurfaced`) DOES carry `commands:[{command,score}]` -- per-command, in room.db, queryable. BUT it only fires on the `/mos:suggest-next` CLI path, NOT the dial reach surface this phase suppresses. `[VERIFIED: read]`
- `f_selector_miss` carries `top_k_offered:[{command,score}]` (`selector-decisions.cjs:408`) -- per-command, but ONLY on a none-fit miss, not on every presentation. `[VERIFIED: read]`

**Conclusion (b): this phase MUST add a lightweight presentation counter.** Minimal additive shape:
1. Add `'reach_presented'` (and optionally `'reach_suppressed'`/`'reach_paroled'`) to the `EVENT_TYPES` frozen Set in `memory-events.cjs` -- the shipped additive idiom (every prior phase grew the Set this way; tests assert a FLOOR + named membership, never an absolute size, so the addition is safe). `[VERIFIED: memory-events.cjs:51-53 documents the floor-not-size contract]`
2. At the dial-render seam, for each of the (<= OFFERED_K=3) offered reaches, write one `reach_presented` event whose payload is enum/scalar only: `{command:'cmd:<command>', reach_id, source_path:'dial:presented:<command>', created_by:'system'}`. NO reason text, NO label prose (Part 8). The `cmd:<command>` collapse mirrors `closeReach` (D-01) so the presentation count keys to the SAME node as the REJECT count.
3. `presentationsCount(cmd, db)` and `rejectCountInWindow(W, cmd, db)` both read via `navigation.findRecentChanges` filtered by event_type (Part 9).

**Scope impact:** the dial path is pure-by-design today. Writing at render time means either (a) the dial caller (the consumer that already holds `roomState.db`) fires the counter after `renderDial` returns, keeping `dial-presenter.cjs` / `dial-reach-orchestrator.cjs` pure; or (b) thread a `db` into the orchestrator and break its purity invariant. **Strongly prefer (a)** -- it preserves the "orchestrator/presenter are pure renderers" canon (Part 9: "this module just ranks what is on the table") and keeps the write at the consumer boundary that already owns the db handle (the same pattern `closeReach` uses: the consumer populates `roomState.db`). The planner should locate the dial *consumer* (the surface that calls `buildReachList`+`renderDial` and later `closeReach`) and add the counter write there.

**Stays scoped:** enum/scalar payload only, per-room only, via the chokepoint. No new table, no cross-room read. The fences ARE buildable as scoped once this one additive event exists.

### Pitfall 2: REJECT/DEFER conflation in the existing counter
**What goes wrong:** reusing `_invocationsSinceDecision` makes DEFER inflate the REJECT count, violating D-03. **How to avoid:** new reader filters `row.properties.decision === 'reject'` (or `edge_semantic === 'REJECTED'`). **Warning sign:** a deferred command starts getting suppressed.

### Pitfall 3: hard-suppression after truncation
**What goes wrong:** dropping after `slice(0,k)` leaves a short list or lets a suppressed item ride. **How to avoid:** filter the `scored` array before `scored.sort` (`:451`) and before `slice(0,k)` (`:465`). **Warning sign:** N-suppressed candidate still appears in output, or top-K returns < k when more eligible candidates exist.

### Pitfall 4: byte-stability broken by an always-on side effect
**What goes wrong:** firing the presentation counter or computing `countPenalty` mutates output even at zero rejects. **How to avoid:** `countPenalty` returns exactly 0 when `rejectCountInWindow === 0` -> `(1 - 0) = 1` -> identical output. The presentation write is a side-channel (memory_event), NOT a ranker input that changes the returned array. **Warning sign:** `test-drift-baseline`-style snapshot diff on a zero-reject room.

### Pitfall 5: confirmation-bias self-lock (the central low-data risk)
**What goes wrong:** suppressed -> never shown -> never earns accept data -> stays suppressed forever. **How to avoid:** double-fenced -- W ages rejects out of the window AND parole-every-Pth force-resurfaces. Both must be tested (see Validation Architecture). **Warning sign:** a candidate suppressed at turn T never reappears across a long deterministic fixture.

---

## Code Examples

> **`[SUPERSEDED by SC-01..06]`** -- the snippets below key by `command` and read
> `f_selector_decision.command`. On the reach surface, replace `command` with
> `reach_id` everywhere, read `f_selector_decision.reach_id` + `reach_presented.reach_id`,
> and apply the discount inside `_resolveReachScore` (no `applyDecayWeight` recency
> term -- the reach surface has none; the penalty is the sole multiplier). The shape
> and the bounded-clamp math are otherwise unchanged. Kept for history.

### Bounded countPenalty reader (shape; values are Constant-Values defaults) -- SUPERSEDED keying
```javascript
// Source pattern: mirrors selector-decisions.cjs DECAY_WINDOW named-constant idiom
//   + dial-close-reach.cjs _pivotPenalty bounded-clamp idiom.
const REJECT_SUPPRESS_THRESHOLD = 3;   // N: rejects-within-W to hard-suppress
const MIN_PRESENTATIONS = 2;           // M: presentations before suppression-eligible
const REJECT_WINDOW = 8;               // W: trailing presentations the rejects must fall within
const PAROLE_PERIOD = 5;               // P: every Pth presentation force-resurfaces
const COUNT_PENALTY_CAP = 0.6;         // max discount below N
const COMBINED_SUPPRESS_FLOOR = 0.05;  // D-02a: never accidental 0 below N

function rejectCountInWindow(db, command, roomState) {
  // Test seam mirrors _invocationsSinceDecision: a pre-computed counter wins.
  if (roomState && roomState.rejectCountInWindow
      && typeof roomState.rejectCountInWindow[command] === 'number') {
    return roomState.rejectCountInWindow[command];
  }
  if (!db) return 0;
  const rows = navigation.findRecentChanges(db, 0, { eventType: 'f_selector_decision', limit: 200 });
  // REJECT-only (D-03); enum read only (Part 8) -- NEVER row.properties.reason.
  // Window W is in presentation-units: count rejects whose presentation-rank is within W.
  let count = 0;
  for (const r of rows) {
    if (r && r.properties && r.properties.command === command
        && r.properties.decision === 'reject') count += 1;
  }
  return count;  // planner: clamp to within-W using presentation timeline
}

function countPenalty(db, command, roomState) {
  const n = rejectCountInWindow(db, command, roomState);
  if (n === 0) return 0;                                  // byte-stable-at-zero (RJP-02)
  const pres = presentationsCount(db, command, roomState);
  if (pres < MIN_PRESENTATIONS) return 0;                 // M fence (noise attack)
  return Math.min(COUNT_PENALTY_CAP, n / (REJECT_SUPPRESS_THRESHOLD + 1)); // bounded (RJP-03)
}

function isHardSuppressed(db, command, roomState) {
  const n = rejectCountInWindow(db, command, roomState);
  const pres = presentationsCount(db, command, roomState);
  if (pres < MIN_PRESENTATIONS) return false;             // M fence
  if (pres > 0 && pres % PAROLE_PERIOD === 0) return false; // P parole (deterministic, D-06)
  return n >= REJECT_SUPPRESS_THRESHOLD;                  // N gate within W (D-05)
}
```

### Layering on the existing rail (D-02)
```javascript
// adjusted = base * recencyFactor * (1 - countPenalty), floored below N (D-02a).
const recencyFactor1 = applyDecayWeight(1, command, roomState); // factor in [0,1] form
const cp = countPenalty(db, command, roomState);
let adjusted = baseScore * (recencyFactor1) * (1 - cp);
if (!isHardSuppressed(db, command, roomState)) {
  adjusted = Math.max(adjusted, baseScore * COMBINED_SUPPRESS_FLOOR); // never accidental 0
}
```
NOTE: `applyDecayWeight` returns `base*factor`, so call it with base=1 to recover the bare factor, OR compose so the existing `_applyDecay` runs first and the penalty multiplies its result -- the planner picks per Pattern 1(a)/(b).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| REJECT edge files, nothing reads it back (open loop) | Bounded REJECT penalty on `_applyDecay` (this phase) | Phase 158 | Closes the reverse salient 157-RESEARCH named. |
| Recency factor recovers to 1, forgets prior rejects | Persistent count-within-W layered on transient recency | Phase 158 | A 5x-rejected command stays suppressed instead of re-surfacing at turn 6. |
| Learned ensemble weights (full SEED-009) | Bounded heuristic penalty justified at any edge count | dormant until >=30 users AND >=1000 edges | Avoids overfitting the 4-user Wave-1 cohort. |

**Deprecated/outdated for this phase:** none. The `shouldExclude` helper (`selector-decisions.cjs:348`) is a precedent for "drop from top-K below a factor threshold" but is DEFER/recency-scoped, not REJECT-count-scoped -- do not overload it; write the REJECT-specific suppression.

---

## Validation Architecture

> RE-DERIVED for the REACH surface (SC-01..06). nyquist_validation = true in `.planning/config.json`. REQUIRED; drives VALIDATION.md. Every test is DETERMINISTIC (no RNG, no clock, no db) using a `roomState.reachScores[reach_id]` prior injection (the SHIPPED orchestrator seam, dial-reach-orchestrator.cjs:143-151) PLUS a parallel stubbed reject-count / presentation-count injection (`roomState.rejectCountInWindow[reach_id]` / `roomState.presentationsCount[reach_id]`) the new reach reader exposes -- mirroring the `_invocationsSinceDecision` test seam at selector-decisions.cjs:278-282. Parole is counter-keyed (`presentationsCount % P`), never RNG (D-06).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain CJS, `node:assert/strict`, PASS-line + non-zero-exit (repo idiom; see `test-148-frozen-contracts.cjs`). No external runner. |
| Config file | none -- bash aggregator `tests/run-all-158.sh` mirrors `tests/run-all-148.sh` |
| Quick run command | `node tests/test-158-<suite>.cjs` (per suite) |
| Full suite command | `bash tests/run-all-158.sh` (+ `bash tests/run-all-148.sh` for the frozen invariant) |

### Phase Requirements -> Test Map (reach-surface; red-team ledger as deterministic tests)
| Red-team attack / Req | Behavior proven (reach_id-keyed) | Test Type | Automated Command | File |
|----------|----------|-----------|-------------------|------|
| rejected reach ranks lower | a reach_id with rejects gets a strictly LOWER `_resolveReachScore` than its zero-reject self; its sort position drops in `buildReachList` | unit | `node tests/test-158-reach-discount.cjs` | Wave 0 |
| byte-stable-at-zero (RJP-02) | with zero rejects for every reach_id, `buildReachList(roomState)` returns a reach list byte-identical to the captured pre-phase baseline (same `reachScores` in -> identical reaches out) | snapshot | `node tests/test-158-reach-byte-stable.cjs` | Wave 0 (mirror `test-drift-baseline.cjs`) |
| hard-suppress-at-N (drop) | at reject-count>=N within W (fences pass), the reach_id is ABSENT from the rendered top-K (`buildReachList().reaches` has no such reach_id); at N-1 it is PRESENT and discounted | unit | `node tests/test-158-reach-hard-suppress.cjs` | Wave 0 |
| noise attack (M floor) | a reach_id with `presentationsCount < M` is NEVER suppressed even at >=N rejects (present, discounted) | unit | `node tests/test-158-reach-min-presentations.cjs` | Wave 0 |
| confirmation-bias loop (W aging) | a suppressed reach_id RE-SURFACES once its rejects age out of the trailing-W presentation window | unit | `node tests/test-158-reach-window-aging.cjs` | Wave 0 |
| confirmation-bias loop (parole) | every Pth presentation a suppressed reach_id is force-re-admitted to the rendered set (deterministic `% P`, no RNG) | unit | `node tests/test-158-reach-parole.cjs` | Wave 0 |
| double-crush floor (D-02a) | a heavily-rejected-but-below-N reach_id never lands at exactly 0 (respects COMBINED_SUPPRESS_FLOOR); 0 is reserved for the explicit hard-suppress drop | unit | `node tests/test-158-reach-floor.cjs` | Wave 0 |
| REJECT-only (D-03) | DEFER / PIVOT `f_selector_decision` rows do NOT contribute to a reach_id's `countPenalty`; only `decision==='reject'` (`edge_semantic==='REJECTED'`) counts | unit | `node tests/test-158-reach-reject-only.cjs` | Wave 0 |
| reach_id keying at close (SC-02) | `recordSelectorDecision` with an optional `reach_id` writes it as an enum into the `f_selector_decision` payload; an off-`REACH_IDS` value is ignored; no `reach_id` arg -> payload byte-identical to today | unit | `node tests/test-158-reach-id-keying.cjs` | Wave 0 |
| presentation counter (SC-06) | one `reach_presented` event lands per offered top-3 reach_id; `presentationsCount(reach_id)` reads it back via `navigation.findRecentChanges`; payload is enum/scalar only | unit | `node tests/test-158-reach-presentation-counter.cjs` | Wave 0 |
| Part 8 (RJP-06) | forbidden-substring scan: the new reach-penalty + counter code reads `decision`/`edge_semantic`/`reach_id` ENUMS only, NEVER `properties.reason`; a seeded `reason:'SECRETREASON123'` never appears in any value the path reads/emits | grep/scan | `node tests/test-158-reach-part8-no-reason.cjs` | Wave 0 (mirror `run-all-148.sh` step d + `test-navigation-packet-part8-leak.cjs:69-89`) |
| Part 9 (RJP-07) | the reach reject-count + presentation-count reads go ONLY through `navigation.findRecentChanges`; no `better-sqlite3`/`require('node:sqlite')`/`fs` read; the orchestrator stays pure (no `db`) | grep/scan | `node tests/test-158-reach-part9-chokepoint.cjs` | Wave 0 |
| frozen-148 invariant (RJP-08 / SC-05) | `DIAL_REACH_K===6`, `MAX_K===3`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15`, `REACH_IDS` length 6, and the SKILL.md 6-reach bank stay green AFTER a discount + drop | regression | `bash tests/run-all-148.sh` (carries `test-148-frozen-contracts.cjs` + `test-reach-ids-drift.cjs`) | shipped -- must stay green |
| orchestrator purity (Part 9) | `buildReachList` / `_resolveReachScore` make zero db/fs/Brain calls AFTER the change (grep tripwire mirroring the 148 zero-egress sweep) | grep/scan | `node tests/test-158-reach-orchestrator-pure.cjs` | Wave 0 |

### Deterministic test idioms to mirror (named, with file:line)
- **Prior injection (no db, no RNG):** `buildReachList({tierMode, reachScores:{<reach_id>:score}})` is ALREADY the pure test seam -- `_resolveReachScore` reads `roomState.reachScores[reach_id]` directly (dial-reach-orchestrator.cjs:143-151). Inject discounted scores + a `suppressedReachIds` set / `rejectCountInWindow` + `presentationsCount` maps to drive every fence with zero db.
- **Reject-count reader seam:** mirror `_invocationsSinceDecision`'s pre-computed-counter-wins seam (selector-decisions.cjs:278-282) -- the new `rejectCountInWindow(db, reach_id, roomState)` / `presentationsCount(db, reach_id, roomState)` prefer `roomState.rejectCountInWindow[reach_id]` / `roomState.presentationsCount[reach_id]` when present, so unit tests never touch db.
- **enum-gate idiom (off-enum ignored):** mirror `cortex-reach-adapter.cjs:228-234` (KNOWLEDGE_TYPES gate) for the `reach_id` enum membership check at the close write -- a poisoned/off-`REACH_IDS` value is dropped, not stored.
- **Byte-stable baseline:** `tests/test-drift-baseline.cjs` snapshot idiom; capture a pre-phase zero-reject `buildReachList` output (with a fixed `reachScores`) and assert byte-identity after the change.
- **Part 8 forbidden-substring sweep:** `run-all-148.sh:124-175` greps new artifacts for forbidden tokens + free-text body fields; `test-navigation-packet-part8-leak.cjs:69-89` seeds `SECRET RAW ... BODY` and asserts ZERO in `JSON.stringify`. Mirror: seed a REJECTED `f_selector_decision` row carrying `reason:'SECRETREASON123'` and assert the string never appears in any value the reach-penalty path reads or in the `reach_presented` payload.
- **EVENT_TYPES additive-floor:** the `reach_presented` addition is asserted by FLOOR + named membership (mirroring memory-events.cjs:51-53), NEVER an exact `.size` -- so a concurrent phase adding an event type cannot regress the 158 fence.
- **Frozen-contract assertions:** `test-148-frozen-contracts.cjs:53-75` + `test-reach-ids-drift.cjs:26,66-72`. The 158 suite must NOT touch the constants/bank; `run-all-148.sh` stays the carried gate.

### Sampling Rate
- **Per task commit:** `node tests/test-158-<suite>.cjs` for the touched behavior.
- **Per wave merge:** `bash tests/run-all-158.sh` + `bash tests/run-all-148.sh`.
- **Phase gate:** both green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-158.sh` -- the one-command phase gate (mirror `run-all-148.sh`: CJS suites loop + carried 148 fences + the Part 8 grep-sweep step).
- [ ] All 13 `tests/test-158-reach-*.cjs` suites above.
- [ ] A captured zero-reject `buildReachList` baseline fixture for the byte-stable test (fixed `reachScores` input).
- [ ] The `roomState.rejectCountInWindow[reach_id]` / `presentationsCount[reach_id]` test-injection seams in the new reach reader (mirroring `_invocationsSinceDecision`'s seam).
- [ ] The optional-`reach_id` extension to `recordSelectorDecision` + `closeReach` (Priority 1) with its keying test.
- [ ] The `reach_presented` EVENT_TYPES additive entry + its floor test.

*(No framework install needed -- the repo uses plain CJS + `node:assert/strict`.)*

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` -> treated as enabled. This phase is LOCAL-only generic machinery; the binding security constitution is Canon Part 8 (counts/enums only, per-room scope) and Part 9 (chokepoint reads).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Defensive guards on every reader (mirror `applyDecayWeight`'s type guards `:331-333`); non-throwing on bad input. |
| V6 Cryptography | no | No new crypto. (Existing room-slug sha256 is unchanged and not on this path.) |
| V2/V3/V4 Auth/Session/Access | no | No auth surface; LOCAL room-local machinery. |
| V8/V9 Data protection / comms | yes (Canon Part 8) | The penalty reads/emits enum + scalar + `reach_id` machine token ONLY; NEVER rejection reason strings; NEVER cross-room; NEVER a Brain packet field. The new `reach_id` field is a member of the frozen `REACH_IDS` 6-set (a generic machine enum). Zero network surface. |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Rejection reason string leaks into ranker / a packet | Information Disclosure | RJP-06 forbidden-substring scan; read `decision`/`edge_semantic` enum only. |
| Cross-room rejection bias (one room suppresses in another) | Tampering | Per-room scope -- read only the active room's `room.db` via the chokepoint; the `reach_presented` + `f_selector_decision` rows are room-local by construction (Canon Part 8 constitutional fence). |
| Direct DB / fs read bypassing the chokepoint | Tampering | RJP-07 Part 9 grep: no `require('node:sqlite')`/`better-sqlite3`/`fs` read in the penalty path; all reads via `navigation.findRecentChanges`. |
| Non-deterministic ranking (RNG parole) | Repudiation/testability | D-06 deterministic presentation-counter parole; no `Math.random`. |

---

## Environment Availability

Skipped -- no external dependencies. This phase is pure CJS code + config changes against shipped modules. `node:sqlite` (DatabaseSync) and the navigation chokepoint are already present and exercised by the shipped 148/125 test suites.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `reach_presented` fires on the LIVE engine arm inside `runNavigationEngine` (intent-classifier.cjs:1446-1485) where `roomDb` is open -- NOT at the pure render seam (db closed at :1488 before the render at :1757) | Priority 4 / SC-06 | LOW -- VERIFIED: the render seam takes only `cortexNodes` (:887) and the db is closed in the finally at :1488. The live arm is the only place db is open. |
| A2 | The consumer that hands the `reach` object to `closeReach` can carry `reach_id` because the rendered dial reach already has it (dial-reach-orchestrator.cjs:229-237) | Priority 1 / SC-02 | LOW -- the dial reach object provably carries `reach_id`; the closer just propagates it. The planner's first task pins the exact closer line (offer-closer.cjs / renderF1 payload). |
| A3 | Window W is in presentation-units of THIS reach_id (count rejects whose presentation-rank falls within the last W `reach_presented` events for that reach_id) | Priority 5 | LOW (was MEDIUM on the command surface) -- on the reach surface there is NO competing invocation-unit (no `framework_invoked` analogue), so presentation-units is the only honest reading. Unifies M, W, P on one counter. |
| A4 | Starting constant values (N=3, M=2, W=8, P=5, CAP=0.6, FLOOR=0.05) hold per reach_id | Priority 7 / Constant Values | LOW -- explicitly tunable later (Deferred); re-confirmed against 6 reaches / MAX_K=3 in Priority 7. |

---

## Open Questions

1. **W unit -- RESOLVED.** Presentation-units of THIS reach_id (Priority 5 / A3). On the reach surface there is no competing invocation-unit, so this is the only honest reading. One-line in `rejectCountInWindow`.

2. **Where the presentation counter fires -- RESOLVED.** The LIVE engine arm inside `runNavigationEngine` (intent-classifier.cjs:1446-1485), db OPEN. The orchestrator stays pure; db is NEVER threaded into it (Priority 4 / SC-06). NOT the render seam (db closed there).

3. **The exact consumer line that hands `reach` to `closeReach`** (to thread `reach_id` through, C3).
   - What we know: the F.1 closer payload is built at intent-classifier.cjs:1692-1710 from the rendered dial via `closer.renderF1`; the rendered dial carries `reach_id`.
   - What's unclear: whether the persisted `f1_closer_payload.verbs` already carries per-row `reach_id` or only the label/command, and exactly where the NEXT-turn pick is routed back to `closeReach`.
   - Recommendation: the planner's FIRST task traces `offer-closer.cjs` `renderF1` -> the persisted payload -> the next-turn `closeOffer`/`closeReach` route, and threads `reach_id` end to end. It is propagation only (the value exists), not a new lookup -- but it spans two turns, so pin it before writing tasks.

4. **Optional observability events (`reach_suppressed`/`reach_paroled`).**
   - Recommendation: `reach_presented` is load-bearing (in-scope). Treat `reach_suppressed`/`reach_paroled` as in-scope-minimal-if-cheap (enum/scalar only), else defer to BOG-07/Phase 157.

---

## Constant Values (grounded, conservative for ~4 users / <100 edges)

Reference point: `DECAY_WINDOW = 5` (`selector-decisions.cjs:61`); `EXCLUSION_THRESHOLD = 0.1` (`:69`); `PIVOT_PENALTY_FLOOR = 0.2` (`dial-close-reach.cjs:79`). All are tunable-later (Deferred).

| Constant | Recommended start | One-line rationale |
|----------|-------------------|--------------------|
| `REJECT_SUPPRESS_THRESHOLD` (N) | **3** | Small enough to act on a real pattern, large enough that 1-2 off-turn rejects never hard-drop at <100 edges. The CONTEXT failure case ("rejected 5 turns running") clears it comfortably; a noisy double-reject does not. |
| `MIN_PRESENTATIONS` (M) | **2** | A candidate must have been offered at least twice before it can be suppressed -- defuses the noise attack at small sample (CONTEXT lean: "M >= a couple of presentations"). |
| `REJECT_WINDOW` (W) | **8** | Short enough that a stale reject streak ages out within a working session or two (CONTEXT lean); slightly wider than N so a genuine N-streak fits inside one window. Comparable order to DECAY_WINDOW=5. |
| `PAROLE_PERIOD` (P) | **5** | Every 5th presentation force-resurfaces a suppressed reach -- frequent enough to re-test before the navigator forgets it, rare enough not to thrash. Matches DECAY_WINDOW's order of magnitude. |
| `COUNT_PENALTY_CAP` | **0.6** | Below N the discount tops out at 60% -- a strong nudge that still leaves a positive, rankable score (RJP-03). Leaves headroom above PIVOT_PENALTY_FLOOR=0.2 so a count penalty can exceed a single pivot nudge. |
| `COMBINED_SUPPRESS_FLOOR` (D-02a) | **0.05** | The combined `recency * (1-countPenalty)` is clamped to >= 5% of base below N so a heavily-rejected-but-recovering command never hits exactly 0 by accident (0 is reserved for the hard-suppress path). |

**Flag:** these are STARTING DEFAULTS for the planner to lock with a documented low-data rationale; re-tune from telemetry once the outcome-edge count grows (Deferred). The low-data overfitting risk (the reason full SEED-009 stays dormant) is precisely why N/M are conservative and the penalty is bounded heuristic, not learned.

---

## Seam Landmines (priority-4 detail)

> **`[SUPERSEDED by SC-01..06]`** -- these landmines are command-rail (`_applyDecay`
> / `cmd:<command>` / `f-selector-ranker.cjs` slice). The reach-surface landmines
> are folded into `## Reach-Surface Findings` Priorities 1-4 above:
> (a) `recordSelectorDecision` writes NO `reach_id` today -> must add it (Priority 1);
> (b) the drop must precede `buildReachList`'s `.sort` at dial-reach-orchestrator.cjs:241
> and `_applyFrozenGate` at :244 (Priority 2/3), NOT the `f-selector-ranker.cjs:451/465`
> slice; (c) the `reach_presented` write fires on the live engine arm where db is open
> (Priority 4), NOT at the pure render seam. The command-rail detail below is history.

1. **`_invocationsSinceDecision` does NOT distinguish REJECT from DEFER.** `[VERIFIED: selector-decisions.cjs:287-301]` -- it finds the most recent `f_selector_decision` for the command and counts `framework_invoked` since, with NO decision-enum filter. D-03 requires REJECT-only. Write a NEW reader that filters `row.properties.decision === 'reject'` / `edge_semantic === 'REJECTED'`. Do not extend `_invocationsSinceDecision`.
2. **The test-injection seam.** `roomState.invocationsSinceDecision[command]` (`:278-282`) lets `applyDecayWeight` run pure (no db) in unit tests. Add the SAME-shaped seam for the new readers (`roomState.rejectCountInWindow`, `roomState.presentationsCount`) so every fence test is deterministic and db-free.
3. **The byte-stable path.** `applyDecayWeight` returns `base_score` unchanged when no decision is on record (`:336`, the `n === Infinity` branch). Preserve the analogue: `countPenalty` returns 0 (-> factor 1) when REJECT count is 0. Never let the presentation-counter write change the returned ranked array (it is a side-channel memory_event, not a ranker input).
4. **IoC injection point.** The ranker injects via `opts._applyDecayWeight` (`f-selector-ranker.cjs:378-379`), run through `_applyDecay` (`:205`). The penalty composes onto THIS fn (Pattern 1). The `f_selector_decision` payload DOES carry the outcome enum to distinguish REJECT from DEFER: `recordSelectorDecision` writes `decision: 'defer'|'reject'` AND `edge_semantic: 'DEFERRED'|'REJECTED'` into the payload `[VERIFIED: selector-decisions.cjs:211-222, 175]`, and `findRecentChanges` returns `properties` parsed (`memory-events.cjs:510`), so the enum is readable without touching `reason`.
5. **Top-K truncation location.** `scored.sort((a,b)=>b.score-a.score)` at `f-selector-ranker.cjs:451`, then `scored.slice(0, k)` at `:465`. Hard-suppression MUST remove suppressed candidates from `scored` BEFORE the sort (or at minimum before the slice). The cleanest insertion: filter inside the `for (const cmd of commands)` loop (`:400-448`) -- skip pushing a hard-suppressed candidate to `scored` (subject to the parole fence, which can re-admit it). This keeps the suppression a true drop-from-top-K, not a score-to-zero (which the D-02a floor would otherwise prevent from reaching 0).

---

## Sources

### Primary (HIGH confidence -- read in this session)
- `lib/workflow/f-selector-ranker.cjs` -- `_applyDecay` seam (:205), `_scoreCommand` 0.40/0.30/0.30 (:287-290), `slice(0,k)` (:465), `MAX_K` (:77).
- `lib/workflow/selector-decisions.cjs` -- `applyDecayWeight` (:330), `_invocationsSinceDecision` (:276), `recordSelectorDecision` decision/edge_semantic enum (:175,:211-222), `DECAY_WINDOW`/`EXCLUSION_THRESHOLD` (:61,:69), `recordSelectorMiss` top_k_offered (:408), `shouldExclude` (:348).
- `lib/workflow/dial-close-reach.cjs` -- `closeReach` reject path keyed by reach.command (:236-250), `_pivotPenalty` bounded-clamp idiom (:79-94).
- `lib/core/navigation.cjs` -- closed surface exports (`findRecentChanges`, `logMemoryEvent`, `writeEdge`, `logSuggestionSurfaced`).
- `lib/core/navigation/memory-events.cjs` -- `EVENT_TYPES` frozen Set + additive-floor contract (:51-53), `logEvent` (:431), `findRecentChanges` returns parsed properties (:484-512).
- `lib/hmi/dial-reach-orchestrator.cjs` -- pure `buildReachList`, no db (:209), DIAL_REACH_K=6/RECOMMEND_FLOOR/MARGIN_THRESHOLD/REACH_IDS.
- `lib/hmi/dial-presenter.cjs` -- pure `renderDial`, reads no room.db (:51), OFFERED_K=3 (:125).
- `lib/hmi/selector-telemetry.cjs` -- `recordPresentation` command-anonymous payload (:113-132), `recordSelectorMirror` (:187).
- `lib/hmi/selector-dispatcher.cjs` -- `emitPresentationTelemetry` payload (:490-511).
- `lib/workflow/offer-closer.cjs` -- `closeOffer` reject/miss routing (consumer pattern with caller-populated `roomState.db`).
- `scripts/suggest-next-command.cjs` -- `suggestion_surfaced` carries `commands:[{command,score}]` (:101-120).
- `lib/memory/selector-decisions.test.cjs` -- injection seam + factor assertions (:236-285).
- `lib/memory/f-selector-ranker.test.cjs` -- `_setRegistry` + idempotence (:81,:385-403).
- `tests/test-148-frozen-contracts.cjs` + `tests/run-all-148.sh` -- frozen-constant assertions + Part 8 grep-sweep idiom.
- `tests/test-navigation-packet-part8-leak.cjs` -- adversarial forbidden-substring seeding idiom (:69-89).
- `docs/MINDRIAN-CANON.md` Parts 4/7/8/9 + Appendix D entry 15 (frozen 148 contracts).
- `.planning/seeds/SEED-009-...md` -- minimal-vs-full boundary + low-data overfitting rationale.
- `.planning/config.json` -- `nyquist_validation: true`.

### Primary (HIGH confidence -- read in THIS re-scope session, reach surface)
- `lib/hmi/dial-reach-orchestrator.cjs` -- `_resolveReachScore` (:143-151), `buildReachList` (:211-255), sort (:241), `_applyFrozenGate` (:175-193), `DIAL_REACH_K=6` (:56), `RECOMMEND_FLOOR`/`MARGIN_THRESHOLD` (:60-61), `REACH_DEFS`/`REACH_IDS` (:74-83), `_d4SignalFloor` advisory (:120-135).
- `lib/hmi/dial-presenter.cjs` -- `renderDial` (:233-339), `OFFERED_K=3` (:125), `slice(0, OFFERED_K)` (:244), footer (:296), cold-room framing (:131-134).
- `lib/hmi/cortex-reach-adapter.cjs` -- `buildReachScoresFromCortex` (:194-259), KNOWLEDGE_TYPES enum-gate (:115-117, 228-234), REACH_IDS mirror (:51-58).
- `lib/workflow/dial-close-reach.cjs` -- `closeReach` reject branch forwards only command/framework (:236-250), `_writeSelectedReach` (:108-120).
- `lib/workflow/selector-decisions.cjs` -- `recordSelectorDecision` payload (no reach_id, :211-247), FIX-05 optional-merge idiom (:185-193), `_invocationsSinceDecision` (:276-310), `DECAY_WINDOW` (:61).
- `scripts/intent-classifier.cjs` -- pure render seam (:869-939, no db), `runNavigationEngine` open/close db (:1339-1345, :1481-1488), render call after close (:1757-1762), F.1 closer payload assembly (:1692-1710).
- `lib/core/navigation/memory-events.cjs` -- `EVENT_TYPES` frozen Set (:10), floor-not-size contract (:51-53), `findRecentChanges` parsed properties (:484-512).
- `tests/test-148-frozen-contracts.cjs` -- the exact frozen assertions (:53-110). `tests/test-reach-ids-drift.cjs` -- the doctrine 6-bank assertion (:26, 66-72). `tests/test-148-engine-reaches.cjs` -- ranker/registry exercise. `tests/run-all-148.sh` -- Part 8 grep-sweep step d (:124-175). `tests/test-drift-baseline.cjs` -- snapshot idiom.

### Secondary / Tertiary
None. All claims verified against shipped code in this repo; no WebSearch/external sources used (generic plugin machinery; CLAUDE.md MCP-stack-awareness rule -- no silent web research needed).

---

## Metadata

**Confidence breakdown (reach surface):**
- KEYING / reach_id at close (priority 1, SC-02): HIGH -- traced closeReach + recordSelectorDecision end to end; the reach object carries reach_id, the close path drops it, the sink writes none. Conclusion (b) is definitive.
- Injection point + db/counter seam (priority 2+4, SC-03/SC-06): HIGH -- read both seams; db lifecycle (open :1341, close :1488, render :1757) is unambiguous.
- Frozen-148 guard (priority 3, SC-05): HIGH -- read both frozen tests in full; they assert constants/bank, not render count.
- W unit + presentation counting (priority 5): HIGH -- the findRecentChanges reach_id-filter idiom is the shipped command-filter idiom.
- Validation architecture (priority 6): HIGH -- every test maps to a shipped deterministic idiom with file:line.
- Constant values (priority 7): MEDIUM -- grounded + re-confirmed for 6 reaches; explicitly tunable-later.

**Research date:** 2026-06-15 (re-scoped same day, post plan-check)
**Valid until:** ~30 days (stable internal machinery; churn risk is a concurrent phase editing the dial-reach orchestrator, the intent-classifier engine arm, or EVENT_TYPES -- the last is additive-safe by the floor-not-size contract).

## RESEARCH COMPLETE
