# Phase 183: METER - Gate-Exposure + Transfer Meter - Research

**Researched:** 2026-06-27
**Domain:** LOCAL telemetry derivation over the Part 9 `memory_event` chokepoint (no new store, no Brain wire)
**Confidence:** HIGH (substrate located and read at file:line; all primitives already shipped)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- LOCAL-only (Part 8), emitted as `memory_event` via `lib/core/navigation.cjs`. No Brain wire. No new edge/node/reach/frozen-set member.
- Reuse the Part 9 `navigation.cjs` `memory_event` chokepoint; net-new is the gate-reach + density + transfer **derivation**, NOT a new store.
- Per session record: (1) gate-reach (did the navigator reach a `decide()` gate this session + how many times); (2) invocation density (Gauge 1); (3) transfer (Gauge 2 source: insight-to-validated-decision latency, independence trend, reject-reason-capture rate).
- The two gauges are reported TOGETHER per the v1.19 welded contract - invocation density NEVER without the transfer denominator beside it. volume-up-quality-flat AND quality-up-by-starving-volume both flagged as regressions.
- This is the R2-precursor: a working meter must exist before Phase 184 READER is allowed to ground the gate (READER is CONDITIONAL on METER showing a gate subject).
- GATE: if METER shows nobody reaches the gate, READER never opens.
- Frozen and NOT to be touched: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the 3 postures, the F.1 keyboard contract, the `appendAskUserQuestionTrailer` coupling.

### Claude's Discretion
- Exact derivation math for the LOCAL transfer proxies (latency / independence-trend / reject-capture-rate), within Part 8 enum/scalar-only.
- Whether gate-reach is a DERIVED read over existing `reach_presented` rows or a single new additive `memory_event` type emitted at the existing engine-arm seam (see Gate-Reach Observation Point decision below).
- The shape of the welded read/emit function and its test fences.

