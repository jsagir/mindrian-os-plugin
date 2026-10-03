'use client';
// The ruled list of evidence items (D-11): the tile with its written status, the title, the provenance line
// (section, file, filed date) and, where an item touches a CONTRADICTS edge, the yellow tile with
// "Contradicts {title}" linking to the other item. A long room shows the first page and then asks for more.
import { useState } from 'react';
import { EVIDENCE, showMore } from '../../copy.ts';
import { Legend } from '../../primitives/Legend.tsx';
import { TextAction } from '../../primitives/TextAction.tsx';
import { formatDay } from '../format.ts';
import { itemHref, titleOf } from '../hooks.ts';
import type { NodeDoc } from '../hooks.ts';
import { ItemRow } from '../ItemRow.tsx';
import { tileFor } from '../tile-model.ts';

export const PAGE = 100;

export function provenanceLine(n: NodeDoc): string {
  const parts: string[] = [];
  if (n.section) parts.push(n.section);
  if (n.source_path) parts.push(n.source_path);
  const day = formatDay(n.created_at);
  if (day) parts.push(day);
  return parts.join(' / ');
}

export function EvidenceList({
  items,
  titles,
  partners,
  gated,
  selected,
  onSelect,
}: {
  items: NodeDoc[];
  titles: Map<string, string>;
  partners: Map<string, string>;
  gated: Set<string>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  if (items.length === 0) return <p>{EVIDENCE.empty}</p>;
  const shown = items.slice(0, limit);
  return (
    <div className="stack">
      <ul className="item-list">
        {shown.map((n) => {
          const partner = partners.get(n.id);
          const tile = tileFor({ status: n.status }, { openGate: gated.has(n.id), contradicts: partner ? titles.get(partner) || partner : null });
          return (
            <ItemRow
              key={n.id}
              tile={tile.tile}
              status={tile.status}
              title={titleOf(n)}
              href={itemHref('/evidence', n.id)}
              onOpen={() => onSelect(n.id)}
              meta={provenanceLine(n)}
              current={n.id === selected}
              extra={tile.extra.map((text) => ({ text, href: itemHref('/evidence', partner || n.id), onOpen: () => onSelect(partner || n.id) }))}
            />
          );
        })}
      </ul>
      {items.length > limit ? (
        <p>
          <TextAction onClick={() => setLimit((v) => v + PAGE)}>{showMore(Math.min(PAGE, items.length - limit))}</TextAction>
        </p>
      ) : null}
      <Legend />
    </div>
  );
}
