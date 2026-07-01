'use strict';
// Phase 200-02 Task 3 -- lock the LOCAL-only Tier-0 expert base (D-200-2 (b), the unchanged half).
//
// Canon Part 8: Author / Paper / Institution are user artifacts that live in room.db and NEVER
// egress to the Brain. This test proves two things:
//   1. rs-experts / rs-thesis are structurally incapable of a Brain call (no mcp__mindrian-brain
//      tool in their allowed-tools), and the command bodies document the LOCAL-only base.
//   2. Tier-0 resolution of Author + Institution from a LOCAL room.db works with the Brain key
//      ABSENT and degrades with no throw.
//
// Offline, deterministic, no network / Brain / model.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const mirror = require(path.join(REPO, 'lib', 'core', 'rs-sqlite-mirror.cjs'));

const PAIR = {
  query_concept: 'edge caching',
  doc_concept: 'stale-while-revalidate',
  classification: 'reverse_salient',
  thesis: 'A revalidation window closes the freshness salient.',
  breakthrough: { score: 0.6, dominant_dimension: 'market', breakdown: {} },
};

// The person-bytes that live ONLY in room.db (Canon Part 8) -- an author + an institution.
const EXPERTS = [
  { name: 'Ada Placeholder', orcid: '0000-0001-0000-0001', institution: 'Fictional Systems Lab' },
];

function readCommand(name) {
  return fs.readFileSync(path.join(REPO, 'commands', name), 'utf8');
}

// Extract the allowed-tools block from a command's frontmatter (between the two --- fences).
function allowedToolsBlock(src) {
  const fm = src.split('---')[1] || '';
  const m = fm.match(/allowed-tools:[\s\S]*?(?=\n[a-zA-Z#][^\n]*:\s|$)/);
  return m ? m[0] : '';
}

async function main() {
  // ---- 1a. Structural: neither command may carry a Brain MCP tool. ----
  for (const cmd of ['rs-experts.md', 'rs-thesis.md']) {
    const src = readCommand(cmd);
    const tools = allowedToolsBlock(src);
    assert.equal(
      /mcp__mindrian[-_]brain/.test(tools) || /read_neo4j_cypher/.test(tools),
      false,
      cmd + ' allowed-tools must carry NO Brain MCP tool (Tier-0 LOCAL-only)'
    );
    // The command body documents the LOCAL-only Tier-0 base contract.
    assert.equal(
      /LOCAL-only/.test(src) && /Part 8/.test(src),
      true,
      cmd + ' body must document the LOCAL-only Tier-0 base (Part 8)'
    );
  }
  console.log('  1a) rs-experts + rs-thesis are structurally Brain-free, LOCAL-only documented -- PASS');

  // ---- 1b. Functional: Tier-0 resolves Author + Institution from room.db with Brain key ABSENT. ----
  const savedKey = process.env.MINDRIAN_BRAIN_API_KEY;
  const savedNeo = process.env.NEO4J_URI;
  delete process.env.MINDRIAN_BRAIN_API_KEY; // Brain key absent -> pure Tier-0.
  delete process.env.NEO4J_URI;              // no Aura -> LOCAL SQLite is the mirror.

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-tier0-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const rdb = openRoomDb(tmp);
  closeRoomDb(rdb);

  let res;
  await assert.doesNotReject(async () => {
    res = await mirror.writeDiscovery(PAIR, {
      roomDir: tmp,
      context: { room_id: 'tier0room', domain: 'caching', experts: EXPERTS },
    });
  }, 'writeDiscovery must not throw with the Brain key absent');
  assert.equal(res.wrote_node_count >= 3, true, 'wrote the core RS nodes locally');

  // Resolve the expert network straight from the LOCAL room.db -- no Brain call anywhere.
  const h = await lazygraph.openGraph(tmp);
  const db = h.conn;
  const author = db.prepare(
    "SELECT properties FROM nodes WHERE type='Author'"
  ).get();
  const inst = db.prepare(
    "SELECT properties FROM nodes WHERE type='Institution'"
  ).get();
  assert.notEqual(author, undefined, 'Author node resolved from LOCAL room.db (Tier-0)');
  assert.notEqual(inst, undefined, 'Institution node resolved from LOCAL room.db (Tier-0)');
  assert.equal(JSON.parse(author.properties).name, 'Ada Placeholder', 'Author identity is LOCAL');
  assert.equal(JSON.parse(inst.properties).name, 'Fictional Systems Lab', 'Institution is LOCAL');
  await lazygraph.closeGraph(h.db);

  // Restore env so the test leaves no footprint.
  if (savedKey !== undefined) process.env.MINDRIAN_BRAIN_API_KEY = savedKey;
  if (savedNeo !== undefined) process.env.NEO4J_URI = savedNeo;
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('  1b) Tier-0 resolves Author+Institution from LOCAL room.db, Brain key absent, no throw -- PASS');
  console.log('\nPASS test-200-local-tier0');
}

main().catch((e) => { console.error('FAIL test-200-local-tier0:', e && e.message ? e.message : e); process.exit(1); });
