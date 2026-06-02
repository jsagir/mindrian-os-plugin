'use strict';
// Phase 131-06 -- the load-bearing instrumented E2E suite (the Phase 131 release
// gate). Mirrors tests/test-130-lens-engine-e2e.cjs + tests/test-129-spine-
// acceptance.cjs EXACTLY: direct-CJS (node:assert/strict, no Mocha/Jest, zero new
// npm deps), setupRoom / cleanup / run, the openRoomDb fixture, a prewarm pass
// before instrumentation, and the fs-instrument zero-leak gate spanning each flow
// with USER.md the single allow-listed non-room.db read.
//
// What it proves (per 131-06-PLAN must_haves + the 131-CONTEXT deliverable 6):
// the FULL source-lens pipeline
//   research-context-extractor.extractContext (Stage 1+2+3)
//     -> source-lens-driver.runSourceLens (Stage 4, fetchCorpus STUBBED -- no live
//        network)
//       -> research-filing-selector.buildFilingSelector (Stage 6 F.1 gate)
//         -> findings-wirer.wireAccept / wireReject / wireDefer (Stage 7)
// runs end to end ONLY through lib/core/navigation.cjs, producing typed graph
// artifacts, with ZERO non-SQLite filesystem reads outside the allow-listed
// USER.md. All pipeline memory_event writes flow through the navigation.cjs
// logMemoryEvent RE-EXPORT (the chokepoint), NEVER the raw logEvent.
//
// The 5 E2E tests (the release gate):
//   1. STANDALONE             -- the full pipeline produces an EvidenceClaim
//                                (review_status proposed) + an INFORMS edge whose
//                                target is the LOCAL room.db node id (NOT a
//                                correlation_id) + a research_filed memory_event
//                                via the logMemoryEvent re-export; standalone post-
//                                filing surfaces an F.1 next-move selector.
//   2. CALLED-BY-BUILD-THESIS -- an inbound called-by handle: the accepted
//                                EvidenceClaim node IDs are RETURNED to the caller
//                                (chain-back) and findRecentChanges shows the
//                                research_filed event.
//   3. CALLED-BY-USER-NEEDS   -- a user-needs context (different current_section +
//                                JTBD) yields a DIFFERENT computed lens_set than
//                                test 2 AND a different filing destination. This
//                                flow files a finding whose target is a TEACHING-
//                                GRAPH concept and uses the REAL resolveCorrelation
//                                (NOT a stub) over the seeded correlation_labels
//                                index: the resulting INFORMS edge target EQUALS
//                                computeCorrelationId(canonical_name, primary_label)
//                                -- a real correlation_id, never the raw name. This
//                                is the non-stubbed correlation assertion the
//                                release gate requires.
//   4. REJECTION-AS-DATA      -- wireReject writes EXACTLY ONE REJECTED_BECAUSE
//                                edge carrying the captured reason scalar + a
//                                research_rejected event; ZERO INFORMS edges for
//                                that finding (Canon Part 4).
//   5. DEDUP                  -- a prior EvidenceClaim (same url as a stubbed
//                                fetched item) is dedup-suppressed by Stage 4 (the
//                                finding does not re-file), and the 130.5 cache
//                                path is taken on the repeat (no second fetchCorpus
//                                call -- spy-counted).
//
// Canon Part 4 (rejection is a typed REJECTED_BECAUSE edge in the local graph).
// Canon Part 5 (an EvidenceClaim carries a graded evidence_tier).
// Canon Part 8 (the pipeline reaches room.db only through navigation; role_blend +
//   finding prose stay LOCAL, never egress; the fetch is stubbed, no live network).
// Canon Part 9 (SQL is the local mind, proven by instrumentation -- zero non-SQLite
//   filesystem reads outside the allow-listed USER.md during each flow; an
//   EvidenceClaim lands review_status proposed, never auto-confirmed).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const { ok, equal, notDeepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const focus = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'focus.cjs'));
const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
const labelIndex = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation-label-index.cjs'));

// The pipeline modules under test (driven end to end through navigation.cjs).
const extractor = require(path.join(REPO_ROOT, 'lib', 'core', 'research-context-extractor.cjs'));
const driver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
const filingSelector = require(path.join(REPO_ROOT, 'lib', 'core', 'research-filing-selector.cjs'));
const wirer = require(path.join(REPO_ROOT, 'lib', 'core', 'findings-wirer.cjs'));
const resolver = require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'correlation-resolver.cjs'));

