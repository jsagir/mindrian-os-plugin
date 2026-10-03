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

// The connection words the navigator signed (369-SESSION-INDICATOR-DESIGN, Q2 B). The session indicator model
// (frame/indicator-model.ts) builds its states on these; the Status surface shows the plain connection word.
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

// ---- the review views (plan 369-25: Work, Evidence, Decisions, Deliverables, Graph), UI-SPEC Copywriting Contract ----

// Work (D-09): the opening screen answers what am I trying to resolve, what do I know, what needs my attention.
export const CURRENT_QUESTION = 'Current question';
export const READING = 'Reading the room.';

export const NO_QUESTION = {
  heading: { before: 'This room has no question written ', emphasis: 'yet', after: '.' },
  body: 'Ask Larry in Claude Code to state what this room is trying to resolve.',
};

export const SINCE_YOU_WERE_HERE = 'Since you were here';
export const ROOM_HOLDS_NOW = 'What the room holds now';
export const HOLDS_OPEN_DECISIONS = 'Open decisions';
export const CHANGES_SHOWN = 5;

export function nothingChanged(date: string): string {
  return 'Nothing changed since your last visit on ' + date + '.';
}

export const NOTHING_CHANGED_UNDATED = 'Nothing changed since your last visit.';

export function showAllChanges(n: number): string {
  return 'Show all ' + n + ' changes';
}

export const SHOW_FEWER_CHANGES = 'Show the latest ' + CHANGES_SHOWN;

export const NEXT_DECISION = 'Next decision';
export const NO_DECISION_WAITING = 'No decision is waiting for you.';

export const REVIEW_NEXT_DECISION = {
  label: 'Review the next decision',
  consequence: 'Opens it with its evidence. Nothing is saved until you approve.',
};

export const OPEN_THE_EVIDENCE = {
  label: 'Open the evidence',
  consequence: 'Shows what the room knows and where each item came from.',
};

export function evidenceCount(n: number): string {
  return 'Evidence: ' + n + (n === 1 ? ' item' : ' items');
}

export function moreWaiting(n: number): string {
  return n + ' more waiting';
}

// Evidence.
export const EVIDENCE = {
  heading: 'Evidence',
  empty: 'No evidence in this room yet. Sources you file in Claude Code appear here.',
  back: 'Back to evidence',
  linkedTo: 'Linked to',
  noLinks: 'Nothing is linked to this item yet.',
  noDocument: 'This item has no source document in the room.',
  chooseOne: 'Choose an item to read it here.',
};

export function showMore(n: number): string {
  return 'Show ' + n + ' more';
}

// DocumentDisplay (D-13): read-only, never an editor.
export const DOCUMENT_COULD_NOT_DISPLAY = 'This document could not be displayed.';
export const DOCUMENT_LOADING = 'Reading the document.';
export const DOCUMENT_SHORTENED = 'The document was shortened to fit. Open it in Claude Code to read all of it.';

export function documentFix(name: string): string {
  return 'Open it in Claude Code with /mos:open ' + name + '.';
}

// A refusal reason from room_artifact, said in plain words (the reason is a sentence ending in a period).
export function documentReason(reason: string | undefined): string {
  switch (reason) {
    case 'not_found':
      return 'The file is no longer in the room';
    case 'not_markdown':
      return 'Only Markdown documents display here';
    case 'path_outside_room':
      return 'The file is outside this room';
    case 'room_unbound':
      return 'No room is open';
    default:
      return 'The room could not read the file';
  }
}

// Decisions (D-08).
export const DECISIONS = {
  heading: 'Decisions',
  waiting: 'Waiting for you',
  proposed: 'Proposed',
  settled: 'Settled',
  empty: 'No decisions yet. When Larry proposes one, it waits here for you.',
  open: 'Open this decision',
  chooseOne: 'Choose a decision to read it here.',
  subject: 'About',
};

// Deliverables (D-08, D-13): display only, no export or publish.
export const DELIVERABLES = {
  heading: 'Deliverables',
  empty: 'No deliverables yet. Finished documents filed to the room appear here.',
  chooseOne: 'Choose a document to read it here.',
};

// Graph (D-12): text only.
export const GRAPH = {
  heading: 'Graph',
  caption: "Relations shown here are only as complete as the room's typed links.",
  empty: 'No relations in this room yet. Typed links you file in Claude Code appear here.',
  choose: 'Choose an item to see how it is linked.',
  none: 'This item has no typed links yet.',
};
