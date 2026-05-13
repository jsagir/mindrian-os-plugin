---
phase: 110-brain-context-packet-contract
plan: "03"
subsystem: brain-context-packet
tags: [canon-part-8, canon-part-9, canon-part-3, canon-part-4, brain-wire-contract, sendPacket, ajv-middleware, schema-validator, navigation-api, dual-path-warning]
dependency_graph:
  requires:
    - "Phase 109 (navigation.cjs chokepoint + buildBrainPacket producer + storeBrainSuggestions ingestion)"
    - "Phase 110-00 (substrate -- requirements scaffolding for PACKET-110-03 / -04 / -08)"
    - "Phase 110-01 (data/brain-packet-schema.json -- the contract this plan validates against)"
    - "Phase 110-02 (buildBrainPacket emits origin + privacy_mode; EVENT_TYPES Set extended by 3 brain_* strings)"
  provides:
    - "lib/core/brain-client.cjs::sendPacket(packet, opts) -- the SOLE typed-packet wire path: D-08 layer-3 origin allowlist -> unknown-job guard -> ajv in-validation (reject hard, log brain_packet_rejected) -> POST tools/call name:'brain_packet' via existing callTool transport (degrade soft on missing-tool / transport error) -> ajv out-validation (reject hard, degrade soft, log brain_response_rejected) -> return validated out payload"
    - "lib/core/brain-client.cjs::_warnLegacyOnce(db) + _legacyPathWarned -- the D-10 forward-looking deprecation guard (no current call site; ships as a contract for v1.14.0 legacy-job-path deletion)"
    - "Module-scope lazy ajv middleware: Ajv2020 (draft 2020-12) with strict:false / allErrors:true; per-job (in, out) validator memoization in a Map; MINDRIAN_BRAIN_PACKET_SCHEMA env-var seam"
    - "lib/core/navigation.cjs::logMemoryEvent re-export -- a thin pass-through to navigation/memory-events.cjs::logEvent so brain-client.cjs can log the 3 brain_* events without reaching into the internal helper module"
    - "Test surface (_test block): _resetSchema, _setLegacyWarned, _validatorFor, _parseBrainResult, _looksLikeUnknownToolError, _ensureSchema, SHIPPED_JOBS exposed for the 110-05 per-job suite"
    - "opts.__transport test seam -- lets test fixtures inject a fake transport without require.cache surgery"
  affects:
    - "Phase 110-04 (the D-08 layer-2 pre-commit hook will grep for bare sendPacket( call sites not lexically preceded by buildBrainPacket(); the function now exists for the hook to defend)"
    - "Phase 110-05 (the per-job round-trip + Part-8 invariant suite consumes _test._validatorFor + opts.__transport; the suite currently RED is correct -- it is the next plan)"
    - "v1.14.0 (the _warnLegacyOnce guard + any future legacy job helper get deleted)"
tech_stack:
  added:
    - "ajv@8.18.0 via require('ajv/dist/2020') -- transitive through @modelcontextprotocol/sdk; NOT added to package.json (CLAUDE.md 'What NOT to Use' bundled-never-direct rule)"
    - "node:fs and node:path required at top of brain-client.cjs (replaces lazy in-function requires for ajv path resolution)"
  patterns:
    - "Module-scope lazy compile + memoized per-key validator (RESEARCH Pattern 1) -- ajv compile is expensive; do it once per (job, half)"
    - "Pitfall 1 snapshot: const errsSnapshot = (fn.errors || []).slice() IMMEDIATELY after a failing validate() -- ajv overwrites validate.errors on every call"
    - "Reject hard / degrade soft (D-07): bad in -> throw; bad out -> log + sentinel; transport problems -> sentinel (no log)"
    - "D-08 defense-in-depth, no crypto: schema enum (layer 1, lex stamp) + pre-commit hook (layer 2, lex grep, 110-04) + brain-client allowlist (layer 3, runtime, THIS PLAN)"
    - "Once-per-process flag idiom (mirrors checkFilePermissions._warned in the same file) for _warnLegacyOnce"
    - "Test seam via opts.__transport (a function arg) and the env-var MINDRIAN_BRAIN_PACKET_SCHEMA (path override) -- both avoid require.cache surgery in 110-05 tests"
