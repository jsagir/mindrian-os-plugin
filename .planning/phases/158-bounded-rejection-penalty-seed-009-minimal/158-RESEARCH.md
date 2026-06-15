# Phase 158: bounded rejection-penalty (SEED-009-minimal) - Research

**Researched:** 2026-06-15
**Domain:** Local ranker feedback loop -- bounded REJECT penalty on the shipped `_applyDecay` IoC seam, with hard-suppression-plus-parole gated by four low-data bias fences. Generic plugin machinery; no user data, no Brain queries.
**Confidence:** HIGH (every load-bearing claim is `[VERIFIED: codebase grep/read]` against shipped code in this repo)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hook the penalty into the command-level `_applyDecay` seam (`f-selector-ranker.cjs` consuming `selector-decisions.applyDecayWeight`). `closeReach` delegates a REACH reject to `recordSelectorDecision` keyed by `reach.command`, writing the REJECTED edge + `f_selector_decision` row on `cmd:<command>`. Reaches collapse to their command key -- ONE penalty at the command seam covers BOTH surfaces.
- **D-01a (no-command guard):** when a reach has no `reach.command`, the penalty degrades to ZERO (no penalty), never throws.
- **D-02:** LAYER a new persistent count-penalty factor on top of the shipped transient recency factor; do NOT rewrite `applyDecayWeight`'s core. Shape: `adjusted = base * recencyFactor * (1 - countPenalty)`, where `recencyFactor = 1 - exp(-(n / DECAY_WINDOW))` is the EXISTING transient signal and `countPenalty` is the NEW persistent bounded discount that grows with REJECT count.
- **D-02a (combined-suppression floor):** below the hard-suppression threshold, the combined multiplicative suppression is clamped by a documented floor so a heavily-rejected-but-recovering command does not land at exactly 0 by accident (0 is reserved for the hard-suppress path).
- **D-03:** `countPenalty` counts REJECT outcomes ONLY. DEFER keeps its existing transient decay + 30d expiry; PIVOT keeps its single-term nudge. The count reads the outcome ENUM (`edge_semantic` / `decision`) from the `f_selector_decision` payload -- never the reason string (Part 8).
- **D-04:** The rejection signal is the REJECT count WITHIN the trailing recency-aging window W (D-05), not a lifetime cumulative count. Count-within-window is a rate in disguise.
- **D-05:** Hard-suppress (drop from the returned top-K) at REJECT count >= N within window W, gated by ALL FOUR fences: (M) min-presentations floor, (W) recency-aging window, periodic parole every Pth presentation, per-room scope only (Part 8).
- **D-06 (parole determinism):** parole MUST be deterministic -- keyed on a presentation counter (every Pth presentation), NOT `Math.random()`. Byte-stable-at-zero preserved.

### Claude's Discretion
- The exact values of N, M, W, parole period P, the `countPenalty` cap, and the combined-suppression floor -- tuned CONSERVATIVELY given ~4 users / <100 outcome edges (documented rationale required). Lean: small N, M >= a couple of presentations, W short enough that stale streaks expire within a working session or two.
- The precise bounded shape of `countPenalty` (linear `min(1, count/CAP)` vs a gentler curve) -- must be bounded.
- Whether to emit a `memory_event` (`reach_suppressed` / `reach_paroled`) for observability per Part 4 -- lean YES but minimal (enum/scalar payload only).

