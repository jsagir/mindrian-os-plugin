'use strict';
// Tests for rs-fetcher-academic.cjs. ALL payloads below are HAND-MADE samples
// shaped like the providers' documented responses; none were recorded from the
// live APIs. No network is used: global.fetch is replaced per test.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-fetch/lib/core/rs-fetcher-academic.cjs']);
const tel = require(path.join(root, 'lib/core/rs-egress-telemetry.cjs'));
const acad = require(path.join(root, 'lib/core/rs-fetcher-academic.cjs'));
const T = acad._test;
const realFetch = global.fetch;

function jsonRes(obj, status, headers) {
  return {
    ok: (status || 200) < 400, status: status || 200,
    headers: { get: function (k) { return (headers || {})[String(k).toLowerCase()] || null; } },
    json: async function () { return obj; }, text: async function () { return JSON.stringify(obj); },
  };
}
function textRes(t, status, headers) {
  return {
    ok: (status || 200) < 400, status: status || 200,
    headers: { get: function (k) { return (headers || {})[String(k).toLowerCase()] || null; } },
    text: async function () { return t; }, json: async function () { return JSON.parse(t); },
  };
}
const NO_WAIT = { sleep: async function () {}, minIntervalMs: 0 };

const OA = { // hand-made
  meta: { count: 2 },
  results: [
    { id: 'https://openalex.org/W1', title: 'Graph Neural Nets for Drug Repurposing', doi: 'https://doi.org/10.1000/ABC.1',
      abstract_inverted_index: { Graphs: [0], help: [1], drugs: [2] }, publication_year: 2023, type: 'article',
      cited_by_count: 12, is_retracted: false,
      authorships: [{ author: { display_name: 'Ada Lovelace' }, institutions: [{ display_name: 'Uni A' }] }],
      primary_location: { source: { display_name: 'J. Sci', is_in_doaj: true } } },
    { id: 'https://openalex.org/W2', title: 'Retracted thing', doi: null, abstract_inverted_index: null, is_retracted: true, authorships: [] },
  ],
};
const ARXIV = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">' +
  '<entry><id>http://arxiv.org/abs/2301.01234v2</id><published>2023-01-03T00:00:00Z</published>' +
  '<title>Graph Neural Nets for\n  Drug Repurposing</title><summary>We study R&amp;D of &lt;b&gt;drugs&lt;/b&gt;.\n More.</summary>' +
  '<author><name>Ada  Lovelace</name></author><arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.1000/abc.1</arxiv:doi></entry>' +
  '<entry><id>http://arxiv.org/api/errors#bad</id><title>Error</title><summary>incorrect id</summary></entry>' +
  '<entry><id>http://arxiv.org/abs/hep-th/9901001v1</id><title>Old Style Id</title><summary>Text.</summary><author><name>B C</name></author></entry>' +
  '</feed>';

test('buildAcademicQuery: URL shapes, key placement, skip, validation', () => {
  process.env.SCOPUS_API_KEY = 'SECRETSCOPUS'; process.env.IEEE_API_KEY = 'SECRETIEEE'; delete process.env.NATURE_API_KEY;
  const oa = acad.buildAcademicQuery('graph neural', 'openalex', { perPage: 500 });
  assert.match(oa.url, /search=graph%20neural&per-page=200&select=/);
  const sc = acad.buildAcademicQuery('graph neural', 'scopus');
  assert.ok(!sc.url.includes('SECRETSCOPUS'), 'scopus key must not be in the URL');
  assert.equal(sc.headers['X-ELS-APIKey'], 'SECRETSCOPUS');
  const ie = acad.buildAcademicQuery('graph neural', 'ieee');
  assert.ok(ie.url.includes('apikey=SECRETIEEE'));
  assert.ok(!ie.safe_url.includes('SECRETIEEE') && ie.safe_url.includes('apikey=REDACTED'));
  assert.deepEqual(acad.buildAcademicQuery('x', 'nature'), { skip: true, reason: 'api_key_missing' });
  const pm = acad.buildAcademicQuery('aspirin', 'pubmed');
  assert.match(pm.url, /tool=mindrian-os/);
  assert.throws(() => acad.buildAcademicQuery('   ', 'arxiv'), TypeError);
  assert.throws(() => acad.buildAcademicQuery('x', 'bogus'), TypeError);
  assert.throws(() => acad.buildAcademicQuery('see meeting_transcript', 'arxiv'), (e) => e.name === 'ExternalEgressViolation');
});