key_files:
  created: []
  modified:
    - "lib/core/navigation.cjs (Task 1: +6 lines; added logMemoryEvent: memoryEvents.logEvent to module.exports; the 13 documented + 2 lifecycle-added re-exports byte-unchanged; node -c passes)"
    - "lib/core/brain-client.cjs (Task 2: +357/-5 lines; added require('node:fs') + require('node:path') at top; added the Phase 110-03 section: Ajv2020 import + SHIPPED_JOBS Set + _ensureSchema / _validatorFor / _resetSchema / _logEventBestEffort / _looksLikeUnknownToolError / _parseBrainResult helpers + _legacyPathWarned flag + _warnLegacyOnce + sendPacket; extended module.exports with sendPacket / _warnLegacyOnce + 6 new _test seams; cleaned 5 pre-existing em-dashes in unrelated JSDoc comments to satisfy the plan's hard hygiene constraint)"
decisions:
  - "Schema-shape correction discovered at execution time: the 110-01 schema's per-job $defs are { in: {...}, out: {...} } -- NOT { properties: { in, out } } as the plan's interfaces sketch implied. So the JSON pointer is #/$defs/<job>/<half>, not /properties/<half>. The 110-01 schema itself is correct as shipped; the plan-sketch was off by one path component. Reported as deviation [Rule 1 - planner sketch path correction]."
  - "ajv@8.x deep JSON-pointer quirk: ajv cannot resolve a pointer like 'absolute-URI#/$defs/job/in' against a schema indexed only by absolute $id. Worked around by compiling per-(job, half) wrapper schemas that carry the root's $defs inline (the schema is small; this is essentially a no-op memory cost and ajv compiles cleanly). Same Ajv2020 class as the 110-01 --check build script."
  - "MINDRIAN_BRAIN_PACKET_SCHEMA env-var seam reused from 110-01's build script -- same precedence (env-var overrides default path); lets 110-05's tests swap in a fixture schema and reset via _test._resetSchema()."
  - "Brain-side null result (no API key, non-OK HTTP, callTool returns null) is treated as a brain_unreachable soft-degrade (no log) -- functionally identical to a transport throw; the plan does not enumerate the null case explicitly so this disposition was added by inspection of callTool's contract. Distinct from the unknown-tool soft-degrade (which the schema-shape grep idiom detects in result.text)."
  - "_logEventBestEffort uses lazy require('./navigation.cjs') inside its body (not at module top) to keep brain-client.cjs robust against a future circular-load between brain-client.cjs and navigation.cjs. Today there is no cycle (navigation.cjs does not require brain-client.cjs), but the defensive idiom costs nothing."
  - "The plan said _test block should expose the helpers; added all 6 (_resetSchema, _setLegacyWarned, _validatorFor, _parseBrainResult, _looksLikeUnknownToolError, _ensureSchema) plus SHIPPED_JOBS so the 110-05 per-job suite can iterate the closed vocabulary without re-importing the schema."
metrics:
  duration_seconds: 2313
  duration_human: "38m 33s"
  tasks_completed: 2
  files_modified: 2
  files_created: 0
  completed_date: "2026-05-13"
  tests_added: 0
  tests_total_after: "16/16 (packet-builder) + 10/10 (memory-events) + 1/1 (acceptance) + 8/8 (part8-leak) + 6/6 (schema-check) -- all PASS; 110-04 + 110-05 stubs remain correctly RED"
  lines_added_brain_client: 357
  lines_removed_brain_client: 5
  lines_added_navigation: 6
  ajv_in_package_json: false
  em_dashes_remaining: 0
---

# Phase 110 Plan 03: Brain Context Packet Wire Enforcement Summary

