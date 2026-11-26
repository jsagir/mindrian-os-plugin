'use strict';
// Phase 400.4 plan 04 (QA-F7): the neighbourhood walk follows edges in both directions.
// Legs W1 to W7. Run with HOME and MINDRIAN_ROOMS_HOME in temp dirs (the runner does this).
// Each leg builds its own temp room.db; nothing touches ~/MindrianRooms.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

const dirs = [];
function makeRoom(nodes, edges) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-40040-twoway-'));
  dirs.push(tmp);
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const now = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, '{}', ?, 'user', 0.6, 'confirmed', ?, ?, ?)");
  for (const n of nodes) insN.run(n[0], n[1], 'fixture/' + n[0].replace(/[^a-z0-9]/gi, '_') + '.md', now, now, n[2] || 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  for (const e of edges) insE.run(e[0], e[1], e[2]);
  return db;
}

function main() {
  // W1: a section with 27 inbound BELONGS_TO edges and none outbound.
  {
    const nodes = [['section:market', 'section']];
    const edges = [];
    for (let i = 0; i < 27; i++) {
      nodes.push(['artifact:a' + i, 'artifact']);
      edges.push(['artifact:a' + i, 'section:market', 'BELONGS_TO']);
    }
    const db = makeRoom(nodes, edges);
    const r = navigation.getNeighborhood(db, 'section:market', { maxDepth: 1, topK: 50 });
    const ids = r.map((x) => x.id).sort();
    const want = nodes.slice(1).map((n) => n[0]).sort();
    check('W1 a section with only inbound edges returns its 27 notes', r.length === 27 && JSON.stringify(ids) === JSON.stringify(want), 'got ' + r.length);
    const row = r[0] || {};
    check('W1 each row has depth 1, directionIn in, edgeDirs [in], BELONGS_TO, edgePath [section, artifact]',
      r.length === 27 && r.every((x) => x.depth === 1 && x.directionIn === 'in' && JSON.stringify(x.edgeDirs) === '["in"]'
        && x.edgeTypeIn === 'BELONGS_TO' && x.edgePath.length === 2 && x.edgePath[0] === 'section:market' && x.edgePath[1] === x.id),
      JSON.stringify(row));
    db.close();
  }

  // W2: a note with one inbound WHITESPACE_DETECTED edge and one outbound INFORMS edge.
  {
    const db = makeRoom(
      [['note:n', 'claim'], ['ws:w', 'whitespace'], ['claim:c', 'claim']],
      [['ws:w', 'note:n', 'WHITESPACE_DETECTED'], ['note:n', 'claim:c', 'INFORMS']]);
    const r = navigation.getNeighborhood(db, 'note:n', { maxDepth: 1, topK: 10 });
    const byId = Object.fromEntries(r.map((x) => [x.id, x]));
    check('W2 the inbound and the outbound neighbour are both returned',
      r.length === 2 && byId['ws:w'] && byId['claim:c'], JSON.stringify(r.map((x) => x.id)));
    check('W2 directionIn is in for the inbound edge and out for the outbound edge',
      byId['ws:w'] && byId['ws:w'].directionIn === 'in' && byId['ws:w'].edgeTypeIn === 'WHITESPACE_DETECTED'
      && byId['claim:c'] && byId['claim:c'].directionIn === 'out' && byId['claim:c'].edgeTypeIn === 'INFORMS');
    db.close();
  }

  // W3: depth 2 through mixed directions.
  {
    const db = makeRoom(
      [['focus:f', 'claim'], ['a:a', 'claim'], ['b:b', 'claim']],
      [['focus:f', 'a:a', 'SUPPORTS'], ['b:b', 'a:a', 'INFORMS']]);
    const r = navigation.getNeighborhood(db, 'focus:f', { maxDepth: 2, topK: 10 });
    const b = r.find((x) => x.id === 'b:b');
    check('W3 B is reached at depth 2 with edgeDirs [out, in]',
      !!b && b.depth === 2 && JSON.stringify(b.edgeDirs) === '["out","in"]' && b.directionIn === 'in'
      && JSON.stringify(b.edgePath) === '["focus:f","a:a","b:b"]', JSON.stringify(b));
    db.close();
  }

  // W4: no row has the focus id; a 2-cycle returns b at most twice and never a.
  {
    const db = makeRoom(
      [['cyc:a', 'claim'], ['cyc:b', 'claim']],
      [['cyc:a', 'cyc:b', 'INFORMS'], ['cyc:b', 'cyc:a', 'INFORMS']]);
    const r = navigation.getNeighborhood(db, 'cyc:a', { maxDepth: 5, topK: 50 });
    check('W4 the focus never comes back as a neighbour', r.every((x) => x.id !== 'cyc:a'), JSON.stringify(r.map((x) => x.id)));
    check('W4 a 2-cycle gives b at most twice, both at depth 1',
      r.length >= 1 && r.length <= 2 && r.every((x) => x.id === 'cyc:b' && x.depth === 1), JSON.stringify(r.map((x) => [x.id, x.depth])));
    // No path visits a node twice, on a larger tangle too.
    const ids = ['t:1', 't:2', 't:3', 't:4'];
    const db2 = makeRoom(ids.map((i) => [i, 'claim']),
      [['t:1', 't:2', 'INFORMS'], ['t:2', 't:3', 'INFORMS'], ['t:3', 't:1', 'INFORMS'], ['t:3', 't:4', 'INFORMS'], ['t:4', 't:2', 'INFORMS']]);
    const r2 = navigation.getNeighborhood(db2, 't:1', { maxDepth: 5, topK: 200 });
    check('W4 no edgePath repeats a node, and no row is the focus',
      r2.length > 0 && r2.every((x) => new Set(x.edgePath).size === x.edgePath.length && x.id !== 't:1'), JSON.stringify(r2.map((x) => x.edgePath)));
    db.close(); db2.close();
  }

  // W5: edge-type weights unchanged; either direction.
  {
    const db = makeRoom(
      [['w:f', 'claim'], ['w:contra', 'claim'], ['w:supp', 'claim'], ['w:info', 'claim'], ['w:belong', 'claim']],
      [['w:contra', 'w:f', 'CONTRADICTS'], ['w:f', 'w:supp', 'SUPPORTS'], ['w:info', 'w:f', 'INFORMS'], ['w:f', 'w:belong', 'BELONGS_TO']]);
    const r = navigation.getNeighborhood(db, 'w:f', { maxDepth: 1, topK: 10 });
    check('W5 CONTRADICTS before SUPPORTS before INFORMS before BELONGS_TO, in either direction',
      JSON.stringify(r.map((x) => x.id)) === JSON.stringify(['w:contra', 'w:supp', 'w:info', 'w:belong']), JSON.stringify(r.map((x) => [x.id, x.score])));
    db.close();
  }

  // W6: the outbound-only rows of the base fixture keep ids, depths and scores; only inbound rows are added.
  {
    const nodes = [['focus:001', 'decision'], ['claim:contra', 'claim'], ['claim:supp', 'claim'], ['claim:info', 'claim', 'other'], ['evidence:e1', 'evidence']];
    const out = [['focus:001', 'claim:contra', 'CONTRADICTS'], ['focus:001', 'claim:supp', 'SUPPORTS'], ['focus:001', 'claim:info', 'INFORMS'], ['claim:supp', 'evidence:e1', 'SUPPORTS']];
    const dbA = makeRoom(nodes, out);
    const dbB = makeRoom(nodes.concat([['extra:x', 'claim']]), out.concat([['extra:x', 'focus:001', 'INFORMS']]));
    const rA = navigation.getNeighborhood(dbA, 'focus:001', { maxDepth: 2, topK: 50 });
    const rB = navigation.getNeighborhood(dbB, 'focus:001', { maxDepth: 2, topK: 50 });
    const outRows = rB.filter((x) => x.directionIn === 'out');
    // The score has a recency term read at call time, so compare within a small tolerance.
    const same = outRows.length === rA.length && rA.every((a) => {
      const b = outRows.find((x) => x.id === a.id && x.depth === a.depth);
      return b && Math.abs(b.score - a.score) < 1e-6;
    });
    check('W6 outbound rows keep ids, depths and scores', same, JSON.stringify([rA.map((x) => [x.id, x.depth, x.score]), outRows.map((x) => [x.id, x.depth, x.score])]));
    check('W6 only the inbound row is added', rB.length === rA.length + 1 && rB.some((x) => x.id === 'extra:x' && x.directionIn === 'in'), String(rB.length));
    dbA.close(); dbB.close();
  }

  // W7: edgePath entries are strings; edgeDirs length equals depth.
  {
    const db = makeRoom(
      [['s:f', 'claim'], ['s:a', 'claim'], ['s:b', 'claim'], ['s:c', 'claim']],
      [['s:f', 's:a', 'SUPPORTS'], ['s:b', 's:a', 'INFORMS'], ['s:c', 's:f', 'INFORMS']]);
    const r = navigation.getNeighborhood(db, 's:f', { maxDepth: 3, topK: 50 });
    check('W7 every edgePath entry is a string and edgeDirs length equals depth',
      r.length > 0 && r.every((x) => x.edgePath.every((p) => typeof p === 'string') && Array.isArray(x.edgeDirs) && x.edgeDirs.length === x.depth),
      JSON.stringify(r));
    db.close();
  }

  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
  console.log(failures === 0 ? 'ALL PASS test-400.4-two-way-neighbourhood' : 'FAILED ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

try { main(); } catch (e) { console.log('FAIL test crashed: ' + (e && e.stack || e)); process.exit(1); }
