'use strict';

// Pair-screen result verifier (Phase 374 plan 06, E5).
//
// This module checks the result of the Eureka pair screen (schema eureka.pair-screen.v1, see the engine run
// contract, "Result, key by key" and "Rules for the consumer") before any other code reads it.
//
// Canon Part 8 rules for this module:
// - It sees result text (titles, source references, the summary line, file content). That text is untrusted.
//   The module never forwards it in a refusal. Every refusal is a fixed sentence written in this file.
// - It requires only node:crypto. It reaches no Brain, no Theo and no network. It spawns no process and
//   reads no file. It is a pure function of its two arguments.
// - Phase 374 plan 08 adds the request builder, the plan call, the fixed refusal table, the plan summary and the
//   card text. The plan call reaches the engine only through the helpers of eureka-capability-run.cjs (required
//   inside the function), so this module still holds no Brain, Theo or network require and spawns no process
//   itself. The approval gate and the start call live in eureka-capability-jobs.cjs.
// - Only selected node projections cross to the engine (4,096 characters per node, set by the projection).
//   Result text and plan text never go to Theo or Brain.

const crypto = require('node:crypto');

const PAIR_SCREEN_CAPABILITY_ID = 'opportunity.run_pair_screen';
const RESULT_SCHEMA_VERSION = 'eureka.pair-screen.v1';
const LABEL = 'candidate, not verified';
const HEX64 = /^[a-fA-F0-9]{64}$/;
const SUMMARY_LINE_MAX_CHARS = 500;

// The fixed sentences. No value of a result enters any of them.
const MESSAGES = Object.freeze({
  invalid: 'Eureka returned a pair-screen result that does not follow the published result format.',
  missing: 'Eureka returned a pair-screen result with no scope or snapshot lineage.',
  mismatch: 'Eureka returned a pair-screen result for a different capability, scope or snapshot.',
  hash: 'Eureka returned a pair-screen result file that does not match its hash or size.',
});

const EMPTY_LIST_SENTENCE = 'An empty shortlist does not show that no opportunity exists.';

