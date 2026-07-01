'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-07 -- Shape F.9 Cascade / Reconcile Gate renderer (SFS-04).
 * ============================================================================
 * F.9 is the ORDERED sibling of F.8. Where F.8 renders an unordered toggle
 * basket (a SET the navigator flips on/off and confirms once), F.9 renders an
 * ORDERED sequence of cascade items and asks a per-item Decision over each:
 * APPROVE / REJECT / DEFER. Array order IS meaning -- item 0 is decided first,
 * item 1 second, and so on (the compose-a-chain / GIX cascade case).
 *
 * NO live widget (the TTY wall, Phase 154; reach-component-map.json:16 pins the
 * `ordered` archetype as "NOT a live ordered widget"). F.9 emits ONE question
 * per cascade item, in array order, through the paged multi-question card. The
 * renderer NEVER constructs a live/scrolling reorder surface: it returns the
 * {zones, contract} envelope ONLY. Every live question card is constructed at
 * the SEED-020 single door (pickShape); this renderer emits an envelope, never
 * a bespoke widget.
 *
 * Closed-vocab discipline (cloned from shape-f3-renderer.cjs): cascade bodies are
 * CONTENT-SET, so mode:'closed', recommended:null, freeTextOffered:false. NO
 * marker on a cascade body.
 *
 * Ordered-outcome vocab is the closed {APPROVE, REJECT, DEFER} set. It is NOT a
 * parallel enum -- it maps onto the reused four-outcome OUTCOMES enum
 * (accept==APPROVE) through mapOutcome (the dispatcher aliasToCanonical
 * precedent), so nothing downstream needs a normalize layer. APPROVE writes the
 * edge, REJECT records NOT-applied + reason, DEFER leaves a CONTRADICTS pair --
 * the consumer (f9-ordered-consumer.cjs) owns those writes.
 *
 * Paging obligation inherited from F.8 (D-05): a cascade longer than the paged
 * card ceiling PAGES, it NEVER truncates. contract.questions carries the FULL
 * ordered set + a page count; the body shows the first page only.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 * No emoji.
 *
 * API:
 *   renderShapeF9({ items, header?, personaContext? }) -> { zones, contract }
 *     items: array of { claim } | { label } | <string>. Array order IS meaning.
 */

// The closed ordered-outcome vocabulary. These are the literal persisted tokens
// (canon precedent: an alias_map, never a parallel enum). mapOutcome() folds each
// onto the reused four-outcome OUTCOMES enum so no normalize layer is needed.
const ORDERED_OUTCOMES = ['APPROVE', 'REJECT', 'DEFER'];

// The reused four-outcome enum (accept==APPROVE). Mirrored locally to keep the
// renderer decoupled (no require cycle); the consumer is the gate of record. This
// is the SAME enum the F.8 machinery reuses -- NOT a parallel one.
const OUTCOMES = ['accept', 'defer', 'reject', 'Free-Text'];

// alias_map: the closed ordered-outcome token -> the reused OUTCOMES member.
// APPROVE folds to accept (accept==APPROVE); no parallel enum, no normalize layer.
const ORDERED_TO_OUTCOME = Object.freeze({
  APPROVE: 'accept',
  REJECT: 'reject',
  DEFER: 'defer',
});

// The paged-card ceiling (the ~4-5 option wall of the paged question card). A
// cascade longer than this PAGES rather than truncates (D-05, inherited from F.8).
// DISTINCT from the frozen MAX_K=3 (Part 3): this bounds the per-page question
// count only, and is byte-untouched here. MUST NOT equal 3.
const PAGE_CEILING = 4;

// mapOutcome(orderedToken) -> reused OUTCOMES member (or null). The aliasToCanonical
// precedent: APPROVE -> accept, REJECT -> reject, DEFER -> defer. Nothing downstream
// mints a parallel enum.
function mapOutcome(orderedToken) {
  if (typeof orderedToken !== 'string') return null;
  const upper = orderedToken.toUpperCase();
  return Object.prototype.hasOwnProperty.call(ORDERED_TO_OUTCOME, upper)
    ? ORDERED_TO_OUTCOME[upper]
    : null;
}

