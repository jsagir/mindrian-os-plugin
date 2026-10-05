'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 12 -- the quick research run, end to end in code.
 *
 * One bounded pass (D-03): at most QUICK_MAX_QUERIES audited searches, the top
 * QUICK_TOP_ROWS records per search, one corpus (OpenAlex), cache-first through
 * fetchSourceCached under the openalex-v2 namespace, plus a local room check
 * that reads room files with fs only and sends nothing.
 *
 * Order of work:
 *   1. validatePlan and checkPyramid; a plan that does not pass is refused.
 *   2. every round-one search is checked against the grant BEFORE any fetch
 *      (validateExecutedQuery, D-04). Any re-ask reason returns an F.0 card
 *      and nothing is fetched or audited.
 *   3. each search is fetched cache-first; every executed search, cache hit,
 *      blocked or failed, appends one audit record (D-04, D-10).
 *   4. rows come from the host model (rowsProvider) or, with no model present,
 *      from deterministicTermRows; validateRows anchors each to the fetched
 *      record (quote, content hash).
 *   5. the verdict is computed in code (verdict.cjs); failure is never a gap.
 *   6. the run state is written atomically and the evidence card returned.
 *
 * escalateToDeep builds a deep plan seed from a quick run. It writes nothing,
 * fetches nothing and never starts the run (D-03, Canon Part 12).
 *
 * Run state layout (shared with 363-13 and 363-15):
 *   <room>/.mindrian/research-runs/<run_id>/{plan,records,rows,run,card}.json
 *
 * Egress audit (Canon Part 8): the only outbound strings are the plan's
 * round-one q strings, composed and audited upstream, re-checked here by
 * q_hash and validateExecutedQuery, and audited again by the corpus. Room text
 * is read locally by localRoomCheck and never leaves. Cards, rows and answer
 * lines stay local. No API key is read or written here.
 *
 * Dependencies: node built-ins plus the shipped 363 modules. No em-dash or
 * en-dash in this file.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const planMod = require('./plan.cjs');
const pyramidMod = require('./pyramid.cjs');
const families = require('./families.cjs');
const grants = require('./grants.cjs');
const theoLane = require('./theo-lane.cjs');
const auditLedger = require('./audit-ledger.cjs');
const egressPolicy = require('./egress-policy.cjs');
const evidenceRows = require('./evidence-rows.cjs');
const verdictMod = require('./verdict.cjs');
const sectionRegistry = require('../section-registry.cjs');
const researchCache = require('../research-cache.cjs');
const corpus = require('../research-corpus.cjs');
const sourceLensDriver = require('../../lens-engine/source-lens-driver.cjs');

const BUDGETS = planMod.BUDGETS;
const QUICK_MAX_QUERIES = BUDGETS.QUICK_MAX_QUERIES;
const QUICK_TOP_ROWS = BUDGETS.QUICK_TOP_ROWS;
const QUICK_TIME_BUDGET_MS = BUDGETS.QUICK_TIME_BUDGET_MS;

const SOURCE_ID = 'openalex-v2';
const PROVIDER = 'openalex';
const DEEP_OFFER_TEXT = 'run deep on this?';
// A quick plan that names no limiter cannot seed a deep run (DRP363-19); the offer asks for the bottleneck first.
const NEEDS_LIMITER_OFFER_TEXT = 'name what blocks this and I\'ll plan a deep run';
const STATE_DIR = path.join('.mindrian', 'research-runs');

const ROOM_FILE_CAP = 400;
const ROOM_FILE_BYTES = 262144;
const ROOM_DEPTH_CAP = 5;

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function num(v) { return typeof v === 'number' && Number.isFinite(v); }
function iso(ms) { return new Date(ms).toISOString(); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function oneLine(s) { return noDash(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()); }

function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function normTerm(t) { return String(t).trim().toLowerCase(); }

// ---------------------------------------------------------------------------
// localRoomCheck: fs only, sends nothing (D-03 extraction-failure falsifier)
// ---------------------------------------------------------------------------
function sectionNames() {
  const names = Object.keys(sectionRegistry.CORE_SECTIONS || {})
    .concat(Object.keys(sectionRegistry.EXTENDED_SECTION_META || {}))
    .concat(sectionRegistry.STRUCTURAL_DIRS || []);
  return names.filter(function (n, i) { return names.indexOf(n) === i; });
}

// A closed English function-word list: these never count toward keyword coverage.
const ROOM_CHECK_STOP = Object.freeze(new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'onto',
  'or', 'over', 'per', 'than', 'that', 'the', 'their', 'these', 'this', 'those', 'to', 'under', 'via', 'was', 'were',
  'with', 'within', 'without',
]));

// contentTokens(normalized) -> the distinct content tokens, in order: runs of letters and numbers of length >= 3
// (or holding a digit), minus the function words.
function contentTokens(normalized) {
  const out = new Set(); // a Set keeps insertion order and the dedupe cheap on a 256 KB artifact
  String(normalized).split(/[^\p{L}\p{N}]+/u).forEach(function (tok) {
    if (tok.length === 0 || ROOM_CHECK_STOP.has(tok)) return;
    if (tok.length < 3 && !/\p{N}/u.test(tok)) return;
    out.add(tok);
  });
  return Array.from(out);
}

