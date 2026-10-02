#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 14 Task 1 (EPV366-07, D-06): the whitespace perspective recall.
 *
 *   W1  the pair bordering the planted WhitespaceZone is a candidate, lane zone_border, extra key zone_id
 *   W2  a declared coupling with zero cross edges yields lane declared_unlinked; a linked coupling yields none
 *   W3  a known pair is excluded (shared store counts it), cap honored, output deterministic
 *   W4  rows keep the shared shape (zone_id only on zone_border rows); run files and STATUS written
 *   W5  questionSetFor uses the shipped ws:* dimensions; each pair leaf carries the closed pair
 *       (perspective 'whitespace'); a long zone name is never sent as an exact phrase (SEED-104)
 *   W6  constants, the shipped whitespace template unchanged, zero network attempts
 *   W7  no duplicate basket candidates: pair-carrying ws:gap_claim leaves, rolled supported, give exactly
 *       one literature_gap item per leaf, each carrying the leaf's pair
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared
 * BEFORE any repo module loads. Exit 77 when node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-ws-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-ws-roomshome-'));
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
const C = hygiene.makeChecker('test-366-recall-whitespace');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const Y = require(path.join(REPO_ROOT, 'lib/core/research-planner/pyramid.cjs'));
const eureka = require(path.join(PERSP, 'eureka-recall.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));

const TAG = '20261002T000000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-ws-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });
const WS_PAIR = fixture.PLANTED.whitespace;
const ZONE = fixture.IDS.whitespace_zone;

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function samePair(c, a, b) { return (c.a === a && c.b === b) || (c.a === b && c.b === a); }
function find(list, a, b) { return list.filter(function (c) { return samePair(c, a, b); })[0] || null; }

let mod = null;
try { mod = require(path.join(PERSP, 'whitespace-recall.cjs')); } catch (e) { mod = null; C.check('whitespace-recall.cjs loads', false, String(e && e.message)); }

function substrateOf(roomDir) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  try { return eureka.buildSubstrate(db, { roomDir: roomDir }); } finally { try { db.close(); } catch (_e) { /* ro */ } }
}

(async function main() {
  if (mod) {
    const rec = mod.runRecall(room.roomDir, { tag: TAG, now: '2026-10-02T00:00:00.000Z' });

    await leg('W1 the zone-bordering pair is a zone_border candidate carrying zone_id', function () {
      const c = find(rec.candidates, WS_PAIR[0], WS_PAIR[1]);
      return (rec.ok === true && c && c.lanes.indexOf('zone_border') !== -1 && c.zone_id === ZONE) || JSON.stringify(rec.candidates).slice(0, 400);
    });

    await leg('W2 declared coupling with zero cross edges yields declared_unlinked; a linked coupling does not', function () {
      const un = rec.candidates.filter(function (c) { return c.lanes.indexOf('declared_unlinked') !== -1; });
      const secs = un.map(function (c) { return [c.section_a, c.section_b].sort().join('+'); });
      const unlinkedOk = secs.indexOf('competitive-analysis+market-analysis') !== -1;
      // solution-design <- problem-definition is declared AND linked (INFORMS): no candidate for it
      const linkedAbsent = secs.indexOf('problem-definition+solution-design') === -1;
      return (un.length >= 1 && unlinkedOk && linkedAbsent && rec.counts.declared_unlinked === un.length) || JSON.stringify({ secs: secs, counts: rec.counts });
    });

    await leg('W3 known pair excluded, cap honored, deterministic', function () {
      const again = mod.runRecall(room.roomDir, { tag: TAG + 'b', now: '2026-10-02T00:00:00.000Z' });
      const det = JSON.stringify(rec.candidates) === JSON.stringify(again.candidates) && JSON.stringify(rec.counts) === JSON.stringify(again.counts);
      // second room: the zone pair is already joined by an edge -> excluded and counted
      const room2 = fixture.buildPerspectiveRoom(root, { name: 'room-known' });
      const db = roomDb.openRoomDb(room2.roomDir);
      try { db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run(WS_PAIR[0], WS_PAIR[1], 'INFORMS', '{}'); } finally { roomDb.closeRoomDb(db); }
      const r2 = mod.runRecall(room2.roomDir, { tag: TAG });
      const excluded = !find(r2.candidates, WS_PAIR[0], WS_PAIR[1]) && r2.counts.excluded_known >= 1;
      const capped = mod.runRecall(room.roomDir, { tag: TAG + 'c', budgets: { max_candidates: 1 } });
      const capOk = capped.candidates.length === 1 && capped.pairs_truncated === rec.candidates.length - 1;
      return (det && excluded && capOk) || JSON.stringify({ det: det, excluded: excluded, counts2: r2.counts, capOk: capOk, capped: capped.candidates.length, truncated: capped.pairs_truncated });
    });

    await leg('W4 shared row shape, zone_id only on zone_border rows, run files written', function () {
      const keys = ['a', 'b', 'section_a', 'section_b', 'title_a', 'title_b', 'lanes', 'lexical', 'shared_entities'];
      const shapeOk = rec.candidates.every(function (c) { return keys.every(function (k) { return k in c; }); });
      const zoneOnly = rec.candidates.every(function (c) { return ('zone_id' in c) === (c.lanes.indexOf('zone_border') !== -1); });
      const back = mod.readCandidates(room.roomDir, TAG);
      const status = fs.readFileSync(path.join(mod.runDirFor(room.roomDir, TAG), 'STATUS.md'), 'utf8');
      const things = fs.existsSync(path.join(mod.runDirFor(room.roomDir, TAG), '01_substrate', 'output', 'things.jsonl'));
      const inRoot = mod.runDirFor(room.roomDir, TAG).indexOf(path.join('.mindrian', 'perspectives', 'whitespace')) !== -1;
      const lanesHdr = back && back.header && JSON.stringify(back.header.lanes) === JSON.stringify(['zone_border', 'declared_unlinked']);
      return (shapeOk && zoneOnly && back && back.candidates.length === rec.candidates.length && /Whitespace perspective run/.test(status) && things && inRoot && lanesHdr)
        || JSON.stringify({ shapeOk: shapeOk, zoneOnly: zoneOnly, back: !!back, things: things, inRoot: inRoot, lanesHdr: lanesHdr });
    });

    await leg('W5 question set: ws:* dimensions, closed pair, SEED-104 long zone name never an exact phrase', function () {
      const qs = rec.question_set;
      const shape = Q.validateQuestionSet(qs);
      const gap = qs.leaves.filter(function (l) { return l.dimension === 'ws:gap_claim'; });
      const dimsOk = qs.leaves.every(function (l) { return ['ws:gap_claim', 'ws:covered_elsewhere', 'ws:extraction_failure'].indexOf(l.dimension) !== -1; });
      const pairsOk = gap.length >= 2 && gap.every(function (l) { return l.pair && l.pair.perspective === 'whitespace' && l.pair.run_tag === TAG && typeof l.pair.a === 'string' && typeof l.pair.b === 'string'; });
      const zoneLeaf = gap.filter(function (l) { return l.pair && samePair(l.pair, WS_PAIR[0], WS_PAIR[1]); })[0];
      const zoneOk = zoneLeaf && zoneLeaf.researchable === true && zoneLeaf.lens === 'ws.gap' && zoneLeaf.slots && zoneLeaf.slots.term === 'small remote brackish installs' && Object.keys(zoneLeaf.slots).length === 1;
      const unl = gap.filter(function (l) { return l.lanes.indexOf('declared_unlinked') !== -1 && l.lanes.indexOf('zone_border') === -1; })[0];
      const unlOk = unl && unl.researchable === false && unl.corpus === 'room' && typeof unl.not_researchable_reason === 'string' && unl.not_researchable_reason.length > 0;
      const room_ext = qs.leaves.filter(function (l) { return l.dimension === 'ws:extraction_failure'; })[0];
      const extOk = room_ext && room_ext.corpus === 'room' && Object.keys(room_ext.slots || {}).length === 0;
      const built = Y.buildPyramid(qs, {});
      // long zone name (seven words, the SEED-104 shape): not researchable, no slots sent
      const sub = substrateOf(room.roomDir);
      sub.whitespace_zones[ZONE].title = 'small remote brackish groundwater installs without treatment budgets';
      const rec2 = mod.questionSetFor(mod.runRecall(room.roomDir, { tag: TAG + 'd' }), sub, { tag: TAG });
      const longLeaf = rec2.leaves.filter(function (l) { return l.pair && samePair(l.pair, WS_PAIR[0], WS_PAIR[1]); })[0];
      const longOk = longLeaf && longLeaf.researchable === false && longLeaf.corpus === 'room' && !longLeaf.slots;
      return (shape.ok === true && dimsOk && pairsOk && zoneOk && unlOk && extOk && built.ok !== false && longOk)
        || JSON.stringify({ shape: shape, dimsOk: dimsOk, pairsOk: pairsOk, zoneOk: !!zoneOk, unlOk: !!unlOk, extOk: !!extOk, built: built.ok, longOk: !!longOk, zoneLeaf: zoneLeaf, longLeaf: longLeaf });
    });

    await leg('W6 constants, shipped whitespace template unchanged, zero network attempts', function () {
      const t = Q.TEMPLATES.whitespace;
      const dims = t.dimensions.map(function (d) { return d.id; });
      const dimsOk = JSON.stringify(dims) === JSON.stringify(['ws:gap_claim', 'ws:covered_elsewhere', 'ws:irrelevant', 'ws:extraction_failure']);
      const lensesOk = JSON.stringify(mod.LENSES.slice().sort()) === JSON.stringify(t.lenses.slice().sort());
      const consts = mod.ID === 'whitespace' && mod.TEMPLATE_ID === 'whitespace' && mod.COMMAND === '/mos:whitespace'
        && mod.RUN_ROOT === path.join('.mindrian', 'perspectives', 'whitespace')
        && mod.BUDGETS.max_candidates === 100 && mod.BUDGETS.max_leaves === 8 && Object.isFrozen(mod.BUDGETS)
        && JSON.stringify(mod.STAGE_A_LANES) === JSON.stringify(['zone_border', 'declared_unlinked']) && Object.isFrozen(mod.STAGE_A_LANES)
        && typeof mod.FALSIFIER === 'string' && mod.FALSIFIER.length > 0 && /peer-reviewed/.test(mod.FALSIFIER);
      const idx = require(path.join(PERSP, 'index.cjs'));
      const reg = idx.getPerspective('whitespace');
      const iface = reg && idx.INTERFACE_NAMES.every(function (n) { return n in reg; });
      return (dimsOk && lensesOk && consts && iface && net.attempts() === 0) || JSON.stringify({ dimsOk: dimsOk, lensesOk: lensesOk, consts: !!consts, iface: !!iface, net: net.attempts() });
    });

    await leg('W7 pair-carrying ws:gap_claim leaves, rolled supported, give one literature_gap item per leaf', function () {
      const qs = rec.question_set;
      const built = Y.buildPyramid(qs, {});
      if (built.ok === false) return 'buildPyramid failed ' + JSON.stringify(built.errors);
      const pyramid = built.pyramid;
      const pairLeaves = built.leaves.filter(function (l) { return l.dimension === 'ws:gap_claim' && l.pair && l.researchable; });
      if (pairLeaves.length < 1) return 'no researchable pair leaf: ' + JSON.stringify(built.leaves.map(function (l) { return [l.id, l.dimension, l.researchable]; }));
      const verdicts = {};
      pairLeaves.forEach(function (l) { verdicts[l.id] = 'gap-confirmed'; });
      const rolled = Y.rollUp(pyramid, built.leaves, [], { verdictByLeaf: verdicts });
      const out = Y.opportunityCandidates(rolled.pyramid, rolled.leaves, [], { verdict: 'gap-confirmed' }).filter(function (i) { return i.kind === 'literature_gap'; });
      const onePerLeaf = out.length === pairLeaves.length && pairLeaves.every(function (l) {
        const hits = out.filter(function (i) { return i.leaf_ids.length === 1 && i.leaf_ids[0] === l.id; });
        return hits.length === 1 && hits[0].pair && samePair(hits[0].pair, l.pair.a, l.pair.b);
      });
      return onePerLeaf || JSON.stringify({ out: out, leaves: pairLeaves.map(function (l) { return l.id; }) });
    });
  }

  process.exitCode = C.summary();
  net.restore();
})();
