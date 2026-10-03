'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 14 -- filing a finished research run, only on the navigator's yes.
 *
 * What lives here (D-04, D-07, D-08, D-12, D-13, D-15, D-18):
 *   - buildBasket(run, plan): the F.8 basket. One item per thing that could
 *     land in the room: the run home, one claim item per supported or
 *     contradicted leaf, one contradiction item per contested leaf, one
 *     settled-limiter item per classified limiter that has an evidence row,
 *     one opportunity item per candidate (default OFF), one roll-up item, one
 *     discarded-path item per ratchet discard.
 *   - basketCard(items): the surface-neutral F.8 card (at most 3 options).
 *   - fileRun(roomDir, run, plan, selection, opts): writes the selected items
 *     through the existing doors, and writes nothing at all unless the
 *     selection is an approved basket answer. A grant authorizes fetching,
 *     never filing (D-04): a selection that carries a grant is refused.
 *
 * The doors used (no second door into the room, T-363-37):
 *   fileResearchArtifact  the run home under top-level research/<dated-slug>/
 *   navigation            open-question, EvidenceClaim, reasoning, opportunity
 *                         nodes and every typed edge
 *   opportunity-ops       fileOpportunity, for a funding signal only
 *   reasoning-ops         mergeReasoningFrontmatter for the roll-up
 *   feynman-minto         validate, to prove the roll-up added no violation
 * MINTO.md is never edited here: it regenerates on the next generator run.
 *
 * Canon Part 9: every node and edge lands proposed; only a human confirms.
 * Canon Part 8: nothing in this file sends anything anywhere. Filing writes
 * local room files and room.db. No Brain, no Theo, no network.
 *
 * No em-dash or en-dash anywhere in this file; the characters are matched by
 * code point escape only.
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');
const researchFiling = require('../semantic-index/research-filing.cjs');
const opportunityOps = require('../opportunity-ops.cjs');
const reasoningOps = require('../reasoning-ops.cjs');
const mintoInvariants = require('../feynman-minto-invariants.cjs');
const auditLedger = require('./audit-ledger.cjs');
const evidenceRows = require('./evidence-rows.cjs');
const perspectiveMod = require('./perspective.cjs');
const filingStamped = require('./filing-stamped.cjs');
const verificationStamp = require('../verification-stamp.cjs');

const RUN_ID_RE = /^rp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/;
const GRANT_KEYS = Object.freeze(['grant', 'grant_id', 'grant_ref', 'lifetime', 'standing']);
const EVIDENCE_TIERS = Object.freeze(['Academic', 'Operational', 'Practitioner', 'None']);
const LEDGER_SCHEMA = 'mos.research-ledger/1';
const RECORDS_SCHEMA = 'mos.research-records/1';
const ROWS_SCHEMA = 'mos.research-rows/1';
const FILING_SCHEMA = 'mos.research-filing/1';
const ORIGIN = 'research-planner';
// the planner's run state dir (planner.cjs STATE_DIR); a Theo lane writes there
const STATE_DIR = path.join('.mindrian', 'research-runs');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

