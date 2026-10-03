'use client';
// useCollection -- live query results from the browser read copy (plan 369-23).
//
//   const { docs, ready } = useCollection<Node>('nodes', { type: 'claim' });
//
// `selector` is a Mango selector (optional). The result re-renders when the copy changes, so a view stays
// current with no reload. `ready` is false until the first query result for the open copy arrives, and goes
// false again when a different room's copy opens. Read only: the copy has no write path.
import { useEffect, useRef, useState } from 'react';
import type { CollectionName } from 'mos-ui-shared/projection';
import { useReplica } from './ReplicaProvider.tsx';

type Observable<T> = { subscribe: (next: (value: T) => void) => { unsubscribe: () => void } };
type RxDocLike = { toJSON: () => unknown };
type CollectionLike = { find: (query?: { selector?: unknown }) => { $: Observable<RxDocLike[]> } };

export function useCollection<T = Record<string, unknown>>(name: CollectionName, selector?: Record<string, unknown>): { docs: T[]; ready: boolean } {
  const { db, openCount } = useReplica();
  const [docs, setDocs] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  // A selector literal changes identity every render; compare by content.
  const selectorKey = selector === undefined ? '' : JSON.stringify(selector);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  useEffect(() => {
    setReady(false);
    setDocs([]);
    if (!db) return;
    const collection = (db as unknown as Record<string, CollectionLike>)[name];
    if (!collection) return;
    const query = selectorRef.current === undefined ? collection.find() : collection.find({ selector: selectorRef.current });
    const sub = query.$.subscribe((rows) => {
      setDocs(rows.map((row) => row.toJSON() as T));
      setReady(true);
    });
    return () => sub.unsubscribe();
  }, [db, openCount, name, selectorKey]);

  return { docs, ready };
}
