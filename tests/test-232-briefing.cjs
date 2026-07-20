'use strict';
// Phase 232-02 Task 2 -- briefing.cjs test suite (D-06).
//
// briefing.cjs generates Larry's Briefing over the in-repo raw-fetch Anthropic
// transport (the mva-classifier precedent), NOT the Vercel AI SDK (D-06 explicit
// rejection). It resolves { ok:true, briefing:{critical_misses, reframe,
// next_steps} } or { ok:false, error:'no_api_key'|'api_error' } and NEVER throws.
//
// Fully hermetic: exercised ONLY through the opts.resolveKey + opts.fetchImpl
// seams. The real 4-leg key resolver and real fetch are never touched, so a dev
// machine carrying a real ANTHROPIC_API_KEY cannot make these tests reach the
// network. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const modPath = path.join(REPO_ROOT, 'lib', 'wiki', 'briefing.cjs');
const { generateBriefing } = require(modPath);

const FIXTURE_ROOM = path.join(REPO_ROOT, 'tests', 'fixtures', 'wiki-room-232');

let pass = 0;
let total = 0;
async function check(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// A fetch impl that fails the test loudly if it is ever called (Test 1 guard).
function fetchThatMustNotBeCalled() {
  throw new Error('network reached despite no api key');
}

// Build a canned Anthropic /v1/messages response whose first text block is `text`.
function cannedResponse(text, opts) {
  const o = opts || {};
  return async function () {
    return {
      ok: o.ok !== false,
      status: o.status || 200,
      json: async () => ({ content: [{ type: 'text', text }] }),
    };
  };
}

(async () => {
  // Test 1: null key resolves no_api_key with NO network attempt.
  await check('Test 1: null key -> {ok:false, error:no_api_key}, no network', async () => {
    const r = await generateBriefing(FIXTURE_ROOM, {
      resolveKey: () => null,
      fetchImpl: fetchThatMustNotBeCalled,
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'no_api_key');
  });

  // Test 2: key + fetch returning valid-JSON text block -> ok:true briefing.
  await check('Test 2: valid JSON text block -> {ok:true, briefing:{...}}', async () => {
    const payload = JSON.stringify({
      critical_misses: ['no evidence for the core demand claim', 'competitor set undefined'],
      reframe: 'This is a distribution problem, not a product problem.',
      next_steps: ['interview 5 buyers', 'size the beachhead segment'],
    });
    const r = await generateBriefing(FIXTURE_ROOM, {
      resolveKey: () => 'sk-test-key',
      fetchImpl: cannedResponse(payload),
    });
    assert.equal(r.ok, true);
    assert.ok(r.briefing, 'briefing present');
    assert.ok(Array.isArray(r.briefing.critical_misses));
    assert.equal(r.briefing.critical_misses.length, 2);
    assert.equal(typeof r.briefing.reframe, 'string');
    assert.ok(Array.isArray(r.briefing.next_steps));
    assert.equal(r.briefing.next_steps.length, 2);
  });

  // Test 2b: model wraps JSON in a markdown code fence -> still parses.
  await check('Test 2b: fenced JSON is unwrapped and parsed', async () => {
    const payload =
      '```json\n' +
      JSON.stringify({ critical_misses: ['x'], reframe: 'y', next_steps: ['z'] }) +
      '\n```';
    const r = await generateBriefing(FIXTURE_ROOM, {
      resolveKey: () => 'sk-test-key',
      fetchImpl: cannedResponse(payload),
    });
    assert.equal(r.ok, true);
    assert.equal(r.briefing.reframe, 'y');
  });

  // Test 3: HTTP 500 (ok:false) -> api_error, never throws.
  await check('Test 3: HTTP 500 -> {ok:false, error:api_error}', async () => {
    const r = await generateBriefing(FIXTURE_ROOM, {
      resolveKey: () => 'sk-test-key',
      fetchImpl: cannedResponse('irrelevant', { ok: false, status: 500 }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'api_error');
  });

  // Test 4: text block that is NOT valid JSON -> api_error (parse caught).
  await check('Test 4: non-JSON text block -> {ok:false, error:api_error}', async () => {
    const r = await generateBriefing(FIXTURE_ROOM, {
      resolveKey: () => 'sk-test-key',
      fetchImpl: cannedResponse('Larry says: this room needs more evidence, not JSON.'),
    });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'api_error');
  });

  console.log(`\ntest-232-briefing.cjs: ${pass}/${total} passed`);
  if (pass !== total) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
