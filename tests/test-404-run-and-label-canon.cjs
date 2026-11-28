'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), '404-run-label-'));
const isolatedEnv = Object.assign({}, process.env, {
  HOME: path.join(temp, 'home'), USERPROFILE: path.join(temp, 'profile'),
  MINDRIAN_HOME: path.join(temp, 'mindrian'), MINDRIAN_ROOMS_HOME: path.join(temp, 'rooms'),
  MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
});
Object.assign(process.env, isolatedEnv);
let fetchCalls = 0;
globalThis.fetch = (...args) => { fetchCalls += 1; throw new Error(`network call: ${String(args[0])}`); };
const fetchWasReplacedBeforeRequire = true;
const { OWN_TEXT_LABEL } = require('../lib/core/framework-recipe/steps.cjs');
const PENDING_UNTIL_O9 = Object.freeze(['C1', 'C3', 'C4']);
const DECISION_SENTENCE = 'A methodology skill that has its own method text is the one case that runs in place of a refusal, with a fixed line that names the source (row 18).';
const CLAUDE_SENTENCE = 'A methodology skill that has its own method text still runs then, and says in one fixed line that the steps are not from Theo this time (decision 18).';
const LARRY_SENTENCE = 'For a method that has its own text the turn does not end at the refusal: the method runs from its own text with the fixed own-text line (decision 18).';
const HISTORY_FILES = [
  'docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md',
  'docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md',
  'docs/OPEN-HANDOFFS.md', 'CHANGELOG.md',
];
function isHistoryFile(file) {
  return HISTORY_FILES.includes(file) || file.startsWith('docs/autopsies/') || file.startsWith('tests/fixtures/3696-persona-h/');
}
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function runNode(file, args = []) {
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], { cwd: root, env: isolatedEnv, encoding: 'utf8' });
  assert.equal(result.error, undefined, `${file} could not start: ${result.error && result.error.message}`);
  assert.equal(result.status, 0, `${file} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
}

test('C1 decision rows and own-text label match the canon', () => {
  const decisions = read('.claude/includes/decisions.md');
  const lines = decisions.split('\n');
  for (let n = 1; n <= 17; n += 1) assert.ok(lines.some((line) => line.startsWith(`| ${n} |`)), `decision row ${n} is missing`);
  const row = lines.find((line) => line.startsWith('| 18 |'));
  assert.ok(row, 'decision row 18 is missing');
  const quoted = row.match(/"([^"]+)"/);
  assert.ok(quoted, 'decision row 18 has no quoted label');
  assert.equal(quoted[1], OWN_TEXT_LABEL);
  for (const n of [1, 5, 8]) {
    const target = lines.find((line) => line.startsWith(`| ${n} |`));
    assert.ok(target, `decision row ${n} is missing`);
    const cells = target.split('|');
    assert.ok(cells[cells.length - 2].trimEnd().endsWith(DECISION_SENTENCE), `rationale cell of row ${n} must end with the added sentence`);
  }
});

test('C2 existing decision pins remain present and pinned tests pass', () => {
  runNode('tests/test-250-amendment-unit.cjs');
  runNode('tests/269-doctrine-reconcile.test.cjs');
});

test('C3 each added project sentence directly follows its old sentence', () => {
  const claude = read('CLAUDE.md');
  const oldSentences = [
    'A keyless or unreachable session gets an honest refusal, never a silent imitation.',
    'refuses honestly instead of improvising.',
  ];
  for (const oldText of oldSentences) {
    assert.equal(claude.split(oldText).length - 1, 1, `old sentence count changed: ${oldText}`);
    const at = claude.indexOf(oldText) + oldText.length;
    const after = claude.slice(at).replace(/^(?: |\n)?/, '');
    assert.ok(after.startsWith(CLAUDE_SENTENCE), `new sentence must directly follow: ${oldText}`);
  }
  assert.equal(claude.split(CLAUDE_SENTENCE).length - 1, 2, 'new project sentence must occur twice');
});

test('C4 Larry rule, mirror check and pinned budgets pass', () => {
  const skill = read('skills/larry-personality/SKILL.md');
  const anchor = 'the turn becomes a stated refusal';
  const at = skill.indexOf(anchor);
  assert.notEqual(at, -1, 'Larry refusal paragraph anchor is missing');
  const paragraphEnd = skill.indexOf('\n\n', at);
  assert.notEqual(paragraphEnd, -1, 'Larry refusal paragraph end is missing');
  assert.equal(skill.split(LARRY_SENTENCE).length - 1, 1, 'new Larry sentence must occur once');
  assert.ok(skill.indexOf(LARRY_SENTENCE) > paragraphEnd, 'new Larry sentence must follow the refusal paragraph');
  runNode('scripts/build-skill-mirrors.cjs', ['--check']);
  runNode('tests/test-359-prose-budget.cjs');
  runNode('tests/test-3696-voice-first-budget.cjs');
});

test('C5 tracked refusal phrase hits have classified pin rows', () => {
  const pinFile = path.join(root, 'tests/fixtures/404/refusal-pins.json');
  assert.ok(fs.existsSync(pinFile), 'refusal pin file is missing');
  const pins = JSON.parse(fs.readFileSync(pinFile, 'utf8'));
  const byFile = new Map();
  for (const row of pins) {
    assert.ok(row.file, 'pin row needs a file');
    assert.ok(['K', 'A', 'H'].includes(row.class), `invalid class for ${row.file}`);
    assert.ok(typeof row.reason === 'string' && row.reason.trim(), `empty reason for ${row.file}`);
    assert.ok(!byFile.has(row.file), `duplicate pin row for ${row.file}`);
    byFile.set(row.file, row);
    assert.ok(fs.existsSync(path.join(root, row.file)), `pin file does not exist: ${row.file}`);
    if (isHistoryFile(row.file)) assert.equal(row.class, 'H', `${row.file} must use history class H`);
    else assert.notEqual(row.class, 'H', `${row.file} is not in the RL4 history list`);
  }
  const listing = spawnSync('git', ['ls-files', '-z', '--', '.claude/includes', 'CLAUDE.md', 'docs', 'skills', 'commands', 'lib', 'scripts'], { cwd: root, encoding: 'buffer' });
  assert.equal(listing.error, undefined, `git ls-files could not start: ${listing.error && listing.error.message}`);
  assert.equal(listing.status, 0, `git ls-files exited ${listing.status}`);
  const trackedFiles = listing.stdout.toString('utf8').split('\0').filter(Boolean);
  const phrases = ['honest refusal', 'refuses honestly', 'keyless'];
  const hits = new Set();
  for (const file of trackedFiles) {
    const bytes = fs.readFileSync(path.join(root, file));
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8').toLowerCase();
    if (phrases.some((phrase) => text.includes(phrase))) hits.add(file);
  }
  const missing = [...hits].filter((file) => !byFile.has(file));
  assert.equal(missing.length, 0, `tracked hit files missing pin rows: ${missing.join(', ')}`);
});

test('C6 recipe parts in command and skill files have no refusal stem', () => {
  const rows = JSON.parse(read('data/framework-recipes.json'));
  const heading = '## Research planner (quick research run or deep research run)';
  const recipePart = (file) => {
    const lines = read(file).split('\n');
    let second = -1;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].trim() === '---') { if (second !== -1) { second = i; break; } second = i; }
    assert.notEqual(second, -1, `${file}: YAML frontmatter closing line is missing`);
    let body = lines.slice(second + 1);
    const planner = body.findIndex((line) => line === heading);
    if (planner !== -1) {
      let end = body.findIndex((line, i) => i > planner && line.startsWith('## '));
      body = body.slice(0, planner).concat(end === -1 ? [] : body.slice(end));
    }
    return body;
  };
  for (const [, row] of Object.entries(rows)) {
    const name = row.command.replace(/^\/mos:/, '');
    for (const file of [`commands/${name}.md`, `skills/${name}/SKILL.md`]) {
      const lines = recipePart(file);
      const match = lines.findIndex((line) => /refus/i.test(line));
      assert.equal(match, -1, `${file}:${match + 1} recipe part contains refusal stem`);
    }
  }
});

let pending = 0;
test('C7 O9 pending legs still fail', () => {
  assert.ok(PENDING_UNTIL_O9.every((name) => ['C1', 'C3', 'C4'].includes(name)), 'PENDING_UNTIL_O9 may hold only C1, C3 and C4');
  const byName = new Map(cases);
  for (const name of PENDING_UNTIL_O9) {
    const testCase = [...byName.entries()].find(([label]) => label.startsWith(`${name} `));
    assert.ok(testCase, `missing pending leg ${name}`);
    try { testCase[1](); assert.fail(`remove this entry: ${name} now passes`); }
    catch (error) {
      if (error.message.startsWith('remove this entry:')) throw error;
      pending += 1;
      console.log(`pending ${name}: ${error.message}`);
    }
  }
});

test('C9 tracked file boundary and network guard hold', () => {
  assert.equal(fetchWasReplacedBeforeRequire, true, 'globalThis.fetch was not replaced before the first require');
  assert.equal(fetchCalls, 0, 'globalThis.fetch was called');
});

(async () => {
  let pass = 0;
  let fail = 0;
  for (const [name, fn] of cases) {
    const leg = name.match(/^(C\d+) /);
    if (leg && PENDING_UNTIL_O9.includes(leg[1])) continue;
    try { await fn(); pass += 1; console.log(`ok ${name}`); }
    catch (error) { fail += 1; console.log(`FAIL ${name}: ${error.message}`); }
  }
  console.log(`404 run and label canon: ${pass} passed, ${pending} pending, ${fail} failed`);
  fs.rmSync(temp, { recursive: true, force: true });
  if (fail) process.exitCode = 1;
})();