test('normalizeDoi and normalizeArxivId', () => {
  assert.equal(T.normalizeDoi('https://doi.org/10.1000/ABC.1'), '10.1000/abc.1');
  assert.equal(T.normalizeDoi('http://dx.doi.org/10.1000/abc.1.'), '10.1000/abc.1');
  assert.equal(T.normalizeDoi('doi: 10.1000/abc.1'), '10.1000/abc.1');
  assert.equal(T.normalizeDoi('not a doi'), '');
  assert.equal(T.normalizeDoi(null), '');
  assert.equal(T.normalizeArxivId('http://arxiv.org/abs/2301.01234v3'), '2301.01234');
  assert.equal(T.normalizeArxivId('arXiv:2301.01234'), '2301.01234');
  assert.equal(T.normalizeArxivId('http://arxiv.org/abs/hep-th/9901001v1'), 'hep-th/9901001');
  assert.equal(T.normalizeArxivId('hello'), '');
});

test('parsers: openalex, arxiv (entities, whitespace, error entry), pubmed', () => {
  const oa = T.parseOpenAlex(OA);
  assert.equal(oa.length, 2);
  assert.equal(oa[0].abstract, 'Graphs help drugs');
  assert.equal(oa[0].source_id, 'https://openalex.org/W1');
  assert.equal(oa[1].is_retracted, true);
  const ax = T.parseArxivXml(ARXIV);
  assert.equal(ax.length, 2, 'error entry must be dropped');
  assert.equal(ax[0].title, 'Graph Neural Nets for Drug Repurposing');
  assert.equal(ax[0].abstract, 'We study R&D of <b>drugs</b>. More.');
  assert.equal(ax[0].authors[0], 'Ada Lovelace');
  assert.equal(ax[0].arxiv_id, '2301.01234');
  assert.equal(ax[0].doi, '10.1000/abc.1');
  assert.equal(ax[0].published, '2023-01-03T00:00:00Z');
  assert.equal(ax[1].arxiv_id, 'hep-th/9901001');
  assert.throws(() => T.parseArxivXml('<html>nope</html>'));
  const pm = T.parsePubMed({ esearchresult: { idlist: ['111', '222'] } });
  assert.equal(pm[0].metadata_only, true);
  assert.equal(pm[0].source_url, 'https://pubmed.ncbi.nlm.nih.gov/111/');
});

test('parsers: scopus, ieee, nature (hand-made shapes)', () => {
  const sc = T.parseScopus({ 'search-results': { entry: [{ 'dc:identifier': 'SCOPUS_ID:1', 'dc:title': 'T', 'prism:doi': '10.1/x', 'dc:creator': 'Smith J', affiliation: [{ affilname: 'MIT' }], link: [{ '@ref': 'scopus', '@href': 'https://s/1' }] }] } });
  assert.equal(sc[0].source_url, 'https://s/1'); assert.equal(sc[0].institution, 'MIT');
  const ie = T.parseIeee({ articles: [{ article_number: 77, title: 'T', abstract: 'A', doi: '10.1/y', authors: { authors: [{ full_name: 'X Y', affiliation: 'ETH' }] } }] });
  assert.equal(ie[0].source_id, '77'); assert.match(ie[0].source_url, /ieeexplore\.ieee\.org\/document\/77/);
  const na = T.parseNature({ records: [{ identifier: 'doi:10.1/z', title: 'T', abstract: 'A', doi: '10.1/z', creators: [{ creator: 'Q' }], url: [{ value: 'https://n/z' }] }] });
  assert.equal(na[0].source_url, 'https://n/z');
});

test('dedupe: DOI across sources, arXiv-doi bridge, title, metadata_only, first-seen order', () => {
  const oa = T.parseOpenAlex(OA);
  const ax = T.parseArxivXml(ARXIV);
  const merged = acad._test.dedupe([].concat(oa, ax));
  // W1 (doi 10.1000/abc.1) and arXiv 2301.01234 (arxiv:doi same) collapse; title also matches.
  assert.equal(merged.filter((p) => /Graph Neural Nets/.test(p.title)).length, 1);
  const survivor = merged.find((p) => /Graph Neural Nets/.test(p.title));
  assert.equal(survivor.source, 'openalex');
  assert.deepEqual(survivor.also_found_in, ['arxiv']);
  assert.equal(survivor.arxiv_id, '2301.01234');
  // arXiv-only paper with the same title but NO doi still dedupes by normalised title
  const a = { id: 'x1', title: 'A Sufficiently Long Normalised Title!', authors: ['A B'], source: 'openalex', doi: '' };
  const b = { id: 'x2', title: 'a sufficiently long normalised title', authors: ['Z Q'], source: 'scopus', doi: '' };
  assert.equal(T.dedupe([a, b]).length, 1);
  // short generic titles do not merge across different authors
  assert.equal(T.dedupe([{ id: '1', title: 'Introduction', authors: ['A B'], source: 'x' }, { id: '2', title: 'Introduction', authors: ['C D'], source: 'y' }]).length, 2);
  // pubmed placeholders never merge with each other or with real titles
  const pm = T.parsePubMed({ esearchresult: { idlist: ['1', '2'] } });
  assert.equal(T.dedupe(pm).length, 2);
});

