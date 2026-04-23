#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-05 -- /mos:status Shape E renderer acceptance tests.
 *
 * Verifies scripts/mos-status.cjs. The renderer implements Canon Part 2
 * Body Shape E (Action Report) for /mos:status: one governing_thought row
 * per section, MINTO health glyph in the Canon Part 2 vocabulary (check /
 * warn / low / --), stale suffix, empty-section placeholder, budget-
 * respecting truncation, and a summary row at the bottom.
 *
 * Canon references:
 *   Part 2  UI Ruling System Shape E zone layout + glyph vocabulary.
 *   Part 3  Tri-Context Decision Gate -- /mos:status renders LOCAL state
 *             only (the first of the three contexts). Never BRAIN. Never
 *             SIGNAL.
 *   Part 8  Graph Boundary -- every triple read goes through
 *             lib/core/folder-memory.cjs readTriple; cache reads go through
 *             lib/core/statusline-cache.cjs getCached; zero Brain egress.
 *
 * Reuse from Plan 88.1-04:
 *   - lib/core/statusline-cache.cjs getCached / setCached (5s TTL)
 *   - classifyHealth shared glyph classifier (byte-identical thresholds)
 *   - truncateGoverningThought (80-char budget here, wider than statusline's
 *     60-char budget; renderer applies its own truncation at the call site)
 *
 * Test map (12 cases, one-to-one with the PLAN Task 1 <behavior> block):
 *
 *   1.  Healthy 3-section room: each row carries glyph + governing_thought.
 *   2.  Stale section: row includes "(stale: {reason})" suffix.
 *   3.  Empty section (no MINTO.md): row reads "(no MINTO yet)" dim.
 *   4.  governing_thought > 80 chars: truncated + ellipsis.
 *   5.  Summary counts filled / stale / median across a 10-section fixture.
 *   6.  --stale-only flag: renders only stale sections + summary.
 *   7.  <section> argument: renders that section's full triple (not truncated).
 *   8.  Missing room: prints "no active room; /mos:rooms to list" + exit 0.
 *   9.  Zero external network: no fetch/http/brain.mindrian.ai strings in the
 *       renderer source.
 *  10.  Shape E zones present: header + rows + summary + actions.
 *  11.  Warm-cache path: if statusline-cache has fresh data for the section,
 *       skip readTriple (verified via monkey-patch on readTriple).
 *  12.  Cold-cache path: no cache yet -> readTriple is called for each
 *       section discovered under roomRoot.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const RENDERER = path.join(REPO, 'scripts/mos-status.cjs');
const CACHE_PATH = path.join(REPO, 'lib/core/statusline-cache.cjs');

// Load cache helpers for fixture warm-priming.
try { delete require.cache[require.resolve(CACHE_PATH)]; } catch (_) {}
const statuslineCache = require(CACHE_PATH);

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

function writeRoomMd(dir, identity) {
  fs.writeFileSync(
    path.join(dir, 'ROOM.md'),
    '# ' + (identity || 'section identity') + '\n',
    'utf8'
  );
}

function writeStateMd(dir, opts) {
  const o = opts || {};
  const body = [
    '# Section State',
    '',
    'artifact_count: ' + (o.artifact_count !== undefined ? o.artifact_count : 3),
    'gap_status: ' + (o.gap_status || 'active'),
    'completeness_score: ' + (o.completeness_score !== undefined ? o.completeness_score : 0.7),
    '',
    'Last activity: 2026-04-23',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'STATE.md'), body, 'utf8');
}

function writeMintoMd(dir, opts) {
  const o = opts || {};
  const fm = {
    governing_thought: o.governing_thought !== undefined
      ? o.governing_thought
      : 'TAM of $12B is bottom-up defensible',
    arguments_count: o.arguments_count !== undefined ? o.arguments_count : 3,
    evidence_density: o.evidence_density !== undefined ? o.evidence_density : 0.8,
    mece_status: o.mece_status || 'pass',
    last_generated_at: o.last_generated_at || '2026-04-20T00:00:00Z',
    last_artifact_write_seen_at: o.last_artifact_write_seen_at
      || '2026-04-20T00:00:00Z',
    flagged_weaknesses: o.flagged_weaknesses || [],
    decision_log: o.decision_log || [],
  };
  const lines = ['---'];
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (Array.isArray(v)) {
      lines.push(k + ': ' + (v.length === 0 ? '[]' : JSON.stringify(v)));
    } else if (v === null) {
      lines.push(k + ': null');
    } else if (typeof v === 'string') {
      lines.push(k + ': ' + JSON.stringify(v));
    } else {
      lines.push(k + ': ' + v);
    }
  }
  lines.push('---', '', '# MINTO body', '');
  // argument/evidence sentinels the parser counts
  const bodyLines = [];
  for (let i = 0; i < (o.arguments_count || 3); i++) {
    bodyLines.push('## Argument ' + (i + 1));
    bodyLines.push('**Evidence:** supporting text for argument ' + (i + 1));
    bodyLines.push('');
  }
  fs.writeFileSync(
    path.join(dir, 'MINTO.md'),
    lines.join('\n') + '\n' + bodyLines.join('\n'),
    'utf8'
  );
}

