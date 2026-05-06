'use strict';

/*
 * Phase 116-02 Wave 2 -- Task 1 RED then GREEN.
 *
 * F.1 dispatch tests for lib/agents/tension-hook-agent.cjs surfaceFinding +
 * handleUserResponse + buildResolvedViaEdge + composeFinding. Verifies:
 *   - Tier 0 -> suppressed; pre-dispatch short-circuit
 *   - JUST_TALK operator -> suppressed; pre-dispatch short-circuit
 *   - Tier >= 1 + non-JUST_TALK -> dispatcher receives F.1 contract with
 *     payload.verbs:['Resolve','Later','Skip'] + emitTelemetry:true
 *   - Dispatcher error envelope -> agent records suppress_reason from error code
 *   - handleUserResponse RESOLVE -> markResolved + buildResolvedViaEdge -> RESOLVES_VIA
 *   - handleUserResponse LATER -> requeue (no edge)
 *   - handleUserResponse SKIP  -> appendTension last_response='SKIP' (no edge)
 *   - buildResolvedViaEdge writes RESOLVES_VIA via lazygraph-ops.upsertEdge
 *     with properties.source='tension-hook'
 *   - composeFinding deterministic id + Canon-Part-8-clean (no body_text)
 *   - Anti-pattern guards: no console.log / room-db / brain-client / persona suffix
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const AGENT_PATH = path.resolve(__dirname, '..', 'lib', 'agents', 'tension-hook-agent.cjs');
const DISPATCHER_PATH = require.resolve('../lib/hmi/selector-dispatcher.cjs');
const LAZYGRAPH_PATH = require.resolve('../lib/core/lazygraph-ops.cjs');
const PENDING_STORE_PATH = require.resolve('../lib/memory/pending-tension-store.cjs');
const NAVIGATION_PATH = require.resolve('../lib/core/navigation.cjs');

function freshAgent(stubs) {
  if (stubs && stubs.dispatcher) require.cache[DISPATCHER_PATH] = { exports: stubs.dispatcher };
  if (stubs && stubs.lazygraph) require.cache[LAZYGRAPH_PATH] = { exports: stubs.lazygraph };
  if (stubs && stubs.pendingStore) require.cache[PENDING_STORE_PATH] = { exports: stubs.pendingStore };
  if (stubs && stubs.navigation) require.cache[NAVIGATION_PATH] = { exports: stubs.navigation };
  delete require.cache[AGENT_PATH];
  return require(AGENT_PATH);
}

function clearCache() {
  [DISPATCHER_PATH, LAZYGRAPH_PATH, PENDING_STORE_PATH, NAVIGATION_PATH, AGENT_PATH]
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

function noopPendingStore() {
  return {
    computeTensionId: () => 'a'.repeat(32),
    jsonlPath: () => '/tmp/noop.jsonl',
    appendTension: () => ({ ok: true, path: '/tmp/noop.jsonl' }),
    readTensions: () => [],
    markSurfaced: () => ({ ok: true, surfacing_count: 1 }),
    markResolved: () => ({ ok: true }),
    markDropped: () => ({ ok: true }),
    requeue: () => ({ ok: true }),
    PENDING_TENSIONS_DIR: '/tmp/.mindrian/pending-tensions',
    VALID_STATES: new Set(['queued', 'surfaced', 'resolved', 'dropped']),
    VALID_TYPES: new Set(['contradiction', 'convergence', 'stale_decision', 'open_question']),
    VALID_RESPONSES: new Set(['RESOLVE', 'LATER', 'SKIP', 'DROPPED']),
  };
}

// =====================================================================
// Test 1-2: export shape contract
// =====================================================================

test('116-02 Test 1: tension-hook-agent exports 4 named functions + F1_VERBS + F1_HEADER', () => {
  clearCache();
  const agent = require(AGENT_PATH);
  assert.equal(typeof agent.composeFinding, 'function');
  assert.equal(typeof agent.surfaceFinding, 'function');
  assert.equal(typeof agent.buildResolvedViaEdge, 'function');
  assert.equal(typeof agent.handleUserResponse, 'function');
  assert.ok(Array.isArray(agent.F1_VERBS));
  assert.deepEqual(agent.F1_VERBS, ['Resolve', 'Later', 'Skip']);
  assert.equal(typeof agent.F1_HEADER, 'string');
  assert.ok(agent.F1_HEADER.length > 0);
  clearCache();
});

test('116-02 Test 2: F1_VERBS array is independent copy (mutation does not affect module)', () => {
  clearCache();
  const agent = require(AGENT_PATH);
  const before = agent.F1_VERBS.slice();
  agent.F1_VERBS.push('Hacked');
  // Re-require -- because of the slice() in module.exports the second require should still be clean.
  delete require.cache[AGENT_PATH];
  const agent2 = require(AGENT_PATH);
  assert.deepEqual(agent2.F1_VERBS, before);
  clearCache();
});

// =====================================================================
// Test 3-5: surfaceFinding suppression branches
// =====================================================================

test('116-02 Test 3: surfaceFinding tier=0 -> {surfaced:false, suppress_reason:tier_0} pre-dispatch', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => { dispatcherCalls.push(a); return { shape: 'F.1', rendered: { contract: {} } }; },
  };
  const agent = freshAgent({ dispatcher, pendingStore: noopPendingStore() });
  const result = agent.surfaceFinding({
    finding: makeFinding(),
    roomDir: '/tmp/test-room',
    sessionId: 's1',
    tier: 0,
    operator: null,
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'tier_0');
  assert.equal(dispatcherCalls.length, 0, 'tier=0 must short-circuit pre-dispatch');
  clearCache();
});

test('116-02 Test 4: surfaceFinding JUST_TALK -> {surfaced:false, suppress_reason:just_talk} pre-dispatch', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => { dispatcherCalls.push(a); return { shape: 'F.1', rendered: { contract: {} } }; },
  };
  const agent = freshAgent({ dispatcher, pendingStore: noopPendingStore() });
  const result = agent.surfaceFinding({
    finding: makeFinding(),
    roomDir: '/tmp/test-room',
    sessionId: 's1',
    tier: 1,
    operator: 'JUST_TALK',
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'just_talk');
  assert.equal(dispatcherCalls.length, 0, 'JUST_TALK must short-circuit pre-dispatch');
  clearCache();
});

test('116-02 Test 5: surfaceFinding invalid finding -> {surfaced:false, suppress_reason:invalid_finding}', () => {
  const agent = freshAgent({ pendingStore: noopPendingStore() });
  const r1 = agent.surfaceFinding({ finding: null, roomDir: '/tmp/x', tier: 1, operator: null });
  assert.equal(r1.surfaced, false);
  assert.equal(r1.suppress_reason, 'invalid_finding');
  const r2 = agent.surfaceFinding({ finding: 'not-an-object', roomDir: '/tmp/x', tier: 1, operator: null });
  assert.equal(r2.surfaced, false);
  assert.equal(r2.suppress_reason, 'invalid_finding');
  clearCache();
});

// =====================================================================
// Test 6: surfaceFinding F.1 contract dispatch (the load-bearing test)
// =====================================================================

test('116-02 Test 6: surfaceFinding tier>=1 -> dispatcher.pickShape({requestedShape:F.1, payload.verbs:[Resolve,Later,Skip], emitTelemetry:true})', () => {
  const dispatcherCalls = [];
  const dispatcher = {
    pickShape: (a) => {
      dispatcherCalls.push(a);
      return {
        shape: 'F.1',
        rendered: {
          zones: { header: a.payload.header, body: 'mock body', signals: '', footer: null },
          contract: {
            shape: 'F.1',
            keyboard: 'askuserquestion',
            verbs: ['Resolve', 'Later', 'Skip', 'Free-Text'],
            mode: 'B',
            recommended: null,
          },
        },
      };
    },
  };
  const agent = freshAgent({ dispatcher, pendingStore: noopPendingStore() });
  const finding = makeFinding();
  const result = agent.surfaceFinding({
    finding,
    roomDir: '/tmp/test-room',
    sessionId: 's1',
    tier: 1,
    operator: null,
  });
  assert.equal(result.surfaced, true);
  assert.equal(typeof result.surfaceStartedAtMs, 'number');
  assert.ok(result.contract);
  assert.equal(result.finding, finding);
  assert.equal(dispatcherCalls.length, 1);
  assert.equal(dispatcherCalls[0].requestedShape, 'F.1');
  assert.deepEqual(dispatcherCalls[0].payload.verbs, ['Resolve', 'Later', 'Skip']);
  assert.equal(dispatcherCalls[0].payload.emitTelemetry, true);
  assert.equal(dispatcherCalls[0].payload.recommendedVerb, null, 'D-02: no recommendation');
  assert.equal(dispatcherCalls[0].tier, 1);
  assert.equal(dispatcherCalls[0].operator, null);
  clearCache();
});

// =====================================================================
// Test 7: dispatcher error envelope
// =====================================================================

test('116-02 Test 7: dispatcher returns {shape:error, rendered:{error:tier-0-refused}} -> agent records suppress_reason', () => {
  const dispatcher = {
    pickShape: () => ({ shape: 'error', rendered: { error: 'tier-0-refused' } }),
  };
  const agent = freshAgent({ dispatcher, pendingStore: noopPendingStore() });
  const result = agent.surfaceFinding({
    finding: makeFinding(),
    roomDir: '/tmp/test-room',
    tier: 1,
    operator: null,
  });
  assert.equal(result.surfaced, false);
  assert.equal(result.suppress_reason, 'tier-0-refused');
  clearCache();
});

// =====================================================================
// Test 8-10: handleUserResponse three branches
// =====================================================================

test('116-02 Test 8: handleUserResponse RESOLVE -> markResolved + buildResolvedViaEdge -> RESOLVES_VIA upsertEdge', () => {
  const upsertCalls = [];
  const lazygraph = {
    upsertEdge: (db, edge) => { upsertCalls.push({ db, edge }); return { ok: true, type: edge.type, source: edge.source, target: edge.target }; },
  };
  const markCalls = [];
  const requeueCalls = [];
  const appendCalls = [];
  const pendingStore = Object.assign(noopPendingStore(), {
    markResolved: (slug, id, response) => { markCalls.push({ slug, id, response }); return { ok: true }; },
    requeue: (slug, id) => { requeueCalls.push({ slug, id }); return { ok: true }; },
    appendTension: (slug, entry) => { appendCalls.push({ slug, entry }); return { ok: true, path: '/tmp/x.jsonl' }; },
  });
  const agent = freshAgent({ lazygraph, pendingStore });
  const finding = makeFinding();
  const result = agent.handleUserResponse({
    finding,
    roomDir: '/tmp/some-room/test-room-slug',
    userResponse: 'RESOLVE',
    surfaceStartedAtMs: Date.now() - 1500,
    db: { prepare: () => ({ run: () => {} }) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.response, 'RESOLVE');
  assert.ok(typeof result.latency_ms === 'number');
  assert.equal(markCalls.length, 1);
  assert.equal(markCalls[0].id, finding.id);
  assert.equal(markCalls[0].response, 'RESOLVE');
  assert.equal(markCalls[0].slug, 'test-room-slug');
  assert.equal(requeueCalls.length, 0, 'RESOLVE must NOT call requeue');
  // RESOLVES_VIA cascade edge
  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].edge.type, 'RESOLVES_VIA');
  assert.equal(upsertCalls[0].edge.source, finding.source_node_id);
  assert.equal(upsertCalls[0].edge.target, finding.target_node_id);
  assert.equal(upsertCalls[0].edge.properties.source, 'tension-hook');
  assert.equal(upsertCalls[0].edge.properties.tension_id, finding.id);
  assert.equal(upsertCalls[0].edge.properties.parent_decision_id, 'tension:' + finding.id);
  clearCache();
});

test('116-02 Test 9: handleUserResponse LATER -> requeue ONLY (no edge)', () => {
  const upsertCalls = [];
  const lazygraph = {
    upsertEdge: (db, edge) => { upsertCalls.push({ db, edge }); return { ok: true }; },
  };
  const requeueCalls = [];
  const markCalls = [];
  const pendingStore = Object.assign(noopPendingStore(), {
    requeue: (slug, id) => { requeueCalls.push({ slug, id }); return { ok: true }; },
    markResolved: (slug, id, r) => { markCalls.push({ slug, id, r }); return { ok: true }; },
  });
  const agent = freshAgent({ lazygraph, pendingStore });
  const finding = makeFinding();
  const result = agent.handleUserResponse({
    finding,
    roomDir: '/tmp/test-room',
    userResponse: 'LATER',
    surfaceStartedAtMs: Date.now() - 500,
    db: { prepare: () => ({ run: () => {} }) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.response, 'LATER');
  assert.equal(requeueCalls.length, 1);
  assert.equal(requeueCalls[0].id, finding.id);
  assert.equal(markCalls.length, 0, 'LATER must NOT call markResolved');
  assert.equal(upsertCalls.length, 0, 'LATER must NOT emit any edge');
  clearCache();
});

test('116-02 Test 10: handleUserResponse SKIP -> appendTension with last_response=SKIP (no edge, no markResolved)', () => {
  const upsertCalls = [];
  const lazygraph = {
    upsertEdge: (db, edge) => { upsertCalls.push({ db, edge }); return { ok: true }; },
  };
  const markCalls = [];
  const requeueCalls = [];
  const appendCalls = [];
  const finding = makeFinding();
  const existing = Object.assign({}, finding, {
    tension_id: finding.id,
    type: 'contradiction',
    state: 'surfaced',
    surfacing_count: 1,
  });
  const pendingStore = Object.assign(noopPendingStore(), {
    readTensions: () => [existing],
    appendTension: (slug, entry) => { appendCalls.push({ slug, entry }); return { ok: true, path: '/tmp/x.jsonl' }; },
    markResolved: (slug, id, r) => { markCalls.push({ slug, id, r }); return { ok: true }; },
    requeue: (slug, id) => { requeueCalls.push({ slug, id }); return { ok: true }; },
  });
  const agent = freshAgent({ lazygraph, pendingStore });
  const result = agent.handleUserResponse({
    finding,
    roomDir: '/tmp/test-room',
    userResponse: 'SKIP',
    surfaceStartedAtMs: Date.now() - 750,
    db: { prepare: () => ({ run: () => {} }) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.response, 'SKIP');
  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0].entry.last_response, 'SKIP');
  assert.equal(appendCalls[0].entry.state, 'surfaced', 'SKIP preserves state=surfaced');
  assert.equal(markCalls.length, 0, 'SKIP must NOT call markResolved');
  assert.equal(requeueCalls.length, 0, 'SKIP must NOT call requeue');
  assert.equal(upsertCalls.length, 0, 'SKIP must NOT emit any edge');
  clearCache();
});

// =====================================================================
// Test 11-13: buildResolvedViaEdge contract
// =====================================================================

test('116-02 Test 11: buildResolvedViaEdge happy path -> RESOLVES_VIA via upsertEdge with properties.source=tension-hook', () => {
  const upsertCalls = [];
  const lazygraph = {
    upsertEdge: (db, edge) => { upsertCalls.push({ db, edge }); return { ok: true, type: edge.type, source: edge.source, target: edge.target }; },
  };
  const agent = freshAgent({ lazygraph, pendingStore: noopPendingStore() });
  const result = agent.buildResolvedViaEdge({
    roomDir: '/tmp/test-room',
    tension_id: 'a'.repeat(32),
    source_node_id: 'src-node',
    target_node_id: 'tgt-node',
    parent_decision_id: 'tension:' + 'a'.repeat(32),
    db: { prepare: () => ({ run: () => {} }) },
  });
  assert.equal(result.ok, true);
  assert.equal(result.edgeType, 'RESOLVES_VIA');
  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].edge.type, 'RESOLVES_VIA');
  assert.equal(upsertCalls[0].edge.source, 'src-node');
  assert.equal(upsertCalls[0].edge.target, 'tgt-node');
  assert.equal(upsertCalls[0].edge.properties.source, 'tension-hook');
  assert.equal(upsertCalls[0].edge.properties.agent, 'unresolved-tension');
  assert.equal(upsertCalls[0].edge.properties.tension_id, 'a'.repeat(32));
  assert.ok(typeof upsertCalls[0].edge.properties.resolved_at === 'string');
  clearCache();
});

test('116-02 Test 12: buildResolvedViaEdge invalid inputs -> {ok:false, reason:...} (never throws)', () => {
  const lazygraph = {
    upsertEdge: () => ({ ok: true }),
  };
  const agent = freshAgent({ lazygraph, pendingStore: noopPendingStore() });
  const r1 = agent.buildResolvedViaEdge({ tension_id: '', source_node_id: 's', target_node_id: 't', parent_decision_id: 'p', db: {} });
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'invalid_tension_id');
  const r2 = agent.buildResolvedViaEdge({ tension_id: 'x', source_node_id: '', target_node_id: 't', parent_decision_id: 'p', db: {} });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'invalid_source_id');
  const r3 = agent.buildResolvedViaEdge({ tension_id: 'x', source_node_id: 's', target_node_id: '', parent_decision_id: 'p', db: {} });
  assert.equal(r3.ok, false);
  assert.equal(r3.reason, 'invalid_target_id');
  const r4 = agent.buildResolvedViaEdge({ tension_id: 'x', source_node_id: 's', target_node_id: 't', parent_decision_id: '', db: {} });
  assert.equal(r4.ok, false);
  assert.equal(r4.reason, 'invalid_parent_decision_id');
  clearCache();
});

test('116-02 Test 13: buildResolvedViaEdge missing db -> {ok:false, reason:db_unavailable} (graceful)', () => {
  const lazygraph = {
    upsertEdge: () => ({ ok: true }),
  };
  const agent = freshAgent({ lazygraph, pendingStore: noopPendingStore() });
  const r = agent.buildResolvedViaEdge({
    roomDir: '/tmp/x',
    tension_id: 'a'.repeat(32),
    source_node_id: 'src',
    target_node_id: 'tgt',
    parent_decision_id: 'tension:abc',
    db: null,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'db_unavailable');
  clearCache();
});

// =====================================================================
// Test 14: composeFinding determinism + Canon Part 8 cleanliness
// =====================================================================

test('116-02 Test 14: composeFinding deterministic id + no body_text/title fields (Canon Part 8 clean)', () => {
  clearCache();
  const agent = require(AGENT_PATH);
  const f1 = agent.composeFinding({
    tension_id: 'b'.repeat(32),
    source_node_id: 's1',
    target_node_id: 't1',
    source_section: 'a',
    target_section: 'b',
    tension_type: 'contradiction',
  });
  const f2 = agent.composeFinding({
    tension_id: 'b'.repeat(32),
    source_node_id: 's1',
    target_node_id: 't1',
    source_section: 'a',
    target_section: 'b',
    tension_type: 'contradiction',
  });
  assert.deepEqual(f1, f2, 'composeFinding must be deterministic');
  assert.equal(f1.id, 'b'.repeat(32));
  // Canon Part 8: no user-content fields
  assert.equal(Object.prototype.hasOwnProperty.call(f1, 'body_text'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(f1, 'source_title'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(f1, 'target_title'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(f1, 'quoted_text'), false);
  // Required fields present
  assert.equal(f1.source_node_id, 's1');
  assert.equal(f1.target_node_id, 't1');
  clearCache();
});

// =====================================================================
// Test 15: anti-pattern guards (chokepoint preserved + Canon Part 8 + D-02)
// =====================================================================

test('116-02 Test 15: anti-pattern guards (room-db, brain-client, console.log, persona-suffix, AskUserQuestion, em-dash)', () => {
  const src = fs.readFileSync(AGENT_PATH, 'utf8');
  // strip block + line comments before regex sweep so the file header docs are NOT flagged
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  // 1. no direct DB module require (Phase 109 D-06 chokepoint preserved)
  const reRoomDb = /require\s*\(\s*['"][^'"]*room-db[^'"]*['"]\s*\)/;
  assert.equal(reRoomDb.test(stripped), false, 'room-db require forbidden (Phase 109 chokepoint)');
  // 2. no Brain client (Canon Part 8)
  const reBrain = /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/;
  assert.equal(reBrain.test(stripped), false, 'brain-client require forbidden (Canon Part 8)');
  // 3. no console.log / process.stdout.write call sites
  assert.equal(/\bconsole\s*\.\s*log\s*\(/.test(stripped), false, 'console.log forbidden');
  assert.equal(/process\s*\.\s*stdout\s*\.\s*write\s*\(/.test(stripped), false, 'process.stdout.write forbidden');
  // 4. D-02: no Phase 115 persona_variants consumption
  assert.equal(/persona_variants/.test(stripped), false, 'persona_variants forbidden (D-02a)');
  assert.equal(/reverse-salient-persona-suffix/.test(stripped), false, 'persona-suffix forbidden (D-02)');
  // 5. D-06: no inline AskUserQuestion calls (must route via pickShape)
  assert.equal(/\bAskUserQuestion\s*\(/.test(stripped), false, 'AskUserQuestion call forbidden (D-06)');
  // 6. no em-dashes per memory rule
  assert.equal(src.indexOf('—'), -1, 'em-dash forbidden in agent source');
  // 7. F.1 dispatch literal present
  assert.ok(/requestedShape\s*:\s*['"]F\.1['"]/.test(stripped), 'agent must contain requestedShape: F.1');
  // 8. RESOLVES_VIA literal present
  assert.ok(stripped.indexOf('RESOLVES_VIA') !== -1, 'RESOLVES_VIA must be referenced');
  // 9. tension-hook source attribution literal
  assert.ok(stripped.indexOf('tension-hook') !== -1, 'tension-hook source attribution must be present');
});
