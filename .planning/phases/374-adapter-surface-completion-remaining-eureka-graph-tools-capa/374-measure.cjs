#!/usr/bin/env node
'use strict';
/*
 * Phase 374 plan 14: the tools/list budget probe. A probe, not a test.
 *
 * It starts bin/mindrian-mcp-server.cjs over stdio the same way
 * tests/test-270-tool-schema-budget.cjs does (temp HOME, MINDRIAN_TRANSPORT=stdio,
 * no Brain key, same initialize / initialized / tools/list messages), calls the
 * exported measure(tools) of that test file for the totals, and adds the Eureka
 * family (names that start with eureka_ or rs_). It prints JSON and exits 0.
 * Node built-ins only. No network. No engine: the server lists tools and does
 * not start the Eureka engine.
 *
 * Run: node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-measure.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const BUDGET_TEST = path.join(REPO_ROOT, 'tests', 'test-270-tool-schema-budget.cjs');
const TIMEOUT_MS = 30000;

const { measure, AFTER } = require(BUDGET_TEST);

function listToolsOverStdio() {
  return new Promise((resolve) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-374-measure-'));
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_TRANSPORT: 'stdio',
      MINDRIAN_ROOM: path.join(tmpHome, 'room'),
    });
    delete env.MINDRIAN_BRAIN_KEY;
    // The probe must never reach a live engine.
    delete env.MINDRIAN_EUREKA_ROOT;
    delete env.MINDRIAN_EUREKA_RS_MODEL_PATH;

    const proc = cp.spawn('node', [SERVER], { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], env });
    let buf = '';
    let err = '';
    let settled = false;
    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { proc.kill('SIGKILL'); } catch (_e) { /* gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
      resolve(payload);
    }
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout', stderr: err.slice(-800) }), TIMEOUT_MS);
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_e) { continue; }
        if (!obj) continue;
        if (obj.id === 1) {
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
        } else if (obj.id === 2) {
          if (obj.error) finish({ ok: false, reason: 'tools_list_error', message: JSON.stringify(obj.error) });
          else finish({ ok: true, tools: (obj.result && obj.result.tools) || [] });
        }
      }
    });
    proc.stderr.on('data', (c) => { err += c.toString('utf8'); });
    proc.on('error', (e) => finish({ ok: false, reason: 'spawn_error', message: e.message }));
    proc.on('exit', (code) => finish({ ok: false, reason: 'exited_before_response', code, stderr: err.slice(-800) }));
    proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'phase-374-measure', version: '1.0.0' } },
    }) + '\n');
  });
}

function sum(perTool, pred) {
  const rows = perTool.filter((t) => pred(t.name));
  const bytes = rows.reduce((a, t) => a + t.totalBytes, 0);
  return { count: rows.length, bytes, approxTokens: Math.round(bytes / 4) };
}

(async () => {
  const res = await listToolsOverStdio();
  if (!res.ok) {
    process.stdout.write(JSON.stringify({ ok: false, reason: res.reason, detail: res.message || res.stderr || null }) + '\n');
    process.exit(0);
  }
  const m = measure(res.tools);
  const isEureka = (n) => n.startsWith('eureka_') || n.startsWith('rs_');
  const family = sum(m.perTool, isEureka);
  const out = {
    ok: true,
    proxy: 'approxTokens is bytes divided by 4; compare only with numbers from the same measure() function',
    measuredBy: 'measure() exported by tests/test-270-tool-schema-budget.cjs',
    total: {
      toolCount: m.toolCount,
      totalDescBytes: m.totalDescBytes,
      totalSchemaBytes: m.totalSchemaBytes,
      totalBytes: m.totalBytes,
      approxTokens: m.approxTokens,
      routerCount: m.routerCount,
      atomicCount: m.atomicCount,
    },
    recordedAfterInTest270: AFTER,
    eurekaFamily: Object.assign({}, family, {
      shareOfSurfacePct: Number(((family.bytes / m.totalBytes) * 100).toFixed(1)),
    }),
    eurekaGraphTools: sum(m.perTool, (n) => n.startsWith('eureka_graph_')),
    capabilityAndJobTools: sum(m.perTool, (n) => n.startsWith('eureka_capability_')),
    eurekaToolNames: m.perTool.filter((t) => isEureka(t.name)).map((t) => t.name).sort(),
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
})();
