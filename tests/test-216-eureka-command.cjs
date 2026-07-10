#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 216-02 -- hermetic offline end-to-end proof for the user-facing Eureka
 * surface: the additive `--pairs room` mode on the shipped portfolio runner
 * (scripts/eureka-portfolio-report.cjs) AND the fire-and-return dispatcher
 * (scripts/eureka-command.cjs) that Plan 03's commands/eureka.md body shells.
 *
 * ZERO network (Canon Part 8): every leg runs --offline (the deterministic stub
 * encoder), and the file passes standalone as well as under the run-all
 * aggregator's offline preload. No idea-graph.json is ever written for a room-mode
 * leg -- the whole point is that a plain room.db produces the SAME ranked,
 * tail-flagged, Opportunity-Statement report with no dev flags (D-01).
 *
 * Behaviors 1-6 pin the runner's room mode (Task 1); 7-12 pin the dispatcher
 * (Task 2). Behavior 6 is a no-regression pin: it shells the 215 suite so the
 * graph/full path is proven untouched by the additive room branch.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const runner = require(path.join(REPO_ROOT, 'scripts/eureka-portfolio-report.cjs'));
const dispatcher = require(path.join(REPO_ROOT, 'scripts/eureka-command.cjs'));

const DISPATCHER = path.join(REPO_ROOT, 'scripts', 'eureka-command.cjs');
const PRELOAD = path.join(REPO_ROOT, 'tests', 'eureka-offline-preload.cjs');

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

// Two vocab pools keep the two synthetic domains lexically separable so the stub
// encoder yields non-degenerate cross-domain differentials (the 215 fixture idiom).
// No K/M/B figures -> never trips the Part 8 figure-guard in scoreMeasured.
const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance', 'thermal', 'diffraction', 'magnet', 'crystal'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor', 'peptide', 'organelle', 'synapse', 'antibody'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 3) % pool.length];
  const c = pool[(idx + 6) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load. A rising ' + c
    + ' interacts with the ' + a + ' pathway. This node explores how ' + b + ' and '
    + c + ' couple across the boundary.';
}

// Distinct created_at per node (spread across days) so the room-native growth
// axis (created_at recency) is non-degenerate.
function isoDay(i) {
  return new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString();
}

// Build a plain room.db with `count` nodes across two synthetic domains plus the
// given typed edges. NO idea-graph.json is ever written: room mode sources pairs
// and signals from room.db alone (D-01). Returns the room DIRECTORY.
function makeFixtureRoom(count, edgeSpecs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-216-cmd-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  const half = Math.ceil(count / 2);
  for (let i = 1; i <= count; i += 1) {
    const id = 'N' + i;
    const inA = i <= half;
    const pool = inA ? POOL_A : POOL_B;
    const props = {
      text: bodyFor(i, pool),
      section: inA ? 'physics' : 'biology',
      parentId: inA ? 'DOM_A' : 'DOM_B',
    };
    const created = isoDay(i);
    ins.run(id, 'Claim', JSON.stringify(props), 'fixture://' + id, 'import', created, created);
  }
  if (edgeSpecs && edgeSpecs.length) {
    const eins = db.prepare('INSERT INTO edges(source,target,type,properties) VALUES (?,?,?,?)');
    for (let i = 0; i < edgeSpecs.length; i += 1) {
      const e = edgeSpecs[i];
      eins.run(e.source, e.target, e.type || 'CONVERGES', JSON.stringify(e.props || {}));
    }
  }
  closeRoomDb(db);
  return dir;
}

// N1,N2 are both physics (same type, same domain): the cross-boundary rule would
// skip them, so they only score if the room's OWN cited edge surfaces them (the
// union rule, DG-2 spirit). (N2,N1) is the reverse duplicate -> union dedupe.
const EDGES_36 = [
  { source: 'N1', target: 'N2' },
  { source: 'N2', target: 'N1' },
  { source: 'N1', target: 'N20', props: { shared_problems: ['boundary coupling'] } },
  { source: 'N5', target: 'N25', props: { shared_problems: ['resonant transfer'] } },
  { source: 'N10', target: 'N30' },
];

