'use strict';

/**
 * room-projection.cjs - the read side of the durable room change feed
 * (Phase 369 plan 13, D-18).
 *
 * Canon Part 9: room.db is the local mind and navigation is the only door. This
 * module lives inside lib/core/navigation/ and works over a CALLER-OWNED handle
 * (normally the read-only door, openRoomDbReadOnlyForCaller). It never opens a
 * database, never writes, never migrates. The room_changes MCP tool reaches it
 * through navigation.cjs re-exports, so lib/mcp never holds SQL.
 *
 * What it serves. The browser read copy (ui/shared) holds five room.db-backed
 * collections: nodes, relations, artifacts, decisions, activity (the sixth,
 * `room`, is composed by the shell from room_state and question_read). Node rows
 * are partitioned by node type with no duplication (collectionForNodeType); edges
 * are the relations collection. readChanges turns room_change_log rows into
 * ordered deltas for one collection; readSnapshot pages the current rows of one
 * collection so a client can reset and then resume deltas from an as_of_seq.
 *
 * Delta rules (D-18):
 *   - rows are ordered by change_seq; `through` is the last seq consumed;
 *   - per entity only its LAST row in the consumed window is kept (the document is
 *     joined at read time from the CURRENT row, so an earlier row adds nothing);
 *   - a delete is a row with no document; a node delete is emitted to every
 *     node-backed collection, because the log does not remember the node's type;
 *   - an upsert whose current row is gone becomes a delete;
 *   - a node whose current type routes to another collection is dropped here.
 *     Known limit: a node that CHANGES type after its first upsert leaves a stale
 *     document in its old collection until a snapshot reset (types are written once
 *     in practice; the shell's reset path rebuilds the copy).
 *
 * Schema variants: nodes exist as legacy (3 columns), partially migrated (12) and
 * wide (16). Every statement here names only id, type and properties on nodes
 * (SELECT * for the rest, read defensively off the returned object), and only
 * source, target, type, properties on edges, so no column gate can be missed
 * (lib/core/navigation/CONTEXT.md, "Three schema variants, one rule").
 *
 * Canon Part 8: pure local reads, no network, no Brain. No em-dashes. CJS only.
 */

const { readChangeLogMeta } = require('./room-change-log.cjs');

// The five room.db-backed collections of ui/shared COLLECTIONS.
const ROOM_COLLECTIONS = Object.freeze(['nodes', 'relations', 'artifacts', 'decisions', 'activity']);
const NODE_COLLECTIONS = Object.freeze(['nodes', 'artifacts', 'decisions', 'activity']);

// Contract default: one call scans at most limit * SCAN_FACTOR log rows. It caps a
// call's work when most rows in the window belong to other collections or collapse
// onto one entity; has_more reports the rest, so the bound trades call count for
// latency, never correctness.
const SCAN_FACTOR = 10;

const SEP = String.fromCharCode(31);
const TITLE_CAP = 240;

// ---------- routing ----------

/**
 * Which node-backed collection a node belongs to. Type strings read from the
 * writers: 'decision' (memory-artifacts.cjs writeDecisionNode, id 'decision:<id>'),
 * 'Artifact' (lazygraph-ops.cjs indexer; 'deliverable' is the same family),
 * 'memory_event' (memory-events.cjs). Everything else (claim, Section, frame,
 * jtbd, goal, Opportunity, breakthrough, ...) is `nodes`.
 *
 * @param {string|null|undefined} type
 * @param {string|null|undefined} id
 * @returns {'nodes'|'artifacts'|'decisions'|'activity'}
 */
function collectionForNodeType(type, id) {
  const t = String(type === undefined || type === null ? '' : type).toLowerCase();
  const i = String(id === undefined || id === null ? '' : id);
  if (t === 'decision' || i.startsWith('decision:')) return 'decisions';
  if (t === 'artifact' || t === 'deliverable') return 'artifacts';
  if (t === 'memory_event') return 'activity';
  return 'nodes';
}

