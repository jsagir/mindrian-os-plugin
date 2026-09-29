#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 361 Plan 05 Task 1 -- theo-structure reader offline contract tests.
 *
 * Canon Part 8: readDominantDesignStructure sends Theo ONLY the generic
 * handle 'Dominant Design' (D-10), under `framework` for framework_step and
 * framework_techniques and under `framework_name` for case_story (Theo
 * 20.1-04's by-framework path, 361-10), never case_name. It becomes the structure
 * source only when framework_step genuinely returns a runnable step (D-09).
 * Every other outcome -- unreachable, egress blocked, not served, shape
 * refused, refused, threw, or served-with-zero-steps -- degrades to the six
 * phases parsed from references/methodology/dominant-designs.md, and the
 * result names why (D-16). These legs run OFFLINE and deterministic against
 * an injected fake brainClient: zero network.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// --- Test hygiene: no network egress from this test file --------------------
let networkAttempted = false;
globalThis.fetch = function _blockedFetch() {
  networkAttempted = true;
  process.stderr.write('NETWORK_ATTEMPT_361_THEO_STRUCTURE\n');
  throw new Error('NETWORK_ATTEMPT_361_THEO_STRUCTURE: fetch is blocked');
};

const ROOT = path.join(__dirname, '..');
const MOD_PATH = path.join(ROOT, 'lib', 'core', 'dominant-design', 'theo-structure.cjs');
const REFERENCE_PATH = path.join(ROOT, 'references', 'methodology', 'dominant-designs.md');

const theoStructure = require(MOD_PATH);
const { readDominantDesignStructure, classifyCallResult, parseReferencePhases, HANDLE, TOOLS, CALL_ARG_KEY } = theoStructure;

// The exact args each tool must receive (361-10, Theo 20.1-04).
const EXPECTED_ARGS = {
  framework_step: { framework: 'Dominant Design' },
  framework_techniques: { framework: 'Dominant Design' },
  case_story: { framework_name: 'Dominant Design' },
};

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

/**
 * makeFake(map, opts) -> a fake brainClient recording every callTool
 * invocation. `map[tool]` is the scripted return value for that tool.
 * `opts.throwOn` (array of tool names) makes callTool reject for that tool.
 */
function makeFake(map, opts) {
  const cfg = opts || {};
  const calls = [];
  return {
    calls: calls,
    callTool: async function (tool, args) {
      calls.push({ tool: tool, args: args });
      if (Array.isArray(cfg.throwOn) && cfg.throwOn.indexOf(tool) !== -1) {
        throw new Error('fake throw for ' + tool);
      }
      const v = map[tool];
      return typeof v === 'function' ? v() : v;
    },
  };
}

async function main() {
  // ---------- Leg 1+2: generic-handle-only args, exact key set, call order, no opts leakage ----------
  {
    const fake = makeFake({
      framework_step: { rows: [{ name: 'Dominant Design', orchestrationStatus: 'draft', steps: [] }] },
      framework_techniques: { text: 'MCP error -32602: Tool framework_techniques not found' },
      case_story: { text: 'MCP error -32602: Tool case_story not found' },
    });
    const result = await readDominantDesignStructure({ brainClient: fake, domain: 'Acme Robotics secret' });
    assert.strictEqual(fake.calls.length, 3, 'Leg 1: exactly 3 calls made');
    fake.calls.forEach(function (c) {
      assert.deepStrictEqual(c.args, EXPECTED_ARGS[c.tool], 'Leg 1: args is exactly the per-tool generic handle for ' + c.tool);
      assert.strictEqual(Object.keys(c.args).length, 1, 'Leg 1: args has exactly one key for ' + c.tool);
      assert.ok(!Object.prototype.hasOwnProperty.call(c.args, 'case_name'), 'Leg 1: no call ever carries case_name (' + c.tool + ')');
    });
    const serialized = JSON.stringify(fake.calls) + JSON.stringify(result);
    assert.ok(serialized.indexOf('Acme') === -1, 'Leg 1: caller-supplied domain never leaks into args or result');
    assert.deepStrictEqual(
      fake.calls.map(function (c) { return c.tool; }),
      ['framework_step', 'framework_techniques', 'case_story'],
      'Leg 2: call order is framework_step, framework_techniques, case_story'
    );
    ok('Leg 1+2: only the generic handle ever sent (framework, or framework_name for case_story), exactly one key, never case_name, no opts leakage, fixed call order');
  }

  // ---------- Leg 3: all three unreachable -> reference, brain_unavailable, six phases ----------
  {
    const fake = makeFake({ framework_step: null, framework_techniques: null, case_story: null });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.source, 'reference', 'Leg 3: source reference when Theo is fully unreachable');
    assert.strictEqual(result.reason, 'brain_unavailable', 'Leg 3: reason brain_unavailable');
    assert.deepStrictEqual(
      result.reasons,
      { framework_step: 'brain_unavailable', framework_techniques: 'brain_unavailable', case_story: 'brain_unavailable' },
      'Leg 3: reasons object names brain_unavailable for all three tools'
    );
    assert.strictEqual(result.steps.length, 6, 'Leg 3: six reference phases');
    assert.deepStrictEqual(result.steps[0], { id: 'phase-1', name: 'Domain Selection' }, 'Leg 3: phase 1 shape');
    assert.deepStrictEqual(result.steps[5], { id: 'phase-6', name: 'Problems Worth Solving' }, 'Leg 3: phase 6 shape');
    ok('Leg 3: brainClient fully unreachable degrades to the six reference phases, reason brain_unavailable');
  }

  // ---------- Leg 4: today's live Theo shape (D-16) ----------
  {
    const fake = makeFake({
      framework_step: { rows: [{ name: 'Dominant Design', orchestrationStatus: 'draft', steps: [] }], egress_disclosure: { verdict: 'ambiguous' } },
      framework_techniques: { text: 'MCP error -32602: Tool framework_techniques not found', egress_disclosure: { verdict: 'ambiguous' } },
      case_story: { text: 'MCP error -32602: Tool case_story not found', egress_disclosure: { verdict: 'ambiguous' } },
    });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.source, 'reference', 'Leg 4: source reference (served but zero steps degrades)');
    assert.strictEqual(result.reason, 'no_steps_in_canon', 'Leg 4: reason no_steps_in_canon');
    assert.deepStrictEqual(
      result.reasons,
      { framework_step: 'no_steps_in_canon', framework_techniques: 'not_served', case_story: 'not_served' },
      'Leg 4: per-tool reasons match todays live Theo shapes'
    );
    ok('Leg 4: framework_step served-with-zero-steps plus both siblings not-served matches todays live Theo (D-16)');
  }

  // ---------- Leg 5: -32602 without "not found" text is shape_refused, not not_served (T-361-22) ----------
  {
    const fake = makeFake({
      framework_step: null,
      framework_techniques: { text: 'MCP error -32602: Input validation error: unrecognized key' },
      case_story: null,
    });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.reasons.framework_techniques, 'shape_refused', 'Leg 5: -32602 without "not found" text classifies as shape_refused');
    ok('Leg 5: an input-shape refusal never gets misread as tool-not-served (T-361-22)');
  }

  // ---------- Leg 6: egress_blocked, call_threw, refused (refusals key or other error string) ----------
  {
    const fakeA = makeFake({
      framework_step: { error: 'egress_blocked', tool: 'framework_step', egress_class: 'content_set' },
      framework_techniques: null,
      case_story: null,
    });
    const resultA = await readDominantDesignStructure({ brainClient: fakeA });
    assert.strictEqual(resultA.reasons.framework_step, 'egress_blocked', 'Leg 6a: egress_blocked classified');

    const fakeB = makeFake({ framework_step: null, framework_techniques: null, case_story: null }, { throwOn: ['framework_step'] });
    const resultB = await readDominantDesignStructure({ brainClient: fakeB });
    assert.strictEqual(resultB.reasons.framework_step, 'call_threw', 'Leg 6b: a throwing fake classifies as call_threw');
    assert.strictEqual(resultB.source, 'reference', 'Leg 6b: still degrades cleanly, never throws out of the function');

    const fakeC = makeFake({
      framework_step: { refusals: ['policy'] },
      framework_techniques: null,
      case_story: null,
    });
    const resultC = await readDominantDesignStructure({ brainClient: fakeC });
    assert.strictEqual(resultC.reasons.framework_step, 'refused', 'Leg 6c: a refusals key classifies as refused');

    const fakeD = makeFake({
      framework_step: { error: 'some_other_error' },
      framework_techniques: null,
      case_story: null,
    });
    const resultD = await readDominantDesignStructure({ brainClient: fakeD });
    assert.strictEqual(resultD.reasons.framework_step, 'refused', 'Leg 6d: a non-egress error string classifies as refused');
    ok('Leg 6: egress_blocked, call_threw, and refused (refusals key or other error string) all classify correctly, never throw');
  }

  // ---------- Leg 7: Theo served with runnable steps -> source theo, whitelist-mapped fields ----------
  {
    const fake = makeFake({
      framework_step: {
        rows: [{
          name: 'Dominant Design',
          orchestrationStatus: 'published',
          steps: [
            { id: 'step-1', name: 'Domain', extra: 'x' },
            { id: 'step-2', title: 'Identify' },
            { id: 'step-3', name: 'Discontinuity' },
          ],
        }],
      },
      framework_techniques: {
        rows: [
          { name: 'Five Forces', description: 'competitive forces', extra: 'nope' },
          { name: 'SWOT', description: 'strengths/weaknesses' },
        ],
      },
      case_story: {
        title: 'Betamax vs VHS',
        summary: 'format war',
        outcome: 'VHS won on distribution',
        lesson: 'distribution beat picture quality',
        domain: 'consumer video',
        framework: 'Dominant Design',
        grounded: true,
        coverage: { frameworks_with_cases: 3, cases_total: 40 },
      },
    });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.source, 'theo', 'Leg 7: source theo when framework_step returns >= 1 runnable step');
    assert.strictEqual(result.reason, null, 'Leg 7: reason null on the theo path');
    assert.deepStrictEqual(
      result.steps,
      [
        { id: 'step-1', name: 'Domain' },
        { id: 'step-2', name: 'Identify' },
        { id: 'step-3', name: 'Discontinuity' },
      ],
      'Leg 7: steps mapped to {id, name}; name falls back to title; extra fields dropped'
    );
    assert.deepStrictEqual(
      result.techniques,
      [
        { name: 'Five Forces', description: 'competitive forces' },
        { name: 'SWOT', description: 'strengths/weaknesses' },
      ],
      'Leg 7: techniques kept with only name and description'
    );
    assert.deepStrictEqual(
      result.cases,
      [{ title: 'Betamax vs VHS', summary: 'format war', outcome: 'VHS won on distribution' }],
      'Leg 7: cases kept with only title, summary and outcome (lesson, domain, framework, grounded, coverage dropped)'
    );
    assert.strictEqual(result.reasons.case_story, null, 'Leg 7: a grounded Theo 20.1-04 case is served');
    ok('Leg 7: Theo becomes the source with >=1 runnable step; steps/techniques/cases whitelist-mapped, extra fields dropped');
  }

  // ---------- Leg 8: calls entries are {tool, args, outcome, egress_disclosure boolean} ----------
  {
    const fake = makeFake({
      framework_step: { rows: [{ name: 'Dominant Design', steps: [] }], egress_disclosure: { verdict: 'ambiguous' } },
      framework_techniques: { text: 'Tool framework_techniques not found' },
      case_story: null,
    });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.calls.length, 3, 'Leg 8: one calls entry per tool');
    result.calls.forEach(function (c) {
      assert.ok(typeof c.tool === 'string', 'Leg 8: calls entry has a tool string');
      assert.deepStrictEqual(c.args, EXPECTED_ARGS[c.tool], 'Leg 8: calls entry carries the exact per-tool args sent');
      assert.ok(typeof c.outcome === 'string', 'Leg 8: calls entry has an outcome string');
      assert.strictEqual(typeof c.egress_disclosure, 'boolean', 'Leg 8: egress_disclosure is a boolean');
    });
    assert.strictEqual(result.calls[0].egress_disclosure, true, 'Leg 8: egress_disclosure true when the raw result carried the key');
    assert.strictEqual(result.calls[1].egress_disclosure, false, 'Leg 8: egress_disclosure false when the raw result had no such key');
    assert.strictEqual(result.calls[2].egress_disclosure, false, 'Leg 8: egress_disclosure false on a null (brain_unavailable) result');
    ok('Leg 8: every calls entry is {tool, args, outcome, egress_disclosure boolean}, matching the raw result per call');
  }

  // ---------- Leg 9: parseReferencePhases direct legs + unreadable-reference degrade ----------
  {
    const realText = fs.readFileSync(REFERENCE_PATH, 'utf8');
    const phases = parseReferencePhases(realText);
    assert.strictEqual(phases.length, 6, 'Leg 9a: six phases parsed from the real reference file');
    assert.deepStrictEqual(phases[0], { id: 'phase-1', name: 'Domain Selection' }, 'Leg 9a: phase 1');
    assert.deepStrictEqual(phases[5], { id: 'phase-6', name: 'Problems Worth Solving' }, 'Leg 9a: phase 6');

    assert.deepStrictEqual(parseReferencePhases('no headings here\njust text'), [], 'Leg 9b: no headings returns []');
    assert.deepStrictEqual(parseReferencePhases(''), [], 'Leg 9b: empty text returns []');

    const fake = makeFake({ framework_step: null, framework_techniques: null, case_story: null });
    const badPath = path.join(os.tmpdir(), 'mos-361-05-missing-' + process.pid + '.md');
    const result = await readDominantDesignStructure({ brainClient: fake, referencePath: badPath });
    assert.strictEqual(result.source, 'reference', 'Leg 9c: still source reference when the reference file is unreadable');
    assert.deepStrictEqual(result.steps, [], 'Leg 9c: steps empty when the reference cannot be read');
    assert.ok(result.reason.indexOf('reference_unreadable') !== -1, 'Leg 9c: reason names reference_unreadable');
    ok('Leg 9: parseReferencePhases parses the real six phases, returns [] on no headings, and an unreadable reference degrades honestly');
  }

  // ---------- Leg 10: never throws for weird fakes, no network, exports frozen/shaped ----------
  {
    assert.ok(Object.isFrozen(TOOLS), 'Leg 10: TOOLS is frozen');
    assert.deepStrictEqual(TOOLS.slice(), ['framework_step', 'framework_techniques', 'case_story'], 'Leg 10: TOOLS order');
    assert.strictEqual(HANDLE, 'Dominant Design', 'Leg 10: HANDLE constant');
    assert.strictEqual(typeof classifyCallResult, 'function', 'Leg 10: classifyCallResult exported');
    assert.ok(CALL_ARG_KEY && Object.isFrozen(CALL_ARG_KEY), 'Leg 10: CALL_ARG_KEY exported and frozen');
    assert.deepStrictEqual(
      Object.assign({}, CALL_ARG_KEY),
      { framework_step: 'framework', framework_techniques: 'framework', case_story: 'framework_name' },
      'Leg 10: CALL_ARG_KEY maps each tool to its generic-handle key'
    );

    const weirdFakes = [
      { framework_step: undefined, framework_techniques: 42, case_story: 'plain string' },
      { framework_step: [], framework_techniques: { rows: 'not-an-array' }, case_story: { rows: [] } },
    ];
    for (const map of weirdFakes) {
      const fake = makeFake(map);
      let threw = false;
      let result;
      try {
        result = await readDominantDesignStructure({ brainClient: fake });
      } catch (_e) {
        threw = true;
      }
      assert.strictEqual(threw, false, 'Leg 10: never throws for weird fake shapes');
      assert.ok(result && typeof result.source === 'string', 'Leg 10: always returns a shaped result');
    }
    assert.strictEqual(networkAttempted, false, 'Leg 10: no network call was ever attempted');
    ok('Leg 10: exports are frozen/shaped as documented, and the function never throws nor touches the network for any fake shape');
  }

  // ---------- Leg 11: requiring this module opens nothing (no eager brain-client require) ----------
  {
    const before = Object.keys(require.cache).some(function (k) { return k.endsWith('brain-client.cjs'); });
    assert.strictEqual(before, false, 'Leg 11: brain-client.cjs is not in the require cache after requiring theo-structure.cjs alone');
    ok('Leg 11: requiring theo-structure.cjs does not eagerly load brain-client.cjs (lazy require, mirrors taxonomy-climb.cjs)');
  }

  // ---------- Leg 12: case_story grounded:false -> no_case_in_canon, cases [] ----------
  {
    const fake = makeFake({
      framework_step: null,
      framework_techniques: null,
      case_story: {
        grounded: false,
        note: 'the graph returned no illustrating case for the Framework Dominant Design',
        coverage: { frameworks_with_cases: 3, cases_total: 40 },
      },
    });
    const result = await readDominantDesignStructure({ brainClient: fake });
    assert.strictEqual(result.reasons.case_story, 'no_case_in_canon', 'Leg 12: grounded:false classifies as no_case_in_canon');
    assert.deepStrictEqual(result.cases, [], 'Leg 12: no empty case object is presented as a worked case');
    ok('Leg 12: case_story grounded:false is no_case_in_canon with cases [] (never [{}])');
  }

  // ---------- Leg 13: case_story refusals (EXACTLY_ONE_OF, unresolved framework) -> refused ----------
  {
    const fakeA = makeFake({
      framework_step: null,
      framework_techniques: null,
      case_story: { refusals: [{ code: 'EXACTLY_ONE_OF', rule: 'exactly-one-of', detail: 'x' }] },
    });
    const resultA = await readDominantDesignStructure({ brainClient: fakeA });
    assert.strictEqual(resultA.reasons.case_story, 'refused', 'Leg 13a: EXACTLY_ONE_OF refusal classifies as refused');
    assert.deepStrictEqual(resultA.cases, [], 'Leg 13a: cases [] on a refusal');

    const fakeB = makeFake({
      framework_step: null,
      framework_techniques: null,
      case_story: { framework_name: 'Dominant Design', refusals: [{ code: 'FRAMEWORK_NOT_FOUND' }] },
    });
    const resultB = await readDominantDesignStructure({ brainClient: fakeB });
    assert.strictEqual(resultB.reasons.case_story, 'refused', 'Leg 13b: unresolved-framework refusal classifies as refused');
    assert.deepStrictEqual(resultB.cases, [], 'Leg 13b: cases [] on a refusal');
    ok('Leg 13: case_story refusals (EXACTLY_ONE_OF or an unresolved framework) are refused with cases []');
  }

  // ---------- Leg 14: case_story titleless payload -> no_case_in_canon; rows-wrapped case still accepted ----------
  {
    const fakeA = makeFake({
      framework_step: null,
      framework_techniques: null,
      case_story: { coverage: { cases_total: 40 } },
    });
    const resultA = await readDominantDesignStructure({ brainClient: fakeA });
    assert.strictEqual(resultA.reasons.case_story, 'no_case_in_canon', 'Leg 14a: a payload with no case title is no_case_in_canon');
    assert.deepStrictEqual(resultA.cases, [], 'Leg 14a: cases [] for a titleless payload');

    const fakeB = makeFake({
      framework_step: null,
      framework_techniques: null,
      case_story: { rows: [{ title: 'T', grounded: true }] },
    });
    const resultB = await readDominantDesignStructure({ brainClient: fakeB });
    assert.strictEqual(resultB.reasons.case_story, null, 'Leg 14b: a rows-wrapped grounded case is served');
    assert.deepStrictEqual(resultB.cases, [{ title: 'T' }], 'Leg 14b: rows-wrapped case whitelist-mapped');
    ok('Leg 14: a titleless case_story payload is no_case_in_canon; a rows[0]-wrapped case is still accepted defensively');
  }

  console.log('\n' + passed + ' passed');
}

main().catch(function (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
