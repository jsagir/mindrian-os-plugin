'use client';
// The Status surface (D-10, UI-SPEC Status surface): a right-side panel, 400 px wide on desktop and full
// screen on phones, opened by the header's Status control and closed by Esc and "Close status". It is not a
// modal: the page behind it stays readable. Rows are label and value pairs read from GET /api/status. When
// the shell server does not answer, the failing row shows its InlineError here AND the banner appears at the
// top of the view (diagnostics stay visible when something fails). Plan 369-23 adds the Browser copy state
// and "Rebuild the browser copy".
import { useEffect, useRef } from 'react';
import { CONNECTION_WORDS, serverUnreachable } from '../copy.ts';
import { InlineError } from '../primitives/InlineError.tsx';
import { TextAction } from '../primitives/TextAction.tsx';
import { useShell } from './shell-context.ts';

function clock(ms: number | null): string {
  if (ms === null) return 'No answer yet';
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
}

export const STATUS_TRIGGER_ID = 'status-trigger';

export function StatusPanel() {
  const { status, unreachable, port, statusOpen, setStatusOpen } = useShell();
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!statusOpen) return;
    heading.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStatusOpen(false);
        document.getElementById(STATUS_TRIGGER_ID)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [statusOpen, setStatusOpen]);

  const copy = unreachable ? serverUnreachable(port) : null;

  return (
    <aside id="status-panel" className="status-panel" data-open={statusOpen ? 'true' : 'false'} data-surface="deep" aria-label="Status" inert={!statusOpen}>
      <h2 className="sp-title" tabIndex={-1} ref={heading}>
        Status
      </h2>
      <dl className="sp-rows">
        <div className="sp-row" data-row="connection">
          <dt>Connection</dt>
          <dd>{status ? CONNECTION_WORDS[status.connection] : 'Waiting for the first answer'}</dd>
          {copy ? (
            <div className="sp-error">
              <InlineError what={copy.what} why={copy.why} fix={copy.fix} />
            </div>
          ) : null}
        </div>
        <div className="sp-row" data-row="address">
          <dt>Address</dt>
          <dd className="mono">{'127.0.0.1:' + port}</dd>
        </div>
        <div className="sp-row" data-row="version">
          <dt>MindrianOS version</dt>
          <dd>{status?.version ?? 'Not reported yet'}</dd>
        </div>
        <div className="sp-row" data-row="mcp-session">
          <dt>MCP session</dt>
          <dd className="mono">{status?.mcpSessionPrefix ?? 'None yet'}</dd>
        </div>
        <div className="sp-row" data-row="browser-copy">
          <dt>Browser copy</dt>
          <dd>Not started</dd>
        </div>
        <div className="sp-row" data-row="last-update">
          <dt>Last update</dt>
          <dd>{clock(status?.lastAckAt ?? null)}</dd>
        </div>
      </dl>
      <div className="sp-actions">
        <TextAction
          onClick={() => {
            setStatusOpen(false);
            document.getElementById(STATUS_TRIGGER_ID)?.focus();
          }}
        >
          Close status
        </TextAction>
      </div>
    </aside>
  );
}