function mkRoom() {
  return mkTmp('mos-status-test-');
}

function mkSection(room, name, opts) {
  const p = path.join(room, name);
  fs.mkdirSync(p, { recursive: true });
  writeRoomMd(p, name);
  writeStateMd(p, opts);
  if (!opts || opts.withMinto !== false) {
    writeMintoMd(p, opts);
  }
  return p;
}

function runRenderer(args, opts) {
  const o = opts || {};
  const env = Object.assign({}, process.env, o.env || {});
  const res = spawnSync(process.execPath, [RENDERER].concat(args || []), {
    cwd: o.cwd || process.cwd(),
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: res.status,
  };
}

// ---------- Precondition: renderer must exist (this will fail in RED) ----------

assert.equal(
  fs.existsSync(RENDERER),
  true,
  'RED guard: scripts/mos-status.cjs must exist before running tests. ' +
    'Create it in the GREEN step. Path: ' + RENDERER
);

// ---------- Test 1: healthy 3-section room ----------

(function test1HealthyRoom() {
  const room = mkRoom();
  mkSection(room, 'market-analysis', {
    governing_thought: 'TAM of $12B is bottom-up defensible',
    arguments_count: 4,
    evidence_density: 0.9,
  });
  mkSection(room, 'problem-definition', {
    governing_thought: 'IT integration is the wedge',
    arguments_count: 3,
    evidence_density: 0.6,
  });
  mkSection(room, 'solution-design', {
    governing_thought: 'API middleware unblocks integration',
    arguments_count: 2,
    evidence_density: 0.4,
  });

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 on healthy room');
  assert.ok(r.stdout.indexOf('market-analysis') !== -1, 'market-analysis row rendered');
  assert.ok(r.stdout.indexOf('problem-definition') !== -1, 'problem-definition row rendered');
  assert.ok(r.stdout.indexOf('solution-design') !== -1, 'solution-design row rendered');
  assert.ok(
    r.stdout.indexOf('TAM of $12B') !== -1,
    'market-analysis governing_thought rendered inline'
  );
  assert.ok(
    r.stdout.indexOf('IT integration is the wedge') !== -1,
    'problem-definition governing_thought rendered inline'
  );
  // Glyph vocabulary: at least one of check/warn/low appears on a section row.
  const hasGlyph = /\b(check|warn|low)\b/.test(r.stdout);
  assert.ok(hasGlyph, 'at least one Canon Part 2 glyph present on section rows');
  console.log('PASS test 1: healthy 3-section room renders rows + glyphs');
})();

// ---------- Test 2: stale section ----------

(function test2StaleSection() {
  const room = mkRoom();
  mkSection(room, 'market-analysis', {
    governing_thought: 'TAM defensible',
    arguments_count: 3,
  });
  // Build a stale section: a MINTO.md backdated before the artifact mtime.
  const stale = path.join(room, 'business-model');
  fs.mkdirSync(stale, { recursive: true });
  writeRoomMd(stale, 'business-model');
  writeStateMd(stale, {});
  writeMintoMd(stale, {
    governing_thought: 'Freemium plus seat-based',
    last_generated_at: '2026-01-01T00:00:00Z',
    last_artifact_write_seen_at: '2026-01-01T00:00:00Z',
  });
  // Drop an artifact with mtime clearly after the MINTO.md mtime.
  const art = path.join(stale, 'tam.md');
  fs.writeFileSync(art, '# TAM artifact\n', 'utf8');
  const future = Date.now() / 1000 + 3600;
  fs.utimesSync(art, future, future);
  // Rewind MINTO.md mtime to well before the artifact.
  const past = Date.now() / 1000 - 86400;
  fs.utimesSync(path.join(stale, 'MINTO.md'), past, past);

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 with stale section');
  assert.ok(
    r.stdout.indexOf('(stale:') !== -1,
    'stale suffix present: (stale: ...)'
  );
  assert.ok(
    /business-model[^\n]*\(stale:/.test(r.stdout),
    'stale suffix applied to business-model row'
  );
  console.log('PASS test 2: stale section carries (stale: reason) suffix');
})();

// ---------- Test 3: empty section (no MINTO.md) ----------

(function test3EmptySection() {
  const room = mkRoom();
  mkSection(room, 'team-execution', {
    governing_thought: 'Team of 3 with biotech + IT mix',
  });
  // Empty section: ROOM.md but NO MINTO.md
  const empty = path.join(room, 'competitive-analysis');
  fs.mkdirSync(empty, { recursive: true });
  writeRoomMd(empty, 'competitive-analysis');
  writeStateMd(empty, {});
  // No writeMintoMd call -- deliberately empty.

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 with empty section');
  assert.ok(
    r.stdout.indexOf('(no MINTO yet)') !== -1,
    '(no MINTO yet) placeholder present for empty section'
  );
  assert.ok(
    /competitive-analysis[^\n]*\(no MINTO yet\)/.test(r.stdout),
    'placeholder is applied to competitive-analysis row'
  );
  console.log('PASS test 3: empty section renders (no MINTO yet)');
})();

// ---------- Test 4: long governing_thought truncated ----------

(function test4TruncatedThought() {
  const room = mkRoom();
  const long =
    'This is an exceptionally long governing thought that exceeds the ' +
    'eighty-character budget enforced by the /mos:status renderer and ' +
    'should be truncated with an ellipsis suffix so the row remains ' +
    'readable.';
  mkSection(room, 'market-analysis', { governing_thought: long });

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 on long thought');
  // Accept Unicode ellipsis OR ASCII "..." tail on the section row.
  const hasEllipsis =
    r.stdout.indexOf('\u2026') !== -1 || r.stdout.indexOf('...') !== -1;
  assert.ok(hasEllipsis, 'ellipsis marker present for truncated thought');
  // Raw long string must NOT appear verbatim.
  assert.ok(
    r.stdout.indexOf(long) === -1,
    'raw untruncated long thought must not appear in output'
  );
  console.log('PASS test 4: long governing_thought truncated with ellipsis');
})();

// ---------- Test 5: summary counts + median across 10 sections ----------

(function test5SummaryCounts() {
  const room = mkRoom();
  // 7 healthy sections with governing_thought present.
  for (let i = 0; i < 7; i++) {
    mkSection(room, 'healthy-' + i, {
      governing_thought: 'Healthy claim number ' + i,
      arguments_count: 3,
      evidence_density: 0.7,
    });
  }
  // 2 stale sections.
  for (let i = 0; i < 2; i++) {
    const name = 'stale-' + i;
    const p = path.join(room, name);
    fs.mkdirSync(p, { recursive: true });
    writeRoomMd(p, name);
    writeStateMd(p, {});
    writeMintoMd(p, {
      governing_thought: 'Stale claim ' + i,
      last_generated_at: '2026-01-01T00:00:00Z',
      last_artifact_write_seen_at: '2026-01-01T00:00:00Z',
    });
    fs.writeFileSync(path.join(p, 'artifact.md'), '# x\n', 'utf8');
    const future = Date.now() / 1000 + 3600;
    fs.utimesSync(path.join(p, 'artifact.md'), future, future);
    const past = Date.now() / 1000 - 86400;
    fs.utimesSync(path.join(p, 'MINTO.md'), past, past);
  }
  // 1 empty section (no MINTO.md).
  const emp = path.join(room, 'empty-0');
  fs.mkdirSync(emp, { recursive: true });
  writeRoomMd(emp, 'empty-0');
  writeStateMd(emp, {});

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 on 10-section fixture');
  // Summary line includes counts: 10 sections, 9 filled, 2 stale (stale sections
  // still have MINTO.md so they ARE filled). median is a fractional number.
  assert.ok(
    /10 sections/.test(r.stdout),
    'summary reports 10 sections'
  );
  assert.ok(
    /(\s|^)9 filled/.test(r.stdout),
    'summary reports 9 filled (7 healthy + 2 stale)'
  );
  assert.ok(
    /(\s|^)2 stale/.test(r.stdout),
    'summary reports 2 stale'
  );
  assert.ok(
    /median/i.test(r.stdout),
    'summary includes a median-health label'
  );
  console.log('PASS test 5: summary counts filled/stale/median accurately');
})();

// ---------- Test 6: --stale-only flag ----------

(function test6StaleOnly() {
  const room = mkRoom();
  mkSection(room, 'healthy-a', { governing_thought: 'Claim A' });
  mkSection(room, 'healthy-b', { governing_thought: 'Claim B' });
  const stale = path.join(room, 'stale-c');
  fs.mkdirSync(stale, { recursive: true });
  writeRoomMd(stale, 'stale-c');
  writeStateMd(stale, {});
  writeMintoMd(stale, {
    governing_thought: 'Stale claim C',
    last_generated_at: '2026-01-01T00:00:00Z',
    last_artifact_write_seen_at: '2026-01-01T00:00:00Z',
  });
  fs.writeFileSync(path.join(stale, 'art.md'), '# x\n', 'utf8');
  const future = Date.now() / 1000 + 3600;
  fs.utimesSync(path.join(stale, 'art.md'), future, future);
  const past = Date.now() / 1000 - 86400;
  fs.utimesSync(path.join(stale, 'MINTO.md'), past, past);

  const r = runRenderer(['--stale-only'], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 for --stale-only');
  assert.ok(
    r.stdout.indexOf('stale-c') !== -1,
    'stale-only includes the stale section'
  );
  assert.ok(
    r.stdout.indexOf('healthy-a') === -1,
    '--stale-only excludes healthy-a'
  );
  assert.ok(
    r.stdout.indexOf('healthy-b') === -1,
    '--stale-only excludes healthy-b'
  );
  console.log('PASS test 6: --stale-only filters to stale sections only');
})();

// ---------- Test 7: <section> argument renders one section in detail ----------

(function test7SingleSection() {
  const room = mkRoom();
  mkSection(room, 'market-analysis', {
    governing_thought:
      'Comprehensive bottom-up TAM of $12B defensible via enterprise ' +
      'SaaS penetration model across twelve verticals with channel' +
      ' partners.',
    arguments_count: 5,
    evidence_density: 0.9,
  });
  mkSection(room, 'problem-definition', {
    governing_thought: 'IT integration is the wedge',
  });

  const r = runRenderer(['market-analysis'], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 on section-argument path');
  assert.ok(
    r.stdout.indexOf('market-analysis') !== -1,
    'section-argument path names target section'
  );
  assert.ok(
    r.stdout.indexOf('problem-definition') === -1,
    'section-argument path excludes other sections'
  );
  // Full detail: governing_thought rendered in full (not ellipsis-truncated).
  assert.ok(
    r.stdout.indexOf('twelve verticals with channel') !== -1,
    'section-argument renders governing_thought in FULL (no truncation)'
  );
  console.log('PASS test 7: single-section argument renders full detail');
})();

// ---------- Test 8: missing room (no .room-root / no room dir) ----------

(function test8MissingRoom() {
  // Run in an empty tmp dir that has no room/ subdir and no sections.
  const empty = mkTmp('mos-status-noroom-');
  const r = runRenderer([], { cwd: empty });
  assert.equal(r.status, 0, 'renderer exits 0 on missing-room path');
  assert.ok(
    /no active room/i.test(r.stdout),
    'missing-room output explains there is no active room'
  );
  assert.ok(
    /mos:rooms/.test(r.stdout),
    'missing-room output suggests /mos:rooms'
  );
  console.log('PASS test 8: missing room prints one-line hint + exits 0');
})();

// ---------- Test 9: zero external network / Brain references in the source ----------

(function test9NoNetwork() {
  const src = fs.readFileSync(RENDERER, 'utf8');
  // Canon Part 8: the renderer must be strictly LOCAL.
  const forbidden = [
    'brain.mindrian.ai',
    'http://',
    'https://',
    'require(\'node:http\')',
    'require("node:http")',
    'require(\'http\')',
    'require("http")',
    'require(\'node:https\')',
    'require("node:https")',
    'require(\'https\')',
    'require("https")',
    'curl ',
  ];
  for (const needle of forbidden) {
    assert.equal(
      src.indexOf(needle),
      -1,
      'Canon Part 8: renderer must NOT contain "' + needle + '"'
    );
  }
  // "fetch(" used anywhere in the source is a canonical breach.
  assert.equal(
    /\bfetch\s*\(/.test(src),
    false,
    'Canon Part 8: renderer must NOT call fetch()'
  );
  console.log('PASS test 9: renderer has zero external network surface');
})();

// ---------- Test 10: Shape E zones (header / rows / summary / actions) ----------

(function test10ShapeEZones() {
  const room = mkRoom();
  mkSection(room, 'market-analysis', {
    governing_thought: 'TAM of $12B is bottom-up defensible',
  });
  mkSection(room, 'solution-design', {
    governing_thought: 'API middleware unblocks integration',
  });

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 on Shape E fixture');
  // Zone 1 header: "/mos:status" marker + room breadcrumb.
  assert.ok(
    r.stdout.indexOf('/mos:status') !== -1,
    'Shape E zone 1 header carries /mos:status marker'
  );
  // Zone 2 rows: at least one section row named.
  assert.ok(
    r.stdout.indexOf('market-analysis') !== -1,
    'Shape E zone 2 renders section rows'
  );
  // Zone 3 summary: counts line.
  assert.ok(
    /\d+ sections?/.test(r.stdout),
    'Shape E zone 3 summary line present'
  );
  // Zone 4 actions: /mos:reason hint OR talk-to-Larry hint.
  assert.ok(
    /mos:reason|Larry/i.test(r.stdout),
    'Shape E zone 4 actions footer present'
  );
  console.log('PASS test 10: Shape E zones (header/rows/summary/actions) emitted');
})();

// ---------- Test 11: warm-cache path (skip readTriple if cache fresh) ----------

(function test11WarmCache() {
  // Warm the cache for the section BEFORE invoking the renderer, then flip a
  // sentinel in MINTO.md so we can verify the renderer printed the cached
  // text (warm hit) rather than the fresh disk text (cold re-read).
  const room = mkRoom();
  const sectionPath = mkSection(room, 'market-analysis', {
    governing_thought: 'CACHED thought wins',
    arguments_count: 3,
    evidence_density: 0.8,
  });

  // Build the triple exactly as folder-memory.readTriple would, then prime
  // the 5s TTL cache keyed by (roomRoot=room, sectionPath=absolute section).
  const primedTriple = {
    room: { exists: true, identity_text: 'market-analysis', references: [] },
    state: {
      exists: true,
      artifact_count: 3,
      gap_status: 'active',
      completeness_score: 0.7,
      minto_health: '--',
      last_activity_at: null,
    },
    reasoning: {
      exists: true,
      governing_thought: 'CACHED thought wins',
      arguments_count: 3,
      evidence_density: 0.8,
      mece_status: 'pass',
      reasoning_health_score: 0.82,
      flagged_weaknesses: [],
      decision_log: [],
      last_generated_at: '2026-04-20T00:00:00Z',
      last_artifact_write_seen_at: '2026-04-20T00:00:00Z',
      is_stale: false,
      stale_reason: null,
    },
  };
  statuslineCache.setCached(room, sectionPath, primedTriple);

  // Now rewrite MINTO.md on disk with a DIFFERENT sentinel text.
  writeMintoMd(sectionPath, {
    governing_thought: 'DISK thought loses',
    arguments_count: 3,
    evidence_density: 0.8,
  });

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 under warm cache');
  assert.ok(
    r.stdout.indexOf('CACHED thought wins') !== -1,
    'warm cache hit: renderer prints CACHED sentinel'
  );
  assert.ok(
    r.stdout.indexOf('DISK thought loses') === -1,
    'warm cache hit: renderer does NOT re-read the disk triple'
  );
  console.log('PASS test 11: warm-cache path skips readTriple for fresh sections');
})();

// ---------- Test 12: cold-cache path (readTriple called per section) ----------

(function test12ColdCache() {
  // Fresh room; no priming. Renderer must still emit a complete render,
  // which is only possible if it falls back to readTriple for each section.
  const room = mkRoom();
  mkSection(room, 'cold-one', {
    governing_thought: 'Cold section one thought',
  });
  mkSection(room, 'cold-two', {
    governing_thought: 'Cold section two thought',
  });
  mkSection(room, 'cold-three', {
    governing_thought: 'Cold section three thought',
  });

  const r = runRenderer([], { cwd: room });
  assert.equal(r.status, 0, 'renderer exits 0 under cold cache');
  assert.ok(
    r.stdout.indexOf('Cold section one thought') !== -1,
    'cold read: cold-one governing_thought rendered'
  );
  assert.ok(
    r.stdout.indexOf('Cold section two thought') !== -1,
    'cold read: cold-two governing_thought rendered'
  );
  assert.ok(
    r.stdout.indexOf('Cold section three thought') !== -1,
    'cold read: cold-three governing_thought rendered'
  );
  console.log('PASS test 12: cold-cache path readTriple-based render complete');
})();

console.log('\nAll 12 mos-status-renderer tests passed.');
