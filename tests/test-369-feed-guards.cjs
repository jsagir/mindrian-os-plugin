// REV369-08 and REV369-13 (plan 369-37): nothing tied to a browser session outlives it, and the room
// feed never pairs one room's document with another room's checkpoint.
//
//   WR-11  reading a session found expired runs the same expiry hooks the sweep runs, once; an open
//          hint stream ends within one heartbeat of its session expiring and stops asking the MCP
//          session pool for that key.
//   WR-09  /api/feed/room answers room_switched when the head's room differs from the room document's
//          room; the browser fetcher treats any page whose room is not exactly the expected room (a
//          page with no room included) as the wrong room, and refuses to be created without a room.
//
// In-process: the shell's server modules and the browser fetcher are loaded as erasable TypeScript
// through the same module.registerHooks resolver tests/test-369-shell-actions.cjs uses (mos-ui-shared
// mapped to ui/shared/src). Stubs and injected clocks only; no daemon, no browser, no network.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHARED = path.join(REPO, 'ui', 'shared');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-feed-guards-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.MOS_DAEMON_URL = 'http://127.0.0.1:9';

require('node:module').registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('mos-ui-shared/')) {
      return nextResolve(pathToFileURL(path.join(SHARED, 'src', specifier.slice('mos-ui-shared/'.length) + '.ts')).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

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
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 10).join('\n    '));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (rel) => import(pathToFileURL(path.join(REPO, rel)).href);