### Deferred Ideas (OUT OF SCOPE)
- FULL SEED-009: the `ranker_weights` table + gradient-descent ensemble refit -- dormant behind >=30 active users AND >=1000 outcome edges.
- Legibility (BOG-07 / Phase 157): surfacing the suppression/penalty reason in the dial "why" block.
- Cross-navigator rejection pattern detection -- Canon Part 8 separate-product territory.
- Re-tuning N / M / W / P from real telemetry once the outcome-edge count grows.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RJP-01 | Rejection signal rides the existing `_applyDecay` seam (Part 7 reuse) | Seam confirmed at `f-selector-ranker.cjs:205-213` (`_applyDecay`) + `:420-422` (call site). Extend the injected fn or layer a sibling on the same rail. See Architecture Patterns Pattern 1. |
| RJP-02 | Byte-stable at zero rejections | The "no decision -> return base_score" idiom exists at `selector-decisions.cjs:336`. Zero REJECT -> `countPenalty=0` -> `(1 - 0) = 1` -> output unchanged. Validation: byte-baseline test, see Validation Architecture. |
| RJP-03 | Bounded discount below the threshold | `countPenalty = min(CAP, count/DENOM)` bounded by documented CAP. Below N, candidate stays present with reduced positive score. |
| RJP-04 | HARD suppression at threshold N (drop from top-K) | Suppression MUST remove BEFORE `scored.slice(0, k)` at `f-selector-ranker.cjs:465`. See Seam Landmines #5. |
| RJP-05 | N is a named, conservatively-tuned constant | Mirror the `DECAY_WINDOW = 5` named-constant idiom at `selector-decisions.cjs:61`. See Constant Values. |
| RJP-06 | Part 8 -- counts/enums only, never reason strings | Read `row.properties.decision` / `edge_semantic` enum; NEVER `row.properties.reason`. Validation: forbidden-substring scan. See Validation Architecture + Security Domain. |
| RJP-07 | Part 9 -- read via `navigation.cjs` chokepoint | Read REJECT counts only via `navigation.findRecentChanges`. `applyDecayWeight` already does this at `selector-decisions.cjs:290`. No direct sqlite, no fs. |
| RJP-08 | NOT the dormant full SEED-009 | No `ranker_weights` table DDL; `0.40/0.30/0.30` literals at `f-selector-ranker.cjs:287-290` untouched; frozen-148 contracts green. |
</phase_requirements>

---

## Summary

The seam is already traced and locked in CONTEXT.md; this research grounds the **validation architecture**, the **landmines**, and the **constant values**. Three findings dominate.

**(1) The presentation-tracking landmine is REAL and this phase MUST add a lightweight presentation signal.** No existing signal records, in a graph-queryable form, that a *specific reach/command was OFFERED*. The dial path (`buildReachList` -> `renderDial`) emits NO presentation event at all. The selector-telemetry `selector_presentation` event records `options_count` + `recommended_present` + a sha256 *room* hash -- it is command-anonymous and lives partly in a JSONL ledger, not per-command in room.db. Two events DO name candidates (`suggestion_surfaced` carries `commands:[{command,score}]`; `f_selector_miss` carries `top_k_offered:[{command,score}]`) but neither fires on the dial-render path that this phase suppresses. Therefore the four fences (M floor, parole-every-Pth, count-RATE-within-W) cannot be built from existing signals. The minimal additive shape is a new enum/scalar `memory_event` written at dial-render time naming each offered `cmd:<command>` -- it stays Part 8 (counts/enums only) and Part 9 (via `navigation.logMemoryEvent`). This is the single most important plan input.

**(2) The validation architecture is fully deterministic and has clear idioms to mirror.** Every fence maps to a deterministic test using the existing `roomState.invocationsSinceDecision[command]` injection seam (no db, no RNG) plus a parallel presentation-count injection seam the phase must add. Byte-stable-at-zero mirrors the shipped `test-drift-baseline.cjs`; the Part 8 forbidden-substring scan mirrors the `run-all-148.sh` step (d) grep sweep and the `test-navigation-packet-part8-leak.cjs` adversarial seeding; the frozen invariant is the shipped `test-148-frozen-contracts.cjs` + `run-all-148.sh` (18 suites).

**(3) Two seam landmines complicate D-03 and D-04.** First, `_invocationsSinceDecision` (`selector-decisions.cjs:276`) counts ANY `f_selector_decision` row for the command -- it does NOT distinguish REJECT from DEFER. The new count MUST filter `row.properties.decision === 'reject'` (or `edge_semantic === 'REJECTED'`) itself; it cannot reuse the existing counter. Second, hard-suppression must drop the candidate BEFORE the top-K `slice` and BEFORE the desc-sort, or a suppressed item can still occupy a slot.

