'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/pyramid-seed-upgrade.cjs (Phase 389 Plan 04)
 *
 * The Full depth of /mos:structure-argument. It runs on the Phase 363 pyramid engine; it does not
 * build a second one. buildPyramid and checkPyramid (research-planner/pyramid.cjs) own SCQA, the key
 * line, the MECE overlap check (through issue-tree), coverage against a closed dimension set and the
 * D-00 gate. This module only does three small jobs:
 *
 *   seedToQuestionSet(record)  turn a Seed record (mos.pyramid-seed/1) into a
 *                              mos.research-question-set/1 object for the pyramid-argument template.
 *                              The Seed's own claims are leaves with origin user_stated. Every
 *                              researchable template dimension the Seed never turned into a question
 *                              becomes a leaf with origin framework_dimension: that list is the list
 *                              of questions the Seed did not ask.
 *   upgradeSeed(record, opts)  validate, build, check, and read the room notes that already speak to
 *                              each support group (quick.localRoomCheck, fs only).
 *   renderUpgrade(result)      short plain text. It never says "MECE verified": the checker finds word
 *                              overlap between groups and missing coverage, and that is all it proves
 *                              (Pitfall 19 of pyramid.cjs).
 *
 * Plain English: the Seed states a situation, a complication, a question, an answer, a few support
 * groups and one objection. The person asked about their own support claims. The framework also asks
 * whether the situation is true, what changed, and what the strongest objection is. Those three
 * questions are the additions.
 *
 * Pure and local. It reads room files with fs only (through localRoomCheck), writes nothing, prints
 * nothing, makes no network call and no Brain call (Canon Part 8). The record is untrusted text from
 * the host model, so it is validated before it becomes a question set. Hyphens only.
 */

const COMMAND = '/mos:structure-argument full';
const TEMPLATE_ID = 'pyramid-argument';
const RECORD_SCHEMA = 'mos.pyramid-seed/1';
const MAX_KEY_LINE = 5;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function text(v, max) { return nonEmpty(v) && v.length <= max; }
function list(v) { return Array.isArray(v) ? v : []; }

// ---------------------------------------------------------------------------
// the record contract (plan 05 owns the full validator; this one accepts the same shape)
// ---------------------------------------------------------------------------
function recordReason(r) {
  if (!isObj(r)) return 'record_not_object';
  if (r.schema !== RECORD_SCHEMA) return 'schema_invalid';
  if (typeof r.id !== 'string' || !/^[0-9a-f]{8}$/.test(r.id)) return 'id_invalid';
  if (typeof r.created_at !== 'string' || r.created_at.length === 0) return 'created_at_invalid';
  if (r.depth !== 'seed' && r.depth !== 'full') return 'depth_invalid';
  const fields = ['situation', 'complication', 'question', 'answer'];
  for (let i = 0; i < fields.length; i += 1) {
    if (!text(r[fields[i]], 400)) return fields[i] + '_invalid';
  }
  if (!Array.isArray(r.support) || r.support.length < 2 || r.support.length > MAX_KEY_LINE) return 'support_count_invalid';
  for (let i = 0; i < r.support.length; i += 1) {
    const g = r.support[i];
    if (!isObj(g) || !text(g.group, 120)) return 'support_group_invalid:' + i;
    if (!Array.isArray(g.claims) || g.claims.length < 1 || g.claims.length > 4) return 'support_claims_count_invalid:' + i;
    for (let j = 0; j < g.claims.length; j += 1) {
      if (!text(g.claims[j], 200)) return 'support_claim_invalid:' + i + '.' + j;
    }
  }
  if (!text(r.objection, 300)) return 'objection_invalid';
  if (!Array.isArray(r.evidence)) return 'evidence_invalid';
  for (let i = 0; i < r.evidence.length; i += 1) {
    const e = r.evidence[i];
    if (!isObj(e) || !nonEmpty(e.cell) || !nonEmpty(e.status) || !text(e.summary_line, 160)) return 'evidence_entry_invalid:' + i;
  }
  if (r.upgraded_from !== undefined && (typeof r.upgraded_from !== 'string' || !/^[0-9a-f]{8}$/.test(r.upgraded_from))) return 'upgraded_from_invalid';
  return null;
}

