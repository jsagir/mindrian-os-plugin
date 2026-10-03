'use client';
// Graph (D-12, UI-SPEC Graph tab): the secondary tab, text only. For the selected item its relations are a ruled
// list (relation type in mono 12, the other item's title and its status). With no item selected a ruled list of
// items that have typed links lets the person pick one. There is no drawing surface and no diagram in v1 (the first-class
// graph view is deferred, SEED-026); one ink-soft caption says how complete the list can be.
import { useMemo } from 'react';
import { GRAPH } from '../../copy.ts';
import { Rule } from '../../primitives/Rule.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { itemHref, titleOf, useHeadingFocus, useSelectedItem } from '../hooks.ts';
import type { NodeDoc, RelationDoc } from '../hooks.ts';
import { followLink } from '../ItemRow.tsx';
import { LinkedList, linksOf } from '../LinkedTo.tsx';
import type { LinkTarget } from '../LinkedTo.tsx';
import { tileFor } from '../tile-model.ts';

export function GraphView() {
  const heading = useHeadingFocus();
  const replica = useReplica();
  const nodes = useCollection<NodeDoc>('nodes');
  const relations = useCollection<RelationDoc>('relations');
  const [selected, select] = useSelectedItem();

  const byId = useMemo(() => new Map(nodes.docs.map((d) => [d.id, d])), [nodes.docs]);
  const connected = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of relations.docs) {
      for (const end of [r.source, r.target]) if (typeof end === 'string' && byId.has(end)) counts.set(end, (counts.get(end) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, n]) => ({ id, n, title: titleOf(byId.get(id)) }))
      .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
  }, [relations.docs, byId]);

  const open = selected !== null ? byId.get(selected) : undefined;
  const resolve = (otherId: string): LinkTarget | null => {
    const other = byId.get(otherId);
    if (!other) return null;
    return { title: titleOf(other), status: tileFor({ status: other.status }, { openGate: false, contradicts: null }).status, href: itemHref('/graph', other.id), onOpen: () => select(other.id) };
  };
  const links = open ? linksOf(open.id, relations.docs, resolve) : [];
  const reading = replica.loadingLine !== null && nodes.docs.length === 0;

  return (
    <div className="graph stack" data-view="graph">
      <Rule />
      <h1 ref={heading} tabIndex={-1}>
        {GRAPH.heading}
      </h1>
      <p className="caption">{GRAPH.caption}</p>
      {reading ? (
        <p>{replica.loadingLine}</p>
      ) : open ? (
        <section className="stack" data-graph="item">
          <p>
            <TextAction onClick={() => select(null)}>{GRAPH.heading}</TextAction>
          </p>
          <h2>{titleOf(open)}</h2>
          {links.length > 0 ? <LinkedList links={links} /> : <p>{GRAPH.none}</p>}
        </section>
      ) : connected.length === 0 ? (
        <p>{GRAPH.empty}</p>
      ) : (
        <section className="stack" data-graph="choose">
          <p>{GRAPH.choose}</p>
          <ul className="linked-list">
            {connected.map((c) => (
              <li key={c.id} className="linked-row">
                <a className="linked-title" href={itemHref('/graph', c.id)} onClick={followLink(() => select(c.id))}>
                  {c.title}
                </a>
                <span className="linked-status">{c.n === 1 ? '1 link' : c.n + ' links'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