test('fetchAcademic: provenance on every record, envelope, pre-flight audit', async () => {
  tel._reset();
  const calls = [];
  global.fetch = async function (url, init) {
    calls.push(url);
    if (url.startsWith('https://api.openalex.org')) return jsonRes(OA, 200, { 'x-ratelimit-remaining-usd': '0.5' });
    if (url.startsWith('https://export.arxiv.org')) return textRes(ARXIV, 200);
    return jsonRes({ esearchresult: { idlist: ['9'] } });
  };
  try {
    // adversarial query in position 2: NO request may go out.
    await assert.rejects(() => acad.fetchAcademic(['clean query', 'see meeting_transcript'], NO_WAIT), (e) => e.name === 'ExternalEgressViolation');
    assert.equal(calls.length, 0, 'pre-flight audit must precede any fetch');
    assert.equal(tel._entries.length, 0);

    const r = await acad.fetchAcademic(['graph neural'], NO_WAIT);
    assert.equal(r.tier, 'paid');
    assert.equal(r.papers, r.papers); assert.deepEqual(r.results, r.papers);
    assert.equal(r.source, 'openalex');
    for (const p of r.papers) {
      assert.ok(p.retrieved_at && p.retrieval_query === 'graph neural', 'retrieval date and query');
      assert.ok(p.provenance && p.provenance.source === p.source && p.provenance.retrieved_at);
      assert.equal(typeof p.source_id, 'string');
    }
    assert.equal(r.provenance.dedupe.merged_count >= 1, true);
    assert.ok(r.provenance.sources_attempted.includes('openalex'));
    assert.ok(!JSON.stringify(r).includes('SECRET'));
    const okOA = r.telemetry.find((t) => t.source === 'openalex' && t.status === 'ok');
    assert.equal(okOA.meta.remaining_usd, 0.5);
  } finally { global.fetch = realFetch; }
});

test('fetchAcademic: retry on 429 honours Retry-After; capped; legacy mode', async () => {
  for (const s of ['arxiv', 'pubmed']) tel._reset();
  let n = 0; const waits = [];
  global.fetch = async function () { n += 1; return n < 3 ? jsonRes({}, 429, { 'retry-after': '2' }) : jsonRes(OA, 200); };
  try {
    const r = await acad.fetchOpenAlex(['q'], { sleep: async (ms) => waits.push(ms), minIntervalMs: 0 });
    assert.equal(n, 3);
    assert.deepEqual(waits, [2000, 2000]);
    assert.equal(r.telemetry.find((t) => t.status === 'ok').attempts, 3);
    // only the final outcome is recorded in the ledger (no budget burn per retry)
    assert.equal(tel._entries.filter((e) => e.source === 'openalex').length, 1);

    // Retry-After beyond the cap: stop at once, report rate_limited
    tel._reset(); n = 0; waits.length = 0;
    global.fetch = async function () { n += 1; return jsonRes({}, 429, { 'retry-after': '3600' }); };
    const r2 = await acad.fetchOpenAlex(['q'], { sleep: async (ms) => waits.push(ms), minIntervalMs: 0 });
    assert.equal(n, 1); assert.equal(r2.telemetry.find((t) => t.source === 'openalex').status, 'rate_limited');

    // maxRetries 0 = legacy single attempt
    tel._reset(); n = 0;
    global.fetch = async function () { n += 1; return jsonRes({}, 503); };
    await acad.fetchOpenAlex(['q'], { sleep: async () => {}, minIntervalMs: 0, maxRetries: 0 });
    assert.equal(n, 1);

    // exhausted OpenAlex USD balance on 429: no retry, flagged
    tel._reset(); n = 0;
    global.fetch = async function () { n += 1; return jsonRes({}, 429, { 'x-ratelimit-remaining-usd': '0' }); };
    const r3 = await acad.fetchOpenAlex(['q'], NO_WAIT);
    assert.equal(n, 1); assert.equal(r3.telemetry[0].budget_exhausted, true);

    // 400 is not retried and is an api_error
    tel._reset(); n = 0;
    global.fetch = async function () { n += 1; return jsonRes({}, 400); };
    const r4 = await acad.fetchOpenAlex(['q'], NO_WAIT);
    assert.equal(n, 1); assert.equal(r4.telemetry[0].status, 'api_error');
  } finally { global.fetch = realFetch; }
});

