'use client';
// Deliverables (D-08, D-13): the documents filed to the room, each with the white tile and the written status
// "Delivered". Opening one shows it through the read-only DocumentDisplay. Display only: there is no export, no
// publish and no download control anywhere in this view. The artifacts collection does not say which documents
// are deliverables, so this lists every artifact the room holds.
import { useEffect, useMemo, useRef } from 'react';
import { DELIVERABLES, EVIDENCE } from '../../copy.ts';
import { Legend } from '../../primitives/Legend.tsx';
import { Rule } from '../../primitives/Rule.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { TileMark } from '../../primitives/TileMark.tsx';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { baseName, LazyDocument } from '../evidence/LazyDocument.tsx';
import { formatDay, readableDocumentPath } from '../format.ts';
import { itemHref, titleOf, useHeadingFocus, useSelectedItem } from '../hooks.ts';
import type { ArtifactDoc } from '../hooks.ts';
import { ItemRow } from '../ItemRow.tsx';
import { tileFor } from '../tile-model.ts';

function Reader({ doc, onBack }: { doc: ArtifactDoc; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [doc.id]);
  const tile = tileFor({ kind: 'deliverable' }, { openGate: false, contradicts: null });
  const documentPath = readableDocumentPath(doc.file);
  return (
    <article className="reader stack" data-reader="deliverable">
      <p className="reader-back">
        <TextAction onClick={onBack}>{DELIVERABLES.heading}</TextAction>
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {titleOf(doc)}
      </h2>
      <p>
        <TileMark tile={tile.tile} status={tile.status} />
      </p>
      {documentPath ? <LazyDocument path={documentPath} name={baseName(documentPath)} /> : <p className="caption">{EVIDENCE.noDocument}</p>}
    </article>
  );
}

export function DeliverablesView() {
  const heading = useHeadingFocus();
  const replica = useReplica();
  const artifacts = useCollection<ArtifactDoc>('artifacts');
  const [selected, select] = useSelectedItem();
  const items = useMemo(() => [...artifacts.docs].sort((a, b) => String(b.filed_at || '').localeCompare(String(a.filed_at || '')) || a.id.localeCompare(b.id)), [artifacts.docs]);
  const open = selected !== null ? items.find((d) => d.id === selected) : undefined;
  const reading = replica.loadingLine !== null && artifacts.docs.length === 0;

  return (
    <div className="ev grid" data-view="deliverables" data-open={open ? 'true' : 'false'}>
      <div className="view-head stack">
        <Rule />
        <h1 ref={heading} tabIndex={-1}>
          {DELIVERABLES.heading}
        </h1>
      </div>
      <section className="ev-list stack">
        {reading ? (
          <p>{replica.loadingLine}</p>
        ) : items.length === 0 ? (
          <p>{DELIVERABLES.empty}</p>
        ) : (
          <>
            <ul className="item-list">
              {items.map((d) => {
                const tile = tileFor({ kind: 'deliverable' }, { openGate: false, contradicts: null });
                const meta = [d.section, d.file, formatDay(d.filed_at)].filter((p) => typeof p === 'string' && p !== '').join(' / ');
                return (
                  <ItemRow
                    key={d.id}
                    tile={tile.tile}
                    status={tile.status}
                    title={titleOf(d)}
                    href={itemHref('/deliverables', d.id)}
                    onOpen={() => select(d.id)}
                    meta={meta}
                    current={d.id === selected}
                  />
                );
              })}
            </ul>
            <Legend />
          </>
        )}
      </section>
      <section className="ev-reader" aria-label="Reader">
        {open ? <Reader doc={open} onBack={() => select(null)} /> : <p className="caption">{DELIVERABLES.chooseOne}</p>}
      </section>
    </div>
  );
}
