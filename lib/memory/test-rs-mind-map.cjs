#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 03 -- 5-branch Cytoscape mind map fixture suite.
 *
 * renderMindMap(query_filter, opts) is the read-side companion to the
 * dual-tier writers (rs-neo4j-writer.cjs Plan 89.3-01 and
 * rs-sqlite-mirror.cjs Plan 89.3-02). It reads from the active tier
 * (Aura via opts.driver OR room.db via opts.roomDir) and emits a
 * Cytoscape-compatible JSON payload split into 5 branches plus a
 * standalone HTML wrapper that uses the existing dashboard cytoscape
 * CDN (Canon Part 7 reuse; zero new runtime deps).
 *
 * The 5 branches (per kickoff section 5):
 *   1. Direct Intersections   lsa > 0.6 AND bert > 0.6
 *   2. Structural Transfer    classification = structural_transfer
 *   3. Semantic Implementation classification = semantic_implementation
 *   4. Discovered RS          ReverseSalient nodes
 *   5. Innovation Ecosystem   Innovation + Paper + Author + Institution slice
 *
 * 10 scenarios + A1 end-of-suite sweep:
 *   1  Happy path (Tier 0; all 5 branches populated from seeded fixtures)
 *   2  Tier 0 read path (empty room.db; graceful 5-branch render with empty arrays)
 *   3  Tier 1 read path (mocked driver; verify Cypher dispatch + populated branches)
 *   4  Single-node edge case (1 hybrid RSDiscovery; lsa/bert below threshold; not in any branch)
 *   5  All 5 branches present in JSON regardless of data sparsity
 *   6  HTML wrapper has cytoscape@3.33.1 CDN script tag (Canon Part 7 reuse)
 *   7  Canon Part 8 audit on rendered HTML (clean fixture; no forbidden patterns)
 *   8  query_filter applied correctly (filters by branch name)
 *   9  CANON PART 8 adversarial -- forbidden in node properties read from sqlite
 *   10 CANON PART 8 adversarial -- forbidden in classification field returned by aura mock
 *
 * End-of-suite sweep:
 *   A1: walk every captured result.html_wrapper from passing scenarios;
 *       JSON.stringify and scan against FORBIDDEN_PATTERNS; assert ZERO
 *       hits across all clean scenarios. Throw scenarios verify undefined
 *       result so no html_wrapper to scan.
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

// Lazy-required (so RED commit can prove module-not-found before GREEN).
const lazygraph = require('../core/lazygraph-ops.cjs');

// Track every tmp room dir for cleanup.
const tmpRooms = [];

// Capture result.html_wrapper from every clean scenario for the A1 sweep.
const capturedHtmlWrappers = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-mind-map.cjs',
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

// ---------- Tmp room helper ----------

