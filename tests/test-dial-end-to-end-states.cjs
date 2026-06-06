'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-06 -- the dial end-to-end state-matrix + closeReach round-trip gate.
 * =============================================================================
 * This is the SINGLE aggregator-owned gate that drives the full dial pipeline
 * end to end and re-asserts the four standing fences so they live in one place:
 *
 *   orchestrator (Plan 01 buildReachList)
 *     -> label composer (Plan 02 composeLabel)
 *     -> presenter (Plan 04 renderDial)
 *     -> closeReach (Plan 03 dial-close-reach)
 *     -> memory (Plan 05 renderDialMemory)
 *
 * Coverage (UI-SPEC Section 7 state matrix + Section 8 interactions + Section 12
 * verification dimensions). V8 (Desktop render proof) is DEFERRED past 143.1 per
 * resolved OQ1; every other in-force dimension is exercised here.
 *
 *   S1  Mode A, clear leader     -> exactly 1 filled marker (reach #1)
 *   S2  Mode A, near-tie         -> exactly 2 filled markers (reach #1 + #2, margin < 0.15)
 *   S3  Mode B (Local Only)      -> 0 filled markers; offline framing line
 *   S4  Tier 0 cold-room         -> 0 filled markers; '--' confidence; cold-room framing
 *   S5  Partial-slot degradation -> markers per gate; degraded row drops to generic JTBD line
 *
 * closeReach round-trip (UI-SPEC Section 8):
 *   - render S1, commit the recommended detent  -> SELECTED_REACH edge + f_selector_sync_confirmed
 *   - render S1, pivot off the recommended       -> PIVOTED edge + f_selector_pivot (+ SELECTED_REACH)
 *
 * The four standing fences re-asserted end-to-end (so the aggregator owns them):
 *   V9   two-K separation: ranker MAX_K == 3 AND orchestrator DIAL_REACH_K == 5 (distinct constants)
 *   V10  frozen gate integrity: 0.70 floor + 0.15 margin; margin > 0.15 yields exactly 1 marker
 *   V11  Part-8 {framework} egress seam: brain_consult / deep_research audit raw user content out;
 *        the other three families are render-only
 *   V12  write locality: every dial write routes through navigation.cjs; no module under this
 *        phase opens room.db directly (grep sweep)
 *
 * Standalone runner (mirrors tests/test-dial-graph-relationship-layer.cjs): plain
 * node:assert + process.exit, with a node:sqlite SKIP guard (exit 77) so the
 * aggregator stays green on a Node without the sqlite built-in. No node:test, no
 * emoji, no em-dashes. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_) {
  process.stdout.write('SKIP test-dial-end-to-end-states.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');

// The five pipeline modules, wired exactly as the production surfaces wire them.
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const labelComposer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-label-composer.cjs'));
const presenter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const closeReachMod = require(path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'));
const dialMemory = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const { buildReachList, DIAL_REACH_K, RECOMMEND_FLOOR, MARGIN_THRESHOLD, REACH_IDS } = orchestrator;
const { composeLabel } = labelComposer;
const { renderDial, MARKER_RECOMMENDED, MARKER_ROW } = presenter;
const { closeReach } = closeReachMod;
const { renderDialMemory } = dialMemory;

const SESSION = 'session:dial-e2e-test';
const FOCUS_ID = 'node:problem-formulation';

// A slot context that resolves every family's slots (so labels are the full
// WHAT-THEY-GET form, not the degraded generic line) -- except S5, which
// deliberately withholds a slot.
const FULL_SLOTS = Object.freeze({
  topic: 'pricing',
  topic_a: 'pricing',
  topic_b: 'CAC',
  room_name: 'synteris',
  framework: 'SWOT',
});

// The mechanism nouns the dial table is authored in -- NONE may appear on screen
// (UI-SPEC Section 9 / V1). The composer swaps them for WHAT-THEY-GET labels.
const BANNED_MECHANISM_NOUNS = [
  'Context Block',
  'contradiction surface',
  'cross-room',
  'Brain consult',
  'deep research plan',
];

let PASS = 0;
function check(label, fn) {
  fn();
  PASS += 1;
  process.stdout.write('  ok ' + label + '\n');
}

// ----- fixtures -------------------------------------------------------------

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1431-06-e2e-'));
  return openRoomDb(dir);
}

function seedNode(db, id, type) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, source_section, created_by, confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, '{}', 'p1431-06-fixture', 'problem-formulation', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, now, now);
}