**Primary recommendation:** Add a thin presentation-counter `memory_event` at the dial-render seam, then layer a bounded `countPenalty` reader (REJECT-only, count-within-W, fence-gated) on the `_applyDecay` rail, hard-dropping at N before truncation. Mirror the shipped decay unit-test, drift-baseline, and 148 frozen-contract idioms verbatim.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| REJECT count read (within W) | Shared core (`lib/workflow/selector-decisions.cjs` reader) | `lib/core/navigation.cjs` (Part 9 chokepoint) | The count is generic machinery; reads go through the single navigation door. |
| Presentation counter write | Shared core (`lib/core/navigation.cjs` `logMemoryEvent`) | dial-render seam (`lib/hmi/dial-reach-orchestrator.cjs` or `dial-presenter.cjs` caller) | A presentation IS graph data (Part 4); written via the chokepoint (Part 9). |
| `countPenalty` math + fences | Shared core (`selector-decisions.cjs`, layered on `applyDecayWeight`) | -- | Pure, synchronous, testable. The IoC fn the ranker injects. |
| Hard-suppression (drop from top-K) | Shared core (`f-selector-ranker.cjs` `rankForSelector`) | -- | Truncation happens here; suppression must precede it. |
| Constants N/M/W/P/CAP/FLOOR | Shared core named module constants | -- | Mirror `DECAY_WINDOW`; Tri-Polar -- one core consumed identically CLI/Desktop/Cowork. |

---

## Standard Stack

This is internal plugin machinery. No external packages. Node.js CJS only (CLAUDE.md: no TypeScript, no new heavy dependency, `node:sqlite` DatabaseSync via the chokepoint, never `better-sqlite3`).

| Module | Role in this phase | Status |
|--------|--------------------|--------|
| `lib/workflow/f-selector-ranker.cjs` | The `_applyDecay` IoC seam + the top-K `slice`. Suppression drops here. | shipped `[VERIFIED: read]` |
| `lib/workflow/selector-decisions.cjs` | `applyDecayWeight` (layer on), `_invocationsSinceDecision` (do NOT reuse for REJECT count), `DECAY_WINDOW` named-constant idiom. | shipped `[VERIFIED: read]` |
| `lib/workflow/dial-close-reach.cjs` | `closeReach` reject path -> `recordSelectorDecision` keyed by `reach.command` (proof reaches collapse to cmd keys). | shipped `[VERIFIED: read]` |
| `lib/core/navigation.cjs` | Part 9 chokepoint: `findRecentChanges` (read), `logMemoryEvent` (write the presentation counter), `writeEdge`. | shipped `[VERIFIED: read]` |
| `lib/core/navigation/memory-events.cjs` | `EVENT_TYPES` frozen Set + `logEvent` + `findRecentChanges`. New presentation event-type added additively here. | shipped `[VERIFIED: read]` |
| `lib/hmi/dial-reach-orchestrator.cjs` / `lib/hmi/dial-presenter.cjs` | The dial-render path -- where the presentation counter fires. Both are PURE (zero db today). | shipped `[VERIFIED: read]` |

**Installation:** none. No `npm install`. (Package Legitimacy Audit section omitted -- this phase installs zero external packages.)

---

## Architecture Patterns

### System Architecture Diagram

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

### Recommended Project Structure (files touched)

```
lib/workflow/selector-decisions.cjs   # NEW: rejectCountInWindow + presentationsCount readers
                                       #      + countPenalty math + named constants N/M/W/P/CAP/FLOOR
                                       #      (or a sibling lib/workflow/reject-penalty.cjs the ranker injects)
lib/workflow/f-selector-ranker.cjs    # EDIT: hard-suppress drop BEFORE slice; wire the layered penalty
                                       #       on the existing _applyDecay rail. 0.40/0.30/0.30 UNTOUCHED.
lib/core/navigation/memory-events.cjs # EDIT: additive EVENT_TYPES entry 'reach_presented'
                                       #       (+ optional 'reach_suppressed'/'reach_paroled')
lib/hmi/dial-reach-orchestrator.cjs   # EDIT (or its caller): fire the presentation counter per offered reach
  OR lib/hmi/dial-presenter.cjs       #   NOTE both are PURE today (no db) -- see landmine below
tests/test-158-*.cjs + tests/run-all-158.sh   # NEW: the validation architecture
```

### Pattern 1: Layer on the IoC rail, do not replace it

`rankForSelector` calls `_applyDecay(applyDecayWeight, baseScore, cmd.command, roomState)` (`f-selector-ranker.cjs:420`). `_applyDecay` (`:205`) runs the injected fn and falls back to `baseScore` on non-finite/throw. Two valid wirings (planner picks):
- **(a) Extend the injected fn:** the consumer that wires `opts._applyDecayWeight` passes a composed fn `(base, cmd, rs) => applyDecayWeight(base, cmd, rs) * (1 - countPenalty(cmd, rs))`. Zero ranker edit for the discount; ranker edit ONLY for the hard-drop.
- **(b) Sibling on the same rail:** add `selector-decisions.applyRejectPenalty(base, cmd, rs)` and have the consumer compose. Same effect; clearer unit-test surface.

