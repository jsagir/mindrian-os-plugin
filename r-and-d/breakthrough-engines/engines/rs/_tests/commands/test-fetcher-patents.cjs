'use strict';
// Tests for rs-fetcher-patents.cjs. All payloads are HAND-MADE, shaped like the
// documented responses; nothing was recorded from Google Patents or the USPTO.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-fetch/lib/core/rs-fetcher-patents.cjs']);
const tel = require(path.join(root, 'lib/core/rs-egress-telemetry.cjs'));
const pat = require(path.join(root, 'lib/core/rs-fetcher-patents.cjs'));
const T = pat._test;
const realFetch = global.fetch;
const NO_WAIT = { sleep: async () => {}, minIntervalMs: 0 };
const res = (body, status, kind) => ({ ok: (status || 200) < 400, status: status || 200, headers: { get: () => null },
  text: async () => body, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });

const LD = { '@type': 'Patent', patentNumber: 'US 7,654,321 B2', name: 'Self cooling can', description: 'A can.',
  inventor: [{ name: 'Jo Smith' }, 'Al Lee'], assignee: { name: 'Acme' }, filingDate: '2004-01-02' };
const HTML = '<html><script type="application/ld+json" id="x">' + JSON.stringify(LD) + '</script>' +
  '<script type="application/ld+json">' + JSON.stringify({ '@graph': [{ '@type': 'Patent', patentNumber: 'EP1234567A1', name: 'Graph patent' }] }) + '</script>' +
  '<script type="application/ld+json">{not json</script></html>';
const USPTO = { results: [{ patentNumber: 'US7654321', patentTitle: 'Self cooling can', patentAbstract: 'Abstract text', inventorName: ['Jo Smith'], assigneeEntityName: 'Acme Inc', filingDate: '2004-01-02' }] };

test('patent id normalisation and identity', () => {
  assert.equal(T.normalizePatentId('US 7,654,321 B2'), 'US7654321B2');
  assert.equal(T.patentIdentity('US 7,654,321 B2'), 'US7654321');
  assert.equal(T.patentIdentity('US7654321'), 'US7654321');
  assert.equal(T.patentIdentity('US20200012345A1'), 'US20200012345');
  assert.equal(T.patentIdentity(null), '');
});

test('google parser: attributes, @graph, malformed block, provenance fields', () => {
  const r = T.parseGooglePatentsResponse(HTML);
  assert.equal(r.length, 2);
  assert.equal(r[0].inventors.length, 2);
  assert.equal(r[0].source_url, 'https://patents.google.com/patent/US7654321B2');
  assert.equal(r[0].retrieval_method, 'html_jsonld');
  assert.equal(r[1].patent_id, 'EP1234567A1');
  assert.throws(() => T.parseGooglePatentsResponse(''));
  assert.deepEqual(T.parseGooglePatentsResponse('<html>no ld</html>'), []);
});

test('dedupe: same patent across sources and kind codes; backfill; also_found_in', () => {
  const g = T.parseGooglePatentsResponse(HTML);
  const u = T.parseUsptoResponse(USPTO);
  const merged = T.dedupe([].concat(g, u));
  assert.equal(merged.filter((p) => /Self cooling/.test(p.title)).length, 1);
  const s = merged.find((p) => /Self cooling/.test(p.title));
  assert.equal(s.source, 'google_patents');
  assert.deepEqual(s.also_found_in, ['uspto']);
  assert.equal(merged.length, 2);
  // unknown ids fall back to title+inventor; empty record stays distinct
  assert.equal(T.dedupe([{ title: 'Same Title', inventors: ['A B'] }, { title: 'same title', inventors: ['A C'] }]).length, 1);
});

test('fetchPatents: end to end with provenance, retry, budget, disableScraping, audit', async () => {
  tel._reset();
  const urls = [];
  global.fetch = async (u) => { urls.push(u); return u.startsWith('https://patents.google.com') ? res(HTML) : res(USPTO); };
  try {
    await assert.rejects(() => pat.fetchPatents(['ok', 'call 555-123-4567'], NO_WAIT), (e) => e.name === 'ExternalEgressViolation');
    assert.equal(urls.length, 0);
    const r = await pat.fetchPatents(['self cooling can'], NO_WAIT);
    assert.equal(r.patents.length, 2); assert.deepEqual(r.results, r.patents);
    for (const p of r.patents) { assert.ok(p.retrieved_at && p.retrieval_query === 'self cooling can' && p.provenance.tool); }
    assert.equal(r.provenance.dedupe.merged_count, 1);

    urls.length = 0; tel._reset();
    const r2 = await pat.fetchPatents(['x'], Object.assign({ disableScraping: true }, NO_WAIT));
    assert.ok(urls.every((u) => !u.includes('patents.google.com')));
    assert.ok(r2.telemetry.some((t) => t.source === 'google_patents' && t.status === 'disabled'));
    assert.equal(r2.provenance.params.scraping_disabled, true);

    // budget per request
    urls.length = 0; tel._reset();
    await pat.fetchUspto(['a', 'b', 'c'], Object.assign({ budget: { uspto: 1 } }, NO_WAIT));
    assert.equal(urls.length, 1);

    // retry: 503 twice then 200
    tel._reset(); let n = 0;
    global.fetch = async () => { n += 1; return n < 3 ? res('', 503) : res(USPTO); };
    const r3 = await pat.fetchUspto(['q'], NO_WAIT);
    assert.equal(n, 3); assert.equal(r3.patents.length, 1);
    assert.equal(r3.telemetry.find((t) => t.source === 'uspto' && t.status === 'ok').attempts, 3);

    // persistent 503 -> rate_limited, one ledger entry
    tel._reset(); n = 0;
    global.fetch = async () => { n += 1; return res('', 503); };
    const r4 = await pat.fetchUspto(['q'], NO_WAIT);
    assert.equal(n, 3); assert.equal(r4.telemetry.find((t) => t.source === 'uspto').status, 'rate_limited');
    assert.equal(tel._entries.length, 1);
  } finally { global.fetch = realFetch; }
});

test('normalizePatent keeps additive fields only when present', () => {
  assert.deepEqual(Object.keys(T.normalizePatent({ patent_id: 'x' })).sort(),
    ['abstract', 'assignee', 'fetched_at', 'filing_date', 'inventors', 'patent_id', 'source', 'title']);
  assert.equal(T.normalizePatent({ source_id: 's' }).source_id, 's');
});
