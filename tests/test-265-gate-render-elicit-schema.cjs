#!/usr/bin/env node
// Phase 265-02 (RADAR-06) -- tripwire for the elicitation schema retrofit.
//
// Task 1 swapped buildElicitRequestedSchema's single-select branch off the
// deprecated LegacyTitledEnumSchemaSchema (enum + enumNames) onto the
// SDK-current TitledSingleSelectEnumSchemaSchema (oneOf of {const,title}),
// and the multi-select branch off items.enum onto items.anyOf of
// {const,title} (TitledMultiSelectEnumSchemaSchema). This test proves that
// swap holds, that the actual user-facing defect (raw slugs on the wire) is
// gone, that the emitted shape validates against the real vendored SDK Zod
// schema (not a hand-written expectation), and that the canonical
// gate_answer payload is untouched.
//
// Five arms: single-select, multi-select, label-not-slug, sdk validation,
// answer-identity. Plain Node script, no node:test. Hyphens only.
'use strict';

const assert = require('node:assert');
const gateRender = require('../lib/mcp/gate-render.cjs');

const { buildElicitRequestedSchema, extractElicitChoice } = gateRender._internal;

function fail(arm, message, value) {
  console.error('FAIL: ' + arm + ' -- ' + message);
  console.error('offending value: ' + JSON.stringify(value, null, 2));
  process.exit(1);
}

const THREE_OPTION_CARD_BASE = {
  gate_id: 'gate-265-02-test',
  header: 'Pick one',
  options: [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
    { id: 'gamma', label: 'Gamma' },
  ],
};