test('fetchAcademic: timeout covers the body read; network errors retried then reported', async () => {
  tel._reset();
  let n = 0;
  global.fetch = async function (_u, init) {
    n += 1;
    return { ok: true, status: 200, headers: { get: () => null },
      json: () => new Promise((_res, rej) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); })) };
  };
  try {
    const r = await acad.fetchOpenAlex(['q'], { timeoutMs: 40, maxRetries: 1, sleep: async () => {}, minIntervalMs: 0 });
    assert.equal(n, 2);
    assert.equal(r.telemetry[0].status, 'timeout'); assert.equal(r.telemetry[0].attempts, 2);
    tel._reset(); n = 0;
    global.fetch = async function () { n += 1; throw new Error('ECONNRESET'); };
    const r2 = await acad.fetchOpenAlex(['q'], { maxRetries: 2, sleep: async () => {}, minIntervalMs: 0 });
    assert.equal(n, 3); assert.equal(r2.telemetry[0].status, 'network_error');
    // malformed JSON body: api_error, not retried
    tel._reset(); n = 0;
    global.fetch = async function () { n += 1; return { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new SyntaxError('bad'); } }; };
    const r3 = await acad.fetchOpenAlex(['q'], NO_WAIT);
    assert.equal(n, 1); assert.equal(r3.telemetry[0].status, 'api_error');
  } finally { global.fetch = realFetch; }
});

test('fetchAcademic: per-run budget enforced per request; duplicate queries collapsed; pacing', async () => {
  tel._reset();
  let n = 0;
  global.fetch = async function () { n += 1; return jsonRes(OA, 200); };
  try {
    const r = await acad.fetchOpenAlex(['a', 'b', 'c', 'd', 'a'], Object.assign({ budget: { openalex: 2 } }, NO_WAIT));
    assert.equal(n, 2, 'budget of 2 allows exactly 2 requests in one run');
    assert.ok(r.telemetry.some((t) => t.status === 'budget_exhausted' && t.source === 'openalex'));
    assert.deepEqual(r.provenance.queries, ['a', 'b', 'c', 'd']);
  } finally { global.fetch = realFetch; }

  // pacing: injected clock; arxiv default interval is 3000 ms
  tel._reset();
  let clock = 1000; const waits = [];
  global.fetch = async function () { return textRes(ARXIV, 200); };
  try {
    await acad.fetchArxiv(['p1', 'p2'], { now: () => clock, sleep: async (ms) => { waits.push(ms); clock += ms; } });
    // first request of this process for 'arxiv' may or may not wait (module state); the second must wait ~3000
    assert.ok(waits.length >= 1 && waits[waits.length - 1] > 2000 && waits[waits.length - 1] <= 3000, JSON.stringify(waits));
  } finally { global.fetch = realFetch; }
});

test('fetchAcademic: missing key skips gated source once; input validation', async () => {
  tel._reset(); delete process.env.NATURE_API_KEY;
  global.fetch = async function () { throw new Error('should not be called'); };
  try {
    const r = await acad.fetchNature(['q1', 'q2'], NO_WAIT);
    assert.equal(r.telemetry.filter((t) => t.source === 'nature').length, 1);
    assert.equal(r.telemetry.find((t) => t.source === 'nature').status, 'api_key_missing');
    await assert.rejects(() => acad.fetchAcademic('nope'), TypeError);
    await assert.rejects(() => acad.fetchAcademic(['  ']), TypeError);
  } finally { global.fetch = realFetch; }
});

test('normalizePaper keeps 2026 fields and original shape for hand-built records', () => {
  const bare = T.normalizePaper({ id: 'a', title: 't' });
  assert.deepEqual(Object.keys(bare).sort(), ['abstract', 'authors', 'doi', 'fetched_at', 'id', 'institution', 'source', 'title']);
  const rich = T.normalizePaper({ id: 'a', source_id: 's', provenance: { x: 1 }, metadata_only: true });
  assert.equal(rich.source_id, 's'); assert.equal(rich.metadata_only, true);
});
