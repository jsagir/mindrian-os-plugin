#!/usr/bin/env node
'use strict';

/*
 * Plan 276-12 (TOOLHON-07) -- RED-first proof for the claim-write MCP
 * primitive. AUTHORED BEFORE lib/mcp/tools/claim.cjs EXISTS.
 *
 * SAME TDD DISCIPLINE AS 209b604f (RED) / 75278850 (GREEN): this file is
 * written, run, and observed failing against a tree that has no
 * lib/mcp/tools/claim.cjs, before a single line of that module is written.
 * A red run right now is the correct state, not a defect.
 *
 * CONTRACT SOURCE: .planning/phases/276-mcp-tool-honesty-triage-and-close-
 * the-check-tool-honesty-cjs/276-DECISIONS.md (status: ratified, commit
 * 26083bac). OQ-276-2 ANSWER (option a) names the tool
 * `claim_write`, home lib/mcp/tools/claim.cjs, write-then-gate:
 * claim_write files at review_status 'proposed', gate_answer promotes.
 * OQ-276-1 ANSWER (b+d) places the knowledge_type -> epistemic_type mapping
 * table inside lib/core/navigation/typed-claim.cjs, next to KNOWLEDGE_TYPES
 * -- that table's proposed content (status: PROPOSED, not itself
 * navigator-ratified; only its placement and scope are ratified) is pinned
 * below, independently of anything the module claims about itself.
 *
 * HARNESS STYLE: same MCP-tool test harness style as
 * tests/test-kwl-meeting-mcp-honesty.cjs (read_first for this task) --
 * NOT the full stdio JSON-RPC spawn (tests/test-234-tool-description-floor.
 * cjs's style). lib/mcp/register-core-tools.cjs is required directly, a stub
 * `server.tool(name, description, schema, handler)` captures every real
 * registration into a map, and the ACTUAL captured handler is invoked --
 * the exact function a real MCP client's tools/call would reach, minus the
 * subprocess/JSON-RPC transport. The 120-char floor and 2048-byte cap are
 * test-234's own constants, reused verbatim, not re-derived.
 *
 * NEVER TRUST THE TOOL'S OWN SUCCESS CLAIM. Every write assertion below
 * independently re-opens room.db with node:sqlite and reads the actual row
 * back -- the response's `ok:true` is never treated as proof by itself.
 * That discipline is the reason this whole phase exists.
 *
 * Canon Part 8: this file opens no network surface. Local mkdtemp room.db
 * only, MINDRIAN_MCP_FIRST is set to 'all' for this process ONLY so the
 * write-path PERMISSION gate (lib/mcp/mcp-first-flag.cjs) is deterministic
 * regardless of host-tier client-version detection nuance in a stub server
 * that carries no real MCP client identity.
 *
 * Run: node tests/test-276-claim-write-primitive.cjs
 * Exit: 1 while lib/mcp/tools/claim.cjs is absent (RED). 0 once every
 * assertion group A-G passes (GREEN, plan 276-12 Task 2). No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { z } = require('zod');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLAIM_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim.cjs');
const TOOL_NAME = 'claim_write'; // 276-DECISIONS.md OQ-276-2 ANSWER (option a), ratified

const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

// test-234-tool-description-floor.cjs's own constants, reused verbatim.
const MIN_DESCRIPTION_CHARS = 120;
const HOST_DESCRIPTION_CAP_BYTES = 2048;

// 276-DECISIONS.md OQ-276-1 ANSWER's proposed knowledge_type -> epistemic_type
// table (typed-claim.cjs:53 KNOWLEDGE_TYPES x node-insert.cjs:113
// ALLOWED_EPISTEMIC_TYPES). Transcribed here independently of the module
// under test, so this test can never pass by trusting a table the module
// exports about itself.
const EXPECTED_MAPPING = {
  fact: 'extracted_fact',
  causal: 'derived_fact',
  heuristic: 'interpretation',
  anomaly_cue: 'observation',
  mental_model: 'model_derived_assertion',
  assumption: 'assumption',
};

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

// ---------------------------------------------------------------------------
// Setup: a bare temp room, room.db pre-created through the sanctioned
// opener (openRoomDbForCaller requires the file to already exist -- it
// never creates one), a stub server capturing every real registration.
// ---------------------------------------------------------------------------
function makeTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-276-12-claim-'));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function roomDbPath(dir) {
  return path.join(dir, '.mindrian', 'room.db');
}

function withDb(dbPath, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function countClaimNodes(dbPath) {
  return withDb(dbPath, (db) => {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'claim'").get();
    return row ? row.n : 0;
  });
}

function readNode(dbPath, nodeId) {
  return withDb(dbPath, (db) => {
    const row = db.prepare('SELECT id, type, review_status, properties FROM nodes WHERE id = ?').get(nodeId);
    if (!row) return null;
    let props = {};
    try {
      props = JSON.parse(row.properties);
    } catch (_e) {
      props = {};
    }
    return { id: row.id, type: row.type, reviewStatus: row.review_status, props };
  });
}

function registerAndCapture(roomDir) {
  const captured = new Map();
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description, schema, handler });
    },
  };
  registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });
  return captured;
}

async function callTool(reg, params) {
  const raw = await reg.handler(params, { sessionId: 'test-session-276-12' });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return { raw, result: text ? JSON.parse(text) : null };
}

async function run() {
  process.stdout.write('Plan 276-12 (TOOLHON-07): RED-first proof for the claim-write MCP primitive\n');
  process.stdout.write('Precedent: 209b604f (RED) / 75278850 (GREEN). Contract source: 276-DECISIONS.md.\n\n');

  const roomDir = makeTempRoom();
  const dbPath = roomDbPath(roomDir);
  const captured = registerAndCapture(roomDir);

  // -------------------------------------------------------------------
  // Assertion group A -- the tool exists and is registered, through the
  // SAME auto-discovery seam (lib/mcp/register-core-tools.cjs) a real
  // MCP client's tools/list reaches through.
  // -------------------------------------------------------------------
  const reg = captured.get(TOOL_NAME);
  check(
    'the tool named in 276-DECISIONS.md OQ-276-2 (`' + TOOL_NAME + '`) is registered',
    !!reg,
    'registered tools: ' + Array.from(captured.keys()).join(', ')
  );

  const desc = reg && typeof reg.description === 'string' ? reg.description : '';
  check(
    '`' + TOOL_NAME + '` description clears the 120-char floor (test-234 constant)',
    !!reg && desc.length >= MIN_DESCRIPTION_CHARS,
    reg ? 'got ' + desc.length + ' chars' : 'tool not registered'
  );
  check(
    '`' + TOOL_NAME + '` description is <= 2048 bytes (test-234 constant)',
    !!reg && Buffer.byteLength(desc, 'utf8') <= HOST_DESCRIPTION_CAP_BYTES,
    reg ? 'got ' + Buffer.byteLength(desc, 'utf8') + ' bytes' : 'tool not registered'
  );

  // -------------------------------------------------------------------
  // Assertion group B -- the happy path, over EVERY DECISIONS.md mapping
  // row. Never trust the response: independently re-read room.db with
  // node:sqlite after each call.
  // -------------------------------------------------------------------
  if (reg) {
    for (const [knowledgeType, expectedEpistemicType] of Object.entries(EXPECTED_MAPPING)) {
      const before = countClaimNodes(dbPath);
      let outcome;
      try {
        outcome = await callTool(reg, { knowledge_type: knowledgeType, text: 'test claim for ' + knowledgeType });
      } catch (e) {
        outcome = { result: { ok: false, reason: 'handler_threw', detail: String((e && e.message) || e) } };
      }
      const result = outcome.result;
      check(
        '`' + knowledgeType + '` write reports ok:true',
        !!result && result.ok === true,
        JSON.stringify(result)
      );
      const after = countClaimNodes(dbPath);
      check(
        '`' + knowledgeType + '` write increased the claim-node row count in room.db (independent of the response)',
        after === before + 1,
        'before=' + before + ' after=' + after
      );
      const node = result && result.node_id ? readNode(dbPath, result.node_id) : null;
      check(
        '`' + knowledgeType + '` claim node exists in room.db with knowledge_type=`' + knowledgeType + '`',
        !!node && node.props.knowledge_type === knowledgeType,
        JSON.stringify(node)
      );
      check(
        'knowledge_type `' + knowledgeType + '` -> epistemic_type `' + expectedEpistemicType +
          '` per 276-DECISIONS.md OQ-276-1\'s proposed mapping table',
        !!node && node.props.epistemic_type === expectedEpistemicType,
        'got epistemic_type=' + (node && node.props.epistemic_type)
      );
    }

    const mtimeBefore = fs.statSync(dbPath).mtimeMs;
    await callTool(reg, { knowledge_type: 'fact', text: 'mtime probe' });
    const mtimeAfter = fs.statSync(dbPath).mtimeMs;
    check('room.db mtime moves on a real write', mtimeAfter >= mtimeBefore);
  } else {
    check('assertion group B: happy path over the DECISIONS.md mapping table', false, 'lib/mcp/tools/claim.cjs does not exist yet');
  }

  // -------------------------------------------------------------------
  // Assertion group C -- the refusal path, at TWO independent layers
  // (defense in depth, not duplication -- 276-12-PLAN.md Task 2 action).
  // -------------------------------------------------------------------
  if (reg) {
    const before = countClaimNodes(dbPath);

    // Layer 1: the z.enum schema boundary. Validated against the ACTUAL
    // captured schema shape (not a re-derived guess), the same shape the
    // real MCP SDK wraps in z.object(...) and parses before ever calling
    // the handler (node_modules/@modelcontextprotocol/sdk .../mcp.js:175-181).
    const schemaShape = reg.schema && typeof reg.schema === 'object' ? reg.schema : {};
    const parseResult = z.object(schemaShape).safeParse({ knowledge_type: 'not_a_real_type', text: 'refused' });
    check(
      'layer 1 (schema boundary): z.enum(knowledge_type) rejects an out-of-enum value before the handler could run',
      parseResult.success === false,
      JSON.stringify(parseResult.success ? parseResult.data : parseResult.error && parseResult.error.issues)
    );
    const afterSchema = countClaimNodes(dbPath);
    check('layer 1 refusal writes nothing (row count unchanged)', afterSchema === before, 'before=' + before + ' after=' + afterSchema);

    // Layer 2: the AUTHORITATIVE refusal inside writeClaimNode itself
    // (typed-claim.cjs, reached through navigation.cjs, the single door).
    // The z.enum boundary makes this path structurally unreachable over
    // the wire by design -- called directly here so the authoritative
    // check is pinned on its own terms, independent of the schema layer.
    const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
    const db2 = openRoomDb(roomDir);
    let authResult;
    try {
      authResult = navigation.writeClaimNode(db2, {
        knowledge_type: 'not_a_real_type',
        text: 'refused',
        sessionId: 'test-session-276-12',
      });
    } finally {
      closeRoomDb(db2);
    }
    check(
      'layer 2 (authoritative, typed-claim.cjs writeClaimNode via navigation.cjs): refuses naming invalid_knowledge_type',
      !!authResult && authResult.ok === false && authResult.reason === 'invalid_knowledge_type',
      JSON.stringify(authResult)
    );
    const afterAuth = countClaimNodes(dbPath);
    check('layer 2 refusal writes nothing (row count unchanged)', afterAuth === before, 'before=' + before + ' after=' + afterAuth);
  } else {
    check('assertion group C: the refusal path (two layers)', false, 'lib/mcp/tools/claim.cjs does not exist yet');
  }

  // -------------------------------------------------------------------
  // Assertion group D -- the chokepoint. Read lib/mcp/tools/claim.cjs as
  // TEXT and assert no second write path exists. Canon Part 9 pin: a
  // second write path must fail the SUITE, not merely fail review.
  // -------------------------------------------------------------------
  const claimSrcExists = fs.existsSync(CLAIM_TOOL_PATH);
  check('lib/mcp/tools/claim.cjs exists', claimSrcExists);
  const claimSrc = claimSrcExists ? fs.readFileSync(CLAIM_TOOL_PATH, 'utf8') : '';
  check(
    'claim.cjs does not require(\'node:sqlite\') directly',
    claimSrcExists && !/require\(\s*['"]node:sqlite['"]\s*\)/.test(claimSrc),
    claimSrcExists ? '' : 'file absent'
  );
  check(
    'claim.cjs does not require room-db.cjs directly',
    claimSrcExists && !/require\([^)]*room-db\.cjs['"]\s*\)/.test(claimSrc),
    claimSrcExists ? '' : 'file absent'
  );
  check(
    'claim.cjs contains no INSERT SQL',
    claimSrcExists && !/INSERT\s+INTO/i.test(claimSrc),
    claimSrcExists ? '' : 'file absent'
  );
  check(
    'claim.cjs calls writeClaimNode',
    claimSrcExists && /writeClaimNode/.test(claimSrc),
    claimSrcExists ? '' : 'file absent'
  );
  check(
    'claim.cjs source carries no em-dash (CLAUDE.md hard rule)',
    // Unicode escape, not a literal em-dash character, so THIS file's own
    // source stays clean under the repo-wide no-em-dash fence (mirrors
    // tests/test-ljj-tool-honesty.cjs:219).
    claimSrcExists && claimSrc.indexOf('\u2014') === -1,
    claimSrcExists ? '' : 'file absent'
  );

  // -------------------------------------------------------------------
  // Assertion group E -- the description is honest on the checker's
  // FIRST sweep, scanAll restricted to lib/mcp/tools/claim.cjs alone.
  // -------------------------------------------------------------------
  if (claimSrcExists) {
    const checker = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));
    const { rows } = checker.scanAll({ files: [{ absPath: CLAIM_TOOL_PATH, relPath: 'lib/mcp/tools/claim.cjs' }] });
    const nonOk = rows.filter((r) => r.verdict !== 'OK');
    check(
      "claim.cjs scans OK on the honesty checker's first sweep (zero non-OK rows)",
      rows.length > 0 && nonOk.length === 0,
      JSON.stringify(rows)
    );
  } else {
    check("claim.cjs scans OK on the honesty checker's first sweep (zero non-OK rows)", false, 'file absent');
  }

  // -------------------------------------------------------------------
  // Assertion group F -- the born-wired declaration, Canon Part 11.
  // -------------------------------------------------------------------
  if (claimSrcExists) {
    const mod = require(CLAIM_TOOL_PATH);
    const connectors = Array.isArray(mod.connectors) ? mod.connectors : [];
    const entry = connectors.find((c) => c && c.tool === TOOL_NAME);
    check("claim.cjs exports a `connectors` array with an entry for `" + TOOL_NAME + '`', !!entry, JSON.stringify(connectors));
    check('the connector entry declares connector: mcp-tool', !!entry && entry.connector === 'mcp-tool');
    check(
      'the connector entry declares a non-empty hitl_shape',
      !!entry && typeof entry.hitl_shape === 'string' && entry.hitl_shape.length > 0
    );
    check(
      'the connector entry declares a hitl_why of at least 40 characters',
      !!entry && typeof entry.hitl_why === 'string' && entry.hitl_why.length >= 40
    );
  } else {
    check("claim.cjs exports a `connectors` array with an entry for `" + TOOL_NAME + '`', false, 'file absent');
    check('the connector entry declares connector: mcp-tool', false, 'file absent');
    check('the connector entry declares a non-empty hitl_shape', false, 'file absent');
    check('the connector entry declares a hitl_why of at least 40 characters', false, 'file absent');
  }

  // -------------------------------------------------------------------
  // Assertion group G -- gate order per 276-DECISIONS.md OQ-276-2
  // (option a, write-then-gate): the node lands at proposed, never
  // confirmed, at write time. Promotion is gate_answer's job, unchanged.
  // -------------------------------------------------------------------
  if (reg) {
    const { result } = await callTool(reg, { knowledge_type: 'fact', text: 'gate order probe' });
    const node = result && result.node_id ? readNode(dbPath, result.node_id) : null;
    check(
      'OQ-276-2 (option a, write-then-gate): the written claim node lands at review_status=proposed, never confirmed',
      !!node && node.reviewStatus === 'proposed',
      'got review_status=' + (node && node.reviewStatus)
    );
  } else {
    check(
      'OQ-276-2 (option a, write-then-gate): the written claim node lands at review_status=proposed, never confirmed',
      false,
      'tool not registered'
    );
  }

  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch (_e) {
    /* best effort cleanup */
  }

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

run();
