# Phase 239: Brain-Access Surface - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 21 (16 modify, 5 create)
**Analogs found:** 19 / 21
**Source:** `239-RESEARCH.md` (no CONTEXT.md; navigator chose "continue without context")

## Two Corrections to RESEARCH.md (found on disk during mapping)

Both are load-bearing for the planner. Do not plan around the research text alone.

### Correction 1: `verify-release` has NO section 18, and `checkMintRatifierLiveness` is NOT wired anywhere

RESEARCH.md (T1 mitigation, Open Question 2) says to mirror "how Phase 238-06 wired `checkMintRatifierLiveness` into `verify-release` section 18". That precedent **does not exist on disk**:

```
$ grep -rn "MintRatifierLiveness" scripts/ lib/ tests/
lib/core/seam-liveness.test.cjs:34,123,126,130,131   <- test only
lib/core/seam-liveness.cjs:138,176                   <- definition + export only
```

`scripts/verify-release` numbered sections stop at **17 (KUZU REINTRODUCTION GATE)**, followed by an unnumbered PACKAGE-LOCK SYNC section and the SUMMARY. There is no section 18 and no `seam-liveness` reference in `scripts/`.

**Consequence:** `checkMintRatifierLiveness` has zero production consumers too, exactly like `checkHookMatcherLiveness`. Phase 239 is genuinely the FIRST production consumer of `seam-liveness.cjs`, with no wiring precedent for the seam helper specifically. The planner must author section 18 from the **section 16/17 shape** (excerpted below), not from a nonexistent 238-06 precedent.

### Correction 2: an SSE-shaped capture-server helper DOES already exist

RESEARCH.md Wave 0 Gaps says "Shared helper: local SSE-shaped capture server (`MINDRIAN_BRAIN_URL` target). No such helper exists in `tests/` today."

It exists: **`tests/test-brain-client-params.cjs`** (344 lines) stands up exactly this - a `node:http` server on a random loopback port, replying in `data: <json>\n` SSE shape to both `initialize` and `tools/call`, with `MINDRIAN_BRAIN_URL` + `MINDRIAN_BRAIN_KEY` set BEFORE the `require`, and a `delete require.cache` fresh-load. It is not currently exported as a shared helper, so the Wave 0 task is **extract, not invent**.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `hooks/hooks.json` (L236, L338) | config | event-driven | itself (in-place literal edit) | n/a |
| `lib/core/brain-response-sanitize.cjs` | utility (authority) | transform | `lib/core/seam-liveness.cjs` (exported-constant + pure predicate module) | role-match |
| `scripts/part8-egress-guard-hook.cjs` | hook script | request-response | `scripts/brain-response-sanitize-hook.cjs` (sibling, same re-check) | exact |
| `scripts/brain-response-sanitize-hook.cjs` | hook script | request-response | `scripts/part8-egress-guard-hook.cjs` (sibling) | exact |
| `lib/core/brain-client.cjs` (`query`, `hatAwareRecommend`, `suggestValidationSteps`) | service (wire layer) | request-response | `lib/core/bono/persona-research.cjs:208-233` (classify-first-then-Brain) | exact (control flow) |
| `lib/core/brain-client.cjs` (`sendPacket` park note) | service | request-response | `lib/core/navigation/packet.cjs:100-110` (dated, reasoned in-code park comment) | exact |
| `lib/core/seam-liveness.cjs` (grounding comment L96-100) | utility | n/a (comment) | itself | n/a |
| `bin/mindrian-brain-mcp-client.cjs` | config/registry | request-response | READ-ONLY reference; not modified | n/a |
| `lib/core/navigation/packet.cjs` (L105) | model/projection | transform | itself (comment already correct; reconcile the test) | n/a |
| `tests/test-150-brain-egress.cjs` (L12) | test | n/a | itself (header correction) | n/a |
| `tests/test-brain-response-sanitize.cjs` (L186-194) | test | unit | itself (assertions to INVERT) | n/a |
| `lib/core/part8-egress-guard.test.cjs` (L114-163) | test | unit | same inversion treatment | role-match |
| `tests/part8-egress-guard-hook.test.cjs` (L49-68) | test | integration | same inversion treatment | role-match |
| `agents/persona-analyst.md` (L12-13) | agent frontmatter | n/a | any `agents/*.md` with a live MCP tool in `allowed-tools` | role-match |
| `scripts/verify-release` (NEW section 18) | config/gate | batch | `scripts/verify-release` sections 16 + 17 | exact |
| NEW `tests/run-all-239.sh` | test aggregator | batch | `tests/run-all-196.sh` | exact |
| NEW `tests/test-239-brain-tool-liveness.cjs` | test | integration | `lib/core/seam-liveness.test.cjs` + the stdio handshake in RESEARCH Pattern 3 | partial |
| NEW `tests/test-239-query-egress-canary.cjs` | test | e2e | `tests/test-brain-client-params.cjs` | **exact** |
| NEW `tests/test-239-pii-sanitizer-liveness.cjs` | test | integration | `tests/part8-egress-guard-hook.test.cjs` (spawnSync envelope shape) | exact |
| NEW `tests/test-239-sendpacket-parked.cjs` | test | unit (census) | `run-all-196.sh` grep-guard leg (`noprivate_regex`) | role-match |
| NEW shared SSE capture helper (`tests/helpers/brain-capture-server.cjs`) | test utility | request-response | `tests/test-brain-client-params.cjs:57-125,168-183` | **exact (extract, do not invent)** |

