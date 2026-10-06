// Plan 14: the Review tab's decision card. Task 1 tests the card, the choice buttons, the
// consequence line and the adapter that builds plan 10's answer machine from `act` (route B: the
// review state is a slice of the one `body` key). The card is drawn by a test hook of its own on a
// pane id the plugin does not claim (engine rule 11: a press on a Button a test hook drew finds
// nothing, so each Button's onPress is captured as the view draws and called directly); Task 2 adds
// the real pane on the real id.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import type { GateCard, GateOption } from '../src/model/view-model'
import { ok } from '../src/model/view-model'
import { emptyBody, mergeBody, replaceBody } from '../src/pane/kit'
import type { BodySlice, BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { CHOICE_FORM, ChoiceButtons, choiceLabel } from '../src/pane/review/choice-buttons'
import { consequenceFor, consequenceWords, isSavable, suggestedChoice } from '../src/pane/review/consequence'
import { expiryWords, formatExpiry } from '../src/pane/review/expiry'
import { reviewBody } from '../src/pane/bodies/review'
import { listState } from '../src/pane/review/decision-list'
import { ProposalCard } from '../src/pane/review/proposal-card'
import { readReview, reviewIo, runChoice } from '../src/pane/review/review-io'
import { pressChoice } from '../src/pane/review/answer-machine'
import { savedEntry, savingEntry, refusedEntry, checkingEntry } from '../src/pane/review/state'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { MINDRIAN_SERVER, PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const SHELL_ID = 'review-card-shell-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]

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
const NONE_OPEN = { room: false, think: false, sources: false, review: false }

const PANE_PROPS = (bodyColumns: number) =>
  ({
    title: 'Mindrian workspace',
    isFocused: true,
    bodyColumns,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  }) as const

type Node = Record<string, unknown>

function walk(node: unknown, visit: (n: Node) => void): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const rec = node as Node
  visit(rec)
  walk(rec.props, visit)
  walk(rec.children, visit)
}

function propsOf(n: unknown): Node {
  const props = (n as Node | undefined)?.props
  return typeof props === 'object' && props !== null ? (props as Node) : {}
}

function shown(tree: unknown): string {
  const out: string[] = []
  const grab = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(grab)
    else if (typeof n === 'object' && n !== null) {
      const rec = n as Node
      if (typeof rec.label === 'string') out.push(rec.label)
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

function colorKeys(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n) out.push(k)
  })
  return out
}

// ---- cards ---------------------------------------------------------------------------------------

function opt(id: string, over: Partial<GateOption> = {}): GateOption {
  return { id, label: id + ' label', description: null, rank: null, preview: null, recommended: false, ...over }
}

// The wide sample's card, as the sample records it (approve, defer and reject, the first recommended).
const WIDE_CARD = (() => {
  const gates = SAMPLES.wide.gates
  if (gates.state !== 'ok' || gates.value[0] === undefined) throw new Error('the wide sample has no card')
  return gates.value[0]
})()

function card(over: Partial<GateCard> = {}): GateCard {
  return {
    gateId: 'g-1',
    kind: 'general',
    header: 'Should we go with the grant route?',
    selectMode: 'single',
    options: [
      opt('approve', { rank: 1, recommended: true, description: 'It is the closest fit.' }),
      opt('defer', { rank: 2 }),
      opt('reject', { rank: 3 }),
    ],
    approving: ['approve'],
    subjectNodeId: null,
    evidenceNodeIds: [],
    mintedAt: 1,
    expiresAt: new Date(2026, 9, 6, 9, 5).getTime(),
    resumes: false,
    ...over,
  }
}

// ---- a recording act with a real in-memory body slice ----------------------------------------------

type Mem = {
  body: BodyState
  calls: { server: string; tool: string; args: Record<string, unknown> }[]
  toasts: string[]
  focused: string[]
  refreshed: number
  answer: (tool: string, args: Record<string, unknown>) => unknown
}

function reply(data: unknown, isError = false): unknown {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], isError }
}

function memAct(mem: Mem): ShellActions {
  return {
    setTab: async () => {},
    fill: async () => true,
    toast: (message) => {
      mem.toasts.push(message)
    },
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
    io: {
      mcpCall: async (server, tool, args) => {
        mem.calls.push({ server, tool, args })
        return mem.answer(tool, args)
      },
      envGet: async () => undefined,
      cwd: async () => '/r',
      fsExists: async () => false,
      fsRead: async () => '',
      usage: async () => ({}),
      now: async () => 1760000000000,
    },
    patch: async (tab, partial) => {
      mem.body = mergeBody(mem.body, tab, partial)
    },
    update: async (tab, fn) => {
      mem.body = replaceBody(mem.body, tab, fn(mem.body[tab]))
    },
    refresh: async () => {
      mem.refreshed += 1
    },
    readAsset: async () => '',
    sampleName: async () => null,
    focus: async (key) => {
      mem.focused.push(key)
    },
  }
}

function newMem(answer: Mem['answer'] = () => reply({ ok: true, verdict: 'approve', chosen: ['approve'] })): Mem {
  return { body: emptyBody(), calls: [], toasts: [], focused: [], refreshed: 0, answer }
}

// ---- drawing -------------------------------------------------------------------------------------

type View = {
  mode: Mode
  columns: number
  focused: boolean
  review: BodySlice
  heading: string
  waiting: GateCard[]
}

type Pressers = Record<string, () => void>

// A body made of one ProposalCard. Each Button's onPress is captured by key as the view draws.
function cardBody(c: GateCard, v: View, pressers: Pressers): TabBody {
  return {
    view: (ctx) => {
      const { Box } = ctx.el
      const drawn: RenderElement = ProposalCard(ctx, c, v.heading, v.waiting)
      walk(drawn, (n) => {
        if (n.type === 'Button' && typeof n.onPress === 'function') pressers[String(propsOf(n).key)] = n.onPress as () => void
      })
      return <Box flexDirection="column">{drawn}</Box>
    },
    keys: () => [],
    explainId: 'X04',
  }
}

function paneInput(mem: Mem, v: View, over: Partial<PaneInput> = {}): PaneInput {
  return {
    surface: 'terminal',
    tab: 'review',
    vm: SAMPLES.wide,
    mode: v.mode,
    theme: v.mode.plain ? null : THEME,
    bodyColumns: v.columns,
    isFocused: v.focused,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body: { ...mem.body, review: v.review },
    act: memAct(mem),
    ...over,
  }
}

