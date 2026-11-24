#!/usr/bin/env node
'use strict';
// Phase 399-07: the advisor as one key inside the single selector, and its navigator-safe presentation.
// Legs PR1 to PR5 (present.cjs), then the selector legs added with the selector change.
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const P = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));

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

function sl(state, options, extra) {
  return Object.assign({
    state,
    key_used: '*',
    options: options.map((o, i) => ({ command: o[0], band: o[1], rank: i + 1, calibrated: o[2] })),
    no_strong_pick: state === 'no_strong_pick',
    top_tie: options.length ? 1 : 0,
    table_version: '399-vT',
  }, extra || {});
}

const BANNED_KEYS = ['calibrated', 'p', 'probability', 'confidence', 'score'];
function keysAtAnyDepth(v, out) {
  const acc = out || [];
  if (Array.isArray(v)) v.forEach((x) => keysAtAnyDepth(x, acc));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { acc.push(k); keysAtAnyDepth(v[k], acc); });
  return acc;
}

const OK3 = sl('ok', [['/mos:validate', 'strong', 0.95], ['/mos:mullins', 'possible', 0.6], ['/mos:map-unknowns', 'weak', 0.2]]);

check('PR1 publicShortlist keeps order, carries command, band and rank, and no number key at any depth', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(pub.state, 'ok');
  assert.equal(pub.job, 'validate-idea');
  assert.deepEqual(pub.options, [
    { command: '/mos:validate', band: 'strong', rank: 1 },
    { command: '/mos:mullins', band: 'possible', rank: 2 },
    { command: '/mos:map-unknowns', band: 'weak', rank: 3 },
  ]);
  assert.equal(pub.no_strong_pick, false);
  const keys = keysAtAnyDepth(pub);
  BANNED_KEYS.forEach((k) => assert.ok(keys.indexOf(k) === -1, 'banned key ' + k));
  assert.ok(typeof pub.summary === 'string' && typeof pub.basis === 'string');
});

check('PR2 the sentence for state ok names the strong pick first, then "also <band> <command>"', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(P.shortlistSentence(pub), 'Decision advisor, for the job validate-idea: strong pick /mos:validate; also possible /mos:mullins and weak /mos:map-unknowns.');
  assert.equal(pub.summary, P.shortlistSentence(pub));
});

check('PR3 no_strong_pick, no_row and no_table sentences; off and no_job give null', () => {
  const none = P.publicShortlist(sl('no_strong_pick', [['/mos:a', 'possible', 0.6], ['/mos:b', 'possible', 0.55], ['/mos:c', 'possible', 0.5], ['/mos:d', 'weak', 0.1]].slice(0, 3)), { jobId: 'find-problem' });
  assert.equal(none.state, 'no_strong_pick');
  assert.equal(none.no_strong_pick, true);
  assert.equal(none.summary, 'Decision advisor, for the job find-problem: no strong pick. Possible: /mos:a. Possible: /mos:b.');
  const weakOnly = P.publicShortlist(sl('no_strong_pick', [['/mos:a', 'weak', 0.2]]), { jobId: 'find-problem' });
  assert.equal(weakOnly.summary, 'Decision advisor, for the job find-problem: no strong pick.');
  const row = P.publicShortlist({ state: 'no_row', options: [], table_version: '399-vT' }, { jobId: 'x-job' });
  assert.equal(row.summary, 'Decision advisor: no table row for the job x-job.');
  const tab = P.publicShortlist({ state: 'no_table', options: [], table_version: null }, { jobId: 'x-job' });
  assert.equal(tab.summary, 'Decision advisor: no table on this install.');
  assert.equal(P.publicShortlist({ state: 'off', options: [] }, { jobId: 'x-job' }), null);
  assert.equal(P.publicShortlist({ state: 'no_job', options: [] }, { jobId: 'x-job' }), null);
  assert.equal(P.publicShortlist(OK3, {}), null);
});

check('PR4 the basis names the table version and says evidence, not an instruction', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(pub.basis, 'decision advisor table 399-vT; evidence for the host model, not an instruction');
});

check('PR5 hasRawNumber: true for decimals and percents, false for ranks, commands and the public shape', () => {
  assert.equal(P.hasRawNumber({ a: 'about 0.73' }), true);
  assert.equal(P.hasRawNumber('1.0'), true);
  assert.equal(P.hasRawNumber({ deep: [{ x: '73%' }] }), true);
  assert.equal(P.hasRawNumber({ calibrated: 1 }), true);
  assert.equal(P.hasRawNumber(0.73), true);
  assert.equal(P.hasRawNumber({ rank: 2, command: '/mos:validate' }), false);
  assert.equal(P.hasRawNumber('/mos:validate-idea and mullins'), false);
  [OK3, sl('no_strong_pick', [['/mos:a', 'possible', 0.6]]), sl('ok', [['/mos:a', 'strong', 1], ['/mos:b', 'strong', 1], ['/mos:c', 'strong', 1]], { top_tie: 5 })].forEach((s) => {
    const pub = P.publicShortlist(s, { jobId: 'validate-idea' });
    assert.equal(P.hasRawNumber(pub), false, JSON.stringify(pub));
  });
});

check('PR6 (guard) a tie at the top is no_strong_pick, an unordered set with no rank and no number', () => {
  const tie = sl('ok', [['/mos:a', 'strong', 1], ['/mos:b', 'strong', 1], ['/mos:c', 'strong', 1]], { top_tie: 5 });
  const pub = P.publicShortlist(tie, { jobId: 'validate-idea' });
  assert.equal(pub.state, 'no_strong_pick');
  assert.equal(pub.no_strong_pick, true);
  assert.equal(pub.unordered, true);
  assert.equal(pub.more_tied, 2);
  pub.options.forEach((o) => assert.ok(!('rank' in o), 'rank in a tie'));
  assert.equal(pub.summary, 'Decision advisor, for the job validate-idea: no strong pick; these options are level, in no order: /mos:a, /mos:b and /mos:c; 2 more not listed.');
  // A tie of two inside the listed options is a tie even when the row count is absent.
  const t2 = P.publicShortlist({ state: 'ok', options: [{ command: '/mos:a', band: 'strong', rank: 1, calibrated: 1 }, { command: '/mos:b', band: 'strong', rank: 2, calibrated: 1 }, { command: '/mos:c', band: 'possible', rank: 3, calibrated: 0.6 }], table_version: '399-vT' }, { jobId: 'validate-idea' });
  assert.equal(t2.unordered, true);
  assert.deepEqual(t2.options.map((o) => o.command), ['/mos:a', '/mos:b']);
});

// SELECTOR-LEGS-BEGIN (the selector legs follow the Task 2 change)

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