---

## Pattern Assignments

### `lib/core/brain-response-sanitize.cjs` (the single tool-name authority)

**Current code to replace** (lines 76-85, verbatim):

```javascript
/**
 * isBrainTool(toolName) -- matcher for PostToolUse hook scope.
 * Per SEED-003 A3: scope is mcp__brain_* tool calls.
 *
 * @param {string} toolName    tool name string from PostToolUse stdin
 * @returns {boolean}          true iff the tool is a Brain MCP tool
 */
function isBrainTool(toolName) {
  return typeof toolName === 'string' && toolName.indexOf('mcp__brain_') === 0;
}
```

Note line 78's comment ("scope is mcp__brain_* tool calls") is itself false today and must change with the code, not survive it.

**Target shape** (RESEARCH Pattern 2, unanchored export + anchored predicate). Export `BRAIN_TOOL_MATCHER` so `hooks.json` parity can be asserted by test and `isBrainTool` derives from the same string.

---

### `scripts/part8-egress-guard-hook.cjs` + `scripts/brain-response-sanitize-hook.cjs` (call-site re-check)

Both call sites are already correct code against a broken authority. **If `isBrainTool`'s signature is unchanged, neither call site needs a code change - only its comment.**

`scripts/part8-egress-guard-hook.cjs:139-147` (verbatim):

```javascript
  // Defense-in-depth: the matcher scopes this hook to mcp__brain_.* but re-check
  // in-hook so a matcher drift cannot leak the gate open (OQ-1 backstop).
  try {
    const sanitizer = require(SANITIZER_PATH);
    if (!sanitizer.isBrainTool(toolName)) return allow();
  } catch (_) {
    // If the sanitizer cannot load, fail-OPEN (hook-internal error, A3).
    return allow();
  }
```

`scripts/brain-response-sanitize-hook.cjs:68-73` (verbatim):

```javascript
function main() {
  try {
    const input = readStdin();
    const toolName = String((input && input.tool_name) || '');
    if (!sanitizer.isBrainTool(toolName)) {
      // Passthrough for non-Brain tools.
      return emitPassthrough();
    }
```

Comments to correct: `part8-egress-guard-hook.cjs:140` and `brain-response-sanitize-hook.cjs:5,9` (both say `mcp__brain_*`).

---

### `lib/core/brain-client.cjs` - the classify-first guard insert

**Analog to clone: `lib/core/bono/persona-research.cjs:208-233`** (verbatim from disk, SHIPPED, fail-closed):

