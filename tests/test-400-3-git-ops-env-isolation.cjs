'use strict';
/*
 * Phase 400.3 wave 2 re-review W2R-07: scripts/git-ops commits into the room's own repository even when the caller
 * exports GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE of another repository, and a file name with glob characters
 * stages only that file. Node built-ins only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const GITOPS = path.join(ROOT, 'scripts', 'git-ops');
let passed = 0; let failed = 0;
function check(label, ok, detail) { if (ok) { passed += 1; console.log('PASS: ' + label); } else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); } }
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
delete gitEnv.GIT_DIR; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_INDEX_FILE;
function git(cwd, args) { return spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' }); }
function mkRepo(dir) { fs.mkdirSync(dir, { recursive: true }); git(dir, ['init', '-q']); fs.writeFileSync(path.join(dir, 'seed.txt'), 's'); git(dir, ['add', 'seed.txt']); git(dir, ['commit', '-q', '-m', 'seed']); }
const top = fs.mkdtempSync(path.join(os.tmpdir(), '4003-w2r07-'));
try {
  const other = path.join(top, 'other'); mkRepo(other);
  const room = path.join(top, 'room'); mkRepo(room);
  fs.mkdirSync(path.join(room, 'sec'));
  const f = path.join(room, 'sec', 'note.md'); fs.writeFileSync(f, 'n');
  const otherHead = git(other, ['rev-parse', 'HEAD']).stdout.trim();
  const env = { ...gitEnv, GIT_DIR: path.join(other, '.git'), GIT_WORK_TREE: other, GIT_INDEX_FILE: path.join(other, '.git', 'index') };
  const r = spawnSync('bash', [GITOPS, 'commit', room, f, 'w2r07'], { env, encoding: 'utf8' });
  const roomLog = git(room, ['log', '--oneline', '-1', '--', 'sec/note.md']).stdout.trim();
  check('E1 with an inherited GIT_DIR of another repo, the commit lands in the room repo', r.status === 0 && /w2r07/.test(roomLog), JSON.stringify({ status: r.status, stderr: r.stderr, roomLog }));
  check('E2 the other repo is untouched', git(other, ['rev-parse', 'HEAD']).stdout.trim() === otherHead);
  fs.writeFileSync(path.join(room, 'sec', 'a[1].md'), 'x'); fs.writeFileSync(path.join(room, 'sec', 'a1.md'), 'y');
  const r2 = spawnSync('bash', [GITOPS, 'commit', room, path.join(room, 'sec', 'a[1].md'), 'glob'], { env: gitEnv, encoding: 'utf8' });
  const files = git(room, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim().split('\n');
  check('E3 a glob-like file name stages only itself', r2.status === 0 && files.length === 1 && files[0] === 'sec/a[1].md', JSON.stringify({ status: r2.status, stderr: r2.stderr, files }));
} finally { fs.rmSync(top, { recursive: true, force: true }); }
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
