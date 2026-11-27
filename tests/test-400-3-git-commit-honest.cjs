#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 03b: the room git commit is honest and scoped.
 *
 * Covered: review B1 (commitArtifact says committed only when a commit was made; skipped and failed carry a
 * reason), review B2 and owner answer OA-4 (answer A: commit only when the room root has its own .git, and only
 * the written file, with a pathspec; a room inside an enclosing repository gets no commit there), review M2 (git
 * identity in every fixture; the developer's own git config never applies).
 *
 * Canon Part 8: fixture repositories only, under one mkdtemp root; no remote, no network.
 * Native Windows is UNMEASURED.
 *
 * Arms:
 *   G1  own repository, a new file: committed true; HEAD lists only that file.
 *   G2  no repository above the room: skipped not_a_repo; no .git appears (BASE: committed true).
 *   G3  a room inside an enclosing repository with a change staged there: skipped not_own_repo; the parent gets
 *       no commit and its staged change stays staged (BASE: the parent got a commit of both files).
 *   G4  own repository with another change staged: committed true; HEAD lists only the given file; the other
 *       change stays staged.
 *   G5  the same unchanged file again: skipped nothing_to_commit.
 *   G6  own repository with no commit identity: failed commit_failed (BASE: committed true).
 *   G7  the exit codes and stderr words of scripts/git-ops commit; is-enabled keeps its BASE output.
 *   G8  wave 2 Goldfish W2-D-02: own repository, auto_push auto, a remote whose push hangs 20 s (a pre-push hook):
 *       commitArtifact returns committed within the 5,000 ms post-write budget (BASE: the background push kept
 *       the stdout pipe, so the call waited for the push and timed out as spawn_failed).
 *   G9  wave 2 Goldfish W2-D-03: a room reached through a symlinked folder: committed true, HEAD lists only the file
 *       (BASE: the absolute pathspec through the symlink was outside the repository, add_failed).
 *   G10 wave 2 Goldfish W2-D-03 / W2-CD-02: the own-repository check has no path compare. A git shim prints the
 *       Git Bash form C:/... for --show-toplevel; the commit still lands (BASE: not_own_repo on that path form).
 * Usage: node tests/test-400-3-git-commit-honest.cjs
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GIT_OPS_SCRIPT = path.join(ROOT, 'scripts', 'git-ops');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const W = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), '4003-03b-git-')));
process.on('exit', () => { try { fs.rmSync(W, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

// The git environment of every child: HOME in the mkdtemp root, no system config, an empty global config.
delete process.env.GIT_DIR;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_INDEX_FILE;
const GLOBAL_CFG = path.join(W, 'gitconfig-empty');
fs.writeFileSync(GLOBAL_CFG, '');
process.env.HOME = W;
process.env.USERPROFILE = W;
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CONFIG_GLOBAL = GLOBAL_CFG;
process.env.GIT_TERMINAL_PROMPT = '0';

if (spawnSync('git', ['-C', W, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).status === 0) {
  console.log('FAIL: fixture: the mkdtemp root ' + W + ' is inside a git work tree; set TMPDIR elsewhere');
  process.exit(1);
}

const gitOps = require(path.join(ROOT, 'lib', 'core', 'git-ops.cjs'));

function git(dir, args) { return execFileSync('git', ['-C', dir].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
}
function writeFile(room, rel, text) {
  const f = path.join(room, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  return f;
}
function headFiles(room) { return git(room, ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean); }
function countCommits(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-list', '--count', '--all'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'none';
}
function runScript(args) {
  const r = spawnSync('bash', [GIT_OPS_SCRIPT].concat(args), { encoding: 'utf8', cwd: W });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}
const J = (x) => JSON.stringify(x);

// G1: own repository, a new file.
const g1 = path.join(W, 'g1');
initRepo(g1);
const g1f = writeFile(g1, 'sec/g1.md', '# G1\n');
const r1 = gitOps.commitArtifact(g1, g1f, 'm1');
let g1files = [];
try { g1files = headFiles(g1); } catch (_e) { g1files = []; }
check('G1 own repository: {committed: true, message: m1}; HEAD lists only sec/g1.md',
  J(r1) === J({ committed: true, message: 'm1' }) && J(g1files) === J(['sec/g1.md']), J(r1) + ' ' + J(g1files));

// G2: no repository anywhere above the room.
const g2 = path.join(W, 'g2');
const g2f = writeFile(g2, 'sec/g2.md', '# G2\n');
const r2 = gitOps.commitArtifact(g2, g2f, 'm2');
check('G2 no repository: {committed: false, skipped: true, reason: not_a_repo}; no .git appears',
  r2.committed === false && r2.skipped === true && r2.reason === 'not_a_repo' && !fs.existsSync(path.join(g2, '.git')), J(r2));

// G3: a room inside an enclosing repository, with a change staged in the parent.
const parent = path.join(W, 'parent');
initRepo(parent);
writeFile(parent, 'seed.md', 'seed\n');
git(parent, ['add', 'seed.md']);
git(parent, ['commit', '-q', '-m', 'seed']);
const g3 = path.join(parent, 'rooms', 'y');
const g3f = writeFile(g3, 'sec/g3.md', '# G3\n');
writeFile(parent, 'other.md', 'other\n');
git(parent, ['add', 'other.md']);
const before3 = countCommits(parent);
const r3 = gitOps.commitArtifact(g3, g3f, 'm3');
const after3 = countCommits(parent);
const staged3 = git(parent, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
check('G3 room inside an enclosing repository: {committed: false, skipped: true, reason: not_own_repo}',
  r3.committed === false && r3.skipped === true && r3.reason === 'not_own_repo', J(r3));
check('G3 the parent gets no commit; other.md stays staged; no room file is staged',
  before3 === after3 && J(staged3) === J(['other.md']), 'before=' + before3 + ' after=' + after3 + ' staged=' + J(staged3));

// G4: own repository with another change staged first.
const g4 = path.join(W, 'g4');
initRepo(g4);
writeFile(g4, 'seed.md', 'seed\n');
git(g4, ['add', 'seed.md']);
git(g4, ['commit', '-q', '-m', 'seed']);
writeFile(g4, 'other.md', 'other\n');
git(g4, ['add', 'other.md']);
const g4f = writeFile(g4, 'sec/g4.md', '# G4\n');
const r4 = gitOps.commitArtifact(g4, g4f, 'm4');
let g4files = [];
try { g4files = headFiles(g4); } catch (_e) { g4files = []; }
const staged4 = git(g4, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
check('G4 own repository with other.md staged: committed true; HEAD lists only sec/g4.md; other.md stays staged',
  r4.committed === true && J(g4files) === J(['sec/g4.md']) && J(staged4) === J(['other.md']), J(r4) + ' head=' + J(g4files) + ' staged=' + J(staged4));

// G5: a second commit of the same unchanged file.
const r5 = gitOps.commitArtifact(g1, g1f, 'm5');
check('G5 the same unchanged file again: {committed: false, skipped: true, reason: nothing_to_commit}',
  r5.committed === false && r5.skipped === true && r5.reason === 'nothing_to_commit', J(r5));

// G6: own repository where the commit cannot get an identity.
const g6 = path.join(W, 'g6');
initRepo(g6);
git(g6, ['config', 'user.useConfigOnly', 'true']);
git(g6, ['config', '--unset', 'user.email']);
const g6f = writeFile(g6, 'sec/g6.md', '# G6\n');
const r6 = gitOps.commitArtifact(g6, g6f, 'm6');
check('G6 a failed commit: {committed: false, failed: true, reason: commit_failed}',
  r6.committed === false && r6.failed === true && r6.reason === 'commit_failed', J(r6));

// G7: the exit codes and stderr words of scripts/git-ops commit, and is-enabled unchanged.
{
  const g7a = writeFile(g1, 'sec/g7.md', '# G7\n');
  const s1 = runScript(['commit', g1, g7a, 'm']);
  check('G7 own repository: exit 0', s1.status === 0, J(s1));
  const s2 = runScript(['commit', g2, g2f, 'm']);
  check('G7 no repository: exit 3, stderr skipped: not_a_repo', s2.status === 3 && s2.stderr.indexOf('skipped: not_a_repo') !== -1, J(s2));
  const s3 = runScript(['commit', g3, g3f, 'm']);
  check('G7 enclosing repository: exit 3, stderr skipped: not_own_repo', s3.status === 3 && s3.stderr.indexOf('skipped: not_own_repo') !== -1, J(s3));
  const g7b = writeFile(g6, 'sec/g7.md', '# G7\n');
  const s6 = runScript(['commit', g6, g7b, 'm']);
  check('G7 failed commit: exit 1, stderr failed: commit_failed', s6.status === 1 && s6.stderr.indexOf('failed: commit_failed') !== -1, J(s6));
  const e1 = runScript(['is-enabled', g1]);
  const e2 = runScript(['is-enabled', g2]);
  const e3 = runScript(['is-enabled', g3]);
  check('G7 is-enabled keeps its BASE output: true for G1 and G3, false for G2',
    e1.stdout === 'true' && e1.status === 0 && e3.stdout === 'true' && e3.status === 0 && e2.stdout === 'false' && e2.status === 1,
    J({ e1, e2, e3 }));
}

// G8: own repository, auto_push auto, a remote whose push hangs for 20 s.
{
  const ws = path.join(W, 'ws-g8');
  const g8 = path.join(ws, 'g8');
  initRepo(g8);
  const remote = path.join(W, 'remote-g8.git');
  execFileSync('git', ['init', '-q', '--bare', remote], { stdio: ['ignore', 'pipe', 'pipe'] });
  git(g8, ['remote', 'add', 'origin', remote]);
  fs.writeFileSync(path.join(g8, '.git', 'hooks', 'pre-push'), '#!/bin/sh\nsleep 20\n', { mode: 0o755 });
  fs.mkdirSync(path.join(ws, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.rooms', 'registry.json'), JSON.stringify({ rooms: { g8: { path: g8, auto_push: 'auto' } } }));
  const ap = spawnSync('bash', [GIT_OPS_SCRIPT, 'get-auto-push', g8], { encoding: 'utf8', cwd: ws });
  const g8f = writeFile(g8, 'sec/g8.md', '# G8\n');
  const cwd0 = process.cwd();
  process.chdir(ws);
  const t0 = Date.now();
  let r8 = null;
  try { r8 = gitOps.commitArtifact(g8, g8f, 'm8'); } finally { process.chdir(cwd0); }
  const ms8 = Date.now() - t0;
  let g8files = [];
  try { g8files = headFiles(g8); } catch (_e) { g8files = []; }
  console.log('400.3-w2 G8 commitArtifact wall ms with a hanging auto push: ' + ms8);
  check('G8 auto_push auto with a hanging remote: committed true within 5000 ms; HEAD lists only sec/g8.md',
    !!r8 && r8.committed === true && ms8 < 5000 && J(g8files) === J(['sec/g8.md']),
    J({ r8, ms8, g8files, autoPushFromWs: String(ap.stdout).trim() }));
}

// G9: a room reached through a symlinked folder.
{
  const realBase = path.join(W, 'real-g9');
  fs.mkdirSync(realBase, { recursive: true });
  const linkBase = path.join(W, 'link-g9');
  fs.symlinkSync(realBase, linkBase, 'dir');
  initRepo(path.join(realBase, 'g9'));
  const g9 = path.join(linkBase, 'g9');
  const g9f = writeFile(g9, 'sec/g9.md', '# G9\n');
  const r9 = gitOps.commitArtifact(g9, g9f, 'm9');
  let g9files = [];
  try { g9files = headFiles(g9); } catch (_e) { g9files = []; }
  check('G9 a symlinked room: committed true; HEAD lists only sec/g9.md',
    r9.committed === true && J(g9files) === J(['sec/g9.md']), J(r9) + ' ' + J(g9files));
  // The file through the real path, the room through the link: the same repository, the same relative file.
  const g9b = writeFile(path.join(realBase, 'g9'), 'sec/g9b.md', '# G9b\n');
  const r9b = gitOps.commitArtifact(g9, g9b, 'm9b');
  let g9bfiles = [];
  try { g9bfiles = headFiles(g9); } catch (_e) { g9bfiles = []; }
  check('G9 the room through the link and the file through the real path: committed true; HEAD lists only sec/g9b.md',
    r9b.committed === true && J(g9bfiles) === J(['sec/g9b.md']), J(r9b) + ' ' + J(g9bfiles));
}

// G10: the own-repository check has no path compare (a Git Bash C:/ form of --show-toplevel).
{
  const realGit = spawnSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  const shimDir = path.join(W, 'shim-g10');
  fs.mkdirSync(shimDir, { recursive: true });
  fs.writeFileSync(path.join(shimDir, 'git'),
    '#!/usr/bin/env bash\nfor a in "$@"; do if [ "$a" = "--show-toplevel" ]; then echo "C:/Users/u/MindrianRooms/g10"; exit 0; fi; done\nexec ' + JSON.stringify(realGit) + ' "$@"\n',
    { mode: 0o755 });
  const g10 = path.join(W, 'g10');
  initRepo(g10);
  const g10f = writeFile(g10, 'sec/g10.md', '# G10\n');
  const pathBefore = process.env.PATH;
  process.env.PATH = shimDir + path.delimiter + pathBefore;
  let r10 = null;
  try { r10 = gitOps.commitArtifact(g10, g10f, 'm10'); } finally { process.env.PATH = pathBefore; }
  let g10files = [];
  try { g10files = headFiles(g10); } catch (_e) { g10files = []; }
  check('G10 --show-toplevel in the C:/ form: committed true; HEAD lists only sec/g10.md',
    !!r10 && r10.committed === true && J(g10files) === J(['sec/g10.md']), J(r10) + ' ' + J(g10files));
  // The enclosing-repository case through the same shim stays skipped not_own_repo.
  process.env.PATH = shimDir + path.delimiter + pathBefore;
  const g10p = path.join(parent, 'rooms', 'g10p');
  const g10pf = writeFile(g10p, 'sec/x.md', '# x\n');
  let r10p = null;
  try { r10p = gitOps.commitArtifact(g10p, g10pf, 'm10p'); } finally { process.env.PATH = pathBefore; }
  check('G10 the enclosing-repository room through the shim: skipped not_own_repo',
    !!r10p && r10p.skipped === true && r10p.reason === 'not_own_repo', J(r10p));
  const src = fs.readFileSync(GIT_OPS_SCRIPT, 'utf8');
  const fn = (src.match(/is_own_repo\(\) \{[\s\S]*?\n\}/) || [''])[0];
  check('G10 is_own_repo uses --is-inside-work-tree and --show-prefix and compares no path',
    /--is-inside-work-tree/.test(fn) && /--show-prefix/.test(fn) && !/--show-toplevel/.test(fn) && !/pwd -P/.test(fn), fn);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
