// Spike 006, stage 02: the browser read copy of a room.
// RxDB (free Dexie/IndexedDB storage), replicateRxCollection PULL ONLY, a
// pull.stream$ fed by the pull server's SSE stream, RESYNC on every (re)connect.
// No push handler: nothing in this page can write room data. Dev-mode is NOT
// loaded on purpose: RxDB dev-mode injects an iframe from rxdb.info (egress).
// No em-dashes.
import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { Subject } from 'rxjs';

const BASE = (window.ROOM_PULL_BASE || location.origin).replace(/\/$/, '');
const probe = window.__probe = { firstRender: {}, loadId: Math.random().toString(36).slice(2), events: [], received: [], streamItems: 0, resyncs: 0, errors: [], ready: false };
const stamp = (label, data) => { probe.events.push(Object.assign({ t: Date.now(), label }, data || {})); };

const nodeSchema = {
  version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 512 },
    type: { type: 'string' }, label: { type: 'string' }, section: { type: 'string' },
    status: { type: 'string' }, created_by: { type: 'string' },
    ts: { type: 'number' }, lm: { type: 'number' }, props: { type: 'string' },
  },
  required: ['id', 'type', 'ts'],
};
const edgeSchema = {
  version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 1024 },
    source: { type: 'string' }, target: { type: 'string' }, type: { type: 'string' },
    status: { type: 'string' }, rowid: { type: 'number' }, props: { type: 'string' },
  },
  required: ['id', 'source', 'target', 'type'],
};

// --- the SSE stream -> two RxDB pull streams ---------------------------------
const nodeStream$ = new Subject();
const edgeStream$ = new Subject();
let es = null;
let live = false;
function setLive(on, why) {
  live = on;
  stamp(on ? 'stream_open' : 'stream_down', { why });
  render();
}
function openStream() {
  es = new EventSource(BASE + '/stream');
  es.addEventListener('hello', (ev) => {
    // Every (re)connect may have missed changes: ask RxDB to re-pull from its
    // own checkpoint. This is the RESYNC contract of pull.stream$.
    probe.resyncs++;
    nodeStream$.next('RESYNC');
    edgeStream$.next('RESYNC');
    setLive(true, 'hello');
    try {
      const h = JSON.parse(ev.data);
      probe.serverPid = h.pid; probe.mode = h.mode;
      // A new server epoch means its change index was rebuilt: rows hard-deleted
      // while it was away have no tombstone. Reconcile the copy against the
      // room's live id list once the re-pull settles.
      let prev = null;
      try { prev = localStorage.getItem('mos.room.epoch:' + BASE); localStorage.setItem('mos.room.epoch:' + BASE, h.epoch || ''); } catch (_) {}
      if (prev && h.epoch && prev !== h.epoch) reconcileSoon('epoch_change');
    } catch (_) {}
  });
  const onBatch = (subject, kind) => (ev) => {
    const d = JSON.parse(ev.data);
    probe.streamItems++;
    stamp('stream_' + kind, { n: d.documents.length, sent_at: d.sent_at, seq: d.seq });
    subject.next({ documents: d.documents, checkpoint: d.checkpoint });
  };
  es.addEventListener('nodes', onBatch(nodeStream$, 'nodes'));
  es.addEventListener('edges', onBatch(edgeStream$, 'edges'));
  // A change with nothing new past the cursor (an in-place edge update, a hard
  // delete) still says "something moved": re-pull.
  es.addEventListener('poke', () => { nodeStream$.next('RESYNC'); edgeStream$.next('RESYNC'); stamp('poke'); });
  es.onerror = () => { if (live) setLive(false, 'error'); };
}

let reconcileTimer = null;
function reconcileSoon(why) {
  clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => reconcile(why).catch((e) => probe.errors.push('reconcile ' + e.message)), 300);
}
async function reconcile(why) {
  if (!probe.db) return;
  const reps = probe.replications;
  if (reps) { await reps.nodes.awaitInSync(); await reps.edges.awaitInSync(); }
  const live = await pullJson('/ids');
  let removed = 0;
  for (const [name, ids] of [['nodes', live.nodes], ['edges', live.edges]]) {
    const keep = new Set(ids);
    const local = await probe.db[name].find().exec();
    const stale = local.filter((d) => !keep.has(d.id)).map((d) => d.id);
    // Cache maintenance on the read copy only: these rows no longer exist in the room.
    if (stale.length) { await probe.db[name].bulkRemove(stale); removed += stale.length; }
  }
  stamp('reconcile', { why, removed });
  probe.reconciles = (probe.reconciles || 0) + 1;
}
probe.reconcile = reconcile;

async function pullJson(path) {
  const r = await fetch(BASE + path, { cache: 'no-store' });
  if (!r.ok) throw new Error('pull ' + r.status);
  return r.json();
}

