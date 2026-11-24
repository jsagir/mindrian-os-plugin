'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 08 (CY-03, O-13, F-02): the two-stage cause and effect domain card.
 *
 * The room's Cynefin domain comes only from the navigator's answer on this card, never from room text.
 * The card is a kind (cause_effect_domain) of the existing gate_render and gate_answer tools, the same
 * precedent as the strategy card (lib/core/strategy/goal-gate.cjs): a kind, a builder module, a ratify
 * soft step. The question, the labels and the id to domain map come from the card block of
 * data/cynefin-domains.json (wording accepted as written, O-13). Stage 1 has 4 options and stage 2 has 2,
 * so each stage fits the AskUserQuestion cap on the card rung.
 *
 *   CARD_KIND                 'cause_effect_domain'
 *   isCauseEffectCard(card)   true only for that kind
 *   normalizeOptions(opts)    the server-side option set: exactly the stage-1 or the stage-2 ids, else refused
 *   answerFor(chosen)         {domain, next_stage} for one chosen id
 *   ratifyCauseEffect(db, a)  the approve-only write through navigation.writeCauseEffect (caller-owned transaction)
 *   howToSentences(domain)    the fixed suggest_next sentences; no room content, no numbers
 *
 * Pure except ratifyCauseEffect, which writes through the db handle it is given. Canon Part 8: zero network.
 * Hyphens only in this file.
 */

