'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363-09 -- research grants: the approval model behind every fetch.
 *
 * D-04: a grant has two lifetimes, persisted room-locally in
 * .mindrian/research-grants.json (MCP gate ids are in-memory and single-use,
 * so an approval must be written down the moment it is given):
 *   - standing (F.0): provider openalex, family whitespace-gap/v1 only in 363,
 *     per-run caps, hourly throttle, 30-day expiry, policy version, revocation.
 *   - run (F.6): the exact approved round-one q_hash set, families, budget.
 * A grant authorizes FETCHING, never filing (T-363-11): a grant object with
 * any file or filing key is refused at write.
 *
 * D-10: the first time a new search term would leave under a standing grant,
 * validateExecutedQuery returns new_term; extendTerms records the navigator's
 * approval of that term and its synonyms, and the same query then passes.
 * D-11: GRANT_EXPIRY_DAYS and RESEARCH_RUNS_PER_HOUR are disclosed floor rows.
 *
 * Canon Part 8: no network I/O and no outbound string here. Grant and run
 * ledgers never egress. Plain frozen-object validators, no zod.
 * Writes are temp-then-rename (same idiom as scripts/scout-cadence-guard.cjs
 * atomicWriteJsonAmbient; copied, not required, because that file is a script
 * entry point with load-time side effects). The run ledger is its own file and
 * never touches the 355.1 ambient ledger (363-RESEARCH.md Pitfall 18).
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FAMILIES } = require('./families.cjs');

const GRANT_EXPIRY_DAYS = 30;
const RESEARCH_RUNS_PER_HOUR = 1;

const CURRENT_POLICY = 'drp363-grant/1';
const GRANTS_SCHEMA = 'mos.research-grant-ledger/1';
const GRANT_SCHEMA = 'mos.research-grant/1';
const RUN_LEDGER_SCHEMA = 'mos.research-run-ledger/1';
const GRANTS_RELPATH = path.join('.mindrian', 'research-grants.json');
const RUN_LEDGER_RELPATH = path.join('.mindrian', 'research-run-ledger.json');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RUNS_KEEP = 50;

// D-04 first scope: a standing grant covers openalex and whitespace-gap/v1 only.
const STANDING_SCOPE = Object.freeze({
  providers: Object.freeze(['openalex']),
  families: Object.freeze(['whitespace-gap/v1']),
});

const STANDING_CAPS = Object.freeze({ queries_per_run: 3, results_per_query: 5, max_searches: 3 });

// Fixed check order (D-04, D-10). The first failing check is the one reason.
const REASK_REASONS = Object.freeze([
  'no_grant', 'room_mismatch', 'grant_revoked', 'grant_expired', 'grant_reversioned',
  'provider_not_in_policy', 'outside_family', 'audit_tripped', 'new_term',
  'hash_not_approved', 'cap_exceeded', 'throttle_exceeded', 'multi_step',
]);

const FILING_KEY_RE = /^(file|filing|file_on_approve|files|file_on_grant)$/i;

// -- small helpers -----------------------------------------------------------

function iso(ms) { return new Date(ms).toISOString(); }
function clockOf(opts) { return opts && Number.isFinite(opts.now) ? opts.now : Date.now(); }
function ensureDir(roomDir) { fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true }); }

function atomicWriteJson(file, data) {
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function quarantine(file, nowMs) {
  const dest = file + '.' + String(nowMs) + '.corrupt';
  try { fs.renameSync(file, dest); return dest; } catch (_e) { return null; }
}

// roomIdFor(roomDir): basename plus a sha256 prefix of the absolute path, so a
// grant replayed into a differently-located room with the same name fails.
function roomIdFor(roomDir) {
  const abs = path.resolve(roomDir);
  return path.basename(abs) + ':' + crypto.createHash('sha256').update(abs, 'utf8').digest('hex').slice(0, 12);
}

function hasFilingKey(obj, depth) {
  if (!obj || typeof obj !== 'object' || (depth || 0) > 6) return false;
  return Object.keys(obj).some(function (k) {
    return FILING_KEY_RE.test(k) || hasFilingKey(obj[k], (depth || 0) + 1);
  });
}

function normTerm(t) { return String(t).trim().toLowerCase(); }

function templateIdsOf(familyId) {
  const f = FAMILIES[familyId];
  return f && Array.isArray(f.templates) ? f.templates.map(function (t) { return t.id; }) : [];
}

// -- grant ledger ------------------------------------------------------------

function grantsPath(roomDir) { return path.join(roomDir, GRANTS_RELPATH); }

// readGrants(roomDir, {now}) -> {grants, quarantined}. Never throws. A corrupt
// file is renamed aside (never deleted) and reads as no grants, which means
// no fetch (T-363-32).
function readGrants(roomDir, opts) {
  const file = grantsPath(roomDir);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return { grants: [], quarantined: false }; }
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_e) { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.grants)) {
    quarantine(file, clockOf(opts));
    return { grants: [], quarantined: true };
  }
  return { grants: parsed.grants, quarantined: false };
}

