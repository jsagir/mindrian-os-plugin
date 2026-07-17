#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * reach-sensor-relevance-gap A1 -- session-binding key-alignment regression.
 * =============================================================================
 * Root cause A (proven in .planning/debug/resolved/reach-sensor-relevance-gap.md):
 * the MCP room_bind writer keys the session binding under the real Claude session
 * UUID (tool-router.cjs effectiveSessionId = extra.sessionId), but the CLI
 * UserPromptSubmit hook (intent-classifier.cjs resolveSessionId) read it under
 * process.env.CLAUDE_SESSION_ID -- which is UNSET in the hook -- so it fell to a
 * sha256(roomDir+ISO-day) hash. The two keys never matched, so readSessionBinding
 * always missed and the F.8 binding gate fired every turn.
 *
 * The fix threads the hook stdin payload's session_id (the SAME UUID) into
 * resolveSessionId (payload.session_id -> CLAUDE_SESSION_ID -> hash). This test
 * proves the CLI read key now matches what room_bind writes.
 *
 * Legs:
 *   1. UNIT: extractSessionId lifts session_id from the hook payload; a payload
 *      without it yields ''. resolveSessionId is exported for the integration legs.
 *   2. FIX: a UUID-keyed binding (exactly what writeSessionBinding stores for
 *      room_bind) IS seen by the gate when the hook payload carries session_id=UUID
 *      and CLAUDE_SESSION_ID is UNSET -> the top room is on-scope -> the F.8 gate
 *      STAYS SILENT ('session unbound' absent).
 *   3. MECHANISM CONTROL (the pre-fix production path): the SAME UUID binding on
 *      disk, the SAME message, but NO payload session_id and NO CLAUDE_SESSION_ID
 *      -> the reader falls to the hash, the UUID binding is NOT found, the gate
 *      FIRES ('session unbound' present). This is the exact bug, and it proves the
 *      test would catch a regression of the key alignment.
 *   4. PHASE 225 BENEFIT: the same UUID-keyed binding is now visible to the
 *      zero-score no-match gate (a substantive zero-score reframe fires the
 *      'no room matched' gate only because readSessionBinding(UUID) finally sees a
 *      bound primary). Confirms A1 un-breaks the Phase 225 gate (same key source).
 *
 * Node built-in assert only. No em-dashes. Temp dirs cleaned in a finally block.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const { writeSessionBinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')
);
const ic = require(CLASSIFIER); // require-safe (guarded by require.main === module)

// A realistic Claude session UUID -- the shape room_bind's extra.sessionId carries.
const SESSION_UUID = '3a73764e-87ce-44c9-8e6a-c449574d3b42';
const ROOM = 'pricing-lab';
// A DIFFERENT, off-topic room so a zero-score reframe can score 0 against BOTH.
const OTHER = 'copper-ledger';

// A message rich in pricing-lab fingerprint tokens (score > 0, top room), with NO
// room-name adjacency that could trip the strict-mode slug path.
const ON_TOPIC = 'let us revisit the subscription pricing model tiers and discount schedule';
// A substantive (>= 8 distinct token) reframe that scores 0 against both rooms.
const REFRAME =
  'I am a student enrolled in an urban mobility course and our group project is '
  + 'about transportation planning for a mid sized coastal city';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function makeFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-keyalign-'));

  const pricingState =
    '---\nproject: Subscription Pricing Model\n---\n# Pricing Lab\nDiscount tiers, subscription revenue, pricing model notes.\n';
  const ledgerState =
    '---\nproject: Invoice Ledger Billing\n---\n# Copper Ledger\nAccounts payable register.\n';
  fs.mkdirSync(path.join(home, ROOM), { recursive: true });
  fs.writeFileSync(path.join(home, ROOM, 'STATE.md'), pricingState);
  fs.mkdirSync(path.join(home, OTHER), { recursive: true });
  fs.writeFileSync(path.join(home, OTHER, 'STATE.md'), ledgerState);

  const registry = { active: ROOM, rooms: {} };
  registry.rooms[ROOM] = { slug: ROOM };
  registry.rooms[OTHER] = { slug: OTHER };
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  return home;
}

// Spawn the classifier with an explicit hook env. `payloadSessionId` controls
// whether the stdin payload carries session_id; `envSessionId` controls whether
// CLAUDE_SESSION_ID is exported (the real hook does NOT export it).
function spawnClassifier(home, message, opts) {
  const options = opts || {};
  const payload = { prompt: message };
  if (options.payloadSessionId) payload.session_id = options.payloadSessionId;

  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_ROOT: home,
    MINDRIAN_ROOMS_HOME: home,
  });
  // The hook process has NO CLAUDE_SESSION_ID unless the test explicitly sets it.
  delete env.CLAUDE_SESSION_ID;
  if (options.envSessionId) env.CLAUDE_SESSION_ID = options.envSessionId;

  return spawnSync(process.execPath, [CLASSIFIER], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: env,
    timeout: 30000,
  });
}

