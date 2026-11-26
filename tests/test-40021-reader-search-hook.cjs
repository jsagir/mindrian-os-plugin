#!/usr/bin/env node
'use strict';
// Phase 400.2.1 (S5): the reader search guard hook. Owner ruling 2026-11-26: "A: screen with a hook".
// While a deep run is open, each WebSearch query and each WebFetch url is screened with the door identity screen
// before it leaves the machine. run-research arms the screen, merge disarms it, a stale marker is ignored and removed.
// No leg sends a network request: the hook is run as a child process with a fixture MINDRIAN_HOME.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const { door, NO_KEYS } = fx;
const HOOK = path.join(fx.ROOT, 'scripts', 'persona-reader-search-guard-hook.cjs');

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) { queue.push({ label, fn }); }

function runHook(home, tool, input) {
  const env = Object.assign({}, process.env, { MINDRIAN_HOME: home });
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: tool, tool_input: input }), env, encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr || '' };
}

/** A deep run of the fixture room after run-research, with the real clock so that the marker is live. */
async function armedRun() {
  const ctx = fx.planned();
  const out = await fx.go(ctx, fx.approvedFile(ctx, { white: fx.approveHat(ctx.plan, 'white') }), fx.makeSeam(), { now: new Date() });
  assert.equal(out.ok, true, JSON.stringify(out));
  return { ctx, out };
}

check('H1. with no marker every search passes, a venture name too (the screen is off outside a run)', async () => {
  const home = fx.mkTmp('home-none');
  assert.equal(runHook(home, 'WebSearch', { query: 'harbor light studio pricing' }).code, 0);
  assert.equal(runHook(home, 'WebFetch', { url: 'https://example.org/harbor-light', prompt: 'x' }).code, 0);
});

check('H2. run-research arms the screen; a query or url with a room word is blocked before it leaves, a general one passes', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx, out } = await armedRun();
    assert.equal(out.reader_search_screen, 'armed');
    const home = ctx.env.homeDir;
    assert.equal(door.liveReaderMarkers(home, new Date()).length, 1);
    const marker = JSON.parse(fs.readFileSync(path.join(door.readerMarkerDir(home), ctx.res.run_id + '.json'), 'utf8'));
    assert.deepEqual(Object.keys(marker).sort(), ['created_at', 'expires_at', 'room', 'run_id', 'schema'], 'the marker holds no screen token');
    const hit = runHook(home, 'WebSearch', { query: 'harbor light retainer pricing' });
    assert.equal(hit.code, 2, hit.stderr);
    assert.ok(hit.stderr.includes('reason room_identity_word'), hit.stderr);
    assert.equal(/harbor/i.test(hit.stderr), false, 'the message never prints the text');
    const url = runHook(home, 'WebFetch', { url: 'https://example.org/harbor-light-studio/about', prompt: 'summarise' });
    assert.equal(url.code, 2, url.stderr);
    assert.equal(runHook(home, 'WebSearch', { query: 'battery recycling statistics' }).code, 0);
    assert.equal(runHook(home, 'WebFetch', { url: 'https://example.org/battery-recycling', prompt: 'x' }).code, 0);
    assert.equal(runHook(home, 'Write', { file_path: '/tmp/x', content: 'harbor light' }).code, 0, 'another tool is not screened');
  });
});

check('H3. a stale marker (older than the maximum age) is ignored and removed', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await armedRun();
    const home = ctx.env.homeDir;
    const old = new Date(Date.now() - door.READER_MARKER_MAX_AGE_MS - 60000);
    assert.equal(door.writeReaderMarker(home, ctx.res.run_id, ctx.room, old), 'armed');
    assert.equal(runHook(home, 'WebSearch', { query: 'harbor light retainer pricing' }).code, 0);
    assert.equal(fs.existsSync(path.join(door.readerMarkerDir(home), ctx.res.run_id + '.json')), false, 'the stale marker is removed');
  });
});

check('H4. merge removes the marker, so the screen stops when the run closes', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await armedRun();
    const run = Object.assign({}, ctx, { ids: fx.ledgerOf(ctx).sub_questions.map(s => s.id) });
    for (const h of fx.READ_HATS) fx.writeReading(run, h, fx.readingOf(run, h));
    fx.writeReading(run, 'blue', fx.blueReadingOf(run));
    assert.equal(fx.doCheck(run).ok, true);
    const m = await fx.doMerge(run);
    assert.equal(m.ok, true, JSON.stringify(m));
    assert.equal(door.liveReaderMarkers(ctx.env.homeDir, new Date()).length, 0);
    assert.equal(runHook(ctx.env.homeDir, 'WebSearch', { query: 'harbor light retainer pricing' }).code, 0);
  });
});

check('H5. plan-research arms the screen when it skips run-research (no hat planned): the readings still search', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const room = fx.harborRoom();
    fx.roomDbMod.closeRoomDb(fx.roomDbMod.openRoomDb(room));
    const env = fx.envOf();
    const res = fx.runToAccepted(room, env);
    const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, fx.opts(env, { now: new Date() }));
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.planned, []);
    assert.equal(out.reader_search_screen, 'armed');
    assert.equal(runHook(env.homeDir, 'WebSearch', { query: 'harbor light retainer pricing' }).code, 2);
  });
});

check('H6. a marker whose run ledger is gone is removed and the search passes', async () => {
  const home = fx.mkTmp('home-gone');
  const room = fx.mkTmp('room-gone');
  assert.equal(door.writeReaderMarker(home, '20261126-000000-abcd', room, new Date()), 'armed');
  assert.equal(runHook(home, 'WebSearch', { query: 'any words' }).code, 0);
  assert.equal(door.liveReaderMarkers(home, new Date()).length, 0);
});

check('H7. hooks.json wires the hook on WebSearch and WebFetch with a 5 s timeout and no onFailure key; the credential guard stays', () => {
  const hj = JSON.parse(fs.readFileSync(path.join(fx.ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const groups = hj.hooks.PreToolUse.filter(g => (g.hooks || []).some(h => String(h.command).includes('persona-reader-search-guard-hook.cjs')));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matcher, '^(?:WebSearch|WebFetch)$');
  const h = groups[0].hooks[0];
  assert.equal(h.timeout, 5);
  assert.equal('onFailure' in h, false, 'the onFailure set of test-391 H5 stays two hooks');
  const cred = hj.hooks.PreToolUse.filter(g => (g.hooks || []).some(x => String(x.command).includes('web-credential-guard-hook.cjs')));
  assert.equal(cred.length, 1, 'the credential guard is still wired');
  assert.ok(fs.readFileSync(path.join(fx.ROOT, 'scripts', 'web-credential-guard-hook.cjs'), 'utf8').includes('It runs NO room-word, name, company or content scan.'));
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed += 1; console.log('ok: ' + t.label); } catch (e) { failed += 1; console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e))); }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
