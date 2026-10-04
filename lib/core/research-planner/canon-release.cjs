'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 11 (D-13, D-14, D-15; EPV366-18, EPV366-19): the gated, per-term release of a
 * room word to Theo's normalize_framework_name, and the confirm that follows.
 *
 * THE JOB. A room calls a canon framework by its own word ("Bottleneck Hunt"). 80.2% of 355's
 * pairings never asked Theo because a handle did not resolve. A miss now offers its term on the
 * F.8 card; a yes sends exactly that term to Theo; a hit becomes a PROPOSED translation row in
 * <room>/references/canon-translations.md that the navigator confirms on the next card.
 *
 * WHAT LEAVES THE MACHINE, IN PLAIN WORDS. Only { raw: term } reaches Theo. Theo's
 * normalize_framework_name is a z.strictObject with the single key `raw`
 * (/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts), so any other key is refused before
 * its handler runs. The full envelope { raw, intent, section, perspective } (D-13 b) is built, classified
 * by the Part 8 guard and recorded in the local audit row; it is NOT sent. When Theo's intent-led
 * resolver ships (filed as a Theo-side request by plan 366-24), the guard arm already accepts the
 * envelope shape, so that later switch is transport-only. The card says all of this and must never
 * imply that intent reaches Theo.
 *
 * THE RULES.
 *   - Only carried `framework:` / `methodology:` values are ever offered, never titles (a title is
 *     room prose, Part 8).
 *   - Nothing leaves without a yes: the release runs on a single-use, session-scoped gate minted per
 *     term (gate-ledger), and releaseTerm refuses a gate id this module did not mint.
 *   - The egress policy applies (366-17): with the `theo` line off the offer is shown with the off
 *     note and no gate is minted; the call is also refused at answer time.
 *   - Reaching Theo goes through brain-client's callTool by default (the one wire door); tests and
 *     the CLI inject a transport. This module calls no search tool of any kind.
 *   - The guard is consulted with the receipt BEFORE the call (part8-egress-guard classify with
 *     opts.release); a verdict other than allow / navigator_released refuses.
 *   - One closed 23-key audit row per call (audit-ledger). part8_verdict is 'pass' on a released
 *     call; the navigator_released reason lives in the guard verdict (PATTERNS discrepancy 2).
 *   - A hit is written only when its canonical name is in the shipped snapshot, and only as a
 *     proposed row (ratified_at null) that only a human confirms (T-366-46).
 *
 * Hyphens only. No em-dash.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const auditLedger = require('./audit-ledger.cjs');
const egressPolicy = require('./egress-policy.cjs');
const families = require('./families.cjs');
const part8Guard = require('../part8-egress-guard.cjs');
const canonTranslations = require('../canon-translations.cjs');
const verificationStamp = require('../verification-stamp.cjs');
const navigation = require('../navigation.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');
const gateLedger = require('../../mcp/gate-ledger.cjs');
const gateRender = require('../../mcp/gate-render.cjs');

const TOOL = 'normalize_framework_name';
const TEMPLATE_ID = 'canon-translation';
const FAMILY = 'canon-term/v1';
const PROVIDER = 'theo';
const LINE = 'theo';
const MAX_TERM = 80;
const TERM_ITEM_RE = /^canon_term:[0-9a-f]{12}$/;
const CONFIRM_ITEM_RE = /^canon_translation:[0-9a-f]{12}$/;
const ANY_CANON_ITEM_RE = /^canon_(term|translation):[0-9a-f]{12}$/;
const SECTION_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const OFF_NOTE = "Theo is off in this room's egress policy";
const DUMMY_GATE = 'gate-0000000000000000';

// gate id -> what this module minted it for. A gate id is spent on first use.
const _minted = new Map();

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function noDash(s) { return String(s).replace(/[\u2013\u2014]/g, '-'); }
function sha12(term) { return crypto.createHash('sha256').update(String(term), 'utf8').digest('hex').slice(0, 12); }
function termItemId(term) { return 'canon_term:' + sha12(term); }
function confirmItemId(term) { return 'canon_translation:' + sha12(term); }
function isCanonItemId(id) { return typeof id === 'string' && ANY_CANON_ITEM_RE.test(id); }
function samePath(a, b) { return path.resolve(String(a)) === path.resolve(String(b)); }