async function main() {
  const t0 = performance.now();
  stamp('boot');
  const db = await createRxDatabase({ name: 'mosroom_' + (window.ROOM_KEY || 'spike006'), storage: getRxStorageDexie(), multiInstance: false });
  await db.addCollections({ nodes: { schema: nodeSchema }, edges: { schema: edgeSchema } });
  probe.db = db;

  const rNodes = replicateRxCollection({
    collection: db.nodes,
    replicationIdentifier: 'room-pull-nodes:' + BASE,
    live: true,
    retryTime: 1000,
    waitForLeadership: false,
    pull: {
      batchSize: 200,
      handler: async (cp, batchSize) => {
        const q = cp ? '&cp=' + encodeURIComponent(JSON.stringify(cp)) : '';
        const out = await pullJson('/pull/nodes?limit=' + batchSize + q);
        stamp('pull_nodes', { n: out.documents.length });
        return out;
      },
      stream$: nodeStream$.asObservable(),
    },
    // push: deliberately absent. One-way: room -> browser.
  });
  const rEdges = replicateRxCollection({
    collection: db.edges,
    replicationIdentifier: 'room-pull-edges:' + BASE,
    live: true,
    retryTime: 1000,
    waitForLeadership: false,
    pull: {
      batchSize: 200,
      handler: async (cp, batchSize) => {
        const q = cp ? '&cp=' + encodeURIComponent(JSON.stringify(cp)) : '';
        const out = await pullJson('/pull/edges?limit=' + batchSize + q);
        stamp('pull_edges', { n: out.documents.length });
        return out;
      },
      stream$: edgeStream$.asObservable(),
    },
  });
  probe.replications = { nodes: rNodes, edges: rEdges };
  for (const [k, r] of Object.entries(probe.replications)) {
    r.error$.subscribe((e) => { probe.errors.push(String(e && e.message || e).slice(0, 300)); render(); });
    r.received$.subscribe((d) => { probe.received.push({ t: Date.now(), kind: k, id: d.id, status: d.status, deleted: !!d._deleted }); });
  }
  openStream();
  await rNodes.awaitInitialReplication();
  await rEdges.awaitInitialReplication();
  probe.catchupMs = Math.round(performance.now() - t0);
  probe.ready = true;
  stamp('initial_replication_done', { ms: probe.catchupMs });

  db.nodes.find().$.subscribe((docs) => { state.nodes = docs.map((d) => d.toJSON()); probe.statusById = new Map(state.nodes.map((n) => [n.id, n.status])); render(); });
  db.edges.count().$.subscribe((n) => { state.edgeCount = n; render(); });
}

// --- view: v3 Workshop Modernism; a read view, so no competing actions --------
const state = { nodes: [], edgeCount: 0, lastSeenTs: 0 };
const seen = new Set();
const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function markFor(n) {
  if (n.type === 'decision') return 'black';
  if (n.status === 'confirmed' || n.status === 'validated') return 'square';
  if (n.status === 'rejected' || n.status === 'invalidated') return 'error';
  return 'white';
}
function statusWord(n) {
  if (n.type === 'decision') return 'decision';
  return n.status || 'unknown';
}

let raf = 0;
function render() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const live$ = el('live');
    if (!live$) return;
    live$.innerHTML = live
      ? '<span class="mark circle" aria-hidden="true"></span>Live. Changes in the room appear here without a reload.'
      : '<span class="mark error" aria-hidden="true"></span>Disconnected. Retrying every second; nothing is lost, the copy catches up on reconnect.';
    live$.className = 'state ' + (live ? 'ok' : 'bad');
    const nodes = state.nodes;
    const content = nodes.filter((n) => n.type !== 'memory_event');
    el('counts').textContent = content.length + ' entries, ' + (nodes.length - content.length) + ' memory events, ' + state.edgeCount + ' links' + (probe.catchupMs != null ? '. First catch-up ' + probe.catchupMs + ' ms.' : '.');
    // Sections as regions, entries as tiles.
    const bySection = new Map();
    for (const n of content) {
      if (n.type === 'Section') continue;
      const s = n.section || 'unfiled';
      if (!bySection.has(s)) bySection.set(s, []);
      bySection.get(s).push(n);
    }
    const sections = [...bySection.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
    el('room').innerHTML = sections.map(([s, list]) =>
      '<section class="region"><h3>' + esc(s) + ' <span class="n">' + list.length + '</span></h3><div class="tiles">' +
      // Newest first, capped: the grid is a summary, the ledger carries detail.
      list.sort((a, b) => b.ts - a.ts).slice(0, 120).map((n) => '<span class="tile ' + markFor(n) + (seen.has(n.id) ? '' : ' fresh') + '" title="' + esc(statusWord(n) + ': ' + (n.label || n.id)) + '"></span>').join('') +
      '</div>' + (list.length > 120 ? '<p class="more">+ ' + (list.length - 120).toLocaleString() + ' older entries</p>' : '') + '</section>').join('');
    const recent = [...content].sort((a, b) => b.ts - a.ts || (a.id < b.id ? 1 : -1)).slice(0, 14);
    el('ledger').innerHTML = recent.map((n) =>
      '<li class="' + (seen.has(n.id + n.status) ? '' : 'fresh') + '" data-id="' + esc(n.id) + '" data-status="' + esc(n.status) + '">' +
      '<span class="mark ' + markFor(n) + '" aria-hidden="true"></span>' +
      '<span class="kind">' + esc(statusWord(n)) + '</span>' +
      '<span class="what">' + esc(n.label || n.id) + '</span>' +
      '<time>' + new Date(n.ts).toLocaleTimeString() + '</time></li>').join('');
    for (const n of content) { seen.add(n.id); seen.add(n.id + n.status); }
    const now = Date.now();
    for (const n of nodes) { const k = n.id + '#' + n.status; if (!probe.firstRender[k]) probe.firstRender[k] = now; }
    probe.renderedAt = now;
    probe.renderedIds = new Set(nodes.map((n) => n.id));
    el('err').textContent = probe.errors.length ? 'Replication error: ' + probe.errors[probe.errors.length - 1] : '';
  });
}

main().catch((e) => { probe.errors.push(String(e && e.stack || e).slice(0, 400)); stamp('fatal', { e: String(e).slice(0, 200) }); render(); });
