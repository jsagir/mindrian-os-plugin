'use strict';
// Phase 163-05 -- The 4-persona x 3-path variance matrix + Shape F hybrid gate
// test suite (WAVE 5 SURFACE-B). D-163-06 ships FULL variance in v1: all four
// persona lenses (Founder / Researcher / Investor / Analyst) and all three paths
// (Quick / Full / Expert), surfaced through Shape F hybrid gates (D-163-05).
//
// Four behaviors:
//
//   Test 1: PERSONA_LENSES is a frozen array of exactly the four lenses
//           Founder / Researcher / Investor / Analyst.
//   Test 2: PATH_VARIANTS is exactly Quick / Full / Expert, each carrying a depth
//           + gate-policy descriptor (Quick = fewer rings + auto; Full = all rings
//           + hybrid; Expert = all rings + multi-agent refinement).
//   Test 3: surfacePersonaPathGate(roomDir, opts) returns a Shape F gate
//           descriptor offering the four personas and three paths (the hybrid
//           judgment-point selector, D-163-05).
//   Test 4: recordPersonaPathSelection(db, {persona, path, focusNodeId}) writes a
//           typed edge via navigation.writeEdge so the selection is graph data
//           (Part 4) with enum-only props (Part 8).
//
// Canon Part 8: edge props are ENUM-ONLY (persona / path); no prose; no Brain
//   egress.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). No SKIP.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const VARIANCE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'trending-to-absurd', 'variance.cjs');
const NAV_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-trending-to-absurd-variance');

// ---------------------------------------------------------------------------
// Test 1: PERSONA_LENSES is the frozen four (D-163-06).
// ---------------------------------------------------------------------------
check('Test 1 -- PERSONA_LENSES is the frozen four (Founder/Researcher/Investor/Analyst)', () => {
  delete require.cache[require.resolve(VARIANCE_PATH)];
  const v = require(VARIANCE_PATH);
  assert.ok(Array.isArray(v.PERSONA_LENSES), 'PERSONA_LENSES is an array');
  assert.equal(v.PERSONA_LENSES.length, 4, 'exactly four persona lenses (D-163-06)');
  assert.deepEqual(v.PERSONA_LENSES.slice().sort(),
    ['Analyst', 'Founder', 'Investor', 'Researcher'],
    'the four are Founder / Researcher / Investor / Analyst');
  assert.ok(Object.isFrozen(v.PERSONA_LENSES), 'PERSONA_LENSES is frozen');
});

// ---------------------------------------------------------------------------
// Test 2: PATH_VARIANTS is Quick / Full / Expert with depth + gate policy.
// ---------------------------------------------------------------------------
check('Test 2 -- PATH_VARIANTS is Quick/Full/Expert with depth + gate policy', () => {
  delete require.cache[require.resolve(VARIANCE_PATH)];
  const v = require(VARIANCE_PATH);
  assert.ok(v.PATH_VARIANTS && typeof v.PATH_VARIANTS === 'object', 'PATH_VARIANTS is an object');
  assert.ok(v.PATH_VARIANTS.Quick, 'Quick path present');
  assert.ok(v.PATH_VARIANTS.Full, 'Full path present');
  assert.ok(v.PATH_VARIANTS.Expert, 'Expert path present');
  assert.equal(Object.keys(v.PATH_VARIANTS).length, 3, 'exactly three paths');
  assert.ok(Object.isFrozen(v.PATH_VARIANTS), 'PATH_VARIANTS is frozen');

  // Quick = fewer rings + auto gate policy.
  assert.ok(Number.isFinite(v.PATH_VARIANTS.Quick.rings), 'Quick carries a ring depth');
  assert.equal(v.PATH_VARIANTS.Quick.gate_policy, 'auto', 'Quick = auto gate policy');
  assert.ok(v.PATH_VARIANTS.Quick.rings < v.PATH_VARIANTS.Full.rings, 'Quick has fewer rings than Full');

  // Full = all rings + hybrid gates (the D-163-05 default).
  assert.equal(v.PATH_VARIANTS.Full.gate_policy, 'hybrid', 'Full = hybrid gate policy');
  // The futures depth cap is the "all rings" depth (reused, not minted).
  const futures = require(path.join(REPO_ROOT, 'lib', 'core', 'futures', 'orchestrator.cjs'));
  assert.equal(v.PATH_VARIANTS.Full.rings, futures.FUTURES_DEPTH_CAP, 'Full = FUTURES_DEPTH_CAP (all rings, reused)');

  // Expert = all rings + hybrid + multi-agent refinement flag.
  assert.equal(v.PATH_VARIANTS.Expert.rings, futures.FUTURES_DEPTH_CAP, 'Expert = all rings');
  assert.equal(v.PATH_VARIANTS.Expert.gate_policy, 'hybrid', 'Expert rides the hybrid rails');
  assert.equal(v.PATH_VARIANTS.Expert.multi_agent, true, 'Expert carries the multi-agent refinement flag');
});

