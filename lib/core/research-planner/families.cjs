'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363-08 -- research-planner query-family composer.
 *
 * D-02a / D-04 (Canon Part 8): this module is the ONLY source of outbound
 * research query strings for the deep-research planner. A query is made from
 * a frozen family template id plus typed slots, never from free text. For a
 * THEO destination every slot value and every composed string passes the ONE
 * shipped audit fence (auditQueryString in lib/core/rs-egress-prompts.cjs, no
 * private copy) BEFORE it can be returned; the first failure returns a
 * local-only degrade that names only the family and template id, never the slot
 * or the string (no echo, no send-anyway path). A WEB destination runs no audit
 * (navigator ruling 2026-10-05, 369.2-05): its queries are stamped audit
 * 'not_applicable', the run grant card shows the exact strings, and the audit
 * ledger records every one.
 *
 * Templates render the quotes and the uppercase Boolean operators themselves;
 * the model never types them. Each query is single-line, at most
 * MAX_QUERY_CHARS (reused from lane-queries.cjs), and carries
 * q_hash = 'sha256:' + hex of its exact bytes (363-RESEARCH.md Pitfall 3).
 *
 * Known limit (363-RESEARCH.md Pitfall 7): the audit is a PII and financial
 * blocklist, so a confidential technical term can pass it. That is why the
 * grant asks the first time a new term would leave (D-10); slotTerms() is the
 * hook 363-09 uses to detect it.
 *
 * Two slot rules, by destination (SEED-115, navigator ruling 2026-10-04):
 *  - WEB search lines (the default: OpenAlex, Tavily, WebSearch fallback): a slot
 *    may carry a room phrase or a room question. composableQuery() trims, strips
 *    markdown, collapses whitespace and allows sentence boundaries, up to
 *    SLOT_RULES.query_max_chars. The composed string is sent as written under the
 *    run's grant, and the grant card and the plan show it before anything leaves.
 *    The web lines are governed by that grant (and recorded in the audit ledger),
 *    not by Part 8 and not by the content audit (ruling 2026-10-05).
 *  - THEO (the Brain): Canon Part 8 is about the Brain. A theo destination keeps
 *    the strict SEED-104 rule: a slot value is a short canon-name term, never room
 *    prose. proseShaped() flags markdown, table pipes, heading, blockquote and list
 *    markers and sentence boundaries; composeFamily({destination:'theo'}) and
 *    composeForLeaf on a theo corpus leaf refuse such a slot with the typed reason
 *    term_not_composed (no echo). composableTerm() is that strict gate.
 *    stripMarkdown() only cleans a candidate and never makes a sentence composable.
 *
 * Pure CJS: no fs, no network, no clock. Deterministic.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const crypto = require('node:crypto');
const { auditQueryString } = require('../rs-egress-prompts.cjs');
const { MAX_QUERY_CHARS } = require('../dominant-design/lane-queries.cjs');

const SURFACE = 'research-planner';

// SLOT_RULES: the typed-slot contract. A term is 2 to 80 characters after
// trimming and free of quote, control, parenthesis and backslash characters
// and of standalone AND / OR / NOT tokens. Synonyms are 1 to 3 distinct terms.
const SLOT_RULES = Object.freeze({
  term_min_chars: 2,
  term_max_chars: 80,
  query_max_chars: 200,
  synonyms_min: 1,
  synonyms_max: 3,
  max_query_chars: MAX_QUERY_CHARS,
  forbidden_chars: '"  newline  tab  (  )  backslash',
  forbidden_tokens: Object.freeze(['AND', 'OR', 'NOT']),
});

