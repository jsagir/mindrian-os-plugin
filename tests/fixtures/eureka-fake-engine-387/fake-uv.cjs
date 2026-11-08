#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 06: a fake uv that stands in for the Eureka engine in tests. It is a Node script.
 *
 * It behaves by its arguments (argv[2] onward):
 *   sync ...                       creates .venv/pyvenv.cfg and marker folders for the --extra names, records, exits 0
 *   ... eureka doctor --json       prints a doctor-shaped JSON with one failing check, records, exits 1
 *   --version                      prints a version line (no record, no file)
 *   python find ...                prints a path (no record, no file)
 *   run ...                        serves a minimal Eureka MCP over stdio (10 tools: the 7 first ones plus the pair-screen plan,
 *                                  start and delete tools) and records every call
 *
 * It records one JSON line per start and per tool call to ./observed.jsonl in its working folder: the
 * arguments, the working folder, the sorted environment keys, the values of UV_OFFLINE, HF_HUB_OFFLINE and
 * TRANSFORMERS_OFFLINE and, for a tool call, the request with every string value replaced by its length
 * (except values under a key named node_ids). An optional ./watch.json (array of strings) makes the fake
 * count, per needle index, how often the raw request holds that needle; the needle itself is never recorded.
 * An optional ./expected-lineage.json ({scope_id, snapshot_id}) sets the lineage ids of the answers.
 *
 * It makes no network call, requires no network module, and writes only inside its working folder.
 * It is synthetic: the real engine is never started by the tests that use it. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const argv = process.argv.slice(2);
const cwd = process.cwd();
const OFFLINE = ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'];

function record(entry) {
  const row = Object.assign({
    argv,
    cwd,
    env_keys: Object.keys(process.env).sort(),
    UV_OFFLINE: process.env.UV_OFFLINE === undefined ? null : process.env.UV_OFFLINE,
    HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE === undefined ? null : process.env.HF_HUB_OFFLINE,
    TRANSFORMERS_OFFLINE: process.env.TRANSFORMERS_OFFLINE === undefined ? null : process.env.TRANSFORMERS_OFFLINE,
  }, entry);
  // env values are recorded only for the variables a test may need to read back
  row.env_values = {};
  for (const key of OFFLINE.concat(['UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PROJECT_ENVIRONMENT', 'MINDRIAN_EUREKA_DATA_DIR', 'MINDRIAN_EUREKA_CACHE_DIR'])) {
    if (process.env[key] !== undefined) row.env_values[key] = process.env[key];
  }
  row.env_all = Object.assign({}, process.env);
  fs.appendFileSync(path.join(cwd, 'observed.jsonl'), JSON.stringify(row) + '\n');
}

function extraNames() {
  const names = [];
  for (let i = 0; i < argv.length - 1; i += 1) if (argv[i] === '--extra') names.push(argv[i + 1]);
  return names;
}

const MARKERS = {
  'mcp-server': ['mcp-2.3.0.dist-info'],
  'modern-encoder': ['sentence_transformers-5.0.0.dist-info'],
  'reference-encoder': ['torch-2.0.0.dist-info', 'transformers-4.0.0.dist-info'],
  hmm: ['pomegranate-1.0.0.dist-info'],
};

function doSync() {
  const venv = path.join(cwd, '.venv');
  const site = path.join(venv, 'lib', 'python3.12', 'site-packages');
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(venv, 'pyvenv.cfg'), 'home = /synthetic\n');
  for (const extra of extraNames()) {
    for (const marker of MARKERS[extra] || []) fs.mkdirSync(path.join(site, marker), { recursive: true });
  }
  record({ kind: 'sync' });
  process.exit(0);
}

function doDoctor() {
  record({ kind: 'doctor' });
  const body = {
    ok: false,
    checks: [
      { id: 'C1', name: 'Python version', status: 'PASS', message: 'ok', fix: '' },
      { id: 'C2', name: 'Python libraries', status: 'FAIL', message: 'Missing Python libraries: sentence_transformers', fix: 'Install the modern-encoder group.' },
    ],
  };
  process.stdout.write(JSON.stringify(body) + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// the engine
// ---------------------------------------------------------------------------

function repoNodeModulesRoot() {
  // in the repo: tests/fixtures/eureka-fake-engine-387 -> repo root is three folders up
  const inRepo = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(inRepo, 'node_modules', '@modelcontextprotocol', 'server'))) return inRepo;
  // a copy in a temp folder: the test writes repo-root.txt next to the fake
  try { return fs.readFileSync(path.join(cwd, 'repo-root.txt'), 'utf8').trim(); } catch (_e) { return null; }
}