function Q() { return require('./research-planner/question-templates.cjs'); }

// The dimensions a Seed field answers with its own words. Support is the only one the Seed turns into
// questions (its claims). The answer dimension is closed: the answer is a judgment the person owns.
const SEED_ASKED = Object.freeze(['pa:support']);

function leafFor(dimension, id, question, origin, parent, extra) {
  const falsifier = { text: dimension.falsifier_default, template_id: dimension.falsifier_template };
  return Object.assign({
    id: id,
    parent: parent,
    question: question,
    origin: origin,
    dimension: dimension.id,
    lens: dimension.default_lens,
    researchable: true,
    falsifier: falsifier,
    slots: {},
    corpus: 'room',
  }, extra || {});
}

// seedToQuestionSet(record) -> mos.research-question-set/1. Throws an Error with .reason when the
// record fails the contract (upgradeSeed catches it and returns ok false).
function seedToQuestionSet(record) {
  const reason = recordReason(record);
  if (reason) {
    const err = new Error('pyramid_seed_invalid:' + reason);
    err.reason = reason;
    throw err;
  }
  const T = Q().TEMPLATES[TEMPLATE_ID];
  const byId = {};
  T.dimensions.forEach(function (d) { byId[d.id] = d; });
  const support = byId['pa:support'];

  const keyLine = [];
  const leaves = [];
  let n = 0;
  record.support.forEach(function (g, i) {
    const kid = 'k' + (i + 1);
    keyLine.push({ id: kid, label: g.group.trim(), dimension: 'pa:support' });
    g.claims.forEach(function (claim) {
      n += 1;
      leaves.push(leafFor(support, 's' + n, claim.trim(), 'user_stated', kid));
    });
  });
  // The questions the Seed did not ask: one leaf per researchable dimension without a Seed question.
  T.dimensions.forEach(function (d) {
    if (d.researchable !== true || SEED_ASKED.indexOf(d.id) !== -1) return;
    leaves.push(leafFor(d, 'q:' + d.id.split(':')[1], d.prompt, 'framework_dimension', null));
  });

  return {
    schema: Q().SCHEMA,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: record.question.trim(),
    scqa: {
      situation: record.situation,
      complication: record.complication,
      question: record.question,
      answer_hypothesis: record.answer,
    },
    mode_hint: null,
    multi_cause: false,
    perspective: null,
    key_line: keyLine,
    leaves: leaves,
    coverage_notes: [],
  };
}

