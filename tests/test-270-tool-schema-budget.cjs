#!/usr/bin/env node
'use strict';

/*
 * Phase 270-06 Task 3 -- MEMOP-10, the tool-schema token BEFORE number.
 *
 * Phase 270 must not claim a token win it did not measure (Pitfall P2: one
 * unified schema over N operations may exceed N small schemas). RESEARCH.md
 * 2.3 established that alwaysLoad is server-level, not per-tool (three grep
 * hits, all in .mcp.json, zero per-tool), so reducing the number and size of
 * registered descriptions is the ONLY token lever this repo has -- that
 * makes measurement the only way to know the phase's net effect. Assumption
 * A5 recorded that the ~7,062-token / 36-tool figure (tool-router.cjs:2-19's
 * own header claim) was QUOTED from the Phase 265 audit, never re-measured.
 * This file measures it for real: 36 tools, ~7,167 approx tokens (measured
 * 2026-08-27, plan 270-06, this file's own BASELINE constant below) -- close
 * to the quoted figure, not identical, confirming it genuinely was an
 * estimate rather than ground truth.
 *
 * Ported from tests/test-234-tool-description-floor.cjs (listToolsOverStdio,
 * hermetic mkdtemp HOME, real initialize -> notifications/initialized ->
 * tools/list JSON-RPC, loud failure on a wedged server or a suspiciously
 * small list). No second spawn harness.
 *
 * No em-dashes. CJS only. No new dependency; no tokenizer vendored --
 * RESEARCH.md's Don't Hand-Roll table forbids it. approxTokens is a
 * characters-divided-by-4 PROXY (Assumption A1), not a guarantee; compare it
 * only against another number produced by this same measure() function.
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
const DRIFT_TOLERANCE_PCT = 10;

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

// listToolsOverStdio() -- ported in shape from test-234-tool-description-floor.cjs.
function listToolsOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-270-budget-'));
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
          continue;
        }
        if (!obj) continue;
        if (obj.id === 1) {
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
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
    proc.on('error', (err) => finish({ ok: false, reason: 'spawn_error', message: err.message }));
    proc.on('exit', (code) => finish({ ok: false, reason: 'exited_before_response', code, stderr: stderrBuf.slice(-800) }));

    proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-270-tool-schema-budget', version: '1.0.0' },
      },
    }) + '\n');
  });
}

/**
 * measure(tools) -- per-tool and aggregate byte/token measurements. Exported
 * so plan 270-12 can re-measure with IDENTICAL arithmetic and compute a
 * genuine delta rather than re-quoting this plan's numbers.
 */
function measure(tools) {
  const perTool = [];
  let totalDescBytes = 0;
  let totalSchemaBytes = 0;
  let routerCount = 0;
  let atomicCount = 0;

  for (const t of tools) {
    const descBytes = Buffer.byteLength(t.description || '', 'utf8');
    const schemaBytes = Buffer.byteLength(JSON.stringify(t.inputSchema || {}), 'utf8');
    const totalBytes = descBytes + schemaBytes;
    perTool.push({ name: t.name, descBytes, schemaBytes, totalBytes });
    totalDescBytes += descBytes;
    totalSchemaBytes += schemaBytes;

    // Router-vs-atomic partition, DERIVED FROM THE LIVE SCHEMA, not a
    // hardcoded name list: a grouped multi-command dispatcher (the 9 tools
    // lib/mcp/tool-router.cjs registers, fanning out to the 64 CLI commands
    // in ALL_TOOL_COMMANDS) carries an inputSchema.properties.command enum;
    // an atomic tool does not. Verified empirically against a live probe
    // (analysis/room_state -> enum present; graph_query/room_bind/
    // detect_dual_path -> absent) before writing this rule.
    const props = t.inputSchema && t.inputSchema.properties;
    const hasCommandEnum = !!(props && props.command && Array.isArray(props.command.enum));
    if (hasCommandEnum) routerCount += 1; else atomicCount += 1;
  }

  const totalBytes = totalDescBytes + totalSchemaBytes;
  return {
    perTool,
    toolCount: tools.length,
    totalDescBytes,
    totalSchemaBytes,
    totalBytes,
    // Assumption A1: characters/4 is a defensible token PROXY, not a
    // guarantee. RESEARCH.md's Don't Hand-Roll table forbids vendoring a
    // tokenizer for this estimate. Compare only against another number this
    // same function produced.
    approxTokens: Math.round(totalBytes / 4),
    routerCount,
    atomicCount,
  };
}

// The measurement taken BY THIS PLAN, real numbers, no placeholders. A
// future plan (270-12) requires this file and compares its own fresh
// measure() output against this frozen record to compute a genuine delta.
const BASELINE = {
  measuredAt: '2026-08-27',
  plan: '270-06',
  toolCount: 36,
  totalDescBytes: 12724,
  totalSchemaBytes: 15945,
  totalBytes: 28669,
  approxTokens: 7167,
};

module.exports = { BASELINE, measure };

// Guard against the plan 270-12 re-measurement use case: `require()`-ing
// this file for BASELINE/measure must never spawn a server or call
// process.exit (that would kill the REQUIRING process before it could use
// either export). Only self-run the spawn-and-check cycle when this file
// is executed directly (`node tests/test-270-tool-schema-budget.cjs`).
if (require.main === module) {
  console.log('Phase 270-06 (MEMOP-10): tool-schema token baseline, measured not assumed');
  run();
}

async function run() {
  const outcome = await listToolsOverStdio();

  check(
    'harness reached real data' + (outcome.ok ? '' : ' [' + outcome.reason + ' ' + (outcome.stderr || outcome.message || '') + ']'),
    outcome.ok === true && Array.isArray(outcome.tools) && outcome.tools.length > MIN_EXPECTED_TOOLS
      && outcome.tools.every((t) => typeof t.description === 'string' && t.description.length > 0),
    outcome.ok ? 'tool count: ' + (outcome.tools ? outcome.tools.length : 0) : ''
  );

  if (!outcome.ok) {
    process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(1);
    return;
  }

  const m = measure(outcome.tools);

  check(
    'the measured surface matches the recorded BASELINE toolCount',
    m.toolCount === BASELINE.toolCount,
    'measured=' + m.toolCount + ' baseline=' + BASELINE.toolCount +
      ' -- if this legitimately changed, plan 270-12 is where the baseline is updated, not this file'
  );

  const deltaPct = BASELINE.totalBytes === 0 ? 0 : Math.abs(m.totalBytes - BASELINE.totalBytes) / BASELINE.totalBytes * 100;
  check(
    'the measured totalBytes is within ' + DRIFT_TOLERANCE_PCT + ' percent of the recorded BASELINE',
    deltaPct <= DRIFT_TOLERANCE_PCT,
    'measured=' + m.totalBytes + ' baseline=' + BASELINE.totalBytes + ' delta=' + deltaPct.toFixed(2) + '%'
  );

  check(
    'router tools and atomic tools are accounted separately',
    m.routerCount > 0 && m.atomicCount > 0,
    'router=' + m.routerCount + ' atomic=' + m.atomicCount
  );

  console.log(
    '\nbudget: ' + m.toolCount + ' tools, ' + m.totalDescBytes + ' desc bytes, ' +
    m.totalSchemaBytes + ' schema bytes, ' + m.totalBytes + ' total, ~' + m.approxTokens +
    ' approx tokens (router ' + m.routerCount + ' / atomic ' + m.atomicCount + ')'
  );
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

module.exports = { BASELINE, measure };
