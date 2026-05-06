#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.5 -- Post-Compact memory pipeline consumer (D-05 contract)
 * ==================================================================
 * NOTE: ASCII `--` (two hyphens) used throughout. NO Unicode em-dashes.
 *
 * This test file replaces the deprecated Phase 88-09 stdout-shape
 * contract with 9 RED stubs aligned with the D-05 side-channel
 * contract spelled out in 95.5-CONTEXT.md. At Wave 0 these tests
 * intentionally FAIL because the consumer (scripts/restore-post-
 * compact-context.cjs) is a Wave-0 stub that emits silent envelopes
 * only; the side-channel writer in scripts/post-compact still needs
 * the D-04 YAML-frontmatter back-port (Plan 95.5-01); and the
 * consumer logic itself ships in Plan 95.5-02. Wave 2 (Plan 95.5-04)
 * flips them to GREEN.
 *
 * D-05 contract (9 scenarios -- see test() blocks below for canonical names):
 *
 *   Scenario one:   scripts/post-compact writes a side-channel file at
 *                   <roomDir>/.mindrian/last-post-compact.md (replaces the
 *                   deprecated stdout-shape assertion).
 *   Scenario two:   side-channel body contains formatTripleContext output
 *                   byte-for-byte (preserves the byte-identity invariant from
 *                   old Test 9, adapted to side-channel storage).
 *   Scenario three: side-channel file has YAML frontmatter stamp with
 *                   source_room_path + source_room_slug + written_at (D-04).
 *   Scenario four:  Consumer scripts/restore-post-compact-context.cjs reads
 *                   the file, validates room match, emits hookSpecificOutput.
 *                   additionalContext envelope (D-01 + D-02).
 *   Scenario five:  Stale file (mtime >10min) is skipped + deleted by consumer;
 *                   envelope is `{"continue":true}` silent (D-02 staleness).
 *   Scenario six:   Cross-room mismatch (stamp says room A, registry says room
 *                   B) -> HARD SKIP, file forensic-renamed to
 *                   .last-post-compact-cross-room-skip-<ISO>.md, envelope is
 *                   silent (D-04 cross-room HARD SKIP, Canon Part 8 boundary).
 *   Scenario seven: After successful consume, file is forensic-renamed to
 *                   .last-post-compact-consumed-<ISO>.md; subsequent re-runs
 *                   do NOT re-inject (D-02 post-consume forensic preserve).
 *   Scenario eight: Tier 0 (no roomDir, no .mindrian dir, or no registry):
 *                   silent `{"continue":true}` envelope (D-03 silence).
 *   Scenario nine:  Byte-identity invariant -- TRIPLE_CONTEXT block emitted by
 *                   post-compact write-side + read by consumer + injected via
 *                   additionalContext is byte-equal to the block produced by
 *                   formatTripleContext given identical inputs.
 *
 * Harness reused verbatim from the prior file: seedRoom,
 * writePreCompactSnapshot, buildSnapshotSection, seedLegacySaveFile,
 * invokePostCompact, invokeSessionStart, extractAdditionalContext,
 * extractTripleBlock. New helpers added:
 *   invokeRestoreConsumer(fx, extraEnv) -- spawnSync the Wave-0
 *     consumer stub (Plan 95.5-02 fills logic).
 *   seedRegistry(homeDir, slug, roomPath, lastOpened) -- seed
 *     ~/MindrianRooms/.rooms/registry.json with active-room state per
 *     RESEARCH section "Active-Room Cross-Check (D-04 + D-04b)".
 *   parseStampFromFile(filePath) -- pure-string YAML frontmatter
 *     sniff, returns { source_room_path, source_room_slug, written_at,
 *     schema_version } or null. Pattern from RESEARCH section "YAML
 *     Frontmatter Parse (D-04 stamp validation)".
 *   findForensicFile(roomDir, kind) -- scans <roomDir>/.mindrian/ for
 *     .last-post-compact-${kind}-*.md and returns first match. kind in
 *     {'consumed','cross-room-skip'}.
 *
 * Wave 0 posture: tests are RED stubs. assertions present + named per
 * D-05 contract; behavior under test is NOT YET shipped (consumer is a
 * silent stub, write-side has no D-04 stamp). Plan 95.5-04 in Wave 2
 * flips them to GREEN by wiring the full read/write contract.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by
 * construction (CLI SessionStart hook fires; Desktop and Cowork fire
 * SessionStart natively in CC 2.x per 95.2 D-08 precedent).
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const POST_COMPACT = path.join(REPO_ROOT, 'scripts', 'post-compact');
const SESSION_START = path.join(REPO_ROOT, 'scripts', 'session-start');
const RESTORE_CONSUMER = path.join(REPO_ROOT, 'scripts', 'restore-post-compact-context.cjs');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Seed a room fixture (Strategy 0b pattern: MINDRIAN_ROOMS_HOME scan).
 *
 *   <tmp>/rooms-home/venture/         <- room (.room-root + .mindrian/)
 *   <tmp>/rooms-home/venture/<section>/ROOM.md + MINTO.md (optional)
 *   <tmp>/work/venture/               <- WORK_DIR (basename matches)
 *
 * Returns { roomDir, roomsHome, workDir }.
 */