// localRoomCheck(roomDir, terms) -> { flagged, artifact_count, artifacts[{section, path}], terms_checked }
// Counts room artifacts (md and html) that name any term, case-insensitive. A long zone term rarely appears
// verbatim in the room, so keyword coverage backs up the exact phrase: an artifact also counts when it holds a
// strict majority of the term's content tokens (a term of 2 or more content tokens; a single-token term keeps
// substring semantics). This is SEED-104's residual, the D-03 extraction-failure falsifier.
// Walks the canonical section folders only; never reads a dot-directory, so
// .mindrian is never opened. Symlinks are skipped.
function localRoomCheck(roomDir, terms) {
  const phrases = list(terms).filter(nonEmpty).map(evidenceRows.normalizeText).filter(function (t) { return t.length > 0; });
  const needles = phrases.map(function (phrase) {
    const tokens = contentTokens(phrase);
    return { phrase: phrase, tokens: tokens, need: tokens.length >= 2 ? Math.floor(tokens.length / 2) + 1 : null };
  });
  const found = [];
  let seen = 0;
  if (needles.length === 0 || !nonEmpty(roomDir)) {
    return { flagged: false, artifact_count: 0, artifacts: [], terms_checked: needles.length };
  }

  // Does this artifact name any term: the exact phrase first (today's rule), then strict-majority token coverage.
  function covers(text) {
    if (needles.some(function (n) { return text.indexOf(n.phrase) !== -1; })) return true;
    let have = null; // this file's token set, built once and only when no phrase hit
    return needles.some(function (n) {
      if (n.need === null) return false;
      if (have === null) have = new Set(contentTokens(text));
      let got = 0;
      n.tokens.forEach(function (tok) { if (have.has(tok)) got += 1; });
      return got >= n.need;
    });
  }

  function visit(dir, section, depth) {
    if (depth > ROOM_DEPTH_CAP || seen >= ROOM_FILE_CAP) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    entries.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      if (seen >= ROOM_FILE_CAP) return;
      if (e.name.charAt(0) === '.') continue;
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { visit(abs, section, depth + 1); continue; }
      if (!e.isFile()) continue;
      if (!sectionRegistry.isIndexableArtifactFile(e.name)) continue;
      if (!/\.(md|html|htm)$/i.test(e.name)) continue;
      seen += 1;
      let text = '';
      try {
        const st = fs.statSync(abs);
        if (st.size > ROOM_FILE_BYTES) continue;
        text = evidenceRows.normalizeText(fs.readFileSync(abs, 'utf8'));
      } catch (_e) { continue; }
      if (covers(text)) {
        found.push({ section: section, path: path.relative(roomDir, abs).split(path.sep).join('/') });
      }
    }
  }

  sectionNames().forEach(function (s) {
    const dir = path.join(roomDir, s);
    let st = null;
    try { st = fs.lstatSync(dir); } catch (_e) { st = null; }
    if (st && st.isDirectory() && !st.isSymbolicLink()) visit(dir, s, 0);
  });
  return { flagged: found.length > 0, artifact_count: found.length, artifacts: found, terms_checked: needles.length };
}

// ---------------------------------------------------------------------------
// plan reading
// ---------------------------------------------------------------------------
function leafTerms(leaf) {
  const s = isObj(leaf && leaf.slots) ? leaf.slots : {};
  const out = [];
  if (nonEmpty(s.term)) out.push(s.term.trim());
  list(s.synonyms).filter(nonEmpty).forEach(function (x) { out.push(x.trim()); });
  return out;
}

function planTerms(plan) {
  const seen = {};
  const out = [];
  list(plan.leaves).forEach(function (leaf) {
    leafTerms(leaf).forEach(function (t) {
      if (!seen[normTerm(t)]) { seen[normTerm(t)] = true; out.push(t); }
    });
  });
  return out;
}

// The searches this quick run may fetch: researchable OpenAlex leaves, round
// one, de-duplicated by q_hash (a shared search runs once, both leaves read it).
function collectFetchQueries(plan) {
  const byHash = {};
  const order = [];
  list(plan.leaves).forEach(function (leaf) {
    if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'openalex') return;
    list(leaf.queries).forEach(function (q) {
      if (!isObj(q) || (q.round !== undefined && q.round !== 1)) return;
      const key = String(q.q_hash);
      if (!byHash[key]) {
        byHash[key] = { query: q, leaf_ids: [], leaf: leaf };
        order.push(key);
      }
      if (byHash[key].leaf_ids.indexOf(leaf.id) === -1) byHash[key].leaf_ids.push(leaf.id);
    });
  });
  return order.map(function (k) { return byHash[k]; });
}

function approvedKnown(grant) {
  const known = {};
  list(grant && grant.approved_terms).forEach(function (e) {
    known[normTerm(e.term)] = true;
    list(e.synonyms).forEach(function (s) { known[normTerm(s)] = true; });
  });
  return known;
}

function termsForProposal(plan) {
  const map = {};
  const order = [];
  list(plan.leaves).forEach(function (leaf) {
    const s = isObj(leaf && leaf.slots) ? leaf.slots : {};
    if (!nonEmpty(s.term)) return;
    const key = normTerm(s.term);
    if (!map[key]) { map[key] = { term: s.term.trim(), synonyms: [] }; order.push(key); }
    list(s.synonyms).filter(nonEmpty).forEach(function (x) {
      if (map[key].synonyms.indexOf(x.trim()) === -1) map[key].synonyms.push(x.trim());
    });
  });
  // SEED-104: every other slot term the plan will send (term2, cause, effect,
  // limiter, technology) joins the proposal, so one approval covers the whole plan.
  const known = {};
  order.forEach(function (k) {
    known[k] = true;
    map[k].synonyms.forEach(function (x) { known[normTerm(x)] = true; });
  });
  collectFetchQueries(plan).forEach(function (entry) {
    slotTermsOf(entry).forEach(function (t) {
      const key = normTerm(t);
      if (known[key]) return;
      known[key] = true;
      map[key] = { term: t.trim(), synonyms: [] };
      order.push(key);
    });
  });
  return order.map(function (k) { return map[k]; });
}

// proseTermIn(entries) -> true when any slot term of a fetch entry is not a
// composable web-line phrase (SEED-104 part 2, moved by SEED-115 on 2026-10-04: the
// fetch entries are all web-line queries, so the web rule applies; a room phrase or
// question passes, an empty, over-cap or control-character slot is still refused).
function proseTermIn(entries) {
  return list(entries).some(function (entry) {
    return slotTermsOf(entry).some(function (t) { return families.composableQuery(t) === null; });
  });
}

// queriesOf(plan) -> the exact composed string of every fetch query in the plan, in plan
// order. The run card lists them all, so the navigator approves the run once, seeing
// everything that will leave (369.2 R02, ruling 2026-10-05; was phraseQueriesOf, which
// listed the strings only when a slot was phrase-shaped).
function queriesOf(plan) {
  return collectFetchQueries(plan).map(function (e) { return e.query.q; });
}

// scopeStuck(grant, card, verdict) -> true when the active standing grant already
// holds every family, provider and term the reask card would approve, so asking
// again cannot change the verdict (SEED-104 part 3). Time heals a throttle, so
// throttle_exceeded is never stuck.
function scopeStuck(grant, card, verdict) {
  if (!grant || grant.lifetime !== 'standing') return false;
  if (!card || !card.proposal || card.proposal.lifetime !== 'standing') return false;
  if (verdict.reason === 'throttle_exceeded') return false;
  const gain = grants.scopeGain(grant, card.proposal, card.new_terms);
  return gain.families.length === 0 && gain.providers.length === 0 && gain.terms.length === 0;
}

// stuckInfo(entries, grant, reason, index) -> the typed fields of the loop guard.
function stuckInfo(entries, grant, reason, index) {
  const planFams = [];
  entries.forEach(function (e) {
    if (e.query && typeof e.query.family === 'string' && planFams.indexOf(e.query.family) === -1) planFams.push(e.query.family);
  });
  return { reask_reason: reason, query_index: index, plan_families: planFams, grant_families: list(grant.families).slice() };
}

