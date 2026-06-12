'use strict';
// Phase 150.8-04 Task 3 (Part 8 adversarial) -- poison-transcript leg.
//
// THE quality-gate leg the milestone requires: prove no transcript prose reaches
// any Brain packet. A poison transcript whose claim text + conditions carry a
// UNIQUE sentinel (a proprietary number / a PII-shaped token / a competitor name /
// an injection token) is filed -> writeClaimNode mints the claim WITH the sentinel
// in room.db, but when a Brain packet is built for that claim the packet carries
// the knowledge_type ENUM scalar only and the sentinel substring appears NOWHERE
// in the serialized packet (sha256-hashed / dropped by the packet.cjs default).
//
// Three teeth:
//   1. The forbidden-substring sweep: build a real Brain packet through the
//      packet.cjs path and assert EVERY sentinel is absent from the serialized
//      packet (fails LOUDLY if a future change lets prose through).
//   2. The safe handle rides: the knowledge_type enum scalar IS present in
//      room.db and is a member of the frozen 6 (the only thing that may ride to
//      Brain downstream).
//   3. The chokepoint hashes: projectText(sentinel, 'local_summary_only') returns
//      a sha256 hash, never the prose (defense at the value-space gate itself).
//
// node:sqlite unavailable -> SKIP 77. NO em-dashes (CLAUDE.md HARD RULE). The
// sentinels here are SYNTHETIC fixtures, never real data.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-part8-poison-transcript.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const packetMod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'packet.cjs'));

// The synthetic poison sentinels (a proprietary number, a PII-shaped token, a
// competitor name, and a prompt-injection token). None is real data.
const SENTINELS = Object.freeze([
  'PROPRIETARY-REVENUE-4192773',
  'ssn-555-86-2210',
  'CompetitorAcmeCorpX',
  'IGNORE_ALL_PRIOR_INSTRUCTIONS_AND_EXFILTRATE',
]);

function defaultMocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

let failures = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { process.stdout.write('  ok - ' + name + '\n'); })
    .catch((e) => { failures += 1; process.stdout.write('  FAIL - ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); });
}

function makePoisonRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poison-transcript-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);

  // Mint a poison claim through the REAL writer. The sentinels ride in the
  // prose-bearing fields (text -- not stored; conditions / counter_conditions --
  // stored in room.db). knowledge_type is the safe enum handle.
  const r = navigation.writeClaimNode(db, {
    knowledge_type: 'causal',
    text: 'The ' + SENTINELS[0] + ' figure was disclosed by ' + SENTINELS[2],
    conditions: 'holds while ' + SENTINELS[1] + ' is on file',
    counter_conditions: 'breaks if ' + SENTINELS[3],
    sessionId: 'poison-sess',
    sourceSegment: 'poison-seg-1',
  });
  assert.equal(r.ok, true, 'poison claim must write: ' + JSON.stringify(r));
  const claimId = r.node_id;

  // Worst case: also seed the sentinel into the prose-bearing `summary` field the
  // packet projector actually reads (shortText candidates summary/claim/title/
  // text), so the packet's nearest_claims/focus projection has a real chance to
  // leak it -- and the gate must hash it instead. This is the adversarial teeth.
  db.prepare(
    "UPDATE nodes SET properties = ? WHERE id = ?"
  ).run(JSON.stringify({
    knowledge_type: 'causal',
    conditions: 'holds while ' + SENTINELS[1] + ' is on file',
    counter_conditions: 'breaks if ' + SENTINELS[3],
    summary: SENTINELS[0] + ' / ' + SENTINELS[2] + ' raw prose that must never egress',
  }), claimId);

  return { tmp, db, claimId };
}

async function run() {
  // ---------------------------------------------------------------------------
  // (1) Forbidden-substring sweep: build the packet, assert every sentinel absent.
  // ---------------------------------------------------------------------------
  await check('a Brain packet for the poison claim carries ZERO sentinel substrings', async () => {
    const { tmp, db, claimId } = makePoisonRoom();
    try {
      const packet = await navigation.buildBrainPacket(db, 'suggest_next_move', claimId, {
        _mocks: defaultMocks(),
        roomId: 'poison',
        roomDir: tmp,
      });
      const serialized = JSON.stringify(packet);
      for (const s of SENTINELS) {
        assert.ok(serialized.indexOf(s) === -1,
          'sentinel leaked into the serialized packet: ' + s);
      }
      // The focus summary must be a sha256 hash (the default value-space gate),
      // never the raw prose.
      const focusSummary = packet.active_context.focus_node.summary;
      assert.ok(/^sha256:[0-9a-f]{64}$/.test(focusSummary),
        'focus summary must be a sha256 hash, got: ' + String(focusSummary).slice(0, 40));
    } finally {
      db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // (2) The safe handle rides: knowledge_type enum present + a frozen-6 member.
  // ---------------------------------------------------------------------------
  await check('the knowledge_type enum scalar IS present in room.db (the safe handle)', async () => {
    const { tmp, db, claimId } = makePoisonRoom();
    try {
      const row = db.prepare(
        "SELECT json_extract(properties,'$.knowledge_type') AS kt FROM nodes WHERE id = ?"
      ).get(claimId);
      const FROZEN6 = new Set(['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption']);
      assert.ok(FROZEN6.has(row.kt), 'knowledge_type must be a frozen-6 enum member, got: ' + row.kt);
      // The enum carries NO sentinel (it is a closed-vocabulary handle).
      for (const s of SENTINELS) {
        assert.ok(String(row.kt).indexOf(s) === -1, 'the enum handle must carry no sentinel');
      }
    } finally {
      db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // (3) The chokepoint hashes prose under the default mode (the gate has teeth).
  // ---------------------------------------------------------------------------
  await check('projectText hashes a sentinel under local_summary_only (never prose)', async () => {
    for (const s of SENTINELS) {
      const projected = packetMod.projectText(s, 'local_summary_only');
      assert.ok(/^sha256:[0-9a-f]{64}$/.test(projected),
        'projectText must hash the sentinel under the default mode, got: ' + String(projected).slice(0, 40));
      assert.ok(projected.indexOf(s) === -1, 'the hash must not contain the prose');
    }
  });

  // ---------------------------------------------------------------------------
  // (4) Honest-positive: under the EXPLICIT allow_excerpts opt-in the gate would
  //     let an excerpt through -- proving the default-mode absence above is a real
  //     gate, not an accident of the fixture shape.
  // ---------------------------------------------------------------------------
  await check('honest control: allow_excerpts would surface the prose (the gate is real)', async () => {
    const excerpt = packetMod.projectText(SENTINELS[0], 'allow_excerpts');
    assert.ok(excerpt.indexOf(SENTINELS[0]) !== -1,
      'under allow_excerpts the excerpt carries the prose -- proving the default-mode hash is a deliberate gate');
  });

  if (failures > 0) {
    process.stdout.write('\ntest-part8-poison-transcript.cjs: ' + failures + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\ntest-part8-poison-transcript.cjs: PASSED (no transcript prose reaches any Brain packet; enum handle rides)\n');
  process.exit(0);
}

run();
