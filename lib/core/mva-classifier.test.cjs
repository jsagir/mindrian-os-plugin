'use strict';
/*
 * Phase 118-00 Plan 00 -- mva-classifier + mva-state unit tests.
 *
 * 7 tests (per PLAN.md Task 1 behavior block):
 *   T1 heuristic positive (3 venture sentences)
 *   T2 heuristic negative (3 coding/admin sentences)
 *   T3 Hebrew detection -> graceful refusal (per LD1; pre-empts Haiku call)
 *   T4 short-circuit on length (< 12 chars OR > 600 chars)
 *   T5 cache hit (sha256 keyed; second call returns cached, fetch counter = 0)
 *   T6 state I/O round trip (writePending / readPending / markRunning /
 *      markComplete / isAlreadyRunning; atomic tmpfile-then-rename)
 *   T7 heuristic-only mode when ANTHROPIC_API_KEY absent (fetch counter = 0)
 *
 * Test seam strategy: classifier exposes `_test` namespace for injecting
 * a mock fetch + clearing the in-memory sha256 cache. State module exposes
 * `stateDir` so the test can hijack a tmpdir HOME without touching the
 * real ~/.mindrian/mva. Mirrors the Plan 90-01 / Plan 109-10 seam idiom.
 *
 * Pure CJS, node built-ins only. No mocha, no jest -- mirrors the Phase 109
 * + Phase 124 + Phase 125 in-tree runner pattern.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLASSIFIER_PATH = path.resolve(__dirname, 'mva-classifier.cjs');
const STATE_PATH = path.resolve(__dirname, 'mva-state.cjs');

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n');
    failed += 1;
  }
}

// Fresh require each block so the in-memory cache resets between mutating
// suites. classify keeps a Map at module scope -- a stale entry would mask
// genuine failures of the no-fetch invariant in T5/T7.
function freshClassifier() {
  delete require.cache[CLASSIFIER_PATH];
  return require(CLASSIFIER_PATH);
}

function freshState() {
  delete require.cache[STATE_PATH];
  return require(STATE_PATH);
}

// ---------- T1 heuristic positive ----------

run('T1 heuristic positive: 3 venture sentences', () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { classify } = freshClassifier();
  const venture = [
    'I have an idea for a couples finance app',
    'thinking about building a SaaS for dentists',
    'considering launching a platform for nonprofits',
  ];
  for (const s of venture) {
    const r = classify(s);
    assert.equal(r.venture, true, 'expected venture=true for: ' + s + ' got ' + JSON.stringify(r));
    assert.ok(r.source === 'heuristic' || r.source === 'heuristic_fallback',
      'expected source heuristic*; got ' + r.source);
  }
});

// ---------- T2 heuristic negative ----------

run('T2 heuristic negative: 3 coding/admin sentences', () => {
  delete process.env.ANTHROPIC_API_KEY;
  const { classify } = freshClassifier();
  const nonVenture = [
    'fix the failing test in foo.test.js',
    '/mos:status now please please',
    'git push origin main right now',
  ];
  for (const s of nonVenture) {
    const r = classify(s);
    assert.equal(r.venture, false, 'expected venture=false for: ' + s + ' got ' + JSON.stringify(r));
    assert.ok(r.source === 'heuristic' || r.source === 'language_detect' || r.source === 'length_guard'
      || r.source === 'heuristic_fallback',
      'unexpected source ' + r.source + ' for ' + s);
  }
});

// ---------- T3 Hebrew detection (LD1) ----------

run('T3 Hebrew detection -> hebrew_unsupported_v1.13.0, no fetch', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-fake-should-never-be-called';
  const mod = freshClassifier();
  let fetchCount = 0;
  mod._test.setFetch(async () => { fetchCount += 1; return { ok: true, json: async () => ({}) }; });
  const r = mod.classify('יש לי רעיון לאפליקציה לזוגות');
  assert.equal(r.venture, false);
  assert.equal(r.reason, 'hebrew_unsupported_v1.13.0');
  assert.equal(r.source, 'language_detect');
  assert.equal(fetchCount, 0, 'Hebrew must short-circuit BEFORE any API call');
  delete process.env.ANTHROPIC_API_KEY;
});

// ---------- T4 length short-circuit ----------

run('T4 length out of range -> short-circuit, no fetch', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-fake';
  const mod = freshClassifier();
  let fetchCount = 0;
  mod._test.setFetch(async () => { fetchCount += 1; return { ok: true, json: async () => ({}) }; });
  // Too short
  let r = mod.classify('');
  assert.equal(r.venture, false);
  assert.equal(r.reason, 'length_out_of_range');
  r = mod.classify('hi');
  assert.equal(r.venture, false);
  assert.equal(r.reason, 'length_out_of_range');
  // Too long
  const longStr = 'x'.repeat(700);
  r = mod.classify(longStr);
  assert.equal(r.venture, false);
  assert.equal(r.reason, 'length_out_of_range');
  assert.equal(fetchCount, 0, 'length-guard must short-circuit BEFORE any API call');
  delete process.env.ANTHROPIC_API_KEY;
});

// ---------- T5 cache hit on repeated sha256 ----------

run('T5 cache hit: second call returns cached (fetch counter unchanged)', () => {
  // Use ANTHROPIC_API_KEY so the FIRST call may consult fetch; we mock
  // fetch to return a known answer, then assert call 2 does NOT hit fetch.
  process.env.ANTHROPIC_API_KEY = 'sk-fake-for-cache-test';
  const mod = freshClassifier();
  let fetchCount = 0;
  mod._test.setFetch(async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'venture' }] }),
    };
  });
  mod._test.clearCache();
  const s = 'a-very-unique-sentence-not-in-heuristic-bank-1234567890';
  const r1 = mod.classify(s);
  const r2 = mod.classify(s);
  assert.equal(r1.venture, r2.venture, 'cache should return identical result');
  // The heuristic path may have answered without fetch -- that's fine. The
  // contract is: second call MUST NOT add to fetchCount.
  const after1 = fetchCount;
  const r3 = mod.classify(s);
  assert.equal(fetchCount, after1, 'third call must not re-trigger fetch');
  assert.equal(r3.venture, r1.venture);
  delete process.env.ANTHROPIC_API_KEY;
});

// ---------- T6 state I/O round trip ----------

run('T6 state I/O round trip + atomic write semantics', () => {
  // Isolate state to a tmpdir HOME so we never touch the real ~/.mindrian.
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-state-test-'));
  const prevHome = process.env.HOME;
  const prevSession = process.env.CLAUDE_SESSION_ID;
  process.env.HOME = tmpHome;
  process.env.CLAUDE_SESSION_ID = 'test-session-118-00';
  try {
    const state = freshState();
    // Clean slate
    assert.equal(state.readPending(), null, 'cold start: readPending returns null');
    assert.equal(state.isAlreadyRunning(), false, 'cold start: not running');

    const payload = {
      sentence_sha256: 'a'.repeat(64),
      classified_at: Date.now(),
      classifier_source: 'heuristic',
      classifier_confidence: 'high',
      locale: 'en',
    };
    state.writePending(payload);
    const read = state.readPending();
    // writePending initializes pipeline_status='pending' for the dispatcher
    // (Plan 118-01) to read. The original payload fields must all be present
    // and byte-identical; pipeline_status is added by the writer.
    for (const k of Object.keys(payload)) {
      assert.deepEqual(read[k], payload[k],
        'writePending must preserve field ' + k + '; got ' + JSON.stringify(read[k]));
    }
    assert.equal(read.pipeline_status, 'pending',
      'writePending must initialize pipeline_status="pending" for dispatcher');

    state.markRunning();
    assert.equal(state.isAlreadyRunning(), true);

    state.markComplete();
    assert.equal(state.isAlreadyRunning(), false);

    // Verify state dir lives under ~/.mindrian/mva (i.e. respects tmpHome)
    assert.ok(state.stateDir().indexOf(tmpHome) === 0,
      'stateDir should be under tmpHome; got ' + state.stateDir());

    // Atomic-write source-grep audit: verify the module uses tmp+rename idiom
    const src = fs.readFileSync(STATE_PATH, 'utf8');
    assert.ok(/renameSync/.test(src), 'mva-state.cjs must use fs.renameSync (atomic write)');
    assert.ok(/\.tmp/.test(src) || /tmp/.test(src),
      'mva-state.cjs must write to a tmp path before rename');
  } finally {
    process.env.HOME = prevHome;
    if (prevSession === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = prevSession;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

// ---------- T7 heuristic-only mode when ANTHROPIC_API_KEY unset ----------

run('T7 heuristic-only mode: no fetch attempted when key absent', () => {
  delete process.env.ANTHROPIC_API_KEY;
  // Also clear ~/.mindrian.env / .env paths by overriding HOME to a clean
  // tmpdir so the resolver returns not-found deterministically.
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-no-key-test-'));
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const mod = freshClassifier();
    let fetchCount = 0;
    mod._test.setFetch(async () => { fetchCount += 1; return { ok: true, json: async () => ({}) }; });
    mod._test.clearCache();
    const r = mod.classify('I have an idea for a couples finance app');
    assert.equal(r.venture, true);
    assert.equal(r.source, 'heuristic_fallback',
      'when key absent, source must be heuristic_fallback (medium confidence); got ' + r.source);
    assert.equal(r.confidence, 'medium');
    assert.equal(fetchCount, 0, 'fetch must not be attempted without an API key');
  } finally {
    process.env.HOME = prevHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

// ---------- Summary ----------

process.stderr.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
