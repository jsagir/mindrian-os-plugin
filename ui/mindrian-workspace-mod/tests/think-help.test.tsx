// Plan 16: the Think tab's help area and the one guarded lookup. This block (task 1) tests the
// pure half of the lookup directly, with a recording fake `act` (engine rule 11: a test cannot swap
// a module the plugin imports). The real `act.guidance` closure is proved under the real engine by
// tests/test-369.26-part8.cjs (a scratch probe), because a test hook cannot lend the plugin's own
// `$`; the real-pane arms that press P93 are added with the help view below.
import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { text } from '../src/copy/text'
import { SAMPLES } from '../src/model/fixtures'
import { ok } from '../src/model/view-model'
import type { ViewModel } from '../src/model/view-model'
import { thinkBody } from '../src/pane/bodies/think'
import { emptyBody } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import { fixtureFor } from '../src/pane/think/fixtures'
import { HelpActions, helpKeyList } from '../src/pane/think/help-actions'
import { HELP_KINDS, helpFor, isHelpState, planFor, readHelp, runLookup, selectKind } from '../src/pane/think/help-model'
import { isCanonicalHandle, lookupGuidance, textFromReply } from '../src/pane/think/lookup'
import type { ThinkModel } from '../src/pane/think/model'
import type { Actions, ShellActions, TabBody, TabContext } from '../src/pane/types'
import { BRAIN_SERVER, PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'
import type { Mode } from '../src/theme/plain'
import type { Theme } from '../src/theme/theme'

const CANON = JSON.stringify({ framework_names: ['Assumption Challenging', 'Dominant Design', "Porter's Five Forces"] })

// ---------------------------------------------------------------------------------------------
// isCanonicalHandle (pure)
// ---------------------------------------------------------------------------------------------

test('isCanonicalHandle: an exact canon name is true, and so is its lowercase form', () => {
  expect(isCanonicalHandle('Assumption Challenging', CANON)).toBe(true)
  expect(isCanonicalHandle('assumption challenging', CANON)).toBe(true)
  expect(isCanonicalHandle("Porter's Five Forces", CANON)).toBe(true)
})

test('isCanonicalHandle: room-like content is false (an email, a currency amount, a name with a degree)', () => {
  expect(isCanonicalHandle('jane.doe@example.com', CANON)).toBe(false)
  expect(isCanonicalHandle('$4,200,000 grant from the Larkspur Foundation', CANON)).toBe(false)
  expect(isCanonicalHandle('Dr. Jane Smith, PhD', CANON)).toBe(false)
})

test('isCanonicalHandle: a newline, an over-long string and an empty string are false, even when they start with a canon name', () => {
  expect(isCanonicalHandle('Assumption Challenging\nAcme Bio', CANON)).toBe(false)
  expect(isCanonicalHandle('Assumption Challenging' + ' x'.repeat(70), CANON)).toBe(false)
  expect(isCanonicalHandle('x'.repeat(129), CANON)).toBe(false)
  expect(isCanonicalHandle('', CANON)).toBe(false)
  expect(isCanonicalHandle(' ', CANON)).toBe(false)
})

test('isCanonicalHandle: a well-formed name that is not in the canon is false', () => {
  expect(isCanonicalHandle('Some Unlisted Framework', CANON)).toBe(false)
  expect(isCanonicalHandle('Assumption Challenging ', CANON)).toBe(false)
})

test('isCanonicalHandle: a value that is not a string is false', () => {
  for (const bad of [123, null, undefined, {}, ['Assumption Challenging'], true]) {
    expect(isCanonicalHandle(bad, CANON)).toBe(false)
  }
})

test('isCanonicalHandle: an unreadable canon accepts nothing', () => {
  for (const text of ['', 'not json', '{}', '[]', '{"framework_names":"x"}', '{"framework_names":[1,2]}']) {
    expect(isCanonicalHandle('Assumption Challenging', text)).toBe(false)
  }
})

test('isCanonicalHandle: it agrees with a canon entry that holds punctuation the charset allows', () => {
  expect(isCanonicalHandle("porter's five forces", CANON)).toBe(true)
  expect(isCanonicalHandle("Porter's Five Forces; DROP", CANON)).toBe(false)
})

// ---------------------------------------------------------------------------------------------
// textFromReply (pure)
// ---------------------------------------------------------------------------------------------

const textReply = (text: string, isError = false) => ({ content: [{ type: 'text', text }], isError })

test('textFromReply: the first text block is the text', () => {
  expect(textFromReply(textReply('# Assumptions\nA short note.'))).toEqual({ kind: 'ok', text: '# Assumptions\nA short note.' })
  expect(textFromReply({ content: [{ type: 'image' }, { type: 'text', text: 'second' }] })).toEqual({ kind: 'ok', text: 'second' })
})

test('textFromReply: the text is cut at 10,000 characters', () => {
  const out = textFromReply(textReply('y'.repeat(25000)))
  expect(out.kind).toBe('ok')
  if (out.kind === 'ok') expect(out.text).toHaveLength(10000)
})

test('textFromReply: an error reply, a reply with no text, a blank text and a non-object are all failed', () => {
  expect(textFromReply(textReply('boom', true))).toEqual({ kind: 'failed' })
  expect(textFromReply({ content: [] })).toEqual({ kind: 'failed' })
  expect(textFromReply({ content: [{ type: 'image' }] })).toEqual({ kind: 'failed' })
  expect(textFromReply(textReply('   \n'))).toEqual({ kind: 'failed' })
  for (const bad of [null, undefined, 'text', 7, [], {}]) expect(textFromReply(bad)).toEqual({ kind: 'failed' })
})

// ---------------------------------------------------------------------------------------------
// lookupGuidance (pure over act.guidance)
// ---------------------------------------------------------------------------------------------

type Answer = Awaited<ReturnType<Actions['guidance']>>

function guidanceAct(answer: Answer | 'throw'): { act: Pick<Actions, 'guidance'>; seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    act: {
      guidance: async (handle) => {
        seen.push(handle)
        if (answer === 'throw') throw new Error('closure down')
        return answer
      },
    },
  }
}

