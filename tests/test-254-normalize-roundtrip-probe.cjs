#!/usr/bin/env node
'use strict';

/**
 * Phase 254 Plan 05 (D-06) -- the normalize_framework_name round-trip probe,
 * HERMETIC leg.
 * ==========================================================================
 * D-06 (254-CONTEXT.md): the composition wave touches a live Brain call, so
 * Phase 262's D-07 finding (clean PROJECTION, 0 corrupted names) is NOT
 * sufficient here -- a composed call reads the LIVE `:Framework` population,
 * where the traced hop-depth-1 `ALIAS_OF` fork
 * (`normalize_framework_name({raw:'Scenario Planning'})` returning TWO
 * "canonical" matches, docs/262-FLOOR-01-GAP-LEDGER.md section 6) still
 * lives. This suite is the hermetic half of the two-leg probe: it hard-gates
 * the ONE existing consumer's non-guessing behaviour. The live half is
 * tests/test-254-live-normalize-probe.sh (measures the current population,
 * SKIPs honestly when keyless/unreachable, never hard-gates on a Brain-repo
 * defect).
 *
 * Five arms, always run (hard gate, no SKIP path):
 *   Arm 1 - retry firing condition (structural): normalizeFrameworkName is
 *           called only inside adaptChainToRunInput's local-miss branch.
 *   Arm 2 - the alias-fork non-guess (load-bearing): a scripted TWO-match
 *           canonical_matches response (the real measured incumbent shape)
 *           does not make the consumer guess -- original name preserved,
 *           name marked unmapped, no invented canonical string anywhere.
 *   Arm 3 - worklist derivation: the projection's framework names for which
 *           the local registry has no commands, printed (never size-pinned).
 *   Arm 4 - BRAIN_PROBLEM_TYPE_ALIASES pin: 8 keys project onto the 3
 *           incumbent canonical names; an unknown well-shaped token passes
 *           through unchanged (proven structurally, see Arm 4's own
 *           comment for the stated decision on why this map is NOT
 *           re-pointed to Theo's ids in this phase).
 *   Arm 5 - map separation: BRAIN_PROBLEM_TYPE_ALIASES's values and
 *           chain-recommender.cjs's PROBLEM_TYPE_ALIASES's values are
 *           disjoint sets.
 *
 * Object-literal / function-body extraction is real source text sliced by
 * brace-matching, then evaluated via `Function(...)` for the (pure,
 * side-effect-free, plain string-keyed) data literals only -- never for
 * live behavior. This mirrors tests/test-239-query-egress-canary.cjs's
 * `extractFunctionBody` "structural proof over real source" precedent, one
 * step further for the two frozen alias maps this arm needs to read without
 * brain-client.cjs exporting them (Task 2's own instruction: do not touch
 * BRAIN_PROBLEM_TYPE_ALIASES / _normalizeBrainProblemType, and this task's
 * own files_modified excludes lib/core/brain-client.cjs entirely).
 *
 * Hand-rolled record()/failed-counter runner, not node:test (mirrors
 * tests/test-254-ambiguous-disclosure.cjs and tests/run-all-254.sh's own
 * header convention for this phase's suites).
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const {
  startCaptureServer,
  stopCaptureServer,
  resetCaptured,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');

const brainClientPath = path.resolve(REPO, 'lib', 'core', 'brain-client.cjs');
const chainRecommenderPath = path.resolve(REPO, 'lib', 'brain', 'chain-recommender.cjs');
const commandResolverPath = path.resolve(REPO, 'lib', 'workflow', 'command-resolver.cjs');
const projectionPath = path.resolve(REPO, 'data', 'brain-orchestration-projection.json');

// ---------------------------------------------------------------------------
// Source-extraction helpers. Pure text slicing over real source (brace-
// matched, not a parser), the extractFunctionBody(...) precedent from
// tests/test-239-query-egress-canary.cjs taken one step further: the two
// data-literal extractions are evaluated (safe -- plain string-keyed object
// literals, zero function calls inside), the function-body extraction stays
// text-only and is asserted against structurally, never executed.
// ---------------------------------------------------------------------------
function extractBraceBlock(src, marker) {
  const startIdx = src.indexOf(marker);
  assert.ok(startIdx !== -1, 'marker not found in source: ' + marker);
  const braceStart = src.indexOf('{', startIdx);
  assert.ok(braceStart !== -1, 'no opening brace after marker: ' + marker);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  assert.strictEqual(depth, 0, 'unbalanced braces extracting: ' + marker);
  return { full: src.slice(startIdx, i), braceOnly: src.slice(braceStart, i) };
}

function extractObjectLiteral(src, declMarker) {
  const { braceOnly } = extractBraceBlock(src, declMarker);
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + braceOnly + ');')();
}

function extractFunctionBody(src, fnSignaturePrefix) {
  return extractBraceBlock(src, fnSignaturePrefix).full;
}

function sseBody(obj) {
  return (
    'data: ' +
    JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: JSON.stringify(obj) }] },
    }) +
    '\n'
  );
}

function freshChainRecommender(url) {
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
  delete require.cache[brainClientPath];
  delete require.cache[chainRecommenderPath];
  return require(chainRecommenderPath);
}

async function main() {
  let failed = 0;
  const record = (name, fn) => {
    try {
      fn();
      process.stdout.write('  ok  ' + name + '\n');
    } catch (err) {
      failed += 1;
      process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
    }
  };
  const recordAsync = async (name, fn) => {
    try {
      await fn();
      process.stdout.write('  ok  ' + name + '\n');
    } catch (err) {
      failed += 1;
      process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
    }
  };

  process.stdout.write('Phase 254-05 (D-06) normalize round-trip probe -- HERMETIC leg\n');

  const chainRecommenderSrc = fs.readFileSync(chainRecommenderPath, 'utf8');
  const brainClientSrc = fs.readFileSync(brainClientPath, 'utf8');

  // -------------------------------------------------------------------------
  // Arm 1: retry firing condition (structural).
  // -------------------------------------------------------------------------
  record('Arm 1: normalizeFrameworkName fires only inside the local-miss branch', () => {
    const body = extractFunctionBody(chainRecommenderSrc, 'async function adaptChainToRunInput(');
    const callCount = body.split('normalizeFrameworkName(').length - 1;
    assert.strictEqual(callCount, 1, 'expected exactly one normalizeFrameworkName( call site');

    const ifMarker = 'if (localCommands.length === 0) {';
    const ifIdx = body.indexOf(ifMarker);
    assert.ok(ifIdx !== -1, 'adaptChainToRunInput must gate the retry behind localCommands.length === 0');
    const ifBraceStart = body.indexOf('{', ifIdx);
    let depth = 0;
    let ifEnd = ifBraceStart;
    for (; ifEnd < body.length; ifEnd += 1) {
      if (body[ifEnd] === '{') depth += 1;
      else if (body[ifEnd] === '}') { depth -= 1; if (depth === 0) { ifEnd += 1; break; } }
    }
    const callIdx = body.indexOf('normalizeFrameworkName(');
    assert.ok(
      callIdx > ifBraceStart && callIdx < ifEnd,
      'normalizeFrameworkName( must be called strictly INSIDE the local-miss if-block ' +
        '(callIdx=' + callIdx + ', block=[' + ifBraceStart + ',' + ifEnd + '))'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 2: the alias-fork non-guess (load-bearing).
  // -------------------------------------------------------------------------
  const { server, url } = await startCaptureServer();
  const RAW_NAME = 'Scenario Planning Methodology'; // the real Phase 262-traced node-18880 name; empty locally.
  const FORK_MATCHES = ['Shell Scenario Planning Method', 'Scenario planning methodology']; // measured 2026-09-02, docs/262-FLOOR-01-GAP-LEDGER.md section 6.

  const commandResolverPre = require(commandResolverPath);
  assert.strictEqual(
    commandResolverPre.commandsForFramework(RAW_NAME).length,
    0,
    'fixture precondition: RAW_NAME must be locally unresolved so the retry actually fires'
  );

  await recordAsync('Arm 2: a two-match alias fork never makes the consumer guess', async () => {
    const chainRecommender = freshChainRecommender(url);
    resetCaptured();
    resetToolScript();
    setToolScript([
      {
        status: 200,
        body: sseBody({
          tool: 'normalize_framework_name',
          backend: 'incumbent',
          grounded: true,
          note: 'test fixture: the measured hop-depth-1 ALIAS_OF fork shape',
          canonical_matches: FORK_MATCHES,
        }),
      },
    ]);

    const result = await chainRecommender.adaptChainToRunInput([{ framework: RAW_NAME, commands: [] }]);

    assert.deepStrictEqual(result.chain_input, [RAW_NAME], 'the ORIGINAL name must survive, never a guessed canonical');
    assert.deepStrictEqual(result.unmapped, [RAW_NAME], 'the name must be marked unmapped, never silently dropped');
    const wire = JSON.stringify(result);
    for (const invented of FORK_MATCHES) {
      assert.ok(!wire.includes(invented), 'no fork candidate may appear anywhere in the result: ' + invented);
    }
    resetToolScript();
  });

  await stopCaptureServer(server);

  // -------------------------------------------------------------------------
  // Arm 3: worklist derivation.
  // -------------------------------------------------------------------------
  record('Arm 3: the live-composed-call worklist is computed and printed', () => {
    const commandResolver = require(commandResolverPath);
    delete require.cache[projectionPath];
    const projection = require(projectionPath);
    const pwsNames = (projection.nodes || [])
      .filter((n) => n && n.methodology_tier === 'pws' && typeof n.name === 'string')
      .map((n) => n.name);
    assert.ok(pwsNames.length > 0, 'the projection must carry at least one pws framework node');

    const worklist = pwsNames.filter((name) => commandResolver.commandsForFramework(name).length === 0);

    process.stdout.write(
      '    Arm 3 worklist (' + worklist.length + ' of ' + pwsNames.length + ' projection names unresolved locally): ' +
        JSON.stringify(worklist) + '\n'
    );

    // Pitfall 8: do not pin the size. Only assert the set is genuinely
    // "unresolved locally" -- the exact property that would trigger
    // adaptChainToRunInput's normalizeFrameworkName retry for each name.
    for (const name of worklist) {
      assert.strictEqual(
        commandResolver.commandsForFramework(name).length,
        0,
        'every worklist entry must independently re-verify as locally unresolved: ' + name
      );
    }
  });

  // -------------------------------------------------------------------------
  // Arm 4: BRAIN_PROBLEM_TYPE_ALIASES pin.
  // -------------------------------------------------------------------------
  record('Arm 4: BRAIN_PROBLEM_TYPE_ALIASES pin + unknown-token pass-through', () => {
    // STATED DECISION (D-07, this phase's Wave 1 budget call): the map is
    // NOT re-pointed to Theo's live DomainConcept ids (UnDefined, IllDefined,
    // WellDefined, Wicked, Trinity, Compass) in this phase. Theo's live ids
    // and the incumbent's three canonical names ('Undefined Problem' /
    // 'Ill-Defined Problem' / 'Well-Defined Problem') share no single value,
    // so no re-point satisfies both. The standing rule is to plan and ship
    // against the CURRENT Brain (Theo is not deployable: no remote hosting
    // story, its own Phase 08.4 not started). Re-pointing today would trade
    // a live regression for a future convenience that is not live yet.
    // Removing the map entirely is worse: an unmapped 'udp' would pass
    // through unchanged as 'udp' and go honest-empty on the incumbent too,
    // which is strictly worse than the current projection. So the map is
    // PINNED here (this arm + Arm 5) and named as a Theo-side follow-up in
    // Plan 06's Theo note, with the exact incumbent-to-Theo mapping written
    // down, turning a future rediscovery into a single-line diff.
    const map = extractObjectLiteral(brainClientSrc, 'const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze(');
    const keys = Object.keys(map);
    assert.strictEqual(keys.length, 8, 'BRAIN_PROBLEM_TYPE_ALIASES must carry exactly its 8 known keys');

    const canonicalTargets = new Set(Object.values(map));
    assert.deepStrictEqual(
      Array.from(canonicalTargets).sort(),
      ['Ill-Defined Problem', 'Undefined Problem', 'Well-Defined Problem'],
      'the 8 keys must project onto exactly the 3 incumbent canonical names'
    );

    // Unknown-token pass-through, proven STRUCTURALLY (not by invoking the
    // unexported private function -- this task's files_modified excludes
    // lib/core/brain-client.cjs, so the function stays untouched and
    // unexported; a structural proof over its real source is the correct
    // tool here, mirroring test-239's LEG 5 source-order precedent).
    const body = extractFunctionBody(brainClientSrc, 'function _normalizeBrainProblemType(raw) {');
    const aliasLookupIdx = body.indexOf('BRAIN_PROBLEM_TYPE_ALIASES[lc]');
    const finalPassThroughIdx = body.lastIndexOf('return trimmed;');
    assert.ok(aliasLookupIdx !== -1, '_normalizeBrainProblemType must still look up BRAIN_PROBLEM_TYPE_ALIASES[lc]');
    assert.ok(finalPassThroughIdx !== -1, '_normalizeBrainProblemType must still carry the pass-through return trimmed;');
    assert.ok(
      finalPassThroughIdx > aliasLookupIdx,
      'the pass-through return must come AFTER the alias lookup, proving an unknown token falls through unchanged ' +
        'rather than being coerced or dropped'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 5: map separation preserved.
  // -------------------------------------------------------------------------
  record('Arm 5: BRAIN_PROBLEM_TYPE_ALIASES and chain-recommender PROBLEM_TYPE_ALIASES stay disjoint', () => {
    const brainMap = extractObjectLiteral(brainClientSrc, 'const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze(');
    const localMap = extractObjectLiteral(chainRecommenderSrc, 'const PROBLEM_TYPE_ALIASES = Object.freeze(');

    const brainVals = new Set(Object.values(brainMap));
    const localVals = new Set(Object.values(localMap));
    const overlap = Array.from(brainVals).filter((v) => localVals.has(v));

    assert.deepStrictEqual(
      overlap,
      [],
      'the two maps must never share a value -- a Brain node-name target and a local UDP/IDP/WDP router code ' +
        'must not be conflatable by a future edit'
    );
    process.stdout.write(
      '    Arm 5: brain-client values=' + JSON.stringify(Array.from(brainVals)) +
        ' chain-recommender values=' + JSON.stringify(Array.from(localVals)) + ' overlap=[]\n'
    );
  });

  process.stdout.write(
    '\nPhase 254-05 normalize round-trip probe (hermetic): ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
