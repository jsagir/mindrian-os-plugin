#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 04 (AN-01, amendment 9): a successful governed filing whose section job does not resolve returns a
 * TYPED anchor_edge, never null.
 *
 * WHY. Lawrence's live reproduction on macOS: artifact_file and claim_write returned anchor_edge null when the
 * filing section carried no resolvable job, so a report of a state carried no marker of the gap. The minimum rule
 * (brief section 3): a missing or failed check stays visible downstream.
 *
 * HARNESS. In-process, on the tests/test-248-room-bind-honest-return.cjs fake-server seam: the real tool handlers
 * are registered on a fake server and called directly. The fixture room is born by the isolated-home helper
 * (HOME and MINDRIAN_ROOMS_HOME under a mkdtemp directory) and the session is bound through the shipped room_bind
 * handler (tool-router.cjs), so writes resolve through resolveMcpWriteRoom exactly as in production.
 *
 * Arms:
 *   B1  artifact_file into field-notes (not a canon section)        -> section_job_unresolved / section_job_undeclared
 *   B2  artifact_file with no section at all                        -> section_job_unresolved / no_section
 *   B3  claim_write with focus on a field-notes node (undeclared)   -> same typed anchor_edge
 *   B3b claim_write with no focus at all                            -> section_job_unresolved / no_section
 *   B4  artifact_file whose reasoning-node write is refused         -> no_filed_node (even in a resolved section)
 *   B4b claim_write whose claim write is refused                    -> no_filed_node
 *   B5  artifact_file into problem-definition (job resolves)        -> anchor ok:true, SOURCED_FROM edge in room.db
 *   B5b claim_write with focus on a problem-definition node         -> anchor ok:true
 *   B6  no response above carries anchor_edge null; dash guard
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _config, handler) { tools[name] = handler; },
    // a claude-code client identity so isWritePathEnabled admits the write path (isMcpFirst stays unset)
    server: { getClientVersion() { return { name: 'claude-code', version: '2.1.0' }; }, getClientCapabilities() { return {}; } },
  };
}
function parse(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  if (!text) return null;
  const marker = text.indexOf('\n\n## Suggested Next');
  try { return JSON.parse(marker === -1 ? text : text.slice(0, marker)); } catch (_e) { return null; }
}

const iso = H.mkIsolatedHome('an01');
const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
function restoreEnv() { for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; } }

