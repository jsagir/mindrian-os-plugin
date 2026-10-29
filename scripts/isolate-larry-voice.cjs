#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 02 (Codex C1 and rounds 2 and 3): the isolation contract for every child
 * process the Larry voice eval starts (the room birth, the hook captures, the SessionStart chain,
 * `claude --print`). The contract is PREVENTIVE: the child environment is built from a declared
 * table before the child starts, never copied from the parent, and nothing in this module reads,
 * lists, stats or snapshots a path under the owner's rooms (CONTEXT domain rule, D-31).
 *
 * Two root sets with two rules that cannot contradict each other:
 *   rule 1  every name in SCRATCH_ROOTS resolves under the fresh scratch root;
 *   rule 2  the plugin names equal exactly one member of APPROVED_PLUGIN_ROOTS (this repo's
 *           root, read only), and every other value that is equal to or under the parent's
 *           home is refused. makeScratch refuses a scratch root under the parent's home, so no
 *           scratch value can fall under rule 2.
 * PATH is built (never inherited). Any name that is not in the table is refused.
 *
 * Node built-ins only. Canon Part 8: no Brain call, no network, no room content here.
 * The single read outside the scratch root and the repo root is resolveClaudeCli: it looks for
 * the claude executable on the parent PATH once, by file name, and records its realpath. It
 * refuses any candidate path that names the owner's rooms.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const APPROVED_PLUGIN_ROOTS = Object.freeze([REPO_ROOT]);
const DEFAULT_SEED = path.join(REPO_ROOT, 'tests', 'fixtures', 'release-room');
const OFFLINE_SESSION_ID = 'larry-voice-eval-session';
const SYSTEM_PATH_DIRS = Object.freeze(['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin']);

function fail(reason, detail) {
  const e = new Error(reason + (detail ? ': ' + detail : ''));
  e.reason = reason;
  e.detail = detail || null;
  return e;
}

