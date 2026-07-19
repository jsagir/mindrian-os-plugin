'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Regression test for CR-01 (code review, phase 231, 2026-07-19,
 * .planning/phases/231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont/231-REVIEW.md).
 *
 * THE BUG: the same entity name can appear in more than one artifact. Tier-2a
 * classifies each unique name ONCE globally, but tier-2b escalation runs PER
 * ARTIFACT with a separate network call each time. An ordinary transient failure
 * on just ONE of those calls (not an adversarial input) can leave two entries for
 * the same name disagreeing on evidenceTier: one resolves confidently
 * (evidenceTier 'None', trusted), the other falls to the no-LLM embedding
 * best-guess (evidenceTier 'low_confidence'). Before the CR-01 fix, both entries
 * wrote to the SAME node id (ENTITY_NODE_ID is minted from name alone) via a full
 * ON-CONFLICT overwrite (never a merge), so whichever entry happened to write
 * LAST in array order won outright -- silently flipping a trusted entity to
 * excluded (or vice versa) based on filesystem read order, not evidence.
 *
 * THE FIX (scripts/entity-extract.cjs, reconcileEvidenceTierAcrossDuplicateNames):
 * before the write loop, normalize evidenceTier across every entry sharing a name
 * to the HIGHEST-trust verdict seen for that name, mirroring the "confident
 * upgrade wins" reconciliation applyFrameworkTerms() already does for the WHY
 * side. This is inherently order-independent (a reduce over the full set, not
 * last-write-wins), and it must NOT remove any entries -- every artifact that
 * mentions the entity still needs its own DESCRIBES edge.
 *
 * This test seeds two artifacts mentioning the SAME entity name, forces one
 * tier-2b call to succeed (source 'model', trusted) and the other to fail
 * (falls to the no-LLM embedding best-guess, low_confidence), and asserts:
 *   (a) the final written node keeps the TRUSTED verdict regardless of which
 *       artifact's write happens to land last, and
 *   (b) both artifacts still get a DESCRIBES edge (no provenance lost).
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
const { runExtraction } = require('../scripts/entity-extract.cjs');

let pass = 0;
let total = 0;
async function check(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

function buildRoom(artifacts) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-dupent-'));
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

function evidenceTierOf(db, sessionId, name) {
  const id = navigation.ENTITY_NODE_ID(sessionId, name);
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
  if (!row) return null;
  try { return JSON.parse(row.properties).evidenceTier; } catch (_e) { return null; }
}

function describesEdgeCount(db, sessionId, name, targetArtifactId) {
  const entityId = navigation.ENTITY_NODE_ID(sessionId, name);
  const rows = db.prepare(
    "SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = 'DESCRIBES'"
  ).all(entityId, targetArtifactId);
  return rows.length;
}

// Tier-2a surrogate: the shared entity name is always unconfident (forces
// escalation in both artifacts); everything else is confident so it never
// escalates and never competes for the same name.
function embedImpl() {
  return async function ({ names }) {
    const results = {};
    for (const n of names) {
      const conf = n !== 'Recursion';
      results[n] = { label: 'what', margin: conf ? 0.9 : 0.0, confident: conf };
    }
    return { ok: true, results, provenance: { model: 'stub', dim: 2, threshold: 0.05 } };
  };
}

// Tier-2b surrogate: succeeds (source 'model', confident 'what') for the
// artifact whose excerpt contains the WINS marker; throws (simulating a
// transient network failure) for the artifact whose excerpt contains the
// FAILS marker, which routes that artifact's escalated candidates to the
// no-LLM embedding best-guess -> low_confidence.
function classifyImpl() {
  return async function ({ names, excerpt }) {
    if (String(excerpt).indexOf('WINSMARKER') !== -1) {
      const labels = {};
      for (const n of names) labels[n] = 'what';
      return { labels: labels, source: 'model' };
    }
    throw new Error('injected transient failure for the FAILS artifact');
  };
}

async function main() {
  await check('CR-01: duplicate entity name reconciles to the highest-trust verdict, both DESCRIBES edges survive', async () => {
    const roomDir = buildRoom([
      {
        slug: 'artifact-a',
        body: [
          '# Competitive landscape',
          '',
          'Recursion is a major player here. WINSMARKER this call succeeds.',
        ].join('\n'),
      },
      {
        slug: 'artifact-b',
        body: [
          '# Follow-up notes',
          '',
          'Recursion came up again in this separate artifact. FAILSMARKER this call fails.',
        ].join('\n'),
      },
    ]);
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      const result = await runExtraction(db, roomDir, 'entity-extract', 25, {
        embedClassifyImpl: embedImpl(),
        classifyImpl: classifyImpl(),
      });
      assert.ok(result.entitiesWritten >= 1, 'at least one entity node should have been written, got ' + JSON.stringify(result));

      // The core CR-01 assertion: whichever artifact's write happened to land
      // last in array order, the SURVIVING evidenceTier must be the trusted
      // one ('None'), never 'low_confidence' -- reconciliation, not last-write-wins.
      const tier = evidenceTierOf(db, 'entity-extract', 'Recursion');
      assert.equal(tier, 'None',
        'the trusted (model-confirmed) verdict must survive regardless of write order, got evidenceTier=' + tier);

      // Provenance must not be lost: both artifacts still get their own
      // DESCRIBES edge to the same reconciled entity node.
      const edgesToA = describesEdgeCount(db, 'entity-extract', 'Recursion', 'memory_artifact:artifact-a:FEYNMAN');
      const edgesToB = describesEdgeCount(db, 'entity-extract', 'Recursion', 'memory_artifact:artifact-b:FEYNMAN');
      assert.equal(edgesToA, 1, 'DESCRIBES edge to artifact-a must survive the reconciliation, got ' + edgesToA);
      assert.equal(edgesToB, 1, 'DESCRIBES edge to artifact-b must survive the reconciliation, got ' + edgesToB);
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  console.log('\n' + pass + '/' + total + ' duplicate-entity-reconciliation checks passed');
  if (pass !== total) process.exit(1);
}

main().catch(function (err) {
  console.error('test-218-duplicate-entity-reconciliation FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