function reaskCard(roomDir, plan, grant, reason, now) {
  // 369.2 R02 (ruling 2026-10-05, A5): the web lines carry one run grant per run on a card that
  // lists every exact string; a standing grant never covers a web send, so the per-term
  // new_term loop is retired here. A plan with theo leaves is the same run grant (366-15, D-09);
  // the card then names Theo and gives the pair count.
  const theoPairs = theoLane.theoLeavesOf(plan).map(function (l) { return grants.theoPairQ(l.slots.term, l.slots.term2); });
  const proposal = grants.buildRunGrant(plan);
  proposal.room_id = grants.roomIdFor(roomDir);
  const cardOpts = { newTerms: [], now: now, queries: queriesOf(plan), job: grants.jobOf(plan) };
  if (theoPairs.length > 0 && Array.isArray(proposal.providers) && proposal.providers.indexOf(grants.THEO_PROVIDER) !== -1) cardOpts.theoPairs = theoPairs;
  return { proposal: proposal, new_terms: [], card: grants.grantCard(proposal, cardOpts) };
}

function slotTermsOf(entry) {
  const q = entry.query;
  if (Array.isArray(q.slot_terms)) return q.slot_terms.filter(nonEmpty);
  // A plan without slot_terms cannot skip the new-term ask: read the leaf slots.
  return leafTerms(entry.leaf);
}

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------
function withDeadline(promise, ms) {
  return new Promise(function (resolve) {
    const t = setTimeout(function () { resolve({ timedOut: true }); }, Math.max(0, ms));
    promise.then(function (value) { clearTimeout(t); resolve({ value: value }); }, function (error) { clearTimeout(t); resolve({ error: error }); });
  });
}

function metaOf(res) {
  const m = (res && isObj(res.meta)) ? res.meta : ((res && res.envelope && isObj(res.envelope.meta)) ? res.envelope.meta : null);
  return m;
}

function hasCount(meta) { return isObj(meta) && num(meta.count); }

function classify(res) {
  // -> { outcome, failure_class, count, cost_usd, remaining_usd, x_query, cache_hit, items }
  const meta = metaOf(res);
  const env = res && res.envelope;
  const cacheHit = !!res && res.reason === 'cache_hit';
  const out = {
    outcome: 'failed',
    failure_class: null,
    count: hasCount(meta) ? meta.count : null,
    cost_usd: meta && num(meta.cost_usd) ? meta.cost_usd : null,
    remaining_usd: meta && num(meta.remaining_usd) ? meta.remaining_usd : null,
    x_query: meta && typeof meta.x_query === 'string' ? meta.x_query : null,
    cache_hit: cacheHit,
    items: [],
    budget_stop: false,
  };
  if (!res || res.status === 'error' || res.status === 'skipped') {
    const status = env && env.status;
    out.outcome = status === 'blocked' ? 'blocked' : 'failed';
    out.failure_class = (env && typeof env.failure_class === 'string' && env.failure_class) || 'unknown_error';
    if (out.outcome === 'blocked' || out.failure_class === 'spend_limit_exceeded') out.budget_stop = true;
    if (env && (/budget_exhausted/.test(String(env.error || '')) || (isObj(env.payload) && env.payload.reason === 'budget_exhausted'))) out.budget_stop = true;
    if (meta && num(meta.remaining_usd) && meta.remaining_usd <= 0) out.budget_stop = true;
    return out;
  }
  out.items = list(res.items).slice(0, QUICK_TOP_ROWS);
  if (cacheHit) {
    out.outcome = 'cache_hit';
    out.cost_usd = 0;
  } else {
    out.outcome = (env && env.status === 'empty_valid') || out.items.length === 0 ? 'empty_valid' : 'ok';
  }
  return out;
}

// ---------------------------------------------------------------------------
// runQuick
// ---------------------------------------------------------------------------
function refused(reason, extra) {
  return Object.assign({ status: 'refused', reason: reason }, extra || {});
}

function rowsLane(plan) {
  return plan && plan.origin && plan.origin.template_id === 'whitespace' ? 'WS' : 'Q';
}

// Deterministic rows for the no-model path. The gap leaf and generic leaves
// read the leaf term as context; the covered-elsewhere leaf reads each
// synonym as support (a record found under another wording).
function deterministicRowsFor(plan, itemsByLeaf, lane) {
  const rows = [];
  const seen = {};
  function push(raw) {
    const key = raw.leaf_id + '|' + raw.record_id + '|' + raw.label;
    if (seen[key]) return;
    seen[key] = true;
    rows.push(raw);
  }
  list(plan.leaves).forEach(function (leaf) {
    if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'openalex') return;
    const items = itemsByLeaf[leaf.id] || [];
    const slots = isObj(leaf.slots) ? leaf.slots : {};
    if (leaf.dimension === 'ws:covered_elsewhere') {
      list(slots.synonyms).filter(nonEmpty).forEach(function (syn) {
        evidenceRows.deterministicTermRows(items, syn, { leafId: leaf.id, lane: lane, label: 'supports' }).forEach(push);
      });
    } else if (nonEmpty(slots.term)) {
      evidenceRows.deterministicTermRows(items, slots.term, { leafId: leaf.id, lane: lane, label: 'context' }).forEach(push);
    }
  });
  return rows;
}

// checkTheoLeaf(leaf, grant, roomId, nowMs, calls) -> grants.validateTheoCall for one theo
// leaf: the one place the facade (coverFor) and the run (runQuick) decide Theo cover.
function checkTheoLeaf(leaf, grant, roomId, nowMs, calls) {
  const sl = grants.theoLeafSlots(leaf);
  return grants.validateTheoCall(
    { pair_hash: families.qHash(grants.theoPairQ(sl.term, sl.term2)), slot_terms: [sl.term, sl.term2] },
    grant,
    { room_id: roomId, now: nowMs, calls_used: calls });
}

// theoVerdict(lane, theoLeaves) -> the quick verdict of a plan with no OpenAlex search:
// settled when any lateral path was found, thin when Theo answered for every checked pair
// and none had a path, unresolved when a check failed, was skipped or never ran.
function theoVerdict(lane, theoLeaves) {
  const checks = lane ? list(lane.checks) : [];
  const found = checks.filter(function (c) { return c.outcome === 'ok'; }).length;
  const failed = checks.filter(function (c) { return c.outcome === 'failed' || c.outcome === 'skipped'; }).length;
  const reasons = [];
  let verdict;
  if (found > 0) { verdict = 'settled'; reasons.push('lateral_path_found:' + found); }
  else if (checks.length > 0 && failed === 0 && checks.length === theoLeaves.length) { verdict = 'thin'; reasons.push('no_lateral_path_found'); }
  else { verdict = 'unresolved'; reasons.push('lateral_check_incomplete'); }
  const line = verdict === 'settled'
    ? 'A documented lateral path turned up for ' + found + ' of ' + theoLeaves.length + ' canon framework pair' + (theoLeaves.length === 1 ? '' : 's') + ' checked with Theo.'
    : (verdict === 'thin'
      ? 'No documented lateral path turned up for the ' + theoLeaves.length + ' canon framework pair' + (theoLeaves.length === 1 ? '' : 's') + ' checked with Theo.'
      : 'This could not be answered: a lateral-path check failed, was skipped, or was not run, so nothing is concluded.');
  return { vr: { verdict: verdict, plurality_ran: false, primary_count: null, cover_count: null, floor: verdictMod.GAP_COUNT_FLOOR, reasons: reasons }, line: line };
}

