# Phase 244: Semantic Trigger Tier - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 13 (7 modify, 6 create)
**Analogs found:** 13 / 13
**Source:** `244-RESEARCH.md` + revised `.planning/ROADMAP.md` Phase 244 + `REQUIREMENTS.md` TRIG-01/02/03. **No `244-CONTEXT.md` on disk at mapping time** (only `244-RESEARCH.md` is in the phase dir), so every decision below traces to RESEARCH plus the NAVIGATOR-CONFIRMED note already written into ROADMAP SC2.

All `file:line` anchors below were re-read live at mapping time (a parallel session is committing; symbols are the stable anchors, numbers may drift).

---

## Four Corrections to the Research (found on disk during mapping)

All four are load-bearing for the planner.

### Correction 1: `tableExists` and `toFtsMatch` are NOT public exports. They live under `_test`.

The research's recommended fixes lean on both: Q2 Option A says the FTS reconcile "must be guarded by a `tableExists(db,'eureka_fts')` probe", and the Don't-Hand-Roll table says "route through `toFtsMatch`". Neither is reachable from production code today. Verified verbatim at `lib/core/eureka/tri-modal-index.cjs:447-467`:

```javascript
module.exports = {
  openIndex: openIndex,
  indexNodes: indexNodes,
  lexicalSearch: lexicalSearch,
  vectorSearch: vectorSearch,
  nodeText: nodeText,
  ensureFtsAvailable: ensureFtsAvailable,
  _test: {
    STOPWORDS: STOPWORDS,
    indexedText: indexedText,
    toFtsMatch: toFtsMatch,
    ftsBackendName: ftsBackendName,
    ftsProbe: ftsProbe,
    resetFtsProbe: resetFtsProbe,
    vecToBlob: vec._test.vecToBlob,
    blobToVec: vec._test.blobToVec,
    tableExists: tableExists,
  },
};
```

**Planner consequence, two parts.**

1. `toFtsMatch` needs no promotion: the content producer calls `lexicalSearch`, which calls `toFtsMatch` internally (`:418-431`). Production code should never call `toFtsMatch` directly, and a plan that reaches into `tri._test.toFtsMatch` from `lib/` is importing a test seam into the runtime path. The Pitfall-1 sanitize test MAY use `_test.toFtsMatch` (that is what the seam is for).
2. `tableExists` DOES need promotion to a public export if `lazygraph-ops.cjs` is to guard the reconcile with it. That is a one-line additive change to the `module.exports` block above, not a rewrite. The alternative (hand-roll a `sqlite_master` probe inside `lazygraph-ops.cjs`) is a Part 7 duplication of a 7-line function; the promotion is the correct call. `tableExists` verbatim at `:181-188`:

```javascript
function tableExists(db, name) {
  try {
    const r = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
    return !!r;
  } catch (_e) {
    return false;
  }
}
```

### Correction 2: the `=== 'keyword'` silent-promotion hazard has ZERO production consumers

The research (Q1) calls this a "MANDATORY companion change" and asks the planner to grep. Grep run at mapping time:

```
$ grep -rn "=== 'keyword'\|!== 'keyword'\|isContextTier" --include=*.cjs lib/ scripts/ tests/
lib/core/insight-sensors.cjs:53:  isContextTier,
lib/core/insight-sensors.cjs:844:  isContextTier: isContextTier,
lib/core/sensors/sensor-types.cjs:170:  * `classifyTriggerTier(...) === 'keyword'` (fallback) against anything else.
lib/core/sensors/sensor-types.cjs:187:function isContextTier(tier) {
lib/core/sensors/sensor-diffusion-adoption.cjs:56:  isContextTier,
tests/test-170-171-cirs-conformance.cjs:51:  ... kwFire.evidence.mode === 'keyword'
tests/test-diffusion-adoption-sensor.cjs:48, :92
tests/test-show-share-sensor.cjs:49, :87
```

The only `=== 'keyword'` occurrences in the tree are (a) the doctrine COMMENT at `sensor-types.cjs:170` that recommends the idiom, and (b) four TEST assertions on `evidence.mode`, none of which a new `'content'` tier can reach (the two sensors that stamp `mode` classify their own turn, and neither will ever be handed `'content'`). Every live consumer goes through `isContextTier`, which is an explicit allowlist and already returns `false` for `'content'`.

**Planner consequence:** adding `isFallbackTier` is a cheap forward-looking belt and a good test target, but it is **not** fixing a live defect, and the plan must not claim it is. The four test assertions require no migration. The one thing that genuinely must change is the doctrine comment at `:168-170`, which is currently RECOMMENDING an idiom that a fourth tier makes wrong.

### Correction 3: the doctor check is a DATA registration, not a `doctor.cjs` code edit. The `--acceptance` point is a SECOND, separate edit.

The research says "add an `eureka_fts` presence/freshness module to `node scripts/doctor.cjs --acceptance`" as if it were one task. On disk it is two distinct surfaces with two different shapes:

- **Doctor module registry** (`data/doctor-modules.json`, a hand-maintained JSON array). A new module is a `{ id, introduced_version, cadence, flag, fix_supported, runner, description }` entry pointing at `lib/core/doctor/<name>-module.cjs`. No `scripts/doctor.cjs` edit at all.
- **The `--acceptance` checklist** is a separate hand-written array of `{ id, label, severity, applies_to, run }` objects inside `scripts/doctor.cjs` (the Class S eureka point is the last entry, ending at `:1493`). A module in `doctor-modules.json` does NOT automatically become an acceptance point.

The plan must decide which one it wants (recommendation: BOTH, following the graph-derive-health precedent for the module and the Class S precedent for the acceptance point) and must not conflate them into a single task.

### Correction 4: `lexicalSearch` calls `ensureFtsAvailable()` but never `tableExists`

