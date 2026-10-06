// Plan 01 (reworked in 369.26-01A, replaced in plan 07): the workspace command's argument words.
//
// The command itself now lives in src/command/workspace.ts (plan 07), registered from the pane
// registrar: `workspace` opens the pane at Review when a decision waits, else at Room;
// `workspace <tab>` opens a named tab; `workspace plain`, `workspace sample <name>` and
// `workspace live` are the switches. What stays here is the pure part, so it is tested without the
// engine.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rules 1 and 2) still explains the shape: `$` never crosses an
// import, so no helper here takes it; the hook, its `$` calls and its literal state references are
// all in the one file that registers it.
import { TAB_IDS } from './ids'
import type { TabId } from './ids'

// The tab a word names, or null for any other word (the default is the caller's choice).
export function namedTab(word: string): TabId | null {
  const w = word.trim().toLowerCase()
  return TAB_IDS.find((t) => t === w) ?? null
}

// The tab named after the command (`workspace think`), or the room tab for no or any other word.
export function tabFromArgs(args: string): TabId {
  return namedTab(args) ?? 'room'
}
