#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 369.2 Plan 04 (R03, ruling 2026-10-05 "and all"): every canvas perspective reaches the web lines.
 *
 * Plain English: a pair of things whose titles are full room sentences used to become "answered from the room
 * only" because the perspective slot path asked the strict Theo rule (a short term, no sentence) of a WEB line.
 * The web lines take a room phrase; only Theo needs the strict rule. These legs pin that each perspective now
 * proposes a search the navigator can approve, from the room's own words.
 *
 *   P1  eureka       a leaf built from two sentence titles is researchable, corpus openalex, and composes
 *   P2  analogies    same
 *   P3  whitespace   a zone named by a sentence (longer than four words) is researchable and composes
 *   P4  hsi          same as P1
 *   P5  rs           same as P1 (cause and effect slots)
 *   P6  connections  keeps its Theo leaves (canon names) and gains a cn:literature_link web leaf (lens
 *                    cn.literature, corpus openalex, slots from the pair titles) that composes
 *   P7  no perspective module still claims a Part 8 cause ("without sending room text")
 *   P8  a title too long for a web slot still yields the room-only leaf (no slots, corpus room);
 *   P8b the room-only reason reads exactly the new wording, for eureka, analogies, hsi, rs and whitespace
 *   P9  the Theo leaves of connections still carry only canon names that pass the strict term rule
 *   P10 zero network attempts
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared
 * BEFORE any repo module loads. Exit 77 when node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-04-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-04-roomshome-'));
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
const C = hygiene.makeChecker('test-3692-perspectives-web');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const families = require(path.join(REPO_ROOT, 'lib/core/research-planner/families.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const idx = require(path.join(PERSP, 'index.cjs'));

const TAG = '20261005T000000Z';
const NEW_REASON = 'No search phrase could be formed from this pair\'s titles (empty, over 200 characters, or a control character), so it is answered from the room only.';
const NEW_REASON_ZONE = 'No search phrase could be formed from this zone\'s name (empty, over 200 characters, or a control character), so it is answered from the room only.';

// Invented room sentences: two short sentences each (an interior sentence boundary is what the strict Theo
// term rule refuses; a lone trailing period passes it), no quote or bracket characters. Each is its own
// phrase so a slot value can be traced back to the title it came from.
const TITLES = Object.freeze({
  'pd/P1': 'Fouling keeps raising the pressure drop. Intake filters need constant cleaning.',
  'pd/P2': 'Pumping energy dominates the bill. The plant pays it each month.',
  'sd/S1': 'The intake redesign is only a rough sketch. Nobody has costed it.',
  'sd/S2': 'Four angles on the redesign. Each suggests another architecture.',
  'pd/P3': 'Antifouling coating chemistry matters. It keeps biofilm off seawater membranes.',
  'ma/M1': 'Suppliers sell zwitterionic layers. Antifouling coating for seawater membranes is crowded.',
  'ma/M2': 'Municipal crews go street by street. Demand decides where they are sent.',
  'ca/C1': 'Ant colonies lay pheromone trails. Shorter paths get stronger over time.',
  'ma/M3': 'Rural cooperatives draw brackish groundwater. They have no treatment budget.',
  'ca/C2': 'Incumbent vendors ignore small installs. Nothing is sold below one megalitre.',
  'pd/P4': 'The bottleneck holds back the system. It is brine disposal permitting.',
  'ca/C3': 'Service contracts create feedback loops. They lock the vendor ecosystem in place.',
});
const ZONE_TITLE = 'Small remote brackish installs. They have no packaged treatment option.';
const SENT = Object.keys(TITLES).map(function (k) { return TITLES[k]; }).concat([ZONE_TITLE]);
// A title too long for a web slot (over 200 characters), made of words unique to its tag so that two long
// titles do not look alike to the recall (hsi and analogies want pairs that share structure, not words).
function longTitle(tag) {
  const out = [];
  for (let k = 0; k < 30; k += 1) out.push('word' + tag + String.fromCharCode(97 + (k % 26)) + k);
  return out.join(' ');
}

function retitle(roomDir, titles, zoneTitle) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    const sel = db.prepare('SELECT properties FROM nodes WHERE id = ?');
    const upd = db.prepare('UPDATE nodes SET properties = ? WHERE id = ?');
    Object.keys(titles).forEach(function (id) {
      const row = sel.get(id);
      const p = JSON.parse(row.properties);
      p.title = titles[id];
      upd.run(JSON.stringify(p), id);
    });
    if (zoneTitle) {
      const id = fixture.IDS.whitespace_zone;
      const p = JSON.parse(sel.get(id).properties);
      p.name = zoneTitle;
      upd.run(JSON.stringify(p), id);
    }
  } finally {
    roomDb.closeRoomDb(db);
  }
}

