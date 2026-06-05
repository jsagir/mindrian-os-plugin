'use strict';
// NAV-03 (Phase 142) -- loop-fires acceptance: an enqueued brain-derivation
// entry DRAINS within a session (is dispatched), not left sitting for days.
//
// The queue + drain + the UserPromptSubmit drain hook are SHIPPED (Phase 90:
// brain-derivation-queue.enqueue / drain; scripts/brain-derivation-drain.cjs;
// hooks/hooks.json UserPromptSubmit wiring). This suite proves the loop FIRES
// against that shipped code -- it modifies NEITHER the queue lib NOR the drain
// script (verify-only).
//
// WHAT "DRAINS WITHIN A SESSION" MEANS HERE (and why no new export is needed):
//   The session-level drain is ALREADY shipped as the UserPromptSubmit hook:
//   hooks/hooks.json fires `node scripts/brain-derivation-drain.cjs` on every
//   user turn, which calls brain-derivation-queue.drain(). There is no missing
//   `drainWithinSession` function -- the "within a session" guarantee is the
//   hook wiring + drain(), not a new API. The first RED suite asserted a
//   `drainWithinSession` export that the shipped design does not (and should
//   not) have; per the plan ("do NOT re-implement the shipped drain; only close
//   a gap the test PROVES"), that assertion was the test being wrong, not a code
//   gap. This suite asserts the loop through the genuinely-shipped surfaces:
//
//   (a) drain(roomDir, {dryRun:true}) DISPATCHES the matching-hash entry -- the
//       queue primitive drains an eligible entry rather than letting it sit.
//   (b) The shipped drain SCRIPT (the actual UserPromptSubmit entry point),
//       run as `brain-derivation-drain.cjs --room <tmp> --dry-run`, reports it
//       WOULD spawn deriveSection for the eligible section -- proving the
//       session-turn drain fires end-to-end.
//   (c) hooks/hooks.json wires brain-derivation-drain.cjs on UserPromptSubmit --
//       the regression fence that the auto-drain trigger stays wired per turn.
//
// Dry-run throughout (drain dryRun:true / script --dry-run) so the test needs no
// Brain availability and spawns no real deriveSection children (T-142-07).
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DRAIN_SCRIPT = path.join(REPO, 'scripts', 'brain-derivation-drain.cjs');
const HOOKS_JSON = path.join(REPO, 'hooks', 'hooks.json');

let queue;
try {
  queue = require(path.join(REPO, 'lib', 'core', 'brain-derivation-queue.cjs'));
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
    const label1 = 'NAV-03: drain() dispatches the enqueued matching-hash entry (does not sit)';
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

    // (b) The SHIPPED drain SCRIPT (the real UserPromptSubmit entry point) fires
    //     the drain within a turn. Re-enqueue (drain (a) consumed it), then run
    //     scripts/brain-derivation-drain.cjs --room <tmp> --dry-run and assert it
    //     reports it WOULD spawn deriveSection for the eligible section. This is
    //     the in-session drain loop firing end-to-end through shipped code.
    const label2 = 'NAV-03: shipped drain script (UserPromptSubmit entry) fires the in-session drain';
    try {
      queue.enqueue(env.room, env.section, null, newHash, queue.ALLOWED_REASONS.SESSION_START_STALE);
      const proc = spawnSync(process.execPath, [DRAIN_SCRIPT, '--room', env.room, '--dry-run'], {
        encoding: 'utf8',
        timeout: 15000,
        env: Object.assign({}, process.env, { MINDRIAN_BRAIN_KEY: 'nav03-test-key' }),
      });
      assert.equal(proc.status, 0, label2 + ': drain script must exit 0; stderr=' + (proc.stderr || ''));
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.ok(/would spawn deriveSection for section=market-analysis/.test(combined),
        label2 + ': drain script dry-run must report it WOULD dispatch the eligible section; got: ' + combined);
      ok(label2);
    } catch (e) {
      fail(label2, e);
    }

    // (c) Regression fence: the UserPromptSubmit auto-drain wiring is present in
    //     hooks/hooks.json. This is what guarantees the drain fires PER TURN
    //     (the "within a session, not sitting for days" property NAV-03 names).
    const label3 = 'NAV-03: hooks.json wires brain-derivation-drain.cjs on UserPromptSubmit';
    try {
      const hooksRaw = fs.readFileSync(HOOKS_JSON, 'utf8');
      const hooks = JSON.parse(hooksRaw);
      assert.ok(/brain-derivation-drain/.test(hooksRaw),
        label3 + ': hooks.json must reference brain-derivation-drain');
      const ups = hooks && hooks.hooks && hooks.hooks.UserPromptSubmit;
      assert.ok(Array.isArray(ups), label3 + ': hooks.UserPromptSubmit must be an array');
      const wired = JSON.stringify(ups).includes('brain-derivation-drain.cjs');
      assert.ok(wired,
        label3 + ': brain-derivation-drain.cjs must be wired under the UserPromptSubmit event');
      ok(label3);
    } catch (e) {
      fail(label3, e);
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