// Write the binding EXACTLY as MCP room_bind does: keyed by the session UUID.
function bindUnderUuid(home) {
  writeSessionBinding(SESSION_UUID, { bound: [ROOM], primary: ROOM }, { home: home });
}

const home = makeFixture();
try {
  console.log('test-226-session-binding-key-alignment.cjs (reach-sensor-relevance-gap A1)');

  // -------------------------------------------------------------------------
  // Leg 1 UNIT: extractSessionId + the export surface.
  // -------------------------------------------------------------------------
  check('leg 1 UNIT: extractSessionId lifts session_id from the hook payload', () => {
    assert.strictEqual(typeof ic.extractSessionId, 'function', 'extractSessionId is exported');
    assert.strictEqual(typeof ic.resolveSessionId, 'function', 'resolveSessionId is exported');
    assert.strictEqual(
      ic.extractSessionId(JSON.stringify({ session_id: SESSION_UUID, prompt: 'hi' })),
      SESSION_UUID,
      'top-level session_id is extracted'
    );
    assert.strictEqual(
      ic.extractSessionId(JSON.stringify({ payload: { session_id: SESSION_UUID } })),
      SESSION_UUID,
      'nested payload.session_id is extracted'
    );
    assert.strictEqual(ic.extractSessionId(JSON.stringify({ prompt: 'no id here' })), '',
      'a payload without session_id yields empty string (falls through to env/hash)');
    assert.strictEqual(ic.extractSessionId('not json'), '', 'non-JSON yields empty string');
  });

  // -------------------------------------------------------------------------
  // Leg 2 FIX: the UUID-keyed binding IS seen by the gate when the payload
  // carries session_id (and CLAUDE_SESSION_ID is UNSET) -> on-scope -> silence.
  // -------------------------------------------------------------------------
  check('leg 2 FIX: payload session_id aligns the CLI read key with the room_bind UUID (gate SILENT)', () => {
    bindUnderUuid(home);
    const res = spawnClassifier(home, ON_TOPIC, { payloadSessionId: SESSION_UUID });
    assert.strictEqual(res.status, 0, 'exit 0 (never-block); got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('session unbound') === -1,
      'the F.8 binding gate must NOT fire: the UUID binding is now seen on-scope');
    assert.ok(out.indexOf('bind session') === -1, 'no bind-session header when on-scope');
  });

  // -------------------------------------------------------------------------
  // Leg 3 MECHANISM CONTROL (pre-fix path): SAME UUID binding on disk, SAME
  // message, but NO payload session_id and NO CLAUDE_SESSION_ID -> the reader
  // falls to the sha256 hash, the UUID binding is NOT found -> the gate FIRES.
  // This is the exact bug and proves the alignment is what silences the gate.
  // -------------------------------------------------------------------------
  check('leg 3 CONTROL: without the payload session_id the hash key misses the UUID binding (gate FIRES)', () => {
    const res = spawnClassifier(home, ON_TOPIC, { /* no payloadSessionId, no envSessionId */ });
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('session unbound') !== -1,
      'the F.8 gate fires under the hash key (the pre-A1 production behavior)');
  });

  // -------------------------------------------------------------------------
  // Leg 4 PHASE 225 BENEFIT: the same UUID binding is now visible to the
  // zero-score no-match gate. A substantive zero-score reframe fires the
  // 'no room matched' gate ONLY because readSessionBinding(UUID) finally sees a
  // bound primary. (Fresh UUID so the once-per-session marker is clean.)
  // -------------------------------------------------------------------------
  check('leg 4 PHASE 225: UUID binding is visible to the zero-score gate (same key source)', () => {
    const freshUuid = '11112222-3333-4444-5555-666677778888';
    writeSessionBinding(freshUuid, { bound: [ROOM], primary: ROOM }, { home: home });
    const res = spawnClassifier(home, REFRAME, { payloadSessionId: freshUuid });
    assert.strictEqual(res.status, 0, 'exit 0; got ' + res.status + ' stderr=' + res.stderr);
    const out = res.stdout || '';
    assert.ok(out.indexOf('no room matched') !== -1,
      'the zero-score gate fires because the UUID-keyed bound primary is now seen (Phase 225 un-broken)');
    assert.ok(out.indexOf('continue in ' + ROOM) !== -1,
      'the zero-score gate offers continue-in-primary from the UUID binding');
  });

  console.log('');
  console.log('PASS test-226-session-binding-key-alignment.cjs (' + passed + ' checks)');
  process.exit(0);
} catch (e) {
  console.error('FAIL test-226-session-binding-key-alignment.cjs: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
} finally {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) {}
}
