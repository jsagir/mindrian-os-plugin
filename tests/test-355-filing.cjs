#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 20 (HIPS-06, D-36..D-43, D-53 C4, D-56, AI-SPEC Section 7).
 * The D-43 filing proof: an accepted stamped eureka finding files as a
 * `proposed` opportunity through the ONE stamped filer, the stamp rides the
 * node's props, SOURCED_FROM provenance lands on the two source artifact
 * nodes, and a real SENS-13 producer (writeStampedSideChannel) fires after
 * the write transaction commits.
 *
 * Phase 366 Plan 27 (D-02, slice C): the standalone runner's bankStatements
 * is retired, so this test drives the planner-owned filer
 * lib/core/research-planner/filing-stamped.cjs (fileStampedOpportunity)
 * through the same composition its live caller lib/core/ambient-run.cjs
 * runs: BEGIN, fileStampedOpportunity, COMMIT, then writeStampedSideChannel
 * with the minted node id. Every filing-record assertion is kept. Three legs
 * named runner-only behavior and were restated against the filer: the
 * banking predicate's skip (now: the filer refuses a pair with no stamp),
 * the runner's own DERIVED_FROM evidence edges (now: SOURCED_FROM are the
 * filer's only edges), and the runner's cross_connection_stamped telemetry
 * (now: the filer mints no telemetry row; the event was the runner caller's).
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * node:sqlite SKIP-on-unavailable guard (exit 77) -- this test opens two
 * real room.db files (fixture-room-355.cjs), unlike test-219-banking.cjs's
 * pure in-memory schema, so a genuine SKIP path exists here.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const hygiene = require('./helpers/hygiene-355.cjs');

const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-355-filing.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-filing');
const { check } = checker;

const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const eurekaReachRunner = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const filingStamped = require(path.join(REPO, 'lib', 'core', 'research-planner', 'filing-stamped.cjs'));
const bandFor = require(path.join(REPO, 'lib', 'core', 'rs-differential-scorer.cjs'))._test.bandFor;
const { buildFilingRoom, FROM_FRAMEWORK, TO_FRAMEWORK } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-355.cjs'));

// The session id the retired runner banked under; kept so the filed node's
// session stays what the 355 record measured.
const BANK_SESSION_ID = 'eureka-portfolio';

// The sensor-eureka firing bands the side channel fires on.
const SIDE_CHANNEL_FIRING_BANDS = ['opportunity', 'high', 'breakthrough'];

// fileLikeTheLiveCaller(db, sessionId, statements, opts) -- the composition
// lib/core/ambient-run.cjs runs around the one stamped filer: one BEGIN, one
// fileStampedOpportunity call per statement (a stamp-less pair returns null
// and is counted as skipped), COMMIT, then the side channel for the highest-
// ranked filed transferable finding whose band fires. Returns
// { ok, filed, skipped, nodeIds, sideChannel }.
function fileLikeTheLiveCaller(db, sessionId, statements, opts) {
  const nodeIds = [];
  const filedItems = [];
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const entry of statements) {
      const pair = entry.pair || {};
      const st = entry.statement || {};
      const stamp = opts.stampsByKey.get(pair.idA + '|' + pair.idB) || null;
      const titleA = (pair.techA && pair.techA.title) || pair.idA;
      const titleB = (pair.techB && pair.techB.title) || pair.idB;
      const nodeId = filingStamped.fileStampedOpportunity(db, {
        a: { handle: String(pair.idA), text: String(titleA) },
        b: { handle: String(pair.idB), text: String(titleB) },
        stamp: stamp,
        producer: 'eureka',
        roomDir: opts.roomDir,
        runMode: opts.runMode,
        reason: 'eureka stamped finding',
        name: titleA + ' x ' + titleB,
        sessionId: sessionId,
        score: typeof pair.score === 'number' ? pair.score : undefined,
        evidenceIds: [pair.idA, pair.idB],
        extraProps: { statement_text: typeof st.text === 'string' ? st.text : '', critic: st.critic || 'resolved' },
      });
      if (!nodeId) { skipped += 1; continue; }
      nodeIds.push(nodeId);
      filedItems.push({ nodeId: nodeId, pair: pair, critic: st.critic, stamp: stamp, titleA: titleA, titleB: titleB });
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    return { ok: false, reason: String(e && e.message) };
  }
  let pick = null;
  for (const item of filedItems) {
    if (item.critic !== 'transferable') continue;
    const absDiff = item.pair.rs && item.pair.rs.abs_diff;
    if (typeof absDiff !== 'number') continue;
    const band = bandFor(absDiff);
    if (SIDE_CHANNEL_FIRING_BANDS.indexOf(band) === -1) continue;
    if (!pick || item.pair.rank < pick.pair.rank) pick = Object.assign({ band: band, absDiff: absDiff }, item);
  }
  let sideChannel = null;
  if (pick) {
    sideChannel = eurekaReachRunner.writeStampedSideChannel(opts.roomDir, {
      score: { direction: pick.stamp.direction, abs_diff: pick.absDiff, band: pick.band, passes: true },
      guard: { verdict: 'transferable', confidence: 'high', tags: [] },
      a: { handle: String(pick.pair.idA), text: String(pick.titleA) },
      b: { handle: String(pick.pair.idB), text: String(pick.titleB) },
      stamp: pick.stamp,
      opportunityHandle: pick.nodeId,
    });
  }
  return { ok: true, filed: nodeIds.length, skipped: skipped, nodeIds: nodeIds, sideChannel: sideChannel };
}

