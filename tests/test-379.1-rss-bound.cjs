#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 gap closure plan 09: the decision-following proof for the drain peak RSS fix. It reads
 * tests/fixtures/379.1/rss-decision.json and asserts the matching code state (a-batch: the default embed
 * batch equals the recorded batch and the other options are untouched). The last case reads the live
 * evidence file tests/fixtures/379.1/live-leg-after-rss-fix.json when it exists.
 * No real encoder, no child process, no network. Hyphens only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DECISION_FILE = path.join(REPO, 'tests', 'fixtures', '379.1', 'rss-decision.json');
const EVIDENCE_FILE = path.join(REPO, 'tests', 'fixtures', '379.1', 'live-leg-after-rss-fix.json');
const record = JSON.parse(fs.readFileSync(DECISION_FILE, 'utf8'));
const spine = require('../lib/core/semantic-index/embedding-spine.cjs');
const classifier = require('../lib/core/graph-derive-classifier.cjs');
const leg = require('../scripts/release-lib/large-room-leg.cjs');

let pass = 0;
let fail = 0;
async function t(label, fn) {
  try {
    await fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}
function skip(label) { console.log('  SKIP - ' + label); }

function withBatchEnv(value, fn) {
  const saved = process.env.MINDRIAN_EMBED_BATCH;
  if (value === undefined) delete process.env.MINDRIAN_EMBED_BATCH; else process.env.MINDRIAN_EMBED_BATCH = value;
  const restore = () => {
    if (saved === undefined) delete process.env.MINDRIAN_EMBED_BATCH; else process.env.MINDRIAN_EMBED_BATCH = saved;
  };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.finally(restore);
    restore();
    return r;
  } catch (e) {
    restore();
    throw e;
  }
}

async function main() {
  console.log('379.1 rss bound (plan 09), decision ' + record.decision);

  if (record.decision === 'a-batch') {
    const N = record.batch;
    await t('a-batch: the default batch equals the recorded batch', () => {
      assert.ok(Number.isInteger(N) && N > 0 && N < 32);
      assert.equal(spine._test.DEFAULT_BATCH, N);
      withBatchEnv(undefined, () => assert.equal(spine._test.resolveBatchSize(), N));
    });
    await t('a-batch: env 4 gives 4; abc, 0 and empty give the default', () => {
      withBatchEnv('4', () => assert.equal(spine._test.resolveBatchSize(), 4));
      ['abc', '0', ''].forEach((bad) => withBatchEnv(bad, () => assert.equal(spine._test.resolveBatchSize(), N)));
    });
    await t('a-batch: attachVectors with the env unset calls embedFn ceil(40 / batch) times', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-1-rssbound-'));
      try {
        const arts = Array.from({ length: 40 }, (_v, i) => ({ id: 'a' + i, text: 'text number ' + i + ' about harbour tides' }));
        let calls = 0;
        const embedFn = async (texts) => { calls += 1; return { success: true, vectors: texts.map(() => [0.1, 0.2, 0.3]) }; };
        await withBatchEnv(undefined, () => classifier.attachVectors(dir, arts, { embedFn: embedFn, cacheFile: path.join(dir, 'vectors.json') }));
        assert.equal(calls, Math.ceil(40 / N));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    await t('a-batch: the session options carry no arena keys (option a-arena not applied)', () => {
      const so = spine._test.buildSessionOptions();
      assert.ok(!('enableCpuMemArena' in so));
      assert.ok(!('enableMemPattern' in so));
    });
  } else {
    skip('no decision-specific case for ' + record.decision);
  }

  await t('the leg limits are unchanged (rss 1024, clock 300000, cpu 600000)', () => {
    assert.deepEqual(leg.DEFAULT_LIMITS, { clock_ms: 300000, cpu_ms: 600000, rss_mb: 1024 });
  });

  if (!fs.existsSync(EVIDENCE_FILE)) {
    skip('no live-leg-after-rss-fix.json yet');
  } else {
    await t('live evidence: last two runs ok and not smoke, peaks within the limit, sha hex, no home path', () => {
      const text = fs.readFileSync(EVIDENCE_FILE, 'utf8');
      const j = JSON.parse(text);
      assert.equal(j.evidence, 'large-room-leg-after-rss-fix');
      assert.equal(j.decision, record.decision);
      assert.ok(Array.isArray(j.runs) && j.runs.length >= 2);
      j.runs.slice(-2).forEach((r) => {
        assert.equal(r.status, 'ok');
        assert.equal(r.smoke, false);
      });
      j.runs.forEach((r) => assert.ok(r.drain.max_rss_mb <= j.limit_rss_mb || r.status !== 'ok'));
      j.runs.slice(-2).forEach((r) => assert.ok(r.drain.max_rss_mb <= j.limit_rss_mb));
      assert.match(j.code_head_sha, /^[0-9a-f]{7,40}$/);
      const home = os.homedir();
      assert.ok(!(home && home !== '/' && text.indexOf(home) !== -1));
    });
  }

  console.log('rss-bound: PASS ' + pass + ' FAIL ' + fail);
  if (fail > 0) process.exit(1);
}

main();
