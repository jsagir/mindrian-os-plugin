#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-06 -- lib/core/cache-prune.cjs stale-backup prune extension.
 *
 * Phase 123 shipped pruneMarketplaceCache covering ~/.claude/plugins/cache/
 * <marketplace>/mos/<version>/ subdirs (active + N most-recent retained;
 * rest removed). Phase 126 extends the SAME function with a second prune
 * surface: stale backup directories at ~/.claude/plugins/mindrian-os.stale-
 * <tag>-<timestamp>/ produced by Phase 95.2's atomic-swap recovery flow.
 *
 * Stale backups accumulate on long-running tester installs (Lawrence, Gary,
 * etc) because Phase 95.2 retains them "indefinitely" by contract -- after
 * 24h the user can delete manually, but most users never do. Over months
 * this fills ~/.claude/plugins/ with dozens of stale-* dirs.
 *
 * Seven scenarios cover:
 *   ext.1  stale backup (60d) is pruned at default 30d window
 *   ext.2  recent backup (5d) is retained at default 30d window
 *   ext.3  MOS_CACHE_PRUNE_AGE_DAYS=3 env override -- 5d-old backup pruned
 *   ext.4  MOS_CACHE_PRUNE_AGE_DAYS=90 env override -- 60d-old backup retained
 *   ext.5  idempotency -- second invocation removes nothing additional
 *   ext.6  no regression in Phase 123 cache prune behavior (active + N kept;
 *          stale backup pruned; recent backup retained -- all in one call)
 *   ext.7  pattern match safety -- mindrian-os/ (live install) and other
 *          siblings are NEVER touched; only mindrian-os.stale-* prefix matches
 *
 * Hermetic envelope: per-test mkdtempSync HOME. Mirrors test-cache-prune.cjs.
 *
 * RED until Task 2 lands the extension in lib/core/cache-prune.cjs.
 *
 * Canon Part 8: this test file is LOCAL-only (fs mkdtemp + read + rmSync on
 * scratch dirs); zero network surface.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_PRUNE_SRC = path.join(REPO_ROOT, 'lib', 'core', 'cache-prune.cjs');

const DAY_MS = 86400000;

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) {
  failed += 1;
  console.log('FAIL: ' + name + '\n    ' + (err && err.stack || err && err.message || err));
}

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '126-06-cp-ext-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Seed a backup dir at <home>/.claude/plugins/<name>/ with mtime set ageDays
// in the past. Returns the absolute path.
function seedBackup(home, name, ageDays) {
  const dir = path.join(home, '.claude', 'plugins', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name, stub: true }));
  const tsSeconds = Math.floor((Date.now() - ageDays * DAY_MS) / 1000);
  fs.utimesSync(dir, tsSeconds, tsSeconds);
  return dir;
}

// Seed a cache version dir at <home>/.claude/plugins/cache/<marketplace>/mos/<version>/.
function seedCacheVersion(home, marketplace, version, mtimeSecondsAgo) {
  const dir = path.join(home, '.claude', 'plugins', 'cache', marketplace, 'mos', version);
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version })
  );
  if (typeof mtimeSecondsAgo === 'number') {
    const t = Math.floor(Date.now() / 1000) - mtimeSecondsAgo;
    fs.utimesSync(dir, t, t);
  }
  return dir;
}

// Seed installed_plugins.json declaring `version` as the active mos install.
function seedActive(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-05-14T00:00:00Z', lastUpdated: '2026-05-14T00:00:00Z' }
      ]
    }
  }, null, 2));
  return file;
}

// Load fresh (clear require cache so each scenario sees a clean module).
function freshRequire(src) {
  delete require.cache[require.resolve(src)];
  return require(src);
}

// Helper: snapshot + restore process.env[key]. If absent, deletion is the
// restore action; if present, value is restored.
function withEnv(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const prev = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = String(value);
  }
  try {
    return fn();
  } finally {
    if (had) {
      process.env[key] = prev;
    } else {
      delete process.env[key];
    }
  }
}

// ---------------------------------------------------------------------------
// ext.1: stale backup (60d) pruned at default 30d window.
// ---------------------------------------------------------------------------
function ext_1() {
  const name = 'ext.1: 60d-old backup pruned at default 30d window';
  const home = makeTmpHome('1');
  try {
    // Active cache version so installed_plugins.json read succeeds and the
    // function does not skip out before reaching the stale-backup pass.
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    const staleDir = seedBackup(home, 'mindrian-os.stale-1.10.10-20250101-120000', 60);
    assert.ok(fs.existsSync(staleDir), 'precondition: stale backup exists');

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', undefined, () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r.skipped, false, 'should not skip when installed_plugins.json is readable');
      assert.ok(Array.isArray(r.removedBackups), 'removedBackups must be an array on the return value');
      assert.ok(r.removedBackups.some(p => p.endsWith('mindrian-os.stale-1.10.10-20250101-120000')),
        'removedBackups must include the 60d-old stale backup, got: ' + JSON.stringify(r.removedBackups));
    });

    assert.ok(!fs.existsSync(staleDir), 'stale backup dir should be removed from disk');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.2: recent backup (5d) retained at default 30d window.
