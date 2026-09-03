#!/usr/bin/env node
'use strict';

/*
 * Phase 276-03, Task 1 -- the F-1 pin: `orchestration`'s description asserts
 * no write the MCP handler cannot perform, the scout* family self-discloses
 * its reference-only nature in-band, and the false "Scout intelligence
 * gathered" completion claim is forbidden.
 *
 * WHAT THIS DEFENDS. `orchestration`'s description
 * (lib/mcp/tool-router.cjs:1491) says "The room and scout operations are
 * ordinary reads and writes, so use them freely" while `scout` falls
 * through to the generic reference-echo fallback (:1623-1655), whose own
 * Suggested Next footer then reads "Scout intelligence gathered - analyze
 * room". Nothing is gathered and nothing is written; the CLI's /mos:scout
 * genuinely writes (a .snapshots/ state snapshot, a competitor report, an
 * HSI pipeline run), which is exactly why the description survived review.
 * This is the third confirmed instance of the same disease as
 * rooms-open-false-success (2026-07-27) and meeting-file-meeting-false-
 * success (2026-09-03).
 *
 * WRITTEN FIRST (TDD RED): scripts that fix this description
 * (lib/mcp/tool-router.cjs) have not been touched by this plan. This file is
 * authored, run, and observed FAILING against the pre-fix router, matching
 * the 209b604f (RED) / 75278850 (GREEN) precedent. The fix itself lands in
 * plan 276-08.
 *
 * METHOD. Ground truth over the wire, not a grep -- same discipline as
 * tests/test-234-tool-description-floor.cjs's listToolsOverStdio: the real
 * MCP server (bin/mindrian-mcp-server.cjs) is spawned, driven through a
 * genuine JSON-RPC initialize -> notifications/initialized -> tools/list ->
 * tools/call sequence, and the actual strings a host would receive are
 * measured. A source grep would miss a description assembled at runtime and
 * would misread a template literal.
 *
 * HARNESS HONESTY GUARD (mandatory, load-bearing). Before grading anything,
 * this file asserts the server answered tools/list AND that the
 * `orchestration` tool registration was actually found. A missing
 * registration fails loudly rather than reporting a vacuous pass -- the
 * exact false-success shape this whole phase exists to close.
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach, zero writes outside the
 * scratch dir.
 *
 * Run: node tests/test-276-orchestration-scout-honesty.cjs
 * Exit: 1 at the end of Wave 0 (RED BY DESIGN). No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const TIMEOUT_MS = 30000;

// Same floor/cap this file's fix must never break (tests/test-234-tool-
// description-floor.cjs's own constants, duplicated here rather than
// imported so this file has zero dependency on that file's internals).
const MIN_DESCRIPTION_CHARS = 120;
const HOST_DESCRIPTION_CAP_BYTES = 2048;

// The two shipped disclosure primitives (lib/mcp/tool-router.cjs:384-394,
// :1635-1638). Canon Part 7: reuse, never mint a third.
const NO_WRITE_MARKER = '**filed: false**';
const NOT_EXECUTED_TEXT = 'NOT EXECUTED.';

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

// ---------------------------------------------------------------------------
// spawnMcpSession(roomDir) -- spawn the real server once, drive a genuine
// initialize -> notifications/initialized -> tools/list -> tools/call
// sequence over its one stdio connection. Modeled on
// tests/test-234-tool-description-floor.cjs's listToolsOverStdio (the
// spawn/env shape) fused with tests/test-257-brain-tool-egress-invariant.cjs's
// spawnShim (the persistent request/notify pattern), because this file needs
// BOTH a tools/list AND a tools/call against the same live process.
// ---------------------------------------------------------------------------
function spawnMcpSession(roomDir) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-03-'));
  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_TRANSPORT: 'stdio',
    MINDRIAN_ROOM: roomDir,
  });
  delete env.MINDRIAN_BRAIN_KEY;

  const proc = cp.spawn('node', [SERVER], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], env });

  let stdoutBuf = '';
  let stderrBuf = '';
  const pending = new Map();
  let nextId = 1;

  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (obj && typeof obj.id !== 'undefined' && pending.has(obj.id)) {
        const p = pending.get(obj.id);
        pending.delete(obj.id);
        clearTimeout(p.timer);
        p.resolve(obj);
      }
    }
  });
  proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
  proc.on('exit', (code) => {
    pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('server exited (code=' + code + ') before responding; stderr tail: ' + stderrBuf.slice(-500)));
    });
    pending.clear();
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('timeout waiting for ' + method + ' (id=' + id + '); stderr tail: ' + stderrBuf.slice(-500)));
      }, TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id, method }, params !== undefined ? { params } : {})) + '\n');
    });
  }

  function notify(method, params) {
    proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', method }, params !== undefined ? { params } : {})) + '\n');
  }

  function cleanup() {
    try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  async function init() {
    await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-276-orchestration-scout-honesty', version: '1.0.0' },
    });
    notify('notifications/initialized');
  }

  async function listTools() {
    const resp = await request('tools/list', {});
    if (resp.error) throw new Error('tools/list error: ' + JSON.stringify(resp.error));
    return (resp.result && resp.result.tools) || [];
  }

  async function callTool(name, args) {
    const resp = await request('tools/call', { name, arguments: args });
    if (resp.error) throw new Error('tools/call(' + name + ') error: ' + JSON.stringify(resp.error));
    const content = resp.result && resp.result.content && resp.result.content[0];
    return (content && content.type === 'text') ? content.text : '';
  }

  return { init, listTools, callTool, cleanup, stderrTail: () => stderrBuf.slice(-800) };
}

(async function run() {
  process.stdout.write('Phase 276-03 Task 1: orchestration/scout honesty pin (F-1)\n');

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-03-room-'));
  const session = spawnMcpSession(roomDir);

  let tools = [];
  let harnessOk = true;
  try {
    await session.init();
    tools = await session.listTools();
  } catch (e) {
    harnessOk = false;
    check('server answered the initialize/tools-list handshake (harness reached ground truth)', false,
      String(e && e.message || e) + ' stderr: ' + session.stderrTail());
  }

  if (harnessOk) {
    check('server answered the initialize/tools-list handshake (harness reached ground truth)', true);
  }

  const orchestrationTool = tools.find((t) => t.name === 'orchestration');
  check('the `orchestration` tool registration was actually found', !!orchestrationTool,
    'registered tools: ' + tools.map((t) => t.name).join(', '));

  if (!harnessOk || !orchestrationTool) {
    session.cleanup();
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed (aborted: harness did not reach real registrations)\n');
    process.exit(1);
    return;
  }

  const description = typeof orchestrationTool.description === 'string' ? orchestrationTool.description : '';

  // ---------------------------------------------------------------------------
  // Group A: the description, measured over the wire.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP A: DESCRIPTION_OVER_WIRE --\n');
  check('A1: description does NOT contain the false write assertion "ordinary reads and writes"',
    description.indexOf('ordinary reads and writes') === -1,
    'got: ' + JSON.stringify(description));
  check('A2: description names the executing surface explicitly (`/mos:scout`)',
    description.indexOf('/mos:scout') !== -1,
    'got: ' + JSON.stringify(description));
  check('A3: description clears the ' + MIN_DESCRIPTION_CHARS + '-char instruction floor (test-234)',
    description.length >= MIN_DESCRIPTION_CHARS,
    'length=' + description.length);
  check('A3: description stays under the ' + HOST_DESCRIPTION_CAP_BYTES + '-byte host cap (test-234)',
    Buffer.byteLength(description, 'utf8') <= HOST_DESCRIPTION_CAP_BYTES,
    'bytes=' + Buffer.byteLength(description, 'utf8'));

  // ---------------------------------------------------------------------------
  // Group B: the in-band disclosure. Invoke orchestration({command: 'scout'})
  // against the scratch room through the same live server.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP B: IN_BAND_DISCLOSURE --\n');
  let scoutText = '';
  try {
    scoutText = await session.callTool('orchestration', { command: 'scout' });
  } catch (e) {
    check('B0: orchestration({command: "scout"}) call succeeded', false, String(e && e.message || e));
  }

  const hasNoWriteMarker = scoutText.indexOf(NO_WRITE_MARKER) !== -1;
  const hasNotExecuted = scoutText.indexOf(NOT_EXECUTED_TEXT) !== -1;
  check('B1: response discloses reference-only status via exactly one shipped primitive (' +
    NO_WRITE_MARKER + ' or "' + NOT_EXECUTED_TEXT + '")',
    hasNoWriteMarker || hasNotExecuted,
    'response head: ' + JSON.stringify(scoutText.slice(0, 300)));

  // No third marker: scan for marker-shaped bold-banner literals and assert
  // every one found is one of the two shipped primitives.
  const MARKER_CANDIDATE_RE = /\*\*filed:\s*(?:true|false)\*\*|>\s*\*\*[A-Z][A-Z ]*\.\*\*/g;
  const candidates = scoutText.match(MARKER_CANDIDATE_RE) || [];
  const unknownMarkers = candidates.filter((c) => c.indexOf(NO_WRITE_MARKER) === -1 && c.indexOf(NOT_EXECUTED_TEXT) === -1);
  check('B2: found disclosure literals are a subset of the two shipped ones (no third marker minted)',
    unknownMarkers.length === 0,
    'all candidates: ' + JSON.stringify(candidates) + ', unknown: ' + JSON.stringify(unknownMarkers));

  // ---------------------------------------------------------------------------
  // Group C: the false completion assertion.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP C: FALSE_COMPLETION_FORBIDDEN --\n');
  check('C1: response does NOT contain the false completion claim "Scout intelligence gathered"',
    scoutText.indexOf('Scout intelligence gathered') === -1,
    'response head: ' + JSON.stringify(scoutText.slice(0, 300)));
  const rationaleMatch = /\*\*Rationale:\*\*\s*(.+)/.exec(scoutText);
  const rationale = rationaleMatch ? rationaleMatch[1] : '(no Suggested Next rationale found)';
  check('C2: Suggested Next rationale matches the honest template ("Instructions returned")',
    rationale.indexOf('Instructions returned') !== -1,
    'actual rationale: ' + JSON.stringify(rationale));

  // ---------------------------------------------------------------------------
  // Group D: the membership-rule correction (source-text pin, not a wire
  // read -- this is about a comment's own claim, which the wire cannot see).
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP D: MEMBERSHIP_RULE_CORRECTED --\n');
  const routerSrc = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
  const staleReasoningRe = /scout\*[\s\S]{0,300}?capability gap, not a false claim about a state change/;
  check('D1: the stale membership reasoning ("scout* ... capability gap, not a false claim") is gone; ' +
    'the honest test is "does the description claim it", not "does it mutate state and lack a branch"',
    !staleReasoningRe.test(routerSrc),
    'stale reasoning still present: ' + staleReasoningRe.test(routerSrc));

  // ---------------------------------------------------------------------------
  // Group E: regression guard. The `meeting` honesty fix (this phase's own
  // load-bearing NEGATION_REGRESSION fixture) must never re-break.
  // ---------------------------------------------------------------------------
  process.stdout.write('\n-- GROUP E: MEETING_REGRESSION_GUARD --\n');
  const meetingTestPath = path.join(REPO_ROOT, 'tests', 'test-kwl-meeting-mcp-honesty.cjs');
  const meetingResult = cp.spawnSync('node', [meetingTestPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  check('E1: tests/test-kwl-meeting-mcp-honesty.cjs still exits 0 (the meeting fix is not regressed)',
    meetingResult.status === 0,
    'exit=' + meetingResult.status + ' stdout tail: ' + String(meetingResult.stdout || '').slice(-400));

  session.cleanup();
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (groups: A_DESCRIPTION_OVER_WIRE, B_IN_BAND_DISCLOSURE, C_FALSE_COMPLETION_FORBIDDEN,' +
    ' D_MEMBERSHIP_RULE_CORRECTED, E_MEETING_REGRESSION_GUARD)\n'
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
