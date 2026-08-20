# Phase 259: Plugin-Side Gate Trust (parallel-safe, early) - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 6 (2 modified source, 1 modified test helper, 3 new test-infrastructure)
**Analogs found:** 6 / 6 (all excerpts below were re-read from disk this session, not taken
from RESEARCH.md prose)

RESEARCH.md's Verified Code Map (F-01..F-13) and Code Examples were used as the starting
point per the orchestrator's instruction. Every line-number citation it makes for the six
files below was independently confirmed against the live files. **Two corrections to
RESEARCH.md are recorded at the bottom of this document** -- neither changes a decision,
but both change what a new file should copy.

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `lib/core/brain-client.cjs` | modify | service (HTTP transport client) | request-response + bounded retry | itself: the 403 branch (`:520-538`) + the 5xx retry branch (`:547-550`) | exact (in-file precedent) |
| `scripts/build-brain-census.cjs` | modify | service (HTTP client) | request-response | itself: `brainCall`'s 7 existing failure returns (`:316`, `:333`, `:342`, `:346`, `:349`, `:357`, `:361`, `:367`, `:370`) | exact (in-file precedent) |
| `scripts/check-flagship-floor.cjs` | modify | utility (pure gate logic + CLI renderer) | batch / transform | itself: `evaluateFloor` (`:87-104`) + `main()`'s row renderer (`:176-187`) | exact (in-file precedent) |
| `tests/helpers/brain-capture-server.cjs` | modify (extend) | test fixture (mock HTTP server) | request-response | `tests/test-250-transport-retry.cjs:45-122` (`state.toolScript` + `nextToolMode` + method dispatch) | exact |
| `tests/test-259-brain-client-429.cjs` | NEW | test (integration, loopback mock) | request-response | `tests/test-250-transport-retry.cjs` (whole file) | exact |
| `tests/test-259-floor-void.cjs` | NEW | test (unit, pure fixtures, zero I/O) | transform | `tests/test-249-floor-gate.cjs` (whole file) | exact |
| `tests/run-all-259.sh` | NEW | config (verification aggregator) | batch | `tests/run-all-250.sh` (whole file) | exact |

---

## Pattern Assignments

### `lib/core/brain-client.cjs` (service, request-response + retry)

**Analog:** itself. The file already contains both halves of what the 429 branch needs: a
zero-retry status branch that mints a sentinel (403) and a retry-within-budget status branch
(5xx). Copy the shape of both, do not invent a third style.

**Constants + helpers pattern to REUSE (not to copy)** (`:40-63`, read this session):

```js
// four-class error taxonomy). Defensive numeric-env convention (repo-wide,
// e.g. BRAIN_REQUEST_TIMEOUT_MS above): an invalid override falls back to
// the default rather than throwing or disabling the feature silently.
const RETRY_MAX_DEFAULT = 2; // 2 retries = 3 attempts total.
const RETRY_BASE_MS_DEFAULT = 300; // 300ms, then 900ms (base * 3^attempt).

function _envNonNegativeInt(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  return (Number.isFinite(n) && n >= 0) ? Math.floor(n) : def;
}

function _retryMax() {
  return _envNonNegativeInt('MINDRIAN_BRAIN_RETRY_MAX', RETRY_MAX_DEFAULT);
}

function _retryBaseMs() {
  return _envNonNegativeInt('MINDRIAN_BRAIN_RETRY_BASE_MS', RETRY_BASE_MS_DEFAULT);
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Copy the SHAPE of `RETRY_MAX_DEFAULT` / `_retryMax()` into a parallel pair
(`RATE_LIMIT_RETRY_MAX_DEFAULT = 3` / `_rateLimitRetryMax()` reading
`MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX`, and `RATE_LIMIT_BASE_MS_DEFAULT = 500` /
`_rateLimitBaseMs()` reading `MINDRIAN_BRAIN_RATELIMIT_BASE_MS`). Call the EXISTING
`_envNonNegativeInt` and `_sleep` -- do not write second copies (F-02, Canon Part 7).
Also copy the comment convention: the constant carries its schedule inline as a trailing
comment (`// 500ms, then 1000ms, then 2000ms (base * 2^attempt)`).

**Retry-loop entry pattern** (`:474-482`) -- where the new `rlAttempt` counter is declared:

```js
    // Phase 250-01 (AVAIL-02): bounded retry loop around the tools/call
    // dispatch -- the single HTTP seam every Brain tool flows through after
    // session establishment. NULL CONTRACT PRESERVED: the retry changes WHEN
    // null returns (after the budget instead of after one attempt), never
    // WHAT returns null, and never which statuses map to which sentinels
    // (247-02 do-not-widen note; 82 degradation tests key on this).
    const retryMax = _retryMax();
    const baseMs = _retryBaseMs();
    for (let attempt = 0; ; attempt += 1) {
```

