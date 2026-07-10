#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-04 -- offline structural end-to-end proof for the composed portfolio
 * runner. Hermetic: a tmp fixture room (openRoomDb) + a tmp fixture idea-graph
 * JSON, run through the runner's exported main() with the deterministic stub
 * encoder. ZERO network (Canon Part 8); the offline preload flips remote models
 * off in the aggregator, and this test never reaches a model.
 *
 * It proves the WHOLE composed pipeline structurally in BOTH DG-2 pair modes:
 *   - --pairs graph: the cited CONVERGES substrate ranked + tail + statements,
 *   - --pairs full: the 211 cross-boundary enumeration works at fixture scale.
 *
 * The fixture is engineered so 36 techs (> MIN_COHORT 30) let the tail path
 * classify, ids C00001..C00036 exercise the cnumber recency axis, and one edge
 * (C00010 x C00011) is constructed complementary-weak (disjoint weak dimensions)
 * so the tail-driven candidate path is reachable.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const runner = require(path.join(REPO_ROOT, 'scripts/eureka-portfolio-report.cjs'));

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

// A distinct multi-sentence body per node (no K/M/B figures -> never trips the
// Part 8 figure-guard). Two vocab pools keep the two synthetic domains lexically
// separable so the stub encoder yields non-degenerate cross-domain differentials.
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

function makeFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-215-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 1; i <= 36; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 18;
    const pool = inA ? POOL_A : POOL_B;
    const props = {
      text: bodyFor(i, pool),
      section: inA ? 'physics' : 'biology',
      parentId: inA ? 'DOM_A' : 'DOM_B', // 2 synthetic root domains
    };
    ins.run(id, 'Claim', JSON.stringify(props), 'fixture://' + id, 'import', now, now);
  }
  closeRoomDb(db);
  return dir;
}

// techMap fields the runner reads: cnumber, title, primary_tier, pair_count,
// degree, section, primary_problem, problems. Design two techs to be
// complementary-weak: C00010 weak ONLY in strategic_fit (tier 3), C00011 weak
// ONLY in validated_demand (lowest pair_count). Both keep high degree so the
// per-tech feasibility axis is not weak on either side.
function makeFixtureGraph(graphPath) {
  const nodes = [];
  for (let i = 1; i <= 36; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 18;
    let tier = 1;
    let pairCount = 6 + (i % 7); // mid-range by default
    let degree = 10 + (i % 5);
    if (i === 10) { tier = 3; pairCount = 30; degree = 30; }      // strategic_fit weak only
    if (i === 11) { tier = 1; pairCount = 0; degree = 30; }        // validated_demand weak only
    nodes.push({
      data: {
        id: id,
        cnumber: id,
        title: (inA ? 'physics tech ' : 'biology tech ') + i,
        primary_tier: tier,
        pair_count: pairCount,
        degree: degree,
        section: inA ? 'physics' : 'biology',
        primary_problem: (inA ? 'energy transport gap ' : 'cell signaling gap ') + i,
        problems: [(inA ? 'energy transport gap ' : 'cell signaling gap ') + i],
      },
    });
  }
  const edges = [
    { data: { type: 'CONVERGES', source: 'C00010', target: 'C00011', shared_problems: ['cross-domain transport-signaling bridge'] } },
    { data: { type: 'CONVERGES', source: 'C00001', target: 'C00020', shared_problems: ['boundary coupling'] } },
    { data: { type: 'CONVERGES', source: 'C00005', target: 'C00025', shared_problems: ['resonant transfer'] } },
    { data: { type: 'CONVERGES', source: 'C00018', target: 'C00019', shared_problems: ['interface control'] } },
    // duplicate (unordered) of the first pair -> must dedupe to one
    { data: { type: 'CONVERGES', source: 'C00011', target: 'C00010', shared_problems: ['dup should be dropped'] } },
  ];
  const graph = {
    meta: { honest_nouns: 'A hermetic fixture: 36 synthetic techs across 2 domains, 4 cited pairs.' },
    elements: { nodes: nodes, edges: edges },
  };
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf8');
}

