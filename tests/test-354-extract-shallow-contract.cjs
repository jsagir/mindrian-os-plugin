#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-extract-shallow-contract.cjs -- Phase 354-15 (SYS-05).
 *
 * Pins decision D-354-SYS05 (354-CONTEXT.md): extract_shallow's public
 * contract is honest parsing, not governed persistence. The two documented
 * callers (lib/mcp/runtime-instructions.cjs:31's hookless runtime loop,
 * "If message 1 is a pasted doc, detect_dual_path, then extract_shallow on
 * 'upload'", in the same step that says "Never write a room artifact before
 * binding"; and ignite Door 2 at commands/ignite.md:140 / skills/ignite/
 * SKILL.md:136) both run extract_shallow BEFORE a room exists or is bound.
 * Governed persistence already exists at claim_write (writeClaimNode, the
 * single node chokepoint, review_status proposed); a second writer inside
 * extract_shallow would duplicate it (Canon Part 7) and would write
 * CV-derived claims with no gate.
 *
 * The seam this test pins (T-354-29): lib/mcp/tools/dual-path.cjs's shipped
 * description promised "Routes graph writes through lib/core/navigation.cjs
 * setFocus + memory_event" and agents/larry-extended.md:197-200 promised
 * "The parser writes 3-5 nodes to local room.db" -- but the actual call site
 * (lib/mcp/tools/dual-path.cjs -> shallowDocParser.extractShallow(text,
 * sessionId), no opts.db argument) makes setFocus a structural no-op
 * (extractShallow only calls it when opts.db is supplied,
 * shallow-doc-parser.cjs:191) and the memory_event write is inert too
 * (safeRecord no-ops unless navigation.recordMemoryEvent is a function,
 * which it is not today, shallow-doc-parser.cjs:142-150). Two layers
 * disagree: the description/prose promise writes; the code performs none.
 * After the fix every surface says the same thing: a pure parse, persisted
 * false, persist via claim_write after a room is bound and the navigator
 * confirms.
 *
 * Seeded from docs/reviews/phase-354-probes/persistence.cjs's
 * McpServer+Client-over-InMemoryTransport + openRoomDb-after-the-call idiom
 * (the same shape testR2/testW1 in tests/test-354-room-symlink-containment.cjs
 * use). Read_first also covered lib/mcp/tools/dual-path.cjs (whole file),
 * lib/core/shallow-doc-parser.cjs:130-240 (extractShallow, the setFocus
 * guard at :191, the recordMemoryEvent comment at :138-150),
 * agents/larry-extended.md:190-205, lib/mcp/register-core-tools.cjs,
 * tests/helpers/fixture-room-354.cjs.
 *
 * Plain-Node harness (tests/test-354-room-symlink-containment.cjs shape):
 * assert, a local ok(label)/fail(label, error) counter pair, a leading log
 * of the test name, a trailing PASS/FAIL summary line, process.exitCode = 1
 * on any failure. No framework. Hyphens only, no em-dashes.
 *
 * Run: node tests/test-354-extract-shallow-contract.cjs
 * RED (against the pre-fix code, Task 1): the no-write assertions (disk +
 * database-after-reopen) already pass today -- that IS the point, the
 * behavior is already a pure parse. The description- and agent-prose
 * assertions fail, naming the lie the fix (Task 2) corrects.
 * GREEN (after Task 2): every assertion passes, persisted:false and
 * persist_via:'claim_write' are present on the response, and the
 * description/prose read honest.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

const REPO = path.resolve(__dirname, '..');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { registerCoreTools } = require(path.join(REPO, 'lib', 'mcp', 'register-core-tools.cjs'));

console.log('test-354-extract-shallow-contract');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  checks += 1;
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}
function check(label, fn) {
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}
async function checkAsync(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

const SYNTHETIC_CV = 'Synthetic Person\nFounder of Synthetic Venture Labs\nBuilding tools for synthetic testing.';
const SYNTHETIC_SESSION_ID = 'synthetic-354-session';

// Recursive directory listing (relative paths + sizes), sorted for a stable diff.
function listDir(root) {
  const out = [];
  function walk(dir, rel) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relPath = rel ? rel + '/' + entry.name : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, relPath);
      } else {
        const size = fs.statSync(abs).size;
        out.push(relPath + ':' + size);
      }
    }
  }
  walk(root, '');
  return out;
}