test('lookupGuidance: a reply with text is ok, and the closure got exactly the handle', async () => {
  const { act, seen } = guidanceAct({ kind: 'reply', reply: textReply('Some general guidance.') })
  expect(await lookupGuidance(act, 'Assumption Challenging')).toEqual({ kind: 'ok', text: 'Some general guidance.' })
  expect(seen).toEqual(['Assumption Challenging'])
})

test('lookupGuidance: a failed or throwing closure and an error reply are failed; a refusal stays refused', async () => {
  expect(await lookupGuidance(guidanceAct({ kind: 'failed' }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct('throw').act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct({ kind: 'reply', reply: textReply('x', true) }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
  expect(await lookupGuidance(guidanceAct({ kind: 'refused' }).act, 'jane@example.com')).toEqual({ kind: 'refused' })
})

test('lookupGuidance: a reply with no text is failed', async () => {
  expect(await lookupGuidance(guidanceAct({ kind: 'reply', reply: { content: [] } }).act, 'Assumption Challenging')).toEqual({ kind: 'failed' })
})

// ---------------------------------------------------------------------------------------------
// Task 2: the help model (pure)
// ---------------------------------------------------------------------------------------------

const WIDE_MODEL = fixtureFor('wide')
const TITLES = ['Grant terms for the funding case (sample)', 'Match requirements for the regional grant (sample)']

function vmWith(change: (m: ViewModel) => void): ViewModel {
  const m: ViewModel = JSON.parse(JSON.stringify(SAMPLES.wide)) as ViewModel
  change(m)
  return m
}

test('helpFor: Why this matters carries the recorded reason as its rationale; the other four kinds carry none', () => {
  const withReason = vmWith((m) => {
    m.next.reason = ok('Your funding choice rests on one grant window (sample)')
  })
  expect(helpFor('why', WIDE_MODEL, withReason, []).rationale).toBe('Your funding choice rests on one grant window (sample)')
  for (const kind of ['dig', 'connect', 'another', 'example'] as const) {
    expect(helpFor(kind, WIDE_MODEL, withReason, TITLES).rationale).toBeNull()
  }
  expect(helpFor('why', WIDE_MODEL, SAMPLES.wide, []).rationale).toBeNull()
})

test('helpFor: the point is the picked title, else the first drawn gap title, else none', () => {
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.wide, [TITLES[1] as string]).point).toBe(TITLES[1])
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.wide, []).point).toBe(TITLES[0])
  const noGaps: ThinkModel = { ...WIDE_MODEL, gaps: ok({ points: [], total: 0, more: 0 }) }
  expect(helpFor('dig', noGaps, SAMPLES.wide, []).point).toBeNull()
  expect(helpFor('another', { ...WIDE_MODEL, gaps: { state: 'unavailable' } }, SAMPLES.wide, []).point).toBeNull()
})

test('helpFor: with no point Why this matters falls back to the recorded step; the others do not', () => {
  const noGaps: ThinkModel = { ...WIDE_MODEL, gaps: ok({ points: [], total: 0, more: 0 }) }
  expect(helpFor('why', noGaps, SAMPLES.wide, []).point).toBe('look at the evidence behind your funding choice (sample)')
  expect(helpFor('example', noGaps, SAMPLES.wide, []).point).toBeNull()
  const noStep = vmWith((m) => {
    m.next.step = { state: 'not_recorded' }
  })
  expect(helpFor('why', noGaps, noStep, []).point).toBeNull()
})

test('helpFor: the handle is the recorded method name and nothing else; a missing, unavailable or blank method gives none', () => {
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.wide, TITLES).handle).toBe('Assumption Challenging')
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.missing, TITLES).handle).toBeNull()
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.noroom, TITLES).handle).toBeNull()
  const blank = vmWith((m) => {
    m.next.method = ok('   ')
  })
  expect(helpFor('dig', WIDE_MODEL, blank, TITLES).handle).toBeNull()
  // A room-like value in the method slot is passed on as the recorded value: the canon check, not helpFor, refuses it.
  const odd = vmWith((m) => {
    m.next.method = ok('jane.doe@example.com')
  })
  expect(helpFor('dig', WIDE_MODEL, odd, TITLES).handle).toBe('jane.doe@example.com')
})

test('helpFor: Connect needs two picks and names both titles', () => {
  expect(helpFor('connect', WIDE_MODEL, SAMPLES.wide, []).needsPicks).toBe(true)
  expect(helpFor('connect', WIDE_MODEL, SAMPLES.wide, [TITLES[0] as string]).needsPicks).toBe(true)
  const two = helpFor('connect', WIDE_MODEL, SAMPLES.wide, TITLES)
  expect(two.needsPicks).toBe(false)
  expect(two.titles).toEqual([TITLES[0], TITLES[1]])
  expect(helpFor('dig', WIDE_MODEL, SAMPLES.wide, []).needsPicks).toBe(false)
})

