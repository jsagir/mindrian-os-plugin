#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 06, task 1: self-test of the fake engine fixture (tests/fixtures/eureka-fake-engine-387).
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   F1  the fake, started as uv run --project ROOT --extra mcp-server eureka-mcp, serves the 10 tools
 *   F2  scout_capabilities returns 4 catalog entries, all experimental, on the routes named in the plans
 *   F3  after one tool call observed.jsonl holds the argv, the working folder, the sorted env keys and the 3 offline values
 *   F4  the first argument sync creates .venv/pyvenv.cfg and the marker folders for the --extra names, exit 0
 *   F5  the arguments that end with eureka doctor --json print a doctor-shaped JSON with one failing check, exit 1
 *   F6  the fake writes nothing outside its working folder; its source holds no network require and no fetch call
 *   F7  pair-screen plan: ready plan, closed key set, blocked plan by control file, approval ignored
 *   F8  pair-screen start: approval_missing, plan_unknown, plan_mismatch, good start, plan_consumed, idempotent retry
 *   F9  jobs across processes: job-script walk, second process sees the job, restart switch, result shape, delete
 *   F10 observed.jsonl rows of pair-screen calls hold the key set and a digest, no string value; the folder holds only the fake's own files
 *   F11 the request and result shapes validate against the engine schemas (read only; skipped when the tree or ajv is absent)
 *
 * The fixture folder is copied to a temp folder first, so the fake writes its record there and the repo stays
 * clean. The real engine is never started. No network. Exit 77 on win32 (the fake is an executable script).
 * Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'eureka-fake-engine-387');

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the fake uv is an executable Node script; win32 is not covered\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-fake-engine-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.chmodSync(path.join(dir, 'fake-uv.cjs'), 0o755);
  fs.writeFileSync(path.join(dir, 'repo-root.txt'), REPO + '\n');
  return dir;
}

function readObserved(dir) {
  try {
    return fs.readFileSync(path.join(dir, 'observed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) { return []; }
}

function listTree(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      out.push(path.relative(dir, p));
      if (e.isDirectory()) walk(p);
    }
  })(dir);
  return out.sort();
}

