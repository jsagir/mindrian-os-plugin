'use strict';
// Quick 261127-k4f, Phase 402 F2 (design 402-DESIGN.md r3.1 section 7.2;
// binding addendum 402-K4F-PLAN-ADDENDUM.md changes 23 to 25 and checker
// edits 1 and 6). Test only: no change to scripts/session-start or to
// lib/core/session-context-envelope.cjs.
//
// The 9,000-character cap is from quick 261013-k1u (commit e3afaaca0). This
// test checks it on a room about 4 times the size of the k1u fixture: 60
// sections, 31 sealed rooms, governing thoughts with Hebrew letters and
// characters above U+FFFF. It also checks the coordinator budget (AC2.2), the
// 367 spawn line (AC2.3), and that the k1u test is not edited.
//
// The bash fallback gaps (a byte cut that can split a character, no saved
// full file, no file name in the note) are an open item of the SUMMARY. The
// fallback legs here assert only what holds today: length, JSON, the note.
//
// Rule: never run this against the live ~/.mindrian. Every run has a scratch
// HOME and a mkdtemp rooms home. No network.
//
// Output: 1 line per leg, "PASS <ID>: <text>", "FAIL <ID>: <text>" or
// "SKIP <ID>: <reason>". Last line "test-402-session-start-cap: <p> passed,
// <f> failed". Exit 1 when f is above 0.
//
// No em dash and no en dash in this file (hyphens only).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const { buildFixture, runSessionStart } = require('./test-k1u-session-start-envelope.cjs');
const envMod = require(path.join(REPO, 'lib', 'core', 'session-context-envelope.cjs'));
const BUDGET = envMod.DEFAULT_BUDGET_CHARS;
const LIMIT = envMod.CLAUDE_CODE_INLINE_LIMIT;
const POLICY = envMod.BLOCK_POLICY;

const NOT_SAVED_NOTE = '[Session context shortened by the session-start fallback encoder; the room files hold the rest.]';
const REQUIRED_OVERFLOW_LABEL = 'the end of the required blocks';

let passed = 0;
let failed = 0;
function leg(id, text, fn) {
  try {
    const r = fn();
    if (r && r.skip) { console.log('SKIP ' + id + ': ' + text + ' -- ' + r.skip); return; }
    passed += 1;
    console.log('PASS ' + id + ': ' + text);
  } catch (e) {
    failed += 1;
    const msg = e && e.message ? e.message.split('\n')[0] : String(e);
    console.log('FAIL ' + id + ': ' + text + ' -- ' + msg);
  }
}

// ----- the large fixture ------------------------------------------------------

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'k4f-startcap-'));
const fx = buildFixture(BASE, { sections: 14, filesPerSection: 3, sealed: true });
const EXTRA_SECTIONS = [];
const HEB = 'שלום עולם השוק נבדק';
const ASTRAL = '\u{1F9ED} \u{1D11E}';
for (let i = 0; i < 46; i++) {
  const s = 'extra-section-' + String(i).padStart(2, '0');
  EXTRA_SECTIONS.push(s);
  const d = path.join(fx.roomDir, s);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'ROOM.md'), '# ' + s + '\n\nIdentity text for ' + s + '.\n');
  let gt = 'Governing thought for ' + s + ' is that the wedge holds in ' + HEB + ' ' + ASTRAL + ' and the pricing test confirms it.';
  while (gt.length < 400) gt += ' The market data for ' + s + ' supports the wedge.';
  gt = gt.slice(0, 400);
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(d, 'MINTO.md'), [
    '---', 'schema_version: 88', 'governing_thought: "' + gt + '"',
    'last_generated_at: "' + now + '"', 'last_artifact_write_seen_at: "' + now + '"',
    'reasoning_health_score: 0.75', 'flagged_weaknesses: []', 'decision_log: []', '---', '',
    '# Governing Thought', '', gt, '', '# Claim 1', '', 'Supporting claim.', '',
  ].join('\n'));
  for (let k = 0; k < 4; k++) {
    fs.writeFileSync(path.join(d, s + '-entry-' + k + '.md'),
      '---\ntitle: entry ' + k + '\nstatus: active\n---\n# Entry ' + k + '\n\n' +
      'This entry mentions market wedge customer pricing ' + HEB + ' and assumption risk.\n');
  }
}
const SEALED = ['sealed-lab'];
for (let i = 0; i < 30; i++) {
  const name = 'sealed-lab-' + i;
  SEALED.push(name);
  const d = path.join(fx.roomsHome, name);
  fs.mkdirSync(d, { recursive: true });
  let g = '# Guardrail\n\nDo not share lab ' + i + ' data with any other room.\nDo not name the partner lab.\nDo not export raw results.\n';
  while (g.length < 700) g += 'Do not cross-reference this room with any other room, project or layer.\n';
  fs.writeFileSync(path.join(d, 'GUARDRAIL.md'), g.slice(0, 700));
}
const ALL_SECTIONS = fx.sections.concat(EXTRA_SECTIONS);

