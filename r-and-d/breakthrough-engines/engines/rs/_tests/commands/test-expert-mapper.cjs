'use strict';
// Tests for rs-expert-mapper.cjs. The Aura driver and the SQLite handle are
// HAND-MADE fakes; Cypher is never executed. Cypher text is checked statically.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-experts/lib/core/rs-expert-mapper.cjs']);
const lib = (n) => require(path.join(root, 'lib/core', n));
const mapper = lib('rs-expert-mapper.cjs');
const lazy = lib('lazygraph-ops.cjs');
const T = mapper._test;

function fakeDriver(opts) {
  opts = opts || {};
  const store = new Map(Object.entries(opts.existing || {}));
  const calls = [];
  let nextId = 100;
  return {
    calls,
    session() {
      return {
        async run(cypher, params) {
          calls.push({ cypher, params });
          if (opts.failWith) throw new Error(opts.failWith);
          if (cypher === T.MATCH_AUTHOR_CYPHER) {
            return { records: store.has(params.key) ? [{ get: () => store.get(params.key) }] : [] };
          }
          if (cypher === T.MERGE_AUTHOR_CYPHER) {
            if (opts.mergeThrows && opts.mergeThrows === params.name) throw new Error('constraint violation');
            const id = nextId++; store.set(params.key, id);
            return { records: [{ get: () => id }] }; // fixed semantics: row always returned
          }
          if (cypher === T.CO_AUTHORED_CYPHER) {
            const rows = opts.edges || [];
            return { records: rows.slice(0, params.limit).map((r) => ({ get: (k) => r[k] })) };
          }
          return { records: [] };
        },
        async close() {},
      };
    },
  };
}