function countPair(ranked, x, y) {
  let n = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    const r = ranked[i];
    if ((r.a === x && r.b === y) || (r.a === y && r.b === x)) n += 1;
  }
  return n;
}

// Dispatcher path contract (mirrors scripts/eureka-command.cjs).
function cmdReportDir(roomDir) { return path.join(roomDir, '.mindrian', 'eureka'); }
function cmdOutMd(roomDir) { return path.join(cmdReportDir(roomDir), 'portfolio-report.md'); }
function cmdOutJson(roomDir) { return path.join(cmdReportDir(roomDir), 'portfolio-report.json'); }
function cmdStatus(roomDir) { return path.join(cmdReportDir(roomDir), 'status.json'); }

function fileExists(p) { try { return fs.statSync(p).isFile(); } catch (_e) { return false; } }
function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

// Run fn() with process.stdout/stderr captured; restore always. Returns
// { code, out, err }.
async function capture(fn) {
  const out = [];
  const err = [];
  const oo = process.stdout.write;
  const oe = process.stderr.write;
  process.stdout.write = function (s) { out.push(String(s)); return true; };
  process.stderr.write = function (s) { err.push(String(s)); return true; };
  let code;
  try { code = await fn(); } finally { process.stdout.write = oo; process.stderr.write = oe; }
  return { code: code, out: out.join(''), err: err.join('') };
}

// A minimal cytoscape-shaped idea-graph keyed by the SAME ids the room uses (the
// catalogId join falls back to row.id for these fixtures), with cross-domain
// CONVERGES edges so graph mode has cited pairs to score.
function makeIdeaGraph(filePath, count, edges) {
  const nodes = [];
  const half = Math.ceil(count / 2);
  for (let i = 1; i <= count; i += 1) {
    const id = 'N' + i;
    const inA = i <= half;
    nodes.push({
      data: {
        id: id,
        cnumber: String(i),
        title: (inA ? 'physics tech ' : 'biology tech ') + i,
        section: inA ? 'physics' : 'biology',
        pair_count: 6 + (i % 5),
        degree: 8 + (i % 4),
        primary_problem: (inA ? 'energy transport gap ' : 'cell signaling gap ') + i,
        problems: [(inA ? 'energy transport gap ' : 'cell signaling gap ') + i],
      },
    });
  }
  const eels = (edges || []).map(function (e) {
    return { data: { type: 'CONVERGES', source: e.source, target: e.target, shared_problems: e.shared_problems || ['bridge'] } };
  });
  const graph = { meta: { honest_nouns: 'hermetic fixture idea-graph' }, elements: { nodes: nodes, edges: eels } };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(graph, null, 2), 'utf8');
}