async function main() {
  const { Client } = require('@modelcontextprotocol/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
  const dir = copyFixture();
  const fake = path.join(dir, 'fake-uv.cjs');
  const childEnv = { PATH: process.env.PATH, HOME: dir, UV_OFFLINE: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
  const client = new Client({ name: 'fake-engine-selftest', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: fake,
    args: ['run', '--project', dir, '--extra', 'mcp-server', 'eureka-mcp'],
    cwd: dir,
    env: childEnv,
    stderr: 'pipe',
  });
  let tools = null;
  let catalog = null;
  try {
    await client.connect(transport);
    tools = (await client.listTools()).tools.map((t) => t.name).sort();
    const res = await client.callTool({ name: 'scout_capabilities', arguments: {} });
    catalog = res.structuredContent;
  } catch (e) {
    bad('F1 the fake serves tools/list through the real StdioClientTransport', String(e && e.stack || e));
  } finally {
    try { await client.close(); } catch (_e) { /* best effort */ }
  }

  // F1
  const want = ['scout_cancel', 'scout_capabilities', 'scout_capability_contract', 'scout_delete_job', 'scout_plan_pair_screen',
    'scout_result', 'scout_run_workflow', 'scout_start_opportunity_signal_scout', 'scout_start_pair_screen', 'scout_status'];
  if (tools && JSON.stringify(tools) === JSON.stringify(want)) ok('F1 the fake serves the 10 tools through the real StdioClientTransport');
  else if (tools) bad('F1 the fake serves the 10 tools', JSON.stringify(tools));

  // F2
  const caps = catalog && catalog.capabilities;
  const f2 = [];
  if (!Array.isArray(caps) || caps.length !== 4) f2.push('expected 4 catalog entries, got ' + JSON.stringify(caps && caps.length));
  else {
    const byId = Object.fromEntries(caps.map((c) => [c.id, c]));
    const expect = {
      'graph.explore_local_relationships': 'scout_run_workflow',
      'research.analyze_rs_domain_projection': 'scout_run_workflow',
      'opportunity.synthesize_discovery_signals': 'scout_start_opportunity_signal_scout',
      'opportunity.run_pair_screen': 'scout_start_pair_screen',
    };
    for (const id of Object.keys(expect)) {
      const c = byId[id];
      if (!c) { f2.push('missing ' + id); continue; }
      if (c.status !== 'experimental') f2.push(id + ' status ' + c.status);
      if (!c.routes || !c.routes.mcp || c.routes.mcp.tool !== expect[id]) f2.push(id + ' route ' + JSON.stringify(c.routes));
    }
    const ps = byId['opportunity.run_pair_screen'];
    if (ps && !(ps.routes && ps.routes.mcp && ps.routes.mcp.plan_tool === 'scout_plan_pair_screen')) f2.push('pair screen plan_tool ' + JSON.stringify(ps.routes));
  }
  if (f2.length) bad('F2 scout_capabilities returns the 4 catalog entries', f2.join('\n')); else ok('F2 scout_capabilities returns 4 experimental entries on their routes');

  // F3
  const rows = readObserved(dir);
  const start = rows.find((r) => r.kind === 'start');
  const call = rows.find((r) => r.kind === 'call');
  const f3 = [];
  if (!start) f3.push('no start row');
  else {
    if (JSON.stringify(start.argv) !== JSON.stringify(['run', '--project', dir, '--extra', 'mcp-server', 'eureka-mcp'])) f3.push('argv ' + JSON.stringify(start.argv));
    if (fs.realpathSync(start.cwd) !== fs.realpathSync(dir)) f3.push('cwd ' + start.cwd);
    if (JSON.stringify(start.env_keys) !== JSON.stringify(start.env_keys.slice().sort())) f3.push('env keys not sorted');
    for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) if (start[k] !== '1') f3.push(k + ' = ' + start[k]);
  }
  if (!call || call.tool !== 'scout_capabilities') f3.push('no call row for scout_capabilities');
  if (f3.length) bad('F3 observed.jsonl records the start and the call', f3.join('\n')); else ok('F3 observed.jsonl records argv, working folder, sorted env keys and the 3 offline values');

  // F4
  const dirSync = copyFixture();
  const syncRes = childProcess.spawnSync(path.join(dirSync, 'fake-uv.cjs'), ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server', '--extra', 'modern-encoder'],
    { cwd: dirSync, env: { PATH: process.env.PATH, HOME: dirSync }, encoding: 'utf8', shell: false });
  const site = path.join(dirSync, '.venv', 'lib', 'python3.12', 'site-packages');
  const f4 = [];
  if (syncRes.status !== 0) f4.push('exit ' + syncRes.status);
  if (!fs.existsSync(path.join(dirSync, '.venv', 'pyvenv.cfg'))) f4.push('no pyvenv.cfg');
  for (const m of ['mcp-2.3.0.dist-info', 'sentence_transformers-5.0.0.dist-info']) if (!fs.existsSync(path.join(site, m))) f4.push('missing ' + m);
  if (fs.existsSync(path.join(site, 'pomegranate-1.0.0.dist-info'))) f4.push('hmm marker made without --extra hmm');
  const syncRows = readObserved(dirSync);
  if (syncRows.length !== 1 || syncRows[0].kind !== 'sync') f4.push('expected one sync record, got ' + syncRows.length);
  if (f4.length) bad('F4 sync creates the environment and the marker folders', f4.join('\n')); else ok('F4 sync creates .venv/pyvenv.cfg and the marker folders for the --extra names, exit 0');

  // F5
  const dirDoc = copyFixture();
  const docArgs = ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', dirDoc, '--extra', 'mcp-server', 'eureka', 'doctor', '--json'];
  const docRes = childProcess.spawnSync(path.join(dirDoc, 'fake-uv.cjs'), docArgs, { cwd: dirDoc, env: { PATH: process.env.PATH, HOME: dirDoc, UV_OFFLINE: '1' }, encoding: 'utf8', shell: false });
  const f5 = [];
  let doc = null;
  try { doc = JSON.parse(docRes.stdout); } catch (_e) { f5.push('stdout is not JSON'); }
  if (docRes.status !== 1) f5.push('exit ' + docRes.status);
  if (doc) {
    const failing = (doc.checks || []).filter((c) => c.status === 'FAIL');
    if (doc.ok !== false) f5.push('ok is not false');
    if (failing.length !== 1 || failing[0].message !== 'Missing Python libraries: sentence_transformers') f5.push('failing checks ' + JSON.stringify(failing));
  }
  const docRows = readObserved(dirDoc);
  if (docRows.length !== 1 || docRows[0].kind !== 'doctor') f5.push('expected one doctor record');
  if (f5.length) bad('F5 the doctor entry prints a doctor-shaped JSON and exits 1', f5.join('\n')); else ok('F5 the doctor entry prints a doctor-shaped JSON with one failing check, exit 1');

  // F6: nothing outside the working folder (the copy folder holds the only new files), and a clean source
  const f6 = [];
  const src = fs.readFileSync(FIXTURE + '/fake-uv.cjs', 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  if (/require\(\s*['"](node:)?(http|https|http2|net|dns|tls|dgram|child_process)['"]\s*\)/.test(code)) f6.push('a network module is required');
  if (/\bfetch\s*\(/.test(code)) f6.push('a fetch call');
  if (/\b(spawn|exec|execFile|fork)(Sync)?\s*\(/.test(code)) f6.push('a process spawn call');
  const treeBefore = listTree(FIXTURE).join(',');
  if (treeBefore !== 'fake-uv.cjs,pyproject.toml') f6.push('the repo fixture folder changed: ' + treeBefore);
  const sync = listTree(dirSync);
  for (const p of sync) {
    if (!(p === 'fake-uv.cjs' || p === 'pyproject.toml' || p === 'repo-root.txt' || p === 'observed.jsonl' || p.startsWith('.venv'))) f6.push('unexpected file in the working folder: ' + p);
  }
  if (f6.length) bad('F6 the fake writes only in its working folder and holds no network code', f6.join('\n')); else ok('F6 the fake writes only in its working folder; no network require, no fetch call');

  // ------------------------------------------------------------------------
  // F7 to F11: the pair-screen routes (plan 374-02). All values are synthetic.
  // ------------------------------------------------------------------------
  const dirPS = copyFixture();
  const sleepers = [];
  async function openClient(folder) {
    const c = new Client({ name: 'fake-engine-selftest-ps', version: '1.0.0' }, { capabilities: {} });
    const t = new StdioClientTransport({
      command: path.join(folder, 'fake-uv.cjs'),
      args: ['run', '--project', folder, '--extra', 'mcp-server', 'eureka-mcp'],
      cwd: folder, env: childEnv, stderr: 'pipe',
    });
    await c.connect(t);
    sleepers.push(c);
    return c;
  }
  async function callTool2(c, name, args) {
    const res = await c.callTool({ name, arguments: args || {} });
    const sc = res.structuredContent;
    if (sc !== undefined) return { data: sc, isError: !!res.isError, text: JSON.stringify(sc) };
    const text = (res.content || []).map((x) => x.text || '').join('');
    let data = null;
    try { data = JSON.parse(text); } catch (_e) { data = null; }
    return { data, isError: !!res.isError, text };
  }
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function digestOf(req) {
    const copy = Object.assign({}, req);
    delete copy.approval;
    return crypto.createHash('sha256').update(canon(copy)).digest('hex');
  }
  function makeReq(tag, extra) {
    const req = {
      objective: 'zebra-objective-387-' + tag,
      scope_id: 'scope-387-' + tag,
      snapshot_id: 'snap-387-' + tag,
      artifacts: [1, 2, 3].map((n) => ({ id: 'art-' + tag + '-' + n, source_ref: 'ref://quokka/' + tag + '/' + n, title: 'Title ' + n + ' ' + tag, text: 'quokka text number ' + n + ' for ' + tag })),
    };
    return Object.assign(req, extra || {});
  }
  const rec = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dirPS, name), 'utf8')); } catch (_e) { return null; } };
  const put = (name, obj) => fs.writeFileSync(path.join(dirPS, name), JSON.stringify(obj));
  const drop = (name) => { try { fs.unlinkSync(path.join(dirPS, name)); } catch (_e) { /* absent */ } };
  const hex64 = /^[a-f0-9]{64}$/;
  const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

  let A = null;
  let B = null;
  let r1 = null;
  let planA = null;
  let startA = null;
  let lastResult = null;
  const f7 = [];
  const f8 = [];
  const f9 = [];
  try {
    A = await openClient(dirPS);

    // F7
    r1 = makeReq('one');
    planA = (await callTool2(A, 'scout_plan_pair_screen', { request: r1 })).data || {};
    if (planA.status !== 'ready') f7.push('status ' + planA.status);
    if (!hex64.test(String(planA.plan_digest))) f7.push('plan_digest ' + planA.plan_digest);
    if (planA.plan_digest !== digestOf(r1)) f7.push('digest differs from the canonical digest of the request');
    if (!planA.counts || planA.counts.artifacts !== 3) f7.push('counts ' + JSON.stringify(planA.counts));
    if (!Array.isArray(planA.engines) || planA.engines.length !== 2) f7.push('engines ' + JSON.stringify(planA.engines));
    if (!planA.host_handoff || planA.host_handoff.state !== 'awaiting_approval') f7.push('host_handoff ' + JSON.stringify(planA.host_handoff));
    const badTop = (await callTool2(A, 'scout_plan_pair_screen', { request: Object.assign(makeReq('one'), { surprise: 1 }) })).data || {};
    if (badTop.status !== 'refused' || badTop.reason !== 'bad_request') f7.push('unknown top-level key: ' + JSON.stringify(badTop));
    const badArt = makeReq('one');
    badArt.artifacts[0].surprise = 'x';
    const badArtRes = (await callTool2(A, 'scout_plan_pair_screen', { request: badArt })).data || {};
    if (badArtRes.status !== 'refused' || badArtRes.reason !== 'bad_request') f7.push('unknown artifact key: ' + JSON.stringify(badArtRes));
    const withApproval = (await callTool2(A, 'scout_plan_pair_screen', { request: Object.assign(makeReq('one'), { approval: { plan_digest: 'a'.repeat(64), approval_ref: 'ignored-1' } }) })).data || {};
    if (withApproval.status !== 'ready' || withApproval.plan_digest !== planA.plan_digest) f7.push('approval block not ignored: ' + JSON.stringify(withApproval).slice(0, 200));
    const before = (rec('receipts.json') || {}).receipts;
    const beforeCount = Array.isArray(before) ? before.length : -1;
    put('plan-mode.json', { mode: 'blocked', reason: 'local_model_unavailable' });
    const blocked = (await callTool2(A, 'scout_plan_pair_screen', { request: makeReq('blk') })).data || {};
    if (blocked.status !== 'blocked' || blocked.reason !== 'local_model_unavailable') f7.push('blocked plan: ' + JSON.stringify(blocked).slice(0, 200));
    if (!blocked.host_handoff || blocked.host_handoff.state !== 'blocked') f7.push('blocked host_handoff ' + JSON.stringify(blocked.host_handoff));
    const after = (rec('receipts.json') || {}).receipts;
    if (!Array.isArray(after) || after.length !== beforeCount) f7.push('a blocked plan recorded a receipt (' + beforeCount + ' -> ' + (after && after.length) + ')');
    put('plan-mode.json', { mode: 'refused', reason: 'bad_request' });
    const forced = (await callTool2(A, 'scout_plan_pair_screen', { request: makeReq('ref') })).data || {};
    if (forced.status !== 'refused' || forced.reason !== 'bad_request') f7.push('forced refusal: ' + JSON.stringify(forced).slice(0, 200));
    drop('plan-mode.json');

    // F8
    const REF1 = 'approval-387-1';
    const noAppr = (await callTool2(A, 'scout_start_pair_screen', { request: makeReq('one') })).data || {};
    if (noAppr.status !== 'refused' || noAppr.reason !== 'approval_missing') f8.push('no approval: ' + JSON.stringify(noAppr).slice(0, 160));
    const unknown = (await callTool2(A, 'scout_start_pair_screen', { request: Object.assign(makeReq('one'), { approval: { plan_digest: 'f'.repeat(64), approval_ref: REF1 } }) })).data || {};
    if (unknown.status !== 'refused' || unknown.reason !== 'plan_unknown') f8.push('unknown digest: ' + JSON.stringify(unknown).slice(0, 160));
    const mism = (await callTool2(A, 'scout_start_pair_screen', { request: Object.assign(makeReq('one', { objective: 'another objective entirely' }), { approval: { plan_digest: planA.plan_digest, approval_ref: REF1 } }) })).data || {};
    if (mism.status !== 'refused' || mism.reason !== 'plan_mismatch') f8.push('mismatch: ' + JSON.stringify(mism).slice(0, 160));
    const startReq = Object.assign(makeReq('one'), { approval: { plan_digest: planA.plan_digest, approval_ref: REF1 } });
    startA = (await callTool2(A, 'scout_start_pair_screen', { request: startReq, idempotency_key: 'key-387-1' })).data || {};
    if (!startA.job_id || startA.status !== 'queued') f8.push('good start: ' + JSON.stringify(startA).slice(0, 200));
    if (!startA.approval || startA.approval.verified_by_engine !== false || startA.approval.approval_ref !== REF1) f8.push('start approval block ' + JSON.stringify(startA.approval));
    const rcpts = (rec('receipts.json') || {}).receipts || [];
    if (!rcpts.some((x) => x.digest === planA.plan_digest && x.used === true && x.job_id === startA.job_id)) f8.push('receipt not marked used: ' + JSON.stringify(rcpts).slice(0, 200));
    const again = (await callTool2(A, 'scout_start_pair_screen', { request: startReq, idempotency_key: 'key-387-2' })).data || {};
    if (again.status !== 'refused' || again.reason !== 'plan_consumed') f8.push('second start: ' + JSON.stringify(again).slice(0, 160));
    const retry = (await callTool2(A, 'scout_start_pair_screen', { request: startReq, idempotency_key: 'key-387-1' })).data || {};
    if (retry.job_id !== startA.job_id) f8.push('retry returned job ' + retry.job_id + ' not ' + startA.job_id);

    // F9
    put('job-script.json', { statuses: ['queued', 'running', 'completed'] });
    B = await openClient(dirPS);
    const s1 = (await callTool2(A, 'scout_status', { job_id: startA.job_id })).data || {};
    const s2 = (await callTool2(A, 'scout_status', { job_id: startA.job_id })).data || {};
    const s3 = (await callTool2(B, 'scout_status', { job_id: startA.job_id })).data || {};
    const s4 = (await callTool2(B, 'scout_status', { job_id: startA.job_id })).data || {};
    const walk = [s1.status, s2.status, s3.status, s4.status].join(',');
    if (walk !== 'queued,running,completed,completed') f9.push('status walk across 2 processes: ' + walk);
    const resB = await callTool2(B, 'scout_result', { job_id: startA.job_id });
    lastResult = resB.data;
    const keys = ['schema_version', 'capability_id', 'status', 'job_id', 'label', 'summary_line', 'scope', 'approval', 'counts', 'caps_hit', 'warnings',
      'manifest_sha256', 'files', 'id_map', 'outputs', 'host_handoff', 'room_write', 'portfolio_write', 'persistence'];
    const miss = keys.filter((k) => !lastResult || !(k in lastResult));
    if (miss.length) f9.push('result misses keys ' + miss.join(','));
    else {
      if (lastResult.scope.scope_id !== startReq.scope_id || lastResult.scope.snapshot_id !== startReq.snapshot_id) f9.push('result scope ' + JSON.stringify(lastResult.scope));
      if (lastResult.label !== 'candidate, not verified') f9.push('label ' + lastResult.label);
      if (lastResult.approval.plan_digest !== planA.plan_digest || lastResult.approval.approval_ref !== REF1 || lastResult.approval.verified_by_engine !== false) f9.push('result approval ' + JSON.stringify(lastResult.approval));
      const inline = lastResult.files.filter((f) => f.inline);
      const outline = lastResult.files.filter((f) => !f.inline);
      if (inline.length !== 4 || outline.length !== 1) f9.push('files inline/not inline: ' + inline.length + '/' + outline.length);
      for (const f of inline) if (sha(f.content) !== f.sha256) f9.push('inline hash mismatch for ' + f.path);
      for (const f of outline) if ('content' in f) f9.push('non-inline file holds content: ' + f.path);
      const mf = inline.find((f) => f.path === 'manifest.json');
      if (!mf || sha(mf.content) !== lastResult.manifest_sha256) f9.push('manifest_sha256 does not match manifest.json');
    }
    // restart switch on a second job
    const req2 = makeReq('two');
    const plan2 = (await callTool2(A, 'scout_plan_pair_screen', { request: req2 })).data || {};
    const start2 = (await callTool2(A, 'scout_start_pair_screen', { request: Object.assign({}, req2, { approval: { plan_digest: plan2.plan_digest, approval_ref: 'approval-387-2' } }) })).data || {};
    if (!start2.job_id || start2.job_id === startA.job_id) f9.push('second job id ' + start2.job_id);
    put('restart.json', { restart: true });
    const rs = (await callTool2(B, 'scout_status', { job_id: start2.job_id })).data || {};
    if (rs.status !== 'failed' || rs.progress !== 'interrupted' || rs.failure_code !== 'server_restarted') f9.push('restart state: ' + JSON.stringify(rs));
    drop('restart.json');
    const rs2 = (await callTool2(A, 'scout_status', { job_id: start2.job_id })).data || {};
    if (rs2.status !== 'failed' || rs2.failure_code !== 'server_restarted') f9.push('restart state not persisted: ' + JSON.stringify(rs2));
    const doneAfterRestart = (await callTool2(A, 'scout_result', { job_id: startA.job_id })).data || {};
    if (doneAfterRestart.status !== 'completed') f9.push('a completed job changed state under restart.json: ' + doneAfterRestart.status);
    // delete
    const del = (await callTool2(B, 'scout_delete_job', { job_id: startA.job_id })).data || {};
    if (del.job_id !== startA.job_id || del.deleted !== true) f9.push('delete answer ' + JSON.stringify(del));
    const gone = await callTool2(A, 'scout_status', { job_id: startA.job_id });
    if (!gone.isError || !/job not found/.test(gone.text)) f9.push('status after delete: isError=' + gone.isError + ' text=' + gone.text.slice(0, 120));
  } catch (e) {
    const why = 'exception: ' + String(e && e.stack || e);
    f7.push(why);
    f8.push('arm did not complete: ' + why.split('\n')[0]);
    f9.push('arm did not complete: ' + why.split('\n')[0]);
  } finally {
    for (const c of sleepers) { try { await c.close(); } catch (_e) { /* best effort */ } }
  }
  if (f7.length) bad('F7 the pair-screen plan route', f7.join('\n')); else ok('F7 the plan gives a ready plan, a closed key set, a blocked plan from the control file, and ignores the approval block');
  if (f8.length) bad('F8 the pair-screen start route', f8.join('\n')); else ok('F8 the start gives approval_missing, plan_unknown, plan_mismatch, one job, plan_consumed and an idempotent retry');
  if (f9.length) bad('F9 jobs across processes', f9.join('\n')); else ok('F9 jobs live in files: 2 processes share the walk, the restart switch, the result shape and the delete');

  // F10
  const f10 = [];
  const psRows = readObserved(dirPS).filter((r) => r.kind === 'call' && /pair_screen$/.test(r.tool));
  if (psRows.length < 10) f10.push('expected at least 10 pair-screen rows, got ' + psRows.length);
  const planRow = psRows.find((r) => r.tool === 'scout_plan_pair_screen');
  if (planRow) {
    if (planRow.canon_sha256 !== digestOf(r1)) f10.push('canon_sha256 ' + planRow.canon_sha256);
    const wantKeys = Object.keys(r1).sort();
    if (JSON.stringify(planRow.request_keys) !== JSON.stringify(wantKeys)) f10.push('request_keys ' + JSON.stringify(planRow.request_keys));
  } else f10.push('no plan row');
  const strings = [];
  (function collect(v) { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); })(r1);
  for (const row of psRows) {
    const view = JSON.stringify({ tool: row.tool, request: row.request, shape: row.shape, watch_hits: row.watch_hits, canon_sha256: row.canon_sha256, request_keys: row.request_keys });
    for (const s of strings) if (s.length >= 8 && view.includes(s)) f10.push('a request string is in a ' + row.tool + ' row: ' + s.slice(0, 20));
    if (view.includes(String(startA && startA.job_id)) && startA && startA.job_id && row.tool === 'scout_start_pair_screen') f10.push('a job id is in a start row');
  }
  const allowed = new Set(['fake-uv.cjs', 'pyproject.toml', 'repo-root.txt', 'observed.jsonl', 'jobs.json', 'receipts.json', 'job-script.json', 'plan-mode.json', 'restart.json', 'watch.json', 'expected-lineage.json']);
  for (const p of listTree(dirPS)) if (!allowed.has(p)) f10.push('unexpected file in the working folder: ' + p);
  if (f10.length) bad('F10 the observed rows keep the key set and a digest, no string value', f10.join('\n')); else ok('F10 pair-screen rows hold the key set and a digest and no string value; the folder holds only the fake files');

  // F11
  let f11Skip = null;
  const eurekaSchemas = '/home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/data/schemas';
  let inputSchema = null;
  let outputSchema = null;
  try {
    inputSchema = JSON.parse(fs.readFileSync(path.join(eurekaSchemas, 'pair-screen-input.v1.json'), 'utf8'));
    outputSchema = JSON.parse(fs.readFileSync(path.join(eurekaSchemas, 'pair-screen-output.v1.json'), 'utf8'));
  } catch (_e) { f11Skip = 'the Eureka schema files are not readable'; }
  let AjvClass = null;
  if (!f11Skip) {
    try {
      AjvClass = String(inputSchema.$schema).includes('2020-12') ? require('ajv/dist/2020') : require('ajv');
      AjvClass = AjvClass.default || AjvClass;
    } catch (_e) { f11Skip = 'ajv is not installed'; }
  }
  if (f11Skip) process.stdout.write('skip - F11 ' + f11Skip + '\n');
  else {
    const f11 = [];
    const ajv = new AjvClass({ strict: false, allErrors: true });
    const vIn = ajv.compile(inputSchema);
    const vOut = new AjvClass({ strict: false, allErrors: true }).compile(outputSchema);
    const good = makeReq('one');
    if (!vIn(good)) f11.push('plan request fails the input schema: ' + JSON.stringify(vIn.errors));
    const goodStart = Object.assign(makeReq('one'), { approval: { plan_digest: 'a'.repeat(64), approval_ref: 'approval-387-1' } });
    if (!vIn(goodStart)) f11.push('start request fails the input schema: ' + JSON.stringify(vIn.errors));
    if (vIn(Object.assign(makeReq('one'), { surprise: 1 }))) f11.push('an unknown top-level key passes the input schema');
    const badArt = makeReq('one');
    badArt.artifacts[0].surprise = 'x';
    if (vIn(badArt)) f11.push('an unknown artifact key passes the input schema');
    if (!lastResult) f11.push('no fake result to validate (F9 gave none)');
    else if (!vOut(lastResult)) f11.push('fake result fails the output schema: ' + JSON.stringify(vOut.errors));
    if (f11.length) bad('F11 the fake shapes validate against the engine schemas', f11.join('\n')); else ok('F11 the fake request examples and the fake result validate against the engine pair-screen schemas');
  }

  for (const d of [dir, dirSync, dirDoc, dirPS]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  process.stdout.write('\ntest-387-eureka-fake-engine: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
