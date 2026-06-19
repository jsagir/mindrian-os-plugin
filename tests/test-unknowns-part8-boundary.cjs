'use strict';
/*
 * Phase 165-06 Task 1 -- the FINALIZED Part 8 forbidden-substring sweep (the Phase
 * 90 5-tripwire pattern, mirrored from tests/test-169-brain-boundary.cjs) over
 * EVERY lib/core/unknowns/*.cjs surface. Turns the Wave-0 RED stub GREEN by
 * RECONCILING the sweep to the real Canon Part 8 boundary -- it GUARDS the Brain
 * host + the Brain-WRITE tokens, NOT by weakening the invariant.
 *
 * THE REAL INVARIANT (Canon Part 8 / D-165-10): zero USER-CONTENT egress to the
 * Mindrian Brain. The unknown-unknowns engine is LOCAL-only: the corpus + proxy
 * scalars are LOCAL room.db reads, the bandit is index-deterministic, every
 * node/edge write routes through the navigation.cjs chokepoint (writeClaimNode /
 * writeEdge via the candidateToFinding clone), never a raw INSERT INTO. The HSI
 * arm-priority enrichment (open-question 1) stays OUTSIDE the bandit loop and is
 * NOT wired this phase, so the entire engine surface carries:
 *
 *   - NO Brain require / Brain-host URL / brain-client (zero Brain egress -- the
 *     Brain-WRITE tokens AND the Brain-host URL are forbidden on every surface;
 *     unlike the 169 brain-derive deriver there is NO legal Brain-READ surface in
 *     lib/core/unknowns/*, so a brain-client require is forbidden everywhere here).
 *   - NO raw INSERT INTO nodes|edges (all writes route through the chokepoint).
 *   - NO Math.random (D-165-09; the bandit is index-deterministic).
 *   - NO raw external fetch( / external http(s) endpoint (the engine never reaches
 *     the network -- there is no Part-8-legal LLM transport in this engine, so the
 *     api.anthropic.com exemption that 169 needed does NOT apply here).
 *
 * Sharp-scan self-test (the Phase 90 / 167 / 169 pattern): the sweep plants a
 * Brain-write token + a forbidden Brain-host fetch + a raw INSERT + a Math.random
 * and proves the regexes go RED on them, then proves the comment-filter does NOT
 * let a comment naming the token trip the gate (so the sweep can never pass
 * vacuously) and that a benign method call (.fetchCorpus) is not a false positive.
 *
 * House rule: hyphens only, no em-dashes (U+2014 referenced by escape only). node
 * built-ins only. Plain node harness.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const UNKNOWNS_DIR = path.join(REPO_ROOT, 'lib', 'core', 'unknowns');

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok - ' + label); }

console.log('test-unknowns-part8-boundary (D-165-10)');

// ---------------------------------------------------------------------------
// The sweep surface: EVERY lib/core/unknowns/*.cjs file (the COMPLETE engine
// surface the orchestrator -- the last module -- closed). Discovered from disk so
// a new engine module added later is automatically swept (never a hardcoded list
// that silently misses a surface).
// ---------------------------------------------------------------------------
const SURFACES = fs.readdirSync(UNKNOWNS_DIR)
  .filter((f) => f.endsWith('.cjs'))
  .sort()
  .map((f) => path.join('lib', 'core', 'unknowns', f));

// ---------------------------------------------------------------------------
// The forbidden-substring vocabulary (mirrors run-all-169 / run-all-164).
// ---------------------------------------------------------------------------
// The canonical Part 8 breach: a Brain-WRITE MCP call / write-to-Brain helper.
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;
// A smuggled Brain egress wire: the Mindrian Brain MCP host URL / a brain-client
// require / a brain-md require. There is NO legal Brain-READ surface in the
// unknowns engine, so any Brain require is forbidden on every surface here.
const BRAIN_REQUIRE = /mindrian-brain|brain\.mindrian|brain-client|brainClient|mcp__brain|brain-md/;
// A raw INSERT INTO the graph tables (the writes must ride the navigation
// chokepoint, never hand-rolled SQL).
const RAW_INSERT = /INSERT\s+INTO\s+(nodes|edges)\b/i;
// Non-determinism: Math.random anywhere (D-165-09).
const MATH_RANDOM = /Math\.random/;
// A raw external fetch( (the leading char class excludes a .fetchCorpus method).
const RAW_FETCH = /[^a-zA-Z_.]fetch\s*\(/;
// An external http(s) endpoint. The engine never reaches the network at all.
const EXTERNAL_HTTP = /https?:\/\//;

function readNonCommentLines(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
}

check('the engine surface is non-empty and includes the orchestrator (the last module to land)', () => {
  assert.ok(SURFACES.length >= 8,
    'expected the full engine surface (>=8 modules), found: ' + SURFACES.join(', '));
  const hasOrchestrator = SURFACES.some((s) => s.endsWith('orchestrator.cjs'));
  const hasEdgeWriter = SURFACES.some((s) => s.endsWith('edge-writer.cjs'));
  const hasIface = SURFACES.some((s) => s.endsWith('iface.cjs'));
  assert.ok(hasOrchestrator, 'orchestrator.cjs not in the swept surface');
  assert.ok(hasEdgeWriter, 'edge-writer.cjs not in the swept surface');
  assert.ok(hasIface, 'iface.cjs not in the swept surface');
});

check('no Brain-WRITE token in any lib/core/unknowns/*.cjs surface (zero Brain egress)', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => BRAIN_WRITE.test(l));
    assert.ok(!hit, 'Brain-write token found in ' + s + ': ' + (hit && hit.trim()));
  }
});

check('no Brain require / Brain-host egress in any unknowns surface (no legal Brain-READ surface in this engine)', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => BRAIN_REQUIRE.test(l));
    assert.ok(!hit, 'Brain require / host egress found in ' + s + ': ' + (hit && hit.trim()));
  }
});

check('no raw INSERT INTO nodes|edges in any unknowns surface (all writes ride the navigation chokepoint)', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => RAW_INSERT.test(l));
    assert.ok(!hit, 'raw INSERT INTO found in ' + s + ': ' + (hit && hit.trim()));
  }
});

check('no Math.random in any unknowns surface (D-165-09; the bandit is index-deterministic)', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => MATH_RANDOM.test(l));
    assert.ok(!hit, 'Math.random found in ' + s + ': ' + (hit && hit.trim()));
  }
});

check('no raw external fetch( in any unknowns surface (the engine never reaches the network)', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => RAW_FETCH.test(l));
    assert.ok(!hit, 'raw fetch( egress found in ' + s + ': ' + (hit && hit.trim()));
  }
});

check('no external http(s) endpoint in any unknowns surface', () => {
  for (const s of SURFACES) {
    const lines = readNonCommentLines(path.join(REPO_ROOT, s));
    const hit = lines.find((l) => EXTERNAL_HTTP.test(l));
    assert.ok(!hit, 'external http(s) endpoint found in ' + s + ': ' + (hit && hit.trim()));
  }
});

// ---------------------------------------------------------------------------
// Sharp-scan self-test: plant each forbidden token and prove the regex goes RED;
// prove a comment naming the token does NOT trip the gate (comment-filtered) and
// a benign .fetchCorpus method call is not a false positive. So the sweep can
// never pass vacuously.
// ---------------------------------------------------------------------------
check('sweep regexes are sharp on planted forbidden tokens (RED then GREEN self-test)', () => {
  // RED on each planted forbidden token.
  assert.ok(BRAIN_WRITE.test('const x = mcp__brain_write({ node: claimBody });'),
    'BRAIN_WRITE must catch a planted Brain-write');
  assert.ok(BRAIN_REQUIRE.test("require('../brain/brain-client.cjs')"),
    'BRAIN_REQUIRE must catch a planted brain-client require');
  assert.ok(BRAIN_REQUIRE.test('fetch("https://mindrian-brain.onrender.com/q")'),
    'BRAIN_REQUIRE must catch a planted Brain-host egress');
  assert.ok(RAW_INSERT.test('db.prepare("INSERT INTO nodes (id) VALUES (?)").run(x)'),
    'RAW_INSERT must catch a planted raw node insert');
  assert.ok(RAW_INSERT.test('INSERT INTO edges (source_id) VALUES (?)'),
    'RAW_INSERT must catch a planted raw edge insert');
  assert.ok(MATH_RANDOM.test('const r = Math.random();'),
    'MATH_RANDOM must catch a planted Math.random');
  assert.ok(RAW_FETCH.test(' await fetch(url)'),
    'RAW_FETCH must catch a raw fetch call');

  // GREEN: a comment naming the token is filtered before the scan (no vacuous pass).
  const commentLines = [
    '// never call mcp__brain_write here',
    '* mindrian-brain is forbidden',
    '/* INSERT INTO nodes is forbidden */',
    '// Math.random is banned (D-165-09)',
  ].filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.equal(commentLines.length, 0, 'comment lines must be filtered before the scan');

  // GREEN: a .fetchCorpus method call is NOT a raw egress (no false positive).
  assert.ok(!RAW_FETCH.test(' obj.fetchCorpus()'),
    'RAW_FETCH must not catch a method call');
  // GREEN: api.anthropic.com is NOT in the engine, but if it appeared it would be
  // a network endpoint and IS forbidden here (no LLM transport in this engine).
  assert.ok(EXTERNAL_HTTP.test('https://api.anthropic.com/v1/messages'),
    'EXTERNAL_HTTP must recognize an external endpoint (forbidden in this engine)');
});

console.log('\nPASS (' + pass + '/' + (pass) + ')');
console.log('test-unknowns-part8-boundary: GREEN (zero Brain egress / raw INSERT / Math.random / network over ' + SURFACES.length + ' lib/core/unknowns/* surfaces)');
process.exit(0);