function viewOf(over: Partial<View> = {}): View {
  return { mode: COLOR, columns: 100, focused: true, review: {}, heading: text('P110'), waiting: [WIDE_CARD], ...over }
}

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

function depsOf(review: TabBody): PaneDeps {
  return { bodies: { room: undefined, think: undefined, sources: undefined, review } }
}

async function draw($: Engine, surface: Surface, columns: number) {
  return $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: SHELL_ID })
}

// One rig per test: the engine wants the render hook registered before the test first calls `$`, so the
// hook is registered once and each drawing only swaps what it draws.
type Rig = { cur: { input: PaneInput; deps: PaneDeps } }
const rigs = new WeakMap<object, Rig>()

// Draw one card with one view on the given surfaces and hand the engine's drawn handles to `check`.
async function withCard(
  $: Engine,
  on: On,
  c: GateCard,
  v: View,
  check: (ui: Awaited<ReturnType<typeof draw>>, pressers: Pressers, mem: Mem) => Promise<void>,
  mem: Mem = newMem(),
  surfaces: readonly Surface[] = ['terminal'],
): Promise<void> {
  const pressers: Pressers = {}
  const next = { input: paneInput(mem, v), deps: depsOf(cardBody(c, v, pressers)) }
  let rig = rigs.get(on)
  if (rig === undefined) {
    rig = { cur: next }
    rigs.set(on, rig)
    shellHook(on, rig.cur)
  } else {
    rig.cur.input = next.input
    rig.cur.deps = next.deps
  }
  for (const surface of surfaces) {
    const ui = await draw($, surface, v.columns)
    await check(ui, pressers, mem)
    await ui.unmount()
  }
}

// Does a drawn node hold a Text drawn dim?
function dimText(tree: unknown): boolean {
  let dim = false
  walk(tree, (n) => {
    if (n.type === 'Text' && propsOf(n).dimColor === true) dim = true
  })
  return dim
}

// Let the awaits of a press run to the end (no timer exists in the engine environment).
async function settle(): Promise<void> {
  for (let i = 0; i < 200; i += 1) await Promise.resolve()
}

// ---- consequence.ts: pure --------------------------------------------------------------------------

test('suggestedChoice is the recorded recommended choice, else the first by rank, else null', () => {
  expect(suggestedChoice(card())?.id).toBe('approve')
  expect(suggestedChoice(card({ options: [opt('reject', { rank: 2 }), opt('defer', { rank: 1 })] }))?.id).toBe('defer')
  expect(suggestedChoice(card({ options: [] }))).toBeNull()
  expect(suggestedChoice(card({ selectMode: 'multi' }))).toBeNull()
})

test('isSavable: single select, every drawn option classified, and an approve that would run work is not savable', () => {
  expect(isSavable(card())).toBe(true)
  expect(isSavable(WIDE_CARD)).toBe(true)
  expect(isSavable(card({ selectMode: 'multi' }))).toBe(false)
  expect(isSavable(card({ options: [] }))).toBe(false)
  // One option the mod cannot classify makes the whole card read-only.
  expect(isSavable(card({ options: [opt('approve', { rank: 1 }), opt('revise', { rank: 2 })] }))).toBe(false)
  // An approve on a card that runs the halted step is never saved from here.
  expect(isSavable(card({ resumes: true }))).toBe(false)
})

test('consequence line: D10 for a general verdict, D11 for a wait choice, D12 for another kind, the key is the suggested choice digit', () => {
  expect(consequenceFor(card())).toEqual({ id: 'D10', key: '1' })
  expect(consequenceWords(card())).toBe(text('D10', { key: '1' }))
  // No recommended option: the first by rank is the one named.
  const noRec = card({ options: [opt('defer', { rank: 1 }), opt('approve', { rank: 2 })] })
  expect(consequenceFor(noRec)).toEqual({ id: 'D11', key: '1' })
  expect(consequenceWords(noRec)).toBe(text('D11', { key: '1' }))
  // The recommended one is second by rank: its digit is 2.
  const second = card({ options: [opt('reject', { rank: 1 }), opt('approve', { rank: 2, recommended: true })] })
  expect(consequenceFor(second)).toEqual({ id: 'D10', key: '2' })
  expect(consequenceFor(card({ kind: 'plan_review' }))).toEqual({ id: 'D12', key: '1' })
  // A card with nothing savable has no consequence line.
  expect(consequenceFor(card({ selectMode: 'multi' }))).toBeNull()
  expect(consequenceWords(card({ options: [opt('revise', { rank: 1 })] }))).toBeNull()
})

// ---- expiry.ts: pure ------------------------------------------------------------------------------

test('formatExpiry gives HH:MM, two digits each, from local time fields', () => {
  expect(formatExpiry(new Date(2026, 9, 6, 9, 5).getTime())).toBe('09:05')
  expect(formatExpiry(new Date(2026, 9, 6, 0, 0).getTime())).toBe('00:00')
  expect(formatExpiry(new Date(2026, 9, 6, 23, 59).getTime())).toBe('23:59')
  expect(expiryWords(card())).toBe(text('P113', { time: '09:05' }))
  expect(expiryWords(card({ expiresAt: null }))).toBeNull()
})

// ---- review-io.ts: the adapter ---------------------------------------------------------------------

test('readReview reads the slice tolerantly: damaged values read as empty, never as saved', () => {
  const empty = readReview({})
  expect(empty).toEqual({ phase: {}, mirrors: {}, dismissed: [], foreign: [], openCard: null, settled: null })
  const damaged = readReview({
    phase: { a: { phase: 'bogus' }, b: 7, c: savedEntry('D24', 'Yes') },
    mirrors: 'x',
    dismissed: [1, 'g-2', null],
    foreign: 'nope',
    openCard: 5,
    settled: ['x'],
  })
  expect(Object.keys(damaged.phase)).toEqual(['c'])
  expect(damaged.mirrors).toEqual({})
  expect(damaged.dismissed).toEqual(['g-2'])
  expect(damaged.foreign).toEqual([])
  expect(damaged.openCard).toBeNull()
  expect(damaged.settled).toBeNull()
  const good = readReview({ openCard: 'g-3', settled: 'g-9', mirrors: { 'g-1': 'L-1', x: 4 } })
  expect(good.openCard).toBe('g-3')
  expect(good.settled).toBe('g-9')
  expect(good.mirrors).toEqual({ 'g-1': 'L-1' })
})