function dbCounts(room) {
  const db = openRoomDb(room);
  try {
    const nodeCount = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const edgeCount = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    const memoryEventCount = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n;
    return { nodeCount, edgeCount, memoryEventCount };
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  const { room, cleanup } = makeScratchRoom('extract-shallow-contract');
  try {
    const beforeCounts = dbCounts(room);
    const beforeListing = listDir(room);

    // Register the real tools/*.cjs surface (including lib/mcp/tools/dual-path.cjs)
    // on a real McpServer, connect an SDK Client over InMemoryTransport -- the
    // handler + protocol layer, not the parser function directly.
    const server = new McpServer({ name: 'test-354-extract-shallow-contract', version: '1' });
    registerCoreTools(server, { fallbackRoomDir: room, surface: 'cli' });
    const client = new Client({ name: 'test-354-extract-shallow-reader', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);

    let response = null;
    let parsed = null;
    await checkAsync('extract_shallow call succeeds through the MCP handler', async () => {
      response = await client.callTool({
        name: 'extract_shallow',
        arguments: { text: SYNTHETIC_CV, sessionId: SYNTHETIC_SESSION_ID },
      });
      assert.ok(response && Array.isArray(response.content) && response.content[0] && typeof response.content[0].text === 'string', 'response must carry a text content item');
    });

    check('response parses as JSON', () => {
      parsed = JSON.parse(response.content[0].text);
      assert.ok(parsed && typeof parsed === 'object', 'parsed response must be an object');
    });

    check('response.persisted === false', () => {
      assert.strictEqual(parsed.persisted, false, 'extract_shallow response must declare persisted: false');
    });

    check("response.persist_via === 'claim_write'", () => {
      assert.strictEqual(parsed.persist_via, 'claim_write', "extract_shallow response must declare persist_via: 'claim_write'");
    });

    const afterCounts = dbCounts(room);
    const afterListing = listDir(room);

    check('room.db node count unchanged after reopening through a new handle', () => {
      assert.strictEqual(afterCounts.nodeCount, beforeCounts.nodeCount, 'node count must be identical before/after extract_shallow');
    });

    check('room.db edge count unchanged after reopening through a new handle', () => {
      assert.strictEqual(afterCounts.edgeCount, beforeCounts.edgeCount, 'edge count must be identical before/after extract_shallow');
    });

    check('room.db memory_event count unchanged after reopening through a new handle', () => {
      assert.strictEqual(afterCounts.memoryEventCount, beforeCounts.memoryEventCount, 'memory_event count must be identical before/after extract_shallow');
    });

    check('room directory listing unchanged', () => {
      assert.deepStrictEqual(afterListing, beforeListing, 'room directory listing must be byte-identical before/after extract_shallow');
    });

    let tools = null;
    await checkAsync('client.listTools() returns extract_shallow', async () => {
      const result = await client.listTools();
      tools = result && result.tools;
      assert.ok(Array.isArray(tools) && tools.some((t) => t.name === 'extract_shallow'), 'extract_shallow must be a registered tool');
    });

    check('extract_shallow description does not claim it routes graph writes', () => {
      const tool = tools.find((t) => t.name === 'extract_shallow');
      assert.ok(!/Routes graph writes/i.test(tool.description || ''), 'description must not claim "Routes graph writes"');
    });

    check('extract_shallow description states it writes nothing', () => {
      const tool = tools.find((t) => t.name === 'extract_shallow');
      assert.ok(/writes nothing/i.test(tool.description || ''), 'description must contain "writes nothing"');
    });

    await client.close();
    await server.close();

    const agentProse = fs.readFileSync(path.join(REPO, 'agents', 'larry-extended.md'), 'utf8');

    check("agents/larry-extended.md no longer claims the parser writes 3-5 nodes", () => {
      assert.ok(!agentProse.includes('The parser writes 3-5 nodes'), 'agent prose must not contain "The parser writes 3-5 nodes"');
    });

    check('agents/larry-extended.md names claim_write as the persistence step', () => {
      assert.ok(agentProse.includes('claim_write'), 'agent prose must mention claim_write');
    });

    cleanup();
  } catch (e) {
    cleanup();
    throw e;
  }
}

main()
  .catch((e) => {
    fail('unhandled error', e);
  })
  .then(() => {
    console.log('');
    console.log(failed === 0 ? 'PASS (' + checks + ' checks)' : 'FAIL (' + failed + '/' + checks + ' checks failed)');
    process.exitCode = failed === 0 ? 0 : 1;
  });
