'use strict';
// Phase 110-05 Task 1: D-11 per-job in/out validation suite (PACKET-110-03 + -04 + -07 + -08).
//
// For all 12 D-02 jobs prove, end-to-end through brain-client.sendPacket():
//   (a) a well-formed `in` packet (built via navigation.buildBrainPacket) validates and
//       sendPacket proceeds past the in-gate (with the __transport seam returning a
//       known-good `out`, the result comes back parsed);
//   (b) a malformed `in` packet (an extra top-level `transcript` field, which trips the
//       schema's additionalProperties:false at the wire) throws an Error whose message
//       starts `brain packet rejected for job "<job>"` AND when opts.db is passed a
//       `brain_packet_rejected` memory_event row is written;
//   (c) an off-spec Brain `out` returns { advice: null, reason: 'response_schema_invalid' },
//       NEVER throws, NEVER partial-ingests, AND when opts.db is passed a
//       `brain_response_rejected` row is written;
//   (d) a packet with `origin` other than the closed allowlist throws.
//
// Plus three non-per-job sub-blocks:
//   - origin: 'test_fixture' env-gate: throws when MINDRIAN_TEST_MODE != '1'; accepted
//     when MINDRIAN_TEST_MODE === '1' (save+restore the env var).
//   - privacy-mode "config caps, never raises": buildBrainPacket honors per-call
//     privacyMode 'allow_filenames'; but the schema's $defs[job].in.properties.privacy_mode
//     is { const: 'local_summary_only' } for every shipped job; sendPacket throws
//     `brain packet rejected`.
//   - dual-path: _warnLegacyOnce twice -> console.warn fires exactly once,
//     brain_legacy_path_used logged exactly once.
//
// Pattern: matches tests/test-navigation-packet-part8-leak.cjs (CJS, node:assert/strict,
// no Mocha, no Jest, zero new npm dependencies). The __transport seam is brain-client's
// test hook for replacing callTool (no network).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const brainClient = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs'));