// ---------------------------------------------------------------------------
// reading the things a run points at (read-only; room content never leaves)
// ---------------------------------------------------------------------------
function carriedOf(db, id) {
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ? LIMIT 1').get(id);
    if (!row) return null;
    let p = {};
    try { p = JSON.parse(String(row.properties || '{}')) || {}; } catch (_e) { p = {}; }
    const title = ['title', 'name', 'label'].map(function (k) { return typeof p[k] === 'string' ? p[k].trim() : ''; }).filter(Boolean)[0] || null;
    return {
      framework: typeof p.framework === 'string' ? p.framework.trim() : null,
      methodology: typeof p.methodology === 'string' ? p.methodology.trim() : null,
      title: title,
      section: typeof p.section === 'string' ? p.section.trim() : null,
    };
  } catch (_e) {
    return null;
  }
}

// pairsOf(run, plan) -> [{ id, perspective }] distinct node ids named by any pair the run knows.
function pairsOf(run, plan) {
  const seen = {};
  const out = [];
  function take(pair) {
    if (!isObj(pair)) return;
    const persp = nonEmpty(pair.perspective) ? pair.perspective : null;
    [pair.a, pair.b].forEach(function (id) {
      if (!nonEmpty(id) || seen[id]) return;
      seen[id] = true;
      out.push({ id: id, perspective: persp });
    });
  }
  list(run && run.opportunity_candidates).forEach(function (c) { if (isObj(c)) take(c.pair); });
  list(plan && plan.leaves).forEach(function (l) { if (isObj(l)) take(l.pair); });
  list(run && run.leaves).forEach(function (l) { if (isObj(l)) take(l.pair); });
  return out;
}

function planSection(plan) {
  const t = plan && plan.return_target;
  return isObj(t) && nonEmpty(t.section) && SECTION_RE.test(t.section) ? t.section : null;
}

// the active JTBD handle, only when it is in the closed vocabulary the guard proves against
function currentIntent(roomDir) {
  try {
    const cur = jtbdState.getCurrent(roomDir);
    const handle = cur && typeof cur.jtbd === 'string' ? cur.jtbd : null;
    if (handle && part8Guard._releaseIntentVocabulary().indexOf(handle) !== -1) return handle;
  } catch (_e) { /* no JTBD state: no intent */ }
  return null;
}

// a term is offerable only if the guard would admit it under a receipt (single short line, clean)
function termOfferable(term) {
  if (!nonEmpty(term) || term !== term.trim()) return false;
  if (term.length > MAX_TERM || /[\r\n]/.test(term) || /[\u2013\u2014]/.test(term)) return false;
  if (term.indexOf('/mos:') === 0) return false;
  const v = part8Guard.classify({ raw: term }, { toolName: TOOL, release: { gate_id: DUMMY_GATE, term: term } });
  return !!v && v.verdict === 'allow' && v.class === 'navigator_released';
}

function theoOn(roomDir, opts) {
  const policy = opts && opts.policy ? opts.policy : egressPolicy.loadEgressPolicy(roomDir, { offline: !!(opts && opts.offline) });
  return { policy: policy, on: egressPolicy.lineAllowed(policy, LINE) };
}

// ---------------------------------------------------------------------------
// the offer
// ---------------------------------------------------------------------------
/*
 * offerItemsFor(roomDir, run, plan, opts) -> [item]. Local only; mints nothing; never throws.
 * One item per distinct unresolved carried framework or methodology term over the run's pairs.
 * Titles are never offered. A term already in the translation table (proposed or ratified) is skipped.
 */
