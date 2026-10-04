#!/usr/bin/env node
'use strict';

/**
 * Quick 261004-av2 (CR-02 option 2 of the Phase 369 code review, navigator ruling 2026-10-04
 * "answered_via marker now, human-only route later", SEED-114; canon parts 8 and 9) -- every
 * gate_answer ratification records HOW the answer reached the room: answered_via is
 * browser_nonce when the shell proved a browser click, mcp_relayed for everything else.
 * ==========================================================================
 * The proof. approveDecision, after nonces.reserve accepted the render nonce, mints
 *   routeKey = HMAC-SHA256(key = control token (trimmed), data = 'mindrian answer route v1')
 *   tag      = SHA-256 hex of the render nonce
 *   mac      = HMAC-SHA256(key = routeKey, data = gateId + newline + tag) hex
 * and sends { v: 1, tag, mac } in the MCP request _meta under 'mindrian/answer_route'. The daemon
 * recomputes it from the 0600 control token file it reads with the launcher's guards. A match gives
 * browser_nonce; anything else gives mcp_relayed. The marker is never read from tool arguments.
 *
 * Arms (daemon half, over a live hermetic daemon; the test process holds the control token):
 *   A1  a model-composed gate_answer (no proof) records mcp_relayed on the reply, the answer record
 *       and the decision node; the confirm reason names the relay; confirmed_by is the navigator
 *   A2  no model-side claim reaches browser_nonce: an extra answered_via argument, a MAC under a wrong
 *       key, a MAC for another gate id, a valid MAC while the token file is mode 0644 -> mcp_relayed
 *   A3  a valid proof in _meta records browser_nonce on the reply, record, node and confirm reason;
 *       A3b a CLI-raised source mirrored and answered with a proof writes the source anchor with
 *       answered_via browser_nonce and via_gate_id = the mirror id; gate_list reads it
 *   A4  a replay keeps the RECORDED marker, never the route of the repeating call; the source owner's
 *       later answer reads answered_elsewhere with the recorded route
 *   A5  readGateAnswerAnchor: a 369-36 era row (answered_via = a gate id) reads unrecorded plus
 *       via_gate_id; a row with no answered_via reads unrecorded
 *   A6  static: gate_answer input keys unchanged; one routeOf call; the Part 9 sentence; route sets and
 *       the control token path agree; routeOf never throws; one _ledger.delete( in gate-ledger.cjs
 * Arms (shell half, the shell modules in process over the same daemon):
 *   B1  approveDecision after readGate records browser_nonce on the four surfaces
 *   B2  the daemon checks, it does not take the shell's word: a swapped token file gives mcp_relayed
 *   B3  a CLI-raised gate approved in the shell: source anchor browser_nonce + via_gate_id, the CLI
 *       owner replays answered_elsewhere with browser_nonce
 *   B4  static: one answerRouteMeta( call in actions.ts between nonces.reserve( and gateAnswer(; the
 *       pool's adapterCall passes no meta; control.ts literals equal answer-route.cjs
 *   dash guard: no long dash in any file this quick touches
 *
 * Exit 0 all PASS, 1 any FAIL, 77 only when @modelcontextprotocol/client cannot be loaded or the
 * daemon cannot start. Every child it spawns is killed in a finally. Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHARED = path.join(REPO, 'ui', 'shared');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-av2-'));
const TOKEN_FILE = path.join(TMP_HOME, 'ctl', 'control.token');
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
process.env.MOS_SHELL_CONTROL_TOKEN_FILE = TOKEN_FILE;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DO_NOT_TRACK = '1';

try {
  require('@modelcontextprotocol/client');
} catch (e) {
  console.log('SKIP: @modelcontextprotocol/client cannot be loaded (' + (e && e.message ? e.message : e) + ')');
  process.exit(77);
}

// ui/shell resolves `mos-ui-shared/<name>` through a node_modules COPY that Node will not strip types from:
// the in-process arms resolve it straight to ui/shared/src (the way tests/test-369-gate-mirror-shell.cjs does).
require('node:module').registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('mos-ui-shared/')) {
      return nextResolve(pathToFileURL(path.join(SHARED, 'src', specifier.slice('mos-ui-shared/'.length) + '.ts')).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const D = require('./helpers/mcp-daemon-369.cjs');
const { cliClient } = require('./helpers/cli-gate-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

const META_KEY = 'mindrian/answer_route';
const ROUTE_LABEL = 'mindrian answer route v1';

let passed = 0;
let failed = 0;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.message) || err).split('\n').slice(0, 8).join('\n    '));
  }
}

// -- the proof derivation, written identically in answer-route.cjs and ui/shell/server/control.ts -------
const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
function proofFor(token, gateId, nonce) {
  const routeKey = crypto.createHmac('sha256', String(token).trim()).update(ROUTE_LABEL).digest();
  const tag = sha256hex(nonce);
  const mac = crypto.createHmac('sha256', routeKey).update(gateId + '\n' + tag).digest('hex');
  return { v: 1, tag: tag, mac: mac };
}
const metaFor = (proof) => ({ [META_KEY]: proof });

// -- reading a tool result ---------------------------------------------------------------
function parseToolJson(result) {
  const text = (result && Array.isArray(result.content) ? result.content : [])
    .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
    .join('');
  const marker = text.indexOf('\n\n## ');
  const body = marker === -1 ? text : text.slice(0, marker);
  try {
    return JSON.parse(body);
  } catch (_e) {
    return { __error: 'unparseable tool body: ' + body.slice(0, 200) };
  }
}
async function dcall(client, name, args, meta) {
  try {
    const params = { name: name, arguments: args || {} };
    if (meta) params._meta = meta;
    return parseToolJson(await client.callTool(params));
  } catch (e) {
    return { __error: String((e && e.message) || e).slice(0, 300) };
  }
}

// -- raw reads of room.db (tests/ is on the Canon Part 9 allow-list) -----------------------
function withDb(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function claimIds(roomDir) {
  return withDb(roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
}
function answerProps(roomDir, gateId) {
  const rows = withDb(roomDir, (db) => db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.dedupe_key') = ?"
  ).all('gate_answer:' + gateId));
  return rows.map((r) => JSON.parse(r.properties));
}
function nodeRow(roomDir, id) {
  return withDb(roomDir, (db) => db.prepare('SELECT id, properties, confirmed_by, review_status FROM nodes WHERE id = ?').get(id));
}
function nodeProps(roomDir, id) {
  const row = nodeRow(roomDir, id);
  return row ? JSON.parse(row.properties) : null;
}
function promotedReasons(roomDir, nodeId) {
  return withDb(roomDir, (db) => db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.event_type') = 'status_promoted' " +
    "AND json_extract(properties, '$.target_node_id') = ?"
  ).all(nodeId).map((r) => JSON.parse(r.properties).reason));
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify.', preview: 'Ratifies the claim.' },
  { id: 'hold', label: 'Hold', rank: 2 },
  { id: 'reject', label: 'Reject', rank: 3 },
];

const SEED = [];
for (let i = 1; i <= 12; i += 1) SEED.push({ kind: 'claim', text: 'Claim number ' + i + ' for the answered_via marker test.' });
SEED.push({ kind: 'source', url: 'https://example.org/av2/1', retrieved_at: '2026-10-04T00:00:00Z' });

const RELAY_TEXT = 'answered_via mcp_relayed, relayed by the model, not proven by the route';
const BROWSER_TEXT = 'answered_via browser_nonce, proven by the route';

// Every file this quick touches (the dash guard reads them; dist is excluded).
const TOUCHED = [
  'tests/test-av2-answered-via.cjs',
  'lib/mcp/answer-route.cjs',
  'lib/mcp/tools/gate.cjs',
  'lib/core/navigation/room-projection.cjs',
  'lib/core/navigation/reasoning-write.cjs',
  'lib/core/strategy/goal-gate.cjs',
  'tests/test-369-gate-mirror.cjs',
  'ui/shared/src/mcp-session-pool.ts',
  'ui/shell/server/control.ts',
  'ui/shell/server/actions.ts',
  'tests/test-369-gate-mirror-shell.cjs',
  'tests/test-365-never-do-gate.cjs',
];

const stripComments = (src) => src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

async function main() {
  const controlMod = await load('ui/shell/server/control.ts');
  const actionsMod = await load('ui/shell/server/actions.ts');
  const sessionsMod = await load('ui/shell/server/sessions.ts');
  const connMod = await load('ui/shell/server/connection-state.ts');
  const feedMod = await load('ui/shell/server/feed-routes.ts');
  const authMod = await load('ui/shell/server/auth.ts');
  const proposalMod = await load('ui/shared/src/proposal.ts');

  // The shell's control token: on disk (0600) and in memory, before the daemon reads it.
  controlMod.startControl(TOKEN_FILE);
  const token = () => controlMod.getControl().token;

  let h = null;
  let cli = null;
  let pool = null;
  const clients = [];
  try {
    try {
      h = await D.startDaemon({
        rooms: [{ slug: 'room-x', variant: 'wide', migrate: true, seed: SEED }],
        extraEnv: { MINDRIAN_TEST_MODE: '1', MOS_SHELL_CONTROL_TOKEN_FILE: TOKEN_FILE },
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    const roomX = h.roomDirs['room-x'];
    const claims = claimIds(roomX);
    assert.ok(claims.length >= 12, 'room-x must hold the seeded claims: ' + claims.length);
    let nextClaim = 0;
    const freshClaim = () => claims[nextClaim++];

    cli = await cliClient({ roomsHome: h.roomsHome, home: h.env.HOME, sessionId: 'cli-av2-owner' });
    await cli.bind('room-x');
    const raise = (args) => cli.call('gate_render', Object.assign({ kind: 'general', select_mode: 'single', options: OPTIONS, approving: ['approve'] }, args));

    const A = await D.legacyClient(h.port, 'av2-a');
    clients.push(A);
    assert.equal((await dcall(A.client, 'room_bind', { room: 'room-x' })).ok, true, 'A binds room-x');
    const a = (tool, args, meta) => dcall(A.client, tool, args, meta);
    const render = (args) => a('gate_render', Object.assign({ kind: 'general', select_mode: 'single', options: OPTIONS, approving: ['approve'] }, args));
    const navigatorId = require('../lib/core/navigation.cjs').resolveByUser(roomX);

    // -------------------------------------------------------------------------------- A1
    let g1 = null;
    let c1 = null;
    await arm('A1 a model-composed answer (no proof) records mcp_relayed on the reply, record, decision node and confirm reason', async () => {
      c1 = freshClaim();
      const r = await render({ header: 'Ratify claim A1?', subject_node_id: c1 });
      assert.equal(r.ok, true, JSON.stringify(r));
      g1 = r.gate_id;
      const ans = await a('gate_answer', { gate_id: g1, chosen: ['approve'], verdict: 'approve' });
      assert.equal(ans.ok, true, JSON.stringify(ans));
      assert.equal(ans.answered_via, 'mcp_relayed', 'reply: ' + JSON.stringify(ans));
      const anchors = answerProps(roomX, g1);
      assert.equal(anchors.length, 1);
      assert.equal(anchors[0].answered_via, 'mcp_relayed', 'answer record');
      const node = nodeProps(roomX, 'decision:gate:' + g1);
      assert.ok(node, 'the decision node exists');
      assert.equal(node.answered_via, 'mcp_relayed', 'decision node');
      const reasons = promotedReasons(roomX, 'decision:gate:' + g1);
      assert.ok(reasons.some((r2) => typeof r2 === 'string' && r2.includes(RELAY_TEXT)), 'confirm reason names the relay: ' + JSON.stringify(reasons));
      assert.equal(nodeRow(roomX, 'decision:gate:' + g1).confirmed_by, navigatorId, 'confirmed_by stays the navigator identity');
      if (ans.reasoning_node && ans.reasoning_node.subject_confirmed === true) {
        const sub = promotedReasons(roomX, c1);
        assert.ok(sub.some((r2) => typeof r2 === 'string' && r2.includes(RELAY_TEXT)), 'card subject confirm reason names the relay: ' + JSON.stringify(sub));
      }
      const st = await a('gate_list', { gate_id: g1 });
      assert.equal(st.ok, true, JSON.stringify(st));
      assert.equal(st.gate && st.gate.answered && st.gate.answered.answered_via, 'mcp_relayed', 'gate_list: ' + JSON.stringify(st));
    });

    // -------------------------------------------------------------------------------- A2
    await arm('A2 no model-side claim reaches browser_nonce (argument, wrong key, other gate id, loose token mode)', async () => {
      const nonce = 'a-render-nonce-the-model-never-sees';
      // (a) an extra argument naming the route: refused or stripped, never recorded as browser_nonce
      const ra = await render({ header: 'A2a' });
      assert.equal(ra.ok, true, JSON.stringify(ra));
      const withArg = await a('gate_answer', { gate_id: ra.gate_id, chosen: ['approve'], verdict: 'approve', answered_via: 'browser_nonce' });
      if (withArg.ok === true) {
        assert.equal(withArg.answered_via, 'mcp_relayed', 'an argument claim is ignored: ' + JSON.stringify(withArg));
      } else {
        const plain = await a('gate_answer', { gate_id: ra.gate_id, chosen: ['approve'], verdict: 'approve' });
        assert.equal(plain.ok, true, JSON.stringify(plain));
        assert.equal(plain.answered_via, 'mcp_relayed', JSON.stringify(plain));
      }
      assert.equal(answerProps(roomX, ra.gate_id)[0].answered_via, 'mcp_relayed', 'record (a)');
      // (b) a well-shaped proof under the wrong key
      const rb = await render({ header: 'A2b' });
      const wrong = proofFor('not-the-control-token', rb.gate_id, nonce);
      const ansB = await a('gate_answer', { gate_id: rb.gate_id, chosen: ['approve'], verdict: 'approve' }, metaFor(wrong));
      assert.equal(ansB.ok, true, JSON.stringify(ansB));
      assert.equal(ansB.answered_via, 'mcp_relayed', 'wrong key: ' + JSON.stringify(ansB));
      // (c) a valid MAC computed for another gate id
      const rc = await render({ header: 'A2c' });
      const forOther = proofFor(token(), 'some-other-gate-id', nonce);
      const ansC = await a('gate_answer', { gate_id: rc.gate_id, chosen: ['approve'], verdict: 'approve' }, metaFor(forOther));
      assert.equal(ansC.ok, true, JSON.stringify(ansC));
      assert.equal(ansC.answered_via, 'mcp_relayed', 'other gate id: ' + JSON.stringify(ansC));
      // (d) a valid MAC while the token file is readable by others
      const rd = await render({ header: 'A2d' });
      const good = proofFor(token(), rd.gate_id, nonce);
      fs.chmodSync(TOKEN_FILE, 0o644);
      try {
        const ansD = await a('gate_answer', { gate_id: rd.gate_id, chosen: ['approve'], verdict: 'approve' }, metaFor(good));
        assert.equal(ansD.ok, true, JSON.stringify(ansD));
        assert.equal(ansD.answered_via, 'mcp_relayed', 'loose token mode: ' + JSON.stringify(ansD));
      } finally {
        fs.chmodSync(TOKEN_FILE, 0o600);
      }
    });

    // -------------------------------------------------------------------------------- A3
    let g3 = null;
    let s3 = null;
    let m3 = null;
    await arm('A3 a valid proof in _meta records browser_nonce; A3b a mirror answered with a proof writes the source anchor with the route and via_gate_id', async () => {
      const c3 = freshClaim();
      const r = await render({ header: 'Ratify claim A3?', subject_node_id: c3 });
      assert.equal(r.ok, true, JSON.stringify(r));
      g3 = r.gate_id;
      const proof = proofFor(token(), g3, 'nonce-a3');
      const ans = await a('gate_answer', { gate_id: g3, chosen: ['approve'], verdict: 'approve' }, metaFor(proof));
      assert.equal(ans.ok, true, JSON.stringify(ans));
      assert.equal(ans.answered_via, 'browser_nonce', 'a proof reaches the handler: ' + JSON.stringify(ans));
      assert.equal(answerProps(roomX, g3)[0].answered_via, 'browser_nonce', 'record');
      assert.equal(nodeProps(roomX, 'decision:gate:' + g3).answered_via, 'browser_nonce', 'decision node');
      const reasons = promotedReasons(roomX, 'decision:gate:' + g3);
      assert.ok(reasons.some((x) => typeof x === 'string' && x.includes(BROWSER_TEXT)), 'confirm reason: ' + JSON.stringify(reasons));
      // the proof itself is never stored
      const blob = JSON.stringify(answerProps(roomX, g3)) + JSON.stringify(nodeProps(roomX, 'decision:gate:' + g3));
      assert.ok(!blob.includes(proof.mac) && !blob.includes(proof.tag), 'the proof is not stored');

      // A3b
      const src = await raise({ header: 'Ratify claim A3b?', subject_node_id: freshClaim() });
      assert.equal(src.ok, true, JSON.stringify(src));
      s3 = src.gate_id;
      const mir = await a('gate_render', { mirror_of: s3, options: OPTIONS });
      assert.equal(mir.ok, true, JSON.stringify(mir));
      m3 = mir.gate_id;
      const mProof = proofFor(token(), m3, 'nonce-a3b');
      const ansM = await a('gate_answer', { gate_id: m3, chosen: ['approve'], verdict: 'approve' }, metaFor(mProof));
      assert.equal(ansM.ok, true, JSON.stringify(ansM));
      assert.equal(ansM.answered_via, 'browser_nonce', JSON.stringify(ansM));
      const anchors = answerProps(roomX, s3);
      assert.equal(anchors.length, 1, 'one source anchor');
      assert.equal(anchors[0].answered_via, 'browser_nonce', 'source anchor route');
      assert.equal(anchors[0].via_gate_id, m3, 'source anchor names the mirror under via_gate_id');
      const st = await a('gate_list', { gate_id: s3 });
      assert.equal(st.gate.state, 'answered', JSON.stringify(st));
      assert.equal(st.gate.answered.answered_via, 'browser_nonce', JSON.stringify(st));
      assert.equal(st.gate.answered.decision_node_id, 'decision:gate:' + m3, JSON.stringify(st));
      assert.equal(st.gate.answered.via_gate_id, m3, JSON.stringify(st));
    });

    // -------------------------------------------------------------------------------- A4
    await arm('A4 a replay reports the recorded marker, never the route of the repeating call', async () => {
      assert.ok(g1 && g3 && s3);
      const rep3 = await a('gate_answer', { gate_id: g3, chosen: ['approve'], verdict: 'approve' });
      assert.equal(rep3.replayed, true, JSON.stringify(rep3));
      assert.equal(rep3.answered_via, 'browser_nonce', 'recorded browser_nonce, repeated without a proof: ' + JSON.stringify(rep3));
      const rep1 = await a('gate_answer', { gate_id: g1, chosen: ['approve'], verdict: 'approve' }, metaFor(proofFor(token(), g1, 'nonce-late')));
      assert.equal(rep1.replayed, true, JSON.stringify(rep1));
      assert.equal(rep1.answered_via, 'mcp_relayed', 'recorded mcp_relayed, repeated with a valid proof: ' + JSON.stringify(rep1));
      const own = await cli.call('gate_answer', { gate_id: s3, chosen: ['hold'], verdict: 'defer' });
      assert.equal(own.answered_elsewhere, true, JSON.stringify(own));
      assert.equal(own.answered_via, 'browser_nonce', 'the source owner reads the recorded route: ' + JSON.stringify(own));
    });

    // -------------------------------------------------------------------------------- A5
    await arm('A5 readGateAnswerAnchor maps a 369-36 era row to via_gate_id and reads unrecorded', async () => {
      const proj = require('../lib/core/navigation/room-projection.cjs');
      const { DatabaseSync } = require('node:sqlite');
      const mem = new DatabaseSync(':memory:');
      try {
        mem.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
        const put = (id, type, props) => mem.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(id, type, JSON.stringify(props));
        put('ev:legacy', 'memory_event', { dedupe_key: 'gate_answer:S-old', verdict: 'approve', chosen: ['approve'], answered_via: 'M-old' });
        put('decision:gate:M-old', 'decision', { text: 'x' });
        put('ev:bare', 'memory_event', { dedupe_key: 'gate_answer:S-bare', verdict: 'reject', chosen: ['reject'] });
        put('ev:new', 'memory_event', { dedupe_key: 'gate_answer:S-new', verdict: 'approve', chosen: ['approve'], answered_via: 'browser_nonce', via_gate_id: 'M-new' });
        put('decision:gate:M-new', 'decision', { text: 'y' });
        const legacy = proj.readGateAnswerAnchor(mem, 'S-old');
        assert.equal(legacy.found, true);
        assert.equal(legacy.answered_via, 'unrecorded', JSON.stringify(legacy));
        assert.equal(legacy.via_gate_id, 'M-old', JSON.stringify(legacy));
        assert.equal(legacy.decision_node_id, 'decision:gate:M-old', JSON.stringify(legacy));
        const bare = proj.readGateAnswerAnchor(mem, 'S-bare');
        assert.equal(bare.found, true);
        assert.equal(bare.answered_via, 'unrecorded', JSON.stringify(bare));
        assert.ok(bare.via_gate_id === undefined || bare.via_gate_id === null, JSON.stringify(bare));
        const fresh = proj.readGateAnswerAnchor(mem, 'S-new');
        assert.equal(fresh.answered_via, 'browser_nonce', JSON.stringify(fresh));
        assert.equal(fresh.via_gate_id, 'M-new', JSON.stringify(fresh));
        assert.equal(fresh.decision_node_id, 'decision:gate:M-new', JSON.stringify(fresh));
      } finally {
        mem.close();
      }
    });

    // -------------------------------------------------------------------------------- A6
    await arm('A6 static: schema keys, one routeOf call, the Part 9 sentence, parity, never throws, one _ledger.delete(', async () => {
      const gateSrc = fs.readFileSync(path.join(REPO, 'lib/mcp/tools/gate.cjs'), 'utf8');
      const routeSrc = fs.readFileSync(path.join(REPO, 'lib/mcp/answer-route.cjs'), 'utf8');
      // the gate_answer input schema is exactly chosen, gate_id, verdict
      const handlers = {};
      const cfgs = {};
      const fakeServer = {
        registerTool(name, cfg, handler) { handlers[name] = handler; cfgs[name] = cfg; },
        server: { getClientCapabilities: () => ({}), getClientVersion: () => ({ name: 'av2', version: '1.0.0' }) },
      };
      require('../lib/mcp/tools/gate.cjs').register(fakeServer, {});
      const keys = Object.keys(cfgs.gate_answer.inputSchema.shape).sort();
      assert.deepEqual(keys, ['chosen', 'gate_id', 'verdict'], 'gate_answer input keys: ' + keys.join(','));
      assert.equal((stripComments(gateSrc).match(/answerRoute\.routeOf\(/g) || []).length, 1, 'exactly one routeOf call in gate.cjs');
      assert.ok(gateSrc.includes('proven by the route, not asserted'), 'gate.cjs carries the Part 9 sentence');
      assert.ok(routeSrc.includes('proven by the route, not asserted'), 'answer-route.cjs carries the Part 9 sentence');
      const route = require('../lib/mcp/answer-route.cjs');
      const proj = require('../lib/core/navigation/room-projection.cjs');
      assert.deepEqual(Array.from(route.ANSWERED_VIA_VALUES), ['browser_nonce', 'mcp_relayed']);
      assert.deepEqual(Array.from(proj.ANSWER_ROUTES), Array.from(route.ANSWERED_VIA_VALUES), 'room-projection route set equals answer-route');
      assert.equal(route.META_KEY, META_KEY);
      assert.equal(route.ROUTE_KEY_LABEL, ROUTE_LABEL);
      // the token path equals the launcher's, with the env override unset
      const launch = require('../lib/ui-shell/launch.cjs');
      const saved = process.env.MOS_SHELL_CONTROL_TOKEN_FILE;
      delete process.env.MOS_SHELL_CONTROL_TOKEN_FILE;
      try {
        assert.equal(route.controlTokenFile(), launch.controlTokenFile(), 'same default token path as the launcher');
      } finally {
        process.env.MOS_SHELL_CONTROL_TOKEN_FILE = saved;
      }
      // routeOf never throws and degrades to mcp_relayed
      const good = proofFor(token(), 'gate-x', 'n');
      const bad = [
        null, undefined, {}, { mcpReq: null }, { mcpReq: { _meta: 5 } }, { mcpReq: { _meta: { [META_KEY]: 'x' } } },
        { mcpReq: { _meta: { [META_KEY]: Object.assign({}, good, { v: 2 }) } } },
        { mcpReq: { _meta: { [META_KEY]: Object.assign({}, good, { tag: 'zz' }) } } },
        { mcpReq: { _meta: { [META_KEY]: Object.assign({}, good, { mac: 'NOT-HEX' }) } } },
        { mcpReq: { _meta: { [META_KEY]: { v: 1, tag: 5, mac: {} } } } },
      ];
      for (const extra of bad) {
        assert.equal(route.routeOf(extra, 'gate-x'), 'mcp_relayed', 'routeOf(' + JSON.stringify(extra) + ')');
      }
      assert.equal(route.routeOf({ mcpReq: { _meta: metaFor(good) } }, ''), 'mcp_relayed', 'an empty gate id never proves');
      assert.equal(route.routeOf({ mcpReq: { _meta: metaFor(good) } }, 'gate-x'), 'browser_nonce', 'a good proof, v2 era shape');
      assert.equal(route.routeOf({ _meta: metaFor(good) }, 'gate-x'), 'browser_nonce', 'a good proof, v1 era shape');
      assert.ok(route.confirmReason('base', 'browser_nonce').includes(BROWSER_TEXT));
      assert.ok(route.confirmReason('base', 'anything-else').includes(RELAY_TEXT));
      const ledgerSrc = stripComments(fs.readFileSync(path.join(REPO, 'lib/mcp/gate-ledger.cjs'), 'utf8'));
      assert.equal((ledgerSrc.match(/_ledger\.delete\(/g) || []).length, 1, 'gate-ledger.cjs keeps exactly one _ledger.delete(');
    });

    // -------------------------------------------------------------------------------- shell half
    const daemonUrl = () => 'http://127.0.0.1:' + h.port;
    pool = sessionsMod.makePool(daemonUrl);
    const relay = feedMod.makeRelay(pool, daemonUrl);
    const connection = connMod.createConnectionStates();
    const proposalRef = { current: null };
    const proposalSource = { propose: (request) => proposalMod.fixedProposalSource(proposalRef.current).propose(request) };
    const actions = actionsMod.createShellActions({ pool, proposalSource, relay, connection });
    const store = authMod.createSessionStore();
    const X = authMod.issueSession(store).session;
    const human = (name, input) => actions.invoke(name, input, { principal: 'human', browserSession: X });
    const proposal = (subject) => ({
      subject_node_id: subject,
      verdict_options: [
        { id: 'approve', label: 'Approve', description: 'Confirm this claim.' },
        { id: 'reject', label: 'Reject' },
        { id: 'defer', label: 'Defer' },
      ],
      recommended_id: 'approve',
      evidence_node_ids: [],
      rationale: 'The claim names a located source.',
    });
    assert.equal((await human('openRoom', { room: 'room-x' })).ok, true, 'the browser session opens room-x');

    async function shellApprove(subject, question) {
      proposalRef.current = proposal(subject);
      const own = await human('askClaude', { selectedNodeId: subject, question: question });
      assert.equal(own.ok, true, JSON.stringify(own));
      const read = await human('readGate', { gate_id: own.gate_id });
      assert.equal(read.ok, true, JSON.stringify(read));
      assert.equal(typeof read.render_nonce, 'string');
      const ans = await human('approveDecision', { gate_id: own.gate_id, chosen: ['approve'], verdict: 'approve', render_nonce: read.render_nonce });
      return { gate_id: own.gate_id, answer: ans };
    }

    await arm('B1 approveDecision after readGate records browser_nonce on the reply, record, decision node and confirm reason', async () => {
      const r = await shellApprove(freshClaim(), 'Confirm the B1 claim?');
      assert.equal(r.answer.ok, true, JSON.stringify(r.answer));
      assert.equal(r.answer.answered_via, 'browser_nonce', 'reply: ' + JSON.stringify(r.answer));
      assert.equal(answerProps(roomX, r.gate_id).length >= 1, true);
      assert.equal(answerProps(roomX, r.gate_id)[0].answered_via, 'browser_nonce', 'answer record');
      assert.equal(nodeProps(roomX, 'decision:gate:' + r.gate_id).answered_via, 'browser_nonce', 'decision node');
      const reasons = promotedReasons(roomX, 'decision:gate:' + r.gate_id);
      assert.ok(reasons.some((x) => typeof x === 'string' && x.includes(BROWSER_TEXT)), 'confirm reason: ' + JSON.stringify(reasons));
    });

    await arm('B2 the daemon checks the proof: a swapped token file turns the same click into mcp_relayed', async () => {
      const original = token();
      fs.writeFileSync(TOKEN_FILE, 'a-different-token-written-behind-the-shell\n', { mode: 0o600 });
      fs.chmodSync(TOKEN_FILE, 0o600);
      let r;
      try {
        r = await shellApprove(freshClaim(), 'Confirm the B2 claim?');
      } finally {
        controlMod.startControl(TOKEN_FILE); // restores the pair
      }
      assert.notEqual(token(), original, 'a fresh token was minted');
      assert.equal(r.answer.ok, true, JSON.stringify(r.answer));
      assert.equal(r.answer.answered_via, 'mcp_relayed', 'swapped file: ' + JSON.stringify(r.answer));
      assert.equal(answerProps(roomX, r.gate_id)[0].answered_via, 'mcp_relayed', 'answer record');
      // and with the pair restored the next click is a proven one
      const again = await shellApprove(freshClaim(), 'Confirm the B2b claim?');
      assert.equal(again.answer.answered_via, 'browser_nonce', 'restored pair: ' + JSON.stringify(again.answer));
    });

    await arm('B3 a CLI-raised gate approved in the shell: source anchor browser_nonce + via_gate_id; the owner replays answered_elsewhere', async () => {
      const src = await raise({ header: 'Ratify claim B3?', subject_node_id: freshClaim() });
      assert.equal(src.ok, true, JSON.stringify(src));
      const S = src.gate_id;
      const read = await human('readGate', { gate_id: S });
      assert.equal(read.ok, true, JSON.stringify(read));
      const rec = actions.recordedGate(X.mcpKey, S);
      assert.ok(rec && rec.mcp_gate_id && rec.mcp_gate_id !== S, 'a mirror was raised');
      const ans = await human('approveDecision', { gate_id: S, chosen: ['approve'], verdict: 'approve', render_nonce: read.render_nonce });
      assert.equal(ans.ok, true, JSON.stringify(ans));
      const anchors = answerProps(roomX, S);
      assert.equal(anchors.length, 1, 'one source anchor');
      assert.equal(anchors[0].answered_via, 'browser_nonce', 'source anchor route');
      assert.equal(anchors[0].via_gate_id, rec.mcp_gate_id, 'source anchor names the mirror');
      const owner = await cli.call('gate_answer', { gate_id: S, chosen: ['hold'], verdict: 'defer' });
      assert.equal(owner.answered_elsewhere, true, JSON.stringify(owner));
      assert.equal(owner.answered_via, 'browser_nonce', JSON.stringify(owner));
    });

    await arm('B4 static: one answerRouteMeta( call between nonces.reserve( and gateAnswer(; no meta from adapterCall; literals match answer-route.cjs', async () => {
      const act = fs.readFileSync(path.join(REPO, 'ui/shell/server/actions.ts'), 'utf8');
      assert.equal((act.match(/answerRouteMeta\(/g) || []).length, 1, 'one answerRouteMeta( call site');
      const start = act.indexOf("'approveDecision'");
      assert.ok(start > 0, 'approveDecision is defined');
      const body = act.slice(start);
      const iReserve = body.indexOf('nonces.reserve(');
      const iMeta = body.indexOf('answerRouteMeta(');
      const iAnswer = body.indexOf('gateAnswer(');
      assert.ok(iReserve > 0 && iMeta > iReserve && iAnswer > iMeta, 'order reserve < answerRouteMeta < gateAnswer: ' + [iReserve, iMeta, iAnswer].join(','));
      const poolSrc = fs.readFileSync(path.join(REPO, 'ui/shared/src/mcp-session-pool.ts'), 'utf8');
      const m = poolSrc.match(/async function adapterCall\([\s\S]*?\n  \}\n/) || poolSrc.match(/adapterCall[\s\S]{0,600}/);
      assert.ok(m, 'adapterCall is present');
      assert.ok(!/meta/i.test(m[0]), 'adapterCall passes no meta: ' + m[0].slice(0, 200));
      const ctl = fs.readFileSync(path.join(REPO, 'ui/shell/server/control.ts'), 'utf8');
      const route = require('../lib/mcp/answer-route.cjs');
      assert.ok(ctl.includes("'" + route.META_KEY + "'"), 'control.ts carries META_KEY');
      assert.ok(ctl.includes("'" + route.ROUTE_KEY_LABEL + "'"), 'control.ts carries ROUTE_KEY_LABEL');
      assert.equal(typeof controlMod.answerRouteMeta, 'function', 'control.ts exports answerRouteMeta');
    });

    await arm('dash guard: no long dash in any file this quick touches', async () => {
      const bad = [];
      for (const rel of TOUCHED) {
        const buf = fs.readFileSync(path.join(REPO, rel));
        for (let i = 0; i + 2 < buf.length; i += 1) {
          if (buf[i] === 0xe2 && buf[i + 1] === 0x80 && (buf[i + 2] === 0x94 || buf[i + 2] === 0x93)) { bad.push(rel); break; }
        }
      }
      assert.deepEqual(bad, [], 'long dash in: ' + bad.join(', '));
      const own = fs.readFileSync(__filename, 'utf8');
      assert.ok(!own.includes(EM) && !own.includes(EN));
    });
  } finally {
    for (const c of clients) { try { await c.close(); } catch (_e) { /* best effort */ } }
    if (pool) { try { await pool.closeAll(); } catch (_e) { /* best effort */ } }
    if (cli) { try { await cli.close(); } catch (_e) { /* best effort */ } }
    if (h) { try { await D.stopDaemon(h); } catch (_e) { /* best effort */ } }
    try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(() => {
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}, (err) => {
  console.log('ERROR: ' + String((err && err.stack) || err));
  process.exit(1);
});