```javascript
  // (d optional) the Brain leg: generic dimension hints. EVERY Brain-bound
  // payload passes classify FIRST and proceeds ONLY on verdict 'allow'. The
  // payload carries the GENERIC handle only -- never room content.
  let brain_skipped = false;
  let brain_hints = null;
  if (brainFn) {
    const brainPayload = { ask: handle, question: handle };
    let verdict = null;
    try {
      verdict = classifyFn(brainPayload, { toolName: 'brain_ask' });
    } catch (_e) {
      verdict = null;
    }
    if (verdict && verdict.verdict === 'allow') {
      try {
        brain_hints = await brainFn(brainPayload);
      } catch (_e) {
        brain_hints = null;
        brain_skipped = true;
        degraded_reasons.push('brain_call_threw');
      }
    } else {
      brain_skipped = true;
      degraded_reasons.push('brain_egress_' + (verdict && verdict.verdict ? verdict.verdict : 'unverified'));
    }
  }
```

Key shape properties to preserve: classify in a try/catch that collapses to `null`; proceed ONLY on `verdict === 'allow'`; on non-allow set a skipped flag and push a **disclosed reason string** carrying the verdict, never silently return.

**Insertion point A - `hatAwareRecommend` (`brain-client.cjs:654-700`, verbatim).** The raw field is `blueNotes`; the guard must run at line 679 (right after `hatStates.blue.methodology_notes` is read) and BEFORE `sanitizeCypherInput` at line 692:

```javascript
async function hatAwareRecommend(roomDir, problemType, options = {}) {
  if (!isAvailable()) return null;
  ...
  // Blue Hat: methodology notes may flag ineffective frameworks to avoid
  const blueNotes = hatStates.blue.methodology_notes || [];
  const avoidPatterns = blueNotes
    .filter(n => /ineffective|didn't work|not useful|skip|avoid/i.test(n))
    .map(n => {
      const match = n.match(/^(\w[\w\s]+?)\s+(?:was|is|were|proved)\s/i);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
  hatInfluence.avoid_frameworks = avoidPatterns;

  // Build Cypher query with hat-influenced scoring
  const safeProblemType = sanitizeCypherInput(problemType || '');   // <-- guard must precede THIS
  const avoidClause = avoidPatterns.length > 0
    ? `AND NOT ANY(avoid IN [${avoidPatterns.map(a => `"${sanitizeCypherInput(a)}"`).join(', ')}] WHERE f.name CONTAINS avoid)`
    : '';
```

**The sanitizer that destroys the signal (`brain-client.cjs:83-93`, verbatim)** - the guard must be strictly upstream of it:

```javascript
function sanitizeCypherInput(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    try { value = String(value); } catch (_e) { return ''; }
  }
  return value.replace(/[^a-zA-Z0-9 ._-]/g, '');
}
```

**Insertion point B - `query()` backstop (`brain-client.cjs:375-386`, verbatim).** Currently zero guard calls:

```javascript
async function query(cypher, params) {
  const args = { cypher: cypher };
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    args.params = params;
  }
  const result = await callTool('brain_query', args);
  if (result == null) return null;                              // unreachable / no API key
  if (Array.isArray(result)) return { records: result };        // the normal brain_query shape
  if (result && Array.isArray(result.records)) return result;   // already normalized (defensive)
  if (result && (result.error || result.text)) return result;   // error / message passthrough
  return { records: [] };                                       // unexpected shape -> empty, never crash
}
```

This is a **backstop only** (Pitfall 1: the template word `Framework` launders the payload to `allow`). It must not be the only change.

---

### `lib/core/brain-client.cjs` - `sendPacket` park note

**Analog: the existing PB8-10 belt inside `sendPacket` (`brain-client.cjs:1273-1298`, verbatim)** - shows the house comment idiom (numbered finding, reasoned posture, explicit degrade):

```javascript
  try {
    const _guard = require('./part8-egress-guard.cjs');
    const _verdict = _guard.classify(packet, { toolName: 'brain_packet' });
    if (_verdict && _verdict.verdict === 'block') {
      _logEventBestEffort(o.db, 'brain_egress_blocked', {
        egress_class: _verdict.class || 'content_set',
        verdict: 'block',
        count: 1,
        created_by: 'system',
        source_path: 'system:brain-packet',
      });
      return { advice: null, reason: 'egress_blocked' };
    }
```

