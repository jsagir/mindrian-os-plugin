// Plan 08 task 1: alert priority, the one-row band (tiers T1 and T0) and the not-bound forms
// (UI-SPEC 10.1, 10.3, 10.5; C-17, C-23; OQ-10). The pure parts are drawn with a stand-in element
// table (the engine's own test `$` cannot call `$.ui.resolve`, see tests/band.test.tsx); the
// mounted, per-surface arms are added in task 3 of this plan.
import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { chooseAlerts } from '../src/band/alerts'
import type { El } from '../src/band/blocks'
import { renderOneRow } from '../src/band/one-row'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import type { ViewModel } from '../src/model/view-model'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }

function flatten(children: unknown): unknown[] {
  if (children === undefined || children === null || children === false) return []
  if (Array.isArray(children)) return children.flatMap(flatten)
  return [children]
}

function make(type: string) {
  return (props: Record<string, unknown>): RenderElement => {
    const { children, ...rest } = props
    const out: Node = { type, props: rest, children: flatten(children) }
    return out as unknown as RenderElement
  }
}

const EL = { Box: make('Box'), Text: make('Text'), Button: make('Button') } as unknown as El

const THEME: Theme = {
  where: '#1E3A6E',
  yourMove: '#C8A43C',
  problem: '#A63D2F',
  frame: '#0D0D0D',
  reading: '#F5F0E8',
  logoGreen: '#2D6B4A',
}
const COLOR: Mode = { plain: false, note: null, theme: THEME }
const PLAIN: Mode = { plain: true, note: 'N01', theme: null }

function asNode(x: unknown): Node {
  const n = x as Partial<Node>
  return { type: n.type ?? '', props: n.props ?? {}, children: Array.isArray(n.children) ? n.children : [] }
}

function kids(x: unknown): Node[] {
  return asNode(x).children.filter((c): c is Node => typeof c === 'object' && c !== null)
}

function walk(x: unknown, fn: (n: Node) => void): void {
  if (typeof x !== 'object' || x === null) return
  const n = asNode(x)
  fn(n)
  for (const c of n.children) walk(c, fn)
}

function shown(x: unknown): string {
  if (typeof x === 'string') return x
  if (typeof x !== 'object' || x === null) return ''
  const n = asNode(x)
  // A Button draws its label (the hotkey form is the engine's), so its words count as shown text.
  if (n.type === 'Button') return String(n.props.label ?? '')
  return n.children.map(shown).join('')
}

function num(x: unknown): number {
  return typeof x === 'number' ? x : 0
}

const NO_PRESS = { onHelp: () => {} }

function row(vm: ViewModel, columns: number, mode: Mode = COLOR, tier: 'T1' | 'T0' = 'T1', rows = 12): Node {
  const props = { bodyColumns: columns, maxRows: rows, hasSurvey: false, isWorking: false }
  const drawn = renderOneRow(EL, vm, mode.theme, mode, props, tier, NO_PRESS)
  expect(drawn).not.toBeNull()
  return asNode(drawn)
}

// The blocks of a row: every direct child that is a padded Box (the logo and the frame cells are
// not blocks), in order.
function blocks(r: Node): Node[] {
  return kids(r).filter((c) => c.type === 'Box' && c.props.paddingX === 1)
}

function withModel(change: (m: ViewModel) => void, base: ViewModel = SAMPLES.wide): ViewModel {
  const m: ViewModel = JSON.parse(JSON.stringify(base)) as ViewModel
  change(m)
  return m
}

// ---------------------------------------------------------------------------------------------
// chooseAlerts: context at 80 or more, then a room problem, then a waiting decision (OQ-10).

test('alerts: one slot takes the context limit before a waiting decision', () => {
  const vm = withModel((m) => {
    m.context = ok(85)
    m.waiting = ok(1)
  })
  expect(chooseAlerts(vm, 1)).toEqual([{ kind: 'context', percent: 85 }])
})

