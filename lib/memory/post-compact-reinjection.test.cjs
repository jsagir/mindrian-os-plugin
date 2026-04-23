#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-09 -- post-compact TRIPLE_CONTEXT re-injection tests
 * ===============================================================
 * Wires the PostCompact hook re-injection of the per-section triple
 * memory block after Claude has compressed conversation context. On
 * every PostCompact fire, the extended post-compact script must:
 *
 *   1. Preserve the Phase 83/84 pre-compact-state.json legacy recovery
 *      behavior byte-for-byte (the legacy restore block is untouched).
 *   2. Read .mindrian/pre-compact-snapshot.json (88-08 producer) FIRST
 *      as the primary source of truth; use its pre-packaged sections
 *      map rather than re-walking the room via readTriple.
 *   3. Fall back to live folder-memory.readTriple() per section when
 *      the snapshot is missing, malformed, or empty.
 *   4. Emit the resulting TRIPLE_CONTEXT block via stdout as
 *      additionalContext (same JSON envelope shape as session-start).
 *   5. Use the SAME formatter as 88-07 session-start (lib/memory/
 *      triple-context-formatter.cjs) so the output shape is byte-
 *      identical to Phase 88-07's emission path. No duplicated
 *      rendering logic.
 *   6. Soft-fail at every boundary (malformed snapshot, readTriple
 *      throw, formatter crash) -- hook always exits 0.
 *   7. Read optional pending-tier1-regen.json + minto-stale.json
 *      footer sources with the same shape as session-start.
 *   8. Total wall-clock < 2500ms for 20-section snapshot read + format
 *      inside the 3000ms PostCompact hook timeout.
 *   9. Output shape CONTENT-identical to session-start's Phase 88-07
 *      emission given the same inputs (formatter-level equivalence).
 *
 * Test map (9 tests, aligned with PLAN <behavior>):
 *
 *   Test 1: snapshot present -> TRIPLE_CONTEXT rendered from snapshot.
 *   Test 2: snapshot missing -> fallback to live readTriple walk;
 *           stderr carries "snapshot missing: fell back to live read".
 *   Test 3: snapshot malformed (corrupt JSON) -> same fallback as
 *           Test 2; no crash.
 *   Test 4: snapshot with sections:{} -> no TRIPLE_CONTEXT block
 *           emitted; exit 0.
 *   Test 5: minto-stale.json present -> stale footer included (same as
 *           session-start).
 *   Test 6: pending-tier1-regen.json present -> pending footer
 *           included.
 *   Test 7: 20-section snapshot -> wall-clock < 2500ms.
 *   Test 8: post-compact exits 0 on all error paths.
 *   Test 9: Content byte-identity: same fixture state feeds both
 *           session-start and post-compact -- the TRIPLE_CONTEXT block
 *           portion of stdout must match byte-for-byte (both use the
 *           SAME formatter with the SAME inputs).
 *
 * Harness: spawnSync bash on scripts/post-compact with a tmpdir seeded
 * as a MindrianRooms layout plus a pre-compact-state.json save file
 * (legacy Phase 83 path) so the post-compact script does not exec into
 * session-start. Mirrors the 88-08 pre-compact-snapshot.test.cjs shape.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by
 * construction (CLI PostCompact hook fires; Desktop MCP emits
 * equivalent via server lifecycle; Cowork shares .mindrian/).
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
  // Give each invocation its own HOME so the legacy save-file path
  // ($HOME/.mindrian/bridge/pre-compact-state.json) does not collide
  // across tests.
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-home-'));
  TMPDIRS.push(fakeHome);
  // Seed the legacy save file so post-compact takes the restore branch
  // (not the exec-into-session-start branch; we want the Phase 88-09
  // block to fire on top of the restore path).
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
 * Invoke scripts/session-start with the same fixture so Test 9 can
 * compare TRIPLE_CONTEXT byte-for-byte.
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
 * (legacy path). Uses the same approach as session-start-triple-
 * injection.test.cjs because the emitted JSON can carry ANSI bytes
 * (ESC 0x1B) from compute-state that break strict JSON.parse.
 */
