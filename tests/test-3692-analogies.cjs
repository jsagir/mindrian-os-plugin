#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 369.2 Plan 28 (369.2-R21; HARNESS-04, SW-19, SEED-118 D10, annex C02): the analogy matcher reads
 * the SAPPhIRE encoding artifact the navigator writes.
 *
 * Before this plan the matcher counted only shared entities and shared framework nodes, so a complete
 * encoding (frontmatter methodology: sapphire-encoding, lines Function:, Behavior:, Structure:) changed
 * nothing: a pair whose only bridge was the encoding had signal 0 and was dropped. Brief test 8 asks for the
 * difference to be measured, with the artifact and without it, everything else equal.
 *
 *   AN1  perspective room with thing A (produce spoilage between van and stall) and thing B (the
 *        termite-mound encoding); A and B share no entity and no framework. Analogies recall returns at
 *        least 1 candidate pairing B with A, lane structural, signal_sources includes 'encoding', and
 *        counts.structural_from_encoding >= 1
 *   AN2  the same room where B has the same text but no sapphire-encoding frontmatter: 0 structural pairs
 *        for A and counts.structural_from_encoding is 0
 *   AN3  AN1 versus AN2 differ: the C02 before/after measurement is printed
 *   AN4  the plain planted room (no A, no B): the planted analogies pair is still the only candidate, with
 *        no encoding signal; in the encoding room the planted pair keeps its place and order
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared
 * BEFORE any repo module loads; the network guard counts zero attempts. Exit 77 when node:sqlite is
 * missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-an-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-an-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-3692-analogies');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const mod = require(path.join(PERSP, 'analogies-recall.cjs'));

const TAG = '20261002T000000Z';
const NOW = '2026-10-02T00:00:00.000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-an-'));
const AN_PAIR = fixture.PLANTED.analogies;

// Thing A: a market-analysis artifact about produce spoilage. It shares no entity and no framework with B.
// Its text states the function and behavior it needs in its own situation, as a room note would.
const A_ID = 'market-analysis/produce-spoilage-van-to-stall/produce-spoilage-van-to-stall';
const A_PROPS = {
  title: 'Produce spoilage between the van and the stall',
  section: 'market-analysis',
  body: 'Crates of produce spoil on the way from the van to the stall. The crate must hold a steady inner temperature while the outside swings. '
    + 'Warm air should rise through narrow shafts and pull cooler air in at the base, so the chamber stays near one value all day.',
};

// Thing B: the encoding artifact, as the indexer stores it: props title, section, methodology only (the body
// stays in the file). The file is the termite-mound encoding of the release fixture room.
const B_ID = 'competitive-analysis/termite-mound-encoding/termite-mound-encoding';
const B_BODY = '# Termite mound ventilation, encoded for transfer\n\n'
  + 'Function: hold a steady inner temperature while the outside swings. '
  + 'Behavior: warm air rises through narrow shafts and pulls cooler air in at the base, so the chamber stays near one value all day. '
  + 'Structure: a thick earthen shell with a network of vertical channels and a buried base.\n\n'
  + 'The point of keeping this encoding is the shape of the idea, not the insects: a heavy buffer plus a slow passive airflow can replace a powered cooler for part of the day.\n';
const B_ENCODED = '---\ntitle: Termite mound ventilation, encoded for transfer\nsection: competitive-analysis\nmethodology: sapphire-encoding\n---\n\n' + B_BODY;
const B_PLAIN = '---\ntitle: Termite mound ventilation, encoded for transfer\nsection: competitive-analysis\n---\n\n' + B_BODY;

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

function addThing(roomDir, db, id, props, epistemic) {
  insertNode(db, id, 'Artifact', JSON.stringify(props), { source_path: id + '.md', epistemic_type: epistemic || 'observation' });
  db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run(id, 'section:' + props.section, 'BELONGS_TO', '{}');
}

