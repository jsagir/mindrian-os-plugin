'use strict';
// Phase 109-10: the load-bearing instrumented acceptance test (NAV-109-09).
// Release gate per CONTEXT specifics + RESEARCH section 10.1: given a focus node,
// the full navigation flow via lib/core/navigation.cjs produces its typed payloads
// WITHOUT a single non-SQLite filesystem read. Zero tolerance for leaks.
// Pattern: direct-CJS (node:assert/strict, no Mocha/Jest, zero new npm deps).
//
// The flow exercised (all through the lib/core/navigation.cjs chokepoint, never
// through lib/core/navigation/*.cjs submodules directly):
//   getActiveFocus -> getNeighborhood -> findContradictions ->
//   findRelevantOpportunities -> findRecentChanges -> buildBrainPacket ->
//   getRoomHomeView
// Every call that accepts opts is passed the _mocks seam
//   { jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } }
// so the file-touching lib/hmi/jtbd-state.cjs / lib/conversation/operator.cjs
// requires never fire (which would fail the zero-reads gate).
//
// Canon Part 1 (the navigator interrogates working memory as graph paths, not folder scans).
// Canon Part 4 (memory_event reads, neighborhood ranking, packet building all from typed graph state).
// Canon Part 8 (buildBrainPacket leg asserts no raw bodies leak; the fs-proxy asserts no folder scan).
// Canon Part 9 (SQL is the local mind, proven by instrumentation - zero non-SQLite filesystem reads).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-109', 'sample-room', 'seed.sql');
const ROOM_ID = 'phase-109-fixture';
const FOCUS_NODE = 'decision:mcp-app-first';
const SESSION_ID = 'sess-acceptance';
const TOKEN_BUDGET = 1200;

function mocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

function setupRoom() {
  // openRoomDb runs lazygraph.initSchema + memory.initMemorySchema + the Plan 109-01
  // nodes-provenance migration + the Plan 109-02 session_focus migration -- all of which
  // touch the filesystem (schema bootstrap). This MUST happen BEFORE the fs proxy is
  // installed; the proxy only wraps reads, so the .mindrian/ mkdirSync write and the
  // schema bootstrap reads here are not counted as flow reads.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-acceptance-'));
  const db = openRoomDb(tmp);
  // Apply the 500-node fixture seed BEFORE the proxy is installed (db.exec is a single
  // call into node:sqlite; the seed.sql readFileSync happens here, pre-proxy).
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  // Set focus to the known decision node. setFocus writes a focus_changed memory_event
  // row (a DB write, fine) -- this also happens BEFORE the proxy install.
  const r = navigation.setFocus(db, SESSION_ID, FOCUS_NODE, 'user');
  ok(r && r.ok === true, 'setFocus succeeded (got ' + JSON.stringify(r) + ')');
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Provenance presence helper. RESEARCH section 10.1 step 5 requires every returned
// node to carry created_by / source_path / review_status / created_at / last_seen_at.
// The navigation modules normalize to camelCase OR snake_case depending on the module;
// accept either form for a given logical field (a naming difference is not a gap).
function hasProvenance(node) {
  if (!node || typeof node !== 'object') return false;
  const keys = new Set(Object.keys(node));
  const aliases = {
    created_by: ['created_by', 'createdBy'],
    review_status: ['review_status', 'reviewStatus'],
    created_at: ['created_at', 'createdAt'],
    last_seen_at: ['last_seen_at', 'lastSeenAt'],
    source_path: ['source_path', 'sourcePath'],
  };
  const missing = [];
  for (const [logical, cands] of Object.entries(aliases)) {
    if (!cands.some((k) => keys.has(k))) missing.push(logical);
  }
  return { ok: missing.length === 0, missing };
}

async function runFlowAndCollect(db) {
  // PROXY ACTIVE for the duration of this function. All calls route through the
  // lib/core/navigation.cjs chokepoint; every opts-accepting call carries the _mocks seam.
  //
  // Phase 125-03: buildBrainPacket is now async; await the call so the
  // instrumented fs proxy spans the full Brain Cypher slice fetch path too.
  const m = mocks();
  const out = {};
  out.activeFocus = navigation.getActiveFocus(db, SESSION_ID);
  out.neighborhood = navigation.getNeighborhood(db, FOCUS_NODE, { maxDepth: 2, topK: 20, _mocks: m });
  out.contradictions = navigation.findContradictions(db, FOCUS_NODE);
  out.opportunities = navigation.findRelevantOpportunities(db, FOCUS_NODE, { topK: 3, _mocks: m });
  out.recentChanges = navigation.findRecentChanges(db, Date.now() - 24 * 60 * 60 * 1000, { limit: 50 });
  out.packet = await navigation.buildBrainPacket(db, 'suggest_next_move', FOCUS_NODE, { _mocks: m });
  out.home = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: m });
  return out;
}

