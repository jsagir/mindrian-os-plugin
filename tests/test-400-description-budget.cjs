#!/usr/bin/env node
'use strict';
// Phase 400-01: the description budget guard (T-400-02, runtime cost constraint).
// description loads into every session, so no phase-400 change may grow it. Job sentence
// slots live in their own frontmatter keys (O-11), never in description.
// Legs B1 to B3. With --write-baseline the test writes the fixture from base c1e496ae8
// through git show. Run --write-baseline once, in plan 400-01 only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';
const FIXTURE_REL = 'tests/fixtures/400/description-bytes-baseline.json';

// The description value: the text after "description:" on its line plus every following
// indented or blank line, until the next top-level line or the closing ---.
function descriptionOf(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return '';
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const d = /^description:(.*)$/.exec(lines[i]);
    if (!d) continue;
    const parts = [d[1]];
    for (let k = i + 1; k < lines.length; k += 1) {
      const l = lines[k];
      if (l.trim() === '' || /^\s/.test(l)) parts.push(l);
      else break;
    }
    while (parts.length > 1 && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.join('\n');
  }
  return '';
}

function bytes(s) {
  return Buffer.byteLength(s, 'utf8');
}

function isSurface(rel) {
  return /^commands\/[^/]+\.md$/.test(rel) || /^skills\/[^/]+\/SKILL\.md$/.test(rel) || /^agents\/[^/]+\.md$/.test(rel);
}

function diskFiles() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'commands'))) if (f.endsWith('.md')) out.push('commands/' + f);
  for (const d of fs.readdirSync(path.join(ROOT, 'skills'))) {
    if (fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md'))) out.push('skills/' + d + '/SKILL.md');
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'agents'))) if (f.endsWith('.md')) out.push('agents/' + f);
  return out.filter(isSurface).sort();
}

function writeBaseline() {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const listed = git(['ls-tree', '-r', '--name-only', BASE, '--', 'commands', 'skills', 'agents'])
    .split('\n')
    .filter(isSurface)
    .sort();
  const files = {};
  let total = 0;
  for (const rel of listed) {
    const n = bytes(descriptionOf(git(['show', BASE + ':' + rel])));
    files[rel] = n;
    total += n;
  }
  const out = { base_commit: BASE, files, total };
  fs.mkdirSync(path.dirname(path.join(ROOT, FIXTURE_REL)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, FIXTURE_REL), JSON.stringify(out, null, 2) + '\n');
  console.log('wrote ' + FIXTURE_REL + ': ' + listed.length + ' files, total ' + total + ' bytes');
}

if (process.argv.includes('--write-baseline')) {
  writeBaseline();
  process.exit(0);
}

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let fixture = null;
try {
  fixture = JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE_REL), 'utf8'));
} catch (e) {
  fixture = null;
}

const files = diskFiles();
const now = {};
for (const rel of files) now[rel] = bytes(descriptionOf(fs.readFileSync(path.join(ROOT, rel), 'utf8')));

check('B3 the fixture names base_commit ' + BASE, () => {
  assert.ok(fixture, FIXTURE_REL + ' is missing or does not parse');
  assert.equal(fixture.base_commit, BASE);
});

check('B1 no description grows against the base; same file set; total not above the base total', () => {
  assert.ok(fixture && fixture.base_commit === BASE, 'no valid fixture');
  assert.deepEqual(files, Object.keys(fixture.files).sort(), 'file set differs from the baseline');
  const grown = files.filter((rel) => now[rel] > fixture.files[rel]);
  assert.deepEqual(grown, [], 'description grew in: ' + grown.join(', '));
  const total = files.reduce((a, rel) => a + now[rel], 0);
  assert.ok(total <= fixture.total, 'total ' + total + ' > baseline ' + fixture.total);
});

check('B2 no description holds a job sentence marker', () => {
  const leaks = files.filter((rel) => {
    const d = descriptionOf(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    return d.includes(', I want ') || d.includes('so I can');
  });
  assert.deepEqual(leaks, [], 'job sentence text in description: ' + leaks.join(', '));
});

console.log('\n' + files.length + ' files; ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
