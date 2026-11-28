#!/usr/bin/env node
'use strict';
// Phase 399-01 Task 2: the two-axis problem type (D-06, I-10). Legs A1 to A8.
// The four-value enum stays a derived compatibility view: A3 pins it to the ambient-framing precedence on the full grid.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// Baseline of the router outputs, copied from the code BEFORE the 399-01 change (A7 additive proof).
const ROUTER_BASELINE = JSON.parse(`{"parse":[{"type":"IDP","confidence":0.8},null,{"type":"unknown","confidence":null},null,{"type":"UDP","confidence":0.3},{"type":"WDP","confidence":null}],"route":[{"recommended_skills":["explore-domains","beautiful-question","whitespace","find-analogies","find-connections"],"suppressed_skills":[],"reason":"Problem is Undefined (UDP confidence 0.90). Surfacing exploration tools.","wicked_override":false},{"recommended_skills":["beautiful-question","structure-argument","mullins","lean-canvas","map-unknowns"],"suppressed_skills":[],"reason":"Problem is Ill-Defined (IDP confidence 0.80). Surfacing definition-seeking tools.","wicked_override":false},{"recommended_skills":["grade","deep-grade","score-innovation","build-thesis","challenge-assumptions"],"suppressed_skills":[],"reason":"Problem is Well-Defined (WDP confidence 0.30). Surfacing execution/validation tools. (low confidence; caller may weight down.)","wicked_override":false},{"recommended_skills":[],"suppressed_skills":[],"reason":"ProblemType classification unavailable; using fallback triangulation.","wicked_override":false},{"recommended_skills":[],"suppressed_skills":[],"reason":"ProblemType classification unavailable; using fallback triangulation.","wicked_override":false},{"recommended_skills":["grade","deep-grade","score-innovation","build-thesis","challenge-assumptions"],"suppressed_skills":[],"reason":"Problem is Well-Defined (WDP confidence n/a). Surfacing execution/validation tools.","wicked_override":false}]}`);
const ROUTER_PARSE_INPUTS = [
  { body: 'type: IDP\nconfidence: 0.8' },
  { body: '(no signal)' },
  { body: 'type: WICKED' },
  null,
  { body: 'type: udp\nconfidence: 0.3' },
  { body: 'type: WDP' },
];
const ROUTER_ROUTE_INPUTS = [['UDP', 0.9], ['IDP', 0.8], ['WDP', 0.3], ['unknown', null], [null, null], ['WDP', undefined]];

const DEFS = ['undefined', 'ill-defined', 'well-defined', null];
const COMPS = ['simple', 'complicated', 'complex', 'wicked', null];

// Oracle: the ambient-framing rungFromExplicitClassification precedence, copied here.
function oracleRung(definition, complexity) {
  if (complexity === 'wicked') return 'Wicked';
  if (definition === 'undefined') return 'UnDefined';
  if (definition === 'ill-defined') return 'IllDefined';
  if (definition === 'well-defined') return 'WellDefined';
  return null;
}

let ax = null;
try {
  ax = require('../lib/core/problem-axes.cjs');
} catch (e) {
  ax = null;
}

check('A1 DEFINITION_LEVELS and CYNEFIN_LEVELS', () => {
  assert.ok(ax, 'lib/core/problem-axes.cjs is missing');
  assert.deepEqual(ax.DEFINITION_LEVELS, ['un-defined', 'ill-defined', 'well-defined']);
  assert.deepEqual(ax.CYNEFIN_LEVELS, ['clear', 'complicated', 'complex', 'chaotic']);
  assert.ok(Object.isFrozen(ax.DEFINITION_LEVELS) && Object.isFrozen(ax.CYNEFIN_LEVELS));
  assert.equal(ax.isDefinitionLevel('ill-defined'), true);
  assert.equal(ax.isDefinitionLevel('undefined'), false);
});

check('A2 fromExplicitClassification over the full grid', () => {
  assert.ok(ax);
  const rating = { simple: 0, complicated: 1, complex: 2, wicked: null, null: null };
  for (const d of DEFS) {
    for (const c of COMPS) {
      const got = ax.fromExplicitClassification({ definition: d, complexity: c });
      const wantLevel = d === 'undefined' ? 'un-defined' : d;
      assert.deepEqual(got, {
        definition_level: wantLevel,
        wickedness: { cynefin_rating: rating[String(c)], wicked: c === 'wicked' ? true : null, source: 'state' },
      }, 'cell ' + d + '/' + c);
    }
  }
});

check('A3 toFourValue(fromExplicitClassification(cell)) equals the ambient-framing precedence on the full grid', () => {
  assert.ok(ax);
  let cells = 0;
  for (const d of DEFS) {
    for (const c of COMPS) {
      assert.equal(ax.toFourValue(ax.fromExplicitClassification({ definition: d, complexity: c })), oracleRung(d, c), 'cell ' + d + '/' + c);
      cells += 1;
    }
  }
  assert.equal(cells, 20);
});

