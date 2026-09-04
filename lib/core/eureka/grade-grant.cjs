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
 * Quick task 260806-grant-grader-room-graph extension -- the room_section map.
 *   Every criterion now carries a room_section field: one of the 8 standard
 *   MindrianOS room sections, or null for pure post-award process/reporting
 *   items with no room-content equivalent. It is ONE map used in BOTH
 *   directions (decision record in the quick task's PLAN.md, D1..D5):
 *     - room -> application: room-mode grading (the command reads populated
 *       room sections instead of a pasted draft; scoreApplication is source-
 *       agnostic and unchanged) + buildRoadmap (gaps grouped by room_section,
 *       "build this in room/<section>/", null-section criteria surface as a
 *       plain checklist, never a forced fake mapping).
 *     - application -> room: the command decomposes a finished application
 *       into a NEW dedicated room (tnufa-app-<slug>, born via
 *       navigation.birthRoom with explicit navigator approval -- NEVER the
 *       active venture room, so grant-application prose cannot pollute real
 *       venture data), then runs room-mode grading on the result.
 *   The map is ALSO real graph structure, not JSON-only: the graph writers
 *   live in lib/core/navigation/grant-rubric.cjs (writeGrantRubricGraph +
 *   writeGradingSectionEdges, re-exported on navigation.cjs) because raw node
 *   INSERTs are substrate-banned outside lib/core/navigation/. This module
 *   stays pure scoring/composition + the one writeClaimNode call.
 *   askBrainForStrategy is the STRUCTURAL sibling of askBrainForCoaching:
 *   a section_profile enum bag (covered | partial | missing per mapped
 *   standard section slug -- generic MindrianOS vocabulary) so Brain can
 *   coach on the SHAPE of the room, never its prose (Part 8 unchanged).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');
// The room-section vocabulary is read live from room-skeleton-scaffold.cjs
// (the single source of truth) as of Phase 275 (D-01), not re-typed here --
// a re-copied literal is the exact propagation-gap class this repo has now
// paid for four separate times (domain-explorer, scenario-analysis,
// trending-to-absurd, analyze-needs). require('../room-skeleton-scaffold.cjs')
// is chosen over require('../navigation/room-birth.cjs') because scaffold is
// a leaf module (only node:fs, node:path, and a lazy
// larry-thinness-acknowledgment.cjs) with no require of anything under
// lib/core/eureka/ or lib/core/navigation/, so requiring it here from
// lib/core/eureka/ cannot reopen a cycle -- unlike room-birth.cjs, which
// sits inside navigation.cjs's documented circular-dependency hazard.
const roomSkeletonScaffold = require('../room-skeleton-scaffold.cjs');

const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'grant-rubric-fixtures');
const SCHEMA_STATUS_VALUES = Object.freeze(new Set(['stub', 'drafted', 'reviewed']));
const CATEGORY_VALUES = Object.freeze(new Set([
  'eligibility', 'process', 'budget', 'legal', 'reporting', 'market', 'ip',
]));
const FINDING_STATUS_VALUES = Object.freeze(new Set(['evidenced', 'asserted', 'absent']));
// The standard MindrianOS room sections, read live from
// room-skeleton-scaffold.cjs's SECTION_NAMES (single source of truth) as of
// Phase 275 (D-01). A criterion's room_section must be one of these or null
// (a pure process/reporting item). Stays a frozen closed allowlist: every
// read site below uses .has(), never a truthy check, so this can never be
// widened by a fixture-supplied value.
const ROOM_SECTION_VALUES = Object.freeze(new Set(roomSkeletonScaffold.SECTION_NAMES));

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
  return validateRubric(data);
}