function offerItemsFor(roomDir, run, plan, opts) {
  const items = [];
  let db = null;
  try {
    const pairs = pairsOf(run, plan);
    if (pairs.length === 0) return items;
    db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return items;
    const ctx = verificationStamp.resolverCtxFor(roomDir);
    const known = {};
    canonTranslations.listRows(roomDir).forEach(function (r) { known[r.term] = true; });
    const gate = theoOn(roomDir, opts);
    const intent = currentIntent(roomDir);
    const seenTerm = {};
    pairs.forEach(function (p) {
      const carried = carriedOf(db, p.id);
      if (!carried) return;
      // a thing whose framework, methodology or title already resolves needs no release
      const resolved = verificationStamp.resolveEndpoint({ framework: carried.framework, methodology: carried.methodology, title: carried.title }, ctx);
      if (resolved && resolved.name) return;
      // TITLES ARE NEVER OFFERED (Part 8): only the carried framework and methodology values.
      [carried.framework, carried.methodology].forEach(function (term) {
        if (!termOfferable(term) || seenTerm[term] || known[term]) return;
        seenTerm[term] = true;
        const section = carried.section && SECTION_RE.test(carried.section) ? carried.section : planSection(plan);
        const perspective = p.perspective && part8Guard._releasePerspectiveIds().indexOf(p.perspective) !== -1 ? p.perspective : null;
        items.push({
          id: termItemId(term),
          kind: 'canon_release',
          term: term,
          section: section,
          perspective: perspective,
          intent: intent,
          run_id: isObj(run) && nonEmpty(run.run_id) ? run.run_id : (isObj(plan) && nonEmpty(plan.run_id) ? plan.run_id : null),
          theo_on: gate.on,
          default_on: false,
          gate_id: null,
          note: gate.on ? null : OFF_NOTE,
          label: noDash('Ask Theo for the canon name of "' + term + '" (the term only is sent; answered on its own card, never filed)'
            + (gate.on ? '' : '. ' + OFF_NOTE)),
        });
      });
    });
  } catch (_e) { /* a malformed run yields the items found so far */ } finally {
    if (db) { try { db.close(); } catch (_e2) { /* read-only handle */ } }
  }
  items.sort(function (a, b) { return a.term < b.term ? -1 : (a.term > b.term ? 1 : 0); });
  return items;
}

// releaseCard(item) -> the F.8-shaped card the navigator answers. Pure; no gate.
function releaseCard(item) {
  const it = isObj(item) ? item : {};
  const term = String(it.term || '');
  const lines = [];
  lines.push('## Release this term to Theo?');
  lines.push('');
  lines.push('Term: "' + term + '" (a word your room carries as a framework name).');
  lines.push('');
  lines.push('Your room does not match this word to a canon framework yet. Theo can look a name up by exact name or alias, nothing fuzzy.');
  lines.push('');
  lines.push('- Sent to Theo: the term only. Nothing else leaves this machine.');
  lines.push('- Recorded on this machine, NOT sent: intent (' + (it.intent || 'none') + '), section (' + (it.section || 'none') + '), perspective (' + (it.perspective || 'none') + ').');
  lines.push('- Theo matches by name alone today; it cannot read your intent until its resolver accepts it.');
  lines.push('');
  lines.push('If Theo knows a canon name, it lands as a PROPOSED translation in references/canon-translations.md. It is not used until you confirm it on the next card. If Theo does not know the word, nothing is written and the miss is counted.');
  lines.push('');
  lines.push('This yes covers this one term, once. The release is logged in .mindrian/research-audit.jsonl with this gate id.');
  return {
    shape: 'F.8',
    title: 'F.8 Release this term to Theo?',
    question: 'Send the term "' + term + '" to Theo to find its canon name?',
    options: [
      { id: 'release', label: 'Yes, send this term to Theo' },
      { id: 'not_now', label: 'Not now (Recommended)', recommended: true },
    ],
    body_md: noDash(lines.join('\n')),
    payload: { item_id: it.id || null, term: term, gate_id: it.gate_id || null },
  };
}

// ---------------------------------------------------------------------------
// the gate
// ---------------------------------------------------------------------------
function pruneMinted() {
  const cutoff = Date.now() - gateLedger.LEDGER_TTL_MS;
  Array.from(_minted.keys()).forEach(function (k) { if (_minted.get(k).mintedAt < cutoff) _minted.delete(k); });
}

/*
 * mintReleaseGate(roomDir, item, { sessionId, deps }) -> { ok, gate_id, card } | { ok:false, reason }.
 * Synchronous (filing.fileRun is, and the basket is built there). Mints a single-use material_step gate
 * whose resumeFn performs the release; nothing is sent until that gate is answered yes.
 */
