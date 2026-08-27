#!/usr/bin/env node
'use strict';

/*
 * Phase 265-09 (RADAR-14) -- wire-level description HYGIENE tripwire, both
 * MCP servers.
 *
 * WHAT THIS TEST DOES NOT COVER (read this before ever deleting either test
 * as a duplicate of the other):
 *
 *   `tests/test-234-tool-description-floor.cjs` (Phase 234-02 / MCPFIX-04) owns
 *   description SHAPE: the D-03 120-character instruction floor, the
 *   2048-byte platform ceiling, starts-with-capital-letter, and
 *   ends-with-a-sentence-terminator. Phase 266's MCPFIX-04 expanded that file
 *   from an 8-tool hand-maintained allow-list to every tool derived from the
 *   live `tools/list` response.
 *
 *   THIS file owns description HYGIENE: a different defect class that no
 *   shape check catches. A description can be well-shaped prose (right
 *   length, capital start, period end) and STILL leak a raw markdown
 *   heading, an embedded newline, a retired backend name, or a mid-word cut
 *   introduced by a byte-offset splice. Shape checks the ENVELOPE; hygiene
 *   checks the CONTENTS. Neither test subsumes the other. This file
 *   implements RADAR-14; MCPFIX-02 (the `room_state` voice-dna splice fix)
 *   and MCPFIX-04 (the shape-check expansion) are the two Phase 266
 *   requirements this file is complementary to, not a duplicate of.
 *
 * SCOPE: walks EVERY tool from BOTH shipped MCP servers
 *   (`bin/mindrian-mcp-server.cjs`, the 36+-tool hierarchical router, and
 *   `bin/mindrian-brain-mcp-client.cjs`, the 6-tool Brain stdio proxy), not a
 *   named subset. There is no hand-maintained tool-name allow-list in this
 *   file: adding a tool to either server gets checked automatically because
 *   it is IN the live `tools/list` response.
 *
 * THE FOUR HYGIENE CHECKS, per tool, on both servers:
 *
 *   1. NO MARKDOWN LEAK. No `#` at the start of any line, no embedded `\n`,
 *      no odd number of `*` characters (an unbalanced markdown emphasis
 *      marker), and no `Voice DNA` substring. `Voice DNA` is a deliberate
 *      CANARY: it is the exact fingerprint of the `room_state` splice this
 *      repo shipped before Phase 266 plan 266-02 (commit 6f42861f) deleted
 *      it. This arm is what proves that removal holds after 266 ships, and
 *      keeps holding on every future run.
 *   2. NO RETIRED BACKEND. No case-insensitive `RETIRED_BACKENDS` substring
 *      (pinecone, neo4j, aura) inside the DESCRIPTION string. A tool NAME
 *      containing one of these (for example a hypothetical
 *      `read_neo4j_cypher`) is explicitly exempt, because this check exists
 *      to catch a description that misinforms the model about the live
 *      backend, not to forbid a literal API name a tool happens to wrap.
 *      CLAUDE.md's Technology Stack table: "Cutover from Neo4j Aura landed
 *      2026-07-22" and "Pinecone is RETIRED" -- the live backend is Memgraph
 *      plus locally-embedded multilingual-e5-large vectors.
 *   3. NO MID-WORD CUT. The description ends with `.`, `?` or `!`. This is
 *      the check that would have caught the pre-266-02 `room_state` tail
 *      "...asks on".
 *   4. NO EM-DASH. No U+2014 anywhere in the description (CLAUDE.md hard
 *      rule, hyphens only).
 *
 * METHOD. Ground truth over the wire on BOTH servers, reusing the
 * `listToolsOverStdio()` SHAPE from `tests/test-234-tool-description-floor.cjs`
 * (hermetic mkdtemp HOME, `MINDRIAN_BRAIN_KEY` removed from env, a real
 * initialize -> notifications/initialized -> tools/list JSON-RPC sequence).
 * That file is an executable script, not a module, so this file copies the
 * shape rather than requiring it, and does not edit that file (Phase 266's
 * MCPFIX-04 owns it).
 *
 * Canon Part 8: spawns two LOCAL processes under hermetic mkdtemp HOMEs with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach, zero writes outside the
 * scratch dirs.
 *
 * Run: node tests/test-265-mcp-description-hygiene.cjs
 * Exit: 0 when every check passes on both servers, non-zero otherwise.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = 30000;

// Servers under test. Both are stdio-capable and both ship every session
// (`.mcp.json`, `alwaysLoad: true` on each per 265-RESEARCH-mcp-layer-audit.md
// section 1a).
const SERVERS = [
  { label: 'mindrian-os', entry: path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs') },
  { label: 'mindrian-brain', entry: path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs') },
];

// Retired backends this plugin no longer serves methodology from. One-line
// extension point for a future retirement. Source: CLAUDE.md Technology
// Stack table ("Cutover from Neo4j Aura landed 2026-07-22"; "Pinecone is
// RETIRED"). Checked against the DESCRIPTION string only, never the tool
// NAME, so a tool that legitimately wraps a named API (e.g. a hypothetical
// `read_neo4j_cypher`) is not falsely flagged.
const RETIRED_BACKENDS = ['pinecone', 'neo4j', 'aura'];

// The exact fingerprint of the pre-266-02 `room_state` voice-dna splice.
// Kept alive here on purpose, so the canary still means something after the
// source line it once quoted is gone.
const VOICE_DNA_CANARY = 'Voice DNA';

// Tolerates a trailing closing bracket/quote after the real sentence-ending
// punctuation (mirrors tests/test-234-tool-description-floor.cjs's
// SENTENCE_TERMINATOR relaxation): `room_state_bound` legitimately ends
// "... multi-command tool.)" and that is not a mid-word cut.
const SENTENCE_TERMINATOR = /[.!?][)\]"'’”]*$/;

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
// over stdio against ONE server entry point. Shape copied from
// tests/test-234-tool-description-floor.cjs's listToolsOverStdio(); that file
// is an executable script (not a module), so this is a deliberate copy, not
// an import.
// ---------------------------------------------------------------------------
function listToolsOverStdio(serverEntry, label) {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-265-hygiene-'));
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_TRANSPORT: 'stdio',
      MINDRIAN_ROOM: path.join(tmpHome, 'room'),
    });
    delete env.MINDRIAN_BRAIN_KEY;

    const proc = cp.spawn('node', [serverEntry], {
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
      finish({ ok: false, label, reason: 'timeout', stderr: stderrBuf.slice(-800) });
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
            finish({ ok: false, label, reason: 'tools_list_error', message: JSON.stringify(obj.error) });
          } else {
            finish({ ok: true, label, tools: (obj.result && obj.result.tools) || [] });
          }
        }
      }
    });

    proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

    proc.on('error', (err) => {
      finish({ ok: false, label, reason: 'spawn_error', message: err.message });
    });

    proc.on('exit', (code) => {
      finish({ ok: false, label, reason: 'exited_before_response', code, stderr: stderrBuf.slice(-800) });
    });

    proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-265-mcp-description-hygiene', version: '1.0.0' },
      },
    }) + '\n');
  });
}

function countAsterisks(s) {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) if (s[i] === '*') n += 1;
  return n;
}

function hasMarkdownHeadingLine(s) {
  return s.split('\n').some((line) => line.trimStart().startsWith('#'));
}

(async function run() {
  process.stdout.write('Phase 265-09 (RADAR-14): MCP tool description hygiene, both servers\n');

  for (const server of SERVERS) {
    const outcome = await listToolsOverStdio(server.entry, server.label);

    check(
      server.label + ': server answered tools/list (harness reached ground truth)' +
        (outcome.ok ? '' : ' [' + outcome.reason + ' ' + (outcome.stderr || outcome.message || '') + ']'),
      outcome.ok === true
    );

    if (!outcome.ok) continue;

    const tools = outcome.tools;
    process.stdout.write('  ' + server.label + ': ' + tools.length + ' tool(s) over the wire\n');

    check(
      server.label + ': tools/list returned a non-trivial catalog (>= 1 tool, got ' + tools.length + ')',
      Array.isArray(tools) && tools.length >= 1
    );

    for (const t of tools) {
      const name = t.name;
      const d = typeof t.description === 'string' ? t.description : '';
      const where = server.label + '/' + name;

      // 1. NO MARKDOWN LEAK.
      const hasHeading = hasMarkdownHeadingLine(d);
      const hasNewline = d.indexOf('\n') !== -1;
      const oddAsterisks = countAsterisks(d) % 2 !== 0;
      const hasVoiceDna = d.indexOf(VOICE_DNA_CANARY) !== -1;
      check(
        where + ': no markdown leak (heading/newline/unbalanced-emphasis/Voice-DNA-canary)',
        !hasHeading && !hasNewline && !oddAsterisks && !hasVoiceDna,
        'heading=' + hasHeading + ' newline=' + hasNewline + ' oddAsterisks=' + oddAsterisks +
          ' voiceDnaCanary=' + hasVoiceDna + ' desc=' + JSON.stringify(d)
      );

      // 2. NO RETIRED BACKEND. Description only, never the tool name.
      const dLower = d.toLowerCase();
      const hitBackends = RETIRED_BACKENDS.filter((b) => dLower.indexOf(b) !== -1);
      check(
        where + ': no retired-backend name in description (' + RETIRED_BACKENDS.join(', ') + ')',
        hitBackends.length === 0,
        hitBackends.length ? 'found: ' + hitBackends.join(', ') + ' in ' + JSON.stringify(d) : ''
      );

      // 3. NO MID-WORD CUT.
      check(
        where + ': description ends with a sentence terminator (no mid-word cut)',
        SENTENCE_TERMINATOR.test(d.trim()),
        'got tail: ' + JSON.stringify(d.slice(-60))
      );

      // 4. NO EM-DASH. Unicode escape used deliberately so this file's own
      // source never contains the literal glyph it is checking for.
      check(
        where + ': description carries no em-dash (CLAUDE.md hard rule)',
        d.indexOf('\u2014') === -1
      );
    }
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
