'use strict';

/*
 * Phase 117-05 Wave 3 -- Task 1 GREEN.
 *
 * Dual-surface telemetry tests for lib/agents/auto-explore-agent.cjs.
 * Mirrors tests/test-tension-hook-telemetry.cjs (Phase 116-04 Wave 4) with
 * field substitutions per RESEARCH Section 3 sibling code-clone. Verifies:
 *
 *   - 6 emit helpers (emitFired / emitFindingSurfaced / emitUserResponse /
 *     emitSkipped / emitSanitizerHit / emitBrainCanonDrift) each delegate
 *     exactly once to telemetry.recordSelectorMirror with the correct
 *     event_type.
 *   - Payload key sets exact per RESEARCH Section 11 schemas.
 *   - Canon Part 8 substring audit: zero user-content strings (body_text,
 *     source_title, target_title, file_content, cv_content) in any payload,
 *     even when the source finding object is poisoned with marker strings.
 *   - Scalar-only field types: string / number / boolean / null only.
 *   - Suppression paths still emit auto_explore_skipped with suppress_reason
 *     set per the closed enum (Pitfall 5 mirror from 116-04).
 *   - file_path is ALWAYS hashed: emitFired's payload contains
 *     file_path_sha256 (16-hex regex match) but never the raw file_path.
 *   - emitBrainCanonDrift idempotent within session (in-memory cache).
 *   - emit helpers NEVER throw (graceful degradation contract).
 *
 * The substring-audit pattern is the LOAD-BEARING gate; if it fails, the
 * Phase 117 ship breaks Canon Part 8.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs');
const TELEMETRY_PATH = require.resolve('../lib/hmi/selector-telemetry.cjs');

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

function makeFinding() {
  return {
    id: 'a'.repeat(32),
    material_id: 'b'.repeat(32),
    source_pipeline: 'cross-domain',
    candidate_count: 5,
    score: 0.85,
    top_differential_score: 0.85,
    source_section: 'problem-definition',
    target_section: 'business-model',
    framework_chain: ['JTBD'],
  };
}

// Poisoned finding: contains forbidden user-content fields. Defense-in-depth
// fence to prove the helpers never accidentally include them in the payload.
function makePoisonedFinding() {
  return {
    id: 'c'.repeat(32),
    material_id: 'd'.repeat(32),
    source_pipeline: 'reverse-salients',
    candidate_count: 3,
    score: 0.9,
    top_differential_score: 0.9,
    source_section: 'SECRET BODY TEXT in section name',
    target_section: 'SECRET TARGET TITLE in section name',
    body_text: 'SECRET BODY TEXT that must never appear in telemetry',
    source_title: 'SECRET SOURCE TITLE forbidden user content',
    target_title: 'SECRET TARGET TITLE forbidden user content',
    file_content: 'SECRET FILE CONTENT must not leak',
    cv_content: 'SECRET CV CONTENT verbatim',
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
// Tests 1-6: helper invocation + event_type + key set
// =====================================================================

test('117-05 Test 1: emitFired calls recordSelectorMirror once with eventType=auto_explore_fired and 9 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const r = agent.emitFired('/tmp/t', {
    material_id: 'm'.repeat(32),
    relative_file_path: 'cv.md',
    room_slug: 'my-room',
    tier: 1,
    surfacing_count: 0,
    brain_baseline_present: true,
  });
  assert.equal(cap.events.length, 1, 'recordSelectorMirror must fire exactly once');
  assert.equal(cap.events[0].et, 'auto_explore_fired');
  const expectedKeys = ['material_id', 'file_path_sha256', 'fired_at', 'room_slug_sha256',
    'surfacing_count', 'tier', 'suppress_reason', 'brain_baseline_present', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(r.ok, true);
  clearCache();
});

test('117-05 Test 2: emitFindingSurfaced calls recordSelectorMirror once with eventType=auto_explore_finding_surfaced and 9 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitFindingSurfaced('/tmp/t', {
    finding: makeFinding(),
    surfacing_count: 1,
    tier: 1,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'auto_explore_finding_surfaced');
  const expectedKeys = ['material_id', 'finding_id', 'source_pipeline', 'candidate_count',
    'score', 'surfacing_count', 'tier', 'top_differential_score', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.source_pipeline, 'cross-domain');
  clearCache();
});

test('117-05 Test 3: emitUserResponse calls recordSelectorMirror once with eventType=auto_explore_user_response and 6 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitUserResponse('/tmp/t', {
    finding: makeFinding(),
    response: 'EXPLORE',
    latency_ms: 15234,
    reason_present: false,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'auto_explore_user_response');
  const expectedKeys = ['material_id', 'finding_id', 'response', 'latency_ms', 'reason_present', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.response, 'EXPLORE');
  clearCache();
});

test('117-05 Test 4: emitSkipped calls recordSelectorMirror once with eventType=auto_explore_skipped and 5 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitSkipped('/tmp/t', {
    material_id: 'm'.repeat(32),
    suppress_reason: 'tier_0',
    tier: 0,
    surfacing_count: 0,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'auto_explore_skipped');
  const expectedKeys = ['material_id', 'suppress_reason', 'tier', 'surfacing_count', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.suppress_reason, 'tier_0');
  clearCache();
});

test('117-05 Test 5: emitSanitizerHit calls recordSelectorMirror once with eventType=auto_explore_sanitizer_hit and 4 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitSanitizerHit('/tmp/t', {
    tool_name: 'mcp__brain_query',
    pattern_name: 'email',
    redaction_count: 2,
  });
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'auto_explore_sanitizer_hit');
  const expectedKeys = ['tool_name_hash', 'pattern_name', 'redaction_count', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.pattern_name, 'email');
  assert.equal(cap.events[0].p.redaction_count, 2);
  // tool_name_hash is 16-hex
  assert.match(cap.events[0].p.tool_name_hash, /^[0-9a-f]{16}$/);
  clearCache();
});

test('117-05 Test 6: emitBrainCanonDrift calls recordSelectorMirror once with eventType=brain_canon_drift_observed and 6 keys', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitBrainCanonDrift('/tmp/t');
  assert.equal(cap.events.length, 1);
  assert.equal(cap.events[0].et, 'brain_canon_drift_observed');
  const expectedKeys = ['axis', 'brain_count', 'canon_count', 'phase', 'detected_at', 'created_at'];
  assert.deepEqual(Object.keys(cap.events[0].p).sort(), expectedKeys.slice().sort());
  assert.equal(cap.events[0].p.axis, 'lens_count');
  assert.equal(cap.events[0].p.brain_count, 4);
  assert.equal(cap.events[0].p.canon_count, 5);
  clearCache();
});

// =====================================================================
// Test 7: CANON PART 8 SUBSTRING AUDIT (the load-bearing gate)
// =====================================================================

test('117-05 Test 7: CANON PART 8 AUDIT -- 6 payload types substring-clean against 5 forbidden keys + 5 markers', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const finding = makePoisonedFinding();

  agent.emitFired('/tmp/t', {
    material_id: finding.material_id,
    relative_file_path: 'SECRET FILE PATH /home/u/SECRET BODY TEXT.md',
    room_slug: 'SECRET SOURCE TITLE my-room',
    tier: 1,
  });
  agent.emitFindingSurfaced('/tmp/t', { finding: finding, surfacing_count: 1, tier: 1 });
  agent.emitUserResponse('/tmp/t', {
    finding: finding,
    response: 'EXPLORE',
    latency_ms: 1000,
  });
  agent.emitSkipped('/tmp/t', {
    material_id: finding.material_id,
    suppress_reason: 'tier_0',
  });
  agent.emitSanitizerHit('/tmp/t', {
    tool_name: 'mcp__brain_query SECRET TARGET TITLE',
    pattern_name: 'email',
    redaction_count: 1,
  });
  agent.emitBrainCanonDrift('/tmp/t');

  assert.equal(cap.events.length, 6, 'all 6 emit helpers fire exactly once');

  for (const evt of cap.events) {
    const json = JSON.stringify(evt.p);
    // Forbidden test marker strings (would prove user content leaked):
    assert.equal(json.indexOf('SECRET BODY TEXT'), -1,
      'SECRET BODY TEXT MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET SOURCE TITLE'), -1,
      'SECRET SOURCE TITLE MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET TARGET TITLE'), -1,
      'SECRET TARGET TITLE MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET FILE PATH'), -1,
      'SECRET FILE PATH MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET FILE CONTENT'), -1,
      'SECRET FILE CONTENT MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('SECRET CV CONTENT'), -1,
      'SECRET CV CONTENT MUST NOT appear in ' + evt.et + ' payload');
    // Forbidden field names (would prove the schema admitted user content keys):
    assert.equal(json.indexOf('body_text'), -1,
      'body_text key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('source_title'), -1,
      'source_title key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('target_title'), -1,
      'target_title key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('file_content'), -1,
      'file_content key MUST NOT appear in ' + evt.et + ' payload');
    assert.equal(json.indexOf('cv_content'), -1,
      'cv_content key MUST NOT appear in ' + evt.et + ' payload');
  }
  clearCache();
});

// =====================================================================
// Test 8: scalar-only field types (defense against nested object leaks)
// =====================================================================

test('117-05 Test 8: payload values are scalar-only (string / number / boolean / null)', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const finding = makeFinding();

  agent.emitFired('/tmp/t', {
    material_id: 'm', relative_file_path: 'cv.md', tier: 1,
  });
  agent.emitFindingSurfaced('/tmp/t', { finding: finding, surfacing_count: 1, tier: 1 });
  agent.emitUserResponse('/tmp/t', { finding: finding, response: 'EXPLORE', latency_ms: 100 });
  agent.emitSkipped('/tmp/t', { material_id: 'm', suppress_reason: 'tier_0' });
  agent.emitSanitizerHit('/tmp/t', { tool_name: 'mcp__brain_q', pattern_name: 'ssn', redaction_count: 1 });
  agent.emitBrainCanonDrift('/tmp/t');

  for (const evt of cap.events) {
    for (const k of Object.keys(evt.p)) {
      const v = evt.p[k];
      const t = (v === null) ? 'null' : typeof v;
      assert.ok(
        t === 'string' || t === 'number' || t === 'boolean' || t === 'null',
        evt.et + '.' + k + ' must be scalar; got ' + t + ' (value: ' + JSON.stringify(v) + ')'
      );
      assert.notEqual(t, 'object', evt.et + '.' + k + ' must not be a nested object');
    }
  }
  clearCache();
});

// =====================================================================
// Test 9: file_path always hashed (Canon Part 8 critical invariant)
// =====================================================================

test('117-05 Test 9: emitFired payload contains file_path_sha256 (16-hex) and NEVER raw file_path', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitFired('/tmp/t', {
    material_id: 'm'.repeat(32),
    relative_file_path: '/home/u/projects/cv.md',
    room_slug: 'my-room',
    tier: 1,
  });
  const evt = cap.events[0];
  assert.match(evt.p.file_path_sha256, /^[0-9a-f]{16}$/, 'file_path_sha256 must be 16-hex sha256 prefix');
  assert.equal(evt.p.file_path, undefined, 'raw file_path key must NOT exist in payload');
  // String form should not contain the raw path either
  const json = JSON.stringify(evt.p);
  assert.equal(json.indexOf('/home/u/projects/cv.md'), -1, 'raw file path must NOT appear in payload JSON');
  // room_slug_sha256 also 16-hex
  assert.match(evt.p.room_slug_sha256, /^[0-9a-f]{16}$/, 'room_slug_sha256 must be 16-hex');
  assert.equal(json.indexOf('my-room'), -1, 'raw room_slug must NOT appear in payload JSON');
  clearCache();
});

// =====================================================================
// Test 10: suppress_reason closed-enum vocabulary
// =====================================================================

test('117-05 Test 10: emitSkipped accepts all 11 suppress_reason values', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const reasons = [
    'tier_0', 'just_talk', 'dispatcher_load_failed', 'all_pipelines_empty',
    'brain_baseline_unavailable', 'rate_limited', 'daily_cap_exceeded',
    'room_dir_not_writable', 'ledger_replay_failed', 'hybrid_mode_insufficient_corpus',
    'sanitizer_blocked',
  ];
  for (const reason of reasons) {
    agent.emitSkipped('/tmp/t', { material_id: 'm', suppress_reason: reason });
  }
  assert.equal(cap.events.length, 11, 'all 11 suppress_reason variants must emit');
  for (let i = 0; i < reasons.length; i++) {
    assert.equal(cap.events[i].p.suppress_reason, reasons[i]);
  }
  clearCache();
});

// =====================================================================
// Test 11: brain_canon_drift_observed payload semantics
// =====================================================================

test('117-05 Test 11: emitBrainCanonDrift payload axis=lens_count + brain_count=4 + canon_count=5', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  agent.emitBrainCanonDrift('/tmp/t');
  const evt = cap.events[0];
  assert.equal(evt.p.axis, 'lens_count');
  assert.equal(evt.p.brain_count, 4);
  assert.equal(evt.p.canon_count, 5);
  assert.equal(evt.p.phase, '117');
  assert.ok(Number.isInteger(evt.p.detected_at));
  clearCache();
});

// =====================================================================
// Test 12: brain_canon_drift_observed idempotent within session
// =====================================================================

test('117-05 Test 12: emitBrainCanonDrift idempotent within session (in-memory cache)', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });
  const r1 = agent.emitBrainCanonDrift('/tmp/t');
  const r2 = agent.emitBrainCanonDrift('/tmp/t');
  const r3 = agent.emitBrainCanonDrift('/tmp/t');
  assert.equal(cap.events.length, 1, 'only the first call emits; subsequent calls skip');
  assert.ok(r1 && r1.ok === true);
  assert.equal(r2.skipped, 'already_emitted_this_session');
  assert.equal(r3.skipped, 'already_emitted_this_session');
  clearCache();
});

// =====================================================================
// Test 13: graceful degradation -- emit helpers never throw
// =====================================================================

test('117-05 Test 13: emit helpers never throw when telemetry module is missing', () => {
  const broken = { recordPresentation: () => {}, recordResponse: () => {} };
  const agent = freshAgent({ telemetry: broken });
  const finding = makeFinding();

  const r1 = agent.emitFired('/tmp/t', { material_id: 'm', relative_file_path: 'cv.md', tier: 1 });
  const r2 = agent.emitFindingSurfaced('/tmp/t', { finding: finding, surfacing_count: 1, tier: 1 });
  const r3 = agent.emitUserResponse('/tmp/t', { finding: finding, response: 'EXPLORE' });
  const r4 = agent.emitSkipped('/tmp/t', { material_id: 'm', suppress_reason: 'tier_0' });
  const r5 = agent.emitSanitizerHit('/tmp/t', { tool_name: 'x', pattern_name: 'ssn', redaction_count: 1 });
  const r6 = agent.emitBrainCanonDrift('/tmp/t');

  for (const r of [r1, r2, r3, r4, r5, r6]) {
    assert.equal(r.ok, false, 'broken telemetry must return ok:false');
    assert.equal(r.reason, 'telemetry_module_unavailable');
  }
  clearCache();
});

// =====================================================================
// Test 14: EVENT_TYPES registration (Wave 0 substrate non-regression)
// =====================================================================

test('117-05 Test 14: all 6 Phase 117 event strings registered in EVENT_TYPES (size >= 32)', () => {
  delete require.cache[require.resolve('../lib/core/navigation/memory-events.cjs')];
  const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');
  const expected = [
    'auto_explore_fired',
    'auto_explore_finding_surfaced',
    'auto_explore_user_response',
    'auto_explore_skipped',
    'auto_explore_sanitizer_hit',
    'brain_canon_drift_observed',
  ];
  for (const e of expected) {
    assert.equal(EVENT_TYPES.has(e), true, 'EVENT_TYPES must include ' + e);
  }
  // Phase 116 + 89-07 telemetry patterns still registered (no regression).
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
  assert.equal(EVENT_TYPES.has('reverse_salient_detected'), true);
  // EVENT_TYPES size after Phase 117-05 close: 32. Baseline 15 + 4 selector
  // + 2 reverse-salient + 5 tension + 5 auto-explore + 1 drift = 32. The
  // sanitizer_hit string was added by 117-05 (Wave 0 shipped 5 strings;
  // Wave 3 added the 6th to close the dual-surface mirror gap).
  assert.equal(EVENT_TYPES.size, 32, 'EVENT_TYPES size must be 32 after Phase 117 close; got ' + EVENT_TYPES.size);
});

// =====================================================================
// Test 15: handleUserResponse wiring -- emits exactly one event per response
// =====================================================================

test('117-05 Test 15: handleUserResponse EXPLORE emits auto_explore_user_response exactly once', () => {
  const cap = captureTelemetry();
  const agent = freshAgent({ telemetry: cap.telemetry });

  agent.handleUserResponse({
    finding: makeFinding(),
    roomDir: '/tmp/t',
    userResponse: 'EXPLORE',
  });

  const userResp = cap.events.filter((e) => e.et === 'auto_explore_user_response');
  assert.equal(userResp.length, 1, 'EXPLORE must emit exactly one auto_explore_user_response');
  assert.equal(userResp[0].p.response, 'EXPLORE');
  clearCache();
});