Add `let rlAttempt = 0;` alongside `const retryMax`/`const baseMs` at `:480-481`, OUTSIDE
the `for`, so it survives iterations. It must be a separate counter from `attempt` (a 5xx
blip earlier in the same call must not eat the 429 budget).

**Zero-retry sentinel branch to copy (the 403 block, `:511-538`)** -- this is the exact
structural template for the exhaustion return, including its header-comment style, its
own-body consumption, and the 300-char slice:

```js
      if (!toolRes.ok) {
        // Phase 247-02 (CONTRACT-01 error semantics): HTTP 403 means the Brain's
        // tier gate refused this tool on this key (a MoatViolation), NOT that the
        // Brain is unreachable. Mirrors the invalid_key sentinel precedent in
        // _ensureSession above -- a plain object returned through the promise,
        // never thrown, so callers that already understand sentinel passthrough
        // (query()'s {error:...} passthrough is the existing example) keep
        // working unchanged. 401/403 are validation-class -- ZERO retry, ever
        // (AVAIL-02: retrying an auth failure hammers auth, taxonomy-wrong).
        if (toolRes.status === 403) {
          let rawText = '';
          try { rawText = await toolRes.text(); } catch (_e) { rawText = ''; }
          let message = null;
          try {
            const parsedBody = JSON.parse(rawText);
            if (parsedBody && parsedBody.error && typeof parsedBody.error.message === 'string') {
              message = parsedBody.error.message;
            }
          } catch (_e) {
            // Unparseable body -- fall through to the raw-text fallback below.
          }
          if (!message) {
            message = rawText
              ? rawText.slice(0, 300)
              : 'Brain denied tier access (403, no body).';
          }
          return { error: 'tier_denied', tool: toolName, message: message };
        }
```

Pattern facts to carry into the 429 branch, in priority order:
1. **Insert the 429 block at line 539**, immediately after this closing `}` and BEFORE the
   shared drain at `:542`. The 403 branch establishes the "a status branch that needs the
   body consumes its own body" convention.
2. Sentinel objects are `return`ed, never `throw`n.
3. Property order convention: `error` first, then `tool`, then payload fields, then
   `message` last.
4. Every server-supplied string is length-capped before it enters a sentinel (`slice(0, 300)`).

**Retry-within-budget branch to copy (`:539-551`)** -- and the do-not-widen fence:

```js
        // Drain the body before bailing so undici releases the keep-alive socket
        // (see _ensureSession non-OK note: an un-drained socket is a live libuv
        // handle that asserts on Windows when a caller force-exits).
        try { await toolRes.arrayBuffer(); } catch (_) { /* body already gone */ }
        // 5xx is transport-class (transient) -- retryable within budget.
        // Every OTHER non-OK, non-retried status still returns null -- that
        // remains the sole transport-failure signal (research Pitfall 4: 82
        // degradation tests key on it; do not widen this branch).
        if (toolRes.status >= 500 && toolRes.status < 600 && attempt < retryMax) {
          await _sleep(baseMs * Math.pow(3, attempt));
          continue;
        }
        return null;
      }
```

The 429 branch copies the `await _sleep(...); continue;` idiom exactly. It must NOT modify
`:551`'s `return null` (the comment at `:543-546` is an explicit standing prohibition).

**Error-handling pattern (module-wide):** this file never throws to a caller. Every failure
resolves to either `null` (transport-class) or a `{ error: '<kind>', ... }` object. The outer
`catch` at `:572-576` returns `null`. New code must preserve this: no `throw`, no rejected
promise.

---

### `scripts/build-brain-census.cjs` (service, request-response)

**Analog:** itself. `brainCall` (`:294-382`) already has nine failure returns; the
`errorKind` field is added to each in place.

**Failure-return pattern to extend, verbatim from disk** (`:312-370`, abridged to the
distinct shapes -- all nine sites confirmed):

```js
  let res;
  try {
    res = await doCall();
  } catch (e) {
    return { ok: false, httpStatus: 0, bodyText: 'fetch failed: ' + (e && e.message ? e.message : String(e)) };
  }
...
        } catch (e) {
          return { ok: false, httpStatus: 0, bodyText: 'retry fetch failed: ' + (e && e.message ? e.message : String(e)) };
        }
...
      return { ok: false, httpStatus: res.status, bodyText };
...
  } catch (e) {
    return { ok: false, httpStatus: res.status, bodyText: 'body read failed: ' + (e && e.message ? e.message : String(e)) };
  }
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) {
    return { ok: false, httpStatus: res.status, bodyText: 'no SSE data line in response: ' + text.slice(0, 500) };
  }
  let parsed;
  try {
    parsed = JSON.parse(dataLine.slice(6));
  } catch (e) {
    return { ok: false, httpStatus: res.status, bodyText: 'unparsable SSE payload: ' + text.slice(0, 500) };
  }
  if (parsed.error) {
    return { ok: false, httpStatus: res.status, bodyText: JSON.stringify(parsed.error) };
  }
```

