#!/usr/bin/env node
'use strict';

/**
 * Tests for lib/memory/feynman-prompts.cjs.
 * Node built-in assert only. No external frameworks.
 */

const assert = require('node:assert');
const prompts = require('./feynman-prompts.cjs');

const STAGES = [
  'STAGE_1_ESSENCE',
  'STAGE_2_PLAIN_LANGUAGE',
  'STAGE_4_MENTAL_MODEL',
  'STAGE_5_SWEET_SPOT',
];

function scanForDashes(str) {
  const bad = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp === 8212) bad.push({ i, cp, name: 'em-dash' });
    if (cp === 8211) bad.push({ i, cp, name: 'en-dash' });
  }
  return bad;
}

// Module exports exactly the four expected constants.
assert.strictEqual(
  Object.keys(prompts).length,
  4,
  'feynman-prompts should export exactly 4 constants'
);
for (const name of STAGES) {
  assert.ok(name in prompts, 'missing export: ' + name);
}

// Per-constant checks.
for (const name of STAGES) {
  const prompt = prompts[name];

  // Structural.
  assert.strictEqual(
    typeof prompt,
    'string',
    name + ' must be a string'
  );
  assert.ok(prompt.length > 0, name + ' must be non-empty');

  // Placeholders.
  assert.ok(
    prompt.includes('{section_name}'),
    name + ' must contain {section_name} placeholder'
  );
  assert.ok(
    prompt.includes('{artifacts}'),
    name + ' must contain {artifacts} placeholder'
  );

  // Must mention JSON so Claude knows the output contract.
  assert.ok(
    prompt.includes('JSON'),
    name + ' must mention JSON in the output contract'
  );

  // Bounded length.
  assert.ok(
    prompt.length >= 400,
    name + ' too short: ' + prompt.length + ' (min 400)'
  );
  assert.ok(
    prompt.length <= 4000,
    name + ' too long: ' + prompt.length + ' (max 4000)'
  );

  // Zero em-dashes or en-dashes.
  const bad = scanForDashes(prompt);
  assert.strictEqual(
    bad.length,
    0,
    name + ' contains forbidden dash chars: ' + JSON.stringify(bad)
  );
}

// Stages 3 and 6 are deliberately absent (human review gates).
assert.ok(
  !('STAGE_3_EXPOSE_CONFUSION' in prompts),
  'Stage 3 must not be exported (human gate)'
);
assert.ok(
  !('STAGE_6_TEACH_IT_BACK' in prompts),
  'Stage 6 must not be exported (human gate)'
);

process.stdout.write('feynman-prompts.test.cjs: all assertions passed\n');
