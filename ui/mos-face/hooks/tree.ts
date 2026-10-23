// The room tree (Phase 380 plan 18, G7 and G2, D-04 and D-08). Pure and erasable: no engine import,
// no clock, no random, no I/O.
//
// The tree is a list-to-detail drill-down inside the rows the host gives the pane. The host has no
// pinned header, so the plugin keeps its whole body inside scroll.bodyRows and pages the list itself
// (380-18-HOST-FACTS.md). This module holds the layout table, the pager, the filter, the counter, the
// crumb, the hint lines and the command parser. register.tsx draws and reads.

export const MIN_TREE_ROWS = 4 as const
export const MIN_BROWSE_ROWS = 9 as const
export const MAX_ENTRIES = 300 as const

// Fails to compile when a case of a switch is not handled.
export function assertNever(value: never): never {
  throw new Error(`unhandled tree case: ${JSON.stringify(value)}`)
}

// ---- Layout -----------------------------------------------------------------------------------

export type TreeHeader = 'tile' | 'words'

export type LayoutInput = { bodyRows: number; columns: number; plain: boolean }

export type TreeLayout =
  | { kind: 'too-small'; needs: number }
  | {
      kind: 'ok'
      header: TreeHeader
      headerRows: number
      crumbRows: 1
      controlsRows: number
      hintRows: number
      refreshRows: number
      fixedRows: number
      treeRows: number
    }

// The rows of each part of the browse view for a room. The body never exceeds bodyRows.
export function treeLayout(_input: LayoutInput): TreeLayout {
  throw new Error('not implemented')
}

// ---- Pager and filter -------------------------------------------------------------------------

export type Page<T> =
  | { kind: 'empty'; why: 'none' | 'no-match'; filter: string }
  | { kind: 'whole'; rows: T[]; total: number; filter: string }
  | { kind: 'paged'; rows: T[]; page: number; pages: number; from: number; to: number; total: number; filter: string }

// Smart-case substring filter, then clamp the page, then slice. The page is 0-based and clamped; from
// and to are 1-based. The pager never shows a page that does not exist and never loses a name.
export function pageOf<T>(_items: readonly T[], _size: number, _page: number, _filter: string, _text: (item: T) => string): Page<T> {
  throw new Error('not implemented')
}

// The words that say which rows show.
export function counterText(_page: Page<unknown>): string {
  throw new Error('not implemented')
}

// The first MAX_ENTRIES items, and how many were left out.
export function capEntries<T>(_items: readonly T[]): { kept: T[]; more: number } {
  throw new Error('not implemented')
}

// Sections by file count (most first), then by name.
export function sortSections<T extends { name: string; files: number }>(_sections: readonly T[]): T[] {
  throw new Error('not implemented')
}

// ---- Views, commands, crumb, hint -------------------------------------------------------------

export type TreeView =
  | { kind: 'closed' }
  | { kind: 'sections'; page: number; filter: string }
  | { kind: 'folder'; path: string; page: number; filter: string }

export function viewOf(_openBlock: string, _openPath: string, _page: number, _filter: string): TreeView {
  throw new Error('not implemented')
}

export type TreeCommand =
  | { kind: 'list' }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'up' }
  | { kind: 'clear' }
  | { kind: 'find'; text: string }
  | { kind: 'open'; text: string }
  | { kind: 'unknown'; text: string }

export function parseTreeArgs(_args: string): TreeCommand {
  throw new Error('not implemented')
}

// The room name and the open path in one line of at most width characters. A line that is too long
// is cut at the start with a tilde, so the last part survives.
export function crumbText(_room: string, _path: string, _width: number): string {
  throw new Error('not implemented')
}

// The hint lines at the foot: where each route works, and no key is promised.
export function hintLines(_columns: number, _bodyRows: number): string[] {
  throw new Error('not implemented')
}

// A folder name ends with a slash.
export function isFolder(name: string): name is `${string}/` {
  return name.endsWith('/')
}

// ---- Controls ---------------------------------------------------------------------------------

export type ControlId = 'up' | 'prev' | 'next' | 'find' | 'close'

// The controls that can act now, in order. A control that cannot act is not listed.
export function controlsOf(_view: TreeView, _page: Page<unknown>): ControlId[] {
  throw new Error('not implemented')
}
