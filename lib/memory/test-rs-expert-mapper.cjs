#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 04 -- expert mapper fixture suite.
 *
 * mapAuthorsToAura(experts, opts) is the Cypher MATCH + MERGE-and-resolve
 * module that takes Plan 89.2-05 mapExperts output and resolves authors,
 * institutions, and citation edges in the user's own Aura. Tier 1 (Aura
 * connected) runs full Cypher MATCH-then-MERGE; Tier 0 (no Aura) returns
 * a degraded subset from rs-sqlite-mirror's Author + Institution rows in
 * room.db with a friendly note (Claude's Discretion path 3 from CONTEXT.md).
 *
 * Output shape:
 *   {resolved_authors, resolved_institutions, citation_edges, missed_count,
 *    resolution_quality: 'full'|'degraded', tier: 'aura'|'sqlite', note?}
 *
 * 10 scenarios + A1 sweep:
 *   1  Happy path Tier 1 -- mock Aura returns 5 matched authors
 *   2  Tier 1 with unmatched authors -- MERGEs new nodes (3 MATCH + 2 MERGE = 5 resolved)
 *   3  Tier 0 graceful degradation -- room.db has 3 of 5 authors; 2 missed; degraded note returned
 *   4  Tier dispatch error -- no opts; throws TypeError
 *   5  missed_count accuracy in Tier 1 -- 0 MATCH + 2 MERGE failures = 3 resolved + 2 missed
 *   6  citation_edges populated -- mock returns 2 CO_AUTHORED records
 *   7  Empty experts array returns empty result (early return; no driver/openGraph call)
 *   8  Aura unreachable throws AuraUnreachableError (re-thrown)
 *   9  CANON PART 8 adversarial -- forbidden in expert.name -- pre-Cypher Layer 1 catches
 *   10 CANON PART 8 adversarial -- forbidden in expert.institution -- Layer 1 OR Layer 2 catches
 *
 * End-of-suite sweep:
 *   A1: re-scan every captured result object (JSON.stringify) against
 *       FORBIDDEN_PATTERNS as cross-scenario Canon Part 8 guarantee. For
 *       throw-scenarios, no result captured (audit fired pre-write).
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, path, os, crypto).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Source of truth for parity gate.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

// Lazy-required for tmp room seeding (Test 3 + 7).
const lazygraph = require('../core/lazygraph-ops.cjs');

// Track every tmp room dir for cleanup.
const tmpRooms = [];

// Every result object captured for end-of-suite A1 sweep.
const capturedResults = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-neo4j-writer.cjs',
    '../core/rs-expert-mapper.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

async function runScenario(name, fn) {
  const start = Date.now();
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '  (' + (Date.now() - start) + 'ms)\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  } finally {
    resetRequireCache();
  }
}

function captureResult(name, result) {
  capturedResults.push({ scenario: name, result: result });
}

// ---------- Tmp room helper ----------

function makeTmpRoom() {
  const slug = crypto.randomUUID();
  const roomDir = path.join(os.tmpdir(), 'mos-89-3-04-' + slug);
  fs.mkdirSync(roomDir, { recursive: true });
  tmpRooms.push(roomDir);
  return {
    roomDir: roomDir,
    cleanup: function () {
      try {
        fs.rmSync(roomDir, { recursive: true, force: true });
      } catch (_e) { /* best effort */ }
    },
  };
}

