#!/usr/bin/env node
'use strict';

/**
 * Phase 369-08 (SHELL369-01, RXP369-01, HUM369-01) -- the chassis-neutral
 * shell core in ui/shared (D-15, D-18, D-19, deliverable 4).
 *
 *   1. erasable proof: every ui/shared/src/*.ts and src/generated/*.ts loads
 *      under Node's own type stripping (no build, no tsconfig read).
 *   2. static: no `mode: 'auto'` anywhere in ui/shared/src, `mode: 'legacy'`
 *      present in the session pool, no URL literal other than 127.0.0.1.
 *   3. parseSseFrames splits a multi-frame chunk and carries a partial frame.
 *   4. live (hermetic flag-ON daemon): the legacy pool binds, calls, keeps the
 *      adapter on its own session, refuses the reserved key, and survives a
 *      daemon restart by re-binding (reconnected: true).
 *   5. projection: six collections, toDoc upsert and delete, stable
 *      sanitized dbName with the projection version, isResetReason.
 *   6. static replica: no dev-mode import, replicateRxCollection present, no
 *      push key.
 *   7. actions: exposure is mandatory, an adapter-tagged definition is
 *      refused, callableBy returns the right sets.
 *   8. proposal: recommended_id must be an option id; fixedProposalSource.
 *   9. the adapter generator --check exits 0 and MCP_TOOL_NAMES equals the
 *      wire snapshot's tool count.
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM
 * and CLAUDE_CODE_SESSION_ID are unset. Exit 77 only for an environment
 * failure to start the daemon. No literal em-dash or en-dash in this file
 * (the dash guard builds the characters at run time). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(REPO_ROOT, 'ui', 'shared');
const SRC = path.join(SHARED, 'src');
const GEN = path.join(SRC, 'generated');

// Hermetic process env before anything loads.
const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-08-'));
process.env.HOME = TEMP_HOME;
process.env.USERPROFILE = TEMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TEMP_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function tsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => path.join(dir, f));
}

function allSrcFiles() {
  return tsFiles(SRC).concat(tsFiles(GEN));
}

function load(rel) {
  return import(pathToFileURL(path.join(SRC, rel)).href);
}

function readSrc(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

async function main() {
  console.log('static and pure arms');

  await test('1. every ui/shared source .ts loads under Node type stripping', async () => {
    const files = allSrcFiles();
    assert.ok(files.length >= 2, 'expected shared sources, found ' + files.length);
    for (const f of files) {
      await import(pathToFileURL(f).href);
    }
  });

  await test('2. legacy client mode explicit, no auto mode, no outside URL literal', async () => {
    const files = allSrcFiles();
    let legacySeen = false;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(!/mode:\s*'auto'/.test(src), f + ' must never negotiate (mode: auto)');
      if (/mode:\s*'legacy'/.test(src)) legacySeen = true;
      const bad = src.match(/https?:\/\/(?!127\.0\.0\.1)[^\s'"`)]*/g);
      assert.equal(bad, null, f + ' has an outside URL literal: ' + (bad || []).join(', '));
    }
    assert.ok(/mode:\s*'legacy'/.test(readSrc('mcp-session-pool.ts')), "pool must set mode: 'legacy'");
    assert.ok(legacySeen);
    const longDashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
    for (const f of files.concat([path.join(SHARED, 'README.md'), path.join(SHARED, 'package.json')])) {
      const src = fs.readFileSync(f, 'utf8');
      for (const d of longDashes) assert.ok(!src.includes(d), f + ' contains a long dash');
    }
  });

  await test('3. parseSseFrames splits frames and carries a partial one', async () => {
    const { parseSseFrames } = await load('feed-relay.ts');
    const a = parseSseFrames('event: room.changed\ndata: {"roomId":"r","latestSeq":3}\n\nevent: status-segment\ndata: {"x":1}\n\nevent: room.chan');
    assert.equal(a.frames.length, 2);
    assert.equal(a.frames[0].event, 'room.changed');
    assert.equal(JSON.parse(a.frames[0].data).latestSeq, 3);
    assert.equal(a.frames[1].event, 'status-segment');
    assert.equal(a.carry, 'event: room.chan');
    const b = parseSseFrames('ged\ndata: {"roomId":"r","latestSeq":4}\n\n', a.carry);
    assert.equal(b.frames.length, 1);
    assert.equal(b.frames[0].event, 'room.changed');
    assert.equal(JSON.parse(b.frames[0].data).latestSeq, 4);
    assert.equal(b.carry, '');
  });

  await test('3b. subscribeHints emits only for the right room, falls back to the poll, and unsubscribes', async () => {
    const { createFeedRelay } = await load('feed-relay.ts');
    const enc = new TextEncoder();
    let release = null;
    const fetchImpl = async () => {
      let ctrl = null;
      const body = new ReadableStream({
        start(c) {
          ctrl = c;
          c.enqueue(enc.encode('event: room.changed\ndata: {"roomId":"other","latestSeq":9}\n\nevent: room.changed\ndata: {"roomId":"r1","lat'));
          release = () => c.enqueue(enc.encode('estSeq":5}\n\n'));
        },
      });
      return { ok: true, status: 200, body };
    };
    let latest = 1;
    const pool = { call: async () => ({ ok: true, isError: false, text: '', data: { latest_seq: latest }, reconnected: false }) };
    const relay = createFeedRelay({ pool, daemonUrl: 'http://127.0.0.1:1', pollMs: 40, fetchImpl });
    const hints = [];
    const stop = relay.subscribeHints('s', 'r1', (h) => hints.push(h));
    await new Promise((r) => setTimeout(r, 20));
    release();
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(hints.filter((h) => h.source === 'sse'), [{ roomId: 'r1', latestSeq: 5, source: 'sse' }]);
    latest = 8;
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(hints.some((h) => h.source === 'poll' && h.latestSeq === 8), 'the poll net must wake on an advanced latest_seq');
    stop();
    const n = hints.length;
    latest = 20;
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(hints.length, n, 'no hints after unsubscribe');
  });

  await test('3c. WR-10: the poll emits on a lower head after a reset, on an epoch change, and on nothing else', async () => {
    const { createFeedRelay } = await load('feed-relay.ts');
    // A stream that never connects: only the poll feeds the subscriber here.
    const fetchImpl = async () => { throw new Error('no stream in this arm'); };
    let head = 10;
    let epoch = 'e1';
    const pool = { call: async () => ({ ok: true, isError: false, text: '', data: { ok: true, epoch, as_of_seq: head, docs: [], done: true }, reconnected: false }) };
    const relay = createFeedRelay({ pool, daemonUrl: 'http://127.0.0.1:1', pollMs: 30, fetchImpl, backoffStartMs: 100000, backoffMaxMs: 100000 });
    const hints = [];
    const stop = relay.subscribeHints('s', 'r1', (h) => hints.push(h));
    const tick = (ms) => new Promise((r) => setTimeout(r, ms || 120));
    await tick(); // the first poll records the head (10, e1) and emits nothing
    assert.equal(hints.length, 0, 'the first poll only records the head');
    await tick();
    assert.equal(hints.length, 0, 'nothing changed: no hint');
    head = 3; // the log was reset: a LOWER head under the same epoch
    await tick();
    const lower = hints.filter((h) => h.source === 'poll' && h.latestSeq === 3);
    assert.equal(lower.length, 1, 'a lower head emits exactly one poll hint: ' + JSON.stringify(hints));
    await tick();
    assert.equal(hints.length, 1, 'the same lower head again emits nothing more');
    epoch = 'e2'; // the same head under a new epoch
    await tick();
    assert.equal(hints.length, 2, 'an epoch change emits one hint: ' + JSON.stringify(hints));
    assert.equal(hints[1].latestSeq, 3);
    await tick();
    assert.equal(hints.length, 2, 'nothing changed after the epoch hint: no more hints');
    head = 4; // an ordinary advance still emits
    await tick();
    assert.equal(hints.length, 3, 'a higher head still emits');
    stop();
  });

  await test('3d. a poll that sees the pool reconnect resets the stream backoff to its start value', async () => {
    const { createFeedRelay } = await load('feed-relay.ts');
    const attempts = [];
    const fetchImpl = async () => { attempts.push(Date.now()); throw new Error('the daemon is down'); };
    let reconnected = false;
    const pool = { call: async () => ({ ok: true, isError: false, text: '', data: { ok: true, epoch: 'e1', as_of_seq: 5, docs: [], done: true }, reconnected }) };
    const relay = createFeedRelay({ pool, daemonUrl: 'http://127.0.0.1:1', pollMs: 30, fetchImpl, backoffStartMs: 40, backoffMaxMs: 100000 });
    const stop = relay.subscribeHints('s', 'r1', () => {});
    const t0 = Date.now();
    while (attempts.length < 5 && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 10));
    assert.ok(attempts.length >= 5, 'the stream retried with a growing wait: ' + attempts.length + ' attempts');
    const growing = attempts[4] - attempts[3];
    assert.ok(growing >= 120, 'before the reconnect the wait had grown (' + growing + ' ms)');
    const before = attempts.length;
    reconnected = true; // the pool rebuilt the MCP session: the daemon is back
    const tFlag = Date.now();
    while (attempts.length === before && Date.now() - tFlag < 3000) await new Promise((r) => setTimeout(r, 5));
    const waited = Date.now() - tFlag;
    reconnected = false;
    stop();
    assert.ok(attempts.length > before, 'the stream tried again');
    assert.ok(waited < 250, 'a reconnect reported by the poll brings the next stream attempt within the start backoff, not the grown one (' + waited + ' ms)');
  });

  await test('5. projection: six collections, toDoc upsert and delete, dbName, isResetReason', async () => {
    const proj = await load('projection.ts');
    assert.equal(proj.COLLECTIONS.length, 6);
    assert.deepEqual(Array.from(proj.COLLECTIONS), ['room', 'nodes', 'relations', 'artifacts', 'decisions', 'activity']);
    assert.equal(proj.PROJECTION_VERSION, 2);
    for (const c of proj.COLLECTIONS) {
      assert.equal(proj.SCHEMAS[c].primaryKey, 'id');
      assert.equal(proj.SCHEMAS[c].properties.revision.type, 'number');
    }
    const up = proj.toDoc('nodes', {
      seq: 4, entity_type: 'node', entity_id: 'claim:1', op: 'upsert', revision: 3,
      doc: { id: 'claim:1', type: 'claim', title: 'T', status: 'confirmed', provenance: { by: 'human' }, not_a_ui_field: 'x' },
    });
    assert.equal(up.id, 'claim:1');
    assert.equal(up.revision, 3);
    assert.equal(up.title, 'T');
    assert.equal(up.provenance, '{"by":"human"}', 'object fields normalize to a string');
    assert.equal('not_a_ui_field' in up, false, 'only UI fields survive the projection');
    assert.deepEqual(proj.toDoc('nodes', { seq: 5, entity_id: 'claim:1', op: 'delete' }), { id: 'claim:1', _deleted: true });
    const a = proj.dbName('Room X/One', '8f3a9c2e-1111-2222');
    assert.equal(a, 'mos-room-x-one-8f3a9c2e-p2');
    assert.equal(a, proj.dbName('Room X/One', '8f3a9c2e-1111-2222'), 'stable');
    assert.match(a, /^[a-z0-9-]+$/);
    assert.ok(a.endsWith('-p2'));
    assert.notEqual(a, proj.dbName('Room X/One', 'ffffffff-0'), 'a new epoch opens a new database');
    assert.equal(proj.isResetReason('checkpoint_expired'), true);
    assert.equal(proj.isResetReason('epoch_changed'), true);
    assert.equal(proj.isResetReason('feed_error'), false);
    assert.equal(proj.isResetReason(undefined), false);
  });

  await test('6. replica source: no dev plugin, replicateRxCollection present, no write-back key', async () => {
    const src = readSrc('replica.ts');
    for (const f of allSrcFiles()) {
      const s = fs.readFileSync(f, 'utf8');
      assert.ok(!/plugins\/dev-mode/.test(s), f + ' must never import the RxDB dev plugin');
    }
    assert.ok(src.includes('replicateRxCollection'));
    assert.ok(!/push\s*:/.test(src), 'replica.ts must have no push key');
    assert.ok(!/\bpush\s*\(\s*\{/.test(src) && !/\bpush\s*=/.test(src), 'no write-back handler in code');
    assert.ok(readSrc('projection.ts').split('\n').filter((l) => l.includes('disposable, deletable at any moment')).length === 1);
  });

  await test('6b. replica behavior (memory storage): pull, delete, hint, last visit, reset', async () => {
    const { openReplica, ProjectionResetError } = await load('replica.ts');
    const { getRxStorageMemory } = await import(pathToFileURL(path.join(SHARED, 'node_modules', 'rxdb', 'dist', 'esm', 'plugins', 'storage-memory', 'index.js')).href);
    const log = [
      { seq: 1, entity_id: 'c1', op: 'upsert', revision: 1, doc: { id: 'c1', type: 'claim', title: 'one' } },
      { seq: 2, entity_id: 'c2', op: 'upsert', revision: 1, doc: { id: 'c2', type: 'claim', title: 'two' } },
    ];
    let reset = null;
    let hintListener = null;
    let mode = 'ok';
    const pulls = [];
    const rep = await openReplica({
      roomKey: 'room-x',
      epoch: 'e1e1e1e1-aaaa',
      storage: getRxStorageMemory(),
      multiInstance: false,
      fetchPage: async (collection, cp, batch) => {
        pulls.push({ collection, cp, batch });
        if (mode === 'reset') return { ok: false, reason: 'checkpoint_expired', epoch: 'e1e1e1e1-aaaa', snapshot_revision: 9 };
        const after = cp ? cp.seq : 0;
        const changes = collection === 'nodes' ? log.filter((c) => c.seq > after) : [];
        const through = changes.length ? changes[changes.length - 1].seq : Math.max(after, log[log.length - 1].seq);
        return { ok: true, epoch: 'e1e1e1e1-aaaa', through, changes };
      },
      hints: (l) => { hintListener = l; return () => { hintListener = null; }; },
      onReset: (info) => { reset = info; },
    });
    try {
      assert.equal(rep.name, 'mos-room-x-e1e1e1e1-p2');
      await rep.awaitInitialReplication();
      let docs = await rep.db.nodes.find().exec();
      assert.deepEqual(docs.map((d) => d.id).sort(), ['c1', 'c2']);
      assert.ok(pulls.every((p) => p.batch === 200), 'batch size is 200');
      assert.equal(await rep.getLastVisit(), null, 'a fresh projection has no last visit');
      await rep.setLastVisit(2);
      assert.equal(await rep.getLastVisit(), 2);

      log.push({ seq: 3, entity_id: 'c1', op: 'delete' });
      log.push({ seq: 4, entity_id: 'c3', op: 'upsert', revision: 1, doc: { id: 'c3', type: 'claim', title: 'three' } });
      assert.ok(hintListener, 'the replica subscribed to hints');
      hintListener();
      for (let i = 0; i < 40; i += 1) {
        docs = await rep.db.nodes.find().exec();
        if (docs.some((d) => d.id === 'c3')) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.deepEqual(docs.map((d) => d.id).sort(), ['c2', 'c3'], 'delete arrives as a tombstone, hint pulls the tail');

      mode = 'reset';
      hintListener();
      for (let i = 0; i < 60 && !reset; i += 1) await new Promise((r) => setTimeout(r, 50));
      assert.deepEqual(reset, { reason: 'checkpoint_expired' }, 'onReset fires after the database is removed');
      assert.equal(hintListener, null, 'hints are unsubscribed on reset');
      const err = new ProjectionResetError({ reason: 'epoch_changed', epoch: 'e', snapshot_revision: 3 });
      assert.equal(err.reason, 'epoch_changed');
      assert.equal(err.snapshot_revision, 3);
    } finally {
      try { await rep.close(); } catch (_e) { /* already removed */ }
    }
  });

  await test('7. actions: exposure is mandatory, the adapter can never be an action, callableBy sets', async () => {
    const { defineShellAction, createActionRegistry, EXPOSURES } = await load('actions.ts');
    const { z } = await import(pathToFileURL(path.join(SHARED, 'node_modules', 'zod', 'index.js')).href);
    assert.deepEqual(Array.from(EXPOSURES), ['agent', 'human', 'both']);
    const input = z.object({ id: z.string() });
    const run = () => 'ok';
    assert.throws(() => defineShellAction({ name: 'a.no-exposure', input, run }), /exposure/);
    assert.throws(() => defineShellAction({ name: 'a.bad', exposure: 'everyone', input, run }), /exposure/);
    assert.throws(() => defineShellAction({ name: '', exposure: 'human', input, run }), /name/);
    assert.throws(() => defineShellAction({ name: 'a.adapter', exposure: 'both', input, run, adapter: true }), /adapter/);
    assert.throws(() => defineShellAction({ name: 'mcp.gate_answer', exposure: 'both', input, run }), /adapter/);
    assert.throws(() => defineShellAction({ name: 'a.noschema', exposure: 'human', input: { not: 'zod' }, run }), /zod/);
    const h = defineShellAction({ name: 'decision.answer', exposure: 'human', input, run });
    const a = defineShellAction({ name: 'proposal.request', exposure: 'agent', input, run });
    const b = defineShellAction({ name: 'room.read', exposure: 'both', input, run });
    assert.ok(Object.isFrozen(h), 'definitions are frozen');
    const reg = createActionRegistry();
    reg.register(h);
    reg.register(a);
    reg.register(b);
    assert.throws(() => reg.register({ name: 'x', exposure: 'both', input, run }), /defineShellAction/);
    assert.throws(() => reg.register(h), /duplicate/);
    assert.deepEqual(reg.callableBy('human').map((x) => x.name).sort(), ['decision.answer', 'room.read']);
    assert.deepEqual(reg.callableBy('agent').map((x) => x.name).sort(), ['proposal.request', 'room.read']);
    assert.equal(reg.list().length, 3);
    assert.equal(reg.get('decision.answer'), h);
    reg.assertAllDeclared();
    assert.ok(!reg.callableBy('agent').some((x) => x.name === 'decision.answer'), 'an agent can never reach a human-only action');
  });

  await test('8. proposal contract: recommended id must be an option id; fixed source returns it', async () => {
    const { ProposalSchema, fixedProposalSource } = await load('proposal.ts');
    const good = {
      subject_node_id: 'claim:42',
      verdict_options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject', description: 'Not enough evidence' }],
      recommended_id: 'approve',
      evidence_node_ids: ['doc:1', 'doc:2'],
      rationale: 'Two independent sources agree.',
    };
    assert.equal(ProposalSchema.safeParse(good).success, true);
    assert.equal(ProposalSchema.safeParse(Object.assign({}, good, { recommended_id: 'defer' })).success, false);
    assert.equal(ProposalSchema.safeParse(Object.assign({}, good, { verdict_options: [] })).success, false);
    assert.equal(ProposalSchema.safeParse(Object.assign({}, good, { rationale: '' })).success, false);
    assert.equal(ProposalSchema.safeParse(Object.assign({}, good, { evidence_node_ids: new Array(21).fill('n') })).success, false);
    const src = fixedProposalSource(good);
    const out = await src.propose({ roomSlug: 'room-x', selectedNodeId: 'claim:42', question: 'enough evidence?' });
    assert.deepEqual(out, good);
    assert.throws(() => fixedProposalSource(Object.assign({}, good, { recommended_id: 'nope' })));
  });

  await test('9. adapter generator --check is clean; tool names equal the wire snapshot; adapter holds no client or schema', async () => {
    const r = cp.spawnSync(process.execPath, [path.join(SHARED, 'scripts', 'gen-mcp-adapter.mjs'), '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
    assert.equal(r.status, 0, 'gen --check: ' + r.stdout + r.stderr);
    const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json'), 'utf8'));
    const gen = await import(pathToFileURL(path.join(GEN, 'mcp-adapter.ts')).href);
    assert.equal(gen.MCP_TOOL_NAMES.length, snap.local.tools.length);
    assert.deepEqual(Array.from(gen.MCP_TOOL_NAMES), snap.local.tools.map((t) => t.name).sort());
    const calls = [];
    const fake = async (tool, args) => { calls.push([tool, args]); return 'r'; };
    assert.equal(await gen.gateAnswer(fake, { gate_id: 'g1', chosen: 'approve' }), 'r');
    assert.equal(calls[0][0], 'gate_answer');
    const src = fs.readFileSync(path.join(GEN, 'mcp-adapter.ts'), 'utf8');
    assert.ok(!/versionNegotiation/.test(src), 'the adapter carries no client of its own');
    assert.ok(!/\bz\.(object|string)/.test(src), 'no second schema');
    // Drift is detected: a mutated copy of the committed file differs from what the generator emits.
    const { generate } = await import(pathToFileURL(path.join(SHARED, 'scripts', 'gen-mcp-adapter.mjs')).href);
    assert.equal(generate(), src);
  });

  // ARMS-INSERT-PURE

  console.log('live legacy pool against the hermetic flag-ON daemon');
  const { startDaemon, restartDaemon, stopDaemon } = require('./helpers/mcp-daemon-369.cjs');
  let handle = null;
  let pool = null;
  try {
    try {
      handle = await startDaemon({ rooms: [{ slug: 'room-x', variant: 'wide', migrate: true }] });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/EPERM|EACCES|EADDRINUSE|bind|did not report its port|exited early/i.test(msg)) {
        console.log('SKIPPED (ENV GAP): the daemon could not start here: ' + msg.slice(0, 200));
        process.exit(77);
      }
      throw err;
    }
    const { createSessionPool, ADAPTER_SESSION_KEY } = await load('mcp-session-pool.ts');
    pool = createSessionPool({ daemonUrl: () => 'http://127.0.0.1:' + handle.port, idleMs: 60000 });

    await test('4. pool binds, calls, isolates the adapter, refuses the reserved key, survives a restart', async () => {
      const entry = await pool.get('b1');
      assert.ok(entry.mcpSessionId, 'a sessionful (legacy) connection must carry an mcp-session-id');
      const bound = await pool.bind('b1', 'room-x');
      assert.equal(bound.ok, true, 'bind ok: ' + bound.text.slice(0, 200));
      assert.equal(bound.data.effective, true);
      assert.equal(entry.boundRoom, 'room-x');
      const st = await pool.call('b1', 'room_state', { command: 'status' });
      assert.equal(st.ok, true, 'room_state ok: ' + st.text.slice(0, 200));
      assert.equal(st.reconnected, false);

      const adapter = await pool.adapterSession();
      assert.ok(adapter.mcpSessionId && adapter.mcpSessionId !== entry.mcpSessionId, 'adapter must have its own MCP session');
      assert.equal(adapter.boundRoom, null, 'the adapter never inherits the human binding');
      await assert.rejects(() => pool.get(ADAPTER_SESSION_KEY), /reserved/);
      await assert.rejects(() => pool.call(ADAPTER_SESSION_KEY, 'room_state', {}), /reserved/);

      const before = entry.mcpSessionId;
      handle = await restartDaemon(handle);
      const after = await pool.call('b1', 'room_state', { command: 'status' });
      assert.equal(after.reconnected, true, 'a dead session must reconnect: ' + after.text.slice(0, 200));
      assert.equal(after.ok, true);
      const fresh = await pool.get('b1');
      assert.notEqual(fresh.mcpSessionId, before, 'a new session id after the restart');
      assert.equal(fresh.boundRoom, 'room-x', 'boundRoom is re-bound after reconnect');
    });

    await test('4b. sweepIdle closes entries past idleMs and keeps live ones', async () => {
      assert.ok(pool.size() >= 1);
      const closed = await pool.sweepIdle(Date.now() + 61000);
      assert.ok(closed >= 1);
      assert.equal(pool.size(), 0);
    });

    await test('4c. pageChanges reports feed_unavailable when room_changes is not served', async () => {
      const { createFeedRelay } = await load('feed-relay.ts');
      const relay = createFeedRelay({ pool, daemonUrl: () => 'http://127.0.0.1:' + handle.port, pollMs: 100000 });
      await pool.bind('b2', 'room-x');
      const tools = await (await pool.get('b2')).client.listTools();
      const served = tools.tools.some((t) => t.name === 'room_changes');
      const r = await relay.pageChanges('b2', { limit: 1 });
      if (!served) {
        assert.deepEqual(r, { ok: false, reason: 'feed_unavailable' });
      } else {
        assert.ok(r && typeof r === 'object', 'a served feed answers an object');
      }
    });
  } catch (err) {
    failed += 1;
    console.log('  FAIL harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (pool) await pool.closeAll();
    if (handle) await stopDaemon(handle);
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(TEMP_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
