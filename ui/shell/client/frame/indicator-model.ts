// The session indicator model (plan 369-24, D-04, CANON369-06). A pure function from the shell's status to the
// words, mark, one-click fix and announcement the navigator signed in 369-SESSION-INDICATOR-DESIGN.md (2026-10-03,
// "Q1 A, Q2 B, Q3 B, Q4 A"). Every quoted state word in that note is a string literal here and tests/
// test-369-session-indicator.cjs reads the note and compares them. Framework-free erasable TypeScript, so Node
// loads it directly. No emoji, hyphens only.
//
// INV-SL-1..5 in code: the healthy state is static text with no fix and no announcement; every other state
// carries its adjacent one-click fix; the change number is a sequence number of a real room fact, never a tally;
// the indicator is plain words plus fixes, never a destination; "Connected" needs an acknowledged MCP round trip
// that is recent (T-369-24-01).
import { CONNECTION_WORDS, RECONNECT_NOW } from '../copy.ts';

export type IndicatorConnection = 'connected' | 'reconnecting' | 'disconnected';
export type IndicatorCopyState = 'none' | 'catching up' | 'current' | 'rebuilding' | 'disconnected';
export type IndicatorKind = 'healthy' | 'reconnecting' | 'disconnected' | 'catching-up' | 'rebuilding' | 'risk';
export type IndicatorMark = 'empty' | 'square';
export type IndicatorFixAction = 'reconnect' | 'open-status' | 'check-now';

export type IndicatorStatus = {
  connection: IndicatorConnection;
  // Server time of the last acknowledged MCP round trip, or null when there has been none.
  lastAckAt: number | null;
  // Client time at which this status was read; freshness of the acknowledgement is judged at that moment.
  readAt?: number | null;
  copyState: IndicatorCopyState;
  copySeq: number | null;
  waitingCount: number;
  answerPending: boolean;
};

export type IndicatorFix = { label: string; action: IndicatorFixAction };

export type IndicatorModel = {
  kind: IndicatorKind;
  // The state words, exactly as the note quotes them. For the healthy state this is "Connected" alone.
  words: string;
  // The second line of the healthy state ("Browser copy: up to change {n}"); null in every other state.
  copyLine: string | null;
  mark: IndicatorMark;
  fix: IndicatorFix | null;
  // What the LiveRegion says when the state is entered; null when nothing is announced (healthy).
  announce: string | null;
};

// Contract default: an acknowledgement older than this when the status was read is not a live connection.
// The shell asks the server every 2 seconds and each ask is a real MCP round trip, so 30 seconds is a dozen
// missed beats.
export const ACK_FRESH_MS = 30000;

export const WORDS = {
  connected: CONNECTION_WORDS.connected,
  reconnecting: CONNECTION_WORDS.reconnecting,
  disconnected: CONNECTION_WORDS.disconnected,
  rebuilding: 'Rebuilding the browser copy',
  risk: 'Your answer is not confirmed yet. Check now',
  // Drafted by the executor in the note's pattern, not a quoted answer; the navigator may reword it at review.
  riskDropped: 'The connection dropped while a decision is open. Reconnect now',
} as const;

export const FIX_LABELS = {
  reconnect: RECONNECT_NOW,
  openStatus: 'Open Status',
  checkNow: 'Check now',
} as const;

export const ANNOUNCEMENTS = {
  reconnecting: 'Reconnecting to the room.',
  disconnected: 'Disconnected from the room.',
  catchingUp: 'Catching up with the room.',
  rebuilding: 'Rebuilding the browser copy.',
  rebuilt: 'Browser copy is current.',
} as const;

export function catchingUpWords(seq: number | null): string {
  return seq === null ? 'Catching up' : 'Catching up, change ' + seq;
}

export function copyLineWords(seq: number): string {
  return 'Browser copy: up to change ' + seq;
}

function fresh(status: IndicatorStatus): boolean {
  if (status.connection !== 'connected') return false;
  if (typeof status.lastAckAt !== 'number') return false;
  const at = typeof status.readAt === 'number' ? status.readAt : Date.now();
  return at - status.lastAckAt <= ACK_FRESH_MS;
}

export function indicatorModel(status: IndicatorStatus): IndicatorModel {
  const live = fresh(status);
  // "Connected" only after an acknowledged round trip: a connected word without a recent one reads as reconnecting.
  const connection: IndicatorConnection = live ? 'connected' : status.connection === 'disconnected' ? 'disconnected' : 'reconnecting';

  // 6. Risk: an answer is not confirmed while the link is not live, or the link dropped while a decision is open.
  if (status.answerPending && connection !== 'connected') {
    return { kind: 'risk', words: WORDS.risk, copyLine: null, mark: 'square', fix: { label: FIX_LABELS.checkNow, action: 'check-now' }, announce: WORDS.risk };
  }
  if (connection === 'disconnected' && status.waitingCount > 0) {
    return { kind: 'risk', words: WORDS.riskDropped, copyLine: null, mark: 'square', fix: { label: FIX_LABELS.reconnect, action: 'reconnect' }, announce: WORDS.riskDropped };
  }
  // 3. Disconnected.
  if (connection === 'disconnected') {
    return { kind: 'disconnected', words: WORDS.disconnected, copyLine: null, mark: 'square', fix: { label: FIX_LABELS.reconnect, action: 'reconnect' }, announce: ANNOUNCEMENTS.disconnected };
  }
  // 2. Reconnecting (also the state before the first acknowledgement).
  if (connection === 'reconnecting') {
    return { kind: 'reconnecting', words: WORDS.reconnecting, copyLine: null, mark: 'empty', fix: { label: FIX_LABELS.reconnect, action: 'reconnect' }, announce: ANNOUNCEMENTS.reconnecting };
  }
  // 5. Rebuilding.
  if (status.copyState === 'rebuilding') {
    return { kind: 'rebuilding', words: WORDS.rebuilding, copyLine: null, mark: 'empty', fix: { label: FIX_LABELS.openStatus, action: 'open-status' }, announce: ANNOUNCEMENTS.rebuilding };
  }
  // 4. Catching up.
  if (status.copyState === 'catching up' || status.copyState === 'disconnected') {
    return { kind: 'catching-up', words: catchingUpWords(status.copySeq), copyLine: null, mark: 'empty', fix: { label: FIX_LABELS.openStatus, action: 'open-status' }, announce: ANNOUNCEMENTS.catchingUp };
  }
  // 1. Healthy: static, no fix, no announcement. The line carries the change number once a copy has one.
  return {
    kind: 'healthy',
    words: WORDS.connected,
    copyLine: status.copyState === 'current' && status.copySeq !== null ? copyLineWords(status.copySeq) : null,
    mark: 'empty',
    fix: null,
    announce: null,
  };
}

// What to say through the LiveRegion when the model moves from `prev` to `next`: once on entering a state, nothing
// for a healthy change number, and "Browser copy is current." when a rebuild ends. null means stay silent.
export function announceFor(prev: IndicatorModel | null, next: IndicatorModel): string | null {
  if (prev !== null && prev.kind === 'rebuilding' && next.kind === 'healthy') return ANNOUNCEMENTS.rebuilt;
  if (next.announce === null) return null;
  if (prev !== null && prev.announce === next.announce) return null;
  return next.announce;
}