function refuse(reason) {
  const key = { engine_result_invalid: 'invalid', engine_lineage_missing: 'missing',
    engine_lineage_mismatch: 'mismatch', engine_result_hash_mismatch: 'hash' }[reason];
  return { ok: false, reason, message: MESSAGES[key] };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

// Check one file entry. Returns null when it is good, or a reason string.
function fileProblem(file) {
  if (!isObject(file) || typeof file.path !== 'string' || !isCount(file.bytes) ||
      typeof file.sha256 !== 'string' || !HEX64.test(file.sha256) || typeof file.inline !== 'boolean') {
    return 'engine_result_invalid';
  }
  if (!file.inline) return file.content === undefined ? null : 'engine_result_invalid';
  if (typeof file.content !== 'string') return 'engine_result_invalid';
  if (sha256Hex(file.content) !== file.sha256.toLowerCase()) return 'engine_result_hash_mismatch';
  if (Buffer.byteLength(file.content, 'utf8') !== file.bytes) return 'engine_result_hash_mismatch';
  return null;
}

// verifyPairScreenResult(result, expect) with expect = { capability_id, scope_id, snapshot_id }.
// Returns { ok: false, reason, message } or { ok: true, status, shortlist_empty, summary }.
// The summary holds counts and hashes. It does not hold file content or pair text. The summary line is
// returned as untrusted text, marked.
function verifyPairScreenResult(result, expect) {
  const want = isObject(expect) ? expect : {};
  if (!isObject(result)) return refuse('engine_result_invalid');

  // 1. schema version, first
  if (result.schema_version !== RESULT_SCHEMA_VERSION) return refuse('engine_result_invalid');

  // 2. capability
  if (result.capability_id !== PAIR_SCREEN_CAPABILITY_ID || result.capability_id !== want.capability_id) {
    return refuse('engine_lineage_mismatch');
  }

  // 3. scope present, then equal to the request lineage
  const scope = result.scope;
  if (!isObject(scope) || typeof scope.scope_id !== 'string' || typeof scope.snapshot_id !== 'string' ||
      !scope.scope_id || !scope.snapshot_id) {
    return refuse('engine_lineage_missing');
  }
  if (typeof want.scope_id !== 'string' || typeof want.snapshot_id !== 'string' ||
      scope.scope_id !== want.scope_id || scope.snapshot_id !== want.snapshot_id) {
    return refuse('engine_lineage_mismatch');
  }
  // The top-level echoes are optional here; when present they must agree too.
  if ((result.scope_id !== undefined && result.scope_id !== want.scope_id) ||
      (result.snapshot_id !== undefined && result.snapshot_id !== want.snapshot_id)) {
    return refuse('engine_lineage_mismatch');
  }

  // 4. status
  const status = result.status;
  if (status !== 'completed' && status !== 'completed_empty') return refuse('engine_result_invalid');

  // 5. label and the fixed values
  if (result.label !== LABEL) return refuse('engine_result_invalid');
  if (result.room_write !== 'not_performed' || result.portfolio_write !== 'not_performed') return refuse('engine_result_invalid');
  if (!isObject(result.approval) || result.approval.verified_by_engine !== false) return refuse('engine_result_invalid');

  // 6. shapes of the parts that the summary carries
  if (!isObject(result.counts)) return refuse('engine_result_invalid');
  if (!Array.isArray(result.caps_hit) || !Array.isArray(result.warnings)) return refuse('engine_result_invalid');
  if (!result.warnings.every((item) => typeof item === 'string')) return refuse('engine_result_invalid');
  if (typeof result.manifest_sha256 !== 'string' || !HEX64.test(result.manifest_sha256)) return refuse('engine_result_invalid');
  if (!Array.isArray(result.outputs)) return refuse('engine_result_invalid');
  if (status === 'completed_empty' && result.outputs.length > 0) return refuse('engine_result_invalid');
  if (!Array.isArray(result.files)) return refuse('engine_result_invalid');

  // 7. every file: structure and hash first, in order
  for (const file of result.files) {
    const problem = fileProblem(file);
    if (problem) return refuse(problem);
  }
  // The manifest hash names the run. When the manifest file is listed, its hash must be that value.
  for (const file of result.files) {
    if (file.path === 'manifest.json' && file.sha256.toLowerCase() !== result.manifest_sha256.toLowerCase()) {
      return refuse('engine_result_hash_mismatch');
    }
  }

  const handoff = isObject(result.host_handoff) ? result.host_handoff : {};
  const shortlistEmpty = status === 'completed_empty';
  const summary = {
    counts: structuredClone(result.counts),
    label: LABEL,
    summary_line: {
      untrusted: true,
      text: typeof result.summary_line === 'string' ? result.summary_line.slice(0, SUMMARY_LINE_MAX_CHARS) : '',
    },
    manifest_sha256: result.manifest_sha256,
    caps_hit: structuredClone(result.caps_hit),
    warnings: result.warnings.slice(),
    files: result.files.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256, inline: file.inline })),
    host_handoff: {
      ...(typeof handoff.state === 'string' ? { state: handoff.state } : {}),
      ...(typeof handoff.owner === 'string' ? { owner: handoff.owner } : {}),
    },
  };
  if (shortlistEmpty) summary.empty_list_note = EMPTY_LIST_SENTENCE;
  return { ok: true, status, shortlist_empty: shortlistEmpty, summary };
}

// ---------------------------------------------------------------------------
// Phase 374 plan 08: input check, request builder, plan call, refusal table, plan summary, card text
// ---------------------------------------------------------------------------

// Phase 374 plan 12 (owner card OD-3 = TOPK-200): the engine takes 200 pairs for each engine (limits.py MAX_TOP_K).
// The scout schema reads this constant too. The node caps stay 2,500 (D-06).
const TOP_K_MAX = 200;
const NODE_IDS_MAX = 2500;
const MAX_NODE_TEXT_CHARS = 4096;
const START_ROUTE = 'scout_start_pair_screen';
const NODE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/;
const GATE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:#/-]{0,127}$/;
const ENGINE_FIELD_MAX_CHARS = 200;
const ARTIFACT_KEYS = ['id', 'source_ref', 'title', 'text', 'corpus', 'media_type', 'sha256'];
const REQUEST_KEYS = ['node_ids', 'objective', 'top_k'];

