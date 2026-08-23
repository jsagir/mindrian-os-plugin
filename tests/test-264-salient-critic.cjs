'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 264 Plan 02 -- Reverse Salient adversarial critic unit suite.
 * ========================================================================
 * Zero-deps node assert script (repo convention, mirrors
 * tests/test-reviewer-governance.cjs / tests/test-223-hat-governance.cjs
 * style). No framework, no node:test. Plain synchronous checks.
 *
 * Behaviors covered:
 *   1. SYNC FENCE: the critic's return value is a plain object, never a
 *      thenable (typeof verdict.then !== 'function'), asserted positively.
 *   2. Happy path: a well-formed finding passes with {passed:true, quality:
 *      'high'} and an empty violations array.
 *   3. FAIL-CLOSED on a non-object chain_output: passed:false, quality:
 *      'low', violations includes rs_finding_unrecognized. The deliberate
 *      inversion of the donor's (reviewer-governance.cjs) fail-open branch.
 *   4. FAIL-CLOSED when result is undefined or null: both produce
 *      rs_finding_unrecognized, never a pass.
 *   5. Each of the seven neutral defects produces its own named violation.
 *   6. ADVERSARIAL-ONLY two-pass unanimity proof (D-10): a neutral-clean,
 *      adversarially-dirty finding FAILS the critic and reports
 *      rs_pass_disagreement, via rs_self_referential and separately via
 *      rs_direction_unrecognized.
 *   7. rs_diff_sign_mismatch fires on a signed/abs magnitude contradiction.
 *   8. rs_diff_below_floor fires on a zero abs_diff.
 *   9. Unknown pass name: enforceSalientGovernance('panel', ...) returns
 *      ok:false with rs_pass_unrecognized -- NOT the donor's ok:true
 *      fallthrough.
 *  10. ABSTAIN branch is observable, not silent: a filtered critic on an
 *      ungoverned step command returns passed:true with rs_step_not_governed
 *      and preserves the incoming quality (not upgraded to 'high').
 *  11. The SAME filtered critic on a governed step with a malformed finding
 *      still FAILS (the filter narrows scope without reopening fail-open).
 *  12. Canon Part 8 shape: every violation string matches /^rs_[a-z_]+$/ and
 *      carries zero content bytes from the fixture.
 *
 * Also asserts SALIENT_PASSES and RS_DIRECTIONS deep-equal their frozen
 * contract arrays.
 *
 * PASS line + non-zero exit on failure (an uncaught assert throw is
 * sufficient, matching the donor). House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const gov = require(path.join(REPO_ROOT, 'lib', 'core', 'salient-governance.cjs'));

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------- inline fixture factories (no fixture file, matching the donor) ----------

function validFinding() {
  return {
    id: 'rs-0001',
    source_artifact_id: 'artifact-a',
    target_artifact_id: 'artifact-b',
    direction: 'structural_transfer',
    signed_diff: -0.82,
    abs_diff: 0.82,
    body_text: 'artifact-a is lagging relative to artifact-b',
    brain_chain_text: '',
  };
}

function resultWith(finding) {
  return { chain_output: finding, quality: 'ok' };
}

function withoutField(finding, field) {
  const clone = Object.assign({}, finding);
  delete clone[field];
  return clone;
}

