'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.25 plan 05 -- the Theo half of the Theo face: what FeyMinto asks Theo for one nest.
 * layer: graph
 *
 * WHAT THIS MODULE IS. A pure, injectable module. nestHandles() builds the Canon Part 8 handles for a nest
 * (the problem type in Theo's four-id enum, the section kind, the job id, up to three canonical framework
 * names); askTheoForNest() sends those handles over the four theo-mcp reads and returns either an asked result
 * with a provenance record or a not-asked result with exactly one reason from a closed set. It never throws
 * and it never produces the string "(no signal)": a query that was not asked says why.
 *
 * CANON PART 8. Only handles cross the wire: a four-id problem type, a canonical framework name (exact
 * lowercase membership in data/framework-names.json, the same vocabulary lib/core/part8-egress-guard.cjs
 * _isKnownFrameworkHandle proves against), at most three of them (Canon Part 3 Shape F MAX_K). Never prose,
 * titles, venture names or room content. section_kind and job_id are handles too, but no current Theo read
 * takes them (369.25-THEO-PREP asks Theo for that dimension); they are built and recorded so the face and the
 * fingerprint carry them, and `handles_on_wire` names exactly which handle keys appeared in a query, so the
 * provenance never claims Theo was told something it was not.
 *
 * THE FOUR READS (CONTEXT ruling 2026-10-06): find_frameworks_for_problem_type, commands_for_problem_type,
 * recommend_chain and framework_neighborhood, all registered on theo-mcp (Theo HEAD 2d39df5). recommend_chain
 * STANDS IN for framework_route: framework_route exists only in theo-context (README.md:147), not on theo-mcp,
 * so no new wire is added and theo-mcp stays the one origin. The substitution is recorded in the CHANGELOG by
 * plan 24.
 *
 * THEO READ CONTRACT (spike skill, measured): commands_for_problem_type fetches limit + 1 rows and Theo's
 * DEFAULT_ROW_CAP is 100, so asking limit 100 asks for 101 and returns zero rows plus a notice. This module
 * omits `limit` and takes Theo's documented default of 50.
 *
 * THE WIRE. callTool in lib/core/brain-client.cjs is the one Theo wire and runs the Part 8 belt first; it
 * returns the result, null for a transport failure, or the egress_blocked sentinel object. This module does not
 * touch THEO_ORIGINS or the wire.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const THEO_READS = Object.freeze([
  'find_frameworks_for_problem_type',
  'commands_for_problem_type',
  'recommend_chain',
  'framework_neighborhood',
]);

const NOT_ASKED = Object.freeze({
  at_birth: 'at_birth',
  offline: 'offline',
  theo_unavailable: 'theo_unavailable',
  egress_blocked: 'egress_blocked',
  no_handle_to_send: 'no_handle_to_send',
  room_not_ready: 'room_not_ready',
});

const NOT_ASKED_LINES = Object.freeze({
  at_birth: 'not asked: the room was just created',
  offline: 'not asked: this run was offline',
  theo_unavailable: 'not asked: Theo did not answer',
  egress_blocked: 'not asked: the question named something from this room',
  no_handle_to_send: 'not asked: no problem type or framework handle to send',
  room_not_ready: 'not asked: the room identity is not in room.db',
});

const MAX_FRAMEWORK_HANDLES = 3;
const MAX_CHAIN_STEPS = 6;
const FRAMEWORK_NAME_RE = /^[A-Za-z0-9 '(),.\/-]{1,128}$/;

// The nest's own lens, from lib/core/brain-derivation.cjs classifyProblemType (UDP, IDP, WDP), in Theo's four-id
// form. This is the same projection brain-client.cjs BRAIN_PROBLEM_TYPE_ALIASES_THEO applies (udp -> UnDefined,
// idp -> IllDefined, wdp -> WellDefined); it is repeated here as a closed table because that table is not
// exported and this module must not require the heavy wire module just to read a constant.
const LENS_TO_THEO_ID = Object.freeze({ UDP: 'UnDefined', IDP: 'IllDefined', WDP: 'WellDefined' });

let _canonicalCache = null;
function canonicalFrameworkSet() {
  if (_canonicalCache) return _canonicalCache;
  const set = new Set();
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
    [].concat(doc.framework_names || [], doc.curated_extras || []).forEach((n) => {
      if (typeof n === 'string' && n.length > 0) set.add(n.toLowerCase());
    });
  } catch (_e) {
    // An unreadable vocabulary yields an empty set: no framework handle is ever proven (fail closed).
  }
  _canonicalCache = set;
  return set;
}

function isCanonicalFramework(name) {
  if (typeof name !== 'string' || !FRAMEWORK_NAME_RE.test(name)) return false;
  return canonicalFrameworkSet().has(name.toLowerCase());
}

