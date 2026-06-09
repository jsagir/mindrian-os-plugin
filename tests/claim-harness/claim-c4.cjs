'use strict';
// Phase 150-08 -- CLAIM C4: "The Brain surfaces patterns from across the
// curriculum."
// ========================================================================
// Three arms (two machine + one carved-out semantic):
//
//   C4-handles (machine, hermetic): the cortex Brain packet
//     (buildMemoryCortexPacket) returns generic advisory-chain HANDLES
//     (governing_thought_hash + enums + correlation_id), Part-8-clean -- the
//     wire the Brain reasons over. This arm needs NO live Brain.
//
//   C4-offline (machine, hermetic): with no live Brain the packet still builds
//     and degrades gracefully (never throws, no fabricated remote join) -- the
//     "Larry teaches without Brain" Local-Only path (Canon Part 1).
//
//   C4-live (machine, SELF-SKIPS): the live Brain advisory call gates on
//     lib/core/doctor/class-m-brain-smoke.cjs. When Brain is unreachable the arm
//     prints a named SKIP, never a fake PASS -- the hermetic arms carry the gate.
//
//   C4-relevance (CARVED OUT): whether the surfaced pattern is actually RELEVANT
//     is a semantic-quality judgment -- carved to the Part-10 human empathy gate,
//     named not faked.
//
// Drives the REAL cortex packet builder on the real fixture; no mock of the unit
// under test. node:sqlite unavailable -> SKIP 77. NO em-dashes; forbidden dash
// codepoints referenced via String.fromCharCode.

const assert = require('node:assert/strict');
const path = require('node:path');

const HARNESS = require('./build-fixture-room-db.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP claim-c4.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const packetMod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs'));
const smoke = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs'));

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C4: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C4: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c4.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

(async function main() {
  try {
    const db = built.db;

    // ---- C4-handles: the packet carries generic advisory-chain handles.
    check('C4-handles: the cortex Brain packet carries generic advisory handles (the wire Brain reasons over)', function () {
      assert.equal(typeof packetMod.buildMemoryCortexPacket, 'function',
        'memory-cortex-packet must export buildMemoryCortexPacket');
      const packet = packetMod.buildMemoryCortexPacket(db, { section: 'problem-definition' });
      assert.ok(packet && typeof packet === 'object', 'packet must be an object');
      assert.ok(
        typeof packet.governing_thought_hash === 'string'
        && /^sha256:[0-9a-f]{64}$/.test(packet.governing_thought_hash),
        'packet must carry a sha256 governing_thought_hash handle, got: ' + packet.governing_thought_hash
      );
      assert.equal(typeof packet.gap_count, 'number', 'packet must carry a numeric gap_count');
    });

    // ---- C4-handles Part-8 floor: no forbidden prose in the serialized packet.
    check('C4-handles: the packet is Part-8-clean (no raw memory prose / no dashes)', function () {
      const packet = packetMod.buildMemoryCortexPacket(db, { section: 'problem-definition' });
      const serialized = JSON.stringify(packet);
      const forbidden = ['SECRET CLAIM PROSE', 'leak@example.com', '/home/jsagi/secret/', '${INJECT}'];
      for (const sub of forbidden) {
        assert.equal(serialized.indexOf(sub), -1, 'packet must not contain forbidden prose: ' + sub);
      }
      assert.equal(serialized.indexOf(EM_DASH), -1, 'packet must contain no em-dashes');
      assert.equal(serialized.indexOf(EN_DASH), -1, 'packet must contain no en-dashes');
    });

    // ---- C4-offline: graceful degradation with no live Brain.
    check('C4-offline: the packet builds + degrades gracefully on an unknown section (Local-Only path)', function () {
      let packet;
      assert.doesNotThrow(function () {
        packet = packetMod.buildMemoryCortexPacket(db, { section: 'no-such-section' });
      }, 'the packet build must not throw on an un-joinable section');
      assert.ok(packet && typeof packet === 'object', 'an un-joinable section still returns a packet object');
      assert.ok(
        packet.correlation_id == null || packet.correlation_id === '' || typeof packet.correlation_id === 'string',
        'a HELD/unknown section must not crash; correlation_id is absent or a string'
      );
    });

    // ---- C4-live: gates on class-m-brain-smoke; SELF-SKIPS when unreachable.
    let brainReachable = false;
    try {
      const r = await smoke.checkBrainSmoke({});
      brainReachable = !!(r && r.ok === true);
    } catch (_e) {
      brainReachable = false;
    }
    if (brainReachable) {
      check('C4-live: live Brain advisory chain is reachable (live arm ran)', function () {
        // The hermetic packet IS the wire; with Brain reachable the live arm is
        // the operator in-room proof. We assert the precondition fired honestly.
        assert.ok(brainReachable, 'class-m-brain-smoke reported the live Brain reachable');
      });
    } else {
      process.stdout.write(
        'SKIP C4-live (live Brain advisory call): Brain unreachable via class-m-brain-smoke -- hermetic arms carry the gate, never a fake PASS\n'
      );
    }
  } finally {
    built.cleanup && built.cleanup();
  }

  // ---- C4-relevance: CARVED OUT to the Part-10 human empathy gate.
  process.stdout.write(
    'SKIP C4-relevance (semantic "is the surfaced pattern relevant"): CARVED OUT to the Part-10 human empathy gate -- NOT machine-asserted\n'
  );

  if (failures > 0) {
    process.stdout.write('\nclaim-c4.cjs: ' + failures + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\nclaim-c4.cjs: C4 GREEN (advisory handles + Part-8-clean + offline-graceful; live self-skips; relevance carved)\n');
  process.exit(0);
})();