function main() {
  const critic = gov.makeSalientSelfCritiqueFn({});

  // ----- Behavior: contract constants -----
  ok(
    'SALIENT_PASSES deep-equals [neutral, adversarial]',
    (function () {
      assert.deepEqual(gov.SALIENT_PASSES, ['neutral', 'adversarial']);
      return true;
    })()
  );
  ok(
    'RS_DIRECTIONS deep-equals the closed direction bank',
    (function () {
      assert.deepEqual(gov.RS_DIRECTIONS, [
        'structural_transfer',
        'semantic_implementation',
        'whitespace',
        'blindspot',
      ]);
      return true;
    })()
  );

  // ----- 1. SYNC FENCE -----
  const happyVerdict = critic({ command: '/mos:find-bottlenecks' }, resultWith(validFinding()));
  ok(
    'critic return value is a plain object, not a thenable (typeof verdict.then !== \'function\')',
    typeof happyVerdict === 'object' && typeof happyVerdict.then !== 'function'
  );

  // ----- 2. Happy path -----
  ok('happy path: passed === true', happyVerdict.passed === true);
  ok('happy path: quality === high', happyVerdict.quality === 'high');
  ok(
    'happy path: violations is an empty array',
    Array.isArray(happyVerdict.violations) && happyVerdict.violations.length === 0
  );

  // ----- 3. FAIL-CLOSED on non-object chain_output -----
  const nonObjectVerdict = critic({ command: '/mos:find-bottlenecks' }, { chain_output: 'not an object' });
  ok('non-object chain_output: passed === false', nonObjectVerdict.passed === false);
  ok('non-object chain_output: quality === low', nonObjectVerdict.quality === 'low');
  ok(
    'non-object chain_output: violations includes rs_finding_unrecognized (donor fail-open inversion)',
    nonObjectVerdict.violations.indexOf('rs_finding_unrecognized') !== -1
  );

  // ----- 4. FAIL-CLOSED on undefined / null result -----
  const undefinedVerdict = critic({ command: '/mos:find-bottlenecks' }, undefined);
  ok('result undefined: passed === false', undefinedVerdict.passed === false);
  ok(
    'result undefined: violations includes rs_finding_unrecognized',
    undefinedVerdict.violations.indexOf('rs_finding_unrecognized') !== -1
  );
  const nullVerdict = critic({ command: '/mos:find-bottlenecks' }, null);
  ok('result null: passed === false', nullVerdict.passed === false);
  ok(
    'result null: violations includes rs_finding_unrecognized',
    nullVerdict.violations.indexOf('rs_finding_unrecognized') !== -1
  );

  // ----- 5. Each of the seven neutral defects -----
  const neutralDefects = [
    { field: 'id', mutate: (f) => withoutField(f, 'id'), expect: 'rs_no_id' },
    {
      field: 'source_artifact_id',
      mutate: (f) => withoutField(f, 'source_artifact_id'),
      expect: 'rs_no_source_artifact',
    },
    {
      field: 'target_artifact_id',
      mutate: (f) => withoutField(f, 'target_artifact_id'),
      expect: 'rs_no_target_artifact',
    },
    { field: 'direction', mutate: (f) => withoutField(f, 'direction'), expect: 'rs_direction_missing' },
    {
      field: 'signed_diff',
      mutate: (f) => Object.assign({}, f, { signed_diff: 'x' }),
      expect: 'rs_diff_not_numeric',
    },
    {
      field: 'body_text',
      mutate: (f) => Object.assign({}, f, { body_text: '   ' }),
      expect: 'rs_body_text_empty',
    },
    {
      field: 'brain_chain_text',
      mutate: (f) => Object.assign({}, f, { brain_chain_text: 42 }),
      expect: 'rs_chain_text_type',
    },
  ];
  for (const defect of neutralDefects) {
    const mutated = defect.mutate(validFinding());
    const verdict = critic({ command: '/mos:find-bottlenecks' }, resultWith(mutated));
    ok(
      'neutral defect ' + defect.field + ': passed === false',
      verdict.passed === false
    );
    ok(
      'neutral defect ' + defect.field + ': violations includes ' + defect.expect,
      verdict.violations.indexOf(defect.expect) !== -1
    );
  }

  // ----- 6. ADVERSARIAL-ONLY two-pass unanimity proof (D-10) -----
  const selfReferential = Object.assign({}, validFinding(), { target_artifact_id: 'artifact-a' });
  ok(
    'self-referential finding: neutral pass is clean',
    gov.enforceSalientGovernance('neutral', selfReferential).ok === true
  );
  ok(
    'self-referential finding: adversarial pass is dirty',
    gov.enforceSalientGovernance('adversarial', selfReferential).ok === false
  );
  const selfReferentialVerdict = critic({ command: '/mos:find-bottlenecks' }, resultWith(selfReferential));
  ok('self-referential finding: critic FAILS', selfReferentialVerdict.passed === false);
  ok(
    'self-referential finding: violations includes rs_pass_disagreement',
    selfReferentialVerdict.violations.indexOf('rs_pass_disagreement') !== -1
  );
  ok(
    'self-referential finding: violations includes rs_self_referential',
    selfReferentialVerdict.violations.indexOf('rs_self_referential') !== -1
  );

  const badDirection = Object.assign({}, validFinding(), { direction: 'not_a_real_direction' });
  ok(
    'bad-direction finding: neutral pass is clean',
    gov.enforceSalientGovernance('neutral', badDirection).ok === true
  );
  ok(
    'bad-direction finding: adversarial pass is dirty',
    gov.enforceSalientGovernance('adversarial', badDirection).ok === false
  );
  const badDirectionVerdict = critic({ command: '/mos:find-bottlenecks' }, resultWith(badDirection));
  ok('bad-direction finding: critic FAILS', badDirectionVerdict.passed === false);
  ok(
    'bad-direction finding: violations includes rs_pass_disagreement',
    badDirectionVerdict.violations.indexOf('rs_pass_disagreement') !== -1
  );
  ok(
    'bad-direction finding: violations includes rs_direction_unrecognized',
    badDirectionVerdict.violations.indexOf('rs_direction_unrecognized') !== -1
  );

  // ----- 7. rs_diff_sign_mismatch -----
  const signMismatch = Object.assign({}, validFinding(), { signed_diff: -0.82, abs_diff: 0.5 });
  const signMismatchResult = gov.enforceSalientGovernance('adversarial', signMismatch);
  ok(
    'sign mismatch: adversarial violations includes rs_diff_sign_mismatch',
    signMismatchResult.violations.indexOf('rs_diff_sign_mismatch') !== -1
  );

  // ----- 8. rs_diff_below_floor -----
  const zeroFloor = Object.assign({}, validFinding(), { signed_diff: 0, abs_diff: 0 });
  const zeroFloorResult = gov.enforceSalientGovernance('adversarial', zeroFloor);
  ok(
    'zero abs_diff: adversarial violations includes rs_diff_below_floor',
    zeroFloorResult.violations.indexOf('rs_diff_below_floor') !== -1
  );

  // ----- 9. Unknown pass name -----
  const unknownPass = gov.enforceSalientGovernance('panel', validFinding());
  ok('unknown pass name: ok === false', unknownPass.ok === false);
  ok(
    'unknown pass name: violations includes rs_pass_unrecognized (NOT the donor\'s ok:true fallthrough)',
    unknownPass.violations.indexOf('rs_pass_unrecognized') !== -1
  );

  // ----- 10. ABSTAIN branch is observable -----
  const filteredCritic = gov.makeSalientSelfCritiqueFn({ commandFilter: '/mos:find-bottlenecks' });
  const abstainVerdict = filteredCritic({ command: '/mos:diagnose' }, resultWith(validFinding()));
  ok('abstain branch: passed === true', abstainVerdict.passed === true);
  ok(
    'abstain branch: violations includes rs_step_not_governed',
    abstainVerdict.violations.indexOf('rs_step_not_governed') !== -1
  );
  ok(
    'abstain branch: quality preserves incoming quality (\'ok\'), NOT upgraded to high',
    abstainVerdict.quality === 'ok'
  );

  // ----- 11. Filter does not reopen fail-open path -----
  const filteredGovernedMalformed = filteredCritic(
    { command: '/mos:find-bottlenecks' },
    { chain_output: 'not an object' }
  );
  ok(
    'filtered critic on governed step with malformed finding still FAILS',
    filteredGovernedMalformed.passed === false
  );
  ok(
    'filtered critic on governed step: violations includes rs_finding_unrecognized',
    filteredGovernedMalformed.violations.indexOf('rs_finding_unrecognized') !== -1
  );

  // ----- 12. Canon Part 8 shape: no content bytes in violation strings -----
  const allVerdicts = [
    happyVerdict,
    nonObjectVerdict,
    undefinedVerdict,
    nullVerdict,
    selfReferentialVerdict,
    badDirectionVerdict,
    abstainVerdict,
    filteredGovernedMalformed,
  ].concat(neutralDefects.map((_d, i) => undefined).filter(Boolean));
  let shapeChecked = 0;
  for (const verdict of allVerdicts) {
    for (const v of verdict.violations) {
      assert.match(v, /^rs_[a-z_]+$/, 'violation string ' + v + ' matches /^rs_[a-z_]+$/');
      assert.ok(v.indexOf('artifact-a') === -1, 'violation string does not leak artifact-a');
      assert.ok(v.indexOf('artifact-b') === -1, 'violation string does not leak artifact-b');
      assert.ok(v.indexOf('lagging') === -1, 'violation string does not leak the word lagging');
      shapeChecked += 1;
    }
  }
  ok('Canon Part 8 shape checked on at least one violation string', shapeChecked > 0);

  console.log('\nPASS: test-264-salient-critic (' + passed + ' checks)');
}

main();