function saveGrants(roomDir, grants) {
  ensureDir(roomDir);
  atomicWriteJson(grantsPath(roomDir), { schema: GRANTS_SCHEMA, grants: grants });
}

function isApprovedVia(v) {
  return !!v && typeof v === 'object' && (v.surface === 'cli' || v.surface === 'mcp') &&
    typeof v.decision_node_id === 'string' && v.decision_node_id.length > 0;
}

function termEntry(t, atIso, via) {
  const synonyms = Array.isArray(t.synonyms) ? t.synonyms.filter(function (s) { return typeof s === 'string' && s.trim(); }) : [];
  return { term: String(t.term).trim(), synonyms: synonyms, approved_at: atIso, approved_via: via };
}

// writeGrant(roomDir, grant, {approved_via, now}) -> {ok, grant} | {ok:false, reason}.
// The only writer. It stamps grant_id, version, approved_at, expires_at.
function writeGrant(roomDir, grant, opts) {
  const via = opts && opts.approved_via;
  if (!isApprovedVia(via)) return { ok: false, reason: 'approval_required' };
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return { ok: false, reason: 'bad_grant' };
  if (hasFilingKey(grant)) return { ok: false, reason: 'grant_never_authorizes_filing' };
  if (grant.lifetime !== 'standing' && grant.lifetime !== 'run') return { ok: false, reason: 'bad_lifetime' };
  if (!Array.isArray(grant.providers) || grant.providers.length === 0) return { ok: false, reason: 'bad_grant' };
  if (!Array.isArray(grant.families) || grant.families.length === 0) return { ok: false, reason: 'bad_grant' };
  if (!grant.caps || typeof grant.caps !== 'object') return { ok: false, reason: 'bad_grant' };
  const knownFamily = grant.families.every(function (f) { return Object.prototype.hasOwnProperty.call(FAMILIES, f); });
  if (!knownFamily) return { ok: false, reason: 'unknown_family' };

  const now = clockOf(opts);
  const at = iso(now);
  let out;
  if (grant.lifetime === 'standing') {
    const inScope = grant.providers.every(function (p) { return STANDING_SCOPE.providers.indexOf(p) !== -1; }) &&
      grant.families.every(function (f) { return STANDING_SCOPE.families.indexOf(f) !== -1; });
    if (!inScope) return { ok: false, reason: 'standing_scope_exceeded' };
    const terms = Array.isArray(grant.approved_terms) ? grant.approved_terms : [];
    out = {
      schema: GRANT_SCHEMA,
      grant_id: 'g-' + crypto.randomBytes(4).toString('hex'),
      version: 1,
      lifetime: 'standing',
      policy_version: CURRENT_POLICY,
      room_id: roomIdFor(roomDir),
      providers: grant.providers.slice(),
      fallback: null,
      families: grant.families.slice(),
      approved_terms: terms.filter(function (t) { return t && typeof t.term === 'string' && t.term.trim(); })
        .map(function (t) { return termEntry(t, at, via); }),
      caps: Object.assign({}, grant.caps),
      throttle: { runs_per_hour: (grant.throttle && Number.isInteger(grant.throttle.runs_per_hour)) ? grant.throttle.runs_per_hour : RESEARCH_RUNS_PER_HOUR },
      approved_at: at,
      approved_via: { surface: via.surface, decision_node_id: via.decision_node_id },
      expires_at: iso(now + GRANT_EXPIRY_DAYS * DAY_MS),
      revoked_at: null,
    };
  } else {
    if (typeof grant.run_id !== 'string' || !grant.run_id) return { ok: false, reason: 'bad_grant' };
    if (!Array.isArray(grant.approved_hashes) || grant.approved_hashes.length === 0) return { ok: false, reason: 'bad_grant' };
    const budgetMs = Number.isFinite(grant.caps.time_budget_ms) ? grant.caps.time_budget_ms : HOUR_MS;
    out = {
      schema: GRANT_SCHEMA,
      grant_id: 'g-' + crypto.randomBytes(4).toString('hex'),
      version: 1,
      lifetime: 'run',
      policy_version: CURRENT_POLICY,
      room_id: roomIdFor(roomDir),
      providers: grant.providers.slice(),
      fallback: null,
      families: grant.families.slice(),
      approved_hashes: grant.approved_hashes.slice(),
      run_id: grant.run_id,
      caps: Object.assign({}, grant.caps),
      approved_at: at,
      approved_via: { surface: via.surface, decision_node_id: via.decision_node_id },
      expires_at: iso(now + budgetMs),
      revoked_at: null,
    };
  }
  const read = readGrants(roomDir, { now: now });
  read.grants.push(out);
  try { saveGrants(roomDir, read.grants); } catch (_e) { return { ok: false, reason: 'write_failed' }; }
  return { ok: true, grant: out };
}

