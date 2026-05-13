#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-05 Task 1 -- lib/core/cache-prune.cjs hermetic test fixtures.
 *
 * Six scenarios exercise pruneMarketplaceCache():
 *   cp.1  5-dir cache (4 stale + 1 active); keep active + 2 most-recent;
 *         remove the 2 oldest non-active. Asserts both the returned shape
 *         AND the on-disk state.
 *   cp.2  Corrupt installed_plugins.json -> skipped:true; reason mentions
 *         the file; nothing on disk changed.
 *   cp.3  dryRun:true -> same `removed` list reported, but ALL 5 dirs still
 *         on disk after the call.
 *   cp.4  Only the active dir exists -> kept:[active], removed:[].
 *   cp.5  Belt-and-suspenders: monkey-patch fs.rmSync to throw if called on
 *         the active path -> assert no throw (the function never tried to
 *         rm the active dir).
 *   cp.6  Canon Part 8 grep on the source file -- no fetch/http/curl/
 *         brain.mindrian/tavily anywhere in lib/core/cache-prune.cjs.
 *
 * Hermetic envelope: per-test mkdtempSync HOME so cache-prune.cjs reads a
 * scratch ~/.claude/plugins. Mirrors tests/test-doctor-class-i.cjs's
 * makeTmpHome pattern (Phase 123 Plan-03).
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Phase-123 block) and
 * picked up automatically by tests/run-all.sh's test-*.cjs glob.
 *
 * RED until Phase 123 Plan-05 Task 1 lands lib/core/cache-prune.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_PRUNE_SRC = path.join(REPO_ROOT, 'lib', 'core', 'cache-prune.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.stack || err && err.message || err)); }

function makeTmpHome(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '123-05-cp-' + suffix + '-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'plugins'), { recursive: true });
  return tmp;
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Synthesize one cache version dir at <home>/.claude/plugins/cache/<marketplace>/mos/<version>/.
function makeCacheVersion(home, marketplace, version) {
  const cacheDir = path.join(home, '.claude', 'plugins', 'cache', marketplace, 'mos', version);
  fs.mkdirSync(path.join(cacheDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version }, null, 2)
  );
  return cacheDir;
}

// Synthesize installed_plugins.json declaring `version` as the active mos install.
function makeInstalledPluginsJson(home, version, installPath) {
  const file = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    plugins: {
      'mos@mindrian-marketplace': [
        { scope: 'user', installPath, version, installedAt: '2026-05-13T00:00:00Z', lastUpdated: '2026-05-13T00:00:00Z' }
      ]
    }
  }, null, 2));
  return file;
}

// Set an mtime on a path some number of seconds in the past (relative to now).
function setMtimeAgo(p, secondsAgo) {
  const now = Math.floor(Date.now() / 1000);
  const t = now - secondsAgo;
  fs.utimesSync(p, t, t);
}

// Load fresh (clear require cache so each scenario sees the helper without
// state bleed from monkey-patching in cp.5).
function freshRequire(src) {
  delete require.cache[require.resolve(src)];
  return require(src);
}

