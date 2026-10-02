'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick task 260715-0nj -- both-scaffold candidate-pair filter.
 *
 * THE CLAIM: a candidate pair whose endpoints are scaffold (memory_artifact
 * rows, or Artifact rows the ONE scaffold predicate names, such as the BRAIN /
 * FEYNMAN / CONTEXT files room birth writes) is structural document
 * scaffolding, never a real cross-domain opportunity, so it must never reach
 * the ranked candidate list. This closed the 72.0 percent structural-share
 * regression quick task 260714-hzx traced: once tier-2 thinned the entity
 * cohort, the memory_artifact CONVERGES clique refilled the top-25.
 *
 * Phase 363.1 D-03: memory_artifact nodes are excluded before pairing, so a
 * one-sided memory_artifact pair (for example `memory_artifact:*:ROOM` x an
 * entity) is scaffold too, never a signal.
 *
 * Phase 366 plan 25 (D-02, runner retirement, slice B): the standalone Eureka
 * runner script is retired, so this test now points at
 * where the filter lives today: the Eureka perspective's substrate stage
 * (lib/core/research-planner/perspectives/eureka-recall.cjs buildSubstrate)
 * drops memory_artifact rows (NON_THING_TYPES) and scaffold rows (through
 * lib/core/scaffold-predicate.cjs) before any lane proposes a pair. The seam
 * moved from the runner's ranked report to the perspective's candidate list;
 * the perspective pairs content things, and entity nodes are the bridges
 * between them (lane shared_entity), not endpoints. So leg 2's "the entity
 * pair still ranks" reads, at this seam, as "the two content things an entity
 * bridges still rank". The runner's provenance counter
 * (structural_excluded_by_reason) has no perspective analog; the honest-empty
 * leg asserts the counts the perspective does report (things 0, candidates 0).
 *
 * Two legs, both offline (no model, no network, read-only on room.db):
 *   Leg 1: a scaffold-only room recalls EMPTY, and no scaffold row is a thing.
 *   Leg 2: a mixed room recalls non-empty, ZERO candidates are both-scaffold,
 *          ZERO candidate endpoints are scaffold (memory_artifact or a scaffold
 *          Artifact), and the entity-bridged content pair still ranks.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic: never read the operator's real home, rooms or session.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-0nj-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-0nj-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const navigation = require('../lib/core/navigation.cjs');
const recall = require('../lib/core/research-planner/perspectives/eureka-recall.cjs');
const scaffoldPredicate = require('../lib/core/scaffold-predicate.cjs');

// A scaffold artifact carries body prose (props.path -> FEYNMAN.md) so it would
// index if it were ever let through; distinct section slugs keep the
// cross-section rule honest.
const SCAFFOLD_SLUGS = ['scaffold-a', 'scaffold-b', 'scaffold-c', 'scaffold-d'];

// Bridge entities (lane shared_entity): props.name, no file body.
const ENTITIES = [
  { id: 'company:acme', type: 'company', name: 'Acme Drivetrain' },
  { id: 'technology:cf', type: 'technology', name: 'Carbon Fibre Housing' },
];

// Content things in two sections, each described by both entities.
const CONTENT = [
  { id: 'firms/acme-brief', section: 'firms', title: 'Acme supplier brief', body: 'Acme builds drivetrain assemblies for racing teams and sources housings from a composite shop.' },
  { id: 'materials/housing-options', section: 'materials', title: 'Housing material options', body: 'Carbon fibre housings cut weight for drivetrain assemblies; the composite shop quotes per batch.' },
];

// Scaffold Artifact rows in the same two sections with IDENTICAL bodies: an
// Artifact x Artifact both-scaffold pair that would score a perfect lexical
// match if the filter ever let it through.
const SCAFFOLD_ARTIFACTS = [
  { id: 'firms/BRAIN', section: 'firms' },
  { id: 'materials/BRAIN', section: 'materials' },
];
const SCAFFOLD_BODY = 'Common scaffold text room birth writes into every section template file.';

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

function describes(db, entityId, targetId) {
  const r = navigation.writeEdge(db, {
    source_id: entityId, target_id: targetId, edge_type: 'DESCRIBES', properties: { relation: 'describes' },
  });
  assert.ok(r && r.ok, 'seed DESCRIBES edge should write: ' + JSON.stringify(r));
}

function isScaffoldRow(type, id) {
  if (type === 'memory_artifact') return true;
  const base = String(id).split('/').pop();
  return type === 'Artifact' && scaffoldPredicate.isScaffoldBasename(base);
}

function typeByIdMap(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const rows = db.prepare('SELECT id, type FROM nodes').all();
  const m = new Map();
  for (const row of rows) m.set(row.id, row.type);
  closeRoomDb(db);
  return m;
}

function thingIdsOf(rec) {
  return recall.readJsonl(path.join(rec.run_dir, '01_substrate', 'output', 'things.jsonl')).map(function (t) { return t.id; });
}