function revokeGrant(roomDir, grantId, opts) {
  const read = readGrants(roomDir, opts);
  const g = read.grants.find(function (x) { return x && x.grant_id === grantId; });
  if (!g) return { ok: false, reason: 'unknown_grant' };
  if (!g.revoked_at) g.revoked_at = iso(clockOf(opts));
  try { saveGrants(roomDir, read.grants); } catch (_e) { return { ok: false, reason: 'write_failed' }; }
  return { ok: true, grant: g };
}

// extendTerms(roomDir, grantId, terms, approvedVia, {now}): records the
// navigator's approval of new terms (with synonyms) on a standing grant and
// bumps its version (D-10).
function extendTerms(roomDir, grantId, terms, approvedVia, opts) {
  if (!isApprovedVia(approvedVia)) return { ok: false, reason: 'approval_required' };
  if (!Array.isArray(terms) || terms.length === 0) return { ok: false, reason: 'no_terms' };
  const read = readGrants(roomDir, opts);
  const g = read.grants.find(function (x) { return x && x.grant_id === grantId; });
  if (!g) return { ok: false, reason: 'unknown_grant' };
  if (g.lifetime !== 'standing') return { ok: false, reason: 'not_standing' };
  if (g.revoked_at) return { ok: false, reason: 'grant_revoked' };
  const at = iso(clockOf(opts));
  const via = { surface: approvedVia.surface, decision_node_id: approvedVia.decision_node_id };
  terms.forEach(function (t) {
    if (!t || typeof t.term !== 'string' || !t.term.trim()) return;
    const existing = g.approved_terms.find(function (e) { return normTerm(e.term) === normTerm(t.term); });
    if (existing) {
      const have = existing.synonyms.map(normTerm);
      (t.synonyms || []).forEach(function (s) { if (typeof s === 'string' && s.trim() && have.indexOf(normTerm(s)) === -1) existing.synonyms.push(s.trim()); });
    } else {
      g.approved_terms.push(termEntry(t, at, via));
    }
  });
  g.version += 1;
  try { saveGrants(roomDir, read.grants); } catch (_e) { return { ok: false, reason: 'write_failed' }; }
  return { ok: true, grant: g };
}

// findActiveGrant(roomDir, {now, lifetime, run_id}) -> newest unrevoked,
// unexpired, current-policy grant for this room, or null.
function findActiveGrant(roomDir, opts) {
  const now = clockOf(opts);
  const room = roomIdFor(roomDir);
  const list = readGrants(roomDir, opts).grants.filter(function (g) {
    if (!g || g.room_id !== room || g.revoked_at || g.policy_version !== CURRENT_POLICY) return false;
    if (!(Date.parse(g.expires_at) > now)) return false;
    if (opts && opts.lifetime && g.lifetime !== opts.lifetime) return false;
    if (opts && opts.run_id && g.run_id !== opts.run_id) return false;
    return true;
  });
  return list.length ? list[list.length - 1] : null;
}

