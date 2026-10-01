// Spike 006, stage 01: the room pull server.
// Reads room.db ONLY through the plugin's navigation chokepoint
// (navigation.openRoomDbReadOnlyForCaller, a mode=ro handle). Never writes,
// never a second store of truth. Serves:
//   GET /pull/nodes?cp=<json>&limit=   changes since checkpoint
//   GET /pull/edges?cp=<json>&limit=
//   GET /stream                        SSE: 'nodes' / 'edges' change batches, 'hello', 'poke', heartbeats
//   GET /census, /ids                  live counts and ids straight from room.db (probe only)
//   GET /                              the stage-02 browser page
// Any non-GET request answers 405: there is no push path for room data.
//
// PULL_MODE picks the checkpoint strategy (the spike compares all three):
//   ts       checkpoint {ts, id}, ts = max(created_at, last_seen_at, last_modified_at).
//            The SEED-105 shape. Measured: loses writes that share a millisecond.
//   settle   same, but never hands out a row younger than PULL_SETTLE_MS, so a
//            later commit cannot land inside an already-passed millisecond.
//   journal  the server keeps an in-memory version index (id -> content stamp)
//            and assigns its own monotonic seq on every observed change,
//            including hard deletes (tombstones) and in-place edge updates.
//            Checkpoint {epoch, seq}. The index is derived and disposable: a
//            restart mints a new epoch and clients re-pull from zero.
// CJS, Node 22, zero deps. No em-dashes.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLUGIN_ROOT = process.env.PLUGIN_ROOT || path.resolve(__dirname, '../../../../..');
const ROOM_DIR = process.env.ROOM_DIR;
const PORT = Number(process.env.PULL_PORT || 3871);
const LOG = process.env.PULL_LOG || null;
const POLL_MS = Number(process.env.PULL_POLL_MS || 500);
const MODE = ['ts', 'settle', 'journal'].includes(process.env.PULL_MODE) ? process.env.PULL_MODE : 'journal';
const SETTLE_MS = Number(process.env.PULL_SETTLE_MS || 50);
if (!ROOM_DIR) { process.stderr.write('ROOM_DIR required\n'); process.exit(2); }

const navigation = require(path.join(PLUGIN_ROOT, 'lib/core/navigation.cjs'));
const PAGE_DIR = path.resolve(__dirname, '../02_browser-replica/output');
const CONFIG_DIR = path.resolve(__dirname, '../../_config');

function logEvent(label, data) {
  if (!LOG) return;
  try { fs.appendFileSync(LOG, JSON.stringify(Object.assign({ ts: Date.now(), label, mode: MODE }, data || {})) + '\n'); } catch (_) {}
}

let db = null;
function getDb() {
  if (db) return db;
  db = navigation.openRoomDbReadOnlyForCaller(ROOM_DIR);
  if (!db) throw new Error('room_db_unavailable');
  return db;
}
function withDb(fn) {
  try { return fn(getDb()); } catch (e) {
    try { if (db) db.close(); } catch (_) {}
    db = null;
    return fn(getDb());
  }
}

// Measured 2026-10-02: insertNode's upsert stamps created_at and last_seen_at but
// NOT last_modified_at (only status transitions and a few property writers bump
// it), so last_modified_at alone misses every insert. ts = the max of the three.
const TS_EXPR = 'MAX(COALESCE(created_at,0), COALESCE(last_seen_at,0), COALESCE(last_modified_at,0))';
const NODE_COLS = 'id, type, properties, source_section, created_by, review_status, last_modified_at, ' + TS_EXPR + ' AS ts';
const NODES_TS_SQL = 'SELECT ' + NODE_COLS + ' FROM nodes WHERE ((' + TS_EXPR + ' > ?) OR (' + TS_EXPR + ' = ? AND id > ?)) AND ' + TS_EXPR + ' < ? ORDER BY ts ASC, id ASC LIMIT ?';
const NODES_ALL_SQL = 'SELECT ' + NODE_COLS + ' FROM nodes';
const EDGES_ROWID_SQL = 'SELECT rowid AS rowid, source, target, type, properties, review_status FROM edges WHERE rowid > ? ORDER BY rowid ASC LIMIT ?';
const EDGES_ALL_SQL = 'SELECT rowid AS rowid, source, target, type, properties, review_status FROM edges';