test('reviewIo writes the review slice and nothing else: phase, last result, dismiss, foreign, mirrors', async () => {
  const mem = newMem()
  const io = reviewIo(memAct(mem), {})
  await io.setPhase('g-1', savingEntry('c-1'))
  expect(readReview(mem.body.review).phase['g-1']?.phase).toBe('saving')
  await io.setPhase('g-1', null)
  expect(readReview(mem.body.review).phase).toEqual({})
  await io.setLast({ gateId: 'g-1', label: 'Yes', verdict: 'approve', at: 5 })
  expect(mem.body.review.lastResult).toEqual({ gateId: 'g-1', label: 'Yes', verdict: 'approve', at: 5 })
  await io.setForeign('g-2', true)
  expect(readReview(mem.body.review).foreign).toEqual(['g-2'])
  await io.setForeign('g-2', false)
  expect(readReview(mem.body.review).foreign).toEqual([])
  await io.setLedgerId('g-2', 'L-2')
  expect(await io.getLedgerId('g-2')).toBe('L-2')
  await io.dismiss('g-3')
  expect(readReview(mem.body.review).dismissed).toEqual(['g-3'])
  // Nothing outside the review slice moved.
  expect(mem.body.room).toEqual({})
  expect(mem.body.think).toEqual({})
  expect(mem.body.sources).toEqual({})
})

test('the in-flight claim is atomic over act.update: two presses at once send one gate_answer', async () => {
  let release: (v: unknown) => void = () => {}
  const gate = new Promise<unknown>((r) => {
    release = r
  })
  const mem = newMem(() => gate)
  const act = memAct(mem)
  const c = card()
  const approve = c.options[0] as GateOption
  const first = pressChoice(reviewIo(act, {}), c, approve)
  const second = pressChoice(reviewIo(act, {}), c, approve)
  await settle()
  expect(mem.calls.filter((x) => x.tool === 'gate_answer')).toHaveLength(1)
  // While the call is open the card says saving and nothing says saved.
  expect(readReview(mem.body.review).phase['g-1']?.phase).toBe('saving')
  release(reply({ ok: true, verdict: 'approve', chosen: ['approve'] }))
  const results = await Promise.all([first, second])
  expect(results.map((r) => r.kind).sort()).toEqual(['ignored', 'saved'])
  expect(mem.calls.filter((x) => x.tool === 'gate_answer')).toHaveLength(1)
  expect(mem.calls.every((x) => x.server === MINDRIAN_SERVER)).toBe(true)
})

test('the claim also holds when a second claim reads the slice another press just wrote (the state half alone)', async () => {
  const mem = newMem()
  const act = memAct(mem)
  const a = reviewIo(act, {})
  const b = reviewIo(act, {})
  const [ha, hb] = await Promise.all([a.claimSaving('g-9', 'claim-a'), b.claimSaving('g-9', 'claim-b')])
  expect([ha, hb].filter((h, i) => h === (i === 0 ? 'claim-a' : 'claim-b'))).toHaveLength(1)
  expect(ha).toBe(hb)
})

// ---- the card --------------------------------------------------------------------------------------

test('the wide card at 100 columns, focused: heading, question, suggestion with its reason, three buttons in one row, later, one dim consequence line, expiry', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf(), async (ui) => {
    const root = shown(await ui.drawn())
    const order = [
      text('P110'),
      WIDE_CARD.header,
      text('D01'),
      'Apply to the regional innovation grant (sample)',
      text('D03', { reason: 'Closest to your stated need and the earliest window.' }),
      '[1] Apply to the regional innovation grant (sample)',
      '[2] Not yet, show me more (sample)',
      '[3] No, leave this route out (sample)',
      text('D16'),
      text('D10', { key: '1' }),
      text('P113', { time: formatExpiry(WIDE_CARD.expiresAt ?? 0) }),
    ]
    let at = -1
    for (const piece of order) {
      const found = root.indexOf(piece, at + 1)
      expect(found).toBeGreaterThan(at)
      at = found
    }
    // The suggestion marker is the filled triangle in color mode.
    expect(root).toContain('▶')
    // One row: the three choice buttons sit in a row, with no D05 above them.
    const row = await ui.find({ key: 'review:choices' })
    expect(propsOf(row).flexDirection).toBe('row')
    expect(root).not.toContain(text('D05'))
    // The recommended one is primary, the others secondary; digits are hotkeys while focused.
    const one = await ui.find({ type: 'Button', key: 'choice:1' })
    const two = await ui.find({ type: 'Button', key: 'choice:2' })
    const three = await ui.find({ type: 'Button', key: 'choice:3' })
    expect(one?.props.variant).toBe('primary')
    expect(two?.props.variant).toBe('secondary')
    expect(three?.props.variant).toBe('secondary')
    expect([one?.props.hotkey, two?.props.hotkey, three?.props.hotkey]).toEqual(['1', '2', '3'])
    const later = await ui.find({ type: 'Button', key: 'review:later' })
    expect(later?.props.hotkey).toBe('d')
    expect(later?.props.label).toBe(text('D16'))
    // The consequence line is dim.
    const line = await ui.find({ key: 'review:consequence' })
    expect(dimText(line)).toBe(true)
  })
})

test('no option description appears under the choice row: descriptions live in the suggestion line and in details only', async ($, on) => {
  const described = card({
    options: [
      opt('approve', { rank: 1, recommended: true, description: 'DESC-ONE' }),
      opt('defer', { rank: 2, description: 'DESC-TWO' }),
      opt('reject', { rank: 3, description: 'DESC-THREE' }),
    ],
  })
  await withCard($, on, described, viewOf(), async (ui) => {
    const choices = shown(await ui.find({ key: 'review:choices' }))
    for (const d of ['DESC-ONE', 'DESC-TWO', 'DESC-THREE']) expect(choices).not.toContain(d)
    const all = shown(await ui.drawn())
    expect(all).toContain('DESC-ONE')
    expect(all).not.toContain('DESC-TWO')
    expect(all).not.toContain('DESC-THREE')
  })
})

