'use client';
// LiveRegion (Canon s9, UI-SPEC): exactly one role="status" aria-live="polite" region per page. It announces
// new changes and async results, never moves focus, and is debounced to one message per 2 seconds: while a
// message is waiting, a newer one replaces it. LiveRegionProvider renders the one region; useAnnounce() is how
// any component speaks through it.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export const ANNOUNCE_INTERVAL_MS = 2000;

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce>(() => {});

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}

export function LiveRegionProvider({ children, intervalMs = ANNOUNCE_INTERVAL_MS }: { children: ReactNode; intervalMs?: number }) {
  const [message, setMessage] = useState('');
  const lastSpoken = useRef(0);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    lastSpoken.current = Date.now();
    setMessage(text);
  }, []);

  const announce = useCallback<Announce>(
    (text) => {
      const wait = lastSpoken.current + intervalMs - Date.now();
      if (wait <= 0 && timer.current === null) {
        speak(text);
        return;
      }
      pending.current = text;
      if (timer.current === null) {
        timer.current = setTimeout(() => {
          timer.current = null;
          const next = pending.current;
          pending.current = null;
          if (next !== null) speak(next);
        }, Math.max(wait, 0));
      }
    },
    [intervalMs, speak],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <LiveRegion message={message} />
    </AnnounceContext.Provider>
  );
}

export function LiveRegion({ message }: { message: string }) {
  return (
    <div className="live-region" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