// egressOff(policy, entries, theoLeaves) -> the name of what stops this run from sending anything,
// or null (366-17, ADR-E16; web lines freed 2026-10-05, 369.2-05). 'offline' when --offline is on
// and there is anything to send: the flag is read directly, because the web searches have no
// policy line any more. Otherwise a plan with nothing but Theo leaves needs the theo line. Where
// web searches run and only the theo line is off, the run goes ahead and the lane reports the off
// line leaf by leaf.
function egressOff(policy, entries, theoLeaves) {
  if ((entries.length > 0 || theoLeaves.length > 0) && policy.offline === true) return 'offline';
  if (entries.length === 0 && theoLeaves.length > 0 && !egressPolicy.lineAllowed(policy, 'theo')) return 'theo';
  return null;
}

// planOnly(plan, line, policy) -> the outcome of a run whose egress line is off: the plan card is
// intact, nothing was sent, no run state or audit row is written. This is a fourth runQuick status
// beside done, reask and refused (reask asks for a grant; here a grant would change nothing).
function planOnly(plan, line, policy) {
  const isOffline = line === 'offline';
  return {
    status: 'plan_only',
    reason: isOffline ? 'offline' : 'egress_line_off',
    line: line,
    offline: policy.offline === true,
    sent: false,
    outcome: 'plan_only_not_sent',
    run_id: plan.run_id,
    answer_line: isOffline
      ? 'Plan only, nothing sent: offline mode is on. The plan is intact; run it again without offline to search.'
      : 'Plan only, nothing sent: the Theo line is off for this room. The plan is intact.',
    card: planMod.planReviewCard(plan),
    ignored: policy.ignored.slice(),
  };
}

// coverFor(roomDir, plan, opts) -> the same pre-pass runQuick runs before any
// fetch, without fetching or writing anything (363-15 facade: "is this plan
// ready to run bare, or does it need a grant card first"). One place decides
// grant cover, so the facade and the run can never disagree.
//   { covered:true, grant }
//   { covered:false, reason, query_index?, card?, proposal?, new_terms? }
function coverFor(roomDir, plan, opts) {
  const o = isObj(opts) ? opts : {};
  const nowMs = num(o.now) ? o.now : Date.now();
  const trigger = o.trigger === 'ambient' ? 'ambient' : 'navigator';
  if (!isObj(plan) || !planMod.validatePlan(plan).ok) return { covered: false, reason: 'plan_invalid' };
  const entries = collectFetchQueries(plan);
  const theoLeaves = theoLane.theoLeavesOf(plan);
  if (entries.length === 0 && theoLeaves.length === 0) return { covered: false, reason: 'no_fetch_queries' };
  if (entries.length > QUICK_MAX_QUERIES) return { covered: false, reason: 'cap_exceeded' };
  if (proseTermIn(entries)) return { covered: false, reason: 'term_not_composed' };
  // 366-17: a line that is off is decided before any grant question; a grant would change nothing
  const offLine = egressOff(egressPolicy.loadEgressPolicy(roomDir, { offline: o.offline === true }), entries, theoLeaves);
  if (offLine) return { covered: false, reason: offLine === 'offline' ? 'offline' : 'egress_line_off', line: offLine };
  const grant = grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'run', run_id: plan.run_id })
    || grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'standing' });
  const runsInWindow = trigger === 'ambient' ? grants.throttleState(roomDir, { now: nowMs }).count : 0;
  const roomId = grants.roomIdFor(roomDir);
  for (let i = 0; i < entries.length; i += 1) {
    const q = entries[i].query;
    const verdict = grants.validateExecutedQuery({
      q: q.q,
      q_hash: q.q_hash,
      template_id: q.template_id,
      family: q.family,
      provider: PROVIDER,
      audit: q.audit,
      slot_terms: slotTermsOf(entries[i]),
      round: 1,
      trigger: trigger,
    }, grant, { room_id: roomId, now: nowMs, searches_used: i, round: 1, runs_in_window: runsInWindow });
    if (!verdict.ok) {
      const card = reaskCard(roomDir, plan, grant, verdict.reason, nowMs);
      if (scopeStuck(grant, card, verdict)) {
        return Object.assign({ covered: false, reason: 'grant_scope_cannot_cover_plan' }, stuckInfo(entries, grant, verdict.reason, i));
      }
      return { covered: false, reason: verdict.reason, query_index: i, card: card.card, proposal: card.proposal, new_terms: card.new_terms };
    }
  }
  // 366-15: the Theo lane is covered by the same grant or not at all (same check as the run)
  // (a theo line that is off sends nothing, so it needs no grant cover: the lane reports the off line)
  const theoCovered = egressPolicy.lineAllowed(egressPolicy.loadEgressPolicy(roomDir, { offline: o.offline === true }), 'theo');
  for (let i = 0; theoCovered && i < theoLeaves.length; i += 1) {
    const verdict = checkTheoLeaf(theoLeaves[i], grant, roomId, nowMs, i);
    if (!verdict.ok) {
      const card = reaskCard(roomDir, plan, grant, verdict.reason, nowMs);
      return { covered: false, reason: verdict.reason, query_index: i, lane: 'theo', card: card.card, proposal: card.proposal, new_terms: card.new_terms };
    }
  }
  return { covered: true, grant: grant };
}