function seedReachAnchors(db, command, framework, declined) {
  seedNode(db, FOCUS_ID, 'focus_anchor');
  seedNode(db, 'cmd:' + command, 'command');
  seedNode(db, 'framework:' + framework, 'framework');
  if (declined) seedNode(db, declined, 'command');
  navigation.setFocus(db, SESSION, FOCUS_ID, 'user');
}

function reachFor(command, framework) {
  return {
    command,
    jtbd: 'find-problem',
    framework,
    recommended: true,
    decision_id: 'dec:' + command + ':' + Date.now(),
  };
}

// roomState shapes that deterministically produce each render state via the
// pre-baked reachScores prior (the orchestrator is pure over what callers hand
// it; this is exactly the production contract).
function modeAClearLeader() {
  // reach #1 well above 0.70; reach #2 far below the margin -> exactly 1 marker.
  return {
    tierMode: 'mode_a',
    reachScores: {
      context_block: 0.87,
      contradiction: 0.61,
      brain_consult: 0.54,
      deep_research: 0.40,
      cross_room: 0.30,
    },
  };
}

function modeANearTie() {
  // reach #1 and #2 both >= 0.70 and within 0.15 -> exactly 2 markers.
  return {
    tierMode: 'mode_a',
    reachScores: {
      context_block: 0.79,
      contradiction: 0.71,
      brain_consult: 0.50,
      deep_research: 0.40,
      cross_room: 0.30,
    },
  };
}

function modeAWideMargin() {
  // Both candidates above 0.70 BUT margin > 0.15 -> exactly 1 marker (V10).
  return {
    tierMode: 'mode_a',
    reachScores: {
      context_block: 0.90,
      contradiction: 0.72,
      brain_consult: 0.50,
      deep_research: 0.40,
      cross_room: 0.30,
    },
  };
}

function modeBLocalOnly() {
  return {
    tierMode: 'mode_b',
    reachScores: {
      context_block: 0.44,
      contradiction: 0.41,
      cross_room: 0.38,
      brain_consult: 0.30,
      deep_research: 0.20,
    },
  };
}

function tier0ColdRoom() {
  // No supplied priors -> registry-only floor; tier_0 -> zero markers by design.
  return { tierMode: 'tier_0' };
}

// Count filled markers in a rendered dial body (the '▶' glyph prefix).
function countFilledMarkers(rendered) {
  return rendered.rows.filter((r) => r.recommended).length;
}

// Assert no banned mechanism noun appears anywhere in the rendered text (V1).
function assertNoMechanismNouns(text, stateLabel) {
  for (const noun of BANNED_MECHANISM_NOUNS) {
    assert.ok(text.indexOf(noun) === -1,
      stateLabel + ': mechanism noun "' + noun + '" must not appear on screen');
  }
}

// ---------------------------------------------------------------------------
// S1 -- Mode A clear leader: orchestrator -> labels -> presenter, exactly 1 marker.
// ---------------------------------------------------------------------------
function testS1ModeAClearLeader() {
  const reachList = buildReachList(modeAClearLeader());
  assert.equal(reachList.tier_mode, 'mode_a', 'S1 is mode_a');
  assert.equal(reachList.reaches.length, 5, 'S1 previews all 5 reaches (DIAL_REACH_K)');
  assert.equal(reachList.reaches[0].reach_id, 'context_block', 'S1 leader is the highest-scored reach');

  const rendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  assert.equal(countFilledMarkers(rendered), 1, 'S1: exactly 1 filled marker (the clear leader)');
  assert.ok(rendered.body.indexOf(MARKER_RECOMMENDED) !== -1, 'S1: filled triangle present');
  assert.ok(rendered.body.indexOf(MARKER_ROW) !== -1, 'S1: empty triangles present on the other rows');
  assert.ok(rendered.framing === null, 'S1 (Mode A) has no cold-room framing line');
  assert.ok(rendered.footer.indexOf('of 5') !== -1, 'S1 footer reports the 5-reach preview total');

  // V1 / V2: WHAT-THEY-GET labels only, no mechanism nouns, no literal "(Recommended)".
  assertNoMechanismNouns(rendered.text, 'S1');
  assert.ok(rendered.text.indexOf('Recommended)') === -1, 'S1: no literal "(Recommended)" text (AP4)');
  // The leader row renders its WHAT-THEY-GET label with the {topic} slot filled
  // (FNV-1a picks deterministically among the family templates; both fill {topic}).
  const leaderLabel = composeLabel(reachList.reaches[0].reach_id, FULL_SLOTS).label;
  assert.ok(rendered.text.indexOf(leaderLabel) !== -1,
    'S1: the leader row renders its WHAT-THEY-GET label');
  assert.ok(leaderLabel.indexOf('pricing') !== -1 && leaderLabel.indexOf('{') === -1,
    'S1: the WHAT-THEY-GET label resolves the {topic} slot (no raw placeholder)');
}