function makeTmpRoom() {
  const slug = crypto.randomUUID();
  const roomDir = path.join(os.tmpdir(), 'mos-89-3-03-' + slug);
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

// ---------- Direct INSERT seed helpers ----------
//
// Tests inject raw rows directly via lazygraph.openGraph + INSERT.
// We do NOT call rs-sqlite-mirror.writeDiscovery in seeds (that would
// create a circular test dependency between Plan 89.3-02 and this plan).

async function seedNode(roomDir, id, type, properties) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    handle.conn.prepare(
      'INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, ?, ?)'
    ).run(id, type, JSON.stringify(properties || {}));
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

async function seedEdge(roomDir, source, target, type, properties) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    handle.conn.prepare(
      'INSERT OR REPLACE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
    ).run(source, target, type, JSON.stringify(properties || {}));
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

// ---------- Aura mock driver factory ----------
//
// Returns a {session: () => ({run, close})} object that responds to the
// 5 Cypher MATCH queries renderMindMap dispatches in Tier 1 mode. The
// shape of records mirrors the neo4j-driver Result shape (each record
// has a .get(name) method that returns the matched node value with
// .properties).

function makeAuraMock(perBranchRecords) {
  // perBranchRecords: { 'Direct Intersections': [...node objects...], ... }
  const sessionRunCalls = [];

  // Map node.type to the Cypher key the readAuraBranches loop asks for.
  // Returning null for non-matching keys mirrors the real neo4j-driver
  // behavior on OPTIONAL MATCH where the un-matched bind is null. This
  // keeps the multi-hop branch (Innovation Ecosystem) from spuriously
  // duplicating the same row's node across all keys.
  const TYPE_TO_KEY = {
    'RSDiscovery': 'd',
    'ReverseSalient': 'rs',
    'Innovation': 'i',
    'Paper': 'p',
    'Author': 'a',
    'Institution': 'inst',
  };
  function recordFromNode(nodeObj) {
    const matchKey = TYPE_TO_KEY[nodeObj.type] || 'd';
    return {
      get: function (key) {
        if (key !== matchKey) return null;
        return {
          properties: nodeObj.properties || {},
          labels: nodeObj.labels || [nodeObj.type || 'Unknown'],
          identity: { low: nodeObj.id ? hashToInt(nodeObj.id) : 0, high: 0 },
        };
      },
      keys: [matchKey],
      _node: nodeObj,
    };
  }

  function hashToInt(s) {
    // Mod 9999 keeps the integer to <= 4 digits so the resulting
    // 'aura-NNNN' id cannot accidentally trigger the phone-like
    // FORBIDDEN_PATTERNS regex (which matches \d{3}-\d{4} sequences).
    // The mock identity space is small enough that 9999 has zero
    // collision risk for the per-scenario fixtures.
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % 9999;
  }

  return {
    session: function () {
      return {
        run: function (cypher, params) {
          sessionRunCalls.push({ cypher: cypher, params: params || {} });
          // Heuristic: choose branch based on cypher substring.
          let records = [];
          if (/lsa.*0\.6.*bert.*0\.6/i.test(cypher) || /Direct Intersections/i.test(cypher)) {
            records = (perBranchRecords['Direct Intersections'] || []).map(recordFromNode);
          } else if (/structural_transfer/i.test(cypher) || /Structural Transfer/i.test(cypher)) {
            records = (perBranchRecords['Structural Transfer'] || []).map(recordFromNode);
          } else if (/semantic_implementation/i.test(cypher) || /Semantic Implementation/i.test(cypher)) {
            records = (perBranchRecords['Semantic Implementation'] || []).map(recordFromNode);
          } else if (/ReverseSalient/i.test(cypher) || /Discovered RS/i.test(cypher)) {
            records = (perBranchRecords['Discovered RS'] || []).map(recordFromNode);
          } else if (/Innovation/i.test(cypher) || /Paper/i.test(cypher) || /Author/i.test(cypher)) {
            records = (perBranchRecords['Innovation Ecosystem'] || []).map(recordFromNode);
          }
          return Promise.resolve({ records: records });
        },
        close: function () { return Promise.resolve(); },
      };
    },
    _calls: sessionRunCalls,
    close: function () { return Promise.resolve(); },
  };
}

// ---------- Scenarios ----------

async function scenario1HappyPathTier0() {
  // Pre-seed a tmp room.db with the 5 branches' worth of fixtures, then
  // call renderMindMap; assert all 5 branches populated with the right
  // counts.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    // 2 RSDiscovery nodes for Direct Intersections (lsa>0.6 AND bert>0.6)
    await seedNode(tmp.roomDir, 'rsd-di-001', 'RSDiscovery', {
      classification: 'hybrid', lsa: 0.85, bert: 0.78, thesis: 'A safe thesis.',
    });
    await seedNode(tmp.roomDir, 'rsd-di-002', 'RSDiscovery', {
      classification: 'hybrid', lsa: 0.71, bert: 0.69, thesis: 'Another safe thesis.',
    });

    // 1 RSDiscovery for Structural Transfer
    await seedNode(tmp.roomDir, 'rsd-st-001', 'RSDiscovery', {
      classification: 'structural_transfer', lsa: 0.55, bert: 0.20, thesis: 'Structural thesis.',
    });

    // 1 RSDiscovery for Semantic Implementation
    await seedNode(tmp.roomDir, 'rsd-si-001', 'RSDiscovery', {
      classification: 'semantic_implementation', lsa: 0.20, bert: 0.55, thesis: 'Semantic thesis.',
    });

    // 1 hybrid (counts in metadata.total_nodes but does not match branches 2-3)
    await seedNode(tmp.roomDir, 'rsd-hy-001', 'RSDiscovery', {
      classification: 'hybrid', lsa: 0.5, bert: 0.5,
    });

    // 2 ReverseSalient nodes
    await seedNode(tmp.roomDir, 'rs-001', 'ReverseSalient', { query_concept: 'qc1', doc_concept: 'dc1' });
    await seedNode(tmp.roomDir, 'rs-002', 'ReverseSalient', { query_concept: 'qc2', doc_concept: 'dc2' });

    // 1 Innovation + 1 Paper + 1 Author + 1 Institution + 3 edges
    await seedNode(tmp.roomDir, 'inn-001', 'Innovation', { thesis: 'Innovation thesis.', breakthrough_score: 7.5 });
    await seedNode(tmp.roomDir, 'paper-001', 'Paper', { title: 'A paper title', source: 'openalex' });
    await seedNode(tmp.roomDir, 'auth-001', 'Author', { name: 'Smith, Jane', orcid: '0000-0001-2345-6789' });
    await seedNode(tmp.roomDir, 'inst-001', 'Institution', { name: 'Stanford' });
    await seedEdge(tmp.roomDir, 'paper-001', 'auth-001', 'AUTHORED_BY', {});
    await seedEdge(tmp.roomDir, 'auth-001', 'inst-001', 'AFFILIATED_WITH', {});
    await seedEdge(tmp.roomDir, 'rsd-di-001', 'paper-001', 'DERIVED_FROM', {});

    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '1-happy-path-tier0', html: result.html_wrapper });

    // Branch shape assertions.
    assert.ok(result.branches, 'result.branches must be present');
    assert.equal(Object.keys(result.branches).length, 5, 'must have exactly 5 branches');
    assert.equal(result.branches['Direct Intersections'].nodes.length, 2,
      'Direct Intersections must have 2 nodes (lsa>0.6 AND bert>0.6); got ' +
      result.branches['Direct Intersections'].nodes.length);
    assert.equal(result.branches['Structural Transfer'].nodes.length, 1,
      'Structural Transfer must have 1 node');
    assert.equal(result.branches['Semantic Implementation'].nodes.length, 1,
      'Semantic Implementation must have 1 node');
    assert.equal(result.branches['Discovered RS'].nodes.length, 2,
      'Discovered RS must have 2 ReverseSalient nodes');
    assert.equal(result.branches['Innovation Ecosystem'].nodes.length, 4,
      'Innovation Ecosystem must have 4 nodes (Innovation + Paper + Author + Institution); got ' +
      result.branches['Innovation Ecosystem'].nodes.length);

    // Metadata.
    assert.equal(result.metadata.tier, 'sqlite', 'metadata.tier must be sqlite');
    assert.ok(result.metadata.total_nodes >= 9,
      'total_nodes must be >= 9 (5 RSDiscovery + 2 RS + 4 ecosystem); got ' + result.metadata.total_nodes);
    assert.equal(result.metadata.schema_version, '1.0', 'schema_version must be 1.0');
    assert.ok(typeof result.metadata.branch_counts === 'object', 'branch_counts must be object');

    // HTML wrapper.
    assert.ok(typeof result.html_wrapper === 'string', 'html_wrapper must be string');
    assert.ok(result.html_wrapper.length > 0, 'html_wrapper must be non-empty');
    assert.ok(result.html_wrapper.startsWith('<!DOCTYPE html>'),
      'html_wrapper must start with <!DOCTYPE html>');
    assert.ok(result.html_wrapper.indexOf('cytoscape@3.33.1') !== -1,
      'html_wrapper must reference cytoscape@3.33.1 CDN');
  } finally {
    tmp.cleanup();
  }
}

