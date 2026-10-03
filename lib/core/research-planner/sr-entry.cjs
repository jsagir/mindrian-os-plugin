'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 04 -- the Scientific Roadmapping entry check and entry
 * resolver. layer: graph
 *
 * Decisions: ROOT (the command starts where the WHAT is known and the HOW is
 * not; no WHAT means route back, the WHAT is never improvised), NV-1 (the WHAT
 * stand-ins are the ratified goal, the governing question or a Door 3
 * hypothesis claim, confirmed at the F.1 gate; no new node type), NR-1 (filed
 * reverse-salient, dominant-design, futures and systems artifacts are read as
 * bound inputs; the bound command is only offered at its own gate), NR-2
 * (mid-journey entry: every skipped step is recorded not_run with the artifact
 * that stands in for it, never fabricated; missing context is disclosed as
 * context_insufficient), ENTRY (--from-hypothesis, the researcher persona).
 *
 * Plan 14 (navigator ruling 2026-10-03, compose with Phases 355 and 355.1):
 * a Phase 355 stamped eureka finding (an opportunity carrying the D-37 flat
 * stamp props and an engine_mode, as filing-stamped.cjs and the eureka
 * perspective filer write it) is a hypothesis in flight (CMP-1). The result
 * gains in_flight rows; each stamp is read through verification-stamp.cjs
 * fromNodeProps and shown through verification-stamp-format.cjs formatStampLines
 * only, so every stamp line is the 355 formatter's own output, never upgraded
 * and never carrying a score (CMP-2). A stamp that fails to read is disclosed
 * as stamp_unreadable. This module holds no stamp glyph of its own.
 *
 * Canon Part 8: LOCAL only. Nothing read here crosses to Theo, and this module
 * requires no brain client and no network module.
 * Canon Part 9: reads only. No node, edge, goal or opportunity stage is
 * written, and no file is created. room.db is opened through the read-only
 * door (openRoomDbReadOnlyForCaller) and closed in a finally.
 *
 * Published contract (plans 05, 08 and 09 depend on these exact names):
 *   ROOTING, ENTRY_RULES, BOUND_KINDS, resolveEntry(roomDir, opts), renderEntry(entry, opts).
 * Plan 14 adds in_flight: [{ opportunity_id, source, lifecycle, name, depends_on,
 * engine_mode, pws_stage, stamp, stamp_lines, stamp_readable }] to the result and
 * opts.surface ('cli', 'cowork' or 'desktop') to renderEntry.
 * resolveEntry never throws: a failed read becomes a context_insufficient code.
 * renderEntry never prints the room's rung (it is read silently).
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const MAX_TEXT = 280;
const MAX_RUNS = 50;
const MAX_ROWS = 5000;
const MAX_IDS = 50;
const MAX_CLAIM_CANDIDATES = 5;
const TEMPLATE_ID = 'scientific-roadmapping';
const STEP_COUNT = 7;
const MAX_DEPENDS = 4;
const MAX_ID_CHARS = 128;
const MAX_MODE_CHARS = 40;
const PWS_STAGES = Object.freeze(['ill_defined', 'extend_opportunity']);
const FLIGHT_LIFECYCLES = Object.freeze(['candidate', 'qualified', 'explored']);
const SURFACES = Object.freeze(['cli', 'cowork', 'desktop']);

const ROOTING = Object.freeze({
  primary: 'WellDefined',
  secondary_bridge: 'IllDefined',
  source: 'navigator ruling 2026-10-01 (364-INPUT.md)',
  ledger_note: 'data/research-shape-ledger.json problem_types predate the ruling and are not read',
});

// First match wins, in this order (SEED-098 mid-journey entry table).
const ENTRY_RULES = Object.freeze([
  Object.freeze({
    when: 'prior_run_plus_new_evidence', step: 1,
    why: 'An earlier run settled some limiters and new evidence has been filed since, so survey again from the start with the prior ledger in hand.',
  }),
  Object.freeze({
    when: 'hypothesis_in_flight', step: 6,
    why: 'A hypothesis is already in flight (an explored opportunity, or a stamped finding a eureka or ambient run filed), so test the limiter it depends on instead of starting over.',
  }),
  Object.freeze({
    when: 'rs_finding', step: 6,
    why: 'A reverse-salient finding is already on file, so classify that claimed bound instead of deriving it again.',
  }),
  Object.freeze({
    when: 'design_or_futures', step: 5,
    why: 'A dominant-design read or a futures scenario is on file, so those variants are the candidate routes already.',
  }),
  Object.freeze({
    when: 'quantified_goal', step: 3,
    why: 'A quantified goal with a baseline, unit, target and horizon is already on file, so the quantifying step is satisfied.',
  }),
  Object.freeze({
    when: 'stated_goal', step: 2,
    why: 'The goal is stated but not yet falsifiable, so put numbers on it before anything else.',
  }),
  Object.freeze({
    when: 'fresh', step: 1,
    why: 'Only the starting question is on file, so qualify the tension first.',
  }),
]);

