// Plan 03: the theme and plain mode. The test `$` of `claude plugin test` is the ENGINE's own and
// has no store, env, fs or plugin noun (a plugin's `$` does), and the engine's static scan follows
// `$` only inside the declaring file; so the logic is tested through its pure parts (parseTheme,
// decideMode, blockStyle, the pair law) with plain arguments, and the `$` wiring of resolveMode and
// loadTheme is covered by `claude plugin validate` (it lists the names read) plus the scratch probe
// recorded in the plan summary. The fixture palette carries hex on purpose (the no-hex rule covers
// src/ only).
import { expect, test } from 'claude-code/testing'

import { decideMode, paintProps, plainBox } from '../src/theme/plain'
import type { Mode, ModeInputs } from '../src/theme/plain'
import { ALLOWED_PAIRS, PALETTE_KEY, assertAllowedPair, assertEdgeAllowed, blockStyle, edgeAllowed, larryMark, parseTheme } from '../src/theme/theme'
import type { BlockJob, JobName, Theme } from '../src/theme/theme'

const FIXTURE = {
  version: 1,
  base: {
    mondrian_red: '#A63D2F',
    mondrian_blue: '#1E3A6E',
    mondrian_yellow: '#C8A43C',
    mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8',
    cream: '#F5F0E8',
    gray_meta: '#A09A90',
    success_green: '#2D6B4A',
  },
}
const GOOD = JSON.stringify(FIXTURE)

const THEME: Theme = {
  evidence: '#1E3A6E',
  contradiction: '#C8A43C',
  assumption: '#A63D2F',
  structure: '#0D0D0D',
  paper: '#F5F0E8',
  logoGreen: '#2D6B4A',
}

const inputs = (over: Partial<ModeInputs> = {}): ModeInputs => ({
  switchOn: undefined,
  paletteText: GOOD,
  noColor: undefined,
  term: undefined,
  ...over,
})

