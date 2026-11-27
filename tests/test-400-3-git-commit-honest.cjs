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
 * Arms: G1-G7.
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