const BAD_CHAR_RE = /["\r\n\t()\\]/;
const OPERATOR_TOKENS = { and: true, or: true, not: true };

function q1(t) { return '"' + t + '"'; }
function tpl(id, role, needs, render) {
  return Object.freeze({ id: id, role: role, needs: Object.freeze(needs), render: render });
}

// Slot names each family accepts, in the canonical audit order.
// "optional" slots may be absent; a template that needs an absent optional
// slot is skipped in the default selection and refused when requested by id.
const FAMILY_SLOTS = Object.freeze({
  'whitespace-gap/v1': Object.freeze({ order: ['term', 'synonyms'], required: ['term'] }),
  'concept-evidence/v1': Object.freeze({ order: ['term', 'term2'], required: ['term'] }),
  'causal-link/v1': Object.freeze({ order: ['cause', 'effect'], required: ['cause', 'effect'] }),
  'constraint-interrogation/v1': Object.freeze({ order: ['limiter'], required: ['limiter'] }),
  'diffusion/v1': Object.freeze({ order: ['technology'], required: ['technology'] }),
});

// Disclosed default wording for every family below; tuned against replay
// fixtures in 363-20. Templates render quotes and operators, never the model.

// whitespace-gap/v1 (D-04): the only family a standing grant may cover in 363.
const WHITESPACE_GAP = Object.freeze({
  id: 'whitespace-gap/v1',
  templates: Object.freeze([
    tpl('ws.exact', 'primary', ['term'], function (s) { return q1(s.term); }),
    tpl('ws.synonym_cover', 'falsifier_covered_elsewhere', ['term', 'synonyms'], function (s) {
      return q1(s.term) + ' OR ' + s.synonyms.map(q1).join(' OR ');
    }),
    tpl('ws.prior_attempts', 'falsifier_tried_before', ['term'], function (s) {
      return q1(s.term) + ' AND (review OR survey OR "systematic review")';
    }),
    tpl('ws.absence_reason', 'context', ['term'], function (s) {
      return q1(s.term) + ' AND (limitation OR barrier OR infeasible)';
    }),
  ]),
});

// concept-evidence/v1: does evidence exist for or against a concept.
const CONCEPT_EVIDENCE = Object.freeze({
  id: 'concept-evidence/v1',
  templates: Object.freeze([
    tpl('ce.exact', 'primary', ['term'], function (s) { return q1(s.term); }),
    tpl('ce.counter', 'falsifier', ['term'], function (s) {
      return q1(s.term) + ' AND (limitation OR failure OR "no effect")';
    }),
    tpl('ce.prior_success', 'prior', ['term'], function (s) {
      return q1(s.term) + ' AND (success OR adoption OR "case study")';
    }),
    tpl('ce.alternative', 'alternative', ['term'], function (s) {
      return q1(s.term) + ' AND (alternative OR substitute)';
    }),
    tpl('ce.pair', 'pair', ['term', 'term2'], function (s) {
      return q1(s.term) + ' AND ' + q1(s.term2);
    }),
  ]),
});

// causal-link/v1: is a cause-effect link supported, and what breaks it.
const CAUSAL_LINK = Object.freeze({
  id: 'causal-link/v1',
  templates: Object.freeze([
    tpl('cl.link', 'primary', ['cause', 'effect'], function (s) { return q1(s.cause) + ' AND ' + q1(s.effect); }),
    tpl('cl.break', 'falsifier', ['cause', 'effect'], function (s) {
      return q1(s.cause) + ' AND ' + q1(s.effect) + ' AND (confound OR "no association" OR "not associated")';
    }),
  ]),
});

// constraint-interrogation/v1 (D-18 step 6): derivation, re-test, S-curve, prior attack.
const CONSTRAINT_INTERROGATION = Object.freeze({
  id: 'constraint-interrogation/v1',
  templates: Object.freeze([
    tpl('ci.derivation', 'derivation', ['limiter'], function (s) {
      return q1(s.limiter) + ' AND ("fundamental limit" OR "theoretical limit" OR bound)';
    }),
    tpl('ci.retest', 'retest', ['limiter'], function (s) {
      return q1(s.limiter) + ' AND (overcome OR circumvent OR "new approach")';
    }),
    tpl('ci.scurve', 'scurve', ['limiter'], function (s) {
      return q1(s.limiter) + ' AND (saturation OR plateau OR "diminishing returns")';
    }),
    tpl('ci.prior_attack', 'prior', ['limiter'], function (s) {
      return q1(s.limiter) + ' AND (review OR survey)';
    }),
  ]),
});

// diffusion/v1 (D-19): the diffusion lens's four questions.
const DIFFUSION = Object.freeze({
  id: 'diffusion/v1',
  templates: Object.freeze([
    tpl('df.adoption', 'first_adopters', ['technology'], function (s) {
      return q1(s.technology) + ' AND (adoption OR diffusion)';
    }),
    tpl('df.capacity', 'absorptive_capacity', ['technology'], function (s) {
      return q1(s.technology) + ' AND ("absorptive capacity" OR "technology transfer")';
    }),
    tpl('df.dualuse', 'civil_defense_crossing', ['technology'], function (s) {
      return q1(s.technology) + ' AND ("dual-use" OR "dual use" OR defense)';
    }),
    tpl('df.timing', 'timing', ['technology'], function (s) {
      return q1(s.technology) + ' AND ("S-curve" OR "adoption rate" OR "technology readiness")';
    }),
  ]),
});

const FAMILIES = Object.freeze({
  'whitespace-gap/v1': WHITESPACE_GAP,
  'concept-evidence/v1': CONCEPT_EVIDENCE,
  'causal-link/v1': CAUSAL_LINK,
  'constraint-interrogation/v1': CONSTRAINT_INTERROGATION,
  'diffusion/v1': DIFFUSION,
});

function lens(family, templates, round2) {
  return Object.freeze({
    family: family,
    templates: Object.freeze(templates),
    round2: round2 ? Object.freeze(round2) : null,
  });
}

// LENS_FAMILY: lens id (363-06 question templates) -> family and the
// round-one template ids. Round two defaults to the falsifier templates of
// the set (role starts with "falsifier", or ce.counter / cl.break / ci.retest).
const LENS_FAMILY = Object.freeze({
  'ws.gap': lens('whitespace-gap/v1', ['ws.exact', 'ws.synonym_cover', 'ws.prior_attempts'], ['ws.synonym_cover', 'ws.prior_attempts']),
  'ws.covered_elsewhere': lens('whitespace-gap/v1', ['ws.synonym_cover', 'ws.prior_attempts'], ['ws.prior_attempts']),
  'ws.extraction': lens('whitespace-gap/v1', ['ws.exact', 'ws.absence_reason'], ['ws.absence_reason']),
  'mu.verify': lens('concept-evidence/v1', ['ce.exact', 'ce.counter'], ['ce.counter']),
  'mu.blind_spot': lens('concept-evidence/v1', ['ce.alternative', 'ce.counter'], ['ce.counter']),
  'mu.reveal': lens('concept-evidence/v1', ['ce.exact', 'ce.prior_success'], ['ce.prior_success']),
  'rc.why_link': lens('causal-link/v1', ['cl.link', 'cl.break'], ['cl.break']),
  'rc.6m': lens('causal-link/v1', ['cl.link'], []),
  'hat.white': lens('concept-evidence/v1', ['ce.exact'], []),
  'hat.black': lens('concept-evidence/v1', ['ce.counter'], ['ce.counter']),
  'hat.yellow': lens('concept-evidence/v1', ['ce.prior_success'], []),
  'hat.green': lens('concept-evidence/v1', ['ce.alternative'], []),
  'df.first_adopters': lens('diffusion/v1', ['df.adoption'], []),
  'df.absorptive_capacity': lens('diffusion/v1', ['df.capacity'], []),
  'df.civil_defense_crossing': lens('diffusion/v1', ['df.dualuse'], []),
  'df.timing': lens('diffusion/v1', ['df.timing'], []),
  'ci.derivation': lens('constraint-interrogation/v1', ['ci.derivation'], []),
  'ci.retest': lens('constraint-interrogation/v1', ['ci.retest'], ['ci.retest']),
  'ci.scurve': lens('constraint-interrogation/v1', ['ci.scurve'], []),
  'ci.prior_attack': lens('constraint-interrogation/v1', ['ci.prior_attack'], []),
  // SEED-103: the Eureka perspective. ce.pair needs both terms (the two things);
  // ce.counter is the falsifier round.
  'eu.transfer': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
  'eu.known': lens('concept-evidence/v1', ['ce.exact'], []),
  // Phase 366 (D-06): the four new perspectives, on the five frozen families
  // only (no new family, no free-form query text). rs.* rides causal-link
  // ({cause, effect} slots); hsi.*, an.* and cn.* ride concept-evidence like eu.*.
  'rs.lag': lens('causal-link/v1', ['cl.link', 'cl.break'], ['cl.break']),
  'rs.known': lens('causal-link/v1', ['cl.link'], []),
  'hsi.diverge': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
  'hsi.known': lens('concept-evidence/v1', ['ce.exact'], []),
  'an.structure': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
  'an.known': lens('concept-evidence/v1', ['ce.exact'], []),
  'cn.lateral': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
  // web literature leaf of find-connections (ruling 2026-10-05)
  'cn.literature': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
  'cn.known': lens('concept-evidence/v1', ['ce.exact'], []),
});

function qHash(q) {
  return 'sha256:' + crypto.createHash('sha256').update(String(q), 'utf8').digest('hex');
}

function refusal(reason, family, templateId, extra) {
  const r = { ok: false, degrade: 'local-only', reason: reason, family: family, template_id: templateId === undefined ? null : templateId };
  if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
  return r;
}

// validTerm(v) -> trimmed term or null. Never throws, never echoes.
function validTerm(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length < SLOT_RULES.term_min_chars || t.length > SLOT_RULES.term_max_chars) return null;
  if (BAD_CHAR_RE.test(t)) return null;
  const tokens = t.split(/\s+/);
  for (let i = 0; i < tokens.length; i += 1) {
    if (OPERATOR_TOKENS[tokens[i].toLowerCase()]) return null;
  }
  return t;
}

