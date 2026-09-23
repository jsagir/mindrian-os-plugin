#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-03 -- evidence-pack validator, D-13 tier map, lane artifact
 * renderer, and filing-parameter builder offline contract tests.
 *
 * Canon Part 8/5/12: an EvidenceClaim row that lacks a source is dropped, not
 * hedged; a tier is assigned in code from the row's source type, never chosen
 * by the agent; an empty lane still renders an honest artifact naming what was
 * searched. These legs run OFFLINE and deterministic: zero network.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// --- Test hygiene: no network egress from this test file --------------------
globalThis.fetch = function _blockedFetch() {
  process.stderr.write('NETWORK_ATTEMPT_361_EVIDENCE_PACK\n');
  throw new Error('NETWORK_ATTEMPT_361_EVIDENCE_PACK: fetch is blocked');
};

const MOD_PATH = path.join(__dirname, '..', 'lib', 'core', 'dominant-design', 'evidence-pack.cjs');
const mod = require(MOD_PATH);
const {
  SOURCE_TYPES,
  FORBIDDEN_ROW_KEYS,
  tierFor,
  validateLaneResult,
  renderLaneArtifact,
  toEvidenceClaimParams,
  laneArtifactName,
} = mod;

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

function goodRow(overrides) {
  return Object.assign({
    claim: 'The market has converged on 18650 cylindrical cells',
    source_url: 'https://example.com/battery-report',
    source_title: 'Battery Industry Report',
    retrieved_at: '2026-09-20',
    quote_or_locator: 'p. 12',
    source_type: 'company_primary',
  }, overrides || {});
}

// ---------- Test 1: SOURCE_TYPES and tierFor (D-13) ----------
{
  assert.deepStrictEqual(
    SOURCE_TYPES,
    ['peer_reviewed', 'standards_body', 'company_primary', 'regulatory_filing', 'market_data', 'press', 'blog', 'other'],
    'Test 1: SOURCE_TYPES exact set and order'
  );
  assert.strictEqual(tierFor('peer_reviewed'), 'Academic', 'Test 1: peer_reviewed -> Academic');
  assert.strictEqual(tierFor('standards_body'), 'Academic', 'Test 1: standards_body -> Academic');
  assert.strictEqual(tierFor('company_primary'), 'Operational', 'Test 1: company_primary -> Operational');
  assert.strictEqual(tierFor('regulatory_filing'), 'Operational', 'Test 1: regulatory_filing -> Operational');
  assert.strictEqual(tierFor('market_data'), 'Operational', 'Test 1: market_data -> Operational');
  assert.strictEqual(tierFor('press'), 'Practitioner', 'Test 1: press -> Practitioner');
  assert.strictEqual(tierFor('blog'), 'Practitioner', 'Test 1: blog -> Practitioner');
  assert.strictEqual(tierFor('other'), 'Practitioner', 'Test 1: other -> Practitioner');
  assert.strictEqual(tierFor('nonsense-unknown-type'), 'Practitioner', 'Test 1: unknown type coerced to Practitioner');
  ok('Test 1: SOURCE_TYPES fixed set; tierFor assigns D-13 tiers, unknown coerced to Practitioner');
}

// ---------- Test 2: validateLaneResult - drop/keep counts ----------
{
  const approvedQueries = ['lithium-ion battery cells competing designs history first introduced'];
  const raw = {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [
      goodRow(),
      goodRow({ source_url: 'https://example.com/two' }),
      goodRow({ source_url: 'https://example.com/three' }),
      goodRow({ quote_or_locator: undefined }),
      goodRow({ source_url: 'ftp://x' }),
      goodRow({ source_url: 'javascript:alert(1)' }),
      goodRow({ confidence: 0.9 }),
      goodRow({ Score: 3 }),
    ],
  };
  const res = validateLaneResult(raw, { approvedQueries: approvedQueries });
  assert.strictEqual(res.ok, true, 'Test 2: ok true');
  assert.strictEqual(res.rows.length, 3, 'Test 2: 3 rows kept');
  assert.deepStrictEqual(res.counts, {
    received: 8, kept: 3, dropped_unsourced: 3, dropped_scored: 2, dropped_over_cap: 0,
  }, 'Test 2: counts match');
  ok('Test 2: validateLaneResult drops unsourced and scored rows, keeps the rest, counts correctly');
}