function isTheoProblemType(v) {
  return typeof v === 'string' && ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'].indexOf(v) !== -1;
}

/**
 * nestHandles({ section, identity, triple, roomRung, frameworksInPlay })
 * identity: the value plan 03 defines, { ok: true, ... } or { ok: false, reason }.
 * triple: the nest's reading triple (brain-derivation shape) or null.
 * roomRung: the room's `.mindrian/jtbd-state.json` goal.rung, or null.
 * frameworksInPlay: framework names the nest is working with (any strings; only canonical ones survive).
 * @returns {{ok:true, handles:object}|{ok:false, not_asked:string}}
 */
function nestHandles(input) {
  const o = input || {};
  const identity = o.identity;
  if (!identity || identity.ok !== true) return { ok: false, not_asked: NOT_ASKED.room_not_ready };

  const handles = {};

  // Problem type precedence (RESEARCH Assumption A6): the nest's own lens when it has a MINTO reading, else the
  // room rung when it is one of Theo's four ids, else nothing. Wicked can only come from the room rung.
  let problemType = null;
  const t = o.triple;
  if (t && t.reasoning && t.reasoning.exists === true) {
    const lens = require(path.join(ROOT, 'lib', 'core', 'brain-derivation.cjs')).classifyProblemType(t);
    problemType = LENS_TO_THEO_ID[lens] || null;
  }
  if (!problemType) {
    const rung = require(path.join(ROOT, 'lib', 'core', 'strategy', 'rung-vocabulary.cjs'));
    if (rung.isTheoRung(o.roomRung)) problemType = o.roomRung;
  }
  if (problemType) handles.problem_type = problemType;

  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  if (typeof o.section === 'string' && Object.prototype.hasOwnProperty.call(registry.CORE_SECTIONS, o.section)) {
    handles.section_kind = o.section;
    const job = registry.getSectionJob(o.section);
    if (job && typeof job.job_id === 'string' && job.job_id.length > 0) handles.job_id = job.job_id;
  }

  const frameworks = [];
  (Array.isArray(o.frameworksInPlay) ? o.frameworksInPlay : []).forEach((n) => {
    if (frameworks.length >= MAX_FRAMEWORK_HANDLES) return;
    if (isCanonicalFramework(n) && frameworks.indexOf(n) === -1) frameworks.push(n);
  });

  if (!handles.problem_type && frameworks.length === 0) return { ok: false, not_asked: NOT_ASKED.no_handle_to_send };

  // Key order is fixed (problem_type, section_kind, job_id, frameworks); absent keys are omitted, except
  // frameworks, which is always present as a list (possibly empty).
  const ordered = {};
  if (handles.problem_type) ordered.problem_type = handles.problem_type;
  if (handles.section_kind) ordered.section_kind = handles.section_kind;
  if (handles.job_id) ordered.job_id = handles.job_id;
  ordered.frameworks = frameworks;
  return { ok: true, handles: ordered };
}

