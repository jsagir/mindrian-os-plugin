/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 (Ambient trigger: the room starts the breakthrough run)
 * Plan 04, AMB-07, CONTEXT "Strategy, not keywords" (locked), research
 * item 8, navigator Rulings 4 and 6.
 *
 * The ambient card's framing follows the room's problem-type rung, found
 * strategically: what the navigator ratified (the jtbd goal), what the room
 * declares (ROOM.md pws_stage), what its STATE.md explicitly says, then the
 * structural MINTO classifier, then a neutral default. Never a keyword
 * match on the user's own words: the free-text rung classifier this repo
 * already has (brain-client.cjs's private per-question marker-table lookup)
 * is forbidden on this path.
 *
 * Ruling 4: the AI-SPEC's two trigger moments (ill-defined, extend-the-
 * opportunity) shape the card's framing only; nothing in this module gates
 * a run. Ruling 6: the three phrases below get the PWS author's
 * confirmation at the 355.1 checkpoint (plan 355.1-08 sets
 * direction-convention.cjs's FRAMING_CONFIRMED), the 355-02 pattern.
 *
 * resolveRoomRung(roomDir, opts) walks a fixed chain, each step wrapped in
 * its own try/catch so a thrown error in one step never stops the chain:
 *   1. the ratified jtbd goal.rung (lib/hmi/jtbd-state.cjs getGoal), when it
 *      is one of Theo's four rung ids (lib/core/strategy/rung-vocabulary.cjs
 *      isTheoRung) -- source 'jtbd_goal'.
 *   2. the room root ROOM.md frontmatter pws_stage, when it is one of the
 *      two PWS_STAGE_FRAMING keys -- source 'room_pws_stage'.
 *   3. an EXPLICIT STATE.md frontmatter field (definition_level,
 *      problem_definition, complexity or problem_type), classified the
 *      same way lib/mcp/brain-router.cjs's extractProblemType and
 *      _rungFromClassification do (neither is exported there, so the
 *      explicit-field branch is replicated here; the venture_stage
 *      INFERENCE branch is deliberately NOT replicated, so a STATE.md
 *      holding only venture_stage never resolves this step) -- source
 *      'state_explicit'.
 *   4. only when opts.allowStructural === true: opts.structuralFn(roomDir)
 *      if given, else lib/core/brain-derivation.cjs classifyProblemType
 *      over lib/core/folder-memory.cjs readTriple(roomDir) -- source
 *      'minto_structural'.
 *   5. { rung: 'unknown', source: 'none' }, the honest default (most live
 *      rooms land here today; the neutral framing must read well).
 *
 * framingFor(roomDir, opts) resolves the rung, then looks the framing up
 * (PWS_STAGE_FRAMING for source 'room_pws_stage', FRAMING_BY_RUNG
 * otherwise), and always returns a lib/core/direction-convention.cjs
 * FRAMING_IDS member.
 *
 * Canon Part 8: every value that flows through this module is a closed
 * enum, a rung id, a source id or a room-local file path; nothing here
 * reads or forwards room prose, and nothing here makes a network call.
 *
 * Top-level requires: node:fs, node:path and ./direction-convention.cjs
 * only. Every other dependency (jtbd-state, rung-vocabulary, brain-
 * derivation, folder-memory) is lazy-required inside the one step that
 * uses it, so a hook-path caller that never reaches the structural step
 * never pays for brain-derivation's own require graph.
 *
 * Pure CJS, node built-ins only, zero new deps. No em-dashes (CLAUDE.md
 * HARD RULE). Hyphens only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const directionConvention = require('./direction-convention.cjs');

// The five persisted rung ids this module ever returns: Theo's four rung
// ids (lib/core/strategy/rung-vocabulary.cjs THEO_RUNGS) plus the local
// 'unknown' sentinel for "nothing resolved."
const RUNG_IDS = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked', 'unknown']);

// The five chain-step source ids, in the chain's own precedence order.
const RUNG_SOURCES = Object.freeze(['jtbd_goal', 'room_pws_stage', 'state_explicit', 'minto_structural', 'none']);