// ---------- Test 3: kept row whitelist keys and stable ids ----------
{
  const approvedQueries = ['q1'];
  const raw = {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [
      goodRow({ stated_date: '2020', entities: ['Acme', 'Beta'], extra_junk: 'nope' }),
      goodRow({ source_url: 'https://example.com/two' }),
      goodRow({ source_url: 'https://example.com/three' }),
    ],
  };
  const res = validateLaneResult(raw, { approvedQueries: approvedQueries });
  assert.strictEqual(res.rows[0].id, 'E-VC-1', 'Test 3: first id E-VC-1');
  assert.strictEqual(res.rows[1].id, 'E-VC-2', 'Test 3: second id E-VC-2');
  assert.strictEqual(res.rows[2].id, 'E-VC-3', 'Test 3: third id E-VC-3');
  const expectedKeys = ['id', 'claim', 'source_url', 'source_title', 'retrieved_at', 'quote_or_locator', 'source_type', 'evidence_tier', 'stated_date', 'entities'].sort();
  res.rows.forEach(function (row) {
    assert.deepStrictEqual(Object.keys(row).sort(), expectedKeys, 'Test 3: row carries only whitelisted keys');
  });
  assert.strictEqual(res.rows[0].stated_date, '2020', 'Test 3: stated_date kept when non-empty string');
  assert.strictEqual(res.rows[1].stated_date, null, 'Test 3: stated_date null when absent');
  assert.deepStrictEqual(res.rows[0].entities, ['Acme', 'Beta'], 'Test 3: entities passed through under the cap');
  assert.ok(!('extra_junk' in res.rows[0]), 'Test 3: non-whitelisted key dropped');
  ok('Test 3: kept rows carry only the whitelisted keys, stable E-VC-N ids in input order');
}

// ---------- Test 4: retrieved_at unparseable -> dropped unsourced; entities cap ----------
{
  const approvedQueries = ['q1'];
  const manyEntities = [];
  for (let i = 0; i < 15; i += 1) manyEntities.push('entity-' + i);
  manyEntities.push('x'.repeat(100));
  const raw = {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [
      goodRow({ retrieved_at: 'not-a-date' }),
      goodRow({ entities: manyEntities }),
    ],
  };
  const res = validateLaneResult(raw, { approvedQueries: approvedQueries });
  assert.strictEqual(res.counts.dropped_unsourced, 1, 'Test 4: unparseable retrieved_at dropped as unsourced');
  assert.strictEqual(res.rows.length, 1, 'Test 4: one row survives');
  assert.strictEqual(res.rows[0].entities.length, 12, 'Test 4: entities capped at 12');
  res.rows[0].entities.forEach(function (e) {
    assert.ok(e.length <= 80, 'Test 4: each entity capped at 80 chars');
  });
  ok('Test 4: an unparseable retrieved_at is dropped as unsourced; entities capped at 12 x 80 chars');
}

// ---------- Test 5: over-cap rows ----------
{
  const approvedQueries = ['q1'];
  const claims = [];
  for (let i = 0; i < 45; i += 1) {
    claims.push(goodRow({ source_url: 'https://example.com/item-' + i }));
  }
  const res = validateLaneResult({ lane: 'variant_census', queries: approvedQueries, claims: claims }, { approvedQueries: approvedQueries });
  assert.strictEqual(res.rows.length, 40, 'Test 5: capped at 40 rows');
  assert.strictEqual(res.counts.kept, 40, 'Test 5: kept === 40');
  assert.strictEqual(res.counts.dropped_over_cap, 5, 'Test 5: dropped_over_cap === 5');
  ok('Test 5: more than 40 valid rows -> first 40 kept, the rest counted as dropped_over_cap');
}

