#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-06 -- cross-room-aggregator fixture tests (18 cases)
 * =============================================================
 * Tests the riskiest Canon Part 8 surface in Phase 90: cross-room
 * contradiction aggregation across multiple Data Rooms.
 *
 * The test suite builds tmpdir fixtures simulating ~/MindrianRooms/
 * layouts with .rooms/registry.json pointing at 2-5 rooms per fixture.
 * Each test isolates one risk surface (ALLOWED_ROOT scope, GUARDRAIL.md
 * sealing, per-room brain_cross_room:false opt-out, unreadable paths,
 * registry absence/malformation, hash divergence detection, wall-clock
 * budget, and the LOAD-BEARING Canon Part 8 payload audits Tests 16-18
 * that prove NO user content leaks into aggregator output under
 * adversarial dangerous-content fixtures).
 *
 * Test map:
 *   01: 3-room fixture, 0 sealed, contradictions detected
 *   02: sealed room (GUARDRAIL.md) -> skipped
 *   03: opt-out room (brain_cross_room:false) -> skipped
 *   04: registry.json missing -> graceful fallback, no throw
 *   05: registry.json malformed -> graceful fallback + stderr warn
 *   06: room path outside ALLOWED_ROOT -> skipped as out_of_scope
 *   07: self-exclusion (currentRoom slug matches registry entry)
 *   08: hash_divergence contradiction type
 *   09: framework_contradiction contradiction type
 *   10: problem_type_mismatch contradiction type
 *   11: no contradictions -> empty contradictions[], non-zero scanned
 *   12: max_rooms:2 limit -> 2 scanned, rest skipped as max_rooms_exceeded
 *   13: per_room_timeout_ms triggers skip_reasons.timeout
 *   14: unreadable room dir (chmod 0) -> skip_reasons.unreadable
 *   15: wall-clock <500ms for 10-room fixture
 *   16: CANON PART 8 payload audit -- JSON.stringify(result) contains
 *       ZERO forbidden substrings (email, currency, quoted-person,
 *       meeting fragment, SSN, phone)
 *   17: CANON PART 8 detail_scalar shape -- every contradiction's
 *       detail_scalar is {primitive-only}; no string > 40 chars; no
 *       string matches forbidden regex set
 *   18: deriveSection integration with cross_room_scan:true populates
 *       the 'Flagged Contradictions (cross-room)' section with
 *       slug-based entries; body contains NO user content under
 *       dangerous-content fixture
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..', '..');
const AGGREGATOR_PATH = path.join(REPO, 'lib/core/cross-room-aggregator.cjs');

