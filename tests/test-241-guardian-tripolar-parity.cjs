#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 241-05 -- guardian Tri-Polar parity (F-1 close-out, MINTO-01)
 * ====================================================================
 * Plan 241-01 fixed the CLI legacy Stop path (scripts/on-stop's own
 * /dev/null discard + 1-second hard kill). Until this plan,
 * lib/mcp/stop-gate-handler.cjs -- the shared "mindrian-core" Stop path
 * Desktop, Cowork, and CLI-under-MINDRIAN_MCP_FIRST all route through --
 * never invoked the Feynman-MINTO guardian's on-stop invariant check at
 * all (zero references, confirmed by 241-RESEARCH.md's own grep). This
 * file proves the shared path now reports too, that both Stop paths
 * agree on the same fixture, and that removing the shared-path wiring
 * turns the parity claim red (not merely that the wiring exists).
 *
 * Test map (3 tests):
 *
 *   Test 1 (shared path reports): the shared handler's closeOutRoom(),
 *     driven directly (the REAL entry point -- closeOutRoom is already
 *     exported, so this test does not need a private-helper export
 *     added purely for testability), returns a guardian systemMessage
 *     containing "guardian:", AND .mindrian/invariant-report.json
 *     exists on disk, AND that report's `sections` object names the
 *     seeded section. The report assertion matters independently: a
 *     message without a report would mean the shared path emits a claim
 *     it never substantiated.
 *   Test 2 (parity): the SAME fixture shape driven through BOTH paths --
 *     the shared handler's closeOutRoom() and `bash scripts/on-stop` on
 *     the default (unset MINDRIAN_MCP_FIRST) legacy path -- in two
 *     SEPARATE room copies so neither pollutes the other. Asserts EXACT
 *     EQUALITY of the guardian portion of the message between them. Two
 *     surfaces that both mention the guardian but disagree about the
 *     finding is the drift this test exists to catch; a substring-only
 *     check would not see it.
 *   Test 3 (mutation proof): a tmp copy of lib/mcp/stop-gate-handler.cjs
 *     with the _closeOutGuardianOnStop(roomDir) call removed from
 *     closeOutRoom, loaded fresh (never mutates the real file), must
 *     turn red: no guardian message comes back and no
 *     invariant-report.json is produced.
 *
 * Harness idiom: reused verbatim from lib/memory/guardian-onstop-
 * reaches-user.test.cjs (241-01) -- the seedRoom fixture builder (so
 * scripts/resolve-room's Strategy 0b MINDRIAN_ROOMS_HOME directory scan
 * finds the room for the CLI-path leg of Test 2) and the
 * pin-absolute-paths-before-mutating-a-tmp-copy technique (241-01's own
 * pinScriptDirToRealRepo, applied here to a .cjs module's require graph
 * instead of a bash script's SCRIPT_DIR/PLUGIN_ROOT computation -- a tmp
 * copy of stop-gate-handler.cjs otherwise silently fails every one of
 * its four relative requires plus its own PLUGIN_ROOT computation the
 * moment it runs from outside lib/mcp/, per 241-01-SUMMARY.md's own
 * documented discovery of this exact failure shape). Every test owns
 * its own tmpdir and never writes inside the repo tree.
 *
 * No private helper was exported from lib/mcp/stop-gate-handler.cjs
 * solely to make this test possible: closeOutRoom was already exported
 * before this plan (Phase 198-09), so this test drives the real,
 * already-public entry point.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ON_STOP = path.join(REPO_ROOT, 'scripts', 'on-stop');
const STOP_GATE_HANDLER = path.join(REPO_ROOT, 'lib', 'mcp', 'stop-gate-handler.cjs');

const stopGateHandler = require(STOP_GATE_HANDLER);

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

// ---------------------------------------------------------------------------
// Fixture builder -- mirrors lib/memory/guardian-onstop-reaches-user.test.cjs
// (241-01)'s own seedRoom, so scripts/resolve-room's Strategy 0b
// (MINDRIAN_ROOMS_HOME directory scan) finds the room for the CLI-path leg.
// ---------------------------------------------------------------------------
function seedRoom(tmp, sections) {
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
  return { roomDir, roomsHome, workDir };
}

/** Runs the CLI legacy Stop path (MINDRIAN_MCP_FIRST unset/empty) exactly
 * as lib/memory/guardian-onstop-reaches-user.test.cjs's own invokeOnStop
 * does. */
function invokeLegacyOnStop(fixture) {
  const env = Object.assign({}, process.env, {
    PWD: fixture.workDir,
    MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
  });
  delete env.MINDRIAN_MCP_FIRST;
  return spawnSync('bash', [ON_STOP], {
    cwd: fixture.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

function lastNonEmptyLine(stdout) {
  const lines = (stdout || '').toString().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/** Extracts the guardian portion of a systemMessage: everything from the
 * literal "guardian:" token onward. Both surfaces use the exact same
 * separator ("session ... | guardian: ..."), so this is a stable anchor
 * for the equality check in Test 2 -- comparing the WHOLE message would
 * be brittle (the two paths' non-guardian prefixes differ by design:
 * "session snapshot saved, N sections scanned, ..." for the CLI legacy
 * path vs. "session synced via mindrian-core, N sections scanned" for
 * the shared path). */
function extractGuardianPortion(msg) {
  if (typeof msg !== 'string') return null;
  const idx = msg.indexOf('guardian:');
  return idx === -1 ? null : msg.slice(idx);
}

/**
 * Pins PLUGIN_ROOT and every relative require to the REAL repo location,
 * mirroring lib/memory/guardian-onstop-reaches-user.test.cjs (241-01)'s
 * own pinScriptDirToRealRepo technique, applied to a CJS module's require
 * graph rather than a bash script's SCRIPT_DIR computation. Without this,
 * a tmp copy of stop-gate-handler.cjs computes PLUGIN_ROOT as two levels
 * above the TMP directory (not the real repo root), so every
 * PLUGIN_ROOT-based require (the guardian binary, minto-debouncer,
 * folder-memory, ...) silently fails to resolve -- and separately, its
 * four sibling-relative requires (./gate-dedup.cjs, ./gate-render.cjs,
 * ./mcp-first-flag.cjs, ../core/resolve-active-room.cjs) fail outright
 * the moment the file does not live in lib/mcp/ anymore. Harness plumbing
 * only, never part of the mutation under test.
 */
function pinRequiresToRealRepo(src) {
  let out = src;

  const pluginRootNeedle = "const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');";
  assert.ok(out.indexOf(pluginRootNeedle) !== -1, 'PLUGIN_ROOT computation not found in stop-gate-handler.cjs; harness pin target drifted');
  out = out.split(pluginRootNeedle).join('const PLUGIN_ROOT = ' + JSON.stringify(REPO_ROOT) + ';');

  const relativeRequires = [
    ["require('./gate-dedup.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'gate-dedup.cjs')],
    ["require('./gate-render.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'gate-render.cjs')],
    ["require('./mcp-first-flag.cjs')", path.join(REPO_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs')],
    ["require('../core/resolve-active-room.cjs')", path.join(REPO_ROOT, 'lib', 'core', 'resolve-active-room.cjs')],
  ];
  for (const [needle, absTarget] of relativeRequires) {
    assert.ok(out.indexOf(needle) !== -1, 'expected relative require not found: ' + needle);
    out = out.split(needle).join('require(' + JSON.stringify(absTarget) + ')');
  }
  return out;
}

/** The mutation under test: removes the shared-path guardian call
 * (_closeOutGuardianOnStop) from closeOutRoom, replacing its result with
 * a hardcoded null so the surrounding code shape stays syntactically
 * valid. This is what "removing the guardian call from the shared
 * handler" means operationally. */
function mutateRemoveGuardianCall(src) {
  const needle = 'const guardianSm = _closeOutGuardianOnStop(roomDir);';
  const replacement = 'const guardianSm = null; /* MUTATION (test-241 parity proof): guardian call removed */';
  assert.ok(src.indexOf(needle) !== -1, 'expected guardian-call mutation target not found in stop-gate-handler.cjs; source drifted');
  return src.split(needle).join(replacement);
}

/** Builds a mutated tmp copy of stop-gate-handler.cjs, pinned + mutated,
 * and require()s it fresh. Never edits the real file. */
function loadMutatedStopGateHandler(tmp) {
  const src = fs.readFileSync(STOP_GATE_HANDLER, 'utf8');
  const pinned = pinRequiresToRealRepo(src);
  const mutated = mutateRemoveGuardianCall(pinned);
  assert.notEqual(mutated, src, 'mutation must actually change the source');
  const dest = path.join(tmp, 'stop-gate-handler-mutated.cjs');
  fs.writeFileSync(dest, mutated);
  return require(dest);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1: the shared path reports (message + substantiating report)
// ---------------------------------------------------------------------------
test('shared handler closeOutRoom() returns a guardian message backed by invariant-report.json', () => {
  const tmp = mkTmp('parity-t1-');
  const fx = seedRoom(tmp, ['market-analysis']); // no MINTO.md -> existence-check violation

  const business = stopGateHandler.closeOutRoom(fx.roomDir, 'sess-parity-t1');

  assert.ok(
    typeof business.guardian_sm === 'string' && business.guardian_sm.indexOf('guardian:') !== -1,
    'closeOutRoom() must return a guardian_sm string containing "guardian:"; got: ' + JSON.stringify(business)
  );

  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  assert.ok(fs.existsSync(reportPath), '.mindrian/invariant-report.json must exist after the shared path runs');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(
    Object.prototype.hasOwnProperty.call(report.sections || {}, 'market-analysis'),
    'invariant-report.json sections must name the seeded section "market-analysis"; got: ' + JSON.stringify(Object.keys(report.sections || {}))
  );
});

// ---------------------------------------------------------------------------
// Test 2: parity between the shared path and the CLI legacy path
// ---------------------------------------------------------------------------
test('shared handler and CLI legacy on-stop agree on the guardian finding for the same fixture', () => {
  const tmpShared = mkTmp('parity-t2-shared-');
  const tmpLegacy = mkTmp('parity-t2-legacy-');
  const fxShared = seedRoom(tmpShared, ['market-analysis']);
  const fxLegacy = seedRoom(tmpLegacy, ['market-analysis']);

  const business = stopGateHandler.closeOutRoom(fxShared.roomDir, 'sess-parity-t2-shared');
  const sharedGuardianPortion = extractGuardianPortion(business.guardian_sm);
  assert.ok(sharedGuardianPortion !== null, 'shared path must produce a guardian portion to compare; got guardian_sm=' + JSON.stringify(business.guardian_sm));

  const res = invokeLegacyOnStop(fxLegacy);
  assert.equal(res.status, 0, 'CLI legacy on-stop must exit 0: stderr=' + (res.stderr || ''));
  const last = lastNonEmptyLine(res.stdout);
  assert.ok(last.length > 0, 'CLI legacy on-stop must produce a final stdout line');
  const parsed = JSON.parse(last);
  const legacyGuardianPortion = extractGuardianPortion(parsed.systemMessage);
  assert.ok(legacyGuardianPortion !== null, 'CLI legacy path must produce a guardian portion to compare; got systemMessage=' + JSON.stringify(parsed.systemMessage));

  assert.equal(
    sharedGuardianPortion,
    legacyGuardianPortion,
    'the two Stop paths must agree EXACTLY on the guardian finding for the same fixture.\n  shared: ' +
      sharedGuardianPortion + '\n  legacy: ' + legacyGuardianPortion
  );
});

// ---------------------------------------------------------------------------
// Test 3: mutation proof -- removing the shared-path call turns Test 1/2
// red, not merely "the code compiles differently"
// ---------------------------------------------------------------------------
test('mutation proof: removing the guardian call from the shared handler drops both the message and the report', () => {
  const tmp = mkTmp('parity-t3-');
  const fx = seedRoom(tmp, ['market-analysis']);

  const mutatedModule = loadMutatedStopGateHandler(tmp);
  const business = mutatedModule.closeOutRoom(fx.roomDir, 'sess-parity-t3-mutated');

  assert.ok(
    business.guardian_sm === null || typeof business.guardian_sm === 'undefined',
    'with the guardian call removed, guardian_sm must be null/undefined; got: ' + JSON.stringify(business.guardian_sm)
  );

  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  assert.ok(
    !fs.existsSync(reportPath),
    'with the guardian call removed, invariant-report.json must NOT be written'
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
  process.stdout.write('\ntest-241-guardian-tripolar-parity.cjs: ' + passed + '/' + tests.length + ' passed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
