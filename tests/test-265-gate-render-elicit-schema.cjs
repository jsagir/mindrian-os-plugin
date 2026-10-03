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
// Six arms: single-select, multi-select, label-not-slug, sdk validation,
// defaulted-schema (Phase 289), answer-identity. Plain Node script, no node:test. Hyphens only.
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

    // The v2 core package exports these schemas at its package root
    // (@modelcontextprotocol/core), so no relative dist path is needed.
    // Plan 267-17 moved this arm off the v1 dist/cjs/types.js file.
    let sdkTypes;
    try {
      sdkTypes = require('@modelcontextprotocol/core');
    } catch (e) {
      fail(arm, 'could not require the v2 core package (@modelcontextprotocol/core)', e.message);
    }

    let singleSchemaZod = sdkTypes.TitledSingleSelectEnumSchemaSchema;
    let multiSchemaZod = sdkTypes.TitledMultiSelectEnumSchemaSchema;
    let usedFallback = false;
    if (!singleSchemaZod || !multiSchemaZod || typeof singleSchemaZod.safeParse !== 'function' || typeof multiSchemaZod.safeParse !== 'function') {
      usedFallback = true;
      singleSchemaZod = sdkTypes.EnumSchemaSchema;
      multiSchemaZod = sdkTypes.EnumSchemaSchema;
      console.log('sdk arm fallback: TitledSingleSelectEnumSchemaSchema/TitledMultiSelectEnumSchemaSchema not reachable from the core package; validating against the EnumSchemaSchema union instead.');
    }

    const singleResult = singleSchemaZod.safeParse(card ? singleSchema.properties.choice : null);
    if (!singleResult.success) fail(arm, 'emitted single-select property failed SDK Zod validation' + (usedFallback ? ' (fallback: EnumSchemaSchema)' : ' (TitledSingleSelectEnumSchemaSchema)'), { value: singleSchema.properties.choice, error: singleResult.error && singleResult.error.message });

    const multiResult = multiSchemaZod.safeParse(multiSchema.properties.choices);
    if (!multiResult.success) fail(arm, 'emitted multi-select property failed SDK Zod validation' + (usedFallback ? ' (fallback: EnumSchemaSchema)' : ' (TitledMultiSelectEnumSchemaSchema)'), { value: multiSchema.properties.choices, error: multiResult.error && multiResult.error.message });

    console.log('PASS: arm sdk -- emitted shapes validate against the vendored SDK Zod schema' + (usedFallback ? ' (via EnumSchemaSchema fallback)' : ' (TitledSingleSelectEnumSchemaSchema / TitledMultiSelectEnumSchemaSchema)'));
  }

  // -----------------------------------------------------------------------
  // Arm 4b: defaulted-schema (Phase 289 ELICIT289-01) -- a ranked
  // single-select card and a flagged multi-select card emit `default` and an
  // instruction title, and both properties still validate against the SDK.
  // -----------------------------------------------------------------------
  {
    const arm = 'defaulted-schema';
    const rankedCard = gateRender.normalizeCard({
      gate_id: 'gate-289-04-ranked',
      header: 'Pick one',
      options: [
        { id: 'second', label: 'Second', rank: 2 },
        { id: 'top', label: 'Top', rank: 1 },
      ],
    });
    const flaggedCard = gateRender.normalizeCard({
      gate_id: 'gate-289-04-flagged',
      header: 'Pick several',
      selectMode: 'multi',
      options: [
        { id: 'a', label: 'Alpha', recommended: true },
        { id: 'b', label: 'Beta', rank: 1 },
        { id: 'c', label: 'Gamma', recommended: true },
      ],
    });
    const choice = buildElicitRequestedSchema(rankedCard).properties.choice;
    const choices = buildElicitRequestedSchema(flaggedCard).properties.choices;
    try {
      assert.strictEqual(choice.default, 'top');
      assert.strictEqual(choice.title, 'Choose: Second / Top');
      assert.deepStrictEqual(choices.default, ['a', 'c']);
      assert.strictEqual(choices.title, 'Choose one or more: Alpha / Beta / Gamma');
    } catch (e) {
      fail(arm, 'default and instruction title must match the card: ' + e.message, { choice: choice, choices: choices });
    }
    const sdkTypes = require('@modelcontextprotocol/core');
    const sr = sdkTypes.TitledSingleSelectEnumSchemaSchema.safeParse(choice);
    if (!sr.success) fail(arm, 'defaulted single-select failed TitledSingleSelectEnumSchemaSchema', { value: choice, error: sr.error && sr.error.message });
    const mr = sdkTypes.TitledMultiSelectEnumSchemaSchema.safeParse(choices);
    if (!mr.success) fail(arm, 'defaulted multi-select failed TitledMultiSelectEnumSchemaSchema', { value: choices, error: mr.error && mr.error.message });
    console.log('PASS: arm defaulted-schema -- default and instruction title emitted, both properties validate against the SDK Zod schemas');
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

  console.log('PASS: test-265-gate-render-elicit-schema (all 6 arms: single-select, multi-select, label-not-slug, sdk, defaulted-schema, answer-identity)');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-265-gate-render-elicit-schema -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