**One-liner:** Ship `lib/core/brain-client.cjs::sendPacket(packet, opts)` as the SOLE typed-packet wire path with module-scope lazy `Ajv2020` middleware -- D-08 layer-3 origin allowlist before unknown-job guard before ajv in-validation (reject hard, log `brain_packet_rejected`) before `tools/call name:'brain_packet'` via the existing `callTool` transport (degrade soft on missing-tool / transport error / null result) before ajv out-validation (reject hard, degrade soft, log `brain_response_rejected`, never throw, never partial-ingest) before returning the validated `out` -- plus the `_warnLegacyOnce(db)` D-10 forward-looking deprecation guard with no current call site, plus `navigation.cjs`'s 14th re-export `logMemoryEvent` so brain-client can emit the 3 brain_* events without reaching into the internal `memory-events.cjs`.

## What Shipped

### Task 1 -- `logMemoryEvent` re-export on `navigation.cjs`

**File:** `lib/core/navigation.cjs` (modified, +6 lines)

Added a single re-export to `module.exports`:

```javascript
  // Memory-event logging (Phase 110-03 -- a thin re-export so brain-client.cjs can log the
  //   brain_packet_rejected / brain_response_rejected / brain_legacy_path_used events without
  //   reaching into the internal navigation/memory-events.cjs. The closed navigation surface is
  //   the DOCUMENTED 13-function API; the implementation re-exports internal helpers as needed.)
  logMemoryEvent: memoryEvents.logEvent,
```

`memoryEvents` is already required at the top of the file as `const memoryEvents = require('./navigation/memory-events.cjs');`. The signature is `logEvent(db, eventType, payload)`; it returns `{ ok: true, eventId }` on success and `{ ok: false, reason: 'invalid_event_type' }` if `eventType` is not in the frozen `EVENT_TYPES` Set (Phase 110-02 added the 3 brain_* strings to that Set; this re-export is the consumer-facing surface).

The 13 documented exports (plus the 2 lifecycle additions `findRelevantOpportunities` from 109-05 and `findSurfaceableTensions` from 116-01) are byte-unchanged. `node -c lib/core/navigation.cjs` passes.

**Commit:** `6bd6676 feat(110-03): add logMemoryEvent re-export to navigation.cjs`

### Task 2 -- `sendPacket` + ajv middleware + `_warnLegacyOnce` on `brain-client.cjs`

**File:** `lib/core/brain-client.cjs` (modified, +357 / -5 lines)

#### 2a. ajv module-scope middleware

```javascript
const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');

const _BRAIN_PACKET_SCHEMA_PATH = process.env.MINDRIAN_BRAIN_PACKET_SCHEMA
  || path.join(__dirname, '..', '..', 'data', 'brain-packet-schema.json');

const SHIPPED_JOBS = new Set([
  'select_methodology', 'suggest_next_move', 'detect_contradiction',
  'summarize_neighborhood', 'classify_room_budding', 'rank_assumptions',
  'generate_feynman_explanation', 'strengthen_minto', 'prepare_investor_brief',
  'opportunity_react', 'opportunity_reflect', 'opportunity_rank',
]);

let _ajv = null;
let _schemaRaw = null;
const _jobValidators = new Map();

function _ensureSchema() { /* lazy load + parse + addSchema once */ }
function _validatorFor(job, half) {
  _ensureSchema();
  let pair = _jobValidators.get(job);
  if (!pair) { pair = {}; _jobValidators.set(job, pair); }
  if (!pair[half]) {
    pair[half] = _ajv.compile({
      $id: 'urn:mindrian:brain-packet:' + job + ':' + half,
      $ref: '#/$defs/' + job + '/' + half,
      $defs: _schemaRaw.$defs,
    });
  }
  return pair[half];
}
function _resetSchema() { _ajv = null; _schemaRaw = null; _jobValidators.clear(); }
```

Notes:

