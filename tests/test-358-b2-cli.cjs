'use strict';

// Phase 358-08, Task 1 (RED). CLI legs L1-L15 for scripts/room-question.cjs
// and the /mos:room question wiring in commands/room.md.
//
// Hermetic: HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME all point at a fresh
// scratch dir for BOTH this test process and every spawned child, set before
// navigation.cjs is required so in-process resolveByUser/detectActiveRoom see
// the same env a child sees. CLAUDE_ACTIVE_ROOM, MINDRIAN_MCP_FIRST and
// MINDRIAN_BRAIN_KEY are deleted.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const child_process = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'room-question.cjs');
const ROOM_MD_PATH = path.join(REPO_ROOT, 'commands', 'room.md');

const HOME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-cli-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-cli-roomshome-'));
process.env.HOME = HOME_DIR;
process.env.MINDRIAN_HOME = HOME_DIR;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_BRAIN_KEY;

const navigation = require('../lib/core/navigation.cjs');
const frameProvenance = require('../lib/core/frame-provenance.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function esc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function runCli(args, envOverrides) {
  const env = Object.assign({}, process.env, envOverrides || {});
  return child_process.spawnSync(process.execPath, [CLI_PATH].concat(args), {
    env: env, encoding: 'utf8',
  });
}

// ---------------------------------------------------------------------------
// Fixtures (Task 1 plan text, verbatim)
// ---------------------------------------------------------------------------

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

// ---------------------------------------------------------------------------
// L1: origins --json
// ---------------------------------------------------------------------------

check('L1: origins --json prints ids/labels/positions equal to navigation.FRAME_ORIGINS_ORDERED, exit 0', () => {
  const res = runCli(['origins', '--json']);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed));
  const expected = navigation.FRAME_ORIGINS_ORDERED.map((o, i) => ({ id: o.id, label: o.label, position: i + 1 }));
  assert.deepEqual(parsed, expected);
});

// ---------------------------------------------------------------------------
// L2: show on an empty room
// ---------------------------------------------------------------------------

const ROOM = makeRoom('mindrian-358-b2-cli-room-');

check('L2: show --room R on an empty room exits 0, prints "No governing question recorded yet."', () => {
  const res = runCli(['show', '--room', ROOM]);
  assert.equal(res.status, 0, 'stderr: ' + res.stderr);
  assert.match(res.stdout, /No governing question recorded yet\./);
});

// ---------------------------------------------------------------------------
// L3: first question
// ---------------------------------------------------------------------------

check('L3: set --origin tasking Q1 exits 0, "Recorded: version 1 (first question)"; show reflects it', () => {
  const res = runCli(['set', '--room', ROOM, '--origin', 'tasking', Q1]);
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout, /Recorded: version 1 \(first question\)/);

  const show = runCli(['show', '--room', ROOM]);
  assert.equal(show.status, 0, 'stderr: ' + show.stderr);
  assert.match(show.stdout, new RegExp('Governing question \\(version 1 of 1\\): ' + esc(Q1)));
  const label = navigation.frameOriginInfo('tasking').label;
  assert.match(show.stdout, new RegExp('Origin: tasking - ' + esc(label)));
});

// ---------------------------------------------------------------------------
// L4: refused change
// ---------------------------------------------------------------------------

check('L4: set with a changed question, no --account/--relocate, refuses change_needs_account with the ask and card', () => {
  const res = runCli(['set', '--room', ROOM, '--origin', 'chosen', '--based-on', '1', Q2]);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stderr, /x The question was not changed yet/);
  assert.match(res.stderr, /^ {2}Why: change_needs_account$/m);
  assert.match(res.stderr, new RegExp('  Previous question \\(version 1\\): ' + esc(Q1)));
  assert.match(res.stderr, new RegExp('  Proposed question: ' + esc(Q2)));
  assert.match(res.stderr, /What did the old question get wrong\?/);
  assert.match(res.stdout, /\[AskUserQuestion contract: shape=F\.1 verbs=4\]/);
  frameProvenance.QUESTION_CARD_OPTIONS.forEach((opt) => {
    assert.ok(res.stdout.includes(opt), 'stdout missing card option: ' + opt);
  });

  const show = runCli(['show', '--room', ROOM]);
  assert.equal(show.status, 0, 'stderr: ' + show.stderr);
  assert.equal(show.stdout.split('\n')[0], 'A question change is waiting.');
});

