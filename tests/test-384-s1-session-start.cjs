#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 Plan 14 (S1, PERF384-F03). scripts/session-start starts about 39 node processes through PATH on
 * the fixture room. The four reconcile blocks run in one process (scripts/session-start-reconcile.cjs) and
 * the three field parses of the archetype JSON run in one process.
 *
 * Two groups (first argument selects; no argument runs both):
 *   parity    P1 control arm: two runs of the old code (tree A) on two copies of one fixture room give the same
 *                 normalized stdout and the same written files. A run that still differs fails the test.
 *             P2 envelope parity: the stdout of the working tree (tree B) equals the normalized stdout of tree A,
 *                 parsed as one JSON envelope and compared as raw normalized bytes.
 *             P3 written-file parity: the files that the script created or changed under the room and the sandbox
 *                 (sha256 after the same normalization; room.db by row counts) are equal for tree A and tree B.
 *             Passes on the code before the change and after it.
 *   mechanism M1 node starts of one run, counted with a PATH shim, are at most BASELINE_NODE_STARTS minus
 *                 REMOVED_NODE_STARTS in three repeats.
 *             M2 exactly one start runs session-start-reconcile.cjs and no start holds code of the four old
 *                 inline blocks.
 *             M3 runAll runs all blocks in order after a failing first block, the default order is the old order,
 *                 and the child script exits 0.
 *
 * Tree A is a git archive of A_SHA (the code before the change), made here. Set SPEED384_TREE_A to use an export
 * that already exists. Tree B is the repository root, or SPEED384_TREE_B.
 *
 * NORMALIZATION (the only values hidden from the comparison; each is volatile by nature):
 *   sandbox-root   the temp folder of the run (random name)                        -> <SBX>
 *   tree-root      the plugin root of the tree under test (tree A and tree B differ) -> <TREE>
 *                  and the checkout of the test runner, which the sandbox settings seed names  -> <TREE>
 *   iso-time       ISO 8601 date and time stamps                                    -> <TS>
 *   epoch-ms       13 digit epoch millisecond values                                -> <EPOCH_MS>
 *   epoch-s        10 digit epoch second values                                     -> <EPOCH_S>
 *   uuid           random v4 identifiers (room_id of each room build)                   -> <UUID>
 *   install-id     random 128 bit install id minted at first run                        -> <INSTALL_ID>
 *   digest-of-random-input  room_hash and fingerprint digests over the random room id and sandbox path -> <DIGEST>
 *   (more rules are added only for a value that is volatile by nature, with a reason, below)
 *
 * Part 8: fixture room only, in a temp folder; HOME and the Mindrian homes point into the temp folder; the Brain
 * URL is an unreachable loopback address; secrets are scrubbed from the environment. No em-dashes. CJS only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-384-s1-session-start.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO = path.join(__dirname, '..');
const A_SHA = '6d3d165f0f856dcb9906a5950fc5267572abb5c1';

// Node starts of one run of scripts/session-start through PATH on the fixture room, code before the change.
// Counted with the PATH shim of this file in three repeats: 39, 39, 39.
const BASELINE_NODE_STARTS = 39;
// The sites table (measurements/fix-s1-sites.md) promises: 4 reconcile starts become 1 (3 removed) and the
// 3 field parses of the archetype JSON become 1 (2 removed).
const REMOVED_NODE_STARTS = 5;

const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));

let failed = 0;
function check(name, cond, detail) {
  if (cond) process.stdout.write('ok   ' + name + '\n');
  else { failed += 1; process.stdout.write('FAIL ' + name + (detail ? ' - ' + detail : '') + '\n'); }
}

