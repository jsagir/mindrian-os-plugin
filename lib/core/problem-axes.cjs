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

module.exports = {
  DEFINITION_LEVELS,
  CYNEFIN_LEVELS,
  isDefinitionLevel,
  fromExplicitClassification,
  fromFourValue,
  fromPersonaType,
  toFourValue,
  readRoomAxes,
};