function labelOf(props) {
  if (!props || typeof props !== 'object') return '';
  for (const k of ['title', 'name', 'text', 'claim', 'label', 'question', 'summary', 'decision', 'event', 'kind']) {
    if (typeof props[k] === 'string' && props[k].trim()) return props[k].trim().slice(0, 200);
  }
  return '';
}
function nodeDoc(r) {
  let props = null;
  try { props = JSON.parse(r.properties || '{}'); } catch (_) { props = null; }
  return {
    id: r.id, type: String(r.type || ''), label: labelOf(props),
    section: String(r.source_section || (props && props.section) || ''),
    status: String(r.review_status || ''), created_by: String(r.created_by || ''),
    ts: Number(r.ts) || 0, lm: Number(r.last_modified_at) || 0,
    props: String(r.properties || '').slice(0, 2000),
    // Canon Part 9: superseded entries are closed, never deleted. In the browser
    // copy they become RxDB soft-deletes, so default queries drop them.
    _deleted: r.review_status === 'superseded',
  };
}
function edgeDoc(r) {
  return {
    id: r.type + '|' + r.source + '|' + r.target, source: r.source, target: r.target, type: r.type,
    status: String(r.review_status || ''), rowid: Number(r.rowid),
    props: String(r.properties || '').slice(0, 1000),
    _deleted: r.review_status === 'superseded',
  };
}
function tombstone(kind, id) {
  return kind === 'nodes'
    ? { id, type: '', label: '', section: '', status: 'deleted', created_by: '', ts: 0, lm: 0, props: '', _deleted: true }
    : { id, source: '', target: '', type: '', status: 'deleted', rowid: 0, props: '', _deleted: true };
}

// ---------------------------------------------------------------------------
// Strategy: ts / settle
// ---------------------------------------------------------------------------
function tsPullNodes(cp, limit) {
  const ts = cp && Number.isFinite(cp.ts) ? cp.ts : -1;
  const id = cp && typeof cp.id === 'string' ? cp.id : '';
  const ceiling = MODE === 'settle' ? Date.now() - SETTLE_MS : Number.MAX_SAFE_INTEGER;
  const rows = withDb((d) => d.prepare(NODES_TS_SQL).all(ts, ts, id, ceiling, limit));
  const documents = rows.map(nodeDoc);
  const last = rows[rows.length - 1];
  return { documents, checkpoint: last ? { ts: Number(last.ts), id: last.id } : (cp || null) };
}
function rowidPullEdges(cp, limit) {
  const rowid = cp && Number.isFinite(cp.rowid) ? cp.rowid : 0;
  const rows = withDb((d) => d.prepare(EDGES_ROWID_SQL).all(rowid, limit));
  const last = rows[rows.length - 1];
  return { documents: rows.map(edgeDoc), checkpoint: last ? { rowid: Number(last.rowid) } : (cp || null) };
}

// ---------------------------------------------------------------------------
// Strategy: journal
// ---------------------------------------------------------------------------
const EPOCH = crypto.randomBytes(6).toString('hex');
let SEQ = 0;
const J = { nodes: new Map(), edges: new Map() }; // id -> { stamp, seq, doc }
function stampOf(doc) { return crypto.createHash('sha1').update(JSON.stringify(doc)).digest('base64'); }
function refreshJournal() {
  const t0 = Date.now();
  let changed = 0;
  const kinds = [
    ['nodes', () => withDb((d) => d.prepare(NODES_ALL_SQL).all()).map(nodeDoc)],
    ['edges', () => withDb((d) => d.prepare(EDGES_ALL_SQL).all()).map(edgeDoc)],
  ];
  for (const [kind, read] of kinds) {
    const map = J[kind];
    const seen = new Set();
    for (const doc of read()) {
      seen.add(doc.id);
      const st = stampOf(Object.assign({}, doc, { rowid: 0 }));
      const prev = map.get(doc.id);
      if (!prev || prev.stamp !== st) { map.set(doc.id, { stamp: st, seq: ++SEQ, doc }); changed++; }
    }
    for (const [id, entry] of map) {
      if (!seen.has(id) && entry.stamp !== 'deleted') { map.set(id, { stamp: 'deleted', seq: ++SEQ, doc: tombstone(kind, id) }); changed++; }
    }
  }
  return { changed, ms: Date.now() - t0 };
}
function journalPull(kind, cp, limit) {
  const from = cp && cp.epoch === EPOCH && Number.isFinite(cp.seq) ? cp.seq : 0;
  const docs = [];
  for (const e of J[kind].values()) if (e.seq > from) docs.push(e);
  docs.sort((a, b) => a.seq - b.seq);
  const page = docs.slice(0, limit);
  const last = page[page.length - 1];
  return { documents: page.map((e) => e.doc), checkpoint: last ? { epoch: EPOCH, seq: last.seq } : { epoch: EPOCH, seq: from } };
}

