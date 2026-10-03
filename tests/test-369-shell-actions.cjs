// SHELL369-04, SHELL369-05 and HUM369-01: the signed-in browser's door to the room (plan 369-32).
//
// Arms 1-5 run the shell's server modules in process against the hermetic flag-ON daemon (fixture
// rooms): the ten review-and-decision actions with exposure enforced by the server, one legacy MCP
// session per browser session, a gate minted on the BROWSER session's MCP key, the room restored after
// a daemon restart (bake-off transplant 1, measured against the 315 ms target). Arms 6-10 run over real
// HTTP against the built shell (`cd ui/shell && npm run build`): the CSRF-checked action route, the feed
// relay endpoints and the connection state. Exit 77 only for an environment gap, reported by name (the
// build output absent, the daemon or the root dependencies not installable).
//
// Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; no CLAUDE_ACTIVE_ROOM or
// CLAUDE_CODE_SESSION_ID; every server binds 127.0.0.1 only; telemetry off; this test kills only the
// processes it spawned.
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHELL = path.join(REPO, 'ui', 'shell');
const SHARED = path.join(REPO, 'ui', 'shared');
const STANDALONE = path.join(SHELL, '.next', 'standalone');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-actions-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DO_NOT_TRACK = '1';

// ui/shell resolves `mos-ui-shared/<name>` through its node_modules entry. Node refuses to strip types for a file
// under node_modules, and an install may place a copy there instead of a link, so the in-process arms resolve that
// specifier straight to ui/shared/src (the same files the chassis bundles).
require('node:module').registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('mos-ui-shared/')) {
      return nextResolve(pathToFileURL(path.join(SHARED, 'src', specifier.slice('mos-ui-shared/'.length) + '.ts')).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const D = require('./helpers/mcp-daemon-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const RECONNECT_TARGET_MS = 315;

let passed = 0;
let failed = 0;
let envGap = null;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 10).join('\n    '));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

const EXPECTED = {
  listRooms: 'both',
  openRoom: 'human',
  roomDoc: 'both',
  readArtifact: 'both',
  feedChanges: 'human',
  askClaude: 'human',
  proposeDecision: 'agent',
  readGate: 'human',
  listOpenGates: 'human',
  approveDecision: 'human',
};

function listFiles(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      listFiles(p, out);
    } else out.push(p);
  }
  return out;
}

// A child process that commits one claim through the write door (so the daemon's watcher sees an
// outside writer, as a CLI hook would be).
function childWrite(roomDir, id, env) {
  const script =
    'const { openRoomDb, closeRoomDb } = require(' + JSON.stringify(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ');' +
    'const { insertNode } = require(' + JSON.stringify(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ');' +
    'const db = openRoomDb(' + JSON.stringify(roomDir) + ');' +
    "try { insertNode(db, " + JSON.stringify(id) + ", 'claim', JSON.stringify({ text: 'shell write ' + " + JSON.stringify(id) + " }), { epistemic_type: 'observation' }); } finally { closeRoomDb(db); }";
  return new Promise((resolve, reject) => {
    const child = cp.spawn('node', ['-e', script], {
      env: Object.assign({}, env || process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME }),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (c) => { err += c.toString('utf8'); });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('child write failed (' + code + '): ' + err.slice(-300)))));
  });
}

async function killChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', () => resolve()));
  try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  await Promise.race([exited, sleep(5000)]);
}

// ---------------------------------------------------------------------------------------------
// Arms 1-5: in process
// ---------------------------------------------------------------------------------------------

