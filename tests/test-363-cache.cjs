#!/usr/bin/env node
'use strict';

// Phase 363 Plan 04 - the shared research cache carries envelope meta (D-16),
// fetchSourceCached is exported and meta-aware (D-03, Canon Part 7), and the
// 363 engine reaches OpenAlex through the versioned source key openalex-v2.
//
// C1  putCached with meta, then read back: results and meta round trip
// C2  a pre-363 entry (results only) reads meta null, results intact
// C3  fetchSourceCached is exported from the source-lens driver
// C4  live call then cache hit: one stub call, meta.count survives, provenance
// C5  failed and blocked envelopes are never cached
// C6  a live zero-hit empty_valid with count 0 is cached with count 0
// C7  openalex and openalex-v2 resolve different cache paths
// C8  no API key in any cache filename or file content
// C9  runSourceLens keeps its finding fields (existing caller path)
//
// Hygiene: vendor key scrubbed, net guard installed, every fetch is a stub
// fetchEnvelopeFn, rooms under mkdtemp. exit 0 / 1 / 77.
//
// House rule: hyphens only; dash characters appear only as unicode escapes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scrubVendorKey, installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
const NET = installNetGuard();

const { check, summary } = makeChecker('test-363-cache');

const REPO = path.resolve(__dirname, '..');
const cache = require(path.join(REPO, 'lib', 'core', 'research-cache.cjs'));
const driver = require(path.join(REPO, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
const stageEnvelope = require(path.join(REPO, 'lib', 'core', 'recovery', 'stage-envelope.cjs'));

function mkRoom(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-cache-' + tag + '-'));
}

function paper(n) {
  return {
    id: 'https://openalex.org/W' + n,
    title: 'Paper ' + n,
    abstract: 'whitespace pricing model ' + n,
    authors: [],
    url: 'https://openalex.org/W' + n,
    fetched_at: new Date().toISOString(),
  };
}

// A stub fetchEnvelopeFn: returns the envelope built from `spec`, counts calls.
function makeStub(spec) {
  const state = { calls: 0 };
  const fn = async function stub(_args) {
    state.calls += 1;
    const results = spec.results || [];
    const env = stageEnvelope.makeStageEnvelope({
      stage: 'retrieval',
      engine: 'academic',
      status: spec.status,
      failure_class: spec.failure_class || null,
      error: spec.error || null,
      payload: { results: results },
      output: results,
    });
    if (spec.meta) env.meta = spec.meta;
    return env;
  };
  return { fn, state };
}

function listCacheFiles(room) {
  const dir = path.join(room, '.mindrian', 'research-cache');
  try {
    return fs.readdirSync(dir).map((f) => path.join(dir, f));
  } catch (_e) {
    return [];
  }
}

async function main() {
  const META = { count: 240, cost_usd: 0.001, remaining_usd: 0.99, limit_usd: 1, x_query: 'whitespace pricing' };

  // C1
  try {
    const room = mkRoom('c1');
    cache.putCached(room, 'openalex-v2', 'q one', [paper(1), paper(2)], { meta: META });
    const entry = cache.getCachedEntry(room, 'openalex-v2', 'q one');
    check('C1 putCached meta round trips (results + meta)',
      !!entry && Array.isArray(entry.results) && entry.results.length === 2
      && entry.meta && entry.meta.count === 240 && entry.meta.x_query === 'whitespace pricing'
      && entry.meta.limit_usd === 1);
    const plain = cache.getCached(room, 'openalex-v2', 'q one');
    check('C1b getCached still returns the plain results array',
      Array.isArray(plain) && plain.length === 2);
  } catch (e) {
    check('C1 putCached meta round trips (results + meta)', false, String(e && e.message));
  }

  // C2
  try {
    const room = mkRoom('c2');
    const file = cache.cachePath(room, 'openalex', 'old query');
    fs.writeFileSync(file, JSON.stringify({
      source: 'openalex', query_key: cache.cacheKey('openalex', 'old query'),
      fetched_at: new Date().toISOString(), results: [paper(9)],
    }), 'utf8');
    const entry = cache.getCachedEntry(room, 'openalex', 'old query');
    const plain = cache.getCached(room, 'openalex', 'old query');
    check('C2 pre-363 entry reads meta null and stays readable',
      !!entry && entry.meta === null && entry.results.length === 1
      && Array.isArray(plain) && plain.length === 1);
  } catch (e) {
    check('C2 pre-363 entry reads meta null and stays readable', false, String(e && e.message));
  }

  // C3
  check('C3 fetchSourceCached is exported', typeof driver.fetchSourceCached === 'function');

  // C4
  try {
    const room = mkRoom('c4');
    const stub = makeStub({ status: 'ok', results: [1, 2, 3, 4, 5].map(paper), meta: META });
    const first = await driver.fetchSourceCached('openalex-v2', 'whitespace pricing', room, stub.fn);
    const second = await driver.fetchSourceCached('openalex-v2', 'whitespace pricing', room, stub.fn);
    check('C4a live call: stub called once, meta.count 240',
      stub.state.calls === 1 && first.meta && first.meta.count === 240 && first.items.length === 5);
    check('C4b cache hit: no second stub call, provenance research-cache, meta.count 240',
      stub.state.calls === 1
      && second.provenance === 'research-cache'
      && second.envelope.provenance.includes('research-cache')
      && second.meta && second.meta.count === 240
      && second.envelope.meta && second.envelope.meta.count === 240
      && second.items.length === 5);
  } catch (e) {
    check('C4 live then cache hit', false, String(e && e.message));
  }

  // C5
  try {
    const room = mkRoom('c5');
    const failed = makeStub({ status: 'failed', failure_class: 'unknown_error', error: 'boom' });
    await driver.fetchSourceCached('openalex-v2', 'q fail', room, failed.fn);
    await driver.fetchSourceCached('openalex-v2', 'q fail', room, failed.fn);
    const blocked = makeStub({ status: 'blocked', failure_class: 'spend_limit_exceeded', error: 'budget' });
    await driver.fetchSourceCached('openalex-v2', 'q block', room, blocked.fn);
    await driver.fetchSourceCached('openalex-v2', 'q block', room, blocked.fn);
    check('C5 failed and blocked envelopes are never cached',
      failed.state.calls === 2 && blocked.state.calls === 2 && listCacheFiles(room).length === 0);
  } catch (e) {
    check('C5 failed and blocked envelopes are never cached', false, String(e && e.message));
  }

  // C6
  try {
    const room = mkRoom('c6');
    const zeroMeta = { count: 0, cost_usd: 0, remaining_usd: 1, limit_usd: 1, x_query: 'nothing here' };
    const stub = makeStub({ status: 'empty_valid', results: [], meta: zeroMeta });
    await driver.fetchSourceCached('openalex-v2', 'nothing here', room, stub.fn);
    const second = await driver.fetchSourceCached('openalex-v2', 'nothing here', room, stub.fn);
    check('C6 live zero-hit is cached with count 0',
      stub.state.calls === 1 && second.provenance === 'research-cache'
      && second.meta && second.meta.count === 0 && second.items.length === 0);
  } catch (e) {
    check('C6 live zero-hit is cached with count 0', false, String(e && e.message));
  }

  // C7
  try {
    const room = mkRoom('c7');
    const a = cache.cachePath(room, 'openalex', 'same query');
    const b = cache.cachePath(room, 'openalex-v2', 'same query');
    check('C7 openalex and openalex-v2 use different cache paths',
      a !== b && path.basename(b).startsWith('openalex-v2__'));
  } catch (e) {
    check('C7 openalex and openalex-v2 use different cache paths', false, String(e && e.message));
  }

  // C8
  try {
    process.env.OPENALEX_API_KEY = 'fake-key-363';
    const room = mkRoom('c8');
    const stub = makeStub({ status: 'ok', results: [paper(1)], meta: META });
    await driver.fetchSourceCached('openalex-v2', 'key hygiene query', room, stub.fn);
    const files = listCacheFiles(room);
    const leaked = files.some((f) => path.basename(f).includes('fake-key-363')
      || fs.readFileSync(f, 'utf8').includes('fake-key-363'));
    check('C8 no API key in any cache filename or content', files.length === 1 && !leaked);
  } catch (e) {
    check('C8 no API key in any cache filename or content', false, String(e && e.message));
  } finally {
    delete process.env.OPENALEX_API_KEY;
  }

  // C9
  try {
    const room = mkRoom('c9');
    const stub = makeStub({ status: 'ok', results: [paper(1), paper(2)], meta: META });
    const out = await driver.runSourceLens({
      roomDir: room,
      topic: 'whitespace pricing model',
      lensSet: [{ lens: 'scholarly', weight: 1 }],
      preflight: {},
      stage: 'explore',
      _fetchCorpusEnvelope: stub.fn,
    });
    const f = out && out.findings && out.findings[0];
    check('C9 runSourceLens findings keep source/url/retrieved_at/evidence_tier/relevance',
      out && out.ok === true && !!f && f.source === 'openalex' && typeof f.url === 'string'
      && typeof f.retrieved_at === 'string' && f.evidence_tier === 'Academic'
      && typeof f.relevance === 'number');
  } catch (e) {
    check('C9 runSourceLens findings keep their fields', false, String(e && e.message));
  }

  check('net guard: zero network attempts', NET.attempts() === 0);
  NET.restore();
  return summary();
}

main().then((code) => process.exit(code), (e) => {
  console.log('FAIL: unexpected ' + String(e && e.stack || e));
  process.exit(1);
});
