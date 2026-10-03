'use client';
// Banners (UI-SPEC Error states, Status surface): the connection-lost banner with "Reconnect now", and the
// one-line failure banner the Status surface pairs with when the shell server does not answer. Banners are
// plain text in the page; the news itself reaches assistive technology through the one LiveRegion.
import { connectionLost, RECONNECT_NOW, serverUnreachable } from '../copy.ts';
import { ActionButton } from '../primitives/ActionButton.tsx';
import { useReplicaOptional } from '../replica/ReplicaProvider.tsx';
import { useShell } from './shell-context.ts';

export function Banners({ copySeq }: { copySeq?: number | string | null }) {
  const { status, unreachable, port, refresh } = useShell();
  // The browser copy knows the change number it is current through (plan 369-23); an explicit prop still wins.
  const replica = useReplicaOptional();
  const seq = copySeq !== undefined ? copySeq : replica ? replica.seq : null;
  const lost = status !== null && status.connection === 'disconnected';
  if (!lost && !unreachable) return null;
  return (
    <div className="banners" data-surface="deep">
      {unreachable ? (
        <p className="banner" data-banner="failure">
          {serverUnreachable(port).what}
        </p>
      ) : null}
      {lost ? (
        <div className="banner" data-banner="connection-lost">
          <p>{connectionLost(seq)}</p>
          <ActionButton label={RECONNECT_NOW} variant="secondary" onClick={() => void refresh()} />
        </div>
      ) : null}
    </div>
  );
}