**Park-note prose analog: `lib/core/navigation/packet.cjs:100-110` (verbatim)** - a dated, reasoned, finding-referenced in-code note that states the zero-consumer fact plainly:

```javascript
// Review finding H5: shortText() previously returned raw node prose (summary/claim/title/
// text) under EVERY privacy mode, including the default local_summary_only. That let user
// prose cross the LOCAL->BRAIN boundary in the summary/explanation fields -- a latent Part 8
// breach (dormant only because sendPacket has zero production consumers today).
```

The new park note goes at the `sendPacket` definition and must carry a date + the census fact + the A3 ruling.

---

### `tests/test-239-query-egress-canary.cjs` + the shared capture helper

**Analog: `tests/test-brain-client-params.cjs`. Extract, do not reinvent.**

Server (lines 57-125, verbatim; note both `initialize` and `tools/call` reply in SSE `data: ` shape, which `callTool` requires):

```javascript
const http = require('node:http');
const assert = require('node:assert/strict');
const path = require('node:path');

const captured = [];

function startMockServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body); }
      catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_json' }));
        return;
      }

      // brain-client.callTool does initialize first, then tools/call.
      if (parsed.method === 'initialize') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({
          jsonrpc: '2.0', id: parsed.id,
          result: { protocolVersion: '2024-11-05', capabilities: {} },
        }) + '\n');
        return;
      }

      if (parsed.method === 'tools/call') {
        captured.push({
          name: parsed.params && parsed.params.name,
          arguments: (parsed.params && parsed.params.arguments) || {},
        });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({
          jsonrpc: '2.0', id: parsed.id,
          result: { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] },
        }) + '\n');
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown_method' }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}
```

Env + fresh-require ordering (lines 168-183, verbatim) - **the ordering is load-bearing**, `BRAIN_URL` is captured at module load:

```javascript
async function main() {
  const { server, port } = await startMockServer();

  // Point brain-client at the mock BEFORE requiring it; BRAIN_URL is
  // module-scoped at load time (brain-client.cjs line 21).
  process.env.MINDRIAN_BRAIN_URL = `http://127.0.0.1:${port}`;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';

  // Force a fresh require even if another test pre-loaded it.
  const brainClientPath = path.resolve(...);
  delete require.cache[brainClientPath];
```

For the canary assertion, the phase asserts the inverse of this file's assertion: `captured` must contain **zero** canary bytes (assert over `JSON.stringify(captured)`), and the mutation leg (remove the guard) must make the canary appear.

---

### `tests/test-239-pii-sanitizer-liveness.cjs`

**Analog: `tests/part8-egress-guard-hook.test.cjs` envelope + spawnSync shape** (lines 49-68, 91-95, verbatim). These are also the **dead-name fixtures to invert**:

```javascript
// Envelope shape (brain-response-sanitize-hook): { tool_name, tool_input, session_id }.
const X = envelope({
  tool_name: 'mcp__brain_query',     // <-- DEAD NAME, invert
  ...
});
const NON_BRAIN = envelope({ tool_name: 'Write', tool_input: { path: 'x.md' }, session_id: 's3' });
const Y = envelope({ tool_name: 'mcp__brain_ask', ... });   // <-- DEAD NAME, invert