test('an option with no description gives D04 after the suggestion; no recommended option draws no suggestion line', async ($, on) => {
  const noDescription = card({ options: [opt('approve', { rank: 1, recommended: true }), opt('reject', { rank: 2 })] })
  await withCard($, on, noDescription, viewOf(), async (ui) => {
    const root = shown(await ui.drawn())
    expect(root).toContain(text('D01'))
    expect(root).toContain(text('D04'))
    expect(root).not.toContain('D03')
    const d04 = await ui.find({ key: 'review:no-reason' })
    expect(dimText(d04)).toBe(true)
  })
  const noSuggestion = card({ options: [opt('defer', { rank: 1 }), opt('approve', { rank: 2 })] })
  await withCard($, on, noSuggestion, viewOf(), async (ui) => {
    const root = shown(await ui.drawn())
    expect(root).not.toContain(text('D01'))
    expect(root).not.toContain(text('D04'))
    expect(await ui.find({ key: 'review:suggestion' })).toBeUndefined()
    // The consequence line names the first by rank (a wait choice here).
    expect(root).toContain(text('D11', { key: '1' }))
  })
})

test('at 60 columns the choice buttons are stacked with D05 above them; in plain mode D05 is drawn at any width', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ columns: 60 }), async (ui) => {
    const row = await ui.find({ key: 'review:choices' })
    expect(propsOf(row).flexDirection).toBe('column')
    const root = shown(await ui.drawn())
    expect(root).toContain(text('D05'))
    expect(root.indexOf(text('D05'))).toBeLessThan(root.indexOf('[1] '))
  })
  await withCard($, on, WIDE_CARD, viewOf({ mode: PLAIN, columns: 100 }), async (ui) => {
    expect(shown(await ui.drawn())).toContain(text('D05'))
  })
})

test('plain mode: no color prop anywhere, the suggestion marker is a greater-than mark, the suggested button is the primary one', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ mode: PLAIN }), async (ui) => {
    const card = await ui.find({ key: 'review:card' })
    expect(colorKeys(card)).toEqual([])
    const suggestion = shown(await ui.find({ key: 'review:suggestion' }))
    expect(suggestion.startsWith('>')).toBe(true)
    expect(suggestion).not.toContain('▶')
    const one = await ui.find({ type: 'Button', key: 'choice:1' })
    expect(one?.props.variant).toBe('primary')
    // The card sits in a bordered box in plain mode (UI-SPEC 12.2).
    expect(propsOf(card).borderStyle).toBe('single')
  })
})

test('hotkeys are armed only while the pane holds the keyboard; unfocused, no choice or later button has a hotkey and N06 shows', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ focused: false }), async (ui) => {
    for (const key of ['choice:1', 'choice:2', 'choice:3', 'review:later']) {
      const b = await ui.find({ type: 'Button', key })
      expect(b).toBeDefined()
      expect(b?.props.hotkey).toBeUndefined()
    }
    expect(shown(await ui.drawn())).toContain(text('N06'))
  })
  await withCard($, on, WIDE_CARD, viewOf({ focused: true }), async (ui) => {
    for (const key of ['choice:1', 'choice:2', 'choice:3', 'review:later']) {
      expect((await ui.find({ type: 'Button', key }))?.props.hotkey).toBeDefined()
    }
  })
})

test('the choice buttons draw the same on all four surfaces', async ($, on) => {
  await withCard(
    $,
    on,
    WIDE_CARD,
    viewOf(),
    async (ui) => {
      const keys = (await ui.findAll({ type: 'Button' })).map((b) => String(b.key))
      for (const k of ['choice:1', 'choice:2', 'choice:3', 'review:later']) expect(keys).toContain(k)
    },
    newMem(),
    SURFACES,
  )
})

// ---- read-only cards --------------------------------------------------------------------------------

test('a multi-answer card, a card with an unclassified option and a resumes card with an approve draw D30 and still offer Decide later', async ($, on) => {
  const cases: GateCard[] = [
    card({ selectMode: 'multi' }),
    card({ options: [opt('approve', { rank: 1, recommended: true }), opt('revise', { rank: 2 })] }),
    card({ kind: 'chain_halt', resumes: true }),
  ]
  for (const c of cases) {
    await withCard($, on, c, viewOf(), async (ui) => {
      const root = shown(await ui.drawn())
      expect(root).toContain(c.header)
      expect(root).toContain(text('D30'))
      expect(root).toContain(text('D16'))
      for (const k of ['choice:1', 'choice:2', 'choice:3']) expect(await ui.find({ key: k })).toBeUndefined()
      // No consequence line: nothing here is saved.
      expect(await ui.find({ key: 'review:consequence' })).toBeUndefined()
    })
  }
})

// ---- the phase display ------------------------------------------------------------------------------

function withPhase(id: string, entry: unknown): BodySlice {
  return { phase: { [id]: entry } }
}

test('saving replaces the choice buttons with D23', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ review: withPhase(WIDE_CARD.gateId, savingEntry('c')) }), async (ui) => {
    const root = shown(await ui.drawn())
    expect(root).toContain(text('D23'))
    for (const k of ['choice:1', 'choice:2', 'choice:3']) expect(await ui.find({ key: k })).toBeUndefined()
    expect(root).not.toContain('Saved to your data room')
  })
})

test('saved shows D24 with the label, D13, D26 or D27 in place of the buttons', async ($, on) => {
  const cases: [ReturnType<typeof savedEntry>, string][] = [
    [savedEntry('D24', 'Yes'), text('D24', { label: 'Yes' })],
    [savedEntry('D13', ''), text('D13')],
    [savedEntry('D26', ''), text('D26')],
    [savedEntry('D27', ''), text('D27')],
  ]
  for (const [entry, words] of cases) {
    await withCard($, on, WIDE_CARD, viewOf({ review: withPhase(WIDE_CARD.gateId, entry) }), async (ui) => {
      const root = shown(await ui.drawn())
      expect(root).toContain(words)
      expect(await ui.find({ key: 'choice:1' })).toBeUndefined()
    })
  }
})

