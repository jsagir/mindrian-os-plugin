'use client';
// Primary navigation (D-10, D-12, UI-SPEC shell frame): Work, Evidence, Decisions, Deliverables, then a 1 px
// ink rule and the secondary Graph tab. The current tab carries aria-current="page" and a 2 px cobalt bar
// that grows in over 200 ms. Decisions shows the waiting count in words ("Decisions (2 waiting)"), never a
// badge or a coloured dot. On phones the row scrolls horizontally and keeps the current tab in view.
import { useEffect, useRef } from 'react';
import { useShell } from './shell-context.ts';

export type TabId = 'work' | 'evidence' | 'decisions' | 'deliverables' | 'graph';

export const PRIMARY_TABS: Array<{ id: TabId; label: string; href: string }> = [
  { id: 'work', label: 'Work', href: '/' },
  { id: 'evidence', label: 'Evidence', href: '/evidence' },
  { id: 'decisions', label: 'Decisions', href: '/decisions' },
  { id: 'deliverables', label: 'Deliverables', href: '/deliverables' },
];

export const SECONDARY_TABS: Array<{ id: TabId; label: string; href: string }> = [{ id: 'graph', label: 'Graph', href: '/graph' }];

// Which tab a path belongs to. A gate is a decision, so /gate/:id keeps Decisions current.
export function currentTab(pathname: string): TabId | null {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  switch (first) {
    case '':
    case 'work':
      return 'work';
    case 'evidence':
      return 'evidence';
    case 'decisions':
    case 'gate':
      return 'decisions';
    case 'deliverables':
      return 'deliverables';
    case 'graph':
      return 'graph';
    default:
      return null;
  }
}

export function PrimaryNav() {
  const { pathname, waiting } = useShell();
  const current = currentTab(pathname);
  const row = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    row.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const link = (tab: { id: TabId; label: string; href: string }) => (
    <li key={tab.id}>
      <a className="pnav-link" href={tab.href} aria-current={current === tab.id ? 'page' : undefined}>
        {tab.id === 'decisions' && waiting > 0 ? 'Decisions (' + waiting + ' waiting)' : tab.label}
      </a>
    </li>
  );

  return (
    <nav className="pnav" aria-label="Primary">
      <ul className="pnav-row" ref={row}>
        {PRIMARY_TABS.map(link)}
        <li className="pnav-sep" aria-hidden="true" />
        {SECONDARY_TABS.map(link)}
      </ul>
    </nav>
  );
}