// Every key of every object reachable from the value (the walk the plan asks for).
function keysDeep(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out))
  else if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) {
      out.push(k)
      keysDeep(x, out)
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// parseTheme
// ---------------------------------------------------------------------------------------------

test('parseTheme reads the six jobs from the palette base keys', async () => {
  expect(parseTheme(GOOD)).toEqual(THEME)
})

test('the job to palette key names are the six strings, and none is the grey meta key', async () => {
  expect(PALETTE_KEY).toEqual({
    evidence: 'mondrian_blue',
    contradiction: 'mondrian_yellow',
    assumption: 'mondrian_red',
    structure: 'mondrian_black',
    paper: 'cream',
    logoGreen: 'success_green',
  })
  expect(Object.values(PALETTE_KEY).includes('gray_meta')).toBe(false)
})

const MALFORMED: [string, string][] = [
  ['a value that is not a seven-character hex', JSON.stringify({ base: { ...FIXTURE.base, mondrian_blue: 'blue' } })],
  ['a hex with the wrong length', JSON.stringify({ base: { ...FIXTURE.base, mondrian_blue: '#1E3A6' } })],
  ['a value that is not a string', JSON.stringify({ base: { ...FIXTURE.base, mondrian_red: 5 } })],
  ['a missing key', JSON.stringify({ base: { mondrian_red: '#A63D2F' } })],
  ['no base', JSON.stringify({ version: 1 })],
  ['text that is not JSON', '{ not json'],
  ['an array', '[]'],
  ['null', 'null'],
  ['an empty string', ''],
]
for (const [label, body] of MALFORMED) {
  test(`parseTheme returns null for a palette with ${label}, and decideMode says N03`, async () => {
    expect(parseTheme(body)).toBe(null)
    expect(decideMode(inputs({ paletteText: body }))).toEqual({ plain: true, note: 'N03', theme: null })
  })
}

// ---------------------------------------------------------------------------------------------
// decideMode: the five triggers of UI-SPEC 12.1
// ---------------------------------------------------------------------------------------------

test('color mode when the palette loads and nothing asks for plain', async () => {
  expect(decideMode(inputs())).toEqual({ plain: false, note: null, theme: THEME })
})

test('the person switch gives plain with N01', async () => {
  expect(decideMode(inputs({ switchOn: true }))).toEqual({ plain: true, note: 'N01', theme: null })
})

test('a switch that is anything but true does not turn plain on', async () => {
  for (const switchOn of [false, undefined, null, 'true', 1]) {
    expect(decideMode(inputs({ switchOn })).plain).toBe(false)
  }
})

test('an unreadable palette (null text) gives plain with N03 and no theme, not N01', async () => {
  expect(decideMode(inputs({ paletteText: null }))).toEqual({ plain: true, note: 'N03', theme: null })
})

test('a non-empty NO_COLOR gives plain with N01', async () => {
  expect(decideMode(inputs({ noColor: '1' }))).toEqual({ plain: true, note: 'N01', theme: null })
  expect(decideMode(inputs({ noColor: 'anything' })).note).toBe('N01')
})

test('TERM equal to dumb gives plain with N01', async () => {
  expect(decideMode(inputs({ term: 'dumb' }))).toEqual({ plain: true, note: 'N01', theme: null })
})

test('an empty NO_COLOR and an ordinary TERM do not trigger plain', async () => {
  const mode = decideMode(inputs({ noColor: '', term: 'xterm-256color' }))
  expect(mode.plain).toBe(false)
  expect(mode.note).toBe(null)
})

test('the trigger order: the switch first, then the palette, then the environment', async () => {
  // Switch beats a bad palette: the person asked, so N01.
  expect(decideMode(inputs({ switchOn: true, paletteText: null })).note).toBe('N01')
  // A bad palette beats the environment: N03.
  expect(decideMode(inputs({ paletteText: null, noColor: '1' })).note).toBe('N03')
})

// ---------------------------------------------------------------------------------------------
// plain mode never emits a color prop
// ---------------------------------------------------------------------------------------------

test('in plain mode no object this module returns has a color or backgroundColor key', async () => {
  const jobs: BlockJob[] = ['evidence', 'contradiction', 'assumption', 'structure', 'paper']
  const modes: Mode[] = [
    decideMode(inputs({ switchOn: true })),
    decideMode(inputs({ paletteText: null })),
    decideMode(inputs({ noColor: '1' })),
    decideMode(inputs({ term: 'dumb' })),
  ]
  const seen: unknown[] = [plainBox()]
  for (const mode of modes) {
    expect(mode.plain).toBe(true)
    seen.push(mode)
    // Even with a theme at hand, plain mode paints nothing.
    for (const job of jobs) seen.push(paintProps(mode, THEME, job), paintProps(mode, null, job))
  }
  const keys = keysDeep(seen)
  expect(keys.includes('color')).toBe(false)
  expect(keys.includes('backgroundColor')).toBe(false)
  expect(plainBox()).toEqual({ borderStyle: 'single' })
})

test('in color mode paintProps is the block style, and with no theme it is empty', async () => {
  const mode = decideMode(inputs())
  expect(paintProps(mode, mode.theme, 'evidence')).toEqual({ backgroundColor: '#1E3A6E', color: '#F5F0E8' })
  expect(paintProps(mode, mode.theme, 'contradiction')).toEqual({ backgroundColor: '#C8A43C', color: '#0D0D0D' })
  expect(paintProps(mode, null, 'evidence')).toEqual({})
})

// ---------------------------------------------------------------------------------------------
// the block styles and the pair law
// ---------------------------------------------------------------------------------------------

test('blockStyle gives the legal text color for each block', async () => {
  expect(blockStyle(THEME, 'evidence')).toEqual({ backgroundColor: THEME.evidence, color: THEME.paper })
  expect(blockStyle(THEME, 'contradiction')).toEqual({ backgroundColor: THEME.contradiction, color: THEME.structure })
  expect(blockStyle(THEME, 'assumption')).toEqual({ backgroundColor: THEME.assumption, color: THEME.paper })
  expect(blockStyle(THEME, 'structure')).toEqual({ backgroundColor: THEME.structure, color: THEME.paper })
  expect(blockStyle(THEME, 'paper')).toEqual({ backgroundColor: THEME.paper, color: THEME.structure })
})

test('the pair law: exactly five allowed pairs, every forbidden pair throws', async () => {
  expect(ALLOWED_PAIRS.length).toBe(5)
  for (const p of ALLOWED_PAIRS) assertAllowedPair(p.text, p.bg)
  const forbidden: [JobName, JobName][] = [
    ['paper', 'contradiction'],
    ['contradiction', 'paper'],
    ['structure', 'evidence'],
    ['evidence', 'structure'],
    ['assumption', 'structure'],
    ['contradiction', 'assumption'],
    ['logoGreen', 'structure'],
    ['paper', 'logoGreen'],
  ]
  for (const [t, b] of forbidden) {
    let threw = false
    try {
      assertAllowedPair(t, b)
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  }
})

test('the five Larry marks: a square only when its role is true (C-30): Challenging red, Building and Another view none', async () => {
  expect(larryMark(THEME, 'L01')).toEqual({ id: 'L01', job: null, backgroundColor: null })
  expect(larryMark(THEME, 'L02')).toEqual({ id: 'L02', job: 'assumption', backgroundColor: THEME.assumption })
  expect(larryMark(THEME, 'L03')).toEqual({ id: 'L03', job: null, backgroundColor: null })
  expect(larryMark(THEME, 'L04').job).toBe('structure')
  expect(larryMark(THEME, 'L05').job).toBe('paper')
})

test('the adjacency law: paper touches evidence, assumption and structure; structure touches assumption; blue never touches red or black', async () => {
  const touching: [BlockJob, BlockJob][] = [
    ['paper', 'evidence'],
    ['paper', 'assumption'],
    ['paper', 'structure'],
    ['structure', 'assumption'],
    ['structure', 'contradiction'],
    ['evidence', 'contradiction'],
    ['evidence', 'evidence'],
  ]
  for (const [a, b] of touching) {
    assertEdgeAllowed(a, b)
    assertEdgeAllowed(b, a)
  }
  const never: [BlockJob, BlockJob][] = [
    ['evidence', 'assumption'],
    ['evidence', 'structure'],
    ['assumption', 'contradiction'],
    ['contradiction', 'paper'],
  ]
  for (const [a, b] of never) {
    expect(edgeAllowed(a, b)).toBe(false)
    expect(edgeAllowed(b, a)).toBe(false)
    expect(() => assertEdgeAllowed(a, b)).toThrow()
  }
})
