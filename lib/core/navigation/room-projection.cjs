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
// Quick 261004-av2: the routes a gate answer is WRITTEN with (lib/mcp/answer-route.cjs
// ANSWERED_VIA_VALUES, repeated by value because lib/core never requires lib/mcp) and the value a
// reader gives an answer anchor written before the marker existed.
const ANSWER_ROUTES = Object.freeze(['browser_nonce', 'mcp_relayed']);
const UNRECORDED = 'unrecorded';

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

/**
 * The latest change_seq the feed holds for ONE entity (Phase 369 plan 26,
 * GREC369-03): `entityType` is 'node' or 'edge', `entityId` the node id or the
 * edge key. 0 when the entity has no row, or when the feed is absent (a legacy
 * room before its first write-door open). gate_render records it for a card's
 * subject at mint; gate_answer compares it at answer time, and a higher number
 * means the subject changed after the card was drawn. Pure read over a
 * caller-owned handle (normally read-only); never writes.
 *
 * Compaction note: it drops OLD rows, never the newest ones, and AUTOINCREMENT
 * keeps seqs rising, so a subject that changed after mint always reads higher
 * than the mint value; a smaller number than the mint value means compaction
 * removed the subject's last row and callers must not read that as a change.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {'node'|'edge'} entityType
 * @param {string} entityId
 * @returns {number}
 */
function readEntityRevision(handle, entityType, entityId) {
  if (typeof entityId !== 'string' || entityId.length === 0) return 0;
  if (entityType !== 'node' && entityType !== 'edge') return 0;
  if (!hasTable(handle, 'room_change_log')) return 0;
  const row = handle
    .prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log WHERE entity_type = ? AND entity_id = ?')
    .get(entityType, entityId);
  return row ? Number(row.m) || 0 : 0;
}

/**
 * The durable trace of one gate answer (Phase 369 plan 26, GREC369-02): what a
 * ledger miss looks for before it answers unknown_gate. gate_answer writes the
 * ratification (a memory_event keyed `gate_answer:<gate_id>`, plus the decision
 * node `decision:gate:<gate_id>` on an approve) in one transaction, so either
 * both exist or neither does. The memory_event is found by its dedupe_key with
 * NO time window (the 60 s window in logEvent is only its write-side dedupe).
 * Pure read over a caller-owned handle; never writes.
 *
 * Quick 261004-av2: a found anchor always carries answered_via, the route the answer came by
 * (browser_nonce or mcp_relayed; unrecorded for an anchor written before the marker existed), and
 * via_gate_id when the answer was made through a mirror (the mirror's gate id). Plan 369-36 wrote the
 * mirror id as answered_via; a row whose answered_via is not a route reads that value as via_gate_id.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {string} gateId
 * @returns {{ found: boolean, verdict: string|null, chosen: string[]|null, decision_node_id: string|null,
 *   answered_via?: string, via_gate_id?: string }}
 */
function readGateAnswerAnchor(handle, gateId) {
  const none = { found: false, verdict: null, chosen: null, decision_node_id: null };
  if (typeof gateId !== 'string' || gateId.length === 0) return none;
  const decisionId = 'decision:gate:' + gateId;
  const decisionRow = handle.prepare('SELECT id FROM nodes WHERE id = ?').get(decisionId);
  let verdict = null;
  let chosen = null;
  let route = UNRECORDED;
  let viaGateId = null;
  // Phase 369 plan 33 (WR-06): one memory_event row whose properties are not valid
  // JSON must not abort the lookup, so the json_extract sits behind json_valid in a
  // CASE (SQLite does not promise left-to-right evaluation of a plain AND).
  const ev = eventRowByDedupeKey(handle, 'gate_answer:' + gateId);
  if (ev) {
    const props = parseProps(ev.properties);
    if (typeof props.verdict === 'string') verdict = props.verdict;
    if (Array.isArray(props.chosen)) chosen = props.chosen.filter((c) => typeof c === 'string');
    if (typeof props.answered_via === 'string' && ANSWER_ROUTES.indexOf(props.answered_via) !== -1) route = props.answered_via;
    if (typeof props.via_gate_id === 'string' && props.via_gate_id.length > 0) {
      viaGateId = props.via_gate_id;
    } else if (typeof props.answered_via === 'string' && props.answered_via.length > 0 && ANSWER_ROUTES.indexOf(props.answered_via) === -1) {
      viaGateId = props.answered_via; // the 369-36 era row
    }
  }
  if (!ev && !decisionRow) return none;
  if (verdict === null && decisionRow) verdict = 'approve';
  let decisionNodeId = decisionRow ? decisionId : null;
  // A gate answered through its mirror (plan 369-36) records the mirror's id on the
  // source's answer row; the decision node then belongs to the mirror.
  if (viaGateId !== null) {
    const viaId = 'decision:gate:' + viaGateId;
    const viaRow = handle.prepare('SELECT id FROM nodes WHERE id = ?').get(viaId);
    if (viaRow) decisionNodeId = viaId;
  }
  const out = {
    found: true,
    verdict: verdict,
    chosen: chosen,
    decision_node_id: decisionNodeId,
    answered_via: route,
  };
  if (viaGateId !== null) out.via_gate_id = viaGateId;
  return out;
}