function seedRoom(tmp, sections, mintoOpts) {
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomBase = 'venture';
  const roomDir = path.join(roomsHome, roomBase);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  const workDir = path.join(tmp, 'work', roomBase);
  fs.mkdirSync(workDir, { recursive: true });

  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'ROOM.md'),
      '# ' + s + '\n\nIdentity text for ' + s + '.\n'
    );
  }
  if (mintoOpts && mintoOpts.writeMinto) {
    for (const s of sections) {
      writeMinto(path.join(roomDir, s), mintoOpts.mintoDefaults || {});
    }
  }
  return { roomDir, roomsHome, workDir };
}

function writeMinto(sectionDir, opts) {
  const stale = opts && opts.stale === true;
  const last = stale ? '1970-01-01T00:00:00Z' : new Date().toISOString();
  const gt = (opts && opts.governing_thought) || 'Governing thought placeholder.';
  const score = (opts && typeof opts.score === 'number') ? opts.score : 0.75;
  const body = [
    '---',
    'schema_version: 88',
    'governing_thought: "' + gt + '"',
    'last_generated_at: "' + last + '"',
    'last_artifact_write_seen_at: "' + last + '"',
    'reasoning_health_score: ' + score,
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '# Governing Thought',
    '',
    gt,
    '',
    '# Claim 1',
    '',
    'Supporting claim.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), body);
}

/**
 * Write a pre-compact-snapshot.json (88-08 schema v1) so post-compact
 * reads it first.
 */
function writePreCompactSnapshot(fx, sectionsMap, opts) {
  const o = opts || {};
  const snap = {
    version: 1,
    kind: 'pre-compact',
    session_id: o.session_id || 'sess-post-compact-fixture',
    snapshot_at: o.snapshot_at || new Date().toISOString(),
    active_room: fx.roomDir,
    sections: sectionsMap,
    truncated: !!o.truncated,
    truncated_count: o.truncated_count || 0,
  };
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json'),
    JSON.stringify(snap, null, 2)
  );
}

function buildSnapshotSection(identity, governingThought, healthScore) {
  return {
    room: {
      exists: true,
      identity_text: identity,
      references: [],
      last_updated_at: '2026-04-20T00:00:00Z',
    },
    state: {
      exists: true,
      artifact_count: 3,
      gap_status: 'active',
      completeness_score: 0.6,
      minto_health: '--',
      last_activity_at: '2026-04-20T00:00:00Z',
    },
    reasoning: {
      exists: true,
      governing_thought: governingThought,
      arguments_count: 3,
      evidence_density: 0.7,
      mece_status: 'pass',
      reasoning_health_score: healthScore,
      flagged_weaknesses: [],
      decision_log: [],
      last_generated_at: '2026-04-20T00:00:00Z',
      last_artifact_write_seen_at: '2026-04-20T00:00:00Z',
      is_stale: false,
      stale_reason: null,
    },
  };
}

