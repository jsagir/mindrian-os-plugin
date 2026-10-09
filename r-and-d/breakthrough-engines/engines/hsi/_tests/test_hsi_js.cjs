'use strict';
/*
 * Tests for lib/core/hsi-lsa.cjs, hsi-spectral.cjs, hsi-engine.cjs (stubs stand in for the missing plugin modules).
 * Run: node --test package-2026/hsi/_tests/test_hsi_js.cjs     (from the research directory)
 */
require('./_stub_loader.cjs');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CORE = path.resolve(__dirname, '..', 'lib', 'core');
const lsa = require(path.join(CORE, 'hsi-lsa.cjs'));
const spectral = require(path.join(CORE, 'hsi-spectral.cjs'));
const engine = require(path.join(CORE, 'hsi-engine.cjs'));

const BODY = {
  'finance/billing-flow': 'The payment settlement process suffers from a queue bottleneck at month end. Invoice backlog grows because billing approvals cannot keep pace. We propose a scheduler algorithm to drain the invoice queue using priority heuristics. Billing teams cross-check every payment before settlement. This is a hard problem for the finance team.',
  'ops/delivery-routing': 'Delivery logistics face congestion at the regional hub, a classic bottleneck. Shipping backlog builds when the route plan cannot absorb peak demand. Our approach applies an optimizer heuristic to balance each route and clear the queue. Logistics planners connect depot data with delivery windows. The challenge is the same everywhere.',
  'health/vaccine-rollout': 'Vaccine inoculation campaigns need cold storage and trained staff in every district. Immunization coverage depends on antigen supply reaching clinics on time. Nurses record each vaccine dose in the registry for later audits. Public health teams review antigen stock weekly across regions.',
  'health/antigen-research': 'Antigen research studies how immunization produces lasting protection in patients. The vaccine trial measured antibody response across several age groups carefully. Researchers compare inoculation schedules and report the evidence in detail.',
};
function makeRoom() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hsi-js-'));
  for (const [rel, text] of Object.entries(BODY)) {
    const p = path.join(root, rel + '.md');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '# ' + path.basename(rel) + '\n\n' + text + '\n');
  }
  return root;
}
const TEXTS = Object.keys(BODY).sort().map((k) => BODY[k]);

test('spectral gap matches numpy.linalg.eigvals on 60 random transition matrices', () => {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'numpy_spectral_cases.json'), 'utf8'));
  let maxGap = 0; let maxSt = 0;
  for (const c of cases) {
    maxGap = Math.max(maxGap, Math.abs(spectral.computeSpectralGap(c.P) - c.gap));
    spectral.computeStationaryDistribution(c.P).forEach((v, i) => { maxSt = Math.max(maxSt, Math.abs(v - c.st[i])); });
  }
  assert.ok(maxGap < 1e-9, 'max gap error ' + maxGap);
  assert.ok(maxSt < 1e-9, 'max stationary error ' + maxSt);
});

test('spectral gap: lambda and -lambda (equal modulus) case that broke unshifted QR', () => {
  // two-state flip chain: eigenvalues 1 and -1 -> gap 0 ; with smoothing slightly above 0
  assert.ok(Math.abs(spectral.computeSpectralGap([[0, 1], [1, 0]]) - 0) < 1e-9);
  assert.strictEqual(spectral.computeSpectralGap([]), 0);
  assert.strictEqual(spectral.computeSpectralGap([[1]]), 0);
});

test('spectral: classifier, matrix rows sum to 1, score bounded', () => {
  assert.strictEqual(spectral.classifySentenceMode('we should connect and bridge these ideas'), 'integrative');
  assert.strictEqual(spectral.classifySentenceMode('zzz qqq'), 'descriptive');
  const P = spectral.buildTransitionMatrix(['integrative', 'creative', 'integrative', 'analytical']);
  P.forEach((row) => assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-12));
  const sc = spectral.computeOmhmmScore(BODY['finance/billing-flow'] + ' ' + BODY['ops/delivery-routing']);
  assert.ok(sc >= 0 && sc <= 100);
});

