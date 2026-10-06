'use strict';
/*
 * Phase 369.25 plan 12 -- FEYM-02, FEYM-07: FeyMinto keyed to the room.db identity, and the moved budgets.
 *
 * RED first: this file is committed before feynman-minto-invariants.cjs knows FEYNMINTO-11 / FEYNMINTO-12 and
 * before lib/memory/validators/room-identity-invariants.cjs exists. Arms:
 *   V1  negative fixture (a born room with its seven room.* keys deleted): the room validator returns exactly one
 *       violation, category identity, severity error, action_hint repair_room_identity, FEYNMINTO-11 + identity_missing
 *   V2  ready room, MINTO.md says `room: <slug>`: one critical FEYNMINTO-11 per such nest, action_hint regenerate_face
 *   V3  ready room, MINTO.md says `room: <room_id>`: no MINTO-keyed violation (no critical, none on field room)
 *   V4  repair V1, key the faces, `guardian on-stop` (child process, isolated HOME): before the repair the report
 *       lists the V1 violation, after it zero room-identity-invariants violations
 *   V5  validateFeynmanBudget: 6004-byte FEYNMAN body (1501 tokens) fails FEYNMINTO-01, 6000 bytes does not
 *   V6  validate on MINTO.md: 2001 tokens FEYNMINTO-12 with 'budget exceeded', 2000 none; the writers' tmp name
 *       MINTO.md.tmp.<pid>.minto gets the same contract; explored-draft-x.md still gets FEYNMINTO-01
 *   V7  validateFaceRoomId on FEYNMAN.md and BRAIN.md: equal none, missing warning, different critical
 *   V8  source check: the module requires only node:fs and node:path; dash guard
 *   V9  guardian session-start on the V2 room enqueues a regeneration for each mis-keyed nest (reason
 *       guardian:identity-repair); on the not-ready V1 room it enqueues none under that reason (T-369.25-12-02)
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
const failedNames = [];
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    failedNames.push(name);
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

const INVARIANTS = path.join(ROOT, 'lib', 'core', 'feynman-minto-invariants.cjs');
const ROOM_VALIDATOR = path.join(ROOT, 'lib', 'memory', 'validators', 'room-identity-invariants.cjs');
const GUARDIAN = path.join(ROOT, 'scripts', 'feynman-minto-guardian.cjs');

function inv() { return require(INVARIANTS); }
function roomValidator() { return require(ROOM_VALIDATOR); }
function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function identityMod() { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')); }

// ---- fixtures ----------------------------------------------------------------------------------------------

// A born room with its identity stripped (the 7 rows that name nothing stay), the rid-repair legacyRoom shape.
function strippedRoom(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'fi-' + tag;
  const b = H.birthFixtureRoom({ iso, slug });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  const db = nav().openRoomDbForCaller(roomDir);
  try {
    db.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run();
    db.prepare('DELETE FROM nodes WHERE id = ?').run('room:' + slug);
  } finally { nav().closeRoomDbForCaller(db); }
  return { iso, roomDir, slug };
}

// A born (ready) room.
function readyRoom(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'fi-' + tag;
  const b = H.birthFixtureRoom({ iso, slug });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  return { iso, roomDir, slug, room_id: b.room_id };
}

function mintoText(roomVal, bodyBytes) {
  const lines = [
    '---',
    'schema_version: "1.0"',
    'governing_thought: "The venture compresses insight into a decision."',
    'last_generated_at: "' + new Date().toISOString() + '"',
  ];
  if (roomVal !== null) lines.push('room: ' + roomVal);
  lines.push('---');
  const head = lines.join('\n') + '\n';
  return head + 'a'.repeat(bodyBytes || 200);
}

function faceText(roomIdVal, bodyBytes) {
  const lines = ['---'];
  if (roomIdVal !== null) lines.push('room_id: ' + roomIdVal);
  lines.push('---');
  return lines.join('\n') + '\n' + 'b'.repeat(bodyBytes || 100);
}

function writeIn(dir, name, text) {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

const NESTS = ['problem-definition', 'market-analysis'];

function runGuardian(mode, r) {
  const res = spawnSync(process.execPath, [GUARDIAN, mode, r.roomDir], {
    env: r.iso.env, encoding: 'utf8', timeout: 60000,
  });
  return res;
}

function readReport(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'invariant-report.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function roomViolations(report) {
  const sec = report && report.sections && report.sections.__room__;
  const all = (sec && sec.violations) || [];
  return all.filter((v) => v.validator === 'room-identity-invariants');
}

function queueEntries(roomDir) {
  const p = path.join(roomDir, '.mindrian', 'minto-queue.json');
  if (!fs.existsSync(p)) return [];
  const q = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(q.entries) ? q.entries : [];
}

// ---- arms --------------------------------------------------------------------------------------------------

arm('V1 negative fixture: one room-level identity violation, repair_room_identity', () => {
  const r = strippedRoom('v1');
  const out = roomValidator().validate(r.roomDir, { roomDir: r.roomDir, kind: 'on-stop', now: Date.now() });
  const v = out.violations;
  eq(v.length, 1, 'violation count');
  eq(v[0].category, 'identity', 'category');
  eq(v[0].severity, 'error', 'severity');
  eq(v[0].action_hint, 'repair_room_identity', 'action_hint');
  check(/FEYNMINTO-11/.test(v[0].message), 'message names FEYNMINTO-11: ' + v[0].message);
  check(/identity_missing/.test(v[0].message), 'message names identity_missing: ' + v[0].message);
  eq(v[0].validator, 'room-identity-invariants', 'validator tag');
});

arm('V2 ready room, MINTO says room: <slug>: one critical FEYNMINTO-11 per nest, regenerate_face', () => {
  const r = readyRoom('v2');
  NESTS.forEach((n) => writeIn(path.join(r.roomDir, n), 'MINTO.md', mintoText(r.slug, 200)));
  const out = roomValidator().validate(r.roomDir, { roomDir: r.roomDir, kind: 'on-stop', now: Date.now() });
  const crit = out.violations.filter((v) => v.severity === 'critical' && v.category === 'identity');
  eq(crit.length, NESTS.length, 'critical identity violations');
  eq(crit.map((v) => v.section).sort(), NESTS.slice().sort(), 'sections named');
  crit.forEach((v) => {
    eq(v.action_hint, 'regenerate_face', 'action_hint');
    check(/FEYNMINTO-11/.test(v.message), 'message names FEYNMINTO-11: ' + v.message);
  });
  eq(out.severity, 'critical', 'aggregate severity');
});

arm('V3 ready room, MINTO says room: <room_id>: no MINTO-keyed violation', () => {
  const r = readyRoom('v3');
  NESTS.forEach((n) => writeIn(path.join(r.roomDir, n), 'MINTO.md', mintoText(r.room_id, 200)));
  const out = roomValidator().validate(r.roomDir, { roomDir: r.roomDir, kind: 'on-stop', now: Date.now() });
  eq(out.violations.filter((v) => v.severity === 'critical').length, 0, 'critical violations');
  eq(out.violations.filter((v) => v.field === 'room').length, 0, 'violations on field room');
});

arm('V4 repair then guardian on-stop: the report loses the room-identity violation', () => {
  const r = strippedRoom('v4');
  NESTS.forEach((n) => writeIn(path.join(r.roomDir, n), 'MINTO.md', mintoText(r.slug, 200)));
  const before = runGuardian('on-stop', r);
  check(before.status === 0, 'on-stop exit ' + before.status + ' ' + before.stderr);
  const repBefore = readReport(r.roomDir);
  check(repBefore, 'no invariant-report.json before the repair');
  const vb = roomViolations(repBefore);
  check(vb.length === 1 && /identity_missing/.test(vb[0].message), 'before: expected the V1 violation, got ' + JSON.stringify(vb));

  const rep = identityMod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925-12', roomsHome: r.iso.roomsHome });
  check(rep && rep.ok === true, 'repair: ' + JSON.stringify(rep));
  const ident = identityMod().readRoomIdentity(r.roomDir, { door: 'in_place', roomsHome: r.iso.roomsHome });
  check(ident.ok === true, 'identity not ready after repair: ' + JSON.stringify(ident));
  // the faces keyed to the id room.db now holds (MINTO, and FEYNMAN for every nest that has one)
  fs.readdirSync(r.roomDir, { withFileTypes: true }).forEach((e) => {
    if (!e.isDirectory() || e.name[0] === '.') return;
    const d = path.join(r.roomDir, e.name);
    if (fs.existsSync(path.join(d, 'MINTO.md'))) writeIn(d, 'MINTO.md', mintoText(ident.room_id, 200));
    if (fs.existsSync(path.join(d, 'FEYNMAN.md'))) writeIn(d, 'FEYNMAN.md', faceText(ident.room_id, 100));
  });
  const after = runGuardian('on-stop', r);
  check(after.status === 0, 'on-stop exit ' + after.status + ' ' + after.stderr);
  const va = roomViolations(readReport(r.roomDir));
  eq(va.length, 0, 'room-identity-invariants violations after the repair: ' + JSON.stringify(va));
});

arm('V5 validateFeynmanBudget: 1501 tokens fails FEYNMINTO-01, 1500 does not', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '36925-v5-'));
  try {
    const over = writeIn(path.join(d, 'a'), 'FEYNMAN.md', faceText('x', 6004));
    const at = writeIn(path.join(d, 'b'), 'FEYNMAN.md', faceText('x', 6000));
    const ro = inv().validateFeynmanBudget(over);
    check(ro.valid === false && ro.violations.some((v) => /FEYNMINTO-01/.test(v.message) && /budget exceeded/.test(v.message)),
      'over: ' + JSON.stringify(ro));
    const ra = inv().validateFeynmanBudget(at);
    eq(ra.violations.length, 0, 'at the cap');
    eq(ra.valid, true, 'valid at the cap');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

arm('V6 validate: MINTO.md 2001 tokens FEYNMINTO-12, 2000 none, tmp name same, draft keeps FEYNMINTO-01', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '36925-v6-'));
  try {
    const budget = (r) => r.violations.filter((v) => /budget exceeded/i.test(v.message));
    const m2001 = writeIn(path.join(d, 'a'), 'MINTO.md', mintoText(null, 8004));
    const r1 = inv().validate(m2001);
    check(budget(r1).length === 1 && /FEYNMINTO-12/.test(budget(r1)[0].message), 'MINTO 2001: ' + JSON.stringify(budget(r1)));
    const m2000 = writeIn(path.join(d, 'b'), 'MINTO.md', mintoText(null, 8000));
    eq(budget(inv().validate(m2000)).length, 0, 'MINTO at 2000 tokens');
    const m1501 = writeIn(path.join(d, 'c'), 'MINTO.md', mintoText(null, 6004));
    eq(budget(inv().validate(m1501)).length, 0, 'MINTO at 1501 tokens (the old cap no longer applies)');
    const tmp = writeIn(path.join(d, 'e'), 'MINTO.md.tmp.4242.minto', mintoText(null, 6004));
    eq(budget(inv().validate(tmp)).length, 0, 'the writers tmp name at 1501 tokens');
    const tmpOver = writeIn(path.join(d, 'f'), 'MINTO.md.tmp.4242.minto', mintoText(null, 8004));
    const rt = budget(inv().validate(tmpOver));
    check(rt.length === 1 && /FEYNMINTO-12/.test(rt[0].message), 'tmp name at 2001: ' + JSON.stringify(rt));
    const draft = writeIn(path.join(d, 'g'), 'explored-draft-x.md', mintoText(null, 6004));
    const rd = budget(inv().validate(draft));
    check(rd.length === 1 && /FEYNMINTO-01/.test(rd[0].message), 'draft at 1501: ' + JSON.stringify(rd));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

arm('V7 validateFaceRoomId on FEYNMAN.md and BRAIN.md: equal, missing, different', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '36925-v7-'));
  const ident = { ok: true, state: 'ready', room_id: '11111111-2222-3333-4444-555555555555' };
  try {
    ['FEYNMAN.md', 'BRAIN.md'].forEach((name, i) => {
      const eqP = writeIn(path.join(d, 'eq' + i), name, faceText(ident.room_id));
      const noP = writeIn(path.join(d, 'no' + i), name, faceText(null));
      const dfP = writeIn(path.join(d, 'df' + i), name, faceText('99999999-2222-3333-4444-555555555555'));
      const re = inv().validateFaceRoomId(eqP, ident);
      eq(re.violations.length, 0, name + ' equal');
      eq(re.valid, true, name + ' equal valid');
      const rn = inv().validateFaceRoomId(noP, ident);
      check(rn.violations.length === 1 && rn.violations[0].severity === 'warning' &&
        /face not yet keyed to the room id/.test(rn.violations[0].message), name + ' missing: ' + JSON.stringify(rn));
      const rd = inv().validateFaceRoomId(dfP, ident);
      check(rd.violations.length === 1 && rd.violations[0].severity === 'critical' &&
        rd.violations[0].action_hint === 'regenerate_face', name + ' different: ' + JSON.stringify(rd));
      eq(rd.severity, 'critical', name + ' aggregate');
    });
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

arm('V8 source check: the invariants module requires only node:fs and node:path; dash guard', () => {
  const src = fs.readFileSync(INVARIANTS, 'utf8');
  const reqs = src.match(/require\([^)]*\)/g) || [];
  const bad = reqs.filter((x) => !/^require\('(node:)?(fs|path)'\)$/.test(x));
  eq(bad, [], 'requires other than fs and path');
  check(reqs.length >= 1, 'no require found');
  eq(H.dashGuard([INVARIANTS, ROOM_VALIDATOR, path.join(ROOT, 'lib', 'memory', 'validators', 'minto-invariants.cjs'), __filename]),
    [], 'files with a dash character');
});

arm('V9 guardian session-start: enqueues mis-keyed nests (identity-repair), nothing for a not-ready room', () => {
  const r = readyRoom('v9a');
  NESTS.forEach((n) => writeIn(path.join(r.roomDir, n), 'MINTO.md', mintoText(r.slug, 200)));
  const s = runGuardian('session-start', r);
  check(s.status === 0, 'session-start exit ' + s.status + ' ' + s.stderr);
  const q = queueEntries(r.roomDir).filter((e) => /guardian:identity-repair/.test(String(e.reason || '')));
  eq(q.map((e) => e.section).sort(), NESTS.slice().sort(), 'identity-repair enqueues');

  const n = strippedRoom('v9b');
  NESTS.forEach((x) => writeIn(path.join(n.roomDir, x), 'MINTO.md', mintoText(n.slug, 200)));
  const s2 = runGuardian('session-start', n);
  check(s2.status === 0, 'session-start exit ' + s2.status + ' ' + s2.stderr);
  const q2 = queueEntries(n.roomDir).filter((e) => /guardian:identity-repair/.test(String(e.reason || '')));
  eq(q2.length, 0, 'identity-repair enqueues on a not-ready room');
});

console.log('\nfeyminto-identity (369.25-12): ' + passed + ' passed, ' + failed + ' failed' +
  (failed ? ' (' + failedNames.join(', ') + ')' : ''));
process.exit(failed === 0 ? 0 : 1);