// ---------- Test 6: query_mismatch, unknown_lane, bad_shape ----------
{
  const mismatch = validateLaneResult(
    { lane: 'variant_census', queries: ['q1', 'q2'], claims: [] },
    { approvedQueries: ['q1', 'q3'] }
  );
  assert.strictEqual(mismatch.ok, false, 'Test 6: query_mismatch ok false');
  assert.strictEqual(mismatch.reason, 'query_mismatch', 'Test 6: reason query_mismatch');
  assert.strictEqual(mismatch.lane, 'variant_census', 'Test 6: lane named on query_mismatch');

  const unknownLane = validateLaneResult(
    { lane: 'bogus_lane', queries: ['q1'], claims: [] },
    { approvedQueries: ['q1'] }
  );
  assert.strictEqual(unknownLane.reason, 'unknown_lane', 'Test 6: unknown lane id -> unknown_lane');

  const badShape1 = validateLaneResult(null, { approvedQueries: [] });
  assert.strictEqual(badShape1.reason, 'bad_shape', 'Test 6: null raw -> bad_shape');

  const badShape2 = validateLaneResult({ lane: 'variant_census', queries: [] }, { approvedQueries: [] });
  assert.strictEqual(badShape2.reason, 'bad_shape', 'Test 6: missing claims array -> bad_shape');
  ok('Test 6: query_mismatch, unknown_lane and bad_shape refusals');
}

// ---------- Test 7: empty lane -> zero rows, synthesized searched_not_found ----------
{
  const approvedQueries = ['q1', 'q2'];
  const res = validateLaneResult(
    { lane: 'variant_census', queries: approvedQueries, claims: [], searched_not_found: [] },
    { approvedQueries: approvedQueries }
  );
  assert.strictEqual(res.ok, true, 'Test 7: ok true on empty lane');
  assert.deepStrictEqual(res.rows, [], 'Test 7: rows empty');
  assert.deepStrictEqual(res.searched_not_found, [
    'searched "q1", found no sourced evidence',
    'searched "q2", found no sourced evidence',
  ], 'Test 7: one searched_not_found entry per approved query');
  ok('Test 7: an empty lane synthesizes one searched_not_found entry per approved query');
}

// ---------- Test 8: raw.error carried through, rows validated as usual ----------
{
  const approvedQueries = ['q1'];
  const res = validateLaneResult(
    { lane: 'variant_census', queries: approvedQueries, claims: [goodRow()], error: 'rate_limited' },
    { approvedQueries: approvedQueries }
  );
  assert.strictEqual(res.ok, true, 'Test 8: ok true with error carried');
  assert.strictEqual(res.error, 'rate_limited', 'Test 8: error carried through');
  assert.strictEqual(res.rows.length, 1, 'Test 8: rows still validated as usual');
  ok('Test 8: raw.error is carried through as error while rows validate as usual');
}

// ---------- Test 9: renderLaneArtifact - non-empty lane ----------
{
  const approvedQueries = ['battery competing designs history first introduced'];
  const valid = validateLaneResult(
    {
      lane: 'variant_census',
      queries: approvedQueries,
      claims: [
        goodRow({ claim: 'A pipe | in a claim\nwith a newline', source_title: 'Report | Title' }),
      ],
    },
    { approvedQueries: approvedQueries }
  );
  const md = renderLaneArtifact(valid, { domain_slug: 'lithium-ion-battery', date: '2026-09-23', retrieved_at: '2026-09-23T00:00:00Z' });
  assert.strictEqual(typeof md, 'string', 'Test 9: renders a string');
  assert.ok(md.startsWith('---\n'), 'Test 9: starts with YAML frontmatter');
  assert.ok(md.includes('methodology: dominant-designs'), 'Test 9: methodology frontmatter key');
  assert.ok(md.includes('artifact_kind: evidence-lane'), 'Test 9: artifact_kind frontmatter key');
  assert.ok(md.includes('lane: variant_census'), 'Test 9: lane frontmatter key');
  assert.ok(md.includes('room_section: competitive-analysis'), 'Test 9: room_section frontmatter key');
  assert.ok(md.includes('claim_count: 1'), 'Test 9: claim_count reflects kept rows');
  assert.ok(md.includes('dropped_unsourced_count: 0'), 'Test 9: dropped_unsourced_count present');
  assert.ok(md.includes('dropped_scored_count: 0'), 'Test 9: dropped_scored_count present');
  assert.ok(md.includes('| Id | Claim | Source | Type | Tier | Stated date | Quote or locator |'), 'Test 9: table header columns');
  assert.ok(md.includes('## Searched, not found'), 'Test 9: closing section present');
  const dataLine = md.split('\n').find(function (ln) { return ln.indexOf('E-VC-1') !== -1; });
  assert.ok(dataLine, 'Test 9: the E-VC-1 data row is a single line');
  assert.ok(md.includes('A pipe \\| in a claim with a newline'), 'Test 9: pipe escaped and newline collapsed to space');
  assert.ok(!md.includes('—'), 'Test 9: no em-dash anywhere in the output');
  ok('Test 9: renderLaneArtifact produces frontmatter, table, escaped cells for a non-empty lane');
}

