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
 * Task 3 extends this same file with the wire arms (A-G): spawn the real
 * shim, drive real tools/call requests, prove the undeclared-key rejection on
 * the wire and the catalog parity, per the plan's <task type="auto"> block.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

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

async function main() {
  const startedAt = Date.now();
  process.stdout.write('Phase 257-08 (D-09, LOCUS-07) strict input shapes -- undeclared-key smuggling gap\n');

  const { z } = require('zod');

  // -----------------------------------------------------------------------
  // Arm Z1: installed versions, derived from node_modules at run time.
  // Printed only -- this arm records evidence, it does not gate on a frozen
  // literal (Pitfall 4). package.json's own caret ranges are read separately
  // below (from the live dependencies field, never hardcoded) and printed
  // alongside for the summary record.
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
  // Arm Z4: the three-way registration mechanism. This is the pitfall that
  // would otherwise cost a dead end -- the obvious fix (passing a strict
  // schema positionally to server.tool()) does not work on the pinned SDK.
  // Source: node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js,
  // isZodRawShapeCompat (returns false for a ZodObject instance) and the
  // tool()/registerTool() overload parsers.
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
    // Reaching here without throwing IS the acceptance proof.
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

  const wallTimeMs = Date.now() - startedAt;
  process.stdout.write('  wall time: ' + wallTimeMs + 'ms\n');
  process.stdout.write(
    '\nPhase 257-08 strict input shapes: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
