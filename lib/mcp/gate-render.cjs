'use strict';
// Phase 198-05 (SPEC-4, Task 1) -- the Mindrian gate superset schema + the
// three-rung renderer ladder.
//
// 307 files today assume the Claude Code AskUserQuestion card; no schema
// exists independent of the host. This module defines ONE Mindrian superset
// card (options + per-option descriptions + ranks + previews + single/multi-
// select) and a 3-rung renderer ladder:
//   (a) renderViaElicitation -- MCP elicitation, where the client declares the
//       capability. LOSSY on the wire: the requestedSchema carries enum
//       (option ids) + enumNames (titles) only -- per-option descriptions/
//       ranks/previews never leave the server on this rung (RESEARCH Pitfall
//       4; SDK 1.29.0 ElicitRequestFormParamsSchema has no per-option
//       description field).
//   (b) renderViaAskUserQuestion -- composes the FULL card (through the
//       shipped shape-f8-renderer.cjs toggle envelope + the selector-
//       dispatcher's AskUserQuestion trailer, Canon Part 7 reuse) for the
//       Claude Code thin adapter, enriched with the complete superset
//       metadata (descriptions/ranks/previews) so the adapter can construct
//       the real native AskUserQuestion call with full fidelity.
//   (c) renderViaText -- a structured-text card + next-message fallback for
//       headless clients that declare neither capability.
//
// The three rungs carry different wire fidelity, but they all normalize the
// user's choice into ONE canonical gate_answer payload shape
// `{ gate_id, chosen: [optionId...], verdict }` via normalizeGateAnswer --
// SPEC-4's acceptance bar is that identity, not merely "each renderer works".
//
// D-04 (F.8 binding-card discipline): a gate of kind 'binding' fires ONCE per
// session and ONLY on genuine ambiguity; a resolved/unambiguous context (or a
// session that already saw its one binding card) returns no card at all.
//
// Canon Part 7: reuses lib/hmi/shape-f8-renderer.cjs (binding) +
// lib/hmi/shape-f9-renderer.cjs (reconcile) + lib/hmi/selector-dispatcher.cjs
// -- this module mints NO new card renderer.
// Canon Part 8: zero Brain/network tokens; pure composition + normalization.
// CJS only. No em-dashes.

const crypto = require('node:crypto');

const { renderShapeF8 } = require('../hmi/shape-f8-renderer.cjs');
const { renderShapeF9 } = require('../hmi/shape-f9-renderer.cjs');
const selectorDispatcher = require('../hmi/selector-dispatcher.cjs');

const DEFAULT_VERDICT = 'approve';

// -----------------------------------------------------------------------
// SUPERSET_SCHEMA -- Mindrian's OWN card superset (descriptive, not a zod
// validator: the MCP tool layer, lib/mcp/tools/gate.cjs, owns the zod input
// schema for the gate_render tool call itself). Every renderer normalizes
// its raw card input against this shape before rendering.
// -----------------------------------------------------------------------
const SUPERSET_SCHEMA = Object.freeze({
  schema: 'mindrian.gate.superset.v1',
  fields: Object.freeze({
    gate_id: 'string (minted if absent)',
    header: 'string | null',
    kind: "string (e.g. 'binding' for the F.8 once-per-session card, 'general' default)",
    ambiguous: 'boolean (only relevant to kind: binding)',
    selectMode: "'single' | 'multi'",
    options: Object.freeze({
      id: 'string (derived from label if absent)',
      label: 'string',
      description: 'string | null',
      rank: 'number | null',
      preview: 'string | null',
    }),
  }),
});

// -----------------------------------------------------------------------
// pickRenderer -- the ladder detection. elicitation-declared > insideClaude
// Code > headless-text.
// -----------------------------------------------------------------------
function pickRenderer(capabilities) {
  const caps = (capabilities && typeof capabilities === 'object') ? capabilities : {};
  if (caps.elicitation === true) return 'elicitation';
  if (caps.claudeCode === true) return 'askuserquestion';
  return 'text';
}

// -----------------------------------------------------------------------
// Card normalization
// -----------------------------------------------------------------------
function _slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'opt';
}