Either way `applyDecayWeight`'s core formula (`:330-339`) is byte-unchanged (D-02).

### Pattern 2: Deterministic parole counter (D-06)

Parole fires when `presentationsCount(cmd) % P === 0` (modular, NOT `Math.random`). A paroled reach is force-eligible (penalty waived / kept in top-K) that one turn. Because parole only acts on already-suppressed reaches (which require >= N rejects, which require presentations), a zero-reject room never triggers parole -> byte-stable-at-zero holds (D-06).

### Anti-Patterns to Avoid
- **Reusing `_invocationsSinceDecision` for the REJECT count.** It counts ALL `f_selector_decision` rows (defer + reject + the accept/approve branch never writes one), not REJECT-only. `[VERIFIED: selector-decisions.cjs:287-301 scans by command, never by decision enum]`. D-03 requires REJECT-only -- write a NEW filtered reader.
- **Dropping after `slice(0, k)`.** Truncation is at `f-selector-ranker.cjs:465`. Suppressing after it leaves a hole or lets a suppressed item ride. Drop before the sort at `:451`.
- **Reading `row.properties.reason`.** Part 8 breach (RJP-06). Read `decision` / `edge_semantic` enum only.
- **Editing `0.40/0.30/0.30`** (`:287-290`) or any frozen-148 constant. RJP-08.
- **Persisting suppression state in a new table.** That is dormant SEED-009. Suppression derives from `f_selector_decision` rows + presentation counts at score-time (CONTEXT Integration Points: "No schema change").

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading REJECT outcome edges | Direct sqlite query / fs scan | `navigation.findRecentChanges(db, since, {eventType:'f_selector_decision', limit})` | Part 9 chokepoint; already the path `applyDecayWeight` uses (`:290`). |
| Writing the presentation counter | A new JSONL ledger / a new table | `navigation.logMemoryEvent(db, 'reach_presented', {...})` | Part 4 (choice is graph data) + Part 9 (chokepoint). `EVENT_TYPES` extension is the shipped additive idiom. |
| Recency decay | A second exponential | The shipped `applyDecayWeight` recencyFactor | D-02 LAYER, do not replace. |
| AskUserQuestion payload | A bespoke widget | `selector-dispatcher.cjs` (the ONLY sanctioned door) | `test-148-frozen-contracts.cjs` asserts construction marker appears ONLY in the dispatcher. This phase must NOT add one. |
| Investment-scaled penalty curve | A new investment reader | `computeInvestmentLevel` / the `PIVOT_PENALTY_FLOOR` idiom in `dial-close-reach.cjs:79-94` | A shipped investment-scaled-penalty pattern already exists; mirror its shape for the cap rationale. |

**Key insight:** every input signal this phase needs (REJECT enum, recency factor, investment level, chokepoint reads/writes) is already shipped. The ONLY genuinely net-new substrate is the per-command presentation counter -- because nothing today records which reach was offered.

---

## Runtime State Inventory

Not a rename/refactor phase -- this section is N/A for the migration sense. But the analogous "what runtime state must exist for the fences to work" question is the landmine below, answered in full in Common Pitfalls.

---

## Common Pitfalls

### Pitfall 1 (THE LANDMINE): presentations are NOT recoverable from existing signals

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

### Bounded countPenalty reader (shape; values are Constant-Values defaults)
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