// The plugin's own sentence for each of the 15 engine reason codes (engine run contract, "Refusals and errors").
// Plain words, a next step, no engine text, no path. The engine message is never forwarded.
const REFUSALS = Object.freeze({
  bad_request: 'The engine did not accept this request. Check the objective and the selected notes, then plan again.',
  too_many_artifacts: 'More than 3,000 notes were sent. Select 3,000 notes or fewer, then plan again.',
  bundle_too_large: 'The selected notes hold too much text. Select fewer or shorter notes, then plan again.',
  duplicate_artifact_id: 'Two selected notes share one id. Select each note once, then plan again.',
  id_collision: 'Two note ids look the same after cleaning. Rename one note, then plan again.',
  artifact_hash_mismatch: 'A note changed after it was selected. Select the notes again, then plan again.',
  external_corpus_refused: 'The engine accepts room notes only. Select notes from this room, then plan again.',
  approval_missing: 'The start had no approval. Plan again, then ask for approval.',
  approval_bad_reference: 'The approval did not follow the expected form. Plan again, then ask for approval.',
  plan_unknown: 'The engine has no record of this plan. Plan again, then ask for approval.',
  plan_expired: 'The plan is older than 24 hours. Plan again, then ask for approval.',
  plan_consumed: 'This plan was used already. Plan again, then ask for a new approval.',
  plan_mismatch: 'The request differs from the approved plan. Plan again, then ask for approval.',
  local_model_unavailable: 'The engine found no local meaning model. Install a local model, then plan again. The engine does not download one.',
  too_few_usable_records: 'Too few notes have usable text. Select more notes with longer text, then plan again.',
});
const GENERIC_REFUSAL = 'The engine refused this run. Plan again later or select different notes.';

// OD-2 answer ADD-FORGET-TOOL (owner card, 2026-11-08): the delete path is a forget tool that plan 374-13 adds.
const DELETE_WORDING = 'To forget this run later, ask Larry to forget it.';

const PLAN_MESSAGES = Object.freeze({
  invalid: 'Eureka returned a pair-screen plan that does not follow the published plan format.',
  mismatch: 'Eureka returned a pair-screen plan for a different capability, scope or snapshot.',
  no_route: 'The Eureka catalog has no plan route for the pair screen.',
  rejected: 'Eureka rejected the pair-screen plan request.',
});

function cutText(value, max) {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max || ENGINE_FIELD_MAX_CHARS);
}

// The refusal object for a reason code. A known code gives its own sentence. Any other code gives the generic one.
function refusalFor(code) {
  const known = typeof code === 'string' && Object.prototype.hasOwnProperty.call(REFUSALS, code);
  return { ok: false, reason: known ? code : 'pair_screen_refused', message: known ? REFUSALS[code] : GENERIC_REFUSAL, label: LABEL };
}

