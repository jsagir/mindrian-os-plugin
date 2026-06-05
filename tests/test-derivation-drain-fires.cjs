'use strict';
// NAV-03 (Phase 142) -- loop-fires acceptance: an enqueued brain-derivation
// entry is DISPATCHED within a drain (drains within a session), not left sitting.
//
// The queue + drain primitives are shipped (brain-derivation-queue.enqueue /
// drain). The loop-fires assertion proves the DISPATCH actually happens for a
// matching-hash entry when Brain is available: result.dispatched is non-empty
// for the entry whose section's current governing-thought hash matches the
// enqueued new_governing_thought_hash.
//
// To exercise the real loop deterministically:
//   - Build a real room dir with a section MINTO.md whose governing thought is
//     known, so the drain's stale-queue-race hash check passes.
//   - Force Brain availability by setting MINDRIAN_BRAIN_KEY on the env (the
//     drain re-enqueues instead of dispatching when Brain is offline).
//   - enqueue the section with new_hash = sha256(governing_thought).
//   - drain(roomDir, {dryRun:true}) and assert the entry is DISPATCHED.
//
// The NAV-03 GAP this locks: the entry must drain WITHIN THE SESSION. The suite
// requires a brain-derivation-queue.drainWithinSession(roomDir, opts) session
// entry point that fires the drain and reports the dispatched entries -- the
// hook-level wiring that guarantees entries do not sit for days. That entry
// point does not exist yet -> RED until Plan 03/04 wires the session drain.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let queue;
try {
  queue = require(path.join(__dirname, '..', 'lib', 'core', 'brain-derivation-queue.cjs'));
} catch (e) {
  process.stdout.write('SKIP test-derivation-drain-fires.cjs (module load failed: ' + e.message + ')\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// Mirror brain-derivation-queue.sha256OfString so the enqueued hash matches the
// drain's recomputed current-governing-thought hash exactly.
function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

function makeRoom(govThought) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-nav03-drain-'));
  const section = 'market-analysis';
  const sectionPath = path.join(room, section);
  fs.mkdirSync(sectionPath, { recursive: true });
  fs.writeFileSync(path.join(sectionPath, 'MINTO.md'),
    '---\ngoverning_thought: ' + govThought + '\n---\n# Reasoning\n');
  fs.writeFileSync(path.join(sectionPath, 'ROOM.md'), '# Market Analysis\n');
  return { room, section, sectionPath };
}

async function main() {
  const govThought = 'The serviceable market gates the venture.';
  const env = makeRoom(govThought);
  const newHash = sha256OfString(govThought);
  const prevKey = process.env.MINDRIAN_BRAIN_KEY;
  // Force Brain availability so the drain dispatches rather than re-enqueues.
  process.env.MINDRIAN_BRAIN_KEY = 'nav03-test-key';

  try {
    // Enqueue the section with the matching new_hash.
    const enq = queue.enqueue(env.room, env.section, null, newHash, queue.ALLOWED_REASONS.MANUAL_INVOCATION);
    assert.equal(enq.queued, true, 'NAV-03: enqueue must succeed; got ' + JSON.stringify(enq));

    // (a) The drain primitive dispatches the matching-hash entry within a session.
    const label1 = 'NAV-03: drain dispatches the enqueued matching-hash entry (does not sit)';
    try {
      const res = await queue.drain(env.room, { dryRun: true });
      assert.ok(res && Array.isArray(res.dispatched),
        label1 + ': drain must return a dispatched array');
      const hit = res.dispatched.find(function (d) { return d.section === env.section; });
      assert.ok(hit, label1 + ': the matching-hash entry must be DISPATCHED within the drain, not left sitting; got ' + JSON.stringify(res));
      ok(label1);
    } catch (e) {
      fail(label1, e);
    }

    // (b) The SESSION drain entry point must exist -- the wiring guarantee that
    //     entries drain within a session (NAV-03 closure). RED until wired.
    const label2 = 'NAV-03: drainWithinSession session entry point fires the drain';
    try {
      // Re-enqueue (the prior drain consumed it) so the session drain has work.
      queue.enqueue(env.room, env.section, null, newHash, queue.ALLOWED_REASONS.SESSION_START_STALE);
      assert.equal(typeof queue.drainWithinSession, 'function',
        label2 + ': brain-derivation-queue.drainWithinSession must be exported ' +
        '(RED until Plan 03/04 wires the session-level drain)');
      const sres = await queue.drainWithinSession(env.room, { dryRun: true });
      assert.ok(sres && Array.isArray(sres.dispatched) && sres.dispatched.length > 0,
        label2 + ': the session drain must dispatch the queued entry');
      ok(label2);
    } catch (e) {
      fail(label2, e);
    }
  } finally {
    if (prevKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY;
    else process.env.MINDRIAN_BRAIN_KEY = prevKey;
    try { fs.rmSync(env.room, { recursive: true, force: true }); } catch (_) {}
  }

  process.stdout.write('\n');
  process.stdout.write('NAV-03 loop-fires (derivation drain dispatches): ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('FAIL test-derivation-drain-fires.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