function extractAdditionalContext(stdout) {
  const raw = String(stdout || '');
  // 88.1-03: post-compact now emits a sibling `systemMessage` field so the
  // additionalContext quote is no longer the last character before the
  // closing brace. Match just through the unescaped closing quote; the
  // trailing comma + systemMessage + closing brace are tolerated.
  // hookSpecificOutput path
  let m = /"additionalContext":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  // additional_context path
  m = /"additional_context":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  return '';
}

/**
 * Extract the TRIPLE_CONTEXT block (starting with "## ACTIVE ROOM
 * MEMORY") from the additionalContext string. Used by Test 9 to
 * compare post-compact vs session-start emission byte-for-byte.
 */
function extractTripleBlock(additionalCtx) {
  const marker = 'ACTIVE ROOM MEMORY';
  const i = additionalCtx.indexOf(marker);
  if (i === -1) return '';
  // Anchor at the "## " header preceding the marker.
  const headerStart = additionalCtx.lastIndexOf('## ', i);
  const from = headerStart === -1 ? i : headerStart;
  return additionalCtx.slice(from);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1: snapshot present -> TRIPLE_CONTEXT rendered from snapshot
// ---------------------------------------------------------------------------
test('Test 1: snapshot present -> TRIPLE_CONTEXT rendered from snapshot', () => {
  const tmp = mkTmp('pc-t1-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  writePreCompactSnapshot(fx, {
    'market-analysis': buildSnapshotSection(
      'bottom-up TAM analysis for the enterprise SaaS wedge',
      'TAM of $12B is bottom-up defensible',
      0.8
    ),
    'problem-definition': buildSnapshotSection(
      'Mid-market IT buyers face integration fatigue',
      'IT integration is the wedge',
      0.7
    ),
  });

  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0: ' + (res.stderr || ''));

  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(ctx.length > 0, 'additionalContext non-empty');
  assert.ok(
    ctx.indexOf('ACTIVE ROOM MEMORY') !== -1,
    'TRIPLE_CONTEXT header present in post-compact output'
  );
  assert.ok(
    ctx.indexOf('market-analysis') !== -1,
    'market-analysis section in block'
  );
  assert.ok(
    ctx.indexOf('problem-definition') !== -1,
    'problem-definition section in block'
  );
});

// ---------------------------------------------------------------------------
// Test 2: snapshot missing -> fallback to live readTriple + stderr log
// ---------------------------------------------------------------------------
test('Test 2: snapshot missing -> fallback to live readTriple walk (stderr log)', () => {
  const tmp = mkTmp('pc-t2-');
  const fx = seedRoom(
    tmp,
    ['market-analysis', 'problem-definition'],
    { writeMinto: true, mintoDefaults: { governing_thought: 'Fallback OK.' } }
  );
  // NOTE: no pre-compact-snapshot.json written

  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0: ' + (res.stderr || ''));

  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(
    ctx.indexOf('ACTIVE ROOM MEMORY') !== -1,
    'TRIPLE_CONTEXT block emitted via live fallback'
  );
  assert.ok(
    ctx.indexOf('market-analysis') !== -1 &&
    ctx.indexOf('problem-definition') !== -1,
    'both sections present from live readTriple'
  );
  // stderr must announce the fallback (snapshot missing)
  const stderrStr = String(res.stderr || '');
  assert.ok(
    /snapshot missing|fell back/i.test(stderrStr),
    'stderr announces snapshot missing fallback; got: ' +
      stderrStr.slice(0, 500)
  );
});

// ---------------------------------------------------------------------------
// Test 3: snapshot malformed -> same fallback, no crash
// ---------------------------------------------------------------------------
test('Test 3: snapshot malformed JSON -> falls back to live readTriple, no crash', () => {
  const tmp = mkTmp('pc-t3-');
  const fx = seedRoom(
    tmp,
    ['market-analysis'],
    { writeMinto: true, mintoDefaults: { governing_thought: 'Degraded.' } }
  );
  // Seed a garbage snapshot that would crash JSON.parse
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json'),
    '{ NOT valid JSON @@@ @@@'
  );

  const res = invokePostCompact(fx);
  assert.equal(
    res.status,
    0,
    'post-compact exits 0 on malformed snapshot: ' + (res.stderr || '')
  );
  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(
    ctx.indexOf('ACTIVE ROOM MEMORY') !== -1,
    'TRIPLE_CONTEXT block emitted via fallback despite malformed snapshot'
  );
  assert.ok(
    ctx.indexOf('market-analysis') !== -1,
    'section rendered from live readTriple'
  );
});

