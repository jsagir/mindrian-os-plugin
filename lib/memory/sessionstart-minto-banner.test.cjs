#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-06 -- SessionStart MINTO banner acceptance tests.
 *
 * Verifies lib/memory/sessionstart-banner-formatter.cjs. The banner surfaces
 * the navigator's re-entry snapshot at session boundary: brand + version +
 * active-room name + top-3 most-recently-active sections, each with a Canon
 * Part 2 health glyph and a truncated governing_thought.
 *
 * Canon references:
 *   Part 1 Wicked Navigator -- banner greets the navigator at re-entry.
 *   Part 2 UI glyph vocabulary -- check / warn / low / -- shared byte-
 *           identically with statusline (Plan 88.1-04) and /mos:status
 *           (Plan 88.1-05).
 *   Part 3 Tri-Context Decision Gate -- banner compresses the LOCAL
 *           context BEFORE the full TRIPLE_CONTEXT block below it.
 *   Part 8 Graph Boundary -- every triple read goes through caller (no
 *           fs reads inside the formatter); zero Brain / fetch / external
 *           endpoint references in the source.
 *
 * Reuse contract (from Plan 88.1-04):
 *   - classifyHealth glyph classifier (check / warn / low / --).
 *   - truncateGoverningThought 60-char budget (banner sacrifices detail
 *     for density, matches statusline budget and is tighter than
 *     /mos:status 80-char budget).
 *
 * Test map (10 cases, one-to-one with PLAN Task 1 <behavior>):
 *
 *   1.  5-section room with known mtimes: formatter selects top-3 by mtime
 *       and emits 3 section lines in activity-descending order.
 *   2.  2-section room: emits 2 section lines (no padding to 3).
 *   3.  0-section room: brand + room line; no focus-header, no rows.
 *   4.  No active room (roomRoot null / empty triples): returns "" silently.
 *   5.  Stale section: row carries "(stale: {reason})" suffix.
 *   6.  Empty governing_thought: row reads "(no MINTO yet)".
 *   7.  governing_thought > 60 chars: truncated with Unicode ellipsis.
 *   8.  Tight budget (200 tokens): banner renders 2 sections, not 3.
 *   9.  Very tight budget (50 tokens): banner renders 0 sections; brand +
 *       room only.
 *  10.  Brand line reads version dynamically from .claude-plugin/plugin.json
 *       (never hardcoded, no drift on release).
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const FORMATTER_PATH = path.join(REPO, 'lib/memory/sessionstart-banner-formatter.cjs');

// Clear module cache so each test sees a fresh require (important when
// tests mutate process.env between invocations).
function loadFormatter() {
  try { delete require.cache[require.resolve(FORMATTER_PATH)]; } catch (_) {}
  return require(FORMATTER_PATH);
}

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Build a synthetic triples map shaped to match the readTriple output.
 * Every section carries exists:true for ROOM.md and MINTO.md so the
 * formatter treats them as filled. Caller specifies mtime so the banner's
 * top-3-by-mtime selection is deterministic.
 */
function mkTriple(opts) {
  const o = opts || {};
  return {
    room: {
      exists: true,
      identity_text: o.identity || 'section identity',
      references: [],
      last_updated_at: o.mtime || 1000,
    },
    state: {
      exists: true,
      artifact_count: 1,
      gap_status: 'active',
      completeness_score: 0.5,
      minto_health: '--',
      last_activity_at: o.mtime || 1000,
    },
    reasoning: {
      exists: o.reasoningExists !== false,
      governing_thought: o.governing_thought !== undefined
        ? o.governing_thought
        : 'governing thought text',
      arguments_count: 3,
      evidence_density: 0.8,
      mece_status: 'pass',
      decision_log: [],
      last_generated_at: o.last_generated_at || '2026-04-20T00:00:00Z',
      last_artifact_write_seen_at: o.last_artifact_write_seen_at || '2026-04-20T00:00:00Z',
      flagged_weaknesses: [],
      is_stale: o.is_stale === true,
      stale_reason: o.stale_reason || null,
      reasoning_health_score: o.health !== undefined ? o.health : 0.8,
      _mtime: o.mtime || 1000,
    },
  };
}

