#!/usr/bin/env node
'use strict';

/*
 * Phase 234-02 (D-03) -- every MCP tool description is an INSTRUCTION, not a
 * label.
 *
 * WHAT THIS DEFENDS. D-03 settled that persona ships as a SKILL and never
 * through MCP `InitializeResult.instructions`. That leaves tool descriptions as
 * the ONLY per-tool guidance channel a Tier-0 foreign host is guaranteed to
 * honor: a model on VS Code, Cursor, Zed or Goose has no Larry system prompt to
 * lean on, so the description string IS the whole brief for when and why to
 * reach for a tool. A bare label ("Meeting filing, intelligence pipeline, and
 * speaker identification.") names the tool without teaching its use, which on a
 * foreign host reads as a menu item rather than a capability.
 *
 * THE FLOOR. 120 characters. That is not a magic number: it is the measured
 * boundary between the in-repo tools that read as labels (the 8 the RESEARCH.md
 * Section F table listed at 66-91 chars) and the ones that read as instructions
 * (`chain_run` 552, `stop_gate_check` 460, `framework_run` 424). A description
 * cannot state what a tool does AND when to prefer it over its neighbour in
 * under two lines of prose.
 *
 * METHOD. Ground truth over the wire, not a grep. The server is spawned for
 * real (`node bin/mindrian-mcp-server.cjs`), driven through a genuine JSON-RPC
 * initialize -> notifications/initialized -> tools/list sequence, and the actual
 * `description` strings a host would receive are measured. A source grep would
 * miss a description assembled at runtime (`room_state` builds its own from
 * `${compact.slice(0, 80)}`) and would misread template literals; the wire
 * cannot lie about what a host actually sees.
 *
 * HARNESS HONESTY. A wedged server, an empty tool list, or a suspiciously small
 * one all FAIL loudly rather than reporting a vacuous "no short descriptions
 * found". That false-success shape is the exact failure this phase exists to
 * close, so the harness proves it reached real data before it grades it.
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach, zero writes outside the scratch
 * dir.
 *
 * Run: node tests/test-234-tool-description-floor.cjs
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

// D-03's instruction floor and a sanity ceiling matching the exemplar range
// (`chain_run` is the longest in-repo description at 552).
const MIN_DESCRIPTION_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 600;

// A tools/list that returns almost nothing must not read as "all descriptions
// pass". The default registration is ~33 tools; 20 is a deliberately loose
// floor that still catches a server that half-booted.
const MIN_EXPECTED_TOOLS = 20;

// The 8 RESEARCH.md Section F named this plan rewrites. They get the extra
// prose-shape assertions on top of the universal length floor.
const REWRITTEN_TOOLS = [
  'meeting',
  'room_graph',
  'room_list',
  'analysis',
  'room_content',
  'room_search',
  'export',
  'orchestration',
];

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
// over stdio and return the raw tools array.
// ---------------------------------------------------------------------------
function listToolsOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-234-desc-'));
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
        clientInfo: { name: 'test-234-tool-description-floor', version: '1.0.0' },
      },
    }) + '\n');
  });
}

(async function run() {
  process.stdout.write('Phase 234-02 (D-03): every MCP tool description clears the instruction floor\n');

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
    'tools/list returned a non-trivial catalog (>= ' + MIN_EXPECTED_TOOLS + ' tools, got ' + tools.length + ')',
    Array.isArray(tools) && tools.length >= MIN_EXPECTED_TOOLS,
    'A near-empty catalog must never read as "all descriptions pass".'
  );

  // -------------------------------------------------------------------------
  // The floor itself: EVERY registered tool, not just the 8 rewritten ones.
  // -------------------------------------------------------------------------
  const short = [];
  for (const t of tools) {
    const d = typeof t.description === 'string' ? t.description : '';
    if (d.length < MIN_DESCRIPTION_CHARS) short.push(t.name + ' (' + d.length + ')');
  }
  check(
    'every tool description is >= ' + MIN_DESCRIPTION_CHARS + ' chars (D-03 instruction floor)',
    short.length === 0,
    short.length ? 'below the floor: ' + short.join(', ') : ''
  );

  // -------------------------------------------------------------------------
  // Prose-shape sanity on the 8 this plan rewrote. Each must still be present,
  // start with a capital, end with a period, and stay inside the exemplar range.
  // -------------------------------------------------------------------------
  const byName = new Map(tools.map((t) => [t.name, t]));
  for (const name of REWRITTEN_TOOLS) {
    const t = byName.get(name);
    if (!t) {
      check('rewritten tool `' + name + '` is registered', false,
        'Tool not present in tools/list. The rewrite targets must not be renamed or dropped.');
      continue;
    }
    const d = typeof t.description === 'string' ? t.description : '';
    check('`' + name + '` description starts with a capital letter',
      /^[A-Z]/.test(d), 'got: ' + JSON.stringify(d.slice(0, 60)));
    check('`' + name + '` description ends with a period',
      /\.$/.test(d.trim()), 'got tail: ' + JSON.stringify(d.slice(-60)));
    check('`' + name + '` description is <= ' + MAX_DESCRIPTION_CHARS + ' chars (got ' + d.length + ')',
      d.length <= MAX_DESCRIPTION_CHARS);
    check('`' + name + '` description carries no em-dash (CLAUDE.md hard rule)',
      d.indexOf('—') === -1 && d.indexOf('–') === -1);
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
