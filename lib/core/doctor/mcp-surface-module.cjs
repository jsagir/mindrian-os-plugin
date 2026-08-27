'use strict';
/*
 * lib/core/doctor/mcp-surface-module.cjs -- Phase 265 Plan 23 Task 2.
 *
 * A cadence:always, fix_supported:false, flag:null doctor module (mirrors
 * lib/core/doctor/capability-ledger-module.cjs's check(ctx) contract
 * key-for-key: SYNCHRONOUS function returning { status: 'ok'|'warn'|'error',
 * detail: string }). scripts/doctor.cjs's runAccumulativeEngine calls
 * checkFn(ctx) synchronously and stores the return value directly into
 * alwaysChecks[mod.id] with no await -- a Promise-returning check() would
 * silently store a pending Promise instead of a result, so this module is
 * deliberately synchronous end to end (spawnSync, not spawn+listeners).
 *
 * WHAT IT DOES: spawns both mindrian-os (bin/mindrian-mcp-server.cjs) and
 * mindrian-brain (bin/mindrian-brain-mcp-client.cjs) over stdio, under a
 * hermetic per-run HOME with MINDRIAN_BRAIN_KEY unset, pipes a real
 * initialize -> notifications/initialized -> tools/list JSON-RPC sequence
 * to each via spawnSync's `input`, and reports the live per-server tool
 * count plus the combined total. Both SDK-based servers read their piped
 * stdin, answer each request in order, and exit cleanly on stdin EOF --
 * verified empirically against both entry points during this plan's
 * authoring, so no keep-alive/kill dance is needed.
 *
 * WHY THIS EXISTS (265-RESEARCH-mcp-layer-audit.md R-7, closing finding
 * 2.6 OPEN and D-5). Claude Code 2.1.128 added "/mcp now shows the tool
 * count for connected servers and flags servers that connected with 0
 * tools" -- a server that connects but returns zero tools looks perfectly
 * healthy to every OTHER doctor check (the process started, the handshake
 * completed), so without this organ that failure mode is invisible.
 * scripts/doctor.cjs already has an L4 MCP stdio handshake and version-match
 * check (~:1298-1359) for the REMOTE Brain; this organ is the LOCAL,
 * tools/list-level counterpart neither server had.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it carries NO tool-count cap.
 * mcp-server-brain/CLAUDE.md's "Release-time check" caps that server at
 * ~10-15 tools, but that figure was set for a 6-tool server and does not
 * transfer -- the corpus provides no recommended per-server count (gap
 * 3.3-2 in the research). Capping mindrian-os's measured 36-tool surface
 * against a number derived for a 6-tool server would fail the doctor
 * spuriously (T-265-115 in this plan's threat register) for no correctness
 * reason. The honest bound is the measured TOTAL_SURFACE_TOKEN_BUDGET
 * warning below, not a borrowed count ceiling.
 *
 * FAILURE SEMANTICS (never a silent 'ok'):
 *   - status 'error' when either server connects and tools/list returns
 *     ZERO tools -- exactly the 2.1.128 signal this organ exists to catch.
 *   - status 'error' when a server does not answer within its timeout, or
 *     exits/crashes before answering -- a wedged or crashed server must
 *     never report 'ok'.
 *   - status 'error' when a spawn itself throws -- never propagated as an
 *     uncaught exception; check() never throws (soft-fail contract, same
 *     as capability-ledger-module.cjs).
 *   - status 'warn' when the combined description-plus-schema token
 *     estimate exceeds TOTAL_SURFACE_TOKEN_BUDGET (measurement, not a
 *     hard fail -- the honest next step per R-8's alwaysLoad ledger row is
 *     visibility, not an automatic block).
 *   - status 'ok' otherwise, naming both per-server counts and the total.
 *
 * TOTAL_SURFACE_TOKEN_BUDGET. As of this plan (2026-08-27), Phase 266's
 * MCPFIX-04 has NOT defined this constant anywhere in the repo (grep for
 * TOTAL_SURFACE_TOKEN_BUDGET across the tree returns zero hits outside this
 * file). Defined here as 8000: the measured mindrian-os surface is
 * ~7,062 tokens and the (now-corrected) shipped claim was 7,000, so 8,000
 * gives room for two or three more tools before the number forces a
 * conversation. If Phase 266 later defines this same constant in
 * tests/test-234-tool-description-floor.cjs, that file should become the
 * source of truth and this module updated to import from it rather than
 * carry a second literal -- recorded in this plan's SUMMARY as a follow-on
 * for Phase 266 to converge on.
 *
 * Canon Part 8 (Graph Boundary): both spawns run under a hermetic mkdtemp
 * HOME with MINDRIAN_BRAIN_KEY deleted from the child's env. Zero network
 * reach either server needs to answer tools/list.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const MINDRIAN_OS_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const MINDRIAN_BRAIN_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');

const DEFAULT_TIMEOUT_MS = 15000;

// See header comment: not yet defined elsewhere in the repo as of this
// plan. 8000 = measured mindrian-os surface (~7,062 tokens) + headroom for
// 2-3 more tools before the number forces a conversation.
const TOTAL_SURFACE_TOKEN_BUDGET = 8000;

// Rough token estimate: ~4 bytes/token is the standard cheap heuristic used
// elsewhere in this repo's own budget commentary (lib/mcp/tool-router.cjs's
// "~7,062 tokens" figure was derived the same way). This organ does not
// need SDK-exact tokenization -- it needs a stable, cheap, directionally
// correct number that moves when the surface actually grows.
const BYTES_PER_TOKEN_ESTIMATE = 4;

function buildInitializeTransaction() {
  return (
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-surface-doctor-organ', version: '1.0.0' },
      },
    }) + '\n' +
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n' +
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n'
  );
}

/**
 * Drives initialize -> notifications/initialized -> tools/list over stdio
 * against one server script, SYNCHRONOUSLY via spawnSync. NEVER throws (a
 * spawn/parse/timeout failure becomes a { ok: false, reason, ... } return
 * value, per this organ's never-throw contract).
 *
 * @param {string} serverPath absolute path to the server entry point
 * @param {object} opts
 * @param {number} [opts.timeoutMs]
 * @param {object} [opts.envOverrides] extra env vars merged over the
 *   hermetic base (e.g. MINDRIAN_TRANSPORT / MINDRIAN_ROOM for mindrian-os)
 * @param {function} [opts.spawnSyncImpl] test seam -- defaults to
 *   child_process.spawnSync; tests inject a stub server script here indirectly
 *   by pointing serverPath at a stub .cjs file instead of overriding this.
 */
