'use client';
// ActionButton (Canon s9, UI-SPEC CTA Contract). Primary: ink field, 2 px ink border, 56 px minimum, a 24 px
// marker column with the ochre triangle, a two-line label (outcome, then consequence). Secondary: transparent,
// 2 px ink border, single line, 44 px. States: default, hover and active (CSS), focus-visible (the global ring),
// disabled (aria-disabled, never the disabled attribute, the consequence line says why), saving (the triangle
// becomes the progress line, the button stops answering clicks), success (the rust square locks in), error
// (2 px error border; the caller shows an InlineError below). A disabled or saving button ignores clicks.
import type { MouseEventHandler } from 'react';
import { StateMark } from './StateMark.tsx';

export type ActionState = 'idle' | 'disabled' | 'saving' | 'success' | 'error';

export type ActionButtonProps = {
  label: string;
  consequence?: string;
  variant?: 'primary' | 'secondary';
  state?: ActionState;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  autoFocus?: boolean;
};

export function ActionButton({ label, consequence, variant = 'primary', state = 'idle', onClick, type = 'button', autoFocus }: ActionButtonProps) {
  const inert = state === 'disabled' || state === 'saving';
  const primary = variant === 'primary';
  return (
    <button
      type={type}
      className="ab"
      data-variant={variant}
      data-state={state}
      aria-disabled={inert ? 'true' : undefined}
      autoFocus={autoFocus}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {primary ? (
        <span className="ab-marker" data-marker={state === 'success' ? 'done' : state === 'saving' ? 'line' : 'triangle'}>
          <StateMark shape={state === 'success' ? 'square' : state === 'saving' ? 'line' : 'triangle'} surface="ink" />
        </span>
      ) : null}
      <span>
        <span className="ab-label">{label}</span>
        {consequence ? <span className="ab-consequence">{consequence}</span> : null}
      </span>
    </button>
  );
}
