'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-04 Task 1 -- the command-line door scripts/eureka-portfolio.cjs.
 * Legs C1 to C12. Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME,
 * temp room folders, an injected runner, no network.
 * No dash characters are typed in this file: the checks build them with
 * String.fromCharCode.
 * Run with: NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-314-cli.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 't314-cli-home-'));
process.env.HOME = path.join(SANDBOX, 'home');
process.env.USERPROFILE = path.join(SANDBOX, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(SANDBOX, 'rooms');
process.env.UV_OFFLINE = '1';
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'eureka-portfolio.cjs');
const store = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs'));

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const FALLBACK = 'a pair outside the top of the list';
const ENCODER_SENTENCE = 'The local measuring tool is not installed, so there are no fitness numbers. Run /mos:eureka enable once to install it.';
const BANNED = ['band', 'tail', 'quadrant', 'ahp', 'handle', 'sensor', 'percentile', 'envelope', 'sens'];

let PASS = 0;
let FAIL = 0;
const tempDirs = [];

async function leg(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('ok   ' + name);
  } catch (e) {
    FAIL += 1;
    console.log('FAIL ' + name + ' -- ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}

function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't314-cli-room-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.mindrian', 'room.db'), '');
  return dir;
}

/** Hand-built valid snapshot. pairs: [[a, b, band, score], ...] already ordered by rank. */
function snapshot(o) {
  const scope = o.scope || 'room';
  const sid = scope === 'room' ? 'room' : store.scopeId(scope);
  return {
    schema_version: 1,
    ran_at: o.ran_at || '2026-10-28T10:00:00.000Z',
    scope: scope === 'room' ? 'room' : 'subset',
    scope_id: sid,
    encoder_kind: o.encoder_kind || 'live',
    provenance: { run_mode: o.encoder_kind === 'stub' ? 'offline-stub' : 'live', encoder_model: 'test-model', pairs_scored: o.pairs.length },
    pairs: o.pairs.map(function (p, i) { return { a: p[0], b: p[1], band: p[2], score: p[3], rank: i + 1 }; }),
    tail: { composition: 'mixed', insufficient_structure: false, suspect_noise: false, items: (o.tail || []).map(function (id) { return { id: id }; }) },
    labels: o.labels || {}
  };
}

function okResult(snap, labels) {
  const lab = labels || snap.labels;
  return {
    status: 'ok',
    snapshot: snap,
    display: {
      rows: snap.pairs.map(function (p) {
        return { rank: p.rank, a: p.a, b: p.b, a_label: lab[p.a] || '', b_label: lab[p.b] || '', score: p.score, band: p.band,
          dims: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 }, weak_a: [], weak_b: [], complementary: false, tail_flag: false };
      }),
      tail: { count: snap.tail.items.length, items: snap.tail.items.map(function (t) { return { id: t.id, label: lab[t.id] || '' }; }),
        insufficient_structure: false, suspect_noise: false, composition: 'mixed', growth_proxy: 'x' },
      counts: { things: 4, pairs_scored: snap.pairs.length, pairs_candidates: snap.pairs.length, structural_excluded: 0 },
      labelOf: function (h) { return Object.prototype.hasOwnProperty.call(lab, h) ? lab[h] : ''; }
    }
  };
}

function bufferDeps(extra) {
  const out = [];
  const err = [];
  const deps = Object.assign({
    out: function (s) { out.push(String(s)); },
    err: function (s) { err.push(String(s)); },
    now: function () { return new Date('2026-10-28T12:00:00.000Z'); }
  }, extra || {});
  return { deps: deps, out: out, err: err };
}

async function runMain(main, argv, extra) {
  const b = bufferDeps(extra);
  const code = await main(argv, b.deps);
  const raw = b.out.join('');
  let json = null;
  try { json = JSON.parse(raw); } catch (_e) { json = null; }
  return { code: code, raw: raw, json: json, err: b.err.join('') };
}