const BOUND_KINDS = Object.freeze({
  reverse_salients: Object.freeze(['/mos:find-bottlenecks']),
  dominant_designs: Object.freeze(['/mos:dominant-designs']),
  futures: Object.freeze(['/mos:explore-futures']),
  systems: Object.freeze(['/mos:systems-thinking', '/mos:analyze-systems']),
});

const BOUND_SEGMENT = Object.freeze({
  reverse_salients: 'reverse-salients',
  dominant_designs: 'dominant-designs',
  futures: 'futures',
  systems: 'systems',
});

const BOUND_LABEL = Object.freeze({
  reverse_salients: 'reverse salients',
  dominant_designs: 'dominant designs',
  futures: 'futures',
  systems: 'systems reads',
});

const CONTEXT_WORDS = Object.freeze({
  room_db_missing: 'The room has no local graph yet, so only files and the goal state were read.',
  room_db_unreadable: 'The local graph could not be read, so filed artifacts and claims may be missing here.',
  goal_not_quantified: 'No quantified goal is on file, so any ranking from the later steps stays provisional.',
  forum_not_on_file: 'No forum of candidate routes is on file for the steps that were skipped.',
  no_hypothesis_on_file: 'You asked to start from a hypothesis, but none is on file; the other WHAT candidates are shown instead.',
  goal_read_failed: 'The ratified goal could not be read.',
  prior_runs_unreadable: 'The earlier runs under research could not be read.',
  persona_unreadable: 'The persona file could not be read.',
  rung_unreadable: 'The room rung could not be read.',
  stamp_unreadable: 'A filed finding carries a verification stamp that could not be read, so its link is shown as unchecked.',
  resolver_error: 'The entry check hit an unexpected read error and returned what it had.',
});

