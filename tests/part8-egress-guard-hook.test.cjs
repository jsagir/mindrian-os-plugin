#!/usr/bin/env node
// Phase 196 -- part8-egress-guard-hook stdin -> exit-code test (PB8-04/05/07/08).
//
// WAVE 0 CONTRACT: authored before the hook lands (Nyquist). It checks for
// scripts/part8-egress-guard-hook.cjs; while absent it prints SKIP and exits 0.
// The F.1-gate and Brain-less-degrade legs are FURTHER guarded behind the gate
// module (lib/hmi/part8-egress-gate.cjs, lands 196-05) so they stay SKIP-safe
// until their surface exists.
//
// Hook contract (RESEARCH / write-scope-check clone):
//   - non-Brain-shaped tool_name     -> exit 0 (passthrough, isBrainShapedTool recheck)
//   - foreign Brain-shaped server name -> SCRUTINIZED, not trusted (threat T3,
//     Phase 239, widened by quick task 260906-gr1): reaches classify(), so it
//     blocks on CONTENT-SET exactly like the real Brain door would, while
//     isBrainTool on that same name still stays false (never trusted).
//   - foreign, non-Brain-shaped server name -> exit 0 (passthrough, T-gr1-04:
//     the guard stays Brain-specific, not a general MCP egress firewall)
//   - verdict block (CONTENT-SET)    -> exit 2 + Part 8 stderr message (PB8-04)
//   - clean MOVE-SET                 -> exit 0 (PB8-04)
//   - malformed/garbage stdin        -> exit 0 fail-OPEN (A3 accepted risk)
//   - 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by content, never ambiguous.
//     A plain methodology string is allow (exit 0 on every scope); a string
//     with room content is block (exit 2 on every scope). Only a payload that
//     is NOT a free-form string stays ambiguous: an unproven MOVE-SET packet
//     (class unproven_packet) or an unknown payload shape (class unknown).
//   - ambiguous (unknown) + TRUSTED shim-backed scope -> exit 0, proceeds to
//     the shim (quick task 260917-dgf; was exit 2 after rendering the F.1
//     gate, PB8-07). A PreToolUse hook cannot render the card anyway; the
//     disclosure now lives at lib/core/brain-client.cjs::callTool.
//   - ambiguous (unproven_packet) + Brain available -> exit 2 with the F.1 gate
//   - ambiguous + Brain-less         -> exit 0, LOCAL-log only, no gate (PB8-08, D-08a)
//
// Test seam for the isAvailable branch: the hook honors PART8_FORCE_BRAIN_AVAILABLE
// ('1' -> available, '0' -> Brain-less) so the ambiguous branch is deterministically
// exercisable without a live Brain wire. This env override is test-only.
//
// Phase 239 (BRAIN-01) bare-vs-scoped decision rule: this file drives the HOOK
// SCRIPT over stdin, which calls sanitizer.isBrainShapedTool(toolName) (widened
// by quick task 260906-gr1; was isBrainTool) BEFORE ever calling classify()
// (see scripts/part8-egress-guard-hook.cjs:151), so every tool_name fixture
// below that is meant to be RECOGNIZED as the Brain door must be a live
// SCOPED name -- the bare form fails isBrainShapedTool and the hook allow()s
// before classify() ever runs. Every live scoped name is DERIVED at run time
// from scripts/check-brain-tool-liveness.cjs's enumerateLiveBrainTools() +
// composeScopedNames(), never hand-typed (RESEARCH.md Pitfall 5). The only
// hand-typed literals are the DELIBERATE negative fixtures for threat T3 (a
// foreign server name that must never resolve as TRUSTED, even though a
// Brain-shaped one is now scrutinized).
//
// Zero-dep: child_process spawnSync with a JSON stdin envelope. CJS only. No em-dashes.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const GATE = path.join(ROOT, 'lib', 'hmi', 'part8-egress-gate.cjs');

if (!fs.existsSync(HOOK)) {
  console.log('SKIP: scripts/part8-egress-guard-hook.cjs not present (Wave 0) -- inert until 196-04 lands the hook');
  process.exit(0);
}

// Run the hook with a stdin string and optional extra env; return { status, stderr }.
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

function envelope(obj) { return JSON.stringify(obj); }