// ---------------------------------------------------------------------------------------------
// The declared table. kind: scratch | plugin | built | credential | switch | pass.
// For scratch kind, `sub` is the path under the scratch root (home, rooms, tmp ... see makeScratch).
// ---------------------------------------------------------------------------------------------
const T = [
  { name: 'HOME', kind: 'scratch', sub: 'home', reason: 'every Node and shell home lookup lands in the scratch home' },
  { name: 'USERPROFILE', kind: 'scratch', sub: 'home', reason: 'the Windows spelling of HOME, same scratch home' },
  { name: 'MINDRIAN_HOME', kind: 'scratch', sub: 'home/.mindrian', reason: 'plugin state folder' },
  { name: 'MINDRIAN_ROOMS_HOME', kind: 'scratch', sub: 'rooms', reason: 'rooms home read by session-start, the hooks and the birth' },
  { name: 'MINDRIAN_ROOMS_ROOT', kind: 'scratch', sub: 'rooms', reason: 'rooms root read by session-start and the classifier' },
  { name: 'CLAUDE_CONFIG_DIR', kind: 'scratch', sub: 'home/.claude', reason: 'session-start and claude write settings here' },
  { name: 'XDG_CONFIG_HOME', kind: 'scratch', sub: 'home/.config', reason: 'XDG root under the scratch home' },
  { name: 'XDG_DATA_HOME', kind: 'scratch', sub: 'home/.local/share', reason: 'XDG root under the scratch home' },
  { name: 'XDG_CACHE_HOME', kind: 'scratch', sub: 'home/.cache', reason: 'XDG root under the scratch home' },
  { name: 'XDG_STATE_HOME', kind: 'scratch', sub: 'home/.local/state', reason: 'XDG root under the scratch home' },
  { name: 'CLAUDE_PLUGIN_DATA', kind: 'scratch', sub: 'plugin-data', reason: 'host plugin data folder' },
  { name: 'MINDRIAN_REAL_ROOM_RECEIPT_DIR', kind: 'scratch', sub: 'receipts', reason: 'release receipts never reach ~/.mindrian' },
  { name: 'TMPDIR', kind: 'scratch', sub: 'tmp', reason: 'os.tmpdir() and mktemp' },
  { name: 'TMP', kind: 'scratch', sub: 'tmp', reason: 'temp folder, Windows spelling' },
  { name: 'TEMP', kind: 'scratch', sub: 'tmp', reason: 'temp folder, Windows spelling' },
  { name: 'CLAUDE_PLUGIN_ROOT', kind: 'plugin', reason: 'the plugin under test, this repo, read only' },
  { name: 'MINDRIAN_OS_ROOT', kind: 'plugin', reason: 'the plugin under test, this repo, read only' },
  { name: 'PATH', kind: 'built', reason: 'built from scratch/bin plus system directories outside the parent home; never inherited' },
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', kind: 'credential', reason: 'long-lived token from `claude setup-token`, passed by name only (D-26 consult)' },
  { name: 'ANTHROPIC_API_KEY', kind: 'credential', reason: 'API key alternative, passed by name only (D-26 consult)' },
  { name: 'MINDRIAN_NPM_RECONCILE_SKIP', kind: 'switch', value: '1', defaultOn: true, reason: 'quick 261029-nhu: the SessionStart npm reconcile ends before any fs or spawn' },
  { name: 'DISABLE_AUTOUPDATER', kind: 'switch', value: '1', defaultOn: true, reason: 'the Claude Code auto-update switch (D-26 consult); an update would write to the install' },
  { name: 'MINDRIAN_SESSION_ID', kind: 'switch', value: OFFLINE_SESSION_ID, defaultOn: true, reason: 'matches the pre-seeded clock seam so the reference-now hook makes no network call' },
  { name: 'MINDRIAN_DERIVE_SKIP', kind: 'switch', value: '1', defaultOn: false, reason: 'gsd-graph-derive-drain ends before its detached worker starts' },
  { name: 'MOS_SESSION_VERIFY_NO_PROBE', kind: 'switch', value: '1', defaultOn: false, reason: 'post-update preflight does not fire the detached Theo probe' },
  { name: 'MINDRIAN_DOGFOOD_DRAIN_SKIP', kind: 'switch', value: '1', defaultOn: false, reason: 'session-start skips the dogfood drain' },
  { name: 'SCOUT_CADENCE_SKIP', kind: 'switch', value: '1', defaultOn: false, reason: 'session-start skips the scout cadence slot' },
  { name: 'BRAIN_STALENESS_SKIP', kind: 'switch', value: '1', defaultOn: false, reason: 'session-start skips the Brain staleness annotation' },
  { name: 'MINDRIAN_SKIP_LIVE_CLAUDE', kind: 'switch', value: '1', defaultOn: false, reason: 'scripts that would start a live claude stay offline' },
  { name: 'MOS_NO_DETACHED_DERIVE', kind: 'switch', value: '1', defaultOn: false, reason: 'derive drain runs in process instead of detached' },
  { name: 'CLAUDE_CODE_SESSION_ID', kind: 'absent', reason: 'session-start reads it; absent, so it derives its own session id' },
  { name: 'CLAUDE_SESSION_ID', kind: 'absent', reason: 'the classifier and the clock seed read it; absent, so they use their own defaults' },
  { name: 'CLAUDE_SETTINGS', kind: 'absent', reason: 'session-start reads it; absent, so the settings path falls back under CLAUDE_CONFIG_DIR' },
  { name: 'MINDRIAN_ACTIVE_ROOM_DIR', kind: 'absent', reason: 'a room pointer from the parent session; the birth sets the room by cwd instead' },
  { name: 'MINDRIAN_ACTIVE_SESSION_ID', kind: 'absent', reason: 'a session pointer from the parent session; must not leak in' },
  { name: 'MINDRIAN_CONTEXT_TIER', kind: 'absent', reason: 'session-start tier override; absent, so the default tier holds' },
  { name: 'MINDRIAN_COPILOT_INJECT_FINDINGS', kind: 'absent', reason: 'classifier option; absent, so the default holds' },
  { name: 'MINDRIAN_NAV_NO_SUPPRESS', kind: 'absent', reason: 'classifier option; absent, so the default holds' },
  { name: 'MINDRIAN_OPERATOR', kind: 'absent', reason: 'auto-explore operator mode; absent, so the default holds' },
  { name: 'MINDRIAN_ROOM_DIR', kind: 'absent', reason: 'a room pointer from the parent session; must not leak in' },
  { name: 'MINDRIAN_ROOM_SLUG', kind: 'absent', reason: 'a room pointer from the parent session; must not leak in' },
  { name: 'MINDRIAN_SESSION_CONTEXT_FALLBACK', kind: 'absent', reason: 'session-start fallback; absent, so the default holds' },
  { name: 'MINDRIAN_STATUSLINE_FALLBACK_ECHO', kind: 'absent', reason: 'statusline option; absent, so the default holds' },
  { name: 'MINDRIAN_TIER', kind: 'absent', reason: 'auto-explore tier; absent, so the default holds' },
  { name: 'MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS', kind: 'absent', reason: 'classifier option; absent, so the default holds' },
  { name: 'MINDRIAN_MCP_FIRST', kind: 'absent', reason: 'absent keeps the coordinator on its legacy path; set, it would wake a durable localhost daemon' },
  { name: 'MINDRIAN_BRAIN_URL', kind: 'absent', reason: 'absent, so the Brain client keeps its default; the eval sends no room content to it' },
  { name: 'MINDRIAN_DEBUG', kind: 'absent', reason: 'debug logging off' },
  { name: 'MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS', kind: 'absent', reason: 'absent, so the default timeout holds' },
  { name: 'LANG', kind: 'pass', reason: 'locale' },
  { name: 'LC_ALL', kind: 'pass', reason: 'locale' },
  { name: 'TERM', kind: 'pass', reason: 'terminal type' },
];
const ISOLATION_TABLE = Object.freeze(T.map(function (e) { return Object.freeze(e); }));
const TABLE_BY_NAME = Object.freeze(ISOLATION_TABLE.reduce(function (acc, e) { acc[e.name] = e; return acc; }, {}));
const SCRATCH_ROOTS = Object.freeze(ISOLATION_TABLE.filter(function (e) { return e.kind === 'scratch'; }).map(function (e) { return e.name; }));
const PLUGIN_NAMES = Object.freeze(ISOLATION_TABLE.filter(function (e) { return e.kind === 'plugin'; }).map(function (e) { return e.name; }));
const CREDENTIAL_NAMES = Object.freeze(ISOLATION_TABLE.filter(function (e) { return e.kind === 'credential'; }).map(function (e) { return e.name; }));
const SWITCH_NAMES = Object.freeze(ISOLATION_TABLE.filter(function (e) { return e.kind === 'switch'; }).map(function (e) { return e.name; }));

// ---------------------------------------------------------------------------------------------
// path helpers (text only, never stat for a path outside the scratch root and the repo root)
// ---------------------------------------------------------------------------------------------
function within(root, p) {
  if (typeof p !== 'string' || !p || p.indexOf('\0') !== -1 || !path.isAbsolute(p)) return false;
  const rel = path.relative(root, path.resolve(p));
  return rel === '' || (rel.indexOf('..') !== 0 && !path.isAbsolute(rel));
}