// ---------------------------------------------------------------------------
// S2 -- Mode A near-tie: exactly 2 filled markers (margin < 0.15).
// ---------------------------------------------------------------------------
function testS2ModeANearTie() {
  const reachList = buildReachList(modeANearTie());
  const margin = reachList.reaches[0].score - reachList.reaches[1].score;
  assert.ok(margin < MARGIN_THRESHOLD, 'S2: the top-two margin is below 0.15');

  const rendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  assert.equal(countFilledMarkers(rendered), 2, 'S2: exactly 2 filled markers (co-leaders)');
  assert.ok(rendered.rows[0].recommended && rendered.rows[1].recommended, 'S2: rows 1 and 2 both recommended');
  assert.ok(!rendered.rows[2].recommended, 'S2: row 3 is not recommended');
  assertNoMechanismNouns(rendered.text, 'S2');
}

// ---------------------------------------------------------------------------
// S3 -- Mode B: 0 filled markers, offline framing line, looks intentional (V3/V7).
// ---------------------------------------------------------------------------
function testS3ModeB() {
  const reachList = buildReachList(modeBLocalOnly());
  assert.equal(reachList.tier_mode, 'mode_b', 'S3 is mode_b');

  const rendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  assert.equal(countFilledMarkers(rendered), 0, 'S3 (Mode B): zero filled markers (the 0.70 gate is Brain-only)');
  assert.ok(rendered.body.indexOf(MARKER_RECOMMENDED) === -1, 'S3: no accent/filled triangle in Mode B (V3)');
  assert.ok(typeof rendered.framing === 'string' && rendered.framing.length > 0,
    'S3: an explicit offline framing line is present (looks intentional, V7)');
  assert.ok(/offline/i.test(rendered.framing), 'S3 framing names the offline state');
  assertNoMechanismNouns(rendered.text, 'S3');
}

// ---------------------------------------------------------------------------
// S4 -- Tier 0 cold-room: 0 markers, '--' confidence, cold-room framing (V7).
// ---------------------------------------------------------------------------
function testS4Tier0ColdRoom() {
  const reachList = buildReachList(tier0ColdRoom());
  assert.equal(reachList.tier_mode, 'tier_0', 'S4 is tier_0');

  const rendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  assert.equal(countFilledMarkers(rendered), 0, 'S4 (Tier 0): zero filled markers by design');
  assert.ok(rendered.body.indexOf('--') !== -1, "S4: confidence column shows '--' (no signal), not a fake number");
  assert.ok(typeof rendered.framing === 'string' && /new room/i.test(rendered.framing),
    'S4: an explicit cold-room framing line is present (looks intentional, V7)');

  // V7: a cold-room render is visually distinguishable-as-intentional from S1.
  const s1 = renderDial(buildReachList(modeAClearLeader()), { slotContext: FULL_SLOTS });
  assert.ok(s1.text !== rendered.text, 'S4 cold-room render is distinguishable from the S1 Mode A render');
  assert.ok(s1.framing === null && rendered.framing !== null,
    'S4 carries a framing line that S1 does not (the intentional-vs-populated tell)');
}