// ----- helpers ----------------------------------------------------------------

function freshHome(key) {
  const h = path.join(BASE, 'home-' + key);
  fs.mkdirSync(h, { recursive: true });
  return h;
}

function assertShape(r) {
  assert.equal(r.status, 0, 'exit ' + r.status + ' stderr ' + String(r.stderr).slice(0, 200));
  assert.ok(r.parsed, 'stdout is not 1 JSON object: ' + r.parseError);
  assert.equal(r.parsed.hookSpecificOutput && r.parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof r.ctx, 'string', 'context is not a string');
}

function assertCap(r) {
  assert.ok(BUDGET < LIMIT, 'budget ' + BUDGET + ' is not below the host limit ' + LIMIT);
  assert.ok(r.ctx.length <= BUDGET, 'context length ' + r.ctx.length + ' above ' + BUDGET);
}

function listedLabels(listText) {
  const known = new Set();
  for (const id of Object.keys(POLICY)) known.add(POLICY[id].label);
  known.add(REQUIRED_OVERFLOW_LABEL);
  const found = [];
  for (const label of known) {
    let at = listText.indexOf(label);
    while (at !== -1) {
      found.push({ label: label, at: at });
      at = listText.indexOf(label, at + label.length);
    }
  }
  found.sort(function (a, b) { return a.at - b.at; });
  return found.map(function (f) { return f.label; });
}

function optionalRank(label) {
  for (const id of Object.keys(POLICY)) {
    if (POLICY[id].label === label && POLICY[id].kind === 'optional') return POLICY[id].rank;
  }
  return null;
}

function pointerFacts(r) {
  assert.ok(r.ctx.indexOf('## Pointers') !== -1, 'no Pointers block');
  const mm = /^- Full session context: (.+?)\. Shortened or left out here: (.+?)\. Read that file before you answer/m.exec(r.ctx);
  assert.ok(mm, 'no Full session context line');
  return { file: mm[1], labels: listedLabels(mm[2]) };
}

function assertPointers(r) {
  const p = pointerFacts(r);
  assert.equal(p.file, r.fullFile, 'named file ' + p.file);
  assert.ok(typeof r.fullText === 'string', 'the named file does not exist');
  assert.ok(r.fullText.length > r.ctx.length, 'the full file is not longer than the context');
  assert.ok(r.fullText.length > BUDGET, 'the full file is not longer than the budget (fixture below the cap)');
  assert.ok(p.labels.length > 0, 'no label found in the list');
  for (const label of p.labels) {
    if (label === REQUIRED_OVERFLOW_LABEL) continue;
    assert.ok(r.fullText.indexOf('===== ' + label + ' =====') !== -1, 'no section for ' + label);
  }
  return p;
}

// ----- legs -------------------------------------------------------------------

leg('S1', 'the fixture has the 60 section folders and the 31 sealed rooms', function () {
  assert.equal(ALL_SECTIONS.length, 60);
  for (const s of ALL_SECTIONS) assert.ok(fs.statSync(path.join(fx.roomDir, s)).isDirectory(), 'missing ' + s);
  assert.equal(SEALED.length, 31);
  for (const s of SEALED) assert.ok(fs.existsSync(path.join(fx.roomsHome, s, 'GUARDRAIL.md')), 'missing ' + s);
});

const rich = runSessionStart(fx, { key: 'rich', home: freshHome('rich'), extraEnv: { MINDRIAN_CONTEXT_TIER: 'rich' } });
leg('S2', 'rich run: exit 0, 1 JSON object, SessionStart, a string context', function () { assertShape(rich); });
leg('S3', 'rich run: context at most DEFAULT_BUDGET_CHARS (measured ' + (rich.ctx ? rich.ctx.length : 'n/a') + ' characters), below the host limit', function () {
  assertShape(rich); assertCap(rich);
});
let richPointers = null;
leg('S4', 'rich run: the Pointers block names the full file; it exists, is longer than the context and the budget, and has a section for each listed label', function () {
  assertShape(rich); richPointers = assertPointers(rich);
});
leg('S5', 'rich run: the listed labels are in non-decreasing rank order', function () {
  assert.ok(richPointers, 'S4 did not read the list');
  let last = -Infinity;
  for (const label of richPointers.labels) {
    if (label === REQUIRED_OVERFLOW_LABEL) continue;
    const rank = optionalRank(label);
    assert.ok(rank !== null, 'no optional policy entry for ' + label);
    assert.ok(rank >= last, label + ' rank ' + rank + ' after rank ' + last);
    last = rank;
  }
});