test('refused shows the E sentence on a red block with cream words and keeps the card and its buttons', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ review: withPhase(WIDE_CARD.gateId, refusedEntry('E06')) }), async (ui) => {
    const block = await ui.find({ key: 'review:refusal' })
    expect(propsOf(block).backgroundColor).toBe(THEME.problem)
    expect(shown(block)).toContain(text('E06'))
    const texts: Node[] = []
    walk(block, (n) => {
      if (n.type === 'Text') texts.push(n)
    })
    expect(texts.some((t) => propsOf(t).color === THEME.reading)).toBe(true)
    // The card is unchanged above it and the buttons are still there.
    const root = shown(await ui.drawn())
    expect(root).toContain(WIDE_CARD.header)
    expect(await ui.find({ key: 'choice:1' })).toBeDefined()
  })
  // Plain mode: a bordered box, no color.
  await withCard(
    $,
    on,
    WIDE_CARD,
    viewOf({ mode: PLAIN, review: withPhase(WIDE_CARD.gateId, refusedEntry('E07')) }),
    async (ui) => {
      const block = await ui.find({ key: 'review:refusal' })
      expect(colorKeys(block)).toEqual([])
      expect(propsOf(block).borderStyle).toBe('single')
      expect(shown(block)).toContain(text('E07'))
    },
  )
})

test('checking draws D31 then D32, D33 or D34; D31 hides the buttons, a finished check keeps them', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf({ review: withPhase(WIDE_CARD.gateId, checkingEntry('D31')) }), async (ui) => {
    expect(shown(await ui.drawn())).toContain(text('D31'))
    expect(await ui.find({ key: 'choice:1' })).toBeUndefined()
  })
  for (const id of ['D32', 'D33', 'D34'] as const) {
    await withCard($, on, WIDE_CARD, viewOf({ review: withPhase(WIDE_CARD.gateId, checkingEntry(id)) }), async (ui) => {
      expect(shown(await ui.drawn())).toContain(text(id))
      expect(await ui.find({ key: 'choice:1' })).toBeDefined()
    })
  }
})

test('no phase entry draws no saved sentence: a saved sentence only ever comes from the phase', async ($, on) => {
  await withCard($, on, WIDE_CARD, viewOf(), async (ui) => {
    const root = shown(await ui.drawn())
    for (const id of ['D13', 'D14', 'D23', 'D26', 'D27'] as const) expect(root).not.toContain(text(id))
    expect(root).not.toContain('Saved to your data room')
  })
})

// ---- presses ----------------------------------------------------------------------------------------

test('pressing a choice runs the answer machine: one gate_answer to the Mindrian OS server with the right verdict', async ($, on) => {
  const mem = newMem()
  await withCard(
    $,
    on,
    WIDE_CARD,
    viewOf(),
    async (_ui, pressers) => {
      pressers['choice:1']?.()
      await settle()
      const answers = mem.calls.filter((c) => c.tool === 'gate_answer')
      expect(answers).toHaveLength(1)
      expect(answers[0]?.server).toBe(MINDRIAN_SERVER)
      expect(answers[0]?.args).toEqual({ gate_id: WIDE_CARD.gateId, chosen: ['approve'], verdict: 'approve' })
      // The saved phase and the recorded result were written only after the runtime answered.
      const review = readReview(mem.body.review)
      expect(review.phase[WIDE_CARD.gateId]?.copyId).toBe('D24')
      expect(mem.body.review.lastResult).toBeDefined()
      expect(mem.refreshed).toBe(1)
    },
    mem,
  )
})

test('pressing the second choice sends its own verdict; Decide later makes zero calls and writes no phase', async ($, on) => {
  const mem = newMem(() => reply({ ok: true, verdict: 'defer', chosen: ['defer'] }))
  await withCard(
    $,
    on,
    WIDE_CARD,
    viewOf(),
    async (_ui, pressers) => {
      pressers['choice:2']?.()
      await settle()
      const answers = mem.calls.filter((c) => c.tool === 'gate_answer')
      expect(answers[0]?.args).toEqual({ gate_id: WIDE_CARD.gateId, chosen: ['defer'], verdict: 'defer' })
    },
    mem,
  )
  const later = newMem()
  await withCard(
    $,
    on,
    WIDE_CARD,
    viewOf(),
    async (_ui, pressers) => {
      pressers['review:later']?.()
      await settle()
      expect(later.calls).toEqual([])
      expect(readReview(later.body.review).dismissed).toEqual([WIDE_CARD.gateId])
      expect(readReview(later.body.review).phase).toEqual({})
      expect(later.body.review.lastResult).toBeUndefined()
      expect(later.toasts).toEqual([text('D14')])
    },
    later,
  )
})

// ---- the choice buttons on their own --------------------------------------------------------------

test('ChoiceButtons exports CHOICE_FORM and both forms draw without error', async ($, on) => {
  expect(['boxed', 'plain']).toContain(CHOICE_FORM)
  expect(choiceLabel(2, 'Yes', 'boxed')).toBe('[2] Yes')
  expect(choiceLabel(2, 'Yes', 'plain')).toBe('Yes')
  let form: 'boxed' | 'plain' = 'boxed'
  const body: TabBody = {
    view: (ctx: TabContext) => {
      const { Box } = ctx.el
      return <Box flexDirection="column">{ChoiceButtons(ctx, WIDE_CARD, [WIDE_CARD], form)}</Box>
    },
    keys: () => [],
    explainId: 'X04',
  }
  const cur = { input: paneInput(newMem(), viewOf()), deps: depsOf(body) }
  shellHook(on, cur)
  for (const which of ['boxed', 'plain'] as const) {
    form = which
    const ui = await draw($, 'terminal', 100)
    const one = await ui.find({ type: 'Button', key: 'choice:1' })
    expect(one).toBeDefined()
    if (which === 'plain') {
      expect(one?.props.plain).toBe(true)
      expect(one?.props.label).toBe('Apply to the regional innovation grant (sample)')
      expect(await ui.find({ key: 'choice-box:1' })).toBeUndefined()
    } else {
      expect(await ui.find({ key: 'choice-box:1' })).toBeDefined()
      expect(one?.props.label).toBe('[1] Apply to the regional innovation grant (sample)')
    }
    await ui.unmount()
  }
})

// =============================================================================================
// Task 2: the decision list, the foreign-card path and the Review tab body
// =============================================================================================

const REVIEW = reviewBody as TabBody

function ctxFor(vm: typeof SAMPLES.wide, body: BodyState, act: ShellActions, over: Partial<TabContext> = {}): TabContext {
  return {
    el: undefined as never,
    vm,
    theme: THEME,
    mode: COLOR,
    bodyColumns: 100,
    isFocused: true,
    tab: 'review',
    body,
    detailsOpen: false,
    act,
    ...over,
  }
}

const withReview = (review: BodySlice): BodyState => ({ ...emptyBody(), review })

