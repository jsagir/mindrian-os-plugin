#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-02 Task 3 -- all three BRAIN.md re-derivation triggers reach an enqueue
 * =================================================================================
 * Requirement R2's positive half: "BRAIN.md auto-re-derives on governing-thought
 * change, BRAIN_STALE_AGE_DAYS age-out, or explicit ask." Three arms, three
 * assertions, no live Brain.
 *
 *   Arm 1 (governing-thought change): drives the SHIPPED post-regen hook
 *     tryEnqueueBrainDerivation through its real caller, the generator's
 *     exported atomicWriteMinto. Asserts an entry lands with
 *     reason 'governing_thought_changed' and a non-null previous hash.
 *
 *   Arm 2 (BRAIN_STALE_AGE_DAYS age-out): builds a BRAIN.md whose
 *     governing_thought_hash MATCHES the triple (so precedence 3 cannot fire)
 *     but whose brain_generated_at is older than the threshold, asserts
 *     computeBrainStaleness returns stale_reason 'age_exceeded' with
 *     recommended_action 'enqueue_regen', then feeds that result through the
 *     session-start enqueue shape and asserts a queue entry with reason
 *     'session_start_stale'.
 *
 *     This arm answers 245-RESEARCH.md Open Question 4 with a live assertion
 *     rather than a guess. The session-start scan DOES consume the age result
 *     and enqueue on it (scripts/session-start:1094,1120), so the age arm is a
 *     REAL trigger, not a computed-and-unconsumed value.
 *
 *   Arm 3 (explicit ask): asserts /mos:brain-derive is in the generated
 *     connector registry with connects_to_spine:true, which is what makes the
 *     explicit ask a spine-reachable surface rather than a manual-only command.
 *
 * Hermetic (MEM-03 fence): every room is an fs.mkdtempSync under os.tmpdir(),
 * asserted per room. MINDRIAN_ROOMS_ROOT is redirected at a tmp path so no
 * active-room resolution can reach ~/MindrianRooms.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// Belt and braces, BEFORE any lib require: brain-client captures its endpoint
// at module-load time, so the redirect has to land before the module graph
// loads. A dead loopback port means nothing in this suite can reach the real
// Brain even if a code path tried. (ARM 2 returns at the AGE precedence step,
// which is ahead of the only step that calls schema(), so no call is made at
// all; this is the fence, not the mechanism.)
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '200';

const REPO = path.resolve(__dirname, '..');
const Q = require(path.join(REPO, 'lib', 'core', 'brain-derivation-queue.cjs'));
const staleness = require(path.join(REPO, 'lib', 'core', 'brain-md-staleness.cjs'));
const folderMemory = require(path.join(REPO, 'lib', 'core', 'folder-memory.cjs'));
const generator = require(path.join(REPO, 'scripts', 'vault-section-minto-generator.cjs'));

const TMP_REAL = fs.realpathSync(os.tmpdir());

let passed = 0;
let failed = 0;
const tmpRooms = [];