(async () => {
  // -----------------------------------------------------------------------
  // Arm 1: single-select shape
  // -----------------------------------------------------------------------
  {
    const arm = 'single-select';
    const card = gateRender.normalizeCard({ ...THREE_OPTION_CARD_BASE, selectMode: 'single' });
    const schema = buildElicitRequestedSchema(card);
    const choiceProp = schema.properties.choice;

    if (!Array.isArray(choiceProp.oneOf) || choiceProp.oneOf.length !== 3) {
      fail(arm, 'properties.choice.oneOf must be an array of 3 {const,title} objects', choiceProp);
    }
    const expectedOneOf = [
      { const: 'alpha', title: 'Alpha' },
      { const: 'beta', title: 'Beta' },
      { const: 'gamma', title: 'Gamma' },
    ];
    try {
      assert.deepStrictEqual(choiceProp.oneOf, expectedOneOf);
    } catch (e) {
      fail(arm, 'oneOf must equal three {const,title} pairs in option order', choiceProp.oneOf);
    }
    if (choiceProp.enum !== undefined) fail(arm, 'properties.choice.enum must be undefined (legacy shape retired)', choiceProp.enum);
    if (choiceProp.enumNames !== undefined) fail(arm, 'properties.choice.enumNames must be undefined (legacy shape retired)', choiceProp.enumNames);
    try {
      assert.deepStrictEqual(schema.required, ['choice']);
    } catch (e) {
      fail(arm, 'required must be [\'choice\']', schema.required);
    }
    console.log('PASS: arm single-select -- oneOf carries {const,title} triples, no enum/enumNames');
  }

  // -----------------------------------------------------------------------
  // Arm 2: multi-select shape
  // -----------------------------------------------------------------------
  {
    const arm = 'multi-select';
    const card = gateRender.normalizeCard({ ...THREE_OPTION_CARD_BASE, selectMode: 'multi' });
    const schema = buildElicitRequestedSchema(card);
    const choicesProp = schema.properties.choices;

    if (!choicesProp.items || !Array.isArray(choicesProp.items.anyOf) || choicesProp.items.anyOf.length !== 3) {
      fail(arm, 'properties.choices.items.anyOf must be an array of 3 {const,title} objects', choicesProp);
    }
    const expectedAnyOf = [
      { const: 'alpha', title: 'Alpha' },
      { const: 'beta', title: 'Beta' },
      { const: 'gamma', title: 'Gamma' },
    ];
    try {
      assert.deepStrictEqual(choicesProp.items.anyOf, expectedAnyOf);
    } catch (e) {
      fail(arm, 'items.anyOf must equal three {const,title} pairs in option order', choicesProp.items.anyOf);
    }
    if (choicesProp.items.enum !== undefined) fail(arm, 'properties.choices.items.enum must be undefined (legacy shape retired)', choicesProp.items.enum);
    try {
      assert.deepStrictEqual(schema.required, ['choices']);
    } catch (e) {
      fail(arm, 'required must be [\'choices\']', schema.required);
    }
    console.log('PASS: arm multi-select -- items.anyOf carries {const,title} triples, no items.enum');
  }

  // -----------------------------------------------------------------------
  // Arm 3: label-not-slug regression (the actual user-facing defect)
  // -----------------------------------------------------------------------
  {
    const arm = 'label-not-slug';
    // Bare label strings so _normalizeOption mints "whats-next-0" style ids.
    const card = gateRender.normalizeCard({
      gate_id: 'gate-265-02-slug-test',
      header: 'What is next',
      selectMode: 'multi',
      options: ["What's next", 'Something else entirely'],
    });
    const schema = buildElicitRequestedSchema(card);
    const pairs = schema.properties.choices.items.anyOf;
    if (!Array.isArray(pairs) || pairs.length !== 2) fail(arm, 'expected 2 {const,title} pairs', pairs);
    for (const pair of pairs) {
      const matchesOriginalLabel = pair.title === "What's next" || pair.title === 'Something else entirely';
      if (!matchesOriginalLabel) fail(arm, 'emitted title must equal the human label, not a slug', pair);
      if (pair.title === pair.const) fail(arm, 'emitted title must not equal its own const (that would mean the slug leaked as the label)', pair);
    }
    console.log('PASS: arm label-not-slug -- every emitted title is the human label, never the slug const');
  }

  // -----------------------------------------------------------------------
  // Arm 4: SDK validation -- validate the emitted shape against the real
  // vendored Zod schema, not a hand-written expectation.
  // -----------------------------------------------------------------------
  {
    const arm = 'sdk';
    const card = gateRender.normalizeCard({ ...THREE_OPTION_CARD_BASE, selectMode: 'single' });
    const multiCard = gateRender.normalizeCard({ ...THREE_OPTION_CARD_BASE, selectMode: 'multi' });
    const singleSchema = buildElicitRequestedSchema(card);
    const multiSchema = buildElicitRequestedSchema(multiCard);

    // The package's own "exports" map does not expose this subpath, so this
    // reaches the vendored file directly by relative path (same file the
    // plan's read_first cites: node_modules/@modelcontextprotocol/sdk/dist/
    // cjs/types.js), not through the package specifier.
    let sdkTypes;
    try {
      sdkTypes = require('../node_modules/@modelcontextprotocol/sdk/dist/cjs/types.js');
    } catch (e) {
      fail(arm, 'could not require the vendored SDK types module', e.message);
    }

    let singleSchemaZod = sdkTypes.TitledSingleSelectEnumSchemaSchema;
    let multiSchemaZod = sdkTypes.TitledMultiSelectEnumSchemaSchema;
    let usedFallback = false;
    if (!singleSchemaZod || !multiSchemaZod || typeof singleSchemaZod.safeParse !== 'function' || typeof multiSchemaZod.safeParse !== 'function') {
      usedFallback = true;
      singleSchemaZod = sdkTypes.EnumSchemaSchema;
      multiSchemaZod = sdkTypes.EnumSchemaSchema;
      console.log('sdk arm fallback: TitledSingleSelectEnumSchemaSchema/TitledMultiSelectEnumSchemaSchema not reachable from the CJS build; validating against the EnumSchemaSchema union instead.');
    }

    const singleResult = singleSchemaZod.safeParse(card ? singleSchema.properties.choice : null);
    if (!singleResult.success) fail(arm, 'emitted single-select property failed SDK Zod validation' + (usedFallback ? ' (fallback: EnumSchemaSchema)' : ' (TitledSingleSelectEnumSchemaSchema)'), { value: singleSchema.properties.choice, error: singleResult.error && singleResult.error.message });

    const multiResult = multiSchemaZod.safeParse(multiSchema.properties.choices);
    if (!multiResult.success) fail(arm, 'emitted multi-select property failed SDK Zod validation' + (usedFallback ? ' (fallback: EnumSchemaSchema)' : ' (TitledMultiSelectEnumSchemaSchema)'), { value: multiSchema.properties.choices, error: multiResult.error && multiResult.error.message });

    console.log('PASS: arm sdk -- emitted shapes validate against the vendored SDK Zod schema' + (usedFallback ? ' (via EnumSchemaSchema fallback)' : ' (TitledSingleSelectEnumSchemaSchema / TitledMultiSelectEnumSchemaSchema)'));
  }

  // -----------------------------------------------------------------------
  // Arm 5: answer-identity -- the SPEC-4 canonical gate_answer payload is
  // provably unmoved by this retrofit.
  // -----------------------------------------------------------------------
  {
    const arm = 'answer-identity';
    const gateId = 'gate-265-02-answer-test';
    const result = gateRender.normalizeGateAnswer(gateId, ['a'], 'approve');
    try {
      assert.deepStrictEqual(result, { gate_id: gateId, chosen: ['a'], verdict: 'approve' });
    } catch (e) {
      fail(arm, 'normalizeGateAnswer must deep-equal the canonical { gate_id, chosen, verdict } shape', result);
    }
    // Also prove extractElicitChoice still round-trips both wire shapes,
    // since the schema retrofit changes only the OUTBOUND requestedSchema.
    const single = extractElicitChoice({ action: 'accept', content: { choice: 'alpha' } });
    try {
      assert.deepStrictEqual(single, ['alpha']);
    } catch (e) {
      fail(arm, 'extractElicitChoice must still round-trip a single-select accept', single);
    }
    const multi = extractElicitChoice({ action: 'accept', content: { choices: ['alpha', 'beta'] } });
    try {
      assert.deepStrictEqual(multi, ['alpha', 'beta']);
    } catch (e) {
      fail(arm, 'extractElicitChoice must still round-trip a multi-select accept', multi);
    }
    console.log('PASS: arm answer-identity -- canonical gate_answer payload and extractElicitChoice round-trip are unmoved');
  }

  console.log('PASS: test-265-gate-render-elicit-schema (all 5 arms: single-select, multi-select, label-not-slug, sdk, answer-identity)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-265-gate-render-elicit-schema -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
