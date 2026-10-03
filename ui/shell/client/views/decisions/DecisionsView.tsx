'use client';
// Decisions (D-08, UI-SPEC Decisions view): "Waiting for you" (open gates), "Proposed" (claims proposed or
// needing evidence) and "Settled" (confirmed, validated, rejected, superseded, invalidated, stale and the
// recorded decisions), each an H2 in that order. A waiting row opens the gate view (plan 27); any other row opens
// in the reader beside the list. Settled rows are attributed in words ("Confirmed by you, 2 Oct 2026"). This
// view reads and navigates; it answers nothing.
import { useEffect, useMemo, useRef } from 'react';
import { DECISIONS } from '../../copy.ts';
import { Legend } from '../../primitives/Legend.tsx';
import { Rule } from '../../primitives/Rule.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { TileMark } from '../../primitives/TileMark.tsx';
import { useReplica } from '../../replica/ReplicaProvider.tsx';
import { useCollection } from '../../replica/useCollection.ts';
import { attribution, formatDay, OPEN_STATUSES, SETTLED_STATUSES } from '../format.ts';
import { itemHref, titleOf, useHeadingFocus, useOpenGates, useSelectedItem } from '../hooks.ts';
import type { DecisionDoc, NodeDoc, RelationDoc } from '../hooks.ts';
import { ItemRow } from '../ItemRow.tsx';
import { LinkedList, linksOf } from '../LinkedTo.tsx';
import type { LinkTarget } from '../LinkedTo.tsx';
import { contradictionPartners, tileFor } from '../tile-model.ts';

// The node types a person confirms (Canon Part 9 truth claims; lib/core/navigation/transitions.cjs). Compared lowercase.
const CLAIM_TYPES = new Set(['claim', 'causalclaim', 'assumption', 'opportunity', 'syntheticexpert']);
const statusKey = (s: string | undefined) => String(s || 'proposed').toLowerCase();

type Row = {
  id: string;
  title: string;
  tile: ReturnType<typeof tileFor>;
  words: string;
  kind: 'claim' | 'decision';
  subject?: string;
};

function Reader({ row, nodes, relations, onBack }: { row: Row; nodes: Map<string, NodeDoc>; relations: RelationDoc[]; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [row.id]);
  const resolve = (otherId: string): LinkTarget | null => {
    const other = nodes.get(otherId);
    if (!other) return null;
    return { title: titleOf(other), status: tileFor({ status: other.status }, { openGate: false, contradicts: null }).status, href: itemHref('/evidence', other.id) };
  };
  const links = linksOf(row.id, relations, resolve);
  const subject = row.subject ? nodes.get(row.subject) : undefined;
  return (
    <article className="reader stack" data-reader="decision">
      <p className="reader-back">
        <TextAction onClick={onBack}>{DECISIONS.heading}</TextAction>
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {row.title}
      </h2>
      <p>
        <TileMark tile={row.tile.tile} status={row.tile.status} />
      </p>
      {row.words ? <p>{row.words}</p> : null}
      {row.subject ? (
        <p className="caption">
          {DECISIONS.subject + ' '}
          {subject ? <a href={itemHref('/evidence', subject.id)}>{titleOf(subject)}</a> : row.subject}
        </p>
      ) : null}
      {links.length > 0 ? <LinkedList links={links} /> : null}
    </article>
  );
}