function mintReleaseGate(roomDir, item, opts) {
  const o = isObj(opts) ? opts : {};
  if (!isObj(item) || !TERM_ITEM_RE.test(String(item.id)) || !termOfferable(item.term)) return { ok: false, reason: 'invalid_item' };
  const gate = theoOn(roomDir, o);
  if (!gate.on) return { ok: false, reason: 'egress_line_off', note: OFF_NOTE };
  pruneMinted();
  const card = releaseCard(item);
  const gateCard = gateRender.normalizeCard({
    kind: 'material_step',
    header: card.title + ': ' + card.question,
    selectMode: 'single',
    options: card.options.map(function (op) { return { id: op.id, label: op.label }; }),
  });
  const gateId = gateCard.gate_id;
  const deps = o.deps;
  _minted.set(gateId, {
    roomDir: path.resolve(roomDir),
    term: item.term,
    run_id: item.run_id || null,
    section: item.section || null,
    perspective: item.perspective || null,
    deps: deps,
    mintedAt: Date.now(),
  });
  async function resumeFn(answer) {
    const chosen = list(answer && answer.chosen);
    const verdict = answer && answer.verdict;
    if (verdict !== 'approve') return { ok: true, executed: false, verdict: verdict || 'defer', note: 'Nothing was sent.' };
    if (chosen.indexOf('release') === -1) return { ok: false, reason: 'chosen_not_approving', executed: false, note: 'An approve verdict must name the release option. Nothing was sent.' };
    return releaseTerm(roomDir, { term: item.term, gate_id: gateId, run_id: item.run_id, section: item.section, perspective: item.perspective }, deps);
  }
  gateLedger.mintGate(gateId, { card: gateCard, sessionId: o.sessionId, kind: 'material_step', resumeFn: resumeFn, approving: ['release'] });
  card.payload.gate_id = gateId;
  return { ok: true, gate_id: gateId, card: card };
}

// ---------------------------------------------------------------------------
// the release
// ---------------------------------------------------------------------------
function unwrap(res) {
  if (isObj(res) && Array.isArray(res.content) && res.content.length > 0 && isObj(res.content[0]) && typeof res.content[0].text === 'string') {
    try { return JSON.parse(res.content[0].text); } catch (_e) { return res; }
  }
  if (isObj(res) && isObj(res.structuredContent)) return res.structuredContent;
  return res;
}

// interpret(res) -> { kind: 'hit'|'miss'|'failed'|'blocked', canonical?, failure_class? }
function interpret(res0) {
  if (res0 === null || res0 === undefined) return { kind: 'failed', failure_class: 'backend_unavailable' };
  const res = unwrap(res0);
  if (typeof res === 'string' || Array.isArray(res)) return { kind: 'failed', failure_class: 'text_reply' };
  if (!isObj(res)) return { kind: 'failed', failure_class: 'backend_unavailable' };
  if (typeof res.error === 'string') {
    if (res.error === 'egress_blocked') return { kind: 'blocked', failure_class: 'egress_refused' };
    return { kind: 'failed', failure_class: /^[a-z_]{1,40}$/.test(res.error) ? res.error : 'backend_unavailable' };
  }
  if (typeof res.canonical === 'string' && res.canonical.length > 0) return { kind: 'hit', canonical: res.canonical };
  return { kind: 'miss' };
}

// buildEnvelope(roomDir, p) -> the D-13(b) envelope the guard classifies and the audit row records.
// Any optional key the guard does not prove is dropped (intent first), never forced through.
function buildEnvelope(roomDir, p, gateId) {
  const full = { raw: p.term };
  const intent = currentIntent(roomDir);
  if (intent) full.intent = intent;
  if (nonEmpty(p.section) && SECTION_RE.test(p.section)) full.section = p.section;
  if (nonEmpty(p.perspective)) full.perspective = p.perspective;
  const receipt = { gate_id: gateId, term: p.term };
  const env = Object.assign({}, full);
  const order = ['intent', 'perspective', 'section'];
  let verdict = part8Guard.classify(env, { toolName: TOOL, release: receipt });
  let i = 0;
  while (!(verdict.verdict === 'allow' && verdict.class === 'navigator_released') && i < order.length) {
    delete env[order[i]];
    i += 1;
    verdict = part8Guard.classify(env, { toolName: TOOL, release: receipt });
  }
  return { envelope: env, verdict: verdict, receipt: receipt };
}

