'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { OMIT_CLAUDE_MD } = require('./helpers/omit-claudemd-list.cjs');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function check(label, fn) {
  try {
    fn();
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

function checkOmit(text, mustHave) {
  const errors = [];
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  if (lines[0] !== '---') return ['missing opening frontmatter fence'];
  const close = lines.findIndex((line, i) => i > 0 && line === '---');
  if (close < 0) return ['missing closing frontmatter fence'];
  const fm = lines.slice(1, close);
  const keyLines = [];
  for (let i = 0; i < fm.length; i += 1) {
    if (/^omitClaudeMd:/.test(fm[i])) keyLines.push(i);
  }
  if (!mustHave) {
    if (keyLines.length) errors.push('unexpected top-level omitClaudeMd key');
    return errors;
  }
  const exact = fm.map((line, i) => line === 'omitClaudeMd: true' ? i : -1).filter((i) => i >= 0);
  if (exact.length !== 1 || keyLines.length !== 1) errors.push('expected exactly 1 top-level omitClaudeMd: true line');
  const listEnds = [];
  for (let i = 0; i < fm.length; i += 1) {
    if (/^(tools|allowed-tools):\s*$/.test(fm[i])) {
      let j = i + 1;
      let last = -1;
      while (j < fm.length && /^\s+-\s+/.test(fm[j])) { last = j; j += 1; }
      if (last >= 0) listEnds.push(last);
    }
  }
  const lastList = listEnds.length ? Math.max(...listEnds) : -1;
  if (exact.length === 1 && exact[0] !== lastList + 1) errors.push('key is not directly after the last host-read list item');
  if (exact.length === 1 && fm.slice(0, exact[0]).some((line) => /^#.*---/.test(line))) errors.push('triple-dash comment precedes the key');
  const connector = fm.findIndex((line) => /^connector:/.test(line));
  if (connector < 0 || (exact.length === 1 && exact[0] >= connector)) errors.push('key is not before connector');
  return errors;
}

function readAgent(name) {
  return fs.readFileSync(path.join(ROOT, 'agents', name + '.md'), 'utf8');
}
function insertKey(text) {
  const lines = text.split('\n');
  const fmEnd = lines.findIndex((line, i) => i > 0 && line.replace(/\r$/, '') === '---');
  let lastList = -1;
  for (let i = 1; i < fmEnd; i += 1) {
    if (/^(tools|allowed-tools):\s*$/.test(lines[i])) {
      let j = i + 1;
      let end = -1;
      while (j < fmEnd && /^\s+-\s+/.test(lines[j])) { end = j; j += 1; }
      lastList = Math.max(lastList, end);
    }
  }
  lines.splice(lastList + 1, 0, 'omitClaudeMd: true');
  return lines.join('\n');
}

check('L1 listed agents hold the key in the required position', () => {
  const missing = OMIT_CLAUDE_MD.filter((name) => checkOmit(readAgent(name), true).length);
  assert.deepEqual(missing, [], 'agents failing: ' + missing.join(', '));
});
check('L2 unlisted agents do not hold the key', () => {
  const listed = new Set(OMIT_CLAUDE_MD.map((name) => name + '.md'));
  const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter((name) => name.endsWith('.md'));
  const bad = agents.filter((name) => !listed.has(name) && checkOmit(readAgent(name.replace(/\.md$/, '')), false).length);
  assert.deepEqual(bad, []);
});
check('L3 position mutations are detected', () => {
  const base = readAgent(OMIT_CLAUDE_MD[0]);
  const inserted = base.split('\n').some((line) => line.replace(/\r$/, '') === 'omitClaudeMd: true') ? base : insertKey(base);
  assert.deepEqual(checkOmit(inserted, true), []);
  const lines = inserted.split('\n');
  const at = lines.findIndex((line) => line === 'omitClaudeMd: true');
  const triple = lines.slice();
  triple.splice(at, 0, '# --- x ---');
  assert.ok(checkOmit(triple.join('\n'), true).length, 'triple-dash mutation was not detected');
  const moved = lines.slice();
  [moved[at], moved[at + 1]] = [moved[at + 1], moved[at]];
  assert.ok(checkOmit(moved.join('\n'), true).length, 'position mutation was not detected');
});
check('L4 new files have no long dash characters', () => {
  const files = [
    'tests/test-403-omit-claudemd.cjs',
    'tests/helpers/omit-claudemd-list.cjs',
    'tests/run-all-403.sh',
  ];
  const emDash = String.fromCodePoint(0x2014);
  const enDash = String.fromCodePoint(0x2013);
  for (const file of files) assert.ok(!fs.readFileSync(path.join(ROOT, file), 'utf8').includes(emDash) && !fs.readFileSync(path.join(ROOT, file), 'utf8').includes(enDash), file + ' has a long dash');
});
check('L5 ledger evidence records the bounded K5 scratch delta', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/capability-ledger.json'), 'utf8'));
  const row = ledger.entries.find((entry) => entry.capability === 'omitclaudemd-agent-frontmatter');
  assert.ok(row, 'ledger row is missing');
  const match = /K5 probe .*scratch delta (\d+) bytes removed per spawn \(canary files only\)/.exec(row.evidence);
  assert.ok(match, 'K5 probe sentence is missing');
  assert.ok(Number(match[1]) <= 200, 'scratch delta exceeds 200');
});

if (failed) process.exitCode = 1;
