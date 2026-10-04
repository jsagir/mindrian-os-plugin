/*
 * copy-reference.ts -- the one line the shell shows a person to paste into their own Claude Code
 * (Phase 369 D-14, room-proposal path; plan 369-43).
 *
 * It lives apart from claude-adapter.ts on purpose: the browser imports this module, and the adapter
 * pulls in the proposal schema (zod), which probes for eval at load and makes the page's own Content
 * Security Policy report a violation. This file imports nothing. claude-adapter.ts re-exports
 * copyReference so the server side and its tests keep one import path.
 *
 * The line carries the opaque local node id and the question, nothing else: never a gate nonce,
 * never a session cookie.
 *
 * Erasable TypeScript only: no enum, no namespace, no parameter properties.
 */

const MAX_QUESTION_IN_REFERENCE = 300;

export function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function copyReference(selectedNodeId: string, question: string): string {
  const id = oneLine(String(selectedNodeId));
  let q = oneLine(String(question));
  if (q.length > MAX_QUESTION_IN_REFERENCE) q = q.slice(0, MAX_QUESTION_IN_REFERENCE - 3) + '...';
  return (
    'About node ' + id + ': ' + q +
    ' Please file your answer as a proposed claim and write the node id ' + id + ' in the claim text.'
  );
}