// -- builders (write nothing) -----------------------------------------------

// buildStandingProposal(roomDir, {terms, now}) -> unapproved standing grant
// inside STANDING_SCOPE. Terms are [{term, synonyms[]}] the navigator will see.
function buildStandingProposal(roomDir, opts) {
  const terms = (opts && Array.isArray(opts.terms) ? opts.terms : []).filter(function (t) { return t && typeof t.term === 'string'; });
  return {
    schema: GRANT_SCHEMA,
    lifetime: 'standing',
    policy_version: CURRENT_POLICY,
    room_id: roomIdFor(roomDir),
    providers: STANDING_SCOPE.providers.slice(),
    fallback: null,
    families: STANDING_SCOPE.families.slice(),
    approved_terms: terms.map(function (t) { return { term: t.term, synonyms: Array.isArray(t.synonyms) ? t.synonyms.slice() : [] }; }),
    caps: Object.assign({}, STANDING_CAPS),
    throttle: { runs_per_hour: RESEARCH_RUNS_PER_HOUR },
    approved_at: null,
    approved_via: null,
    expires_at: null,
    revoked_at: null,
  };
}

// buildRunGrant(plan) -> unapproved run grant from the plan's round-one
// q_hashes, families and budget. Reads plan.leaves[].queries (round 1).
function buildRunGrant(plan) {
  const hashes = [];
  const families = [];
  ((plan && plan.leaves) || []).forEach(function (leaf) {
    ((leaf && leaf.queries) || []).forEach(function (q) {
      if (!q || (q.round !== undefined && q.round !== 1)) return;
      if (typeof q.q_hash === 'string' && hashes.indexOf(q.q_hash) === -1) hashes.push(q.q_hash);
      if (typeof q.family === 'string' && families.indexOf(q.family) === -1) families.push(q.family);
    });
  });
  const b = (plan && plan.budget) || {};
  return {
    schema: GRANT_SCHEMA,
    lifetime: 'run',
    policy_version: CURRENT_POLICY,
    room_id: null,
    providers: STANDING_SCOPE.providers.slice(),
    fallback: null,
    families: families,
    approved_hashes: hashes,
    run_id: plan && plan.run_id,
    caps: {
      queries_per_run: b.queries_per_round,
      results_per_query: b.results_per_query,
      max_searches: b.max_searches,
      time_budget_ms: b.time_budget_ms,
    },
    approved_at: null,
    approved_via: null,
    expires_at: null,
    revoked_at: null,
  };
}

// -- the per-query check -----------------------------------------------------

