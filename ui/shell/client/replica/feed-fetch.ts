// feed-fetch.ts -- the pull handler's page fetcher for the browser read copy (plan 369-23, deliverable 4).
//
// Every page comes from the shell server's feed relay (/api/feed/changes and /api/feed/room), which reads
// the room through the MindrianOS MCP server and nothing else (D-18). The page never talks to the daemon.
//
// Two jobs the shared replica (ui/shared/src/replica.ts) leaves to its fetcher:
//
//   1. First open (no checkpoint): the feed's snapshot mode, paged to the end INSIDE one answer, then the
//      checkpoint is { epoch, seq: as_of_seq } so deltas resume exactly where the snapshot was taken. The
//      checkpoint is only returned once the whole snapshot is in hand, so a reload or a crash mid-catch-up
//      leaves no checkpoint and the next open starts the snapshot again (never a half copy marked current).
//   2. Delta pages: room_changes filters one collection but scans a window of the whole log, so a page can hold
//      fewer rows than asked while more remain. RxDB stops pulling when a page is shorter than its batch, so
//      this fetcher keeps reading until the page is full or the feed says there is no more.
//
// A reset answer (epoch_changed, checkpoint_expired) is handed back untouched: the replica removes the
// database and the provider rebuilds it from a snapshot.
import type { Checkpoint, FeedAnswer } from 'mos-ui-shared/replica';
import type { ChangeRow, CollectionName } from 'mos-ui-shared/projection';
import { feed } from '../api.ts';

// Contract defaults: the feed's own page ceiling is 500 rows; a delta read gives up after this many round
// trips in one handler call (500 hops of up to ten pages' worth of log rows each) so one pull cannot hold the
// connection open for ever (the next hint reads on).
const SNAPSHOT_PAGE = 500;
const MAX_DELTA_HOPS = 500;

type Page = Record<string, unknown> & {
  ok?: boolean;
  reason?: string;
  room?: string;
  epoch?: string | null;
  floor?: number;
  changes?: ChangeRow[];
  through?: number;
  has_more?: boolean;
  latest_seq?: number;
  docs?: Array<Record<string, unknown>>;
  next_cursor?: string | null;
  as_of_seq?: number;
  done?: boolean;
  snapshot_revision?: number;
};

export type FeedFetcher = {
  fetchPage: (collection: CollectionName, checkpoint: Checkpoint | undefined, batchSize: number) => Promise<FeedAnswer>;
  // The change number the whole copy is known to be current through: the lowest `through` any collection last
  // reached. Null until every collection has answered once.
  seq: () => number | null;
  // Rows read from a snapshot so far in this session (for the loading line).
  snapshotRead: () => number;
  // Called whenever seq or snapshotRead moved.
  subscribe: (listener: () => void) => () => void;
  // Forget what was reached and read (a new copy is starting).
  reset: () => void;
};

