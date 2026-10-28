'use strict';

// Plan 373-02 item 3: honest readiness. Every result of the five graph
// services carries readiness 'experimental', and the guide states the Known
// limits (0 of 30 backtest, no numeric parity, authorship unresolved, local
// only). No text calls the services ready.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TOOLS, runDiscoverySignal } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');

const host = (overrides = {}) => ({
  ok: true, scope_id: 'room-test', snapshot_id: 'snapshot-test',
  room_binding: { room_id: 'room-test', source: 'session.primary', registry_fallback: false },
  snapshot: { nodes: [{ id: 'n1' }], edges: [], meta: { complete: true, omissions: {} } },
  ...overrides,
});

async function main() {
  // Envelope: success, host refusal, engine refusal, lineage refusal.
  for (const spec of TOOLS) {
    const good = { capability_id: spec.capability_id, scope_id: 'room-test', snapshot_id: 'snapshot-test', status: 'completed_analysis' };
    const cases = {
      success: { project: () => host(), callEurekaWorkflow: async () => ({ ok: true, result: good }) },
      host_refusal: { project: () => ({ ok: false, reason: 'no_bound_room', message: 'x' }) },
      engine_status: { project: () => host(), callEurekaWorkflow: async () => ({ ok: true, result: { status: 'failed' } }) },
      lineage: { project: () => host(), callEurekaWorkflow: async () => ({ ok: true, result: { ...good, scope_id: 'other' } }) },
      engine_transport: { project: () => host(), callEurekaWorkflow: async () => ({ ok: false, reason: 'engine_unavailable', message: 'x' }) },
    };
    for (const [label, deps] of Object.entries(cases)) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, deps);
      assert.equal(out.readiness, 'experimental', `${spec.capability_id} ${label} carries readiness experimental`);
    }
  }

  // Guide: Known limits section.
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'integrations', 'mindrian-eureka-engine.md'), 'utf8');
  const at = doc.indexOf('## Known limits');
  assert.ok(at >= 0, 'guide has a Known limits section');
  const rest = doc.slice(at + 3);
  const next = rest.indexOf('\n## ');
  const section = next === -1 ? rest : rest.slice(0, next);
  for (const needle of [
    'experimental',
    '0 of 30',
    '2026-10-19',
    'top 200',
    'no numeric parity',
    'authorship',
    'unresolved',
    'local-only',
    'leads, not findings',
  ]) {
    assert.ok(section.toLowerCase().includes(needle.toLowerCase()), `Known limits mentions "${needle}"`);
  }
  for (const spec of TOOLS) assert.ok(section.includes(spec.tool), `Known limits names ${spec.tool}`);
  assert.equal(new RegExp(String.fromCharCode(0x2014) + '|' + String.fromCharCode(0x2013)).test(section), false, 'no em-dash or en-dash');
  // The five services are never described as ready, validated, or released.
  assert.equal(/\b(is|are) (production-)?ready\b|\bvalidated by\b|\bproduction ready\b/i.test(section), false, 'no ready claim');

  console.log('eureka 373-02 readiness: PASS (envelope label on every path, Known limits text)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
