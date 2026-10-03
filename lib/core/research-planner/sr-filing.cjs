'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 06 -- filing the Scientific Roadmapping plan (layer: graph).
 *
 * The door-side F.8 basket for /mos:scientific-roadmap. filing.buildBasket only
 * covers finished research runs (finding F10), so the plan basket lives here and
 * reuses two things from filing.cjs: basketCard (the F.8 card) and
 * checkAuthority (the one authority rule for every research filing).
 *
 * Rules this module keeps:
 *   - THEO-C output rule: room/research-plan/PLAN.md is filed through the F.8
 *     basket, names its rung and lists every step as run, not_run (with its
 *     stand-in) or declined. Step labels come only from Theo, through the
 *     door state (state.theo.steps by state.theo.map); never from a local
 *     step template.
 *   - ROOT: the plan names its rung.
 *   - Canon Part 9: every claim lands review_status proposed; only a human
 *     confirms one.
 *   - Rejection is data: every discarded route becomes a decision node with a
 *     REJECTED_BECAUSE edge to the PLAN.md artifact node.
 *   - Nothing is written before checkAuthority passes: a missing, unapproved,
 *     grant-carrying or unknown-item selection writes zero files and zero nodes.
 *   - Every SQL write goes through lib/core/navigation.cjs, the single chokepoint.
 *   - No network, no Brain call. Hyphens only; no grades or scores in rendered text.
 *
 * Contract (plan 364-09 depends on these names): PLAN_REL, HISTORY_REL,
 * buildPlanBasket, planBasketCard, renderPlanMd, filePlan.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const navigation = require('../navigation.cjs');
const researchFiling = require('../semantic-index/research-filing.cjs');
const filing = require('./filing.cjs');
const door = require('./sr-door.cjs');

