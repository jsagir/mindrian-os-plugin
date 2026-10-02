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
  available: available,
  getPerspective: getPerspective,
};