test('alerts: two slots hold the context limit and the waiting decision, in that order', () => {
  const vm = withModel((m) => {
    m.context = ok(85)
    m.waiting = ok(1)
  })
  expect(chooseAlerts(vm, 2)).toEqual([
    { kind: 'context', percent: 85 },
    { kind: 'waiting', n: 1 },
  ])
})

test('alerts: a room problem beats a waiting decision for the one slot, in either health word', () => {
  const drift = withModel((m) => {
    m.context = ok(40)
    m.health = ok('drift')
    m.waiting = ok(1)
  })
  expect(chooseAlerts(drift, 1)).toEqual([{ kind: 'health', status: 'drift' }])
  const broken = withModel((m) => {
    m.context = ok(79)
    m.health = ok('broken')
    m.waiting = ok(2)
  })
  expect(chooseAlerts(broken, 2)).toEqual([
    { kind: 'health', status: 'broken' },
    { kind: 'waiting', n: 2 },
  ])
})

test('alerts: a waiting decision alone is the alert; a sound room under the limit with nothing waiting has none', () => {
  expect(chooseAlerts(SAMPLES.wide, 2)).toEqual([{ kind: 'waiting', n: 1 }])
  expect(chooseAlerts(SAMPLES.empty, 2)).toEqual([])
  expect(chooseAlerts(SAMPLES.wide, 0)).toEqual([])
})

