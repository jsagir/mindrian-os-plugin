'use client';
// The Evidence reader (UI-SPEC Evidence view): the item's title (H2, the view's H1 is "Evidence"), its provenance
// block in mono 12, the source document through the read-only DocumentDisplay, then "Linked to" as a ruled list.
// Everything from the room is shown as text.
import { useEffect, useRef } from 'react';
import { EVIDENCE } from '../../copy.ts';
import { TileMark } from '../../primitives/TileMark.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { formatDay, readableDocumentPath } from '../format.ts';
import { itemHref, titleOf } from '../hooks.ts';
import type { NodeDoc, RelationDoc } from '../hooks.ts';
import { LinkedList, linksOf } from '../LinkedTo.tsx';
import type { LinkTarget } from '../LinkedTo.tsx';
import { tileFor } from '../tile-model.ts';
import { baseName, LazyDocument } from './LazyDocument.tsx';

export function EvidenceReader({
  item,
  nodes,
  relations,
  gated,
  contradicts,
  onSelect,
  onBack,
}: {
  item: NodeDoc;
  nodes: Map<string, NodeDoc>;
  relations: RelationDoc[];
  gated: Set<string>;
  contradicts: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [item.id]);

  const tile = tileFor({ status: item.status }, { openGate: gated.has(item.id), contradicts });
  const resolve = (otherId: string): LinkTarget | null => {
    const other = nodes.get(otherId);
    if (!other) return null;
    const t = tileFor({ status: other.status }, { openGate: gated.has(other.id), contradicts: null });
    return { title: titleOf(other), status: t.status, href: itemHref('/evidence', other.id), onOpen: () => onSelect(other.id) };
  };
  const links = linksOf(item.id, relations, resolve);
  const documentPath = readableDocumentPath(item.source_path);
  const facts: Array<[string, string]> = [];
  if (item.type) facts.push(['Type', item.type]);
  if (item.section) facts.push(['Section', item.section]);
  if (item.source_path) facts.push(['File', item.source_path]);
  if (item.created_at) facts.push(['Filed', formatDay(item.created_at)]);
  if (item.provenance) facts.push(['Source', item.provenance]);

  return (
    <article className="reader stack" data-reader="evidence">
      <p className="reader-back">
        <TextAction onClick={onBack}>{EVIDENCE.back}</TextAction>
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {titleOf(item)}
      </h2>
      <p>
        <TileMark tile={tile.tile} status={tile.status} />
      </p>
      {tile.extra.map((text) => (
        <p key={text} className="caption">
          {text}
        </p>
      ))}
      {facts.length > 0 ? (
        <dl className="facts">
          {facts.map(([label, value]) => (
            <div key={label} className="facts-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {documentPath ? <LazyDocument path={documentPath} name={baseName(documentPath)} /> : <p className="caption">{EVIDENCE.noDocument}</p>}
      <h3>{EVIDENCE.linkedTo}</h3>
      {links.length > 0 ? <LinkedList links={links} /> : <p className="caption">{EVIDENCE.noLinks}</p>}
    </article>
  );
}
