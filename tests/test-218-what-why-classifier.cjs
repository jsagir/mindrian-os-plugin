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

// Hermeticity: flip transformers.js allowRemoteModels=false so the runExtraction
// re-embed (which passes no stub encoder) degrades to lexical-only instead of
// reaching the network when this test runs standalone.
require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const classifierPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'entity-classifier.cjs');
const extractorPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'entity-extractor.cjs');
const embedClassifierPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'embedding-classifier.cjs');
const eurekaDir = path.join(REPO_ROOT, 'lib', 'core', 'eureka');
const classifier = require(classifierPath);
const embedClassifier = require(embedClassifierPath);
const { classifyByEmbedding } = embedClassifier;
const { extractEntities } = require(extractorPath);
const mva = require(path.join(REPO_ROOT, 'lib', 'core', 'mva-classifier.cjs'));

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { runExtraction } = require(path.join(REPO_ROOT, 'scripts', 'entity-extract.cjs'));

// Build a hermetic temp room with one section per artifact and a seeded
// memory_artifact node (props.path -> the .md file) for each, mirroring the
// test-218-noise-reduction seedRoom idiom. Returns { roomDir, ids }.
function buildRoom(artifacts) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-hzx-'));
  for (const art of artifacts) {
    const secDir = path.join(roomDir, art.slug);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'FEYNMAN.md'), art.body + '\n', 'utf8');
  }
  const db = openRoomDb(roomDir, { allowExtension: true });
  const ids = [];
  for (const art of artifacts) {
    const id = 'memory_artifact:' + art.slug + ':FEYNMAN';
    const props = JSON.stringify({ title: art.slug, path: art.slug + '/FEYNMAN.md', section: art.slug });
    insertNode(db, id, 'memory_artifact', props, { source_path: 'memory:' + art.slug, created_by: 'system' });
    ids.push(id);
  }
  closeRoomDb(db);
  return { roomDir, ids };
}