// The input of eureka_capability_start for this capability. Returns a refusal or null. It runs before any child
// starts and before the room is read. The caller may not send artifacts (the bundle comes only from the room
// projection) or an approval block (only the gate adds it).
function checkStartInput(request, env) {
  if (!isObject(request)) return { ok: false, reason: 'invalid_request', message: 'A JSON object request with node_ids and objective is required.' };
  if (Object.prototype.hasOwnProperty.call(request, 'artifacts')) {
    return { ok: false, reason: 'pair_screen_requires_node_ids', message: 'The pair screen reads the selected room notes itself. Send node_ids, not artifacts.' };
  }
  if (Object.prototype.hasOwnProperty.call(request, 'approval')) {
    return { ok: false, reason: 'pair_screen_approval_not_accepted', message: 'Only the approval card adds an approval. Send the request without an approval block.' };
  }
  if (env && env.MINDRIAN_EUREKA_ALLOW_NETWORK === '1') {
    return { ok: false, reason: 'network_opt_in_active', message: 'The pair screen needs no network. Unset MINDRIAN_EUREKA_ALLOW_NETWORK and start again.' };
  }
  for (const key of Object.keys(request)) {
    if (!REQUEST_KEYS.includes(key)) return { ok: false, reason: 'invalid_request', message: 'The request holds a key the pair screen does not accept. Allowed keys: node_ids, objective, top_k.' };
  }
  const ids = request.node_ids;
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > NODE_IDS_MAX ||
      ids.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 200 || !NODE_ID_RE.test(id)) || new Set(ids).size !== ids.length) {
    return { ok: false, reason: 'invalid_request', message: 'node_ids must hold 2 to ' + NODE_IDS_MAX + ' different node ids.' };
  }
  if (typeof request.objective !== 'string' || !request.objective.trim() || request.objective.length > 5000) {
    return { ok: false, reason: 'invalid_request', message: 'objective must be a non-empty text of at most 5000 characters.' };
  }
  if (request.top_k !== undefined && !(Number.isInteger(request.top_k) && request.top_k >= 1 && request.top_k <= TOP_K_MAX)) {
    return { ok: false, reason: 'invalid_request', message: 'top_k must be a whole number from 1 to ' + TOP_K_MAX + '.' };
  }
  return null;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// The engine request: { objective, scope_id, snapshot_id, artifacts, top_k when given }. It is built once from the
// prepared bundle (prepare() over the room projection), copied, and deep-frozen. Only the closed artifact keys are
// copied. The caller's objects are never touched. Returns { ok: true, request } or a refusal.
function buildPairScreenRequest(args, prepared) {
  const a = isObject(args) ? args : {};
  const p = isObject(prepared) ? prepared : {};
  const bundle = isObject(p.bundle) ? p.bundle : {};
  if (typeof p.scope_id !== 'string' || !p.scope_id || typeof p.snapshot_id !== 'string' || !p.snapshot_id || !Array.isArray(bundle.artifacts)) {
    return { ok: false, reason: 'engine_invalid_response', message: 'The room projection did not give a usable artifact bundle.' };
  }
  const artifacts = [];
  for (const item of bundle.artifacts) {
    if (!isObject(item)) return { ok: false, reason: 'engine_invalid_response', message: 'The room projection did not give a usable artifact bundle.' };
    const copy = {};
    for (const key of ARTIFACT_KEYS) {
      if (typeof item[key] === 'string') copy[key] = item[key];
    }
    if (typeof copy.text === 'string' && copy.text.length > MAX_NODE_TEXT_CHARS) {
      return { ok: false, reason: 'invalid_request', message: 'A selected note is longer than ' + MAX_NODE_TEXT_CHARS + ' characters. Select shorter notes.' };
    }
    artifacts.push(copy);
  }
  const request = { objective: a.objective, scope_id: p.scope_id, snapshot_id: p.snapshot_id, artifacts };
  if (a.top_k !== undefined) request.top_k = a.top_k;
  return { ok: true, request: deepFreeze(structuredClone(request)) };
}

function planInvalid(key, reason) {
  return { ok: false, reason: reason || 'engine_invalid_response', message: PLAN_MESSAGES[key] };
}

function nonNegativeInt(value) { return Number.isInteger(value) && value >= 0; }

// Check the plan answer against the request that was planned. Returns { ok: true, plan } or a fixed refusal.
function checkPlan(plan, request) {
  if (!isObject(plan)) return planInvalid('invalid');
  if (plan.status === 'blocked' || plan.status === 'refused') return refusalFor(plan.reason);
  if (plan.status !== 'ready') return planInvalid('invalid');
  if (plan.capability_id !== PAIR_SCREEN_CAPABILITY_ID || plan.scope_id !== request.scope_id || plan.snapshot_id !== request.snapshot_id) {
    return planInvalid('mismatch', 'engine_lineage_mismatch');
  }
  if (typeof plan.plan_digest !== 'string' || !HEX64.test(plan.plan_digest)) return planInvalid('invalid');
  const c = plan.counts;
  if (!isObject(c) || !['artifacts', 'text_bytes', 'records_usable', 'records_dropped'].every((k) => nonNegativeInt(c[k]))) return planInvalid('invalid');
  if (!Array.isArray(plan.engines) || !plan.engines.every((e) => isObject(e) && typeof e.name === 'string')) return planInvalid('invalid');
  return { ok: true, plan };
}

