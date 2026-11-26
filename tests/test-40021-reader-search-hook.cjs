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
const screenMod = require(path.join(fx.ROOT, 'lib', 'core', 'persona-reader-screen.cjs'));

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
    assert.ok(hit.stderr.includes('run ' + ctx.res.run_id), 'the message names the run id');
    assert.ok(hit.stderr.includes('disarm-reader-screen --run ' + ctx.res.run_id), 'the message names the off switch');
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

check('H6. M1: a marker whose run is not found is removed and the search passes; an invalid ledger blocks (fail closed) and keeps the marker', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await armedRun();
    const home = ctx.env.homeDir;
    const runJson = path.join(fx.ledgerDirOf ? fx.ledgerDirOf(ctx) : ctx.res.review_dir, 'run.json');
    const good = fs.readFileSync(runJson, 'utf8');
    fs.writeFileSync(runJson, '{not json', 'utf8');
    const v = runHook(home, 'WebSearch', { query: 'battery recycling statistics' });
    assert.equal(v.code, 2, 'ledger_invalid is a block');
    assert.ok(v.stderr.includes('reason reader_search_screen_unavailable'), v.stderr);
    assert.equal(screenMod.liveReaderMarkers(home, new Date()).length, 1, 'the marker stays');
    fs.writeFileSync(runJson, good, 'utf8');
    fs.rmSync(ctx.res.review_dir, { recursive: true, force: true });
    assert.equal(runHook(home, 'WebSearch', { query: 'harbor light retainer pricing' }).code, 0, 'run_not_found: the marker is removed');
    assert.equal(screenMod.liveReaderMarkers(home, new Date()).length, 0);
  });
});

check('H6b. M2: a room that states no name is not armed (not_armed:no_room_name) and writes no marker', () => {
  const home = fx.mkTmp('home-noname');
  const room = fx.mkTmp('room-noname');
  assert.equal(door.writeReaderMarker(home, '20261126-000000-abcd', room, new Date(), []), 'not_armed:no_room_name');
  assert.equal(fs.existsSync(door.readerMarkerDir(home)), false);
});

check('H6c. a marker whose expires_at is in the past is stale even when it is young; a bad marker file is removed', () => {
  const home = fx.mkTmp('home-exp');
  const dir = door.readerMarkerDir(home);
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  fs.writeFileSync(path.join(dir, '20261126-000000-abcd.json'), JSON.stringify({ schema: screenMod.READER_MARKER_SCHEMA, run_id: '20261126-000000-abcd', room: home, created_at: new Date(now - 1000).toISOString(), expires_at: new Date(now - 500).toISOString() }));
  fs.writeFileSync(path.join(dir, '20261126-000000-abce.json'), '{not json');
  assert.equal(screenMod.liveReaderMarkers(home, new Date()).length, 0);
  assert.deepEqual(fs.readdirSync(dir), []);
});

check('H6d. M3, M5: a WebFetch url is screened on its path and query, raw and decoded (%20, %22, +); the host and well-known org words are not screened', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await armedRun();
    const home = ctx.env.homeDir;
    assert.equal(runHook(home, 'WebFetch', { url: 'https://example.org/search?q=%22harbor%20light%22', prompt: 'x' }).code, 2, '%22 and %20');
    assert.equal(runHook(home, 'WebFetch', { url: 'https://example.org/search?q=harbor+light+pricing', prompt: 'x' }).code, 2, 'plus as a space');
    assert.equal(runHook(home, 'WebSearch', { query: 'harbor%20light' }).code, 2, 'an encoded query is decoded too');
    assert.equal(runHook(home, 'WebFetch', { url: 'https://harbor-light.example.org/battery-recycling', prompt: 'x' }).code, 0, 'the host is not screened');
    assert.equal(runHook(home, 'WebFetch', { url: 'https://example.org/%E0%A4%A', prompt: 'x' }).code, 0, 'a bad escape does not throw');
    assert.deepEqual(screenMod.urlScreenTexts('https://example.org/a%20b?q=c+d'), ['/a%20b ?q=c+d', '/a b ?q=c d']);
    assert.ok(screenMod.URL_ORG_TOKENS.includes('wikipedia') && screenMod.URL_ORG_TOKENS.includes('github'));
  });
});

check('H6e. the off switch: disarm-reader-screen --run <id> removes the marker, the hook then passes, and the merge review says the screen lapsed', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await armedRun();
    const home = ctx.env.homeDir;
    assert.deepEqual(door.cmdDisarmReaderScreen({ runId: 'bad' }, { homeDir: home }), { ok: false, reason: 'run_id_invalid' });
    assert.deepEqual(door.cmdDisarmReaderScreen({ runId: ctx.res.run_id }, { homeDir: home }), { ok: true, removed: [ctx.res.run_id] });
    assert.equal(runHook(home, 'WebSearch', { query: 'harbor light retainer pricing' }).code, 0);
    const run = Object.assign({}, ctx, { ids: fx.ledgerOf(ctx).sub_questions.map(s => s.id) });
    for (const h of fx.READ_HATS) fx.writeReading(run, h, fx.readingOf(run, h, h === 'white' ? { self_search_strings: ['battery recycling rates'], self_found_sources: [] } : undefined));
    fx.writeReading(run, 'blue', fx.blueReadingOf(run));
    assert.equal(fx.doCheck(run).ok, true);
    const m = await fx.doMerge(run);
    assert.equal(m.ok, true, JSON.stringify(m));
    assert.equal(fx.ledgerOf(ctx).reader_search_screen, 'lapsed');
    const text = fs.readFileSync(m.artifact, 'utf8');
    assert.ok(text.includes(door.ARTIFACT_LABELS.reader_screen_lapsed), 'the review says no code screened after the removal');
    // With no run named, every marker is removed.
    assert.equal(door.writeReaderMarker(home, '20261126-000000-abcd', ctx.room, new Date(), []), 'armed');
    assert.deepEqual(door.cmdDisarmReaderScreen({}, { homeDir: home }).removed, ['20261126-000000-abcd']);
  });
});