- `Ajv2020` (draft 2020-12) is the right class -- the 110-01 schema uses `"$schema": "https://json-schema.org/draft/2020-12/schema"`. The same class is used in `scripts/build-brain-packet-schema.cjs` (the 110-01 build/check tripwire).
- `strict: false` at runtime per `RESEARCH "Common Pitfalls" 2`: a hand-maintained schema may contain benign constructs strict-mode would refuse at compile time. The `strict: true` build gate sits in the 110-01 build script -- this is the runtime gate.
- `allErrors: true` per Pattern 1 in RESEARCH -- a packet rejection enumerates every violation, not just the first.
- `removeAdditional` is NOT set: the schema's `additionalProperties: false` REJECTS extras, never strips them (the Part 8 leak-prevention teeth -- a packet that carries a `transcript` field is REFUSED at the wire, not stripped-and-sent).
- The schema path resolves to the absolute path `data/brain-packet-schema.json` from the file's `__dirname`. The `MINDRIAN_BRAIN_PACKET_SCHEMA` env-var seam matches what 110-01's build script uses, so 110-05's tests can swap in a fixture schema and reset via `_test._resetSchema()`.

#### 2b. Helpers

```javascript
function _logEventBestEffort(db, eventType, payload) {
  if (!db) return;
  try { require('./navigation.cjs').logMemoryEvent(db, eventType, payload || {}); }
  catch (_e) { /* best-effort */ }
}

function _looksLikeUnknownToolError(result) {
  // detects: 'unknown tool' / 'no such tool' / 'method not found' / -32602 /
  //          'brain_packet' + 'not' / 'tool not found' -- liberal per D-04
  if (!result) return false;
  let t = '';
  if (typeof result === 'string') t = result;
  else if (typeof result === 'object') t = result.text || result.error || JSON.stringify(result);
  const s = String(t).toLowerCase();
  return s.includes('unknown tool')
    || s.includes('no such tool')
    || s.includes('method not found')
    || s.includes('-32602')
    || (s.includes('brain_packet') && (s.includes('not') || s.includes('unknown')))
    || s.includes('tool not found');
}

function _parseBrainResult(result) {
  // unwrap MCP content-array OR plain-object OR { text: '<json>' } -> response object
  if (Array.isArray(result)) {
    for (const item of result) {
      if (item && item.type === 'text' && typeof item.text === 'string') {
        try { return JSON.parse(item.text); } catch (_) { /* fall through */ }
      }
    }
    return { suggestions: [] };
  }
  if (result && typeof result === 'object') {
    if (typeof result.text === 'string' && !result.job_id && !result.suggestions) {
      try { return JSON.parse(result.text); } catch (_) { return { suggestions: [] }; }
    }
    return result;
  }
  if (typeof result === 'string') {
    try { return JSON.parse(result); } catch (_) { return { suggestions: [] }; }
  }
  return { suggestions: [] };
}
```

`_parseBrainResult` is broader than the planner's sketch because `callTool` in this codebase returns *parsed JSON* directly (the SSE parse + JSON.parse inside `callTool`), not the raw MCP content array -- but tests inject the raw content-array shape (per the `__transport` seam below), so both must work.

#### 2c. `_warnLegacyOnce` (D-10 forward-looking guard)

```javascript
let _legacyPathWarned = false;

function _warnLegacyOnce(db) {
  if (_legacyPathWarned) return;
  _legacyPathWarned = true;
  console.warn('[mindrian-os] legacy free-form Brain job call detected. '
    + 'Migrate to brain-client.sendPacket() -- the legacy job path is removed in v1.14.0.');
  _logEventBestEffort(db, 'brain_legacy_path_used', { source_path: 'system:brain-legacy' });
}
```

As of v1.13.0-beta.3 there is **NO** legacy free-form Brain *job* call site -- the comment block on `_warnLegacyOnce` documents this. The guard ships as a contract: if a free-form job helper is ever added before v1.14.0, it MUST call `_warnLegacyOnce()` first; in v1.14.0 both the helper and this guard are deleted.

The once-per-process flag idiom mirrors `checkFilePermissions._warned` (the existing pattern in the same file). `query()` / `write()` / `search()` / `schema()` / `callTool()` / `ask()` / `stats()` are NOT "legacy" -- raw-Cypher methodology lookups carry only generic handles (framework names, phase identifiers, problem-type enums) and are Part-8-clean by construction; they are PERMANENT.

#### 2d. `sendPacket` -- the core function

