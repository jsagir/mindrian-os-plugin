#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 20 (HIPS-06, D-36..D-43, D-53 C4, D-56, AI-SPEC Section 7).
 * The D-43 filing proof: an accepted stamped eureka finding files as a
 * `proposed` opportunity through the EXISTING banking writer
 * (bankStatements), the stamp rides the node's props, SOURCED_FROM
 * provenance lands on the two source artifact nodes, and a real SENS-13
 * producer (writeStampedSideChannel) plus one local telemetry memory_event
 * fire after the write transaction commits.
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
const runner = require(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'));
const { buildFilingRoom, FROM_FRAMEWORK, TO_FRAMEWORK } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-355.cjs'));

const BANK_SESSION_ID = runner.BANK_SESSION_ID;

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
    // 1. bankStatements(db, BANK_SESSION_ID, statements, { stampsByKey,
    //    roomDir, runMode }) -- exactly one banked, one skipped.
    // -----------------------------------------------------------------------
    let db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const typesBefore = allNodeTypes(db);
    check('filing: fixture seeds a fresh room with no opportunity node yet', !typesBefore.has('opportunity'));

    const runMode = 'test-mode-355-20';
    let bank;
    try {
      bank = runner.bankStatements(db, BANK_SESSION_ID, fixture.statements, {
        stampsByKey: fixture.stampsByKey,
        roomDir: fixture.roomDir,
        runMode: runMode,
        stampElapsedMs: 250,
      });
    } finally {
      closeRoomDb(db);
    }
    check('filing: bankStatements returns ok:true', bank && bank.ok === true, JSON.stringify(bank));
    check('filing: bankStatements banked exactly 1', bank && bank.banked === 1, JSON.stringify(bank));
    check('filing: bankStatements skipped exactly 1', bank && bank.skipped === 1, JSON.stringify(bank));

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
    //    'sourced_from', origin 'eureka-355'; DERIVED_FROM edges still
    //    present.
    // -----------------------------------------------------------------------
    const sourcedFromRows = db.prepare("SELECT source, target, properties FROM edges WHERE source = ? AND type = 'SOURCED_FROM'").all(nodeId);
    check('filing: >= 2 SOURCED_FROM edges from the node', sourcedFromRows.length >= 2, JSON.stringify(sourcedFromRows));
    check('filing: every SOURCED_FROM edge carries relation sourced_from + origin eureka-355', sourcedFromRows.every(function (r) {
      const p = JSON.parse(r.properties || '{}');
      return p.relation === 'sourced_from' && p.origin === 'eureka-355';
    }), JSON.stringify(sourcedFromRows));
    const sourcedTargets = new Set(sourcedFromRows.map(function (r) { return r.target; }));
    check('filing: SOURCED_FROM targets are the two ARTIFACT nodes (D-38)', sourcedTargets.has(fixture.ids.artifactA) && sourcedTargets.has(fixture.ids.artifactB), JSON.stringify([...sourcedTargets]));

    const derivedFromRows = db.prepare("SELECT source, target FROM edges WHERE source = ? AND type = 'DERIVED_FROM'").all(nodeId);
    check('filing: pre-existing DERIVED_FROM edges are still present (2)', derivedFromRows.length === 2, JSON.stringify(derivedFromRows));

    // -----------------------------------------------------------------------
    // 5. The set of node types after banking is the before-set plus ONLY
    //    already-existing, well-established system types ('opportunity' the
    //    banked truth-claim, 'memory_event' the telemetry row) -- T-355-99's
    //    mitigation is "no ROGUE type minted", not "zero growth": a banking
    //    run that stamps a finding legitimately mints both.
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
    // 8. A memory_event 'cross_connection_stamped' exists with exactly the
    //    AI-SPEC key set and no string value longer than 64 chars.
    // -----------------------------------------------------------------------
    const memRows = db.prepare("SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'cross_connection_stamped'").all();
    check('filing: exactly 1 cross_connection_stamped memory_event', memRows.length === 1, JSON.stringify(memRows.length));
    if (memRows.length === 1) {
      const memProps = JSON.parse(memRows[0].properties || '{}');
      const wantKeys = ['producer', 'finding_count', 'tier_counts', 'reason_counts', 'backend', 'judge', 'theo_ms_bucket'];
      const hasAllKeys = wantKeys.every(function (k) { return Object.prototype.hasOwnProperty.call(memProps, k); });
      check('filing: memory_event carries the exact AI-SPEC key set', hasAllKeys, JSON.stringify(Object.keys(memProps)));
      check('filing: memory_event producer is eureka', memProps.producer === 'eureka');
      check('filing: memory_event judge is none', memProps.judge === 'none');
      check('filing: memory_event finding_count >= 1', typeof memProps.finding_count === 'number' && memProps.finding_count >= 1);
      check('filing: memory_event theo_ms_bucket is one of the four buckets', ['<1s', '1-3s', '3-10s', '>10s'].indexOf(memProps.theo_ms_bucket) !== -1, memProps.theo_ms_bucket);
      const strings = [];
      walkStrings(memProps, strings);
      check('filing: no memory_event string value exceeds 64 chars', strings.every(function (s) { return s.length <= 64; }), JSON.stringify(strings.filter(function (s) { return s.length > 64; })));
    }
    closeRoomDb(db);

    // -----------------------------------------------------------------------
    // 9. MINDRIAN_DISABLE_MEMORY_EVENT=1: banking still succeeds and writes
    //    no such event (a FRESH fixture room, so the count check is unambiguous).
    // -----------------------------------------------------------------------
    const fixture2 = await buildFilingRoom('filing-disabled');
    try {
      const prevEnv = process.env.MINDRIAN_DISABLE_MEMORY_EVENT;
      process.env.MINDRIAN_DISABLE_MEMORY_EVENT = '1';
      let db2 = openRoomDb(fixture2.roomDir, { allowExtension: true });
      let bank2;
      try {
        bank2 = runner.bankStatements(db2, BANK_SESSION_ID, fixture2.statements, {
          stampsByKey: fixture2.stampsByKey,
          roomDir: fixture2.roomDir,
          runMode: 'test-mode-disabled',
          stampElapsedMs: 50,
        });
      } finally {
        closeRoomDb(db2);
      }
      if (prevEnv === undefined) delete process.env.MINDRIAN_DISABLE_MEMORY_EVENT;
      else process.env.MINDRIAN_DISABLE_MEMORY_EVENT = prevEnv;

      check('filing: banking still succeeds under MINDRIAN_DISABLE_MEMORY_EVENT=1', bank2 && bank2.ok === true, JSON.stringify(bank2));
      db2 = openRoomDb(fixture2.roomDir, { allowExtension: true });
      const memRows2 = db2.prepare("SELECT id FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'cross_connection_stamped'").all();
      closeRoomDb(db2);
      check('filing: MINDRIAN_DISABLE_MEMORY_EVENT=1 writes NO cross_connection_stamped event', memRows2.length === 0, JSON.stringify(memRows2));
    } finally {
      fixture2.cleanup();
    }

    // -----------------------------------------------------------------------
    // 10. Static Part 9 leg: added lines (since BASE_355) in
    //     scripts/eureka-portfolio-report.cjs contain no raw INSERT INTO,
    //     openGraph( or DatabaseSync.
    // -----------------------------------------------------------------------
    const { execFileSync } = require('node:child_process');
    let diffOut = '';
    try {
      diffOut = execFileSync('git', ['diff', '-U0', '9458bf802', '--', 'scripts/eureka-portfolio-report.cjs'], { cwd: REPO, encoding: 'utf8' });
    } catch (_e) {
      diffOut = '';
    }
    const addedLines = diffOut.split('\n').filter(function (l) { return l.startsWith('+') && !l.startsWith('+++'); });
    const forbidden = addedLines.filter(function (l) { return /INSERT INTO|openGraph\(|DatabaseSync/.test(l); });
    check('filing: no raw INSERT INTO / openGraph( / DatabaseSync in scripts/eureka-portfolio-report.cjs added lines since BASE_355', forbidden.length === 0, JSON.stringify(forbidden));

    // -----------------------------------------------------------------------
    // 11. Static order leg: bankStatements is synchronous (no await anywhere
    //     inside it, so trivially none can sit between BEGIN and COMMIT).
    // -----------------------------------------------------------------------
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'), 'utf8');
    const fnStart = src.indexOf('function bankStatements(');
    check('filing: bankStatements is found in source', fnStart !== -1);
    const beginIdx = src.indexOf("db.exec('BEGIN')", fnStart);
    const commitIdx = src.indexOf("db.exec('COMMIT')", fnStart);
    check('filing: BEGIN/COMMIT literals found after bankStatements', beginIdx !== -1 && commitIdx !== -1 && commitIdx > beginIdx);
    const between = src.slice(beginIdx, commitIdx);
    check('filing: no await appears between BEGIN and COMMIT inside bankStatements', between.indexOf('await ') === -1, between.length);
    check('filing: bankStatements itself is not declared async', src.slice(fnStart - 6, fnStart).indexOf('async') === -1);
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
