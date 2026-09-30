'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick task 260715-0nj -- both-scaffold candidate-pair filter.
 *
 * THE CLAIM: a candidate pair whose BOTH endpoints are scaffold node types
 * (memory_artifact / Artifact) is structural document scaffolding, never a real
 * cross-domain opportunity, so scripts/eureka-portfolio-report.cjs must exclude
 * it from the ranked-pair candidate set at the pair-candidate generation layer
 * (step 4), BEFORE scoring, in every pairs mode. This closes the 72.0 percent
 * structural-share regression quick task 260714-hzx traced: once tier-2 thinned
 * the entity cohort, the memory_artifact CONVERGES clique refilled the top-25.
 *
 * Phase 363.1 D-03: memory_artifact nodes are excluded before pairing
 * (lib/core/eureka/candidate-exclusion.cjs), which supersedes the 260714-hzx
 * narrow scope for memory_artifact endpoints. Step 4b still guards
 * Artifact x Artifact pairs. The two pins below that used to assert the OLD
 * behavior were corrected in the same commit as that behavior change: the
 * beta.51 rooms proved a one-sided memory_artifact pair (for example
 * `memory_artifact:*:ROOM` x an entity) is scaffold ranked as an opportunity,
 * not a signal. What each leg proves is unchanged; only where the exclusion
 * is counted moved (pairs -> nodes), and the one-side survival pin became a
 * one-side EXCLUSION pin.
 *
 * ORIGINAL SCOPE (quick 260715-0nj): the both-scaffold pair filter still holds
 * for any Artifact x Artifact pair. Under D-03 the memory_artifact nodes never
 * reach pair enumeration at all, so they are counted as
 * provenance.structural_excluded_by_reason.memory_artifact instead of as
 * scaffold_pairs_excluded.
 *
 * Two legs, both against the real runner offline (stub encoder, zero network):
 *   Leg 1: a scaffold-only room ranks EMPTY (honest empty, exit 0), and the
 *          provenance counts every excluded node (never silent).
 *   Leg 2: a mixed room ranks non-empty, ZERO ranked pairs are both-scaffold,
 *          and ZERO ranked endpoints are memory_artifact (D-03); the entity
 *          pair still ranks.
 *
 * Fixture prose avoids K/M/B figures so the Part 8 figure-guard never trips (the
 * 215 fixture idiom). NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const navigation = require('../lib/core/navigation.cjs');
const RUNNER = require('../scripts/eureka-portfolio-report.cjs');

// A scaffold artifact carries body prose (props.path -> FEYNMAN.md) so it always
// indexes; distinct section slugs keep the root-domain axis honest.
const SCAFFOLD_SLUGS = ['scaffold-a', 'scaffold-b', 'scaffold-c', 'scaffold-d'];

// Entity nodes carry props.name so nodeText resolves them without a file body.
// Names avoid any K/M/B figure so the Part 8 figure-guard never trips.
const ENTITIES = [
  { id: 'company:acme', type: 'company', section: 'firms', name: 'Acme Drivetrain' },
  { id: 'technology:cf', type: 'technology', section: 'materials', name: 'Carbon Fibre Housing' },
];

function mkTempRoom(nScaffold) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-0nj-scaffold-'));
  for (let i = 0; i < nScaffold; i += 1) {
    const slug = SCAFFOLD_SLUGS[i];
    fs.mkdirSync(path.join(dir, slug), { recursive: true });
    fs.writeFileSync(
      path.join(dir, slug, 'FEYNMAN.md'),
      '# ' + slug + '\n\nStructural scaffolding body for ' + slug + '.\n',
      'utf8'
    );
  }
  return dir;
}

function seedScaffoldClique(db, nScaffold) {
  const ids = [];
  for (let i = 0; i < nScaffold; i += 1) {
    const slug = SCAFFOLD_SLUGS[i];
    const id = 'memory_artifact:' + slug + ':FEYNMAN';
    // R17-02 (260903-gdm): insertNode requires epistemic_type; fixture repaired in Phase 363.1-03 so D-10's gate runs
    insertNode(db, id, 'memory_artifact', JSON.stringify({
      title: slug + ' FEYNMAN', path: slug + '/FEYNMAN.md', section: slug,
    }), { source_path: 'memory:' + slug + ':FEYNMAN', created_by: 'system', epistemic_type: 'observation' });
    ids.push(id);
  }
  // Fully-cited CONVERGES clique among the artifacts: every pair here is
  // scaffold-vs-scaffold, the exact structural baseline the filter must remove.
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const r = navigation.writeEdge(db, {
        source_id: ids[i], target_id: ids[j], edge_type: 'CONVERGES', properties: {},
      });
      assert.ok(r && r.ok, 'seed CONVERGES edge should write');
    }
  }
  return ids;
}