async function inProcessArms() {
  const actionsMod = await load('ui/shell/server/actions.ts');
  const sessionsMod = await load('ui/shell/server/sessions.ts');
  const connMod = await load('ui/shell/server/connection-state.ts');
  const feedMod = await load('ui/shell/server/feed-routes.ts');
  const authMod = await load('ui/shell/server/auth.ts');
  const proposalMod = await load('ui/shared/src/proposal.ts');

  console.log('static and registry arms');

  // A throwaway pool, relay and connection state are enough for arms that never reach the daemon.
  const dormant = sessionsMod.makePool(() => 'http://127.0.0.1:9');
  const dormantActions = actionsMod.createShellActions({
    pool: dormant,
    proposalSource: { propose: async () => { throw new Error('no_proposal'); } },
    relay: feedMod.makeRelay(dormant, () => 'http://127.0.0.1:9'),
    connection: connMod.createConnectionStates(),
  });

  await arm('1 the registered names are exactly the ten review-and-decision actions; the four write actions are absent', async () => {
    assert.deepStrictEqual(dormantActions.names().slice().sort(), Object.keys(EXPECTED).slice().sort());
    assert.deepStrictEqual(actionsMod.ACTION_NAMES.slice().sort(), Object.keys(EXPECTED).slice().sort());
    for (const absent of ['fileArtifact', 'reviseClaim', 'attachEvidence', 'publishDeliverable']) {
      assert.strictEqual(dormantActions.registry.get(absent), undefined, absent + ' must not be registered');
      assert.deepStrictEqual(await dormantActions.invoke(absent, {}, { principal: 'human', browserSession: { mcpKey: 'k' } }), { ok: false, reason: 'unknown_action' });
    }
    // The only text in actions.ts that names them is the one comment line saying they are absent.
    const src = fs.readFileSync(path.join(SHELL, 'server', 'actions.ts'), 'utf8').split('\n');
    const naming = src.filter((l) => /fileArtifact|reviseClaim|attachEvidence|publishDeliverable/.test(l));
    assert.strictEqual(naming.length, 1, 'one line names the absent write actions: ' + naming.length);
    assert.ok(/^\s*\*/.test(naming[0]), 'and it is a comment line: ' + naming[0]);
  });

  await arm('2 every action declares an exposure; approveDecision and openRoom are human, proposeDecision is agent', async () => {
    for (const a of dormantActions.registry.list()) {
      assert.ok(['agent', 'human', 'both'].includes(a.exposure), a.name + ' has no exposure');
      assert.strictEqual(a.exposure, EXPECTED[a.name], a.name + ' exposure');
    }
    assert.strictEqual(dormantActions.registry.get('approveDecision').exposure, 'human');
    assert.strictEqual(dormantActions.registry.get('openRoom').exposure, 'human');
    assert.strictEqual(dormantActions.registry.get('proposeDecision').exposure, 'agent');
    const agentSet = dormantActions.registry.callableBy('agent').map((a) => a.name).sort();
    assert.deepStrictEqual(agentSet, ['listRooms', 'proposeDecision', 'readArtifact', 'roomDoc']);
  });

  await arm('3 the principal comes from the code path: an agent cannot reach a human action, a forged input principal changes nothing', async () => {
    const ctxAgent = { principal: 'agent', browserSession: { mcpKey: 'k' } };
    const ctxHuman = { principal: 'human', browserSession: { mcpKey: 'k' } };
    const body = { gate_id: 'g', chosen: ['approve'], verdict: 'approve' };
    const refused = await dormantActions.invoke('approveDecision', body, ctxAgent);
    assert.strictEqual(refused.ok, false);
    assert.strictEqual(refused.reason, 'human_only');
    const forged = await dormantActions.invoke('approveDecision', Object.assign({ principal: 'human' }, body), ctxAgent);
    assert.strictEqual(forged.reason, 'human_only', 'a principal field in the input is ignored');
    console.log('  forged principal: human in the input, agent path: ' + JSON.stringify(forged));
    for (const name of ['openRoom', 'feedChanges', 'askClaude', 'readGate', 'listOpenGates']) {
      assert.strictEqual((await dormantActions.invoke(name, {}, ctxAgent)).reason, 'human_only', name + ' is human only');
    }
    const wrongWay = await dormantActions.invoke('proposeDecision', { principal: 'agent', proposal: {} }, ctxHuman);
    assert.strictEqual(wrongWay.reason, 'human_only', 'the agent-only action is refused to the browser path');
    assert.strictEqual(wrongWay.exposure, 'agent');
    assert.strictEqual((await dormantActions.invoke('listRooms', {}, { principal: 'sneaky', browserSession: { mcpKey: 'k' } })).reason, 'principal_required');
    assert.strictEqual((await dormantActions.invoke('listRooms', {}, undefined)).reason, 'principal_required');
    assert.strictEqual((await dormantActions.invoke('nope', {}, ctxHuman)).reason, 'unknown_action');
    const bad = await dormantActions.invoke('openRoom', { room: '' }, ctxHuman);
    assert.strictEqual(bad.reason, 'bad_input');
  });

  await arm('4 static: no file under ui/shell/app imports the generated adapter; no HTTP route maps to an adapter wrapper', async () => {
    for (const f of listFiles(path.join(SHELL, 'app'))) {
      assert.ok(!/generated\/mcp-adapter/.test(fs.readFileSync(f, 'utf8')), f + ' imports the generated adapter');
    }
    for (const f of listFiles(path.join(SHELL, 'client'))) {
      assert.ok(!/generated\/mcp-adapter/.test(fs.readFileSync(f, 'utf8')), f + ' imports the generated adapter');
    }
    const routes = listFiles(path.join(SHELL, 'app')).filter((f) => /route\.ts$/.test(f)).map((f) => path.relative(path.join(SHELL, 'app'), f).split(path.sep).join('/')).sort();
    assert.deepStrictEqual(routes, [
      'api/actions/[name]/route.ts', 'api/feed/changes/route.ts', 'api/feed/hint/route.ts', 'api/feed/room/route.ts',
      'api/status/route.ts', 'auth/bootstrap/route.ts', 'control/bootstrap/route.ts',
    ]);
    const sessionsSrc = fs.readFileSync(path.join(SHELL, 'server', 'sessions.ts'), 'utf8');
    assert.ok(/createSessionPool/.test(sessionsSrc) && /mindrian-shell/.test(sessionsSrc));
    const clientSrc = fs.readFileSync(path.join(SHELL, 'client', 'RoomPicker.tsx'), 'utf8');
    assert.ok(!/dangerouslySetInnerHTML|innerHTML/.test(clientSrc), 'room content renders as text');
    for (const f of [path.join(SHELL, 'server', 'actions.ts'), path.join(SHELL, 'server', 'sessions.ts'), path.join(SHELL, 'server', 'feed-routes.ts'), path.join(SHELL, 'server', 'connection-state.ts'), path.join(SHELL, 'client', 'RoomPicker.tsx')]) {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(!src.includes(EM) && !src.includes(EN), f + ' carries a long dash');
      assert.ok(!/from ['"](\.\.\/)+lib\/|require\(['"](\.\.\/)+lib\//.test(src), f + ' imports from lib/');
      assert.ok(!/node:sqlite|room\.db/.test(src), f + ' touches the room database');
    }
  });

  await arm('4b connection state: "connected" only after an acknowledged round trip; failures read reconnecting then disconnected', async () => {
    let t = 1000;
    const s = connMod.createConnectionStates({ now: () => t });
    assert.deepStrictEqual(s.get('k'), { connection: 'disconnected', lastAckAt: null, mcpSessionPrefix: null, roomSlug: null, version: null });
    s.recordFailure('k');
    assert.strictEqual(s.get('k').connection, 'disconnected', 'a failure before any acknowledgement is not "reconnecting"');
    s.recordAck('k', { mcpSessionId: 'abcdef0123456789', roomSlug: 'room-x', version: '1.1.0' });
    t = 2000;
    assert.deepStrictEqual(s.get('k'), { connection: 'connected', lastAckAt: 1000, mcpSessionPrefix: 'abcdef01', roomSlug: 'room-x', version: '1.1.0' });
    s.recordFailure('k');
    assert.strictEqual(s.get('k').connection, 'reconnecting');
    assert.strictEqual(s.get('k').lastAckAt, 1000, 'the last acknowledgement is kept');
    s.recordFailure('k');
    s.recordFailure('k');
    assert.strictEqual(s.get('k').connection, 'disconnected');
    s.recordAck('k', {});
    assert.strictEqual(s.get('k').connection, 'connected');
    s.forget('k');
    assert.strictEqual(s.size(), 0);
  });

  await arm('4c sweep: an expired browser session loses its remembered room and record; the pool sweeps idle MCP sessions', async () => {
    let t = 10_000_000;
    const store = authMod.createSessionStore({ now: () => t });
    const a = store.issue();
    t += 20 * 60 * 1000;
    const b = store.issue();
    t += 15 * 60 * 1000; // a idle 35 min (expired), b idle 15 min (alive)
    sessionsMod.rememberRoom(a.mcpKey, 'room-x');
    sessionsMod.rememberRoom(b.mcpKey, 'room-y');
    let swept = 0;
    const gone = [];
    const out = await sessionsMod.sweepSessions({ store, pool: { sweepIdle: async () => { swept += 1; return 1; } }, onExpired: (k) => gone.push(k) });
    assert.deepStrictEqual(out, { expired: 1, closed: 1 });
    assert.deepStrictEqual(gone, [a.mcpKey]);
    assert.strictEqual(swept, 1);
    assert.strictEqual(sessionsMod.rememberedRoom(a.mcpKey), null);
    assert.strictEqual(sessionsMod.rememberedRoom(b.mcpKey), 'room-y');
    assert.strictEqual(store.read(b.id).id, b.id);
    assert.strictEqual(sessionsMod.sessionFor(b), b.mcpKey);
    assert.throws(() => sessionsMod.sessionFor({}));
    // authorizeApi: origin guard first, then the session, then CSRF.
    const hdr = (o) => ({ get: (n) => (n.toLowerCase() in o ? o[n.toLowerCase()] : null) });
    const cookie = 'mos_shell_sid=' + b.id;
    const base = { host: '127.0.0.1:3369', cookie };
    assert.deepStrictEqual(sessionsMod.authorizeApi({ headers: hdr(Object.assign({}, base, { host: 'evil.example' })), port: 3369 }, { csrf: true }, store), { ok: false, status: 403, reason: 'bad_host' });
    assert.strictEqual(sessionsMod.authorizeApi({ headers: hdr({ host: '127.0.0.1:3369' }), port: 3369 }, { csrf: false }, store).status, 401);
    assert.strictEqual(sessionsMod.authorizeApi({ headers: hdr(base), port: 3369 }, { csrf: true }, store).reason, 'csrf_missing');
    assert.strictEqual(sessionsMod.authorizeApi({ headers: hdr(base), port: 3369 }, { csrf: false }, store).ok, true);
    assert.strictEqual(sessionsMod.authorizeApi({ headers: hdr(Object.assign({}, base, { 'x-mos-csrf': b.csrf })), port: 3369 }, { csrf: true }, store).ok, true);
  });

  // ------ live arm ------

  console.log('live arms against the hermetic flag-ON daemon');
  let h = null;
  try {
    h = await D.startDaemon({
      rooms: [
        { slug: 'room-x', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' }] },
        { slug: 'room-y', variant: 'wide', migrate: true },
      ],
    });
  } catch (err) {
    envGap = 'the hermetic daemon could not start (' + (err && err.message ? String(err.message).slice(0, 200) : err) + ')';
    console.log('ENV GAP: ' + envGap);
    return null;
  }

  let port = h.port;
  const daemonUrl = () => 'http://127.0.0.1:' + port;
  const pool = sessionsMod.makePool(daemonUrl);
  const relay = feedMod.makeRelay(pool, daemonUrl);
  const connection = connMod.createConnectionStates();
  const proposalRef = { current: null };
  const proposalSource = {
    propose: (request) => proposalMod.fixedProposalSource(proposalRef.current).propose(request),
  };
  const actions = actionsMod.createShellActions({ pool, proposalSource, relay, connection });
  const store = authMod.createSessionStore();
  const X = authMod.issueSession(store).session;
  const ctx = (principal) => ({ principal, browserSession: X });
  const human = (name, input) => actions.invoke(name, input, ctx('human'));
  let claimId = null;
  let gate1 = null;
  let current = h;

  try {
    await arm('5a openRoom binds through the pool; listRooms and roomDoc answer; feedChanges returns a page with an epoch', async () => {
      const rooms = await human('listRooms', {});
      assert.strictEqual(rooms.ok, true, JSON.stringify(rooms));
      const slugs = rooms.rooms.map((r) => r.slug);
      assert.ok(slugs.includes('room-x') && slugs.includes('room-y'), slugs.join(','));
      assert.strictEqual(rooms.current, null, 'nothing is open yet');
      const unbound = await human('roomDoc', {});
      assert.strictEqual(unbound.reason, 'room_unbound');

      const opened = await human('openRoom', { room: 'room-x' });
      assert.deepStrictEqual(opened, { ok: true, room: 'room-x' });
      assert.strictEqual((await pool.get(X.mcpKey)).boundRoom, 'room-x', 'the pool recorded the bound room (transplant 1)');
      assert.strictEqual(connection.get(X.mcpKey).connection, 'connected');
      assert.strictEqual(connection.get(X.mcpKey).roomSlug, 'room-x');
      assert.strictEqual(connection.get(X.mcpKey).mcpSessionPrefix.length, 8);

      const doc = await human('roomDoc', {});
      assert.strictEqual(doc.ok, true, JSON.stringify(doc));
      assert.strictEqual(doc.room.slug, 'room-x');
      assert.strictEqual(doc.room.question, 'No governing question recorded yet.');
      assert.strictEqual(doc.room.has_question, false);
      assert.ok(doc.room.counts.nodes >= 1, JSON.stringify(doc.room.counts));
      assert.ok(typeof doc.room.purpose === 'string' && doc.room.purpose.length > 0);

      const page = await human('feedChanges', { collection: 'nodes' });
      assert.strictEqual(page.ok, true, JSON.stringify(page).slice(0, 300));
      assert.strictEqual(typeof page.epoch, 'string');
      const claim = page.changes.find((c) => c.doc && c.doc.type === 'claim');
      assert.ok(claim, 'the seeded claim is in the nodes page');
      claimId = claim.entity_id;
      assert.ok(typeof page.through === 'number');
      // The human feed action is not reachable from the agent path (arm 3), and a bad collection is refused.
      assert.strictEqual((await human('feedChanges', { collection: 'rooms' })).reason, 'bad_input');

      // readArtifact is a pass-through of the contained reader.
      const art = await human('readArtifact', { path: '../outside.md' });
      assert.strictEqual(art.ok, false);
    });

    await arm('5b askClaude mints a gate on the BROWSER session MCP key; the adapter session never touches it', async () => {
      assert.ok(claimId, '5a found the seeded claim');
      proposalRef.current = {
        subject_node_id: claimId,
        verdict_options: [
          { id: 'approve', label: 'Approve', description: 'Confirm this claim.' },
          { id: 'reject', label: 'Reject' },
          { id: 'defer', label: 'Defer' },
        ],
        recommended_id: 'approve',
        evidence_node_ids: [],
        rationale: 'The claim names a located source.',
      };
      const asked = await human('askClaude', { selectedNodeId: claimId, question: 'Should this claim be confirmed?' });
      assert.strictEqual(asked.ok, true, JSON.stringify(asked));
      gate1 = asked.gate_id;
      assert.strictEqual(asked.room, 'room-x');
      const rec = actions.recordedGate(X.mcpKey, gate1);
      assert.ok(rec, 'the gate is recorded against the browser session');
      assert.strictEqual(rec.mcp_key, X.mcpKey, 'recorded MCP key is the browser session key');
      assert.strictEqual(rec.room, 'room-x');
      const browserSid = (await pool.get(X.mcpKey)).mcpSessionId;
      const adapterSid = (await pool.adapterSession()).mcpSessionId;
      assert.ok(browserSid && adapterSid && browserSid !== adapterSid, 'the adapter has its own MCP session');
      // The adapter session cannot answer it (the daemon refuses a stranger).
      const stranger = await pool.adapterCall('gate_answer', { gate_id: gate1, chosen: ['approve'], verdict: 'approve' });
      assert.strictEqual(stranger.data && stranger.data.ok, false, JSON.stringify(stranger.data));
      const open = await human('listOpenGates', {});
      assert.strictEqual(open.waiting, 1);
      assert.strictEqual(open.gates[0].gate_id, gate1);
      const card = await human('readGate', { gate_id: gate1 });
      assert.strictEqual(card.ok, true);
      assert.strictEqual(card.gate.options[0].id, 'approve', 'the recommended option is ranked first');
      assert.strictEqual(card.gate.options[0].rank, 1);
      assert.strictEqual(card.gate.room, 'room-x');
      assert.strictEqual((await human('readGate', { gate_id: 'gate-nope' })).reason, 'unknown_gate');
      // The agent path may propose but a browser may not.
      const viaAgent = await actions.invoke('proposeDecision', { proposal: proposalRef.current }, ctx('agent'));
      assert.strictEqual(viaAgent.ok, true, 'the agent path proposes');
      assert.strictEqual(actions.recordedGate(X.mcpKey, viaAgent.gate_id).mcp_key, X.mcpKey, 'also minted on the browser session');
      // The stranger attempt above may burn the owner's gate before Phase 289; 5c handles both outcomes.
    });

    await arm('5c approveDecision with the recommended option ratifies; the decision node arrives in the next decisions page; a replay is the server answer', async () => {
      const before = await human('feedChanges', { collection: 'decisions' });
      assert.strictEqual(before.ok, true);
      const answer = await human('approveDecision', { gate_id: gate1, chosen: ['approve'], verdict: 'approve' });
      if (answer.ok === false && answer.reason === 'unknown_or_expired_gate') {
        console.log('  KNOWN: a refused cross-session answer burned the owner gate before the ledger checks (Phase 289 fixes it); using a fresh gate');
        const fresh = await human('askClaude', { selectedNodeId: claimId, question: 'Confirm again?' });
        gate1 = fresh.gate_id;
        const again = await human('approveDecision', { gate_id: gate1, chosen: ['approve'], verdict: 'approve' });
        assert.strictEqual(again.ok, true, JSON.stringify(again));
        assert.strictEqual(again.ratified, true, JSON.stringify(again));
      } else {
        assert.strictEqual(answer.ok, true, JSON.stringify(answer));
        assert.strictEqual(answer.ratified, true, JSON.stringify(answer));
      }
      const after = await human('feedChanges', { collection: 'decisions', after: before.through, epoch: before.epoch });
      assert.strictEqual(after.ok, true, JSON.stringify(after).slice(0, 300));
      const ids = after.changes.map((c) => c.entity_id);
      assert.ok(ids.includes('decision:gate:' + gate1), 'decision node in the next page: ' + ids.join(','));
      const replay = await human('approveDecision', { gate_id: gate1, chosen: ['approve'], verdict: 'approve' });
      assert.strictEqual(replay.ok, false);
      assert.strictEqual(replay.reason, 'unknown_or_expired_gate', 'the server answer comes back unchanged');
      assert.strictEqual(actions.recordedGate(X.mcpKey, gate1), null, 'a consumed gate is dropped from the record');
    });

    let gate2 = null;
    await arm('5d openRoom to another room while a gate is open answers gate_open; confirmLeave binds and the old gate id is refused', async () => {
      // Clear any gates left open by 5b (the agent-path proposal and a possible fresh one), then mint exactly one.
      for (const g of (await human('listOpenGates', {})).gates) {
        const a = await human('approveDecision', { gate_id: g.gate_id, chosen: ['defer'], verdict: 'defer' });
        assert.ok(a.ok === true || a.reason, JSON.stringify(a));
      }
      const left = (await human('listOpenGates', {})).gates;
      assert.strictEqual(left.length, 0, 'no open gate left: ' + JSON.stringify(left));
      const asked = await human('askClaude', { selectedNodeId: claimId, question: 'A decision that stays open.' });
      assert.strictEqual(asked.ok, true, JSON.stringify(asked));
      gate2 = asked.gate_id;
      const refused = await human('openRoom', { room: 'room-y' });
      assert.strictEqual(refused.ok, false);
      assert.strictEqual(refused.reason, 'gate_open');
      assert.strictEqual(refused.gate_id, gate2);
      assert.strictEqual((await human('roomDoc', {})).room.slug, 'room-x', 'still in room-x');
      const same = await human('openRoom', { room: 'room-x' });
      assert.strictEqual(same.ok, true, 're-opening the same room is not a switch');

      const moved = await human('openRoom', { room: 'room-y', confirmLeave: true });
      assert.deepStrictEqual(moved, { ok: true, room: 'room-y' });
      assert.strictEqual((await human('roomDoc', {})).room.slug, 'room-y');
      assert.strictEqual((await human('listOpenGates', {})).waiting, 0);
      assert.strictEqual((await human('readGate', { gate_id: gate2 })).reason, 'room_switched');
      const stale = await human('approveDecision', { gate_id: gate2, chosen: ['approve'], verdict: 'approve' });
      assert.strictEqual(stale.reason, 'room_switched', JSON.stringify(stale));
      const inY = await human('feedChanges', { collection: 'decisions' });
      assert.strictEqual(inY.ok, true);
      assert.deepStrictEqual(inY.changes.filter((c) => String(c.entity_id).includes(gate2)), [], 'nothing landed in room-y');
      assert.strictEqual((await human('openRoom', { room: 'no-such-room' })).reason, 'room_unavailable');
      assert.strictEqual((await pool.get(X.mcpKey)).boundRoom, 'room-y', 'a failed open keeps the room');
    });

    await arm('5e the room is restored after the daemon is down for a while (a failed reconnect forgets the pool binding; the browser session re-binds)', async () => {
      assert.strictEqual((await human('openRoom', { room: 'room-x' })).ok, true);
      const warm = await human('feedChanges', { collection: 'nodes' });
      assert.strictEqual(warm.ok, true);
      await killChild(current.child);
      const down = await human('feedChanges', { collection: 'nodes' });
      assert.strictEqual(down.ok, false, 'a dead daemon is not a feed page: ' + JSON.stringify(down).slice(0, 200));
      assert.notStrictEqual(connection.get(X.mcpKey).connection, 'connected', 'the state did not stay connected');
      current = await D.restartDaemon(current);
      port = current.port;
      const back = await human('feedChanges', { collection: 'nodes' });
      assert.strictEqual(back.ok, true, 'the room came back with no openRoom call: ' + JSON.stringify(back).slice(0, 300));
      assert.strictEqual(back.room, 'room-x');
      assert.strictEqual((await human('roomDoc', {})).room.slug, 'room-x');
      assert.strictEqual(connection.get(X.mcpKey).connection, 'connected');
    });

    await arm('5f reconnect after a daemon restart: 6 new claims are visible through the shell with no reload (target ' + RECONNECT_TARGET_MS + ' ms)', async () => {
      const base = await human('feedChanges', { collection: 'nodes' });
      assert.strictEqual(base.ok, true);
      const through = base.through;
      const epoch = base.epoch;
      current = await D.restartDaemon(current);
      port = current.port;
      const ids = [];
      for (let i = 0; i < 6; i += 1) {
        const id = 'claim:reconnect-' + i + '-' + crypto.randomBytes(3).toString('hex');
        ids.push(id);
        await childWrite(current.roomDirs['room-x'], id, current.env);
      }
      const t0 = Date.now();
      let seen = new Set();
      let lastAnswer = null;
      for (;;) {
        lastAnswer = await human('feedChanges', { collection: 'nodes', after: through, epoch });
        if (lastAnswer.ok === true) for (const c of lastAnswer.changes) seen.add(c.entity_id);
        if (ids.every((id) => seen.has(id))) break;
        if (Date.now() - t0 > 5000) break;
        await sleep(20);
      }
      const ms = Date.now() - t0;
      assert.ok(ids.every((id) => seen.has(id)), 'all 6 new claims visible; saw ' + [...seen].length + '; last: ' + JSON.stringify(lastAnswer).slice(0, 200));
      console.log('  reconnect: daemon restarted, 6 new claims visible through the shell in ' + ms + ' ms (target ' + RECONNECT_TARGET_MS + ' ms: ' + (ms <= RECONNECT_TARGET_MS ? 'MET' : 'NOT MET') + '), no openRoom call, no reload');
      assert.ok(ms < 2000, 'reconnect took ' + ms + ' ms');
      assert.strictEqual((await pool.get(X.mcpKey)).boundRoom, 'room-x');
    });
  } finally {
    await pool.closeAll();
    await D.stopDaemon(current);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Arms 6-10: over real HTTP against the built shell
// ---------------------------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function request(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path, headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('request timeout ' + opts.path)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function waitUntil(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch (_e) { /* retry */ }
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await sleep(100);
  }
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const code = () => crypto.randomBytes(32).toString('base64url');

// The ruled shape: the built output runs with ONLY the plugin root's node_modules reachable (the same tree
// test-369-shell-server.cjs builds, cached under the OS temp dir by manifest hash).
function rootNodeModules() {
  const repoNm = path.join(REPO, 'node_modules');
  if (fs.existsSync(path.join(repoNm, 'next', 'package.json')) && fs.existsSync(path.join(repoNm, 'react-dom', 'package.json'))) return repoNm;
  const key = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'package.json'))).update(fs.readFileSync(path.join(REPO, 'npm-shrinkwrap.json'))).digest('hex').slice(0, 16);
  const cache = path.join(os.tmpdir(), 'mos-369-root-deps-' + key);
  const nm = path.join(cache, 'node_modules');
  if (fs.existsSync(path.join(nm, '.mos-complete'))) return nm;
  fs.rmSync(cache, { recursive: true, force: true });
  fs.mkdirSync(cache, { recursive: true });
  fs.copyFileSync(path.join(REPO, 'package.json'), path.join(cache, 'package.json'));
  fs.copyFileSync(path.join(REPO, 'npm-shrinkwrap.json'), path.join(cache, 'npm-shrinkwrap.json'));
  const r = cp.spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: cache, encoding: 'utf8', timeout: 480000 });
  if (r.error || r.status !== 0) return null;
  fs.writeFileSync(path.join(nm, '.mos-complete'), 'ok\n');
  return nm;
}

