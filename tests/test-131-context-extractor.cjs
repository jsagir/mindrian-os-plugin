'use strict';
// Phase 131-02 -- research-context-extractor behavior suite (RED-first).
//
// Covers the Stage 1+2+3 pre-flight + context-summary + weighted-lens-set
// extractor (the 4.8 re-baseline collapses Stages 2 and 3 into ONE reasoning
// pass; Stage 1's 8 reads are ONE batched navigation.cjs call). The module under
// test is lib/core/research-context-extractor.cjs (CREATED by Task 2; this suite
// fails RED until then because the require throws / the helpers are absent).
//
// Invariants proven here (the plan must_haves):
//   1. extractContext calls navigation.getResearchPreflight EXACTLY ONCE (spy-
//      counted) -- no 8 sequential reads. (T-131-02-01 chokepoint discipline.)
//   2. context_summary is a single Body Shape A paragraph (no selector block, no
//      Shape E header) naming the active workflow + JTBD + current section + the
//      evidence-gap count when present.
//   3. computeLensSet is CONTEXT-DERIVED, not hardcoded: two contrasting
//      preflights yield two different ordered { lens, weight } lists. The
//      financial-model + thesis-build + investor preflight contains scholarly,
//      industry, patent, brain, and a competitive-intelligence weight bump.
//   4. a founder.grant role_blend adds the grants lens.
//   5. a cold / empty room (null preflight inputs) yields a defensible Tier-0
//      default lens set (scholarly only) + a graceful summary, never a throw.
//      (T-131-02-02 DoS-resilience.)
//
// Canon Part 2a: the summary frames in the dominant role's voice (role_blend).
// Canon Part 5: the gap framing names the evidence-gap count.
// Canon Part 8: the summary is LOCAL-only (rendered to the user, never sent to
//   Brain); this module makes ZERO Brain calls and ZERO corpus fetches.
// Canon Part 9: every room.db read routes through navigation.getResearchPreflight;
//   the extractor opens no db handle of its own.
// NO em-dashes in this file (CLAUDE.md HARD RULE). Uses hyphens.

const { ok, equal, notDeepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EMDASH = String.fromCharCode(8212);

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const userMdOps = require(path.join(REPO_ROOT, 'lib', 'core', 'user-md-ops.cjs'));

// The module under test (absent until Task 2 -> RED). Required lazily inside the
// runner so a missing-module throw is reported as a clean FAIL, not a load crash.
const EXTRACTOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'research-context-extractor.cjs');

// ---------------------------------------------------------------------------
// Fixtures. Two contrasting preflights so the "computed, not hardcoded" lens-set
// invariant is provable by INEQUALITY. The hot one is financial-model gap +
// thesis-build JTBD + investor-weighted role_blend; the cold one is all-null.
// ---------------------------------------------------------------------------

function hotPreflight() {
  return {
    active_workflow: 'build-thesis',
    active_jtbd: { jtbd: 'thesis-build', kind: 'investment', source: 'event_log' },
    operator: { current: 'investability-gate', source: 'event_log' },
    current_section: 'financial-model',
    recent_changes: [
      { id: 'memory_event:x', properties: { event_type: 'jtbd_transitioned' } },
    ],
    evidence_gaps: [
      { id: 'claim:a', summary: 'COGS unknown' },
      { id: 'claim:b', summary: 'TAM unsupported' },
      { id: 'assumption:c', summary: 'margin assumed' },
    ],
    prior_research: [],
    role_blend: { investor: 0.7, founder: 0.3 },
  };
}

function grantPreflight() {
  const p = hotPreflight();
  p.role_blend = { founder: 0.5, 'founder.grant': 0.5 };
  return p;
}

function coldPreflight() {
  return {
    active_workflow: null,
    active_jtbd: null,
    operator: null,
    current_section: null,
    recent_changes: [],
    evidence_gaps: [],
    prior_research: [],
    role_blend: null,
  };
}

// Seed a real room with a USER.md role_blend so the integration test drives the
// extractor over the genuine navigation.getResearchPreflight (proving the
// chokepoint is the only door, end to end). Returns { dir }.
function seedRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p131-02-extract-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  closeRoomDb(db);
  // A persona file so role_blend is non-null on the real read path.
  userMdOps.writeUserMdAtomic(path.join(dir, 'USER.md'), {
    role_blend: { investor: 0.6, researcher: 0.4 },
  });
  return { dir };
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Test 1 -- extractContext calls getResearchPreflight EXACTLY ONCE (spy-counted).
// We wrap navigation.getResearchPreflight with a counting spy that returns a
// canned hot preflight, so the assertion is independent of room seeding.
// ---------------------------------------------------------------------------

