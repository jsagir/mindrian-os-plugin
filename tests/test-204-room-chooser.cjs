'use strict';
/*
 * Phase 204-01 -- unit tests for lib/core/room-chooser.cjs.
 * =========================================================================
 * The Ignite room-chooser adapter + Shape-F.1 card builder. This test is
 * fixture-driven: every listRegisteredRooms() call points at a hand-written
 * <tmp>/.rooms/registry.json (mirroring the schema scripts/room-registry list
 * emits) so NO test ever touches the real ~/MindrianRooms.
 *
 * Coverage:
 *   - listRegisteredRooms: reads a fixture registry; degrades to [] on a
 *     missing / malformed registry (never throws) -- T-204-02.
 *   - hasResumableRooms: non-empty non-archived predicate; all-archived -> false.
 *   - formatRoomLabel: composes the recency label; degrades on missing fields.
 *   - buildRoomChooserVerbs: filter archived, sort by last_opened desc, cap 4,
 *     append the Just Talk row, recommendedVerb = most-recent room.
 *   - renderRoomChooserCard: routes through the SEED-020 pickShape('F.1') door.
 *   - resolvePick: resume / just_talk / free_text branches.
 *
 * Read-only over the repo (Part 8: zero Brain / network). Hyphens only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const chooser = require('../lib/core/room-chooser.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass += 1; }

// --------------------------------------------------------------------------
// Fixture helper: build a scratch ROOMS_HOME with a .rooms/registry.json whose
// `rooms` map mirrors the on-disk schema scripts/room-registry reads.
// --------------------------------------------------------------------------
const _fixtureDirs = [];
function makeFixture(roomsMap) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-204-'));
  fs.mkdirSync(path.join(dir, '.rooms'), { recursive: true });
  const reg = { version: 1, active: '', rooms: roomsMap };
  fs.writeFileSync(path.join(dir, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
  _fixtureDirs.push(dir);
  return dir;
}
function makeMalformedFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-204-bad-'));
  fs.mkdirSync(path.join(dir, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.rooms', 'registry.json'), '{ this is not json', 'utf8');
  _fixtureDirs.push(dir);
  return dir;
}
function cleanup() {
  for (const d of _fixtureDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

// --------------------------------------------------------------------------
// exports surface
// --------------------------------------------------------------------------
const EXPECTED_EXPORTS = [
  'listRegisteredRooms', 'hasResumableRooms', 'formatRoomLabel',
  'buildRoomChooserVerbs', 'renderRoomChooserCard', 'resolvePick', 'JUST_TALK_LABEL',
];
for (const name of EXPECTED_EXPORTS) {
  ok('exports ' + name, Object.prototype.hasOwnProperty.call(chooser, name));
}
ok('JUST_TALK_LABEL is the exact string', chooser.JUST_TALK_LABEL === 'Just talk (no room)');

try {
  // ------------------------------------------------------------------------
  // listRegisteredRooms
  // ------------------------------------------------------------------------

  // zero rooms
  const zeroDir = makeFixture({});
  const zeroRooms = chooser.listRegisteredRooms(zeroDir);
  ok('zero rooms -> empty array', Array.isArray(zeroRooms) && zeroRooms.length === 0);

  // one room
  const oneDir = makeFixture({
    alpha: { path: 'alpha', status: 'active', venture_name: 'Alpha Co', venture_stage: 'seed', last_opened: isoDaysAgo(1) },
  });
  const oneRooms = chooser.listRegisteredRooms(oneDir);
  ok('one room -> single-entry array', oneRooms.length === 1 && oneRooms[0].name === 'alpha');

  // malformed registry degrades to [] (never throws) -- T-204-02
  const badDir = makeMalformedFixture();
  let threw = false;
  let badRooms;
  try { badRooms = chooser.listRegisteredRooms(badDir); } catch (_e) { threw = true; }
  ok('malformed registry does not throw', threw === false);
  ok('malformed registry -> empty array', Array.isArray(badRooms) && badRooms.length === 0);

  // missing registry (override points at a dir with no .rooms) degrades to []
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-204-empty-'));
  _fixtureDirs.push(emptyDir);
  const missingRooms = chooser.listRegisteredRooms(emptyDir);
  ok('missing registry -> empty array', Array.isArray(missingRooms) && missingRooms.length === 0);

  // ------------------------------------------------------------------------
  // hasResumableRooms
  // ------------------------------------------------------------------------
  ok('hasResumableRooms([]) -> false', chooser.hasResumableRooms([]) === false);
  ok('hasResumableRooms(non-array) -> false', chooser.hasResumableRooms(null) === false);
  ok('hasResumableRooms one active -> true', chooser.hasResumableRooms([{ status: 'active' }]) === true);
  ok('hasResumableRooms one parked -> true', chooser.hasResumableRooms([{ status: 'parked' }]) === true);
  ok('hasResumableRooms all archived -> false',
    chooser.hasResumableRooms([{ status: 'archived' }, { status: 'archived' }]) === false);
  ok('hasResumableRooms mixed -> true',
    chooser.hasResumableRooms([{ status: 'archived' }, { status: 'active' }]) === true);

  // ------------------------------------------------------------------------
  // formatRoomLabel
  // ------------------------------------------------------------------------
  const label = chooser.formatRoomLabel({ venture_name: 'Beta', venture_stage: 'growth', last_opened: isoDaysAgo(0.01) });
  ok('formatRoomLabel uses venture_name + stage', label.indexOf('Beta') === 0 && label.indexOf('growth') !== -1);
  ok('formatRoomLabel carries a recency anchor', label.indexOf('opened ') !== -1);

  const labelNoStage = chooser.formatRoomLabel({ name: 'gamma', last_opened: isoDaysAgo(1) });
  ok('formatRoomLabel falls back to name when no venture_name', labelNoStage.indexOf('gamma') === 0);
  ok('formatRoomLabel falls back to no-stage string', labelNoStage.indexOf('no stage yet') !== -1);

  let labelThrew = false;
  try { chooser.formatRoomLabel({}); } catch (_e) { labelThrew = true; }
  ok('formatRoomLabel never throws on empty object', labelThrew === false);

  // ------------------------------------------------------------------------
  // buildRoomChooserVerbs: exactly 4 rooms
  // ------------------------------------------------------------------------
  const fourRooms = [
    { name: 'r1', venture_name: 'R1', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(1) },
    { name: 'r2', venture_name: 'R2', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(2) },
    { name: 'r3', venture_name: 'R3', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(3) },
    { name: 'r4', venture_name: 'R4', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(4) },
  ];
  const built4 = chooser.buildRoomChooserVerbs(fourRooms);
  ok('4 rooms -> 5 verbs (4 rooms + Just Talk)', built4.verbs.length === 5);
  ok('4 rooms -> Just Talk is last verb', built4.verbs[built4.verbs.length - 1] === chooser.JUST_TALK_LABEL);
  ok('4 rooms -> header is the literal chooser header',
    built4.header === 'Ignite -- pick a room to resume, or start something new');
  ok('4 rooms -> recommendedVerb is the most-recent room (R1)', built4.recommendedVerb.indexOf('R1') === 0);
  ok('4 rooms -> roomByVerb is a Map', built4.roomByVerb instanceof Map);
  ok('4 rooms -> roomByVerb maps the R1 label back to its entry',
    built4.roomByVerb.get(built4.verbs[0]).name === 'r1');

  // ------------------------------------------------------------------------
  // buildRoomChooserVerbs: 6 rooms -> cap to 4 + Just Talk, recency ordering
  // ------------------------------------------------------------------------
  const sixRooms = [
    { name: 'a', venture_name: 'A', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(6) },
    { name: 'b', venture_name: 'B', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(1) },
    { name: 'c', venture_name: 'C', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(5) },
    { name: 'd', venture_name: 'D', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(2) },
    { name: 'e', venture_name: 'E', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(4) },
    { name: 'f', venture_name: 'F', venture_stage: 's', status: 'active', last_opened: isoDaysAgo(3) },
  ];
  const built6 = chooser.buildRoomChooserVerbs(sixRooms);
  ok('6 rooms -> capped to 5 verbs (4 rooms + Just Talk)', built6.verbs.length === 5);
  ok('6 rooms -> Just Talk last', built6.verbs[4] === chooser.JUST_TALK_LABEL);
  // most recent are b(1),d(2),f(3),e(4) in that desc order
  ok('6 rooms -> row 1 is B (1 day ago)', built6.verbs[0].indexOf('B') === 0);
  ok('6 rooms -> row 2 is D (2 days ago)', built6.verbs[1].indexOf('D') === 0);
  ok('6 rooms -> row 3 is F (3 days ago)', built6.verbs[2].indexOf('F') === 0);
  ok('6 rooms -> row 4 is E (4 days ago)', built6.verbs[3].indexOf('E') === 0);
  ok('6 rooms -> the two oldest (A, C) are dropped',
    built6.verbs.every(v => v.indexOf('A ') !== 0 && v.indexOf('C ') !== 0));
  ok('6 rooms -> recommendedVerb is B', built6.recommendedVerb.indexOf('B') === 0);

  // archived entries are filtered before the cap
  const withArchived = sixRooms.concat([
    { name: 'z', venture_name: 'Z', venture_stage: 's', status: 'archived', last_opened: isoDaysAgo(0.1) },
  ]);
  const builtArch = chooser.buildRoomChooserVerbs(withArchived);
  ok('archived room is filtered out of the verbs even though newest',
    builtArch.verbs.every(v => v.indexOf('Z ') !== 0));

  // zero rooms -> only Just Talk, recommendedVerb null
  const built0 = chooser.buildRoomChooserVerbs([]);
  ok('zero rooms -> only the Just Talk verb', built0.verbs.length === 1 && built0.verbs[0] === chooser.JUST_TALK_LABEL);
  ok('zero rooms -> recommendedVerb is null', built0.recommendedVerb === null);

  // ------------------------------------------------------------------------
  // renderRoomChooserCard -> SEED-020 pickShape('F.1') door
  // ------------------------------------------------------------------------
  const card = chooser.renderRoomChooserCard(sixRooms);
  ok('renderRoomChooserCard -> shape F.1', card.shape === 'F.1');
  ok('renderRoomChooserCard -> carries roomByVerb Map', card.roomByVerb instanceof Map);
  ok('renderRoomChooserCard -> rendered contract exists', card.rendered && card.rendered.contract);
  const contractVerbs = card.rendered.contract.verbs;
  const builtForCard = chooser.buildRoomChooserVerbs(sixRooms);
  ok('renderRoomChooserCard -> contract.verbs includes every built verb',
    builtForCard.verbs.every(v => contractVerbs.indexOf(v) !== -1));

  // ------------------------------------------------------------------------
  // resolvePick: all three branches
  // ------------------------------------------------------------------------
  const roomByVerb = builtForCard.roomByVerb;
  const firstLabel = builtForCard.verbs[0];
  const resumed = chooser.resolvePick(firstLabel, roomByVerb);
  ok('resolvePick(room label) -> resume action', resumed.action === 'resume' && resumed.room.name === 'b');
  const talk = chooser.resolvePick(chooser.JUST_TALK_LABEL, roomByVerb);
  ok('resolvePick(Just Talk) -> just_talk action', talk.action === 'just_talk');
  const free = chooser.resolvePick('Free-Text', roomByVerb);
  ok('resolvePick(Free-Text) -> free_text action', free.action === 'free_text' && free.text === 'Free-Text');
  const freeOther = chooser.resolvePick('something the navigator typed', roomByVerb);
  ok('resolvePick(unexpected) -> free_text action', freeOther.action === 'free_text');

  console.log('\n204-01 room-chooser: ' + pass + ' assertions passed');
} finally {
  cleanup();
}