// FRAMING_BY_RUNG: a resolved Theo rung (or 'unknown') to one of
// direction-convention.cjs's FRAMING_IDS. An ill-defined or undefined room
// gets a find-the-problem framing; a well-defined room gets a pursue-or-
// drop framing; Wicked and unknown both stay neutral (CONTEXT "Strategy,
// not keywords").
const FRAMING_BY_RUNG = Object.freeze({
  UnDefined: 'find_the_problem',
  IllDefined: 'find_the_problem',
  WellDefined: 'pursue_or_drop',
  Wicked: 'neutral',
  unknown: 'neutral',
});

// PWS_STAGE_FRAMING: the two ROOM.md pws_stage values this module ever
// reads (scripts/eureka-portfolio-report.cjs's own D-40 restriction) mapped
// straight to a framing id, without ever computing a rung for them.
const PWS_STAGE_FRAMING = Object.freeze({
  ill_defined: 'find_the_problem',
  extend_opportunity: 'pursue_or_drop',
});

// Mapping from the structural classifier's own three-letter codes to a
// Theo rung id.
const MINTO_TO_RUNG = Object.freeze({ UDP: 'UnDefined', IDP: 'IllDefined', WDP: 'WellDefined' });

// ---------- step 1: the ratified jtbd goal.rung ----------
function stepJtbdGoal(roomDir) {
  // eslint-disable-next-line global-require
  const jtbdState = require('../hmi/jtbd-state.cjs');
  // eslint-disable-next-line global-require
  const rungVocabulary = require('./strategy/rung-vocabulary.cjs');
  const goal = jtbdState.getGoal(roomDir);
  if (!goal || !rungVocabulary.isTheoRung(goal.rung) || RUNG_IDS.indexOf(goal.rung) === -1) return null;
  return { rung: goal.rung, source: 'jtbd_goal' };
}

