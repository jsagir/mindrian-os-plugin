#!/usr/bin/env node
// Quick task 260903-h27 -- gate-card-schema half of T2's write-back design.
// Real behavior: normalizeCard() carries subjectNodeId (string|null) and
// evidenceNodeIds (string[]) on EVERY card, defaulted and never throwing,
// and both fields survive renderGate on all four outcomes (elicitation,
// askuserquestion, text, D-04 suppressed). Task 2 extends this same file
// with call-site coverage for gate_render / chain_run / framework_run /
// buildStopGateCard, plus the repo-level no-write scope floor.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let gateRender;
try {
  gateRender = require('../lib/mcp/gate-render.cjs');
} catch (e) {
  console.log('SKIP: test-h27-gate-card-node-fields -- lib/mcp/gate-render.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasNormalizeCard = typeof gateRender.normalizeCard === 'function';
if (!hasNormalizeCard) {
  console.log('SKIP: test-h27-gate-card-node-fields -- gate-render.cjs present but normalizeCard not exported yet.');
  process.exit(0);
}

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
}

(async () => {
  // -----------------------------------------------------------------------
  // Task 1: normalizeCard() field coverage.
  // -----------------------------------------------------------------------

  // Neither field present: defaults.
  {
    const card = gateRender.normalizeCard({ options: [{ label: 'A' }] });
    check('no fields: subjectNodeId defaults to null', card.subjectNodeId === null);
    check('no fields: evidenceNodeIds defaults to []', Array.isArray(card.evidenceNodeIds) && card.evidenceNodeIds.length === 0);
  }

  // Snake_case input carried verbatim.
  {
    const card = gateRender.normalizeCard({
      options: [{ label: 'A' }],
      subject_node_id: 'n-1',
      evidence_node_ids: ['e-1', 'e-2'],
    });
    check('snake_case subject_node_id carried verbatim', card.subjectNodeId === 'n-1');
    check('snake_case evidence_node_ids carried verbatim', JSON.stringify(card.evidenceNodeIds) === JSON.stringify(['e-1', 'e-2']));
  }

  // CamelCase input carried verbatim.
  {
    const card = gateRender.normalizeCard({
      options: [{ label: 'A' }],
      subjectNodeId: 'n-1',
      evidenceNodeIds: ['e-1'],
    });
    check('camelCase subjectNodeId carried verbatim', card.subjectNodeId === 'n-1');
    check('camelCase evidenceNodeIds carried verbatim', JSON.stringify(card.evidenceNodeIds) === JSON.stringify(['e-1']));
  }

  // Both casings present: snake_case wins (the declared wire key).
  {
    const card = gateRender.normalizeCard({
      options: [{ label: 'A' }],
      subject_node_id: 'snake-wins',
      subjectNodeId: 'camel-loses',
      evidence_node_ids: ['snake-e'],
      evidenceNodeIds: ['camel-e'],
    });
    check('both casings: snake_case subject_node_id wins', card.subjectNodeId === 'snake-wins');
    check('both casings: snake_case evidence_node_ids wins', JSON.stringify(card.evidenceNodeIds) === JSON.stringify(['snake-e']));
  }

  // subject_node_id malformed inputs normalize to null, never throw.
  for (const bad of ['', 0, null, {}, [], true]) {
    const card = gateRender.normalizeCard({ options: [{ label: 'A' }], subject_node_id: bad });
    check('malformed subject_node_id (' + JSON.stringify(bad) + ') normalizes to null', card.subjectNodeId === null);
  }

  // evidence_node_ids non-array inputs normalize to [], never throw.
  for (const bad of ['string', 42, null, {}]) {
    const card = gateRender.normalizeCard({ options: [{ label: 'A' }], evidence_node_ids: bad });
    check('malformed evidence_node_ids (' + JSON.stringify(bad) + ') normalizes to []', Array.isArray(card.evidenceNodeIds) && card.evidenceNodeIds.length === 0);
  }

  // Mixed array: non-strings/empties filtered, duplicates dropped first-wins.
  {
    const card = gateRender.normalizeCard({
      options: [{ label: 'A' }],
      evidence_node_ids: ['e-1', '', 42, null, 'e-2', 'e-1'],
    });
    check('mixed array filters + de-dups to [e-1, e-2]', JSON.stringify(card.evidenceNodeIds) === JSON.stringify(['e-1', 'e-2']));
  }

  // Over-cap array (65+ ids) truncated to 64, never throws.
  {
    const many = [];
    for (let i = 0; i < 70; i += 1) many.push('e-' + i);
    const card = gateRender.normalizeCard({ options: [{ label: 'A' }], evidence_node_ids: many });
    check('over-cap array truncated to 64', card.evidenceNodeIds.length === 64);
    check('over-cap array keeps the FIRST 64 ids', card.evidenceNodeIds[0] === 'e-0' && card.evidenceNodeIds[63] === 'e-63');
  }

  // Returned evidenceNodeIds is a FRESH array, not the caller's array by reference.
  {
    const input = ['e-1', 'e-2'];
    const card = gateRender.normalizeCard({ options: [{ label: 'A' }], evidence_node_ids: input });
    input.push('e-3');
    check('normalized evidenceNodeIds is a fresh array (mutating input after does not mutate the card)', card.evidenceNodeIds.length === 2);
  }

  // Round trip through renderGate on all three rungs plus the D-04 suppressed path.
  {
    const CARD = {
      gate_id: 'gate-h27-roundtrip',
      header: 'Pick one',
      selectMode: 'single',
      subject_node_id: 'n-roundtrip',
      evidence_node_ids: ['e-roundtrip-1', 'e-roundtrip-2'],
      options: [{ id: 'opt-a', label: 'Option A' }],
    };

    const elicitResult = await gateRender.renderGate(CARD, {
      capabilities: { elicitation: true },
      elicitInput: async () => ({ action: 'accept', content: { choice: 'opt-a' } }),
    });
    check('elicitation rung: subjectNodeId survives on result.card', elicitResult.card.subjectNodeId === 'n-roundtrip');
    check('elicitation rung: evidenceNodeIds survives on result.card', JSON.stringify(elicitResult.card.evidenceNodeIds) === JSON.stringify(['e-roundtrip-1', 'e-roundtrip-2']));

    const askResult = await gateRender.renderGate({ ...CARD, gate_id: 'gate-h27-roundtrip-2' }, {
      capabilities: { claudeCode: true },
      simulateAskUserQuestion: async () => ({ chosen: ['Option A'] }),
    });
    check('askuserquestion rung: subjectNodeId survives', askResult.card.subjectNodeId === 'n-roundtrip');
    check('askuserquestion rung: evidenceNodeIds survives', JSON.stringify(askResult.card.evidenceNodeIds) === JSON.stringify(['e-roundtrip-1', 'e-roundtrip-2']));

    const textResult = await gateRender.renderGate({ ...CARD, gate_id: 'gate-h27-roundtrip-3' }, {
      capabilities: {},
      simulateTextReply: async () => '1',
    });
    check('text rung: subjectNodeId survives', textResult.card.subjectNodeId === 'n-roundtrip');
    check('text rung: evidenceNodeIds survives', JSON.stringify(textResult.card.evidenceNodeIds) === JSON.stringify(['e-roundtrip-1', 'e-roundtrip-2']));

    // D-04 suppressed binding path.
    gateRender._resetBindingFiredForTest();
    const bindingCard = {
      gate_id: 'gate-h27-binding-1',
      kind: 'binding',
      ambiguous: true,
      subject_node_id: 'n-binding',
      evidence_node_ids: ['e-binding'],
      options: [{ label: 'Room A' }],
    };
    const first = await gateRender.renderGate(bindingCard, { capabilities: {}, sessionId: 'sess-h27-1' });
    check('D-04 first fire (not suppressed): still carries the fields', first.card.subjectNodeId === 'n-binding' && JSON.stringify(first.card.evidenceNodeIds) === JSON.stringify(['e-binding']));
    const second = await gateRender.renderGate({ ...bindingCard, gate_id: 'gate-h27-binding-2' }, { capabilities: {}, sessionId: 'sess-h27-1' });
    check('D-04 suppressed path: renders no error, still normalizes fields', second.suppressed === true && second.card.subjectNodeId === 'n-binding');
    gateRender._resetBindingFiredForTest();
  }

  // Stop-gate card equivalent: neither field supplied -> defaults, no throw.
  {
    const stopLikeCard = gateRender.normalizeCard({
      kind: 'stop',
      header: 'This turn reached a Decision Gate that has not been answered yet.',
      selectMode: 'single',
      options: [{ label: 'Continue' }, { label: 'Stop and clarify' }],
    });
    check('Stop-gate-shaped card: subjectNodeId defaults to null, no error', stopLikeCard.subjectNodeId === null);
    check('Stop-gate-shaped card: evidenceNodeIds defaults to [], no error', Array.isArray(stopLikeCard.evidenceNodeIds) && stopLikeCard.evidenceNodeIds.length === 0);
  }

  // Scope floor: gate-render.cjs source contains zero occurrences of
  // insertNode, writeEdge, or SOURCED_FROM.
  {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'mcp', 'gate-render.cjs'), 'utf8');
    check('gate-render.cjs contains no insertNode/writeEdge/SOURCED_FROM token', !/insertNode|writeEdge|SOURCED_FROM/.test(src));
  }

  console.log('PASS: test-h27-gate-card-node-fields (' + passed + ' assertions -- Task 1: normalizeCard subjectNodeId/evidenceNodeIds)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-h27-gate-card-node-fields -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
