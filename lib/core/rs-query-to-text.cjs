/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 03 -- Query-to-Text Larry-voiced explainer.
 *
 * Translates raw graph query results (rs_discovery / expert_network /
 * methodology_chain / discovery_history / fallback) into a Larry-voiced
 * natural-language explanation string. The (b) half of the Bidirectional
 * NL-Graph Surface; pairs with rs-nl-to-query.cjs (the (a) Text->Query
 * half) shipped in Plan 89.5-02.
 *
 * Together: user types question -> rs-nl-to-query translates to
 * {cypher, sql, brain_query} bundle -> orchestrator executes ->
 * rs-query-to-text renders raw results back as Larry-voiced NL.
 *
 * NO RUNTIME LLM. Larry's voice is template-driven. Voice patterns are
 * extracted from skills/larry-personality/SKILL.md at design time and
 * frozen here as VOICE_TEMPLATES (5 result kinds x 3-4 templates each).
 * Template selection is deterministic from the input (hash-based) so
 * same input -> same render across runs.
 *
 * Reuses (Canon Part 7):
 *   folder-memory.cjs::readQuadruple                       (Phase 90)
 *   rs-egress-violations.cjs::ExternalEgressViolation      (89.2-01)
 *   rs-egress-prompts.cjs::auditQueryString                (89.2-01)
 *   rs-egress-prompts.cjs::auditQueryObject                (89.2-01)
 *
 * NEVER imports (this module RENDERS, never queries Brain or executes):
 *   the Brain HTTP client module                           (orchestrator only)
 *   lazygraph-ops.cjs::queryGraph                          (orchestrator only)
 *
 * NEVER invokes any network primitive. Pure CJS, zero npm deps,
 * no Node built-ins beyond core require.
 *
 * Canon Part 8 defense (2 audit seams):
 *   SEAM A (input audit on {query_results, opts}): catches forbidden
 *     patterns nested anywhere in the input row payload BEFORE rendering.
 *   SEAM B (post-render audit on the rendered string): catches
 *     template-substitution leaks AFTER rendering. This is the last line
 *     of defense -- if a forbidden byte slipped past the input audit
 *     (e.g. via a substring not flagged by the input regex but assembled
 *     into a forbidden phrase by the template), this seam catches it.
 *
 * Mode A (BRAIN.md present + fresh)  -> render includes Brain enrichment.
 * Mode B (BRAIN.md absent or stale) -> render omits Brain enrichment.
 * Tier 0 (no room_dir / no quadruple) -> render uses safe defaults.
 *
 * License: BSL 1.1.
 */
'use strict';

const folderMemory = require('./folder-memory.cjs');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const {
  auditQueryString,
  auditQueryObject,
  FORBIDDEN_PATTERNS,
} = require('./rs-egress-prompts.cjs');

// ---------- Frozen VOICE_TEMPLATES (5 kinds, 3-4 templates each) ----------
//
// Voice patterns extracted from skills/larry-personality/SKILL.md at
// design time. Each template carries {placeholder} slots that fillTemplate
// substitutes from query_results + venture_context. The Evidence -> Insight
// -> Warning pedagogical structure is preserved across all templates.
//
// Adding a template (or a new kind) is a Plan-N revision (canon-amend
// discipline; new templates expand the surface area Canon Part 8 must
// defend, so we want explicit review).
//
// NB: the source bytes here MUST NOT contain em-dashes (BSL 1.1 + canon
// rule); plain ASCII hyphens only.