function auditRecord(roomDir, p, built, gateId, started, outcome, failureClass, count, resultIds, partVerdict, transport) {
  const env = built.envelope;
  const filters = {};
  ['intent', 'section', 'perspective'].forEach(function (k) { if (env[k] !== undefined) filters[k] = env[k]; });
  if (transport === 'replay') filters.transport = 'replay';
  return {
    ts: new Date(started).toISOString(),
    run_id: nonEmpty(p.run_id) ? p.run_id : 'canon-release',
    grant_id: gateId,
    grant_version: 1,
    q: p.term,
    q_hash: families.qHash(p.term),
    template_id: TEMPLATE_ID,
    family: FAMILY,
    part8_verdict: partVerdict,
    provider: PROVIDER,
    filters: filters,
    pagination: { per_page: 1, page: 1 },
    fallback_used: false,
    origin_ref: 'jtbd:' + (env.intent || 'none') + '|section:' + (env.section || 'none') + '|perspective:' + (env.perspective || 'none'),
    result_ids: resultIds,
    content_hashes: [],
    outcome: outcome,
    failure_class: failureClass,
    count: count,
    cost_usd: null,
    remaining_usd: null,
    x_query: null,
    latency_ms: Date.now() - started,
  };
}

/*
 * releaseTerm(roomDir, { term, gate_id, run_id, section, perspective }, deps) -> result. Async; never throws.
 * deps: { callTool(name, args), transport? }. Refuses a gate id this module did not mint for this room and
 * this exact term. The gate id is spent on the first use whatever the outcome.
 */
async function releaseTerm(roomDir, p, deps) {
  try {
    const params = isObj(p) ? p : {};
    const reg = typeof params.gate_id === 'string' ? _minted.get(params.gate_id) : null;
    if (!reg || reg.term !== params.term || !samePath(reg.roomDir, roomDir)) return { ok: false, reason: 'gate_not_minted', executed: false };
    _minted.delete(params.gate_id);
    const gateId = params.gate_id;
    const d = isObj(deps) ? deps : (isObj(reg.deps) ? reg.deps : {});
    const callTool = typeof d.callTool === 'function' ? d.callTool : require('../brain-client.cjs').callTool;
    const transport = typeof d.transport === 'string' ? d.transport : 'live';

    const policy = egressPolicy.loadEgressPolicy(roomDir, { offline: d.offline === true });
    if (!egressPolicy.lineAllowed(policy, LINE)) return { ok: false, reason: 'egress_line_off', executed: false, note: OFF_NOTE };

    const merged = { term: params.term, run_id: params.run_id || reg.run_id, section: params.section || reg.section, perspective: params.perspective || reg.perspective };
    const started = Date.now();
    const built = buildEnvelope(roomDir, merged, gateId);
    const guard = { verdict: built.verdict.verdict, class: built.verdict.class, reason: built.verdict.reason };
    const wire = { raw: params.term };
    const wireVerdict = part8Guard.classify(wire, { toolName: TOOL, release: built.receipt });
    const allowed = built.verdict.verdict === 'allow' && built.verdict.class === 'navigator_released'
      && wireVerdict.verdict === 'allow' && wireVerdict.class === 'navigator_released';
    if (!allowed) {
      const blocked = auditRecord(roomDir, merged, built, gateId, started, 'blocked', 'part8_refused', null, [], 'tripped', transport);
      const au = auditLedger.appendAudit(roomDir, blocked, { policy: policy });
      return { ok: false, reason: 'guard_refused', executed: false, guard: guard, audit: au };
    }

    // THE ONE EGRESS. The wire payload is { raw: term } (Theo's strictObject takes no other key).
    let res = null;
    try { res = await callTool(TOOL, wire); } catch (_e) { res = null; }
    const got = interpret(res);

    let outcome = 'empty_valid';
    let failureClass = null;
    let count = 0;
    let resultIds = [];
    let partVerdict = 'pass';
    let proposed = false;
    let canonical = null;
    let proposeReason = null;
    if (got.kind === 'failed') { outcome = 'failed'; failureClass = got.failure_class; count = null; }
    else if (got.kind === 'blocked') { outcome = 'blocked'; failureClass = got.failure_class; count = null; partVerdict = 'tripped'; }
    else if (got.kind === 'hit') {
      const names = verificationStamp.loadFrameworkNames();
      if (names.has(got.canonical)) {
        outcome = 'ok';
        count = 1;
        resultIds = [got.canonical];
        canonical = got.canonical;
      } else {
        proposeReason = 'canonical_not_in_snapshot';
      }
    }

    const audit = auditLedger.appendAudit(roomDir, auditRecord(roomDir, merged, built, gateId, started, outcome, failureClass, count, resultIds, partVerdict, transport), { policy: policy });
    if (!audit.ok) return { ok: false, reason: 'audit_write_failed', detail: audit.reason, executed: true, guard: guard };

    if (canonical !== null) {
      const wrote = canonTranslations.proposeRow(roomDir, { term: params.term, canon_name: canonical });
      proposed = wrote.ok === true;
      if (!proposed) proposeReason = wrote.reason;
    }
    const miss = outcome === 'empty_valid' ? 1 : 0;
    const out = {
      ok: true,
      executed: true,
      term: params.term,
      gate_id: gateId,
      guard: guard,
      recorded_locally: { intent: built.envelope.intent || null, section: built.envelope.section || null, perspective: built.envelope.perspective || null },
      sent: wire,
      outcome: got.kind === 'hit' && canonical !== null ? 'hit' : (got.kind === 'failed' || got.kind === 'blocked' ? got.kind : 'miss'),
      proposed: proposed,
      release_miss: miss,
      audit: { ok: true },
    };
    if (proposed) out.canon_name = canonical;
    if (proposeReason) out.reason_note = proposeReason;
    if (got.failure_class) out.failure_class = got.failure_class;
    return out;
  } catch (_e) {
    return { ok: false, reason: 'release_threw', executed: false };
  }
}