function parentHomeOf(opts) {
  const h = opts && typeof opts.parentHome === 'string' && opts.parentHome ? opts.parentHome : os.homedir();
  return path.resolve(h);
}

// true when the text names the home itself or a path under it
function underHome(text, home) {
  if (!home || home === path.sep) return false;
  const v = String(text);
  return v === home || v.indexOf(home + path.sep) !== -1 || v.indexOf(home + '/') !== -1;
}

function listEntries(p) {
  return String(p || '').split(path.delimiter).filter(function (x) { return x.length > 0; });
}

// ---------------------------------------------------------------------------------------------
// the scratch root
// ---------------------------------------------------------------------------------------------
function resolveClaudeCli(parentPath) {
  const dirs = listEntries(parentPath);
  for (let i = 0; i < dirs.length; i += 1) {
    const cand = path.join(dirs[i], 'claude');
    if (/MindrianRooms/.test(cand)) continue;
    try {
      const st = fs.statSync(cand);
      if (st.isFile()) return fs.realpathSync(cand);
    } catch (_e) { /* next directory */ }
  }
  return null;
}

function writeOfflineClockSeam(home) {
  // The reference-now hook only skips its single network GET when the seam already holds this
  // session id and a numeric offset (lib/core/temporal/reference-now.cjs, fetchTimeOffsetOnce).
  const dir = path.join(home, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'reference-now.json'), JSON.stringify({
    floorMs: Date.now(), offsetMs: 0, source: 'date_now', lastFetchSession: OFFLINE_SESSION_ID,
  }));
}

/*
 * makeScratch(prefix, opts) -> frozen scratch descriptor under a fresh mkdtemp root.
 * opts.parentHome: override the parent home (tests); opts.claudeCli: a path, null for none,
 * undefined to resolve from the parent PATH; opts.parentPath: PATH to resolve from.
 */
function makeScratch(prefix, opts) {
  const o = opts || {};
  const pre = typeof prefix === 'string' && prefix ? prefix : 'larry-voice-scratch-';
  if (/[\\/]/.test(pre)) throw fail('scratch_prefix_invalid');
  const base = fs.realpathSync(os.tmpdir());
  const home = parentHomeOf(o);
  if (within(home, base)) throw fail('scratch_under_parent_home', 'the temp base is under the parent home');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(base, pre)));
  if (within(home, root)) throw fail('scratch_under_parent_home', 'the scratch root is under the parent home');
  const dirs = {
    root: root,
    prefix: pre,
    home: path.join(root, 'home'),
    rooms: path.join(root, 'rooms'),
    tmp: path.join(root, 'tmp'),
    bin: path.join(root, 'bin'),
    pluginData: path.join(root, 'plugin-data'),
    receipts: path.join(root, 'receipts'),
  };
  ['home', 'rooms', 'tmp', 'bin', 'pluginData', 'receipts'].forEach(function (k) { fs.mkdirSync(dirs[k], { recursive: true, mode: 0o700 }); });
  const nodeReal = fs.realpathSync(process.execPath);
  fs.symlinkSync(nodeReal, path.join(dirs.bin, 'node'));
  const claudeReal = o.claudeCli === undefined ? resolveClaudeCli(process.env.PATH) : o.claudeCli;
  if (claudeReal) fs.symlinkSync(claudeReal, path.join(dirs.bin, 'claude'));
  writeOfflineClockSeam(dirs.home);
  return Object.freeze(Object.assign(dirs, { node: nodeReal, claude: claudeReal || null }));
}

// ---------------------------------------------------------------------------------------------
// the child environment
// ---------------------------------------------------------------------------------------------
function scratchValue(entry, scratch) {
  return path.join(scratch.root, entry.sub);
}

function buildPath(scratch, parentEnv, home, extraDirs) {
  const parts = [];
  (extraDirs || []).forEach(function (d) {
    if (!within(scratch.root, d)) throw fail('isolation_breach:PATH', 'an extra PATH directory is outside the scratch root');
    parts.push(path.resolve(d));
  });
  parts.push(scratch.bin);
  const parentEntries = listEntries(parentEnv.PATH);
  SYSTEM_PATH_DIRS.forEach(function (d) {
    if (parentEntries.indexOf(d) !== -1 && !underHome(d, home)) parts.push(d);
  });
  return parts.join(path.delimiter);
}

/*
 * isolatedEnv(scratch, opts) -> a NEW object built from the table; never a copy of process.env.
 * opts: repoRoot (must be an approved plugin root), withCredential, switches (names of
 * non-default switches to turn on), parentEnv (default process.env, read only), parentHome,
 * extraPathDirs (directories under the scratch root placed first on PATH).
 */
function isolatedEnv(scratch, opts) {
  const o = opts || {};
  const repoRoot = o.repoRoot || REPO_ROOT;
  if (APPROVED_PLUGIN_ROOTS.indexOf(repoRoot) === -1) throw fail('isolation_breach:CLAUDE_PLUGIN_ROOT', 'the plugin root is not an approved root');
  const parentEnv = o.parentEnv || process.env;
  const home = parentHomeOf(o);
  const env = {};
  ISOLATION_TABLE.forEach(function (e) {
    if (e.kind === 'scratch') env[e.name] = scratchValue(e, scratch);
    else if (e.kind === 'plugin') env[e.name] = repoRoot;
    else if (e.kind === 'built') env[e.name] = buildPath(scratch, parentEnv, home, o.extraPathDirs);
    else if (e.kind === 'pass') { if (typeof parentEnv[e.name] === 'string') env[e.name] = parentEnv[e.name]; }
    else if (e.kind === 'credential') { if (o.withCredential && typeof parentEnv[e.name] === 'string' && parentEnv[e.name]) env[e.name] = parentEnv[e.name]; }
    else if (e.kind === 'switch') {
      const on = e.defaultOn || (Array.isArray(o.switches) && o.switches.indexOf(e.name) !== -1);
      if (on) env[e.name] = e.value;
    }
  });
  (Array.isArray(o.switches) ? o.switches : []).forEach(function (n) {
    if (SWITCH_NAMES.indexOf(n) === -1) throw fail('isolation_breach:' + n, 'not a declared switch');
  });
  return env;
}

