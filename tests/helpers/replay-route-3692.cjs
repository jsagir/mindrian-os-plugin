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
const path = require('node:path');

// 369.2-31: the merged replay bodies a preload serves (the 363 set, the 369.2 set, the SEED-118 set; a later
// file wins on a key collision and none is expected). A preload passes this map to makeReplayFetch.
const BODY_FILES = Object.freeze([
  path.join(__dirname, '..', 'fixtures', '363-openalex', 'bodies.json'),
  path.join(__dirname, '..', 'fixtures', '3692-openalex', 'bodies.json'),
  path.join(__dirname, '..', 'fixtures', '3692-openalex', 'seed118-bodies.json'),
]);
function mergedBodies() {
  const out = {};
  BODY_FILES.forEach(function (f) { Object.assign(out, JSON.parse(fs.readFileSync(f, 'utf8'))); });
  return out;
}

const ROUTES = Object.freeze([
  Object.freeze([/cold storage|cold locker/i, 'synonym_hits']),
  Object.freeze([/review OR survey/, 'prior_review_two']),
  // 369.2-31: the SEED-118 shaped room (tests/fixtures/release-room-seed118). Practice names hit, problem
  // names find nothing (the positive finding); the baseline row answers the deployed countermeasure that
  // contradicts the entanglement limiter; the last row is the lane B pair that matches the governing question.
  // 369.2-33: the baseline row is keyed to the strings the planner really composes for the seed118 deep set
  // (measured on plan.baseline, plan 23): the shaped governing question 'limiter binds first unlocks' bare, and with
  // the three facet suffixes. The old row matched the words deployed or countermeasure, which no baseline string holds.
  Object.freeze([/optical time domain reflectometry|powerline detection/i, 'seed118_practice_hits']),
  Object.freeze([/thin.wire detection|cable cutting/i, 'seed118_problem_zero']),
  Object.freeze([/fiber tether sensing/i, 'seed118_problem_zero']),
  Object.freeze([/^"?limiter binds first unlocks"?(?: AND \((?:success OR adoption OR "case study"|review OR survey OR "systematic review"|limitation OR failure OR "no effect")\))?$/i, 'seed118_baseline_countermeasure']),
  Object.freeze([/fibre.tethered drone/i, 'seed118_lane_b_bearing']),
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

module.exports = { route: route, ROUTES: ROUTES, bodies: mergedBodies(), BODY_FILES: BODY_FILES };
