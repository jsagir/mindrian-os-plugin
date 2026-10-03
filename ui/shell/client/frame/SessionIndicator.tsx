// INTERIM(plan 24)
// The interim session indicator (369-UI-SPEC Session Indicator, D-04): one plain word in Label 12 mono ink,
// "Connected", "Reconnecting..." or "Disconnected", read from /api/status. "Connected" appears only when the
// server says an MCP round trip was acknowledged. Nothing else is shown until the navigator signs the design
// note (369-SESSION-INDICATOR-DESIGN.md); plan 369-24 replaces this body with that design.
import { CONNECTION_WORDS } from '../copy.ts';
import { useShell } from './shell-context.ts';

export function SessionIndicator() {
  const { status } = useShell();
  if (status === null) return null;
  return (
    <span className="session-indicator" data-connection={status.connection}>
      {CONNECTION_WORDS[status.connection]}
    </span>
  );
}