async function scenario2Tier0EmptyGraceful() {
  // Empty room.db (initSchema runs but no data); renderMindMap must
  // return all 5 branches with empty arrays and a non-empty HTML wrapper.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    // Open + close once just to ensure the schema initializes (mimics a
    // fresh room).
    const handle = await lazygraph.openGraph(tmp.roomDir);
    await lazygraph.closeGraph(handle.db);

    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '2-tier0-empty', html: result.html_wrapper });

    assert.equal(Object.keys(result.branches).length, 5, 'must always have 5 branches');
    for (const branch of Object.keys(result.branches)) {
      assert.deepEqual(result.branches[branch].nodes, [],
        'branch ' + branch + ' must have empty nodes on empty room');
      assert.deepEqual(result.branches[branch].edges, [],
        'branch ' + branch + ' must have empty edges on empty room');
    }
    assert.equal(result.metadata.total_nodes, 0, 'total_nodes must be 0');
    assert.equal(result.metadata.total_edges, 0, 'total_edges must be 0');
    assert.ok(result.html_wrapper.length > 0,
      'html_wrapper must still render on empty room (legend + empty cytoscape)');
  } finally {
    tmp.cleanup();
  }
}

async function scenario3Tier1MockedDriver() {
  // Construct a mock driver that returns matching records for the 5
  // branch Cypher queries. Verify driver dispatched + branches populated.
  const m = require('../core/rs-mind-map.cjs');
  const mock = makeAuraMock({
    'Direct Intersections': [
      { id: 'rsd-di-1', type: 'RSDiscovery', properties: { classification: 'hybrid', lsa: 0.9, bert: 0.85, thesis: 'Safe one.' } },
    ],
    'Structural Transfer': [
      { id: 'rsd-st-1', type: 'RSDiscovery', properties: { classification: 'structural_transfer', thesis: 'Safe two.' } },
    ],
    'Semantic Implementation': [
      { id: 'rsd-si-1', type: 'RSDiscovery', properties: { classification: 'semantic_implementation', thesis: 'Safe three.' } },
    ],
    'Discovered RS': [
      { id: 'rs-1', type: 'ReverseSalient', properties: { query_concept: 'safe-query', doc_concept: 'safe-doc' } },
    ],
    'Innovation Ecosystem': [
      { id: 'inn-1', type: 'Innovation', properties: { thesis: 'Safe innovation.', breakthrough_score: 5.5 } },
      { id: 'paper-1', type: 'Paper', properties: { title: 'A safe paper title.' } },
    ],
  });

  const result = await m.renderMindMap({}, { tier: 'aura', driver: mock });
  capturedHtmlWrappers.push({ scenario: '3-tier1-mocked', html: result.html_wrapper });

  assert.equal(result.metadata.tier, 'aura', 'metadata.tier must be aura');
  assert.ok(mock._calls.length >= 5,
    'driver session.run must be called >= 5 times (one per branch); got ' + mock._calls.length);
  assert.equal(result.branches['Direct Intersections'].nodes.length, 1,
    'Direct Intersections must have 1 node');
  assert.equal(result.branches['Discovered RS'].nodes.length, 1,
    'Discovered RS must have 1 node');
  assert.equal(result.branches['Innovation Ecosystem'].nodes.length, 2,
    'Innovation Ecosystem must have 2 nodes; got ' + result.branches['Innovation Ecosystem'].nodes.length);
}