/**
 * Seed a legacy pre-compact-state.json under $HOME/.mindrian/bridge/
 * so the post-compact script takes the restore-from-saved-file branch
 * instead of exec-ing into session-start. Uses FRESH-timestamped save
 * so the staleness 600s guard does not trip.
 *
 * Returns { saveDir, saveFile } so tests can clean up.
 */
function seedLegacySaveFile(homeDir, roomDir) {
  const saveDir = path.join(homeDir, '.mindrian', 'bridge');
  fs.mkdirSync(saveDir, { recursive: true });
  const saveFile = path.join(saveDir, 'pre-compact-state.json');
  const content = [
    'TIMESTAMP=' + new Date().toISOString(),
    'ROOM_DIR=' + roomDir,
    'VENTURE_STAGE=validated',
    'TOTAL_ENTRIES=12',
    '---STATE_MD_START---',
    '# State',
    'body',
    '---STATE_MD_END---',
    '---LAST_ARTIFACTS_START---',
    '---LAST_ARTIFACTS_END---',
    '---MINTO_CONFIDENCE_START---',
    '---MINTO_CONFIDENCE_END---',
    '---PIPELINE_STATE_START---',
    '---PIPELINE_STATE_END---',
    '---USER_CONTEXT_START---',
    '---USER_CONTEXT_END---',
    '',
  ].join('\n');
  fs.writeFileSync(saveFile, content);
  return { saveDir, saveFile };
}

/**
 * Invoke scripts/post-compact with a clean $HOME so the legacy save
 * file scoping does not spill across tests.
 */