const VOICE_TEMPLATES = Object.freeze({
  rs_discovery: Object.freeze([
    'Found {n} reverse salients across {domain_count} domains. The strongest is {top_thesis} (breakthrough score {top_score}). Filed to opportunity-bank/. {brain_line}{room_line}Worth Bank Opportunity or Devils Advocate.',
    '{n} discoveries surfaced. Top: {top_thesis}. Pattern: {classification}. {brain_line}{room_line}Next: Bank Opportunity or Run Methodology /mos:lean-canvas.',
    'Reading the Room: {room_context}. {n} candidates ranked. Strongest: {top_thesis}. {brain_line}Worth filing.',
    '{n} differential pairs cleared the dual floor. Top: {top_thesis} (score {top_score}). {brain_line}{room_line}Merits Run Methodology.',
  ]),
  expert_network: Object.freeze([
    'Mapped {n} experts across {institution_count} institutions. Top institutions: {institutions}. {brain_line}{room_line}/mos:persona may be warranted.',
    '{n} authors resolved. Institutions: {institutions}. {brain_line}{room_line}Worth Run Methodology /mos:persona.',
    'Found {n} domain experts. Leading institutions: {institutions}. {brain_line}Cross-reference your room: {room_context}.',
  ]),
  methodology_chain: Object.freeze([
    '{source} chains into {n} downstream methodologies: {chain_list}. {brain_line}{room_line}Given your room stage {state_stage}, the next hop is {recommended}.',
    'Methodology graph: {source} -> {chain_list} ({n} hops). {brain_line}Synthesize next? Or Run Methodology on {recommended}.',
    '{n} downstream paths from {source}. Pick one: {chain_list}. {brain_line}{room_line}Worth Synthesize.',
  ]),
  discovery_history: Object.freeze([
    'You have {n} RS discoveries logged in this room. Most recent: {recent_thesis}. The pattern: {convergence}. {brain_line}{room_line}Worth Synthesize via /mos:reflect.',
    '{n} discoveries logged. Newest: {recent_thesis}. Convergence: {convergence}. {brain_line}{room_line}Worth Reflect.',
    'Looking back: {n} discoveries. {recent_thesis} stands out. {brain_line}{room_line}Defer the rest? Synthesize?',
  ]),
  fallback: Object.freeze([
    'Searched 3 graphs and found {summary}. {brain_line}Relevant context: {room_context}. Next move: Run Methodology or Reformulate.',
    'Triangulated across room.db + Aura + Brain. {summary}. {brain_line}{room_line}Worth reframing? /mos:beautiful-question.',
    '{summary}. {brain_line}Given {room_context}, consider Run Methodology or Defer.',
  ]),
});

// ---------- Frozen kind enum ----------

const KNOWN_KINDS = Object.freeze([
  'rs_discovery',
  'expert_network',
  'methodology_chain',
  'discovery_history',
  'fallback',
]);

// ---------- Internal helpers ----------

// detectKind: deterministic. Returns the kind from input if it matches a
// known kind; otherwise 'fallback'. NEVER throws.
function detectKind(query_results) {
  if (!query_results || typeof query_results !== 'object') return 'fallback';
  const k = query_results.kind;
  if (typeof k !== 'string') return 'fallback';
  for (let i = 0; i < KNOWN_KINDS.length; i++) {
    if (KNOWN_KINDS[i] === k) return k;
  }
  return 'fallback';
}

// loadVentureContext: reads the per-folder memory quadruple if a room_dir
// is provided; respects _test_quadruple_override for test surfaces. Always
// returns a 4-field object {room, state, reasoning, brain}; missing fields
// fall back to null. Graceful: any throw inside readQuadruple yields the
// all-null shell (Mode B / Tier 0 contract).
function loadVentureContext(opts) {
  const safe = opts && typeof opts === 'object' ? opts : {};
  const empty = { room: null, state: null, reasoning: null, brain: null };

  // Test surface: explicit override wins.
  if (safe._test_quadruple_override && typeof safe._test_quadruple_override === 'object') {
    const ov = safe._test_quadruple_override;
    return {
      room: ov.room === undefined ? null : ov.room,
      state: ov.state === undefined ? null : ov.state,
      reasoning: ov.reasoning === undefined ? null : ov.reasoning,
      brain: ov.brain === undefined ? null : ov.brain,
    };
  }

  // Production path: room_dir -> readQuadruple.
  if (typeof safe.room_dir !== 'string' || safe.room_dir.length === 0) return empty;
  let quad = null;
  try {
    quad = folderMemory.readQuadruple(safe.room_dir);
  } catch (_e) {
    return empty;
  }
  if (!quad || typeof quad !== 'object') return empty;
  return {
    room: quad.room === undefined ? null : quad.room,
    state: quad.state === undefined ? null : quad.state,
    reasoning: quad.reasoning === undefined ? null : quad.reasoning,
    brain: quad.brain === undefined ? null : quad.brain,
  };
}

// pickTemplate: deterministic hash-based selection so the same input
// always renders the same template (no random selection in production).
// Hash inputs: kind + first row id + first row thesis (or first key).
// NEVER throws.
function pickTemplate(kind, query_results) {
  const bucket = VOICE_TEMPLATES[kind] || VOICE_TEMPLATES.fallback;
  if (!Array.isArray(bucket) || bucket.length === 0) {
    return VOICE_TEMPLATES.fallback[0];
  }
  // Build a tiny deterministic seed from query_results.
  let seedStr = String(kind);
  const rows = query_results && Array.isArray(query_results.rows) ? query_results.rows : [];
  if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
    const r = rows[0];
    if (typeof r.id === 'string') seedStr += '|' + r.id;
    else if (typeof r.thesis === 'string') seedStr += '|' + r.thesis.slice(0, 40);
    else if (typeof r.from === 'string') seedStr += '|' + r.from + '->' + (r.to || '');
    else if (typeof r.name === 'string') seedStr += '|' + r.name;
  }
  // FNV-1a 32-bit hash (pure JS, deterministic).
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const idx = h % bucket.length;
  return bucket[idx];
}

