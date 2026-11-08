#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 12, Task 1: top_k goes from 100 to 200 from one constant (owner card OD-3 = TOPK-200, E14).
 * The node caps stay 2,500 (decision D-06): the engine caps the bundle at 2,500.
 *
 * Arms (one line each at column 1: "ok - C<n> ..." or "FAIL - C<n> ..."):
 *   C1  the scout input schema accepts top_k 200 and refuses 201 and 0; node_ids still refuses 2,501 and
 *       accepts 2,500; max_artifacts still refuses 2,501
 *   C2  the pair-screen request check accepts top_k 200 and refuses 201; TOP_K_MAX equals 200; the scout schema
 *       reads the same constant (source check)
 *   C3  the node cap of 2,500 is unchanged at every site and 3000 is a cap nowhere in the five files
 *
 * In-process only. No engine, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const scout = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-graph-opportunity-scout.cjs'));
const pairScreen = require(path.join(REPO, 'lib', 'mcp', 'eureka-pair-screen.cjs'));

let failed = 0;
function chk(id, label, fn) {
  try {
    fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function scoutSchema() {
  let schema = null;
  const server = { registerTool(name, config) { if (name === 'eureka_graph_opportunity_scout') schema = config.inputSchema; } };
  scout.register(server, { surface: 'cli' });
  assert.ok(schema, 'the scout tool registered no input schema');
  return schema;
}

function ids(n) { return Array.from({ length: n }, (_v, i) => 'node-' + i); }
function parses(schema, extra, nodes) {
  return schema.safeParse({ node_ids: ids(nodes || 2), objective: 'find pairs', ...extra }).success;
}
function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }

chk('C1', 'scout schema: top_k 200 accepted, 201 and 0 refused; node caps still 2,500', () => {
  const schema = scoutSchema();
  assert.equal(parses(schema, { top_k: 200 }), true, 'top_k 200 refused');
  assert.equal(parses(schema, { top_k: 100 }), true, 'top_k 100 refused');
  assert.equal(parses(schema, { top_k: 201 }), false, 'top_k 201 accepted');
  assert.equal(parses(schema, { top_k: 0 }), false, 'top_k 0 accepted');
  assert.equal(parses(schema, {}, 2500), true, 'node_ids 2500 refused');
  assert.equal(parses(schema, {}, 2501), false, 'node_ids 2501 accepted');
  assert.equal(parses(schema, { max_artifacts: 2500 }), true, 'max_artifacts 2500 refused');
  assert.equal(parses(schema, { max_artifacts: 2501 }), false, 'max_artifacts 2501 accepted');
});

chk('C2', 'pair-screen request check: top_k 200 accepted, 201 refused; one constant read by the scout schema', () => {
  assert.equal(pairScreen.TOP_K_MAX, 200);
  const base = { node_ids: ids(3), objective: 'find pairs' };
  assert.equal(pairScreen.checkStartInput({ ...base, top_k: 200 }, {}), null, 'top_k 200 refused');
  const over = pairScreen.checkStartInput({ ...base, top_k: 201 }, {});
  assert.ok(over && over.ok === false && over.reason === 'invalid_request', 'top_k 201 not refused');
  assert.ok(/1 to 200/.test(over.message), 'the refusal sentence does not name 200');
  const src = read('lib/mcp/tools/eureka-graph-opportunity-scout.cjs');
  assert.ok(/top_k: z\.number\(\)\.int\(\)\.min\(1\)\.max\(TOP_K_MAX\)/.test(src), 'the scout schema does not read TOP_K_MAX');
  assert.ok(/TOP_K_MAX[^\n]*require\([^)]*eureka-pair-screen\.cjs|require\([^)]*eureka-pair-screen\.cjs[^)]*\)/.test(src), 'the scout does not import the pair-screen module');
});

chk('C3', 'node caps stay 2,500 at every site; 3000 is a cap nowhere (D-06)', () => {
  const must = [
    'lib/mcp/tools/eureka-graph-prepare-artifacts.cjs',
    'lib/mcp/tools/eureka-graph-projection.cjs',
    'lib/core/navigation/engine-projection.cjs',
    'lib/mcp/tools/eureka-graph-opportunity-scout.cjs',
    'lib/mcp/eureka-pair-screen.cjs',
  ];
  for (const rel of must) {
    const src = read(rel);
    assert.ok(/\b2500\b/.test(src), rel + ' lost its 2500');
    assert.ok(!/\b3000\b/.test(src), rel + ' holds 3000');
  }
  assert.ok(/NODE_IDS_MAX = 2500/.test(read('lib/mcp/eureka-pair-screen.cjs')), 'NODE_IDS_MAX is not 2500');
  assert.ok(/MAX_NODE_IDS = 2500/.test(read('lib/core/navigation/engine-projection.cjs')), 'MAX_NODE_IDS is not 2500');
});

process.stdout.write('test-374-caps: ' + (3 - failed) + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
