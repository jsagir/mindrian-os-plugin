#!/usr/bin/env node
'use strict';

/*
 * Phase 252-01 Task 1 -- SWEEP-01's frozen guard census (the 248-01
 * precedent, re-verified live at execution time per the plan's binding
 * re-verification).
 * ===========================================================================
 * Precedent: tests/test-248-resolver-census.cjs (comment-stripped source
 * grep, explicit rule numbering, seam-liveness verdict aggregation via
 * lib/core/seam-liveness.cjs checkClaimedModuleLiveness). Comment-stripping
 * helper copied VERBATIM (line-comments-first order -- the block-first order
 * has a documented misfire on this repo's doc comments: a `//` header line
 * mentioning a glob path contains a literal `/*` substring that a
 * block-first pass treats as a comment open and swallows real code).
 *
 * Five rules:
 *
 *   census.1  ALLOWLIST: every file under lib/ bin/ scripts/ hooks/ with an
 *             executable (comment-stripped) match of /\b(is|ensure)Available\(/
 *             is in the frozen KEEP+CHOKEPOINT+ROUTE+CONFORM classification.
 *             An unclassified new guard file reds. tests/ excluded per
 *             SWEEP-01 (files named test-*.cjs or *.test.cjs anywhere under
 *             the scanned scope are test fixtures, not guard sites --
 *             research's own disposition table excludes
 *             lib/agents/mva/test-all-six-agents.cjs on exactly this
 *             ground: "test driver -- rides the test re-pointing pass, not
 *             the source sweep").
 *   census.2  SEAM-LIVENESS: every ROUTE-classified file that gained a
 *             refusal-messaging.cjs require during the sweep requires it on
 *             an executable line. SEAM_CLAIMS is ROUTE_SET MINUS
 *             lib/core/brain-client.cjs -- see the documented exception
 *             below (brain-client.cjs's routed obligation is the counterfeit
 *             DELETION, independently proven by census.3; it has zero
 *             remaining code path that legitimately needs the refusal rail,
 *             and its 401/403/null sentinel shapes are byte-locked by tests
 *             outside this plan's file scope -- test-247-brain-client-403.cjs,
 *             test-250-transport-retry.cjs -- so grafting an artificial
 *             require onto it would either violate census.3's counterfeit-
 *             name ban or risk those byte-locked shapes). Verdict via
 *             seam-liveness.cjs checkClaimedModuleLiveness (no override
 *             parameter exists by design).
 *   census.3  COUNTERFEIT-GONE: zero executable getTier0Chain( or
 *             getFrameworkChain( occurrences anywhere in lib/ bin/ scripts/
 *             hooks/ (this leg scans test-named files too -- the counterfeit
 *             ban is unconditional, not scoped by the test exclusion);
 *             zero executable source: 'tier0' occurrences in the same scope.
 *   census.4  FENCE HOOK: the two 250-01 doctrine phrases stay dead in
 *             skills/ commands/ agents/ dist/ (same closed 2-pattern list as
 *             tests/test-250-doctrine-fence.cjs; the living-docs scope
 *             extension itself rides plan 252-03).
 *   census.5  VOCABULARY CANARIES: lib/core/navigation-engine-shared.cjs
 *             still contains 'tier_0' (the resolveTierMode enum survives);
 *             skills/rs-experts/SKILL.md still contains 'Tier 1' (the
 *             local-mirror-vs-Aura vocabulary survives). A zealot sweep that
 *             removes either reds the census. (The third vocabulary
 *             collision -- canon:193's cold-start framing -- is 252-03's
 *             fence canary; this plan's file scope never touches
 *             MINDRIAN-CANON.md, so it is passively honored here, not
 *             re-asserted.)
 *
 * No em-dashes. CJS only. Node built-in assert only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { checkClaimedModuleLiveness } = require('../lib/core/seam-liveness.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label);
  }
}

function stripComments(src) {
  // Line comments FIRST, then block comments -- the 248-01 order (deliberately
  // the reverse of the block-first pass that misfires on this repo's own doc
  // comments containing a literal `/*` substring inside a `//` header line).
  const noLine = src
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, '');
}

function readStripped(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return stripComments(fs.readFileSync(full, 'utf8'));
}

function walk(dir, opts) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, opts));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;
    if (opts && opts.excludeTestFiles) {
      if (entry.name.endsWith('.test.cjs')) continue;
      if (entry.name.startsWith('test-')) continue;
    }
    out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Frozen classification lists (252-RESEARCH.md's per-file disposition table,
// re-enumerated by live comment-stripped grep at plan-checker-revised plan
// time 2026-08-10 against HEAD). Paths are repo-relative, forward-slash.
// ---------------------------------------------------------------------------

const ROUTE_SET = [
  'bin/mindrian-brain-mcp-client.cjs',
  'lib/mcp/brain-router.cjs',
  'lib/brain/chain-recommender.cjs',
  'scripts/brain-derive-command.cjs',
  'lib/core/brain-client.cjs',
];

const CONFORM_SET = [
  'lib/brain/framework-chain-slice.cjs',
  'lib/core/research-corpus.cjs',
  'scripts/rs-explain-command.cjs',
  'lib/core/brain-derivation.cjs',
  'lib/hmi/tier-check.cjs',
];

// Post-rename name. The census reds on the OLD name (lib/core/tier0-messaging.cjs)
// existing (see census.3-adjacent expectation in the RED-first proof; the old
// name is not itself banned by any census rule here, but Task 2 removes it via
// git mv and no code should require it any longer -- verified independently
// by the run-all-252 em-dash/require sweep, not by this file).
const CHOKEPOINT = 'lib/core/refusal-messaging.cjs';

// ~19-file KEEP set (research's "~15" is approximate; the frozen table
// itself, reviewed at plan-check, has 19 discrete files once the two
// "the two mva enrichment agents" / "build-command-registry +
// build-connector-registry" / "whitespace-to-brain + interpret-whitespace"
// parenthetical groups are expanded). One reason per entry (allowlist
// review discipline).
const KEEP_SET = [
  { path: 'scripts/part8-egress-guard-hook.cjs', reason: 'safe-state guard: unavailable = no wire = no leak; routing this would be actively wrong' },
  { path: 'scripts/intent-classifier.cjs', reason: 'Part 8 explicitly-permitted boolean scalar for routing, not a methodology serve' },
  { path: 'lib/core/opportunity-ops.cjs', reason: 'optional enrichment skip ({enriched:false}), never a methodology serve' },
  { path: 'lib/core/brain-derivation-queue.cjs', reason: 're-enqueue-on-unavailable discipline; never drops, correct queue behavior' },
  { path: 'lib/agents/mva/brain-similar-ventures.cjs', reason: 'enrichment agent; typed status:"empty", reason:"brain_unavailable"; downstream provenance-absence discloses' },
  { path: 'lib/agents/mva/brain-cross-domain.cjs', reason: 'enrichment agent; typed status:"empty", reason:"brain_unavailable"; downstream provenance-absence discloses' },
  { path: 'lib/core/brain-md-staleness.cjs', reason: 'staleness/health probe; reports availability, never serves methodology' },
  { path: 'lib/core/rs-chain-feeder.cjs', reason: 'fail-open gates a workflow step, not methodology content; stderr warn upgraded to visible refusal-vocabulary line (Task 3a)' },
  { path: 'lib/core/rs-brain-substrate.cjs', reason: 'per-site verified: genuinely gates the Brain key, not Aura (research conflation concern does not apply here)' },
  { path: 'lib/core/rs-expert-brain-projection.cjs', reason: 'per-site verified: genuinely gates the Brain key, not Aura; fail-closed by design (_brainAvailable degrades to false on any error)' },
  { path: 'lib/core/eureka/eureka-offer.cjs', reason: 'offer designed fully offline; Brain leg is optional enrichment only' },
  { path: 'scripts/backfill-correlation-id.cjs', reason: 'admin script; throws loud when unavailable' },
  { path: 'scripts/admin-brain-write.cjs', reason: 'exits 1 loud plus audit trail' },
  { path: 'scripts/fetch-brain-baseline.cjs', reason: "writes an empty baseline with explicit reason 'no-api-key'" },
  { path: 'scripts/check-dual-graph-health.cjs', reason: 'inconclusive-fail-closed' },
  { path: 'scripts/build-command-registry.cjs', reason: 'build-time script; keeps the committed snapshot, visible log' },
  { path: 'scripts/build-connector-registry.cjs', reason: 'build-time script; keeps the committed snapshot, visible log' },
  { path: 'scripts/whitespace-to-brain.cjs', reason: 'dev pipeline; visible skip' },
  { path: 'scripts/interpret-whitespace.cjs', reason: 'dev pipeline; visible skip' },
];

const CLASSIFIED = new Set([
  ...ROUTE_SET,
  ...CONFORM_SET,
  CHOKEPOINT,
  ...KEEP_SET.map((e) => e.path),
]);

// census.2's seam claim set. Documented exception: lib/core/brain-client.cjs
// is ROUTE-classified (census.1) but excluded from the seam-liveness claim
// set -- see the header docblock for the full reasoning.
const SEAM_CLAIMS = ROUTE_SET.filter((f) => f !== 'lib/core/brain-client.cjs');

function main() {
  console.log('test-252-guard-census (SWEEP-01 frozen allowlist + seam-liveness)');

  // -------------------------------------------------------------------
  // census.1 -- ALLOWLIST
  // -------------------------------------------------------------------
  const GUARD_SCAN_DIRS = ['lib', 'bin', 'scripts', 'hooks'].map((d) => path.join(REPO_ROOT, d));
  const GUARD_RE = /\b(is|ensure)Available\s*\(/;

  let scannedFiles = [];
  for (const d of GUARD_SCAN_DIRS) scannedFiles.push(...walk(d, { excludeTestFiles: true }));
  assert.ok(scannedFiles.length > 0, 'sanity: lib/bin/scripts/hooks have *.cjs files to scan');

  const unclassified = [];
  for (const f of scannedFiles) {
    const rel = path.relative(REPO_ROOT, f).split(path.sep).join('/');
    const body = stripComments(fs.readFileSync(f, 'utf8'));
    if (!GUARD_RE.test(body)) continue; // no executable is/ensureAvailable( site -- out of census.1's concern
    if (!CLASSIFIED.has(rel)) unclassified.push(rel);
  }
  check(
    'census.1: every executable is/ensureAvailable( guard site under lib/bin/scripts/hooks (excl. test files) is classified',
    unclassified.length === 0
  );
  if (unclassified.length > 0) {
    console.log('    unclassified guard files:', unclassified);
  }

  // -------------------------------------------------------------------
  // census.2 -- SEAM-LIVENESS
  // -------------------------------------------------------------------
  const REQUIRE_REFUSAL_RE = /require\(\s*['"][^'"]*refusal-messaging\.cjs['"]\s*\)/;
  const claimedModules = SEAM_CLAIMS.map((rel) => ({
    id: rel,
    live: REQUIRE_REFUSAL_RE.test(readStripped(rel)),
  }));
  const seamResult = checkClaimedModuleLiveness(claimedModules);
  check(
    'census.2: every ROUTE seam-claim file requires refusal-messaging.cjs on an executable line',
    seamResult.ok === true
  );
  if (!seamResult.ok) {
    console.log('    dead seams:', seamResult.dead);
  }

  // -------------------------------------------------------------------
  // census.3 -- COUNTERFEIT-GONE (scans test-named files too; unconditional)
  // -------------------------------------------------------------------
  let allCjsFiles = [];
  for (const d of GUARD_SCAN_DIRS) allCjsFiles.push(...walk(d, { excludeTestFiles: false }));

  const counterfeitHits = [];
  for (const f of allCjsFiles) {
    const rel = path.relative(REPO_ROOT, f).split(path.sep).join('/');
    const body = stripComments(fs.readFileSync(f, 'utf8'));
    if (/getTier0Chain\(/.test(body)) counterfeitHits.push(rel + ' :: getTier0Chain(');
    if (/getFrameworkChain\(/.test(body)) counterfeitHits.push(rel + ' :: getFrameworkChain(');
    if (/source:\s*'tier0'/.test(body)) counterfeitHits.push(rel + " :: source: 'tier0'");
  }
  check(
    'census.3: zero executable getTier0Chain(/getFrameworkChain(/source:\'tier0\' occurrences under lib/bin/scripts/hooks',
    counterfeitHits.length === 0
  );
  if (counterfeitHits.length > 0) {
    console.log('    counterfeit hits:', counterfeitHits);
  }

  // -------------------------------------------------------------------
  // census.4 -- FENCE HOOK (250-01's closed 2-pattern list, same scope)
  // -------------------------------------------------------------------
  const FORBIDDEN = [
    /silent fallback/i,
    /never mention (failures|this bookkeeping)/i,
  ];
  const FENCE_SCOPE_DIRS = ['skills', 'commands', 'agents', 'dist'];

  function walkAny(dir, out) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAny(full, out);
        continue;
      }
      if (entry.isFile() && /\.(md|cjs|js|json)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const fenceHits = [];
  for (const dirName of FENCE_SCOPE_DIRS) {
    const files = walkAny(path.join(REPO_ROOT, dirName), []);
    for (const f of files) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN) {
          if (pattern.test(line)) {
            fenceHits.push(path.relative(REPO_ROOT, f) + ':' + (idx + 1) + ' -- ' + line.trim());
          }
        }
      });
    }
  }
  check(
    'census.4: the two 250-01 doctrine phrases stay dead in skills/commands/agents/dist',
    fenceHits.length === 0
  );
  if (fenceHits.length > 0) {
    console.log('    fence hits:', fenceHits);
  }

  // -------------------------------------------------------------------
  // census.5 -- VOCABULARY CANARIES (raw text presence, not comment-stripped
  // -- these are meant to survive verbatim, comments included)
  // -------------------------------------------------------------------
  const navShared = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs');
  const navSharedHasTier0 = fs.existsSync(navShared) && fs.readFileSync(navShared, 'utf8').includes('tier_0');
  check(
    "census.5a: lib/core/navigation-engine-shared.cjs still contains 'tier_0' (resolveTierMode enum canary)",
    navSharedHasTier0
  );

  const rsExperts = path.join(REPO_ROOT, 'skills', 'rs-experts', 'SKILL.md');
  const rsExpertsHasTier1 = fs.existsSync(rsExperts) && fs.readFileSync(rsExperts, 'utf8').includes('Tier 1');
  check(
    "census.5b: skills/rs-experts/SKILL.md still contains 'Tier 1' (local-mirror-vs-Aura vocabulary canary)",
    rsExpertsHasTier1
  );

  console.log('');
  console.log('---');
  console.log(pass + '/' + (pass + fail) + ' green');
  process.exit(fail === 0 ? 0 : 1);
}

main();
