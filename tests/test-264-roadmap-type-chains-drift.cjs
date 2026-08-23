#!/usr/bin/env node
'use strict';

/**
 * Phase 264-01 -- roadmap-type-chains drift test (R2).
 *
 * data/roadmap-type-chains.json maps six roadmap-type slugs to ordered
 * framework-NAME arrays. `composeWorkflow` (lib/workflow/command-resolver.cjs)
 * turns a framework-name array into an executable command chain; a
 * smuggled command slug, a fake framework name, a seventh roadmap type, an
 * intra-chain duplicate, or a non-runnable chain must each fail CI.
 *
 * Behaviors covered (five arms, D-05 and F-08; the donor
 * tests/test-dispatch-framework-map-drift.cjs has three, this expands to five):
 *   1. dangling-name check: every framework name in every chain resolves via
 *      commandsForFramework(name) to a non-empty array. Validated against the
 *      live framework_index through commandsForFramework, NEVER against
 *      data/framework-names.json -- a name can pass a bare-name allowlist and
 *      still degrade to { command: null, optional: true } at resolve time.
 *   2. no slug smuggling: no framework name starts with "mos:" or contains
 *      "/mos:".
 *   3. shape: exactly six keys besides _note; the six are exactly the slugs
 *      landscape-analysis, technical-roadmap, pipeline-analysis,
 *      opportunity-analysis, agenda-setting-manifesto, vision-paper; every
 *      value is a non-empty array of strings.
 *   4. no intra-chain duplicate framework name (Pitfall 3). The SAME
 *      framework may legitimately appear in TWO DIFFERENT chains (Reverse
 *      Salient Analysis is in both technical-roadmap and pipeline-analysis);
 *      this arm is per-chain, never cross-chain.
 *   5. autonomy: validateChainAutonomy(composeWorkflow(chain)).runnable is
 *      true for all six, and zero steps have command === null && optional
 *      !== true.
 *
 * Also asserts the _note key exists, is a non-empty string, and points back
 * at this file (tests/test-264-roadmap-type-chains-drift.cjs) so the data
 * file always references its own fence.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHAINS_PATH = path.join(REPO_ROOT, 'data', 'roadmap-type-chains.json');

const { commandsForFramework, composeWorkflow, validateChainAutonomy } = require(
  path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs')
);

let failures = 0;
function check(cond, msg) {
  if (cond) {
    process.stdout.write('  ok  ' + msg + '\n');
  } else {
    process.stderr.write('  FAIL  ' + msg + '\n');
    failures += 1;
  }
}

const map = JSON.parse(fs.readFileSync(CHAINS_PATH, 'utf8'));

// Load-bearing: filter _note out of the key set FIRST. Without this the
// _note string is treated as a chain and fails every arm.
const types = Object.keys(map).filter(function (k) { return k !== '_note'; });

const EXPECTED_TYPES = [
  'landscape-analysis',
  'technical-roadmap',
  'pipeline-analysis',
  'opportunity-analysis',
  'agenda-setting-manifesto',
  'vision-paper',
];

// --- _note assertions -------------------------------------------------------
check(
  typeof map._note === 'string' && map._note.length > 0,
  '_note key exists and is a non-empty string'
);
check(
  typeof map._note === 'string' && map._note.includes('tests/test-264-roadmap-type-chains-drift.cjs'),
  '_note contains the literal substring tests/test-264-roadmap-type-chains-drift.cjs'
);

// --- Arm 3: shape ------------------------------------------------------------
check(types.length === 6, 'exactly six roadmap-type keys besides _note (got ' + types.length + ')');
for (const slug of EXPECTED_TYPES) {
  check(types.indexOf(slug) !== -1, 'roadmap-type slug present: "' + slug + '"');
}
for (const t of types) {
  check(EXPECTED_TYPES.indexOf(t) !== -1, 'no unexpected roadmap-type slug: "' + t + '"');
}
for (const t of types) {
  const v = map[t];
  check(Array.isArray(v) && v.length > 0, 'value for "' + t + '" is a non-empty array');
  if (Array.isArray(v)) {
    check(
      v.every(function (x) { return typeof x === 'string'; }),
      'every element of "' + t + '" is a string'
    );
  }
}

// --- Arm 1: dangling-name check + Arm 2: no slug smuggling ------------------
for (const t of types) {
  const chain = Array.isArray(map[t]) ? map[t] : [];
  for (const fw of chain) {
    if (typeof fw !== 'string') continue;
    check(
      commandsForFramework(fw).length > 0,
      'framework name resolves via commandsForFramework (non-empty): "' + t + '" -> "' + fw + '"'
    );
    check(
      !fw.startsWith('mos:') && !fw.includes('/mos:'),
      'no slug smuggled in framework name: "' + t + '" -> "' + fw + '"'
    );
  }
}

// --- Arm 4: no intra-chain duplicate framework name (Pitfall 3) -------------
for (const t of types) {
  const chain = Array.isArray(map[t]) ? map[t] : [];
  const seen = new Set();
  let dup = false;
  for (const fw of chain) {
    if (seen.has(fw)) { dup = true; break; }
    seen.add(fw);
  }
  check(!dup, 'no intra-chain duplicate framework name in "' + t + '"');
}

// --- Arm 5: autonomy ----------------------------------------------------------
for (const t of types) {
  const chain = Array.isArray(map[t]) ? map[t] : [];
  const wf = composeWorkflow(chain);
  const requiredNulls = wf.filter(function (s) { return s.command === null && s.optional !== true; });
  check(requiredNulls.length === 0, 'zero required-null-command steps in "' + t + '"');
  check(
    validateChainAutonomy(wf).runnable === true,
    'validateChainAutonomy(composeWorkflow(chain)).runnable === true for "' + t + '"'
  );
}

if (failures > 0) {
  process.stderr.write('roadmap-type-chains drift: ' + failures + ' FAILURE(S)\n');
  process.exit(1);
}
process.stdout.write('roadmap-type-chains drift: PASS (' + types.length + ' roadmap types)\n');
process.exit(0);