const fs = require('node:fs');
const path = require('node:path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'cynefin-domains.json');
const DATA = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const CARD = DATA.card;

const CARD_KIND = CARD.kind;
const STAGES = Object.freeze(CARD.stages.map((s) => Object.freeze({
  stage: s.stage,
  header: s.header,
  options: Object.freeze(s.options.map((o) => Object.freeze({
    id: o.id,
    label: o.label,
    domain: o.domain === undefined ? null : o.domain,
    next_stage: o.next_stage === undefined ? null : o.next_stage,
  }))),
})));
const STAGE_IDS = Object.freeze(STAGES.map((s) => Object.freeze(s.options.map((o) => o.id))));
const BY_ID = new Map();
STAGES.forEach((s) => s.options.forEach((o) => BY_ID.set(o.id, o)));

function validSets() {
  const out = {};
  STAGES.forEach((s, i) => { out[s.stage] = STAGE_IDS[i].slice(); });
  return out;
}

function isCauseEffectCard(card) {
  return !!(card && typeof card === 'object' && card.kind === CARD_KIND);
}

/**
 * normalizeOptions(options) -> the server-side option set. The caller's ids must be exactly the stage-1 set or
 * the stage-2 set, in any order, with no duplicate. The caller's labels, descriptions and header are ignored and
 * replaced from the data file.
 * @returns {{ok:true, stage:number, header:string, options:{id:string,label:string}[], approving:string[]}
 *          | {ok:false, reason:'bad_cause_effect_options', valid:object}}
 */
function normalizeOptions(options) {
  const refused = { ok: false, reason: 'bad_cause_effect_options', valid: validSets() };
  if (!Array.isArray(options) || options.length === 0) return refused;
  const ids = options.map((o) => (typeof o === 'string' ? o : (o && typeof o.id === 'string' ? o.id : null)));
  if (ids.some((id) => id === null)) return refused;
  if (new Set(ids).size !== ids.length) return refused;
  for (let i = 0; i < STAGES.length; i += 1) {
    const want = STAGE_IDS[i];
    if (ids.length === want.length && ids.every((id) => want.indexOf(id) !== -1)) {
      const s = STAGES[i];
      return {
        ok: true,
        stage: s.stage,
        header: s.header,
        options: s.options.map((o) => ({ id: o.id, label: o.label })),
        approving: want.slice(),
      };
    }
  }
  return refused;
}

/**
 * answerFor(chosen) -> {domain, next_stage}. Exactly one known id gives its domain, or next_stage 2 for the
 * stage-1 "nobody" answer. Any other input gives {domain: null, next_stage: null}.
 */
function answerFor(chosen) {
  const none = { domain: null, next_stage: null };
  if (!Array.isArray(chosen) || chosen.length !== 1) return none;
  const o = BY_ID.get(chosen[0]);
  if (!o) return none;
  return { domain: o.domain, next_stage: o.domain === null ? o.next_stage : null };
}

/**
 * ratifyCauseEffect(db, {card, chosen, verdict, gateId, decisionNodeId, answeredVia}). Called by gate_answer inside its
 * transaction (soft step gate_ratify_cause_effect). Reject and defer write nothing. An approve of the stage-1
 * "nobody" answer writes nothing and names the stage-2 card. Any other approve writes the domain.
 */
function ratifyCauseEffect(db, args) {
  const a = args && typeof args === 'object' ? args : {};
  if (a.verdict !== 'approve') return { ok: true, written: false };
  const chosen = Array.isArray(a.chosen) ? a.chosen : [];
  if (a.card && Array.isArray(a.card.options)) {
    const onCard = new Set(a.card.options.map((o) => o && o.id));
    if (!chosen.every((id) => onCard.has(id))) return { ok: false, reason: 'chosen_not_in_cause_effect_options' };
  }
  const mapped = answerFor(chosen);
  if (mapped.domain === null && mapped.next_stage !== null) {
    const next = STAGES.find((s) => s.stage === mapped.next_stage);
    return { ok: true, written: false, follow_up: { stage: next.stage, option_ids: next.options.map((o) => o.id) } };
  }
  if (mapped.domain === null) return { ok: false, reason: 'chosen_not_in_cause_effect_options' };
  // Lazy: the pure helpers above load without the navigation module.
  // eslint-disable-next-line global-require
  const navigation = require('./navigation.cjs');
  // Review WR-06: the answer route goes into the stored value, so a relayed answer is not read as a proven one.
  const w = navigation.writeCauseEffect(db, { domain: mapped.domain, gateId: a.gateId, decisionNodeId: a.decisionNodeId, answeredVia: a.answeredVia });
  if (!w || w.ok !== true) return { ok: false, reason: (w && w.reason) || 'cause_effect_write_failed' };
  return { ok: true, written: true, domain: w.domain };
}

// -- the fixed suggest_next sentences ------------------------------------------------------------------------------

function optionJson(stageIndex) {
  return JSON.stringify(STAGES[stageIndex].options.map((o) => ({ id: o.id, label: o.label })));
}

const CARD_STEPS = [
  'To show the card: call gate_render with kind "' + CARD_KIND + '" and options ' + optionJson(0) + '.',
  'The server sets the question and the labels and refuses any other option set (reason bad_cause_effect_options).',
  'After the person answers the card, call gate_answer with the gate_id, chosen [the option id the person picked] and verdict "approve".',
  'When the reply has cause_effect.follow_up with stage 2, call gate_render again with kind "' + CARD_KIND + '" and options '
    + optionJson(1) + ', then answer that card the same way.',
  'A reject or a defer stores nothing.',
  'When the person closes the card with no answer, do not call gate_answer: nothing is stored, so show the card again.',
  'The domain is stored only when the gate_answer reply has cause_effect.written true.',
].join(' ');

const NOT_SET_HEAD = 'No cause and effect domain is set for this room, so the decision advisor does not use one. '
  + 'Never guess the domain from the room; only the person sets it. ';

/**
 * howToSentences(domain) -> the fixed how_to string of suggest_next's cause_effect field. A valid domain id gives
 * the change sentence, anything else the not-set sentence; both end with the card steps.
 */
function howToSentences(domain) {
  const known = typeof domain === 'string' && DATA.domains.some((d) => d.id === domain);
  if (known) {
    return 'The person set the cause and effect domain of this room: ' + domain + '. To change it, show the card again. ' + CARD_STEPS;
  }
  return NOT_SET_HEAD + CARD_STEPS;
}

module.exports = {
  CARD_KIND,
  isCauseEffectCard,
  normalizeOptions,
  answerFor,
  ratifyCauseEffect,
  howToSentences,
};
