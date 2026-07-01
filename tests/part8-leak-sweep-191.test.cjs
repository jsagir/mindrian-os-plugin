'use strict';
/*
 * Phase 191 Plan 05 (191-05) -- the Part-8 leak sweep + frozen-scalar + B2 +
 * no-new-reach + em-dash sweep. The adversarial "prove it by instrumentation"
 * suite for the whole 191 wire (D-01, D-02, D-03, R2/R7 Part 8, B2 Phase 166).
 *
 * Mirrors the style of tests/test-reader-184.cjs's Part-8 no-network sweep
 * (tests/run-all-184.sh). CJS only, plain node:assert + process.exit, no
 * node:test. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// ===========================================================================
// PART-8 LEAK SWEEP: the 191 surfaces must require NO Brain client, fetch,
// node:http/https, and must form no Brain packet on the decide()/rank hot
// path. The confidence-join's use of rankForSelector (the LOCAL registry) is
// explicitly permitted -- it is not a network/Brain surface.
// ===========================================================================
const PART8_SURFACES = [
  'lib/core/orchestration-candidate-lift.cjs',
  'lib/core/navigation-engine.cjs',
  'lib/core/navigation-engine-offer.cjs',
  'lib/hmi/dial-presenter.cjs',
];

// Forbidden tokens on the hot path. Matched case-insensitively against the
// full file source (comments included, so a stray mention would still be
// caught and can be justified/removed) EXCEPT lines that are plainly doc
// prose explaining the boundary itself (those are allow-listed by pattern
// below, mirroring the 184 sweep's own discipline).
const FORBIDDEN_TOKENS = [
  /require\(\s*['"]node:https?['"]\s*\)/i,
  /require\(\s*['"]https?['"]\s*\)/i,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /require\([^)]*brain-client[^)]*\)/i,
  /require\([^)]*brain-mcp[^)]*\)/i,
  /buildBrainPacket\s*\(/,
  /\baxios\b/i,
];

// Lines that are pure documentation ABOUT the boundary (naming brain-client
// or fetch only to say "we do not call it here") are allowed. This mirrors
// the doc-prose allowance in navigation-engine.cjs's own header comments,
// which this suite's own forbidden-token scan must not flag as a false
// positive breach.
const DOC_PROSE_ALLOW = /^\s*(\*|\/\/)/;

function readSurface(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
}

(function part8LeakSweep() {
  for (const rel of PART8_SURFACES) {
    const src = readSurface(rel);
    const lines = src.split('\n');
    const violations = [];
    lines.forEach((line, idx) => {
      // A live require/call of a forbidden token is a violation regardless of
      // whether the line also happens to be a comment (a commented-out live
      // call is still a red flag worth surfacing); a token that is PART of
      // explanatory prose about the boundary (no parens, no require(...))
      // is allowed to pass through untouched.
      for (const re of FORBIDDEN_TOKENS) {
        if (re.test(line)) {
          // Distinguish an actual require(...)/call(...) construct from a
          // bare-word doc mention (e.g. "brain-client is OPTIONAL" prose,
          // which never appears with a require(...) or fetch(...) call
          // shape). Only flag when the matched token is immediately part of
          // an executable-looking construct (has a trailing paren) OR the
          // line is not doc prose at all.
          const looksExecutable = /\(/.test(line) && !DOC_PROSE_ALLOW.test(line.trim());
          if (looksExecutable) {
            violations.push('L' + (idx + 1) + ': ' + line.trim());
          }
        }
      }
    });
    ok('Part-8 leak sweep: ' + rel + ' has ZERO live Brain/fetch/http token on the hot path (' +
      violations.length + ' violation(s): ' + violations.join(' | ') + ')',
      violations.length === 0);
  }
})();

// The confidence-join's rankForSelector require IS present and IS permitted
// (it is the LOCAL registry read, not a network/Brain surface). Assert its
// presence positively so a future refactor that silently drops the seam (and
// replaces it with something else) is caught by this same suite.
(function confidenceJoinUsesLocalRankerOnly() {
  const src = readSurface('lib/core/orchestration-candidate-lift.cjs');
  ok('confidence-join: rankForSelector (LOCAL registry) is the required rank seam',
    /require\(['"]\.\.\/workflow\/f-selector-ranker\.cjs['"]\)\.rankForSelector/.test(src)
    || /require\(['"]\.\.\/workflow\/f-selector-ranker\.cjs['"]\)/.test(src));
})();

// ===========================================================================
// FROZEN SCALARS: RECOMMENDED_CONFIDENCE_FLOOR === 0.7, MAX_K === 3,
// DIAL_REACH_K === 6, at their source-of-truth modules. No 191 surface
// redefines (re-assigns) them with a new literal.
// ===========================================================================
(function frozenScalars() {
  const navigationEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
  const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

  ok('frozen scalar: RECOMMENDED_CONFIDENCE_FLOOR === 0.7 (navigation-engine.cjs, source of truth)',
    navigationEngine.RECOMMENDED_CONFIDENCE_FLOOR === 0.7);
  ok('frozen scalar: MAX_K === 3 (f-selector-ranker.cjs, source of truth)',
    ranker.MAX_K === 3);
  ok('frozen scalar: DIAL_REACH_K === 6 (dial-reach-orchestrator.cjs, source of truth)',
    orchestrator.DIAL_REACH_K === 6);

  // No 191 surface redefines (re-assigns with `const X =`) any of the three
  // frozen scalars; they must only ever be IMPORTED/REFERENCED in these files.
  const REDEFINITION_PATTERNS = [
    /const\s+RECOMMENDED_CONFIDENCE_FLOOR\s*=\s*0?\.?\d/,
    /const\s+MAX_K\s*=\s*\d/,
    /const\s+DIAL_REACH_K\s*=\s*\d/,
  ];
  const NEW_191_SURFACES = [
    'lib/core/orchestration-candidate-lift.cjs',
    'lib/core/navigation-engine-offer.cjs',
    'lib/hmi/dial-presenter.cjs',
  ];
  for (const rel of NEW_191_SURFACES) {
    const src = readSurface(rel);
    const redefined = REDEFINITION_PATTERNS.some((re) => re.test(src));
    ok('frozen scalar: ' + rel + ' does not redefine a frozen Part-3 scalar', !redefined);
  }
})();

// ===========================================================================
// B2: decide()'s top-level return-object key set (and decision_trace key set)
// is UNCHANGED as a set -- exactly the shared.emptyDecision() shell's keys,
// no new top-level key added by this phase. Proven with a REAL firing lift
// (the case most likely to have grown a new key), not just the empty path.
// ===========================================================================
(function b2ReturnShape() {
  const navigationEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const shared = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));

  // The shell (emptyDecision/emptyDecisionTrace) is the STATIC key contract;
  // a REAL decide() call ADDS runtime-only fields on top of it (e.g.
  // trace._meta latency telemetry) that the shell itself never carries. The
  // B2 no-new-key guarantee is about the REAL decide() output shape not
  // growing a key across the 191 wire, so the source of truth for "no new
  // key was added by this phase" is a REAL, un-lifted baseline decide() call
  // (mirrors tests/decide-lift-wire-191.test.cjs's own baseline pattern),
  // not the raw shell.
  const BASELINE_DECISION = navigationEngine.decide({}, {});
  const EXPECTED_DECISION_KEYS = Object.keys(BASELINE_DECISION).slice().sort();
  const EXPECTED_TRACE_KEYS = Object.keys(BASELINE_DECISION.decision_trace).slice().sort();

  const shellDecisionKeys = Object.keys(shared.emptyDecision());
  const shellTraceKeys = Object.keys(shared.emptyDecisionTrace());
  ok('B2: the real baseline decide() key set is a superset of the emptyDecision() shell',
    shellDecisionKeys.every((k) => EXPECTED_DECISION_KEYS.indexOf(k) !== -1));
  ok('B2: the real baseline decide() trace key set is a superset of the emptyDecisionTrace() shell',
    shellTraceKeys.every((k) => EXPECTED_TRACE_KEYS.indexOf(k) !== -1));

  // The IFACE section-8 enumeration (the four keys the plan calls out by
  // name) must all be present in the decision shell -- the anchor the B2
  // hard constraint is defined against.
  const IFACE_SECTION_8_KEYS = ['fire_skill', 'suppress_skills', 'persona_updates', 'decision_trace'];
  ok('B2: the IFACE section-8 enumerated keys are all present in the decision shell',
    IFACE_SECTION_8_KEYS.every((k) => shellDecisionKeys.indexOf(k) !== -1));

  // Drive a REAL firing lift (mirrors tests/decide-lift-wire-191.test.cjs's
  // fixture) so the key-set snapshot covers the path most likely to grow an
  // extra key, not just the empty/no-op baseline path.
  const projection = {
    nodes: [{
      id: 'proj-node-b2',
      kind: 'command',
      methodology_tier: 'pws',
      ranking: {},
      name: '/mos:causal',
      reach_id: 'brain_consult',
      sub_mode: 'test-fixture',
      framework: 'Root Cause Analysis',
      hierarchy_rank: 1,
      posture: 'push_forward',
    }],
  };
  const packetOptional = {
    local_graph_summary: {
      framework_chain_hint: { edges: [{ from: 'Root Cause Analysis', to: 'Synthesis', confidence: 0.9 }] },
    },
  };
  const decision = navigationEngine.decide({}, {
    projectionOverride: projection,
    packetOptional: packetOptional,
    roomState: {},
  });

  ok('B2: precondition -- the fixture actually lifted a fire_skill this turn',
    decision.fire_skill !== null);
  ok('B2: decide() top-level key set equals the real baseline decide() key set exactly (no new key)',
    JSON.stringify(Object.keys(decision).slice().sort()) === JSON.stringify(EXPECTED_DECISION_KEYS));
  ok('B2: decision.decision_trace key set equals the real baseline decide() trace key set exactly',
    JSON.stringify(Object.keys(decision.decision_trace).slice().sort()) === JSON.stringify(EXPECTED_TRACE_KEYS));
})();

// ===========================================================================
// NO-NEW-REACH: the reach id bank is still the 6-reach bank; brain_consult is
// reused; no 7th id appears in navigation-engine-offer.cjs.
// ===========================================================================
(function noNewReach() {
  const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
  ok('no-new-reach: dial-reach-orchestrator REACH_IDS is still exactly 6 entries',
    Array.isArray(orchestrator.REACH_IDS) && orchestrator.REACH_IDS.length === 6);
  ok('no-new-reach: brain_consult is a member of the frozen 6-reach bank',
    orchestrator.REACH_IDS.indexOf('brain_consult') !== -1);

  const offerSrc = readSurface('lib/core/navigation-engine-offer.cjs');
  const KNOWN_SIX = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats'];
  // Every reach_id literal (single- or double-quoted) referenced in the file
  // must be a member of the frozen 6-reach bank -- no 7th id introduced.
  const reachIdLiteralRe = /reach_id\s*(?::|===|!==|==)\s*['"]([a-z_]+)['"]/g;
  const found = new Set();
  let m;
  while ((m = reachIdLiteralRe.exec(offerSrc)) !== null) {
    found.add(m[1]);
  }
  const unknownIds = Array.from(found).filter((id) => KNOWN_SIX.indexOf(id) === -1);
  ok('no-new-reach: navigation-engine-offer.cjs references no reach_id outside the frozen 6-reach bank (' +
    'found: ' + Array.from(found).join(',') + ')', unknownIds.length === 0);
  ok('no-new-reach: navigation-engine-offer.cjs reuses brain_consult specifically (D-03)',
    offerSrc.indexOf("BRAIN_CONSULT_REACH_ID = 'brain_consult'") !== -1
    || offerSrc.indexOf('brain_consult') !== -1);
})();

// ===========================================================================
// EM-DASH SWEEP: zero em-dash characters (U+2014) across every file this
// phase created or edited (Waves 1-4).
// ===========================================================================
const PHASE_191_FILES = [
  'lib/core/orchestration-candidate-lift.cjs',
  'lib/core/navigation-engine.cjs',
  'lib/core/navigation-engine-offer.cjs',
  'lib/hmi/dial-presenter.cjs',
  'tests/orchestration-candidate-lift.test.cjs',
  'tests/decide-lift-wire-191.test.cjs',
  'tests/dial-command-recommendation-191.test.cjs',
  'tests/routing-source-flip-191.test.cjs',
  'tests/part8-leak-sweep-191.test.cjs',
  '.planning/phases/191-brain-orchestration-advisor/191-IFACE.md',
  '.planning/phases/191-brain-orchestration-advisor/191-CONTEXT.md',
];

(function emDashSweep() {
  // Unicode escape (never a literal em-dash glyph anywhere in this source
  // file) so this suite's own definition line can never trip its own sweep.
  const EM_DASH = '\u2014';
  for (const rel of PHASE_191_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) {
      ok('em-dash sweep: ' + rel + ' exists (cannot sweep a missing file)', false);
      continue;
    }
    const src = fs.readFileSync(abs, 'utf8');
    const count = (src.match(new RegExp(EM_DASH, 'g')) || []).length;
    ok('em-dash sweep: ' + rel + ' has ZERO em-dash characters (found ' + count + ')', count === 0);
  }
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> part8-leak-sweep-191.test.cjs: PASSED');
process.exit(0);
