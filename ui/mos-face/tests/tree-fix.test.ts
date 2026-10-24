import { expect, test } from 'claude-code/testing'

import { counterText, crumbRowPlan, crumbText, noteRowsOf, pageOf, parseTreeArgs, tooSmallLines } from '../hooks/tree'

// Phase 380 plan 20 (G5, G6, G7, G8; D-04, D-08): the pure repair of the room tree.
//
//   TF-P1 the balanced pager, swept     TF-P2 named cases of the pager
//   TF-P3 clamps and the filter         TF-P4 the crumb
//   TF-P5 the cap note row and plan     TF-P6 the list verb
//   TF-P7 the lines of a pane too short
//
// Pure functions only: no engine, no calls, no files. Fixtures are made names.

const names = (count: number): string[] => Array.from({ length: count }, (_, k) => `name-${String(k + 1).padStart(3, '0')}`)
const same = (name: string): string => name

type Shown = { rows: string[]; from: number; to: number; pages: number }

// Every page of a list in a window, in order. A whole list is one page.
const pagesOf = (count: number, window: number): Shown[] => {
  const all = names(count)
  const first = pageOf(all, window, 0, '', same)
  if (first.kind === 'whole') return [{ rows: first.rows, from: 1, to: first.total, pages: 1 }]
  if (first.kind !== 'paged') return []
  const out: Shown[] = []
  for (let page = 0; page < first.pages; page++) {
    const one = pageOf(all, window, page, '', same)
    if (one.kind === 'paged') out.push({ rows: one.rows, from: one.from, to: one.to, pages: one.pages })
  }

  return out
}

// ---- TF-P1 the balanced pager, swept ----------------------------------------------------------

test('TF-P1 for 1 to 400 names and windows of 4 to 40 rows the pages hold every name once, in order, and differ by at most 1', () => {
  const bad: string[] = []
  for (let count = 1; count <= 400; count++) {
    for (let window = 4; window <= 40; window++) {
      const pages = pagesOf(count, window)
      const flat = pages.flatMap(page => page.rows)
      const sizes = pages.map(page => page.rows.length)
      const wantPages = Math.ceil(count / window)
      if (flat.join() !== names(count).join()) bad.push(`${count}/${window} names lost or repeated`)
      if (sizes.some(size => size === 0)) bad.push(`${count}/${window} empty page`)
      if (Math.max(...sizes) - Math.min(...sizes) > 1) bad.push(`${count}/${window} unbalanced ${sizes.join(',')}`)
      if (Math.max(...sizes) > window) bad.push(`${count}/${window} page taller than the window`)
      if (pages.length !== wantPages) bad.push(`${count}/${window} ${pages.length} pages, wanted ${wantPages}`)
      if (count > window && Math.min(...sizes) < Math.floor((window + 1) / 2)) bad.push(`${count}/${window} a thin page ${sizes.join(',')}`)
      if (bad.length > 20) break
    }
    if (bad.length > 20) break
  }
  expect(bad).toEqual([])
})

// ---- TF-P2 named cases ------------------------------------------------------------------------

test('TF-P2 18 names in a window of 17 are two pages of 9 with the counters 1-9 of 18 and 10-18 of 18', () => {
  const all = names(18)
  const one = pageOf(all, 17, 0, '', same)
  const two = pageOf(all, 17, 1, '', same)
  expect(one.kind === 'paged' ? one.rows.length : -1).toBe(9)
  expect(two.kind === 'paged' ? two.rows.length : -1).toBe(9)
  expect(counterText(one)).toBe('1-9 of 18')
  expect(counterText(two)).toBe('10-18 of 18')
})

test('TF-P2 21 names in a window of 5 are 5, 4, 4, 4 and 4', () => {
  expect(pagesOf(21, 5).map(page => page.rows.length)).toEqual([5, 4, 4, 4, 4])
})

test('TF-P2 14 names in a window of 10 are 7 and 7, and 11 in 10 are 6 and 5', () => {
  expect(pagesOf(14, 10).map(page => page.rows.length)).toEqual([7, 7])
  expect(pagesOf(11, 10).map(page => page.rows.length)).toEqual([6, 5])
})

test('TF-P2 exactly 10 names in a window of 10 are one whole page', () => {
  const page = pageOf(names(10), 10, 0, '', same)
  expect(page.kind).toBe('whole')
})

