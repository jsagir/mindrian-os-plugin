'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 192-02 Task 3 -- SEED-021 F.7-max Finding 2 (item 2): the Q2 multiSelect
 * modifier pane riding the SAME card as the Q1 reach chooser.
 * =======================================================================
 *
 * Proves the OPT-IN opts.withModifiers extension to renderDial:
 *   (a) it appends EXACTLY the 3 named modifier items (consult Brain first /
 *       file outcome as decision / open evidence trail) as a multiSelect:true
 *       Q2 on the returned contract;
 *   (b) Q1 (the reach pick) stays SINGLE-select in the same contract -- one
 *       reach per beat is preserved; modifiers decorate the chosen reach, they
 *       never multiply it into N reaches;
 *   (c) NO new typed-edge vocabulary string is introduced anywhere in the
 *       dial-presenter module (Canon Part 4 frozen: Q2 toggles land as
 *       PROPERTIES on the existing SELECTED_REACH decision event, never a new
 *       edge type);
 *   (d) the DEFAULT (no-opts) path returns a contract with NO `modifiers` key
 *       (byte-stability).
 *
 * This is NOT the F.8 canonical shape (no fan-out to N typed edges via
 * navigation.cjs); it is a native AskUserQuestion multiSelect:true parameter on
 * a SECOND question riding the SAME card.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PRESENTER_PATH = path.join(ROOT, 'lib', 'hmi', 'dial-presenter.cjs');
