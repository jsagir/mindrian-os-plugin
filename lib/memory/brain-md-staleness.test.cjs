#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-03 Task 1 -- brain-md-staleness.cjs fixture tests (13 cases)
 * ====================================================================
 * Tests the LOCAL staleness computation contract. The scan NEVER queries
 * Brain content. Allowed: brain-client.isAvailable() + brain-client.schema().
 * Forbidden: brain-client.query / search / smartSearch during the scan.
 *
 * Staleness precedence (ordered, first match wins):
 *   1. File missing / non-regular / zero-byte -> absent
 *   2. Parse-fail (malformed frontmatter) -> stale (stale_reason=parse_failed)
 *   3. governing_thought_hash mismatch vs triple -> stale (governing_thought_changed)
 *   4. age_days > STALE_AGE_DAYS -> stale (age_exceeded)
 *   5. brain_graph_version < current schema().graph_version -> stale (brain_graph_version_mismatch)
 *   6. else -> fresh
 *
 * Brain offline special case:
 *   - stale cases downgrade recommended_action: 'stale' stays, but
 *     recommended_action -> 'enqueue_when_brain_online' (hold, do NOT fire)
 *   - absent: recommended_action -> 'enqueue_when_brain_online'
 *   - fresh: untouched
 *   - brain_graph_version check SKIPPED when offline (can't schema())
 *
 * Mocking strategy: mirror Phase 90-02 -- require.cache override for
 * brain-client.cjs and folder-memory.cjs so scan never hits network or
 * live triple files.
 *
 * Pure node built-ins. Zero npm deps. CJS.
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
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-stale-' + tag + '-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', function () {
  for (const r of TMP_ROOTS) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------- Mock brain-client + folder-memory ----------

function installMocks(opts) {
  opts = opts || {};
  const audit = {
    isAvailable_calls: 0,
    schema_calls: 0,
    query_calls: 0,
    search_calls: 0,
    smartSearch_calls: 0,
    readTriple_calls: [],
  };
  const brainClientPath = require.resolve('../core/brain-client.cjs');
  require.cache[brainClientPath] = {
    id: brainClientPath,
    filename: brainClientPath,
    loaded: true,
    exports: {
      isAvailable: function () {
        audit.isAvailable_calls += 1;
        return opts.isAvailable === undefined ? true : opts.isAvailable;
      },
      schema: async function () {
        audit.schema_calls += 1;
        if (opts.schemaReturn !== undefined) return opts.schemaReturn;
        return { brain_graph_version: opts.currentBrainGraphVersion || 1 };
      },
      // Content queries -- MUST NOT be called during scan.
      query: async function () {
        audit.query_calls += 1;
        return { records: [] };
      },
      search: async function () {
        audit.search_calls += 1;
        return { matches: [] };
      },
      smartSearch: async function () {
        audit.smartSearch_calls += 1;
        return { matches: [] };
      },
    },
  };

  const folderMemPath = require.resolve('../core/folder-memory.cjs');
  require.cache[folderMemPath] = {
    id: folderMemPath,
    filename: folderMemPath,
    loaded: true,
    exports: {
      readTriple: function (sectionPath) {
        audit.readTriple_calls.push(sectionPath);
        const gt = opts.tripleGoverningThought == null
          ? 'default governing thought text'
          : opts.tripleGoverningThought;
        return {
          room: { exists: true },
          state: { exists: true },
          reasoning: {
            exists: true,
            governing_thought: gt,
            arguments_count: 4,
            evidence_density: 0.5,
            mece_status: 'pass',
            reasoning_health_score: 0.7,
            flagged_weaknesses: [],
            decision_log: [],
            is_stale: false,
            stale_reason: null,
          },
        };
      },
      readDecisionLog: function () { return []; },
      computeHealthScore: function () { return 0.7; },
    },
  };
  return audit;
}

function resetMockCache() {
  delete require.cache[require.resolve('../core/brain-client.cjs')];
  delete require.cache[require.resolve('../core/folder-memory.cjs')];
  delete require.cache[require.resolve('../core/brain-md-staleness.cjs')];
}

// ---------- Hash helper ----------

function sha256Hex(s) {
  return 'sha256:' + crypto.createHash('sha256').update(String(s == null ? '' : s).normalize('NFC')).digest('hex');
}

// ---------- BRAIN.md fixture writer ----------

function writeBrainMd(sectionPath, opts) {
  opts = opts || {};
  fs.mkdirSync(sectionPath, { recursive: true });
  const gt = opts.governing_thought == null ? 'default governing thought text' : opts.governing_thought;
  const gtHash = opts.governing_thought_hash != null ? opts.governing_thought_hash : sha256Hex(gt);
  const now = opts.brain_generated_at != null ? opts.brain_generated_at : new Date().toISOString();
  const bgv = opts.brain_graph_version != null ? opts.brain_graph_version : 1;
  const staleness = opts.staleness || 'fresh';
  const author = opts.author || 'brain';
  const section = opts.section || path.basename(sectionPath);

  const frontmatter = [
    '---',
    'section: ' + section,
    'brain_generated_at: "' + now + '"',
    'brain_graph_version: ' + bgv,
    'governing_thought_hash: "' + gtHash + '"',
    'staleness: ' + staleness,
    'author: ' + author,
    '---',
    '',
    '## Pattern Matches',
    '',
    '(no signal)',
    '',
  ].join('\n');

  if (opts.malformed === true) {
    // Write malformed frontmatter (no closing ---)
    fs.writeFileSync(path.join(sectionPath, 'BRAIN.md'), '---\nbroken: no closing delim\n\n## Heading\n\nBody.\n');
  } else {
    fs.writeFileSync(path.join(sectionPath, 'BRAIN.md'), frontmatter);
  }

  if (opts.mtime != null) {
    fs.utimesSync(path.join(sectionPath, 'BRAIN.md'), opts.mtime, opts.mtime);
  }
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;

async function run(name, fn) {
  try {
    resetMockCache();
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

// ---------- 13 Tests ----------

async function main() {

  // --------------------------------------------------------------------
  // Test 01: BRAIN.md absent -> exists:false, staleness:'absent'
  // --------------------------------------------------------------------
  await run('Test 01: BRAIN.md absent -> absent + enqueue_when_brain_online', async function () {
    installMocks();
    const root = makeTmpRoot('t01');
    const sectionPath = path.join(root, 'market-analysis');
    fs.mkdirSync(sectionPath, { recursive: true });
    // No BRAIN.md file

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'some thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.exists, false);
    assert.equal(r.staleness, 'absent');
    assert.equal(r.recommended_action, 'enqueue_when_brain_online');
  });

  // --------------------------------------------------------------------
  // Test 02: BRAIN.md fresh (hash matches, recent, version matches) -> fresh
  // --------------------------------------------------------------------
  await run('Test 02: BRAIN.md fresh (all checks pass) -> fresh', async function () {
    installMocks({ tripleGoverningThought: 'the thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t02');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1,
      brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.exists, true);
    assert.equal(r.staleness, 'fresh');
    assert.equal(r.stale_reason, null);
    assert.equal(r.recommended_action, 'none');
    assert.ok(r.age_days != null && r.age_days >= 0);
  });

  // --------------------------------------------------------------------
  // Test 03: hash mismatch -> stale (governing_thought_changed)
  // --------------------------------------------------------------------
  await run('Test 03: governing_thought hash mismatch -> stale (governing_thought_changed)', async function () {
    installMocks({ tripleGoverningThought: 'NEW thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t03');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, {
      governing_thought: 'OLD thought',
      brain_graph_version: 1,
      brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'NEW thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.exists, true);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.stale_reason, 'governing_thought_changed');
    assert.equal(r.recommended_action, 'enqueue_regen');
  });

  // --------------------------------------------------------------------
  // Test 04: age > 7 days, hash matches, version matches -> age_exceeded
  // --------------------------------------------------------------------
  await run('Test 04: age > 7 days -> stale (age_exceeded)', async function () {
    installMocks({ tripleGoverningThought: 'the thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t04');
    const sectionPath = path.join(root, 'market-analysis');
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1,
      brain_generated_at: tenDaysAgo,
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.stale_reason, 'age_exceeded');
    assert.equal(r.recommended_action, 'enqueue_regen');
    assert.ok(r.age_days >= 10, 'age_days >= 10, got ' + r.age_days);
  });

  // --------------------------------------------------------------------
  // Test 05: age > 7 days AND hash mismatch -> hash mismatch wins
  // --------------------------------------------------------------------
  await run('Test 05: hash mismatch precedence over age', async function () {
    installMocks({ tripleGoverningThought: 'NEW thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t05');
    const sectionPath = path.join(root, 'market-analysis');
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    writeBrainMd(sectionPath, {
      governing_thought: 'OLD thought',
      brain_graph_version: 1,
      brain_generated_at: tenDaysAgo,
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'NEW thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.stale_reason, 'governing_thought_changed',
      'hash mismatch should win over age (precedence order)');
  });

  // --------------------------------------------------------------------
  // Test 06: brain_graph_version < current schema version -> version mismatch
  // --------------------------------------------------------------------
  await run('Test 06: brain_graph_version stale -> stale (brain_graph_version_mismatch)', async function () {
    installMocks({ tripleGoverningThought: 'the thought', currentBrainGraphVersion: 5 });
    const root = makeTmpRoot('t06');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1, // below current (5)
      brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.stale_reason, 'brain_graph_version_mismatch');
    assert.equal(r.recommended_action, 'enqueue_regen');
  });

  // --------------------------------------------------------------------
  // Test 07: Brain offline + BRAIN.md absent -> absent + enqueue_when_brain_online
  // --------------------------------------------------------------------
  await run('Test 07: Brain offline + absent -> absent + enqueue_when_brain_online', async function () {
    installMocks({ isAvailable: false });
    const root = makeTmpRoot('t07');
    const sectionPath = path.join(root, 'market-analysis');
    fs.mkdirSync(sectionPath, { recursive: true });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'some thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.exists, false);
    assert.equal(r.staleness, 'absent');
    assert.equal(r.recommended_action, 'enqueue_when_brain_online');
  });

  // --------------------------------------------------------------------
  // Test 08: Brain offline + BRAIN.md stale -> stale + enqueue_when_brain_online (NOT enqueue_regen)
  // --------------------------------------------------------------------
  await run('Test 08: Brain offline + stale -> recommended_action=enqueue_when_brain_online', async function () {
    installMocks({ isAvailable: false, tripleGoverningThought: 'NEW thought' });
    const root = makeTmpRoot('t08');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, {
      governing_thought: 'OLD thought',
      brain_graph_version: 1,
      brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'NEW thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.recommended_action, 'enqueue_when_brain_online',
      'Brain offline downgrades enqueue_regen -> enqueue_when_brain_online');
  });

  // --------------------------------------------------------------------
  // Test 09: Brain offline + BRAIN.md fresh -> fresh (no action)
  // --------------------------------------------------------------------
  await run('Test 09: Brain offline + fresh -> fresh (no action)', async function () {
    installMocks({ isAvailable: false, tripleGoverningThought: 'the thought' });
    const root = makeTmpRoot('t09');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1,
      brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.staleness, 'fresh');
    assert.equal(r.recommended_action, 'none');
  });

  // --------------------------------------------------------------------
  // Test 10: BRAIN_STALE_AGE_DAYS=3 env override -> 4-day file becomes stale
  // --------------------------------------------------------------------
  await run('Test 10: BRAIN_STALE_AGE_DAYS=3 env override', async function () {
    installMocks({ tripleGoverningThought: 'the thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t10');
    const sectionPath = path.join(root, 'market-analysis');
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1,
      brain_generated_at: fourDaysAgo,
    });

    const savedEnv = process.env.BRAIN_STALE_AGE_DAYS;
    process.env.BRAIN_STALE_AGE_DAYS = '3';
    try {
      const mod = require('../core/brain-md-staleness.cjs');
      const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
      const r = await mod.computeBrainStaleness(sectionPath, triple);
      assert.equal(r.staleness, 'stale');
      assert.equal(r.stale_reason, 'age_exceeded');
    } finally {
      if (savedEnv === undefined) delete process.env.BRAIN_STALE_AGE_DAYS;
      else process.env.BRAIN_STALE_AGE_DAYS = savedEnv;
    }
  });

  // --------------------------------------------------------------------
  // Test 11: BRAIN_STALE_AGE_DAYS='abc' -> fallback to 7 (invalid)
  // --------------------------------------------------------------------
  await run('Test 11: BRAIN_STALE_AGE_DAYS invalid -> fallback to 7', async function () {
    installMocks({ tripleGoverningThought: 'the thought', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t11');
    const sectionPath = path.join(root, 'market-analysis');
    // 4-day file; with default-7 threshold, still fresh.
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    writeBrainMd(sectionPath, {
      governing_thought: 'the thought',
      brain_graph_version: 1,
      brain_generated_at: fourDaysAgo,
    });

    const savedEnv = process.env.BRAIN_STALE_AGE_DAYS;
    process.env.BRAIN_STALE_AGE_DAYS = 'abc';
    try {
      const mod = require('../core/brain-md-staleness.cjs');
      const triple = { reasoning: { exists: true, governing_thought: 'the thought' } };
      const r = await mod.computeBrainStaleness(sectionPath, triple);
      // With default 7-day threshold, 4-day file is fresh.
      assert.equal(r.staleness, 'fresh', 'invalid env -> fallback to 7 -> 4 day old is fresh');
    } finally {
      if (savedEnv === undefined) delete process.env.BRAIN_STALE_AGE_DAYS;
      else process.env.BRAIN_STALE_AGE_DAYS = savedEnv;
    }
  });

  // --------------------------------------------------------------------
  // Test 12: malformed BRAIN.md -> stale (parse_failed)
  // --------------------------------------------------------------------
  await run('Test 12: malformed BRAIN.md frontmatter -> stale (parse_failed)', async function () {
    installMocks({ tripleGoverningThought: 'some thought' });
    const root = makeTmpRoot('t12');
    const sectionPath = path.join(root, 'market-analysis');
    writeBrainMd(sectionPath, { malformed: true });

    const mod = require('../core/brain-md-staleness.cjs');
    const triple = { reasoning: { exists: true, governing_thought: 'some thought' } };
    const r = await mod.computeBrainStaleness(sectionPath, triple);
    assert.equal(r.exists, true);
    assert.equal(r.staleness, 'stale');
    assert.equal(r.stale_reason, 'parse_failed');
  });

  // --------------------------------------------------------------------
  // Test 13: CANON PART 8 audit -- run staleness on 10 sections, assert
  // brain-client.query/search/smartSearch are NEVER called.
  // --------------------------------------------------------------------
  await run('Test 13: Canon Part 8 audit -- scan issues ZERO content queries', async function () {
    const audit = installMocks({ tripleGoverningThought: 'th', currentBrainGraphVersion: 1 });
    const root = makeTmpRoot('t13');
    // Build 10 sections: some fresh, some stale, some absent.
    const sections = [];
    for (let i = 0; i < 10; i++) {
      const sectionName = 'section-' + String.fromCharCode(97 + i);
      const p = path.join(root, sectionName);
      sections.push(p);
      if (i % 3 === 0) {
        // Absent
        fs.mkdirSync(p, { recursive: true });
      } else if (i % 3 === 1) {
        // Fresh
        writeBrainMd(p, {
          governing_thought: 'th',
          brain_graph_version: 1,
          brain_generated_at: new Date().toISOString(),
        });
      } else {
        // Stale (age)
        writeBrainMd(p, {
          governing_thought: 'th',
          brain_graph_version: 1,
          brain_generated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    const mod = require('../core/brain-md-staleness.cjs');
    for (const sp of sections) {
      const triple = { reasoning: { exists: true, governing_thought: 'th' } };
      await mod.computeBrainStaleness(sp, triple);
    }

    assert.equal(audit.query_calls, 0, 'Brain query() MUST NOT be called during scan');
    assert.equal(audit.search_calls, 0, 'Brain search() MUST NOT be called during scan');
    assert.equal(audit.smartSearch_calls, 0, 'Brain smartSearch() MUST NOT be called during scan');
    // isAvailable + schema allowed.
    assert.ok(audit.isAvailable_calls >= 1, 'isAvailable should be called (allowed)');
  });

  // ---------- Summary ----------
  process.stdout.write('\nbrain-md-staleness tests: ' + passed + '/' + (passed + failed) + ' passed\n');
  if (failed > 0) process.exit(1);
}

main().catch(function (e) {
  process.stderr.write('fatal: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