// ---------------------------------------------------------------------------
function ext_2() {
  const name = 'ext.2: 5d-old backup retained at default 30d window';
  const home = makeTmpHome('2');
  try {
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    const recentDir = seedBackup(home, 'mindrian-os.stale-1.13.0-beta.13-20260509-120000', 5);
    assert.ok(fs.existsSync(recentDir), 'precondition: recent backup exists');

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', undefined, () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r.skipped, false);
      // Backup MUST NOT be in removedBackups list.
      assert.ok(!(r.removedBackups || []).some(p => p.endsWith('mindrian-os.stale-1.13.0-beta.13-20260509-120000')),
        'removedBackups must NOT include the 5d-old recent backup, got: ' + JSON.stringify(r.removedBackups));
    });

    assert.ok(fs.existsSync(recentDir), 'recent backup dir should remain on disk');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.3: MOS_CACHE_PRUNE_AGE_DAYS=3 -- 5d-old backup is pruned (5 > 3).
// ---------------------------------------------------------------------------
function ext_3() {
  const name = 'ext.3: env override MOS_CACHE_PRUNE_AGE_DAYS=3 prunes 5d-old backup';
  const home = makeTmpHome('3');
  try {
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    const dir = seedBackup(home, 'mindrian-os.stale-1.13.0-beta.13-20260509-120000', 5);
    assert.ok(fs.existsSync(dir), 'precondition');

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', '3', () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r.skipped, false);
      assert.ok((r.removedBackups || []).some(p => p.endsWith('mindrian-os.stale-1.13.0-beta.13-20260509-120000')),
        'removedBackups must include the backup (5d > 3d), got: ' + JSON.stringify(r.removedBackups));
      // Sanity: the function surfaces the active age window in some form.
      assert.strictEqual(r.ageDays, 3, 'returned ageDays should equal env override value');
    });

    assert.ok(!fs.existsSync(dir), 'backup dir should be removed');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.4: MOS_CACHE_PRUNE_AGE_DAYS=90 -- 60d-old backup is retained (60 < 90).
// ---------------------------------------------------------------------------
function ext_4() {
  const name = 'ext.4: env override MOS_CACHE_PRUNE_AGE_DAYS=90 retains 60d-old backup';
  const home = makeTmpHome('4');
  try {
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    const dir = seedBackup(home, 'mindrian-os.stale-1.10.10-20250101-120000', 60);

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', '90', () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r.skipped, false);
      assert.ok(!(r.removedBackups || []).some(p => p.endsWith('mindrian-os.stale-1.10.10-20250101-120000')),
        'removedBackups must NOT include the 60d backup (window is 90d), got: ' + JSON.stringify(r.removedBackups));
      assert.strictEqual(r.ageDays, 90);
    });

    assert.ok(fs.existsSync(dir), 'backup dir should remain on disk');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.5: idempotency -- 2nd invocation removes nothing additional; final state
// matches state after first invocation.
// ---------------------------------------------------------------------------
function ext_5() {
  const name = 'ext.5: idempotent -- second invocation removes nothing additional';
  const home = makeTmpHome('5');
  try {
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    const staleDir = seedBackup(home, 'mindrian-os.stale-1.10.10-20250101-120000', 60);
    const recentDir = seedBackup(home, 'mindrian-os.stale-1.13.0-beta.13-20260509-120000', 5);

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', undefined, () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);

      const r1 = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r1.skipped, false);
      assert.strictEqual((r1.removedBackups || []).length, 1, 'first call removes exactly 1 stale backup');

      // Second invocation -- the recent backup is still there but young, the
      // stale one is gone, so nothing should be removed.
      const r2 = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r2.skipped, false);
      assert.deepStrictEqual(r2.removedBackups || [], [], 'second invocation removes zero backups');
    });

    assert.ok(!fs.existsSync(staleDir), 'stale backup gone');
    assert.ok(fs.existsSync(recentDir), 'recent backup still on disk');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.6: no regression in Phase 123 cache-prune behavior.