// Seed the tmp room.db with N Author + Institution rows + AFFILIATED_WITH
// edges. Mirrors the schema rs-sqlite-mirror writes; the mapper Tier 0
// path SELECTs from this.
async function seedRoomDb(roomDir, authors) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    const insertNode = handle.conn.prepare('INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, ?, ?)');
    const insertEdge = handle.conn.prepare('INSERT OR REPLACE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');
    for (const a of authors) {
      const authorKey = a.name + '|' + (a.orcid || '__no_orcid__');
      insertNode.run(authorKey, 'Author', JSON.stringify({
        name: a.name,
        orcid: a.orcid || '',
        h_index_estimate: typeof a.h_index_estimate === 'number' ? a.h_index_estimate : 0,
      }));
      if (a.institution) {
        insertNode.run(a.institution, 'Institution', JSON.stringify({ name: a.institution }));
        insertEdge.run(authorKey, a.institution, 'AFFILIATED_WITH', JSON.stringify({}));
      }
      // Seed a Paper + AUTHORED_BY edge so citation_edges has something to scan.
      if (a.paper_id) {
        insertNode.run(a.paper_id, 'Paper', JSON.stringify({ title: 'Seed Paper', source: 'openalex' }));
        insertEdge.run(a.paper_id, authorKey, 'AUTHORED_BY', JSON.stringify({}));
      }
    }
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

// ---------- Mock driver factory ----------
//
// Mirrors the neo4j-driver session/run/close API. Each session.run pushes
// {cypher, params} onto driver.opLog. Returns a Promise that resolves
// based on opts.matchResults / opts.mergeResults / opts.coAuthorResults
// arrays (popped per call). opts.simulateConnectionError throws on first
// session.run. opts.simulateMergeFailureFor: array of author keys whose
// MERGE call should throw a Neo4j ConstraintError-like error (Test 5).

function makeMockDriver(opts) {
  opts = opts || {};
  const matchResults = (opts.matchResults || []).slice();
  const mergeResults = (opts.mergeResults || []).slice();
  const coAuthorResults = opts.coAuthorResults || [];
  const driver = {
    opLog: [],
    runCount: 0,
    sessionsClosed: 0,
    session: function () {
      const drv = this;
      return {
        run: async function (cypher, params) {
          drv.opLog.push({ cypher: cypher, params: params });
          drv.runCount += 1;
          if (opts.simulateConnectionError) {
            throw new Error('connect ECONNREFUSED 127.0.0.1:7687');
          }
          // Route based on cypher content.
          if (/CO_AUTHORED|MATCH \(a1:Author\)/.test(cypher)) {
            return { records: coAuthorResults.map(makeRecord), summary: { counters: {} } };
          }
          if (/^MERGE|^\s*MERGE/.test(cypher)) {
            // MERGE branch.
            if (opts.simulateMergeFailureFor && params && params.key &&
                opts.simulateMergeFailureFor.indexOf(params.key) !== -1) {
              throw new Error('Neo4j.ClientError.Schema.ConstraintValidationFailed: MERGE failed');
            }
            const next = mergeResults.shift();
            return { records: (next || []).map(makeRecord), summary: { counters: { nodesCreated: 1 } } };
          }
          // MATCH branch (default).
          const next = matchResults.shift();
          return { records: (next || []).map(makeRecord), summary: { counters: {} } };
        },
        close: async function () {
          drv.sessionsClosed += 1;
        },
      };
    },
  };
  return driver;
}

// neo4j-driver Record shim: get(key) returns the field value.
function makeRecord(obj) {
  return {
    get: function (key) {
      return obj[key];
    },
    keys: Object.keys(obj),
    _fields: Object.values(obj),
  };
}

// ---------- Fixture builders ----------

function makeExpert(overrides) {
  const base = {
    name: 'Smith, Jane',
    orcid: '0000-0001-2345-6789',
    institution: 'Stanford University',
    paper_count: 1,
    h_index_estimate: 1,
    public_email_or_null: null,
  };
  if (overrides) {
    for (const k of Object.keys(overrides)) {
      base[k] = overrides[k];
    }
  }
  return base;
}

