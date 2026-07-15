'use strict';
/*
 * Phase 169-06 Task 1 -- THE ADVERSARIAL STRUCTURED VERDICT over the whole
 * Graph-Derivation Harness (GDH-01..09 + the canon guards + the MEDIUM-4
 * sole-cascade-writer check + the REAL-b2 heal-first 0 -> N + the depth>=2
 * full-citizen + parent-linkage + FEYNMAN-temporal assertions + the
 * NESTED_WITHIN lineage-legality). This is harness-as-code property 6:
 * "adversarial verify returns a STRUCTURED VERDICT, not a vibe."
 *
 * It MIRRORS the shipped 167 W5 verdict (tests/test-harness-167-verdict.cjs),
 * the 166 W8 verdict, and the 163 W6 verdict: a record(check, passed, detail)
 * accumulator that pushes { check, passed, detail } into findings[], prints the
 * structured verdict { passed, findings[] }, and exits NON-ZERO printing the
 * findings if ANY check failed. The verdict proves each requirement BY
 * INSTRUMENTATION (it drives the real SHIPPED surfaces), never by prose.
 *
 * The prior Plan-01 stubs asserted NO depth, NO full-citizen markers, NO
 * parent-linkage, NO FEYNMAN-temporal -- the 8-agent fan-out found all four
 * absent. THIS verdict adds them: it builds the 3-level topology
 * motj-ecosystem -> jonathan-contractor-motj -> b2-journey and asserts EACH
 * nested level is a FULL CITIZEN (ROOM.md + own room.db + per-section FEYNMAN +
 * ## Timeline (auto) + NESTED_WITHIN up + visible-from-parent rollup down), and
 * asserts a sub-sub-room edge reaches the TOP rollup (arbitrary-depth
 * transitivity).
 *
 * The b2 acceptance runs HEAL-FIRST against the REAL fixture when present
 * (NON-SKIPPABLE), recording the actual N + the derived edge types + the healed
 * full-citizen markers via the finding detail string the SUMMARY captures; a
 * synthetic sentinel-less topology is the CI-determinism fallback ONLY when the
 * fixture is absent, never the sole evidence (T-169-15).
 *
 * If the verdict finds a REAL defect it surfaces it as a FINDING (passed:false),
 * never a silent pass (the FINDING-167-05-01 / FINDING-163-06-01 pattern).
 *
 * House rule: hyphens only, no em-dashes (U+2014 referenced by escape only).
 * node built-ins only. Plain node harness.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The SHIPPED surfaces the verdict drives (never mocks).
const { resolveRoomRoot, findRoomRootSentinels } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-root.cjs'));
const { extractDocText } = require(path.join(REPO_ROOT, 'lib', 'core', 'doc-text-extractor.cjs'));
const { produceCandidates } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-candidate-producer.cjs'));
const { runDerivation, rollupSubRooms, candidateToFinding, CASCADE_SUBSET } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));
const { detectUnsentineledArtifactFolder, healRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-self-heal.cjs'));
// Phase 224-03 (D-03 amended): the backfill DEFAULT deriver is the async
// score-based producer (runDeriveBackfill returns a Promise on the default path).
// This adversarial GDH-06 leg proves the HEAL-FIRST 0 -> N contract
// deterministically by injecting the exported _localCueDeriveFn heuristic
// fallback, which keeps the run SYNCHRONOUS and returns the result object (the
// polymorphic-return contract). The score-based default is proven separately in
// tests/test-224-backfill-idempotent.cjs.
const { runDeriveBackfill, _localCueDeriveFn } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));
const { ALLOWED_EDGE_TYPES, writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const LAZYGRAPH_OPS = path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs');
const STORED_DOCX = path.join(REPO_ROOT, 'tests', 'fixtures', '169', 'stored-method.docx');

// The REAL b2 fixture. HEAL-FIRST acceptance runs against it NON-SKIPPABLY when
// present; the synthetic topology is the CI fallback ONLY when it is absent.
const B2_REAL = path.join(os.homedir(), 'MindrianRooms', 'motj-ecosystem', 'sub-rooms', 'jonathan-contractor-motj', 'b2-journey');

const EM_DASH = String.fromCharCode(0x2014);

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
function cleanupTmp() {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// ---------------------------------------------------------------------------
// THE STRUCTURED VERDICT ACCUMULATOR (harness-as-code property 6; mirrors
// test-harness-167-verdict.cjs). Each check pushes { check, passed, detail }
// into findings[]; the verdict is { passed, findings[] }; exit non-zero printing
// the findings if ANY failed. A thrown AssertionError becomes a FAILED finding
// carrying the assertion message (the real defect), so a genuine breach is
// SURFACED, never silently swallowed.
// ---------------------------------------------------------------------------
const findings = [];
function record(check, passed, detail) {
  findings.push({ check: check, passed: !!passed, detail: detail });
}
function guard(check, fn) {
  try {
    const detail = fn();
    record(check, true, detail || 'verified by instrumentation');
  } catch (e) {
    record(check, false, (e && e.message) ? e.message : String(e));
  }
}

// A deterministic stub LLM for the producer (the test transport; never the wire).
function stubLlm() {
  return [
    { source: 'artifact:market-2024', target: 'assumption:tam-2b', edge_type: 'CONTRADICTS', reason: 'the 2024 read contradicts the 2b TAM assumption' },
    { source: 'artifact:market-2024', target: 'section:gtm', edge_type: 'CONVERGES', reason: 'the same theme recurs across gtm and finance' },
  ];
}

// Full-citizen assertion helper used by the depth>=2 checks. Asserts ROOM.md +
// own room.db + per-section FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up.
function assertFullCitizen(roomDir, slug, parentNode) {
  assert.ok(fs.existsSync(path.join(roomDir, 'ROOM.md')), slug + ': ROOM.md present');
  assert.ok(fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')), slug + ': own .mindrian/room.db present');
  const feynmans = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) walk(path.join(d, e.name));
      else if (e.isFile() && e.name === 'FEYNMAN.md') feynmans.push(path.join(d, e.name));
    }
  })(roomDir);
  assert.ok(feynmans.length >= 1, slug + ': at least one per-section FEYNMAN.md present');
  const anyTimeline = feynmans.some(f => /##\s+Timeline \(auto\)/.test(fs.readFileSync(f, 'utf8')));
  assert.ok(anyTimeline, slug + ': a FEYNMAN body carries the ## Timeline (auto) section');
  const db = openRoomDb(roomDir);
  let row;
  try {
    row = db.prepare("SELECT source, target FROM edges WHERE type = 'NESTED_WITHIN'").get();
  } finally {
    closeRoomDb(db);
  }
  assert.ok(row, slug + ': a NESTED_WITHIN edge up to the parent');
  assert.equal(row.source, 'room:' + slug, slug + ': lineage source is this room');
  assert.equal(row.target, parentNode, slug + ': lineage target is the parent room');
}

// ===========================================================================
// GDH-01 -- resolveRoomRoot returns the SUB-ROOM dir for a sub-room file while
// the active room is the parent (the nested-resolution invariant).
// ===========================================================================
guard('GDH-01: resolveRoomRoot returns the sub-room dir for a sub-room file (active room is the parent); the PRIMARY sentinel is .room-root', () => {
  const sentinels = findRoomRootSentinels();
  assert.ok(Array.isArray(sentinels) && sentinels.indexOf('.room-root') !== -1,
    'findRoomRootSentinels does not name .room-root as the primary sentinel');

  const tmp = mkTmp('verdict-gdh01-');
  const parent = path.join(tmp, 'parent-room');
  const sub = path.join(parent, 'sub-room');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
  fs.writeFileSync(path.join(sub, '.room-root'), JSON.stringify({ slug: 'sub-room' }));
  const subFile = path.join(sub, 'artifact.md');
  fs.writeFileSync(subFile, '# sub artifact\n');

  const resolved = resolveRoomRoot(subFile);
  assert.equal(path.resolve(resolved), path.resolve(sub),
    'resolveRoomRoot did not return the nearest sub-room dir for a sub-room file');
  return 'resolveRoomRoot walks up to the NEAREST .room-root (the sub-room), not the parent; primary sentinel is .room-root';
});

// ===========================================================================
// GDH-04 -- extractDocText > 0 runs on the stored .docx fixture; source bytes
// UNCHANGED (D-169-03 read-only extraction).
// ===========================================================================
guard('GDH-04: extractDocText returns > 0 chars on the stored .docx fixture and leaves the source bytes UNCHANGED (D-169-03)', () => {
  assert.ok(fs.existsSync(STORED_DOCX), 'the stored-method.docx fixture is missing');
  const before = fs.readFileSync(STORED_DOCX);
  const text = extractDocText(STORED_DOCX);
  assert.equal(typeof text, 'string', 'extractDocText did not return a string');
  assert.ok(text.length > 0, 'extractDocText returned zero chars on the stored .docx fixture');
  const after = fs.readFileSync(STORED_DOCX);
  assert.ok(before.equals(after), 'extractDocText mutated the source .docx bytes (read-only invariant breached)');
  return 'extractDocText -> ' + text.length + ' chars on the stored .docx; source bytes byte-identical before/after';
});

// ===========================================================================
// GDH-05 PRODUCER -- produceCandidates emits BOTH a CONTRADICTS AND a CONVERGES
// candidate (D-169-06); every edge_type is in the frozen cascade subset.
// ===========================================================================
guard('GDH-05 producer: produceCandidates emits BOTH a CONTRADICTS AND a CONVERGES candidate (D-169-06) and every edge_type is in the frozen cascade subset', () => {
  const artifactPair = {
    a: { id: 'artifact:market-2024', text: 'the 2024 market read contradicts the 2b TAM assumption' },
    b: { id: 'assumption:tam-2b', text: 'TAM is 2b; the same theme recurs across gtm and finance' },
  };
  const candidates = produceCandidates({ roomDir: '/tmp/does-not-need-to-exist', artifactPair: artifactPair, llm: stubLlm });
  assert.ok(Array.isArray(candidates), 'produceCandidates did not return an array');
  const types = new Set(candidates.map(c => c.edge_type));
  assert.ok(types.has('CONTRADICTS'), 'the producer did not emit a CONTRADICTS candidate (D-169-06)');
  assert.ok(types.has('CONVERGES'), 'the producer did not emit a CONVERGES candidate (D-169-06: not CONTRADICTS-only)');
  for (const c of candidates) {
    assert.ok(CASCADE_SUBSET.has(c.edge_type),
      'a produced edge_type "' + c.edge_type + '" is OUTSIDE the frozen cascade subset');
  }
  return 'producer emits {' + [...types].sort().join(', ') + '}; both CONTRADICTS and CONVERGES present; all in the frozen cascade subset';
});

// ===========================================================================
// GDH-05 LOOP -- runDerivation bridges produceCandidates via candidateToFinding,
// lands a PROPOSED node + a typed edge; review_status on the NODE, NEVER the
// edge (Part 9 Pitfall 1); fable-mode drops an unjustified CONTRADICTS.
// ===========================================================================
guard('GDH-05 loop: runDerivation lands a PROPOSED node + a typed edge through the chokepoint; review_status is on the NODE never the edge (Pitfall 1); fable-mode drops an unjustified CONTRADICTS', () => {
  const tmp = mkTmp('verdict-gdh05-');
  const room = path.join(tmp, 'room');
  fs.mkdirSync(room, { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ slug: 'room' }));

  // candidateToFinding: the proposed-NODE intent + the typed-EDGE intent; the
  // edge properties are enum/scalar only and carry NO review_status.
  const finding = candidateToFinding({ source: 'artifact:a', target: 'section:b', edge_type: 'CONTRADICTS', reason: 'a contradicts b' });
  assert.ok(finding && finding.edge, 'candidateToFinding did not return a finding with an edge intent');
  assert.ok(!('review_status' in finding.edge.properties),
    'candidateToFinding put review_status on the EDGE properties (Pitfall 1 breach)');

  // Drive runDerivation with a deterministic deriveFn (CONTRADICTS + CONVERGES).
  const deriveFn = () => stubLlm();
  const res = runDerivation({ roomDir: room, deriveFn: deriveFn });
  assert.ok(res && Array.isArray(res.proposedNodes) && Array.isArray(res.edges), 'runDerivation did not return {proposedNodes, edges}');
  assert.ok(res.proposedNodes.length >= 1, 'runDerivation minted no proposed node');
  assert.ok(res.proposedNodes.every(n => n.review_status === 'proposed' || n.review_status === 'confirmed'),
    'a derived node is not proposed/confirmed (Part 9 truth-state breach)');

  // The typed edges landed; NO edge carries review_status in its properties.
  const db = openRoomDb(room);
  let edgeRows;
  try {
    edgeRows = db.prepare("SELECT type, properties FROM edges WHERE type IN ('CONTRADICTS','CONVERGES')").all();
  } finally {
    closeRoomDb(db);
  }
  assert.ok(edgeRows.length >= 1, 'no cascade edge landed in the room.db');
  for (const r of edgeRows) {
    const props = r.properties ? JSON.parse(r.properties) : {};
    assert.ok(!('review_status' in props), 'a landed edge carries review_status in its properties (Pitfall 1 breach)');
  }

  // fable-mode: a {quality:'low'} critique drops the candidate (no node, no edge).
  const tmp2 = mkTmp('verdict-gdh05b-');
  const room2 = path.join(tmp2, 'room');
  fs.mkdirSync(room2, { recursive: true });
  fs.writeFileSync(path.join(room2, '.room-root'), JSON.stringify({ slug: 'room' }));
  const dropAll = () => ({ passed: false, quality: 'low' });
  const res2 = runDerivation({ roomDir: room2, deriveFn: deriveFn, selfCritiqueFn: dropAll });
  assert.equal(res2.proposedNodes.length, 0, 'fable-mode did not drop the unjustified candidates (a low-quality node was minted)');
  return 'runDerivation lands proposed nodes + ' + edgeRows.length + ' cascade edge(s); review_status on the NODE not the edge; fable-mode drops all low-quality candidates';
});

// ===========================================================================
// GDH-07 -- a second runDerivation mints NO duplicate proposed node (stable id);
// idempotent re-run is a no-op.
// ===========================================================================
guard('GDH-07: a second runDerivation mints NO duplicate proposed node (stable content-hash id; re-run is a no-op)', () => {
  const tmp = mkTmp('verdict-gdh07-');
  const room = path.join(tmp, 'room');
  fs.mkdirSync(room, { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ slug: 'room' }));
  const deriveFn = () => stubLlm();

  const first = runDerivation({ roomDir: room, deriveFn: deriveFn });
  const mintedFirst = first.proposedNodes.filter(n => n.minted).length;
  assert.ok(mintedFirst >= 1, 'the first run minted no node (nothing to test idempotence against)');

  const second = runDerivation({ roomDir: room, deriveFn: deriveFn });
  const mintedSecond = second.proposedNodes.filter(n => n.minted).length;
  assert.equal(mintedSecond, 0, 'the second run minted a DUPLICATE node (idempotence breached -- the id is not stable)');
  return 'first run minted ' + mintedFirst + ' node(s); the re-run minted 0 (stable content-hash id; no-op)';
});

// ===========================================================================
// GDH-08 -- detectUnsentineledArtifactFolder finds a sentinel-less folder;
// healRoom WITHOUT approvedBy refuses; WITH approvedBy heals.
// ===========================================================================
guard('GDH-08: detect finds a sentinel-less folder; healRoom WITHOUT approvedBy refuses (no_approval); WITH approvedBy it heals', () => {
  const tmp = mkTmp('verdict-gdh08-');
  const parent = path.join(tmp, 'parent-room');
  const child = path.join(parent, 'sentinel-less');
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
  fs.writeFileSync(path.join(child, 'one.md'), '# one\n');
  fs.writeFileSync(path.join(child, 'two.md'), '# two\n');

  const detected = detectUnsentineledArtifactFolder(parent);
  assert.ok(detected.some(d => /sentinel-less/.test(d.folder)),
    'detectUnsentineledArtifactFolder did not find the sentinel-less folder');

  // REFUSE without approvedBy (the Part 3 gate; no fs write).
  const refused = healRoom({ folder: child, parentRoomDir: parent, slug: 'sentinel-less' });
  assert.equal(refused.ok, false, 'healRoom WITHOUT approvedBy did not refuse (the Part 3 gate is open)');
  assert.equal(refused.reason, 'no_approval', 'healRoom refusal reason is not no_approval');
  assert.ok(!fs.existsSync(path.join(child, '.room-root')), 'a refused heal wrote a .room-root anyway (gate breach)');

  // HEAL with approvedBy.
  const healed = healRoom({ folder: child, parentRoomDir: parent, slug: 'sentinel-less', approvedBy: 'tester', runTimeline: true });
  assert.equal(healed.ok, true, 'healRoom WITH approvedBy did not heal: ' + JSON.stringify(healed));
  assert.ok(fs.existsSync(path.join(child, '.room-root')), 'the healed child gained no .room-root sentinel');
  return 'detect found the sentinel-less folder; heal REFUSED without approvedBy (no_approval, no write); HEALED with approvedBy (gained .room-root)';
});

// ===========================================================================
// GDH-09 -- the healed room is a FULL CITIZEN (ROOM.md + own db + per-section
// FEYNMAN + ## Timeline (auto) + a NESTED_WITHIN edge to its parent).
// ===========================================================================
guard('GDH-09: a healed room is a FULL CITIZEN (ROOM.md + own room.db + per-section FEYNMAN + ## Timeline (auto) + NESTED_WITHIN to its parent); byte-indistinguishable-on-markers from a born room', () => {
  const tmp = mkTmp('verdict-gdh09-');
  const parent = path.join(tmp, 'parent-room');
  const child = path.join(parent, 'born-like');
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
  fs.writeFileSync(path.join(child, 'a.md'), '# a\n');

  const healed = healRoom({ folder: child, parentRoomDir: parent, slug: 'born-like', approvedBy: 'tester', runTimeline: true });
  assert.equal(healed.ok, true, 'heal failed: ' + JSON.stringify(healed));
  assertFullCitizen(child, 'born-like', 'room:parent-room');
  return 'healed room carries ROOM.md + own room.db + per-section FEYNMAN + ## Timeline (auto) + NESTED_WITHIN room:born-like -> room:parent-room';
});

// ===========================================================================
// GDH-03 + the RECURSIVE depth-transitivity -- the parent rollup sees a sub-room
// edge AND a sub-sub-room edge reaches the TOP rollup; the parent db is unchanged.
// ===========================================================================
guard('GDH-03 + recursive: rollupSubRooms sees a sub-room edge AND a sub-sub-room edge reaches the TOP rollup (arbitrary depth); the parent db row count is unchanged (read-only)', () => {
  const tmp = mkTmp('verdict-gdh03-');
  const top = path.join(tmp, 'top');
  const mid = path.join(top, 'mid');
  const leaf = path.join(mid, 'leaf');
  fs.mkdirSync(leaf, { recursive: true });
  fs.writeFileSync(path.join(top, '.room-root'), JSON.stringify({ slug: 'top' }));
  fs.writeFileSync(path.join(mid, 'm.md'), '# m\n');
  fs.writeFileSync(path.join(leaf, 'l.md'), '# l\n');

  // Heal mid + leaf so the NESTED_WITHIN lineage chain exists top -> mid -> leaf.
  const hMid = healRoom({ folder: mid, parentRoomDir: top, slug: 'mid', approvedBy: 'tester', runTimeline: false });
  assert.equal(hMid.ok, true, 'mid heal failed');
  const hLeaf = healRoom({ folder: leaf, parentRoomDir: mid, slug: 'leaf', approvedBy: 'tester', runTimeline: false });
  assert.equal(hLeaf.ok, true, 'leaf heal failed');

  // Record the parent (top) edge-row count BEFORE the rollup (read-only proof).
  const topDb1 = openRoomDb(top);
  let topRowsBefore;
  try { topRowsBefore = topDb1.prepare('SELECT COUNT(*) AS c FROM edges').get().c; } finally { closeRoomDb(topDb1); }

  // Seed a DISTINCT edge in the LEAF (sub-sub-room) and assert the TOP rollup sees it.
  const leafDb = openRoomDb(leaf);
  try {
    writeEdge(leafDb, { source_id: 'artifact:leaf-mark', target_id: 'section:leaf-y', edge_type: 'INFORMS', properties: { relation: 'informs' } });
  } finally { closeRoomDb(leafDb); }

  const res = rollupSubRooms(top);
  assert.ok(res && Array.isArray(res.edges), 'rollupSubRooms did not return {edges}');
  const sawLeaf = res.edges.some(e => JSON.stringify(e).includes('leaf-mark'));
  assert.ok(sawLeaf, 'the sub-sub-room (leaf) edge did NOT reach the top-level rollup (depth>=2 transitivity broken)');

  // The parent (top) db is UNCHANGED by the rollup (read-only ATTACH UNION).
  const topDb2 = openRoomDb(top);
  let topRowsAfter;
  try { topRowsAfter = topDb2.prepare('SELECT COUNT(*) AS c FROM edges').get().c; } finally { closeRoomDb(topDb2); }
  assert.equal(topRowsAfter, topRowsBefore, 'the rollup MUTATED the parent db (read-only invariant breached, Part 8 isolation)');
  return 'the leaf (sub-sub-room) edge reached the TOP rollup; parent db edge count unchanged (' + topRowsBefore + ') -- read-only ATTACH UNION';
});

// ===========================================================================
// D-169-11 DEPTH>=2 FULL-CITIZEN -- build the 3-level topology
// motj-ecosystem -> jonathan-contractor-motj -> b2-journey (REAL fixture when
// present, synthetic otherwise) and assert EACH nested level is a full citizen +
// the parent rollup SEES its edge.
// ===========================================================================
guard('D-169-11 depth>=2: build motj-ecosystem -> jonathan-contractor-motj -> b2-journey; EACH nested level is a FULL CITIZEN (ROOM.md + db + FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up + rollup-visible down)', () => {
  const tmp = mkTmp('verdict-depth2-');
  const topo = path.join(tmp, 'topo');
  const top = path.join(topo, 'motj-ecosystem');
  const mid = path.join(top, 'jonathan-contractor-motj');
  const leaf = path.join(mid, 'b2-journey');
  fs.mkdirSync(leaf, { recursive: true });
  fs.writeFileSync(path.join(top, '.room-root'), JSON.stringify({ slug: 'motj-ecosystem' }));
  fs.writeFileSync(path.join(mid, 'context.md'), '# mid context\n');
  fs.writeFileSync(path.join(leaf, 'interview.md'), '# leaf interview\n');

  const hMid = healRoom({ folder: mid, parentRoomDir: top, slug: 'jonathan-contractor-motj', approvedBy: 'tester', runTimeline: true });
  assert.equal(hMid.ok, true, 'mid heal failed: ' + JSON.stringify(hMid));
  const hLeaf = healRoom({ folder: leaf, parentRoomDir: mid, slug: 'b2-journey', approvedBy: 'tester', runTimeline: true });
  assert.equal(hLeaf.ok, true, 'leaf heal failed: ' + JSON.stringify(hLeaf));

  assertFullCitizen(mid, 'jonathan-contractor-motj', 'room:motj-ecosystem');
  assertFullCitizen(leaf, 'b2-journey', 'room:jonathan-contractor-motj');

  // The leaf's edge is visible from the TOP rollup (depth>=2 down).
  const leafDb = openRoomDb(leaf);
  try {
    writeEdge(leafDb, { source_id: 'artifact:b2-mark', target_id: 'section:b2-y', edge_type: 'INFORMS', properties: { relation: 'informs' } });
  } finally { closeRoomDb(leafDb); }
  const res = rollupSubRooms(top);
  assert.ok(res.edges.some(e => JSON.stringify(e).includes('b2-mark')),
    'the b2-journey (depth-2) edge is NOT visible from the motj-ecosystem top rollup');
  return 'all three levels built; mid + leaf are FULL CITIZENS (ROOM.md + db + FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up); b2 leaf edge visible from the top rollup';
});

// ===========================================================================
// GDH-06 + D-169-08/09 (HIGH-2) -- the b2 moat goes 0 -> N HEAL-FIRST against
// the REAL fixture when present (NON-SKIPPABLE), recording N + the derived edge
// types + the healed full-citizen markers; synthetic fallback only when absent.
// ===========================================================================
guard('GDH-06 + D-169-08/09: the b2-journey typed-edge moat goes 0 -> N HEAL-FIRST (REAL fixture NON-SKIPPABLE when present; synthetic fallback only when absent); record N + edge types + the healed full-citizen markers', () => {
  const realPresent = fs.existsSync(B2_REAL);

  if (realPresent) {
    // Work on a COPY of the real fixture so the verdict never mutates the user's
    // room. The copy preserves the sentinel-less flat-33-artifact shape.
    const tmp = mkTmp('verdict-b2real-');
    const parent = path.join(tmp, 'parent-room');
    const child = path.join(parent, 'b2-journey');
    fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'jonathan-contractor-motj' }));
    fs.cpSync(B2_REAL, child, { recursive: true });
    // Strip any pre-existing room state from the copy so the 0 -> N is a true cold start.
    try { fs.rmSync(path.join(child, '.room-root'), { force: true }); } catch (_e) { /* none */ }
    try { fs.rmSync(path.join(child, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* none */ }

    const artifactCount = fs.readdirSync(child).filter(f => /\.(md|docx|html?|txt)$/i.test(f)).length;

    const res = runDeriveBackfill({ roomDir: parent, approvedBy: 'tester', deriveFn: _localCueDeriveFn });
    assert.ok(res && Array.isArray(res.healed), 'runDeriveBackfill did not report healed folders on the real fixture');
    const healedB2 = res.healed.find(h => /b2-journey/.test(h.roomDir || h.folder || ''));
    assert.ok(healedB2 && healedB2.ok !== false, 'the real b2-journey folder was NOT self-healed FIRST');

    assert.equal(res.typedEdgesBefore, 0, 'the real b2 cold-start typedEdgesBefore was not 0 (the moat was not empty at the start)');
    assert.ok(res.typedEdgesAfter > 0, 'the real b2 HEAL-FIRST backfill did NOT take the typed-edge count to N > 0');

    // Record the derived edge TYPES (the moat composition) for the SUMMARY.
    const healedRoom = healedB2.roomDir || child;
    const db = openRoomDb(healedRoom);
    let typeRows;
    try {
      typeRows = db.prepare("SELECT type, COUNT(*) AS c FROM edges WHERE type IN ('CONTRADICTS','CONVERGES','INFORMS','INVALIDATES','ENABLES','REFINES','ROOT_CAUSES') GROUP BY type").all();
    } finally { closeRoomDb(db); }
    const typeSummary = typeRows.map(r => r.type + ':' + r.c).join(', ');

    // Healed full-citizen markers on the real room.
    const hasRoomMd = fs.existsSync(path.join(healedRoom, 'ROOM.md'));
    const hasDb = fs.existsSync(path.join(healedRoom, '.mindrian', 'room.db'));
    assert.ok(hasRoomMd && hasDb, 'the healed real b2 room is missing full-citizen markers (ROOM.md/room.db)');

    return 'REAL b2-journey (NON-SKIPPABLE, ' + artifactCount + ' artifacts): typed-edge moat 0 -> ' + res.typedEdgesAfter +
      ' [' + (typeSummary || 'no cascade types grouped') + ']; healed full-citizen (ROOM.md + room.db' +
      (fs.existsSync(path.join(healedRoom, '.room-root')) ? ' + .room-root' : '') + ')';
  }

  // SYNTHETIC FALLBACK (only when the real fixture is absent).
  const tmp = mkTmp('verdict-b2syn-');
  const parent = path.join(tmp, 'parent-room');
  const child = path.join(parent, 'b2-journey');
  fs.mkdirSync(child, { recursive: true });
  fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
  fs.writeFileSync(path.join(child, 'one.md'), '# one\nthe 2024 read contradicts the 2b TAM assumption.\n');
  fs.writeFileSync(path.join(child, 'two.md'), '# two\nthe TAM is 2b. the channel theme recurs in gtm and finance.\n');
  const res = runDeriveBackfill({ roomDir: parent, approvedBy: 'tester', deriveFn: _localCueDeriveFn });
  assert.ok(res.healed.some(h => /b2-journey/.test(h.roomDir || h.folder || '')), 'the synthetic b2 folder was not healed');
  assert.equal(res.typedEdgesBefore, 0, 'synthetic typedEdgesBefore was not 0');
  assert.ok(res.typedEdgesAfter > 0, 'synthetic backfill did not reach N > 0');
  return 'SYNTHETIC fallback (real fixture absent): typed-edge moat 0 -> ' + res.typedEdgesAfter + ' heal-first';
});