// ---------------------------------------------------------------------------
// L5: refines with an account
// ---------------------------------------------------------------------------

check('L5: set with --account files as refines, version 2; history shows 2 versions and no waiting block', () => {
  const res = runCli(['set', '--room', ROOM, '--origin', 'chosen', '--based-on', '1', '--account', A2, Q2]);
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout, /Recorded: version 2 \(refines version 1\)/);
  assert.match(res.stdout, new RegExp('What the old question got wrong: ' + esc(A2)));

  const hist = runCli(['history', '--room', ROOM]);
  assert.equal(hist.status, 0, 'stderr: ' + hist.stderr);
  assert.match(hist.stdout, /^Question history \(2 versions, oldest first\)/m);
  assert.notEqual(hist.stdout.split('\n')[0], 'A question change is waiting.');
});

// ---------------------------------------------------------------------------
// L6: relocates
// ---------------------------------------------------------------------------

check('L6: set with --relocate files as relocates, version 3', () => {
  const res = runCli(['set', '--room', ROOM, '--origin', 'prompt', '--relocate', Q3]);
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout, /Recorded: version 3 \(relocates from version 2\)/);
});

// ---------------------------------------------------------------------------
// L7: missing / bogus origin
// ---------------------------------------------------------------------------

check('L7: missing --origin and a bogus --origin both exit 1 with invalid_origin and the allowed list', () => {
  const ids = navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id).join(', ');

  const res1 = runCli(['set', '--room', ROOM, 'Which camera?']);
  assert.equal(res1.status, 1, 'stdout: ' + res1.stdout + ' stderr: ' + res1.stderr);
  assert.match(res1.stderr, /^ {2}Why: invalid_origin$/m);
  assert.match(res1.stderr, new RegExp('  Fix: allowed origins: ' + esc(ids)));

  const res2 = runCli(['set', '--room', ROOM, '--origin', 'bogus', 'Which camera?']);
  assert.equal(res2.status, 1, 'stdout: ' + res2.stdout + ' stderr: ' + res2.stderr);
  assert.match(res2.stderr, /^ {2}Why: invalid_origin$/m);
  assert.match(res2.stderr, new RegExp('  Fix: allowed origins: ' + esc(ids)));
});

// ---------------------------------------------------------------------------
// L8: ambiguous choice
// ---------------------------------------------------------------------------

check('L8: --account and --relocate together exit 1 with ambiguous_change', () => {
  const res = runCli(['set', '--room', ROOM, '--origin', 'chosen', '--account', 'x', '--relocate', 'Another question?']);
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stderr, /^ {2}Why: ambiguous_change$/m);
});

// ---------------------------------------------------------------------------
// L9: cancel
// ---------------------------------------------------------------------------

check('L9: cancel after a refused change succeeds once, then refuses nothing_pending', () => {
  const refuse = runCli(['set', '--room', ROOM, '--origin', 'chosen', 'Some other question entirely?']);
  assert.equal(refuse.status, 1, 'stdout: ' + refuse.stdout + ' stderr: ' + refuse.stderr);
  assert.match(refuse.stderr, /change_needs_account/);

  const cancel1 = runCli(['cancel', '--room', ROOM]);
  assert.equal(cancel1.status, 0, 'stdout: ' + cancel1.stdout + ' stderr: ' + cancel1.stderr);
  assert.match(cancel1.stdout, /The waiting question change was cancelled\./);

  const cancel2 = runCli(['cancel', '--room', ROOM]);
  assert.equal(cancel2.status, 1, 'stdout: ' + cancel2.stdout + ' stderr: ' + cancel2.stderr);
  assert.match(cancel2.stderr, /^ {2}Why: nothing_pending$/m);
});