async function runQuick(roomDir, plan, opts) {
  const o = isObj(opts) ? opts : {};
  const startMs = Date.now();
  const nowMs = num(o.now) ? o.now : startMs;
  const trigger = o.trigger === 'ambient' ? 'ambient' : 'navigator';

  // 1. the plan must be sound
  const shape = planMod.validatePlan(plan);
  if (!shape.ok) return refused('plan_invalid', { errors: shape.errors });
  if (plan.mode !== 'quick') return refused('not_quick');
  if (plan.status !== 'ready') return refused('plan_' + plan.status);
  const pyr = pyramidMod.checkPyramid(plan.pyramid, plan.leaves, {});
  if (pyr.status !== 'ready') return refused('pyramid_' + pyr.status, { errors: pyr.errors });

  const entries = collectFetchQueries(plan);
  const theoLeaves = theoLane.theoLeavesOf(plan);
  if (entries.length === 0 && theoLeaves.length === 0) return refused('no_fetch_queries');
  if (entries.length > QUICK_MAX_QUERIES) return refused('cap_exceeded', { cap: QUICK_MAX_QUERIES });
  for (let i = 0; i < entries.length; i += 1) {
    const q = entries[i].query;
    if (typeof q.q !== 'string' || families.qHash(q.q) !== q.q_hash) return refused('q_hash_mismatch');
  }
  if (proseTermIn(entries)) return refused('term_not_composed');

  const budgetMs = num(o.budgetMs) && o.budgetMs > 0 ? o.budgetMs : Math.min(plan.budget.time_budget_ms || QUICK_TIME_BUDGET_MS, QUICK_TIME_BUDGET_MS);

  // 1b. the declared egress policy (366-17, ADR-E16): loaded once per run, checked before the grant
  // and before any fetch. A line that is off means plan only, not sent; --offline turns every line off.
  const policy = egressPolicy.loadEgressPolicy(roomDir, { offline: o.offline === true });
  const offLine = egressOff(policy, entries, theoLeaves);
  if (offLine) return planOnly(plan, offLine, policy);

  // 2. grant check for EVERY search before any fetch
  const grant = o.grant || grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'run', run_id: plan.run_id })
    || grants.findActiveGrant(roomDir, { now: nowMs, lifetime: 'standing' });
  const runsInWindow = trigger === 'ambient' ? grants.throttleState(roomDir, { now: nowMs }).count : 0;
  const roomId = grants.roomIdFor(roomDir);

  function checkQuery(entry, index) {
    const q = entry.query;
    return grants.validateExecutedQuery({
      q: q.q,
      q_hash: q.q_hash,
      template_id: q.template_id,
      family: q.family,
      provider: PROVIDER,
      audit: q.audit,
      slot_terms: slotTermsOf(entry),
      round: 1,
      trigger: trigger,
    }, grant, { room_id: roomId, now: nowMs, searches_used: index, round: 1, runs_in_window: runsInWindow });
  }

  for (let i = 0; i < entries.length; i += 1) {
    const verdict = checkQuery(entries[i], i);
    if (!verdict.ok) {
      const card = reaskCard(roomDir, plan, grant, verdict.reason, nowMs);
      if (scopeStuck(grant, card, verdict)) {
        return refused('grant_scope_cannot_cover_plan', stuckInfo(entries, grant, verdict.reason, i));
      }
      return { status: 'reask', reason: verdict.reason, query_index: i, card: card.card, proposal: card.proposal, new_terms: card.new_terms };
    }
  }
  // 366-15: every theo leaf is checked against the same grant before anything leaves
  const theoOn = egressPolicy.lineAllowed(policy, 'theo');
  for (let i = 0; theoOn && i < theoLeaves.length; i += 1) {
    const verdict = checkTheoLeaf(theoLeaves[i], grant, roomId, nowMs, i);
    if (!verdict.ok) {
      const card = reaskCard(roomDir, plan, grant, verdict.reason, nowMs);
      return { status: 'reask', reason: verdict.reason, query_index: i, lane: 'theo', card: card.card, proposal: card.proposal, new_terms: card.new_terms };
    }
  }

  // 3. fetch cache-first, audit every executed search
  const inner = typeof o.fetchEnvelopeFn === 'function' ? o.fetchEnvelopeFn : corpus.fetchCorpusEnvelope;
  const envelopeFn = function (args) {
    return inner({ source: PROVIDER, query: args.query, limit: QUICK_TOP_ROWS });
  };

  const runQueries = [];
  const records = [];
  const itemsByLeaf = {};
  const allItems = [];
  const seenIds = {};
  let stopReason = 'pass_complete';
  let auditFailure = null;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const q = entry.query;
    const elapsed = Date.now() - startMs;
    if (elapsed >= budgetMs) { stopReason = 'time'; break; }
    const recheck = checkQuery(entry, i);
    if (!recheck.ok) { stopReason = 'reask'; break; }

    let cacheRoom = roomDir;
    let restock = false;
    try {
      const cached = researchCache.getCachedEntry(roomDir, SOURCE_ID, q.q);
      // A pre-363 cache entry carries no count: treat it as a miss (never a zero).
      if (cached && !hasCount(cached.meta)) { cacheRoom = ''; restock = true; }
    } catch (_e) { /* cache read failure falls through to a live fetch */ }

    const t0 = Date.now();
    const waited = await withDeadline(sourceLensDriver.fetchSourceCached(SOURCE_ID, q.q, cacheRoom, envelopeFn), budgetMs - elapsed);
    const latency = Date.now() - t0;

    let info;
    if (waited.timedOut) {
      info = { outcome: 'failed', failure_class: 'network_timeout', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
      stopReason = 'time';
    } else if (waited.error) {
      info = { outcome: 'failed', failure_class: 'unknown_error', count: null, cost_usd: null, remaining_usd: null, x_query: null, cache_hit: false, items: [], budget_stop: false };
    } else {
      info = classify(waited.value);
      if (restock && (info.outcome === 'ok' || info.outcome === 'empty_valid')) {
        try { researchCache.putCached(roomDir, SOURCE_ID, q.q, info.items, { meta: metaOf(waited.value) }); } catch (_e) { /* ignore */ }
      }
      if (info.budget_stop) stopReason = 'budget';
    }

    const itemList = info.items;
    const hashes = itemList.map(function (it) { return evidenceRows.contentHash(it); });
    const audit = auditLedger.appendAudit(roomDir, {
      ts: iso(Date.now()),
      run_id: plan.run_id,
      grant_id: String(grant.grant_id),
      grant_version: grant.version,
      q: q.q,
      q_hash: q.q_hash,
      template_id: q.template_id,
      family: q.family,
      part8_verdict: q.audit === 'pass' ? 'pass' : (q.audit === 'not_applicable' ? 'not_applicable' : 'tripped'),
      provider: PROVIDER,
      filters: {},
      pagination: { per_page: QUICK_TOP_ROWS, page: 1 },
      fallback_used: false,
      origin_ref: plan.run_id + '/' + entry.leaf_ids.join('+'),
      result_ids: itemList.map(function (it) { return String(it.id); }),
      content_hashes: hashes,
      outcome: info.outcome,
      failure_class: info.outcome === 'failed' || info.outcome === 'blocked' ? (info.failure_class || 'unknown_error') : null,
      count: info.count,
      cost_usd: info.cost_usd,
      remaining_usd: info.remaining_usd,
      x_query: info.x_query,
      latency_ms: latency,
    }, { policy: policy });
    if (!audit.ok) { auditFailure = audit.reason; break; }

    runQueries.push({
      leaf_id: entry.leaf_ids[0],
      leaf_ids: entry.leaf_ids.slice(),
      template_id: q.template_id,
      family: q.family,
      role: q.role || null,
      q: q.q,
      q_hash: q.q_hash,
      round: 1,
      outcome: info.outcome,
      failure_class: info.outcome === 'failed' || info.outcome === 'blocked' ? (info.failure_class || 'unknown_error') : null,
      count: info.count,
      cost_usd: info.cost_usd,
      latency_ms: latency,
      cache_hit: info.cache_hit,
      result_count: itemList.length,
    });

    itemList.forEach(function (it, idx) {
      records.push(Object.assign({}, it, { record_id: String(it.id), content_hash: hashes[idx], q_hash: q.q_hash, leaf_ids: entry.leaf_ids.slice() }));
      entry.leaf_ids.forEach(function (lid) {
        if (!itemsByLeaf[lid]) itemsByLeaf[lid] = [];
        itemsByLeaf[lid].push(it);
      });
      if (!seenIds[String(it.id)]) { seenIds[String(it.id)] = true; allItems.push(it); }
    });

    if (stopReason === 'budget' || stopReason === 'time') break;
  }

  if (auditFailure) return refused('audit_write_failed', { detail: auditFailure });

  // 3b. the Theo lateral-path lane (366-15): same grant, same run, after the OpenAlex searches.
  // A lane failure is recorded, never thrown; a time or budget stop above skips it.
  let theoRun = null;
  if (theoLeaves.length > 0 && stopReason === 'pass_complete') {
    try {
      theoRun = await theoLane.runTheoLane(roomDir, { run_id: plan.run_id, grant: grant, now: nowMs, deadlineMs: startMs + budgetMs, policy: policy }, plan, { callTool: o.callTool });
    } catch (_e) {
      theoRun = { calls: 0, skipped: 0, reask_reason: null, audit_failure: null, stop_reason: 'lane_failed', verdictByLeaf: {}, checks: [], lane_file: null };
    }
    if (theoRun.audit_failure) return refused('audit_write_failed', { detail: theoRun.audit_failure });
    if (theoRun.stop_reason === 'reask' || theoRun.stop_reason === 'time') stopReason = theoRun.stop_reason;
  }

  // 4. local room check (fs only)
  const terms = planTerms(plan);
  const localChecks = [];
  list(plan.leaves).forEach(function (leaf) {
    if (!isObj(leaf) || leaf.researchable !== true || leaf.corpus !== 'room') return;
    const check = localRoomCheck(roomDir, terms);
    localChecks.push({
      leaf_id: leaf.id,
      kind: leaf.dimension === 'ws:extraction_failure' ? 'extraction_failure' : 'room_check',
      terms_checked: check.terms_checked,
      artifact_count: check.artifact_count,
      flagged: check.flagged,
      artifacts: check.artifacts,
    });
  });

  // 5. rows, validated against the fetched records
  const leafIds = list(plan.leaves).filter(function (l) { return l && l.researchable === true; }).map(function (l) { return l.id; });
  const lane = rowsLane(plan);
  const index = evidenceRows.recordsIndex(allItems);
  let rawRows = [];
  let providerFailed = false;
  if (typeof o.rowsProvider === 'function' && allItems.length + entries.length > 0) {
    try {
      const got = await o.rowsProvider({ records: allItems.slice(), leaves: clone(plan.leaves), queries: clone(runQueries), plan: plan });
      rawRows = Array.isArray(got) ? got : [];
    } catch (_e) { providerFailed = true; rawRows = []; }
  } else {
    rawRows = deterministicRowsFor(plan, itemsByLeaf, lane);
  }
  const validated = evidenceRows.validateRows(rawRows, index, { leafIds: leafIds, lane: lane, retrievedAt: iso(nowMs) });
  const rows = validated.rows;
  const dropped = Object.assign({}, validated.dropped);
  if (providerFailed) dropped.rows_provider_failed = 1;

  // 6. verdict, roll-up, opportunities
  const planned = entries.map(function (e) {
    return { leaf_id: e.leaf_ids[0], template_id: e.query.template_id, role: e.query.role || null };
  });
  const isWhitespace = plan.origin.template_id === 'whitespace';
  let vr = verdictMod.computeQuickVerdict({
    queries: runQueries,
    planned: planned,
    rows: rows,
    leaves: plan.leaves,
    template: plan.pyramid.template_id,
  });
  // a plan with no OpenAlex search is answered by its lateral-path checks alone
  const theoOnly = entries.length === 0 && theoLeaves.length > 0;
  let theoLine = null;
  if (theoOnly) {
    const tv = theoVerdict(theoRun, theoLeaves);
    vr = tv.vr;
    theoLine = tv.line;
  }
  const verdictByLeaf = {};
  if (isWhitespace) {
    list(plan.leaves).forEach(function (leaf) {
      if (!leaf || leaf.researchable !== true) return;
      if (vr.verdict === 'unresolved') verdictByLeaf[leaf.id] = 'unresolved';
      else if (vr.verdict === 'gap-confirmed' && (leaf.dimension === 'ws:gap_claim' || leaf.dimension === 'ws:covered_elsewhere')) verdictByLeaf[leaf.id] = 'gap-confirmed';
      else if (vr.verdict === 'gap-confirmed' && leaf.corpus === 'room') {
        const lc = localChecks.filter(function (c) { return c.leaf_id === leaf.id; })[0];
        if (lc && lc.flagged === false) verdictByLeaf[leaf.id] = 'settled';
      }
    });
  }
  if (theoRun) Object.assign(verdictByLeaf, theoRun.verdictByLeaf);
  const rolled = pyramidMod.rollUp(plan.pyramid, plan.leaves, rows, { verdictByLeaf: verdictByLeaf });
  let governing = rolled.governing_status;
  if (isWhitespace) {
    // The gap tree reads support as "covered", so the governing thought (the
    // gap is real) follows the computed verdict, not the raw roll-up.
    const byVerdict = { 'gap-confirmed': 'strengthened', settled: 'weakened', contested: 'split', thin: 'unresolved', unresolved: 'unresolved' };
    governing = byVerdict[vr.verdict] || governing;
    rolled.pyramid.governing_status = governing;
  }
  const opportunities = pyramidMod.opportunityCandidates(rolled.pyramid, rolled.leaves, rows, { verdict: vr.verdict, perspective: plan.perspective });
  const answer = theoLine !== null ? theoLine : verdictMod.answerLine(vr, { rows: rows });
  const offer = theoOnly ? null : (vr.verdict === 'thin' || vr.verdict === 'contested')
    ? (list(plan.perspective && plan.perspective.limiters).length > 0
      ? { text: DEEP_OFFER_TEXT, kind: 'deep_seed', plan_hash: planMod.planHash(plan) }
      : { text: NEEDS_LIMITER_OFFER_TEXT, kind: 'needs_limiter', plan_hash: planMod.planHash(plan) })
    : null;

  const finishedMs = startMs + (Date.now() - startMs);
  const relDir = path.join(STATE_DIR, plan.run_id);
  const run = {
    schema: planMod.RUN_SCHEMA,
    run_id: plan.run_id,
    mode: 'quick',
    plan_hash: planMod.planHash(plan),
    grant_ref: { grant_id: grant.grant_id, lifetime: grant.lifetime, version: grant.version },
    trigger: trigger,
    started_at: iso(startMs),
    finished_at: iso(finishedMs),
    stop_reason: stopReason,
    queries: runQueries,
    records_path: path.join(relDir, 'records.json').split(path.sep).join('/'),
    rows: rows,
    dropped: dropped,
    leaves: rolled.leaves,
    verdict: vr.verdict,
    verdict_detail: { plurality_ran: vr.plurality_ran, primary_count: vr.primary_count, cover_count: vr.cover_count, floor: vr.floor, reasons: vr.reasons },
    answer_line: answer,
    pyramid: rolled.pyramid,
    perspective: plan.perspective,
    governing_status: governing,
    unresolved_branches: rolled.unresolved_branches,
    opportunity_candidates: opportunities,
    contradictions: rolled.contradictions,
    escalation_offer: offer,
    local_checks: localChecks,
    timings: {
      total_ms: finishedMs - startMs,
      budget_ms: budgetMs,
      per_query: runQueries.map(function (q) { return { q_hash: q.q_hash, latency_ms: q.latency_ms }; }),
      not_run: planned.filter(function (p, i) { return !runQueries.some(function (r) { return r.q_hash === entries[i].query.q_hash; }); })
        .map(function (p) { return p.template_id; }),
    },
    filed: false,
  };
  if (theoLeaves.length > 0) {
    run.theo_checks = theoRun ? theoRun.checks.map(function (c) { return Object.assign({}, c); }) : [];
    run.theo_lane = { calls: theoRun ? theoRun.calls : 0, skipped: theoRun ? theoRun.skipped : 0, lane_file: theoRun ? theoRun.lane_file : null, reask_reason: theoRun ? theoRun.reask_reason : null };
  }
  const valid = planMod.validateRunResult(run);
  if (!valid.ok) return refused('run_result_invalid', { errors: valid.errors });

  const card = evidenceCard(run, plan);

  // 7. run state, atomic
  const dir = path.join(roomDir, relDir);
  try {
    atomicWriteJson(path.join(dir, 'plan.json'), plan);
    atomicWriteJson(path.join(dir, 'records.json'), { schema: 'mos.research-records/1', run_id: plan.run_id, records: records });
    atomicWriteJson(path.join(dir, 'rows.json'), { schema: 'mos.research-rows/1', run_id: plan.run_id, rows: rows, dropped: dropped });
    atomicWriteJson(path.join(dir, 'run.json'), run);
    atomicWriteJson(path.join(dir, 'card.json'), card);
  } catch (e) {
    return refused('state_write_failed', { detail: String((e && e.message) || e) });
  }

  // Navigator-started runs are recorded here; an ambient caller records at
  // start (throttle contract of 363-09), so it is never counted twice.
  const record = o.recordInLedger === undefined ? trigger === 'navigator' : o.recordInLedger === true;
  if (record) {
    try { grants.recordRun(roomDir, { run_id: plan.run_id, mode: 'quick', trigger: trigger, delta_hash: null, now: nowMs }); } catch (_e) { /* ledger failure never blocks the card */ }
  }

  // ruling 2026-10-05: the approval is named by its job, never by the word grant
  return { status: 'done', run: run, card: card, state_dir: relDir.split(path.sep).join('/'), approval_line: grants.approvedLine(runQueries.length, grants.jobOf(plan)) };
}