async function test_zeroNonSqliteReads_andShapes() {
  const { tmp, db } = setupRoom();
  let res;
  try {
    fsInstrument.install({ throwOnViolation: false });
    try { res = await runFlowAndCollect(db); }
    finally { fsInstrument.uninstall(); }

    // LOAD-BEARING assertion: zero non-SQLite filesystem reads during the flow.
    const leaks = fsInstrument.calls();
    ok(
      leaks.length === 0,
      'LOAD-BEARING: zero non-SQLite filesystem reads during the navigation flow; leaked: '
        + JSON.stringify(leaks.map((c) => ({ method: c.method, target: c.target })))
    );

    // getActiveFocus resolved the focus node we set in setup.
    ok(
      res.activeFocus
        && (res.activeFocus.focusNodeId === FOCUS_NODE
          || res.activeFocus.focus_node_id === FOCUS_NODE
          || res.activeFocus.id === FOCUS_NODE),
      'getActiveFocus returns decision:mcp-app-first (got ' + JSON.stringify(res.activeFocus) + ')'
    );

    // getNeighborhood: ranked array with edgePath + numeric score + provenance fields.
    ok(Array.isArray(res.neighborhood), 'getNeighborhood returns an array');
    ok(res.neighborhood.length > 0, 'getNeighborhood returns at least one neighbor for the seeded focus node');
    {
      const n0 = res.neighborhood[0];
      ok(('edgePath' in n0) || ('edge_path' in n0), 'neighbor carries edgePath');
      const ep = n0.edgePath || n0.edge_path;
      ok(Array.isArray(ep), 'neighbor edgePath is an array');
      ok(typeof n0.score === 'number', 'neighbor carries a numeric score (got ' + typeof n0.score + ')');
      const prov = hasProvenance(n0);
      ok(prov.ok, 'neighbor carries provenance fields; missing: ' + JSON.stringify(prov.missing) + ' (keys: ' + JSON.stringify(Object.keys(n0)) + ')');
    }

    // findContradictions / findRelevantOpportunities / findRecentChanges return arrays.
    ok(Array.isArray(res.contradictions), 'findContradictions returns an array');
    ok(Array.isArray(res.opportunities) && res.opportunities.length <= 3, 'findRelevantOpportunities returns a <= topK array (got ' + (Array.isArray(res.opportunities) ? res.opportunities.length : 'non-array') + ')');
    ok(Array.isArray(res.recentChanges), 'findRecentChanges returns an array');
    ok(res.recentChanges.length > 0, 'findRecentChanges returns at least one memory_event (the setFocus focus_changed event)');
    for (const ev of res.recentChanges) {
      const t = ev.type || ev.node_type;
      // memory-events.cjs row mapper does not echo node type; assert via the eventType
      // field instead (every row from the SELECT is a memory_event node by the WHERE clause).
      ok(typeof (ev.eventType || ev.event_type) === 'string' || t === 'memory_event', 'recentChanges entry looks like a memory_event node (got ' + JSON.stringify(Object.keys(ev)) + ')');
    }

    // buildBrainPacket: D-06 shape + token budget + no raw opportunity bodies.
    const p = res.packet;
    ok(p && typeof p === 'object' && !Array.isArray(p), 'buildBrainPacket returns a plain object');
    for (const k of ['packet_version', 'job', 'active_context', 'local_graph_summary', 'constraints']) {
      ok(k in p, 'packet has key ' + k);
    }
    ok(
      p.active_context && p.active_context.focus_node && p.active_context.focus_node.id === FOCUS_NODE,
      'packet active_context.focus_node.id is the focus node (got ' + JSON.stringify(p.active_context && p.active_context.focus_node) + ')'
    );
    ok(p.active_context.focus_node.type === 'decision', 'packet focus_node.type is decision');
    const serialized = JSON.stringify(p);
    const estTokens = Math.round(serialized.length / 4);
    ok(estTokens < TOKEN_BUDGET, 'packet under ' + TOKEN_BUDGET + '-token budget (got ' + estTokens + ' tokens / ' + serialized.length + ' chars)');
    const banked = (p.local_graph_summary && p.local_graph_summary.banked_opportunities) || {};
    const bankedItems = Array.isArray(banked) ? banked : (Array.isArray(banked.items) ? banked.items : []);
    for (const b of bankedItems) {
      // No raw title/body/summary strings -- only hashed id + generic tags + HSI band + rounded score.
      ok(!('title' in b) && !('body' in b) && !('summary' in b) && !('text' in b) && !('claim' in b), 'banked opportunity carries no raw body string (got ' + JSON.stringify(Object.keys(b)) + ')');
      ok(('id_hash' in b) || ('idHash' in b), 'banked opportunity carries a hashed id');
    }
    // Privacy belt-and-braces: no raw opportunity title/text from the seed leaks into the packet.
    ok(!/Opportunity 0\d\d/.test(serialized), 'serialized packet does not leak a raw seeded opportunity title');

    // getRoomHomeView: all 9 D-08 keys + composition-not-duplication.
    const h = res.home;
    ok(h && typeof h === 'object', 'getRoomHomeView returns an object');
    for (const k of ['currentThesis', 'confirmedFacts', 'riskyAssumptions', 'evidence', 'contradictions', 'openQuestions', 'recentChanges', 'bankedOpportunities', 'nextMove']) {
      ok(k in h, 'home has key ' + k);
    }
    const factIds = new Set((h.confirmedFacts || []).map((x) => x.id));
    for (const r of (h.riskyAssumptions || [])) {
      ok(!factIds.has(r.id), 'composition-not-duplication: id ' + r.id + ' appears in BOTH confirmedFacts and riskyAssumptions');
    }

    db.close();
  } finally {
    cleanup(tmp);
  }
}

async function run() {
  const tests = [test_zeroNonSqliteReads_andShapes];
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t();
      pass++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      fail++;
      process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + (err.stack || '') + '\n');
    }
  }
  process.stdout.write('test-navigation-acceptance: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
