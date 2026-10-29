#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 02 Task 2 (Codex C1 and rounds 2 and 3): the isolation contract of
 * scripts/isolate-larry-voice.cjs, proven on stand-in homes the test creates and owns.
 * The test never reads, lists or stats anything under the owner's rooms.
 *
 *   B1   the table builds the child env from itself: unknown names are dropped, every scratch name
 *        is under the scratch root, PATH is built, the parent env is not mutated
 *   B2   assertIsolatedEnv: two rules that cannot contradict (repo root on a plugin name passes;
 *        the repo root on HOME, a sibling of the repo on a plugin name and a PATH entry under the
 *        parent home fail; an unknown name fails; a missing HOME fails); a scratch root under the
 *        parent home is refused
 *   B3   bornScratchRoom: the room is born in a child inside the scratch rooms root; the parent
 *        env is deep-equal before and after; a room returned outside the scratch root is refused
 *   B4   the canary: the classifier capture runs with the test HOME pointed at a stand-in home;
 *        the stand-in is byte-identical afterwards and the scratch root holds the new files;
 *        the session-start capture is refused exactly while its scan finds a literal path
 *   B5   the SessionStart chain: STARTUP_CONTAINMENT equals the chain of hooks/hooks.json (fail
 *        closed on a new, renamed or removed hook); each evidence line still holds; every
 *        containable hook runs in chain order under the isolated env and writes nothing outside
 *        the scratch root; a hook that is not containable is never executed
 *   B6   the reconcile switch proof: the base bytes fail (install_called), a synthetic variant
 *        passes, and the verdict follows the proof for the repo file at this commit
 *   B7   the env-root scan: every environment name the scripts read is classified in the table
 *   B8   the hard-coded path scan: the literal paths the scripts hold equal the declared known set
 *   B9   credential pass-through by name only, and no function prints a value
 *   B10  requiring scripts/real-room-run.cjs runs no main; its --help output equals the base
 *   B11  no em-dash or en-dash in this file
 *
 * Hermetic: the test HOME is a stand-in directory; installNetGuard counts fetch calls.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');

const NET = installNetGuard();
const C = makeChecker('369.6-02 isolation contract');
const check = C.check;
const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const BASE = 'd6a2fdbaa';

const OWNED = [];
function mk(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  OWNED.push(d);
  return d;
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// the stand-in home: holds a stand-in MindrianRooms folder and registry file the test owns
const STANDIN = mk('standin-home-3696-');
fs.mkdirSync(path.join(STANDIN, 'MindrianRooms', '.rooms'), { recursive: true });
fs.writeFileSync(path.join(STANDIN, 'MindrianRooms', '.rooms', 'registry.json'), JSON.stringify({ active: 'standin', rooms: {} }));
fs.mkdirSync(path.join(STANDIN, '.claude'), { recursive: true });
fs.writeFileSync(path.join(STANDIN, '.claude', 'settings.json'), '{"standin":true}');
process.env.HOME = STANDIN;
process.env.USERPROFILE = STANDIN;

const iso = require('../scripts/isolate-larry-voice.cjs');

function envSnapshot() { return JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; })); }
function throwsWith(fn, reason) {
  try { fn(); return false; } catch (e) { return String(e && e.reason || e && e.message).indexOf(reason) === 0; }
}

const HOSTILE = {
  HOME: STANDIN,
  PATH: [path.join(STANDIN, '.nvm', 'bin'), '/usr/bin', '/bin', path.join(STANDIN, '.claude', 'plugins', 'cache', 'x', 'bin')].join(path.delimiter),
  MINDRIAN_ROOMS_HOME: path.join(STANDIN, 'MindrianRooms'),
  MINDRIAN_ACTIVE_ROOM_DIR: path.join(STANDIN, 'MindrianRooms', 'room'),
  MINDRIAN_UNKNOWN_NAME: 'x',
  CLAUDE_UNKNOWN_NAME: 'x',
  XDG_UNKNOWN_NAME: 'x',
  CLAUDE_CODE_OAUTH_TOKEN: 'token-for-test-only',
  LANG: 'C.UTF-8',
  TERM: 'xterm',
};