// ---------------------------------------------------------------------------
// Test 3: surfacePersonaPathGate returns a Shape F gate descriptor offering the
// four personas + three paths.
// ---------------------------------------------------------------------------
check('Test 3 -- surfacePersonaPathGate returns a Shape F gate offering the 4 personas + 3 paths', () => {
  delete require.cache[require.resolve(VARIANCE_PATH)];
  const v = require(VARIANCE_PATH);
  const gate = v.surfacePersonaPathGate('/tmp/room-163-05-t3', {});

  assert.ok(gate && typeof gate === 'object', 'gate descriptor returned');
  assert.equal(gate.judgment_point, 'persona-path-selection', 'the persona/path judgment point');
  // F.2 path-control for the path choice; F.1 next-move for the persona.
  assert.ok(typeof gate.surface === 'string' && /F\.[12]/.test(gate.surface), 'rendered as a Shape F selector (F.1 / F.2)');
  assert.deepEqual(gate.personas.slice().sort(),
    ['Analyst', 'Founder', 'Investor', 'Researcher'],
    'the gate offers the four personas');
  assert.deepEqual(Object.keys(gate.paths).sort(), ['Expert', 'Full', 'Quick'], 'the gate offers the three paths');
  // Tri-context panels present; BRAIN carries a generic handle only (Part 8).
  assert.ok(gate.contexts && gate.contexts.local && gate.contexts.brain && gate.contexts.signal, 'tri-context panels present');
  assert.ok(/generic framework handle only/.test(gate.contexts.brain.note), 'Part 8 note on the BRAIN panel');
});

// ---------------------------------------------------------------------------
// Test 4: recordPersonaPathSelection writes a typed edge via navigation.writeEdge
// with enum-only props (Part 4 / Part 8).
// ---------------------------------------------------------------------------
check('Test 4 -- recordPersonaPathSelection writes a typed edge with enum-only props', () => {
  delete require.cache[require.resolve(VARIANCE_PATH)];
  const v = require(VARIANCE_PATH);
  const navigation = require(NAV_PATH);

  const original = navigation.writeEdge;
  const calls = [];
  navigation.writeEdge = (db, params) => {
    calls.push({ db, params });
    return { ok: true, edge_id: 'e1', type: params.edge_type, source: params.source_id, target: params.target_id };
  };

  const fakeDb = { _marker: 'caller-owned' };
  const res = v.recordPersonaPathSelection(fakeDb, {
    persona: 'Founder',
    path: 'Full',
    focusNodeId: 'focus:trend-1',
  });

  assert.ok(res && res.ok === true, 'the selection write succeeded');
  assert.equal(calls.length, 1, 'navigation.writeEdge was the path (the chokepoint)');
  assert.equal(calls[0].db, fakeDb, 'the caller-owned db handle was forwarded to the chokepoint');
  const params = calls[0].params;
  // The selection is graph data: a frozen-set edge type carrying the focus node.
  assert.ok(['SELECTED_REACH', 'TAGGED_WITH'].includes(params.edge_type),
    'a frozen-set typed edge (SELECTED_REACH / TAGGED_WITH): ' + params.edge_type);
  assert.equal(params.source_id, 'focus:trend-1', 'source is the focus node');
  assert.ok(typeof params.target_id === 'string' && params.target_id.length > 0, 'target is a typed handle');
  // Part 8: properties are ENUM/scalar ONLY (persona + path); no prose.
  assert.ok(params.properties && typeof params.properties === 'object', 'properties object present');
  assert.equal(params.properties.persona, 'Founder', 'persona enum on the edge');
  assert.equal(params.properties.path, 'Full', 'path enum on the edge');
  // No freeform/body field leaks onto the edge.
  assert.equal('body' in params.properties, false, 'no body on the edge (Part 8 scalar-only)');
  assert.equal('prose' in params.properties, false, 'no prose on the edge (Part 8 scalar-only)');

  // Defensive: an invalid persona / path is rejected, not written.
  const bad = v.recordPersonaPathSelection(fakeDb, { persona: 'NotAPersona', path: 'Full', focusNodeId: 'f' });
  assert.equal(bad.ok, false, 'an invalid persona is rejected');
  assert.equal(calls.length, 1, 'no edge written for an invalid selection');

  navigation.writeEdge = original;
});

console.log(`\nPASS (${pass}/${total})`);
if (pass !== total) process.exit(1);
