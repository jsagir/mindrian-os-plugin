'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-eo7 (H1) -- a commit message, a file path and a room path must
 * never reach a shell as command text in commitArtifact.
 * RCA: .planning/debug/command-injection-commit-message-and-speaker-urlencode.md
 *
 * lib/core/git-ops.cjs commitArtifact built one shell string with the room
 * path, the file path and the commit message, and ran it with execSync. Only
 * double quotes in the message were escaped. The cascade (Step 7b) makes the
 * message from the first heading of the filed note, so a heading such as
 * `Q3 plan $(touch <marker>)` ran at filing time.
 *
 * Legs:
 *   A1-A5b. hostile and edge messages: no marker in a fresh empty cwd, the
 *      result is { committed: true, message }, HEAD moves, the commit lists the
 *      file, and the saved body equals the message plus 2 LF exactly;
 *   B. no message (undefined, empty string): the auto message `sec: <name>`;
 *   C. a room path with a space, `$(` and backticks reaches scripts/git-ops as
 *      data: the commit lands in that room and no marker appears;
 *   D1-D3. soft-fail contract: a non-string message, a PATH without bash, and
 *      a room without git keep their old results;
 *   E. source pins: 5 execSync call sites stay, commitArtifact holds the only
 *      execFileSync call, no msgArg, module.exports unchanged.
 *
 * Plain node:assert/strict, zero deps, mkdtemp only. Exit 0 pass, 1 fail.
 * Hyphens only (no em-dash or en-dash).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GIT_OPS_PATH = path.join(ROOT, 'lib', 'core', 'git-ops.cjs');

let failures = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    failures += 1;
    console.log('not ok - ' + name);
    console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
  }
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-eo7-h1-' + label + '-')));
  tmpRoots.push(d);
  return d;
}
function assertUnderTmp(p) {
  const t = fs.realpathSync(os.tmpdir());
  assert.ok(p.startsWith(t + path.sep), 'path must live under os.tmpdir(): ' + p);
}

const ORIG_CWD = process.cwd();
const base = mkTmp('base');
assertUnderTmp(base);

// Isolate every git call from the user's config and from any parent repo.
delete process.env.GIT_DIR;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_INDEX_FILE;
const GLOBAL_CFG = path.join(base, 'gitconfig-empty');
fs.writeFileSync(GLOBAL_CFG, '');
process.env.GIT_CONFIG_GLOBAL = GLOBAL_CFG;
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CEILING_DIRECTORIES = base;
process.env.GIT_TERMINAL_PROMPT = '0';

const gitOps = require(GIT_OPS_PATH);

