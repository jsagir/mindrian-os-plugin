# Phase 222: Reach ranking unification - Research

**Researched:** 2026-07-14
**Domain:** In-tree ranking/selection wiring (Node CJS, room-local), plus a hand-rolled multiplicative-weights (Hedge) layer over the existing outcome log
**Confidence:** HIGH (all six research questions answered by reading the CURRENT tree at commit `9a52d5e8`; every signature/line-number verified in this session, not assumed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (wiring point):** A new PURE function (working name `rankFiredCandidates(sensorReaches, roomState)`) in a NEW module owns the shared selection. It takes `dispatchSensors`' already-fired candidate array (a turn-dependent SUBSET of the 6 canonical reaches, detection logic untouched) and ranks just those candidates using the same D4 inputs `dial-reach-orchestrator.cjs` computes from `roomState.reachScores`. `resolveFireSkill` and `dispatchCandidateReaches` both call this new function instead of taking `sensorReaches[0]` / the raw array. Do NOT modify `dial-reach-orchestrator.cjs` (it assumes the fixed 6-reach universe) or `insight-sensors.cjs` detection logic (out of scope).
- **D-02 (weight-state persistence):** Weight state lives room-local (NOT a parallel graph, never cross-room, never in a Brain packet). Enum/scalar properties only, no freeform text (Part 8). Reads go through `navigation.findRecentChanges` (Part 9 chokepoint). Atomic tmp+rename discipline, matching the jtbd-state atomic model. Follow the SEED-009 `ranker_weights` precedent shape, not a new bespoke pattern. **See Open Question OQ-1 — "room.db side-table" vs "jtbd-state atomic file" vs "memory_event rows" is under-specified in D-02 and this research recommends the memory_event path as the only shape consistent with the `findRecentChanges` read requirement.**
- **D-03 (Hedge update cadence):** Bounded, not per-event. Update at most once per N events (mirrors Phase 158's debounce discipline and SEED-009's stated N=50). Ship N as an env-tunable default (recommend N=50), re-derivable without a code change.
- **D-04 (test harness):** `tests/run-all-222.sh` mirrors the existing `run-all-209.sh` / `run-all-158.sh` structure. Reachability legs follow the Phase 213-03 born-wired proof pattern (drive the REAL MCP tool registration and the REAL per-turn engine call, not a bypassed internal function call).

### Claude's Discretion
- Exact N for the debounce window beyond "matches SEED-009's N=50 precedent."
- The specific column/property names for the weight-state record.
(Both explicitly deferred to the planner/researcher, not navigator judgment calls.)

### Deferred Ideas (OUT OF SCOPE)
- SEED-009's full cross-tester gradient-descent learned ranker (stays dormant at its own >=30-tester / >=1000-edge gate).
- `strategic_rank` / whitespace zone scoring (SEED-057).
- SEED-057's synthesis-triggering expert.
- Any new Brain egress.
- Rebuilding/modifying individual sensor detection logic in `insight-sensors.cjs`.
- Periodic Shapley-value attribution reporting (fast-follow, not required).
- Threading real `cortexNodes` into the MCP tool call path (`buildSensorInputs`) — separate later concern. Consequence: on the MCP path D4 is flat 0.5 for every fired candidate, so the Hedge layer is the ONLY differentiator there.
- Version numbering for the release.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Req 1 | `suggest_next` / `reach_candidates` return the scored pick, not registry order | `buildReachScoresFromCortex(ctx.cortexNodes\|\|[])` -> reachScores; score fired subset by reach_id. MCP path has no cortex nodes -> flat 0.5 floor (verified `cortex-reach-adapter.cjs:194-198`) |
| Req 2 | `resolveFireSkill`'s auto-fire uses the same scored pick | Re-order `sensorReaches` before it reaches `resolveFireSkill` (single insertion in `decide()` at ~line 924, or inside `dispatchCandidateReaches`). Preserves the Wicked-escalation precedence (:591-597) and dead-Brain degrade (:604) |
| Req 3 | Hand-rolled Hedge layer adjusts D4 from real outcomes, per-room | Two experts {D4 blend, raw registry signal}; multiplicative-weights update from `f_selector_decision` rows read via `findRecentChanges`. Weight state persisted as a new `memory_event` type |
| Req 4 | Zero new dependencies | Pure CJS against `node:*` + existing `lib/` modules. CI grep tripwire per the Phase-90 5-tripwire pattern |
| Req 5 | Frozen selector scalars provably untouched | Byte-diff leg mirroring `test-148-frozen-contracts.cjs` / `test-205-frozen-six-guard.cjs`: MAX_K=3, DIAL_REACH_K=6, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15 |
| Req 6 | Reachability proven, not assumed | Drive REAL `sensors.register(fakeServer, ctx)` + capture the handler; drive REAL `nav.decide()`. Pattern = `test-213-reach-wired.cjs` + the `makeFakeServer()` seam in `test-198-contract-schema.test.cjs` |
| Req 7 | Failed weight-state read degrades visibly | On missing/corrupt weight state, fall back to D4-alone (equal weights) AND emit a `reach_weight_state_unavailable` memory_event. Healthy table emits NO such event |
</phase_requirements>

## Summary

This is a **wiring-unification + one small new module** phase, not a new ranking system. Today there are two ranking paths: (1) the UNSCORED path — `dispatchSensors` returns candidate reaches in fixed `SENSOR_REGISTRY` order; `resolveFireSkill` (`navigation-engine.cjs`) and the two MCP tools (`suggest_next` / `reach_candidates` in `lib/mcp/tools/sensors.cjs`) all take `[0]` or the raw array. (2) The SCORED path — `dial-reach-orchestrator.cjs::buildReachList` applies the D4 blend to the 6 canonical reaches via `roomState.reachScores` (populated by `cortex-reach-adapter.cjs::buildReachScoresFromCortex`). Path (1) never consults a score. This phase routes all three consumers of path (1) onto a single new pure function that scores the fired subset, then layers a hand-rolled Hedge adjustment learned from the Phase-159 outcome log.

The cleanest architecture (verified against the current call graph) is a new `rankFiredCandidates(sensorReaches, roomState)` that **re-orders the fired array in place-of-order** so every downstream `sensorReaches[0]` read (the engine trace, `resolveFireSkill`, the rationale clause) automatically sees the scored winner first — a single insertion point in `decide()` covers Req 2, and a matching insertion in `dispatchCandidateReaches` covers Req 1. The function scores each fired candidate's `reach_id` against the same `roomState.reachScores` map the dial reads, then applies the Hedge combiner.

**Weight-state persistence is the one genuinely under-specified decision.** D-02 names three different mechanisms in one breath ("room.db side-table" + "jtbd-state atomic-file model" + "reads through `findRecentChanges`"). These are mutually incompatible: `findRecentChanges` reads ONLY `memory_event` node rows — it cannot read a bespoke CREATE TABLE side-table or a JSON file. The only shape that satisfies the locked `findRecentChanges` read requirement AND Phase 158's exact precedent is: **store weight state as a new `ranker_weight_updated` (scalar-only) `memory_event`, write via `navigation.logMemoryEvent`, read the latest via `navigation.findRecentChanges`.** This is flagged as OQ-1 for user/planner confirmation.

**Primary recommendation:** Build one new pure module `lib/workflow/reach-hedge-ranker.cjs` exporting `rankFiredCandidates(sensorReaches, roomState)` + the Hedge combiner + the weight read/update helpers; wire it at exactly two call sites (`decide()` and `dispatchCandidateReaches`); persist weight state as scalar-only `memory_event` rows (Phase 158 pattern); add 2 new `EVENT_TYPES` (`ranker_weight_updated`, `reach_weight_state_unavailable`); mirror `run-all-209.sh` with reachability legs modeled on `test-213-reach-wired.cjs`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sensor detection (does X fire this turn) | `lib/core/insight-sensors.cjs` (engine core) | — | Out of scope; untouched (SPEC boundary) |
| Scored selection of the fired subset | NEW `lib/workflow/reach-hedge-ranker.cjs` | `f-selector-ranker.cjs` (D4 math), `cortex-reach-adapter.cjs` (reachScores) | Pure, room-local; the single selection brain (Connector Spine: "no second selection brain") |
| Per-turn engine auto-fire | `lib/core/navigation-engine.cjs::resolveFireSkill` | new module (via re-ordered `sensorReaches`) | Engine owns the fire decision; new module owns the ORDER it consumes |
| MCP tool reads | `lib/mcp/tools/sensors.cjs` | new module (via `dispatchCandidateReaches`) | Thin MCP surface over the shipped reach path |
| Outcome-log read (reward signal) | `lib/core/navigation.cjs::findRecentChanges` | `offer-closer.cjs::closeOffer` (write side, Phase 159) | Part 9 chokepoint; no new write site |
| Weight-state persistence | `lib/core/navigation.cjs` typed accessor pair (`readHedgeWeightState`/`upsertHedgeWeightState`) over the new `ranker_weights` room.db table | `lib/core/migrations/phase-222-ranker-weights.cjs`, `memory-events.cjs` EVENT_TYPES (additive, degrade signal only) | **Superseded by OQ-1's RESOLVED navigator override** (real room.db table, not `memory_event` rows). Row kept for audit trail; see OQ-1 below for the authoritative resolution. |

## Standard Stack

### Core (all in-tree; zero new packages)
| Module | Role in this phase | Verified location |
|--------|--------------------|-------------------|
| `lib/hmi/cortex-reach-adapter.cjs` | `buildReachScoresFromCortex(cortexNodes) -> {reach_id: 0..1}` — produces the reachScores map | `:194-259`, exported `:262` |
| `lib/workflow/f-selector-ranker.cjs` | The D4 blend (`rankForSelector`) + `MAX_K=3` | `:47-52` (formula), `:87` (MAX_K), `:622` (`rankForSelector`) |
| `lib/hmi/dial-reach-orchestrator.cjs` | Reference read pattern (`_resolveReachScore`, `_d4SignalFloor`); DIAL_REACH_K/RECOMMEND_FLOOR/MARGIN_THRESHOLD | `:112/:116/:117` (frozen consts), `:199-207` (`_resolveReachScore`) |
| `lib/workflow/reach-reject-reader.cjs` | Phase-158 outcome-based reject penalty the Hedge layer must compose with (not duplicate) | `computeReachPenalties` `:331`, `REACH_IDS` `:41-48` |
| `lib/core/navigation.cjs` | `findRecentChanges` (read), `logMemoryEvent` (write) chokepoint | `findRecentChanges` re-export `:89`, `logMemoryEvent` re-export `:108` |
| `lib/core/navigation/memory-events.cjs` | `logEvent(db,type,payload,opts)`, `findRecentChanges(db,since,opts)`, `EVENT_TYPES` | `logEvent :638`, `findRecentChanges :691`, `EVENT_TYPES :10-625` |
| `lib/core/navigation-engine.cjs` | `resolveFireSkill`, `reachIdToSkillFamily`, `decide()` wiring | `resolveFireSkill :588`, `reachIdToSkillFamily :423`, decide() dispatch `:923` + `resolveFireSkill` calls `:1035`/`:1234` |
| `lib/mcp/tools/sensors.cjs` | `dispatchCandidateReaches`, `suggest_next`, `reach_candidates`, `buildSensorInputs` | see line-number table below |

### Supporting (algorithm references only — PORTED, never vendored)
| Reference | What to port | Confidence |
|-----------|--------------|-----------|
| Arora-Hazan-Kale (2012) "The Multiplicative Weights Update Method: a Meta-Algorithm" | The Hedge/MWU update rule: `w_i <- w_i * exp(-eta * loss_i)`, renormalize | `[CITED: Arora/Hazan/Kale survey]` — pseudocode is standard; the 2-expert case is ~15 lines |
| River `ThompsonSampling`, `benedekrozemberczki/shapley`, `vcg-auction.py` | Named in SPEC as read-only references for the DEFERRED fast-follows, NOT this phase | `[CITED: 222-SPEC.md:44-50]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `rankFiredCandidates` module | Extend `dial-reach-orchestrator.cjs` | Rejected in D-01: the orchestrator assumes the fixed 6-reach universe and is referenced by frozen tests (`test-dial-reach-orchestrator.cjs`, `test-148-frozen-contracts.cjs`); forcing a turn-subset path in would break its 6-reach contract |
| `memory_event` weight persistence | New room.db CREATE TABLE `ranker_weights` | **Superseded: the navigator chose this option at the plan-phase gate (OQ-1 RESOLVED).** Original objection (no precedent for an adaptive-state CREATE TABLE) was verified false during planning — `phase-109-session-focus.cjs` is a directly reusable, sentinel-idempotent migration precedent. Read path is a new typed `navigation.cjs` accessor pair, not `findRecentChanges`. |
| `memory_event` weight persistence | jtbd-state JSON file (`writeStateAtomic`) | A file read violates the hot-path budget ("no new synchronous file reads beyond what dispatchSensors/dial-reach-orchestrator already perform", Constraints) AND is not readable via `findRecentChanges` |

**Installation:** None. `git diff package.json package-lock.json` MUST stay empty (Req 4).

**Version verification:** N/A — zero new packages. The zero-dependency verdict was reached this session via a 107-agent deep-research pass (`222-SPEC.md:44-50`); no registry lookup applies.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (Req 4 forbids any new `package.json` entry). All logic is pure CJS against `node:*` built-ins and existing repo modules. The CI dependency tripwire (Req 4 acceptance) is itself the legitimacy gate: a grep tripwire (mirroring the Phase-90 5-tripwire pattern) fails the build if any new `require()` target outside `node:*` or this repo's own `lib/`/`data/` trees appears in the new module(s). `slopcheck` / registry verification steps are moot with no install.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
   TURN INPUT ──────────▶│ dispatchSensors(turn, tuple, ctx)        │  (UNCHANGED, out of scope)
   (engine or MCP)       │  -> [reach{reach_id,posture,...}, ...]    │
                         │     in fixed SENSOR_REGISTRY order        │
                         └───────────────────┬─────────────────────┘
                                             │ fired subset (turn-dependent)
                                             ▼
                    ┌──────────────────────────────────────────────────────┐
                    │  NEW: rankFiredCandidates(sensorReaches, roomState)   │
                    │  1. reachScores = buildReachScoresFromCortex(         │
                    │        roomState.cortexNodes || [])   (Req 1)          │
                    │  2. d4[i]  = reachScores[reach_id] ?? 0.5 floor        │
                    │  3. reg[i] = registry-order signal (1/(rank+1))       │
                    │  4. combined[i] = w_d4*d4[i] + w_reg*reg[i]           │
                    │        weights from Hedge state (Req 3)                │
                    │        weight read via findRecentChanges (Req 3/7)     │
                    │        missing/corrupt -> equal weights + emit         │
                    │        reach_weight_state_unavailable  (Req 7)         │
                    │  5. compose Phase-158 reject penalty into d4 expert    │
                    │  6. return sensorReaches re-sorted by combined desc    │
                    └───────────┬───────────────────────────┬──────────────┘
                                │                           │
             ENGINE PATH        │                           │   MCP PATH
                                ▼                           ▼
   decide(): sensorReaches =              dispatchCandidateReaches():
     rankFiredCandidates(...)               reaches = rankFiredCandidates(...)
        │  (all [0] reads now scored)          │
        ▼                                      ▼
   resolveFireSkill(...,sensorReaches)     suggest_next -> reaches[0]
        -> reachIdToSkillFamily([0])       reach_candidates -> reaches (ordered)
        -> fire_skill verb  (Req 2)                             (Req 1)

   OUTCOME LOOP (reward signal, no new write site):
   offer-closer.closeOffer (Phase 159) -> f_selector_decision memory_event
        └──read via navigation.findRecentChanges──▶ Hedge weight update (debounced N=50)
                                                     └─write ranker_weight_updated memory_event
```

### Recommended Project Structure
```
lib/workflow/
├── reach-hedge-ranker.cjs      # NEW: rankFiredCandidates + Hedge combiner + weight read/update
                                #      (mirror reach-reject-reader.cjs conventions: pure reads via
                                #       navigation chokepoint, REACH_IDS local const, enum/scalar only)
lib/core/navigation/
├── memory-events.cjs           # EDIT (additive): +2 EVENT_TYPES entries
tests/
├── run-all-222.sh              # NEW: mirror run-all-209.sh run_if shape + 158-style grep/frozen legs
├── test-222-hedge-update.cjs   # NEW: Req 3 synthetic-outcome convergence
├── test-222-rank-fired.cjs     # NEW: Req 1 score-order + flat-floor + Hedge-tiebreak
├── test-222-reach-wired.cjs    # NEW: Req 6 reachability via REAL decide() + REAL MCP register
├── test-222-frozen-scalars.cjs # NEW: Req 5 byte-diff of the four frozen constants
├── test-222-degrade.cjs        # NEW: Req 7 corrupt-state -> D4-alone + event; healthy -> no event
└── test-222-zero-deps.cjs      # NEW: Req 4 require-tripwire over the new module
```

### Pattern 1: In-place re-ordering (minimal-touch wiring)
**What:** `rankFiredCandidates` returns the SAME fired reach objects, re-sorted by combined score descending. It does not change the object shape, so every existing `sensorReaches[0]` read (engine trace `:357`, `resolveFireSkill` `:605`, rationale `:1222`, MCP `reaches[0]` `:146`) transparently sees the scored winner.
**When to use:** Everywhere a `[0]`/first-element read currently encodes "the top reach."
**Example (engine insertion point, after dispatch at `navigation-engine.cjs:918-926`):**
```javascript
// Source: current tree, navigation-engine.cjs:918-926 (verified this session)
let sensorReaches = [];
try {
  const reaches = dispatchSensors(t, sensorTuple, sensorCtx);
  sensorReaches = Array.isArray(reaches) ? reaches : [];
} catch (_e) { sensorReaches = []; }
// NEW (Phase 222): re-order the fired subset by the shared scored selection BEFORE
// any [0] read. roomState here is the same object dial-reach-orchestrator consumes.
sensorReaches = reachHedgeRanker.rankFiredCandidates(sensorReaches, roomStateForRank);
```

### Pattern 2: reachScores read (mirror the dial, do not diverge)
**What:** Score a `reach_id` exactly as `dial-reach-orchestrator._resolveReachScore` does — supplied prior from `roomState.reachScores`, else the registry default.
**Example:**
```javascript
// Source: dial-reach-orchestrator.cjs:199-207 (verified this session) - MIRROR this read
function d4For(reachId, reachScores) {
  const supplied = reachScores && reachScores[reachId];
  if (typeof supplied === 'number' && isFinite(supplied)) return clamp01(supplied);
  return 0.5; // REGISTRY_DEFAULT_BRAIN_CONFIDENCE - the flat floor the MCP path always hits
}
```

### Pattern 3: Hedge (MWU) two-expert update
**What:** Two experts — expert A = the D4 blend score, expert B = the raw registry-order signal. On each outcome window, whichever expert's argmax was SHOWN takes a loss (reject = high loss ~1, accept = low loss ~0); update `w <- w * exp(-eta * loss)`, renormalize so `w_A + w_B = 1`.
**Example (pure, ~15 lines):**
```javascript
// Source: Arora-Hazan-Kale 2012 MWU meta-algorithm (standard pseudocode)
function hedgeUpdate(weights, losses, eta) {          // weights={A,B}, losses={A,B}
  const wA = weights.A * Math.exp(-eta * losses.A);
  const wB = weights.B * Math.exp(-eta * losses.B);
  const z = wA + wB;
  return z > 0 ? { A: wA / z, B: wB / z } : { A: 0.5, B: 0.5 };
}
function combine(d4, reg, weights) {                  // the per-candidate blended score
  return weights.A * d4 + weights.B * reg;
}
```
Keep the combiner GENERAL over an expert list (SEED-057 note: a future 4th expert class must not require re-architecting "exactly two experts"). Store weights keyed by an expert-id array, not hardcoded `.A`/`.B`, if cheap.

### Pattern 4: additive EVENT_TYPES extension
**What:** Adding a `memory_event` type is a one-line addition to the `EVENT_TYPES` `Set` in `memory-events.cjs`, with a header comment block matching the ~30 prior additive blocks. `logEvent` rejects any type not in the set (`:639`), so the new types are accepted ONLY because they are IN the set. Tests assert a FLOOR + named membership, never an exact `.size`.
**Example:**
```javascript
// Source: memory-events.cjs additive idiom (Phase 158-02 reach_presented :453, etc.)
'ranker_weight_updated',            // Phase 222: scalar weight-state snapshot (the two expert weights)
'reach_weight_state_unavailable',   // Phase 222 Req 7: disclosed degrade signal
```

### Anti-Patterns to Avoid
- **A second selection brain:** The Connector Spine mandate (CLAUDE.md Architecture) is "one governed reach path; no second selection brain." `rankFiredCandidates` re-orders the ONE dispatch output; it does not re-run detection or mint a parallel registry.
- **Threading `db` into the pure ranker or the dial:** Phase 158's `test-158-reach-orchestrator-pure.cjs` fails if the orchestrator gains a `db`/`navigation` require. The new module MAY read via `navigation.findRecentChanges` (it is a workflow reader like `reach-reject-reader.cjs`, not the pure renderer), but must accept a `roomState` injection seam so its scoring can run db-free in unit tests (mirror `reach-reject-reader.cjs`'s `_injected(roomState, fnName, reachId)` at `:123`).
- **Reordering the frozen `REACH_IDS` or bypassing `decide()`:** Phase 213-03 doctrine (`test-213-reach-wired.cjs:170-177`): fixes to selection belong in scoring, NEVER in reordering the frozen canonical list or bypassing the real engine.
- **Silent fallback on weight-state read failure:** Req 7 + SEED-059 — a caught exception is not enough; emit the `reach_weight_state_unavailable` event so an audit can grep for it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| D4 scoring math | A second scoring formula | `f-selector-ranker.rankForSelector` inputs + `_resolveReachScore` read pattern | Canon Part 7; the dial already owns the one formula. Diverging creates two scoring truths |
| reachScores map | Parse cortex nodes yourself | `cortex-reach-adapter.buildReachScoresFromCortex(cortexNodes)` | Already degrades to `{}` on empty (`:194-198`); already Part-8-safe (enum/presence only) |
| Outcome-log read | Open room.db / write SQL | `navigation.findRecentChanges(db, since, {eventType:'f_selector_decision'})` | Part 9 chokepoint; Phase 158 already reads the exact same rows this way |
| memory_event write | Craft an INSERT | `navigation.logMemoryEvent(db, type, payload)` | Handles id-minting, dedupe, `event_type` merge, `created_by` defaulting (`:674-688`) |
| Reject penalty | A parallel reject discount | `reach-reject-reader.computeReachPenalties` | CONTEXT: "compose with or supersede cleanly, not a second uncoordinated adjustment." Feed the 158 discount into the D4 expert BEFORE the Hedge blend |
| Atomic state write (if a file is ever chosen) | ad-hoc write | `lib/hmi/jtbd-state.cjs::writeStateAtomic` tmp+rename (`:56-69`) | The named atomic precedent D-02 cites |