async function scenario4SingleNodeEdgeCase() {
  // Pre-seed a single hybrid RSDiscovery with lsa=0.5, bert=0.5 (below
  // both thresholds AND classification not structural/semantic). It
  // should NOT appear in branches 1-3 but counts in metadata.total_nodes.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    await seedNode(tmp.roomDir, 'rsd-hyb-001', 'RSDiscovery', {
      classification: 'hybrid', lsa: 0.5, bert: 0.5, thesis: 'Below thresholds.',
    });

    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '4-single-node', html: result.html_wrapper });

    assert.equal(result.branches['Direct Intersections'].nodes.length, 0,
      'Direct Intersections must be empty (lsa/bert both 0.5)');
    assert.equal(result.branches['Structural Transfer'].nodes.length, 0,
      'Structural Transfer must be empty (no matching classification)');
    assert.equal(result.branches['Semantic Implementation'].nodes.length, 0,
      'Semantic Implementation must be empty (no matching classification)');
    assert.equal(result.metadata.total_nodes, 1, 'total_nodes must be 1');
    // HTML still renders without JS error in the embedded JSON.
    assert.ok(result.html_wrapper.indexOf('elements') !== -1,
      'html_wrapper must contain the elements JSON marker');
  } finally {
    tmp.cleanup();
  }
}

async function scenario5AllFiveBranchesPresent() {
  // Empty room; assert exactly 5 branch keys with the expected names.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '5-five-branches', html: result.html_wrapper });

    const expected = ['Direct Intersections', 'Structural Transfer',
      'Semantic Implementation', 'Discovered RS', 'Innovation Ecosystem'];
    assert.equal(Object.keys(result.branches).length, 5, 'must have exactly 5 branches');
    for (const name of expected) {
      assert.ok(name in result.branches,
        'branch ' + name + ' must be present in result.branches keys');
    }
  } finally {
    tmp.cleanup();
  }
}

