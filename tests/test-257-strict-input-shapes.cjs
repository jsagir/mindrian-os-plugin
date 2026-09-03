#!/usr/bin/env node
'use strict';

/**
 * Phase 257 Plan 08 (D-09, LOCUS-07) -- close the undeclared-key smuggling gap.
 * ==========================================================================
 * PROVENANCE. Theo's GUARD-01 (`/home/jsagi/Theo/src/mcp/register-content-tool.ts`,
 * read-only, cross-repo) measured that a plain zod raw-shape input schema
 * silently DROPS an undeclared key (`{framework:'x', roomSecret:'LEAK'}` is
 * ACCEPTED, the handler receives only the declared field, nothing logs,
 * rejects, or traces the extra one). Theo measured this on
 * `@modelcontextprotocol/sdk` 1.30.0 with zod 4.4.3 -- a different zod major
 * than this repo pins. 257-RESEARCH.md's Assumption A3 explicitly gated
 * Recommendation 8 on re-measuring against THIS repo's own installed pins
 * before acting. This file's first four arms (Task 1) are that
 * re-measurement, pinned as permanent regression arms so a future zod major
 * bump that changes strict semantics fails here loudly instead of silently.
 *
 * MEASURED MECHANISM (also pinned below). `server.tool(name, description,
 * schema, cb)` detects its schema argument with `isZodRawShapeCompat`, which
 * returns FALSE for a ZodObject instance (a ZodObject is a schema, not a raw
 * shape) -- so passing `z.strictObject({...})` positionally falls into the
 * annotations branch and throws. `server.registerTool(name, {description,
 * inputSchema}, cb)`'s `inputSchema` goes through `getZodSchemaObject`, which
 * returns a ZodObject unchanged -- this is the form that preserves strictness
 * on the pinned SDK. Both these branches are read directly from
 * `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js` (verbatim
 * source path pinned in the Arm Z4 comments below, not asserted by grep).
 *
 * VERSIONS ARE DERIVED, NEVER FROZEN (257-RESEARCH.md Pitfall 4). This file
 * reads `node_modules/@modelcontextprotocol/sdk/package.json` and
 * `node_modules/zod/package.json` at run time and prints what it finds; it
 * does not assert against a frozen version literal, so a future dependency
 * bump does not require an edit here to stay honest -- if a bump silently
 * changes strict-object semantics, Arm Z2/Arm Z3 below will fail loudly
 * regardless of which version is installed.
 *
 * Task 1 arms (measurement, run against this tree, not the plan's numbers on
 * faith):
 *   Arm Z1 - installed SDK/zod versions, printed (not frozen-compared).
 *   Arm Z2 - a plain z.object({question}) silently drops an undeclared key.
 *   Arm Z3 - z.strictObject({question}) rejects an undeclared key with
 *            unrecognized_keys naming it.
 *   Arm Z4 - the three-way registration mechanism: positional tool() with a
 *            ZodObject throws; registerTool() with a ZodObject inputSchema is
 *            accepted; registerTool() with a raw shape is accepted.
 *
 * Task 3 arms (the wire proof, spawns the real shim, drives real JSON-RPC,
 * per lib/mcp/no-instructions.test.cjs doctrine -- ground truth, not a grep):
 *   Arm A - undeclared-key rejection on the wire, per tool. The exact
 *           Theo-measured anchor call, driven against every tool the live
 *           tools/list advertises.
 *   Arm B - the handler did not run: zero outbound capture-server requests
 *           for every Arm A call.
 *   Arm C - declared arguments alone still pass validation (non-error).
 *   Arm D - brain_query's params stays permissive for arbitrary sibling keys
 *           INSIDE params (only the top level is strict).
 *   Arm E - the zero-parameter risk case: brain_schema/brain_stats, both
 *           call shapes (arguments absent, arguments:{}), before vs after.
 *   Arm F - catalog parity: names, descriptions, declared parameters and the
 *           advertised additionalProperties:false, before vs after.
 *   Arm G - mutation leg: the pre-migration registration form (all six
 *           tools, including brain_ask) does NOT reject an undeclared key --
 *           proving Arm A is a meaningful, failable check, not a tautology.
 *
 * THE "BEFORE" FIXTURE. Arms E/F/G need the pre-migration shim to compare
 * against. This file spawns it from the EXACT pre-migration source via
 * `git show 7093e79b:bin/mindrian-brain-mcp-client.cjs` -- commit 7093e79b is
 * this same plan's own Task 1 commit (test-only, the shim was untouched at
 * that point), an immutable object already reachable from this repo's `main`
 * history, so this reference stays valid forever regardless of how many
 * commits land afterward (it is provenance, not a behavioral prediction --
 * not the frozen-tool-list class Pitfall 4 warns about). The pre-migration
 * source is spawned from a scratch directory OUTSIDE the repo tree
 * (os.tmpdir()), with lib/, .claude-plugin/ and node_modules/ SYMLINKED back
 * to this repo so its relative requires resolve identically to the real
 * file -- it never touches or mutates any tracked file. Both the "before"
 * and "after" shims stay connected simultaneously for the Arm E/F/G
 * comparisons; both are cleaned up in a shared `finally`.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SHIM = path.join(REPO, 'bin', 'mindrian-brain-mcp-client.cjs');
const PRE_MIGRATION_COMMIT = '7093e79b'; // Plan 08 Task 1 commit; shim untouched there.

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

let failed = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

async function recordAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Shim spawn harness (single spawn, many sequential requests over one stdio
// connection), the same pattern tests/test-257-brain-tool-egress-invariant.cjs
// established for this phase.
// ---------------------------------------------------------------------------
const spawnedPids = [];
const scratchDirs = [];

function spawnShimAt(shimPath, url) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-257-08-home-'));
  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_BRAIN_URL: url,
    MINDRIAN_BRAIN_KEY: 'test-key-not-real',
    MINDRIAN_DISABLE_AUTO_REGISTER: '1',
  });

  const proc = cp.spawn('node', [shimPath], { stdio: ['pipe', 'pipe', 'pipe'], env });
  if (typeof proc.pid === 'number') spawnedPids.push(proc.pid);

  let stdoutBuf = '';
  let stderrBuf = '';
  const pending = new Map();
  let nextId = 1;

  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (obj && typeof obj.id !== 'undefined' && pending.has(obj.id)) {
        const p = pending.get(obj.id);
        pending.delete(obj.id);
        clearTimeout(p.timer);
        p.resolve(obj);
      }
    }
  });
  proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
  proc.on('exit', (code) => {
    pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('shim exited (code=' + code + ') before responding; stderr tail: ' + stderrBuf.slice(-500)));
    });
    pending.clear();
  });

  // requestRaw: lets the caller omit the `arguments` key from params entirely
  // (Arm E's "arguments absent" shape) by only including it when explicitly
  // passed as part of `paramsObj`.
  function requestRaw(method, paramsObj) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('timeout waiting for ' + method + ' (id=' + id + '); stderr tail: ' + stderrBuf.slice(-500)));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      const payload = { jsonrpc: '2.0', id: id, method: method };
      if (paramsObj !== undefined) payload.params = paramsObj;
      proc.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  function request(method, params) {
    return requestRaw(method, params);
  }

  function notify(method, params) {
    proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', method: method }, params !== undefined ? { params: params } : {})) + '\n');
  }

  function cleanup() {
    try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  return { proc, request, requestRaw, notify, cleanup };
}

async function initShim(shim) {
  await shim.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-257-08-strict-input-shapes', version: '1.0.0' },
  });
  shim.notify('notifications/initialized');
}

function parseToolResult(resp) {
  const content = resp && resp.result && resp.result.content && resp.result.content[0];
  assert.ok(content && content.type === 'text', 'expected text content in tools/call result: ' + JSON.stringify(resp));
  return { text: content.text, isError: !!(resp.result && resp.result.isError) };
}

// ---------------------------------------------------------------------------
// The pre-migration scratch fixture. Written to os.tmpdir() (outside the
// repo tree) with lib/, .claude-plugin/ and node_modules/ SYMLINKED back to
// this repo so the pre-migration file's own relative requires resolve
// exactly as they did when it was the live file. Never touches a tracked
// file.
// ---------------------------------------------------------------------------
function buildPreMigrationScratchShim() {
  const source = cp.execFileSync('git', ['show', PRE_MIGRATION_COMMIT + ':bin/mindrian-brain-mcp-client.cjs'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.ok(source.indexOf("server.tool(\n  'brain_ask'") !== -1, 'pre-migration fixture sanity check failed -- expected the OLD positional brain_ask registration in commit ' + PRE_MIGRATION_COMMIT);
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-257-08-premigration-'));
  scratchDirs.push(scratchDir);
  fs.mkdirSync(path.join(scratchDir, 'bin'));
  const scratchShimPath = path.join(scratchDir, 'bin', 'mindrian-brain-mcp-client.cjs');
  fs.writeFileSync(scratchShimPath, source, 'utf8');
  fs.symlinkSync(path.join(REPO, 'lib'), path.join(scratchDir, 'lib'), 'dir');
  fs.symlinkSync(path.join(REPO, '.claude-plugin'), path.join(scratchDir, '.claude-plugin'), 'dir');
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(scratchDir, 'node_modules'), 'dir');
  return scratchShimPath;
}

// ---------------------------------------------------------------------------
// Per-tool fixtures. VALID_ARGS supplies only the data payload shape needed
// to drive a call, keyed by a name Arm A first asserts present in a live
// tools/list response -- the tool LIST itself is never frozen (Pitfall 4).
// ---------------------------------------------------------------------------
const CANARY_TOKEN = 'CANARY7F3A2B';
const VALID_ARGS = {
  brain_ask: { question: 'What framework should I use for an ill-defined problem?' },
  brain_query: { cypher: 'MATCH (f:Framework) RETURN f.name LIMIT 5' },
  brain_schema: {},
  brain_search: { query: 'reverse salient' },
  brain_stats: {},
  brain_write: { cypher: 'CREATE (f:Framework {name:"X"})' },
};

async function callToolShape(shim, toolName, shape) {
  if (shape === 'absent') {
    return parseToolResult(await shim.requestRaw('tools/call', { name: toolName }));
  }
  return parseToolResult(await shim.requestRaw('tools/call', { name: toolName, arguments: {} }));
}

function schemaFieldNames(toolEntry) {
  const props = (toolEntry && toolEntry.inputSchema && toolEntry.inputSchema.properties) || {};
  return Object.keys(props).sort();
}
function schemaRequiredNames(toolEntry) {
  const req = (toolEntry && toolEntry.inputSchema && toolEntry.inputSchema.required) || [];
  return req.slice().sort();
}

async function main() {
  const startedAt = Date.now();
  process.stdout.write('Phase 257-08 (D-09, LOCUS-07) strict input shapes -- undeclared-key smuggling gap\n');

  const { z } = require('zod');

  // -----------------------------------------------------------------------
  // Arm Z1: installed versions, derived from node_modules at run time.
  // -----------------------------------------------------------------------
  const sdkPkg = require(path.join(REPO, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'));
  const zodPkg = require(path.join(REPO, 'node_modules', 'zod', 'package.json'));
  const rootPkg = require(path.join(REPO, 'package.json'));
  record('Arm Z1: installed SDK/zod versions derived from node_modules (not frozen)', () => {
    assert.ok(typeof sdkPkg.version === 'string' && sdkPkg.version.length > 0, 'expected an installed SDK version string');
    assert.ok(typeof zodPkg.version === 'string' && zodPkg.version.length > 0, 'expected an installed zod version string');
    process.stdout.write(
      '    package.json pin: @modelcontextprotocol/sdk ' + rootPkg.dependencies['@modelcontextprotocol/sdk'] +
      ', zod ' + rootPkg.dependencies.zod + '\n' +
      '    installed:        @modelcontextprotocol/sdk ' + sdkPkg.version + ', zod ' + zodPkg.version + '\n'
    );
  });

  // -----------------------------------------------------------------------
  // Arm Z2: the plain shape silently drops an undeclared key. This is
  // Theo's GUARD-01 measurement, re-measured on this tree's own zod.
  // -----------------------------------------------------------------------
  record('Arm Z2: a plain z.object shape ACCEPTS and silently drops an undeclared key', () => {
    const r = z.object({ question: z.string() }).safeParse({ question: 'x', roomSecret: 'LEAK' });
    assert.strictEqual(r.success, true, 'expected the plain shape to accept the payload: ' + JSON.stringify(r));
    assert.deepStrictEqual(r.data, { question: 'x' }, 'expected the extra key to be silently absent from .data: ' + JSON.stringify(r.data));
    assert.ok(!Object.prototype.hasOwnProperty.call(r.data, 'roomSecret'), 'roomSecret must not survive into .data');
  });

  // -----------------------------------------------------------------------
  // Arm Z3: the strict shape rejects the same payload, naming the key.
  // -----------------------------------------------------------------------
  record('Arm Z3: z.strictObject REJECTS the same undeclared key with unrecognized_keys', () => {
    const r = z.strictObject({ question: z.string() }).safeParse({ question: 'x', roomSecret: 'LEAK' });
    assert.strictEqual(r.success, false, 'expected the strict shape to reject the payload: ' + JSON.stringify(r));
    const issue = r.error && r.error.issues && r.error.issues[0];
    assert.ok(issue, 'expected at least one zod issue: ' + JSON.stringify(r.error));
    assert.strictEqual(issue.code, 'unrecognized_keys', 'expected issue code unrecognized_keys, got: ' + JSON.stringify(issue));
    assert.ok(Array.isArray(issue.keys) && issue.keys.indexOf('roomSecret') !== -1, 'expected the issue to name roomSecret: ' + JSON.stringify(issue));
  });

  // -----------------------------------------------------------------------
  // Arm Z4: the three-way registration mechanism.
  // -----------------------------------------------------------------------
  await recordAsync('Arm Z4a: positional tool() with a strictObject schema THROWS', async () => {
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const s = new McpServer({ name: 'test-257-08-arm-z4a', version: '1.0.0' });
    let threw = null;
    try {
      s.tool('probe', 'desc', z.strictObject({ question: z.string() }), async () => ({ content: [] }));
    } catch (e) {
      threw = e && e.message;
    }
    assert.ok(threw, 'expected positional tool() with a ZodObject to throw, it did not');
    assert.ok(
      /expected a Zod schema or ToolAnnotations, but received an unrecognized object/.test(threw),
      'expected the specific isZodRawShapeCompat-branch message, got: ' + threw
    );
  });

  await recordAsync('Arm Z4b: registerTool() with a strictObject inputSchema is ACCEPTED', async () => {
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const s = new McpServer({ name: 'test-257-08-arm-z4b', version: '1.0.0' });
    s.registerTool(
      'probe',
      { description: 'desc', inputSchema: z.strictObject({ question: z.string() }) },
      async () => ({ content: [] })
    );
    assert.ok(true);
  });

  await recordAsync('Arm Z4c: registerTool() with a raw shape is ALSO accepted (uniform migration path)', async () => {
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const s = new McpServer({ name: 'test-257-08-arm-z4c', version: '1.0.0' });
    s.registerTool(
      'probe',
      { description: 'desc', inputSchema: { question: z.string() } },
      async () => ({ content: [] })
    );
    assert.ok(true);
  });

  // =========================================================================
  // TASK 3: THE WIRE PROOF. Both the real (post-migration) shim and the
  // pre-migration scratch shim are spawned and stay connected simultaneously
  // so Arms E/F/G can compare them directly; both are cleaned up together.
  // =========================================================================
  const { server: captureServer, url: captureUrl } = await startCaptureServer();
  const after = spawnShimAt(SHIM, captureUrl);
  const before = spawnShimAt(buildPreMigrationScratchShim(), captureUrl);

  try {
    await initShim(after);
    await initShim(before);

    const afterListResp = await after.request('tools/list', {});
    const liveNames = ((afterListResp.result && afterListResp.result.tools) || []).map((t) => t.name);
    const afterToolsList = {};
    (afterListResp.result.tools || []).forEach((t) => { afterToolsList[t.name] = t; });

    const beforeListResp = await before.request('tools/list', {});
    const beforeToolsList = {};
    (beforeListResp.result.tools || []).forEach((t) => { beforeToolsList[t.name] = t; });

    // -----------------------------------------------------------------
    // Arm A + Arm B data collection: one undeclared-key call per live
    // tool, response cached and checked from both angles below.
    // -----------------------------------------------------------------
    const armAResults = {};
    for (const toolName of liveNames) {
      const args = Object.assign({}, VALID_ARGS[toolName] || {}, { roomSecret: CANARY_TOKEN });
      resetCaptured();
      const resp = await after.request('tools/call', { name: toolName, arguments: args });
      const parsed = parseToolResult(resp);
      armAResults[toolName] = { resp: resp, parsed: parsed, capturedCount: captured.length, capturedSnapshot: JSON.stringify(captured) };
    }

    await recordAsync('Arm A: undeclared-key rejection on the wire, per tool (' + liveNames.join(', ') + ')', async () => {
      liveNames.forEach((toolName) => {
        const r = armAResults[toolName];
        assert.strictEqual(r.parsed.isError, true, toolName + ': expected an SDK validation error result for an undeclared key, got: ' + JSON.stringify(r.resp));
        assert.ok(
          /Invalid arguments|unrecognized_keys/i.test(r.parsed.text),
          toolName + ': expected the error text to name an invalid-arguments/unrecognized-keys condition, got: ' + r.parsed.text
        );
        assert.ok(r.parsed.text.indexOf(CANARY_TOKEN) === -1, toolName + ': the canary VALUE must not appear in the rejection text (only the key name roomSecret should): ' + r.parsed.text);
      });
    });

    await recordAsync('Arm B: the handler did not run -- zero outbound capture-server requests for every Arm A call', async () => {
      liveNames.forEach((toolName) => {
        const r = armAResults[toolName];
        assert.strictEqual(r.capturedCount, 0, toolName + ': a rejected call must never reach a handler or open a socket; captured: ' + r.capturedSnapshot);
      });
    });

    // -----------------------------------------------------------------
    // Arm C: declared arguments alone still pass validation.
    // -----------------------------------------------------------------
    await recordAsync('Arm C: declared arguments alone still pass validation (non-error), per tool', async () => {
      for (const toolName of liveNames) {
        resetCaptured();
        const resp = await after.request('tools/call', { name: toolName, arguments: VALID_ARGS[toolName] || {} });
        const parsed = parseToolResult(resp);
        assert.strictEqual(parsed.isError, false, toolName + ': declared-only arguments must not be rejected by validation, got: ' + JSON.stringify(resp));
      }
    });

    // -----------------------------------------------------------------
    // Arm D: brain_query's params stays permissive for arbitrary keys
    // INSIDE params -- only the top level is strict.
    // -----------------------------------------------------------------
    await recordAsync("Arm D: brain_query's params map stays permissive for arbitrary sibling keys inside it", async () => {
      const resp = await after.request('tools/call', {
        name: 'brain_query',
        arguments: { cypher: 'MATCH (f:Framework) RETURN f.name LIMIT 5', params: { anything: 1, elseEntirely: 'ok' } },
      });
      const parsed = parseToolResult(resp);
      assert.strictEqual(parsed.isError, false, 'expected params contents to pass validation (top-level strictness only), got: ' + JSON.stringify(resp));
    });

    // -----------------------------------------------------------------
    // Arm E: the zero-parameter risk case, both call shapes, before vs
    // after. arguments ABSENT and arguments:{} must behave identically
    // pre- and post-migration for brain_schema and brain_stats.
    // -----------------------------------------------------------------
    const zeroParamTools = liveNames.filter((n) => n === 'brain_schema' || n === 'brain_stats');
    assert.ok(zeroParamTools.length > 0, 'expected at least one zero-parameter tool (brain_schema/brain_stats) in the live catalog');

    await recordAsync('Arm E: zero-parameter tools, both call shapes, before vs after (' + zeroParamTools.join(', ') + ')', async () => {
      for (const toolName of zeroParamTools) {
        const beforeAbsent = await callToolShape(before, toolName, 'absent');
        const afterAbsent = await callToolShape(after, toolName, 'absent');
        process.stdout.write('    ' + toolName + ' (arguments absent): before.isError=' + beforeAbsent.isError + ' after.isError=' + afterAbsent.isError + '\n');
        assert.strictEqual(afterAbsent.isError, beforeAbsent.isError, toolName + ' (arguments absent): isError flipped by the migration -- before=' + JSON.stringify(beforeAbsent) + ' after=' + JSON.stringify(afterAbsent));

        const beforeEmpty = await callToolShape(before, toolName, 'empty');
        const afterEmpty = await callToolShape(after, toolName, 'empty');
        process.stdout.write('    ' + toolName + ' (arguments:{}):    before.isError=' + beforeEmpty.isError + ' after.isError=' + afterEmpty.isError + '\n');
        assert.strictEqual(afterEmpty.isError, beforeEmpty.isError, toolName + ' (arguments:{}): isError flipped by the migration -- before=' + JSON.stringify(beforeEmpty) + ' after=' + JSON.stringify(afterEmpty));
      }
    });

    // -----------------------------------------------------------------
    // Arm F: catalog parity, before vs after. Names, descriptions,
    // declared parameter names, and the advertised
    // additionalProperties:false, all compared.
    // -----------------------------------------------------------------
    await recordAsync('Arm F: catalog parity, before vs after (names, descriptions, declared parameters, additionalProperties:false)', async () => {
      const beforeNames = Object.keys(beforeToolsList).sort();
      const afterNames = Object.keys(afterToolsList).sort();
      assert.deepStrictEqual(afterNames, beforeNames, 'tool name set changed by the migration: before=' + JSON.stringify(beforeNames) + ' after=' + JSON.stringify(afterNames));

      afterNames.forEach((name) => {
        const b = beforeToolsList[name];
        const a = afterToolsList[name];
        assert.strictEqual(a.description, b.description, name + ': description string changed (must be byte-identical): before=' + JSON.stringify(b.description) + ' after=' + JSON.stringify(a.description));
        assert.deepStrictEqual(schemaFieldNames(a), schemaFieldNames(b), name + ': declared field-name set changed: before=' + JSON.stringify(schemaFieldNames(b)) + ' after=' + JSON.stringify(schemaFieldNames(a)));
        assert.deepStrictEqual(schemaRequiredNames(a), schemaRequiredNames(b), name + ': required field-name set changed: before=' + JSON.stringify(schemaRequiredNames(b)) + ' after=' + JSON.stringify(schemaRequiredNames(a)));

        const afterAP = a.inputSchema && a.inputSchema.additionalProperties;
        assert.strictEqual(afterAP, false, name + ': expected the AFTER advertised schema to carry additionalProperties:false, got: ' + JSON.stringify(a.inputSchema));

        // Honest finding, recorded not gated: zodToJsonSchema (the SDK's own
        // JSON-Schema converter) already emits additionalProperties:false for
        // a PLAIN z.object shape too -- so this specific advertised-schema
        // property is NOT new evidence of the hardening on its own; the real
        // hardening is the RUNTIME validation behavior Arm A proves (a plain
        // shape's own safeParse call still silently drops the extra key per
        // Arm Z2, even though its generated JSON Schema also already said
        // additionalProperties:false). Printed for the record, not asserted
        // either way.
        const beforeAP = b.inputSchema && b.inputSchema.additionalProperties;
        process.stdout.write('    ' + name + ': additionalProperties:false present before=' + beforeAP + ' after=' + afterAP + '\n');
      });
    });

    // -----------------------------------------------------------------
    // Arm G: mutation leg. The pre-migration registration form does NOT
    // reject an undeclared key on brain_ask -- proving Arm A is a
    // meaningful, failable check rather than a tautology. This reuses
    // the "before" shim (all six registrations reverted, a strict
    // superset of "one registration reverted") rather than constructing
    // a second scratch mutation, since Arm A's assertion is evaluated
    // per-tool and brain_ask alone is sufficient to prove the point.
    // -----------------------------------------------------------------
    await recordAsync('Arm G: mutation leg -- the pre-migration brain_ask registration does NOT reject an undeclared key', async () => {
      const args = Object.assign({}, VALID_ARGS.brain_ask, { roomSecret: CANARY_TOKEN });
      const resp = await before.request('tools/call', { name: 'brain_ask', arguments: args });
      const parsed = parseToolResult(resp);
      process.stdout.write('    pre-migration brain_ask + undeclared key: isError=' + parsed.isError + '\n');
      process.stdout.write('    pre-migration brain_ask + undeclared key: response text (truncated): ' + parsed.text.slice(0, 300) + '\n');
      assert.strictEqual(
        parsed.isError,
        false,
        'expected the PRE-MIGRATION brain_ask registration to silently ACCEPT the undeclared key (this is precisely the vulnerability Task 2 closes); got isError=true, which would mean Arm A never had anything real to catch'
      );
    });
  } finally {
    after.cleanup();
    before.cleanup();
    scratchDirs.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
    await stopCaptureServer(captureServer);
  }

  // Hygiene: no orphaned shim process spawned by this suite survives the
  // run. PID-specific check (not a `ps aux` substring scan), same idiom
  // Plan 07's invariant test established for this phase.
  function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (_e) { return false; }
  }
  async function waitForAllReaped(pids, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let remaining = pids.filter(isAlive);
    while (remaining.length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      remaining = remaining.filter(isAlive);
    }
    return remaining;
  }
  const stillAlive = await waitForAllReaped(spawnedPids, 2000);
  process.stdout.write(
    '  hygiene: ' + spawnedPids.length + ' shim process(es) spawned this run, ' +
    (stillAlive.length === 0 ? 'none still alive after cleanup' : ('STILL ALIVE: ' + JSON.stringify(stillAlive))) + '\n'
  );
  if (stillAlive.length > 0) failed += 1;

  const wallTimeMs = Date.now() - startedAt;
  process.stdout.write('  wall time: ' + wallTimeMs + 'ms\n');
  process.stdout.write(
    '\nPhase 257-08 strict input shapes: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  spawnedPids.forEach((pid) => { try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* already gone */ } });
  process.exit(1);
});
