import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { BLUE, INK, LABEL, MOVE_BG, MOVE_FG, MOVE_NAME, MUTED, PAPER, RED, WHITE, YELLOW } from '../hooks/face'
import { loadFaceAsset, rasterFace } from '../hooks/theo-face'
import { CANON_STATES } from './canon'
import { ASSET_TEXT } from './face-fixture'
import { recordCalls, turnHooks } from './support'

// Phase 380 plan 07 (D-01, D-02, N2, N9, T-380-27, T-380-28): colors, state names and geometry.
//
// The canon is the mos-brand book e947a5d (read only, /home/jsagi/mos-brand). Every rule below
// cites its segment:
//   foundations/color            tokens, the contrast table, "yellow text on paper fails", "a blue
//                                route is attention, not proof", "do not add a green state"
//   identity/theo/states         the 11 state names ("use exact state names") and what each state
//                                must not imply
//   identity/theo (entries/2026-10-19/asset-fa8504998f.json and renderer asset-d96217b320.js)
//                                the geometry of each pose on a 400 unit master
// The terminal segment (experience/terminal) is PROPOSED in the book; nothing here claims
// compliance with it as a ruling.
//
// Plan 380-13 (D-10, D-11) edited this file where the old poses went away: the poses and the rasterizer
// are now the canon asset drawn by hooks/theo-face.ts (read here from the generated fixture text), the
// tone HOLLOW is gone, the labels follow the asset, and the style cycle has three styles. Each edit is
// marked "plan 13" below and listed in the SUMMARY of plan 380-13.
//
// The engine tests read no file, so the static scans (color literals in the sources, the yellow
// scan of the JSX, the table of this folder against the book) live in tests/test-380-decisions.cjs.
// Only canary data. Hyphens only.

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as never