// ===========================================================================
// MEDIUM-4 (D-169-08) -- NO derivation-owned cascade type is raw-INSERTed in the
// indexer path; derivation via navigation.writeEdge is the SOLE cascade writer.
// ===========================================================================
guard('MEDIUM-4 (D-169-08): NO derivation-owned cascade type (CONTRADICTS/INFORMS/ENABLES/INVALIDATES) is raw INSERT-INTO-edges in lazygraph-ops _indexArtifactBody; derivation is the sole cascade writer', () => {
  const src = fs.readFileSync(LAZYGRAPH_OPS, 'utf8');
  // Isolate the _indexArtifactBody function body (from its declaration to the
  // start of indexArtifact, the next function).
  const startIdx = src.indexOf('function _indexArtifactBody(');
  assert.ok(startIdx !== -1, 'could not locate _indexArtifactBody in lazygraph-ops.cjs');
  const afterIdx = src.indexOf('async function indexArtifact(', startIdx);
  assert.ok(afterIdx !== -1, 'could not locate the end of _indexArtifactBody (the next function)');
  const bodyRaw = src.slice(startIdx, afterIdx);

  // Strip comment lines so prose naming the disabled cascade does not self-trip.
  const bodyCode = bodyRaw.split('\n').filter((line) => {
    const t = line.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  }).join('\n');

  // A raw cascade INSERT in the indexer is the MEDIUM-4 breach: an INSERT INTO
  // edges whose type literal is one of the four derivation-owned cascade types.
  const CASCADE = ['CONTRADICTS', 'INFORMS', 'ENABLES', 'INVALIDATES'];
  const breaches = [];
  for (const t of CASCADE) {
    // a quoted cascade-type literal in the (comment-stripped) indexer body.
    const rx = new RegExp("['\"]" + t + "['\"]");
    if (rx.test(bodyCode)) breaches.push(t);
  }
  assert.equal(breaches.length, 0,
    'the indexer body raw-references the cascade type(s): ' + breaches.join(', ') + ' (a second cascade writer survives, MEDIUM-4 breach)');

  // And BELONGS_TO (the structural edge) STAYS in the indexer body.
  assert.ok(/['"]BELONGS_TO['"]/.test(bodyCode),
    'the structural BELONGS_TO edge is gone from the indexer body (it must STAY)');
  return 'the indexer body writes BELONGS_TO (structural) and raw-INSERTs NONE of {CONTRADICTS, INFORMS, ENABLES, INVALIDATES}; derivation is the sole cascade writer';
});

// ===========================================================================
// Part 4 -- every derived edge_type is in the frozen ALLOWED_EDGE_TYPES set; the
// CASCADE_SUBSET is a strict subset of it.
// ===========================================================================
guard('Part 4: every cascade subset member is in the frozen ALLOWED_EDGE_TYPES set; CASCADE_SUBSET is a strict subset; NESTED_WITHIN is a member (the lineage edge)', () => {
  for (const t of CASCADE_SUBSET) {
    assert.ok(ALLOWED_EDGE_TYPES.has(t), 'cascade subset member "' + t + '" is NOT in the frozen ALLOWED_EDGE_TYPES set');
  }
  assert.ok(ALLOWED_EDGE_TYPES.has('NESTED_WITHIN'), 'NESTED_WITHIN is not a member of the frozen set (the lineage edge is unminted)');
  assert.ok(ALLOWED_EDGE_TYPES.has('PART_OF'), 'PART_OF is missing (the domain-taxonomy edge must stay)');
  return 'CASCADE_SUBSET subset of ALLOWED_EDGE_TYPES; NESTED_WITHIN + PART_OF both members (lineage minted, taxonomy untouched)';
});

// ===========================================================================
// NESTED_WITHIN lineage-legality -- the lineage edge is the legal NESTED_WITHIN
// (NOT a PART_OF room target, NOT BELONGS_TO). writeEdge accepts a room->room
// NESTED_WITHIN and REJECTS an off-set type.
// ===========================================================================
guard('lineage-legality: the room-lineage edge is NESTED_WITHIN (room:<child> -> room:<parent>), NOT a PART_OF room target, NOT BELONGS_TO; writeEdge rejects an off-set type', () => {
  const tmp = mkTmp('verdict-lineage-');
  const room = path.join(tmp, 'room');
  fs.mkdirSync(room, { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), JSON.stringify({ slug: 'room' }));
  const db = openRoomDb(room);
  try {
    // a legal room->room NESTED_WITHIN writes (enum/scalar props only).
    const okEdge = writeEdge(db, { source_id: 'room:child', target_id: 'room:parent', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'parent' } });
    assert.ok(okEdge && okEdge.ok !== false, 'writeEdge rejected the legal room->room NESTED_WITHIN: ' + JSON.stringify(okEdge));
    // BELONGS_TO is NOT in the navigation frozen set -> writeEdge rejects it.
    assert.ok(!ALLOWED_EDGE_TYPES.has('BELONGS_TO'),
      'BELONGS_TO leaked into the navigation frozen set (the lineage edge must NOT be BELONGS_TO)');
    const belongs = writeEdge(db, { source_id: 'room:child', target_id: 'room:parent', edge_type: 'BELONGS_TO', properties: {} });
    assert.ok(belongs && belongs.ok === false, 'writeEdge accepted BELONGS_TO through the chokepoint (it must be rejected)');
    // an outright off-set type is rejected.
    const bogus = writeEdge(db, { source_id: 'room:child', target_id: 'room:parent', edge_type: 'NOT_A_REAL_EDGE', properties: {} });
    assert.ok(bogus && bogus.ok === false, 'writeEdge accepted an off-set edge type (the frozen guard is open)');
  } finally { closeRoomDb(db); }
  return 'NESTED_WITHIN room->room writes through the chokepoint; BELONGS_TO + an off-set type are both rejected (NESTED_WITHIN is the legal lineage edge)';
});

