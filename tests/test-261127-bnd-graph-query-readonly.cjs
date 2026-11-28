#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd graph-query: finding F7, Canon Part 9 (room.db is the
 * local mind; a read path does not change it).
 *
 * Reason: the `graph-query` command of the room_graph tool and the CLI
 * `graph query` ran any SQL text on a read-write handle, so a "query" could
 * UPDATE, DELETE, DROP, ATTACH or VACUUM INTO, and a query in a folder with
 * no room.db made one.
 *
 * Probe fact: a read-only node:sqlite handle still runs `VACUUM INTO` (it
 * writes a new file). So the read path checks the first keyword of the
 * statement (SELECT, WITH, EXPLAIN) and also opens room.db read-only.
 *
 * Isolation: the temp HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME
 * and MINDRIAN_BRAIN_URL=http://127.0.0.1:9 are set before the first
 * require of plugin code; the session variables are removed. A stub fetch
 * throws and counts each call; the run asserts 0 calls.
 *
 * Node built-in modules only. Synthetic text only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-gq-')));
const HOME = path.join(TMP, 'h');
const MH = path.join(HOME, '.mindrian');
const RH = path.join(TMP, 'rooms');
for (const d of [MH, RH]) fs.mkdirSync(d, { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_HOME = MH;
process.env.MINDRIAN_ROOMS_HOME = RH;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ROOM;

let FETCH_CALLS = 0;
globalThis.fetch = async function stubFetch() { FETCH_CALLS += 1; throw new Error('network call in test'); };

const REPO = path.resolve(__dirname, '..');
const lazygraph = require('../lib/core/lazygraph-ops.cjs');
const graphOps = require('../lib/core/graph-ops.cjs');
const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');

const READ_ONLY_LINE = 'graph-query reads only. Nothing was changed. Send one SELECT, WITH or EXPLAIN statement.';
const MISSING_LINE = 'This room has no graph database yet. Nothing was created.';
const UPDATE_SQL = "UPDATE nodes SET properties = '{}' WHERE type = 'Artifact'";
const COUNT_SQL = "SELECT count(*) AS n FROM nodes WHERE type = 'Artifact'";

let roomN = 0;

function artifact(dir, name, title) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  fs.writeFileSync(f, '---\ntitle: ' + title + '\nmethodology: synthetic\ncreated: 2026-11-27\n---\n\n# ' + title + '\n\nSynthetic text for a test.\n');
  return f;
}

// newRoom: a temp room with a section folder, 2 artifacts and a built graph.
async function newRoom() {
  roomN += 1;
  const room = path.join(TMP, 'room-' + roomN);
  const sec = path.join(room, 'problem-definition');
  artifact(sec, 'alpha.md', 'Alpha');
  artifact(sec, 'beta.md', 'Beta');
  await graphOps.rebuildGraph(room);
  return room;
}

function bareFolder() {
  roomN += 1;
  const room = path.join(TMP, 'bare-' + roomN);
  fs.mkdirSync(path.join(room, 'problem-definition'), { recursive: true });
  return room;
}

// tool: the room_graph handler that registerRouterTools registers for the room.
function tool(room) {
  const captured = new Map();
  const stub = {
    tool: (name, description, schema, handler) => { captured.set(name, handler); },
    registerTool: (name, config, handler) => { captured.set(name, handler); },
  };
  registerRouterTools(stub, room, REPO, { full: '' }, 'cli');
  const h = captured.get('room_graph');
  if (typeof h !== 'function') throw new Error('room_graph not registered');
  return (q) => h({ command: 'graph-query', query: q }, {});
}

function text(res) { return (res && res.content && res.content[0] && res.content[0].text) || ''; }

function json(res) {
  const t = text(res);
  const end = t.indexOf('\n}');
  return JSON.parse(end >= 0 ? t.slice(0, end + 2) : t);
}

// snap: the node rows, the edge count and the user_version, read through a separate handle.
async function snap(room) {
  const { db, conn } = await lazygraph.openGraph(room);
  try {
    const nodes = conn.prepare('SELECT id, type, properties FROM nodes ORDER BY id').all().map((r) => ({ ...r }));
    let edges = -1;
    try { edges = conn.prepare('SELECT count(*) AS n FROM edges').get().n; } catch (_e) { edges = -1; }
    const uv = conn.prepare('PRAGMA user_version').get().user_version;
    return { nodes: JSON.stringify(nodes), edges, uv, artifacts: nodes.filter((n) => n.type === 'Artifact').length };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

function listFiles(dir) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  })(dir);
  return out.sort();
}