function defaultHeader() {
  return '-- mindrianOS -- cascade -- reconcile --';
}

// Normalize a raw cascade item (string OR { claim } OR { label }) into a canonical
// { label, item_id } shape. Position is preserved by the caller's array order.
function _normalizeItem(raw, index) {
  let label = null;
  let itemId = null;
  if (typeof raw === 'string') {
    label = raw.length > 0 ? raw : null;
  } else if (raw && typeof raw === 'object') {
    if (typeof raw.claim === 'string' && raw.claim.length > 0) {
      label = raw.claim;
    } else if (typeof raw.label === 'string' && raw.label.length > 0) {
      label = raw.label;
    }
    if (typeof raw.item_id === 'string' && raw.item_id.length > 0) {
      itemId = raw.item_id;
    } else if (typeof raw.id === 'string' && raw.id.length > 0) {
      itemId = raw.id;
    }
  }
  if (label === null) return null;
  if (itemId === null) itemId = 'item:' + String(index);
  return { label: label, item_id: itemId };
}

function renderShapeF9(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const header = (typeof opts.header === 'string' && opts.header.length > 0)
    ? opts.header : null;
  const personaContext = (typeof opts.personaContext === 'string' && opts.personaContext.length > 0)
    ? opts.personaContext : null;

  // Normalize the incoming cascade, PRESERVING array order (order IS meaning).
  const rawItems = Array.isArray(opts.items) ? opts.items : [];
  const normalized = [];
  for (let i = 0; i < rawItems.length; i++) {
    const n = _normalizeItem(rawItems[i], i);
    if (n) normalized.push(n);
  }

  // One question per cascade item, in ARRAY ORDER. Each carries the closed
  // ordered-outcome option set. No marker (CONTENT-SET); no Free-Text.
  const questions = normalized.map((it, i) => {
    return {
      position: i + 1,
      item_id: it.item_id,
      claim: it.label,
      options: ORDERED_OUTCOMES.slice(),
    };
  });

  // D-05 paging: a cascade longer than the page ceiling PAGES, never truncates.
  // The FULL ordered question set stays on the contract; the body shows page 1.
  const total = questions.length;
  const pages = total > 0 ? Math.ceil(total / PAGE_CEILING) : 1;
  const paged = pages > 1;
  const pageQuestions = questions.slice(0, PAGE_CEILING);

  // Body: one ordered row per page-1 question, position first (order is meaning),
  // with the closed ordered-outcome set shown inline. NO marker glyph.
  const lines = pageQuestions.map((q) => {
    return String(q.position) + '. ' + q.claim + '  [' + q.options.join(' / ') + ']';
  });

  let composedHeader = header || defaultHeader();
  if (personaContext) {
    composedHeader = composedHeader + ' (' + personaContext + ' lens)';
  }

  return {
    zones: {
      header: composedHeader,
      body: lines.join('\n'),
      signals: paged ? ('page 1 of ' + pages) : '',
      footer: null,
    },
    contract: {
      shape: 'F.9',
      keyboard: 'askuserquestion',
      // Ordered per-item gate: one question per cascade item, array order = meaning.
      ordered: true,
      // Closed CONTENT-SET body: no marker, no Free-Text (mirrors F.3/F.4).
      mode: 'closed',
      recommended: null,
      freeTextOffered: false,
      // The FULL ordered question set (one per item), so a host can page through it.
      questions: questions,
      // The closed ordered-outcome vocab (canon literal tokens; alias_map to OUTCOMES).
      verbs: ORDERED_OUTCOMES.slice(),
      outcomes: ORDERED_OUTCOMES.slice(),
      // D-05 paging obligation surfaced (overflow PAGES, never truncates).
      paged: paged,
      pages: pages,
      pageCeiling: PAGE_CEILING,
      personaContext: personaContext,
    },
  };
}

module.exports = {
  renderShapeF9: renderShapeF9,
  mapOutcome: mapOutcome,
  ORDERED_OUTCOMES: ORDERED_OUTCOMES.slice(),
  OUTCOMES: OUTCOMES.slice(),
  PAGE_CEILING: PAGE_CEILING,
};