function makeFiveExperts() {
  return [
    makeExpert({ name: 'Smith, Jane', orcid: '0000-0001-1111-1111', institution: 'Stanford', paper_count: 4, h_index_estimate: 3 }),
    makeExpert({ name: 'Alpha, Adam', orcid: '0000-0002-2222-2222', institution: 'MIT', paper_count: 3, h_index_estimate: 2 }),
    makeExpert({ name: 'Beta, Bob', orcid: '0000-0003-3333-3333', institution: 'Harvard', paper_count: 2, h_index_estimate: 2 }),
    makeExpert({ name: 'Gamma, Greg', orcid: '0000-0004-4444-4444', institution: 'Berkeley', paper_count: 1, h_index_estimate: 1 }),
    makeExpert({ name: 'Delta, Dora', orcid: '0000-0005-5555-5555', institution: 'CalTech', paper_count: 1, h_index_estimate: 1 }),
  ];
}

// ---------- Scenarios ----------

async function scenario1HappyPathTier1() {
  const m = require('../core/rs-expert-mapper.cjs');
  const experts = makeFiveExperts();
  // Mock returns 1-record MATCH for each expert (5 calls -> 5 single-record results)
  const driver = makeMockDriver({
    matchResults: experts.map(function (e, i) {
      return [{ name: e.name, orcid: e.orcid, aura_node_id: 100 + i }];
    }),
    coAuthorResults: [],
  });

  const result = await m.mapAuthorsToAura(experts, { tier: 'aura', driver: driver });
  captureResult('1-happy-tier1', result);

  assert.equal(result.resolved_authors.length, 5, 'expected 5 resolved, got ' + result.resolved_authors.length);
  assert.equal(result.missed_count, 0, 'missed_count must be 0, got ' + result.missed_count);
  assert.equal(result.resolution_quality, 'full', 'resolution_quality must be full, got ' + result.resolution_quality);
  assert.equal(result.tier, 'aura', 'tier must be aura, got ' + result.tier);
  assert.strictEqual(result.note, undefined, 'note must be undefined when full, got ' + JSON.stringify(result.note));
  assert.equal(result.schema_version, '1.0');
}

async function scenario2Tier1WithUnmatchedMerges() {
  const m = require('../core/rs-expert-mapper.cjs');
  const experts = makeFiveExperts();
  // First 3 experts match; last 2 return zero rows (unmatched -> trigger MERGE)
  const driver = makeMockDriver({
    matchResults: [
      [{ name: experts[0].name, orcid: experts[0].orcid, aura_node_id: 200 }],
      [{ name: experts[1].name, orcid: experts[1].orcid, aura_node_id: 201 }],
      [{ name: experts[2].name, orcid: experts[2].orcid, aura_node_id: 202 }],
      [], // unmatched
      [], // unmatched
    ],
    mergeResults: [
      [{ name: experts[3].name, aura_node_id: 203 }],
      [{ name: experts[4].name, aura_node_id: 204 }],
    ],
  });

  const result = await m.mapAuthorsToAura(experts, { tier: 'aura', driver: driver });
  captureResult('2-tier1-unmatched-merge', result);

  assert.equal(result.resolved_authors.length, 5, 'expected 5 resolved (3 MATCH + 2 MERGE), got ' + result.resolved_authors.length);
  assert.equal(result.missed_count, 0, 'none should be missed; all resolved by MATCH or MERGE');
  // Verify both MATCH and MERGE Cyphers ran.
  const cypherLog = driver.opLog.map(function (o) { return o.cypher; }).join('\n');
  assert.ok(/MATCH/.test(cypherLog), 'MATCH Cypher must have run');
  assert.ok(/MERGE/.test(cypherLog), 'MERGE Cypher must have run for unmatched');
}