// Hyphens only: em and en dashes become a plain hyphen, control characters a space.
function noDash(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2013\u2014\u2212]/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ');
}
function oneLine(s) { return noDash(s).replace(/\s+/g, ' ').trim(); }
function short(s, n) {
  const t = oneLine(s);
  return t.length > n ? t.slice(0, n - 3).trim() + '...' : t;
}
function slugify(s) {
  return oneLine(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// A value that is safe inside a hand-serialized YAML list item (reasoning-ops
// writes items as - "text" without escaping).
function yamlItem(s) {
  return short(String(s == null ? '' : s).replace(/["`:#]+/g, ' '), 170);
}
function relPosix(p) { return p.split(path.sep).join('/'); }

function writeAtomic(abs, text) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, abs);
}
function writeJson(abs, obj) { writeAtomic(abs, JSON.stringify(obj, null, 2) + '\n'); }
function readJsonSafe(abs) {
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (_e) { return null; }
}

function insideRoom(roomDir, abs) {
  const root = path.resolve(roomDir);
  const target = path.resolve(abs);
  return target === root || target.indexOf(root + path.sep) === 0;
}

function leafById(run, plan) {
  const out = {};
  list(plan && plan.leaves).forEach(function (l) { if (isObj(l) && nonEmpty(l.id)) out[l.id] = l; });
  list(run && run.leaves).forEach(function (l) { if (isObj(l) && nonEmpty(l.id)) out[l.id] = Object.assign({}, out[l.id] || {}, l); });
  return out;
}

function rowsOf(run) { return list(run && run.rows).filter(isObj); }
function rowsForLeaf(run, leafId) {
  return rowsOf(run).filter(function (r) { return r.leaf_id === leafId; });
}
function rowById(run) {
  const out = {};
  rowsOf(run).forEach(function (r) { if (nonEmpty(r.row_id)) out[r.row_id] = r; });
  return out;
}
function settledLabel(r) { return r.label === 'supports' || r.label === 'contradicts'; }

function discardedList(run, plan) {
  const seen = {};
  const out = [];
  const sources = [
    plan && plan.perspective && plan.perspective.ratchet && plan.perspective.ratchet.discarded,
    run && run.perspective && run.perspective.ratchet && run.perspective.ratchet.discarded,
  ];
  sources.forEach(function (arr) {
    list(arr).forEach(function (d) {
      if (!isObj(d) || !nonEmpty(d.id) || !nonEmpty(d.kind)) return;
      const key = d.kind + ':' + d.id;
      if (seen[key]) return;
      seen[key] = true;
      out.push(d);
    });
  });
  return out;
}

function governingQuestion(run, plan) {
  const py = (plan && plan.pyramid) || (run && run.pyramid) || {};
  const q = py.governing_question || py.stated_question
    || (py.scqa && py.scqa.question) || '';
  return nonEmpty(q) ? oneLine(q) : 'Research run ' + (run && run.run_id ? run.run_id : '');
}

function sectionOf(plan) {
  const t = plan && plan.return_target;
  return isObj(t) && nonEmpty(t.section) ? t.section : null;
}

// ---------------------------------------------------------------------------
// buildBasket
// ---------------------------------------------------------------------------
function candidateOffered(c) {
  if (!isObj(c) || !nonEmpty(c.kind)) return false;
  if (c.kind === 'funding_signal') return nonEmpty(c.funder) && nonEmpty(c.program);
  return true;
}

function candidateLabel(c, index, byLeaf, plan) {
  if (c.kind === 'funding_signal') return 'Opportunity, funding signal: ' + short(c.funder, 60) + ' - ' + short(c.program, 80);
  const lim = list(plan && plan.perspective && plan.perspective.limiters).filter(function (l) { return l && l.id === c.limiter_id; })[0];
  const leaf = byLeaf[list(c.leaf_ids)[0]];
  const subject = lim ? lim.statement : (leaf ? leaf.question : 'candidate ' + (index + 1));
  return 'Opportunity, ' + oneLine(c.kind).replace(/_/g, ' ') + ': ' + short(subject, 90);
}

function buildBasket(run, plan) {
  const items = [];
  try {
    const r = isObj(run) ? run : {};
    const p = isObj(plan) ? plan : {};
    const byLeaf = leafById(r, p);
    const byRow = rowById(r);

    items.push({
      id: 'run_home',
      kind: 'run_home',
      label: 'Run home under research/ (report, plan, ledger, records, rows) and one open question per researchable leaf',
      default_on: true,
    });

    const contestedIds = {};
    list(r.contradictions).forEach(function (c) { if (isObj(c) && nonEmpty(c.leaf_id)) contestedIds[c.leaf_id] = true; });
    Object.keys(byLeaf).forEach(function (id) { if (byLeaf[id].status === 'contested') contestedIds[id] = true; });

    const orderedLeafIds = list(p.leaves).map(function (l) { return l && l.id; }).filter(nonEmpty);
    Object.keys(byLeaf).forEach(function (id) { if (orderedLeafIds.indexOf(id) === -1) orderedLeafIds.push(id); });

    orderedLeafIds.forEach(function (id) {
      const leaf = byLeaf[id];
      if (!leaf || leaf.researchable === false) return;
      const settled = rowsForLeaf(r, id).filter(settledLabel);
      if (settled.length === 0) return;
      if (contestedIds[id]) {
        items.push({
          id: 'contradiction:' + id,
          kind: 'contradiction',
          leaf_id: id,
          label: 'Held contradiction for ' + id + ' (' + settled.length + ' rows kept on both sides): ' + short(leaf.question, 80),
          default_on: true,
        });
      } else if (leaf.status === 'supported' || leaf.status === 'contradicted') {
        items.push({
          id: 'claim:' + id,
          kind: 'claim',
          leaf_id: id,
          label: 'Evidence for ' + id + ' (' + leaf.status + ', ' + settled.length + ' row' + (settled.length === 1 ? '' : 's') + '): ' + short(leaf.question, 80),
          default_on: true,
        });
      }
    });

    list(r.classifications).forEach(function (c) {
      if (!isObj(c) || !nonEmpty(c.limiter_id) || !nonEmpty(c.statement)) return;
      const basis = list(c.basis_row_ids).filter(function (id) { return byRow[id]; });
      if (basis.length === 0) return;
      items.push({
        id: 'limiter:' + c.limiter_id,
        kind: 'settled_limiter',
        limiter_id: c.limiter_id,
        label: 'Limiter ' + c.limiter_id + ' (' + (c.column === 'physics' ? 'physics' : 'assumed') + ', proposed for your confirmation): ' + short(c.statement, 90),
        default_on: true,
      });
    });

    list(r.opportunity_candidates).forEach(function (c, i) {
      if (!candidateOffered(c)) return;
      items.push({
        id: 'opportunity:' + i,
        kind: 'opportunity',
        index: i,
        candidate_kind: c.kind,
        label: candidateLabel(c, i, byLeaf, p),
        default_on: false,
      });
    });

    if (sectionOf(p)) {
      items.push({
        id: 'rollup',
        kind: 'rollup',
        label: 'Roll the pyramid up into the ' + sectionOf(p) + ' section reasoning',
        default_on: true,
      });
    }

    discardedList(r, p).forEach(function (d) {
      items.push({
        id: 'discard:' + d.kind + ':' + d.id,
        kind: 'discarded_path',
        discard_kind: d.kind,
        discard_id: d.id,
        label: 'Discarded ' + d.kind + ' ' + d.id + ' with its reason: ' + short(d.reason || 'no reason given', 80),
        default_on: true,
      });
    });
  } catch (_e) { /* a malformed run yields the items found so far */ }
  return items;
}

// ---------------------------------------------------------------------------
// canon release items (Phase 366 plan 11, D-13): the gated Theo release of a room term and the
// confirm of a proposed translation ride the F.8 basket as items, but they are never filed here.
// ---------------------------------------------------------------------------
const CANON_ITEM_RE = /^canon_(term|translation):[0-9a-f]{12}$/;
function isCanonItem(i) {
  return isObj(i) && (i.kind === 'canon_release' || i.kind === 'canon_confirm' || (typeof i.id === 'string' && CANON_ITEM_RE.test(i.id)));
}

// basketWithCanon(roomDir, run, plan, opts) -> the filing items followed by the canon items. Sync, local
// only. opts.sessionId (when present) mints one single-use release gate per offered term; opts.deps is the
// injected Theo transport for tests.
function basketWithCanon(roomDir, run, plan, opts) {
  const items = buildBasket(run, plan);
  try {
    const canonRelease = require('./canon-release.cjs');
    return items.concat(canonRelease.basketItemsFor(roomDir, run, plan, isObj(opts) ? opts : {}));
  } catch (_e) {
    return items;
  }
}

// ---------------------------------------------------------------------------
// basketCard (shape F.8)
// ---------------------------------------------------------------------------
function basketCard(items) {
  const basket = list(items);
  const lines = [];
  lines.push('## File this research run?');
  lines.push('');
  lines.push('Nothing has been written to the room yet. Each line below is one thing that could be filed. On means it is selected by default.');
  lines.push('');
  basket.forEach(function (i) {
    lines.push('- [' + (i.default_on ? 'on' : 'off') + '] ' + noDash(i.label));
  });
  lines.push('');
  lines.push('Everything lands as proposed. Only you confirm a claim. Opportunities are off unless you turn them on.');
  if (basket.some(function (i) { return isCanonItem(i); })) {
    lines.push('');
    lines.push('Lines that ask Theo for a canon name or confirm a proposed translation are never filed from this card. Each is answered on its own card or with its own command. When you release a term, only the term reaches Theo.');
  }
  return {
    shape: 'F.8',
    title: 'File this research run',
    question: 'Which of these should go into the room?',
    options: [
      { id: 'file_selected', label: 'File the selected items (Recommended)', recommended: true },
      { id: 'choose_items', label: 'Choose items' },
      { id: 'file_nothing', label: 'File nothing' },
    ],
    body_md: noDash(lines.join('\n')),
    payload: {
      item_ids: basket.map(function (i) { return i.id; }),
      defaults: basket.filter(function (i) { return i.default_on; }).map(function (i) { return i.id; }),
    },
  };
}

// ---------------------------------------------------------------------------
// Report (markdown body of the run home)
// ---------------------------------------------------------------------------
function citeList(rows) {
  return rows.map(function (r) { return evidenceRows.renderRowCitation(r); }).join(' ');
}

function renderReport(run, plan) {
  const lines = [];
  const byLeaf = leafById(run, plan);
  const gq = governingQuestion(run, plan);
  lines.push('## Governing question');
  lines.push('');
  lines.push(gq);
  lines.push('');
  lines.push('Governing thought: ' + oneLine(run.governing_status || 'unresolved') + '. ' + oneLine(run.answer_line || ''));
  lines.push('');
  lines.push('Run ' + oneLine(run.run_id) + ' (' + oneLine(run.mode) + ' run). Stop reason: ' + oneLine(run.stop_reason || 'unknown') + '.'
    + (nonEmpty(run.verdict) ? ' Verdict: ' + oneLine(run.verdict) + '.' : ''));
  lines.push('');

  const py = run.pyramid || plan.pyramid || {};
  lines.push('## Updated pyramid');
  lines.push('');
  list(py.key_line).forEach(function (k) {
    lines.push('- ' + oneLine(k.label || k.id) + ' (' + oneLine(k.status || 'unresolved') + '): leaves ' + list(k.leaf_ids).join(', '));
  });
  if (list(py.key_line).length === 0) lines.push('- No branches recorded.');
  lines.push('');

  lines.push('## Leaves');
  lines.push('');
  const leafIds = list(plan.leaves).map(function (l) { return l && l.id; }).filter(nonEmpty);
  Object.keys(byLeaf).forEach(function (id) { if (leafIds.indexOf(id) === -1) leafIds.push(id); });
  leafIds.forEach(function (id) {
    const leaf = byLeaf[id];
    const rs = rowsForLeaf(run, id);
    const status = leaf.researchable === false ? 'not researched (' + oneLine(leaf.not_researchable_reason || 'room only') + ')' : oneLine(leaf.status || 'unresolved');
    lines.push('- ' + id + ' (' + status + '): ' + oneLine(leaf.question) + (rs.length > 0 ? ' ' + citeList(rs) : ' No validated row.'));
  });
  lines.push('');

  const evidence = rowsOf(run);
  lines.push('## Evidence rows (' + evidence.length + ')');
  lines.push('');
  if (evidence.length === 0) lines.push('- No validated row bears on the question.');
  evidence.forEach(function (row) {
    lines.push('- ' + evidenceRows.renderRowCitation(row, { withQuote: true }) + ' ' + oneLine(row.label) + ' for ' + oneLine(row.leaf_id)
      + ': ' + short(row.source_title, 120) + ' (' + oneLine(row.source_url || row.record_id) + ')');
  });
  lines.push('');

  const contradictions = list(run.contradictions);
  lines.push('## Contradictions held');
  lines.push('');
  if (contradictions.length === 0) lines.push('- None.');
  contradictions.forEach(function (c) {
    lines.push('- ' + oneLine(c.leaf_id) + ' keeps rows on both sides: ' + list(c.row_ids).map(function (id) { return '[' + oneLine(id) + ']'; }).join(' '));
  });
  lines.push('');

  lines.push('## Limiters');
  lines.push('');
  const cls = list(run.classifications);
  if (cls.length === 0) lines.push('- No limiter was classified in this run.');
  cls.forEach(function (c) {
    lines.push('- ' + oneLine(c.limiter_id) + ' (' + oneLine(c.column) + '): ' + oneLine(c.statement) + (list(c.basis_row_ids).length > 0 ? ' ' + list(c.basis_row_ids).map(function (id) { return '[' + oneLine(id) + ']'; }).join(' ') : ''));
  });
  if (nonEmpty(run.next_binding_constraint)) {
    lines.push('');
    lines.push('Next binding constraint: ' + oneLine(run.next_binding_constraint));
  }
  lines.push('');

  lines.push('## Unresolved branches');
  lines.push('');
  const unresolved = list(run.unresolved_branches);
  if (unresolved.length === 0) lines.push('- None named.');
  unresolved.forEach(function (b) { lines.push('- ' + oneLine(b)); });
  lines.push('');

  const disc = discardedList(run, plan);
  lines.push('## Discarded paths');
  lines.push('');
  if (disc.length === 0) lines.push('- None.');
  disc.forEach(function (d) { lines.push('- ' + oneLine(d.kind) + ' ' + oneLine(d.id) + ': ' + oneLine(d.reason || 'no reason given')); });
  lines.push('');

  lines.push('## Where things live');
  lines.push('');
  lines.push('plan.json holds the plan and the perspective ratchet (settled constraints and discarded paths). ledger.json holds this run audit slice, its query hashes and the forward links to every node and card filed from it. records.json and rows.json hold the source ids, titles, content hashes and the validated rows.');
  return noDash(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Records index for the run home (ids, titles and content hashes)
// ---------------------------------------------------------------------------
function buildRecordsIndex(roomDir, run) {
  const out = [];
  const seen = {};
  const add = function (id, title, hash, extra) {
    if (!nonEmpty(id) || seen[id]) return;
    seen[id] = true;
    out.push(Object.assign({ id: id, title: nonEmpty(title) ? oneLine(title) : '', content_hash: nonEmpty(hash) ? hash : null }, extra || {}));
  };
  try {
    const rel = nonEmpty(run.records_path) ? run.records_path : path.join('.mindrian', 'research-runs', run.run_id, 'records.json');
    const abs = path.resolve(roomDir, rel);
    if (insideRoom(roomDir, abs)) {
      const st = readJsonSafe(abs);
      list(st && st.records).forEach(function (rec) {
        if (!isObj(rec)) return;
        add(String(rec.record_id || rec.id || ''), rec.title || rec.display_name, rec.content_hash, {
          q_hash: nonEmpty(rec.q_hash) ? rec.q_hash : null,
          leaf_ids: list(rec.leaf_ids).filter(nonEmpty),
        });
      });
    }
  } catch (_e) { /* fall back to rows */ }
  rowsOf(run).forEach(function (row) { add(row.record_id, row.source_title, row.content_hash); });
  return out;
}

// ---------------------------------------------------------------------------
// fileRun
// ---------------------------------------------------------------------------
function refuse(reason, extra) {
  return Object.assign({ ok: false, reason: reason }, extra || {});
}

function checkAuthority(selection, basket) {
  if (!isObj(selection)) return refuse('no_approved_selection');
  const carriesGrant = GRANT_KEYS.some(function (k) { return Object.prototype.hasOwnProperty.call(selection, k); });
  if (carriesGrant) return refuse('grant_not_authority');
  if (selection.approved !== true) return refuse('no_approved_selection');
  if (!Array.isArray(selection.items) || selection.items.length === 0) return refuse('no_items_selected');
  const known = {};
  basket.forEach(function (i) { known[i.id] = true; });
  const unknown = selection.items.filter(function (id) { return typeof id !== 'string' || !known[id]; });
  if (unknown.length > 0) return refuse('unknown_item', { items: unknown.slice(0, 5).map(function (id) { return String(id).slice(0, 60); }) });
  return null;
}

function fileRun(roomDir, run, plan, selection, opts) {
  try {
    return fileRunInner(roomDir, run, plan, selection, isObj(opts) ? opts : {});
  } catch (e) {
    return refuse('file_run_threw', { detail: String((e && e.message) || e).slice(0, 120) });
  }
}

function fileRunInner(roomDir, run, plan, selection, opts) {
  if (!nonEmpty(roomDir) || !isObj(run) || !isObj(plan)) return refuse('invalid_params');
  if (!RUN_ID_RE.test(String(run.run_id)) || run.run_id !== plan.run_id) return refuse('run_id_mismatch');

  const basket = buildBasket(run, plan);
  // Canon release and confirm items are answered through their own gates, never filed (366-11): they are
  // dropped from the selection here and named in the result.
  let ignoredItems = [];
  if (isObj(selection) && Array.isArray(selection.items)) {
    ignoredItems = selection.items.filter(function (id) { return typeof id === 'string' && CANON_ITEM_RE.test(id); });
    if (ignoredItems.length > 0) {
      selection = Object.assign({}, selection, { items: selection.items.filter(function (id) { return !(typeof id === 'string' && CANON_ITEM_RE.test(id)); }) });
    }
  }
  const denied = checkAuthority(selection, basket);
  if (denied) return denied;

  const selected = {};
  selection.items.forEach(function (id) { selected[id] = true; });
  // The run home is the anchor every other item links to, so it always comes along.
  const homeAdded = selected.run_home !== true;
  selected.run_home = true;

  let db = opts.db || null;
  const ownDb = !db;
  if (!db) db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return refuse('room_db_unavailable');
  try {
    const out = writeSelected(roomDir, run, plan, basket, selected, homeAdded, db, opts);
    if (ignoredItems.length > 0 && isObj(out)) out.ignored_items = ignoredItems.slice(0, 20);
    return out;
  } finally {
    if (ownDb) navigation.closeRoomDbForCaller(db);
  }
}

function writeSelected(roomDir, run, plan, basket, selected, homeAdded, db, opts) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowIso = now.toISOString();
  const date = nowIso.slice(0, 10);
  const approvedVia = nonEmpty(opts.approvedVia) ? opts.approvedVia : 'f8-basket';
  const sid = 'research:' + run.run_id;
  const section = sectionOf(plan);
  const byLeaf = leafById(run, plan);
  const byRow = rowById(run);
  const items = basket.filter(function (i) { return selected[i.id]; });

  const report = {
    landed: [],
    not_landed: [],
    notes: [],
    leaf_nodes: {},
    evidence_claims: {},
    limiter_nodes: {},
    discarded_nodes: {},
    discarded_note: 'Every discarded path and its reason is kept in plan.json under perspective.ratchet.discarded.',
    opportunities: [],
    section_link: null,
    rollup: null,
    edges: { written: 0, failed: 0 },
  };
  const miss = function (what, reason) { report.not_landed.push({ what: what, reason: String(reason || 'unknown').slice(0, 80) }); };
  if (homeAdded) report.notes.push('The run home is always filed with anything else, so it was added to your selection.');

  // ---- 1. run home
  const gq = governingQuestion(run, plan);
  const hex8 = String(run.run_id).slice(-8);
  const stem = slugify(gq).slice(0, 40).replace(/-+$/g, '') || 'research';
  const slug = date + '-' + stem + '-' + hex8;
  const urls = [];
  rowsOf(run).forEach(function (row) {
    const u = nonEmpty(row.source_url) ? row.source_url : null;
    if (u && urls.indexOf(u) === -1) urls.push(u);
  });
  const filed = researchFiling.fileResearchArtifact(roomDir, {
    topicHandles: [gq],
    body: renderReport(run, plan),
    sources: urls.map(function (u) { return { url: u, accessed: date }; }),
    slug: slug,
    date: date,
    db: db,
    frontmatterExtra: {
      run_id: run.run_id,
      run_mode: nonEmpty(run.mode) ? run.mode : 'quick',
      plan_hash: nonEmpty(run.plan_hash) ? run.plan_hash : 'unknown',
      governing_status: nonEmpty(run.governing_status) ? run.governing_status : 'unresolved',
      stop_reason: nonEmpty(run.stop_reason) ? run.stop_reason : 'unknown',
    },
  });
  if (!filed || filed.ok !== true) {
    return refuse('run_home_failed', { detail: filed && (filed.detail || filed.reason), report: report });
  }
  const homeRel = path.posix.dirname(filed.relPath);
  const homeAbs = path.join(roomDir, homeRel);
  const reportRel = filed.relPath;
  const homeNode = filed.node_id;
  report.landed.push('run home ' + homeRel + '/');

  const selectedLimiters = items.filter(function (i) { return i.kind === 'settled_limiter'; });
  const selectedClasses = list(run.classifications).filter(function (c) {
    return isObj(c) && selectedLimiters.some(function (i) { return i.limiter_id === c.limiter_id; });
  });
  const nextRatchet = perspectiveMod.nextVersion(plan, {
    run_id: run.run_id,
    classifications: selectedClasses.map(function (c) { return { limiter_id: c.limiter_id, statement: c.statement, column: c.column, basis_row_ids: c.basis_row_ids }; }),
    discarded: [],
  });
  const ratchetDiscarded = [];
  const seenDiscard = {};
  list(nextRatchet.discarded).concat(discardedList(run, plan)).forEach(function (d) {
    if (!isObj(d) || !nonEmpty(d.id)) return;
    const k = d.kind + ':' + d.id;
    if (seenDiscard[k]) return;
    seenDiscard[k] = true;
    ratchetDiscarded.push(d);
  });
  const homePlan = clone(plan);
  homePlan.perspective = clone(isObj(run.perspective) ? run.perspective : plan.perspective);
  homePlan.perspective.ratchet = {
    version: nextRatchet.version,
    parent_plan_hash: nextRatchet.parent_plan_hash,
    discarded: ratchetDiscarded,
    settled: nextRatchet.settled,
  };
  homePlan.run_ref = { run_id: run.run_id, mode: run.mode, filed_at: nowIso };

  const auditSlice = auditLedger.sliceForRun(roomDir, run.run_id);
  const qHashes = [];
  auditSlice.concat(list(run.queries)).forEach(function (q) {
    if (isObj(q) && nonEmpty(q.q_hash) && qHashes.indexOf(q.q_hash) === -1) qHashes.push(q.q_hash);
  });
  const ledger = {
    schema: LEDGER_SCHEMA,
    run_id: run.run_id,
    plan_hash: run.plan_hash || null,
    filed_at: nowIso,
    approved_via: approvedVia,
    audit: auditSlice,
    q_hashes: qHashes,
    links: {},
  };
  try {
    writeJson(path.join(homeAbs, 'plan.json'), homePlan);
    writeJson(path.join(homeAbs, 'ledger.json'), ledger);
    writeJson(path.join(homeAbs, 'records.json'), { schema: RECORDS_SCHEMA, run_id: run.run_id, records: buildRecordsIndex(roomDir, run) });
    writeJson(path.join(homeAbs, 'rows.json'), { schema: ROWS_SCHEMA, run_id: run.run_id, rows: rowsOf(run), dropped: isObj(run.dropped) ? run.dropped : {} });
    report.landed.push('plan.json, ledger.json, records.json, rows.json');
  } catch (e) {
    miss('run home JSON files', e && e.message);
  }

  const edge = function (source, target, type, props) {
    const res = navigation.writeEdge(db, { source_id: source, target_id: target, edge_type: type, properties: props || {}, review_status: 'proposed' });
    if (res && res.ok === true) report.edges.written += 1;
    else { report.edges.failed += 1; miss('edge ' + type, res && res.reason); }
    return !!(res && res.ok === true);
  };

  // ---- 2. leaves become open-question nodes
  Object.keys(byLeaf).forEach(function (id) {
    const leaf = byLeaf[id];
    if (leaf.researchable === false) return;
    const res = navigation.writeOpenQuestionNode(db, {
      question: oneLine(leaf.question),
      sessionId: sid,
      source: ORIGIN,
      extraProps: { leaf_id: id, run_id: run.run_id, leaf_status: leaf.status || 'unresolved', run_home: homeRel },
    });
    if (res && res.ok === true) report.leaf_nodes[id] = res.node_id;
    else miss('open question ' + id, res && res.reason);
  });
  if (Object.keys(report.leaf_nodes).length > 0) report.landed.push(Object.keys(report.leaf_nodes).length + ' open-question node(s)');

  // ---- 3. evidence claims, one per unique URL per run session
  const evidenceFor = function (row) {
    const url = nonEmpty(row.source_url) ? row.source_url : (nonEmpty(row.record_id) ? row.record_id : null);
    if (!url) { miss('evidence for ' + row.row_id, 'no_url'); return null; }
    if (report.evidence_claims[url]) return report.evidence_claims[url];
    const res = navigation.fileEvidenceWithReadback(db, {
      topic: oneLine(row.source_title || url),
      source: 'OpenAlex',
      url: url,
      retrieved_at: nonEmpty(row.retrieved_at) ? row.retrieved_at : nowIso,
      evidence_tier: EVIDENCE_TIERS.indexOf(row.evidence_tier) !== -1 ? row.evidence_tier : 'Practitioner',
      summary: oneLine(row.claim || ''),
      sessionId: sid,
      artifact_path: reportRel,
    });
    if (res && res.ok === true) {
      report.evidence_claims[url] = res.node_id;
      return res.node_id;
    }
    miss('evidence claim for ' + url, res && res.reason);
    return null;
  };

  const settleEdges = function (leafId) {
    const leafNode = report.leaf_nodes[leafId];
    if (!leafNode) { miss('evidence edges for ' + leafId, 'leaf_node_missing'); return; }
    rowsForLeaf(run, leafId).filter(settledLabel).forEach(function (row) {
      const ev = evidenceFor(row);
      if (!ev) return;
      const type = row.label === 'contradicts' ? 'CONTRADICTS' : 'SUPPORTS';
      edge(ev, leafNode, type, { relation: type.toLowerCase(), row_id: String(row.row_id), run_id: run.run_id });
    });
  };
  items.filter(function (i) { return i.kind === 'claim' || i.kind === 'contradiction'; }).forEach(function (i) {
    settleEdges(i.leaf_id);
    report.landed.push((i.kind === 'claim' ? 'evidence for ' : 'held contradiction for ') + i.leaf_id);
  });

  // ---- 4. classified limiters become proposed claim nodes
  selectedLimiters.forEach(function (i) {
    const c = list(run.classifications).filter(function (x) { return x && x.limiter_id === i.limiter_id; })[0];
    if (!c) return;
    const evIds = [];
    list(c.basis_row_ids).forEach(function (rid) {
      const row = byRow[rid];
      if (!row) return;
      const ev = evidenceFor(row);
      if (ev && evIds.indexOf(ev) === -1) evIds.push(ev);
    });
    const nodeId = navigation.REASONING_NODE_ID('claim', 'research-' + run.run_id + '-' + String(c.limiter_id).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const res = navigation.writeReasoningNode(db, {
      nodeId: nodeId,
      nodeType: 'claim',
      epistemicType: c.column === 'physics' ? 'derived_fact' : 'assumption',
      text: oneLine(c.statement) + ' (' + (c.column === 'physics' ? 'physics' : 'assumed') + ' limiter, proposed by research run ' + run.run_id + ')',
      section: section || undefined,
      sourcePath: 'research-limiter:' + run.run_id + ':' + c.limiter_id,
      evidenceNodeIds: evIds,
      origin: ORIGIN,
    });
    if (res && res.ok === true) { report.limiter_nodes[c.limiter_id] = res.node_id; report.landed.push('limiter ' + c.limiter_id + ' as a proposed claim'); }
    else miss('limiter ' + c.limiter_id, res && res.reason);
  });

  // ---- 5. discarded paths (rejection is data)
  items.filter(function (i) { return i.kind === 'discarded_path'; }).forEach(function (i) {
    const d = ratchetDiscarded.filter(function (x) { return x.kind === i.discard_kind && x.id === i.discard_id; })[0];
    if (!d) return;
    const nodeId = navigation.REASONING_NODE_ID('decision', 'research-' + run.run_id + '-' + slugify(d.kind + '-' + d.id));
    const res = navigation.writeReasoningNode(db, {
      nodeId: nodeId,
      nodeType: 'decision',
      epistemicType: 'decision',
      text: 'Discarded ' + oneLine(d.kind) + ' ' + oneLine(d.id) + ' in research run ' + run.run_id + ': ' + oneLine(d.reason || 'no reason given'),
      section: section || undefined,
      sourcePath: 'research-discard:' + run.run_id + ':' + d.kind + ':' + d.id,
      origin: ORIGIN,
    });
    if (!res || res.ok !== true) { miss('discarded ' + d.id, res && res.reason); return; }
    const linked = edge(nodeId, homeNode, 'REJECTED_BECAUSE', { reason: slugify(d.reason || 'unspecified').slice(0, 40) || 'unspecified', kind: String(d.kind) });
    if (linked) { report.discarded_nodes[d.id] = nodeId; report.landed.push('discarded ' + d.kind + ' ' + d.id); }
  });

  // ---- 6. opportunities
  const candidates = list(run.opportunity_candidates);
  items.filter(function (i) { return i.kind === 'opportunity'; }).forEach(function (i) {
    const cand = candidates[i.index];
    if (!candidateOffered(cand)) return;
    if (cand.kind === 'funding_signal') {
      const res = opportunityOps.fileOpportunity(roomDir, {
        title: cand.program,
        program: cand.program,
        funder: cand.funder,
        source: ORIGIN,
        relevance_reasoning: 'Found by research run ' + run.run_id + ' (see ' + homeRel + ').',
      });
      if (res && res.filed) {
        const rel = relPosix(path.relative(roomDir, res.path));
        report.opportunities.push({ item_id: i.id, kind: 'funding_signal', funder: cand.funder, program: cand.program, path: rel });
        report.landed.push('funding signal ' + oneLine(cand.funder) + ' - ' + oneLine(cand.program));
      } else miss('funding signal ' + i.id, 'file_opportunity_failed');
      return;
    }
    const limiter = list(plan.perspective && plan.perspective.limiters).filter(function (l) { return l && l.id === cand.limiter_id; })[0];
    const leaf = byLeaf[list(cand.leaf_ids)[0]];
    const subject = limiter ? limiter.statement : (leaf ? leaf.question : cand.kind);
    const name = short('Research ' + oneLine(cand.kind).replace(/_/g, ' ') + ' - ' + subject, 140);
    const evIds = [];
    list(cand.row_ids).forEach(function (rid) {
      const row = byRow[rid];
      if (!row) return;
      const ev = evidenceFor(row);
      if (ev && evIds.indexOf(ev) === -1) evIds.push(ev);
    });
    const extraProps = {
      run_id: run.run_id,
      candidate_kind: cand.kind,
      run_home: homeRel,
      leaf_ids: list(cand.leaf_ids).join(','),
      row_ids: list(cand.row_ids).join(','),
    };
    // 366-02 (D-04, D-15): a perspective pair (any kind) files with the 355
    // stamp, merged exactly as filing-stamped.fileStampedOpportunity merges it.
    // stampForPair never calls a tool: an unresolved handle degrades to
    // not_called / handle_unresolved, a recorded Theo lane stamp is reused.
    const pair = isObj(cand.pair) && nonEmpty(cand.pair.a) && nonEmpty(cand.pair.b) ? cand.pair : null;
    if (pair) {
      const stamp = filingStamped.stampForPair(pair, {
        db: db,
        roomDir: roomDir,
        runHomes: [path.join(STATE_DIR, run.run_id), homeRel],
      });
      Object.assign(extraProps, verificationStamp.toNodeProps(stamp));
      const pwsStage = filingStamped.readPwsStage(roomDir);
      if (pwsStage) extraProps.pws_stage = pwsStage;
      extraProps.engine_mode = run.trigger === 'ambient' ? 'ambient' : 'navigator';
      extraProps.pair_perspective = pair.perspective || null;
      // the eureka exclusion set reads an opportunity's evidence pair, so a filed
      // pair is never recalled again as new
      extraProps.evidence_ids = [pair.a, pair.b];
    }
    const node = navigation.writeOpportunityNode(db, {
      name: name,
      sessionId: sid,
      lifecycle: 'candidate',
      lens: ORIGIN,
      section: section || undefined,
      extraProps: extraProps,
      actor: ORIGIN,
      reason: oneLine(cand.reason || 'research candidate'),
      evidence_ids: pair ? evIds.concat([pair.a, pair.b].filter(function (x) { return evIds.indexOf(x) === -1; })) : evIds,
    });
    if (!node || node.ok !== true) { miss('opportunity ' + i.id, node && node.reason); return; }
    const cardRel = 'opportunity-bank/' + date + '-research-' + (slugify(name).slice(0, 50).replace(/-+$/g, '') || 'candidate') + '-' + i.index + '.md';
    const cardLines = [
      '---',
      'methodology: research-opportunity',
      'created: ' + date,
      'source: ' + ORIGIN,
      'opportunity_id: "' + node.node_id + '"',
      'run_id: ' + run.run_id,
      'run_home: ' + homeRel,
      'status: proposed',
      '---',
      '',
      '# ' + name,
      '',
      '## Why this is a candidate',
      '',
      oneLine(cand.reason || ''),
      '',
      '## Evidence',
      '',
    ];
    const cited = list(cand.row_ids).map(function (rid) { return byRow[rid]; }).filter(Boolean);
    if (cited.length === 0) cardLines.push('- No row cited; the candidate rests on the absence of a hit.');
    cited.forEach(function (row) { cardLines.push('- ' + evidenceRows.renderRowCitation(row) + ' ' + short(row.source_title, 100)); });
    cardLines.push('');
    cardLines.push('Run home: ' + homeRel + '/ ([report](../' + reportRel + '))');
    cardLines.push('');
    try {
      writeAtomic(path.join(roomDir, cardRel), noDash(cardLines.join('\n')));
    } catch (e) { miss('opportunity card ' + i.id, e && e.message); }
    edge(node.node_id, homeNode, 'DERIVED_FROM', { relation: 'derived_from', run_id: run.run_id });
    if (pair) {
      edge(node.node_id, cand.pair.a, 'DERIVED_FROM', { relation: 'derived_from', run_id: run.run_id });
      edge(node.node_id, cand.pair.b, 'DERIVED_FROM', { relation: 'derived_from', run_id: run.run_id });
    }
    evIds.forEach(function (ev) {
      const res = navigation.linkOpportunityEvidence(db, { opportunity_id: node.node_id, target_id: ev, edge_type: 'SUPPORTS' });
      if (res && res.ok === true) report.edges.written += 1; else { report.edges.failed += 1; miss('opportunity evidence edge', res && res.reason); }
    });
    report.opportunities.push({ item_id: i.id, kind: cand.kind, node_id: node.node_id, card_path: cardRel });
    report.landed.push('opportunity ' + oneLine(cand.kind));
  });

  // ---- 7. the run home is linked to the originating section
  if (section) {
    const target = 'section:' + section;
    const ok = edge(homeNode, target, 'INFORMS', { relation: 'informs', run_id: run.run_id });
    report.section_link = { ok: ok, edge_type: 'INFORMS', target: target };
    if (ok) report.landed.push('link from the run home to section ' + section);
  }

  // ---- 8. roll the pyramid up into the section reasoning
  if (selected.rollup) report.rollup = rollUpInto(roomDir, section, run, byLeaf, miss);

  // ---- 9. forward links in the run home, and the filed marker
  ledger.links = {
    run_home_node: homeNode,
    report: reportRel,
    leaf_nodes: report.leaf_nodes,
    evidence_claims: report.evidence_claims,
    limiter_nodes: report.limiter_nodes,
    discarded_nodes: report.discarded_nodes,
    opportunities: report.opportunities,
    section_link: report.section_link,
    rollup: report.rollup,
  };
  try {
    writeJson(path.join(homeAbs, 'ledger.json'), ledger);
  } catch (e) { miss('ledger forward links', e && e.message); }
  markFiled(roomDir, run, homeRel, approvedVia, items, nowIso, report);

  report.partial = report.not_landed.length > 0;
  return {
    ok: true,
    run_home: { rel: homeRel, abs: homeAbs, report: reportRel, node_id: homeNode, slug: slug },
    report: report,
  };
}

// ---------------------------------------------------------------------------
// Roll-up into <room>/.reasoning/<section>/REASONING.md
// ---------------------------------------------------------------------------
const MINTO_NOTE = 'MINTO.md is not edited here; it regenerates on the next vault-section-minto generator run.';

function violationKeys(file) {
  try {
    return mintoInvariants.validate(file).violations.map(function (v) { return v.category + '|' + v.message; });
  } catch (_e) { return null; }
}

function rollUpInto(roomDir, section, run, byLeaf, miss) {
  if (!section) return { ok: false, reason: 'no_section', note: MINTO_NOTE };
  const fm = reasoningOps.getReasoningFrontmatter(roomDir, section);
  if (!isObj(fm) || fm.error) {
    miss('roll-up', 'no_reasoning_file');
    return { ok: false, reason: 'no_reasoning_file', section: section, note: 'No REASONING.md exists for ' + section + ' yet, so nothing was rolled up. ' + MINTO_NOTE };
  }
  const file = path.join(path.resolve(roomDir), '.reasoning', section, 'REASONING.md');
  let before = null;
  try { before = fs.readFileSync(file, 'utf8'); } catch (_e) { before = null; }
  const violationsBefore = violationKeys(file);

  const conf = isObj(fm.confidence) ? clone(fm.confidence) : {};
  ['high', 'medium', 'low'].forEach(function (k) { conf[k] = list(conf[k]).map(String); });
  const ver = isObj(fm.verification) ? clone(fm.verification) : { status: 'pending' };
  ver.must_be_true = list(ver.must_be_true).map(String);
  let added = 0;
  const push = function (arr, text) {
    if (arr.indexOf(text) === -1) { arr.push(text); added += 1; }
  };
  Object.keys(byLeaf).forEach(function (id) {
    const leaf = byLeaf[id];
    if (leaf.researchable === false) return;
    const rs = rowsForLeaf(run, id).filter(settledLabel);
    const cites = rs.map(function (r) { return r.row_id; }).join(' ');
    const head = 'Research ' + run.run_id + ' ' + id;
    if (leaf.status === 'supported') {
      push(conf.high, yamlItem(head + ' supported ' + cites + ' ' + leaf.question));
      push(ver.must_be_true, yamlItem(head + ' supported by ' + cites + ' so ' + leaf.question));
    } else if (leaf.status === 'contradicted') {
      push(conf.low, yamlItem(head + ' contradicted ' + cites + ' ' + leaf.question));
      push(ver.must_be_true, yamlItem(head + ' contradicted by ' + cites + ' so ' + leaf.question + ' needs a new answer'));
    } else if (leaf.status === 'contested') {
      push(conf.medium, yamlItem(head + ' contested ' + cites + ' ' + leaf.question));
      push(ver.must_be_true, yamlItem(head + ' contested by ' + cites + ' so ' + leaf.question + ' needs a decision'));
    }
  });
  if (added === 0) return { ok: true, section: section, fields: [], entries: 0, note: 'Nothing new to roll up. ' + MINTO_NOTE };

  const merged = reasoningOps.mergeReasoningFrontmatter(roomDir, section, { confidence: conf, verification: ver });
  if (!merged || merged.error || merged.merged !== true) {
    miss('roll-up', merged && merged.error);
    return { ok: false, reason: 'merge_failed', section: section, note: MINTO_NOTE };
  }
  const violationsAfter = violationKeys(file);
  if (violationsBefore && violationsAfter) {
    const fresh = violationsAfter.filter(function (v) { return violationsBefore.indexOf(v) === -1; });
    if (fresh.length > 0) {
      // Put the file back exactly as it was: a roll-up that breaks an invariant does not stay.
      if (before !== null) { try { fs.writeFileSync(file, before, 'utf8'); } catch (_e) { /* reported below */ } }
      miss('roll-up', 'invariant_violation');
      return { ok: false, reason: 'invariant_violation', section: section, violations: fresh.slice(0, 3), note: MINTO_NOTE };
    }
  }
  return { ok: true, section: section, fields: merged.fields, entries: added, path: relPosix(path.relative(roomDir, file)), note: MINTO_NOTE };
}

// ---------------------------------------------------------------------------
// Filed marker in the machine state dir (unfiled state stays there until the yes)
// ---------------------------------------------------------------------------
function markFiled(roomDir, run, homeRel, approvedVia, items, nowIso, report) {
  try {
    const dir = path.join(roomDir, '.mindrian', 'research-runs', run.run_id);
    fs.mkdirSync(dir, { recursive: true });
    writeJson(path.join(dir, 'filing.json'), {
      schema: FILING_SCHEMA,
      run_id: run.run_id,
      filed: true,
      filed_at: nowIso,
      approved_via: approvedVia,
      run_home: homeRel,
      items: items.map(function (i) { return i.id; }),
    });
    // A deep RunResult may carry filed:true; a quick one may not (plan.cjs validateRunResult),
    // so a quick run keeps filed:false in run.json and filing.json is its marker.
    if (run.mode === 'deep') {
      const runFile = path.join(dir, 'run.json');
      const saved = readJsonSafe(runFile);
      if (isObj(saved)) { saved.filed = true; writeJson(runFile, saved); }
    }
  } catch (e) {
    report.not_landed.push({ what: 'filed marker', reason: String((e && e.message) || e).slice(0, 80) });
  }
}

module.exports = {
  buildBasket: buildBasket,
  basketWithCanon: basketWithCanon,
  isCanonItem: isCanonItem,
  basketCard: basketCard,
  checkAuthority: checkAuthority,
  fileRun: fileRun,
};