// Passthrough: non-Brain tool_name -> exit 0 (isBrainTool recheck, defense-in-depth).
assert.strictEqual(r.status, 0, 'non-Brain tool_name must exit 0 (passthrough)');
```

---

### `tests/test-brain-response-sanitize.cjs:186-194` (assertions to INVERT)

Verbatim current state - note line 189's "prefix match per spec" comment is the fiction to kill:

```javascript
test('isBrainTool matcher: mcp__brain_query true, Read false', () => {
  assert.equal(sanitizer.isBrainTool('mcp__brain_query'), true);
  assert.equal(sanitizer.isBrainTool('mcp__brain_search'), true);
  assert.equal(sanitizer.isBrainTool('mcp__brain_'), true); // prefix match per spec
  assert.equal(sanitizer.isBrainTool('Read'), false);
  assert.equal(sanitizer.isBrainTool('mcp__supabase_query'), false);
  assert.equal(sanitizer.isBrainTool('mcp__brain_query'), false);   // (target: inverted)
  assert.equal(sanitizer.isBrainTool(''), false);
  assert.equal(sanitizer.isBrainTool(null), false);
  assert.equal(sanitizer.isBrainTool(undefined), false);
});
```

Keep the three falsy-input legs unchanged; they are correct. Add the T3 negative: a foreign server name such as `mcp__plugin_evil_evil-brain__brain_ask` must be `false`.

---

### NEW `tests/run-all-239.sh`

**Analog: `tests/run-all-196.sh`.** Copy the header contract + `run`/`run_if` helpers verbatim (lines 22-46):

```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}
```

Footer (verbatim):

```bash
echo "========================================"
echo "  Summary (196 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
```

**The Wave 0 contract to restate in the 239 header** (verbatim from `run-all-196.sh:12-15`):

> WAVE 0 CONTRACT: this runner is authored BEFORE the modules land (Nyquist: tests precede implementation). Every module leg is run_if, GUARDED ON THE RUNTIME MODULE FILE (not the test file), so Wave 0 exits cleanly with SKIPs.

**Grep-guard leg analog for the BRAIN-03 census + the `mcp__brain_` literal census** (verbatim, `run-all-196.sh`):

```bash
noprivate_regex() {
  ! grep -vE '^[[:space:]]*//' lib/core/part8-egress-guard.cjs \
    | grep -qE 'FORBIDDEN_PATTERNS[[:space:]]*='
}
run_if "PB8-02 no private FORBIDDEN_PATTERNS copy" \
  lib/core/part8-egress-guard.cjs \
  noprivate_regex
```

---

### `scripts/verify-release` - NEW section 18 (SC1 liveness gate)

**Analog: sections 16 and 17 (verbatim from disk).** Both delegate to a `scripts/check-*.cjs`, capture stdout, and branch on the exit code. Section 17 is the newest and the cleanest template:

```bash
# ============================================================
# 17. KUZU REINTRODUCTION GATE
# ============================================================
# ... multi-line WHY-this-gate-exists comment citing the RCA/phase ...
echo -e "\n${BOLD}17. Kuzu Reintroduction Gate${NC}"

KUZU_GATE_OUT=$(node "$PLUGIN_ROOT/scripts/check-kuzu-reintroduction.cjs" 2>&1) && KUZU_GATE_CODE=0 || KUZU_GATE_CODE=$?
if [ "$KUZU_GATE_CODE" -eq 0 ]; then
  pass "No live kuzu dependency or require/import re-entered the tree"
else
  fail "Kuzu reintroduction gate FAILED (the retired KuzuDB engine is back in the dependency surface):"
  echo "$KUZU_GATE_OUT"
fi
```

The `fail` helper increments `FAIL`, and the SUMMARY block exits 1 on any `FAIL`, so this shape is genuinely load-bearing (satisfies T1). Section 16 is the identical shape with `STOP_SCHEMA_OUT` / `STOP_SCHEMA_CODE`.

**Implication for the plan:** the gate needs a `scripts/check-brain-tool-liveness.cjs` (a script, not just a test) so section 18 has something to invoke, matching how 16 and 17 each own a `scripts/check-*.cjs`. Section 16's comment also records the precedent that a `check-*.cjs` should enumerate off `hooks/hooks.json` rather than hand-guess:

> `scripts/check-hook-schema-compatibility.cjs` enumerates every script Claude Code registers as a Stop hook straight off hooks/hooks.json's Stop array (never hand-guessed)

---

### `lib/core/seam-liveness.cjs` - the grounding comment to correct

Verbatim lines 96-100 (the bug laundered into the helper's own evidence):

```javascript
 * underscore between server and tool, confirmed from direct repo evidence
 * rather than assumed -- this repo's own hooks/hooks.json already matches on
 * "mcp__brain_.*" in its PreToolUse/PostToolUse entries, and the same shape is
 * visible in live registered tool names (mcp__langtalks-graph-expert__query_
 * relationship).
