'use strict';

/*
 * Phase 89-07 Wave 2 -- Task 2 RED then GREEN.
 *
 * Dual-surface telemetry tests for lib/agents/reverse-salient-agent.cjs:
 *   - reverse_salient_detected emitted on every detection (including suppressed)
 *   - reverse_salient_acted_on emitted on every user response
 *   - Detected payload key set: { finding_id, direction, abs_diff, signed_diff,
 *                                 tier, persona_key, surfaced, suppress_reason,
 *                                 brain_offline_flag }
 *   - Acted_on payload key set: { finding_id, response, latency_ms, reason_present }
 *   - Canon Part 8 audit: zero user-content strings (body_text, source_title,
 *                          target_title, reason text) in any telemetry payload
 *   - Suppression paths (tier 0, JUST_TALK, dispatcher error) STILL emit telemetry
 *   - Cold-start path records persona_key='default'
 *   - MINDRIAN_DISABLE_MEMORY_EVENT resilience contract
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'reverse-salient-agent.cjs');
const TELEMETRY_PATH = require.resolve('../lib/hmi/selector-telemetry.cjs');
const DISPATCHER_PATH = require.resolve('../lib/hmi/selector-dispatcher.cjs');
const F0_RENDERER_PATH = require.resolve('../lib/hmi/shape-f0-renderer.cjs');
const PERSONA_SUFFIX_PATH = require.resolve('../lib/core/reverse-salient-persona-suffix.cjs');

function freshAgent(stubs) {
  if (stubs.dispatcher) require.cache[DISPATCHER_PATH] = { exports: stubs.dispatcher };
  if (stubs.telemetry) require.cache[TELEMETRY_PATH] = { exports: stubs.telemetry };
  if (stubs.f0Renderer) require.cache[F0_RENDERER_PATH] = { exports: stubs.f0Renderer };
  delete require.cache[AGENT_PATH];
  return require(AGENT_PATH);
}

function clearCache() {
  [TELEMETRY_PATH, DISPATCHER_PATH, F0_RENDERER_PATH, PERSONA_SUFFIX_PATH, AGENT_PATH].forEach(
    (p) => delete require.cache[p]
  );
}

function makeFinding() {
  return {
    id: 'abc123def456abc123def456abc123de',
    source_artifact_id: 'a',
    target_artifact_id: 'b',
    direction: 'structural_transfer',
    signed_diff: 0.5,
    abs_diff: 0.5,
    body_text: 'SECRET USER CONTENT body that must never appear in telemetry',
    source_title: 'SECRET SOURCE TITLE',
    target_title: 'SECRET TARGET TITLE',
    brain_chain_text: 'chain',
  };
}

test('telemetry: reverse_salient_detected payload contains exact key set (Canon Part 8 schema)', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.ok(detected, 'reverse_salient_detected must fire');
  const expectedKeys = ['finding_id', 'direction', 'abs_diff', 'signed_diff',
                         'tier', 'persona_key', 'surfaced', 'suppress_reason', 'brain_offline_flag'];
  const actualKeys = Object.keys(detected.p).sort();
  assert.deepEqual(actualKeys, expectedKeys.slice().sort(),
    'detected payload key set must be exactly the 9 specified keys');
  clearCache();
});

test('telemetry: CANON PART 8 AUDIT -- detected payload has zero user-content strings', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  const json = JSON.stringify(detected.p);
  assert.equal(json.indexOf('SECRET USER CONTENT'), -1, 'body_text MUST NOT appear in telemetry payload');
  assert.equal(json.indexOf('SECRET SOURCE TITLE'), -1, 'source_title MUST NOT appear in telemetry payload');
  assert.equal(json.indexOf('SECRET TARGET TITLE'), -1, 'target_title MUST NOT appear in telemetry payload');
  assert.equal(json.indexOf('body_text'), -1, 'body_text key MUST NOT appear in telemetry payload');
  assert.equal(json.indexOf('source_title'), -1, 'source_title key MUST NOT appear in telemetry payload');
  assert.equal(json.indexOf('target_title'), -1, 'target_title key MUST NOT appear in telemetry payload');
  clearCache();
});

test('telemetry: detected payload field types are scalar (enum/sha256/integer/boolean only)', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  const p = events.find((e) => e.et === 'reverse_salient_detected').p;
  assert.equal(typeof p.finding_id, 'string');
  assert.equal(typeof p.direction, 'string');
  assert.equal(typeof p.abs_diff, 'number');
  assert.equal(typeof p.signed_diff, 'number');
  assert.equal(typeof p.tier, 'number');
  assert.equal(typeof p.persona_key, 'string');
  assert.equal(typeof p.surfaced, 'boolean');
  // suppress_reason is null when surfaced; string enum otherwise.
  assert.ok(p.suppress_reason === null || typeof p.suppress_reason === 'string');
  assert.equal(typeof p.brain_offline_flag, 'boolean');
  clearCache();
});

test('telemetry: reverse_salient_acted_on payload contains exact key set', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ telemetry });
  agent.handleUserResponse({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    userResponse: 'APPROVE',
    surfaceStartedAtMs: Date.now() - 1500,
  });
  const acted = events.find((e) => e.et === 'reverse_salient_acted_on');
  assert.ok(acted);
  const expectedKeys = ['finding_id', 'response', 'latency_ms', 'reason_present'];
  const actualKeys = Object.keys(acted.p).sort();
  assert.deepEqual(actualKeys, expectedKeys.slice().sort());
  clearCache();
});

test('telemetry: CANON PART 8 AUDIT -- acted_on payload never carries reject reason text', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const f0Renderer = {
    renderShapeF0: () => ({ zones: {}, contract: {} }),
    buildRejectedBecauseEdge: () => ({ ok: true }),
    F0_VERBS: ['Approve', 'Reject', 'Defer'],
  };
  const agent = freshAgent({ telemetry, f0Renderer });
  agent.handleUserResponse({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    userResponse: 'REJECT',
    reason: 'SECRET REJECT REASON should never leak to telemetry',
    surfaceStartedAtMs: Date.now() - 500,
  });
  const acted = events.find((e) => e.et === 'reverse_salient_acted_on');
  const json = JSON.stringify(acted.p);
  assert.equal(json.indexOf('SECRET REJECT REASON'), -1,
    'reject reason text MUST NOT leak to telemetry payload');
  // reason_present is the only signal
  assert.equal(acted.p.reason_present, true);
  clearCache();
});

test('telemetry: tier=0 suppression STILL records detected event (Pitfall 5)', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'error', rendered: { error: 'tier-0-refused' } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 0,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.ok(detected, 'tier-0 suppression must STILL emit detected event');
  assert.equal(detected.p.surfaced, false);
  assert.equal(detected.p.suppress_reason, 'tier_0');
  clearCache();
});

test('telemetry: JUST_TALK suppression STILL records detected event', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'error', rendered: { error: 'render_v2_compaction_violation' } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 1,
    operator: 'JUST_TALK',
    roleBlend: { researcher: 0.6 },
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.ok(detected);
  assert.equal(detected.p.surfaced, false);
  assert.equal(detected.p.suppress_reason, 'just_talk');
  // persona_key still recorded even on suppression
  assert.equal(detected.p.persona_key, 'researcher');
  clearCache();
});

test('telemetry: cold-start records persona_key=default', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: null,
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.equal(detected.p.persona_key, 'default');
  clearCache();
});

test('telemetry: persona_key matches role_blend highest-weight key', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { investor: 0.6, operator: 0.4 },
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.equal(detected.p.persona_key, 'investor');
  clearCache();
});

test('telemetry: brain_offline_flag passes through from caller', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
    brainOfflineFlag: true,
  });
  const detected = events.find((e) => e.et === 'reverse_salient_detected');
  assert.equal(detected.p.brain_offline_flag, true);
  clearCache();
});

test('telemetry: latency_ms is a non-negative integer', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ telemetry });
  agent.handleUserResponse({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    userResponse: 'DEFER',
    surfaceStartedAtMs: Date.now() - 3000,
  });
  const acted = events.find((e) => e.et === 'reverse_salient_acted_on');
  assert.ok(Number.isInteger(acted.p.latency_ms));
  assert.ok(acted.p.latency_ms >= 0);
  clearCache();
});

test('telemetry: latency_ms zero/missing surfaceStartedAtMs -> 0 (defensive)', () => {
  const events = [];
  const telemetry = {
    recordSelectorMirror: (rd, et, p) => {
      events.push({ et, p });
      return { ok: true };
    },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const agent = freshAgent({ telemetry });
  agent.handleUserResponse({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    userResponse: 'DEFER',
  });
  const acted = events.find((e) => e.et === 'reverse_salient_acted_on');
  assert.ok(Number.isInteger(acted.p.latency_ms));
  assert.ok(acted.p.latency_ms >= 0);
  clearCache();
});

test('telemetry: agent never throws when recordSelectorMirror returns ok:false', () => {
  const telemetry = {
    recordSelectorMirror: () => ({ ok: false, reason: 'mirror_disabled_env' }),
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  // Must NOT throw even when mirror returns ok:false
  const r = agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  assert.equal(r.surfaced, true);
  clearCache();
});

test('telemetry: agent never throws when recordSelectorMirror itself throws (graceful catch)', () => {
  const telemetry = {
    recordSelectorMirror: () => { throw new Error('synthetic telemetry crash'); },
    recordPresentation: () => {},
    recordResponse: () => {},
  };
  const dispatcher = {
    pickShape: () => ({ shape: 'F.0', rendered: { zones: {}, contract: { shape: 'F.0' } } }),
  };
  const agent = freshAgent({ telemetry, dispatcher });
  // Must NOT propagate the throw
  const r = agent.surfaceFinding({
    roomDir: '/tmp/t',
    finding: makeFinding(),
    tier: 2,
    operator: null,
    roleBlend: { founder: 0.7 },
  });
  assert.equal(r.surfaced, true);
  clearCache();
});
