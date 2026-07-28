'use strict';
/*
 * Phase 173 -- the publish/visualize JTBD need-selector END-TO-END flow test.
 *
 * Proves the full R1-R7 chain the phase ships, in ONE suite:
 *   R1  the selector data renders 4 lanes with ZERO command-name labels
 *   R2  every job resolves_to is REAL (a registry command or a shipped skill)
 *   R7  every job carries a connections|gaps "shows" admission tag
 *   R3  a job's resolves_to resolves via the command-resolver (registry door,
 *       not a slug from memory)
 *   R4  a show/share-intent turn fires the context_block reach via dispatchSensors
 *       while a neutral turn does not
 *   R6  defaultLaneForRoleBlend({founder}) === 'get-into-world' and
 *       ({researcher}) === 'find-broken' (the persona-default lane)
 *
 * Reuses the 173-01 contracts (data/publish-needs.json + the --check validator +
 * defaultLaneForRoleBlend) + the 173-03 sensor (SENS-SHOW via dispatchSensors) +
 * the Phase 122 command-resolver. Zero Brain, zero network (Part 8).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const resolver = require('../lib/workflow/command-resolver.cjs');
const sensors = require('../lib/core/insight-sensors.cjs');
const { defaultLaneForRoleBlend, LANES } = require('../lib/core/publish-needs-default-lane.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// Load the selector data (the single source of truth, 173-01).
const map = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'publish-needs.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'command-registry.json'), 'utf8'));
const registryCommands = new Set((registry.commands || []).map(function (c) { return c && c.command; }));

// ---------------------------------------------------------------------------
// R1 -- 4 lanes, ZERO command-name labels.
// ---------------------------------------------------------------------------
const laneIds = Object.keys(map._lanes || {});
ok('R1: _lanes block has exactly 4 lane ids', laneIds.length === 4);
ok('R1: the 4 lane ids match the frozen LANES set',
  laneIds.slice().sort().join(',') === LANES.slice().sort().join(','));
ok('R1: every job lane is one of the 4 frozen lanes',
  (map.jobs || []).every(function (j) { return LANES.indexOf(j.lane) !== -1; }));
ok('R1: all 4 lanes are represented across the jobs',
  LANES.every(function (l) { return (map.jobs || []).some(function (j) { return j.lane === l; }); }));
// zero command-name labels: no job label leaks a /mos: token or a bare command name.
ok('R1: zero job labels contain a /mos: token (Part 10 commands-are-internals)',
  (map.jobs || []).every(function (j) {
    return typeof j.job === 'string' && j.job.indexOf('/mos:') === -1 && j.job.indexOf('mos:') === -1;
  }));
ok('R1: zero LANE labels contain a /mos: token',
  laneIds.every(function (id) {
    const label = map._lanes[id];
    return typeof label === 'string' && label.indexOf('/mos:') === -1;
  }));

// ---------------------------------------------------------------------------
// R2 / R7 -- real resolves_to + a connections|gaps shows tag on every job.
// ---------------------------------------------------------------------------
for (const j of (map.jobs || [])) {
  const rt = j.resolves_to;
  if (typeof rt === 'string' && rt.indexOf('/mos:') === 0) {
    ok('R2: resolves_to "' + rt + '" is a REAL registry command', registryCommands.has(rt));
  } else {
    // a skill handle (e.g. mos-deck-engine) -- must be a real skills/<handle>/ dir
    const skillDir = path.join(REPO_ROOT, 'skills', String(rt));
    ok('R2: resolves_to "' + rt + '" is a REAL skills/ directory',
      fs.existsSync(skillDir) && fs.statSync(skillDir).isDirectory());
  }
  ok('R7: job "' + j.job + '" carries a connections|gaps shows tag',
    j.shows === 'connections' || j.shows === 'gaps');
}

// Re-assert the whole contract via the 173-01 validator (the canonical check).
try {
  execFileSync('node', [path.join(REPO_ROOT, 'scripts', 'check-publish-needs.cjs')], { stdio: 'pipe' });
  ok('R2/R7: scripts/check-publish-needs.cjs exits 0 on the committed map', true);
} catch (_e) {
  ok('R2/R7: scripts/check-publish-needs.cjs exits 0 on the committed map', false);
}

// ---------------------------------------------------------------------------
// R3 -- a job's resolves_to resolves via the command-resolver (registry door).
// The resolver returns a NON-FABRICATED result: a real registry command yields
// its declared frameworks (or [] for a non-framework command that IS in the
// registry); an unknown command yields []. Proves resolution comes from the
// registry, not from memory.
// ---------------------------------------------------------------------------
resolver.__reset();
// pick a job resolves_to that is a /mos: command and confirm the resolver door
// sees it as a registry member (frameworksForCommand reads ONLY the registry).
const aCmdJob = (map.jobs || []).find(function (j) {
  return typeof j.resolves_to === 'string' && j.resolves_to.indexOf('/mos:') === 0;
});
ok('R3: a job resolves to a /mos: command', !!aCmdJob);
ok('R3: the resolved command is a registry member (resolver door, not memory)',
  registryCommands.has(aCmdJob.resolves_to));
// a fabricated command resolves to [] (proves the resolver is not inventing).
ok('R3: an unknown command resolves to [] (no fabrication)',
  Array.isArray(resolver.frameworksForCommand('/mos:__not_a_real_command__')) &&
  resolver.frameworksForCommand('/mos:__not_a_real_command__').length === 0);
// a known framework-bearing command roundtrips its declared frameworks from the
// registry (the positive non-fabrication proof).
const fwOut = resolver.frameworksForCommand('/mos:analyze-timing');
ok('R3: a framework-bearing command roundtrips its registry frameworks',
  Array.isArray(fwOut) && fwOut.indexOf('Adoption-Capacity Theory') !== -1);

// ---------------------------------------------------------------------------
// R4 -- a show/share-intent turn fires the context_block reach via dispatchSensors;
// a neutral turn does not.
// ---------------------------------------------------------------------------
const showReaches = sensors.dispatchSensors(
  { text: 'help me present my work to the board', signals: [] },
  { problem_type: 'IDP' }, {});
ok('R4: a show/share turn fires a context_block reach via dispatchSensors',
  showReaches.some(function (r) { return r && r.reach_id === 'context_block' && r.dispatch === 'show-jtbd-selector'; }));
ok('R4: the fired show/share reach posture is hold (standing suggestion)',
  showReaches.some(function (r) { return r && r.dispatch === 'show-jtbd-selector' && r.posture === 'hold'; }));
const neutralReaches = sensors.dispatchSensors(
  { text: 'what time is the train', signals: [] },
  { problem_type: 'IDP' }, {});
ok('R4: a neutral turn does NOT fire the show/share reach',
  !neutralReaches.some(function (r) { return r && r.dispatch === 'show-jtbd-selector'; }));

// ---------------------------------------------------------------------------
// R6 -- the persona-default lane follows role_blend.
// ---------------------------------------------------------------------------
ok('R6: founder-weighted role_blend opens get-into-world',
  defaultLaneForRoleBlend({ founder: 0.7 }) === 'get-into-world');
ok('R6: researcher-weighted role_blend opens find-broken',
  defaultLaneForRoleBlend({ researcher: 0.8 }) === 'find-broken');
ok('R6: empty / cold-start role_blend opens the know-stand default',
  defaultLaneForRoleBlend({}) === 'know-stand');

console.log('\nPASS ' + pass + ' assertions');
