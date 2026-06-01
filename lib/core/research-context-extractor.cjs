'use strict';
/*
 * Phase 131-02 -- research-context-extractor: the Stage 1+2+3 pre-flight + plan
 * extractor for the source-lens research pipeline.
 *
 * This is the explicit moment research becomes context-aware rather than blind.
 * Per the 4.8 re-baseline (131-REVIEW-4.8 section 2), the three pipeline stages
 * COLLAPSE into a single reasoning pass over ONE batched read:
 *   Stage 1 (PRE-FLIGHT)      -- ONE navigation.getResearchPreflight call (the
 *                                Plan 01 batched 8-input read; never 8 sequential
 *                                reads).
 *   Stage 2 (CONTEXT SUMMARY) -- a Body Shape A (one conversational paragraph)
 *                                Larry-voiced context summary, framed by the
 *                                dominant role in the persona role_blend.
 *   Stage 3 (LENS SET)        -- a weighted, ordered { lens, weight } source-lens
 *                                set COMPUTED from the room context (section gap /
 *                                JTBD / persona role_blend), never hardcoded.
 *
 * REUSE BEFORE BUILD (Canon Part 7): this module EXTENDS the Plan 01 surface
 * (navigation.getResearchPreflight) -- it is a pure-over-navigation reader that
 * adds the summary + lens-set reasoning the driver (Plan 03) and the command
 * (Plan 05) consume. It does NOT re-read the room: it composes the single batched
 * pre-flight the substrate already provides. The role_blend framing mirrors the
 * Phase 130 lens-engine.cjs readRoleBlend idiom (persona-aware framing hook), but
 * here the persona is delivered BY the pre-flight, so this module never opens
 * USER.md itself either.
 *
 * SUBSTRATE CONTRACT (the hard invariant, asserted by scripts/check-substrate.cjs):
 * this module reaches room.db ONLY through lib/core/navigation.cjs. It carries
 * ZERO direct require of room-db.cjs / lazygraph-ops.cjs / node:sqlite -- it is
 * NOT in the substrate-guard allow-list, so the guard must return clean on it.
 * The db handle is CALLER-OWNED: it arrives via opts.db (the lens-engine /
 * lens-nodes convention) and is forwarded verbatim to getResearchPreflight. The
 * extractor never opens or closes room.db.
 *
 * Canon Part 8: the summary is LOCAL-only (rendered to the user, never sent to
 *   Brain). This module makes ZERO Brain calls, ZERO corpus fetches, and ZERO
 *   external-process invocations. It is read-only over the pre-flight the
 *   navigation chokepoint already produced. The actual external fetch (with its
 *   pre-egress audit) is Plan 03 via the Phase 130.5 corpus.
 * Canon Part 9: SQL is the local mind; the single read goes through the existing
 *   getResearchPreflight chokepoint. Composition, not duplication.
 * Canon Part 2a: persona = role-blend x journey-stage; the summary frames in the
 *   dominant role's voice.
 * Canon Part 5: the gap framing names the evidence-gap count (the needs_evidence
 *   pressure the navigator should weigh before fetching).
 *
 * Defensive (T-131-02-02): a null / malformed pre-flight (cold room) returns a
 *   scholarly-only Tier-0 default lens set + a graceful summary; the extractor
 *   never throws.
 *
 * Exports:
 *   extractContext({ roomDir, sessionId, topic, db })
 *     -> { ok:true, context_summary, lens_set, preflight }
 *   computeLensSet(preflight) -> ordered [{ lens, weight }]
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const navigation = require('./navigation.cjs');

// The closed source-lens vocabulary this phase computes over (131-CONTEXT Stage 3).
// scholarly is the Tier-0 default floor (a cold room always gets at least this).
const LENS = Object.freeze({
  SCHOLARLY: 'scholarly',
  INDUSTRY: 'industry',
  PATENT: 'patent',
  BRAIN: 'brain',
  COMPETITIVE: 'competitive-intelligence',
  GRANTS: 'grants',
});

// Base weights for the section-gap family + the JTBD methodology lens. A
// financial-model gap leads with scholarly evidence, then industry, then patent;
// the weights are differentiated (weighted-by-context, not a flat 1.0 list) so
// the Plan 03 source-family rotation can order its fetch by priority.
const SECTION_GAP_WEIGHTS = Object.freeze({
  [LENS.SCHOLARLY]: 1.0,
  [LENS.INDUSTRY]: 0.8,
  [LENS.PATENT]: 0.6,
});
const BRAIN_WEIGHT = 0.7;
const COMPETITIVE_WEIGHT = 0.7;
const GRANTS_WEIGHT = 0.8;
// Persona reinforcement bumps. A researcher weight reinforces scholarly; an
// investor weight reinforces competitive-intelligence. Bumps are additive on top
// of a present lens, and seed the lens when the section-gap path did not add it.
const RESEARCHER_SCHOLARLY_BUMP = 0.2;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Resolve the dominant role from a role_blend tuple (e.g. { investor:0.7,
// founder:0.3 } -> 'investor'). Returns null on an empty / malformed blend so the
// caller frames in a neutral voice. Pure; never throws.
function dominantRole(roleBlend) {
  if (!isPlainObject(roleBlend)) return null;
  let best = null;
  let bestW = -Infinity;
  for (const role of Object.keys(roleBlend)) {
    const w = Number(roleBlend[role]);
    if (Number.isFinite(w) && w > bestW) {
      bestW = w;
      best = role;
    }
  }
  return best;
}

// Read a numeric weight for a role key from the blend (0 when absent / malformed).
function roleWeight(roleBlend, key) {
  if (!isPlainObject(roleBlend)) return 0;
  const w = Number(roleBlend[key]);
  return Number.isFinite(w) && w > 0 ? w : 0;
}

// Pull a comparable JTBD string out of the pre-flight active_jtbd (which is an
// object { jtbd, kind, ... } per the Plan 01 contract, or occasionally a bare
// string). Returns '' when absent.
function jtbdString(activeJtbd) {
  if (typeof activeJtbd === 'string') return activeJtbd;
  if (isPlainObject(activeJtbd) && typeof activeJtbd.jtbd === 'string') return activeJtbd.jtbd;
  return '';
}

// computeLensSet(preflight) -- the Stage 3 rule set. Applies the 131-CONTEXT
// Stage 3 rules to the batched pre-flight and returns an ORDERED, weighted
// [{ lens, weight }] list. The order is the fetch-priority order the Plan 03
// source-family rotation consumes. The set is CONTEXT-DERIVED: a different
// pre-flight yields a different set. A null / cold pre-flight degrades to the
// scholarly-only Tier-0 default. Never throws.
//
// Rules (131-CONTEXT Stage 3):
//   - current_section is a financial-model gap -> scholarly + industry + patent.
//   - active_jtbd is thesis-build              -> add brain (methodology chain).
//   - role_blend has investor weight           -> add competitive-intelligence.
//   - role_blend has researcher weight         -> bump scholarly (seed if absent).
//   - role_blend has founder.grant weight      -> add grants.
// The scholarly lens is the floor: when no rule fires (cold room) the result is
// exactly [{ lens:'scholarly', weight:1.0 }].
function computeLensSet(preflight) {
  const pf = isPlainObject(preflight) ? preflight : {};
  const section = typeof pf.current_section === 'string' ? pf.current_section : '';
  const jtbd = jtbdString(pf.active_jtbd);
  const roleBlend = isPlainObject(pf.role_blend) ? pf.role_blend : null;

  // Ordered accumulator: a Map preserves first-insertion order, and a later rule
  // can BUMP a present lens weight without duplicating it.
  const ordered = new Map();
  function add(lens, weight) {
    if (ordered.has(lens)) {
      ordered.set(lens, ordered.get(lens) + weight);
    } else {
      ordered.set(lens, weight);
    }
  }

  // Rule 1 -- section gap. financial-model (the 131-CONTEXT canonical gap) leads
  // the scholarly/industry/patent triple. A generic non-empty section still seeds
  // the scholarly floor (the gap is somewhere; scholarly is always defensible).
  const isFinancialModelGap = /financial-model/.test(section);
  if (isFinancialModelGap) {
    add(LENS.SCHOLARLY, SECTION_GAP_WEIGHTS[LENS.SCHOLARLY]);
    add(LENS.INDUSTRY, SECTION_GAP_WEIGHTS[LENS.INDUSTRY]);
    add(LENS.PATENT, SECTION_GAP_WEIGHTS[LENS.PATENT]);
  }

  // Rule 2 -- thesis-build JTBD adds the brain methodology-chain lens.
  if (/thesis-build/.test(jtbd)) {
    add(LENS.BRAIN, BRAIN_WEIGHT);
  }

  // Rule 3 -- investor weight adds a competitive-intelligence weight.
  if (roleWeight(roleBlend, 'investor') > 0) {
    add(LENS.COMPETITIVE, COMPETITIVE_WEIGHT);
  }

  // Rule 4 -- researcher weight bumps scholarly (seeds it if no section rule did).
  if (roleWeight(roleBlend, 'researcher') > 0) {
    add(LENS.SCHOLARLY, RESEARCHER_SCHOLARLY_BUMP);
  }

  // Rule 5 -- founder.grant weight adds the grants lens.
  if (roleWeight(roleBlend, 'founder.grant') > 0) {
    add(LENS.GRANTS, GRANTS_WEIGHT);
  }

  // Tier-0 floor: a cold room (no rule fired) gets scholarly only.
  if (ordered.size === 0) {
    ordered.set(LENS.SCHOLARLY, 1.0);
  }

  // Materialize the ordered list, rounding weights to a stable 2-dp scalar.
  const out = [];
  for (const [lens, weight] of ordered.entries()) {
    out.push({ lens, weight: Math.round(weight * 100) / 100 });
  }
  return out;
}

// renderContextSummary(preflight) -- Stage 2. A SINGLE Body Shape A paragraph
// (one conversational sentence-stream; no Shape E action-report header, no
// F-selector block, no markdown headings) framed in the dominant role's voice
// per Canon Part 2a. Names the active workflow + JTBD + current section + the
// evidence-gap count when non-empty (Canon Part 5). Mirrors the 131-CONTEXT
// Stage 2 example sentence as the template. Pure; never throws.
function renderContextSummary(preflight, topic) {
  const pf = isPlainObject(preflight) ? preflight : {};
  const workflow = typeof pf.active_workflow === 'string' ? pf.active_workflow : null;
  const jtbd = jtbdString(pf.active_jtbd);
  const section = typeof pf.current_section === 'string' ? pf.current_section : null;
  const gaps = Array.isArray(pf.evidence_gaps) ? pf.evidence_gaps.length : 0;
  const role = dominantRole(pf.role_blend);
  const subject = typeof topic === 'string' && topic.trim().length > 0 ? topic.trim() : 'this topic';

  // The dominant-role framing prefix (Canon Part 2a). Neutral when role unknown.
  const voice = role
    ? ('Speaking to your ' + role + ' lens, ')
    : '';

  // Cold room: a graceful, honest one-paragraph summary. Never a throw, never a
  // misleading claim of context the room does not have.
  if (!workflow && !jtbd && !section && gaps === 0) {
    return (voice + 'this looks like a cold start with no active workflow, JTBD, or '
      + 'section in focus yet, so I will research ' + subject + ' against a broad '
      + 'scholarly baseline and we can sharpen the lens as the room fills in.').trim();
  }

  // Hot path: name the load-bearing context scalars in one flowing sentence.
  const parts = [];
  if (workflow) parts.push('you are in the ' + workflow + ' workflow');
  if (jtbd) parts.push('your JTBD is ' + jtbd);
  if (section) parts.push('the section in focus is ' + section);
  let sentence = voice;
  if (parts.length > 0) {
    sentence += parts.join(', ') + '. ';
  }
  if (gaps > 0) {
    sentence += 'You have ' + gaps + ' evidence ' + (gaps === 1 ? 'gap' : 'gaps')
      + ' tagged needs_evidence here, ';
  }
  sentence += 'so I will research ' + subject + ' against THIS context.';
  // Collapse any accidental double spaces and trim to keep it a clean single line.
  return sentence.replace(/\s{2,}/g, ' ').trim();
}

// extractContext(opts) -- the single pre-flight + plan pass. Calls
// navigation.getResearchPreflight ONCE, renders the Body Shape A summary, and
// computes the weighted lens set, all from that one read. Returns the documented
// shape. Defensive: a thrown / null pre-flight degrades to the cold-room default
// (scholarly-only lens set + graceful summary); never throws.
function extractContext(opts) {
  const options = isPlainObject(opts) ? opts : {};
  const roomDir = typeof options.roomDir === 'string' ? options.roomDir : null;
  const sessionId = typeof options.sessionId === 'string' ? options.sessionId : null;
  const topic = typeof options.topic === 'string' ? options.topic : '';
  const db = options.db || null;

  // STAGE 1 -- the ONE batched read through the navigation chokepoint. Wrapped so
  // a read failure degrades to a null pre-flight (cold-room path) rather than
  // throwing out of the extractor.
  let preflight = null;
  try {
    preflight = navigation.getResearchPreflight(db, { roomDir, sessionId, topic });
  } catch (_e) {
    preflight = null;
  }
  const pf = isPlainObject(preflight) ? preflight : null;

  // STAGES 2 + 3 -- one reasoning pass over the single read.
  const context_summary = renderContextSummary(pf, topic);
  const lens_set = computeLensSet(pf);

  return {
    ok: true,
    context_summary,
    lens_set,
    preflight: pf,
  };
}

module.exports = { extractContext, computeLensSet };