check('A4 fromFourValue and round trip', () => {
  assert.ok(ax);
  assert.deepEqual(ax.fromFourValue('Wicked'), {
    definition_level: 'ill-defined',
    wickedness: { cynefin_rating: null, wicked: true, source: 'four_value' },
  });
  assert.deepEqual(ax.fromFourValue('UnDefined').definition_level, 'un-defined');
  assert.deepEqual(ax.fromFourValue('IllDefined').definition_level, 'ill-defined');
  assert.deepEqual(ax.fromFourValue('WellDefined').definition_level, 'well-defined');
  for (const v of ['UnDefined', 'IllDefined', 'WellDefined']) {
    assert.equal(ax.fromFourValue(v).wickedness.wicked, null, v);
  }
  for (const v of ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']) {
    assert.equal(ax.toFourValue(ax.fromFourValue(v)), v, 'round trip ' + v);
  }
  assert.equal(ax.fromFourValue('nonsense').definition_level, null);
  assert.equal(ax.toFourValue(ax.fromFourValue('nonsense')), null);
});

check('A5 fromPersonaType', () => {
  assert.ok(ax);
  assert.equal(ax.fromPersonaType('UDP').definition_level, 'un-defined');
  assert.equal(ax.fromPersonaType('IDP').definition_level, 'ill-defined');
  assert.equal(ax.fromPersonaType('WDP').definition_level, 'well-defined');
  assert.equal(ax.fromPersonaType('unknown').definition_level, null);
  assert.equal(ax.fromPersonaType('other').definition_level, null);
  assert.equal(ax.fromPersonaType(undefined).definition_level, null);
});

check('A6 readRoomAxes on a scratch room and on a missing STATE.md', () => {
  assert.ok(ax);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axes-399-'));
  try {
    fs.writeFileSync(path.join(dir, 'STATE.md'), '---\ndefinition_level: ill-defined\ncomplexity: wicked\n---\nbody\n');
    const a = ax.readRoomAxes(dir);
    assert.equal(a.definition_level, 'ill-defined');
    assert.equal(a.wickedness.wicked, true);
    assert.equal(ax.toFourValue(a), 'Wicked');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'axes-399-empty-'));
    try {
      assert.deepEqual(ax.readRoomAxes(empty), { definition_level: null, wickedness: { cynefin_rating: null, wicked: null, source: null } });
      assert.deepEqual(ax.readRoomAxes(path.join(empty, 'does-not-exist')), { definition_level: null, wickedness: { cynefin_rating: null, wicked: null, source: null } });
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check('A7 router: axesFromSections is additive and existing outputs are unchanged', () => {
  const router = require('../lib/core/problem-type-router.cjs');
  assert.equal(typeof router.axesFromSections, 'function');
  const hi = router.axesFromSections({ body: 'type: IDP\nconfidence: 0.8' }, { body: 'wicked_score: 9' });
  assert.equal(hi.definition_level, 'ill-defined');
  assert.equal(hi.wickedness.wicked, true);
  assert.equal(hi.wickedness.wicked_score, 9);
  assert.equal(hi.wickedness.source, 'router');
  const lo = router.axesFromSections({ body: 'type: IDP\nconfidence: 0.8' }, { body: 'wicked_score: 3' });
  assert.equal(lo.wickedness.wicked, null);
  assert.equal(lo.wickedness.wicked_score, 3);
  assert.deepEqual(router.axesFromSections(null, null).definition_level, null);
  assert.deepEqual(ROUTER_PARSE_INPUTS.map((x) => router.parseProblemTypeSection(x)), ROUTER_BASELINE.parse);
  assert.deepEqual(ROUTER_ROUTE_INPUTS.map((x) => router.routeByProblemType(...x)), ROUTER_BASELINE.route);
});

check('A8 Brain wire vocabulary, Part 8 guard and brain-router are untouched', () => {
  const out = execFileSync('git', ['diff', '--stat', 'HEAD', '--',
    'data/brain-shape-vocabulary.json', 'lib/core/part8-egress-guard.cjs', 'lib/mcp/brain-router.cjs', 'lib/core/brain-shape-packet.cjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(out.trim(), '');
  const base = execFileSync('git', ['diff', '--stat', '24d5ccb6a', '--',
    'data/brain-shape-vocabulary.json', 'lib/mcp/brain-router.cjs', 'lib/core/brain-shape-packet.cjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(base.trim(), '');
  // re-pinned by quick 261128-a8, 2026-11-28: the guard base moves from 24d5ccb6a to 1a7d6ad46 (accepted: 1a7d6ad46 404-03 Part 8 guard arm for the recipe walk tool, 15 added lines, 0 removed); the vocabulary, brain-router and brain-shape-packet pins stay on 24d5ccb6a.
  const guard = execFileSync('git', ['diff', '--stat', '1a7d6ad46', '--',
    'lib/core/part8-egress-guard.cjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(guard.trim(), '');
  const accepted = execFileSync('git', ['diff', '--numstat', '24d5ccb6a', '1a7d6ad46', '--',
    'lib/core/part8-egress-guard.cjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(accepted.trim(), '15\t0\tlib/core/part8-egress-guard.cjs');
});

if (failed > 0) {
  console.log('>>> test-399-problem-axes.cjs: FAILED (' + failed + ' failed, ' + passed + ' passed)');
  process.exit(1);
}
console.log('>>> test-399-problem-axes.cjs: PASSED');