async function main() {
  let passed = 0;

  // ---------------------------------------------------------------------
  // Leg 1: scaffold-only room -> honest empty candidate list.
  // ---------------------------------------------------------------------
  {
    const roomDir = mkTempRoom(4);
    try {
      const db = openRoomDb(roomDir, { allowExtension: true });
      const scaffoldIds = seedScaffoldClique(db, 4);
      closeRoomDb(db);

      const rec = recall.runRecall(roomDir, { tag: '20261002T000000Z' });
      assert.equal(rec.ok, true, 'recall should run on a scaffold-only room');
      assert.ok(Array.isArray(rec.candidates), 'candidates must be an array');
      assert.equal(
        rec.candidates.length, 0,
        'a scaffold-only room must recall EMPTY (every possible pair is scaffold, all excluded)'
      );
      // Never silent: the perspective reports the honest empty in its counts.
      assert.equal(rec.counts.things, 0, 'no scaffold row may become a thing; got ' + JSON.stringify(rec.counts));
      assert.equal(rec.counts.candidates, 0, 'counts.candidates must report the empty list');
      const thingIds = thingIdsOf(rec);
      for (const id of scaffoldIds) {
        assert.equal(thingIds.indexOf(id), -1, 'scaffold row ' + id + ' must never be a thing');
      }
      passed += 1;
      console.log('  leg 1 (scaffold-only -> honest empty, 363.1 D-03): PASSED -- ' +
        scaffoldIds.length + ' memory_artifact rows excluded before pairing, 0 candidates');
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  // ---------------------------------------------------------------------
  // Leg 2: mixed room -> only content pairs rank; no scaffold endpoint on
  // either side; the entity-bridged content pair still ranks.
  // ---------------------------------------------------------------------
  {
    const roomDir = mkTempRoom(3);
    try {
      const db = openRoomDb(roomDir, { allowExtension: true });
      const scaffoldIds = seedScaffoldClique(db, 3);
      for (const e of ENTITIES) {
        insertNode(db, e.id, e.type, JSON.stringify({ name: e.name }),
          { source_path: 'entity:' + e.id, created_by: 'system', epistemic_type: 'extracted_fact' });
      }
      for (const c of CONTENT) {
        insertNode(db, c.id, 'Artifact', JSON.stringify({ title: c.title, body: c.body, section: c.section }),
          { source_path: c.id + '.md', created_by: 'system', epistemic_type: 'observation' });
      }
      for (const s of SCAFFOLD_ARTIFACTS) {
        insertNode(db, s.id, 'Artifact', JSON.stringify({ title: 'BRAIN', body: SCAFFOLD_BODY, section: s.section }),
          { source_path: s.id + '.md', created_by: 'system', epistemic_type: 'observation' });
      }
      // Every entity describes both content things, one memory_artifact (the
      // one-sided scaffold case) and both scaffold Artifacts (the both-scaffold
      // case): if the filter leaked, the shared_entity lane would pair them.
      for (const e of ENTITIES) {
        for (const c of CONTENT) describes(db, e.id, c.id);
        describes(db, e.id, scaffoldIds[0]);
        for (const s of SCAFFOLD_ARTIFACTS) describes(db, e.id, s.id);
      }
      closeRoomDb(db);

      const rec = recall.runRecall(roomDir, { tag: '20261002T000001Z' });
      const ranked = Array.isArray(rec.candidates) ? rec.candidates : [];
      assert.ok(ranked.length > 0, 'a mixed room must recall non-empty (the entity-bridged content pair survives)');

      const thingIds = thingIdsOf(rec);
      for (const id of scaffoldIds.concat(SCAFFOLD_ARTIFACTS.map(function (s) { return s.id; }))) {
        assert.equal(thingIds.indexOf(id), -1, 'scaffold row ' + id + ' must never be a thing (never silent: it is absent from things.jsonl)');
      }

      const typeById = typeByIdMap(roomDir);
      let bothScaffold = 0;
      let oneScaffold = 0;
      for (const p of ranked) {
        const aScaffold = isScaffoldRow(typeById.get(p.a), p.a);
        const bScaffold = isScaffoldRow(typeById.get(p.b), p.b);
        if (aScaffold && bScaffold) bothScaffold += 1;
        else if (aScaffold || bScaffold) oneScaffold += 1;
      }
      assert.equal(
        bothScaffold, 0,
        'ZERO candidates may have BOTH sides scaffold (the exclusion held); got ' + bothScaffold
      );
      // Phase 363.1 D-03: a scaffold endpoint is scaffold on ANY side.
      assert.equal(
        oneScaffold, 0,
        'ZERO candidates may have a scaffold endpoint under 363.1 D-03; got ' + oneScaffold
      );
      const bridged = ranked.filter(function (p) {
        return (p.a === CONTENT[0].id && p.b === CONTENT[1].id) || (p.a === CONTENT[1].id && p.b === CONTENT[0].id);
      })[0];
      assert.ok(bridged, 'the entity-bridged content pair must rank; got ' + JSON.stringify(ranked.map(function (p) { return p.a + '|' + p.b; })));
      assert.ok(bridged.lanes.indexOf('shared_entity') !== -1, 'the bridged pair rides lane shared_entity; got ' + bridged.lanes.join(','));
      passed += 1;
      console.log('  leg 2 (mixed -> entity-bridged pair ranks, no scaffold endpoint, 363.1 D-03): PASSED -- ' +
        ranked.length + ' recalled, ' + bothScaffold + ' both-scaffold, ' + oneScaffold + ' one-side');
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
