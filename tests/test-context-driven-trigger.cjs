'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-07 -- the context-driven-trigger test fence (R3 / INV-07).
 *
 * Asserts the sensor dispatch path tiers its trigger model: a LOCAL navigator
 * problem-state signal (stage / JTBD / graph-gap, read enum/scalar via the
 * tuple + ctx the navigation.cjs chokepoint populates) is the CONTEXT tier and
 * is PREFERRED; keyword/lexicon match is a FALLBACK tier recorded with a `mode`
 * enum (mirroring sensor-diffusion-adoption's mode field). The evidence object
 * carries only enum/scalar (never the matched user text, Part 8). The Phase 144
 * fence is preserved (dispatchSensors never mutates routing_source, never calls
 * decide()).
 *
 * Task 2 additionally asserts /mos:systems-thinking is registry-wired (CIRS
 * R1-conformant) -- the INV-23 systems-thinking-under-CIRS confirmation.
 *
 * Pure node assertions. No network. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const sensorTypes = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-types.cjs'));
const insightSensors = require(path.join(REPO_ROOT, 'lib/core/insight-sensors.cjs'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push(name + ' -- ' + (e && e.message ? e.message : String(e)));
    console.log('  FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

console.log('Phase 172-07 context-driven-trigger fence');
console.log('');

// ---------------------------------------------------------------------------
// The shared tiering helpers exist and expose the closed mode/tier enum.
// ---------------------------------------------------------------------------
check('TRIGGER_TIERS is a frozen, ordered closed set (context preferred, keyword fallback)', () => {
  assert.ok(Array.isArray(sensorTypes.TRIGGER_TIERS), 'TRIGGER_TIERS is an array');
  assert.ok(Object.isFrozen(sensorTypes.TRIGGER_TIERS), 'TRIGGER_TIERS is frozen');
  // context tier must be ordered BEFORE keyword (the precedence is the doctrine).
  const ctxIdx = sensorTypes.TRIGGER_TIERS.indexOf('context');
  const kwIdx = sensorTypes.TRIGGER_TIERS.indexOf('keyword');
  assert.ok(ctxIdx !== -1, 'context tier present');
  assert.ok(kwIdx !== -1, 'keyword tier present');
  assert.ok(ctxIdx < kwIdx, 'context tier is ordered before keyword tier (context-first precedence)');
});

check('classifyTriggerTier + readProblemStateEnum are exported helpers', () => {
  assert.strictEqual(typeof sensorTypes.classifyTriggerTier, 'function', 'classifyTriggerTier is a function');
  assert.strictEqual(typeof sensorTypes.readProblemStateEnum, 'function', 'readProblemStateEnum is a function');
});

// ---------------------------------------------------------------------------
// Test 1: a LOCAL problem-state signal -> the CONTEXT tier, preferred over keyword.
// ---------------------------------------------------------------------------
check('Test 1: a LOCAL problem-state signal classifies as the context tier', () => {
  // stage/JTBD/graph-gap read enum/scalar from the tuple+ctx (navigation.cjs
  // populated). A turn that ALSO carries a keyword must still classify context.
  const tuple = { problem_type: 'IDP', stage: 'ill-defined-problem' };
  const ctx = { roomDir: '', jtbd: 'reduce-time-to-decision', graph_gap: 'thin-evidence' };
  const turn = { text: 'we are exploring the defense market' }; // keyword present too

  const ps = sensorTypes.readProblemStateEnum(turn, tuple, ctx);
  assert.ok(ps && typeof ps === 'object', 'readProblemStateEnum returns an object');
  assert.strictEqual(ps.stage, 'ill-defined-problem', 'stage enum carried');
  assert.strictEqual(ps.jtbd, 'reduce-time-to-decision', 'jtbd enum carried');
  assert.strictEqual(ps.graph_gap, 'thin-evidence', 'graph_gap enum carried');

  const tier = sensorTypes.classifyTriggerTier(turn, tuple, ctx);
  assert.strictEqual(tier, 'context', 'a present problem-state signal -> context tier, preferred over keyword');
});

// ---------------------------------------------------------------------------
// Test 2: keyword-only (no problem-state) -> the FALLBACK keyword tier, still fires.
// ---------------------------------------------------------------------------
check('Test 2: keyword-only (no problem-state) classifies as the keyword fallback tier', () => {
  const tuple = {};                 // no stage / problem_type
  const ctx = { roomDir: '' };      // no jtbd / graph_gap / venture_stage
  const turn = { text: 'lets talk about the army drone diffusion question' };

  const tier = sensorTypes.classifyTriggerTier(turn, tuple, ctx);
  assert.strictEqual(tier, 'keyword', 'no problem-state but a keyword present -> keyword fallback tier');

  // The fallback tier still FIRES the diffusion sensor (mode 'keyword').
  const reaches = insightSensors.dispatchSensors(turn, tuple, ctx);
  const diffusion = reaches.find((r) => r && r.evidence && r.evidence.framework === 'adoption-capacity');
  assert.ok(diffusion, 'the keyword-fallback dispatch still fires the diffusion sensor');
  assert.strictEqual(diffusion.evidence.mode, 'keyword', 'the fired reach records mode = keyword (the fallback tier)');
});

// ---------------------------------------------------------------------------
// Test 3: the evidence object carries only enum/scalar, never the matched text.
// ---------------------------------------------------------------------------
check('Test 3: dispatched evidence carries only enum/scalar, never the matched user text (Part 8)', () => {
  const secret = 'project-zephyr-classified-codename';
  const turn = { text: 'the ' + secret + ' army drone program' };
  const tuple = { problem_type: 'WDP' };
  const ctx = { roomDir: '' };

  const reaches = insightSensors.dispatchSensors(turn, tuple, ctx);
  assert.ok(reaches.length > 0, 'at least one reach fired');
  for (const r of reaches) {
    const ev = (r && r.evidence) || {};
    for (const k of Object.keys(ev)) {
      const v = ev[k];
      const t = typeof v;
      assert.ok(t === 'string' || t === 'number' || t === 'boolean', 'evidence value ' + k + ' is enum/scalar');
      if (t === 'string') {
        assert.ok(v.indexOf(secret) === -1, 'evidence value ' + k + ' does not carry the matched user text');
      }
    }
    // The mode enum, when present, is one of the closed tier vocabulary.
    if (Object.prototype.hasOwnProperty.call(ev, 'mode')) {
      assert.ok(sensorTypes.TRIGGER_TIERS.indexOf(ev.mode) !== -1, 'evidence.mode is a member of TRIGGER_TIERS');
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4: the Phase 144 fence -- dispatchSensors never mutates routing_source,
// never calls decide().
// ---------------------------------------------------------------------------
check('Test 4: dispatchSensors never mutates routing_source and never calls decide()', () => {
  const trace = { routing_source: 'legacy' };
  const turn = { text: 'army drone diffusion', routing_source: 'legacy' };
  const tuple = { problem_type: 'IDP', stage: 'ill-defined-problem' };
  const ctx = { roomDir: '', trace: trace };

  const reaches = insightSensors.dispatchSensors(turn, tuple, ctx);
  assert.ok(Array.isArray(reaches), 'dispatchSensors returns an array');
  assert.strictEqual(trace.routing_source, 'legacy', 'routing_source on ctx.trace is untouched');
  assert.strictEqual(turn.routing_source, 'legacy', 'routing_source on turn is untouched');

  // Static guard: the insight-sensors source must not call decide(.
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/insight-sensors.cjs'), 'utf8');
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(stripped.indexOf('decide(') === -1, 'insight-sensors never calls decide(');
  assert.ok(stripped.indexOf("routing_source =") === -1 && stripped.indexOf('routing_source=') === -1,
    'insight-sensors never assigns routing_source');
});

// ---------------------------------------------------------------------------
// Test 5 (Task 2): /mos:systems-thinking is registry-wired (CIRS R1-conformant).
// ---------------------------------------------------------------------------
check('Test 5: /mos:systems-thinking appears in the connector registry with connects_to_spine:true', () => {
  const regPath = path.join(REPO_ROOT, 'data/connector-registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  assert.ok(Array.isArray(reg.connectors), 'registry has a connectors array');
  const st = reg.connectors.find((c) => c && c.surface === '/mos:systems-thinking');
  assert.ok(st, '/mos:systems-thinking is present in the connector registry');
  assert.strictEqual(st.connects_to_spine, true, '/mos:systems-thinking connects_to_spine:true (R1 WIRED)');
});

// ---------------------------------------------------------------------------
// Test 6 (Task 2): the systems model doc covers the six Meadows dimensions.
// ---------------------------------------------------------------------------
check('Test 6: docs/172-SYSTEMS-MODEL.md documents the six Meadows dimensions + the balancing loop', () => {
  const docPath = path.join(REPO_ROOT, 'docs/172-SYSTEMS-MODEL.md');
  assert.ok(fs.existsSync(docPath), 'docs/172-SYSTEMS-MODEL.md exists');
  const doc = fs.readFileSync(docPath, 'utf8').toLowerCase();
  for (const dim of ['stock', 'flow', 'feedback', 'leverage', 'delay', 'hierarchy']) {
    assert.ok(doc.indexOf(dim) !== -1, 'doc covers the ' + dim + ' dimension');
  }
  assert.ok(doc.indexOf('balancing loop') !== -1, 'doc names the balancing loop');
  // No em-dashes (house rule).
  assert.ok(fs.readFileSync(docPath, 'utf8').indexOf('—') === -1, 'no em-dashes in the systems model doc');
});

console.log('');
console.log('Phase 172-07: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
