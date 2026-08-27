#!/usr/bin/env node
'use strict';

/*
 * Phase 234-01 (D-03), DOCTRINE EVOLVED 2026-08-19 -- pin the IDENTITY of
 * `instructions` on the MCP initialize result.
 *
 * HISTORY. This test originally locked the ABSENCE of `instructions`: the field
 * is prepended to the system prompt by every receiving host, making it the
 * single highest-leverage place to leak methodology (the WHEN/WHICH/SEQUENCE
 * knowledge that is the moat). The 2026-08-18/19 sync session then shipped the
 * hookless-surface runtime protocol THROUGH this exact field on purpose
 * (lib/mcp/runtime-instructions.cjs served at initialize), so Desktop and
 * Cowork run the same Larry loop Claude Code gets from hooks. See
 * docs/2026-08-19-HANDOFF-brain-plugin-sync-release.md section 1a and
 * docs/AGENTIC-SURFACING-PATTERN.md v2.0 (hookless-surface parity).
 *
 * THE INVARIANT NOW. Absence is replaced by something STRONGER: the served
 * string must be byte-identical to the vetted RUNTIME_INSTRUCTIONS constant,
 * and that constant must carry ZERO moat content (behavior contract and tool
 * handles only -- never graph data). Nothing else can ever ride this channel:
 * any drift, injection, or SDK default fails the identity check loudly.
 *
 * DOCTRINE EVOLVED AGAIN 2026-08-27 (Phase 266-01, MCPFIX-01) -- the
 * invariant now has a THIRD leg: a HOST-boundary byte-cap. Claude Code has
 * capped MCP server `instructions` at 2048 bytes since 2.1.84; the host
 * silently truncates past that cap. RUNTIME_INSTRUCTIONS measured 2173
 * bytes when this leg was added, which the host cuts to 2048, dropping the
 * final 125 bytes of the Canon Part 8 BOUNDARIES paragraph mid-word. The
 * pre-existing identity check (scenario 3 below) is a SERVER-boundary
 * property: it asserts the served string equals the vetted constant, and
 * stays green even while the HOST truncates that same string on the wire to
 * a real client. Only a byte-length assertion against the host's own cap can
 * see this failure mode; a string-equality check cannot.
 *
 * METHOD. Ground truth, not a grep. The server is spawned for real
 * (`node bin/mindrian-mcp-server.cjs`), driven over stdio with a genuine
 * JSON-RPC `initialize` request, and the actual wire response is inspected.
 * The wire cannot lie about what a host would receive.
 *
 * Scenarios:
 *   1. The server answers initialize at all (the harness itself is honest --
 *      a wedged server must FAIL, never silently pass).
 *   2. result HAS an own `instructions` property (the runtime protocol rides
 *      the connection -- hookless-surface parity is live).
 *   3. The served string is BYTE-IDENTICAL to RUNTIME_INSTRUCTIONS.
 *   4. Moat negative-pin: the served string carries no graph vocabulary
 *      (FEEDS_INTO / ADDRESSES_PROBLEM_TYPE / pagerank canaries) -- the
 *      original D-03 defense, preserved as a content check.
 *   5. Served byte length is at or under SERVED_BUDGET_BYTES (this repo's
 *      own budget, with headroom under the host cap).
 *   6. Served byte length is at or under HOST_INSTRUCTIONS_CAP_BYTES (the
 *      hard platform ceiling itself). Kept as a SEPARATE check from 5 on
 *      purpose: the budget and the hard ceiling each need their own legible
 *      failure reason when they fire.
 *   7. The Canon Part 8 BOUNDARIES paragraph (PART8_BOUNDARIES_FROZEN, a
 *      duplicated literal, never derived from RUNTIME_INSTRUCTIONS) survives
 *      byte-identically inside the served string AND is its tail -- nothing
 *      gets appended after it that could push it back into truncation range.
 *
 * NOTE ON LOCATION AND NAME. This file keeps the lib/mcp/no-instructions.test
 * .cjs path because 234-VALIDATION.md and tests/run-all-234.sh name it there
 * (the run-all glob does NOT pick it up; the runner carries an explicit leg).
 * The name records the test's origin; the header above records the pivot.
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic HOME with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach.
 *
 * Run: node lib/mcp/no-instructions.test.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TIMEOUT_MS = 15000;

// Claude Code has capped MCP server `instructions` at 2048 bytes since
// 2.1.84. The cap is enforced by the HOST, not this server, so a
// server-boundary identity check (scenario 3 above) cannot see a host that
// silently truncates the served string on the wire.
const HOST_INSTRUCTIONS_CAP_BYTES = 2048;

// This repo's own budget: 98 bytes of headroom under HOST_INSTRUCTIONS_CAP_BYTES
// so a small future edit cannot silently cross the hard platform ceiling.
const SERVED_BUDGET_BYTES = 1950;

// Frozen copy of the ENTIRE Canon Part 8 BOUNDARIES paragraph, copied
// byte-for-byte out of runtime-instructions.cjs. This MUST stay a duplicated
// literal, never derived from RUNTIME_INSTRUCTIONS: a value derived from the
// constant it is meant to protect shrinks together with that constant,
// which is the exact failure mode (a lossy trim eating the boundary
// statement) this plan exists to close. The measured overflow when this
// constant was written was 2173 bytes against the 2048-byte host cap.
const PART8_BOUNDARIES_FROZEN = 'BOUNDARIES (Canon Part 8, absolute): room content NEVER enters brain_* calls - only generic methodology handles (framework names, problem types). Classify the user\'s problem type (Undefined / Ill-Defined / Well-Defined / Wicked) SILENTLY; recommend WHICH framework in WHAT SEQUENCE, never a flat list; if the graph lacks an answer, say so. Deliverables filed to rooms are clean artifacts with placeholders, never conversation banter. Heavy pipeline work belongs in Claude Code - say so when asked for it here.';

let passed = 0;
let failed = 0;

function check(label, cond) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    process.stdout.write('    ' + (e.message || String(e)) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Drive a real initialize handshake over stdio and return the raw response.
// ---------------------------------------------------------------------------
function initializeOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-234-noinstr-'));
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_TRANSPORT: 'stdio',
      MINDRIAN_ROOM: path.join(tmpHome, 'room'),
    });
    delete env.MINDRIAN_BRAIN_KEY;

    const proc = cp.spawn('node', [SERVER], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    let stdoutBuf = '';
    let stderrBuf = '';
    let settled = false;

    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      resolve(payload);
    }

    const timer = setTimeout(() => {
      finish({ ok: false, reason: 'timeout', stderr: stderrBuf.slice(-800) });
    }, TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_e) {
          continue; // non-JSON stdout noise
        }
        if (obj && obj.id === 1) finish({ ok: true, response: obj });
      }
    });

    proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

    proc.on('error', (err) => {
      finish({ ok: false, reason: 'spawn_error', message: err.message });
    });

    proc.on('exit', (code) => {
      finish({ ok: false, reason: 'exited_before_response', code, stderr: stderrBuf.slice(-800) });
    });

    proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-234-no-instructions', version: '1.0.0' },
      },
    }) + '\n');
  });
}

const { RUNTIME_INSTRUCTIONS } = require('./runtime-instructions.cjs');

(async function run() {
  process.stdout.write('Phase 234-01 (D-03, evolved 2026-08-19): MCP initialize `instructions` identity pin\n');

  const outcome = await initializeOverStdio();

  // Scenario 1: the harness must be honest. A wedged or crashed server FAILS
  // rather than reporting a vacuous "no instructions found".
  check(
    'server answered the initialize request (harness reached ground truth)' +
      (outcome.ok ? '' : ' [' + outcome.reason + ' ' + (outcome.stderr || outcome.message || '') + ']'),
    outcome.ok === true
  );

  if (!outcome.ok) {
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(1);
    return;
  }

  const result = outcome.response && outcome.response.result;
  check('initialize returned a result object', result && typeof result === 'object');

  // Scenario 2: the runtime protocol rides the connection.
  check(
    'initialize result HAS an own `instructions` property (hookless-surface parity)',
    Object.prototype.hasOwnProperty.call(result || {}, 'instructions') === true
  );

  // Scenario 3: the invariant itself -- nothing but the vetted constant may
  // ever ride this channel. Byte identity, not substring.
  check(
    'initialize `instructions` is byte-identical to RUNTIME_INSTRUCTIONS',
    (result || {}).instructions === RUNTIME_INSTRUCTIONS
  );

  // Scenario 4: the original D-03 defense as a content pin -- the served
  // string carries behavior contract and tool handles, never graph data.
  const served = String((result || {}).instructions || '');
  const moatCanaries = ['FEEDS_INTO', 'ADDRESSES_PROBLEM_TYPE', 'pagerank'];
  check(
    'served instructions carry no moat vocabulary (' + moatCanaries.join(', ') + ')',
    moatCanaries.every(function (c) { return served.indexOf(c) === -1; })
  );

  // Scenario 5 (Phase 266-01, MCPFIX-01): served byte length is at or under
  // this repo's own budget, with headroom under the host's hard cap.
  const servedBytes = Buffer.byteLength(served, 'utf8');
  check(
    'served instructions at or under SERVED_BUDGET_BYTES (measured ' + servedBytes + ' vs budget ' + SERVED_BUDGET_BYTES + ')',
    servedBytes <= SERVED_BUDGET_BYTES
  );

  // Scenario 6 (Phase 266-01, MCPFIX-01): served byte length is at or under
  // the HOST's own hard cap. Kept separate from scenario 5 on purpose so the
  // budget and the platform ceiling each report their own legible reason.
  check(
    'served instructions at or under HOST_INSTRUCTIONS_CAP_BYTES (measured ' + servedBytes + ' vs cap ' + HOST_INSTRUCTIONS_CAP_BYTES + ')',
    servedBytes <= HOST_INSTRUCTIONS_CAP_BYTES
  );

  // Scenario 7 (Phase 266-01, MCPFIX-01): the Canon Part 8 BOUNDARIES
  // paragraph survives byte-identically and is the tail of the served
  // string, so nothing appended after it could ever push it back into the
  // truncation zone.
  check(
    'served instructions carry PART8_BOUNDARIES_FROZEN byte-identically',
    served.indexOf(PART8_BOUNDARIES_FROZEN) !== -1
  );
  check(
    'served instructions END with PART8_BOUNDARIES_FROZEN (nothing appended after it)',
    served.endsWith(PART8_BOUNDARIES_FROZEN)
  );

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
