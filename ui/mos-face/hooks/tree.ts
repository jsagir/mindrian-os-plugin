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
export function treeLayout(input: LayoutInput): TreeLayout {
  const { bodyRows, columns, plain } = input
  const header: TreeHeader = bodyRows >= 24 && columns >= 40 && !plain ? 'tile' : 'words'
  const headerRows = header === 'tile' ? 3 : 1
  const controlsRows = columns >= 52 ? 1 : 2
  const hintRows = bodyRows < 24 ? 1 : columns >= 56 ? 2 : 3
  const refreshRows = bodyRows >= 24 ? 1 : 0
  const fixedRows = headerRows + 1 + controlsRows + hintRows + refreshRows
  const treeRows = bodyRows - fixedRows
  if (bodyRows < MIN_BROWSE_ROWS || treeRows < MIN_TREE_ROWS) {
    return { kind: 'too-small', needs: Math.max(MIN_BROWSE_ROWS, fixedRows + MIN_TREE_ROWS) }
  }

  return { kind: 'ok', header, headerRows, crumbRows: 1, controlsRows, hintRows, refreshRows, fixedRows, treeRows }
}

// ---- Pager and filter -------------------------------------------------------------------------

export type Page<T> =
  | { kind: 'empty'; why: 'none' | 'no-match'; filter: string }
  | { kind: 'whole'; rows: T[]; total: number; filter: string }
  | { kind: 'paged'; rows: T[]; page: number; pages: number; from: number; to: number; total: number; filter: string }

// Smart-case substring filter, then an even split into pages, then the clamp. The page is 0-based and
// clamped; from and to are 1-based. With n names and a window of size rows there are ceil(n / size) pages;
// each holds floor(n / pages) names and the first (n mod pages) pages hold one more, so no page is empty,
// the pages differ by at most one name, and the last page is never one lonely name (plan 380-20, G7). The
// pager never shows a page that does not exist and never loses or repeats a name.
export function pageOf<T>(items: readonly T[], size: number, page: number, filter: string, text: (item: T) => string): Page<T> {
  const query = filter.trim()
  // Smart case: an all-lowercase query ignores case, a query with a capital letter matches the case exactly.
  const isExact = query !== query.toLowerCase()
  const matches =
    query === '' ? [...items] : items.filter(item => (isExact ? text(item).includes(query) : text(item).toLowerCase().includes(query)))
  if (matches.length === 0) return { kind: 'empty', why: items.length === 0 ? 'none' : 'no-match', filter: query }
  const rowsPerPage = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 1
  if (matches.length <= rowsPerPage) return { kind: 'whole', rows: matches, total: matches.length, filter: query }
  const pages = Math.ceil(matches.length / rowsPerPage)
  const base = Math.floor(matches.length / pages)
  const extra = matches.length % pages
  const wanted = Number.isFinite(page) ? Math.floor(page) : 0
  const shown = Math.min(Math.max(wanted, 0), pages - 1)
  const start = shown * base + Math.min(shown, extra)
  const count = base + (shown < extra ? 1 : 0)

  return {
    kind: 'paged',
    rows: matches.slice(start, start + count),
    page: shown,
    pages,
    from: start + 1,
    to: start + count,
    total: matches.length,
    filter: query,
  }
}

// The rows a page shows, whatever its kind.
export function rowsIn<T>(page: Page<T>): T[] {
  switch (page.kind) {
    case 'empty':
      return []
    case 'whole':
    case 'paged':
      return page.rows
    default:
      return assertNever(page)
  }
}

// The words that say which rows show.
export function counterText(page: Page<unknown>): string {
  switch (page.kind) {
    case 'empty':
      return page.why === 'none' ? 'none' : `no match for "${page.filter}"`
    case 'whole':
      return page.filter === '' ? `all ${page.total}` : `${page.total} ${page.total === 1 ? 'match' : 'matches'} for "${page.filter}"`
    case 'paged':
      return `${page.from}-${page.to} of ${page.total}${page.filter === '' ? '' : ` for "${page.filter}"`}`
    default:
      return assertNever(page)
  }
}

