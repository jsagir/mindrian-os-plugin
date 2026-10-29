import { expect, test } from 'claude-code/testing'

import {
  MAX_ENTRIES,
  MIN_BROWSE_ROWS,
  MIN_TREE_ROWS,
  capEntries,
  controlsOf,
  counterText,
  crumbText,
  hintLines,
  isFolder,
  pageOf,
  parseTreeArgs,
  rowsIn,
  sortSections,
  treeLayout,
  viewOf,
} from '../hooks/tree'
import type { Page } from '../hooks/tree'

// Phase 380 plan 18 (G7, G2, D-04, D-08): the pure model of the room tree.
//
//   T-P1 the layout table        T-P2 the pager            T-P3 the smart-case filter
//   T-P4 the counter words       T-P5 the command parser   T-P6 the crumb
//   T-P7 the hint lines          T-P8 the entry cap        T-P9 the section order
//   T-P10 the controls           T-P11 the view
//
// Pure functions only: no engine, no calls, no files. Fixtures are made names.

const names = (count: number): string[] => Array.from({ length: count }, (_, k) => `name-${String(k + 1).padStart(2, '0')}`)
const same = (name: string): string => name

// ---- T-P1 the layout table --------------------------------------------------------------------

type Row = { bodyRows: number; columns: number; plain: boolean; header: 'tile' | 'words'; headerRows: number; hintRows: number; controlsRows: number; fixedRows: number; treeRows: number }

// bodyRows, columns, plain, then header, hint rows, controls rows, fixed rows, tree rows (the plan table).
const TABLE: Row[] = [
  { bodyRows: 40, columns: 56, plain: false, header: 'tile', headerRows: 3, hintRows: 2, controlsRows: 1, fixedRows: 8, treeRows: 32 },
  { bodyRows: 24, columns: 44, plain: false, header: 'tile', headerRows: 3, hintRows: 3, controlsRows: 2, fixedRows: 10, treeRows: 14 },
  { bodyRows: 24, columns: 35, plain: false, header: 'words', headerRows: 1, hintRows: 3, controlsRows: 2, fixedRows: 8, treeRows: 16 },
  { bodyRows: 23, columns: 56, plain: false, header: 'words', headerRows: 1, hintRows: 1, controlsRows: 1, fixedRows: 4, treeRows: 19 },
  { bodyRows: 11, columns: 44, plain: false, header: 'words', headerRows: 1, hintRows: 1, controlsRows: 2, fixedRows: 5, treeRows: 6 },
  { bodyRows: 9, columns: 35, plain: false, header: 'words', headerRows: 1, hintRows: 1, controlsRows: 2, fixedRows: 5, treeRows: 4 },
  { bodyRows: 40, columns: 56, plain: true, header: 'words', headerRows: 1, hintRows: 2, controlsRows: 1, fixedRows: 6, treeRows: 34 },
]

// One line at the start of the line for every test( declaration: tests/test-380-engine-tests.cjs counts them.
const checkRow = (row: Row): void => {
  const layout = treeLayout({ bodyRows: row.bodyRows, columns: row.columns, plain: row.plain })
  expect(layout.kind).toBe('ok')
  if (layout.kind !== 'ok') return
  expect({
    header: layout.header,
    headerRows: layout.headerRows,
    hintRows: layout.hintRows,
    controlsRows: layout.controlsRows,
    fixedRows: layout.fixedRows,
    treeRows: layout.treeRows,
    crumbRows: layout.crumbRows,
  }).toEqual({
    header: row.header,
    headerRows: row.headerRows,
    hintRows: row.hintRows,
    controlsRows: row.controlsRows,
    fixedRows: row.fixedRows,
    treeRows: row.treeRows,
    crumbRows: 1,
  })
}

test('T-P1 the layout at 56 columns by 40 rows is a tile header, 2 hint rows, 1 control row and 32 tree rows', () => checkRow(TABLE[0] as Row))
test('T-P1 the layout at 44 columns by 24 rows is a tile header, 3 hint rows, 2 control rows and 14 tree rows', () => checkRow(TABLE[1] as Row))
test('T-P1 the layout at 35 columns by 24 rows is a words header, 3 hint rows, 2 control rows and 16 tree rows', () => checkRow(TABLE[2] as Row))
test('T-P1 the layout at 56 columns by 23 rows is a words header, 1 hint row, 1 control row and 19 tree rows', () => checkRow(TABLE[3] as Row))
test('T-P1 the layout at 44 columns by 11 rows is a words header, 1 hint row, 2 control rows and 6 tree rows', () => checkRow(TABLE[4] as Row))
test('T-P1 the layout at 35 columns by 9 rows is a words header, 1 hint row, 2 control rows and 4 tree rows', () => checkRow(TABLE[5] as Row))
test('T-P1 the layout at 56 columns by 40 rows in plain mode is a words header, 2 hint rows, 1 control row and 34 tree rows', () => checkRow(TABLE[6] as Row))