function stableJson(v) {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

/** handlesFingerprint(handles) -> 'sha256:<hex>' over a key-sorted JSON of the handles. Array order is kept. */
function handlesFingerprint(handles) {
  return 'sha256:' + require('node:crypto').createHash('sha256').update(stableJson(handles)).digest('hex');
}

// ---------------------------------------------------------------------------
// Reading Theo's answers. The envelope is not pinned by this repo, so the readers are defensive: a result
// object may be the row itself or carry a `rows` array.
// ---------------------------------------------------------------------------
function isRefusal(res) {
  return !!res && typeof res === 'object' && typeof res.error === 'string' && res.error.length > 0;
}

function firstRow(res) {
  if (res && Array.isArray(res.rows)) return (res.rows[0] && typeof res.rows[0] === 'object') ? res.rows[0] : {};
  return (res && typeof res === 'object') ? res : {};
}

function listFromFindFrameworks(res) {
  const row = firstRow(res);
  return Array.isArray(row.chapters) ? row.chapters : [];
}

// 369.25-17 (plan 08 carry-over): the matched-of-total chapter counts. Theo's own source puts them in a top-level
// `coverage` block and on the anchor row; both are read, the block first. Only two finite numbers are kept.
function coverageOf(res) {
  const pick = (o) => (o && typeof o === 'object' && Number.isFinite(o.matched) && Number.isFinite(o.total) ? { matched: o.matched, total: o.total } : null);
  return pick(res && res.coverage) || pick(firstRow(res));
}

function listFromCommands(res) {
  if (!res || typeof res !== 'object') return [];
  let rows = Array.isArray(res.rows) ? res.rows : [];
  if (rows.length === 1 && rows[0] && Array.isArray(rows[0].rows)) rows = rows[0].rows;
  return rows;
}

function listFromRoute(res) {
  return res && Array.isArray(res.chain) ? res.chain : [];
}

function neighborhoodOf(framework, res) {
  const row = firstRow(res);
  if (typeof row.name !== 'string') return null;
  return {
    framework,
    name: row.name,
    chapters: Array.isArray(row.chapters) ? row.chapters : [],
    commands: Array.isArray(row.commands) ? row.commands : [],
    brain_records: Array.isArray(row.brainRecords) ? row.brainRecords.length : 0,
  };
}

function refusalKind(res) {
  const k = String(res.error).replace(/[^a-z0-9_]/gi, '').slice(0, 40);
  return k.length > 0 ? k : 'error';
}

function notAsked(reason, queriesSent, now) {
  return {
    asked: false,
    not_asked: reason,
    not_asked_line: NOT_ASKED_LINES[reason],
    queries_sent: queriesSent,
    asked_at: now(),
  };
}

/**
 * askTheoForNest(handles, deps) -> asked result | not-asked result. Never throws.
 * deps: { callTool, now, origin, offline, atBirth }. callTool defaults to brain-client callTool, origin to
 * brain-client getBrainUrl(), now to the ISO clock.
 */
async function askTheoForNest(handles, deps) {
  const d = deps || {};
  const now = typeof d.now === 'function' ? d.now : () => new Date().toISOString();
  const h = (handles && typeof handles === 'object') ? handles : {};
  const problemType = isTheoProblemType(h.problem_type) ? h.problem_type : null;
  const frameworks = (Array.isArray(h.frameworks) ? h.frameworks : []).filter(isCanonicalFramework).slice(0, MAX_FRAMEWORK_HANDLES);

  if (d.atBirth === true) return notAsked(NOT_ASKED.at_birth, 0, now);
  if (d.offline === true) return notAsked(NOT_ASKED.offline, 0, now);
  if (!problemType && frameworks.length === 0) return notAsked(NOT_ASKED.no_handle_to_send, 0, now);

  let brain = null;
  const callTool = typeof d.callTool === 'function'
    ? d.callTool
    : (brain = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'))).callTool;
  let origin = d.origin;
  if (typeof origin !== 'string' || origin.length === 0) {
    try { origin = (brain || require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'))).getBrainUrl(); } catch (_e) { origin = null; }
  }

  const plan = [];
  if (problemType) {
    plan.push({ read: 'find_frameworks_for_problem_type', key: 'find_frameworks', args: { problem_type: problemType } });
    plan.push({ read: 'commands_for_problem_type', key: 'commands', args: { problem_type: problemType } });
    plan.push({ read: 'recommend_chain', key: 'route', args: { problem_type: problemType, max_steps: MAX_CHAIN_STEPS } });
  }
  frameworks.forEach((f) => plan.push({ read: 'framework_neighborhood', key: 'neighborhood', args: { framework: f }, framework: f }));

  const rows = { find_frameworks: 0, commands: 0, route: 0, neighborhood: 0 };
  const results = { chapters: [], commands: [], route: [], neighborhoods: [] };
  const refusals = [];
  let answered = 0;
  let egressRefused = 0;
  let queries = 0;

  for (const step of plan) {
    queries++;
    let res = null;
    try { res = await callTool(step.read, step.args); } catch (_e) { res = null; }
    if (res === null || res === undefined || typeof res !== 'object') continue;
    if (isRefusal(res)) {
      const kind = refusalKind(res);
      refusals.push({ tool: step.read, kind });
      if (kind === 'egress_blocked') egressRefused++;
      continue;
    }
    answered++;
    if (step.key === 'find_frameworks') { results.chapters = listFromFindFrameworks(res); rows.find_frameworks = results.chapters.length; const cov = coverageOf(res); if (cov) results.coverage = cov; }
    else if (step.key === 'commands') { results.commands = listFromCommands(res); rows.commands = results.commands.length; }
    else if (step.key === 'route') { results.route = listFromRoute(res); rows.route = results.route.length; }
    else {
      const n = neighborhoodOf(step.framework, res);
      if (n) { results.neighborhoods.push(n); rows.neighborhood++; }
    }
  }

  if (answered === 0) {
    return notAsked(egressRefused === queries && queries > 0 ? NOT_ASKED.egress_blocked : NOT_ASKED.theo_unavailable, queries, now);
  }

  const onWire = [];
  if (problemType) onWire.push('problem_type');
  if (frameworks.length > 0) onWire.push('frameworks');
  return {
    asked: true,
    origin,
    handles_sent: h,
    handles_on_wire: onWire,
    handles_fingerprint: handlesFingerprint(h),
    queries_sent: queries,
    rows_returned: rows,
    refusals,
    asked_at: now(),
    results,
  };
}

module.exports = {
  nestHandles,
  askTheoForNest,
  handlesFingerprint,
  NOT_ASKED,
  NOT_ASKED_LINES,
  THEO_READS,
};