// ----------------------------------------------------------------- helpers
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function cap(s) {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) : t;
}
function parseProps(raw) {
  try { const p = JSON.parse(raw || '{}'); return isObj(p) ? p : {}; } catch (_e) { return {}; }
}
function segmentRe(seg) { return new RegExp('(^|/)' + seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'); }
const SEGMENT_RES = Object.freeze(Object.keys(BOUND_SEGMENT).reduce(function (acc, k) {
  acc[k] = segmentRe(BOUND_SEGMENT[k]);
  return acc;
}, {}));

function emptyResult() {
  return {
    ok: true,
    what: { status: 'missing', candidates: [] },
    route: null,
    offers: [],
    rung: { rung: 'unknown', source: 'none' },
    rooting: { in_primary: false, note: 'The room rung is not known, so it cannot be placed against ' + ROOTING.primary + '.' },
    proposed_step: null,
    rule: null,
    why: null,
    not_run: [],
    bound: { reverse_salients: [], dominant_designs: [], futures: [], systems: [] },
    offer_bound: [],
    context_insufficient: [],
    provisional_ranking: false,
    explore_opportunity_offer: { offer: false, opportunity_ids: [] },
    in_flight: [],
    persona: { researcher: false },
    prior: { settled_count: 0, new_evidence_ids: [] },
  };
}

// One SELECT against the read-only handle; everything else is classified in memory.
function readNodeRows(db) {
  const segs = Object.keys(BOUND_SEGMENT).map(function (k) { return BOUND_SEGMENT[k]; });
  const like = [];
  const args = [];
  segs.forEach(function (seg) {
    like.push("source_path LIKE ?");
    args.push('%' + seg + '/%');
    like.push("json_extract(properties, '$.path') LIKE ?");
    args.push('%' + seg + '/%');
  });
  const sql = "SELECT id, type, properties, source_path FROM nodes WHERE type IN ('claim', 'opportunity', 'EvidenceClaim') OR "
    + like.join(' OR ') + ' LIMIT ' + MAX_ROWS;
  const stmt = db.prepare(sql);
  return stmt.all.apply(stmt, args);
}

function nodePath(row, props) {
  const parts = [row.source_path, props.path, props.source_path];
  for (let i = 0; i < parts.length; i += 1) {
    if (typeof parts[i] === 'string' && parts[i].length > 0) return parts[i].replace(/\\/g, '/');
  }
  return '';
}

// Scan research/*/plan.json: a scientific-roadmapping run with a quantified goal.
function findQuantifiedRun(roomDir) {
  const base = path.join(roomDir, 'research');
  let names = [];
  try { names = fs.readdirSync(base).sort().slice(0, MAX_RUNS); } catch (_e) { return { run: null, unreadable: false }; }
  let unreadable = false;
  let run = null;
  names.forEach(function (name) {
    if (run) return;
    try {
      const file = path.join(base, name, 'plan.json');
      if (!fs.existsSync(file)) return;
      const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
      const tpl = (isObj(plan.origin) && plan.origin.template_id) || plan.template_id;
      const goal = isObj(plan.perspective) && isObj(plan.perspective.goal) ? plan.perspective.goal : null;
      if (tpl === TEMPLATE_ID && goal && goal.quantified === true) run = name;
    } catch (_e) { unreadable = true; }
  });
  return { run: run, unreadable: unreadable };
}

// A stamped finding: an opportunity whose props carry the flat D-37 stamp
// (string verification and backend) and a non-empty engine_mode.
function isStamped(props) {
  return typeof props.verification === 'string' && typeof props.backend === 'string'
    && typeof props.engine_mode === 'string' && props.engine_mode.length > 0;
}

// The two ends a finding depends on: its own evidence ids, else the evidence
// ids on its first stage-history entry (how the 355 writer records them).
function dependsOn(props) {
  let src = Array.isArray(props.evidence_ids) && props.evidence_ids.length > 0 ? props.evidence_ids : null;
  if (!src && Array.isArray(props.stage_history) && isObj(props.stage_history[0]) && Array.isArray(props.stage_history[0].evidence_ids)) {
    src = props.stage_history[0].evidence_ids;
  }
  return (src || []).filter(function (x) { return typeof x === 'string' && x.length > 0 && x.length <= MAX_ID_CHARS; }).slice(0, MAX_DEPENDS);
}

// One in-flight row. Named fields only: no other prop of the finding (so no
// score) is ever copied. The stamp is read through the 355 modules, lazily; a
// throw becomes stamp_unreadable and no tier word.
function inFlightRow(cand, note) {
  const props = cand.props;
  const row = {
    opportunity_id: cand.id,
    source: cand.stamped ? 'stamped_finding' : 'explored_opportunity',
    lifecycle: props.lifecycle,
    name: cap(props.name),
    depends_on: dependsOn(props),
    engine_mode: cand.stamped && props.engine_mode.length <= MAX_MODE_CHARS ? props.engine_mode : null,
    pws_stage: PWS_STAGES.indexOf(props.pws_stage) !== -1 ? props.pws_stage : null,
    stamp: null,
    stamp_lines: [],
    stamp_readable: null,
  };
  if (!cand.stamped) return row;
  try {
    const stamp = require('../verification-stamp.cjs').fromNodeProps(props);
    row.stamp_lines = require('../verification-stamp-format.cjs').formatStampLines(stamp, 'cli');
    row.stamp = stamp;
    row.stamp_readable = true;
  } catch (_e) {
    row.stamp = null;
    row.stamp_lines = [];
    row.stamp_readable = false;
    note('stamp_unreadable');
  }
  return row;
}

function researcherPersona(roomDir) {
  const userMdOps = require('../user-md-ops.cjs');
  const user = userMdOps.readUserMd(path.join(roomDir, 'USER.md'));
  if (!user || !isObj(user.role_blend)) return false;
  const blend = user.role_blend;
  const r = typeof blend.researcher === 'number' ? blend.researcher : 0;
  if (r <= 0) return false;
  return Object.keys(blend).every(function (k) { return k === 'researcher' || typeof blend[k] !== 'number' || blend[k] <= r; });
}

// ----------------------------------------------------------------- resolver
function resolveEntry(roomDir, opts) {
  const out = emptyResult();
  const o = isObj(opts) ? opts : {};
  const fromHypothesis = o.fromHypothesis === true;
  const ci = out.context_insufficient;
  function note(code) { if (ci.indexOf(code) === -1) ci.push(code); }

  try {
    const dir = typeof roomDir === 'string' && roomDir.length > 0 ? roomDir : null;

    // (1) the ratified goal
    let goal = null;
    try {
      const g = require('../../hmi/jtbd-state.cjs').getGoal(dir);
      if (g && typeof g.jtbd === 'string' && g.jtbd.length > 0) {
        goal = { kind: 'goal', id: 'goal:v' + (Number.isInteger(g.goal_version) ? g.goal_version : 1), text: cap(g.jtbd) };
      }
    } catch (_e) { note('goal_read_failed'); }

    // (2) one read-only pass over room.db
    let gq = null;
    const claims = [];
    const qualifiedIds = [];
    const exploredIds = [];
    const flightCands = [];
    const evidenceIds = [];
    const bound = out.bound;
    let db = null;
    try {
      if (dir) db = require('../navigation.cjs').openRoomDbReadOnlyForCaller(dir);
    } catch (_e) { db = null; }
    if (!db) {
      note('room_db_missing');
    } else {
      try {
        let rows = [];
        try { rows = readNodeRows(db); } catch (_e) { note('room_db_unreadable'); }
        rows.forEach(function (row) {
          const props = parseProps(row.properties);
          if (row.type === 'claim') {
            if (props.knowledge_type === 'assumption' && typeof props.text === 'string' && claims.length < MAX_CLAIM_CANDIDATES) {
              claims.push({ kind: 'hypothesis_claim', id: row.id, text: cap(props.text) });
            }
            return;
          }
          if (row.type === 'opportunity') {
            if (props.lifecycle === 'qualified') qualifiedIds.push(row.id);
            else if (props.lifecycle === 'explored') exploredIds.push(row.id);
            const stamped = isStamped(props);
            if (flightCands.length < MAX_IDS && ((stamped && FLIGHT_LIFECYCLES.indexOf(props.lifecycle) !== -1) || props.lifecycle === 'explored')) {
              flightCands.push({ id: row.id, props: props, stamped: stamped });
            }
            return;
          }
          if (row.type === 'EvidenceClaim') { evidenceIds.push(row.id); return; }
          const p = nodePath(row, props);
          Object.keys(SEGMENT_RES).forEach(function (kind) {
            if (SEGMENT_RES[kind].test(p) && bound[kind].length < MAX_IDS && bound[kind].indexOf(row.id) === -1) bound[kind].push(row.id);
          });
        });
        try {
          const versions = require('../navigation.cjs').readGoverningQuestionVersions(db);
          if (Array.isArray(versions) && versions.length > 0) {
            const last = versions[versions.length - 1];
            const q = require('../frame-provenance.cjs').readGoverningQuestion(db, dir);
            const text = q && q.ok && q.current && typeof q.current.text === 'string' ? q.current.text : '';
            if (text.length > 0) gq = { kind: 'governing_question', id: last.node_id, text: cap(text) };
          }
        } catch (_e) { note('room_db_unreadable'); }
      } finally {
        try { db.close(); } catch (_e) { /* already closed */ }
      }
    }

    // (2b) the hypotheses already in flight (Plan 14, CMP-1, CMP-2)
    out.in_flight = flightCands.map(function (c) { return inFlightRow(c, note); });

    // (3) the WHAT candidates: goal, governing question, hypothesis claims
    let candidates = [];
    if (fromHypothesis) {
      candidates = claims.concat(goal ? [goal] : [], gq ? [gq] : []);
      if (claims.length === 0) note('no_hypothesis_on_file');
    } else {
      candidates = (goal ? [goal] : []).concat(gq ? [gq] : [], claims);
    }
    out.what.candidates = candidates;
    if (candidates.length === 0) {
      out.what.status = 'missing';
      out.route = 'define_what';
      out.offers = fromHypothesis ? ['/mos:analyze-needs', '/mos:ignite'] : ['/mos:analyze-needs'];
      if (fromHypothesis) out.what.reason = 'no_hypothesis_on_file';
    } else {
      out.what.status = 'present';
    }

    // (4) prior runs: settled limiters and evidence filed since
    let settledCount = 0;
    let newEvidence = [];
    try {
      const settled = require('./perspective.cjs').loadSettled(dir);
      settledCount = Array.isArray(settled) ? settled.length : 0;
      if (settledCount > 0) {
        const known = new Set();
        settled.forEach(function (s) { (Array.isArray(s.evidence) ? s.evidence : []).forEach(function (e) { known.add(e); }); });
        newEvidence = evidenceIds.filter(function (id) { return !known.has(id); }).slice(0, MAX_IDS);
      }
    } catch (_e) { note('prior_runs_unreadable'); }
    out.prior = { settled_count: settledCount, new_evidence_ids: newEvidence };
    let quantified = { run: null, unreadable: false };
    if (dir) quantified = findQuantifiedRun(dir);
    if (quantified.unreadable) note('prior_runs_unreadable');

    // (9) persona and (10) rung, read silently
    try { out.persona = { researcher: dir ? researcherPersona(dir) : false }; } catch (_e) { note('persona_unreadable'); }
    try {
      const r = require('../ambient-framing.cjs').resolveRoomRung(dir);
      if (r && typeof r.rung === 'string') out.rung = { rung: r.rung, source: typeof r.source === 'string' ? r.source : 'none' };
    } catch (_e) { note('rung_unreadable'); }
    if (out.rung.rung === ROOTING.primary || out.rung.rung === ROOTING.secondary_bridge) {
      out.rooting = { in_primary: true };
    } else {
      out.rooting = {
        in_primary: false,
        note: 'This command is rooted in the ' + ROOTING.primary + ' problem type (' + ROOTING.secondary_bridge + ' is the bridge); this room does not read as that.',
      };
    }

    // (7) bound inputs and what to offer at their own gates
    out.offer_bound = Object.keys(BOUND_KINDS).filter(function (k) { return bound[k].length === 0; })
      .map(function (k) { return { kind: k, commands: BOUND_KINDS[k].slice() }; });

    // (8) a qualified opportunity is offered alongside, never advanced
    out.explore_opportunity_offer = { offer: qualifiedIds.length > 0, opportunity_ids: qualifiedIds.slice(0, MAX_IDS) };

    // (5) the proposed entry step (first match wins), only when a WHAT exists
    if (out.what.status === 'present') {
      const holds = {
        prior_run_plus_new_evidence: settledCount > 0 && newEvidence.length > 0,
        hypothesis_in_flight: out.in_flight.length > 0,
        rs_finding: bound.reverse_salients.length > 0,
        design_or_futures: bound.dominant_designs.length > 0 || bound.futures.length > 0,
        quantified_goal: quantified.run !== null,
        stated_goal: goal !== null,
        fresh: true,
      };
      const rule = ENTRY_RULES.find(function (r) { return holds[r.when] === true; });
      out.proposed_step = rule.step;
      out.rule = rule.when;
      out.why = rule.why;

      // (6) every skipped step, with the artifact that stands in for it or null
      const anchor = goal || candidates[0];
      for (let step = 1; step < rule.step; step += 1) {
        let standIn = null;
        if (step <= 2 && anchor) standIn = { kind: anchor.kind, id: anchor.id };
        else if (step === 3 && quantified.run) standIn = { kind: 'quantified_plan', id: quantified.run };
        out.not_run.push({ step: step, stand_in: standIn });
      }
      if (rule.step > 2 && quantified.run === null) { note('goal_not_quantified'); out.provisional_ranking = true; }
      if (rule.step > 4) note('forum_not_on_file');
    }
  } catch (_e) {
    note('resolver_error');
  }
  return out;
}

// ----------------------------------------------------------------- render
function stepWord(n) { return 'step ' + n + ' of ' + STEP_COUNT; }

// The stamp lines come only from the 355 formatter: re-rendered for the surface
// when the stamp object is present, else the cli lines the resolver kept (cli and
// cowork only). Never a line of this module's own.
function stampLinesFor(f, surface) {
  if (isObj(f.stamp)) {
    try { return require('../verification-stamp-format.cjs').formatStampLines(f.stamp, surface); } catch (_e) { /* fall through */ }
  }
  if ((surface === 'cli' || surface === 'cowork') && Array.isArray(f.stamp_lines)) {
    return f.stamp_lines.filter(function (l) { return typeof l === 'string'; });
  }
  return [];
}

function renderEntry(entry, opts) {
  const e = isObj(entry) ? entry : {};
  const surface = isObj(opts) && SURFACES.indexOf(opts.surface) !== -1 ? opts.surface : 'cli';
  const lines = ['## Scientific Roadmapping entry check', ''];
  const what = isObj(e.what) ? e.what : { status: 'missing', candidates: [] };
  const cands = Array.isArray(what.candidates) ? what.candidates : [];
  const KIND_WORD = { goal: 'ratified goal', governing_question: 'governing question', hypothesis_claim: 'hypothesis' };

  if (e.route === 'define_what' || what.status !== 'present') {
    lines.push('No WHAT is on file yet, so this command does not start here. It never makes up the WHAT.');
    if (what.reason === 'no_hypothesis_on_file') lines.push('You asked to start from a hypothesis, and none is on file.');
    lines.push('');
    lines.push('Define the WHAT first:');
    (Array.isArray(e.offers) && e.offers.length > 0 ? e.offers : ['/mos:analyze-needs']).forEach(function (c) { lines.push('- ' + c); });
  } else {
    lines.push('The WHAT to confirm (pick the one this run is about):');
    cands.forEach(function (c) { lines.push('- ' + (KIND_WORD[c.kind] || c.kind) + ' (' + c.id + '): ' + c.text); });
    lines.push('');
    lines.push('Proposed entry: ' + (Number.isInteger(e.proposed_step) ? stepWord(e.proposed_step) : 'not set') + '.');
    if (e.why) lines.push(e.why);
    lines.push('You may override this and start at step 1.');
    const skipped = Array.isArray(e.not_run) ? e.not_run : [];
    if (skipped.length > 0) {
      lines.push('');
      lines.push('Steps skipped (recorded as not run, never made up):');
      skipped.forEach(function (n) {
        lines.push('- step ' + n.step + ': ' + (n.stand_in ? 'covered by ' + n.stand_in.kind + ' ' + n.stand_in.id : 'nothing on file stands in for it'));
      });
    }
    const flight = Array.isArray(e.in_flight) ? e.in_flight.filter(isObj) : [];
    if (flight.length > 0) {
      lines.push('');
      lines.push('Already in flight (step 6 interrogates the link each one depends on; nothing here changes it):');
      flight.forEach(function (f) {
        lines.push('- ' + (f.source === 'stamped_finding' ? 'stamped finding' : 'explored opportunity') + ' ' + f.opportunity_id + (f.name ? ': ' + f.name : ''));
        if (Array.isArray(f.depends_on) && f.depends_on.length > 0) lines.push('  depends on: ' + f.depends_on.join(' and '));
        stampLinesFor(f, surface).forEach(function (l) { lines.push(l); });
        if (f.stamp_readable === false) lines.push('  its verification stamp could not be read, so treat the link as unchecked');
      });
    }
  }

  const bound = isObj(e.bound) ? e.bound : {};
  const onFile = Object.keys(BOUND_KINDS).filter(function (k) { return Array.isArray(bound[k]) && bound[k].length > 0; });
  if (onFile.length > 0) {
    lines.push('');
    lines.push('Already on file and read as inputs:');
    onFile.forEach(function (k) { lines.push('- ' + BOUND_LABEL[k] + ': ' + bound[k].join(', ')); });
  }
  const offers = Array.isArray(e.offer_bound) ? e.offer_bound : [];
  if (offers.length > 0 && what.status === 'present') {
    lines.push('');
    lines.push('Not on file yet. Each of these can be offered at its own gate (nothing is run here):');
    offers.forEach(function (o) { lines.push('- ' + (BOUND_LABEL[o.kind] || o.kind) + ': ' + (Array.isArray(o.commands) ? o.commands.join(' or ') : '')); });
  }
  const opp = isObj(e.explore_opportunity_offer) ? e.explore_opportunity_offer : null;
  if (opp && opp.offer === true) {
    lines.push('');
    lines.push('A qualified opportunity is on file (' + (opp.opportunity_ids || []).join(', ') + '). /mos:explore-opportunity can take it alongside; pick one, nothing fires on its own.');
  }
  if (isObj(e.persona) && e.persona.researcher === true) {
    lines.push('');
    lines.push('Researcher persona noted.');
  }
  const gaps = Array.isArray(e.context_insufficient) ? e.context_insufficient : [];
  if (gaps.length > 0) {
    lines.push('');
    lines.push('Context gaps:');
    gaps.forEach(function (code) { lines.push('- ' + (CONTEXT_WORDS[code] || code)); });
  }
  if (e.provisional_ranking === true) {
    lines.push('');
    lines.push('Any ranking from the later steps is provisional until a quantified goal exists.');
  }
  return lines.join('\n') + '\n';
}

module.exports = { ROOTING, ENTRY_RULES, BOUND_KINDS, resolveEntry, renderEntry };