// ---------- Test 10: renderLaneArtifact - empty lane ----------
{
  const approvedQueries = ['q1'];
  const valid = validateLaneResult(
    { lane: 'discontinuity_signals', queries: approvedQueries, claims: [] },
    { approvedQueries: approvedQueries }
  );
  const md = renderLaneArtifact(valid, { domain_slug: 'lithium-ion-battery', date: '2026-09-23', retrieved_at: '2026-09-23T00:00:00Z' });
  assert.ok(md.includes('| Id | Claim | Source | Type | Tier | Stated date | Quote or locator |'), 'Test 10: table header present on an empty lane');
  assert.ok(md.includes('No sourced evidence found for this lane.'), 'Test 10: honest empty-lane line');
  assert.ok(md.includes('## Searched, not found'), 'Test 10: searched-not-found section present');
  assert.ok(md.includes('searched "q1", found no sourced evidence'), 'Test 10: section lists what was searched');
  ok('Test 10: an empty lane renders the table header plus the honest empty-lane line and the section list');
}

// ---------- Test 11: renderLaneArtifact - error path ----------
{
  const approvedQueries = ['q1'];
  const valid = validateLaneResult(
    { lane: 's_curve_limits', queries: approvedQueries, claims: [], error: 'tavily_timeout' },
    { approvedQueries: approvedQueries }
  );
  const md = renderLaneArtifact(valid, { domain_slug: 'x', date: '2026-09-23', retrieved_at: '2026-09-23T00:00:00Z' });
  assert.ok(md.includes('error: "tavily_timeout"') || md.includes("error: 'tavily_timeout'"), 'Test 11: frontmatter carries error');
  assert.ok(md.includes('Search did not run: tavily_timeout'), 'Test 11: body states search did not run');
  assert.ok(!md.includes('No sourced evidence found for this lane.'), 'Test 11: never presented as a lane that found nothing');
  const errIdx = md.indexOf('Search did not run: tavily_timeout');
  const snfIdx = md.indexOf('## Searched, not found');
  assert.ok(errIdx > -1 && snfIdx > -1 && errIdx < snfIdx, 'Test 11: error line appears above the Searched-not-found section');
  ok('Test 11: a lane that could not search states so, and is never presented as finding nothing');
}

// ---------- Test 12: renderLaneArtifact - source cell link vs bare title ----------
{
  const approvedQueries = ['q1'];
  const valid = validateLaneResult(
    {
      lane: 'variant_census',
      queries: approvedQueries,
      claims: [
        goodRow({ source_url: 'https://example.com/clean-report', source_title: 'Clean Report' }),
      ],
    },
    { approvedQueries: approvedQueries }
  );
  const md = renderLaneArtifact(valid, { domain_slug: 'x', date: '2026-09-23', retrieved_at: '2026-09-23T00:00:00Z' });
  assert.ok(md.includes('[Clean Report](https://example.com/clean-report)'), 'Test 12: clean http(s) url renders as a markdown link');
  ok('Test 12: a clean http(s) source URL renders as a markdown link');
}