// Setup: active 1.13.0-beta.14 + beta.13 + beta.9 cache versions (Phase 123)
// + 1 stale backup + 1 recent backup (Phase 126). Single invocation should:
//   - keep active + 2 most-recent non-active (Phase 123 contract)
//   - prune stale backup (Phase 126 contract)
//   - retain recent backup (Phase 126 contract)
// Here retainCount=1 so that beta.9 (oldest, ONE non-active slot only fits
// beta.13) gets pruned -- a real assertion the Phase 123 path still mutates.
// ---------------------------------------------------------------------------
function ext_6() {
  const name = 'ext.6: no regression -- cache prune + stale-backup prune coexist in one call';
  const home = makeTmpHome('6');
  try {
    const m = 'mindrian-marketplace';
    const active = seedCacheVersion(home, m, '1.13.0-beta.14', 100); // newest
    const beta13 = seedCacheVersion(home, m, '1.13.0-beta.13', 1000);
    const beta9 = seedCacheVersion(home, m, '1.13.0-beta.9', 5000); // oldest
    seedActive(home, '1.13.0-beta.14', active);

    const staleBackup = seedBackup(home, 'mindrian-os.stale-1.10.10-20250101-120000', 60);
    const recentBackup = seedBackup(home, 'mindrian-os.stale-1.13.0-beta.13-20260509-120000', 5);

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', undefined, () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 1 });
      assert.strictEqual(r.skipped, false);

      // Phase 123 contract: active + 1 most-recent non-active kept.
      const keptSet = new Set(r.kept);
      assert.ok(keptSet.has('1.13.0-beta.14'), 'active version kept');
      assert.ok(keptSet.has('1.13.0-beta.13'), '1.13.0-beta.13 (most-recent non-active) kept');
      assert.ok(!keptSet.has('1.13.0-beta.9'), '1.13.0-beta.9 not kept (oldest, single retain slot taken by beta.13)');
      assert.ok(r.removed.includes('1.13.0-beta.9'), 'removed list contains 1.13.0-beta.9');

      // Phase 126 contract: stale backup removed, recent backup retained.
      const removedBackupsBaseSet = new Set((r.removedBackups || []).map(p => path.basename(p)));
      assert.ok(removedBackupsBaseSet.has('mindrian-os.stale-1.10.10-20250101-120000'),
        'stale backup must be in removedBackups');
      assert.ok(!removedBackupsBaseSet.has('mindrian-os.stale-1.13.0-beta.13-20260509-120000'),
        'recent backup must NOT be in removedBackups');
    });

    assert.ok(fs.existsSync(active), 'active dir still on disk');
    assert.ok(fs.existsSync(beta13), 'beta.13 still on disk');
    assert.ok(!fs.existsSync(beta9), 'beta.9 should be deleted');
    assert.ok(!fs.existsSync(staleBackup), 'stale backup deleted');
    assert.ok(fs.existsSync(recentBackup), 'recent backup retained');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// ext.7: pattern-match safety -- mindrian-os/ (live install) and unrelated
// siblings MUST be untouched. Only `mindrian-os.stale-` prefix matches.
// ---------------------------------------------------------------------------
function ext_7() {
  const name = 'ext.7: live install dir + unrelated siblings are never touched';
  const home = makeTmpHome('7');
  try {
    const activeDir = seedCacheVersion(home, 'mindrian-marketplace', '1.13.0-beta.14', 100);
    seedActive(home, '1.13.0-beta.14', activeDir);

    // Live install dir (sibling of stale backups). Old mtime -- if the regex
    // pattern were `mindrian-os` (prefix-only) this would be a false positive.
    const liveInstall = path.join(home, '.claude', 'plugins', 'mindrian-os');
    fs.mkdirSync(liveInstall, { recursive: true });
    fs.writeFileSync(path.join(liveInstall, 'plugin.json'), JSON.stringify({ name: 'mos' }));
    const oldTs = Math.floor((Date.now() - 365 * DAY_MS) / 1000);
    fs.utimesSync(liveInstall, oldTs, oldTs);

    // Unrelated sibling -- another plugin entirely. Old mtime.
    const other = path.join(home, '.claude', 'plugins', 'some-other-plugin');
    fs.mkdirSync(other, { recursive: true });
    const otherFile = path.join(other, 'plugin.json');
    fs.writeFileSync(otherFile, '{}');
    fs.utimesSync(other, oldTs, oldTs);

    // One legitimate stale backup -- this should be the ONLY thing pruned.
    const staleDir = seedBackup(home, 'mindrian-os.stale-1.10.10-20250101-120000', 60);

    withEnv('MOS_CACHE_PRUNE_AGE_DAYS', undefined, () => {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      const r = pruneMarketplaceCache({ home, retainCount: 2 });
      assert.strictEqual(r.skipped, false);
      assert.strictEqual((r.removedBackups || []).length, 1, 'exactly 1 backup removed');
      assert.ok((r.removedBackups || [])[0].endsWith('mindrian-os.stale-1.10.10-20250101-120000'),
        'only the stale-prefixed dir is in removedBackups');
    });

    assert.ok(fs.existsSync(liveInstall), 'live install mindrian-os/ must be untouched');
    assert.ok(fs.existsSync(other), 'unrelated sibling some-other-plugin/ must be untouched');
    assert.ok(!fs.existsSync(staleDir), 'stale backup was correctly removed');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function main() {
  ext_1();
  ext_2();
  ext_3();
  ext_4();
  ext_5();
  ext_6();
  ext_7();

  const total = passed + failed;
  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' tests/test-cache-prune-extended.cjs: ' + passed + '/' + total + ' scenarios passed');
  process.exit(failed === 0 ? 0 : 1);
}

main();