/**
 * The newest memory_event row whose dedupe_key is `key`, or null. No time window
 * (the 60 s window in logEvent is only its write-side dedupe). The one place the
 * `json_valid(properties)` guard sits for every by-key read (anchor, raise, close),
 * so a malformed row elsewhere in the table cannot throw (WR-06).
 * Pure read over a caller-owned handle; names only `type` and `properties`.
 */
function eventRowByDedupeKey(handle, key) {
  const rows = handle
    .prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND CASE WHEN json_valid(properties) THEN json_extract(properties, '$.dedupe_key') END = ?"
    )
    .all(key);
  if (!rows || rows.length === 0) return null;
  // Several rows for one key are possible only by hand edit; the last written wins.
  return rows[rows.length - 1];
}

// -----------------------------------------------------------------------
// Phase 369 plan 33 (SHELL369-12 visibility half, GREC369-05 read surface):
// the durable gate records. gate_render and every other mintGate caller leave a
// `gate_raised` memory_event in the room the minting session is bound to
// (lib/mcp/gate-raised.cjs); a take that leaves without a recorded answer leaves
// `gate_closed`. These three readers answer "which gates are open here" and "what
// happened to this one" from the room alone, so a second process (the daemon the
// shell talks to) sees a gate that lives only in another process's ledger. They
// are pure reads over a caller-owned handle (normally the read-only door).
//
// The record carries the card contract only, never a session id or a ledger key
// (Canon Part 8 room-local, D-16): the reader re-bounds every field anyway, so a
// hand-edited row cannot hand a client an unbounded payload.
// -----------------------------------------------------------------------
const RAISED_TTL_MS = 30 * 60 * 1000;
const RAISED_LIST_MAX = 50;
const CAP = Object.freeze({ id: 200, header: 200, label: 200, description: 500, preview: 1000, notice: 500, options: 20, evidence: 20, short: 200 });

function capString(v, n) {
  if (typeof v !== 'string') return null;
  return v.length > n ? v.slice(0, n) : v;
}

function capStringList(v, n, each) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (typeof item !== 'string' || item.length === 0) continue;
    out.push(capString(item, each));
    if (out.length >= n) break;
  }
  return out;
}

// The bounded contract of one gate_raised row (the shape gate_list serves).
function boundRaised(props) {
  const p = props && typeof props === 'object' ? props : {};
  const options = [];
  if (Array.isArray(p.options)) {
    for (const o of p.options) {
      if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id.length === 0) continue;
      options.push({
        id: capString(o.id, CAP.id),
        label: capString(typeof o.label === 'string' ? o.label : o.id, CAP.label),
        description: capString(o.description, CAP.description),
        rank: typeof o.rank === 'number' && Number.isFinite(o.rank) ? o.rank : null,
        preview: capString(o.preview, CAP.preview),
        recommended: o.recommended === true,
      });
      if (options.length >= CAP.options) break;
    }
  }
  const mintedAt = typeof p.minted_at === 'number' && Number.isFinite(p.minted_at) ? p.minted_at : null;
  const expiresAt = typeof p.expires_at === 'number' && Number.isFinite(p.expires_at)
    ? p.expires_at
    : (mintedAt !== null ? mintedAt + RAISED_TTL_MS : null);
  return {
    gate_id: capString(p.gate_id, CAP.id),
    kind: capString(p.gate_kind, CAP.short) || 'general',
    header: capString(p.header, CAP.header),
    select_mode: p.select_mode === 'multi' ? 'multi' : 'single',
    options: options,
    recommended: capString(p.recommended, CAP.id),
    notice: capString(p.notice, CAP.notice),
    approve_label: capString(p.approve_label, CAP.label),
    subject_node_id: capString(p.subject_node_id, CAP.id),
    evidence_node_ids: capStringList(p.evidence_node_ids, CAP.evidence, CAP.id),
    approving: Array.isArray(p.approving) ? capStringList(p.approving, CAP.options, CAP.id) : null,
    framework: capString(p.framework, CAP.short),
    minted_at: mintedAt,
    expires_at: expiresAt,
    resumes: p.resumes === true,
  };
}