function invokePostCompact(fx, extraEnv) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-home-'));
  TMPDIRS.push(fakeHome);
  seedLegacySaveFile(fakeHome, fx.roomDir);

  const env = Object.assign({}, process.env, {
    PWD: fx.workDir,
    HOME: fakeHome,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_ROOMS_ROOT: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
  }, extraEnv || {});
  return spawnSync('bash', [POST_COMPACT], {
    cwd: fx.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

/**
 * Invoke scripts/session-start with the same fixture so byte-identity
 * comparisons can be made.
 */
function invokeSessionStart(fx, extraEnv) {
  const env = Object.assign({}, process.env, {
    PWD: fx.workDir,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_ROOMS_ROOT: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
  }, extraEnv || {});
  return spawnSync('bash', [SESSION_START], {
    cwd: fx.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

/**
 * Extract the string value of the first JSON field named either
 * `additionalContext` (hookSpecificOutput path) or `additional_context`
 * (legacy path).
 */
function extractAdditionalContext(stdout) {
  const raw = String(stdout || '');
  let m = /"additionalContext":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  m = /"additional_context":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  return '';
}

/**
 * Extract the TRIPLE_CONTEXT block (starting with "## ACTIVE ROOM
 * MEMORY") from the additionalContext string.
 */
function extractTripleBlock(additionalCtx) {
  const marker = 'ACTIVE ROOM MEMORY';
  const i = additionalCtx.indexOf(marker);
  if (i === -1) return '';
  const headerStart = additionalCtx.lastIndexOf('## ', i);
  const from = headerStart === -1 ? i : headerStart;
  return additionalCtx.slice(from);
}

// ---------------------------------------------------------------------------
// Phase 95.5 D-05 helpers
// ---------------------------------------------------------------------------

/**
 * Invoke scripts/restore-post-compact-context.cjs (Wave-0 stub) with
 * the same fixture env shape as invokePostCompact. Plan 95.5-02 fills
 * in the consumer logic; at Wave 0 the stub emits a silent envelope.
 */
function invokeRestoreConsumer(fx, extraEnv) {
  const fakeHome = (extraEnv && extraEnv.HOME) ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'pc-rc-home-'));
  if (!extraEnv || !extraEnv.HOME) TMPDIRS.push(fakeHome);

  const env = Object.assign({}, process.env, {
    PWD: fx.workDir,
    HOME: fakeHome,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_ROOMS_ROOT: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
  }, extraEnv || {});
  return spawnSync('node', [RESTORE_CONSUMER], {
    cwd: fx.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });
}

/**
 * Seed ~/MindrianRooms/.rooms/registry.json with the Phase 83 active-
 * room shape so the consumer can cross-check the side-channel stamp
 * against the active room (D-04 source_room_path + source_room_slug
 * match) and the file mtime against last_opened (D-04b belt-and-
 * suspenders).
 *
 * Layout:
 *   <homeDir>/MindrianRooms/.rooms/registry.json
 *
 * Returns { registryPath }.
 */
function seedRegistry(homeDir, slug, roomPath, lastOpened) {
  const roomsRoot = path.join(homeDir, 'MindrianRooms');
  const registryDir = path.join(roomsRoot, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registryPath = path.join(registryDir, 'registry.json');
  const opened = lastOpened || new Date().toISOString();
  const registry = {
    active: slug,
    root: roomsRoot,
    rooms: {
      [slug]: {
        path: roomPath,
        last_opened: opened,
      },
    },
  };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return { registryPath };
}

/**
 * Pure-string YAML frontmatter sniff for the side-channel stamp file.
 * Returns the 4 D-04 fields (source_room_path, source_room_slug,
 * written_at, schema_version) or null if the file is missing or has
 * no frontmatter block.
 *
 * Mirrors the lib/core/folder-memory.cjs:322-367 pattern (RESEARCH
 * section "YAML Frontmatter Parse"). No yaml dependency.
 */
function parseStampFromFile(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (_) { return null; }
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = raw.slice(3, end);
  const out = {};
  for (const line of block.split('\n')) {
    const m = /^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i.exec(line.trim());
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  if (!out.source_room_path && !out.source_room_slug && !out.written_at) {
    return null;
  }
  return out;
}

/**
 * Scan <roomDir>/.mindrian/ for forensic-renamed side-channel files
 * matching the requested kind. Returns the first match path or null.
 *
 *   kind === 'consumed'         -> .last-post-compact-consumed-*.md
 *   kind === 'cross-room-skip'  -> .last-post-compact-cross-room-skip-*.md
 */
function findForensicFile(roomDir, kind) {
  const dir = path.join(roomDir, '.mindrian');
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return null; }
  const prefix = '.last-post-compact-' + kind + '-';
  for (const name of entries) {
    if (name.startsWith(prefix) && name.endsWith('.md')) {
      return path.join(dir, name);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1 (POSTCOMPACT-95.5-01): side-channel file written
// ---------------------------------------------------------------------------
test('Test 1: scripts/post-compact writes side-channel file at <roomDir>/.mindrian/last-post-compact.md', () => {
  const tmp = mkTmp('pc-95.5-t1-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writePreCompactSnapshot(fx, {
    'market-analysis': buildSnapshotSection('TAM', 'GT', 0.7),
  });
  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0');
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  assert.ok(fs.existsSync(sidePath), 'side-channel file written at expected path');
  const body = fs.readFileSync(sidePath, 'utf8');
  assert.ok(body.length > 0, 'side-channel non-empty');
});

// ---------------------------------------------------------------------------
// Test 2 (POSTCOMPACT-95.5-04): side-channel byte-identity in stored body
// ---------------------------------------------------------------------------
test('Test 2: side-channel body contains formatTripleContext output byte-for-byte', () => {
  const tmp = mkTmp('pc-95.5-t2-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  const sectionsMap = {
    'market-analysis': buildSnapshotSection('TAM', 'GT-tam', 0.8),
    'problem-definition': buildSnapshotSection('Wedge', 'GT-wedge', 0.7),
  };
  writePreCompactSnapshot(fx, sectionsMap);
  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0');
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  const body = fs.readFileSync(sidePath, 'utf8');
  const fmt = require(path.join(REPO_ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const expected = fmt.formatTripleContext({ sections: sectionsMap });
  assert.ok(
    body.indexOf(expected) !== -1,
    'side-channel body contains formatTripleContext output verbatim (byte-identity invariant)'
  );
});

// ---------------------------------------------------------------------------
// Test 3 (POSTCOMPACT-95.5-04): D-04 frontmatter stamp
// ---------------------------------------------------------------------------
test('Test 3: side-channel file has YAML frontmatter stamp (D-04 source_room_path + source_room_slug + written_at)', () => {
  const tmp = mkTmp('pc-95.5-t3-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writePreCompactSnapshot(fx, {
    'market-analysis': buildSnapshotSection('Identity', 'GT', 0.7),
  });
  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0');
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  const stamp = parseStampFromFile(sidePath);
  assert.ok(stamp, 'frontmatter stamp parsed from side-channel file');
  assert.equal(stamp.source_room_path, fx.roomDir, 'source_room_path matches fixture roomDir');
  assert.equal(stamp.source_room_slug, 'venture', 'source_room_slug is the room basename');
  assert.ok(
    /^\d{4}-\d{2}-\d{2}T/.test(stamp.written_at),
    'written_at is ISO-8601 timestamp; got: ' + stamp.written_at
  );
});

// ---------------------------------------------------------------------------
// Test 4 (POSTCOMPACT-95.5-01 + POSTCOMPACT-95.5-02): consumer reads + emits
// ---------------------------------------------------------------------------
test('Test 4: consumer reads side-channel file, validates room, emits hookSpecificOutput.additionalContext', () => {
  const tmp = mkTmp('pc-95.5-t4-');
  const fx = seedRoom(tmp, ['market-analysis']);
  const sectionsMap = {
    'market-analysis': buildSnapshotSection('TAM', 'GT', 0.7),
  };
  writePreCompactSnapshot(fx, sectionsMap);
  const writeRes = invokePostCompact(fx);
  assert.equal(writeRes.status, 0, 'post-compact exits 0');

  // Seed registry pointing at the fixture room as the active room.
  const homeForConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t4-h-'));
  TMPDIRS.push(homeForConsumer);
  seedRegistry(homeForConsumer, 'venture', fx.roomDir);

  const res = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(res.status, 0, 'consumer exits 0');
  const stdout = String(res.stdout || '').trim();
  // Parse envelope JSON; expect hookSpecificOutput.hookEventName === 'SessionStart'
  // and hookSpecificOutput.additionalContext containing 'ACTIVE ROOM MEMORY' header.
  let env;
  try { env = JSON.parse(stdout); } catch (_) { env = null; }
  assert.ok(env && env.hookSpecificOutput, 'envelope carries hookSpecificOutput');
  assert.equal(
    env.hookSpecificOutput.hookEventName,
    'SessionStart',
    'hookEventName is SessionStart'
  );
  assert.ok(
    typeof env.hookSpecificOutput.additionalContext === 'string' &&
    env.hookSpecificOutput.additionalContext.indexOf('ACTIVE ROOM MEMORY') !== -1,
    'additionalContext carries ACTIVE ROOM MEMORY header'
  );
});

// ---------------------------------------------------------------------------
// Test 5 (POSTCOMPACT-95.5-03a): staleness skip + delete
// ---------------------------------------------------------------------------
test('Test 5: stale file (mtime >10min) -> consumer skips + deletes; envelope silent', () => {
  const tmp = mkTmp('pc-95.5-t5-');
  const fx = seedRoom(tmp, ['market-analysis']);
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  // Hand-write a side-channel file with stamp.
  const stampedBody = [
    '---',
    'source_room_path: ' + fx.roomDir,
    'source_room_slug: venture',
    'written_at: "' + new Date(Date.now() - 700 * 1000).toISOString() + '"',
    'schema_version: 1',
    '---',
    '',
    '## ACTIVE ROOM MEMORY',
    '',
    'stale body',
    '',
  ].join('\n');
  fs.writeFileSync(sidePath, stampedBody);
  // Set mtime to 700 seconds ago (>600s threshold = stale).
  const staleTs = (Date.now() - 700 * 1000) / 1000;
  fs.utimesSync(sidePath, staleTs, staleTs);

  const homeForConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t5-h-'));
  TMPDIRS.push(homeForConsumer);
  seedRegistry(homeForConsumer, 'venture', fx.roomDir);

  const res = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(res.status, 0, 'consumer exits 0 on stale file');
  const out = String(res.stdout || '').trim();
  assert.ok(
    /^\{"continue":true\}$/.test(out),
    'envelope is silent {"continue":true} on stale file; got: ' + out
  );
  assert.ok(
    !fs.existsSync(sidePath),
    'side-channel file deleted by consumer after staleness skip'
  );
});

// ---------------------------------------------------------------------------
// Test 6 (POSTCOMPACT-95.5-03b): cross-room HARD SKIP + forensic rename
// ---------------------------------------------------------------------------
test('Test 6: cross-room mismatch -> HARD SKIP + forensic-rename to .last-post-compact-cross-room-skip-*.md', () => {
  const tmp = mkTmp('pc-95.5-t6-');
  const fx = seedRoom(tmp, ['market-analysis']);
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  // Stamp says room A (the fixture, slug "venture", path = fx.roomDir).
  const stampedBody = [
    '---',
    'source_room_path: ' + fx.roomDir,
    'source_room_slug: venture',
    'written_at: "' + new Date().toISOString() + '"',
    'schema_version: 1',
    '---',
    '',
    '## ACTIVE ROOM MEMORY',
    '',
    'fresh body from room A',
    '',
  ].join('\n');
  fs.writeFileSync(sidePath, stampedBody);

  // Registry says active is room B (different slug + different path).
  const homeForConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t6-h-'));
  TMPDIRS.push(homeForConsumer);
  const otherRoomPath = path.join(homeForConsumer, 'MindrianRooms', 'other-room');
  fs.mkdirSync(otherRoomPath, { recursive: true });
  seedRegistry(homeForConsumer, 'other-room', otherRoomPath);

  const res = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(res.status, 0, 'consumer exits 0 on cross-room mismatch');
  const out = String(res.stdout || '').trim();
  assert.ok(
    /^\{"continue":true\}$/.test(out),
    'envelope is silent {"continue":true} on cross-room HARD SKIP; got: ' + out
  );
  assert.ok(
    !fs.existsSync(sidePath),
    'original last-post-compact.md no longer exists (forensic-renamed)'
  );
  const forensic = findForensicFile(fx.roomDir, 'cross-room-skip');
  assert.ok(forensic, '.last-post-compact-cross-room-skip-*.md forensic file exists');
});

// ---------------------------------------------------------------------------
// Test 7 (POSTCOMPACT-95.5-03c): post-consume forensic preserve + no re-inject
// ---------------------------------------------------------------------------
test('Test 7: successful consume -> file forensic-renamed; subsequent run does NOT re-inject', () => {
  const tmp = mkTmp('pc-95.5-t7-');
  const fx = seedRoom(tmp, ['market-analysis']);
  const sectionsMap = {
    'market-analysis': buildSnapshotSection('TAM', 'GT', 0.7),
  };
  writePreCompactSnapshot(fx, sectionsMap);
  const writeRes = invokePostCompact(fx);
  assert.equal(writeRes.status, 0, 'post-compact exits 0');
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');

  const homeForConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t7-h-'));
  TMPDIRS.push(homeForConsumer);
  seedRegistry(homeForConsumer, 'venture', fx.roomDir);

  // First run: consume + forensic-rename.
  const firstRes = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(firstRes.status, 0, 'first consumer run exits 0');
  assert.ok(
    !fs.existsSync(sidePath),
    'original last-post-compact.md no longer exists after consume'
  );
  const consumed = findForensicFile(fx.roomDir, 'consumed');
  assert.ok(consumed, '.last-post-compact-consumed-*.md forensic file exists');

  // Second run: should be silent (no side-channel file to re-inject).
  const secondRes = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(secondRes.status, 0, 'second consumer run exits 0');
  const out = String(secondRes.stdout || '').trim();
  assert.ok(
    /^\{"continue":true\}$/.test(out),
    'second run is silent {"continue":true} (no re-injection); got: ' + out
  );
  // Forensic file should still be present (not double-renamed).
  const consumedStill = findForensicFile(fx.roomDir, 'consumed');
  assert.ok(consumedStill, 'consumed forensic file still present after second run');
});

// ---------------------------------------------------------------------------
// Test 8 (POSTCOMPACT-95.5-03d): Tier 0 silence
// ---------------------------------------------------------------------------
test('Test 8: Tier 0 (no roomDir, no .mindrian dir, no registry) -> silent {"continue":true}', () => {
  const tmp = mkTmp('pc-95.5-t8-');
  const workDir = path.join(tmp, 'no-room');
  fs.mkdirSync(workDir, { recursive: true });
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t8-h-'));
  TMPDIRS.push(fakeHome);
  const env = Object.assign({}, process.env, {
    PWD: workDir,
    HOME: fakeHome,
    MINDRIAN_ROOMS_HOME: path.join(fakeHome, 'NoRoomsHere'),
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
  });
  const res = spawnSync('node', [RESTORE_CONSUMER], {
    cwd: workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });
  assert.equal(res.status, 0, 'consumer exits 0 in Tier 0');
  const out = String(res.stdout || '').trim();
  assert.ok(
    /^\{"continue":true\}$/.test(out),
    'silent {"continue":true} envelope on Tier 0; got: ' + out
  );
});

// ---------------------------------------------------------------------------
// Test 9 (POSTCOMPACT-95.5-05): byte-identity end-to-end
// ---------------------------------------------------------------------------
test('Test 9: byte-identity invariant -- additionalContext block === formatTripleContext({sections}) given identical inputs', () => {
  const tmp = mkTmp('pc-95.5-t9-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  const sectionsMap = {
    'market-analysis': buildSnapshotSection('TAM', 'GT-tam', 0.8),
    'problem-definition': buildSnapshotSection('Wedge', 'GT-wedge', 0.7),
  };

  // Hand-write the side-channel file using the SAME formatter call that
  // the write-side will use once D-04 back-port lands. This isolates the
  // byte-identity invariant from the write-side D-04 stamp so the test
  // exercises the consumer path specifically.
  const fmt = require(path.join(REPO_ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const tripleBlock = fmt.formatTripleContext({ sections: sectionsMap });
  const sidePath = path.join(fx.roomDir, '.mindrian', 'last-post-compact.md');
  const stampedBody = [
    '---',
    'source_room_path: ' + fx.roomDir,
    'source_room_slug: venture',
    'written_at: "' + new Date().toISOString() + '"',
    'schema_version: 1',
    '---',
    '',
    tripleBlock,
  ].join('\n');
  fs.writeFileSync(sidePath, stampedBody);

  const homeForConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-95.5-t9-h-'));
  TMPDIRS.push(homeForConsumer);
  seedRegistry(homeForConsumer, 'venture', fx.roomDir);

  const res = invokeRestoreConsumer(fx, {
    HOME: homeForConsumer,
    MINDRIAN_ROOMS_HOME: path.join(homeForConsumer, 'MindrianRooms'),
  });
  assert.equal(res.status, 0, 'consumer exits 0');
  const ctx = extractAdditionalContext(String(res.stdout));
  const extractedBlock = extractTripleBlock(ctx);
  const expectedBlock = extractTripleBlock(tripleBlock);
  assert.ok(extractedBlock.length > 0, 'consumer emitted a TRIPLE_CONTEXT block');
  assert.equal(
    extractedBlock.trim(),
    expectedBlock.trim(),
    'byte-identity invariant: consumer-emitted block matches formatter output'
  );
});

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------
(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const r = t.fn();
      if (r && typeof r.then === 'function') await r;
      process.stdout.write('PASS ' + t.name + '\n');
      passed += 1;
    } catch (e) {
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack ? e.stack : e) + '\n');
      failed += 1;
    }
  }
  process.stdout.write(
    '\npost-compact-reinjection.test.cjs: ' + passed + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
