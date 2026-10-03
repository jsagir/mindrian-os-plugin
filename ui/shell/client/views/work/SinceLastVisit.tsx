'use client';
// "Since you were here": the Hooked variable reward (D-09), read from the browser copy. The last-visit marker is
// a local document in the copy (RESEARCH Pattern 7); a first visit, or a copy that was rebuilt and lost it, shows
// "What the room holds now" and never a change history it cannot prove. With a marker the list is every item whose
// revision is above it, newest first, five rows then "Show all {n} changes"; none shows one honest line.
//
// The marker is read once when the copy opens and held, so the list does not empty itself as the person reads it;
// the replica writes the new marker when the person leaves Work (ReplicaProvider).
import { useEffect, useMemo, useState } from 'react';
import {
  CHANGES_SHOWN,
  EVIDENCE,
  HOLDS_OPEN_DECISIONS,
  nothingChanged,
  NOTHING_CHANGED_UNDATED,
  ROOM_HOLDS_NOW,
  SHOW_FEWER_CHANGES,
  showAllChanges,
  SINCE_YOU_WERE_HERE,
} from '../../copy.ts';
import { Legend } from '../../primitives/Legend.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { formatDay, capitalize, isStructural, timeLabel } from '../format.ts';
import { itemHref, titleOf, useOpenGates } from '../hooks.ts';
import type { ArtifactDoc, DecisionDoc, NodeDoc, RelationDoc } from '../hooks.ts';
import { ItemRow } from '../ItemRow.tsx';
import { contradictionPartners, tileFor } from '../tile-model.ts';

type Marker = { read: boolean; seq: number | null; at: number | null };

type Change = {
  id: string;
  revision: number;
  title: string;
  href: string;
  partnerHref: string | null;
  tile: ReturnType<typeof tileFor>;
  time: string;
};