// The first MAX_ENTRIES items, and how many were left out.
export function capEntries<T>(items: readonly T[]): { kept: T[]; more: number } {
  return { kept: items.slice(0, MAX_ENTRIES), more: Math.max(0, items.length - MAX_ENTRIES) }
}

// Sections by file count (most first), then by name.
export function sortSections<T extends { name: string; files: number }>(sections: readonly T[]): T[] {
  return [...sections].sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
}

// ---- Views, commands, crumb, hint -------------------------------------------------------------

export type TreeView =
  | { kind: 'closed' }
  | { kind: 'sections'; page: number; filter: string }
  | { kind: 'folder'; path: string; page: number; filter: string }

export function viewOf(openBlock: string, openPath: string, page: number, filter: string): TreeView {
  if (openBlock !== 'ask') return { kind: 'closed' }

  return openPath === '' ? { kind: 'sections', page, filter } : { kind: 'folder', path: openPath, page, filter }
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

export function parseTreeArgs(args: string): TreeCommand {
  const typed = args.trim()
  if (typed === '') return { kind: 'list' }
  const split = /^(\S+)\s*(.*)$/.exec(typed)
  const word = split?.[1] ?? typed
  const rest = (split?.[2] ?? '').trim()
  switch (word.toLowerCase()) {
    case 'list':
      return rest === '' ? { kind: 'list' } : { kind: 'unknown', text: typed }
    case 'next':
      return { kind: 'next' }
    case 'prev':
      return { kind: 'prev' }
    case 'up':
      return { kind: 'up' }
    case 'clear':
      return { kind: 'clear' }
    case 'find':
      return rest === '' ? { kind: 'unknown', text: word } : { kind: 'find', text: rest }
    case 'open':
      return rest === '' ? { kind: 'unknown', text: word } : { kind: 'open', text: rest }
    default:
      return { kind: 'unknown', text: typed }
  }
}

// The room name and the open path in one line of at most width characters. The room name stays; what is
// shortened is marked with ~ (plan 380-20, G6). In order: the whole path when it fits; with two folders or
// more, the room, ~ for the middle folders and the last folder; the last folder cut at its end with ~ when
// at least 4 characters of it fit; the room and the mark; the room alone; the room cut at its end with ~.
// The line never starts with ~ unless the width is 1, and never exceeds the width.
export function crumbText(room: string, path: string, width: number): string {
  const name = room === '' ? 'room' : room
  const folders = path.split('/').filter(part => part !== '')
  const full = [name, ...folders].join(' / ')
  if (full.length <= width) return full
  if (width <= 1) return '~'.slice(0, Math.max(0, width))
  const last = folders[folders.length - 1]
  if (last !== undefined) {
    const lead = folders.length >= 2 ? `${name} / ~ / ` : `${name} / `
    if (folders.length >= 2 && lead.length + last.length <= width) return `${lead}${last}`
    const avail = width - lead.length
    if (avail >= 5) return `${lead}${last.slice(0, avail - 1)}~`
    if (`${name} ~`.length <= width) return `${name} ~`
  }
  if (name.length <= width) return name

  return `${name.slice(0, width - 1)}~`
}

// ---- Crumb row plan, cap note, too-small lines (plan 380-20, G5 and G6) -----------------------

export type CrumbPlan = { crumb: string; counter: string; note: string | null }

const cutEnd = (text: string, width: number): string => (text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}~`)

const capWords = (total: number, left: number): string => `first ${total} of ${total + left}`

// The longest counter this folder can show on any page: the figures at their widest, the filter words and
// the cap words. It reads the totals only, never the page, so the window does not depend on the page.
function longestCounter(total: number, left: number, filter: string): string {
  const query = filter.trim()

  return `${total}-${total} of ${total}${query === '' ? '' : ` for "${query}"`}${left > 0 ? `  ${capWords(total, left)}` : ''}`
}

// 0 or 1: whether the cap note (first N of M) takes a row of its own. It is 1 only when names were left out
// by the cap, the whole crumb, 2 cells and the longest counter do not fit one row, and at least
// MIN_TREE_ROWS window rows remain after the note row.
export function noteRowsOf(room: string, path: string, total: number, left: number, filter: string, inner: number, treeRows: number): 0 | 1 {
  if (left <= 0) return 0
  if (treeRows - 1 < MIN_TREE_ROWS) return 0
  const whole = [room === '' ? 'room' : room, ...path.split('/').filter(part => part !== '')].join(' / ')

  return whole.length + 2 + longestCounter(total, left, filter).length > inner ? 1 : 0
}

// The crumb, the counter and the cap note row for one page. With a note row the counter is the short
// counter and the cap words go on the row below; without one the counter carries the cap words.
export function crumbRowPlan(
  room: string,
  path: string,
  counter: string,
  total: number,
  left: number,
  filter: string,
  inner: number,
  treeRows: number,
): CrumbPlan {
  const note = noteRowsOf(room, path, total, left, filter, inner, treeRows) === 1
  const wanted = note || left <= 0 ? counter : `${counter}  ${capWords(total, left)}`
  const shown = cutEnd(wanted, Math.max(8, inner - 8))

  return {
    crumb: crumbText(room, path, Math.max(1, inner - shown.length - 2)),
    counter: shown,
    note: note ? capWords(total, left) : null,
  }
}

export type TooSmall = { lines: string[]; close: boolean }

// The lines a pane too short for the tree draws, and whether it draws Close. The rows used (the lines and
// Close) never exceed the rows given. The lines say what the person can do and what docking needs; the
// tree is never printed as text here (the typed /mos-tree is the text route).
export function tooSmallLines(needs: number, bodyRows: number): TooSmall {
  const all = [
    `/m:os needs ${needs} rows to browse the room`,
    'Make the terminal taller, or dock the panel.',
    'Docking needs a terminal 110 columns wide.',
    'Or type /mos-tree in the prompt box.',
  ]
  const close = bodyRows >= 2
  const count = Math.max(0, Math.min(all.length, bodyRows - (close ? 1 : 0)))

  return { lines: all.slice(0, count), close }
}

// The hint lines at the foot: where each route works, and no key is promised.
export function hintLines(columns: number, bodyRows: number): string[] {
  const limit = Math.max(1, columns - 2)
  const lines = ((): string[] => {
    if (bodyRows < 24) {
      return [columns >= 56 ? 'Type /mos-tree next, prev, up, find, open' : columns >= 44 ? '/mos-tree next, prev, up, find' : '/mos-tree next prev up find']
    }
    if (columns >= 56) return ['Click a name to ask about it in the prompt box.', 'In the prompt box: /mos-tree next, prev, up, find']

    return ['Click a name to ask about it', 'In the prompt box, type:', '/mos-tree next prev up find']
  })()

  return lines.map(line => (line.length <= limit ? line : `${line.slice(0, Math.max(1, limit - 1))}~`))
}

// A folder name ends with a slash.
export function isFolder(name: string): name is `${string}/` {
  return name.endsWith('/')
}

// ---- Controls ---------------------------------------------------------------------------------

export type ControlId = 'up' | 'prev' | 'next' | 'find' | 'close'

// The controls that can act now, in order. A control that cannot act is not listed.
export function controlsOf(view: TreeView, page: Page<unknown>): ControlId[] {
  switch (view.kind) {
    case 'closed':
      return []
    case 'sections':
    case 'folder': {
      const out: ControlId[] = []
      if (view.kind === 'folder') out.push('up')
      if (page.kind === 'paged') {
        if (page.page > 0) out.push('prev')
        if (page.page < page.pages - 1) out.push('next')
      }
      out.push('find', 'close')

      return out
    }
    default:
      return assertNever(view)
  }
}
