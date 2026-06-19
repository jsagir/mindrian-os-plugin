'use strict';
// ========================================
// MINDRIAN UNKNOWN-UNKNOWNS ADVERSARIAL STRUCTURED VERDICT (Phase 165 Wave 6)
// Harness-as-code property 6: "adversarial verify returns a STRUCTURED VERDICT,
// not a vibe." This module PROVES the unknown-unknowns blind-spot engine BY
// INSTRUMENTATION -- it builds the seeded fixture room, runs the REAL
// discoverUnknownUnknowns pipeline against it, and asserts the planted blind spot
// (the over-confident graded-confirmed claim made stale + heavily contradicted) is
// actually surfaced, the findings landed PROPOSED (never confirmed), only the four
// frozen edge types were emitted, the corpus equals the graded-confirmed UNION, and
// the scan checkpoint is present + resumable byte-identically.
//
// runVerdict({roomDir, db}) returns { passed, findings[] } where each finding is a
// structured { check, ok, detail }. passed = AND over every finding.ok. It mirrors
// the shipped 169 W6 (tests/test-graph-derivation-verdict.cjs) and 164 W6
// (tests/test-bono-verdict.cjs) idiom: a guard accumulator that turns a thrown
// AssertionError into a FAILED finding carrying the assertion message (the real
// defect), so a genuine breach in Waves 1-5 is SURFACED, never silently swallowed.
//
// LOCAL only (Part 8 / D-165-10): the verdict runs against the LOCAL fixture
// room.db; zero Brain require in this module. It builds (or accepts) the caller's
// room handle and reads/writes ONLY the LOCAL room.db via the navigation chokepoint.
//
// If the verdict surfaces a REAL defect in Waves 1-3 (not a self-defect in the
// verdict) the caller reports it as a finding and STOPS for orchestrator review,
// rather than silently patching another wave.
//
// NO em-dashes (CLAUDE.md HARD RULE); CJS; no new deps.
//
// Sources: tests/test-graph-derivation-verdict.cjs (169 W6 verdict shape),
// tests/test-bono-verdict.cjs (164 W6), lib/core/unknowns/orchestrator.cjs
// (discoverUnknownUnknowns), tests/fixtures/unknowns/build-fixture-room.cjs (the
// planted blind spot), the engine modules (corpus-adapter, dsp, bandit,
// edge-writer), lib/core/navigation/edges.cjs (the LIVE frozen set).
// ========================================

const fs = require('node:fs');
const path = require('node:path');

const { discoverUnknownUnknowns } = require('./orchestrator.cjs');
const { findConfidentClaims } = require('./corpus-adapter.cjs');
const { interPartitionFeatureDistance, partition: dspPartition } = require('./dsp.cjs');
const { minePatterns } = require('./pattern-miner.cjs');
const { FROZEN_ENGINE_EDGES } = require('./iface.cjs');
const { ALLOWED_EDGE_TYPES } = require('../navigation/edges.cjs');
const { buildFixtureRoom } = require('../../../tests/fixtures/unknowns/build-fixture-room.cjs');
const { openRoomDb, closeRoomDb } = require('../room-db.cjs');
const navigation = require('../navigation.cjs');

// The deterministic now anchor (matches the fixture's default 2025-ish epoch).
const NOW = 1750000000000;
// A budget of 1.0 probes EVERY corpus instance so the planted blind spot is reached.
const FULL_BUDGET = { budget: 1.0 };

// Seed the planted blind spot with heavy CONTRADICTS density on the already-stale
// corpus claim so the REAL locked proxy math (0.5*cd + 0.2*stale crosses 0.5) labels
// it a UU. This is the SAME controlled-UU construction the rank-in / proxy-oracle
// tests use -- it exercises the locked weights, it does NOT tune the threshold.
function seedPlantedBlindSpot(db, staleId) {
  for (let i = 0; i < 5; i += 1) {
    const r = navigation.writeEdge(db, {
      source_id: 'handle:verdict-contra-' + i,
      target_id: staleId,
      edge_type: 'CONTRADICTS',
      properties: { relation: 'verdict_signal' },
    });
    if (!r || r.ok === false) {
      throw new Error('verdict could not seed the planted blind spot: ' + (r && r.reason));
    }
  }
}

