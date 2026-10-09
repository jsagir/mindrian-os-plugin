'use strict';
// Maps the plugin modules that are NOT in this slice onto local stubs, only for requests made from package-2026/hsi.
const Module = require('node:module');
const path = require('node:path');
const STUBS = path.join(__dirname, 'stubs');
const MAP = [
  [/(^|\/)numeric\/tfidf\.cjs$/, 'numeric/tfidf.cjs'],
  [/(^|\/)numeric\/svd\.cjs$/, 'numeric/svd.cjs'],
  [/(^|\/)rs-pinecone-bridge\.cjs$/, 'rs-pinecone-bridge.cjs'],
  [/(^|\/)direction-convention\.cjs$/, 'direction-convention.cjs'],
  [/(^|\/)rs-engine\.cjs$/, 'rs-engine.cjs'],
  [/(^|\/)semantic-index\/embedding-spine\.cjs$/, 'semantic-index/embedding-spine.cjs'],
  [/(^|\/)lazygraph-ops\.cjs$/, 'lazygraph-ops.cjs'],
  [/(^|\/)node-insert\.cjs$/, 'node-insert.cjs'],
  [/(^|\/)verification-stamp\.cjs$/, 'verification-stamp.cjs'],
  [/(^|\/)verification-stamp-format\.cjs$/, 'verification-stamp-format.cjs'],
  [/(^|\/)floor-disclosure\.cjs$/, 'floor-disclosure.cjs'],
  [/(^|\/)ensure-brain-baseline\.cjs$/, 'ensure-brain-baseline.cjs'],
  [/(^|\/)brain-client\.cjs$/, 'brain-client.cjs'],
  [/(^|\/)navigation\.cjs$/, 'navigation.cjs'],
  [/(^|\/)shared\.cjs$/, 'planner-shared.cjs'],
  [/(^|\/)eureka-recall\.cjs$/, 'eureka-recall.cjs'],
  [/(^|\/)jev-devtime-client\.cjs$/, 'jev-devtime-client.cjs'],
  [/(^|\/)jev-question-ceilings\.cjs$/, 'jev-question-ceilings.cjs'],
  [/(^|\/)jev-response-schema\.cjs$/, 'jev-response-schema.cjs'],
];
const HSI_ROOT = path.resolve(__dirname, '..');
const extra = {};
function register(re, file) { MAP.push([re, file]); }
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (parent && parent.filename && parent.filename.startsWith(HSI_ROOT) && !parent.filename.startsWith(STUBS)) {
    for (const [re, file] of MAP) {
      if (re.test(request)) return path.isAbsolute(file) ? file : path.join(STUBS, file);
    }
  }
  return orig.call(this, request, parent, ...rest);
};
module.exports = { register, extra };
