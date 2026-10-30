#!/usr/bin/env node
'use strict';

/**
 * Regression (quick 261029-s9x, perf change D): the query-efficiency telemetry
 * hook must stop walking the whole room on every Read, Grep and Glob call.
 *
 * The fact (audit finding 4): scripts/query-efficiency-telemetry.cjs called the
 * sync estimateRoomTokens() on every call. On a 338-file room on /mnt/c that
 * walk cost 613 ms per Read (stat 362 ms, readdir 212 ms), because the cache of
 * that function is a Map in memory and it dies with the hook process.
 *
 * DD-1: a tool result with no countable text (tokens_used 0) exits before the
 *       hook resolves the room and before the estimate. The output is the same.
 * DD-2: the room estimate is cached for 10 minutes in
 *       <room>/.mindrian/token-estimate.json. The validity rule is the age
 *       alone (no mtime check).
 * DD-3: the estimator never creates .mindrian/ (a new .mindrian/ switches on the
 *       Phase 88 block of on-stop).
 * DD-8: a cache miss walks with fs/promises and a bounded fan-out of 32, with
 *       the same skip rules and the same token count as the old sync walk.
 *
 * Arms: T1 API, T2 parity, T3 miss writes the cache, T4 hit skips the walk,
 * T5 mtime does not invalidate, T6 stale by age, T7 future timestamp,
 * T8 corrupt JSON, T9 wrong shape, T10 no .mindrian/, T11 cache path is a
 * directory, T12 read-only .mindrian/, T13 invalid input, T14 hook miss then
 * hit, T15 zero-token exit, T16 hook with a corrupt cache, T17 room-changed
 * checks ignore the cache, T18 Part 8.
 *
 * Node built-ins only. CJS. No framework.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ESTIMATOR_PATH = path.join(REPO, 'lib', 'core', 'token-estimator.cjs');
const HOOK_PATH = path.join(REPO, 'scripts', 'query-efficiency-telemetry.cjs');

try { delete require.cache[require.resolve(ESTIMATOR_PATH)]; } catch (_e) { /* fresh load */ }
const est = require(ESTIMATOR_PATH);

let failed = 0;
async function check(name, fn) {
  try {
    const r = await fn();
    if (r && r.skip) { process.stdout.write('  SKIP ' + name + ': ' + r.skip + '\n'); return; }
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.message ? err.message : err) + '\n');
  }
}
function must(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { must(a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

// A missing function must fail its arm, not crash the file.
function cached(root, opts) {
  if (typeof est.estimateRoomTokensCached !== 'function') throw new Error('estimateRoomTokensCached is not a function');
  return est.estimateRoomTokensCached(root, opts);
}
function walkAsync(root) {
  if (typeof est.walkRoomTokensAsync !== 'function') throw new Error('walkRoomTokensAsync is not a function');
  return est.walkRoomTokensAsync(root);
}
function syncVal(root) {
  est.clearCache();
  return est.estimateRoomTokens(root);
}

// ---------- fixtures ----------

const cleanup = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 's9x-' + prefix + '-'));
  cleanup.push(d);
  return d;
}
function put(root, rel, size) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'a'.repeat(size));
}

/**
 * Build a room with sections s1..s5 of 10 .md files each. Returns the root,
 * the byte total and the file count of the files that must be counted.
 */
function mkRoom(prefix, withMindrian) {
  const root = mkTmp(prefix);
  const acc = { root, bytes: 0, files: 0 };
  function count(rel, size) { put(root, rel, size); acc.bytes += size; acc.files += 1; }
  if (withMindrian) fs.mkdirSync(path.join(root, '.mindrian'));
  for (let i = 1; i <= 5; i++) {
    for (let j = 1; j <= 10; j++) count('s' + i + '/f' + j + '.md', 40 * i + 7 * j);
  }
  return acc;
}

