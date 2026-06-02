'use strict';
/*
 * Phase 131-03 -- source-lens-driver behavior suite (RED-first).
 *
 * Covers the Stage 3-4 source-lens driver + the lens-engine source-family
 * activation + the weighted-by-context rotation mode. The module under test is
 * lib/lens-engine/source-lens-driver.cjs (CREATED by Task 2; this suite fails RED
 * until then because the require throws / runSourceLens is absent). Task 1 also
 * asserts the lens-engine registry + mode amendments (those pass GREEN once the
 * Task-1 lens-engine edit lands, but the driver-behavior + Task-3 grep tests stay
 * RED until Task 2 / Task 3).
 *
 * Invariants proven here (the plan must_haves + the re-baseline hard constraints):
 *   Task 1 -- registry/mode:
 *     - LENS_REGISTRY.source is ACTIVE (client_count 1) with a lens_sets entry;
 *       domain / framework / trend stay reserved (client_count 0).
 *     - ROTATION_MODES includes 'weighted-by-context' (4 members); serial /
 *       parallel / single still present.
 *     - rotate({ lensType:'source', ... }) no longer returns lens_family_reserved.
 *   Task 2 -- driver:
 *     - runSourceLens fetches ONLY via the injected _fetchCorpus stub; a process
 *       spy proves ZERO child_process / spawn during a run.
 *     - dedup: a fetched item matching a prior_research entry (url / DOI) is
 *       removed before ranking.
 *     - ranking: findings rank by evidence-tier first (Academic before
 *       Practitioner), then by relevance %; the commit-stage flag drops None-tier.
 *     - the driver returns at most the top-5 ranked findings, each carrying
 *       source / url / retrieved_at / evidence_tier / relevance.
 *     - a per-source fetch failure degrades that lens to empty, never aborts.
 *   Task 3 -- directive greps:
 *     - ZERO functional child_process / spawn / execSync / .py / scripts/hsi in
 *       the driver + research-context-extractor (comment-only lines stripped).
 *     - the driver source requires lib/core/research-corpus.cjs (consume-130.5).
 *
 * Canon Part 5: evidence-tier ordering (Academic > Operational > Practitioner > None).
 * Canon Part 8: the driver fetches ONLY via the 130.5 corpus (shared pre-egress
 *   audit); no bespoke fetcher; this suite uses a stub so no live network.
 * NO em-dashes in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const EMDASH = String.fromCharCode(8212);

const engine = require(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'));

const DRIVER_PATH = path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs');
const EXTRACTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'research-context-extractor.cjs');

// Lazy require so a missing driver is a clean FAIL, not a load crash (RED).
function loadDriver() {
  return require(DRIVER_PATH);
}

// ---------------------------------------------------------------------------
// A deterministic fetchCorpus stub (the _fetchCorpus seam). It returns a fixed
// per-source item list and NEVER touches the network. Records calls so the suite
// can assert the driver fetched only through it.
// ---------------------------------------------------------------------------
function makeFetchStub(map, calls) {
  return async function fetchCorpusStub(args) {
    const a = (args && typeof args === 'object') ? args : {};
    if (calls) calls.push({ source: a.source, query: a.query, limit: a.limit });
    if (typeof map[a.source] === 'function') return map[a.source](a);
    return Array.isArray(map[a.source]) ? map[a.source] : [];
  };
}

// A canonical corpus item shape (mirrors research-corpus normalized paper).
function item(over) {
  return Object.assign({
    id: 'https://example.org/x',
    title: 'A title',
    abstract: 'pricing model revenue premium tier churn',
    authors: [],
    institution: '',
    doi: null,
    source: 'openalex',
    fetched_at: new Date().toISOString(),
  }, over || {});
}

// A hot preflight: financial-model gap so the relevance token-match has signal.
function hotPreflight(priorResearch) {
  return {
    active_workflow: 'build-thesis',
    active_jtbd: { jtbd: 'thesis-build' },
    operator: null,
    current_section: 'financial-model',
    recent_changes: [],
    evidence_gaps: [
      { id: 'c1', type: 'claim', summary: 'premium pricing tier drives revenue', text: 'premium pricing tier drives revenue' },
    ],
    prior_research: Array.isArray(priorResearch) ? priorResearch : [],
    role_blend: { investor: 0.6, founder: 0.4 },
  };
}

// The Plan-02 ordered weighted lens set (descending weight).
function hotLensSet() {
  return [
    { lens: 'scholarly', weight: 1.0 },
    { lens: 'industry', weight: 0.8 },
    { lens: 'patent', weight: 0.6 },
    { lens: 'brain', weight: 0.7 },
    { lens: 'competitive-intelligence', weight: 0.7 },
  ];
}

// ===========================================================================
// TASK 1 -- lens-engine source-family activation + weighted mode
// ===========================================================================

test('T1.1: LENS_REGISTRY.source is ACTIVE (client_count 1) with a lens_sets entry', () => {
  const src = engine.LENS_REGISTRY.source;
  ok(src && typeof src === 'object', 'source registry entry present');
  equal(src.client_count, 1, 'source family pilot active (client_count 1)');
  ok(Array.isArray(src.lens_sets) && src.lens_sets.length > 0, 'source lens_sets present');
  ok(src.lens_sets.includes('scholarly'), 'source lens_sets includes a source lens name');
});

test('T1.2: domain / framework / trend stay reserved (client_count 0) -- no over-activation', () => {
  equal(engine.LENS_REGISTRY.domain.client_count, 0, 'domain still reserved');
  equal(engine.LENS_REGISTRY.framework.client_count, 0, 'framework still reserved');
  equal(engine.LENS_REGISTRY.trend.client_count, 0, 'trend still reserved');
});

test('T1.3: ROTATION_MODES includes weighted-by-context (4 members); serial/parallel/single intact', () => {
  ok(engine.ROTATION_MODES.includes('weighted-by-context'), 'weighted-by-context present');
  for (const m of ['serial', 'parallel', 'single']) {
    ok(engine.ROTATION_MODES.includes(m), 'still present: ' + m);
  }
  equal(engine.ROTATION_MODES.length, 4, 'exactly 4 rotation modes');
});

test('T1.4: rotate({ lensType:source, ... }) no longer returns lens_family_reserved', async () => {
  const res = await engine.rotate({
    lensType: 'source',
    lensSet: ['scholarly'],
    rotationMode: 'weighted-by-context',
    input: { roomDir: '', topic: 'pricing' },
    perLensFn: async () => ({ summary: 'a finding', topic: 'pricing' }),
    synthesize: 'source-comparison',
  });
  ok(res && res.ok === true, 'rotate over the source family succeeds');
});

// ===========================================================================
// TASK 2 -- the source-lens driver
// ===========================================================================

test('T2.1: runSourceLens fetches ONLY via _fetchCorpus; ZERO child_process spawn', async () => {
  const driver = loadDriver();
  const calls = [];
  const stub = makeFetchStub({
    openalex: [item({ id: 'https://oa/1', doi: '10.1/aaa', abstract: 'premium pricing tier revenue', source: 'openalex' })],
    tavily: [item({ id: 'https://tv/1', source: 'tavily', abstract: 'industry premium pricing' })],
    pubmed: [],
    'brain-cypher': [],
  }, calls);

  // Spy on child_process spawn surface. The driver must never spawn anything.
  const orig = {
    spawn: childProcess.spawn,
    spawnSync: childProcess.spawnSync,
    exec: childProcess.exec,
    execSync: childProcess.execSync,
  };
  let spawnCount = 0;
  childProcess.spawn = function () { spawnCount++; throw new Error('spawn forbidden'); };
  childProcess.spawnSync = function () { spawnCount++; throw new Error('spawnSync forbidden'); };
  childProcess.exec = function () { spawnCount++; throw new Error('exec forbidden'); };
  childProcess.execSync = function () { spawnCount++; throw new Error('execSync forbidden'); };
  let res;
  try {
    res = await driver.runSourceLens({
      roomDir: '',
      topic: 'pricing strategy',
      lensSet: hotLensSet(),
      preflight: hotPreflight(),
      stage: 'explore',
      _fetchCorpus: stub,
    });
  } finally {
    childProcess.spawn = orig.spawn;
    childProcess.spawnSync = orig.spawnSync;
    childProcess.exec = orig.exec;
    childProcess.execSync = orig.execSync;
  }
  equal(spawnCount, 0, 'zero child_process spawn during the rotation');
  ok(res && res.ok === true, 'driver returns ok');
  ok(calls.length > 0, 'the injected fetchCorpus stub was the fetch path');
});

test('T2.2: dedup -- a fetched item matching prior_research (url / DOI) is removed before ranking', async () => {
  const driver = loadDriver();
  const dupUrl = 'https://oa/dup';
  const stub = makeFetchStub({
    openalex: [
      item({ id: dupUrl, url: dupUrl, doi: '10.1/dup', abstract: 'premium pricing tier revenue model' }),
      item({ id: 'https://oa/fresh', url: 'https://oa/fresh', doi: '10.1/fresh', abstract: 'premium pricing revenue tier churn' }),
    ],
    tavily: [], pubmed: [], 'brain-cypher': [],
  }, null);
  const pf = hotPreflight([{ url: dupUrl, doi: '10.1/dup' }]);
  const res = await driver.runSourceLens({
    roomDir: '', topic: 'premium pricing', lensSet: [{ lens: 'scholarly', weight: 1.0 }],
    preflight: pf, stage: 'explore', _fetchCorpus: stub,
  });
  ok(res.ok, 'ok');
  const urls = res.findings.map((f) => f.url);
  ok(!urls.includes(dupUrl), 'the prior-research duplicate was removed');
  ok(urls.includes('https://oa/fresh'), 'the fresh finding survived');
});

test('T2.3: ranking -- Academic before Practitioner, then relevance; commit stage drops None-tier', async () => {
  const driver = loadDriver();
  // openalex -> academic tier; tavily -> practitioner/none. Same relevance text.
  const stub = makeFetchStub({
    openalex: [item({ id: 'https://oa/a', url: 'https://oa/a', source: 'openalex', abstract: 'premium pricing tier revenue churn model' })],
    tavily: [item({ id: 'https://tv/p', url: 'https://tv/p', source: 'tavily', abstract: 'premium pricing tier revenue churn model' })],
    pubmed: [], 'brain-cypher': [],
  }, null);
  const lens = [{ lens: 'scholarly', weight: 1.0 }, { lens: 'industry', weight: 0.8 }];

  const explore = await driver.runSourceLens({
    roomDir: '', topic: 'premium pricing', lensSet: lens,
    preflight: hotPreflight(), stage: 'explore', _fetchCorpus: stub,
  });
  ok(explore.ok && explore.findings.length >= 1, 'explore returns findings');
  // Academic-tier finding ranks first.
  equal(explore.findings[0].evidence_tier, 'Academic', 'Academic ranks first');

  const commit = await driver.runSourceLens({
    roomDir: '', topic: 'premium pricing', lensSet: lens,
    preflight: hotPreflight(), stage: 'commit', _fetchCorpus: stub,
  });
  ok(commit.ok, 'commit ok');
  for (const f of commit.findings) {
    ok(f.evidence_tier !== 'None', 'commit stage drops None-tier findings');
  }
});

test('T2.4: returns at most top-5 findings, each carrying the locked provenance fields', async () => {
  const driver = loadDriver();
  const many = [];
  for (let i = 0; i < 9; i++) {
    many.push(item({ id: 'https://oa/' + i, url: 'https://oa/' + i, doi: '10.1/' + i, source: 'openalex', abstract: 'premium pricing tier revenue churn model ' + i }));
  }
  const stub = makeFetchStub({ openalex: many, tavily: [], pubmed: [], 'brain-cypher': [] }, null);
  const res = await driver.runSourceLens({
    roomDir: '', topic: 'premium pricing', lensSet: [{ lens: 'scholarly', weight: 1.0 }],
    preflight: hotPreflight(), stage: 'explore', _fetchCorpus: stub,
  });
  ok(res.ok, 'ok');
  ok(res.findings.length <= 5, 'at most top-5 (Stage 5 cap)');
  for (const f of res.findings) {
    ok(typeof f.source === 'string' && f.source.length > 0, 'finding carries source');
    ok(typeof f.url === 'string', 'finding carries url');
    ok(typeof f.retrieved_at === 'string', 'finding carries retrieved_at');
    ok(typeof f.evidence_tier === 'string', 'finding carries evidence_tier');
    ok(typeof f.relevance === 'number', 'finding carries relevance');
  }
});

test('T2.5: a per-source fetch failure degrades that lens to empty, never aborts the rotation', async () => {
  const driver = loadDriver();
  const stub = makeFetchStub({
    openalex: () => { throw new Error('openalex down'); },
    tavily: [item({ id: 'https://tv/ok', url: 'https://tv/ok', source: 'tavily', abstract: 'premium pricing tier revenue' })],
    pubmed: [], 'brain-cypher': [],
  }, null);
  const res = await driver.runSourceLens({
    roomDir: '', topic: 'premium pricing',
    lensSet: [{ lens: 'scholarly', weight: 1.0 }, { lens: 'industry', weight: 0.8 }],
    preflight: hotPreflight(), stage: 'explore', _fetchCorpus: stub,
  });
  ok(res.ok === true, 'rotation completed despite a failing source');
  const sources = res.findings.map((f) => f.source);
  ok(sources.includes('tavily'), 'the surviving source still produced findings');
});

// ===========================================================================
// TASK 3 -- the zero-Python + consume-130.5 asserting greps (directive guards)
// ===========================================================================

// Strip comment-only lines (trimmed start is // or block-comment continuation)
// so a descriptive comment naming "Python" / "child_process" does not self-
// invalidate the gate. We strip /* ... */ blocks AND leading-// lines.
function stripComments(src) {
  // Remove block comments.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Drop lines whose trimmed start is a line comment.
  return noBlock
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

test('T3.1: ZERO functional child_process / spawn / execSync / .py / scripts/hsi in driver + extractor', () => {
  const FORBIDDEN = /child_process|spawn|execSync|execFileSync|require\(['"][^'"]*\.py['"]\)|scripts\/hsi/;
  for (const p of [DRIVER_PATH, EXTRACTOR_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    const code = stripComments(src);
    ok(!FORBIDDEN.test(code), 'forbidden process/Python surface in ' + path.basename(p));
  }
});

test('T3.2: the driver provably consumes the 130.5 corpus (requires research-corpus.cjs), not a bespoke fetcher', () => {
  const src = fs.readFileSync(DRIVER_PATH, 'utf8');
  ok(/require\([^)]*research-corpus(\.cjs)?['"]\)/.test(src), 'driver requires research-corpus.cjs');
  // No bespoke fetcher: the driver must not define its own OpenAlex/arXiv/Tavily
  // HTTP helper (a direct fetch( call to an external API). It fetches via the
  // corpus only.
  const code = stripComments(src);
  ok(!/\bfetch\s*\(/.test(code), 'driver defines no bespoke fetch() call');
});

// ===========================================================================
// Source hygiene -- zero em-dashes in the new modules.
// ===========================================================================

test('T4.1: zero em-dashes in the driver + the lens-engine amendment', () => {
  for (const p of [DRIVER_PATH, path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs')]) {
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    ok(!src.includes(EMDASH), 'no em-dash in ' + path.basename(p));
  }
});
