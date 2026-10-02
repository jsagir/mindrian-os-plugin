'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 08 (D-06, D-07): the perspective registry. The MCP door and
 * the CLI door read ONE list of perspective ids from here, and dispatch a
 * recall to the module that id names. The six ids are listed up front; a module
 * is required lazily, so getPerspective(id) is null (the caller reports
 * perspective_unavailable) while a module file has not landed yet.
 *
 * T-366-31: an id is looked up ONLY in the frozen MODULE_FILES map. No path is
 * ever built from the input, so '../x' or 'eureka-recall' resolves to nothing.
 *
 * The interface every perspective module exports:
 *   ID, TEMPLATE_ID, COMMAND, LENSES, FALSIFIER, RUN_ROOT, BUDGETS (frozen),
 *   STAGE_A_LANES (frozen array), runRecall(roomDir, opts), readCandidates(roomDir, tag),
 *   runDirFor(roomDir, tag), questionSetFor(recall, substrate, opts).
 * COUNTER_METRICS (Phase 366 plan 16, Phase 343 shape): the per-stage counter-metric pairs,
 * declared once here. A declaration, never enforced at runtime: the doctor and the sensors
 * read it later. watched_by may be null (a reasoned call); an absent key is the failure.
 * Optional: STATUS_TITLE (the derived STATUS.md heading), STATEMENT_TEMPLATE (analogies).
 * Candidate rows keep {a, b, section_a, section_b, title_a, title_b, lanes[],
 * lexical, shared_entities[]}; a perspective's own scores ride extra keys.
 *
 * Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const MODULE_FILES = Object.freeze({
  eureka: './eureka-recall.cjs',
  rs: './rs-recall.cjs',
  hsi: './hsi-recall.cjs',
  whitespace: './whitespace-recall.cjs',
  analogies: './analogies-recall.cjs',
  connections: './connections-recall.cjs',
});

const PERSPECTIVE_IDS = Object.freeze(Object.keys(MODULE_FILES));

const INTERFACE_NAMES = Object.freeze([
  'ID', 'TEMPLATE_ID', 'COMMAND', 'LENSES', 'FALSIFIER', 'RUN_ROOT', 'BUDGETS', 'STAGE_A_LANES',
  'runRecall', 'readCandidates', 'runDirFor', 'questionSetFor',
]);

// One pair per stage (design section 8). optimizes names what pushing the stage up produces;
// watched_by names the quantity that degrades when it is pushed without limit.
const COUNTER_METRICS = Object.freeze([
  { stage: 'substrate', optimizes: 'things read per run', watched_by: 'things the navigator later reports missing from a run' },
  { stage: 'recall', optimizes: 'candidates within the cap', watched_by: 'pairs the navigator later banks that came from outside the cap' },
  { stage: 'recall_exclusion', optimizes: 'known pairs excluded', watched_by: 'banked opportunities later found to duplicate an existing node' },
  { stage: 'judge', optimizes: 'candidates passed by Stage A or the judge arm', watched_by: 'passed verdicts the navigator declines, plus already_known the navigator marks that the judge missed' },
  { stage: 'research', optimizes: 'evidence rows per leaf', watched_by: 'rows whose hash no longer resolves, plus citation checks contradicted' },
  { stage: 'filing', optimizes: 'opportunities filed per run', watched_by: 'filed opportunities the navigator later closes as not useful' },
  { stage: 'whole_run', optimizes: 'runs completed', watched_by: 'CPU-seconds, peak RSS, runs on battery (SEED-099, Phase 368)' },
].map(function (e) { return Object.freeze(e); }));

function fileFor(id) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(MODULE_FILES, id)) return null;
  return path.join(__dirname, MODULE_FILES[id]);
}

/** available(id) -> true when the id is registered and its module file is on disk. */
function available(id) {
  const f = fileFor(id);
  return f !== null && fs.existsSync(f);
}

/** getPerspective(id) -> the module, or null (unknown id, or its module has not landed). */
function getPerspective(id) {
  const f = fileFor(id);
  if (f === null || !fs.existsSync(f)) return null;
  return require(f);
}

module.exports = {
  MODULE_FILES: MODULE_FILES,
  PERSPECTIVE_IDS: PERSPECTIVE_IDS,
  INTERFACE_NAMES: INTERFACE_NAMES,
  COUNTER_METRICS: COUNTER_METRICS,
  available: available,
  getPerspective: getPerspective,
};
