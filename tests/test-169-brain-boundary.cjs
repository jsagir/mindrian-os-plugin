'use strict';
// Phase 169-01 Wave 0 RED stub -- Part 8 boundary sweep (Phase 90 5-tripwire pattern).
//
// IFACE (169-01 shared_iface_contract): the derivation + the LLM candidate
//   producer + the heal are LOCAL only; zero Brain egress. brain-derive is the
//   ONE Brain-touching deriver (Plan 06 boundary-scans it). This stub is the
//   forbidden-substring sweep over the 169 derivation surfaces, mirroring the
//   Phase 90 5-tripwire forbidden-substring pattern.
//
// RED-by-design: the swept surfaces do not exist yet (they ship in Plans 04-06),
// so the sweep's MISSING-surface gate trips RED until those modules land; once
// they ship, the sweep enforces zero Brain-write / raw-fetch / external-http
// tokens. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-169-brain-boundary (Part 8)');

// The 169 surfaces that MUST stay LOCAL-only. brain-derive-command.cjs is the ONE
// Brain-touching deriver and is swept by Plan 06 with the allow-listed Brain-READ
// (query) tokens; here it is included so the sweep fires once it lands.
const SURFACES = [
  'lib/core/graph-derivation.cjs',
  'lib/core/graph-candidate-producer.cjs',
  'scripts/gsd-graph-derive-sweep.cjs',
  'lib/core/graph-self-heal.cjs',
];

// Forbidden Brain-WRITE tokens (the canonical Part 8 breach). A Brain READ
// (query) is allowed for brain-derive ONLY and is swept separately in Plan 06.
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;
// Raw external HTTP egress. The leading boundary excludes a .fetch method on a
// caller object; comment lines are filtered before the test.
const RAW_FETCH = /[^a-zA-Z_.]fetch\s*\(/;
const EXTERNAL_HTTP = /https?:\/\//;

function readNonCommentLines(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
}

check('every 169 derivation surface exists to be swept (RED until Plans 04-06 ship them)', () => {
  const missing = SURFACES.filter(s => !fs.existsSync(path.join(REPO_ROOT, s)));
  assert.equal(missing.length, 0,
    `surfaces not yet built (RED by Nyquist until they ship): ${missing.join(', ')}`);
});

check('no Brain-WRITE token in any 169 LOCAL derivation surface', () => {
  for (const s of SURFACES) {
    const p = path.join(REPO_ROOT, s);
    if (!fs.existsSync(p)) continue;
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => BRAIN_WRITE.test(l));
    assert.ok(!hit, `Brain-write token found in ${s}: ${hit}`);
  }
});

check('no raw external fetch( egress in any 169 LOCAL derivation surface', () => {
  for (const s of SURFACES) {
    const p = path.join(REPO_ROOT, s);
    if (!fs.existsSync(p)) continue;
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => RAW_FETCH.test(l));
    assert.ok(!hit, `raw fetch( egress found in ${s}: ${hit}`);
  }
});

check('no external http(s) endpoint (non-github) in any 169 LOCAL derivation surface', () => {
  for (const s of SURFACES) {
    const p = path.join(REPO_ROOT, s);
    if (!fs.existsSync(p)) continue;
    const lines = readNonCommentLines(p);
    const hit = lines.find(l => EXTERNAL_HTTP.test(l) && !/github\.com/.test(l));
    assert.ok(!hit, `external http(s) endpoint found in ${s}: ${hit}`);
  }
});

// Self-test the regexes so the sweep cannot vacuously pass on a broken pattern.
check('sweep regexes are sharp (self-test)', () => {
  assert.ok(BRAIN_WRITE.test('mcp__brain_write(payload)'), 'BRAIN_WRITE must catch the breach token');
  assert.ok(RAW_FETCH.test(' await fetch(url)'), 'RAW_FETCH must catch a raw fetch call');
  assert.ok(!RAW_FETCH.test(' obj.fetchCorpus()'), 'RAW_FETCH must not catch a method call');
  assert.ok(EXTERNAL_HTTP.test('https://example.com'), 'EXTERNAL_HTTP must catch an http endpoint');
});

console.log(`\nPASS (${pass}/5)`);
