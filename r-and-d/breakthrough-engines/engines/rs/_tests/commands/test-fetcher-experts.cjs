'use strict';
// Tests for rs-fetcher-experts.cjs (mapExperts). Inputs are HAND-MADE papers.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-experts/lib/core/rs-fetcher-experts.cjs', 'rs-fetch/lib/core/rs-fetcher-academic.cjs']);
const ex = require(path.join(root, 'lib/core/rs-fetcher-experts.cjs'));
const acad = require(path.join(root, 'lib/core/rs-fetcher-academic.cjs'));
const T = ex._test;

const P = (id, authors, extra) => Object.assign({ id, title: 'Paper ' + id, authors, source: 'openalex', cited_by_count: 5, fetched_at: '2026-01-01T00:00:00.000Z' }, extra || {});

test('REGRESSION: real academic-fetcher output (string authors, cited_by_count) yields experts', () => {
  // Original code returned [] for this input because string authors were dropped.
  const oa = acad._test.parseOpenAlex({ results: [
    { id: 'https://openalex.org/W1', title: 'T1', doi: '10.1/a', cited_by_count: 9, authorships: [{ author: { display_name: 'Ada Lovelace' } }, { author: { display_name: 'Bob Ray' } }] },
    { id: 'https://openalex.org/W2', title: 'T2', doi: '10.1/b', cited_by_count: 4, authorships: [{ author: { display_name: 'ADA LOVELACE.' } }] },
  ] });
  const e = ex.mapExperts(oa);
  assert.equal(e.length, 2);
  assert.equal(e[0].name, 'Ada Lovelace');
  assert.equal(e[0].paper_count, 2, 'case and punctuation variants group');
  assert.equal(e[0].h_index_estimate, 2);
  assert.equal(e[0].h_index_basis, 'retrieved_papers_only');
});

test('confidence, identity_resolution and evidence trail', () => {
  const e = ex.mapExperts([
    P('a', [{ name: 'Ann Orc', orcid: '0000-0001-2345-6789', institution: 'MIT' }], { source_url: 'https://x/a', source_id: 'A', cited_by_count: 30 }),
    P('b', [{ name: 'Ann Orc', orcid: '0000-0001-2345-6789' }, 'Zed Solo'], { source: 'arxiv', cited_by_count: 2 }),
  ]);
  const ann = e.find((x) => x.name === 'Ann Orc'); const zed = e.find((x) => x.name === 'Zed Solo');
  assert.equal(ann.identity_resolution, 'orcid');
  assert.ok(ann.confidence > zed.confidence);
  assert.equal(zed.identity_resolution, 'name_only'); assert.ok(zed.confidence <= 0.70);
  assert.ok(ann.confidence <= 0.95);
  assert.deepEqual(ann.sources, ['arxiv', 'openalex']);
  assert.equal(ann.evidence[0].cited_by, 30, 'highest cited first');
  assert.equal(ann.evidence[0].url, 'https://x/a'); assert.equal(ann.evidence[0].retrieved_at, '2026-01-01T00:00:00.000Z');
  assert.ok(ann.confidence_basis.includes('orcid_present') && ann.confidence_basis.includes('multi_source'));
  // exact values of the documented formula
  assert.equal(ann.confidence, 0.93); // 0.80 + 0.05 (2 papers) + 0.05 (2 sources) + 0.03 (institution)
  assert.equal(zed.confidence, 0.45);
});

test('merge no-ORCID variant into the single ORCID record; homonyms stay separate', () => {
  const e = ex.mapExperts([
    P('a', [{ name: 'Jose Garcia', orcid: '0000-0002-0000-0001' }]),
    P('b', ['José García']),
  ]);
  assert.equal(e.length, 1); assert.equal(e[0].paper_count, 2); assert.equal(e[0].identity_resolution, 'name_merged_into_orcid');
  const two = ex.mapExperts([
    P('a', [{ name: 'Li Wei', orcid: '0000-0002-0000-0001' }]),
    P('b', [{ name: 'Li Wei', orcid: '0000-0002-0000-0002' }]),
    P('c', ['Li Wei']),
  ]);
  assert.equal(two.length, 3, 'two ORCIDs + a bare name: ambiguous, so no merge');
});