// ---------------------------------------------------------------------------
// 369.2-07 (CODE-07, 2026-10-05): the plain-question-green and the
// room-content-red legs. A free-form Theo string is allow or block by content,
// never ambiguous. The room fixture is built through lib/core/navigation.cjs
// (never raw SQL) under os.tmpdir(); the lexicon term is invented, so only the
// bound-room lexicon can block it. legs369207 returns [ok, message] pairs so
// each suite reports through its own assertion style.
// ---------------------------------------------------------------------------
const PLAIN_QUESTION_369207 = 'How do I decide which customer segment to pursue first?';
const ROOM_TERM_369207 = 'solar cold locker';
const ROOM_QUESTION_369207 = 'How should I validate the ' + ROOM_TERM_369207 + ' with resellers?';
const CANARY_369207 = 'CANARY7F3A2B';

function buildLexiconRoom369207() {
  const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
  const nav = require('../lib/core/navigation.cjs');
  const roomDbMod = require('../lib/core/room-db.cjs');
  const room = buildRoom363({});
  const db = roomDbMod.openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const w = nav.writeEntityNode(db, { entityType: 'technology', name: ROOM_TERM_369207, sessionId: 's3692-07' });
    if (!w || w.ok !== true) throw new Error('369.2-07 fixture: writeEntityNode failed ' + JSON.stringify(w));
  } finally {
    roomDbMod.closeRoomDb(db);
  }
  return room;
}

function spawnHook369207(hookPath, toolName, question, roomDir) {
  const env = Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
  delete env.CLAUDE_ACTIVE_ROOM;
  if (roomDir) env.CLAUDE_ACTIVE_ROOM = roomDir;
  const r = require('node:child_process').spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { question: question }, session_id: 't3692-07', cwd: roomDir || process.cwd() }),
    env: env,
    encoding: 'utf8',
    timeout: 8000,
  });
  return { status: r.status, stderr: r.stderr || '' };
}

function legs369207(guard, hookPath, askTool) {
  const out = [];
  function t(cond, msg) { out.push([!!cond, msg]); }
  const room = buildLexiconRoom369207();
  try {
    // plain methodology question allowed (369.2 CODE-07)
    const plain = guard.classify({ question: PLAIN_QUESTION_369207 }, { toolName: askTool });
    t(plain && plain.verdict === 'allow' && (plain.class === 'typed_question' || plain.class === 'generic_question'),
      'plain methodology question allowed (369.2 CODE-07): classify got ' + JSON.stringify(plain));
    const plainHook = spawnHook369207(hookPath, askTool, PLAIN_QUESTION_369207, null);
    t(plainHook.status === 0,
      'plain methodology question allowed (369.2 CODE-07): hook exit 0, got ' + plainHook.status + ' stderr=' + JSON.stringify(plainHook.stderr));

    // room content blocked (369.2 CODE-07)
    const roomV = guard.classify({ question: ROOM_QUESTION_369207 }, { toolName: askTool, roomDir: room.roomDir });
    t(roomV && roomV.verdict === 'block' && roomV.class === 'room_content' && roomV.token_class === 'room_term',
      'room content blocked (369.2 CODE-07): bound-room term must block room_content/room_term, got ' + JSON.stringify(roomV));
    const roomHook = spawnHook369207(hookPath, askTool, ROOM_QUESTION_369207, room.roomDir);
    t(roomHook.status === 2 && roomHook.stderr.trim().length > 0,
      'room content blocked (369.2 CODE-07): hook exit 2 with stderr, got ' + roomHook.status + ' stderr=' + JSON.stringify(roomHook.stderr));
    t(roomHook.stderr.toLowerCase().indexOf(ROOM_TERM_369207) === -1,
      'room content blocked (369.2 CODE-07): the refusal must not echo the room term, got ' + JSON.stringify(roomHook.stderr));
    const canaryQ = 'Which framework fits ' + CANARY_369207 + '?';
    const canaryV = guard.classify({ question: canaryQ }, { toolName: askTool, roomDir: null });
    t(canaryV && canaryV.verdict === 'block' && canaryV.token_class === 'identifier',
      'room content blocked (369.2 CODE-07): ' + CANARY_369207 + ' must block with token_class identifier, got ' + JSON.stringify(canaryV));
    const canaryHook = spawnHook369207(hookPath, askTool, canaryQ, null);
    t(canaryHook.status === 2, 'room content blocked (369.2 CODE-07): ' + CANARY_369207 + ' hook exit 2, got ' + canaryHook.status);
  } finally {
    room.cleanup();
  }
  return out;
}


