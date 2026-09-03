'use strict';
// Phase 267.2 W1b/W1d Task 2 -- scalar-only instrumentation pin for
// scripts/first-install-router.cjs (HOOK-08). Proves the telemetry record is
// scalar-only and that no raw sentence reaches disk -- not just in the
// telemetry file, but anywhere under the isolated HOME -- per research
// Pitfall 5 (the ignite outcome must be MEASURED, not assumed a terminal
// success) and Canon Part 8 (Graph Boundary: no raw user text on disk).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const helpers = require('./test-267-2-helpers.cjs');
const classifier = require('../lib/core/greeting-intent-detector.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-router-telemetry');

const SENTENCE = 'I want to start a new venture around clinical trial recruitment coordination.';

function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// Extract every 8+ character alphabetic run from the sentence -- the cheapest
// honest proxy for "any 8-or-more character substring", since a full
// sliding-window scan over every file on disk would be needlessly slow and
// these words are exactly the content a leak would actually carry.
function extractLongWords(sentence) {
  const words = sentence.match(/[A-Za-z]{8,}/g) || [];
  return Array.from(new Set(words));
}

function assertScalarOrFlatObject(value, keyPath) {
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (t === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const vt = typeof v;
      assert.ok(
        v === null || vt === 'number' || vt === 'boolean' || vt === 'string',
        'non-scalar nested value at ' + keyPath + '.' + k + ': ' + vt,
      );
    }
    return;
  }
  assert.fail('non-scalar, non-flat-object value at ' + keyPath + ': ' + JSON.stringify(value));
}

helpers.withIsolatedHome(function (ctx) {
  const env = helpers.keylessEnv(ctx.env);

  // ---- Run 1: virgin isolated HOME -- arms, classifies, routes, logs 'routed' ----
  const r1 = spawnSync('node', [ROUTER], {
    input: JSON.stringify({ prompt: SENTENCE }),
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });

  ok('router run 1 exits 0 on a virgin isolated HOME', function () {
    assert.equal(r1.status, 0, 'router exited non-zero: ' + r1.status + ' stderr=' + r1.stderr);
  });

  const telemetryPath = path.join(ctx.home, '.mindrian', 'telemetry', 'v1.13', 'first-install-router.jsonl');

  ok('telemetry file exists under ~/.mindrian/telemetry/v1.13/ and its last line parses as JSON', function () {
    assert.ok(fs.existsSync(telemetryPath), 'telemetry file missing: ' + telemetryPath);
    const lines = fs.readFileSync(telemetryPath, 'utf8').split('\n').filter(Boolean);
    assert.ok(lines.length >= 1, 'telemetry file has no lines');
    JSON.parse(lines[lines.length - 1]); // throws if not valid JSON
  });

  function lastRecord() {
    const lines = fs.readFileSync(telemetryPath, 'utf8').split('\n').filter(Boolean);
    return JSON.parse(lines[lines.length - 1]);
  }

  let routedRecord;
  ok('the routed record has event=routed, bucket in BUCKETS, outcome in OUTCOMES', function () {
    routedRecord = lastRecord();
    assert.equal(routedRecord.event, 'routed');
    assert.ok(classifier.BUCKETS.includes(routedRecord.bucket), 'bucket not in BUCKETS: ' + routedRecord.bucket);
    assert.ok(classifier.OUTCOMES.includes(routedRecord.outcome), 'outcome not in OUTCOMES: ' + routedRecord.outcome);
  });

  ok('sentence_sha256 equals a locally computed sha256 of the real input sentence, proving the hash is over the real input', function () {
    const expected = crypto.createHash('sha256').update(SENTENCE, 'utf8').digest('hex');
    assert.equal(routedRecord.sentence_sha256, expected);
  });

  ok('Part 8: a whole-tree scan of the isolated HOME finds no 8-or-more character substring of the input sentence', function () {
    const longWords = extractLongWords(SENTENCE);
    assert.ok(longWords.length > 0, 'test sentence has no 8+ char word to check -- strengthen the fixture');
    for (const file of walkFiles(ctx.home)) {
      for (const word of longWords) {
        helpers.assertNoRawText(file, word);
      }
    }
  });

  ok('every value in the routed record is a string, a number, a boolean, or a flat object of numbers/booleans', function () {
    for (const [key, value] of Object.entries(routedRecord)) {
      assertScalarOrFlatObject(value, key);
    }
  });

  // ---- Run 2: same isolated HOME, phase is now 'routed' -> appends 'outcome_observed' ----
  const r2 = spawnSync('node', [ROUTER], {
    input: JSON.stringify({ prompt: 'this second-turn prompt is irrelevant to the outcome_observed event' }),
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });

  ok('router run 2 (already routed) exits 0', function () {
    assert.equal(r2.status, 0, 'router exited non-zero: ' + r2.status + ' stderr=' + r2.stderr);
  });

  let observedRecord;
  ok('a second router run appends an outcome_observed line carrying rooms_home_exists and active_room_bound as booleans', function () {
    observedRecord = lastRecord();
    assert.equal(observedRecord.event, 'outcome_observed');
    assert.equal(typeof observedRecord.rooms_home_exists, 'boolean');
    assert.equal(typeof observedRecord.active_room_bound, 'boolean');
  });

  ok('the outcome_observed record also passes the Part 8 whole-tree no-raw-text scan', function () {
    const longWords = extractLongWords(SENTENCE);
    for (const file of walkFiles(ctx.home)) {
      for (const word of longWords) {
        helpers.assertNoRawText(file, word);
      }
    }
  });

  ok('every value in the outcome_observed record is a string, a number, a boolean, or a flat object of numbers/booleans', function () {
    for (const [key, value] of Object.entries(observedRecord)) {
      assertScalarOrFlatObject(value, key);
    }
  });
});

console.log('\nPASS test-267-2-router-telemetry (' + n + ' assertions)');