// ---------------------------------------------------------------------------
// S5 -- Partial-slot degradation: a row whose slot cannot resolve drops to the
// generic JTBD line; the marker logic is UNCHANGED (only the label text degrades).
// ---------------------------------------------------------------------------
function testS5PartialSlotDegradation() {
  // Withhold topic_b so the contradiction family cannot resolve both nodes.
  const partialSlots = { topic: 'pricing', framework: 'Porter Five Forces' };

  // The contradiction label must degrade (unresolvable second node).
  const degraded = composeLabel('contradiction', partialSlots);
  assert.ok(degraded.degraded === true, 'S5: contradiction degrades when topic_b is unresolvable');
  assert.ok(degraded.label.indexOf('{') === -1, 'S5: degraded label never renders a raw {topic} slot');
  assert.equal(degraded.canonical_verb, 'contradiction surface',
    'S5: the canonical verb still persists even though the label degraded');

  // The marker logic is unchanged: a Mode A clear-leader still yields 1 marker
  // even with a degraded sibling row.
  const reachList = buildReachList(modeAClearLeader());
  const rendered = renderDial(reachList, { slotContext: partialSlots });
  assert.equal(countFilledMarkers(rendered), 1, 'S5: marker logic unchanged by label degradation (still 1)');
  assert.ok(rendered.text.indexOf('{') === -1, 'S5: no raw slot placeholder anywhere in the render');
  assertNoMechanismNouns(rendered.text, 'S5');
}

// ---------------------------------------------------------------------------
// closeReach round-trip 1 -- render S1, commit the recommended detent (sync).
// ---------------------------------------------------------------------------
function testRoundTripSync() {
  const db = freshDb();
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework');

  // Render S1 (the leader is the recommended detent), then commit without rotating.
  const reachList = buildReachList(modeAClearLeader());
  const rendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  assert.equal(countFilledMarkers(rendered), 1, 'round-trip sync: S1 rendered with its recommended detent');

  const r = closeReach({
    outcome: 'sync',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    sessionId: SESSION,
    roomState: { db, investment_level: 0.3 },
    recordNextAction: () => ({ ok: true }),
  });
  assert.ok(r.ok, 'closeReach sync ok; reason=' + (r && r.reason));

  const sel = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND target = ? AND type = 'SELECTED_REACH'"
  ).get(FOCUS_ID, 'cmd:mos:beautiful-question');
  assert.equal(sel.c, 1, 'round-trip sync: a SELECTED_REACH edge lands (intent-sync, DIALTUI-08)');
  const syncEv = db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='f_selector_sync_confirmed'"
  ).get();
  assert.equal(syncEv.c, 1, 'round-trip sync: one f_selector_sync_confirmed event (DIALTUI-07)');
  const piv = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type='PIVOTED'").get();
  assert.equal(piv.c, 0, 'round-trip sync: no PIVOTED edge on an in-sync commit');

  // Memory stage: the dial-memory renderer projects the SELECTED_REACH edge FROM
  // the graph (pipeline tail: closeReach write -> navigation.cjs -> renderDialMemory).
  const mem = renderDialMemory(db, 'problem-formulation', {
    focusNodeId: FOCUS_ID,
    reachList: reachList,
    now_ms: Date.now(),
  });
  assert.ok(mem && typeof mem.markdown_body === 'string', 'round-trip sync: dial-memory renders a body');
  assert.ok(mem.summary_stats.selected_count >= 1,
    'round-trip sync: the committed SELECTED_REACH is projected into the memory surface');
  db.close();
}

// ---------------------------------------------------------------------------
// closeReach round-trip 2 -- render S1, pivot OFF the recommended reach.
// ---------------------------------------------------------------------------
function testRoundTripPivot() {
  const db = freshDb();
  const declined = 'cmd:mos:swot';
  seedReachAnchors(db, 'mos:beautiful-question', 'Beautiful Question Framework', declined);

  const reachList = buildReachList(modeAClearLeader());
  renderDial(reachList, { slotContext: FULL_SLOTS });

  const r = closeReach({
    outcome: 'pivot',
    reach: reachFor('mos:beautiful-question', 'Beautiful Question Framework'),
    declinedRecommended: declined,
    margin: 0.08,
    sessionId: SESSION,
    roomState: { db, investment_level: 0.2 },
    recordNextAction: () => ({ ok: true }),
  });
  assert.ok(r.ok, 'closeReach pivot ok; reason=' + (r && r.reason));

  const pivEdge = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'PIVOTED'"
  ).all('cmd:mos:beautiful-question', declined);
  assert.equal(pivEdge.length, 1, 'round-trip pivot: a PIVOTED edge FROM chosen TO declined lands (DIALTUI-06)');
  const pivProps = JSON.parse(pivEdge[0].properties);
  const allowed = new Set(['declined_recommended', 'margin', 'decision_id']);
  for (const k of Object.keys(pivProps)) {
    assert.ok(allowed.has(k), 'round-trip pivot: PIVOTED prop "' + k + '" is ENUM-only (Part 8)');
  }
  const pivEv = db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='f_selector_pivot'"
  ).get();
  assert.equal(pivEv.c, 1, 'round-trip pivot: one f_selector_pivot event');
  // The pivot ALSO writes the SELECTED_REACH edge for the chosen reach.
  const sel = db.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE type='SELECTED_REACH'"
  ).get();
  assert.equal(sel.c, 1, 'round-trip pivot: the chosen reach still writes its SELECTED_REACH edge');
  db.close();
}