// planPairScreen({ request, root, env, signal, deps }): one short-lived child, one catalog read (served from the
// per-process cache when it is warm), one plan call, close. The plan route is read from the catalog value
// routes.mcp.plan_tool and never named here.
async function planPairScreen(params) {
  const p = params || {};
  const d = p.deps || {};
  const run = require('./tools/eureka-capability-run.cjs');
  const contract = require('./eureka-tool-contract.cjs');
  const Transport = d.StdioClientTransport || require('@modelcontextprotocol/client/stdio').StdioClientTransport;
  const McpClient = d.Client || require('@modelcontextprotocol/client').Client;
  const env = p.env || process.env;
  let client;
  let capture = null;
  let connected = false;
  try {
    const transport = new Transport(run.clientOptions(p.root, env, PAIR_SCREEN_CAPABILITY_ID));
    client = new McpClient({ name: 'mindrian-os-eureka-pair-screen-plan', version: '1.0.0' }, { capabilities: {} });
    capture = contract.captureStartLine(transport);
    await client.connect(transport);
    connected = true;
    capture.stop();
    const catalog = await run.getCatalog(client, p.root, p.signal);
    if (!catalog.ok) return catalog;
    const resolved = run.resolveCapability(catalog.result, PAIR_SCREEN_CAPABILITY_ID);
    if (!resolved.ok) return resolved;
    const capability = resolved.capability;
    if (capability.routes.mcp.tool !== START_ROUTE || typeof capability.plan_tool !== 'string' || !capability.plan_tool) {
      return planInvalid('no_route', 'capability_not_async');
    }
    const reply = run.decodeResponse(await client.callTool({ name: capability.plan_tool, arguments: { request: p.request } }, { signal: p.signal }),
      PLAN_MESSAGES.rejected);
    if (!reply.ok) {
      // A typed need (an extra, a model) keeps its fixed sentence. Any other engine text is replaced.
      return reply.reason === 'engine_rejected_request' ? planInvalid('rejected', 'engine_rejected_request') : reply;
    }
    return checkPlan(reply.result, p.request);
  } catch (error) {
    if (p.signal && p.signal.aborted) return { ok: false, reason: 'cancelled', message: 'The pair-screen plan was cancelled.' };
    if (capture) { capture.stop(); if (!connected) await capture.settle(); }
    return contract.startFailureRefusal(error, connected || !capture ? '' : capture.line(), { root: p.root, home: env.HOME || env.USERPROFILE });
  } finally {
    try { if (client) await client.close(); } catch (_error) { /* best effort */ }
  }
}

// Only these fields of a ready plan reach the card and the answer. Strings are cut at 200 characters. The plan
// warnings are engine text; only their number is kept here.
function planSummary(plan) {
  const pl = isObject(plan) ? plan : {};
  const c = isObject(pl.counts) ? pl.counts : {};
  const count = (v) => (nonNegativeInt(v) ? v : 0);
  const writes = {};
  if (isObject(pl.writes)) {
    for (const key of ['room', 'portfolio', 'job_store', 'derived_vectors', 'plan_receipt']) {
      if (typeof pl.writes[key] === 'string') writes[key] = cutText(pl.writes[key]);
    }
  }
  return {
    counts: { artifacts: count(c.artifacts), text_bytes: count(c.text_bytes), records_usable: count(c.records_usable), records_dropped: count(c.records_dropped) },
    engines: (Array.isArray(pl.engines) ? pl.engines : []).slice(0, 4).map((e) => ({
      name: cutText(e && e.name), ...(typeof (e && e.capability_id) === 'string' ? { capability_id: cutText(e.capability_id) } : {}),
    })),
    model_found: isObject(pl.model) && pl.model.found === true,
    outputs_expected: (Array.isArray(pl.outputs_expected) ? pl.outputs_expected : []).filter((x) => typeof x === 'string').slice(0, 20).map((x) => cutText(x)),
    network: typeof pl.network === 'string' ? cutText(pl.network) : '',
    writes,
    expires_at: typeof pl.expires_at === 'string' ? cutText(pl.expires_at, 64) : '',
    top_k: Number.isInteger(pl.top_k) ? pl.top_k : null,
    warnings_count: Array.isArray(pl.warnings) ? pl.warnings.length : 0,
  };
}

