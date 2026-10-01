#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 plan 01: the shared planted-room fixture (tests/helpers/fixture-366.cjs)
 * builds a four-section room.db with one planted pair per perspective; the
 * eureka recall finds its planted pair, excludes the planted known pair, every
 * planted edge has both endpoints, and nothing reaches the network.
 * Exit 77 when node:sqlite is missing (ENV GAP). Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate from the machine's real rooms BEFORE any repo module loads.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-fx-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-fx-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-366-fixture-helper');

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const recall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { countGraphIntegrity } = require(path.join(REPO_ROOT, 'lib/core/navigation/graph-integrity-counts.cjs'));

function hasPair(cands, pair) {
  return cands.some(function (c) { return (c.a === pair[0] && c.b === pair[1]) || (c.a === pair[1] && c.b === pair[0]); });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-fx-'));
let exitCode = 1;
try {
  const built = fixture.buildPerspectiveRoom(root);
  const planted = built.planted;

  // shape
  const KEYS = ['eureka', 'rs', 'hsi', 'whitespace', 'analogies', 'connections', 'known'];
  C.check('planted has a pair per perspective plus known', KEYS.every(function (k) { return Array.isArray(planted[k]) && planted[k].length === 2 && planted[k].every(function (x) { return typeof x === 'string' && x; }); }), JSON.stringify(planted));
  C.check('room.db exists at dbPath', !!built.dbPath && fs.existsSync(built.dbPath), String(built.dbPath));
  fixture.SECTIONS.forEach(function (sec) {
    const ctx = path.join(built.roomDir, sec, 'CONTEXT.md');
    C.check('CONTEXT.md with ## Inputs in ' + sec, fs.existsSync(ctx) && /^## Inputs$/m.test(fs.readFileSync(ctx, 'utf8')));
  });
  C.check('references/ exists', fs.existsSync(path.join(built.roomDir, 'references')));

  // graph integrity: every planted edge has both endpoints
  const db = roomDb.openRoomDb(built.roomDir);
  let integrity = null; let ids = null; let edgeTypes = null;
  try {
    integrity = countGraphIntegrity(db);
    ids = new Set(db.prepare('SELECT id FROM nodes').all().map(function (r) { return r.id; }));
    edgeTypes = db.prepare('SELECT type, COUNT(*) AS n FROM edges GROUP BY type').all().reduce(function (acc, r) { acc[r.type] = r.n; return acc; }, {});
  } finally { roomDb.closeRoomDb(db); }
  C.check('edge_rows_missing_endpoint is 0 on the built room.db', integrity && integrity.edge_rows_missing_endpoint === 0, JSON.stringify(integrity && integrity.edge_rows_missing_endpoint));
  C.check('every planted id is a node', KEYS.every(function (k) { return planted[k].every(function (x) { return ids.has(x); }); }));
  C.check('WhitespaceZone and framework: nodes minted', ids.has(built.ids.whitespace_zone) && built.ids.frameworks.every(function (f) { return ids.has(f); }));
  C.check('planted edge types present', ['INFORMS', 'DESCRIBES', 'WHITESPACE_DETECTED', 'USES_FRAMEWORK', 'DERIVED_FROM', 'BELONGS_TO'].every(function (t) { return edgeTypes[t] > 0; }), JSON.stringify(edgeTypes));

  // eureka recall on the built room
  const rec = recall.runRecall(built.roomDir, { tag: '20261001T000000Z' });
  C.check('recall ok over four sections', rec.ok === true && rec.counts.sections === 4, JSON.stringify(rec.counts));
  C.check('planted eureka pair among candidates', hasPair(rec.candidates, planted.eureka), rec.candidates.map(function (c) { return c.a + '|' + c.b; }).join(','));
  const eu = rec.candidates.filter(function (c) { return hasPair([c], planted.eureka); })[0];
  C.check('eureka pair carries shared_entity and lexical lanes', !!eu && eu.lanes.indexOf('shared_entity') !== -1 && eu.lanes.indexOf('lexical') !== -1, eu && eu.lanes.join(','));
  C.check('planted known pair NOT among candidates', !hasPair(rec.candidates, planted.known));
  C.check('opportunity evidence pair NOT among candidates', !hasPair(rec.candidates, built.ids.opportunity_pair));
  C.check('counts.excluded_known is at least 1', rec.counts.excluded_known >= 1, String(rec.counts.excluded_known));
  C.check('canon handles resolve on the connections pair', rec.counts.canon_resolved >= 2, String(rec.counts.canon_resolved));

  // withoutDb leg
  const bare = fixture.buildPerspectiveRoom(root, { name: 'bare', withoutDb: true });
  C.check('withoutDb skips room.db', bare.dbPath === null && !fs.existsSync(path.join(bare.roomDir, '.mindrian', 'room.db')));

  const attempts = typeof net.attempts === 'function' ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  exitCode = C.summary();
} catch (e) {
  process.stderr.write('test-366-fixture-helper THREW: ' + String(e && e.stack ? e.stack : e) + '\n');
  exitCode = 1;
} finally {
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
}
process.exit(exitCode);
