'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 399 plan 01 (I-10, D-06): the two-axis problem type.
 *
 * A room problem type has two axes:
 *   1. definition_level: un-defined | ill-defined | well-defined (or null when unknown).
 *   2. wickedness: a Cynefin rating (0 clear, 1 complicated, 2 complex, 3 chaotic) and a
 *      wicked yes/no. Wicked is a complexity dimension, not a fourth exclusive type (D-06):
 *      a wicked problem can sit on any definition level.
 *
 * This module is ADDITIVE. The four-value enum (UnDefined | IllDefined | WellDefined | Wicked)
 * stays the Brain wire value and the Part 8 guard vocabulary. toFourValue is the derived
 * compatibility view and uses exactly the precedence of lib/core/ambient-framing.cjs
 * rungFromExplicitClassification (wicked wins, else the definition level, else null).
 *
 * A missing wicked signal is null (unknown), never false: no local signal proves "not wicked".
 *
 * Pure: no network, no Brain call. readRoomAxes reads one local file and returns enum members
 * or null only; it returns no room text (Canon Part 8).
 *
 * Phase 400 (S2, F-03): the cause_effect axis is a separate axis with five domains;
 * wickedness.cynefin_rating stays one release as a deprecated read alias; the room's domain
 * comes only from the navigator's gate answer (plan 08), never from room text;
 * causeEffectFromRating is a labelled weak source and is never the shown domain.
 * A missing or unknown domain is null, never disorder: disorder is a navigator answer
 * ("we cannot tell"), not a default (Pitfall 8). The Phase 400 helpers below are pure:
 * no env read at load, no file read, no network.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFINITION_LEVELS = Object.freeze(['un-defined', 'ill-defined', 'well-defined']);
// Index in this list is the Cynefin rating 0-3.
const CYNEFIN_LEVELS = Object.freeze(['clear', 'complicated', 'complex', 'chaotic']);

const CYNEFIN_BY_COMPLEXITY = Object.freeze({ simple: 0, complicated: 1, complex: 2 });

function isDefinitionLevel(x) {
  return DEFINITION_LEVELS.indexOf(x) !== -1;
}

function makeAxes(definitionLevel, cynefinRating, wicked, source) {
  return {
    definition_level: isDefinitionLevel(definitionLevel) ? definitionLevel : null,
    wickedness: {
      cynefin_rating: cynefinRating === 0 || cynefinRating === 1 || cynefinRating === 2 || cynefinRating === 3 ? cynefinRating : null,
      wicked: wicked === true ? true : null,
      source: source || null,
    },
  };
}

/*
 * fromExplicitClassification({ definition, complexity }): the shape returned by
 * ambient-framing extractExplicitProblemType. definition is 'undefined' | 'ill-defined' |
 * 'well-defined' | null. complexity is 'simple' | 'complicated' | 'complex' | 'wicked' | null.
 */
function fromExplicitClassification(classified) {
  const c = classified && typeof classified === 'object' ? classified : {};
  const def = c.definition === 'undefined' ? 'un-defined' : c.definition;
  const comp = c.complexity;
  const rating = Object.prototype.hasOwnProperty.call(CYNEFIN_BY_COMPLEXITY, comp) ? CYNEFIN_BY_COMPLEXITY[comp] : null;
  return makeAxes(def, rating, comp === 'wicked', 'state');
}

/*
 * fromFourValue(rung): the Brain wire value to the two axes.
 * 'Wicked' maps to ill-defined: the book ruling cited in 399-CONTEXT research reads
 * "Wicked is the sharpest edge of Ill-Defined". The wicked flag is true; the Cynefin rating is unknown.
 */
function fromFourValue(rung) {
  if (rung === 'Wicked') return makeAxes('ill-defined', null, true, 'four_value');
  if (rung === 'UnDefined') return makeAxes('un-defined', null, false, 'four_value');
  if (rung === 'IllDefined') return makeAxes('ill-defined', null, false, 'four_value');
  if (rung === 'WellDefined') return makeAxes('well-defined', null, false, 'four_value');
  return makeAxes(null, null, false, null);
}