function pull(kind, cp, limit) {
  if (MODE === 'journal') return journalPull(kind, cp, limit);
  return kind === 'nodes' ? tsPullNodes(cp, limit) : rowidPullEdges(cp, limit);
}

function census() {
  return withDb((d) => ({
    nodes_total: d.prepare('SELECT count(*) c FROM nodes').get().c,
    nodes_live: d.prepare("SELECT count(*) c FROM nodes WHERE review_status != 'superseded'").get().c,
    edges_total: d.prepare('SELECT count(*) c FROM edges').get().c,
    edges_live: d.prepare("SELECT count(*) c FROM edges WHERE review_status IS NULL OR review_status != 'superseded'").get().c,
    data_version: d.prepare('PRAGMA data_version').get().data_version,
    mode: MODE, epoch: EPOCH, seq: SEQ,
  }));
}
function liveIds() {
  return withDb((d) => ({
    nodes: d.prepare("SELECT id FROM nodes WHERE review_status != 'superseded'").all().map((r) => r.id),
    edges: d.prepare("SELECT type || '|' || source || '|' || target AS id FROM edges WHERE review_status IS NULL OR review_status != 'superseded'").all().map((r) => r.id),
  }));
}

// ---------------------------------------------------------------------------
// Live stream. The plugin's SSE bus (lib/mcp/sse-event-bus.cjs, GET /event on
// the MCP server) only ever carries 'status-segment' (published by status_read);
// nothing publishes on a room write. So the live signal is a watcher on
// room.db's WAL plus a data_version poll as the safety net. Both only trigger a
// re-read; the broadcast cursor decides what is new.
// ---------------------------------------------------------------------------
const clients = new Set();
const cursor = { nodes: null, edges: null };
let lastVersion = null;
let scanning = false; let rescan = false; let settleTimer = null;
let streamSeq = 0;

function initCursor() {
  if (MODE === 'journal') {
    refreshJournal();
    cursor.nodes = { epoch: EPOCH, seq: SEQ }; cursor.edges = { epoch: EPOCH, seq: SEQ };
  } else {
    const n = withDb((d) => d.prepare('SELECT id, ' + TS_EXPR + ' AS ts FROM nodes ORDER BY ts DESC, id DESC LIMIT 1').get());
    const e = withDb((d) => d.prepare('SELECT max(rowid) AS r FROM edges').get());
    cursor.nodes = n ? { ts: Number(n.ts), id: n.id } : null;
    cursor.edges = { rowid: Number((e && e.r) || 0) };
  }
  lastVersion = census().data_version;
}

function send(res, event, data) {
  try { res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); return true; } catch (_) { return false; }
}
function broadcast(event, data) { for (const c of clients) if (!send(c, event, data)) clients.delete(c); }

