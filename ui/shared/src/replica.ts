/*
 * replica.ts -- the browser read copy of one room (Phase 369 deliverable 4).
 *
 * RxDB on Dexie, PULL ONLY: there is no write-back handler, now or later. The
 * room is changed through the action layer and the MCP server; the browser
 * learns of the change through the feed. Checkpoint is { epoch, seq }, the
 * server's own, never a timestamp. The database name carries the epoch and the
 * projection version, so a different epoch or a schema bump is a different
 * database and the old one is removed.
 *
 * One room database open at a time: callers close the previous room's replica
 * before opening another. Six collections per room keeps the page at six open
 * collections, under the free tier's global limit of thirteen (two open rooms
 * would be twelve and any third collection would hit the wall).
 *
 * RxDB is imported lazily inside functions so Node can load this file. Only the
 * free plugins are used: leader election (one tab replicates), local documents
 * (the last-visit marker), replication, and the Dexie storage. The RxDB
 * development plugin is never imported: it injects a third-party frame.
 *
 * Erasable TypeScript only. See projection.ts for what the projection is.
 */
import { COLLECTIONS, SCHEMAS, dbName, isResetReason, toDoc } from './projection.ts';
import type { CollectionName, ChangeRow } from './projection.ts';

export class ProjectionResetError extends Error {
  reason: string;
  epoch: string | null;
  snapshot_revision: number | null;
  constructor(info: { reason: string; epoch?: string | null; snapshot_revision?: number | null }) {
    super('projection reset: ' + info.reason);
    this.name = 'ProjectionResetError';
    this.reason = info.reason;
    this.epoch = info.epoch === undefined ? null : info.epoch;
    this.snapshot_revision = info.snapshot_revision === undefined ? null : info.snapshot_revision;
  }
}

export type Checkpoint = { epoch: string; seq: number };

// Name helpers for the shell's cleanup of old and removed copies (plan 369-23). A database is
// mos-<room>-<epoch8>-p<version> (see dbName); the room part is the sanitized room key, so the
// parts are read from the right: the last two segments are the epoch prefix and the version.
export function parseDbName(name: string): { room: string; epoch: string; version: number } | null {
  const m = /^mos-(.+)-([a-z0-9]{1,8})-p(\d+)$/.exec(String(name));
  if (!m) return null;
  return { room: m[1] as string, epoch: m[2] as string, version: Number(m[3]) };
}

// The room part a database name carries for this room key, so a stored database can be matched to a room.
export function roomPartOf(roomKey: string): string {
  const parsed = parseDbName(dbName(roomKey, 'x0'));
  return parsed ? parsed.room : '';
}

// ---- stored copies (browser only): list and remove databases by name ----
//
// The shell removes copies that are older than the room's current epoch or projection version and copies
// whose room is no longer on the machine. RxDB's Dexie storage names its IndexedDB databases
// rxdb-dexie-<database>--<schema version>--<collection>, so a copy is every IndexedDB database sharing the
// prefix. Keeping this here keeps every storage touch of the read copy in one file.
type IdbFactory = IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };

async function idbNames(): Promise<string[]> {
  const factory = (globalThis as { indexedDB?: IdbFactory }).indexedDB;
  if (!factory || typeof factory.databases !== 'function') return [];
  try {
    return (await factory.databases()).map((d) => d.name ?? '').filter((n) => n.length > 0);
  } catch (_e) {
    return [];
  }
}

export async function listStoredCopies(): Promise<string[]> {
  const out = new Set<string>();
  for (const name of await idbNames()) {
    const m = /^rxdb-dexie-(mos-.+?)--\d+--/.exec(name);
    if (m) out.add(m[1] as string);
  }
  return Array.from(out);
}

function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const req = (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB.deleteDatabase(name);
      req.onsuccess = done;
      req.onerror = done;
      // Another tab still holds it open: its Dexie closes on the version-change event; do not wait for ever.
      req.onblocked = () => setTimeout(done, 1500);
    } catch (_e) {
      done();
    }
  });
}

// Remove every stored copy for which `doomed` says so. Returns how many copies went.
export async function removeStoredCopies(doomed: (copy: string) => boolean): Promise<number> {
  let removed = 0;
  for (const copy of await listStoredCopies()) {
    if (!doomed(copy)) continue;
    const prefix = 'rxdb-dexie-' + copy + '--';
    for (const name of await idbNames()) {
      if (name.startsWith(prefix)) await deleteIdb(name);
    }
    removed += 1;
  }
  return removed;
}

export type FeedAnswer = {
  ok?: boolean;
  reason?: string;
  epoch?: string;
  through?: number;
  snapshot_revision?: number;
  changes?: ChangeRow[];
};

export type OpenReplicaOptions = {
  roomKey: string;
  epoch: string;
  fetchPage: (collection: CollectionName, checkpoint: Checkpoint | undefined, batchSize: number) => Promise<FeedAnswer>;
  // Subscribe to wake-up hints; the listener is called on every room.changed
  // hint and on every reconnect. Returns an unsubscribe function.
  hints?: (listener: () => void) => () => void;
  onReset?: (info: { reason: string }) => void;
  // Test seam: defaults to the Dexie storage. Production never passes this.
  storage?: unknown;
  multiInstance?: boolean;
};

