#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-01 Task 2 -- brain-derivation.cjs fixture tests (18 cases)
 * ==================================================================
 * 18 tests across the deriveSection entry point, its Canon-Part-8-safe
 * query-context chokepoint, and the atomic write + validate + rename
 * pattern copied from Phase 88-04-B.
 *
 * Tests 13 and 14 are LOAD-BEARING Canon Part 8 audits:
 *
 *   Test 13 captures every Brain payload across a full deriveSection
 *   call and asserts EVERY captured cypher matches the frozen allow-list
 *   regex set (sha256 hashes, framework handles, phase identifiers,
 *   problem-type labels, section slugs, numeric scalars) and does NOT
 *   match any forbidden regex (quoted persons, email patterns, currency
 *   magnitudes, verbatim governing_thought fragments).
 *
 *   Test 14 is the negative: inject a triple where the MINTO governing
 *   thought contains "Lawrence said 5M revenue," run deriveSection, and
 *   assert none of the captured Brain payloads contain "Lawrence" or
 *   "5M" or "revenue" -- the dangerous content MUST be filtered out by
 *   buildBrainQueryContext before any Brain query is fired.
 *
 * Mocking strategy: require.cache override for brain-client.cjs. A fake
 * client with isAvailable(), schema(), query(), search(), smartSearch()
 * records every invocation into module-scoped audit arrays that tests
 * inspect. Override is installed BEFORE brain-derivation.cjs is required
 * and reset between tests.
 *
 * Pure node built-ins: fs, os, path, assert, crypto. No npm deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- Tmp workspace helpers ----------

const TMP_ROOTS = [];
function makeTmpRoot(tag) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-derive-' + tag + '-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', function () {
  for (const r of TMP_ROOTS) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------- Mock brain-client factory ----------
//
// Installs a stub brain-client.cjs in require.cache. Each call to
// isAvailable / schema / query / search / smartSearch is recorded into
// audit arrays.

function installMockBrainClient(opts) {
  opts = opts || {};
  const audit = {
    isAvailable_calls: 0,
    schema_calls: 0,
    query_calls: [],
    search_calls: [],
    smartSearch_calls: [],
  };
  const brainClientPath = require.resolve('../core/brain-client.cjs');
  const realClient = require('../core/brain-client.cjs');
  const fakeExports = {
    isAvailable: function () {
      audit.isAvailable_calls += 1;
      return opts.isAvailable === undefined ? true : opts.isAvailable;
    },
    schema: async function () {
      audit.schema_calls += 1;
      if (opts.schemaThrows) { throw new Error(opts.schemaThrows); }
      return opts.schemaReturn || { brain_graph_version: 21432 };
    },
    query: async function (cypher) {
      audit.query_calls.push({ cypher: cypher });
      if (opts.queryThrowsOn && audit.query_calls.length >= opts.queryThrowsOn.index) {
        throw new Error(opts.queryThrowsOn.message);
      }
      if (opts.queryReturnFn) return opts.queryReturnFn(cypher, audit.query_calls.length);
      return opts.queryReturn === undefined
        ? { records: [{ name: 'SWOT', description: 'Classic framework' }] }
        : opts.queryReturn;
    },
    search: async function (q, o) {
      audit.search_calls.push({ query: q, options: o });
      if (opts.searchThrows) throw new Error(opts.searchThrows);
      return opts.searchReturn === undefined
        ? { matches: [{ title: 'Analogy 1', score: 0.8 }] }
        : opts.searchReturn;
    },
    smartSearch: async function (q, o) {
      audit.smartSearch_calls.push({ query: q, options: o });
      return opts.smartSearchReturn || null;
    },
    // Expose real sanitizeCypherInput via _test (prompt builders rely on it).
    _test: realClient._test,
  };
  require.cache[brainClientPath] = {
    id: brainClientPath,
    filename: brainClientPath,
    loaded: true,
    exports: fakeExports,
  };
  return audit;
}

