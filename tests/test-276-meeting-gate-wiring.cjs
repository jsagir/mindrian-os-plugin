#!/usr/bin/env node
'use strict';

/*
 * Plan 276-14 (TOOLHON-07) -- RED-first proof that meeting filing reaches
 * the governed gate, and that confirmation only happens through it.
 *
 * AUTHORED BEFORE THE WIRING EXISTS. Same TDD discipline as the precedent
 * commits `209b604f` (RED) / `75278850` (GREEN): this file is written, run,
 * and observed failing against a tree where the `meeting` tool's
 * `file-meeting` branch does not yet accept a claim payload or reach
 * gate_render/gate_answer, before a single line of that wiring is written.
 *
 * CONTRACT SOURCE: .planning/phases/276-mcp-tool-honesty-triage-and-close-
 * the-check-tool-honesty-cjs/276-DECISIONS.md (status: ratified). OQ-276-2
 * ANSWER (option a) rules the write-then-gate order this file pins: one
 * tool, claim_write, files at review_status proposed; the shipped
 * gate_answer approve branch (lib/mcp/tools/gate.cjs:168-235,
 * navigation.confirmNode) promotes it. This plan wires the `meeting` tool's
 * `file-meeting` branch to compose the SAME two primitives (writeClaimNode
 * plus gate-render.cjs's renderGate / gate-ledger.cjs's mintGate), never a
 * second write path and never a second gate mechanism.
 *
 * HARNESS STYLE: combines the two sibling harness styles already in this
 * repo -- registerRouterTools (tests/test-kwl-meeting-mcp-honesty.cjs) for
 * the `meeting` tool itself, plus registerCoreTools
 * (tests/test-276-claim-write-primitive.cjs) for `gate_render`/`gate_answer`
 * -- against the SAME stub server capture map, so a real gate_id minted by
 * `meeting`'s handler can be consumed by the real `gate_answer` handler
 * through the SAME in-process lib/mcp/gate-ledger.cjs singleton (Node's own
 * require cache is what joins them; no cross-module wiring of this file's
 * own).
 *
 * NEVER TRUST THE TOOL'S OWN SUCCESS CLAIM. Assertion group B independently
 * re-opens room.db with node:sqlite and reads review_status back -- the
 * response text is never treated as proof of confirmation by itself. That
 * discipline is the reason this whole phase exists
 * (.planning/debug/meeting-file-meeting-false-success.md).
 *
 * Canon Part 8: this file opens no network surface. Local mkdtemp room.db
 * only, MINDRIAN_ROOMS_HOME pinned to a fresh scratch dir per the 276-12
 * hermetic-room precedent (its own first run silently wrote into a real
 * room on this machine; do not repeat that here).
 *
 * Run: node tests/test-276-meeting-gate-wiring.cjs
 * Exit: 1 while the wiring is absent (RED, groups A/B/E failing). 0 once
 * the wiring lands (GREEN, plan 276-14 Task 2). No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');

const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

// Hermetic room resolution (276-12-SUMMARY.md precedent). lib/core/
// resolve-active-room.cjs defaults `home` to $HOME/MindrianRooms and reads
// that home's registry.json for an active-session hit -- on a real dev
// machine that registry is real and would silently redirect this test's
// writes into someone's actual room. Point MINDRIAN_ROOMS_HOME at a fresh,
// registry-less scratch dir so every resolver floors to ctx.fallbackRoomDir
// (the temp room this test actually reads back), and delete any inherited
// CLAUDE_ACTIVE_ROOM so it cannot short-circuit the same resolvers.
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-14-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function makeTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-14-meeting-'));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function roomDbPath(dir) {
  return path.join(dir, '.mindrian', 'room.db');
}

function withDb(dbPath, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function countConfirmedNodes(dbPath) {
  return withDb(dbPath, (db) => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE review_status = 'confirmed'").get();
    return row ? row.n : 0;
  });
}

function countClaimNodes(dbPath) {
  return withDb(dbPath, (db) => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'claim'").get();
    return row ? row.n : 0;
  });
}

function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}

async function run() {
  process.stdout.write('Plan 276-14 (TOOLHON-07): RED-first proof for the meeting gate wiring\n');
  process.stdout.write('Contract source: 276-DECISIONS.md OQ-276-2 (option a, write-then-gate).\n\n');

  const roomDir = makeTempRoom();
  const dbPath = roomDbPath(roomDir);

  const captured = new Map();
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description, schema, handler });
    },
  };

  registerRouterTools(stubServer, roomDir, REPO_ROOT, { full: '' }, 'cli');
  registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });

  const meetingReg = captured.get('meeting');
  const gateAnswerReg = captured.get('gate_answer');
  check('harness reached the real `meeting` registration', !!meetingReg,
    'registered tools: ' + Array.from(captured.keys()).join(', '));
  check('harness reached the real `gate_answer` registration', !!gateAnswerReg,
    'registered tools: ' + Array.from(captured.keys()).join(', '));
  if (!meetingReg || !gateAnswerReg) {
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed (aborted: a required tool never registered)\n');
    process.exit(1);
  }

  const description = typeof meetingReg.description === 'string' ? meetingReg.description : '';
  const SESSION_ID = 'test-session-276-14-meeting-gate';
  const CLAIM_TEXT = 'The IRIS pilot converted three enterprise leads in Q3.';

  // -------------------------------------------------------------------
  // Assertion group A -- the gate is reached (276-DECISIONS.md OQ-276-2,
  // option a: write-then-gate). A file-meeting call carrying a claim
  // payload must route to the governed gate: a non-empty gate_id.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- A: THE GATE IS REACHED (OQ-276-2 option a) --\n');
  let fileMeetingRaw;
  let fileMeetingText = '';
  try {
    fileMeetingRaw = await meetingReg.handler(
      { command: 'file-meeting', knowledge_type: 'fact', claim_text: CLAIM_TEXT },
      { sessionId: SESSION_ID }
    );
    fileMeetingText = textOf(fileMeetingRaw);
  } catch (e) {
    fileMeetingText = '';
    check('file-meeting with a claim payload did not throw', false, String((e && e.stack) || e));
  }
  const gateIdMatch = /gate_id[:*"\s]+\**\s*([A-Za-z0-9._-]+)/.exec(fileMeetingText)
    || /"gate_id"\s*:\s*"([^"]+)"/.exec(fileMeetingText);
  const gateId = gateIdMatch ? gateIdMatch[1] : null;
  check('file-meeting with a claim payload returns a non-empty gate_id', !!gateId,
    'response: ' + JSON.stringify(fileMeetingText.slice(0, 400)));
  check('the response names gate_answer as the required next step', fileMeetingText.indexOf('gate_answer') !== -1,
    'response: ' + JSON.stringify(fileMeetingText.slice(0, 400)));

  // -------------------------------------------------------------------
  // Assertion group B -- confirmation happens only through the gate.
  // Read room.db directly with node:sqlite; never trust the response.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- B: CONFIRMATION ONLY THROUGH gate_answer (proven against room.db) --\n');
  const confirmedBefore = countConfirmedNodes(dbPath);
  check('no node is review_status=confirmed before gate_answer is called',
    confirmedBefore === 0, 'confirmed count before=' + confirmedBefore);

  let gateAnswerRaw = null;
  if (gateId) {
    gateAnswerRaw = await gateAnswerReg.handler(
      { gate_id: gateId, chosen: ['approve'], verdict: 'approve' },
      { sessionId: SESSION_ID }
    );
  }
  const confirmedAfter = countConfirmedNodes(dbPath);
  check('a node IS review_status=confirmed after gate_answer approve (independent room.db read)',
    !!gateId && confirmedAfter >= 1,
    'gate_id=' + gateId + ' confirmed count after=' + confirmedAfter +
      ' gate_answer response=' + JSON.stringify(textOf(gateAnswerRaw)).slice(0, 300));

  // -------------------------------------------------------------------
  // Assertion group C -- the ledger is single-use (T-198-10 spoofing
  // guard). If the shipped gate_answer already enforces this, this
  // assertion is a REGRESSION PIN: this plan must not weaken it.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- C: SINGLE-USE LEDGER (T-198-10 REGRESSION PIN) --\n');
  if (gateId) {
    const secondAnswer = await gateAnswerReg.handler(
      { gate_id: gateId, chosen: ['approve'], verdict: 'approve' },
      { sessionId: SESSION_ID }
    );
    const secondText = textOf(secondAnswer);
    let secondJson = null;
    try { secondJson = JSON.parse(secondText); } catch (_e) { secondJson = null; }
    check('REGRESSION PIN: answering the same gate_id a second time is refused',
      !!secondJson && secondJson.ok === false && secondJson.reason === 'unknown_or_expired_gate',
      'second answer response: ' + secondText);
  } else {
    check('REGRESSION PIN: answering the same gate_id a second time is refused',
      false, 'no gate_id available from group A to drive this check');
  }

  // -------------------------------------------------------------------
  // Assertion group D -- no second gate mechanism (Canon Part 7). The
  // meeting branches define no new confirm/ratify function of their own,
  // and they DO reference the real gate surface.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- D: NO SECOND GATE MECHANISM (Canon Part 7) --\n');
  const routerText = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
  const confirmRatifyMatches = routerText.match(/function\s+[A-Za-z0-9_$]*(confirm|ratify)[A-Za-z0-9_$]*\s*\(/gi) || [];
  check('lib/mcp/tool-router.cjs defines no new confirm/ratify-named function',
    confirmRatifyMatches.length === 0,
    'matches: ' + JSON.stringify(confirmRatifyMatches));

  // Isolate the meeting tool's own registration block (between the
  // `'meeting',` server.tool() name literal and the next `'export',`
  // server.tool() name literal) so this check is scoped to the branches
  // this plan touches, not the whole 2000-line file. Anchored on the
  // quoted tool-name literals (unique, verified via grep during planning)
  // rather than the "7. meeting" / "8. export" comment-header text, which
  // ALSO appears in this file's own top-of-file JSDoc router summary and
  // would otherwise match that summary line first, producing a near-empty
  // slice.
  const meetingSectionStart = routerText.indexOf("'meeting',");
  // Search for the END anchor STARTING AFTER meetingSectionStart: the bare
  // literal "'export'," also appears earlier in the file inside the
  // EXPORT_COMMANDS / ALL_TOOL_COMMANDS vocabulary arrays (well before the
  // meeting tool's own registration), so an unscoped indexOf would find
  // that earlier occurrence and produce an empty (or negative-length)
  // slice. The registration site is the ONLY occurrence after the meeting
  // tool's own start index.
  const meetingSectionEnd = meetingSectionStart !== -1
    ? routerText.indexOf("'export',", meetingSectionStart)
    : -1;
  const meetingSection = (meetingSectionStart !== -1 && meetingSectionEnd !== -1)
    ? routerText.slice(meetingSectionStart, meetingSectionEnd)
    : '';
  check('the meeting branches reference the real gate surface (gate_render / gate_answer / gate-render.cjs / gate-ledger.cjs)',
    /gate_render|gate_answer|gate-render\.cjs|gate-ledger\.cjs/.test(meetingSection),
    'meeting section length=' + meetingSection.length);

  // -------------------------------------------------------------------
  // Assertion group E -- the description is honest about BOTH halves:
  // the new confirmation path, AND the still-unreachable subagent fan-out.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- E: DESCRIPTION HONEST ABOUT BOTH HALVES --\n');
  check('description names the confirmation path that now exists (gate_render/gate_answer)',
    description.indexOf('gate_answer') !== -1 && (description.indexOf('gate_render') !== -1 || description.indexOf('gate-render') !== -1),
    'description: ' + JSON.stringify(description));
  check('description still states the five-perspective subagent fan-out is unavailable here',
    /five-perspective/i.test(description) && /unavailable|unreachable/i.test(description),
    'description: ' + JSON.stringify(description));
  check('description still names /mos:file-meeting as the CLI path for the fuller pipeline',
    description.indexOf('/mos:file-meeting') !== -1,
    'description: ' + JSON.stringify(description));

  // -------------------------------------------------------------------
  // Assertion group F -- the shipped kwl fixture stays intact. This MUST
  // pass even in the RED run: the pre-existing honesty fix is untouched
  // until this plan deliberately wires anything.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- F: SHIPPED test-kwl-meeting-mcp-honesty.cjs FIXTURE INTACT --\n');
  let kwlOk = false;
  let kwlDetail = '';
  try {
    execFileSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-kwl-meeting-mcp-honesty.cjs')], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });
    kwlOk = true;
  } catch (e) {
    kwlOk = false;
    kwlDetail = String((e && e.stdout && e.stdout.toString()) || (e && e.message) || e).slice(0, 600);
  }
  check('node tests/test-kwl-meeting-mcp-honesty.cjs exits 0', kwlOk, kwlDetail);

  // -------------------------------------------------------------------
  // Assertion group G -- Canon Part 8. The meeting branches make no
  // brain_ call literal.
  // -------------------------------------------------------------------
  process.stdout.write('\n-- G: CANON PART 8 (no brain_ call in the meeting branches) --\n');
  check('the meeting branches contain no brain_ call literal',
    meetingSection.indexOf('brain_') === -1,
    'meeting section length=' + meetingSection.length);

  fs.rmSync(roomDir, { recursive: true, force: true });
  fs.rmSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true, force: true });

  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (7 groups: A_GATE_REACHED, B_CONFIRM_ONLY_VIA_GATE, C_SINGLE_USE_LEDGER,' +
    ' D_NO_SECOND_GATE, E_DESCRIPTION_BOTH_HALVES, F_KWL_FIXTURE_INTACT, G_NO_BRAIN_CALL)\n'
  );
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stdout.write('\n  FATAL: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});
