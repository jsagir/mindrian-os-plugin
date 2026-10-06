'use strict';
/*
 * Phase 369.25 plan 15 -- FEYM-01, FEYM-03, FEYM-04, FEYM-05: the MINTO and FEYNMAN faces keyed to the identity,
 * declaring their edit surface, carrying design v2's required blocks, and keeping one home for the artifact list.
 *
 * RED first: this file is committed before scripts/vault-section-minto-generator.cjs knows the room id key, the
 * edit surface, the three new blocks or the sources link, and before lib/core/feyminto/feynman-blocks.cjs exists.
 * Arms:
 *   M1  `generator --write` on a born room with two artifacts writes MINTO.md with room equal to the room.db room_id
 *       and room_slug equal to the slug; validate(MINTO.md, { roomIdentity }) has no FEYNMINTO-11 violation
 *   M2  on a legacy room (the seven room.* keys deleted) the MINTO says room: unknown and room_identity: identity_missing
 *   M3  MINTO frontmatter has edit_surface, editable_fields [governing_thought] and edit_recorded_in
 *   M4  the three headings; with a CONTRADICTS edge, an assumption and no records (the unsettled sentence)
 *   M5  sources: [ROOM.md#artifacts-in-this-section] with sources_count 2; doctor --icm-walk I8a in_room_md 0
 *   F1  after the same --write FEYNMAN.md has the two blocks inside their sentinels (what changed names the two new
 *       sources; what we cannot yet explain carries the MINTO gaps); a second --write records no change
 *   F2  a freshly born room's FEYNMAN.md has edit_surface, editable_fields [body], edit_recorded_in and both blocks
 *       seeded with 'Nothing yet: this nest was just created.'
 *   F3  stampFaceRoomId adds or replaces room_id and keeps every other key and the body byte-identical
 *   F6  the regeneration keys the FEYNMAN face to the room id (room_id), a not-ready room stamps nothing
 *   F5  a FEYNMAN holding only the seed and the generated blocks stays scaffold (lib/core/scaffold-predicate.cjs)
 *   F4  the human body region of FEYNMAN.md is byte-identical before and after writeFeynmanBlocks; dash guard
 *   F7  (369.25-26) a CONTRADICTS pair filed after a MINTO write shows once in WHAT CHANGED as 'Counterevidence added: <text>';
 *       the next write with no input change reads 'No change since the previous revision.'
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
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

const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const DOCTOR = path.join(ROOT, 'scripts', 'doctor.cjs');
const BLOCKS = path.join(ROOT, 'lib', 'core', 'feyminto', 'feynman-blocks.cjs');
const SEED_WRITER = path.join(ROOT, 'lib', 'core', 'feynman', 'feynman-seed-writer.cjs');
const SEC = 'problem-definition';

function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function identityMod() { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')); }
function inv() { return require(path.join(ROOT, 'lib', 'core', 'feynman-minto-invariants.cjs')); }
function blocks() { return require(BLOCKS); }

// ---- fixtures ----------------------------------------------------------------------------------------------

function born(tag, opts) {
  const o = opts || {};
  const iso = H.mkIsolatedHome(tag);
  const slug = 'ff-' + tag;
  const b = H.birthFixtureRoom({ iso, slug });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  if (o.artifacts !== false) {
    fs.writeFileSync(path.join(roomDir, SEC, 'interview-notes.md'), '# Interview notes\n\nFounders say onboarding takes three weeks.\n', 'utf8');
    fs.writeFileSync(path.join(roomDir, SEC, 'problem-statement.md'), '# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
  }
  return { iso, roomDir, slug, room_id: b.room_id };
}

function strip(room) {
  const db = nav().openRoomDbForCaller(room.roomDir);
  try {
    db.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run();
    db.prepare('DELETE FROM nodes WHERE id = ?').run('room:' + room.slug);
  } finally { nav().closeRoomDbForCaller(db); }
}

function gen(room, section) {
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', section || SEC], {
    env: room.iso.env, encoding: 'utf8', timeout: 60000,
  });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + '\n' + r.stderr + r.stdout);
  return r;
}

function read(room, name, section) { return fs.readFileSync(path.join(room.roomDir, section || SEC, name), 'utf8'); }

// A narrow frontmatter reader: `key: value` lines between the first two --- lines; quotes stripped.
function fm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  m[1].split(/\r?\n/).forEach((ln) => {
    const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (k) out[k[1]] = k[2].replace(/^"(.*)"$/, '$1');
  });
  return out;
}

function between(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a === -1 || b === -1 || b < a) return null;
  return text.slice(a + start.length, b);
}

// ---- M arms ------------------------------------------------------------------------------------------------

arm('M1 MINTO room is the room.db room_id, room_slug is the slug, FEYNMINTO-11 is satisfied', () => {
  const r = born('m1');
  gen(r);
  const text = read(r, 'MINTO.md');
  const f = fm(text);
  const ident = identityMod().readRoomIdentity(r.roomDir, { door: 'in_place' });
  check(ident.ok === true, 'identity not ready: ' + JSON.stringify(ident));
  eq(f.room, ident.room_id, 'MINTO room');
  eq(f.room_slug, r.slug, 'MINTO room_slug');
  const v = inv().validate(path.join(r.roomDir, SEC, 'MINTO.md'), { roomIdentity: ident });
  const id11 = v.violations.filter((x) => /FEYNMINTO-11/.test(x.message));
  eq(id11.length, 0, 'FEYNMINTO-11 violations: ' + JSON.stringify(id11));
});

arm('M2 a legacy room (seven room.* keys deleted) writes room: unknown and room_identity: identity_missing', () => {
  const r = born('m2');
  strip(r);
  gen(r);
  const f = fm(read(r, 'MINTO.md'));
  eq(f.room, 'unknown', 'MINTO room on a not-ready identity');
  eq(f.room_identity, 'identity_missing', 'MINTO room_identity');
  check(f.room !== r.slug, 'the slug must never sit in the id field');
});

arm('M3 MINTO declares its edit surface in frontmatter', () => {
  const r = born('m3');
  gen(r);
  const f = fm(read(r, 'MINTO.md'));
  check(typeof f.edit_surface === 'string' && f.edit_surface.length > 0, 'edit_surface missing');
  eq(f.editable_fields, '[governing_thought]', 'editable_fields');
  check(typeof f.edit_recorded_in === 'string' && /decision record/.test(f.edit_recorded_in) && /88-10/.test(f.edit_recorded_in), 'edit_recorded_in: ' + f.edit_recorded_in);
});

arm('M4 Counterevidence, Assumptions and What would change the conclusion from the room records; unsettled when none', () => {
  // no records: the last block says the conclusion is unsettled
  const none = born('m4a');
  gen(none);
  const t0 = read(none, 'MINTO.md');
  ['## Counterevidence', '## Assumptions', '## What would change the conclusion'].forEach((h) => check(t0.indexOf('\n' + h + '\n') !== -1, 'missing heading ' + h));
  check(t0.indexOf('Not yet stated. Until it is, treat the governing thought as unsettled.') !== -1, 'unsettled sentence missing when no records exist');

  // records: one CONTRADICTS edge and one blocking assumption, written into the section
  const r = born('m4b');
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = nav().openRoomDbForCaller(r.roomDir);
  try {
    const opts = { source_path: 'test:ff-m4', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed' };
    insertNode(db, 'claim:ff-a', 'claim', JSON.stringify({ section: SEC, text: 'Customers do not feel this problem today' }), opts);
    insertNode(db, 'claim:ff-b', 'claim', JSON.stringify({ section: 'market-analysis', text: 'Interviewed teams pay to fix this problem today' }), opts);
    const w = nav().writeEdge(db, { source_id: 'claim:ff-a', target_id: 'claim:ff-b', edge_type: 'CONTRADICTS' });
    check(w && w.ok === true, 'writeEdge CONTRADICTS: ' + JSON.stringify(w));
    insertNode(db, 'assumption:ff-x', 'assumption', JSON.stringify({ section: SEC, text: 'The buyer is also the daily user' }),
      Object.assign({}, opts, { epistemic_type: 'assumption' }));
    db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DEPENDS_ON', '{}')").run('claim:ff-a', 'assumption:ff-x');
  } finally { nav().closeRoomDbForCaller(db); }
  gen(r);
  const t = read(r, 'MINTO.md');
  const ce = between(t, '## Counterevidence\n', '\n## Assumptions\n');
  const as = between(t, '## Assumptions\n', '\n## What would change the conclusion\n');
  const wc = t.slice(t.indexOf('## What would change the conclusion\n'));
  check(ce !== null && /Interviewed teams pay to fix this problem today/.test(ce), 'Counterevidence does not list the contradicting claim: ' + ce);
  check(as !== null && /The buyer is also the daily user/.test(as), 'Assumptions does not list the assumption: ' + as);
  check(/Interviewed teams pay to fix this problem today/.test(wc) && /The buyer is also the daily user/.test(wc), 'What would change the conclusion does not name both');
  check(wc.indexOf('Not yet stated.') === -1, 'unsettled sentence must not appear when records exist');
});

arm('M5 sources links to ROOM.md; sources_count kept; the walk reports I8a in_room_md 0', () => {
  const r = born('m5');
  gen(r);
  const f = fm(read(r, 'MINTO.md'));
  eq(f.sources, '[ROOM.md#artifacts-in-this-section]', 'sources');
  eq(f.sources_count, '2', 'sources_count');
  const w = spawnSync(process.execPath, [DOCTOR, '--icm-walk', '--room', r.roomDir, '--json'], { env: r.iso.env, encoding: 'utf8', timeout: 120000, cwd: ROOT });
  check(w.status === 0, 'doctor --icm-walk exit ' + w.status + ' ' + w.stderr);
  const rep = JSON.parse(w.stdout);
  const n = rep.nests.find((x) => x.nest === SEC);
  check(!!n, 'nest not in the walk');
  eq(n.I8a.in_room_md, 0, 'I8a in_room_md');
  eq(n.I8b.matches_room_id, true, 'I8b matches_room_id (the MINTO room value is the room id)');
});

// ---- F arms ------------------------------------------------------------------------------------------------

arm('F1 FEYNMAN gains What changed and What we cannot yet explain after a MINTO write; a second write records no change', () => {
  const r = born('f1');
  gen(r);
  const t = read(r, 'FEYNMAN.md');
  const B = blocks();
  check(t.indexOf(B.WHAT_CHANGED_HEADING) !== -1, 'What changed heading missing');
  check(t.indexOf(B.CANNOT_EXPLAIN_HEADING) !== -1, 'What we cannot yet explain heading missing');
  const wc = between(t, B.SENTINELS.whatChanged[0], B.SENTINELS.whatChanged[1]);
  const ce = between(t, B.SENTINELS.cannotExplain[0], B.SENTINELS.cannotExplain[1]);
  check(wc !== null && /interview-notes\.md/.test(wc) && /problem-statement\.md/.test(wc), 'what changed does not name the two new sources: ' + wc);
  check(ce !== null && /Thin coverage: only 2 artifacts filed/.test(ce) && /Missing: root-cause analysis/.test(ce), 'cannot explain does not carry the MINTO gaps: ' + ce);
  gen(r);
  const t2 = read(r, 'FEYNMAN.md');
  const wc2 = between(t2, B.SENTINELS.whatChanged[0], B.SENTINELS.whatChanged[1]);
  check(wc2 !== null && /No change since the previous revision\./.test(wc2), 'second write: ' + wc2);
});

arm('F2 a freshly born room seeds FEYNMAN with its edit surface and both blocks', () => {
  const r = born('f2', { artifacts: false });
  const text = read(r, 'FEYNMAN.md');
  const f = fm(text);
  check(typeof f.edit_surface === 'string' && f.edit_surface.length > 0, 'edit_surface missing');
  eq(f.editable_fields, '[body]', 'editable_fields');
  check(typeof f.edit_recorded_in === 'string' && /git history/.test(f.edit_recorded_in), 'edit_recorded_in: ' + f.edit_recorded_in);
  const B = blocks();
  const wc = between(text, B.SENTINELS.whatChanged[0], B.SENTINELS.whatChanged[1]);
  const ce = between(text, B.SENTINELS.cannotExplain[0], B.SENTINELS.cannotExplain[1]);
  check(wc !== null && /Nothing yet: this nest was just created\./.test(wc), 'what changed seed: ' + wc);
  check(ce !== null && /Nothing yet: this nest was just created\./.test(ce), 'cannot explain seed: ' + ce);
  check(text.indexOf('Seeded at birth') !== -1, 'the seed sentence the walk counts must stay');
});

arm('F3 stampFaceRoomId adds or replaces room_id and keeps every other key and the body byte-identical', () => {
  const r = born('f3', { artifacts: false });
  const p = path.join(r.roomDir, SEC, 'FEYNMAN.md');
  const before = fs.readFileSync(p, 'utf8');
  const bf = fm(before);
  const res = blocks().stampFaceRoomId(p, 'aaaaaaaa-0000-4000-8000-000000000001');
  check(res && res.ok === true, 'stamp: ' + JSON.stringify(res));
  const after = fs.readFileSync(p, 'utf8');
  const af = fm(after);
  eq(af.room_id, 'aaaaaaaa-0000-4000-8000-000000000001', 'room_id added');
  Object.keys(bf).filter((k) => k !== 'room_id').forEach((k) => eq(af[k], bf[k], 'key ' + k + ' kept'));
  const body = (t) => t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  eq(body(after), body(before), 'body byte-identical');
  const res2 = blocks().stampFaceRoomId(p, 'bbbbbbbb-0000-4000-8000-000000000002');
  check(res2 && res2.ok === true, 'second stamp');
  const af2 = fm(fs.readFileSync(p, 'utf8'));
  eq(af2.room_id, 'bbbbbbbb-0000-4000-8000-000000000002', 'room_id replaced');
  eq((fs.readFileSync(p, 'utf8').match(/^room_id:/gm) || []).length, 1, 'exactly one room_id line');
  const missing = blocks().stampFaceRoomId(path.join(r.roomDir, SEC, 'NOPE.md'), 'x');
  check(missing && missing.ok === false, 'a missing face returns ok:false and never throws');
});

arm('F5 a FEYNMAN carrying only the seed and the two generated blocks is still scaffold; one human line makes it content', () => {
  const r = born('f5');
  gen(r);
  const p = path.join(r.roomDir, SEC, 'FEYNMAN.md');
  const { isScaffoldFile } = require(path.join(ROOT, 'lib', 'core', 'scaffold-predicate.cjs'));
  check(blocks().HEADER === blocks().WHAT_CHANGED_HEADING, 'HEADER export is the first heading');
  check(fs.readFileSync(p, 'utf8').indexOf(blocks().WHAT_CHANGED_HEADING) !== -1, 'the generated blocks are in the file');
  eq(isScaffoldFile(p), true, 'seed + generated blocks must stay scaffold (never counted as the owner\'s work)');
  // the section MINTO must not count it as an artifact: a second write keeps sources_count at 2
  gen(r);
  eq(fm(read(r, 'MINTO.md')).sources_count, '2', 'sources_count after a second write');
  fs.appendFileSync(p, '\nMy own line about this nest.\n', 'utf8');
  eq(isScaffoldFile(p), false, 'a human line outside the blocks makes the face content');
});

arm('F6 the regeneration keys the FEYNMAN face to the room id (FEYNMINTO-11 clean); a not-ready room stamps nothing', () => {
  const r = born('f6');
  const p = path.join(r.roomDir, SEC, 'FEYNMAN.md');
  const ident = identityMod().readRoomIdentity(r.roomDir, { door: 'in_place' });
  check(ident.ok === true, 'identity not ready');
  // 369.25-17 RE-PINNED: birth now stamps room_id into every FEYNMAN.md (this arm used to expect one not-yet-keyed warning on a
  // born room, "plan 17 stamps at birth"). A born room is keyed already; to keep proving that the REGENERATION stamps a face birth
  // did not reach (a legacy room, a nest made later) the birth stamp is removed first.
  eq(inv().validateFaceRoomId(p, ident).violations.length, 0, 'a born room is keyed at birth (369.25-17)');
  const unstamp = (room) => {
    const f = path.join(room.roomDir, SEC, 'FEYNMAN.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/^room_id: .*\n/m, ''), 'utf8');
  };
  unstamp(r);
  check(inv().validateFaceRoomId(p, ident).violations.length === 1, 'a face birth did not reach starts with one not-yet-keyed warning');
  gen(r);
  eq(fm(read(r, 'FEYNMAN.md')).room_id, ident.room_id, 'FEYNMAN room_id after the regeneration');
  eq(inv().validateFaceRoomId(p, ident).violations.length, 0, 'FEYNMINTO-11 violations on FEYNMAN after the regeneration');
  eq(fm(read(r, 'FEYNMAN.md')).edit_surface.length > 0, true, 'the edit surface survives the stamp');
  const n = born('f6n');
  unstamp(n);
  strip(n);
  gen(n);
  eq(fm(read(n, 'FEYNMAN.md')).room_id, undefined, 'a not-ready room writes no room_id on the face');
});

arm('F4 the human body of FEYNMAN is byte-identical across writeFeynmanBlocks; dash guard', () => {
  const r = born('f4', { artifacts: false });
  const p = path.join(r.roomDir, SEC, 'FEYNMAN.md');
  const human = '\nMy own words about this nest. A smart twelve-year-old would say: people wait too long.\n\nSecond paragraph, mine.\n';
  const seeded = fs.readFileSync(p, 'utf8');
  const B = blocks();
  // put the human text before the blocks, as an owner would
  const i = seeded.indexOf(B.WHAT_CHANGED_HEADING);
  check(i !== -1, 'seed has no blocks (F2 first)');
  fs.writeFileSync(p, seeded.slice(0, i) + human + '\n' + seeded.slice(i), 'utf8');
  const humanOf = (t) => {
    let x = t;
    Object.keys(B.SENTINELS).forEach((k) => {
      const a = x.indexOf(B.SENTINELS[k][0]);
      const b = x.indexOf(B.SENTINELS[k][1]);
      if (a !== -1 && b !== -1) x = x.slice(0, a) + x.slice(b + B.SENTINELS[k][1].length);
    });
    return x.split(B.WHAT_CHANGED_HEADING).join('').split(B.CANNOT_EXPLAIN_HEADING).join('');
  };
  const before = humanOf(fs.readFileSync(p, 'utf8'));
  const res = B.writeFeynmanBlocks(p, { whatChanged: ['Sources added: a.md'], cannotExplain: ['Missing: a thing'] });
  check(res && res.ok === true, 'writeFeynmanBlocks: ' + JSON.stringify(res));
  const text = fs.readFileSync(p, 'utf8');
  eq(humanOf(text), before, 'human region changed');
  check(/Sources added: a\.md/.test(text) && /Missing: a thing/.test(text), 'blocks not updated');
  check(text.indexOf('My own words about this nest.') !== -1, 'human text lost');
  eq(H.dashGuard([GEN, BLOCKS, SEED_WRITER, __filename]), [], 'files with a dash character');
});

arm('F7 WHAT CHANGED records new counterevidence once; a regeneration with no input change reads no change (369.25-26, P5b)', () => {
  const r = born('f7');
  const B = blocks();
  gen(r); // a MINTO face with no counterevidence
  check(/None recorded in the room yet\./.test(between(read(r, 'MINTO.md'), '## Counterevidence\n', '\n## Assumptions\n') || ''), 'fixture MINTO should carry no counterevidence');
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = nav().openRoomDbForCaller(r.roomDir);
  try {
    const opts = { source_path: 'test:ff-f7', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed' };
    insertNode(db, 'claim:f7-a', 'claim', JSON.stringify({ section: SEC, text: 'Customers do not feel this problem today' }), opts);
    insertNode(db, 'claim:f7-b', 'claim', JSON.stringify({ section: 'market-analysis', text: 'Interviewed teams pay to fix this problem today' }), opts);
    const w = nav().writeEdge(db, { source_id: 'claim:f7-a', target_id: 'claim:f7-b', edge_type: 'CONTRADICTS' });
    check(w && w.ok === true, 'writeEdge CONTRADICTS: ' + JSON.stringify(w));
  } finally { nav().closeRoomDbForCaller(db); }
  gen(r);
  const wc = between(read(r, 'FEYNMAN.md'), B.SENTINELS.whatChanged[0], B.SENTINELS.whatChanged[1]);
  check(wc !== null, 'what changed block missing');
  const added = wc.split(/\r?\n/).filter((ln) => /^\s*-\s*Counterevidence added:/.test(ln));
  eq(added.length, 1, 'count of "Counterevidence added:" lines in WHAT CHANGED: ' + wc);
  check(/Interviewed teams pay to fix this problem today/.test(added[0]), 'the line does not name the new item: ' + added[0]);
  gen(r); // nothing moved since the last write
  const wc3 = between(read(r, 'FEYNMAN.md'), B.SENTINELS.whatChanged[0], B.SENTINELS.whatChanged[1]);
  check(wc3 !== null && /No change since the previous revision\./.test(wc3) && !/Counterevidence added:/.test(wc3), 'third write should read no change: ' + wc3);
});

console.log('\nfeyminto-faces (369.25-15): ' + passed + ' passed, ' + failed + ' failed' +
  (failed ? ' (' + failedNames.join(', ') + ')' : ''));
process.exit(failed === 0 ? 0 : 1);