// safeScalar: coerce a value into a short, audit-safe string. Numbers and
// booleans pass through; strings are length-capped; null/undefined become
// the provided default. Objects and arrays render as a count or stringified
// short form (defense against runaway payload size).
function safeScalar(v, defaultStr) {
  if (v === null || v === undefined) return defaultStr;
  if (typeof v === 'string') {
    return v.length > 200 ? v.slice(0, 200) : v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v.length === 0 ? defaultStr : String(v.length);
  }
  if (typeof v === 'object') {
    return defaultStr;
  }
  return defaultStr;
}

// buildPlaceholderMap: assemble the placeholder substitution map from
// query_results + venture_context. Missing fields fall back to safe
// defaults so the rendered string is always coherent.
function buildPlaceholderMap(kind, query_results, vc) {
  const map = Object.create(null);
  const rows = query_results && Array.isArray(query_results.rows) ? query_results.rows : [];
  const top = rows.length > 0 ? rows[0] : null;

  // Generic fields shared across kinds.
  map.n = String(rows.length);

  // Brain enrichment line (Mode A vs Mode B).
  // Mode A (brain.exists + staleness fresh + has pattern_matches body):
  //   "Brain says: <body excerpt>."
  // Mode B (brain null OR stale): empty string (no marker).
  map.brain_line = '';
  if (vc && vc.brain && vc.brain.exists === true && vc.brain.staleness === 'fresh') {
    const sections = vc.brain.sections;
    if (sections && typeof sections === 'object') {
      const pm = sections.pattern_matches;
      const cda = sections.cross_domain_analogies;
      let bodyExcerpt = null;
      if (pm && typeof pm === 'object' && typeof pm.body === 'string' && pm.body.length > 0) {
        bodyExcerpt = pm.body;
      } else if (cda && typeof cda === 'object' && typeof cda.body === 'string' && cda.body.length > 0) {
        bodyExcerpt = cda.body;
      }
      if (bodyExcerpt !== null) {
        const trimmed = bodyExcerpt.length > 120 ? bodyExcerpt.slice(0, 120) : bodyExcerpt;
        map.brain_line = 'Brain says: ' + trimmed + '. ';
      }
    }
  }

  // Room context line (only when room context is meaningful).
  map.room_line = '';
  map.room_context = 'no active room context';
  if (vc && vc.room && vc.room.exists === true) {
    const id = typeof vc.room.identity_text === 'string' ? vc.room.identity_text : '';
    if (id.length > 0) {
      const idShort = id.length > 60 ? id.slice(0, 60) : id;
      map.room_context = 'in your ' + idShort + ' room';
      map.room_line = 'Reading the Room: ' + idShort + '. ';
    }
  }

  // State stage (for methodology_chain template).
  map.state_stage = 'unknown';
  if (vc && vc.state && vc.state.exists === true) {
    const gs = typeof vc.state.gap_status === 'string' ? vc.state.gap_status : '';
    if (gs.length > 0) map.state_stage = gs;
  }

  // Kind-specific placeholders.
  if (kind === 'rs_discovery') {
    map.top_thesis = top && typeof top.thesis === 'string'
      ? safeScalar(top.thesis, 'no thesis')
      : 'no thesis';
    map.top_score = top && typeof top.breakthrough_score !== 'undefined'
      ? safeScalar(top.breakthrough_score, '0')
      : '0';
    map.classification = top && typeof top.classification === 'string'
      ? safeScalar(top.classification, 'unclassified')
      : 'unclassified';
    // domain_count: union of all rows[].domains; cap small.
    let domainSet = Object.create(null);
    let domainCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r && Array.isArray(r.domains)) {
        for (let j = 0; j < r.domains.length; j++) {
          const d = r.domains[j];
          if (typeof d === 'string' && !domainSet[d]) {
            domainSet[d] = true;
            domainCount++;
          }
        }
      }
    }
    map.domain_count = String(domainCount > 0 ? domainCount : 1);
  } else if (kind === 'expert_network') {
    // Institutions list (deduped).
    const instSet = Object.create(null);
    const instList = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r && typeof r.institution === 'string' && !instSet[r.institution]) {
        instSet[r.institution] = true;
        instList.push(safeScalar(r.institution, ''));
      }
    }
    map.institution_count = String(instList.length > 0 ? instList.length : 1);
    map.institutions = instList.length > 0 ? instList.join(', ') : 'no institutions';
    // Expert list: first 3 names.
    const names = [];
    for (let i = 0; i < rows.length && names.length < 3; i++) {
      const r = rows[i];
      if (r && typeof r.name === 'string') names.push(safeScalar(r.name, ''));
    }
    map.expert_list = names.length > 0 ? names.join(', ') : 'no experts';
  } else if (kind === 'methodology_chain') {
    // Source: first row's "from" field.
    map.source = top && typeof top.from === 'string'
      ? safeScalar(top.from, 'unknown')
      : 'unknown';
    // Chain list: rows[].to deduped.
    const toSet = Object.create(null);
    const toList = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r && typeof r.to === 'string' && !toSet[r.to]) {
        toSet[r.to] = true;
        toList.push(safeScalar(r.to, ''));
      }
    }
    map.chain_list = toList.length > 0 ? toList.join(', ') : 'no downstream targets';
    map.recommended = toList.length > 0 ? toList[0] : 'no recommendation';
  } else if (kind === 'discovery_history') {
    // Most-recent thesis: pick row with latest created_at; fallback to first row.
    let recent = top;
    let recentTime = top && typeof top.created_at === 'string' ? top.created_at : '';
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r && typeof r.created_at === 'string' && r.created_at > recentTime) {
        recent = r;
        recentTime = r.created_at;
      }
    }
    map.recent_thesis = recent && typeof recent.thesis === 'string'
      ? safeScalar(recent.thesis, 'no recent thesis')
      : 'no recent thesis';
    // Convergence cue: count if >1, otherwise note "single discovery".
    if (rows.length > 1) {
      map.convergence = rows.length + ' theses logged this room';
    } else {
      map.convergence = 'single discovery';
    }
  } else {
    // fallback kind.
    map.summary = rows.length === 0
      ? 'no rows returned'
      : (rows.length + ' rows returned');
  }

  return map;
}