/*
 * breachOf(env, scratch, opts) -> null, or the reason string `isolation_breach:<name>`.
 */
function breachOf(env, scratch, opts) {
  const o = opts || {};
  const home = parentHomeOf(o);
  const names = Object.keys(env);
  for (let i = 0; i < SCRATCH_ROOTS.length; i += 1) {
    if (typeof env[SCRATCH_ROOTS[i]] !== 'string') return 'isolation_breach:' + SCRATCH_ROOTS[i];
  }
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const entry = TABLE_BY_NAME[name];
    const val = env[name];
    if (!entry || typeof val !== 'string') return 'isolation_breach:' + name;
    if (entry.kind === 'scratch') {
      if (!within(scratch.root, val)) return 'isolation_breach:' + name;
    } else if (entry.kind === 'plugin') {
      if (APPROVED_PLUGIN_ROOTS.indexOf(val) === -1) return 'isolation_breach:' + name;
    } else if (entry.kind === 'built') {
      const parts = listEntries(val);
      if (!parts.length || !within(scratch.root, parts[0])) return 'isolation_breach:' + name;
      for (let j = 0; j < parts.length; j += 1) {
        if (!within(scratch.root, parts[j]) && underHome(parts[j], home)) return 'isolation_breach:' + name;
      }
    } else if (entry.kind === 'credential') {
      if (!val) return 'isolation_breach:' + name;
    } else if (underHome(val, home)) {
      return 'isolation_breach:' + name;
    }
  }
  return null;
}

function assertIsolatedEnv(env, scratch, opts) {
  const reason = breachOf(env, scratch, opts);
  if (reason) throw fail(reason);
  return true;
}

// ---------------------------------------------------------------------------------------------
// test-process helper (never called by the eval): sets the scratch and plugin names on process.env
// ---------------------------------------------------------------------------------------------
function applyIsolationToProcess(scratch, opts) {
  const o = opts || {};
  const repoRoot = o.repoRoot || REPO_ROOT;
  const saved = {};
  const names = SCRATCH_ROOTS.concat(PLUGIN_NAMES);
  names.forEach(function (n) { saved[n] = Object.prototype.hasOwnProperty.call(process.env, n) ? process.env[n] : undefined; });
  ISOLATION_TABLE.forEach(function (e) {
    if (e.kind === 'scratch') process.env[e.name] = scratchValue(e, scratch);
    if (e.kind === 'plugin') process.env[e.name] = repoRoot;
  });
  return function restore() {
    names.forEach(function (n) {
      if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n];
    });
  };
}

// ---------------------------------------------------------------------------------------------
// tree helpers for the canaries (used on stand-in homes, scratch roots and the repo root only)
// ---------------------------------------------------------------------------------------------
function snapshotTree(dir) {
  const out = {};
  function walk(d) {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    ents.forEach(function (ent) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) { out[path.relative(dir, p) + '/'] = 'dir'; walk(p); }
      else if (ent.isSymbolicLink()) out[path.relative(dir, p)] = 'link:' + fs.readlinkSync(p);
      else if (ent.isFile()) out[path.relative(dir, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    });
  }
  walk(dir);
  return out;
}

function sameSnapshot(a, b) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every(function (k, i) { return k === kb[i] && a[k] === b[k]; });
}

