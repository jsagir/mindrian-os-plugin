#!/usr/bin/env node
// Phase 390 plan 01: read-only checks behind the verified keep / recalibrate / cut table.
// FACT-01 to FACT-10 read the code. DOC-01 to DOC-05 read the four documents.
// Node built-ins only. No build, no generator, no network.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
if (top.status !== 0) {
  console.log('FAIL SETUP git rev-parse failed: ' + (top.stderr || '').trim());
  process.exit(1);
}
const root = top.stdout.trim();
const PHASE = '.planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table';
const TABLE = path.join(root, PHASE, '390-TABLE.md');
const PRD = path.join(root, PHASE, '390-PRD.md');
const AUDIT = path.join(root, '.planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md');

const ls = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
if (ls.status !== 0) {
  console.log('FAIL SETUP git ls-files failed: ' + (ls.stderr || '').trim());
  process.exit(1);
}
const files = ls.stdout.split('\n').filter(Boolean);

let failed = 0;
function check(id, reason, fn) {
  try {
    fn();
    console.log('ok   ' + id + ' ' + reason);
  } catch (e) {
    failed++;
    console.log('FAIL ' + id + ' ' + reason + ': ' + e.message);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function frontmatter(rel) {
  const text = read(rel);
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(rel + ' has no frontmatter');
  return m[1];
}

// ---- FACT checks (code) ----

check('FACT-01', 'commands/present.md has no deprecated key', () => {
  const fm = frontmatter('commands/present.md');
  assert.ok(!/^\s*deprecated\w*\s*:/m.test(fm), 'present.md frontmatter has a deprecated key');
});

check('FACT-02', 'commands/visualize.md has deprecated: true and deprecated_removal', () => {
  const fm = frontmatter('commands/visualize.md');
  assert.ok(/^deprecated\s*:\s*true\s*$/m.test(fm), 'no deprecated: true');
  assert.ok(/^deprecated_removal\s*:/m.test(fm), 'no deprecated_removal key');
});

check('FACT-03', 'check-render-coverage exits 0 and reports 0 unwired', () => {
  const r = spawnSync('node', ['scripts/check-render-coverage.cjs'], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw new Error('could not run: ' + r.error.message);
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.ok((r.stdout + r.stderr).includes('0 unwired'), 'output has no "0 unwired"');
});

check('FACT-04', 'mullins-scaffold is in the connector registry and the skill exists', () => {
  assert.ok(read('data/connector-registry.json').includes('mullins-scaffold'), 'not in data/connector-registry.json');
  assert.ok(fs.existsSync(path.join(root, 'skills/mullins-scaffold/SKILL.md')), 'skills/mullins-scaffold/SKILL.md is missing');
});

check('FACT-05', 'egress guard has no require naming grill-engine and defines METHODOLOGY_TECHNIQUE_WORDS', () => {
  const lines = read('lib/core/part8-egress-guard.cjs').split('\n');
  const bad = lines.map((l, i) => [l, i + 1]).filter(([l]) => l.includes('require(') && l.includes('grill-engine'));
  assert.strictEqual(bad.length, 0, 'require naming grill-engine at line ' + bad.map((b) => b[1]).join(','));
  assert.ok(lines.some((l) => l.includes('METHODOLOGY_TECHNIQUE_WORDS')), 'METHODOLOGY_TECHNIQUE_WORDS is not defined');
});

check('FACT-06', 'tests/test-213-part8-boundary.cjs requires grill-engine.cjs', () => {
  const lines = read('tests/test-213-part8-boundary.cjs').split('\n');
  assert.ok(lines.some((l) => l.includes('require(') && l.includes('grill-engine.cjs')), 'no line with require( and grill-engine.cjs');
});

check('FACT-07', 'each parent command names its agent', () => {
  const pairs = [
    ['find-analogies', 'analogy-query-fetcher'],
    ['scout', 'analogy-query-fetcher'],
    ['scout', 'competitor-watch-fetcher'],
    ['dominant-designs', 'dominant-design-researcher'],
    ['research', 'research-lane-analyst'],
    ['vault', 'vault-section-reviewer'],
    ['file-meeting', 'meeting-perspective-extractor'],
    ['scout', 'meeting-perspective-extractor'],
  ];
  const miss = pairs.filter(([cmd, agent]) => !read('commands/' + cmd + '.md').includes(agent));
  assert.strictEqual(miss.length, 0, 'missing pairs: ' + miss.map((p) => p.join('->')).join(', '));
});

const HELPERS = [
  'analogy-query-fetcher',
  'competitor-watch-fetcher',
  'dominant-design-researcher',
  'research-lane-analyst',
  'vault-section-reviewer',
  'meeting-perspective-extractor',
  'chain-step-reviewer',
];

check('FACT-08', 'larry-extended and agent-operations name none of the seven helper agents', () => {
  const hit = [];
  for (const f of ['agents/larry-extended.md', 'references/personality/agent-operations.md']) {
    const text = read(f);
    for (const a of HELPERS) if (text.includes(a)) hit.push(f + ':' + a);
  }
  assert.strictEqual(hit.length, 0, 'found ' + hit.join(', '));
});

check('FACT-09', 'exactly investor, grading and opportunity-scanner carry PROACTIVELY', () => {
  const agentFiles = files.filter((f) => /^agents\/[^/]+\.md$/.test(f));
  const withWord = agentFiles.filter((f) => read(f).includes('PROACTIVELY')).map((f) => path.basename(f, '.md')).sort();
  assert.deepStrictEqual(withWord, ['grading', 'investor', 'opportunity-scanner']);
});

const EXPECTED_BRIDGE = [
  'lib/core/hsi-engine.cjs',
  'lib/core/hsi-lsa.cjs',
  'lib/core/rs-differential-scorer.cjs',
  'lib/core/rs-engine.cjs',
  'lib/core/semantic-index/embedding-spine.cjs',
  'lib/core/semantic-index/vector-store.cjs',
];

function isProduction(f) {
  if (/^(tests|evals|r-and-d|dist|\.planning|docs)\//.test(f)) return false;
  if (f === 'CHANGELOG.md') return false;
  if (f.endsWith('.test.cjs')) return false;
  if (path.basename(f).startsWith('test-')) return false;
  return true;
}

check('FACT-10', 'exactly 6 production files require rs-pinecone-bridge', () => {
  const found = [];
  for (const f of files) {
    if (!isProduction(f)) continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(root, f));
    } catch (_) {
      continue;
    }
    if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) continue;
    const lines = buf.toString('utf8').split('\n');
    if (lines.some((l) => l.includes('require(') && l.includes('rs-pinecone-bridge'))) found.push(f);
  }
  found.sort();
  assert.deepStrictEqual(found, EXPECTED_BRIDGE.slice().sort());
});

// ---- DOC checks (documents) ----

function readDoc(p) {
  if (!fs.existsSync(p)) throw new Error('missing file ' + path.relative(root, p));
  return fs.readFileSync(p, 'utf8');
}

check('DOC-01', '390-TABLE.md has ## Corrections and exactly rows C1 to C5', () => {
  const text = readDoc(TABLE);
  const lines = text.split('\n');
  assert.ok(lines.some((l) => l.trim() === '## Corrections'), 'no "## Corrections" line');
  const rows = lines.filter((l) => /^\| C[1-5] \|/.test(l));
  assert.strictEqual(rows.length, 5, 'found ' + rows.length + ' correction rows');
  for (let n = 1; n <= 5; n++) assert.ok(rows.some((r) => r.startsWith('| C' + n + ' |')), 'no row C' + n);
});

check('DOC-02', 'correction rows carry the verified key words', () => {
  const lines = readDoc(TABLE).split('\n');
  const row = (n) => lines.find((l) => l.startsWith('| C' + n + ' |')) || '';
  const need = [
    [1, ['present', 'live']],
    [2, ['0 unwired']],
    [3, ['METHODOLOGY_TECHNIQUE_WORDS']],
    [4, ['file-meeting']],
    [5, ['6 production']],
  ];
  const miss = [];
  for (const [n, words] of need) for (const w of words) if (!row(n).includes(w)) miss.push('C' + n + ':' + w);
  assert.strictEqual(miss.length, 0, 'missing ' + miss.join(', '));
});

check('DOC-03', '390-PRD.md has Addendum 4 and the inline pointer', () => {
  const lines = readDoc(PRD).split('\n');
  assert.ok(lines.some((l) => l.startsWith('## Addendum 4')), 'no "## Addendum 4" heading');
  assert.ok(lines.some((l) => l.includes('9 requirers') && l.includes('corrected by plan 390-01')), 'no line with "9 requirers" and "corrected by plan 390-01"');
});

check('DOC-04', 'audit file has 4 CORRECTED notes and keeps the old claims', () => {
  const raw = readDoc(AUDIT);
  const text = raw.replace(/`/g, ''); // the audit wraps render-coverage in backticks; compare the words
  const n = text.split('\n').filter((l) => l.includes('CORRECTED (390-01)')).length;
  assert.ok(n >= 4, 'only ' + n + ' lines with CORRECTED (390-01)');
  assert.ok(text.includes('render-coverage already counts it as an unwired declaration'), 'old mullins claim is gone');
  assert.ok(text.includes('6 helper agents have exactly ONE entry'), 'old helper-agent claim is gone');
});

check('DOC-05', 'no en dash or em dash in the table, the PRD or the audit file', () => {
  const pat = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
  const bad = [];
  for (const p of [TABLE, PRD, AUDIT]) {
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((l, i) => { if (pat.test(l)) bad.push(path.basename(p) + ':' + (i + 1)); });
  }
  assert.strictEqual(bad.length, 0, 'dash at ' + bad.join(', '));
});

process.exit(failed ? 1 : 0);
