#!/usr/bin/env node
'use strict';

/*
 * Phase 270-02 Task 2 -- RED pin for the Resource boot-binding defect
 * (RESEARCH.md 3.4d).
 *
 * bin/mindrian-mcp-server.cjs:214 calls registerResources(s, roomDir) and
 * lib/mcp/resources.cjs:33 closes over that string for the life of the
 * process. Every Tool instead calls resolveSessionRoomDir(sessionId, ctx)
 * per call (lib/mcp/session-room.cjs:116). So after a room_bind,
 * room_state_bound returns the newly bound room and room://state still
 * returns the boot room. Same data, same reader (stateOps.getState),
 * divergent room, and the Resource is the wrong one. RED until plan 270-05.
 *
 * No em-dashes. CJS only. node:assert, node:fs, node:path, node:os only, no
 * new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESOURCES_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'resources.cjs');

// Comment-stripping idiom (tests/test-224-resolver-fallback.cjs:39,
// tests/test-248-resolver-census.cjs's own precedent). Never grep raw
// source -- a header prose mention would self-invalidate the gate.
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

// makeStubServer() -- captures registrations without an MCP transport.
// server.resource(name, uriOrTemplate, meta, cb): string uri -> resources
// map; ResourceTemplate instance -> templates map. Both keyed by `name`,
// mirroring the SDK's own resource() at mcp.js:451. server.tool(name, desc,
// schema, cb) stores keyed by name so the same stub drives
// lib/mcp/tools/room.cjs's register().
function makeStubServer() {
  return {
    resources: new Map(),
    templates: new Map(),
    tools: new Map(),
    listChangedCount: 0,
    resource(name, uriOrTemplate, meta, cb) {
      if (typeof uriOrTemplate === 'string') {
        this.resources.set(name, { uri: uriOrTemplate, meta, cb });
      } else {
        this.templates.set(name, { template: uriOrTemplate, meta, cb });
      }
    },
    tool(name, description, schema, cb) {
      this.tools.set(name, { description, schema, cb });
    },
    sendResourceListChanged() {
      this.listChangedCount += 1;
    },
  };
}

// makeRoom(label) -- a hermetic temp room. Writes a STATE.md whose body
// carries the unique literal ROOM-MARKER-<label>, a ROOM.md, and one real
// section subdirectory (so discoverSections(roomDir) actually differs
// between rooms -- an empty room would make room-sections byte-identical
// for A and B regardless of the resolution defect, which would make the
// leg-4 divergence assertion meaningless).
function makeRoom(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '270-room-'));
  fs.writeFileSync(path.join(dir, 'STATE.md'), '# State\n\nROOM-MARKER-' + label + '\n');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# Room ' + label + '\n');
  const sectionDir = path.join(dir, 'section-' + String(label).toLowerCase());
  fs.mkdirSync(sectionDir);
  fs.writeFileSync(path.join(sectionDir, 'STATE.md'), '# Section ' + label + '\n');
  return dir;
}

function cleanupRoom(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    // best effort
  }
}

function ctxTypeErrorGuard(name, innerErr) {
  return new Error(
    'registerResources still takes a bare roomDir string; expected the ctx shape ' +
    '{ fallbackRoomDir, pluginRoot, surface } that register-core-tools.cjs already passes ' +
    'to every tool module (resource "' + name + '"). resources.cjs must resolve via ' +
    'lib/mcp/session-room.cjs (resolveSessionRoomDir), not close over a boot-time roomDir. ' +
    'Underlying error: ' + (innerErr && innerErr.message ? innerErr.message : String(innerErr))
  );
}

let n = 0;
async function ok(desc, fn) {
  await fn();
  n += 1;
  console.log('  ok   ' + desc);
}

console.log('test-270-resource-session-room');

(async function main() {
  // ---------------------------------------------------------------------
  // Leg 1: source-grep. No fixtures needed; runs before anything is created
  // so a RED failure here leaves zero temp directories behind.
  // ---------------------------------------------------------------------
  await ok('source: lib/mcp/resources.cjs resolves the room through lib/mcp/session-room.cjs', async function () {
    const src = fs.readFileSync(RESOURCES_PATH, 'utf8');
    const stripped = stripComments(src);
    assert.ok(
      stripped.indexOf('session-room.cjs') !== -1 && stripped.indexOf('resolveSessionRoomDir(') !== -1,
      'resources.cjs still binds roomDir at boot; expected a per-read call to resolveSessionRoomDir (RESEARCH.md 3.4d)'
    );
  });

  const roomA = makeRoom('A');
  const roomB = makeRoom('B');
  // Isolate MINDRIAN_ROOMS_HOME so resolveSessionRoom's reg.active leg
  // (lib/core/resolve-active-room.cjs:513) cannot find a REAL machine's
  // actively-bound room (found empirically while verifying plan 270-05:
  // this leg outranks ctx.fallbackRoomDir in the resolver's floor order, so
  // an un-isolated run silently read a real developer's live room instead
  // of the fixture -- a false pass this test exists to prevent, not commit).
  // Restored in the outer finally alongside the fixture cleanup.
  const emptyRoomsHome = fs.mkdtempSync(path.join(os.tmpdir(), '270-emptyhome-'));
  const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = emptyRoomsHome;
  try {
    const stub = makeStubServer();
    const ctx = { fallbackRoomDir: roomA, pluginRoot: REPO_ROOT, surface: 'cli' };

    delete require.cache[RESOURCES_PATH];
    const { registerResources } = require(RESOURCES_PATH);
    registerResources(stub, ctx);

    // Sanity guard before grading: a vacuous green is the exact failure
    // shape this phase exists to close. 9, not 7, since plan 270-08 added
    // mos-tree and mos-room-tree.
    if (stub.resources.size + stub.templates.size !== 9) {
      throw new Error(
        'harness never reached real registrations: expected 9 resource+template ' +
        'registrations, got ' + (stub.resources.size + stub.templates.size)
      );
    }

    // -------------------------------------------------------------------
    // Leg 2: per-read re-resolution, WITHOUT seeding a session registry.
    // -------------------------------------------------------------------
    await ok('behaviour: the room://state handler re-resolves on EVERY read, not once at registration', async function () {
      const reg = stub.resources.get('room-state');
      assert.ok(reg, 'room-state resource was not registered');

      let firstText;
      try {
        const result = await reg.cb({ href: 'room://state' }, { sessionId: 'sess-270-a' });
        firstText = result.contents[0].text;
      } catch (innerErr) {
        throw ctxTypeErrorGuard('room-state', innerErr);
      }
      assert.ok(
        firstText.indexOf('ROOM-MARKER-A') !== -1,
        'expected ROOM-MARKER-A in first read, got: ' + String(firstText).slice(0, 200)
      );

      // Mutate WITHOUT re-registering -- a boot-bound implementation cannot
      // see this.
      ctx.fallbackRoomDir = roomB;

      let secondText;
      try {
        const result2 = await reg.cb({ href: 'room://state' }, { sessionId: 'sess-270-a' });
        secondText = result2.contents[0].text;
      } catch (innerErr2) {
        throw ctxTypeErrorGuard('room-state', innerErr2);
      }
      assert.ok(
        secondText.indexOf('ROOM-MARKER-B') !== -1,
        'expected ROOM-MARKER-B after ctx mutation (boot-bound implementation returns A both times), got: ' +
          String(secondText).slice(0, 200)
      );
    });

    // -------------------------------------------------------------------
    // Leg 3: OQ-4 designed invariant. room://state and room_state_bound
    // must return the same room for the same session. OQ-4: the langtalks
    // corpus returned nothing on multi-surface memory consistency. This is
    // a DESIGNED invariant with a test, not a researched pattern; no
    // external source is cited for it.
    // -------------------------------------------------------------------
    await ok('parity (OQ-4 designed invariant): room://state and room_state_bound return the same room for the same session', async function () {
      const { register: registerRoomTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'room.cjs'));
      registerRoomTools(stub, ctx);

      const boundTool = stub.tools.get('room_state_bound');
      assert.ok(boundTool, 'room_state_bound tool was not registered on the stub');

      const toolResultRaw = await boundTool.cb({}, { sessionId: 'sess-270-a' });
      const toolText = toolResultRaw.content[0].text;

      const roomStateReg = stub.resources.get('room-state');
      let resourceText;
      try {
        const resourceResult = await roomStateReg.cb({ href: 'room://state' }, { sessionId: 'sess-270-a' });
        resourceText = resourceResult.contents[0].text;
      } catch (innerErr) {
        throw ctxTypeErrorGuard('room-state', innerErr);
      }

      const toolMarker = (toolText.match(/ROOM-MARKER-\w+/) || [])[0];
      const resourceMarker = (resourceText.match(/ROOM-MARKER-\w+/) || [])[0];
      assert.ok(toolMarker, 'room_state_bound response carried no ROOM-MARKER token: ' + toolText.slice(0, 200));
      assert.ok(resourceMarker, 'room://state response carried no ROOM-MARKER token: ' + resourceText.slice(0, 200));
      assert.equal(
        resourceMarker,
        toolMarker,
        'room://state and room_state_bound diverged for the same session: resource=' +
          resourceMarker + ' tool=' + toolMarker
      );
    });

    // -------------------------------------------------------------------
    // Leg 4: the other six resources use the same per-read resolution.
    // -------------------------------------------------------------------
    await ok('the other six resources use the same per-read resolution as room://state', async function () {
      const expectedNames = [
        'room-state', 'room-sections', 'room-section', 'room-meetings',
        'room-intelligence', 'reasoning-state', 'reasoning-section',
        // plan 270-08 additions:
        'mos-tree', 'mos-room-tree',
      ];
      const actualNames = Array.from(stub.resources.keys())
        .concat(Array.from(stub.templates.keys()))
        .sort();
      assert.deepEqual(
        actualNames,
        expectedNames.slice().sort(),
        'registered resource/template name set changed: got ' + JSON.stringify(actualNames)
      );

      const staticNames = Array.from(stub.resources.keys());

      ctx.fallbackRoomDir = roomA;
      const firstPass = {};
      for (const name of staticNames) {
        const reg = stub.resources.get(name);
        try {
          const result = await reg.cb({ href: 'probe://' + name }, { sessionId: 'sess-270-a' });
          firstPass[name] = result.contents[0].text;
        } catch (innerErr) {
          throw ctxTypeErrorGuard(name, innerErr);
        }
      }

      ctx.fallbackRoomDir = roomB;
      const secondPass = {};
      for (const name of staticNames) {
        const reg = stub.resources.get(name);
        try {
          const result = await reg.cb({ href: 'probe://' + name }, { sessionId: 'sess-270-a' });
          secondPass[name] = result.contents[0].text;
        } catch (innerErr) {
          throw ctxTypeErrorGuard(name, innerErr);
        }
      }

      for (const name of ['room-state', 'room-sections']) {
        assert.notEqual(
          firstPass[name],
          secondPass[name],
          name + ' returned byte-identical text for two different fallbackRoomDir values (still boot-bound)'
        );
      }

      // For the two ResourceTemplate entries: assert the list callback
      // shape rather than re-driving the mutation probe (templates are not
      // enumerated the same way as static resources).
      const sectionTpl = stub.templates.get('room-section');
      const reasoningTpl = stub.templates.get('reasoning-section');
      assert.ok(sectionTpl, 'room-section template was not registered');
      assert.ok(reasoningTpl, 'reasoning-section template was not registered');
      assert.equal(
        typeof sectionTpl.template.listCallback,
        'function',
        'room-section ResourceTemplate should carry a list callback'
      );
      // reasoningTemplate ships `list: undefined` at resources.cjs:206-208,
      // so it is not enumerable via a resources/list request -- a known
      // inconsistency this phase notes but does not fix.
      assert.equal(
        reasoningTpl.template.listCallback,
        undefined,
        'reasoning-section ResourceTemplate unexpectedly gained a list callback (update this comment if intentional)'
      );
    });
  } finally {
    if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
    cleanupRoom(emptyRoomsHome);
    cleanupRoom(roomA);
    cleanupRoom(roomB);
  }

  console.log('\nPASS test-270-resource-session-room (' + n + ' assertions)');
})().catch(function (err) {
  console.error('FAIL test-270-resource-session-room: ' + (err && err.message ? err.message : String(err)));
  process.exitCode = 1;
});
