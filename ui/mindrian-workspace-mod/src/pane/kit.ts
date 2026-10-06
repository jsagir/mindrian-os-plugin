// Plan 11: the pure half of the pane body kit (369.26-ENGINE-RULES.md, "Pane body recipe").
//
// A tab body is an imported file, so it can take neither `$` nor an atom (rules 1, 2, 6). It gets
// plain values in (`ctx.body`, `ctx.detailsOpen`) and closures out (`ctx.act`). The closures are
// built in src/registrars/pane.tsx, the one file that holds `$`; everything here is data in, data
// out, so a test imports it directly. Nothing in this file touches `$`, an atom, a hook or the
// environment.
//
// The state is ONE generic key, `body`: a record with one slice per tab. A slice is a bag of JSON
// (no functions, no undefined). A body narrows its own slice with an `isXState` guard, the way
// `isViewModel` narrows the model. Writes are `act.patch(tab, partial)` (merge) and
// `act.update(tab, fn)` (functional update); both run in a press, select or open handler, never in
// a view (rule 4).
import { MINDRIAN_SERVER, TAB_IDS } from '../runtime/ids'
import type { TabId } from '../runtime/ids'

// One tab's slice. An index signature, never a nested `Record<string, unknown>` (rule 9: that
// makes the engine list a phantom state key named Record).
export type BodySlice = { [key: string]: unknown }

export type BodyState = Record<TabId, BodySlice>

// The starting value: one empty slice per tab. Every call returns fresh objects, so no two readers
// ever share a slice.
export function emptyBody(): BodyState {
  return { room: {}, think: {}, sources: {}, review: {} }
}

function isSlice(x: unknown): x is BodySlice {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

// A stored value read back as a body: a value that is not an object reads as empty, a tab whose
// slice is missing or not an object reads as an empty slice. The stored value is never mutated.
export function asBody(x: unknown): BodyState {
  const out = emptyBody()
  if (!isSlice(x)) return out
  for (const tab of TAB_IDS) {
    const slice = x[tab]
    if (isSlice(slice)) out[tab] = slice
  }
  return out
}

// A new record with `partial` merged into `rec[tab]`; the other tabs are the same objects. A key
// whose value is `undefined` is removed from the slice (state is JSON: `undefined` does not exist
// there, and "clear this key" must be possible).
export function mergeBody(rec: BodyState, tab: TabId, partial: BodySlice): BodyState {
  const slice: BodySlice = { ...rec[tab] }
  for (const key of Object.keys(partial)) {
    const value = partial[key]
    if (value === undefined) delete slice[key]
    else slice[key] = value
  }
  return { ...rec, [tab]: slice }
}

// A new record with one tab's slice replaced; the other tabs are the same objects.
export function replaceBody(rec: BodyState, tab: TabId, slice: BodySlice): BodyState {
  return { ...rec, [tab]: slice }
}

// The only MCP server a body may reach through `act.io` (Canon Part 8: a body can never reach the
// Brain; the one audited Brain call is plan 16's `act.guidance`). Exact match, nothing else.
export function allowedServer(server: string): boolean {
  return server === MINDRIAN_SERVER
}

// A bare file name under the plugin's assets folder: letters, digits, dot, dash and underscore,
// starting with a letter, digit or underscore, with no parent step. Refuses '', 'a/b', '..',
// '../x' and 'a\\b'.
export function isAssetName(name: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(name) && !name.includes('..')
}