export function SinceLastVisit() {
  const replica = useReplica();
  const { db, openCount, getLastVisit, getLastVisitAt } = replica;
  const nodes = useCollection<NodeDoc>('nodes');
  const artifacts = useCollection<ArtifactDoc>('artifacts');
  const decisions = useCollection<DecisionDoc>('decisions');
  const relations = useCollection<RelationDoc>('relations');
  const { gates } = useOpenGates();
  const [marker, setMarker] = useState<Marker>({ read: false, seq: null, at: null });
  const [all, setAll] = useState(false);

  useEffect(() => {
    setMarker({ read: false, seq: null, at: null });
    if (!db) return;
    let live = true;
    void (async () => {
      const seq = await getLastVisit();
      const at = await getLastVisitAt();
      if (live) setMarker({ read: true, seq, at });
    })();
    return () => {
      live = false;
    };
    // The marker is read again only when a copy opens (a rebuilt copy has none), never on each change.
  }, [db, openCount, getLastVisit, getLastVisitAt]);

  // The marker moves up to the change the copy is current through while Work is open, not only when the page is
  // left: a write at unload does not always finish, and the list above holds the marker it read at the start, so
  // moving the stored one never empties what the person is looking at.
  const { state, seq, setLastVisit } = replica;
  useEffect(() => {
    if (!marker.read || state !== 'current' || seq === null) return;
    const timer = setTimeout(() => void setLastVisit(seq), 400);
    return () => clearTimeout(timer);
  }, [marker.read, state, seq, setLastVisit]);

  const evidence = useMemo(() => nodes.docs.filter((d) => !isStructural(d.type)), [nodes.docs]);

  const changes = useMemo<Change[]>(() => {
    const after = marker.seq;
    if (after === null) return [];
    const partners = contradictionPartners(relations.docs);
    const titles = new Map<string, string>();
    for (const n of evidence) titles.set(n.id, titleOf(n));
    const gated = new Set(gates.map((g) => g.subject_node_id));
    const rows: Change[] = [];
    for (const n of evidence) {
      if (typeof n.revision !== 'number' || n.revision <= after) continue;
      const partner = partners.get(n.id);
      rows.push({
        id: n.id,
        revision: n.revision,
        title: titleOf(n),
        href: itemHref('/evidence', n.id),
        partnerHref: partner ? itemHref('/evidence', partner) : null,
        tile: tileFor({ status: n.status }, { openGate: gated.has(n.id), contradicts: partner ? titles.get(partner) || partner : null }),
        time: timeLabel(n.confirmed_at || n.created_at),
      });
    }
    for (const d of decisions.docs) {
      if (typeof d.revision !== 'number' || d.revision <= after) continue;
      rows.push({
        id: d.id,
        revision: d.revision,
        title: titleOf(d),
        href: itemHref('/decisions', d.id),
        partnerHref: null,
        tile: tileFor({ kind: 'decision', status: d.verdict }, { openGate: false, contradicts: null }),
        time: timeLabel(d.confirmed_at),
      });
    }
    for (const a of artifacts.docs) {
      if (typeof a.revision !== 'number' || a.revision <= after) continue;
      rows.push({
        id: a.id,
        revision: a.revision,
        title: titleOf(a),
        href: itemHref('/deliverables', a.id),
        partnerHref: null,
        tile: tileFor({ kind: 'deliverable' }, { openGate: false, contradicts: null }),
        time: timeLabel(a.filed_at),
      });
    }
    return rows.sort((x, y) => y.revision - x.revision);
  }, [marker.seq, evidence, decisions.docs, artifacts.docs, relations.docs, gates]);

  // The first read of a room: say what is happening instead of counting a half-copied room.
  if (replica.loadingLine !== null && replica.count === 0) {
    return (
      <section className="work-since stack" aria-live="off">
        <p>{replica.loadingLine}</p>
      </section>
    );
  }
  if (!marker.read) return <section className="work-since" aria-hidden="true" />;

  // First visit, or the marker is gone: what the room holds now, by type, and the decisions open.
  if (marker.seq === null) {
    const byType = new Map<string, number>();
    for (const n of evidence) {
      const t = (n.type || 'item').toLowerCase();
      byType.set(t, (byType.get(t) || 0) + 1);
    }
    const types = Array.from(byType.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return (
      <section className="work-since stack" data-state="holds-now" aria-labelledby="since-heading">
        <h2 id="since-heading">{ROOM_HOLDS_NOW}</h2>
        {types.length === 0 && gates.length === 0 ? (
          <p>{EVIDENCE.empty}</p>
        ) : (
          <ul className="count-list">
            {types.map(([type, n]) => (
              <li key={type} className="count-row">
                <span>{capitalize(type)}</span>
                <span className="count-row-n">{n}</span>
              </li>
            ))}
            <li className="count-row">
              <span>{HOLDS_OPEN_DECISIONS}</span>
              <span className="count-row-n">{gates.length}</span>
            </li>
          </ul>
        )}
      </section>
    );
  }

  if (changes.length === 0) {
    const day = formatDay(marker.at);
    return (
      <section className="work-since stack" data-state="nothing-changed" aria-labelledby="since-heading">
        <h2 id="since-heading">{SINCE_YOU_WERE_HERE}</h2>
        <p>{day ? nothingChanged(day) : NOTHING_CHANGED_UNDATED}</p>
      </section>
    );
  }

  const shown = all ? changes : changes.slice(0, CHANGES_SHOWN);
  return (
    <section className="work-since stack" data-state="changes" aria-labelledby="since-heading">
      <h2 id="since-heading">{SINCE_YOU_WERE_HERE}</h2>
      <ul className="item-list">
        {shown.map((c) => (
          <ItemRow
            key={c.id}
            tile={c.tile.tile}
            status={c.tile.status}
            title={c.title}
            href={c.href}
            time={c.time}
            extra={c.tile.extra.map((text) => ({ text, href: c.partnerHref || c.href }))}
          />
        ))}
      </ul>
      {changes.length > CHANGES_SHOWN ? (
        <p>
          <TextAction onClick={() => setAll((v) => !v)}>{all ? SHOW_FEWER_CHANGES : showAllChanges(changes.length)}</TextAction>
        </p>
      ) : null}
      <Legend />
    </section>
  );
}
