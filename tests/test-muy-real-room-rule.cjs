#!/usr/bin/env node
'use strict';
/*
 * Quick 261005-muy -- the real-room release rule (navigator ruling 2026-10-05:
 * "No cut without a real-room run read by a human").
 *
 * WHY THIS TEST EXISTS. Phase 369 regressed silently because no cut was read by a human on a real
 * room. release.sh now refuses a cut at Step 2.6 unless a receipt for the exact HEAD sha exists,
 * written only by scripts/real-room-run.cjs after a person passed --read-by.
 *
 * Arms:
 *   G1  gate, empty receipt dir       refuses, names `node scripts/real-room-run.cjs --read-by "<your name>"`
 *   G2  gate, receipt for another sha refuses, shows both shas (also a mislabelled file)
 *   G3  gate, receipt for HEAD        passes, prints the reader and the four counts
 *   G4  gate, desktop leg             WARN naming desktop when absent, none when mac is set
 *   G5  gate, audited opt-out         passes with a line naming the flag and the consequence
 *   G6  real-room-run --offline       births a room through the chokepoint, prints the report, no receipt
 *   G7  real-room-run --read-by       writes the receipt; --desktop-verified updates only that leg;
 *                                     an offline receipt is refused by the gate
 *   G8  doctor                        a real-room-run acceptance point (warn when absent, ok when equal)
 *   G9  release.sh                    Step 2.6 sits after Step 2.5 and before Step 3; dry-run reports; opt-out
 *   G10 text                          dash guard, CHANGELOG, RULE 10, the include line
 *
 * Isolation: every spawn gets HOME and USERPROFILE in a temp dir; the rooms home and the receipt dir
 * are temp dirs; --offline everywhere; the Theo stamp reader is stubbed for the dry-run arm. Nothing
 * here touches ~/MindrianRooms, ~/.mindrian or the network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GATE_LIB = path.join(ROOT, 'scripts', 'release-lib', 'real-room-gate.sh');
const RUN_SCRIPT = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'muy-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

const HOME = mk('home');
function envFor(extra) {
  const env = Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME }, extra || {});
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  delete env.TAVILY_API_KEY;
  return env;
}
function git(args) {
  return cp.spawnSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8' }).stdout.trim();
}
const HEAD = git(['rev-parse', 'HEAD']);
const VERSION = cp.spawnSync(process.execPath, [path.join(ROOT, 'lib', 'core', 'repo-version.cjs')], { encoding: 'utf8' }).stdout.trim();

// -- the gate, sourced the way release.sh sources it ----------------------------------------------
function runGate(receiptDir, dry, noCheck) {
  const r = cp.spawnSync('bash', ['-c', '. "$LIB" && mos_real_room_gate "$ROOT" ' + (dry ? 1 : 0) + ' ' + (noCheck ? 1 : 0)], {
    env: envFor({ LIB: GATE_LIB, ROOT: ROOT, MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir }),
    encoding: 'utf8', timeout: 60000,
  });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}
function counts(over) {
  return Object.assign({ n: 1 }, over || {});
}
function receiptFor(sha, over) {
  return Object.assign({
    schema: 'mos.real-room-receipt/1',
    sha: sha,
    version: VERSION,
    room: 'release-fixture-' + sha.slice(0, 8),
    reader: 'Test Reader',
    read_at: '2026-10-05T12:00:00.000Z',
    offline: false,
    perspectives: {
      quick: { status: 'ran', counts: counts({ rows: 4 }) },
      deep: { status: 'ran', counts: counts({ rows: 7 }) },
      eureka: { status: 'ran', counts: counts({ candidates: 11 }) },
      analogies: { status: 'ran', counts: counts({ pairs: 13 }) },
    },
    providers: { tavily: 'absent', openalex: 'reachable' },
    desktop_verified: { mac: null, win: null },
  }, over || {});
}
function putReceipt(dir, sha, over) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, sha + '.json'), JSON.stringify(receiptFor(sha, over), null, 2));
}
const OTHER = HEAD.split('').reverse().join('');

// ---------------------------------------------------------------------------
// G1 - G5: the gate
// ---------------------------------------------------------------------------
arm('G1 gate with an empty receipt dir refuses and names the run command', () => {
  const dir = mk('g1');
  const r = runGate(dir, false, false);
  check(r.code !== 0, 'gate passed with no receipt: ' + r.out);
  check(r.out.indexOf('node scripts/real-room-run.cjs --read-by "<your name>"') !== -1, 'no recovery command in: ' + r.out);
});

arm('G2 a receipt for another sha is refused and both shas are shown', () => {
  const dir = mk('g2');
  putReceipt(dir, OTHER);
  const r = runGate(dir, false, false);
  check(r.code !== 0, 'gate passed on a receipt for another sha: ' + r.out);
  check(r.out.indexOf(HEAD.slice(0, 12)) !== -1 && r.out.indexOf(OTHER.slice(0, 12)) !== -1, 'both shas not shown in: ' + r.out);
  // a file named for HEAD whose content names another sha is refused too
  const dir2 = mk('g2b');
  fs.mkdirSync(dir2, { recursive: true });
  fs.writeFileSync(path.join(dir2, HEAD + '.json'), JSON.stringify(receiptFor(OTHER)));
  const r2 = runGate(dir2, false, false);
  check(r2.code !== 0, 'gate passed on a mislabelled receipt: ' + r2.out);
  check(r2.out.indexOf(OTHER.slice(0, 12)) !== -1, 'mislabelled receipt sha not shown: ' + r2.out);
});

arm('G3 a receipt for HEAD with a reader and four blocks passes and prints the reader and the four counts', () => {
  const dir = mk('g3');
  putReceipt(dir, HEAD);
  const r = runGate(dir, false, false);
  check(r.code === 0, 'gate refused a good receipt: ' + r.out);
  check(r.out.indexOf('Test Reader') !== -1, 'reader not printed: ' + r.out);
  ['quick', 'deep', 'eureka', 'analogies'].forEach((k) => check(r.out.indexOf(k) !== -1, k + ' block not printed: ' + r.out));
  ['4', '7', '11', '13'].forEach((n) => check(new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(r.out), 'count ' + n + ' not printed: ' + r.out));
  // an invalid receipt is refused: no reader, a missing block
  const dirNoReader = mk('g3b');
  putReceipt(dirNoReader, HEAD, { reader: '' });
  check(runGate(dirNoReader, false, false).code !== 0, 'gate passed a receipt with no reader');
  const dirNoBlock = mk('g3c');
  const bad = receiptFor(HEAD); delete bad.perspectives.analogies;
  fs.mkdirSync(dirNoBlock, { recursive: true });
  fs.writeFileSync(path.join(dirNoBlock, HEAD + '.json'), JSON.stringify(bad));
  check(runGate(dirNoBlock, false, false).code !== 0, 'gate passed a receipt with a missing perspective block');
});

arm('G4 no desktop leg prints a WARN naming desktop; a set leg prints none', () => {
  const dir = mk('g4');
  putReceipt(dir, HEAD);
  const r = runGate(dir, false, false);
  const warn = r.out.split('\n').filter((l) => /WARN/.test(l) && /desktop/i.test(l));
  check(r.code === 0 && warn.length >= 1, 'no WARN desktop line (code ' + r.code + '): ' + r.out);
  const dir2 = mk('g4b');
  putReceipt(dir2, HEAD, { desktop_verified: { mac: '2026-10-05T12:30:00.000Z', win: null } });
  const r2 = runGate(dir2, false, false);
  check(r2.code === 0, 'gate refused: ' + r2.out);
  check(!/WARN/.test(r2.out), 'a WARN printed with the mac leg set: ' + r2.out);
});

arm('G5 the audited opt-out passes and names the flag and the consequence; dry-run reports without aborting', () => {
  const dir = mk('g5');
  const r = runGate(dir, false, true);
  check(r.code === 0, 'opt-out did not pass: ' + r.out);
  check(r.out.indexOf('--no-real-room-check') !== -1, 'flag not named: ' + r.out);
  check(r.out.indexOf('nothing proves this cut ran on a room') !== -1, 'consequence not named: ' + r.out);
  const d = runGate(dir, true, false);
  check(d.code === 0, 'dry-run aborted: ' + d.out);
  check(d.out.indexOf('[DRY RUN]') !== -1 && d.out.indexOf('would ABORT') !== -1, 'dry-run did not report the verdict: ' + d.out);
});

// ---------------------------------------------------------------------------
// G6 - G7: the run script (offline everywhere)
// ---------------------------------------------------------------------------
const RUN_HOMES = mk('runhomes');
const RUN_ROOMS = path.join(RUN_HOMES, 'rooms');
const RUN_RECEIPTS = path.join(RUN_HOMES, 'receipts');
function runScript(args, extraEnv) {
  const r = cp.spawnSync(process.execPath, [RUN_SCRIPT].concat(args), { env: envFor(extraEnv), encoding: 'utf8', timeout: 180000, cwd: ROOT });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

arm('G6 real-room-run --offline births a room through the chokepoint and prints the four-section report, no receipt', () => {
  const r = runScript(['--offline', '--rooms-home', RUN_ROOMS, '--receipt-dir', RUN_RECEIPTS]);
  check(r.code === 0, 'exit ' + r.code + ': ' + r.err.slice(-400));
  const slug = 'release-fixture-' + HEAD.slice(0, 8);
  check(fs.existsSync(path.join(RUN_ROOMS, slug, '.mindrian', 'room.db')), 'room.db missing under ' + slug);
  const reg = JSON.parse(fs.readFileSync(path.join(RUN_ROOMS, '.rooms', 'registry.json'), 'utf8'));
  check(reg.rooms && reg.rooms[slug], 'registry does not list ' + slug + ': ' + Object.keys(reg.rooms || {}));
  ['Quick', 'Deep', 'Eureka', 'Analogies'].forEach((h) => check(new RegExp('^== ' + h, 'm').test(r.out), 'section header ' + h + ' missing in: ' + r.out.slice(0, 600)));
  const lanes = r.out.split('\n').filter((l) => /^\s*lane /.test(l));
  check(lanes.length >= 4, 'fewer than four lane lines: ' + lanes.join(' | '));
  const bad = lanes.filter((l) => !/\b(ran|empty|provider absent)\b/.test(l));
  check(bad.length === 0, 'lane lines with no ran/empty/provider absent: ' + bad.join(' | '));
  check(/offline \(not fetched\)/.test(r.out), 'offline run did not mark the web lines not fetched');
  check(/NO RECEIPT written/.test(r.out), 'no "no receipt" line');
  check(!fs.existsSync(RUN_RECEIPTS) || fs.readdirSync(RUN_RECEIPTS).filter((f) => /\.json$/.test(f)).length === 0, 'a receipt was written without --read-by');
});

arm('G6b real-room-run refuses a rooms home under the real ~/MindrianRooms', () => {
  const r = runScript(['--offline', '--rooms-home', path.join(HOME, 'MindrianRooms', 'x'), '--receipt-dir', RUN_RECEIPTS]);
  check(r.code === 2 && /rooms_home_is_real_rooms/.test(r.err), 'expected exit 2 rooms_home_is_real_rooms, got ' + r.code + ': ' + r.err);
});

arm('G7 --read-by writes the receipt; --desktop-verified updates only that leg; the gate refuses an offline receipt', () => {
  const r = runScript(['--offline', '--read-by', 'Test Reader', '--rooms-home', RUN_ROOMS, '--receipt-dir', RUN_RECEIPTS]);
  check(r.code === 0, 'exit ' + r.code + ': ' + r.err.slice(-400));
  const file = path.join(RUN_RECEIPTS, HEAD + '.json');
  check(fs.existsSync(file), 'receipt ' + file + ' not written');
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(rec.sha === HEAD, 'sha ' + rec.sha);
  check(rec.version === VERSION, 'version ' + rec.version + ' vs ' + VERSION);
  check(rec.reader === 'Test Reader', 'reader ' + rec.reader);
  check(typeof rec.read_at === 'string' && !Number.isNaN(Date.parse(rec.read_at)), 'read_at ' + rec.read_at);
  ['quick', 'deep', 'eureka', 'analogies'].forEach((k) => {
    const b = rec.perspectives && rec.perspectives[k];
    check(b && b.counts && typeof b.counts === 'object', k + ' block has no counts');
    const vals = Object.keys(b.counts).map((c) => b.counts[c]);
    check(vals.length > 0 && vals.every((v) => typeof v === 'number' && Number.isFinite(v)), k + ' counts are not all numeric: ' + JSON.stringify(b.counts));
  });
  check(rec.providers && typeof rec.providers.tavily === 'string' && typeof rec.providers.openalex === 'string', 'providers ' + JSON.stringify(rec.providers));
  check(rec.desktop_verified && rec.desktop_verified.mac === null && rec.desktop_verified.win === null, 'desktop_verified ' + JSON.stringify(rec.desktop_verified));
  check(rec.offline === true, 'an --offline receipt must say offline: ' + rec.offline);

  // the gate refuses it: an offline run proves nothing about the web lines
  const g = runGate(RUN_RECEIPTS, false, false);
  check(g.code !== 0 && /offline/i.test(g.out), 'gate did not refuse an offline receipt: ' + g.out);

  const dv = runScript(['--desktop-verified', 'mac', '--receipt-dir', RUN_RECEIPTS]);
  check(dv.code === 0, 'desktop-verified exit ' + dv.code + ': ' + dv.err);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(typeof after.desktop_verified.mac === 'string' && !Number.isNaN(Date.parse(after.desktop_verified.mac)), 'mac not an ISO time: ' + after.desktop_verified.mac);
  const strip = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.desktop_verified.mac; return c; };
  check(JSON.stringify(strip(after)) === JSON.stringify(strip(rec)), 'something besides desktop_verified.mac changed');

  const none = runScript(['--desktop-verified', 'win', '--receipt-dir', mk('norec')]);
  check(none.code === 2 && /no_receipt_for_head/.test(none.err), 'expected exit 2 no_receipt_for_head, got ' + none.code + ': ' + none.err);
});

// ---------------------------------------------------------------------------
// G8: the doctor point
// ---------------------------------------------------------------------------
function doctorPoint(receiptDir) {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--json'], {
    env: envFor({ DOCTOR_TEST_MODE: '1', DOCTOR_TEST_ONLY_POINTS: 'real-room-run', MINDRIAN_ACCEPTANCE_PROGRESS: '0', MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir }),
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
  });
  const at = String(r.stdout || '').indexOf('{');
  check(at !== -1, 'doctor printed no JSON; exit=' + r.status + ' stderr=' + String(r.stderr || '').slice(-300));
  const json = JSON.parse(r.stdout.slice(at));
  const pt = (json.points || []).find((p) => /real-room-run/.test(p.id));
  check(pt, 'no real-room-run point in ' + JSON.stringify((json.points || []).map((p) => p.id)));
  return pt;
}
arm('G8 doctor carries a real-room-run point: warns when no receipt, ok when the latest equals HEAD', () => {
  const absent = doctorPoint(mk('g8a'));
  check(absent.ok === true && /WARN/.test(String(absent.finding)) && /real-room-run\.cjs/.test(String(absent.finding)), 'absent: ' + JSON.stringify(absent));
  const behind = mk('g8b');
  putReceipt(behind, OTHER);
  const b = doctorPoint(behind);
  check(b.ok === true && /WARN/.test(String(b.finding)), 'behind: ' + JSON.stringify(b));
  const equal = mk('g8c');
  putReceipt(equal, HEAD);
  const e = doctorPoint(equal);
  check(e.ok === true && !e.finding && e.detail && e.detail.latest_sha === HEAD, 'equal: ' + JSON.stringify(e));
});

// ---------------------------------------------------------------------------
// G9: release.sh wiring
// ---------------------------------------------------------------------------
function dryRun(extraArgs, receiptDir) {
  const r = cp.spawnSync('bash', [path.join(ROOT, 'scripts', 'release.sh'), '--dry-run', '--prerelease'].concat(extraArgs || []), {
    env: envFor({ MINDRIAN_THEO_STAMP_CMD: 'echo command-registry@0.0.0-stub', MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir }),
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
  });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}
arm('G9 release.sh --dry-run lists Step 2.6 after Step 2.5 and before Step 3, reports, and honors the opt-out', () => {
  const r = dryRun([], mk('g9a'));
  check(r.code === 0, 'dry-run exit ' + r.code + ': ' + r.out.slice(-600));
  const steps = r.out.split('\n').map((l) => /^\s*(?:=== )?Step (\d+(?:\.\d+)?[a-z]?)\b/.exec(l)).filter(Boolean).map((m) => m[1]);
  const i25 = steps.indexOf('2.5'); const i26 = steps.indexOf('2.6'); const i3 = steps.indexOf('3');
  check(i25 !== -1 && i26 !== -1 && i3 !== -1, 'steps found: ' + steps.join(','));
  check(i25 < i26 && i26 < i3, 'Step 2.6 is not between 2.5 and 3: ' + steps.join(','));
  check(/real-room-gate: .*\[DRY RUN\]|\[DRY RUN\] real-room-gate/.test(r.out), 'dry-run did not report the gate verdict: ' + r.out.slice(-1200));
  const off = dryRun(['--no-real-room-check'], mk('g9b'));
  check(off.code === 0 && off.out.indexOf('--no-real-room-check') !== -1 && off.out.indexOf('nothing proves this cut ran on a room') !== -1, 'opt-out line missing: ' + off.out.slice(-800));
  const help = cp.spawnSync('bash', [path.join(ROOT, 'scripts', 'release.sh'), '--help'], { encoding: 'utf8', env: envFor() });
  check(String(help.stdout).indexOf('--no-real-room-check') !== -1, 'usage block does not list --no-real-room-check');
});

arm('G9b release.sh real path: the lib is sourced in the preamble and Step 2.6 aborts before Step 3', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'release.sh'), 'utf8');
  const lib = src.indexOf('real-room-gate.sh');
  const parse = src.indexOf('--no-real-room-check)');
  const step26 = src.indexOf('# --- Step 2.6');
  const step3 = src.indexOf('# --- Step 3:');
  check(lib !== -1 && lib < src.indexOf('# --- Step 0:'), 'real-room-gate.sh not sourced in the preamble');
  check(parse !== -1, 'flag not parsed');
  check(step26 !== -1 && step26 > src.indexOf('# --- Step 2.5') && step26 < step3, 'Step 2.6 block not between Step 2.5 and Step 3');
  const block = src.slice(step26, step3);
  check(/mos_real_room_gate "\$PLUGIN_DIR" "\$DRY_RUN" "\$NO_REAL_ROOM_CHECK"/.test(block), 'Step 2.6 does not call the gate with the dry-run and opt-out variables');
  check(/exit 1/.test(block), 'Step 2.6 has no abort');
});

// ---------------------------------------------------------------------------
// G10: the words
// ---------------------------------------------------------------------------
function hasDash(s) { return s.indexOf(EM) !== -1 || s.indexOf(EN) !== -1; }
function unreleased() {
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const u = cl.indexOf('## [Unreleased]');
  if (u === -1) return '';
  const next = cl.indexOf('\n## [', u + 5);
  return cl.slice(u, next === -1 ? cl.length : next);
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}
arm('G10a no em or en dash in the files and lines this task added', () => {
  const bad = [];
  const files = [__filename, RUN_SCRIPT, GATE_LIB].concat(walk(path.join(ROOT, 'tests', 'fixtures', 'release-room'), []));
  files.forEach((f) => { if (fs.existsSync(f) && hasDash(fs.readFileSync(f, 'utf8'))) bad.push(path.relative(ROOT, f)); });
  unreleased().split('\n').forEach((l) => { if (/Real-room release rule/.test(l) && hasDash(l)) bad.push('CHANGELOG.md: ' + l.slice(0, 80)); });
  const ruling = path.join(ROOT, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md');
  const rt = fs.readFileSync(ruling, 'utf8');
  const at = rt.indexOf('## RULE 10');
  if (at !== -1 && hasDash(rt.slice(at, rt.indexOf('\n---', at) === -1 ? rt.length : rt.indexOf('\n---', at)))) bad.push('docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 10');
  const rel = fs.readFileSync(path.join(ROOT, 'scripts', 'release.sh'), 'utf8');
  const s26 = rel.indexOf('# --- Step 2.6');
  if (s26 !== -1 && hasDash(rel.slice(s26, rel.indexOf('# --- Step 3:')))) bad.push('scripts/release.sh Step 2.6');
  check(bad.length === 0, 'dash found in: ' + bad.join(' | '));
});
arm('G10b CHANGELOG [Unreleased] names the real-room release rule', () => {
  const sec = unreleased();
  check(/Real-room release rule/.test(sec) && /Step 2\.6/.test(sec) && /scripts\/real-room-run\.cjs/.test(sec) && /real-room-run/.test(sec) && /Desktop/.test(sec), 'Unreleased lacks the real-room entry');
});
arm('G10c the ruling system carries RULE 10 naming the step, the receipt, the opt-out and the Desktop leg', () => {
  const rt = fs.readFileSync(path.join(ROOT, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md'), 'utf8');
  const at = rt.indexOf('## RULE 10');
  check(at !== -1, 'no ## RULE 10 heading');
  const sec = rt.slice(at, rt.indexOf('\n---', at) === -1 ? rt.length : rt.indexOf('\n---', at));
  check(/No cut without a real-room run read by a human/.test(sec), 'RULE 10 title');
  ['Step 2.6', 'real-room-run.cjs', '--read-by', '--no-real-room-check', '--desktop-verified', 'receipt'].forEach((w) => check(sec.indexOf(w) !== -1, 'RULE 10 does not mention ' + w));
});
arm('G10d the release-process include points at RULE 10', () => {
  const inc = fs.readFileSync(path.join(ROOT, '.claude', 'includes', 'release-process.md'), 'utf8');
  check(/real-room/i.test(inc) && /RULE 10/.test(inc) && /Step 2\.6/.test(inc), 'include does not name the real-room rule, Step 2.6 and RULE 10');
});

console.log('\ntest-muy-real-room-rule: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
