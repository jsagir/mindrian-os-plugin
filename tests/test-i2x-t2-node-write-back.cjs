#!/usr/bin/env node
'use strict';
// Quick task 260903-i2x -- behavioral coverage of T2's node-writing half
// (docs/2026-09-03-CONSTITUTION-v3.1.0-mos-reasoning-constitution.md), all
// three pieces: Task 1's shared writer (lib/core/navigation/reasoning-
// write.cjs), Task 2's two wired call sites (gate_answer's approve branch,
// artifact_file), and Task 3's graph-backed MINTO governing thought with
// fallback (scripts/vault-section-minto-generator.cjs).
//
// Graceful-SKIP-on-missing-module preamble modeled on
// tests/test-h27-gate-card-node-fields.cjs lines 1-40. Node built-in assert
// only, zero npm deps. No em-dashes.
//
// Run: node tests/test-i2x-t2-node-write-back.cjs

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

let navigation;
let edges;
try {
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  edges = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));
} catch (e) {
  console.log('SKIP: test-i2x-t2-node-write-back -- navigation.cjs / edges.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

if (typeof navigation.writeReasoningNode !== 'function') {
  console.log('SKIP: test-i2x-t2-node-write-back -- navigation.writeReasoningNode not exported yet.');
  process.exit(0);
}

let gateTool;
let gateRender;
let gateLedger;
let viewsTool;
let generator;
try {
  gateTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
  gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
  viewsTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'));
  generator = require(path.join(REPO, 'scripts', 'vault-section-minto-generator.cjs'));
} catch (e) {
  console.log('SKIP: test-i2x-t2-node-write-back -- Task 2/3 call-site modules not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
}

// ---------------------------------------------------------------------------
// Fake MCP server, cloned from tests/test-198-contract-schema.test.cjs's
// makeFakeServer idiom (also reused by test-h27 / test-238-one-ledger). No
// elicitation capability -> headless text rung, deterministic.
// ---------------------------------------------------------------------------
function makeFakeServer() {
  const registered = [];
  return {
    tool(name, description, schemaOrHandler, maybeHandler) {
      let schema = {};
      let handler = schemaOrHandler;
      if (typeof maybeHandler === 'function') {
        schema = schemaOrHandler || {};
        handler = maybeHandler;
      }
      registered.push({ name, description, schema, handler });
    },
    _registered: registered,
    server: {
      getClientCapabilities() { return {}; },
    },
  };
}

// ---------------------------------------------------------------------------
// Hermetic scratch room. openRoomDbForCaller (the door the plan names)
// returns null against a bare mkdtemp dir with no .mindrian/room.db yet
// (it deliberately never births a room -- see spine-events.cjs:362-370), so
// this birth step (mirroring tests/test-238-one-ledger.cjs's own precedent)
// creates the room ONCE via room-db.cjs directly (tests/ is exempt from the
// substrate guard, /^tests\// in scripts/check-substrate.cjs's own
// allow-list), closes that handle, then re-opens through the REAL
// navigation.openRoomDbForCaller chokepoint for every assertion below --
// so the actual db access this test exercises IS through the one door.
// ---------------------------------------------------------------------------
const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i2x-'));
const birthHandle = roomDbMod.openRoomDb(roomDir);
roomDbMod.closeRoomDb(birthHandle);

const db = navigation.openRoomDbForCaller(roomDir);
if (!db) {
  console.log('SKIP: test-i2x-t2-node-write-back -- openRoomDbForCaller returned null for a birthed room; cannot exercise a real room.db.');
  fs.rmSync(roomDir, { recursive: true, force: true });
  process.exit(0);
}

// Deterministic session-key parity between mint (this file, sessionId
// undefined) and consume (the registered handler, resolveEffectiveSessionId
// reading extra.sessionId then this env var) -- mirrors
// tests/test-238-one-ledger.cjs's own precedent. Without this, an ambient
// CLAUDE_CODE_SESSION_ID (real inside a live Claude Code session) makes the
// handler resolve a non-null session id while every _mintLiveGate call
// below mints under the null-session sentinel, and every gate_answer here
// would fail with session_mismatch.
const _previousSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_CODE_SESSION_ID;

// CRITICAL isolation guard (also mirrors test-238-one-ledger.cjs's own
// precedent). ctx.fallbackRoomDir is only the LAST-RESORT floor inside
// resolveSessionRoom's read leg (lib/mcp/session-room.cjs:98-104) -- when a
// real ~/MindrianRooms/.rooms/registry.json exists with an "active" room
// (true on any machine that has ever used MindrianOS for real), the
// registry hit wins BEFORE the fallback is ever consulted, so gate_answer's
// real handler would silently write this test's fixture nodes into the
// USER'S REAL ACTIVE ROOM instead of this scratch dir. Setting
// CLAUDE_ACTIVE_ROOM pins resolution to this scratch dir regardless of any
// real registry on the host running this test.
const _previousActiveRoomEnv = process.env.CLAUDE_ACTIVE_ROOM;
process.env.CLAUDE_ACTIVE_ROOM = roomDir;

function nodeRow(id) {
  return db.prepare('SELECT id, type, properties, review_status, confidence FROM nodes WHERE id = ?').get(id);
}

function edgeRows(sourceId, edgeType) {
  return db.prepare('SELECT source, target, type, properties FROM edges WHERE source = ? AND type = ?').all(sourceId, edgeType);
}

async function main() {
  // ===========================================================================
  // Task 1: lib/core/navigation/reasoning-write.cjs (+ the USES_FRAMEWORK mint)
  // ===========================================================================

  check('ALLOWED_EDGE_TYPES contains USES_FRAMEWORK', edges.ALLOWED_EDGE_TYPES.has('USES_FRAMEWORK'));
  check('ALLOWED_EDGE_TYPES floor: SOURCED_FROM still present', edges.ALLOWED_EDGE_TYPES.has('SOURCED_FROM'));
  check('ALLOWED_EDGE_TYPES floor: DEFERRED still present', edges.ALLOWED_EDGE_TYPES.has('DEFERRED'));
  check('ALLOWED_EDGE_TYPES floor: REJECTED still present', edges.ALLOWED_EDGE_TYPES.has('REJECTED'));

  {
    const r = edges.writeEdge(db, { source_id: 'i2x:t1:a', target_id: 'i2x:t1:b', edge_type: 'USES_FRAMEWORK', properties: {} });
    check('writeEdge(USES_FRAMEWORK) returns ok:true (T1 mint verified live, not just Set membership)', r.ok === true);
  }

  {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g1', nodeType: 'decision', epistemicType: 'decision', text: 'Approve X',
    });
    check('writeReasoningNode basic call: ok:true', r.ok === true);
    check('writeReasoningNode basic call: node_id echoed', r.node_id === 'decision:gate:g1');
    check('writeReasoningNode basic call: edges_written 0', r.edges_written === 0);
    const row = nodeRow('decision:gate:g1');
    check('basic call: node exists in nodes table', !!row);
    check('basic call: type is decision', row && row.type === 'decision');
    const props = row ? JSON.parse(row.properties) : {};
    check('basic call: epistemic_type is decision', props.epistemic_type === 'decision');
    check('basic call: review_status is proposed', row && row.review_status === 'proposed');
  }

  {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g2', nodeType: 'decision', epistemicType: 'decision', text: 'Approve Y',
      subjectNodeId: 'i2x:n0', evidenceNodeIds: ['i2x:n1', 'i2x:n2'],
    });
    check('subject + 2 evidence: edges_written 3', r.edges_written === 3);
    const rows = edgeRows('decision:gate:g2', 'SOURCED_FROM');
    check('subject + 2 evidence: exactly 3 SOURCED_FROM edges in db', rows.length === 3);
    const targets = rows.map((x) => x.target).sort();
    check('subject + 2 evidence: targets are n0/n1/n2', JSON.stringify(targets) === JSON.stringify(['i2x:n0', 'i2x:n1', 'i2x:n2']));
  }

  {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g3', nodeType: 'decision', epistemicType: 'decision', text: 'Approve Z',
      subjectNodeId: 'i2x:dup', evidenceNodeIds: ['i2x:dup', 'i2x:other'],
    });
    check('subjectNodeId duplicated in evidenceNodeIds: edges_written 2 (dup collapses to 1)', r.edges_written === 2);
    const rows = edgeRows('decision:gate:g3', 'SOURCED_FROM');
    check('subjectNodeId dup: exactly 2 SOURCED_FROM rows in db', rows.length === 2);
  }

  {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g4', nodeType: 'decision', epistemicType: 'decision', text: 'Approve W',
      framework: 'Jobs to be Done',
    });
    check('framework adds 1 edge: edges_written 1', r.edges_written === 1);
    check('framework adds 1 edge: framework_edge true', r.framework_edge === true);
    const rows = edgeRows('decision:gate:g4', 'USES_FRAMEWORK');
    check('framework: exactly 1 USES_FRAMEWORK row in db', rows.length === 1);
    check('framework: target is framework:jobs-to-be-done', rows[0] && rows[0].target === 'framework:jobs-to-be-done');
  }

  for (const bad of ['', null, 42, {}]) {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g5-' + JSON.stringify(bad), nodeType: 'decision', epistemicType: 'decision', text: 'x',
      framework: bad,
    });
    check('framework=' + JSON.stringify(bad) + ' writes zero USES_FRAMEWORK edges, no error', r.ok === true && r.framework_edge === false);
  }

  {
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'decision:gate:g6', nodeType: 'decision', epistemicType: 'not-a-real-type', text: 'x',
    });
    check('invalid epistemicType: ok:false', r.ok === false);
    check('invalid epistemicType: reason reasoning_node_write_failed', r.reason === 'reasoning_node_write_failed');
  }

  for (const bad of [undefined, null, '', 42, {}]) {
    const r = navigation.writeReasoningNode(db, {
      nodeId: bad, nodeType: 'decision', epistemicType: 'decision', text: 'x',
    });
    check('nodeId=' + JSON.stringify(bad) + ': ok:false invalid_node_id', r.ok === false && r.reason === 'invalid_node_id');
  }

  console.log('PASS (Task 1): reasoning-write.cjs + USES_FRAMEWORK -- ' + passed + ' assertions so far');

  // ===========================================================================
  // Task 2: gate_answer approve branch + artifact_file wiring
  // ===========================================================================

  // --- gate_answer, approve, with subject/evidence node ids on the card ---
  {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateTool.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');
    check('gate_answer tool registered', !!gateAnswerEntry);

    const gateId = 'i2x-gate-approve-with-ids';
    const card = gateRender.normalizeCard({
      gate_id: gateId,
      header: 'Approve the plan?',
      options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }],
      subject_node_id: 'i2x:subj-1',
      evidence_node_ids: ['i2x:ev-1', 'i2x:ev-2'],
    });
    gateTool._internal._mintLiveGate(gateId, card, undefined);

    const res = await gateAnswerEntry.handler({ gate_id: gateId, chosen: ['approve'], verdict: 'approve' }, {});
    const parsed = JSON.parse(res.content[0].text);
    check('gate_answer approve: ok:true', parsed.ok === true);
    check('gate_answer approve: memory_event field still present (bookkeeping unchanged)', !!parsed.memory_event);
    check('gate_answer approve: reasoning_node field present', !!parsed.reasoning_node);
    check('gate_answer approve: reasoning_node.ok true', parsed.reasoning_node && parsed.reasoning_node.ok === true);

    const decisionNodeId = navigation.REASONING_NODE_ID('decision:gate', gateId);
    const row = nodeRow(decisionNodeId);
    check('gate approve: decision node landed in nodes table', !!row);
    check('gate approve: decision node type is decision', row && row.type === 'decision');
    const props = row ? JSON.parse(row.properties) : {};
    check('gate approve: decision node epistemic_type is decision', props.epistemic_type === 'decision');
    const sourcedRows = edgeRows(decisionNodeId, 'SOURCED_FROM');
    check('gate approve: 3 SOURCED_FROM edges (1 subject + 2 evidence)', sourcedRows.length === 3);
    const sourcedTargets = sourcedRows.map((x) => x.target).sort();
    check('gate approve: SOURCED_FROM targets are exactly subj-1/ev-1/ev-2', JSON.stringify(sourcedTargets) === JSON.stringify(['i2x:ev-1', 'i2x:ev-2', 'i2x:subj-1']));
    check('gate approve: review_status promoted to confirmed via confirmNode (DC-4)', row && row.review_status === 'confirmed');
    check('gate approve: response.reasoning_node.confirmed is true', parsed.reasoning_node.confirmed === true);
  }

  // --- gate_answer, approve, card carries NO node ids: zero edges, still ok ---
  {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateTool.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');

    const gateId = 'i2x-gate-approve-no-ids';
    const card = gateRender.normalizeCard({
      gate_id: gateId,
      header: 'Approve with nothing?',
      options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }],
    });
    gateTool._internal._mintLiveGate(gateId, card, undefined);

    const res = await gateAnswerEntry.handler({ gate_id: gateId, chosen: ['approve'], verdict: 'approve' }, {});
    const parsed = JSON.parse(res.content[0].text);
    check('gate_answer approve, no card ids: ok:true', parsed.ok === true);
    const decisionNodeId = navigation.REASONING_NODE_ID('decision:gate', gateId);
    const row = nodeRow(decisionNodeId);
    check('gate approve, no ids: node still written', !!row);
    const sourcedRows = edgeRows(decisionNodeId, 'SOURCED_FROM');
    check('gate approve, no ids: zero SOURCED_FROM edges', sourcedRows.length === 0);
  }

  // --- gate_answer, reject verdict: NO reasoning node, NO edges ---
  {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateTool.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');

    const gateId = 'i2x-gate-reject';
    const card = gateRender.normalizeCard({
      gate_id: gateId,
      header: 'Reject this?',
      options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }],
      subject_node_id: 'i2x:reject-subj',
    });
    gateTool._internal._mintLiveGate(gateId, card, undefined);

    const res = await gateAnswerEntry.handler({ gate_id: gateId, chosen: ['reject'], verdict: 'reject' }, {});
    const parsed = JSON.parse(res.content[0].text);
    check('gate_answer reject: ratified false', parsed.ratified === false);
    check('gate_answer reject: no reasoning_node field', parsed.reasoning_node === undefined);
    const decisionNodeId = navigation.REASONING_NODE_ID('decision:gate', gateId);
    const row = nodeRow(decisionNodeId);
    check('gate reject: NO decision node written', !row);
  }

  // --- gate_answer, defer verdict: same as reject, no write ---
  {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateTool.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');

    const gateId = 'i2x-gate-defer';
    const card = gateRender.normalizeCard({
      gate_id: gateId,
      header: 'Defer this?',
      options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'defer', label: 'Defer' }],
    });
    gateTool._internal._mintLiveGate(gateId, card, undefined);

    const res = await gateAnswerEntry.handler({ gate_id: gateId, chosen: ['defer'], verdict: 'defer' }, {});
    const parsed = JSON.parse(res.content[0].text);
    check('gate_answer defer: ratified false', parsed.ratified === false);
    const decisionNodeId = navigation.REASONING_NODE_ID('decision:gate', gateId);
    const row = nodeRow(decisionNodeId);
    check('gate defer: NO decision node written', !row);
  }

  // --- gate_answer, approve, material_step halt carrying haltedStep.framework ---
  // Route used: the direct-mint route (gate.cjs._internal._mintLiveGate +
  // a direct mutation of the stored ledger entry to attach haltedStep), NOT
  // a real chain.chainRun halt. This is the plan's own named fallback route
  // and is deliberately simpler/more deterministic for isolated node+edge
  // assertions -- tests/test-238-one-ledger.cjs already proves the REAL
  // chain.cjs-to-gate.cjs integration end to end (a chain-minted gate id
  // consumed by gate_answer, haltedStep threaded, the step actually
  // executed), so this file does not duplicate that proof; it isolates the
  // ONE new thing this task adds: does live.haltedStep.framework reach a
  // USES_FRAMEWORK edge.
  {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateTool.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');

    const gateId = 'i2x-gate-material-step-framework';
    const card = gateRender.normalizeCard({
      gate_id: gateId,
      header: 'Confirm material step: scqa',
      kind: 'general',
      options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'defer', label: 'Defer' }],
    });
    gateTool._internal._mintLiveGate(gateId, card, undefined);
    // Direct ledger mutation: attach haltedStep the way chain.cjs's own
    // resumeEntry does (chain.cjs:350-351), without driving a real chain
    // halt (kind stays 'general' so the material_step resume block does not
    // also try to call a resumeFn this fixture never minted).
    gateTool._internal._liveGates.get(gateId).haltedStep = { framework: 'scqa' };

    const res = await gateAnswerEntry.handler({ gate_id: gateId, chosen: ['approve'], verdict: 'approve' }, {});
    const parsed = JSON.parse(res.content[0].text);
    check('gate_answer approve, material_step framework: ok:true', parsed.ok === true);
    const decisionNodeId = navigation.REASONING_NODE_ID('decision:gate', gateId);
    const frameworkRows = edgeRows(decisionNodeId, 'USES_FRAMEWORK');
    check('gate approve, haltedStep.framework=scqa: exactly 1 USES_FRAMEWORK edge', frameworkRows.length === 1);
    check('gate approve, haltedStep.framework=scqa: target is framework:scqa', frameworkRows[0] && frameworkRows[0].target === 'framework:scqa');
  }

  // --- fileArtifact: epistemic_type override + default ---
  {
    const section = 'i2x-artifacts';
    const content1 = '---\ntitle: doc\n---\n\nThe market is consolidating.\n';
    const r1 = viewsTool._internal.fileArtifact(db, roomDir, {
      section, filename: 'doc-hypothesis.md', content: content1, epistemicType: 'hypothesis',
    });
    check('fileArtifact: ok:true (hypothesis)', r1.ok === true);
    check('fileArtifact: reasoning_node present (hypothesis)', !!r1.reasoning_node);
    check('fileArtifact: reasoning_node ok:true (hypothesis)', r1.reasoning_node && r1.reasoning_node.ok === true);
    const nodeId1 = navigation.REASONING_NODE_ID('claim:artifact', r1.artifact_id);
    const row1 = nodeRow(nodeId1);
    check('fileArtifact: node written with epistemic_type hypothesis', row1 && JSON.parse(row1.properties).epistemic_type === 'hypothesis');
    check('fileArtifact: text captured from first body line', row1 && JSON.parse(row1.properties).text === 'The market is consolidating.');
    check('fileArtifact: node stays proposed (no confirmNode promotion, DC-4)', row1 && row1.review_status === 'proposed');

    const content2 = '---\ntitle: doc2\n---\n\nAnother real claim line.\n';
    const r2 = viewsTool._internal.fileArtifact(db, roomDir, {
      section, filename: 'doc-default.md', content: content2,
    });
    check('fileArtifact: ok:true (default epistemic_type)', r2.ok === true);
    const nodeId2 = navigation.REASONING_NODE_ID('claim:artifact', r2.artifact_id);
    const row2 = nodeRow(nodeId2);
    check('fileArtifact: default epistemic_type is conclusion', row2 && JSON.parse(row2.properties).epistemic_type === 'conclusion');

    const content3 = '---\ntitle: doc3\n---\n\n# Just a heading\n<!-- a comment -->\n> a quote\n';
    const r3 = viewsTool._internal.fileArtifact(db, roomDir, {
      section, filename: 'doc-empty-body.md', content: content3,
    });
    check('fileArtifact: ok:true (no usable body line)', r3.ok === true);
    const nodeId3 = navigation.REASONING_NODE_ID('claim:artifact', r3.artifact_id);
    const row3 = nodeRow(nodeId3);
    check('fileArtifact: node still written when body line is unusable', !!row3);
    check('fileArtifact: text is empty string when no usable body line', row3 && JSON.parse(row3.properties).text === '');
  }

  // --- fileArtifact: artifactId falsy -> no node written (structural floor) ---
  // computeArtifactId (lib/core/artifact-id.cjs) never throws for a string
  // input, so a naturally null artifactId is not reachable through normal
  // fileArtifact calls -- the guard is a structural floor, not a commonly
  // exercised branch. Asserted here as a source-level check (grep) rather
  // than a forced-null integration path, documented honestly in the SUMMARY.
  {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'), 'utf8');
    check('views.cjs guards the reasoning-node write behind a truthy artifactId check', /if\s*\(\s*artifactId\s*\)/.test(src));
  }

  console.log('PASS (Task 2): gate_answer + artifact_file wiring -- ' + passed + ' assertions so far');

  // ===========================================================================
  // Task 3: MINTO.md governing thought reads real nodes, with a fallback
  // ===========================================================================

  {
    const sectionSlug = 'i2x-minto-section';
    const sectionStub = { name: sectionSlug, parentRoomDir: roomDir, dir: path.join(roomDir, sectionSlug) };

    // No node yet: byte-identical fallback template.
    const before = generator.deriveGoverningThought(sectionStub, [{}, {}]);
    check('Task 3: no matching node -> exact fallback template', before === 'I2x Minto Section synthesizes 2 artifacts into a coherent argument for this section of the venture.');

    // Write a real conclusion node via the Task 1 writer, section-scoped.
    const r = navigation.writeReasoningNode(db, {
      nodeId: 'claim:artifact:i2x-minto-fixture-1',
      nodeType: 'claim',
      epistemicType: 'conclusion',
      text: 'The venture has found product-market fit in this section.',
      section: sectionSlug,
      origin: 'test-fixture',
    });
    check('Task 3 fixture: writeReasoningNode ok:true', r.ok === true);

    const after = generator.deriveGoverningThought(sectionStub, [{}, {}]);
    check('Task 3: matching conclusion node -> real node text returned', after === 'The venture has found product-market fit in this section.');

    // Two candidates in a FRESH section (isolated from the fixture-1 node
    // above, which already carries confidence 1.0 in sectionSlug and would
    // otherwise always win): higher confidence wins.
    const sectionSlugConf = 'i2x-minto-section-confidence';
    const nodeInsertMod = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
    nodeInsertMod.insertNode(db, 'claim:artifact:i2x-minto-fixture-lowconf', 'claim',
      JSON.stringify({ text: 'Lower confidence candidate.', section: sectionSlugConf }),
      { source_path: 'test:i2x', created_by: 'system', confidence: 0.2, review_status: 'proposed', epistemic_type: 'conclusion' });
    nodeInsertMod.insertNode(db, 'claim:artifact:i2x-minto-fixture-highconf', 'claim',
      JSON.stringify({ text: 'Higher confidence candidate.', section: sectionSlugConf }),
      { source_path: 'test:i2x', created_by: 'system', confidence: 0.9, review_status: 'proposed', epistemic_type: 'conclusion' });
    const winner = generator.readGoverningThoughtFromGraph(roomDir, sectionSlugConf);
    check('Task 3: higher-confidence candidate wins', winner === 'Higher confidence candidate.');

    // hypothesis / observation epistemic types are never selected.
    const sectionSlug2 = 'i2x-minto-section-2';
    nodeInsertMod.insertNode(db, 'claim:artifact:i2x-minto-hyp', 'claim',
      JSON.stringify({ text: 'A hypothesis, should never be selected.', section: sectionSlug2 }),
      { source_path: 'test:i2x', created_by: 'system', confidence: 1.0, review_status: 'proposed', epistemic_type: 'hypothesis' });
    nodeInsertMod.insertNode(db, 'claim:artifact:i2x-minto-obs', 'claim',
      JSON.stringify({ text: 'An observation, should never be selected.', section: sectionSlug2 }),
      { source_path: 'test:i2x', created_by: 'system', confidence: 1.0, review_status: 'proposed', epistemic_type: 'observation' });
    const noneSelected = generator.readGoverningThoughtFromGraph(roomDir, sectionSlug2);
    check('Task 3: hypothesis/observation nodes never selected -> null', noneSelected === null);
    const fallback2 = generator.deriveGoverningThought({ name: sectionSlug2, parentRoomDir: roomDir }, [{}]);
    check('Task 3: with only hypothesis/observation present, generator falls back to template', fallback2 === 'I2x Minto Section 2 synthesizes 1 artifact into a coherent argument for this section of the venture.');

    // Empty-text conclusion node is never selected.
    const sectionSlug3 = 'i2x-minto-section-3';
    nodeInsertMod.insertNode(db, 'claim:artifact:i2x-minto-empty', 'claim',
      JSON.stringify({ text: '', section: sectionSlug3 }),
      { source_path: 'test:i2x', created_by: 'system', confidence: 1.0, review_status: 'proposed', epistemic_type: 'conclusion' });
    const emptyTextResult = generator.readGoverningThoughtFromGraph(roomDir, sectionSlug3);
    check('Task 3: empty-text conclusion node is never selected -> null', emptyTextResult === null);

    // A node reachable only via SOURCED_FROM to an Artifact node in-section.
    const sectionSlug4 = 'i2x-minto-section-4';
    nodeInsertMod.insertNode(db, 'i2x-artifact-node-4', 'Artifact',
      JSON.stringify({ section: sectionSlug4 }),
      { source_path: 'test:i2x', created_by: 'system', epistemic_type: 'observation' });
    const viaEdgeResult = navigation.writeReasoningNode(db, {
      nodeId: 'claim:artifact:i2x-minto-via-edge',
      nodeType: 'claim',
      epistemicType: 'conclusion',
      text: 'Reached only via a SOURCED_FROM edge to an in-section Artifact.',
      subjectNodeId: 'i2x-artifact-node-4',
      origin: 'test-fixture',
    });
    check('Task 3 fixture: SOURCED_FROM-only node written ok:true', viaEdgeResult.ok === true);
    const viaEdgeSelected = generator.readGoverningThoughtFromGraph(roomDir, sectionSlug4);
    check('Task 3: node reachable only via SOURCED_FROM to an in-section Artifact is still selected', viaEdgeSelected === 'Reached only via a SOURCED_FROM edge to an in-section Artifact.');

    // No room.db at all: fallback, no throw.
    const noDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i2x-no-db-'));
    let threw = false;
    let noDbResult;
    try {
      noDbResult = generator.readGoverningThoughtFromGraph(noDbDir, 'anything');
    } catch (_e) {
      threw = true;
    }
    check('Task 3: no room.db at all -> null, never throws', threw === false && noDbResult === null);
    const noDbFallback = generator.deriveGoverningThought({ name: 'anything', parentRoomDir: noDbDir }, [{}, {}, {}]);
    check('Task 3: no room.db -> deriveGoverningThought still returns the fallback template', noDbFallback === 'Anything synthesizes 3 artifacts into a coherent argument for this section of the venture.');
    fs.rmSync(noDbDir, { recursive: true, force: true });
  }

  console.log('PASS (Task 3): MINTO.md governing-thought graph read + fallback -- ' + passed + ' assertions so far');

  console.log('PASS: test-i2x-t2-node-write-back (' + passed + ' assertions total)');
}

function restoreSessionEnv() {
  if (_previousSessionEnv === undefined) {
    delete process.env.CLAUDE_CODE_SESSION_ID;
  } else {
    process.env.CLAUDE_CODE_SESSION_ID = _previousSessionEnv;
  }
  if (_previousActiveRoomEnv === undefined) {
    delete process.env.CLAUDE_ACTIVE_ROOM;
  } else {
    process.env.CLAUDE_ACTIVE_ROOM = _previousActiveRoomEnv;
  }
}

main()
  .then(() => {
    navigation.closeRoomDbForCaller(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
    restoreSessionEnv();
    process.exit(0);
  })
  .catch((e) => {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* tolerant */ }
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
    restoreSessionEnv();
    console.error('FAIL: test-i2x-t2-node-write-back');
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