```

The `mcp__langtalks-graph-expert__query_relationship` half of the citation is correct and should survive; only the `hooks/hooks.json` half is circular and must be replaced with the official-docs citation plus a pointer to Phase 239.

**Do NOT modify** `checkHookMatcherLiveness` itself (lines 112-119, verbatim) - it is the reused helper and its red/green semantics are frozen by `seam-liveness.test.cjs`:

```javascript
function checkHookMatcherLiveness(matcherToolNames, liveToolNames) {
  const live = toLiveSet(liveToolNames);
  return assertSeamLive({
    name: 'hook-matcher-names-a-live-tool',
    claims: Array.isArray(matcherToolNames) ? matcherToolNames : [],
    isLive: (toolName) => live.has(toolName),
  });
}
```

---

### `hooks/hooks.json` - the two literals

PreToolUse (line 235-244, verbatim) and PostToolUse (line 337-346, verbatim) are byte-identical in matcher:

```json
      {
        "matcher": "mcp__brain_.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/part8-egress-guard-hook.cjs\"",
            "timeout": 2000
          }
        ]
      }
```

```json
      {
        "matcher": "mcp__brain_.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/brain-response-sanitize-hook.cjs\"",
            "timeout": 3000
          }
        ]
      }
```

---

### `agents/persona-analyst.md` (Open Question 3)

Verbatim lines 6-13:

```yaml
allowed-tools:
  - Read
  - Write
  - Glob
  - WebSearch
  - WebFetch
  - mcp__brain_search
  - mcp__brain_query
```

`scripts/verify-release` section 6 already validates `allowed-tools` entries, but only for **inline-comment syntax**, not for tool liveness:

```bash
  FRONTMATTER=$(sed -n '1,/^---$/p' "$file" 2>/dev/null | tail -n +2 | sed '$d')
  if echo "$FRONTMATTER" | grep -A 50 "^allowed-tools:" 2>/dev/null | grep -E "^\s*-.*\(or |^\s*-.*fallback:|^\s*-.*\). If " > /dev/null 2>&1; then
```

That is a genuine adjacent coverage gap: section 6 would not have caught this. Note it in the plan; extending section 6 is optional scope, the two-line frontmatter fix is not.

---

## Shared Patterns

### Fail-CLOSED in-code belt vs fail-OPEN hook

**Sources:** `scripts/part8-egress-guard-hook.cjs` (fail-OPEN, A3) and `lib/core/bono/persona-research.cjs:208-233` (fail-CLOSED).
**Apply to:** every `brain-client.cjs` guard insert.

The two postures are deliberate and complementary (T6). Hook errors `return allow()`; in-code belt non-allow verdicts must SKIP the Brain leg and disclose a reason. Do not unify them.

### Disclosed-degrade reason strings

**Source:** `persona-research.cjs` - `degraded_reasons.push('brain_egress_' + verdict)`, `'brain_call_threw'`.
**Apply to:** `hatAwareRecommend`, `suggestValidationSteps`.
A skipped Brain leg must be structurally visible, never a silent `null` (this is also the answer to Open Question 5: the extra `null` returns are an intended, disclosed consequence).

### Scalars-only telemetry

**Source:** `sendPacket`'s `_logEventBestEffort` call (excerpted above) - writes `egress_class`, `verdict`, `count`, `created_by`, `source_path`. Never the payload, never the tool name.
**Apply to:** any telemetry the new guard inserts. Confirms the Runtime State Inventory finding that the tool name is never persisted, so BRAIN-01 needs no data migration.

### `require`-in-try/catch for cross-module guard resolution

**Source:** both hook scripts and the `sendPacket` belt all wrap `require('./part8-egress-guard.cjs')` in try/catch.
**Apply to:** the `brain-client.cjs` inserts (also avoids a circular-require hazard; `hatAwareRecommend` already uses the lazy-require idiom for `hat-persistence.cjs`: `// Lazy-require to avoid circular dependency at module load time`).

---

## Census Addendum: `mcp__brain_` literals the research did not list

