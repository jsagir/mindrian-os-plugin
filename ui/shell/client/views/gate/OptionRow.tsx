'use client';
// One gate option (UI-SPEC Gate Button Anatomy, part 6): a native radio (single) or checkbox (multi) restyled as a
// 20 px square with a 10 px inner square when chosen, the two-digit rank, the label (700), the description (400,
// ink-soft) on the next line, the RECOMMENDED tag in ink mono uppercase, and a Preview disclosure when the option
// carries one. The whole row is the click target (56 px minimum). Option text is room-adjacent data: it only ever
// reaches the page as React text. Enter inside the group never submits: there is no form, and the key is stopped here.
import type { KeyboardEvent } from 'react';
import { GATE } from '../../copy.ts';
import type { GateOption } from './gate-model.ts';

export type OptionRowProps = {
  option: GateOption;
  name: string;
  mode: 'single' | 'multi';
  checked: boolean;
  disabled: boolean;
  onChoose: (id: string, checked: boolean) => void;
};

function stopEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key === 'Enter') event.preventDefault();
}

export function OptionRow({ option, name, mode, checked, disabled, onChoose }: OptionRowProps) {
  const inputId = name + '-' + option.id;
  return (
    <li className="opt-row" data-option={option.id} data-selected={checked ? 'true' : 'false'} data-recommended={option.recommended ? 'true' : 'false'}>
      <label className="opt-label" htmlFor={inputId}>
        <input
          id={inputId}
          className="opt-input"
          type={mode === 'multi' ? 'checkbox' : 'radio'}
          name={name}
          value={option.id}
          checked={checked}
          disabled={disabled}
          onKeyDown={stopEnter}
          onChange={(event) => onChoose(option.id, event.target.checked)}
        />
        <span className="opt-body">
          <span className="opt-top">
            <span className="opt-rank">{option.rankText}</span>
            <span className="opt-title">{option.label}</span>
            {option.recommended ? <span className="opt-tag">{GATE.recommended}</span> : null}
          </span>
          {option.description ? <span className="opt-desc">{option.description}</span> : null}
        </span>
      </label>
      {option.preview ? (
        <details className="opt-preview">
          <summary>{GATE.preview}</summary>
          <p>{option.preview}</p>
        </details>
      ) : null}
    </li>
  );
}
