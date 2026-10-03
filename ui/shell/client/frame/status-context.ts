// The one status context the session indicator reads (plan 369-24, D-04). It composes the shell frame's
// connection state (polled from GET /api/status), the browser copy's state from the replica (plan 369-23), the
// decisions-waiting count and an answer-pending flag the gate view sets (plan 27), so the risk trigger works
// without a test hook: the gate view calls setAnswerPending(true, check) while an answer is not confirmed saved.
// Framework glue only; the words come from indicator-model.ts. Erasable TypeScript (no JSX in a .ts file).
import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useReplicaOptional } from '../replica/ReplicaProvider.tsx';
import type { IndicatorConnection, IndicatorCopyState } from './indicator-model.ts';
import { useShell } from './shell-context.ts';

export type ShellStatusValue = {
  connection: IndicatorConnection;
  lastAckAt: number | null;
  readAt: number | null;
  copyState: IndicatorCopyState;
  copySeq: number | null;
  waitingCount: number;
  answerPending: boolean;
  // The gate view sets this while an answer is not confirmed saved; `check` is its "verify with the room" action.
  setAnswerPending: (pending: boolean, check?: () => void | Promise<void>) => void;
  // The indicator's one-click fixes call these.
  reconnect: () => void;
  checkAnswer: () => void;
};

export const StatusContext = createContext<ShellStatusValue | null>(null);

export function useShellStatus(): ShellStatusValue {
  const value = useContext(StatusContext);
  if (!value) throw new Error('useShellStatus: no StatusProvider above this component');
  return value;
}

// Placed inside the ReplicaProvider and the ShellContext provider by ShellFrame.
export function StatusProvider({ children }: { children: ReactNode }) {
  const { status, waiting, refresh } = useShell();
  const replica = useReplicaOptional();
  const [answerPending, setPending] = useState(false);
  const checkRef = useRef<(() => void | Promise<void>) | null>(null);

  const setAnswerPending = useCallback((pending: boolean, check?: () => void | Promise<void>) => {
    checkRef.current = pending ? (check ?? null) : null;
    setPending(pending);
  }, []);
  const reconnect = useCallback(() => {
    void refresh();
  }, [refresh]);
  const checkAnswer = useCallback(() => {
    const check = checkRef.current;
    if (check) void Promise.resolve(check()).finally(() => void refresh());
    else void refresh();
  }, [refresh]);

  const hasCopy = replica !== null && replica.roomKey !== null && !replica.removed;
  const copyState: IndicatorCopyState = replica && hasCopy ? replica.state : 'none';
  const copySeq = replica && hasCopy ? replica.seq : null;

  const value = useMemo<ShellStatusValue>(
    () => ({
      // Before the first answer the link is unproven: reconnecting, never connected.
      connection: status ? status.connection : 'reconnecting',
      lastAckAt: status ? status.lastAckAt : null,
      readAt: status && typeof status.readAt === 'number' ? status.readAt : null,
      copyState,
      copySeq,
      waitingCount: waiting,
      answerPending,
      setAnswerPending,
      reconnect,
      checkAnswer,
    }),
    [status, waiting, copyState, copySeq, answerPending, setAnswerPending, reconnect, checkAnswer],
  );

  return createElement(StatusContext.Provider, { value }, children);
}