```javascript
async function sendPacket(packet, opts) {
  const o = opts || {};

  // (1) D-08 layer 3 -- runs FIRST so a caller who bypassed ajv still gets caught.
  if (!packet || typeof packet.origin !== 'string') {
    throw new Error('brain packet missing origin (D-08): packets must come from buildBrainPacket');
  }
  if (packet.origin === 'test_fixture' && process.env.MINDRIAN_TEST_MODE !== '1') {
    throw new Error('brain packet origin "test_fixture" only valid when MINDRIAN_TEST_MODE=1');
  }
  if (packet.origin !== 'navigation_api' && packet.origin !== 'test_fixture') {
    throw new Error('brain packet origin "' + packet.origin
      + '" not in the closed allowlist (D-08): navigation_api | test_fixture');
  }

  // (2) Unknown-job guard.
  if (!SHIPPED_JOBS.has(packet.job)) {
    throw new Error('brain packet: unknown job "' + packet.job
      + '" (not in the D-02 closed vocabulary)');
  }

  // (3) in-validation -- reject hard.
  const inFn = _validatorFor(packet.job, 'in');
  if (!inFn(packet)) {
    const errsSnapshot = (inFn.errors || []).slice();   // Pitfall 1: snapshot immediately
    const errStr = errsSnapshot
      .map(function (e) { return (e.instancePath || '(root)') + ' ' + (e.message || ''); })
      .join('; ');
    _logEventBestEffort(o.db, 'brain_packet_rejected', {
      job: packet.job, errors: errsSnapshot.length, source_path: 'system:brain-packet',
    });
    throw new Error('brain packet rejected for job "' + packet.job + '": ' + errStr);
  }

  // (4) Build the wire envelope + POST. Reuse callTool's transport. Tests inject opts.__transport.
  const transport = (typeof o.__transport === 'function') ? o.__transport : callTool;
  let result;
  try { result = await transport('brain_packet', { packet: packet }); }
  catch (_e) { return { advice: null, reason: 'brain_unreachable' }; }
  if (result == null) return { advice: null, reason: 'brain_unreachable' };
  if (_looksLikeUnknownToolError(result)) {
    return { advice: null, reason: 'brain_packet_tool_absent' };  // D-04 graceful degrade; NO log
  }

  // (5) out-validation -- reject hard but degrade soft.
  const parsed = _parseBrainResult(result);
  const outFn = _validatorFor(packet.job, 'out');
  if (!outFn(parsed)) {
    const errsSnapshot = (outFn.errors || []).slice();
    _logEventBestEffort(o.db, 'brain_response_rejected', {
      job: packet.job, errors: errsSnapshot.length, source_path: 'system:brain-packet',
    });
    return { advice: null, reason: 'response_schema_invalid' };  // NEVER throw; NEVER partial-ingest
  }

  // (6) Success.
  return parsed;
}
```

#### 2e. `module.exports` extension

```javascript
module.exports = {
  isAvailable, getApiKey, callTool, query, write, search, smartSearch, ask,
  schema, stats, enrichCausalEdges, hatAwareRecommend, suggestValidationSteps,
  getFrameworkChain,
  // Phase 110-03 (Brain Context Packet Contract wire-level enforcement):
  sendPacket,
  _warnLegacyOnce,
  _test: {
    sanitizeCypherInput, checkFilePermissions, sessionCache, SESSION_TTL_MS,
    _hashKey, _ensureSession,
    // Phase 110-03 test seam:
    _resetSchema, _validatorFor, _parseBrainResult, _looksLikeUnknownToolError,
    _ensureSchema, SHIPPED_JOBS,
    _setLegacyWarned: function (v) { _legacyPathWarned = !!v; },
  },
};
```

`query` / `write` / `search` / `smartSearch` / `schema` / `stats` / `ask` / `callTool` / `isAvailable` / `getApiKey` / `enrichCausalEdges` / `hatAwareRecommend` / `suggestValidationSteps` / `getFrameworkChain` are byte-unchanged in behavior; the existing `_test` block adds 7 new test seams.

**Commit:** `8b9e326 feat(110-03): add sendPacket + ajv middleware + _warnLegacyOnce to brain-client`

## Verified Behaviors