// ---------- Tests ----------

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('ok ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('not ok ' + name + '\n' + (err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// Test 1: 5-section room, top-3 by mtime.
test('Test 1: 5-section room selects top-3 by mtime descending', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t1-');
  const triples = {
    'alpha':   mkTriple({ mtime: 1000, governing_thought: 'alpha gt' }),
    'bravo':   mkTriple({ mtime: 5000, governing_thought: 'bravo gt' }),
    'charlie': mkTriple({ mtime: 3000, governing_thought: 'charlie gt' }),
    'delta':   mkTriple({ mtime: 4000, governing_thought: 'delta gt' }),
    'echo':    mkTriple({ mtime: 2000, governing_thought: 'echo gt' }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'test-room',
    triples: triples,
    version: '1.10.15',
    budget: 5000,
  });
  assert.ok(out.indexOf('bravo') !== -1, 'should include top-1 section bravo');
  assert.ok(out.indexOf('delta') !== -1, 'should include top-2 section delta');
  assert.ok(out.indexOf('charlie') !== -1, 'should include top-3 section charlie');
  assert.ok(out.indexOf('alpha') === -1, 'should NOT include 4th-ranked alpha');
  assert.ok(out.indexOf('echo') === -1, 'should NOT include 5th-ranked echo');
  // Descending order: bravo before delta before charlie in output.
  const pb = out.indexOf('bravo');
  const pd = out.indexOf('delta');
  const pc = out.indexOf('charlie');
  assert.ok(pb < pd, 'bravo (mtime 5000) should appear before delta (mtime 4000)');
  assert.ok(pd < pc, 'delta (mtime 4000) should appear before charlie (mtime 3000)');
});

// Test 2: 2-section room: emits 2 rows, not 3.
test('Test 2: 2-section room emits 2 rows no padding', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t2-');
  const triples = {
    'one': mkTriple({ mtime: 2000, governing_thought: 'one gt' }),
    'two': mkTriple({ mtime: 1000, governing_thought: 'two gt' }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'two-room',
    triples: triples,
    version: '1.10.15',
    budget: 5000,
  });
  // Count how many section name entries appear as row labels.
  const lines = out.split('\n').filter(function (l) { return l.indexOf('one:') !== -1 || l.indexOf('two:') !== -1; });
  assert.equal(lines.length, 2, 'should render exactly 2 section lines');
});

// Test 3: 0-section room: brand + room line without focus-header.
test('Test 3: 0-section room has brand + room but no focus header', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t3-');
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'empty-room',
    triples: {},
    version: '1.10.15',
    budget: 5000,
  });
  assert.ok(out.indexOf('MindrianOS') !== -1, 'brand line present');
  assert.ok(out.indexOf('empty-room') !== -1, 'room slug present');
  assert.equal(out.indexOf('Focus'), -1,
    'no focus-header when no sections exist');
});

// Test 4: No active room: silent empty string.
test('Test 4: no active room returns empty string', function () {
  const { formatBanner } = loadFormatter();
  const out = formatBanner({
    roomRoot: null,
    roomSlug: null,
    triples: {},
    version: '1.10.15',
    budget: 5000,
  });
  assert.equal(out, '', 'banner silent when no active room');
});

// Test 5: Stale section renders with (stale: reason) suffix.
test('Test 5: stale section row carries (stale: reason) suffix', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t5-');
  const triples = {
    'market-analysis': mkTriple({
      mtime: 3000,
      governing_thought: 'market is $12B TAM',
      is_stale: true,
      stale_reason: 'artifacts_newer_than_minto',
    }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'stale-room',
    triples: triples,
    version: '1.10.15',
    budget: 5000,
  });
  assert.ok(out.indexOf('(stale: artifacts_newer_than_minto)') !== -1,
    'stale suffix present');
});

// Test 6: Empty governing_thought row renders (no MINTO yet) placeholder.
test('Test 6: empty governing_thought renders (no MINTO yet)', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t6-');
  const triples = {
    'new-section': mkTriple({
      mtime: 3000,
      governing_thought: '',
      reasoningExists: false,
    }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'new-room',
    triples: triples,
    version: '1.10.15',
    budget: 5000,
  });
  assert.ok(out.indexOf('(no MINTO yet)') !== -1,
    'empty-MINTO placeholder present');
});

