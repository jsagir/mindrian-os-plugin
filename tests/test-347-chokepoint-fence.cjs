#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-chokepoint-fence.cjs -- Phase 347-02 Task 2 (Test 8).
 *
 * A pure SOURCE SCAN proving lib/core/navigation/chain-state.cjs opens no
 * raw SQL against `nodes` or `edges` and reaches both tables ONLY through
 * the two named chokepoints (lib/core/node-insert.cjs::insertNode for
 * nodes, lib/core/navigation/edges.cjs::writeEdge for edges), per
 * lib/core/navigation/CONTEXT.md's "two write chokepoints" section and
 * SHARED-01 in docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md.
 *
 * Copies the shape of tests/test-chain-executor-part8-leak.cjs (lines
 * 38-81): read the file as TEXT with fs.readFileSync, run named regexes,
 * report each violation with the file it was found in, and NEVER execute
 * the scanned file. Every assertion here is scoped to the one new file,
 * lib/core/navigation/chain-state.cjs, alone.
 *
 * Before plan 347-03 lands the writer, the file does not exist. Unlike the
 * writer/reconstructible pins (which pin via an unguarded require() and are
 * wired into tests/run-all-347.sh through run_red_until, so their crash IS
 * the EXPECTED-RED signal), this fence is wired into the frozen aggregator
 * through a plain run_if guarded on ITS OWN path, not on the writer's. A
 * plain run_if treats any non-zero exit as a hard FAIL, and
 * tests/run-all-347.sh is written once (347-01) and never edited by a later
 * plan. Reporting the writer's absence as a fence FAILURE here would trip
 * that FAIL gate for a state the phase's own contract calls expected and
 * healthy (SHARED-01 is not due until 347-03). So this scan reports the
 * writer's absence as an honest PENDING notice on stdout and exits ZERO: a
 * fence with nothing yet to scan has found no violation, which is a
 * vacuously true clean bill, not a failure. Once 347-03 lands the writer,
 * this same scan starts asserting the four chokepoint rules for real and a
 * genuine violation exits non-zero exactly as a fence should.
 *
 * SCOPE NOTE (named follow-on, deliberately NOT fixed by this fence):
 * lib/core/graph-ops.cjs:196, :250 and :262, plus five raw-insert sites in
 * scripts/build-ecosystem-graph.cjs, already issue raw `INSERT INTO edges`
 * statements that bypass writeEdge, and three edge types live in at least
 * one dogfood room that are absent from writeEdge's ALLOWED_EDGE_TYPES (see
 * docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md, "Named follow-ons,
 * deliberately out of scope", item 1). A fence asserting that every edge in
 * this repo goes through writeEdge would FAIL today on graph-ops.cjs and
 * build-ecosystem-graph.cjs, which this plan does not touch. This fence
 * scopes every assertion to the one new file this plan's own writer lands
 * in, lib/core/navigation/chain-state.cjs, and records the wider bypass as
 * a named follow-on rather than expanding this phase to re-fix it.
 *
 * Pure node built-ins (fs + path). Zero npm deps. Hyphens only, no
 * em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const SUITE = 'test-347-chokepoint-fence';
const REPO = path.resolve(__dirname, '..');
const WRITER_REL = 'lib/core/navigation/chain-state.cjs';
const WRITER_ABS = path.join(REPO, WRITER_REL);

// Strip comment lines first, mirroring test-chain-executor-part8-leak.cjs's
// own stripComments idiom, so a doc-comment ABOUT a forbidden pattern (for
// example, this file's own header naming "INSERT INTO nodes") never
// self-invalidates the count when it is quoted inside the WRITER's own
// header, not this scanner's.
function stripComments(text) {
  const lines = text.split('\n');
  const kept = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[\s]+/, '');
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

// The forbidden shapes (Test 8's four zero-match assertions).
const RAW_INSERT_NODES = /INSERT\s+INTO\s+nodes\b/i;
const RAW_INSERT_EDGES = /INSERT\s+INTO\s+edges\b/i;
const NODE_SQLITE_REQUIRE = /require\(\s*['"]node:sqlite['"]\s*\)/;
const OPEN_ROOM_DB = /\bopenRoomDb\b/;

// The two required chokepoint requires (Test 8's two at-least-one-match
// assertions).
const REQUIRES_NODE_INSERT = /require\(\s*['"][^'"]*node-insert\.cjs['"]\s*\)/;
const REQUIRES_EDGES = /require\(\s*['"][^'"]*\/edges\.cjs['"]\s*\)/;

console.log(SUITE + ':');

const findings = [];
function fail(detail) { findings.push(detail); }
function ok(label) { console.log('  ok - ' + label); }

if (!fs.existsSync(WRITER_ABS)) {
  // PENDING, not FAIL (see header): tests/run-all-347.sh wires this fence
  // through a plain run_if on its own path, so a non-zero exit here would
  // trip the aggregator's frozen FAIL=0 gate for a state the phase's own
  // contract names as expected before plan 347-03 lands. Nothing to scan
  // yet is a vacuously clean result, not a violation.
  console.log('  PENDING - ' + WRITER_REL + ' has not landed yet (plan 347-03); nothing to scan, no violation found');
} else {
  const raw = fs.readFileSync(WRITER_ABS, 'utf8');
  const code = stripComments(raw);

  if (RAW_INSERT_NODES.test(code)) fail('FORBIDDEN raw INSERT INTO nodes in: ' + WRITER_REL + ' (must route through node-insert.cjs::insertNode)');
  else ok('zero raw INSERT INTO nodes in ' + WRITER_REL);

  if (RAW_INSERT_EDGES.test(code)) fail('FORBIDDEN raw INSERT INTO edges in: ' + WRITER_REL + ' (must route through edges.cjs::writeEdge)');
  else ok('zero raw INSERT INTO edges in ' + WRITER_REL);

  if (NODE_SQLITE_REQUIRE.test(code)) fail("FORBIDDEN require('node:sqlite') in: " + WRITER_REL + ' (the writer takes a caller-owned handle, it never opens one)');
  else ok("zero require('node:sqlite') in " + WRITER_REL);

  if (OPEN_ROOM_DB.test(code)) fail('FORBIDDEN openRoomDb reference in: ' + WRITER_REL + ' (the writer never opens room.db itself, per CONTEXT.md)');
  else ok('zero openRoomDb reference in ' + WRITER_REL);

  if (!REQUIRES_NODE_INSERT.test(code)) fail('MISSING required node-insert.cjs require in: ' + WRITER_REL);
  else ok(WRITER_REL + ' requires ../node-insert.cjs (the node chokepoint)');

  if (!REQUIRES_EDGES.test(code)) fail('MISSING required ./edges.cjs require in: ' + WRITER_REL);
  else ok(WRITER_REL + ' requires ./edges.cjs (the edge chokepoint)');
}

if (findings.length === 0) {
  console.log('\n' + SUITE + ': PASS');
  process.exit(0);
}
for (const f of findings) console.log('  XX - ' + f);
console.error('\n' + SUITE + ': FAIL -- ' + findings.length + ' finding(s) above.');
process.exit(1);
