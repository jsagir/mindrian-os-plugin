'use client';
// Evidence (D-10, UI-SPEC Evidence view). Desktop: the list in columns 1-5 and the reader in 6-12. Phone: the
// list, then the reader replaces it with "Back to evidence". The view's one H1 is "Evidence"; the open item's
// title is an H2 in the reader. Evidence is every node of the room except its sections.
import { useMemo } from 'react';
import { EVIDENCE } from '../../copy.ts';
import { Rule } from '../../primitives/Rule.tsx';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { isStructural } from '../format.ts';
import { titleOf, useHeadingFocus, useOpenGates, useSelectedItem } from '../hooks.ts';
import type { NodeDoc, RelationDoc } from '../hooks.ts';
import { contradictionPartners } from '../tile-model.ts';
import { EvidenceList } from './EvidenceList.tsx';
import { EvidenceReader } from './EvidenceReader.tsx';

export function EvidenceView() {
  const heading = useHeadingFocus();
  const replica = useReplica();
  const nodes = useCollection<NodeDoc>('nodes');
  const relations = useCollection<RelationDoc>('relations');
  const { gates } = useOpenGates();
  const [selected, select] = useSelectedItem();

  const items = useMemo(
    () =>
      nodes.docs
        .filter((d) => !isStructural(d.type))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || a.id.localeCompare(b.id)),
    [nodes.docs],
  );
  const byId = useMemo(() => new Map(nodes.docs.map((d) => [d.id, d])), [nodes.docs]);
  const titles = useMemo(() => new Map(nodes.docs.map((d) => [d.id, titleOf(d)])), [nodes.docs]);
  const partners = useMemo(() => contradictionPartners(relations.docs), [relations.docs]);
  const gated = useMemo(() => new Set(gates.map((g) => g.subject_node_id)), [gates]);
  const open = selected !== null ? byId.get(selected) : undefined;
  const reading = replica.loadingLine !== null && nodes.docs.length === 0;

  return (
    <div className="ev grid" data-view="evidence" data-open={open ? 'true' : 'false'}>
      <div className="view-head stack">
        <Rule />
        <h1 ref={heading} tabIndex={-1}>
          {EVIDENCE.heading}
        </h1>
      </div>
      <section className="ev-list stack" aria-label={EVIDENCE.heading}>
        {reading ? <p>{replica.loadingLine}</p> : <EvidenceList items={items} titles={titles} partners={partners} gated={gated} selected={selected} onSelect={select} />}
      </section>
      <section className="ev-reader" aria-label="Reader">
        {open ? (
          <EvidenceReader
            item={open}
            nodes={byId}
            relations={relations.docs}
            gated={gated}
            contradicts={partners.get(open.id) ? titles.get(partners.get(open.id) as string) || (partners.get(open.id) as string) : null}
            onSelect={select}
            onBack={() => select(null)}
          />
        ) : (
          <p className="caption">{EVIDENCE.chooseOne}</p>
        )}
      </section>
    </div>
  );
}