// ---------------------------------------------------------------------------
// cp.1: 5-dir cache; keep active + 2 most-recent non-active; remove 2 oldest.
// ---------------------------------------------------------------------------
function cp_1() {
  const name = 'cp.1: 5-dir cache prunes 2 oldest non-active, keeps active + 2 most-recent';
  const home = makeTmpHome('1');
  try {
    const marketplace = 'mindrian-marketplace';
    const versions = ['1.10.0', '1.11.0', '1.12.0', '1.13.0-beta.9', '1.13.0-beta.12'];
    const dirs = {};
    for (const v of versions) {
      dirs[v] = makeCacheVersion(home, marketplace, v);
    }
    // mtime ordering: 1.10.0 oldest -> 1.13.0-beta.12 newest.
    setMtimeAgo(dirs['1.10.0'], 5000);
    setMtimeAgo(dirs['1.11.0'], 4000);
    setMtimeAgo(dirs['1.12.0'], 3000);
    setMtimeAgo(dirs['1.13.0-beta.9'], 2000);
    setMtimeAgo(dirs['1.13.0-beta.12'], 1000);
    makeInstalledPluginsJson(home, '1.13.0-beta.12', dirs['1.13.0-beta.12']);

    const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
    const r = pruneMarketplaceCache({ home, retainCount: 2 });

    assert.strictEqual(r.skipped, false, 'skipped should be false');
    assert.strictEqual(r.reason, null, 'reason should be null on success');
    // kept: active + 2 newest non-active (sorted by mtime DESC). Order:
    // assert membership, not order (the helper may return in any order).
    const keptSet = new Set(r.kept);
    assert.strictEqual(keptSet.size, 3, 'kept should have 3 entries (active + 2 most-recent non-active)');
    assert.ok(keptSet.has('1.13.0-beta.12'), 'active version must be kept');
    assert.ok(keptSet.has('1.13.0-beta.9'), '1.13.0-beta.9 (2nd-newest) must be kept');
    assert.ok(keptSet.has('1.12.0'), '1.12.0 (3rd-newest) must be kept');
    // removed: the 2 oldest non-active.
    const removedSet = new Set(r.removed);
    assert.strictEqual(removedSet.size, 2, 'removed should have 2 entries');
    assert.ok(removedSet.has('1.10.0'), '1.10.0 (oldest) must be removed');
    assert.ok(removedSet.has('1.11.0'), '1.11.0 (older) must be removed');
    // On-disk state.
    assert.ok(fs.existsSync(dirs['1.13.0-beta.12']), 'active dir still on disk');
    assert.ok(fs.existsSync(dirs['1.13.0-beta.9']), '2nd-newest still on disk');
    assert.ok(fs.existsSync(dirs['1.12.0']), '3rd-newest still on disk');
    assert.ok(!fs.existsSync(dirs['1.11.0']), '1.11.0 should be deleted');
    assert.ok(!fs.existsSync(dirs['1.10.0']), '1.10.0 should be deleted');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// cp.2: Corrupt installed_plugins.json -> skipped:true, nothing on disk changed.
// ---------------------------------------------------------------------------
function cp_2() {
  const name = 'cp.2: corrupt installed_plugins.json -> skipped, no mutation';
  const home = makeTmpHome('2');
  try {
    const marketplace = 'mindrian-marketplace';
    const dirs = {
      '1.10.0': makeCacheVersion(home, marketplace, '1.10.0'),
      '1.13.0-beta.12': makeCacheVersion(home, marketplace, '1.13.0-beta.12'),
    };
    // Corrupt installed_plugins.json with invalid JSON.
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{bad json not parseable\n');

    const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
    const r = pruneMarketplaceCache({ home, retainCount: 2 });

    assert.strictEqual(r.skipped, true, 'skipped should be true on corrupt json');
    assert.ok(typeof r.reason === 'string' && /installed_plugins/i.test(r.reason), 'reason should mention installed_plugins.json');
    // Nothing on disk changed.
    assert.ok(fs.existsSync(dirs['1.10.0']), '1.10.0 should NOT have been deleted');
    assert.ok(fs.existsSync(dirs['1.13.0-beta.12']), '1.13.0-beta.12 should NOT have been deleted');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// cp.3: dryRun:true -> removed list reported but nothing on disk changed.
// ---------------------------------------------------------------------------
function cp_3() {
  const name = 'cp.3: dryRun reports victims but does not delete';
  const home = makeTmpHome('3');
  try {
    const marketplace = 'mindrian-marketplace';
    const versions = ['1.10.0', '1.11.0', '1.12.0', '1.13.0-beta.9', '1.13.0-beta.12'];
    const dirs = {};
    for (const v of versions) {
      dirs[v] = makeCacheVersion(home, marketplace, v);
    }
    setMtimeAgo(dirs['1.10.0'], 5000);
    setMtimeAgo(dirs['1.11.0'], 4000);
    setMtimeAgo(dirs['1.12.0'], 3000);
    setMtimeAgo(dirs['1.13.0-beta.9'], 2000);
    setMtimeAgo(dirs['1.13.0-beta.12'], 1000);
    makeInstalledPluginsJson(home, '1.13.0-beta.12', dirs['1.13.0-beta.12']);

    const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
    const r = pruneMarketplaceCache({ home, retainCount: 2, dryRun: true });

    assert.strictEqual(r.skipped, false, 'skipped should be false (the read succeeded)');
    const removedSet = new Set(r.removed);
    assert.strictEqual(removedSet.size, 2, 'removed should have 2 entries reported');
    assert.ok(removedSet.has('1.10.0'), '1.10.0 should be in removed list');
    assert.ok(removedSet.has('1.11.0'), '1.11.0 should be in removed list');
    // ALL 5 dirs still on disk (dry-run never mutates).
    for (const v of versions) {
      assert.ok(fs.existsSync(dirs[v]), v + ' should still be on disk after dry-run');
    }
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// cp.4: Only the active dir exists -> no-op.
// ---------------------------------------------------------------------------
function cp_4() {
  const name = 'cp.4: only the active dir exists -> no-op';
  const home = makeTmpHome('4');
  try {
    const marketplace = 'mindrian-marketplace';
    const activeDir = makeCacheVersion(home, marketplace, '1.13.0-beta.12');
    makeInstalledPluginsJson(home, '1.13.0-beta.12', activeDir);

    const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
    const r = pruneMarketplaceCache({ home, retainCount: 2 });

    assert.strictEqual(r.skipped, false);
    assert.deepStrictEqual(new Set(r.kept), new Set(['1.13.0-beta.12']), 'kept should be exactly the active version');
    assert.deepStrictEqual(r.removed, [], 'removed should be empty');
    assert.ok(fs.existsSync(activeDir), 'active dir still on disk');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// cp.5: Belt-and-suspenders -- monkey-patch fs.rmSync to throw if called on
// the active path. Assert no throw + active dir untouched.
// ---------------------------------------------------------------------------
function cp_5() {
  const name = 'cp.5: belt-and-suspenders -- fs.rmSync never called on active path';
  const home = makeTmpHome('5');
  try {
    const marketplace = 'mindrian-marketplace';
    // Synthesize a state where the active dir is the OLDEST mtime -- the
    // mtime-DESC sort would NOT include it in the keep-by-recency slot;
    // only the active-version protection keeps it.
    const dirs = {
      '1.13.0-beta.12': makeCacheVersion(home, marketplace, '1.13.0-beta.12'),
      '1.12.0': makeCacheVersion(home, marketplace, '1.12.0'),
      '1.11.0': makeCacheVersion(home, marketplace, '1.11.0'),
      '1.10.0': makeCacheVersion(home, marketplace, '1.10.0'),
    };
    // Active is OLDEST.
    setMtimeAgo(dirs['1.13.0-beta.12'], 9000);
    setMtimeAgo(dirs['1.12.0'], 3000);
    setMtimeAgo(dirs['1.11.0'], 2000);
    setMtimeAgo(dirs['1.10.0'], 1000);
    makeInstalledPluginsJson(home, '1.13.0-beta.12', dirs['1.13.0-beta.12']);

    // Monkey-patch fs.rmSync to throw if called on the active path.
    const activeBasename = '1.13.0-beta.12';
    const origRmSync = fs.rmSync;
    fs.rmSync = function (p, opts) {
      const segs = String(p).split(/[\\/]/);
      if (segs[segs.length - 1] === activeBasename) {
        throw new Error('CP5 GUARD: fs.rmSync was called on the active dir path: ' + p);
      }
      return origRmSync.call(fs, p, opts);
    };
    let threw = null;
    try {
      const { pruneMarketplaceCache } = freshRequire(CACHE_PRUNE_SRC);
      pruneMarketplaceCache({ home, retainCount: 2 });
    } catch (e) {
      threw = e;
    } finally {
      fs.rmSync = origRmSync;
    }

    assert.strictEqual(threw, null, 'pruneMarketplaceCache must not invoke fs.rmSync on the active dir');
    assert.ok(fs.existsSync(dirs['1.13.0-beta.12']), 'active dir still on disk after prune');
    pass(name);
  } catch (e) {
    failTest(name, e);
  } finally {
    rmTmp(home);
  }
}

// ---------------------------------------------------------------------------
// cp.6: Canon Part 8 grep on the source file.
// ---------------------------------------------------------------------------
function cp_6() {
  const name = 'cp.6: Canon Part 8 grep on lib/core/cache-prune.cjs';
  try {
    const r = spawnSync('grep', ['-E', 'fetch|http|curl|brain\\.mindrian|tavily', CACHE_PRUNE_SRC], { encoding: 'utf8' });
    // grep exit 1 = no match (the file is Part-8 clean). exit 0 = at least one match (BAD).
    if (r.status === 1) {
      pass(name);
    } else if (r.status === 0) {
      failTest(name, new Error('grep found forbidden tokens in lib/core/cache-prune.cjs:\n' + r.stdout));
    } else {
      failTest(name, new Error('grep exited with unexpected status: ' + r.status + ' stderr: ' + r.stderr));
    }
  } catch (e) {
    failTest(name, e);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function main() {
  cp_1();
  cp_2();
  cp_3();
  cp_4();
  cp_5();
  cp_6();

  const total = passed + failed;
  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' tests/test-cache-prune.cjs: ' + passed + '/' + total + ' scenarios passed');
  process.exit(failed === 0 ? 0 : 1);
}

main();
