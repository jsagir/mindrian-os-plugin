'use client';
// "Linked to": the typed relations of one item as a ruled list (relation type in mono 12, the other item's title
// and its written status). Shared by the Evidence reader, the Decisions reader and the Graph tab (D-12).
import { followLink } from './ItemRow.tsx';
import type { RelationDoc } from './hooks.ts';

export type LinkTarget = { title: string; status: string; href: string; onOpen?: () => void };

export type Link = { key: string; type: string; direction: 'out' | 'in'; other: string; target: LinkTarget | null };

// The relations that touch one item, with the item on the other end resolved through `resolve`.
export function linksOf(id: string, relations: RelationDoc[], resolve: (otherId: string) => LinkTarget | null): Link[] {
  const out: Link[] = [];
  for (const r of relations) {
    if (r.source !== id && r.target !== id) continue;
    const outgoing = r.source === id;
    const other = (outgoing ? r.target : r.source) || '';
    if (!other) continue;
    out.push({ key: r.id, type: r.type || 'RELATED', direction: outgoing ? 'out' : 'in', other, target: resolve(other) });
  }
  return out;
}

export function LinkedList({ links }: { links: Link[] }) {
  return (
    <ul className="linked-list">
      {links.map((l) => (
        <li key={l.key} className="linked-row">
          <span className="linked-type">{l.direction === 'in' ? l.type + ' (from)' : l.type}</span>
          {l.target ? (
            <a className="linked-title" href={l.target.href} onClick={followLink(l.target.onOpen)}>
              {l.target.title}
            </a>
          ) : (
            <span className="linked-title">{l.other}</span>
          )}
          {l.target && l.target.status ? <span className="linked-status">{l.target.status}</span> : null}
        </li>
      ))}
    </ul>
  );
}
