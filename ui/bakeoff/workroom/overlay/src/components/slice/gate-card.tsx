'use client';

import { useState } from 'react';
import type { GateOption, Proposed } from '../../lib/slice-api';

// The minted gate as real UI (Shape F): the options come from the server's
// rendered card (rendered.contract.superset_options), the recommended one is
// preselected, and there is exactly one Confirm control. Confirming is a human
// click; the verdict is derived on the server from the option chosen.
export function GateCard({
  proposed,
  busy,
  onConfirm,
}: {
  proposed: Proposed;
  busy: boolean;
  onConfirm: (optionId: string) => void;
}) {
  const options: GateOption[] =
    proposed.rendered?.contract?.superset_options && proposed.rendered.contract.superset_options.length > 0
      ? proposed.rendered.contract.superset_options
      : proposed.options || [];
  const flagged = options.find((o) => o.recommended === true)?.id;
  const recommended = proposed.recommended_id || flagged || options[0]?.id || '';
  const [chosen, setChosen] = useState<string>(recommended);

  return (
    <section className="border-2 border-mos-black bg-mos-soft p-4 shadow-[3px_3px_0_0_var(--color-mos-black)]" aria-label="Decision gate" data-testid="gate-card">
      <div className="mos-eyebrow text-mos-muted">Decision gate</div>
      {proposed.rendered?.contract?.notice && <p className="mt-2 text-sm font-semibold" data-testid="gate-notice">{proposed.rendered.contract.notice}</p>}
      {proposed.rationale && <p className="mt-2 text-sm">{proposed.rationale}</p>}
      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="sr-only">Verdict</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={'flex cursor-pointer items-start gap-3 border-2 px-3 py-2 ' + (chosen === o.id ? 'border-mos-blue bg-white' : 'border-mos-line')}
          >
            <input type="radio" name="verdict" value={o.id} checked={chosen === o.id} onChange={() => setChosen(o.id)} className="mt-1" />
            <span>
              <span className="font-semibold">{o.label}</span>
              {o.id === recommended && <span className="mos-eyebrow ml-2 text-mos-blue">Recommended</span>}
              {o.description && <span className="block text-sm text-mos-muted">{o.description}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={busy || !chosen}
        onClick={() => onConfirm(chosen)}
        className="mt-4 border-2 border-mos-black bg-mos-blue px-5 py-2 font-semibold text-white disabled:opacity-50"
        data-testid="gate-confirm"
      >
        {busy ? 'Recording...' : 'Confirm'}
      </button>
    </section>
  );
}
