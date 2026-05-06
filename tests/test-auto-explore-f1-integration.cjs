'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-06 (F.1 dispatch contract + verbs).
// Production assertions in Wave 2 (117-03) when F.1 surface lands:
//   - F.1 dispatch happy path (drain -> selector-dispatcher.pickShape -> F.1)
//   - tier 0 suppress (no LOCAL graph; no fire)
//   - JUST_TALK suppress (operator state forbids surfacing)
//   - dispatcher error suppress (graceful degradation)
//   - verb labels: ["Explore","Skip","Later"] + Free-text fallback
//   - recommendedVerb null in Mode B (no RECOMMENDED marker)
//   - emitTelemetry on every render
//   - contract shape (header + options + reason)
//   - three-surface render parity (CLI + Desktop + Cowork same JSON)
//   - persona suffix absent at Wave-0 (Phase 115 wires persona blend later)
//   - parent_decision_id format (sha256 of finding.id)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: auto_explore_finding_surfaced registered for F.1 render', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_finding_surfaced'), true);
});

test('117-00 substrate: auto_explore_user_response registered for F.1 selection', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_user_response'), true);
});

test('117-00 substrate: auto_explore_skipped registered for F.1 suppression paths', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_skipped'), true);
});
