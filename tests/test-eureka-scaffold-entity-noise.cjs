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