// proseShaped(t) -> true when the string looks like room prose or markdown, not
// a term (SEED-104): emphasis, backtick, double tilde or table pipe; an
// underscore that wraps a word; a leading heading, blockquote or list marker;
// or a sentence boundary (end punctuation, whitespace, more text).
const PROSE_MARK_RE = /[*`|]|~~/;
const PROSE_UNDERSCORE_RE = /(^|\s)_|_(\s|$)/;
const PROSE_LEAD_RE = /^(#{1,6}\s|>|[-+*\u2022]\s|\d{1,3}[.)]\s)/;
const PROSE_SENTENCE_RE = /[.!?]\s+\S/;
function proseShaped(t) {
  if (typeof t !== 'string') return false;
  const s = t.trim();
  return PROSE_MARK_RE.test(s) || PROSE_UNDERSCORE_RE.test(s) || PROSE_LEAD_RE.test(s) || PROSE_SENTENCE_RE.test(s);
}

// stripMarkdown(s) -> the string without leading heading, blockquote and list
// markers, emphasis, backticks, strike marks and word-wrapping underscores,
// whitespace collapsed. It never makes a sentence composable: composableTerm
// still applies the sentence-boundary rule to the result.
function stripMarkdown(s) {
  let t = String(s === undefined || s === null ? '' : s).trim();
  t = t.replace(/^#{1,6}\s+/, '').replace(/^>\s*/, '').replace(/^([-+*\u2022]|\d{1,3}[.)])\s+/, '');
  t = t.replace(/\*\*|__|~~|\*|`/g, '');
  t = t.replace(/(^|\s)_+/g, '$1').replace(/_+(\s|$)/g, '$1');
  return t.replace(/\s+/g, ' ').trim();
}