### Deferred Ideas (OUT OF SCOPE)
- A real RCT / transfer measurement. METER is the Gauge-2 SOURCE/instrument, not the experiment.
- Any new node/edge/reach type. Any Brain write or live Brain read. A new persistent store (JSONL or otherwise) competing with `room.db`.
- The Appendix D entry 32 amendment (self-bound: it waits on METER's reading).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| METER-01 | Gate-exposure + invocation-density telemetry (Gauge 1) via `memory_event`. | Gate-reach reuses the `reach_presented` emission seam already live at `scripts/intent-classifier.cjs:1503-1554`; invocation density reuses the `framework_invoked` counter already read by `selector-decisions.cjs::_invocationsSinceDecision` (`:309`) and `projections.cjs::computeInvestmentLevel` (`:254`). Read path = `navigation.findRecentChanges` (`navigation.cjs:83`). |
| METER-02 | Transfer meter (Gauge 2 source) - latency / independence-trend / reject-reason-capture; doubles as READER R1's A/B instrument. | Reject-reason-capture reuses the `f_selector_decision` row written by `selector-decisions.cjs::recordSelectorDecision` (`:244`) - which already carries `reason: string|null` (`:130`, `:248`). Reject/presentation timelines already read reach-keyed by `lib/workflow/reach-reject-reader.cjs`. Latency + independence are computable from `memory_event` timestamps via `findRecentChanges`. |
</phase_requirements>

## Summary

Phase 183 is a **pure derivation phase**: every primitive it needs is already shipped and reachable through the single Part 9 chokepoint, `lib/core/navigation.cjs`. The `memory_event` write/read door is `logEvent(db, eventType, payload, opts)` (re-exported as `navigation.logMemoryEvent`, `navigation.cjs:102`) and `findRecentChanges(db, sinceEpochMs, {eventType, limit})` (re-exported as `navigation.findRecentChanges`, `navigation.cjs:83`). The frozen `EVENT_TYPES` Set (`lib/core/navigation/memory-events.cjs:10`) already holds **86 members** - including the three the meter is built on: `reach_presented`, `framework_invoked`, and `f_selector_decision`. Event types have always grown ADDITIVELY (the comment at `memory-events.cjs:82` records the Phase 124 precedent: size 35 -> 37); the meter needs AT MOST one additive member (`gate_reached`, 86 -> 87) and arguably zero.

The single most important finding: **the gate-reach signal already fires.** `scripts/intent-classifier.cjs:1547` emits a `reach_presented` `memory_event` per offered top-3 reach on the live engine arm, exactly when the Shape F dial renders, while `roomDb` is open. METER-01 either DERIVES gate-reach by counting the turns that carry `reach_presented` rows, or adds ONE per-turn `gate_reached` marker at that same seam. The transfer substrate is equally present: `f_selector_decision` rows carry `decision` (`defer`|`reject`), `reason` (string|null), `reach_id`, `investment_level_at_decision`, and timestamps; `lib/workflow/reach-reject-reader.cjs` already reads reject/presentation timelines reach-keyed via the chokepoint, enums-only, Part 8 clean.

**Primary recommendation:** Build `lib/core/meter/` (a new pure-reader module reachable through `navigation.cjs`) that (a) DERIVES the two gauges from existing `memory_event` rows via `findRecentChanges`, and (b) emits a single welded pair through ONE function that REFUSES to return or write a density number without the transfer reading beside it. Add at most ONE additive `EVENT_TYPES` member (`gate_reached`) using the verbatim Phase 124/150 additive idiom. Do NOT build a new store; do NOT touch the frozen render contract; carry the Part 8 grep-sweep fence.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate-reach detection (did the dial/Shape F render this turn) | Engine arm (`scripts/intent-classifier.cjs` resolve path) | - | The gate FIRES where the engine resolves the turn and renders the dial; `roomDb` is open there. The pure render seam is db-free and cannot write. |
| `memory_event` write (gate-reach + density markers) | Part 9 chokepoint (`navigation.cjs` -> `memory-events.logEvent`) | room.db (SQLite, DATA plane) | Single door per Part 9; substrate guard forbids direct room.db opens outside the allow-list. |
| Gauge derivation + welded read (the meter math) | NEW `lib/core/meter/*.cjs` pure reader | `navigation.findRecentChanges` | A pure reader over the event log; owns no INSERT, opens no db (caller-owned handle), makes no Brain call. |
| Transfer proxies (reject-capture / latency / independence) | NEW meter reader | existing `reach-reject-reader.cjs` + `selector-decisions.cjs` rows | Reuse the shipped reach-keyed readers; the meter aggregates, it does not re-instrument. |
| Two-gauge presentation (welded contract) | NEW meter emit/read function | - | Welds Gauge 1 to Gauge 2 structurally - density un-returnable without the transfer denominator. |
| Surface parity (CLI / Desktop / Cowork) | Engine arm + meter reader | - | The gate fires on every surface that runs `decide()`; the meter must read room.db, not a CLI-only sink. |

## Standard Stack

This is a CODE phase that adds **zero external dependencies**. The "stack" is the existing in-repo CJS substrate.

### Core (existing modules - REUSE, do not rebuild)
| Module | file:line | Purpose | Why it is the standard |
|--------|-----------|---------|------------------------|
| `navigation.cjs` chokepoint | `lib/core/navigation.cjs` | The single Part 9 door for graph reads/writes. | Canon Part 9; substrate guard rejects any other room.db access. |
| `logEvent` / `navigation.logMemoryEvent` | `memory-events.cjs:544` / re-export `navigation.cjs:102` | Write a `memory_event` node (validates against `EVENT_TYPES`, supports `dedupe_key` 60s idempotency). | The ONLY sanctioned `memory_event` writer. |
| `findRecentChanges` / `navigation.findRecentChanges` | `memory-events.cjs:597` / re-export `navigation.cjs:83` | Read `memory_event` rows since an epoch ms, optionally filtered by `eventType`, returns parsed `properties`. | The "readable via navigation.cjs" acceptance is satisfied by THIS function. |
| `EVENT_TYPES` frozen Set | `memory-events.cjs:10` (86 members) | The closed allow-list `logEvent` validates against. | Additive growth only (Phase 124 precedent 35->37 at `:82`). |
| `openRoomDbForCaller` / `closeRoomDbForCaller` | `navigation.cjs:306-307` | Caller-owned room.db handle for non-allow-listed hot-path callers. | How `intent-classifier.cjs` already obtains its handle. |
| `reach-reject-reader.cjs` | `lib/workflow/reach-reject-reader.cjs` (whole) | `presentationsCount`, `rejectCountInWindow`, `computeReachPenalties` - reach-keyed reject/presentation readers, enums-only, chokepoint-only. | METER-02's reject substrate is already written here (Phase 158). |
| `recordSelectorDecision` | `selector-decisions.cjs:123`, writes at `:244` | Writes the `f_selector_decision` row carrying `decision`/`reason`/`reach_id`/`investment_level_at_decision`. | The reject-reason source row for the transfer meter. |
| `_invocationsSinceDecision` | `selector-decisions.cjs:309` | Counts `framework_invoked` rows since the last decision. | The invocation-density counter precedent. |
| `computeInvestmentLevel` | `projections.cjs:254` | Projects `framework_invocations` count -> level. | The shipped density-projection idiom Gauge 1 mirrors. |

### Supporting (the gate-reach emission seam)
| Surface | file:line | Role |
|---------|-----------|------|
| `reach_presented` emission | `scripts/intent-classifier.cjs:1503-1554` | Fires one `reach_presented` per offered reach on the live engine arm while `roomDb` is open. THE gate-reach observation point. |
| `computeReachPenalties` fold | `scripts/intent-classifier.cjs:1559-1574` | The adjacent live-arm fold; shows the exact place additional LOCAL reads run with the open handle. |
| `decide()` | `lib/core/navigation-engine.cjs:768` | The decision producer; flips `routing_source` legacy->engine on a fired reach (~`:1071`). |
| `appendAskUserQuestionTrailer` | `lib/hmi/selector-dispatcher.cjs:528` | The frozen render-trailer coupling - DO NOT modify. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deriving over `memory_event` | A new `~/.mindrian/telemetry/*.jsonl` sink (the Plan 88.1-16 query-efficiency pattern) | REJECTED by CONTEXT ("not a new store"). The JSONL pattern is Part-8-legal but CONTEXT locks the meter to `memory_event` via `navigation.cjs`. Cite it only as precedent for the LOCAL-only fence, not as the home. |
| One additive `gate_reached` event | Zero new events (derive gate-reach by counting turns with `reach_presented` rows) | Derive-only keeps `EVENT_TYPES` at 86 but cannot cleanly count gate-reaches per turn (3 `reach_presented` rows per gate). One additive marker gives a clean per-turn count and a per-turn `routing_source`. Recommend the additive marker (see decision below). |

**Installation:** None. No `npm install`. Zero new runtime dependencies (confirms STACK.md "filesystem IS the architecture; no SQLite/Redis additions").

## Package Legitimacy Audit

**N/A - this phase installs no external packages.** It reuses in-repo CJS modules only. No registry surface, no `postinstall`, no slopcheck target. (Recorded explicitly so the planner does not insert a package-verification checkpoint.)

## Reuse Map (capability needed -> existing function/file:line -> additive change required)

| Capability needed | Existing function / file:line | Additive change required |
|-------------------|-------------------------------|--------------------------|
| Write a `memory_event` | `navigation.logMemoryEvent` -> `memory-events.logEvent` (`memory-events.cjs:544`) | NONE. Call it. |
| Read `memory_event` back (the "readable via navigation.cjs" acceptance) | `navigation.findRecentChanges` -> `memory-events.findRecentChanges` (`memory-events.cjs:597`) | NONE. Filter by `eventType`. |
| Gate-reach signal (per turn) | `reach_presented` already emitted at `intent-classifier.cjs:1547` | Option A (recommended): add `gate_reached` to `EVENT_TYPES` (86->87) + emit ONCE per gate render at the SAME seam (`intent-classifier.cjs:~1521`, guarded by `offered.length>0`). Option B: derive from `reach_presented` rows, zero new event. |
| Invocation density (Gauge 1 numerator) | `framework_invoked` count via `_invocationsSinceDecision` (`selector-decisions.cjs:309`) + `computeInvestmentLevel` (`projections.cjs:254`) | NONE for the read. Verify emission sites actually fire `framework_invoked` (see Landmine L-3). |
| Reach-presentation count (density denominator candidate) | `reach-reject-reader.cjs::presentationsCount` (`:142`) | NONE. Reuse. |
| Reject-reason capture (transfer) | `f_selector_decision` row with `reason` field, `recordSelectorDecision` (`selector-decisions.cjs:244`); reject reader `rejectCountInWindow` (`reach-reject-reader.cjs:185`) | NONE for capture. NEW: a capture-RATE reader = `COUNT(reject AND reason!=null) / COUNT(reject)` over `findRecentChanges('f_selector_decision')`. |
| Insight-to-validated-decision latency (transfer) | Timestamps on `memory_event` rows (`createdAt`); `decision_captured` reserved at `memory-events.cjs:256` but UNEMITTED; `status_promoted`/`confirmNode` marks validated decisions | NEW: a latency reader pairing an insight event (e.g. `reach_presented` / `auto_explore_finding_surfaced`) `createdAt` to the next validated-decision `createdAt`. Reuse `findRecentChanges`. |
| Independence trend (transfer) | `framework_invoked` / `reach_presented` density per cycle from `findRecentChanges` | NEW: a per-cycle delta reader (did the next cycle need more or less Larry). Pure derivation. |
| Welded two-gauge emit/read | NONE (net-new) | NEW: ONE function in `lib/core/meter/` that returns `{gauge1, gauge2}` together or errors; refuses a lone density. |
| Caller-owned db handle on the live arm | `openRoomDbForCaller`/`closeRoomDbForCaller` (`navigation.cjs:306-307`); `intent-classifier.cjs` already holds `roomDb` | NONE. Emit at the existing open-handle seam; never open a second handle. |

**Net-new surface for the planner: one `lib/core/meter/*.cjs` pure reader + at most one `EVENT_TYPES` member + one additive emit line at the existing seam + the welded function + tests. Everything else is a call into shipped code.**

## Gate-Reach Observation Point (the recommended single hook)

**Decision: emit ONE additive `gate_reached` `memory_event` per gate render at the existing engine-arm seam, `scripts/intent-classifier.cjs` ~line 1521, immediately beside the `reach_presented` loop.**

Rationale, traced against the candidates the additional-context named:
- `lib/core/navigation-engine.cjs::decide()` (`:768`) is PURE/db-light and returns a decision object; it is not where the db handle is open, and writing there risks coupling the producer to telemetry. REJECT as the write site.
- `lib/hmi/dial-presenter.cjs` and the `renderF1` path (`shape-f1-renderer.cjs` / `intent-classifier.cjs` render seam ~1835/1890) are PURE render - by the time they run `roomDb` is already closed (`intent-classifier.cjs:1506` notes the dial render path is db-free). REJECT as the write site.
- `lib/hmi/selector-dispatcher.cjs::appendAskUserQuestionTrailer` (`:528`) is the FROZEN trailer contract - touching it risks the render contract. REJECT.
- **`scripts/intent-classifier.cjs:1521-1555`** is the unique point where (a) the engine arm has decided to render a gate, (b) `offered` (the top-3 reaches) is computed the SAME way the render seam computes it, and (c) `roomDb` is OPEN. The `reach_presented` loop ALREADY writes here. A single `gate_reached` emit guarded by `offered.length > 0`, BEFORE/AFTER the per-reach loop, is the cleanest "a navigator reached a `decide()` gate this turn" marker. **This is the recommended hook.**

Recommended payload (enum/scalar only, Part 8): `{ reach_count: offered.length, routing_source: 'engine', source_path: 'gate:reached', created_by: 'system' }`. Use the `logEvent` `dedupe_key` (`memory-events.cjs:561`) keyed on the turn id so a re-entrant arm cannot double-count one gate.

Why this satisfies the acceptance "answers 'does a navigator reach the gate' with a REAL number, not an inference from Brain request count": `gate_reached` is written precisely when the LOCAL engine renders the gate, surface-agnostic, with zero dependence on any Brain API call. The count is `COUNT(memory_event WHERE event_type='gate_reached')` per session via `findRecentChanges`.

**Reuse-purity note (for the planner's Part 7 justification):** this mints NO new reach, NO new node type, NO new edge - it adds exactly ONE `EVENT_TYPES` string using the verbatim additive idiom at `memory-events.cjs:84/103/116` (Phase 124/150 precedent). If the planner prefers strict zero-amendment, Option B (derive gate-reach from existing `reach_presented` rows, counting distinct turns) is viable but yields a coarser per-turn count; recommend Option A.

## Transfer Proxies: real vs named-debt (honesty table)

The canon (Part 5, Appendix D entry 28/31) FORBIDS engagement proxies masquerading as transfer. A true transfer measurement is a novel-problem-solving delta vs a DEFINED baseline - which METER cannot produce (no RCT). METER is the Gauge-2 SOURCE. Be honest in the artifact about which is which.

| Proxy (CONTEXT names it) | What it actually measures | Real transfer or named-debt? | Computable LOCALLY? | Source |
|--------------------------|---------------------------|------------------------------|---------------------|--------|
| Reject-reason-capture rate | Whether rejections carry a captured reason (Decision 13 "rejection is data", Part 4 `REJECTED_BECAUSE`). | **Named-debt proxy.** A data-quality signal on the transfer instrument, NOT a transfer delta. High capture = the instrument can later support a real measurement; it is not itself quality. | YES - `COUNT(f_selector_decision reject AND reason!=null)/COUNT(reject)` via `findRecentChanges`. `reason` field at `selector-decisions.cjs:130,248`. | METER-02 |
| Insight-to-validated-decision latency | Wall-clock ms between an insight `memory_event` and the next human-validated decision (`confirmNode`/`status_promoted`). | **Named-debt proxy** (a process-efficiency signal aligned with the JTBD core job "compress time between insight and validated decision", CLAUDE.md). NOT a novel-problem delta. Honest framing: a SPEED proxy, not a TRANSFER proxy. | YES - pair `createdAt` of insight event to next `status_promoted` `createdAt`. Timestamps on every `memory_event`. | METER-02 |
| Independence trend (more/less Larry next cycle) | Whether invocation density per cycle is rising or falling. | **Ambiguous - flag explicitly.** Falling density could mean the navigator internalized the method (transfer-like) OR disengaged (anti-signal). Un-disambiguable LOCALLY. Report as a trend scalar with an explicit "direction is not self-interpreting" caveat. | YES - per-cycle `framework_invoked`/`reach_presented` deltas. | METER-02 |
| Invocation density (Gauge 1) | Reaches/commands/capability invocations per sitting. | **NOT a transfer proxy at all - it is the VOLUME gauge.** Reportable ONLY welded to Gauge 2 (Part 5 v1.19). On its own it is the Hooked Dealer trap. | YES - `framework_invoked` + `reach_presented` + `gate_reached` counts. | METER-01 |

**The honest line the artifact must carry:** none of the three METER-02 proxies is a real transfer measurement. They are the **instrument** that a future READER (Phase 184) and a future real measurement consume. The canon's self-binding clause (entry 31) is satisfied by METER returning a real two-gauge READING from a live navigator on the gate - reading the meter, not proving transfer. State this in `## Common Pitfalls` and in the artifact so no downstream phase mistakes the proxy for the delta.

## The Welded Two-Gauge Emission Contract

The acceptance requires the pair be emitted/queried TOGETHER, never a lone density number, enforced at the TELEMETRY layer. Concrete enforcement pattern (recommended):

1. **One read function, structurally welded.** `readTwoGauge(db, sinceEpochMs) -> { gauge1_density, gauge2_transfer }` where `gauge1_density` and `gauge2_transfer` are computed in the same call and returned in one frozen object. There is NO exported `readDensity()` that returns a bare number. A caller cannot obtain density without the transfer reading in the same object. This mirrors the canon's "un-reportable without the transfer denominator beside it - welded, not a clause" (Part 5).
2. **Refuse the lone-density write.** If the meter ever emits a `memory_event` summary, the emit function asserts BOTH gauges are present in the payload and returns `{ok:false, reason:'unwelded_density'}` otherwise. The density key and the transfer key are written in the same payload or not at all.
3. **Two-directional regression guard (D-180-02).** The read returns BOTH a `volume_direction` and a `quality_direction` scalar; a consumer/test asserts that `volume-up + quality-flat` AND `quality-up + volume-down` are BOTH labeled `regression`, never `win`. Win == `volume up AND quality holds-or-climbs`.

**Test idiom to mirror (HIGH confidence, verified):** the canon-side floor test `tests/test-canon-entry-31-two-gauge-floor.cjs` and its aggregator `tests/run-all-180.sh` are the exact pattern for a `tests/run-all-183.sh` + a `tests/test-meter-two-gauge-floor.cjs`. The floor-test discipline (read the artifact, assert membership + the welded pair in BOTH places + the regression guard, NEVER assert a raw `.size`/count so a future addition cannot false-fail) is the house idiom - see also `tests/test-edges-room-lineage-floor.cjs` for the node-test structure. The aggregator carries the frozen-set drift fences (`test-reach-ids-drift.cjs`, `test-posture-ids-drift.cjs`) GREEN to prove METER mints no reach/posture.

## Part 8 LOCAL-only Enforcement (precedent + carried fence)

| Item | Evidence | How METER carries it |
|------|----------|----------------------|
| The grep-sweep fence | `tests/test-95.5-00-scaffold.sh:52` runs `grep -cE 'brain-client\|fetch\|http\|curl\|brain.mindrian\|tavily'` over the new file and asserts 0; `tests/test-resolve-brain-key.cjs:188` and the Phase 88.6/122 sweeps use the same idiom. | `run-all-183.sh` greps the new `lib/core/meter/*.cjs` + the emit seam for `fetch\|http\|curl\|brain.mindrian\|tavily\|brain-client` and asserts 0 matches. |
| enum/scalar-only payloads | `reach_presented` payload is `{reach_id, source_path, created_by}` (`intent-classifier.cjs:1547`); `f_selector_decision` stores `venture_classified` boolean + `classification_source` enum, NEVER the user sentence (`selector-decisions.cjs:199-211`). | `gate_reached` + any meter summary carry counts + enums only; no prose, no artifact bodies, no reasons echoed into a cross-room-readable field. (Note: `reason` already lives on `f_selector_decision` LOCALLY; the meter reads its PRESENCE/absence for capture-rate, never egresses the string.) |
| Existing LOCAL telemetry precedent | `~/.mindrian/telemetry/query-efficiency.jsonl` (Plan 88.1-16, scalar+slug only, zero network) - cited by CANON-PHASE-MAP Part 8. | Precedent ONLY for the LOCAL-fence discipline; the meter's HOME is `memory_event` in `room.db`, per CONTEXT, NOT a new JSONL. |
| The `memory_event` row is system-bookkeeping | Part 9 v1.5 audit-node carve-out: `memory_event`/`audit`/`focus` are exempt from human-confirm (`created_by=system review_status=confirmed` is canon-legal, `logEvent` writes `'confirmed'` at `memory-events.cjs:589`). | `gate_reached` is a system-bookkeeping node; it records what the system DID (rendered a gate), asserts no venture truth - canon-legal without a human byUser. |

## Tri-Polar Surface Note (CLI / Desktop / Cowork)

The gate fires wherever `decide()` runs and the engine arm renders the dial. Per CLAUDE.md three-surface rule:

- **CLI:** `scripts/intent-classifier.cjs` runs in-process; `roomDb` is opened via the chokepoint; the `reach_presented`/`gate_reached` emit fires natively. Verified path.
- **Desktop / Cowork:** these speak MCP, but the SAME `lib/core/*` engine code backs the MCP tools (STACK.md "Both entry points import the SAME `lib/core/*` modules"). The gate-reach emit must live in the SHARED engine-arm path so it fires regardless of surface. **Landmine:** if the emit is placed in a CLI-only branch of `intent-classifier.cjs` that the MCP wrapper does not traverse, Desktop/Cowork gate-reaches go uncounted and the meter under-reports. The planner must verify the emit seam is on the surface-shared resolve path, not a CLI-only fork.
- **Read parity:** `findRecentChanges` reads `room.db`, which all three surfaces share for a given room, so the meter READ is surface-uniform by construction.

## Architecture Patterns

### Recommended module layout
```
lib/core/
  meter/
    gate-density-reader.cjs    # Gauge 1: gate_reached + framework_invoked + reach_presented counts
    transfer-reader.cjs        # Gauge 2 source: reject-capture-rate, latency, independence-trend
    two-gauge.cjs              # the WELDED read (returns {gauge1, gauge2} together or errors)
```
Surface all three through `navigation.cjs` as thin additive re-exports (the established idiom: `logMemoryEvent`/`writeEdge`/`getRoomContext` at `navigation.cjs:102/130/383`), so callers reach the meter through the one door. The readers take a caller-owned `db` handle (the `writeEdge`/`getRoomContext` contract), open nothing, and make no Brain call.

### Pattern: pure reader over the event log (mirror `reach-reject-reader.cjs`)
```javascript
// Source: lib/workflow/reach-reject-reader.cjs:142-164 (verified, in-repo)
const navigation = require('../navigation.cjs');
function presentationsCount(db, reach_id, roomState) {
  // ... roomState injection seam for db-free tests ...
  const rows = navigation.findRecentChanges(db, 0, { eventType: 'reach_presented', limit: 200 });
  let count = 0;
  for (const row of rows) {
    if (row && row.properties && row.properties.reach_id === reach_id) count += 1;
  }
  return count;
}
```
The meter readers follow this exactly: prefer a `roomState` injection seam so floor tests run db-free; read ONLY via `findRecentChanges`; return 0 on a null db / read fault; never throw out of the read.

### Pattern: additive EVENT_TYPES member (mirror Phase 124/150)
```javascript
// Source: lib/core/navigation/memory-events.cjs:84,103,116 (verified additive idiom)
// ... existing members ...
'gate_reached',   // Phase 183 METER-01: one per engine-arm gate render; enum/scalar payload only.
```
A FLOOR test asserts membership + the full prior floor preserved, never `.size` (the `memory-events.cjs:52-53` size-invariant note).

### Anti-Patterns to Avoid
- **A second selection/telemetry brain.** CIRS R4 (Part 11): one governed path. The meter READS the existing spine; it does not add a parallel decision surface.
- **Touching the frozen render contract.** MAX_K=3 / DIAL_REACH_K=6 / 0.70/0.15 / the 6-reach bank / `appendAskUserQuestionTrailer` are FROZEN. The meter observes; it never changes what is offered.
- **A new persistent store.** No JSONL, no SQLite table outside `room.db`, no Redis. CONTEXT locks the home to `memory_event`.
- **Egressing the reject `reason` string.** Read its presence for capture-rate; never write it into a cross-room-aggregated or Brain-bound field.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Writing/reading telemetry rows | A new JSONL appender + parser | `navigation.logMemoryEvent` + `navigation.findRecentChanges` | The chokepoint handles validation, dedupe (`dedupe_key`), parsing, and the substrate guard. A new sink would breach CONTEXT + Part 9. |
| Reach-keyed reject counting | A fresh reject scanner | `reach-reject-reader.cjs::rejectCountInWindow` / `presentationsCount` | Already written, enums-only, Part 8 clean, windowed. |
| Invocation density counting | A new command-invocation counter | `framework_invoked` + `_invocationsSinceDecision` (`selector-decisions.cjs:309`) + `computeInvestmentLevel` | The density numerator already exists and is drift-tested. |
| Reason capture | A new reason store | The `reason` field on `f_selector_decision` (`selector-decisions.cjs:130,248`) | Capture already happens; the meter only computes the RATE. |
| Gate-reach detection | A new render hook | The live `reach_presented` seam (`intent-classifier.cjs:1521-1554`) | The dial-render-with-open-db seam already exists; add one marker beside it. |

**Key insight:** METER is ~95% reads of shipped code. The only genuinely net-new bytes are the three pure readers, the welded function, one `EVENT_TYPES` string, and one emit line. If a plan proposes building a counter, a store, or a scanner that already exists in the table above, it is a reuse-before-build failure.

## Common Pitfalls

### Pitfall 1: Reporting a lone density number
**What goes wrong:** A caller or a future reader pulls Gauge 1 alone and ships the engagement machine (the exact failure the welded contract exists to prevent).
**How to avoid:** No exported bare-density reader. `two-gauge.cjs` returns the pair or errors; the emit refuses an unwelded payload. A floor test asserts the welded pair (mirror `test-canon-entry-31-two-gauge-floor.cjs`).
**Warning sign:** any meter export whose return type is `number`.

### Pitfall 2: Mistaking a proxy for a transfer measurement
**What goes wrong:** The artifact or a downstream phase treats reject-capture-rate / latency as a quality (transfer) DELTA, violating Part 5 / entry 28.
**How to avoid:** Carry the honesty table above into the artifact and the code comments. Label each proxy "named-debt proxy", not "transfer".
**Warning sign:** any doc line claiming METER "measures transfer" rather than "instruments the Gauge-2 source".

### Pitfall 3: CLI-only emit (surface under-count)
**What goes wrong:** The gate-reach emit lands on a CLI-only branch; Desktop/Cowork gate-reaches go uncounted; the GATE (does anybody reach the gate) reads falsely low and READER is wrongly blocked.
**How to avoid:** Place the emit on the surface-shared resolve path that the MCP wrapper also traverses (STACK.md shared-core rule). Add a test asserting the seam is reachable from the shared engine entry, not only the CLI entry.
**Warning sign:** the emit sits inside a `process.argv`/CLI-only conditional.

### Pitfall 4: Double-counting one gate
**What goes wrong:** A re-entrant engine arm or a retried turn emits `gate_reached` twice, inflating the count.
**How to avoid:** Use `logEvent`'s `dedupe_key` (60s idempotency, `memory-events.cjs:561`) keyed on the turn/correlation id.
**Warning sign:** gate counts exceed turn counts.

### Pitfall 5: `framework_invoked` may not actually fire
**What goes wrong:** `framework_invoked` is in `EVENT_TYPES` (`memory-events.cjs:116`) and READ by `_invocationsSinceDecision`, but the emission-site comment (`:109-115`) warns "the actual emission site is a follow-on instrumentation pass... computeInvestmentLevel returns level 0 - the cold-start path". If no caller emits it, Gauge 1 density reads near-zero regardless of real activity.
**How to avoid:** During research/planning, VERIFY which sites emit `framework_invoked` today (grep showed reads, not writes). If under-emitted, Gauge 1 should lean on `reach_presented` + `gate_reached` (which DO fire) as the density basis, with `framework_invoked` as an additive term. Flag as Open Question O-1.
**Warning sign:** density is 0 on a room with visible reach activity.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node.js assert scripts (`node tests/test-*.cjs`), aggregated by `bash tests/run-all-<phase>.sh`. No jest/vitest. |
| Config file | none - convention-based (see `tests/run-all-180.sh`, `tests/run-all-178.sh`, `tests/run-all-158.sh`). |
| Quick run command | `node tests/test-meter-two-gauge-floor.cjs` (per-task). |
| Full suite command | `bash tests/run-all-183.sh` (phase gate). |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METER-01 | `gate_reached` member added; gate-reach count derivable; density readable via `findRecentChanges` | unit | `node tests/test-meter-gate-density.cjs` | Wave 0 |
| METER-01 | `EVENT_TYPES` floor preserved + `gate_reached` present, never `.size` | unit | `node tests/test-meter-event-types-floor.cjs` | Wave 0 |
| METER-02 | reject-capture-rate / latency / independence readers over `f_selector_decision` + timestamps | unit | `node tests/test-meter-transfer-reader.cjs` | Wave 0 |
| METER-01+02 | welded read returns the pair or errors; lone density impossible; two-directional regression guard | unit | `node tests/test-meter-two-gauge-floor.cjs` | Wave 0 |
| Part 8 | grep-sweep over new files = 0 network tokens | shell | inside `tests/run-all-183.sh` | Wave 0 |
| Frozen sets | reach-ids (6) + posture-ids (3) drift fences GREEN (METER mints none) | unit | carried in `tests/run-all-183.sh` (mirror `run-all-180.sh`) | exists |

### Sampling Rate
- **Per task commit:** the touched `node tests/test-meter-*.cjs`.
- **Per wave merge:** `bash tests/run-all-183.sh`.
- **Phase gate:** `run-all-183.sh` fully green + the carried frozen-set drift fences green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-183.sh` - the phase aggregator (mirror `tests/run-all-180.sh`; carries the grep-sweep + drift fences).
- [ ] `tests/test-meter-two-gauge-floor.cjs` - the welded-pair floor test (mirror `test-canon-entry-31-two-gauge-floor.cjs`).
- [ ] `tests/test-meter-event-types-floor.cjs` - `gate_reached` membership + full floor, never `.size` (mirror `test-edges-room-lineage-floor.cjs`).
- [ ] `tests/test-meter-gate-density.cjs`, `tests/test-meter-transfer-reader.cjs` - the reader unit tests (use the `roomState` injection seam for db-free runs).

## Security Domain

`security_enforcement` is not disabled; Part 8 is the governing security constitution here.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `logEvent` validates `eventType` against the frozen `EVENT_TYPES` Set (`memory-events.cjs:545`); off-enum reach values dropped before storage (`selector-decisions.cjs:224`). |
| V8 Data Protection / privacy boundary | yes (the load-bearing one) | Canon Part 8: LOCAL->BRAIN: NO. The meter reads/writes only `room.db` `memory_event` rows; enum/scalar payloads; the grep-sweep fence proves no network surface. |
| V7 Logging | yes | The meter IS a logging surface; payloads carry counts+enums, never venture prose or the reject `reason` string in any egressable field. |
| V6 Cryptography | no | No crypto introduced (event ids use the existing `crypto.randomBytes` in `logEvent`). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User content smuggled into a `memory_event` field (then read by a cross-room aggregator) | Information disclosure | enum/scalar-only payloads; the `selector-decisions.cjs:199-211` precedent (classify the sentence, store only the boolean+enum, never the sentence); grep-sweep fence. |
| A meter read used as a Brain query payload | Information disclosure (Part 8 breach) | The meter makes zero Brain calls; the grep-sweep over `brain-client\|fetch\|http\|curl\|brain.mindrian\|tavily` = 0; readers carry no packet.cjs import. |
| Lone-density egress (the engagement machine) | Tampering with the metric's meaning | Structural weld: no bare-density export; emit refuses unwelded payload. |
| Cross-room aggregation of per-room state | Information disclosure | Per-room scope: readers read only the passed `db` (the active room); never aggregate across rooms (`reach-reject-reader.cjs:292`). |

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Inferring intelligence-firing from Brain request count (surface-agnostic, can't tell gate-reach) | LOCAL `reach_presented`/`gate_reached` markers on the engine arm | Phase 158 (`reach_presented`) + this phase (`gate_reached`) | The meter answers gate-reach with a real number, not a Brain-count inference (the acceptance). |
| Hooked engagement composite as the validation gate | The welded two-gauge metric (density welded to transfer) | Canon v1.19, Appendix D entry 31 (2026-06-27) | METER is the instrument that produces the v1.19 metric; the Hooked gate is retired. |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `framework_invoked` is under-emitted today (emission is a "follow-on instrumentation pass" per `memory-events.cjs:109-115`), so Gauge 1 should lean on `reach_presented`+`gate_reached` as the density basis. | Pitfall 5 / Reuse Map | If `framework_invoked` actually fires broadly, the density basis choice is suboptimal but not wrong; verify emission sites during planning. |
| A2 | The MCP (Desktop/Cowork) path traverses the SAME `intent-classifier.cjs` engine-arm resolve seam where the emit lands. | Tri-Polar note | If the MCP wrapper has a separate resolve path, the emit must be relocated to the shared core or Desktop/Cowork under-count. Verify the MCP entry's call graph. |
| A3 | A real two-gauge READING from a live navigator (not a real transfer DELTA) is what clears the entry-31 self-binding clause. | Transfer proxies | If the navigator intends a stronger bar, METER alone may not clear the self-bind; confirm the reading-vs-delta interpretation with the navigator. |

## Open Questions

1. **Does `framework_invoked` fire at real call sites today, or only get read?** (A1)
   - Known: it is read by `_invocationsSinceDecision`/`computeInvestmentLevel`; the Set comment says emission is a deferred follow-on.
   - Unclear: whether any shipped hook/command emits it.
   - Recommendation: grep emission sites in planning; if absent, base Gauge 1 on `reach_presented`+`gate_reached` and treat `framework_invoked` as additive.
2. **Density denominator definition for "transfer-per-invocation".** Is the invocation unit a `gate_reached`, a `framework_invoked`, or a `reach_presented`? This sets what "per-invocation" divides by.
   - Recommendation: define the unit explicitly in the welded read and document it; default to `gate_reached` (the cleanest per-turn unit) unless the navigator specifies otherwise.
3. **Latency end-event for "validated decision".** `confirmNode`/`status_promoted` (human confirm) vs `f_selector_decision` (accept) vs `decision_captured` (reserved, unemitted at `memory-events.cjs:256`).
   - Recommendation: pair to `status_promoted` (the human-confirmed truth-claim, Part 9 role 5) as the canonical "validated decision"; note `decision_captured` as a future cleaner anchor if it gets emitted.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (CJS) | all meter code | yes (repo baseline >=18) | repo `package.json` engines | - |
| `better-sqlite3` (via `room.db`) | `memory_event` read/write | yes (vendored, shipped) | existing | the readers return 0 on null db (Tier 0 cold path) |
| `room.db` present | live gate-reach/transfer reads | per-room (created at room birth) | - | readers return 0 / cold-start when absent; never throw |

No external tools, services, or network dependencies. (Step 2.6 essentially SKIPPED - code/config only.)

## Sources

### Primary (HIGH confidence - in-repo, read at file:line this session)
- `lib/core/navigation.cjs` - the chokepoint + re-exports (`logMemoryEvent:102`, `findRecentChanges:83`, `openRoomDbForCaller:306`).
- `lib/core/navigation/memory-events.cjs` - `EVENT_TYPES` Set (`:10`, 86 members), `logEvent` (`:544`), `findRecentChanges` (`:597`), additive idiom (`:82`).
- `scripts/intent-classifier.cjs:1503-1574` - the `reach_presented` emission seam + `computeReachPenalties` fold (gate-reach observation point).
- `lib/workflow/reach-reject-reader.cjs` - reach-keyed reject/presentation readers (transfer substrate).
- `lib/workflow/selector-decisions.cjs` - `recordSelectorDecision` (`:123`/`:244`), `_invocationsSinceDecision` (`:309`).
- `lib/core/navigation/projections.cjs:254` - `computeInvestmentLevel` (density projection idiom).
- `lib/core/navigation-engine.cjs:768` - `decide()`; routing_source flip ~`:1071`.
- `lib/hmi/selector-dispatcher.cjs:528` - `appendAskUserQuestionTrailer` (frozen, do not touch).
- `tests/run-all-180.sh` + `tests/test-canon-entry-31-two-gauge-floor.cjs` + `tests/test-edges-room-lineage-floor.cjs` - the test/aggregator/floor idiom.
- `tests/test-95.5-00-scaffold.sh:52` - the Part 8 grep-sweep fence precedent.
- `docs/MINDRIAN-CANON.md` Parts 5/8/9/10/11 + Appendix D entries 28/31 - the welded two-gauge contract + the self-binding clause.
- `CLAUDE.md` - workspace guard, Tri-Polar rule, release process, RCA standard.

### Secondary (MEDIUM confidence)
- `docs/CANON-PHASE-MAP.md` - Phase 180 (entry 31) shipped rows; the v1.19 metric provenance.

### Tertiary (LOW confidence)
- None - all claims verified in-repo this session.

## Metadata

**Confidence breakdown:**
- Reuse map / file:line hooks: HIGH - read directly this session.
- Gate-reach observation point: HIGH - the seam exists and emits today.
- Transfer proxies real-vs-debt: HIGH on computability, HIGH on the honesty framing (canon-grounded).
- `framework_invoked` emission status: MEDIUM - the Set comment flags it deferred; reads confirmed, writes not located (Open Question 1).
- Tri-Polar MCP seam parity: MEDIUM - inferred from STACK.md shared-core rule; the exact MCP call graph not traced this session (Assumption A2).

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable in-repo substrate; re-verify the `intent-classifier.cjs` line numbers if that file is edited before planning).

## RESEARCH COMPLETE