async function run() {
  const tmpRooms = [];
  const track = function (dir) { tmpRooms.push(dir); return dir; };

  try {
    // ==============================================================
    // Behavior 1: room mode on a 36-node two-domain room WITH typed edges and
    // NO graph file -> exit 0, provenance pairs_mode 'room', ranked >= 1,
    // tail not insufficient.
    // ==============================================================
    const room36 = track(makeFixtureRoom(36, EDGES_36));
    const md1 = path.join(room36, 'out.md');
    const json1 = path.join(room36, 'out.json');
    const code1 = await runner.main([
      '--db', room36, '--pairs', 'room', '--offline', '--top', '25', '--out', md1, '--json', json1,
    ]);
    ok(code1 === 0, 'behavior 1: room-mode main() exits 0 (got ' + code1 + ')');
    ok(fs.existsSync(md1) && fs.existsSync(json1), 'behavior 1: room-mode md + json written');
    const j1 = JSON.parse(fs.readFileSync(json1, 'utf8'));
    ok(j1.provenance && j1.provenance.pairs_mode === 'room', 'behavior 1: provenance pairs_mode === room (got '
      + (j1.provenance ? j1.provenance.pairs_mode : 'n/a') + ')');
    ok(Array.isArray(j1.ranked) && j1.ranked.length >= 1, 'behavior 1: ranked has at least one pair (got '
      + (j1.ranked ? j1.ranked.length : 'n/a') + ')');
    ok(j1.tail && j1.tail.insufficient_structure === false, 'behavior 1: 36 >= MIN_COHORT -> tail not insufficient');

    // ==============================================================
    // Behavior 2: the same call with --graph pointing at a NONEXISTENT path
    // STILL exits 0 (room mode never touches the graph path -- the D-01 consequence).
    // ==============================================================
    const md2 = path.join(room36, 'out2.md');
    const json2 = path.join(room36, 'out2.json');
    const code2 = await runner.main([
      '--db', room36, '--pairs', 'room', '--graph', '/nonexistent/does-not-exist.json',
      '--offline', '--top', '25', '--out', md2, '--json', json2,
    ]);
    ok(code2 === 0, 'behavior 2: room mode ignores a nonexistent --graph path, exits 0 (got ' + code2 + ')');
    ok(fs.existsSync(json2), 'behavior 2: report still written despite the bogus --graph');

    // ==============================================================
    // Behavior 3: an edge between two SAME-type SAME-domain nodes (N1,N2) still
    // appears among scored pairs (the union rule), and the (N1,N2)/(N2,N1)
    // duplicate dedupes to exactly one ranked pair.
    // ==============================================================
    const md3 = path.join(room36, 'out3.md');
    const json3 = path.join(room36, 'out3.json');
    const code3 = await runner.main([
      '--db', room36, '--pairs', 'room', '--offline', '--top', '5000', '--out', md3, '--json', json3,
    ]);
    ok(code3 === 0, 'behavior 3: high-top room run exits 0 (got ' + code3 + ')');
    const j3 = JSON.parse(fs.readFileSync(json3, 'utf8'));
    const n12 = countPair(j3.ranked, 'N1', 'N2');
    ok(n12 === 1, 'behavior 3: same-type same-domain cited edge (N1,N2) scores exactly once (union dedupe, got ' + n12 + ')');

    // ==============================================================
    // Behavior 4: a 10-node room (below MIN_COHORT 30) -> exit 0, tail
    // insufficient_structure true, markdown carries the directive phrase.
    // ==============================================================
    const room10 = track(makeFixtureRoom(10, [{ source: 'N1', target: 'N6' }, { source: 'N2', target: 'N7' }]));
    const md4 = path.join(room10, 'out.md');
    const json4 = path.join(room10, 'out.json');
    const code4 = await runner.main([
      '--db', room10, '--pairs', 'room', '--offline', '--top', '25', '--out', md4, '--json', json4,
    ]);
    ok(code4 === 0, 'behavior 4: 10-node room mode exits 0 (got ' + code4 + ')');
    const j4 = JSON.parse(fs.readFileSync(json4, 'utf8'));
    ok(j4.tail && j4.tail.insufficient_structure === true, 'behavior 4: sub-MIN_COHORT -> insufficient_structure true');
    const md4txt = fs.readFileSync(md4, 'utf8');
    ok(md4txt.indexOf('Not enough entries for a tail read') !== -1,
      'behavior 4: markdown carries the directive phrase "Not enough entries for a tail read"');

    // ==============================================================
    // Behavior 5: room-mode provenance growth proxy + graph provenance row.
    // ==============================================================
    ok(j1.provenance.growth_proxy === 'created_at-recency (room-native)',
      'behavior 5: growth_proxy overridden to created_at-recency (room-native) (got ' + j1.provenance.growth_proxy + ')');
    const md1txt = fs.readFileSync(md1, 'utf8');
    ok(md1txt.indexOf('(room-native: no idea-graph)') !== -1,
      'behavior 5: markdown Graph provenance row reads (room-native: no idea-graph)');

    // ==============================================================
    // Behavior 6 (no-regression pin): the 215 suite is still green after the
    // additive room branch (graph + full modes untouched).
    // ==============================================================
    const preload = path.join(REPO_ROOT, 'tests', 'eureka-offline-preload.cjs');
    const res215 = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-215-portfolio-report.cjs')], {
      cwd: REPO_ROOT,
      env: Object.assign({}, process.env, {
        NODE_OPTIONS: (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') + '--require ' + preload,
      }),
      encoding: 'utf8',
    });
    ok(res215.status === 0, 'behavior 6: test-215-portfolio-report.cjs still exits 0 (graph/full unregressed)');

    // ==============================================================
    // Behavior 7: dispatcher `run` (offline) on a fixture room -> exit 0; report
    // md + json exist under .mindrian/eureka/; status.json reads state 'done'.
    // ==============================================================
    const roomD = track(makeFixtureRoom(36, EDGES_36));
    const code7 = await dispatcher.main([roomD, 'run', '--offline']);
    ok(code7 === 0, 'behavior 7: dispatcher run exits 0 (got ' + code7 + ')');
    ok(fileExists(cmdOutMd(roomD)) && fileExists(cmdOutJson(roomD)), 'behavior 7: report md + json written under .mindrian/eureka/');
    ok(fileExists(cmdStatus(roomD)), 'behavior 7: status.json written');
    const st7 = JSON.parse(fs.readFileSync(cmdStatus(roomD), 'utf8'));
    ok(st7.state === 'done', 'behavior 7: status state === done (got ' + st7.state + ')');
    ok(typeof st7.started_at === 'string' && typeof st7.finished_at === 'string', 'behavior 7: status carries started_at + finished_at');
    ok(typeof st7.out === 'string' && typeof st7.json === 'string', 'behavior 7: status carries out + json paths');

    // ==============================================================
    // Behavior 8: `report` prints the report JSON to stdout (provenance + ranked
    // + statements keys); `status` prints one JSON line with state 'done'.
    // ==============================================================
    const rep8 = await capture(function () { return dispatcher.main([roomD, 'report']); });
    ok(rep8.code === 0, 'behavior 8: report exits 0 on a scanned room');
    let repJson = null;
    try { repJson = JSON.parse(rep8.out); } catch (_e) { repJson = null; }
    ok(repJson && repJson.provenance && Array.isArray(repJson.ranked) && Array.isArray(repJson.statements),
      'behavior 8: report stdout is JSON with provenance + ranked + statements');
    const stt8 = await capture(function () { return dispatcher.main([roomD, 'status']); });
    ok(stt8.code === 0, 'behavior 8: status exits 0');
    const stt8Lines = stt8.out.trim().split('\n');
    let statusParsed = null;
    try { statusParsed = JSON.parse(stt8Lines[0]); } catch (_e) { statusParsed = null; }
    ok(stt8Lines.length === 1 && statusParsed && statusParsed.state === 'done',
      'behavior 8: status prints ONE JSON line with state done');

    // ==============================================================
    // Behavior 9: `status` on a never-scanned room -> {"state":"none"} exit 0;
    // `report` on it -> exit 1 with a 3-line-pattern stderr naming the fix.
    // ==============================================================
    const roomFresh = track(makeFixtureRoom(12, []));
    const s9 = await capture(function () { return dispatcher.main([roomFresh, 'status']); });
    ok(s9.code === 0, 'behavior 9: status on never-scanned room exits 0');
    ok(s9.out.trim() === '{"state":"none"}', 'behavior 9: status prints {"state":"none"} (got ' + s9.out.trim() + ')');
    const r9 = await capture(function () { return dispatcher.main([roomFresh, 'report']); });
    ok(r9.code === 1, 'behavior 9: report on never-scanned room exits 1');
    ok(r9.err.indexOf('/mos:eureka') !== -1, 'behavior 9: report error names the fix (run /mos:eureka)');
    ok(r9.err.indexOf('Why:') !== -1 && r9.err.indexOf('Fix:') !== -1, 'behavior 9: report error is the 3-line What/Why/Fix pattern');

    // ==============================================================
    // Behavior 10: substrate resolution. room + local idea-graph -> pairs graph
    // against THAT file; room without -> pairs room; explicit --graph beats both.
    // The JHU fixture is NEVER referenced.
    // ==============================================================
    const roomWithGraph = track(makeFixtureRoom(36, EDGES_36));
    makeIdeaGraph(path.join(roomWithGraph, '.mindrian', 'idea-graph.json'), 36,
      [{ source: 'N1', target: 'N20' }, { source: 'N5', target: 'N25' }]);
    const cg = await dispatcher.main([roomWithGraph, 'run', '--offline']);
    ok(cg === 0, 'behavior 10: run with a room-local idea-graph exits 0');
    const jg = JSON.parse(fs.readFileSync(cmdOutJson(roomWithGraph), 'utf8'));
    ok(jg.provenance.pairs_mode === 'graph', 'behavior 10: room-local idea-graph -> pairs_mode graph (got ' + jg.provenance.pairs_mode + ')');
    const mdg = fs.readFileSync(cmdOutMd(roomWithGraph), 'utf8');
    ok(mdg.indexOf('jhtv') === -1 && JSON.stringify(jg).indexOf('jhtv') === -1, 'behavior 10: graph run never references the JHU fixture');

    const roomNoGraph = track(makeFixtureRoom(36, EDGES_36));
    const cr = await dispatcher.main([roomNoGraph, 'run', '--offline']);
    ok(cr === 0, 'behavior 10: run without an idea-graph exits 0');
    const jr = JSON.parse(fs.readFileSync(cmdOutJson(roomNoGraph), 'utf8'));
    ok(jr.provenance.pairs_mode === 'room', 'behavior 10: no idea-graph -> pairs_mode room (got ' + jr.provenance.pairs_mode + ')');

    const explicitGraph = path.join(roomNoGraph, 'explicit-graph.json');
    makeIdeaGraph(explicitGraph, 36, [{ source: 'N1', target: 'N20' }, { source: 'N5', target: 'N25' }]);
    const ce = await dispatcher.main([roomNoGraph, 'run', '--offline', '--graph', explicitGraph]);
    ok(ce === 0, 'behavior 10: run with explicit --graph exits 0');
    const je = JSON.parse(fs.readFileSync(cmdOutJson(roomNoGraph), 'utf8'));
    ok(je.provenance.pairs_mode === 'graph', 'behavior 10: explicit --graph beats room-native -> pairs_mode graph');

    // ==============================================================
    // Behavior 11: a nonexistent ROOM_DIR -> exit 1, clean stderr (no stack trace).
    // ==============================================================
    const r11 = await capture(function () { return dispatcher.main(['/no/such/room/anywhere', 'run', '--offline']); });
    ok(r11.code === 1, 'behavior 11: nonexistent ROOM_DIR exits 1');
    ok(r11.err.indexOf('    at ') === -1 && r11.err.indexOf('THREW') === -1, 'behavior 11: stderr is a clean error, never a stack trace');

    // ==============================================================
    // Behavior 12 (fire-and-return, D-05): `start` returns fast and prints paths;
    // the detached child drives status.json to 'done' and writes the report.
    // ==============================================================
    const roomStart = track(makeFixtureRoom(36, EDGES_36));
    const childEnv = Object.assign({}, process.env, {
      NODE_OPTIONS: (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') + '--require ' + PRELOAD,
    });
    const startRes = spawnSync(process.execPath, [DISPATCHER, roomStart, 'start', '--offline'], {
      cwd: REPO_ROOT, env: childEnv, encoding: 'utf8',
    });
    ok(startRes.status === 0, 'behavior 12: start exits 0 immediately (got ' + startRes.status + ')');
    ok(startRes.stdout.indexOf('eureka scan started (background)') !== -1, 'behavior 12: start prints the background banner');
    ok(startRes.stdout.indexOf(cmdStatus(roomStart)) !== -1 || startRes.stdout.indexOf('status:') !== -1, 'behavior 12: start prints the status path');
    // Poll (bounded <= 30s) for the detached child to finish.
    let finalState = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (fileExists(cmdStatus(roomStart))) {
        try { finalState = JSON.parse(fs.readFileSync(cmdStatus(roomStart), 'utf8')).state; } catch (_e) { finalState = null; }
      }
      if (finalState === 'done' || finalState === 'failed') break;
      // eslint-disable-next-line no-await-in-loop
      await delay(250);
    }
    ok(finalState === 'done', 'behavior 12: detached child drives status to done (got ' + finalState + ')');
    ok(fileExists(cmdOutMd(roomStart)) && fileExists(cmdOutJson(roomStart)), 'behavior 12: detached child wrote the report files');
  } finally {
    for (let i = 0; i < tmpRooms.length; i += 1) {
      fs.rmSync(tmpRooms[i], { recursive: true, force: true });
    }
  }

  if (FAIL > 0) {
    process.stderr.write('test-216-eureka-command: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('test-216-eureka-command: ' + PASS + ' assertions passed\n');
}

run().catch(function (err) {
  process.stderr.write('test-216-eureka-command THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