test('reviewBody is defined, names X04, and its keys follow what is drawn: 1 to 3 H15, d H16, i H19', () => {
  expect(REVIEW).toBeDefined()
  expect(REVIEW.explainId).toBe('X04')
  const act = memAct(newMem())
  const keys = (vm: typeof SAMPLES.wide, review: BodySlice = {}) =>
    REVIEW.keys(ctxFor(vm, withReview(review), act)).map((k) => k.key + ':' + k.labelId)
  expect(keys(SAMPLES.wide)).toEqual(['1-3:H15', 'd:H16'])
  // Nothing waits, the room is unreadable, no room: only Help (the shell adds it), so no body keys.
  expect(keys(SAMPLES.empty)).toEqual([])
  expect(keys(SAMPLES.unreadable)).toEqual([])
  expect(keys(SAMPLES.noroom)).toEqual([])
  // A card the mod cannot save has Decide later and no digits.
  expect(keys(SAMPLES.several, { openCard: 'sample-gate-2' })).toEqual(['d:H16'])
  // A card from another conversation: Ask it here and Decide later, no digits.
  expect(keys(SAMPLES.wide, { foreign: [WIDE_CARD.gateId] })).toEqual(['d:H16', 'i:H19'])
  // Saving: no keys at all for that card.
  expect(keys(SAMPLES.wide, { phase: { [WIDE_CARD.gateId]: savingEntry('c') } })).toEqual([])
})

test('reviewBody.onOpen refreshes the live model, clears the settled mark, and makes no call for a sample', async () => {
  const mem = newMem()
  let sample: string | null = null
  const act: ShellActions = { ...memAct(mem), sampleName: async () => sample }
  await act.patch('review', { settled: 'g-old' })
  await REVIEW.onOpen?.(act)
  expect(mem.refreshed).toBe(1)
  expect(mem.body.review.settled).toBeUndefined()
  sample = 'wide'
  await REVIEW.onOpen?.(act)
  expect(mem.refreshed).toBe(1)
  expect(mem.calls).toEqual([])
})

test('detailsExtra lists, under D02, each option description of the open card in full', async ($, on) => {
  const described = card({
    options: [
      opt('approve', { rank: 1, recommended: true, description: 'LONG ONE '.repeat(12).trim() }),
      opt('defer', { rank: 2, description: 'TWO' }),
      opt('reject', { rank: 3 }),
    ],
  })
  const vm: typeof SAMPLES.wide = { ...SAMPLES.wide, gates: ok([described]) }
  const body: TabBody = {
    view: () => null,
    keys: () => [],
    explainId: 'X04',
    detailsExtra: (ctx) => REVIEW.detailsExtra?.(ctx) ?? null,
  }
  const mem = newMem()
  const cur = { input: paneInput(mem, viewOf(), { vm, detailsOpen: { ...NONE_OPEN, review: true } }), deps: depsOf(body) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal', 100)
  const all = shown(await ui.drawn())
  expect(all).toContain(text('D02'))
  expect(all).toContain('LONG ONE '.repeat(12).trim())
  expect(all).toContain('TWO')
  await ui.unmount()
  // No description anywhere: nothing extra.
  const none = ctxFor({ ...SAMPLES.wide, gates: ok([card({ options: [opt('approve', { rank: 1 })] })]) }, emptyBody(), memAct(newMem()))
  expect(REVIEW.detailsExtra?.(none)).toBeNull()
})

// ---- listState: pure --------------------------------------------------------------------------------

test('listState: the open card is the open one, else the first not set aside by soonest expiry; the rest are the others', () => {
  const cards = [card({ gateId: 'late', expiresAt: 9000 }), card({ gateId: 'soon', expiresAt: 1000 }), card({ gateId: 'none', expiresAt: null })]
  const vm = { ...SAMPLES.wide, gates: ok(cards) }
  const ctx = (review: BodySlice) => ctxFor(vm, withReview(review), memAct(newMem()))
  const a = listState(ctx({}))
  expect(a.kind).toBe('cards')
  if (a.kind !== 'cards') return
  expect(a.open?.gateId).toBe('soon')
  expect(a.others.map((c) => c.gateId)).toEqual(['late', 'none'])
  const b = listState(ctx({ openCard: 'late' }))
  if (b.kind !== 'cards') return
  expect(b.open?.gateId).toBe('late')
  const c = listState(ctx({ dismissed: ['soon'] }))
  if (c.kind !== 'cards') return
  expect(c.open?.gateId).toBe('late')
  expect(c.others.map((x) => x.gateId)).toEqual(['soon', 'none'])
  // Every card set aside: no open card, all of them listed.
  const d = listState(ctx({ dismissed: ['soon', 'late', 'none'] }))
  if (d.kind !== 'cards') return
  expect(d.open).toBeNull()
  expect(d.others).toHaveLength(3)
  // A card the runtime answered is no longer waiting, whatever the model still lists.
  const e = listState(ctx({ phase: { soon: savedEntry('D24', 'Yes') } }))
  if (e.kind !== 'cards') return
  expect(e.waiting.map((x) => x.gateId)).toEqual(['late', 'none'])
  // A wait that stays open (D13) is still waiting.
  const f = listState(ctx({ phase: { soon: savedEntry('D13', '') } }))
  if (f.kind !== 'cards') return
  expect(f.waiting).toHaveLength(3)
  expect(listState(ctxFor(SAMPLES.empty, emptyBody(), memAct(newMem()))).kind).toBe('empty')
  expect(listState(ctxFor(SAMPLES.unreadable, emptyBody(), memAct(newMem()))).kind).toBe('unreadable')
  expect(listState(ctxFor(SAMPLES.noroom, emptyBody(), memAct(newMem()))).kind).toBe('noroom')
})

// ---- the real pane at the Review tab ----------------------------------------------------------------

type Beneath = {
  mcp: { server: string; tool: string; args: Record<string, unknown> }[]
  toasts: string[]
  focused: string[]
  submits: unknown[]
  answer: (tool: string, args: Record<string, unknown>) => unknown
}

const PALETTE_TEXT = JSON.stringify({
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
})

function wireReal(on: On, env: Record<string, string>, answer?: Beneath['answer']): Beneath {
  const beneath: Beneath = {
    mcp: [],
    toasts: [],
    focused: [],
    submits: [],
    answer:
      answer ??
      ((tool) =>
        tool === 'gate_list'
          ? reply({ ok: true, room: 'a', count: 0, gates: [] })
          : reply({ ok: true, segments: { room_binding: { bound: true, source: 'session', registry_fallback: false, slug: 'a' } } })),
  }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE_TEXT }
    if (e.path.endsWith('ROOM.md')) return { value: '---\npurpose: Funding routes\n---\n' }
    return { value: '{"status":"sound","at":1}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    const args = (e.args ?? {}) as Record<string, unknown>
    beneath.mcp.push({ server: e.server, tool: e.tool, args })
    return { value: beneath.answer(e.tool, args) as never }
  })
  on('prompt.submit', (_$, e) => {
    beneath.submits.push(e)
    return { text: e.text }
  })
  on('ui.toast', (_$, e) => {
    beneath.toasts.push(e.text)
    return { value: undefined }
  })
  return beneath
}

