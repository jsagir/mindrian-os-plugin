#!/usr/bin/env node
'use strict';

/*
 * Phase 234-01 (D-03) -- lock the absence of `instructions` on the MCP
 * initialize result.
 *
 * WHAT THIS DEFENDS. The MCP spec allows a server to return an `instructions`
 * string on InitializeResult. Every host that receives it prepends it to the
 * system prompt, unconditionally, before the user has typed anything. That makes
 * it the single highest-leverage place to leak methodology: the WHEN/WHICH/
 * SEQUENCE knowledge that is the moat would ship as plaintext to ~45 foreign
 * hosts, in a field no user ever sees and no gate currently watches.
 *
 * MindrianOS is compliant today, but ACCIDENTALLY so -- nothing in the codebase
 * asserts it, and the field is one `new McpServer(info, { instructions })`
 * argument away from existing. This test converts an accident into an invariant.
 *
 * METHOD. Ground truth, not a grep. The server is spawned for real
 * (`node bin/mindrian-mcp-server.cjs`), driven over stdio with a genuine
 * JSON-RPC `initialize` request, and the actual wire response is inspected. A
 * grep over the source would miss an `instructions` value assembled at runtime
 * or injected by the SDK; the wire cannot lie about what a host would receive.
 *
 * Scenarios:
 *   1. The server answers initialize at all (the harness itself is honest --
 *      a wedged server must FAIL, never silently pass as "no instructions").
 *   2. result has NO own `instructions` property.
 *   3. Belt and braces: even an inherited/undefined `instructions` is absent,
 *      so a future SDK default cannot slip through as `undefined`.
 *
 * NOTE ON LOCATION. This file lives at lib/mcp/no-instructions.test.cjs to match
 * 234-VALIDATION.md's own naming. That path is OUTSIDE the tests/test-234-*
 * glob that tests/run-all-234.sh discovers, so run-all-234.sh carries an
 * EXPLICIT extra leg for it. Do not assume the glob picks this up.
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

(async function run() {
  process.stdout.write('Phase 234-01 (D-03): MCP initialize carries no `instructions`\n');

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

  // Scenario 2: the invariant itself.
  check(
    'initialize result has NO own `instructions` property',
    Object.prototype.hasOwnProperty.call(result || {}, 'instructions') === false
  );

  // Scenario 3: a future SDK default must not slip through as undefined either.
  check(
    'initialize result `instructions` is not present at any level (undefined)',
    (result || {}).instructions === undefined
  );

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
