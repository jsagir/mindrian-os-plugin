#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-05, Task 1 (bypass 3 of F6): every string value under
 * brain_query.params must be scanned by the same rules as the cypher string.
 *
 * Why it passed on beta.81: the shim schema takes params as z.record(z.any())
 * (scripts/mindrian-brain-mcp-client.cjs:248), brain-client.query sends
 * args.params (brain-client.cjs:838), and the guard reads only the cypher
 * key (_extractFreeFormString, the first FREEFORM_KEY). A params value that
 * names a room word, or a whole paragraph, clears the default-deny scan of
 * step 1 and reaches the wire.
 *
 * Part 8: every string in this file is invented. The room is the synthetic
 * gate-lexgen room (venture name "Brightmoor Kiln", invented). The credential
 * shape is built from parts at run time and is not a real key.
 *
 * Cases:
 *   P1  {cypher: template, params: {name: <paragraph>}} blocks.
 *   P2  {cypher: template, params: {name: <room word>}} blocks room_content.
 *   P3  {cypher: template, params: {name: 'Jobs to be Done'}} still allows.
 *   P4  a params value with a credential shape blocks content_set.
 *   P5  the P1 block names leaf_path "params.name" and never the text.
 *   P6  brain-client.query with a body under params sends nothing: the
 *       capture server records 0 tools/call and the result is a typed
 *       refusal (sprouts_required).
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-05-b3-'));
fs.mkdirSync(path.join(TMP, 'home'));
fs.mkdirSync(path.join(TMP, 'registry'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const capture = require(path.join(REPO_ROOT, 'tests', 'helpers', 'brain-capture-server.cjs'));

const ROOM_WORD = 'Brightmoor Kiln';
const TEMPLATE = 'MATCH (f:Framework) WHERE f.name = $name RETURN f.name';
const PARAGRAPH = ROOM_WORD + ' signed the first draft of the plan last spring. ' +
  'The second paragraph covers the market size. The third paragraph covers the pricing tiers.';
// A body with no room word: 3 sentences. Blocks by shape under any room.
const BODY = 'The first draft of the plan was signed last spring. ' +
  'The second paragraph covers the market size. The third paragraph covers the pricing tiers.';
// Built at run time from parts; not a real key.
const FAKE_KEY = ['s', 'k', '-', 'QWERTYUIOPASDFGHJKLZXCVBNMQWERTYUIOPASD'.slice(0, 40)].join('');

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

function noText(v) {
  const s = JSON.stringify(v);
  return s.indexOf('Brightmoor') === -1 && s.indexOf('paragraph') === -1 && s.indexOf('pricing') === -1;
}

async function main() {
  console.log('Plan 392-05 Task 1: bypass 3, brain_query params\n');

  delete require.cache[GUARD_PATH];
  const guard = require(GUARD_PATH);
  const rooms = loader.makeRooms(path.join(TMP, 'rooms'), REPO_ROOT);
  const roomDir = rooms.roomFor('gate-lexgen');
  const opts = { toolName: 'brain_query', roomDir: roomDir };

  check('P0 the template alone allows (fixture sanity)', function () {
    const v = guard.classify({ cypher: TEMPLATE }, opts);
    assert.strictEqual(v.verdict, 'allow', 'template alone: ' + JSON.stringify(v));
  });

  check('P1 a params value that is a room paragraph blocks', function () {
    const v = guard.classify({ cypher: TEMPLATE, params: { name: PARAGRAPH } }, opts);
    assert.strictEqual(v.verdict, 'block', 'params value not scanned: ' + JSON.stringify(v));
  });

  check('P2 a params value that is a room word blocks room_content', function () {
    const v = guard.classify({ cypher: TEMPLATE, params: { name: ROOM_WORD } }, opts);
    assert.strictEqual(v.verdict, 'block', 'params value not scanned: ' + JSON.stringify(v));
    assert.strictEqual(v.class, 'room_content', 'class: ' + JSON.stringify(v));
  });

  check('P3 a params value that is a generic framework handle still allows', function () {
    const v = guard.classify({ cypher: TEMPLATE, params: { name: 'Jobs to be Done' } }, opts);
    assert.strictEqual(v.verdict, 'allow', 'generic handle refused: ' + JSON.stringify(v));
    const n = guard.classify({ cypher: TEMPLATE, params: { name: 'swot', limit: 5 } }, opts);
    assert.strictEqual(n.verdict, 'allow', 'handle with an integer refused: ' + JSON.stringify(n));
  });

  check('P4 a params value with a credential shape blocks content_set', function () {
    const v = guard.classify({ cypher: TEMPLATE, params: { name: FAKE_KEY } }, opts);
    assert.strictEqual(v.verdict, 'block', 'credential shape not blocked: ' + JSON.stringify(v));
    assert.strictEqual(v.class, 'content_set', 'class: ' + JSON.stringify(v));
  });

  check('P5 the params block names leaf_path params.name and never the text', function () {
    const v = guard.classify({ cypher: TEMPLATE, params: { name: PARAGRAPH } }, opts);
    assert.strictEqual(v.leaf_path, 'params.name', 'leaf_path: ' + JSON.stringify(v));
    assert.ok(noText(v), 'the verdict carries text: ' + JSON.stringify(v));
  });

  const { server, url } = await capture.startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-392-05';
  delete require.cache[CLIENT_PATH];
  const bc = require(CLIENT_PATH);
  try {
    await checkAsync('P6 brain-client.query with a body under params sends nothing', async function () {
      capture.resetCaptured();
      const r = await bc.query(TEMPLATE, { name: BODY });
      assert.strictEqual(capture.captured.length, 0, 'the wire received ' + capture.captured.length + ' call(s): ' +
        JSON.stringify(capture.captured.map(function (c) { return c.name; })));
      assert.ok(r && r.error === 'egress_blocked', 'no typed refusal: ' + JSON.stringify(r));
      assert.strictEqual(r.egress_class, 'sprouts_required', 'class: ' + JSON.stringify(r));
    });
  } finally {
    await capture.stopCaptureServer(server);
  }
}

main().then(function () {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-396-bypass-3-query-params');
    process.exit(1);
  }
  console.log('PASS: test-396-bypass-3-query-params');
  process.exit(0);
}, function (err) {
  console.error('FAIL: test-396-bypass-3-query-params: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