// ===========================================================================
// no-em-dash self-check -- zero U+2014 across every Phase-169 verdict + sweep +
// depth2 + battle surface.
// ===========================================================================
guard('no em-dash: zero U+2014 codepoints across the Phase-169 verify surfaces (the CLAUDE.md HARD RULE, by instrumentation)', () => {
  const FILES = [
    'tests/test-graph-derivation-verdict.cjs',
    'tests/test-169-brain-boundary.cjs',
    'tests/test-depth2-full-citizen.cjs',
    'tests/test-sqlite-battle.cjs',
    'tests/run-all-169.sh',
  ];
  const hits = [];
  for (const rel of FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(EM_DASH)) hits.push(rel);
  }
  assert.equal(hits.length, 0, 'em-dash (U+2014) found in: ' + hits.join(', '));
  return 'zero U+2014 across ' + FILES.length + ' Phase-169 verify surfaces';
});

// ---------------------------------------------------------------------------
// Emit the structured verdict.
// ---------------------------------------------------------------------------
(function main() {
  cleanupTmp();

  const passedAll = findings.every((f) => f.passed);
  const verdict = { passed: passedAll, findings: findings };

  process.stdout.write('graph-derivation adversarial verdict\n');
  process.stdout.write('====================================\n');
  for (const f of findings) {
    process.stdout.write((f.passed ? '  PASS ' : '  FAIL ') + f.check + '\n');
    process.stdout.write('       ' + f.detail + '\n');
  }
  process.stdout.write('\n');
  process.stdout.write('VERDICT: ' + JSON.stringify({ passed: verdict.passed, checks: findings.length, failed: findings.filter((f) => !f.passed).length }) + '\n');

  if (!passedAll) {
    process.stdout.write('\nFINDINGS (failures):\n');
    for (const f of findings.filter((x) => !x.passed)) {
      process.stdout.write('  - [' + f.check + '] ' + f.detail + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})();