test('helpFor: it is pure over its inputs (nothing is read from the picks beyond titles)', () => {
  const before = JSON.stringify(SAMPLES.wide)
  helpFor('dig', WIDE_MODEL, SAMPLES.wide, TITLES)
  expect(JSON.stringify(SAMPLES.wide)).toBe(before)
})

test('isHelpState and readHelp: a well-formed slice narrows, a malformed key reads as absent', () => {
  expect(isHelpState({})).toBe(true)
  expect(isHelpState({ help: 'dig', lookup: { state: 'ok', text: 'x' } })).toBe(true)
  expect(isHelpState({ help: 'quiz' })).toBe(false)
  expect(isHelpState({ lookup: { state: 'ok' } })).toBe(false)
  expect(isHelpState(null)).toBe(false)
  expect(readHelp({ help: 'dig', lookup: { state: 'failed' }, canon: ['a', 1, 'b'] })).toEqual({ kind: 'dig', lookup: { state: 'failed' }, canon: ['a', 'b'] })
  expect(readHelp({ help: 'quiz', lookup: 7 })).toEqual({ kind: null, lookup: null, canon: [] })
  expect(HELP_KINDS).toEqual(['dig', 'connect', 'another', 'why', 'example'])
})

test('planFor: the lookup is offered only for a handle that is in the canon; a rationale hides P91; P92 follows the point', () => {
  const facts = helpFor('dig', WIDE_MODEL, SAMPLES.wide, [])
  const canon = CANON_LIST
  expect(planFor('dig', facts, canon, null)).toMatchObject({ showLookup: true, showP91: false, showHandoff: true, handle: 'Assumption Challenging' })
  expect(planFor('dig', facts, [], null)).toMatchObject({ showLookup: false, showP91: true, showHandoff: true, handle: null })
  expect(planFor('dig', { ...facts, handle: null, point: null }, canon, null)).toMatchObject({ showLookup: false, showP91: true, showHandoff: false })
  expect(planFor('why', { ...facts, rationale: 'Because.' }, canon, null)).toMatchObject({ showP91: false })
  expect(planFor('connect', helpFor('connect', WIDE_MODEL, SAMPLES.wide, []), canon, null)).toMatchObject({ needsPicks: true, showLookup: false, showHandoff: false, showP91: false })
  expect(planFor('dig', facts, canon, { state: 'loading' })).toMatchObject({ showLookup: false })
})

// ---------------------------------------------------------------------------------------------
// Task 2: the view (drawn by a test hook on a pane id the plugin does not claim, rule 11)
// ---------------------------------------------------------------------------------------------

const SHELL_ID = 'think-help-shell-test'
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
const CANON_LIST = ['assumption challenging']

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
      if (typeof rec.text === 'string') out.push(rec.text)
      grab(rec.children)
      grab(rec.props)
    }
  }
  grab(tree)
  return out.join('\n')
}

function buttonsOf(tree: unknown): Node[] {
  const out: Node[] = []
  walk(tree, (n) => {
    if (n.type === 'Button') out.push(n)
  })
  return out
}

const buttonKeys = (tree: unknown): string[] => buttonsOf(tree).map((b) => String(propsOf(b).key ?? b.key))

type Log = {
  calls: string[]
  patches: { tab: string; partial: Record<string, unknown> }[]
  fills: string[]
  toasts: string[]
  guided: string[]
}
const newLog = (): Log => ({ calls: [], patches: [], fills: [], toasts: [], guided: [] })

function shellAct(log: Log, answer: Awaited<ReturnType<Actions['guidance']>> = { kind: 'failed' }): ShellActions {
  return {
    setTab: async (tab) => {
      log.calls.push('setTab:' + tab)
    },
    fill: async (words) => {
      log.fills.push(words)
      return true
    },
    toast: (message) => {
      log.toasts.push(message)
    },
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
    io: {
      mcpCall: async () => {
        throw new Error('the help area must not call through io')
      },
      envGet: async () => undefined,
      cwd: async () => '/r',
      fsExists: async () => false,
      fsRead: async () => {
        throw new Error('no read')
      },
      usage: async () => ({}),
      now: async () => 0,
    },
    patch: async (tab, partial) => {
      log.patches.push({ tab, partial })
    },
    update: async () => {},
    refresh: async () => {},
    readAsset: async () => '',
    sampleName: async () => null,
    focus: async () => {},
    guidance: async (handle) => {
      log.guided.push(handle)
      return answer
    },
  }
}

function paneInput(over: Partial<PaneInput>): PaneInput {
  return {
    surface: 'terminal',
    tab: 'think',
    vm: SAMPLES.wide,
    mode: COLOR,
    theme: THEME,
    bodyColumns: 100,
    isFocused: true,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body: emptyBody(),
    act: shellAct(newLog()),
    ...over,
  }
}

const bodyWith = (think: Record<string, unknown>) => ({ ...emptyBody(), think })

type Pressers = Record<string, () => void>

// A body that draws the help area and captures each Button's onPress as it is drawn.
function helpBody(picks: readonly string[], pressers: Pressers, model: ThinkModel = WIDE_MODEL): TabBody {
  return {
    view: (ctx: TabContext) => {
      const { Box } = ctx.el
      const drawn: RenderElement = HelpActions(ctx, model, picks)
      walk(drawn, (n) => {
        if (n.type === 'Button' && typeof n.onPress === 'function') pressers[String(propsOf(n).key)] = n.onPress as () => void
      })
      return <Box flexDirection="column">{drawn}</Box>
    },
    keys: () => [],
    explainId: 'X02',
  }
}

