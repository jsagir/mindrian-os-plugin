/**
 * Phase 369 / TS369-01: the CJS-only rule is lifted where every session reads it.
 *
 * D-17 (navigator ruling 2026-10-02, SEED-107): CLAUDE.md Conventions is the
 * OUTPUT of `gsd-tools generate-claude-md` for the tracked GSD source
 * .planning/codebase/CONVENTIONS.md. This test pins the rule text across the
 * source, the generated block, the spikes conventions and the decisions row, and
 * pins source-to-block equality so a hand edit between the sentinels (or a
 * source edit without regeneration) fails loudly instead of being reverted later.
 *
 * Cheap on purpose: no fixtures, no database, no network.
 *
 * Run: node tests/test-369-constitution.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

const SOURCE = '.planning/codebase/CONVENTIONS.md';
const CLAUDE = 'CLAUDE.md';
const SPIKES = '.planning/spikes/CONVENTIONS.md';
const DECISIONS = '.claude/includes/decisions.md';
const THIS_TEST = 'tests/test-369-constitution.cjs';

// Built from code points so this file never contains the characters it forbids.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

// ---------- harness (the repo convention: plain counters, nonzero exit tail) ----------

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

// ---------- helpers ----------

function readRepoFile(rel) {
  const abs = path.join(REPO, rel);
  assert.ok(fs.existsSync(abs), rel + ' is missing from the repo');
  return fs.readFileSync(abs, 'utf8');
}

// The text between the sentinel markers for a managed block, markers excluded.
function sentinelBlock(src, name) {
  const startMatch = new RegExp('<!-- GSD:' + name + '-start[^>]*-->').exec(src);
  assert.ok(startMatch, 'GSD:' + name + '-start marker missing');
  const from = startMatch.index + startMatch[0].length;
  const to = src.indexOf('<!-- GSD:' + name + '-end -->', from);
  assert.ok(to > from, 'GSD:' + name + '-end marker missing');
  return src.slice(from, to);
}

// The generator keeps only `## ` headings and `- ` bullets of the source.
function keptLines(text) {
  return text.split('\n').filter((l) => l.startsWith('## ') || l.startsWith('- '));
}

// ---------- scenarios ----------

process.stdout.write('test-369-constitution\n');

scenario('1. neither CLAUDE.md nor its conventions source says "CJS only, no TypeScript"', () => {
  for (const rel of [CLAUDE, SOURCE]) {
    assert.ok(!readRepoFile(rel).includes('CJS only, no TypeScript'), rel + ' still carries the retired rule');
  }
});

scenario('2. CLAUDE.md and the source both carry the D-17 shape', () => {
  const needles = [
    'erasableSyntaxOnly',
    'verbatimModuleSyntax',
    '22.18.0',
    'tools/ts-check',
    'Hooks and the MCP server stay',
    'test-369-installed-layout.cjs',
    'walled-off',
  ];
  for (const rel of [CLAUDE, SOURCE]) {
    const src = readRepoFile(rel);
    for (const n of needles) assert.ok(src.includes(n), rel + ' is missing "' + n + '"');
  }
});

scenario('3. the CLAUDE.md conventions block equals its source, line for line', () => {
  const source = keptLines(readRepoFile(SOURCE));
  const block = keptLines(sentinelBlock(readRepoFile(CLAUDE), 'conventions'));
  // The generator adds its own "## Conventions" heading in front of the source's lines.
  assert.equal(block[0], '## Conventions', 'generator heading missing from the block');
  assert.deepEqual(block.slice(1), source);
});

scenario('4. the spikes conventions are rewritten for the new floor', () => {
  const src = readRepoFile(SPIKES);
  assert.ok(!src.includes('Node 22 CJS, zero npm deps'), 'the CJS-only spike bullet is still there');
  assert.ok(src.includes('22.18.0'), 'the spike bullet does not name the floor');
});

scenario('5. decisions.md carries the D-17 row', () => {
  const rows = readRepoFile(DECISIONS).split('\n').filter((l) => l.startsWith('| 17 |'));
  assert.equal(rows.length, 1, 'expected exactly one row 17');
  assert.ok(rows[0].includes('D-17'), 'row 17 does not cite D-17');
});

scenario('6. the conventions source is tracked (or staged), so a regeneration elsewhere finds it', () => {
  const r = spawnSync('git', ['ls-files', '--error-unmatch', SOURCE], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, SOURCE + ' is not known to git: ' + (r.stderr || ''));
});

scenario('7. no em-dash or en-dash in the rule files or this test', () => {
  for (const rel of [CLAUDE, SOURCE, SPIKES, DECISIONS, THIS_TEST]) {
    const src = readRepoFile(rel);
    assert.ok(!src.includes(EM_DASH), rel + ' contains an em-dash');
    assert.ok(!src.includes(EN_DASH), rel + ' contains an en-dash');
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
