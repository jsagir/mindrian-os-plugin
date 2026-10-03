'use client';
// One ruled row of any list the views draw (D-11): the tile with its written status, the item title as a link,
// a mono provenance line and the extra words the row adds ("Contradicts {title}"). Room content only ever
// reaches the page as React text, never as markup. The legend sits under the list, not in every row.
import type { MouseEvent, ReactNode } from 'react';
import type { Tile } from '../primitives/TileMark.tsx';
import { TileMark } from '../primitives/TileMark.tsx';

export type RowLink = { text: string; href: string; onOpen?: () => void };

export type ItemRowProps = {
  tile: Tile;
  status: string;
  title: string;
  href?: string;
  onOpen?: () => void;
  time?: string;
  meta?: string;
  extra?: RowLink[];
  current?: boolean;
  children?: ReactNode;
};

// A plain click opens in place when the view can; a modified click or a middle click keeps the link's own behaviour.
export function followLink(onOpen: (() => void) | undefined) {
  return (event: MouseEvent<HTMLElement>) => {
    if (!onOpen || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen();
  };
}

export function ItemRow({ tile, status, title, href, onOpen, time, meta, extra, current, children }: ItemRowProps) {
  return (
    <li className="item-row" aria-current={current ? 'true' : undefined}>
      <div className="item-row-top">
        <TileMark tile={tile} status={status} />
        {time ? <span className="item-row-time">{time}</span> : null}
      </div>
      {href !== undefined ? (
        <a className="item-row-title" href={href} onClick={followLink(onOpen)}>
          {title}
        </a>
      ) : (
        <span className="item-row-title">{title}</span>
      )}
      {meta ? <p className="item-row-meta">{meta}</p> : null}
      {extra && extra.length > 0 ? (
        <ul className="item-row-extra">
          {extra.map((link) => (
            <li key={link.text + link.href}>
              <a href={link.href} onClick={followLink(link.onOpen)}>
                {link.text}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </li>
  );
}