async function runRoom(roomDir) {
  const outMd = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.md');
  const outJson = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.json');
  const code = await RUNNER.main([
    '--db', roomDir, '--pairs', 'room', '--offline', '--top', '25',
    '--out', outMd, '--json', outJson,
  ]);
  assert.equal(code, 0, 'runner should exit 0');
  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

// Build the same id -> type map the noise-reduction test uses: the runner keys
// pair ids by catalogId(row), so classify each ranked endpoint by joining back
// through that exact key.
function typeByIdMap(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const rows = db.prepare('SELECT id, type, source_path FROM nodes').all();
  const m = new Map();
  for (const row of rows) m.set(RUNNER.catalogId(row), row.type);
  closeRoomDb(db);
  return m;
}

async function main() {
  let passed = 0;

  // ---------------------------------------------------------------------
  // Leg 1: scaffold-only room -> honest empty ranked list.
  // ---------------------------------------------------------------------
  {
    const roomDir = mkTempRoom(4);
    try {
      const db = openRoomDb(roomDir, { allowExtension: true });
      seedScaffoldClique(db, 4);
      closeRoomDb(db);

      const report = await runRoom(roomDir);
      assert.ok(Array.isArray(report.ranked), 'ranked must be an array');
      assert.equal(
        report.ranked.length, 0,
        'a scaffold-only room must rank EMPTY (every candidate pair is both-scaffold, all excluded)'
      );
      // Phase 363.1 D-03: every memory_artifact node is excluded BEFORE pair
      // enumeration, so the clique's pairs are never built and are counted as
      // excluded NODES (was: scaffold_pairs_excluded > 0).
      assert.equal(
        report.provenance.structural_excluded_by_reason.memory_artifact, 4,
        'provenance must count all 4 excluded memory_artifact nodes (never silent); got ' +
        JSON.stringify(report.provenance.structural_excluded_by_reason)
      );
      assert.equal(report.provenance.structural_excluded, 4, 'structural_excluded must equal the clique size');
      passed += 1;
      console.log('  leg 1 (scaffold-only -> honest empty, 363.1 D-03): PASSED -- ' +
        report.provenance.structural_excluded + ' memory_artifact nodes excluded before pairing, 0 ranked');
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  // ---------------------------------------------------------------------
  // Leg 2: mixed room -> only non-both-scaffold pairs rank; one-side pairs
  // survive (the narrow-scope proof).
  // ---------------------------------------------------------------------
  {
    const roomDir = mkTempRoom(3);
    try {
      const db = openRoomDb(roomDir, { allowExtension: true });
      seedScaffoldClique(db, 3);
      for (const e of ENTITIES) {
        insertNode(db, e.id, e.type, JSON.stringify({
          name: e.name, section: e.section,
        }), { source_path: e.section + '/' + e.id, created_by: 'system', epistemic_type: 'extracted_fact' });
      }
      closeRoomDb(db);

      const report = await runRoom(roomDir);
      const ranked = Array.isArray(report.ranked) ? report.ranked : [];
      assert.ok(ranked.length > 0, 'a mixed room must rank non-empty (entity pairs survive)');
      // Phase 363.1 D-03: the clique is excluded as nodes, not pairs (was:
      // scaffold_pairs_excluded > 0).
      assert.equal(
        report.provenance.structural_excluded_by_reason.memory_artifact, 3,
        'the 3 scaffold clique nodes must still be counted as excluded (never silent)'
      );

      const typeById = typeByIdMap(roomDir);
      let bothScaffold = 0;
      let oneScaffold = 0;
      for (const p of ranked) {
        const ta = typeById.get(p.a);
        const tb = typeById.get(p.b);
        const aScaffold = ta === 'memory_artifact' || ta === 'Artifact';
        const bScaffold = tb === 'memory_artifact' || tb === 'Artifact';
        if (aScaffold && bScaffold) bothScaffold += 1;
        else if (aScaffold || bScaffold) oneScaffold += 1;
      }
      assert.equal(
        bothScaffold, 0,
        'ZERO ranked pairs may have BOTH sides scaffold-typed (the exclusion held); got ' + bothScaffold
      );
      // Phase 363.1 D-03 (was: oneScaffold > 0, the 260714-hzx narrow scope). A
      // memory_artifact endpoint is scaffold on ANY side, so zero ranked
      // endpoints may be memory_artifact.
      assert.equal(
        oneScaffold, 0,
        'ZERO ranked pairs may have a memory_artifact endpoint under 363.1 D-03; got ' + oneScaffold
      );
      passed += 1;
      console.log('  leg 2 (mixed -> entity pair ranks, no memory_artifact endpoint, 363.1 D-03): PASSED -- ' +
        ranked.length + ' ranked, ' + bothScaffold + ' both-scaffold, ' + oneScaffold + ' one-side');
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  console.log('test-218-scaffold-pair-filter: ' + passed + '/2 legs PASSED');
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-scaffold-pair-filter FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
