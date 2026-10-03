/*
 * projection.ts -- the browser read copy's schema (Phase 369 deliverable 4).
 *
 * Isomorphic and pure: no RxDB import here, so Node and the chassis build both
 * load it. The projection is a UI projection of six collections (room, nodes,
 * relations, artifacts, decisions, activity), never a mirror of room.db tables.
 * Node rows are partitioned by node type with no duplication: decision nodes to
 * `decisions`, artifact and deliverable nodes to `artifacts`, memory_event nodes
 * to `activity`, every other node to `nodes`; edges to `relations`; one `room`
 * document with the id `room`. The server routes each change row to its
 * collection (room_changes, plan 13); this module only maps one row to a
 * document and names the database.
 *
 * the browser projection is disposable, deletable at any moment and rebuilt from room.db with no loss of MindrianOS state.
 *
 * A change in the schema is a PROJECTION_VERSION bump, which changes the
 * database name, so the old copy is removed and rebuilt, never migrated: a
 * pull checkpoint is not carried across a schema migration.
 */

// Version 2 (plan 369-25): nodes carry confirmed_by and confirmed_at, so a settled claim is attributed in words
// ("Confirmed by you, 2 Oct 2026", D-08) from the room's own field. A version bump removes and rebuilds old copies.
export const PROJECTION_VERSION = 2;

export const COLLECTIONS = ['room', 'nodes', 'relations', 'artifacts', 'decisions', 'activity'] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

type FieldType = 'string' | 'number' | 'object';

// The UI fields per collection. Every collection also carries `id` (primary
// key) and `revision` (the entity revision the server stamped on the change).
const FIELDS: Record<CollectionName, Record<string, FieldType>> = {
  room: { question: 'string', purpose: 'string', counts: 'object' },
  nodes: {
    type: 'string',
    title: 'string',
    status: 'string',
    section: 'string',
    source_path: 'string',
    created_at: 'string',
    provenance: 'string',
    confirmed_by: 'string',
    confirmed_at: 'string',
  },
  relations: { source: 'string', target: 'string', type: 'string', status: 'string' },
  artifacts: { title: 'string', section: 'string', file: 'string', filed_at: 'string', status: 'string' },
  decisions: {
    title: 'string',
    verdict: 'string',
    confirmed_by: 'string',
    confirmed_at: 'string',
    gate_id: 'string',
    subject_node_id: 'string',
  },
  activity: { kind: 'string', at: 'string', summary: 'string' },
};

export type RxJsonSchemaLike = {
  version: number;
  primaryKey: string;
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required: string[];
};

function buildSchema(collection: CollectionName): RxJsonSchemaLike {
  const properties: Record<string, Record<string, unknown>> = {
    id: { type: 'string', maxLength: 200 },
    revision: { type: 'number' },
  };
  const fields = FIELDS[collection];
  for (const name of Object.keys(fields)) {
    properties[name] = { type: fields[name] };
  }
  return { version: 0, primaryKey: 'id', type: 'object', properties, required: ['id'] };
}

export const SCHEMAS: Record<CollectionName, RxJsonSchemaLike> = {
  room: buildSchema('room'),
  nodes: buildSchema('nodes'),
  relations: buildSchema('relations'),
  artifacts: buildSchema('artifacts'),
  decisions: buildSchema('decisions'),
  activity: buildSchema('activity'),
};

function sanitize(value: unknown): string {
  return String(value === undefined || value === null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// mos-<sanitized roomKey>-<first 8 chars of epoch>-p<PROJECTION_VERSION>: the
// epoch and the projection version live in the name, so a different epoch or a
// schema bump opens a different database and the old one is removed.
export function dbName(roomKey: string, epoch: string | null | undefined): string {
  const room = sanitize(roomKey) || 'room';
  const ep = sanitize(String(epoch === undefined || epoch === null ? '' : epoch).slice(0, 8)) || 'x0';
  return 'mos-' + room + '-' + ep + '-p' + PROJECTION_VERSION;
}

export type ChangeRow = {
  seq?: number;
  entity_type?: string;
  entity_id?: string;
  id?: string;
  op?: string;
  operation?: string;
  revision?: number;
  entity_revision?: number;
  doc?: Record<string, unknown> | null;
};

export type ProjectionDoc = { id: string; revision?: number; _deleted?: boolean; [field: string]: unknown };

// Map one room_changes change row to a document. An upsert carries `doc`; a
// delete carries none and becomes a tombstone.
export function toDoc(collection: CollectionName, change: ChangeRow): ProjectionDoc {
  if (!(COLLECTIONS as readonly string[]).includes(collection)) {
    throw new Error('unknown projection collection: ' + collection);
  }
  const op = change.op || change.operation;
  const doc = change.doc;
  const id = String((doc && doc.id) || change.entity_id || change.id || '');
  if (id.length === 0) throw new Error('change row has no id');
  if (op === 'delete' || !doc) return { id, _deleted: true };
  const revision = typeof change.revision === 'number' ? change.revision : change.entity_revision;
  const out: ProjectionDoc = { id, revision: typeof revision === 'number' ? revision : 0 };
  const fields = FIELDS[collection];
  for (const name of Object.keys(fields)) {
    const v = doc[name];
    if (v === undefined || v === null) continue;
    if (fields[name] === 'string') out[name] = typeof v === 'string' ? v : JSON.stringify(v);
    else if (fields[name] === 'number') out[name] = Number(v);
    else out[name] = v;
  }
  return out;
}

// A reset reason means the stored checkpoint no longer points into the server's
// feed: rebuild the projection from a snapshot.
export function isResetReason(reason: unknown): boolean {
  return reason === 'checkpoint_expired' || reason === 'epoch_changed';
}
