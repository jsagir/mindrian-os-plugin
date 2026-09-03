#!/usr/bin/env node
'use strict';

/*
 * Quick 260903-kwl -- pins the fix for
 * .planning/debug/meeting-file-meeting-false-success.md.
 *
 * WHAT THIS DEFENDS. The `meeting` MCP tool's `file-meeting` branch used to
 * return a completion-shaped response ("## File Meeting", room state, a
 * Filing Protocol section, the echoed transcript, a "Meeting filed" footer)
 * while its handler contained no write call anywhere. Worse, the one thing
 * the branch DID try to do (hand back references/meeting/filing-protocol.md)
 * failed silently too, because that file did not exist on disk and the
 * branch dropped the section without a word when the read missed. This file
 * pins five properties so that defect shape cannot silently return: an
 * honest description, a leading machine-checkable no-write marker on all
 * three meeting branches, a real filing protocol actually reaching the
 * response, the no-write property itself (proven, not asserted), and a
 * drift guard between this file's shared taxonomy and its extract.
 *
 * METHOD. Does NOT clone the full stdio spawn harness --
 * tests/test-234-tool-description-floor.cjs already drives every tool's
 * description over the wire and is run by tests/run-all-266.sh. This file
 * requires lib/mcp/tool-router.cjs directly, builds a stub `server` object
 * whose `.tool(name, description, schema, handler)` captures each
 * registration into a map, calls registerRouterTools() against a bare
 * mkdtempSync room, then pulls the `meeting` registration and invokes its
 * handler directly. fireCascade() swallows every error in a try/catch
 * (lib/mcp/tool-router.cjs:561-569), so a temp room with no room.db is safe.
 *
 * HARNESS HONESTY GUARD (mandatory, load-bearing). Before grading anything,
 * this file asserts the capture map is non-empty AND that the `meeting`
 * registration was actually found. A missing registration fails loudly. A
 * green run that never reached the handler is the exact false-success shape
 * this whole fix exists to close, and this file must not be able to produce
 * one silently.
 *
 * Canon Part 8: reads plugin-local files and a mkdtemp scratch room only.
 * Zero network reach, zero writes outside the scratch dir.
 *
 * Run: node tests/test-kwl-meeting-mcp-honesty.cjs
 * Exit: 0 when all five scenarios pass, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { registerRouterTools, _test } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const MEETING_COMMANDS = _test.MEETING_COMMANDS;

const NO_WRITE_MARKER = '**filed: false**';
const MIN_DESCRIPTION_CHARS = 120;
const SENTENCE_TERMINATOR = /[.!?][)\]"'’”]*$/;

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
    if (detail) process.stdout.write('    ' + detail + '\n');
  }
}

// ---------------------------------------------------------------------------
// Setup: capture every tool registration through a stub server, against a
// bare temp room. No node:sqlite requirement -- registerRouterTools only
// wires closures at registration time; nothing under this call touches
// room.db until a handler is actually invoked.
// ---------------------------------------------------------------------------
const tmpRoomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kwl-meeting-honesty-'));
const captured = new Map();
const stubServer = {
  tool: (name, description, schema, handler) => {
    captured.set(name, { description, schema, handler });
  },
};

registerRouterTools(stubServer, tmpRoomDir, REPO_ROOT, { full: '' }, 'cli');

process.stdout.write('Quick 260903-kwl: meeting MCP tool honesty pin\n');

// Harness honesty guard -- must fail loudly, never report a vacuous pass.
check('capture map is non-empty (harness reached real registrations)', captured.size > 0,
  'captured.size=' + captured.size);
check('the `meeting` tool registration was actually found', captured.has('meeting'),
  'registered tools: ' + Array.from(captured.keys()).join(', '));

if (!captured.has('meeting')) {
  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed (aborted: meeting tool never registered)\n');
  process.exit(1);
}

const meetingEntry = captured.get('meeting');
const description = typeof meetingEntry.description === 'string' ? meetingEntry.description : '';
const handler = meetingEntry.handler;

// ---------------------------------------------------------------------------
// Scenario 1: DESCRIPTION_HONEST
// ---------------------------------------------------------------------------
process.stdout.write('\n-- DESCRIPTION_HONEST --\n');
const OVERCLAIM_SUBSTRINGS = [
  'parses a transcript and files it',
  'runs the full meeting-intelligence pass',
  'resolves who said what',
];
for (const bad of OVERCLAIM_SUBSTRINGS) {
  check('description does not contain overclaim: "' + bad + '"', description.indexOf(bad) === -1,
    'got: ' + JSON.stringify(description));
}
check('description mentions artifact_file', description.indexOf('artifact_file') !== -1);
check('description length >= ' + MIN_DESCRIPTION_CHARS + ' chars (fast local fail)', description.length >= MIN_DESCRIPTION_CHARS,
  'length=' + description.length);
check('description carries no em-dash (fast local fail)', description.indexOf('\u2014') === -1);
check('description starts with a capital letter (fast local fail)', /^[A-Z]/.test(description));
check('description ends with a sentence terminator (fast local fail)', SENTENCE_TERMINATOR.test(description.trim()),
  'tail: ' + JSON.stringify(description.slice(-40)));

// ---------------------------------------------------------------------------
// Scenario 2: NO_WRITE_MARKER_ALL_BRANCHES
// Drive all three from MEETING_COMMANDS read off the module, not a
// hand-typed literal, so a fourth command added later cannot escape this.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- NO_WRITE_MARKER_ALL_BRANCHES --\n');
check('MEETING_COMMANDS is exported and non-empty', Array.isArray(MEETING_COMMANDS) && MEETING_COMMANDS.length > 0,
  'MEETING_COMMANDS=' + JSON.stringify(MEETING_COMMANDS));

const branchResponses = {};
(async () => {
  for (const command of MEETING_COMMANDS) {
    const result = await handler({ command, context: 'a non-empty context string for this scenario' });
    const text = result && result.content && result.content[0] && result.content[0].text;
    branchResponses[command] = text || '';
    const firstThreeLines = (text || '').split('\n').slice(0, 3).join('\n');
    check('`' + command + '` response carries ' + NO_WRITE_MARKER + ' within its first three lines',
      firstThreeLines.indexOf(NO_WRITE_MARKER) !== -1,
      'first three lines: ' + JSON.stringify(firstThreeLines));
  }

  // -------------------------------------------------------------------------
  // Scenario 3: PROTOCOL_PRESENT
  // -------------------------------------------------------------------------
  process.stdout.write('\n-- PROTOCOL_PRESENT --\n');
  const fileMeetingText = branchResponses['file-meeting'] || '';
  const PASS_NAMES = ['Selection', 'Disambiguation', 'Decomposition', 'Typing'];
  for (const passName of PASS_NAMES) {
    check('file-meeting response contains Claimify pass name "' + passName + '"',
      fileMeetingText.indexOf(passName) !== -1);
  }
  const KNOWLEDGE_TYPES = ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption'];
  const presentTypes = KNOWLEDGE_TYPES.filter((t) => fileMeetingText.indexOf(t) !== -1);
  check('file-meeting response contains at least 3 of the 6 knowledge_type members',
    presentTypes.length >= 3, 'present: ' + presentTypes.join(', '));

  // -------------------------------------------------------------------------
  // Scenario 4: NO_WRITE_PROPERTY (RCA Test 2)
  // Pins the CORRECT-once-honestly-described behavior in both directions: it
  // guards against a future silent write appearing here without a
  // description change, and it will go red the day someone genuinely wires
  // the MCP write path -- which is the moment the description must change
  // with it.
  // -------------------------------------------------------------------------
  process.stdout.write('\n-- NO_WRITE_PROPERTY --\n');
  const sentinelRoomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kwl-meeting-nowrite-'));
  const captured2 = new Map();
  const stubServer2 = {
    tool: (name, desc2, schema2, handler2) => captured2.set(name, { handler: handler2 }),
  };
  registerRouterTools(stubServer2, sentinelRoomDir, REPO_ROOT, { full: '' }, 'cli');
  const handler2 = captured2.get('meeting').handler;

  const SENTINEL = 'KWL-SENTINEL-' + Date.now() + '-do-not-persist';

  function snapshotTree(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else out.push(full);
      }
    }
    return out;
  }

  const roomDbPath = path.join(sentinelRoomDir, '.mindrian', 'room.db');
  const mtimeBefore = fs.existsSync(roomDbPath) ? fs.statSync(roomDbPath).mtimeMs : null;

  await handler2({ command: 'file-meeting', context: 'Transcript containing ' + SENTINEL + ' as a unique marker.' });

  const filesAfter = snapshotTree(sentinelRoomDir);
  const sentinelFiles = filesAfter.filter((f) => {
    try {
      return fs.readFileSync(f, 'utf8').indexOf(SENTINEL) !== -1;
    } catch (_e) {
      return false; // binary or unreadable, cannot carry the sentinel as text
    }
  });
  check('no file anywhere under the room dir contains the sentinel after file-meeting', sentinelFiles.length === 0,
    'files carrying sentinel: ' + sentinelFiles.join(', '));

  const mtimeAfter = fs.existsSync(roomDbPath) ? fs.statSync(roomDbPath).mtimeMs : null;
  if (mtimeBefore !== null) {
    check('room.db mtime is unchanged (existed before the call)', mtimeAfter === mtimeBefore,
      'before=' + mtimeBefore + ' after=' + mtimeAfter);
  } else {
    check('room.db does not spring into existence from a reference-only call', mtimeAfter === null,
      'room.db now exists at ' + roomDbPath);
  }

  fs.rmSync(sentinelRoomDir, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // Scenario 5: DRIFT_GUARD
  // -------------------------------------------------------------------------
  process.stdout.write('\n-- DRIFT_GUARD --\n');
  const filingProtocolPath = path.join(REPO_ROOT, 'references', 'meeting', 'filing-protocol.md');
  const fileMeetingCmdPath = path.join(REPO_ROOT, 'commands', 'file-meeting.md');
  const filingProtocolRaw = fs.readFileSync(filingProtocolPath, 'utf8');
  const fileMeetingCmdRaw = fs.readFileSync(fileMeetingCmdPath, 'utf8');

  // Strip markdown comment lines (<!-- ... -->) and blockquote-only lines
  // (lines starting with '>') so the guard cannot be satisfied by a file's
  // own explanatory prose about the taxonomy rather than the taxonomy itself.
  function stripCommentsAndQuotes(raw) {
    return raw
      .split('\n')
      .filter((line) => !/^\s*<!--/.test(line) && !/^\s*>/.test(line))
      .join('\n');
  }

  const filingProtocolBody = stripCommentsAndQuotes(filingProtocolRaw);
  const fileMeetingCmdBody = stripCommentsAndQuotes(fileMeetingCmdRaw);

  const SHARED_TOKENS = [
    'Selection', 'Disambiguation', 'Decomposition', 'Typing',
    'fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption',
    'decision', 'action-item', 'insight', 'advice', 'question', 'noise',
  ];

  for (const token of SHARED_TOKENS) {
    const inProtocol = filingProtocolBody.indexOf(token) !== -1;
    const inCommand = fileMeetingCmdBody.indexOf(token) !== -1;
    check('shared taxonomy token "' + token + '" appears in both filing-protocol.md and file-meeting.md',
      inProtocol && inCommand,
      'in filing-protocol.md: ' + inProtocol + ', in commands/file-meeting.md: ' + inCommand);
  }

  fs.rmSync(tmpRoomDir, { recursive: true, force: true });

  const branchesDriven = MEETING_COMMANDS.join(', ');
  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (5 scenarios: DESCRIPTION_HONEST, NO_WRITE_MARKER_ALL_BRANCHES, PROTOCOL_PRESENT,' +
    ' NO_WRITE_PROPERTY, DRIFT_GUARD; branches driven: ' + branchesDriven + ')\n'
  );
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  process.stdout.write('\n  FATAL: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});
