#!/usr/bin/env node
'use strict';
// Phase 400.2.1 (S8): the Blue ledger gives the coverage of each sub-question: counts and state names only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const { NO_KEYS } = fx;

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) { queue.push({ label, fn }); }

check('B1. coverage holds one entry for each sub-question with the count of positions, no_position and the state of each reading hat', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await fx.researched({ skip: ['black', 'yellow', 'green'] });
    const ids = fx.ledgerOf(ctx).sub_questions.map(s => s.id);
    assert.ok(ids.length >= 2);
    const run = Object.assign({}, ctx, { ids });
    // white covers every sub-question; red covers the first only; black has no reading file; yellow and green take no position.
    fx.writeReading(run, 'white', fx.readingOf(run, 'white'));
    fx.writeReading(run, 'red', fx.readingOf(run, 'red', { positions: ids.map((id, i) => (i === 0 ? { sub_question: id, value: 'opposes', line: 'red line' } : { sub_question: id, value: 'no_position' })) }));
    fx.writeReading(run, 'yellow', fx.readingOf(run, 'yellow', { positions: ids.map(id => ({ sub_question: id, value: 'no_position' })) }));
    fx.writeReading(run, 'green', fx.readingOf(run, 'green', { positions: ids.map(id => ({ sub_question: id, value: 'no_position' })) }));
    const c = fx.doCheck(run);
    assert.equal(c.ok, true, JSON.stringify(c));
    const blue = JSON.parse(fs.readFileSync(c.blue_ledger, 'utf8'));
    assert.ok(Array.isArray(blue.coverage));
    assert.deepEqual(blue.coverage.map(x => x.sub_question), ids);
    assert.deepEqual(blue.coverage[0], { sub_question: ids[0], positions: 2, no_position: 2, by_hat: { white: 'covered', red: 'covered', black: 'not_run', yellow: 'no_position', green: 'no_position' } });
    assert.deepEqual(blue.coverage[1], { sub_question: ids[1], positions: 1, no_position: 3, by_hat: { white: 'covered', red: 'no_position', black: 'not_run', yellow: 'no_position', green: 'no_position' } });
    // No position value and no line reaches Blue.
    const text = JSON.stringify(blue.coverage);
    for (const banned of ['favours', 'opposes', 'alternative_offered', 'red line', 'white line']) assert.equal(text.includes(banned), false, banned);
  });
});

check('B2. a rejected reading counts as not_run in the coverage', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await fx.researched({ skip: ['black', 'yellow', 'green'] });
    const ids = fx.ledgerOf(ctx).sub_questions.map(s => s.id);
    const run = Object.assign({}, ctx, { ids });
    fx.writeReading(run, 'white', '{not json');
    const c = fx.doCheck(run);
    assert.equal(c.ok, true, JSON.stringify(c));
    const blue = JSON.parse(fs.readFileSync(c.blue_ledger, 'utf8'));
    for (const cov of blue.coverage) {
      assert.equal(cov.by_hat.white, 'not_run');
      assert.equal(cov.positions, 0);
    }
  });
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed += 1; console.log('ok: ' + t.label); } catch (e) { failed += 1; console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e))); }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