test('MERGE cypher: institution branch no longer filters the row', () => {
  assert.ok(!/WITH a\s*\nWHERE \$institution/.test(T.MERGE_AUTHOR_CYPHER));
  assert.ok(/FOREACH \(_ IN CASE WHEN \$institution IS NULL THEN \[\] ELSE \[1\] END/.test(T.MERGE_AUTHOR_CYPHER));
  assert.ok(/RETURN a\.name AS name, id\(a\) AS aura_node_id/.test(T.MERGE_AUTHOR_CYPHER));
  assert.ok(/LIMIT \$limit/.test(T.CO_AUTHORED_CYPHER));
});

test('aura tier: matched vs merged, confidence, evidence trail, provenance', async () => {
  const drv = fakeDriver({ existing: { 'Ann Orc|0000-0001': 7 }, edges: [{ source_author: 'A', target_author: 'B', paper_id: 'p1' }] });
  const experts = [
    { name: 'Ann Orc', orcid: '0000-0001', institution: 'MIT', paper_count: 3, h_index_estimate: 2, confidence: 0.9,
      evidence: [{ paper_id: 'W1', source: 'openalex', url: 'https://x', title: 'T', retrieved_at: '2026-01-01', cited_by: 3 }] },
    { name: 'New Person', orcid: null, institution: null },          // no institution: the original cypher lost this row
    { name: 'Ann Orc', orcid: '0000-0001' },                         // duplicate key
  ];
  const r = await mapper.mapAuthorsToAura(experts, { driver: drv });
  assert.equal(r.tier, 'aura'); assert.equal(r.resolution_quality, 'full');
  assert.equal(r.resolved_authors.length, 2);
  assert.equal(r.missed_count, 0);
  assert.equal(r.duplicates_collapsed, 1);
  const ann = r.resolved_authors[0], np = r.resolved_authors[1];
  assert.equal(ann.resolution, 'matched'); assert.equal(ann.resolution_confidence, 0.95); assert.equal(ann.confidence, 0.9);
  assert.equal(ann.aura_node_id, 7);
  assert.equal(ann.evidence[0].kind, 'aura_node_match'); assert.equal(ann.evidence[1].kind, 'upstream_paper'); assert.equal(ann.evidence[1].paper_id, 'W1');
  assert.equal(np.resolution, 'merged'); assert.equal(np.confidence, 0.4); assert.equal(np.evidence[0].key_type, 'name_only');
  assert.equal(r.citation_edges.length, 1);
  assert.equal(r.provenance.tool.startsWith('rs-expert-mapper'), true);
  assert.equal(r.provenance.input_count, 3);
  assert.equal(r.schema_version, '1.0');
});

test('aura tier: per-expert merge failure is a reasoned miss; connection failure -> AuraUnreachableError', async () => {
  const r = await mapper.mapAuthorsToAura([{ name: 'Bad One' }, { name: 'Good One' }], { driver: fakeDriver({ mergeThrows: 'Bad One' }) });
  assert.equal(r.missed_count, 1);
  assert.match(r.missed_details[0].reason, /constraint violation/);
  assert.equal(r.resolved_authors.length, 1);
  await assert.rejects(() => mapper.mapAuthorsToAura([{ name: 'X' }], { driver: fakeDriver({ failWith: 'connect ECONNREFUSED' }) }), (e) => e.name === 'AuraUnreachableError');
});

test('aura tier: edge query bounded and truncation reported', async () => {
  const edges = Array.from({ length: 10 }, (_, i) => ({ source_author: 'a' + i, target_author: 'b' + i, paper_id: 'p' + i }));
  const r = await mapper.mapAuthorsToAura([{ name: 'X' }], { driver: fakeDriver({ edges }), edgeLimit: 4 });
  assert.equal(r.citation_edges.length, 4); assert.equal(r.citation_edges_truncated, true);
  const r2 = await mapper.mapAuthorsToAura([{ name: 'X' }], { driver: fakeDriver({ edges }), edgeLimit: 50 });
  assert.equal(r2.citation_edges.length, 10); assert.equal(r2.citation_edges_truncated, false);
});

test('sqlite tier: degraded result with confidence, evidence, missed reasons, truncation, handle closed', async () => {
  lazy._setFixture({
    authors: [{ id: 'Ann Orc|0000-0001', properties: JSON.stringify({ name: 'Ann Orc' }) }, { id: 'Solo Name|__no_orcid__', properties: '{}' }],
    edges: [1, 2, 3].map((i) => ({ paper_id: 'p' + i, author1: 'Ann Orc|0000-0001', author2: 'Solo Name|__no_orcid__' })),
  });
  const r = await mapper.mapAuthorsToAura(
    [{ name: 'Ann Orc', orcid: '0000-0001', institution: 'MIT' }, { name: 'Solo Name' }, { name: 'Ghost' }],
    { roomDir: '/tmp/room', edgeLimit: 2 });
  assert.equal(r.tier, 'sqlite'); assert.equal(r.resolution_quality, 'degraded'); assert.equal(r.note, mapper.DEGRADED_NOTE);
  assert.equal(r.resolved_authors.length, 2); assert.equal(r.missed_count, 1);
  assert.deepEqual(r.missed_details, [{ name: 'Ghost', reason: 'no_author_node_with_key' }]);
  assert.equal(r.resolved_authors[0].confidence, 0.9); assert.equal(r.resolved_authors[1].confidence, 0.55);
  assert.equal(r.citation_edges.length, 2); assert.equal(r.citation_edges_truncated, true);
  assert.equal(r.resolved_institutions[0].name, 'MIT');
  assert.equal(lazy._closedCount(), 1);
});

test('validation, tier detection, empty input, Canon Part 8 audit', async () => {
  await assert.rejects(() => mapper.mapAuthorsToAura('x', { tier: 'sqlite' }), TypeError);
  await assert.rejects(() => mapper.mapAuthorsToAura([], {}), TypeError);
  const e = await mapper.mapAuthorsToAura([], { tier: 'sqlite', roomDir: 'r' });
  assert.equal(e.resolved_authors.length, 0); assert.equal(e.note, mapper.DEGRADED_NOTE); assert.ok(e.provenance);
  await assert.rejects(() => mapper.mapAuthorsToAura([{ name: 'meeting_transcript person' }], { driver: fakeDriver() }), (x) => x.name === 'ExternalEgressViolation');
  // audit runs on duplicates too, before they are collapsed
  await assert.rejects(() => mapper.mapAuthorsToAura([{ name: 'A' }, { name: 'A' }, { name: 'decision_log' }], { driver: fakeDriver() }), (x) => x.name === 'ExternalEgressViolation');
  assert.equal(T.resolutionConfidence('merged', true), 0.4);
  assert.equal(T.combineConfidence(0.95, { confidence: 0.5 }), 0.5);
  assert.equal(T.combineConfidence(0.95, {}), 0.95);
});