// files under root (outside .git) newer than the marker file; uses find(1) on the repo root only
function filesNewerThan(root, markerFile) {
  const r = spawnSync('find', [root, '-path', path.join(root, '.git'), '-prune', '-o', '-newer', markerFile, '-type', 'f', '-print'], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) throw fail('find_failed', String(r.stderr || '').slice(0, 200));
  return r.stdout.split('\n').filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// the room birth, in a child process (buildRoom sets process.env.MINDRIAN_ROOMS_HOME)
// ---------------------------------------------------------------------------------------------
function spawnIsolated(scratch, cmd, args, o) {
  const opts = o || {};
  const env = isolatedEnv(scratch, opts.envOpts);
  assertIsolatedEnv(env, scratch, opts.envOpts);
  return spawnSync(cmd, args, {
    cwd: opts.cwd || scratch.root,
    env: env,
    input: opts.input === undefined ? '' : opts.input,
    encoding: 'utf8',
    timeout: opts.timeout || 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
}

// opts.roomsOverride is a test seam: it sends the birth to another folder so the test can prove
// that a room returned outside the scratch rooms root is refused.
function bornScratchRoom(scratch, opts) {
  const o = opts || {};
  const seedDir = o.seedDir || DEFAULT_SEED;
  const r = spawnIsolated(scratch, path.join(scratch.bin, 'node'), [path.join(REPO_ROOT, 'scripts', 'isolate-larry-voice.cjs'), '__birth', JSON.stringify({ seedDir: seedDir, rooms: o.roomsOverride || scratch.rooms })], { envOpts: o.envOpts, timeout: o.timeout || 180000 });
  const lines = String(r.stdout || '').split('\n').filter(Boolean);
  let res = null;
  for (let i = lines.length - 1; i >= 0 && !res; i -= 1) { try { res = JSON.parse(lines[i]); } catch (_e) { res = null; } }
  if (!res || res.ok !== true) throw fail('room_birth_failed', String((res && res.reason) || r.stderr || 'no result').slice(0, 300));
  if (!within(scratch.rooms, res.roomDir)) throw fail('room_outside_scratch', 'the birth returned a room outside the scratch rooms root');
  return { roomDir: res.roomDir, slug: res.slug, indexed: res.indexed, seeded: res.seeded };
}

// ---------------------------------------------------------------------------------------------
// hard-coded path scan (text only): the static half of the canary
// ---------------------------------------------------------------------------------------------
const LITERAL_PATH_RE = /(^|[\s='"`(:])(\/tmp|\/var\/tmp|\/home\/|\/Users\/|\/root\/)|[A-Za-z]:\\+Users/;
// compare-only workspace guard lines of scripts/session-start: they test the current directory
// against the plugin cache and write nothing
const COMPARE_ONLY_LINES = Object.freeze([
  '|| [[ "${PWD}" == "/home/jsagi/.claude/plugins/"* ]] \\',
  '|| [[ "${PWD}" == "/Users/"*"/.claude/plugins/"* ]]; then',
]);

function isCommentLine(t) {
  return t.indexOf('#') === 0 || t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0;
}

function scanHardcodedPaths(text) {
  const out = [];
  String(text).split('\n').forEach(function (line, i) {
    const t = line.trim();
    if (!t || isCommentLine(t)) return;
    if (!LITERAL_PATH_RE.test(line)) return;
    if (COMPARE_ONLY_LINES.indexOf(t) !== -1) return;
    out.push({ line: i + 1, text: t });
  });
  return out;
}

function scanFile(rel, repoRoot) {
  const abs = path.join(repoRoot || REPO_ROOT, rel);
  return scanHardcodedPaths(fs.readFileSync(abs, 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// the SessionStart chain
// ---------------------------------------------------------------------------------------------
function ev(file, line, text) { return Object.freeze({ file: file, line: line, text: text }); }

const STARTUP_CONTAINMENT = Object.freeze({
  'scripts/sessionstart-npm-reconcile.cjs': Object.freeze({
    kind: 'switch_proof:MINDRIAN_NPM_RECONCILE_SKIP',
    fallback_reason: 'plugin_root_maintenance_not_containable',
    reason: 'installs dependencies under the directory the script lives in when node_modules is missing; contained only by its off switch, accepted after the run-time proof',
    evidence: [
      ev('scripts/sessionstart-npm-reconcile.cjs', 56, "const OWN_ROOT = path.resolve(__dirname, '..');"),
      ev('scripts/sessionstart-npm-reconcile.cjs', 47, "if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();"),
    ],
  }),
  'scripts/sessionstart-post-update-preflight.cjs': Object.freeze({
    kind: 'switch:MOS_SESSION_VERIFY_NO_PROBE',
    reason: 'home from HOME; the detached Theo probe is off with the switch; the doctor child inherits the isolated env',
    evidence: [
      ev('scripts/sessionstart-post-update-preflight.cjs', 65, 'const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();'),
      ev('scripts/sessionstart-post-update-preflight.cjs', 262, "if (process.env.MOS_SESSION_VERIFY_NO_PROBE === '1') return false;"),
      ev('scripts/sessionstart-post-update-preflight.cjs', 266, 'detached: true,'),
    ],
  }),
  'hooks/run-hook.cmd session-start': Object.freeze({
    kind: 'scan_gated',
    reason: 'every write target derives from HOME, MINDRIAN_ROOMS_*, CLAUDE_CONFIG_DIR or TMPDIR, except the literal /tmp paths the scan reports; contained only while the scan finds none',
    fallback_reason: 'hardcoded_path_write',
    evidence: [
      ev('scripts/session-start', 413, 'BRIDGE_FILE="/tmp/mindrian-context-state"'),
      ev('scripts/session-start', 1332, 'tmp=$(mktemp 2>/dev/null || echo "/tmp/mos-sealed-$$")'),
      ev('scripts/session-start', 1829, 'UPDATE_CACHE="/tmp/mindrian-update-check"'),
      ev('scripts/session-start', 1867, 'echo "$TODAY" > "$UPDATE_CACHE"'),
      ev('scripts/session-start', 1980, '( node "${PLUGIN_ROOT}/lib/core/brain-prewarm.cjs" >/dev/null 2>&1 || true ) &'),
    ],
  }),
  'scripts/sessionstart-coordinator.cjs': Object.freeze({
    kind: 'env_roots',
    reason: 'telemetry and every contributor write under os.homedir() or the rooms home; the MCP-first daemon path is off while MINDRIAN_MCP_FIRST is absent from the table',
    evidence: [
      ev('scripts/sessionstart-coordinator.cjs', 53, "os.homedir(), '.mindrian', 'telemetry', 'sessionstart-errors.jsonl'"),
    ],
  }),
  'scripts/sessionstart-reference-now-seed.cjs': Object.freeze({
    kind: 'switch:MINDRIAN_SESSION_ID',
    reason: 'the clock seam lives under os.homedir(); the single network GET is skipped when the seam holds the session id and an offset, which makeScratch pre-seeds',
    evidence: [
      ev('scripts/sessionstart-reference-now-seed.cjs', 49, 'const envSession = process.env.CLAUDE_SESSION_ID || process.env.MINDRIAN_SESSION_ID;'),
      ev('lib/core/temporal/reference-now.cjs', 44, "const DEFAULT_SEAM_PATH = path.join(os.homedir(), '.mindrian', 'reference-now.json');"),
      ev('lib/core/temporal/reference-now.cjs', 190, 'if (seam && seam.lastFetchSession === sessionId && isFiniteNumber(seam.offsetMs)) {'),
    ],
  }),
  'scripts/check-pending-breakthrough.cjs': Object.freeze({
    kind: 'env_roots',
    reason: 'reads the rooms home (MINDRIAN_ROOMS_HOME, else os.homedir()); no spawn, no detached child',
    evidence: [
      ev('scripts/check-pending-breakthrough.cjs', 62, 'if (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME)) {'),
    ],
  }),
  'scripts/check-pending-ambiguous.cjs': Object.freeze({
    kind: 'env_roots',
    reason: 'reads the rooms home (MINDRIAN_ROOMS_HOME, else os.homedir()) and writes scalar properties into the active room db of that home; no spawn',
    evidence: [
      ev('scripts/check-pending-ambiguous.cjs', 79, 'if (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME)) {'),
    ],
  }),
  'scripts/gsd-graph-derive-drain.cjs': Object.freeze({
    kind: 'switch:MINDRIAN_DERIVE_SKIP',
    reason: 'the entry point re-spawns a detached worker; the switch ends the hook before the self-detach and before any work',
    evidence: [
      ev('scripts/gsd-graph-derive-drain.cjs', 956, "if (process.env.MINDRIAN_DERIVE_SKIP === '1') { process.exit(0); }"),
    ],
  }),
  'scripts/agentshield-sessionstart-scan.cjs': Object.freeze({
    kind: 'env_roots',
    reason: 'the dedup cache lives under os.homedir(); the scan reads the plugin surfaces and sends nothing',
    evidence: [
      ev('scripts/agentshield-sessionstart-scan.cjs', 107, "return path.join(os.homedir(), '.mindrian', 'agentshield');"),
    ],
  }),
});

// switches each hook needs for the canary and for a live leg (default-on switches are always set)
const HOOK_SWITCHES = Object.freeze({
  'scripts/sessionstart-post-update-preflight.cjs': ['MOS_SESSION_VERIFY_NO_PROBE'],
  'scripts/gsd-graph-derive-drain.cjs': ['MINDRIAN_DERIVE_SKIP'],
  'hooks/run-hook.cmd session-start': ['MINDRIAN_DOGFOOD_DRAIN_SKIP', 'SCOUT_CADENCE_SKIP', 'BRAIN_STALENESS_SKIP'],
});

function hookKey(command) {
  return String(command)
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '')
    .replace(/"/g, '')
    .replace(/^node\s+/, '')
    .trim();
}

function sessionStartKeys(hooksJsonPath) {
  const h = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  const keys = [];
  ((h.hooks && h.hooks.SessionStart) || []).forEach(function (group) {
    (group.hooks || []).forEach(function (hk) { if (hk && hk.type === 'command') keys.push(hookKey(hk.command)); });
  });
  return keys;
}

function evidenceHolds(e, repoRoot) {
  try {
    const lines = fs.readFileSync(path.join(repoRoot || REPO_ROOT, e.file), 'utf8').split('\n');
    return typeof lines[e.line - 1] === 'string' && lines[e.line - 1].indexOf(e.text) !== -1;
  } catch (_e) { return false; }
}

// ---------------------------------------------------------------------------------------------
// the reconcile switch proof (Codex round 3; quick 261029-nhu)
// ---------------------------------------------------------------------------------------------
const SYNTHETIC_PAYLOAD = Object.freeze({ session_id: 'larry-voice-eval', hook_event_name: 'SessionStart', source: 'startup' });

function writeFile(p, text, mode) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, mode ? { mode: mode } : undefined);
}

let proofCounter = 0;

/*
 * proveReconcileSwitch(scratch, opts) -> { proven, reason, reconcile_sha256, evidence }.
 * Runs a byte-equal copy of the reconcile hook (or opts.scriptText for the control legs) with the
 * switch set, against a stand-in plugin root with no node_modules and recording install stubs.
 */
function proveReconcileSwitch(scratch, opts) {
  const o = opts || {};
  const repoFile = path.join(REPO_ROOT, 'scripts', 'sessionstart-npm-reconcile.cjs');
  const repoBytes = fs.readFileSync(repoFile);
  const bytes = o.scriptText !== undefined ? Buffer.from(o.scriptText) : repoBytes;
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const evidence = { script_source: o.scriptText !== undefined ? 'supplied' : 'repo', reconcile_sha256: sha };
  proofCounter += 1;
  const proofRoot = path.join(scratch.root, 'reconcile-proof-' + proofCounter);
  const plugin = path.join(proofRoot, 'plugin');
  const markers = path.join(proofRoot, 'markers');
  const proofBin = path.join(proofRoot, 'bin');
  const markerFile = path.join(markers, 'install-called');
  fs.mkdirSync(markers, { recursive: true });
  writeFile(path.join(plugin, 'scripts', 'sessionstart-npm-reconcile.cjs'), bytes);
  if (o.scriptText === undefined) {
    const copied = fs.readFileSync(path.join(plugin, 'scripts', 'sessionstart-npm-reconcile.cjs'));
    if (crypto.createHash('sha256').update(copied).digest('hex') !== crypto.createHash('sha256').update(repoBytes).digest('hex')) {
      return { proven: false, reason: 'copy_not_byte_equal', reconcile_sha256: sha, evidence: evidence };
    }
  }
  fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(plugin, 'package.json'));
  const mark = JSON.stringify(markerFile);
  writeFile(path.join(plugin, 'lib', 'core', 'mcp-dep-heal.cjs'),
    "'use strict';\nconst fs = require('node:fs');\n" +
    'module.exports = {\n' +
    '  treeTrusted: function () { return false; },\n' +
    "  installInFlight: function () { return { inFlight: false }; },\n" +
    "  runGuardedInstall: function () { fs.writeFileSync(" + mark + ", 'runGuardedInstall'); },\n" +
    '};\n');
  writeFile(path.join(plugin, 'lib', 'core', 'npm-cli-resolve.cjs'),
    "'use strict';\nconst fs = require('node:fs');\n" +
    'module.exports = {\n' +
    "  resolveNpmCli: function () { return { command: 'npm', shell: false }; },\n" +
    "  buildInstallArgs: function () { fs.writeFileSync(" + mark + ", 'buildInstallArgs'); return ['install']; },\n" +
    '};\n');
  writeFile(path.join(proofBin, 'npm'), '#!/bin/sh\necho npm > ' + JSON.stringify(markerFile) + '\nexit 0\n', 0o755);
  const before = snapshotTree(plugin);
  const standinHome = scratch.home;
  const homeBefore = snapshotTree(standinHome);
  const env = isolatedEnv(scratch, { extraPathDirs: [proofBin], parentHome: o.parentHome });
  assertIsolatedEnv(env, scratch, { parentHome: o.parentHome });
  const markerChain = path.join(proofRoot, 'chain-marker');
  fs.writeFileSync(markerChain, 'marker');
  const r = spawnSync(path.join(scratch.bin, 'node'), [path.join(plugin, 'scripts', 'sessionstart-npm-reconcile.cjs')], {
    cwd: scratch.root,
    env: env,
    input: JSON.stringify(SYNTHETIC_PAYLOAD),
    encoding: 'utf8',
    timeout: 60000,
  });
  evidence.exit = r.status;
  evidence.stdout = String(r.stdout || '').slice(0, 200);
  let reason = null;
  if (fs.existsSync(markerFile)) reason = 'install_called';
  else if (r.status !== 0) reason = 'exit_' + r.status;
  else {
    let parsed = null;
    try { parsed = JSON.parse(String(r.stdout || '').trim()); } catch (_e) { parsed = null; }
    if (!parsed || parsed.continue !== true) reason = 'stdout_not_continue';
    else if (!sameSnapshot(before, snapshotTree(plugin))) reason = 'stand_in_root_changed';
    else if (!sameSnapshot(homeBefore, snapshotTree(standinHome))) reason = 'stand_in_home_changed';
  }
  if (!reason) {
    // No file under the repo root (outside .git) may be newer than the marker written before the child ran.
    const newer = filesNewerThan(REPO_ROOT, markerChain);
    if (newer.length) { reason = 'repo_root_changed'; evidence.repo_changed = newer.slice(0, 5); }
  }
  evidence.stderr = String(r.stderr || '').slice(0, 200);
  return { proven: !reason, reason: reason || 'proven', reconcile_sha256: sha, evidence: evidence };
}

// ---------------------------------------------------------------------------------------------
// the chain verdict
// ---------------------------------------------------------------------------------------------
function startupChainVerdict(hooksJsonPath, opts) {
  const o = opts || {};
  const hooksPath = hooksJsonPath || path.join(REPO_ROOT, 'hooks', 'hooks.json');
  const keys = sessionStartKeys(hooksPath);
  const blockers = [];
  const hooks = [];
  const tableKeys = Object.keys(STARTUP_CONTAINMENT);
  keys.forEach(function (k) {
    if (!STARTUP_CONTAINMENT[k]) blockers.push({ hook: k, reason: 'unclassified_hook' });
  });
  tableKeys.forEach(function (k) {
    if (keys.indexOf(k) === -1) blockers.push({ hook: k, reason: 'table_entry_not_in_chain' });
  });
  let proof = null;
  keys.forEach(function (k) {
    const entry = STARTUP_CONTAINMENT[k];
    if (!entry) return;
    const row = { hook: k, kind: entry.kind, containable: true, reason: null };
    const badEvidence = entry.evidence.filter(function (e) { return !evidenceHolds(e, o.repoRoot); });
    if (badEvidence.length) {
      row.containable = false; row.reason = 'evidence_stale';
      blockers.push({ hook: k, reason: 'evidence_stale', lines: badEvidence.map(function (e) { return e.file + ':' + e.line; }) });
    } else if (entry.kind === 'not_containable') {
      row.containable = false; row.reason = entry.reason;
      blockers.push({ hook: k, reason: entry.fallback_reason || 'not_containable', detail: entry.reason });
    } else if (entry.kind === 'scan_gated') {
      const scriptRel = k === 'hooks/run-hook.cmd session-start' ? 'scripts/session-start' : k;
      const found = scanFile(scriptRel, o.repoRoot);
      if (found.length) {
        row.containable = false; row.reason = entry.fallback_reason;
        blockers.push({ hook: k, reason: entry.fallback_reason, lines: found });
      }
    } else if (entry.kind.indexOf('switch_proof:') === 0) {
      if (!o.scratch) throw fail('scratch_required', 'the reconcile proof needs a scratch root');
      proof = proveReconcileSwitch(o.scratch, { parentHome: o.parentHome });
      if (!proof.proven) {
        row.containable = false; row.reason = entry.fallback_reason;
        blockers.push({ hook: k, reason: entry.fallback_reason, proof: proof.reason });
      }
    }
    hooks.push(row);
  });
  return { containable: blockers.length === 0, blockers: blockers, reconcile_proof: proof, hooks: hooks };
}

/*
 * liveLegGate(verdict, {loadsPlugin}) -> { ok, exit, reason }.
 * A live leg that loads the plugin refuses with 77 (1 under LARRY_VOICE_REQUIRE_LIVE=1).
 */
function liveLegGate(verdict, opts) {
  const o = opts || {};
  if (!o.loadsPlugin) return { ok: true };
  if (verdict && verdict.containable) return { ok: true };
  const blockers = (verdict && verdict.blockers) || [];
  const reconcile = blockers.some(function (b) { return b.reason === 'plugin_root_maintenance_not_containable'; });
  const reason = reconcile ? 'plugin_root_maintenance_not_containable' : 'isolation_canary_failed';
  return { ok: false, exit: process.env.LARRY_VOICE_REQUIRE_LIVE === '1' ? 1 : 77, reason: reason };
}

// ---------------------------------------------------------------------------------------------
// the hook capture
// ---------------------------------------------------------------------------------------------
function absolutePathsIn(text) {
  return (String(text).match(/(?:\/(?:home|Users|tmp|var|root|mnt)\/[^\s"'<>)\]},;]+)/g) || []);
}

function captureHookContext(scratch, opts) {
  const o = opts || {};
  const hook = o.hook;
  if (hook !== 'session-start' && hook !== 'user-prompt') throw fail('hook_unknown', String(hook));
  if (!o.roomDir || !within(scratch.rooms, o.roomDir)) throw fail('capture_room_outside_scratch');
  let file;
  let args;
  let payload;
  if (hook === 'session-start') {
    const found = scanFile('scripts/session-start');
    if (found.length) throw fail('isolation_canary_failed', 'scripts/session-start holds ' + found.length + ' literal path(s) outside the scratch roots; first at line ' + found[0].line);
    file = 'bash';
    args = [path.join(REPO_ROOT, 'hooks', 'run-hook.cmd'), 'session-start'];
    payload = Object.assign({}, SYNTHETIC_PAYLOAD, { cwd: o.roomDir });
  } else {
    file = path.join(scratch.bin, 'node');
    args = [path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs')];
    payload = { session_id: SYNTHETIC_PAYLOAD.session_id, hook_event_name: 'UserPromptSubmit', prompt: String(o.prompt || ''), cwd: o.roomDir };
  }
  const switches = (o.switches || []).concat(hook === 'session-start' ? HOOK_SWITCHES['hooks/run-hook.cmd session-start'] : []);
  const r = spawnIsolated(scratch, file, args, { cwd: o.roomDir, input: JSON.stringify(payload), envOpts: { switches: switches, parentHome: o.parentHome }, timeout: o.timeoutMs || 60000 });
  const raw = String(r.stdout || '');
  let text = raw.trim();
  try {
    const j = JSON.parse(raw.trim());
    if (j && j.hookSpecificOutput && typeof j.hookSpecificOutput.additionalContext === 'string') text = j.hookSpecificOutput.additionalContext;
  } catch (_e) { /* plain text output */ }
  const outside = absolutePathsIn(text).filter(function (p) { return !within(scratch.root, p) && !within(REPO_ROOT, p); });
  if (outside.length) throw fail('capture_outside_scratch', outside[0]);
  return { text: text, raw: raw, exit: r.status, stderr: String(r.stderr || '').slice(0, 400) };
}

// ---------------------------------------------------------------------------------------------
// internal subcommand: the room birth, run only as a child of bornScratchRoom
// ---------------------------------------------------------------------------------------------
async function birthMain(jsonArg) {
  let arg;
  try { arg = JSON.parse(jsonArg); } catch (_e) { process.stdout.write(JSON.stringify({ ok: false, reason: 'birth_args_invalid' }) + '\n'); return 2; }
  try {
    const rr = require(path.join(REPO_ROOT, 'scripts', 'real-room-run.cjs'));
    const room = await rr.buildRoom({}, '0'.repeat(40), arg.seedDir, arg.rooms);
    process.stdout.write(JSON.stringify({ ok: true, roomDir: room.roomDir, slug: room.slug, indexed: room.indexed, seeded: room.seeded && { entities: room.seeded.entities, claims: room.seeded.claims } }) + '\n');
    return 0;
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, reason: String((e && (e.refusal || e.message)) || e).slice(0, 300) }) + '\n');
    return 1;
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '__birth') {
    birthMain(argv[1]).then(function (code) { process.exitCode = code; });
  } else {
    process.stderr.write('usage: isolate-larry-voice.cjs is a module; the only subcommand is the internal __birth\n');
    process.exitCode = 2;
  }
}

module.exports = {
  ISOLATION_TABLE,
  SCRATCH_ROOTS,
  APPROVED_PLUGIN_ROOTS,
  STARTUP_CONTAINMENT,
  HOOK_SWITCHES,
  COMPARE_ONLY_LINES,
  OFFLINE_SESSION_ID,
  CREDENTIAL_NAMES,
  SWITCH_NAMES,
  SYNTHETIC_PAYLOAD,
  makeScratch,
  isolatedEnv,
  assertIsolatedEnv,
  breachOf,
  bornScratchRoom,
  captureHookContext,
  startupChainVerdict,
  proveReconcileSwitch,
  applyIsolationToProcess,
  liveLegGate,
  scanHardcodedPaths,
  scanFile,
  sessionStartKeys,
  evidenceHolds,
  snapshotTree,
  sameSnapshot,
  filesNewerThan,
  spawnIsolated,
  hookKey,
  within,
};