/* fromPersonaType(type): persona-taxonomy PROBLEM_TYPES (UDP, IDP, WDP, unknown) to the definition level. */
function fromPersonaType(type) {
  const map = { UDP: 'un-defined', IDP: 'ill-defined', WDP: 'well-defined' };
  const level = Object.prototype.hasOwnProperty.call(map, type) ? map[type] : null;
  return makeAxes(level, null, false, level ? 'persona' : null);
}

/*
 * toFourValue(axes): the derived compatibility view. Same precedence as
 * ambient-framing rungFromExplicitClassification.
 */
function toFourValue(axes) {
  if (!axes || typeof axes !== 'object') return null;
  if (axes.wickedness && axes.wickedness.wicked === true) return 'Wicked';
  if (axes.definition_level === 'un-defined') return 'UnDefined';
  if (axes.definition_level === 'ill-defined') return 'IllDefined';
  if (axes.definition_level === 'well-defined') return 'WellDefined';
  return null;
}

/*
 * readRoomAxes(roomDir): read <roomDir>/STATE.md and classify it with the existing explicit-field
 * parser. Never throws. With no STATE.md, or no explicit field, every axis is null.
 */
function readRoomAxes(roomDir) {
  const empty = function () { return makeAxes(null, null, false, null); };
  try {
    const raw = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
    // Lazy require: ambient-framing loads more modules than the pure helpers above need.
    // eslint-disable-next-line global-require
    const classified = require('./ambient-framing.cjs').extractExplicitProblemType(raw);
    if (classified.definition === null && classified.complexity === null) return empty();
    return fromExplicitClassification(classified);
  } catch (_e) {
    return empty();
  }
}

// -----------------------------------------------------------------------
// Phase 400 (CY-01): the cause_effect axis. Additive; the 399 objects above carry no cause_effect key.
// The domain ids and the move types are the closed vocabulary of data/cynefin-domains.json (K1).
const CAUSE_EFFECT_DOMAINS = Object.freeze(['clear', 'complicated', 'complex', 'chaotic', 'disorder']);
const MOVE_TYPES = Object.freeze(['categorize', 'analyze', 'probe', 'act', 'slice']);
const DOMAIN_MOVE = Object.freeze({
  clear: 'categorize',
  complicated: 'analyze',
  complex: 'probe',
  chaotic: 'act',
  disorder: 'slice',
});
// 'navigator' is the gate answer (the only source of the room's shown domain).
// 'weak_cynefin_rating' is the old 0-3 rating mapped by causeEffectFromRating; no consumer shows it.
const CAUSE_EFFECT_SOURCES = Object.freeze(['navigator', 'weak_cynefin_rating']);

function isCauseEffectDomain(x) {
  return typeof x === 'string' && CAUSE_EFFECT_DOMAINS.indexOf(x) !== -1;
}

/*
 * makeCauseEffect(domain, source): the axis object {domain, source}. An unknown domain or an
 * unknown source gives {domain: null, source: null}. Exact match only: 'Disorder' and the
 * book's word 'confused' are not domain ids.
 */
function makeCauseEffect(domain, source) {
  if (!isCauseEffectDomain(domain)) return { domain: null, source: null };
  if (typeof source !== 'string' || CAUSE_EFFECT_SOURCES.indexOf(source) === -1) return { domain: null, source: null };
  return { domain: domain, source: source };
}

/*
 * causeEffectFromRating(rating): the deprecated 0-3 Cynefin rating as a weak, labelled source.
 * 0 clear, 1 complicated, 2 complex, 3 chaotic. It never returns disorder and never the source
 * 'navigator'. Fence (test C6): no lib consumer calls it; it is never the room's shown domain (F-02).
 */