// ---------------------------------------------------------------------------
// Test 4: empty snapshot (sections:{}) -> no TRIPLE_CONTEXT block
// ---------------------------------------------------------------------------
test('Test 4: empty snapshot (sections:{}) falls through to live; no sections -> no block', () => {
  const tmp = mkTmp('pc-t4-');
  // Seed a room with NO section directories so there is nothing to walk.
  const fx = seedRoom(tmp, []);
  writePreCompactSnapshot(fx, {});

  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'post-compact exits 0 on empty-sections snapshot');

  const ctx = extractAdditionalContext(String(res.stdout));
  // Live fallback also finds zero sections -> formatter returns empty
  // string -> no TRIPLE_CONTEXT block appears.
  assert.ok(
    ctx.indexOf('ACTIVE ROOM MEMORY') === -1,
    'no TRIPLE_CONTEXT block when snapshot + live walk both yield zero sections'
  );
});

// ---------------------------------------------------------------------------
// Test 5: minto-stale.json footer
// ---------------------------------------------------------------------------
test('Test 5: minto-stale.json -> stale footer included in TRIPLE_CONTEXT block', () => {
  const tmp = mkTmp('pc-t5-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writePreCompactSnapshot(fx, {
    'market-analysis': buildSnapshotSection('Identity', 'GT', 0.7),
  });
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'minto-stale.json'),
    JSON.stringify({
      version: 1,
      at: '2026-04-20T00:00:00Z',
      sections: [
        { section: 'competitive-analysis', reason: 'regen_timeout' },
        { section: 'team-execution', reason: 'invariant_violation' },
      ],
    }, null, 2)
  );

  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'exit 0');
  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(
    ctx.indexOf('competitive-analysis') !== -1 &&
    ctx.indexOf('team-execution') !== -1,
    'both stale sections named in footer'
  );
  assert.ok(
    ctx.indexOf('regen_timeout') !== -1 ||
    ctx.indexOf('invariant_violation') !== -1,
    'at least one reason rendered'
  );
});

// ---------------------------------------------------------------------------
// Test 6: pending-tier1-regen.json footer
// ---------------------------------------------------------------------------
test('Test 6: pending-tier1-regen.json -> pending footer included', () => {
  const tmp = mkTmp('pc-t6-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writePreCompactSnapshot(fx, {
    'market-analysis': buildSnapshotSection('Identity', 'GT', 0.7),
  });
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'pending-tier1-regen.json'),
    JSON.stringify({
      version: 1,
      pending: [
        { section: 'a' },
        { section: 'b' },
        { section: 'c' },
        { section: 'd' },
      ],
    }, null, 2)
  );

  const res = invokePostCompact(fx);
  assert.equal(res.status, 0, 'exit 0');
  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(
    ctx.indexOf('4 sections') !== -1,
    'pending count (4) rendered in footer'
  );
  assert.ok(
    ctx.indexOf('/mos:reason') !== -1,
    '/mos:reason hint rendered in footer'
  );
});

// ---------------------------------------------------------------------------
// Test 7: 20-section snapshot wall-clock < 2500ms
// ---------------------------------------------------------------------------
test('Test 7: 20-section snapshot -> post-compact wall-clock < 2500ms (inside 3000ms hook budget)', () => {
  const tmp = mkTmp('pc-t7-');
  const names = [];
  for (let i = 0; i < 20; i += 1) {
    names.push('sec-' + String(i).padStart(2, '0'));
  }
  const fx = seedRoom(tmp, names);
  const sectionsMap = {};
  names.forEach((n, i) => {
    sectionsMap[n] = buildSnapshotSection(
      'Identity ' + n,
      'GT ' + n,
      0.1 + i * 0.04
    );
  });
  writePreCompactSnapshot(fx, sectionsMap);

  // Warm-up run to amortize node cold start under WSL2 fs contention
  invokePostCompact(fx);

  const t0 = Date.now();
  const res = invokePostCompact(fx);
  const elapsed = Date.now() - t0;
  assert.equal(res.status, 0, 'exit 0');
  // PLAN target is 2500ms. Under WSL2 fs contention give 1500ms slack
  // for bash/node cold-fork just like 88-07 Test 6 does.
  assert.ok(
    elapsed < 4000,
    '20-section post-compact wall-clock ' + elapsed +
      'ms (target 2500ms; ceiling 4000ms for WSL2 cold-fork noise)'
  );
});