// composableTerm(v) -> the trimmed term when it is a valid slot term and not
// prose-shaped, else null. Reuses SLOT_RULES.term_max_chars as the only cap.
function composableTerm(v) {
  const t = validTerm(v);
  if (t === null) return null;
  return proseShaped(t) ? null : t;
}

// composableQuery(v) -> the cleaned phrase when it can be a slot value on a WEB
// search line, else null (SEED-115). A room phrase or question is allowed:
// sentence boundaries, question marks and parentheses pass; markdown markers are
// stripped, whitespace is collapsed, and double quotes and backslashes (which would
// break the quoted template) become spaces. Null only for a non-string, an empty or
// too short value, an over-cap value (SLOT_RULES.query_max_chars) or a control character.
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
function composableQuery(v) {
  if (typeof v !== 'string' || CONTROL_RE.test(v)) return null;
  const t = stripMarkdown(v).replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < SLOT_RULES.term_min_chars || t.length > SLOT_RULES.query_max_chars) return null;
  return t;
}

// hasProseSlot(slots) -> true when any string slot value, or any element of a
// synonyms array, is prose-shaped.
function hasProseSlot(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return false;
  return Object.keys(slots).some(function (k) {
    const v = slots[k];
    if (Array.isArray(v)) return v.some(proseShaped);
    return proseShaped(v);
  });
}