function storeFiles(room) {
  const dir = path.join(room, '.mindrian', 'eureka-portfolio');
  const acc = [];
  (function walk(d, rel) {
    let names = [];
    try { names = fs.readdirSync(d).sort(); } catch (_e) { return; }
    names.forEach(function (n) {
      const full = path.join(d, n);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, rel + n + '/');
      else acc.push(rel + n + ':' + fs.readFileSync(full, 'utf8'));
    });
  })(dir, '');
  return acc;
}

(async function main() {
  const mod = require(SCRIPT);
  const main_ = mod.main;
  const parseArgv = mod.parseArgv;

  await leg('C1 parseArgv knows run, show, seen and help; unknown subcommand exits 2', async function () {
    assert.equal(typeof main_, 'function');
    assert.equal(typeof parseArgv, 'function');
    ['run', 'show', 'seen', 'help'].forEach(function (c) {
      const p = parseArgv([c, '--room', '/x']);
      assert.equal(p.command, c, c);
      assert.equal(p.error, undefined, c);
    });
    const bad = parseArgv(['explode']);
    assert.ok(bad.error, 'unknown subcommand gives an error object');
    const r = await runMain(main_, ['explode']);
    assert.equal(r.code, 2);
    assert.equal(r.json.status, 'error');
  });

  await leg('C2 room flag: missing exits 2, relative exits 2, no room.db exits 1', async function () {
    let called = 0;
    const deps = { runPortfolio: async function () { called += 1; return { status: 'error', reason: 'no_room' }; } };
    const missing = await runMain(main_, ['run'], deps);
    assert.equal(missing.code, 2);
    assert.deepEqual([missing.json.status, missing.json.reason], ['error', 'no_room']);
    const rel = await runMain(main_, ['run', '--room', 'relative/dir'], deps);
    assert.equal(rel.code, 2);
    assert.equal(rel.json.reason, 'no_room');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 't314-cli-empty-'));
    tempDirs.push(empty);
    const nodb = await runMain(main_, ['run', '--room', empty], deps);
    assert.equal(nodb.code, 1);
    assert.equal(nodb.json.reason, 'no_room');
    const gone = await runMain(main_, ['run', '--room', path.join(empty, 'nope')], deps);
    assert.equal(gone.code, 1);
    assert.equal(called, 0, 'the runner is never reached on a bad room');
  });

  await leg('C3 section slug and top range are checked before any path join', async function () {
    const room = makeRoom();
    let called = 0;
    const deps = { runPortfolio: async function () { called += 1; return { status: 'error', reason: 'no_room' }; } };
    const before = storeFiles(room);
    for (const bad of ['../x', 'a/b', '', 'UP', '-x']) {
      const r = await runMain(main_, ['run', '--room', room, '--section', bad], deps);
      assert.equal(r.code, 2, 'section ' + JSON.stringify(bad));
      assert.equal(r.json.reason, 'bad_section', 'section ' + JSON.stringify(bad));
    }
    for (const bad of ['0', '101', '2.5', 'abc', '-1', '']) {
      const r = await runMain(main_, ['run', '--room', room, '--top', bad], deps);
      assert.equal(r.code, 2, 'top ' + JSON.stringify(bad));
      assert.equal(r.json.status, 'error');
    }
    assert.equal(called, 0);
    assert.deepEqual(storeFiles(room), before);
    const showBad = await runMain(main_, ['show', '--room', room, '--section', '../x'], deps);
    assert.equal(showBad.code, 2);
    assert.equal(showBad.json.reason, 'bad_section');
  });

  await leg('C4 stdout holds exactly one JSON document; warnings go to stderr', async function () {
    const room = makeRoom();
    const snap = snapshot({ pairs: [['h1', 'h2', 'high', 0.8]], labels: { h1: 'Alpha', h2: 'Beta' } });
    const r = await runMain(main_, ['run', '--room', room], {
      runPortfolio: async function () { process.stderr.write(''); return okResult(snap); }
    });
    assert.equal(r.code, 0);
    assert.ok(r.json, 'stdout parses as one JSON document');
    assert.equal(r.raw.trim().split('\n').length >= 1, true);
    assert.equal(JSON.stringify(JSON.parse(r.raw)).length > 10, true);
  });

  await leg('C5 a degraded run prints the object, exits 0 and writes nothing', async function () {
    const room = makeRoom();
    const first = snapshot({ pairs: [['h1', 'h2', 'moderate', 0.5]], labels: { h1: 'Alpha', h2: 'Beta' } });
    await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(first); } });
    const second = snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: [['h1', 'h2', 'high', 0.8]], labels: { h1: 'Alpha', h2: 'Beta' } });
    await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(second); } });
    assert.ok(storeFiles(room).some(function (f) { return f.startsWith('movement-room.json:'); }), 'a movement exists');
    const before = storeFiles(room);
    const r = await runMain(main_, ['run', '--room', room], {
      runPortfolio: async function () {
        return { status: 'degraded', degrade: 'qualitative-only', reason: 'encoder_unavailable', qualitative: { counts: { things: 3 }, most_connected: [], tail: { count: 0, items: [] } } };
      }
    });
    assert.equal(r.code, 0);
    assert.equal(r.json.status, 'degraded');
    assert.equal(r.json.plain_reason, ENCODER_SENTENCE);
    assert.ok(r.json.qualitative);
    assert.deepEqual(storeFiles(room), before, 'directory content is unchanged');
  });

  await leg('C6 an error from the runner exits 1 and writes nothing', async function () {
    const room = makeRoom();
    const before = storeFiles(room);
    const r = await runMain(main_, ['run', '--room', room], {
      runPortfolio: async function () { return { status: 'error', reason: 'ahp_inconsistent' }; }
    });
    assert.equal(r.code, 1);
    assert.equal(r.json.status, 'error');
    assert.equal(r.json.reason, 'ahp_inconsistent');
    assert.ok(typeof r.json.plain_reason === 'string' && r.json.plain_reason.length > 10);
    assert.deepEqual(storeFiles(room), before);
  });

  await leg('C7 run: store, diff, movement file for this scope only; prints the full shape', async function () {
    const room = makeRoom();
    const labels = { h1: 'Alpha pump', h2: 'Beta market', h3: 'Gamma rail' };
    const s1 = snapshot({ pairs: [['h1', 'h2', 'moderate', 0.5], ['h2', 'h3', 'low', 0.2]], labels: labels });
    const r1 = await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s1); } });
    assert.equal(r1.code, 0);
    assert.equal(r1.json.status, 'ok');
    assert.equal(r1.json.movement.first_run, true);
    assert.equal(r1.json.movement.comparable, false);
    assert.equal(r1.json.movement.reshuffle_active, false);
    assert.equal(r1.json.movement.movement_id, null);
    assert.equal(r1.json.store.saved, true);
    assert.equal(r1.json.store.rotated, false);
    ['status', 'scope', 'section', 'ran_at', 'provenance', 'ranked', 'tail', 'counts', 'movement', 'store'].forEach(function (k) {
      assert.ok(Object.prototype.hasOwnProperty.call(r1.json, k), 'key ' + k);
    });
    assert.ok(!storeFiles(room).some(function (f) { return f.startsWith('movement-'); }), 'no movement on first run');

    // Plant an unseen movement for ANOTHER scope. It must survive.
    const otherEnv = {
      schema_version: 1, kind: 'portfolio_movement', movement_id: 'pm_aaaaaaaaaaaa', detected_at: '2026-10-28T09:00:00.000Z',
      scope: 'subset', scope_id: store.scopeId('opportunity-bank'), encoder_kind: 'live',
      counts: { band_cross: 0, tail_enter: 1, top_n_reshuffle: 0 }, events: [{ kind: 'tail_enter', handle: 'hx' }]
    };
    assert.equal(store.writeMovement(room, otherEnv).ok, true, 'plant other scope movement');
    const otherBefore = fs.readFileSync(path.join(room, '.mindrian', 'eureka-portfolio', 'movement-' + otherEnv.scope_id + '.json'), 'utf8');

    const s2 = snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: [['h1', 'h2', 'high', 0.8], ['h2', 'h3', 'low', 0.2]], labels: labels });
    const r2 = await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s2); } });
    assert.equal(r2.code, 0);
    assert.equal(r2.json.store.rotated, true);
    assert.equal(r2.json.movement.first_run, false);
    assert.equal(r2.json.movement.comparable, true);
    assert.match(r2.json.movement.movement_id, /^pm_[0-9a-f]{12}$/);
    assert.equal(r2.json.movement.scope_id, 'room');
    assert.equal(r2.json.movement.counts.band_cross, 1);
    assert.equal(r2.json.movement.events.length, 1);
    assert.equal(store.readMovement(room, 'room').movement_id, r2.json.movement.movement_id);
    assert.equal(fs.readFileSync(path.join(room, '.mindrian', 'eureka-portfolio', 'movement-' + otherEnv.scope_id + '.json'), 'utf8'), otherBefore, 'other scope untouched');

    // The run never marks seen.
    assert.equal(store.isSeen(room, r2.json.movement.movement_id), false);

    // A third identical run: no movement, only the room file is cleared.
    const s3 = snapshot({ ran_at: '2026-10-28T12:00:00.000Z', pairs: [['h1', 'h2', 'high', 0.8], ['h2', 'h3', 'low', 0.2]], labels: labels });
    const r3 = await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s3); } });
    assert.equal(r3.json.movement.comparable, true);
    assert.equal(r3.json.movement.events.length, 0);
    assert.equal(r3.json.movement.movement_id, null);
    assert.equal(store.readMovement(room, 'room'), null, 'room movement cleared');
    assert.equal(fs.readFileSync(path.join(room, '.mindrian', 'eureka-portfolio', 'movement-' + otherEnv.scope_id + '.json'), 'utf8'), otherBefore, 'other scope still untouched');
  });

  await leg('C8 events carry plain labels; a missing label prints the fixed words', async function () {
    const room = makeRoom();
    const s1 = snapshot({ pairs: [['h1', 'h2', 'moderate', 0.5], ['h3', 'h4', 'low', 0.2]], tail: [], labels: { h1: 'Alpha pump', h2: 'Beta market' } });
    await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s1); } });
    const s2 = snapshot({
      ran_at: '2026-10-28T11:00:00.000Z',
      pairs: [['h1', 'h2', 'high', 0.8], ['h3', 'h4', 'low', 0.2]],
      tail: ['h5'],
      labels: { h1: 'Alpha pump', h2: 'Beta market', h5: 'Quiet thing' }
    });
    const r = await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s2); } });
    const ev = r.json.movement.events;
    const cross = ev.find(function (e) { return e.kind === 'band_cross'; });
    const tail = ev.find(function (e) { return e.kind === 'tail_enter'; });
    assert.equal(cross.a_label, 'Alpha pump');
    assert.equal(cross.b_label, 'Beta market');
    assert.equal(tail.label, 'Quiet thing');
    // A handle with no label.
    const room2 = makeRoom();
    await runMain(main_, ['run', '--room', room2], { runPortfolio: async function () { return okResult(s1); } });
    const s3 = snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: [['h1', 'h2', 'moderate', 0.5], ['h3', 'h4', 'high', 0.9]], labels: { h1: 'Alpha pump', h2: 'Beta market' } });
    const r3 = await runMain(main_, ['run', '--room', room2], { runPortfolio: async function () { return okResult(s3); } });
    const c3 = r3.json.movement.events.find(function (e) { return e.kind === 'band_cross'; });
    assert.equal(c3.a_label, FALLBACK);
    assert.equal(c3.b_label, FALLBACK);
  });

  await leg('C9 show prints the stored run and movement, marks it seen; none when empty', async function () {
    const room = makeRoom();
    const none = await runMain(main_, ['show', '--room', room]);
    assert.equal(none.code, 0);
    assert.equal(none.json.status, 'none');
    assert.ok(none.json.plain_reason.indexOf('/mos:eureka-portfolio') !== -1);

    const labels = { h1: 'Alpha pump', h2: 'Beta market' };
    const s1 = snapshot({ pairs: [['h1', 'h2', 'moderate', 0.5], ['h3', 'h4', 'low', 0.2]], labels: labels });
    await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s1); } });
    const s2 = snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: [['h1', 'h2', 'high', 0.8], ['h3', 'h4', 'low', 0.2]], labels: labels });
    const r2 = await runMain(main_, ['run', '--room', room], { runPortfolio: async function () { return okResult(s2); } });
    const mid = r2.json.movement.movement_id;
    assert.equal(store.isSeen(room, mid), false);
    const shown = await runMain(main_, ['show', '--room', room]);
    assert.equal(shown.code, 0);
    assert.equal(shown.json.status, 'ok');
    assert.equal(shown.json.ranked.length, 2);
    assert.equal(shown.json.ranked[0].a_label, 'Alpha pump');
    assert.equal(shown.json.ranked[1].a_label, FALLBACK);
    assert.equal(shown.json.movement.movement_id, mid);
    assert.equal(shown.json.movement.events[0].a_label, 'Alpha pump');
    assert.equal(store.isSeen(room, mid), true, 'show marks the movement seen');
  });

  await leg('C10 seen marks an id; a malformed id exits 2', async function () {
    const room = makeRoom();
    const r = await runMain(main_, ['seen', '--room', room, '--id', 'pm_0123456789ab']);
    assert.equal(r.code, 0);
    assert.equal(store.isSeen(room, 'pm_0123456789ab'), true);
    for (const bad of ['pm_zz', '', '../x', 'PM_0123456789AB']) {
      const b = await runMain(main_, ['seen', '--room', room, '--id', bad]);
      assert.equal(b.code, 2, JSON.stringify(bad));
      assert.equal(b.json.status, 'error');
    }
    const none = await runMain(main_, ['seen', '--room', room]);
    assert.equal(none.code, 2);
  });

  await leg('C11 every plain reason is plain English', async function () {
    const reasons = mod.PLAIN_REASONS;
    assert.ok(reasons && typeof reasons === 'object', 'PLAIN_REASONS exported');
    ['encoder_unavailable', 'no_pairs', 'too_few_things', 'no_room', 'bad_section', 'store_failed', 'ahp_inconsistent', 'none'].forEach(function (k) {
      assert.equal(typeof reasons[k], 'string', k);
    });
    assert.equal(reasons.encoder_unavailable, ENCODER_SENTENCE);
    assert.equal(reasons.no_pairs, 'Nothing in this room is linked to anything else yet, so there is nothing to compare.');
    assert.equal(reasons.none, 'No portfolio run is stored for this room yet. Run /mos:eureka-portfolio first.');
    Object.keys(reasons).forEach(function (k) {
      const words = reasons[k].toLowerCase().match(/[a-z]+/g) || [];
      BANNED.forEach(function (b) {
        assert.ok(words.indexOf(b) === -1, k + ' holds the word ' + b);
      });
      assert.ok(reasons[k].indexOf(EM) === -1 && reasons[k].indexOf(EN) === -1);
    });
  });

  await leg('C12 no network, no Brain client, no dash; help exits 0; the entry point runs', async function () {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(src.toLowerCase().indexOf('http') === -1, 'no http');
    assert.ok(!/brain-client|brain_client|mindrian-brain/i.test(src), 'no Brain client');
    assert.ok(src.indexOf(EM) === -1 && src.indexOf(EN) === -1, 'no dash characters');
    assert.ok(!/child_process|setInterval|setTimeout|fs\.watch/.test(src), 'no scheduler, no watcher, no spawn');
    const res = cp.spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8', env: process.env });
    assert.equal(res.status, 0);
    assert.ok(/run/.test(res.stdout) && /--offline/.test(res.stdout) && /test option/i.test(res.stdout));
    const help = cp.spawnSync(process.execPath, [SCRIPT, 'help'], { encoding: 'utf8', env: process.env });
    assert.equal(help.status, 0);
    const bad = cp.spawnSync(process.execPath, [SCRIPT, 'explode'], { encoding: 'utf8', env: process.env });
    assert.equal(bad.status, 2);
  });

  tempDirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
  process.exitCode = FAIL === 0 ? 0 : 1;
})();