// ---- WCAG 2.x relative luminance, plain math -------------------------------------------------

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]
const lin = (v: number): number => {
  const c = v / 255

  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex)

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a: string, b: string): number => {
  const x = lum(a)
  const y = lum(b)

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0')
// "over" at a given opacity: the color of a layer on a ground.
const over = (layer: string, ground: string, alpha: number): string => {
  const l = rgb(layer)
  const g = rgb(ground)

  return `#${[0, 1, 2].map(i => hex2((g[i] as number) + ((l[i] as number) - (g[i] as number)) * alpha)).join('')}`
}

// The book's contrast table (segment foundations/color, entries/2026-10-19/content.html).
const BOOK: [string, string, string, number][] = [
  ['ink on paper', INK, PAPER, 17.31],
  ['soft on paper', MUTED, PAPER, 8.25],
  ['paper on cobalt', PAPER, BLUE, 7.63],
  ['paper on red', PAPER, RED, 4.6],
  ['ink on yellow', INK, YELLOW, 11.23],
  ['ink on white', INK, WHITE, 18.88],
]

// Plan 13: the poses are the asset's. The asset text comes from the generated fixture, and the 11 canon
// ids are the ids of the asset.
const asset = () => {
  const loaded = loadFaceAsset(ASSET_TEXT)
  if (loaded === null) throw new Error('the canon asset text did not load')

  return loaded
}
const POSES = Object.fromEntries(asset().states.map(one => [one.id, one.pose])) as Record<string, ReturnType<typeof asset>['states'][number]['pose']>
const IDS = Object.keys(POSES)

test('K1 tokens: the seven canon tokens and nothing else (plan 13: the extra tone HOLLOW is gone)', () => {
  expect(PAPER).toBe('#F7F5EE')
  expect(INK).toBe('#111111')
  expect(MUTED).toBe('#4B4943')
  expect(BLUE).toBe('#1F3FBF')
  expect(RED).toBe('#D6281F')
  expect(YELLOW).toBe('#F2C200')
  expect(WHITE).toBe('#FFFFFF')
  // Plan 13: the one extra tone of plan 7 (HOLLOW, #8F8B80) was removed with the old poses (README,
  // section HOLLOW). The face module exports no color but the seven canon tokens.
  const tokens = new Set([PAPER, INK, MUTED, BLUE, RED, YELLOW, WHITE])
  for (const [name, pose] of Object.entries(POSES)) {
    for (const color of [pose.plane, pose.c1, pose.c2]) {
      expect(`${name} ${tokens.has(color)}`).toBe(`${name} true`)
    }
  }
})

test('K2 contrast: every pair the book lists is computed, matches the book to 0.05 and is at least 4.5', () => {
  for (const [name, fg, bg, expected] of BOOK) {
    const got = ratio(fg, bg)
    expect(`${name} ${got >= 4.5}`).toBe(`${name} true`)
    expect(`${name} ${Math.abs(got - expected) <= 0.05}`).toBe(`${name} true`)
  }
  // The book's one warning: yellow on paper is 1.54 and never text.
  expect(Math.abs(ratio(YELLOW, PAPER) - 1.54) <= 0.05).toBe(true)
  expect(ratio(YELLOW, PAPER) < 4.5).toBe(true)
})

test('K2 contrast: every move chip pair (MOVE_FG over MOVE_BG) is at least 4.5', () => {
  for (const move of Object.keys(MOVE_BG) as (keyof typeof MOVE_BG)[]) {
    const got = ratio(MOVE_FG[move], MOVE_BG[move])
    expect(`${move} ${got >= 4.5}`).toBe(`${move} true`)
  }
})

test('K2 contrast: dimmed paper (N6), the weakest secondary text, is at least 4.5 over ink at 50 percent', () => {
  // The book has no token for secondary text on ink (experience/terminal, proposed). The panel uses
  // dimmed paper. A terminal dims a color by a host rule, so the 50 percent mix is a measured
  // stand-in, not a measurement of the host (UNVERIFIED on a real screen: plan 380-10).
  const dim = over(PAPER, INK, 0.5)
  expect(ratio(dim, INK) >= 4.5).toBe(true)
  // Soft ink on ink would fail: this is why the panel never uses soft ink as text on ink.
  expect(ratio(MUTED, INK) < 3).toBe(true)
})

test('K2 contrast: known low pairs in the panel are measured and named (the focus marker), not hidden', () => {
  // register.tsx draws the heading marker in MUTED (not focused) or BLUE (focused) on ink. Both are
  // below the 3 to 1 floor for meaningful non-text UI (experience/accessibility). The heading words
  // stay in paper, so no meaning is lost, but the focus change is carried by color alone. Recorded
  // for plan 380-10 and plan 380-11. The numbers are pinned so a change is noticed.
  expect(ratio(MUTED, INK).toFixed(2)).toBe('2.10')
  expect(ratio(BLUE, INK).toFixed(2)).toBe('2.27')
})

test('K3 yellow: no move chip draws yellow as text color', () => {
  for (const color of Object.values(MOVE_FG)) expect(color).not.toBe(YELLOW)
  // Yellow is a plane or a chip ground (ink text on it), never a text color on paper.
  expect(MOVE_BG.yellow).toBe(YELLOW)
  expect(MOVE_FG.yellow).toBe(INK)
})

// ---- the drawing -----------------------------------------------------------------------------

const at = (columns: number, rows = 40) =>
  ({
    plugin: 'mos',
    component: 'Pane',
    requestId: 'mos-state',
    props: { title: '/m:os', isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: rows }, view: {} },
    surface: 'terminal',
  }) as never

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>
const textsOf = async (ui: Mounted): Promise<string[]> => {
  const texts = (await ui.findAll({ type: 'Text' })).map(one => one.text)
  const labels = (await ui.findAll({ type: 'Button' })).map(one => one.text)

  return [...texts, ...labels].filter(text => text.trim() !== '')
}

// Words that would turn attention into proof (segment foundations/color: a blue route is attention,
// not proof; segment identity/theo/states: Found must not imply correctness, verification or approval).
const PROOF = /\b(proof|proves?|proven|verified|validated|correct)\b/i

