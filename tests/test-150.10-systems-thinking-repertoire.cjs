'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150.10-03 (Piece C, ST-11) -- systems-thinking-loop repertoire + frozen-6 invariant.
 * ==========================================================================================
 * The navigator directive (CONTEXT Piece C, 2026-06-14): the systems-thinking
 * move-selector must live in Larry's reach repertoire as a first-class RANKED
 * sub_mode component, alongside the Phase 148 intelligence set (reverse-salient,
 * whitespace, cross-domain-analogy, cross-domain-connect, dominant-design,
 * six-hats). This suite proves it is registered AND that registering it did NOT
 * move the frozen-6 constitutional reach bank.
 *
 * Mirrors the Phase 148 idiom verbatim in style:
 *   - tests/test-148-component-map.cjs (repertoire resolution via the dispatcher)
 *   - tests/test-148-frozen-contracts.cjs (frozen constants byte-unchanged)
 *
 * Behaviors:
 *   Test 1 (repertoire): dispatcher.resolveArchetype('systems-thinking-loop')
 *     returns a valid archetype that is NOT the default-on-miss 'select' --
 *     proving it is a registered ranked component, not a flat miss.
 *   Test 2 (frozen-6 invariant, the hard one): sensor-types.REACH_IDS has
 *     length === 6 AND equals exactly [context_block, contradiction, cross_room,
 *     brain_consult, deep_research, hats] in order; the orchestrator SKILL.md
 *     reach_ids line is still the frozen 6; systems-thinking-loop is NOT a reach_id.
 *   Test 3 (frozen constants): dial-reach-orchestrator.DIAL_REACH_K === 6,
 *     ranker.MAX_K === 3, orchestrator.RECOMMEND_FLOOR === 0.70,
 *     orchestrator.MARGIN_THRESHOLD === 0.15 -- byte-unchanged.
 *   Test 4 (no-7th-reach in the registry): reach-component-map.json `reaches`
 *     block still has exactly 6 keys equal to the frozen bank; systems-thinking-loop
 *     lives ONLY under `sub_modes`, never under `reaches`.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE: hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const componentMap = require(path.join(REPO_ROOT, 'lib', 'hmi', 'reach-component-map.json'));
const sensorTypes = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));

// The frozen-6 reach bank, in canonical order (Canon Appendix D entry 15).
const FROZEN_SIX = [
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
];

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-150.10-systems-thinking-repertoire.cjs (ST-11): systems-thinking-loop ranked repertoire + frozen-6 invariant');

// ---------------------------------------------------------------------------
// Test 1 -- repertoire: systems-thinking-loop resolves to a non-default archetype.
// ---------------------------------------------------------------------------
check('the dispatcher exposes resolveArchetype', () => {
  assert.equal(typeof dispatcher.resolveArchetype, 'function',
    'ST-11: selector-dispatcher must export resolveArchetype');
});

check('systems-thinking-loop resolves to a VALID archetype that is NOT the default select', () => {
  const arch = dispatcher.resolveArchetype('systems-thinking-loop');
  const VALID = ['select', 'multiSelect', 'ordered', 'group', 'confirm', 'auto', 'text'];
  assert.ok(VALID.indexOf(arch) !== -1,
    'ST-11: systems-thinking-loop archetype must be in the documented vocabulary; got ' + arch);
  assert.notEqual(arch, 'select',
    'ST-11: systems-thinking-loop must NOT resolve to the default-on-miss select ' +
    '(that would prove it is not a registered ranked component)');
});

check('systems-thinking-loop is a sub_mode row carrying a non-default archetype', () => {
  assert.ok(componentMap.sub_modes && typeof componentMap.sub_modes === 'object',
    'ST-11: reach-component-map.json must carry a sub_modes block');
  const row = componentMap.sub_modes['systems-thinking-loop'];
  assert.ok(row && typeof row === 'object',
    'ST-11: systems-thinking-loop must be a row in the sub_modes block');
  assert.equal(typeof row.archetype, 'string',
    'ST-11: the systems-thinking-loop row must declare an archetype');
  assert.notEqual(row.archetype, 'select',
    'ST-11: the systems-thinking-loop row archetype must be non-default');
});

check('systems-thinking-loop ranks as a SIBLING of the Phase 148 intelligence engines', () => {
  // The intelligence-engine sub_modes all carry multiSelect; systems-thinking-loop
  // is an engine-class move-selector ranked next to them, so it shares the archetype.
  const siblings = ['reverse-salient', 'whitespace', 'cross-domain-analogy', 'cross-domain-connect', 'dominant-design'];
  for (const s of siblings) {
    assert.ok(componentMap.sub_modes[s], 'ST-11: expected sibling sub_mode ' + s + ' present');
  }
  assert.equal(dispatcher.resolveArchetype('systems-thinking-loop'), 'multiSelect',
    'ST-11: systems-thinking-loop shares the multiSelect engine-class archetype');
  // reverse-salient is its named sibling (both ride reach_id context_block).
  assert.ok(componentMap.sub_modes['reverse-salient'],
    'ST-11: reverse-salient (the named sibling) must remain in the repertoire undisturbed');
});

// ---------------------------------------------------------------------------
// Test 2 -- the frozen-6 invariant (the hard one). systems-thinking is NOT a 7th reach.
// ---------------------------------------------------------------------------
check('sensor-types.REACH_IDS has length EXACTLY 6', () => {
  assert.ok(Array.isArray(sensorTypes.REACH_IDS),
    'ST-11: REACH_IDS must be an array');
  assert.strictEqual(sensorTypes.REACH_IDS.length, 6,
    'ST-11: REACH_IDS length must be EXACTLY 6 (no 7th reach minted); got ' + sensorTypes.REACH_IDS.length);
});