// ---------------------------------------------------------------------------
// trees
// ---------------------------------------------------------------------------
const cleanups = [];
function exportTreeA() {
  if (process.env.SPEED384_TREE_A) return path.resolve(process.env.SPEED384_TREE_A);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s1-tree-a-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  const arch = cp.spawnSync('git', ['archive', '--format=tar', A_SHA], { cwd: REPO, maxBuffer: 1024 * 1024 * 1024 });
  if (arch.status !== 0) throw new Error('git archive failed for the start commit');
  const x = cp.spawnSync('tar', ['-x', '-C', dir], { input: arch.stdout, maxBuffer: 1024 * 1024 * 1024 });
  if (x.status !== 0) throw new Error('tar extract failed');
  if (fs.existsSync(path.join(REPO, 'node_modules'))) fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(dir, 'node_modules'));
  return dir;
}
function treeB() { return path.resolve(process.env.SPEED384_TREE_B || REPO); }

// ---------------------------------------------------------------------------
// normalization
// ---------------------------------------------------------------------------
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalize(text, kit) {
  let s = String(text);
  const rules = [];
  const swap = (name, re, to) => { s = s.replace(re, (...m) => { rules.push(name); return to.replace(/\$(\d)/g, (_x, d) => m[Number(d)]); }); };
  swap('sandbox-root', new RegExp(escRe(kit.prep.sandbox.root), 'g'), '<SBX>');
  swap('tree-root', new RegExp(escRe(kit.tree), 'g'), '<TREE>');
  // The sandbox settings seed (scripts/measure-hook-cold-start.cjs makeSandbox) names the checkout of the test runner,
  // not the tree under test. Both name the plugin root of a run, so both map to the same token.
  swap('tree-root', new RegExp(escRe(REPO), 'g'), '<TREE>');
  swap('iso-time', /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<TS>');
  swap('epoch-ms', /\b1[67]\d{11}\b/g, '<EPOCH_MS>');
  swap('epoch-s', /\b1[67]\d{8}\b/g, '<EPOCH_S>');
  for (const extra of EXTRA_RULES) swap(extra.name, extra.re, extra.to);
  return { text: s, rules };
}
// Extra rules: only for values that are volatile by nature. Each has a reason.
const EXTRA_RULES = [
  // random v4 identifier minted per room build and per install (room_id values)
  { name: 'uuid', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, to: '<UUID>' },
  // random 128 bit install id minted at first run (theo-install-id.json)
  { name: 'install-id', re: /("id"\s*:\s*")[0-9a-f]{32}(")/g, to: '$1<INSTALL_ID>$2' },
  // digests over the random room id and the random sandbox path (room_hash, fingerprint)
  { name: 'digest-of-random-input', re: /((?:room_hash|fingerprint)["']?\s*[:=]\s*["']?)[0-9a-f]{16,64}/g, to: '$1<DIGEST>' },
];

// ---------------------------------------------------------------------------
// one run of scripts/session-start on a fresh fixture room
// ---------------------------------------------------------------------------
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function walk(root) {
  const out = [];
  (function rec(dir) {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.isFile()) out.push(p);
    }
  })(root);
  return out;
}

function dbSignature(file) {
  try {
    const sqlite = require('node:sqlite');
    const db = new sqlite.DatabaseSync(file, { readOnly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
    const sig = {};
    for (const t of tables) {
      try { sig[t] = db.prepare('SELECT COUNT(*) AS c FROM "' + t.replace(/"/g, '""') + '"').get().c; } catch (_e) { sig[t] = 'x'; }
    }
    db.close();
    return JSON.stringify(sig);
  } catch (_e) { return 'unreadable'; }
}

// manifest: relative path -> content hash after normalization (room.db by row counts, sqlite side files ignored)
function manifest(kit, dumpTo) {
  const root = kit.prep.sandbox.root;
  const m = new Map();
  for (const f of walk(root)) {
    const rel = path.relative(root, f);
    if (/\.db-(wal|shm|journal)$/.test(rel)) continue;
    if (rel.startsWith('shim' + path.sep)) continue;
    let st;
    try { st = fs.statSync(f); } catch (_e) { continue; }
    if (/\.db$/.test(rel)) { m.set(rel, 'db:' + dbSignature(f)); continue; }
    let buf;
    try { buf = fs.readFileSync(f); } catch (_e) { continue; }
    const head = buf.subarray(0, 8192);
    const isText = head.indexOf(0) < 0;
    const relNorm = normalize(rel, kit).text;
    if (dumpTo && isText) {
      const d = path.join(dumpTo, relNorm);
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.writeFileSync(d, normalize(buf.toString('utf8'), kit).text);
    }
    m.set(relNorm, isText ? 'txt:' + sha(Buffer.from(normalize(buf.toString('utf8'), kit).text)) : 'bin:' + sha(buf) + ':' + st.size);
  }
  return m;
}

function changedSet(before, after) {
  const out = [];
  for (const [k, v] of after) if (!before.has(k) || before.get(k) !== v) out.push(k + ' ' + v);
  for (const k of before.keys()) if (!after.has(k)) out.push(k + ' deleted');
  return out.sort();
}

function markerAlive(marker) {
  let pids = [];
  try { pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)); } catch (_e) { return false; }
  for (const pid of pids) {
    if (Number(pid) === process.pid) continue;
    try {
      const env = fs.readFileSync('/proc/' + pid + '/environ', 'latin1');
      if (env.indexOf(marker) >= 0) return true;
    } catch (_e) { /* gone or not readable */ }
  }
  return false;
}
async function settle(marker, limitMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs) {
    if (!markerAlive(marker)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

let runSeq = 0;
// Runs the script of `tree` on a fresh copy of the fixture room (built from tree B so that every copy is equal).
// opts.shim: true puts a node shim first on PATH and returns the start records.
async function runOnce(tree, opts) {
  const o = opts || {};
  const prep = H.prepareRoom('fixture', { trees: [treeB()], baseSha: 'unknown' });
  const kit = { prep, tree, ctx: null };
  try {
    const ctx = H.makeCtx('S1', tree, prep, 4, false);
    kit.ctx = ctx;
    const def = H.targetDef('event:SessionStart:changed');
    await new Promise((r) => setTimeout(r, 1100));
    if (ctx.touchTarget) { const now = new Date(); fs.utimesSync(ctx.touchTarget, now, now); }
    const before = manifest(kit);
    const payload = JSON.stringify(H.buildEventPayload(def, ctx));
    const marker = 'MOS_S1_RUN=' + process.pid + '-' + (runSeq += 1);
    const extra = { MOS_S1_RUN: marker.split('=')[1] };
    let shimLog = null;
    let shimDir = null;
    const env = ctx.env(extra);
    if (o.shim) {
      shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s1-shim-'));
      cleanups.push(() => fs.rmSync(shimDir, { recursive: true, force: true }));
      shimLog = path.join(shimDir, 'starts.log');
      fs.writeFileSync(shimLog, '');
      const bin = path.join(shimDir, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nprintf \'\\036%s\\n\' "$*" >> "$MOS_S1_SHIM_LOG"\nexec "$MOS_S1_SHIM_REAL" "$@"\n', { mode: 0o755 });
      env.PATH = bin + path.delimiter + env.PATH;
      env.MOS_S1_SHIM_LOG = shimLog;
      env.MOS_S1_SHIM_REAL = process.execPath;
    }
    const res = await new Promise((resolve) => {
      const child = cp.spawn('bash', [path.join(tree, 'scripts', 'session-start')], { cwd: prep.roomDir, env, stdio: ['pipe', 'pipe', 'ignore'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stdin.on('error', () => {});
      child.stdin.end(payload);
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 300000);
      child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout: out }); });
    });
    const settled = await settle(extra.MOS_S1_RUN, 120000);
    const dumpRoot = process.env.SPEED384_DUMP ? path.join(process.env.SPEED384_DUMP, String(runSeq)) : null;
    const after = manifest(kit, dumpRoot);
    let starts = null;
    if (shimLog) starts = fs.readFileSync(shimLog, 'utf8').split('\u001e').filter((r) => r.length > 0);
    return {
      kit, code: res.code, stdout: res.stdout, settled,
      norm: normalize(res.stdout, kit),
      changed: changedSet(before, after),
      starts,
    };
  } finally {
    try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ }
  }
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return 'first difference at byte ' + i + ': <' + a.slice(Math.max(0, i - 30), i + 50).replace(/\n/g, '\\n') + '> vs <' + b.slice(Math.max(0, i - 30), i + 50).replace(/\n/g, '\\n') + '>';
}
function listDiff(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const onlyA = a.filter((x) => !sb.has(x));
  const onlyB = b.filter((x) => !sa.has(x));
  return 'only in first: ' + JSON.stringify(onlyA.slice(0, 5)) + ' only in second: ' + JSON.stringify(onlyB.slice(0, 5));
}

// ---------------------------------------------------------------------------
// groups
// ---------------------------------------------------------------------------
async function parity() {
  const A = exportTreeA();
  const a1 = await runOnce(A);
  const a2 = await runOnce(A);
  const b = await runOnce(treeB());
  const rulesUsed = Array.from(new Set(a1.norm.rules.concat(a2.norm.rules, b.norm.rules))).sort();
  process.stdout.write('normalization rules applied: ' + rulesUsed.join(', ') + '\n');
  check('P1 control arm: both runs of tree A exit 0 and settle', a1.code === 0 && a2.code === 0 && a1.settled && a2.settled, 'codes ' + a1.code + ' ' + a2.code + ' settled ' + a1.settled + ' ' + a2.settled);
  check('P1 control arm: normalized stdout of two runs of tree A is equal', a1.norm.text === a2.norm.text, firstDiff(a1.norm.text, a2.norm.text));
  check('P1 control arm: written files of two runs of tree A are equal', JSON.stringify(a1.changed) === JSON.stringify(a2.changed), listDiff(a1.changed, a2.changed));
  check('P1 control arm: stdout is not empty', a1.norm.text.length > 100, 'length ' + a1.norm.text.length);
  let env = null;
  try { env = JSON.parse(b.stdout); } catch (_e) { env = null; }
  let envA = null;
  try { envA = JSON.parse(a1.stdout); } catch (_e) { envA = null; }
  check('P2 envelope: stdout of tree B is one JSON envelope', env && typeof env === 'object' && envA && typeof envA === 'object');
  check('P2 envelope: exit code and settle equal', b.code === a1.code && b.settled, 'codes ' + b.code + ' ' + a1.code);
  check('P2 envelope: parsed envelope equals tree A after normalization', env && envA && normalize(JSON.stringify(env), b.kit).text === normalize(JSON.stringify(envA), a1.kit).text);
  check('P2 envelope: raw normalized bytes equal tree A', b.norm.text === a1.norm.text, firstDiff(b.norm.text, a1.norm.text));
  check('P3 written files: tree B equals tree A', JSON.stringify(b.changed) === JSON.stringify(a1.changed), listDiff(b.changed, a1.changed));
}

const REC = path.join(REPO, 'scripts', 'session-start-reconcile.cjs');

async function mechanism() {
  const T = treeB();
  const counts = [];
  let last = null;
  for (let i = 0; i < 3; i += 1) {
    const r = await runOnce(T, { shim: true });
    counts.push(r.starts.length);
    last = r;
  }
  const limit = BASELINE_NODE_STARTS - REMOVED_NODE_STARTS;
  check('M1 node starts at most ' + limit + ' in three repeats', counts.every((n) => n <= limit), 'counts ' + counts.join(','));
  const recRecords = last.starts.filter((r) => r.indexOf('session-start-reconcile.cjs') >= 0);
  check('M2 exactly one start runs session-start-reconcile.cjs', recRecords.length === 1, 'found ' + recRecords.length);
  // the strings of the plan, plus the identifiers that the inline code of blocks 3 and 4 really holds
  const oldNeedles = ['refreshAll(', 'dial-memory-runner', 'planning-artifact', 'memory-artifact', 'timeline-runner', 'reconcilePlanningArtifacts', 'reconcileMemoryArtifacts'];
  const oldHits = last.starts.filter((r) => oldNeedles.some((n) => r.indexOf(n) >= 0));
  check('M2 no start holds code of the four old inline blocks', oldHits.length === 0, 'found ' + oldHits.length);

  // M3
  const recPath = path.join(T, 'scripts', 'session-start-reconcile.cjs');
  let mod = null;
  try { mod = require(recPath); } catch (_e) { mod = null; }
  if (!mod || typeof mod.runAll !== 'function') {
    check('M3 runAll exists in scripts/session-start-reconcile.cjs', false, 'module missing');
    check('M3 failure isolation and order', false, 'module missing');
    check('M3 default order is timeline, dial memory, gsd planning, memory cortex', false, 'module missing');
    check('M3 child script exits 0 and runs all four blocks after failures', false, 'module missing');
    return;
  }
  const seen = [];
  const stub = (n, boom) => { const f = function () { seen.push(n); if (boom) throw new Error('stub failure'); }; Object.defineProperty(f, 'name', { value: n }); return f; };
  let threw = false;
  let res = null;
  const origErr = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  try { res = mod.runAll({}, [stub('s1', true), stub('s2'), stub('s3'), stub('s4')]); } catch (_e) { threw = true; } finally { process.stderr.write = origErr; }
  check('M3 runAll does not throw when the first block throws', !threw);
  check('M3 the other three blocks still run, in order', JSON.stringify(seen) === JSON.stringify(['s1', 's2', 's3', 's4']), JSON.stringify(seen));
  check('M3 runAll returns one result per block', Array.isArray(res) && res.length === 4 && res[0].ok === false && res[1].ok === true && res[3].ok === true);
  const names = (mod.DEFAULT_BLOCKS || []).map((f) => f.name);
  check('M3 default order is timeline, dial memory, gsd planning, memory cortex', JSON.stringify(names) === JSON.stringify(['refreshTimeline', 'refreshDialMemory', 'reconcileGsdPlanning', 'reconcileMemoryCortex']), JSON.stringify(names));
  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s1-room-'));
  cleanups.push(() => fs.rmSync(tmpRoom, { recursive: true, force: true }));
  const bogus = path.join(tmpRoom, 'no-such-plugin');
  fs.mkdirSync(path.join(tmpRoom, '.mindrian'), { recursive: true });
  const child = cp.spawnSync(process.execPath, [recPath], {
    cwd: tmpRoom, encoding: 'utf8', timeout: 60000,
    env: Object.assign({}, process.env, { ACTIVE_ROOM_FOR_RECONCILE: tmpRoom, PLUGIN_ROOT_FOR_NODE_RECONCILE: bogus, PLUGIN_ROOT_RECONCILE: bogus, HOME: tmpRoom }),
  });
  const errText = String(child.stderr || '');
  const allFour = ['feynman-timeline-refresh failed', 'dial-memory-refresh failed', 'gsd-planning-reconcile failed', 'memory-cortex-reconcile failed'].every((s) => errText.indexOf(s) >= 0);
  check('M3 child script exits 0 when every block fails', child.status === 0, 'status ' + child.status);
  check('M3 each of the four blocks ran and reported its own failure', allFour, 'stderr ' + errText.replace(/\n/g, ' | ').slice(0, 300));
}

(async () => {
  const group = process.argv[2];
  if (group && group !== 'parity' && group !== 'mechanism') { process.stderr.write('usage: test-384-s1-session-start.cjs [parity|mechanism]\n'); process.exit(2); }
  try {
    if (!group || group === 'parity') await parity();
    if (!group || group === 'mechanism') await mechanism();
  } catch (e) {
    failed += 1;
    process.stdout.write('FAIL unexpected error - ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') + '\n');
  } finally {
    for (const c of cleanups) { try { c(); } catch (_e) { /* best effort */ } }
  }
  process.stdout.write(failed === 0 ? 's1-session-start: ALL PASS\n' : 's1-session-start: ' + failed + ' FAILED\n');
  process.exit(failed === 0 ? 0 : 1);
})();