// normalizeSlots(familyId, slots, strict) -> {slots} or null (bad_slot). strict
// (a theo destination) uses validTerm; the default web rule uses composableQuery.
function normalizeSlots(familyId, slots, strict) {
  const clean = strict ? validTerm : composableQuery;
  const spec = FAMILY_SLOTS[familyId];
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return null;
  const keys = Object.keys(slots);
  for (let i = 0; i < keys.length; i += 1) {
    if (spec.order.indexOf(keys[i]) < 0) return null;
  }
  const out = {};
  for (let i = 0; i < spec.order.length; i += 1) {
    const name = spec.order[i];
    const has = Object.prototype.hasOwnProperty.call(slots, name) && slots[name] !== undefined;
    if (!has) {
      if (spec.required.indexOf(name) >= 0) return null;
      continue;
    }
    if (name === 'synonyms') {
      const arr = slots[name];
      if (!Array.isArray(arr) || arr.length < SLOT_RULES.synonyms_min || arr.length > SLOT_RULES.synonyms_max) return null;
      const seen = {};
      const list = [];
      for (let j = 0; j < arr.length; j += 1) {
        const t = clean(arr[j]);
        if (t === null) return null;
        const key = t.toLowerCase();
        if (seen[key]) return null;
        seen[key] = true;
        list.push(t);
      }
      out[name] = list;
    } else {
      const t = clean(slots[name]);
      if (t === null) return null;
      out[name] = t;
    }
  }
  return { slots: out, order: spec.order };
}

// slotValues(order, slots) -> flat list of slot values in audit order.
function slotValues(order, slots) {
  const vals = [];
  order.forEach(function (name) {
    if (slots[name] === undefined) return;
    if (Array.isArray(slots[name])) slots[name].forEach(function (v) { vals.push(v); });
    else vals.push(slots[name]);
  });
  return vals;
}

function templateSlotTerms(t, slots) {
  const terms = [];
  t.needs.forEach(function (name) {
    const v = slots[name];
    if (Array.isArray(v)) v.forEach(function (x) { terms.push(x); });
    else if (typeof v === 'string') terms.push(v);
  });
  return terms;
}

// composeFamily(familyId, slots, opts) -- opts: { templateIds, auditFn, round, destination }.
// destination 'theo' applies the strict Part 8 term rule and the CONTENT-SET audit (auditFn);
// anything else is a web line with no audit: its queries are stamped 'not_applicable' (ruling
// 2026-10-05, 369.2-05). The grant card shows the string; the audit ledger records it.
// Returns { ok:true, family, queries } or a no-echo refusal:
//   reason in unknown_family | unknown_template | term_not_composed | bad_slot | egress_violation
function composeFamily(familyId, slots, opts) {
  const options = opts || {};
  const auditFn = typeof options.auditFn === 'function' ? options.auditFn : auditQueryString;
  const round = Number.isInteger(options.round) && options.round > 0 ? options.round : 1;

  if (typeof familyId !== 'string' || !Object.prototype.hasOwnProperty.call(FAMILIES, familyId)) {
    return refusal('unknown_family', null, null);
  }
  const family = FAMILIES[familyId];
  const strict = options.destination === 'theo';

  const norm = normalizeSlots(familyId, slots, strict);
  let selected;
  if (Array.isArray(options.templateIds)) {
    selected = [];
    for (let i = 0; i < options.templateIds.length; i += 1) {
      const found = family.templates.filter(function (t) { return t.id === options.templateIds[i]; })[0];
      if (!found) return refusal('unknown_template', familyId, null);
      selected.push(found);
    }
  } else {
    selected = null;
  }
  if (strict && hasProseSlot(slots)) return refusal('term_not_composed', familyId, null);
  if (norm === null) return refusal('bad_slot', familyId, null);

  if (selected === null) {
    selected = family.templates.filter(function (t) {
      return t.needs.every(function (n) { return norm.slots[n] !== undefined; });
    });
  } else {
    for (let i = 0; i < selected.length; i += 1) {
      const missing = selected[i].needs.some(function (n) { return norm.slots[n] === undefined; });
      if (missing) return refusal('bad_slot', familyId, selected[i].id);
    }
  }

  // Theo destination only: audit every supplied slot value first, in canonical order.
  const vals = strict ? slotValues(norm.order, norm.slots) : [];
  for (let i = 0; i < vals.length; i += 1) {
    try {
      auditFn(vals[i], SURFACE);
    } catch (_err) {
      return refusal('egress_violation', familyId, null);
    }
  }

  const queries = [];
  for (let i = 0; i < selected.length; i += 1) {
    const t = selected[i];
    const q = t.render(norm.slots);
    if (q.length > MAX_QUERY_CHARS || /[\r\n]/.test(q)) return refusal('bad_slot', familyId, t.id);
    if (strict) {
      try {
        auditFn(q, SURFACE);
      } catch (_err) {
        return refusal('egress_violation', familyId, t.id);
      }
    }
    queries.push({
      template_id: t.id,
      family: familyId,
      role: t.role,
      q: q,
      q_hash: qHash(q),
      audit: strict ? 'pass' : 'not_applicable',
      round: round,
      slot_terms: templateSlotTerms(t, norm.slots),
    });
  }
  return { ok: true, family: familyId, queries: queries };
}

