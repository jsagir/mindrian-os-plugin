'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260805-tnufa-graphrag-grant-grader -- the grading engine behind
 * /mos:grade-grant: score a pasted grant-application draft against a bundled,
 * LOCAL grant-program rubric (starting with Tnufa; see
 * data/grant-rubric-fixtures/tnufa.json), and file the verdict as graph data.
 *
 * Reuse-before-build (Canon Part 7), recorded here per commands/grade-grant.md:
 *   - lib/core/eureka/qualify-opportunity.cjs is the closest existing UX pattern
 *     (an N-criterion rubric rendered as a card, rejection reasons written as
 *     typed data, an askBrain() idiom that composes GENERIC handles only). This
 *     module mirrors that idiom (see askBrainForCoaching below) but is NOT a
 *     duplicate: qualify-opportunity gates an INTERNAL opportunity node that
 *     already exists in the graph; this module scores an EXTERNAL document the
 *     navigator pastes in, which has no existing node and a different rubric
 *     shape (grant eligibility criteria, not the Q1..Q8 harvest rubric).
 *   - commands/grade.md / deep-grade.md grade the user's own Data Room against
 *     PWS methodology; this module grades a pasted document against IIA grant
 *     criteria. Different subject, same "independent criteria basket" shape
 *     (hitl_shape F.8 on the command).
 *   - lib/core/pitch-feedback-schemas.cjs's EvidenceSchema (evidenced enum:
 *     'evidenced' | 'asserted' | 'absent') is the anti-hallucination shape this
 *     module borrows for per-criterion findings: the CALLING command extracts
 *     quote-anchored findings from the pasted draft (no Data Room, no Brain
 *     calibration corpus for this document), this module only scores + files
 *     the already-extracted findings. It does not itself read or judge prose.
 *
 * Canon Part 8 (LOCAL -> BRAIN: NO): the rubric is real IIA domain data, not
 *   generic PWS methodology -- confirmed empirically this session when a
 *   brain_search for "Tnufa" was blocked by the Part 8 egress guard. The rubric
 *   fixtures are LOCAL, bundled with the plugin install (data/grant-rubric-
 *   fixtures/*.json), never pushed to Brain. askBrainForCoaching composes a
 *   GENERIC framework-handle query only (a gap CATEGORY enum, e.g. "market"),
 *   never the applicant's own text -- mirrors qualify-opportunity.cjs's
 *   askBrain() verbatim: even here, the actual Brain wire belongs to the host
 *   surface (the command), never this module.
 *
 * Canon Part 9: the verdict is filed as a typed truth-claim node via
 *   navigation.writeClaimNode (knowledge_type 'heuristic' -- a graded judgment,
 *   not an asserted fact). Lands review_status 'proposed', never auto-confirmed
 *   (a human APPROVE at the command's Decision Gate promotes it). Zero direct
 *   room.db open; takes a caller-owned db handle exactly like
 *   qualify-opportunity.cjs's writers.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');

const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'grant-rubric-fixtures');
const SCHEMA_STATUS_VALUES = Object.freeze(new Set(['stub', 'drafted', 'reviewed']));
const CATEGORY_VALUES = Object.freeze(new Set([
  'eligibility', 'process', 'budget', 'legal', 'reporting', 'market', 'ip',
]));
const FINDING_STATUS_VALUES = Object.freeze(new Set(['evidenced', 'asserted', 'absent']));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// listPrograms() -- enumerate the bundled rubric fixtures. Returns
// { ok, programs: [{id, name_en, stage, status, criteria_count}] }. A fixture
// that fails to parse is skipped, not fatal to the listing (defensive: never
// lets one bad file break the picker). Never throws.
function listPrograms() {
  try {
    if (!fs.existsSync(FIXTURES_DIR)) {
      return { ok: true, programs: [] };
    }
    const files = fs.readdirSync(FIXTURES_DIR).filter(function (f) {
      return f.endsWith('.json');
    });
    const programs = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
        const data = JSON.parse(raw);
        if (!isPlainObject(data) || !isNonEmptyString(data.id)) continue;
        programs.push({
          id: data.id,
          name_en: isNonEmptyString(data.name_en) ? data.name_en : data.id,
          stage: isNonEmptyString(data.stage) ? data.stage : 'unknown',
          status: SCHEMA_STATUS_VALUES.has(data.status) ? data.status : 'stub',
          criteria_count: Array.isArray(data.criteria) ? data.criteria.length : 0,
        });
      } catch (_e) {
        // Skip the one bad fixture; the rest of the listing still lands.
      }
    }
    programs.sort(function (a, b) { return a.id.localeCompare(b.id); });
    return { ok: true, programs: programs };
  } catch (e) {
    return { ok: false, reason: 'list_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

// loadRubric(programId) -- read + validate one fixture against the
// data/grant-rubric-schema.json contract. Returns { ok, rubric } or
// { ok:false, reason, detail? }. A slug is sanitized to [a-z0-9-] before it
// ever touches the filesystem path (never trust a caller-supplied id raw).
function loadRubric(programId) {
  if (!isNonEmptyString(programId)) {
    return { ok: false, reason: 'invalid_program_id' };
  }
  const safeId = programId.replace(/[^a-z0-9-]/g, '');
  if (safeId !== programId || safeId.length === 0 || safeId.length > 60) {
    return { ok: false, reason: 'invalid_program_id', detail: programId.slice(0, 40) };
  }
  const fixturePath = path.join(FIXTURES_DIR, safeId + '.json');
  if (!fixturePath.startsWith(FIXTURES_DIR)) {
    return { ok: false, reason: 'invalid_program_id' };
  }
  let raw;
  try {
    raw = fs.readFileSync(fixturePath, 'utf8');
  } catch (_e) {
    return { ok: false, reason: 'fixture_not_found', detail: safeId };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_e) {
    return { ok: false, reason: 'fixture_parse_failed', detail: safeId };
  }
  const required = ['id', 'name_en', 'stage', 'eligibility', 'purpose', 'funding_pct', 'funding_cap', 'duration', 'status'];
  for (const key of required) {
    if (!isNonEmptyString(data[key])) {
      return { ok: false, reason: 'fixture_missing_field', detail: key };
    }
  }
  if (!SCHEMA_STATUS_VALUES.has(data.status)) {
    return { ok: false, reason: 'fixture_invalid_status', detail: String(data.status) };
  }
  if (!Array.isArray(data.criteria)) {
    return { ok: false, reason: 'fixture_invalid_criteria' };
  }
  for (const c of data.criteria) {
    if (!isPlainObject(c) || !isNonEmptyString(c.id) || !isNonEmptyString(c.aspect)
      || !isNonEmptyString(c.details) || !isNonEmptyString(c.common_mistake)
      || !CATEGORY_VALUES.has(c.category)) {
      return { ok: false, reason: 'fixture_invalid_criterion', detail: c && c.id };
    }
  }
  return { ok: true, rubric: data };
}

// scoreApplication(rubric, findings) -- pure scoring, no I/O. findings is an
// array of { criterion_id, status: 'evidenced'|'asserted'|'absent', note? } --
// the CALLER (the command, reading the pasted draft) has already decided each
// status; this function only aggregates. A criterion with no matching finding
// is treated as 'absent' (silent gaps are not hidden as passes). Weighting:
// evidenced=1.0, asserted=0.5, absent=0.0 -- mirrors the EvidenceSchema
// anti-hallucination spirit (an unsupported assertion is worth half credit,
// not full). Returns { ok, score_pct, counts, gaps, per_criterion } or
// { ok:false, reason }. Never throws.
function scoreApplication(rubric, findings) {
  if (!isPlainObject(rubric) || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    return { ok: false, reason: 'invalid_rubric' };
  }
  const findingsByCriterion = {};
  if (Array.isArray(findings)) {
    for (const f of findings) {
      if (!isPlainObject(f) || !isNonEmptyString(f.criterion_id)) continue;
      const status = FINDING_STATUS_VALUES.has(f.status) ? f.status : 'absent';
      findingsByCriterion[f.criterion_id] = { status: status, note: isNonEmptyString(f.note) ? f.note : '' };
    }
  }
  const perCriterion = [];
  const gaps = [];
  let evidencedCount = 0;
  let assertedCount = 0;
  let absentCount = 0;
  let weightedSum = 0;
  for (const c of rubric.criteria) {
    const found = findingsByCriterion[c.id] || { status: 'absent', note: '' };
    if (found.status === 'evidenced') { evidencedCount += 1; weightedSum += 1.0; }
    else if (found.status === 'asserted') { assertedCount += 1; weightedSum += 0.5; }
    else { absentCount += 1; }
    const row = {
      criterion_id: c.id,
      aspect: c.aspect,
      category: c.category,
      status: found.status,
      note: found.note,
    };
    perCriterion.push(row);
    if (found.status !== 'evidenced') {
      gaps.push({
        criterion_id: c.id,
        aspect: c.aspect,
        category: c.category,
        status: found.status,
        common_mistake: c.common_mistake,
      });
    }
  }
  const total = rubric.criteria.length;
  const scorePct = total > 0 ? Math.round((weightedSum / total) * 100) : 0;
  return {
    ok: true,
    program_id: rubric.id,
    score_pct: scorePct,
    counts: { total: total, evidenced: evidencedCount, asserted: assertedCount, absent: absentCount },
    gaps: gaps,
    per_criterion: perCriterion,
  };
}

// gapCategories(verdict) -- the distinct, sorted category set across a
// verdict's gaps (e.g. ['budget','legal','market']). Pure. Never throws.
function gapCategories(verdict) {
  if (!isPlainObject(verdict) || !Array.isArray(verdict.gaps)) return [];
  const set = new Set();
  for (const g of verdict.gaps) {
    if (isPlainObject(g) && CATEGORY_VALUES.has(g.category)) set.add(g.category);
  }
  return Array.from(set).sort();
}

// askBrainForCoaching(verdict) -- mirrors qualify-opportunity.cjs's askBrain()
// idiom verbatim (Canon Part 8): composes a GENERIC framework-handle query
// from the gap CATEGORIES only (an enum), never the applicant's draft text or
// the program's specific numbers. Degrades gracefully (brain_available:false)
// -- the actual MCP wire belongs to the host command turn, never this module.
// Never throws.
function askBrainForCoaching(verdict) {
  const categories = gapCategories(verdict);
  if (categories.length === 0) {
    return { ok: true, brain_available: false, handles: null, note: 'No gaps -- nothing to coach.' };
  }
  const handles = {
    framework: 'grant-application-coaching',
    gap_categories: categories,
    rubric: isPlainObject(verdict) && isNonEmptyString(verdict.program_id) ? verdict.program_id : 'unknown',
  };
  return {
    ok: true,
    brain_available: false,
    handles: handles,
    note: 'Brain consult is recommend-never-trigger from this module: the host command fires the '
      + 'generic-handle query (framework + gap categories only, never applicant prose) when Brain '
      + 'is reachable; absent Brain, coach from the rubric common_mistake text already on each gap.',
  };
}

// writeGradingResult(db, params) -- files the verdict as a typed 'heuristic'
// truth-claim node (a graded judgment, not an asserted fact) via
// navigation.writeClaimNode. params = { verdict, sessionId, programName? }.
// Lands review_status 'proposed' (Canon Part 9 role 5: never auto-confirmed by
// an agent; a human APPROVE at the command's Decision Gate promotes it via
// navigation.confirmNode, same as qualify-opportunity.cjs's qualifyCandidate).
// Returns { ok, node_id } or { ok:false, reason }. Never throws.
function writeGradingResult(db, params) {
  try {
    if (!db || !isPlainObject(params) || !isPlainObject(params.verdict)) {
      return { ok: false, reason: 'invalid_params' };
    }
    const verdict = params.verdict;
    if (!isNonEmptyString(verdict.program_id) || typeof verdict.score_pct !== 'number') {
      return { ok: false, reason: 'invalid_verdict' };
    }
    const sessionId = isNonEmptyString(params.sessionId) ? params.sessionId : 'grade-grant';
    const programLabel = isNonEmptyString(params.programName) ? params.programName : verdict.program_id;
    const text = 'Grant-application draft scored ' + verdict.score_pct + '% ('
      + verdict.counts.evidenced + '/' + verdict.counts.total + ' criteria evidenced) against the '
      + programLabel + ' rubric.';
    const segmentKey = 'grade-grant:' + verdict.program_id + ':' + Date.now();
    const written = navigation.writeClaimNode(db, {
      knowledge_type: 'heuristic',
      text: text,
      sessionId: sessionId,
      sourceSegment: segmentKey,
      extraProps: {
        program_id: verdict.program_id,
        score_pct: verdict.score_pct,
        evidenced_count: verdict.counts.evidenced,
        asserted_count: verdict.counts.asserted,
        absent_count: verdict.counts.absent,
        total_criteria: verdict.counts.total,
        gap_categories: gapCategories(verdict),
        graded_at: new Date().toISOString(),
      },
    });
    if (!written || written.ok !== true) {
      return { ok: false, reason: 'claim_write_failed', detail: written && written.reason };
    }
    return { ok: true, node_id: written.node_id };
  } catch (e) {
    return { ok: false, reason: 'write_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

module.exports = {
  listPrograms,
  loadRubric,
  scoreApplication,
  gapCategories,
  askBrainForCoaching,
  writeGradingResult,
  FIXTURES_DIR,
  CATEGORY_VALUES,
  FINDING_STATUS_VALUES,
};