export function DecisionsView() {
  const heading = useHeadingFocus();
  const replica = useReplica();
  const nodes = useCollection<NodeDoc>('nodes');
  const decisions = useCollection<DecisionDoc>('decisions');
  const relations = useCollection<RelationDoc>('relations');
  const { gates, ready } = useOpenGates();
  const [selected, select] = useSelectedItem();

  const byId = useMemo(() => new Map(nodes.docs.map((d) => [d.id, d])), [nodes.docs]);
  const titles = useMemo(() => new Map(nodes.docs.map((d) => [d.id, titleOf(d)])), [nodes.docs]);
  const partners = useMemo(() => contradictionPartners(relations.docs), [relations.docs]);
  const gated = useMemo(() => new Set(gates.map((g) => g.subject_node_id)), [gates]);

  const { proposed, settled } = useMemo(() => {
    const proposedRows: Row[] = [];
    const settledRows: Array<Row & { at: string }> = [];
    for (const n of nodes.docs) {
      if (!CLAIM_TYPES.has(String(n.type || '').toLowerCase())) continue;
      const s = statusKey(n.status);
      const partner = partners.get(n.id);
      const tile = tileFor({ status: n.status }, { openGate: gated.has(n.id), contradicts: partner ? titles.get(partner) || partner : null });
      if (OPEN_STATUSES.includes(s)) {
        proposedRows.push({ id: n.id, title: titleOf(n), tile, words: '', kind: 'claim' });
      } else if (SETTLED_STATUSES.includes(s)) {
        settledRows.push({ id: n.id, title: titleOf(n), tile, words: attribution(n.status, n.confirmed_by, n.confirmed_at), kind: 'claim', at: n.confirmed_at || '' });
      }
    }
    for (const d of decisions.docs) {
      const tile = tileFor({ kind: 'decision', status: d.verdict }, { openGate: false, contradicts: null });
      const words = d.verdict ? attribution(d.verdict, d.confirmed_by, d.confirmed_at) : d.confirmed_at ? 'Decided, ' + formatDay(d.confirmed_at) : '';
      settledRows.push({ id: d.id, title: titleOf(d), tile, words, kind: 'decision', subject: d.subject_node_id, at: d.confirmed_at || '' });
    }
    settledRows.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
    return { proposed: proposedRows, settled: settledRows };
  }, [nodes.docs, decisions.docs, partners, titles, gated]);

  const all = useMemo(() => new Map<string, Row>([...proposed, ...settled].map((r) => [r.id, r])), [proposed, settled]);
  const open = selected !== null ? all.get(selected) : undefined;
  const empty = ready && gates.length === 0 && proposed.length === 0 && settled.length === 0;
  const reading = replica.loadingLine !== null && replica.count === 0;

  const rowFor = (r: Row) => (
    <ItemRow
      key={r.id}
      tile={r.tile.tile}
      status={r.tile.status}
      title={r.title}
      href={itemHref('/decisions', r.id)}
      onOpen={() => select(r.id)}
      meta={r.words}
      current={r.id === selected}
    />
  );

  return (
    <div className="ev grid" data-view="decisions" data-open={open ? 'true' : 'false'}>
      <div className="view-head stack">
        <Rule />
        <h1 ref={heading} tabIndex={-1}>
          {DECISIONS.heading}
        </h1>
      </div>
      <section className="ev-list stack">
        {reading ? (
          <p>{replica.loadingLine}</p>
        ) : empty ? (
          <p>{DECISIONS.empty}</p>
        ) : (
          <>
            <h2>{DECISIONS.waiting}</h2>
            <ul className="item-list" data-group="waiting">
              {gates.map((g) => (
                <ItemRow key={g.gate_id} tile="black" status="WAITING FOR YOU" title={g.header} href={'/gate/' + encodeURIComponent(g.gate_id)} />
              ))}
            </ul>
            <h2>{DECISIONS.proposed}</h2>
            <ul className="item-list" data-group="proposed">
              {proposed.map(rowFor)}
            </ul>
            <h2>{DECISIONS.settled}</h2>
            <ul className="item-list" data-group="settled">
              {settled.map(rowFor)}
            </ul>
            <Legend />
          </>
        )}
      </section>
      <section className="ev-reader" aria-label="Reader">
        {open ? <Reader row={open} nodes={byId} relations={relations.docs} onBack={() => select(null)} /> : <p className="caption">{DECISIONS.chooseOne}</p>}
      </section>
    </div>
  );
}