function cacheFile(root) { return path.join(root, '.mindrian', 'token-estimate.json'); }
function tmpLeft(root) {
  try {
    return fs.readdirSync(path.join(root, '.mindrian')).filter((n) => n.startsWith('token-estimate.json.tmp.'));
  } catch (_e) { return []; }
}

function mkHookFixture(prefix) {
  const root = mkTmp(prefix + '-room');
  fs.writeFileSync(path.join(root, '.room-root'), '');
  fs.mkdirSync(path.join(root, '.mindrian'));
  fs.writeFileSync(path.join(root, 'ROOM.md'), '# Room\n'.repeat(200));
  fs.writeFileSync(path.join(root, 'notes.md'), 'x'.repeat(8000));
  put(root, 's1/a.md', 3000);
  const home = mkTmp(prefix + '-home');
  return { root, home };
}
function runHook(payload, fx) {
  const env = Object.assign({}, process.env, { HOME: fx.home, CLAUDE_SLASH_COMMAND: '', MOS_COMMAND_CONTEXT: '' });
  return spawnSync('node', [HOOK_PATH], { input: JSON.stringify(payload), cwd: fx.root, env, encoding: 'utf8', timeout: 15000 });
}
function jsonlLines(home) {
  const p = path.join(home, '.mindrian', 'telemetry', 'query-efficiency.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0);
}
function countedPayload() {
  return { tool_name: 'Read', tool_input: { file_path: 'notes.md' }, tool_response: { content: 'a'.repeat(400) } };
}

// ---------- arms ----------

async function main() {
  // Shared fixture for T3..T9, run in order.
  const shared = mkRoom('shared', true);
  const sharedExpectedTokens = Math.ceil(shared.bytes / 4);
  let t3Value = null;

  await check('T1 API: new exports, constants, and the 8 old exports', () => {
    eq(typeof est.estimateRoomTokensCached, 'function', 'estimateRoomTokensCached type');
    eq(typeof est.walkRoomTokensAsync, 'function', 'walkRoomTokensAsync type');
    eq(est.TOKEN_ESTIMATE_CACHE_FILE, 'token-estimate.json', 'TOKEN_ESTIMATE_CACHE_FILE');
    eq(est.TOKEN_ESTIMATE_MAX_AGE_MS, 600000, 'TOKEN_ESTIMATE_MAX_AGE_MS');
    eq(est.WALK_FANOUT, 32, 'WALK_FANOUT');
    ['estimateTokens', 'estimateRoomTokens', 'clearCache', 'validateEventShape', 'classifyRatio',
      'aggregateEvents'].forEach((n) => eq(typeof est[n], 'function', n + ' type'));
    must(Array.isArray(est.EVENT_REQUIRED_FIELDS), 'EVENT_REQUIRED_FIELDS is an array');
    eq(est.BELOW_THRESHOLD_RATIO, 10, 'BELOW_THRESHOLD_RATIO');
  });

  await check('T2 parity: async walk equals the old sync walk on a 50-file fixture', async () => {
    const f = mkRoom('parity', true);
    const root = f.root;
    function count(rel, size) { put(root, rel, size); f.bytes += size; f.files += 1; }
    count('s1/sub/deep/n.md', 123);
    count('s2/UPPER.MD', 77);
    count('node_modules/pkg/readme.md', 55);
    // Hidden entries must not count.
    put(root, '.mindrian/x.md', 900);
    put(root, '.git/y.md', 900);
    put(root, 's3/.obsidian/z.md', 900);
    put(root, 's4/.hidden.md', 900);
    // Non-.md files must not count.
    put(root, 's5/notes.txt', 900);
    put(root, 's5/img.png', 900);
    // Depth rule: d12 is read (depth 12), d13 is not (depth 13).
    let rel = '';
    for (let d = 1; d <= 13; d++) rel += 'd' + d + '/';
    count(rel.split('/').slice(0, 12).join('/') + '/a.md', 66);
    put(root, rel + 'b.md', 900);
    // Symlinks must not count.
    try {
      fs.symlinkSync(path.join(root, 's1', 'f1.md'), path.join(root, 's1', 'link.md'));
      fs.symlinkSync(path.join(root, 's3'), path.join(root, 's2', 'linkdir'));
    } catch (_e) {
      process.stdout.write('  note T2: symlink creation failed, symlink sub-case skipped\n');
    }
    const syncTokens = syncVal(root);
    const r = await walkAsync(root);
    must(r && typeof r === 'object', 'walkRoomTokensAsync returned an object');
    eq(r.tokens, syncTokens, 'async tokens equal sync tokens');
    eq(r.tokens, Math.ceil(f.bytes / 4), 'tokens equal the expected value');
    eq(r.fileCount, f.files, 'fileCount equals the expected count');
  });

  await check('T3 a miss writes the cache with exactly 4 integer keys', async () => {
    const v = await cached(shared.root);
    t3Value = v;
    eq(v, syncVal(shared.root), 'value equals sync value');
    eq(v, sharedExpectedTokens, 'value equals the expected value');
    const rec = JSON.parse(fs.readFileSync(cacheFile(shared.root), 'utf8'));
    eq(JSON.stringify(Object.keys(rec).sort()), JSON.stringify(['computed_at_ms', 'file_count', 'tokens', 'version']), 'keys');
    Object.keys(rec).forEach((k) => must(Number.isInteger(rec[k]), k + ' is an integer'));
    eq(rec.version, 1, 'version');
    eq(rec.tokens, v, 'record tokens equals the returned value');
    eq(rec.file_count, shared.files, 'file_count');
    eq(tmpLeft(shared.root).length, 0, 'no tmp file left');
  });

  await check('T4 a hit skips the walk (a new file in a section is not counted)', async () => {
    put(shared.root, 's1/big.md', 100000);
    const v = await cached(shared.root);
    eq(v, t3Value, 'cached value is the T3 value');
  });

  await check('T5 mtime changes do not invalidate inside 10 minutes (DD-2)', async () => {
    const t = Date.now() / 1000 + 5;
    fs.utimesSync(shared.root, t, t);
    fs.utimesSync(path.join(shared.root, 's1'), t, t);
    const v = await cached(shared.root);
    eq(v, t3Value, 'cached value is the T3 value');
  });

  await check('T6 stale by age: a recompute and a rewrite', async () => {
    const rec0 = JSON.parse(fs.readFileSync(cacheFile(shared.root), 'utf8'));
    const now = rec0.computed_at_ms + 600001;
    const v = await cached(shared.root, { now });
    eq(v, syncVal(shared.root), 'value equals sync value');
    must(v > t3Value, 'value is greater than the T3 value');
    const rec1 = JSON.parse(fs.readFileSync(cacheFile(shared.root), 'utf8'));
    eq(rec1.tokens, v, 'cache tokens');
    eq(rec1.computed_at_ms, now, 'cache computed_at_ms');
  });

  await check('T7 a future computed_at_ms is rejected', async () => {
    fs.writeFileSync(cacheFile(shared.root), JSON.stringify({ version: 1, computed_at_ms: Date.now() + 60000, tokens: 1, file_count: 1 }) + '\n');
    const v = await cached(shared.root);
    eq(v, syncVal(shared.root), 'value equals sync value');
  });

  await check('T8 corrupt JSON gives the walked value and a repaired cache', async () => {
    fs.writeFileSync(cacheFile(shared.root), '{not json');
    const v = await cached(shared.root);
    eq(v, syncVal(shared.root), 'value equals sync value');
    JSON.parse(fs.readFileSync(cacheFile(shared.root), 'utf8'));
  });

  await check('T9 wrong shape gives the walked value', async () => {
    const shapes = [
      { version: 1, computed_at_ms: Date.now(), tokens: '12', file_count: 1 },
      { version: 2, computed_at_ms: Date.now(), tokens: 12, file_count: 1 },
      { version: 1, computed_at_ms: Date.now(), tokens: -5, file_count: 1 },
    ];
    for (const s of shapes) {
      fs.writeFileSync(cacheFile(shared.root), JSON.stringify(s) + '\n');
      const v = await cached(shared.root);
      eq(v, syncVal(shared.root), 'value equals sync value for ' + JSON.stringify(s));
    }
  });

  await check('T10 no .mindrian/: the walked value, and .mindrian/ is not created (DD-3)', async () => {
    const f = mkRoom('nomindrian', false);
    const v = await cached(f.root);
    eq(v, syncVal(f.root), 'value equals sync value');
    must(!fs.existsSync(path.join(f.root, '.mindrian')), '.mindrian/ was created');
  });

  await check('T11 the cache path is a directory: no throw, no tmp file', async () => {
    const f = mkRoom('cachedir', true);
    fs.mkdirSync(cacheFile(f.root));
    const v = await cached(f.root);
    eq(v, syncVal(f.root), 'value equals sync value');
    eq(tmpLeft(f.root).length, 0, 'no tmp file left');
  });

  await check('T12 read-only .mindrian/: no throw, no cache file, no tmp file', async () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) return { skip: 'root ignores directory modes' };
    const f = mkRoom('readonly', true);
    const dir = path.join(f.root, '.mindrian');
    fs.chmodSync(dir, 0o555);
    try {
      const v = await cached(f.root);
      eq(v, syncVal(f.root), 'value equals sync value');
      eq(fs.readdirSync(dir).length, 0, '.mindrian/ is still empty');
    } finally {
      fs.chmodSync(dir, 0o755);
    }
  });

  await check('T13 invalid input: null from both functions, never a rejection', async () => {
    const file = path.join(mkTmp('invalid'), 'plain.txt');
    fs.writeFileSync(file, 'text');
    const inputs = [null, '', path.join(os.tmpdir(), 's9x-does-not-exist-' + process.pid), file];
    for (const input of inputs) {
      eq(await cached(input), null, 'cached(' + JSON.stringify(input) + ')');
      eq(await walkAsync(input), null, 'walk(' + JSON.stringify(input) + ')');
    }
  });

  await check('T14 hook end to end: a miss, then a hit that ignores a new file', () => {
    const fx = mkHookFixture('t14');
    const sync = syncVal(fx.root);
    const r1 = runHook(countedPayload(), fx);
    eq(r1.status, 0, 'run 1 exit code');
    const l1 = jsonlLines(fx.home);
    eq(l1.length, 1, 'run 1 JSONL lines');
    const e1 = JSON.parse(l1[0]);
    eq(JSON.stringify(Object.keys(e1).sort()), JSON.stringify(est.EVENT_REQUIRED_FIELDS.slice().sort()), 'event keys');
    eq(e1.tokens_naive_estimate, sync, 'run 1 tokens_naive_estimate equals the sync value');
    must(fs.existsSync(cacheFile(fx.root)), 'cache file exists after run 1');
    put(fx.root, 's1/big.md', 100000);
    const r2 = runHook(countedPayload(), fx);
    eq(r2.status, 0, 'run 2 exit code');
    const l2 = jsonlLines(fx.home);
    eq(l2.length, 2, 'run 2 JSONL lines');
    eq(JSON.parse(l2[1]).tokens_naive_estimate, e1.tokens_naive_estimate, 'run 2 uses the cached value');
  });

  await check('T15 zero-token result exits before the room is touched (DD-1)', () => {
    const fx = mkHookFixture('t15');
    const payload = {
      tool_name: 'Read',
      tool_input: { file_path: path.join(fx.root, 'notes.md') },
      tool_response: { type: 'text', file: { filePath: path.join(fx.root, 'notes.md'), content: 'x' } },
    };
    const r = runHook(payload, fx);
    eq(r.status, 0, 'exit code');
    eq(r.stdout, '', 'stdout');
    eq(jsonlLines(fx.home).length, 0, 'JSONL lines');
    must(!fs.existsSync(cacheFile(fx.root)), 'cache file exists');
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    const start = src.indexOf('function main(');
    must(start >= 0, 'function main( not found');
    const tail = src.slice(start);
    const iZero = tail.indexOf('tokensUsed <= 0');
    const iResolve = tail.indexOf('resolveRoomRoot()');
    const iEstimate = tail.indexOf('estimateRoomTokensCached(');
    must(iZero >= 0, 'tokensUsed <= 0 not found in main');
    must(iResolve >= 0 && iZero < iResolve, 'the zero-token exit must come before resolveRoomRoot()');
    must(iEstimate >= 0 && iZero < iEstimate, 'the zero-token exit must come before estimateRoomTokensCached(');
  });

  await check('T16 hook with a corrupt cache still writes the right event', () => {
    const fx = mkHookFixture('t16');
    const sync = syncVal(fx.root);
    fs.writeFileSync(cacheFile(fx.root), '{oops');
    const r = runHook(countedPayload(), fx);
    eq(r.status, 0, 'exit code');
    const lines = jsonlLines(fx.home);
    eq(lines.length, 1, 'JSONL lines');
    eq(JSON.parse(lines[0]).tokens_naive_estimate, sync, 'tokens_naive_estimate equals the sync value');
  });

  await check('T17 the room-changed checks ignore the cache file', () => {
    const stop = fs.readFileSync(path.join(REPO, 'scripts', 'on-stop-state'), 'utf8');
    const start = fs.readFileSync(path.join(REPO, 'scripts', 'session-start-state'), 'utf8');
    const changed = fs.readFileSync(path.join(REPO, 'scripts', 'on-file-changed'), 'utf8');
    const prune = "-mindepth 1 -name '.*' -prune";
    must(stop.includes(prune), 'on-stop-state has no hidden-entry prune');
    must(start.includes(prune), 'session-start-state has no hidden-entry prune');
    must(changed.includes('*/.*) exit 0'), 'on-file-changed has no hidden-path exit');
    const root = mkTmp('t17');
    fs.mkdirSync(path.join(root, '.mindrian'));
    fs.writeFileSync(path.join(root, 'STATE.md'), '# State\n');
    const old = Date.now() / 1000 - 60;
    fs.utimesSync(path.join(root, 'STATE.md'), old, old);
    fs.writeFileSync(cacheFile(root), '{"version":1}\n');
    const args = ['-H', root, '-mindepth', '1', '-name', '.*', '-prune', '-o', '-type', 'f', '-newer', root + '/STATE.md', '-print'];
    eq(spawnSync('find', args, { encoding: 'utf8' }).stdout, '', 'find output with only the cache file');
    fs.writeFileSync(path.join(root, 'x.md'), 'x');
    must(spawnSync('find', args, { encoding: 'utf8' }).stdout.includes('x.md'), 'control file x.md is not printed');
  });

  await check('T18 Part 8: no network surface in the estimator', () => {
    const src = fs.readFileSync(ESTIMATOR_PATH, 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    ['http', 'child_process', 'onrender', 'theo-mcp', 'fetch('].forEach((s) => must(!code.includes(s), 'estimator code contains ' + s));
    const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(code)) !== null) must(m[1] === 'node:fs' || m[1] === 'node:path', 'unexpected require: ' + m[1]);
  });
}

main().then(() => {
  for (const d of cleanup) {
    try { fs.chmodSync(path.join(d, '.mindrian'), 0o755); } catch (_e) { /* not present */ }
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failed === 0) {
    console.log('token-estimate-cache: ALL PASS');
    process.exit(0);
  }
  console.log('token-estimate-cache: ' + failed + ' FAILED');
  process.exit(1);
});
