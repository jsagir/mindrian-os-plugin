'use strict';

/*
 * Phase 117-05 Wave 3 -- Task 1 GREEN.
 *
 * Real assertions for AUTOEXPLORE-117-18 (Brain Section 8.6 brain_canon_drift_observed event).
 * Replaces the Wave-0 stub from Phase 117-00.
 *
 * Per RESEARCH Section 8.6: emit brain_canon_drift_observed once per session
 * when Brain returns FourLenses but Canon expects FiveLenses. Axis = lens_count;
 * brain_count=4 vs canon_count=5. Use Canon FiveLenses; do NOT write back to
 * Brain (Canon Part 8 LOCAL-only edge).
 *
 * Tests verify:
 *   1. emitBrainCanonDrift writes JSONL with event_type=brain_canon_drift_observed
 *   2. Payload includes axis=lens_count, brain_count=4, canon_count=5
 *   3. NO Brain write-back attempted (Canon Part 8 LOCAL-only invariant)
 *   4. Helper is idempotent within a session (in-memory cache)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs');
const TELEMETRY_PATH = require.resolve('../lib/hmi/selector-telemetry.cjs');

function captureTelemetry() {
  const events = [];
  return {
    events: events,
    telemetry: {
      recordSelectorMirror: (rd, et, p) => {
        events.push({ rd, et, p });
        return { ok: true, eventId: 'evt-' + events.length };
      },
      recordPresentation: () => {},
      recordResponse: () => {},
    },
  };
}

function freshAgent(stubs) {
  if (stubs && stubs.telemetry) require.cache[TELEMETRY_PATH] = { exports: stubs.telemetry };
  delete require.cache[AGENT_PATH];
  const agent = require(AGENT_PATH);
  agent._resetDriftCacheForTests();
  return agent;
}

function clearCache() {
  [TELEMETRY_PATH, AGENT_PATH].forEach((p) => delete require.cache[p]);
}

// =====================================================================
// Test 1: event_type registered
// =====================================================================

test('117-05 brain-canon-drift Test 1: brain_canon_drift_observed event registered in EVENT_TYPES', () => {
  assert.equal(EVENT_TYPES.has('brain_canon_drift_observed'), true);
  // Sibling auto_explore events also registered (Wave 0 substrate non-regression).
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
  assert.equal(EVENT_TYPES.has('auto_explore_finding_surfaced'), true);
  assert.equal(EVENT_TYPES.has('auto_explore_user_response'), true);
  assert.equal(EVENT_TYPES.has('auto_explore_skipped'), true);
});

// =====================================================================
// Test 2: emitBrainCanonDrift payload semantics (axis + brain_count + canon_count)
// =====================================================================

test('117-05 brain-canon-drift Test 2: emitBrainCanonDrift writes axis=lens_count + brain_count=4 + canon_count=5', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitBrainCanonDrift('/tmp/r');
  assert.equal(cap.events.length, 1, 'first call must emit exactly one event');
  assert.equal(cap.events[0].et, 'brain_canon_drift_observed');
  assert.equal(cap.events[0].p.axis, 'lens_count');
  assert.equal(cap.events[0].p.brain_count, 4);
  assert.equal(cap.events[0].p.canon_count, 5);
  assert.equal(cap.events[0].p.phase, '117');
  assert.ok(Number.isInteger(cap.events[0].p.detected_at), 'detected_at must be epoch-ms integer');
  assert.ok(Number.isInteger(cap.events[0].p.created_at), 'created_at must be epoch-ms integer');
  clearCache();
});

// =====================================================================
// Test 3: NO Brain write-back attempted (Canon Part 8 LOCAL-only invariant)
// =====================================================================

test('117-05 brain-canon-drift Test 3: NO Brain write-back attempted (helper does not call any brain-client)', () => {
  // Source-text grep on agent.cjs confirms zero brain-client require lines.
  const fs = require('node:fs');
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  // Brain-client substring must not appear (Canon Part 8 boundary).
  // Note: the file contains Brain comment text + Brain literal in regression
  // markers; the test asserts on the require() pattern only.
  const brainClientRequires = src.match(/require\(['"][^'"]*brain[-_]client[^'"]*['"]\)/g) || [];
  assert.equal(brainClientRequires.length, 0, 'agent must not require any brain-client module');
  // The drift helper writes ONLY to recordSelectorMirror (LOCAL JSONL + room.db).
  // No fetch, no http, no Brain MCP call.
  const fetchCalls = src.match(/fetch\s*\(/g) || [];
  assert.equal(fetchCalls.length, 0, 'agent must not call fetch (LOCAL-only invariant)');
});

// =====================================================================
// Test 4: idempotent within session (in-memory cache)
// =====================================================================

test('117-05 brain-canon-drift Test 4: emitBrainCanonDrift idempotent (100 calls -> 1 emit)', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  for (let i = 0; i < 100; i++) {
    const r = agent.emitBrainCanonDrift('/tmp/r');
    if (i === 0) {
      assert.equal(r.ok, true, 'first call must succeed');
    } else {
      assert.equal(r.skipped, 'already_emitted_this_session',
        'subsequent calls must report skipped reason');
    }
  }
  assert.equal(cap.events.length, 1, '100 calls in same session must produce exactly 1 JSONL emit');
  clearCache();
});