async function scenario6HtmlHasCytoscapeCdn() {
  // result.html_wrapper.includes('https://unpkg.com/cytoscape@3.33.1...').
  // Same CDN URL as dashboard/index.html line 22 (Canon Part 7 reuse).
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '6-html-cdn', html: result.html_wrapper });

    assert.ok(result.html_wrapper.indexOf('https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.min.js') !== -1,
      'html_wrapper must include the exact cytoscape@3.33.1 CDN URL (Canon Part 7 reuse of dashboard pattern)');
  } finally {
    tmp.cleanup();
  }
}

async function scenario7AuditOnRenderedHtmlClean() {
  // Run the happy-path fixture (Test 1 style); assert result.html_wrapper
  // does NOT contain any FORBIDDEN_PATTERNS substrings (the function ran
  // auditQueryObject internally and returned successfully).
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    await seedNode(tmp.roomDir, 'rsd-clean-001', 'RSDiscovery', {
      classification: 'hybrid', lsa: 0.9, bert: 0.85, thesis: 'A clean thesis with no PII.',
    });
    const result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '7-audit-clean', html: result.html_wrapper });

    for (const re of FORBIDDEN_PATTERNS) {
      assert.ok(!re.test(result.html_wrapper),
        'html_wrapper must not match FORBIDDEN_PATTERNS regex ' + re.source);
    }
  } finally {
    tmp.cleanup();
  }
}

async function scenario8QueryFilterApplied() {
  // 4 RSDiscovery rows (2 structural + 2 semantic). renderMindMap
  // ({branch: 'Structural Transfer'}, ...) must populate ONLY the
  // requested branch.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    await seedNode(tmp.roomDir, 'rsd-st-001', 'RSDiscovery', {
      classification: 'structural_transfer', lsa: 0.5, bert: 0.2, thesis: 'Safe one.',
    });
    await seedNode(tmp.roomDir, 'rsd-st-002', 'RSDiscovery', {
      classification: 'structural_transfer', lsa: 0.6, bert: 0.1, thesis: 'Safe two.',
    });
    await seedNode(tmp.roomDir, 'rsd-si-001', 'RSDiscovery', {
      classification: 'semantic_implementation', lsa: 0.1, bert: 0.5, thesis: 'Safe three.',
    });
    await seedNode(tmp.roomDir, 'rsd-si-002', 'RSDiscovery', {
      classification: 'semantic_implementation', lsa: 0.2, bert: 0.6, thesis: 'Safe four.',
    });

    const result = await m.renderMindMap({ branch: 'Structural Transfer' },
      { tier: 'sqlite', roomDir: tmp.roomDir });
    capturedHtmlWrappers.push({ scenario: '8-query-filter', html: result.html_wrapper });

    assert.equal(result.branches['Structural Transfer'].nodes.length, 2,
      'Structural Transfer must have 2 nodes after filter');
    assert.equal(result.branches['Semantic Implementation'].nodes.length, 0,
      'Semantic Implementation must be empty when filter selects Structural Transfer');
    assert.equal(result.branches['Direct Intersections'].nodes.length, 0,
      'Direct Intersections must be empty under filter');
    assert.equal(result.branches['Discovered RS'].nodes.length, 0,
      'Discovered RS must be empty under filter');
    assert.equal(result.branches['Innovation Ecosystem'].nodes.length, 0,
      'Innovation Ecosystem must be empty under filter');

    assert.equal(result.metadata.branch_counts['Structural Transfer'], 2,
      'branch_counts.Structural Transfer must be 2');
    assert.equal(result.metadata.branch_counts['Semantic Implementation'], 0,
      'branch_counts.Semantic Implementation must be 0');
  } finally {
    tmp.cleanup();
  }
}

