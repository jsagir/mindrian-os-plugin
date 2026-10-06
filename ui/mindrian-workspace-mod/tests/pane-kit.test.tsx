// Plan 11 task 1: the shared pane body kit (369.26-ENGINE-RULES.md, "Pane body recipe").
//
// A tab body is an imported file, so it can take neither `$` nor an atom. It gets plain values in
// (`ctx.body`, `ctx.detailsOpen`) and closures out (`ctx.act`: patch, update, io, refresh,
// readAsset, sampleName, focus). Two layers of proof here:
//  - the PURE half (src/pane/kit.ts) is tested directly;
//  - the SHELL (buildPane) hands a body its slice values and the kit closures, tested with a
//    recording act on a pane id the plugin does not claim (engine rule 11).
// The closures themselves (patch, update, io, refresh, readAsset, sampleName, focus) are built in
// the hook file and need a hook's `$`, which a test hook cannot lend them (the engine lists only the
// calls the plugin's own module makes). They run under the real engine through the Room body in
// tests/room-tab.test.tsx, and through tests/test-369.26-body-kit.cjs (a scratch copy of the mod).
import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { allowedServer, asBody, emptyBody, isAssetName, mergeBody, replaceBody } from '../src/pane/kit'
import type { BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import type { Actions, ShellActions, TabBody, TabContext } from '../src/pane/types'
import { BRAIN_SERVER, MINDRIAN_SERVER, PLUGIN_NAME, TAB_IDS } from '../src/runtime/ids'
import { INITIAL } from '../src/state/atoms'
import { SAMPLES } from '../src/model/fixtures'

// ---------------------------------------------------------------------------------------------
// The pure half
// ---------------------------------------------------------------------------------------------

test('mergeBody merges into the named tab, leaves the other tabs alone and never mutates its input', () => {
  const start: BodyState = {
    room: { actionsOpen: true },
    think: { picks: ['a'] },
    sources: {},
    review: { phase: { g1: 'saving' } },
  }
  const before = JSON.stringify(start)
  const next = mergeBody(start, 'think', { model: { x: 1 }, picks: [] })
  expect(next.think).toEqual({ model: { x: 1 }, picks: [] })
  expect(next.room).toBe(start.room)
  expect(next.sources).toBe(start.sources)
  expect(next.review).toBe(start.review)
  expect(next).not.toBe(start)
  expect(JSON.stringify(start)).toBe(before)
  // A later patch to the same key wins; a key the patch does not name stays.
  expect(mergeBody(next, 'think', { picks: ['b'] }).think).toEqual({ model: { x: 1 }, picks: ['b'] })
})

test('mergeBody: an undefined value removes the key, so a slice stays plain JSON; replaceBody swaps one slice', () => {
  const start = mergeBody(emptyBody(), 'sources', { reading: { path: 'a' }, rows: [1] })
  const cleared = mergeBody(start, 'sources', { reading: undefined })
  expect(Object.keys(cleared.sources)).toEqual(['rows'])
  expect('reading' in cleared.sources).toBe(false)
  const swapped = replaceBody(start, 'sources', { only: true })
  expect(swapped.sources).toEqual({ only: true })
  expect(swapped.room).toBe(start.room)
})

test('emptyBody is one empty record per tab, equals INITIAL.body, and asBody repairs a stored value', () => {
  expect(Object.keys(emptyBody()).sort()).toEqual([...TAB_IDS].sort())
  for (const tab of TAB_IDS) expect(emptyBody()[tab]).toEqual({})
  expect(INITIAL.body).toEqual(emptyBody())
  // Two calls never share a slice object (a body writing into one must not change the other).
  expect(emptyBody().room).not.toBe(emptyBody().room)
  // A value that is not a body, or one missing a tab, reads as empty slices for what is missing.
  expect(asBody(null)).toEqual(emptyBody())
  expect(asBody('x')).toEqual(emptyBody())
  expect(asBody({ room: { a: 1 }, think: 'broken' })).toEqual({ ...emptyBody(), room: { a: 1 } })
})

test('allowedServer is true only for the Mindrian OS server, never the Brain', () => {
  expect(allowedServer(MINDRIAN_SERVER)).toBe(true)
  expect(allowedServer(BRAIN_SERVER)).toBe(false)
  for (const s of ['', 'mindrian-brain', 'theo', 'plugin:mos:mindrian-os ', 'PLUGIN:MOS:MINDRIAN-OS', 'plugin:mos:mindrian-os/x']) {
    expect(allowedServer(s)).toBe(false)
  }
})

test('isAssetName accepts a bare file name only', () => {
  for (const ok of ['command-registry.json', 'section-job-canon.json', 'framework-names.json', 'a.json', 'A_b-1.txt']) {
    expect(isAssetName(ok)).toBe(true)
  }
})

test('isAssetName refuses empty, a slash either way, dot names and parent steps', () => {
  for (const bad of ['', 'a/b', '..', '../x', 'a\\b', '.', '.hidden', 'a..b', '/etc/passwd', 'C:\\x', 'a b', 'a\u0000b', 'x/']) {
    expect(isAssetName(bad)).toBe(false)
  }
})

// ---------------------------------------------------------------------------------------------
// The shell hands a body its values and the kit closures
// ---------------------------------------------------------------------------------------------

const SHELL_ID = 'pane-kit-shell-test'
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof SURFACES)[number]

const NONE_OPEN = { room: false, think: false, sources: false, review: false }