> nyquist_validation = true in `.planning/config.json`. This section is REQUIRED and drives VALIDATION.md. Every test below is DETERMINISTIC (no RNG, no clock dependence) using the shipped `roomState.invocationsSinceDecision[command]` injection seam plus a parallel `roomState.rejectCountInWindow[command]` / `roomState.presentationsCount[command]` injection seam this phase adds (mirroring the `_invocationsSinceDecision` test seam at `selector-decisions.cjs:278-282`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain CJS, `node:assert/strict`, PASS-line + non-zero-exit convention (the repo idiom; see `test-148-frozen-contracts.cjs`). No external test runner. |
| Config file | none -- bash aggregator `tests/run-all-158.sh` mirrors `tests/run-all-148.sh` |
| Quick run command | `node tests/test-158-<suite>.cjs` (per suite) |
| Full suite command | `bash tests/run-all-158.sh` (+ `bash tests/run-all-148.sh` for the frozen invariant) |

### Phase Requirements -> Test Map (the red-team ledger as deterministic tests)
| Red-team attack / Req | Behavior proven | Test Type | Automated Command | File |
|----------|----------|-----------|-------------------|------|
| confirmation-bias loop (W aging) | a candidate suppressed at count>=N RE-SURFACES once rejects age out of window W | unit | `node tests/test-158-window-aging.cjs` | Wave 0 |
| confirmation-bias loop (parole) | every Pth presentation a suppressed candidate is force-eligible (deterministic counter, no RNG) | unit | `node tests/test-158-parole.cjs` | Wave 0 |
| noise attack (M floor) | 1..M-1 rejects do NOT suppress (candidate present, discounted) | unit | `node tests/test-158-min-presentations.cjs` | Wave 0 |
| hard-suppress-at-N | at count>=N (fences pass) candidate ABSENT from top-K; at N-1 PRESENT and discounted | unit | `node tests/test-158-hard-suppress.cjs` | Wave 0 |
| byte-stable-at-zero (RJP-02) | zero-reject fixture yields output byte-identical to captured baseline | snapshot | `node tests/test-158-byte-stable.cjs` | Wave 0 (mirror `test-drift-baseline.cjs`) |
| double-crush (D-02a) | recency x countPenalty never lands at exactly 0 below N (respects COMBINED_SUPPRESS_FLOOR) | unit | `node tests/test-158-double-crush-floor.cjs` | Wave 0 |
| Part 8 (RJP-06) | forbidden-substring scan: zero reads of `properties.reason` / freeform fields in new code | grep/scan | `node tests/test-158-part8-no-reason.cjs` | Wave 0 (mirror `run-all-148.sh` step d + `test-navigation-packet-part8-leak.cjs`) |
| Part 9 (RJP-07) | new penalty path reads only via `navigation.cjs`; no `better-sqlite3`/`require('node:sqlite')`/`fs` read in penalty code | grep/scan | `node tests/test-158-part9-chokepoint.cjs` | Wave 0 |
| REJECT-only (D-03) | DEFER and PIVOT do NOT contribute to `countPenalty`; only `decision==='reject'` counts | unit | `node tests/test-158-reject-only.cjs` | Wave 0 |
| no-command guard (D-01a) | a reach with no `reach.command` yields penalty 0, never throws | unit | `node tests/test-158-no-command-guard.cjs` | Wave 0 |
| frozen-148 invariant (RJP-08) | MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, 6 reaches, 3 postures stay green | regression | `bash tests/run-all-148.sh` | shipped -- must stay 18/18 |
| presentation counter (landmine) | a `reach_presented` event lands per offered cmd; `presentationsCount` reads it back; enum/scalar only | unit | `node tests/test-158-presentation-counter.cjs` | Wave 0 |

### Deterministic test idioms to mirror (named, with file:line)
- **Injection seam (no db, no RNG):** `selector-decisions.test.cjs:236-285` injects `roomState: { invocationsSinceDecision: { 'mos:x': N } }` and asserts factor values within tolerance. Mirror with `roomState.rejectCountInWindow` / `roomState.presentationsCount`.
- **Ranker injection:** `f-selector-ranker.test.cjs:81` uses `r._test._setRegistry(FAKE_REGISTRY)` for deterministic candidate sets; `:385-403` proves idempotence (`rankForSelector` twice -> deepEqual). Reuse `_setRegistry` for the suppress/present fixtures.
- **Byte-stable baseline:** `tests/test-drift-baseline.cjs` is the shipped snapshot idiom; capture a pre-phase zero-reject `rankForSelector` output and assert byte-identity.
- **Part 8 forbidden-substring sweep:** `run-all-148.sh:130-176` greps new artifacts for forbidden tokens (`projectText|safeNodeProjection|...`) and free-text body fields; `test-navigation-packet-part8-leak.cjs:69-89` seeds `SECRET RAW ... BODY` + emails + long strings and asserts ZERO in `JSON.stringify`. Mirror: seed a REJECTED row with a distinctive `reason:'SECRETREASON123'` and assert it NEVER appears in any value the penalty path reads/emits.
- **Frozen-contract assertions:** `test-148-frozen-contracts.cjs:53-75` asserts the exact constants. The 158 suite must NOT touch them; `run-all-148.sh` stays the gate.

### Sampling Rate
- **Per task commit:** `node tests/test-158-<suite>.cjs` for the touched behavior.
- **Per wave merge:** `bash tests/run-all-158.sh` + `bash tests/run-all-148.sh`.
- **Phase gate:** both green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-158.sh` -- the one-command phase gate (mirror `run-all-148.sh` structure: CJS suites loop + carried 148 fences + Part 8 grep sweep step).
- [ ] All 12 `tests/test-158-*.cjs` suites above.
- [ ] A captured zero-reject baseline fixture for the byte-stable test.
- [ ] The `roomState.rejectCountInWindow` / `presentationsCount` test-injection seams in the new reader (mirroring `_invocationsSinceDecision`'s seam).

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
| V8/V9 Data protection / comms | yes (Canon Part 8) | The penalty reads/emits enum + scalar + `cmd:<command>` handle ONLY; NEVER rejection reason strings; NEVER cross-room; NEVER a Brain packet field. Zero network surface. |

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
| A1 | The dial *consumer* (caller of `buildReachList`+`renderDial`+`closeReach`) already holds `roomState.db` and is the right place to fire `reach_presented`, keeping the orchestrator/presenter pure | Common Pitfalls / landmine | LOW -- if no such consumer exists yet, the planner must thread db into the orchestrator (a scope bump, flagged). The `closeReach` consumer pattern (`roomState.db` populated by caller) is strong evidence this consumer exists. |
| A2 | Starting constant values (N=3, M=2, W=8, P=5, CAP=0.6, FLOOR=0.05) | Constant Values | LOW -- explicitly tunable later (Deferred). These are conservative defaults; the planner locks them and documents the low-data rationale. |
| A3 | "Window W in presentation-units" (count rejects whose presentation-rank falls within the last W presentations) is the cleanest reading of D-04's count-within-window | Code Examples | MEDIUM -- D-04 says "count within the trailing recency-aging window W"; W could be invocation-units (like DECAY_WINDOW) or wall-clock. Presentation-units aligns the rate with the parole counter and the M floor. The planner should confirm the W unit with the navigator if ambiguous. |

---

## Open Questions

1. **W unit: presentations vs invocations vs wall-clock.**
   - What we know: DECAY_WINDOW is invocation-units; the M floor and parole are presentation-units; D-04 calls W a "recency-aging window."
   - What's unclear: whether "within W" counts rejects by presentation-rank, by `framework_invoked` count (like DECAY_WINDOW), or by time.
   - Recommendation: presentation-units (A3) -- it unifies W, M, and P on one counter and keeps the rate framing honest. Confirm at plan time; it is a one-line change to `rejectCountInWindow`.

2. **Where exactly the presentation counter fires (consumer vs orchestrator).**
   - What we know: orchestrator + presenter are pure-by-design (no db).
   - What's unclear: whether a single dial consumer already owns the db handle at render time.
   - Recommendation: locate the dial consumer (the surface that calls `buildReachList` then later `closeReach`); fire there. If none, thread db into a thin counter call and document the purity exception. The planner must resolve this BEFORE writing tasks -- it is the one scope-risk in the phase.

3. **Optional observability events (`reach_suppressed`/`reach_paroled`).**
   - Recommendation: include `reach_presented` (load-bearing for the fences) as in-scope; treat `reach_suppressed`/`reach_paroled` as in-scope-minimal-if-cheap, enum/scalar only, else defer to BOG-07/Phase 157.

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

### Secondary / Tertiary
None. All claims verified against shipped code in this repo; no WebSearch/external sources used (generic plugin machinery; CLAUDE.md MCP-stack-awareness rule -- no silent web research needed).

---

## Metadata

**Confidence breakdown:**
- Presentation-tracking landmine (priority 1): HIGH -- exhaustive grep + read of every presentation/offered signal; conclusion (b) is definitive.
- Validation architecture (priority 2 + 5): HIGH -- every test maps to a shipped deterministic idiom with file:line.
- Constant values (priority 3): MEDIUM -- grounded against shipped reference constants + CONTEXT leans; explicitly tunable-later.
- Seam landmines (priority 4): HIGH -- read directly from the seam files.

**Research date:** 2026-06-15
**Valid until:** ~30 days (stable internal machinery; the only churn risk is a concurrent phase editing the dial seam or EVENT_TYPES, which is additive-safe by the floor-not-size contract).

## RESEARCH COMPLETE
