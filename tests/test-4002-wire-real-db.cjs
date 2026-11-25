#!/usr/bin/env node
'use strict';
// Phase 400.2-13: the research leg against a real room.db (PS-04, owner answer 1 / FS-6).
// Legs W1 to W7. Every room and every room.db is created by this test under os.tmpdir(); no user room is touched.
// No test sends a network request: every fetch goes through the injected seam _fetchCorpusEnvelope.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const { door, navigation, RESEARCH, NO_KEYS } = fx;

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

const FIXED_URL = 'https://example.org/shared-page';

function nodeRows(room, sql, ...params) {
  const db = navigation.openRoomDbForCaller(room);
  try {
    return db.prepare(sql).all(...params);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

check('W1. a real room.db: 3 findings for one approved string give 3 proposed EvidenceClaim nodes, 3 INFORMS edges to section:personas and 3 pack items with the node ids', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const ctx = fx.planned();
    const base = fx.dbCounts(ctx.room);
    assert.deepEqual({ claims: base.claims, informs: base.informs }, { claims: 0, informs: 0 });
    const seam = fx.makeSeam(null, 3);
    const first = ctx.plan.hats.white.strings[0];
    const out = await fx.go(ctx, fx.approvedFile(ctx, { white: fx.approveHat(ctx.plan, 'white', [first.q_hash]) }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'ran_with_results');
    const claims = nodeRows(ctx.room, "SELECT id, review_status FROM nodes WHERE type = 'EvidenceClaim' ORDER BY id");
    assert.equal(claims.length, 3, JSON.stringify(claims));
    for (const c of claims) assert.equal(c.review_status, 'proposed', c.id);
    const edges = nodeRows(ctx.room, "SELECT source, target FROM edges WHERE type = 'INFORMS'");
    assert.equal(edges.length, 3, JSON.stringify(edges));
    for (const e of edges) {
      assert.equal(e.target, 'section:personas');
      assert.ok(claims.some(c => c.id === e.source), e.source);
    }
    const pack = fx.packOf(ctx, 'white');
    assert.equal(pack.items.length, 3);
    assert.deepEqual(pack.items.map(i => i.id).sort(), claims.map(c => c.id).sort());
  });
});

check('W2. the same string in a new run of the same room adds zero EvidenceClaim nodes and zero INFORMS edges; the pack has the same 3 ids', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const ctx = fx.planned();
    const first = ctx.plan.hats.white.strings[0];
    const out1 = await fx.go(ctx, fx.approvedFile(ctx, { white: fx.approveHat(ctx.plan, 'white', [first.q_hash]) }), fx.makeSeam(null, 3));
    assert.equal(out1.ok, true, JSON.stringify(out1));
    const ids1 = fx.packOf(ctx, 'white').items.map(i => i.id).sort();
    const c1 = fx.dbCounts(ctx.room);
    assert.equal(c1.claims, 3);
    const t1 = Object.fromEntries(nodeRows(ctx.room, 'SELECT type, COUNT(*) AS n FROM nodes GROUP BY type').map(r => [r.type, r.n]));
    // A second run of the same room with the same handles gives the same string, hash and session id.
    const ctx2 = fx.planned({ room: ctx.room, env: ctx.env });
    assert.notEqual(ctx2.res.run_id, ctx.res.run_id);
    const second = ctx2.plan.hats.white.strings[0];
    assert.equal(second.q_hash, first.q_hash, 'the same string');
    const out2 = await fx.go(ctx2, fx.approvedFile(ctx2, { white: fx.approveHat(ctx2.plan, 'white', [second.q_hash]) }), fx.makeSeam(null, 3));
    assert.equal(out2.ok, true, JSON.stringify(out2));
    const c2 = fx.dbCounts(ctx.room);
    assert.equal(c2.claims, c1.claims, 'zero new EvidenceClaim nodes');
    assert.equal(c2.informs, c1.informs, 'zero new INFORMS edges');
    assert.equal(c2.edges, c1.edges, 'zero new edges');
    // The claim-type nodes do not grow. The event log does: a memory_event row is a log entry with a time stamp, not a claim.
    const typeCounts = () => Object.fromEntries(nodeRows(ctx.room, 'SELECT type, COUNT(*) AS n FROM nodes GROUP BY type').map(r => [r.type, r.n]));
    const t2 = typeCounts();
    assert.equal(t2.EvidenceClaim, 3);
    assert.equal(t2.lens_finding, t1.lens_finding, 'zero new lens_finding nodes');
    assert.ok(t2.memory_event >= t1.memory_event, 'the event log never shrinks');
    assert.deepEqual(fx.packOf(ctx2, 'white').items.map(i => i.id).sort(), ids1);
    assert.equal(fx.packOf(ctx2, 'white').items.length, 3);
  });
});

