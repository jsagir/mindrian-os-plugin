#!/usr/bin/env node
'use strict';
/*
 * Phase 374 plan 08: Part 8 for the pair screen, proven end to end with the fake engine (Part 8 test file).
 *
 * The engine child is the fake uv of tests/fixtures/eureka-fake-engine-387 (a Node script, copied to a temp
 * folder). The real engine is never started, no local model is used, no network is used. The room is a real
 * bound fixture room. The one stand-in inside the plugin is the engine call that builds the artifact bundle
 * (deps.callEurekaWorkflow of prepare): it turns the projected snapshot into artifacts, the way the engine
 * does, so the real project() and the real prepare() both run.
 *
 * The flow under test: eureka_capability_start (plan, card) -> the person approves -> start -> status -> result.
 * The person's answer is given through the gate ledger (consumeGate and resumeFn), as tests/test-289 does,
 * because gate_answer would save a decision record in the room and this file proves the room is unchanged.
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   E1  a run through the fake engine (plan, approve, status, result) leaves the room folder content and room.db
 *       byte-equal. The hash skips the SQLite -wal, -shm and -journal files: SQLite creates and removes these by
 *       itself when a connection opens or closes a database, and they hold no room content.
 *   E2  the fake saw one plan call and one start call with the same request digest, the start call having an
 *       approval block, and one scout_capabilities call for both children (the catalog cache of plan 374-06)
 *   E3  the marker strings (planted in note titles and texts) reach the engine request for the plan and the start
 *       (watch count above zero) and appear zero times in the gate card, the awaiting_approval answer and every
 *       field of the final answer except engine_result. The room path and room.db never reach the engine.
 *   E4  the parent sets UV_OFFLINE, HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE to '0'; every child the fake saw
 *       holds '1' for all three (so the '1' comes only from the forcing of the plugin); the host made no
 *       non-loopback connection (the counter is proven by a loopback control)
 *   E5  with MINDRIAN_EUREKA_ALLOW_NETWORK=1 the start is refused and the fake records no new child start
 *   E6  a sealed fixture room (a top-level GUARDRAIL.md) gives room_sealed from the bundle step and no child starts
 *
 * Exit: 0 all pass; 1 any FAIL; 77 ENV GAP on win32. Hyphens only.
 */

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the fake uv is an executable Node script; win32 is not covered\n');
  process.exit(77);
}

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const dns = require('node:dns');

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'eureka-fake-engine-387');
const ID = 'opportunity.run_pair_screen';

// ---------------------------------------------------------------------------
// the network counter: installed BEFORE any tool module is required
// ---------------------------------------------------------------------------

const attempts = [];
function isLoopbackHost(host) {
  const h = String(host === undefined || host === null ? 'localhost' : host).toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || h === '0.0.0.0' || /^127\./.test(h) || /^::ffff:127\./.test(h);
}
function describeConnect(args) {
  let a0 = args[0];
  if (Array.isArray(a0)) a0 = a0[0];
  if (a0 && typeof a0 === 'object') {
    if (a0.path) return { kind: 'unix', host: null, local: true };
    const host = a0.host === undefined ? 'localhost' : a0.host;
    return { kind: 'inet', host: String(host), local: isLoopbackHost(host) };
  }
  if (typeof a0 === 'string' && Number.isNaN(Number(a0))) return { kind: 'unix', host: null, local: true };
  const host = typeof args[1] === 'string' ? args[1] : 'localhost';
  return { kind: 'inet', host, local: isLoopbackHost(host) };
}
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function wrappedConnect(...args) {
  try { attempts.push(describeConnect(args)); } catch (_e) { attempts.push({ kind: 'unknown', host: null, local: false }); }
  return origConnect.apply(this, args);
};
const origLookup = dns.lookup;
dns.lookup = function wrappedLookup(hostname, ...rest) {
  attempts.push({ kind: 'dns', host: String(hostname), local: isLoopbackHost(hostname) });
  return origLookup.call(this, hostname, ...rest);
};
if (dns.promises && typeof dns.promises.lookup === 'function') {
  const origPromiseLookup = dns.promises.lookup;
  dns.promises.lookup = function wrappedPromiseLookup(hostname, ...rest) {
    attempts.push({ kind: 'dns', host: String(hostname), local: isLoopbackHost(hostname) });
    return origPromiseLookup.call(this, hostname, ...rest);
  };
}

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function arm(label, problems, extra) { if (problems.length) bad(label, problems.slice(0, 8).join('\n')); else ok(label, extra); }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function copyFixture(dir) {
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.chmodSync(path.join(dir, 'fake-uv.cjs'), 0o755);
  fs.writeFileSync(path.join(dir, 'repo-root.txt'), REPO + '\n');
}