// Every statement block must be honestly labeled: banked with a verdict, or the
// pending label. The fixture has no synchronous critic verdict, so expect pending.
function statementsHonest(md) {
  const blocks = md.split(/^### \d+\. rank /m).slice(1);
  if (blocks.length === 0) return false;
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (b.indexOf('NOT YET BANKED (critic pending)') === -1 && b.indexOf('BANKED (critic ') === -1) {
      return false;
    }
  }
  return true;
}

async function run() {
  const roomDir = makeFixtureRoom();
  const graphPath = path.join(roomDir, 'fixture-graph.json');
  makeFixtureGraph(graphPath);
  const outMd = path.join(roomDir, 'out.md');
  const outJson = path.join(roomDir, 'out.json');

  try {
    // ---- Leg 1: --pairs graph ----
    const code1 = await runner.main([
      '--db', roomDir, '--graph', graphPath, '--pairs', 'graph', '--offline',
      '--top', '25', '--out', outMd, '--json', outJson,
    ]);
    ok(code1 === 0, 'graph-mode main() exits 0 (got ' + code1 + ')');
    ok(fs.existsSync(outMd), 'graph-mode markdown report written');
    ok(fs.existsSync(outJson), 'graph-mode JSON sibling written');

    const md = fs.readFileSync(outMd, 'utf8');
    ok(md.indexOf('## Ranked top') !== -1, "report has '## Ranked top' heading");
    ok(md.indexOf('## Tail quadrant (weak signals)') !== -1, "report has '## Tail quadrant (weak signals)' heading");
    ok(md.indexOf('## Opportunity Statements') !== -1, "report has '## Opportunity Statements' heading");

    ok(md.indexOf('CR') !== -1, "provenance carries the AHP CR label");
    ok(md.indexOf('attention-growth-only') !== -1, "provenance carries the tail composition 'attention-growth-only'");
    ok(md.indexOf('cnumber-recency') !== -1, "provenance carries the growth proxy 'cnumber-recency'");
    ok(md.indexOf('OFFLINE CAVEAT') !== -1, "offline honesty caveat present (stub is not embedding-quality evidence)");

    ok(statementsHonest(md), "every statement block is labeled pending or a real verdict");

    const j = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    ok(Array.isArray(j.ranked) && j.ranked.length >= 1, 'JSON ranked has at least one pair (got '
      + (j.ranked ? j.ranked.length : 'n/a') + ')');
    ok(j.provenance && j.provenance.converges_pairs === 4, 'CONVERGES dedupe: 5 raw edges -> 4 unique pairs (got '
      + (j.provenance ? j.provenance.converges_pairs : 'n/a') + ')');
    ok(j.provenance && j.provenance.cohort_techs === 36, 'cohort read at run time = 36 techs (got '
      + (j.provenance ? j.provenance.cohort_techs : 'n/a') + ')');
    ok(j.tail && j.tail.insufficient_structure === false, 'tail classified (36 > MIN_COHORT, not insufficient_structure)');

    // ---- Leg 2: --pairs full (the 211 cross-boundary enumeration, offline) ----
    const outMd2 = path.join(roomDir, 'out-full.md');
    const outJson2 = path.join(roomDir, 'out-full.json');
    const code2 = await runner.main([
      '--db', roomDir, '--graph', graphPath, '--pairs', 'full', '--offline',
      '--top', '25', '--out', outMd2, '--json', outJson2,
    ]);
    ok(code2 === 0, 'full-mode main() exits 0 (got ' + code2 + ')');
    const jf = JSON.parse(fs.readFileSync(outJson2, 'utf8'));
    ok(jf.provenance && jf.provenance.pairs_mode === 'full', 'full-mode provenance stamps pairs_mode=full');
    ok(jf.provenance && jf.provenance.pairs_scored >= 1, 'full-mode scored at least one cross-boundary pair (got '
      + (jf.provenance ? jf.provenance.pairs_scored : 'n/a') + ')');
  } finally {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  if (FAIL > 0) {
    process.stderr.write('test-215-portfolio-report: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('test-215-portfolio-report: ' + PASS + ' assertions passed\n');
}

run().catch(function (err) {
  process.stderr.write('test-215-portfolio-report THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
