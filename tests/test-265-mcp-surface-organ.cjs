#!/usr/bin/env node
'use strict';

/*
 * tests/test-265-mcp-surface-organ.cjs -- Phase 265 Plan 23 Task 2.
 *
 * Four arms for lib/core/doctor/mcp-surface-module.cjs:
 *   1. CONTRACT      -- check(ctx) returns the same keys, key-for-key, as
 *                        lib/core/doctor/capability-ledger-module.cjs's
 *                        check(ctx), so the two doctor organs cannot drift
 *                        apart in shape.
 *   2. HAPPY PATH     -- against the REAL servers, the result is 'ok' and
 *                        its message names both per-server counts.
 *   3. ZERO-TOOL       -- checkAgainstServers() is pointed at an inline stub
 *                        server (written under os.tmpdir()) that answers
 *                        initialize and returns an empty tools array;
 *                        asserts the result is a FAILURE naming zero tools.
 *   4. WEDGED SERVER  -- checkAgainstServers() is pointed at an inline stub
 *                        that answers nothing; asserts a failure with a
 *                        timeout reason, not a hang or an 'ok'.
 *
 * Arms 3 and 4 call checkAgainstServers() directly -- the SAME organ logic
 * production check() uses (zero-tool detection, wedged-server detection,
 * ok/warn/error mapping), not a reimplementation of it -- so this proves
 * the organ does the one thing it exists for, per the plan's own
 * instruction.
 *
 * Prints tool counts on every run so the surface size is visible in
 * harness output. Cleans up temp files in a finally.
 *
 * Run: node tests/test-265-mcp-surface-organ.cjs
 * Exit: 0 when every arm passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mcpSurfaceMod = require('../lib/core/doctor/mcp-surface-module.cjs');
const capabilityLedgerMod = require('../lib/core/doctor/capability-ledger-module.cjs');

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
// Inline stub server scripts, written under os.tmpdir() and cleaned up in a
// finally at the end of run(). Both speak the same JSON-RPC-over-stdio
// dialect the real servers do, over process.stdin/process.stdout.
// ---------------------------------------------------------------------------

const ZERO_TOOL_STUB_SOURCE = `
'use strict';
// Zero-tool stub: answers initialize, then answers tools/list with an
// EMPTY tools array -- the exact 2.1.128 signal (a server that connects
// but returns zero tools) this organ exists to catch.
process.stdin.setEncoding('utf8');
let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (e) { continue; }
    if (!obj) continue;
    if (obj.id === 1) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'zero-tool-stub', version: '0.0.0' } } }) + '\\n');
    } else if (obj.id === 2) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [] } }) + '\\n');
      process.exit(0);
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;

const WEDGED_STUB_SOURCE = `
'use strict';
// Wedged stub: reads stdin and never answers anything. Simulates a hung
// server that connected but never responds to initialize or tools/list.
process.stdin.resume();
setInterval(() => {}, 60000); // keep the event loop alive past the test timeout
`;

function writeStub(dir, filename, source) {
  const p = path.join(dir, filename);
  fs.writeFileSync(p, source, 'utf8');
  return p;
}

(async function run() {
  process.stdout.write('Phase 265 Plan 23 Task 2: MCP surface doctor organ (tool count + zero-tool/wedged failure)\n');

  let stubDir = null;
  try {
    stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-265-mcp-surface-test-'));

    // -------------------------------------------------------------------
    // ARM 1: CONTRACT -- key-for-key match against capability-ledger-module.
    // -------------------------------------------------------------------
    const ledgerResult = capabilityLedgerMod.check({});
    const surfaceResultForContract = mcpSurfaceMod.check({});
    const ledgerKeys = Object.keys(ledgerResult).sort();
    const surfaceKeys = Object.keys(surfaceResultForContract).sort();
    check(
      'check(ctx) return keys match lib/core/doctor/capability-ledger-module.cjs key-for-key ' +
        '(ledger: ' + JSON.stringify(ledgerKeys) + ', surface: ' + JSON.stringify(surfaceKeys) + ')',
      JSON.stringify(ledgerKeys) === JSON.stringify(surfaceKeys)
    );
    check(
      "both organs' status field is one of 'ok'/'warn'/'error'",
      ['ok', 'warn', 'error'].includes(ledgerResult.status) &&
        ['ok', 'warn', 'error'].includes(surfaceResultForContract.status)
    );

    // -------------------------------------------------------------------
    // ARM 2: HAPPY PATH -- against the real servers.
    // -------------------------------------------------------------------
    const realResult = mcpSurfaceMod.check({});
    process.stdout.write('  [happy path] ' + realResult.status + ': ' + realResult.detail + '\n');
    check(
      'against the real servers, result.status is ok or warn (never error on a healthy install)',
      realResult.status === 'ok' || realResult.status === 'warn',
      'got status=' + realResult.status + ' detail=' + realResult.detail
    );
    check(
      "result.detail names both per-server counts ('mindrian-os=' and 'mindrian-brain=')",
      typeof realResult.detail === 'string' &&
        /mindrian-os=\d+ tools/.test(realResult.detail) &&
        /mindrian-brain=\d+ tools/.test(realResult.detail),
      'got: ' + realResult.detail
    );

    const osCountMatch = /mindrian-os=(\d+) tools/.exec(realResult.detail);
    const brainCountMatch = /mindrian-brain=(\d+) tools/.exec(realResult.detail);
    if (osCountMatch && brainCountMatch) {
      process.stdout.write(
        '  [tool counts] mindrian-os=' + osCountMatch[1] + ', mindrian-brain=' + brainCountMatch[1] +
        ', combined=' + (Number(osCountMatch[1]) + Number(brainCountMatch[1])) + '\n'
      );
    }
    check('mindrian-os reports a non-zero tool count', osCountMatch && Number(osCountMatch[1]) > 0,
      'detail: ' + realResult.detail);
    check('mindrian-brain reports a non-zero tool count', brainCountMatch && Number(brainCountMatch[1]) > 0,
      'detail: ' + realResult.detail);

    // -------------------------------------------------------------------
    // ARM 3: ZERO-TOOL FAILURE -- both server slots pointed at the
    // zero-tool stub, proving the organ's own zero-tool detection (not a
    // reimplementation of it) fires a FAILURE naming zero tools.
    // -------------------------------------------------------------------
    const zeroToolStubPath = writeStub(stubDir, 'zero-tool-stub.cjs', ZERO_TOOL_STUB_SOURCE);
    const zeroToolResult = mcpSurfaceMod.checkAgainstServers(zeroToolStubPath, zeroToolStubPath, { timeoutMs: 8000 });
    process.stdout.write('  [zero-tool arm] ' + zeroToolResult.status + ': ' + zeroToolResult.detail + '\n');
    check(
      'a server that connects but returns zero tools is a FAILURE (status error)',
      zeroToolResult.status === 'error',
      'got: ' + JSON.stringify(zeroToolResult)
    );
    check(
      "the failure detail names 'zero tools'",
      typeof zeroToolResult.detail === 'string' && /zero tools/i.test(zeroToolResult.detail),
      'got: ' + zeroToolResult.detail
    );

    // -------------------------------------------------------------------
    // ARM 4: WEDGED SERVER -- both server slots pointed at a stub that
    // never answers. Must fail with a timeout reason, never hang the test
    // process and never report ok.
    // -------------------------------------------------------------------
    const wedgedStubPath = writeStub(stubDir, 'wedged-stub.cjs', WEDGED_STUB_SOURCE);
    const wedgedStart = Date.now();
    const wedgedResult = mcpSurfaceMod.checkAgainstServers(wedgedStubPath, wedgedStubPath, { timeoutMs: 2000 });
    const wedgedElapsedMs = Date.now() - wedgedStart;
    process.stdout.write(
      '  [wedged arm] ' + wedgedResult.status + ': ' + wedgedResult.detail + ' (elapsed ' + wedgedElapsedMs + 'ms)\n'
    );
    check(
      'a server that never answers is a FAILURE (status error), never ok',
      wedgedResult.status === 'error',
      'got: ' + JSON.stringify(wedgedResult)
    );
    check(
      "the failure detail names a timeout reason ('timeout')",
      typeof wedgedResult.detail === 'string' && /timeout/i.test(wedgedResult.detail),
      'got: ' + wedgedResult.detail
    );
    check(
      'the wedged arm did not hang past a bounded multiple of its own per-server timeout (2000ms x2 servers + slack)',
      wedgedElapsedMs < 10000,
      'elapsed ' + wedgedElapsedMs + 'ms'
    );

    // -------------------------------------------------------------------
    // Never-throws contract: a nonexistent server script must not throw.
    // -------------------------------------------------------------------
    let threw = false;
    let nonexistentResult = null;
    try {
      nonexistentResult = mcpSurfaceMod.checkAgainstServers(
        path.join(stubDir, 'does-not-exist.cjs'),
        path.join(stubDir, 'does-not-exist.cjs'),
        { timeoutMs: 3000 }
      );
    } catch (e) {
      threw = true;
    }
    check('checkAgainstServers never throws, even against a nonexistent server path', threw === false);
    check(
      'a nonexistent server path resolves to a FAILURE result, not an ok',
      nonexistentResult && nonexistentResult.status === 'error',
      'got: ' + JSON.stringify(nonexistentResult)
    );

    // -------------------------------------------------------------------
    // TOTAL_SURFACE_TOKEN_BUDGET and estimateSurfaceTokens sanity.
    // -------------------------------------------------------------------
    check(
      'TOTAL_SURFACE_TOKEN_BUDGET is a positive number (no tool-count cap exported)',
      typeof mcpSurfaceMod.TOTAL_SURFACE_TOKEN_BUDGET === 'number' && mcpSurfaceMod.TOTAL_SURFACE_TOKEN_BUDGET > 0
    );
    check(
      'estimateSurfaceTokens([]) is 0',
      mcpSurfaceMod.estimateSurfaceTokens([]) === 0
    );
    check(
      'estimateSurfaceTokens grows with a larger description',
      mcpSurfaceMod.estimateSurfaceTokens([{ name: 'x', description: 'short' }]) <
        mcpSurfaceMod.estimateSurfaceTokens([{ name: 'x', description: 'a much longer description string here' }])
    );
  } finally {
    if (stubDir) {
      try { fs.rmSync(stubDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