`lexicalSearch:419` gates on the CAPABILITY probe (is FTS5 compiled in), not on whether `eureka_fts` exists in THIS db. On a live room with FTS5 available but no index built, it falls into the `try` and the `catch (_e) { return []; }` swallows "no such table: eureka_fts". That is exactly Pitfall 1's "silent-swallow masquerading as a legitimate no-match", and it is the DEFAULT state of every production room today (B-2). The producer must probe `tableExists` itself to distinguish `index_absent` from `zero_hits`; it cannot infer it from `lexicalSearch`'s return value.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `lib/core/sensors/sensor-content-relevance.cjs` | sensor (3-layer: pure sensor + ctx producer + gate) | request-response (turn -> FTS read -> reach) | `lib/core/sensors/sensor-expert-skill.cjs` | **exact** |
| MODIFY `lib/core/sensors/sensor-types.cjs` (`TRIGGER_TIERS` `:73-77`, `isContextTier` `:187-189`, doctrine `:60-77`/`:168-170`) | model / frozen vocabulary | pure transform | itself | n/a |
| MODIFY `lib/core/navigation-engine.cjs` (sensorCtx assembly, after `:917`) | engine ctx-assembly | request-response + db read | itself, the SENS-11 producer block `:883-917` | **exact** |
| MODIFY `lib/core/insight-sensors.cjs` (`require` near `:118`, `SENSOR_REGISTRY` `:690-720`, `module.exports` near `:809`) | registry | event-driven dispatch | itself, the `sensorUrlIngest` / `sensorEureka` entries | **exact** |
| MODIFY `lib/core/eureka/tri-modal-index.cjs` (`module.exports` `:447-467` only) | utility (retrieval primitive) | file/db read | itself | n/a |
| MODIFY `lib/core/lazygraph-ops.cjs` (inside `rebuildGraph`'s `BEGIN` at `:668`, after `clearIndexerOwnedRows(conn)` `:674`) | service (indexer) | batch + destructive reconcile | itself, `clearIndexerOwnedRows` `:126-152` | **exact** |
| MODIFY `lib/workflow/f-selector-ranker.cjs` (optional arg near `:646`, two new passes near `:596`, composition `:755-759`) | ranker | transform (list -> list) | itself, `_applySens10Flip` `:521-561` + `_applyRoleLevelBias` `:596-615` | **exact** |
| NEW `lib/core/doctor/eureka-fts-health-module.cjs` | doctor module (check-only) | CRUD read across rooms | `lib/core/doctor/room-graph-density-module.cjs` | **exact** |
| MODIFY `data/doctor-modules.json` (append one entry) | config | n/a | the `room-graph-density` / `graph-derive-health` entries `:141-160` | **exact** |
| MODIFY `scripts/doctor.cjs` (append one acceptance point) | config / gate | batch | the Class S `eureka-smoke-stack-ready` point `:1437-1493` | **exact** |
| NEW `tests/test-244-*.cjs` (5 files, see Validation Architecture) | test | unit + integration | `tests/test-219-fts5-degrade.cjs` (+ `tests/helpers/fixture-room-219.cjs`) | **exact** |
| NEW `tests/run-all-244.sh` | test aggregator | batch | `tests/run-all-236.sh` | **exact** |
| MODIFY `docs/ENV-TUNING.md` | docs | n/a | its existing per-subsystem sections | role-match |

---

## Pattern Assignments

### NEW `lib/core/sensors/sensor-content-relevance.cjs` (sensor, request-response)

**Analog: `lib/core/sensors/sensor-expert-skill.cjs`. Copy the 3-layer split, the frozen-reach fail-closed, and the Part-8 evidence discipline verbatim in shape.**

**The 3-layer header contract to restate in 244's own words (`:8-31`, verbatim):**

```javascript
 * This module carries THREE roles at three different layers, kept separate on purpose:
 *
 *   1. sensorExpertSkill(turn, tuple, ctx) -> reach|null  -- the PURE registered
 *      sensor. It mirrors sensor-recency.cjs:114 / sensor-external-fact.cjs:117
 *      EXACTLY: a sync fn that reads ONLY LOCAL ctx enum/scalars, makes NO db read
 *      and NO Brain call, and returns a SINGLE makeReach({ reach_id:'context_block',
 *      ... }) object or null. It promotes nothing and emits nothing. It is the piece
 *      registered into SENSOR_REGISTRY so dispatchSensors actually fires it.
 *
 *   2. detectExpertSkillCandidates(db, opts)  -- the ctx-assembly PRODUCER helper.
 *      THIS is where the db read lives. It runs at ctx-assembly time (inside the
 *      navigation-engine sensorCtx block, mirroring the MED-01 cortex producer at
 *      navigation-engine.cjs:847-865) ...
 *
 *   3. resolveExpertSkillDecision(db, nodeId, decision, opts)  -- the gate action.
```

**The frozen-reach fail-closed at load (`:51-62`, verbatim). Copy exactly, changing only the module name in the message:**

```javascript
const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-11: the new sensor id (SENS-01/06 live in insight-sensors; 02-05/07-10 live
// in sibling sensor files; 11 is the next free id).
const SENSOR_ID = 'SENS-11';

// FROZEN: the sensor rides the existing context_block reach (the LOCAL in-process
// context surface). Fail closed at load if it ever drifts off the frozen bank.
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-expert-skill: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}
```

**Sensor-id verification is a STATED check, not an assumption.** The `sensor-eureka.cjs:15-16` precedent writes the check into the source:

```javascript
 * SENSOR ID: SENS-13. SENS-11 = expert-skill, SENS-12 = room-pick (both taken,
 * verified against lib/core/insight-sensors.cjs 2026-07-06). SENS-13 is free.
```

Confirmed at mapping time: `SENSOR_REGISTRY` (`insight-sensors.cjs:690-720`) holds 17 entries ending at `sensorUrlIngest` (SENS-15, Phase 220). **`SENS-16` is free.** Re-verify at execution time; write the dated check into the header the way SENS-13 did.

**The pure-sensor body shape (`:88-119`, verbatim). Note: reads ONLY ctx scalars, zero db, `makeReach` or `null`, never throws:**

```javascript
function sensorExpertSkill(_turn, _tuple, ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  if (ctx.reusableExpertCandidate !== true) return null; // no confirmed reusable signal

  const invocationMax = (isFiniteNumber(ctx.reusableExpertInvocationMax) && ctx.reusableExpertInvocationMax > 0)
    ? ctx.reusableExpertInvocationMax
    : 0;
  const tierSignal = ctx.reusableExpertTierSignal === true;
  ...
  return makeReach({
    // FROZEN: rides the existing context_block reach. Mints NO new reach_id.
    reach_id: REACH_ID,
    posture: 'push_forward',
    dispatch: 'expert-skill materialization offer (mos:skill --from-expert)',
    companions: [],
    signal: 'expert_skill',
    // LOCAL closed scalars only. sub_mode is the 'save as skill' offer LABEL (not a
    // reach_id). The WHICH (the specific expert) is resolved LOCALLY at the gate.
    evidence: {
      candidate_count: candidateCount,
      invocation_max: invocationMax,
      tier_signal: tierSignal,
      sub_mode: 'save_expert_as_skill',
    },
  });
}
```

For 244 use `posture: 'hold'` (the SENS-13 / SENS-SHOW "standing suggestion, never an auto-open" precedent, `sensor-eureka.cjs:24-27`), not `push_forward`.

**The producer's caller-owned-handle + soft-fail contract (`:153-166`, verbatim). This is the shape the content producer copies; only the SQL changes to a `lexicalSearch` call:**

```javascript
function detectExpertSkillCandidates(db, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const threshold = isFiniteNumber(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const result = { reusable: false, invocationMax: 0, tierSignal: false, candidates: [] };

  if (!db || typeof db.prepare !== 'function') return result;

  let rows;
  try {
    rows = db.prepare(CONFIRMED_EXPERT_SQL).all();
  } catch (_e) {
    return result; // soft-fail: no signal when the read fails
  }
  ...
```

**The LOCAL-candidates-never-on-the-reach discipline (`:184-189`, verbatim). This is the Part-8 answer for the matched `node_id` list:**

```javascript
  // Rank the LOCAL candidate list by invocation (desc) so the gate APPROVE handler
  // offers the most-reused expert first. LOCAL only -- never ridden on the reach.
  hits.sort(function (a, b) { return b.invocation - a.invocation; });
  result.candidates = hits.map(function (h, i) { return { nodeId: h.nodeId, rank: i }; });
```

**Freshness / staleness discipline, if the plan adds an index-age check: `sensor-eureka.cjs:43-47` (verbatim) is the reasoned-through precedent, and the header explains WHY it is replicated rather than imported:**

```javascript
 * FRESHNESS (Spoofing mitigation T-213-06): a stale side-channel never
 * re-fires the sensor. The 30-minute EUREKA_SIGNAL_FRESHNESS_MS window plus the
 * WR-01 future-mtime guard (clock skew / archive restore) is REPLICATED locally
 * here -- we do NOT import insight-sensors.cjs (that would be a circular require
 * from a sensors/ file).
```

**Sink to reuse, not rebuild** (`tri-modal-index.cjs:418-431`, verbatim; this is the whole retrieval leg TRIG-01 needs):

```javascript
function lexicalSearch(db, query, k) {
  if (!ensureFtsAvailable().ok) return [];
  const limit = Number.isFinite(k) && k > 0 ? k : 10;
  const matchExpr = toFtsMatch(query);
  if (!matchExpr) return [];
  try {
    const rows = db.prepare(
      'SELECT node_id, bm25(eureka_fts) AS rank FROM eureka_fts WHERE eureka_fts MATCH ? ORDER BY rank LIMIT ?'
    ).all(matchExpr, limit);
    return rows.map(function (r) { return { node_id: r.node_id, rank: r.rank }; });
  } catch (_e) {
    return [];
  }
}
```

Per Correction 4, the producer must call `tableExists(db, 'eureka_fts')` BEFORE this, so `index_absent` is a distinguishable state.

---

### MODIFY `lib/core/sensors/sensor-types.cjs` (model, pure transform)

**Analog: itself.** Three surfaces change; a fourth must NOT.

**The array (`:73-77`, verbatim) - insert `'content'` between `context` and `keyword`:**

```javascript
const TRIGGER_TIERS = Object.freeze([
  'signal',
  'context',
  'keyword',
]);
```

**The doctrine block that documents the ORDER as the precedence (`:60-72`, verbatim). The new tier needs its own line here or the array becomes undocumented:**

```javascript
// Canon Part 11 R3: a trigger keys on navigator PROBLEM-STATE (stage / JTBD /
// graph-gap) read LOCALLY via the navigation.cjs chokepoint (enum/scalar only,
// Part 8/9); keyword/lexicon match is a FALLBACK tier, not the basis. This is
// the closed, ORDERED tier vocabulary -- the order IS the precedence doctrine:
//   signal   -- an explicit problem-state signal kind on the turn (strongest).
//   context  -- a LOCAL navigator problem-state enum (stage / jtbd / graph_gap)
//               present on the tuple+ctx the navigation.cjs chokepoint populated.
//   keyword  -- only a keyword/lexicon match in the turn text (the FALLBACK).
```

**The allowlist predicate that must stay an allowlist (`:187-189`, verbatim). DO NOT convert it to a denylist:**

```javascript
function isContextTier(tier) {
  return tier === 'signal' || tier === 'context';
}
```

It already returns `false` for `'content'`, which is correct per R3. A test pinning `isContextTier('content') === false` is the cheap mutation-proof leg. Add `isFallbackTier` beside it (same allowlist shape, `content` + `keyword`) and export it at `:264`.

**The comment that is now WRONG and must be amended (`:168-170`, verbatim):**

```javascript
 * NOTE: 'signal' and 'context' are BOTH context-tier (both rank above keyword).
 * A caller that only needs the binary context-vs-fallback decision can compare
 * `classifyTriggerTier(...) === 'keyword'` (fallback) against anything else.
```

Per Correction 2 no live code follows this advice, so this is a doc fix, not a migration. It must still be fixed, because leaving a comment that recommends a now-broken idiom is doctrine rot of the MW-4 class Phase 242 just cleaned.

**`classifyTriggerTier` (`:174-180`) is NOT where `'content'` gets produced.** It is a pure turn/tuple/ctx classifier with no db handle and no corpus access; a content-tier classification requires the FTS read that lives in the ctx-assembly producer. `'content'` reaches evidence via the sensor's `evidence: { trigger_tier: 'content' }`, exactly as `sensor-diffusion-adoption.cjs:204-222` stamps its `mode`. Do not try to make `classifyTriggerTier` return `'content'`.

**`makeReach`'s Part-8 scalar filter (`:230-241`, verbatim)** already drops non-primitives, so a `node_id` ARRAY cannot ride the reach even by accident. This is a belt, not a licence: the plan must still keep `contentCandidates` off the reach deliberately.

```javascript
  // evidence: LOCAL scalars only. We freeze a shallow copy of primitive values.
  // Non-primitive values are dropped so the struct stays a flat scalar bag.
  const evidence = {};
  if (opts.evidence && typeof opts.evidence === 'object' && !Array.isArray(opts.evidence)) {
    for (const k of Object.keys(opts.evidence)) {
      const v = opts.evidence[k];
      const t = typeof v;
      if (t === 'string' || t === 'number' || t === 'boolean') {
        evidence[k] = v;
      }
    }
  }
```

---

### MODIFY `lib/core/navigation-engine.cjs` (engine ctx-assembly, request-response + db read)

**Analog: the SENS-11 producer block at `:883-917`, immediately above the insertion point. Copy the braces-scoped block, the `ctx.roomDb` handle discipline, the try/catch soft-fail, and the caller-override precedence.**

**The block-comment contract (`:873-882`, verbatim) - restate for 244; every clause applies unchanged:**

```javascript
  // Phase 203-03 producer (SENS-11): derive the reusable-expert scalars
  // sensorExpertSkill reads (...) from CONFIRMED
  // SyntheticExpert nodes in room.db, mirroring the MED-01 cortex producer above.
  // The db read runs HERE (ctx-assembly), NEVER inside the pure sensor (Part 8/9).
  // The engine does not OPEN room.db; it uses a caller-threaded handle (ctx.roomDb)
  // when present, exactly as MED-01 consumes the caller-threaded cortex projection.
  // The LOCAL candidate list (node ids) is threaded onto sensorCtx for the gate
  // APPROVE handler ONLY -- it is never ridden on the reach. Caller-threaded ctx.*
  // scalar overrides win (the test seam). Defensive; never throws.
```

**The body shape (`:883-917`, verbatim) - the exact template:**

```javascript
  {
    let reusable = false;
    let invocationMax = 0;
    let tierSignal = false;
    let candidateCount = 0;
    const roomDb = (ctx.roomDb && typeof ctx.roomDb.prepare === 'function') ? ctx.roomDb : null;
    if (roomDb) {
      try {
        const threshold = (typeof ctx.reusableExpertThreshold === 'number')
          ? ctx.reusableExpertThreshold
          : undefined;
        const sig = detectExpertSkillCandidates(roomDb, threshold !== undefined ? { threshold: threshold } : {});
        if (sig && sig.reusable === true) {
          reusable = true;
          ...
          // LOCAL candidate list for the gate APPROVE handler only (never on the reach).
          sensorCtx.reusableExpertCandidates = Array.isArray(sig.candidates) ? sig.candidates : [];
        }
      } catch (_e) {
        // soft-fail: degrade to no reusable-expert signal
      }
    }
    sensorCtx.reusableExpertCandidate = (ctx.reusableExpertCandidate === true) || reusable;
    sensorCtx.reusableExpertInvocationMax =
      (typeof ctx.reusableExpertInvocationMax === 'number' && ctx.reusableExpertInvocationMax > 0)
        ? ctx.reusableExpertInvocationMax
        : invocationMax;
    ...
  }
```

Four properties the 244 block must preserve: (a) it is a bare `{ ... }` scope so its locals do not leak into `decide()`; (b) the engine NEVER opens room.db, it only uses `ctx.roomDb`; (c) the whole db read is inside one `try/catch` that soft-fails to no signal; (d) caller-threaded `ctx.*` scalars override the computed values, which IS the test seam that lets a unit test fire the sensor with no db at all.

**The turn text the producer needs.** `decide()` reads the turn as `t` (`:825`, `const t = turn || {}`). Per `normalizeTurn`'s doc (`insight-sensors.cjs:347-352`) the canonical text precedence is `turn.text || turn.utterance || turn.userText || ''`; the research's example only reads `t.userText`. Use the full precedence chain, or the producer will see empty text on every caller that already normalizes.

**The latency fence this block sits inside (`:818-821`, verbatim)** - the 1200ms NAV budget is instrumented right here, so a producer that blocks shows up in `_meta.latencies_ms`:

```javascript
  // Phase 144 (Task 2): LOCAL monotonic clock for the decide()-body latency
  // budget telemetry. Date.now() is LOCAL and never transmitted; the resulting
  // _meta.latencies_ms is LOCAL trace JSON only (guards the 1200ms NAV budget).
  const decideStartMs = Date.now();
```

`lexicalSearch` is ~1ms (measured). `indexNodes` is `async` and reads artifact bodies off disk, so a lazy build-on-first-miss must NOT be awaited here; it enqueues or defers (Pitfall 5).

---

### MODIFY `lib/core/insight-sensors.cjs` (registry, event-driven)

**Analog: itself.** Three one-line additions, all mechanical.

**The require line, beside its siblings (`:118` / `:137`, verbatim):**

```javascript
const { sensorExpertSkill } = require('./sensors/sensor-expert-skill.cjs');
const { sensorEureka } = require('./sensors/sensor-eureka.cjs');
```

**The registry entry, appended after `sensorUrlIngest` (`:690-720`, tail verbatim). Every entry carries a phase-and-id comment; match the format exactly:**

```javascript
  // Phase 219 detector (SENS-14 -- opportunity-harvest -> qualification-card offer on context_block):
  sensorOpportunityHarvest,
  // Phase 220 detector (SENS-15 -- pasted URL -> deep_research url-ingest offer):
  sensorUrlIngest,
];
```

**The named export near `:809`** (`sensorEureka: sensorEureka,`) - the module re-exports each sensor by name for direct-test access.

**Do NOT touch `normalizeTurn` (`:367-382`).** It stamps `copy.trigger_tier` from `classifyTriggerTier` and, per the Correction to `sensor-types.cjs` above, cannot produce `'content'`. Its soft-fail-to-null discipline (verbatim) is the reason a tier-classifier fault never poisons dispatch:

```javascript
  let tier = null;
  try {
    tier = classifyTriggerTier(copy, tuple, ctx);
  } catch (_e) {
    tier = null;
  }
  copy.trigger_tier = tier;
```

**Do NOT touch `dispatchSensors`' Phase 144 fence.** The header at `:722-731` states it "NEVER mutates routing_source and NEVER calls decide()". A new registry entry is fully within the fence; anything more is not.

---

### MODIFY `lib/core/lazygraph-ops.cjs` (indexer, batch + destructive reconcile)

**Analog: itself.** The insertion point is a single statement inside an existing transaction.

**The exact site (`:668-675`, verbatim). The new reconcile goes immediately after `clearIndexerOwnedRows(conn)`, inside the same `BEGIN`:**

```javascript
  conn.prepare('BEGIN').run();
  try {
    // Clear existing INDEXER-OWNED data (edges first for FK compliance).
    // Phase 236 (GRAPHDB-01): the ONE ownership-scoped wipe, shared with
    // scripts/build-ecosystem-graph.cjs. rebuildGraph passes no extra derived
    // edge types because it regenerates nothing beyond BELONGS_TO.
    clearIndexerOwnedRows(conn);
```

and the matching failure path (`:743-747`, verbatim) that makes the reconcile atomic for free:

```javascript
    conn.prepare('COMMIT').run();
  } catch (err) {
    try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
    throw err;
  }
```

**The header constraint that forbids the obvious wrong fix (`:81-85`, verbatim). Quote it in the plan; a reviewer who has not read it will suggest exactly the banned change:**

```javascript
/** Node types the artifact indexer OWNS: it writes them and can fully regenerate them. */
const INDEXER_OWNED_NODE_TYPES = Object.freeze(['Artifact', 'Section']);

/** Edge types the artifact indexer OWNS: it writes them and can fully regenerate them. */
const INDEXER_OWNED_EDGE_TYPES = Object.freeze(['BELONGS_TO']);
```

preceded by (`:66-69`, verbatim): *"Do not widen these to EDGE_TYPES (the legal vocabulary) or to node-insert.cjs's header list ... Widening either constant reintroduces the data loss at a narrower scope."*

**Why the reconcile is a SEPARATE statement and not a widening of `clearIndexerOwnedRows`.** That function's doc contract (`:87-125`) is "an allowlist of what the indexer can REGENERATE" over the `nodes`/`edges` tables. `eureka_fts` is neither table and is 100% derived, so it does not belong in that allowlist; it belongs beside the call. The parameterization discipline the new statement should match (`:126-152`, verbatim):

```javascript
function clearIndexerOwnedRows(conn, extraDerivedEdgeTypes) {
  const ph = (arr) => arr.map(() => '?').join(',');

  // 1. The structural indexer-owned edges.
  conn.prepare(
    'DELETE FROM edges WHERE type IN (' + ph(INDEXER_OWNED_EDGE_TYPES) + ')'
  ).run(...INDEXER_OWNED_EDGE_TYPES);
  ...
```

**Substrate guard: clear.** `scripts/check-substrate.cjs` bans raw INSERT/UPDATE/DELETE on `nodes|edges|memory_event` outside an allowlist; `eureka_fts` is not in that banned set, and `lib/core/lazygraph-ops.cjs` is allowlisted anyway (verbatim, `check-substrate.cjs:70`):

```javascript
  /^lib\/core\/lazygraph-ops\.cjs$/,
```

No exemption widening needed.

**The second call site.** `clearIndexerOwnedRows` has TWO callers (`rebuildGraph` and `scripts/build-ecosystem-graph.cjs`, per its doc at `:88-90`). Research assumption A7 flags "the reconcile is missed at a third call site" as the residual risk. The plan should decide explicitly whether the ecosystem builder gets the same reconcile, and state the answer either way.

---

### MODIFY `lib/workflow/f-selector-ranker.cjs` (ranker, transform)

**Analog: itself, twice over. The layered-adjustment pass is already a two-instance pattern; 244 makes it four.**

**The optional-signal read to copy for `o.tierCandidates` (`:643-646`, verbatim). Note the comment explicitly names the byte-identical-no-op contract, which is SC2's acceptance criterion:**

```javascript
  // Phase 205-03: the optional SENS-10 circularity signal. When fired, the
  // clarify-vs-reframe flip suppresses ASK-as-clarification as the recommended
  // detent. Absent or not-fired => the flip never runs (byte-identical no-op).
  const sens10 = (o.sens10 && typeof o.sens10 === 'object') ? o.sens10 : null;
```

**The no-op guard + copy-on-write pass (`:596-615`, verbatim). Both new passes must have both properties:**

```javascript
function _applyRoleLevelBias(list, role_level) {
  const lean = resolveElevationLean(role_level);
  if (lean === null) return list; // no bias resolvable -> no-op.
  ...
  return list.map(function (it) {
    return Object.assign({}, it, {
      role_level: role_level,
      elevation_lean: lean.primary,
      elevation_secondary: lean.secondary,
      dial_default_hedged: hedgedAlways,
    });
  });
}
```

**The richer pass, for the MMR reorder shape (`:521-561`, key excerpts verbatim) - tag on a COPY, partition, reorder, `slice(0, k)`:**

```javascript
  // Tag on a COPY so the base rows stay clean (the sens10 fields appear only on
  // the flipped output). scored is already sorted score-desc, so partitioning
  // preserves score order within each detent bucket.
  const tagged = scored.map(function (it) {
    return Object.assign({}, it, {
      detent: detentOf(it),
      sens10_applied: true,
      sens10_cause: cause,
    });
  });
  ...
  return ordered.slice(0, k);
```

**The row shape the fusion re-projects onto (`:717-729`, verbatim). There is no `trigger_tier`, no `reach_id`, no sensor provenance here - this is BLOCKER B-1 confirmed on disk. `command` is the only stable join key:**

```javascript
    scored.push({
      command: cmd.command,
      jtbd_label,
      jtbd_summary,
      teaching,
      framework,
      score: Math.max(0, Math.min(1, adjustedScore)),
      why,
      source,
      investment_level,
      category,
      graph_relationship,
    });
```

**The sort and the composition, the two edit points (`:732-733` and `:747-759`, verbatim):**

```javascript
  // Sort score desc. Stable on ties.
  scored.sort((a, b) => b.score - a.score);
```

```javascript
  // Phase 205-05 (item 5): resolve role_level once for the dial-default bias.
  // null when no signal (cold start) -> the bias is a no-op below.
  const role_level = _resolveRoleLevel(o, effectiveRoomState);

  // Phase 205-03: the SENS-10 anti-circular flip. Runs ONLY when the sensor
  // fired this turn; otherwise the base slice below is byte-identical to pre-205.
  // Phase 205-05: the role_level bias is layered ON TOP of whichever list wins
  // (it does not undo the 205-03 flip; it only stamps the elevation lean).
  const finalList = (sens10 && sens10.fired === true)
    ? _applySens10Flip(scored, sens10, k)
    : scored.slice(0, k);

  return _applyRoleLevelBias(finalList, role_level);
```

**Ordering decision the plan must make explicit.** RRF fusion must run on the FULL `scored` list (pre-slice), because fusing after `slice(0, k)` cannot promote a cross-family hit that the D4 score buried. MMR must also run pre-slice, since it IS the cut. So the composition becomes: `scored` -> `_applyTierFusion(scored, tierCandidates)` -> `_applyMmrDiversity(fused, k)` -> then the existing sens10/slice/role_level chain. The `sens10` flip already owns the `slice(0, k)`, so the two orderings interact; whichever order is chosen must keep the no-`tierCandidates` path landing on `scored.slice(0, k)` byte-identically, or the 205-03/205-04 suites go red.

**The frozen scalars that must not move (`:87` and the header at `:503-505`, verbatim):**

```javascript
// The frozen Shape-F scalars are untouched: MAX_K, the 0.70/0.15 detent, and the
// D4 weights are NOT changed here. The 0.70 act-vs-offer line (D-Q4) is governed
// downstream; this task only governs the clarify-vs-reframe recommendation.
```

`MAX_K = 3` at `:87`, clamped at `:634-640`. The MMR pass receives `k` already clamped.

**The purity contract this phase amends (`:617-621`, verbatim). SC2 is NAVIGATOR-CONFIRMED to widen it, so the plan must EDIT this comment, not silently falsify it:**

```javascript
// ---------------------------------------------------------------------------
// MAIN SIGNATURE -- rankForSelector. Pure synchronous function. No Promise.
// No await. No Brain calls. No db writes. No memory_event writes. No event
// subscriptions (D10 invariant).
// ---------------------------------------------------------------------------
```

`o.tierCandidates` is caller-supplied data, so every clause above stays literally true (still sync, still no db, still no Brain). The comment needs one added sentence naming the optional tier-candidate input, not a retraction.

**The fusion primitive to call, never rebuild (`hybrid-retrieve.cjs:90-118`).** It accepts a tagged `{ source, items }` list and reads `item.node_id != null ? item.node_id : item.id`, so `{ id: r.command }` works and the returned `node_id` carries the command slug back. `resolveRrfK()` (`:68-77`, verbatim) is the env-idiom to copy for a dedicated `TRIG_RRF_K`:

```javascript
function resolveRrfK() {
  const raw = process.env.EUREKA_RRF_K;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 25;
}
```

**The similarity primitive for MMR (`lexical-overlap.cjs:75-88`, verbatim). Pure, sync, zero-dep, `0..1`, never NaN, never throws:**

```javascript
function lexicalOverlap(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 0.0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  if (union === 0) return 0.0;
  return inter / union;
}
```

Its `LEXICAL_METHOD = 'jaccard-v1'` tag (`:5`) versions the metric; the header says to bump it if `STOPWORDS` or the tokenize rules change. **The MMR pass must not touch either.** The `textOf` projection feeding it should be `command + jtbd_label + framework` (LOCAL handles, no user prose, Part-8 clean).

---

### NEW `lib/core/doctor/eureka-fts-health-module.cjs` (doctor module, CRUD read)

**Analog: `lib/core/doctor/room-graph-density-module.cjs`. Exact match: same question shape (per-registered-room room.db census), same read-only constraint, check-only.**

**The contract header (`:12-27`, verbatim). Both clauses bind 244: check-only with no `fix` export, and the READ-ONLY door:**

```javascript
 * Contract: check(ctx) -> { status:'ok'|'skip', detail, rooms, totals }. There is
 * NO fix(ctx) and no `fix` export of any kind -- a count is check-only, there is
 * nothing to repair about a measurement, and contract-parity rule 8 fails the
 * suite if a fix_supported:false module exports one.
 *
 * Canon Part 9: room.db is reached ONLY through the navigation chokepoint. This
 * module uses openRoomDbReadOnlyForCaller (Phase 232.1's new read-only sibling
 * door), NEVER openRoomDbForCaller. That is D-04's central correction: the older
 * door delegates to room-db.cjs::openRoomDb, which mkdirSync's .mindrian/, runs
 * 13 CREATE-TABLE-IF-NOT-EXISTS clauses and 5 migrations on EVERY open ...
 * This module must never mutate what it measures, so it opens read-only and lets
 * SQLite reject writes mechanically.
```

The read-only door matters more here than anywhere: a doctor check that measures "does `eureka_fts` exist" must not be the thing that creates it.

**The sweep body (`:128-178`, verbatim) - copy structurally, replacing `countTable(db,'nodes'/'edges')` with a `sqlite_master` probe for `eureka_fts` plus a row count:**

```javascript
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      rooms: [],
      totals: { rooms: 0, nodes: 0, edges: 0 },
    };
  }
  ...
  for (const name of Object.keys(rooms)) {
    let db = null;
    try {
      // Inside the try on purpose (T-232.1-02): a malformed registry entry must
      // soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      db = openRoomDbReadOnlyForCaller(roomPath);
      if (!db) {
        // D-05: no room.db yet is the NORMAL Tier 0 case, not an error.
        out.push({ room: name, node_count: 0, edge_count: 0, has_db: false });
        continue;
      }
      ...
    } catch (_e) {
      // T-232.1-03 / T-217-01 self-DoS guard: one bad room never aborts the sweep.
      out.push({ room: name, node_count: 0, edge_count: 0, has_db: false, unreadable: true });
    } finally {
      closeRoomDbForCaller(db);
    }
  }
```

**The "failed query means no rows" idiom (`:120-126`, verbatim), directly reusable for the FTS row count on a db where the table is absent:**

```javascript
function countTable(db, table) {
  try {
    return db.prepare('SELECT count(*) AS c FROM ' + table).get().c;
  } catch (_e) {
    return 0;
  }
}
```

**`resolveRoomPath` (`:105-117`) is copied verbatim between doctor modules already** (`graph-derive-health-module.cjs:110` says so explicitly). Copy it again; that is this directory's established convention, since `room-graph-density-module.cjs` does not export it.

**Status vocabulary caution (`:174-176`, verbatim).** 232.1 D-06 forbids `'warn'` for a pure measurement:

```javascript
  return {
    // NEVER 'warn' (D-06). The sweep completed; the numbers are the report.
    status: 'ok',
```

244's module is a HEALTH check, not a census, so `'warn'` when the index is absent IS appropriate here (the `graph-derive-health-module.cjs` precedent, which warns on "BELONGS_TO present with zero cascade edges"). State that difference in the header so the next reader does not read D-06 as universal.

**Registration (`data/doctor-modules.json:148-160`, verbatim - append one object of this exact shape):**

```json
    {
      "id": "graph-derive-health",
      "introduced_version": "1.15.3-beta.49",
      "cadence": "always",
      "flag": "graphDeriveHealth",
      "fix_supported": true,
      "runner": "lib/core/doctor/graph-derive-health-module.cjs",
      "description": "Semantic-edge derivation health per room (RCA 4d): ..."
    },
```

`flag: null` (like `room-graph-density`) if no dedicated CLI flag is wanted; a non-null flag also requires a `flags` entry and an `--<flag>` parse branch in `scripts/doctor.cjs` (see `:271`).

---

### MODIFY `scripts/doctor.cjs` (the `--acceptance` point)

**Analog: the Class S `eureka-smoke-stack-ready` point at `:1437-1493`. Nearest in domain (it is the OTHER eureka acceptance point) and the newest, so it reflects current conventions.**

**The entry shape (`:1451-1461`, verbatim):**

```javascript
      id: 'eureka-smoke-stack-ready',
      label: 'Class S: local eureka embedding stack ready (deps, vec backend, model cache, graceful degrade)',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'eureka-smoke-stack-ready') {
          return { ok: false, finding: 'eureka-smoke-stack-ready synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_EUREKA_SMOKE === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_EUREKA_SMOKE=1' } };
        }
```

Three conventions to copy: the `DOCTOR_TEST_FAIL_POINT` synthesized-failure seam (the acceptance suite uses it to prove the point can go red), the `DOCTOR_SKIP_*` hermetic-CI opt-out, and the `applies_to` tier list.

**The return contract (`:1478-1491`, verbatim) - `{ ok, finding, detail }`, with the finding naming the FIRST specific failure, never a generic string:**

```javascript
          if (payload.ok !== true) {
            const firstFail = payload.layers.find(function (l) { return l && !l.ok; });
            return {
              ok: false,
              finding: 'eureka stack not ready: ' + (firstFail ? (firstFail.name + ' -- ' + firstFail.reason) : 'unknown layer'),
              detail: { layers: payload.layers },
            };
          }
          return { ok: true, finding: null, detail: { layers: payload.layers.map(function (l) { return { id: l.id, ok: l.ok }; }) } };
        } catch (e) {
          return { ok: false, finding: 'eureka-smoke-stack-ready threw: ' + e.message, detail: {} };
        }
```

**Severity call the plan must make.** Class S uses `severity: 'blocker'`, which fails the release. An absent `eureka_fts` is the DEFAULT state of every existing room today, so a blocker would fail every release until every room is rebuilt. Recommend a non-blocking severity for 244's point, with the reason stated. The whole purpose per Pitfall 2 is visibility, not a gate.

**Do NOT add a spawn.** The Class S point spawns `doctor --eureka-smoke --json` against itself because it needs a separate process for model loading. 244's check is a `sqlite_master` read; call the module's `check()` directly, the way the cheaper points do.

---

### NEW `tests/test-244-*.cjs` and `tests/run-all-244.sh`

**Analog for the FTS legs: `tests/test-219-fts5-degrade.cjs` + `tests/helpers/fixture-room-219.cjs` (exports `buildFixtureRoom`). Reuse the fixture; do not author a second FTS fixture (Part 7).**

**The offline preload that makes the whole file hermetic (`test-219-fts5-degrade.cjs:33-34`, verbatim). Every 244 test that touches the eureka surface needs it:**

```javascript
// Hermeticity: flip transformers.js allowRemoteModels=false so nothing here
// can reach the network when run standalone.
require('./eureka-offline-preload.cjs');
```

**The env-seam save/set/restore trio (`:56-65`, verbatim). This is how the forced-absent degrade leg is driven:**

```javascript
function setForced(on) {
  if (on) {
    process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
  } else {
    delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
  }
}

function restoreEnv() {
  setForced(ENV_FORCED_AT_START);
}
```

together with the probe reset (`:135`, verbatim) - **mandatory**, because `ensureFtsAvailable` memoizes its verdict once per process (`tri-modal-index.cjs:220-235`), so a test that flips the env without resetting measures the previous test's verdict:

```javascript
    tri._test.resetFtsProbe();
```

**The fixture db builder (`:84-97`, verbatim). Plain `DatabaseSync`, no `allowExtension`, a `nodes` table with two semantically separated clusters - exactly the shape Pitfall 3's relevant-vs-irrelevant assertions need:**

```javascript
function makeFixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-219-fts-'));
  const dbPath = path.join(dir, 'room.db');
  const db = new DatabaseSync(dbPath); // NO allowExtension -> cjs cosine fallback
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  ins.run('n1', 'Artifact', JSON.stringify({ title: 'circadian rhythm optimization', section: 'sleep-science' }));
  ...
  ins.run('n4', 'Artifact', JSON.stringify({ title: 'manufacturing shift scheduling', section: 'operations' }));
  return { db: db, dir: dir, dbPath: dbPath };
}
```

**The table probe the ghost-trigger test needs (`:104-107`, verbatim):**

```javascript
function hasTable(db, name) {
  const r = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
  return !!r;
}
```

**The async runner + `PASS`/`FAIL`/`FAILURES` harness (`:110-125`, verbatim). Use this variant (not the `ok`/`fail` variant) for the FTS tests, matching their analog:**

```javascript
let PASS = 0;
let FAIL = 0;
const FAILURES = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}
```

**The rebuild-reconcile leg has a different analog:** `tests/test-236-rebuild-preserves-journal.cjs` + `tests/helpers/fixture-room-236.cjs` (exports `buildFixtureRoom236`, `countPopulations`, `readStageHistory`, `readNodeRow`). Its `runRebuild(roomDir)` helper carries the signature trap worth copying verbatim, since `rebuildGraph` takes an OPEN conn as its FIRST argument:

```javascript
// rebuildGraph is `async function rebuildGraph(conn, roomDir, _visited)` and takes
// an OPEN DatabaseSync conn as its FIRST argument. Do NOT call rebuildGraph(roomDir).
```

**Aggregator: `tests/run-all-244.sh`.** Analog `tests/run-all-236.sh` (glob discovery, `run` / `run_may_skip`, the load-bearing `found -eq 0` guard). The full verbatim body is already transcribed in `.planning/phases/240-memory/240-PATTERNS.md` under "NEW `tests/run-all-240.sh`"; copy from there rather than re-deriving. `tests/run-all-219.sh` exists and must also stay green (this phase touches 219's surface).

---

## Shared Patterns

### Soft-fail-to-no-signal around every producer db read

**Source:** `lib/core/navigation-engine.cjs:889-906` and `lib/core/sensors/sensor-expert-skill.cjs:160-166` (both excerpted above). One `try` wrapping the entire read, `catch (_e)` degrading to the zero-signal default, never a rethrow.

**Apply to:** the content producer, the FTS reconcile guard, and the doctor module's per-room loop. `decide()` runs on every turn on all three surfaces; an exception escaping the ctx-assembly block breaks Larry's turn.

**With one named exception, which is this phase's Pitfall-1 obligation.** `lexicalSearch:429`'s blanket `catch { return []; }` makes malformed-query, missing-table, and genuine-zero-hit indistinguishable. The producer must carry a distinguishable state (at minimum `index_absent` from `tableExists`, separate from `hit_count === 0`) so a silent swallow cannot masquerade as a legitimate no-match. This is the `feedback_false_success_silent_skip_gates_academy_testers` bug class, and it is the exact symptom that opened this phase.

### Fail closed at module load on a frozen-bank drift

**Source:** `sensor-expert-skill.cjs:57-62` (excerpted above). A `throw` at require time, not a runtime check.

**Apply to:** the new sensor's `REACH_ID`. `REACH_IDS` is frozen at exactly six (`sensor-types.cjs:43-50`) with a drift contract; `POSTURE_IDS` at three (`:54-58`). `makeReach` returns `null` (never throws) on an invalid id (`:217-218`), so without the load-time throw a drift would present as a sensor that silently never fires.

### Caller-owned db handle; the callee never opens room.db

**Source:** `sensor-expert-skill.cjs:146-148` (verbatim):

```javascript
 * @param {object} db   -- a caller-owned room.db handle (opened upstream; this
 *                         helper NEVER opens room.db itself, mirroring
 *                         rankExpertsForSlot's caller-owned-handle contract)
```

and `navigation-engine.cjs:878-879`: *"The engine does not OPEN room.db; it uses a caller-threaded handle (ctx.roomDb)."*

**Apply to:** the content producer and every helper it calls. The doctor module is the ONE exception, and it opens through the read-only door (`openRoomDbReadOnlyForCaller`), never `openRoomDb`.

### Caller-threaded ctx scalar overrides are the test seam

**Source:** `navigation-engine.cjs:907-916` (excerpted above): `sensorCtx.X = (ctx.X === true) || computed`.

**Apply to:** every scalar the content producer writes onto `sensorCtx`. This is what lets a unit test fire the new sensor with no db, no FTS index, and no fixture at all - which is the difference between a fast pure test and a slow integration one.

### Part 8: closed scalars on the reach, the WHICH resolved locally at the gate

**Source:** `sensor-expert-skill.cjs:39-42` (verbatim):

```javascript
 * Canon Part 8: the reach evidence carries CLOSED scalars only (candidate count,
 *   invocation max, tier-signal boolean) -- never a node id, name, or prose. The WHICH
 *   (the specific expert) is resolved LOCALLY at the gate from the producer's candidate
 *   list, never ridden on the reach.
```

**Apply to:** the content sensor's evidence bag. `hit_count`, a coverage scalar, and `trigger_tier: 'content'` may ride. Matched text, turn prose, and the `node_id` list may not; they stay on `sensorCtx.contentCandidates` for the gate handler. Note `sensor-eureka.cjs:38-42` permits opaque node-id HANDLES on evidence for the eureka bridge; that is a per-sensor call the plan should make deliberately rather than by copy-paste.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| The greedy MMR selection loop itself | ranker (algorithm) | transform | Nothing in the repo does diversity reranking. `_applySens10Flip` is a partition-and-concat, not a greedy argmax over a shrinking pool. The layered-pass ENVELOPE has an exact analog (`:596-615`); the loop BODY does not. Author it from `244-RESEARCH.md` Pattern 4, using the canonical Carbonell orientation (`lambda*Rel - (1-lambda)*maxSim`, lambda = relevance weight) and naming the constant `MMR_LAMBDA_RELEVANCE`. ROADMAP SC3 states the formula INVERTED; it is algebraically equivalent but the knob semantics flip, so the plan must name the discrepancy in a comment and ask the navigator to amend SC3's one line. |
| A production build/refresh lifecycle for `eureka_fts` | service | batch | **BLOCKER B-2, and genuinely without precedent.** `indexNodes`'s only three callers are manual report scripts (`scripts/entity-extract.cjs:924`, `scripts/eureka-room-report.cjs:304`, `scripts/eureka-portfolio-report.cjs`); there is no session-start build and no entry in the `room-db.cjs` migration chain. No existing subsystem lazily builds a derived index on a turn, so there is no "copy this" answer. The nearest shapes are (a) `sensor-eureka.cjs`'s side-channel-file-written-by-a-prior-scan model, and (b) the doctor module's visibility-instead-of-silence model. The plan must pick one of Pitfall 2's three costed options explicitly and record the choice; it cannot be inherited from an analog. |
| `TRIG_RRF_K` / `TRIG_MMR_LAMBDA` documentation | docs | n/a | `docs/ENV-TUNING.md` has no ranker or dial section today. The env-RESOLUTION idiom has an exact analog (`resolveRrfK`, `hybrid-retrieve.cjs:68-77`); only the doc section is new. |

---

## Metadata

**Analog search scope:** `lib/core/sensors/`, `lib/core/eureka/`, `lib/core/doctor/`, `lib/core/` (navigation-engine, insight-sensors, lazygraph-ops), `lib/workflow/`, `scripts/`, `data/`, `tests/`, `tests/helpers/`

**Files read from disk (14):** `lib/core/sensors/sensor-expert-skill.cjs`, `lib/core/sensors/sensor-types.cjs`, `lib/core/sensors/sensor-eureka.cjs`, `lib/core/navigation-engine.cjs` (`:810-929`), `lib/core/insight-sensors.cjs` (`:340-370`, `:435-450`, `:680-760`), `lib/core/lazygraph-ops.cjs` (`:55-175`, `:660-750`), `lib/core/eureka/tri-modal-index.cjs` (`:181-240`, `:290-350`, `:390-467`), `lib/core/eureka/hybrid-retrieve.cjs` (`:1-118`), `lib/core/eureka/lexical-overlap.cjs`, `lib/workflow/f-selector-ranker.cjs` (`:500-780`), `lib/core/doctor/room-graph-density-module.cjs`, `scripts/doctor.cjs` (`:1430-1500`), `scripts/check-substrate.cjs` (`:40-90`), `data/doctor-modules.json` (`:130-175`), `tests/test-219-fts5-degrade.cjs` (`:1-140`)

**Repo-wide greps run:** `=== 'keyword'|!== 'keyword'|isContextTier` across `lib/ scripts/ tests/`; `clearIndexerOwnedRows|BEGIN|COMMIT|ROLLBACK|function rebuildGraph` in `lazygraph-ops.cjs`; `room-graph-density-module` across the repo; `acceptance|eurekaSmoke|Class S` in `scripts/doctor.cjs`; `tests/ -name 'test-219*|*fts*'`; `tests/helpers/` listing

**Pattern extraction date:** 2026-07-30
