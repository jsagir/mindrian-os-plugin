'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * RCA handoff-eureka-entity-noise-2026-07-19 -- the low-trust entity provenance
 * split. Two moving parts, tested here end to end, all offline/hermetic:
 *
 *   (1) STAMPING (scripts/entity-extract.cjs): a surviving WHAT entity that arrived
 *       via the two-tier NO-LLM embedding best-guess is stamped
 *       props.evidenceTier = 'low_confidence'; one from the encoder-and-key-absent
 *       degrade is stamped 'fallback'; a confident (embedding or model) WHAT is left
 *       unstamped so writeEntityNode defaults evidenceTier to 'None' (trusted).
 *
 *   (2) EXCLUSION (scripts/eureka-portfolio-report.cjs 4b pass): a candidate pair
 *       with EITHER endpoint stamped low_confidence/fallback is dropped from ranking
 *       (unverified tier-1 regex hits like "Windows"/"CSFs" stop surfacing as
 *       opportunities), counted honestly as low_trust_pairs_excluded -- BUT ONLY
 *       when the room has at least one VERIFIED entity to surface instead. A pure
 *       Tier-0 room (every entity unverified) keeps ranking so Decision 8 ("Tier 0
 *       fully functional; graceful degradation everywhere") and the REQ-5 non-empty
 *       contract hold.
 *
 * WHY the guard: without it, a keyless + encoder-unavailable room degrades every
 * entity to 'fallback', and suppressing all of them ranks the room EMPTY. That is
 * the exact regression test-218-noise-reduction (REQ-5) would catch; this suite
 * pins BOTH directions so neither can silently break.
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
const navigation = require('../lib/core/navigation.cjs');
const RUNNER = require('../scripts/eureka-portfolio-report.cjs');
const { runExtraction } = require('../scripts/entity-extract.cjs');

let pass = 0;
let total = 0;
async function check(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// Build a hermetic room, seeding one memory_artifact per artifact (props.path ->
// the .md file), mirroring the test-218-what-why-classifier idiom.
function buildRoom(artifacts) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-lowtrust-'));
  for (const art of artifacts) {
    const secDir = path.join(roomDir, art.slug);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'FEYNMAN.md'), art.body + '\n', 'utf8');
  }
  const db = openRoomDb(roomDir, { allowExtension: true });
  for (const art of artifacts) {
    const id = 'memory_artifact:' + art.slug + ':FEYNMAN';
    const props = JSON.stringify({ title: art.slug, path: art.slug + '/FEYNMAN.md', section: art.slug });
    insertNode(db, id, 'memory_artifact', props, { source_path: 'memory:' + art.slug, created_by: 'system' });
  }
  closeRoomDb(db);
  return roomDir;
}

// Seed typed entity nodes with an explicit evidenceTier via the real writer, plus a
// DESCRIBES edge to a memory_artifact so the node has room provenance + degree.
function seedEntities(roomDir, specs) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  for (const s of specs) {
    const r = navigation.writeEntityNode(db, {
      entityType: s.entityType, name: s.name, sessionId: 'sess', evidenceTier: s.evidenceTier,
    });
    assert.ok(r && r.ok, 'entity write should succeed: ' + JSON.stringify(r));
    if (s.describes) {
      const entityId = navigation.ENTITY_NODE_ID('sess', s.name);
      navigation.writeEdge(db, {
        source_id: entityId, target_id: s.describes, edge_type: 'DESCRIBES',
        properties: { relation: 'describes' },
      });
    }
  }
  closeRoomDb(db);
}

// Run the shipped ranker offline in room-native mode; return the parsed report.
async function rank(roomDir) {
  const outMd = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.md');
  const outJson = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.json');
  const code = await RUNNER.main(['--db', roomDir, '--pairs', 'room', '--offline', '--top', '25', '--out', outMd, '--json', outJson]);
  assert.equal(code, 0, 'ranker should exit 0');
  return JSON.parse(fs.readFileSync(outJson, 'utf8'));
}

// A tier-2a surrogate: mark the named terms confident WHAT, everything else
// unconfident WHAT (so it escalates). With _forceNoLlm the escalated names take the
// no-LLM embedding best-guess -> stamped low_confidence.
function embedImpl(confidentSet) {
  return async function ({ names }) {
    const results = {};
    for (const n of names) {
      const conf = confidentSet.has(n);
      results[n] = { label: 'what', margin: conf ? 0.9 : 0.0, confident: conf };
    }
    return { ok: true, results, provenance: { model: 'stub', dim: 2, threshold: 0.05 } };
  };
}

function evidenceTierOf(db, sessionId, name) {
  const id = navigation.ENTITY_NODE_ID(sessionId, name);
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
  if (!row) return null;
  try { return JSON.parse(row.properties).evidenceTier; } catch (_e) { return null; }
}

