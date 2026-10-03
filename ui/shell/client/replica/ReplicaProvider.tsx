'use client';
// ReplicaProvider -- the browser read copy of the bound room, in the page (plan 369-23, deliverable 4).
//
// RxDB on Dexie (free tier), PULL ONLY: there is no push handler anywhere, now or later. The room is the
// master; a confirmed claim passes a gate, never a browser write (SEED-073). Every pull and every wake-up goes
// through the shell server's feed relay (/api/feed/changes, /api/feed/room, /api/feed/hint), which reads the
// room through the MindrianOS MCP server and nothing else (D-18).
//
// The copy is disposable. It is deleted and rebuilt from a snapshot when the server answers checkpoint_expired
// or epoch_changed, when the projection version changes (the database name carries both), when the person asks
// ("Rebuild the browser copy"), and when its room is no longer on this machine. A rebuilt copy loses the
// last-visit marker, so the opening screen falls back to the first-visit view and never invents a history (D-09).
//
// One room database is open at a time: every open and close goes through one queue, and the previous room's copy
// is closed before the next opens, which keeps the page at six open collections under the free tier's thirteen.
// RxDB's dev-mode plugin is never imported (it injects a third-party frame).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { COLLECTIONS, dbName } from 'mos-ui-shared/projection';
import type { CollectionName } from 'mos-ui-shared/projection';
import { openReplica, parseDbName, removeStoredCopies, roomPartOf } from 'mos-ui-shared/replica';
import { feed } from '../api.ts';
import { COPY_TIDIED, readingTheRoom } from '../copy.ts';
import { useShell } from '../frame/shell-context.ts';
import { useAnnounce } from '../primitives/LiveRegion.tsx';
import { createFeedFetcher } from './feed-fetch.ts';
import type { FeedFetcher } from './feed-fetch.ts';

export type CopyState = 'catching up' | 'current' | 'rebuilding' | 'disconnected';

type Replica = Awaited<ReturnType<typeof openReplica>>;

export type ReplicaState = {
  roomKey: string | null;
  state: CopyState;
  // The change number the whole copy is current through (null until every collection has answered).
  seq: number | null;
  counts: Record<CollectionName, number>;
  // The five room-backed collections together: nodes, relations, artifacts, decisions, activity.
  count: number;
  // "Reading the room. n of total items copied." while the first read is running, otherwise null.
  loadingLine: string | null;
  // The bound room is no longer on this machine; its browser data is gone.
  removed: boolean;
  // Bumps every time a database opens, so a hook resubscribes to the new one.
  openCount: number;
  db: Replica['db'] | null;
  rebuild: () => Promise<void>;
  getLastVisit: () => Promise<number | null>;
  // When the marker was written (epoch ms): the opening screen names the day in "Nothing changed since your last visit on {date}."
  getLastVisitAt: () => Promise<number | null>;
  setLastVisit: (seq: number) => Promise<void>;
};

const ReplicaContext = createContext<ReplicaState | null>(null);

export function useReplica(): ReplicaState {
  const value = useContext(ReplicaContext);
  if (!value) throw new Error('useReplica: no ReplicaProvider above this component');
  return value;
}

export function useReplicaOptional(): ReplicaState | null {
  return useContext(ReplicaContext);
}

const ZERO_COUNTS = Object.fromEntries(COLLECTIONS.map((c) => [c, 0])) as Record<CollectionName, number>;
const ROOM_BACKED: CollectionName[] = ['nodes', 'relations', 'artifacts', 'decisions', 'activity'];
const SYNC_DOC = 'sync';
const CHANNEL = 'mos-replica';
// Contract default: a brief catch-up after a hint is not worth a visible state change, so the word only turns
// to "catching up" when the work outlasts this many milliseconds. Becoming current is always shown at once.
const CATCHING_UP_DELAY_MS = 300;
const ROOM_RETRY_MS = 1000;
const OPEN_RETRY_MS = 3000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---- the wake-up source: room.changed hints, reconnects and returning to the tab ----

