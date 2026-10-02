#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366-09: canon Framework handles where things are born, hermetic.
 *   K1-K5 artifact_file (lib/mcp/tools/views.cjs fileArtifact): a hit leaves a
 *         framework node and one USES_FRAMEWORK edge; a miss writes nothing and
 *         reports canon_handle null; a writer failure never blocks the filing.
 *   K6-K9 the indexer (lib/core/lazygraph-ops.cjs rebuildGraph): same handle on
 *         rebuild, idempotent, other indexer output unchanged.
 * Fully local: no network, no Brain, no model. Rooms live under mkdtemp.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate from the machine's real rooms BEFORE any repo module loads.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: () => 0, restore: function () {} };
const C = hygiene.makeChecker('test-366-canon-at-filing');

const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
const stamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));
const views = require(path.join(REPO_ROOT, 'lib/mcp/tools/views.cjs'));
const lazygraph = require(path.join(REPO_ROOT, 'lib/core/lazygraph-ops.cjs'));

const CANON = 'Reverse Salient Analysis';
const CANON2 = 'Four Lenses of Innovation';
const names = stamp.loadFrameworkNames();
const registry = stamp.loadCommandFrameworks();
// A command slug the registry maps to a canon name, so the methodology leg
// asserts what resolveEndpoint itself returns rather than a guess.
let METH_SLUG = null;
let METH_CANON = null;
for (const [slug, fws] of registry) {
  if (Array.isArray(fws) && fws.length > 0 && names.has(fws[0])) {
    METH_SLUG = slug.replace(/^\/mos:/, '');
    METH_CANON = fws[0];
    break;
  }
}

function mkRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-' + label + '-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: filing-fixture\n---\n');
  return { root, roomDir };
}

function frameworkRows(db) {
  return db.prepare("SELECT id FROM nodes WHERE type = 'framework'").all();
}
function usesEdges(db) {
  return db.prepare("SELECT source, target FROM edges WHERE type = 'USES_FRAMEWORK'").all();
}
function danglingEdges(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM edges e WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.source) OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.target)').get().n;
}
function typeCounts(db) {
  const out = {};
  for (const r of db.prepare('SELECT type, COUNT(*) AS n FROM nodes GROUP BY type').all()) out[r.type] = r.n;
  return out;
}