The plan's automated verification block executed all 14 cases:

| # | Case | Result | Telemetry |
|---|------|--------|-----------|
| 1 | `packet.origin = 'forged'` | throws (D-08 layer 3) | (no log) |
| 2 | `packet.origin` missing | throws (D-08 layer 3) | (no log) |
| 3 | `origin: 'test_fixture'` + `MINDRIAN_TEST_MODE != 1` | throws | (no log) |
| 4 | `origin: 'test_fixture'` + `MINDRIAN_TEST_MODE = 1` | proceeds | -- |
| 5 | `job: 'not_a_real_job'` | throws (unknown-job) | (no log) |
| 6 | malformed `in` (extra `transcript` field) | throws `brain packet rejected for job "..."` | `brain_packet_rejected` logged |
| 7 | `brain_packet` tool absent (`text: 'Error: unknown tool brain_packet'`) | `{ advice: null, reason: 'brain_packet_tool_absent' }` | (no log) |
| 8 | transport throws (ECONNREFUSED) | `{ advice: null, reason: 'brain_unreachable' }` | (no log) |
| 9 | transport returns `null` | `{ advice: null, reason: 'brain_unreachable' }` | (no log) |
| 10 | off-spec `out` payload | `{ advice: null, reason: 'response_schema_invalid' }`, NEVER throws, NEVER partial-ingests | `brain_response_rejected` logged |
| 11 | good `out` payload (content-array shape) | returns parsed `{ job_id, suggestions: [...] }` | -- |
| 12 | good `out` payload (plain-object shape) | returns parsed object | -- |
| 13 | `_warnLegacyOnce(db)` twice | `console.warn` fires exactly once | `brain_legacy_path_used` logged exactly once |
| 14 | re-arming via `_test._setLegacyWarned(false)` | next call warns again | -- |

## Regression Sweep

| Suite | Before | After |
|-------|-------:|------:|
| `tests/test-navigation-packet-builder.cjs` | 16/16 | 16/16 |
| `tests/test-navigation-memory-events.cjs` | 10/10 | 10/10 |
| `tests/test-navigation-packet-part8-leak.cjs` | 8/8 | 8/8 |
| `tests/test-navigation-acceptance.cjs` | 1/1 | 1/1 |
| `tests/test-brain-packet-schema-check.cjs` | 6/6 (19 asserts) | 6/6 (19 asserts) |
| `lib/memory/brain-cache-lru.test.cjs` | all passed | all passed |
| `lib/memory/brain-client-query-shape.test.cjs` | 6/6 | 6/6 |
| `lib/memory/brain-derivation.test.cjs` | 18/18 | 18/18 |
| `lib/memory/security-trifecta.test.cjs` | 22/0 | 22/0 |
| `tests/test-brain-packet-validation-per-job.cjs` | RED (110-05 stub) | RED (110-05 stub, unchanged -- correct, that plan fills it) |
| `tests/test-brain-packet-part8-invariant-per-job.cjs` | RED (110-05 stub) | RED (110-05 stub, unchanged) |
| `tests/test-brain-packet-precommit-hook.cjs` | RED (110-04 stub) | RED (110-04 stub, unchanged) |

The 110-04 + 110-05 RED stubs are CORRECT: this plan is 110-03; those plans will fill the stubs.

## Soft-Degrade Reasons (Canonical Set)

A successful `sendPacket` returns the validated Brain `out` object. A soft-degrade returns `{ advice: null, reason: '<REASON>' }` where `<REASON>` is one of:

| Reason | Cause | Logged? |
|--------|-------|---------|
| `brain_unreachable` | Transport throw (network / timeout) OR `callTool` returned `null` (no API key / non-OK HTTP) | No |
| `brain_packet_tool_absent` | Brain returned an "unknown tool" / -32602 / 404-ish error (D-04 graceful degrade -- the contract handler is absent, NOT a bad response) | No |
| `response_schema_invalid` | Brain returned a response that failed ajv `out` validation (a bad response IS a Part 9 problem -- log it) | `brain_response_rejected` via `logMemoryEvent` when `opts.db` is present |

