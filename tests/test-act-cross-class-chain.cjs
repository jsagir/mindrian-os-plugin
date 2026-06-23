'use strict';
/*
 * Phase 172-08 Task 4 (CIRS cross-class chaining / INV-08 / D-172-d) --
 * the generator's curatedChainEdges() resolve() accepts command/counterpart
 * endpoints so a curated_chains entry can express command -> pipeline ->
 * framework, and /mos:act can sequence a real cross-class chain off the LOCAL
 * projection. Navigator-directed 2026-06-23.
 *
 * Behaviors:
 *   Test 1: resolve() accepts a command/counterpart endpoint (the exact
 *           `command:/mos:<slug>` id the projection uses) and does NOT throw;
 *           an UNKNOWN endpoint STILL throws (referential integrity preserved).
 *   Test 2: a curated_chains entry command:<...> -> framework:<name> materializes
 *           a FEEDS_INTO edge in the regenerated projection.
 *   Test 3: at least one command -> pipeline -> framework sequence exists in the
 *           committed projection (the act-sequenceable cross-class chain).
 *   Test 4: no new edge TYPE, node TYPE, or reach is minted; the frozen
 *           ALLOWED_EDGE_TYPES + the 6-reach / 3-posture banks are untouched;
 *           zero Brain at build/rank time (Part 8 / INV-12).
 *
 * Pure in-process: requires the generator module + reads the committed projection
 * JSON. Zero subprocess, zero Brain.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const proj = require(path.join(REPO_ROOT, 'scripts', 'build-orchestration-projection.cjs'));
const { REACH_IDS, POSTURE_IDS } = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

console.log('test-act-cross-class-chain');

// ---------------------------------------------------------------------------
// Test 1: resolve() accepts a command/counterpart endpoint; unknown still throws.
// ---------------------------------------------------------------------------
const fwIds = new Set(['framework:Scenario Planning']);
const reachIds = new Set(REACH_IDS.map((r) => 'reach:' + r));
const cmdIds = new Set(['command:/mos:pipeline', 'command:/mos:find-bottlenecks']);
const allIds = new Set([...fwIds, ...reachIds, ...cmdIds]);

{
  const edges = [];
  const seen = new Set();
  const addEdge = proj.makeAddEdge(allIds, edges, seen);
  let threw = false;
  try {
    proj.curatedChainEdges(
      { curated_chains: [{ kind: 'feeds_into', from: 'command:/mos:find-bottlenecks', to: 'command:/mos:pipeline' }] },
      fwIds, reachIds, cmdIds, addEdge
    );
  } catch (_e) { threw = true; }
  ok('Test 1: a KNOWN command/counterpart endpoint resolves (no throw)', threw === false);
  ok('Test 1: the command->command FEEDS_INTO edge materialized', edges.length === 1
    && edges[0].type === 'FEEDS_INTO'
    && edges[0].from === 'command:/mos:find-bottlenecks'
    && edges[0].to === 'command:/mos:pipeline');
}

{
  const edges = [];
  const seen = new Set();
  const addEdge = proj.makeAddEdge(allIds, edges, seen);
  let threw = false;
  try {
    proj.curatedChainEdges(
      { curated_chains: [{ kind: 'feeds_into', from: 'command:/mos:does-not-exist', to: 'Scenario Planning' }] },
      fwIds, reachIds, cmdIds, addEdge
    );
  } catch (_e) { threw = true; }
  ok('Test 1: an UNKNOWN command endpoint STILL throws (referential integrity preserved)', threw === true);
}

// ---------------------------------------------------------------------------
// Test 2: command -> framework materializes a FEEDS_INTO edge.
// ---------------------------------------------------------------------------
{
  const edges = [];
  const seen = new Set();
  const addEdge = proj.makeAddEdge(allIds, edges, seen);
  proj.curatedChainEdges(
    { curated_chains: [{ kind: 'feeds_into', from: 'command:/mos:pipeline', to: 'Scenario Planning' }] },
    fwIds, reachIds, cmdIds, addEdge
  );
  ok('Test 2: command:<...> -> framework:<name> materializes a FEEDS_INTO edge',
    edges.length === 1
    && edges[0].type === 'FEEDS_INTO'
    && edges[0].from === 'command:/mos:pipeline'
    && edges[0].to === 'framework:Scenario Planning');
}

// ---------------------------------------------------------------------------
// Test 3: a committed command -> pipeline -> framework sequence exists in the
// regenerated/committed projection (the act-sequenceable cross-class chain).
// ---------------------------------------------------------------------------
const projection = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json'), 'utf8')
);
const feeds = (projection.edges || []).filter((e) => e && e.type === 'FEEDS_INTO');
// Find any command -> command:/mos:pipeline edge, then a command:/mos:pipeline -> framework edge.
const intoPipeline = feeds.filter((e) => e.to === 'command:/mos:pipeline' && /^command:/.test(e.from));
const pipelineOut = feeds.filter((e) => e.from === 'command:/mos:pipeline' && /^framework:/.test(e.to));
ok('Test 3: a command -> /mos:pipeline FEEDS_INTO edge exists in the projection', intoPipeline.length >= 1);
ok('Test 3: a /mos:pipeline -> framework FEEDS_INTO edge exists in the projection', pipelineOut.length >= 1);
ok('Test 3: the full command -> pipeline -> framework cross-class chain is sequenceable',
  intoPipeline.length >= 1 && pipelineOut.length >= 1);
// Report the concrete chain for the executor record.
if (intoPipeline.length >= 1 && pipelineOut.length >= 1) {
  console.log('       chain: ' + intoPipeline[0].from + ' -> command:/mos:pipeline -> ' + pipelineOut[0].to);
}

// ---------------------------------------------------------------------------
// Test 4: no new edge type / node type / reach minted; frozen banks intact.
// ---------------------------------------------------------------------------
const FROZEN_EDGE_TYPES = ['OPERATES', 'CHAINS', 'FEEDS_INTO', 'PREREQUISITE', 'CROSS_DOMAIN_ANALOGUE'];
const projEdgeTypes = new Set((projection.edges || []).map((e) => e && e.type));
let edgeTypesOk = true;
for (const t of projEdgeTypes) if (FROZEN_EDGE_TYPES.indexOf(t) === -1) edgeTypesOk = false;
ok('Test 4: projection edge types stay within the frozen closed set (no new edge type)', edgeTypesOk);

const FROZEN_NODE_KINDS = new Set(proj.NODE_KINDS);
let nodeKindsOk = true;
for (const n of (projection.nodes || [])) if (!FROZEN_NODE_KINDS.has(n.kind)) nodeKindsOk = false;
ok('Test 4: projection node kinds stay within the frozen closed set (no new node type)', nodeKindsOk);

ok('Test 4: exactly 6 frozen reaches (no 7th reach minted)', REACH_IDS.length === 6);
ok('Test 4: exactly 3 frozen postures', POSTURE_IDS.length === 3);

// Zero Brain at build time: the generator source carries no live brain require / fetch.
const genSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'build-orchestration-projection.cjs'), 'utf8');
const genCode = genSrc
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\*.*$/, '').replace(/\/\/.*$/, ''))
  .join('\n');
ok('Test 4: generator has no live brain-client require at build time (Part 8 / INV-12)',
  genCode.indexOf("require('") === -1 || genCode.indexOf('brain-client') === -1);
ok('Test 4: generator makes no raw fetch at build time',
  genCode.indexOf('fetch(') === -1);

// ALLOWED_EDGE_TYPES exposed by the generator matches the frozen 5.
const exportedEdgeTypes = Array.isArray(proj.EDGE_TYPES) ? proj.EDGE_TYPES : Object.keys(proj.EDGE_TYPES || {});
ok('Test 4: the generator ALLOWED/EDGE_TYPES is exactly the frozen 5',
  FROZEN_EDGE_TYPES.every((t) => exportedEdgeTypes.indexOf(t) !== -1)
    && exportedEdgeTypes.length === FROZEN_EDGE_TYPES.length);

console.log('\nPASS (' + pass + '/' + pass + ')');