// ---------------------------------------------------------------------------
// restatement of the question by the Seed's own claims. The engine skips user_stated leaves on purpose,
// so a Seed whose claims only repeat the question would pass unseen. A claim is flagged when most of its
// own content words are the question's words. A warning only; it decides nothing.
// ---------------------------------------------------------------------------
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'are', 'with', 'by', 'from', 'too', 'not', 'no']);
function tokens(s) {
  const out = (String(s || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter(function (t) { return !STOP.has(t); });
  return out.filter(function (t, i) { return out.indexOf(t) === i; });
}
function claimRestatements(record) {
  const q = new Set(tokens(record.question));
  const out = [];
  let n = 0;
  record.support.forEach(function (g) {
    g.claims.forEach(function (claim) {
      n += 1;
      const t = tokens(claim);
      const shared = t.filter(function (x) { return q.has(x); });
      if (t.length > 0 && shared.length >= 2 && shared.length / t.length >= 0.6) {
        out.push('Claim s' + n + ' may repeat the question instead of supporting the answer: "' + claim + '".');
      }
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// room evidence: which room notes already speak to a support group (fs only, sends nothing)
// ---------------------------------------------------------------------------
function roomEvidence(record, roomDir) {
  if (!nonEmpty(roomDir)) return [];
  let quick;
  try { quick = require('./research-planner/quick.cjs'); } catch (_e) { return []; }
  const out = [];
  record.support.forEach(function (g) {
    let r;
    try { r = quick.localRoomCheck(roomDir, [g.group, g.claims[0]]); } catch (_e) { return; }
    if (r && r.flagged) out.push({ group: g.group, artifact_count: r.artifact_count, artifacts: r.artifacts });
  });
  return out;
}

// upgradeSeed(record, { roomDir }) -> { ok, ... }. Never throws on a bad record.
function upgradeSeed(record, opts) {
  const o = opts || {};
  let qs;
  try { qs = seedToQuestionSet(record); } catch (e) {
    return { ok: false, reason: e && e.reason ? e.reason : 'record_invalid', errors: [String(e && e.message ? e.message : e)] };
  }
  const built = require('./research-planner/pyramid.cjs').buildPyramid(qs);
  if (!built.ok) return { ok: false, reason: 'question_set_invalid', errors: built.errors };
  const check = built.check;

  const T = Q().TEMPLATES[TEMPLATE_ID];
  const additions = qs.leaves.filter(function (l) { return l.origin === 'framework_dimension'; }).map(function (l) {
    const d = T.dimensions.filter(function (x) { return x.id === l.dimension; })[0];
    return { leaf_id: l.id, dimension: l.dimension, label: d ? d.label : l.dimension, question: l.question };
  });
  const restatements = check.restatement_warnings.concat(claimRestatements(record));

  return {
    ok: true,
    upgraded_from: record.id,
    status: built.status,
    pyramid: built.pyramid,
    leaves: built.leaves,
    check: check,
    additions: additions,
    mece_warnings: check.mece.warnings.slice(),
    restatement_warnings: restatements,
    uncovered: check.coverage.uncovered.slice(),
    room_evidence: roomEvidence(record, o.roomDir),
  };
}

// ---------------------------------------------------------------------------
// renderUpgrade: plain text for the person. It states what the checker found and what is missing.
// ---------------------------------------------------------------------------
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

function renderUpgrade(result) {
  const r = result || {};
  if (r.ok !== true) return 'The Seed cannot be upgraded yet: ' + String(r.reason || 'unknown reason') + '.';
  const lines = [];
  const groups = r.pyramid.key_line.length;
  lines.push('Full depth: your Seed now sits on the pyramid, with ' + plural(groups, 'support group', 'support groups') + '.');
  lines.push('');
  lines.push(plural(r.additions.length, 'question your Seed did not ask', 'questions your Seed did not ask') + (r.additions.length ? ':' : '.'));
  r.additions.forEach(function (a) { lines.push('- ' + a.label + ': ' + a.question); });
  lines.push('');
  const overlap = r.check.mece.overlap_warnings;
  lines.push(plural(overlap.length, 'overlap warning', 'overlap warnings') + ' from the checker' + (overlap.length ? ':' : '.'));
  overlap.forEach(function (w) { lines.push('- ' + w); });
  lines.push('The checker looks for shared words between groups. It cannot prove the groups are separate or that nothing is missing.');
  if (r.restatement_warnings.length) {
    lines.push('');
    r.restatement_warnings.forEach(function (w) { lines.push('- ' + w); });
  }
  lines.push('');
  if (r.uncovered.length) lines.push('Not covered yet: ' + r.uncovered.join(', ') + '.');
  else lines.push('Every part of the argument has at least one question.');
  if (r.room_evidence.length) {
    lines.push('');
    lines.push('Room notes that already speak to a group:');
    r.room_evidence.forEach(function (e) {
      lines.push('- ' + e.group + ': ' + e.artifacts.map(function (a) { return a.path; }).join(', '));
    });
  }
  lines.push('');
  lines.push('The answer stays your judgment.');
  return lines.join('\n');
}

module.exports = {
  seedToQuestionSet: seedToQuestionSet,
  upgradeSeed: upgradeSeed,
  renderUpgrade: renderUpgrade,
};