Throws are reserved for **OUR** code errors: bad origin (D-08 layer 3), unknown job, or a malformed `in` packet (a programmer error in OUR code). `brain_packet_rejected` is logged before the throw when `opts.db` is present.

## `__transport` Test Seam

```javascript
const r = await brainClient.sendPacket(packet, {
  db,
  __transport: async (toolName, args) => {
    // toolName is always 'brain_packet'
    // args is { packet: <the validated input> }
    return [{ type: 'text', text: JSON.stringify({ job_id: 'x', suggestions: [...] }) }];
    // OR: return { text: 'Error: unknown tool brain_packet' };
    // OR: throw new Error('ECONNREFUSED');
    // OR: return null;
  },
});
```

The `__transport` field is the documented test seam for 110-05's per-job round-trip suite. It avoids `require.cache` surgery (the brain-derivation test idiom) and keeps the test file purely functional. When `opts.__transport` is undefined, `sendPacket` falls back to `callTool` (the real wire path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - planner sketch path correction] JSON pointer for per-job sub-schema is `#/$defs/<job>/<half>`, not `#/$defs/<job>/properties/<half>`**

- **Found during:** Task 2 (`_validatorFor` compile)
- **Issue:** The plan's `<interfaces>` block, RESEARCH "Architecture Patterns Pattern 1", and the PACKET-110-03 requirement string all describe the per-job sub-schema pointer as `'#/$defs/' + job + '/properties/' + half`. The actual schema shipped by 110-01 has per-job `$defs` shaped `{ in: {...}, out: {...} }` -- NOT `{ properties: { in, out } }`. So the correct JSON pointer is `'#/$defs/' + job + '/' + half`.
- **Fix:** Built `_validatorFor` against the actual schema shape. The 110-01 schema itself is correct (matches the `$defs` structure that `test-brain-packet-schema-check.cjs` validates with 19 assertions); only the planner sketch was off by one path component.
- **Files modified:** `lib/core/brain-client.cjs` (`_validatorFor` body)
- **Commit:** `8b9e326`
- **Impact:** None on the contract. The schema-shape correction is internal to the validator-compile step. Documented here so future readers do not chase a phantom `/properties/<half>` path.

**2. [Rule 3 - ajv@8 deep-pointer quirk] Wrapper schemas carry inlined `$defs` to work around an ajv@8 limitation**

- **Found during:** Task 2 (`_validatorFor` compile)
- **Issue:** ajv@8.18.0 cannot resolve a deep JSON pointer (`#/$defs/<job>/<half>`) into a schema that was indexed only by its absolute HTTPS `$id`. Tested experimentally before writing the code: `ajv.getSchema('https://mindrian.ai/schemas/brain-packet/1.0#/$defs/select_methodology/in')` returns `undefined`; `ajv.compile({$ref: ...})` throws "can't resolve reference".
- **Fix:** Each call to `_validatorFor(job, half)` compiles a tiny wrapper:
  ```javascript
  {
    $id: 'urn:mindrian:brain-packet:<job>:<half>',
    $ref: '#/$defs/<job>/<half>',
    $defs: <root.$defs>   // carry the root's $defs inline
  }
  ```
  Cross-refs (`#/$defs/Origin`, `#/$defs/BrainResponse`, etc.) then resolve correctly because they are now relative to the wrapper's own `$id`. The wrappers are memoized in the `Map`, so this is a one-time cost per (job, half) pair (24 compiles total for 12 jobs x 2 halves).
- **Files modified:** `lib/core/brain-client.cjs` (`_validatorFor` body + JSDoc note)
- **Commit:** `8b9e326`
- **Impact:** None on the contract or memory cost (the `$defs` block is shared by reference, not deep-copied).

**3. [Rule 2 - plan hygiene constraint] Cleaned 5 pre-existing em-dashes in unrelated JSDoc comments**

