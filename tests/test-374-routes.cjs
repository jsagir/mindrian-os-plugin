#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 08, Task 1: the pair-screen route sets (decisions D-03, D-10).
 *
 * Arms (one line each, "ok - R<n> ..." or "FAIL - R<n> ..." at column 1):
 *   R1  ALLOWED_MCP_ROUTES holds scout_start_pair_screen; PLAN_ROUTES holds the plan route;
 *       ALLOWED_MCP_ROUTES does not hold the plan route; an unknown route is still unsupported_mcp_route
 *   R2  resolveCapability keeps plan_tool; a plan_tool outside PLAN_ROUTES is unsupported_mcp_route;
 *       the plan route literal appears in the product source only in the PLAN_ROUTES definition
 *   R3  invokeCapabilityWithClient refuses a pair-screen route with capability_requires_approval and
 *       makes no tool call
 *   R4  ASYNC_ROUTES of the jobs file holds scout_start_pair_screen
 *
 * In-process fake client. No engine, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));

const START = 'scout_start_pair_screen';
const PLAN = 'scout_plan_pair_screen';

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function catalogWith(entry) { return { capabilities: [entry] }; }
function entry(routes) {
  return { id: 'opportunity.run_pair_screen', status: 'experimental', routes: { mcp: routes } };
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(cjs|js|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  await arm('R1', 'the start route is allowed, the plan route is a plan route only, an unknown route is refused', async () => {
    assert.ok(run.ALLOWED_MCP_ROUTES.has(START), 'ALLOWED_MCP_ROUTES lacks the start route');
    assert.ok(run.PLAN_ROUTES instanceof Set, 'PLAN_ROUTES is not exported as a Set');
    assert.ok(run.PLAN_ROUTES.has(PLAN), 'PLAN_ROUTES lacks the plan route');
    assert.ok(!run.ALLOWED_MCP_ROUTES.has(PLAN), 'ALLOWED_MCP_ROUTES must not hold the plan route');
    const r = run.resolveCapability(catalogWith(entry({ tool: 'scout_not_a_route' })), 'opportunity.run_pair_screen');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unsupported_mcp_route');
  });

  await arm('R2', 'plan_tool is kept, a foreign plan_tool is refused, the literal sits only in PLAN_ROUTES', async () => {
    const good = run.resolveCapability(catalogWith(entry({ tool: START, plan_tool: PLAN })), 'opportunity.run_pair_screen');
    assert.equal(good.ok, true);
    assert.equal(good.capability.plan_tool, PLAN);
    const bad = run.resolveCapability(catalogWith(entry({ tool: START, plan_tool: 'scout_run_workflow' })), 'opportunity.run_pair_screen');
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'unsupported_mcp_route');
    // a route without a plan_tool still resolves for the other capabilities
    const other = run.resolveCapability(catalogWith({ id: 'x', status: 'experimental', routes: { mcp: { tool: 'scout_start' } } }), 'x');
    assert.equal(other.ok, true);
    assert.ok(!('plan_tool' in other.capability) || other.capability.plan_tool === undefined);
    const hits = [];
    for (const f of walk(path.join(REPO, 'lib'), [])) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => { if (line.indexOf(PLAN) !== -1) hits.push(path.relative(REPO, f) + ':' + (i + 1) + ': ' + line.trim()); });
    }
    assert.equal(hits.length, 1, 'expected 1 source line with the plan route literal, found ' + hits.length + ': ' + hits.join(' | '));
    assert.ok(/eureka-capability-run\.cjs/.test(hits[0]) && /PLAN_ROUTES/.test(hits[0]), 'the one line is not the PLAN_ROUTES definition: ' + hits[0]);
  });

  await arm('R3', 'the sync path refuses the pair screen with capability_requires_approval and makes no call', async () => {
    const calls = [];
    const client = { callTool: async (c) => { calls.push(c.name); return { structuredContent: {} }; } };
    const capability = { id: 'opportunity.run_pair_screen', status: 'experimental', routes: { mcp: { tool: START } }, plan_tool: PLAN };
    const r = await run.invokeCapabilityWithClient(client, capability, { objective: 'x' }, process.env);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'capability_requires_approval');
    assert.ok(/eureka_capability_start/.test(r.message), 'the message does not name eureka_capability_start');
    assert.deepEqual(calls, [], 'a tool call was made: ' + calls.join(','));
  });

  await arm('R4', 'the jobs file lists the pair-screen start route as asynchronous', async () => {
    const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
    assert.ok(jobs.ASYNC_ROUTES.has(START));
  });

  process.exit(failed ? 1 : 0);
}

main();