// buildRoomWith(name, bFileText) -> the perspective room plus thing A and thing B (file text given)
function buildRoomWith(name, bFileText) {
  const room = fixture.buildPerspectiveRoom(root, { name: name });
  const db = roomDb.openRoomDb(room.roomDir);
  try {
    addThing(room.roomDir, db, A_ID, A_PROPS);
    addThing(room.roomDir, db, B_ID, { title: 'Termite mound ventilation, encoded for transfer', section: 'competitive-analysis', methodology: bFileText === B_ENCODED ? 'sapphire-encoding' : '' });
  } finally { roomDb.closeRoomDb(db); }
  const aFile = path.join(room.roomDir, A_ID + '.md');
  fs.mkdirSync(path.dirname(aFile), { recursive: true });
  fs.writeFileSync(aFile, '# ' + A_PROPS.title + '\n\n' + A_PROPS.body + '\n');
  const bFile = path.join(room.roomDir, B_ID + '.md');
  fs.mkdirSync(path.dirname(bFile), { recursive: true });
  fs.writeFileSync(bFile, bFileText);
  return room;
}

function involvesA(c) { return c.a === A_ID || c.b === A_ID; }
function pairsWithA(rec) { return rec.candidates.filter(involvesA); }
function hasEncodingSignal(c) { return Array.isArray(c.signal_sources) && c.signal_sources.indexOf('encoding') !== -1; }

(async function main() {
  const withEnc = buildRoomWith('room-encoded', B_ENCODED);
  const withoutEnc = buildRoomWith('room-plain', B_PLAIN);
  const plain = fixture.buildPerspectiveRoom(root, { name: 'room-planted-only' });

  const recWith = mod.runRecall(withEnc.roomDir, { tag: TAG, now: NOW });
  const recWithout = mod.runRecall(withoutEnc.roomDir, { tag: TAG, now: NOW });
  const recPlain = mod.runRecall(plain.roomDir, { tag: TAG, now: NOW });

  await leg('AN1 an encoding pairs B with A: lane structural, signal source encoding, counted', function () {
    const pairs = pairsWithA(recWith);
    const row = pairs.filter(function (c) { return c.a === B_ID || c.b === B_ID; })[0];
    const ok = !!row && row.lanes.indexOf('structural') !== -1 && hasEncodingSignal(row)
      && recWith.counts.structural_from_encoding >= 1;
    return ok || JSON.stringify({ pairsWithA: pairs.length, row: row || null, counts: recWith.counts });
  });

  await leg('AN2 the same room without the sapphire-encoding frontmatter finds no pair for A', function () {
    const pairs = pairsWithA(recWithout);
    const anyEnc = recWithout.candidates.some(hasEncodingSignal);
    const ok = pairs.length === 0 && !anyEnc && !(recWithout.counts.structural_from_encoding > 0);
    return ok || JSON.stringify({ pairsWithA: pairs.length, anyEnc: anyEnc, counts: recWithout.counts });
  });

  await leg('AN3 with and without the encoding differ (C02 before and after)', function () {
    const before = pairsWithA(recWithout).length;
    const after = pairsWithA(recWith).length;
    const countBefore = recWithout.counts.structural_from_encoding || 0;
    const countAfter = recWith.counts.structural_from_encoding || 0;
    console.log('C02 measurement: structural pairs for A before=' + before + ' after=' + after + '; structural_from_encoding before=' + countBefore + ' after=' + countAfter);
    return (after > before && countAfter > countBefore) || JSON.stringify({ before: before, after: after, countBefore: countBefore, countAfter: countAfter });
  });

  await leg('AN4 the planted analogies pair is unchanged: same candidates and order, no encoding signal', function () {
    const key = function (c) { return c.a + '|' + c.b; };
    const expected = [AN_PAIR.slice().sort().join('|')];
    const plainKeys = recPlain.candidates.map(key);
    const plainOk = JSON.stringify(plainKeys) === JSON.stringify(expected) && !recPlain.candidates.some(hasEncodingSignal);
    // in the encoding room the pairs that do not involve A or B keep their order and content
    const notAB = function (c) { return c.a !== A_ID && c.b !== A_ID && c.a !== B_ID && c.b !== B_ID; };
    const withKeys = recWith.candidates.filter(notAB).map(key);
    const sameRest = JSON.stringify(withKeys) === JSON.stringify(plainKeys);
    // the planted pair (signal 3) ranks before an encoding pair (signal 1)
    const firstIsPlanted = recWith.candidates.length >= 1 && key(recWith.candidates[0]) === expected[0];
    return (plainOk && sameRest && firstIsPlanted) || JSON.stringify({ plainKeys: plainKeys, withKeys: withKeys, first: recWith.candidates[0] && key(recWith.candidates[0]) });
  });

  await leg('AN5 zero network attempts', function () {
    return net.attempts() === 0 || ('attempts=' + net.attempts());
  });

  process.exitCode = C.summary();
  net.restore();
})();