const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-04-a-'));
const roomA = fixture.buildPerspectiveRoom(rootA, { name: 'room' });
retitle(roomA.roomDir, TITLES, ZONE_TITLE);

function setOf(id) {
  const mod = idx.getPerspective(id);
  if (!mod) throw new Error('perspective module missing: ' + id);
  const rec = mod.runRecall(roomA.roomDir, { tag: TAG, now: '2026-10-05T00:00:00.000Z' });
  return rec.question_set;
}

// A web leaf built from the room's own sentence titles: researchable, openalex, every slot value is one of
// the retitled sentences, and the composer turns it into at least one query holding the cleaned title.
function sentenceWebLeaf(leaves, dimension) {
  const hits = leaves.filter(function (l) {
    if (dimension && l.dimension !== dimension) return false;
    if (l.researchable !== true || l.corpus !== 'openalex' || !l.slots) return false;
    const vals = Object.keys(l.slots).map(function (k) { return l.slots[k]; });
    return vals.length > 0 && vals.every(function (v) { return SENT.indexOf(v) !== -1; });
  });
  for (let i = 0; i < hits.length; i += 1) {
    const r = families.composeForLeaf(hits[i]);
    if (r.ok === true && r.queries.length >= 1) {
      const vals = Object.keys(hits[i].slots).map(function (k) { return hits[i].slots[k]; });
      const holds = r.queries.some(function (x) { return vals.some(function (v) { return x.q.indexOf(v) !== -1; }); });
      if (holds) return { leaf: hits[i], compose: r };
    }
  }
  return null;
}

function describe(leaves) {
  return JSON.stringify(leaves.map(function (l) { return [l.id, l.researchable, l.corpus, l.slots || null]; }));
}

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

function webLegFor(label, id, dimension) {
  return leg(label, function () {
    const qs = setOf(id);
    const hit = sentenceWebLeaf(qs.leaves, dimension);
    return hit !== null || 'no researchable openalex leaf built from room sentence titles: ' + describe(qs.leaves);
  });
}

function samePair(l, a, b) { return !!(l.pair && ((l.pair.a === a && l.pair.b === b) || (l.pair.a === b && l.pair.b === a))); }

