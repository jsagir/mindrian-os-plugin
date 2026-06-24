#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-01: engine owns the decision; the model OBSERVATION schema cannot carry composed state.
// See .planning/phases/177-larry-behavioral-channel/177-SPEC.md:14-23 (the bright line).
//
// This suite asserts the OWNERSHIP invariant: validateObservation passes the ALLOWED
// observation (reframe_cue + confidence + escape_hatch) and REJECTS each forbidden composed
// key (dial, investment_level, reach, fire). The model schema cannot carry composed state.
// It also ties the BCH-03 two-pass doctrine into the gate via a source-scan assert.
//
// Pure node asserts, no deps (the test-bch-14 ok()/failed-counter idiom).

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-01-ownership ---');

const SCHEMA = path.join(ROOT, 'lib/core/behavioral/observation-schema.cjs');
ok(fs.existsSync(SCHEMA), 'lib/core/behavioral/observation-schema.cjs exists (the emit-boundary schema)');

let schema = null;
try {
  schema = require(SCHEMA);
} catch (e) {
  ok(false, 'observation-schema.cjs loads without error (zod resolves): ' + e.message);
}

if (schema) {
  const { validateObservation, ObservationSchema, FORBIDDEN_COMPOSED_KEYS } = schema;

  ok(typeof validateObservation === 'function', 'exports validateObservation(obj)');
  ok(ObservationSchema && typeof ObservationSchema.safeParse === 'function', 'exports a Zod ObservationSchema');
  ok(FORBIDDEN_COMPOSED_KEYS instanceof Set, 'exports FORBIDDEN_COMPOSED_KEYS as a Set');

  // (1) The ALLOWED observation passes: the model may observe, it does not decide.
  const allowed = validateObservation({ reframe_cue: 'solution_no_problem', confidence: 0.8, escape_hatch: true });
  ok(allowed.ok === true, 'ALLOWED observation (reframe_cue + confidence + escape_hatch) passes');

  // (2) Each forbidden composed key is REJECTED when present (the bright line).
  for (const key of ['dial', 'investment_level', 'reach', 'fire']) {
    const r = validateObservation({ [key]: 0.3 });
    ok(r.ok === false, 'forbidden composed key "' + key + '" is REJECTED (engine owns it, not the model)');
    ok(r.ok === false && Array.isArray(r.errors) && r.errors.join(' ').includes(key),
      '  rejection of "' + key + '" names the offending key');
  }

  // (3) FORBIDDEN_COMPOSED_KEYS carries the four composed keys.
  for (const key of ['dial', 'investment_level', 'reach', 'fire']) {
    ok(FORBIDDEN_COMPOSED_KEYS.has(key), 'FORBIDDEN_COMPOSED_KEYS contains "' + key + '"');
  }

  // (4) confidence is bounded to [0,1]: 2 fails, -0.1 fails.
  ok(validateObservation({ confidence: 2 }).ok === false, 'confidence of 2 fails (out of [0,1])');
  ok(validateObservation({ confidence: -0.1 }).ok === false, 'confidence of -0.1 fails (out of [0,1])');
  ok(validateObservation({ confidence: 0.5 }).ok === true, 'confidence of 0.5 passes (in [0,1])');
}

// (5) Source-scan assert: the BCH-03 two-pass doctrine is documented in the prompt.
const PROMPT = path.join(ROOT, 'lib/mcp/larry-server-instructions.md');
const promptSrc = fs.existsSync(PROMPT) ? fs.readFileSync(PROMPT, 'utf8') : '';
ok(/two-pass/.test(promptSrc), 'larry-server-instructions.md documents the two-pass ordering (BCH-03 anchor)');

console.log(failed === 0 ? 'PASS test-bch-01 (engine owns the decision; schema cannot carry composed state)' : ('FAIL test-bch-01 (' + failed + ' assertion(s) failed)'));
process.exit(failed === 0 ? 0 : 1);