async function drawnIn(state: 'search' | 'found', $: Parameters<TestBody>[0], on: Parameters<TestBody>[1]): Promise<string[]> {
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const { clock } = recordCalls(on, {
    tool: e => (e.tool === 'mcp__theo__hold' ? gate.then(() => ({ result: {}, text: 'ok' })) : undefined),
  })
  turnHooks(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ turnId: 'k4', prompt: 'x' } as never)
  let pending: Promise<unknown> | null = null
  if (state === 'search') {
    pending = $.tool.call({ tool: 'mcp__theo__hold' } as never)
    await clock.settle()
  } else {
    await $.tool.call({ tool: 'mcp__theo__ok' } as never)
  }

  const seen: string[] = []
  for (const width of [100, 48, 40, 30]) {
    for (let styleNo = 0; styleNo < 3; styleNo++) {
      const pane = await $.ui.mount(at(width))
      seen.push(...(await textsOf(pane)))
      await pane.unmount()
      await $.command.run({ command: 'mos-style', args: '' } as never)
    }
  }
  release()
  if (pending) await pending

  return seen
}

test('K4 blue is not proof: the search state draws no proof word, in every width and style', async ($, on) => {
  const seen = await drawnIn('search', $, on)
  expect(seen.length).toBeGreaterThan(8)
  expect(seen.filter(text => PROOF.test(text))).toEqual([])
})

test('K4 blue is not proof: the found state draws no proof word, in every width and style', async ($, on) => {
  const seen = await drawnIn('found', $, on)
  expect(seen.length).toBeGreaterThan(8)
  expect(seen.filter(text => PROOF.test(text))).toEqual([])
})

test('K4 blue is not proof: the move names carry no proof word either', () => {
  for (const name of Object.values(MOVE_NAME)) expect(PROOF.test(name)).toBe(false)
  expect(MOVE_NAME.blue).toBe('building')
})

// ---- state names (N9, K5) --------------------------------------------------------------------

test('K5 exact names: the label of each drawn state is the visible label of the canon asset (plan 13, navigator ruling 2026-10-23)', () => {
  const labels: Record<string, string> = {}
  for (const one of asset().states) labels[one.id] = one.label
  expect(LABEL as Record<string, string>).toEqual(labels)
  expect(LABEL).toEqual({
    rest: 'Rest',
    listen: 'Listening',
    search: 'Searching',
    found: 'Found',
    challenge: 'Challenge',
    contradiction: 'Contradiction',
    reframe: 'Reframe',
    limit: 'Nothing found',
    decision: 'Your decision',
    boundary: 'Boundary',
    handover: 'Handover',
  })
  // The asset label in tests/canon.ts is the same text.
  for (const canon of CANON_STATES) expect(`${canon.id} ${canon.assetLabel}`).toBe(`${canon.id} ${(LABEL as Record<string, string>)[canon.id]}`)
})

test('K5 exact names: the book has 11 states, all 11 are drawn, and the two the book spells in older words are recorded', () => {
  expect(CANON_STATES.map(one => one.name)).toEqual([
    'Rest',
    'Listening',
    'Search',
    'Found',
    'Challenge',
    'Contradiction',
    'Reframe',
    'Limit',
    'Your decision',
    'Boundary',
    'Handover',
  ])
  // Plan 13: every canon state is drawn (the panel has a face for each).
  expect(IDS).toEqual(CANON_STATES.map(one => one.id))
  // Where the book states table and the asset differ in spelling: Search against Searching, Limit
  // against Nothing found. The panel follows the asset (navigator ruling); the conflict is a book follow-up.
  const differs = CANON_STATES.filter(one => one.name !== (LABEL as Record<string, string>)[one.id]).map(one => `${one.name} / ${(LABEL as Record<string, string>)[one.id]}`)
  expect(differs).toEqual(['Search / Searching', 'Limit / Nothing found'])
})

// ---- no green (K6) ---------------------------------------------------------------------------

test('K6 no green: no drawn color is green and no state is a breakthrough state', () => {
  const colors = [PAPER, INK, MUTED, BLUE, RED, YELLOW, WHITE]
  for (const pose of Object.values(POSES)) colors.push(pose.plane, pose.c1, pose.c2)
  for (const color of colors) {
    const [r, g, b] = rgb(color)
    expect(`${color} ${g > r + 40 && g > b + 40}`).toBe(`${color} false`)
  }
  for (const key of IDS) expect(/breakthrough|success|achiev/i.test(key)).toBe(false)
  for (const value of Object.values(LABEL)) expect(/breakthrough|achieved/i.test(value)).toBe(false)
})