const depsOf = (think: TabBody): PaneDeps => ({
  bodies: { room: undefined, think, sources: undefined, review: undefined },
})

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

const draw = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: SHELL_ID })

// Larry marks drawn as 2-cell colored boxes: the backgrounds found under a tree.
function backgrounds(tree: unknown): string[] {
  const out: string[] = []
  walk(tree, (n) => {
    // Only a drawn element counts (it has a type); its props object is not a second element.
    if (typeof n.type !== 'string') return
    const bg = n.backgroundColor ?? propsOf(n).backgroundColor
    if (typeof bg === 'string') out.push(bg)
  })
  return out
}

const withHandle = { model: WIDE_MODEL, canon: CANON_LIST }

test('idle: heading P80, five buttons P81 to P85 in order with hotkeys g c a w x and the lines P86 to P90, and no mark or result yet', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({ body: bodyWith(withHandle) }), deps: depsOf(helpBody([], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const area = await ui.find({ key: 'help:area' })
    const words = shown(area)
    expect(words).toContain(text('P80'))
    const buttons = buttonsOf(area)
    expect(buttons.map((b) => propsOf(b).label)).toEqual([text('P81'), text('P82'), text('P83'), text('P84'), text('P85')])
    expect(buttons.map((b) => propsOf(b).hotkey)).toEqual(['g', 'c', 'a', 'w', 'x'])
    expect(buttons.map((b) => propsOf(b).key)).toEqual(['help:dig', 'help:connect', 'help:another', 'help:why', 'help:example'])
    for (const id of ['P86', 'P87', 'P88', 'P89', 'P90'] as const) expect(words).toContain(text(id))
    expect(await ui.find({ key: 'help:result' })).toBeUndefined()
    expect(backgrounds(area)).toEqual([])
    await ui.unmount()
  }
})