async function scenario9AdvForbiddenInSqliteProperties() {
  // CANON PART 8 adversarial #1: forbidden bytes in node.properties read
  // from sqlite. The audit on the rendered HTML must catch the leak and
  // throw ExternalEgressViolation.
  const m = require('../core/rs-mind-map.cjs');
  const tmp = makeTmpRoom();
  try {
    // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
    await seedNode(tmp.roomDir, 'rsd-leak-001', 'RSDiscovery', {
      classification: 'structural_transfer',
      lsa: 0.5,
      bert: 0.2,
      thesis: 'A thesis that leaks via meeting with the team.',
    });

    let threw = null;
    let result = undefined;
    try {
      result = await m.renderMindMap({}, { tier: 'sqlite', roomDir: tmp.roomDir });
    } catch (err) {
      threw = err;
    }

    assert.ok(threw, 'must throw on forbidden in sqlite properties');
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation, got ' + (threw && threw.name));
    assert.equal(threw.meta.surface, 'rs-mind-map-html',
      'meta.surface must be rs-mind-map-html, got ' + (threw && threw.meta && threw.meta.surface));
    assert.ok(threw.meta.matched_pattern, 'meta.matched_pattern must be present');
    assert.equal(result, undefined, 'result must NOT be returned on audit fail');
  } finally {
    tmp.cleanup();
  }
}

async function scenario10AdvForbiddenInAuraClassification() {
  // CANON PART 8 adversarial #2: forbidden bytes in classification field
  // returned by aura mock. The audit on the rendered HTML must catch the
  // leak and throw ExternalEgressViolation.
  const m = require('../core/rs-mind-map.cjs');
  // FORBIDDEN_PATTERNS[2] matches /\b(Lawrence|Jonathan|...)\s+(said|...)\b/i.
  const mock = makeAuraMock({
    'Direct Intersections': [],
    'Structural Transfer': [
      { id: 'rsd-leak-001', type: 'RSDiscovery', properties: { classification: 'structural_transfer', thesis: 'Lawrence said this is the answer.' } },
    ],
    'Semantic Implementation': [],
    'Discovered RS': [],
    'Innovation Ecosystem': [],
  });

  let threw = null;
  let result = undefined;
  try {
    result = await m.renderMindMap({}, { tier: 'aura', driver: mock });
  } catch (err) {
    threw = err;
  }

  assert.ok(threw, 'must throw on forbidden in aura classification');
  assert.equal(threw.name, 'ExternalEgressViolation',
    'must throw ExternalEgressViolation, got ' + (threw && threw.name));
  assert.equal(threw.meta.surface, 'rs-mind-map-html',
    'meta.surface must be rs-mind-map-html');
  assert.ok(threw.meta.matched_pattern, 'meta.matched_pattern must be present');
  assert.equal(result, undefined, 'result must NOT be returned on audit fail');
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of capturedHtmlWrappers) {
    if (typeof rec.html !== 'string') continue;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(rec.html)) {
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
  process.stdout.write('=== 89.3-03 rs-mind-map suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path-tier0', scenario1HappyPathTier0);
  await runScenario('2-tier0-empty-graceful', scenario2Tier0EmptyGraceful);
  await runScenario('3-tier1-mocked-driver', scenario3Tier1MockedDriver);
  await runScenario('4-single-node-edge-case', scenario4SingleNodeEdgeCase);
  await runScenario('5-all-five-branches-present', scenario5AllFiveBranchesPresent);
  await runScenario('6-html-cytoscape-cdn', scenario6HtmlHasCytoscapeCdn);
  await runScenario('7-audit-rendered-html-clean', scenario7AuditOnRenderedHtmlClean);
  await runScenario('8-query-filter-applied', scenario8QueryFilterApplied);
  await runScenario('9-adv-CANON-PART-8-sqlite-properties', scenario9AdvForbiddenInSqliteProperties);
  await runScenario('10-adv-CANON-PART-8-aura-classification', scenario10AdvForbiddenInAuraClassification);

  const sweepHits = a1Sweep();
  if (sweepHits > 0) {
    failed += 1;
    failures.push({
      name: 'A1-sweep',
      err: new Error('A1 sweep found ' + sweepHits + ' forbidden-pattern hits'),
    });
    process.stderr.write('  FAIL  A1-sweep (' + sweepHits + ' hits)\n');
  } else {
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits across captured html_wrappers)\n');
  }

  // Cleanup any tmp rooms that survived.
  for (const dir of tmpRooms) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  if (failed > 0) {
    process.stdout.write('=== 89.3-03 rs-mind-map suite: ' +
      passed + '/10 passed' +
      ' (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }

  process.stdout.write('=== 89.3-03 rs-mind-map suite: 10/10 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
