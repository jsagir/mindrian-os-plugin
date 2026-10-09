'use strict';
// Tests for rs-fetcher-industry.cjs. Payloads are HAND-MADE in the shape of
// Tavily's documented /search response; none were recorded from the API.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-fetch/lib/core/rs-fetcher-industry.cjs']);
const tel = require(path.join(root, 'lib/core/rs-egress-telemetry.cjs'));
const ind = require(path.join(root, 'lib/core/rs-fetcher-industry.cjs'));
const T = ind._test;
const realFetch = global.fetch;
const NO_WAIT = { sleep: async () => {}, minIntervalMs: 0 };
const jr = (obj, status) => ({ ok: (status || 200) < 400, status: status || 200, headers: { get: () => null }, json: async () => obj });
const TAV = { results: [
  { title: 'Acme Robotics raises seed', url: 'https://www.acme-robotics.com/news?utm_source=x', content: 'Acme Robotics closed a seed round.', score: 0.91 },
  { title: 'Acme Robotics raises seed', url: 'https://acme-robotics.com/news/', content: 'Acme Robotics closed a seed round.', score: 0.5 },
  { title: 'How Foo Labs builds drones', url: 'https://github.com/foo/drones', content: 'Repo readme.' },
  { title: 'Beta Ltd opens lab', url: 'https://www.beta.co.uk/lab', content: 'Beta opens a research lab.' },
  { title: 'no url', content: 'dropped' },
] };

test('extractCompany: aggregator hosts, compound TLD, title stopwords, legacy example fixture', () => {
  assert.equal(T.extractCompany('https://github.com/foo/x', 'Foo Labs builds drones'), 'Foo');
  assert.equal(T.extractCompanyDetailed('https://github.com/foo/x', 'Foo Labs').basis, 'title');
  assert.equal(T.extractCompany('https://www.beta.co.uk/x', ''), 'Beta');
  assert.equal(T.extractCompany('https://acme-robotics.com', ''), 'Acme-Robotics');
  assert.equal(T.extractCompany('', 'The Acme story'), 'Acme');
  assert.equal(T.extractCompany('https://example.com', ''), 'Example');
  assert.equal(T.extractCompany('', ''), 'Unknown');
  assert.equal(T.extractCompany('not a url', 'lowercase only'), 'Unknown');
});

test('normalizeUrl strips tracking, www, fragment, trailing slash', () => {
  assert.equal(T.normalizeUrl('https://www.A.com/p/?utm_source=x&b=2&a=1#f'), 'https://a.com/p?a=1&b=2');
  assert.equal(T.normalizeUrl('garbage'), '');
});

test('parseTavilyResponse: provenance fields, unverified status, scores', () => {
  const r = T.parseTavilyResponse(TAV);
  assert.equal(r.length, 4);
  assert.equal(r[0].verification_status, 'unverified');
  assert.equal(r[0].source_id, r[0].url);
  assert.equal(r[0].relevance_score, 0.91);
  assert.ok(r[0].retrieved_at);
  assert.throws(() => T.parseTavilyResponse(null));
  assert.deepEqual(T.parseTavilyResponse({}), []);
});

test('dedupe: URL-normalised duplicate collapses even when snippet differs', () => {
  const a = { company: 'Acme', signal: 'one', url: 'https://www.acme.com/n?utm_x=1', source: 'tavily' };
  const b = { company: 'Other', signal: 'two', url: 'https://acme.com/n/', source: 'websearch' };
  const d = T.dedupe([a, b]);
  assert.equal(d.length, 1); assert.deepEqual(d[0].also_found_in, ['websearch']);
  assert.equal(T.dedupe([{ company: 'A', signal: 'same head', url: '' }, { company: 'a', signal: 'same head', url: '' }]).length, 1);
});