async function main() {
  // -------------------------------------------------------------------------
  // Leg 1 (STAMPING): a mixed extraction stamps the no-LLM escalation
  // low_confidence and leaves the confident embedding WHAT trusted ('None').
  // -------------------------------------------------------------------------
  await check('leg1 stamping: no-LLM escalation -> low_confidence, confident -> None', async () => {
    const roomDir = buildRoom([{
      slug: 'analysis',
      body: [
        '# Competitors',
        '',
        'AION Labs competes with Recursion in the drug-discovery market.',
        'The ops note mentions Windows as the deployment target.',
      ].join('\n'),
    }]);
    // AION Labs confident (trusted); Windows unconfident -> escalates -> no LLM ->
    // low_confidence. Recursion confident too. _forceNoLlm makes the escalation
    // deterministic with no key.
    const confident = new Set(['AION Labs', 'Recursion']);
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      const result = await runExtraction(db, roomDir, 'entity-extract', 25, {
        embedClassifyImpl: embedImpl(confident), _forceNoLlm: true,
      });
      assert.equal(result.classifierSource, 'embedding', 'classifier_source embedding (low-conf disclosed)');
      // AION Labs is a confident WHAT entity -> trusted.
      const aion = evidenceTierOf(db, 'entity-extract', 'AION Labs');
      assert.equal(aion, 'None', 'confident entity is trusted (evidenceTier None), got ' + aion);
      // Windows escalated with no LLM -> low_confidence (IF tier-1 kept it as a candidate).
      const win = evidenceTierOf(db, 'entity-extract', 'Windows');
      if (win !== null) {
        assert.equal(win, 'low_confidence', 'no-LLM escalated entity stamped low_confidence, got ' + win);
      }
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Leg 2 (MIXED-ROOM EXCLUSION): a room with 2 verified entities + 1 low-trust
  // entity. The verified pair ranks; every pair touching the low-trust entity is
  // excluded and counted; no ranked pair references the low-trust node.
  // -------------------------------------------------------------------------
  await check('leg2 exclusion: mixed room drops low-trust pairs, verified pair survives', async () => {
    const roomDir = buildRoom([
      { slug: 'companies', body: '# Companies\n\nAcme and Globex compete in the market.' },
      { slug: 'tech', body: '# Technology\n\nWidget is the core platform component.' },
      { slug: 'noise', body: '# Notes\n\nWindows is the deployment target for the build.' },
    ]);
    seedEntities(roomDir, [
      { entityType: 'company', name: 'Acme', evidenceTier: 'None', describes: 'memory_artifact:companies:FEYNMAN' },
      { entityType: 'technology', name: 'Widget', evidenceTier: 'None', describes: 'memory_artifact:tech:FEYNMAN' },
      { entityType: 'market', name: 'Windows', evidenceTier: 'low_confidence', describes: 'memory_artifact:noise:FEYNMAN' },
    ]);
    const report = await rank(roomDir);
    const ranked = Array.isArray(report.ranked) ? report.ranked : [];
    assert.ok((report.provenance.low_trust_pairs_excluded || 0) > 0,
      'low_trust_pairs_excluded must be > 0 in a mixed room, got ' + report.provenance.low_trust_pairs_excluded);
    assert.ok(ranked.length > 0, 'verified entities must still rank (non-empty)');

    // Map ranked pair ids back to node titles/names; no ranked endpoint may be the
    // low-trust "Windows" entity.
    const db = openRoomDb(roomDir, { allowExtension: true });
    const rows = db.prepare('SELECT id, type, properties FROM nodes').all();
    const nameById = new Map();
    for (const row of rows) {
      let nm = null; try { nm = JSON.parse(row.properties).name; } catch (_e) { nm = null; }
      nameById.set(RUNNER.catalogId(row), nm);
    }
    closeRoomDb(db);
    for (const p of ranked) {
      assert.notEqual(nameById.get(p.a), 'Windows', 'no ranked pair endpoint may be the low-trust entity: ' + JSON.stringify(p));
      assert.notEqual(nameById.get(p.b), 'Windows', 'no ranked pair endpoint may be the low-trust entity: ' + JSON.stringify(p));
    }
    fs.rmSync(roomDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Leg 3 (PURE-TIER-0 GUARD): a room whose ONLY entities are low-trust. The
  // exclusion is SKIPPED (no verified entity to surface instead), nothing is
  // counted as low_trust_pairs_excluded, and the room still ranks non-empty
  // (Decision 8 graceful degradation preserved).
  // -------------------------------------------------------------------------
  await check('leg3 guard: pure Tier-0 room keeps ranking (exclusion skipped)', async () => {
    const roomDir = buildRoom([
      { slug: 'a', body: '# A\n\nAcme competes in the market.' },
      { slug: 'b', body: '# B\n\nWidget is the platform.' },
    ]);
    seedEntities(roomDir, [
      { entityType: 'company', name: 'Acme', evidenceTier: 'fallback', describes: 'memory_artifact:a:FEYNMAN' },
      { entityType: 'technology', name: 'Widget', evidenceTier: 'fallback', describes: 'memory_artifact:b:FEYNMAN' },
    ]);
    const report = await rank(roomDir);
    const ranked = Array.isArray(report.ranked) ? report.ranked : [];
    assert.equal(report.provenance.low_trust_pairs_excluded || 0, 0,
      'pure Tier-0 room must NOT exclude any low-trust pair (guard skips), got ' + report.provenance.low_trust_pairs_excluded);
    assert.ok(ranked.length > 0, 'pure Tier-0 room must still rank non-empty (Decision 8 graceful degradation)');
    fs.rmSync(roomDir, { recursive: true, force: true });
  });

  console.log('\n' + pass + '/' + total + ' low-trust exclusion checks passed');
  if (pass !== total) process.exit(1);
}

main().catch(function (err) {
  console.error('test-218-low-trust-exclusion FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