async function main() {
  // ---------------------------------------------------------------------
  // Derive live scoped Brain tool names from the same authority Phase 239's
  // acceptance criteria demand (scripts/check-brain-tool-liveness.cjs's real
  // stdio tools/list handshake), never hand-typed.
  // ---------------------------------------------------------------------
  const liveness = require('../scripts/check-brain-tool-liveness.cjs');
  const enumeration = await liveness.enumerateLiveBrainTools();
  assert.ok(
    enumeration.names && enumeration.names.length > 0,
    'setup: enumerateLiveBrainTools must return at least one live bare tool name'
  );
  const pluginName = liveness.resolvePluginName();
  const serverName = liveness.resolveServerName();
  const allScoped = liveness.composeScopedNames(enumeration.names, pluginName, serverName);

  function findScopedContaining(bareSubstr) {
    const hit = allScoped.find(function (n) {
      return n.indexOf('mcp__plugin_') === 0 && n.indexOf(bareSubstr) !== -1;
    });
    assert.ok(hit, 'setup: no live plugin-scoped name found containing "' + bareSubstr + '"');
    return hit;
  }

  // brain_query / brain_ask are the two bare names classify()'s
  // _isFreeFormTool substring check keys on (lib/core/part8-egress-guard.cjs).
  const QUERY_TOOL_NAME = findScopedContaining('brain_query');
  const ASK_TOOL_NAME = findScopedContaining('brain_ask');

  // Envelope shape (brain-response-sanitize-hook / part8-egress-guard-hook):
  // { tool_name, tool_input, session_id }.
  const CONTENT_SET = envelope({
    tool_name: QUERY_TOOL_NAME,
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 's1',
  });
  const CLEAN_MOVE_SET = envelope({
    tool_name: QUERY_TOOL_NAME,
    tool_input: {
      packet_version: '1.0',
      job: 'select_methodology',
      privacy_mode: 'strict',
      local_graph_summary: { nodes: [{ summary: 'sha256:' + 'a'.repeat(64) }] },
    },
    session_id: 's2',
  });
  const NON_BRAIN = envelope({ tool_name: 'Write', tool_input: { path: 'x.md' }, session_id: 's3' });
  const GARBAGE = 'this is not json at all }{';
  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by content, never ambiguous.
  // History: AMBIGUOUS used to be a free-form string, 'opaque blob with no
  // clear content and no proven move-set shape' (class freeform_unmatched).
  // That string is now a plain methodology string with no room-local token, so
  // the hook allows it (PLAIN_STRING). The ambiguous branch is exercised on
  // payloads that are still ambiguous: an unknown payload shape on a
  // shim-backed scope (AMBIGUOUS_UNKNOWN, class unknown) and an unproven
  // MOVE-SET packet (AMBIGUOUS_PACKET, class unproven_packet).
  const PLAIN_STRING = envelope({
    tool_name: ASK_TOOL_NAME,
    tool_input: { question: 'opaque blob with no clear content and no proven move-set shape' },
    session_id: 's4',
  });
  const AMBIGUOUS_UNKNOWN = envelope({
    tool_name: ASK_TOOL_NAME,
    tool_input: { a: 1 },
    session_id: 's4u',
  });
  const AMBIGUOUS_PACKET = envelope({
    tool_name: ASK_TOOL_NAME,
    tool_input: { packet_version: '1.0', job: 'not_a_shipped_job', summary: 'raw prose' },
    session_id: 's4p',
  });
  // Threat T3 (Phase 239, widened by quick task 260906-gr1): DELIBERATE
  // hand-typed literal. A foreign MCP server whose name merely resembles the
  // Brain must never be recognized as the TRUSTED Brain door (isBrainTool
  // stays false); naming it literally here is the point of this negative
  // fixture (grep-exempt per this plan's acceptance criteria). Its bare tool
  // name ends in brain_query, so as of 260906-gr1 it IS Brain-shaped
  // (isBrainShapedTool true) and therefore SCRUTINIZED -- see
  // foreign_server_t3_scrutinized below. A separate fixture,
  // FOREIGN_SERVER_NON_BRAIN_SHAPED, proves a foreign name that is NOT
  // Brain-shaped at all still gets zero scrutiny, preserving the
  // "Brain-specific, not a general MCP egress firewall" contract.
  const FOREIGN_SERVER = envelope({
    tool_name: 'mcp__plugin_evil_evil-brain__brain_query',
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 's5',
  });
  const FOREIGN_SERVER_NON_BRAIN_SHAPED = envelope({
    tool_name: 'mcp__plugin_evil_evil-brain__list_files',
    tool_input: { cypher: 'note from jane@startup.com re: 2.3M ARR model' },
    session_id: 's5b',
  });

  // -------------------------------------------------------------------------
  // PB8-04: CONTENT-SET on a Brain tool -> exit 2 with a Part 8 stderr message.
  // -------------------------------------------------------------------------
  (function pb8_04_block() {
    const r = runHook(CONTENT_SET);
    assert.strictEqual(r.status, 2, 'PB8-04: CONTENT-SET on a Brain tool must exit 2 (block)');
    assert.ok(/part 8/i.test(r.stderr), 'PB8-04: block must emit a Part 8 stderr message');
  })();

  // -------------------------------------------------------------------------
  // PB8-04: clean MOVE-SET -> exit 0 (allow).
  // -------------------------------------------------------------------------
  (function pb8_04_allow() {
    const r = runHook(CLEAN_MOVE_SET);
    assert.strictEqual(r.status, 0, 'PB8-04: clean MOVE-SET must exit 0 (allow)');
  })();

  // -------------------------------------------------------------------------
  // Passthrough: non-Brain tool_name -> exit 0 (isBrainTool recheck, defense-in-depth).
  // -------------------------------------------------------------------------
  (function passthrough() {
    const r = runHook(NON_BRAIN);
    assert.strictEqual(r.status, 0, 'non-Brain tool_name must exit 0 (passthrough)');
  })();

  // -------------------------------------------------------------------------
  // Threat T3 (Phase 239, widened by quick task 260906-gr1): a foreign MCP
  // server whose bare tool name is Brain-shaped (ends brain_<verb>) is now
  // SCRUTINIZED -- it reaches classify() -- because the widened harness gate
  // (BRAIN_SHAPED_TOOL_MATCHER) closes the exact bypass a `theo`-keyed
  // connector exploited. Scrutiny is NOT trust: isBrainTool on this name
  // stays false, so the foreign server never gains an allow it had not
  // earned. Inspection is fail-safe, so a CONTENT-SET payload from it BLOCKS
  // (exit 2), same as it would for the real Brain door. This inverts the
  // pre-260906-gr1 assertion below (foreign names always passed through
  // untouched); the corrected contract is "not trusted", not "not scrutinized".
  // -------------------------------------------------------------------------
  (function foreign_server_t3_scrutinized() {
    const r = runHook(FOREIGN_SERVER);
    assert.strictEqual(r.status, 2, 'T3: a Brain-shaped foreign server name is scrutinized and blocks on CONTENT-SET (inspection is fail-safe, not trust)');
    assert.ok(/part 8/i.test(r.stderr), 'T3: block must emit a Part 8 stderr message');
  })();

  // -------------------------------------------------------------------------
  // Threat T-gr1-04 (quick task 260906-gr1): a foreign MCP server whose bare
  // tool name is NOT Brain-shaped at all (no brain_ suffix) must still exit 0
  // (passthrough), even when its tool_input carries the exact CONTENT-SET
  // payload that would BLOCK if it were Brain-shaped. This is the scoping
  // proof the original T3 fixture intended: the guard is Brain-specific, not
  // a general egress firewall for every MCP tool on every connector.
  // -------------------------------------------------------------------------
  (function foreign_server_non_brain_shaped_passthrough() {
    const r = runHook(FOREIGN_SERVER_NON_BRAIN_SHAPED);
    assert.strictEqual(r.status, 0, 'a non-Brain-shaped foreign server name must exit 0 (passthrough), never scrutinized');
  })();

  // -------------------------------------------------------------------------
  // A3: malformed/garbage stdin (infra error) -> exit 0 fail-OPEN.
  // -------------------------------------------------------------------------
  (function fail_open() {
    const r = runHook(GARBAGE);
    assert.strictEqual(r.status, 0, 'A3: garbage stdin must fail-OPEN (exit 0), never brick a Brain call');
  })();

  // 369.2-07 (CODE-07, 2026-10-05): plain question green, room content red.
  legs369207(require('../lib/core/part8-egress-guard.cjs'), HOOK, ASK_TOOL_NAME).forEach(function (r) {
    assert.ok(r[0], r[1]);
  });

  // -------------------------------------------------------------------------
  // PB8-07 / PB8-08: the ambiguous branch. Guarded behind the F.1 gate module so it
  // stays SKIP-safe until 196-05. When present, exercise both availability legs via
  // the PART8_FORCE_BRAIN_AVAILABLE test seam.
  // -------------------------------------------------------------------------
  if (fs.existsSync(GATE)) {
    // Quick task 260917-dgf: an ambiguous verdict (class unknown) on a
    // TRUSTED shim-backed plugin scope proceeds to the shim (exit 0) instead of
    // rendering the F.1 gate at the hook. The gate-render contract itself
    // (Reformulate/Cancel, no send-anyway verb) is still asserted below by
    // pb8_07_verbs, directly against the renderer; only this hook-leg
    // disposition moved.
    // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by content, never ambiguous.
    (function pb8_07_trusted_scope_proceeds() {
      const r = runHook(AMBIGUOUS_UNKNOWN, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
      assert.strictEqual(r.status, 0, '260917-dgf: ambiguous (unknown) on a TRUSTED scope must exit 0 (proceeds to the shim)');
      const p = runHook(PLAIN_STRING, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
      assert.strictEqual(p.status, 0, '369.2-07: a plain free-form string is allow, exit 0 (never ambiguous)');
    })();

    // PB8-07 (369.2-07): an unproven MOVE-SET packet is still ambiguous and
    // still reaches the F.1 gate path: exit 2 with stderr, Brain available.
    (function pb8_07_unproven_packet_blocks() {
      const r = runHook(AMBIGUOUS_PACKET, { PART8_FORCE_BRAIN_AVAILABLE: '1' });
      assert.strictEqual(r.status, 2, 'PB8-07: an unproven packet is ambiguous and must exit 2 with Brain available');
      assert.ok(r.stderr.trim().length > 0, 'PB8-07: the ambiguous block must carry stderr text');
    })();

    // PB8-08: ambiguous + Brain-less -> exit 0, LOCAL-log only, no gate (D-08a).
    // 369.2-07: runs on the unproven packet, whose class is NOT in the
    // shim-backed allow list, so the Brain-less branch is what allows it.
    (function pb8_08_degrade() {
      const r = runHook(AMBIGUOUS_PACKET, { PART8_FORCE_BRAIN_AVAILABLE: '0' });
      assert.strictEqual(r.status, 0, 'PB8-08: ambiguous + Brain-less must exit 0 (LOCAL-log, no gate)');
    })();

    // PB8-07 contract: the F.1 gate offers {Reformulate, Cancel} and NO send-anyway
    // verb. Assert directly against the gate renderer (in-process, surface-agnostic).
    (function pb8_07_verbs() {
      const gate = require(GATE);
      const render = gate.renderGate || gate.render || gate.default;
      assert.strictEqual(typeof render, 'function', 'part8-egress-gate must export a render function');
      const out = render({ tier: 'A', class: 'personal_identifier' });
      const contract = out && out.contract ? out.contract : out;
      const verbs = (contract && contract.verbs) || [];
      assert.ok(verbs.indexOf('Reformulate') !== -1, 'PB8-07: F.1 gate must offer Reformulate');
      assert.ok(verbs.indexOf('Cancel') !== -1, 'PB8-07: F.1 gate must offer Cancel');
      const forbidden = ['Send', 'SendAnyway', 'Send-Anyway', 'Approve', 'Override', 'Proceed'];
      forbidden.forEach(function (v) {
        assert.ok(verbs.indexOf(v) === -1,
          'PB8-07: F.1 gate must NOT offer a send-anyway verb (found "' + v + '") -- honors D-01');
      });
    })();

    console.log('PASS: part8-egress-guard-hook (PB8-04/05/07/08 + T3) -- exit codes + F.1 gate contract green');
  } else {
    console.log('PARTIAL PASS: hook exit-code legs (PB8-04/05, T3) green; F.1 gate + degrade SKIPPED (part8-egress-gate.cjs absent, lands 196-05)');
  }

  process.exit(0);
}

main().catch(function (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