// ---------------------------------------------------------------------------
// L10: --json shapes
// ---------------------------------------------------------------------------

check('L10: show/history/refused-set --json each print exactly one parseable JSON line with a boolean ok', () => {
  const showJson = runCli(['show', '--room', ROOM, '--json']);
  assert.equal(showJson.status, 0, 'stderr: ' + showJson.stderr);
  const showLines = showJson.stdout.trim().split('\n');
  assert.equal(showLines.length, 1, 'expected exactly one JSON line, got: ' + showJson.stdout);
  const showParsed = JSON.parse(showLines[0]);
  assert.equal(typeof showParsed.ok, 'boolean');

  const histJson = runCli(['history', '--room', ROOM, '--json']);
  assert.equal(histJson.status, 0, 'stderr: ' + histJson.stderr);
  const histLines = histJson.stdout.trim().split('\n');
  assert.equal(histLines.length, 1, 'expected exactly one JSON line, got: ' + histJson.stdout);
  const histParsed = JSON.parse(histLines[0]);
  assert.equal(typeof histParsed.ok, 'boolean');

  const refuseJson = runCli(['set', '--room', ROOM, '--origin', 'chosen', '--json', 'Yet another question?']);
  assert.equal(refuseJson.status, 1, 'stdout: ' + refuseJson.stdout + ' stderr: ' + refuseJson.stderr);
  const refuseLines = refuseJson.stdout.trim().split('\n');
  assert.equal(refuseLines.length, 1, 'expected exactly one JSON line, got: ' + refuseJson.stdout);
  const refuseParsed = JSON.parse(refuseLines[0]);
  assert.equal(refuseParsed.ok, false);
  assert.equal(refuseParsed.reason, 'change_needs_account');
  assert.ok(refuseParsed.card && typeof refuseParsed.card === 'object', 'refusal --json missing card object');
});

// ---------------------------------------------------------------------------
// L11: no room
// ---------------------------------------------------------------------------