function causeEffectFromRating(rating) {
  if (rating === 0 || rating === 1 || rating === 2 || rating === 3) {
    return makeCauseEffect(CYNEFIN_LEVELS[rating], 'weak_cynefin_rating');
  }
  return { domain: null, source: null };
}

// -----------------------------------------------------------------------
// Phase 400 plan 11 (AX-01, F-07, O-02): the flagged level wording. Additive.
// data/problem-axes-wording.json holds the versions. v1 is the default and equals the Well-defined cell
// of the Axis 1 table in references/methodology/problem-types.md. v2 is provisional and is used only
// when the env MINDRIAN_LEVEL_WORDING is exactly 'v2'. The data file is read lazily on the first call
// and cached; the env is read at each call, never at load. No network, no room text.
const LEVEL_WORDING_FLAG = 'MINDRIAN_LEVEL_WORDING';
const WORDING_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'problem-axes-wording.json');
let wordingCache = null;

function wordingData() {
  if (wordingCache === null) {
    try {
      wordingCache = JSON.parse(fs.readFileSync(WORDING_DATA_PATH, 'utf8'));
    } catch (_e) {
      wordingCache = {};
    }
  }
  return wordingCache;
}

/*
 * levelWording(): {version, well_defined, wicked_note, status} for the active wording version.
 * Any env value other than exactly 'v2' gives v1 (the default). A missing data file gives v1 with
 * the null fields, so the caller never sees a throw.
 */
function levelWording() {
  const versions = (wordingData().level_wording && wordingData().level_wording.versions) || {};
  const version = process.env[LEVEL_WORDING_FLAG] === 'v2' && versions.v2 ? 'v2' : 'v1';
  const v = versions[version] || {};
  return {
    version: version,
    well_defined: typeof v.well_defined === 'string' ? v.well_defined : null,
    wicked_note: typeof v.wicked_note === 'string' ? v.wicked_note : null,
    status: typeof v.status === 'string' ? v.status : null,
  };
}

// Phase 400 plan 11 (AX-02, F-06): the wicked cut-off. A raw 0.5 cut says yes too readily, so a wicked
// probability becomes yes or no only through the fitted cut-off stored in data/problem-axes-wording.json
// (scripts/derive-wicked-cutoff.cjs writes it at dev time). With no fit the answer is null (unknown).
// Owner sign-off 2026-11-25: a block of state 'ruled' is also an active cut-off. It is a provisional policy value
// chosen without label files, never called a fit; a real fit replaces it (state 'fitted').
function isFittedCutoff(block) {
  return !!block && typeof block === 'object' && (block.state === 'fitted' || block.state === 'ruled')
    && typeof block.value === 'number' && Number.isFinite(block.value) && block.value >= 0 && block.value <= 1;
}

/*
 * wickedFromProbability(p, opts): true when p is at or above the fitted cut-off, false when below,
 * null when no cut-off is fitted or p is not a number in 0..1. opts.cutoff is the test seam; else the
 * wicked_cutoff block of the data file.
 */
function wickedFromProbability(p, opts) {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return null;
  const o = opts && typeof opts === 'object' ? opts : {};
  const block = Object.prototype.hasOwnProperty.call(o, 'cutoff') ? o.cutoff : wordingData().wicked_cutoff;
  if (!isFittedCutoff(block)) return null;
  return p >= block.value;
}

module.exports = {
  DEFINITION_LEVELS,
  CYNEFIN_LEVELS,
  isDefinitionLevel,
  fromExplicitClassification,
  fromFourValue,
  fromPersonaType,
  toFourValue,
  readRoomAxes,
  CAUSE_EFFECT_DOMAINS,
  MOVE_TYPES,
  DOMAIN_MOVE,
  CAUSE_EFFECT_SOURCES,
  isCauseEffectDomain,
  makeCauseEffect,
  causeEffectFromRating,
  LEVEL_WORDING_FLAG,
  levelWording,
  wickedFromProbability,
};