const PLAN_REL = 'research-plan/PLAN.md';
const HISTORY_REL = 'research-plan/history';
const PLAN_DIR = 'research-plan';
const STATE_SCHEMA = 'mos.sr-door-state/1';
const ORIGIN = 'scientific-roadmap';
const RUN_TAG_RE = /^sr-\d{8}-[0-9a-f]{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAGE_A = Object.freeze(['sr:1', 'sr:2', 'sr:3', 'sr:4', 'sr:5', 'sr:6', 'sr:7']);
const MAX_LABEL = 160;
const EXCERPT = 60;
const CLAIM_SUMMARY = 240;

// ------------------------------------------------------------------ helpers
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

// Hyphens only. DASH_RE is spelled with escapes so this file carries no dash character itself.
const DASH_RE = new RegExp('[\\u2013\\u2014\\u2212]', 'g');
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u001f\u007f]+/g;
function dashFree(s) { return String(s == null ? '' : s).replace(DASH_RE, '-'); }
// dash-free and control characters flattened to a space (single-line values)
function noDash(s) { return dashFree(s).replace(CTRL_RE, ' '); }
function oneLine(s) { return noDash(s).replace(/\s+/g, ' ').trim(); }
function short(s, n) {
  const t = oneLine(s);
  return t.length > n ? t.slice(0, n - 3).trim() + '...' : t;
}
function slugify(s) { return oneLine(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function yq(s) { return researchFiling._internal.yamlQuote(oneLine(s)); }
function refuse(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }

// stageB records the plan as { run_id }; an older or hand-built state may carry the id as a string.
function planRunId(state) {
  const r = state && state.plan_ref;
  if (isObj(r)) return r.run_id;
  return r;
}

function validState(state) {
  return isObj(state) && state.schema === STATE_SCHEMA && isObj(state.stages) && isObj(state.entry)
    && isObj(state.entry.what) && isObj(state.theo) && Array.isArray(state.theo.steps);
}

// ---------------------------------------------------------- Theo step labels
function theoLabel(state, stageId) {
  const map = isObj(state.theo.map) ? state.theo.map : {};
  const id = map[stageId];
  const hit = arr(state.theo.steps).filter(function (s) { return isObj(s) && s.stepId === id; })[0];
  return {
    id: typeof id === 'string' ? id : null,
    label: hit && nonEmpty(hit.label) ? oneLine(hit.label) : null,
  };
}

// ----------------------------------------------------------- stage summaries
function outputOf(state, stageId) {
  const rec = state.stages[stageId];
  if (!isObj(rec) || rec.status !== 'done' || !isObj(rec.output)) return null;
  return rec.output;
}

function listSummary(items, pick) {
  return arr(items).filter(isObj).map(pick).filter(nonEmpty).join(', ');
}

function summarizeStage(state, stageId) {
  const out = outputOf(state, stageId);
  if (!out) return '';
  let t = '';
  if (stageId === 'sr:1') t = isObj(out.tension) ? out.tension.statement : '';
  else if (stageId === 'sr:2') {
    const g = isObj(out.goal) ? out.goal : {};
    t = [g.target, g.threshold, g.unit].filter(nonEmpty).join(' ');
  } else if (stageId === 'sr:3') {
    const p = isObj(out.rung_phrase) ? out.rung_phrase : {};
    t = [p.roadmap_type, p.idea_kind].filter(nonEmpty).join(', ');
  } else if (stageId === 'sr:4') t = listSummary(out.forum, function (f) { return f.role; });
  else if (stageId === 'sr:5') t = listSummary(out.paths, function (p) { return nonEmpty(p.label) ? p.label : p.id; });
  else if (stageId === 'sr:6') t = listSummary(out.limiters, function (l) { return nonEmpty(l.label) ? l.label : (l.statement || l.id); });
  else if (stageId === 'sr:7') {
    t = listSummary(out.unlock_chains, function (c) { return nonEmpty(c.limiter_id) ? c.limiter_id + ' (' + arr(c.steps).length + ' steps)' : ''; });
  }
  return short(t, CLAIM_SUMMARY);
}

function stepStatus(rec) {
  if (!isObj(rec)) return 'not_run';
  if (rec.status === 'done') return 'run';
  if (rec.status === 'not_run') return rec.decision === 'declined' ? 'declined' : 'not_run';
  if (rec.decision === 'reject' || rec.decision === 'defer' || rec.decision === 'declined') return 'declined';
  return 'not_run';
}

function standInText(rec) {
  return isObj(rec) && isObj(rec.stand_in) && nonEmpty(rec.stand_in.kind) && nonEmpty(rec.stand_in.id)
    ? oneLine(rec.stand_in.kind) + ':' + oneLine(rec.stand_in.id) : null;
}

// -------------------------------------------------------------------- basket
function buildPlanBasket(state) {
  const items = [];
  const rung = validState(state) && isObj(state.entry.rung) && nonEmpty(state.entry.rung.rung) ? state.entry.rung.rung : 'unknown';
  items.push({
    id: 'research_plan',
    kind: 'research_plan',
    default_on: true,
    label: short('The plan file ' + PLAN_REL + ', naming its rung (' + rung + ') and every step run or not run', MAX_LABEL),
  });
  if (!validState(state)) return items;
  STAGE_A.forEach(function (stageId) {
    const summary = summarizeStage(state, stageId);
    if (!summary) return;
    const lab = theoLabel(state, stageId).label || stageId;
    items.push({
      id: 'step_claim:' + stageId,
      kind: 'step_claim',
      default_on: true,
      label: short('Claim from ' + lab + ': ' + short(summary, EXCERPT), MAX_LABEL),
    });
  });
  arr(state.discarded).forEach(function (d, i) {
    if (!isObj(d)) return;
    items.push({
      id: 'discarded_route:' + (i + 1),
      kind: 'discarded_route',
      default_on: true,
      label: short('Discarded route ' + short(d.id || 'unnamed', 40) + ': ' + short(d.reason || 'no reason given', EXCERPT), MAX_LABEL),
    });
  });
  return items;
}

function planBasketCard(items) {
  const card = filing.basketCard(items);
  const flat = String(card.body_md);
  const OLD_HEAD = '## File this research run?';
  const NEW_HEAD = '## File this research plan?';
  // filing.basketCard flattens its body onto one line; restore the line breaks here so the first
  // line of the plan card really is the heading, with every other word of the 363 card unchanged.
  let body = flat.indexOf(OLD_HEAD) === 0 ? NEW_HEAD + flat.slice(OLD_HEAD.length) : NEW_HEAD + '\n\n' + flat;
  const firstItem = body.indexOf(' - [');
  const tailAt = body.indexOf('Everything lands as proposed');
  if (firstItem !== -1 && tailAt !== -1 && tailAt > firstItem) {
    const intro = body.slice(NEW_HEAD.length, firstItem).trim();
    const list = arr(items).map(function (i) { return '- [' + (i.default_on ? 'on' : 'off') + '] ' + noDash(i.label); });
    body = [NEW_HEAD, '', intro, '', list.join('\n'), '', body.slice(tailAt)].join('\n');
  }
  return Object.assign({}, card, {
    title: 'File this research plan',
    body_md: dashFree(body),
  });
}

// ------------------------------------------------------------------ rendering
function systemsText(state) {
  const rec = state.stages.systems_pass;
  if (!isObj(rec)) return 'Not recorded.';
  if (rec.status === 'done') return 'Run.' + (rec.reason ? ' ' + oneLine(rec.reason) : '');
  const stand = standInText(rec);
  if (rec.decision === 'declined') return 'Declined. Reason: ' + oneLine(rec.reason || 'none given') + '.';
  if (stand) return 'Not run here. Stood in by ' + stand + '.';
  return 'Not run.' + (rec.reason ? ' Reason: ' + oneLine(rec.reason) + '.' : '');
}

function rankedLimiters(state) {
  const l6 = outputOf(state, 'sr:6');
  const l7 = outputOf(state, 'sr:7');
  const limiters = l6 ? arr(l6.limiters).filter(isObj) : [];
  const chains = {};
  (l7 ? arr(l7.unlock_chains) : []).filter(isObj).forEach(function (c) { chains[c.limiter_id] = arr(c.steps).length; });
  return limiters.map(function (l, i) { return { l: l, i: i, len: chains[l.id] === undefined ? 0 : chains[l.id] }; })
    .sort(function (a, b) { return b.len - a.len || a.i - b.i; });
}

function frontmatterFor(state, date) {
  const rung = isObj(state.entry.rung) && nonEmpty(state.entry.rung.rung) ? state.entry.rung.rung : 'unknown';
  const p3 = outputOf(state, 'sr:3');
  const roadmapType = p3 && isObj(p3.rung_phrase) && nonEmpty(p3.rung_phrase.roadmap_type) ? p3.rung_phrase.roadmap_type : null;
  const fm = [
    '---',
    'methodology: scientific-roadmap',
    'frameworks:',
    '  - "Scientific Roadmapping"',
    '  - "Hypothesis-Driven Problem Solving"',
    'rung: ' + yq(rung),
    'roadmap_type: ' + (roadmapType ? yq(roadmapType) : 'null'),
    'entry_step: ' + (Number.isInteger(state.entry.chosen_step) ? state.entry.chosen_step : 1),
    'run_tag: ' + yq(state.run_tag),
    'plan_ref: ' + (nonEmpty(planRunId(state)) ? yq(planRunId(state)) : 'null'),
    'theo_framework_status: ' + (nonEmpty(state.theo.framework_status) ? yq(state.theo.framework_status) : 'null'),
    'review_status: proposed',
    'filed_on: ' + yq(date),
    'steps:',
  ];
  STAGE_A.forEach(function (stageId) {
    const rec = state.stages[stageId];
    const t = theoLabel(state, stageId);
    const stand = standInText(rec);
    fm.push('  - stage: ' + yq(stageId));
    fm.push('    theo_step_id: ' + (t.id ? yq(t.id) : 'null'));
    fm.push('    theo_label: ' + (t.label ? yq(t.label) : 'null'));
    fm.push('    status: ' + stepStatus(rec));
    fm.push('    stand_in: ' + (stand ? yq(stand) : 'null'));
  });
  fm.push('---');
  return fm.join('\n');
}

function renderPlanMd(state, opts) {
  if (!validState(state)) return '';
  const o = isObj(opts) ? opts : {};
  const date = DATE_RE.test(String(o.date)) ? o.date : new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(frontmatterFor(state, date));
  lines.push('');
  lines.push('# Scientific Roadmapping plan');
  lines.push('');
  lines.push('## What must be delivered');
  lines.push('');
  lines.push(oneLine(state.entry.what.text) + ' (' + oneLine(state.entry.what.kind || 'goal') + ' ' + oneLine(state.entry.what.id) + ')');
  const g = summarizeStage(state, 'sr:2');
  const t = summarizeStage(state, 'sr:1');
  if (t) { lines.push(''); lines.push('Tension: ' + t); }
  if (g) { lines.push(''); lines.push('Goal: ' + g); }
  lines.push('');
  lines.push('Rung: ' + oneLine(isObj(state.entry.rung) ? state.entry.rung.rung : 'unknown') + '. This plan is proposed; only you confirm it.');
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  lines.push('Step labels come from Theo.');
  lines.push('');
  STAGE_A.forEach(function (stageId, i) {
    const rec = state.stages[stageId];
    const lab = theoLabel(state, stageId).label || '(label not available from Theo)';
    const status = stepStatus(rec);
    let tail = status;
    if (status === 'run') tail += ': ' + (summarizeStage(state, stageId) || 'output recorded');
    else if (status === 'not_run') tail += (standInText(rec) ? '. Stand-in: ' + standInText(rec) : '. No stand-in on file');
    else tail += (rec && rec.reason ? '. Reason: ' + oneLine(rec.reason) : '');
    lines.push((i + 1) + '. ' + lab + ' - ' + tail);
  });
  lines.push('');
  lines.push('## Systems pass');
  lines.push('');
  lines.push(systemsText(state));
  lines.push('');
  lines.push('## Ranked limiters');
  lines.push('');
  const ranked = rankedLimiters(state);
  if (ranked.length === 0) lines.push('None recorded.');
  ranked.forEach(function (r, i) {
    const l = r.l;
    lines.push((i + 1) + '. ' + oneLine(l.id || ('L' + (i + 1))) + ' ' + oneLine(l.label || l.statement || '') + ' (' + oneLine(l.column || 'unclassified') + (r.len ? ', unlock chain of ' + r.len + ' steps' : '') + ')');
  });
  if (state.entry.provisional_ranking === true) { lines.push(''); lines.push('The ranking is provisional.'); }
  lines.push('');
  lines.push('## Hypotheses handed to /mos:research');
  lines.push('');
  const hyp = ranked.filter(function (r) { return r.l.column === 'assumed'; });
  if (hyp.length === 0) lines.push('None. No assumed limiter was recorded.');
  hyp.forEach(function (r) {
    lines.push('- ' + oneLine(r.l.id || '') + ': ' + oneLine(r.l.question || r.l.label || r.l.statement || ''));
  });
  lines.push('');
  lines.push('## Settled, not re-argued');
  lines.push('');
  const settled = arr(state.settled_excluded).filter(isObj);
  if (settled.length === 0) lines.push('Nothing from an earlier run is carried here.');
  settled.forEach(function (s) { lines.push('- ' + oneLine(s.statement || s.limiter_id || '')); });
  lines.push('');
  lines.push('## Discarded routes');
  lines.push('');
  const disc = arr(state.discarded).filter(isObj);
  if (disc.length === 0) lines.push('None.');
  disc.forEach(function (d) { lines.push('- ' + oneLine(d.id || 'unnamed') + ' (' + oneLine(d.kind || 'route') + '): ' + oneLine(d.reason || 'no reason given')); });
  lines.push('');
  lines.push(door.rubricLines().replace(/\s+$/, ''));
  lines.push('');
  return dashFree(lines.join('\n'));
}

// -------------------------------------------------------------------- filing
function readFm(md, key) {
  const m = new RegExp('^' + key + ': "?([^"\\n]*)"?$', 'm').exec(String(md).split('\n---\n')[0]);
  return m ? m[1] : null;
}

function moveToHistory(roomDir, planAbs, today, notes) {
  if (!fs.existsSync(planAbs)) return null;
  const old = fs.readFileSync(planAbs, 'utf8');
  const oldDate = readFm(old, 'filed_on');
  const oldTag = readFm(old, 'run_tag');
  const date = DATE_RE.test(String(oldDate)) ? oldDate : today;
  const tag = RUN_TAG_RE.test(String(oldTag)) ? oldTag : 'earlier';
  const histDir = path.join(roomDir, HISTORY_REL);
  fs.mkdirSync(histDir, { recursive: true });
  let name = date + '-' + tag + '-PLAN.md';
  let n = 2;
  while (fs.existsSync(path.join(histDir, name))) { name = date + '-' + tag + '-' + n + '-PLAN.md'; n += 1; }
  fs.renameSync(planAbs, path.join(histDir, name));
  notes.push('The earlier plan was kept as ' + HISTORY_REL + '/' + name + '.');
  return HISTORY_REL + '/' + name;
}

function filePlan(roomDir, state, selection, opts) {
  try {
    return filePlanInner(roomDir, state, selection, isObj(opts) ? opts : {});
  } catch (e) {
    return refuse('file_plan_threw', { detail: String((e && e.message) || e).slice(0, 120) });
  }
}

function filePlanInner(roomDir, state, selection, opts) {
  if (!nonEmpty(roomDir) || !validState(state)) return refuse('invalid_params');
  const basket = buildPlanBasket(state);

  // The one authority rule. Nothing below runs, and nothing is written, until it passes.
  const denied = filing.checkAuthority(selection, basket);
  if (denied) return denied;

  if (!RUN_TAG_RE.test(String(state.run_tag))) return refuse('invalid_run_tag');
  const date = opts.date === undefined ? new Date().toISOString().slice(0, 10) : opts.date;
  if (!DATE_RE.test(String(date))) return refuse('invalid_date');

  const selected = {};
  selection.items.forEach(function (id) { selected[id] = true; });
  const notes = [];
  if (selected.research_plan !== true) {
    selected.research_plan = true;
    notes.push('The research_plan item was added, because every claim and rejection filed here links back to the plan file.');
  }

  let db = opts.db || null;
  const ownDb = !db;
  if (!db) db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return refuse('room_db_unavailable');
  try {
    return writeSelected(roomDir, state, basket, selected, notes, date, db);
  } finally {
    if (ownDb) navigation.closeRoomDbForCaller(db);
  }
}

function writeSelected(roomDir, state, basket, selected, notes, date, db) {
  const report = {
    landed: [], not_landed: [], notes: notes, plan_rel: PLAN_REL, plan_node_id: null,
    claim_nodes: {}, discarded_nodes: {}, edges: { written: 0, failed: 0 },
  };
  const miss = function (what, reason) { report.not_landed.push({ what: what, reason: String(reason || 'unknown').slice(0, 80) }); };

  // 1. the directory identity, then the earlier plan out of the way
  const planDirAbs = path.join(roomDir, PLAN_DIR);
  fs.mkdirSync(planDirAbs, { recursive: true });
  const ident = researchFiling._internal.ensureDirIdentity(planDirAbs, 'research-plan',
    'Scientific Roadmapping plans filed by /mos:scientific-roadmap; each PLAN.md names its rung and every step run or not run.');
  if (ident && ident.ok === false) miss('research-plan/ROOM.md', ident.reason);
  const planAbs = path.join(roomDir, PLAN_REL);
  moveToHistory(roomDir, planAbs, date, notes);

  // 2. the plan file, then its graph node
  const content = renderPlanMd(state, { date: date });
  researchFiling._internal.atomicWrite(planAbs, content);
  report.landed.push(PLAN_REL);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const node = navigation.writeMemoryArtifactNode(db, { section: PLAN_DIR, kind: 'USER', path: PLAN_REL, hash: hash });
  if (!node || node.ok !== true) {
    miss('plan node', node && node.reason);
    return { ok: true, report: report };
  }
  report.plan_node_id = node.node_id;

  const edge = function (source, target, type, props) {
    const res = navigation.writeEdge(db, { source_id: source, target_id: target, edge_type: type, properties: props || {}, review_status: 'proposed' });
    if (res && res.ok === true) report.edges.written += 1;
    else { report.edges.failed += 1; miss('edge ' + type, res && res.reason); }
    return !!(res && res.ok === true);
  };

  // 3. step claims, proposed only
  basket.filter(function (i) { return i.kind === 'step_claim' && selected[i.id] === true; }).forEach(function (i) {
    const stageId = i.id.slice('step_claim:'.length);
    const lab = theoLabel(state, stageId).label || stageId;
    const nodeId = navigation.REASONING_NODE_ID('claim', 'sr-' + state.run_tag + '-' + slugify(stageId));
    const res = navigation.writeReasoningNode(db, {
      nodeId: nodeId,
      nodeType: 'claim',
      epistemicType: 'assumption',
      text: short(lab + ': ' + summarizeStage(state, stageId), CLAIM_SUMMARY + lab.length + 2),
      section: PLAN_DIR,
      sourcePath: 'scientific-roadmap:' + state.run_tag + ':' + stageId,
      origin: ORIGIN,
    });
    if (!res || res.ok !== true) { miss('claim ' + stageId, res && res.reason); return; }
    report.claim_nodes[stageId] = res.node_id;
    if (edge(res.node_id, node.node_id, 'INFORMS', { run_tag: state.run_tag, stage: stageId })) report.landed.push('claim ' + stageId + ' as proposed');
  });

  // 4. discarded routes, rejection is data
  basket.filter(function (i) { return i.kind === 'discarded_route' && selected[i.id] === true; }).forEach(function (i) {
    const n = Number(i.id.slice('discarded_route:'.length));
    const d = arr(state.discarded)[n - 1];
    if (!isObj(d)) return;
    const nodeId = navigation.REASONING_NODE_ID('decision', 'sr-' + state.run_tag + '-discard-' + n);
    const res = navigation.writeReasoningNode(db, {
      nodeId: nodeId,
      nodeType: 'decision',
      epistemicType: 'decision',
      text: 'Discarded ' + oneLine(d.kind || 'route') + ' ' + oneLine(d.id || 'unnamed') + ' in plan ' + state.run_tag + ': ' + oneLine(d.reason || 'no reason given'),
      section: PLAN_DIR,
      sourcePath: 'scientific-roadmap-discard:' + state.run_tag + ':' + n,
      origin: ORIGIN,
    });
    if (!res || res.ok !== true) { miss('discarded route ' + n, res && res.reason); return; }
    const linked = edge(res.node_id, node.node_id, 'REJECTED_BECAUSE', { reason: slugify(d.reason || 'unspecified').slice(0, 40) || 'unspecified', kind: String(d.kind || 'route') });
    if (linked) { report.discarded_nodes[String(n)] = res.node_id; report.landed.push('discarded route ' + n); }
  });

  return { ok: true, report: report };
}

module.exports = {
  PLAN_REL: PLAN_REL,
  HISTORY_REL: HISTORY_REL,
  buildPlanBasket: buildPlanBasket,
  planBasketCard: planBasketCard,
  renderPlanMd: renderPlanMd,
  filePlan: filePlan,
};