test('lsa: unchanged contract (square, symmetric, unit diagonal, [0,1]), degenerate -> identity', () => {
  const m = lsa.computeLsaSimilarity(TEXTS);
  assert.strictEqual(m.length, 4);
  for (let i = 0; i < 4; i += 1) {
    assert.ok(Math.abs(m[i][i] - 1) < 1e-9);
    for (let j = 0; j < 4; j += 1) { assert.ok(Math.abs(m[i][j] - m[j][i]) < 1e-9); assert.ok(m[i][j] >= 0 && m[i][j] <= 1); }
  }
  assert.deepStrictEqual(lsa.computeLsaSimilarity([]), []);
  assert.deepStrictEqual(lsa.computeLsaSimilarity(['the of and', 'a an']), [[1, 0], [0, 1]]);
  assert.strictEqual(typeof lsa.classifyDirectionB, 'function');
});

test('lsa: non-finite cosine values clip to 0 (zero-norm row no longer leaks NaN)', () => {
  // a document with no usable vocabulary next to normal ones yields a zero reduced row
  const m = lsa.computeLsaSimilarity([BODY['finance/billing-flow'], BODY['ops/delivery-routing'], 'the of and a', BODY['health/vaccine-rollout']]);
  m.forEach((row) => row.forEach((v) => assert.ok(Number.isFinite(v))));
});

test('lsa detailed: reports the reason for an identity fallback', () => {
  const d = lsa.computeLsaSimilarityDetailed(['the of and', 'a an']);
  assert.strictEqual(d.degraded, true);
  assert.strictEqual(d.reason, 'empty_vocabulary');
  assert.strictEqual(lsa.computeLsaSimilarityDetailed(TEXTS).degraded, false);
});

test('bm25: symmetric, unit diagonal, topical pair above unrelated pair, degenerate safe', () => {
  const names = Object.keys(BODY).sort();
  const s = lsa.computeBm25Similarity(TEXTS);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) assert.ok(Math.abs(s[i][j] - s[j][i]) < 1e-12);
  const v = names.indexOf('health/vaccine-rollout'); const a = names.indexOf('health/antigen-research'); const f = names.indexOf('finance/billing-flow');
  assert.ok(s[v][a] > s[v][f]);
  assert.deepStrictEqual(lsa.computeBm25Similarity(['the and']), [[1]]);
  assert.deepStrictEqual(lsa.computeBm25Similarity(['the of', 'and or']), [[1, 0], [0, 1]]);
  assert.deepStrictEqual(lsa.computeBm25Similarity([]), []);
});

test('hybrid lexical is the mean of LSA and BM25', () => {
  const h = lsa.computeHybridLexicalSimilarity(TEXTS);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) assert.ok(Math.abs(h.hybrid[i][j] - 0.5 * (h.lsa[i][j] + h.bm25[i][j])) < 1e-12);
});

test('percentile and zscore helpers (ties, one value, empty, zero spread)', () => {
  assert.deepStrictEqual(lsa.empiricalPercentile([]), []);
  assert.deepStrictEqual(lsa.empiricalPercentile([7]), [1]);
  assert.deepStrictEqual(lsa.empiricalPercentile([1, 2, 2, 3]), [0, 0.5, 0.5, 1]);
  assert.deepStrictEqual(lsa.zscores([0.3, 0.3]), [0, 0]);
  const z = lsa.zscores([1, 2, 3]);
  assert.ok(Math.abs(z[0] + z[2]) < 1e-12);
});

// ---- engine -----------------------------------------------------------------------------------------------
function artifactsFor(n) {
  const keys = Object.keys(BODY).sort();
  return Array.from({ length: n }, (_, i) => ({ id: 's/a' + i, section: 's', title: 'A' + i, path: 's/a' + i + '.md', text: BODY[keys[i % 4]] + ' variant ' + i }));
}
function randSym(n, seed) {
  let x = seed;
  const rnd = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) { m[i][i] = 1; for (let j = i + 1; j < n; j += 1) { m[i][j] = rnd(); m[j][i] = m[i][j]; } }
  return m;
}