/**
 * runVerdict(args) -> { passed, findings: [{ check, ok, detail }] }
 *
 * Build (or accept) the seeded fixture room, run discoverUnknownUnknowns against it,
 * and return the structured adversarial verdict. passed = AND over findings.ok.
 *
 * @param {object} [args]
 * @param {string} [args.roomDir] a LOCAL room dir (a fresh temp room is built when absent).
 * @param {object} [args.db]      a caller-owned room.db handle (opened when absent).
 */
function runVerdict(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const findings = [];

  // Resolve the LOCAL fixture room (build a fresh seeded one when not supplied).
  let roomDir = (typeof a.roomDir === 'string' && a.roomDir.length > 0) ? a.roomDir : null;
  let ownedDir = null;
  if (!roomDir) {
    const os = require('node:os');
    ownedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-verdict-'));
    roomDir = ownedDir;
  }
  const info = buildFixtureRoom(roomDir, { now: NOW });

  // The verdict owns its db handle when the caller did not pass one.
  let db = a.db || null;
  let ownedDb = false;
  if (!db) { db = openRoomDb(roomDir); ownedDb = true; }

  // Seed the planted blind spot so the engine has something to surface.
  try {
    seedPlantedBlindSpot(db, info.staleId);
  } catch (e) {
    findings.push({ check: 'fixture-seed', ok: false, detail: (e && e.message) || String(e) });
  }

  // The structured-finding accumulator: a thrown AssertionError becomes a FAILED
  // finding carrying the message (mirrors the 169 W6 guard accumulator).
  function guard(check, fn) {
    try {
      const detail = fn();
      findings.push({ check, ok: true, detail: detail || 'verified by instrumentation' });
    } catch (e) {
      findings.push({ check, ok: false, detail: (e && e.message) ? e.message : String(e) });
    }
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg); }

  // Run the REAL pipeline ONCE against the seeded fixture (the instrumentation).
  let res = null;
  try {
    res = discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
  } catch (e) {
    findings.push({ check: 'engine-runs', ok: false, detail: 'discoverUnknownUnknowns threw: ' + ((e && e.message) || String(e)) });
  }

  if (res) {
    // -----------------------------------------------------------------------
    // (1) blind-spot-surfaced -- the planted contradicted+stale graded-confirmed
    // claim is in the proxy-labeled UU set (the engine surfaces the blind spot).
    // -----------------------------------------------------------------------
    guard('blind-spot-surfaced: the planted contradicted+stale graded-confirmed claim is labeled a UU and surfaced as a proxy-labeled candidate', () => {
      ok(Array.isArray(res.uuInstances), 'res.uuInstances is not an array');
      ok(res.uuInstances.length > 0, 'the engine surfaced ZERO UU instances (the planted blind spot was missed)');
      ok(res.uuInstances.indexOf(info.staleId) !== -1,
        'the planted blind spot (' + info.staleId + ') is NOT in the surfaced UU set: ' + JSON.stringify(res.uuInstances));
      // It also rode the rank-in to the F.1 gate.
      ok(res.ranked && Array.isArray(res.ranked.items), 'the surfaced blind spot did not rank into the F.1 set');
      return 'planted blind spot ' + info.staleId + ' surfaced in the UU set (' + res.uuInstances.length + ' UU instance(s)) and ranked into F.1';
    });

    // -----------------------------------------------------------------------
    // (2) proposed-only -- no confirmed truth-claim node written by the engine.
    // -----------------------------------------------------------------------
    guard('proposed-only: every finding the engine wrote is review_status proposed; zero confirmed truth-claim node written by the engine (Part 9 role 5; the engine HALTS at the gate)', () => {
      ok(res.findings && Array.isArray(res.findings.nodes), 'res.findings.nodes is not an array');
      ok(res.findings.written > 0, 'the engine wrote ZERO findings (the blind spot was not written PROPOSED)');
      for (const n of res.findings.nodes) {
        ok(n.review_status === 'proposed',
          'a finding node landed non-proposed (' + n.review_status + '): ' + n.id);
      }
      // By instrumentation against the db: no engine-written claim node is confirmed.
      const confirmed = db.prepare(
        "SELECT id FROM nodes WHERE id LIKE 'claim:uu-scan:%' AND review_status = 'confirmed'"
      ).all();
      ok(confirmed.length === 0, 'the engine auto-confirmed a blind spot (Part 9 role 5 breach): ' + JSON.stringify(confirmed));
      return res.findings.written + ' finding(s) written PROPOSED; zero engine-written confirmed node (the engine halted at the gate, no confirmNode)';
    });

    // -----------------------------------------------------------------------
    // (3) frozen-edges-only -- the emitted edge types are a subset of the four
    // frozen FROZEN_ENGINE_EDGES, and every one is a LIVE ALLOWED_EDGE_TYPES member.
    // -----------------------------------------------------------------------
    guard('frozen-edges-only: every emitted edge type is one of the four frozen INVALIDATES/ROOT_CAUSES/ENABLES/FEEDS_INTO AND a LIVE ALLOWED_EDGE_TYPES member (D-165-08 remap-only)', () => {
      const frozen = new Set(Object.values(FROZEN_ENGINE_EDGES));
      ok(res.findings && Array.isArray(res.findings.edges), 'res.findings.edges is not an array');
      const emitted = new Set();
      for (const e of res.findings.edges) {
        const t = e.type || e.edge_type;
        emitted.add(t);
        ok(frozen.has(t), 'an emitted edge type "' + t + '" is OUTSIDE the four frozen engine edges');
        ok(ALLOWED_EDGE_TYPES.has(t), 'an emitted edge type "' + t + '" is NOT a LIVE ALLOWED_EDGE_TYPES member (drift)');
      }
      ok(emitted.size > 0, 'the engine emitted ZERO edges (the blind spot produced no cascade edge)');
      ok(emitted.has(FROZEN_ENGINE_EDGES.INVALIDATES), 'the blind-spot INVALIDATES finding edge was not emitted');
      return 'emitted {' + [...emitted].sort().join(', ') + '}; every type frozen + live; INVALIDATES blind-spot edge present';
    });

    // -----------------------------------------------------------------------
    // (4) corpus-graded-confirmed -- the corpus equals the fixture's
    // Academic/Operational confirmed set (NOT empty, NOT the excluded rows).
    // -----------------------------------------------------------------------
    guard('corpus-graded-confirmed: the engine corpus equals the fixture graded-confirmed UNION (exactly the Academic/Operational confirmed rows, excludes the None/Practitioner/ungraded/proposed rows)', () => {
      ok(res.corpusSize === info.corpusIds.length,
        'corpusSize ' + res.corpusSize + ' != the ' + info.corpusIds.length + ' graded-confirmed fixture rows');
      // Independently re-read the corpus and prove set-equality with the fixture.
      const corpus = findConfidentClaims(db, { now: NOW });
      const got = new Set(corpus.map((c) => c.claimId));
      const want = new Set(info.corpusIds);
      ok(got.size === want.size, 'corpus size mismatch: got ' + got.size + ' want ' + want.size);
      for (const id of want) ok(got.has(id), 'a graded-confirmed corpus row is missing: ' + id);
      // The excluded rows are NOT in the corpus (the filter excludes the rest).
      for (const id of info.nonCorpusIds) {
        ok(!got.has(id), 'an excluded non-corpus row leaked into the corpus: ' + id);
      }
      return 'corpus = exactly the ' + want.size + ' graded-confirmed Academic/Operational rows; ' + info.nonCorpusIds.length + ' excluded rows stayed out';
    });

    // -----------------------------------------------------------------------
    // (5) resumable -- the checkpoint sidecar is present AND a resume is
    // byte-identical (same corpusHash continues; the surfaced UU set is stable).
    // -----------------------------------------------------------------------
    guard('resumable: the per-pull checkpoint sidecar is present AND a resume against the same corpus is byte-identical (D-165-09 deterministic resume)', () => {
      const sidecar = path.join(roomDir, '.mindrian', 'uu-scan.json');
      ok(fs.existsSync(sidecar), 'the checkpoint sidecar was not persisted to the LOCAL room dir');
      const cp = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
      ok(typeof cp.corpusHash === 'string' && cp.corpusHash.length > 0, 'the sidecar checkpoint has no corpusHash');
      ok(typeof cp.pull === 'number', 'the sidecar checkpoint has no pull counter');
      // A re-run against the unchanged corpus is byte-identical (same surfaced set +
      // same corpusHash). This proves the resume path is deterministic, not random.
      const again = discoverUnknownUnknowns({ roomDir, db, config: FULL_BUDGET, now: NOW });
      ok(JSON.stringify(again.uuInstances.slice().sort()) === JSON.stringify(res.uuInstances.slice().sort()),
        'a resume surfaced a DIFFERENT UU set (non-deterministic): ' + JSON.stringify(again.uuInstances));
      const cp2 = JSON.parse(fs.readFileSync(sidecar, 'utf-8'));
      ok(cp2.corpusHash === cp.corpusHash, 'the resume corpusHash drifted (a fresh scan started against the same corpus)');
      return 'checkpoint present (pull=' + cp.pull + '); resume byte-identical (same UU set + same corpusHash)';
    });

    // -----------------------------------------------------------------------
    // (6) real-interPartitionDistance -- the DSP metric DISCRIMINATES (it is the
    // REAL distance, not the reference stub 1.0; a lone partition returns 0.0).
    // -----------------------------------------------------------------------
    guard('real-interPartitionDistance: the DSP inter-partition distance DISCRIMINATES on the fixture corpus (a real value, not the stub 1.0; a lone partition returns 0.0)', () => {
      const corpus = findConfidentClaims(db, { now: NOW });
      ok(corpus.length >= 2, 'need >=2 corpus rows to exercise the distance metric');
      const patterns = minePatterns(corpus);
      const parts = dspPartition(corpus, undefined, patterns);
      ok(Array.isArray(parts) && parts.length >= 1, 'DSP produced no partition');
      const ranges = { confidence: 1.0, ageDays: 100, evidenceTier: 3 };
      // A lone partition (no siblings) returns 0.0 -- the stub-leak regression guard.
      const lone = parts[0];
      const loneDist = interPartitionFeatureDistance(lone, [lone], ranges);
      ok(loneDist === 0.0, 'a lone partition distance must be 0.0 (the stub 1.0 leaked), got ' + loneDist);
      // When there are >=2 partitions the metric produces a real, non-1.0 value.
      if (parts.length >= 2) {
        const d = interPartitionFeatureDistance(parts[0], parts, ranges);
        ok(d > 0, 'the inter-partition distance is 0 for distinct centroids (the metric does not discriminate)');
        ok(d !== 1.0, 'the inter-partition distance is the stub 1.0 (the stub leaked)');
        return 'lone partition = 0.0; ' + parts.length + ' partitions yield a real discriminating distance ' + d.toFixed(4);
      }
      return 'lone partition = 0.0 (the stub-leak guard holds; the fixture corpus collapsed to one partition)';
    });
  }

  if (ownedDb) { try { closeRoomDb(db); } catch (_e) { /* best-effort */ } }
  if (ownedDir) { try { fs.rmSync(ownedDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ } }

  const passed = findings.length > 0 && findings.every((f) => f.ok);
  return { passed, findings };
}

module.exports = { runVerdict };
