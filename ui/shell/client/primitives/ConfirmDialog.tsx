'use client';
// ConfirmDialog (Canon s8, s10): a native <dialog> with a 2 px ink border and radius 0, an H2 at Heading size,
// one primary and one secondary action (the content exists only while it is open, so a closed dialog adds no
// second triangle to the page). Esc cancels (the secondary path); focus lands on the secondary action
// when it opens, and returns to the control that opened it when it closes. The shell has exactly one
// confirmation in v1 (leaving a decision unanswered on a room switch).
import { useEffect, useRef } from 'react';
import { ActionButton } from './ActionButton.tsx';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, body, primaryLabel, secondaryLabel, onPrimary, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-role="secondary"] button')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      opener.current?.focus();
      opener.current = null;
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {open ? (
        <>
          <h2 id="confirm-title" className="confirm-title">
            {title}
          </h2>
          <p className="confirm-body">{body}</p>
          <div className="confirm-actions">
            <ActionButton label={primaryLabel} variant="primary" onClick={onPrimary} />
            <span data-role="secondary">
              <ActionButton label={secondaryLabel} variant="secondary" onClick={onCancel} />
            </span>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