// validateRubric(data) -- the body validation loadRubric applies, extracted
// (quick 260806 D5) so the room_section vocabulary rule is directly testable
// without planting bad fixtures in the shipped fixtures dir. Returns
// { ok, rubric } or { ok:false, reason, detail? }. Fail closed: an unknown
// room_section string is a hard error, not a silent pass. room_section may be
// ABSENT (a pre-260806 fixture shape) or null (a pure process/reporting item)
// -- both are legal; only a non-member string rejects. Never throws.
function validateRubric(data) {
  if (!isPlainObject(data)) {
    return { ok: false, reason: 'fixture_invalid' };
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
    if (c.room_section !== undefined && c.room_section !== null
      && !ROOM_SECTION_VALUES.has(c.room_section)) {
      return { ok: false, reason: 'fixture_invalid_room_section', detail: c.id + ':' + String(c.room_section).slice(0, 40) };
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

// sectionMap(rubric) -- THE one room_section map, both directions (quick 260806).
// Groups the rubric's criteria by room_section. Returns
// { ok, sections: { <section-slug>: [criterion, ...] }, process: [criterion, ...],
//   mapped_sections: [sorted slugs] } where `process` carries the room_section:null
// criteria (pure post-award process/reporting items with no room location --
// surfaced as a checklist, never forced into a fake mapping). Pure; a criterion
// with an invalid room_section is treated as unmapped (validateRubric is the
// fail-closed gate at load time; this stays a tolerant pure grouping). Never
// throws.
function sectionMap(rubric) {
  if (!isPlainObject(rubric) || !Array.isArray(rubric.criteria)) {
    return { ok: false, reason: 'invalid_rubric' };
  }
  const sections = {};
  const processItems = [];
  for (const c of rubric.criteria) {
    if (!isPlainObject(c) || !isNonEmptyString(c.id)) continue;
    if (ROOM_SECTION_VALUES.has(c.room_section)) {
      if (!sections[c.room_section]) sections[c.room_section] = [];
      sections[c.room_section].push(c);
    } else {
      processItems.push(c);
    }
  }
  return {
    ok: true,
    sections: sections,
    process: processItems,
    mapped_sections: Object.keys(sections).sort(),
  };
}

// buildRoadmap(rubric, verdict) -- the WHERE-and-WHAT-to-build view (quick
// 260806, the navigator's roadmap ask): group the verdict's gaps by the
// criterion's room_section so the grade becomes an offer -- "build this in
// room/<section>/: <what a strong entry looks like, from the criterion's
// details field>". Criteria with room_section null have no room location to
// point at and land in process_checklist instead (never a fake mapping).
// Returns { ok, program_id, section_plans: [{ room_section, gaps: [{
// criterion_id, aspect, status, build: details, common_mistake, category }] }],
// process_checklist: [same row shape], covered_sections: [slugs with mapped
// criteria and zero gaps] }. section_plans sorted by gap count descending
// (the weakest section first), ties alphabetical. Pure. Never throws.
function buildRoadmap(rubric, verdict) {
  if (!isPlainObject(rubric) || !Array.isArray(rubric.criteria)) {
    return { ok: false, reason: 'invalid_rubric' };
  }
  if (!isPlainObject(verdict) || !Array.isArray(verdict.gaps)) {
    return { ok: false, reason: 'invalid_verdict' };
  }
  const byId = {};
  for (const c of rubric.criteria) {
    if (isPlainObject(c) && isNonEmptyString(c.id)) byId[c.id] = c;
  }
  const sectionGaps = {};
  const processChecklist = [];
  for (const g of verdict.gaps) {
    if (!isPlainObject(g) || !isNonEmptyString(g.criterion_id)) continue;
    const c = byId[g.criterion_id];
    if (!c) continue;
    const row = {
      criterion_id: c.id,
      aspect: c.aspect,
      status: FINDING_STATUS_VALUES.has(g.status) ? g.status : 'absent',
      build: c.details,
      common_mistake: c.common_mistake,
      category: c.category,
    };
    if (ROOM_SECTION_VALUES.has(c.room_section)) {
      if (!sectionGaps[c.room_section]) sectionGaps[c.room_section] = [];
      sectionGaps[c.room_section].push(row);
    } else {
      processChecklist.push(row);
    }
  }
  const sectionPlans = Object.keys(sectionGaps)
    .map(function (slug) { return { room_section: slug, gaps: sectionGaps[slug] }; })
    .sort(function (a, b) {
      if (b.gaps.length !== a.gaps.length) return b.gaps.length - a.gaps.length;
      return a.room_section.localeCompare(b.room_section);
    });
  const mapped = sectionMap(rubric);
  const coveredSections = (mapped.ok ? mapped.mapped_sections : []).filter(function (slug) {
    return !sectionGaps[slug];
  });
  return {
    ok: true,
    program_id: isNonEmptyString(rubric.id) ? rubric.id : 'unknown',
    section_plans: sectionPlans,
    process_checklist: processChecklist,
    covered_sections: coveredSections,
  };
}

// askBrainForStrategy(verdict, rubric) -- the STRUCTURAL sibling of
// askBrainForCoaching (quick 260806, the navigator's "remote graph assists by
// looking at elements of it to make it strategically better" ask). Composes a
// GENERIC handle bag from the SHAPE of the graded room only: per mapped
// standard section slug an enum -- 'covered' (every mapped criterion
// evidenced), 'partial' (some), 'missing' (none) -- plus the gap category
// enums. Section slugs are generic MindrianOS scaffold vocabulary, statuses
// are a closed 3-value enum, categories are the closed rubric enum: shape and
// enums cross to Brain, prose and content never do (Part 8, byte-identical
// discipline to askBrainForCoaching). Degrades brain_available:false; the
// actual MCP wire belongs to the host command turn, never this module. Never
// throws.
function askBrainForStrategy(verdict, rubric) {
  if (!isPlainObject(verdict) || !Array.isArray(verdict.per_criterion)) {
    return { ok: false, reason: 'invalid_verdict' };
  }
  const mapped = sectionMap(rubric);
  if (!mapped.ok) {
    return { ok: false, reason: 'invalid_rubric' };
  }
  const statusById = {};
  for (const row of verdict.per_criterion) {
    if (isPlainObject(row) && isNonEmptyString(row.criterion_id)) {
      statusById[row.criterion_id] = FINDING_STATUS_VALUES.has(row.status) ? row.status : 'absent';
    }
  }
  const sectionProfile = {};
  for (const slug of mapped.mapped_sections) {
    const criteria = mapped.sections[slug];
    let evidenced = 0;
    for (const c of criteria) {
      if (statusById[c.id] === 'evidenced') evidenced += 1;
    }
    if (evidenced === criteria.length) sectionProfile[slug] = 'covered';
    else if (evidenced > 0) sectionProfile[slug] = 'partial';
    else sectionProfile[slug] = 'missing';
  }
  const handles = {
    framework: 'grant-application-strategy',
    rubric: isNonEmptyString(verdict.program_id) ? verdict.program_id : 'unknown',
    section_profile: sectionProfile,
    gap_categories: gapCategories(verdict),
  };
  return {
    ok: true,
    brain_available: false,
    handles: handles,
    note: 'Brain consult is recommend-never-trigger from this module: the host command fires the '
      + 'generic-handle query (section coverage enums + gap categories only, never room prose) '
      + 'when Brain is reachable; absent Brain, read the roadmap section_plans directly -- the '
      + 'weakest section leads.',
  };
}

// writeGradingResult(db, params) -- files the verdict as a typed 'heuristic'
// truth-claim node (a graded judgment, not an asserted fact) via
// navigation.writeClaimNode. params = { verdict, sessionId, programName?,
// extraProps? }. Lands review_status 'proposed' (Canon Part 9 role 5: never
// auto-confirmed by an agent; a human APPROVE at the command's Decision Gate
// promotes it via navigation.confirmNode, same as qualify-opportunity.cjs's
// qualifyCandidate). params.extraProps (ADDITIVE, optional, 2026-08-06
// reviewer-panel design pass) is a caller-supplied SCALAR bag merged UNDER the
// standard keys (a caller can add mode:'panel' / dispute_count / sustained_count
// so a panel-graded verdict stays distinguishable in the graph from a
// single-pass one, but can never clobber the standard scalars). Backward
// compatible: omitting it changes nothing. Returns { ok, node_id } or
// { ok:false, reason }. Never throws.
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
      extraProps: Object.assign(
        {},
        isPlainObject(params.extraProps) ? params.extraProps : {},
        {
          program_id: verdict.program_id,
          score_pct: verdict.score_pct,
          evidenced_count: verdict.counts.evidenced,
          asserted_count: verdict.counts.asserted,
          absent_count: verdict.counts.absent,
          total_criteria: verdict.counts.total,
          gap_categories: gapCategories(verdict),
          graded_at: new Date().toISOString(),
        }
      ),
    });
    if (!written || written.ok !== true) {
      return { ok: false, reason: 'claim_write_failed', detail: written && written.reason };
    }
    return { ok: true, node_id: written.node_id };
  } catch (e) {
    return { ok: false, reason: 'write_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

// deriveRulingVerb(rubric, verdict) -- quick task 260806-d0x (reviewer-panel examination
// mode). Pure, no BONO dependency: this belongs with the scoring-domain logic, not the
// orchestration logic (kept as a clean separation of concerns from
// lib/core/eureka/grade-grant-examine.cjs). Resolves a scoreApplication verdict into the
// SAME closed ruling-verb vocabulary runDebate's own RULING_VERBS ships
// (supported | rejected | refined | undecided), so the reviewer-panel ruling step can
// hand its output straight into runDebate's rulingVerb option with zero translation.
//
// The hard-gate rule is grounded in the rubric itself, not invented: Tnufa's own
// eligibility criteria (eligibility_applicant, eligibility_sector,
// eligibility_project_type, restrictions_exclusions, suitability_self_check,
// team_section) are genuinely disqualifying, not scored-on-a-curve -- a strong aggregate
// score with one absent eligibility criterion is a real tension a plain average would
// erase. ANY eligibility criterion at 'absent' overrides the aggregate and forces
// 'rejected', carrying an escalation record { criterion_id, room_section, category,
// reason } naming the failing criterion so the caller can route it through
// findings-wirer.wireReject as a REJECTED_BECAUSE graph record (Canon Part 4: "why not"
// is graph data). 'supported' requires BOTH a strong score (>=80%) AND zero absent
// criteria anywhere in the verdict (not just eligibility) -- a stricter bar than the
// eligibility hard-gate alone, since "supported" claims the WHOLE application is solid,
// not merely eligible. Returns { verb, escalation } where escalation is null except on
// the 'rejected' branch. Never throws.
function deriveRulingVerb(verdict, rubric) {
  if (!isPlainObject(verdict) || !Array.isArray(verdict.per_criterion) || typeof verdict.score_pct !== 'number') {
    return { verb: 'undecided', escalation: null };
  }
  const byId = {};
  if (isPlainObject(rubric) && Array.isArray(rubric.criteria)) {
    for (const c of rubric.criteria) {
      if (isPlainObject(c) && isNonEmptyString(c.id)) byId[c.id] = c;
    }
  }
  for (const row of verdict.per_criterion) {
    if (isPlainObject(row) && row.category === 'eligibility' && row.status === 'absent') {
      const c = byId[row.criterion_id];
      return {
        verb: 'rejected',
        escalation: {
          criterion_id: row.criterion_id,
          room_section: (c && ROOM_SECTION_VALUES.has(c.room_section)) ? c.room_section : null,
          category: 'eligibility',
          reason: 'eligibility_hard_gate_absent',
        },
      };
    }
  }
  const absentCount = (isPlainObject(verdict.counts) && typeof verdict.counts.absent === 'number')
    ? verdict.counts.absent
    : 1;
  if (verdict.score_pct >= 80 && absentCount === 0) {
    return { verb: 'supported', escalation: null };
  }
  if (verdict.score_pct >= 50) {
    return { verb: 'refined', escalation: null };
  }
  return { verb: 'undecided', escalation: null };
}

module.exports = {
  listPrograms,
  loadRubric,
  validateRubric,
  scoreApplication,
  gapCategories,
  sectionMap,
  buildRoadmap,
  askBrainForCoaching,
  askBrainForStrategy,
  writeGradingResult,
  deriveRulingVerb,
  FIXTURES_DIR,
  CATEGORY_VALUES,
  FINDING_STATUS_VALUES,
  ROOM_SECTION_VALUES,
};