(async function main() {
  // ---------------------------------------------------------------- K1-K5
  const fx = mkRoom('file');
  const db = roomDb.openRoomDb(fx.roomDir);
  try {
    // K1: a canon framework in frontmatter
    const r1 = views._internal.fileArtifact(db, fx.roomDir, {
      section: 'problem-definition', filename: 'rsa-note',
      content: '---\nframework: ' + CANON + '\n---\n\nThe reverse salient is the bottleneck.\n',
    });
    C.check('K1 filing ok', r1.ok === true, JSON.stringify(r1).slice(0, 200));
    C.check('K1 canon_handle is the canon name', r1.canon_handle === CANON && r1.canon_via === 'framework', JSON.stringify([r1.canon_handle, r1.canon_via]));
    const fw1 = frameworkRows(db);
    const ed1 = usesEdges(db);
    C.check('K1 one framework node and one USES_FRAMEWORK edge', fw1.length === 1 && ed1.length === 1, JSON.stringify([fw1, ed1]));
    C.check('K1 edge runs from the filed node to the framework node', ed1.length === 1 && ed1[0].target === fw1[0].id && /^claim:artifact/.test(ed1[0].source), JSON.stringify(ed1));
    C.check('K1 canon_edge reports ok', r1.canon_edge && r1.canon_edge.ok === true, JSON.stringify(r1.canon_edge));

    // refiling the same framework on a second artifact reuses the node
    const r1b = views._internal.fileArtifact(db, fx.roomDir, {
      section: 'problem-definition', filename: 'rsa-note-two',
      content: '---\nframework: ' + CANON + '\n---\n\nSecond note.\n',
    });
    C.check('K1b a second artifact reuses the framework node, adds one edge', r1b.ok === true && frameworkRows(db).length === 1 && usesEdges(db).length === 2);

    // K2: methodology resolved through the command registry
    if (METH_SLUG) {
      const r2 = views._internal.fileArtifact(db, fx.roomDir, {
        section: 'problem-definition', filename: 'meth-note',
        content: '---\nmethodology: ' + METH_SLUG + '\n---\n\nA methodology-led artifact.\n',
      });
      C.check('K2 methodology resolves through the registry', r2.ok === true && r2.canon_handle === METH_CANON && r2.canon_via === 'methodology', JSON.stringify([METH_SLUG, r2.canon_handle, r2.canon_via]));
    } else {
      C.check('K2 registry has a canon-mapped command', false, 'no command maps to a canon name');
    }

    // K3: a non-canon framework writes nothing
    const before = { fw: frameworkRows(db).length, ed: usesEdges(db).length };
    const r3 = views._internal.fileArtifact(db, fx.roomDir, {
      section: 'problem-definition', filename: 'invented',
      content: '---\nframework: Totally Invented Framework\ntitle: Nothing Canon\n---\n\nNot canon.\n',
    });
    C.check('K3 non-canon: filing ok, canon_handle null, canon_via null', r3.ok === true && r3.canon_handle === null && r3.canon_via === null, JSON.stringify([r3.canon_handle, r3.canon_via]));
    C.check('K3 non-canon writes no framework node or edge', frameworkRows(db).length === before.fw && usesEdges(db).length === before.ed);
    const r3b = views._internal.fileArtifact(db, fx.roomDir, { section: 'problem-definition', filename: 'no-frontmatter', content: 'Plain text, no frontmatter.\n' });
    C.check('K3 no frontmatter: canon_handle null, no write', r3b.ok === true && r3b.canon_handle === null && usesEdges(db).length === before.ed);

    // K4: a writer failure never blocks the filing
    const realLink = navigation.linkThingToFramework;
    let threw = null;
    let r4 = null;
    navigation.linkThingToFramework = function () { throw new Error('forced writer failure'); };
    try {
      r4 = views._internal.fileArtifact(db, fx.roomDir, {
        section: 'problem-definition', filename: 'forced-fail',
        content: '---\nframework: ' + CANON2 + '\n---\n\nWriter will throw.\n',
      });
    } catch (e) {
      threw = e;
    } finally {
      navigation.linkThingToFramework = realLink;
    }
    C.check('K4 a throwing writer does not throw out of the filing', threw === null, String(threw && threw.message));
    C.check('K4 filing still ok, canon_edge reports the failure', r4 && r4.ok === true && r4.canon_edge && r4.canon_edge.ok === false && typeof r4.canon_edge.reason === 'string', JSON.stringify(r4 && r4.canon_edge));
    C.check('K4 the filed file and reasoning node still exist', r4 && fs.existsSync(path.join(fx.roomDir, r4.file_path)) && r4.reasoning_node && r4.reasoning_node.ok === true);
    // a writer that returns not-ok (not throws) is reported the same way
    navigation.linkThingToFramework = function () { return { ok: false, node_id: null, edge: null, reason: 'write_failed' }; };
    let r4b = null;
    try {
      r4b = views._internal.fileArtifact(db, fx.roomDir, { section: 'problem-definition', filename: 'forced-fail-two', content: '---\nframework: ' + CANON2 + '\n---\n\nx\n' });
    } finally { navigation.linkThingToFramework = realLink; }
    C.check('K4b a not-ok writer is reported, filing ok', r4b && r4b.ok === true && r4b.canon_edge && r4b.canon_edge.ok === false && r4b.canon_edge.reason === 'write_failed');

    // K5: no dangling edge endpoints
    C.check('K5 edge_rows_missing_endpoint stays 0', danglingEdges(db) === 0, String(danglingEdges(db)));
  } finally {
    try { roomDb.closeRoomDb(db); } catch (_e) { /* tmp */ }
  }

  // ---------------------------------------------------------------- K6-K9
  const ix = mkRoom('index');
  fs.mkdirSync(path.join(ix.roomDir, 'problem-definition'), { recursive: true });
  fs.mkdirSync(path.join(ix.roomDir, 'solution-design'), { recursive: true });
  fs.writeFileSync(path.join(ix.roomDir, 'problem-definition', 'lens.md'), '---\nframework: ' + CANON2 + '\n---\n\n# Lens\n\nBody.\n');
  fs.writeFileSync(path.join(ix.roomDir, 'problem-definition', 'plain.md'), '# Plain\n\nNo frontmatter.\n');
  fs.writeFileSync(path.join(ix.roomDir, 'solution-design', 'other.md'), '---\nframework: Not A Canon Name\n---\n\n# Other\n\nBody.\n');

  const { db: gdb } = await lazygraph.openGraph(ix.roomDir);
  try {
    const rb1 = await lazygraph.rebuildGraph(gdb, ix.roomDir);
    C.check('K6 rebuild succeeds', rb1.success === true, JSON.stringify(rb1));
    const fw = frameworkRows(gdb);
    const ed = usesEdges(gdb);
    C.check('K6 one framework node and one USES_FRAMEWORK edge for the canon artifact', fw.length === 1 && ed.length === 1, JSON.stringify([fw, ed]));
    C.check('K6 edge source is the Artifact node, target the framework node', ed.length === 1 && ed[0].source === 'problem-definition/lens' && ed[0].target === fw[0].id, JSON.stringify(ed));
    const counts1 = typeCounts(gdb);

    const rb2 = await lazygraph.rebuildGraph(gdb, ix.roomDir);
    C.check('K7 second rebuild leaves the same counts (idempotent)', rb2.success === true && frameworkRows(gdb).length === 1 && usesEdges(gdb).length === 1);
    C.check('K7 node type counts identical across rebuilds', JSON.stringify(typeCounts(gdb)) === JSON.stringify(counts1), JSON.stringify([counts1, typeCounts(gdb)]));
    C.check('K7 no dangling edge endpoints', danglingEdges(gdb) === 0, String(danglingEdges(gdb)));

    // K8: the unchanged indexer output
    C.check('K8 Artifact and Section counts are the fixture counts', counts1.Artifact === 3 && counts1.Section === 2, JSON.stringify(counts1));
    const belongs = gdb.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'BELONGS_TO'").get().n;
    C.check('K8 BELONGS_TO count unchanged (one per artifact)', belongs === 3, String(belongs));
  } finally {
    await lazygraph.closeGraph(gdb);
  }

  // K9: a room with no resolvable artifacts writes zero framework nodes
  const nx = mkRoom('none');
  fs.mkdirSync(path.join(nx.roomDir, 'problem-definition'), { recursive: true });
  fs.writeFileSync(path.join(nx.roomDir, 'problem-definition', 'a.md'), '---\nframework: Not A Canon Name\n---\n\n# A\n');
  fs.writeFileSync(path.join(nx.roomDir, 'problem-definition', 'b.md'), '# B\n\nplain\n');
  const { db: ndb } = await lazygraph.openGraph(nx.roomDir);
  try {
    const rbn = await lazygraph.rebuildGraph(ndb, nx.roomDir);
    C.check('K9 no resolvable artifacts: zero framework nodes and edges', rbn.success === true && frameworkRows(ndb).length === 0 && usesEdges(ndb).length === 0);
  } finally {
    await lazygraph.closeGraph(ndb);
  }

  const attempts = (net && typeof net.attempts === 'function') ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  for (const d of [fx.root, ix.root, nx.root, TMP_HOME]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* tmp */ } }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-366-canon-at-filing THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