function _normalizeOption(raw, index) {
  if (raw === null || raw === undefined) return null;
  const obj = (typeof raw === 'string') ? { label: raw } : ((raw && typeof raw === 'object') ? raw : null);
  if (!obj || typeof obj.label !== 'string' || obj.label.length === 0) return null;
  const id = (typeof obj.id === 'string' && obj.id.length > 0) ? obj.id : (_slug(obj.label) + '-' + index);
  return {
    id: id,
    label: obj.label,
    description: (typeof obj.description === 'string' && obj.description.length > 0) ? obj.description : null,
    rank: (typeof obj.rank === 'number' && Number.isFinite(obj.rank)) ? obj.rank : null,
    preview: (typeof obj.preview === 'string' && obj.preview.length > 0) ? obj.preview : null,
  };
}

/**
 * normalizeCard(raw) -> canonical superset card (SUPERSET_SCHEMA shape).
 * Never throws. Missing gate_id is minted; duplicate option ids are dropped
 * (first wins, mirrors shape-f8-renderer's own de-dup discipline).
 */
function normalizeCard(raw) {
  const opts = (raw && typeof raw === 'object') ? raw : {};
  const gateId = (typeof opts.gate_id === 'string' && opts.gate_id.length > 0)
    ? opts.gate_id
    : ('gate-' + crypto.randomBytes(8).toString('hex'));
  const rawOptions = Array.isArray(opts.options) ? opts.options : [];
  const options = [];
  const seenIds = new Set();
  for (let i = 0; i < rawOptions.length; i += 1) {
    const n = _normalizeOption(rawOptions[i], i);
    if (!n) continue;
    if (seenIds.has(n.id)) continue;
    seenIds.add(n.id);
    options.push(n);
  }
  return {
    gate_id: gateId,
    header: (typeof opts.header === 'string' && opts.header.length > 0) ? opts.header : null,
    kind: (typeof opts.kind === 'string' && opts.kind.length > 0) ? opts.kind : 'general',
    ambiguous: opts.ambiguous === true,
    selectMode: opts.selectMode === 'multi' ? 'multi' : 'single',
    options: options,
  };
}

/**
 * normalizeGateAnswer(gateId, chosenIds, verdict) -> the ONE canonical
 * gate_answer payload shape every rung normalizes to. This is the SPEC-4
 * acceptance bar: whatever wire format captured the user's choice, the same
 * chosen option id + verdict always produces byte-identical output here.
 */
function normalizeGateAnswer(gateId, chosenIds, verdict) {
  return {
    gate_id: gateId,
    chosen: Array.isArray(chosenIds) ? chosenIds.slice() : [],
    verdict: (typeof verdict === 'string' && verdict.length > 0) ? verdict : DEFAULT_VERDICT,
  };
}

// -----------------------------------------------------------------------
// D-04: F.8 binding-card once-per-session-on-ambiguity discipline. A
// resolved/unambiguous context NEVER fires; an ambiguous context fires
// exactly once per session (subsequent calls for the SAME session return no
// card). In-process, single-use-per-session ledger -- mirrors the T-198-10
// live-gate ledger in lib/mcp/tools/gate.cjs (same "mint once, consume once"
// shape, different concern).
// -----------------------------------------------------------------------
const _firedBindingSessions = new Set();

function shouldFireBindingCard(sessionId, ambiguous) {
  if (ambiguous !== true) return false; // unambiguous: never fires
  const key = (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : '__no_session__';
  if (_firedBindingSessions.has(key)) return false; // already fired once this session
  _firedBindingSessions.add(key);
  return true;
}

function _resetBindingFiredForTest() {
  _firedBindingSessions.clear();
}

// -----------------------------------------------------------------------
// Rung (a): MCP elicitation. LOSSY -- enum (ids) + enumNames (titles) only.
// -----------------------------------------------------------------------
function buildElicitRequestedSchema(card) {
  if (card.selectMode === 'multi') {
    return {
      type: 'object',
      properties: {
        choices: {
          type: 'array',
          title: card.header || 'Choose options',
          items: {
            type: 'string',
            enum: card.options.map((o) => o.id),
          },
        },
      },
      required: ['choices'],
    };
  }
  return {
    type: 'object',
    properties: {
      choice: {
        type: 'string',
        title: card.header || 'Choose an option',
        enum: card.options.map((o) => o.id),
        enumNames: card.options.map((o) => o.label),
      },
    },
    required: ['choice'],
  };
}

function extractElicitChoice(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.action !== 'accept') return null;
  const content = result.content;
  if (!content || typeof content !== 'object') return null;
  if (Array.isArray(content.choices)) {
    const out = content.choices.filter((c) => typeof c === 'string');
    return out.length > 0 ? out : null;
  }
  if (typeof content.choice === 'string' && content.choice.length > 0) return [content.choice];
  return null;
}

