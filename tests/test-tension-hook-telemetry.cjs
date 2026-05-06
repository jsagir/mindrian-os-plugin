'use strict';

/*
 * Phase 116-04 Wave 4 -- Task 1 GREEN.
 *
 * Dual-surface telemetry tests for lib/agents/tension-hook-agent.cjs.
 * Mirrors tests/test-reverse-salient-telemetry.cjs (89-07 Wave 2) with field
 * substitutions per RESEARCH Section 4.5. Verifies:
 *
 *   - 5 emit helpers (emitDetected / emitSurfaced / emitResolved /
 *     emitDecayed / emitSkipped) each delegate exactly once to
 *     telemetry.recordSelectorMirror with the correct event_type.
 *   - Payload key sets exact:
 *       tension_detected -> 9 keys
 *       tension_surfaced -> 5 keys
 *       tension_resolved -> 4 keys
 *       tension_decayed  -> 3 keys
 *       tension_skipped  -> 3 keys
 *   - Canon Part 8 substring audit: zero user-content strings (body_text,
 *     source_title, target_title) in any payload, even when the source
 *     finding object is poisoned with test marker strings.
 *   - Scalar-only field types: string / number / boolean / null only.
 *   - Suppression paths (tier_0, just_talk) STILL emit tension_detected
 *     with surfaced=false + suppress_reason set (Pitfall 5).
 *   - emit helpers NEVER throw (graceful degradation contract).
 *   - EVENT_TYPES registration verified for all 5 strings.
 *   - Wiring verification: handleUserResponse RESOLVE / SKIP emit; LATER
 *     does not emit (per RESEARCH Section 11.2 row 4).
 *
 * The substring-audit pattern at Tests 6 + 7 is the LOAD-BEARING gate; if
 * it fails, the Phase 116 ship breaks Canon Part 8.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'tension-hook-agent.cjs');
const TELEMETRY_PATH = require.resolve('../lib/hmi/selector-telemetry.cjs');
const PENDING_STORE_PATH = require.resolve('../lib/memory/pending-tension-store.cjs');
const NAVIGATION_PATH = require.resolve('../lib/core/navigation.cjs');

function freshAgent(stubs) {
  if (stubs && stubs.telemetry) require.cache[TELEMETRY_PATH] = { exports: stubs.telemetry };
  if (stubs && stubs.pendingStore) require.cache[PENDING_STORE_PATH] = { exports: stubs.pendingStore };
  if (stubs && stubs.navigation) require.cache[NAVIGATION_PATH] = { exports: stubs.navigation };
  delete require.cache[AGENT_PATH];
  return require(AGENT_PATH);
}

function clearCache() {
  [TELEMETRY_PATH, PENDING_STORE_PATH, NAVIGATION_PATH, AGENT_PATH]
    .forEach((p) => delete require.cache[p]);
}

function makeFinding() {
  return {
    id: 'a'.repeat(32),
    tension_type: 'contradiction',
    source_node_id: 'node-source-x',
    target_node_id: 'node-target-y',
    source_section: 'problem-definition',
    target_section: 'business-model',
  };
}

// Poisoned finding: contains forbidden user-content fields. Defense-in-depth
// fence to prove the helpers never accidentally include them in the payload.
function makePoisonedFinding() {
  return {
    id: 'b'.repeat(32),
    tension_type: 'contradiction',
    source_node_id: 'node-source-poisoned',
    target_node_id: 'node-target-poisoned',
    source_section: 'SECRET BODY TEXT in section name',
    target_section: 'SECRET TARGET TITLE in section name',
    body_text: 'SECRET BODY TEXT that must never appear in telemetry',
    source_title: 'SECRET SOURCE TITLE forbidden user content',
    target_title: 'SECRET TARGET TITLE forbidden user content',
    quoted_text: 'SECRET BODY TEXT verbatim quote',
  };
}

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

// =====================================================================
// Test 1-5: helper invocation + event_type + key set
// =====================================================================

test('116-04 Test 1: emitDetected calls recordSelectorMirror once with eventType=tension_detected and 9 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const r = agent.emitDetected('/tmp/t', makeFinding(), {
    tier: 1,
    surfaced: true,
    suppress_reason: null,
    surfacing_count: 0,
    source_edge_count: 1,
    brain_offline_flag: true,
    selection_priority: 1,
  });
  assert.equal(cap.events.length, 1, 'recordSelectorMirror must fire exactly once');
  assert.equal(cap.events[0].et, 'tension_detected');
  const expectedKeys = ['tension_id', 'tension_type', 'source_edge_count', 'tier',
    'surfacing_count', 'surfaced', 'suppress_reason', 'brain_offline_flag', 'selection_priority'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(r.ok, true);
  clearCache();
});

test('116-04 Test 2: emitSurfaced calls recordSelectorMirror once with eventType=tension_surfaced and 5 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitSurfaced('/tmp/t', makeFinding(), {
    tier: 1,
    surfacing_count: 1,
    f1_verb_count: 4,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'tension_surfaced');
  const expectedKeys = ['tension_id', 'tension_type', 'tier', 'surfacing_count', 'f1_verb_count'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  clearCache();
});

test('116-04 Test 3: emitResolved calls recordSelectorMirror once with eventType=tension_resolved and 4 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitResolved('/tmp/t', makeFinding(), {
    latency_ms: 1500,
    resolved_via_edge_emitted: true,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'tension_resolved');
  const expectedKeys = ['tension_id', 'response', 'latency_ms', 'resolved_via_edge_emitted'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.response, 'RESOLVE');
  clearCache();
});

test('116-04 Test 4: emitDecayed calls recordSelectorMirror once with eventType=tension_decayed and 3 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitDecayed('/tmp/t', 'c'.repeat(32), {
    surfacing_count: 3,
    evaluation_pass_id: 'd'.repeat(32),
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'tension_decayed');
  const expectedKeys = ['tension_id', 'surfacing_count', 'evaluation_pass_id'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  clearCache();
});

test('116-04 Test 5: emitSkipped calls recordSelectorMirror once with eventType=tension_skipped and 3 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitSkipped('/tmp/t', makeFinding(), {
    latency_ms: 800,
    surfacing_count: 2,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'tension_skipped');
  const expectedKeys = ['tension_id', 'latency_ms', 'surfacing_count'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  clearCache();
});

// =====================================================================
// Test 6: CANON PART 8 SUBSTRING AUDIT (the load-bearing gate)
// =====================================================================

test('116-04 Test 6: CANON PART 8 AUDIT -- 5 payload types substring-clean against 6 forbidden patterns', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const finding = makePoisonedFinding();

  agent.emitDetected('/tmp/t', finding, {
    tier: 1, surfaced: true, suppress_reason: null,
    surfacing_count: 0, source_edge_count: 1,
    brain_offline_flag: true, selection_priority: 1,
  });
  agent.emitSurfaced('/tmp/t', finding, { tier: 1, surfacing_count: 1, f1_verb_count: 4 });
  agent.emitResolved('/tmp/t', finding, { latency_ms: 1000, resolved_via_edge_emitted: true });
  agent.emitDecayed('/tmp/t', finding.id, { surfacing_count: 3, evaluation_pass_id: 'd'.repeat(32) });
  agent.emitSkipped('/tmp/t', finding, { latency_ms: 500, surfacing_count: 2 });

  assert.equal(cap.events.length, 5, 'all 5 emit helpers fire exactly once');

  for (const evt of cap.events) {
    const json = JSON.stringify(evt.p);
    // Forbidden test marker strings (would prove user content leaked):
    assert.equal(json.indexOf('SECRET BODY TEXT'), -1,
      'SECRET BODY TEXT MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET SOURCE TITLE'), -1,
      'SECRET SOURCE TITLE MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET TARGET TITLE'), -1,
      'SECRET TARGET TITLE MUST NOT appear in ' + evt.et + ' payload');
    // Forbidden field names (would prove the schema admitted user content keys):
    assert.equal(json.indexOf('body_text'), -1,
      'body_text key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('source_title'), -1,
      'source_title key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('target_title'), -1,
      'target_title key MUST NOT appear in ' + evt.et + ' payload');
  }
  clearCache();
});

// =====================================================================
// Test 7: scalar-only field types (defense against nested object leaks)
// =====================================================================

test('116-04 Test 7: payload values are scalar-only (string / number / boolean / null)', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const finding = makeFinding();

  agent.emitDetected('/tmp/t', finding, {
    tier: 1, surfaced: true, suppress_reason: null,
    surfacing_count: 0, source_edge_count: 1,
    brain_offline_flag: true, selection_priority: 1,
  });
  agent.emitSurfaced('/tmp/t', finding, { tier: 1, surfacing_count: 1, f1_verb_count: 4 });
  agent.emitResolved('/tmp/t', finding, { latency_ms: 100, resolved_via_edge_emitted: true });
  agent.emitDecayed('/tmp/t', finding.id, { surfacing_count: 3, evaluation_pass_id: 'd'.repeat(32) });
  agent.emitSkipped('/tmp/t', finding, { latency_ms: 200, surfacing_count: 1 });

  for (const evt of cap.events) {
    for (const k of Object.keys(evt.p)) {
      const v = evt.p[k];
      const t = (v === null) ? 'null' : typeof v;
      assert.ok(
        t === 'string' || t === 'number' || t === 'boolean' || t === 'null',
        evt.et + '.' + k + ' must be scalar; got ' + t + ' (value: ' + JSON.stringify(v) + ')'
      );
      // Nested objects would serialize as {...} and leak nested keys.
      assert.notEqual(t, 'object', evt.et + '.' + k + ' must not be a nested object');
    }
  }
  clearCache();
});

// =====================================================================
// Test 8: tension_id and evaluation_pass_id are sha256-hex shape
// =====================================================================

test('116-04 Test 8: tension_id + evaluation_pass_id match sha256-hex32 shape', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const finding = makeFinding();

  agent.emitDetected('/tmp/t', finding, {
    tier: 1, surfaced: true, suppress_reason: null,
    surfacing_count: 0, source_edge_count: 1,
    brain_offline_flag: true, selection_priority: 1,
  });
  agent.emitDecayed('/tmp/t', 'c'.repeat(32), {
    surfacing_count: 3,
    evaluation_pass_id: 'd'.repeat(32),
  });

  const detected = cap.events.find((e) => e.et === 'tension_detected');
  const decayed = cap.events.find((e) => e.et === 'tension_decayed');
  assert.match(detected.p.tension_id, /^[0-9a-f]{32}$/, 'detected tension_id must be sha256-hex32');
  assert.match(decayed.p.tension_id, /^[0-9a-f]{32}$/, 'decayed tension_id must be sha256-hex32');
  assert.match(decayed.p.evaluation_pass_id, /^[0-9a-f]{32}$/, 'evaluation_pass_id must be sha256-hex32');
  clearCache();
});

// =====================================================================
// Test 9-11: suppression paths (Pitfall 5; D-04c)
// =====================================================================

test('116-04 Test 9: tier_0 suppression -- emitDetected records surfaced=false + suppress_reason=tier_0', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitDetected('/tmp/t', { id: '', tension_type: '' }, {
    tier: 0,
    surfaced: false,
    suppress_reason: 'tier_0',
    surfacing_count: 0,
    source_edge_count: 0,
    brain_offline_flag: true,
    selection_priority: 0,
  });
  const evt = cap.events.find((e) => e.et === 'tension_detected');
  assert.ok(evt, 'tier_0 suppression MUST still emit tension_detected (Pitfall 5)');
  assert.equal(evt.p.surfaced, false);
  assert.equal(evt.p.suppress_reason, 'tier_0');
  clearCache();
});

test('116-04 Test 10: just_talk suppression -- emitDetected records suppress_reason=just_talk', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitDetected('/tmp/t', makeFinding(), {
    tier: 1,
    surfaced: false,
    suppress_reason: 'just_talk',
    surfacing_count: 0,
    source_edge_count: 1,
    brain_offline_flag: true,
    selection_priority: 0,
  });
  const evt = cap.events.find((e) => e.et === 'tension_detected');
  assert.ok(evt);
  assert.equal(evt.p.surfaced, false);
  assert.equal(evt.p.suppress_reason, 'just_talk');
  clearCache();
});

test('116-04 Test 11: success path -- suppress_reason=null when surfaced=true', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitDetected('/tmp/t', makeFinding(), {
    tier: 1,
    surfaced: true,
    suppress_reason: null,
    surfacing_count: 0,
    source_edge_count: 1,
    brain_offline_flag: true,
    selection_priority: 1,
  });
  const evt = cap.events.find((e) => e.et === 'tension_detected');
  assert.ok(evt);
  assert.equal(evt.p.surfaced, true);
  assert.equal(evt.p.suppress_reason, null);
  clearCache();
});

// =====================================================================
// Test 12: graceful degradation -- emit helpers never throw
// =====================================================================

test('116-04 Test 12: emit helpers never throw when telemetry module is missing', () => {
  // Substitute a telemetry module without recordSelectorMirror to simulate
  // a missing / broken Phase 88.2-03 substrate.
  const broken = { recordPresentation: () => {}, recordResponse: () => {} };
  const agent = freshAgent({ telemetry: broken });
  const finding = makeFinding();

  // None of these should throw; all should return {ok:false, reason}.
  const r1 = agent.emitDetected('/tmp/t', finding, { tier: 1, surfaced: true, surfacing_count: 0 });
  const r2 = agent.emitSurfaced('/tmp/t', finding, { tier: 1, surfacing_count: 1, f1_verb_count: 4 });
  const r3 = agent.emitResolved('/tmp/t', finding, { latency_ms: 100 });
  const r4 = agent.emitDecayed('/tmp/t', finding.id, { surfacing_count: 3 });
  const r5 = agent.emitSkipped('/tmp/t', finding, { latency_ms: 200, surfacing_count: 1 });

  for (const r of [r1, r2, r3, r4, r5]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'telemetry_module_unavailable');
  }
  clearCache();
});

// =====================================================================
// Test 13: EVENT_TYPES registration (Wave 0 substrate non-regression)
// =====================================================================

test('116-04 Test 13: all 5 tension event strings are registered in EVENT_TYPES', () => {
  // Real EVENT_TYPES module (no stub) -- proves Wave-0 extension shipped.
  delete require.cache[require.resolve('../lib/core/navigation/memory-events.cjs')];
  const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');
  const expected = ['tension_detected', 'tension_surfaced', 'tension_resolved',
                    'tension_decayed', 'tension_skipped'];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'EVENT_TYPES must include ' + e);
  }
  // 89-07 telemetry pattern still registered (no regression).
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
  assert.equal(EVENT_TYPES.has('reverse_salient_acted_on'), true);
});

// =====================================================================
// Test 14-17: scripts/preflight-tension-surface.cjs wiring verification
// (Source-text grep so the test does not require sqlite + room.db fixtures;
// matches the 89-07 wiring-test pattern at tests/test-89-07-pattern-doc.sh.)
// =====================================================================

test('116-04 Test 14: preflight-tension-surface.cjs wires emitDetected on Tier 0 path with suppress_reason=tier_0', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'preflight-tension-surface.cjs'), 'utf8');
  // Tier 0 emit site exists with suppress_reason='tier_0'
  assert.match(src, /emitDetected[\s\S]*?suppress_reason: ['"]tier_0['"]/,
    'Tier 0 path must call agent.emitDetected with suppress_reason=tier_0');
});

test('116-04 Test 15: preflight wires emitDetected on no-candidates path with suppress_reason=no_candidates', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'preflight-tension-surface.cjs'), 'utf8');
  assert.match(src, /emitDetected[\s\S]*?suppress_reason: ['"]no_candidates['"]/,
    'no-candidates path must call agent.emitDetected with suppress_reason=no_candidates');
});

test('116-04 Test 16: preflight wires emitDecayed per dropped tension_id', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'preflight-tension-surface.cjs'), 'utf8');
  assert.match(src, /droppedTensionIds[\s\S]*?emitDecayed/,
    'decay path must iterate decayResult.droppedTensionIds and call emitDecayed');
});

test('116-04 Test 17: preflight wires emitDetected (surfaced:true) AND emitSurfaced on success path', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'preflight-tension-surface.cjs'), 'utf8');
  assert.match(src, /emitDetected[\s\S]*?surfaced: true/,
    'success path must call agent.emitDetected with surfaced:true');
  assert.match(src, /emitSurfaced/,
    'success path must call agent.emitSurfaced after appendTension lands');
});

// =====================================================================
// Test 18-20: handleUserResponse wiring (RESOLVE + SKIP emit; LATER does not)
// =====================================================================

test('116-04 Test 18: handleUserResponse RESOLVE emits tension_resolved exactly once', () => {
  const cap = captureTelemetry();
  const stubPendingStore = {
    computeTensionId: () => 'a'.repeat(32),
    jsonlPath: () => '/tmp/noop.jsonl',
    appendTension: () => ({ ok: true }),
    readTensions: () => [],
    markSurfaced: () => ({ ok: true }),
    markResolved: () => ({ ok: true }),
    markDropped: () => ({ ok: true }),
    requeue: () => ({ ok: true }),
    PENDING_TENSIONS_DIR: '/tmp/.mindrian/pending-tensions',
    VALID_STATES: new Set(['queued', 'surfaced', 'resolved', 'dropped']),
    VALID_TYPES: new Set(['contradiction', 'convergence', 'stale_decision', 'open_question']),
    VALID_RESPONSES: new Set(['RESOLVE', 'LATER', 'SKIP', 'DROPPED']),
  };
  const agent = freshAgent({ telemetry: cap.telemetry, pendingStore: stubPendingStore });

  agent.handleUserResponse({
    finding: makeFinding(),
    roomDir: '/tmp/t',
    userResponse: 'RESOLVE',
    surfaceStartedAtMs: Date.now() - 1500,
    db: null,
  });

  const resolved = cap.events.filter((e) => e.et === 'tension_resolved');
  const skipped = cap.events.filter((e) => e.et === 'tension_skipped');
  const decayed = cap.events.filter((e) => e.et === 'tension_decayed');
  assert.equal(resolved.length, 1, 'RESOLVE must emit exactly one tension_resolved');
  assert.equal(skipped.length, 0, 'RESOLVE must NOT emit tension_skipped');
  assert.equal(decayed.length, 0, 'RESOLVE must NOT emit tension_decayed');
  assert.equal(resolved[0].p.response, 'RESOLVE');
  assert.ok(Number.isInteger(resolved[0].p.latency_ms));
  assert.ok(resolved[0].p.latency_ms >= 0);
  clearCache();
});

test('116-04 Test 19: handleUserResponse LATER emits NO event (per RESEARCH 11.2 row 4)', () => {
  const cap = captureTelemetry();
  const stubPendingStore = {
    computeTensionId: () => 'a'.repeat(32),
    jsonlPath: () => '/tmp/noop.jsonl',
    appendTension: () => ({ ok: true }),
    readTensions: () => [],
    markSurfaced: () => ({ ok: true }),
    markResolved: () => ({ ok: true }),
    markDropped: () => ({ ok: true }),
    requeue: () => ({ ok: true, surfacing_count: 1 }),
    PENDING_TENSIONS_DIR: '/tmp/.mindrian/pending-tensions',
    VALID_STATES: new Set(['queued', 'surfaced', 'resolved', 'dropped']),
    VALID_TYPES: new Set(['contradiction', 'convergence', 'stale_decision', 'open_question']),
    VALID_RESPONSES: new Set(['RESOLVE', 'LATER', 'SKIP', 'DROPPED']),
  };
  const agent = freshAgent({ telemetry: cap.telemetry, pendingStore: stubPendingStore });

  agent.handleUserResponse({
    finding: makeFinding(),
    roomDir: '/tmp/t',
    userResponse: 'LATER',
    surfaceStartedAtMs: Date.now() - 500,
  });

  // No event of any kind should fire for LATER; the next session start's
  // tension_detected captures the re-enter signal instead.
  assert.equal(cap.events.length, 0,
    'LATER must emit zero memory_events; got ' + cap.events.length);
  clearCache();
});

test('116-04 Test 20: handleUserResponse SKIP emits tension_skipped exactly once', () => {
  const cap = captureTelemetry();
  const stubPendingStore = {
    computeTensionId: () => 'a'.repeat(32),
    jsonlPath: () => '/tmp/noop.jsonl',
    appendTension: () => ({ ok: true }),
    readTensions: () => [{
      tension_id: 'a'.repeat(32),
      type: 'contradiction',
      state: 'surfaced',
      surfacing_count: 2,
    }],
    markSurfaced: () => ({ ok: true }),
    markResolved: () => ({ ok: true }),
    markDropped: () => ({ ok: true }),
    requeue: () => ({ ok: true }),
    PENDING_TENSIONS_DIR: '/tmp/.mindrian/pending-tensions',
    VALID_STATES: new Set(['queued', 'surfaced', 'resolved', 'dropped']),
    VALID_TYPES: new Set(['contradiction', 'convergence', 'stale_decision', 'open_question']),
    VALID_RESPONSES: new Set(['RESOLVE', 'LATER', 'SKIP', 'DROPPED']),
  };
  const agent = freshAgent({ telemetry: cap.telemetry, pendingStore: stubPendingStore });

  agent.handleUserResponse({
    finding: makeFinding(),
    roomDir: '/tmp/t',
    userResponse: 'SKIP',
    surfaceStartedAtMs: Date.now() - 700,
  });

  const skipped = cap.events.filter((e) => e.et === 'tension_skipped');
  const resolved = cap.events.filter((e) => e.et === 'tension_resolved');
  const decayed = cap.events.filter((e) => e.et === 'tension_decayed');
  assert.equal(skipped.length, 1, 'SKIP must emit exactly one tension_skipped');
  assert.equal(resolved.length, 0, 'SKIP must NOT emit tension_resolved');
  assert.equal(decayed.length, 0, 'SKIP must NOT emit tension_decayed');
  assert.equal(skipped[0].p.surfacing_count, 2,
    'SKIP must record current surfacing_count from JSONL state');
  clearCache();
});
