// Plan 01: the contract between the pane shell (plan 07) and the four tab bodies (plans 11 to 14).
// Plan 02 narrowed KeySpec.labelId. Plan 07 (this edit) narrows TabContext and adds detailsExtra
// and onOpen to TabBody.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rule 1, measured again in plan 07): `$` is never put in an
// object and never passed into a function imported from another file. So TabContext carries NO `$`
// (the plan text said `$: EngineInterface`; the engine refuses it: "$ itself is put in an object").
// What a body could do with `$` it does through `ctx.act`: closures the shell builds in its own
// hook file, where `$` and the literal state references live. A body that needs more than `act`
// offers registers its own hooks in a registrar that receives `on`.
import type { Elements, RenderElement } from 'claude-code'

import type { CopyId } from '../copy/deck'
import type { LiveIo } from '../model/live/io'
import type { ViewModel } from '../model/view-model'
import type { TabId } from '../runtime/ids'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import type { BodySlice, BodyState } from './kit'

// Plan 02 narrowed labelId from a string to the CopyId union (the copy deck now exists); plan 07
// narrows it again to the hint labels (H01 to H22), the ids a key line is made of. None of them
// has a placeholder, so text(labelId) is valid on the whole union.
export type KeyLabelId = Extract<CopyId, `H${string}`>
export type KeySpec = { key: string; labelId: KeyLabelId }

export type ExplainId = 'X01' | 'X02' | 'X03' | 'X04'

// The element table of the surface being drawn, as $.ui.resolve(e) returns it for a hook that does
// not narrow the surface: a union, so only the names every surface has (Box, Text, Button, ...)
// are plain. Select is absent on mobile: check `'Select' in el` before using it.
export type PaneEl = Elements[keyof Elements]

// What a body can do. Every member is a closure over the hook file's `$` (or an object of them).
// Plan 11 added the body kit (369.26-ENGINE-RULES.md, "Pane body recipe"): everything after `toast`.
export type Actions = {
  // Go to a tab: writes the tab, moves focus to the new view, runs that tab's onOpen.
  setTab: (tab: TabId) => Promise<void>
  // Put text in the prompt box (never submits). Resolves whether the box took it.
  fill: (text: string) => Promise<boolean>
  // Show a short line for a few seconds (deck text only).
  toast: (message: string) => void
  // The narrow set of reads a loader may make (plan 06's LiveIo), built in the hook file. Its
  // `mcpCall` rejects, without making a call, for any server except MINDRIAN_SERVER, so a body
  // can never reach the Brain through it (Canon Part 8).
  io: LiveIo
  // Merge JSON into one tab's slice of the `body` state (a key whose value is undefined is
  // removed). A write belongs in a press, select or open handler, never in a view.
  patch: (tab: TabId, partial: BodySlice) => Promise<void>
  // A functional update of one tab's slice: `fn` gets the current slice and returns the next one.
  // Use it when the new value depends on the old (a claim that must read before it writes).
  update: (tab: TabId, fn: (slice: BodySlice) => BodySlice) => Promise<void>
  // Read the live model again and write it to the `viewModel` key. Never rejects.
  refresh: () => Promise<void>
  // The text of one derived asset under the plugin's assets folder. `name` is a bare file name:
  // a slash, a backslash, a dot name or a `..` rejects without reading.
  readAsset: (name: string) => Promise<string>
  // The active sample name (the session's sample, else the dev switch) or null for the real room.
  // `onOpen(act)` has no `ctx`, so a loader asks here and skips MCP in sample mode.
  sampleName: () => Promise<string | null>
  // Ask the pane to move the keyboard to a keyed control. A refused move is ignored.
  focus: (key: string) => Promise<void>
}

// The shell's own actions: what a body can do, plus the three sub-panel toggles the shell's
// buttons run. Built in the hook file, closures over `$`.
export type ShellActions = Actions & {
  toggleKeys: () => Promise<void>
  toggleExplain: () => Promise<void>
  toggleDetails: (tab: TabId) => Promise<void>
}

export type TabContext = {
  el: PaneEl
  // The surface being drawn. The element table `el` lists a Select on mobile too, but mobile draws
  // none (the declared table has no Select), so a body that wants a picker asks here (plan 15).
  // Optional so a context built by a test needs no surface.
  surface?: 'terminal' | 'desktop' | 'vscode' | 'mobile'
  vm: ViewModel
  // Null in plain mode and when the palette cannot load; colors only ever come from here.
  theme: Theme | null
  mode: Mode
  bodyColumns: number
  isFocused: boolean
  tab: TabId
  // The whole `body` state, one slice per tab (JSON only). A body reads `ctx.body.<tab>.<key>` and
  // narrows it with its own guard.
  body: BodyState
  // The shell's details flag for the active tab (for the one line a body shows only while open).
  detailsOpen: boolean
  act: Actions
}

export type TabBody = {
  view: (ctx: TabContext) => RenderElement | null
  // The hint-line key list for this tab (UI-SPEC 8.4).
  keys: (ctx: TabContext) => KeySpec[]
  explainId: ExplainId
  // Extra rows for the shell's details block (the Review tab puts option descriptions here).
  detailsExtra?: (ctx: TabContext) => RenderElement | null
  // Called after a tab press that lands on this tab and when the engine raises ui.open for the
  // pane with this tab active. Receives the actions, never `$` (engine rule). It must not throw
  // into the shell: the shell swallows a throw so a failing body costs nothing.
  onOpen?: (act: Actions) => void | Promise<void>
}
