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

let gateTool;
let chainTool;
let stopGateHandler;
try {
  gateTool = require('../lib/mcp/tools/gate.cjs');
  chainTool = require('../lib/mcp/tools/chain.cjs');
  stopGateHandler = require('../lib/mcp/stop-gate-handler.cjs');
} catch (e) {
  console.log('SKIP: test-h27-gate-card-node-fields -- Task 2 call-site modules not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const { z } = require('zod');

// Minimal fake MCP server, cloned from tests/test-198-contract-schema.test.cjs's
// makeFakeServer -- captures every server.tool(name, description, schema,
// handler) call, mirroring the real McpServer.tool() 4-arg shape, and exposes
// a fake .server.getClientCapabilities() reporting NO elicitation (headless
// text rung, deterministic).
function makeFakeServer() {
  const registered = [];
  return {
    tool(name, description, schemaOrHandler, maybeHandler) {
      let schema = {};
      let handler = schemaOrHandler;
      if (typeof maybeHandler === 'function') {
        schema = schemaOrHandler || {};
        handler = maybeHandler;
      }
      registered.push({ name, description, schema, handler });
    },
    _registered: registered,
    server: {
      getClientCapabilities() { return {}; },
    },
  };
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

  // -----------------------------------------------------------------------
  // Task 2: call-site coverage.
  // -----------------------------------------------------------------------

  // gate_render + chain_run + framework_run each expose both new params as
  // zod schemas: .safeParse accepts absence, rejects a wrong type.
  {
    const gateServer = makeFakeServer();
    gateTool.register(gateServer, {});
    const gateRenderTool = gateServer._registered.find((r) => r.name === 'gate_render');
    check('gate_render tool registered', !!gateRenderTool);
    check('gate_render.subject_node_id is a zod schema', gateRenderTool.schema.subject_node_id && typeof gateRenderTool.schema.subject_node_id.safeParse === 'function');
    check('gate_render.evidence_node_ids is a zod schema', gateRenderTool.schema.evidence_node_ids && typeof gateRenderTool.schema.evidence_node_ids.safeParse === 'function');
    const gateRenderShape = z.object(gateRenderTool.schema);
    check('gate_render schema PARSES with both new params absent', gateRenderShape.safeParse({ options: [{ label: 'A' }] }).success === true);
    check('gate_render schema REJECTS a wrong-typed subject_node_id', gateRenderShape.safeParse({ options: [{ label: 'A' }], subject_node_id: 42 }).success === false);
    check('gate_render schema REJECTS a wrong-typed evidence_node_ids', gateRenderShape.safeParse({ options: [{ label: 'A' }], evidence_node_ids: 'not-an-array' }).success === false);

    const chainServer = makeFakeServer();
    chainTool.register(chainServer, {});
    const chainRunTool = chainServer._registered.find((r) => r.name === 'chain_run');
    check('chain_run tool registered', !!chainRunTool);
    check('chain_run.subject_node_id is a zod schema', chainRunTool.schema.subject_node_id && typeof chainRunTool.schema.subject_node_id.safeParse === 'function');
    check('chain_run.evidence_node_ids is a zod schema', chainRunTool.schema.evidence_node_ids && typeof chainRunTool.schema.evidence_node_ids.safeParse === 'function');
    const chainRunShape = z.object(chainRunTool.schema);
    check('chain_run schema PARSES with both new params absent', chainRunShape.safeParse({ chain: ['x'] }).success === true);
    check('chain_run schema REJECTS a wrong-typed subject_node_id', chainRunShape.safeParse({ chain: ['x'], subject_node_id: 42 }).success === false);
    check('chain_run schema REJECTS a wrong-typed evidence_node_ids', chainRunShape.safeParse({ chain: ['x'], evidence_node_ids: 'not-an-array' }).success === false);

    let sensorsTool;
    try {
      sensorsTool = require('../lib/mcp/tools/sensors.cjs');
    } catch (e) {
      sensorsTool = null;
    }
    if (sensorsTool) {
      const sensorsServer = makeFakeServer();
      sensorsTool.register(sensorsServer, {});
      const frameworkRunTool = sensorsServer._registered.find((r) => r.name === 'framework_run');
      check('framework_run tool registered', !!frameworkRunTool);
      check('framework_run.subject_node_id is a zod schema', frameworkRunTool.schema.subject_node_id && typeof frameworkRunTool.schema.subject_node_id.safeParse === 'function');
      check('framework_run.evidence_node_ids is a zod schema', frameworkRunTool.schema.evidence_node_ids && typeof frameworkRunTool.schema.evidence_node_ids.safeParse === 'function');
      const frameworkRunShape = z.object(frameworkRunTool.schema);
      check('framework_run schema PARSES with both new params absent', frameworkRunShape.safeParse({ chain: ['x'] }).success === true);
      check('framework_run schema REJECTS a wrong-typed subject_node_id', frameworkRunShape.safeParse({ chain: ['x'], subject_node_id: 42 }).success === false);
      check('framework_run schema REJECTS a wrong-typed evidence_node_ids', frameworkRunShape.safeParse({ chain: ['x'], evidence_node_ids: 'not-an-array' }).success === false);
    }

    // A gate_render call carrying both fields mints a ledger entry whose card
    // carries them (reach through _internal._liveGates, the same seam the
    // existing 198 tests use).
    const gateRenderResponse = await gateRenderTool.handler(
      { gate_id: 'gate-h27-callsite', header: 'h', kind: undefined, ambiguous: undefined, select_mode: undefined, options: [{ label: 'A' }], subject_node_id: 'n-callsite', evidence_node_ids: ['e-callsite-1', 'e-callsite-2'] },
      {}
    );
    check('gate_render call handler returns ok:true', JSON.parse(gateRenderResponse.content[0].text).ok === true);
    const livedEntry = gateTool._internal._liveGates.get('gate-h27-callsite');
    check('gate_render mints a live-gate ledger entry', !!livedEntry);
    check('the minted ledger entry card carries subjectNodeId', livedEntry && livedEntry.card && livedEntry.card.subjectNodeId === 'n-callsite');
    check('the minted ledger entry card carries evidenceNodeIds', livedEntry && livedEntry.card && JSON.stringify(livedEntry.card.evidenceNodeIds) === JSON.stringify(['e-callsite-1', 'e-callsite-2']));
    // Clean up the ledger entry so a re-run of this test (same process) does
    // not collide on the fixed gate_id.
    gateTool._internal._liveGates.delete('gate-h27-callsite');
  }

  // _buildMaterialStepCard(step) with no nodeCtx yields null/[] and with one
  // yields the passed values.
  {
    const buildCard = chainTool._internal._buildMaterialStepCard;
    check('_buildMaterialStepCard is exported for direct coverage', typeof buildCard === 'function');
    const stepFixture = { step: 1, framework: 'fixture-framework', command: 'fixture-command' };
    const noCtxCard = buildCard(stepFixture);
    check('_buildMaterialStepCard with no nodeCtx: subject_node_id is null', noCtxCard.subject_node_id === null);
    check('_buildMaterialStepCard with no nodeCtx: evidence_node_ids is []', Array.isArray(noCtxCard.evidence_node_ids) && noCtxCard.evidence_node_ids.length === 0);
    const withCtxCard = buildCard(stepFixture, { subjectNodeId: 'n-step', evidenceNodeIds: ['e-step-1'] });
    check('_buildMaterialStepCard with nodeCtx: subject_node_id carried', withCtxCard.subject_node_id === 'n-step');
    check('_buildMaterialStepCard with nodeCtx: evidence_node_ids carried', JSON.stringify(withCtxCard.evidence_node_ids) === JSON.stringify(['e-step-1']));
  }

  // buildStopGateCard(turn) run through normalizeCard yields null/[] and
  // never throws.
  {
    const turn = { output_text: 'Some prior turn output with no option boxes.' };
    let stopCard;
    let threw = false;
    try {
      stopCard = gateRender.normalizeCard(stopGateHandler.buildStopGateCard(turn));
    } catch (_e) {
      threw = true;
    }
    check('buildStopGateCard -> normalizeCard never throws', threw === false);
    check('buildStopGateCard -> normalizeCard: subjectNodeId defaults to null', stopCard && stopCard.subjectNodeId === null);
    check('buildStopGateCard -> normalizeCard: evidenceNodeIds defaults to []', stopCard && Array.isArray(stopCard.evidenceNodeIds) && stopCard.evidenceNodeIds.length === 0);
  }

  // Repo-level scope floor: at the time this quick task (260903-h27) shipped
  // the gate-card-SCHEMA half, none of these lib/mcp files were expected to
  // carry the node-WRITING half's own tokens yet -- that half was filed and
  // deliberately deferred (see CLAUDE.md's open-handoff row at the time).
  // Quick task 260903-i2x then shipped exactly that node-writing half and
  // wired lib/mcp/tools/gate.cjs's gate_answer approve branch to
  // navigation.writeReasoningNode -- gate.cjs is REMOVED from this floor
  // list for that reason (a real, planned, ratified change, not scope
  // creep). The floor stays live for the four files this task's own DC-2 /
  // DC-3 findings say must stay untouched: gate-render.cjs (schema-only,
  // never a node writer), chain.cjs (DC-2: haltedStep.framework was already
  // threaded, no edit needed), sensors.cjs (DC-3: mints no gate-ledger
  // entry, its USES_FRAMEWORK edge is structurally unreachable, named
  // deliberate follow-up), and stop-gate-handler.cjs (not node-scoped).
  {
    const touchedFiles = [
      'lib/mcp/gate-render.cjs',
      'lib/mcp/tools/chain.cjs',
      'lib/mcp/tools/sensors.cjs',
      'lib/mcp/stop-gate-handler.cjs',
    ];
    for (const rel of touchedFiles) {
      const src = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
      check(rel + ' contains no insertNode/writeEdge/SOURCED_FROM token', !/insertNode|writeEdge|SOURCED_FROM/.test(src));
    }
  }

  console.log('PASS: test-h27-gate-card-node-fields (' + passed + ' assertions -- Task 1: normalizeCard subjectNodeId/evidenceNodeIds; Task 2: call-site coverage)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-h27-gate-card-node-fields -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
