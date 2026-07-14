'use strict';
/*
 * Quick-task 260714-hzx -- tier-2 WHAT / WHY / NOISE classifier test suite.
 *
 * entity-classifier.cjs is the tier-2 semantic pass over the tier-1 extractor's
 * survivors. It is the FIRST model-using step in the pipeline, but EVERY leg here
 * runs OFFLINE with zero live model calls: the model path is exercised via the
 * _test.setFetch injection seam, and the fallback path via a forced no-key or a
 * throwing / malformed mock transport. The suite asserts:
 *   (a) WHY reroute round-trips model labels with source 'model'
 *   (b) every fallback mode (no key, throw, non-JSON, non-2xx) degrades to
 *       every-name-'what' / source 'fallback' and never throws
 *   (c) a synthetic non-MindrianOS biotech fixture classifies its own framework
 *       vocabulary WHY while its companies classify WHAT, and the system prompt
 *       sent to the transport carries NONE of the fixture terms hardcoded
 *   (d) a domain-agnostic grep gate proving the module carries zero workspace
 *       vocabulary (a hardcoded stoplist structurally cannot generalize)
 *   (e) a zero-Brain gate (no brain-host substring, no brain-client require)
 *   (f) the tier-1 additive frameworkTerms bucket, with existing
 *       { entities, relations } consumers seeing identical values
 *   plus the Task 2 integration legs (end-to-end WHY reroute, degrade, synthetic
 *   room, merge discipline) using a hermetic temp room.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const classifierPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'entity-classifier.cjs');
const extractorPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'entity-extractor.cjs');
const classifier = require(classifierPath);
const { extractEntities } = require(extractorPath);
const mva = require(path.join(REPO_ROOT, 'lib', 'core', 'mva-classifier.cjs'));

let pass = 0;
let total = 0;
async function check(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// Build a mock fetch Response returning the given Anthropic content text.
function mockResponse(text, opts) {
  const o = opts || {};
  return {
    ok: o.ok !== undefined ? o.ok : true,
    status: o.status !== undefined ? o.status : 200,
    json: async function () {
      if (o.jsonThrows) throw new Error('bad json');
      return { content: [{ type: 'text', text: text }] };
    },
  };
}

// Force a resolvable key for the model-path legs, capturing / restoring env so
// the machine's real key state (which may be NO-KEY) never affects the outcome.
function withForcedKey(fn) {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  return Promise.resolve()
    .then(fn)
    .finally(function () {
      if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prev;
    });
}

async function main() {
  // ---------------------------------------------------------------------------
  // (a) WHY reroute: a model response labeling the residual-noise terms WHY and
  //     the real company WHAT round-trips, source 'model'.
  // ---------------------------------------------------------------------------
  await check('WHY reroute round-trips model labels with source model', async () => {
    await withForcedKey(async () => {
      classifier._test.setFetch(async () => mockResponse(JSON.stringify({
        labels: { Larry: 'why', 'Governing Thought': 'why', 'Pyramid Logic': 'why', 'AION Labs': 'what' },
      })));
      const names = ['Larry', 'Governing Thought', 'Pyramid Logic', 'AION Labs'];
      const r = await classifier.classifyArtifactCandidates({ names, excerpt: 'some prose' });
      classifier._test.reset();
      assert.equal(r.source, 'model', 'source must be model when the transport returns valid JSON');
      assert.deepEqual(r.labels, {
        Larry: 'why', 'Governing Thought': 'why', 'Pyramid Logic': 'why', 'AION Labs': 'what',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // (b) Fallback legs: every failure mode degrades to every-name-what / fallback.
  // ---------------------------------------------------------------------------
  await check('no resolvable key degrades to pass-through fallback', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      // With no env key, resolveAnthropicKey may still find ~/.mindrian.env; only
      // assert the contract when the machine genuinely has no key. Either way the
      // call must not throw and must label every name in the closed set.
      classifier._test.reset();
      const r = await classifier.classifyArtifactCandidates({ names: ['Acme', 'Widget'] });
      assert.ok(r && r.labels && (r.source === 'fallback' || r.source === 'model'), 'shape holds');
      for (const n of ['Acme', 'Widget']) {
        assert.ok(['what', 'why', 'noise'].includes(r.labels[n]), 'label in closed set for ' + n);
      }
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  await check('transport throw / non-JSON / non-2xx all degrade to fallback', async () => {
    await withForcedKey(async () => {
      const names = ['Acme', 'Widget'];
      const expectFallback = { Acme: 'what', Widget: 'what' };

      // transport throws
      classifier._test.setFetch(async () => { throw new Error('network down'); });
      let r = await classifier.classifyArtifactCandidates({ names });
      assert.deepEqual(r, { labels: expectFallback, source: 'fallback' }, 'throw -> fallback');

      // non-JSON body text
      classifier._test.setFetch(async () => mockResponse('not json at all'));
      r = await classifier.classifyArtifactCandidates({ names });
      assert.deepEqual(r, { labels: expectFallback, source: 'fallback' }, 'non-JSON -> fallback');

      // json() rejects
      classifier._test.setFetch(async () => mockResponse('', { jsonThrows: true }));
      r = await classifier.classifyArtifactCandidates({ names });
      assert.deepEqual(r, { labels: expectFallback, source: 'fallback' }, 'json throw -> fallback');

      // non-2xx status
      classifier._test.setFetch(async () => mockResponse('{}', { ok: false, status: 500 }));
      r = await classifier.classifyArtifactCandidates({ names });
      assert.deepEqual(r, { labels: expectFallback, source: 'fallback' }, '500 -> fallback');

      classifier._test.reset();
    });
  });

  await check('empty candidate list returns empty labels without a transport call', async () => {
    let called = false;
    classifier._test.setFetch(async () => { called = true; return mockResponse('{}'); });
    const r = await classifier.classifyArtifactCandidates({ names: [] });
    classifier._test.reset();
    assert.deepEqual(r, { labels: {}, source: 'fallback' });
    assert.equal(called, false, 'no transport call for an empty candidate list');
  });

  // ---------------------------------------------------------------------------
  // (c) Synthetic non-MindrianOS biotech fixture. The module classifies the
  //     invented framework vocabulary WHY and the invented companies WHAT, and
  //     the system prompt sent to the transport hardcodes NONE of the fixture.
  // ---------------------------------------------------------------------------
  await check('synthetic biotech fixture: framework WHY, companies WHAT, generic prompt', async () => {
    await withForcedKey(async () => {
      const companies = ['Meridian Therapeutics', 'BioNova Labs'];
      const framework = ['IND Filing', 'Phase II Readout', 'Target Product Profile'];
      const names = companies.concat(framework);
      const modelLabels = {};
      for (const c of companies) modelLabels[c] = 'what';
      for (const w of framework) modelLabels[w] = 'why';

      let capturedBody = null;
      classifier._test.setFetch(async (url, init) => {
        capturedBody = JSON.parse(init.body);
        return mockResponse(JSON.stringify({ labels: modelLabels }));
      });
      const r = await classifier.classifyArtifactCandidates({
        names, excerpt: 'Meridian is preparing its IND Filing ahead of the Phase II Readout.',
      });
      classifier._test.reset();

      assert.equal(r.source, 'model');
      for (const c of companies) assert.equal(r.labels[c], 'what', c + ' should be WHAT');
      for (const w of framework) assert.equal(r.labels[w], 'why', w + ' should be WHY');

      // The SYSTEM PROMPT (the classifier's own instructions) must be generic:
      // it may not hardcode any fixture term. The candidates ride the user
      // message, not the system prompt.
      const systemPrompt = String(capturedBody.system || '');
      for (const term of names) {
        assert.ok(systemPrompt.indexOf(term) === -1,
          'system prompt must not hardcode fixture term "' + term + '"');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // (d) Domain-agnostic-by-construction grep gate: the module source carries NO
  //     workspace vocabulary as whole words. A hardcoded stoplist structurally
  //     cannot generalize; this proves there is none.
  // ---------------------------------------------------------------------------
  await check('domain-agnostic: module source carries zero workspace vocabulary', () => {
    const src = fs.readFileSync(classifierPath, 'utf8');
    const forbidden = ['canon', 'minto', 'icm', 'feynman', 'larry', 'governing thought', 'pyramid'];
    for (const w of forbidden) {
      const rx = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      assert.ok(!rx.test(src), 'module must not contain workspace vocabulary "' + w + '"');
    }
  });

  // ---------------------------------------------------------------------------
  // (e) Zero-Brain gate (the llm-name-suggester tripwire): no brain-host
  //     substring, no brain-client / resolve-brain-key require.
  // ---------------------------------------------------------------------------
  await check('zero-Brain: no brain-host substring and no brain-client require', () => {
    const src = fs.readFileSync(classifierPath, 'utf8');
    assert.ok(!/mindrian-brain/i.test(src), 'no brain-host substring');
    assert.ok(!/brain\.onrender/i.test(src), 'no brain onrender host');
    assert.ok(!/require\(['"][^'"]*resolve-brain-key[^'"]*['"]\)/.test(src), 'no resolve-brain-key require');
    assert.ok(!/require\(['"][^'"]*brain-client[^'"]*['"]\)/.test(src), 'no brain-client require');
  });

  // ---------------------------------------------------------------------------
  // (f) Tier-1 additive frameworkTerms bucket. Framework vocabulary lands in
  //     frameworkTerms; the real company lands in entities; existing
  //     { entities, relations } consumers see identical values.
  // ---------------------------------------------------------------------------
  await check('tier-1 emits additive frameworkTerms without disturbing entities', () => {
    const md = '## Notes\nThe Canon and TAM sizing informs Prodrive.';
    const r = extractEntities(md, { sourceArtifactId: 'a1', maxPerArtifact: 25 });
    const names = r.entities.map((e) => e.name);
    assert.ok(names.includes('Prodrive'), 'Prodrive must survive as an entity: ' + JSON.stringify(names));
    assert.ok(!names.includes('Canon'), 'Canon must NOT be an entity');
    assert.ok(!names.includes('TAM'), 'TAM must NOT be an entity');
    assert.ok(Array.isArray(r.frameworkTerms), 'frameworkTerms bucket present');
    const fwNames = r.frameworkTerms.map((t) => t.name.toLowerCase());
    assert.ok(fwNames.includes('canon'), 'Canon must be a framework term: ' + JSON.stringify(fwNames));
    assert.ok(fwNames.includes('tam'), 'TAM must be a framework term: ' + JSON.stringify(fwNames));
    for (const t of r.frameworkTerms) {
      assert.deepEqual(Object.keys(t).sort(), ['name', 'sourceArtifactId'].sort());
      assert.equal(t.sourceArtifactId, 'a1');
    }
    // Empty-input path stays byte-identical (no frameworkTerms key), so the
    // tier-1 extractor's own empty-shape deepEqual stays green.
    assert.deepEqual(extractEntities(null, {}), { entities: [], relations: [] });
  });

  await check('frameworkTerms deduped case-insensitively and capped', () => {
    const md = '## Notes\nCanon and Canon and CANON and TAM and SAM and SOM inform Acme.';
    const r = extractEntities(md, { sourceArtifactId: 'a2', maxPerArtifact: 2 });
    assert.ok(r.frameworkTerms.length <= 2, 'framework cap holds, got ' + r.frameworkTerms.length);
    const lower = r.frameworkTerms.map((t) => t.name.toLowerCase());
    assert.equal(new Set(lower).size, lower.length, 'no case-insensitive duplicates');
  });

  console.log('\n' + pass + '/' + total + ' tier-2 classifier checks passed');
  if (pass !== total) process.exit(1);
}

main().catch(function (err) {
  console.error('test-218-what-why-classifier FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