function listToolsOverStdio(serverPath, opts) {
  const o = opts || {};
  const timeoutMs = typeof o.timeoutMs === 'number' ? o.timeoutMs : DEFAULT_TIMEOUT_MS;
  const spawnSyncImpl = typeof o.spawnSyncImpl === 'function' ? o.spawnSyncImpl : cp.spawnSync;

  let tmpHome;
  try {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-mcp-surface-'));
  } catch (e) {
    return { ok: false, reason: 'hermetic_home_setup_failed', message: e.message };
  }

  const env = Object.assign({}, process.env, { HOME: tmpHome }, o.envOverrides || {});
  delete env.MINDRIAN_BRAIN_KEY;

  let result;
  try {
    result = spawnSyncImpl('node', [serverPath], {
      cwd: REPO_ROOT,
      env: env,
      input: buildInitializeTransaction(),
      timeout: timeoutMs,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e2) { /* best effort */ }
    return { ok: false, reason: 'spawn_threw', message: e.message };
  }

  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  // Node's spawnSync signals a timeout kill in TWO ways at once: it sets
  // result.error to an Error with code 'ETIMEDOUT' AND sets result.signal
  // to the kill signal (commonly 'SIGTERM'). Check both BEFORE the generic
  // result.error branch below, so a wedged/non-answering server reports
  // reason:'timeout' rather than being misclassified as reason:'spawn_error'
  // (a wedged server must never look like a different failure class -- this
  // is exactly the case tests/test-265-mcp-surface-organ.cjs's WEDGED arm
  // exists to prove).
  const timedOut =
    (result.signal !== null && result.signal !== undefined) ||
    (result.error && result.error.code === 'ETIMEDOUT');

  if (result.error && !timedOut) {
    return { ok: false, reason: 'spawn_error', message: result.error.message };
  }

  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const lines = stdout.split('\n').filter(Boolean);

  let toolsResult = null;
  let rpcError = null;
  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_e) {
      continue; // non-JSON stdout noise
    }
    if (!obj) continue;
    if (obj.id === 2) {
      if (obj.error) {
        rpcError = obj.error;
      } else {
        toolsResult = (obj.result && obj.result.tools) || [];
      }
      break;
    }
  }

  if (toolsResult !== null) {
    return { ok: true, tools: toolsResult };
  }

  if (rpcError) {
    return { ok: false, reason: 'tools_list_error', message: JSON.stringify(rpcError) };
  }

  if (timedOut) {
    return {
      ok: false,
      reason: 'timeout',
      stderr: (typeof result.stderr === 'string' ? result.stderr : '').slice(-800),
    };
  }

  return {
    ok: false,
    reason: 'exited_before_response',
    code: result.status,
    stderr: (typeof result.stderr === 'string' ? result.stderr : '').slice(-800),
  };
}

/**
 * Cheap combined-surface token estimate: sum of every tool's name +
 * description + JSON-stringified inputSchema, divided by
 * BYTES_PER_TOKEN_ESTIMATE. Directionally correct, not SDK-exact -- see
 * header comment. Never throws on a malformed tool entry.
 */
function estimateSurfaceTokens(toolsList) {
  let totalBytes = 0;
  for (const t of toolsList) {
    if (!t || typeof t !== 'object') continue;
    const name = typeof t.name === 'string' ? t.name : '';
    const description = typeof t.description === 'string' ? t.description : '';
    let schemaBytes = 0;
    try {
      schemaBytes = Buffer.byteLength(JSON.stringify(t.inputSchema || {}), 'utf8');
    } catch (_e) {
      schemaBytes = 0;
    }
    totalBytes += Buffer.byteLength(name, 'utf8') + Buffer.byteLength(description, 'utf8') + schemaBytes;
  }
  return Math.ceil(totalBytes / BYTES_PER_TOKEN_ESTIMATE);
}