// Spike 006's working values (stages/02_browser-replica/src/app.js 112-158):
// retry after one second; 200 rows per pull also matches room_changes' default
// page size, so one pull is one call.
const RETRY_MS = 1000;
const BATCH_SIZE = 200;
const LAST_VISIT_ID = 'last-visit';

export async function openReplica(options: OpenReplicaOptions) {
  const { createRxDatabase, addRxPlugin, removeRxDatabase } = await import('rxdb');
  const { RxDBLeaderElectionPlugin } = await import('rxdb/plugins/leader-election');
  const { RxDBLocalDocumentsPlugin } = await import('rxdb/plugins/local-documents');
  const { replicateRxCollection } = await import('rxdb/plugins/replication');
  const { Subject } = await import('rxjs');
  let storage = options.storage;
  if (!storage) {
    const { getRxStorageDexie } = await import('rxdb/plugins/storage-dexie');
    storage = getRxStorageDexie();
  }
  addRxPlugin(RxDBLeaderElectionPlugin);
  addRxPlugin(RxDBLocalDocumentsPlugin);

  const name = dbName(options.roomKey, options.epoch);
  const db = await createRxDatabase({
    name,
    storage: storage as never,
    multiInstance: options.multiInstance !== false,
  });
  const defs: Record<string, unknown> = {};
  for (const c of COLLECTIONS) {
    defs[c] = c === 'room' ? { schema: SCHEMAS[c], localDocuments: true } : { schema: SCHEMAS[c] };
  }
  await db.addCollections(defs as never);

  const wake$ = new Subject<'RESYNC'>();
  const replications: Array<{ cancel: () => Promise<unknown> }> = [];
  let resetting = false;
  let closed = false;
  let unsubscribeHints: () => void = () => {};

  async function cancelAll(): Promise<void> {
    for (const r of replications.splice(0)) {
      try { await r.cancel(); } catch (_e) { /* already stopped */ }
    }
  }

  async function handleReset(info: ProjectionResetError): Promise<void> {
    if (resetting || closed) return;
    resetting = true;
    unsubscribeHints();
    await cancelAll();
    try { await db.close(); } catch (_e) { /* best effort */ }
    closed = true;
    await removeRxDatabase(name, storage as never);
    if (options.onReset) options.onReset({ reason: info.reason });
  }

  for (const c of COLLECTIONS) {
    const collection = (db as unknown as Record<string, unknown>)[c];
    const replication = replicateRxCollection({
      collection: collection as never,
      replicationIdentifier: 'mos:' + c + ':' + options.roomKey + ':' + options.epoch,
      live: true,
      retryTime: RETRY_MS,
      pull: {
        batchSize: BATCH_SIZE,
        handler: async (checkpoint: unknown, batchSize: number) => {
          const cp = checkpoint as Checkpoint | undefined;
          const answer = await options.fetchPage(c, cp, batchSize);
          if (isResetReason(answer.reason)) {
            const err = new ProjectionResetError({
              reason: String(answer.reason),
              epoch: answer.epoch,
              snapshot_revision: answer.snapshot_revision,
            });
            void handleReset(err);
            throw err;
          }
          if (answer.ok === false) throw new Error('feed refused: ' + String(answer.reason));
          const changes = answer.changes || [];
          const next =
            typeof answer.through === 'number' && typeof answer.epoch === 'string'
              ? { epoch: answer.epoch, seq: answer.through }
              : cp;
          return { documents: changes.map((ch) => toDoc(c, ch)) as never, checkpoint: next as never };
        },
        stream$: wake$.asObservable() as never,
      },
    } as never);
    replications.push(replication as never);
  }

  if (options.hints) unsubscribeHints = options.hints(() => wake$.next('RESYNC'));
  // Catch up once on open and after any reconnect.
  wake$.next('RESYNC');

  return {
    name,
    db,
    replications,
    async awaitInitialReplication(): Promise<void> {
      for (const r of replications) await (r as unknown as { awaitInitialReplication: () => Promise<unknown> }).awaitInitialReplication();
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      unsubscribeHints();
      await cancelAll();
      await db.close();
    },
    async remove(): Promise<void> {
      if (!closed) {
        closed = true;
        unsubscribeHints();
        await cancelAll();
        try { await db.close(); } catch (_e) { /* best effort */ }
      }
      await removeRxDatabase(name, storage as never);
    },
    // The last visit lives in a local document on `room`, so a rebuilt
    // projection loses it and the opening screen falls back to the first-visit
    // view, never an invented history (D-09).
    async getLastVisit(): Promise<number | null> {
      const doc = await (db as unknown as { room: { getLocal: (id: string) => Promise<{ get: (k: string) => unknown } | null> } }).room.getLocal(LAST_VISIT_ID);
      const seq = doc ? doc.get('seq') : null;
      return typeof seq === 'number' ? seq : null;
    },
    async setLastVisit(seq: number): Promise<void> {
      await (db as unknown as { room: { upsertLocal: (id: string, data: unknown) => Promise<unknown> } }).room.upsertLocal(LAST_VISIT_ID, { seq });
    },
  };
}
