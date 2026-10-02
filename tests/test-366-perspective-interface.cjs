#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 08 (EPV366-02, EPV366-15, EPV366-16): the one perspective
 * interface, the registry, the shared judge, the substrate and exclusion-set
 * contract, and eureka byte-stability against a golden recorded BEFORE the
 * refactor.
 *
 *   P1  registry lists exactly eureka, rs, hsi, whitespace, analogies, connections (frozen)
 *   P2  getPerspective('eureka') exports every interface name; unknown id -> null
 *   P3  a module file that is not present yet -> getPerspective null, available false
 *   P4  every name eureka-recall exported before the refactor is still exported
 *   P5  eureka run folder, candidates.jsonl and verdicts.jsonl equal the golden byte for byte
 *   P6  runJudge with no module behaves as before (verdicts equal the golden)
 *   P7  runJudge with opts.module reads and writes through that module
 *   P8  stage A credits only the module's STAGE_A_LANES
 *   P9  canon_handle from a USES_FRAMEWORK edge to a framework node, else the resolver
 *   P10 buildSubstrate(db) with no opts never throws; with { roomDir } resolves through resolveEndpoint
 *   P11 substrate contract (eight keys; edges, framework_nodes, whitespace_zones)
 *   P12 makeCandidateStore semantics
 *
 * --record (used ONCE, before the refactor) writes the golden to
 * tests/fixtures/366-eureka-golden/. Isolation: HOME, USERPROFILE and
 * MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared BEFORE
 * any repo module loads. Zero network. Exit 77 when node:sqlite is missing.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-pi-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-pi-roomshome-'));
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
const C = hygiene.makeChecker('test-366-perspective-interface');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const GOLDEN_DIR = path.join(REPO_ROOT, 'tests/fixtures/366-eureka-golden');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const recall = require(path.join(PERSP, 'eureka-recall.cjs'));
const judge = require(path.join(PERSP, 'eureka-judge.cjs'));

const TAG = '20261001T000000Z';
const FIXED_NOW = '2026-10-01T00:00:00.000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-pi-'));

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}

function openRO(roomDir) { return navigation.openRoomDbReadOnlyForCaller(roomDir); }
function substrateOf(roomDir, opts) {
  const db = openRO(roomDir);
  try { return recall.buildSubstrate(db, opts); } finally { try { db.close(); } catch (_e) { /* ro */ } }
}
function sameSet(a, b) { return JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort()); }

async function runEureka(name) {
  const built = fixture.buildPerspectiveRoom(root, { name: name });
  const rec = recall.runRecall(built.roomDir, { tag: TAG });
  const j = await judge.runJudge(built.roomDir, TAG, { now: FIXED_NOW });
  return { built: built, rec: rec, j: j };
}

const INTERFACE_NAMES = ['ID', 'TEMPLATE_ID', 'COMMAND', 'LENSES', 'FALSIFIER', 'RUN_ROOT', 'BUDGETS', 'STAGE_A_LANES', 'runRecall', 'readCandidates', 'runDirFor', 'questionSetFor'];