async function scenario3Tier0GracefulDegradation() {
  const m = require('../core/rs-expert-mapper.cjs');
  const tmp = makeTmpRoom();
  try {
    // Seed 3 of the 5 authors into room.db
    await seedRoomDb(tmp.roomDir, [
      { name: 'Smith, Jane', orcid: '0000-0001-1111-1111', institution: 'Stanford', h_index_estimate: 3, paper_id: 'p1' },
      { name: 'Alpha, Adam', orcid: '0000-0002-2222-2222', institution: 'MIT', h_index_estimate: 2, paper_id: 'p2' },
      { name: 'Beta, Bob', orcid: '0000-0003-3333-3333', institution: 'Harvard', h_index_estimate: 2, paper_id: 'p1' },
    ]);

    const experts = makeFiveExperts();
    const result = await m.mapAuthorsToAura(experts, { tier: 'sqlite', roomDir: tmp.roomDir });
    captureResult('3-tier0-degraded', result);

    assert.equal(result.resolved_authors.length, 3, 'expected 3 resolved from sqlite, got ' + result.resolved_authors.length);
    assert.equal(result.missed_count, 2, 'expected 2 missed (Gamma + Delta absent from db), got ' + result.missed_count);
    assert.equal(result.resolution_quality, 'degraded', 'resolution_quality must be degraded for Tier 0');
    assert.equal(result.tier, 'sqlite');
    assert.ok(typeof result.note === 'string' && result.note.length > 0, 'note must be non-empty for degraded result');
    assert.ok(/Aura/i.test(result.note), 'note should mention Aura, got: ' + result.note);
    assert.ok(/multi-hop/i.test(result.note), 'note should mention multi-hop, got: ' + result.note);
    assert.ok(Array.isArray(result.citation_edges), 'citation_edges must be an array');
    // citation_edges should be best-effort populated from AUTHORED_BY edges (Smith + Beta share paper p1)
    assert.ok(result.citation_edges.length >= 1, 'citation_edges must be populated from shared-paper AUTHORED_BY edges, got ' + result.citation_edges.length);
  } finally {
    tmp.cleanup();
  }
}

