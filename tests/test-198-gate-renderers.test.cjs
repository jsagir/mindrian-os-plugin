#!/usr/bin/env node
// Phase 198 SPEC-4 -- gate superset schema with the renderer ladder. Real
// behavior: the SAME gate_render payload renders end-to-end through all three
// rungs -- (a) MCP elicitation on a client that declares the capability, (b)
// canUseTool/AskUserQuestion via the thin adapter inside Claude Code, (c)
// structured-text fallback for headless clients -- and all three answers
// arrive as identical gate_answer payloads. This is the SPEC-4 acceptance.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

let gateRender;
try {
  gateRender = require('../lib/mcp/gate-render.cjs');
} catch (e) {
  console.log('SKIP: test-198-gate-renderers -- lib/mcp/gate-render.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasRenderApi = typeof gateRender.renderGate === 'function';
if (!hasRenderApi) {
  console.log('SKIP: test-198-gate-renderers -- gate-render.cjs present but renderGate not exported yet.');
  process.exit(0);
}

(async () => {
  // -----------------------------------------------------------------------
  // Check 1: pickRenderer ladder detection (elicitation > claudeCode > text)
  // -----------------------------------------------------------------------
  assert.strictEqual(gateRender.pickRenderer({ elicitation: true }), 'elicitation', 'elicitation-declared picks elicitation');
  assert.strictEqual(gateRender.pickRenderer({ claudeCode: true }), 'askuserquestion', 'Claude Code surface picks askuserquestion');
  assert.strictEqual(gateRender.pickRenderer({}), 'text', 'headless picks text');
  // elicitation wins over claudeCode when both are somehow set (ladder order)
  assert.strictEqual(gateRender.pickRenderer({ elicitation: true, claudeCode: true }), 'elicitation', 'elicitation outranks claudeCode');

  // -----------------------------------------------------------------------
  // Check 2: ONE gate spec, rendered through all THREE rungs, simulating the
  // SAME fixed user choice (option 'opt-b'). The three resulting gate_answer
  // payloads MUST be byte-identical -- the SPEC-4 acceptance bar.
  // -----------------------------------------------------------------------
  const CARD = {
    gate_id: 'gate-test-spec4',
    header: 'Pick one',
    selectMode: 'single',
    options: [
      { id: 'opt-a', label: 'Option A', description: 'the first choice', rank: 1, preview: 'preview A' },
      { id: 'opt-b', label: 'Option B', description: 'the second choice', rank: 2, preview: 'preview B' },
    ],
  };

  // Rung (a): elicitation. Lossy on the wire -- assert the requestedSchema
  // carries the SDK-current titled oneOf shape (per-option const + title
  // only, via TitledSingleSelectEnumSchemaSchema), no per-option description.
  // Phase 265-02 (RADAR-06) retired the legacy enum/enumNames shape this
  // check used to assert; see tests/test-265-gate-render-elicit-schema.cjs
  // for the dedicated tripwire on the new shape.
  const elicitResult = await gateRender.renderGate(CARD, {
    capabilities: { elicitation: true },
    elicitInput: async (params) => {
      assert.ok(params && params.requestedSchema, 'elicitInput receives a requestedSchema');
      const schema = params.requestedSchema.properties.choice;
      assert.deepStrictEqual(schema.oneOf, [
        { const: 'opt-a', title: 'Option A' },
        { const: 'opt-b', title: 'Option B' },
      ], 'requestedSchema oneOf carries per-option const + title (SDK-current titled shape)');
      assert.strictEqual(schema.enum, undefined, 'requestedSchema no longer carries the legacy enum key');
      assert.strictEqual(schema.enumNames, undefined, 'requestedSchema no longer carries the legacy enumNames key');
      assert.strictEqual(schema.description, undefined, 'requestedSchema carries NO per-option description (lossy rung, Pitfall 4)');
      return { action: 'accept', content: { choice: 'opt-b' } };
    },
  });
  assert.strictEqual(elicitResult.renderer, 'elicitation');
  assert.ok(elicitResult.answer, 'elicitation rung produced an answer');

  // Rung (b): AskUserQuestion thin adapter inside Claude Code. Assert the
  // composed card carries the FULL superset metadata (not lossy) via
  // superset_options, and reuses the shipped F.8 envelope (contract.shape).
  const askResult = await gateRender.renderGate(CARD, {
    capabilities: { claudeCode: true },
    simulateAskUserQuestion: async (rendered) => {
      assert.strictEqual(rendered.contract.shape, 'F.8', 'rung (b) reuses the shipped F.8 envelope');
      assert.ok(Array.isArray(rendered.contract.superset_options), 'rung (b) carries the full superset_options (not lossy)');
      const optB = rendered.contract.superset_options.find((o) => o.id === 'opt-b');
      assert.strictEqual(optB.description, 'the second choice', 'rung (b) preserves per-option description');
      // simulate the SAME user choice as rung (a): Option B
      return { chosen: ['Option B'] };
    },
  });
  assert.strictEqual(askResult.renderer, 'askuserquestion');
  assert.ok(askResult.answer, 'askuserquestion rung produced an answer');

  // Rung (c): headless structured text. Simulate the SAME user choice by
  // replying with the option's 1-based position (2 = Option B).
  const textResult = await gateRender.renderGate(CARD, {
    capabilities: {},
    simulateTextReply: async (rendered) => {
      assert.ok(rendered.zones && typeof rendered.zones.body === 'string', 'rung (c) emits a structured-text body');
      assert.ok(rendered.zones.body.indexOf('Option B') !== -1, 'rung (c) body lists the option label');
      return '2';
    },
  });
  assert.strictEqual(textResult.renderer, 'text');
  assert.ok(textResult.answer, 'text rung produced an answer');

  // The SPEC-4 acceptance: all three gate_answer payloads are byte-identical.
  const a1 = JSON.stringify(elicitResult.answer);
  const a2 = JSON.stringify(askResult.answer);
  const a3 = JSON.stringify(textResult.answer);
  assert.strictEqual(a1, a2, 'elicitation and askuserquestion produce identical gate_answer payloads');
  assert.strictEqual(a2, a3, 'askuserquestion and text produce identical gate_answer payloads');
  assert.deepStrictEqual(elicitResult.answer, { gate_id: 'gate-test-spec4', chosen: ['opt-b'], verdict: 'approve' },
    'the canonical gate_answer shape is { gate_id, chosen, verdict }');

  // -----------------------------------------------------------------------
  // Check 3: D-04 F.8 binding-card discipline -- fires ONCE per session on
  // genuine ambiguity only.
  // -----------------------------------------------------------------------
  gateRender._resetBindingFiredForTest();
  const bindingCard = { gate_id: 'gate-binding-1', kind: 'binding', ambiguous: true, options: [{ label: 'Room A' }, { label: 'Room B' }] };
  const first = await gateRender.renderGate(bindingCard, { capabilities: {}, sessionId: 'sess-1' });
  assert.strictEqual(first.suppressed, false, 'a genuinely ambiguous binding card fires the first time');
  const second = await gateRender.renderGate({ ...bindingCard, gate_id: 'gate-binding-2' }, { capabilities: {}, sessionId: 'sess-1' });
  assert.strictEqual(second.suppressed, true, 'the SAME session does not see a second binding card');
  const otherSession = await gateRender.renderGate({ ...bindingCard, gate_id: 'gate-binding-3' }, { capabilities: {}, sessionId: 'sess-2' });
  assert.strictEqual(otherSession.suppressed, false, 'a DIFFERENT session still gets its own first binding card');
  const unambiguous = await gateRender.renderGate({ ...bindingCard, gate_id: 'gate-binding-4', ambiguous: false }, { capabilities: {}, sessionId: 'sess-3' });
  assert.strictEqual(unambiguous.suppressed, true, 'an unambiguous binding context never fires');
  gateRender._resetBindingFiredForTest();

  // -----------------------------------------------------------------------
  // Check 4 (Phase 369 plan 27, SHELL369-10): the web gate button and the CLI card are two renders of ONE contract.
  // One fixture card goes through rung (b) and through the web mapping (ui/shell/client/views/gate/gate-model.ts,
  // imported as the real module: a CJS twin is not allowed). The option ids, labels, order and the recommended id
  // must agree, and the gate_answer payload for the recommended choice must be identical from both. The contract
  // field names and MCP tool names the web button reads are pinned here (the folded registry-drift todo): a rename
  // of any of them fails this check, not a browser.
  // -----------------------------------------------------------------------
  const fs = require('node:fs');
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '369', 'gate-superset-card.json'), 'utf8'));
  const webModel = await import(pathToFileURL(path.join(__dirname, '..', 'ui', 'shell', 'client', 'views', 'gate', 'gate-model.ts')).href);

  const cliCard = await gateRender.renderGate(FIXTURE, { capabilities: { claudeCode: true } });
  assert.strictEqual(cliCard.renderer, 'askuserquestion', 'the fixture renders through rung (b)');
  const contract = cliCard.rendered.contract;

  // The pinned names: every field the web button reads exists in the live contract under that exact name.
  const READS = {
    contractFields: [webModel.CONTRACT_FIELDS.superset, webModel.CONTRACT_FIELDS.recommended, webModel.CONTRACT_FIELDS.notice, webModel.CONTRACT_FIELDS.selectMode],
    optionFields: webModel.CONTRACT_FIELDS.optionKeys,
    cardFields: webModel.CARD_FIELDS,
    tools: webModel.MCP_TOOLS,
  };
  assert.deepStrictEqual(READS.contractFields, ['superset_options', 'recommended', 'notice', 'multiSelect'], 'the contract field names the web button reads');
  assert.deepStrictEqual(READS.optionFields, ['id', 'label', 'description', 'rank', 'preview'], 'the option field names the web button reads');
  assert.deepStrictEqual(READS.cardFields, ['header', 'kind', 'select_mode', 'notice', 'approve_label', 'subject_node_id', 'evidence_node_ids'], 'the card field names the web button reads');
  assert.deepStrictEqual(READS.tools, { render: 'gate_render', answer: 'gate_answer' }, 'the MCP tool names the web button reads');
  for (const f of READS.contractFields) assert.ok(Object.prototype.hasOwnProperty.call(contract, f), 'live contract carries ' + f);
  for (const o of contract.superset_options) {
    for (const f of READS.optionFields) assert.ok(Object.prototype.hasOwnProperty.call(o, f), 'live superset option carries ' + f);
    assert.ok(Object.prototype.hasOwnProperty.call(o, 'recommended'), 'live superset option carries the per-row recommended boolean');
  }
  const gateSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'gate.cjs'), 'utf8');
  for (const tool of Object.values(READS.tools)) assert.ok(gateSrc.indexOf("'" + tool + "'") !== -1, 'gate.cjs registers the tool ' + tool);
  const normalized = gateRender.normalizeCard(FIXTURE);
  assert.strictEqual(normalized.header, FIXTURE.header, 'the card field header survives normalizeCard');
  assert.strictEqual(normalized.subjectNodeId, FIXTURE.subject_node_id, 'subject_node_id is read by normalizeCard');
  assert.deepStrictEqual(normalized.evidenceNodeIds, FIXTURE.evidence_node_ids, 'evidence_node_ids is read by normalizeCard');
  assert.strictEqual(normalized.notice, FIXTURE.notice, 'notice is read by normalizeCard');
  assert.ok(gateSrc.indexOf('selectMode: select_mode') !== -1, 'the gate_render tool maps its select_mode input onto the card selectMode');
  assert.strictEqual(normalized.selectMode, 'single', 'a card with no multi flag is single-select');
  assert.strictEqual(normalized.options.find((o) => o.id === 'approve').label, FIXTURE.approve_label, 'approve_label relabels the approve option');

  const webView = webModel.toGateViewModel(FIXTURE, cliCard.rendered);
  assert.deepStrictEqual(webView.options.map((o) => o.id), contract.superset_options.map((o) => o.id), 'same option ids in the same order');
  assert.deepStrictEqual(webView.options.map((o) => o.label), contract.superset_options.map((o) => o.label), 'same option labels');
  assert.deepStrictEqual(webView.options.map((o) => o.description), contract.superset_options.map((o) => o.description || ''), 'same option descriptions');
  assert.strictEqual(webView.recommendedId, contract.recommended, 'the recommended id agrees between the CLI card and the web view');
  assert.strictEqual(webView.recommendedId, 'approve', 'the recommended id is the one the fixture flags');
  assert.deepStrictEqual(webView.preselected, [contract.recommended], 'the web view preselects the contract recommendation');
  assert.strictEqual(webView.notice, contract.notice, 'the notice reaches both renders unchanged');
  assert.deepStrictEqual(webView.evidenceIds, FIXTURE.evidence_node_ids, 'the evidence ids reach the web view');
  assert.strictEqual(webView.options.filter((o) => o.recommended).length, 1, 'at most one recommended option');

  // The same choice, the same gate_answer payload, from the CLI card and the web button.
  const webAnswer = gateRender.normalizeGateAnswer(FIXTURE.gate_id, webModel.chosenFor(webView, 'approve', webView.preselected), 'approve');
  assert.strictEqual(cliCard.answer, null, 'rung (b) with no responder produces no answer by itself');
  const cliAnswer = (await gateRender.renderGate(FIXTURE, {
    capabilities: { claudeCode: true },
    simulateAskUserQuestion: async () => ({ chosen: [contract.recommended] }),
  })).answer;
  assert.deepStrictEqual(webAnswer, cliAnswer, 'the gate_answer payload for the recommended choice is identical from both');
  assert.deepStrictEqual(webAnswer, { gate_id: FIXTURE.gate_id, chosen: ['approve'], verdict: 'approve' });

  console.log('PASS: test-198-gate-renderers (SPEC-4: one gate, three renderers, three identical gate_answer payloads)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-198-gate-renderers -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
