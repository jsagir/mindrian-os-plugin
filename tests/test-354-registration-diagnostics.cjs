#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-registration-diagnostics.cjs -- Phase 354-14 (SYS-04).
 *
 * SEAM (CTX-REG in 354-CONTEXT.md): lib/mcp/register-core-tools.cjs:39-75's
 * per-module try/catch loop swallows both require() failures and register()
 * throws with a bare `continue`, returns nothing, and emits no diagnostic --
 * fault injection removed graph_query, graph_write and memory_event while
 * the server kept starting silently (docs/reviews/phase-354-probes/
 * registration.cjs). The two layers that disagree: the registration loop's
 * sibling isolation (correct -- a broken module must never take down its
 * healthy siblings) versus the health surface, which today cannot see what
 * the loop silently dropped. After the fix the loop records what it
 * dropped, says so on stderr (never stdout -- the MCP stdio protocol stays
 * clean), and status_read's capability_floor.tool_registration reports it.
 *
 * Seeded from docs/reviews/phase-354-probes/registration.cjs (Module._load
 * fault for lib/mcp/tools/graph.cjs, healthy-vs-degraded McpServer
 * _registeredTools comparison). Read_first also covered lib/mcp/register-
 * core-tools.cjs (whole file), lib/mcp/tools/status.cjs:95-165 and
 * lib/mcp/tool-router.cjs:2284-2285 (the only caller).
 *
 * F1 (require fault): Module._load throws for the graph.cjs absolute path.
 * F2 (register fault): Module._load returns a stub whose register() throws.
 * H1 (health): getRegistrationHealth() mirrors F1's report; status_read's
 *     capability_floor.tool_registration names the same failure.
 * H2 (health, clean): a fault-free registerCoreTools() reports complete.
 *
 * H1's getRegistrationHealth()/status_read checks run immediately after F1,
 * before F2 executes -- register-core-tools.cjs is a require()-cached
 * singleton, so a later registerCoreTools() call (F2) overwrites the same
 * module-level _lastReport F1 just set; checking H1 before F2 is the only
 * ordering that can observe F1's own state.
 *
 * Plain-Node harness (tests/test-354-room-symlink-containment.cjs shape):
 * assert, a local ok(label)/fail(label, error) counter pair, a leading log
 * of the test name, a trailing PASS/FAIL summary line, process.exitCode = 1
 * on any failure. No framework. Hyphens only, no em-dashes.
 *
 * Run: node tests/test-354-registration-diagnostics.cjs
 * Exit: 1 against the unfixed register-core-tools.cjs (F1/F2/H1/H2 checks
 * fail -- no report is returned, no stderr diagnostic, no health surface).
 * Exit: 0 once Task 2 lands (report + stderr diagnostics + status_read
 * exposure).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

const REPO = path.resolve(__dirname, '..');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));

const REGISTER_CORE_TOOLS_PATH = path.join(REPO, 'lib', 'mcp', 'register-core-tools.cjs');
const GRAPH_TOOL_PATH = path.join(REPO, 'lib', 'mcp', 'tools', 'graph.cjs');
const GRAPH_TOOLS = ['graph_query', 'graph_write', 'memory_event'];

const { registerCoreTools } = require(REGISTER_CORE_TOOLS_PATH);

