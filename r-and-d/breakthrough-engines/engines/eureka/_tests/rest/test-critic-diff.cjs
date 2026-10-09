'use strict';
// Differential test: ORIGINAL vs 2026 critic must agree on default-option behaviour.
const path = require('node:path');
const S = require('./_stubs.cjs');
const pkg = path.join(__dirname, '../..');
const orig = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/eureka-critic.cjs'));
const neu = require(path.join(pkg, 'lib/core/eureka-critic.cjs'));
const check = S.check;
(async function () {
  const cands = [
    { mechanismText: 'Kalman filter at NASA estimates state; Heimlich maneuver at Mercy clears airway 5mg', mappingStatement: 'map' },
    { mechanismText: '', mappingStatement: '' },
    { mechanismText: 'a'.repeat(100), claim: 'c' },
  ];
  cands.forEach(function (c, i) {
    check('neutral prompt identical #' + i, orig.buildNeutralPrompt(c) === neu.buildNeutralPrompt(c));
    check('adversarial prompt identical #' + i, orig.buildAdversarialPrompt(c) === neu.buildAdversarialPrompt(c));
  });
  const judges = [
    function () { return { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }; },
    function (p) { return /Argue this/.test(p) ? { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1 } : { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }; },
    function () { return '- (a) yes\n- (b) no\n- (c) yes\n- (d) no\n- (e) yes\n- (f) yes'; },
    function () { return { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }; },
  ];
  for (let j = 0; j < judges.length; j += 1) {
    const a = await orig.runRubric(cands[0], { judgeFn: judges[j] });
    const b = await neu.runRubric(cands[0], { judgeFn: judges[j] });
    ['rubric_pattern', 'disagreement', 'calls', 'verdict', 'reasoning_tag'].forEach(function (k) {
      check('runRubric ' + k + ' judge' + j, a[k] === b[k], a[k] + ' vs ' + b[k]);
    });
    check('runRubric items equal judge' + j, JSON.stringify(a.items) === JSON.stringify(b.items));
  }
  // exhaustive verdict table over all 64 item combos
  let same = 0;
  for (let m = 0; m < 64; m += 1) {
    const it = {}; 'abcdef'.split('').forEach(function (k, i) { it[k] = !!(m & (1 << i)); });
    if (orig.verdictFromRubric(it) === neu.verdictFromRubric(it)) same += 1;
  }
  check('verdictFromRubric identical on all 64 combos', same === 64);
  // stageA on cases that do not touch the changed behaviours
  const mech = 'The Kalman filter at NASA tracks Apollo trajectories while the Heimlich maneuver clears obstruction airway pressure';
  const sa = [{ text: 'costs $5B', mechanismText: mech }, { text: 'plain', mechanismText: mech }];
  for (let i = 0; i < sa.length; i += 1) {
    const a = await orig.stageA(sa[i], {}); const b = await neu.stageA(sa[i], {});
    check('stageA identical #' + i, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) + ' vs ' + JSON.stringify(b));
  }
  // documented differences
  const d1 = await orig.stageA({ text: 'plain', mechanismText: 'revenue 3B valve' }, {});
  const d2 = await neu.stageA({ text: 'plain', mechanismText: 'revenue 3B valve' }, {});
  check('documented diff: mechanism-only quantity (orig passes gate1, new flags)', d1.route !== 'pseudoscience' && d2.route === 'pseudoscience');
  const e1 = await orig.classifyCandidate({ text: 'x', mechanismText: mech }, { _forceUnavailable: true });
  const e2 = await neu.classifyCandidate({ text: 'x', mechanismText: mech }, { _forceUnavailable: true });
  check('documented diff: degraded confidence orig high -> new unknown', e1.confidence === 'high' && e2.confidence === 'unknown');
  S.done('test-critic-diff');
})();