// composeForLeaf(leaf, opts) -- leaf = { lens, slots, corpus? }; opts = { round, auditFn }.
// A leaf whose corpus is 'theo' composes under the strict Part 8 term rule; every
// other leaf is a web-line leaf (SEED-115).
// Chooses the family and template ids from LENS_FAMILY. Round 1 composes the
// lens's templates whose slots are present; round 2 composes its falsifier
// follow-ups (possibly none). An unknown lens is refused, no echo.
function composeForLeaf(leaf, opts) {
  const options = opts || {};
  const round = Number.isInteger(options.round) && options.round > 0 ? options.round : 1;
  const lensId = leaf && typeof leaf.lens === 'string' ? leaf.lens : '';
  if (!Object.prototype.hasOwnProperty.call(LENS_FAMILY, lensId)) {
    return refusal('unknown_lens', null, null);
  }
  const map = LENS_FAMILY[lensId];
  const ids = round === 1 ? map.templates : (map.round2 || []);
  if (ids.length === 0) return { ok: true, family: map.family, lens: lensId, queries: [] };

  const strict = leaf.corpus === 'theo';
  if (strict && hasProseSlot(leaf.slots)) return refusal('term_not_composed', map.family, null);
  const norm = normalizeSlots(map.family, leaf.slots, strict);
  if (norm === null) return refusal('bad_slot', map.family, null);
  const family = FAMILIES[map.family];
  const usable = ids.filter(function (id) {
    const t = family.templates.filter(function (x) { return x.id === id; })[0];
    return t.needs.every(function (n) { return norm.slots[n] !== undefined; });
  });
  if (usable.length === 0) return { ok: true, family: map.family, lens: lensId, queries: [] };

  const r = composeFamily(map.family, leaf.slots, { templateIds: usable, auditFn: options.auditFn, round: round, destination: strict ? 'theo' : 'web' });
  if (r.ok) r.lens = lensId;
  return r;
}

// slotTerms(queries) -- distinct slot values across a query list (D-10: the
// grant asks the first time a new term would leave).
function slotTerms(queries) {
  const seen = {};
  const out = [];
  (Array.isArray(queries) ? queries : []).forEach(function (x) {
    (x && Array.isArray(x.slot_terms) ? x.slot_terms : []).forEach(function (t) {
      if (!seen[t]) { seen[t] = true; out.push(t); }
    });
  });
  return out;
}

// isRawQueryEdit(edit) -- true when an edit tries to supply a query string
// instead of a question or slot (D-04: raw strings are refused).
function isRawQueryEdit(edit) {
  if (!edit || typeof edit !== 'object' || Array.isArray(edit)) return false;
  return ['q', 'query', 'query_string', 'raw_query'].some(function (k) {
    return Object.prototype.hasOwnProperty.call(edit, k);
  });
}

module.exports = {
  FAMILIES,
  SLOT_RULES,
  LENS_FAMILY,
  composeFamily,
  composeForLeaf,
  proseShaped,
  stripMarkdown,
  composableTerm,
  composableQuery,
  qHash,
  slotTerms,
  isRawQueryEdit,
};