async function scenario4TierDispatchError() {
  const m = require('../core/rs-expert-mapper.cjs');
  let threw = null;
  try {
    await m.mapAuthorsToAura([{ name: 'Smith' }], {});
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on missing opts.tier/driver/roomDir');
  assert.equal(threw.name, 'TypeError', 'must throw TypeError, got ' + threw.name);
  assert.ok(/opts\.tier OR opts\.driver OR opts\.roomDir/.test(threw.message), 'error message must mention all three options, got: ' + threw.message);
}

async function scenario5MissedCountAccuracy() {
  const m = require('../core/rs-expert-mapper.cjs');
  const experts = makeFiveExperts();
  // ALL MATCH return zero rows -> all 5 trigger MERGE; simulate 2 MERGE failures
  const driver = makeMockDriver({
    matchResults: [[], [], [], [], []],
    mergeResults: [
      [{ name: experts[0].name, aura_node_id: 300 }],
      [{ name: experts[1].name, aura_node_id: 301 }],
      [{ name: experts[2].name, aura_node_id: 302 }],
      // experts[3] and experts[4] MERGE will fail (simulateMergeFailureFor)
    ],
    simulateMergeFailureFor: [
      experts[3].name + '|' + experts[3].orcid,
      experts[4].name + '|' + experts[4].orcid,
    ],
  });

  const result = await m.mapAuthorsToAura(experts, { tier: 'aura', driver: driver });
  captureResult('5-missed-count', result);

  assert.equal(result.resolved_authors.length, 3, 'expected 3 resolved, got ' + result.resolved_authors.length);
  assert.equal(result.missed_count, 2, 'expected 2 missed (MERGE failures), got ' + result.missed_count);
  assert.equal(result.resolution_quality, 'full', 'still full because tier is aura');
}

async function scenario6CitationEdgesPopulated() {
  const m = require('../core/rs-expert-mapper.cjs');
  const experts = makeFiveExperts().slice(0, 3);
  const driver = makeMockDriver({
    matchResults: experts.map(function (e, i) {
      return [{ name: e.name, orcid: e.orcid, aura_node_id: 400 + i }];
    }),
    coAuthorResults: [
      { source_author: experts[0].name, target_author: experts[1].name, paper_id: 'openalex:W001' },
      { source_author: experts[0].name, target_author: experts[2].name, paper_id: 'openalex:W002' },
    ],
  });

  const result = await m.mapAuthorsToAura(experts, { tier: 'aura', driver: driver });
  captureResult('6-citation-edges', result);

  assert.ok(result.citation_edges.length >= 2, 'citation_edges must have >= 2 records, got ' + result.citation_edges.length);
  for (const edge of result.citation_edges) {
    assert.ok('source_author' in edge, 'edge missing source_author');
    assert.ok('target_author' in edge, 'edge missing target_author');
    assert.ok('paper_id' in edge, 'edge missing paper_id');
    assert.equal(edge.type, 'CO_AUTHORED', 'edge type must be CO_AUTHORED, got ' + edge.type);
  }
}

async function scenario7EmptyExpertsArray() {
  const m = require('../core/rs-expert-mapper.cjs');
  const tmp = makeTmpRoom();
  try {
    const result = await m.mapAuthorsToAura([], { tier: 'sqlite', roomDir: tmp.roomDir });
    captureResult('7-empty-experts', result);

    assert.deepEqual(result.resolved_authors, [], 'resolved_authors must be empty');
    assert.deepEqual(result.resolved_institutions, [], 'resolved_institutions must be empty');
    assert.deepEqual(result.citation_edges, [], 'citation_edges must be empty');
    assert.equal(result.missed_count, 0);
    assert.equal(result.resolution_quality, 'degraded', 'still degraded because tier is sqlite');
    assert.equal(result.tier, 'sqlite');
  } finally {
    tmp.cleanup();
  }
}

async function scenario8AuraUnreachable() {
  const m = require('../core/rs-expert-mapper.cjs');
  const experts = makeFiveExperts().slice(0, 1);
  const driver = makeMockDriver({ simulateConnectionError: true });

  let threw = null;
  try {
    await m.mapAuthorsToAura(experts, { tier: 'aura', driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on Aura connection failure');
  assert.equal(threw.name, 'AuraUnreachableError', 'must throw AuraUnreachableError, got ' + threw.name);
  assert.ok(threw.meta && typeof threw.meta.original === 'string', 'meta.original must carry original message');
  assert.ok(/ECONNREFUSED|connect/i.test(threw.meta.original), 'meta.original must reflect connection failure, got: ' + threw.meta.original);
}

async function scenario9AdvForbiddenInName() {
  const m = require('../core/rs-expert-mapper.cjs');
  // FORBIDDEN_PATTERNS[2] matches Lawrence said -- pattern in expert.name
  const poisonedExpert = makeExpert({ name: 'Lawrence said our PI', orcid: null, institution: 'X', paper_count: 1, h_index_estimate: 1 });
  const driver = makeMockDriver({ matchResults: [[]] });

  let threw = null;
  let result = null;
  try {
    result = await m.mapAuthorsToAura([poisonedExpert], { tier: 'aura', driver: driver });
  } catch (err) {
    threw = err;
  }

  assert.ok(threw, 'must throw on adversarial name (Layer 1 OR Layer 2 catches)');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + threw.name);
  assert.ok(threw.meta && typeof threw.meta.surface === 'string', 'meta.surface must be set');
  assert.ok(threw.meta.surface === 'rs-expert-mapper' || threw.meta.surface === 'rs-expert-mapper-output',
    'surface must be one of the 2 expert-mapper tags, got: ' + threw.meta.surface);
  // session.run NEVER called (Layer 1 caught pre-Cypher).
  assert.equal(driver.opLog.length, 0, 'session.run must NOT have run; Layer 1 audit caught pre-Cypher; got opLog.length=' + driver.opLog.length);
  captureResult('9-adv-name-throw', { thrown: threw.name, surface: threw.meta.surface });
}

async function scenario10AdvForbiddenInInstitution() {
  // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i in expert.institution
  // This test verifies BOTH layers are wired (grep for 2 distinct surface
  // strings: 'rs-expert-mapper' AND 'rs-expert-mapper-output' in source).
  const fs2 = require('node:fs');
  const sourcePath = path.join(REPO_ROOT, 'lib', 'core', 'rs-expert-mapper.cjs');
  const source = fs2.readFileSync(sourcePath, 'utf-8');
  assert.ok(/'rs-expert-mapper'/.test(source) || /SURFACE_PRE\s*=\s*'rs-expert-mapper'/.test(source),
    'source must wire SURFACE_PRE = rs-expert-mapper');
  assert.ok(/'rs-expert-mapper-output'/.test(source) || /SURFACE_POST\s*=\s*'rs-expert-mapper-output'/.test(source),
    'source must wire SURFACE_POST = rs-expert-mapper-output');

  // Now exercise the actual throw path.
  const m = require('../core/rs-expert-mapper.cjs');
  const poisonedExpert = makeExpert({ name: 'Smith, Jane', orcid: '0000-0001-2345-6789', institution: 'meeting with Stanford', paper_count: 1, h_index_estimate: 1 });
  const driver = makeMockDriver({ matchResults: [[]] });

  let threw = null;
  try {
    await m.mapAuthorsToAura([poisonedExpert], { tier: 'aura', driver: driver });
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, 'must throw on adversarial institution (Layer 1 catches pre-Cypher)');
  assert.equal(threw.name, 'ExternalEgressViolation', 'must throw ExternalEgressViolation, got ' + threw.name);
  assert.ok(threw.meta && /meeting with/i.test(threw.meta.matched_pattern || ''),
    'matched_pattern must reflect meeting with regex, got: ' + (threw.meta && threw.meta.matched_pattern));
  captureResult('10-adv-institution-throw', { thrown: threw.name, surface: threw.meta.surface });
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of capturedResults) {
    let json;
    try {
      json = JSON.stringify(rec.result);
    } catch (_e) {
      continue;
    }
    if (typeof json !== 'string') continue;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(json)) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  scenario=' + rec.scenario +
          '  pattern=' + re.source + '\n'
        );
      }
    }
  }
  return hits;
}

