'use strict';

// Plan 373-02 item 1: the room projection refuses a sealed room and a room
// whose identity state is not ready, before any Eureka engine starts.
// Real session resolver and a real bound temp room. The engine call is a
// counter and must stay at 0 for every refusal.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const savedEnv = {};
for (const key of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_ACTIVE_ROOM']) savedEnv[key] = process.env[key];
function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}

// Wrap describeRoomBinding BEFORE the projection module loads, so a test can
// force a not-ready identity state while the rest of the path stays real.
const sessionRoom = require('../lib/mcp/session-room.cjs');
const realDescribe = sessionRoom.describeRoomBinding;
let forcedIdentity = null;
sessionRoom.describeRoomBinding = function patched(resolution, opts) {
  const out = realDescribe(resolution, opts);
  return forcedIdentity ? Object.assign({}, out, { identity: forcedIdentity }) : out;
};
const { TOOLS, runDiscoverySignal } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');
const { project } = require('../lib/mcp/tools/eureka-graph-projection.cjs');

async function main() {
  const helper = require('./helpers/isolated-home-36925.cjs');
  const isolated = helper.mkIsolatedHome('eureka-373-02-room');
  try {
    const born = helper.birthFixtureRoom({ iso: isolated, slug: 'eureka-373-02-room', sessionId: 'fixture-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const sessionId = 'eureka-373-02-room-session';
    const writeDb = nav.openRoomDbForCaller(born.roomDir);
    let nodeId;
    try {
      const claim = nav.writeClaimNode(writeDb, { knowledge_type: 'fact', text: 'Sensors detect cellular stress.', sessionId, sourceSegment: 'eureka-373-02' });
      assert.equal(claim.ok, true, JSON.stringify(claim));
      nodeId = claim.node_id;
    } finally { nav.closeRoomDbForCaller(writeDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(sessionId, { bound: [born.slug], primary: born.slug, sticky: true }, { home: isolated.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;

    let launches = 0;
    const counted = (spec) => async () => {
      launches += 1;
      return { ok: true, result: { capability_id: spec.capability_id, scope_id: 'x', snapshot_id: 'y', status: 'completed_analysis' } };
    };

    // Control: a ready, unsealed room still projects.
    const control = project({ node_ids: [nodeId] }, {}, { sessionId });
    assert.equal(control.ok, true, 'control: ready unsealed room projects: ' + JSON.stringify(control));

    // A. GUARDRAIL.md present: sealed room refused, through all five services.
    const guardrail = path.join(born.roomDir, 'GUARDRAIL.md');
    fs.writeFileSync(guardrail, '# GUARDRAIL\nSealed.\n');
    for (const spec of TOOLS) {
      const out = await runDiscoverySignal(spec, { node_ids: [nodeId] }, {}, { sessionId }, { callEurekaWorkflow: counted(spec) });
      assert.equal(out.ok, false, `${spec.capability_id}: sealed room refused`);
      assert.equal(out.reason, 'room_sealed', `${spec.capability_id}: typed reason`);
      assert.equal(JSON.stringify(out).includes(born.roomDir), false, 'no room path in the refusal');
    }
    fs.rmSync(guardrail);
    assert.equal(project({ node_ids: [nodeId] }, {}, { sessionId }).ok, true, 'room projects again once GUARDRAIL.md is gone');

    // B. Registry disposition sealed or archived: refused.
    const registryDir = path.join(isolated.roomsHome, '.rooms');
    fs.mkdirSync(registryDir, { recursive: true });
    const registryFile = path.join(registryDir, 'registry.json');
    for (const entry of [{ status: 'sealed' }, { status: 'archived' }, { sealed: true }]) {
      fs.writeFileSync(registryFile, JSON.stringify({ active: born.slug, rooms: { [born.slug]: Object.assign({ abs_path: born.roomDir }, entry) } }));
      const out = project({ node_ids: [nodeId] }, {}, { sessionId });
      assert.equal(out.ok, false, `registry ${JSON.stringify(entry)} refused`);
      assert.equal(out.reason, 'room_sealed');
    }
    fs.rmSync(registryFile);

    // C. Identity state not ready (a room id may still be known): refused.
    for (const identity of [{ state: 'not_ready', reason: 'identity_path_mismatch' }, null, { state: 'unknown' }]) {
      forcedIdentity = identity === null ? { } : identity;
      for (const spec of TOOLS) {
        const out = await runDiscoverySignal(spec, { node_ids: [nodeId] }, {}, { sessionId }, { callEurekaWorkflow: counted(spec) });
        assert.equal(out.ok, false, `${spec.capability_id}: identity ${JSON.stringify(identity)} refused`);
        assert.equal(out.reason, 'room_identity_not_ready');
      }
    }
    forcedIdentity = null;

    assert.equal(launches, 0, 'no engine call after any refusal');
    console.log('eureka 373-02 room refusal: PASS (sealed GUARDRAIL, sealed/archived registry, not-ready identity; 0 engine launches)');
  } finally {
    isolated.cleanup();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(restoreEnv);