// A recording act: every closure of the kit is a recorder, no `$` anywhere.
function recordingAct(log: string[]): ShellActions {
  const act: ShellActions = {
    setTab: async (tab) => {
      log.push('setTab:' + tab)
    },
    fill: async () => true,
    toast: () => {},
    toggleKeys: async () => {},
    toggleExplain: async () => {},
    toggleDetails: async () => {},
    io: {
      mcpCall: async () => ({}),
      envGet: async () => undefined,
      cwd: async () => '/r',
      fsExists: async () => false,
      fsRead: async () => '',
      usage: async () => ({}),
      now: async () => 0,
    },
    patch: async (tab, partial) => {
      log.push('patch:' + tab + ':' + JSON.stringify(partial))
    },
    update: async (tab, fn) => {
      log.push('update:' + tab + ':' + JSON.stringify(fn({ n: 1 })))
    },
    refresh: async () => {
      log.push('refresh')
    },
    readAsset: async (name) => 'asset:' + name,
    sampleName: async () => null,
    guidance: async () => ({ kind: 'refused' }),
    focus: async (key) => {
      log.push('focus:' + key)
    },
  }
  return act
}

const THEME_PALETTE = null

function input(over: Partial<PaneInput>): PaneInput {
  return {
    surface: 'terminal',
    tab: 'room',
    vm: SAMPLES.wide,
    mode: { plain: true, note: 'N01', theme: THEME_PALETTE },
    theme: null,
    bodyColumns: 100,
    isFocused: true,
    working: false,
    keysOpen: false,
    explainOpen: false,
    detailsOpen: NONE_OPEN,
    body: emptyBody(),
    act: recordingAct([]),
    ...over,
  }
}

function capturingBody(seen: TabContext[]): TabBody {
  return {
    view: (ctx) => {
      seen.push(ctx)
      const { Text } = ctx.el
      return <Text>body</Text>
    },
    keys: () => [],
    explainId: 'X01',
  }
}

function shellHook(on: On, cur: { input: PaneInput; deps: PaneDeps }): void {
  on('ui.render', { component: 'Pane', requestId: SHELL_ID }, ($, e) =>
    buildPane($.ui.resolve(e), { ...cur.input, surface: e.surface as Surface }, cur.deps),
  )
}

const PANE_PROPS = {
  title: 'Mindrian workspace',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

test('shell: a body receives the whole body record and the details flag of its own tab on every surface', async ($, on) => {
  const seen: TabContext[] = []
  const body: BodyState = {
    room: { actionsOpen: true },
    think: { model: { u: 'x' } },
    sources: { rows: [] },
    review: { phase: {} },
  }
  const deps: PaneDeps = {
    bodies: { room: capturingBody(seen), think: capturingBody(seen), sources: capturingBody(seen), review: capturingBody(seen) },
  }
  const cur = { input: input({ body }), deps }
  shellHook(on, cur)
  for (const surface of SURFACES) {
    for (const tab of TAB_IDS) {
      seen.length = 0
      cur.input = input({ tab, body, detailsOpen: { ...NONE_OPEN, [tab]: true } })
      const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS, requestId: SHELL_ID })
      expect(seen.length).toBeGreaterThan(0)
      const ctx = seen[seen.length - 1] as TabContext
      expect(ctx.tab).toBe(tab)
      expect(ctx.body).toBe(body)
      expect(ctx.detailsOpen).toBe(true)
      await ui.unmount()

      // Another tab's flag does not leak into this tab's view.
      seen.length = 0
      const other = TAB_IDS.find((t) => t !== tab) as (typeof TAB_IDS)[number]
      cur.input = input({ tab, body, detailsOpen: { ...NONE_OPEN, [other]: true } })
      const again = await $.ui.mount({ plugin: PLUGIN_NAME, surface, component: 'Pane', props: PANE_PROPS, requestId: SHELL_ID })
      expect((seen[seen.length - 1] as TabContext).detailsOpen).toBe(false)
      await again.unmount()
    }
  }
})

test('shell: the act a body gets is the kit and offers patch and update as the only ways to write body state', async ($, on) => {
  const seen: TabContext[] = []
  const log: string[] = []
  const act = recordingAct(log)
  const deps: PaneDeps = { bodies: { room: capturingBody(seen), think: undefined, sources: undefined, review: undefined } }
  const cur = { input: input({ act }), deps }
  shellHook(on, cur)
  const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: SHELL_ID })
  const given: Actions = (seen[seen.length - 1] as TabContext).act
  // The same closures, unwrapped: a body writes through exactly what the hook file built.
  expect(given).toBe(act)
  const names = Object.keys(given).sort()
  for (const kit of ['focus', 'io', 'patch', 'readAsset', 'refresh', 'sampleName', 'update']) expect(names).toContain(kit)
  // No `$`, no state noun, no store, no raw write: the write surface is patch and update.
  expect(names.filter((n) => ['state', 'store', 'set', 'write', 'body', '$'].includes(n))).toEqual([])
  await given.patch('think', { picks: ['a'] })
  await given.update('think', (slice) => ({ ...slice, n: 2 }))
  expect(log).toEqual(['patch:think:{"picks":["a"]}', 'update:think:{"n":2}'])
  await ui.unmount()
})

test('shell: with no model yet the shell draws only its frame and never calls a body', async ($, on) => {
  const seen: TabContext[] = []
  const deps: PaneDeps = { bodies: { room: capturingBody(seen), think: undefined, sources: undefined, review: undefined } }
  const cur = { input: input({ vm: null }), deps }
  shellHook(on, cur)
  const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: SHELL_ID })
  expect(seen).toEqual([])
  await ui.unmount()
})
