#!/usr/bin/env node
'use strict';

/*
 * tests/test-347-context-focus.cjs -- Phase 347-06 Task 1.
 *
 * Pins the focus seam: a caller-supplied options.focusNodeId /
 * focus_node_id on getRoomContext / context_assemble (SHARED-05), additive
 * beside the existing budget dial, defaulting to today's conversation-
 * derived behaviour when absent. This is the Phase 347 amendment to Phase
 * 344 working decision WD-5 (docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md,
 * room-context.cjs's own new comment above the seed derivation).
 *
 * Reuse before build (Canon Part 7): this file reuses two ALREADY-SHIPPED
 * fixtures rather than minting a third:
 *   - tests/fixtures/room-141-fixture.cjs (buildFixtureDb): a populated
 *     in-memory room with a section node, two claim nodes, and one session
 *     whose fragments resolve via resolveSeedNode to 'section:market-
 *     analysis'. Already the load-bearing fixture behind
 *     tests/test-get-room-context.cjs -- Tests 1, 2, 3 below reuse it
 *     unmodified.
 *   - tests/helpers/fixture-room-347.cjs (buildChainFixtureRoom): the
 *     phase's own chain-state fixture (one seeded subject node, nodes+edges
 *     only, no sessions/fragments tables) -- Test 4 (the writer-node
 *     scenario) reuses it and anchors a real chain-state.cjs 'notes' record
 *     to its subject.
 *   - lib/core/room-db.cjs::openRoomDb for the wire-level tests (5, 6), the
 *     same real migrated-schema bootstrap tests/test-270-cross-room-fence.cjs
 *     uses, so context_assemble is exercised against a genuine on-disk room,
 *     not a second hand-rolled schema.
 *
 * Plain node:assert CJS script, one file per behavior cluster (the repo's
 * own convention). Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { z } = require('zod');

const REPO_ROOT = path.resolve(__dirname, '..');

const { getRoomContext } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { buildFixtureDb } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'room-141-fixture.cjs'));
const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-347.cjs'));
const chainState = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const contextTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'context.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-347-focus-' + suffix + '-'));
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

// Strips the non-deterministic legTimingsMs sub-object so two calls over the
// same fixture can be compared for the additive-floor "byte-identical"
// claim without a wall-clock hrtime value ever failing the comparison.
function stripTimings(result) {
  const clone = JSON.parse(JSON.stringify(result));
  if (clone && clone._meta) delete clone._meta.legTimingsMs;
  return clone;
}

async function main() {
  console.log('test-347-context-focus:');

  // ======================================================================
  // Tests 1-3: options.focusNodeId at the assembler, over the shared
  // room-141 fixture whose fragments resolve to 'section:market-analysis'.
  // ======================================================================
  {
    const db = buildFixtureDb();
    try {
      // ---- Test 1: an explicit focusNodeId wins verbatim, even when it
      // names a node resolveSeedNode would never have produced from the
      // fixture's own fragments (proving the caller-supplied lane is taken,
      // not merely validated against the fragment-derived candidate). ----
      const explicit = await getRoomContext(db, 'fixture', { focusNodeId: 'section:x', topK: 5 });
      assert.equal(
        explicit._meta.seedNodeId, 'section:x',
        'an explicit focusNodeId must be echoed verbatim in _meta.seedNodeId'
      );
      assert.notEqual(
        explicit._meta.seedNodeId, 'section:market-analysis',
        'the explicit focus must not have been silently replaced by the fragment-derived candidate'
      );
      ok('Test 1: options.focusNodeId wins verbatim and bypasses resolveSeedNode');

      // ---- Test 2: omitting focusNodeId is byte-identical to today. Two
      // separate calls (one with no key at all, one with focusNodeId:
      // undefined) are compared to each other and both derive the seed from
      // the fragments exactly as before. Named key membership only, per the
      // additive-floor idiom at room-context.cjs:341-347 -- never an exact
      // key count. ----
      const noKey = stripTimings(await getRoomContext(db, 'fixture', { topK: 5, fragmentWindow: 6, maxDepth: 2 }));
      const explicitUndefined = stripTimings(
        await getRoomContext(db, 'fixture', { focusNodeId: undefined, topK: 5, fragmentWindow: 6, maxDepth: 2 })
      );
      for (const key of ['summary', 'recentMessages', 'relevantNodes', 'cortexNodes', '_meta']) {
        assert.ok(Object.prototype.hasOwnProperty.call(noKey, key), 'result is missing key: ' + key);
      }
      assert.deepStrictEqual(
        noKey, explicitUndefined,
        'a call with no focusNodeId key must be byte-identical to a call with focusNodeId: undefined'
      );
      assert.equal(
        noKey._meta.seedNodeId, 'section:market-analysis',
        'omitting focusNodeId must still derive the seed from the conversation fragments'
      );
      ok('Test 2: omitting focusNodeId is byte-identical to the pre-347-06 fragment-derived path');

      // ---- Test 3: a malformed focusNodeId (empty string, non-string,
      // null) falls back to resolveSeedNode rather than blanking the
      // focus. ----
      for (const malformed of ['', 123, null]) {
        const result = await getRoomContext(db, 'fixture', { focusNodeId: malformed, topK: 5 });
        assert.equal(
          result._meta.seedNodeId, 'section:market-analysis',
          'a malformed focusNodeId (' + JSON.stringify(malformed) + ') must fall back to resolveSeedNode, never blank the focus'
        );
      }
      ok('Test 3: an empty string, a non-string, or null falls back to resolveSeedNode');
    } finally {
      db.close();
    }
  }

  // ======================================================================
  // Test 4: the writer-node scenario end to end, over the phase's own
  // chain-state fixture (nodes+edges only, one seeded subject node).
  // ======================================================================
  {
    const tmpDir = makeScratchDir('writer');
    let fixture = null;
    try {
      fixture = buildChainFixtureRoom(tmpDir, 'wide');
      const write = chainState.writeChainStateRecord(fixture.db, {
        run_id: 'run-347-06-writer',
        step_index: 0,
        kind: 'notes',
        command: '/mos:act',
        body: { text: 'the researcher\'s structured notes' },
        quality: 'high',
        tier: 'executable',
        produced_by: 'researcher',
        subject_node_id: fixture.subjectNodeId,
      });
      assert.equal(write.ok, true, 'the fixture\'s own chain-state write must succeed');

      const result = await getRoomContext(fixture.db, 'fixture-writer', {
        focusNodeId: write.node_id,
        seedFragments: [],
        topK: 5,
      });

      assert.equal(result._meta.seedNodeId, write.node_id, 'the notes record must be echoed as the seed node');
      assert.deepStrictEqual(
        result.recentMessages, [],
        'a room with no session/fragments tables must yield an empty recentMessages, never conversation content'
      );
      assert.ok(Array.isArray(result.relevantNodes) && result.relevantNodes.length > 0,
        'relevantNodes must be non-empty: the notes record\'s own SOURCED_FROM neighbor');
      const neighborIds = result.relevantNodes.map((n) => n.id);
      assert.ok(neighborIds.indexOf(fixture.subjectNodeId) !== -1,
        'relevantNodes must include the notes record\'s SOURCED_FROM subject, not the parent transcript');
      ok('Test 4: a writer node can be served the researcher\'s notes record via focusNodeId, not the raw conversation');
    } finally {
      if (fixture) closeChainFixtureRoom(fixture);
    }
  }

  // ======================================================================
  // Tests 5-6: at the wire (lib/mcp/tools/context.cjs), over a real
  // migrated on-disk room (lib/core/room-db.cjs::openRoomDb).
  // ======================================================================
  {
    const tmpDir = makeScratchDir('wire');
    const roomDir = path.join(tmpDir, 'room');
    fs.mkdirSync(roomDir, { recursive: true });
    let db = openRoomDb(roomDir);
    try {
      insertNode(db, 'claim:wire-focus', 'claim', JSON.stringify({ text: 'a wire-level focus target' }), {
        epistemic_type: 'observation',
      });
    } finally {
      closeRoomDb(db);
      db = null;
    }

    const stub = {
      tools: new Map(),
      tool(name, description, schema, cb) { this.tools.set(name, { description, schema, cb }); },
    };
    const ctx = { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' };
    contextTool.register(stub, ctx);
    const reg = stub.tools.get('context_assemble');
    assert.ok(reg, 'context_assemble must be registered');

    // ---- Test 5: focus_node_id threads through and is echoed in
    // _meta.seedNodeId at the wire; omitting it is byte-identical across
    // two calls over the same fixture. ----
    const withFocus = await reg.cb({ focus_node_id: 'claim:wire-focus' }, { sessionId: 'sess-347-06-a' });
    const withFocusBody = JSON.parse(withFocus.content[0].text);
    assert.equal(withFocusBody.ok, true, 'context_assemble must succeed against the seeded room');
    assert.equal(
      withFocusBody._meta.seedNodeId, 'claim:wire-focus',
      'focus_node_id must thread through navigation.getRoomContext and be echoed at the wire'
    );

    const noFocus1 = JSON.parse((await reg.cb({}, { sessionId: 'sess-347-06-b' })).content[0].text);
    const noFocus2 = JSON.parse((await reg.cb({}, { sessionId: 'sess-347-06-c' })).content[0].text);
    delete noFocus1._meta.legTimingsMs;
    delete noFocus2._meta.legTimingsMs;
    assert.deepStrictEqual(
      noFocus1, noFocus2,
      'two calls with no focus_node_id over the same fixture must be byte-identical (the pre-347-06 response)'
    );
    ok('Test 5: focus_node_id threads through at the wire; omitting it is byte-identical across calls');

    // ---- Test 6: the zod parameter rejects an empty string, so the wire
    // never passes a blank focus into the assembler. Validated against the
    // REAL schema shape the tool registered (reg.schema), not a re-typed
    // copy. ----
    const schema = z.object(reg.schema);
    const emptyResult = schema.safeParse({ focus_node_id: '' });
    assert.equal(emptyResult.success, false, 'focus_node_id: "" must be rejected by the zod schema at the MCP edge');
    const validResult = schema.safeParse({ focus_node_id: 'claim:wire-focus' });
    assert.equal(validResult.success, true, 'a non-empty focus_node_id must be accepted by the same schema');
    const omittedResult = schema.safeParse({});
    assert.equal(omittedResult.success, true, 'omitting focus_node_id entirely must still validate (optional)');
    ok('Test 6: the zod schema rejects an empty-string focus_node_id at the MCP edge');

    cleanupDir(tmpDir);
  }

  console.log(checks + ' checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL test-347-context-focus: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