async function main() {
  const authMod = await load('ui/shell/server/auth.ts');
  const feedMod = await load('ui/shell/server/feed-routes.ts');
  const fetchMod = await load('ui/shell/client/replica/feed-fetch.ts');

  // ---------------------------------------------------------------------------------------------
  // WR-11
  // ---------------------------------------------------------------------------------------------

  await arm('11a reading an expired session runs the expiry hooks once, with its mcpKey', async () => {
    let t = 1_000_000;
    const gone = [];
    const store = authMod.createSessionStore({ now: () => t, onExpire: (key) => gone.push(key) });
    const s = store.issue();
    t += 29 * 60 * 1000;
    assert.ok(store.read(s.id), 'alive at 29 idle minutes');
    assert.deepStrictEqual(gone, []);
    t += 31 * 60 * 1000;
    assert.strictEqual(store.read(s.id), null, 'expired on read');
    assert.deepStrictEqual(gone, [s.mcpKey], 'the hook ran with the mcpKey');
    assert.strictEqual(store.read(s.id), null);
    assert.deepStrictEqual(gone, [s.mcpKey], 'exactly once');
  });

  await arm('11b the default store runs every registered expiry hook when a read finds its session expired', async () => {
    const seen = [];
    authMod.onSessionExpired((key) => seen.push(key));
    const store = authMod.getSessionStore();
    const s = store.issue();
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 31 * 60 * 1000;
      assert.strictEqual(store.read(s.id), null);
    } finally {
      Date.now = realNow;
    }
    assert.ok(seen.includes(s.mcpKey), 'the registered hook saw the expired session');
    assert.strictEqual(seen.filter((k) => k === s.mcpKey).length, 1);
  });

  function streamStubs() {
    const calls = { call: 0, unsubscribed: 0, subscribed: 0 };
    const pool = {
      get: async () => ({ boundRoom: 'room-a' }),
      bind: async () => ({}),
      call: async () => { calls.call += 1; return { ok: true, data: {} }; },
    };
    const relay = {
      subscribeHints: () => { calls.subscribed += 1; return () => { calls.unsubscribed += 1; }; },
    };
    return { pool, relay, calls };
  }

  // One persistent reader per stream: a background pump collects text and notes the end, so a later
  // wait never loses a chunk to an abandoned read.
  function pump(stream) {
    const reader = stream.getReader();
    const dec = new TextDecoder();
    const state = { text: '', done: false };
    (async () => {
      for (;;) {
        let r;
        try { r = await reader.read(); } catch (_e) { state.done = true; return; }
        if (r.done) { state.done = true; return; }
        state.text += dec.decode(r.value);
      }
    })();
    state.waitDone = async (ms) => {
      const end = Date.now() + ms;
      while (!state.done && Date.now() < end) await sleep(10);
      return state.done;
    };
    return state;
  }

  await arm('11c an open hint stream ends within one heartbeat of its session expiring and unsubscribes its relay', async () => {
    let t = 5_000_000;
    const store = authMod.createSessionStore({ now: () => t });
    const s = store.issue();
    const { pool, relay, calls } = streamStubs();
    const opened = await feedMod.openHintStream({ pool, relay, browserSession: s, sessions: store, sessionId: s.id, heartbeatMs: 25 });
    assert.strictEqual(opened.ok, true);
    const rd = pump(opened.stream);
    assert.strictEqual(await rd.waitDone(120), false, 'open while the session lives');
    assert.ok(rd.text.includes(': connected'));
    assert.strictEqual(calls.subscribed, 1);
    t += 31 * 60 * 1000;
    assert.strictEqual(await rd.waitDone(400), true, 'the stream ended');
    assert.strictEqual(calls.unsubscribed, 1, 'the relay subscription was released');
    assert.strictEqual(store.size(), 0, 'the heartbeat check did not keep the session alive');
  });

  await arm('11d a live hint stream does not keep an idle session alive (the check does not refresh the idle clock)', async () => {
    let t = 8_000_000;
    const store = authMod.createSessionStore({ now: () => t });
    const s = store.issue();
    const { pool, relay } = streamStubs();
    const opened = await feedMod.openHintStream({ pool, relay, browserSession: s, sessions: store, sessionId: s.id, heartbeatMs: 20 });
    assert.strictEqual(opened.ok, true);
    const rd = pump(opened.stream);
    t += 20 * 60 * 1000;
    assert.strictEqual(await rd.waitDone(100), false, 'still open at 20 idle minutes');
    t += 15 * 60 * 1000; // 35 idle minutes in total, only heartbeats in between
    assert.strictEqual(await rd.waitDone(300), true, 'the stream ended once the idle window passed');
  });

  // ---------------------------------------------------------------------------------------------
  // WR-09
  // ---------------------------------------------------------------------------------------------

  function actionsStub(docRoom, headRoom) {
    return {
      invoke: async (name) => {
        if (name === 'roomDoc') return { ok: true, room: { slug: docRoom, question: 'q', purpose: 'p', counts: {} } };
        if (name === 'feedChanges') return { ok: true, room: headRoom, epoch: 'e1', as_of_seq: 7, docs: [], done: true };
        throw new Error('unexpected action ' + name);
      },
    };
  }

  await arm('9a handleFeedRoom answers room_switched when the head belongs to another room', async () => {
    const out = await feedMod.handleFeedRoom({ actions: actionsStub('room-a', 'room-b'), browserSession: { mcpKey: 'k' } });
    assert.strictEqual(out.status, 409);
    assert.strictEqual(out.body.ok, false);
    assert.strictEqual(out.body.reason, 'room_switched');
    assert.ok(!('checkpoint' in out.body), 'no checkpoint is handed out');
  });

  await arm('9b handleFeedRoom answers room_switched when the bound room changes between the two reads', async () => {
    let bound = 'room-a';
    const actions = {
      invoke: async (name) => {
        if (name === 'roomDoc') {
          const answer = { ok: true, room: { slug: bound, question: 'q', purpose: 'p', counts: {} } };
          bound = 'room-b'; // the person switches rooms right after the document was read
          return answer;
        }
        return { ok: true, room: bound, epoch: 'e2', as_of_seq: 3, docs: [], done: true };
      },
    };
    const out = await feedMod.handleFeedRoom({ actions, browserSession: { mcpKey: 'k' } });
    assert.strictEqual(out.body.reason, 'room_switched');
  });

  await arm('9c handleFeedRoom still answers a consistent room with its checkpoint', async () => {
    const out = await feedMod.handleFeedRoom({ actions: actionsStub('room-a', 'room-a'), browserSession: { mcpKey: 'k' } });
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.room, 'room-a');
    assert.deepStrictEqual(out.body.checkpoint, { epoch: 'e1', seq: 7 });
  });

  function withFetch(pages, fn) {
    const real = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const page = pages(String(url));
      return { status: 200, json: async () => page };
    };
    return Promise.resolve(fn()).finally(() => { globalThis.fetch = real; });
  }

  await arm('9d the fetcher refuses a page whose room is null when a room is expected', async () => {
    await withFetch(
      (url) => (url.startsWith('/api/feed/room')
        ? { ok: true, room: null, epoch: 'e1', through: 4, changes: [] }
        : { ok: true, room: null, epoch: 'e1', changes: [], through: 4, has_more: false }),
      async () => {
        const f = fetchMod.createFeedFetcher({ epoch: 'e1', room: 'room-a' });
        const a = await f.fetchPage('room', undefined, 10);
        assert.deepStrictEqual([a.ok, a.reason], [false, 'room_mismatch']);
        const b = await f.fetchPage('nodes', { epoch: 'e1', seq: 1 }, 10);
        assert.deepStrictEqual([b.ok, b.reason], [false, 'room_mismatch']);
        const c = await f.fetchPage('nodes', undefined, 10);
        assert.deepStrictEqual([c.ok, c.reason], [false, 'room_mismatch']);
      },
    );
  });

  await arm('9e the fetcher refuses a page for another room and accepts one for the expected room', async () => {
    await withFetch(
      (url) => ({ ok: true, room: url.includes('collection=relations') ? 'room-a' : 'room-b', epoch: 'e1', changes: [], through: 4, has_more: false }),
      async () => {
        const f = fetchMod.createFeedFetcher({ epoch: 'e1', room: 'room-a' });
        const bad = await f.fetchPage('nodes', { epoch: 'e1', seq: 1 }, 10);
        assert.strictEqual(bad.reason, 'room_mismatch');
        const good = await f.fetchPage('relations', { epoch: 'e1', seq: 1 }, 10);
        assert.strictEqual(good.ok, true);
      },
    );
  });

  await arm('9f creating a fetcher without a room is refused', async () => {
    assert.throws(() => fetchMod.createFeedFetcher({ epoch: null }), /room/);
    assert.throws(() => fetchMod.createFeedFetcher({ epoch: null, room: '' }), /room/);
    assert.throws(() => fetchMod.createFeedFetcher({ epoch: null, room: undefined }), /room/);
  });

  // ---------------------------------------------------------------------------------------------
  // dashes in this file
  // ---------------------------------------------------------------------------------------------

  await arm('0 dash guard: this test file holds no em-dash or en-dash', async () => {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.ok(!src.includes(EM) && !src.includes(EN));
  });

  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  console.log('\nPASS=' + passed + ' FAIL=' + failed);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.log('FATAL ' + ((err && err.stack) || err));
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(1);
});