check('W3. black and yellow fetch a string that returns the same URL: 2 nodes with 2 different ids, one for each session id', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const ctx = fx.planned();
    const seam = fx.makeSeam((a) => fx.okEnv(a.source, [{ title: 'One shared page', url: FIXED_URL, abstract: 'About the field.' }]));
    const hats = {
      black: fx.approveHat(ctx.plan, 'black', [ctx.plan.hats.black.strings[0].q_hash]),
      yellow: fx.approveHat(ctx.plan, 'yellow', [ctx.plan.hats.yellow.strings[0].q_hash]),
    };
    const out = await fx.go(ctx, fx.approvedFile(ctx, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    const claims = nodeRows(ctx.room, "SELECT id FROM nodes WHERE type = 'EvidenceClaim'");
    assert.equal(claims.length, 2, JSON.stringify(claims));
    assert.notEqual(claims[0].id, claims[1].id);
    const black = fx.packOf(ctx, 'black').items;
    const yellow = fx.packOf(ctx, 'yellow').items;
    assert.equal(black.length, 1);
    assert.equal(yellow.length, 1);
    assert.equal(black[0].url, FIXED_URL);
    assert.equal(yellow[0].url, FIXED_URL);
    assert.notEqual(black[0].id, yellow[0].id);
    assert.ok(black[0].id.startsWith('EvidenceClaim:persona-black-'), black[0].id);
    assert.ok(yellow[0].id.startsWith('EvidenceClaim:persona-yellow-'), yellow[0].id);
  });
});

check('W4. every claim node written by the door has the status proposed; the only confirmed rows are system event-log entries', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const ctx = fx.planned();
    const out = await fx.go(ctx, fx.approvedFile(ctx, fx.approveAll(ctx.plan)), fx.makeSeam());
    assert.equal(out.ok, true, JSON.stringify(out));
    const mine = nodeRows(ctx.room, "SELECT id, review_status FROM nodes WHERE id LIKE 'EvidenceClaim:persona-%'");
    assert.ok(mine.length >= 4, 'at least one node for each researching hat');
    for (const n of mine) assert.equal(n.review_status, 'proposed', n.id);
    // Every node that the run wrote and that is not proposed is a memory_event: a log entry (Part 9: a log is not a truth claim).
    const notProposed = nodeRows(ctx.room, "SELECT id, type, review_status, created_by FROM nodes WHERE review_status != 'proposed'");
    for (const n of notProposed) {
      assert.equal(n.type, 'memory_event', 'a non-proposed row is an event-log entry: ' + n.id);
      assert.equal(n.created_by, 'system', n.id);
    }
    const claimTypes = nodeRows(ctx.room, "SELECT DISTINCT type FROM nodes WHERE review_status = 'proposed'").map(r => r.type).sort();
    assert.deepEqual(claimTypes, ['EvidenceClaim', 'lens_finding']);
    const edgeStatuses = nodeRows(ctx.room, "SELECT DISTINCT review_status AS s FROM edges WHERE type = 'INFORMS'");
    for (const e of edgeStatuses) assert.notEqual(e.s, 'confirmed');
  });
});

check('W5. the door creates no node with the id section:personas; the edges point at the id without a node (a permitted state)', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const ctx = fx.planned();
    const out = await fx.go(ctx, fx.approvedFile(ctx, fx.approveAll(ctx.plan)), fx.makeSeam());
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(nodeRows(ctx.room, "SELECT COUNT(*) AS n FROM nodes WHERE id = 'section:personas'")[0].n, 0);
    const targets = nodeRows(ctx.room, "SELECT DISTINCT target FROM edges WHERE type = 'INFORMS'").map(r => r.target);
    assert.deepEqual(targets, ['section:personas']);
  });
});

