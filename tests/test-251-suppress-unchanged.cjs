#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 01, Task 1 (CACHE-02a) -- suppress-when-unchanged.
 * ==========================================================================
 * Proves the hash-sidecar suppression gate inside
 * scripts/intent-classifier.cjs's renderEngineDecisionWithDial:
 *
 *   1. Two consecutive byte-identical NAVIGATION DECISION blocks emit the
 *      full block once, then the exported NAV_UNCHANGED_MARKER.
 *   2. A changed decision (a VARYING field, e.g. Why: rationale) always
 *      re-emits in full, never the marker.
 *   3. A suppressed turn records ZERO new reached-gates in the card-fire
 *      sidechannel (SEED-021 / Stop-gate consistency, T-251-02).
 *   4. readNavBlockHash fails OPEN (missing / corrupt sidecar -> null,
 *      never throws); a null prevBlockHash always yields full emission.
 *   5. The kill switch MINDRIAN_NAV_NO_SUPPRESS is present at the call site
 *      (source assertion).
 *   6. writeNavBlockHash / readNavBlockHash roundtrip a sha256 hex string
 *      through the exported navBlockHashPath; the sidecar carries ONLY
 *      version/sha256/at/bytes keys (Canon Part 8, T-251-03).
 *   7. scripts/post-compact deletes the nav-block-hash sidecars so the
 *      first post-compact turn always re-emits in full.
 *
 * Isolation: the card-fire sidechannel is redirected per-test via the
 * CARD_FIRE_SIDECHANNEL_PATH env var (its own documented test seam); the
 * hash sidecar lives under a fresh mkdtemp room dir per test. Pure fixture
 * inputs, no room.db, no network.
 *
 * node --test, CJS, node:assert/strict. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// node --test isolates each file in a child process whose fd 0 (stdin) stays
// an open, unclosed pipe (never a TTY, never EOF). scripts/intent-classifier.cjs
// reads fd 0 SYNCHRONOUSLY at module-load time (STDIN_RAW = readStdinSync(),
// ~L403) to seed the CLI turn message; under that open child-process pipe the
// synchronous read blocks forever, hanging the whole test file (confirmed:
// `node <file>` directly and `node --experimental-test-isolation=none` both
// complete in well under 1s; plain `node --test <file>` never returns).
// Closing fd 0 BEFORE requiring the module makes the read fail fast (EBADF,
// caught by readStdinSync's own try/catch, degrading to ''), which is the
// exact same degraded-empty-stdin behavior the module already has for a
// closed/EOF pipe. Test-only; scripts/intent-classifier.cjs itself is
// untouched.
try { fs.closeSync(0); } catch (_e) { /* already closed or unavailable */ }

const REPO_ROOT = path.resolve(__dirname, '..');
const IC_PATH = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const ic = require(IC_PATH);
const sidechannel = require(path.join(REPO_ROOT, 'lib', 'core', 'card-fire-sidechannel.cjs'));

function engineDecisionFixture() {
  return {
    fire_skill: 'discover',
    suppress_skills: [],
    decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'first reason' },
  };
}