test('TF-P2 300 names in a window of 10 are 30 pages of 10, and in a window of 17 are 18 pages: twelve of 17 and six of 16', () => {
  expect(pagesOf(300, 10).map(page => page.rows.length)).toEqual(Array.from({ length: 30 }, () => 10))
  const sizes = pagesOf(300, 17).map(page => page.rows.length)
  expect(sizes).toHaveLength(18)
  expect(sizes.filter(size => size === 17)).toHaveLength(12)
  expect(sizes.filter(size => size === 16)).toHaveLength(6)
})

// ---- TF-P3 the clamps and the filter ----------------------------------------------------------

test('TF-P3 the clamps hold with balanced pages: below 0 is the first page, past the last is the last page, not a number is the first page', () => {
  const all = names(18)
  const low = pageOf(all, 17, -4, '', same)
  const high = pageOf(all, 17, 99, '', same)
  const nan = pageOf(all, 17, Number.NaN, '', same)
  expect(low.kind === 'paged' ? [low.page, low.from, low.to] : []).toEqual([0, 1, 9])
  expect(high.kind === 'paged' ? [high.page, high.from, high.to] : []).toEqual([1, 10, 18])
  expect(nan.kind === 'paged' ? nan.page : -1).toBe(0)
})

test('TF-P3 a window of 0 gives pages of one name and loses none, and the filter runs before the split', () => {
  const zero = [0, 1, 2].flatMap(page => {
    const one = pageOf(names(3), 0, page, '', same)
    return one.kind === 'paged' ? one.rows : []
  })
  expect(zero).toEqual(names(3))

  const all = [...names(40), 'legal-a', 'legal-b', 'legal-c', 'legal-d']
  const first = pageOf(all, 3, 0, 'legal', same)
  const second = pageOf(all, 3, 1, 'legal', same)
  expect(first.kind === 'paged' ? [first.rows.length, first.pages, first.total] : []).toEqual([2, 2, 4])
  expect(second.kind === 'paged' ? second.rows.length : -1).toBe(2)
  expect(counterText(second)).toBe('3-4 of 4 for "legal"')
})

// ---- TF-P4 the crumb --------------------------------------------------------------------------

test('TF-P4 the whole path when it fits, and the room, the mark and the cut last name when it does not', () => {
  expect(crumbText('demo-room', 'archive-2000', 40)).toBe('demo-room / archive-2000')
  expect(crumbText('demo-room', 'archive-2000', 20)).toBe('demo-room / archive~')
  expect(crumbText('demo-room', 'archive-2000', 16)).toBe('demo-room ~')
  expect(crumbText('demo-room', 'archive-2000', 10)).toBe('demo-room')
  expect(crumbText('demo-room', 'archive-2000', 6)).toBe('demo-~')
})

test('TF-P4 with two folders or more the middle ones are the mark', () => {
  expect(crumbText('demo-room', 'market-analysis/sizing', 22)).toBe('demo-room / ~ / sizing')
  expect(crumbText('demo-room', 'market-analysis/sizing', 18)).toBe('demo-room ~')
  expect(crumbText('demo-room', 'market-analysis/sizing', 26)).toBe('demo-room / ~ / sizing')
})

test('TF-P4 the result never exceeds the width and never begins with the mark unless the width is 1', () => {
  const paths = ['', 'archive-2000', 'market-analysis/sizing', 'a/b/c/d', 'deep/level-two-folder/level-three-folder-long']
  const rooms = ['demo-room', 'a-very-long-room-name-for-a-test', 'r', '']
  const bad: string[] = []
  for (const room of rooms) {
    for (const path of paths) {
      for (let width = 2; width <= 60; width++) {
        const text = crumbText(room, path, width)
        if (text.length > width) bad.push(`${room}|${path}|${width} too long: ${text}`)
        if (text.startsWith('~')) bad.push(`${room}|${path}|${width} starts with the mark: ${text}`)
        if (text.length === 0) bad.push(`${room}|${path}|${width} empty`)
      }
      expect(crumbText(room, path, 1)).toBe('~')
    }
  }
  expect(bad).toEqual([])
})

// ---- TF-P5 the cap note row and the plan ------------------------------------------------------