function makeHints(wakeRef: { current: (() => void) | null }) {
  return (listener: () => void): (() => void) => {
    const source = new EventSource(feed.hintUrl);
    source.addEventListener('room.changed', listener);
    // EventSource reopens by itself after a drop; every open is a reason to read again.
    source.addEventListener('open', listener);
    const onVisible = () => {
      if (document.visibilityState === 'visible') listener();
    };
    document.addEventListener('visibilitychange', onVisible);
    wakeRef.current = listener;
    return () => {
      source.close();
      document.removeEventListener('visibilitychange', onVisible);
      if (wakeRef.current === listener) wakeRef.current = null;
    };
  };
}

export function ReplicaProvider({ children }: { children: ReactNode }) {
  const { current, rooms, roomsState, status, pathname } = useShell();
  const announce = useAnnounce();

  const [state, setState] = useState<CopyState>('catching up');
  const [seq, setSeq] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<CollectionName, number>>(ZERO_COUNTS);
  const [read, setRead] = useState(0);
  const [totalKnown, setTotalKnown] = useState<number | null>(null);
  const [removed, setRemoved] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [db, setDb] = useState<Replica['db'] | null>(null);

  const handle = useRef<Replica | null>(null);
  const fetcher = useRef<FeedFetcher | null>(null);
  const seqRef = useRef<number | null>(null);
  const stateRef = useRef<CopyState>('catching up');
  const wake = useRef<(() => void) | null>(null);
  const rebuilding = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);
  const announceRef = useRef(announce);
  announceRef.current = announce;

  // One queue for every open, close and purge: the previous room's copy is closed before the next opens.
  const enqueue = useCallback((job: () => Promise<void>, onError?: () => void): Promise<unknown> => {
    chain.current = chain.current.then(job).catch((err) => {
      console.error('browser copy job failed', err);
      if (onError) onError();
    });
    return chain.current;
  }, []);

  const closeCurrent = useCallback(async () => {
    const h = handle.current;
    handle.current = null;
    fetcher.current = null;
    setDb(null);
    if (!h) return;
    try {
      await h.close();
    } catch {
      /* already closed or removed */
    }
  }, []);

  const bumpGeneration = useCallback(() => setGeneration((g) => g + 1), []);

  // Other tabs on the same room rebuild when this tab deletes the copy under them.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data && data.type === 'reset') {
        rebuilding.current = true;
        bumpGeneration();
      }
    };
    return () => {
      ch.close();
      channel.current = null;
    };
  }, [bumpGeneration]);

  // ---- the lifecycle of the open copy ----
  useEffect(() => {
    if (current === null || removed) {
      setState('catching up');
      setSeq(null);
      seqRef.current = null;
      setCounts(ZERO_COUNTS);
      setRead(0);
      return;
    }
    const roomKey = current;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const cleanups: Array<() => void> = [];
    setState(rebuilding.current ? 'rebuilding' : 'catching up');
    stateRef.current = rebuilding.current ? 'rebuilding' : 'catching up';
    setSeq(null);
    seqRef.current = null;
    setCounts(ZERO_COUNTS);
    setRead(0);

    void enqueue(async () => {
      if (cancelled) return;

      // The room document tells this copy which epoch it belongs to (and, when known, how many items there are).
      let epoch: string | null = null;
      for (;;) {
        if (cancelled) return;
        try {
          const res = await feed.room<{ ok?: boolean; room?: string; epoch?: string | null; documents?: Array<{ counts?: Record<string, unknown> }> }>();
          // The server is the authority on which room it is serving. If this page's idea of the open room is
          // behind or ahead of it (a slow list answer landing late), do not file one room's rows under another
          // room's name: wait and read again until they agree.
          if (res.status === 200 && res.body.ok !== false && typeof res.body.room === 'string' && res.body.room !== roomKey) {
            await sleep(ROOM_RETRY_MS);
            continue;
          }
          if (res.status === 200 && res.body.ok !== false) {
            epoch = typeof res.body.epoch === 'string' ? res.body.epoch : null;
            const c = res.body.documents?.[0]?.counts;
            const total = c && typeof c.nodes === 'number' && typeof c.edges === 'number' ? c.nodes + c.edges : null;
            setTotalKnown(total);
            break;
          }
        } catch {
          /* the shell server is not answering yet; the Status panel and the banner say so */
        }
        await sleep(ROOM_RETRY_MS);
      }
      if (cancelled) return;

      // A copy from an older epoch or an older projection version of this room is not read again: remove it.
      const keep = dbName(roomKey, epoch);
      const mine = roomPartOf(roomKey);
      await removeStoredCopies((copy) => copy !== keep && parseDbName(copy)?.room === mine);
      if (cancelled) return;

      const feeder = createFeedFetcher({ epoch, room: roomKey });
      const replica = await openReplica({
        roomKey,
        epoch: epoch ?? '',
        fetchPage: feeder.fetchPage,
        hints: makeHints(wake),
        onReset: () => {
          // The server said the copy's checkpoint no longer points into its feed. The replica already deleted the
          // database; read the room again from a snapshot.
          if (cancelled) return;
          rebuilding.current = true;
          announceRef.current(COPY_TIDIED);
          channel.current?.postMessage({ type: 'reset' });
          bumpGeneration();
        },
      });
      if (cancelled) {
        try {
          await replica.close();
        } catch {
          /* best effort */
        }
        return;
      }
      handle.current = replica;
      fetcher.current = feeder;
      setDb(replica.db);
      setOpenCount((n) => n + 1);

      const rx = replica.db as unknown as {
        isLeader: () => boolean;
        waitForLeadership: () => Promise<boolean>;
        room: { getLocal$: (id: string) => { subscribe: (next: (doc: { get: (k: string) => unknown } | null) => void) => { unsubscribe: () => void } }; upsertLocal: (id: string, data: unknown) => Promise<unknown> };
      } & Record<string, unknown>;

      // ---- state: the leader tab replicates and knows; the other tabs read the leader's note ----
      const flags: boolean[] = replica.replications.map(() => false);
      let ready = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let written = '';

      const show = (next: CopyState, nextSeq: number | null) => {
        if (cancelled) return;
        stateRef.current = next;
        setState(next);
        seqRef.current = nextSeq;
        setSeq(nextSeq);
        if (next === 'current' || next === 'catching up') rebuilding.current = false;
      };

      const writeNote = (next: CopyState, nextSeq: number | null) => {
        const key = next + ':' + String(nextSeq);
        if (key === written) return;
        written = key;
        rx.room.upsertLocal(SYNC_DOC, { state: next, seq: nextSeq }).catch(() => {});
      };

      const recompute = () => {
        if (cancelled || !rx.isLeader()) return;
        const busy = !ready || flags.some(Boolean);
        const nextSeq = feeder.seq();
        if (!busy) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          show('current', nextSeq);
          writeNote('current', nextSeq);
          return;
        }
        const settled = stateRef.current === 'current';
        if (!settled) {
          show(stateRef.current === 'rebuilding' ? 'rebuilding' : 'catching up', nextSeq);
          writeNote('catching up', nextSeq);
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            if (!cancelled && (flags.some(Boolean) || !ready)) {
              show('catching up', feeder.seq());
              writeNote('catching up', feeder.seq());
            }
          }, CATCHING_UP_DELAY_MS);
        }
      };

      replica.replications.forEach((r, i) => {
        const sub = (r as unknown as { active$: { subscribe: (n: (v: boolean) => void) => { unsubscribe: () => void } } }).active$.subscribe((v) => {
          flags[i] = v === true;
          recompute();
        });
        cleanups.push(() => sub.unsubscribe());
      });
      replica
        .awaitInitialReplication()
        .then(() => {
          ready = true;
          recompute();
        })
        .catch(() => {});
      rx.waitForLeadership()
        .then(() => recompute())
        .catch(() => {});
      cleanups.push(
        feeder.subscribe(() => {
          setRead(feeder.snapshotRead());
          if (rx.isLeader() && ready && !flags.some(Boolean)) recompute();
          else if (rx.isLeader()) {
            seqRef.current = feeder.seq();
            setSeq(feeder.seq());
          }
        }),
      );
      const noteSub = rx.room.getLocal$(SYNC_DOC).subscribe((doc) => {
        if (cancelled || rx.isLeader() || !doc) return;
        const s = doc.get('state');
        const q = doc.get('seq');
        show(s === 'current' ? 'current' : 'catching up', typeof q === 'number' ? q : null);
      });
      cleanups.push(() => noteSub.unsubscribe());

      // ---- live counts, coalesced ----
      let countTimer: ReturnType<typeof setTimeout> | null = null;
      const latest: Record<CollectionName, number> = { ...ZERO_COUNTS };
      const flush = () => {
        countTimer = null;
        if (!cancelled) setCounts({ ...latest });
      };
      for (const c of COLLECTIONS) {
        const collection = rx[c] as { count: () => { $: { subscribe: (n: (v: number) => void) => { unsubscribe: () => void } } } };
        const sub = collection.count().$.subscribe((n) => {
          latest[c] = n;
          if (!countTimer) countTimer = setTimeout(flush, 50);
        });
        cleanups.push(() => sub.unsubscribe());
      }
      cleanups.push(() => {
        if (countTimer) clearTimeout(countTimer);
        if (timer) clearTimeout(timer);
      });
    }, () => {
      // Opening the copy failed (storage unavailable or refused): try again shortly instead of staying on
      // "catching up" for ever. The page keeps working without a copy meanwhile.
      if (!cancelled) retry = setTimeout(bumpGeneration, OPEN_RETRY_MS);
    });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      for (const fn of cleanups.splice(0)) fn();
      void enqueue(closeCurrent);
    };
  }, [current, removed, generation, enqueue, closeCurrent, bumpGeneration]);

  // The connection word wins over the copy's own state: a copy cannot claim to be current without a connection.
  const lost = status !== null && status.connection === 'disconnected';
  useEffect(() => {
    if (!lost && wake.current) wake.current();
  }, [lost]);

  // ---- rooms that are gone: remove their browser data and say so ----
  const slugKey = rooms.map((r) => r.slug).join('\n');
  useEffect(() => {
    if (roomsState !== 'ready') return;
    const slugs = slugKey.length > 0 ? slugKey.split('\n') : [];
    const gone = current !== null && !slugs.includes(current);
    setRemoved(gone);
    const present = new Set(slugs.map((s) => roomPartOf(s)));
    // Queued behind the lifecycle effect's close, so the open copy of a removed room is closed before it is deleted.
    void enqueue(async () => {
      await removeStoredCopies((copy) => {
        const parsed = parseDbName(copy);
        return parsed !== null && !present.has(parsed.room);
      });
    });
  }, [slugKey, roomsState, current, enqueue]);

  // ---- the last visit (D-09): written when the person leaves Work or the page hides ----
  const setLastVisit = useCallback(async (value: number) => {
    const h = handle.current;
    if (!h) return;
    try {
      await h.setLastVisit(value);
    } catch {
      /* the copy was closed meanwhile */
    }
  }, []);
  const getLastVisit = useCallback(async () => {
    const h = handle.current;
    if (!h) return null;
    try {
      return await h.getLastVisit();
    } catch {
      return null;
    }
  }, []);
  const getLastVisitAt = useCallback(async () => {
    const h = handle.current;
    if (!h) return null;
    try {
      return await h.getLastVisitAt();
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    const first = pathname.split('/').filter(Boolean)[0] ?? '';
    const onWork = first === '' || first === 'work';
    const leave = () => {
      if (onWork && seqRef.current !== null) void setLastVisit(seqRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') leave();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [pathname, setLastVisit]);

  // "Rebuild the browser copy": delete this browser's copy and read the room again. The room is not touched.
  const rebuild = useCallback(async () => {
    rebuilding.current = true;
    setState('rebuilding');
    stateRef.current = 'rebuilding';
    await enqueue(async () => {
      const h = handle.current;
      handle.current = null;
      fetcher.current = null;
      if (h) {
        try {
          await h.remove();
        } catch {
          /* best effort; the next open removes any leftovers by name */
        }
      }
    });
    channel.current?.postMessage({ type: 'reset' });
    bumpGeneration();
  }, [enqueue, bumpGeneration]);

  const count = ROOM_BACKED.reduce((sum, c) => sum + counts[c], 0);
  const shown: CopyState = lost ? 'disconnected' : state;
  const loadingLine = shown === 'catching up' || shown === 'rebuilding' ? readingTheRoom(Math.max(read, count), totalKnown) : null;

  const value = useMemo<ReplicaState>(
    () => ({ roomKey: current, state: shown, seq, counts, count, loadingLine, removed, openCount, db, rebuild, getLastVisit, getLastVisitAt, setLastVisit }),
    [current, shown, seq, counts, count, loadingLine, removed, openCount, db, rebuild, getLastVisit, getLastVisitAt, setLastVisit],
  );

  return <ReplicaContext.Provider value={value}>{children}</ReplicaContext.Provider>;
}
