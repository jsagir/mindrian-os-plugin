/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 Task 1 -- mva-telemetry tests.
 *
 * Verifies atomic JSONL append to ~/.mindrian/telemetry/v1.13/mva.jsonl,
 * schema validation that rejects raw user content, per-event ALLOWED_FIELDS
 * export with mva_brief_rendered carrying 'total_duration_ms' (NOT 'duration_ms'),
 * and concurrent-emit safety.
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// Use a hermetic temp HOME to isolate writes. Must be set BEFORE require so the
// module's paths resolve against the temp HOME at module-load time. Restored
// after each test via the cleanup helper.

function mkTmpHome() {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-telemetry-test-'));
  return tmpHome;
}

function rmTmpHome(tmpHome) {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
}

// Pre-set HOME so the require below resolves paths against the temp dir.
// Each test gets its own subdir via emit() path resolution (already env-aware).

function freshTelemetry() {
  // Re-require with cleared cache so module constants resolve against the
  // current process.env.HOME.
  delete require.cache[require.resolve('./mva-telemetry.cjs')];
  return require('./mva-telemetry.cjs');
}

const SHA256_SAMPLE = crypto.createHash('sha256').update('hello world').digest('hex');

test('telemetry Test 10 -- emit appends a valid JSON line to mva.jsonl', () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const telemetry = freshTelemetry();
    telemetry.emit('mva_pipeline_started', { sentence_sha256: SHA256_SAMPLE });
    const jsonlPath = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
    assert.ok(fs.existsSync(jsonlPath), 'jsonl file must exist');
    const content = fs.readFileSync(jsonlPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 1, 'must have exactly 1 line');
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.event, 'mva_pipeline_started');
    assert.strictEqual(parsed.sentence_sha256, SHA256_SAMPLE);
    assert.ok(typeof parsed.timestamp === 'string', 'must have ISO timestamp');
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('telemetry Test 11 -- validateEventPayload rejects long string fields (raw content suspicion)', () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const telemetry = freshTelemetry();
    // error_short is explicitly allowed at <= 60 chars
    const longErrorShort = 'a'.repeat(120);
    const v1 = telemetry.validateEventPayload('mva_agent_returned', {
      sentence_sha256: SHA256_SAMPLE,
      agent_id: 'brain_similar',
      duration_ms: 100,
      status: 'error',
      error_short: longErrorShort
    });
    assert.strictEqual(v1.ok, false, 'long error_short must be rejected');

    // Bare string field over 64 chars (not error_short, not sha256)
    const v2 = telemetry.validateEventPayload('mva_agent_returned', {
      sentence_sha256: SHA256_SAMPLE,
      agent_id: 'a'.repeat(120),
      duration_ms: 100,
      status: 'ok'
    });
    assert.strictEqual(v2.ok, false, 'long agent_id must be rejected');
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('telemetry Test 12 -- validateEventPayload rejects fields not in schema', () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const telemetry = freshTelemetry();
    // 'sentence' is NOT in any ALLOWED_FIELDS entry; only sentence_sha256 is allowed
    const v = telemetry.validateEventPayload('mva_pipeline_started', {
      sentence_sha256: SHA256_SAMPLE,
      sentence: 'I have a venture idea'  // forbidden field name (sentence-related)
    });
    assert.strictEqual(v.ok, false, 'sentence field must be rejected');

    // 'raw_text' should also be rejected
    const v2 = telemetry.validateEventPayload('mva_pipeline_started', {
      sentence_sha256: SHA256_SAMPLE,
      raw_text: 'something'
    });
    assert.strictEqual(v2.ok, false, 'raw_text field must be rejected');
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('telemetry Test 13 -- EVENT_TYPES + ALLOWED_FIELDS frozen, mva_brief_rendered uses total_duration_ms', () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const telemetry = freshTelemetry();
    assert.ok(Object.isFrozen(telemetry.EVENT_TYPES), 'EVENT_TYPES must be frozen');
    assert.ok(Object.isFrozen(telemetry.ALLOWED_FIELDS), 'ALLOWED_FIELDS must be frozen');

    // The 6 event types from OQ8
    const expected = [
      'mva_pipeline_started',
      'mva_agent_returned',
      'mva_brief_rendered',
      'mva_option_selected',
      'mva_brief_deployed',
      'mva_pipeline_failed'
    ];
    for (const e of expected) {
      assert.ok(telemetry.EVENT_TYPES.includes(e), `EVENT_TYPES must include ${e}`);
      assert.ok(Array.isArray(telemetry.ALLOWED_FIELDS[e]), `ALLOWED_FIELDS must list ${e}`);
    }

    // The CRITICAL invariant: mva_brief_rendered uses 'total_duration_ms', NOT 'duration_ms'
    const brendered = telemetry.ALLOWED_FIELDS.mva_brief_rendered;
    assert.ok(brendered.includes('total_duration_ms'), 'must list total_duration_ms');
    assert.equal(brendered.includes('duration_ms'), false, 'must NOT list duration_ms');

    // Sanity: mva_agent_returned still uses duration_ms (it's the per-agent variant)
    assert.ok(telemetry.ALLOWED_FIELDS.mva_agent_returned.includes('duration_ms'));
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('telemetry Test 14 -- concurrent emits produce well-formed JSONL lines', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const telemetry = freshTelemetry();
    // Fire 6 concurrent emits (simulating 6 parallel agents)
    const promises = Array.from({ length: 6 }, (_, i) => {
      return new Promise((resolve) => {
        setImmediate(() => {
          telemetry.emit('mva_agent_returned', {
            sentence_sha256: SHA256_SAMPLE,
            agent_id: `agent_${i}`,
            duration_ms: 100 + i,
            status: 'ok'
          });
          resolve();
        });
      });
    });
    await Promise.all(promises);

    const jsonlPath = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
    const content = fs.readFileSync(jsonlPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 6, 'must have 6 lines');
    for (const line of lines) {
      const parsed = JSON.parse(line); // throws if torn
      assert.strictEqual(parsed.event, 'mva_agent_returned');
      assert.ok(typeof parsed.agent_id === 'string');
    }
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});
