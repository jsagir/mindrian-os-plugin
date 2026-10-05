#!/usr/bin/env node
'use strict';

/*
 * Quick task 260917-dgf -- pin the Part 8 hook's ambiguous-verdict disposition.
 *
 * THE DEFECT. `scripts/part8-egress-guard-hook.cjs` converts every AMBIGUOUS
 * verdict into a hard block (exit 2) on trusted Brain scopes, while
 * `lib/core/brain-client.cjs::callTool` classifies the SAME args and PROCEEDS
 * with an additive `egress_disclosure { ..., disposition: 'proceeded' }`. The
 * two enforcement points diverge, and they diverge backwards: the hook is
 * stricter than the shim's own stated policy, and a PreToolUse hook cannot
 * render the Shape F.1 card anyway, so the card JSON lands on stderr as an
 * unreadable error string. A plain-English `brain_ask` that carries zero user
 * bytes gets refused with a card nobody can read. `lib/core/brain-client.cjs`
 * `callTool` is the second enforcement point this hook is being aligned with.
 *
 * Quick task 260917-ild (Codex finding F1). The 260917-dgf fix above keyed
 * the ambiguous allow on `isBrainTool`, which ALSO trusts
 * `mcp__pws-brain-mcp__*` -- a direct HTTPS connector with no local plugin
 * code in its path (`.mcp.json` registers exactly one Brain server key,
 * `mindrian-brain`, whose command is `bin/mindrian-brain-mcp-client.cjs`,
 * which requires `lib/core/brain-client.cjs`; every handler delegates to
 * `callTool`). `mcp__pws-brain-mcp__*` never touches that shim, so the second
 * classification and its `egress_disclosure` this quick task's own argument
 * depends on NEVER RUNS on that route, and the allow was unearned there.
 * Case G and case H below pin the fix: `isBrainTool` stays the byte-unchanged
 * trust predicate for OTHER consumers, and a new narrower predicate,
 * `isShimBackedBrainTool`, answers the route question -- does this scope
 * provably reach `bin/mindrian-brain-mcp-client.cjs` -- for the ambiguous
 * branch specifically. Only `mcp__mindrian-brain__*` (project scope) and
 * `mcp__plugin_mos_mindrian-brain__*` (plugin scope) are shim-backed.
 *
 * LEG 0 (the classifier verdicts, re-derived 2026-10-05). Calls
 * `lib/core/part8-egress-guard.cjs::classify()` DIRECTLY. History: this leg
 * asserted the four A-payloads (and G, H) returned ambiguous /
 * freeform_unmatched, as the mutation guard against "fixing" this defect by
 * widening METHODOLOGY_VOCAB. 369.2-07 (CODE-07, 2026-10-05): free-form strings
 * are allow or block by content, never ambiguous, so those rows now assert
 * allow with class typed_question or generic_question (the verdict theoVerdict
 * gives them), and LEG 0 gains rows for what is still ambiguous (an unproven
 * MOVE-SET packet, an unknown payload shape) and rows for room content (still
 * block). The hook disposition legs below keep their original meaning on
 * payloads that are still ambiguous.
 *
 * LEG 1 (hook exit codes, child process). Drives
 * `scripts/part8-egress-guard-hook.cjs` as a child process with a synthetic
 * PreToolUse envelope on stdin, PART8_FORCE_BRAIN_AVAILABLE seam. `runHook`
 * copied verbatim from tests/test-260906-fda-known-tool-shapes.cjs:239.
 *
 * LEG 2 (predicate self-validation). Pins the shapes of `isBrainTool` /
 * `isBrainShapedTool` so a future change to the matchers cannot silently turn
 * every hand-typed name in this file into a vacuous fixture.
 *
 * WHY THE TOOL NAMES ARE HAND-TYPED LITERALS, NOT DERIVED from
 * scripts/check-brain-tool-liveness.cjs: the contract under test is the
 * hook's TRUST predicate keyed on the tool-name SHAPE, so this test must stay
 * deterministic and runnable with no live Brain handshake; live-name parity
 * is already owned by test-245 / test-260906-fda / test-239-brain-tool-
 * liveness, and LEG 2 above pins the shapes so the literals cannot go
 * vacuous. The same hand-typed-fixture precedent is already set by the
 * FOREIGN_SERVER fixture in tests/part8-egress-guard-hook.test.cjs.
 *
 * FAILURE REPORTING: does NOT throw on the first failure. Accumulates
 * failures and prints one `FAIL: <case-id> <message>` line per failure, then
 * process.exit(1) if any failed. (Original RED evidence, quick 260917-dgf: four
 * FAIL lines A1-A4. 369.2-07 re-pin: green with 0 FAIL lines.)
 *
 * Zero-dep: node:assert, node:path, node:child_process only. CJS only.
 * NO em-dashes, NO en-dashes -- hyphens only.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const SANITIZER = path.join(ROOT, 'lib', 'core', 'brain-response-sanitize.cjs');

const guard = require(GUARD);
const sanitizer = require(SANITIZER);

const failures = [];
function fail(caseId, message) {
  failures.push('FAIL: ' + caseId + ' ' + message);
}
function check(caseId, cond, message) {
  if (!cond) fail(caseId, message);
}

// ---------------------------------------------------------------------------
// Hand-typed tool-name literals (see docblock above for why).
// ---------------------------------------------------------------------------
const TRUSTED_SEARCH = 'mcp__plugin_mos_mindrian-brain__brain_search';
const TRUSTED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';
const TRUSTED_ASK = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const UNTRUSTED_SEARCH = 'mcp__theo__brain_search';
// Quick task 260917-ild (F1): DIRECT_SEARCH is the direct HTTPS connector
// registered under its own custom key (lib/mcp/brain-composition-census.cjs
// rules it has no local plugin code in its path); PROJECT_SEARCH is the
// project-scope shim-backed name (.mcp.json's single "mindrian-brain" key).
const DIRECT_SEARCH = 'mcp__pws-brain-mcp__brain_search';
const PROJECT_SEARCH = 'mcp__mindrian-brain__brain_search';

// ---------------------------------------------------------------------------
// LEG 0: classifier unchanged (mutation guard). Runs BOTH before and after
// Task 2's hook edit; if this leg ever goes red, the classifier itself was
// touched, which is out of scope for this plan.
// ---------------------------------------------------------------------------
function leg0ClassifierUnchanged() {
  const cases = [
    ['A1', { query: 'effectuation' }, TRUSTED_SEARCH],
    ['A2', { query: 'dual-use' }, TRUSTED_SEARCH],
    ['A3', { cypher: 'MATCH (c:Chapter) WHERE c.id IN ["ch-12","ch-27"] RETURN c.id, c.title' }, TRUSTED_QUERY],
    ['A4', { question: 'what comes after customer interviews when the market is unproven' }, TRUSTED_ASK],
    // Quick task 260917-ild: both new tool names classify the same plain
    // string; the hook legs G and H below prove the disposition differs by
    // route only where a payload is still ambiguous.
    ['G', { query: 'effectuation' }, DIRECT_SEARCH],
    ['H', { query: 'effectuation' }, PROJECT_SEARCH],
  ];
  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by
  // content, never ambiguous. Was: verdict ambiguous, class freeform_unmatched.
  cases.forEach(function (c) {
    const id = 'LEG0-' + c[0];
    const r = guard.classify(c[1], { toolName: c[2] });
    check(id, r && r.verdict === 'allow', id + ': expected verdict allow, got ' + JSON.stringify(r));
    check(id, r && (r.class === 'typed_question' || r.class === 'generic_question'),
      id + ': expected class typed_question or generic_question, got ' + JSON.stringify(r));
  });

  // Room content stays blocked on every free-form verb and scope (a room-local
  // token, not the shape, is what blocks).
  const canaryRows = [
    ['R1', { query: 'CANARY7F3A2B' }, TRUSTED_SEARCH],
    ['R2', { cypher: 'MATCH (f:Framework) WHERE f.name = "CANARY7F3A2B" RETURN f' }, TRUSTED_QUERY],
    ['R3', { question: 'Which framework fits CANARY7F3A2B?' }, TRUSTED_ASK],
    ['R4', { query: 'CANARY7F3A2B' }, DIRECT_SEARCH],
  ];
  canaryRows.forEach(function (c) {
    const id = 'LEG0-' + c[0];
    const r = guard.classify(c[1], { toolName: c[2], roomDir: null });
    check(id, r && r.verdict === 'block' && r.class === 'room_content' && r.token_class === 'identifier',
      id + ': room content must block room_content/identifier, got ' + JSON.stringify(r));
  });

  // What is still ambiguous: payloads that are not free-form strings.
  const unproven = r0Packet();
  [
    ['P1', unproven, TRUSTED_ASK, 'unproven_packet'],
    ['P2', unproven, DIRECT_SEARCH, 'unproven_packet'],
    ['U1', { a: 1 }, DIRECT_SEARCH, 'unknown'],
    ['U2', { a: 1 }, PROJECT_SEARCH, 'unknown'],
  ].forEach(function (c) {
    const id = 'LEG0-' + c[0];
    const r = guard.classify(c[1], { toolName: c[2] });
    check(id, r && r.verdict === 'ambiguous' && r.class === c[3],
      id + ': expected ambiguous/' + c[3] + ' (not a free-form string), got ' + JSON.stringify(r));
  });
}

// An unproven MOVE-SET packet: typed structure that failed proof.
function r0Packet() {
  return { packet_version: '1.0', job: 'not_a_shipped_job', summary: 'raw prose' };
}

// ---------------------------------------------------------------------------
// LEG 1: hook exit codes over a child process.
// ---------------------------------------------------------------------------
function runHook(stdin, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  const res = spawnSync(process.execPath, [HOOK], { input: stdin, env: env, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '' };
}

function envelope(toolName, toolInput, sessionId) {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: sessionId });
}

function leg1HookDisposition() {
  // A1-A4 (exit 0): a trusted plugin scope, a plain methodology string, Brain
  // available -- the call must reach the shim, not die at the hook. History:
  // these were ambiguous freeform_unmatched verdicts that the hook had to hand
  // to the shim (quick 260917-dgf); 369.2-07 (CODE-07, 2026-10-05): the verdict
  // is now allow, so exit 0 holds for a content reason, on every scope.
  const aCases = [
    ['A1', TRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-a1'],
    ['A2', TRUSTED_SEARCH, { query: 'dual-use' }, 'p260917-a2'],
    ['A3', TRUSTED_QUERY, { cypher: 'MATCH (c:Chapter) WHERE c.id IN ["ch-12","ch-27"] RETURN c.id, c.title' }, 'p260917-a3'],
    ['A4', TRUSTED_ASK, { question: 'what comes after customer interviews when the market is unproven' }, 'p260917-a4'],
  ];
  aCases.forEach(function (c) {
    const id = c[0];
    const r = runHook(envelope(c[1], c[2], c[3]), { PART8_FORCE_BRAIN_AVAILABLE: '1' });
    check(id, r.status === 0, id + ': expected exit 0 (trusted scope, plain methodology string is allow and proceeds to the shim), got ' + r.status + ' stderr=' + JSON.stringify(r.stderr));
    check(id, !/part 8/i.test(r.stderr), id + ': expected no Part 8 text on stderr, got ' + JSON.stringify(r.stderr));
  });

  // B (exit 2, passes today and after): step-1 default-deny proof. A
  // CONTENT-SET payload on the same trusted scope must still block.
  (function caseB() {
    const r = runHook(
      envelope(TRUSTED_ASK, { question: 'our Series A closed at $4M ARR with jane.doe@example.com' }, 'p260917-b'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('B', r.status === 2, 'B: a content-carrying payload on a trusted scope must still exit 2, got ' + r.status);
    check('B', r.stderr && r.stderr.trim().length > 0 && /part 8/i.test(r.stderr), 'B: block must carry Part 8 stderr text, got ' + JSON.stringify(r.stderr));
  })();

  // C (exit 2): untrusted Brain-shaped key keeps the block for what is still
  // ambiguous. This is also where the F.1 gate render coverage now lives.
  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by
  // content, never ambiguous. A free-form block exits 2 on every scope and a
  // free-form allow exits 0 on every scope, so C-allow and C-block pin the
  // string rows; C keeps its original meaning on an unproven packet, which is
  // still ambiguous. Was: a plain query on this scope exited 2.
  (function caseC() {
    const allowRun = runHook(
      envelope(UNTRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-c-allow'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('C-allow', allowRun.status === 0, 'C-allow: a plain methodology string on an untrusted Brain-shaped key is allow, exit 0, got ' + allowRun.status + ' stderr=' + JSON.stringify(allowRun.stderr));
    const blockRun = runHook(
      envelope(UNTRUSTED_SEARCH, { query: 'CANARY7F3A2B' }, 'p260917-c-block'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('C-block', blockRun.status === 2, 'C-block: room content on an untrusted Brain-shaped key must exit 2, got ' + blockRun.status);
    check('C-block', blockRun.stderr && blockRun.stderr.trim().length > 0, 'C-block: block must carry non-empty stderr, got ' + JSON.stringify(blockRun.stderr));
    const r = runHook(
      envelope(UNTRUSTED_SEARCH, r0Packet(), 'p260917-c'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('C', r.status === 2, 'C: an ambiguous payload on an untrusted Brain-shaped key must still exit 2, got ' + r.status);
    check('C', r.stderr && r.stderr.trim().length > 0, 'C: block must carry non-empty stderr, got ' + JSON.stringify(r.stderr));
  })();

  // D (exit 2, passes today and after): unproven_packet is a typed structure
  // that failed proof, not a free-form string; deliberately not widened.
  (function caseD() {
    const r = runHook(
      envelope(TRUSTED_ASK, { packet_version: '1.0', job: 'not_a_shipped_job', summary: 'raw prose' }, 'p260917-d'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('D', r.status === 2, 'D: an unproven typed packet on a trusted scope must still exit 2, got ' + r.status);
  })();

  // E (exit 0, passes today and after): Brain-less path unchanged.
  (function caseE() {
    const r = runHook(
      envelope(TRUSTED_SEARCH, { query: 'effectuation' }, 'p260917-e'),
      { PART8_FORCE_BRAIN_AVAILABLE: '0' }
    );
    check('E', r.status === 0, 'E: the Brain-less path must stay exit 0, got ' + r.status);
  })();

  // F (exit 0, passes today and after): proven MOVE-SET unchanged.
  (function caseF() {
    const r = runHook(
      envelope(TRUSTED_SEARCH, { query: 'effectuation framework' }, 'p260917-f'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('F', r.status === 0, 'F: a proven MOVE-SET payload must stay exit 0, got ' + r.status);
  })();

  // G (exit 2, Codex F1): the direct HTTPS connector (mcp__pws-brain-mcp__*)
  // has no local plugin code in its path, so brain-client.cjs::callTool's
  // second classification never runs there. The pre-260917-ild hook keyed the
  // ambiguous allow on isBrainTool, which also trusts this scope.
  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by
  // content, never ambiguous. G runs on the unproven packet (still ambiguous);
  // G-unknown runs on an unknown-class payload, the same payload H sends down
  // the shim-backed route, so the route distinction stays covered; G-allow and
  // G-block pin the free-form string rows on this scope. Was: a plain query on
  // this scope exited 2.
  (function caseG() {
    const r = runHook(
      envelope(DIRECT_SEARCH, r0Packet(), 'p260917-g'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('G', r.status === 2, 'G: an ambiguous payload on the direct connector (no second classification behind it) must exit 2, got ' + r.status);
    check('G', r.stderr && r.stderr.trim().length > 0, 'G: block must carry non-empty stderr, got ' + JSON.stringify(r.stderr));
    const u = runHook(
      envelope(DIRECT_SEARCH, { a: 1 }, 'p260917-g-unknown'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('G-unknown', u.status === 2, 'G-unknown: an unknown-class payload on the direct connector must exit 2 (the shim-backed allow does not reach it), got ' + u.status);
    const a = runHook(
      envelope(DIRECT_SEARCH, { query: 'effectuation' }, 'p260917-g-allow'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('G-allow', a.status === 0, 'G-allow: a plain methodology string on the direct connector is allow, exit 0, got ' + a.status + ' stderr=' + JSON.stringify(a.stderr));
    const b = runHook(
      envelope(DIRECT_SEARCH, { query: 'CANARY7F3A2B' }, 'p260917-g-block'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('G-block', b.status === 2, 'G-block: room content on the direct connector must exit 2, got ' + b.status);
  })();

  // H (exit 0, Codex F1 non-overshoot pin): the project-scope shim-backed
  // name keeps the allow the shim's own egress_disclosure already justifies.
  // 369.2-07 (CODE-07, 2026-10-05): free-form strings are allow or block by
  // content, never ambiguous. H runs on an unknown-class payload (still
  // ambiguous, class in the shim-backed allow list); H-allow pins the plain
  // string on this scope. Was: the plain query itself was the ambiguous row.
  (function caseH() {
    const r = runHook(
      envelope(PROJECT_SEARCH, { a: 1 }, 'p260917-h'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('H', r.status === 0, 'H: an ambiguous payload on the project-scope shim-backed name must proceed to the shim, got ' + r.status + ' stderr=' + JSON.stringify(r.stderr));
    check('H', !/part 8/i.test(r.stderr), 'H: expected no Part 8 text on stderr, got ' + JSON.stringify(r.stderr));
    const a = runHook(
      envelope(PROJECT_SEARCH, { query: 'effectuation' }, 'p260917-h-allow'),
      { PART8_FORCE_BRAIN_AVAILABLE: '1' }
    );
    check('H-allow', a.status === 0, 'H-allow: a plain methodology string on the project scope is allow, exit 0, got ' + a.status);
  })();
}

// ---------------------------------------------------------------------------
// LEG 2: predicate self-validation (3 assertions). Without this, a future
// change to the matchers could silently turn every hand-typed name in this
// file into a vacuous fixture.
// ---------------------------------------------------------------------------
function leg2PredicateSelfValidation() {
  check('LEG2-1', sanitizer.isBrainTool(TRUSTED_SEARCH) === true, 'LEG2-1: isBrainTool(' + TRUSTED_SEARCH + ') must be true');
  check('LEG2-2', sanitizer.isBrainTool(UNTRUSTED_SEARCH) === false, 'LEG2-2: isBrainTool(' + UNTRUSTED_SEARCH + ') must be false');
  check('LEG2-3', sanitizer.isBrainShapedTool(UNTRUSTED_SEARCH) === true, 'LEG2-3: isBrainShapedTool(' + UNTRUSTED_SEARCH + ') must be true');

  // Quick task 260917-ild (F1): isBrainTool on the direct connector stays
  // true (the trust predicate is unchanged); isShimBackedBrainTool is false
  // on the direct connector and on mcp__theo__brain_search, and true on both
  // the plugin scope and the project scope.
  check('LEG2-4', sanitizer.isBrainTool(DIRECT_SEARCH) === true, 'LEG2-4: isBrainTool(' + DIRECT_SEARCH + ') must stay true (trust predicate unchanged)');
  check('LEG2-5', sanitizer.isShimBackedBrainTool(DIRECT_SEARCH) === false, 'LEG2-5: isShimBackedBrainTool(' + DIRECT_SEARCH + ') must be false');
  check('LEG2-6', sanitizer.isShimBackedBrainTool(UNTRUSTED_SEARCH) === false, 'LEG2-6: isShimBackedBrainTool(' + UNTRUSTED_SEARCH + ') must be false');
  check('LEG2-7', sanitizer.isShimBackedBrainTool(TRUSTED_SEARCH) === true, 'LEG2-7: isShimBackedBrainTool(' + TRUSTED_SEARCH + ') must be true (plugin scope)');
  check('LEG2-8', sanitizer.isShimBackedBrainTool(PROJECT_SEARCH) === true, 'LEG2-8: isShimBackedBrainTool(' + PROJECT_SEARCH + ') must be true (project scope)');
}

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

// LEG 3 (369.2-07, CODE-07, 2026-10-05): plain question green, room content red.
function leg3PlainAndRoom369207() {
  legs369207(guard, HOOK, TRUSTED_ASK).forEach(function (r, i) {
    check('LEG3-' + (i + 1), r[0], r[1]);
  });
}

function main() {
  leg0ClassifierUnchanged();
  leg1HookDisposition();
  leg2PredicateSelfValidation();
  leg3PlainAndRoom369207();

  if (failures.length > 0) {
    failures.forEach(function (line) { console.log(line); });
    process.exit(1);
  }
  console.log('PASS: test-260917-dgf-part8-hook-disposition (all legs green)');
  process.exit(0);
}

main();
