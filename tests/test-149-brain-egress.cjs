'use strict';
// Phase 149-03 Task 1 (GAM-06) -- the adversarial Brain-egress test.
// ========================================================================
// THE constitutional seal of Phase 149: buildArtifactBrainPacket (Plan 03
// Task 2) is the ONLY projection a Brain query about a planning artifact may
// carry. It MUST emit generic handles ONLY (phase id, artifact_type enum,
// requirement id handles, status enum, optional sha256 hashes) -- NEVER the
// artifact body, the raw file path, filenames-as-content, or any node prose.
//
// This test seeds the local graph with POISONED planning_artifact + requirement
// nodes whose path + properties carry FORBIDDEN_SUBSTRINGS (raw prose, an email,
// an absolute /home/jsagi/secret/ path, an injection token), builds the packet
// for that phase, and asserts the serialized packet (JSON.stringify) contains
// NONE of the FORBIDDEN_SUBSTRINGS. Only generic handles survive.
//
// It ALSO greps the buildArtifactBrainPacket source AND the reconcile-runner
// source for forbidden requires (brain-client / node:http / node:https / http /
// https) and forbidden calls (fetch / http.request / https.request / .get) --
// the Canon Part 8 zero-egress structural floor.
//
// RED-by-design until Plan 03 Task 2 lands lib/core/planning/artifact-brain-packet.cjs.
//
// Mirrors tests/test-feynman-timeline-canon-part-9-invariant.cjs (the
// adversarial-seed + forbidden-require/call structure) AND the packet.cjs
// sha256-by-default leak-safe discipline.
//
// NO em-dashes anywhere (CLAUDE.md hard rule). Dash codepoints referenced via
// String.fromCharCode so this file stays greppably clean against the dash sweep.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-149-brain-egress.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------- Files under the structural floor sweep ----------

const FILES_TO_SCAN = [
  'lib/core/planning/artifact-brain-packet.cjs',
  'lib/core/planning/reconcile-runner.cjs',
];