// The plan warnings, as untrusted engine text (cut, never shown on the card).
function planWarnings(plan) {
  const list = isObject(plan) && Array.isArray(plan.warnings) ? plan.warnings : [];
  return { untrusted: true, items: list.filter((w) => typeof w === 'string').slice(0, 20).map((w) => cutText(w)) };
}

// The card text: fixed sentences, the counts and the engine names. It holds no note title and no note text.
function cardBody(summary, deleteWording) {
  const s = isObject(summary) ? summary : planSummary({});
  const c = s.counts;
  const names = s.engines.map((e) => e.name).filter(Boolean);
  const parts = [];
  parts.push('Larry will screen ' + c.artifacts + ' selected notes for unusual pairs. ' + c.records_usable + ' are usable and ' + c.records_dropped + ' are dropped. The text is ' + c.text_bytes + ' bytes.');
  if (names.length) parts.push('Two engines read the notes: ' + names.join(' and ') + '.');
  parts.push('The text of the selected notes goes to the local engine on this machine and nowhere else. The run makes no network call.');
  parts.push(s.model_found ? 'A local meaning model was found.' : 'The plan did not report a local meaning model.');
  parts.push('Nothing is written to the room or the portfolio.');
  parts.push('The result stays on this machine for 30 days. ' + (typeof deleteWording === 'string' ? deleteWording : DELETE_WORDING));
  parts.push('Every pair is a candidate, not verified.');
  if (s.expires_at) parts.push('This plan is valid until ' + s.expires_at + '.');
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Phase 374 plan 12 (owner card OD-7 = PAGE-ARG, ADAPT374-03, Pitfall 6): paged job results
// ---------------------------------------------------------------------------
//
// pageResult is a pure function. It takes a VERIFIED job answer (the hashes and the lineage were checked before
// this call, see shapeResult in eureka-capability-jobs.cjs) and returns one page of the pairs with the summary.
// File text never enters a paged answer: the summary lists path, bytes, sha256, inline and a verified flag.
// The page size is a function of the answer only, so every call for the same answer gives the same pages.

const PAGE_START_SIZE = 25;
const PAGE_LIMIT_BYTES = 200 * 1024;
const PAGE_OUT_OF_RANGE = 'That page does not exist. Ask for a page from 1 to the last page named in paging.total_pages.';
const PAGING_NOTE = 'This is one page of the pairs. Ask for the next page with the page argument. File text stays inside the plugin; the file hashes were checked here. Every pair is a candidate, not verified.';

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

// The record ids a pair names, so the matching id_map rows travel with the pair.
function recordIdsOf(item) {
  const ids = new Set();
  const payload = isObject(item) ? item.payload : null;
  if (isObject(payload)) {
    for (const side of ['left', 'right']) {
      if (isObject(payload[side]) && typeof payload[side].record_id === 'string') ids.add(payload[side].record_id);
    }
  }
  return ids;
}

function itemsOf(answer) {
  const engine = isObject(answer) && isObject(answer.engine_result) ? answer.engine_result : null;
  return engine && Array.isArray(engine.outputs) ? engine.outputs : null;
}

// The answer a person gets from page N. Everything of the answer stays except the engine result; the engine
// result keeps only the page of outputs (and the matching id_map rows for a pair-screen result).
function buildPage(answer, items, idMap, isPairScreen, pageSize, page, totalItems, totalPages) {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  const { engine_result: engine, ...rest } = answer;
  const paged = { ...rest };
  if (isPairScreen) {
    const wanted = new Set();
    for (const item of slice) for (const id of recordIdsOf(item)) wanted.add(id);
    paged.engine_result = { outputs: slice, ...(Array.isArray(idMap) ? { id_map: idMap.filter((row) => isObject(row) && wanted.has(row.record_id)) } : {}) };
    if (isObject(rest.pair_screen) && Array.isArray(rest.pair_screen.files)) {
      paged.pair_screen = { ...rest.pair_screen,
        files: rest.pair_screen.files.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256, inline: file.inline, verified: true })) };
    }
  } else if (Array.isArray(engine && engine.outputs)) {
    paged.engine_result = { ...engine, outputs: slice };
  } else {
    paged.engine_result = engine;
  }
  paged.paging = { page, page_size: pageSize, total_items: totalItems, total_pages: totalPages,
    next_page: page < totalPages ? page + 1 : null };
  paged.paging_note = PAGING_NOTE;
  return paged;
}

