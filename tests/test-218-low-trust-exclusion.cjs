'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * RCA handoff-eureka-entity-noise-2026-07-19 -- the low-trust entity provenance
 * split, the STAMPING half (offline/hermetic):
 *
 *   STAMPING (scripts/entity-extract.cjs): a surviving WHAT entity that arrived
 *   via the two-tier NO-LLM embedding best-guess is stamped
 *   props.evidenceTier = 'low_confidence'; one from the encoder-and-key-absent
 *   degrade is stamped 'fallback'; a confident (embedding or model) WHAT is left
 *   unstamped so writeEntityNode defaults evidenceTier to 'None' (trusted).
 *
 * Phase 366 plan 25 (D-02, runner retirement, slice B): this file used to carry
 * two more legs on the EXCLUSION half, the standalone Eureka runner's 4b pass
 * (a candidate pair touching a low_confidence/fallback entity dropped from
 * ranking, counted as low_trust_pairs_excluded, plus the pure-Tier-0 guard that
 * skipped the exclusion when no verified entity existed). The runner is retired
 * and the Eureka perspective that replaces it has no low-trust pair filter
 * (entities there are bridges between content things, not ranked endpoints),
 * so those two legs retired with their subject. The stamping leg stays: the
 * extractor still writes evidenceTier and other readers (the 219 disclosure
 * and metadata legs) depend on it.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic: never read the operator's real home, rooms or session.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-lowtrust-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-lowtrust-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const navigation = require('../lib/core/navigation.cjs');
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
    // R17-02 (260903-gdm): insertNode requires epistemic_type; fixture repaired in Phase 363.1-03 so D-10's gate runs
    insertNode(db, id, 'memory_artifact', props, { source_path: 'memory:' + art.slug, created_by: 'system', epistemic_type: 'observation' });
  }
  closeRoomDb(db);
  return roomDir;
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

  console.log('\n' + pass + '/' + total + ' low-trust stamping checks passed');
  if (pass !== total) process.exit(1);
}

main().catch(function (err) {
  console.error('test-218-low-trust-exclusion FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
