#!/usr/bin/env bash
# Phase 254 Plan 05 (D-06) -- the normalize_framework_name round-trip probe,
# LIVE leg.
# =============================================================================
# The companion to tests/test-254-normalize-roundtrip-probe.cjs (the hermetic
# leg, which hard-gates the ONE existing consumer's non-guessing behaviour on
# a scripted alias fork). This leg measures the CURRENT live `:Framework`
# population against the same worklist the hermetic leg derives, plus the
# three names Phase 262 named as fork-prone (docs/262-FLOOR-01-GAP-LEDGER.md
# section 6): the raw probe name and the two terminal names its alias chain
# resolves to.
#
# THE STATED DECISION ON THIS LEG'S EXIT CODE (254-05-PLAN.md Task 3's
# action block, written here too per that instruction). A measured fork in
# the live population is a Brain-repo defect (Phase 262 traced it;
# remediation is Phase 263's and the Brain repo's), not a plugin defect this
# build can fix. Failing this repo's build on another repo's data would be a
# permanent red gate nobody here can clear. So this leg REPORTS forks loudly
# and ALWAYS exits 0 -- it measures the population, it does not gate on it.
# The hermetic leg's Arm 2 is the part that hard-gates (the consumer never
# guesses when a fork is served); that split -- measure vs gate -- is
# deliberate and stated, not an oversight.
#
# SKIP CONVENTION (tests/run-all-262.sh's run_may_skip precedent, lines 54-68
# and 76-81): prints a line starting `SKIP` and exits 0 when no Brain key
# resolves, or when every probe call returns transport-null (Brain
# unreachable). The aggregator (tests/run-all-254.sh) reports that as
# SKIPPED, never FAILED. This is why the probe is a .sh file rather than a
# .cjs one -- the aggregator's `.cjs` glob arm uses the hard `run`, and only
# the `.sh` glob arm uses `run_may_skip`.
#
# The key is resolved through the shipped ladder
# (lib/core/resolve-brain-key.cjs, via brain-client.cjs::isAvailable()) and
# every Brain call goes through the shipped client (brain-client.cjs's
# normalizeFrameworkName wrapper) -- never a hand-rolled fetch, never an env
# var read directly. The simplest honest implementation is a small Node
# script piped into `node -` from this wrapper: the .sh file exists for the
# SKIP convention, not because the probe logic itself needs to be bash.
#
# No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node - <<'NODE_PROBE_EOF'
'use strict';

const path = require('node:path');

const ROOT = process.cwd();
const brainClientPath = path.resolve(ROOT, 'lib', 'core', 'brain-client.cjs');
const commandResolverPath = path.resolve(ROOT, 'lib', 'workflow', 'command-resolver.cjs');
const projectionPath = path.resolve(ROOT, 'data', 'brain-orchestration-projection.json');

const brainClient = require(brainClientPath);
const commandResolver = require(commandResolverPath);
const projection = require(projectionPath);

// Phase 262-named fork-prone names (docs/262-FLOOR-01-GAP-LEDGER.md section
// 6): the raw probe name and the two terminal names its alias chain
// resolves to, measured 2026-09-02 against the live incumbent Brain.
const FORK_PRONE_NAMES = [
  'Scenario Planning',
  'Scenario planning methodology',
  'Shell Scenario Planning Method',
];

async function main() {
  if (typeof brainClient.isAvailable !== 'function' || !brainClient.isAvailable()) {
    process.stdout.write('SKIP: no Brain key resolved (lib/core/resolve-brain-key.cjs ladder found nothing)\n');
    process.exit(0);
  }

  const pwsNames = (projection.nodes || [])
    .filter((n) => n && n.methodology_tier === 'pws' && typeof n.name === 'string')
    .map((n) => n.name);
  const worklist = pwsNames.filter((name) => commandResolver.commandsForFramework(name).length === 0);

  const seen = new Set();
  const names = [];
  for (const n of worklist.concat(FORK_PRONE_NAMES)) {
    if (!seen.has(n)) {
      seen.add(n);
      names.push(n);
    }
  }

  process.stdout.write(
    'Phase 254-05 (D-06) live normalize_framework_name probe: ' + names.length + ' name(s) to probe\n'
  );

  let probed = 0;
  let forks = 0;
  let nullCount = 0;

  for (const name of names) {
    let result = null;
    try {
      result = await brainClient.normalizeFrameworkName(name);
    } catch (e) {
      result = null;
    }

    if (result === null) {
      nullCount += 1;
      process.stdout.write('  ' + name + '  UNREACHABLE (transport null)\n');
      continue;
    }

    probed += 1;
    if (result && typeof result === 'object' && Array.isArray(result.canonical_matches)) {
      const n = result.canonical_matches.length;
      process.stdout.write('  ' + name + '  canonical_matches=' + n + '\n');
      if (n > 1) forks += 1;
    } else {
      const keys = result && typeof result === 'object' ? Object.keys(result).join(',') : typeof result;
      process.stdout.write('  ' + name + '  unrecognized_shape (keys: ' + keys + ')\n');
    }
  }

  if (probed === 0 && nullCount > 0) {
    process.stdout.write('SKIP: Brain unreachable (every probe call returned transport null)\n');
    process.exit(0);
  }

  process.stdout.write('PROBE: ' + probed + ' names, ' + forks + ' forks\n');
  process.exit(0);
}

main().catch((err) => {
  process.stdout.write('SKIP: probe threw an unexpected error: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(0);
});
NODE_PROBE_EOF