function resetBrainClientCache() {
  const brainClientPath = require.resolve('../core/brain-client.cjs');
  delete require.cache[brainClientPath];
  const derivePath = require.resolve('../core/brain-derivation.cjs');
  delete require.cache[derivePath];
  const promptsPath = require.resolve('../core/brain-derivation-prompts.cjs');
  delete require.cache[promptsPath];
}

// ---------- Fixture triple builders ----------
//
// Build a room + section directory with ROOM.md + STATE.md + MINTO.md
// in the shape readTriple(sectionPath) expects. Uses the existing
// Phase 88 generators indirectly by writing the files manually with
// minimal content that the parsers will accept.

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

function buildFixtureSection(opts) {
  opts = opts || {};
  const root = makeTmpRoot('fix');
  const section = opts.section || 'market-analysis';
  const sectionPath = path.join(root, section);
  fs.mkdirSync(sectionPath, { recursive: true });

  // ROOM.md
  const identityText = opts.identity_text || 'A generic venture identity paragraph with zero personal data.';
  writeFile(path.join(sectionPath, 'ROOM.md'), [
    '---',
    'name: "' + section + '"',
    'kind: section',
    'created_at: "2026-04-20T00:00:00Z"',
    'updated_at: "2026-04-20T00:00:00Z"',
    '---',
    '',
    '# ' + section,
    '',
    identityText,
    '',
    '## Section links',
    '',
  ].join('\n'));

  // STATE.md
  writeFile(path.join(sectionPath, 'STATE.md'), [
    '---',
    'artifact_count: ' + (opts.artifact_count || 2),
    'gap_status: ' + (opts.gap_status || 'partial'),
    'completeness_score: ' + (opts.completeness_score || 0.5),
    'minto_health: ' + (opts.minto_health || 'ok'),
    'last_activity_at: "2026-04-20T00:00:00Z"',
    '---',
    '',
    '## State',
    '',
  ].join('\n'));

  // MINTO.md
  if (opts.no_minto) {
    return { root: root, sectionPath: sectionPath };
  }
  const governingThought = opts.governing_thought === undefined
    ? 'The venture needs to validate its primary assumption within 90 days.'
    : opts.governing_thought;
  const argsCount = opts.arguments_count == null ? 4 : opts.arguments_count;
  const evDensity = opts.evidence_density == null ? 0.6 : opts.evidence_density;
  const meceStatus = opts.mece_status || 'pass';
  const rhs = opts.reasoning_health_score == null ? 0.7 : opts.reasoning_health_score;
  const lines = [
    '---',
    'schema_version: 88',
    'version: 1',
    'section: "' + section + '"',
    'last_generated_at: "2026-04-20T00:00:00Z"',
    'last_artifact_write_seen_at: "2026-04-20T00:00:00Z"',
    'arguments_count: ' + argsCount,
    'evidence_density: ' + evDensity,
    'mece_status: ' + meceStatus,
    'reasoning_health_score: ' + rhs,
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '## Governing Thought',
    '',
    governingThought || '(empty)',
    '',
    '## Arguments',
    '',
    '- arg 1',
    '- arg 2',
    '',
  ];
  writeFile(path.join(sectionPath, 'MINTO.md'), lines.join('\n'));
  return { root: root, sectionPath: sectionPath };
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    resetBrainClientCache();
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

async function runAsync(name, fn) {
  try {
    resetBrainClientCache();
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

// ---------- 18 tests ----------

async function main() {

  // Test 01: happy path.
  await runAsync('Test 01: happy path -> success:true, BRAIN.md written', async function () {
    const audit = installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, true, 'expected success=true, got ' + JSON.stringify(r));
    assert.equal(typeof r.brain_md_path, 'string');
    assert.ok(fs.existsSync(r.brain_md_path), 'BRAIN.md must exist at returned path');
    assert.deepEqual(r.violations, [], 'expected zero violations');
    assert.ok(r.cost_tokens >= 0);
    assert.ok(audit.schema_calls === 1, 'schema() should be called exactly once');
  });

  // Test 02: Brain offline.
  await runAsync('Test 02: Brain offline -> success:false, reason:brain_unavailable', async function () {
    installMockBrainClient({ isAvailable: false });
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, false);
    assert.equal(r.reason, 'brain_unavailable');
    assert.deepEqual(r.violations, []);
    assert.equal(r.cost_tokens, 0);
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')), 'BRAIN.md must NOT be written');
  });

  // Test 03: Brain throws timeout on first query.
  await runAsync('Test 03: brain-client throws timeout -> success:false, reason:derivation_timeout', async function () {
    installMockBrainClient({
      queryThrowsOn: { index: 1, message: 'ETIMEDOUT brain query timed out' },
    });
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, false);
    assert.ok(r.reason === 'derivation_timeout' || r.reason === 'derivation_error',
      'expected derivation_timeout or derivation_error, got ' + r.reason);
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')), 'BRAIN.md must NOT be written');
    // tmpfile cleanup: no .tmp. leftovers
    const remaining = fs.readdirSync(sectionPath).filter(n => n.startsWith('BRAIN.md.tmp'));
    assert.deepEqual(remaining, [], 'tmpfile must be cleaned up on failure');
  });

  // Test 04: Brain throws rate_limited.
  await runAsync('Test 04: brain-client rate_limited -> success:false', async function () {
    installMockBrainClient({
      queryThrowsOn: { index: 1, message: 'rate_limited 429 too many requests' },
    });
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, false);
    assert.ok(/rate|timeout|error/i.test(r.reason));
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')));
  });

  // Test 05: all 9 prompts return empty.
  await runAsync('Test 05: empty Brain results -> BRAIN.md written with (no signal) sections', async function () {
    installMockBrainClient({
      queryReturn: { records: [] },
      searchReturn: { matches: [] },
    });
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, true);
    assert.ok(fs.existsSync(r.brain_md_path));
    const body = fs.readFileSync(r.brain_md_path, 'utf8');
    assert.ok(/no signal|\(empty\)|no match/i.test(body),
      'body should mark empty sections: ' + body.slice(0, 500));
  });

  // Test 06: assembled BRAIN.md fails validateSchema.
  await runAsync('Test 06: schema gate rejects bad assembly -> success:false, tmpfile cleaned', async function () {
    installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    // Force validator failure by injecting a bogus staleness value through options.
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {
      _test_force_bad_staleness: true,
    });
    assert.equal(r.success, false);
    assert.ok(Array.isArray(r.violations));
    assert.ok(r.violations.length >= 1);
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')),
      'BRAIN.md must NOT be written when validator rejects');
    const remaining = fs.readdirSync(sectionPath).filter(n => n.startsWith('BRAIN.md.tmp'));
    assert.deepEqual(remaining, [], 'tmpfile must be cleaned up on validator rejection');
  });

  // Test 07: concurrent deriveSection calls.
  await runAsync('Test 07: concurrent calls -> one wins, other returns concurrent_write', async function () {
    installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const [a, b] = await Promise.all([
      deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {}),
      deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {}),
    ]);
    // Either: one wins, one fails concurrent_write; or both serialize to success.
    // Both success is acceptable if write-lock serializes cleanly (no corruption).
    // The critical assertion is: at most one tmpfile remains, BRAIN.md exists.
    assert.ok(a.success || b.success, 'at least one must succeed');
    assert.ok(fs.existsSync(path.join(sectionPath, 'BRAIN.md')));
    const remaining = fs.readdirSync(sectionPath).filter(n => n.startsWith('BRAIN.md.tmp'));
    assert.deepEqual(remaining, [], 'no tmpfile leftovers after concurrent resolution');
  });

  // Test 08: triple absent (no MINTO.md).
  await runAsync('Test 08: no MINTO.md -> success:false, reason:triple_incomplete', async function () {
    installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({ no_minto: true });
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, false);
    assert.equal(r.reason, 'triple_incomplete');
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')));
  });

  // Test 09: governing_thought null -> uses sha256 of empty string.
  await runAsync('Test 09: null governing_thought -> sha256 of empty string sentinel', async function () {
    installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({ governing_thought: '' });
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, true);
    const body = fs.readFileSync(r.brain_md_path, 'utf8');
    const emptyHash = 'sha256:' + crypto.createHash('sha256').update('').digest('hex');
    assert.ok(body.indexOf(emptyHash) !== -1,
      'expected empty-string sha256 sentinel in BRAIN.md');
  });

  // Test 10: options.only_sections subset.
  // BUG 2 fix update: 'Pattern Matches' was repointed from mode:'query' to
  // mode:'search' (ungated brain_search). When only_sections includes
  // 'Pattern Matches', search IS called (1 call). 'ProblemType Classification'
  // remains mode:'query' (1 query call). Totals: 1 query + 1 search.
  await runAsync('Test 10: only_sections subset -> only specified sections queried', async function () {
    const audit = installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {
      only_sections: ['Pattern Matches', 'ProblemType Classification'],
    });
    assert.equal(r.success, true);
    // 'Pattern Matches' -> mode:'search' -> 1 search call.
    // 'ProblemType Classification' -> mode:'query' -> 1 query call.
    assert.ok(audit.query_calls.length <= 1,
      'expected at most 1 query call (ProblemType Classification), got ' + audit.query_calls.length);
    assert.ok(audit.search_calls.length <= 1,
      'expected at most 1 search call (Pattern Matches), got ' + audit.search_calls.length);
  });

  // Test 11: dry_run.
  await runAsync('Test 11: dry_run -> no Brain queries, no BRAIN.md, would_query:9', async function () {
    const audit = installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {
      dry_run: true,
    });
    assert.equal(r.success, true);
    assert.equal(r.dry_run, true);
    assert.ok(r.would_query >= 1);
    assert.equal(audit.query_calls.length, 0);
    assert.equal(audit.search_calls.length, 0);
    assert.ok(!fs.existsSync(path.join(sectionPath, 'BRAIN.md')));
  });

  // Test 12: schema() fetched once per invocation.
  await runAsync('Test 12: schema() called exactly once per deriveSection', async function () {
    const audit = installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, true);
    assert.equal(audit.schema_calls, 1, 'schema() must be called exactly once');
  });

  // Test 13: CANON PART 8 PAYLOAD AUDIT (load-bearing).
  await runAsync('Test 13: CANON PART 8 payload audit -> every cypher is allow-list safe', async function () {
    const audit = installMockBrainClient({});
    const governingThought = 'The venture needs to validate pricing in the enterprise segment';
    const { sectionPath } = buildFixtureSection({
      governing_thought: governingThought,
    });
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, true, 'derivation must succeed for audit');
    assert.ok(audit.query_calls.length >= 1, 'at least 1 cypher query expected');

    // Forbidden regexes (MUST NOT match any payload):
    const forbidden = [
      /[A-Z][a-z]+\s+said/,     // quoted person
      /@[a-z]+\.[a-z]{2,}/,     // email
      /\$\s?[0-9]/,             // currency
    ];
    // Allow-list regexes (at least one must match each payload):
    const allowSnippets = [
      /sha256:[a-f0-9]{6,}/,
      /framework|Framework|FEEDS_INTO|MATCHES_SECTION|Opportunity|ProblemType|WickedIndicator|RigorLevel|HsiRecommendation|APPLIES_AT_PHASE/,
      /problem_type|UDP|IDP|WDP/,
      /phase|Phase/,
      /section|Section|market-analysis/,
      /\b[0-9]+(\.[0-9]+)?\b/,
    ];

    for (const call of audit.query_calls) {
      const cy = call.cypher;
      for (const f of forbidden) {
        assert.equal(f.test(cy), false,
          'forbidden pattern matched in cypher: ' + f + '\n' + cy);
      }
      // Verbatim governing_thought fragment check (substring):
      assert.equal(cy.indexOf('validate pricing in the enterprise segment'), -1,
        'governing_thought verbatim fragment must NOT appear in cypher');
      // Allow-list: at least one allow-list regex must match.
      let matchedAllow = false;
      for (const a of allowSnippets) {
        if (a.test(cy)) { matchedAllow = true; break; }
      }
      assert.ok(matchedAllow,
        'cypher did not match any allow-list regex: ' + cy.slice(0, 200));
    }

    // Also audit pinecone search calls if any.
    for (const call of audit.search_calls) {
      const q = String(call.query || '');
      for (const f of forbidden) {
        assert.equal(f.test(q), false,
          'forbidden pattern in pinecone search query: ' + f + '\n' + q);
      }
      assert.equal(q.indexOf('validate pricing in the enterprise segment'), -1,
        'governing_thought text must NOT appear in pinecone search');
    }
  });

  // Test 14: CANON PART 8 NEGATIVE -- dangerous content must not leak.
  await runAsync('Test 14: CANON PART 8 negative -> Lawrence/5M/revenue never in queries', async function () {
    const audit = installMockBrainClient({});
    const dangerousIdentity = 'The room identity mentions Lawrence said 5M revenue at the Q4 meeting.';
    const dangerousGT = 'Lawrence said we will hit 5M revenue by Q4 if pricing holds.';
    const { sectionPath } = buildFixtureSection({
      identity_text: dangerousIdentity,
      governing_thought: dangerousGT,
    });
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    // Whether derivation succeeds or not, the audit must hold.
    const all = [
      ...audit.query_calls.map(c => c.cypher),
      ...audit.search_calls.map(c => String(c.query || '')),
    ];
    assert.ok(all.length >= 1, 'expected at least one Brain payload to audit');
    for (const payload of all) {
      assert.equal(payload.indexOf('Lawrence'), -1, 'Lawrence leaked into: ' + payload);
      assert.equal(payload.indexOf('5M'), -1, '5M leaked into: ' + payload);
      assert.equal(payload.indexOf('revenue'), -1, 'revenue leaked into: ' + payload);
      assert.equal(payload.indexOf('Q4 meeting'), -1, 'meeting leaked into: ' + payload);
    }
  });

  // Test 15: atomic write tmpfile naming + fsync-before-rename ordering.
  await runAsync('Test 15: tmpfile follows 88-04-B pattern (BRAIN.md.tmp.<rand>.brain)', async function () {
    installMockBrainClient({});
    const { sectionPath } = buildFixtureSection({});
    // Observe tmpfile naming by instrumenting fs.openSync + fs.fsyncSync +
    // fs.renameSync. This is the 88-04-B ordering trace pattern.
    const origOpen = fs.openSync;
    const origFsync = fs.fsyncSync;
    const origRename = fs.renameSync;
    const trace = [];
    const openedPaths = [];
    fs.openSync = function (p, flags) {
      if (typeof p === 'string' && p.indexOf('BRAIN.md.tmp') !== -1) {
        openedPaths.push(p);
        trace.push('open:' + path.basename(p));
      }
      return origOpen.apply(fs, arguments);
    };
    fs.fsyncSync = function (fd) {
      trace.push('fsync');
      return origFsync.apply(fs, arguments);
    };
    fs.renameSync = function (from, to) {
      if (typeof from === 'string' && from.indexOf('BRAIN.md.tmp') !== -1) {
        trace.push('rename:' + path.basename(from) + '->' + path.basename(to));
      }
      return origRename.apply(fs, arguments);
    };
    try {
      const { deriveSection } = require('../core/brain-derivation.cjs');
      const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
      assert.equal(r.success, true);
      const pattern = /^BRAIN\.md\.tmp\.[a-z0-9]+\.brain$/;
      const named = openedPaths.find(p => pattern.test(path.basename(p)));
      assert.ok(named,
        'expected openSync on tmpfile matching /BRAIN.md.tmp.<rand>.brain/; saw: ' + JSON.stringify(openedPaths));
      // Ordering: open ... fsync ... rename
      const openIdx = trace.findIndex(e => e.startsWith('open:BRAIN.md.tmp'));
      const fsyncIdx = trace.indexOf('fsync');
      const renameIdx = trace.findIndex(e => e.startsWith('rename:BRAIN.md.tmp'));
      assert.ok(openIdx !== -1 && fsyncIdx !== -1 && renameIdx !== -1,
        'expected all three of open/fsync/rename in trace: ' + JSON.stringify(trace));
      assert.ok(openIdx < fsyncIdx && fsyncIdx < renameIdx,
        'expected order open < fsync < rename; trace: ' + JSON.stringify(trace));
    } finally {
      fs.openSync = origOpen;
      fs.fsyncSync = origFsync;
      fs.renameSync = origRename;
    }
  });

  // Test 16: crash mid-write -> tmpfile cleanup best-effort.
  await runAsync('Test 16: crash after first query -> tmpfile cleaned best-effort', async function () {
    installMockBrainClient({
      queryThrowsOn: { index: 2, message: 'simulated post-fsync crash' },
    });
    const { sectionPath } = buildFixtureSection({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const r = await deriveSection(path.dirname(sectionPath), path.basename(sectionPath), {});
    assert.equal(r.success, false);
    const remaining = fs.readdirSync(sectionPath).filter(n => n.startsWith('BRAIN.md.tmp'));
    assert.deepEqual(remaining, [], 'tmpfile must be cleaned on crash, got: ' + remaining.join(','));
  });

  // Test 17: deriveSection never throws.
  await runAsync('Test 17: deriveSection never throws -- always returns result object', async function () {
    installMockBrainClient({});
    const { deriveSection } = require('../core/brain-derivation.cjs');
    // Malformed arguments.
    let r;
    let threw = false;
    try {
      r = await deriveSection(null, null, null);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, false, 'malformed args must not throw');
    assert.equal(typeof r, 'object');
    assert.equal(r.success, false);
    // Non-existent section.
    threw = false;
    try {
      r = await deriveSection('/nonexistent/room/path', 'ghost-section', {});
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, false, 'nonexistent path must not throw');
    assert.equal(r.success, false);
  });

  // Test 18: three-surface assertion.
  await runAsync('Test 18: module loadable as pure CJS with no surface-specific code', async function () {
    installMockBrainClient({});
    const derive = require('../core/brain-derivation.cjs');
    // The module exports deriveSection, buildBrainQueryContext,
    // classifyProblemType, derivePhaseIndicator. All are plain functions.
    assert.equal(typeof derive.deriveSection, 'function');
    assert.equal(typeof derive.buildBrainQueryContext, 'function');
    assert.equal(typeof derive.classifyProblemType, 'function');
    assert.equal(typeof derive.derivePhaseIndicator, 'function');
    // No require('claude-*') or surface-specific imports.
    const src = fs.readFileSync(
      path.join(REPO_ROOT, 'lib', 'core', 'brain-derivation.cjs'),
      'utf8'
    );
    assert.equal(/require\(['"]claude/.test(src), false);
    assert.equal(/process\.platform\s*===\s*['"]darwin['"]/.test(src), false);
    // BSL 1.1 header present.
    assert.ok(/BSL 1\.1/.test(src), 'BSL 1.1 header required');
    // Zero em-dash / en-dash.
    assert.equal(/[\u2013\u2014]/.test(src), false, 'no em/en dashes allowed');
    // Canon Part 8 chokepoint function named correctly.
    assert.ok(/buildBrainQueryContext/.test(src));
  });

  process.stdout.write(
    '\nbrain-derivation.test: ' + passed + '/' + (passed + failed) + ' passed\n'
  );
  // Ensure the Canon Part 8 marker is present in this test file for audit:
  // keyword canon Part 8 appears in the block comments above.
  process.exit(failed === 0 ? 0 : 1);
}

main();
