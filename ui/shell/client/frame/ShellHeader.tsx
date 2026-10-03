'use client';
// The shell header (D-10, UI-SPEC shell frame): zone 1 of the four-zone anatomy. The room name comes first
// among the header's content (SKILL.md Zone 1: the multi-room canary), so the room selector precedes the
// wordmark in the document; the grid areas in frame.css draw the wordmark at the left. The session indicator
// and the Status control sit on the right. The wordmark is "M:OS" in Bodoni Moda with the colon drawn as two
// stacked squares, rust over cobalt, each with a 1 px ink outline (Canon s16); it links to Work.
import { RoomSelector } from './RoomSelector.tsx';
import { SessionIndicator } from './SessionIndicator.tsx';
import { STATUS_TRIGGER_ID } from './StatusPanel.tsx';
import { useShell } from './shell-context.ts';

export function ShellHeader() {
  const { rooms, current, statusOpen, setStatusOpen } = useShell();
  const purpose = rooms.find((r) => r.slug === current)?.purpose;
  return (
    <header className="shell-header">
      <div className="sh-room">
        <RoomSelector />
        {purpose ? <p className="sh-purpose">{purpose}</p> : null}
      </div>
      <a className="wordmark" href="/" aria-label="M:OS, back to Work">
        <span aria-hidden="true">M</span>
        <span className="wm-colon" aria-hidden="true">
          <span className="wm-square" data-tone="red" />
          <span className="wm-square" data-tone="blue" />
        </span>
        <span aria-hidden="true">OS</span>
      </a>
      <div className="sh-right">
        <SessionIndicator />
        <button
          type="button"
          id={STATUS_TRIGGER_ID}
          className="sh-status"
          aria-expanded={statusOpen}
          aria-controls="status-panel"
          onClick={() => setStatusOpen(!statusOpen)}
        >
          Status
        </button>
      </div>
    </header>
  );
}