(async function main() {
  await webLegFor('P1 eureka: sentence titles give a researchable web leaf that composes', 'eureka', 'eu:mechanism_transfer');
  await webLegFor('P2 analogies: sentence titles give a researchable web leaf that composes', 'analogies', 'an:structural_transfer');
  await webLegFor('P3 whitespace: a sentence zone name (over four words) gives a web leaf that composes', 'whitespace', 'ws:gap_claim');
  await webLegFor('P4 hsi: sentence titles give a researchable web leaf that composes', 'hsi', 'hsi:divergence');
  await webLegFor('P5 rs: sentence titles give a researchable web leaf that composes', 'rs', 'rs:lagging_component');

  await leg('P6 connections: Theo leaves kept, plus a cn:literature_link web leaf that composes', function () {
    const qs = setOf('connections');
    const theo = qs.leaves.filter(function (l) { return l.dimension === 'cn:lateral_path'; });
    if (theo.length < 1) return 'theo leaves missing: ' + describe(qs.leaves);
    const lit = qs.leaves.filter(function (l) { return l.dimension === 'cn:literature_link'; });
    if (lit.length < 1) return 'no cn:literature_link leaf: ' + describe(qs.leaves);
    const shape = Q.validateQuestionSet(qs);
    const hit = sentenceWebLeaf(qs.leaves, 'cn:literature_link');
    const shapeOk = lit.every(function (l) { return l.lens === 'cn.literature' && l.corpus === 'openalex' && l.researchable === true && l.slots && typeof l.slots.term === 'string' && typeof l.slots.term2 === 'string' && l.pair && l.pair.perspective === 'connections'; });
    const keyOk = qs.key_line.some(function (k) { return k.dimension === 'cn:literature_link'; });
    return (hit !== null && shapeOk && keyOk && shape.ok === true) || JSON.stringify({ hit: !!hit, shapeOk: shapeOk, keyOk: keyOk, shape: shape });
  });

  await leg('P7 no perspective module claims a Part 8 cause for a room-only leaf', function () {
    const files = fs.readdirSync(PERSP).filter(function (f) { return /\.cjs$/.test(f); });
    let n = 0;
    files.forEach(function (f) {
      const text = fs.readFileSync(path.join(PERSP, f), 'utf8');
      n += (text.match(/without sending room text/g) || []).length;
    });
    return n === 0 || 'phrase still present ' + n + ' time(s)';
  });

  // second room: the same planted things, but some titles too long for a web slot
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-04-b-'));
  const roomB = fixture.buildPerspectiveRoom(rootB, { name: 'room' });
  retitle(roomB.roomDir, Object.assign({}, TITLES, { 'ca/C1': longTitle('c1'), 'ma/M2': longTitle('m2'), 'pd/P1': longTitle('p1'), 'sd/S2': longTitle('s2') }), longTitle('zn'));
  function setB(id) {
    const rec = idx.getPerspective(id).runRecall(roomB.roomDir, { tag: TAG, now: '2026-10-05T00:00:00.000Z' });
    return rec.question_set;
  }
  const REFUSAL_CASES = [
    ['eureka', 'ca/C1', 'ma/M2', NEW_REASON],
    ['analogies', 'ca/C1', 'ma/M2', NEW_REASON],
    ['hsi', 'ca/C1', 'ma/M2', NEW_REASON],
    ['rs', 'pd/P1', 'sd/S3', NEW_REASON],
    ['whitespace', 'ca/C2', 'ma/M3', NEW_REASON_ZONE],
  ];

  await leg('P8 a title too long for a web slot still yields a room-only leaf (no slots, corpus room)', function () {
    const bad = [];
    REFUSAL_CASES.forEach(function (c) {
      const qs = setB(c[0]);
      const leaf = qs.leaves.filter(function (l) { return samePair(l, c[1], c[2]); })[0];
      if (!leaf || leaf.researchable !== false || leaf.corpus !== 'room' || leaf.slots) bad.push(c[0] + ':' + JSON.stringify(leaf && [leaf.id, leaf.researchable, leaf.corpus, leaf.slots || null]));
    });
    return bad.length === 0 || bad.join(' ; ');
  });

  await leg('P8b the room-only reason reads the new wording, no Part 8 claim', function () {
    const bad = [];
    REFUSAL_CASES.forEach(function (c) {
      const qs = setB(c[0]);
      const leaf = qs.leaves.filter(function (l) { return samePair(l, c[1], c[2]); })[0];
      if (!leaf || leaf.not_researchable_reason !== c[3]) bad.push(c[0] + ': ' + JSON.stringify(leaf && leaf.not_researchable_reason));
    });
    return bad.length === 0 || bad.join(' ; ');
  });

  await leg('P9 connections Theo leaves carry only canon names that pass the strict term rule', function () {
    const qs = setOf('connections');
    const theo = qs.leaves.filter(function (l) { return l.corpus === 'theo'; });
    if (theo.length < 1) return 'no theo leaves';
    const canon = Object.keys(fixture.IDS.canon).map(function (k) { return fixture.IDS.canon[k]; }).concat(['Systems Thinking']);
    const bad = theo.filter(function (l) {
      return !Object.keys(l.slots).every(function (k) { return families.composableTerm(l.slots[k]) === l.slots[k] && canon.indexOf(l.slots[k]) !== -1; });
    });
    const sentenceInTheo = theo.some(function (l) { return Object.keys(l.slots).some(function (k) { return SENT.indexOf(l.slots[k]) !== -1; }); });
    return (bad.length === 0 && !sentenceInTheo) || JSON.stringify(bad.map(function (l) { return l.slots; }));
  });

  await leg('P10 zero network attempts', function () {
    return net.attempts() === 0 || 'network attempts: ' + net.attempts();
  });

  process.exitCode = C.summary();
  net.restore();
})();
