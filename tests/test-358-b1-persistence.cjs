#!/usr/bin/env node
'use strict';

/*
 * Phase 358-04 Task 3 -- AT2 literal: "Close everything. In a new session,
 * reopen the claim: the record is there and readable." Proven with SEPARATE
 * OS PROCESSES and SEPARATE session ids (tests/helpers/b1-358-child.cjs),
 * never an in-process function call standing in for "close everything" --
 * every child process registers its own tools fresh, holds nothing from any
 * other child in memory, and exits before the next one starts.
 *
 * Sequence:
 *   1. write   in session S1 (a separate process) -- files the bridge claim
 *      and records the checking record on it.
 *   2. refile  in session S1 (a separate process) -- the SAME claim id A
 *      keeps its checking record across the re-file (the cross-process face
 *      of the fix tests/test-358-b1-refile.cjs already regression-tests
 *      in-process; that file is the NEGATIVE CONTROL for this step -- it is
 *      never reverted in the tree to "prove" this test passes).
 *   3. read    in session S2 (a brand-new process AND session, nothing held
 *      in memory) -- reopens claim A by words and shows the full record.
 *   4. This process (the parent, after every child has exited) re-opens
 *      room.db directly through navigation.cjs and reads the SAME record
 *      straight from nodes.properties -- the record is on disk, not in any
 *      process, and this assertion never trusts a child's own success claim.
 *   5. file-again in session S2 mints a NEW claim id B (claim ids are
 *      claim:<sessionId>:<hash>, Pitfall 3: a new session re-filing the same
 *      sentence is a new claim, never a silent dedupe); read in session S3
 *      then lists BOTH claims, A still disputed and B unchecked, so the
 *      duplicate is visible rather than silently hidden.
 *
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(REPO_ROOT, 'tests', 'helpers', 'b1-358-child.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

// One shared hermetic room and env for every child in this run. Each child
// registers its own tools fresh (registerAndCapture in b1-358-child.cjs), so
// sharing the env, not the process, is what makes this a true cross-process
// test: the room on disk is the only thing that carries state forward.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-persistence-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-persistence-roomshome-'));
const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-persistence-room-'));
const boot = openRoomDb(room);
closeRoomDb(boot);

const CHILD_ENV = Object.assign({}, process.env, {
  HOME: TMP_HOME,
  MINDRIAN_HOME: TMP_HOME,
  MINDRIAN_ROOMS_HOME: ROOMS_HOME,
});
delete CHILD_ENV.MINDRIAN_MCP_FIRST;
delete CHILD_ENV.CLAUDE_ACTIVE_ROOM;

function parseLastJsonLine(stdout) {
  const lines = (stdout || '').trim().split('\n');
  const last = lines[lines.length - 1];
  try {
    return JSON.parse(last);
  } catch (_e) {
    return null;
  }
}

function childArgs(mode, sessionId, query) {
  const args = [HELPER, mode, room, sessionId];
  if (query !== undefined) args.push(query);
  return args;
}

process.stdout.write('Phase 358-04 Task 3: AT2 literal, cross-process cross-session persistence\n\n');

// -- 1. write in session S1 (a separate process) -----------------------------
const writeRes = cp.spawnSync(process.execPath, childArgs('write', 'S1'), { env: CHILD_ENV, encoding: 'utf8' });
const writeRun = { status: writeRes.status, parsed: parseLastJsonLine(writeRes.stdout), stderr: writeRes.stderr };
check('1. write (S1) exits 0', writeRun.status === 0, JSON.stringify(writeRun.parsed || writeRun.stderr));
const nodeIdA = writeRun.parsed && writeRun.parsed.node_id;
check('1. write (S1) returns a node_id', typeof nodeIdA === 'string' && nodeIdA.length > 0);

// -- 2. refile in session S1 (a separate process) ----------------------------
const refileRes = cp.spawnSync(process.execPath, childArgs('refile', 'S1'), { env: CHILD_ENV, encoding: 'utf8' });
const refileRun = { status: refileRes.status, parsed: parseLastJsonLine(refileRes.stdout), stderr: refileRes.stderr };
check('2. refile (S1) exits 0', refileRun.status === 0, JSON.stringify(refileRun.parsed || refileRun.stderr));
check('2. refile returns the SAME node_id A',
  refileRun.parsed && refileRun.parsed.node_id === nodeIdA, refileRun.parsed && refileRun.parsed.node_id);

// -- 3. read in session S2, a brand-new process AND session ------------------
const readS2Res = cp.spawnSync(process.execPath, childArgs('read', 'S2', 'bridge'), { env: CHILD_ENV, encoding: 'utf8' });
const readS2Run = { status: readS2Res.status, parsed: parseLastJsonLine(readS2Res.stdout), stderr: readS2Res.stderr };
check('3. read (S2) exits 0', readS2Run.status === 0, JSON.stringify(readS2Run.parsed || readS2Run.stderr));
const payload3 = readS2Run.parsed && readS2Run.parsed.payload;
check('3. exactly one claim listed', payload3 && Array.isArray(payload3.claims) && payload3.claims.length === 1,
  JSON.stringify(payload3 && payload3.claims));
check('3. payload.claim.claim_id is A', payload3 && payload3.claim && payload3.claim.claim_id === nodeIdA);

const checkingRecord3 = payload3 && payload3.claim && payload3.claim.checking_record;
check('3. checking_record.status is disputed', checkingRecord3 && checkingRecord3.status === 'disputed');
const record3 = checkingRecord3 && Array.isArray(checkingRecord3.records) ? checkingRecord3.records[0] : null;
check('3. the single record carries against_id, against_kind, rung, rung_label, method, result',
  record3 && record3.against_id === 'field note, exercise 02' && record3.against_kind === 'observation' &&
  record3.rung === 3 && record3.rung_label === navigation.VERIFICATION_RUNGS[2].label &&
  record3.method === 'compare' && record3.result === 'contradicts',
  JSON.stringify(record3));
check('3. the single record carries checked_by user, a parseable checked_at, and checked_by_id',
  record3 && record3.checked_by === 'user' && !Number.isNaN(Date.parse(record3.checked_at)) &&
  typeof record3.checked_by_id === 'string' && record3.checked_by_id.length > 0,
  JSON.stringify(record3));
check('3. confirmation.review_status is proposed',
  payload3 && payload3.claim && payload3.claim.confirmation &&
  payload3.claim.confirmation.review_status === 'proposed');

const rendered3 = payload3 && payload3.rendered && payload3.rendered.claim;
check('3. rendered.claim contains "Confirmation status: proposed"',
  typeof rendered3 === 'string' && rendered3.indexOf('Confirmation status: proposed') !== -1);
check('3. rendered.claim contains "rung 3 ("',
  typeof rendered3 === 'string' && rendered3.indexOf('rung 3 (') !== -1);
check('3. portrait.claims_disputed is 1',
  payload3 && payload3.portrait && payload3.portrait.claims_disputed === 1);

// -- 4. after EVERY child has exited, this process reads the SAME record ----
//    straight from room.db -- never trusting a child's own success claim.
const db4 = navigation.openRoomDbForCaller(room);
check('4. room.db opens in this process after every child has exited', !!db4);
if (db4) {
  try {
    const view4 = navigation.readClaimVerification(db4, nodeIdA);
    check('4. the record is on disk, not in any process',
      view4.ok === true && Array.isArray(view4.claim.checking_record.records) &&
      view4.claim.checking_record.records.length === 1 &&
      view4.claim.checking_record.records[0].against_id === 'field note, exercise 02',
      JSON.stringify(view4));
  } finally {
    navigation.closeRoomDbForCaller(db4);
  }
} else {
  check('4. the record is on disk, not in any process (skipped, no db handle)', false);
}

// -- 5. file-again in session S2 mints a NEW claim id B ----------------------
const fileAgainRes = cp.spawnSync(process.execPath, childArgs('file-again', 'S2'), { env: CHILD_ENV, encoding: 'utf8' });
const fileAgainRun = {
  status: fileAgainRes.status, parsed: parseLastJsonLine(fileAgainRes.stdout), stderr: fileAgainRes.stderr,
};
check('5. file-again (S2) exits 0', fileAgainRun.status === 0,
  JSON.stringify(fileAgainRun.parsed || fileAgainRun.stderr));
const nodeIdB = fileAgainRun.parsed && fileAgainRun.parsed.node_id;
check('5. file-again mints a DIFFERENT node_id B (Pitfall 3, never a silent dedupe)',
  typeof nodeIdB === 'string' && nodeIdB.length > 0 && nodeIdB !== nodeIdA);

const readS3Res = cp.spawnSync(process.execPath, childArgs('read', 'S3', 'bridge'), { env: CHILD_ENV, encoding: 'utf8' });
const readS3Run = { status: readS3Res.status, parsed: parseLastJsonLine(readS3Res.stdout), stderr: readS3Res.stderr };
check('5. read (S3) exits 0', readS3Run.status === 0, JSON.stringify(readS3Run.parsed || readS3Run.stderr));
const payload5 = readS3Run.parsed && readS3Run.parsed.payload;
check('5. two claims listed in S3 (the duplicate is visible)',
  payload5 && Array.isArray(payload5.claims) && payload5.claims.length === 2,
  JSON.stringify(payload5 && payload5.claims));

const byId5 = {};
(payload5 && payload5.claims ? payload5.claims : []).forEach((c) => { byId5[c.claim_id] = c; });
check('5. claim A still shows checking_status disputed',
  byId5[nodeIdA] && byId5[nodeIdA].checking_status === 'disputed');
check('5. claim B shows checking_status unchecked',
  byId5[nodeIdB] && byId5[nodeIdB].checking_status === 'unchecked');
check('5. two matches attaches no single claim view (the demo script says reopen, do not re-file)',
  payload5 && !payload5.claim);

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