async function renderViaElicitation(card, ctx) {
  const requestedSchema = buildElicitRequestedSchema(card);
  const message = card.header || ('mindrianOS gate: ' + card.gate_id);
  const rendered = { requestedSchema: requestedSchema, message: message };

  const elicitFn = (ctx && typeof ctx.elicitInput === 'function') ? ctx.elicitInput : null;
  let answer = null;
  if (elicitFn) {
    const result = await elicitFn({ message: message, requestedSchema: requestedSchema });
    const chosenIds = extractElicitChoice(result);
    if (chosenIds && chosenIds.length > 0) {
      const verdict = (ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT;
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'elicitation', rendered: rendered, answer: answer };
}

// -----------------------------------------------------------------------
// Rung (b): canUseTool/AskUserQuestion thin adapter inside Claude Code.
// Composes from the SHIPPED shape-f8-renderer.cjs toggle envelope (Canon
// Part 7 reuse -- this module never reinvents a card renderer), enriched with
// the FULL superset metadata (id/description/rank/preview) so the thin
// adapter can construct the real native AskUserQuestion call at full
// fidelity. The AskUserQuestion trailer imperative is appended through the
// shipped selector-dispatcher SEED-020 single door.
// -----------------------------------------------------------------------
/**
 * validateChosenAgainstCard(card, chosen) -> the server-side allow-list
 * check every gate ratification path needs (ASVS V5 Input Validation).
 * Phase 238 (GATE-01 G-2): until this phase, gate_answer's and chain_run's
 * ratification paths had no value-domain check at all -- the zod schema on
 * gate_answer's tool input validated only the SHAPE of `chosen`
 * (z.array(z.string().min(1)).min(1)), never that a submitted value was
 * actually among the minted card's own options. This is that check,
 * lifted from the AskUserQuestion rung's own resolver (below) so 238-03
 * (gate.cjs) and 238-04 (chain.cjs) can both call the SAME implementation
 * rather than growing a second copy.
 *
 * Returns an array of resolved option ids when at least one submitted
 * value matches an option id or an option label; returns null when
 * nothing survives (null means REJECT). Guards defensively: a null or
 * malformed card, a card with no options array, or a non-array chosen all
 * return null rather than throwing, because both new call sites run
 * inside MCP tool handlers where a throw becomes an opaque tool error.
 */
function validateChosenAgainstCard(card, chosen) {
  if (!Array.isArray(chosen)) return null;
  const options = (card && Array.isArray(card.options)) ? card.options : null;
  if (!options) return null;
  const byId = new Set(options.map((o) => o.id));
  const byLabel = new Map(options.map((o) => [o.label, o.id]));
  const out = [];
  for (const c of chosen) {
    if (typeof c !== 'string') continue;
    if (byId.has(c)) { out.push(c); continue; }
    if (byLabel.has(c)) { out.push(byLabel.get(c)); continue; }
  }
  return out.length > 0 ? out : null;
}

/**
 * _resolveChosenIds -- thin caller kept for the AskUserQuestion rung's own
 * existing contract (its guard on `picked` is not part of
 * validateChosenAgainstCard's own signature). Behavior is byte-stable:
 * this is the rung's only current caller and its tests must not move.
 */
function _resolveChosenIds(picked, card) {
  if (!picked || !Array.isArray(picked.chosen)) return null;
  return validateChosenAgainstCard(card, picked.chosen);
}

async function renderViaAskUserQuestion(card, ctx) {
  const base = renderShapeF8({
    options: card.options.map((o) => ({ label: o.label, confidence: null })),
    header: card.header || undefined,
  });
  // Reuse stops at the envelope shape; the superset's extra fidelity
  // (descriptions/ranks/previews, and the true single/multi mode -- F.8's own
  // renderer always sets multiSelect:true) is folded on top, not reinvented.
  base.contract.multiSelect = card.selectMode === 'multi';
  base.contract.superset_options = card.options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    rank: o.rank,
    preview: o.preview,
  }));
  selectorDispatcher.appendAskUserQuestionTrailer(base, base.contract.shape || 'F.8');

  let answer = null;
  const responder = (ctx && typeof ctx.simulateAskUserQuestion === 'function') ? ctx.simulateAskUserQuestion : null;
  if (responder) {
    const picked = await responder(base);
    const chosenIds = _resolveChosenIds(picked, card);
    if (chosenIds) {
      const verdict = (picked && typeof picked.verdict === 'string')
        ? picked.verdict
        : ((ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT);
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'askuserquestion', rendered: base, answer: answer };
}

// -----------------------------------------------------------------------
// Rung (c): structured-text fallback for headless clients.
// -----------------------------------------------------------------------
function parseTextReply(text, card) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const tokens = text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const out = [];
  for (const t of tokens) {
    const idx = parseInt(t, 10);
    if (Number.isInteger(idx) && String(idx) === t && idx >= 1 && idx <= card.options.length) {
      out.push(card.options[idx - 1].id);
      continue;
    }
    const byId = card.options.find((o) => o.id === t);
    if (byId) { out.push(byId.id); continue; }
  }
  return out.length > 0 ? out : null;
}