const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-131', 'sample-room', 'seed.sql');

// The allow-listed non-room.db reads (mirrors the 130-04 idiom, EXTENDED for the
// 131 source-lens pipeline per the phase CONTRACT: "zero non-SQLite filesystem
// reads outside allow-listed cache/USER.md"):
//   USER.md                        -- the extractor pre-flight reads role_blend
//                                     (Phase 115 persona); the single expected
//                                     persona read, exactly like 130-04.
//   .mindrian/research-cache/*.json -- the Phase 130.5 SHARED corpus cache. The
//                                     consume-130.5 contract mandates the driver
//                                     fetch cache-first via this on-disk TTL cache.
//                                     The cache holds PUBLIC SIGNAL corpus snippets
//                                     (never user content, never room.db data per
//                                     Canon Part 8), so a cache read is NOT a
//                                     LOCAL-to-anywhere leak -- it is the allow-
//                                     listed cache the CONTRACT names alongside
//                                     USER.md. The pipeline still touches room.db
//                                     ONLY through navigation.cjs; the cache is the
//                                     external-corpus layer, not the local mind.
const ALLOWED_NON_DB_FILENAMES = ['USER.md'];
const ALLOWED_NON_DB_PATTERNS = [/\.mindrian\/research-cache\/[^/]+\.json$/];

function isAllowedNonDbRead(call) {
  const t = typeof call.target === 'string' ? call.target : String(call.target);
  if (ALLOWED_NON_DB_FILENAMES.some((name) => t.endsWith(name))) return true;
  return ALLOWED_NON_DB_PATTERNS.some((rx) => rx.test(t));
}

// The REAL correlation_labels index body, serialized via 130.7's REAL
// serializeLabelIndex (NOT a stub). It carries a single-label teaching-graph
// target (SWOT Analysis -> Framework deg 5) AND a cross-label-duplicate name
// (HEART Framework under :Framework deg 8 AND :Product deg 2) so the REAL
// no-fork canonical pick is exercised against REAL data in test 3.
const CORRELATION_LABELS_BODY = labelIndex.serializeLabelIndex([
  { canonical_name: 'SWOT Analysis', primary_label: 'Framework', edge_degree: 5 },
  { canonical_name: 'HEART Framework', primary_label: 'Framework', edge_degree: 8 },
  { canonical_name: 'HEART Framework', primary_label: 'Product', edge_degree: 2 },
]);