test('T-P1 the refresh row shows from 24 rows and not below', () => {
  const tall = treeLayout({ bodyRows: 24, columns: 56, plain: false })
  const short = treeLayout({ bodyRows: 23, columns: 56, plain: false })
  expect(tall.kind === 'ok' ? tall.refreshRows : -1).toBe(1)
  expect(short.kind === 'ok' ? short.refreshRows : -1).toBe(0)
})

test('T-P1 8 rows is too small and names the 9 rows it needs', () => {
  expect(treeLayout({ bodyRows: 8, columns: 56, plain: false })).toEqual({ kind: 'too-small', needs: 9 })
})

test('T-P1 the constants are 4 tree rows, 9 browse rows and 300 entries', () => {
  expect(MIN_TREE_ROWS).toBe(4)
  expect(MIN_BROWSE_ROWS).toBe(9)
  expect(MAX_ENTRIES).toBe(300)
})

test('T-P1 the fixed rows and the tree rows add up to the body rows at every size from 9 to 60', () => {
  const bad: string[] = []
  for (let rows = 9; rows <= 60; rows++) {
    for (const columns of [30, 35, 44, 52, 56, 76]) {
      for (const plain of [false, true]) {
        const layout = treeLayout({ bodyRows: rows, columns, plain })
        if (layout.kind === 'too-small') {
          if (layout.needs <= rows) bad.push(`${columns}x${rows} too small yet needs ${layout.needs}`)
          continue
        }
        if (layout.fixedRows + layout.treeRows !== rows) bad.push(`${columns}x${rows} sum ${layout.fixedRows + layout.treeRows}`)
        if (layout.treeRows < MIN_TREE_ROWS) bad.push(`${columns}x${rows} tree ${layout.treeRows}`)
      }
    }
  }
  expect(bad).toEqual([])
})

// ---- T-P2 the pager ---------------------------------------------------------------------------

test('T-P2 no items is an empty page with the reason none', () => {
  expect(pageOf([], 10, 0, '', same)).toEqual({ kind: 'empty', why: 'none', filter: '' })
})

test('T-P2 one item is a whole page', () => {
  expect(pageOf(['solo'], 10, 0, '', same)).toEqual({ kind: 'whole', rows: ['solo'], total: 1, filter: '' })
})

test('T-P2 exactly the size is a whole page of 10 rows', () => {
  const page = pageOf(names(10), 10, 0, '', same)
  expect(page.kind).toBe('whole')
  expect(page.kind === 'whole' ? page.rows : []).toEqual(names(10))
})

test('T-P2 size plus 1 is 2 balanced pages, the first with 6 rows and the second with 5', () => {
  const first = pageOf(names(11), 10, 0, '', same)
  const second = pageOf(names(11), 10, 1, '', same)
  expect(first.kind === 'paged' ? [first.pages, first.from, first.to, first.rows.length] : []).toEqual([2, 1, 6, 6])
  expect(second.kind === 'paged' ? [second.pages, second.from, second.to, second.rows.length] : []).toEqual([2, 7, 11, 5])
})

test('T-P2 14 items at size 10: page 1 shows 1 to 7 and page 2 shows 8 to 14', () => {
  const first = pageOf(names(14), 10, 0, '', same)
  const second = pageOf(names(14), 10, 1, '', same)
  expect(first.kind === 'paged' ? [first.page, first.pages, first.from, first.to, first.total] : []).toEqual([0, 2, 1, 7, 14])
  expect(second.kind === 'paged' ? [second.page, second.pages, second.from, second.to, second.total] : []).toEqual([1, 2, 8, 14, 14])
})

test('T-P2 16 items at size 10 lose no name and show none twice', () => {
  const all = names(16)
  const shown = [0, 1].flatMap(page => {
    const one = pageOf(all, 10, page, '', same)
    return one.kind === 'paged' ? one.rows : []
  })
  expect(shown).toEqual(all)
})

test('T-P2 a page below 0 clamps to the first page', () => {
  const page = pageOf(names(14), 10, -5, '', same)
  expect(page.kind === 'paged' ? page.page : -1).toBe(0)
})

test('T-P2 a page past the last clamps to the last page', () => {
  const page = pageOf(names(14), 10, 99, '', same)
  expect(page.kind === 'paged' ? [page.page, page.from, page.to] : []).toEqual([1, 8, 14])
})

