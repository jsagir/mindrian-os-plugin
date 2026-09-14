#!/usr/bin/env node
'use strict';

/*
 * tests/test-344-icm-part-wiring-doctor.cjs -- Phase 344 Plan 05, Task 2.
 *
 * Pins the counts-only doctor organ (lib/core/doctor/icm-part-wiring-module.cjs)
 * against every bullet in the plan's <behavior> block:
 *
 *   - check(ctx) returns status 'ok' on every fixture, including one where
 *     every part has zero consumers.
 *   - check(ctx) returns status 'skip' with a reason when data/icm-parts.json
 *     is absent, never a throw and never a warn.
 *   - The module exports check and nothing named fix.
 *   - The payload carries declarations, producer_resolution,
 *     consumer_resolution and layers.
 *   - With ctx.flags.cascadeRooms truthy, the payload gains rooms[] with room
 *     NAMES only.
 *   - No rendered string matches any banned adjective.
 *   - No absolute filesystem path appears anywhere in the payload.
 *   - One malformed room or one unreadable CONTEXT.md does not abort the
 *     sweep.
 *   - No source line contains a frozen count.
 *
 * Hermetic: fs.mkdtempSync scratch trees under os.tmpdir(), MINDRIAN_ROOMS_HOME
 * points at the scratch home for the live-room leg. Zero network.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'icm-part-wiring-module.cjs');
const ICM_PARTS_PATH = path.join(REPO_ROOT, 'data', 'icm-parts.json');

const BANNED_ADJECTIVES = [
  'dense', 'sparse', 'density', 'risk', 'healthy', 'high',
  'complete', 'incomplete', 'coverage', 'gap', 'missing', 'drift', 'compliant',
];

let passed = 0;
function ok(label) {
  passed += 1;
  process.stdout.write('  ok - ' + label + '\n');
}
function fail(label, err) {
  process.stdout.write('  FAIL - ' + label + '\n');
  process.stdout.write('    ' + (err && err.stack ? err.stack : err) + '\n');
  process.exitCode = 1;
}
function record(label, fn) {
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

function makeScratchHome(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-344-05-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// Walk every string value in a payload object, calling visit(str) on each.
function walkStrings(value, visit) {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkStrings(v, visit);
    return;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) walkStrings(value[k], visit);
  }
}

function writeRegistry(scratchHome, roomsObj) {
  fs.mkdirSync(path.join(scratchHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(scratchHome, '.rooms', 'registry.json'),
    JSON.stringify({ active: Object.keys(roomsObj)[0] || null, rooms: roomsObj }, null, 2)
  );
}

function seedRoomSection(roomDir, sectionName, contextMdContent) {
  const sectionDir = path.join(roomDir, sectionName);
  fs.mkdirSync(sectionDir, { recursive: true });
  if (contextMdContent !== null) {
    fs.writeFileSync(path.join(sectionDir, 'CONTEXT.md'), contextMdContent);
  }
}

// ---------------------------------------------------------------------------
// Test 1: module exports check and nothing named fix.
// ---------------------------------------------------------------------------
record('module exports check() and no fix export', () => {
  delete require.cache[require.resolve(MODULE_PATH)];
  const m = require(MODULE_PATH);
  assert.equal(typeof m.check, 'function', 'check must be a function');
  assert.equal(typeof m.fix, 'undefined', 'fix must not be exported (fix_supported:false)');
});

// ---------------------------------------------------------------------------
// Test 2: repo-side leg, no cascadeRooms flag -> status ok, declarations,
// producer_resolution, consumer_resolution and layers all present.
// ---------------------------------------------------------------------------
let repoResult;
record('repo-side leg returns status ok with declarations/producer_resolution/consumer_resolution/layers', () => {
  delete require.cache[require.resolve(MODULE_PATH)];
  const m = require(MODULE_PATH);
  repoResult = m.check({});
  assert.ok(repoResult && typeof repoResult === 'object', 'check() must return an object');
  assert.equal(repoResult.status, 'ok', 'status must be ok on the shipped repo state');
  assert.ok(repoResult.declarations, 'payload must carry declarations');
  assert.ok(repoResult.producer_resolution, 'payload must carry producer_resolution');
  assert.ok(repoResult.consumer_resolution, 'payload must carry consumer_resolution');
  assert.ok(repoResult.layers, 'payload must carry layers');
  assert.equal(typeof repoResult.detail, 'string', 'detail must be a plain string');
  assert.ok(repoResult.detail.length > 0, 'detail must be non-empty');
  assert.equal(repoResult.rooms, undefined, 'rooms must be absent when cascadeRooms is not set');
});

record('declarations counts are internally consistent', () => {
  const d = repoResult.declarations;
  assert.equal(typeof d.parts_total, 'number');
  assert.equal(typeof d.parts_with_producer, 'number');
  assert.equal(typeof d.parts_with_consumer, 'number');
  assert.ok(d.parts_with_producer <= d.parts_total);
  assert.ok(d.parts_with_consumer <= d.parts_total);
});

// ---------------------------------------------------------------------------
// Test 3: skip when data/icm-parts.json is absent, never a throw, never a warn.
// ---------------------------------------------------------------------------
record('status skip, no throw, when data/icm-parts.json is absent', () => {
  const scratchRoot = makeScratchHome('missing-icm-parts');
  const savedIcmParts = process.env.ICM_PARTS_PATH_OVERRIDE;
  const savedCmdRegistry = process.env.COMMAND_REGISTRY_PATH_OVERRIDE;
  try {
    // Point the env-seam override at a path that deliberately does not
    // exist, so the module's own loadJson() reports absence without any
    // synthetic repo tree (the module's require graph, shared.cjs and its
    // own active-plugin-root.cjs dependency, still resolves from the real
    // lib/core/doctor/ directory this way).
    process.env.ICM_PARTS_PATH_OVERRIDE = path.join(scratchRoot, 'nonexistent-icm-parts.json');
    process.env.COMMAND_REGISTRY_PATH_OVERRIDE = path.join(scratchRoot, 'nonexistent-command-registry.json');
    delete require.cache[require.resolve(MODULE_PATH)];
    let threw = null;
    let result;
    try {
      const m = require(MODULE_PATH);
      result = m.check({});
    } catch (e) {
      threw = e;
    }
    assert.equal(threw, null, 'check() must never throw when icm-parts.json is absent');
    assert.equal(result.status, 'skip', 'status must be skip when icm-parts.json is absent');
    assert.notEqual(result.status, 'warn', 'status must never be warn');
    assert.equal(typeof result.detail, 'string');
    assert.ok(result.detail.length > 0, 'skip must carry a reason');
  } finally {
    if (savedIcmParts === undefined) delete process.env.ICM_PARTS_PATH_OVERRIDE;
    else process.env.ICM_PARTS_PATH_OVERRIDE = savedIcmParts;
    if (savedCmdRegistry === undefined) delete process.env.COMMAND_REGISTRY_PATH_OVERRIDE;
    else process.env.COMMAND_REGISTRY_PATH_OVERRIDE = savedCmdRegistry;
    delete require.cache[require.resolve(MODULE_PATH)];
    rmrf(scratchRoot);
  }
});

// ---------------------------------------------------------------------------
// Test 4: cascadeRooms leg -- rooms[] with room NAMES only, a corrupt registry
// entry and an unreadable CONTEXT.md do not abort the sweep.
// ---------------------------------------------------------------------------
let cascadeResult;
const scratchHome = makeScratchHome('cascade');
const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
try {
  const goodRoomDir = path.join(scratchHome, 'good-room');
  fs.mkdirSync(goodRoomDir, { recursive: true });
  seedRoomSection(
    goodRoomDir,
    'business-model',
    '# business-model\n\n## Inputs\n- Working: x\n\n## Commands that write here\n- Ground truth: /mos:lean-canvas\n'
  );
  seedRoomSection(goodRoomDir, 'market-analysis', '# market-analysis\n\nNo declaration headings here.\n');

  // A section whose CONTEXT.md is unreadable (a directory in its place, not a
  // file, so fs.readFileSync throws EISDIR rather than silently returning "").
  const unreadableSectionDir = path.join(goodRoomDir, 'solution-design');
  fs.mkdirSync(path.join(unreadableSectionDir, 'CONTEXT.md'), { recursive: true });

  writeRegistry(scratchHome, {
    'good-room': { path: 'good-room' },
    'corrupt-room': { path: 12345 }, // non-string path: deliberately malformed
  });

  process.env.MINDRIAN_ROOMS_HOME = scratchHome;

  record('cascadeRooms leg does not throw on a corrupt registry entry or an unreadable CONTEXT.md', () => {
    delete require.cache[require.resolve(MODULE_PATH)];
    const m = require(MODULE_PATH);
    cascadeResult = m.check({ flags: { cascadeRooms: true } });
    assert.equal(cascadeResult.status, 'ok', 'status must stay ok despite one bad room and one unreadable file');
  });

  record('cascadeRooms payload carries rooms[] with room NAMES only', () => {
    assert.ok(Array.isArray(cascadeResult.rooms), 'rooms must be an array');
    const names = cascadeResult.rooms.map((r) => r.room);
    assert.ok(names.includes('good-room'), 'good-room must be counted');
    for (const r of cascadeResult.rooms) {
      assert.equal(typeof r.room, 'string');
      assert.equal(typeof r.sections, 'number');
      assert.equal(typeof r.contracts_with_producer_heading, 'number');
      assert.equal(typeof r.contracts_with_inputs_heading, 'number');
    }
  });

  record('the good room counts its two readable CONTEXT.md declarations correctly', () => {
    const good = cascadeResult.rooms.find((r) => r.room === 'good-room');
    assert.ok(good, 'good-room must be present');
    // business-model has both headings; market-analysis has neither;
    // solution-design is unreadable (soft-failed, not counted as a heading hit).
    assert.equal(good.contracts_with_producer_heading, 1);
    assert.equal(good.contracts_with_inputs_heading, 1);
  });
} finally {
  if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
  else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
  rmrf(scratchHome);
}

// ---------------------------------------------------------------------------
// Test 5: an all-zero-consumers fixture still returns status ok (never warn).
// ---------------------------------------------------------------------------
record('an icm-parts.json fixture where every part has zero consumers still returns status ok', () => {
  const scratchRoot = makeScratchHome('all-zero-consumers');
  const savedIcmParts = process.env.ICM_PARTS_PATH_OVERRIDE;
  const savedCmdRegistry = process.env.COMMAND_REGISTRY_PATH_OVERRIDE;
  try {
    const fixtureIcmParts = path.join(scratchRoot, 'icm-parts.json');
    const fixtureCmdRegistry = path.join(scratchRoot, 'command-registry.json');
    fs.writeFileSync(
      fixtureIcmParts,
      JSON.stringify({
        _doc: { omissions: [] },
        parts: [
          {
            id: 'zero-consumer-part', path_pattern: '<room>/x', icm_layer: null,
            engineering_layer: 'context', producers: ['/mos:nonexistent-command'],
            consumers: [], exists_in_room: true, notes: 'fixture row',
          },
        ],
      }, null, 2)
    );
    fs.writeFileSync(fixtureCmdRegistry, JSON.stringify({ commands: [] }, null, 2));

    process.env.ICM_PARTS_PATH_OVERRIDE = fixtureIcmParts;
    process.env.COMMAND_REGISTRY_PATH_OVERRIDE = fixtureCmdRegistry;
    delete require.cache[require.resolve(MODULE_PATH)];
    const m = require(MODULE_PATH);
    const r = m.check({});
    assert.equal(r.status, 'ok', 'status must be ok even when every part has zero consumers');
    assert.notEqual(r.status, 'warn', 'status must never be warn');
    assert.equal(r.declarations.parts_with_consumer, 0);
    assert.equal(r.declarations.parts_total, 1);
  } finally {
    if (savedIcmParts === undefined) delete process.env.ICM_PARTS_PATH_OVERRIDE;
    else process.env.ICM_PARTS_PATH_OVERRIDE = savedIcmParts;
    if (savedCmdRegistry === undefined) delete process.env.COMMAND_REGISTRY_PATH_OVERRIDE;
    else process.env.COMMAND_REGISTRY_PATH_OVERRIDE = savedCmdRegistry;
    delete require.cache[require.resolve(MODULE_PATH)];
    rmrf(scratchRoot);
  }
});

// ---------------------------------------------------------------------------
// Test 6: no absolute filesystem path and no banned adjective anywhere in the
// payload strings (repo-side and cascade payloads both).
// ---------------------------------------------------------------------------
record('no absolute filesystem path appears anywhere in the repo-side payload', () => {
  walkStrings(repoResult, (s) => {
    assert.ok(!path.isAbsolute(s), 'payload string looks like an absolute path: ' + s);
    assert.ok(!/\/home\//.test(s), 'payload string leaks a /home/ path: ' + s);
  });
});

record('no absolute filesystem path appears anywhere in the cascade payload', () => {
  walkStrings(cascadeResult, (s) => {
    assert.ok(!path.isAbsolute(s), 'payload string looks like an absolute path: ' + s);
    assert.ok(!/\/home\//.test(s), 'payload string leaks a /home/ path: ' + s);
  });
});

record('no banned adjective appears anywhere in the repo-side payload strings', () => {
  walkStrings(repoResult, (s) => {
    const lower = s.toLowerCase();
    for (const word of BANNED_ADJECTIVES) {
      assert.ok(!new RegExp('\\b' + word + '\\b').test(lower), 'payload string contains banned adjective "' + word + '": ' + s);
    }
  });
});

record('no banned adjective appears anywhere in the cascade payload strings', () => {
  walkStrings(cascadeResult, (s) => {
    const lower = s.toLowerCase();
    for (const word of BANNED_ADJECTIVES) {
      assert.ok(!new RegExp('\\b' + word + '\\b').test(lower), 'payload string contains banned adjective "' + word + '": ' + s);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 7: no source line contains a frozen count (a bare 3+ digit integer
// literal outside a version string), per the plan's acceptance criterion.
// ---------------------------------------------------------------------------
record('no executable source line in the module contains a frozen 3+ digit count', () => {
  // Prose (docblock '*' lines and inline '//' comments) legitimately cites
  // phase numbers, threat IDs and version-like strings (T-344-23, "232.1",
  // etc.); the plan's own acceptance criterion excludes "a version string"
  // from this guard. The guard's real job is catching a hardcoded surface
  // or part count baked into EXECUTABLE code, so only non-comment lines are
  // checked here.
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const lines = src.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const m = trimmed.match(/[0-9]{3}/);
    if (m) {
      throw new Error('possible frozen count on line: ' + trimmed);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 8: data/icm-parts.json really is required (Canon Part 7 wiring proof).
// ---------------------------------------------------------------------------
record('data/icm-parts.json exists on disk (Task 1 precondition)', () => {
  assert.ok(fs.existsSync(ICM_PARTS_PATH), 'data/icm-parts.json must exist before this test can run meaningfully');
});

process.stdout.write('\ntest-344-icm-part-wiring-doctor.cjs: ' + passed + ' passed\n');
if (process.exitCode) {
  process.exit(process.exitCode);
}
process.exit(0);