- **Found during:** Task 2 final verification
- **Issue:** The plan's verification block requires `! grep -lP "[\x{2014}\x{2013}]" lib/core/brain-client.cjs`. 5 em-dashes existed in JSDoc comments unrelated to my changes (the original file header, the `query()` JSDoc, the SEC-01 JSDoc).
- **Fix:** Replaced 5 em-dashes with `--` per the global no-em-dashes rule (CLAUDE.md + the plan's "zero em-dashes in any file written" success criterion).
- **Files modified:** `lib/core/brain-client.cjs` (5 JSDoc lines)
- **Commit:** `8b9e326`
- **Impact:** No semantic change.

**4. [Rule 3 - completeness] Added `null` transport result as a `brain_unreachable` soft-degrade**

- **Found during:** Task 2 implementation
- **Issue:** The plan enumerates "transport throw -> `brain_unreachable`" and "unknown-tool result -> `brain_packet_tool_absent`" but does not enumerate "transport returns `null`" (which `callTool` does on no-API-key / non-OK HTTP).
- **Fix:** Treated `result == null` after a successful transport call as `brain_unreachable` (functionally identical to a throw). Distinct from `_looksLikeUnknownToolError` (which only fires on an error-shaped result, NOT on `null`).
- **Files modified:** `lib/core/brain-client.cjs` (`sendPacket` step 4)
- **Commit:** `8b9e326`
- **Impact:** Makes the soft-degrade complete -- without this, a missing API key + sendPacket call would have thrown a TypeError from `_parseBrainResult(null)`.

## Known Stubs

None. `sendPacket` is fully functional. The two test files that exist as RED stubs (`tests/test-brain-packet-validation-per-job.cjs`, `tests/test-brain-packet-part8-invariant-per-job.cjs`, `tests/test-brain-packet-precommit-hook.cjs`) are EXPECTED to be RED -- they are 110-04 and 110-05 deliverables, not 110-03. The plan's verification block explicitly says "the new Phase-110 stubs are still RED (correct -- 110-04 / 110-05 fill them)".

## What's Next

- **Phase 110-04** wires the D-08 layer-2 pre-commit hook: a grep-based check that fails any commit introducing a `brain-client...sendPacket(` call site not lexically preceded by a `buildBrainPacket(`. The hook test stub (`tests/test-brain-packet-precommit-hook.cjs`) is in place and RED.
- **Phase 110-05** fills the per-job validation suite: 12 jobs x in/out round-trip tests using `_test._validatorFor` + `opts.__transport`; the Part-8 forbidden-substring sweep over `JSON.stringify(buildBrainPacket(...))`; the privacy-mode sub-block; the dual-path-warning sub-block. Both `tests/test-brain-packet-validation-per-job.cjs` and `tests/test-brain-packet-part8-invariant-per-job.cjs` are RED stubs in place.

When the live Brain implements a `brain_packet` MCP tool, the existing `sendPacket` callers (none today; new consumers come in v1.13.0-beta.3 .. final) flip from `{ reason: 'brain_packet_tool_absent' }` soft-degrade to live Brain advice without any plugin code change -- the contract is the wire. D-04 graceful degrade is the design.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `6bd6676` | `feat(110-03): add logMemoryEvent re-export to navigation.cjs` |
| 2 | `8b9e326` | `feat(110-03): add sendPacket + ajv middleware + _warnLegacyOnce to brain-client` |

## Self-Check: PASSED

- `lib/core/navigation.cjs` exports `logMemoryEvent` (FOUND).
- `lib/core/brain-client.cjs` exports `sendPacket` + `_warnLegacyOnce` (FOUND).
- `_test` block exposes `_resetSchema`, `_setLegacyWarned`, `_validatorFor`, `_parseBrainResult`, `_looksLikeUnknownToolError`, `_ensureSchema`, `SHIPPED_JOBS` (FOUND).
- ajv NOT in `package.json` (`grep '"ajv"' package.json` returns nothing in deps).
- Zero em-dashes in `lib/core/navigation.cjs` + `lib/core/brain-client.cjs`.
- Commits `6bd6676` and `8b9e326` exist on `main`.
- 14 behaviors verified end-to-end.
- Regression sweep: 60+ existing tests still pass.

---

_Phase 110-03 -- Brain Context Packet Wire Enforcement -- shipped 2026-05-13._