test('alerts: a fact that cannot be read is never an alert (no false alarm)', () => {
  expect(chooseAlerts(SAMPLES.unreadable, 2)).toEqual([])
  const sound = withModel((m) => {
    m.health = ok('sound')
    m.waiting = ok(0)
    m.context = ok(50)
  })
  expect(chooseAlerts(sound, 2)).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// T1: compact logo, the folder name alone in the blue block, alert blocks with words, Help.

test('T1 at 55 columns: compact logo, the name alone in blue, 1 decision waiting in yellow, then Help', () => {
  const r = row(SAMPLES.wide, 55)
  expect(num(r.props.width)).toBe(55)
  const [logo] = kids(r)
  expect(num(logo?.props.width)).toBe(9)
  expect(num(logo?.props.height)).toBe(1)
  const [place, alert, help] = blocks(r)
  expect(shown(place)).toBe('Funding (sample)')
  expect(place?.props.backgroundColor).toBe(THEME.where)
  expect(shown(alert)).toBe('1 decision waiting')
  expect(alert?.props.backgroundColor).toBe(THEME.yourMove)
  const button = kids(help).find((c) => c.type === 'Button')
  expect(button?.props.label).toBe('Get help')
  expect(button?.props.hotkey).toBe('h')
  expect(button?.props.plain).toBe(true)
  expect(help?.props.backgroundColor).toBe(THEME.reading)
  const all = shown(r)
  for (const absent of ['This folder is for', 'Next:', 'Context used', '%', 'version', 'Mindrian suggests']) {
    expect(all).not.toContain(absent)
  }
})

test('T1: the waiting words shorten below 48 columns and carry the real count', () => {
  expect(shown(blocks(row(SAMPLES.wide, 47))[1])).toBe('1 waiting')
  expect(shown(blocks(row(SAMPLES.several, 47))[1])).toBe('3 waiting')
  expect(shown(blocks(row(SAMPLES.several, 55))[1])).toBe('3 decisions waiting')
  expect(shown(blocks(row(SAMPLES.wide, 48))[1])).toBe('1 decision waiting')
})

test('T1: one alert slot below 68 columns, two from 68; the problem comes first and has its words', () => {
  const both = withModel((m) => {
    m.context = ok(85)
  })
  const narrow = blocks(row(both, 67))
  expect(narrow.map(shown)).toEqual(['Funding (sample)', 'Context used: 85%', 'Get help'])
  const wide = blocks(row(both, 68))
  expect(wide.map(shown)).toEqual(['Funding (sample)', 'Context used: 85%', '1 decision waiting', 'Get help'])
})

test('T1: the context alert is a bold yellow block with the words of B50', () => {
  const r = row(SAMPLES.limit, 55)
  const alert = blocks(r)[1]
  expect(alert?.props.backgroundColor).toBe(THEME.yourMove)
  let bold = false
  walk(alert, (n) => {
    if (n.type === 'Text' && n.props.bold === true && shown(n) === 'Context used: 85%') bold = true
  })
  expect(bold).toBe(true)
})

test('T1: drift is a yellow block, broken a red block with cream words, an unreadable room no alarm', () => {
  const drift = blocks(row(SAMPLES.drift, 55))[1]
  expect(shown(drift)).toBe('Room needs a checkup')
  expect(drift?.props.backgroundColor).toBe(THEME.yourMove)

  const broken = blocks(row(SAMPLES.broken, 55))[1]
  expect(shown(broken)).toBe('Room is broken')
  expect(broken?.props.backgroundColor).toBe(THEME.problem)
  let words: Node | undefined
  walk(broken, (n) => {
    if (n.type === 'Text' && shown(n) === 'Room is broken') words = n
  })
  expect(words?.props.color).toBe(THEME.reading)

  const r = row(SAMPLES.unreadable, 55)
  const colors = blocks(r).map((b) => b.props.backgroundColor)
  expect(colors).not.toContain(THEME.yourMove)
  expect(colors).not.toContain(THEME.problem)
  expect(shown(r)).not.toContain('waiting')
})

test('T1: with nothing waiting a dim B66 sits in the alert slot from 48 columns and nothing below', () => {
  const wide = blocks(row(SAMPLES.empty, 55))
  expect(wide.map(shown)).toEqual(['Funding (sample)', 'Nothing waiting', 'Get help'])
  let dim = false
  walk(wide[1], (n) => {
    if (n.type === 'Text' && n.props.dimColor === true && shown(n) === 'Nothing waiting') dim = true
  })
  expect(dim).toBe(true)
  expect(wide[1]?.props.backgroundColor).not.toBe(THEME.yourMove)
  const narrow = blocks(row(SAMPLES.empty, 47))
  expect(narrow.map(shown)).toEqual(['Funding (sample)', 'Get help'])
})

test('T1: no block is ever empty, in any sample, at any width, color or plain', () => {
  for (const vm of Object.values(SAMPLES)) {
    for (const columns of [30, 47, 48, 55, 67, 68, 71, 100]) {
      for (const mode of [COLOR, PLAIN]) {
        const r = row(vm, columns, mode)
        const [logo, ...rest] = kids(r)
        void logo
        walk({ type: 'Box', props: {}, children: rest }, (n) => {
          if (n.type !== 'Box') return
          const isFrameCell = num(n.props.width) === 1
          const colored = n.props.backgroundColor !== undefined
          if (colored && !isFrameCell) expect(shown(n).length).toBeGreaterThan(0)
        })
        // A padded block always has a Text or a Button inside it.
        for (const b of blocks(r)) expect(shown(b).trim().length).toBeGreaterThan(0)
      }
    }
  }
})

test('T1 plain mode: no color prop, the full place line, a bold bang on a warning, bars between blocks', () => {
  const r = row(SAMPLES.wide, 55, PLAIN)
  const keys: string[] = []
  walk(r, (n) => keys.push(...Object.keys(n.props)))
  expect(keys).not.toContain('color')
  expect(keys).not.toContain('backgroundColor')
  expect(/#[0-9A-Fa-f]{6}/.test(JSON.stringify(r))).toBe(false)
  const line = shown(r)
  expect(line).toContain("You're in: Funding (sample)")
  expect(line).toContain('! 1 decision waiting')
  expect(line).toContain(' | ')
  expect(line.startsWith('M:OS')).toBe(true)
  let bold = false
  walk(r, (n) => {
    if (n.type === 'Text' && n.props.bold === true && shown(n) === '! 1 decision waiting') bold = true
  })
  expect(bold).toBe(true)
})

// ---------------------------------------------------------------------------------------------
// T0: the words alone and Help.

test('T0 at 25 columns: M:OS and the Help button only, whatever the room says', () => {
  for (const vm of [SAMPLES.wide, SAMPLES.limit, SAMPLES.broken, SAMPLES.noroom]) {
    const r = row(vm, 25, COLOR, 'T0')
    const line = shown(r)
    expect(line).toBe('M:OS' + 'Get help')
    expect(kids(r).filter((c) => c.type === 'Box' && num(c.props.width) === 9)).toHaveLength(0)
    expect(blocks(r).some((b) => kids(b).some((c) => c.type === 'Button'))).toBe(true)
  }
})

// ---------------------------------------------------------------------------------------------
// A room that is not bound: one row at every width, the place words and Help, nothing else.

function noRoom(): ViewModel {
  return SAMPLES.noroom
}

test('not bound at 100 columns: compact logo, B12 in the blue block, Help; no purpose, no next, no alert', () => {
  const r = row(noRoom(), 100)
  const [logo] = kids(r)
  expect(num(logo?.props.width)).toBe(9)
  expect(num(logo?.props.height)).toBe(1)
  const bs = blocks(r)
  expect(bs.map(shown)).toEqual(["You're not in a data room yet", 'Get help'])
  expect(bs[0]?.props.backgroundColor).toBe(THEME.where)
  const all = shown(r)
  for (const absent of ['This folder is for', 'Next:', 'Context used', 'waiting', 'purpose']) {
    expect(all).not.toContain(absent)
  }
})

test('not bound at 55 columns and with 4 rows: the same one row', () => {
  for (const [columns, rows] of [
    [55, 12],
    [60, 4],
  ] as const) {
    const r = row(noRoom(), columns, COLOR, 'T1', rows)
    expect(blocks(r).map(shown)).toEqual(["You're not in a data room yet", 'Get help'])
  }
})

test('not bound with a remembered room: B13, still no purpose and no next', () => {
  const vm = withModel((m) => {
    m.place = { isBound: false, registryFallback: true, room: ok('funding-room'), folder: { state: 'unavailable' } }
  }, SAMPLES.noroom)
  const bs = blocks(row(vm, 100))
  expect(shown(bs[0])).toBe('Last data room used: funding-room')
  expect(bs[0]?.props.backgroundColor).toBe(THEME.where)
  expect(bs).toHaveLength(2)
})

test('a place that cannot be read: B14 in the blue block, with Help', () => {
  const vm = withModel((m) => {
    m.place = { isBound: true, registryFallback: false, room: { state: 'unavailable' }, folder: { state: 'unavailable' } }
  })
  const bs = blocks(row(vm, 55))
  expect(shown(bs[0])).toBe("Can't tell where you are right now")
  expect(bs[0]?.props.backgroundColor).toBe(THEME.where)
  expect(shown(bs.at(-1))).toBe('Get help')
})

test('not bound at T0: M:OS and Help only; and in plain mode the place line is words with a bar', () => {
  expect(shown(row(noRoom(), 25, COLOR, 'T0'))).toBe('M:OS' + 'Get help')
  const plain = row(noRoom(), 55, PLAIN)
  expect(shown(plain)).toContain("You're not in a data room yet")
  expect(shown(plain)).toContain(' | ')
  const keys: string[] = []
  walk(plain, (n) => keys.push(...Object.keys(n.props)))
  expect(keys).not.toContain('backgroundColor')
})

test('top of the room at T1: the room name alone in the blue block', () => {
  const vm = withModel((m) => {
    m.place = { isBound: true, registryFallback: false, room: ok('funding-room'), folder: ok(null) }
  })
  expect(shown(blocks(row(vm, 55))[0])).toBe('funding-room')
  expect(shown(blocks(row(vm, 55, PLAIN))[0])).toBe("You're in: funding-room")
})