test('engine legacy computeHsiMatrix equals the original formula and sort', () => {
  const arts = artifactsFor(8); const L = randSym(8, 1); const S = randSym(8, 2);
  const { pairs, spectralProfiles } = engine.computeHsiMatrix(arts, L, S, 0.30);
  const om = spectralProfiles.map((p) => p.omhmm_score);
  const ref = [];
  for (let i = 0; i < 8; i += 1) for (let j = i + 1; j < 8; j += 1) {
    const d = 0.6 * Math.abs(S[i][j] - L[i][j]) + 0.4 * Math.sqrt(om[i] * om[j]) / 100;
    if (d < 0.30) continue;
    ref.push([arts[i].id, arts[j].id, Math.round(d * 1e4) / 1e4]);
  }
  ref.sort((a, b) => b[2] - a[2]);
  assert.deepStrictEqual(pairs.map((p) => [p.left_id, p.right_id, p.hsi_score]), ref.slice(0, 20));
  assert.ok(pairs.length > 0);
  for (const k of ['left_id', 'right_id', 'lsa_sim', 'semantic_sim', 'hsi_score', 'surprise_type', 'breakthrough_potential', 'spectral_gap_avg', 'left_dominant_mode', 'right_dominant_mode']) assert.ok(k in pairs[0], k);
});

test('engine percentile ranking has no fixed cutoff, is deterministic, sorted, filtered by min percentile', () => {
  const arts = artifactsFor(7); const tiny = randSym(7, 3).map((r) => r.map((v) => v * 0.01));
  const legacy = engine.computeHsiMatrix(arts, tiny, tiny, 5.0);
  assert.strictEqual(legacy.pairs.length, 0);
  const a = engine.computeHsiMatrix(arts, tiny, randSym(7, 4).map((r) => r.map((v) => v * 0.01)), null, { ranking: 'percentile', topK: 5, computedAt: 'T' });
  const b = engine.computeHsiMatrix(arts, tiny, randSym(7, 4).map((r) => r.map((v) => v * 0.01)), null, { ranking: 'percentile', topK: 5, computedAt: 'T' });
  assert.strictEqual(a.pairs.length, 5);
  assert.deepStrictEqual(a.pairs, b.pairs);
  const sc = a.pairs.map((p) => p.hsi_score);
  assert.deepStrictEqual(sc, sc.slice().sort((x, y) => y - x));
  assert.strictEqual(a.pairs[0].rank, 1);
  const hi = engine.computeHsiMatrix(arts, tiny, randSym(7, 4), null, { ranking: 'percentile', topK: 0, minPercentile: 0.8 });
  assert.ok(hi.pairs.every((p) => p.hsi_percentile >= 0.8));
  assert.ok(hi.pairs.length <= 6);
});

test('engine second signal, source trail, novelty check', () => {
  const arts = artifactsFor(5);
  const { pairs } = engine.computeHsiMatrix(arts, randSym(5, 5), randSym(5, 6), null, { ranking: 'percentile', bm25Matrix: randSym(5, 7), topK: 3 });
  const p = pairs[0];
  assert.strictEqual(p.second_signal.method, 'bm25_vs_dense_surprise');
  assert.strictEqual(typeof p.second_signal.confirmed, 'boolean');
  assert.strictEqual(p.source_trail.length, 2);
  assert.ok(p.source_trail[0].extracted_sentence.length > 0);
  assert.strictEqual(p.novelty_check.external_literature, 'not_run');
});