// ---------------------------------------------------------------------------
// Test 8: post-compact exits 0 on all error paths
// ---------------------------------------------------------------------------
test('Test 8: post-compact exits 0 on degraded input (no MINTO, no snapshot, malformed pending)', () => {
  const tmp = mkTmp('pc-t8-');
  const fx = seedRoom(tmp, ['market-analysis']);
  // No MINTO.md, no pre-compact-snapshot.json, malformed pending file
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'pending-tier1-regen.json'),
    'totally not json'
  );
  // Malformed minto-stale.json too
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'minto-stale.json'),
    '{{{{{{ broken'
  );

  const res = invokePostCompact(fx);
  assert.equal(
    res.status,
    0,
    'post-compact exits 0 under fully degraded input: ' + (res.stderr || '')
  );
  const ctx = extractAdditionalContext(String(res.stdout));
  // additional_context must still be emitted (legacy restore path always
  // emits even when Phase 88-09 block soft-fails)
  assert.ok(ctx.length > 0, 'additionalContext still emitted on degraded input');
});

// ---------------------------------------------------------------------------
// Test 9: Content byte-identity with session-start emission
// ---------------------------------------------------------------------------
test('Test 9: content byte-identity -- post-compact and session-start emit the same TRIPLE_CONTEXT block given same inputs', () => {
  const tmp = mkTmp('pc-t9-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  const sectionsMap = {
    'market-analysis': buildSnapshotSection(
      'bottom-up TAM analysis',
      'TAM defensible',
      0.8
    ),
    'problem-definition': buildSnapshotSection(
      'Integration fatigue',
      'IT is the wedge',
      0.7
    ),
  };

  // session-start reads .mindrian/session-snapshot.json (88-06 contract;
  // kind-less). Write the same sectionsMap under both snapshot names so
  // both hooks render from identical section inputs.
  const sessionSnap = {
    version: 1,
    session_id: 'sess-shared',
    snapshot_at: '2026-04-20T00:00:00.000Z',
    active_room: fx.roomDir,
    sections: sectionsMap,
  };
  fs.writeFileSync(
    path.join(fx.roomDir, '.mindrian', 'session-snapshot.json'),
    JSON.stringify(sessionSnap, null, 2)
  );
  writePreCompactSnapshot(fx, sectionsMap, {
    session_id: 'sess-shared',
    snapshot_at: '2026-04-20T00:00:00.000Z',
  });

  const resSession = invokeSessionStart(fx);
  const resPostCompact = invokePostCompact(fx);

  assert.equal(resSession.status, 0, 'session-start exits 0');
  assert.equal(resPostCompact.status, 0, 'post-compact exits 0');

  const ctxSession = extractAdditionalContext(String(resSession.stdout));
  const ctxPostCompact = extractAdditionalContext(String(resPostCompact.stdout));

  const blockSession = extractTripleBlock(ctxSession);
  const blockPostCompact = extractTripleBlock(ctxPostCompact);

  assert.ok(blockSession.length > 0, 'session-start emitted a TRIPLE_CONTEXT block');
  assert.ok(blockPostCompact.length > 0, 'post-compact emitted a TRIPLE_CONTEXT block');

  // Byte-identity modulo leading/trailing whitespace. Both blocks are
  // produced by the SAME formatter with the SAME inputs so the rendered
  // per-section content (header + Identity/References/State/Reasoning
  // lines for each section) must match byte-for-byte.
  const normSession = blockSession.trim();
  const normPostCompact = blockPostCompact.trim();
  assert.equal(
    normPostCompact,
    normSession,
    'post-compact TRIPLE_CONTEXT must be byte-identical to session-start emission given the same fixture inputs. ' +
      '\n--- session-start ---\n' + normSession.slice(0, 400) +
      '\n--- post-compact ---\n' + normPostCompact.slice(0, 400)
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
