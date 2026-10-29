'use strict';

// Plan 373-02 item 5: no raw engine message reaches the caller. Every engine
// failure maps to a fixed text for its status. Engine text, paths, extra keys
// and unknown reasons are dropped. No engine is started and no network is used.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TOOLS, runDiscoverySignal } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');
const { callEurekaWorkflow } = require('../lib/mcp/tools/eureka-graph-analyze.cjs');

const SECRET = '/home/secret/eureka-root TOKEN-abc123 Traceback (most recent call last)';
const host = () => ({
  ok: true, scope_id: 'room-test', snapshot_id: 'snapshot-test',
  room_binding: { room_id: 'room-test', source: 'session.primary', registry_fallback: false },
  snapshot: { nodes: [{ id: 'n1' }], edges: [], meta: { complete: true, omissions: {} } },
});

function assertClean(out, label) {
  const text = JSON.stringify(out);
  for (const leak of ['/home/secret', 'TOKEN-abc123', 'Traceback', 'stderr-leak', 'detail-leak']) {
    assert.equal(text.includes(leak), false, `${label}: no "${leak}" in the result`);
  }
}

async function main() {
  const KNOWN = ['engine_not_configured', 'engine_checkout_unavailable', 'cancelled', 'engine_timeout', 'engine_unavailable',
    'engine_rejected_request', 'engine_invalid_response'];
  const seenMessages = new Map();
  for (const spec of TOOLS) {
    for (const reason of [...KNOWN, 'engine_status_error', 'weird_reason ' + SECRET, undefined]) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, {
        project: () => host(),
        callEurekaWorkflow: async () => ({ ok: false, reason, message: SECRET, stderr: 'stderr-leak ' + SECRET, detail: 'detail-leak', job_id: SECRET }),
      });
      const label = `${spec.capability_id} ${String(reason).slice(0, 24)}`;
      assert.equal(out.ok, false, label);
      assertClean(out, label);
      assert.equal(typeof out.reason, 'string');
      assert.equal(out.reason === 'engine_failed' || KNOWN.includes(out.reason), true, `${label}: reason is from the fixed set (${out.reason})`);
      assert.equal(typeof out.message, 'string');
      assert.equal(out.persistence, 'none');
      assert.equal(out.capability_id, spec.capability_id);
      assert.equal(out.scope_id, 'room-test');
      assert.equal(out.snapshot_id, 'snapshot-test');
      // Fixed text: the same reason always gives the same message across the five services.
      if (seenMessages.has(out.reason)) assert.equal(out.message, seenMessages.get(out.reason), `${label}: message is fixed`);
      else seenMessages.set(out.reason, out.message);
      assert.equal(Object.keys(out).includes('stderr'), false, 'engine extra keys are dropped');
    }
  }
  // Known reasons keep their reason; unknown reasons become engine_failed.
  const unknown = await runDiscoverySignal(TOOLS[0], { node_ids: ['n1'] }, {}, {}, {
    project: () => host(), callEurekaWorkflow: async () => ({ ok: false, reason: 'surprise', message: SECRET }),
  });
  assert.equal(unknown.reason, 'engine_failed');

  // End to end through the real decoder: an engine isError reply carrying a path and a thrown transport error.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-373-02-scrub-'));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "fake"\n');
  try {
    class Transport { constructor() {} }
    const rejecting = class { async connect() {} async callTool() { return { isError: true, content: [{ type: 'text', text: SECRET + ' ' + root }] }; } async close() {} };
    const throwing = class { async connect() { throw new Error(SECRET + ' ' + root); } async callTool() {} async close() {} };
    for (const Client of [rejecting, throwing]) {
      const out = await runDiscoverySignal(TOOLS[1], { node_ids: ['n1'] }, {}, {}, {
        project: () => host(),
        callEurekaWorkflow: (id, request, _env, signal) => callEurekaWorkflow(id, request,
          { MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_UV: '/nonexistent/uv', PATH: process.env.PATH }, signal,
          { StdioClientTransport: Transport, Client }),
      });
      assert.equal(out.ok, false);
      assertClean(out, 'end to end');
      assert.equal(JSON.stringify(out).includes(root), false, 'no engine root path in the result');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log('eureka 373-02 error scrub: PASS (fixed text per failure status, engine text and extra keys dropped, unknown reasons mapped)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