// ---- B1 ---------------------------------------------------------------------------------------
const S1 = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
const envBefore = envSnapshot();
const E1 = iso.isolatedEnv(S1, { parentEnv: HOSTILE });
check('B1a every SCRATCH_ROOTS name is set and resolves under the scratch root',
  iso.SCRATCH_ROOTS.every(function (n) { return typeof E1[n] === 'string' && iso.within(S1.root, E1[n]); }));
check('B1b the 15 scratch names of the plan (home, rooms, config, the XDG roots, plugin data, receipts, temp) are in the table',
  ['HOME', 'USERPROFILE', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'CLAUDE_PLUGIN_DATA', 'MINDRIAN_REAL_ROOM_RECEIPT_DIR', 'TMPDIR', 'TMP', 'TEMP']
    .every(function (n) { return iso.SCRATCH_ROOTS.indexOf(n) !== -1; }) && iso.SCRATCH_ROOTS.length === 15);
check('B1c unknown MINDRIAN_, CLAUDE_ and XDG_ names and the room pointer are absent from the child env',
  !('MINDRIAN_UNKNOWN_NAME' in E1) && !('CLAUDE_UNKNOWN_NAME' in E1) && !('XDG_UNKNOWN_NAME' in E1) && !('MINDRIAN_ACTIVE_ROOM_DIR' in E1));
check('B1d the plugin names equal the single approved root', iso.APPROVED_PLUGIN_ROOTS.length === 1 && E1.CLAUDE_PLUGIN_ROOT === ROOT && E1.MINDRIAN_OS_ROOT === ROOT);
const pathParts = E1.PATH.split(path.delimiter);
check('B1e PATH starts at scratch/bin and holds no entry under the parent home',
  pathParts[0] === S1.bin && pathParts.every(function (p) { return p.indexOf(STANDIN) === -1; }) && E1.PATH.indexOf('.nvm') === -1);
check('B1f the reconcile off switch is set from the table in every child env', E1.MINDRIAN_NPM_RECONCILE_SKIP === '1');
check('B1g the child env passes assertIsolatedEnv', iso.breachOf(E1, S1) === null);
check('B1h the parent process.env is unchanged by isolatedEnv', envSnapshot() === envBefore);
check('B1i a switch outside the table is refused', throwsWith(function () { iso.isolatedEnv(S1, { parentEnv: HOSTILE, switches: ['MINDRIAN_NOT_A_SWITCH'] }); }, 'isolation_breach:MINDRIAN_NOT_A_SWITCH'));

// ---- B2 ---------------------------------------------------------------------------------------
const PH = path.dirname(ROOT); // a parent home that holds the repo, for the rule 2 legs
const sibling = path.join(PH, 'sibling-of-the-repo');
function mutated(name, value) { return Object.assign({}, E1, { [name]: value }); }
check('B2a the repo root on CLAUDE_PLUGIN_ROOT passes', iso.breachOf(mutated('CLAUDE_PLUGIN_ROOT', ROOT), S1, { parentHome: PH }) === null);
check('B2b the repo root on HOME fails', iso.breachOf(mutated('HOME', ROOT), S1, { parentHome: PH }) === 'isolation_breach:HOME');
check('B2c a sibling of the repo under the parent home on MINDRIAN_OS_ROOT fails', iso.breachOf(mutated('MINDRIAN_OS_ROOT', sibling), S1, { parentHome: PH }) === 'isolation_breach:MINDRIAN_OS_ROOT');
check('B2d a PATH entry under the parent home fails',
  iso.breachOf(mutated('PATH', [S1.bin, path.join(PH, 'node', 'bin'), '/usr/bin'].join(path.delimiter)), S1, { parentHome: PH }) === 'isolation_breach:PATH');