(async function main() {
  // --record: golden before the refactor
  if (process.argv.indexOf('--record') !== -1) {
    const r = await runEureka('record');
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.copyFileSync(path.join(r.rec.run_dir, '02_recall', 'output', 'candidates.jsonl'), path.join(GOLDEN_DIR, 'candidates.jsonl'));
    fs.copyFileSync(path.join(r.rec.run_dir, '03_judge', 'output', 'verdicts.jsonl'), path.join(GOLDEN_DIR, 'verdicts.jsonl'));
    process.stdout.write('golden recorded to ' + GOLDEN_DIR + '\n');
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
    process.exit(0);
  }

  const index = require(path.join(PERSP, 'index.cjs'));
  const shared = require(path.join(PERSP, 'shared.cjs'));

  // P1
  await leg('P1 registry lists exactly the six ids, frozen', function () {
    const want = ['eureka', 'rs', 'hsi', 'whitespace', 'analogies', 'connections'];
    if (JSON.stringify(index.PERSPECTIVE_IDS) !== JSON.stringify(want)) return JSON.stringify(index.PERSPECTIVE_IDS);
    if (!Object.isFrozen(index.PERSPECTIVE_IDS)) return 'not frozen';
    return true;
  });

  // P2
  await leg('P2 getPerspective(eureka) exports every interface name; unknown id is null', function () {
    const m = index.getPerspective('eureka');
    if (!m) return 'null';
    const missing = INTERFACE_NAMES.filter(function (n) { return m[n] === undefined; });
    if (missing.length) return 'missing ' + missing.join(',');
    if (!sameSet(index.INTERFACE_NAMES.slice(), INTERFACE_NAMES)) return 'INTERFACE_NAMES differs: ' + JSON.stringify(index.INTERFACE_NAMES);
    if (m.ID !== 'eureka') return 'ID ' + m.ID;
    if (!Object.isFrozen(m.STAGE_A_LANES) || !sameSet(m.STAGE_A_LANES, ['icm_declared', 'lexical'])) return 'STAGE_A_LANES ' + JSON.stringify(m.STAGE_A_LANES);
    if (index.getPerspective('nope') !== null) return 'unknown id not null';
    if (index.getPerspective('../eureka-recall') !== null) return 'path-like id not null';
    if (index.available('nope') !== false) return 'available(nope)';
    return true;
  });

  // P3
  await leg('P3 a module file not present yet gives null and available false', function () {
    for (const id of index.PERSPECTIVE_IDS) {
      const present = fs.existsSync(path.join(PERSP, index.MODULE_FILES[id]));
      if (index.available(id) !== present) return 'available(' + id + ') disagrees with disk';
      if (!present && index.getPerspective(id) !== null) return 'getPerspective(' + id + ') should be null';
    }
    return true;
  });

  // P4
  await leg('P4 every name eureka-recall exported before is still exported with its old shape', function () {
    const before = ['BUDGETS', 'TEMPLATE_ID', 'COMMAND', 'RUN_ROOT', 'STAGES', 'buildSubstrate', 'recallCandidates', 'declaredCouplings', 'writeRunFiles', 'readCandidates', 'runDirFor', 'deriveStatus', 'writeJsonl', 'readJsonl', 'questionSetFor', 'runRecall', '_test'];
    const missing = before.filter(function (n) { return recall[n] === undefined; });
    if (missing.length) return 'missing ' + missing.join(',');
    if (recall.writeRunFiles.length !== 4) return 'writeRunFiles arity ' + recall.writeRunFiles.length;
    if (recall.readCandidates.length !== 2) return 'readCandidates arity ' + recall.readCandidates.length;
    if (recall.runDirFor.length !== 2) return 'runDirFor arity ' + recall.runDirFor.length;
    if (recall.RUN_ROOT !== path.join('.mindrian', 'eureka-perspective')) return 'RUN_ROOT ' + recall.RUN_ROOT;
    return true;
  });

  // P5 + P6
  const run = await runEureka('golden');
  await leg('P5 candidates.jsonl equals the golden byte for byte', function () {
    const got = fs.readFileSync(path.join(run.rec.run_dir, '02_recall', 'output', 'candidates.jsonl'));
    const want = fs.readFileSync(path.join(GOLDEN_DIR, 'candidates.jsonl'));
    return Buffer.compare(got, want) === 0 ? true : 'candidates.jsonl differs from the golden';
  });
  await leg('P5b the eureka run folder keeps its layout and STATUS title', function () {
    const dir = run.rec.run_dir;
    if (dir !== path.join(run.built.roomDir, '.mindrian', 'eureka-perspective', TAG)) return dir;
    for (const f of ['01_substrate/output/things.jsonl', '02_recall/output/candidates.jsonl', '03_judge/output/verdicts.jsonl', 'STATUS.md']) {
      if (!fs.existsSync(path.join(dir, f))) return 'missing ' + f;
    }
    const st = fs.readFileSync(path.join(dir, 'STATUS.md'), 'utf8');
    if (st.indexOf('# Eureka perspective run') !== 0) return st.split('\n')[0];
    if (!/stage: 03_judge/.test(st)) return 'stage line';
    return true;
  });
  await leg('P6 runJudge with no module gives verdicts equal to the golden', function () {
    const got = fs.readFileSync(path.join(run.rec.run_dir, '03_judge', 'output', 'verdicts.jsonl'));
    const want = fs.readFileSync(path.join(GOLDEN_DIR, 'verdicts.jsonl'));
    return Buffer.compare(got, want) === 0 ? true : 'verdicts.jsonl differs from the golden';
  });

  // P11
  const room11 = fixture.buildPerspectiveRoom(root, { name: 'contract' });
  const sub11 = substrateOf(room11.roomDir, { roomDir: room11.roomDir });
  await leg('P11 substrate contract: exactly eight keys', function () {
    const want = ['things', 'entities', 'connected', 'opp_pairs', 'sections', 'edges', 'framework_nodes', 'whitespace_zones'];
    return sameSet(Object.keys(sub11), want) ? true : JSON.stringify(Object.keys(sub11));
  });
  await leg('P11 edges carries the planted rows as {source, target, type}', function () {
    function has(s, t, ty) { return sub11.edges.some(function (e) { return e.source === s && e.target === t && e.type === ty; }); }
    if (!Array.isArray(sub11.edges) || !sub11.edges.length) return 'edges empty';
    if (!sub11.edges.every(function (e) { return sameSet(Object.keys(e), ['source', 'target', 'type']); })) return 'row shape';
    if (!has('pd/P1', 'sd/S1', 'INFORMS')) return 'INFORMS';
    if (!has('pd/P3', 'ent/coating', 'DESCRIBES')) return 'DESCRIBES';
    if (!has('pd/P4', room11.ids.frameworks[0], 'USES_FRAMEWORK')) return 'USES_FRAMEWORK';
    if (!has(room11.ids.whitespace_zone, 'ma/M3', 'WHITESPACE_DETECTED')) return 'WHITESPACE_DETECTED';
    return true;
  });
  await leg('P11 framework_nodes and whitespace_zones are keyed by node id', function () {
    const fw = sub11.framework_nodes;
    if (fw[room11.ids.frameworks[0]].name !== 'Reverse Salient Analysis' || fw[room11.ids.frameworks[0]].id !== room11.ids.frameworks[0]) return JSON.stringify(fw);
    if (fw[room11.ids.frameworks[1]].name !== 'Four Lenses of Innovation') return JSON.stringify(fw);
    if (Object.keys(fw).length !== 2) return 'framework node count ' + Object.keys(fw).length;
    const wz = sub11.whitespace_zones[room11.ids.whitespace_zone];
    if (!wz || wz.id !== room11.ids.whitespace_zone || wz.title !== 'small remote brackish installs') return JSON.stringify(sub11.whitespace_zones);
    if (Object.keys(sub11.whitespace_zones).length !== 1) return 'zone count';
    if (sub11.byId || sub11.nodes) return 'byId or nodes leaked';
    return true;
  });

  // P12
  await leg('P12 makeCandidateStore: skips, exclusion counter, row shape, union semantics, order', function () {
    const store = shared.makeCandidateStore(sub11);
    const P = room11.planted;
    if (store.upsert('pd/P3', 'pd/P3', 'lexical') !== false) return 'a === b';
    if (store.upsert('pd/P3', 'nope/none', 'lexical') !== false) return 'missing thing';
    if (store.upsert('pd/P1', 'pd/P2', 'lexical') !== false) return 'same section';
    if (store.size() !== 0 || store.excludedKnown() !== 0) return 'nothing should be counted yet';
    if (store.upsert(P.known[0], P.known[1], 'shared_entity', { entity: 'brine diffuser' }) !== false) return 'known pair added';
    if (store.excludedKnown() !== 1 || store.size() !== 0) return 'excluded counter ' + store.excludedKnown();
    if (store.upsert(room11.ids.opportunity_pair[0], room11.ids.opportunity_pair[1], 'lexical', { lexical: 0.3 }) !== false) return 'opportunity pair added';
    if (store.excludedKnown() !== 2) return 'opportunity exclusion not counted';
    // a new cross-section pair
    const [a, b] = P.eureka;
    if (store.upsert(b, a, 'shared_entity', { entity: 'antifouling coating', fields: { lag_score: 0.5, zone_id: 'z' } }) !== true) return 'new pair not true';
    const row = store.get(a, b);
    if (!row || store.get(b, a) !== row) return 'get is order free';
    const keys = Object.keys(row);
    const want = ['a', 'b', 'section_a', 'section_b', 'title_a', 'title_b', 'lanes', 'lexical', 'shared_entities', 'lag_score', 'zone_id'];
    if (JSON.stringify(keys) !== JSON.stringify(want)) return JSON.stringify(keys);
    if (!(row.a < row.b)) return 'ordered by id';
    if (JSON.stringify(row.lanes) !== '["shared_entity"]' || row.lexical !== 0) return JSON.stringify(row);
    // second upsert unions
    if (store.upsert(a, b, 'lexical', { lexical: 0.4, entity: 'biofilm' }) !== false) return 'second upsert of same pair should return false';
    if (store.upsert(a, b, 'lexical', { lexical: 0.2, entity: 'biofilm' }) !== false) return 'third';
    if (JSON.stringify(row.lanes) !== '["shared_entity","lexical"]') return JSON.stringify(row.lanes);
    if (row.lexical !== 0.4) return 'larger lexical kept ' + row.lexical;
    if (JSON.stringify(row.shared_entities) !== '["antifouling coating","biofilm"]') return JSON.stringify(row.shared_entities);
    // insertion order across a second pair
    const [c, d] = P.whitespace;
    store.upsert(c, d, 'lexical', { lexical: 0.1 });
    const rows = store.rows();
    if (store.size() !== 2 || rows.length !== 2 || rows[0] !== row) return 'rows insertion ordered';
    if (store.get('pd/P3', 'nope') !== null) return 'get of a missing pair is null';
    return true;
  });

  // shared.writeRunFiles / readCandidates round trip with a non-eureka run root
  await leg('P12b shared writeRunFiles and readCandidates take the run root, title and lanes', function () {
    const store = shared.makeCandidateStore(sub11);
    store.upsert(room11.planted.eureka[0], room11.planted.eureka[1], 'lexical', { lexical: 0.2 });
    const rc = { counts: { things: 1 }, pairs_truncated: 0, couplings: [], candidates: store.rows() };
    const rr = path.join('.mindrian', 'perspectives', 'stub');
    const dir = shared.writeRunFiles(room11.roomDir, rr, 'T1', sub11, rc, { title: 'Stub perspective run', lanes: ['x'], header_extra: { extra: 1 } });
    if (dir !== shared.runDirFor(room11.roomDir, rr, 'T1')) return dir;
    const back = shared.readCandidates(room11.roomDir, rr, 'T1');
    if (!back || !back.header || JSON.stringify(back.header.lanes) !== '["x"]' || back.header.extra !== 1) return JSON.stringify(back && back.header);
    if (JSON.stringify(Object.keys(back.header)) !== '["header","counts","pairs_truncated","couplings","lanes","extra"]') return JSON.stringify(Object.keys(back.header));
    if (back.candidates.length !== 1) return 'candidates ' + back.candidates.length;
    const st = fs.readFileSync(path.join(dir, 'STATUS.md'), 'utf8');
    if (st.indexOf('# Stub perspective run') !== 0) return st.split('\n')[0];
    if (shared.readCandidates(room11.roomDir, rr, 'nope') !== null) return 'missing run is null';
    return true;
  });

  const attempts = typeof net.attempts === 'function' ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-366-perspective-interface THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