function scan(trigger) {
  if (scanning) { rescan = true; return; }
  scanning = true;
  try {
    const v = withDb((d) => d.prepare('PRAGMA data_version').get().data_version);
    if (v === lastVersion && trigger !== 'settle' && trigger !== 'force') return;
    lastVersion = v;
    const t0 = Date.now();
    let journal = null;
    if (MODE === 'journal') journal = refreshJournal();
    const sent = { nodes: 0, edges: 0 };
    for (const kind of ['nodes', 'edges']) {
      for (;;) {
        const r = pull(kind, cursor[kind], 200);
        if (!r.documents.length) break;
        cursor[kind] = r.checkpoint; sent[kind] += r.documents.length;
        broadcast(kind, { documents: r.documents, checkpoint: r.checkpoint, sent_at: Date.now(), seq: ++streamSeq });
        if (r.documents.length < 200) break;
      }
    }
    // settle: rows younger than the window were held back; look again once they age.
    if (MODE === 'settle' && !settleTimer) settleTimer = setTimeout(() => { settleTimer = null; scan('settle'); }, SETTLE_MS + 5);
    // ts mode cannot see hard deletes or in-place edge updates; say "something
    // moved" so clients re-pull (it does not fix the gap, it is only a hint).
    if (!sent.nodes && !sent.edges && trigger !== 'settle') broadcast('poke', { sent_at: Date.now(), data_version: v });
    logEvent('scan', { trigger, data_version: v, nodesSent: sent.nodes, edgesSent: sent.edges, ms: Date.now() - t0, journal, clients: clients.size });
  } catch (e) {
    logEvent('scan_error', { trigger, error: String(e.message || e).slice(0, 200) });
  } finally {
    scanning = false;
    if (rescan) { rescan = false; setImmediate(() => scan('rescan')); }
  }
}

function startWatchers() {
  const dir = path.join(ROOM_DIR, '.mindrian');
  try {
    fs.watch(dir, { persistent: true }, (_evt, name) => { if (name && String(name).startsWith('room.db')) scan('fs.watch'); });
  } catch (e) { logEvent('watch_failed', { error: String(e.message) }); }
  setInterval(() => scan('poll'), POLL_MS).unref();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); } // loopback dev server; 007 reads it too
function json(res, code, body) { cors(res); res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
function parseCp(s) { if (!s) return null; try { const j = JSON.parse(s); return j && typeof j === 'object' ? j : null; } catch (_) { return null; } }

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') { cors(res); res.setHeader('Access-Control-Allow-Methods', 'GET'); res.writeHead(204); return res.end(); }
  if (req.method !== 'GET') { logEvent('refused_non_get', { method: req.method, path: u.pathname }); return json(res, 405, { error: 'read_only', message: 'The room copy is pull-only. Writes go through the MCP tools.' }); }
  try {
    const m = u.pathname.match(/^\/pull\/(nodes|edges)$/);
    if (m) {
      const limit = Math.min(Math.max(Number(u.searchParams.get('limit')) || 100, 1), 2000);
      const cp = parseCp(u.searchParams.get('cp'));
      const t0 = Date.now();
      if (MODE === 'journal') refreshJournal(); // a pull never answers from a stale index
      const out = pull(m[1], cp, limit);
      logEvent('pull_' + m[1], { cp, n: out.documents.length, ms: Date.now() - t0 });
      return json(res, 200, out);
    }
    if (u.pathname === '/census') return json(res, 200, census());
    if (u.pathname === '/ids') return json(res, 200, liveIds());
    if (u.pathname === '/health') return json(res, 200, { ok: true, mode: MODE, epoch: EPOCH, room: path.basename(ROOM_DIR), room_dir: ROOM_DIR, pid: process.pid, clients: clients.size });
    if (u.pathname === '/stream') {
      cors(res);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 1000\n\n');
      clients.add(res);
      send(res, 'hello', { pid: process.pid, mode: MODE, epoch: EPOCH, room: path.basename(ROOM_DIR), sent_at: Date.now() });
      const hb = setInterval(() => { try { res.write(': hb ' + Date.now() + '\n\n'); } catch (_) {} }, 15000);
      req.on('close', () => { clearInterval(hb); clients.delete(res); logEvent('stream_close', { clients: clients.size }); });
      logEvent('stream_open', { clients: clients.size });
      return;
    }
    let file = null;
    if (u.pathname === '/' || u.pathname === '/index.html') file = path.join(PAGE_DIR, 'index.html');
    else if (u.pathname === '/canon-v3-tokens.css') file = path.join(CONFIG_DIR, 'canon-v3-tokens.css');
    else if (/^\/[a-z0-9._-]+$/i.test(u.pathname)) file = path.join(PAGE_DIR, u.pathname.slice(1));
    if (file && fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    return json(res, 404, { error: 'not_found' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e).slice(0, 200) });
  }
});

initCursor();
startWatchers();
server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write('[spike006-pull] mode ' + MODE + ' listening http://127.0.0.1:' + PORT + ' room ' + ROOM_DIR + '\n');
  logEvent('listen', { port: PORT, pid: process.pid, epoch: EPOCH });
});
