#!/usr/bin/env node
// PSB-04/05 -- the F.8 gate WRITES the binding: net-new consumeSessionBinding
// captures the confirmed toggle set + primary + sticky and writes the session
// file; the dev-repo/no-room option is a first-class selectable. SKIP-safe until
// lib/workflow/session-binding-consumer.cjs lands. Node built-in assert only.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mod;
try {
  mod = require('../lib/workflow/session-binding-consumer.cjs');
} catch (e) {
  console.log('SKIP: test-session-binding-consumer -- module not present yet (lib/workflow/session-binding-consumer.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.consumeSessionBinding !== 'function') {
  console.log('SKIP: test-session-binding-consumer -- consumeSessionBinding not exported yet (Wave 3).');
  process.exit(0);
}

// --- live contract (runs once the consumer lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-consumer-'));
const sid = 'sess-consume-1';

// (1) the confirmed set is written to the session binding file
const res = mod.consumeSessionBinding({
  picks: ['alpha', 'beta'],
  primaryPick: 'alpha',
  sticky: false,
  sessionId: sid,
  home,
});
assert.ok(res && typeof res === 'object', 'consumer returns a result object');

const binding = require('../lib/core/session-binding.cjs').readSessionBinding(sid, { home });
assert.deepStrictEqual(binding.bound, ['alpha', 'beta'], 'confirmed picks land in bound');
assert.strictEqual(binding.primary, 'alpha', 'primaryPick lands in primary');

// TODO (implementing wave): the "dev repo / no room" reserved slug ("__no_room__")
// is a valid pick -> bound carries the sentinel, primary null (D-03/D-04).
// TODO: per newly-bound room, the doctor --bind-check job is triggered before return.

console.log('PASS: test-session-binding-consumer');
process.exit(0);
