#!/usr/bin/env node
'use strict';

/*
 * Phase 266-02 -- pin room_state's assembled description shape against the
 * exact splice defect that shipped.
 *
 * WHAT THIS DEFENDS. `lib/mcp/tool-router.cjs:648` used to build room_state's
 * description as `Check room health, state, and get framework
 * recommendations. ${compact.slice(0, 80)}`, where `compact` is the first 500
 * characters of `references/personality/voice-dna.md`. That file opens with a
 * markdown H1, so the description a host actually received carried a raw `#`
 * heading, an embedded `\n\n`, an unterminated `*` emphasis, and a sentence
 * severed mid-phrase at "asks on".
 *
 * METHOD. A source grep cannot substitute for the wire here: the description
 * is assembled at RUNTIME from a file read, so only a real `tools/list`
 * response shows what a host actually receives. This harness clones
 * `listToolsOverStdio` from `tests/test-234-tool-description-floor.cjs`
 * (hermetic mkdtemp HOME, MINDRIAN_BRAIN_KEY deleted, SIGKILL-and-rmSync
 * cleanup, harness-honesty guard that FAILS on a wedged server or an empty
 * tool list rather than reporting a vacuous pass).
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach, zero writes outside the
 * scratch dir.
 *
 * Run: node tests/test-266-room-state-description.cjs
 * Exit: 0 when every check passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TIMEOUT_MS = 30000;

// D-03's instruction floor.
const MIN_DESCRIPTION_CHARS = 120;

// The five commands room_state dispatches (lib/mcp/tool-router.cjs
// ROOM_STATE_COMMANDS). Naming all five is what makes the description an
// instruction rather than a label.
const ROOM_STATE_COMMANDS = ['status', 'analyze', 'compute-state', 'get-state', 'suggest-next'];

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
    if (detail) process.stdout.write('    ' + detail + '\n');
  }
}

// ---------------------------------------------------------------------------
// Drive a real initialize -> notifications/initialized -> tools/list sequence
// over stdio and return the raw tools array. Cloned in shape from
// tests/test-234-tool-description-floor.cjs (the donor harness).
// ---------------------------------------------------------------------------
function listToolsOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-266-desc-'));
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
        if (!obj) continue;
        if (obj.id === 1) {
          // initialize answered. Complete the handshake, then ask for tools.
          proc.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          }) + '\n');
          proc.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }) + '\n');
          continue;
        }
        if (obj.id === 2) {
          if (obj.error) {
            finish({ ok: false, reason: 'tools_list_error', message: JSON.stringify(obj.error) });
          } else {
            finish({ ok: true, tools: (obj.result && obj.result.tools) || [] });
          }
        }
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
        clientInfo: { name: 'test-266-room-state-description', version: '1.0.0' },
      },
    }) + '\n');
  });
}

(async function run() {
  process.stdout.write('Phase 266-02: room_state description wire probe (splice defect pin)\n');

  const outcome = await listToolsOverStdio();

  check(
    'server answered tools/list (harness reached ground truth)' +
      (outcome.ok ? '' : ' [' + outcome.reason + ' ' + (outcome.stderr || outcome.message || '') + ']'),
    outcome.ok === true
  );

  if (!outcome.ok) {
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(1);
    return;
  }

  const tools = outcome.tools;

  check(
    'tools/list returned a non-trivial catalog (got ' + tools.length + ')',
    Array.isArray(tools) && tools.length > 0,
    'An empty catalog must never read as "all checks pass".'
  );

  const roomState = tools.find((t) => t.name === 'room_state');

  // Check 1: room_state is present at all. A rename or a drop must fail, not skip.
  check(
    'room_state is present in the tools/list catalog',
    Boolean(roomState),
    'room_state not found. Registered tools: ' + tools.map((t) => t.name).join(', ')
  );

  if (!roomState) {
    process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(1);
    return;
  }

  const d = typeof roomState.description === 'string' ? roomState.description : '';

  // Check 2: no stray markdown H1 (the `#` from voice-dna.md).
  check(
    'description contains no # character (the stray markdown H1 from voice-dna.md)',
    d.indexOf('#') === -1,
    'actual wire value: ' + JSON.stringify(d)
  );

  // Check 3: no embedded newline (literal or escaped), the `\n\n` the slice carried in.
  check(
    'description contains no newline character (the embedded \\n\\n the slice carried in)',
    d.indexOf('\n') === -1 && d.indexOf('\\n') === -1,
    'actual wire value: ' + JSON.stringify(d)
  );

  // Check 4: neither voice-dna.md fingerprint is present.
  check(
    'description does not contain "Voice DNA" (voice-dna.md splice fingerprint)',
    d.indexOf('Voice DNA') === -1,
    'actual wire value: ' + JSON.stringify(d)
  );
  check(
    'description does not contain "professor" (voice-dna.md splice fingerprint)',
    d.indexOf('professor') === -1,
    'actual wire value: ' + JSON.stringify(d)
  );

  // Check 5: D-03 instruction floor, asserted directly so this test stands alone.
  check(
    'description length is at least ' + MIN_DESCRIPTION_CHARS + ' chars (D-03 instruction floor, got ' + d.length + ')',
    d.length >= MIN_DESCRIPTION_CHARS
  );

  // Check 6: starts with a capital, ends with sentence punctuation.
  check(
    'description starts with a capital letter',
    /^[A-Z]/.test(d),
    'got head: ' + JSON.stringify(d.slice(0, 60))
  );
  check(
    'description ends with sentence punctuation',
    /[.!?][)\]"']*$/.test(d),
    'got tail: ' + JSON.stringify(d.slice(-60))
  );

  // Check 7: all five dispatched commands are named.
  const missingCommands = ROOM_STATE_COMMANDS.filter((cmd) => d.indexOf(cmd) === -1);
  check(
    'description names all five commands room_state dispatches: ' + ROOM_STATE_COMMANDS.join(', '),
    missingCommands.length === 0,
    missingCommands.length ? 'missing: ' + missingCommands.join(', ') : ''
  );

  // Check 8: no em-dash, per the CLAUDE.md hard rule. Escaped code points
  // (\u2014 em-dash, \u2013 en-dash), not literal bytes, so this test file
  // itself carries no em-dash byte.
  check(
    'description carries no em-dash (CLAUDE.md hard rule)',
    d.indexOf('\u2014') === -1 && d.indexOf('\u2013') === -1
  );

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