**Key insight:** Almost every piece this phase needs already exists as a shipped, tested organ. The net-new surface is genuinely small: the Hedge combiner (~30 lines), the reorder glue (~2 call-site edits), and the weight read/update (~40 lines). SEED-009's own estimate for the adjacent updater was ~120 lines; this room-local subset is smaller.

## Runtime State Inventory

> Included because this phase introduces NEW persisted room-local state (weight snapshots) even though it is not a rename.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NEW: `ranker_weight_updated` memory_event rows (the two expert weights + an update counter, scalar). Read the LATEST via `findRecentChanges`. Cold start = zero rows = equal weights (byte-stable, no degrade event). | New code writes them; no migration of existing data (none exists) |
| Live service config | None — no external service holds reach-ranking state. Verified: the outcome log (`f_selector_decision`) already lives in room.db, written by the shipped Phase-159 path; no new write site. | None |
| OS-registered state | None. | None ("None — verified: no scheduler/daemon touches reach ranking") |
| Secrets/env vars | NEW env var: the Hedge debounce N (recommend `MINDRIAN_HEDGE_UPDATE_N`, default 50) and the learning rate eta (recommend `MINDRIAN_HEDGE_ETA`). Code-read only; document in `docs/ENV-TUNING.md`. | Add to ENV-TUNING doc; read defensively with numeric defaults |
| Build artifacts | None. No compiled artifact carries reach-ranking state. | None |