// ---------- Test 13: toEvidenceClaimParams - grouping by URL ----------
{
  const approvedQueries = ['q1'];
  const valid = validateLaneResult(
    {
      lane: 'variant_census',
      queries: approvedQueries,
      claims: [
        goodRow({ source_url: 'https://example.com/shared', source_type: 'peer_reviewed', claim: 'Claim A' }),
        goodRow({ source_url: 'https://example.com/shared', source_type: 'press', claim: 'Claim B' }),
        goodRow({ source_url: 'https://example.com/other', source_type: 'blog', claim: 'Claim C' }),
      ],
    },
    { approvedQueries: approvedQueries }
  );
  const params = toEvidenceClaimParams(valid, { sessionId: 's1', artifact_path: 'competitive-analysis/dominant-designs/x-evidence-variant_census.md' });
  assert.strictEqual(params.length, 2, 'Test 13: 3 rows over 2 URLs -> 2 param sets');
  const shared = params.find(function (p) { return p.url === 'https://example.com/shared'; });
  const other = params.find(function (p) { return p.url === 'https://example.com/other'; });
  assert.ok(shared, 'Test 13: shared-url param set exists');
  assert.ok(other, 'Test 13: other-url param set exists');
  assert.strictEqual(shared.sessionId, 's1:dd-variant_census', 'Test 13: sessionId carries the per-lane suffix');
  assert.strictEqual(shared.topic, 'Dominant design evidence: Variant census', 'Test 13: topic names the lane label');
  assert.strictEqual(shared.evidence_tier, 'Academic', 'Test 13: highest tier among grouped rows wins (Academic over Practitioner)');
  assert.ok(shared.summary.includes('E-VC-1') && shared.summary.includes('E-VC-2'), 'Test 13: summary joins the grouped row ids');
  assert.strictEqual(shared.artifact_path, 'competitive-analysis/dominant-designs/x-evidence-variant_census.md', 'Test 13: artifact_path passed through');
  assert.strictEqual(other.evidence_tier, 'Practitioner', 'Test 13: single-row group keeps its own tier');
  ok('Test 13: toEvidenceClaimParams groups by URL, per-lane sessionId suffix, highest-tier-wins');
}

// ---------- Test 14: laneArtifactName ----------
{
  assert.strictEqual(
    laneArtifactName('lithium-ion-battery', '2026-09-23', 'variant_census'),
    'lithium-ion-battery-2026-09-23-evidence-variant_census.md',
    'Test 14: happy path filename'
  );
  assert.throws(function () { laneArtifactName('Invalid Slug!', '2026-09-23', 'variant_census'); }, 'Test 14: invalid slug throws');
  assert.throws(function () { laneArtifactName('lithium-ion-battery', '09-23-2026', 'variant_census'); }, 'Test 14: invalid date throws');
  ok('Test 14: laneArtifactName builds the filename and throws on a bad slug or date');
}

// ---------- Test 15: FORBIDDEN_ROW_KEYS catches substring keys ----------
{
  const approvedQueries = ['q1'];
  const raw = {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [
      goodRow({ dominance_strength: 0.5 }),
      goodRow({ source_url: 'https://example.com/two', relevance_score: 1 }),
    ],
  };
  const res = validateLaneResult(raw, { approvedQueries: approvedQueries });
  assert.strictEqual(res.rows.length, 0, 'Test 15: both rows dropped');
  assert.strictEqual(res.counts.dropped_scored, 2, 'Test 15: both counted as dropped_scored');
  assert.deepStrictEqual(FORBIDDEN_ROW_KEYS.slice().sort(), ['confidence', 'probability', 'rank', 'score', 'strength'], 'Test 15: FORBIDDEN_ROW_KEYS content');
  ok('Test 15: FORBIDDEN_ROW_KEYS catches key names containing score/confidence/strength/probability/rank as substrings');
}

// ---------- Test 16: module purity and no-private-fence greps ----------
{
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  const live = src.split('\n').filter(function (ln) { return !/^\s*\*/.test(ln.trim()) && !/^\s*\/\//.test(ln); }).join('\n');
  assert.ok(!/require\(['"](node:)?fs['"]\)/.test(live), 'Test 16: no require of fs');
  assert.ok(!/require\(['"](node:)?https?['"]\)/.test(live), 'Test 16: no require of http/https');
  assert.ok(!/require\(['"](node:)?net['"]\)/.test(live), 'Test 16: no require of net');
  assert.ok(!/fetch\(/.test(live), 'Test 16: no fetch call');
  assert.ok(/stripInjectionSpans/.test(src), 'Test 16: reuses stripInjectionSpans');
  assert.ok(!/—/.test(src), 'Test 16: no em-dash in source');
  ok('Test 16: module has zero fs/network require, reuses stripInjectionSpans, no em-dash');
}

console.log('\n' + passed + ' passed');