test('retracted papers excluded by default; includeRetracted keeps them', () => {
  const papers = [P('a', ['Al One'], { is_retracted: true }), P('b', ['Al One'])];
  assert.equal(ex.mapExperts(papers)[0].paper_count, 1);
  assert.equal(ex.mapExperts(papers, { includeRetracted: true })[0].paper_count, 2);
  assert.equal(ex.mapExperts(papers).provenance.counts.excluded_retracted, 1);
});

test('same paper repeated in input is counted once; envelope and provenance are non-enumerable', () => {
  const a = P('a', ['Al One']);
  const e = ex.mapExperts([a, a, Object.assign({}, a)]);
  assert.equal(e[0].paper_count, 1);
  assert.equal(e.tier, 'derived'); assert.equal(e.source, 'derived'); assert.equal(e.results, e); assert.equal(e.experts, e);
  assert.equal(e.provenance.tool.startsWith('rs-fetcher-experts'), true);
  assert.equal(JSON.parse(JSON.stringify(e)).length, 1);
  assert.equal(Object.keys(e).includes('provenance'), false);
});

test('institution inference is opt-in and first-author only; emails only from openalex objects', () => {
  const p = P('a', ['First One', 'Second Two'], { institution: 'Uni X' });
  assert.equal(ex.mapExperts([p])[0].institution, null);
  const e = ex.mapExperts([p], { inferFirstAuthorInstitution: true });
  assert.equal(e.find((x) => x.name === 'First One').institution, 'Uni X');
  assert.equal(e.find((x) => x.name === 'Second Two').institution, null);
  const mails = ex.mapExperts([
    P('a', [{ name: 'Pub Lic', email: 'pub@uni.edu' }], { source: 'openalex' }),
    P('b', [{ name: 'Gat Ed', email: 'gat@uni.edu' }], { source: 'scopus' }),
  ]);
  assert.equal(mails.find((x) => x.name === 'Pub Lic').public_email_or_null, 'pub@uni.edu');
  assert.equal(mails.find((x) => x.name === 'Gat Ed').public_email_or_null, null);
});

test('forbidden bytes are scrubbed; audit trips on leaks; validation; h-index robustness', () => {
  const e = ex.mapExperts([P('a', ['Ok Name', 'Meeting_transcript Guy'])]);
  assert.equal(e.length, 1, 'author with forbidden bytes is dropped, not emitted');
  assert.equal(e.provenance.counts.skipped_authors, 1);
  assert.throws(() => ex.mapExperts('nope'), TypeError);
  assert.equal(ex.mapExperts([]).length, 0);
  assert.equal(T.computeHIndexEstimate([10, 8, 5, 3, 1]), 3);
  assert.equal(T.computeHIndexEstimate([NaN, -1, 'x', 4, 4, 4, 4]), 4);
  assert.equal(T.computeHIndexEstimate([]), 0);
  // a title carrying a forbidden pattern is scrubbed out of the evidence, not thrown
  const t = ex.mapExperts([P('a', ['Ok Name'], { title: 'call 555-123-4567' })]);
  assert.equal(t[0].evidence[0].title, null);
});

test('deterministic output for identical input (excluding computed_at)', () => {
  const papers = [P('a', ['Bo B', 'Al A']), P('b', ['Al A']), P('c', ['Cy C'])];
  const strip = (x) => JSON.stringify(x);
  assert.equal(strip(ex.mapExperts(papers)), strip(ex.mapExperts(papers)));
  assert.deepEqual(ex.mapExperts(papers).map((x) => x.name), ['Al A', 'Bo B', 'Cy C']);
});
