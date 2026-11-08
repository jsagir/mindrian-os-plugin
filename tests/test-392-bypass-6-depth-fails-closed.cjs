#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-05, Task 2 (bypass 6 of F6): carriesEdgeOrBody must fail closed
 * past its depth and node caps, in both modules.
 *
 * Why it passed on beta.81: lib/core/part8-split-route.cjs carriesEdgeOrBody
 * (:88-114) returns false when the walk passes depth 8 or spends its budget
 * of 2,000 nodes, so a body nested 10 levels deep, or placed after 2,100
 * short leaves, is never seen and the ambiguous call proceeds to the wire.
 * lib/core/brain-client.cjs _carriesEdgeOrBody (:1021) inherits the false.
 * Zero references to carriesEdgeOrBody existed under tests/ on beta.81.
 *
 * Part 8: every string in this file is invented. No room word, no room file
 * name, no Brain identifier.
 *
 * Cases:
 *   D1  carriesEdgeOrBody('brain_ask', <10 levels deep, body leaf>) is not
 *       false (a refusing outcome).
 *   D2  carriesEdgeOrBody('brain_ask', <2,100 short leaves then a body>) is
 *       not false.
 *   D3  the two outcomes are typed: { over_budget: true, reason: 'depth' }
 *       and { over_budget: true, reason: 'nodes' }.
 *   D4  the normal path is byte-compatible: a shallow sprout payload is
 *       false, a shallow body payload is true, a shallow payload with a
 *       format-character-joined body is true (normalised before the shape).
 *   D5  brain-client._carriesEdgeOrBody is true for both payloads.
 *   D6  the brain-client belt sends nothing for the two payloads on an
 *       ambiguous tool: the capture server records 0 tools/call and the
 *       result is the sprouts_required typed outcome with the reason
 *       over_budget.
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SPLIT_ROUTE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-split-route.cjs');
const CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));

// 3 sentences, no room word, no forbidden pattern.
const BODY = 'The first draft of the plan was signed last spring. ' +
  'The second paragraph covers the market size. The third paragraph covers the pricing tiers.';
const SPROUT = 'swot analysis';

function deepPayload() {
  const root = {};
  let cur = root;
  for (let i = 0; i < 10; i += 1) { cur.k = {}; cur = cur.k; }
  cur.leaf = BODY;
  return root;
}

function widePayload() {
  const wide = {};
  for (let i = 0; i < 2100; i += 1) wide['k' + i] = SPROUT;
  wide.zz = BODY;
  return wide;
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}

async function main() {
  console.log('Plan 392-05 Task 2: bypass 6, the depth and node caps fail closed\n');

  delete require.cache[SPLIT_ROUTE_PATH];
  const sr = require(SPLIT_ROUTE_PATH);

  check('D1 carriesEdgeOrBody on a body 10 levels deep is a refusing outcome', function () {
    const r = sr.carriesEdgeOrBody('brain_ask', deepPayload());
    assert.notStrictEqual(r, false, 'deep body not seen: carriesEdgeOrBody returned false');
  });

  check('D2 carriesEdgeOrBody on a body after 2,100 short leaves is a refusing outcome', function () {
    const r = sr.carriesEdgeOrBody('brain_ask', widePayload());
    assert.notStrictEqual(r, false, 'wide body not seen: carriesEdgeOrBody returned false');
  });

  check('D3 the two outcomes are typed over_budget with the cap that tripped', function () {
    const d = sr.carriesEdgeOrBody('brain_ask', deepPayload());
    assert.ok(d && typeof d === 'object' && d.over_budget === true, 'deep outcome not typed: ' + JSON.stringify(d));
    assert.strictEqual(d.reason, 'depth', 'deep reason: ' + JSON.stringify(d));
    const w = sr.carriesEdgeOrBody('brain_ask', widePayload());
    assert.ok(w && typeof w === 'object' && w.over_budget === true, 'wide outcome not typed: ' + JSON.stringify(w));
    assert.strictEqual(w.reason, 'nodes', 'wide reason: ' + JSON.stringify(w));
    assert.strictEqual(JSON.stringify(d).indexOf('paragraph'), -1, 'the outcome carries text');
  });

  check('D4 the normal path is byte-compatible: sprout false, body true, joined body true', function () {
    assert.strictEqual(sr.carriesEdgeOrBody('brain_ask', { question: SPROUT }), false, 'shallow sprout');
    assert.strictEqual(sr.carriesEdgeOrBody('brain_ask', { question: SPROUT, n: 3, more: [SPROUT] }), false, 'shallow sprouts and a number');
    assert.strictEqual(sr.carriesEdgeOrBody('brain_ask', { question: BODY }), true, 'shallow body');
    assert.strictEqual(sr.carriesEdgeOrBody('brain_stats', { a: { b: BODY } }), true, 'nested body at depth 2');
    // Zero width space between the words of a body: the shape runs on the
    // normalised string (plan 392-03 normaliser), so the body is still seen.
    const joined = BODY.split(' ').join('​');
    assert.strictEqual(sr.carriesEdgeOrBody('brain_ask', { question: joined }), true, 'format-character-joined body');
    // The cypher key of brain_query is still not read at the top level.
    assert.strictEqual(sr.carriesEdgeOrBody('brain_query', { cypher: BODY }), false, 'top-level cypher of brain_query');
  });

  const { server, url } = await capture.startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-392-05';
  delete require.cache[CLIENT_PATH];
  const bc = require(CLIENT_PATH);
  try {
    check('D5 brain-client._carriesEdgeOrBody is true for both payloads', function () {
      assert.strictEqual(typeof bc._carriesEdgeOrBody, 'function', '_carriesEdgeOrBody is not exported as a test seam');
      assert.strictEqual(bc._carriesEdgeOrBody('brain_ask', deepPayload()), true, 'deep payload');
      assert.strictEqual(bc._carriesEdgeOrBody('brain_ask', widePayload()), true, 'wide payload');
      assert.strictEqual(bc._carriesEdgeOrBody('brain_ask', { question: SPROUT }), false, 'shallow sprout');
    });

    await checkAsync('D6 the belt sends nothing for the two payloads; outcome sprouts_required, reason over_budget', async function () {
      const payloads = [['deep', deepPayload()], ['wide', widePayload()]];
      for (let i = 0; i < payloads.length; i += 1) {
        capture.resetCaptured();
        const r = await bc.callTool('brain_stats', payloads[i][1]);
        assert.strictEqual(capture.captured.length, 0, payloads[i][0] + ': the wire received ' + capture.captured.length + ' call(s)');
        assert.ok(r && r.error === 'egress_blocked', payloads[i][0] + ': no typed refusal: ' + JSON.stringify(r));
        assert.strictEqual(r.outcome, 'sprouts_required', payloads[i][0] + ': outcome: ' + JSON.stringify(r));
        assert.strictEqual(r.token_class, 'over_budget', payloads[i][0] + ': token_class: ' + JSON.stringify(r));
        assert.strictEqual(JSON.stringify(r).indexOf('paragraph'), -1, payloads[i][0] + ': the refusal carries text');
      }
    });
  } finally {
    await capture.stopCaptureServer(server);
  }
}

main().then(function () {
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-392-bypass-6-depth-fails-closed');
    process.exit(1);
  }
  console.log('PASS: test-392-bypass-6-depth-fails-closed');
  process.exit(0);
}, function (err) {
  console.error('FAIL: test-392-bypass-6-depth-fails-closed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