test('fetchIndustry: no key -> graceful; with key -> network path, headers, provenance', async () => {
  tel._reset();
  delete process.env.TAVILY_API_KEY;
  global.fetch = async () => { throw new Error('must not be called'); };
  try {
    const r0 = await ind.fetchIndustry(['robotics'], NO_WAIT);
    assert.equal(r0.tier, 'cache'); assert.deepEqual(r0.signals, []);
    assert.ok(r0.telemetry.some((t) => t.status === 'api_key_missing'));
    assert.ok(r0.provenance && r0.provenance.queries[0] === 'robotics');

    process.env.TAVILY_API_KEY = 'tvly-SECRET';
    const seen = [];
    global.fetch = async (u, init) => { seen.push({ u, init }); return jr(TAV); };
    const r = await ind.fetchIndustry(['robotics'], NO_WAIT);
    assert.equal(seen.length, 3, 'three refined sub-queries');
    assert.equal(seen[0].init.headers.Authorization, 'Bearer tvly-SECRET');
    assert.equal(r.tier, 'paid'); assert.equal(r.source, 'tavily');
    assert.equal(r.signals.length, 3, 'acme duplicated by URL collapses; dropped no-url record');
    for (const s of r.signals) assert.ok(s.retrieval_query === 'robotics' && s.provenance.subquery && s.provenance.endpoint);
    assert.ok(!JSON.stringify(r).includes('tvly-SECRET'), 'key must not appear in output');
    assert.equal(r.provenance.dedupe.input_count, 12); assert.equal(r.provenance.dedupe.merged_count, 9);
  } finally { global.fetch = realFetch; delete process.env.TAVILY_API_KEY; }
});

test('fetchIndustry: audit layers, budget per request, retry, template override smuggling', async () => {
  tel._reset(); process.env.TAVILY_API_KEY = 'k'; let n = 0;
  global.fetch = async () => { n += 1; return jr(TAV); };
  try {
    await assert.rejects(() => ind.fetchIndustry(['fine', 'ssn SSN here'], NO_WAIT), (e) => e.name === 'ExternalEgressViolation');
    assert.equal(n, 0);
    await assert.rejects(() => ind.fetchIndustry(['fine'], Object.assign({ refinement_template_override: '{query} call 555-123-4567' }, NO_WAIT)), (e) => e.name === 'ExternalEgressViolation');
    assert.equal(n, 0);
    // budget: 4 sub-queries allowed across 2 user queries (6 would be needed)
    await ind.fetchIndustry(['q1', 'q2'], Object.assign({ budget: { tavily: 4 } }, NO_WAIT));
    assert.equal(n, 4);
    // retry 429 then ok
    tel._reset(); n = 0;
    global.fetch = async () => { n += 1; return n === 1 ? jr({}, 429) : jr(TAV); };
    const r = await ind.fetchIndustry(['q'], NO_WAIT);
    assert.equal(n, 4, 'one retry on the first sub-query + two more sub-queries');
    assert.equal(r.tier, 'paid');
  } finally { global.fetch = realFetch; delete process.env.TAVILY_API_KEY; }
});

test('fetchIndustry: injected seams, violation not swallowed, adapter failure reported, cache stale', async () => {
  tel._reset(); delete process.env.TAVILY_API_KEY;
  await assert.rejects(() => ind.fetchIndustry(['a SSN b'], { tavily: async () => ({ results: [] }) }), (e) => e.name === 'ExternalEgressViolation');
  // failing paid adapter -> native
  const r = await ind.fetchIndustry(['robotics'], Object.assign({
    tavily: async () => { throw new Error('boom'); },
    webSearch: async () => ({ results: [{ title: 'Gamma Inc news', url: 'https://gamma.io/a', snippet: 'Gamma raised.' }] }),
  }, NO_WAIT));
  assert.equal(r.tier, 'native');
  const ad = r.telemetry.find((t) => t.status === 'adapter_error');
  assert.ok(ad && ad.source === 'tavily' && /boom/.test(ad.detail));
  assert.equal(r.signals[0].company, 'Gamma');
  assert.match(r.signals[0].retrieval_query, /industry analysis/);
  // cache tier is flagged stale and keeps its date
  const c = await ind.fetchIndustry(['robotics'], Object.assign({
    cacheReader: () => ({ results: [{ company: 'Old', signal: 's', url: 'https://old.com', fetched_at: '2025-01-01T00:00:00.000Z' }] }),
  }, NO_WAIT));
  assert.equal(c.tier, 'cache'); assert.equal(c.signals[0].stale, true);
  assert.equal(c.signals[0].fetched_at, '2025-01-01T00:00:00.000Z');
  // cacheReader throwing is reported, not silent
  const c2 = await ind.fetchIndustry(['robotics'], Object.assign({ cacheReader: () => { throw new Error('disk'); } }, NO_WAIT));
  assert.ok(c2.telemetry.some((t) => t.source === 'cache' && t.status === 'adapter_error'));
  assert.ok(c2.telemetry.some((t) => t.status === 'empty'));
});

test('normalizeSignal keeps legacy shape for bare records', () => {
  assert.deepEqual(Object.keys(T.normalizeSignal({ company: 'A' })).sort(), ['company', 'fetched_at', 'signal', 'source', 'url']);
});