const FORBIDDEN_REQUIRES = [
  /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/,
  /require\s*\(\s*['"]node:http['"]\s*\)/,
  /require\s*\(\s*['"]node:https['"]\s*\)/,
  /require\s*\(\s*['"]http['"]\s*\)/,
  /require\s*\(\s*['"]https['"]\s*\)/,
];

const FORBIDDEN_CALLS = [
  /\bfetch\s*\(/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bhttp\.get\s*\(/,
  /\bhttps\.get\s*\(/,
];

// The poison strings the packet must NEVER carry. Each is planted into the
// node properties / path / source_path so a packet that reads prose leaks one.
const FORBIDDEN_SUBSTRINGS = [
  'SECRET ARTIFACT PROSE',
  'leak@example.com',
  '/home/jsagi/secret/',
  '${INJECT}',
];

// ---------- Schema + poisoned-seed helpers ----------

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

// Seed a planning_artifact node by hand (NOT via the writer) so we can plant
// poison strings into EVERY field the writer would normally keep clean. This is
// the adversarial part: even if a future writer regression let prose into the
// node, the PACKET must still strip it.
function seedPoisonedArtifact(db, phase, artifactType, createdAt) {
  const nodeId = 'planning_artifact:' + phase + ':' + artifactType;
  const props = JSON.stringify({
    phase: phase,
    artifact_type: artifactType,
    // Poison: a raw absolute path that must never reach the wire.
    path: '/home/jsagi/secret/' + phase + '-' + artifactType + '.md',
    status: 'present',
    // Poison: raw body prose + an email that must never reach the wire.
    body: 'SECRET ARTIFACT PROSE leak@example.com ${INJECT}',
  });
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, source_section, created_by, ' +
    'confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, 'planning_artifact', ?, ?, ?, 'system', 1.0, 'confirmed', ?, ?)"
  ).run(
    nodeId,
    props,
    // Poison: source_path + source_section carry secret strings too.
    '/home/jsagi/secret/' + phase + ':' + artifactType,
    'SECRET ARTIFACT PROSE',
    createdAt,
    createdAt
  );
  return nodeId;
}

function seedPoisonedRequirement(db, reqId, phase, createdAt) {
  const nodeId = 'requirement:' + reqId;
  const props = JSON.stringify({
    req_id: reqId,
    phase: phase,
    // Poison: requirement nodes must also never carry prose to the wire.
    note: 'SECRET ARTIFACT PROSE leak@example.com',
  });
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, source_section, created_by, ' +
    'confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, 'requirement', ?, ?, ?, 'system', 1.0, 'confirmed', ?, ?)"
  ).run(
    nodeId,
    props,
    '/home/jsagi/secret/' + phase + ':' + reqId,
    'SECRET ARTIFACT PROSE',
    createdAt,
    createdAt
  );
  return nodeId;
}

function seedEdge(db, sourceId, targetId, edgeType) {
  db.prepare(
    'INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
  ).run(sourceId, targetId, edgeType, JSON.stringify({}));
}

// ---------- Test 1 + 2: forbidden require + call grep sweep ----------

function testForbiddenRequiresAndCalls() {
  for (const rel of FILES_TO_SCAN) {
    const abs = path.join(REPO_ROOT, rel);
    const src = fs.readFileSync(abs, 'utf8'); // throws if absent -> RED-by-design
    for (const rx of FORBIDDEN_REQUIRES) {
      assert.equal(
        rx.test(src), false,
        rel + ' must not match forbidden require: ' + rx
      );
    }
    for (const rx of FORBIDDEN_CALLS) {
      assert.equal(
        rx.test(src), false,
        rel + ' must not match forbidden call: ' + rx
      );
    }
  }
}

// ---------- Test 3: adversarial seed -- zero FORBIDDEN_SUBSTRINGS in the packet ----------

function testAdversarialSeedForbidden() {
  // require here (not at top) so Test 1+2's grep sweep is what reports the
  // module-absent RED first, with a clear message, before this require throws.
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'planning', 'artifact-brain-packet.cjs'));
  assert.equal(typeof mod.buildArtifactBrainPacket, 'function',
    'artifact-brain-packet.cjs must export buildArtifactBrainPacket');

  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW = 1714694400000;

  const phase = '149-gsd-planning-artifacts';
  // Seed the full lineage shape the reconcile would produce, all POISONED.
  const specId = seedPoisonedArtifact(db, phase, 'SPEC', NOW - 1000);
  const ctxId = seedPoisonedArtifact(db, phase, 'CONTEXT', NOW - 2000);
  const planId = seedPoisonedArtifact(db, phase, 'PLAN', NOW - 3000);
  const verId = seedPoisonedArtifact(db, phase, 'VERIFICATION', NOW - 4000);
  const reqA = seedPoisonedRequirement(db, 'GAM-06', phase, NOW - 5000);
  const reqB = seedPoisonedRequirement(db, 'GAM-04', phase, NOW - 6000);

  // Lineage edges (requirement-as-source INFORMS, file FEEDS_INTO, VALIDATES).
  seedEdge(db, specId, ctxId, 'FEEDS_INTO');
  seedEdge(db, ctxId, planId, 'FEEDS_INTO');
  seedEdge(db, reqA, specId, 'INFORMS');
  seedEdge(db, reqA, planId, 'INFORMS');
  seedEdge(db, reqB, specId, 'INFORMS');
  seedEdge(db, verId, reqA, 'VALIDATES');
  seedEdge(db, verId, reqB, 'VALIDATES');

  const packet = mod.buildArtifactBrainPacket(db, { phase: phase, artifactType: 'SPEC' });
  assert.ok(packet && typeof packet === 'object', 'packet must be an object');

  const serialized = JSON.stringify(packet);

  for (const sub of FORBIDDEN_SUBSTRINGS) {
    assert.equal(
      serialized.indexOf(sub), -1,
      'packet must not contain forbidden substring: ' + sub + ' -- packet=' + serialized.slice(0, 400)
    );
  }

  // Positive floor: the packet MUST carry the generic handles so it is useful.
  assert.equal(packet.phase, phase, 'packet.phase must be the generic phase id handle');
  assert.ok(Array.isArray(packet.requirement_ids), 'packet.requirement_ids must be an array');
  assert.ok(
    packet.requirement_ids.indexOf('GAM-06') !== -1 && packet.requirement_ids.indexOf('GAM-04') !== -1,
    'packet.requirement_ids must carry the generic requirement id handles'
  );
  assert.ok(Array.isArray(packet.artifact_types), 'packet.artifact_types must be an array');
  assert.ok(
    packet.artifact_types.indexOf('SPEC') !== -1,
    'packet.artifact_types must carry the artifact_type enum handle'
  );

  // No em-dash / en-dash in the serialized packet (CLAUDE.md hard rule).
  const EMDASH = String.fromCharCode(0x2014);
  const ENDASH = String.fromCharCode(0x2013);
  assert.equal(serialized.indexOf(EMDASH), -1, 'packet must contain no em-dashes');
  assert.equal(serialized.indexOf(ENDASH), -1, 'packet must contain no en-dashes');

  db.close();
}

// ---------- Test 4: regression -- the packet module reads ONLY via navigation.cjs ----------

function testPacketReadsViaNavigation() {
  const abs = path.join(REPO_ROOT, 'lib', 'core', 'planning', 'artifact-brain-packet.cjs');
  const src = fs.readFileSync(abs, 'utf8');
  assert.match(
    src,
    /require\s*\(\s*['"]\.\.\/navigation\.cjs['"]/,
    'artifact-brain-packet.cjs must require ../navigation.cjs (the Phase 109 chokepoint)'
  );
  // It must NOT require node:sqlite directly (no room.db open of its own).
  assert.equal(
    /require\s*\(\s*['"]node:sqlite['"]\s*\)/.test(src), false,
    'artifact-brain-packet.cjs must not require node:sqlite directly (substrate guard)'
  );
}

// ---------- Run ----------

testForbiddenRequiresAndCalls();
testAdversarialSeedForbidden();
testPacketReadsViaNavigation();
process.stdout.write('PASS test-149-brain-egress.cjs (GAM-06: zero artifact prose in the Brain packet)\n');
process.exit(0);
