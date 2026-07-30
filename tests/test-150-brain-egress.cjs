'use strict';
// Phase 150-02 Task 1 (MEM-04) -- the adversarial Brain-egress test.
// ========================================================================
// THE constitutional seal of Phase 150: buildMemoryCortexPacket (Plan 02
// Task 2) is the ONLY projection a Brain query about the navigator's memory
// cortex may carry. It MUST emit generic handles ONLY (governing_thought_hash
// sha256, correlation_id, problem_type/complexity/persona enums, current_
// framework handle, stage, gap_count) -- NEVER the raw governing-thought prose,
// the memory MD body, the raw file path, filenames-as-content, source_path /
// source_section, or any node properties prose.
//
// Phase 150's builder was DESIGNED to be the first real sendPacket consumer,
// but the consumer call site never landed: a full Phase 239 BRAIN-03 census
// across lib/, scripts/, bin/ and pipelines/ confirms zero production
// sendPacket( call sites today, and sendPacket was formally PARKED in Phase
// 239 (see the dated note above lib/core/brain-client.cjs's sendPacket()).
// This builder still inherits the weight of proving the Part-8 guards fire
// correctly against realistic packet content, not just in dormant fixtures.
// This test seeds the local graph with POISONED cortex nodes
// (memory_artifact per kind + governing_thought + navigator_persona + decision)
// whose properties + path + source_path + source_section carry
// FORBIDDEN_SUBSTRINGS (raw governing-thought prose, an email, an absolute
// /home/jsagi/secret/ path, an injection token), builds the packet for that
// section, and asserts the serialized packet (JSON.stringify) contains NONE of
// the FORBIDDEN_SUBSTRINGS. Only generic handles survive.
//
// It ALSO greps the buildMemoryCortexPacket source for forbidden requires
// (brain-client / node:http / node:https / http / https) and forbidden calls
// (fetch / http.request / https.request / .get) -- the Canon Part 8 zero-egress
// structural floor -- and asserts the navigation-only invariant (requires
// ../navigation.cjs, never node:sqlite).
//
// HELD-node floor: one cortex node carries no correlation_id (an un-
// canonicalized HELD node); the build degrades it to a LOCAL-only handle and
// never crashes.
//
// RED-by-design until Plan 02 Task 2 lands lib/core/navigation/memory-cortex-packet.cjs.
//
// Cloned from tests/test-149-brain-egress.cjs (the adversarial-seed + forbidden-
// require/call structure) AND the packet.cjs sha256-by-default leak-safe
// discipline, repointed to the cortex nodes.
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
  process.stdout.write('SKIP test-150-brain-egress.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------- Files under the structural floor sweep ----------
// ONLY the packet builder is the EGRESS floor here. The 150-01
// memory-artifacts.cjs writer is NOT scanned -- it is the 150-01 plan's own
// substrate-guard floor.
const FILES_TO_SCAN = [
  'lib/core/navigation/memory-cortex-packet.cjs',
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
// node properties / path / source_path / source_section so a packet that reads
// prose leaks one.
const FORBIDDEN_SUBSTRINGS = [
  'SECRET GOVERNING THOUGHT PROSE',
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

// Seed a cortex node by hand (NOT via the 150-01 writer) so we can plant poison
// strings into EVERY field the writer would normally keep clean. This is the
// adversarial part: even if a future 150-01 writer regression let prose into the
// node, the PACKET must still strip it.
//
// `correlationId` is OPTIONAL: when provided we plant it onto the node
// properties (the join key the packet may carry); when omitted, the node is a
// HELD node (un-canonicalized) and the packet must degrade it to LOCAL-only.
function seedPoisonedCortexNode(db, nodeId, nodeType, section, createdAt, correlationId) {
  const props = {
    section: section,
    // Poison: a raw absolute path that must never reach the wire.
    path: '/home/jsagi/secret/' + section + '-' + nodeType + '.md',
    // Poison: raw governing-thought body prose + an email + an injection token.
    body: 'SECRET GOVERNING THOUGHT PROSE leak@example.com ${INJECT}',
    note: 'SECRET GOVERNING THOUGHT PROSE',
  };
  if (typeof correlationId === 'string') {
    props.correlation_id = correlationId;
    props.canonical_name = section;
  }
  const propsJson = JSON.stringify(props);
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, source_section, created_by, ' +
    'confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, ?, ?, ?, 'system', 1.0, 'confirmed', ?, ?)"
  ).run(
    nodeId,
    nodeType,
    propsJson,
    // Poison: source_path + source_section carry secret strings too.
    '/home/jsagi/secret/' + section + ':' + nodeType,
    'SECRET GOVERNING THOUGHT PROSE',
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
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs'));
  assert.equal(typeof mod.buildMemoryCortexPacket, 'function',
    'memory-cortex-packet.cjs must export buildMemoryCortexPacket');

  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW = 1714694400000;

  const section = 'problem-definition';

  // The name-based correlation_id the joinable nodes carry (the LOCAL<->REMOTE
  // join key). Computed the SAME way the packet derives it (computeCorrelationId
  // is name-based + embedding-independent), so the test does not depend on the
  // builder's internal derivation path -- it plants a real cid.
  const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
  const cid = correlation.computeCorrelationId(section, 'memory_cortex');

  // Seed the FULL cortex shape the 150-01 writers + reconcile would produce, all
  // POISONED. The governing_thought is the anchor (getNeighborhood traverses
  // outbound from it). Joinable nodes carry the cid; the persona node is the
  // HELD node (no cid) to exercise graceful degradation.
  const gtId = seedPoisonedCortexNode(
    db, 'governing_thought:' + section, 'governing_thought', section, NOW - 1000, cid);
  const maRoomId = seedPoisonedCortexNode(
    db, 'memory_artifact:' + section + ':ROOM', 'memory_artifact', section, NOW - 2000, cid);
  const maMintoId = seedPoisonedCortexNode(
    db, 'memory_artifact:' + section + ':MINTO', 'memory_artifact', section, NOW - 3000, cid);
  const decisionId = seedPoisonedCortexNode(
    db, 'decision:D-150-01', 'decision', section, NOW - 4000, cid);
  // HELD node: navigator_persona carries NO correlation_id -> must degrade to
  // LOCAL-only and never crash the build.
  const personaId = seedPoisonedCortexNode(
    db, 'navigator_persona:room', 'navigator_persona', section, NOW - 5000, undefined);

  // Cortex lineage edges (STATES / SUPPORTS / INFORMS / DESCRIBES). The
  // governing_thought STATES the memory artifacts; the decision INFORMS the
  // section memory; the persona DESCRIBES the room.
  seedEdge(db, gtId, maRoomId, 'STATES');
  seedEdge(db, gtId, maMintoId, 'STATES');
  seedEdge(db, maMintoId, gtId, 'SUPPORTS');
  seedEdge(db, decisionId, gtId, 'INFORMS');
  seedEdge(db, gtId, decisionId, 'INFORMS');
  seedEdge(db, gtId, personaId, 'DESCRIBES');

  const packet = mod.buildMemoryCortexPacket(db, { section: section });
  assert.ok(packet && typeof packet === 'object', 'packet must be an object');

  const serialized = JSON.stringify(packet);

  for (const sub of FORBIDDEN_SUBSTRINGS) {
    assert.equal(
      serialized.indexOf(sub), -1,
      'packet must not contain forbidden substring: ' + sub + ' -- packet=' + serialized.slice(0, 400)
    );
  }

  // Positive floor: the packet MUST carry the generic handles so it is useful.
  // governing_thought_hash is a sha256 hex string.
  assert.ok(
    typeof packet.governing_thought_hash === 'string'
    && /^sha256:[0-9a-f]{64}$/.test(packet.governing_thought_hash),
    'packet.governing_thought_hash must be a sha256 hex handle, got: ' + packet.governing_thought_hash
  );
  // correlation_id is present (a joinable node existed in the section).
  assert.ok(
    typeof packet.correlation_id === 'string' && packet.correlation_id.length > 0,
    'packet.correlation_id must be present (the LOCAL<->REMOTE join key)'
  );
  assert.equal(packet.correlation_id, cid,
    'packet.correlation_id must be the name-based cid the cortex nodes carry');
  // gap_count is a number.
  assert.equal(typeof packet.gap_count, 'number', 'packet.gap_count must be a number');

  // Enum floor: every enum field present is from its closed set (or absent).
  const PROBLEM_TYPES = ['UDP', 'IDP', 'WDP'];
  const COMPLEXITIES = ['Simple', 'Complex', 'Wicked'];
  if (packet.problem_type != null) {
    assert.ok(PROBLEM_TYPES.indexOf(packet.problem_type) !== -1,
      'packet.problem_type must be a closed-set enum, got: ' + packet.problem_type);
  }
  if (packet.complexity != null) {
    assert.ok(COMPLEXITIES.indexOf(packet.complexity) !== -1,
      'packet.complexity must be a closed-set enum, got: ' + packet.complexity);
  }

  // No em-dash / en-dash in the serialized packet (CLAUDE.md hard rule).
  const EMDASH = String.fromCharCode(0x2014);
  const ENDASH = String.fromCharCode(0x2013);
  assert.equal(serialized.indexOf(EMDASH), -1, 'packet must contain no em-dashes');
  assert.equal(serialized.indexOf(ENDASH), -1, 'packet must contain no en-dashes');

  db.close();
}

// ---------- Test 4: HELD-node graceful degradation -- no cid, no crash ----------

function testHeldNodeDegradesGracefully() {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs'));

  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW = 1714694400000;

  // A HELD section is un-canonicalized: its governing_thought anchor is NOT wired
  // (no joinable cortex node reachable from the anchor), so the section is
  // un-joinable to the REMOTE Brain. We seed a stray persona node that is NOT
  // reachable from the (absent) governing_thought anchor. The builder reads ONLY
  // via getNeighborhood from the anchor (never node properties), so the anchor
  // resolving to an empty neighborhood is the structural HELD signal: the build
  // must NOT throw and must NOT fabricate a remote-join cid.
  const section = 'held-only-section';
  // NOTE: deliberately NO governing_thought:held-only-section node is seeded, so
  // getNeighborhood(anchor) returns [] -- the un-joinable HELD case.
  seedPoisonedCortexNode(
    db, 'navigator_persona:room', 'navigator_persona', section, NOW - 2000, undefined);

  let packet;
  assert.doesNotThrow(function () {
    packet = mod.buildMemoryCortexPacket(db, { section: section });
  }, 'buildMemoryCortexPacket must not throw on a HELD (un-joinable) section');

  assert.ok(packet && typeof packet === 'object', 'packet must be an object even for a HELD-only section');
  // The HELD section degrades to LOCAL-only: no remote join key is forced.
  // correlation_id must be absent or empty (never a fabricated cid).
  assert.ok(
    packet.correlation_id == null || packet.correlation_id === '',
    'a HELD-only section must not fabricate a correlation_id, got: ' + packet.correlation_id
  );
  // The packet still serializes with no forbidden prose.
  const serialized = JSON.stringify(packet);
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    assert.equal(serialized.indexOf(sub), -1,
      'HELD-node packet must not contain forbidden substring: ' + sub);
  }

  db.close();
}

// ---------- Test 5: defensive -- absent db / unknown section never throws ----------

function testDefensiveMinimalPacket() {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs'));
  let p1;
  assert.doesNotThrow(function () { p1 = mod.buildMemoryCortexPacket(null, { section: 'x' }); },
    'buildMemoryCortexPacket(null, ...) must not throw');
  assert.ok(p1 && typeof p1 === 'object', 'absent-db build returns a minimal packet object');

  const db = new DatabaseSync(':memory:');
  applySchema(db);
  let p2;
  assert.doesNotThrow(function () { p2 = mod.buildMemoryCortexPacket(db, {}); },
    'buildMemoryCortexPacket(db, {}) (no section) must not throw');
  assert.ok(p2 && typeof p2 === 'object', 'no-section build returns a minimal packet object');
  db.close();
}

// ---------- Test 6: regression -- the packet module reads ONLY via navigation.cjs ----------

function testPacketReadsViaNavigation() {
  const abs = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-cortex-packet.cjs');
  const src = fs.readFileSync(abs, 'utf8');
  assert.match(
    src,
    /require\s*\(\s*['"]\.\.\/navigation\.cjs['"]/,
    'memory-cortex-packet.cjs must require ../navigation.cjs (the Phase 109 chokepoint)'
  );
  // It must NOT require node:sqlite directly (no room.db open of its own).
  assert.equal(
    /require\s*\(\s*['"]node:sqlite['"]\s*\)/.test(src), false,
    'memory-cortex-packet.cjs must not require node:sqlite directly (substrate guard)'
  );
}

// ---------- Run ----------

testForbiddenRequiresAndCalls();
testAdversarialSeedForbidden();
testHeldNodeDegradesGracefully();
testDefensiveMinimalPacket();
testPacketReadsViaNavigation();
process.stdout.write('PASS test-150-brain-egress.cjs (MEM-04: zero memory cortex prose in the Brain packet)\n');
process.exit(0);