test('T-P2 a page that is not a number counts as the first page', () => {
  const page = pageOf(names(14), 10, Number.NaN, '', same)
  expect(page.kind === 'paged' ? page.page : -1).toBe(0)
})

test('T-P2 a size of 0 still shows one row on a page and loses no name', () => {
  const all = names(3)
  const shown = [0, 1, 2].flatMap(page => {
    const one = pageOf(all, 0, page, '', same)
    return one.kind === 'paged' ? one.rows : one.kind === 'whole' ? one.rows : []
  })
  expect(shown).toEqual(all)
})

// ---- T-P3 the filter --------------------------------------------------------------------------

const ROOM = ['legal-ip', 'Legal-Notes', 'market-analysis', 'Market-Sizing', 'team']

test('T-P3 a lowercase query matches any case', () => {
  const page = pageOf(ROOM, 10, 0, 'legal', same)
  expect(page.kind === 'whole' ? page.rows : []).toEqual(['legal-ip', 'Legal-Notes'])
})

test('T-P3 a query with a capital letter matches the case exactly', () => {
  const page = pageOf(ROOM, 10, 0, 'Legal', same)
  expect(page.kind === 'whole' ? page.rows : []).toEqual(['Legal-Notes'])
})

test('T-P3 a query with no match is an empty page with the reason no-match', () => {
  expect(pageOf(ROOM, 10, 0, 'zzz', same)).toEqual({ kind: 'empty', why: 'no-match', filter: 'zzz' })
})

test('T-P3 an empty query is no filter', () => {
  const page = pageOf(ROOM, 10, 0, '', same)
  expect(page.kind === 'whole' ? page.rows : []).toEqual(ROOM)
})

test('T-P3 a query of spaces is no filter', () => {
  const page = pageOf(ROOM, 10, 0, '   ', same)
  expect(page.kind === 'whole' ? page.total : -1).toBe(5)
})

test('T-P3 the filter runs before the pages, so a filter of a long list pages only the matches', () => {
  const all = [...names(30), 'legal-a', 'legal-b', 'legal-c']
  const page = pageOf(all, 2, 1, 'legal', same)
  expect(page.kind === 'paged' ? [page.rows, page.pages, page.total] : []).toEqual([['legal-c'], 2, 3])
})

test('T-P3 the filter reads the text function, not the item', () => {
  const page = pageOf([{ name: 'alpha' }, { name: 'beta' }], 10, 0, 'bet', one => one.name)
  expect(page.kind === 'whole' ? page.rows : []).toEqual([{ name: 'beta' }])
})

// ---- T-P4 the counter words -------------------------------------------------------------------

test('T-P4 a whole page says all and the number', () => {
  expect(counterText(pageOf(names(7), 10, 0, '', same))).toBe('all 7')
})

test('T-P4 a paged page says which rows show', () => {
  expect(counterText(pageOf(names(14), 10, 0, '', same))).toBe('1-7 of 14')
  expect(counterText(pageOf(names(14), 10, 1, '', same))).toBe('8-14 of 14')
})

test('T-P4 an empty page with no items says none', () => {
  expect(counterText(pageOf([], 10, 0, '', same))).toBe('none')
})

test('T-P4 an empty page with a filter says no match for the filter', () => {
  expect(counterText(pageOf(ROOM, 10, 0, 'zzz', same))).toBe('no match for "zzz"')
})

test('T-P4 a filtered whole page says how many match', () => {
  expect(counterText(pageOf(ROOM, 10, 0, 'legal', same))).toBe('2 matches for "legal"')
  expect(counterText(pageOf(ROOM, 10, 0, 'Legal', same))).toBe('1 match for "Legal"')
})

test('T-P4 a filtered paged page names the filter after the rows', () => {
  const all = [...names(30), 'legal-a', 'legal-b', 'legal-c']
  expect(counterText(pageOf(all, 2, 0, 'legal', same))).toBe('1-2 of 3 for "legal"')
})

test('T-P4 a hand-made empty page of any reason has words', () => {
  const none: Page<string> = { kind: 'empty', why: 'none', filter: '' }
  expect(counterText(none)).toBe('none')
})

// ---- T-P5 the command parser ------------------------------------------------------------------

test('T-P5 an empty string is the list command', () => {
  expect(parseTreeArgs('')).toEqual({ kind: 'list' })
  expect(parseTreeArgs('   ')).toEqual({ kind: 'list' })
})

