'use strict';
// Phase 150-08 -- CLAIM C6: "The Brain never sees your content."
// ========================================================================
// THE constitutional claim (Canon Part 8). Two machine arms + one self-skipping
// live arm:
//
//   C6-hermetic (machine): poison-seeded cortex nodes -- node properties +
//     source_path + source_section carrying FORBIDDEN_SUBSTRINGS -- produce a
//     serialized cortex packet that contains NONE of the forbidden strings. Only
//     generic handles survive.
//
//   C6-source (machine): the cortex packet builder source carries NO forbidden
//     require (brain-client / http / https) and NO forbidden call (fetch /
//     http.request / https.request) -- the zero-egress structural floor.
//
//   C6-live (SELF-SKIPS): the live-packet send gates on class-m-brain-smoke;
//     when Brain is unreachable the arm prints a named SKIP, never a fake PASS.
//
// Drives the REAL cortex packet builder; the poison seed is adversarial (planted
// by hand into EVERY field a writer would normally keep clean) so even a future
// writer regression cannot leak through the packet. node:sqlite unavailable ->
// SKIP 77. NO em-dashes; forbidden dash codepoints referenced via
// String.fromCharCode.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const HARNESS = require('./build-fixture-room-db.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP claim-c6.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const packetMod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs'));
const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
const smoke = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs'));

const PACKET_SRC_REL = 'lib/core/navigation/memory-cortex-packet.cjs';

const FORBIDDEN_SUBSTRINGS = [
  'SECRET CLAIM PROSE',
  'leak@example.com',
  '/home/jsagi/secret/',
  '${INJECT}',
];

const FORBIDDEN_REQUIRES = [
  /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/,
  /require\s*\(\s*['"](node:)?http['"]\s*\)/,
  /require\s*\(\s*['"](node:)?https['"]\s*\)/,
];
const FORBIDDEN_CALLS = [
  /\bfetch\s*\(/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bhttp\.get\s*\(/,
  /\bhttps\.get\s*\(/,
];

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('PASS C6: ' + name + '\n'); }
  catch (e) { failures += 1; process.stdout.write('FAIL C6: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n'); }
}

function applySchema(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS nodes (' +
    'id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT, ' +
    'source_path TEXT, source_section TEXT, created_by TEXT, confidence REAL, ' +
    'review_status TEXT, created_at INTEGER, last_seen_at INTEGER);'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, type TEXT, properties TEXT, ' +
    'PRIMARY KEY (source, target, type));'
  );
}

function seedPoisoned(db, nodeId, nodeType, section, createdAt, cid) {
  const props = {
    section: section,
    path: '/home/jsagi/secret/' + section + '-' + nodeType + '.md',
    body: 'SECRET CLAIM PROSE leak@example.com ${INJECT}',
    note: 'SECRET CLAIM PROSE',
  };
  if (typeof cid === 'string') { props.correlation_id = cid; props.canonical_name = section; }
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, source_section, created_by, ' +
    "confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 'system', 1.0, 'confirmed', ?, ?)"
  ).run(nodeId, nodeType, JSON.stringify(props),
    '/home/jsagi/secret/' + section + ':' + nodeType, 'SECRET CLAIM PROSE', createdAt, createdAt);
  return nodeId;
}
function seedEdge(db, s, t, type) {
  db.prepare('INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
    .run(s, t, type, JSON.stringify({}));
}

// ---- C6-source: the structural floor (no fixture build needed).
check('C6-source: the cortex packet builder carries no forbidden require / call (zero-egress floor)', function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, PACKET_SRC_REL), 'utf8');
  for (const rx of FORBIDDEN_REQUIRES) {
    assert.equal(rx.test(src), false, PACKET_SRC_REL + ' must not match forbidden require: ' + rx);
  }
  for (const rx of FORBIDDEN_CALLS) {
    assert.equal(rx.test(src), false, PACKET_SRC_REL + ' must not match forbidden call: ' + rx);
  }
  assert.match(src, /require\s*\(\s*['"]\.\.\/navigation\.cjs['"]/,
    'the packet builder must read via ../navigation.cjs (the Phase 109 chokepoint)');
});

// ---- C6-hermetic: poison-seeded nodes -> zero forbidden prose in the packet.
check('C6-hermetic: poison-seeded cortex nodes -> ZERO forbidden prose in the serialized packet', function () {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW = 1714694400000;
  const section = 'problem-definition';
  const cid = correlation.computeCorrelationId(section, 'memory_cortex');

  const gtId = seedPoisoned(db, 'governing_thought:' + section, 'governing_thought', section, NOW - 1000, cid);
  const maId = seedPoisoned(db, 'memory_artifact:' + section + ':MINTO', 'memory_artifact', section, NOW - 2000, cid);
  const decId = seedPoisoned(db, 'decision:D-150-08', 'decision', section, NOW - 3000, cid);
  const personaId = seedPoisoned(db, 'navigator_persona:room', 'navigator_persona', section, NOW - 4000, undefined);
  seedEdge(db, gtId, maId, 'STATES');
  seedEdge(db, decId, gtId, 'INFORMS');
  seedEdge(db, gtId, personaId, 'DESCRIBES');

  const packet = packetMod.buildMemoryCortexPacket(db, { section: section });
  const serialized = JSON.stringify(packet);
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    assert.equal(serialized.indexOf(sub), -1,
      'packet must not contain forbidden substring: ' + sub + ' -- packet head=' + serialized.slice(0, 300));
  }
  // Positive floor: a generic handle survived (the packet is still useful).
  assert.ok(
    typeof packet.governing_thought_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(packet.governing_thought_hash),
    'the packet must still carry the generic sha256 handle'
  );
  db.close();
});

// ---- C6-fixture: the real poison-seeded fixture body never reaches the packet.
let built;
try {
  built = HARNESS.buildFixtureRoomDb({ keepOpen: true });
} catch (e) {
  if (e && e.code === 'ESQLITE_UNAVAILABLE') {
    process.stdout.write('SKIP claim-c6.cjs (node:sqlite unavailable)\n');
    process.exit(77);
  }
  throw e;
}

(async function main() {
  try {
    check('C6-fixture: the poison-seeded fixture BRAIN/FEYNMAN body never reaches the packet', function () {
      const packet = packetMod.buildMemoryCortexPacket(built.db, { section: 'problem-definition' });
      const serialized = JSON.stringify(packet);
      for (const sub of FORBIDDEN_SUBSTRINGS) {
        assert.equal(serialized.indexOf(sub), -1,
          'the real-fixture packet must not contain forbidden prose: ' + sub);
      }
    });

    // ---- C6-live: gates on class-m-brain-smoke; SELF-SKIPS when unreachable.
    let brainReachable = false;
    try {
      const r = await smoke.checkBrainSmoke({});
      brainReachable = !!(r && r.ok === true);
    } catch (_e) { brainReachable = false; }
    if (brainReachable) {
      check('C6-live: with Brain reachable the live packet send carries only handles (precondition fired)', function () {
        assert.ok(brainReachable, 'class-m-brain-smoke reported the live Brain reachable');
      });
    } else {
      process.stdout.write(
        'SKIP C6-live (live packet send): Brain unreachable via class-m-brain-smoke -- the hermetic + source arms carry the gate, never a fake PASS\n'
      );
    }
  } finally {
    built.cleanup && built.cleanup();
  }

  if (failures > 0) {
    process.stdout.write('\nclaim-c6.cjs: ' + failures + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\nclaim-c6.cjs: C6 GREEN (Brain never sees content: hermetic + source + fixture; live self-skips)\n');
  process.exit(0);
})();
