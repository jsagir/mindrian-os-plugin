#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-01 Wave 0 -- Resolver zero-leak fs-instrument suite (SC2 / SC9)
 * =========================================================================
 * Mirrors tests/test-navigation-acceptance.cjs: install an fs proxy BEFORE
 * driving a resolver invocation, uninstall AFTER, and assert the resolver path
 * performed ZERO non-SQLite filesystem reads except the single allow-listed
 * USER.md (the intent leg). This proves SC2 (zero non-SQLite folder scans for
 * navigation) and contributes to SC9 (the resolver is local-only sync; it issues
 * zero outbound Brain payloads -- a pure-local read path has nothing to leak).
 *
 * The resolver is reached through the public decide(turn, context) entry
 * (resolveOfferNextStep is not exported). The fixture context carries an
 * in-memory roomState (db null) and a pre-read quadruple, so decide() never
 * falls back to readQuadruple and the resolver computes against the passed-in
 * roomState -- no folder scan. If decide() ever reaches room.db it must do so
 * ONLY via the navigation.cjs chokepoint (no direct room-db.cjs require); the
 * fs proxy asserts no off-allow-list read regardless.
 *
 * A prewarm() throwaway decide() runs BEFORE the instrumented section so the
 * engine's lazy-require chains are cached and do not trip the proxy (the Phase
 * 130 idiom). The resolver-grade SC2 assertion is RED until 135-02 fills the
 * resolver body; the zero-leak invariant on the decide() path holds GREEN now.
 *
 * Framework: direct-CJS node:assert/strict. No em-dashes. No emoji.
 * Registered in tests/run-all-135.sh (Task 3).
 */

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

// The fs-instrument allow-list permits the .mindrian/room.db family only. The
// resolver's single permitted non-SQLite read is the USER.md intent leg; we add
// it to the local allow-list check so a USER.md read does not count as a leak.
function isExtraAllowed(target) {
  if (typeof target !== 'string') return false;
  return /USER\.md$/.test(path.resolve(target));
}

// ---------- Fixtures (in-memory; no real room.db) ----------

function makeBrain() {
  return {
    exists: true,
    section: 'market-analysis',
    brain_generated_at: '2026-04-20T12:00:00Z',
    brain_graph_version: 1,
    governing_thought_hash: 'sha256:abc123',
    staleness: 'fresh',
    stale_reason: null,
    author: 'brain',
    confidence_baseline: 0.5,
    parse_failed: false,
    sections: {
      pattern_matches: null,
      framework_chain_predictions: null,
      cross_domain_analogies: null,
      wicked_indicators: null,
      unfilled_opportunity_matches: null,
      assessment_thinking_chain_position: null,
      problemtype_classification: null,
      flagged_contradictions_xroom: null,
      hsi_signals: null,
    },
    flagged_weaknesses: [],
  };
}

function makeQuadruple() {
  return {
    room: { exists: true, identity_text: 'market analysis section', references: [] },
    state: { exists: true, artifact_count: 3, completeness_score: 0.6 },
    reasoning: {
      exists: true,
      governing_thought: 'Customers will pay a premium for X',
      reasoning_health_score: 0.7,
      is_stale: false,
      arguments: [],
    },
    brain: makeBrain(),
  };
}

function makeTurn() {
  return {
    userText: null,
    sectionPath: '/tmp/phase-135-noleak/market-analysis',
    sessionId: 'sess-135-noleak',
  };
}

function makeContext() {
  return {
    quadruple: makeQuadruple(), // pre-read so decide() does not readQuadruple
    brainAvailable: true,
    userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
    intentSignal: null,
    operator: 'DECISION_GATE',
    sectionPath: 'market-analysis',
    problemType: 'IDP',
    jtbd: 'size the addressable market',
    roomState: { db: null, roomDir: '/tmp/phase-135-noleak' },
  };
}

function prewarm() {
  // Throwaway invocation so every lazy-require chain inside decide() is cached
  // before the proxy is installed (Phase 130 idiom). Result discarded.
  try { navEngine.decide(makeTurn(), makeContext()); } catch (_e) { /* ignore */ }
}

// ---------- Test ----------

let failed = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

check('SC2/SC9: decide() resolver path performs zero non-SQLite reads (USER.md allow-listed)', () => {
  prewarm();
  fsInstrument.install({ throwOnViolation: false });
  try {
    navEngine.decide(makeTurn(), makeContext());
  } finally {
    fsInstrument.uninstall();
  }
  // Filter out the single allow-listed USER.md intent-leg read.
  const leaks = fsInstrument.calls().filter((c) => !isExtraAllowed(c.target));
  ok(
    leaks.length === 0,
    'LOAD-BEARING: zero non-SQLite filesystem reads on the resolver decide() path; leaked: '
      + JSON.stringify(leaks.map((c) => ({ method: c.method, target: c.target })))
  );
});

// Final summary
process.stdout.write('\ntest-135-resolver-no-leak: ' + (failed === 0 ? 'PASS' : 'FAIL') + '\n');
process.exit(failed === 0 ? 0 : 1);