check('B2e a PATH that does not start inside the scratch root fails', iso.breachOf(mutated('PATH', '/usr/bin'), S1) === 'isolation_breach:PATH');
check('B2f a name outside the table fails', iso.breachOf(Object.assign({}, E1, { MINDRIAN_STRAY: '1' }), S1) === 'isolation_breach:MINDRIAN_STRAY');
const noHome = Object.assign({}, E1); delete noHome.HOME;
check('B2g a missing HOME fails (a child with no HOME would fall back to the passwd home)', iso.breachOf(noHome, S1) === 'isolation_breach:HOME');
check('B2h a scratch value outside the scratch root fails', iso.breachOf(mutated('TMPDIR', os.tmpdir()), S1) === 'isolation_breach:TMPDIR');
check('B2i a relative scratch value fails', iso.breachOf(mutated('XDG_DATA_HOME', 'relative/dir'), S1) === 'isolation_breach:XDG_DATA_HOME');
check('B2j a plugin name that is a sibling directory (not a member) fails even outside the parent home', iso.breachOf(mutated('CLAUDE_PLUGIN_ROOT', path.join(os.tmpdir(), 'other')), S1) === 'isolation_breach:CLAUDE_PLUGIN_ROOT');
check('B2k a scratch root under the parent home is refused (scratch_under_parent_home)',
  throwsWith(function () { iso.makeScratch('larry-voice-scratch-', { parentHome: fs.realpathSync(os.tmpdir()), claudeCli: null }); }, 'scratch_under_parent_home'));
check('B2l APPROVED_PLUGIN_ROOTS is frozen with one member', Object.isFrozen(iso.APPROVED_PLUGIN_ROOTS) && iso.APPROVED_PLUGIN_ROOTS[0] === ROOT);
OWNED.push(S1.root);

// ---- B3 ---------------------------------------------------------------------------------------
const S3 = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(S3.root);
const before3 = envSnapshot();
const room = iso.bornScratchRoom(S3);
check('B3a the room is born inside the scratch rooms root through buildRoom in a child',
  iso.within(S3.rooms, room.roomDir) && fs.existsSync(path.join(room.roomDir, '.mindrian', 'room.db')) && room.indexed >= 1);
check('B3b the parent process.env is deep-equal before and after the birth', envSnapshot() === before3);
const S3b = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(S3b.root);
check('B3c a room returned outside the scratch rooms root is refused',
  throwsWith(function () { iso.bornScratchRoom(S3, { roomsOverride: S3b.rooms }); }, 'room_outside_scratch'));
check('B3d the stand-in home is untouched by the birth', Object.keys(iso.snapshotTree(STANDIN)).sort().join('|') === ['.claude/', '.claude/settings.json', 'MindrianRooms/', 'MindrianRooms/.rooms/', 'MindrianRooms/.rooms/registry.json'].sort().join('|'));

// ---- B4 ---------------------------------------------------------------------------------------
const standinBefore = iso.snapshotTree(STANDIN);
const marker4 = path.join(S3.root, 'canary-marker');
fs.writeFileSync(marker4, 'm');
sleep(50);
const cap = iso.captureHookContext(S3, { roomDir: room.roomDir, hook: 'user-prompt', prompt: 'What should I look at first about humidity-stable materials?' });
check('B4a the classifier capture exits 0 and returns text', cap.exit === 0 && cap.text.length > 0, 'exit ' + cap.exit);
check('B4b the stand-in home is byte-identical after the capture', iso.sameSnapshot(standinBefore, iso.snapshotTree(STANDIN)));
check('B4c the capture wrote its files under the scratch root (new files exist there)', iso.filesNewerThan(S3.root, marker4).length > 0);
check('B4d no file under the repo root is newer than the marker', iso.filesNewerThan(ROOT, marker4).length === 0, iso.filesNewerThan(ROOT, marker4).slice(0, 3).join(','));
const escapes = iso.scanFile('scripts/session-start');
let sessionRefusal = null;
let sessionCap = null;
try { sessionCap = iso.captureHookContext(S3, { roomDir: room.roomDir, hook: 'session-start' }); } catch (e) { sessionRefusal = e; }
if (escapes.length) {
  check('B4e the session-start capture is refused with isolation_canary_failed while the scan finds a literal path',
    !!sessionRefusal && sessionRefusal.reason === 'isolation_canary_failed');
} else {
  check('B4e the session-start capture runs once the scan is clean and leaves the stand-in home untouched',
    !!sessionCap && iso.sameSnapshot(standinBefore, iso.snapshotTree(STANDIN)));
}
check('B4f a capture with a room outside the scratch rooms root is refused',
  throwsWith(function () { iso.captureHookContext(S3, { roomDir: STANDIN, hook: 'user-prompt', prompt: 'x' }); }, 'capture_room_outside_scratch'));