const minimal = runSessionStart(fx, { key: 'minimal', home: freshHome('minimal'), extraEnv: { MINDRIAN_CONTEXT_TIER: 'minimal' } });
leg('S6', 'minimal run: the checks of S2, S3 and S4 (measured ' + (minimal.ctx ? minimal.ctx.length : 'n/a') + ' characters)', function () {
  assertShape(minimal); assertCap(minimal); assertPointers(minimal);
});

const fb = runSessionStart(fx, { key: 'fallback', home: freshHome('fallback'),
  extraEnv: { MINDRIAN_CONTEXT_TIER: 'rich', MINDRIAN_SESSION_CONTEXT_FALLBACK: '1' } });
leg('S7', 'fallback run: exit 0, 1 JSON object, context at most DEFAULT_BUDGET_CHARS (measured ' + (fb.ctx ? fb.ctx.length : 'n/a') + ' characters)', function () {
  assertShape(fb); assertCap(fb);
});

const dirFull = path.join(fx.roomDir, '.mindrian', 'session-context.txt');
fs.rmSync(dirFull, { recursive: true, force: true });
fs.mkdirSync(dirFull, { recursive: true });
const fbDir = runSessionStart(fx, { key: 'fallback-dir', home: freshHome('fallback-dir'), fullFile: dirFull,
  extraEnv: { MINDRIAN_CONTEXT_TIER: 'rich', MINDRIAN_SESSION_CONTEXT_FALLBACK: '1' } });
leg('S11', 'fallback run with a folder at the full-file path: exit 0, 1 JSON object, under the budget, the not-saved note, no file name', function () {
  assertShape(fbDir); assertCap(fbDir);
  assert.ok(fbDir.ctx.endsWith(NOT_SAVED_NOTE), 'context does not end with the not-saved note');
  assert.ok(fbDir.ctx.indexOf('Full session context:') === -1, 'context names a file');
});
fs.rmSync(dirFull, { recursive: true, force: true });

leg('S12', 'the sessionstart-coordinator output is at most its exported BUDGET_CHARS on the same fixture', function () {
  const coord = require(path.join(REPO, 'scripts', 'sessionstart-coordinator.cjs'));
  assert.ok(Number.isInteger(coord.BUDGET_CHARS), 'BUDGET_CHARS export missing');
  const home = freshHome('coordinator');
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: home,
    TMPDIR: path.join(BASE, 'tmp'),
    PWD: fx.roomDir,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_ROOMS_ROOT: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO,
    MINDRIAN_HOME: path.join(home, '.mindrian'),
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  };
  const res = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'sessionstart-coordinator.cjs')], {
    cwd: fx.roomDir, env: env, encoding: 'utf8', timeout: 60000, input: '',
  });
  assert.equal(res.status, 0, 'coordinator exit ' + res.status);
  const last = (res.stdout || '').trim().split('\n').pop();
  const obj = JSON.parse(last);
  const ctx = obj.hookSpecificOutput && typeof obj.hookSpecificOutput.additionalContext === 'string'
    ? obj.hookSpecificOutput.additionalContext : '';
  assert.ok(ctx.length <= coord.BUDGET_CHARS, 'coordinator context ' + ctx.length + ' above ' + coord.BUDGET_CHARS);
  console.log('  S12 measure: coordinator context ' + ctx.length + ' characters, budget ' + coord.BUDGET_CHARS);
});

leg('S13', 'scripts/session-start holds the 367 graph catch-up spawn line', function () {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'session-start'), 'utf8');
  assert.ok(src.split('\n').some(function (l) { return l.startsWith('( node "${SCRIPT_DIR}/graph-catchup.cjs"'); }), 'spawn line missing');
});

leg('S14', 'tests/test-k1u-session-start-envelope.cjs is byte-identical to its base d80d87c5b', function () {
  const res = spawnSync('git', ['diff', '--quiet', 'd80d87c5b', '--', 'tests/test-k1u-session-start-envelope.cjs'], { cwd: REPO });
  assert.equal(res.status, 0, 'git diff exit ' + res.status);
});

try { fs.rmSync(BASE, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
console.log('test-402-session-start-cap: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
