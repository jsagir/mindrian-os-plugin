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