// ---------- step 2: the room root ROOM.md frontmatter pws_stage ----------
// Mirrors scripts/eureka-portfolio-report.cjs's own _readPwsStage (D-40,
// D-37) exactly: the first 2KB only (frontmatter always sits at the top of
// the file), restricted to the two PWS_STAGE_FRAMING values. Replicated,
// not imported, because that function is a private helper of a script
// module, not an exported library function.
function readPwsStageHead(roomDir) {
  const roomMdPath = path.join(roomDir, 'ROOM.md');
  const stat = fs.statSync(roomMdPath);
  if (!stat.isFile()) return null;
  const fd = fs.openSync(roomMdPath, 'r');
  try {
    const buf = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buf, 0, 2048, 0);
    const head = buf.slice(0, bytesRead).toString('utf8');
    const match = head.match(/^pws_stage\s*:\s*["']?(ill_defined|extend_opportunity)["']?\s*$/mi);
    return match ? match[1].toLowerCase() : null;
  } finally {
    try {
      fs.closeSync(fd);
    } catch (_e) {
      // best effort
    }
  }
}

function stepRoomPwsStage(roomDir) {
  const pwsStage = readPwsStageHead(roomDir);
  if (pwsStage === null || !Object.prototype.hasOwnProperty.call(PWS_STAGE_FRAMING, pwsStage)) return null;
  return { rung: null, source: 'room_pws_stage', pws_stage: pwsStage };
}

// ---------- step 3: an EXPLICIT STATE.md field ----------
// hasExplicitProblemTypeField(stateContent): true only when STATE.md
// frontmatter carries one of the four fields lib/mcp/brain-router.cjs's
// extractProblemType reads explicitly.
const EXPLICIT_FIELD_RE = /^(?:definition_level|problem_definition|complexity|problem_type):\s*(.+)$/im;

function hasExplicitProblemTypeField(stateContent) {
  return EXPLICIT_FIELD_RE.test(stateContent);
}

// extractExplicitProblemType(stateContent): mirrors lib/mcp/brain-
// router.cjs's extractProblemType explicit-field branch verbatim (that
// function is not exported there). The venture_stage INFERENCE branch is
// deliberately NOT replicated here: this step must fire only when an
// explicit field is present.
function extractExplicitProblemType(stateContent) {
  let definition = null;
  let complexity = null;

  const defMatch = stateContent.match(/definition_level:\s*(.+)/i) || stateContent.match(/problem_definition:\s*(.+)/i);
  if (defMatch) {
    const val = defMatch[1].trim().toLowerCase();
    if (val.indexOf('well') !== -1) definition = 'well-defined';
    else if (val.indexOf('ill') !== -1) definition = 'ill-defined';
    else if (val.indexOf('undef') !== -1) definition = 'undefined';
  }

  const compMatch = stateContent.match(/complexity:\s*(.+)/i) || stateContent.match(/problem_type:\s*(.+)/i);
  if (compMatch) {
    const val = compMatch[1].trim().toLowerCase();
    if (val.indexOf('simple') !== -1) complexity = 'simple';
    else if (val.indexOf('complicated') !== -1) complexity = 'complicated';
    else if (val.indexOf('wicked') !== -1) complexity = 'wicked';
    else if (val.indexOf('complex') !== -1) complexity = 'complex';
  }

  return { definition: definition, complexity: complexity };
}

// rungFromExplicitClassification(definition, complexity): mirrors
// lib/mcp/brain-router.cjs's _rungFromClassification exactly (also not
// exported there).
function rungFromExplicitClassification(definition, complexity) {
  if (complexity === 'wicked') return 'Wicked';
  if (definition === 'undefined') return 'UnDefined';
  if (definition === 'ill-defined') return 'IllDefined';
  if (definition === 'well-defined') return 'WellDefined';
  return null;
}

function stepStateExplicit(roomDir) {
  const stateMdPath = path.join(roomDir, 'STATE.md');
  const raw = fs.readFileSync(stateMdPath, 'utf8');
  if (!hasExplicitProblemTypeField(raw)) return null;
  const classified = extractExplicitProblemType(raw);
  const rung = rungFromExplicitClassification(classified.definition, classified.complexity);
  if (!rung) return null;
  return { rung: rung, source: 'state_explicit' };
}

// ---------- step 4: the structural MINTO classifier (child side only) ----------
function stepMintoStructural(roomDir, options) {
  if (!options || options.allowStructural !== true) return null;
  let classification;
  if (typeof options.structuralFn === 'function') {
    classification = options.structuralFn(roomDir);
  } else {
    // eslint-disable-next-line global-require
    const brainDerivation = require('./brain-derivation.cjs');
    // eslint-disable-next-line global-require
    const folderMemory = require('./folder-memory.cjs');
    classification = brainDerivation.classifyProblemType(folderMemory.readTriple(roomDir));
  }
  const rung = MINTO_TO_RUNG[classification];
  if (!rung) return null;
  return { rung: rung, source: 'minto_structural' };
}

/*
 * resolveRoomRung(roomDir, opts) -> { rung, source, pws_stage? }.
 * opts.allowStructural (boolean) and opts.structuralFn (function) are the
 * only recognized keys. Never throws.
 */
function resolveRoomRung(roomDir, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const steps = [
    function () { return stepJtbdGoal(roomDir); },
    function () { return stepRoomPwsStage(roomDir); },
    function () { return stepStateExplicit(roomDir); },
  ];
  if (options.allowStructural === true) {
    steps.push(function () { return stepMintoStructural(roomDir, options); });
  }
  for (let i = 0; i < steps.length; i += 1) {
    let result = null;
    try {
      result = steps[i]();
    } catch (_e) {
      result = null;
    }
    if (result) return result;
  }
  return { rung: 'unknown', source: 'none' };
}

/*
 * framingFor(roomDir, opts) -> { framing, rung, source }. framing is always
 * a direction-convention.cjs FRAMING_IDS member: a resolved id that somehow
 * fell outside that closed set (it cannot today, given FRAMING_BY_RUNG and
 * PWS_STAGE_FRAMING above, but this guard is the actual coupling to the one
 * place the set is owned, not a coincidence of matching literals) degrades
 * to 'neutral' rather than leaking an unrecognized string. Never throws
 * (delegates to resolveRoomRung, which never throws).
 */
function framingFor(roomDir, opts) {
  const result = resolveRoomRung(roomDir, opts);
  const framingId = result.source === 'room_pws_stage'
    ? PWS_STAGE_FRAMING[result.pws_stage]
    : FRAMING_BY_RUNG[result.rung];
  const safeFramingId = directionConvention.FRAMING_IDS.indexOf(framingId) !== -1 ? framingId : 'neutral';
  return { framing: safeFramingId, rung: result.rung, source: result.source };
}

module.exports = {
  RUNG_IDS: RUNG_IDS,
  RUNG_SOURCES: RUNG_SOURCES,
  FRAMING_BY_RUNG: FRAMING_BY_RUNG,
  PWS_STAGE_FRAMING: PWS_STAGE_FRAMING,
  resolveRoomRung: resolveRoomRung,
  framingFor: framingFor,
};