// ---------------------------------------------------------------------------
// evidenceCard
// ---------------------------------------------------------------------------
function evidenceCard(run, plan) {
  const r = isObj(run) ? run : {};
  const p = isObj(plan) ? plan : null;
  const lines = [];
  lines.push('## Evidence from this quick research run');
  lines.push('');
  const question = p && p.pyramid ? p.pyramid.stated_question : (r.pyramid && r.pyramid.stated_question) || '';
  if (nonEmpty(question)) lines.push('Question: ' + oneLine(question));
  lines.push('Answer: ' + oneLine(r.answer_line));
  lines.push('Governing thought: ' + oneLine(r.governing_status || 'unresolved'));
  if (r.stop_reason && r.stop_reason !== 'pass_complete') {
    lines.push('The run stopped early (' + oneLine(r.stop_reason) + '); searches not run are not counted as findings.');
  }
  lines.push('');

  lines.push('### What the searches found');
  list(r.queries).forEach(function (q) {
    const count = num(q.count) ? String(q.count) : 'not reported';
    const how = q.outcome === 'cache_hit' ? 'from the local cache' : q.outcome;
    const fail = q.failure_class ? ', ' + q.failure_class : '';
    lines.push('- ' + evidenceRowsLabel(q) + ': OpenAlex exact-phrase count ' + count + ' (' + how + fail + '; searched ' + oneLine(q.q) + ')');
  });
  if (list(r.queries).length === 0) lines.push(list(r.theo_checks).length > 0 ? '- No OpenAlex search was part of this run.' : '- No search ran.');
  lines.push('');

  const lateral = list(r.theo_checks);
  if (lateral.length > 0) {
    lines.push('### Lateral-path checks with Theo');
    lateral.forEach(function (c) {
      if (c.outcome === 'skipped' && c.reason === 'egress_line_off') { lines.push('- ' + oneLine(c.leaf_id) + ': skipped, the Theo egress line is off, so nothing was sent'); return; }
      if (c.outcome === 'skipped') { lines.push('- ' + oneLine(c.leaf_id) + ': skipped, a term was not a canon framework name, so nothing was sent'); return; }
      const pair = oneLine(c.canon_a) + ' and ' + oneLine(c.canon_b);
      if (c.outcome === 'ok') lines.push('- ' + pair + ': a lateral path was found (' + oneLine(c.verification) + (num(c.hops) ? ', ' + c.hops + ' hop' + (c.hops === 1 ? '' : 's') : '') + ')');
      else if (c.outcome === 'empty_valid') lines.push('- ' + pair + ': no lateral path was found (' + oneLine(String(c.reason || 'no path').replace(/_/g, ' ')) + ')');
      else lines.push('- ' + pair + ': could not be checked (' + oneLine(String(c.reason || 'unknown error').replace(/_/g, ' ')) + '); this is not a finding');
    });
    lines.push('Only the two canon framework names were sent for each check; no room text left the room.');
    lines.push('');
  }

  const rows = list(r.rows);
  lines.push('### Rows (' + rows.length + ')');
  if (rows.length === 0) lines.push('- No validated row bears on the question.');
  rows.forEach(function (row) {
    const cite = evidenceRows.renderRowCitation(row, { withQuote: true });
    const short = typeof row.content_hash === 'string' ? row.content_hash.slice(0, 15) : '';
    lines.push('- ' + cite + ' ' + oneLine(row.label) + ' for ' + oneLine(row.leaf_id) + ': ' + oneLine(row.source_title) + ' (' + oneLine(row.source_url) + ', record hash ' + short + ', retrieved ' + oneLine(String(row.retrieved_at).slice(0, 10)) + ')');
  });
  const droppedTotal = Object.keys(isObj(r.dropped) ? r.dropped : {}).reduce(function (n, k) { return n + (num(r.dropped[k]) ? r.dropped[k] : 0); }, 0);
  if (droppedTotal > 0) {
    lines.push('- ' + droppedTotal + ' proposed row' + (droppedTotal === 1 ? ' was' : 's were') + ' dropped because it did not check against the fetched record; a fully dropped set is not the same as no hits.');
  }
  if (rows.some(function (x) { return x.flags && x.flags.retracted; }) || (isObj(r.dropped) && r.dropped.retracted_support > 0)) {
    lines.push('- A retracted work turned up; it is shown as context only and never as support.');
  }
  lines.push('');

  const opps = list(r.opportunity_candidates);
  if (opps.length > 0) {
    lines.push('### Opportunity candidates');
    opps.forEach(function (c) { lines.push('- ' + oneLine(c.kind) + ': ' + oneLine(c.reason)); });
    lines.push('');
  }

  const checks = list(r.local_checks);
  if (checks.length > 0) {
    lines.push('### Checked in this room only');
    checks.forEach(function (c) {
      lines.push('- ' + oneLine(c.kind) + ' (' + oneLine(c.leaf_id) + '): ' + c.artifact_count + ' room artifact' + (c.artifact_count === 1 ? '' : 's') + ' already mention the zone' + (c.flagged ? ' in other words or the same words; the gap may be an extraction failure' : '') + '. Nothing was sent for this check.');
    });
    lines.push('');
  }

  lines.push('### What happens next');
  lines.push('Nothing has been filed. Filing is its own yes or no and it comes next only if you ask for it.');
  const offer = isObj(r.escalation_offer) ? r.escalation_offer : null;
  if (offer) {
    lines.push('');
    lines.push(offer.kind === 'needs_limiter'
      ? 'Evidence is thin or split here. Name what blocks this and I\'ll plan a deep run.'
      : 'Evidence is thin or split here. Run deep on this?');
  }

  const options = [{ id: 'review_filing', label: 'Review what to file (nothing is filed yet)', recommended: true }];
  if (offer) options.push(offer.kind === 'needs_limiter' ? { id: 'name_limiter', label: 'Name what blocks this (plans a deep run)' } : { id: 'run_deep', label: 'Run deep on this' });
  options.push({ id: 'not_now', label: 'Not now' });

  return {
    shape: 'evidence',
    title: 'Evidence: quick research run',
    question: 'What should happen with this evidence?',
    options: options,
    body_md: noDash(lines.join('\n')),
    payload: {
      run_id: r.run_id,
      mode: 'quick',
      verdict: r.verdict,
      plan_hash: r.plan_hash,
      row_ids: rows.map(function (x) { return x.row_id; }),
      escalation: !!offer,
    },
  };
}