// `room` is the room this copy belongs to and is required (D-18): a page the server answers for any other room,
// or for no room at all, is refused, never stored.
export function createFeedFetcher(options: { epoch: string | null; room: string }): FeedFetcher {
  if (typeof options.room !== 'string' || options.room.length === 0) {
    throw new Error('createFeedFetcher: the room this copy belongs to is required');
  }
  const reached = new Map<CollectionName, number>();
  const listeners = new Set<() => void>();
  let snapshotRows = 0;
  const ALL: CollectionName[] = ['room', 'nodes', 'relations', 'artifacts', 'decisions', 'activity'];

  function notify(): void {
    for (const l of Array.from(listeners)) l();
  }

  function note(collection: CollectionName, through: number): void {
    const prev = reached.get(collection);
    if (prev === through) return;
    reached.set(collection, through);
    notify();
  }

  function wrongRoom(page: Page): boolean {
    // Strict (WR-09): a page whose room is missing or null is as wrong as one for another room.
    return page.room !== options.room;
  }

  function resetAnswer(reason: string, page: Page): FeedAnswer {
    return {
      ok: false,
      reason,
      epoch: typeof page.epoch === 'string' ? page.epoch : undefined,
      snapshot_revision: typeof page.snapshot_revision === 'number' ? page.snapshot_revision : undefined,
    };
  }

  async function readRoom(): Promise<FeedAnswer> {
    const res = await feed.room<Page>();
    const body = res.body;
    if (res.status !== 200 || body.ok === false) return { ok: false, reason: String(body.reason || 'feed_unavailable') };
    if (wrongRoom(body)) return { ok: false, reason: 'room_mismatch' };
    if (typeof body.epoch === 'string' && options.epoch !== null && body.epoch !== options.epoch) {
      return resetAnswer('epoch_changed', body);
    }
    if (typeof body.through === 'number') note('room', body.through);
    return { ok: true, epoch: typeof body.epoch === 'string' ? body.epoch : undefined, through: body.through, changes: body.changes || [] };
  }

  async function snapshot(collection: CollectionName): Promise<FeedAnswer> {
    const docs: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let epoch: string | null = null;
    let asOf = 0;
    for (;;) {
      const res = await feed.changes<Page>({ collection, mode: 'snapshot', limit: SNAPSHOT_PAGE, cursor });
      const body = res.body;
      if (res.status !== 200 || body.ok === false) return { ok: false, reason: String(body.reason || 'feed_unavailable') };
      if (wrongRoom(body)) return { ok: false, reason: 'room_mismatch' };
      epoch = typeof body.epoch === 'string' ? body.epoch : null;
      if (typeof body.as_of_seq === 'number' && asOf === 0) asOf = body.as_of_seq;
      const page = body.docs || [];
      for (const d of page) docs.push(d);
      snapshotRows += page.length;
      notify();
      if (body.done !== false || !body.next_cursor) break;
      cursor = body.next_cursor;
    }
    if (epoch !== null && options.epoch !== null && epoch !== options.epoch) {
      return { ok: false, reason: 'epoch_changed', epoch };
    }
    const changes: ChangeRow[] = docs.map((doc) => ({
      entity_id: String(doc.id),
      op: 'upsert',
      revision: typeof doc.revision === 'number' ? doc.revision : 0,
      doc,
    }));
    // No change log yet (a room the write door has not opened): there is no epoch to pin a checkpoint to, so the
    // answer carries none and the next wake-up reads the snapshot again.
    if (epoch === null) return { ok: true, changes };
    note(collection, asOf);
    return { ok: true, epoch, through: asOf, changes };
  }

  async function delta(collection: CollectionName, checkpoint: Checkpoint, batchSize: number): Promise<FeedAnswer> {
    const changes: ChangeRow[] = [];
    let after = checkpoint.seq;
    let epoch = checkpoint.epoch;
    for (let hop = 0; hop < MAX_DELTA_HOPS; hop += 1) {
      const res = await feed.changes<Page>({ collection, after, epoch: checkpoint.epoch, limit: batchSize });
      const body = res.body;
      if (body.ok === false && (body.reason === 'epoch_changed' || body.reason === 'checkpoint_expired')) {
        return resetAnswer(String(body.reason), body);
      }
      if (body.ok === false && body.reason === 'change_log_absent') return resetAnswer('epoch_changed', body);
      if (res.status !== 200 || body.ok === false) return { ok: false, reason: String(body.reason || 'feed_unavailable') };
      if (wrongRoom(body)) return { ok: false, reason: 'room_mismatch' };
      if (typeof body.epoch === 'string') epoch = body.epoch;
      for (const c of body.changes || []) changes.push(c);
      if (typeof body.through === 'number') after = body.through;
      note(collection, after);
      if (!body.has_more || changes.length >= batchSize) break;
    }
    return { ok: true, epoch, through: after, changes };
  }

  return {
    async fetchPage(collection, checkpoint, batchSize) {
      if (collection === 'room') return readRoom();
      if (!checkpoint || typeof checkpoint.seq !== 'number') return snapshot(collection);
      return delta(collection, checkpoint, batchSize);
    },
    seq() {
      let low: number | null = null;
      for (const c of ALL) {
        const v = reached.get(c);
        if (v === undefined) return null;
        if (low === null || v < low) low = v;
      }
      return low;
    },
    snapshotRead() {
      return snapshotRows;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      reached.clear();
      snapshotRows = 0;
      notify();
    },
  };
}