check('L11: show with no --room and no active room exits 1 with "x No Data Room found"', () => {
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-cli-emptyhome-'));
  const res = runCli(['show'], {
    HOME: emptyHome, MINDRIAN_HOME: emptyHome, MINDRIAN_ROOMS_HOME: emptyHome,
  });
  assert.equal(res.status, 1, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
  assert.match(res.stdout + res.stderr, /x No Data Room found/);
});

// ---------------------------------------------------------------------------
// L12: help / usage
// ---------------------------------------------------------------------------

check('L12: help exits 0 and names show, history, set, cancel, origins; no subcommand and an unknown one exit 2', () => {
  const help = runCli(['help']);
  assert.equal(help.status, 0, 'stderr: ' + help.stderr);
  ['show', 'history', 'set', 'cancel', 'origins'].forEach((name) => {
    assert.match(help.stdout, new RegExp('\\b' + esc(name) + '\\b'), 'help missing: ' + name);
  });

  const noSub = runCli([]);
  assert.equal(noSub.status, 2, 'stdout: ' + noSub.stdout + ' stderr: ' + noSub.stderr);

  const unknown = runCli(['bogus-subcommand']);
  assert.equal(unknown.status, 2, 'stdout: ' + unknown.stdout + ' stderr: ' + unknown.stderr);
});

// ---------------------------------------------------------------------------
// L13: static substrate hygiene
// ---------------------------------------------------------------------------

check('L13: room-question.cjs requires only node builtins + navigation.cjs + frame-provenance.cjs; no sqlite/room-db/brain/network; no tasking/inherited/pickShape/em-dash literals', () => {
  const src = fs.readFileSync(CLI_PATH, 'utf8');
  const stripped = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  assert.equal(/node:sqlite/.test(stripped), false, 'must not reference node:sqlite');
  assert.equal(/room-db/.test(stripped), false, 'must not reference room-db');
  assert.equal(/brain-client/i.test(stripped), false, 'must not reference brain-client');
  assert.equal(/require\(\s*['"]node:(http|https|net|dgram|dns|tls)/.test(stripped), false, 'must not reference a network module');
  assert.equal(/DatabaseSync/.test(stripped), false, 'must not reference DatabaseSync');

  assert.equal(/(^|[^a-zA-Z])tasking([^a-zA-Z]|$)/.test(stripped), false, 'must not hardcode the origin literal tasking');
  assert.equal(/(^|[^a-zA-Z])inherited([^a-zA-Z]|$)/.test(stripped), false, 'must not hardcode the origin literal inherited');
  assert.equal(/pickShape/.test(stripped), false, 'must not construct a card directly (no pickShape)');
  assert.equal(/\u2014/.test(stripped), false, 'no em-dashes');

  const requireCalls = stripped.match(/require\([\s\S]*?\)/g) || [];
  assert.ok(requireCalls.length > 0, 'no require() calls found');
  requireCalls.forEach((r) => {
    const isNodeBuiltin = /require\(\s*['"]node:/.test(r);
    const isNav = /navigation\.cjs/.test(r);
    const isFrameProvenance = /frame-provenance\.cjs/.test(r);
    assert.ok(isNodeBuiltin || isNav || isFrameProvenance, 'unexpected require: ' + r);
  });
});

check('node scripts/check-substrate.cjs reports no line naming scripts/room-question.cjs', () => {
  const res = child_process.spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs')], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  const combined = (res.stdout || '') + (res.stderr || '');
  assert.equal(combined.includes('scripts/room-question.cjs'), false, combined.slice(0, 600));
});

// ---------------------------------------------------------------------------
// L14: commands/room.md wiring
// ---------------------------------------------------------------------------

check('L14: commands/room.md carries the question subcommand, its AskUserQuestion step, argument-hint, and a single hitl_shape line', () => {
  const src = fs.readFileSync(ROOM_MD_PATH, 'utf8');

  assert.ok(src.includes('## Subcommand: question'), 'missing "## Subcommand: question" header');

  const scriptCount = (src.match(/scripts\/room-question\.cjs/g) || []).length;
  assert.ok(scriptCount >= 5, 'scripts/room-question.cjs referenced ' + scriptCount + ' times, need >= 5');

  assert.ok(src.includes('What did the old question get wrong?'), 'missing the ask sentence');

  const qSectionMatch = src.match(/## Subcommand: question\n[\s\S]*?(?=\n## Subcommand:|$)/);
  assert.ok(qSectionMatch, 'question subcommand section not found');
  const qSection = qSectionMatch[0];
  assert.match(qSection, /AskUserQuestion/);

  const argHintMatch = src.match(/^argument-hint:.*$/m);
  assert.ok(argHintMatch, 'argument-hint line not found');
  assert.match(argHintMatch[0], /question/);
  assert.match(argHintMatch[0], /checks/);
  assert.match(argHintMatch[0], /claim/);
  assert.match(argHintMatch[0], /check/);

  assert.match(src, /before the \[section\] fallback/i);
  const fallbackLineMatch = src.match(/^.*before the \[section\] fallback.*$/im);
  assert.ok(fallbackLineMatch, 'matched-before sentence not found');
  assert.match(fallbackLineMatch[0], /question/);

  const gtCount = (qSection.match(/Governing Thought/g) || []).length;
  assert.ok(gtCount <= 1, 'question section mentions "Governing Thought" ' + gtCount + ' times, expected at most 1 (only to say it is a different thing)');

  const hitlShapeCount = (src.match(/hitl_shape: "F\.1"/g) || []).length;
  assert.equal(hitlShapeCount, 1, 'expected exactly one hitl_shape: "F.1" line');
});

// ---------------------------------------------------------------------------
// L15: skill mirror in sync
// ---------------------------------------------------------------------------

check('L15: node scripts/build-skill-mirrors.cjs --check exits 0', () => {
  const res = child_process.spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'build-skill-mirrors.cjs'), '--check'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  assert.equal(res.status, 0, 'stdout: ' + res.stdout + ' stderr: ' + res.stderr);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