const D02_JOBS = [
  'select_methodology',
  'suggest_next_move',
  'detect_contradiction',
  'summarize_neighborhood',
  'classify_room_budding',
  'rank_assumptions',
  'generate_feynman_explanation',
  'strengthen_minto',
  'prepare_investor_brief',
  'opportunity_react',
  'opportunity_reflect',
  'opportunity_rank',
];

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-validation-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) "
    + "VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)"
  );
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  insN.run('decision:focus', 'decision', JSON.stringify({ summary: 'short focus' }), 'fixture', 0.7, 'confirmed', nowMs, nowMs, 'design');
  // A couple neighbors so local_graph_summary has content.
  insN.run('claim:c1', 'claim', JSON.stringify({ summary: 'short claim' }), 'fixture', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('assumption:a1', 'assumption', JSON.stringify({ claim: 'short' }), 'fixture', 0.5, 'proposed', nowMs, nowMs, 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('decision:focus', 'claim:c1', 'INFORMS');
  insE.run('decision:focus', 'assumption:a1', 'ASSUMES');
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function defaultMocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

// A known-good Brain out shape. BrainResponse has additionalProperties:false on each
// suggestion item -- only suggestion_index/job_id/summary/methodology/body/confidence/
// graph_updates_proposed are allowed. We pick a minimal but realistic subset.
function goodOutTransport() {
  return async function () {
    return [{
      type: 'text',
      text: JSON.stringify({
        job_id: 'jobid-' + Math.random().toString(16).slice(2, 10),
        suggestions: [
          { summary: 'do X', methodology: 'JTBD', confidence: 0.8 },
        ],
      }),
    }];
  };
}

// A clearly off-spec Brain out -- top-level has fields the BrainResponse schema rejects
// under additionalProperties:false (so the out-validator fires, NOT the parse fallback).
function offSpecOutTransport() {
  return async function () {
    return [{
      type: 'text',
      text: JSON.stringify({ totally: 'off-spec', extra: 'field' }),
    }];
  };
}

async function run() {
  let assertions = 0;

  // Defensive: clear any prior lazy state from earlier-in-process tests.
  brainClient._test._resetSchema();
  brainClient._test._setLegacyWarned(false);

  for (const job of D02_JOBS) {
    const { tmp, db } = makeRoom();
    try {
      const goodPacket = navigation.buildBrainPacket(db, job, 'decision:focus', {
        _mocks: defaultMocks(),
        roomId: 'test',
      });
      ok(goodPacket && goodPacket.job === job, 'job ' + job + ': buildBrainPacket returned a packet for the job');
      assertions++;

      // (a) valid in -> good out via __transport returns the parsed object.
      const r1 = await brainClient.sendPacket(goodPacket, {
        db,
        __transport: goodOutTransport(),
      });
      ok(r1 && Array.isArray(r1.suggestions), 'job ' + job + ': valid in + good out returns parsed object with suggestions array');
      assertions++;

      // (b) malformed in (extra top-level transcript) -> throws + logs brain_packet_rejected.
      const badPacket = Object.assign({}, goodPacket, { transcript: 'SECRET RAW LEAK ' + 'x'.repeat(200) });
      let threwIn = false;
      let inMsg = '';
      try {
        await brainClient.sendPacket(badPacket, { db });
      } catch (e) {
        threwIn = true;
        inMsg = String(e && e.message || '');
      }
      ok(threwIn, 'job ' + job + ': malformed in throws');
      assertions++;
      ok(inMsg.indexOf('brain packet rejected for job "' + job + '"') === 0,
        'job ' + job + ': malformed in throws with the expected D-07 message; got: ' + inMsg);
      assertions++;
      const rejCount = db.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND id LIKE 'memory_event:brain_packet_rejected:%'"
      ).get().c;
      ok(rejCount >= 1, 'job ' + job + ': brain_packet_rejected memory_event row logged');
      assertions++;

      // (c) off-spec out -> { advice: null, reason: 'response_schema_invalid' }, no throw,
      //     logs brain_response_rejected.
      let r3;
      let threwOut = false;
      try {
        r3 = await brainClient.sendPacket(goodPacket, {
          db,
          __transport: offSpecOutTransport(),
        });
      } catch (e) {
        threwOut = true;
      }
      ok(!threwOut, 'job ' + job + ': off-spec out NEVER throws (degrade soft)');
      assertions++;
      ok(r3 && r3.advice === null && r3.reason === 'response_schema_invalid',
        'job ' + job + ': off-spec out returns { advice: null, reason: response_schema_invalid }; got: ' + JSON.stringify(r3));
      assertions++;
      const respCount = db.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND id LIKE 'memory_event:brain_response_rejected:%'"
      ).get().c;
      ok(respCount >= 1, 'job ' + job + ': brain_response_rejected memory_event row logged');
      assertions++;

      // (d) bad origin -> throws.
      const forgedOriginPacket = Object.assign({}, goodPacket, { origin: 'forged' });
      let threwOrigin = false;
      try {
        await brainClient.sendPacket(forgedOriginPacket, { db });
      } catch (_) {
        threwOrigin = true;
      }
      ok(threwOrigin, 'job ' + job + ': forged origin throws (D-08 layer 3)');
      assertions++;

      db.close();
    } finally {
      cleanup(tmp);
    }
  }

  // ---- sub-block 1: test_fixture origin env-gate (not per-job).
  {
    const { tmp, db } = makeRoom();
    const prevEnv = process.env.MINDRIAN_TEST_MODE;
    try {
      const basePacket = navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
        _mocks: defaultMocks(),
        roomId: 'test',
      });
      const tfPacket = Object.assign({}, basePacket, { origin: 'test_fixture' });

      delete process.env.MINDRIAN_TEST_MODE;
      let threwNoEnv = false;
      let noEnvMsg = '';
      try {
        await brainClient.sendPacket(tfPacket, { db });
      } catch (e) {
        threwNoEnv = true;
        noEnvMsg = String(e && e.message || '');
      }
      ok(threwNoEnv, 'test_fixture origin throws without MINDRIAN_TEST_MODE=1');
      assertions++;
      ok(/test_fixture/.test(noEnvMsg) && /MINDRIAN_TEST_MODE/.test(noEnvMsg),
        'test_fixture origin throw message names the env gate; got: ' + noEnvMsg);
      assertions++;

      process.env.MINDRIAN_TEST_MODE = '1';
      let threwOnOriginInEnv = false;
      let okResult = null;
      try {
        okResult = await brainClient.sendPacket(tfPacket, {
          db,
          __transport: goodOutTransport(),
        });
      } catch (e) {
        const msg = String(e && e.message || '');
        // Only an origin-related throw matters here; anything else is unrelated noise
        // for this sub-block.
        if (/origin/.test(msg)) threwOnOriginInEnv = true;
      }
      ok(!threwOnOriginInEnv,
        'test_fixture origin is NOT rejected when MINDRIAN_TEST_MODE=1');
      assertions++;
      ok(okResult && Array.isArray(okResult.suggestions),
        'test_fixture origin with valid env returns a parsed Brain out');
      assertions++;

      db.close();
    } finally {
      if (prevEnv === undefined) delete process.env.MINDRIAN_TEST_MODE;
      else process.env.MINDRIAN_TEST_MODE = prevEnv;
      cleanup(tmp);
    }
  }

  // ---- sub-block 2: privacy-mode "config caps, never raises".
  //
  // buildBrainPacket honors a per-call privacyMode override (it sets packet.privacy_mode
  // to 'allow_filenames'); but every shipped job's $def.in.properties.privacy_mode is
  // { const: 'local_summary_only' }; sendPacket's ajv in-validator must refuse.
  {
    const { tmp, db } = makeRoom();
    try {
      const capPacket = navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', {
        _mocks: defaultMocks(),
        roomId: 'test',
        privacyMode: 'allow_filenames',
      });
      equal(capPacket.privacy_mode, 'allow_filenames',
        'buildBrainPacket honored the per-call privacyMode override (allow_filenames)');
      assertions++;

      let threwCap = false;
      let capMsg = '';
      try {
        await brainClient.sendPacket(capPacket, { db });
      } catch (e) {
        threwCap = true;
        capMsg = String(e && e.message || '');
      }
      ok(threwCap, 'config-caps: a packet whose privacy_mode exceeds the job-declared const is refused');
      assertions++;
      ok(/brain packet rejected/.test(capMsg),
        'config-caps: refusal carries the D-07 "brain packet rejected" message; got: ' + capMsg);
      assertions++;

      db.close();
    } finally {
      cleanup(tmp);
    }
  }

  // ---- sub-block 3: dual-path _warnLegacyOnce -- warn once, log once.
  {
    const { tmp, db } = makeRoom();
    try {
      brainClient._test._setLegacyWarned(false);
      const baselineLegacy = db.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND id LIKE 'memory_event:brain_legacy_path_used:%'"
      ).get().c;
      let warnCount = 0;
      const origWarn = console.warn;
      console.warn = function () { warnCount += 1; };
      try {
        brainClient._warnLegacyOnce(db);
        brainClient._warnLegacyOnce(db);
      } finally {
        console.warn = origWarn;
      }
      equal(warnCount, 1, '_warnLegacyOnce fires console.warn exactly once per session');
      assertions++;
      const legacyCount = db.prepare(
        "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND id LIKE 'memory_event:brain_legacy_path_used:%'"
      ).get().c;
      equal(legacyCount - baselineLegacy, 1,
        'brain_legacy_path_used memory_event row logged exactly once across the two calls');
      assertions++;

      // Restore so any later test in the same process is not poisoned.
      brainClient._test._setLegacyWarned(false);
      db.close();
    } finally {
      cleanup(tmp);
    }
  }

  process.stdout.write('test-brain-packet-validation-per-job: PASS (' + assertions + ' assertions)\n');
}

run().catch(function (e) {
  process.stderr.write('FAIL: ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(1);
});