// pageResult(verified, page, opts) -> the paged answer, or { ok: false, reason: 'page_out_of_range', ... }.
// opts: { limitBytes, startSize }. A pair-screen answer drops the file text; any other answer keeps every field
// and pages its outputs array (an answer with no outputs array is one page).
function pageResult(verified, page, opts) {
  const o = isObject(opts) ? opts : {};
  const limit = Number.isInteger(o.limitBytes) && o.limitBytes > 0 ? o.limitBytes : PAGE_LIMIT_BYTES;
  const answer = isObject(verified) ? verified : {};
  const isPairScreen = answer.capability_id === PAIR_SCREEN_CAPABILITY_ID;
  const items = itemsOf(answer) || [];
  const engine = isObject(answer.engine_result) ? answer.engine_result : {};
  const idMap = Array.isArray(engine.id_map) ? engine.id_map : null;
  const totalItems = items.length;
  const outOfRange = (totalPages) => ({ ok: false, reason: 'page_out_of_range', capability_id: answer.capability_id,
    job_id: answer.job_id, total_pages: totalPages, message: PAGE_OUT_OF_RANGE });
  if (!Number.isInteger(page) || page < 1) return outOfRange(undefined);

  // The page size: start at 25 and halve while any page is over the limit (minimum 1).
  let size = Number.isInteger(o.startSize) && o.startSize > 0 ? o.startSize : PAGE_START_SIZE;
  for (;;) {
    const pages = Math.max(1, Math.ceil(totalItems / size));
    let widest = 0;
    for (let n = 1; n <= pages && widest <= limit; n += 1) {
      widest = Math.max(widest, jsonBytes(buildPage(answer, items, idMap, isPairScreen, size, n, totalItems, pages)));
    }
    if (widest <= limit || size === 1) break;
    size = Math.max(1, Math.floor(size / 2));
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  if (page > totalPages) return outOfRange(totalPages);
  return buildPage(answer, items, idMap, isPairScreen, size, page, totalItems, totalPages);
}

// The form kept in the process cache: the same answer without the file text. A pair-screen answer keeps only the
// outputs and the id_map rows of its engine result. Any other answer is kept whole (its outputs are paged).
function slimForCache(answer) {
  if (!isObject(answer) || answer.capability_id !== PAIR_SCREEN_CAPABILITY_ID) return answer;
  const engine = isObject(answer.engine_result) ? answer.engine_result : {};
  return { ...answer, engine_result: {
    outputs: Array.isArray(engine.outputs) ? engine.outputs : [],
    ...(Array.isArray(engine.id_map) ? { id_map: engine.id_map } : {}),
  } };
}

module.exports = {
  PAIR_SCREEN_CAPABILITY_ID, RESULT_SCHEMA_VERSION, LABEL, verifyPairScreenResult,
  TOP_K_MAX, GATE_ID_RE, REFUSALS, GENERIC_REFUSAL, DELETE_WORDING,
  checkStartInput, buildPairScreenRequest, refusalFor, planPairScreen, planSummary, planWarnings, cardBody,
  pageResult, slimForCache, PAGE_LIMIT_BYTES,
};