test('TF-P5 a capped folder whose crumb and long counter do not fit one row gets a note row, with the crumb whole and the short counter', () => {
  expect(noteRowsOf('demo-room', 'archive-2000', 300, 1700, '', 44, 14)).toBe(1)
  const plan = crumbRowPlan('demo-room', 'archive-2000', '1-14 of 300', 300, 1700, '', 44, 14)
  expect(plan.crumb).toBe('demo-room / archive-2000')
  expect(plan.counter).toBe('1-14 of 300')
  expect(plan.note).toBe('first 300 of 2000')
})

test('TF-P5 when the crumb and the long counter fit one row there is no note row and the counter carries the cap words', () => {
  expect(noteRowsOf('demo-room', 'huge', 300, 1700, '', 54, 10)).toBe(0)
  const plan = crumbRowPlan('demo-room', 'huge', '1-10 of 300', 300, 1700, '', 54, 10)
  expect(plan.note).toBeNull()
  expect(plan.counter).toBe('1-10 of 300  first 300 of 2000')
  expect(plan.crumb).toBe('demo-room / huge')
})

test('TF-P5 with 4 tree rows the note row is 0 whatever the width, and a list with nothing left out never has one', () => {
  for (const inner of [20, 30, 44, 54, 80]) {
    expect(noteRowsOf('demo-room', 'archive-2000', 300, 1700, '', inner, 4)).toBe(0)
    expect(noteRowsOf('demo-room', 'archive-2000', 300, 0, '', inner, 14)).toBe(0)
  }
  expect(noteRowsOf('demo-room', 'archive-2000', 300, 1700, '', 20, 5)).toBe(1)
  expect(noteRowsOf('demo-room', 'archive-2000', 300, 1700, '', 20, 4)).toBe(0)
})

// ---- TF-P6 the list verb ----------------------------------------------------------------------

test('TF-P6 list in any case and with spaces around it is the list command, list with other words stays unknown', () => {
  expect(parseTreeArgs('list')).toEqual({ kind: 'list' })
  expect(parseTreeArgs('LIST')).toEqual({ kind: 'list' })
  expect(parseTreeArgs('  list  ')).toEqual({ kind: 'list' })
  expect(parseTreeArgs('list now')).toEqual({ kind: 'unknown', text: 'list now' })
  expect(parseTreeArgs('')).toEqual({ kind: 'list' })
  expect(parseTreeArgs('find legal')).toEqual({ kind: 'find', text: 'legal' })
  expect(parseTreeArgs('open big')).toEqual({ kind: 'open', text: 'big' })
})

// ---- TF-P7 the lines of a pane too short ------------------------------------------------------

test('TF-P7 for 1 to 8 rows the lines and the Close flag are those of the contract and never use more rows than given', () => {
  const FOUR = [
    '/m:os needs 9 rows to browse the room',
    'Make the terminal taller, or dock the panel.',
    'Docking needs a terminal 110 columns wide.',
    'Or type /mos-tree in the prompt box.',
  ]
  const bad: string[] = []
  for (let rows = 1; rows <= 8; rows++) {
    const out = tooSmallLines(9, rows)
    const wantLines = rows >= 5 ? 4 : rows >= 4 ? 3 : rows >= 3 ? 2 : 1
    if (out.lines.join('|') !== FOUR.slice(0, wantLines).join('|')) bad.push(`${rows} rows lines ${out.lines.length}`)
    if (out.close !== rows >= 2) bad.push(`${rows} rows close ${String(out.close)}`)
    if (out.lines.length + (out.close ? 1 : 0) > rows) bad.push(`${rows} rows used too many`)
  }
  expect(bad).toEqual([])
})

test('TF-P7 the lines name the rows needed, the taller terminal and docking, the 110 columns and /mos-tree, and promise no key', () => {
  const out = tooSmallLines(12, 8)
  expect(out.lines[0]).toBe('/m:os needs 12 rows to browse the room')
  expect(out.lines[1]).toMatch(/taller/)
  expect(out.lines[1]).toMatch(/dock/)
  expect(out.lines[2]).toMatch(/110 columns/)
  expect(out.lines[3]).toMatch(/\/mos-tree/)
  expect(/\b(press|ctrl|hotkey)\b/i.test(out.lines.join(' '))).toBe(false)
})