function mkTmpRoom(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// Test 1 (full-then-marker): identical inputs across two calls; first call
// (prevBlockHash null) returns the full block and invokes onBlockHash with a
// sha256 hex string; second call (prevBlockHash = that hash) returns exactly
// the exported NAV_UNCHANGED_MARKER.
// ---------------------------------------------------------------------------
test('Test 1 (full-then-marker): identical turns suppress to the exported marker', () => {
  assert.equal(typeof ic.NAV_UNCHANGED_MARKER, 'string', 'NAV_UNCHANGED_MARKER must be exported');
  assert.ok(ic.NAV_UNCHANGED_MARKER.length > 0, 'NAV_UNCHANGED_MARKER must be non-empty');

  const decision = engineDecisionFixture();
  const routing = { source: 'engine' };

  let capturedHash = null;
  let capturedBytes = null;
  const block1 = ic.renderEngineDecisionWithDial(decision, routing, '', {
    cortexNodes: [],
    prevBlockHash: null,
    onBlockHash: function (hash, bytes) { capturedHash = hash; capturedBytes = bytes; },
  });

  assert.ok(typeof block1 === 'string' && block1.length > 0, 'first call renders a full block');
  assert.notEqual(block1, ic.NAV_UNCHANGED_MARKER, 'first call never returns the marker');
  assert.equal(typeof capturedHash, 'string', 'onBlockHash was invoked with a hash string');
  assert.match(capturedHash, /^[0-9a-f]{64}$/, 'the captured hash is a sha256 hex digest');
  assert.equal(typeof capturedBytes, 'number', 'onBlockHash was invoked with a byte count');

  // Record the item-(a) "before" fixture byte count for the SUMMARY.
  process.stdout.write('  [251-01a] fixture full block bytes (before): ' + Buffer.byteLength(block1, 'utf8') + '\n');

  const block2 = ic.renderEngineDecisionWithDial(decision, routing, '', {
    cortexNodes: [],
    prevBlockHash: capturedHash,
    onBlockHash: function () {},
  });
  assert.equal(block2, ic.NAV_UNCHANGED_MARKER, 'second identical call suppresses to the marker exactly');
  process.stdout.write('  [251-01a] suppressed marker bytes (after): ' + Buffer.byteLength(block2, 'utf8') + '\n');
});

// ---------------------------------------------------------------------------
// Test 2 (changed re-emits): mutating a varying field (Why: rationale)
// between calls means the second call returns the FULL block, not the
// marker, even though prevBlockHash is threaded from the first call.
// ---------------------------------------------------------------------------
test('Test 2 (changed re-emits): a varying-field change re-emits in full', () => {
  const decision = engineDecisionFixture();
  const routing = { source: 'engine' };

  let hash1 = null;
  const block1 = ic.renderEngineDecisionWithDial(decision, routing, '', {
    cortexNodes: [],
    prevBlockHash: null,
    onBlockHash: function (hash) { hash1 = hash; },
  });

  decision.decision_trace.chosen_rationale = 'second, DIFFERENT reason';
  const block2 = ic.renderEngineDecisionWithDial(decision, routing, '', {
    cortexNodes: [],
    prevBlockHash: hash1,
    onBlockHash: function () {},
  });

  assert.notEqual(block2, ic.NAV_UNCHANGED_MARKER, 'a changed decision never suppresses');
  assert.notEqual(block2, block1, 'the changed block differs from the first');
  assert.ok(block2.indexOf('second, DIFFERENT reason') !== -1, 'the changed field is present in the re-emitted block');
});

// ---------------------------------------------------------------------------
// Test 3 (sidechannel skip): after a suppressed second call with identical
// inputs, the card-fire sidechannel holds exactly ONE reached-gate record
// for this session (from the first, non-suppressed call), never two.
// ---------------------------------------------------------------------------
test('Test 3 (sidechannel skip): a suppressed turn records zero new reached-gates', () => {
  const tmpDir = mkTmpRoom('mindrian-test251a-side-');
  const sidechannelPath = path.join(tmpDir, 'card-fire-reached.json');
  const prevEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = sidechannelPath;
  try {
    const decision = engineDecisionFixture();
    const routing = { source: 'engine' };
    const sessionId = 'test251a-session-1';

    let hash1 = null;
    ic.renderEngineDecisionWithDial(decision, routing, '', {
      cortexNodes: [],
      sessionId: sessionId,
      prevBlockHash: null,
      onBlockHash: function (hash) { hash1 = hash; },
    });

    const afterFirst = sidechannel.readReachedGates(sessionId, { filePath: sidechannelPath });
    assert.equal(afterFirst.length, 1, 'the first (full) call records exactly one reached-gate');

    ic.renderEngineDecisionWithDial(decision, routing, '', {
      cortexNodes: [],
      sessionId: sessionId,
      prevBlockHash: hash1,
      onBlockHash: function () {},
    });

    const raw = JSON.parse(fs.readFileSync(sidechannelPath, 'utf8'));
    const records = Array.isArray(raw[sessionId]) ? raw[sessionId] : [];
    assert.equal(records.length, 1, 'a suppressed second call records ZERO new reached-gates (still exactly one on disk)');
  } finally {
    if (prevEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = prevEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (fail-open): a missing sidecar reads null; a corrupt sidecar reads
// null and never throws; a null prevBlockHash always yields full emission.
// ---------------------------------------------------------------------------
test('Test 4 (fail-open): missing/corrupt sidecar reads null, never throws', () => {
  const tmpDir = mkTmpRoom('mindrian-test251a-failopen-');
  try {
    const sessionId = 'test251a-session-missing';
    const missing = ic.readNavBlockHash(tmpDir, sessionId);
    assert.equal(missing, null, 'a missing sidecar reads null');

    const corruptSession = 'test251a-session-corrupt';
    const corruptPath = ic.navBlockHashPath(tmpDir, corruptSession);
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, 'not valid json { garbage', 'utf8');
    let threw = false;
    let corrupt;
    try {
      corrupt = ic.readNavBlockHash(tmpDir, corruptSession);
    } catch (_e) {
      threw = true;
    }
    assert.equal(threw, false, 'a corrupt sidecar never throws');
    assert.equal(corrupt, null, 'a corrupt sidecar reads null (fail open)');

    // A null prevBlockHash always yields full emission.
    const decision = engineDecisionFixture();
    const block = ic.renderEngineDecisionWithDial(decision, { source: 'engine' }, '', {
      cortexNodes: [],
      prevBlockHash: null,
    });
    assert.notEqual(block, ic.NAV_UNCHANGED_MARKER, 'a null prevBlockHash always yields full emission');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (kill switch): the env guard lives at the call site (source
// assertion); the exported helper contract keeps working regardless.
// ---------------------------------------------------------------------------
test('Test 5 (kill switch): MINDRIAN_NAV_NO_SUPPRESS guard present at the call site', () => {
  const source = fs.readFileSync(IC_PATH, 'utf8');
  assert.match(source, /MINDRIAN_NAV_NO_SUPPRESS/, 'scripts/intent-classifier.cjs must reference the kill-switch env var');

  const tmpDir = mkTmpRoom('mindrian-test251a-killswitch-');
  try {
    const sessionId = 'test251a-session-killswitch';
    ic.writeNavBlockHash(tmpDir, sessionId, 'a'.repeat(64), 123);
    const readBack = ic.readNavBlockHash(tmpDir, sessionId);
    assert.equal(readBack, 'a'.repeat(64), 'readNavBlockHash still works regardless of the env kill switch (gate lives at the call site)');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (sidecar roundtrip): writeNavBlockHash then readNavBlockHash
// roundtrips the hash; the path matches navBlockHashPath; the file on disk
// carries ONLY version/sha256/at/bytes keys (Canon Part 8 discipline).
// ---------------------------------------------------------------------------
test('Test 6 (sidecar roundtrip): write/read roundtrip + closed key set', () => {
  const tmpDir = mkTmpRoom('mindrian-test251a-roundtrip-');
  try {
    const sessionId = 'test251a-session-roundtrip';
    const expectedPath = ic.navBlockHashPath(tmpDir, sessionId);
    assert.equal(
      expectedPath,
      path.join(tmpDir, '.mindrian', 'decision-traces', sessionId + '.nav-block-hash.json'),
      'navBlockHashPath resolves to decision-traces/<sessionId>.nav-block-hash.json'
    );

    const hash = 'b'.repeat(64);
    ic.writeNavBlockHash(tmpDir, sessionId, hash, 1432);
    const readBack = ic.readNavBlockHash(tmpDir, sessionId);
    assert.equal(readBack, hash, 'writeNavBlockHash then readNavBlockHash roundtrips the hash');

    assert.ok(fs.existsSync(expectedPath), 'the sidecar file exists at navBlockHashPath');
    const raw = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    const keys = Object.keys(raw).sort();
    assert.deepEqual(keys, ['at', 'bytes', 'sha256', 'version'], 'the sidecar carries ONLY version/sha256/at/bytes keys, no block text');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7 (post-compact reset fence): scripts/post-compact deletes the
// nav-block-hash sidecars so the first post-compact turn always re-emits in
// full.
// ---------------------------------------------------------------------------
test('Test 7 (post-compact reset fence): post-compact deletes nav-block-hash sidecars', () => {
  const postCompactPath = path.join(REPO_ROOT, 'scripts', 'post-compact');
  const source = fs.readFileSync(postCompactPath, 'utf8');
  assert.match(source, /nav-block-hash\.json/, 'scripts/post-compact must reference nav-block-hash.json sidecars');
  assert.match(source, /rm\s+-f[^\n]*nav-block-hash\.json/, 'the nav-block-hash sidecar deletion runs via an rm -f (or unlink), never crashing the hook');
});