test('idle: the method name is never on screen, and no quiz, score or either-or word exists', async ($, on) => {
  const cur = { input: paneInput({ body: bodyWith(withHandle) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const words = shown(await ui.find({ key: 'help:area' }))
  expect(words).not.toContain('Assumption Challenging')
  expect(words.toLowerCase()).not.toMatch(/quiz|score|grade|correct answer|which one/)
  await ui.unmount()
})

test('idle in plain mode: the same five buttons and no color property anywhere', async ($, on) => {
  const cur = { input: paneInput({ mode: PLAIN, theme: null, body: bodyWith({ ...withHandle, help: 'dig' }) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const area = await ui.find({ key: 'help:area' })
  expect(buttonKeys(area)).toContain('help:dig')
  expect(backgrounds(area)).toEqual([])
  const colors: string[] = []
  walk(area, (n) => {
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (k in n || k in propsOf(n)) colors.push(k)
  })
  expect(colors).toEqual([])
  await ui.unmount()
})

test('Dig selected, a handle in the canon and a point: the red L02 mark and word, P93 on l with P94, and P92 on t', async ($, on) => {
  const pressers: Pressers = {}
  const cur = { input: paneInput({ body: bodyWith({ ...withHandle, help: 'dig' }) }), deps: depsOf(helpBody([], pressers)) }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    const ui = await draw($, surface)
    const result = await ui.find({ key: 'help:result' })
    const words = shown(result)
    expect(words).toContain(text('L02'))
    expect(backgrounds(result)).toEqual([THEME.problem])
    expect(words).toContain(text('P94'))
    expect(words).not.toContain(text('P91'))
    const lookup = buttonsOf(result).find((b) => propsOf(b).key === 'help:lookup')
    expect(propsOf(lookup).label).toBe(text('P93'))
    expect(propsOf(lookup).hotkey).toBe('l')
    const handoff = buttonsOf(result).find((b) => propsOf(b).key === 'help:handoff')
    expect(propsOf(handoff).label).toBe(text('P92'))
    expect(propsOf(handoff).hotkey).toBe('t')
    await ui.unmount()
  }
})

test('Connect uses the blue L01 mark and Another way the yellow L03 mark; Why and Example draw no mark', async ($, on) => {
  const cur = { input: paneInput({}), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  const expectMark = async (kind: string, mark: 'L01' | 'L02' | 'L03' | null, color: string | null, picks: string[]) => {
    cur.input = paneInput({ body: bodyWith({ ...withHandle, help: kind }) })
    cur.deps = depsOf(helpBody(picks, {}))
    const ui = await draw($, 'terminal')
    const result = await ui.find({ key: 'help:result' })
    for (const id of ['L01', 'L02', 'L03'] as const) {
      if (id === mark) expect(shown(result)).toContain(text(id))
      else expect(shown(result)).not.toContain(text(id))
    }
    expect(backgrounds(result)).toEqual(color === null ? [] : [color])
    await ui.unmount()
  }
  await expectMark('connect', 'L01', THEME.where, TITLES)
  await expectMark('another', 'L03', THEME.yourMove, [])
  await expectMark('why', null, null, [])
  await expectMark('example', null, null, [])
})

test('with no handle and a point the area reads P91 and offers P92 only; with neither it reads P91 and nothing else', async ($, on) => {
  const noMethod = vmWith((m) => {
    m.next.method = { state: 'not_recorded' }
  })
  const noGaps: ThinkModel = { ...WIDE_MODEL, gaps: ok({ points: [], total: 0, more: 0 }) }
  const cur = { input: paneInput({ vm: noMethod, body: bodyWith({ model: WIDE_MODEL, canon: CANON_LIST, help: 'dig' }) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain(text('P91'))
  expect(buttonKeys(result)).toEqual(['help:handoff'])
  await ui.unmount()

  cur.deps = depsOf(helpBody([], {}, noGaps))
  ui = await draw($, 'terminal')
  result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain(text('P91'))
  expect(buttonKeys(result)).toEqual([])
  await ui.unmount()
})

test('no dead control: with no handle recorded, or a handle the canon does not hold, the P93 button is not drawn', async ($, on) => {
  const noMethod = vmWith((m) => {
    m.next.method = { state: 'not_recorded' }
  })
  const cur = { input: paneInput({ vm: noMethod, body: bodyWith({ ...withHandle, help: 'dig' }) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  expect(buttonKeys(await ui.find({ key: 'help:area' }))).not.toContain('help:lookup')
  await ui.unmount()

  const odd = vmWith((m) => {
    m.next.method = ok('Some Unlisted Framework')
  })
  cur.input = paneInput({ vm: odd, body: bodyWith({ ...withHandle, help: 'dig' }) })
  ui = await draw($, 'terminal')
  expect(buttonKeys(await ui.find({ key: 'help:area' }))).not.toContain('help:lookup')
  await ui.unmount()

  cur.input = paneInput({ body: bodyWith({ model: WIDE_MODEL, help: 'dig' }) })
  ui = await draw($, 'terminal')
  expect(buttonKeys(await ui.find({ key: 'help:area' }))).not.toContain('help:lookup')
  await ui.unmount()
})

test('Connect with fewer than two picks says P97 and offers nothing else; with two it offers P92 and P93', async ($, on) => {
  const cur = { input: paneInput({ body: bodyWith({ ...withHandle, help: 'connect' }) }), deps: depsOf(helpBody([TITLES[0] as string], {})) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain(text('P97'))
  expect(buttonKeys(result)).toEqual([])
  await ui.unmount()

  cur.deps = depsOf(helpBody(TITLES, {}))
  ui = await draw($, 'terminal')
  result = await ui.find({ key: 'help:result' })
  expect(shown(result)).not.toContain(text('P97'))
  expect(buttonKeys(result)).toEqual(['help:lookup', 'help:handoff'])
  await ui.unmount()
})

test('Why this matters with a recorded reason shows that reason as data and no P91', async ($, on) => {
  const withReason = vmWith((m) => {
    m.next.reason = ok('Your funding choice rests on one grant window (sample)')
  })
  const cur = { input: paneInput({ vm: withReason, body: bodyWith({ ...withHandle, help: 'why' }) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain('Your funding choice rests on one grant window (sample)')
  expect(shown(result)).not.toContain(text('P91'))
  await ui.unmount()
})

test('lookup states: loading hides P93, ok shows P95 and the text as Markdown, failed shows P96', async ($, on) => {
  const base = { ...withHandle, help: 'dig' }
  const cur = { input: paneInput({ body: bodyWith({ ...base, lookup: { state: 'loading' } }) }), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  let ui = await draw($, 'terminal')
  let result = await ui.find({ key: 'help:result' })
  expect(buttonKeys(result)).not.toContain('help:lookup')
  await ui.unmount()

  cur.input = paneInput({ body: bodyWith({ ...base, lookup: { state: 'ok', text: '# Assumptions\nTest the thing under the thing.' } }) })
  ui = await draw($, 'terminal')
  result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain(text('P95'))
  expect(shown(result)).toContain('Test the thing under the thing.')
  const markdown = await ui.find({ key: 'help:lookup-text' })
  expect(markdown?.type).toBe('Markdown')
  await ui.unmount()

  cur.input = paneInput({ body: bodyWith({ ...base, lookup: { state: 'failed' } }) })
  ui = await draw($, 'terminal')
  result = await ui.find({ key: 'help:result' })
  expect(shown(result)).toContain(text('P96'))
  expect(shown(result)).not.toContain(text('P95'))
  await ui.unmount()
})

test('a lookup result is never drawn longer than 10,000 characters', async ($, on) => {
  const cur = {
    input: paneInput({ body: bodyWith({ ...withHandle, help: 'dig', lookup: { state: 'ok', text: 'z'.repeat(30000) } }) }),
    deps: depsOf(helpBody([], {})),
  }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  const markdown = await ui.find({ key: 'help:lookup-text' })
  expect(String(markdown?.props.text).length).toBeLessThanOrEqual(10000)
  await ui.unmount()
})

// ---------------------------------------------------------------------------------------------
// Task 2: presses
// ---------------------------------------------------------------------------------------------

test('pressing a kind selects it and clears the lookup; pressing it again closes the area', async () => {
  const log = newLog()
  const act = shellAct(log)
  await selectKind(act, null, 'dig')
  await selectKind(act, 'dig', 'dig')
  await selectKind(act, 'dig', 'why')
  expect(log.patches).toEqual([
    { tab: 'think', partial: { help: 'dig', lookup: undefined } },
    { tab: 'think', partial: { help: undefined, lookup: undefined } },
    { tab: 'think', partial: { help: 'why', lookup: undefined } },
  ])
})

test('the kind buttons run selectKind through the view (a press on each of the five)', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = { input: paneInput({ act: shellAct(log), body: bodyWith(withHandle) }), deps: depsOf(helpBody([], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  for (const kind of HELP_KINDS) pressers['help:' + kind]?.()
  await ui.unmount()
  expect(log.patches.map((p) => p.partial.help)).toEqual([...HELP_KINDS])
})

test('pressing P93 writes loading then ok with the text; a failed or refused answer writes failed; only the handle is passed to the closure', async () => {
  const okLog = newLog()
  await runLookup(shellAct(okLog, { kind: 'reply', reply: { content: [{ type: 'text', text: 'General guidance.' }], isError: false } }), 'Assumption Challenging')
  expect(okLog.patches.map((p) => p.partial.lookup)).toEqual([{ state: 'loading' }, { state: 'ok', text: 'General guidance.' }])
  expect(okLog.guided).toEqual(['Assumption Challenging'])

  for (const answer of [{ kind: 'failed' }, { kind: 'refused' }] as const) {
    const log = newLog()
    await runLookup(shellAct(log, answer), 'Assumption Challenging')
    expect(log.patches.map((p) => p.partial.lookup)).toEqual([{ state: 'loading' }, { state: 'failed' }])
  }
})

test('pressing P93 in the view passes the recorded handle, and only it, to act.guidance', async ($, on) => {
  const log = newLog()
  const pressers: Pressers = {}
  const cur = { input: paneInput({ act: shellAct(log), body: bodyWith({ ...withHandle, help: 'dig' }) }), deps: depsOf(helpBody([], pressers)) }
  shellHook(on, cur)
  const ui = await draw($, 'terminal')
  pressers['help:lookup']?.()
  await ui.unmount()
  await Promise.resolve()
  await Promise.resolve()
  expect(log.guided).toEqual(['Assumption Challenging'])
})

test('hand-off: P92 fills the prompt with Q02 (Dig), Q03 (Connect, both titles), Q04 (Another way), Q05 (Why, Example); it never submits', async ($, on) => {
  const cases: { kind: string; picks: string[]; want: string }[] = [
    { kind: 'dig', picks: [], want: text('Q02', { point: TITLES[0] as string }) },
    { kind: 'connect', picks: TITLES, want: text('Q03', { a: TITLES[0] as string, b: TITLES[1] as string }) },
    { kind: 'another', picks: [TITLES[1] as string], want: text('Q04', { point: TITLES[1] as string }) },
    { kind: 'why', picks: [], want: text('Q05', { point: TITLES[0] as string }) },
    { kind: 'example', picks: [], want: text('Q05', { point: TITLES[0] as string }) },
  ]
  const cur = { input: paneInput({}), deps: depsOf(helpBody([], {})) }
  shellHook(on, cur)
  for (const c of cases) {
    const log = newLog()
    const pressers: Pressers = {}
    cur.input = paneInput({ act: shellAct(log), body: bodyWith({ ...withHandle, help: c.kind }) })
    cur.deps = depsOf(helpBody(c.picks, pressers))
    const ui = await draw($, 'terminal')
    pressers['help:handoff']?.()
    await ui.unmount()
    await Promise.resolve()
    await Promise.resolve()
    expect(log.fills).toEqual([c.want])
    expect(log.toasts).toEqual([text('P34')])
  }
})

test('keys: g, w, a lead and c, x follow; l and t appear only while drawn', () => {
  const ctxOf = (think: Record<string, unknown>, vm: ViewModel = SAMPLES.wide): TabContext =>
    ({ vm, body: bodyWith(think), mode: COLOR, theme: THEME }) as unknown as TabContext
  const idle = helpKeyList(ctxOf(withHandle), WIDE_MODEL, [])
  expect(idle.lead.map((k) => k.key)).toEqual(['g', 'w', 'a'])
  expect(idle.rest.map((k) => k.key)).toEqual(['c', 'x'])
  expect(idle.lead.map((k) => k.labelId)).toEqual(['H08', 'H11', 'H10'])
  expect(idle.rest.map((k) => k.labelId)).toEqual(['H09', 'H12'])
  const dig = helpKeyList(ctxOf({ ...withHandle, help: 'dig' }), WIDE_MODEL, [])
  expect(dig.rest.map((k) => k.key)).toEqual(['c', 'x', 'l', 't'])
  expect(dig.rest.map((k) => k.labelId)).toEqual(['H09', 'H12', 'H13', 'H14'])
  const noHandle = helpKeyList(ctxOf({ model: WIDE_MODEL, canon: CANON_LIST, help: 'dig' }, SAMPLES.missing), WIDE_MODEL, [])
  expect(noHandle.rest.map((k) => k.key)).toEqual(['c', 'x', 't'])
  const needsPicks = helpKeyList(ctxOf({ ...withHandle, help: 'connect' }), WIDE_MODEL, [])
  expect(needsPicks.rest.map((k) => k.key)).toEqual(['c', 'x'])
})

// ---------------------------------------------------------------------------------------------
// Task 3: the help area in the real Think body, on the real pane id. The real registrar draws the
// pane; what sits beneath the plugin (env, store, fs, the Mindrian OS server, the Brain server,
// the prompt box) is answered here, and every Brain call is recorded.
// ---------------------------------------------------------------------------------------------

type McpCall = { server: string; tool: string; args: unknown }
type Beneath = { mcp: McpCall[]; fills: string[]; toasts: string[] }
type Wire = { canon?: string[]; brainFails?: boolean }

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

function wireReal(on: On, env: Record<string, string>, over: Wire = {}): Beneath {
  const beneath: Beneath = { mcp: [], fills: [], toasts: [] }
  const canonText = JSON.stringify({ framework_names: over.canon ?? ['Assumption Challenging', 'Dominant Design'] })
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE_TEXT }
    if (e.path.endsWith('framework-names.json')) return { value: canonText }
    return { value: '{"status":"sound","at":1}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    beneath.mcp.push({ server: e.server, tool: e.tool, args: e.args })
    if (e.server === BRAIN_SERVER) {
      if (over.brainFails === true) throw new Error('brain down')
      return { value: { content: [{ type: 'text', text: '## What to test\nTest the assumption under the claim.' }], isError: false } }
    }
    return { value: { content: [{ type: 'text', text: JSON.stringify({ ok: true, count: 0, gates: [] }) }], isError: false } }
  })
  on('prompt.fill', (_$, e) => {
    beneath.fills.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', (_$, e) => {
    beneath.toasts.push(String(e.message))
    return { value: undefined }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  return beneath
}

const mountReal = ($: Engine, surface: Surface, columns = 100) =>
  $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS(columns), requestId: PANE_ID })

type Mounted = Awaited<ReturnType<typeof mountReal>>

async function activeTab(ui: Mounted): Promise<string | undefined> {
  for (const id of ['room', 'think', 'sources', 'review']) {
    const b = await ui.find({ type: 'Button', key: `tab:${id}` })
    if (b?.props.variant === 'primary') return id
  }
  return undefined
}

// Waits (in engine turns, never in time) until a keyed element is drawn.
async function drawn(ui: Mounted, key: string) {
  for (let i = 0; i < 40; i += 1) {
    const found = await ui.find({ key })
    if (found !== undefined) return found
  }
  return undefined
}

async function openThink(ui: Mounted): Promise<void> {
  await ui.press({ key: 'tab:think' })
  expect(await activeTab(ui)).toBe('think')
}

async function backToRoom(ui: Mounted): Promise<void> {
  await ui.press({ key: 'tab:room' })
  expect(await activeTab(ui)).toBe('room')
}

const brainCalls = (b: Beneath): McpCall[] => b.mcp.filter((c) => c.server === BRAIN_SERVER)

test('thinkBody keys: g, w, a, v then c, x, then l and t only while drawn', () => {
  const ctxOf = (think: Record<string, unknown>, vm: ViewModel = SAMPLES.wide): TabContext =>
    ({ vm, body: bodyWith(think), mode: COLOR, theme: THEME }) as unknown as TabContext
  const idle = thinkBody.keys(ctxOf({ model: WIDE_MODEL, canon: CANON_LIST }))
  expect(idle.map((k) => k.key)).toEqual(['g', 'w', 'a', 'v', 'c', 'x'])
  expect(idle.map((k) => k.labelId)).toEqual(['H08', 'H11', 'H10', 'H17', 'H09', 'H12'])
  const dig = thinkBody.keys(ctxOf({ model: WIDE_MODEL, canon: CANON_LIST, help: 'dig' }))
  expect(dig.map((k) => k.key)).toEqual(['g', 'w', 'a', 'v', 'c', 'x', 'l', 't'])
  expect(dig.map((k) => k.labelId)).toEqual(['H08', 'H11', 'H10', 'H17', 'H09', 'H12', 'H13', 'H14'])
  // No evidence button (missing model): v is left out and the three help keys still lead.
  const missing = thinkBody.keys(ctxOf({ model: fixtureFor('missing') }, SAMPLES.missing))
  expect(missing.map((k) => k.key)).toEqual(['g', 'w', 'a', 'c', 'x'])
})

test('thinkBody keys: no data room bound draws no key; a missing model draws none', () => {
  const none = (vm: ViewModel, think: Record<string, unknown>) =>
    thinkBody.keys({ vm, body: bodyWith(think), mode: COLOR, theme: THEME } as unknown as TabContext)
  expect(none(SAMPLES.noroom, { model: WIDE_MODEL })).toEqual([])
  expect(none(SAMPLES.wide, {})).toEqual([])
})

test('the real pane at Think: the hint line shows g, w, a, v then Help and Esc; the all-keys panel lists every drawn key', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  for (const surface of SURFACES) {
    const ui = await mountReal($, surface, 140)
    await openThink(ui)
    await drawn(ui, 'help:area')
    const hint = shown(await ui.find({ key: 'hint-line' }))
    for (const [key, id] of [['g', 'H08'], ['w', 'H11'], ['a', 'H10'], ['v', 'H17']] as const) expect(hint).toContain(key + ': ' + text(id))
    expect(hint).not.toContain('c: ' + text('H09'))
    expect(hint).not.toContain('x: ' + text('H12'))
    expect(hint).toContain('Esc')
    await ui.press({ key: 'help' })
    const panel = shown(await drawn(ui, 'keys-panel'))
    for (const [key, id] of [['g', 'H08'], ['w', 'H11'], ['a', 'H10'], ['v', 'H17'], ['c', 'H09'], ['x', 'H12']] as const) {
      expect(panel).toContain(key + ': ' + text(id))
    }
    await ui.press({ key: 'help' })
    await backToRoom(ui)
    await ui.unmount()
  }
})

test('the real pane at Think: the default view has at most 5 element groups and 8 buttons of its own with no help result showing', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  const body = await drawn(ui, 'help:area').then(() => ui.find({ key: 'think:body' }))
  const keys = buttonKeys(body)
  const children = Array.isArray(body?.children) ? (body?.children as unknown[]).length : -1
  expect(keys.length).toBeLessThanOrEqual(8)
  expect(children).toBeLessThanOrEqual(5)
  expect(await ui.find({ key: 'help:result' })).toBeUndefined()
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: Dig then P93 sends exactly { framework: <recorded method> } to the Brain server and shows the result under P95', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:dig' })
  expect(shown(await drawn(ui, 'help:result'))).toContain(text('L02'))
  const button = await drawn(ui, 'help:lookup')
  expect(button?.props.label).toBe(text('P93'))
  expect(brainCalls(beneath)).toEqual([])
  await ui.press({ key: 'help:lookup' })
  const markdown = await drawn(ui, 'help:lookup-text')
  expect(String(markdown?.props.text)).toContain('Test the assumption under the claim.')
  expect(shown(await ui.find({ key: 'help:result' }))).toContain(text('P95'))
  expect(brainCalls(beneath)).toEqual([{ server: BRAIN_SERVER, tool: 'framework_techniques', args: { framework: 'Assumption Challenging' } }])
  // Nothing from the data room is in any call, and the only calls were this one.
  expect(JSON.stringify(beneath.mcp)).not.toContain('Grant terms')
  expect(JSON.stringify(beneath.mcp)).not.toContain('funding')
  await ui.press({ key: 'help:dig' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: a Brain failure reads P96 and states nothing was sent from the data room', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, { brainFails: true })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:dig' })
  await drawn(ui, 'help:lookup')
  await ui.press({ key: 'help:lookup' })
  const failed = await drawn(ui, 'help:lookup-failed')
  expect(shown(failed)).toContain(text('P96'))
  expect(await ui.find({ key: 'help:lookup-text' })).toBeUndefined()
  expect(brainCalls(beneath)).toHaveLength(1)
  await ui.press({ key: 'help:dig' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: when the recorded method is not in the canon the P93 button is never drawn and no Brain call is made', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' }, { canon: ['Dominant Design'] })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:dig' })
  const result = await drawn(ui, 'help:result')
  expect(shown(result)).toContain(text('P91'))
  expect(buttonKeys(result)).toEqual(['help:handoff'])
  expect(brainCalls(beneath)).toEqual([])
  await ui.press({ key: 'help:dig' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: the hand-off fills the prompt box with the point (never submits), toast P34, and makes no Brain call', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:dig' })
  await ui.press({ key: 'help:handoff' })
  expect(beneath.fills).toEqual([text('Q02', { point: 'Grant terms for the funding case (sample)' })])
  expect(beneath.toasts).toContain(text('P34'))
  expect(brainCalls(beneath)).toEqual([])
  await ui.press({ key: 'help:dig' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: Connect says P97 until two gap titles are picked, then the hand-off names both', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:connect' })
  expect(shown(await drawn(ui, 'help:result'))).toContain(text('P97'))
  expect(buttonKeys(await ui.find({ key: 'help:result' }))).toEqual([])
  await ui.press({ key: 'pick:0' })
  expect(shown(await ui.find({ key: 'help:result' }))).toContain(text('P97'))
  await ui.press({ key: 'pick:1' })
  const result = await ui.find({ key: 'help:result' })
  expect(shown(result)).not.toContain(text('P97'))
  await ui.press({ key: 'help:handoff' })
  expect(beneath.fills).toEqual([
    text('Q03', { a: 'Grant terms for the funding case (sample)', b: 'Match requirements for the regional grant (sample)' }),
  ])
  await ui.press({ key: 'help:connect' })
  await ui.press({ key: 'pick:0' })
  await ui.press({ key: 'pick:1' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: picking a gap title makes it the point for Dig', async ($, on) => {
  const beneath = wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'pick:1' })
  await ui.press({ key: 'help:dig' })
  await ui.press({ key: 'help:handoff' })
  expect(beneath.fills).toEqual([text('Q02', { point: 'Match requirements for the regional grant (sample)' })])
  await ui.press({ key: 'help:dig' })
  await ui.press({ key: 'pick:1' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: selecting another kind forgets the lookup text, and the missing sample offers no lookup (no recorded method)', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'wide' })
  const ui = await mountReal($, 'terminal')
  await openThink(ui)
  await drawn(ui, 'help:area')
  await ui.press({ key: 'help:dig' })
  await drawn(ui, 'help:lookup')
  await ui.press({ key: 'help:lookup' })
  await drawn(ui, 'help:lookup-text')
  await ui.press({ key: 'help:another' })
  expect(await ui.find({ key: 'help:lookup-text' })).toBeUndefined()
  expect(shown(await ui.find({ key: 'help:result' }))).toContain(text('L03'))
  await ui.press({ key: 'help:another' })
  await backToRoom(ui)
  await ui.unmount()
})

test('the real pane: with the missing sample (no recorded method) no P93 button is drawn on any surface', async ($, on) => {
  wireReal(on, { MOS_WORKSPACE_SAMPLE: 'missing' })
  for (const surface of SURFACES) {
    const ui = await mountReal($, surface)
    await openThink(ui)
    await drawn(ui, 'help:area')
    await ui.press({ key: 'help:dig' })
    expect(buttonKeys(await ui.find({ key: 'help:area' }))).not.toContain('help:lookup')
    await ui.press({ key: 'help:dig' })
    await backToRoom(ui)
    await ui.unmount()
  }
})