test('T-P5 next, prev, up and clear are commands', () => {
  expect(parseTreeArgs('next')).toEqual({ kind: 'next' })
  expect(parseTreeArgs('prev')).toEqual({ kind: 'prev' })
  expect(parseTreeArgs('up')).toEqual({ kind: 'up' })
  expect(parseTreeArgs('clear')).toEqual({ kind: 'clear' })
})

test('T-P5 find with a word keeps the word as typed, trimmed', () => {
  expect(parseTreeArgs('find legal')).toEqual({ kind: 'find', text: 'legal' })
  expect(parseTreeArgs('  find   Legal IP  ')).toEqual({ kind: 'find', text: 'Legal IP' })
})

test('T-P5 find with no word is unknown', () => {
  expect(parseTreeArgs('find')).toEqual({ kind: 'unknown', text: 'find' })
  expect(parseTreeArgs('find   ')).toEqual({ kind: 'unknown', text: 'find' })
})

test('T-P5 open with a word is open, and open with no word is unknown', () => {
  expect(parseTreeArgs('open market')).toEqual({ kind: 'open', text: 'market' })
  expect(parseTreeArgs('open')).toEqual({ kind: 'unknown', text: 'open' })
})

test('T-P5 a verb in capitals is the same verb', () => {
  expect(parseTreeArgs('NEXT')).toEqual({ kind: 'next' })
  expect(parseTreeArgs('Find Legal')).toEqual({ kind: 'find', text: 'Legal' })
})

test('T-P5 an unknown verb is unknown and keeps the typed word', () => {
  expect(parseTreeArgs('jump 3')).toEqual({ kind: 'unknown', text: 'jump 3' })
})

// ---- T-P6 the crumb ---------------------------------------------------------------------------

test('T-P6 a crumb that fits shows the whole path', () => {
  expect(crumbText('demo-room', 'market-analysis/sizing', 60)).toBe('demo-room / market-analysis / sizing')
})

test('T-P6 a crumb with no path shows the room name', () => {
  expect(crumbText('demo-room', '', 30)).toBe('demo-room')
})

test('T-P6 a crumb that is too long keeps the start of the room name and ends with the mark', () => {
  const text = crumbText('a-very-long-room-name', 'market-analysis/sizing', 20)
  expect(text.length).toBeLessThanOrEqual(20)
  expect(text.startsWith('a-very')).toBe(true)
  expect(text.startsWith('~')).toBe(false)
  expect(text.endsWith('~')).toBe(true)
})

test('T-P6 a crumb with no room name says room', () => {
  expect(crumbText('', '', 30)).toBe('room')
})

test('T-P6 a width of 1 gives one character and never an empty line', () => {
  expect(crumbText('demo-room', 'x', 1).length).toBe(1)
})

// ---- T-P7 the hint lines ----------------------------------------------------------------------

const COLUMNS = [30, 35, 44, 56, 76]

test('T-P7 every hint line is at most columns minus 2 characters at 30, 35, 44, 56 and 76 columns', () => {
  const bad: string[] = []
  for (const columns of COLUMNS) {
    for (const bodyRows of [10, 23, 24, 40]) {
      for (const line of hintLines(columns, bodyRows)) if (line.length > columns - 2) bad.push(`${columns}x${bodyRows}: ${line}`)
    }
  }
  expect(bad).toEqual([])
})

test('T-P7 every hint set names /mos-tree', () => {
  const bad: string[] = []
  for (const columns of COLUMNS) {
    for (const bodyRows of [10, 23, 24, 40]) {
      if (!hintLines(columns, bodyRows).join(' ').includes('/mos-tree')) bad.push(`${columns}x${bodyRows}`)
    }
  }
  expect(bad).toEqual([])
})

test('T-P7 every set of 24 rows or more says the commands work in the prompt box', () => {
  const bad: string[] = []
  for (const columns of COLUMNS) {
    for (const bodyRows of [24, 40]) {
      if (!hintLines(columns, bodyRows).join(' ').includes('prompt box')) bad.push(`${columns}x${bodyRows}`)
    }
  }
  expect(bad).toEqual([])
})

test('T-P7 no hint line promises a key: press, ctrl, hotkey, Tab and Esc do not appear', () => {
  const text = COLUMNS.flatMap(columns => [10, 24, 40].flatMap(bodyRows => hintLines(columns, bodyRows))).join('\n')
  expect(/\b(press|ctrl|hotkey|tab|esc|escape)\b/i.test(text)).toBe(false)
})

test('T-P7 the number of hint lines equals the hint rows of the layout', () => {
  const bad: string[] = []
  for (const columns of COLUMNS) {
    for (const bodyRows of [9, 11, 23, 24, 40]) {
      const layout = treeLayout({ bodyRows, columns, plain: false })
      if (layout.kind === 'ok' && hintLines(columns, bodyRows).length !== layout.hintRows) bad.push(`${columns}x${bodyRows}`)
    }
  }
  expect(bad).toEqual([])
})