// validateExecutedQuery(query, grant, state) -> {ok:true} | {ok:false, reason}.
// query: {q, q_hash, template_id, family, provider, audit, slot_terms[], round, trigger}
// state: {room_id, now, searches_used, round, runs_in_window}
// Checks run in REASK_REASONS order; exactly one reason comes back.
function validateExecutedQuery(query, grant, state) {
  const q = query || {};
  const st = state || {};
  const now = Number.isFinite(st.now) ? st.now : Date.now();
  if (!grant || typeof grant !== 'object') return { ok: false, reason: 'no_grant' };
  if (grant.room_id !== st.room_id) return { ok: false, reason: 'room_mismatch' };
  if (grant.revoked_at) return { ok: false, reason: 'grant_revoked' };
  if (!(Date.parse(grant.expires_at) > now)) return { ok: false, reason: 'grant_expired' };
  if (grant.policy_version !== CURRENT_POLICY) return { ok: false, reason: 'grant_reversioned' };
  if (!Array.isArray(grant.providers) || grant.providers.indexOf(q.provider) === -1) return { ok: false, reason: 'provider_not_in_policy' };
  if (!Array.isArray(grant.families) || grant.families.indexOf(q.family) === -1 || templateIdsOf(q.family).indexOf(q.template_id) === -1) {
    return { ok: false, reason: 'outside_family' };
  }
  if (q.audit !== 'pass') return { ok: false, reason: 'audit_tripped' };

  const round = Number.isInteger(q.round) ? q.round : (Number.isInteger(st.round) ? st.round : 1);
  if (grant.lifetime === 'standing') {
    const known = {};
    (grant.approved_terms || []).forEach(function (e) {
      known[normTerm(e.term)] = true;
      (e.synonyms || []).forEach(function (s) { known[normTerm(s)] = true; });
    });
    const fresh = (Array.isArray(q.slot_terms) ? q.slot_terms : []).some(function (t) { return !known[normTerm(t)]; });
    if (fresh) return { ok: false, reason: 'new_term' };
  } else if (round === 1) {
    if ((grant.approved_hashes || []).indexOf(q.q_hash) === -1) return { ok: false, reason: 'hash_not_approved' };
  }

  const cap = grant.caps && Number.isFinite(grant.caps.max_searches) ? grant.caps.max_searches : 0;
  if ((st.searches_used || 0) >= cap) return { ok: false, reason: 'cap_exceeded' };
  if (grant.lifetime === 'standing' && q.trigger === 'ambient') {
    const limit = grant.throttle && Number.isInteger(grant.throttle.runs_per_hour) ? grant.throttle.runs_per_hour : RESEARCH_RUNS_PER_HOUR;
    // The current run is already counted in runs_in_window, so more than the
    // limit means a second run started inside the hour.
    if ((st.runs_in_window || 0) > limit) return { ok: false, reason: 'throttle_exceeded' };
  }
  if (grant.lifetime === 'standing' && round > 1) return { ok: false, reason: 'multi_step' };
  return { ok: true };
}

// -- F.0 grant card ----------------------------------------------------------

function grantCard(proposal, opts) {
  const p = proposal || {};
  const now = clockOf(opts);
  const newTerms = (opts && Array.isArray(opts.newTerms)) ? opts.newTerms : [];
  const standingKind = p.lifetime !== 'run';
  const templates = [];
  (p.families || []).forEach(function (f) { templates.push(f + ': ' + templateIdsOf(f).join(', ')); });
  const caps = p.caps || {};
  const lines = [];
  lines.push('## Let this room look things up in OpenAlex?');
  lines.push('');
  lines.push('OpenAlex is a public index of scholarly papers. A grant lets the room send short search strings there. It covers fetching only; filing still asks each time.');
  lines.push('');
  lines.push('- Provider: ' + (p.providers || []).join(', ') + '; fallback: none (if it is down, the run says so and stops)');
  lines.push('- What is searched: OpenAlex titles, abstracts and metadata; nothing else leaves the room');
  lines.push('- Search shapes allowed (by template id): ' + templates.join('; '));
  lines.push('- Caps per run: ' + caps.max_searches + ' searches, ' + caps.results_per_query + ' results per search');
  if (standingKind) {
    lines.push('- Throttle: ' + ((p.throttle && p.throttle.runs_per_hour) || RESEARCH_RUNS_PER_HOUR) + ' room-started run per hour');
    lines.push('- Expires: ' + iso(now + GRANT_EXPIRY_DAYS * DAY_MS).slice(0, 10) + ' (' + GRANT_EXPIRY_DAYS + ' days from today)');
  }
  lines.push('- Room scope: only this room (' + (p.room_id || 'this room') + '); it does not carry to any other room');
  lines.push('- Policy version: ' + (p.policy_version || CURRENT_POLICY));
  lines.push('- Revoke: tell Larry "revoke the research grant" at any time; the next search stops');
  if (newTerms.length > 0) {
    lines.push('');
    lines.push('New terms that would leave the room the first time (approving covers these):');
    newTerms.forEach(function (t) { lines.push('- ' + String(t).replace(/[\r\n]+/g, ' ')); });
  }
  lines.push('');
  lines.push('A grant never files anything. Anything worth keeping comes back as its own yes or no.');

  return {
    shape: 'F.0',
    title: 'Research grant',
    question: 'Approve this research grant?',
    options: [
      { id: 'approve_standing', label: 'Approve this standing grant (Recommended)', recommended: true },
      { id: 'approve_run', label: 'Approve this one run only' },
      { id: 'not_now', label: 'Not now' },
    ],
    body_md: lines.join('\n').replace(/[\u2014\u2013]/g, '-'),
    payload: {
      grant_lifetime: p.lifetime || 'standing',
      policy_version: p.policy_version || CURRENT_POLICY,
      new_terms: newTerms.slice(),
    },
  };
}