// Fixed SQL predicates over the node `type` and `id` columns (always present).
const NODE_COLLECTION_SQL = Object.freeze({
  decisions: "(lower(type) = 'decision' OR id LIKE 'decision:%')",
  artifacts: "(lower(type) IN ('artifact', 'deliverable') AND id NOT LIKE 'decision:%')",
  activity: "(lower(type) = 'memory_event' AND id NOT LIKE 'decision:%')",
  nodes:
    "(lower(type) NOT IN ('decision', 'artifact', 'deliverable', 'memory_event') AND id NOT LIKE 'decision:%')",
});

// ---------- document building ----------

function parseProps(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch (_e) {
    return {};
  }
}

function str(v) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' ? v : String(v);
}

function firstString(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

function capTitle(s) {
  return s.length > TITLE_CAP ? s.slice(0, TITLE_CAP) : s;
}

// created_at is epoch milliseconds on migrated schemas (Phase 109) and absent on
// legacy ones. Returns an ISO string, or '' when unknowable (never a made-up time).
function isoFromMs(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return typeof v === 'string' ? v : '';
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function nodeTitle(row, props) {
  const t = firstString(props, ['title', 'name', 'label', 'text', 'claim', 'topic', 'summary']);
  return capTitle(t || str(row.id));
}

function setIfPresent(doc, key, value) {
  if (value !== undefined && value !== null && value !== '') doc[key] = value;
}

/**
 * Build the collection's document from the CURRENT nodes row.
 * Field names follow ui/shared/src/projection.ts FIELDS; fields the UI schema does
 * not declare (confirmed_by and confirmed_at on nodes) are carried anyway and
 * dropped by toDoc, so the server stays a superset of the client.
 */
function buildNodeDoc(collection, row) {
  const props = parseProps(row.properties);
  const doc = { id: str(row.id) };
  if (collection === 'decisions') {
    doc.title = nodeTitle(row, props);
    setIfPresent(doc, 'verdict', str(row.review_status));
    setIfPresent(doc, 'confirmed_by', str(row.confirmed_by));
    setIfPresent(doc, 'confirmed_at', isoFromMs(row.confirmed_at));
    setIfPresent(doc, 'gate_id', str(props.gate_id));
    setIfPresent(doc, 'subject_node_id', str(props.subject_node_id));
    return doc;
  }
  if (collection === 'artifacts') {
    doc.title = nodeTitle(row, props);
    setIfPresent(doc, 'section', str(row.source_section) || str(props.section));
    setIfPresent(doc, 'file', str(props.file) || (str(row.id).includes('/') ? str(row.id) : ''));
    setIfPresent(doc, 'filed_at', isoFromMs(row.created_at) || str(props.created));
    setIfPresent(doc, 'status', str(row.review_status));
    return doc;
  }
  if (collection === 'activity') {
    const kind = str(props.event_type);
    const target = str(props.target_node_id);
    setIfPresent(doc, 'kind', kind);
    setIfPresent(doc, 'at', isoFromMs(row.created_at));
    setIfPresent(doc, 'summary', capTitle(kind && target ? kind + ' ' + target : kind || target));
    return doc;
  }
  // nodes
  setIfPresent(doc, 'type', str(row.type));
  doc.title = nodeTitle(row, props);
  setIfPresent(doc, 'status', str(row.review_status));
  setIfPresent(doc, 'section', str(row.source_section) || str(props.section));
  setIfPresent(doc, 'source_path', str(row.source_path));
  setIfPresent(doc, 'created_at', isoFromMs(row.created_at));
  setIfPresent(doc, 'provenance', str(row.created_by));
  setIfPresent(doc, 'confirmed_by', str(row.confirmed_by));
  setIfPresent(doc, 'confirmed_at', isoFromMs(row.confirmed_at));
  return doc;
}

function edgeKey(row) {
  return str(row.source) + SEP + str(row.type) + SEP + str(row.target);
}

function buildEdgeDoc(row) {
  const doc = { id: edgeKey(row), source: str(row.source), target: str(row.target), type: str(row.type) };
  setIfPresent(doc, 'status', str(row.review_status));
  return doc;
}

// ---------- small readers ----------

/** Latest change_seq on the handle; 0 when the log is absent. */
function readLatestSeq(handle) {
  const meta = readChangeLogMeta(handle);
  return meta.present ? meta.latest_seq : 0;
}

/** SQLite's data_version for the handle (changes when another connection commits). */
function readDataVersion(handle) {
  const row = handle.prepare('PRAGMA data_version').get();
  if (!row) return 0;
  const v = row.data_version !== undefined ? row.data_version : Object.values(row)[0];
  return Number(v) || 0;
}

function hasTable(handle, name) {
  const r = handle.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return !!r;
}

function clampInt(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

// ---------- readChanges ----------

/**
 * Ordered deltas for one collection after a cursor.
 *
 * @param {import('node:sqlite').DatabaseSync} handle caller-owned, normally read-only
 * @param {{ after?: number, limit?: number, collection: string }} opts
 * @returns {{ changes: object[], from: number, through: number, latest_seq: number, has_more: boolean }}
 */
function readChanges(handle, opts) {
  const o = opts || {};
  const collection = String(o.collection || '');
  if (!ROOM_COLLECTIONS.includes(collection)) {
    throw new Error('readChanges: unknown collection ' + collection);
  }
  const after = clampInt(o.after, 0, Number.MAX_SAFE_INTEGER, 0);
  const limit = clampInt(o.limit, 1, 500, 200);
  const latest = readLatestSeq(handle);
  const empty = { changes: [], from: after, through: after, latest_seq: latest, has_more: false };
  if (!hasTable(handle, 'room_change_log')) return empty;

  const wantEdges = collection === 'relations';
  const scanBound = limit * SCAN_FACTOR;
  const rows = handle
    .prepare(
      'SELECT change_seq, entity_type, entity_id, operation, entity_revision, transaction_id, changed_at ' +
        'FROM room_change_log WHERE change_seq > ? ORDER BY change_seq LIMIT ?'
    )
    .all(after, scanBound);

  const getNode = handle.prepare('SELECT * FROM nodes WHERE id = ?');
  const getEdge = handle.prepare('SELECT * FROM edges WHERE source = ? AND type = ? AND target = ?');

  // entity key -> change; a later row for the same entity replaces the earlier one.
  const kept = new Map();
  let through = after;
  for (const r of rows) {
    const seq = Number(r.change_seq);
    const isEdge = r.entity_type === 'edge';
    if (isEdge !== wantEdges) {
      through = seq;
      continue;
    }
    const key = String(r.entity_id);
    if (!kept.has(key) && kept.size >= limit) break; // a new entity would exceed the page
    through = seq;
    kept.set(key, r);
  }

  const changes = [];
  for (const [key, r] of kept) {
    const change = {
      seq: Number(r.change_seq),
      entity_type: r.entity_type,
      entity_id: key,
      op: r.operation,
      revision: r.entity_revision === null || r.entity_revision === undefined ? Number(r.change_seq) : Number(r.entity_revision),
      tx: r.transaction_id === undefined ? null : r.transaction_id,
      at: r.changed_at,
    };
    if (r.operation === 'delete') {
      changes.push(change);
      continue;
    }
    if (wantEdges) {
      const parts = key.split(SEP);
      const cur = parts.length === 3 ? getEdge.get(parts[0], parts[1], parts[2]) : null;
      if (!cur) {
        change.op = 'delete';
        changes.push(change);
      } else {
        change.doc = buildEdgeDoc(cur);
        changes.push(change);
      }
      continue;
    }
    const cur = getNode.get(key);
    if (!cur) {
      change.op = 'delete';
      changes.push(change);
      continue;
    }
    if (collectionForNodeType(cur.type, cur.id) !== collection) continue;
    change.doc = buildNodeDoc(collection, cur);
    changes.push(change);
  }
  changes.sort((a, b) => a.seq - b.seq);

  const more = handle.prepare('SELECT 1 AS x FROM room_change_log WHERE change_seq > ? LIMIT 1').get(through);
  return { changes, from: after, through, latest_seq: latest, has_more: !!more };
}

// ---------- readSnapshot ----------

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function decodeCursor(text) {
  try {
    const obj = JSON.parse(Buffer.from(String(text), 'base64url').toString('utf8'));
    if (obj && typeof obj === 'object') return obj;
  } catch (_e) { /* fall through */ }
  return null;
}

/**
 * Page the CURRENT rows of one collection, ordered by entity key. The first page
 * (no cursor) captures as_of_seq from the log; later pages carry it unchanged so
 * the client resumes deltas from it. No transaction spans calls: rows written
 * between pages may appear in a page and again in the delta, which is harmless
 * because documents are upserts keyed by id.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {{ collection: string, cursor?: string|null, limit?: number }} opts
 * @returns {{ docs: object[], next_cursor: string|null, as_of_seq: number, done: boolean }}
 */
function readSnapshot(handle, opts) {
  const o = opts || {};
  const collection = String(o.collection || '');
  if (!ROOM_COLLECTIONS.includes(collection)) {
    throw new Error('readSnapshot: unknown collection ' + collection);
  }
  const limit = clampInt(o.limit, 1, 500, 200);
  let asOf = 0;
  let lastKey = '';
  if (o.cursor) {
    const c = decodeCursor(o.cursor);
    if (!c) throw new Error('readSnapshot: bad cursor');
    asOf = clampInt(c.as_of_seq, 0, Number.MAX_SAFE_INTEGER, 0);
    lastKey = typeof c.last_key === 'string' ? c.last_key : '';
  } else {
    asOf = readLatestSeq(handle);
  }

  const logPresent = hasTable(handle, 'room_change_log');
  const revStmt = logPresent
    ? handle.prepare('SELECT MAX(change_seq) AS m FROM room_change_log WHERE entity_type = ? AND entity_id = ?')
    : null;
  const revisionOf = (entityType, id) => {
    if (!revStmt) return 0;
    const r = revStmt.get(entityType, id);
    return r && r.m !== null && r.m !== undefined ? Number(r.m) : 0;
  };

  // limit + 1 rows tell us whether another page exists without a count query.
  let rows;
  if (collection === 'relations') {
    rows = handle
      .prepare(
        "SELECT *, source || char(31) || type || char(31) || target AS entity_key FROM edges " +
          'WHERE entity_key > ? ORDER BY entity_key LIMIT ?'
      )
      .all(lastKey, limit + 1);
  } else {
    rows = handle
      .prepare('SELECT *, id AS entity_key FROM nodes WHERE id > ? AND ' + NODE_COLLECTION_SQL[collection] + ' ORDER BY id LIMIT ?')
      .all(lastKey, limit + 1);
  }
  const done = rows.length <= limit;
  const page = done ? rows : rows.slice(0, limit);
  const docs = page.map((r) => {
    const doc = collection === 'relations' ? buildEdgeDoc(r) : buildNodeDoc(collection, r);
    doc.revision = revisionOf(collection === 'relations' ? 'edge' : 'node', String(r.entity_key));
    return doc;
  });
  const next = done || page.length === 0
    ? null
    : encodeCursor({ as_of_seq: asOf, last_key: String(page[page.length - 1].entity_key) });
  return { docs, next_cursor: next, as_of_seq: asOf, done };
}

module.exports = {
  ROOM_COLLECTIONS,
  NODE_COLLECTIONS,
  collectionForNodeType,
  readLatestSeq,
  readDataVersion,
  readChanges,
  readSnapshot,
  _internal: { buildNodeDoc, buildEdgeDoc, edgeKey, NODE_COLLECTION_SQL, SCAN_FACTOR, encodeCursor, decodeCursor },
};
