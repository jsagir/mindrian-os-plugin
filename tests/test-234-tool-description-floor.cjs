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
 * COVERAGE (Phase 266-04, D-3/D-4). A prior version of this file applied the
 * universal 120-char floor to all registered tools, but the extra prose-shape
 * checks (capital start, sentence terminator, ceiling, no em-dash) ran only
 * against a hand-maintained list of 8 tool names. 36 tools were registered; the
 * other 28, including `room_state` with a mid-word cut, were never prose
 * checked. A reader saw "35 passed, 0 failed" and reasonably concluded the
 * whole tool surface was verified -- a false-coverage signal, measured on
 * 2026-08-27 (drift D-3). This file now applies every prose check to every
 * tool in the live `tools/list` response (`checkedNames`, derived from the
 * wire, never from a literal), and the summary line states its own coverage
 * (`checkedNames.size + '/' + tools.length`) so a green run can never again be
 * misread as covering more than it does. `REWRITTEN_TOOLS` is demoted to a
 * PRESENCE pin (Task 1, item 3): it still asserts the 8 original rewrite
 * targets remain registered, but it must never again gate WHICH tools receive
 * a prose check.
 *
 * A live wire probe on 2026-08-27, applying all four prose checks to all 36
 * tools, found exactly 4 failures (D-3/D-4): `room_state` (fixed by plan
 * 266-02's rewrite of the voice-dna splice), `room_state_bound` (a benign
 * false positive: it correctly ends `... multi-command tool.)`, and the old
 * `/\.$/` terminator was too literal to see the period before the closing
 * paren -- fixed here by relaxing the terminator, not editing the prose), and
 * `chain_run` / `gate_answer` (both now exceed the old 600-char ceiling,
 * because that ceiling's own stated exemplar, "`chain_run` 552" per this
 * file's own header above, has since doubled to 1113 -- drift D-4). The
 * ceiling below is now the real platform cap (2048 bytes, Claude Code
 * 2.1.84), not a rotted exemplar-derived guess.
 *
 * OUT OF SCOPE (named, not silently dropped): the total-surface token budget
 * assertion is NOT added here (265-RESEARCH-mcp-layer-audit.md R-3c). The
 * "under 7000 token budget" claim at lib/mcp/tool-router.cjs:5 is already
 * measured at ~7,062 tokens, so adding that assertion here would land a red
 * leg for a drift this phase did not scope to fix. See
 * .planning/phases/265-capability-radar-absorption-routing-re-scoped-supersedes-orp/265-RESEARCH-mcp-layer-audit.md
 * (R-3c, D-2).
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

// D-03's instruction floor.
const MIN_DESCRIPTION_CHARS = 120;

// Phase 266-04 (D-4): the old MAX_DESCRIPTION_CHARS = 600 ceiling was derived
// from an exemplar this file's own header once named as "`chain_run` 552".
// `chain_run` measures 1113 characters today (the exemplar has doubled), so
// the ceiling's premise had rotted. The real ceiling that actually exists is
// the HOST's per-tool description cap: Claude Code 2.1.84 caps a served MCP
// tool description at 2048 bytes. Measured in BYTES (Buffer.byteLength), not
// JS string .length, because the host's cap is a byte cap and this repo's
// descriptions are ASCII-safe today but must not silently pass a multi-byte
// description that is short in .length but long in bytes.
const HOST_DESCRIPTION_CAP_BYTES = 2048;

// Phase 266-04 (D-3): `room_state_bound` legitimately ends
// "... multi-command tool.)" -- terminated by a period, then closed by a
// parenthesis. The old /\.$/ terminator read that as an unterminated
// sentence, which is a false positive in the CHECK, not a defect in the
// prose. This relaxed terminator tolerates a trailing closing bracket or
// quote character after the actual sentence-ending punctuation. Relaxing the
// regex is the honest fix; editing a correct description to satisfy a wrong
// assertion would not be.
const SENTENCE_TERMINATOR = /[.!?][)\]"'’”]*$/;

// A tools/list that returns almost nothing must not read as "all descriptions
// pass". The default registration is ~33 tools; 20 is a deliberately loose
// floor that still catches a server that half-booted.
const MIN_EXPECTED_TOOLS = 20;

// The 8 RESEARCH.md Section F named this plan rewrites. Phase 266-04 demotes
// this list to a PRESENCE PIN ONLY: it asserts each of these 8 names is still
// registered (a rename or drop of an original rewrite target still fails
// loudly), but it must NEVER again gate WHICH tools receive the prose-shape
// checks below. Every registered tool gets every check now; see
// `checkedNames` and the universal loop.
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
  // Phase 266-04 (D-3): the presence pin. The 8 original rewrite targets must
  // still be registered by name, but this list no longer decides WHICH tools
  // get the prose-shape checks below -- every tool does, via the universal
  // loop that follows.
  // -------------------------------------------------------------------------
  const byName = new Map(tools.map((t) => [t.name, t]));
  for (const name of REWRITTEN_TOOLS) {
    check('rewritten tool `' + name + '` is registered (presence pin, not a coverage gate)',
      byName.has(name),
      byName.has(name) ? '' : 'Tool not present in tools/list. The rewrite targets must not be renamed or dropped.');
  }

  // -------------------------------------------------------------------------
  // Phase 266-04 (D-3): universal prose-shape coverage. Every registered tool
  // gets all four checks: starts with a capital, ends with a real sentence
  // terminator (tolerating a trailing bracket/quote), is at or under the real
  // platform byte cap, and carries no em-dash. `checkedNames` is the coverage
  // ledger, derived from the wire tools/list response, never from a literal --
  // a tool registered next month is covered automatically because it is IN
  // `tools`, with no row anyone has to remember to add.
  // -------------------------------------------------------------------------
  const checkedNames = new Set();
  for (const t of tools) {
    const name = t.name;
    const d = typeof t.description === 'string' ? t.description : '';
    checkedNames.add(name);

    check('`' + name + '` description starts with a capital letter',
      /^[A-Z]/.test(d), 'got: ' + JSON.stringify(d.slice(0, 60)));
    check('`' + name + '` description ends with a sentence terminator',
      SENTENCE_TERMINATOR.test(d.trim()), 'got tail: ' + JSON.stringify(d.slice(-60)));
    check('`' + name + '` description is <= ' + HOST_DESCRIPTION_CAP_BYTES + ' bytes (got ' + Buffer.byteLength(d, 'utf8') + ')',
      Buffer.byteLength(d, 'utf8') <= HOST_DESCRIPTION_CAP_BYTES);
    check('`' + name + '` description carries no em-dash (CLAUDE.md hard rule)',
      d.indexOf('\u2014') === -1 && d.indexOf('\u2013') === -1);
  }

  // -------------------------------------------------------------------------
  // Phase 266-04 (T-266-15/T-266-16): the structural guard. If a future edit
  // reintroduces a name allow-list around the loop above, `checkedNames`
  // shrinks below `tools.length` and this check fires. Coverage cannot
  // silently regress back into the shape this plan exists to fix.
  // -------------------------------------------------------------------------
  const uncovered = tools.filter((t) => !checkedNames.has(t.name)).map((t) => t.name);
  check(
    'every registered tool received the full prose-shape check set (coverage: ' +
      checkedNames.size + '/' + tools.length + ')',
    uncovered.length === 0,
    uncovered.length ? 'uncovered: ' + uncovered.join(', ') : ''
  );

  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (prose-shape coverage: ' + checkedNames.size + '/' + tools.length + ' registered tools)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
