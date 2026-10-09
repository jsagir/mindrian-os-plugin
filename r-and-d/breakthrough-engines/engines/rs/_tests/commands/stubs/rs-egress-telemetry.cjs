'use strict';
// HAND-MADE TEST STUB. In-memory ledger; never touches ~/.mindrian.
// Same allow-lists as the shipped primitive (read from the original file).
const DEFAULT_BUDGETS = Object.freeze({
  openalex: 100, arxiv: 100, scopus: 50, pubmed: 100, ieee: 50, nature: 25,
  google_patents: 50, uspto: 50, tavily: 30, crunchbase: 30,
});
const ALLOWED_STATUSES = new Set(['ok', 'rate_limited', 'api_error', 'network_error', 'timeout', 'api_key_missing']);
const entries = [];
function recordTelemetry(opts) {
  if (!opts || !Object.prototype.hasOwnProperty.call(DEFAULT_BUDGETS, opts.source)) return { success: false, error: 'invalid_source' };
  if (!ALLOWED_STATUSES.has(opts.status)) return { success: false, error: 'invalid_status' };
  entries.push(Object.assign({}, opts));
  return { success: true };
}
function computeRemainingBudget(source, cap) {
  const budget = (typeof cap === 'number' && cap >= 0) ? cap : DEFAULT_BUDGETS[source];
  return Math.max(0, budget - entries.filter(function (e) { return e.source === source; }).length);
}
function _reset() { entries.length = 0; }
module.exports = { DEFAULT_BUDGETS, recordTelemetry, computeRemainingBudget, _entries: entries, _reset };