Patterns to copy:
- Field order is `ok`, `httpStatus`, `bodyText`. Add `errorKind` as the LAST field on each
  failure return; do not reorder existing fields.
- The caught-error stringify idiom is always `(e && e.message ? e.message : String(e))`.
  The classifier must read `e.name` at these same sites, where the error object is still
  in hand (`_classifyThrown(e)` per RESEARCH.md Code Examples).
- Server-supplied text is already capped at `slice(0, 500)` on the two SSE-parse legs. The
  raw `bodyText` legs (`:342`, `:346`, `:349`) are NOT capped today; anything the floor
  script prints from them must be capped at the print site (V5 control).

**Additive-safety check (discharges RESEARCH.md's assumption A2, run this session):**
`brainCall` has 12 call sites across `scripts/build-brain-census.cjs` (`:695`, `:706-708`,
`:739`, `:760`, `:769`, `:776`, `:782`, `:788`, `:796`) and 2 in
`scripts/check-flagship-floor.cjs` (`:110`, `:111`). Every one reads only `.ok`, `.result`,
and `.bodyText`. Adding `errorKind` breaks none. `scripts/probe-brain-contract.cjs:81` only
mentions `brainCall` in a comment (it generalizes it, does not import it).

---

### `scripts/check-flagship-floor.cjs` (utility, batch/transform)

**Analog:** itself. Three distinct in-file patterns to extend.

**Pure-function doc-comment + return-shape pattern** (`:79-104`):

```js
// ---------------------------------------------------------------------------
// evaluateFloor(frameworks, probeResultsByName) -- pure gate logic.
//   frameworks: [{ name, uses }] -- the enumerated (or override-filtered) set.
//   probeResultsByName: { [name]: { normalizeMatches, readinessScore } }
//     A framework with NO entry is treated as a MISS (never silently
//     dropped from the row set -- every enumerated framework produces a row).
// Returns { rows, passCount, missCount, exitCode }.
// ---------------------------------------------------------------------------
function evaluateFloor(frameworks, probeResultsByName) {
  const rows = frameworks.map((fw) => {
    const p = (probeResultsByName && probeResultsByName[fw.name]) || null;
    const matches = p ? p.normalizeMatches : null;
    const score = p ? p.readinessScore : null;
    const matchesOk = matches === 1;
    const scoreOk = typeof score === 'number' && score >= 3;
    const verdict = matchesOk && scoreOk ? 'PASS' : 'MISS';
    return { name: fw.name, uses: fw.uses, matches, score, verdict };
  });
  const misses = rows.filter((r) => r.verdict === 'MISS');
  return {
    rows,
    passCount: rows.length - misses.length,
    missCount: misses.length,
    exitCode: misses.length > 0 ? 1 : 0,
  };
}
```

Copy: the banner-comment block (the `// ----` rules, the parameter list, the explicit
`// Returns { ... }` line) must be updated in place to name `voidCount` and the VOID
precedence. **`passCount: rows.length - misses.length` must become an explicit
`rows.filter((r) => r.verdict === 'PASS').length`** -- the current arithmetic would count
VOID rows as passes (RESEARCH.md flags this; confirmed on disk).

**Probe-row construction pattern to extend** (`:109-122`) -- where `failures: []` is added:

```js
async function probeFramework(name, key) {
  const normRes = await brainCall('normalize_framework_name', { raw: name }, key);
  const readyRes = await brainCall('orchestration_readiness', { framework_name: name }, key);
  const normalizeMatches = normRes.ok && normRes.result && Array.isArray(normRes.result.canonical_matches) ? normRes.result.canonical_matches.length : null;
  const readinessScore = readyRes.ok && readyRes.result && readyRes.result.readiness ? readyRes.result.readiness.readiness_score : null;
  return {
    normalizeMatches,
    readinessScore,
    normalizeOk: normRes.ok,
    readinessOk: readyRes.ok,
    normalizeBody: normRes.ok ? null : normRes.bodyText,
    readinessBody: readyRes.ok ? null : readyRes.bodyText,
  };
}
```

Note the existing `<probe>Ok` / `<probe>Body` naming pairs. The new `failures` array is the
place the `errorKind` from `brainCall` lands, one entry per failed probe, with `probe` set
to `'normalize'` or `'readiness'` to match this naming.

**Output-format pattern to extend (D-06 / Pattern 4)** (`:176-187`):

```js
  for (const row of result.rows) {
    const p = probeResultsByName[row.name] || {};
    const httpNote = !p.normalizeOk || !p.readinessOk ? ` (HTTP: normalize_ok=${p.normalizeOk} readiness_ok=${p.readinessOk})` : '';
    console.log(
      `[${row.verdict}] ${row.name} -- uses=${row.uses} matches=${row.matches == null ? 'n/a' : row.matches} score=${row.score == null ? 'n/a' : row.score}/4${httpNote}`
    );
  }
  console.log('');
  console.log(`Frameworks passing (exactly-1 match AND readiness>=3): ${result.passCount}/${result.rows.length}`);
  console.log(`Frameworks MISSING the floor: ${result.missCount}/${result.rows.length}`);
  console.log(result.exitCode === 0 ? '=== FLOOR HOLDS (SWEEP-02 gate GREEN) ===' : '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===');
  process.exit(result.exitCode);
```

Copy: `[VERDICT] Name -- key=value key=value` row format, `n/a` for a null numeric, a blank
`console.log('')` before the summary block, `X/Y` count format, and an all-caps
`=== BANNER ===` terminator. The VOID banner is a THIRD distinct banner, never a reuse of
the RED one (Pitfall 5).

**Exit-code documentation pattern** (`:39-42`) -- the header line that must gain code 3:

```js
 * Usage: node scripts/check-flagship-floor.cjs
 * Exit codes: 0 = every invoked framework clears the floor; 1 = at least one
 * miss (the expected, honest state today -- 24 misses per the research
 * baseline); 2 = data/flagship-floor-set.json exists but is malformed.
```

**Export pattern** (`:190`): `module.exports = { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT, probeFramework };`
followed by the `if (require.main === module)` guard. Any new pure helper (e.g. a VOID-line
renderer) gets added to this same object so the new test can drive it with zero network.

---

### `tests/helpers/brain-capture-server.cjs` (test fixture, request-response) -- EXTEND

**Analog for the extension:** `tests/test-250-transport-retry.cjs:45-56` (the proven
`toolScript` design, ported not invented).

**The scripted-mode machinery to port** (`test-250-transport-retry.cjs:45-56`):

```js
const state = {
  initMode: 'ok', // 'ok' | '401'
  toolScript: null, // array of 'ok' | '503' consumed in order; last entry repeats
  toolResultPayload: { ok: true },
  toolCallCount: 0,
};

function nextToolMode() {
  if (!Array.isArray(state.toolScript) || state.toolScript.length === 0) return 'ok';
  const idx = Math.min(state.toolCallCount, state.toolScript.length - 1);
  return state.toolScript[idx];
}
```

The `Math.min(count, length - 1)` last-entry-repeats idiom is the load-bearing part. For 259
the script entries become OBJECTS (`{ status, headers, body }`) rather than bare mode strings,
because the 429 leg must assert `Retry-After` and only an object carries headers.

**Method-dispatch pattern already in the helper** (`brain-capture-server.cjs:57-95`) -- keep
this exactly; it is what makes the attempt counter honest (Pitfall 2):

```js
      // brain-client.callTool does initialize first, then tools/call.
      if (parsed.method === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
        });
        res.end(
          'data: ' +
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { protocolVersion: '2024-11-05', capabilities: {} },
            }) +
            '\n'
        );
        return;
      }

      if (parsed.method === 'tools/call') {
        // Capture for assertions.
        captured.push({
          name: parsed.params && parsed.params.name,
          arguments: (parsed.params && parsed.params.arguments) || {},
        });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
```

The scripted branch is inserted between the `captured.push(...)` and the existing
`res.writeHead(200, ...)`, so egress capture keeps working on scripted legs too (needed for
the Part 8 assertion leg).

**Mutate-never-reassign pattern for shared state** (`:110-117`) -- the `resetToolScript`
counterpart must follow it:

```js
/**
 * Truncate the shared `captured` array in place. Callers hold a
 * reference to the exported `captured` binding, so this must mutate,
 * never reassign.
 */
function resetCaptured() {
  captured.length = 0;
}
```

**Export + header-doc pattern** (`:1-27`, `:129-134`): the header states the extraction
provenance ("this is an extraction of an already-shipped, already-proven capture server, not
a new invention"), the ORDERING CONTRACT, and an "Exports exactly:" line. The 259 extension
must update that "Exports exactly" line and add its own provenance sentence naming
`test-250-transport-retry.cjs:45-56` as the port source, plus a sentence stating the default
is `null` so all four existing consumers are byte-unaffected.

Existing consumers that must stay green (from the helper's own header + repo):
`test-239-query-egress-canary.cjs`, `test-c8j-brain-wire.cjs`, `test-247-contract-client.cjs`,
`test-brain-client-params.cjs`.

---

### `tests/test-259-brain-client-429.cjs` (NEW; test, request-response, loopback mock)

**Analog:** `tests/test-250-transport-retry.cjs` -- copy its whole skeleton.

**Header pattern** (`:1-31`) -- a per-test one-line contract list, the analog citation, and
the "No em-dashes" sign-off:

```js
#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 1 (AVAIL-02, navigator ruling 2026-08-10) --
 * bounded transport retry budget.
 * ==========================================================================
 * Proves the retry lives at the transport layer around the single HTTP
 * dispatch seam every Brain tool flows through (the tools/call POST inside
 * lib/core/brain-client.cjs's callTool()), NOT in the refusal renderer, NOT
 * in the shim.
 *
 *   Test A (transient recovers): server fails twice (503) then 200 on
 *     tools/call -- the wrapped call returns the payload, never null; the
 *     tools/call attempt counter is exactly 3.
 *   Test B (budget exhausted): server always 503 on tools/call -- the call
 *     returns null after exactly 1 + RETRY_MAX attempts.
 ...
 * Loopback mock-server pattern copied from tests/test-247-brain-client-403.cjs
 * / tests/test-249-capture-seam.cjs (real node:http server, no fetch
 * mocking). Tiny backoff via env overrides keeps this suite well under 60s.
 *
 * node --test, CJS, node:assert/strict + node:http only. No new deps.
 * No em-dashes.
 */
```

**Imports pattern** (`:33-38`):

```js
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');

const BRAIN_CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs');
```

For 259, `http` is replaced by `require('./helpers/brain-capture-server.cjs')` (D-04) --
the new file must NOT `require('node:http')` directly, or it has stood up a fifth server.

**The require-cache dance (MANDATORY, copy verbatim in shape)** (`:124-141`):

```js
function freshBrainClient(url, envOverrides) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  // Tiny backoff by default so the suite stays fast; individual tests can
  // override via envOverrides to exercise the real default / invalid-value
  // fallback path.
  delete process.env.MINDRIAN_BRAIN_RETRY_MAX;
  delete process.env.MINDRIAN_BRAIN_RETRY_BASE_MS;
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '5';
  if (envOverrides) {
    for (const k of Object.keys(envOverrides)) {
      if (envOverrides[k] === undefined) { delete process.env[k]; }
      else { process.env[k] = envOverrides[k]; }
    }
  }
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}
```

For 259 add `delete process.env.MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX;` /
`MINDRIAN_BRAIN_RATELIMIT_BASE_MS` and default the latter to `'5'`. Getting this wrong
produces a test that silently hits the real Brain.

**Lifecycle + isolation pattern** (`:143-161`):

```js
let mockServer;
let mockUrl;

before(async () => {
  const started = await startMockServer();
  mockServer = started.server;
  mockUrl = started.url;
});

after(async () => {
  await new Promise((resolve) => mockServer.close(resolve));
});

beforeEach(() => {
  state.initMode = 'ok';
  state.toolScript = null;
  state.toolResultPayload = { ok: true };
  state.toolCallCount = 0;
});
```

For 259: `before` uses `startCaptureServer()`, `after` uses `await stopCaptureServer(mockServer)`
(the helper's own convenience wrapper), and `beforeEach` calls `resetToolScript()` +
`resetCaptured()`.

**Assertion pattern -- the dual assertion (result AND attempt count), with a message on
every assert** (`:166-201`):

```js
test('Test A: a transient failure retries then recovers, never surfaces null', async () => {
  const brain = freshBrainClient(mockUrl);
  state.toolScript = ['503', '503', 'ok'];
  state.toolResultPayload = { hello: 'recovered' };

  const result = await brain.callTool('brain_stats', {});

  assert.deepStrictEqual(result, { hello: 'recovered' }, 'the wrapped call must return the payload, never null');
  assert.equal(state.toolCallCount, 3, 'the tools/call attempt counter must be exactly 3');
});
...
test('Test C (403 leg): tier_denied sentinel comes back with exactly ONE tools/call attempt', async () => {
  const brain = freshBrainClient(mockUrl, { MINDRIAN_BRAIN_RETRY_MAX: '2' });
  state.toolScript = ['403', '503', 'ok']; // if the client retried, it would see 503 next -- it must not

  const result = await brain.callTool('brain_query', { cypher: 'MATCH (n) RETURN n' });

  assert.equal(result && result.error, 'tier_denied', '403 must map to the tier_denied sentinel');
  assert.equal(state.toolCallCount, 1, '403 is validation-class, never transient -- exactly one attempt');
});
```

Three habits to copy: (1) every assertion carries a human-readable message stating the
contract; (2) the trap-entry trick (`['403', '503', 'ok']` -- if the client wrongly retried
it would see a different status, so the count assertion cannot pass by accident); (3) test
names are full sentences naming the contract, not `it works`.

**Test naming convention:** `Test A: ...` / `Test C (403 leg): ...`. Use `Test A/B/C/D` plus
a `RED PROOF:` prefix for the mandatory red proof (that prefix comes from
`test-249-floor-gate.cjs:100`, see below).

---

### `tests/test-259-floor-void.cjs` (NEW; test, transform, pure fixtures, zero I/O)

**Analog:** `tests/test-249-floor-gate.cjs` -- copy its whole skeleton.

**Imports pattern** (`:26-28`):

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT } = require('../scripts/check-flagship-floor.cjs');
```

> Correction 1 (see below): this file uses `node:assert`, NOT `node:assert/strict`. The new
> 259 file should use `node:assert/strict` to match the newer 250 convention and the
> RESEARCH.md Validation table; do not blindly copy the older loose import.

**Fixture-builder + shared-fixture pattern** (`:30-48`) -- duplicate these two builders
locally (repo norm; they are 3 lines each):

```js
// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------
function fw(name, uses) {
  return { name, uses };
}

function probe(matches, score) {
  return { normalizeMatches: matches, readinessScore: score, normalizeOk: true, readinessOk: true };
}

// An all-green fixture: every framework has exactly 1 canonical match and a
// readiness score >= 3. The gate must exit 0 with zero misses on this.
const ALL_GREEN_FRAMEWORKS = [fw('Beautiful Question Framework', 5), fw('Problem Definition Transformation', 3), fw("Usher's Model", 2)];
const ALL_GREEN_PROBES = {
  'Beautiful Question Framework': probe(1, 4),
  'Problem Definition Transformation': probe(1, 4),
  "Usher's Model": probe(1, 3),
};
```

For 259 add a third builder in this same style, e.g.
`function failing(kind, httpStatus, detail) { return { ...probe(null, null), failures: [{ probe: 'readiness', kind, httpStatus, detail }] }; }`.
Note `probe()` already sets `normalizeOk/readinessOk: true`, which is exactly why an
additive `failures`-keyed VOID leaves all nine 249 assertions green.

**Sabotage-from-green RED PROOF pattern (MANDATORY, `:94-122`)** -- the strongest thing to
copy; the TRUST-02 false-MISS proof is a direct transposition:

```js
// ---------------------------------------------------------------------------
// RED PROOF (mandatory, in-suite): sabotage exactly ONE score OR ONE
// match-count in an otherwise all-green fixture and prove the gate turns
// red -- this is the demonstration that the gate CAN fail, not merely
// asserted in prose.
// ---------------------------------------------------------------------------
test('RED PROOF: sabotaging ONE score in an all-green fixture turns the whole gate red (non-zero exit)', () => {
  const greenResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(greenResult.exitCode, 0, 'sanity: the unsabotaged fixture must be green first');

  const sabotagedProbes = { ...ALL_GREEN_PROBES, "Usher's Model": probe(1, 1) }; // score sabotaged 3->1
  const redResult = evaluateFloor(ALL_GREEN_FRAMEWORKS, sabotagedProbes);
  assert.equal(redResult.exitCode, 1, 'the gate must go red on a single sabotaged score');
  assert.equal(redResult.missCount, 1);
  assert.equal(redResult.passCount, 2);
});
```

The three-step shape to copy exactly: (1) assert the unsabotaged fixture is green first
("sanity:"), (2) spread-override exactly ONE key with an inline `// x->y` comment, (3)
assert exitCode AND both counts. For 259: assert `exitCode === 3`, `voidCount === 1`, AND
`missCount === 0` (the false-MISS proof: the count must NOT increase).

**The pinned assertion the VOID design must not break** (`:86-92`) -- keep it green
(OQ-2 recommends keeping never-probed as MISS):

```js
test('evaluateFloor: a framework with no probe result at all (never probed) is a MISS, not silently dropped', () => {
  const frameworks = [...ALL_GREEN_FRAMEWORKS, fw('Never Probed Framework', 1)];
  const r = evaluateFloor(frameworks, ALL_GREEN_PROBES); // no entry for the new framework
  assert.equal(r.rows.length, 4, 'every enumerated framework must produce a row, even an unprobed one');
  const missed = r.rows.find((row) => row.name === 'Never Probed Framework');
  assert.equal(missed.verdict, 'MISS');
});
```

**`errorKind` classifier leg:** `test-249-floor-gate.cjs` is zero-network and has no analog
for the loopback legs (a server that never responds + a closed port). Use
`test-250-transport-retry.cjs`'s `startMockServer` lifecycle shape (`before`/`after`) for
those two legs, or put them in a sibling file. This is the one leg with only a partial analog.

---

### `tests/run-all-259.sh` (NEW; config, batch)

**Analog:** `tests/run-all-250.sh` -- copy the whole file and re-point the prefix, the
mandatory-test list, and the em-dash target list.

**Header pattern** (`:1-37`) -- states what the phase must prove in one sentence each, then
the three load-bearing conventions:

```bash
#!/usr/bin/env bash
# Phase 250 verification aggregator (HONEST-01, the honesty rail; AVAIL-02,
# the bounded transport retry).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   1. ...
#
# DISCOVERY IS BY GLOB, NOT BY LIST (mirrors tests/run-all-249.sh). This
# harness globs every tests/test-250-* file (both .cjs and .sh) and runs it.
# Adding a tests/test-250-* file requires NO edit to this runner.
#
# THE MANDATORY TESTS, enumerated by filename so a missing one is visible by
# READING this header even though the glob does the actual discovery:
#
#   250-01  tests/test-250-refusal-shapes.cjs
#   ...
# THE found-eq-0 GUARD IS LOAD-BEARING AND MUST NOT BE SOFTENED. A harness
# that discovers nothing must FAIL, not print green.
#
# NO-EM-DASH FENCE: sweeps every file this phase touches for the forbidden
# U+2014 glyph via its Unicode codepoint escape (grep -P '\x{2014}'), so this
# runner itself carries no literal em-dash that would trip its own sweep.
# Missing paths are skipped, not failed.
#
# bash only. No em-dashes.
```

**Prefix hook + guard + runners** (`:39-93`):

```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# The discovery prefix is a variable ONLY so the found-eq-0 guard is provable
# without editing this file: TEST_250_PREFIX=tests/test-250-nonexistent- bash
# tests/run-all-250.sh must exit non-zero. Production runs never set it.
PREFIX="${TEST_250_PREFIX:-tests/test-250-}"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
...
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  run "$(basename "$t")" node --test "$t"
done
for t in "$PREFIX"*.sh; do
  # Never re-run this runner against itself if it happens to match its own prefix.
  if [ "$(basename "$t")" = "$(basename "${BASH_SOURCE[0]}")" ]; then continue; fi
  found=$((found+1))
  run_may_skip "$(basename "$t")" bash "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no ${PREFIX}* files discovered"
  exit 1
fi
```

Rename `TEST_250_PREFIX` -> `TEST_259_PREFIX` and `tests/test-250-` -> `tests/test-259-`.
`node --test "$t"` is the correct invocation for both new 259 `.cjs` suites.

**The em-dash fence, verbatim structure** (`:95-141`) -- only the target array changes:

```bash
echo "--- 250 no-em-dash fence ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/refusal-messaging.cjs"
  "lib/core/brain-client.cjs"
  ...
  "tests/run-all-250.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -lP '\x{2014}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      EMDASH_OK=0
    elif [ -n "$hits" ]; then
      echo "    FORBIDDEN em-dash in: $t"
      EMDASH_OK=0
    fi
  else
    echo "    (skipped, not yet created): $t"
  fi
done
if [ "$EMDASH_OK" -eq 1 ]; then
  echo ">>> 250 no-em-dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 250 no-em-dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 250: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
```

The 259 `EMDASH_TARGETS` list is exactly this phase's six files:
`lib/core/brain-client.cjs`, `scripts/check-flagship-floor.cjs`,
`scripts/build-brain-census.cjs`, `tests/helpers/brain-capture-server.cjs`,
`tests/test-259-brain-client-429.cjs`, `tests/test-259-floor-void.cjs`,
`tests/run-all-259.sh` (plus `lib/core/refusal-messaging.cjs` if F-09 Option B is taken).

Note the `rc -ge 2` branch: a broken scan FAILS rather than passing silently. Keep it.

---

## Shared Patterns

### Phase-tagged inline comment provenance
**Source:** `lib/core/brain-client.cjs:512-519`, `:474-479`; `scripts/check-flagship-floor.cjs:55-57`
**Apply to:** every new code block in all three source files.
Every non-obvious branch in this codebase opens with `// Phase <N>-<plan> (<REQ-ID>): <what
and why>`, and states the counterfactual (what the old behavior was and why it was wrong).
New 259 blocks open with `// Phase 259 (TRUST-01): ...` / `// Phase 259 (TRUST-02, D-05): ...`.

### Sentinel-object error taxonomy (never throw)
**Source:** `lib/core/brain-client.cjs:537` (`tier_denied`), `:387` (`invalid_key`), `:454` (`egress_blocked`)
**Apply to:** the new `rate_limited` sentinel.
```js
return { error: 'tier_denied', tool: toolName, message: message };
```
Shape: `error` (the kind string) first, `tool` second, payload fields, `message` last.
Returned through the promise, never thrown. `query()` at `:664-669` passes any `.error`
object through byte-unchanged, so no wrapper edit is needed.

### Defensive numeric-env convention
**Source:** `lib/core/brain-client.cjs:40-51`
**Apply to:** both new rate-limit env vars, and to any `Retry-After` parse.
"An invalid override falls back to the default rather than throwing or disabling the feature
silently." The `Retry-After` parser extends this: `NaN`, negative, and non-finite all return
`null` (meaning "use the D-02 schedule"), never reach `_sleep`.

### Server-supplied text is always length-capped
**Source:** `lib/core/brain-client.cjs:534` (`rawText.slice(0, 300)`),
`scripts/build-brain-census.cjs:361,367` (`text.slice(0, 500)`)
**Apply to:** the new sentinel's `message`, the new `failures[].detail`, and every VOID
output line. Also collapse newlines before printing a Brain-supplied `detail` (log-injection
guard). 300 chars is the sentinel convention; 500 is the census/body-excerpt convention.

### Body-drain before bailing on a non-OK response
**Source:** `lib/core/brain-client.cjs:539-542`
```js
try { await toolRes.arrayBuffer(); } catch (_) { /* body already gone */ }
```
**Apply to:** the 429 branch, which must consume its own body before it `continue`s or
returns (an un-drained undici socket is a live libuv handle that asserts on Windows).
Read `retry-after` from `toolRes.headers` BEFORE this line for clarity, even though Fetch
`Headers` survive body consumption.

### Pure function + injected fixtures (testability)
**Source:** `scripts/check-flagship-floor.cjs:79-104` + its `module.exports` at `:190`
**Apply to:** `_rateLimitWaitMs` / `_parseRetryAfterMs` in `brain-client.cjs` and any new
VOID renderer in `check-flagship-floor.cjs`.
The repo's move: extract the decision into a pure exported function so the test drives it
with zero network (and, for 259, zero sleeps). Export it from `module.exports` explicitly.

### Test hermeticity + provenance
**Source:** `tests/helpers/brain-capture-server.cjs:1-27`, `tests/test-250-transport-retry.cjs:25-31`
**Apply to:** both new test files and the helper extension.
Every test file's header names the file it copied its mock pattern from, states "no new deps",
and signs off "No em-dashes." Every mock binds `127.0.0.1:0` (ephemeral loopback). Nothing
touches the network or the real Brain.

---

## No Analog Found

| File / leg | Role | Data Flow | Reason |
|------------|------|-----------|--------|
| `brainCall` `errorKind` classification legs of `tests/test-259-floor-void.cjs` (a server that never responds -> `AbortSignal.timeout`; a closed port -> connection failure) | test | event-driven / error-path | No existing test in `tests/` exercises `AbortSignal.timeout` firing or a deliberately closed port. `test-250-transport-retry.cjs` gives the server-lifecycle scaffolding but scripts HTTP statuses only, never a hang or a refused connection. Build these two legs from RESEARCH.md's live-probe findings (F-06: `TimeoutError`/code 23 vs `TypeError`/'fetch failed', verified on Node v22.23.1). Consider a sibling file so `test-259-floor-void.cjs` stays pure and zero-I/O. |

---

## Corrections to RESEARCH.md

Both found by reading the live files; neither changes a decision.

1. **`tests/test-249-floor-gate.cjs` imports `node:assert`, not `node:assert/strict`**
   (`:27`). RESEARCH.md's Validation Architecture table lists the framework as
   "`node:test` + `node:assert/strict`" for both existing suites. `test-250-transport-retry.cjs:33`
   does use `node:assert/strict`; 249 does not. The new 259 files should use
   `node:assert/strict` (the newer convention), so the 249 file is a shape analog, not an
   import analog.

2. **`test-249-floor-gate.cjs` has 12 tests, not 9.** RESEARCH.md F-11 says "Nine tests".
   Counted on disk: 5 `evaluateFloor` tests, 2 RED PROOFs, 5 `parseOverrideFile` tests
   (`:127`, `:133`, `:139`, `:145`, `:150`), and 1 `CANON_PROSE_COMMAND_COUNT` test = 13
   total `test(...)` calls, of which 7 drive `evaluateFloor`. The substantive claim stands
   unchanged: every existing `probe()` fixture is a clean-success fixture, so an additive
   `failures`-keyed VOID leaves all of them green with zero edits. The planner should write
   "all existing 249 assertions" rather than a count.

Also confirmed correct as stated in RESEARCH.md: the `return null` at `brain-client.cjs:551`,
the 403 block at `:520-538`, the drain at `:542`, the 5xx retry at `:547-550`, the retry-loop
header at `:474-482`, the constants at `:43-63`, `evaluateFloor` at `:87-104`, `probeFramework`
at `:109-122`, the row renderer at `:176-187`, exit codes at `:40-42`/`:102`/`:130`/`:144`/`:150`,
the `brainCall` import at `check-flagship-floor.cjs:53`, and `brainCall`'s failure returns in
`build-brain-census.cjs:294-382`.

## Metadata

**Analog search scope:** `lib/core/`, `scripts/`, `tests/`, `tests/helpers/`
**Files read this session:** 8 (`lib/core/brain-client.cjs` [2 ranges],
`scripts/check-flagship-floor.cjs`, `scripts/build-brain-census.cjs` [1 range],
`tests/helpers/brain-capture-server.cjs`, `tests/test-250-transport-retry.cjs`,
`tests/test-249-floor-gate.cjs`, `tests/run-all-250.sh`), plus one repo-wide `brainCall`
call-site grep (14 sites, all additive-safe)
**Pattern extraction date:** 2026-08-20