/*
 * answerRelease(roomDir, item, { sessionId, deps }) -> result. The CLI door: the host asked the navigator
 * (AskUserQuestion) and the navigator said yes, which the caller states with --approved-via cli. The gate is
 * minted and consumed in this process through the same ledger, so the release runs the one governed path.
 */
async function answerRelease(roomDir, item, opts) {
  const o = isObj(opts) ? opts : {};
  const minted = mintReleaseGate(roomDir, item, o);
  if (!minted.ok) return minted;
  const entry = gateLedger.consumeGate(minted.gate_id, o.sessionId);
  if (!entry || entry.ok === false || typeof entry.resumeFn !== 'function') return { ok: false, reason: 'gate_unavailable' };
  return entry.resumeFn({ gate_id: minted.gate_id, chosen: ['release'], verdict: 'approve' });
}

// releaseCounts(roomDir) -> counts read from the audit ledger (no second store).
function releaseCounts(roomDir) {
  const counts = { release_hit: 0, release_miss: 0, release_failed: 0, release_blocked: 0 };
  auditLedger.readAudit(roomDir).forEach(function (r) {
    if (r.provider !== PROVIDER || r.template_id !== TEMPLATE_ID) return;
    if (r.outcome === 'ok') counts.release_hit += 1;
    else if (r.outcome === 'empty_valid') counts.release_miss += 1;
    else if (r.outcome === 'failed') counts.release_failed += 1;
    else if (r.outcome === 'blocked') counts.release_blocked += 1;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// the confirm
// ---------------------------------------------------------------------------
// confirmItemsFor(roomDir) -> one canon_confirm item per PROPOSED row (ratified_at null). Local only.
function confirmItemsFor(roomDir) {
  try {
    return canonTranslations.listRows(roomDir).filter(function (r) { return r.ratified_at === null; }).map(function (r) {
      return {
        id: confirmItemId(r.term),
        kind: 'canon_confirm',
        term: r.term,
        canon_name: r.canon_name,
        default_on: false,
        label: noDash('Confirm that your word "' + r.term + '" means the canon framework "' + r.canon_name + '" (proposed from Theo; answered on its own card, never filed)'),
      };
    });
  } catch (_e) {
    return [];
  }
}

function approved(auth) {
  if (!isObj(auth)) return false;
  if (auth.approved_via === 'cli') return true;
  const a = auth.answer;
  return isObj(a) && a.verdict === 'approve' && list(a.chosen).indexOf('confirm') !== -1;
}

/*
 * confirmTranslation(roomDir, itemId, auth) -> { ok, term, canon_name } | { ok:false, reason }. The navigator's act:
 * auth is { approved_via: 'cli' } (the host asked and heard yes) or { answer: { verdict:'approve', chosen:['confirm'] } }.
 */
function confirmTranslation(roomDir, itemId, auth) {
  if (typeof itemId !== 'string' || !CONFIRM_ITEM_RE.test(itemId)) return { ok: false, reason: 'unknown_item' };
  if (!approved(auth)) return { ok: false, reason: 'approval_required' };
  const row = confirmItemsFor(roomDir).filter(function (i) { return i.id === itemId; })[0];
  if (!row) return { ok: false, reason: 'unknown_item' };
  const res = canonTranslations.ratifyRow(roomDir, row.term);
  if (!res || res.ok !== true) return { ok: false, reason: (res && res.reason) || 'ratify_failed' };
  return { ok: true, term: row.term, canon_name: row.canon_name };
}

/*
 * transportFromEnv(env) -> { ok:true, deps } | { ok:false, reason, hint? }. The ONE place the release transport is
 * chosen from the environment: both doors (the CLI canon-release door and the MCP research_run basket) call it, and
 * nothing else does (Canon Part 7). MOS_366_THEO_REPLAY names a recorded-answer file (offline, hermetic); MOS_366_LIVE=1
 * allows the real Theo call through brain-client for the one released term; anything else refuses and sends nothing.
 * env defaults to process.env and is read at call time.
 */
function transportFromEnv(env) {
  const e = isObj(env) ? env : process.env;
  const replayPath = e.MOS_366_THEO_REPLAY;
  if (typeof replayPath === 'string' && replayPath.length > 0) {
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(replayPath, 'utf8')); } catch (_e) { doc = null; }
    if (!doc || typeof doc !== 'object' || !doc.responses || typeof doc.responses !== 'object') return { ok: false, reason: 'replay_unreadable' };
    const responses = doc.responses;
    return {
      ok: true,
      deps: {
        transport: 'replay',
        callTool: async function (tool, args) {
          if (tool !== TOOL || !args || typeof args.raw !== 'string') return null;
          return Object.prototype.hasOwnProperty.call(responses, args.raw) ? responses[args.raw] : null;
        },
      },
    };
  }
  if (e.MOS_366_LIVE === '1') return { ok: true, deps: { transport: 'live' } };
  return { ok: false, reason: 'live_not_enabled', hint: 'Set MOS_366_LIVE=1 to allow the real Theo call for this one term, or MOS_366_THEO_REPLAY to a recorded-answer file.' };
}

// ---------------------------------------------------------------------------
// the basket door
// ---------------------------------------------------------------------------
/*
 * basketItemsFor(roomDir, run, plan, opts) -> [item]: the release offers (with a gate id each when a session id is
 * present and the theo line is on) followed by the confirm items. Synchronous, local only, never throws.
 */
function basketItemsFor(roomDir, run, plan, opts) {
  const o = isObj(opts) ? opts : {};
  const offers = offerItemsFor(roomDir, run, plan, o);
  offers.forEach(function (it) {
    if (!it.theo_on || !nonEmpty(o.sessionId)) return;
    const m = mintReleaseGate(roomDir, it, { sessionId: o.sessionId, deps: o.deps, policy: o.policy, offline: o.offline });
    if (m.ok) it.gate_id = m.gate_id;
  });
  return offers.concat(confirmItemsFor(roomDir));
}

module.exports = {
  TOOL: TOOL,
  PROVIDER: PROVIDER,
  OFF_NOTE: OFF_NOTE,
  termItemId: termItemId,
  isCanonItemId: isCanonItemId,
  offerItemsFor: offerItemsFor,
  releaseCard: releaseCard,
  mintReleaseGate: mintReleaseGate,
  releaseTerm: releaseTerm,
  answerRelease: answerRelease,
  releaseCounts: releaseCounts,
  confirmItemsFor: confirmItemsFor,
  confirmTranslation: confirmTranslation,
  basketItemsFor: basketItemsFor,
  transportFromEnv: transportFromEnv,
};