function assert(c, m) { if (!c) throw new Error(m); }

function refused(res, line) {
  assert(res && res.isError === true, 'no error flag: ' + text(res).slice(0, 200));
  assert(text(res) === line, 'answer: ' + text(res).slice(0, 200));
}

const CASES = [
  ['Q1', 'an UPDATE through the tool path changes no node row', async function () {
    const room = await newRoom();
    const before = await snap(room);
    await tool(room)(UPDATE_SQL);
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
  }],
  ['Q2', 'a DELETE through the tool path changes no node row', async function () {
    const room = await newRoom();
    const before = await snap(room);
    await tool(room)("DELETE FROM nodes WHERE type = 'Artifact'");
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
  }],
  ['Q3', 'a DROP TABLE through the tool path keeps the edges', async function () {
    const room = await newRoom();
    const before = await snap(room);
    assert(before.edges === 2, 'setup edges ' + before.edges);
    await tool(room)('DROP TABLE edges');
    const after = await snap(room);
    assert(after.edges === 2, 'edge count ' + after.edges);
  }],
  ['Q4', 'VACUUM INTO through the tool path writes no file', async function () {
    const room = await newRoom();
    const target = path.join(TMP, 'vacuum-' + roomN + '.db');
    await tool(room)("VACUUM INTO '" + target.replace(/'/g, "''") + "'");
    assert(!fs.existsSync(target), 'file exists: ' + target);
  }],
  ['Q5', 'WITH ... DELETE through the tool path is refused', async function () {
    const room = await newRoom();
    const before = await snap(room);
    const res = await tool(room)('WITH x AS (SELECT 1) DELETE FROM nodes');
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
    refused(res, READ_ONLY_LINE);
  }],
  ['Q6', 'the answer to an UPDATE is the fixed read-only line with the error flag', async function () {
    const room = await newRoom();
    const res = await tool(room)(UPDATE_SQL);
    refused(res, READ_ONLY_LINE);
    assert(!text(res).includes('"success": true'), 'answer holds success true');
  }],
  ['Q7', 'a SELECT through the tool path returns 2 rows', async function () {
    const room = await newRoom();
    const res = await tool(room)("SELECT id FROM nodes WHERE type = 'Artifact'");
    assert(text(res).includes('"success": true'), 'no success: ' + text(res).slice(0, 200));
    const j = json(res);
    assert(j.count === 2 && j.rows.length === 2, 'count ' + j.count);
  }],
  ['Q8', 'WITH SELECT and a SELECT after comments return the count 2', async function () {
    const room = await newRoom();
    const t = tool(room);
    for (const q of [
      "WITH a AS (SELECT * FROM nodes WHERE type = 'Artifact') SELECT count(*) AS n FROM a",
      '-- a line comment\n' + COUNT_SQL,
      '/* a block\n comment */ ' + COUNT_SQL,
    ]) {
      const j = json(await t(q));
      assert(j.success === true && j.rows[0] && j.rows[0].n === 2, 'query ' + JSON.stringify(q) + ': ' + JSON.stringify(j));
    }
  }],
  ['Q9', 'a folder with no room.db: the fixed missing line, and no room.db is made', async function () {
    const room = bareFolder();
    const res = await tool(room)(COUNT_SQL);
    refused(res, MISSING_LINE);
    assert(!fs.existsSync(path.join(room, '.mindrian', 'room.db')), 'room.db was made');
  }],
  ['Q10', 'graphOps.queryGraph refuses an UPDATE and exports the keyword list', async function () {
    const room = await newRoom();
    const before = await snap(room);
    const r = await graphOps.queryGraph(room, UPDATE_SQL);
    assert(JSON.stringify(r) === JSON.stringify({ success: false, reason: 'not_a_read_statement', rows: [], count: 0 }), 'result ' + JSON.stringify(r));
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
    assert(JSON.stringify(graphOps.READ_STATEMENT_KEYWORDS) === JSON.stringify(['SELECT', 'WITH', 'EXPLAIN']), 'keywords ' + JSON.stringify(graphOps.READ_STATEMENT_KEYWORDS));
  }],
  ['Q11', 'the writers still work after reads', async function () {
    const room = await newRoom();
    const t = tool(room);
    await t(COUNT_SQL);
    await t(COUNT_SQL);
    const f = artifact(path.join(room, 'problem-definition'), 'gamma.md', 'Gamma');
    const r = await graphOps.indexArtifact(room, f);
    assert(r && r.success === true, 'indexArtifact: ' + JSON.stringify(r));
    const s = await snap(room);
    assert(s.artifacts === 3, 'artifacts ' + s.artifacts);
    const { db, conn } = await lazygraph.openGraph(room);
    try {
      conn.prepare("INSERT INTO nodes (id, type, properties) VALUES ('q11-row', 'Probe', '{}')").run();
      const n = conn.prepare("SELECT count(*) AS n FROM nodes WHERE id = 'q11-row'").get().n;
      assert(n === 1, 'row not written');
    } finally {
      await lazygraph.closeGraph(db);
    }
  }],
  ['Q12', 'a readOnly handle refuses a write; a missing room.db rejects and makes nothing', async function () {
    const room = await newRoom();
    const { db, conn } = await lazygraph.openGraph(room, { readOnly: true });
    let code = null;
    try {
      conn.prepare("INSERT INTO nodes (id, type, properties) VALUES ('q12', 'Probe', '{}')").run();
    } catch (e) {
      code = e && typeof e.errcode === 'number' ? (e.errcode & 255) : 'no errcode';
    } finally {
      await lazygraph.closeGraph(db);
    }
    assert(code === 8, 'write code ' + code);
    const bare = bareFolder();
    let rej = null;
    try { const h = await lazygraph.openGraph(bare, { readOnly: true }); await lazygraph.closeGraph(h.db); } catch (e) { rej = e; }
    assert(rej && rej.code === 'ROOM_DB_MISSING', 'no ROOM_DB_MISSING: ' + (rej && rej.message));
    assert(!fs.existsSync(path.join(bare, '.mindrian')), '.mindrian was made');
  }],
  ['Q13', 'a read through the tool path adds no file except the 2 sidecar files', async function () {
    const room = await newRoom();
    const before = listFiles(room);
    await tool(room)(COUNT_SQL);
    const side = new Set(['.mindrian/room.db-shm', '.mindrian/room.db-wal']);
    const strip = (l) => l.filter((x) => !side.has(x));
    assert(JSON.stringify(strip(listFiles(room))) === JSON.stringify(strip(before)), 'files: ' + JSON.stringify(listFiles(room)) + ' before ' + JSON.stringify(before));
  }],
  ['Q14', 'ATTACH through the tool path is refused and writes no file', async function () {
    const room = await newRoom();
    const target = path.join(TMP, 'attach-' + roomN + '.db');
    const res = await tool(room)("ATTACH DATABASE '" + target.replace(/'/g, "''") + "' AS x");
    refused(res, READ_ONLY_LINE);
    assert(!fs.existsSync(target), 'file exists: ' + target);
  }],
  ['Q15', 'SELECT 1; DELETE runs only the first statement', async function () {
    const room = await newRoom();
    const before = await snap(room);
    await tool(room)('SELECT 1; DELETE FROM nodes');
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
  }],
  ['Q16', 'PRAGMA user_version = 7 and an INSERT are refused', async function () {
    const room = await newRoom();
    const before = await snap(room);
    const t = tool(room);
    refused(await t('PRAGMA user_version = 7'), READ_ONLY_LINE);
    refused(await t("INSERT INTO nodes (id, type, properties) VALUES ('q16', 'Probe', '{}')"), READ_ONLY_LINE);
    const after = await snap(room);
    assert(after.nodes === before.nodes, 'node rows changed');
    assert(after.uv === before.uv, 'user_version ' + before.uv + ' -> ' + after.uv);
  }],
];

async function main() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { await fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd graph-query: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  if (FETCH_CALLS !== 0) process.stdout.write('    fetch calls: ' + FETCH_CALLS + ' (want 0)\n');
  process.exit(f || FETCH_CALLS ? 1 : 0);
}

main();