const mountReal = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: PANE_ID })

type Ui = Awaited<ReturnType<typeof mountReal>>

// Go to the Review tab, and put the tab back at the end of a pass (a pane's state persists in a test).
async function openReview(ui: Ui): Promise<void> {
  await ui.press({ key: 'tab:review' })
}
async function leaveReview(ui: Ui): Promise<void> {
  await ui.press({ key: 'tab:room' })
}

const answers = (b: Beneath) => b.mcp.filter((c) => c.tool === 'gate_answer')

for (const surface of SURFACES) {
  test('the real pane at Review (' + surface + '): the wide sample draws P110 and the open card with its three choices', async ($, on) => {
    const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
    const ui = await mountReal($, surface)
    await openReview(ui)
    const root = shown(await ui.drawn())
    expect(root).toContain(text('P110'))
    expect(root).toContain(WIDE_CARD.header)
    for (const k of ['choice:1', 'choice:2', 'choice:3', 'review:later']) expect(await ui.find({ type: 'Button', key: k })).toBeDefined()
    const hint = shown(await ui.find({ key: 'hint-line' }))
    expect(hint).toContain('1-3: ' + text('H15'))
    expect(hint).toContain('d: ' + text('H16'))
    expect(beneath.mcp).toEqual([])
    await leaveReview(ui)
    await ui.unmount()
  })
}

test('the real pane at Review: several decisions say P116 with the real count, open the soonest, list the others under P117 and open one with a press', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'several' })
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  let root = shown(await ui.drawn())
  expect(root).toContain(text('P116', { n: 3 }))
  expect(root).toContain('Which grant route should the funding case take? (sample)')
  expect(root).toContain(text('P117'))
  const others = ['Which customer group should you test first? (sample)', 'Run the next step of the funding chain? (sample)']
  const second = await ui.find({ type: 'Button', key: 'review:open:sample-gate-2' })
  const third = await ui.find({ type: 'Button', key: 'review:open:sample-gate-3' })
  expect([second?.props.label, third?.props.label]).toEqual(others)
  // The first card's own header is not a list button, and no list button has a hotkey.
  expect(await ui.find({ type: 'Button', key: 'review:open:sample-gate-1' })).toBeUndefined()
  expect(second?.props.hotkey).toBeUndefined()
  // Open the second: its card is drawn (read-only: its choices are not classified), the first joins the list.
  await ui.press({ key: 'review:open:sample-gate-2' })
  root = shown(await ui.drawn())
  expect(root).toContain(text('P116', { n: 3 }))
  expect(await ui.find({ key: 'choice:1' })).toBeUndefined()
  expect(root).toContain(text('D30'))
  expect(await ui.find({ type: 'Button', key: 'review:open:sample-gate-1' })).toBeDefined()
  await leaveReview(ui)
  await ui.unmount()
})


for (const [sample, words] of [
  ['empty', text('P111')],
  ['unreadable', text('P112')],
  ['noroom', text('P12')],
] as const) {
  test('the real pane at Review: the "' + sample + '" situation draws ' + words, async ($, on) => {
    wireReal(on, { MOS_WORKSPACE_SAMPLE: sample })
    const ui = await mountReal($, 'terminal')
    await openReview(ui)
    const root = shown(await ui.drawn())
    expect(root).toContain(words)
    expect(await ui.find({ key: 'review:card' })).toBeUndefined()
    if (sample === 'noroom') {
      for (const other of [text('P111'), text('P112'), text('P110')]) expect(root).not.toContain(other)
    }
    await leaveReview(ui)
    await ui.unmount()
  })
}

test('the real pane: pressing 1 sends one gate_answer to the Mindrian OS server, shows D23 while it is open, D24 only after ok, and never submits', async ($, on) => {
  let release: (v: unknown) => void = () => {}
  const open = new Promise<unknown>((r) => {
    release = r
  })
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, (tool) => (tool === 'gate_answer' ? open : reply({ ok: true, count: 0, gates: [] })))
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await ui.press({ key: 'choice:1' })
  await settle()
  // The call is open: saving, no choices, no saved words.
  let root = shown(await ui.drawn())
  expect(root).toContain(text('D23'))
  expect(root).not.toContain('Saved to your data room')
  expect(await ui.find({ key: 'choice:1' })).toBeUndefined()
  expect(answers(beneath)).toHaveLength(1)
  release(reply({ ok: true, verdict: 'approve', chosen: ['approve'] }))
  await settle()
  root = shown(await ui.drawn())
  expect(root).toContain(text('D24', { label: 'Apply to the regional innovation grant (sample)' }))
  expect(root).not.toContain(text('D23'))
  const sent = answers(beneath)
  expect(sent).toHaveLength(1)
  expect(sent[0]?.server).toBe(MINDRIAN_SERVER)
  expect(sent[0]?.args).toEqual({ gate_id: WIDE_CARD.gateId, chosen: ['approve'], verdict: 'approve' })
  expect(beneath.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
  expect(beneath.submits).toEqual([])
  // The Room tab now says what was saved (P55), from the same slice.
  await ui.press({ key: 'tab:room' })
  expect(shown(await ui.find({ key: 'room:result' }))).toContain(
    text('D24', { label: 'Apply to the regional innovation grant (sample)' }),
  )
  await ui.unmount()
})

