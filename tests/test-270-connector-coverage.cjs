#!/usr/bin/env node
'use strict';

/*
 * Phase 270-02 Task 3 -- RED pin for OQ-5, the Part 11 R1 born-wired gap.
 *
 * RESEARCH.md 2.1 / OQ-5. `detect_dual_path` and `extract_shallow` are
 * registered inline at bin/mindrian-mcp-server.cjs:187 and :199 with no
 * `connectors` export. scripts/build-connector-registry.cjs discovers only
 * lib/mcp/tools/*.cjs plus tool-router.cjs plus contract-version.cjs, so
 * those two appear in no registry and carry no hitl_shape. Part 11 R1
 * born-wired gap. RED until plan 270-06.
 *
 * This is a NEW file rather than an edit to
 * tests/test-234-tool-description-floor.cjs (which 270-VALIDATION.md's
 * MEMOP-09 row named): test-234 is a donor-phase gate named by filename
 * inside tests/run-all-266.sh. Leaving it RED across waves 1 to 3 would
 * break a COMPLETED phase's suite. Same assertion, different file.
 *
 * GROUND-TRUTH NOTE (deviation from the plan's own prose, recorded here so a
 * later reader does not re-derive it): data/mcp-tool-connectors.json entries
 * carry `surface: "mcp:" + tool`, not a bare `tool` field -- confirmed by
 * reading scripts/build-connector-registry.cjs's normalizeMcpToolEntry().
 * `declared` below is keyed by tool name derived from that surface field,
 * not by a literal `c.tool` (which would be undefined for every JSON entry
 * and silently break this test's own correctness).
 *
 * SCOPE NOTE (also a deviation, flagged for the navigator, not silently
 * corrected): the wire today carries MORE undeclared tools than the two
 * OQ-5 named. `analysis`, `eureka_critic`, `export`, `intelligence`,
 * `meeting`, `methodology`, `orchestration`, `room_content`, `room_graph`,
 * `room_state`, `room-dashboard`, `room-graph`, and `room-wiki` are all
 * registered inside lib/mcp/tool-router.cjs's registerRouterTools() (or, for
 * the three hyphenated room-* view tools, elsewhere) with no accompanying
 * `connectors` entry either -- the SAME structural gap as detect_dual_path/
 * extract_shallow, just not named by RESEARCH.md's OQ-5. One documented
 * precedent exists (tool-router.cjs's own comment on eureka_critic: "its
 * governance dial is 'none', so it mints no connector descriptor ...
 * registration on this one governed MCP path via registerRouterTools IS the
 * Canon Part 11 wiring") but that rationale is written for eureka_critic
 * specifically, not asserted here as a blanket exemption for the rest of
 * that family -- generalizing it without navigator confirmation would be
 * this test overreaching its own scope. This test therefore asserts ground
 * truth (whatever the wire and the two connector sources actually say
 * today) rather than a hand-narrowed exclusion list, so a green run can
 * never be misread as covering more than plan 270-06 actually fixes. See
 * this plan's SUMMARY.md for the full finding.
 *
 * Canon Part 8: spawns a LOCAL process under a hermetic mkdtemp HOME with
 * MINDRIAN_BRAIN_KEY unset. Zero network reach.
 *
 * No em-dashes. CJS only. No new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const TIMEOUT_MS = 30000;
const MIN_EXPECTED_TOOLS = 20;

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
// listToolsOverStdio() -- ported in shape from tests/test-234-tool-
// description-floor.cjs: a real initialize -> notifications/initialized ->
// tools/list JSON-RPC sequence under a hermetic mkdtemp HOME. A wedged
// server, an empty tool list, or a suspiciously small one all FAIL loudly
// rather than reporting a vacuous pass.
// ---------------------------------------------------------------------------
function listToolsOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-270-cc-'));
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
        clientInfo: { name: 'test-270-connector-coverage', version: '1.0.0' },
      },
    }) + '\n');
  });
}

(async function run() {
  process.stdout.write('Phase 270-02 (OQ-5): every wire MCP tool carries a connector with a hitl_shape\n');

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
    'tools/list returned a plausible tool surface (>= ' + MIN_EXPECTED_TOOLS + ' tools, got ' + tools.length + ')',
    Array.isArray(tools) && tools.length > MIN_EXPECTED_TOOLS,
    'A smaller list means the server wedged or degraded.'
  );

  // -------------------------------------------------------------------------
  // Load both connector sources. mcp-tool-connectors.json entries carry
  // surface: "mcp:" + tool (normalizeMcpToolEntry in build-connector-
  // registry.cjs), never a bare `tool` field -- see the header note above.
  // -------------------------------------------------------------------------
  const registryPath = path.join(REPO_ROOT, 'data', 'mcp-tool-connectors.json');
  const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  const routerMod = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const routerConnectors = Array.isArray(routerMod.MCP_TOOL_CONNECTORS) ? routerMod.MCP_TOOL_CONNECTORS : [];

  // Self-check: both sources must independently name room_bind, proving both
  // were really read rather than one silently returning [].
  const jsonHasRoomBind = Array.isArray(reg.connectors) && reg.connectors.some((c) => c.surface === 'mcp:room_bind');
  const routerHasRoomBind = routerConnectors.some((c) => c.tool === 'room_bind');
  check(
    'self-check: both mcp-tool-connectors.json and tool-router.cjs MCP_TOOL_CONNECTORS declare room_bind',
    jsonHasRoomBind && routerHasRoomBind,
    'json=' + jsonHasRoomBind + ' router=' + routerHasRoomBind
  );

  const declared = new Map();
  for (const c of (Array.isArray(reg.connectors) ? reg.connectors : [])) {
    const name = typeof c.surface === 'string' ? c.surface.replace(/^mcp:/, '') : null;
    if (name) declared.set(name, c);
  }
  for (const c of routerConnectors) {
    if (typeof c.tool === 'string' && !declared.has(c.tool)) declared.set(c.tool, c);
  }

  // -------------------------------------------------------------------------
  // Forward direction: every tool on the wire must carry a connector.
  // RED today -- see the SCOPE NOTE in the header for why this list is
  // larger than the two OQ-5 named.
  // -------------------------------------------------------------------------
  const wireNames = new Set(tools.map((t) => t.name));
  const missing = tools.map((t) => t.name).filter((n) => !declared.has(n)).sort();
  check(
    'every tool on the wire has a connector descriptor',
    missing.length === 0,
    missing.length ? 'missing: ' + missing.join(', ') : ''
  );

  // -------------------------------------------------------------------------
  // Every DECLARED connector that is also on the wire must carry a non-empty
  // hitl_shape and hitl_why (OQ-3 disposition below).
  //
  // OQ-3: whether MCP-tool hitl_shape is R16-mandated is UNRESOLVED
  // (docs/HITL-SHAPE-DECLARATION-CONTRACT.md names four surface classes and
  // MCP tools are not among them). This leg asserts the convention holds
  // today; it does not claim the convention is constitutional.
  // -------------------------------------------------------------------------
  const badShape = [];
  for (const name of wireNames) {
    const c = declared.get(name);
    if (!c) continue; // already reported by the missing-connector check above
    const shapeOk = typeof c.hitl_shape === 'string' && c.hitl_shape.length > 0;
    const whyOk = typeof c.hitl_why === 'string' && c.hitl_why.length > 0;
    if (!shapeOk || !whyOk) badShape.push(name);
  }
  check(
    'every connector descriptor carries a non-empty hitl_shape and hitl_why',
    badShape.length === 0,
    badShape.length ? 'offenders: ' + badShape.join(', ') : ''
  );

  // -------------------------------------------------------------------------
  // Reverse direction: no declared connector may name a tool that dropped
  // off the wire (e.g. a retirement, plan 270-12, that forgot to regenerate
  // the registry). Exclusions are discovered empirically, never silently
  // filtered; today this set is empty (verified by reading both connector
  // sources against a live tools/list -- every declared name below IS on
  // the wire), and if that ever changes this array is where the exception
  // and its reason belong.
  // -------------------------------------------------------------------------
  const KNOWN_DECLARED_BUT_NOT_ON_WIRE = [];
  const orphaned = Array.from(declared.keys())
    .filter((name) => !wireNames.has(name) && KNOWN_DECLARED_BUT_NOT_ON_WIRE.indexOf(name) === -1)
    .sort();
  check(
    'no connector descriptor names a tool that is not on the wire',
    orphaned.length === 0,
    orphaned.length ? 'orphaned: ' + orphaned.join(', ') : ''
  );

  process.stdout.write(
    '\n  checked ' + wireNames.size + '/' + wireNames.size + ' wire tools against ' + declared.size + ' declared connectors\n'
  );
  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
