'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218-03 -- REQ-5 noise-reduction test (exact invariant, quick 260715-0nj).
 *
 * THE CLAIM (REQ-5, strengthened): a "structural" pair is one whose BOTH
 * endpoints are memory_artifact nodes -- the one-node-per-file scaffolding that
 * carries no domain signal (the noise this phase exists to remove). Quick task
 * 260715-0nj excludes every both-scaffold pair from the ranked-pair candidate
 * set at the pair-candidate generation layer, so the top-N structural share is
 * now 0 BY CONSTRUCTION, independent of entity-cohort density (this supersedes
 * the earlier REQ-5 directional "share must DROP" claim, which was satisfiable
 * only when the scaffold clique still scored). The invariant is now two-sided:
 *
 *   PRE  (artifact-only room): the ranked list is EMPTY -- every candidate pair
 *        is both-scaffold, all excluded, honest empty instead of a confident
 *        100 percent structural top-N.
 *   POST (after minting company / technology / market entity nodes via
 *        scripts/entity-extract.cjs): the ranked list is NON-EMPTY (real entity
 *        pairs survive) AND the top-N structural share is EXACTLY 0.
 *
 * WHY A SYNTHETIC FIXTURE (not the live aion room): this leg must be HERMETIC,
 * FAST and DETERMINISTIC in CI. A full offline re-rank over a real tens-of-
 * thousands-of-pairs room is too heavy for CI (218-03-PLAN Task 2 escape hatch),
 * so the ACCEPTANCE NUMBER (< 50% on aion-eureka-synergy) is the Task 3 human-
 * verify leg's job. This test proves the MECHANISM on a tiny seeded room: a
 * handful of memory_artifact nodes wired into a 100%-structural CONVERGES baseline,
 * extraction run in-process, and the post-extraction top-N structural share proven
 * strictly lower. Everything runs --offline (stub encoder) with the zero-network
 * preload required below, so no model download and no network reach.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

// Hermeticity: flip transformers.js allowRemoteModels=false so the entity-extract
// re-embed (which does NOT pass a stub encoder) degrades to lexical-only instead
// of reaching the network when this test is run standalone (the aggregator's
// NODE_OPTIONS preload does the same for the spawned-leg path).
require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const navigation = require('../lib/core/navigation.cjs');
const RUNNER = require('../scripts/eureka-portfolio-report.cjs');
const entityExtract = require('../scripts/entity-extract.cjs');

// ---------------------------------------------------------------------------
// A tiny room whose artifacts carry entity-rich prose. Six sections, each with a
// short markdown body naming real-looking companies / markets / technologies so
// the tier-1 extractor has content to mint.
// ---------------------------------------------------------------------------

const ARTIFACTS = [
  {
    slug: 'competitive-analysis',
    body: [
      '# Competitive Analysis',
      '',
      'Prodrive competes with Xtrac in the motorsport drivetrain market.',
      'Ricardo rivals Prodrive for the same customers. Cosworth versus Ilmor',
      'is the other big rivalry in the segment.',
    ].join('\n'),
  },
  {
    slug: 'technology',
    body: [
      '# Technology',
      '',
      'The platform uses Carbon Fibre as a core component. The gearbox is',
      'built on Titanium Alloy. Our system incorporates Kevlar Composite',
      'for the housing.',
    ].join('\n'),
  },
  {
    slug: 'market',
    body: [
      '# Market',
      '',
      'The Motorsport Market and the Defence Market are the two segments.',
      'The Aerospace Market is an adjacent audience we could reach next.',
    ].join('\n'),
  },
  {
    slug: 'suppliers',
    body: [
      '# Competitors',
      '',
      'Hexcel supplies to Prodrive. Toray Industries supplies to Xtrac.',
      'Solvay is a vendor to Ricardo.',
    ].join('\n'),
  },
  {
    slug: 'partners',
    body: [
      '# Competition',
      '',
      'McLaren competes with Williams. Mercedes rivals Ferrari in the top',
      'tier. Renault versus Honda is the engine rivalry.',
    ].join('\n'),
  },
  {
    slug: 'stack',
    body: [
      '# Technology',
      '',
      'The controller uses Silicon Carbide. The battery is based on Lithium',
      'Ion. Our telemetry is powered by Edge Compute.',
    ].join('\n'),
  },
];

function mkTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-218-noise-'));
  for (const art of ARTIFACTS) {
    const secDir = path.join(dir, art.slug);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'FEYNMAN.md'), art.body + '\n', 'utf8');
  }
  return dir;
}

