'use strict';

// Plan 373-02 item 4: the graph workflow child process runs offline.
// UV_OFFLINE, HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE are forced to "1" in the
// child environment, even when the host environment says otherwise. The only
// way out is the explicit opt-in MINDRIAN_EUREKA_ALLOW_NETWORK=1, which is
// never copied into the child. No engine is started and no network is used.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { eurekaChildEnvironment } = require('../lib/mcp/tools/eureka-capability-run.cjs');
const { callEurekaWorkflow } = require('../lib/mcp/tools/eureka-graph-analyze.cjs');

const OFFLINE = ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'];

async function captureChildEnv(env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-373-02-offline-'));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "fake"\n');
  let seen = null;
  class FakeTransport { constructor(options) { seen = options; } }
  class FakeClient {
    async connect() {}
    async callTool() { return { structuredContent: { status: 'completed_analysis' } }; }
    async close() {}
  }
  try {
    const out = await callEurekaWorkflow('graph.find_structural_gaps', { snapshot: {} },
      { MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_UV: '/nonexistent/uv', PATH: process.env.PATH, ...env }, undefined,
      { StdioClientTransport: FakeTransport, Client: FakeClient });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.ok(seen, 'transport was built');
    return seen.env;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main() {
  // Default: all three forced on, including over a hostile host value.
  for (const hostEnv of [{}, { HF_HUB_OFFLINE: '0', TRANSFORMERS_OFFLINE: '0', UV_OFFLINE: '0' }, { HF_HUB_OFFLINE: '', UV_OFFLINE: 'false' }]) {
    const childEnv = await captureChildEnv(hostEnv);
    for (const key of OFFLINE) assert.equal(childEnv[key], '1', `${key} forced to 1 for host env ${JSON.stringify(hostEnv)}`);
  }

  // Explicit opt-in lifts the force, and the opt-in itself never reaches the child.
  const optIn = await captureChildEnv({ MINDRIAN_EUREKA_ALLOW_NETWORK: '1', HF_HUB_OFFLINE: '0' });
  assert.equal(optIn.UV_OFFLINE, undefined, 'opt-in: UV_OFFLINE not forced');
  assert.equal(optIn.HF_HUB_OFFLINE, '0', 'opt-in: host value passes through the allowlist');
  assert.equal('MINDRIAN_EUREKA_ALLOW_NETWORK' in optIn, false, 'the opt-in variable is not copied into the child');
  // Only the exact value 1 opts in.
  for (const weak of ['0', 'true', '', 'yes']) {
    const childEnv = await captureChildEnv({ MINDRIAN_EUREKA_ALLOW_NETWORK: weak });
    for (const key of OFFLINE) assert.equal(childEnv[key], '1', `opt-in value "${weak}" does not lift the force`);
  }

  // The allowlist itself is unchanged for the other callers.
  const plain = eurekaChildEnvironment({ MINDRIAN_EUREKA_ROOT: '/private/root', SECRET_KEY: 'hidden', HF_HUB_OFFLINE: '0' });
  assert.equal(plain.SECRET_KEY, undefined);
  assert.equal(plain.MINDRIAN_EUREKA_ROOT, undefined);
  assert.equal(plain.HF_HUB_OFFLINE, '0', 'without the flag the helper keeps its old behavior');
  const forced = eurekaChildEnvironment({ SECRET_KEY: 'hidden' }, { forceOffline: true });
  for (const key of OFFLINE) assert.equal(forced[key], '1');
  assert.equal(forced.SECRET_KEY, undefined);

  console.log('eureka 373-02 offline env: PASS (3 offline variables forced, hostile values overridden, exact opt-in only)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
