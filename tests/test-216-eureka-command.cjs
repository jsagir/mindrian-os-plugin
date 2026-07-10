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