// ---- geometry (K7, K9) -----------------------------------------------------------------------

test('K7 geometry: the pose of each state, as the asset text holds it, equals the canon table, number for number (plan 13: poses come from the asset)', () => {
  const different: string[] = []
  for (const canon of CANON_STATES) {
    const pose = POSES[canon.id]
    if (!pose) throw new Error(`no pose for ${canon.id}`)
    const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
    if (!same(pose.e1, canon.pose.e1)) different.push(`${canon.id}.e1`)
    if (!same(pose.e2, canon.pose.e2)) different.push(`${canon.id}.e2`)
    if (!same(pose.s, canon.pose.s)) different.push(`${canon.id}.s`)
    if (!same(pose.r, canon.pose.r)) different.push(`${canon.id}.r`)
    if (pose.plane.toLowerCase() !== canon.pose.plane.toLowerCase()) different.push(`${canon.id}.plane`)
    if (pose.c1.toLowerCase() !== canon.pose.c1.toLowerCase()) different.push(`${canon.id}.c1`)
    if (pose.c2.toLowerCase() !== canon.pose.c2.toLowerCase()) different.push(`${canon.id}.c2`)
    if (pose.hollow !== canon.pose.hollow) different.push(`${canon.id}.hollow`)
  }
  expect(different).toEqual([])
})

test('K7 colors by state: planes follow the canon (blue search and found, red challenge and boundary, yellow contradiction and reframe, ink only for your decision, white the rest)', () => {
  const plane = (id: string): string => POSES[id]?.plane ?? ''
  expect(plane('rest')).toBe(WHITE)
  expect(plane('listen')).toBe(WHITE)
  expect(plane('search')).toBe(BLUE)
  expect(plane('found')).toBe(BLUE)
  expect(plane('challenge')).toBe(RED)
  expect(plane('contradiction')).toBe(YELLOW)
  expect(plane('reframe')).toBe(YELLOW)
  expect(plane('limit')).toBe(WHITE)
  expect(plane('decision')).toBe(INK)
  expect(plane('boundary')).toBe(RED)
  expect(plane('handover')).toBe(WHITE)
  // Ink as a plane means "your decision" in the book, and only that state draws it.
  expect(IDS.filter(id => plane(id) === INK)).toEqual(['decision'])
})

test('K9 raster: the plane, the divider and the ground line sit where the canon pose puts them (plan 13: drawn by rasterFace)', () => {
  const n = 16
  const px = 400 / n
  const cell = (u: number): number => Math.min(n - 1, Math.floor(u / px))
  // Plan 13: rasterFace samples the center of a cell with a half open interval (plan 380-12), so a line
  // centered exactly on the edge between two cells (y = 225 at 16 cells) belongs to the cell above it.
  const lineRow = (u: number): number => Math.min(n - 1, Math.ceil(u / px) - 1)
  for (const canon of CANON_STATES) {
    const [rx, ry] = canon.pose.r
    const grid = rasterFace(asset(), canon.id, n)
    if (grid === null) throw new Error(`no face for ${canon.id}`)
    // A point inside the plane, away from the eyes and the bar: row 1, column 14.
    expect(`${canon.id} plane ${grid[1]?.[14]}`).toBe(`${canon.id} plane ${canon.pose.plane}`)
    // The divider: the column that holds x = rx is ink in a row below the plane.
    expect(`${canon.id} divider ${grid[cell(ry) + 2]?.[cell(rx)]}`).toBe(`${canon.id} divider ${INK}`)
    // The ground line: the row that holds y = ry is ink, right of the divider (column 14 is at x = 362.5, inside 386).
    expect(`${canon.id} line ${grid[lineRow(ry)]?.[14]}`).toBe(`${canon.id} line ${INK}`)
  }
})