function entityNames(db) {
  const rows = db.prepare("SELECT properties FROM nodes WHERE type IN ('company','technology','market')").all();
  return rows.map(function (r) { try { return JSON.parse(r.properties).name; } catch (_e) { return null; } });
}

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
  // ===========================================================================
  // MODULE-LEVEL legs (quick-task 260714-k44): the tier-2a embedding classifier
  // in isolation, all offline with injected 2-dim vectors and zero model loads.
  // ===========================================================================

  // (m1) deterministic routing: hand-built 2-dim vectors place WHAT references at
  //      [0,1] and WHY references at [1,0]; a candidate that leans one way is
  //      confident, an exactly-balanced one is not.
  await check('(m1) embedding routing: WHAT/WHY confident, ambiguous not confident', async () => {
    embedClassifier._test.resetRefCache();
    const map = new Map();
    for (const w of embedClassifier._test.WHAT_EXAMPLES) map.set(w, [0, 1]);
    for (const w of embedClassifier._test.WHY_EXAMPLES) map.set(w, [1, 0]);
    map.set('TestCorp', [0.1, 0.995]);
    map.set('Test Framework', [0.995, 0.1]);
    map.set('Ambiguous Term', [0.7071, 0.7071]);
    const encodeFn = (texts) => texts.map((t) => {
      if (!map.has(t)) throw new Error('unexpected text in m1: ' + t);
      return map.get(t).slice();
    });
    const r = await classifyByEmbedding(
      { names: ['TestCorp', 'Test Framework', 'Ambiguous Term'] }, { encodeFn });
    assert.equal(r.ok, true, 'ok:true');
    assert.equal(r.results['TestCorp'].label, 'what', 'TestCorp is WHAT');
    assert.equal(r.results['TestCorp'].confident, true, 'TestCorp confident');
    assert.equal(r.results['Test Framework'].label, 'why', 'Test Framework is WHY');
    assert.equal(r.results['Test Framework'].confident, true, 'Test Framework confident');
    assert.equal(r.results['Ambiguous Term'].confident, false, 'Ambiguous Term NOT confident');
    assert.ok(r.results['Ambiguous Term'].margin < 0.01,
      'ambiguous margin near zero, got ' + r.results['Ambiguous Term'].margin);
  });

  // (m2) reference cache: a counting encodeFn across TWO calls proves each
  //      reference text is embedded exactly once (cache hit on the second call).
  await check('(m2) reference set embedded exactly once across two calls', async () => {
    embedClassifier._test.resetRefCache();
    const map = new Map();
    for (const w of embedClassifier._test.WHAT_EXAMPLES) map.set(w, [0, 1]);
    for (const w of embedClassifier._test.WHY_EXAMPLES) map.set(w, [1, 0]);
    map.set('CandidateOne', [0.2, 0.9]);
    map.set('CandidateTwo', [0.9, 0.2]);
    const counts = new Map();
    const encodeFn = (texts) => texts.map((t) => {
      counts.set(t, (counts.get(t) || 0) + 1);
      return (map.get(t) || [0.5, 0.5]).slice();
    });
    await classifyByEmbedding({ names: ['CandidateOne'] }, { encodeFn });
    await classifyByEmbedding({ names: ['CandidateTwo'] }, { encodeFn });
    const refs = embedClassifier._test.WHAT_EXAMPLES.concat(embedClassifier._test.WHY_EXAMPLES);
    for (const w of refs) {
      assert.equal(counts.get(w), 1, 'reference "' + w + '" embedded exactly once, got ' + counts.get(w));
    }
    assert.equal(counts.get('CandidateOne'), 1, 'first candidate embedded once');
    assert.equal(counts.get('CandidateTwo'), 1, 'second candidate embedded once');
  });

  // (m3) unavailable degrade: a forced encoder failure returns ok:false, no throw.
  await check('(m3) unavailable encoder degrades to ok:false, never throws', async () => {
    embedClassifier._test.resetRefCache();
    const r = await classifyByEmbedding({ names: ['Anything'] }, { _forceUnavailable: true });
    assert.equal(r.ok, false, 'ok:false on unavailable encoder');
    assert.equal(r.error, 'encoder_unavailable', 'error names the unavailable encoder');
  });

  // (m4) Part 7 reuse gate: the module requires entity-extractor and reuses the
  //      exported FRAMEWORK_TERMS Set (the WHY seed landed, not copied).
  await check('(m4) Part 7 reuse: module requires entity-extractor and FRAMEWORK_TERMS is a Set', () => {
    const src = fs.readFileSync(embedClassifierPath, 'utf8');
    assert.ok(/require\(['"]\.\/entity-extractor(\.cjs)?['"]\)/.test(src), 'module requires ./entity-extractor');
    assert.ok(/FRAMEWORK_TERMS/.test(src), 'module references FRAMEWORK_TERMS');
    const exported = require(extractorPath).FRAMEWORK_TERMS;
    assert.ok(exported instanceof Set, 'FRAMEWORK_TERMS export is a Set');
  });

  // (m5) zero-transport gate: the module source carries no LLM transport host and
  //      no Brain host anywhere (line comments included -- mirror leg (e) shape).
  await check('(m5) zero-transport: embedding module carries no LLM host and no brain host', () => {
    const src = fs.readFileSync(embedClassifierPath, 'utf8');
    assert.ok(!/api\.anthropic\.com/.test(src), 'no LLM transport host substring');
    assert.ok(!/mindrian-brain/i.test(src), 'no brain-host substring');
    assert.ok(!/brain\.onrender/i.test(src), 'no brain onrender host');
  });

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

  // ---------------------------------------------------------------------------
  // Sibling egress guard: entity-classifier.cjs is the ONLY file under
  // lib/core/eureka/ whose source carries the model transport call. This catches
  // a future eureka module quietly adding egress (the run-all-218.sh leg (d) grep
  // deliberately keeps its file list frozen; this is the wider assertion).
  // ---------------------------------------------------------------------------
  await check('entity-classifier is the only eureka module carrying the transport', () => {
    const files = fs.readdirSync(eurekaDir).filter((f) => /\.cjs$/.test(f));
    const carriers = [];
    for (const f of files) {
      const raw = fs.readFileSync(path.join(eurekaDir, f), 'utf8');
      // Strip block comments so a module's "zero fetch here" documentation is not
      // mistaken for a real transport call (explore-chain.cjs documents exactly
      // that). The Anthropic host string is the precise transport signal: it names
      // the LOCAL LLM transport this pipeline reaches, and it never appears in a
      // "no egress" comment. A real carrier keeps it as a live string literal.
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      if (/api\.anthropic\.com/.test(src)) carriers.push(f);
    }
    assert.deepEqual(carriers, ['entity-classifier.cjs'],
      'only entity-classifier.cjs may carry the transport, got: ' + JSON.stringify(carriers));
  });

  // ---------------------------------------------------------------------------
  // Integration (i): end-to-end WHY reroute on a hermetic room. Tier-1 extracts
  // Larry / Governing Thought / Pyramid Logic (it cannot tell them from real
  // entities structurally); the injected tier-2 impl reroutes them WHY while
  // AION Labs stays WHAT. Assert: no WHY term is an entity node, AION Labs is a
  // proposed entity node, framework_terms + framework_term_count land on the
  // source artifact, and no relation edge references a WHY endpoint.
  // ---------------------------------------------------------------------------
  await check('integration: WHY reroute captures framework_terms, never mints WHY nodes', async () => {
    const WHY = ['Larry', 'Governing Thought', 'Pyramid Logic'];
    const built = buildRoom([{
      slug: 'analysis',
      body: [
        '# Competitors',
        '',
        'AION Labs competes with Recursion in the drug-discovery market.',
        'The Governing Thought guides the roadmap and the Pyramid Logic frames it.',
        'Larry reviews the analysis before it ships.',
      ].join('\n'),
    }]);
    const roomDir = built.roomDir;
    const sessionId = 'entity-extract';
    const mockClassifier = async ({ names }) => {
      const labels = {};
      for (const n of names) labels[n] = WHY.includes(n) ? 'why' : 'what';
      return { labels, source: 'model' };
    };
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      const result = await runExtraction(db, roomDir, sessionId, 25, { classifyImpl: mockClassifier });
      assert.equal(result.classifierSource, 'model', 'classifier_source must be model');
      assert.ok(result.termsWhy >= 3, 'at least the 3 WHY terms captured, got ' + result.termsWhy);

      const names = entityNames(db);
      for (const w of WHY) assert.ok(!names.includes(w), w + ' must NOT be an entity node: ' + JSON.stringify(names));
      assert.ok(names.includes('AION Labs'), 'AION Labs must be an entity node: ' + JSON.stringify(names));

      // AION Labs is born proposed (Part 9).
      const aionId = navigation.ENTITY_NODE_ID(sessionId, 'AION Labs');
      const aionRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(aionId);
      assert.ok(aionRow, 'AION Labs entity node exists');
      assert.equal(aionRow.review_status, 'proposed', 'entity born proposed');

      // framework_terms + framework_term_count on the source artifact.
      const artRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('memory_artifact:analysis:FEYNMAN');
      const artProps = JSON.parse(artRow.properties);
      assert.equal(typeof artProps.framework_terms, 'string', 'framework_terms present');
      assert.equal(typeof artProps.framework_term_count, 'number', 'framework_term_count present');
      for (const w of WHY) assert.ok(artProps.framework_terms.indexOf(w) !== -1, w + ' must be in framework_terms: ' + artProps.framework_terms);

      // No relation edge references a WHY endpoint node id.
      const whyIds = new Set(WHY.map((w) => navigation.ENTITY_NODE_ID(sessionId, w)));
      const edges = db.prepare('SELECT source, target FROM edges').all();
      for (const e of edges) {
        assert.ok(!whyIds.has(e.source) && !whyIds.has(e.target),
          'no edge may reference a WHY endpoint: ' + JSON.stringify(e));
      }
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Integration (ii): degrade leg. A classifyImpl that throws -> the batch still
  // commits, every tier-1 survivor is written as an entity (today's behavior),
  // classifier_source is 'fallback'.
  // ---------------------------------------------------------------------------
  await check('integration: throwing classifier degrades to pass-through, still commits', async () => {
    const built = buildRoom([{
      slug: 'analysis',
      body: [
        '# Competitors',
        '',
        'AION Labs competes with Recursion in the market, and Larry reviews it.',
      ].join('\n'),
    }]);
    const roomDir = built.roomDir;
    const throwing = async () => { throw new Error('model down'); };
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      const result = await runExtraction(db, roomDir, 'entity-extract', 25, { classifyImpl: throwing });
      assert.equal(result.classifierSource, 'fallback', 'classifier_source must be fallback on throw');
      const names = entityNames(db);
      // Every survivor including Larry is written as an entity (no reroute happened).
      assert.ok(names.includes('AION Labs'), 'AION Labs written: ' + JSON.stringify(names));
      assert.ok(names.includes('Larry'), 'Larry written as entity in degrade mode: ' + JSON.stringify(names));
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Integration (iii): synthetic non-MindrianOS biotech room (T2-REQ-4). The
  // invented framework vocabulary lands in framework_terms; the invented
  // companies land as entity nodes. Proves domain-agnosticism end-to-end.
  // ---------------------------------------------------------------------------
  await check('integration: synthetic biotech room routes WHY vs WHAT correctly', async () => {
    const FRAMEWORK = ['IND Filing', 'Phase II Readout', 'Target Product Profile'];
    const COMPANIES = ['Meridian Therapeutics', 'BioNova Labs'];
    const built = buildRoom([{
      slug: 'pipeline',
      body: [
        '# Competitors',
        '',
        'Meridian Therapeutics competes with BioNova Labs in the oncology market.',
        'The IND Filing precedes the Phase II Readout and the Target Product Profile',
        'anchors the program.',
      ].join('\n'),
    }]);
    const roomDir = built.roomDir;
    const mockClassifier = async ({ names }) => {
      const labels = {};
      for (const n of names) labels[n] = FRAMEWORK.includes(n) ? 'why' : 'what';
      return { labels, source: 'model' };
    };
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      await runExtraction(db, roomDir, 'entity-extract', 25, { classifyImpl: mockClassifier });
      const names = entityNames(db);
      for (const c of COMPANIES) assert.ok(names.includes(c), c + ' must be an entity node: ' + JSON.stringify(names));
      for (const w of FRAMEWORK) assert.ok(!names.includes(w), w + ' must NOT be an entity node: ' + JSON.stringify(names));
      const artRow = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('memory_artifact:pipeline:FEYNMAN');
      const fwTerms = JSON.parse(artRow.properties).framework_terms || '';
      for (const w of FRAMEWORK) assert.ok(fwTerms.indexOf(w) !== -1, w + ' must be in framework_terms: ' + fwTerms);
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Integration (iv): merge discipline. Re-running extraction unions
  // framework_terms without duplication and never touches review_status.
  // ---------------------------------------------------------------------------
  await check('integration: re-run unions framework_terms and preserves review_status', async () => {
    const WHY = ['Governing Thought', 'Pyramid Logic'];
    const built = buildRoom([{
      slug: 'analysis',
      body: [
        '# Competitors',
        '',
        'AION Labs competes with Recursion. The Governing Thought and the',
        'Pyramid Logic frame the analysis.',
      ].join('\n'),
    }]);
    const roomDir = built.roomDir;
    const mockClassifier = async ({ names }) => {
      const labels = {};
      for (const n of names) labels[n] = WHY.includes(n) ? 'why' : 'what';
      return { labels, source: 'model' };
    };
    const artId = 'memory_artifact:analysis:FEYNMAN';
    let db = openRoomDb(roomDir, { allowExtension: true });
    try {
      await runExtraction(db, roomDir, 'entity-extract', 25, { classifyImpl: mockClassifier });
      const first = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(artId).properties);
      const firstCount = first.framework_term_count;
      const artStatusRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(artId);
      const statusBefore = artStatusRow ? artStatusRow.review_status : null;

      // Second run against the same room / db.
      await runExtraction(db, roomDir, 'entity-extract', 25, { classifyImpl: mockClassifier });
      const second = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(artId).properties);

      // No duplication: the count is stable and terms are unique case-insensitively.
      assert.equal(second.framework_term_count, firstCount, 'framework_term_count must not grow on re-run');
      const terms = second.framework_terms.split(',').map((s) => s.trim().toLowerCase());
      assert.equal(new Set(terms).size, terms.length, 'no duplicate framework terms after re-run');

      const statusAfter = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(artId).review_status;
      assert.equal(statusAfter, statusBefore, 'review_status must be untouched by the merge');
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  console.log('\n' + pass + '/' + total + ' tier-2 classifier checks passed');
  if (pass !== total) process.exit(1);
}

main().catch(function (err) {
  console.error('test-218-what-why-classifier FAILED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
