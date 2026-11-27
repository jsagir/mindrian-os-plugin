#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 03b: the 2 legacy cascade faults are fixed, and the legacy git commit is honest and scoped.
 *
 * Covered: owner answer OA-2 (the extractTitle export and the injectArtifactId argument order), owner answer OA-4
 * (answer A: commit only when the room root has its own .git, and only the written file), review M1 (post-write
 * wall time with and without an own repository).
 *
 * Stated behaviour change (OA-2, the owner knows): on a legacy /room(s)/ room with STATE.md, a Write gets an
 * artifact_id line in its frontmatter after the cascade, and, when the room root has its own repository, a git
 * commit 'file(<section>): <title>' of that file only.
 *
 * Canon Part 8: fixture rooms and fixture repositories only, under one mkdtemp root; no remote; MINDRIAN_BRAIN_URL
 * points at a closed loopback port. Native Windows is UNMEASURED.
 *
 * Arms: A1-A6.
 * Usage: node tests/test-400-3-legacy-cascade-steps.cjs
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REAL_SCRIPTS = path.join(ROOT, 'scripts');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const W = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), '4003-03b-legacy-')));
process.on('exit', () => { try { fs.rmSync(W, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
if (/\/rooms?\//.test(W + '/')) { console.log('FAIL: fixture: TMPDIR holds a room segment: ' + W); process.exit(1); }

// The git environment of Task 1: HOME in the mkdtemp root, no system config, an empty global config.
delete process.env.GIT_DIR;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_INDEX_FILE;
const HOME = path.join(W, 'home');
fs.mkdirSync(HOME, { recursive: true });
const GLOBAL_CFG = path.join(W, 'gitconfig-empty');
fs.writeFileSync(GLOBAL_CFG, '');
const GIT_ENV = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GLOBAL_CFG, GIT_TERMINAL_PROMPT: '0' };
Object.assign(process.env, GIT_ENV, {
  HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: path.join(HOME, 'MindrianRooms'),
  MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MOS_NO_DETACHED_DERIVE: '1',
});
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_ROOM_DIR;

if (spawnSync('git', ['-C', W, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).status === 0) {
  console.log('FAIL: fixture: the mkdtemp root ' + W + ' is inside a git work tree; set TMPDIR elsewhere');
  process.exit(1);
}

const A_TEXT = '---\ntitle: A\n---\n# A note\nOne line of prose.\n';
function git(dir, args) { return execFileSync('git', ['-C', dir].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function initRepo(dir) {
  execFileSync('git', ['init', '-q', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
}
function makeRoom(parent, name, ownGit) {
  const roomDir = path.join(parent, 'rooms', name);
  fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# section\n');
  fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), A_TEXT);
  if (ownGit) initRepo(roomDir);
  return roomDir;
}
function findGitDirs(dir) {
  const out = [];
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      if (e.name === '.git') out.push(path.join(d, e.name));
      else if (e.isDirectory()) walk(path.join(d, e.name));
    }
  };
  walk(dir);
  return out;
}
function countCommits(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-list', '--count', '--all'], { encoding: 'utf8' });
  return r.status === 0 ? Number(r.stdout.trim()) : 0;
}
const J = (x) => JSON.stringify(x);

// The temp plugin tree of tests/test-384-s2-post-write-skip.cjs with the real mindrian-tools.cjs.
function pluginTree(label) {
  const base = path.join(W, 'pt-' + label);
  const scripts = path.join(base, 'meta', 'plugin', 'scripts');
  const logs = path.join(base, 'logs');
  for (const d of [scripts, logs]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(scripts, 'post-write'), fs.readFileSync(path.join(REAL_SCRIPTS, 'post-write'), 'utf8'), { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'mindrian-tools.cjs'),
    '#!/usr/bin/env node\n' +
    'const r = require("child_process").spawnSync(process.execPath, [' + JSON.stringify(path.join(REAL_SCRIPTS, 'mindrian-tools.cjs')) + '].concat(process.argv.slice(2)), { encoding: "utf8", maxBuffer: 1 << 26 });\n' +
    'process.stdout.write(r.stdout || "");\n', { mode: 0o755 });
  const logger = (name) => '#!/usr/bin/env node\nrequire("fs").appendFileSync(' + JSON.stringify(path.join(logs, name + '.log')) + ', JSON.stringify(process.argv.slice(2)) + "\\n");\n';
  for (const n of ['stamp-artifact-write', 'minto-debouncer', 'recompile-room-references']) fs.writeFileSync(path.join(scripts, n + '.cjs'), logger(n), { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'track-analytics'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'resolve-room'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });
  return { scripts };
}
function msNow() { return Number(process.hrtime.bigint()) / 1e6; }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function runPostWrite(pt, roomDir) {
  const file = path.join(roomDir, 'sec', 'a.md');
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file }, session_id: 'sess-4003-03b' });
  const env = Object.assign({ PATH: process.env.PATH, HOME, USERPROFILE: HOME, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', LANG: 'C', MOS_NO_DETACHED_DERIVE: '1' }, GIT_ENV);
  const t0 = msNow();
  const r = spawnSync('bash', [path.join(pt.scripts, 'post-write')], { cwd: HOME, env, input: payload, encoding: 'utf8', timeout: 120000 });
  const ms = msNow() - t0;
  let advisory = null;
  try { advisory = JSON.parse(String(r.stdout).trim()).hookSpecificOutput.additionalContext; } catch (_e) { advisory = null; }
  return { status: r.status, advisory, ms };
}
function readSide(roomDir) {
  try { return JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'last-cascade.json'), 'utf8')); } catch (_e) { return null; }
}

async function main() {
  const cascade = require(path.join(ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
  const run = (roomDir) => cascade.runCascade(roomDir, { trigger: 'cli-hook', filePath: path.join(roomDir, 'sec', 'a.md') });

  // A1, A2, A3: no repository.
  {
    const parent = path.join(W, 'a1');
    const roomDir = makeRoom(parent, 'y', false);
    let res1 = null;
    let res2 = null;
    let after1 = null;
    let after2 = null;
    try {
      res1 = await run(roomDir);
      after1 = fs.readFileSync(path.join(roomDir, 'sec', 'a.md'), 'utf8');
      res2 = await run(roomDir);
      after2 = fs.readFileSync(path.join(roomDir, 'sec', 'a.md'), 'utf8');
    } catch (e) { check('A1 fixture', false, e && e.stack || String(e)); }
    const a1 = res1 || {};
    check('A1 no repository: artifactId injected, gitCommit skipped with reason not_a_repo, the file starts with ---\\nartifact_id: ',
      !!a1.artifactId && a1.artifactId.status === 'injected' && !!a1.gitCommit && a1.gitCommit.status === 'skipped'
        && a1.gitCommit.reason === 'not_a_repo' && typeof after1 === 'string' && after1.startsWith('---\nartifact_id: '),
      J({ artifactId: a1.artifactId, gitCommit: a1.gitCommit, head: after1 && after1.slice(0, 40) }));
    const a2 = res2 || {};
    check('A2 a second run: artifactId skipped and the file is byte-equal to its state after A1',
      !!a2.artifactId && a2.artifactId.status === 'skipped' && after1 !== null && after1 === after2, J({ artifactId: a2.artifactId }));
    check('A3 no repository: no .git folder under the root, gitCommit reason not_a_repo',
      findGitDirs(W).length === 0 && !!a1.gitCommit && a1.gitCommit.reason === 'not_a_repo', J({ git: findGitDirs(W), gitCommit: a1.gitCommit }));
  }

  // A4: own repository.
  {
    const parent = path.join(W, 'a4');
    const roomDir = makeRoom(parent, 'y4', true);
    let res = null;
    try { res = await run(roomDir); } catch (e) { check('A4 fixture', false, e && e.stack || String(e)); }
    let log = '';
    let names = [];
    try { log = git(roomDir, ['log', '--oneline', '-1']); names = git(roomDir, ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean); } catch (_e) { /* no commit */ }
    const r = res || {};
    check('A4 own repository: the commit file(sec): A note lists only sec/a.md and gitCommit status is ok',
      log.indexOf('file(sec): A note') !== -1 && J(names) === J(['sec/a.md']) && !!r.gitCommit && r.gitCommit.status === 'ok',
      J({ log: log.trim(), names, gitCommit: r.gitCommit }));
  }

  // A5: post-write on the no-repository fixture with the real mindrian-tools.cjs.
  {
    const pt = pluginTree('a5');
    const roomDir = makeRoom(path.join(W, 'a5'), 'y', false);
    const r = runPostWrite(pt, roomDir);
    sleep(1500);
    const side = readSide(roomDir);
    check('A5 post-write on a legacy room: cascade_status complete and the advisory is the BASE queued line',
      r.status === 0 && !!side && side.cascade_status === 'complete' && r.advisory === 'queued MINTO regen for sec, recompiled references (a.md)',
      J({ status: r.status, cascade_status: side && side.cascade_status, advisory: r.advisory }));
  }

  // A6: timing, n=5 with no repository and n=5 with an own repository.
  {
    const pt = pluginTree('a6');
    const noGit = [];
    const ownGit = [];
    let commitsOk = true;
    const commitCounts = [];
    for (let i = 0; i < 5; i++) {
      const roomDir = makeRoom(path.join(W, 'a6-n' + i), 'y', false);
      noGit.push(runPostWrite(pt, roomDir).ms);
    }
    for (let i = 0; i < 5; i++) {
      const roomDir = makeRoom(path.join(W, 'a6-g' + i), 'y', true);
      ownGit.push(runPostWrite(pt, roomDir).ms);
      const n = countCommits(roomDir);
      commitCounts.push(n);
      if (n !== 1) commitsOk = false;
    }
    const stat = (a) => { const s = a.slice().sort((x, y) => x - y); return { p50: s[2], max: s[4] }; };
    const n = stat(noGit);
    const g = stat(ownGit);
    let load = '';
    try { load = os.loadavg().map((x) => x.toFixed(2)).join(' '); } catch (_e) { load = 'unknown'; }
    console.log('400.3-03b legacy post-write wall ms (Linux, n=5): no-git p50=' + n.p50.toFixed(0) + ' max=' + n.max.toFixed(0)
      + '; own-git p50=' + g.p50.toFixed(0) + ' max=' + g.max.toFixed(0) + ' (load average ' + load + ')');
    check('A6 each max under 4000 ms and each own-git run made exactly 1 commit',
      n.max < 4000 && g.max < 4000 && commitsOk, J({ noGit: noGit.map(Math.round), ownGit: ownGit.map(Math.round), commitCounts }));
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