function allNodeTypes(db) {
  const rows = db.prepare('SELECT DISTINCT type FROM nodes').all();
  return new Set(rows.map(function (r) { return r.type; }));
}

function walkStrings(value, out) {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { value.forEach(function (v) { walkStrings(v, out); }); return; }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (k) { walkStrings(value[k], out); });
  }
}

async function main() {
  const fixture = await buildFilingRoom('filing');
  try {
    // -----------------------------------------------------------------------
    // 1. The live caller's composition around fileStampedOpportunity --
    //    exactly one filed (the stamped pair), one skipped (the filer refuses
    //    a pair with no stamp; formerly the runner's banking predicate skip).
    // -----------------------------------------------------------------------
    let db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const typesBefore = allNodeTypes(db);
    check('filing: fixture seeds a fresh room with no opportunity node yet', !typesBefore.has('opportunity'));

    const runMode = 'test-mode-355-20';
    let bank;
    try {
      bank = fileLikeTheLiveCaller(db, BANK_SESSION_ID, fixture.statements, {
        stampsByKey: fixture.stampsByKey,
        roomDir: fixture.roomDir,
        runMode: runMode,
      });
    } finally {
      closeRoomDb(db);
    }
    check('filing: the filing transaction returns ok:true', bank && bank.ok === true, JSON.stringify(bank));
    check('filing: fileStampedOpportunity filed exactly 1', bank && bank.filed === 1, JSON.stringify(bank));
    check('filing: fileStampedOpportunity refused exactly 1 (the stamp-less pair)', bank && bank.skipped === 1, JSON.stringify(bank));

    // -----------------------------------------------------------------------
    // 2. Close and reopen room.db (D-43); exactly 1 row type='opportunity'
    //    AND review_status='proposed'.
    // -----------------------------------------------------------------------
    db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const oppRows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'opportunity' AND review_status = 'proposed'").all();
    check('filing: exactly 1 opportunity row, review_status proposed', oppRows.length === 1, JSON.stringify(oppRows.map(function (r) { return r.id; })));
    const allOppRows = db.prepare("SELECT id FROM nodes WHERE type = 'opportunity'").all();
    check('filing: no OTHER opportunity row exists (any review_status)', allOppRows.length === 1, JSON.stringify(allOppRows));

    const nodeId = oppRows[0].id;
    const props = JSON.parse(oppRows[0].properties || '{}');

    // -----------------------------------------------------------------------
    // 3. Stamp fields re-parse with the zod Stamp schema; formula_version;
    //    pws_stage; engine_mode.
    // -----------------------------------------------------------------------
    let reparsed = null;
    let reparseErr = null;
    try {
      reparsed = verificationStamp.fromNodeProps(props);
    } catch (e) {
      reparseErr = e;
    }
    check('filing: stamp props re-parse with the zod Stamp schema', reparsed !== null, reparseErr && reparseErr.message);
    check('filing: re-parsed stamp verification is strong', reparsed && reparsed.verification === 'strong');
    check('filing: re-parsed stamp backend is theo', reparsed && reparsed.backend === 'theo');
    check('filing: re-parsed stamp direction is structural_transfer', reparsed && reparsed.direction === 'structural_transfer');
    check('filing: re-parsed stamp path nodes are the two Framework names', reparsed && Array.isArray(reparsed.path && reparsed.path.nodes)
      && reparsed.path.nodes[0] === FROM_FRAMEWORK && reparsed.path.nodes[1] === TO_FRAMEWORK);

    const lastHistory = Array.isArray(props.stage_history) && props.stage_history.length > 0
      ? props.stage_history[props.stage_history.length - 1] : null;
    check('filing: props.stage_history carries formula_version stamp-v1', lastHistory && lastHistory.formula_version === 'stamp-v1', JSON.stringify(lastHistory));
    check('filing: props.stage_history reason is "eureka stamped finding"', lastHistory && lastHistory.reason === 'eureka stamped finding', JSON.stringify(lastHistory));
    check('filing: props.pws_stage equals the fixture ROOM.md value', props.pws_stage === 'ill_defined', JSON.stringify(props.pws_stage));
    check('filing: props.engine_mode equals runMode', props.engine_mode === runMode, JSON.stringify(props.engine_mode));

    // -----------------------------------------------------------------------
    // 4. >= 2 SOURCED_FROM edges, source = the node id, relation
    //    'sourced_from', origin 'eureka-355'. The runner's DERIVED_FROM
    //    evidence edges were its own caller-side writes (the planner's
    //    filing.cjs writes its own); the filer writes SOURCED_FROM only.
    // -----------------------------------------------------------------------
    const sourcedFromRows = db.prepare("SELECT source, target, properties FROM edges WHERE source = ? AND type = 'SOURCED_FROM'").all(nodeId);
    check('filing: >= 2 SOURCED_FROM edges from the node', sourcedFromRows.length >= 2, JSON.stringify(sourcedFromRows));
    check('filing: every SOURCED_FROM edge carries relation sourced_from + origin eureka-355', sourcedFromRows.every(function (r) {
      const p = JSON.parse(r.properties || '{}');
      return p.relation === 'sourced_from' && p.origin === 'eureka-355';
    }), JSON.stringify(sourcedFromRows));
    const sourcedTargets = new Set(sourcedFromRows.map(function (r) { return r.target; }));
    check('filing: SOURCED_FROM targets are the two ARTIFACT nodes (D-38)', sourcedTargets.has(fixture.ids.artifactA) && sourcedTargets.has(fixture.ids.artifactB), JSON.stringify([...sourcedTargets]));

    const otherEdgeRows = db.prepare("SELECT type, target FROM edges WHERE source = ? AND type != 'SOURCED_FROM'").all(nodeId);
    check('filing: the filer writes no edge other than SOURCED_FROM from the node', otherEdgeRows.length === 0, JSON.stringify(otherEdgeRows));

    // -----------------------------------------------------------------------
    // 5. The set of node types after filing is the before-set plus ONLY
    //    already-existing, well-established system types ('opportunity' the
    //    filed truth-claim, 'memory_event' any navigation telemetry row) --
    //    T-355-99's mitigation is "no ROGUE type minted", not "zero growth".
    // -----------------------------------------------------------------------
    const typesAfter = allNodeTypes(db);
    const added = [...typesAfter].filter(function (t) { return !typesBefore.has(t); });
    const EXPECTED_ADDED_TYPES = new Set(['opportunity', 'memory_event']);
    check('filing: node-type set after banking adds only pre-existing system types (opportunity, memory_event)',
      added.length > 0 && added.every(function (t) { return EXPECTED_ADDED_TYPES.has(t); }), JSON.stringify(added));
    check('filing: node-type set after banking includes opportunity', typesAfter.has('opportunity'));

    // -----------------------------------------------------------------------
    // 6. <room>/.mindrian/last-eureka.json exists, validates as v2, and its
    //    opportunity_handle equals the node id (D-53 C4).
    check('filing: writeStampedSideChannel returned ok after COMMIT', bank.sideChannel && bank.sideChannel.ok === true, JSON.stringify(bank.sideChannel));
    // -----------------------------------------------------------------------
    const sideChannelPath = path.join(fixture.roomDir, '.mindrian', 'last-eureka.json');
    check('filing: last-eureka.json exists', fs.existsSync(sideChannelPath));
    let sideChannelPayload = null;
    if (fs.existsSync(sideChannelPath)) {
      sideChannelPayload = JSON.parse(fs.readFileSync(sideChannelPath, 'utf8'));
    }
    check('filing: last-eureka.json validates as v2 closed schema', sideChannelPayload && eurekaReachRunner.validateClosedSchema(sideChannelPayload), JSON.stringify(sideChannelPayload));
    check('filing: last-eureka.json schema_version is 2', sideChannelPayload && sideChannelPayload.schema_version === 2);
    check('filing: last-eureka.json opportunity_handle equals the minted node id', sideChannelPayload && sideChannelPayload.opportunity_handle === nodeId, JSON.stringify(sideChannelPayload && sideChannelPayload.opportunity_handle));
    check('filing: last-eureka.json stamp sub-object carries the same verification tier', sideChannelPayload && sideChannelPayload.stamp && sideChannelPayload.stamp.verification === 'strong');

    // -----------------------------------------------------------------------
    // 7. An agent-attributed promoteNodeStatus returns agent_attribution_
    //    forbidden and the row still reads proposed.
    // -----------------------------------------------------------------------
    const promo = navigation.promoteNodeStatus(db, nodeId, 'proposed', 'confirmed', 'larry', 'agent attempt');
    check('filing: agent-attributed promote returns agent_attribution_forbidden', promo && promo.reason === 'agent_attribution_forbidden', JSON.stringify(promo));
    const stillProposed = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(nodeId);
    check('filing: node still reads proposed after the rejected agent promote', stillProposed && stillProposed.review_status === 'proposed', JSON.stringify(stillProposed));

    // -----------------------------------------------------------------------
    // 8. The cross_connection_stamped telemetry row was the retired
    //    runner's caller-side write (bankStatements after COMMIT), never the
    //    filer's. The filer mints none: telemetry stays a caller decision,
    //    and the memory-event allowlist entry is untouched.
    // -----------------------------------------------------------------------
    const memRows = db.prepare("SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'cross_connection_stamped'").all();
    check('filing: the filer itself mints no cross_connection_stamped memory_event', memRows.length === 0, JSON.stringify(memRows.length));
    const allowSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'), 'utf8');
    check('filing: cross_connection_stamped is still an allowlisted memory_event type', allowSrc.indexOf("'cross_connection_stamped'") !== -1);
    closeRoomDb(db);

    // -----------------------------------------------------------------------
    // 9. MINDRIAN_DISABLE_MEMORY_EVENT=1: filing still succeeds and writes
    //    no such event (a FRESH fixture room, so the count check is unambiguous).
    // -----------------------------------------------------------------------
    const fixture2 = await buildFilingRoom('filing-disabled');
    try {
      const prevEnv = process.env.MINDRIAN_DISABLE_MEMORY_EVENT;
      process.env.MINDRIAN_DISABLE_MEMORY_EVENT = '1';
      let db2 = openRoomDb(fixture2.roomDir, { allowExtension: true });
      let bank2;
      try {
        bank2 = fileLikeTheLiveCaller(db2, BANK_SESSION_ID, fixture2.statements, {
          stampsByKey: fixture2.stampsByKey,
          roomDir: fixture2.roomDir,
          runMode: 'test-mode-disabled',
        });
      } finally {
        closeRoomDb(db2);
      }
      if (prevEnv === undefined) delete process.env.MINDRIAN_DISABLE_MEMORY_EVENT;
      else process.env.MINDRIAN_DISABLE_MEMORY_EVENT = prevEnv;

      check('filing: filing still succeeds under MINDRIAN_DISABLE_MEMORY_EVENT=1', bank2 && bank2.ok === true && bank2.filed === 1, JSON.stringify(bank2));
      db2 = openRoomDb(fixture2.roomDir, { allowExtension: true });
      const memRows2 = db2.prepare("SELECT id FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'cross_connection_stamped'").all();
      closeRoomDb(db2);
      check('filing: MINDRIAN_DISABLE_MEMORY_EVENT=1 writes NO cross_connection_stamped event', memRows2.length === 0, JSON.stringify(memRows2));
    } finally {
      fixture2.cleanup();
    }

    // -----------------------------------------------------------------------
    // 10. Static Part 9 leg: the one stamped filer
    //     (lib/core/research-planner/filing-stamped.cjs) contains no raw
    //     INSERT INTO, openGraph( or DatabaseSync; every write goes through
    //     navigation.cjs, and it requires navigation.cjs.
    // -----------------------------------------------------------------------
    const filerSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'research-planner', 'filing-stamped.cjs'), 'utf8');
    const forbidden = filerSrc.split('\n').filter(function (l) { return /INSERT INTO|openGraph\(|DatabaseSync/.test(l); });
    check('filing: no raw INSERT INTO / openGraph( / DatabaseSync in filing-stamped.cjs', forbidden.length === 0, JSON.stringify(forbidden));
    check('filing: filing-stamped.cjs requires navigation.cjs (the Part 9 chokepoint)', /require\(['"]\.\.\/navigation\.cjs['"]\)/.test(filerSrc));

    // -----------------------------------------------------------------------
    // 11. Static order leg (D-56): fileStampedOpportunity is synchronous and
    //     never opens its own transaction, and the live caller
    //     (lib/core/ambient-run.cjs) has no await between its BEGIN and
    //     COMMIT around the filer.
    // -----------------------------------------------------------------------
    const fnStart = filerSrc.indexOf('function fileStampedOpportunity(');
    check('filing: fileStampedOpportunity is found in source', fnStart !== -1);
    const fnEnd = filerSrc.indexOf('\n}\n', fnStart);
    const fnBody = filerSrc.slice(fnStart, fnEnd);
    check('filing: fileStampedOpportunity is not declared async', filerSrc.slice(Math.max(0, fnStart - 6), fnStart).indexOf('async') === -1);
    check('filing: no await inside fileStampedOpportunity', fnBody.indexOf('await ') === -1);
    check('filing: fileStampedOpportunity never opens or commits its own transaction', !/db\.exec\('(BEGIN|COMMIT|ROLLBACK)'\)/.test(fnBody));
    const ambSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'ambient-run.cjs'), 'utf8');
    const callIdx = ambSrc.indexOf('nodeId = fileStampedOpportunity(db');
    const beginIdx = ambSrc.lastIndexOf("db.exec('BEGIN')", callIdx);
    const commitIdx = ambSrc.indexOf("db.exec('COMMIT')", callIdx);
    check('filing: the live caller wraps the filer in BEGIN/COMMIT', callIdx !== -1 && beginIdx !== -1 && commitIdx > callIdx);
    check('filing: no await between the live caller BEGIN and COMMIT', ambSrc.slice(beginIdx, commitIdx).indexOf('await ') === -1);
  } finally {
    fixture.cleanup();
  }
}

main()
  .catch((e) => {
    console.log('FAIL: uncaught error in test-355-filing.cjs -- ' + (e && e.stack ? e.stack : e));
    check('no uncaught error', false, e && e.message);
  })
  .then(() => {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + wasKeyPresent);
    process.exit(checker.summary());
  });