async function renderViaText(card, ctx) {
  const lines = card.options.map((o, i) => {
    let line = (i + 1) + '. ' + o.label + ' [' + o.id + ']';
    if (o.description) line += ' - ' + o.description;
    return line;
  });
  const rendered = {
    zones: {
      header: card.header || '-- mindrianOS -- gate --',
      body: lines.join('\n'),
      signals: '',
      footer: 'Reply with the option number or id' + (card.selectMode === 'multi' ? 's (comma-separated)' : '') + ' to answer.',
    },
    contract: {
      shape: 'text',
      keyboard: 'next-message',
      multiSelect: card.selectMode === 'multi',
      recommended: null,
      freeTextOffered: false,
      options: card.options.map((o) => o.id),
    },
  };

  let answer = null;
  const responder = (ctx && typeof ctx.simulateTextReply === 'function') ? ctx.simulateTextReply : null;
  if (responder) {
    const replyText = await responder(rendered);
    const chosenIds = parseTextReply(replyText, card);
    if (chosenIds) {
      const verdict = (ctx && typeof ctx.verdictFor === 'function') ? ctx.verdictFor(chosenIds) : DEFAULT_VERDICT;
      answer = normalizeGateAnswer(card.gate_id, chosenIds, verdict);
    }
  }
  return { renderer: 'text', rendered: rendered, answer: answer };
}

// -----------------------------------------------------------------------
// renderGate -- the single entry point. Dispatches by pickRenderer(ctx.
// capabilities); every rung normalizes its answer to the SAME gate_answer
// shape (SPEC-4 acceptance). Applies the D-04 F.8 binding-card discipline
// BEFORE dispatch: a suppressed binding card never reaches a renderer.
// -----------------------------------------------------------------------
async function renderGate(card, ctx) {
  const normalized = normalizeCard(card);
  const context = (ctx && typeof ctx === 'object') ? ctx : {};

  if (normalized.kind === 'binding' && !shouldFireBindingCard(context.sessionId, normalized.ambiguous)) {
    return { renderer: 'none', card: normalized, rendered: null, answer: null, suppressed: true };
  }

  const renderer = pickRenderer(context.capabilities);
  let result;
  if (renderer === 'elicitation') {
    result = await renderViaElicitation(normalized, context);
  } else if (renderer === 'askuserquestion') {
    result = await renderViaAskUserQuestion(normalized, context);
  } else {
    result = await renderViaText(normalized, context);
  }
  return Object.assign({ card: normalized, suppressed: false }, result);
}

module.exports = {
  SUPERSET_SCHEMA: SUPERSET_SCHEMA,
  pickRenderer: pickRenderer,
  renderGate: renderGate,
  normalizeCard: normalizeCard,
  // normalizeGateAnswer is the shared normalization every rung (and the
  // gate_answer MCP tool, lib/mcp/tools/gate.cjs) funnels through -- the
  // { gate_id, chosen, verdict } shape gate_answer ratifies.
  normalizeGateAnswer: normalizeGateAnswer,
  // validateChosenAgainstCard is the public contract 238-03 (gate.cjs) and
  // 238-04 (chain.cjs) call to reject an out-of-card gate_answer before
  // ratification (GATE-01 G-2).
  validateChosenAgainstCard: validateChosenAgainstCard,
  shouldFireBindingCard: shouldFireBindingCard,
  _resetBindingFiredForTest: _resetBindingFiredForTest,
  _internal: {
    renderViaElicitation: renderViaElicitation,
    renderViaAskUserQuestion: renderViaAskUserQuestion,
    renderViaText: renderViaText,
    buildElicitRequestedSchema: buildElicitRequestedSchema,
    extractElicitChoice: extractElicitChoice,
    parseTextReply: parseTextReply,
  },
};
