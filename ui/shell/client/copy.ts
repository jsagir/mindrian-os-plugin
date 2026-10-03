// The UI-SPEC strings the frame (plan 369-19) and the room picker (plan 369-32) use, verbatim from
// 369-UI-SPEC.md Copywriting Contract. Hyphens only: no em-dash or en-dash anywhere in shell copy.

// Ruled by the navigator 2026-10-03 (RESEARCH Open Question 3, 369-LAUNCH-RULING.md): the shell opens
// through an argument on the existing dashboard command.
export const LAUNCH_COMMAND = '/mos:dashboard shell';

export const NO_ROOM_OPEN = {
  title: 'No room open',
  heading: { before: 'Choose a room to ', emphasis: 'open', after: '.' },
  body: 'Pick the room you want to review. This browser only reads it; nothing changes until you approve a decision.',
};

export const NO_ROOMS = {
  heading: 'There are no rooms on this machine yet.',
  body: 'Rooms are created in Claude Code. Run /mos:new-project there, and the room will appear here.',
};

export const NOT_SIGNED_IN = {
  what: 'This browser is not signed in to the workspace.',
  why: 'Workspace links work once, for this computer only.',
  fix: 'Open the workspace again from Claude Code to get a fresh link.',
};

export function serverUnreachable(port: number | string): { what: string; why: string; fix: string } {
  return {
    what: 'The workspace cannot reach MindrianOS on this machine.',
    why: 'The MindrianOS server is not answering on 127.0.0.1:' + port + '.',
    fix: 'In Claude Code, run ' + LAUNCH_COMMAND + ' again.',
  };
}

// The interim connection words (369-UI-SPEC Session Indicator, "Placeholder the executor builds until the note
// lands"). Plan 369-24 replaces the indicator body with the signed design; the Status surface keeps showing the
// plain connection word.
export const CONNECTION_WORDS = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
} as const;

// The connection-lost banner (UI-SPEC Error state). The clause about the last copy is only true once a browser
// copy exists (plan 369-23 supplies the change number); until then the sentence stops at the lost connection.
export const RECONNECT_NOW = 'Reconnect now';

export function connectionLost(seq: number | string | null): string {
  return seq === null || seq === undefined ? 'Lost the connection to the room.' : 'Lost the connection to the room. You are looking at the last copy, up to change ' + seq + '.';
}

// Room removed (UI-SPEC Error state).
export const ROOM_REMOVED = {
  what: 'This room is no longer on this machine.',
  why: 'The copy in this browser was deleted with it.',
  action: 'Choose another room',
};

// A path the shell does not serve. The chassis's own 404 draws inline styles the CSP blocks and a voice that is
// not the canon's, so the shell answers with its own What / Why / Fix (new copy, not in the UI-SPEC).
export const NOT_FOUND = {
  what: 'This page is not part of the workspace.',
  why: 'The workspace has five views: Work, Evidence, Decisions, Deliverables and Graph.',
  fix: 'Go back to Work.',
};

// The browser read copy (plan 369-23, UI-SPEC Status surface, Loading and Error states). The copy is a
// disposable projection of the room; these are the words the person sees about it.
export const COPY_STATE_WORDS = {
  'catching up': 'Catching up',
  current: 'Current',
  rebuilding: 'Rebuilding',
  disconnected: 'Disconnected',
} as const;

export const COPY_NOT_STARTED = 'Not started';

// Announced through the LiveRegion when the room's change history was compacted or its identity changed and
// this browser threw its copy away and read the room again.
export const COPY_TIDIED = 'The room was tidied since your last visit, so this browser is reading it again.';

// First read of a room (UI-SPEC Loading): progress is described, never an indefinite spinner.
export function readingTheRoom(n: number, total: number | null): string {
  return total !== null && total > 0 ? 'Reading the room. ' + n + ' of ' + total + ' items copied.' : 'Reading the room. ' + n + ' items so far.';
}
