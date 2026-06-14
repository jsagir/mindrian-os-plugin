#!/usr/bin/env node
/**
 * Phase 156 Plan 02 -- FW-06 integration test: file -> register -> assert ->
 * compute-hsi.py -> hsi-to-graph.cjs -> read-back HSI_CONNECTION.
 *
 * Asserts (node built-in assert, no framework):
 *   1. registerConsequenceArtifacts files >= 4 consequence .md (>= 2 PESTEL
 *      domains) AND registers each as a type='Artifact' node in room.db, with a
 *      ROOM.md (ICM Layer 0) in every consequence folder.
 *   2. assertArtifactCountMatchesFiled returns ok:true (Artifact count == filed).
 *   3. NEGATIVE: when an Artifact node is missing, the guard returns ok:false
 *      AND runHsiScan refuses (reason:'artifact_count_mismatch') -- it does NOT
 *      call compute-hsi (the LANDMINE #1 false-success guard fires).
 *   4. With python3 + HSI deps: runHsiScan produces .hsi-results.json AND >= 1
 *      HSI_CONNECTION edge in room.db in one call. Without: degrades cleanly.
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-hsi-integration';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const {
  generateRing,
  registerConsequenceArtifacts,
  assertArtifactCountMatchesFiled,
  runHsiScan,
} = orch;

// >= 4 consequences across >= 2 PESTEL domains. HSI rewards DIVERGENCE between
// structural (LSA / TF-IDF) and semantic (MiniLM) similarity:
//   hsi_score = 0.6 * |semantic_sim - lsa_sim| + 0.4 * integrative_factor.
// So these artifacts share underlying MEANING (high semantic) but use disjoint
// VOCABULARY (low lexical overlap), each >= 5 sentences (the spectral path), to
// clear the 0.30 threshold and form >= 1 cross-domain HSI_CONNECTION.
const RAW_CHILDREN = [
  {
    label: 'Teaching machines slash the price of learning',
    horizon: 'mid', confidence: 0.7, domain: 'Economic',
    body: 'Teaching machines slash the price of learning. A pupil now pays almost nothing for a private mentor. '
      + 'Schools shrink their payroll because software handles drills. The savings ripple through household budgets. '
      + 'Families redirect money once spent on tutors toward other needs.',
  },
  {
    label: 'Software mentors reach forgotten neighborhoods',
    horizon: 'mid', confidence: 0.6, domain: 'Social',
    body: 'Software mentors reach forgotten neighborhoods. A child in a remote village opens the same lessons as a city kid. '
      + 'Old barriers of distance and class begin to dissolve. Communities that lacked teachers gain a tireless guide. '
      + 'The sense of who belongs in a classroom widens.',
  },
  {
    label: 'Self-improving models leap ahead each quarter',
    horizon: 'near', confidence: 0.65, domain: 'Technological',
    body: 'Self-improving models leap ahead each quarter. The engine that tutors a student rewrites parts of itself. '
      + 'Each release understands a question more deeply than the last. Capability compounds faster than anyone forecast. '
      + 'Engineers race to keep guardrails ahead of the curve.',
  },
  {
    label: 'Lawmakers fence in the autonomous teacher',
    horizon: 'long', confidence: 0.5, domain: 'Legal',
    body: 'Lawmakers fence in the autonomous teacher. Statutes appear that demand a human sign off on grades. '
      + 'Courts weigh whether an algorithm may certify a diploma. New rules govern how a learning record may be stored. '
      + 'Liability for a bad lesson becomes a fresh legal question.',
  },
];

function rmrf(dir) {
  if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
}

(async () => {
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-hsi-'));

    // --- Generate a bounded ring-1 batch from the seed. ---
    const consequences = generateRing('adaptive education futures', 1, [], { children: RAW_CHILDREN });
    assert.strictEqual(consequences.length, 4, 'all 4 valid consequences generated');
    const domains = new Set(consequences.map((c) => c.domain));
    assert.ok(domains.size >= 2, 'consequences span >= 2 PESTEL domains (cross-domain HSI possible)');

    // --- 1. File + register as Artifact nodes. ---
    const reg = await registerConsequenceArtifacts(tmp, consequences, { seed: 'adaptive education futures' });
    assert.strictEqual(reg.filed.length, 4, 'four consequence .md files filed + registered');
    const filedIds = reg.filed.map((f) => f.id);

    // .md on disk (compute-hsi input) + ROOM.md per folder (ICM Layer 0).
    for (const f of reg.filed) {
      assert.ok(fs.existsSync(f.path), 'consequence .md exists on disk: ' + f.path);
      const roomMd = path.join(path.dirname(f.path), 'ROOM.md');
      assert.ok(fs.existsSync(roomMd), 'ICM Layer 0 ROOM.md exists in consequence folder: ' + roomMd);
    }

    // --- 2. Artifact node count == filed count (the precondition is satisfied). ---
    {
      const graph = await lazygraph.openGraph(tmp);
      try {
        const guard = assertArtifactCountMatchesFiled(graph.db, filedIds);
        assert.strictEqual(guard.ok, true, 'guard ok:true when every consequence is a registered Artifact node');
        assert.strictEqual(guard.artifactCount, 4, 'four Artifact nodes registered');
        assert.strictEqual(guard.filedCount, 4, 'four consequences filed');
      } finally {
        await lazygraph.closeGraph(graph.db);
      }
    }

    // --- 3. NEGATIVE: a missing Artifact node makes the guard HARD-FAIL, and
    //        runHsiScan refuses to proceed to compute-hsi (false-success guard). ---
    {
      const bogusIds = filedIds.concat(['opportunity-bank/futures-x/never-registered/never-registered']);
      const graph = await lazygraph.openGraph(tmp);
      try {
        const guard = assertArtifactCountMatchesFiled(graph.db, bogusIds);
        assert.strictEqual(guard.ok, false, 'guard ok:false when an Artifact node is missing');
        assert.strictEqual(guard.artifactCount, 4, 'four real Artifact nodes found');
        assert.strictEqual(guard.filedCount, 5, 'five ids claimed filed');
        assert.ok(guard.missing.length === 1, 'the missing id is reported');
      } finally {
        await lazygraph.closeGraph(graph.db);
      }
      const refused = await runHsiScan(tmp, bogusIds, { pluginRoot: REPO });
      assert.strictEqual(refused.ok, false, 'runHsiScan refuses on count mismatch');
      assert.strictEqual(refused.reason, 'artifact_count_mismatch', 'runHsiScan reports the mismatch reason');
      assert.strictEqual(refused.hsiEdgeCount, 0, 'no HSI edges written on the refused path');
      // The guard fired BEFORE compute-hsi -- no results file should exist yet.
      assert.ok(!fs.existsSync(path.join(tmp, '.hsi-results.json')),
        'compute-hsi was NOT invoked on the refused (mismatch) path');
    }

    // --- 4. Happy path: file -> register -> assert -> compute-hsi -> hsi-to-graph
    //        -> read-back. >= 1 HSI_CONNECTION with python3; clean degrade without. ---
    const result = await runHsiScan(tmp, filedIds, { pluginRoot: REPO });
    assert.strictEqual(result.ok, true, 'runHsiScan ok:true on the matched-count happy path');
    assert.strictEqual(result.guard.ok, true, 'the precondition guard passed before the scan');

    if (result.degraded) {
      // Tri-Polar: python3 / HSI deps absent -> Tier 0 clean degrade (CI without python3).
      assert.strictEqual(result.tier, 0, 'degraded path reports Tier 0');
      assert.ok(typeof result.reason === 'string' && /tier0/i.test(result.reason),
        'degraded path reports a Tier 0 fallback reason: ' + result.reason);
      console.log('NOTE ' + SUITE + ': python3/HSI unavailable -- verified clean Tier 0 degradation (reason=' + result.reason + ')');
    } else {
      assert.strictEqual(result.tier, 1, 'full path reports Tier 1');
      assert.ok(fs.existsSync(path.join(tmp, '.hsi-results.json')), '.hsi-results.json produced by compute-hsi');
      assert.ok(result.hsiEdgeCount >= 1, 'at least one HSI_CONNECTION edge after the scan (got ' + result.hsiEdgeCount + ')');
      // Confirm via a direct read-back too.
      const graph = await lazygraph.openGraph(tmp);
      try {
        const row = graph.db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'HSI_CONNECTION'").get();
        assert.ok(row.n >= 1, 'room.db carries >= 1 HSI_CONNECTION edge');
      } finally {
        await lazygraph.closeGraph(graph.db);
      }
      console.log('NOTE ' + SUITE + ': Tier 1 scan produced ' + result.hsiEdgeCount + ' HSI_CONNECTION edge(s)');
    }

    rmrf(tmp);
    console.log('PASS ' + SUITE);
    process.exit(0);
  } catch (e) {
    rmrf(tmp);
    console.error('FAIL ' + SUITE + ': ' + (e && e.message));
    console.error(e && e.stack);
    process.exit(1);
  }
})();