function rowsOf(engine) {
  try {
    return fs.readFileSync(path.join(engine, 'observed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) { return []; }
}

// sha256 over every relative path and file content under dir, sorted. The SQLite -wal, -shm and -journal files
// are skipped: SQLite creates and removes them on open and close, and they hold no room content.
function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1)).forEach((e) => {
      if (/-(wal|shm|journal)$/.test(e.name)) return;
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) h.update('F ' + rel + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
    });
  })(dir);
  return h.digest('hex');
}

function makeServer() {
  return {
    registerTool() {},
    server: { getClientCapabilities() { return {}; } },
  };
}

function allStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.keys(value).forEach((k) => { out.push(k); allStrings(value[k], out); });
  return out;
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-374-08-egress-'));
  const engine = path.join(tmp, 'engine');
  fs.mkdirSync(engine);
  copyFixture(engine);
  const fake = path.join(engine, 'fake-uv.cjs');

  const isolatedHelper = require('./helpers/isolated-home-36925.cjs');
  const iso = isolatedHelper.mkIsolatedHome('374-08-egress');

  const saved = {};
  // The parent holds the three offline variables at '0', so a '1' in a child can only come from the plugin.
  const SET = {
    MINDRIAN_EUREKA_ROOT: engine,
    MINDRIAN_EUREKA_UV: fake,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_BRAIN_KEY: 'synthetic-key-374-08',
    HF_HUB_OFFLINE: '0',
    TRANSFORMERS_OFFLINE: '0',
    UV_OFFLINE: '0',
  };
  const cleanup = () => {
    for (const k of Object.keys(SET)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    try { iso.cleanup(); } catch (_e) { /* best effort */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  };

  try {
    // ---- the room: three notes whose titles and texts carry marker strings
    const born = isolatedHelper.birthFixtureRoom({ iso, slug: 'eureka-pair-screen-374-08', sessionId: 'fixture-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const boundSession = 'pair-screen-374-08-bound-session';
    const MARK_T = ['PLANTTITLE-a1f3-1', 'PLANTTITLE-a1f3-2', 'PLANTTITLE-a1f3-3'];
    const MARK_X = ['PLANTTEXT-9c42-1', 'PLANTTEXT-9c42-2', 'PLANTTEXT-9c42-3'];
    const MARKERS = MARK_T.concat(MARK_X);
    const nodeIds = [];
    const writeDb = nav.openRoomDbForCaller(born.roomDir);
    try {
      for (let i = 0; i < 3; i += 1) {
        const claim = nav.writeClaimNode(writeDb, {
          knowledge_type: 'fact', text: 'Synthetic note ' + MARK_X[i] + ' about a synthetic subject.',
          sessionId: boundSession, sourceSegment: 'pair-screen-374-08-' + i, extraProps: { title: MARK_T[i] },
        });
        if (!claim.ok) throw new Error('fixture claim not written: ' + JSON.stringify(claim));
        nodeIds.push(claim.node_id);
      }
    } finally { nav.closeRoomDbForCaller(writeDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(boundSession, { bound: [born.slug], primary: born.slug, sticky: true }, { home: iso.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    delete process.env.MINDRIAN_EUREKA_ALLOW_NETWORK;
    for (const k of Object.keys(SET)) { saved[k] = process.env[k]; process.env[k] = SET[k]; }

    // The counter is installed above, before this require.
    const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');
    const run = require('../lib/mcp/tools/eureka-capability-run.cjs');
    const gateLedger = require('../lib/mcp/gate-ledger.cjs');
    run.clearCatalogCache();

    // positive control of the counter: a loopback connect must be counted
    const control = attempts.length;
    await new Promise((resolve) => {
      const srv = net.createServer((s) => s.destroy());
      srv.listen(0, '127.0.0.1', () => {
        const s = net.connect({ host: '127.0.0.1', port: srv.address().port }, () => { s.destroy(); srv.close(); resolve(); });
        s.on('error', () => { srv.close(); resolve(); });
      });
    });
    const controlCounted = attempts.length > control;
    const sandbox = attempts.length;

    fs.writeFileSync(path.join(engine, 'watch.json'), JSON.stringify(MARK_X.concat(MARK_T, [born.roomDir, 'room.db', iso.roomsHome])));

    // The stand-in for the engine call that builds the artifact bundle: it reads the projected snapshot only.
    const bundleStandIn = async (capabilityId, request) => {
      const snap = request.snapshot;
      return { ok: true, result: {
        capability_id: capabilityId, status: 'completed_projection',
        scope_id: request.scope_id, snapshot_id: snap.meta.snapshot_id,
        artifacts: snap.nodes.map((n) => ({ id: n.id, source_ref: n.source_ref, title: n.name, text: n.text, sha256: n.text_sha256 })),
      } };
    };

    const extra = { sessionId: boundSession };
    const args = { capability_id: ID, request: { node_ids: nodeIds, objective: 'Find unusual pairs in the synthetic notes' } };
    const baseDeps = (env) => ({ env, ctx: { surface: 'cli' }, server: makeServer(), callEurekaWorkflow: bundleStandIn });

    const before = treeHash(born.roomDir);
    const problems = { e1: [], e2: [], e3: [], e4: [] };

    // ---- the flow: plan, card, approve, start, status, result
    const startRows0 = rowsOf(engine).filter((r) => r.kind === 'start').length;
    const awaiting = await jobs.startCapability(args, extra, baseDeps(Object.assign({}, process.env)));
    let started = null; let status = null; let finalAnswer = null; let card = null;
    if (!awaiting || awaiting.ok !== true || awaiting.status !== 'awaiting_approval' || typeof awaiting.gate_id !== 'string') {
      problems.e1.push('the start did not answer awaiting_approval: ' + JSON.stringify(awaiting).slice(0, 300));
    } else {
      const entry = gateLedger.consumeGate(awaiting.gate_id, boundSession);
      if (!entry || entry.ok === false || typeof entry.resumeFn !== 'function') {
        problems.e1.push('the gate is not in the ledger: ' + JSON.stringify(entry));
      } else {
        card = entry.card;
        started = await entry.resumeFn({ gate_id: awaiting.gate_id, chosen: ['approve_run'], verdict: 'approve' });
        if (!started || started.ok !== true || typeof started.job_id !== 'string') {
          problems.e1.push('the approved start did not give a job: ' + JSON.stringify(started).slice(0, 300));
        } else {
          status = await jobs.jobStatus({ job_id: started.job_id }, extra, baseDeps(process.env));
          finalAnswer = await jobs.jobResult({ job_id: started.job_id }, extra, baseDeps(process.env));
          if (!finalAnswer || finalAnswer.ok !== true) problems.e1.push('the result is not ok: ' + JSON.stringify(finalAnswer).slice(0, 300));
        }
      }
    }
    const after = treeHash(born.roomDir);
    if (before !== after) problems.e1.push('the room folder content changed (hash ' + before.slice(0, 12) + ' -> ' + after.slice(0, 12) + ')');
    arm('E1 plan, approve, status, result leave the room folder content and room.db byte-equal', problems.e1);

    // ---- E2
    const rows = rowsOf(engine);
    const calls = rows.filter((r) => r.kind === 'call');
    const planRows = calls.filter((r) => r.tool === 'scout_plan_pair_screen');
    const startCallRows = calls.filter((r) => r.tool === 'scout_start_pair_screen');
    const catalogRows = calls.filter((r) => r.tool === 'scout_capabilities');
    if (planRows.length !== 1) problems.e2.push('plan calls: ' + planRows.length);
    if (startCallRows.length !== 1) problems.e2.push('start calls: ' + startCallRows.length);
    if (planRows[0] && startCallRows[0]) {
      if (!planRows[0].canon_sha256 || planRows[0].canon_sha256 !== startCallRows[0].canon_sha256) problems.e2.push('the plan and start request digests differ');
      if (planRows[0].request_keys.includes('approval')) problems.e2.push('the plan request holds an approval block');
      if (!startCallRows[0].request_keys.includes('approval')) problems.e2.push('the start request has no approval block');
    }
    if (catalogRows.length !== 1) problems.e2.push('scout_capabilities calls: ' + catalogRows.length + ' (expected 1 for both children)');
    arm('E2 one plan call and one start call with the same request digest, an approval block on the start, one catalog call', problems.e2);

    // ---- E3
    for (const r of [planRows[0], startCallRows[0]]) {
      if (!r) { problems.e3.push('a call row is missing'); continue; }
      const hits = Array.isArray(r.watch_hits) ? r.watch_hits : [];
      const markerHits = hits.slice(0, MARKERS.length);
      if (!markerHits.some((n) => n > 0)) problems.e3.push(r.tool + ': no marker string reached the engine request');
      const roomHits = hits.slice(MARKERS.length);
      if (roomHits.some((n) => n > 0)) problems.e3.push(r.tool + ': the room path, room.db or the rooms home reached the engine request');
    }
    const outside = {
      card, awaiting,
      final_without_result: finalAnswer ? Object.assign({}, finalAnswer, { engine_result: undefined }) : null,
    };
    const flat = allStrings(outside, []).join('\n');
    for (const m of MARKERS) if (flat.indexOf(m) !== -1) problems.e3.push('marker ' + m + ' found in the card, the awaiting answer or a non-result field');
    if (!card) problems.e3.push('no card to scan');
    arm('E3 the marker strings reach the engine and appear zero times in the card, the awaiting answer and the non-result fields', problems.e3);

    // ---- E4
    const starts = rows.filter((r) => r.kind === 'start').slice(startRows0);
    if (starts.length < 2) problems.e4.push('expected 2 child starts (plan, start), saw ' + starts.length);
    for (const s of starts) {
      for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) {
        if (s[k] !== '1') problems.e4.push('a child saw ' + k + '=' + s[k]);
      }
    }
    if (process.env.UV_OFFLINE !== '0' || process.env.HF_HUB_OFFLINE !== '0' || process.env.TRANSFORMERS_OFFLINE !== '0') problems.e4.push('the parent offline variables are not 0');
    const outbound = attempts.slice(sandbox).filter((a) => !a.local);
    if (!controlCounted) problems.e4.push('the network counter did not count the loopback control');
    if (outbound.length) problems.e4.push('non-loopback attempts: ' + JSON.stringify(outbound.slice(0, 3)));
    arm('E4 the parent holds the offline variables at 0, every child sees 1, and the host made no non-loopback connection', problems.e4);

    // ---- E5
    const startsBefore5 = rowsOf(engine).filter((r) => r.kind === 'start').length;
    run.clearCatalogCache();
    const net1 = await jobs.startCapability(args, extra, baseDeps(Object.assign({}, process.env, { MINDRIAN_EUREKA_ALLOW_NETWORK: '1' })));
    const startsAfter5 = rowsOf(engine).filter((r) => r.kind === 'start').length;
    const p5 = [];
    if (!net1 || net1.ok !== false || net1.reason !== 'network_opt_in_active') p5.push('answer: ' + JSON.stringify(net1).slice(0, 200));
    if (startsAfter5 !== startsBefore5) p5.push('a child started (' + startsBefore5 + ' -> ' + startsAfter5 + ')');
    arm('E5 MINDRIAN_EUREKA_ALLOW_NETWORK=1 refuses the start and no child starts', p5);

    // ---- E6
    fs.writeFileSync(path.join(born.roomDir, 'GUARDRAIL.md'), '# Sealed fixture room\n');
    const startsBefore6 = rowsOf(engine).filter((r) => r.kind === 'start').length;
    const sealed = await jobs.startCapability(args, extra, baseDeps(Object.assign({}, process.env)));
    const startsAfter6 = rowsOf(engine).filter((r) => r.kind === 'start').length;
    const p6 = [];
    if (!sealed || sealed.ok !== false || sealed.reason !== 'room_sealed') p6.push('answer: ' + JSON.stringify(sealed).slice(0, 200));
    if (startsAfter6 !== startsBefore6) p6.push('a child started (' + startsBefore6 + ' -> ' + startsAfter6 + ')');
    arm('E6 a sealed room gives room_sealed from the bundle step and no child starts', p6);
  } catch (error) {
    bad('E0 the file ran to its end', String(error && error.stack || error));
  } finally {
    cleanup();
  }

  process.stdout.write('test-374-pair-screen-egress: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
}

main();