/**
 * The newest gate_raised record for one gate id, as a bounded contract, or null.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {string} gateId
 * @returns {object|null}
 */
function readRaisedGate(handle, gateId) {
  if (typeof gateId !== 'string' || gateId.length === 0) return null;
  const row = eventRowByDedupeKey(handle, 'gate_raised:' + gateId);
  if (!row) return null;
  const props = parseProps(row.properties);
  if (props.label !== 'gate_raised') return null;
  const contract = boundRaised(props);
  if (contract.gate_id === null) contract.gate_id = capString(gateId, CAP.id);
  return contract;
}

/**
 * One gate's state from the room's durable records. Precedence: answered (an
 * answer anchor exists, even with no raise record), then closed (a gate_closed
 * record), then expired (the raise record's expires_at is not after `now`), then
 * open; `unknown` when there is neither a raise nor an answer.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {string} gateId
 * @param {number} [now]
 * @returns {{ state: 'open'|'answered'|'closed'|'expired'|'unknown', contract?: object, answered?: object }}
 */
function readGateState(handle, gateId, now) {
  const at = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  if (typeof gateId !== 'string' || gateId.length === 0) return { state: 'unknown' };
  const anchor = readGateAnswerAnchor(handle, gateId);
  if (anchor.found === true) {
    const answered = { verdict: anchor.verdict, chosen: anchor.chosen, decision_node_id: anchor.decision_node_id };
    if (anchor.answered_via) answered.answered_via = anchor.answered_via;
    if (anchor.via_gate_id) answered.via_gate_id = anchor.via_gate_id;
    return { state: 'answered', answered: answered };
  }
  const raised = readRaisedGate(handle, gateId);
  if (eventRowByDedupeKey(handle, 'gate_closed:' + gateId)) {
    return raised ? { state: 'closed', contract: raised } : { state: 'closed' };
  }
  if (!raised) return { state: 'unknown' };
  if (typeof raised.expires_at === 'number' && raised.expires_at <= at) return { state: 'expired', contract: raised };
  return { state: 'open', contract: raised };
}

/**
 * The open gates of a room, oldest first: raised, not a mirror, not answered, not
 * closed, and past `now` before expires_at. At most `limit` (default and maximum 50).
 *
 * The scan reads each memory_event's JSON once and rejects expired rows in memory
 * before it asks the two per-gate questions (answered? closed?), so a room that
 * has raised thousands of gates over months pays the two lookups only for the few
 * inside their 30-minute window.
 *
 * @param {import('node:sqlite').DatabaseSync} handle
 * @param {{ now?: number, limit?: number }} [opts]
 * @returns {object[]}
 */