Full tracked-source grep (excluding `node_modules`, `.planning`). RESEARCH.md Pitfall 3 listed `agents/persona-analyst.md`, `grill-engine.cjs:172,286`, `online-pattern-query.cjs:22`. These are **additional** and belong in the plan's census criterion:

| File | Line(s) | Kind |
|------|---------|------|
| `lib/core/security/agentshield-scanner.cjs` | 146, 156 | live default `toolName: 'mcp__brain_query'` in a scanner call path (not just a fixture) |
| `lib/core/mva-detect.smoke.test.cjs` | 181 | regex fixture `/mcp__brain_/` |
| `lib/core/mva-orchestrator.test.cjs` | 332 | regex fixture `/mcp__brain_/` |
| `lib/core/part8-egress-guard.test.cjs` | 114, 117, 120, 130, 136, 147, 163 | 7 fixtures (research said "fixtures", did not enumerate) |
| `dist/generic-claude-dir/.claude/skills/intelligence-orchestrator/SKILL.md` | 20, 108 | build artifact; regenerated, not hand-edited |
| `CHANGELOG.md` | 1589 | historical record; do NOT rewrite history |
| `references/research/RESEARCH_16_*.md` | 212, 439, 515 | archived research prose; out of scope |

`agentshield-scanner.cjs:156` (`callOpts = { toolName: opts.toolName || 'mcp__brain_query' }`) is the one that deserves a look as possibly live rather than fixture.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/test-239-brain-tool-liveness.cjs` (the stdio `tools/list` handshake half) | test | request-response | No existing test in the repo drives `bin/mindrian-brain-mcp-client.cjs` over stdio JSON-RPC. Use RESEARCH.md Pattern 3's numbered handshake sequence as the spec, and `lib/core/seam-liveness.test.cjs` for the assertion idiom. The composed-name step (`'mcp__plugin_' + pluginName + '_' + serverName + '__' + bare`) must read `pluginName` from `.claude-plugin/plugin.json` and `serverName` from `.mcp.json` at run time, never hardcoded (Phase 235 Decision (e)). |
| `scripts/check-brain-tool-liveness.cjs` | config/gate script | batch | New; model the invocation contract on `scripts/check-kuzu-reintroduction.cjs` / `scripts/check-hook-schema-compatibility.cjs` (exit 0 = pass, stdout = the failure detail), and the `hooks.json` walk on `agentshield-run.cjs::gatherHookCommands`. |

**`gatherHookCommands` walk shape to reuse** (`lib/core/security/agentshield-run.cjs:131-148`, verbatim - swap `.command` for `.matcher` at the group level, note matchers live on the OUTER group, not the inner hook):

```javascript
function gatherHookCommands(opts) {
  const root = _root(opts);
  const out = [];
  const doc = _readJsonOrNull(path.join(root, 'hooks', 'hooks.json'));
  const hooks = doc && doc.hooks && typeof doc.hooks === 'object' ? doc.hooks : null;
  if (!hooks) return out;

  const hookTypes = Object.keys(hooks);
  for (let t = 0; t < hookTypes.length; t++) {
    const hookType = hookTypes[t];
    const groups = Array.isArray(hooks[hookType]) ? hooks[hookType] : [];
    let idx = 0;
    for (let g = 0; g < groups.length; g++) {
      const inner = groups[g] && Array.isArray(groups[g].hooks) ? groups[g].hooks : [];
      for (let h = 0; h < inner.length; h++) {
        const cmd = inner[h] && inner[h].command;
        if (typeof cmd !== 'string' || cmd.length === 0) continue;
        ...
```

---

## Metadata

**Analog search scope:** `hooks/`, `lib/core/`, `lib/core/bono/`, `lib/core/navigation/`, `lib/core/security/`, `scripts/`, `tests/`, `agents/`, `bin/`
**Files read from disk:** 16
**Repo-wide greps run:** `mcp__brain_` (all tracked types), `MintRatifierLiveness`, `node:http` in `tests/` + `lib/`, `verify-release` section headers
**Pattern extraction date:** 2026-07-28
