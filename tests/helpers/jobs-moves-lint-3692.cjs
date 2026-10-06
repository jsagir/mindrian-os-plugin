'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 16 (R07, annex C16, INPUT addendum 2) -- the jobs-and-moves register as a lint.
 *
 * A line a person reads (an answer line, an evidence card sentence, a report line) names the job and
 * the move, never the id: no leaf id, limiter id, key-line id, run id, shape code, template id, step
 * name or verdict code, and never the word confirmed. The words verified and complete are allowed only
 * when the run itself said it was complete (opts.complete), with one exception: "Not verified" is the
 * honest form and is always allowed.
 *
 * Exports:
 *   RULES                   frozen list of { name, re, unlessComplete }
 *   lintLine(text, opts)    -> [{ rule, match }]   opts.complete (boolean) relaxes the two completion words
 *
 * Pure: no fs, no network, no clock. Hyphens only, no em-dash or en-dash.
 */

const TEMPLATE_PREFIXES = '(ws|ce|cl|ci|df|eu|rs|hsi|an|cn|mu|rc|hat)';

const RULES = Object.freeze([
  Object.freeze({ name: 'leaf_id', re: /\bL\d+\b/, unlessComplete: false }),
  Object.freeze({ name: 'limiter_id', re: /\bLM\d+\b/, unlessComplete: false }),
  Object.freeze({ name: 'key_line_id', re: /\bK\d+\b/, unlessComplete: false }),
  Object.freeze({ name: 'run_id', re: /\brp-\d{4}-/, unlessComplete: false }),
  Object.freeze({ name: 'shape_code', re: /\bF\.\d\b/, unlessComplete: false }),
  Object.freeze({ name: 'template_id', re: new RegExp('\\b' + TEMPLATE_PREFIXES + '\\.[a-z_]+\\b'), unlessComplete: false }),
  Object.freeze({ name: 'step_or_code', re: /\b(dispatch_lanes|fetch_round|wrong_step|term_not_composed|grant_scope_cannot_cover_plan|hash_not_approved|egress_line_off|not_executed|refused_before_fetch|executed_empty)\b/, unlessComplete: false }),
  Object.freeze({ name: 'confirmed', re: /\bconfirmed\b/i, unlessComplete: false }),
  Object.freeze({ name: 'verified', re: /(?<!Not )\bverified\b/i, unlessComplete: true }),
  Object.freeze({ name: 'complete', re: /\bcomplete\b/i, unlessComplete: true }),
]);

function lintLine(text, opts) {
  const complete = !!(opts && opts.complete === true);
  const s = typeof text === 'string' ? text : String(text === undefined || text === null ? '' : text);
  const out = [];
  RULES.forEach(function (rule) {
    if (rule.unlessComplete && complete) return;
    const m = rule.re.exec(s);
    if (m) out.push({ rule: rule.name, match: m[0] });
  });
  return out;
}

module.exports = { RULES: RULES, lintLine: lintLine };