// Test 7: governing_thought > 60 chars is truncated with Unicode ellipsis.
test('Test 7: long governing_thought truncated with ellipsis', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t7-');
  const longGt = 'CAR-T biotech at $2.5B TAM requires a moat beyond IP to justify'
    + ' the Series B valuation in a dilution-sensitive market of 2026';
  const triples = {
    'market': mkTriple({ mtime: 3000, governing_thought: longGt }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'long-room',
    triples: triples,
    version: '1.10.15',
    budget: 5000,
  });
  // Unicode ellipsis U+2026
  assert.ok(out.indexOf('\u2026') !== -1, 'Unicode ellipsis present');
  assert.ok(out.indexOf(longGt) === -1, 'full long string NOT present');
});

// Test 8: tight budget (200 tokens) -> banner renders 2 sections instead of 3.
test('Test 8: tight 200-token budget drops 3rd section', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t8-');
  // Each section line has a 60-char governing_thought to consume real tokens.
  const sixty = 'x'.repeat(60);
  const triples = {
    'a': mkTriple({ mtime: 5000, governing_thought: sixty }),
    'b': mkTriple({ mtime: 4000, governing_thought: sixty }),
    'c': mkTriple({ mtime: 3000, governing_thought: sixty }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'tight-room',
    triples: triples,
    version: '1.10.15',
    budget: 200,
  });
  // Expect at most 2 section rows survive.
  let rows = 0;
  const labels = ['a:', 'b:', 'c:'];
  for (const lbl of labels) {
    if (out.indexOf(lbl) !== -1) rows += 1;
  }
  assert.ok(rows <= 2, 'tight budget drops to <= 2 rows; got ' + rows);
  assert.ok(rows >= 1, 'tight budget still surfaces at least 1 row');
});

// Test 9: very tight budget (50 tokens) -> banner renders 0 sections.
test('Test 9: very tight 50-token budget drops all section rows', function () {
  const { formatBanner } = loadFormatter();
  const roomRoot = mkTmp('banner-t9-');
  const sixty = 'y'.repeat(60);
  const triples = {
    'a': mkTriple({ mtime: 3000, governing_thought: sixty }),
    'b': mkTriple({ mtime: 2000, governing_thought: sixty }),
    'c': mkTriple({ mtime: 1000, governing_thought: sixty }),
  };
  const out = formatBanner({
    roomRoot: roomRoot,
    roomSlug: 'verytight',
    triples: triples,
    version: '1.10.15',
    budget: 50,
  });
  // Brand + room line still present, but no governing_thought text.
  assert.ok(out.indexOf('MindrianOS') !== -1, 'brand still present');
  assert.ok(out.indexOf('verytight') !== -1, 'room slug still present');
  assert.equal(out.indexOf(sixty), -1, 'no section gt bodies emitted');
});

// Test 10: version is read from .claude-plugin/plugin.json (no hardcoded).
test('Test 10: version read from plugin.json not hardcoded', function () {
  const { readPluginVersion, formatBanner } = loadFormatter();
  assert.equal(typeof readPluginVersion, 'function',
    'readPluginVersion export present');
  const pluginRoot = REPO;
  const ver = readPluginVersion(pluginRoot);
  assert.ok(typeof ver === 'string' && ver.length > 0,
    'reads a non-empty version string');
  // Spot-check the formatter source: no hardcoded semver like "1.10.15".
  const src = fs.readFileSync(FORMATTER_PATH, 'utf8');
  // The formatter itself must not embed a literal semver as a default.
  // (It may appear in comments; we scan for a bare string literal.)
  const hardcodedSemver = /["']\d+\.\d+\.\d+["']/;
  const codeSrc = src.split('\n').filter(function (l) {
    const t = l.trim();
    // Strip comment-only lines (// and * prefix).
    if (t.indexOf('//') === 0) return false;
    if (t.indexOf('*') === 0) return false;
    return true;
  }).join('\n');
  assert.ok(!hardcodedSemver.test(codeSrc),
    'formatter code lines contain no hardcoded semver literal');
  // End-to-end: banner uses whatever version the caller supplies.
  const out = formatBanner({
    roomRoot: '/tmp/banner-t10',
    roomSlug: 'v-room',
    triples: {},
    version: ver,
    budget: 5000,
  });
  assert.ok(out.indexOf(ver) !== -1,
    'banner brand line embeds the live plugin.json version');
});

// ---------- Exit ----------

process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
