#!/usr/bin/env node
// Phase 385 plan 15: lib/core/pinecone-inference.cjs is removed (owner ruling R6 step 1 only).
// The Eureka scoring bridge and the step 3 surfaces stay.
// Node built-ins only. Lines start with `ok ` or `FAIL ` at column 1.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.stdout.split('\n').filter(Boolean);
}
const tracked = new Set(git(['ls-files']));
const isTest = (f) => /\.test\.cjs$/.test(f) || /(^|\/)test-[^/]*$/.test(f);
const isCommentLine = (line) => /^\s*(#|\/\/|\*|\/\*)/.test(line);

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

// Only files that exist in the working tree are read (a deleted, staged file is skipped).
function readTracked(f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; }
}

check('characterization: no non-test file under lib, scripts, bin, hooks requires pinecone-inference', () => {
  const hits = [];
  for (const f of tracked) {
    if (!/^(lib|scripts|bin|hooks)\//.test(f) || isTest(f)) continue;
    if (!/\.(cjs|js|mjs|ts)$/.test(f)) continue;
    const txt = readTracked(f);
    if (txt && /require\(\s*['"][^'"]*pinecone-inference[^'"]*['"]\s*\)/.test(txt)) hits.push(f);
  }
  assert.deepStrictEqual(hits, [], 'requirers: ' + hits.join(', '));
});

check('removal: the module and its 272 test are not tracked', () => {
  const left = ['lib/core/pinecone-inference.cjs', 'tests/272-pinecone-inference.test.cjs']
    .filter((f) => tracked.has(f) && fs.existsSync(path.join(ROOT, f)));
  assert.deepStrictEqual(left, [], 'still tracked: ' + left.join(', '));
});

check('production names: no tracked production file names pinecone-inference or embedViaPineconeInference', () => {
  const hits = [];
  for (const f of tracked) {
    if (!/^(lib|scripts|bin|hooks|commands|skills|agents|pipelines|data)\//.test(f)) continue;
    if (f === 'lib/core/pinecone-inference.cjs') { if (fs.existsSync(path.join(ROOT, f))) hits.push(f); continue; }
    const txt = readTracked(f);
    if (txt && /pinecone-inference|embedViaPineconeInference/.test(txt)) hits.push(f);
  }
  assert.deepStrictEqual(hits, [], 'files: ' + hits.join(', '));
});

check('test references: no tracked test file names pinecone-inference.cjs outside comment lines', () => {
  const self = 'tests/test-385-pinecone-inference-removed.cjs';
  const hits = [];
  for (const f of tracked) {
    if (!f.startsWith('tests/') || f === self) continue;
    const txt = readTracked(f);
    if (!txt || txt.indexOf('pinecone-inference.cjs') === -1) continue;
    const bad = txt.split('\n').filter((l) => l.indexOf('pinecone-inference.cjs') !== -1 && !isCommentLine(l));
    if (bad.length) hits.push(f + ' (' + bad.length + ' line(s))');
  }
  assert.deepStrictEqual(hits, [], 'files: ' + hits.join(', '));
});

check('bridge survives: the Eureka scoring modules are tracked and the bridge exports both functions', () => {
  const must = [
    'lib/core/rs-pinecone-bridge.cjs', 'lib/core/rs-differential-scorer.cjs', 'lib/core/rs-engine.cjs',
    'lib/core/hsi-engine.cjs', 'lib/core/hsi-lsa.cjs',
    'lib/core/semantic-index/embedding-spine.cjs', 'lib/core/semantic-index/vector-store.cjs',
  ];
  const missing = must.filter((f) => !tracked.has(f));
  assert.deepStrictEqual(missing, [], 'missing: ' + missing.join(', '));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-15-'));
  try {
    const r = spawnSync(process.execPath, ['-e',
      "const m=require(process.argv[1]);process.stdout.write(typeof m.cosineSimilarity+','+typeof m.queryPineconeWithVectors)",
      path.join(ROOT, 'lib', 'core', 'rs-pinecone-bridge.cjs')], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: tmp }),
    });
    assert.strictEqual(r.stdout, 'function,function', 'exports ' + r.stdout + ' ' + r.stderr);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

check('step 3 untouched: compute-hsi.py and the pinecone line in requirements-hsi.txt stay', () => {
  assert.ok(tracked.has('scripts/compute-hsi.py'), 'scripts/compute-hsi.py not tracked');
  assert.ok(tracked.has('requirements-hsi.txt'), 'requirements-hsi.txt not tracked');
  const txt = fs.readFileSync(path.join(ROOT, 'requirements-hsi.txt'), 'utf8');
  assert.ok(txt.split('\n').some((l) => l.startsWith('pinecone')), 'no line starts with pinecone');
});

process.exit(failed ? 1 : 0);