// ---- T-P8 the entry cap -----------------------------------------------------------------------

test('T-P8 a list of 2000 keeps the first 300 and reports 1700 more', () => {
  const capped = capEntries(names(2000))
  expect(capped.kept).toHaveLength(300)
  expect(capped.kept[0]).toBe('name-01')
  expect(capped.more).toBe(1700)
})

test('T-P8 a list of exactly 300 keeps all and reports 0 more', () => {
  const capped = capEntries(names(300))
  expect(capped.kept).toHaveLength(300)
  expect(capped.more).toBe(0)
})

test('T-P8 a list of 16 keeps all 16 and reports 0 more', () => {
  const capped = capEntries(names(16))
  expect(capped.kept).toEqual(names(16))
  expect(capped.more).toBe(0)
})

// ---- T-P9 the section order -------------------------------------------------------------------

test('T-P9 sections sort by file count, most first, then by name', () => {
  const sorted = sortSections([
    { name: 'beta', files: 2 },
    { name: 'alpha', files: 2 },
    { name: 'zed', files: 9 },
    { name: 'empty', files: 0 },
  ])
  expect(sorted.map(one => one.name)).toEqual(['zed', 'alpha', 'beta', 'empty'])
})

test('T-P9 sorting does not change the list it was given', () => {
  const given = [
    { name: 'b', files: 1 },
    { name: 'a', files: 2 },
  ]
  sortSections(given)
  expect(given.map(one => one.name)).toEqual(['b', 'a'])
})

// ---- T-P10 the controls -----------------------------------------------------------------------

test('T-P10 the section list on its first page has Next, Find and Close, and no Up and no Prev', () => {
  const page = pageOf(names(14), 10, 0, '', same)
  expect(controlsOf({ kind: 'sections', page: 0, filter: '' }, page)).toEqual(['next', 'find', 'close'])
})

test('T-P10 the section list on its last page has Prev, Find and Close, and no Next', () => {
  const page = pageOf(names(14), 10, 1, '', same)
  expect(controlsOf({ kind: 'sections', page: 1, filter: '' }, page)).toEqual(['prev', 'find', 'close'])
})

test('T-P10 a folder has Up, and a middle page has both Prev and Next', () => {
  const page = pageOf(names(30), 10, 1, '', same)
  expect(controlsOf({ kind: 'folder', path: 'big', page: 1, filter: '' }, page)).toEqual(['up', 'prev', 'next', 'find', 'close'])
})

test('T-P10 a whole page has no Prev and no Next', () => {
  const page = pageOf(names(3), 10, 0, '', same)
  expect(controlsOf({ kind: 'sections', page: 0, filter: '' }, page)).toEqual(['find', 'close'])
})

test('T-P10 an empty page inside a folder still has Up, Find and Close', () => {
  const page = pageOf([], 10, 0, '', same)
  expect(controlsOf({ kind: 'folder', path: 'big', page: 0, filter: '' }, page)).toEqual(['up', 'find', 'close'])
})

test('T-P10 a closed view has no controls', () => {
  expect(controlsOf({ kind: 'closed' }, pageOf([], 10, 0, '', same))).toEqual([])
})

// ---- T-P11 the view ---------------------------------------------------------------------------

test('T-P11 the view is closed unless the open block is ask', () => {
  expect(viewOf('', '', 0, '')).toEqual({ kind: 'closed' })
  expect(viewOf('room', 'big', 0, '')).toEqual({ kind: 'closed' })
})

test('T-P11 the view is the section list with no open path and a folder with one', () => {
  expect(viewOf('ask', '', 2, 'legal')).toEqual({ kind: 'sections', page: 2, filter: 'legal' })
  expect(viewOf('ask', 'big/sub', 1, '')).toEqual({ kind: 'folder', path: 'big/sub', page: 1, filter: '' })
})

test('T-P11 a name that ends with a slash is a folder', () => {
  expect(isFolder('sizing/')).toBe(true)
  expect(isFolder('notes.md')).toBe(false)
})

// ---- T-P12 the rows of a page -----------------------------------------------------------------

test('T-P12 the rows of a page are its rows, and an empty page has none', () => {
  expect(rowsIn(pageOf(names(3), 10, 0, '', same))).toEqual(names(3))
  expect(rowsIn(pageOf(names(14), 10, 1, '', same))).toEqual(names(14).slice(7))
  expect(rowsIn(pageOf([], 10, 0, '', same))).toEqual([])
})