function makePluginTree(nm) {
  const plugin = path.join(TMP_HOME, 'plugin');
  fs.mkdirSync(path.join(plugin, 'lib', 'ui-shell'), { recursive: true });
  fs.symlinkSync(nm, path.join(plugin, 'node_modules'), 'dir');
  const dist = path.join(plugin, 'lib', 'ui-shell', 'dist');
  fs.cpSync(STANDALONE, dist, { recursive: true });
  return dist;
}

async function httpArms() {
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
    envGap = 'the shell is not built (cd ui/shell && npm run build); arms 6-9 did not run';
    console.log('SKIP: ' + envGap);
    return;
  }
  const nm = rootNodeModules();
  if (nm === null) {
    envGap = 'the root dependencies could not be installed for the plugin-like tree (npm or network); arms 6-9 did not run';
    console.log('SKIP: ' + envGap);
    return;
  }
  const dist = makePluginTree(nm);

  console.log('HTTP arms against the built shell');
  let h = null;
  try {
    h = await D.startDaemon({
      rooms: [
        { slug: 'room-x', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'A claim the browser reads over HTTP.' }] },
        { slug: 'room-y', variant: 'wide', migrate: true },
      ],
    });
  } catch (err) {
    envGap = 'the hermetic daemon could not start for the HTTP arms (' + String(err && err.message).slice(0, 200) + ')';
    console.log('SKIP: ' + envGap);
    return;
  }

  const shellPort = await freePort();
  const tokenFile = path.join(TMP_HOME, 'ctl', 'control.token');
  const c1 = code();
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: path.join(TMP_HOME, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + h.port, MOS_SHELL_PORT: String(shellPort),
    MOS_SHELL_BOOTSTRAP_SHA256: sha(c1), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(shellPort), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  const shell = cp.spawn(process.execPath, ['server.js'], { cwd: dist, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  shell.stdout.on('data', (d) => { log += d; });
  shell.stderr.on('data', (d) => { log += d; });
  const origin = 'http://127.0.0.1:' + shellPort;
  const NONE = { 'sec-fetch-site': 'none' };

  async function signIn(c) {
    const r = await request(shellPort, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: NONE });
    assert.strictEqual(r.status, 303, 'sign-in answered ' + r.status + ': ' + r.body.slice(0, 120));
    const cookie = [].concat(r.headers['set-cookie'] || [])[0].split(';')[0];
    const page = await request(shellPort, { path: '/', headers: { cookie } });
    const m = /<meta name="mos-csrf" content="([A-Za-z0-9_-]+)"/.exec(page.body);
    assert.ok(m, 'the signed-in page carries the CSRF meta tag');
    return { cookie, csrf: m[1] };
  }
  function post(session, name, body, extra) {
    const headers = Object.assign({ 'content-type': 'application/json', origin, 'sec-fetch-site': 'same-origin' }, extra || {});
    if (session && session.cookie) headers.cookie = session.cookie;
    if (session && session.csrf && !(extra && extra.omitCsrf)) headers['x-mos-csrf'] = session.csrf;
    delete headers.omitCsrf;
    return request(shellPort, { method: 'POST', path: '/api/actions/' + name, headers, body: JSON.stringify(body || {}) });
  }
  function get(session, p, extra) {
    const headers = Object.assign({ 'sec-fetch-site': 'same-origin' }, extra || {});
    if (session && session.cookie) headers.cookie = session.cookie;
    return request(shellPort, { path: p, headers });
  }
  const json = (r) => { try { return JSON.parse(r.body); } catch (_e) { return null; } };

  let daemon = h;
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await request(shellPort, { path: '/auth/bootstrap', headers: NONE })).status > 0, 25000, 'the shell to answer');
    const A = await signIn(c1);

    await arm('6 the action route: no CSRF token is 403, with it 200, a foreign Origin is 403, no cookie is 401, unknown action 404, the agent action 403', async () => {
      const noCsrf = await post(A, 'listRooms', {}, { omitCsrf: true });
      assert.strictEqual(noCsrf.status, 403, noCsrf.body);
      assert.strictEqual(json(noCsrf).reason, 'csrf_missing');
      const wrongCsrf = await post(Object.assign({}, A, { csrf: 'x'.repeat(43) }), 'listRooms', {});
      assert.strictEqual(wrongCsrf.status, 403);
      const ok = await post(A, 'listRooms', {});
      assert.strictEqual(ok.status, 200, ok.body);
      const body = json(ok);
      assert.strictEqual(body.ok, true);
      assert.ok(body.rooms.some((r) => r.slug === 'room-x'), ok.body);
      const evil = await post(A, 'listRooms', {}, { origin: 'http://evil.example' });
      assert.strictEqual(evil.status, 403, evil.body);
      const crossSite = await post(A, 'listRooms', {}, { 'sec-fetch-site': 'cross-site' });
      assert.strictEqual(crossSite.status, 403);
      const nobody = await post({ csrf: A.csrf }, 'listRooms', {});
      assert.strictEqual(nobody.status, 401, nobody.body);
      assert.strictEqual((await post(A, 'noSuchAction', {})).status, 404);
      const agentOnly = await post(A, 'proposeDecision', { proposal: {} });
      assert.strictEqual(agentOnly.status, 403, agentOnly.body);
      assert.strictEqual(json(agentOnly).reason, 'human_only');
      const forged = await post(A, 'approveDecision', { principal: 'agent', gate_id: 'gate-none', chosen: ['approve'], verdict: 'approve' });
      assert.notStrictEqual(json(forged).reason, 'human_only', 'the browser path is human whatever the body says');
      assert.strictEqual((await post(A, 'openRoom', { room: '' })).status, 400);
      const bigBody = await request(shellPort, { method: 'POST', path: '/api/actions/listRooms', headers: { cookie: A.cookie, 'x-mos-csrf': A.csrf, origin, 'content-type': 'application/json' }, body: JSON.stringify({ pad: 'x'.repeat(70000) }) });
      assert.strictEqual(bigBody.status, 413);
      // A GET on the action route is not a route at all.
      assert.ok([404, 405].includes((await get(A, '/api/actions/listRooms')).status));
    });

    await arm('7 the feed changes endpoint pages the bound room; no cookie, a foreign Origin and an unbound session get nothing', async () => {
      const open = await post(A, 'openRoom', { room: 'room-x' });
      assert.strictEqual(json(open).ok, true, open.body);
      const page = await get(A, '/api/feed/changes?collection=nodes');
      assert.strictEqual(page.status, 200, page.body);
      const pb = json(page);
      assert.strictEqual(pb.ok, true);
      assert.strictEqual(typeof pb.epoch, 'string');
      assert.ok(pb.changes.some((c) => c.doc && c.doc.type === 'claim'));
      const paged = await get(A, '/api/feed/changes?collection=nodes&after=' + pb.through + '&epoch=' + encodeURIComponent(pb.epoch) + '&limit=5');
      assert.strictEqual(paged.status, 200);
      assert.deepStrictEqual(json(paged).changes, []);
      assert.strictEqual((await get(A, '/api/feed/changes?collection=nope')).status, 400);
      assert.strictEqual((await get(null, '/api/feed/changes?collection=nodes')).status, 401, 'no cookie, no page');
      assert.strictEqual((await get(A, '/api/feed/changes?collection=nodes', { origin: 'http://evil.example' })).status, 403);
      assert.strictEqual((await get(A, '/api/feed/changes?collection=nodes', { 'sec-fetch-site': 'cross-site' })).status, 403);

      const room = await get(A, '/api/feed/room');
      assert.strictEqual(room.status, 200, room.body);
      const rb = json(room);
      assert.strictEqual(rb.room, 'room-x');
      assert.strictEqual(rb.checkpoint.epoch, pb.epoch);
      assert.strictEqual(typeof rb.checkpoint.seq, 'number');
      assert.strictEqual(rb.changes.length, 1);
      assert.strictEqual(rb.changes[0].entity_id, 'room');
      assert.strictEqual(rb.changes[0].doc.question, 'No governing question recorded yet.');
      assert.strictEqual((await get(null, '/api/feed/room')).status, 401);

      // A second browser session has its own MCP session: it is not bound to room-x and reads nothing of it.
      const token = fs.readFileSync(tokenFile, 'utf8').trim();
      const c2 = code();
      const armed = await request(shellPort, { method: 'POST', path: '/control/bootstrap', headers: { 'content-type': 'application/json', 'x-mos-control-token': token }, body: JSON.stringify({ sha256: sha(c2) }) });
      assert.strictEqual(armed.status, 200, armed.body);
      const B = await signIn(c2);
      const bPage = await get(B, '/api/feed/changes?collection=nodes');
      assert.strictEqual(bPage.status, 409, bPage.body);
      assert.strictEqual(json(bPage).reason, 'room_unbound');
      assert.strictEqual((await get(B, '/api/feed/hint')).status, 409);
    });

    await arm('8 the hint endpoint streams a room.changed frame for the bound room within 2000 ms of an outside write', async () => {
      const ac = new AbortController();
      const frames = [];
      let text = '';
      const reqDone = new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: shellPort, path: '/api/feed/hint', headers: { cookie: A.cookie, 'sec-fetch-site': 'same-origin', accept: 'text/event-stream' }, signal: ac.signal }, (res) => {
          if (res.statusCode !== 200) return reject(new Error('hint stream answered ' + res.statusCode));
          if (!/text\/event-stream/.test(String(res.headers['content-type']))) return reject(new Error('content-type ' + res.headers['content-type']));
          if (!/no-transform/.test(String(res.headers['cache-control']))) return reject(new Error('cache-control ' + res.headers['cache-control']));
          res.setEncoding('utf8');
          res.on('data', (chunk) => { text += chunk; });
          res.on('end', resolve);
          res.on('close', resolve);
        });
        req.on('error', (e) => { if (e.name !== 'AbortError') reject(e); else resolve(); });
        req.end();
      });
      try {
        await waitUntil(() => text.includes(': connected'), 5000, 'the opening comment');
        await sleep(300);
        const t0 = Date.now();
        await childWrite(daemon.roomDirs['room-x'], 'claim:http-hint-1', daemon.env);
        await waitUntil(() => /event: room\.changed/.test(text), 2000, 'a room.changed frame');
        const ms = Date.now() - t0;
        const m = /event: room\.changed\ndata: (\{[^\n]*\})/.exec(text);
        const data = JSON.parse(m[1]);
        assert.deepStrictEqual(Object.keys(data).sort(), ['latestSeq', 'roomId']);
        assert.strictEqual(data.roomId, 'room-x');
        console.log('  hint relayed through the shell ' + ms + ' ms after the outside write (child spawn included)');
        frames.push(data);
      } finally {
        ac.abort();
        await reqDone;
      }
      assert.strictEqual((await get(null, '/api/feed/hint')).status, 401);
      assert.strictEqual((await get(A, '/api/feed/hint', { origin: 'http://evil.example' })).status, 403);
    });

    await arm('9 the status endpoint says connected only after an acknowledged round trip, then reconnecting or disconnected once the daemon is stopped', async () => {
      const live = await get(A, '/api/status');
      assert.strictEqual(live.status, 200, live.body);
      const lb = json(live);
      assert.strictEqual(lb.connection, 'connected');
      assert.strictEqual(typeof lb.lastAckAt, 'number');
      assert.ok(Date.now() - lb.lastAckAt < 10000, 'the acknowledgement is fresh');
      assert.strictEqual(lb.mcpSessionPrefix.length, 8);
      assert.strictEqual(lb.roomSlug, 'room-x');
      assert.ok(/^\d+\.\d+\.\d+$/.test(String(lb.version)), 'the daemon contract version: ' + lb.version);
      assert.strictEqual((await get(null, '/api/status')).status, 401);
      assert.strictEqual((await get(A, '/api/status', { origin: 'http://evil.example' })).status, 403);

      await killChild(daemon.child);
      const down = json(await get(A, '/api/status'));
      assert.ok(['reconnecting', 'disconnected'].includes(down.connection), 'daemon stopped: ' + JSON.stringify(down));
      assert.strictEqual(typeof down.lastAckAt, 'number', 'the last acknowledgement is kept');
      assert.ok(down.lastAckAt <= lb.lastAckAt + 5000);
      // A browser session that never had an acknowledged round trip is never "connected".
      const token = fs.readFileSync(tokenFile, 'utf8').trim();
      const c3 = code();
      await request(shellPort, { method: 'POST', path: '/control/bootstrap', headers: { 'content-type': 'application/json', 'x-mos-control-token': token }, body: JSON.stringify({ sha256: sha(c3) }) });
      const C = await signIn(c3);
      const never = json(await get(C, '/api/status'));
      assert.strictEqual(never.connection, 'disconnected', JSON.stringify(never));
      assert.strictEqual(never.lastAckAt, null);
      for (let i = 0; i < 3; i += 1) await get(A, '/api/status');
      assert.strictEqual(json(await get(A, '/api/status')).connection, 'disconnected');
      // A feed call during the outage is an error answer, not a page.
      const feed = await get(A, '/api/feed/changes?collection=nodes');
      assert.notStrictEqual(feed.status, 200, feed.body);
    });

    await arm('10 static: no route file under ui/shell/app other than the browser action route calls invoke', async () => {
      const offenders = [];
      let actionRoute = false;
      for (const f of listFiles(path.join(SHELL, 'app')).filter((p) => /\.(ts|tsx)$/.test(p))) {
        const src = fs.readFileSync(f, 'utf8');
        const rel = path.relative(path.join(SHELL, 'app'), f).split(path.sep).join('/');
        if (/\binvoke\s*\(/.test(src)) {
          if (rel === 'api/actions/[name]/route.ts') actionRoute = true;
          else offenders.push(rel);
        }
      }
      assert.deepStrictEqual(offenders, []);
      assert.ok(actionRoute, 'the browser action route calls invoke with the human principal');
      const route = fs.readFileSync(path.join(SHELL, 'app', 'api', 'actions', '[name]', 'route.ts'), 'utf8');
      assert.ok(/principal: 'human'/.test(route));
      assert.ok(route.indexOf('authorizeApi') < route.indexOf('invoke('), 'the guards run before any action lookup');
      const sessions = fs.readFileSync(path.join(SHELL, 'server', 'sessions.ts'), 'utf8');
      assert.ok(sessions.indexOf('checkRequest(') < sessions.indexOf('readSession(req') && sessions.indexOf('readSession(req') < sessions.indexOf('requireCsrf('), 'origin guard, session, then CSRF');
    });
  } finally {
    await killChild(shell);
    await D.stopDaemon(daemon);
    if (failed) console.log('--- shell log (tail) ---\n' + log.split('\n').slice(-12).join('\n'));
  }
}

async function main() {
  await inProcessArms();
  if (envGap === null) await httpArms();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  console.log('\nPASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  if (envGap) {
    console.log('ENV GAP: ' + envGap + ' (exit 77)');
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => {
  console.log('FATAL ' + (e && e.stack ? e.stack : e));
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(1);
});