// Seed the memory_artifact nodes (props.path -> the .md file) and a fully-cited
// CONVERGES baseline among them, so the PRE-extraction ranker sees only
// memory_artifact-vs-memory_artifact pairs (a 100% structural top-N). Writes route
// through the shared insertNode chokepoint + navigation.writeEdge.
function seedRoom(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const ids = [];
  for (const art of ARTIFACTS) {
    const id = 'memory_artifact:' + art.slug + ':FEYNMAN';
    const props = JSON.stringify({
      title: art.slug + ' FEYNMAN',
      path: art.slug + '/FEYNMAN.md',
      section: art.slug,
    });
    insertNode(db, id, 'memory_artifact', props, {
      source_path: 'memory:' + art.slug + ':FEYNMAN',
      created_by: 'system',
    });
    ids.push(id);
  }
  // Fully-cited CONVERGES clique among the artifacts (the structural baseline).
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const r = navigation.writeEdge(db, {
        source_id: ids[i],
        target_id: ids[j],
        edge_type: 'CONVERGES',
        properties: { relation: 'converges' },
      });
      assert.ok(r && r.ok, 'CONVERGES seed edge should write: ' + JSON.stringify(r));
    }
  }
  closeRoomDb(db);
}

// Run the shipped portfolio engine OFFLINE in room-native mode and return the
// top-N structural share (both endpoints memory_artifact) plus the raw counts.
async function structuralShare(roomDir) {
  const outMd = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.md');
  const outJson = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.json');
  const code = await RUNNER.main([
    '--db', roomDir,
    '--pairs', 'room',
    '--offline',
    '--top', '25',
    '--out', outMd,
    '--json', outJson,
  ]);
  assert.equal(code, 0, 'portfolio runner should exit 0');
  const report = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  const ranked = Array.isArray(report.ranked) ? report.ranked : [];

  // Classify each ranked endpoint by node TYPE. The runner keys pair ids by
  // catalogId(row); build the same id -> type map so a pair is "structural" iff
  // BOTH endpoints resolve to a memory_artifact node.
  const db = openRoomDb(roomDir, { allowExtension: true });
  const rows = db.prepare('SELECT id, type, source_path FROM nodes').all();
  const typeById = new Map();
  for (const row of rows) {
    typeById.set(RUNNER.catalogId(row), row.type);
  }
  closeRoomDb(db);

  let structural = 0;
  for (const p of ranked) {
    if (typeById.get(p.a) === 'memory_artifact' && typeById.get(p.b) === 'memory_artifact') {
      structural += 1;
    }
  }
  const total = ranked.length;
  return { structural: structural, total: total, share: total > 0 ? structural / total : 0 };
}

async function main() {
  let passed = 0;
  const roomDir = mkTempRoom();
  try {
    seedRoom(roomDir);

    // PRE: the seeded room has ONLY memory_artifact CONVERGES pairs, so every
    // candidate pair is both-scaffold and the both-scaffold filter (quick
    // 260715-0nj) excludes all of them -> the ranked list is honestly EMPTY,
    // instead of the pre-filter 100 percent-structural top-N.
    const pre = await structuralShare(roomDir);
    assert.equal(pre.total, 0, 'pre-extraction ranking must be EMPTY (every pair is both-scaffold, all excluded)');
    assert.equal(pre.structural, 0, 'an empty ranked list has zero structural pairs by construction');
    console.log('  pre : ' + pre.structural + '/' + pre.total + ' structural (honest empty)');
    passed += 1;

    // Run the pipeline in-process (writes proposed entity nodes + typed edges).
    const rc = await entityExtract.main([roomDir, 'run']);
    assert.equal(rc, 0, 'entity-extract run should exit 0');
    passed += 1;

    // The entity nodes landed and are ALL born review_status='proposed' (Part 9).
    const db = openRoomDb(roomDir, { allowExtension: true });
    const entRows = db.prepare(
      "SELECT review_status, COUNT(*) c FROM nodes WHERE type IN ('company','technology','market') GROUP BY review_status"
    ).all();
    closeRoomDb(db);
    const totalEnt = entRows.reduce(function (s, r) { return s + r.c; }, 0);
    assert.ok(totalEnt > 0, 'extraction should mint entity nodes');
    assert.deepEqual(
      entRows.map(function (r) { return r.review_status; }),
      ['proposed'],
      'every entity node must be born proposed (never auto-confirmed)'
    );
    console.log('  minted ' + totalEnt + ' proposed entity nodes');
    passed += 1;

    // POST: the same offline re-rank now sees entity content to pair, so the
    // ranked list is non-empty (real entity pairs survive) AND the structural
    // (memory_artifact-vs-memory_artifact) share is EXACTLY 0 by construction
    // (the both-scaffold filter removes every scaffold pair, quick 260715-0nj).
    const post = await structuralShare(roomDir);
    console.log('  post: ' + post.structural + '/' + post.total + ' structural = ' + (post.share * 100).toFixed(1) + '%');
    assert.ok(
      post.total > 0,
      'REQ-5: post-extraction ranked list must be NON-EMPTY (real entity pairs survive)'
    );
    assert.equal(
      post.structural, 0,
      'REQ-5 exact: post-extraction structural share must be EXACTLY 0 (' + post.structural +
      ' both-scaffold pairs ranked; the filter must remove all of them)'
    );
    passed += 1;

    console.log('test-218-noise-reduction: ' + passed + '/4 legs PASSED (REQ-5 exact, structural share 0 by construction)');
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-noise-reduction FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