check('H7. hooks.json wires the hook on WebSearch and WebFetch with a 5 s timeout and onFailure block; the credential guard stays', () => {
  const hj = JSON.parse(fs.readFileSync(path.join(fx.ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const groups = hj.hooks.PreToolUse.filter(g => (g.hooks || []).some(h => String(h.command).includes('persona-reader-search-guard-hook.cjs')));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].matcher, '^(?:WebSearch|WebFetch)$');
  const h = groups[0].hooks[0];
  assert.equal(h.timeout, 5);
  assert.equal(h.onFailure, 'block', 'owner ruling 2026-11-26: fail closed, plus an off switch');
  const cred = hj.hooks.PreToolUse.filter(g => (g.hooks || []).some(x => String(x.command).includes('web-credential-guard-hook.cjs')));
  assert.equal(cred.length, 1, 'the credential guard is still wired');
  assert.ok(fs.readFileSync(path.join(fx.ROOT, 'scripts', 'web-credential-guard-hook.cjs'), 'utf8').includes('It runs NO room-word, name, company or content scan.'));
});

check('H8. the hook loads no door: its require graph is node built-ins, the screen module and the content fence', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  assert.equal(/require\([^)]*persona-hats/.test(src), false, 'the hook does not require the door');
  const msrc = fs.readFileSync(path.join(fx.ROOT, 'lib', 'core', 'persona-reader-screen.cjs'), 'utf8');
  const reqs = (msrc.match(/require\(([^)]+)\)/g) || []).sort();
  assert.deepEqual(reqs, ["require('node:crypto')", "require('node:fs')", "require('node:path')", "require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs')"]);
});

check('H8b. fail closed: with a marker file present and the screen module missing, the hook blocks with reader_search_screen_unavailable', () => {
  const tree = fx.mkTmp('hook-copy');
  fs.mkdirSync(path.join(tree, 'scripts'), { recursive: true });
  const copy = path.join(tree, 'scripts', 'persona-reader-search-guard-hook.cjs');
  fs.copyFileSync(HOOK, copy);
  const home = fx.mkTmp('home-fc');
  fs.mkdirSync(door.readerMarkerDir(home), { recursive: true });
  fs.writeFileSync(path.join(door.readerMarkerDir(home), '20261126-000000-abcd.json'), '{}');
  const r = spawnSync(process.execPath, [copy], { input: JSON.stringify({ tool_name: 'WebSearch', tool_input: { query: 'any words' } }), env: Object.assign({}, process.env, { MINDRIAN_HOME: home }), encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('reason reader_search_screen_unavailable'), r.stderr);
  assert.ok(r.stderr.includes('disarm-reader-screen'), 'the off switch is named');
});

check('H9. latency: a cold hook call on a large room (12 reading-list files of 256 KiB, 200 team files, 2,000 artifacts) has a p95 below the 1,000 ms budget of test-261029 A5c', () => {
  const room = path.join(fx.mkTmp('big'), 'big-room');
  const home = fx.mkTmp('home-big');
  const put = (rel, t) => { const a = path.join(room, rel); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, t); };
  put('STATE.md', '---\nventure: Harbor Light Studio\n---\n# Harbor Light Studio\n');
  for (let i = 0; i < 200; i += 1) put('team/member-' + i + '.md', '# m');
  const big = Array.from({ length: 4000 }, (_, i) => 'The Company Alpha' + i + ' met Bravo' + i + ' in Rome. ').join('\n').slice(0, 262144);
  const rl = [];
  for (let i = 0; i < 12; i += 1) { put('notes/n' + i + '.md', big); rl.push('notes/n' + i + '.md'); }
  for (let i = 0; i < 2000; i += 1) put('section-' + (i % 20) + '/a' + i + '.md', '# a');
  const runId = '20261126-120000-abcd';
  put('personas/hat-reviews/' + runId + '-x/run.json', JSON.stringify({ schema: 'mos.persona-run/1', run_id: runId, brief_hash: 'a'.repeat(64), steps: {}, hats: {}, brief: { reading_list: rl } }));
  assert.equal(door.writeReaderMarker(home, runId, room, new Date(), rl), 'armed');
  const times = [];
  for (let i = 0; i < 10; i += 1) {
    const t = process.hrtime.bigint();
    const r = runHook(home, 'WebSearch', { query: 'battery recycling statistics' });
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
    assert.equal(r.code, 0, r.stderr);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
  console.log('     H9 cold p95 ' + p95.toFixed(0) + ' ms, p50 ' + times[4].toFixed(0) + ' ms (n=10)');
  assert.ok(p95 < 1000, 'p95 ' + p95 + ' ms');
});

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed += 1; console.log('ok: ' + t.label); } catch (e) { failed += 1; console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e))); }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