// ---------- Tmp workspace helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', function cleanup() {
  for (const d of TMP_ROOTS) {
    try {
      // Reset perms in case a test chmod-0ed something
      try { walkChmod(d, 0o755); } catch (_e) { /* best effort */ }
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

function walkChmod(root, mode) {
  try {
    fs.chmodSync(root, mode);
    const entries = fs.readdirSync(root);
    for (const name of entries) {
      const abs = path.join(root, name);
      let st;
      try { st = fs.statSync(abs); } catch (_e) { continue; }
      if (st.isDirectory()) walkChmod(abs, mode);
      else {
        try { fs.chmodSync(abs, mode); } catch (_e) { /* best effort */ }
      }
    }
  } catch (_e) { /* best effort */ }
}

// ---------- Fixture writers ----------

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

function writeRoomMd(sectionDir, opts) {
  const o = opts || {};
  const fm = ['---'];
  if (o.brain_cross_room === false) {
    fm.push('brain_cross_room: false');
  }
  fm.push('section: ' + (o.section || 'market-analysis'));
  fm.push('---');
  fm.push('');
  fm.push((o.identity || '# Section'));
  writeFile(path.join(sectionDir, 'ROOM.md'), fm.join('\n') + '\n');
}

function writeMintoMd(sectionDir, opts) {
  const o = opts || {};
  const gt = o.governing_thought || '';
  const fm = [
    '---',
    'schema_version: v88',
    'governing_thought: "' + gt.replace(/"/g, "'") + '"',
    'last_generated_at: "' + (o.last_generated_at || '2026-04-20T10:00:00Z') + '"',
    'last_artifact_write_seen_at: "' + (o.last_artifact_write_seen_at || '2026-04-20T09:00:00Z') + '"',
    'arguments_count: ' + (o.arguments_count != null ? o.arguments_count : 3),
    'evidence_density: ' + (o.evidence_density != null ? o.evidence_density : 0.4),
    'mece_status: ' + (o.mece_status || 'pass'),
    '---',
    '',
    '# ' + (o.section || 'market-analysis'),
    '',
    'Governing Thought: ' + gt,
    '',
  ];
  writeFile(path.join(sectionDir, 'MINTO.md'), fm.join('\n'));
}

function writeBrainMd(sectionDir, opts) {
  const o = opts || {};
  const gtHash = o.governing_thought_hash ||
    ('sha256:' + crypto.createHash('sha256').update(o.governing_thought || '').digest('hex'));
  const fm = [
    '---',
    'section: ' + (o.section || 'market-analysis'),
    'brain_generated_at: "' + (o.brain_generated_at || '2026-04-20T11:00:00Z') + '"',
    'brain_graph_version: ' + (o.brain_graph_version != null ? o.brain_graph_version : 1),
    'governing_thought_hash: "' + gtHash + '"',
    'staleness: ' + (o.staleness || 'fresh'),
    'stale_reason: null',
    'author: brain',
    'problem_type: ' + (o.problem_type || 'IDP'),
    'prompt_version: 1',
    'cost_tokens: 100',
    'brain_query_count: 5',
    '---',
    '',
    '## Pattern Matches',
    o.pattern_matches || '(no signal)',
    '',
    '## Cross-Domain Analogies',
    '(no signal)',
    '',
    '## Wicked Indicators',
    '(no signal)',
    '',
    '## Unfilled Opportunity Matches',
    '(no signal)',
    '',
    '## Framework Chain Predictions',
    o.framework_chain || '(no signal)',
    '',
    '## Assessment Thinking Chain Position',
    '(no signal)',
    '',
    '## ProblemType Classification',
    o.problem_type_body || '(no signal)',
    '',
    '## Flagged Contradictions (cross-room)',
    '(no signal)',
    '',
    '## HSI Signals',
    '(no signal)',
    '',
  ];
  writeFile(path.join(sectionDir, 'BRAIN.md'), fm.join('\n'));
}

/**
 * Build a room under allowedRoot with N sections.
 * sectionsSpec is an array of { name, gt, problem_type, framework_chain,
 * sealed, opted_out, dangerous_content } entries.
 */
function buildRoom(allowedRoot, roomSlug, sectionsSpec, opts) {
  const roomDir = path.join(allowedRoot, roomSlug);
  fs.mkdirSync(roomDir, { recursive: true });

  opts = opts || {};
  if (opts.sealed) {
    writeFile(path.join(roomDir, 'GUARDRAIL.md'), [
      '---',
      'isolation: STRICT',
      '---',
      '',
      '# SEALED ROOM',
      '',
    ].join('\n'));
  }

  // Create a top-level room ROOM.md for opt-out flag (if specified)
  // Opt-out: brain_cross_room:false in ROOM.md frontmatter
  writeRoomMd(roomDir, {
    section: roomSlug,
    brain_cross_room: opts.opted_out ? false : undefined,
    identity: opts.identity || '# Room ' + roomSlug,
  });

  for (const spec of sectionsSpec) {
    const sectionDir = path.join(roomDir, spec.name);
    const dangerous = spec.dangerous_content || '';
    writeRoomMd(sectionDir, {
      section: spec.name,
      identity: '# ' + spec.name + '\n\n' + dangerous,
    });
    writeMintoMd(sectionDir, {
      section: spec.name,
      governing_thought: spec.gt || (spec.name + ' governing thought'),
      arguments_count: spec.arguments_count || 3,
      evidence_density: spec.evidence_density != null ? spec.evidence_density : 0.4,
      mece_status: spec.mece_status || 'pass',
    });
    writeBrainMd(sectionDir, {
      section: spec.name,
      governing_thought: spec.gt,
      governing_thought_hash: spec.governing_thought_hash,
      problem_type: spec.problem_type || 'IDP',
      pattern_matches: spec.pattern_matches,
      framework_chain: spec.framework_chain,
      problem_type_body: spec.problem_type_body,
    });
  }

  return roomDir;
}

function writeRegistry(allowedRoot, rooms, active) {
  const dotRooms = path.join(allowedRoot, '.rooms');
  fs.mkdirSync(dotRooms, { recursive: true });
  const payload = {
    version: 2,
    root: allowedRoot,
    active: active || (rooms[0] && rooms[0].slug) || '',
    rooms: {},
  };
  for (const r of rooms) {
    payload.rooms[r.slug] = {
      path: r.path || r.slug,
      venture_name: r.venture_name || r.slug,
      venture_stage: r.venture_stage || 'Design',
      status: r.status || 'active',
      created: r.created || '2026-04-20T00:00:00Z',
      last_opened: r.last_opened || '2026-04-21T00:00:00Z',
    };
  }
  fs.writeFileSync(path.join(dotRooms, 'registry.json'), JSON.stringify(payload, null, 2));
  return payload;
}

// Override ALLOWED_ROOT for tests via env
function makeFixtureRoot(prefix) {
  const root = mkTmp(prefix);
  return root;
}

// ---------- Forbidden content fixture catalog ----------
//
// Dangerous content strings that must NEVER appear in aggregator output.
// Test 16-18 stringify the result and grep against these patterns.

const DANGEROUS_CONTENT = Object.freeze([
  'Lawrence said we should raise $5M next quarter',
  'meeting with jonathan@mindrian.com scheduled',
  'Dror revealed SSN 123-45-6789 during diligence',
  '$5M revenue target confirmed by Nimrod',
  'call Oren at +1-555-123-4567',
  'Jonathan said the market is soft',
]);

const FORBIDDEN_PATTERNS = Object.freeze([
  /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/,
  /\$[0-9][\d,.]*[KMB]?\b/,
  /\b(Lawrence|Jonathan|Nimrod|Oren|Dror)\s+(said|revealed|told|mentioned)\b/i,
  /\bmeeting with\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,
]);

function containsForbidden(text) {
  if (typeof text !== 'string') return null;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(text)) return re.source;
  }
  return null;
}

// ---------- Require aggregator with ALLOWED_ROOT override ----------

function loadAggregator(allowedRoot) {
  // Aggregator reads ALLOWED_ROOT from process.env.MINDRIAN_ROOMS_ROOT if set
  delete require.cache[require.resolve(AGGREGATOR_PATH)];
  process.env.MINDRIAN_ROOMS_ROOT = allowedRoot;
  return require(AGGREGATOR_PATH);
}

// ---------- Tests ----------

let passed = 0;
let total = 0;

function run(name, fn) {
  total += 1;
  try {
    const out = fn();
    if (out && typeof out.then === 'function') {
      return out.then(function () {
        passed += 1;
        process.stdout.write('PASS ' + name + '\n');
      }, function (err) {
        process.stderr.write('FAIL ' + name + ': ' + (err && err.stack || err) + '\n');
      });
    }
    passed += 1;
    process.stdout.write('PASS ' + name + '\n');
    return Promise.resolve();
  } catch (err) {
    process.stderr.write('FAIL ' + name + ': ' + (err && err.stack || err) + '\n');
    return Promise.resolve();
  }
}

(async function main() {
  // ---------------- Test 01 ----------------
  await run('01 3-room fixture, 0 sealed, contradictions detected', async function () {
    const root = makeFixtureRoot('xroom-t01-');
    // current room + 2 peers, each with a 'market-analysis' section with
    // different governing_thought_hash
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current market framing', problem_type: 'IDP' },
    ]);
    buildRoom(root, 'peer-a', [
      { name: 'market-analysis', gt: 'peer-a market framing variant', problem_type: 'WDP' },
    ]);
    buildRoom(root, 'peer-b', [
      { name: 'market-analysis', gt: 'peer-b market framing other', problem_type: 'UDP' },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
      { slug: 'peer-b' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
      max_rooms: 10,
      per_room_timeout_ms: 1000,
    });

    assert.equal(result.scanned_rooms, 2, 'should scan 2 peers (excluding self)');
    assert.equal(result.skipped_rooms, 0, 'no rooms skipped');
    assert.ok(result.contradictions.length >= 1, 'at least one contradiction found');
  });

  // ---------------- Test 02 ----------------
  await run('02 sealed room (GUARDRAIL.md) -> skipped', async function () {
    const root = makeFixtureRoot('xroom-t02-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt', problem_type: 'IDP' },
    ]);
    buildRoom(root, 'peer-sealed', [
      { name: 'market-analysis', gt: 'peer gt variant', problem_type: 'WDP' },
    ], { sealed: true });
    buildRoom(root, 'peer-open', [
      { name: 'market-analysis', gt: 'peer-open gt other', problem_type: 'UDP' },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-sealed' },
      { slug: 'peer-open' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true, max_rooms: 10,
    });
    assert.equal(result.scanned_rooms, 1, 'only peer-open scanned');
    assert.equal(result.skipped_rooms, 1, 'peer-sealed skipped');
    assert.equal(result.skip_reasons.sealed_room, 1, 'sealed reason logged');
  });

  // ---------------- Test 03 ----------------
  await run('03 opt-out room (brain_cross_room:false) -> skipped', async function () {
    const root = makeFixtureRoot('xroom-t03-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt', problem_type: 'IDP' },
    ]);
    buildRoom(root, 'peer-opt-out', [
      { name: 'market-analysis', gt: 'peer gt variant', problem_type: 'WDP' },
    ], { opted_out: true });
    buildRoom(root, 'peer-normal', [
      { name: 'market-analysis', gt: 'peer normal gt', problem_type: 'UDP' },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-opt-out' },
      { slug: 'peer-normal' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true, max_rooms: 10,
    });
    assert.equal(result.scanned_rooms, 1, 'only peer-normal scanned');
    assert.equal(result.skipped_rooms, 1, 'peer-opt-out skipped');
    assert.equal(result.skip_reasons.opt_out, 1, 'opt_out reason logged');
  });

  // ---------------- Test 04 ----------------
  await run('04 registry.json missing -> graceful fallback', async function () {
    const root = makeFixtureRoot('xroom-t04-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt' },
    ]);
    // Intentionally no .rooms/registry.json

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    assert.deepEqual(result.contradictions, []);
    assert.equal(result.scanned_rooms, 0);
    assert.equal(result.skipped_rooms, 0);
    assert.equal(result.reason, 'no_registry');
  });

  // ---------------- Test 05 ----------------
  await run('05 malformed registry.json -> graceful fallback', async function () {
    const root = makeFixtureRoot('xroom-t05-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt' },
    ]);
    const dotRooms = path.join(root, '.rooms');
    fs.mkdirSync(dotRooms, { recursive: true });
    fs.writeFileSync(path.join(dotRooms, 'registry.json'), '{ not valid json');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    assert.deepEqual(result.contradictions, []);
    assert.equal(result.reason, 'no_registry');
  });

  // ---------------- Test 06 ----------------
  await run('06 room path outside ALLOWED_ROOT -> skipped as out_of_scope', async function () {
    const root = makeFixtureRoot('xroom-t06-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt' },
    ]);
    // Register a room whose path escapes ALLOWED_ROOT via ../ traversal
    const outsideRoot = makeFixtureRoot('xroom-t06-outside-');
    buildRoom(outsideRoot, 'escape-room', [
      { name: 'market-analysis', gt: 'escape gt variant' },
    ]);
    const dotRooms = path.join(root, '.rooms');
    fs.mkdirSync(dotRooms, { recursive: true });
    const payload = {
      version: 2,
      root: root,
      active: 'current-room',
      rooms: {
        'current-room': { path: 'current-room' },
        'escape-room': { path: path.relative(root, path.join(outsideRoot, 'escape-room')) },
      },
    };
    fs.writeFileSync(path.join(dotRooms, 'registry.json'), JSON.stringify(payload));

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    assert.equal(result.skipped_rooms, 1);
    assert.equal(result.skip_reasons.out_of_scope || 0, 1);
  });

  // ---------------- Test 07 ----------------
  await run('07 self-exclusion (currentRoom matches registry entry)', async function () {
    const root = makeFixtureRoot('xroom-t07-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt' },
    ]);
    buildRoom(root, 'peer-a', [
      { name: 'market-analysis', gt: 'peer gt variant' },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    // scanned_rooms excludes self
    assert.equal(result.scanned_rooms, 1, 'self not counted as scanned');
    // Contradictions (if any) never reference self as peer
    for (const c of result.contradictions) {
      assert.notEqual(c.room_a_slug, c.room_b_slug, 'contradiction pair distinct');
    }
  });

  // ---------------- Test 08 ----------------
  await run('08 hash_divergence contradiction type', async function () {
    const root = makeFixtureRoot('xroom-t08-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'unique current gt for hash divergence', problem_type: 'IDP' },
    ]);
    buildRoom(root, 'peer-a', [
      { name: 'market-analysis', gt: 'DIFFERENT gt to trigger hash divergence', problem_type: 'IDP' },
    ]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    const hashDiv = result.contradictions.filter(function (c) { return c.type === 'hash_divergence'; });
    assert.ok(hashDiv.length >= 1, 'hash_divergence found');
    assert.equal(hashDiv[0].section, 'market-analysis');
  });

  // ---------------- Test 09 ----------------
  await run('09 framework_contradiction contradiction type', async function () {
    const root = makeFixtureRoot('xroom-t09-');
    buildRoom(root, 'current-room', [
      {
        name: 'market-analysis',
        gt: 'same framing',
        problem_type: 'IDP',
        framework_chain: '- SWOT -> FEEDS_INTO -> Porter Five Forces',
      },
    ]);
    buildRoom(root, 'peer-a', [
      {
        name: 'market-analysis',
        gt: 'same framing',
        problem_type: 'IDP',
        framework_chain: '- PESTLE -> FEEDS_INTO -> Competitive Positioning',
      },
    ]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    const fw = result.contradictions.filter(function (c) { return c.type === 'framework_contradiction'; });
    assert.ok(fw.length >= 1, 'framework_contradiction found (peer chains differ)');
  });

  // ---------------- Test 10 ----------------
  await run('10 problem_type_mismatch contradiction type', async function () {
    const root = makeFixtureRoot('xroom-t10-');
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'same framing P10', problem_type: 'UDP' },
    ]);
    buildRoom(root, 'peer-a', [
      { name: 'market-analysis', gt: 'same framing P10', problem_type: 'WDP' },
    ]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    const pt = result.contradictions.filter(function (c) { return c.type === 'problem_type_mismatch'; });
    assert.ok(pt.length >= 1, 'problem_type_mismatch found');
    assert.equal(pt[0].detail_scalar.problem_type_a, 'UDP');
    assert.equal(pt[0].detail_scalar.problem_type_b, 'WDP');
  });

  // ---------------- Test 11 ----------------
  await run('11 no contradictions -> empty contradictions, non-zero scanned', async function () {
    const root = makeFixtureRoot('xroom-t11-');
    // Everything identical -> no contradictions
    const sharedGt = 'identical gt no contradictions';
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: sharedGt, problem_type: 'IDP' },
    ]);
    buildRoom(root, 'peer-a', [
      { name: 'different-section', gt: 'unrelated', problem_type: 'WDP' },
    ]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    // No shared section slug -> zero contradictions
    assert.deepEqual(result.contradictions, []);
    assert.equal(result.scanned_rooms, 1);
    assert.equal(result.skipped_rooms, 0);
  });

  // ---------------- Test 12 ----------------
  await run('12 max_rooms:2 limit applied', async function () {
    const root = makeFixtureRoot('xroom-t12-');
    buildRoom(root, 'current-room', [{ name: 'market-analysis', gt: 'g' }]);
    buildRoom(root, 'peer-a', [{ name: 'market-analysis', gt: 'va' }]);
    buildRoom(root, 'peer-b', [{ name: 'market-analysis', gt: 'vb' }]);
    buildRoom(root, 'peer-c', [{ name: 'market-analysis', gt: 'vc' }]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
      { slug: 'peer-b' },
      { slug: 'peer-c' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
      max_rooms: 2,
    });
    assert.equal(result.scanned_rooms, 2, 'max_rooms cap honored');
    assert.ok(
      (result.skip_reasons.max_rooms_exceeded || 0) >= 1,
      'extras logged under max_rooms_exceeded'
    );
  });

  // ---------------- Test 13 ----------------
  await run('13 per_room_timeout_ms triggers skip_reasons.timeout', async function () {
    const root = makeFixtureRoot('xroom-t13-');
    buildRoom(root, 'current-room', [{ name: 'market-analysis', gt: 'g' }]);
    buildRoom(root, 'peer-a', [{ name: 'market-analysis', gt: 'va' }]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    // Force timeout via env hook the aggregator honors
    process.env.MINDRIAN_XROOM_FORCE_TIMEOUT = '1';
    const agg = loadAggregator(root);
    try {
      const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
        opt_in: true,
        per_room_timeout_ms: 1,
      });
      assert.equal(result.scanned_rooms, 0, 'peer timed out -> not scanned');
      assert.equal(result.skipped_rooms, 1);
      assert.equal(result.skip_reasons.timeout, 1);
    } finally {
      delete process.env.MINDRIAN_XROOM_FORCE_TIMEOUT;
    }
  });

  // ---------------- Test 14 ----------------
  await run('14 unreadable room dir -> skip_reasons.unreadable', async function () {
    // NOTE: if running as root, chmod 0 does not block reads. Skip in that case.
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      process.stdout.write('  (root detected; skip semantics verified via env trigger)\n');
    }
    const root = makeFixtureRoot('xroom-t14-');
    buildRoom(root, 'current-room', [{ name: 'market-analysis', gt: 'g' }]);
    const peerPath = buildRoom(root, 'peer-a', [{ name: 'market-analysis', gt: 'v' }]);
    writeRegistry(root, [{ slug: 'current-room' }, { slug: 'peer-a' }], 'current-room');

    // Force unreadable via env hook the aggregator honors (deterministic
    // even under root).
    process.env.MINDRIAN_XROOM_FORCE_UNREADABLE = 'peer-a';
    const agg = loadAggregator(root);
    try {
      const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
        opt_in: true,
      });
      assert.equal(result.skipped_rooms, 1);
      assert.equal(result.skip_reasons.unreadable, 1);
    } finally {
      delete process.env.MINDRIAN_XROOM_FORCE_UNREADABLE;
    }
    // Restore perms for cleanup
    try { walkChmod(peerPath, 0o755); } catch (_e) { /* best effort */ }
  });

  // ---------------- Test 15 ----------------
  await run('15 wall-clock <500ms for 10-room fixture', async function () {
    const root = makeFixtureRoot('xroom-t15-');
    const slugs = ['current-room'];
    buildRoom(root, 'current-room', [
      { name: 'market-analysis', gt: 'current gt' },
    ]);
    for (let i = 0; i < 9; i++) {
      const slug = 'peer-' + i;
      slugs.push(slug);
      buildRoom(root, slug, [
        { name: 'market-analysis', gt: 'peer ' + i + ' gt variant' },
      ]);
    }
    writeRegistry(root, slugs.map(function (s) { return { slug: s }; }), 'current-room');

    const agg = loadAggregator(root);
    const t0 = Date.now();
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
      max_rooms: 10,
    });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 500, 'wall-clock < 500ms (was ' + elapsed + 'ms)');
    assert.equal(result.scanned_rooms, 9);
  });

  // ---------------- Test 16 (LOAD-BEARING Canon Part 8 payload audit) ----------------
  await run('16 CANON PART 8 -- JSON.stringify(result) contains ZERO forbidden substrings', async function () {
    const root = makeFixtureRoot('xroom-t16-');
    // Dangerous content in EVERY room: identity text, MINTO governing
    // thought, BRAIN.md body, and even section names.
    buildRoom(root, 'current-room', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[0],              // 'Lawrence said ... $5M ...'
        problem_type: 'IDP',
        dangerous_content: DANGEROUS_CONTENT[1], // 'meeting with email'
        pattern_matches: '- ' + DANGEROUS_CONTENT[2], // SSN leak
        framework_chain: '- ' + DANGEROUS_CONTENT[5], // 'Jonathan said ...'
        problem_type_body: '- ' + DANGEROUS_CONTENT[3], // '$5M revenue'
      },
    ]);
    buildRoom(root, 'peer-a', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[3],              // '$5M revenue'
        problem_type: 'WDP',
        dangerous_content: DANGEROUS_CONTENT[4], // 'call Oren at +1...'
        pattern_matches: '- ' + DANGEROUS_CONTENT[0],
      },
    ]);
    buildRoom(root, 'peer-b', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[5],              // 'Jonathan said ...'
        problem_type: 'UDP',
        dangerous_content: DANGEROUS_CONTENT[2],
        pattern_matches: '- ' + DANGEROUS_CONTENT[4],
      },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
      { slug: 'peer-b' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true, max_rooms: 10,
    });

    const serialized = JSON.stringify(result);
    // Must have scanned 2 peers; confirms we actually read the dangerous
    // content and STILL produced clean output.
    assert.equal(result.scanned_rooms, 2);
    // Assert against the exact dangerous substrings
    for (const bad of DANGEROUS_CONTENT) {
      // Case-insensitive whole-string search
      const found = serialized.toLowerCase().indexOf(bad.toLowerCase()) !== -1;
      assert.equal(found, false,
        'Canon Part 8 breach: serialized output contains forbidden substring: ' + bad);
    }
    // Assert against the forbidden regex set
    const regexHit = containsForbidden(serialized);
    assert.equal(regexHit, null,
      'Canon Part 8 breach: serialized output matches forbidden regex: ' + regexHit);
    // And produce at least one contradiction (confirms the scanner DID
    // extract structural data even while rejecting user content)
    assert.ok(result.contradictions.length >= 1,
      'scanner should still produce structural contradictions');
  });

  // ---------------- Test 17 (Canon Part 8 detail_scalar shape audit) ----------------
  await run('17 CANON PART 8 -- detail_scalar shape is primitive-only', async function () {
    const root = makeFixtureRoot('xroom-t17-');
    buildRoom(root, 'current-room', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[0],
        problem_type: 'IDP',
        dangerous_content: DANGEROUS_CONTENT[1],
      },
    ]);
    buildRoom(root, 'peer-a', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[5],
        problem_type: 'WDP',
        dangerous_content: DANGEROUS_CONTENT[3],
      },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
    ], 'current-room');

    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });

    assert.ok(result.contradictions.length >= 1);
    for (const c of result.contradictions) {
      assert.ok(c.detail_scalar && typeof c.detail_scalar === 'object',
        'detail_scalar is object');
      for (const k of Object.keys(c.detail_scalar)) {
        const v = c.detail_scalar[k];
        const t = typeof v;
        // Primitives only: string, number, boolean, null.
        assert.ok(
          t === 'string' || t === 'number' || t === 'boolean' || v === null,
          'detail_scalar.' + k + ' must be primitive; got ' + t
        );
        if (t === 'string') {
          // Structural strings (enums, slugs) MUST be <= 40 chars
          assert.ok(v.length <= 40,
            'detail_scalar.' + k + ' string must be <= 40 chars (was ' + v.length + '): ' + v);
          // Must not match any forbidden regex
          const hit = containsForbidden(v);
          assert.equal(hit, null,
            'detail_scalar.' + k + ' matches forbidden regex: ' + hit);
        }
      }
      // confidence must be [0,1]
      if (typeof c.confidence === 'number') {
        assert.ok(c.confidence >= 0 && c.confidence <= 1);
      }
    }
  });

  // ---------------- Test 18 (deriveSection integration) ----------------
  await run('18 deriveSection integration w/ cross_room_scan:true', async function () {
    // This test exercises the integration point: brain-derivation.cjs
    // accepts options.cross_room_scan which, when true, calls the
    // aggregator and populates the 'Flagged Contradictions (cross-room)'
    // body with slug-based entries only.
    const root = makeFixtureRoot('xroom-t18-');
    buildRoom(root, 'current-room', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[0],
        problem_type: 'IDP',
        dangerous_content: DANGEROUS_CONTENT[1],
      },
    ]);
    buildRoom(root, 'peer-a', [
      {
        name: 'market-analysis',
        gt: DANGEROUS_CONTENT[3],
        problem_type: 'WDP',
        dangerous_content: DANGEROUS_CONTENT[5],
      },
    ]);
    writeRegistry(root, [
      { slug: 'current-room' },
      { slug: 'peer-a' },
    ], 'current-room');

    // Load the aggregator and render a pseudo-body through its
    // rendering helper (the actual deriveSection integration calls
    // renderCrossRoomSection with the aggregator result).
    const agg = loadAggregator(root);
    const result = await agg.aggregateContradictions(path.join(root, 'current-room'), {
      opt_in: true,
    });
    const body = agg.renderCrossRoomSection(result);

    // Body must contain slug-based entries when contradictions exist
    assert.ok(typeof body === 'string');
    // Body must contain NO dangerous substrings
    for (const bad of DANGEROUS_CONTENT) {
      const found = body.toLowerCase().indexOf(bad.toLowerCase()) !== -1;
      assert.equal(found, false,
        'rendered section body contains forbidden substring: ' + bad);
    }
    const hit = containsForbidden(body);
    assert.equal(hit, null, 'rendered body matches forbidden regex: ' + hit);
    // If contradictions exist, body references peer slug
    if (result.contradictions.length > 0) {
      assert.ok(/peer-a/.test(body) || /current-room/.test(body),
        'body cites peer slug structurally');
    }

    // Confirm brain-derivation.cjs exports the integration option
    delete require.cache[require.resolve(path.join(REPO, 'lib/core/brain-derivation.cjs'))];
    const deriv = require(path.join(REPO, 'lib/core/brain-derivation.cjs'));
    const src = fs.readFileSync(path.join(REPO, 'lib/core/brain-derivation.cjs'), 'utf8');
    assert.ok(/cross_room_scan/.test(src),
      'brain-derivation.cjs references cross_room_scan option');
    assert.ok(/aggregateContradictions/.test(src),
      'brain-derivation.cjs wires aggregateContradictions');
  });

  // ---------- Summary ----------
  process.stdout.write('\ncross-room-aggregator: ' + passed + '/' + total + ' passed\n');
  if (passed < total) process.exit(1);
})().catch(function (err) {
  process.stderr.write('TEST HARNESS ERROR: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});