const presenter = require(PRESENTER_PATH);
const orch = require(path.join(ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

const { renderDial } = presenter;

const FULL_SLOTS = {
  topic: 'pricing', topic_a: 'pricing', topic_b: 'CAC',
  room_name: 'synteris', framework: 'SWOT',
};
function stateWith(tierMode, scores) { return { tierMode, reachScores: scores }; }

// The 3 SEED-021 item-2 modifier labels, verbatim (never a 4th, never renamed).
const EXPECTED_MODIFIERS = ['Consult Brain first', 'File outcome as decision', 'Open evidence trail'];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}
function check(name, fn) { try { fn(); ok(name); } catch (e) { fail(name, e); } }

function modeARl() {
  return orch.buildReachList(stateWith('mode_a', {
    context_block: 0.87, contradiction: 0.61, cross_room: 0.54,
    brain_consult: 0.48, deep_research: 0.40, hats: 0.33,
  }));
}

// ---------------------------------------------------------------------------
// (a) opts.withModifiers appends exactly the 3 named items as a multiSelect Q2.
// ---------------------------------------------------------------------------
check('withModifiers: appends exactly the 3 named modifier items as multiSelect:true', () => {
  const out = renderDial(modeARl(), { slotContext: FULL_SLOTS, withModifiers: true });
  const c = out.contract;
  assert.ok(Array.isArray(c.modifiers), 'the contract gains a modifiers array');
  assert.equal(c.modifiers.length, 3, 'exactly 3 modifier items (never a 4th, R7)');
  assert.equal(c.modifiersMultiSelect, true, 'the modifier question is multiSelect:true (Q2)');
  const labels = c.modifiers.map((m) => m.label);
  for (const want of EXPECTED_MODIFIERS) {
    assert.ok(labels.indexOf(want) !== -1, 'the SEED-021 verbatim modifier "' + want + '" is present');
  }
  for (const m of c.modifiers) {
    assert.equal(typeof m.label, 'string', 'each modifier carries a label');
    assert.equal(typeof m.description, 'string', 'each modifier carries a one-line description');
  }
});

// ---------------------------------------------------------------------------
// (b) Q1 stays single-select in the same contract.
// ---------------------------------------------------------------------------
check('withModifiers: Q1 (the reach pick) stays SINGLE-select on the same contract', () => {
  const out = renderDial(modeARl(), { slotContext: FULL_SLOTS, withModifiers: true });
  const c = out.contract;
  assert.notEqual(c.multiSelect, true, 'Q1 is never multiSelect -- one reach per beat is preserved');
  assert.equal(c.shape, 'F.1', 'the base Q1 chooser is still the F.1 shape (same card)');
  assert.equal(c.keyboard, 'askuserquestion', 'the same AskUserQuestion host primitive carries both questions');
});

// ---------------------------------------------------------------------------
// (c) no new typed-edge vocabulary string appears anywhere in the module.
// ---------------------------------------------------------------------------
check('module: introduces NO new typed-edge vocabulary string (Canon Part 4 frozen)', () => {
  const src = fs.readFileSync(PRESENTER_PATH, 'utf8');
  // Q2 toggles land as PROPERTIES on the EXISTING SELECTED_REACH decision event
  // (the frozen Part-4 target -- referenced only as prose here, never written).
  // This render module must mint NO NEW graph edge-type identifier. Any of these
  // OTHER Part-4 edge-vocabulary strings appearing here would be a new write path
  // smuggled into the render layer (the plan's "no new edge vocab over the diff"
  // gate). SELECTED_REACH is deliberately excluded: it is the frozen, pre-existing
  // event whose properties the toggles decorate.
  const NEW_EDGE_VOCAB = [
    'PIVOTED', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPPORTS',
    'REFINES', 'DERIVED_FROM', 'INFORMS', 'RELATES_TO', 'DECIDED',
    'FANOUT', 'MODIFIER_APPLIED', 'recordSelectorMiss',
  ];
  for (const edge of NEW_EDGE_VOCAB) {
    assert.equal(src.indexOf(edge), -1, 'the render module mints no new edge-vocabulary token "' + edge + '"');
  }
  // The module must NOT reach the navigation write chokepoint (no F.8 fan-out to
  // N typed edges); it is render-only, zero graph writes. Target an actual
  // require() import, not a prose mention in the doc comments.
  const REQUIRES_NAV = /require\(\s*['"][^'"]*navigation[^'"]*['"]\s*\)/;
  assert.ok(!REQUIRES_NAV.test(src), 'the render module never requires the navigation write chokepoint');
  // Also: the runtime contract must not smuggle an edge-type field.
  const out = renderDial(modeARl(), { slotContext: FULL_SLOTS, withModifiers: true });
  const keys = Object.keys(out.contract);
  for (const k of keys) {
    assert.ok(!/edge/i.test(k), 'no contract key names an edge type ("' + k + '")');
  }
});

// ---------------------------------------------------------------------------
// (d) the default (no-opts) path returns a contract with no `modifiers` key.
// ---------------------------------------------------------------------------
check('default: no-opts contract has NO modifiers key (byte-stability)', () => {
  const out = renderDial(modeARl(), { slotContext: FULL_SLOTS });
  assert.ok(!Object.prototype.hasOwnProperty.call(out.contract, 'modifiers'),
    'the default contract carries no modifiers key');
  assert.ok(!Object.prototype.hasOwnProperty.call(out.contract, 'modifiersMultiSelect'),
    'the default contract carries no modifiersMultiSelect key');
});

// ---------------------------------------------------------------------------
// Composability: withPreview + withModifiers ride the SAME card together.
// ---------------------------------------------------------------------------
check('compose: withPreview and withModifiers ride one card (previews on Q1, checkboxes on Q2)', () => {
  const out = renderDial(modeARl(), { slotContext: FULL_SLOTS, withPreview: true, withModifiers: true });
  assert.ok(Array.isArray(out.contract.modifiers) && out.contract.modifiers.length === 3,
    'Q2 modifiers present');
  for (const r of out.rows) assert.equal(typeof r.preview, 'string', 'Q1 rows carry previews');
  assert.notEqual(out.contract.multiSelect, true, 'Q1 stays single-select even with previews + modifiers');
});

process.stdout.write('\n');
process.stdout.write('f7max modifier pane (192-02 Task 3): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