// ---------------------------------------------------------------------------
// V9 -- the two-K separation: MAX_K (ranker) == 3 AND DIAL_REACH_K (orchestrator) == 5.
// ---------------------------------------------------------------------------
function testV9TwoK() {
  assert.equal(ranker.MAX_K, 3, 'V9: the ranker MAX_K chooser clamp is 3 (untouched)');
  assert.equal(DIAL_REACH_K, 5, 'V9: the orchestrator DIAL_REACH_K preview is 5');
  assert.ok(ranker.MAX_K !== DIAL_REACH_K, 'V9: the two Ks are distinct constants (rank 5, preview 5, choose 3)');

  // The structural consequence: preview is 5, the chooser offers at most 3.
  const reachList = buildReachList(modeAClearLeader());
  assert.equal(reachList.reaches.length, DIAL_REACH_K, 'V9: the preview ranks DIAL_REACH_K=5 reaches');
  assert.ok(reachList.offered_count <= ranker.MAX_K, 'V9: the chooser offers at most MAX_K=3');
}

// ---------------------------------------------------------------------------
// V10 -- frozen gate integrity: 0.70 floor + 0.15 margin; margin > 0.15 -> 1 marker.
// ---------------------------------------------------------------------------
function testV10FrozenGate() {
  assert.equal(RECOMMEND_FLOOR, 0.70, 'V10: the 0.70 floor is frozen');
  assert.equal(MARGIN_THRESHOLD, 0.15, 'V10: the 0.15 margin is frozen');

  // A crafted case where BOTH candidates clear 0.70 but the margin EXCEEDS 0.15
  // must still yield exactly ONE marker -- the floor is never lowered to force a
  // second one (AP3), and the margin gate independently suppresses reach #2.
  const reachList = buildReachList(modeAWideMargin());
  const margin = reachList.reaches[0].score - reachList.reaches[1].score;
  assert.ok(reachList.reaches[0].score >= RECOMMEND_FLOOR, 'V10: reach #1 clears the 0.70 floor');
  assert.ok(reachList.reaches[1].score >= RECOMMEND_FLOOR, 'V10: reach #2 ALSO clears the 0.70 floor');
  assert.ok(margin > MARGIN_THRESHOLD, 'V10: but the margin exceeds 0.15');
  const markers = reachList.reaches.filter((r) => r.recommended).length;
  assert.equal(markers, 1, 'V10: margin > 0.15 yields exactly 1 marker (the floor is never lowered)');
}

