#!/usr/bin/env node
'use strict';

/*
 * tests/test-261029-lcg-legacy-clone-nested-git.cjs -- quick 261029-lcg.
 *
 * Root cause under test: legacyDirtyOrUnpushed ran `git -C <legacyDir> status`
 * and `git log @{u}..HEAD` with no check that legacyDir owns a git root. When
 * ~/.claude/plugins/mindrian-os has no .git, git walks up to the HOME repo and
 * reports the HOME repo's dirty and unpushed state. The doctor install-state
 * point and the migrator then refuse for a reason that is not about the legacy
 * directory.
 *
 * Arms:
 *   A  a directory with no .git inside a git repo that has an unpushed commit
 *      is NOT refused (the bug)
 *   B  a real clone with an unpushed commit IS refused
 *   C  a dirty real clone IS refused
 *   D  hasOwnGitRoot truth table
 *   E  migrator end to end: HOME is a git repo with an unpushed commit, the
 *      legacy dir has no .git -> dry-run proceeds; a real dirty clone refuses
 *   F  symlink repoint, removal and manifest on a temp HOME
 *   G  controls: clean pushed real clone passes; no git at all passes
 *
 * Every arm runs in fs.mkdtempSync trees. HOME and USERPROFILE of this process
 * point at a temp directory so nothing can reach the real ~/.claude.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SAFE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-lcg-safe-'));
process.env.HOME = SAFE_ROOT;
process.env.USERPROFILE = SAFE_ROOT;
delete process.env.MINDRIAN_OS_ROOT;
delete process.env.MOS_LEGACY_INSTALL_HOME;
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete process.env[k];

const shared = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
const migrator = require(path.join(REPO, 'scripts', 'migrate-legacy-install-location.cjs'));

let PASS = 0;
let FAIL = 0;
const made = [SAFE_ROOT];

function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('PASS ' + name);
  } catch (err) {
    FAIL += 1;
    console.log('FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

function tmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-lcg-' + label + '-'));
  made.push(d);
  return d;
}

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false']
    .concat(args), { cwd, encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + r.stderr);
  return r.stdout;
}

// A work repo with an upstream (a bare repo in the same temp tree).
// pushed: one commit pushed. withUnpushed: one more commit, not pushed.
function makeRepoWithUpstream(label, withUnpushed) {
  const base = tmp(label);
  const bare = path.join(base, 'upstream.git');
  const work = path.join(base, 'work');
  fs.mkdirSync(bare);
  git(bare, ['init', '--bare', '-b', 'main']);
  fs.mkdirSync(work);
  git(work, ['init', '-b', 'main']);
  git(work, ['remote', 'add', 'origin', bare]);
  fs.writeFileSync(path.join(work, 'a.txt'), 'one\n');
  git(work, ['add', 'a.txt']);
  git(work, ['commit', '-m', 'one']);
  git(work, ['push', '-u', 'origin', 'main']);
  if (withUnpushed) {
    fs.writeFileSync(path.join(work, 'b.txt'), 'two\n');
    git(work, ['add', 'b.txt']);
    git(work, ['commit', '-m', 'two (unpushed)']);
  }
  return work;
}

function plantLegacyFiles(dir) {
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version: '0.0.1' }));
  fs.writeFileSync(path.join(dir, 'agents', 'alpha.md'), 'alpha\n');
  fs.writeFileSync(path.join(dir, 'agents', 'only-legacy.md'), 'only legacy\n');
  fs.writeFileSync(path.join(dir, 'commands', 'one.md'), 'one\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'legacy fixture\n');
}

// ---------------------------------------------------------------------------
// A. the bug
// ---------------------------------------------------------------------------
arm('A1: no .git dir inside a git repo with an unpushed commit is NOT refused', () => {
  const outer = makeRepoWithUpstream('a1', true);
  const legacy = path.join(outer, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  const r = shared.legacyDirtyOrUnpushed(legacy);
  assert.strictEqual(r.dirty, false, 'must not borrow the outer repo state; reason: ' + r.reason);
  assert.strictEqual(r.reason, null);
});

arm('A2: no .git dir inside a git repo that is dirty is NOT refused', () => {
  const outer = makeRepoWithUpstream('a2', false);
  fs.writeFileSync(path.join(outer, 'a.txt'), 'changed\n');
  const legacy = path.join(outer, 'sub', 'mindrian-os');
  plantLegacyFiles(legacy);
  const r = shared.legacyDirtyOrUnpushed(legacy);
  assert.strictEqual(r.dirty, false, 'reason: ' + r.reason);
});

arm('A3: outer repo clean (legacy dir ignored) with ONLY an unpushed commit is NOT refused', () => {
  const outer = makeRepoWithUpstream('a3', false);
  fs.writeFileSync(path.join(outer, '.gitignore'), '.claude/\n');
  git(outer, ['add', '.gitignore']);
  git(outer, ['commit', '-m', 'ignore .claude (unpushed)']);
  const legacy = path.join(outer, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  assert.strictEqual(git(outer, ['status', '--porcelain']).trim(), '', 'outer status is clean');
  assert.ok(git(outer, ['log', '@{u}..HEAD', '--oneline']).trim().length > 0, 'outer has an unpushed commit');
  const r = shared.legacyDirtyOrUnpushed(legacy);
  assert.strictEqual(r.dirty, false, 'reason: ' + r.reason);
});

// ---------------------------------------------------------------------------
// B, C. real clones still refuse
// ---------------------------------------------------------------------------
arm('B: real clone with an unpushed commit IS refused', () => {
  const clone = makeRepoWithUpstream('b', true);
  const r = shared.legacyDirtyOrUnpushed(clone);
  assert.strictEqual(r.dirty, true);
  assert.ok(/unpushed/.test(r.reason), r.reason);
});

arm('C: dirty real clone IS refused', () => {
  const clone = makeRepoWithUpstream('c', false);
  fs.writeFileSync(path.join(clone, 'a.txt'), 'changed\n');
  const r = shared.legacyDirtyOrUnpushed(clone);
  assert.strictEqual(r.dirty, true);
  assert.ok(/uncommitted/.test(r.reason), r.reason);
});

arm('C2: real clone with no upstream is refused (conservative)', () => {
  const base = tmp('c2');
  git(base, ['init', '-b', 'main']);
  fs.writeFileSync(path.join(base, 'a.txt'), 'one\n');
  git(base, ['add', 'a.txt']);
  git(base, ['commit', '-m', 'one']);
  const r = shared.legacyDirtyOrUnpushed(base);
  assert.strictEqual(r.dirty, true);
  assert.ok(/no upstream/.test(r.reason), r.reason);
});

// ---------------------------------------------------------------------------
// D. hasOwnGitRoot
// ---------------------------------------------------------------------------
arm('D: hasOwnGitRoot truth table', () => {
  assert.strictEqual(typeof shared.hasOwnGitRoot, 'function', 'hasOwnGitRoot must be exported');
  const outer = makeRepoWithUpstream('d', false);
  const inner = path.join(outer, 'inner');
  fs.mkdirSync(inner);
  assert.strictEqual(shared.hasOwnGitRoot(outer), true, 'repo root');
  assert.strictEqual(shared.hasOwnGitRoot(inner), false, 'subdir of a repo');
  const plain = tmp('d-plain');
  assert.strictEqual(shared.hasOwnGitRoot(plain), false, 'no git at all');
  const gitfile = path.join(tmp('d-file'), 'wt');
  fs.mkdirSync(gitfile);
  fs.writeFileSync(path.join(gitfile, '.git'), 'gitdir: /nowhere\n');
  assert.strictEqual(shared.hasOwnGitRoot(gitfile), true, '.git file counts');
  assert.strictEqual(shared.hasOwnGitRoot(path.join(plain, 'missing')), false, 'missing dir');
});

// ---------------------------------------------------------------------------
// G. controls
// ---------------------------------------------------------------------------
arm('G1: clean pushed real clone passes', () => {
  const clone = makeRepoWithUpstream('g1', false);
  const r = shared.legacyDirtyOrUnpushed(clone);
  assert.strictEqual(r.dirty, false, r.reason);
});

arm('G2: directory with no git anywhere passes', () => {
  const d = tmp('g2');
  plantLegacyFiles(d);
  const r = shared.legacyDirtyOrUnpushed(d);
  assert.strictEqual(r.dirty, false);
});

arm('G3: isLegacyDevClone is unchanged for a no-origin directory', () => {
  const d = tmp('g3');
  assert.strictEqual(shared.isLegacyDevClone(d), false);
});

// ---------------------------------------------------------------------------
// E. migrator end to end
// ---------------------------------------------------------------------------
arm('E1: HOME is a git repo with an unpushed commit; legacy dir has no .git; dry-run proceeds', () => {
  const home = makeRepoWithUpstream('e1', true);
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  const r = migrator.migrate({ apply: false, home });
  assert.strictEqual(r.action, 'dry-run', 'got ' + r.action + ': ' + r.detail);
  assert.strictEqual(r.ok, true);
  assert.ok(fs.existsSync(legacy), 'dry-run removes nothing');
});

arm('E2: legacy dir that is a real dirty clone still refuses', () => {
  const home = tmp('e2');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  fs.mkdirSync(legacy, { recursive: true });
  git(legacy, ['init', '-b', 'main']);
  fs.writeFileSync(path.join(legacy, 'a.txt'), 'one\n');
  const r = migrator.migrate({ apply: false, home });
  assert.strictEqual(r.action, 'refused', 'got ' + r.action);
  assert.ok(fs.existsSync(legacy));
});

// ---------------------------------------------------------------------------
// F. symlink repoint
// ---------------------------------------------------------------------------
function plantCache(home, version) {
  const root = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos', version }));
  fs.writeFileSync(path.join(root, 'agents', 'alpha.md'), 'alpha cache\n');
  fs.writeFileSync(path.join(root, 'commands', 'one.md'), 'one cache\n');
  return root;
}

function plantSymlinks(home, legacy) {
  const claude = path.join(home, '.claude');
  const other = path.join(home, 'elsewhere');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'keep.md'), 'keep\n');
  fs.mkdirSync(path.join(claude, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(claude, 'commands', 'mos'), { recursive: true });
  fs.mkdirSync(path.join(claude, 'skills'), { recursive: true });
  // repoint (file exists in cache)
  fs.symlinkSync(path.join(legacy, 'agents', 'alpha.md'), path.join(claude, 'agents', 'alpha.md'));
  // removal (file missing in cache)
  fs.symlinkSync(path.join(legacy, 'agents', 'only-legacy.md'), path.join(claude, 'agents', 'only-legacy.md'));
  // repoint in commands/mos
  fs.symlinkSync(path.join(legacy, 'commands', 'one.md'), path.join(claude, 'commands', 'mos', 'one.md'));
  // unrelated link, must stay
  fs.symlinkSync(path.join(other, 'keep.md'), path.join(claude, 'agents', 'keep.md'));
  // regular file, must stay
  fs.writeFileSync(path.join(claude, 'agents', 'plain.md'), 'plain\n');
  // sibling dir name that only shares a prefix with legacy, must stay
  fs.symlinkSync(path.join(legacy + '-plugin', 'agents', 'alpha.md'), path.join(claude, 'agents', 'prefix.md'));
  return claude;
}

arm('F1: dry-run reports planned repoints and removals, changes nothing, writes no manifest', () => {
  assert.strictEqual(typeof migrator.repointLegacySymlinks, 'function', 'repointLegacySymlinks must be exported');
  const home = tmp('f1');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  const cache = plantCache(home, '2.0.0-beta.9');
  const claude = plantSymlinks(home, legacy);
  const before = fs.readlinkSync(path.join(claude, 'agents', 'alpha.md'));
  const r = migrator.repointLegacySymlinks(home, legacy, cache, false);
  const byLink = {};
  for (const p of r.planned) byLink[path.relative(claude, p.link)] = p;
  assert.deepStrictEqual(Object.keys(byLink).sort(),
    [path.join('agents', 'alpha.md'), path.join('agents', 'only-legacy.md'), path.join('commands', 'mos', 'one.md')]);
  assert.strictEqual(byLink[path.join('agents', 'alpha.md')].action, 'repoint');
  assert.strictEqual(byLink[path.join('agents', 'alpha.md')].newTarget, path.join(cache, 'agents', 'alpha.md'));
  assert.strictEqual(byLink[path.join('agents', 'only-legacy.md')].action, 'remove');
  assert.strictEqual(byLink[path.join('agents', 'only-legacy.md')].newTarget, null);
  assert.strictEqual(fs.readlinkSync(path.join(claude, 'agents', 'alpha.md')), before, 'link unchanged');
  assert.ok(!fs.existsSync(path.join(home, '.mindrian')), 'no manifest dir on dry-run');
  assert.strictEqual(r.manifestPath, null);
});

arm('F2: apply writes the manifest first, repoints, removes, leaves unrelated links', () => {
  const home = tmp('f2');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  const cache = plantCache(home, '2.0.0-beta.9');
  const claude = plantSymlinks(home, legacy);
  const r = migrator.repointLegacySymlinks(home, legacy, cache, true);
  assert.ok(r.manifestPath && fs.existsSync(r.manifestPath), 'manifest exists');
  assert.ok(path.basename(r.manifestPath).startsWith('legacy-symlink-manifest-'), r.manifestPath);
  assert.strictEqual(path.dirname(r.manifestPath), path.join(home, '.mindrian'));
  const manifest = JSON.parse(fs.readFileSync(r.manifestPath, 'utf8'));
  const entries = manifest.entries || manifest;
  assert.strictEqual(entries.length, 3);
  for (const e of entries) {
    for (const k of ['link', 'originalTarget', 'action', 'newTarget']) assert.ok(k in e, 'manifest key ' + k);
  }
  assert.strictEqual(fs.readlinkSync(path.join(claude, 'agents', 'alpha.md')), path.join(cache, 'agents', 'alpha.md'));
  assert.strictEqual(fs.readFileSync(path.join(claude, 'agents', 'alpha.md'), 'utf8'), 'alpha cache\n', 'repointed link resolves');
  assert.strictEqual(fs.readlinkSync(path.join(claude, 'commands', 'mos', 'one.md')), path.join(cache, 'commands', 'one.md'));
  assert.throws(() => fs.lstatSync(path.join(claude, 'agents', 'only-legacy.md')), /ENOENT/, 'removal link gone');
  assert.ok(fs.lstatSync(path.join(claude, 'agents', 'keep.md')).isSymbolicLink(), 'unrelated link stays');
  assert.ok(fs.lstatSync(path.join(claude, 'agents', 'prefix.md')).isSymbolicLink(), 'prefix-sibling link stays');
  assert.strictEqual(fs.readFileSync(path.join(claude, 'agents', 'plain.md'), 'utf8'), 'plain\n');
});

arm('F3: with no active cache install every legacy link is planned for removal', () => {
  const home = tmp('f3');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  const claude = plantSymlinks(home, legacy);
  const r = migrator.repointLegacySymlinks(home, legacy, null, false);
  assert.strictEqual(r.planned.length, 3);
  assert.ok(r.planned.every((p) => p.action === 'remove' && p.newTarget === null));
  assert.ok(fs.lstatSync(path.join(claude, 'agents', 'alpha.md')).isSymbolicLink());
});

arm('F4: missing ~/.claude dirs are fine (nothing planned)', () => {
  const home = tmp('f4');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  const r = migrator.repointLegacySymlinks(home, legacy, null, true);
  assert.deepStrictEqual(r.planned, []);
  assert.strictEqual(r.manifestPath, null, 'no manifest when nothing to do');
});

arm('F5: migrate dry-run carries symlinks.planned; apply repoints after removal', () => {
  const home = tmp('f5');
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  plantLegacyFiles(legacy);
  plantCache(home, '2.0.0-beta.9');
  const claude = plantSymlinks(home, legacy);
  const dry = migrator.migrate({ apply: false, home });
  assert.strictEqual(dry.action, 'dry-run', dry.detail);
  assert.ok(dry.symlinks && dry.symlinks.planned.length === 3, 'dry-run lists 3 planned');
  assert.ok(fs.existsSync(legacy));
  assert.ok(!fs.existsSync(path.join(home, '.mindrian')));
  const done = migrator.migrate({ apply: true, home });
  assert.strictEqual(done.action, 'removed', done.detail);
  assert.ok(!fs.existsSync(legacy), 'legacy removed');
  assert.ok(done.symlinks.manifestPath && fs.existsSync(done.symlinks.manifestPath));
  assert.strictEqual(fs.readFileSync(path.join(claude, 'agents', 'alpha.md'), 'utf8'), 'alpha cache\n');
});

// ---------------------------------------------------------------------------
for (const d of made) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}
console.log('\nPASSED=' + PASS + ' FAILED=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
