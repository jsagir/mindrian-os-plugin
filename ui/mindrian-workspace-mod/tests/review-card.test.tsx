// Plan 14: the Review tab's decision card. Task 1 tests the card, the choice buttons, the
// consequence line and the adapter that builds plan 10's answer machine from `act` (route B: the
// review state is a slice of the one `body` key). The card is drawn by a test hook of its own on a
// pane id the plugin does not claim (engine rule 11: a press on a Button a test hook drew finds
// nothing, so each Button's onPress is captured as the view draws and called directly); Task 2 adds
// the real pane on the real id.
import type { On, RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import type { GateCard, GateOption } from '../src/model/view-model'
import { emptyBody, mergeBody, replaceBody } from '../src/pane/kit'
import type { BodySlice, BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { CHOICE_FORM, ChoiceButtons, choiceLabel } from '../src/pane/review/choice-buttons'
import { consequenceFor, consequenceWords, isSavable, suggestedChoice } from '../src/pane/review/consequence'
import { expiryWords, formatExpiry } from '../src/pane/review/expiry'
import { ProposalCard } from '../src/pane/review/proposal-card'
import { readReview, reviewIo } from '../src/pane/review/review-io'
import { pressChoice } from '../src/pane/review/answer-machine'
import { savedEntry, savingEntry, refusedEntry, checkingEntry } from '../src/pane/review/state'
import type { ShellActions, TabBody, TabContext } from '../src/pane/types'
import { MINDRIAN_SERVER, PLUGIN_NAME } from '../src/runtime/ids'
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

// Draw one card with one view on one surface and hand the engine's drawn handles to `check`.
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
  const cur = { input: paneInput(mem, v), deps: depsOf(cardBody(c, v, pressers)) }
  shellHook(on, cur)
  for (const surface of surfaces) {
    const ui = await draw($, surface, v.columns)
    await check(ui, pressers, mem)
    await ui.unmount()
  }
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
  await Promise.resolve()
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
    expect(propsOf(line).dimColor).toBe(true)
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
    expect(propsOf(d04).dimColor).toBe(true)
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
      await new Promise((r) => setTimeout(r, 20))
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
      await new Promise((r) => setTimeout(r, 20))
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
      await new Promise((r) => setTimeout(r, 20))
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
  for (const form of ['boxed', 'plain'] as const) {
    const pressers: Pressers = {}
    const body: TabBody = {
      view: (ctx: TabContext) => {
        const { Box } = ctx.el
        const drawn = ChoiceButtons(ctx, WIDE_CARD, [WIDE_CARD], form)
        walk(drawn, (n) => {
          if (n.type === 'Button' && typeof n.onPress === 'function') pressers[String(propsOf(n).key)] = n.onPress as () => void
        })
        return <Box flexDirection="column">{drawn}</Box>
      },
      keys: () => [],
      explainId: 'X04',
    }
    const mem = newMem()
    const cur = { input: paneInput(mem, viewOf()), deps: depsOf(body) }
    shellHook(on, cur)
    const ui = await draw($, 'terminal', 100)
    const one = await ui.find({ type: 'Button', key: 'choice:1' })
    expect(one).toBeDefined()
    if (form === 'plain') {
      expect(one?.props.plain).toBe(true)
      expect(one?.props.label).toBe('Apply to the regional innovation grant (sample)')
      expect(await ui.find({ key: 'choice-box:1' })).toBeUndefined()
    } else {
      expect(await ui.find({ key: 'choice-box:1' })).toBeDefined()
    }
    await ui.unmount()
  }
})
