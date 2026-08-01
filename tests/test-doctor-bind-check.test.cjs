#!/usr/bin/env node
// PSB-14 -- the bind-time room-health check reports the session binding health
// (healthy when the top room is on-scope, unhealthy when unbound/off-scope),
// registers this session's presence, and makes ZERO Brain call (Part 8).
//
// The original stub SKIPped "until Wave 5" and gated on the presence module's mere
// existence. Wave 5 shipped, and RCA statusline-room-health-chip-never-updates then
// wired a LIVE caller to it (the room_bind MCP tool + the F.8 session-binding
// consumer, both through room-health-cache.runBindHealthCheck). The skip framing gave
// false confidence, so the guards below are now HARD FAILs: a missing export is a
// regression, not an unfinished wave.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../lib/core/session-presence.cjs');
assert.strictEqual(typeof mod.registerPresence, 'function',
  'registerPresence must be exported (the bind-check composes it)');
assert.strictEqual(typeof mod.runBindCheck, 'function',
  'runBindCheck must be exported (Wave 5 shipped)');

// --- live contract ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-doctor-'));

try {
  // (1) an unbound session reports UNHEALTHY (nothing binds the top room)
  const unbound = mod.runBindCheck({ sessionId: 'sess-doc-1', topRoom: 'alpha', home });
  assert.ok(unbound && typeof unbound === 'object', 'bind-check returns a report object');
  assert.strictEqual(unbound.healthy, false, 'an unbound session is unhealthy');
  assert.strictEqual(unbound.onScope, false, 'an unbound session is off-scope');
  assert.ok(Array.isArray(unbound.findings), 'the report carries a findings array');
  assert.ok(Array.isArray(unbound.bound), 'the report carries the bound set');
  assert.ok('primary' in unbound, 'the report carries the primary');

  // (2) a session BOUND to the top room reports healthy (binding-only probe: no
  // roomDir, so the structural half is skipped and on-scope decides). This closes
  // the original TODO.
  const sessionBinding = require('../lib/core/session-binding.cjs');
  sessionBinding.writeSessionBinding('sess-doc-2', { primary: 'alpha', bound: ['alpha'] }, { home });
  const bound = mod.runBindCheck({ sessionId: 'sess-doc-2', topRoom: 'alpha', home });
  assert.strictEqual(bound.onScope, true, 'the bound top room is on-scope');
  assert.strictEqual(bound.healthy, true, 'a bound, structurally-unchecked session is healthy');
  assert.strictEqual(bound.primary, 'alpha', 'the report echoes the session primary');

  // (3) a bound session pointed at a MISSING room directory is unhealthy: the
  // structural half runs whenever a roomDir is supplied.
  const missing = mod.runBindCheck({
    sessionId: 'sess-doc-2',
    topRoom: 'alpha',
    roomDir: path.join(home, 'no-such-room'),
    home,
  });
  assert.strictEqual(missing.healthy, false, 'a missing room directory is not healthy');
  assert.ok(missing.findings.join(' ').indexOf('room-dir-missing') !== -1,
    'the missing directory is named in the findings: ' + JSON.stringify(missing.findings));

  // (4) ZERO Brain call (Part 8): the module carries no network token. The broader
  // source-grep floor lives in tests/test-194-local-only.test.cjs; this is the
  // local restatement so the bind-check's own contract is asserted here too.
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'session-presence.cjs'), 'utf8');
  for (const token of ['https://', 'node-fetch', 'brain-client']) {
    assert.strictEqual(src.indexOf(token), -1, 'no network token in session-presence.cjs: ' + token);
  }
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}

console.log('PASS: test-doctor-bind-check');
process.exit(0);