check('REACH_IDS equals exactly the frozen-6 bank, in canonical order', () => {
  assert.deepStrictEqual(Array.from(sensorTypes.REACH_IDS), FROZEN_SIX,
    'ST-11: REACH_IDS must be byte-equal to the frozen-6 bank in order');
});

check('systems-thinking-loop is NOT present in REACH_IDS (it is a sub_mode, never a reach)', () => {
  assert.equal(sensorTypes.REACH_IDS.indexOf('systems-thinking-loop'), -1,
    'ST-11: systems-thinking-loop must NEVER appear in REACH_IDS');
});

check('the orchestrator SKILL.md reach_ids line is still the frozen 6', () => {
  const skillPath = path.join(REPO_ROOT, 'skills', 'intelligence-orchestrator', 'SKILL.md');
  const src = fs.readFileSync(skillPath, 'utf8');
  // The frozen-6 reach_ids frontmatter line.
  assert.ok(
    src.indexOf('reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research, hats]') !== -1,
    'ST-11: the orchestrator SKILL.md reach_ids line must still declare the frozen 6');
  // systems-thinking-loop must never appear inside that reach_ids declaration.
  assert.ok(
    src.indexOf('reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research, hats, systems-thinking-loop]') === -1,
    'ST-11: systems-thinking-loop must NOT be smuggled into the reach_ids line');
});

// ---------------------------------------------------------------------------
// Test 3 -- frozen constants byte-unchanged (mirrors test-148-frozen-contracts.cjs).
// ---------------------------------------------------------------------------
check('dial-reach-orchestrator.DIAL_REACH_K === 6 (unchanged)', () => {
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6,
    'ST-11: DIAL_REACH_K must stay 6; got ' + orchestrator.DIAL_REACH_K);
});

check('ranker.MAX_K === 3 (unchanged)', () => {
  assert.strictEqual(ranker.MAX_K, 3,
    'ST-11: MAX_K must stay 3; got ' + ranker.MAX_K);
});

check('orchestrator.RECOMMEND_FLOOR === 0.70 (unchanged)', () => {
  assert.strictEqual(orchestrator.RECOMMEND_FLOOR, 0.70,
    'ST-11: RECOMMEND_FLOOR must stay 0.70; got ' + orchestrator.RECOMMEND_FLOOR);
});

check('orchestrator.MARGIN_THRESHOLD === 0.15 (unchanged)', () => {
  assert.strictEqual(orchestrator.MARGIN_THRESHOLD, 0.15,
    'ST-11: MARGIN_THRESHOLD must stay 0.15; got ' + orchestrator.MARGIN_THRESHOLD);
});

check('the two caps stay DISTINCT (DIAL_REACH_K=6 != MAX_K=3)', () => {
  assert.notStrictEqual(orchestrator.DIAL_REACH_K, ranker.MAX_K,
    'ST-11: the dial-preview cap and the chooser cap must remain distinct');
});

// ---------------------------------------------------------------------------
// Test 4 -- no-7th-reach in the registry. systems-thinking-loop lives only under sub_modes.
// ---------------------------------------------------------------------------
check('reach-component-map.json reaches block has exactly 6 keys equal to the frozen bank', () => {
  assert.ok(componentMap.reaches && typeof componentMap.reaches === 'object',
    'ST-11: reach-component-map.json must carry a reaches block');
  const reachKeys = Object.keys(componentMap.reaches);
  assert.strictEqual(reachKeys.length, 6,
    'ST-11: the reaches block must have EXACTLY 6 keys; got ' + reachKeys.length);
  // Same set as the frozen bank (order-independent; the JSON object key order is
  // doctrine order but the set membership is the constitutional property).
  assert.deepStrictEqual(reachKeys.slice().sort(), FROZEN_SIX.slice().sort(),
    'ST-11: the reaches block keys must equal the frozen-6 bank');
});

check('systems-thinking-loop is NOT a key in the reaches block', () => {
  assert.equal(
    Object.prototype.hasOwnProperty.call(componentMap.reaches, 'systems-thinking-loop'),
    false,
    'ST-11: systems-thinking-loop must NEVER appear under reaches (it is a sub_mode)');
});

check('systems-thinking-loop lives ONLY under sub_modes', () => {
  assert.ok(
    Object.prototype.hasOwnProperty.call(componentMap.sub_modes, 'systems-thinking-loop'),
    'ST-11: systems-thinking-loop must be under sub_modes');
  assert.equal(
    Object.prototype.hasOwnProperty.call(componentMap.reaches || {}, 'systems-thinking-loop'),
    false,
    'ST-11: systems-thinking-loop must not also be under reaches');
  assert.equal(
    Object.prototype.hasOwnProperty.call(componentMap.standing_options || {}, 'systems-thinking-loop'),
    false,
    'ST-11: systems-thinking-loop must not also be under standing_options');
});

console.log('');
console.log('PASS test-150.10-systems-thinking-repertoire.cjs (' + passed + ' assertions: ' +
  'systems-thinking-loop ranks as a repertoire sub_mode; REACH_IDS still 6 + byte-unchanged; ' +
  'DIAL_REACH_K=6 / MAX_K=3 / 0.70 / 0.15 unchanged; never a 7th reach)');
process.exit(0);
