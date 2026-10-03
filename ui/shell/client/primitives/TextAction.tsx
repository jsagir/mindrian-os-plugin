'use client';
// TextAction (UI-SPEC): the tertiary action ("Decide later", "Show all changes"), an underlined ink link.
// With an href it is a real anchor; without one it is a button that looks the same.
import type { MouseEventHandler, ReactNode } from 'react';

export type TextActionProps = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
};

export function TextAction({ children, href, onClick }: TextActionProps) {
  if (href !== undefined) {
    return (
      <a className="text-action" href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className="text-action" onClick={onClick}>
      {children}
    </button>
  );
}