function test1_oneBatchedPreflightRead() {
  const extractor = require(EXTRACTOR_PATH);
  const original = navigation.getResearchPreflight;
  let calls = 0;
  navigation.getResearchPreflight = function spy() {
    calls += 1;
    return hotPreflight();
  };
  try {
    const res = extractor.extractContext({
      roomDir: '/tmp/does-not-matter', sessionId: 'sess-1', topic: 'CAR-T cost curve', db: {},
    });
    ok(res && res.ok === true, 'extractContext returns ok:true; got ' + JSON.stringify(res));
    equal(calls, 1, 'getResearchPreflight must be called EXACTLY once (one batched read, not 8)');
  } finally {
    navigation.getResearchPreflight = original;
  }
}

// ---------------------------------------------------------------------------
// Test 2 -- context_summary is a single Body Shape A paragraph naming the active
// workflow + JTBD + current section + evidence-gap count.
// ---------------------------------------------------------------------------

function test2_bodyShapeASummaryMentionsContext() {
  const extractor = require(EXTRACTOR_PATH);
  const original = navigation.getResearchPreflight;
  navigation.getResearchPreflight = () => hotPreflight();
  try {
    const res = extractor.extractContext({ roomDir: '/x', sessionId: 's', topic: 'CAR-T cost curve', db: {} });
    const s = res.context_summary;
    ok(typeof s === 'string' && s.trim().length > 0, 'context_summary is a non-empty string');
    // Body Shape A: a single conversational paragraph. No Shape E action-report
    // header, no F-selector block, no markdown headings, no blank-line-separated
    // multi-paragraph block.
    ok(!/^#{1,6}\s/m.test(s), 'no markdown heading (not Shape E)');
    ok(!/\n\s*\n/.test(s.trim()), 'a single paragraph (no blank-line paragraph break)');
    ok(!/\b[1-9]\.\s|\boption\b/i.test(s), 'no numbered selector / option block');
    // Mentions the load-bearing context scalars.
    ok(/build-thesis/.test(s), 'names the active workflow');
    ok(/thesis-build/.test(s), 'names the active JTBD');
    ok(/financial-model/.test(s), 'names the current section');
    ok(/\b3\b/.test(s), 'names the evidence-gap count (3)');
  } finally {
    navigation.getResearchPreflight = original;
  }
}

// ---------------------------------------------------------------------------
// Test 3 -- computeLensSet is CONTEXT-DERIVED (two contrasting preflights yield
// two different ordered lens sets) AND the hot set carries scholarly / industry /
// patent / brain + a competitive-intelligence weight bump (investor).
// ---------------------------------------------------------------------------

function lensNames(lensSet) {
  return lensSet.map((t) => t.lens);
}

function test3_lensSetIsComputedNotHardcoded() {
  const extractor = require(EXTRACTOR_PATH);
  equal(typeof extractor.computeLensSet, 'function', 'computeLensSet must be exported');

  const hot = extractor.computeLensSet(hotPreflight());
  const cold = extractor.computeLensSet(coldPreflight());

  // Ordered list of { lens, weight } tuples.
  ok(Array.isArray(hot) && hot.length > 0, 'hot lens set is a non-empty array');
  for (const t of hot) {
    ok(t && typeof t.lens === 'string' && typeof t.weight === 'number',
      'each entry is a { lens, weight } tuple; got ' + JSON.stringify(t));
  }

  // Computed, not hardcoded: a DIFFERENT context yields a DIFFERENT set.
  notDeepEqual(hot, cold, 'two contrasting preflights must produce different lens sets (not a fixed list)');

  const hotNames = lensNames(hot);
  // financial-model gap -> scholarly + industry + patent.
  ok(hotNames.includes('scholarly'), 'financial-model gap adds scholarly');
  ok(hotNames.includes('industry'), 'financial-model gap adds industry');
  ok(hotNames.includes('patent'), 'financial-model gap adds patent');
  // thesis-build JTBD -> add brain (methodology chain).
  ok(hotNames.includes('brain'), 'thesis-build JTBD adds the brain methodology lens');
  // investor weight -> a competitive-intelligence weight bump.
  ok(hotNames.includes('competitive-intelligence'), 'investor role_blend adds competitive-intelligence');

  // The list is WEIGHTED: at least one entry differs in weight (not a flat 1.0).
  const weights = hot.map((t) => t.weight);
  ok(weights.some((w) => w !== weights[0]) || weights.length === 1,
    'lens set carries differentiated weights (weighted-by-context)');
}

// ---------------------------------------------------------------------------
// Test 4 -- founder.grant role_blend adds the grants lens.
// ---------------------------------------------------------------------------

function test4_founderGrantAddsGrantsLens() {
  const extractor = require(EXTRACTOR_PATH);
  const set = extractor.computeLensSet(grantPreflight());
  ok(lensNames(set).includes('grants'), 'founder.grant role_blend adds the grants lens');
}

// ---------------------------------------------------------------------------
// Test 5 -- a cold / empty room yields a Tier-0 default lens set (scholarly only)
// + a graceful summary, and NEVER throws (also covers a null preflight argument).
// ---------------------------------------------------------------------------

function test5_coldRoomDefaultsToScholarlyAndNeverThrows() {
  const extractor = require(EXTRACTOR_PATH);

  // computeLensSet over a cold preflight -> scholarly only.
  const coldSet = extractor.computeLensSet(coldPreflight());
  ok(Array.isArray(coldSet) && coldSet.length >= 1, 'cold lens set is a non-empty array');
  equal(lensNames(coldSet).join(','), 'scholarly', 'cold room defaults to scholarly only (Tier 0)');

  // computeLensSet over a NULL preflight -> still the scholarly default, no throw.
  const nullSet = extractor.computeLensSet(null);
  ok(Array.isArray(nullSet) && lensNames(nullSet).includes('scholarly'),
    'a null preflight degrades to the scholarly default, never throws');

  // extractContext over a cold preflight -> graceful summary + scholarly set.
  const original = navigation.getResearchPreflight;
  navigation.getResearchPreflight = () => coldPreflight();
  try {
    const res = extractor.extractContext({ roomDir: '/x', sessionId: 's', topic: 't', db: {} });
    ok(res && res.ok === true, 'cold extractContext returns ok:true (never throws)');
    ok(typeof res.context_summary === 'string' && res.context_summary.trim().length > 0,
      'cold room still renders a graceful, non-empty summary');
    equal(lensNames(res.lens_set).join(','), 'scholarly', 'cold extractContext lens_set is scholarly only');
  } finally {
    navigation.getResearchPreflight = original;
  }

  // extractContext with a null preflight return -> still ok, never throws.
  navigation.getResearchPreflight = () => null;
  try {
    const res = extractor.extractContext({ roomDir: '/x', sessionId: 's', topic: 't', db: {} });
    ok(res && res.ok === true, 'a null preflight return degrades to ok:true, never throws');
    ok(lensNames(res.lens_set).includes('scholarly'), 'null-preflight lens_set carries the scholarly default');
  } finally {
    navigation.getResearchPreflight = original;
  }
}

// ---------------------------------------------------------------------------
// Test 6 -- integration: extractContext drives the REAL
// navigation.getResearchPreflight over a seeded room (proving the chokepoint is
// the only door, end to end) and returns the documented shape.
// ---------------------------------------------------------------------------

function test6_integrationOverRealNavigationChokepoint() {
  const extractor = require(EXTRACTOR_PATH);
  const { dir } = seedRoom();
  const db = openRoomDb(dir);
  try {
    const res = extractor.extractContext({ roomDir: dir, sessionId: 'sess-real', topic: 'CAR-T cost curve', db });
    ok(res && res.ok === true, 'real extractContext returns ok:true');
    ok(typeof res.context_summary === 'string', 'returns a context_summary string');
    ok(Array.isArray(res.lens_set), 'returns a lens_set array');
    ok(res.preflight && typeof res.preflight === 'object', 'returns the preflight it read (the documented shape)');
    // The real seeded room has an investor+researcher role_blend, so the computed
    // set must carry the competitive-intelligence + scholarly evidence of that.
    ok(lensNames(res.lens_set).includes('scholarly'), 'real lens_set carries scholarly (researcher weight)');
  } finally {
    closeRoomDb(db);
    cleanup(dir);
  }
}

// ---------------------------------------------------------------------------
// Test 7 -- hygiene: the extractor source carries ZERO em-dashes and ZERO
// Python / child_process / corpus-fetch surface (this module is read-only over
// room.db + USER.md; the fetch is Plan 03).
// ---------------------------------------------------------------------------

function test7_sourceHygiene() {
  ok(fs.existsSync(EXTRACTOR_PATH), 'research-context-extractor.cjs must exist');
  const src = fs.readFileSync(EXTRACTOR_PATH, 'utf8');
  ok(!src.includes(EMDASH), 'extractor source must contain zero em-dashes');
  const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok(!/child_process|spawnSync|spawn\(|\.py\b/.test(code),
    'extractor must carry zero child_process / Python surface (read-only; fetch is Plan 03)');
  ok(!/require\(['"](?:node:sqlite|better-sqlite3)['"]\)/.test(code),
    'extractor must NOT require node:sqlite directly (navigation is the only door)');
  // Reaches room.db ONLY through navigation.cjs.
  ok(/require\(['"][^'"]*navigation\.cjs['"]\)/.test(code) || /navigation/.test(code),
    'extractor requires navigation.cjs (the chokepoint)');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS = [
  ['test1_oneBatchedPreflightRead', test1_oneBatchedPreflightRead],
  ['test2_bodyShapeASummaryMentionsContext', test2_bodyShapeASummaryMentionsContext],
  ['test3_lensSetIsComputedNotHardcoded', test3_lensSetIsComputedNotHardcoded],
  ['test4_founderGrantAddsGrantsLens', test4_founderGrantAddsGrantsLens],
  ['test5_coldRoomDefaultsToScholarlyAndNeverThrows', test5_coldRoomDefaultsToScholarlyAndNeverThrows],
  ['test6_integrationOverRealNavigationChokepoint', test6_integrationOverRealNavigationChokepoint],
  ['test7_sourceHygiene', test7_sourceHygiene],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of TESTS) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

console.log('');
console.log('Phase 131-02 research-context-extractor: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