function git(room, args) {
  return execFileSync('git', ['-C', room].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeRoom(name) {
  const room = path.join(base, name);
  assertUnderTmp(room);
  fs.mkdirSync(path.join(room, 'sec'), { recursive: true });
  execFileSync('git', ['init', '-q', room], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(room, ['config', 'user.name', 'eo7 test']);
  git(room, ['config', 'user.email', 'eo7@example.invalid']);
  git(room, ['config', 'commit.gpgsign', 'false']);
  git(room, ['commit', '--allow-empty', '-q', '-m', 'seed']);
  return room;
}

function runCase(room, fileName, message, passMessage) {
  const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
  assertUnderTmp(cwd);
  const file = path.join(room, 'sec', fileName + '.md');
  fs.writeFileSync(file, '# ' + fileName + '\n\nbody\n');
  const before = git(room, ['rev-parse', 'HEAD']).trim();
  let result;
  process.chdir(cwd);
  try {
    result = passMessage ? gitOps.commitArtifact(room, file, message) : gitOps.commitArtifact(room, file);
  } finally {
    process.chdir(base);
  }
  const after = git(room, ['rev-parse', 'HEAD']).trim();
  const body = git(room, ['log', '-1', '--format=%B']);
  const names = git(room, ['show', '--name-only', '--format=', 'HEAD']);
  const listing = fs.readdirSync(cwd);
  return { result, before, after, body, names, listing, file };
}

function assertSaved(r, fileName, expectedResult, expectedBody) {
  assert.deepEqual(r.listing, [], 'the cwd must stay empty (a marker means a command ran): ' + JSON.stringify(r.listing));
  assert.deepEqual(r.result, expectedResult);
  assert.notEqual(r.after, r.before, 'HEAD must move');
  assert.ok(r.names.split('\n').includes('sec/' + fileName + '.md'), 'the commit must list sec/' + fileName + '.md, got ' + JSON.stringify(r.names));
  assert.equal(r.body, expectedBody, 'the saved commit body must equal the message plus 2 LF');
}

const BT = '`';
const room = makeRoom('room');

const MESSAGE_LEGS = [
  ['A1. cascade-shape message with $( ) substitution', 'a1', 'file(sec): Q3 plan $(touch mos-eo7-h1-subst)'],
  ['A2. backtick substitution in the message', 'a2', 'Q3 plan ' + BT + 'touch mos-eo7-h1-tick' + BT],
  ['A3. double-quote break-out message', 'a3', '"; touch mos-eo7-h1-quote; "'],
  ['A4. line break plus $( ) substitution', 'a4', 'line one\nline two $(touch mos-eo7-h1-nl)'],
  ['A5a. double quotes and real backslashes saved exactly', 'a5a', 'say "hi" C:\\path\\x \\"q\\" end'],
  ['A5b. message that starts with a dash saved exactly', 'a5b', '-n leading dash'],
];
for (const [name, fileName, msg] of MESSAGE_LEGS) {
  leg(name, () => {
    const r = runCase(room, fileName, msg, true);
    assertSaved(r, fileName, { committed: true, message: msg }, msg + '\n\n');
  });
}

leg('B. no message (undefined, empty string) gives the auto message', () => {
  const r1 = runCase(room, 'auto-name', undefined, false);
  assertSaved(r1, 'auto-name', { committed: true, message: 'auto-generated' }, 'sec: auto-name\n\n');
  const r2 = runCase(room, 'auto-empty', '', true);
  assertSaved(r2, 'auto-empty', { committed: true, message: 'auto-generated' }, 'sec: auto-empty\n\n');
});

leg('C. room path with a space, $( and backticks reaches git-ops as data', () => {
  const hostileRoom = makeRoom('room $(touch mos-eo7-h1-room) ' + BT + 'touch mos-eo7-h1-room2' + BT + ' x');
  const msg = 'Q3 plan $(touch mos-eo7-h1-subst2)';
  const r1 = runCase(hostileRoom, 'c1', msg, true);
  assertSaved(r1, 'c1', { committed: true, message: msg }, msg + '\n\n');
  const r2 = runCase(hostileRoom, 'auto-name', undefined, false);
  assertSaved(r2, 'auto-name', { committed: true, message: 'auto-generated' }, 'sec: auto-name\n\n');
});

leg('D1. a truthy non-string message keeps the soft-fail result', () => {
  const file = path.join(room, 'sec', 'd1.md');
  fs.writeFileSync(file, '# d1\n');
  const before = git(room, ['rev-parse', 'HEAD']).trim();
  const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
  process.chdir(cwd);
  let res;
  try {
    res = gitOps.commitArtifact(room, file, 42);
  } finally {
    process.chdir(base);
  }
  assert.deepEqual(res, { committed: false, message: 'git not enabled' });
  assert.equal(git(room, ['rev-parse', 'HEAD']).trim(), before, 'HEAD must not move');
  assert.deepEqual(fs.readdirSync(cwd), []);
});

leg('D2. a PATH without bash keeps the soft-fail result', () => {
  const emptyBin = fs.mkdtempSync(path.join(base, 'emptybin-'));
  const file = path.join(room, 'sec', 'd2.md');
  fs.writeFileSync(file, '# d2\n');
  const program = [
    "const g = require(process.argv[1]);",
    "const r = g.commitArtifact(process.argv[2], process.argv[3], 'm');",
    "process.stdout.write(JSON.stringify(r));",
  ].join('\n');
  const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
  const out = spawnSync(process.execPath, ['-e', program, GIT_OPS_PATH, room, file], {
    cwd,
    encoding: 'utf8',
    env: { PATH: emptyBin, HOME: base, GIT_CONFIG_GLOBAL: GLOBAL_CFG, GIT_CONFIG_NOSYSTEM: '1' },
  });
  assert.equal(out.status, 0, 'child node must exit 0: ' + out.stderr);
  assert.deepEqual(JSON.parse(out.stdout), { committed: false, message: 'git not enabled' });
});

leg('D3. a room without git returns committed true (script exits 0, unchanged)', () => {
  const plain = path.join(base, 'plain');
  fs.mkdirSync(path.join(plain, 'sec'), { recursive: true });
  const probe = spawnSync('git', ['-C', plain, 'rev-parse', '--git-dir'], { encoding: 'utf8' });
  assert.notEqual(probe.status, 0, 'base/plain must not be inside a git repo');
  const file = path.join(plain, 'sec', 'd3.md');
  fs.writeFileSync(file, '# d3\n');
  const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
  process.chdir(cwd);
  let res;
  try {
    res = gitOps.commitArtifact(plain, file, 'm');
  } finally {
    process.chdir(base);
  }
  assert.deepEqual(res, { committed: true, message: 'm' });
  assert.deepEqual(fs.readdirSync(cwd), []);
});

leg('E. source pins: 5 execSync sites, 1 execFileSync in commitArtifact, exports unchanged', () => {
  const src = fs.readFileSync(GIT_OPS_PATH, 'utf8');
  const count = (needle) => src.split(needle).length - 1;
  assert.equal(count('execSync('), 5, 'execSync( call sites');
  assert.equal(count("execFileSync('bash', args"), 1, "execFileSync('bash', args call sites");
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes('function commitArtifact('));
  assert.ok(start >= 0, 'commitArtifact must exist');
  let end = start + 1;
  while (end < lines.length && lines[end] !== '}') end += 1;
  const body = lines.slice(start, end + 1).join('\n');
  assert.ok(!body.includes('execSync('), 'commitArtifact must not call execSync');
  assert.ok(!body.includes('msgArg'), 'commitArtifact must not build msgArg');
  const exportsLine = 'module.exports = { isGitEnabled, commitArtifact, pushIfConfigured, initRepo, setupLfs, getStatus };';
  assert.equal(lines.filter((l) => l === exportsLine).length, 1, 'module.exports line');
});

process.chdir(ORIG_CWD);
for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failures === 0) {
  console.log('commit-artifact-injection: ALL PASS');
  process.exit(0);
} else {
  console.log('commit-artifact-injection: ' + failures + ' FAILED');
  process.exit(1);
}