test('the real pane: two presses at once send one gate_answer', async ($, on) => {
  let release: (v: unknown) => void = () => {}
  const open = new Promise<unknown>((r) => {
    release = r
  })
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, (tool) => (tool === 'gate_answer' ? open : reply({ ok: true, count: 0, gates: [] })))
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await Promise.all([ui.press({ key: 'choice:1' }), ui.press({ key: 'choice:1' }).catch(() => undefined)])
  await settle()
  expect(answers(beneath)).toHaveLength(1)
  release(reply({ ok: true, verdict: 'approve', chosen: ['approve'] }))
  await settle()
  expect(answers(beneath)).toHaveLength(1)
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('the real pane: a refusal keeps the card, shows the E sentence, and says nothing was saved', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, (tool) =>
    tool === 'gate_answer' ? reply({ ok: false, reason: 'gate_expired' }) : reply({ ok: true, count: 0, gates: [] }),
  )
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await ui.press({ key: 'choice:2' })
  await settle()
  const root = shown(await ui.drawn())
  expect(root).toContain(text('E02'))
  expect(root).toContain(WIDE_CARD.header)
  expect(root).not.toContain('Saved to your data room')
  expect(await ui.find({ key: 'choice:1' })).toBeDefined()
  expect(answers(beneath)).toHaveLength(1)
  // The Room tab draws no "what just changed".
  await ui.press({ key: 'tab:room' })
  expect(await ui.find({ key: 'room:result' })).toBeUndefined()
  await ui.unmount()
})

test('the real pane: a card from another conversation shows the refusal, then P115 draws it here and later answers use the new id', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, (tool, args) => {
    if (tool === 'gate_answer') {
      return args.gate_id === 'L-1'
        ? reply({ ok: true, verdict: 'approve', chosen: ['approve'] })
        : reply({ ok: false, reason: 'session_mismatch' })
    }
    if (tool === 'gate_render') return reply({ ok: true, gate_id: 'L-1' })
    return reply({ ok: true, count: 0, gates: [] })
  })
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await ui.press({ key: 'choice:1' })
  await settle()
  let root = shown(await ui.drawn())
  expect(root).toContain(text('E04'))
  const ask = await ui.find({ type: 'Button', key: 'review:ask' })
  expect(ask?.props.label).toBe(text('P115'))
  expect(ask?.props.hotkey).toBe('i')
  expect(await ui.find({ key: 'choice:1' })).toBeUndefined()

  await ui.press({ key: 'review:ask' })
  await settle()
  const rendered = beneath.mcp.filter((c) => c.tool === 'gate_render')
  expect(rendered).toHaveLength(1)
  expect(rendered[0]?.server).toBe(MINDRIAN_SERVER)
  expect(rendered[0]?.args.mirror_of).toBe(WIDE_CARD.gateId)
  expect((rendered[0]?.args.options as { id: string }[]).map((o) => o.id)).toEqual(['approve', 'defer', 'reject'])
  // Drawn here: the refusal is gone and the choices are back.
  root = shown(await ui.drawn())
  expect(root).not.toContain(text('E04'))
  expect(await ui.find({ key: 'choice:1' })).toBeDefined()
  expect(await ui.find({ key: 'review:ask' })).toBeUndefined()

  await ui.press({ key: 'choice:1' })
  await settle()
  const sent = answers(beneath)
  expect(sent.map((c) => c.args.gate_id)).toEqual([WIDE_CARD.gateId, 'L-1'])
  expect(shown(await ui.drawn())).toContain(text('D24', { label: 'Apply to the regional innovation grant (sample)' }))
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('the real pane: Decide later makes zero calls, says D14 in the card place, lists the card under P117, and a press brings it back', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await ui.press({ key: 'review:later' })
  await settle()
  expect(beneath.mcp).toEqual([])
  expect(beneath.toasts).toContain(text('D14'))
  let root = shown(await ui.drawn())
  expect(root).toContain(text('D14'))
  expect(root).toContain(text('P117'))
  expect(await ui.find({ key: 'choice:1' })).toBeUndefined()
  const back = await ui.find({ type: 'Button', key: 'review:open:' + WIDE_CARD.gateId })
  expect(back?.props.label).toBe(WIDE_CARD.header)
  // It is still waiting: the Room tab still says one decision waits.
  await ui.press({ key: 'review:open:' + WIDE_CARD.gateId })
  await settle()
  root = shown(await ui.drawn())
  expect(await ui.find({ key: 'choice:1' })).toBeDefined()
  expect(root).not.toContain(text('D14'))
  expect(beneath.mcp).toEqual([])
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('after a save the open card moves to the next waiting one and the keyboard returns to the tab strip', async () => {
  const mem = newMem()
  const act = memAct(mem)
  const second = card({ gateId: 'g-2', header: 'Second question?' })
  const first = card({ gateId: 'g-1' })
  const approve = first.options[0] as GateOption
  const result = await runChoice(act, {}, first, approve, [first, second], 'tab:review')
  expect(result.kind).toBe('saved')
  expect(mem.body.review.openCard).toBe('g-2')
  expect(mem.body.review.settled).toBe('g-1')
  expect(mem.focused).toEqual(['tab:review'])
  // The last card: no next one, the open mark is cleared.
  const mem2 = newMem()
  await runChoice(memAct(mem2), { openCard: 'g-1' }, first, approve, [first], 'tab:review')
  expect(mem2.body.review.openCard).toBeUndefined()
  expect(mem2.body.review.settled).toBe('g-1')
  // A wait that stays open (D13) does not move anything.
  const mem3 = newMem((tool) => (tool === 'gate_list' ? reply({ ok: true, count: 1, gates: [] }) : reply({ ok: true, verdict: 'defer', chosen: ['defer'] })))
  const defer = first.options[1] as GateOption
  await runChoice(memAct(mem3), {}, first, defer, [first, second], 'tab:review')
  expect(mem3.focused).toEqual(['tab:review'])
})

test('the real pane: after a save on the first of three the heading says two and the next card is open', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'several' }, (tool) =>
    tool === 'gate_answer' ? reply({ ok: true, verdict: 'approve', chosen: ['approve'] }) : reply({ ok: true, count: 0, gates: [] }),
  )
  const ui = await mountReal($, 'terminal')
  await openReview(ui)
  await ui.press({ key: 'choice:1' })
  await settle()
  const root = shown(await ui.drawn())
  expect(root).toContain(text('P116', { n: 2 }))
  expect(root).toContain('Which customer group should you test first? (sample)')
  expect(root).toContain(text('D24', { label: 'Apply to the regional innovation grant (sample)' }))
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})