check('W6. NEGATIVE: a self-found source is never wired: check changes no row; merge adds no EvidenceClaim node, no edge and no node that holds the URL', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    const { ctx } = await fx.researched({ hats: (plan) => ({ white: fx.approveHat(plan, 'white') }) });
    const SELF_A = 'https://self-found.example.net/alpha-page';
    const SELF_B = 'https://self-found.example.net/beta-page';
    const sources = [
      { url: SELF_A, title: 'Alpha page', search_string: 'grid storage costs', summary: 'About alpha.' },
      { url: SELF_B, title: 'Beta page', search_string: 'grid storage costs', summary: 'About beta.' },
    ];
    const white = fx.readingOf(ctx, 'white', {
      evidence: [{ source: SELF_A, tier: 'self_found', note: 'Found by the hat.' }],
      self_search_strings: ['grid storage costs'],
      self_found_sources: sources,
    });
    fx.writeReading(ctx, 'white', white);
    for (const h of ['red', 'black', 'yellow', 'green']) fx.writeReading(ctx, h, fx.readingOf(ctx, h));
    fx.writeReading(ctx, 'blue', fx.blueReadingOf(ctx));
    const before = fx.dbCounts(ctx.room);
    const typesBefore = Object.fromEntries(nodeRows(ctx.room, 'SELECT type, COUNT(*) AS n FROM nodes GROUP BY type').map(r => [r.type, r.n]));
    assert.ok(before.claims >= 1, 'the white pack was wired');
    const c = fx.doCheck(ctx);
    assert.equal(c.ok, true, JSON.stringify(c));
    assert.equal(c.hats.white.reading, 'ran', JSON.stringify(c.hats.white));
    assert.equal(c.hats.white.self_found_sources, 2);
    assert.deepEqual(fx.dbCounts(ctx.room), before, 'check changes no row');
    const m = await fx.doMerge(ctx);
    assert.equal(m.ok, true, JSON.stringify(m));
    const after = fx.dbCounts(ctx.room);
    assert.equal(after.claims, before.claims, 'no new EvidenceClaim node');
    assert.equal(after.edges, before.edges, 'no new edge');
    assert.equal(after.informs, before.informs, 'no new INFORMS edge');
    // The merge may write bookkeeping rows (HatState counters, event-log entries) and nothing else: name every node type.
    const typesNow = Object.fromEntries(nodeRows(ctx.room, 'SELECT type, COUNT(*) AS n FROM nodes GROUP BY type').map(r => [r.type, r.n]));
    for (const t of Object.keys(typesNow)) {
      if (!Object.prototype.hasOwnProperty.call(typesBefore, t)) assert.ok(['HatState', 'memory_event'].includes(t), 'a new node type: ' + t);
      else if (typesNow[t] !== typesBefore[t]) assert.ok(['HatState', 'memory_event'].includes(t), 'a changed node count: ' + t);
    }
    const all = nodeRows(ctx.room, 'SELECT id, properties FROM nodes');
    for (const n of all) {
      assert.equal(String(n.id).includes('self-found.example.net'), false, n.id);
      assert.equal(String(n.properties).includes('self-found.example.net'), false, n.id);
    }
    const edgeRows = nodeRows(ctx.room, 'SELECT source, target, properties FROM edges');
    for (const e of edgeRows) assert.equal(JSON.stringify(e).includes('self-found.example.net'), false);
    const events = nodeRows(ctx.room, "SELECT properties FROM nodes WHERE type = 'memory_event'");
    for (const e of events) assert.equal(String(e.properties).includes('self-found.example.net'), false);
  });
});

check('W7. K-9: an old-schema room.db with the edges foreign key gives fetched_not_wired:wire_failed and a pack with zero items', async () => {
  await fx.withEnvAsync(NO_KEYS, async () => {
    // No Phase 169 fixture exists with the old edges DDL, so the test builds the old schema before the first open
    // (the same DDL that tests/test-3692-closure.cjs uses). initSchema keeps an existing table.
    const room = fx.harborRoom();
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    const old = new DatabaseSync(path.join(room, '.mindrian', 'room.db'));
    old.exec("CREATE TABLE nodes(id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}');"
      + " CREATE TABLE edges(source TEXT NOT NULL REFERENCES nodes(id), target TEXT NOT NULL REFERENCES nodes(id), type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY(source,target,type));");
    old.close();
    const ctx = fx.planned({ room });
    const ddl = nodeRows(room, "SELECT sql FROM sqlite_master WHERE name = 'edges'")[0].sql;
    assert.ok(/REFERENCES nodes/i.test(ddl), 'the old edges foreign key is still there');
    const out = await fx.go(ctx, fx.approvedFile(ctx, { white: fx.approveHat(ctx.plan, 'white') }), fx.makeSeam());
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'fetched_not_wired');
    assert.equal(out.reasons.white, 'wire_failed');
    assert.deepEqual(fx.packOf(ctx, 'white').items, []);
    assert.equal(fx.ledgerOf(ctx).hats.white.research, 'fetched_not_wired');
  });
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  fx.cleanup();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