async function main() {
  const SLUG = 'an01-room';
  const SESSION = 'sess-an01';
  const room = H.birthFixtureRoom({ iso, slug: SLUG, sessionId: 'an01-birth' });
  check('fixture room born under the isolated rooms home', room && room.ok !== false && fs.existsSync(room.roomDir) && room.roomDir.startsWith(iso.roomsHome), JSON.stringify(room && { ok: room.ok, roomDir: room.roomDir }));
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;

  const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const views = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'));
  const claim = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'claim.cjs'));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));

  const server = makeFakeServer();
  const ctx = { fallbackRoomDir: null, surface: 'cli' };
  toolRouter.registerRouterTools(server, path.join(iso.home, 'boot-fallback'), ROOT, { compact: '' }, 'cli');
  views.register(server, ctx);
  claim.register(server, ctx);
  check('room_bind, artifact_file, claim_write handlers registered', ['room_bind', 'artifact_file', 'claim_write'].every((n) => typeof server.tools[n] === 'function'));

  const bound = parse(await server.tools.room_bind({ room: SLUG }, { sessionId: SESSION }));
  check('room_bind binds the session to the fixture room (effective)', !!bound && bound.ok === true && bound.effective === true, JSON.stringify(bound));

  const extra = { sessionId: SESSION };
  const responses = [];
  const call = async (name, args) => { const r = parse(await server.tools[name](args, extra)); responses.push({ name, r }); return r; };

  // ---- B1 -------------------------------------------------------------------------------------------------------
  const b1 = await call('artifact_file', { section: 'field-notes', filename: 'b1-note', content: '---\ntitle: b1\n---\n\nA field note.\n' });
  check('B1 artifact_file into a non-canon section succeeds (ok true)', !!b1 && b1.ok === true, JSON.stringify(b1));
  check('B1 anchor_edge is {ok:false, reason:section_job_unresolved, gate_reason:section_job_undeclared}',
    !!b1 && !!b1.anchor_edge && b1.anchor_edge.ok === false && b1.anchor_edge.reason === 'section_job_unresolved' && b1.anchor_edge.gate_reason === 'section_job_undeclared',
    JSON.stringify(b1 && b1.anchor_edge));

  // ---- B2 -------------------------------------------------------------------------------------------------------
  const b2 = await call('artifact_file', { filename: 'b2-root-note', content: '---\ntitle: b2\n---\n\nA root note.\n' });
  check('B2 artifact_file with no section succeeds (ok true)', !!b2 && b2.ok === true, JSON.stringify(b2));
  check('B2 anchor_edge reason section_job_unresolved, gate_reason no_section',
    !!b2 && !!b2.anchor_edge && b2.anchor_edge.ok === false && b2.anchor_edge.reason === 'section_job_unresolved' && b2.anchor_edge.gate_reason === 'no_section',
    JSON.stringify(b2 && b2.anchor_edge));

  // ---- B3 / B3b -------------------------------------------------------------------------------------------------
  const db = navigation.openRoomDbForCaller(room.roomDir);
  check('room.db opens through the navigation door', !!db);
  try {
    const b3b = await call('claim_write', { knowledge_type: 'fact', text: 'A claim with no focus.', source_segment: 'seg-b3b' });
    check('B3b claim_write with no focus succeeds (ok true)', !!b3b && b3b.ok === true, JSON.stringify(b3b));
    check('B3b anchor_edge reason section_job_unresolved, gate_reason no_section',
      !!b3b && !!b3b.anchor_edge && b3b.anchor_edge.ok === false && b3b.anchor_edge.reason === 'section_job_unresolved' && b3b.anchor_edge.gate_reason === 'no_section',
      JSON.stringify(b3b && b3b.anchor_edge));

    insertNode(db, 'claim:an01-focus-undeclared', 'claim', JSON.stringify({ section: 'field-notes' }), {
      source_path: 'test:an01', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed',
    });
    navigation.setFocus(db, SESSION, 'claim:an01-focus-undeclared', 'user');
    const b3 = await call('claim_write', { knowledge_type: 'fact', text: 'A claim under an undeclared section.', source_segment: 'seg-b3' });
    check('B3 claim_write under an undeclared section succeeds (ok true)', !!b3 && b3.ok === true, JSON.stringify(b3));
    check('B3 anchor_edge is the same typed object (section_job_undeclared)',
      !!b3 && !!b3.anchor_edge && b3.anchor_edge.ok === false && b3.anchor_edge.reason === 'section_job_unresolved' && b3.anchor_edge.gate_reason === 'section_job_undeclared',
      JSON.stringify(b3 && b3.anchor_edge));

    // ---- B4 -----------------------------------------------------------------------------------------------------
    // The cheapest real failure path: insertNode refuses an epistemic_type outside its closed enum, so the shared
    // writer returns reasoning_node_write_failed. The registered handler is called directly (the zod boundary that
    // would stop this value on the wire is bypassed), in a section whose job RESOLVES, so the typed reason must be
    // no_filed_node and not section_job_unresolved or an anchor.
    const b4 = await call('artifact_file', { section: 'problem-definition', filename: 'b4-bad-type', content: '---\ntitle: b4\n---\n\nA refused node.\n', epistemic_type: 'not-a-real-type' });
    check('B4 the file lands but the reasoning node is refused', !!b4 && b4.ok === true && !!b4.reasoning_node && b4.reasoning_node.ok === false, JSON.stringify(b4 && b4.reasoning_node));
    check('B4 anchor_edge is {ok:false, reason:no_filed_node}',
      !!b4 && !!b4.anchor_edge && b4.anchor_edge.ok === false && b4.anchor_edge.reason === 'no_filed_node', JSON.stringify(b4 && b4.anchor_edge));

    const b4b = await call('claim_write', { knowledge_type: 'not-a-real-knowledge-type', text: 'A refused claim.', source_segment: 'seg-b4b' });
    check('B4b claim_write with a refused write is not ok', !!b4b && b4b.ok === false, JSON.stringify(b4b));
    check('B4b anchor_edge is {ok:false, reason:no_filed_node}',
      !!b4b && !!b4b.anchor_edge && b4b.anchor_edge.ok === false && b4b.anchor_edge.reason === 'no_filed_node', JSON.stringify(b4b && b4b.anchor_edge));

    // ---- B5 / B5b: a resolved job anchors exactly as before ----------------------------------------------------
    const b5 = await call('artifact_file', { section: 'problem-definition', filename: 'b5-anchored', content: '---\ntitle: b5\n---\n\nAn anchored filing.\n' });
    check('B5 artifact_file into problem-definition succeeds (ok true)', !!b5 && b5.ok === true, JSON.stringify(b5));
    check('B5 anchor_edge.ok true (the SOURCED_FROM edge was written)', !!b5 && !!b5.anchor_edge && b5.anchor_edge.ok === true, JSON.stringify(b5 && b5.anchor_edge));
    const nodeId = navigation.REASONING_NODE_ID('claim:artifact', b5 && b5.artifact_id);
    const edgeRow = db.prepare("SELECT target FROM edges WHERE source = ? AND type = 'SOURCED_FROM'").get(nodeId);
    check('B5 room.db carries SOURCED_FROM from the filed node to jtbd:find-problem', !!edgeRow && edgeRow.target === 'jtbd:find-problem', JSON.stringify(edgeRow));

    insertNode(db, 'claim:an01-focus-declared', 'claim', JSON.stringify({ section: 'problem-definition' }), {
      source_path: 'test:an01', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed',
    });
    navigation.setFocus(db, SESSION, 'claim:an01-focus-declared', 'user');
    const b5b = await call('claim_write', { knowledge_type: 'fact', text: 'A claim under a resolved section.', source_segment: 'seg-b5b' });
    check('B5b claim_write under a resolved section anchors (anchor_edge.ok true)', !!b5b && b5b.ok === true && !!b5b.anchor_edge && b5b.anchor_edge.ok === true, JSON.stringify(b5b && b5b.anchor_edge));
  } finally {
    navigation.closeRoomDbForCaller(db);
  }

  // ---- B6 -------------------------------------------------------------------------------------------------------
  const nulls = responses.filter((x) => !x.r || x.r.anchor_edge === null || x.r.anchor_edge === undefined);
  check('B6 no response carries anchor_edge null or missing (' + responses.length + ' responses)', nulls.length === 0, JSON.stringify(nulls.map((x) => x.name)));
  const guarded = [__filename, path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'), path.join(ROOT, 'lib', 'mcp', 'tools', 'claim.cjs')];
  const dashHits = H.dashGuard(guarded);
  check('B6 dash guard: no em dash or en dash in the test or the two tool files', dashHits.length === 0, dashHits.join(','));
}

main().then(() => {
  restoreEnv();
  iso.cleanup();
  console.log('');
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => {
  restoreEnv();
  try { iso.cleanup(); } catch (_e) { /* best effort */ }
  console.log('FAIL: test crashed :: ' + String((e && e.stack) || e));
  process.exit(1);
});