function readOpenRaisedGates(handle, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const at = typeof o.now === 'number' && Number.isFinite(o.now) ? o.now : Date.now();
  const limit = clampInt(o.limit, 1, RAISED_LIST_MAX, RAISED_LIST_MAX);
  const rows = handle
    .prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND CASE WHEN json_valid(properties) THEN json_extract(properties, '$.label') END = 'gate_raised'"
    )
    .all();
  const candidates = [];
  for (const row of rows) {
    const props = parseProps(row.properties);
    if (props.label !== 'gate_raised' || typeof props.gate_id !== 'string' || props.gate_id.length === 0) continue;
    if (typeof props.mirror_of === 'string' && props.mirror_of.length > 0) continue;
    const contract = boundRaised(props);
    if (typeof contract.expires_at !== 'number' || contract.expires_at <= at) continue;
    candidates.push(contract);
  }
  candidates.sort((a, b) => (a.minted_at || 0) - (b.minted_at || 0));
  const open = [];
  for (const c of candidates) {
    if (readGateAnswerAnchor(handle, c.gate_id).found === true) continue;
    if (eventRowByDedupeKey(handle, 'gate_closed:' + c.gate_id)) continue;
    open.push(c);
    if (open.length >= limit) break;
  }
  return open;
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
 * One call is one read transaction (Phase 369 plan 39, WR-08): the change-log
 * metadata and every row of the page come from a single snapshot, so a
 * compaction committed on another connection while the page is being read
 * cannot drop rows from it silently. When the caller already holds a
 * transaction on the handle it is reused (the owns idiom of compactChangeLog).
 *
 * With `opts.guard` (the feed's reset contract, WR-07) the same snapshot also
 * decides whether the cursor can be served at all, and the answer is
 * `{ reset, epoch, floor, snapshot_revision }` instead of a page:
 *   - epoch_changed      guard.epoch is set and differs from the current epoch
 *   - checkpoint_expired the cursor is below the floor, ABOVE the latest
 *                        sequence (a room.db restored from an older copy: the
 *                        browser copy would otherwise stay marked current over
 *                        a gap), or the floor overtook the cursor during the call
 * A served page then also carries `epoch` and `floor` from that snapshot.
 *
 * @param {import('node:sqlite').DatabaseSync} handle caller-owned, normally read-only
 * @param {{ after?: number, limit?: number, collection: string, guard?: { epoch?: string|null } }} opts
 * @returns {{ changes: object[], from: number, through: number, latest_seq: number, has_more: boolean, epoch?: string|null, floor?: number }
 *   | { reset: 'epoch_changed'|'checkpoint_expired', epoch: string|null, floor: number, snapshot_revision: number }}
 */
function readChanges(handle, opts) {
  const owns = handle.isTransaction !== true;
  if (owns) handle.exec('BEGIN');
  try {
    const out = readChangesInTx(handle, opts);
    if (owns) handle.exec('COMMIT');
    return out;
  } catch (err) {
    if (owns) {
      try { handle.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    }
    throw err;
  }
}

function readChangesInTx(handle, opts) {
  const o = opts || {};
  const collection = String(o.collection || '');
  if (!ROOM_COLLECTIONS.includes(collection)) {
    throw new Error('readChanges: unknown collection ' + collection);
  }
  const after = clampInt(o.after, 0, Number.MAX_SAFE_INTEGER, 0);
  const limit = clampInt(o.limit, 1, 500, 200);
  // The first read of the transaction: it fixes the snapshot everything below reads.
  const meta = readChangeLogMeta(handle);
  const latest = meta.present ? meta.latest_seq : 0;
  const guard = o.guard && typeof o.guard === 'object' ? o.guard : null;
  const resetAnswer = (reason) => ({
    reset: reason,
    epoch: meta.present ? meta.epoch : null,
    floor: meta.present ? meta.floor : 0,
    snapshot_revision: latest,
  });
  if (guard && meta.present) {
    if (typeof guard.epoch === 'string' && guard.epoch.length > 0 && guard.epoch !== meta.epoch) {
      return resetAnswer('epoch_changed');
    }
    if (after < meta.floor || after > latest) return resetAnswer('checkpoint_expired');
  }
  const empty = { changes: [], from: after, through: after, latest_seq: latest, has_more: false };
  if (guard && meta.present) {
    empty.epoch = meta.epoch;
    empty.floor = meta.floor;
  }
  if (!meta.present) return empty;

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
  const page = { changes, from: after, through, latest_seq: latest, has_more: !!more };
  if (guard) {
    // Belt and braces: inside one read transaction the floor cannot move, but a
    // handle that could not hold a snapshot must still never hand out a page
    // whose cursor the floor overtook while the rows were read.
    const again = readChangeLogMeta(handle);
    if (again.present && after < again.floor) return resetAnswer('checkpoint_expired');
    page.epoch = meta.epoch;
    page.floor = meta.floor;
  }
  return page;
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
  readEntityRevision,
  ANSWER_ROUTES,
  UNRECORDED,
  readGateAnswerAnchor,
  readRaisedGate,
  readGateState,
  readOpenRaisedGates,
  readDataVersion,
  readChanges,
  readSnapshot,
  _internal: { buildNodeDoc, buildEdgeDoc, edgeKey, NODE_COLLECTION_SQL, SCAN_FACTOR, encodeCursor, decodeCursor },
};