// ---------- Main ----------

(async function main() {
  process.stdout.write('=== 89.3-04 rs-expert-mapper suite (REPO_ROOT=' + REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path-tier1', scenario1HappyPathTier1);
  await runScenario('2-tier1-unmatched-MERGE', scenario2Tier1WithUnmatchedMerges);
  await runScenario('3-tier0-graceful-degradation', scenario3Tier0GracefulDegradation);
  await runScenario('4-tier-dispatch-error', scenario4TierDispatchError);
  await runScenario('5-missed-count-accuracy', scenario5MissedCountAccuracy);
  await runScenario('6-citation-edges-populated', scenario6CitationEdgesPopulated);
  await runScenario('7-empty-experts-early-return', scenario7EmptyExpertsArray);
  await runScenario('8-aura-unreachable', scenario8AuraUnreachable);
  await runScenario('9-adv-CANON-PART-8-name', scenario9AdvForbiddenInName);
  await runScenario('10-adv-CANON-PART-8-institution', scenario10AdvForbiddenInInstitution);

  const sweepHits = a1Sweep();
  if (sweepHits > 0) {
    failed += 1;
    failures.push({
      name: 'A1-sweep',
      err: new Error('A1 sweep found ' + sweepHits + ' forbidden-pattern hits'),
    });
    process.stderr.write('  FAIL  A1-sweep (' + sweepHits + ' hits)\n');
  } else {
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits)\n');
  }

  // Final cleanup of all tmp rooms.
  for (const dir of tmpRooms) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  if (failed > 0) {
    process.stdout.write('=== 89.3-04 rs-expert-mapper suite: ' + passed + '/10 passed' + ' (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' + (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }

  process.stdout.write('=== 89.3-04 rs-expert-mapper suite: 10/10 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