test('engine claim extraction and claim-level scoring with an injected embedder', async () => {
  const c = engine.extractClaims(BODY['finance/billing-flow']);
  assert.ok(c.problems.some((s) => /bottleneck|backlog/.test(s)));
  assert.ok(c.methods.some((s) => /propose/.test(s)));
  const arts = Object.keys(BODY).sort().map((k) => ({ id: k, text: BODY[k] }));
  const stub = require(path.join(__dirname, 'stubs', 'semantic-index', 'embedding-spine.cjs'));
  const i = arts.findIndex((a) => a.id === 'finance/billing-flow'); const j = arts.findIndex((a) => a.id === 'ops/delivery-routing');
  const res = await engine.claimLevelScores(arts, [[Math.min(i, j), Math.max(i, j)]], async (xs) => (await stub.embedTexts(xs)).vectors);
  const hit = res.get(Math.min(i, j) + ':' + Math.max(i, j));
  assert.ok(hit && hit.claim_sim > 0);
  assert.notStrictEqual(hit.problem_artifact, hit.method_artifact);
});

test('engine runTier1 end to end: new defaults, schema keys, provenance, old keys kept', async () => {
  const room = makeRoom();
  const res = await engine.runTier1(room, {});
  assert.strictEqual(res.metadata.schema_version, '2.0');
  assert.strictEqual(res.metadata.ranking.method, 'percentile');
  assert.strictEqual(res.metadata.provenance.semantic_leg, 'embedding-spine');
  assert.strictEqual(res.metadata.provenance.lexical_leg, 'hybrid');
  for (const k of ['timestamp', 'room_dir', 'tier', 'artifact_count', 'pair_count', 'spectral_version', 'spectral_summary']) assert.ok(k in res.metadata, k);
  assert.ok(res.hsi_pairs.length > 0);
  assert.ok(res.hsi_pairs[0].second_signal);
  const onDisk = JSON.parse(fs.readFileSync(path.join(room, '.hsi-results.json'), 'utf8'));
  assert.strictEqual(onDisk.hsi_pairs.length, res.hsi_pairs.length);
  assert.deepStrictEqual(fs.readdirSync(room).filter((f) => f.endsWith('.tmp')), []);
});

test('engine runTier1 legacy options reproduce the old scheme; tier 2 still refused', async () => {
  const room = makeRoom();
  const res = await engine.runTier1(room, { lexical: 'lsa', ranking: 'legacy' });
  assert.strictEqual(res.metadata.ranking.method, 'legacy');
  assert.strictEqual(res.metadata.ranking.fixed_threshold, 0.30);
  res.hsi_pairs.forEach((p) => { assert.ok(p.hsi_score >= 0.30); assert.strictEqual(p.lexical_sim, p.lsa_sim); });
  const t2 = await engine.runTier1(room, { tier: 2 });
  assert.strictEqual(t2.error, 'not_implemented_this_phase');
});

test('engine runTier1 missing embedder: recorded in provenance, or refused with requireEmbedder', async () => {
  const room = makeRoom();
  const res = await engine.runTier1(room, { embedTexts: async () => ({ success: false }) });
  assert.strictEqual(res.metadata.provenance.semantic_leg, 'unavailable-identity');
  assert.ok(res.metadata.provenance.warnings.some((w) => /no_dense_leg/.test(w)));
  const refused = await engine.runTier1(room, { embedTexts: async () => ({ success: false }), requireEmbedder: true });
  assert.strictEqual(refused.error, 'encoder_unavailable');
  const wrongCount = await engine.runTier1(room, { embedTexts: async () => ({ success: true, vectors: [[1, 0]] }), requireEmbedder: true });
  assert.strictEqual(wrongCount.error, 'encoder_unavailable');
});

test('engine runTier1 with fewer than two artifacts writes an empty result with schema_version', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hsi-js-one-'));
  fs.mkdirSync(path.join(root, 's'));
  fs.writeFileSync(path.join(root, 's', 'one.md'), '# One\n\nonly one artifact here');
  const res = await engine.runTier1(root, { output: path.join(root, 'nested', 'out.json') });
  assert.strictEqual(res.metadata.pair_count, 0);
  assert.strictEqual(res.metadata.schema_version, '2.0');
  assert.ok(fs.existsSync(path.join(root, 'nested', 'out.json')));
});