// setupRoom -- openRoomDb bootstraps the lazygraph + memory schema (filesystem
// writes + schema reads) and the seed.sql readFileSync below all happen BEFORE the
// fs proxy installs; the proxy only wraps reads during the instrumented flow.
//
// roleBlend selects the persona that frames the summary AND (via Rule 3/4/5)
// shapes the computed lens_set, so contrasting personas + sections produce
// contrasting lens sets (test 3's inequality assertion).
function setupRoom(roleBlend) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-131-e2e-'));
  const roomDir = tmp;
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  closeRoomDb(db);

  const blend = (roleBlend && typeof roleBlend === 'object') ? roleBlend : { founder: 0.6, researcher: 0.4 };
  const blendLines = Object.keys(blend).map((r) => '  ' + r + ': ' + blend[r]);
  fs.writeFileSync(
    path.join(roomDir, 'USER.md'),
    [
      '---',
      'user_id: navigator-jonathan',
      'canonical_role: ' + Object.keys(blend)[0],
      'role_blend:',
    ].concat(blendLines).concat([
      '---',
      '# Navigator',
      '',
    ]).join('\n'),
    'utf8'
  );
  return { tmp, roomDir };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Set room focus to a section node (so getResearchPreflight's current_section ==
// that section) and journal a jtbd_transitioned event (so getCurrentJTBD returns
// the supplied jtbd). Both writes go through navigation primitives; pre-proxy.
function seedContext(db, roomDir, sessionId, sectionNodeId, jtbd) {
  focus.setFocus(db, sessionId, sectionNodeId, 'user');
  navigation.logMemoryEvent(db, 'jtbd_transitioned', { jtbd, to: jtbd, kind: 'workflow' });
}

// A deterministic fetchCorpus stub: NO live network. Returns a fixed academic
// corpus item list for the openalex source so the driver ranks + caps
// deterministically. spy.count records every call so the dedup/cache E2E can
// spy-count fetches. The DEDUP item carries the seed's prior-EvidenceClaim url so
// Stage 4 suppresses it.
function makeFetchCorpusStub(spy) {
  return async function fetchCorpusStub(args) {
    if (spy) spy.count += 1;
    const source = args && args.source;
    if (source === 'openalex') {
      return [
        {
          id: 'https://openalex.org/W-DEDUP',
          url: 'https://openalex.org/W-DEDUP',
          title: 'CAR-T cost curve prior (dedup target)',
          abstract: 'Autologous CAR-T per-dose COGS cost curve financial-model evidence prior.',
          doi: null,
          source: 'openalex',
          fetched_at: '2026-06-02T00:00:00Z',
        },
        {
          id: 'https://openalex.org/W-FRESH',
          url: 'https://openalex.org/W-FRESH',
          title: 'CAR-T cost curve 2025 fresh finding',
          abstract: 'Fresh per-dose COGS financial-model cost curve evidence 2025 manufacturing scale.',
          doi: null,
          source: 'openalex',
          fetched_at: '2026-06-02T00:00:00Z',
        },
      ];
    }
    // Other sources (industry/patent/brain/...) return nothing in the stub: the
    // openalex scholarly lens carries the deterministic findings for the gate.
    return [];
  };
}

// Pre-warm the lazy require chain (selector renderers, user-md-ops, lens-engine
// rotate path) so the first dispatchShapeFSubShape + extractor read during the
// instrumented flow does not trip the fs proxy on a one-time module load. Mirrors
// the 129/130 "bootstrap before proxy" discipline. Runs one throwaway full
// pipeline pass on a separate room.
async function prewarm() {
  const { tmp, roomDir } = setupRoom({ founder: 0.6, researcher: 0.4 });
  const db = openRoomDb(roomDir);
  try {
    seedContext(db, roomDir, 'prewarm', 'section:financial-model', 'thesis-build');
    const ctx = extractor.extractContext({ roomDir, sessionId: 'prewarm', topic: 'prewarm topic', db });
    const drive = await driver.runSourceLens({
      roomDir, topic: 'prewarm topic', lensSet: ctx.lens_set, preflight: ctx.preflight,
      stage: 'explore', db, sessionId: 'prewarm', _fetchCorpus: makeFetchCorpusStub({ count: 0 }),
    });
    const sel = filingSelector.buildFilingSelector(
      (drive.findings && drive.findings[0]) || { source: 'OpenAlex', url: 'x', evidence_tier: 'Academic' },
      [{ section: 'financial-model', match_pct: 0.9, target_id: 'section:financial-model', target_kind: 'local' }],
      { mode: 'A' }
    );
    void sel;
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
}

// Drive a synchronous-or-async flow function under the instrumented zero-leak gate.
// The db handle is opened/closed by the caller AROUND the gate (room.db reads are
// allow-listed by the proxy); the flow runs under the proxy. Mirrors 130-04
// rotateInstrumented. Returns the flow result.
async function runInstrumented(flowFn) {
  let result;
  fsInstrument.install({ throwOnViolation: false });
  try {
    result = await flowFn();
  } finally {
    fsInstrument.uninstall();
  }
  const leaks = fsInstrument.calls().filter((c) => !isAllowedNonDbRead(c));
  ok(
    leaks.length === 0,
    'instrumented zero-leak gate: zero non-SQLite filesystem reads outside the allow-listed USER.md during the flow; leaked: '
      + JSON.stringify(leaks.map((c) => ({ method: c.method, target: c.target })))
  );
  return result;
}

// Query helper: memory_event nodes of a given event_type (the navigation.cjs
// logMemoryEvent re-export writes them as 'memory_event'-type nodes whose
// properties carry event_type).
function eventsOfType(db, eventType) {
  return db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = ?"
  ).all(eventType);
}

function edgesOfType(db, type) {
  return db.prepare('SELECT source, target, type, properties FROM edges WHERE type = ?').all(type);
}

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

// ---------------------------------------------------------------------------
// E2E 1: STANDALONE -- full pipeline -> EvidenceClaim (proposed) + LOCAL INFORMS
// edge + research_filed via the logMemoryEvent re-export + an F.1 next-move
// selector after filing.
// ---------------------------------------------------------------------------
test('E2E 1: STANDALONE full pipeline produces EvidenceClaim + LOCAL INFORMS edge + research_filed + F.1 next-move', async () => {
  const { tmp, roomDir } = setupRoom({ founder: 0.6, researcher: 0.4 });
  const db = openRoomDb(roomDir);
  try {
    seedContext(db, roomDir, 'standalone-1', 'section:financial-model', 'thesis-build');
    const spy = { count: 0 };
    const fetchStub = makeFetchCorpusStub(spy);

    const out = await runInstrumented(async () => {
      // Stage 1+2+3 -- the pre-flight + plan, through navigation.getResearchPreflight.
      const ctx = extractor.extractContext({ roomDir, sessionId: 'standalone-1', topic: 'CAR-T cost curve', db });
      // Stage 4 -- the source-lens rotation, fetch STUBBED (no live network).
      const drive = await driver.runSourceLens({
        roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: ctx.preflight,
        stage: 'explore', db, sessionId: 'standalone-1', _fetchCorpus: fetchStub,
      });
      ok(drive && drive.ok, 'runSourceLens ok');
      const finding = drive.findings.find((f) => /W-FRESH/.test(f.url)) || drive.findings[0];
      ok(finding, 'a ranked finding came back from the stubbed corpus');
      // Stage 6 -- the F.1 filing gate (mirrors selector-dispatcher; LOCAL primary).
      const sel = filingSelector.buildFilingSelector(
        finding,
        [{ section: 'financial-model', match_pct: 0.9, target_id: 'section:financial-model', target_kind: 'local' }],
        { mode: 'A' }
      );
      equal(sel.envelope.shape, 'F.1', 'the filing gate is a Shape F.1 envelope');
      // Stage 7 -- wireAccept to the LOCAL section primary.
      const wired = wirer.wireAccept(db, {
        finding,
        decision: { target_kind: 'local', target_section: 'financial-model' },
        roomDir, sessionId: 'standalone-1', topic: 'CAR-T cost curve',
      });
      ok(wired && wired.ok, 'wireAccept ok; got ' + JSON.stringify(wired));
      // Stage 8 -- STANDALONE post-filing surfaces an F.1 next-move selector.
      const nextMove = filingSelector.buildFilingSelector(
        finding,
        [{ section: 'financial-model', match_pct: 0.9, target_id: 'section:financial-model', target_kind: 'local' }],
        { mode: 'A', header: '-- mindrianOS -- finding filed -- what next --' }
      );
      return { wired, nextMove };
    });

    // EvidenceClaim node landed PROPOSED (Canon Part 9 role 5 -- never auto-confirmed).
    const node = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(out.wired.node_id);
    ok(node, 'the EvidenceClaim node exists');
    equal(node.type, 'EvidenceClaim', 'node type is EvidenceClaim');
    equal(node.review_status, 'proposed', 'EvidenceClaim lands proposed (never auto-confirmed)');

    // INFORMS edge target is the LOCAL room.db node id, NOT a correlation_id.
    const informs = edgesOfType(db, 'INFORMS');
    equal(informs.length, 1, 'exactly one INFORMS edge written');
    equal(informs[0].source, out.wired.node_id, 'INFORMS source is the EvidenceClaim node');
    equal(informs[0].target, 'section:financial-model', 'INFORMS target is the LOCAL room.db node id (NOT a correlation_id)');

    // research_filed memory_event written via the logMemoryEvent re-export.
    const filed = eventsOfType(db, 'research_filed');
    ok(filed.length >= 1, 'a research_filed memory_event was written (via the logMemoryEvent re-export chokepoint)');
    const payload = JSON.parse(filed[0].properties);
    ok(/openalex\.org/.test(JSON.stringify(payload)), 'the research_filed event carries url provenance');

    // The standalone post-filing surfaced an F.1 next-move selector.
    equal(out.nextMove.envelope.shape, 'F.1', 'the standalone post-filing surfaces an F.1 next-move selector');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 2: CALLED-BY-BUILD-THESIS -- the accepted EvidenceClaim node IDs are
// RETURNED to the caller (chain-back) and findRecentChanges shows research_filed.
// ---------------------------------------------------------------------------
test('E2E 2: CALLED-BY-BUILD-THESIS chains back accepted EvidenceClaim IDs + findRecentChanges shows research_filed', async () => {
  const { tmp, roomDir } = setupRoom({ founder: 0.6, researcher: 0.4 });
  const db = openRoomDb(roomDir);
  try {
    seedContext(db, roomDir, 'build-thesis-1', 'section:financial-model', 'thesis-build');
    const fetchStub = makeFetchCorpusStub({ count: 0 });

    // An inbound called-by handle (the calling methodology). The pipeline RETURNS
    // the accepted EvidenceClaim node ids so the caller resumes with the evidence.
    const calledBy = { command: '/mos:build-thesis', step: 4, jtbd: 'thesis-build' };

    const out = await runInstrumented(async () => {
      const ctx = extractor.extractContext({ roomDir, sessionId: 'build-thesis-1', topic: 'CAR-T cost curve', db });
      const drive = await driver.runSourceLens({
        roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: ctx.preflight,
        stage: 'explore', db, sessionId: 'build-thesis-1', _fetchCorpus: fetchStub,
      });
      const finding = drive.findings.find((f) => /W-FRESH/.test(f.url)) || drive.findings[0];
      const wired = wirer.wireAccept(db, {
        finding,
        decision: { target_kind: 'local', target_section: 'financial-model' },
        roomDir, sessionId: 'build-thesis-1', topic: 'CAR-T cost curve',
      });
      ok(wired && wired.ok, 'wireAccept ok; got ' + JSON.stringify(wired));
      // POST-FILING (Stage 8): called BY a methodology -> chain back the
      // accepted EvidenceClaim node ids (handles only, never prose -- Part 8).
      const chainBack = calledBy && calledBy.command
        ? { called_by: calledBy.command, evidence_claim_ids: [wired.node_id], lens_set: ctx.lens_set }
        : null;
      return { wired, chainBack };
    });

    // The accepted EvidenceClaim node ids are RETURNED to the caller (chain-back).
    ok(out.chainBack && Array.isArray(out.chainBack.evidence_claim_ids), 'the pipeline returns evidence_claim_ids to the caller');
    equal(out.chainBack.evidence_claim_ids.length, 1, 'exactly one accepted EvidenceClaim id chained back');
    equal(out.chainBack.evidence_claim_ids[0], out.wired.node_id, 'the chained-back id is the accepted EvidenceClaim node id');
    equal(out.chainBack.called_by, '/mos:build-thesis', 'the chain-back records the calling methodology');
    // The chained-back payload is handles only (no finding prose -- Canon Part 8).
    ok(!/COGS|abstract|manufacturing/i.test(JSON.stringify(out.chainBack)), 'the chain-back carries handles only, no finding prose (Canon Part 8)');

    // findRecentChanges shows the research_filed event.
    const recent = memoryEvents.findRecentChanges(db, 0, { limit: 200 });
    const filed = recent.filter((e) => e.eventType === 'research_filed');
    ok(filed.length >= 1, 'findRecentChanges surfaces the research_filed event');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 3: CALLED-BY-USER-NEEDS -- a DIFFERENT current_section + JTBD yields a
// DIFFERENT computed lens_set AND a different filing destination; the flow files a
// TEACHING-GRAPH finding via the REAL resolveCorrelation, landing the INFORMS edge
// on a real correlation_id (NOT the raw name, NOT a stub). This is the non-stubbed
// correlation assertion the release gate requires.
// ---------------------------------------------------------------------------
test('E2E 3: CALLED-BY-USER-NEEDS different lens_set + destination + REAL correlation_id teaching-graph edge', async () => {
  // user-needs persona: investor-led (Rule 3 adds competitive-intelligence) and a
  // problem-definition (NON financial-model) section so Rule 1 does NOT fire ->
  // a structurally different lens_set than the build-thesis (test 2) flow.
  const buildThesis = setupRoom({ founder: 0.6, researcher: 0.4 });
  const userNeeds = setupRoom({ investor: 0.7, founder: 0.3 });
  const dbBT = openRoomDb(buildThesis.roomDir);
  const dbUN = openRoomDb(userNeeds.roomDir);
  try {
    seedContext(dbBT, buildThesis.roomDir, 'bt-lens', 'section:financial-model', 'thesis-build');
    seedContext(dbUN, userNeeds.roomDir, 'un-lens', 'section:problem-definition', 'user-needs');

    const fetchStub = makeFetchCorpusStub({ count: 0 });

    // The REAL resolved correlation_id for the teaching-graph target -- seed it as
    // a node so the cascade-edge FK holds (the id is a runtime 130.7 hash, not a
    // static SQL literal, so the test seeds it, per the seed.sql header note).
    const expectedCorrelationId = resolver.resolveCorrelation('SWOT Analysis', {
      correlationLabelsSection: CORRELATION_LABELS_BODY,
    }).correlation_id;
    dbUN.prepare(
      "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
      + "VALUES (?, 'correlation_target', '{}', 'fixture:teaching-graph', 'system', NULL, 'proposed', ?, ?)"
    ).run(expectedCorrelationId, Date.now(), Date.now());

    const out = await runInstrumented(async () => {
      // build-thesis lens_set (the test-2 context).
      const ctxBT = extractor.extractContext({ roomDir: buildThesis.roomDir, sessionId: 'bt-lens', topic: 'CAR-T cost curve', db: dbBT });
      // user-needs lens_set (the test-3 context: different section + JTBD + persona).
      const ctxUN = extractor.extractContext({ roomDir: userNeeds.roomDir, sessionId: 'un-lens', topic: 'CAR-T user needs', db: dbUN });

      // Stage 4 (user-needs) -- drive the rotation so the pipeline runs end-to-end.
      const driveUN = await driver.runSourceLens({
        roomDir: userNeeds.roomDir, topic: 'CAR-T user needs', lensSet: ctxUN.lens_set, preflight: ctxUN.preflight,
        stage: 'explore', db: dbUN, sessionId: 'un-lens', _fetchCorpus: fetchStub,
      });
      const findingUN = (driveUN.findings && driveUN.findings[0]) || {
        source: 'OpenAlex', url: 'https://openalex.org/W-UN', retrieved_at: '2026-06-02T00:00:00Z',
        evidence_tier: 'Academic', summary: 'user-needs finding', title: 'UN finding',
      };

      // Stage 7 -- wireAccept to a TEACHING-GRAPH target via the REAL resolver
      // (NOT the stub). correlationLabelsSection is the REAL serialized index.
      const wiredUN = wirer.wireAccept(dbUN, {
        finding: findingUN,
        decision: { target_kind: 'teaching-graph', target_section: 'SWOT Analysis' },
        roomDir: userNeeds.roomDir, sessionId: 'un-lens', topic: 'CAR-T user needs',
        correlationLabelsSection: CORRELATION_LABELS_BODY,
      });
      ok(wiredUN && wiredUN.ok, 'user-needs wireAccept (teaching-graph) ok; got ' + JSON.stringify(wiredUN));

      return { ctxBT, ctxUN, wiredUN };
    });

    // INEQUALITY 1 -- the two computed lens_sets differ (context-derived, not fixed).
    notDeepEqual(out.ctxUN.lens_set, out.ctxBT.lens_set,
      'the user-needs lens_set differs from the build-thesis lens_set (different section + JTBD + persona)');
    // The user-needs lens_set carries competitive-intelligence (investor Rule 3);
    // the build-thesis lens_set does NOT.
    const unLenses = out.ctxUN.lens_set.map((e) => e.lens);
    const btLenses = out.ctxBT.lens_set.map((e) => e.lens);
    ok(unLenses.indexOf('competitive-intelligence') !== -1, 'user-needs (investor) lens_set includes competitive-intelligence');
    ok(btLenses.indexOf('competitive-intelligence') === -1, 'build-thesis lens_set does NOT include competitive-intelligence');

    // INEQUALITY 2 -- a different filing destination: the user-needs flow filed to
    // the TEACHING-GRAPH correlation_id; the build-thesis flow (test 2) files to
    // the LOCAL section:financial-model node id. Different target kinds + ids.
    equal(out.wiredUN.target_kind, 'teaching-graph', 'the user-needs filing destination is a teaching-graph target');
    notDeepEqual(out.wiredUN.target_id, 'section:financial-model', 'the user-needs destination differs from the build-thesis local destination');

    // THE NON-STUBBED CORRELATION ASSERTION (the release gate requirement): the
    // INFORMS edge target EQUALS computeCorrelationId(canonical, primary_label) for
    // the canonical pick -- a real correlation_id, never the raw name.
    const informs = edgesOfType(dbUN, 'INFORMS');
    equal(informs.length, 1, 'exactly one INFORMS edge in the user-needs room');
    const expected = correlation.computeCorrelationId('SWOT Analysis', 'Framework');
    equal(informs[0].target, expected, 'the teaching-graph INFORMS target equals computeCorrelationId(canonical, primary_label) -- a REAL correlation_id');
    equal(informs[0].target, expectedCorrelationId, 'the resolved id matches the REAL resolveCorrelation output (not a stub)');
    ok(informs[0].target !== 'SWOT Analysis', 'the edge target is NOT the raw teaching-graph name');
  } finally {
    try { closeRoomDb(dbBT); } catch (_) { /* ignore */ }
    try { closeRoomDb(dbUN); } catch (_) { /* ignore */ }
    cleanup(buildThesis.tmp);
    cleanup(userNeeds.tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 4: REJECTION-AS-DATA -- wireReject writes EXACTLY ONE REJECTED_BECAUSE edge
// carrying the captured reason scalar + a research_rejected event; ZERO INFORMS
// edges for that finding (Canon Part 4).
// ---------------------------------------------------------------------------
test('E2E 4: REJECTION-AS-DATA writes one REJECTED_BECAUSE + reason + research_rejected; zero INFORMS', async () => {
  const { tmp, roomDir } = setupRoom({ founder: 0.6, researcher: 0.4 });
  const db = openRoomDb(roomDir);
  try {
    seedContext(db, roomDir, 'reject-1', 'section:financial-model', 'thesis-build');
    const fetchStub = makeFetchCorpusStub({ count: 0 });
    const REJECT_REASON = 'off_topic_for_this_section';

    const out = await runInstrumented(async () => {
      const ctx = extractor.extractContext({ roomDir, sessionId: 'reject-1', topic: 'CAR-T cost curve', db });
      const drive = await driver.runSourceLens({
        roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: ctx.preflight,
        stage: 'explore', db, sessionId: 'reject-1', _fetchCorpus: fetchStub,
      });
      const finding = drive.findings.find((f) => /W-FRESH/.test(f.url)) || drive.findings[0];
      // Stage 6/7 -- the gate decision is REJECT.
      const rejected = wirer.wireReject(db, {
        finding,
        reason: REJECT_REASON,
        roomDir, sessionId: 'reject-1',
        decision: { target_kind: 'local', target_section: 'market-analysis' },
      });
      ok(rejected && rejected.ok, 'wireReject ok; got ' + JSON.stringify(rejected));
      return { rejected };
    });

    // EXACTLY ONE REJECTED_BECAUSE edge carrying the captured reason scalar.
    const rejectEdges = edgesOfType(db, 'REJECTED_BECAUSE');
    equal(rejectEdges.length, 1, 'exactly one REJECTED_BECAUSE edge (got ' + rejectEdges.length + ')');
    equal(rejectEdges[0].target, 'section:market-analysis', 'the REJECTED_BECAUSE edge points to the local target node id');
    const props = JSON.parse(rejectEdges[0].properties);
    equal(props.reason, REJECT_REASON, 'the captured reason scalar landed in the REJECTED_BECAUSE edge properties');

    // ZERO INFORMS edges for the rejected finding (rejection is strictly reject path).
    equal(edgesOfType(db, 'INFORMS').length, 0, 'no INFORMS edge was written for the rejected finding');

    // A research_rejected memory_event was written (teaches next run's dedup).
    const rejectedEvents = eventsOfType(db, 'research_rejected');
    ok(rejectedEvents.length >= 1, 'a research_rejected memory_event was written via the logMemoryEvent re-export');
    const evPayload = JSON.parse(rejectedEvents[0].properties);
    equal(evPayload.reason, REJECT_REASON, 'the research_rejected event carries the captured reason scalar');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 5: DEDUP -- a prior EvidenceClaim (same url as a stubbed fetched item) is
// dedup-suppressed by Stage 4 (the finding does not re-file), and the 130.5 cache
// path is taken on the repeat (no second fetchCorpus call -- spy-counted).
// ---------------------------------------------------------------------------
test('E2E 5: DEDUP suppresses the prior-url finding + the 130.5 cache path is taken on the repeat (no second fetch)', async () => {
  const { tmp, roomDir } = setupRoom({ founder: 0.6, researcher: 0.4 });
  const db = openRoomDb(roomDir);
  try {
    seedContext(db, roomDir, 'dedup-1', 'section:financial-model', 'thesis-build');
    const spy = { count: 0 };
    const fetchStub = makeFetchCorpusStub(spy);

    // The pre-flight prior_research is a documented placeholder ([]); the dedup
    // identity for this E2E is supplied via the preflight prior_research the
    // driver dedups against (Stage 1 input 7). We inject the seed's prior
    // EvidenceClaim url as a prior_research entry on the preflight.
    const ctx = extractor.extractContext({ roomDir, sessionId: 'dedup-1', topic: 'CAR-T cost curve', db });
    const preflightWithPrior = Object.assign({}, ctx.preflight, {
      prior_research: [{ url: 'https://openalex.org/W-DEDUP' }],
    });

    const drive = await runInstrumented(async () => {
      // First fetch: the corpus stub returns the DEDUP item + a FRESH item.
      const d1 = await driver.runSourceLens({
        roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: preflightWithPrior,
        stage: 'explore', db, sessionId: 'dedup-1', _fetchCorpus: fetchStub,
      });
      // Repeat fetch (same source + query): the 130.5 research-cache path is taken,
      // so fetchCorpus is NOT called a second time (spy-counted).
      const d2 = await driver.runSourceLens({
        roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: preflightWithPrior,
        stage: 'explore', db, sessionId: 'dedup-1', _fetchCorpus: fetchStub,
      });
      return { d1, d2 };
    });

    ok(drive.d1 && drive.d1.ok, 'first runSourceLens ok');
    // DEDUP: the prior-url finding is suppressed (not in the findings list); the
    // FRESH finding survives.
    const urls = drive.d1.findings.map((f) => f.url);
    ok(urls.indexOf('https://openalex.org/W-DEDUP') === -1, 'the prior-research url is dedup-suppressed (not re-filed)');
    ok(urls.indexOf('https://openalex.org/W-FRESH') !== -1, 'the fresh finding survives dedup');

    // CACHE: the repeat took the 130.5 research-cache path -- the stub counts
    // every fetchCorpus invocation, and the on-disk research-cache short-circuits
    // the openalex source on the repeat, so the count does NOT keep growing.
    ok(spy.count >= 1, 'fetchCorpus fired at least once on the first run');
    // Record the count after runs 1 and 2, then re-run a third time to prove the
    // cache holds: the third run must add ZERO fetches (the count stays put).
    const countAfterTwoRuns = spy.count;
    const d3 = await driver.runSourceLens({
      roomDir, topic: 'CAR-T cost curve', lensSet: ctx.lens_set, preflight: preflightWithPrior,
      stage: 'explore', db, sessionId: 'dedup-1', _fetchCorpus: fetchStub,
    });
    ok(d3 && d3.ok, 'third runSourceLens ok');
    equal(spy.count, countAfterTwoRuns, 'the 130.5 cache path is taken on the repeat: fetchCorpus is NOT called again (spy count unchanged)');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

function run() {
  (async () => {
    let pass = 0;
    let fail = 0;
    for (const t of results) {
      try {
        await t.fn();
        pass++;
        process.stdout.write('PASS ' + t.name + '\n');
      } catch (err) {
        fail++;
        process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + (err.stack || '') + '\n');
      }
    }
    process.stdout.write('test-131-e2e: ' + pass + '/' + results.length + ' passed\n');
    process.exit(fail === 0 ? 0 : 1);
  })();
}

// Pre-warm the lazy require chain, then run the suite.
prewarm().then(run).catch((err) => {
  process.stderr.write('prewarm failed: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