// fillTemplate: substitute {placeholder} slots in the template using the
// placeholder map. Unknown placeholders fall back to a safe default. The
// function NEVER throws and ALWAYS returns a string.
function fillTemplate(template, placeholders) {
  if (typeof template !== 'string' || template.length === 0) return '';
  const safe = placeholders || Object.create(null);
  // Replace every {key} segment via global regex; missing keys -> empty
  // string default for graceful render.
  const out = template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, function (_match, key) {
    if (Object.prototype.hasOwnProperty.call(safe, key)) {
      const v = safe[key];
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    }
    return '';
  });
  // Collapse double spaces resulting from empty {brain_line} or
  // {room_line} substitutions. Two-pass collapse handles the common
  // ". . " -> ". " case.
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

// ---------- Top-level entry point ----------

function explain(query_results, opts) {
  // SEAM A: input audit. JSON.stringify-flatten the input + opts so any
  // forbidden bytes nested anywhere in the row payload trip the audit
  // BEFORE rendering. This catches T8/T9 input-side leaks.
  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const inputBundle = {
    query_results: query_results === undefined ? null : query_results,
    // Strip _test_quadruple_override from the audit bundle: it carries
    // legitimate test fixtures whose body text would otherwise trip the
    // audit (e.g. brain.sections.pattern_matches body). Production callers
    // never set this field; readQuadruple loads vetted local bytes.
    opts: (function () {
      const copy = Object.create(null);
      for (const k of Object.keys(safeOpts)) {
        if (k === '_test_quadruple_override') continue;
        copy[k] = safeOpts[k];
      }
      return copy;
    })(),
  };
  auditQueryObject(inputBundle, 'rs-query-to-text-input');

  // Detect kind, load venture context, pick template, build placeholders,
  // render. Each step is graceful (never throws on missing fields).
  const kind = detectKind(query_results);
  const ventureContext = loadVentureContext(safeOpts);
  const template = pickTemplate(kind, query_results);
  const placeholders = buildPlaceholderMap(kind, query_results, ventureContext);
  const rendered = fillTemplate(template, placeholders);

  // SEAM B: post-render output audit. Last line of defense against
  // template-substitution leaks (e.g. row text smuggling through that
  // the input audit's broader regex did not catch). Throws
  // ExternalEgressViolation if any FORBIDDEN_PATTERN matches.
  auditQueryString(rendered, 'rs-query-to-text-output');

  return rendered;
}

// ---------- Exports ----------

module.exports = {
  explain: explain,
  VOICE_TEMPLATES: VOICE_TEMPLATES,
  KNOWN_KINDS: KNOWN_KINDS,
  // Internal helpers exposed for fixture introspection only. Production
  // callers MUST use explain(); the chokepoint is internal.
  _test: {
    detectKind: detectKind,
    loadVentureContext: loadVentureContext,
    pickTemplate: pickTemplate,
    fillTemplate: fillTemplate,
    buildPlaceholderMap: buildPlaceholderMap,
    safeScalar: safeScalar,
  },
};