// -- run ledger (throttle) ---------------------------------------------------

function runLedgerPath(roomDir) { return path.join(roomDir, RUN_LEDGER_RELPATH); }

function emptyRunLedger() {
  return { schema: RUN_LEDGER_SCHEMA, runs_window: { start: null, count: 0 }, runs: [], pending_cards: [] };
}

function validRunLedger(o) {
  return !!o && typeof o === 'object' && o.schema === RUN_LEDGER_SCHEMA && Array.isArray(o.runs) &&
    Array.isArray(o.pending_cards) && o.runs_window && typeof o.runs_window === 'object';
}

// readRunLedger(roomDir, {now}) -> ledger with quarantined flag. Never throws.
function readRunLedger(roomDir, opts) {
  const file = runLedgerPath(roomDir);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return Object.assign(emptyRunLedger(), { quarantined: false }); }
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_e) { parsed = null; }
  if (!validRunLedger(parsed)) {
    quarantine(file, clockOf(opts));
    return Object.assign(emptyRunLedger(), { quarantined: true });
  }
  return Object.assign({}, parsed, { quarantined: false });
}

function saveRunLedger(roomDir, ledger) {
  ensureDir(roomDir);
  const clean = { schema: RUN_LEDGER_SCHEMA, runs_window: ledger.runs_window, runs: ledger.runs.slice(-RUNS_KEEP), pending_cards: ledger.pending_cards };
  atomicWriteJson(runLedgerPath(roomDir), clean);
}

function windowCount(ledger, now) {
  const w = ledger.runs_window;
  if (!w || !Number.isFinite(w.start)) return 0;
  return now - w.start >= HOUR_MS ? 0 : (w.count || 0);
}

// recordRun(roomDir, {run_id, mode, trigger, delta_hash, now}). Ambient runs
// count toward the hourly window; navigator-started runs are recorded only.
function recordRun(roomDir, run) {
  const now = clockOf(run);
  const ledger = readRunLedger(roomDir, { now: now });
  const trigger = run && run.trigger === 'ambient' ? 'ambient' : 'navigator';
  if (trigger === 'ambient') {
    const w = ledger.runs_window;
    if (!Number.isFinite(w.start) || now - w.start >= HOUR_MS) ledger.runs_window = { start: now, count: 1 };
    else ledger.runs_window = { start: w.start, count: (w.count || 0) + 1 };
  }
  ledger.runs.push({
    run_id: (run && run.run_id) || null,
    ts: iso(now),
    mode: (run && run.mode) || null,
    trigger: trigger,
    delta_hash: (run && run.delta_hash) || null,
  });
  try { saveRunLedger(roomDir, ledger); } catch (_e) { return { ok: false, reason: 'write_failed' }; }
  return { ok: true };
}

// throttleState(roomDir, {now}) -> {count, limit, allowed_next, exceeded}.
// allowed_next: another room-started run may begin now. exceeded: more runs
// than the limit already started inside the window.
function throttleState(roomDir, opts) {
  const now = clockOf(opts);
  const ledger = readRunLedger(roomDir, { now: now });
  const count = windowCount(ledger, now);
  const limit = RESEARCH_RUNS_PER_HOUR;
  return { count: count, limit: limit, allowed_next: count < limit, exceeded: count > limit };
}

module.exports = {
  CURRENT_POLICY,
  GRANT_EXPIRY_DAYS,
  RESEARCH_RUNS_PER_HOUR,
  STANDING_SCOPE,
  REASK_REASONS,
  roomIdFor,
  readGrants,
  writeGrant,
  revokeGrant,
  extendTerms,
  findActiveGrant,
  buildStandingProposal,
  buildRunGrant,
  validateExecutedQuery,
  grantCard,
  readRunLedger,
  recordRun,
  throttleState,
};