// ---------------------------------------------------------------------------
// V11 -- Part-8 {framework} egress seam re-asserted via the composer.
// ---------------------------------------------------------------------------
function testV11Part8EgressSeam() {
  const before = labelComposer._auditCallCount();

  // The two egress families MUST run the {framework} slot through the audit and
  // default-deny raw user content (an email address trips FORBIDDEN_PATTERNS).
  const dirtyFramework = { framework: 'contact jane.doe@example.com', topic: 'pricing' };
  const brainDirty = composeLabel('brain_consult', dirtyFramework);
  assert.ok(brainDirty.degraded === true,
    'V11: brain_consult default-denies a raw-user-content {framework} and degrades');
  const researchDirty = composeLabel('deep_research', dirtyFramework);
  assert.ok(researchDirty.degraded === true,
    'V11: deep_research default-denies a raw-user-content {framework} and degrades');

  const afterEgress = labelComposer._auditCallCount();
  assert.ok(afterEgress > before, 'V11: the egress families invoked the Part-8 audit');

  // A GENERIC handle passes the seam (the egress is allowed when clean).
  const brainClean = composeLabel('brain_consult', { framework: 'SWOT' });
  assert.ok(brainClean.degraded === false && brainClean.label.indexOf('SWOT') !== -1,
    'V11: a generic framework handle (SWOT) clears the seam and renders');

  // The other three families are render-only: they NEVER move the audit counter.
  const renderOnlyBefore = labelComposer._auditCallCount();
  composeLabel('context_block', { topic: 'pricing' });
  composeLabel('contradiction', { topic_a: 'pricing', topic_b: 'CAC' });
  composeLabel('cross_room', { room_name: 'synteris', topic: 'pricing' });
  const renderOnlyAfter = labelComposer._auditCallCount();
  assert.equal(renderOnlyAfter, renderOnlyBefore,
    'V11: context_block / contradiction / cross_room are render-only (never invoke the egress audit)');
}

// ---------------------------------------------------------------------------
// V12 -- write locality: no module under this phase opens room.db directly.
// A grep sweep across the dial pipeline modules confirms navigation.cjs-only writes.
// ---------------------------------------------------------------------------
function testV12WriteLocality() {
  // The modules in the dial pipeline that touch the graph. The renderer/composer/
  // presenter/orchestrator are pure (no db); the only writer is dial-close-reach,
  // which must route through navigation.cjs. The memory renderer reads ONLY via
  // navigation.cjs. A direct better-sqlite3 / node:sqlite / openRoomDb / room-db
  // require in any of them is a write-locality breach (AP6).
  const PHASE_MODULES = [
    path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'),
    path.join(REPO_ROOT, 'lib', 'hmi', 'dial-label-composer.cjs'),
    path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs'),
    path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'),
    path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs'),
  ];
  // Match a REQUIRE of a raw db driver / room-db opener -- not prose mentions.
  const FORBIDDEN_REQUIRE = [
    /require\(['"]better-sqlite3['"]\)/,
    /require\(['"]node:sqlite['"]\)/,
    /require\([^)]*room-db/,
    /\bopenRoomDb\b/,
  ];
  for (const file of PHASE_MODULES) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of FORBIDDEN_REQUIRE) {
      assert.ok(!re.test(src),
        'V12: ' + path.basename(file) + ' must not open room.db directly (matched ' + re + ')');
    }
  }

  // The one writer (dial-close-reach) DOES route through navigation.cjs.
  const writerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'), 'utf8');
  assert.ok(/require\(['"]\.\.\/core\/navigation\.cjs['"]\)/.test(writerSrc),
    'V12: dial-close-reach routes every write through navigation.cjs');
}

// ----- run -----------------------------------------------------------------

process.stdout.write('Phase 143.1-06 dial end-to-end gate\n');
process.stdout.write('--- render states S1-S5 ---\n');
check('S1 Mode A clear leader (1 marker)', testS1ModeAClearLeader);
check('S2 Mode A near-tie (2 markers)', testS2ModeANearTie);
check('S3 Mode B (0 markers, offline framing)', testS3ModeB);
check('S4 Tier 0 cold-room (0 markers, --, framing)', testS4Tier0ColdRoom);
check('S5 partial-slot degradation (label degrades, marker logic unchanged)', testS5PartialSlotDegradation);
process.stdout.write('--- closeReach round-trip ---\n');
check('round-trip sync (SELECTED_REACH + f_selector_sync_confirmed -> memory projection)', testRoundTripSync);
check('round-trip pivot (PIVOTED ENUM-only + f_selector_pivot + SELECTED_REACH)', testRoundTripPivot);
process.stdout.write('--- standing fences V9/V10/V11/V12 ---\n');
check('V9 two-K separation (MAX_K=3 vs DIAL_REACH_K=5)', testV9TwoK);
check('V10 frozen gate integrity (0.70 / 0.15; margin>0.15 -> 1 marker)', testV10FrozenGate);
check('V11 Part-8 {framework} egress seam', testV11Part8EgressSeam);
check('V12 write locality (navigation.cjs only)', testV12WriteLocality);

process.stdout.write('PASS test-dial-end-to-end-states.cjs (' + PASS + ' checks)\n');
process.exit(0);