function evidenceRowsLabel(q) {
  const role = typeof q.role === 'string' ? q.role.replace(/_/g, ' ') : '';
  return oneLine(q.template_id) + (role ? ' (' + role + ')' : '');
}

// ---------------------------------------------------------------------------
// escalateToDeep
// ---------------------------------------------------------------------------
// Builds a deep plan seed from a quick plan and its run. Same perspective and
// pyramid; deep caps; counterevidence on; round-one searches are cleared so the
// deep composer (363-13) builds them and the navigator reviews them. Pure: it
// writes nothing, fetches nothing and never runs the plan.
function escalateToDeep(plan, run) {
  if (!isObj(plan)) return null;
  const deepCaps = {
    breadth: BUDGETS.DEEP_LANES_REQUESTED,
    rounds: BUDGETS.DEEP_ROUNDS,
    queries_per_round: BUDGETS.DEEP_R1_QUERIES_PER_LANE,
    results_per_query: BUDGETS.DEEP_RESULTS_PER_QUERY,
    max_searches: BUDGETS.DEEP_MAX_SEARCHES,
    time_budget_ms: BUDGETS.DEEP_TIME_BUDGET_MS,
    counterevidence: true,
  };
  const deep = clone(plan);
  deep.run_id = planMod.newRunId();
  deep.mode = 'deep';
  deep.version = 1;
  deep.revision = 0;
  deep.max_revisions = BUDGETS.MAX_PLAN_REVISIONS;
  deep.status = 'ready';
  deep.parent_plan_hash = planMod.planHash(plan);
  deep.budget = deepCaps;
  deep.stop_rules = ['cap', 'saturation', 'budget', 'time'];
  deep.grant_ref = null;
  deep.leaves = list(deep.leaves).map(function (leaf) {
    const l = Object.assign({}, leaf);
    l.queries = [];
    l.status = l.researchable === true ? 'open' : 'not_run';
    delete l.support_count;
    delete l.contradict_count;
    return l;
  });
  // The quick run's audited round-one strings ride along as the seed, so the
  // deep composer and the plan review card start from what was already vetted.
  const quickQueries = [];
  list(plan.leaves).forEach(function (leaf) {
    list(leaf && leaf.queries).forEach(function (q) {
      if (!isObj(q) || quickQueries.some(function (x) { return x.q_hash === q.q_hash; })) return;
      quickQueries.push({ leaf_id: leaf.id, template_id: q.template_id, family: q.family, role: q.role || null, q: q.q, q_hash: q.q_hash, audit: q.audit });
    });
  });
  deep.seed = {
    quick_queries: quickQueries,
    from_quick_run_id: isObj(run) ? run.run_id || null : null,
    quick_verdict: isObj(run) ? run.verdict || null : null,
    quick_row_ids: isObj(run) ? list(run.rows).map(function (x) { return x.row_id; }) : [],
  };
  deep.plan_hash = planMod.planHash(deep);
  return deep;
}

module.exports = {
  runQuick: runQuick,
  coverFor: coverFor,
  reaskCard: reaskCard,
  queriesOf: queriesOf,
  evidenceCard: evidenceCard,
  escalateToDeep: escalateToDeep,
  localRoomCheck: localRoomCheck,
};
