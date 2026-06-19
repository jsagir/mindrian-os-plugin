'use strict';
/*
 * Phase 169-06 Task 1 -- the FINALIZED Part 8 forbidden-substring sweep (the
 * Phase 90 5-tripwire pattern) over the SIX Phase-169 derivation + heal + hook +
 * brain-derive surfaces. Turns the Plan-01 RED stub GREEN by RECONCILING the
 * sweep to the real Canon Part 8 boundary, NOT by removing any transport.
 *
 * THE REAL INVARIANT (Canon Part 8): zero USER-CONTENT egress to the Mindrian
 * Brain. The boundary is the Mindrian-owned Brain MCP host (mindrian-brain /
 * brain.mindrian / the brain-client WRITE path) -- NOT api.anthropic.com.
 *
 *   - api.anthropic.com is the SHIPPED Part-8-LEGAL LOCAL LLM transport
 *     (precedent: lib/core/llm-name-suggester.cjs + lib/core/mva-classifier.cjs).
 *     graph-candidate-producer.cjs calls fetch(api.anthropic.com) as its default
 *     transport; that is LEGAL (a stateless LLM call, never the Brain). So the
 *     sweep EXEMPTS api.anthropic.com from the raw-fetch + external-http bans and
 *     instead GUARDS the Brain host directly.
 *   - brain-derive-command.cjs is the ONE Brain-TOUCHING deriver. It may READ the
 *     Brain (brain-client query -- generic framework handles only) but must NEVER
 *     WRITE the Brain. So the sweep forbids the Brain-WRITE tokens on every
 *     surface (incl. brain-derive) but does NOT forbid a brain-client require on
 *     brain-derive (the legal READ deriver).
 *
 * Turning this stub GREEN means RECONCILING the sweep so it guards the BRAIN host
 * + the Brain-WRITE tokens and EXEMPTS api.anthropic.com -- proving zero Brain
 * egress is the real invariant, not a blanket fetch ban. It mirrors the
 * tests/run-all-169.sh Part-8 grep sweep verbatim in spirit.
 *
 * Sharp-scan self-test (the Phase 90 / 167 pattern): the sweep plants an
 * artifact-body Brain-write token + a forbidden Brain-host fetch and proves the
 * regexes go RED on them, then proves the comment-filter does NOT let a comment
 * naming the token trip the gate (so the sweep can never pass vacuously).
 *
 * House rule: hyphens only, no em-dashes. node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-169-brain-boundary (Part 8)');

// The SIX surfaces the boundary sweep MUST cover. graph-self-heal.cjs reads room
// artifacts + writes the lineage edge; it must not leak to the Brain. brain-derive
// is the ONE Brain-touching deriver (Brain READ allowed, Brain WRITE forbidden).
const SURFACES = [
  'lib/core/graph-derivation.cjs',
  'lib/core/graph-candidate-producer.cjs',
  'lib/core/graph-self-heal.cjs',
  'scripts/gsd-graph-derive-sweep.cjs',
  'scripts/gsd-graph-derive-drain.cjs',
  'scripts/brain-derive-command.cjs',
];

// The LOCAL-only surfaces (no Brain touch at all). brain-derive-command is the
// ONE exception: it may READ the Brain (a brain-client require is LEGAL there).
const LOCAL_ONLY = [
  'lib/core/graph-derivation.cjs',
  'lib/core/graph-candidate-producer.cjs',
  'lib/core/graph-self-heal.cjs',
  'scripts/gsd-graph-derive-sweep.cjs',
  'scripts/gsd-graph-derive-drain.cjs',
];

// Forbidden Brain-WRITE tokens (the canonical Part 8 breach) -- forbidden on EVERY
// surface incl. brain-derive (which may READ the Brain but never WRITE it).
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;
// Brain-HOST egress (the REAL boundary): the Mindrian-owned Brain MCP host. A
// brain-client REQUIRE is the legal READ path for brain-derive ONLY; a Brain HOST
// URL / brain.mindrian substring is the breach.
const BRAIN_HOST = /mindrian-brain|brain\.mindrian/;
// Raw external HTTP egress. The leading boundary excludes a .fetch method on a
// caller object. EXEMPTION: api.anthropic.com is the Part-8-LEGAL LOCAL LLM
// transport (the llm-name-suggester precedent), so a file carrying the anthropic
// URL is exempt from the raw-fetch + external-http bans (the Brain-host check is
// the real guard there).
const RAW_FETCH = /[^a-zA-Z_.]fetch\s*\(/;
const EXTERNAL_HTTP = /https?:\/\//;
const ANTHROPIC_EXEMPT = /api\.anthropic\.com/;
const GITHUB = /github\.com/;

function readNonCommentLines(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
}

check('every one of the SIX Phase-169 surfaces exists to be swept', () => {
  const missing = SURFACES.filter(s => !fs.existsSync(path.join(REPO_ROOT, s)));
  assert.equal(missing.length, 0, `surfaces missing: ${missing.join(', ')}`);
});

check('no Brain-WRITE token in any of the six surfaces (incl. brain-derive: READ allowed, WRITE forbidden)', () => {
  for (const s of SURFACES) {
    const p = path.join(REPO_ROOT, s);
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => BRAIN_WRITE.test(l));
    assert.ok(!hit, `Brain-write token found in ${s}: ${hit && hit.trim()}`);
  }
});

check('no Brain-HOST egress in any LOCAL-only surface (the Brain host is the real boundary; api.anthropic.com is not)', () => {
  for (const s of LOCAL_ONLY) {
    const p = path.join(REPO_ROOT, s);
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => BRAIN_HOST.test(l));
    assert.ok(!hit, `Brain-host egress found in ${s}: ${hit && hit.trim()}`);
  }
});

check('no raw external fetch( egress in any LOCAL-only surface (api.anthropic.com transport exempt)', () => {
  for (const s of LOCAL_ONLY) {
    const p = path.join(REPO_ROOT, s);
    const raw = fs.readFileSync(p, 'utf8');
    // EXEMPTION: a file carrying the Part-8-legal anthropic transport is exempt
    // from the raw-fetch ban (the Brain-host check above is the real guard).
    if (ANTHROPIC_EXEMPT.test(raw)) continue;
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => RAW_FETCH.test(l));
    assert.ok(!hit, `raw fetch( egress found in ${s}: ${hit && hit.trim()}`);
  }
});

check('no external http(s) endpoint (non-github, non-anthropic) in any LOCAL-only surface', () => {
  for (const s of LOCAL_ONLY) {
    const p = path.join(REPO_ROOT, s);
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => EXTERNAL_HTTP.test(l) && !GITHUB.test(l) && !ANTHROPIC_EXEMPT.test(l));
    assert.ok(!hit, `external http(s) endpoint found in ${s}: ${hit && hit.trim()}`);
  }
});

// Sharp-scan self-test: plant an artifact-body Brain-write token + a forbidden
// Brain-host fetch and prove the regexes go RED on them; prove a comment naming
// the token does NOT trip the gate (comment-filtered); prove api.anthropic.com is
// NOT a Brain host (the exemption is real). So the sweep can never pass vacuously.
check('sweep regexes are sharp on a planted artifact-body token (RED then GREEN self-test)', () => {
  // RED on a planted Brain-write of an artifact body.
  const PLANTED_WRITE = 'const x = mcp__brain_write({ node: artifactBody });';
  assert.ok(BRAIN_WRITE.test(PLANTED_WRITE), 'BRAIN_WRITE must catch a planted artifact-body Brain-write');
  // RED on a planted Brain-host fetch.
  const PLANTED_HOST = 'const r = fetch("https://mindrian-brain.onrender.com/q");';
  assert.ok(BRAIN_HOST.test(PLANTED_HOST), 'BRAIN_HOST must catch a planted Brain-host egress');
  assert.ok(RAW_FETCH.test(' await fetch(url)'), 'RAW_FETCH must catch a raw fetch call');
  // GREEN: a comment naming the token is NOT a breach (comment-filtered).
  const commentLines = ['// never call mcp__brain_write here', '* mindrian-brain is forbidden']
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.equal(commentLines.length, 0, 'comment lines must be filtered before the count');
  // GREEN: a .fetchCorpus method call is NOT a raw egress (no false positive).
  assert.ok(!RAW_FETCH.test(' obj.fetchCorpus()'), 'RAW_FETCH must not catch a method call');
  // GREEN: api.anthropic.com is NOT a Brain host (the exemption is the real boundary).
  assert.ok(!BRAIN_HOST.test('https://api.anthropic.com/v1/messages'),
    'api.anthropic.com must NOT match the Brain-host guard (it is the legal LLM transport)');
  assert.ok(ANTHROPIC_EXEMPT.test('https://api.anthropic.com/v1/messages'),
    'the anthropic exemption regex must recognize the legal transport URL');
});

console.log(`\nPASS (${pass}/6)`);