**The canonical question — after every file is updated, what runtime state still holds the old behavior?** The OLD behavior (registry-order selection) is pure code, not persisted; once the two call sites are rewired there is no cached old ordering anywhere. The only NEW persisted state is the weight snapshots, which are cold-start-neutral (absence = equal weights = D4-alone = today's ordering when reachScores is populated).

## Common Pitfalls

### Pitfall 1: `rankForSelector` ranks COMMANDS, not reaches
**What goes wrong:** Assuming `rankForSelector` (or `buildReachList`) can rank the fired sensor subset directly. It ranks the 107-command registry keyed by `command`, scored by D4; the dial only borrows `ranked[0].score` as a scalar floor (`_d4SignalFloor :176-191`).
**Why it happens:** The names sound interchangeable.
**How to avoid:** `rankFiredCandidates` scores each candidate by `reach_id` against `roomState.reachScores` (the map `buildReachScoresFromCortex` produces), NOT by calling `rankForSelector` on the candidates. Reuse the FORMULA/inputs, not the command-ranking entry point.
**Warning signs:** Fired reaches coming back with `command`/`jtbd_summary` fields (that is the command RankedItem shape, wrong object).

### Pitfall 2: The MCP path has no `roomState`/`cortexNodes`
**What goes wrong:** `buildSensorInputs` (`sensors.cjs:81-90`) builds only `ctx = { roomDir, lowFillSections: null }`. There is no `roomState`, no `cortexNodes`, no db handle threaded to `dispatchCandidateReaches`.
**Why it happens:** Threading cortex nodes into the MCP path is explicitly DEFERRED (SPEC boundary).
**How to avoid:** `rankFiredCandidates` must tolerate an absent/empty `roomState`: `buildReachScoresFromCortex([])` returns `{}` -> every candidate gets the 0.5 flat floor -> the Hedge adjustment is the ONLY differentiator (this is the intended Req 3 behavior, not a bug). For the Hedge read on the MCP path, open the room.db via the same `navigation.openRoomDbForCaller(roomDir)` the other sensors tools use (`sensors.cjs:185`), or accept a cold `{A:0.5,B:0.5}` when no db is available.
**Warning signs:** A crash/throw when `roomState` is undefined on an MCP call.

### Pitfall 3: Vacuous-green reachability tests
**What goes wrong:** A unit test that calls `rankFiredCandidates` directly "passes" while the real `decide()` / MCP tool still returns registry order (the Phase 150.5 dead-sensor disease — 5 of 8 sensors were structurally dead despite green unit tests).
**Why it happens:** Testing the internal function instead of the real read path.
**How to avoid:** Req 6 legs MUST drive `nav.decide(...)` and `sensors.register(fakeServer, ctx)` then invoke the captured handler — the `test-213-reach-wired.cjs` + `test-198` `makeFakeServer()` pattern. Assert against SHIPPED maps (`reachIdToSkillFamily`), never hand-typed verb literals. Include a NEGATIVE arm (registry-first != score-first) so the test proves it is load-bearing.
**Warning signs:** No `require('.../navigation-engine.cjs')` or `require('.../tools/sensors.cjs')` in the reachability test.

### Pitfall 4: Frozen-scalar drift
**What goes wrong:** Touching `MAX_K`, `DIAL_REACH_K`, `RECOMMEND_FLOOR`, or `MARGIN_THRESHOLD`.
**How to avoid:** The new module reads these as read-only inputs and never redefines them. The Req 5 leg (mirror `test-148-frozen-contracts.cjs:11-16`) asserts each `=== ` its frozen value.

### Pitfall 5: Emitting `reach_weight_state_unavailable` unconditionally
**What goes wrong:** Emitting the degrade event on every cold-start (no weights yet) makes the signal dishonest (Req 7 acceptance: a healthy table emits NO event).
**How to avoid:** Cold-start (zero `ranker_weight_updated` rows) is NORMAL -> equal weights, NO event. Emit ONLY on a real read FAULT (findRecentChanges throws, or a row's scalar props fail validation). Test both: corrupt -> event; healthy -> no event.

## Code Examples

### Reading the latest weight snapshot (Req 3 read + Req 7 degrade)
```javascript
// Source: composed from navigation/memory-events.cjs:691 (findRecentChanges) + Phase 158 read idiom
function readHedgeWeights(db, roomState) {
  // Injection seam so unit tests run db-free (mirrors reach-reject-reader _injected :123)
  if (roomState && roomState.hedgeWeights && typeof roomState.hedgeWeights === 'object') {
    return roomState.hedgeWeights;
  }
  if (!db) return { A: 0.5, B: 0.5 };            // cold/MCP path -> equal weights, NO event
  let rows;
  try {
    rows = navigation.findRecentChanges(db, 0, { eventType: 'ranker_weight_updated', limit: 1 });
  } catch (_e) {
    emitUnavailable(db, roomState);               // Req 7: real fault -> disclosed degrade
    return { A: 0.5, B: 0.5 };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { A: 0.5, B: 0.5 }; // cold start, no event
  const p = rows[0].properties || {};
  const a = Number(p.weight_a), b = Number(p.weight_b);
  if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0 || (a + b) <= 0) {
    emitUnavailable(db, roomState);               // Req 7: corrupt scalar -> disclosed degrade
    return { A: 0.5, B: 0.5 };
  }
  const z = a + b;
  return { A: a / z, B: b / z };
}
function emitUnavailable(db, roomState) {
  try {
    navigation.logMemoryEvent(db, 'reach_weight_state_unavailable',
      { created_by: 'system', source_path: 'reach-hedge-ranker' });
  } catch (_e) { /* never throw from the degrade path */ }
}
```

### The reject-penalty composition (Phase 158 into the D4 expert)
```javascript
// Feed the shipped 158 discount into the D4 expert BEFORE the Hedge blend so there is
// ONE coordinated adjustment, not two (CONTEXT reusable-assets note).
const cp = reachRejectReader.countPenalty(db, reachId, roomState); // 0..0.6, db-free via injection
const d4Adjusted = d4For(reachId, reachScores) * (1 - cp);
const combined = weights.A * d4Adjusted + weights.B * registrySignal(rank);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sensorReaches[0]` = registry-order "top" | Combined-score winner via `rankFiredCandidates` | This phase | Three consumers agree on one pick |
| D4 weights static (0.40/0.30/0.30) | D4 unchanged; a NEW Hedge layer reweights {D4-expert, registry-expert} from outcomes | This phase | Room-local adaptation without touching the frozen D4 formula |
| Phase 158 reject penalty as the only outcome signal | Hedge layer subsumes/composes the 158 reject signal | This phase | 158 discount becomes an input to the D4 expert, not a parallel adjustment |

**Deprecated/outdated:** Nothing removed. The registry-order behavior survives as the cold-start default (equal weights + populated reachScores reproduce today's dial ordering).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Weight state stored as `memory_event` rows (not a CREATE TABLE side-table, not a JSON file) is the correct reading of D-02 given the locked `findRecentChanges` read requirement | Weight persistence / OQ-1 | If the navigator actually wants a real room.db table or a JSON file, the read path and Req 7 degrade shape change. This is the single decision to confirm before planning |
| A2 | The registry-order "second expert" signal is `1/(rank+1)` (or is-first binary) | Pattern 3 | Wrong signal shape weakens Hedge discrimination but is not architecturally load-bearing; tunable |
| A3 | `MINDRIAN_HEDGE_UPDATE_N` / `MINDRIAN_HEDGE_ETA` are acceptable env-var names | Runtime State Inventory | Cosmetic; planner may rename |
| A4 | Opening room.db inside `dispatchCandidateReaches` via `navigation.openRoomDbForCaller(roomDir)` (as the other sensors tools do) is acceptable for the MCP-path Hedge read | Pitfall 2 | If disallowed, the MCP path runs Hedge-blind (cold `{A:0.5,B:0.5}`), which still satisfies Req 1 (score order from reachScores) but not Req 3's MCP-path differentiation |
| A5 | Two new EVENT_TYPES (`ranker_weight_updated`, `reach_weight_state_unavailable`) is the right count | Pattern 4 | If the navigator wants a single combined event or a different name, trivial edit |

## Open Questions (RESOLVED)

1. **OQ-1 (blocking-ish): weight-state storage shape.** D-02 names "room.db side-table" + "jtbd-state atomic-file model" + "reads via `findRecentChanges`" — mutually incompatible. `findRecentChanges` reads ONLY `memory_event` node rows.
   - What we know: the locked read path is `findRecentChanges`; Phase 158 stores adaptive signal as `memory_event` rows exclusively; there is NO shipped precedent for a bespoke adaptive-state CREATE TABLE in room.db.
   - What's unclear: whether "side-table" was meant literally (a new table + migration) or loosely (a small dedicated record separate from the main graph).
   - Recommendation: store as scalar-only `ranker_weight_updated` memory_event rows (satisfies `findRecentChanges`, Part 8 enum/scalar, Part 9, and the Phase-158 precedent). Surface this in `/gsd-plan-phase` for a one-word confirm; if the navigator insists on a real table, add a `lib/core/migrations/phase-222-*.cjs` and switch the read to a direct chokepoint SELECT (heavier, and would need a `findRecentChanges` exception).
   - **RESOLVED 2026-07-14 at the plan-phase AskUserQuestion gate: the navigator chose the real room.db table, overriding this recommendation.** Follow-up verification (same session, post-choice): `lib/core/migrations/` is a real, populated directory (`phase-109-session-focus.cjs`, `phase-109-nodes-provenance.cjs`, `phase-160-nodes-bitemporal.cjs`, `phase-162-section-nodes.cjs`) -- this research's "no shipped precedent for a bespoke adaptive-state CREATE TABLE" claim was too pessimistic; a directly reusable, sentinel-idempotent migration pattern already exists (`phase-109-session-focus.cjs` read in full: `CREATE TABLE IF NOT EXISTS` inside a transaction, an `identity` table sentinel row gates re-runs, defensive `ALTER TABLE` backfills wrapped in try/catch). Migrations are wired in by direct `require()` + a `runMigration(db)` call inside `lib/core/room-db.cjs:33-34`. Phase 222's `phase-222-ranker-weights.cjs` should follow this exact shape. Part 9 compliance: `navigation.cjs` gains one new typed accessor pair (read-latest-weights / upsert-weights) rather than reading the table directly from the new module -- this keeps the single-chokepoint invariant intact via a NEW typed function, not a bypass. CONTEXT.md D-02 and SPEC.md Requirement 3 both carry the full resolution text; this file's Assumption A1 is superseded by navigator choice, not by new evidence contradicting the original analysis.

2. **OQ-2: reject-penalty composition — subsume or compose?** CONTEXT says the Hedge layer should "compose with OR supersede" the Phase-158 `countPenalty`. Recommendation: COMPOSE (feed 158's discount into the D4 expert score, Code Example above) rather than supersede — 158 is shipped, tested, and its four bias fences (M/W/P/N) are valuable. Confirm the navigator does not want 158 turned off.
   - **RESOLVED: COMPOSE (adopted, Plan 02).** `countPenalty(db, reach_id, roomState)`'s `base * (1 - cp)` composition contract is implemented as written in `rankFiredCandidates` step (d); Phase 158's `countPenalty` stays live and untouched.

3. **OQ-3: which `roomState` does `decide()` hand the ranker?** `decide()` builds `sensorCtx` (`:905-926`) but the `roomState.reachScores` map is produced downstream in `intent-classifier.cjs:1036`, AFTER decide() returns. So at the engine insertion point, `reachScores` may not yet be populated on the engine arm. Recommendation: compute `reachScores` inside `rankFiredCandidates` by calling `buildReachScoresFromCortex(roomState.cortexNodes || [])` itself (the SPEC-1 target already says to call it), so the ranker is self-sufficient and does not depend on caller ordering. Verify `ctx.cortexNodes` availability on the engine arm during planning.
   - **RESOLVED: ranker self-computes via `buildReachScoresFromCortex`.** Confirmed during planning that `ctx.roomContext.cortexNodes` is readable on the engine arm at `navigation-engine.cjs:848-860`; the ranker does not depend on caller ordering either way (Plan 02/03).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js CJS runtime | all logic | Yes | >=22.5.0 (STACK) | — |
| room.db (better-sqlite3 handle via chokepoint) | Hedge read/write, outcome log | Yes (existing) | — | Cold `{A:0.5,B:0.5}` when db absent (MCP/no-room path) |
| `bash` | run-all-222.sh | Yes | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** room.db handle on the MCP path — falls back to equal weights (still satisfies Req 1; not Req 3's MCP differentiation).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain `node:assert/strict` CJS test files + a `bash` aggregator (this repo's house pattern; NO jest/mocha) |
| Config file | none — each `tests/test-*.cjs` is self-running (`node tests/test-...cjs`), aggregated by `tests/run-all-<phase>.sh` |
| Quick run command | `node tests/test-222-<leg>.cjs` |
| Full suite command | `bash tests/run-all-222.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Req 1 | score-order from both MCP tools; flat-floor + Hedge tiebreak with no cortex | integration | `node tests/test-222-rank-fired.cjs` | ❌ Wave 0 |
| Req 2 | `resolveFireSkill` fires the scored winner; Wicked + dead-Brain arms intact | integration | `node tests/test-222-reach-wired.cjs` | ❌ Wave 0 |
| Req 3 | synthetic outcome sequence -> consistently-right expert's weight strictly greater after N | unit | `node tests/test-222-hedge-update.cjs` | ❌ Wave 0 |
| Req 4 | new module requires only `node:*` + repo `lib/`/`data/` | tripwire | `node tests/test-222-zero-deps.cjs` + `bash` grep leg | ❌ Wave 0 |
| Req 5 | four frozen scalars byte-identical | unit | `node tests/test-222-frozen-scalars.cjs` | ❌ Wave 0 |
| Req 6 | reachability via REAL decide() + REAL MCP register | integration | `node tests/test-222-reach-wired.cjs` | ❌ Wave 0 |
| Req 7 | corrupt state -> D4-alone + `reach_weight_state_unavailable`; healthy -> no event | integration | `node tests/test-222-degrade.cjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single leg touched, e.g. `node tests/test-222-hedge-update.cjs`
- **Per wave merge:** `bash tests/run-all-222.sh`
- **Phase gate:** `bash tests/run-all-222.sh` exits PASS with 0 FAIL, 0 SKIP before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-222.sh` — aggregator (mirror `run-all-209.sh` run/run_if helpers + a `run-all-158.sh`-style frozen-passthrough leg for Req 5 and a grep-sweep leg for Req 4)
- [ ] `tests/test-222-rank-fired.cjs` — Req 1
- [ ] `tests/test-222-reach-wired.cjs` — Req 2 + Req 6 (drive real `decide()` and real `sensors.register`)
- [ ] `tests/test-222-hedge-update.cjs` — Req 3
- [ ] `tests/test-222-frozen-scalars.cjs` — Req 5
- [ ] `tests/test-222-degrade.cjs` — Req 7
- [ ] `tests/test-222-zero-deps.cjs` — Req 4
- [ ] Framework install: none needed (plain node + bash already present)
- [ ] Fixtures: a temp-room seam (mirror `test-213-reach-wired.cjs::makeRoom` and `test-198`'s `makeFakeServer`) with a room.db carrying >=2 firing sensors and known `f_selector_decision` outcome rows

## Security Domain

> `security_enforcement` key absent in `.planning/config.json` -> treated as enabled. This phase is room-local, zero-egress, no auth/session surface; the applicable controls are narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched |
| V3 Session Management | no | No session tokens; `sessionId` only scopes the room read, unchanged |
| V4 Access Control | no | No new access boundary |
| V5 Input Validation | yes | MCP tool params already zod-validated (`sensors.cjs:137-141` `user_text` max 4000, `section` regex `^[a-z0-9-]+$`). The new module reads enums/scalars only; `readHedgeWeights` validates `weight_a`/`weight_b` are finite non-negative numbers before use |
| V6 Cryptography | no | No crypto beyond the existing `crypto.randomBytes` id-mint inside `logEvent` (unchanged) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Poisoned weight-state row (out-of-range/NaN scalar) skews ranking | Tampering | Validate scalars on read; corrupt -> equal weights + `reach_weight_state_unavailable` (Req 7) |
| Reason/prose leaking into a `memory_event` payload | Information disclosure (Part 8 breach) | Enum/scalar-only payloads; the `run-all-158.sh`-style `.reason`-read grep sweep, extended to the new module |
| Cross-room weight aggregation | Information disclosure (Part 8 breach) | Reads only the passed room's db; weights never aggregated across rooms (Constraint: room-local only) |
| Direct room.db access bypassing the chokepoint | Tampering / Part 9 breach | All reads via `navigation.findRecentChanges`, all writes via `navigation.logMemoryEvent`; a Part-9 chokepoint grep sweep (mirror `run-all-158.sh` leg c) over the new module |

## Project Constraints (from CLAUDE.md)

- **Connector Spine (Architecture):** one governed reach path `dispatchSensors -> decide() -> resolver`; NO second selection brain. The new ranker re-orders the ONE dispatch output.
- **`navigation.cjs` is the single SQL chokepoint:** typed edges and `memory_event` nodes written ONLY through it (Part 9). No direct sqlite/better-sqlite3/fs read of room data in the new module.
- **Part 8 Graph Boundary:** LOCAL data never egresses; weight state room-local, enum/scalar only, never in a Brain packet.
- **Part 3 frozen Shape-F scalars:** MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 are read-only inputs, never modified (Req 5).
- **Part 7 Reuse Before Build:** reuse `f-selector-ranker`, `cortex-reach-adapter`, `reach-reject-reader`, `navigation` chokepoint; justify the one net-new module (justified: turn-subset ranking cannot live in the fixed-6-reach dial).
- **Part 11 Invocation Constitution:** the two MCP tools already carry `hitl_shape: 'none'` (`sensors.cjs:313-325`); re-ordering their output does not change their fork status (still pure reads) — no new HITL declaration needed. Confirm `build-connector-registry.cjs --check` stays green.
- **CJS only, no TypeScript, no Python.** No em-dashes anywhere (hyphens only). Feynman-simplified, JTBD-oriented prose.
- **Tri-Polar Design Rule:** the change is backend selection logic; verify it behaves on CLI (engine arm), Desktop, and Cowork (MCP arm) — the reachability legs cover both the engine and MCP paths, satisfying the three-surface check for this backend change.
- **Dev-Research Compositing:** this phase touches MindrianOS's own architecture -> file the durable reasoning trail in `rethinking-mindrianos/research/` and mirror to `mindrianOS/research/`, cross-linked to this phase (per CLAUDE.md "Dev-Research Compositing").
- **GSD Workflow Enforcement:** implement via `/gsd-execute-phase`; no direct edits outside the workflow.

## Line-Number Verification (current tree, commit `9a52d5e8`)

> The navigator asked to confirm CONTEXT.md/SPEC.md citations (verified against `fb995e83`) still hold on the CURRENT tree. **Result: line numbers are STABLE — no meaningful drift.** One clarification noted.

| Symbol | CONTEXT/SPEC citation (`fb995e83`) | Current (`9a52d5e8`) | Status |
|--------|-----------------------------------|----------------------|--------|
| `resolveFireSkill` (function def) | `navigation-engine.cjs:588-612` | def at `:588`; the sensor-branch `sensorReaches[0]` read at `:605`; **the full function body runs :588-652** (the `:588-612` citation points at the sensor-branch region, not the whole function) | MATCH (clarified) |
| `resolveFireSkill` call sites in `decide()` | (not cited) | `:1035` (tier_0 path), `:1234` (main path); dispatch of sensors at `:923`; `sensorReaches[0]` also read at trace `:357`, `:962-963`, rationale `:1222` | ADDED (all `[0]` reads the reorder covers) |
| `dispatchCandidateReaches` | `sensors.cjs:97-105` | `:97-105` | EXACT MATCH |
| `buildSensorInputs` (the cortex-node gap) | `sensors.cjs:81-90` | `:81-90` | EXACT MATCH |
| `suggest_next` registration | `sensors.cjs:132-155` | `:133-154` (server.tool call) | MATCH (off-by-1 from comment line) |
| `reach_candidates` registration | `sensors.cjs:157-172` | `:157-172` | EXACT MATCH |
| `buildReachScoresFromCortex` empty-degrade | `cortex-reach-adapter.cjs:194-198` | `:194-198` | EXACT MATCH |
| CLI call `buildReachScoresFromCortex(cortexNodes)` | `intent-classifier.cjs:1036` | `:1036` (guarded by `ctx.cortexNodes` at `:1035`) | EXACT MATCH |
| D4 formula / MAX_K | `f-selector-ranker.cjs:47-52,87` | `:47-52` (formula), `:87` (MAX_K) | EXACT MATCH |
| `dispatchSensors` / SENSOR_REGISTRY | `insight-sensors.cjs:611-699` | not re-verified line-for-line (out of scope; untouched) | ASSUMED unchanged |

## Sources

### Primary (HIGH confidence — read in full this session, current tree)
- `lib/hmi/cortex-reach-adapter.cjs` — `buildReachScoresFromCortex` signature + empty-degrade + Part-8 enum-only reads
- `lib/workflow/f-selector-ranker.cjs` — D4 formula, `rankForSelector` (ranks commands), MAX_K
- `lib/hmi/dial-reach-orchestrator.cjs` — `buildReachList`, `_resolveReachScore`, `_d4SignalFloor`, frozen consts
- `lib/mcp/tools/sensors.cjs` — the two MCP tools, `dispatchCandidateReaches`, `buildSensorInputs`, connectors/HITL
- `lib/core/navigation-engine.cjs` — `resolveFireSkill`, `reachIdToSkillFamily`, `decide()` dispatch + call sites
- `lib/core/navigation/memory-events.cjs` — `logEvent`, `findRecentChanges`, `EVENT_TYPES` + additive idiom
- `lib/workflow/reach-reject-reader.cjs` — Phase 158 outcome read pattern, injection seam, named fence constants
- `lib/workflow/offer-closer.cjs` — Phase 159 `closeOffer` write path (reward signal source)
- `tests/run-all-158.sh`, `tests/run-all-209.sh` — harness shapes (D-04)
- `tests/test-213-reach-wired.cjs` — born-wired reachability proof pattern
- `tests/test-158-reach-orchestrator-pure.cjs` — Part-9 purity tripwire pattern
- `tests/test-148-frozen-contracts.cjs` — frozen-scalar assertion pattern
- `tests/test-198-contract-schema.test.cjs` — `makeFakeServer()` MCP-registration test seam
- `.planning/seeds/SEED-009-*.md` — `ranker_weights` proposal, N=50 precedent
- `.planning/phases/222-*/222-SPEC.md`, `222-CONTEXT.md` — locked requirements + decisions

### Secondary (MEDIUM)
- Arora, Hazan, Kale (2012) "The Multiplicative Weights Update Method: a Meta-Algorithm and Applications" — Hedge/MWU pseudocode (cited by SPEC as the porting reference)

### Tertiary (LOW)
- None. No web search was performed; the MCP-stack-awareness house rule (ask before web research) plus the zero-dependency verdict already locked this session made external search unnecessary.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read in the current tree; zero-dependency verdict pre-locked this session
- Architecture (the reorder wiring): HIGH — call graph traced end to end; the two insertion points are verified against current line numbers
- Weight persistence shape: MEDIUM — D-02 is internally contradictory; the memory_event recommendation is the only shape consistent with the locked `findRecentChanges` read, but needs a one-word navigator confirm (OQ-1)
- Pitfalls: HIGH — grounded in shipped code (150.5 dead-sensor doctrine, 158 purity tripwire, command-vs-reach ranking distinction)
- Line numbers: HIGH — re-verified against commit `9a52d5e8`; stable vs the SPEC's `fb995e83`

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 days — stable in-tree domain; the only volatility is line-number drift from unrelated edits, which the reorder-by-symbol approach is resilient to)
