'use strict';

/*
 * Phase 89-07 Wave 2 -- Task 2 RED then GREEN.
 *
 * F.0 dispatch tests for lib/agents/reverse-salient-agent.cjs surfaceFinding +
 * handleUserResponse. Verifies:
 *   - Tier 0 -> suppressed; telemetry surfaced=false suppress_reason='tier_0'
 *   - JUST_TALK operator -> suppressed; telemetry suppress_reason='just_talk'
 *   - Tier >= 1 + non-JUST_TALK -> dispatcher receives F.0 contract
 *   - Persona suffix in F.0 header per role_blend
 *   - parent_decision_id === 'rs-finding:' + finding.id
 *   - REJECT path invokes buildRejectedBecauseEdge
 *   - DEFER path emits reverse_salient_acted_on with response='DEFER'
 *   - Anti-pattern guards: no console.log / process.stdout.write in agent
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'reverse-salient-agent.cjs');
const DISPATCHER_PATH = require.resolve('../lib/hmi/selector-dispatcher.cjs');
const F0_RENDERER_PATH = require.resolve('../lib/hmi/shape-f0-renderer.cjs');
const TELEMETRY_PATH = require.resolve('../lib/hmi/selector-telemetry.cjs');
const USER_MD_PATH = require.resolve('../lib/core/user-md-ops.cjs');
const PERSONA_SUFFIX_PATH = require.resolve('../lib/core/reverse-salient-persona-suffix.cjs');
const MEMORY_EVENTS_PATH = require.resolve('../lib/core/navigation/memory-events.cjs');

function freshAgent(stubs) {
  if (stubs.dispatcher) require.cache[DISPATCHER_PATH] = { exports: stubs.dispatcher };
  if (stubs.f0Renderer) require.cache[F0_RENDERER_PATH] = { exports: stubs.f0Renderer };
  if (stubs.telemetry) require.cache[TELEMETRY_PATH] = { exports: stubs.telemetry };
  if (stubs.userMd) require.cache[USER_MD_PATH] = { exports: stubs.userMd };
  if (stubs.memoryEvents) require.cache[MEMORY_EVENTS_PATH] = { exports: stubs.memoryEvents };
  delete require.cache[AGENT_PATH];
  return require(AGENT_PATH);
}

function clearCache() {
  [DISPATCHER_PATH, F0_RENDERER_PATH, TELEMETRY_PATH, USER_MD_PATH,
    PERSONA_SUFFIX_PATH, MEMORY_EVENTS_PATH, AGENT_PATH].forEach((p) => delete require.cache[p]);
}

function makeFinding() {
  return {
    id: 'abc123def456abc123def456abc123de',
    source_artifact_id: 'a',
    target_artifact_id: 'b',
    direction: 'structural_transfer',
    signed_diff: 0.5,
    abs_diff: 0.5,
    body_text: 'mock body text describing the finding',
    brain_chain_text: 'Cynefin -> systems-thinking -> root-cause-analysis',
  };
}

function noopTelemetry() {
  return {
    recordSelectorMirror: () => ({ ok: true }),
    recordPresentation: () => {},
    recordResponse: () => {},
  };
}

test('F.0: surfaceFinding is exported as a function', () => {
  clearCache();
  const agent = require(AGENT_PATH);
  assert.equal(typeof agent.surfaceFinding, 'function');
  clearCache();
});

test('F.0: handleUserResponse is exported as a function', () => {
  clearCache();
  const agent = require(AGENT_PATH);
  assert.equal(typeof agent.handleUserResponse, 'function');
  clearCache();
});

test('F.0: tier=0 -> suppressed; telemetry records surfaced=false, suppress_reason=tier_0', () => {
  const dispatcherCalls = [];
  const telemetryEvents = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return { shape: 'error', rendered: { error: 'tier-0-refused' } };
    },
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ dispatcher, telemetry });
  const result = agent.surfaceFinding({
    roomDir: '/tmp/test',
    sessionId: 's1',
    finding: makeFinding(),
    tier: 0,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'tier_0');
  // Suppression MUST still emit detected event (Pitfall 5).
  const detected = telemetryEvents.find((e) => e.et === 'reverse_salient_detected');
  assert.ok(detected, 'reverse_salient_detected event must fire even on suppression');
  assert.equal(detected.p.surfaced, false);
  assert.equal(detected.p.suppress_reason, 'tier_0');
  // Dispatcher MUST NOT be called for tier-0 (agent suppresses pre-dispatch).
  assert.equal(dispatcherCalls.length, 0, 'tier=0 must short-circuit pre-dispatch');
  clearCache();
});

test('F.0: JUST_TALK operator -> suppressed; telemetry suppress_reason=just_talk', () => {
  const dispatcherCalls = [];
  const telemetryEvents = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return { shape: 'error', rendered: { error: 'render_v2_compaction_violation' } };
    },
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ dispatcher, telemetry });
  const result = agent.surfaceFinding({
    roomDir: '/tmp/test',
    sessionId: 's1',
    finding: makeFinding(),
    tier: 1,
    operator: 'JUST_TALK',
    roleBlend: { founder: 0.7 },
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'just_talk');
  const detected = telemetryEvents.find((e) => e.et === 'reverse_salient_detected');
  assert.ok(detected);
  assert.equal(detected.p.suppress_reason, 'just_talk');
  // Dispatcher MUST NOT be called for JUST_TALK (agent suppresses pre-dispatch).
  assert.equal(dispatcherCalls.length, 0, 'JUST_TALK must short-circuit pre-dispatch');
  clearCache();
});

test('F.0: tier>=1, non-JUST_TALK -> dispatcher receives F.0 contract with persona header + body + parent_decision_id', () => {
  const dispatcherCalls = [];
  const telemetryEvents = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return {
        shape: 'F.0',
        rendered: {
          zones: { header: a.payload.header, body: a.payload.body, signals: '', footer: null },
          contract: {
            shape: 'F.0',
            verbs: ['Approve', 'Reject', 'Defer'],
            freeTextOffered: false,
            recommended: null,
            parent_decision_id: a.payload.parent_decision_id,
            mode: 'A',
          },
        },
      };
    },
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ dispatcher, telemetry });
  const finding = makeFinding();
  const result = agent.surfaceFinding({
    roomDir: '/tmp/test',
    sessionId: 's1',
    finding,
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  assert.equal(result.surfaced, true);
  assert.equal(dispatcherCalls.length, 1);
  assert.equal(dispatcherCalls[0].requestedShape, 'F.0');
  assert.equal(dispatcherCalls[0].payload.parent_decision_id, 'rs-finding:' + finding.id);
  // Phase 121.5-10 Sub-plan K (audit Section 5.3): header is the locked
  // [BRAIN] chip; persona suffix moves into the body slot beneath the chip.
  assert.equal(
    dispatcherCalls[0].payload.header, '[■ BRAIN]',
    'header must be the locked [BRAIN] chip; got: ' + dispatcherCalls[0].payload.header
  );
  assert.ok(
    dispatcherCalls[0].payload.body.indexOf('shipping risk') !== -1,
    'body must contain founder persona suffix; got: ' + dispatcherCalls[0].payload.body
  );
  assert.ok(
    dispatcherCalls[0].payload.body.indexOf(finding.body_text) !== -1,
    'body must contain finding.body_text'
  );
  // surfaced=true -> detected event with surfaced:true
  const detected = telemetryEvents.find((e) => e.et === 'reverse_salient_detected');
  assert.equal(detected.p.surfaced, true);
  assert.equal(detected.p.suppress_reason, null);
  clearCache();
});

test('F.0: dispatcher returns error envelope -> agent records suppression with dispatcher reason', () => {
  const telemetryEvents = [];
  const dispatcher = {
    pickShape: () => ({ shape: 'error', rendered: { error: 'unknown-shape' } }),
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ dispatcher, telemetry });
  const result = agent.surfaceFinding({
    roomDir: '/tmp/test',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'unknown-shape');
  const detected = telemetryEvents.find((e) => e.et === 'reverse_salient_detected');
  assert.equal(detected.p.surfaced, false);
  assert.equal(detected.p.suppress_reason, 'unknown-shape');
  clearCache();
});

test('F.0: Persona founder role_blend -> shipping risk in F.0 header', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return { shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } };
    },
  };
  const agent = freshAgent({ dispatcher, telemetry: noopTelemetry() });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  // Phase 121.5-10 Sub-plan K: header is locked [BRAIN] chip; persona
  // suffix moved to body slot per audit Section 5.3.
  assert.equal(dispatcherCalls[0].payload.header, '[■ BRAIN]');
  assert.ok(dispatcherCalls[0].payload.body.indexOf('shipping risk') !== -1);
  clearCache();
});

test('F.0: Persona researcher role_blend -> evidence gap in F.0 body (Sub-plan K)', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return { shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } };
    },
  };
  const agent = freshAgent({ dispatcher, telemetry: noopTelemetry() });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { researcher: 0.6, investor: 0.4 },
  });
  // Phase 121.5-10 Sub-plan K: persona suffix moved from header to body.
  assert.equal(dispatcherCalls[0].payload.header, '[■ BRAIN]');
  assert.ok(dispatcherCalls[0].payload.body.indexOf('evidence gap') !== -1);
  clearCache();
});

test('F.0: Persona cold-start (null role_blend) -> lagging component in F.0 body (Sub-plan K)', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return { shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } };
    },
  };
  const agent = freshAgent({ dispatcher, telemetry: noopTelemetry() });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: null,
  });
  // Phase 121.5-10 Sub-plan K: persona suffix moved from header to body.
  assert.equal(dispatcherCalls[0].payload.header, '[■ BRAIN]');
  assert.ok(
    dispatcherCalls[0].payload.body.indexOf('lagging component') !== -1,
    'cold-start body must contain default suffix; got: ' + dispatcherCalls[0].payload.body
  );
  clearCache();
});

test('F.0: handleUserResponse APPROVE -> records reverse_salient_acted_on with response=APPROVE', () => {
  const telemetryEvents = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ telemetry });
  const finding = makeFinding();
  const r = agent.handleUserResponse({
    roomDir: '/tmp/t',
    finding,
    userResponse: 'APPROVE',
    surfaceStartedAtMs: Date.now() - 1500,
  });
  assert.equal(r.handled, true);
  assert.equal(r.response, 'APPROVE');
  const acted = telemetryEvents.find((e) => e.et === 'reverse_salient_acted_on');
  assert.ok(acted, 'reverse_salient_acted_on must fire');
  assert.equal(acted.p.response, 'APPROVE');
  assert.equal(acted.p.reason_present, false);
  assert.ok(typeof acted.p.latency_ms === 'number');
  clearCache();
});

test('F.0: handleUserResponse REJECT path invokes buildRejectedBecauseEdge with reason + parent_decision_id', () => {
  const rejectCalls = [];
  const telemetryEvents = [];
  const f0Renderer = {
    renderShapeF0: () => ({ zones: {}, contract: {} }),
    buildRejectedBecauseEdge: (a) => {
      rejectCalls.push(a);
      return { ok: true, eventId: 'evt-1' };
    },
    F0_VERBS: ['Approve', 'Reject', 'Defer'],
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ f0Renderer, telemetry });
  const finding = makeFinding();
  const r = agent.handleUserResponse({
    roomDir: '/tmp/test',
    finding,
    userResponse: 'REJECT',
    reason: 'too speculative',
    surfaceStartedAtMs: Date.now() - 4000,
  });
  assert.equal(r.handled, true);
  assert.equal(r.response, 'REJECT');
  assert.equal(rejectCalls.length, 1);
  assert.equal(rejectCalls[0].reason, 'too speculative');
  assert.equal(rejectCalls[0].parent_decision_id, 'rs-finding:' + finding.id);
  assert.equal(rejectCalls[0].roomDir, '/tmp/test');
  const acted = telemetryEvents.find((e) => e.et === 'reverse_salient_acted_on');
  assert.equal(acted.p.response, 'REJECT');
  assert.equal(acted.p.reason_present, true);
  clearCache();
});

test('F.0: handleUserResponse REJECT without reason -> reason_present=false', () => {
  const rejectCalls = [];
  const telemetryEvents = [];
  const f0Renderer = {
    renderShapeF0: () => ({ zones: {}, contract: {} }),
    buildRejectedBecauseEdge: (a) => {
      rejectCalls.push(a);
      return { ok: true };
    },
    F0_VERBS: ['Approve', 'Reject', 'Defer'],
  };
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ f0Renderer, telemetry });
  const finding = makeFinding();
  agent.handleUserResponse({
    roomDir: '/tmp/test',
    finding,
    userResponse: 'REJECT',
    surfaceStartedAtMs: Date.now() - 1000,
  });
  const acted = telemetryEvents.find((e) => e.et === 'reverse_salient_acted_on');
  assert.equal(acted.p.reason_present, false);
  clearCache();
});

test('F.0: handleUserResponse DEFER emits reverse_salient_acted_on with response=DEFER (Phase 116 consumer)', () => {
  const telemetryEvents = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      telemetryEvents.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ telemetry });
  const finding = makeFinding();
  const r = agent.handleUserResponse({
    roomDir: '/tmp/test',
    finding,
    userResponse: 'DEFER',
    surfaceStartedAtMs: Date.now() - 2000,
  });
  assert.equal(r.handled, true);
  assert.equal(r.response, 'DEFER');
  const acted = telemetryEvents.find((e) => e.et === 'reverse_salient_acted_on');
  assert.equal(acted.p.response, 'DEFER');
  assert.equal(acted.p.reason_present, false);
  assert.ok(typeof acted.p.latency_ms === 'number');
  clearCache();
});

test('F.0: handleUserResponse unknown response -> handled=false', () => {
  const agent = freshAgent({ telemetry: noopTelemetry() });
  const r = agent.handleUserResponse({
    roomDir: '/tmp/test',
    finding: makeFinding(),
    userResponse: 'BOGUS',
  });
  assert.equal(r.handled, false);
  clearCache();
});

test('F.0: agent uses requestedShape: "F.0" string literal in source (graph-native invariant 4)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  // Match either single or double quotes, with or without spaces.
  const re = /requestedShape\s*:\s*['"]F\.0['"]/;
  assert.ok(re.test(src), 'agent source must contain requestedShape: \'F.0\' (graph-native invariant 4)');
});

test('F.0: agent imports buildRejectedBecauseEdge from shape-f0-renderer', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(src.indexOf('buildRejectedBecauseEdge') !== -1, 'agent must reference buildRejectedBecauseEdge');
});

test('F.0: agent imports recordSelectorMirror from selector-telemetry (>=2 occurrences for detected + acted_on)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  const matches = src.match(/recordSelectorMirror/g) || [];
  assert.ok(matches.length >= 2, 'agent must call recordSelectorMirror at least 2x (detected + acted_on); got ' + matches.length);
});

test('ANTI-PATTERN: zero console.log / process.stdout.write in agent', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.equal(/\bconsole\.log\b/.test(src), false, 'console.log forbidden in agent');
  assert.equal(/process\.stdout\.write/.test(src), false, 'process.stdout.write forbidden in agent');
});

test('ANTI-PATTERN: zero require room-db in agent (Phase 109 chokepoint preserved from Wave 1)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  // Match `require('...room-db...')` patterns
  const re = /require\s*\(\s*['"][^'"]*room-db[^'"]*['"]\s*\)/;
  assert.equal(re.test(src), false, 'direct room-db require forbidden (Phase 109 chokepoint)');
});

test('ANTI-PATTERN: zero brain-client require in agent (Canon Part 8 preserved from Wave 1)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  const re = /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/;
  assert.equal(re.test(src), false, 'brain-client require forbidden (Canon Part 8)');
});

test('ANTI-PATTERN: zero em-dashes in agent source', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.equal(src.indexOf('—'), -1, 'em-dash forbidden in agent source (feedback_no_emdashes)');
});
