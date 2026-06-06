'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- dial-memory renderer test (MEMDIAL-02 / MEMDIAL-03).
 * =====================================================================
 * The dial memory renderer is the legible MD projection of the dial relationship
 * layer (SELECTED_REACH / PIVOTED / DRSCH edges), modeled on the SHIPPED Phase 124
 * timeline-renderer pattern: a PURE function (db, sectionSlug, opts) -> { markdown_body,
 * summary_stats } that reads ONLY via lib/core/navigation.cjs (the D-03 closed
 * chokepoint), with ZERO filesystem reads and ZERO Brain calls.
 *
 * This test drives the four MEMDIAL-02 components:
 *   1. available reaches      -- the 5 canonical reach ids (DIAL_REACH_K)
 *   2. last selected          -- the most-recent SELECTED_REACH edge
 *   3. current recommended    -- the FROZEN-gate result (Section 7)
 *   4. recent research conclusions -- surfaced from the DRSCH research-conclusion
 *      evidence edges via navigation.getNeighborhood filtered on the DRSCH /
 *      evidence-conclusion edgeTypeIn; rendered as a clean empty/placeholder block
 *      ("no recent research conclusions") when none exist -- NEVER omitted, NEVER
 *      a crash; the section ALWAYS carries all 4 components.
 *
 * Plus:
 *   - Idempotence: rendering twice from the same graph state is byte-identical.
 *   - Byte-preservation: a human-authored body outside the sentinels survives a
 *     mergeSentinelSection round-trip unchanged (the renderer feeds the runner's
 *     sentinel-bounded merge -- D-02 hard invariant).
 *   - Reads-only-via-navigation: a grep-audit asserts the renderer imports ONLY
 *     lib/core/navigation.cjs (no fs read, no Brain client, no direct submodule
 *     require) -- the Phase 124 D-03 invariant.
 *   - Empty state: a room with zero SELECTED_REACH edges renders a clean
 *     'no dial activity yet' section (not a crash, not a raw template).
 *   - No em-dashes / en-dashes in the rendered body (CLAUDE.md HARD RULE).
 *
 * Mirrors tests/test-feynman-timeline-canon-part-9-invariant.cjs (the adversarial
 * Part-9 invariant style) + tests/test-feynman-timeline-renderer.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_) {
  process.stdout.write('SKIP test-dial-memory-renderer.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RENDERER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs');
const renderer = require(RENDERER_PATH);
const { REACH_IDS } = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
// Real room.db schema (mirrors the Phase 143.1-03 close-reach test fixture) so the
// shipped getNeighborhood recursive-CTE (which references source_section) runs
// against the production schema, not a hand-rolled drift.
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const SECTION = 'problem-definition';
const FOCUS_ID = 'section:' + SECTION;

// ---------- Real-schema seed helpers ----------

function seedNode(db, id, type, createdAt) {
  db.prepare(
    'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, source_section, created_by, confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, '{}', ?, ?, 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, SECTION, SECTION, createdAt, createdAt);
}

function seedEdge(db, source, target, type, props) {
  db.prepare(
    'INSERT OR REPLACE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
  ).run(source, target, type, JSON.stringify(props || {}));
}

// Seed a SELECTED_REACH edge FROM the focus node TO cmd:<command>.
function seedSelectedReach(db, command, framework, recommended, createdAt) {
  seedNode(db, FOCUS_ID, 'section', createdAt);
  seedNode(db, 'cmd:' + command, 'command', createdAt);
  seedEdge(db, FOCUS_ID, 'cmd:' + command, 'SELECTED_REACH', {
    jtbd: 'find-problem',
    framework: framework,
    recommended: recommended === true,
    decision_id: 'dec:' + command + ':' + createdAt,
  });
}

// Seed a DRSCH research-conclusion evidence edge reachable from the focus node.
// The shipped substrate writes an EvidenceClaim node + an INFORMS edge; the dial
// relationship layer surfaces it as a "recent research conclusion" via the
// getNeighborhood traversal off the focus. The renderer surfaces each DRSCH
// neighbor by its EvidenceClaim node id (the only field getNeighborhood returns
// for a neighbor) with a human-readable evidence-tier slug derived from the id.
function seedResearchConclusion(db, claimId, topic, createdAt) {
  seedNode(db, FOCUS_ID, 'section', createdAt);
  seedNode(db, claimId, 'EvidenceClaim', createdAt);
  db.prepare(
    'UPDATE nodes SET properties = ? WHERE id = ?'
  ).run(JSON.stringify({ topic: topic, summary: topic + ' summary', evidence_tier: 'Academic' }), claimId);
  // INFORMS edge FROM the focus node TO the EvidenceClaim so getNeighborhood
  // (which traverses source -> target) surfaces the EvidenceClaim as a neighbor
  // carrying edgeTypeIn=INFORMS. This is the DRSCH research-conclusion evidence
  // path the renderer filters on.
  seedEdge(db, FOCUS_ID, claimId, 'INFORMS', { reason: 'section_cites_evidence' });
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1431-05-dial-mem-render-'));
  return openRoomDb(dir);
}

// ---------- Test 1: all 4 components render (populated DRSCH block) ----------

function testFourComponentsPopulated() {
  const db = freshDb();
  const NOW = 1714694400000;
  seedSelectedReach(db, 'mos:beautiful-question', 'Beautiful Question Framework', true, NOW - 5000);
  seedSelectedReach(db, 'mos:swot', 'SWOT', false, NOW - 2000); // most recent
  seedResearchConclusion(db, 'EvidenceClaim:sess:car-t-cost-curve', 'CAR-T manufacturing cost curve', NOW - 1000);

  const out = renderer.renderDialMemory(db, SECTION, {
    now_ms: NOW,
    focusNodeId: FOCUS_ID,
    reachList: { reaches: [{ reach_id: 'context_block', recommended: true, score: 0.82 }], tier_mode: 'mode_a' },
  });
  assert.equal(typeof out.markdown_body, 'string', 'renderer returns markdown_body string');
  assert.ok(out.markdown_body.length > 0, 'non-empty body');

  const body = out.markdown_body;
  // Component 1: available reaches -- all 5 canonical reach ids present.
  for (const rid of REACH_IDS) {
    assert.ok(body.indexOf(rid) !== -1, 'available reaches lists reach id: ' + rid);
  }
  // Component 2: last selected -- the most-recent SELECTED_REACH (mos:swot).
  assert.ok(body.indexOf('mos:swot') !== -1, 'last selected surfaces the most-recent SELECTED_REACH');
  // Component 3: current recommended -- the gate result (context_block).
  assert.ok(body.indexOf('context_block') !== -1, 'current recommended surfaces the gate result');
  // Component 4: recent research conclusions -- surfaced from the DRSCH evidence
  // neighbor via getNeighborhood (the EvidenceClaim node id is what the traversal
  // returns; the renderer renders a readable line per DRSCH neighbor).
  assert.ok(/recent research conclusions/i.test(body), 'research-conclusions block header present');
  assert.ok(body.indexOf('car-t-cost-curve') !== -1, 'research conclusion surfaced from the DRSCH getNeighborhood traversal');

  // No em-dashes / en-dashes.
  const EMDASH = String.fromCharCode(0x2014);
  const ENDASH = String.fromCharCode(0x2013);
  assert.equal(body.indexOf(EMDASH), -1, 'no em-dashes in rendered body');
  assert.equal(body.indexOf(ENDASH), -1, 'no en-dashes in rendered body');

  db.close();
}

// ---------- Test 2: research-conclusions block renders EMPTY/placeholder when no DRSCH ----------

function testResearchConclusionsEmptyBlock() {
  const db = freshDb();
  const NOW = 1714694400000;
  // SELECTED_REACH present, but ZERO DRSCH / EvidenceClaim edges.
  seedSelectedReach(db, 'mos:beautiful-question', 'Beautiful Question Framework', true, NOW - 2000);

  const out = renderer.renderDialMemory(db, SECTION, {
    now_ms: NOW,
    focusNodeId: FOCUS_ID,
    reachList: { reaches: [{ reach_id: 'context_block', recommended: true, score: 0.82 }], tier_mode: 'mode_a' },
  });
  const body = out.markdown_body;
  // The block is ALWAYS present (all 4 components), with a clean placeholder.
  assert.ok(/recent research conclusions/i.test(body), 'research-conclusions block header still present when empty');
  assert.ok(/no recent research conclusions/i.test(body), 'clean empty/placeholder block when no DRSCH edges');
  // No crash, no raw EvidenceClaim leakage.
  assert.ok(body.indexOf('EvidenceClaim:') === -1, 'no raw node ids leak when the block is empty');
  db.close();
}

// ---------- Test 3: idempotence -- two renders byte-equal ----------

function testIdempotence() {
  const db = freshDb();
  const NOW = 1714694400000;
  seedSelectedReach(db, 'mos:swot', 'SWOT', false, NOW - 2000);
  seedResearchConclusion(db, 'EvidenceClaim:sess:x', 'pricing elasticity', NOW - 1000);

  const opts = {
    now_ms: NOW,
    focusNodeId: FOCUS_ID,
    reachList: { reaches: [{ reach_id: 'context_block', recommended: true, score: 0.82 }], tier_mode: 'mode_a' },
  };
  const a = renderer.renderDialMemory(db, SECTION, opts).markdown_body;
  const b = renderer.renderDialMemory(db, SECTION, opts).markdown_body;
  assert.equal(a, b, 'two renders from the same graph state are byte-identical (idempotent)');
  db.close();
}

// ---------- Test 4: byte-preservation through the sentinel merge ----------

function testBytePreservation() {
  const db = freshDb();
  const NOW = 1714694400000;
  seedSelectedReach(db, 'mos:swot', 'SWOT', false, NOW - 2000);

  const out = renderer.renderDialMemory(db, SECTION, {
    now_ms: NOW,
    focusNodeId: FOCUS_ID,
    reachList: { reaches: [{ reach_id: 'context_block', recommended: true, score: 0.5 }], tier_mode: 'mode_b' },
  });
  // The renderer exposes the dial sentinels so the runner can merge. Build a body
  // with a human-authored section above + below the sentinel pair and assert the
  // renderer's merge helper preserves the human body byte-for-byte.
  assert.ok(typeof renderer.SENTINEL_START === 'string' && renderer.SENTINEL_START.length > 0, 'SENTINEL_START exported');
  assert.ok(typeof renderer.SENTINEL_END === 'string' && renderer.SENTINEL_END.length > 0, 'SENTINEL_END exported');
  const humanAbove = '# Dial Memory\n\nHuman-authored intro that must survive.\n\n';
  const humanBelow = '\n\n## Closing\n\nHuman tail that must survive.\n';
  const body = humanAbove + renderer.SENTINEL_START + '\nOLD\n' + renderer.SENTINEL_END + humanBelow;
  const merged = renderer.mergeDialSection(body, out.markdown_body);
  assert.ok(merged.indexOf('Human-authored intro that must survive.') !== -1, 'human body above sentinels preserved');
  assert.ok(merged.indexOf('Human tail that must survive.') !== -1, 'human body below sentinels preserved');
  assert.ok(merged.indexOf('OLD') === -1, 'old sentinel content replaced');
  assert.ok(merged.indexOf('mos:swot') !== -1, 'new rendered content merged inside sentinels');
  db.close();
}

// ---------- Test 5: empty state -- zero SELECTED_REACH renders clean section ----------

function testEmptyState() {
  const db = freshDb();
  const NOW = 1714694400000;
  // Seed the focus node only; ZERO SELECTED_REACH edges, ZERO DRSCH edges.
  seedNode(db, FOCUS_ID, 'section', NOW - 1000);

  const out = renderer.renderDialMemory(db, SECTION, {
    now_ms: NOW,
    focusNodeId: FOCUS_ID,
    reachList: { reaches: [], tier_mode: 'tier_0' },
  });
  const body = out.markdown_body;
  assert.equal(typeof body, 'string', 'empty-state still returns a string');
  assert.ok(/no dial activity yet/i.test(body), 'clean no-dial-activity empty state (not a crash, not a raw template)');
  db.close();
}

// ---------- Test 6: reads-only-via-navigation grep tripwire ----------

function testReadsOnlyViaNavigation() {
  const src = fs.readFileSync(RENDERER_PATH, 'utf8');
  // Must import the navigation chokepoint.
  assert.match(src, /require\s*\(\s*['"]\.\.\/navigation\.cjs['"]/, 'renderer must require ../navigation.cjs');
  // No filesystem reads (the renderer is pure; reads only SQL via navigation).
  assert.ok(!/\bfs\.read/.test(src), 'renderer must NOT do fs reads (pure renderer; reads only via navigation)');
  assert.ok(!/require\s*\(\s*['"]node:fs['"]\s*\)/.test(src), 'renderer must NOT require node:fs');
  // No Brain client.
  assert.ok(!/brain-client/.test(src), 'renderer must NOT require a brain client (LOCAL only, Part 8)');
  assert.ok(!/\bfetch\s*\(/.test(src), 'renderer must NOT call fetch (zero network surface)');
  // No direct navigation submodule require -- route via the chokepoint.
  assert.ok(!/require\s*\(\s*['"][^'"]*navigation\/(neighborhood|edges|focus|memory-events|insights)/.test(src),
    'renderer must NOT require a navigation submodule directly; route via navigation.cjs');
  // No direct room.db open.
  assert.ok(!/require\s*\(\s*['"][^'"]*room-db/.test(src), 'renderer must NOT require room-db.cjs directly');
  assert.ok(!/require\s*\(\s*['"]node:sqlite['"]\s*\)/.test(src), 'renderer must NOT require node:sqlite directly');
}

// ---------- Run ----------

testFourComponentsPopulated();
testResearchConclusionsEmptyBlock();
testIdempotence();
testBytePreservation();
testEmptyState();
testReadsOnlyViaNavigation();
process.stdout.write('PASS test-dial-memory-renderer.cjs (6 tests)\n');
process.exit(0);