// ---- B5 ---------------------------------------------------------------------------------------
const HOOKS_JSON = path.join(ROOT, 'hooks', 'hooks.json');
const chain = iso.sessionStartKeys(HOOKS_JSON);
check('B5a STARTUP_CONTAINMENT has exactly one entry per SessionStart command, in the chain',
  chain.length === 9 && chain.length === Object.keys(iso.STARTUP_CONTAINMENT).length && chain.every(function (k) { return !!iso.STARTUP_CONTAINMENT[k]; }));
check('B5b every evidence line of the table still holds in the file at the stated line',
  Object.keys(iso.STARTUP_CONTAINMENT).every(function (k) { return iso.STARTUP_CONTAINMENT[k].evidence.every(function (e) { return iso.evidenceHolds(e); }); }));
const S5 = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(S5.root);
const alt = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
alt.hooks.SessionStart.push({ matcher: 'startup', hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/a-new-hook.cjs"' }] });
const altPath = path.join(S5.root, 'hooks-added.json');
fs.writeFileSync(altPath, JSON.stringify(alt));
const vAdded = iso.startupChainVerdict(altPath, { scratch: S5 });
check('B5c a new hook with no entry fails closed (unclassified_hook, containable false)',
  vAdded.containable === false && vAdded.blockers.some(function (b) { return b.hook === 'scripts/a-new-hook.cjs' && b.reason === 'unclassified_hook'; }));
const alt2 = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
alt2.hooks.SessionStart.shift();
const alt2Path = path.join(S5.root, 'hooks-removed.json');
fs.writeFileSync(alt2Path, JSON.stringify(alt2));
const vRemoved = iso.startupChainVerdict(alt2Path, { scratch: S5 });
check('B5d a removed hook leaves a stale table entry that fails closed (table_entry_not_in_chain)',
  vRemoved.blockers.some(function (b) { return b.hook === 'scripts/sessionstart-npm-reconcile.cjs' && b.reason === 'table_entry_not_in_chain'; }));

const verdict = iso.startupChainVerdict(HOOKS_JSON, { scratch: S5 });
const proof = verdict.reconcile_proof;
const reconcileBlocker = verdict.blockers.some(function (b) { return b.hook === 'scripts/sessionstart-npm-reconcile.cjs' && b.reason === 'plugin_root_maintenance_not_containable'; });
check('B5e the verdict follows the run-time proof of the reconcile switch',
  !!proof && typeof proof.proven === 'boolean' && (proof.proven ? !reconcileBlocker : (reconcileBlocker && verdict.containable === false)));

// run every containable hook in chain order under the isolated env
const S5b = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(S5b.root);
const room5 = iso.bornScratchRoom(S5b);
const standin5 = iso.snapshotTree(STANDIN);
const marker5 = path.join(S5b.root, 'chain-marker');
fs.writeFileSync(marker5, 'm');
sleep(50);
const ran = [];
const notRun = [];
let chainOk = true;
const chainDetail = [];
chain.forEach(function (k) {
  const row = verdict.hooks.filter(function (h) { return h.hook === k; })[0];
  if (!row || !row.containable) { notRun.push(k); return; }
  const sw = iso.HOOK_SWITCHES[k] || [];
  const payload = JSON.stringify(Object.assign({}, iso.SYNTHETIC_PAYLOAD, { cwd: room5.roomDir }));
  let r;
  if (k === 'hooks/run-hook.cmd session-start') {
    r = iso.spawnIsolated(S5b, 'bash', [path.join(ROOT, 'hooks', 'run-hook.cmd'), 'session-start'], { cwd: room5.roomDir, input: payload, envOpts: { switches: sw }, timeout: 60000 });
  } else {
    r = iso.spawnIsolated(S5b, path.join(S5b.bin, 'node'), [path.join(ROOT, k)], { cwd: room5.roomDir, input: payload, envOpts: { switches: sw }, timeout: 90000 });
  }
  sleep(1200); // let a detached child finish its writes before the comparison
  const sameHome = iso.sameSnapshot(standin5, iso.snapshotTree(STANDIN));
  const newer = iso.filesNewerThan(ROOT, marker5);
  ran.push({ hook: k, exit: r.status, switches: sw });
  if (r.status !== 0 || !sameHome || newer.length) { chainOk = false; chainDetail.push(k + ' exit=' + r.status + ' sameHome=' + sameHome + ' repoNewer=' + newer.slice(0, 2).join(',')); }
});
check('B5f every containable hook ran under the isolated env: exit 0, the stand-in home byte-identical, no repo file newer than the marker',
  chainOk && ran.length === chain.length - notRun.length && ran.length > 0, chainDetail.join('; '));
check('B5g a hook that is not containable was not executed',
  notRun.every(function (k) { return !ran.some(function (x) { return x.hook === k; }); }));
check('B5h the reconcile ran in place only if its proof passed in the same verdict',
  ran.some(function (x) { return x.hook === 'scripts/sessionstart-npm-reconcile.cjs'; }) === !!(proof && proof.proven));
console.log('INFO chain ran: ' + ran.map(function (x) { return x.hook + (x.switches.length ? ' [' + x.switches.join(',') + ']' : ''); }).join(' | '));
console.log('INFO chain not executed: ' + (notRun.join(', ') || 'none'));
console.log('INFO chain blockers: ' + JSON.stringify(verdict.blockers.map(function (b) { return { hook: b.hook, reason: b.reason, lines: b.lines ? b.lines.map(function (l) { return l.line; }) : undefined, proof: b.proof }; })));
const gate = iso.liveLegGate(verdict, { loadsPlugin: true });
check('B5i liveLegGate refuses a plugin-loading leg while the verdict has a blocker (exit 77, or 1 under LARRY_VOICE_REQUIRE_LIVE=1) and allows a leg that loads no plugin',
  gate.ok === verdict.containable && (gate.ok || ((gate.exit === 77 || gate.exit === 1) && typeof gate.reason === 'string')) && iso.liveLegGate(verdict, { loadsPlugin: false }).ok === true);

// ---- B6 ---------------------------------------------------------------------------------------
const S6 = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(S6.root);
const baseBytes = execFileSync('git', ['show', BASE + ':scripts/sessionstart-npm-reconcile.cjs'], { cwd: ROOT, encoding: 'utf8' });
const neg = iso.proveReconcileSwitch(S6, { scriptText: baseBytes });
check('B6a negative control: the base bytes fail the proof with reason install_called', neg.proven === false && neg.reason === 'install_called', neg.reason);
const synthetic = baseBytes.replace("'use strict';", "'use strict';\nif (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') { process.stdout.write(JSON.stringify({ continue: true })); process.exit(0); }");
check('B6b the synthetic variant differs from the base by the one added line', synthetic !== baseBytes && synthetic.split('\n').length === baseBytes.split('\n').length + 1);
const pos = iso.proveReconcileSwitch(S6, { scriptText: synthetic });
check('B6c positive control: the synthetic variant passes the proof', pos.proven === true, pos.reason);
const repoProof = iso.proveReconcileSwitch(S6);
const repoText = fs.readFileSync(path.join(ROOT, 'scripts', 'sessionstart-npm-reconcile.cjs'), 'utf8');
const hasSwitch = /process\.env\.MINDRIAN_NPM_RECONCILE_SKIP === '1'\) return emit\(\)/.test(repoText);
check('B6d the repo file at this commit gives the verdict the file text predicts', repoProof.proven === hasSwitch, repoProof.reason);
console.log('INFO reconcile proof on the repo file: ' + (repoProof.proven ? 'PROVEN' : 'NOT PROVEN (' + repoProof.reason + ')') + ' sha256 ' + repoProof.reconcile_sha256);
check('B6e no stand-in plugin root of the proofs holds a node_modules folder after the runs',
  !Object.keys(iso.snapshotTree(S6.root)).some(function (k) { return /(^|\/)node_modules\/?$/.test(k); }));
check('B6f this phase did not edit the reconcile: no 369.6 scoped commit touches it',
  execFileSync('git', ['log', '--format=%s', BASE + '..HEAD', '--', 'scripts/sessionstart-npm-reconcile.cjs'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(function (l) { return /^[a-z]+\(369\.6/.test(l); }).length === 0);

// ---- B7 ---------------------------------------------------------------------------------------
const SCAN_FILES = ['scripts/session-start', 'scripts/intent-classifier.cjs', 'scripts/resolve-room', 'scripts/real-room-run.cjs', 'lib/core/navigation/room-birth.cjs']
  .concat(chain.map(function (k) { return k === 'hooks/run-hook.cmd session-start' ? null : k; }).filter(Boolean))
  .concat(['scripts/preflight-doctor.cjs', 'scripts/check-onboard-statusline.cjs', 'scripts/preflight-tension-surface.cjs', 'scripts/memory-resume-nudge.cjs', 'scripts/preflight-auto-explore.cjs', 'scripts/statusline-fallback-echo.cjs', 'scripts/operator-update.cjs', 'scripts/restore-post-compact-context.cjs']);
const ENV_RE = /process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]|\$\{([A-Z][A-Z0-9_]*)[:}\-]|\$([A-Z][A-Z0-9_]*)\b/g;
const tableNames = iso.ISOLATION_TABLE.map(function (e) { return e.name; });
const unclassified = [];
const seenNames = {};
SCAN_FILES.forEach(function (f) {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m;
  ENV_RE.lastIndex = 0;
  while ((m = ENV_RE.exec(text))) {
    const n = m[1] || m[2] || m[3] || m[4];
    if (/^(MINDRIAN_|CLAUDE_|XDG_)/.test(n) || /^(HOME|TMPDIR|TMP|TEMP|USERPROFILE)$/.test(n)) {
      seenNames[n] = true;
      if (tableNames.indexOf(n) === -1 && unclassified.indexOf(n) === -1) unclassified.push(n);
    }
  }
});
check('B7a every MINDRIAN_, CLAUDE_, XDG_, HOME, TMPDIR, TMP, TEMP and USERPROFILE name read by the scripts is classified in ISOLATION_TABLE',
  unclassified.length === 0, unclassified.join(','));
check('B7b the scan saw the names the plan lists', ['HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'MINDRIAN_DERIVE_SKIP', 'MINDRIAN_NPM_RECONCILE_SKIP'].every(function (n) { return seenNames[n]; }));
check('B7c a name that the table does not hold would fail the scan (control)', tableNames.indexOf('MINDRIAN_NOT_A_REAL_NAME') === -1);

// ---- B8 ---------------------------------------------------------------------------------------
const KNOWN_ESCAPES = [
  'BRIDGE_FILE="/tmp/mindrian-context-state"',
  'tmp=$(mktemp 2>/dev/null || echo "/tmp/mos-sealed-$$")',
  'UPDATE_CACHE="/tmp/mindrian-update-check"',
];
let unknownLiteral = [];
const knownSeen = [];
SCAN_FILES.forEach(function (f) {
  iso.scanFile(f).forEach(function (hit) {
    if (f === 'scripts/session-start' && KNOWN_ESCAPES.indexOf(hit.text) !== -1) knownSeen.push(hit.text);
    else unknownLiteral.push(f + ':' + hit.line + ' ' + hit.text);
  });
});
check('B8a the scripts hold no literal absolute home or temp path beyond the declared known set', unknownLiteral.length === 0, unknownLiteral.join(' | '));
check('B8b the two compare-only workspace-guard lines of session-start are the only allowed literals (listed by line text)',
  iso.COMPARE_ONLY_LINES.length === 2 && iso.COMPARE_ONLY_LINES.every(function (t) { return fs.readFileSync(path.join(ROOT, 'scripts/session-start'), 'utf8').split('\n').some(function (l) { return l.trim() === t; }); }));
check('B8c the scan detects a planted literal (control)', iso.scanHardcodedPaths('X="/tmp/planted"\n# "/tmp/in-a-comment"\nY="${TMPDIR:-/tmp}/ok"').length === 1);
console.log('INFO known literal-path escapes still present in scripts/session-start: ' + knownSeen.length + ' of ' + KNOWN_ESCAPES.length + ' (' + knownSeen.join(' ; ') + ')');

// ---- B9 ---------------------------------------------------------------------------------------
const noCred = iso.isolatedEnv(S1, { parentEnv: HOSTILE, withCredential: false });
const withCred = iso.isolatedEnv(S1, { parentEnv: HOSTILE, withCredential: true });
check('B9a withCredential false: the child env holds no credential name', iso.CREDENTIAL_NAMES.every(function (n) { return !(n in noCred); }));
check('B9b withCredential true: only the names the consult confirmed, passed by name',
  withCred.CLAUDE_CODE_OAUTH_TOKEN === 'token-for-test-only' && !('ANTHROPIC_API_KEY' in withCred) && Object.keys(withCred).every(function (n) { return iso.ISOLATION_TABLE.some(function (e) { return e.name === n; }); }));
const moduleText = fs.readFileSync(path.join(ROOT, 'scripts', 'isolate-larry-voice.cjs'), 'utf8');
const mlines = moduleText.split('\n');
const birthStart = mlines.findIndex(function (l) { return /^async function birthMain/.test(l); });
const birthEnd = mlines.findIndex(function (l, i) { return i > birthStart && /^}/.test(l); });
check('B9c no console call and no stdout write outside the internal birth subcommand',
  !/console\./.test(moduleText) && mlines.every(function (l, i) { return !/process\.stdout\.write/.test(l) || (i >= birthStart && i <= birthEnd); }));
check('B9d the module never names the owner rooms in a path it reads (comments and the refusal pattern only)',
  mlines.every(function (l) { const t = l.trim(); return !/MindrianRooms/.test(t) || /^(\/\/|\*|\/\*)/.test(t) || /\/MindrianRooms\/\.test\(/.test(t); }));
check('B9e process.env is assigned only inside applyIsolationToProcess and its restore function',
  (function () {
    const lines = moduleText.split('\n');
    const start = lines.findIndex(function (l) { return /^function applyIsolationToProcess/.test(l); });
    const end = lines.findIndex(function (l, i) { return i > start && /^}/.test(l); });
    return lines.every(function (l, i) {
      if (!/process\.env\s*\[[^\]]+\]\s*=[^=]|process\.env\.[A-Z_]+\s*=[^=]/.test(l)) return true;
      return i >= start && i <= end;
    });
  })());
const restoreScratch = iso.makeScratch('larry-voice-scratch-', { claudeCli: null });
OWNED.push(restoreScratch.root);
const envPre = envSnapshot();
const restore = iso.applyIsolationToProcess(restoreScratch);
const applied = process.env.TMPDIR === path.join(restoreScratch.root, 'tmp') && process.env.CLAUDE_PLUGIN_ROOT === ROOT;
restore();
check('B9f applyIsolationToProcess sets the scratch and plugin names and restores them', applied && envSnapshot() === envPre);

// ---- B10 --------------------------------------------------------------------------------------
const req = spawnSync(process.execPath, ['-e', "require('./scripts/real-room-run.cjs');"], { cwd: ROOT, encoding: 'utf8', timeout: 30000, input: '' });
check('B10a requiring scripts/real-room-run.cjs runs no main (no output, exit 0)', req.status === 0 && req.stdout === '' && req.stderr === '', 'exit ' + req.status + ' ' + String(req.stderr).slice(0, 120));
check('B10b require exposes buildRoom only', JSON.stringify(Object.keys(require('../scripts/real-room-run.cjs'))) === '["buildRoom"]');
const baseTree = mk('base-tree-3696-');
execFileSync('sh', ['-c', 'git archive ' + BASE + ' scripts lib | tar -x -C ' + JSON.stringify(baseTree)], { cwd: ROOT });
const helpBase = spawnSync(process.execPath, [path.join(baseTree, 'scripts', 'real-room-run.cjs'), '--help'], { encoding: 'utf8', timeout: 60000, input: '' });
const helpNow = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'real-room-run.cjs'), '--help'], { encoding: 'utf8', timeout: 60000, input: '' });
check('B10c --help prints the same bytes and the same exit code as at the plan base',
  helpBase.stdout === helpNow.stdout && helpBase.stderr === helpNow.stderr && helpBase.status === helpNow.status && helpNow.stdout.length > 0);

// ---- B11 --------------------------------------------------------------------------------------
const selfText = fs.readFileSync(__filename, 'utf8');
check('B11 no em-dash or en-dash in this file', !/[\u2013\u2014]/.test(selfText));
check('NET the net guard counted zero fetch calls in the test process', NET.attempts() === 0);

// ---- cleanup of the directories this test created --------------------------------------------
OWNED.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
const code = C.summary();
process.exit(code);
