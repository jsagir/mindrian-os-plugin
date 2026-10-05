'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 03 -- the OpenAlex replay route for every hermetic run of this phase.
 *
 * route(q, url) is the route function the replay preload (tests/helpers/openalex-replay-363.cjs
 * writeReplayPreload) hands to makeReplayFetch. Two jobs:
 *   1. LOG: when MOS_3692_REPLAY_LOG names a file, append one JSON line {"q": <search string>}
 *      per search that reaches the fetch, so a test can prove exactly which strings left. Only
 *      the q is written, never the URL and never a header (no key can leak into the log).
 *   2. ROUTE: map the search string to a recorded body id from
 *      tests/fixtures/363-openalex/bodies.json. First regex match wins; no match answers
 *      gap_primary_zero (count 0).
 *
 * ROUTES is frozen. Later plans append rows at the end and never reorder, so an earlier
 * plan's bar keeps its body.
 *
 * Hyphens only, no em-dash or en-dash.
 */

const fs = require('node:fs');

const ROUTES = Object.freeze([
  Object.freeze([/cold storage|cold locker/i, 'synonym_hits']),
  Object.freeze([/review OR survey/, 'prior_review_two']),
]);

function logQuery(q) {
  const file = process.env.MOS_3692_REPLAY_LOG;
  if (typeof file !== 'string' || file.length === 0) return;
  try {
    fs.appendFileSync(file, JSON.stringify({ q: q }) + '\n', 'utf8');
  } catch (_e) { /* a log failure must never change what the fetch answers */ }
}

function route(q, url) {
  logQuery(q);
  const text = typeof q === 'string' ? q : '';
  for (let i = 0; i < ROUTES.length; i += 1) {
    if (ROUTES[i][0].test(text)) return ROUTES[i][1];
  }
  void url;
  return 'gap_primary_zero';
}

module.exports = { route: route, ROUTES: ROUTES };
