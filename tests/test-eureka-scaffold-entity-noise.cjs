'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * RCA eureka-entity-extraction-boilerplate-candidates (2026-09-17) -- the
 * scaffold-boilerplate entity-noise fix, proven end to end on a hermetic
 * fixture room.
 *
 * THE CLAIM (traced live against the reporter's `axiom` room, 2026-09-17):
 * scripts/entity-extract.cjs's collectArtifacts() fed the five per-directory
 * scaffold kinds (ROOM/STATE/MINTO/BRAIN/FEYNMAN) to the tier-1 extractor as
 * CONTENT, not just as DESCRIBES anchors. Because every section carries a
 * near-identical template copy of each scaffold (Decision 15), the SAME
 * capitalized template words were extracted once per section and merged into
 * one entity node whose DESCRIBES degree dwarfed real content (9-20 vs 1-2 on
 * the live room), crowding the top ranks with boilerplate ("Larry", "Seeded",
 * "Working", "Key Decision", ...). A second, compounding defect: the entity
 * node's source_path was minted self-referentially
 * ('entity:'+sessionId+':'+name) in lib/core/navigation/typed-entity.cjs, so
 * no report could show WHERE a noise entity actually came from.
 *
 * THE FIX (two files):
 *   (1) scripts/entity-extract.cjs collectArtifacts(): a memory_artifact row
 *       whose (kind, basename) pair matches a real scaffold file (kind AND
 *       basename together -- never kind alone, since some existing test
 *       fixtures tag kind:'ROOM' on an arbitrary non-ROOM.md path to exercise
 *       unrelated frontmatter/classifier behavior) is EXCLUDED as extraction
 *       input but STAYS a valid DESCRIBES anchor; the exclusion count is
 *       returned additively and threaded to status.json as
 *       scaffold_files_skipped.
 *   (2) lib/core/navigation/typed-entity.cjs writeEntityNode(): an optional
 *       sourcePath param (a real room-relative path, no ':') overrides the
 *       prior synthetic self-referential handle; entity-extract.cjs tags
 *       each extracted candidate with the REAL artifact path it came from
 *       and passes it through.
 *
 * FIXTURE SHAPE (matches the RCA's Tests-to-Add fixture-room spec): 3
 * sections, each carrying the FULL scaffold set (ROOM/STATE/MINTO/BRAIN/
 * FEYNMAN, 15 files total, byte-identical per kind across sections -- the
 * real-world Decision-15 shape) plus 2 real content artifacts per section (6
 * total), each naming one unique, unambiguous two-word concept.
 *
 * TDD note (this session): this test was run against a `git stash` of both
 * fix commits to confirm it fails in the exact way the RCA predicts (scaffold
 * vocabulary present as entities, self-referential source_path) BEFORE the
 * fix landed, then confirmed green after `git stash pop`. See the debug
 * session file's Resolution.verification for the recorded RED/GREEN run.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const entityExtract = require('../scripts/entity-extract.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { runExtraction, collectArtifacts } = entityExtract;

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}
async function checkAsync(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// ---------------------------------------------------------------------------
// Fixture: 3 sections x (5 scaffold files + 2 content files).
// ---------------------------------------------------------------------------

const SECTIONS = ['business-model', 'competitive-analysis', 'market-analysis'];

// Byte-identical per kind across every section (the real Decision-15 shape:
// every directory gets the SAME template body). Each carries exactly one
// isolated Title-Case marker word (never sentence-initial-only vocabulary
// beyond a STOPWORD, so the ONLY surviving tier-1 candidate per file is the
// marker itself).
const SCAFFOLD_BODY = {
  ROOM: ['# Room Identity', '', 'This directory identity file is marked Seeded until real content lands.'].join('\n'),
  STATE: ['# Room State', '', 'The section status reads Current across the whole room today.'].join('\n'),
  MINTO: ['# Minto Pyramid', '', 'The governing thought stays Working until methodology fires.'].join('\n'),
  BRAIN: ['# Brain Status', '', 'The gate status is Available only after the next pass.'].join('\n'),
  FEYNMAN: ['# Feynman Simplification', '', 'The simplification pass was Recent but not yet reviewed.'].join('\n'),
};
const SCAFFOLD_KIND_BASENAME = {
  ROOM: 'ROOM.md', STATE: 'STATE.md', MINTO: 'MINTO.md', BRAIN: 'BRAIN.md', FEYNMAN: 'FEYNMAN.md',
};
// The template vocabulary a correct fix must NEVER surface as an entity name.
const SCAFFOLD_VOCAB = ['Seeded', 'Current', 'Working', 'Available', 'Recent'];

// Two real content artifacts per section, each naming one unique two-word
// concept the fix MUST surface as an entity (Part 8 figure-guard idiom: no
// K/M/B figures anywhere in the fixture prose).
const CONTENT_FILES = {
  'business-model': [
    { rel: 'business-model/pricing-notes.md', concept: 'Northwind Traders', body: '# Pricing Notes\n\nNorthwind Traders sets tiered pricing for the enterprise tier.\n' },
    { rel: 'business-model/channel-notes.md', concept: 'Vertex Retail', body: '# Channel Notes\n\nVertex Retail handles channel distribution for the region.\n' },
  ],
  'competitive-analysis': [
    { rel: 'competitive-analysis/rival-a.md', concept: 'Solvent Dynamics', body: '# Rival A\n\nSolvent Dynamics leads the incumbent segment this quarter.\n' },
    { rel: 'competitive-analysis/rival-b.md', concept: 'Anchorpoint Systems', body: '# Rival B\n\nAnchorpoint Systems is the closest direct rival today.\n' },
  ],
  'market-analysis': [
    { rel: 'market-analysis/segment-a.md', concept: 'Meridian Health', body: '# Segment A\n\nMeridian Health serves the enterprise segment nationwide.\n' },
    { rel: 'market-analysis/segment-b.md', concept: 'Coral Basin', body: '# Segment B\n\nCoral Basin targets the small-business segment locally.\n' },
  ],
};
const ALL_CONTENT_CONCEPTS = SECTIONS.reduce(function (acc, s) {
  return acc.concat(CONTENT_FILES[s].map(function (c) { return c.concept; }));
}, []);

function mkFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-scaffold-noise-'));
  for (const section of SECTIONS) {
    fs.mkdirSync(path.join(dir, section), { recursive: true });
    for (const kind of Object.keys(SCAFFOLD_BODY)) {
      fs.writeFileSync(path.join(dir, section, SCAFFOLD_KIND_BASENAME[kind]), SCAFFOLD_BODY[kind] + '\n', 'utf8');
    }
    for (const cf of CONTENT_FILES[section]) {
      fs.writeFileSync(path.join(dir, cf.rel), cf.body, 'utf8');
    }
  }
  return dir;
}

function seedScaffoldNodes(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  for (const section of SECTIONS) {
    for (const kind of Object.keys(SCAFFOLD_BODY)) {
      const id = 'memory_artifact:' + section + ':' + kind;
      const props = JSON.stringify({
        section: section, kind: kind, path: section + '/' + SCAFFOLD_KIND_BASENAME[kind], hash: '',
      });
      insertNode(db, id, 'memory_artifact', props, {
        source_path: 'memory:' + section + ':' + kind, created_by: 'system',
        // R17-02 (260903-gdm Task 5, 2026-09-03): insertNode requires
        // epistemic_type with no default. 'observation' matches
        // entity-extract.cjs's own existingOrDefaultEpistemicType() default for
        // the memory_artifact system-bookkeeping nodes it operates on.
        epistemic_type: 'observation',
      });
    }
  }
  closeRoomDb(db);
}

// A tier-2a surrogate that always fails -> forces the full degrade to the
// deterministic keyless fallback (every tier-1 survivor lands WHAT). Makes
// the entity-presence assertions independent of the real embedding model's
// availability/verdicts on this machine (the same discipline
// test-218-low-trust-exclusion.cjs and test-219-low-confidence-disclosure.cjs
// already apply via embedClassifyImpl injection).
async function forceEmbedFail() { return { ok: false, error: 'forced_fail_for_test' }; }

async function main() {
  const roomDir = mkFixtureRoom();
  try {
    seedScaffoldNodes(roomDir);

    // -----------------------------------------------------------------------
    // Leg 1 (collectArtifacts contract, pre-tier2, fully deterministic):
    // scaffold files are excluded as extraction input, counted, and STILL
    // covered (never re-read as tier-b ordinary content); exactly the 6 real
    // content artifacts remain.
    // -----------------------------------------------------------------------
    check('collectArtifacts excludes all 15 scaffold files as input, counts them, keeps only the 6 content artifacts', function () {
      const db = openRoomDb(roomDir, { allowExtension: true });
      let artifacts;
      try {
        artifacts = collectArtifacts(db, roomDir);
      } finally {
        closeRoomDb(db);
      }
      assert.equal(artifacts.scaffoldFilesSkipped, 15,
        'scaffoldFilesSkipped must equal 3 sections x 5 scaffold kinds, got ' + artifacts.scaffoldFilesSkipped);
      assert.equal(artifacts.length, 6,
        'exactly the 6 real content artifacts should remain as extraction input, got ' + artifacts.length + ': ' +
        JSON.stringify(artifacts.map(function (a) { return a.relPath; })));
      const relPaths = artifacts.map(function (a) { return a.relPath; }).sort();
      const expected = ALL_CONTENT_CONCEPTS.length; // sanity: one artifact per concept
      assert.equal(relPaths.length, expected, 'one artifact per content concept');
      for (const scaffoldBase of Object.values(SCAFFOLD_KIND_BASENAME)) {
        assert.ok(!relPaths.some(function (p) { return path.basename(p) === scaffoldBase; }),
          'no collected artifact may be a scaffold file (' + scaffoldBase + '): ' + JSON.stringify(relPaths));
      }
    });

    // -----------------------------------------------------------------------
    // Leg 2 (entity-level proof, deterministic tier-2 degrade): zero scaffold
    // vocabulary surfaces as an entity name; every content concept surfaces;
    // every entity's source_path is a real, existing, colon-free room-relative
    // path (the source_path minting fix).
    // -----------------------------------------------------------------------
    await checkAsync('extraction surfaces zero scaffold vocabulary, all 6 content concepts, real source_path on every entity', async function () {
      const db = openRoomDb(roomDir, { allowExtension: true });
      let names;
      let rows;
      try {
        const result = await runExtraction(db, roomDir, 'entity-extract', 25, {
          _forceNoLlm: true,
          embedClassifyImpl: forceEmbedFail,
        });
        assert.ok(result && result.entitiesWritten > 0, 'extraction must write at least one entity: ' + JSON.stringify(result));
        rows = db.prepare("SELECT id, source_path, properties FROM nodes WHERE type IN ('company','technology','market')").all();
        names = rows.map(function (r) { try { return JSON.parse(r.properties).name; } catch (_e) { return null; } });
      } finally {
        closeRoomDb(db);
      }

      console.log('    extracted entity names:', JSON.stringify(names));

      for (const noise of SCAFFOLD_VOCAB) {
        assert.ok(!names.includes(noise),
          'scaffold template word "' + noise + '" must NEVER surface as an entity name: ' + JSON.stringify(names));
      }
      for (const concept of ALL_CONTENT_CONCEPTS) {
        assert.ok(names.includes(concept),
          'real content concept "' + concept + '" must surface as an entity name: ' + JSON.stringify(names));
      }

      for (const row of rows) {
        assert.ok(typeof row.source_path === 'string' && row.source_path.indexOf(':') === -1,
          'entity source_path must be a real path with no colon (node ' + row.id + '): ' + JSON.stringify(row.source_path));
        const abs = path.join(roomDir, row.source_path);
        assert.ok(fs.existsSync(abs),
          'entity source_path must resolve to a real file on disk (node ' + row.id + '): ' + row.source_path);
      }
    });

    // -----------------------------------------------------------------------
    // Leg 3 (status.json wiring, tier-2-independent): the CLI dispatcher
    // discloses the exclusion count end to end, never silently.
    // -----------------------------------------------------------------------
    await checkAsync('status.json discloses scaffold_files_skipped end to end via the CLI dispatcher', async function () {
      const rc = await entityExtract.main([roomDir, 'run']);
      assert.equal(rc, 0, 'entity-extract run should exit 0');
      const statusPath = path.join(roomDir, '.mindrian', 'entity-extract', 'status.json');
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      assert.equal(status.scaffold_files_skipped, 15,
        'status.json scaffold_files_skipped must equal 15, got ' + JSON.stringify(status.scaffold_files_skipped));
    });

    // -----------------------------------------------------------------------
    // Leg 4 (legacy purge, RCA eureka-entity-extraction-boilerplate-candidates,
    // navigator ruling 2026-09-17 "purge in the extractor run"): the fix above
    // is additive, so rooms scanned before it keep their machine-authored
    // template entities (self-referential source_path 'entity:sid:name'). A run
    // must purge exactly that signature plus its edges, and must NOT touch an
    // entity with a real source_path or one a human has confirmed.
    // -----------------------------------------------------------------------
    await checkAsync('run purges legacy self-referential entity rows and their edges, keeps real-path and confirmed rows, reports legacy_entities_purged', async function () {
      const legacyRoom = mkFixtureRoom();
      try {
        seedScaffoldNodes(legacyRoom);
        const anchor = 'memory_artifact:business-model:ROOM';
        const legacyNames = ['Seeded', 'Working', 'Current'];
        const db = openRoomDb(legacyRoom, { allowExtension: true });
        try {
          for (const name of legacyNames) {
            const id = 'entity:legacy-sid:' + name;
            insertNode(db, id, 'company', JSON.stringify({ name: name, entityType: 'company' }), {
              source_path: 'entity:legacy-sid:' + name, created_by: 'system', epistemic_type: 'observation',
            });
            const r = navigation.writeEdge(db, { source_id: id, target_id: anchor, edge_type: 'DESCRIBES' });
            assert.ok(r && r.ok, 'seed DESCRIBES edge must write for ' + name + ': ' + JSON.stringify(r));
          }
          // Survivor 1: a real room-relative source_path (post-fix minting shape).
          insertNode(db, 'entity:legacy-sid:Keeper Corp', 'company', JSON.stringify({ name: 'Keeper Corp', entityType: 'company' }), {
            source_path: 'business-model/pricing-notes.md', created_by: 'system', epistemic_type: 'observation',
          });
          // Survivor 2: legacy signature, but a human confirmed it (Canon Part 9:
          // only a human closes a confirmed node; code never deletes one).
          insertNode(db, 'entity:legacy-sid:Confirmed Co', 'company', JSON.stringify({ name: 'Confirmed Co', entityType: 'company' }), {
            source_path: 'entity:legacy-sid:Confirmed Co', created_by: 'system', epistemic_type: 'observation', review_status: 'confirmed',
          });
          const seeded = db.prepare("SELECT count(*) AS c FROM nodes WHERE id LIKE 'entity:legacy-sid:%'").get().c;
          assert.equal(seeded, 5, 'fixture must seed 5 entity rows, got ' + seeded);
        } finally {
          closeRoomDb(db);
        }

        const rc = await entityExtract.main([legacyRoom, 'run']);
        assert.equal(rc, 0, 'entity-extract run should exit 0');

        const statusPath = path.join(legacyRoom, '.mindrian', 'entity-extract', 'status.json');
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        assert.equal(status.legacy_entities_purged, 3,
          'status.json legacy_entities_purged must equal 3, got ' + JSON.stringify(status.legacy_entities_purged));
        assert.equal(status.legacy_edges_purged, 3,
          'status.json legacy_edges_purged must equal 3, got ' + JSON.stringify(status.legacy_edges_purged));

        const db2 = openRoomDb(legacyRoom, { allowExtension: true });
        try {
          const remaining = db2.prepare("SELECT id FROM nodes WHERE id LIKE 'entity:legacy-sid:%'").all()
            .map(function (r) { return r.id; }).sort();
          assert.deepEqual(remaining, ['entity:legacy-sid:Confirmed Co', 'entity:legacy-sid:Keeper Corp'],
            'only the real-path and the human-confirmed rows may survive, got ' + JSON.stringify(remaining));
          const danglingEdges = db2.prepare("SELECT count(*) AS c FROM edges WHERE source LIKE 'entity:legacy-sid:%' OR target LIKE 'entity:legacy-sid:%'").get().c;
          assert.equal(danglingEdges, 0, 'edges of purged rows must be gone, got ' + danglingEdges);
        } finally {
          closeRoomDb(db2);
        }
      } finally {
        try { fs.rmSync(legacyRoom, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      }
    });

    // -----------------------------------------------------------------------
    // Leg 6 (mixed-edge legacy row, Codex F2/F3, quick task 260917-ild): a
    // self-referential row with ONE DESCRIBES edge to a scaffold anchor and
    // ONE DESCRIBES edge to a non-scaffold memory_artifact survives a full
    // run (proof is "every target", not "any target"), and status.json
    // legacy_entities_kept counts it.
    // -----------------------------------------------------------------------
    await checkAsync('leg 6: a legacy row with a mixed scaffold/non-scaffold DESCRIBES edge survives and is counted kept', async function () {
      const room = mkFixtureRoom();
      try {
        seedScaffoldNodes(room);
        const scaffoldAnchor = 'memory_artifact:business-model:ROOM';
        // A non-scaffold memory_artifact node for a real content file: no
        // 'kind' key at all, source_path a real room-relative path.
        const nonScaffoldId = 'memory_artifact:business-model:pricing-notes';
        const db0 = openRoomDb(room, { allowExtension: true });
        try {
          insertNode(db0, nonScaffoldId, 'memory_artifact', JSON.stringify({
            section: 'business-model', path: 'business-model/pricing-notes.md',
          }), {
            source_path: 'business-model/pricing-notes.md', created_by: 'system', epistemic_type: 'observation',
          });
          const legacyId = 'entity:legacy-sid:Mixed Edge Co';
          insertNode(db0, legacyId, 'company', JSON.stringify({ name: 'Mixed Edge Co', entityType: 'company' }), {
            source_path: legacyId, created_by: 'system', epistemic_type: 'observation',
          });
          const r1 = navigation.writeEdge(db0, { source_id: legacyId, target_id: scaffoldAnchor, edge_type: 'DESCRIBES' });
          const r2 = navigation.writeEdge(db0, { source_id: legacyId, target_id: nonScaffoldId, edge_type: 'DESCRIBES' });
          assert.ok(r1 && r1.ok && r2 && r2.ok, 'both DESCRIBES edges must seed: ' + JSON.stringify([r1, r2]));
        } finally {
          closeRoomDb(db0);
        }

        const rc = await entityExtract.main([room, 'run']);
        assert.equal(rc, 0, 'entity-extract run should exit 0');
        const statusPath = path.join(room, '.mindrian', 'entity-extract', 'status.json');
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        assert.ok(status.legacy_entities_kept >= 1,
          'status.json legacy_entities_kept must count the mixed-edge row, got ' + JSON.stringify(status.legacy_entities_kept));

        const db1 = openRoomDb(room, { allowExtension: true });
        try {
          const row = db1.prepare("SELECT id FROM nodes WHERE id = ?").get('entity:legacy-sid:Mixed Edge Co');
          assert.ok(row, 'the mixed-edge legacy row must survive the run');
        } finally {
          closeRoomDb(db1);
        }
      } finally {
        try { fs.rmSync(room, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      }
    });

    // -----------------------------------------------------------------------
    // Leg 7 (rejected row, Codex F3, Canon Part 9): a self-referential row
    // with review_status 'rejected' survives a full run, its review_status
    // unchanged, even when its name also appears in an extraction input.
    // -----------------------------------------------------------------------
    await checkAsync('leg 7: a rejected legacy row survives a full run with review_status unchanged', async function () {
      const room = mkFixtureRoom();
      try {
        seedScaffoldNodes(room);
        const scaffoldAnchor = 'memory_artifact:business-model:ROOM';
        const legacyId = 'entity:legacy-sid:Rejected Corp';
        const db0 = openRoomDb(room, { allowExtension: true });
        try {
          insertNode(db0, legacyId, 'company', JSON.stringify({ name: 'Rejected Corp', entityType: 'company' }), {
            source_path: legacyId, created_by: 'system', epistemic_type: 'observation', review_status: 'rejected',
          });
          const r = navigation.writeEdge(db0, { source_id: legacyId, target_id: scaffoldAnchor, edge_type: 'DESCRIBES' });
          assert.ok(r && r.ok, 'seed DESCRIBES edge must write: ' + JSON.stringify(r));
        } finally {
          closeRoomDb(db0);
        }
        // The row's name also appears in a content artifact this run reads
        // (proves survival is not an accident of nothing else naming it).
        fs.writeFileSync(path.join(room, 'business-model', 'rejected-mention.md'),
          '# Rejected Mention\n\nRejected Corp is mentioned here for context only.\n', 'utf8');

        const rc = await entityExtract.main([room, 'run']);
        assert.equal(rc, 0, 'entity-extract run should exit 0');

        const db1 = openRoomDb(room, { allowExtension: true });
        try {
          // Note: the freshly extracted "Rejected Corp" entity lands under a
          // DIFFERENT node id, minted from this run's own sessionId (not
          // 'legacy-sid'), so survival of the ORIGINAL row id below is not an
          // artifact of an UPSERT collision with the newly extracted entity.
          const row = db1.prepare('SELECT id, review_status FROM nodes WHERE id = ?').get(legacyId);
          assert.ok(row, 'the rejected legacy row must survive the run');
          assert.equal(row.review_status, 'rejected', 'review_status must stay rejected, got ' + JSON.stringify(row && row.review_status));
        } finally {
          closeRoomDb(db1);
        }
      } finally {
        try { fs.rmSync(room, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      }
    });

    // -----------------------------------------------------------------------
    // Leg 8 (scoped run, Codex F2, T-ild-03): a scoped run (options.paths
    // present) purges nothing, even on a room holding template-only legacy
    // rows. This is the leg that proves research-filing's scoped caller can
    // never trigger a room-wide deletion.
    // -----------------------------------------------------------------------
    await checkAsync('leg 8: a scoped run (options.paths) purges nothing and leaves every legacy row in place', async function () {
      const room = mkFixtureRoom();
      try {
        seedScaffoldNodes(room);
        const scaffoldAnchor = 'memory_artifact:business-model:ROOM';
        const legacyNames = ['Scoped Seeded', 'Scoped Working'];
        const db0 = openRoomDb(room, { allowExtension: true });
        try {
          for (const name of legacyNames) {
            const id = 'entity:legacy-sid:' + name;
            insertNode(db0, id, 'company', JSON.stringify({ name: name, entityType: 'company' }), {
              source_path: id, created_by: 'system', epistemic_type: 'observation',
            });
            const r = navigation.writeEdge(db0, { source_id: id, target_id: scaffoldAnchor, edge_type: 'DESCRIBES' });
            assert.ok(r && r.ok, 'seed DESCRIBES edge must write for ' + name);
          }
        } finally {
          closeRoomDb(db0);
        }

        const db1 = openRoomDb(room, { allowExtension: true });
        let result;
        try {
          result = await runExtraction(db1, room, 'entity-extract', 25, {
            paths: ['business-model/pricing-notes.md'],
            _forceNoLlm: true,
            embedClassifyImpl: forceEmbedFail,
          });
        } finally {
          closeRoomDb(db1);
        }
        assert.equal(result.legacyEntitiesPurged, 0, 'a scoped run must purge nothing, got ' + JSON.stringify(result.legacyEntitiesPurged));

        const db2 = openRoomDb(room, { allowExtension: true });
        try {
          for (const name of legacyNames) {
            const row = db2.prepare('SELECT id FROM nodes WHERE id = ?').get('entity:legacy-sid:' + name);
            assert.ok(row, 'legacy row ' + name + ' must remain after a scoped run');
          }
        } finally {
          closeRoomDb(db2);
        }
      } finally {
        try { fs.rmSync(room, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      }
    });

    // -----------------------------------------------------------------------
    // Leg 9 (ordering proof, Codex F2): a full run with the injected
    // write-loop failure seam rejects, and every legacy row is still present
    // afterwards -- the purge runs only after the replacement writes commit.
    // -----------------------------------------------------------------------
    await checkAsync('leg 9: a write-loop failure leaves every legacy row in place (purge runs only after the writes commit)', async function () {
      const room = mkFixtureRoom();
      try {
        seedScaffoldNodes(room);
        const scaffoldAnchor = 'memory_artifact:business-model:ROOM';
        const legacyNames = ['Ordering Seeded', 'Ordering Working'];
        const db0 = openRoomDb(room, { allowExtension: true });
        try {
          for (const name of legacyNames) {
            const id = 'entity:legacy-sid:' + name;
            insertNode(db0, id, 'company', JSON.stringify({ name: name, entityType: 'company' }), {
              source_path: id, created_by: 'system', epistemic_type: 'observation',
            });
            const r = navigation.writeEdge(db0, { source_id: id, target_id: scaffoldAnchor, edge_type: 'DESCRIBES' });
            assert.ok(r && r.ok, 'seed DESCRIBES edge must write for ' + name);
          }
        } finally {
          closeRoomDb(db0);
        }

        const db1 = openRoomDb(room, { allowExtension: true });
        try {
          await assert.rejects(
            runExtraction(db1, room, 'entity-extract', 25, {
              _forceNoLlm: true,
              embedClassifyImpl: forceEmbedFail,
              _failWriteLoop: true,
            }),
            'runExtraction must reject when the write-loop failure seam fires'
          );
        } finally {
          closeRoomDb(db1);
        }

        const db2 = openRoomDb(room, { allowExtension: true });
        try {
          for (const name of legacyNames) {
            const row = db2.prepare('SELECT id FROM nodes WHERE id = ?').get('entity:legacy-sid:' + name);
            assert.ok(row, 'legacy row ' + name + ' must remain after a rejected run');
          }
        } finally {
          closeRoomDb(db2);
        }
      } finally {
        try { fs.rmSync(room, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      }
    });

    console.log('\n' + pass + '/' + total + ' scaffold-entity-noise checks passed');
    if (pass !== total) process.exit(1);
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().catch(function (err) {
  console.error('test-eureka-scaffold-entity-noise FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