function redact(value, key) {
  if (typeof value === 'string') return key === 'node_ids' ? value : value.length;
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = redact(value[k], k);
    return out;
  }
  return value;
}

function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, name), 'utf8')); } catch (_e) { return null; }
}

function watchHits(raw) {
  const needles = readJson('watch.json');
  if (!Array.isArray(needles)) return null;
  return needles.map((needle) => (typeof needle === 'string' && needle ? raw.split(needle).length - 1 : 0));
}

function serve() {
  const base = repoNodeModulesRoot();
  if (!base) { process.stderr.write('fake-uv: no node_modules root\n'); process.exit(2); }
  const { createRequire } = require('node:module');
  const req = createRequire(path.join(base, 'package.json'));
  const { McpServer } = req('@modelcontextprotocol/server');
  const { serveStdio } = req('@modelcontextprotocol/server/stdio');
  const { z } = req('zod');

  record({ kind: 'start' });

  const CATALOG = [
    { id: 'graph.explore_local_relationships', status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } },
    { id: 'research.analyze_rs_domain_projection', status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } },
    { id: 'opportunity.synthesize_discovery_signals', status: 'experimental', routes: { mcp: { tool: 'scout_start_opportunity_signal_scout' } } },
    { id: 'opportunity.run_pair_screen', status: 'experimental', routes: { mcp: { tool: 'scout_start_pair_screen', plan_tool: 'scout_plan_pair_screen' } } },
  ];
  const JOB_ID = 'fake-job-387';
  let lastScope = { scope_id: 'fake-scope', snapshot_id: 'fake-snapshot' };

  function lineage(request) {
    const file = readJson('expected-lineage.json');
    const snapshotMeta = request && request.snapshot && request.snapshot.meta;
    const scope = (request && request.scope_id) || (snapshotMeta && snapshotMeta.scope_id) || (file && file.scope_id) || 'fake-scope';
    const snap = (request && request.snapshot_id) || (snapshotMeta && snapshotMeta.snapshot_id) || (file && file.snapshot_id) || 'fake-snapshot';
    lastScope = { scope_id: scope, snapshot_id: snap };
    return lastScope;
  }

  function shapeOf(request) {
    if (!request || typeof request !== 'object') return null;
    const snapshot = request.snapshot;
    return {
      keys: Object.keys(request).sort(),
      snapshot_nodes: snapshot && Array.isArray(snapshot.nodes) ? snapshot.nodes.length : null,
      snapshot_edges: snapshot && Array.isArray(snapshot.edges) ? snapshot.edges.length : null,
    };
  }

  function answer(payload) {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
  }

  function observe(tool, args) {
    let raw = '';
    try { raw = JSON.stringify(args === undefined ? null : args); } catch (_e) { raw = ''; }
    record({ kind: 'call', tool, request: redact(args === undefined ? null : args), shape: shapeOf(args && args.request), watch_hits: watchHits(raw) });
  }

  const permissive = z.object({}).passthrough();
  const server = new McpServer({ name: 'fake-eureka-387', version: '0.0.0' });

  server.registerTool('scout_capabilities', { description: 'fake catalog', inputSchema: permissive }, async (args) => {
    observe('scout_capabilities', args);
    return answer({ capabilities: CATALOG });
  });
  server.registerTool('scout_capability_contract', { description: 'fake contract', inputSchema: permissive }, async (args) => {
    observe('scout_capability_contract', args);
    return answer({ capability: { id: args && args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
  });
  server.registerTool('scout_run_workflow', { description: 'fake workflow', inputSchema: permissive }, async (args) => {
    observe('scout_run_workflow', args);
    const ids = lineage(args && args.request);
    return answer(Object.assign({ capability_id: args && args.capability_id, status: 'completed_analysis' }, ids));
  });
  server.registerTool('scout_start_opportunity_signal_scout', { description: 'fake async start', inputSchema: permissive }, async (args) => {
    observe('scout_start_opportunity_signal_scout', args);
    lineage(args && args.request);
    return answer({ job_id: JOB_ID, status: 'queued' });
  });
  server.registerTool('scout_status', { description: 'fake status', inputSchema: permissive }, async (args) => {
    observe('scout_status', args);
    if (isPairJob(args && args.job_id)) {
      const jobs = loadState('jobs.json', { next: 1, jobs: {} });
      const job = jobs.jobs[args.job_id];
      if (!job) return notFound();
      if (!applyRestart(job, jobs) && !FINAL.includes(job.state)) {
        const script = readJson('job-script.json');
        const list = script && Array.isArray(script.statuses) && script.statuses.length ? script.statuses : ['completed'];
        job.state = String(list[Math.min(job.step, list.length - 1)]);
        job.step += 1;
        saveState('jobs.json', jobs);
      }
      return answer(jobView(job));
    }
    return answer({ job_id: JOB_ID, status: 'completed' });
  });
  server.registerTool('scout_result', { description: 'fake result', inputSchema: permissive }, async (args) => {
    observe('scout_result', args);
    if (isPairJob(args && args.job_id)) {
      const jobs = loadState('jobs.json', { next: 1, jobs: {} });
      const job = jobs.jobs[args.job_id];
      if (!job) return notFound();
      applyRestart(job, jobs);
      return answer(job.state === 'completed' ? buildResult(job) : jobView(job));
    }
    return answer({ capability_id: 'opportunity.synthesize_discovery_signals', status: 'completed', scope: lastScope });
  });
  server.registerTool('scout_cancel', { description: 'fake cancel', inputSchema: permissive }, async (args) => {
    observe('scout_cancel', args);
    return answer({ ok: true });
  });

  // -------------------------------------------------------------------------
  // the pair-screen routes (Phase 374 plan 02). A synthetic copy of the engine contract.
  // State lives in files of the working folder, so a second fake process in the same folder sees the
  // same jobs and receipts. Control files, all optional, read at call time:
  //   plan-mode.json   {mode: "blocked"|"refused", reason}   forces the plan answer
  //   job-script.json  {statuses: [...]}                      status walk, one step for each scout_status call
  //   restart.json     any content                            a status or result call on a job that is not final answers failed/server_restarted and keeps it
  // The fake computes its own digest (sha256 of the canonical JSON of the request without approval).
  // The plugin must never recompute it: the plugin only passes on the digest that the plan answered.
  // -------------------------------------------------------------------------
  const CAPABILITY = 'opportunity.run_pair_screen';
  const LABEL = 'candidate, not verified';
  const FINAL = ['completed', 'completed_empty', 'failed', 'cancelled'];
  const TOP_KEYS = ['objective', 'scope_id', 'snapshot_id', 'artifacts', 'top_k', 'approval'];
  const ART_KEYS = ['id', 'source_ref', 'title', 'text', 'corpus', 'media_type', 'sha256'];

  function canonJson(v) {
    if (Array.isArray(v)) return '[' + v.map(canonJson).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonJson(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
  function requestDigest(request) {
    const copy = Object.assign({}, request);
    delete copy.approval;
    return sha256(canonJson(copy));
  }
  function loadState(name, empty) {
    const v = readJson(name);
    return v && typeof v === 'object' ? v : empty;
  }
  function saveState(name, value) {
    const tmp = path.join(cwd, name + '.' + process.pid + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, path.join(cwd, name));
  }
  function refusal(reason, message, fix) {
    return { status: 'refused', reason, message, fix, label: LABEL, room_write: 'not_performed' };
  }
  function badRequest(message) { return refusal('bad_request', message, 'Send a request that follows the pair-screen input schema.'); }

  // the closed request check: a problem text, or null when the request is good
  function checkRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) return 'The request must be an object.';
    for (const k of Object.keys(request)) if (!TOP_KEYS.includes(k)) return 'The request holds an unknown key.';
    for (const k of ['objective', 'scope_id', 'snapshot_id']) if (typeof request[k] !== 'string' || request[k].length < 1) return 'The request needs ' + k + '.';
    if (!Array.isArray(request.artifacts) || request.artifacts.length < 2 || request.artifacts.length > 3000) return 'The request needs 2 to 3000 artifacts.';
    for (const a of request.artifacts) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return 'An artifact must be an object.';
      for (const k of Object.keys(a)) if (!ART_KEYS.includes(k)) return 'An artifact holds an unknown key.';
      for (const k of ['id', 'source_ref', 'text']) if (typeof a[k] !== 'string' || a[k].length < 1) return 'An artifact needs ' + k + '.';
    }
    if ('top_k' in request && !(Number.isInteger(request.top_k) && request.top_k >= 1 && request.top_k <= 200)) return 'top_k must be an integer from 1 to 200.';
    if ('approval' in request) {
      const ap = request.approval;
      if (!ap || typeof ap !== 'object' || Array.isArray(ap)) return 'The approval must be an object.';
      for (const k of Object.keys(ap)) if (k !== 'plan_digest' && k !== 'approval_ref') return 'The approval holds an unknown key.';
      if (typeof ap.plan_digest !== 'string' || !/^[a-f0-9]{64}$/.test(ap.plan_digest)) return 'The approval needs a plan digest of 64 hex characters.';
      if (typeof ap.approval_ref !== 'string' || ap.approval_ref.length < 1 || ap.approval_ref.length > 128) return 'The approval reference needs 1 to 128 characters.';
    }
    return null;
  }

  function observePair(tool, args) {
    let raw = '';
    try { raw = JSON.stringify(args === undefined ? null : args); } catch (_e) { raw = ''; }
    const request = args && typeof args === 'object' ? args.request : null;
    const isObj = request && typeof request === 'object' && !Array.isArray(request);
    record({
      kind: 'call', tool, request: redact(args === undefined ? null : args), shape: shapeOf(request), watch_hits: watchHits(raw),
      canon_sha256: isObj ? requestDigest(request) : null,
      request_keys: isObj ? Object.keys(request).sort() : null,
    });
  }

  server.registerTool('scout_plan_pair_screen', { description: 'fake pair screen plan', inputSchema: permissive }, async (args) => {
    observePair('scout_plan_pair_screen', args);
    const request = args && args.request;
    const problem = checkRequest(request);
    if (problem) return answer(badRequest(problem));
    const mode = readJson('plan-mode.json');
    if (mode && mode.mode === 'refused') {
      return answer(refusal(String(mode.reason || 'bad_request'), 'The fake was told to refuse this plan.', 'Remove plan-mode.json.'));
    }
    if (mode && mode.mode === 'blocked') {
      return answer({
        schema_version: 'eureka.pair-screen-plan.v1', status: 'blocked', label: LABEL, capability_id: CAPABILITY,
        reason: String(mode.reason || 'local_model_unavailable'),
        message: 'The fake was told to block this plan.', fix: 'Remove plan-mode.json.',
        scope_id: request.scope_id, snapshot_id: request.snapshot_id,
        host_handoff: { state: 'blocked', owner: 'mindrianos', next_action: 'fix_and_plan_again' },
      });
    }
    const digest = requestDigest(request);
    const store = loadState('receipts.json', { receipts: [] });
    const expires = Date.now() + 24 * 3600 * 1000;
    // a second plan of the same request keeps one live receipt (the fake is stricter than the engine: one plan, one start)
    const live = store.receipts.find((r) => r.digest === digest && !r.used);
    if (live) live.expires_at = expires;
    else store.receipts.push({ digest, used: false, job_id: null, approval_ref: null, idempotency_key: null, scope_id: request.scope_id, snapshot_id: request.snapshot_id, expires_at: expires });
    saveState('receipts.json', store);
    const textBytes = request.artifacts.reduce((n, a) => n + Buffer.byteLength(a.text, 'utf8'), 0);
    return answer({
      schema_version: 'eureka.pair-screen-plan.v1', status: 'ready', label: LABEL, capability_id: CAPABILITY,
      plan_digest: digest, expires_at: new Date(expires).toISOString(),
      scope_id: request.scope_id, snapshot_id: request.snapshot_id, objective: request.objective,
      top_k: request.top_k === undefined ? 200 : request.top_k,
      counts: { artifacts: request.artifacts.length, text_bytes: textBytes, records_usable: request.artifacts.length, records_dropped: 0 },
      engines: [
        { name: 'Find Unusual Pairs Across a Research Collection', capability_id: 'opportunity.find_unusual_pairs' },
        { name: 'Rank Unusual Pairs by Wording and Meaning', capability_id: 'opportunity.rank_unusual_pairs_wording_meaning' },
      ],
      model: { found: true, origin: 'local model source' },
      outputs_expected: ['unusual-pairs.json', 'wording-and-meaning-pairs.json', 'ranked-pairs.md', 'manifest.json'],
      network: 'denied; the run is offline and makes no network call',
      writes: { room: 'none', portfolio: 'none', job_store: 'a result record kept for 30 days; delete it with scout_delete_job', derived_vectors: 'not kept', plan_receipt: 'digest and times only, kept 24 hours' },
      approval_required: true,
      how_to_approve: 'Show this plan to the person, get the approval, then call the start tool with the same request plus the approval block.',
      stages: ['validate bundle', 'build clean corpus', 'rank with the unusual-pairs engine', 'rank with the wording-and-meaning engine', 'write hashed files and manifest', 'return the result'],
      warnings: [],
      host_handoff: { state: 'awaiting_approval', owner: 'mindrianos', next_action: 'present_plan_and_obtain_approval', approval_required: true },
    });
  });

  function startedAnswer(jobId, approvalRef) {
    return {
      job_id: jobId, status: 'queued', capability_id: CAPABILITY, label: LABEL, room_write: 'not_performed',
      approval: { approval_ref: approvalRef, verified_by_engine: false },
      next: 'Poll scout_status with the job id until the status is final, then call scout_result.',
    };
  }

  server.registerTool('scout_start_pair_screen', { description: 'fake pair screen start', inputSchema: permissive }, async (args) => {
    observePair('scout_start_pair_screen', args);
    const request = args && args.request;
    const key = args && args.idempotency_key;
    if (key !== undefined && key !== null && (typeof key !== 'string' || key.length < 1 || key.length > 128)) {
      return answer(badRequest('The idempotency key must hold 1 to 128 characters.'));
    }
    const problem = checkRequest(request);
    if (problem) return answer(badRequest(problem));
    if (!request.approval) return answer(refusal('approval_missing', 'The start request has no approval block.', 'Send the approval block with the digest of the plan and the reference of the approval.'));
    const store = loadState('receipts.json', { receipts: [] });
    const claimed = store.receipts.filter((r) => r.digest === request.approval.plan_digest);
    if (!claimed.length) return answer(refusal('plan_unknown', 'No plan receipt matches this digest.', 'Call the plan tool for this request.'));
    const digest = requestDigest(request);
    if (request.approval.plan_digest !== digest) return answer(refusal('plan_mismatch', 'The request differs from the planned request.', 'Send the same request that was planned, or plan again.'));
    const jobs = loadState('jobs.json', { next: 1, jobs: {} });
    const fresh = claimed.find((r) => !r.used && r.expires_at > Date.now());
    if (!fresh) {
      const retry = claimed.find((r) => r.used && key && r.idempotency_key === key && r.approval_ref === request.approval.approval_ref && r.job_id && jobs.jobs[r.job_id]);
      if (retry) return answer(startedAnswer(retry.job_id, retry.approval_ref));
      return answer(refusal('plan_consumed', 'This plan was used already.', 'Plan again, then ask for a new approval.'));
    }
    const jobId = 'fake-ps-' + jobs.next;
    jobs.next += 1;
    const arts = request.artifacts.slice(0, 3).map((a) => ({ id: a.id, source_ref: a.source_ref, title: typeof a.title === 'string' ? a.title : '' }));
    jobs.jobs[jobId] = {
      job_id: jobId, state: 'queued', step: 0, scope_id: request.scope_id, snapshot_id: request.snapshot_id,
      plan_digest: digest, approval_ref: request.approval.approval_ref, artifact_count: request.artifacts.length, artifacts: arts,
    };
    fresh.used = true;
    fresh.job_id = jobId;
    fresh.approval_ref = request.approval.approval_ref;
    fresh.idempotency_key = key || null;
    saveState('jobs.json', jobs);
    saveState('receipts.json', store);
    return answer(startedAnswer(jobId, request.approval.approval_ref));
  });

  function buildResult(job) {
    const n = job.artifacts.length;
    const side = (i) => {
      const a = job.artifacts[i % n];
      return { artifact_id: a.id, record_id: 'rec-' + a.id, source_ref: a.source_ref, title: a.title };
    };
    const outputs = [
      { id: 'pair-1', kind: 'pair', engines: ['unusual_pairs'], payload: { left: side(0), right: side(1), ranks: { unusual_pairs: 1, wording_and_meaning: null } } },
      { id: 'pair-2', kind: 'pair', engines: ['wording_and_meaning'], payload: { left: side(1), right: side(2), ranks: { unusual_pairs: null, wording_and_meaning: 1 } } },
      { id: 'pair-3', kind: 'pair', engines: ['unusual_pairs', 'wording_and_meaning'], payload: { left: side(0), right: side(2), ranks: { unusual_pairs: 2, wording_and_meaning: 2 } } },
    ];
    const unusual = outputs.filter((o) => o.engines.includes('unusual_pairs')).map((o) => o.payload);
    const wording = outputs.filter((o) => o.engines.includes('wording_and_meaning')).map((o) => o.payload);
    const unusualJson = JSON.stringify({ engine: 'unusual_pairs', pairs: unusual }, null, 2) + '\n';
    const wordingJson = JSON.stringify({ engine: 'wording_and_meaning', pairs: wording }, null, 2) + '\n';
    const rankedMd = '# Ranked pairs\n\n' + LABEL + '\n\n' + outputs.map((o) => '- ' + o.id + ': ' + o.payload.left.artifact_id + ' and ' + o.payload.right.artifact_id).join('\n') + '\n';
    const inlineFiles = [
      { path: 'unusual-pairs.json', content: unusualJson },
      { path: 'wording-and-meaning-pairs.json', content: wordingJson },
      { path: 'ranked-pairs.md', content: rankedMd },
    ];
    const manifest = JSON.stringify({ schema_version: 'eureka.pair-screen.manifest.v1', job_id: job.job_id, files: inlineFiles.map((f) => ({ path: f.path, sha256: sha256(f.content) })) }, null, 2) + '\n';
    inlineFiles.push({ path: 'manifest.json', content: manifest });
    const files = inlineFiles.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content, 'utf8'), sha256: sha256(f.content), inline: true, content: f.content }));
    const records = 'synthetic corpus records\n';
    files.push({ path: 'corpus/records.jsonl', bytes: Buffer.byteLength(records, 'utf8'), sha256: sha256(records), inline: false });
    const idMap = [];
    for (let i = 0; i < n; i += 1) idMap.push({ record_id: 'rec-' + job.artifacts[i].id, artifact_id: job.artifacts[i].id, source_ref: job.artifacts[i].source_ref });
    return {
      schema_version: 'eureka.pair-screen.v1', capability_id: CAPABILITY, status: 'completed', job_id: job.job_id, label: LABEL,
      summary_line: 'All results are candidates, not verified. They are leads for human review.',
      scope: { scope_id: job.scope_id, snapshot_id: job.snapshot_id },
      approval: { plan_digest: job.plan_digest, approval_ref: job.approval_ref, verified_by_engine: false },
      counts: { records_read: job.artifact_count, records_used: job.artifact_count, dropped: 0, unusual_pairs: unusual.length, wording_and_meaning_pairs: wording.length },
      caps_hit: [], warnings: [], manifest_sha256: sha256(manifest), files, id_map: idMap, outputs,
      host_handoff: { state: 'results_ready', owner: 'mindrianos' },
      room_write: 'not_performed', portfolio_write: 'not_performed',
      persistence: { job_store: 'kept 30 days; delete it with scout_delete_job', derived_vectors: 'not kept', run_files: 'synthetic; none on disk' },
    };
  }

  // The fake imitates the first open of the job store by a new process: with restart.json present, a job that is
  // not final becomes failed with progress interrupted and failure_code server_restarted, and the change is kept.
  function applyRestart(job, jobs) {
    if (readJson('restart.json') === null || FINAL.includes(job.state)) return false;
    job.state = 'failed';
    job.progress = 'interrupted';
    job.failure_code = 'server_restarted';
    saveState('jobs.json', jobs);
    return true;
  }
  function jobView(job) {
    const view = { job_id: job.job_id, status: job.state };
    if (job.progress) view.progress = job.progress;
    if (job.failure_code) view.failure_code = job.failure_code;
    return view;
  }
  function notFound() { return { content: [{ type: 'text', text: 'job not found' }], isError: true }; }
  const isPairJob = (id) => typeof id === 'string' && id.startsWith('fake-ps-');

  server.registerTool('scout_delete_job', { description: 'fake delete job', inputSchema: permissive }, async (args) => {
    observePair('scout_delete_job', args);
    const id = args && args.job_id;
    const jobs = loadState('jobs.json', { next: 1, jobs: {} });
    const had = !!(isPairJob(id) && jobs.jobs[id]);
    if (had) { delete jobs.jobs[id]; saveState('jobs.json', jobs); }
    return answer({ job_id: id, deleted: had });
  });

  serveStdio(() => server);
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

if (argv[0] === 'sync') doSync();
else if (argv[0] === '--version') { process.stdout.write('uv 0.0.0-fake\n'); process.exit(0); }
else if (argv[0] === 'python' && argv[1] === 'find') { process.stdout.write('/synthetic/python3\n'); process.exit(0); }
else if (argv.length >= 3 && argv.slice(-3).join(' ') === 'eureka doctor --json') doDoctor();
else if (argv[0] === 'run') serve();
else { process.stderr.write('fake-uv: unknown arguments\n'); process.exit(2); }