/**
 * The organ's full evaluation logic (zero-tool detection, wedged-server
 * detection, ok/warn/error mapping), parameterized over the two server
 * paths so tests/test-265-mcp-surface-organ.cjs can point THIS -- the real
 * organ logic, not a reimplementation of it -- at inline stub server
 * scripts and prove the zero-tool and wedged-server arms fail exactly the
 * way production would. `check(ctx)` below is a thin wrapper that calls
 * this with the two real server paths; it is the only production caller.
 */
function checkAgainstServers(osServerPath, brainServerPath, ctx) {
  const c = ctx || {};
  const timeoutMs = typeof c.timeoutMs === 'number' ? c.timeoutMs : DEFAULT_TIMEOUT_MS;

  let osOutcome;
  try {
    osOutcome = listToolsOverStdio(osServerPath, {
      timeoutMs: timeoutMs,
      envOverrides: {
        MINDRIAN_TRANSPORT: 'stdio',
        MINDRIAN_ROOM: path.join(os.tmpdir(), 'mindrian-mcp-surface-room-scratch'),
      },
    });
  } catch (e) {
    // Never throws (organ contract): a failure in the harness itself
    // becomes a failure result, not a propagated exception.
    osOutcome = { ok: false, reason: 'harness_threw', message: e && e.message };
  }

  let brainOutcome;
  try {
    brainOutcome = listToolsOverStdio(brainServerPath, { timeoutMs: timeoutMs });
  } catch (e) {
    brainOutcome = { ok: false, reason: 'harness_threw', message: e && e.message };
  }

  const failures = [];

  if (!osOutcome.ok) {
    failures.push(
      'mindrian-os: ' + osOutcome.reason + (osOutcome.message ? ' (' + osOutcome.message + ')' : '') +
      (osOutcome.stderr ? ' stderr_tail=' + JSON.stringify(osOutcome.stderr) : '')
    );
  } else if (!Array.isArray(osOutcome.tools) || osOutcome.tools.length === 0) {
    failures.push('mindrian-os: connected but tools/list returned ZERO tools');
  }

  if (!brainOutcome.ok) {
    failures.push(
      'mindrian-brain: ' + brainOutcome.reason + (brainOutcome.message ? ' (' + brainOutcome.message + ')' : '') +
      (brainOutcome.stderr ? ' stderr_tail=' + JSON.stringify(brainOutcome.stderr) : '')
    );
  } else if (!Array.isArray(brainOutcome.tools) || brainOutcome.tools.length === 0) {
    failures.push('mindrian-brain: connected but tools/list returned ZERO tools');
  }

  if (failures.length > 0) {
    return {
      status: 'error',
      detail: 'mcp-surface: ' + failures.join('; '),
    };
  }

  const osCount = osOutcome.tools.length;
  const brainCount = brainOutcome.tools.length;
  const combinedTotal = osCount + brainCount;

  const combinedTokenEstimate =
    estimateSurfaceTokens(osOutcome.tools) + estimateSurfaceTokens(brainOutcome.tools);

  const baseDetail =
    'mcp-surface: mindrian-os=' + osCount + ' tools, mindrian-brain=' + brainCount +
    ' tools, combined=' + combinedTotal + ' tools, estimated combined surface ~' +
    combinedTokenEstimate + ' tokens (budget ' + TOTAL_SURFACE_TOKEN_BUDGET + ')';

  if (combinedTokenEstimate > TOTAL_SURFACE_TOKEN_BUDGET) {
    return {
      status: 'warn',
      detail:
        baseDetail +
        ' -- combined surface exceeds TOTAL_SURFACE_TOKEN_BUDGET; this is a measurement warning, ' +
        'not a tool-count cap (the Brain\'s 10-15 figure does not transfer to a 36-tool server; see ' +
        'this module\'s header comment and 265-RESEARCH-mcp-layer-audit.md R-7/R-8)',
    };
  }

  return {
    status: 'ok',
    detail: baseDetail,
  };
}

/**
 * Production entry point: the doctor registry's declared runner. Always
 * targets the two real, shipped server entry points.
 */
function check(ctx) {
  return checkAgainstServers(MINDRIAN_OS_SERVER, MINDRIAN_BRAIN_SERVER, ctx);
}

module.exports = {
  check: check,
  // Exported for tests/test-265-mcp-surface-organ.cjs so its stub-server
  // arms (zero-tool, wedged) can point the REAL organ logic -- not a
  // reimplementation of it -- at inline stub server scripts.
  checkAgainstServers: checkAgainstServers,
  listToolsOverStdio: listToolsOverStdio,
  estimateSurfaceTokens: estimateSurfaceTokens,
  TOTAL_SURFACE_TOKEN_BUDGET: TOTAL_SURFACE_TOKEN_BUDGET,
};