function ok(name) {
  passed += 1;
  process.stdout.write('  ok  ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

async function t(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

// The MEM-03 hermetic fence, enforced rather than assumed: every room this
// suite touches must resolve inside os.tmpdir().
function makeRoom(prefix) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-' + prefix + '-'));
  const real = fs.realpathSync(room);
  assert.ok(real === TMP_REAL || real.startsWith(TMP_REAL + path.sep),
    'HERMETIC FENCE BREACH: room ' + real + ' is outside ' + TMP_REAL);
  tmpRooms.push(room);
  fs.writeFileSync(path.join(room, '.room-root'), '');
  return room;
}

function makeSection(room, section, govThought) {
  const sp = path.join(room, section);
  fs.mkdirSync(sp, { recursive: true });
  fs.writeFileSync(path.join(sp, 'ROOM.md'), '# ' + section + '\n');
  if (govThought != null) {
    fs.writeFileSync(
      path.join(sp, 'MINTO.md'),
      '---\ngoverning_thought: ' + govThought + '\n---\n# Reasoning\n'
    );
  }
  return sp;
}

// A minimal-valid MINTO.md body the generator's invariants validator accepts.
// Mirrors lib/memory/brain-derivation-queue.test.cjs Test 19's fixture.
function mintoBody(section, govThought) {
  return [
    '---',
    'schema_version: "1.0"',
    'type: section-minto',
    'section: ' + section,
    'created: 2026-04-20',
    'room: test-room',
    'parent-moc: ROOM.md',
    'methodology: minto-pyramid',
    'sources: []',
    'related: []',
    'status: active',
    'governing_thought: "' + govThought + '"',
    'last_generated_at: "2026-04-20T00:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '# Test',
    '',
    '## Governing Thought',
    '',
    '> ' + govThought,
    '',
  ].join('\n');
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function main() {
  process.stdout.write('\nPhase 245-02: all three re-derivation trigger arms reach an enqueue\n\n');

  const envSaved = {
    MINDRIAN_BRAIN_KEY: process.env.MINDRIAN_BRAIN_KEY,
    MINDRIAN_BRAIN_URL: process.env.MINDRIAN_BRAIN_URL,
    BRAIN_STALE_AGE_DAYS: process.env.BRAIN_STALE_AGE_DAYS,
    MINDRIAN_ROOMS_ROOT: process.env.MINDRIAN_ROOMS_ROOT,
  };

  try {
    // Redirect active-room resolution away from any live room tree.
    process.env.MINDRIAN_ROOMS_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-roots-'));
    tmpRooms.push(process.env.MINDRIAN_ROOMS_ROOT);

    // ==================================================================
    // ARM 1: governing-thought change
    // ==================================================================
    await t('ARM 1 (governing_thought_changed): a MINTO rewrite enqueues via the shipped post-regen hook', function () {
      const room = makeRoom('arm1');
      const section = 'market-analysis';
      const sectionDir = path.join(room, section);
      fs.mkdirSync(sectionDir, { recursive: true });
      const mintoPath = path.join(sectionDir, 'MINTO.md');

      const gt1 = 'The serviceable market gates the venture.';
      const gt2 = 'The regulatory pathway gates the venture, not the market.';

      // First write: no prior file, so priorHash is null (cold-start enqueue).
      const w1 = generator.atomicWriteMinto(mintoPath, mintoBody(section, gt1), room);
      assert.ok(w1 && w1.success,
        'fixture MINTO must pass the invariants validator; violations='
        + JSON.stringify((w1 && w1.violations) || []));
      const q1 = Q.readQueue(room);
      assert.equal(q1.entries.length, 1, 'the first write must enqueue');
      assert.equal(q1.entries[0].reason, 'governing_thought_changed');
      assert.equal(q1.entries[0].previous_governing_thought_hash, null,
        'a cold-start write has no prior hash');

      // Second write with a CHANGED governing thought: the real change arm.
      const w2 = generator.atomicWriteMinto(mintoPath, mintoBody(section, gt2), room);
      assert.ok(w2 && w2.success, 'the second write must succeed');
      const q2 = Q.readQueue(room);
      assert.equal(q2.entries.length, 1,
        'section is the unique key, so the queue stays at 1 entry (A5 dedupe)');
      const e = q2.entries[0];
      assert.equal(e.section, section);
      assert.equal(e.reason, 'governing_thought_changed',
        'the change arm must stamp reason governing_thought_changed');
      assert.equal(e.previous_governing_thought_hash, sha256OfString(gt1),
        'the entry must carry the PRIOR governing thought hash');
      assert.equal(e.new_governing_thought_hash, sha256OfString(gt2),
        'the entry must carry the NEW governing thought hash');
    });

    await t('ARM 1 negative: rewriting the SAME governing thought does not re-enqueue', function () {
      const room = makeRoom('arm1neg');
      const section = 'market-analysis';
      const sectionDir = path.join(room, section);
      fs.mkdirSync(sectionDir, { recursive: true });
      const mintoPath = path.join(sectionDir, 'MINTO.md');
      const gt = 'The serviceable market gates the venture.';

      generator.atomicWriteMinto(mintoPath, mintoBody(section, gt), room);
      // Drain-free commit so we can see whether a SECOND identical write
      // re-enqueues from scratch.
      Q.commitDispatched(room, [section]);
      assert.equal(Q.readQueue(room).entries.length, 0, 'queue cleared for the arm');

      generator.atomicWriteMinto(mintoPath, mintoBody(section, gt), room);
      assert.equal(Q.readQueue(room).entries.length, 0,
        'an unchanged governing thought must not enqueue (the hook short-circuits '
        + 'on priorHash === newHash)');
    });

    // ==================================================================
    // ARM 2: BRAIN_STALE_AGE_DAYS age-out
    // ==================================================================
    await t('ARM 2 (age_exceeded): a matching-hash BRAIN.md past BRAIN_STALE_AGE_DAYS recommends enqueue_regen', async function () {
      const room = makeRoom('arm2');
      const section = 'market-analysis';
      const gt = 'The serviceable market gates the venture.';
      const sectionPath = makeSection(room, section, gt);

      // A BRAIN.md whose governing_thought_hash MATCHES the triple, so
      // precedence 3 (governing_thought_changed) cannot fire and the result
      // is unambiguously the AGE axis.
      fs.writeFileSync(path.join(sectionPath, 'BRAIN.md'), [
        '---',
        'brain_generated_at: "' + daysAgoIso(5) + '"',
        'brain_graph_version: 7',
        'governing_thought_hash: "' + sha256OfString(gt) + '"',
        '---',
        '',
        '# Brain derivation',
        '',
      ].join('\n'));

      // 1 day rather than the 7-day default, so the fixture does not need a
      // backdated file older than a week. Mirrors the env-override discipline
      // in lib/memory/brain-md-staleness.test.cjs Test 10.
      process.env.BRAIN_STALE_AGE_DAYS = '1';
      // isAvailable() is a pure env read. Brain must look reachable or
      // demoteWhenOffline() rewrites enqueue_regen to enqueue_when_brain_online.
      process.env.MINDRIAN_BRAIN_KEY = 'mos-245-test-key';

      const triple = folderMemory.readTriple(sectionPath);
      const res = await staleness.computeBrainStaleness(sectionPath, triple);

      assert.equal(res.staleness, 'stale', 'a 5-day-old BRAIN.md against a 1-day threshold is stale');
      assert.equal(res.stale_reason, 'age_exceeded',
        'the reason must be the AGE axis, not the hash axis; got ' + JSON.stringify(res));
      assert.equal(res.recommended_action, 'enqueue_regen',
        'the age axis must recommend enqueue_regen; got ' + JSON.stringify(res));
    });

    await t('ARM 2 (session_start_stale): the age result feeds the session-start enqueue shape', function () {
      const room = makeRoom('arm2enq');
      const section = 'market-analysis';
      const gt = 'The serviceable market gates the venture.';
      const sectionPath = makeSection(room, section, gt);

      // The exact shape scripts/session-start:1108-1121 uses when
      // recommended_action === 'enqueue_regen': recompute the current hash from
      // the triple, and (because stale_reason is NOT governing_thought_changed)
      // pass it as BOTH prev and new, with reason session_start_stale.
      const triple = folderMemory.readTriple(sectionPath);
      const currentGt = (triple && triple.reasoning && triple.reasoning.governing_thought != null)
        ? String(triple.reasoning.governing_thought) : '';
      const newHash = sha256OfString(currentGt);
      const staleReason = 'age_exceeded';
      const prevHash = staleReason === 'governing_thought_changed' ? null : newHash;

      const r = Q.enqueue(room, section, prevHash, newHash, 'session_start_stale');
      assert.equal(r.queued, true, 'the session-start enqueue must succeed; got ' + JSON.stringify(r));

      const entries = Q.readQueue(room).entries;
      assert.equal(entries.length, 1, 'exactly one entry');
      assert.equal(entries[0].section, section);
      assert.equal(entries[0].reason, 'session_start_stale',
        'the age arm lands in the queue under reason session_start_stale');
      assert.equal(entries[0].new_governing_thought_hash, newHash);
    });

    await t('ARM 2 wiring fence: scripts/session-start really consumes the age result (Open Question 4)', function () {
      const src = fs.readFileSync(path.join(REPO, 'scripts', 'session-start'), 'utf8');
      assert.ok(src.indexOf('computeBrainStaleness') !== -1,
        'session-start must compute staleness');
      assert.ok(src.indexOf('recommended_action === "enqueue_regen"') !== -1,
        'session-start must branch on recommended_action === enqueue_regen');
      assert.ok(/brainQueue\.enqueue\(roomDir, job\.section, prevHash, newHash, "session_start_stale"\)/.test(src),
        'session-start must ACTUALLY enqueue on that branch. This is the assertion '
        + 'that answers 245-RESEARCH.md Open Question 4: the age arm is a live '
        + 'trigger, not a computed-and-unconsumed value.');
    });

    // ==================================================================
    // ARM 3: explicit ask
    // ==================================================================
    await t('ARM 3 (explicit ask): /mos:brain-derive is spine-wired in the generated registry', function () {
      const regPath = path.join(REPO, 'data', 'connector-registry.json');
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      const entry = (reg.connectors || []).find(function (c) {
        return c && c.surface === '/mos:brain-derive';
      });
      assert.ok(entry, '/mos:brain-derive must be present in connector-registry.json');
      assert.equal(entry.connects_to_spine, true,
        'the explicit-ask surface must connect to the spine');
      assert.equal(entry.reach_id, 'brain_consult',
        'the derive surface reaches brain_consult');
      assert.equal(entry.posture, 'hold');
      assert.ok(Array.isArray(entry.sensor_triggers) && entry.sensor_triggers.indexOf('SENS-03') !== -1,
        'SENS-03 is the sensor the drain already fires for a dispatched derivation');
    });

    await t('ARM 3 source fence: the command frontmatter declares the wiring', function () {
      const src = fs.readFileSync(path.join(REPO, 'commands', 'brain-derive.md'), 'utf8');
      const m = /^connector:\r?\n((?:[ \t]+.*\r?\n)+)/m.exec(src);
      assert.ok(m, 'brain-derive.md must carry a connector: block');
      const block = m[1];
      assert.ok(/excluded:\s*false/.test(block), 'connector.excluded must be false');
      assert.ok(/connects_to_spine:\s*true/.test(block), 'connector.connects_to_spine must be true');
      assert.ok(/reach_id:\s*brain_consult/.test(block), 'connector.reach_id must be brain_consult');
      assert.ok(/posture:\s*hold/.test(block), 'connector.posture must be hold');
      assert.ok(/sensor_triggers:\s*\[SENS-03\]/.test(block), 'connector.sensor_triggers must be [SENS-03]');
      // The flip must not open a Canon Part 11 R16 shape-declaration gap.
      assert.ok(/^hitl_shape:\s*"F\.0"/m.test(src), 'hitl_shape must still be declared');
      assert.ok(/^hitl_why:/m.test(src), 'hitl_why must still be declared');
    });

    // ==================================================================
    // Hermetic-fence roll-up.
    // ==================================================================
    await t('hermetic fence: every room this suite touched lives under os.tmpdir()', function () {
      for (const r of tmpRooms) {
        const real = fs.realpathSync(r);
        assert.ok(real === TMP_REAL || real.startsWith(TMP_REAL + path.sep),
          'room escaped the tmpdir fence: ' + real);
      }
      const home = process.env.HOME || os.homedir();
      const live = path.join(home, 'MindrianRooms');
      for (const r of tmpRooms) {
        assert.ok(fs.realpathSync(r).indexOf(live) !== 0,
          'a room resolved inside the live room tree: ' + r);
      }
    });

    await t('no em-dash or en-dash in this suite', function () {
      const EM = String.fromCharCode(0x2014);
      const EN = String.fromCharCode(0x2013);
      const src = fs.readFileSync(__filename, 'utf8');
      assert.ok(src.indexOf(EM) === -1, 'em-dash found');
      assert.ok(src.indexOf(EN) === -1, 'en-dash found');
    });
  } finally {
    for (const k of Object.keys(envSaved)) {
      if (envSaved[k] === undefined) delete process.env[k];
      else process.env[k] = envSaved[k];
    }
    for (const r of tmpRooms) {
      try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write(
    '\n245-02 trigger-arms: ' + passed + ' passed, ' + failed + ' failed'
    + ' (ARM 1 governing_thought_changed, ARM 2 age_exceeded ->'
    + ' session_start_stale, ARM 3 explicit ask spine-wired)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  process.stdout.write('FATAL: ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