console.log('test-354-registration-diagnostics');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}
function check(label, fn) {
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}
async function checkAsync(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

(async () => {
  const fx = makeScratchRoom('registration-diagnostics');
  try {
    // -------------------------------------------------------------------
    // Baseline: a healthy registration (no fault injected).
    // -------------------------------------------------------------------
    const healthy = new McpServer({ name: 'test-354-registration-healthy', version: '1' });
    registerCoreTools(healthy, { fallbackRoomDir: fx.room });
    const healthyToolNames = Object.keys(healthy._registeredTools || {});
    check('baseline: healthy registration produced the graph tools', () => {
      assert.ok(healthyToolNames.length > 0, 'expected at least one registered tool');
      for (const t of GRAPH_TOOLS) {
        assert.ok(healthyToolNames.includes(t), t + ' must be registered on the healthy server');
      }
    });

    // -------------------------------------------------------------------
    // F1: require fault -- Module._load throws for lib/mcp/tools/graph.cjs.
    // -------------------------------------------------------------------
    let f1Result;
    let f1Stderr = '';
    let f1Stdout = '';
    let f1Degraded;
    {
      const originalLoad = Module._load;
      const originalStderrWrite = process.stderr.write;
      const originalStdoutWrite = process.stdout.write;
      delete require.cache[GRAPH_TOOL_PATH];
      Module._load = function (request, ...args) {
        if (request === GRAPH_TOOL_PATH) throw new Error('SYNTHETIC_REGISTRATION_FAILURE');
        return originalLoad.call(this, request, ...args);
      };
      process.stderr.write = function (chunk) { f1Stderr += String(chunk); return true; };
      process.stdout.write = function (chunk) { f1Stdout += String(chunk); return true; };
      try {
        f1Degraded = new McpServer({ name: 'test-354-registration-f1', version: '1' });
        f1Result = registerCoreTools(f1Degraded, { fallbackRoomDir: fx.room });
      } finally {
        Module._load = originalLoad;
        process.stderr.write = originalStderrWrite;
        process.stdout.write = originalStdoutWrite;
        delete require.cache[GRAPH_TOOL_PATH];
      }
    }

    check('F1: registerCoreTools returns a report object', () => {
      assert.ok(f1Result && typeof f1Result === 'object', 'expected a report object, got ' + JSON.stringify(f1Result));
    });
    check('F1: report.complete === false', () => {
      assert.strictEqual(f1Result && f1Result.complete, false);
    });
    check('F1: report.failed contains {module: graph.cjs, phase: require}', () => {
      const entry = f1Result && Array.isArray(f1Result.failed)
        && f1Result.failed.find((e) => e.module === 'graph.cjs' && e.phase === 'require');
      assert.ok(entry, 'expected a failed entry {module: graph.cjs, phase: require}, got ' + JSON.stringify(f1Result && f1Result.failed));
      assert.ok(String(entry.message).includes('SYNTHETIC_REGISTRATION_FAILURE'), 'entry.message must include SYNTHETIC_REGISTRATION_FAILURE, got ' + entry.message);
    });
    check('F1: report.registered lists the other module files', () => {
      const registered = (f1Result && f1Result.registered) || [];
      assert.ok(registered.includes('status.cjs'), 'expected status.cjs among registered modules, got ' + JSON.stringify(registered));
      assert.ok(!registered.includes('graph.cjs'), 'graph.cjs must not appear in registered');
    });
    check('F1: stderr names the failure (module + phase)', () => {
      assert.ok(f1Stderr.includes('tool registration failed: graph.cjs (require)'), 'stderr must include the diagnostic line, got: ' + JSON.stringify(f1Stderr));
    });
    check('F1: stdout stays empty during registration (MCP protocol-clean)', () => {
      assert.strictEqual(f1Stdout, '');
    });
    check('F1: degraded tool count is healthy minus the graph.cjs tools', () => {
      const degradedNames = Object.keys((f1Degraded && f1Degraded._registeredTools) || {});
      const expectedCount = healthyToolNames.length - GRAPH_TOOLS.length;
      assert.strictEqual(degradedNames.length, expectedCount, 'expected ' + expectedCount + ' tools, got ' + degradedNames.length);
      for (const t of GRAPH_TOOLS) {
        assert.ok(!degradedNames.includes(t), t + ' must be missing from the degraded server');
      }
      for (const t of healthyToolNames) {
        if (GRAPH_TOOLS.includes(t)) continue;
        assert.ok(degradedNames.includes(t), t + ' must still be present on the degraded server');
      }
    });

    // -------------------------------------------------------------------
    // H1: getRegistrationHealth() mirrors F1's report; status_read exposes
    // it. Runs BEFORE F2 -- see the header note on the singleton ordering.
    // -------------------------------------------------------------------
    check('H1: getRegistrationHealth() deep-equals the F1 report', () => {
      const reloaded = require(REGISTER_CORE_TOOLS_PATH);
      assert.strictEqual(typeof reloaded.getRegistrationHealth, 'function', 'getRegistrationHealth must be exported');
      const health = reloaded.getRegistrationHealth();
      assert.deepStrictEqual(health, f1Result, 'getRegistrationHealth() must deep-equal the F1 report');
    });

    await checkAsync('H1: status_read reports tool_registration.complete === false and names graph.cjs', async () => {
      const client = new Client({ name: 'test-354-registration-reader', version: '1' });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await f1Degraded.connect(a);
      await client.connect(b);
      try {
        const resp = await client.callTool({ name: 'status_read', arguments: {} });
        const text = (resp && resp.content && resp.content[0] && resp.content[0].text) || '';
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_e) { parsed = null; }
        const toolReg = parsed && parsed.segments && parsed.segments.capability_floor && parsed.segments.capability_floor.tool_registration;
        assert.ok(toolReg, 'expected segments.capability_floor.tool_registration, got ' + text);
        assert.strictEqual(toolReg.complete, false);
        const named = Array.isArray(toolReg.failed) && toolReg.failed.some((e) => e.module === 'graph.cjs');
        assert.ok(named, 'tool_registration.failed must name graph.cjs, got ' + JSON.stringify(toolReg.failed));
      } finally {
        await client.close();
        await f1Degraded.close();
      }
    });

    // -------------------------------------------------------------------
    // F2: register fault -- graph.cjs loads but its register() throws.
    // -------------------------------------------------------------------
    let f2Result;
    {
      const originalLoad = Module._load;
      delete require.cache[GRAPH_TOOL_PATH];
      Module._load = function (request, ...args) {
        if (request === GRAPH_TOOL_PATH) {
          return { register() { throw new Error('SYNTHETIC_REGISTER_THROW'); } };
        }
        return originalLoad.call(this, request, ...args);
      };
      try {
        const f2Degraded = new McpServer({ name: 'test-354-registration-f2', version: '1' });
        f2Result = registerCoreTools(f2Degraded, { fallbackRoomDir: fx.room });
      } finally {
        Module._load = originalLoad;
        delete require.cache[GRAPH_TOOL_PATH];
      }
    }
    check('F2: report.failed contains {module: graph.cjs, phase: register}', () => {
      const entry = f2Result && Array.isArray(f2Result.failed)
        && f2Result.failed.find((e) => e.module === 'graph.cjs' && e.phase === 'register');
      assert.ok(entry, 'expected a failed entry {module: graph.cjs, phase: register}, got ' + JSON.stringify(f2Result && f2Result.failed));
      assert.ok(String(entry.message).includes('SYNTHETIC_REGISTER_THROW'), 'entry.message must include SYNTHETIC_REGISTER_THROW, got ' + entry.message);
    });

    // -------------------------------------------------------------------
    // H2: a clean registration reports complete === true, failed === [].
    // -------------------------------------------------------------------
    check('H2: a clean registerCoreTools() run reports complete with no failures', () => {
      const clean = new McpServer({ name: 'test-354-registration-clean', version: '1' });
      const cleanHealth = registerCoreTools(clean, { fallbackRoomDir: fx.room });
      assert.ok(cleanHealth && typeof cleanHealth === 'object', 'expected a report object, got ' + JSON.stringify(cleanHealth));
      assert.strictEqual(cleanHealth.complete, true);
      assert.deepStrictEqual(cleanHealth.failed, []);
    });
  } finally {
    fx.cleanup();
  }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})();
