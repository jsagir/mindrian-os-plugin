// Plan 01 (reworked in 369.26-01A): the one way the pane is opened. Seats at any width when a
// person's action calls it (UI-SPEC 7.2). Never holdToasts: the pane stays open, and holding
// toasts is for a dialog the person answers and leaves.
//
// ENGINE RULE (measured, see 369.26-ENGINE-RULES.md rule 1 and 2): `$` may not be passed into a
// function imported from another file, and `update($, ...)` needs a literal `{ plugin, key } as
// const` reference spelled in the same file. So openWorkspace is NOT a function other files call
// with `$`. It is a registrar: a file that wants the workspace to open calls
// `registerOpenWorkspace(on)` from register.tsx, and the hook (with its own `$`) is declared here,
// where `$`, the helper and the reference all live in one file.
//
// A hook in another file that needs to open the pane (the band's `o` key, plan 08) writes
// the same two calls inline, with the literal reference, instead of importing a `$` helper:
//
//   await update($, { plugin: 'mindrian-workspace', key: 'tab' } as const, () => tab)
//   await $.ui.open({ id: PANE_ID, title: text('P00'), focus: true, closeOnEscape: true })
import { update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { text } from '../copy/text'
import { PANE_ID, TAB_IDS } from './ids'
import type { TabId } from './ids'

// The tab named after the command (`workspace think`), or the room tab for no or any other word.
export function tabFromArgs(args: string): TabId {
  const word = args.trim().toLowerCase()
  return TAB_IDS.find((t) => t === word) ?? 'room'
}

export function registerOpenWorkspace(on: On): void {
  // A command.run hook on { command: 'workspace' }: its own answer is { text } and runs no
  // command, so the person sees only the pane (or the one honest line when it cannot be seated).
  on('command.run', { command: 'workspace' }, async ($, e) => {
    const tab = tabFromArgs(e.args)
    await openOn($, tab)
    return { text: '' }
  })
}

// Declared in the same file as the hook that calls it, so `$` and the literal reference sit
// together (the only shape the engine scan follows).
async function openOn($: EngineInterface, tab: TabId): Promise<void> {
  await update($, { plugin: 'mindrian-workspace', key: 'tab' } as const, () => tab)
  await $.ui.open({ id: PANE_ID, title: text('P00'), focus: true, closeOnEscape: true })
}
