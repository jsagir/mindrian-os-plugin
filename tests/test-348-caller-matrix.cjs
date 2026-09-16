'use strict';
/*
 * tests/test-348-caller-matrix.cjs -- Phase 348-04 Task 3 (SUPER-05).
 *
 * Every real caller of findContradictions gets a declared, measured
 * behavior: the re-export forwards the options bag unchanged, the three
 * lib/core + lib/agents consumers take the new DEFAULT (superseded
 * excluded), and the one MCP surface (sensors.cjs) is OPT-IN (348-06).
 *
 * The caller set is DERIVED from the repo at run time (grep for
 * findContradictions( or findContradictions:, excluding the defining file
 * itself, tests/, and node_modules/) rather than hand-listed, so a sixth
 * caller added later fails this test loudly instead of silently inheriting
 * a default nobody chose (T-348-20).
 *
 * Each of the three consuming callers is driven through its OWN real
 * exported function on a fixture, before and after a real supersession
 * (navigation.promoteNodeStatus), not by re-calling findContradictions and
 * assuming the caller forwards it correctly.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const { writeEdge } = require('../lib/core/navigation/edges.cjs');
const { runMigration: runSessionFocusMigration } = require('../lib/core/migrations/phase-109-session-focus.cjs');
const packet = require('../lib/core/navigation/packet.cjs');
const roomHome = require('../lib/core/navigation/room-home.cjs');
const reverseSalientAgent = require('../lib/agents/reverse-salient-agent.cjs');

const REPO = path.join(__dirname, '..');
let assertions = 0;
function check(cond, msg) {
  assertions++;
  assert.ok(cond, msg);
}

// ---- Derive the caller set from the repo at run time ---------------------

const SCAN_ROOTS = ['lib', 'commands', 'scripts', 'agents', 'skills', 'hooks'];
const SCAN_EXTENSIONS = new Set(['.cjs', '.js']);
const CALLER_PATTERN = /findContradictions\s*[:(]/;
// insights.cjs is the DEFINITION (function findContradictions(...) {), not a
// caller. Excluded explicitly so the derived set names only real callers.
const DEFINITION_FILE = 'lib/core/navigation/insights.cjs';

function walkFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkFiles(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function deriveCallerSet() {
  const found = [];
  for (const root of SCAN_ROOTS) {
    for (const f of walkFiles(path.join(REPO, root))) {
      const rel = toPosix(path.relative(REPO, f));
      if (rel === DEFINITION_FILE) continue;
      let src;
      try {
        src = fs.readFileSync(f, 'utf8');
      } catch (_e) {
        continue;
      }
      if (CALLER_PATTERN.test(src)) found.push(rel);
    }
  }
  return found.sort();
}

const EXPECTED_CALLERS = [
  'lib/agents/reverse-salient-agent.cjs',
  'lib/core/navigation.cjs',
  'lib/core/navigation/packet.cjs',
  'lib/core/navigation/room-home.cjs',
  'lib/mcp/tools/sensors.cjs',
].sort();

const MATRIX = new Map();

function testCallerSetDerivedAndComplete() {
  const derived = deriveCallerSet();
  check(
    JSON.stringify(derived) === JSON.stringify(EXPECTED_CALLERS),
    'derived caller set must equal the five named callers exactly. Measured: ' + JSON.stringify(derived)
    + '. Expected: ' + JSON.stringify(EXPECTED_CALLERS)
  );
}

// ---- The re-export forwards the third argument unchanged ----------------

function testReExportForwardsOptionsBag() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'caller-matrix-reexport',
      { invalidatedAt: 1, validTo: 2 }
    );
    const withoutFlag = navigation.findContradictions(fx.db, fx.claimAId);
    const withFlag = navigation.findContradictions(fx.db, fx.claimAId, { includeSuperseded: true });
    check(withoutFlag.length === 0, 'sanity: default call must exclude the superseded pair');
    check(withFlag.length === 1, 'the re-export must forward the third argument (includeSuperseded); a two-argument forward would drop it and this assertion would fail');
    MATRIX.set('lib/core/navigation.cjs', { declaration: 're-export, forwards opts unchanged', measured: 'includeSuperseded:true reaches insights.cjs through the re-export' });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}

// ---- packet.cjs (Canon Part 8 Brain Context Packet), DEFAULT ------------

function testPacketCallerDefault() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  const mockOpts = {
    roomDir: fx.roomDir,
    _mocks: {
      jtbd: { getCurrent: () => ({ current: null }) },
      operator: { getCurrent: () => ({ current: null }) },
    },
  };
  return packet.buildBrainPacket(fx.db, null, fx.claimAId, mockOpts)
    .then((before) => {
      check(before.local_graph_summary.contradictions.length === 1, 'Canon Part 8 packet must carry the one live contradiction BEFORE supersession');
      navigation.promoteNodeStatus(
        fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'caller-matrix-packet',
        { invalidatedAt: 1, validTo: 2 }
      );
      return packet.buildBrainPacket(fx.db, null, fx.claimAId, mockOpts);
    })
    .then((after) => {
      check(after.local_graph_summary.contradictions.length === 0, 'Canon Part 8 Brain Context Packet must exclude the superseded pair (DEFAULT, T-348-16)');
      MATRIX.set('lib/core/navigation/packet.cjs', { declaration: 'DEFAULT (Canon Part 8 wire surface)', measured: '1 -> 0 across supersession, driven through buildBrainPacket' });
    })
    .finally(() => {
      closeSupersessionFixtureRoom(fx);
    });
}

// ---- room-home.cjs, DEFAULT -----------------------------------------------

function testRoomHomeCallerDefault() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    const roomRootId = 'room:fixture-348-caller-matrix';
    insertNode(fx.db, roomRootId, 'room', JSON.stringify({}), { epistemic_type: 'observation', review_status: 'confirmed' });
    const edgeRes = writeEdge(fx.db, { source_id: roomRootId, target_id: fx.claimBId, edge_type: 'CONTRADICTS', properties: {} });
    if (!edgeRes.ok) throw new Error('caller-matrix: room-root CONTRADICTS writeEdge failed: ' + edgeRes.reason);

    const before = roomHome.getRoomHomeView(fx.db, 'fixture-348-caller-matrix', {});
    check(before.contradictions.length === 1, 'room-home view must carry the one live contradiction BEFORE supersession');

    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'caller-matrix-room-home',
      { invalidatedAt: 1, validTo: 2 }
    );
    const after = roomHome.getRoomHomeView(fx.db, 'fixture-348-caller-matrix', {});
    check(after.contradictions.length === 0, 'room-home view must exclude the superseded pair (DEFAULT)');
    MATRIX.set('lib/core/navigation/room-home.cjs', { declaration: 'DEFAULT', measured: '1 -> 0 across supersession, driven through getRoomHomeView' });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}

// ---- reverse-salient-agent.cjs, DEFAULT -----------------------------------

function testReverseSalientAgentCallerDefault() {
  const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
  try {
    runSessionFocusMigration(fx.db);
    const setRes = navigation.setFocus(fx.db, 'caller-matrix-session', fx.claimAId, 'user');
    if (!setRes.ok) throw new Error('caller-matrix: setFocus failed: ' + setRes.reason);

    const before = reverseSalientAgent.gatherFocusContext(fx.db, 'caller-matrix-session');
    check(!!before, 'gatherFocusContext must return a context object with an active focus set');
    check(before.contradictions.length === 1, 'reverse-salient scan must carry the one live contradiction BEFORE supersession');

    navigation.promoteNodeStatus(
      fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'caller-matrix-rsa',
      { invalidatedAt: 1, validTo: 2 }
    );
    const after = reverseSalientAgent.gatherFocusContext(fx.db, 'caller-matrix-session');
    check(after.contradictions.length === 0, 'reverse-salient scan must exclude the superseded pair (DEFAULT)');
    MATRIX.set('lib/agents/reverse-salient-agent.cjs', { declaration: 'DEFAULT', measured: '1 -> 0 across supersession, driven through gatherFocusContext' });
  } finally {
    closeSupersessionFixtureRoom(fx);
  }
}

// ---- The four consuming call sites carry SUPER-05 + DEFAULT --------------

const DECLARED_DEFAULT_FILES = [
  'lib/core/navigation.cjs',
  'lib/core/navigation/packet.cjs',
  'lib/core/navigation/room-home.cjs',
  'lib/agents/reverse-salient-agent.cjs',
];

function testDeclarationsPresent() {
  for (const rel of DECLARED_DEFAULT_FILES) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    check(src.indexOf('SUPER-05') !== -1, rel + ' must carry the literal token SUPER-05');
    check(src.indexOf('DEFAULT') !== -1, rel + ' must carry the literal word DEFAULT');
  }
}

// ---- sensors.cjs is OPT-IN, declared by 348-06 ----------------------------
//
// 348-06 flips this row from PENDING to OPT-IN: contradiction_check now
// carries the include_superseded MCP parameter, mapped to includeSuperseded
// and threaded as the third argument. The behavioral round trip (a fixture
// holding a real superseded pair, driven through the REAL registered
// handler in both directions) is proven in tests/test-348-mcp-flag.cjs
// rather than re-driven here (Canon Part 7: reuse before build) -- this
// assertion proves the DECLARATION landed, not the behavior a second time.

function testSensorsCallerOptIn() {
  const rel = 'lib/mcp/tools/sensors.cjs';
  const abs = path.join(REPO, rel);
  check(fs.existsSync(abs), rel + ' must exist (the fifth caller)');
  const src = fs.readFileSync(abs, 'utf8');
  const i = src.indexOf('SUPER-05');
  check(i !== -1, rel + ' must carry the literal token SUPER-05 (348-06 declares this row)');
  const line = src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i));
  check(line.indexOf('OPT-IN') !== -1, rel + ' the SUPER-05 line must also carry the literal token OPT-IN. Measured: ' + line);
  check(src.indexOf('includeSuperseded') !== -1, rel + ' must map include_superseded to includeSuperseded');
  MATRIX.set(rel, { declaration: 'OPT-IN', measured: 'behavioral round trip driven through the real registered handler in tests/test-348-mcp-flag.cjs' });
}

// ---- Run: synchronous assertions first, then the one async caller -------

testCallerSetDerivedAndComplete();
testReExportForwardsOptionsBag();
testRoomHomeCallerDefault();
testReverseSalientAgentCallerDefault();
testDeclarationsPresent();
testSensorsCallerOptIn();

testPacketCallerDefault()
  .then(() => {
    const order = [
      'lib/core/navigation.cjs',
      'lib/core/navigation/packet.cjs',
      'lib/core/navigation/room-home.cjs',
      'lib/agents/reverse-salient-agent.cjs',
      'lib/mcp/tools/sensors.cjs',
    ];
    console.log('');
    console.log('Caller matrix (SUPER-05):');
    console.log('caller | declaration | measured');
    for (const caller of order) {
      const row = MATRIX.get(caller);
      if (row) console.log(caller + ' | ' + row.declaration + ' | ' + row.measured);
    }
    console.log('');
    console.log(assertions + ' assertions passed.');
    console.log('>>> test-348-caller-matrix.cjs: PASSED');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
