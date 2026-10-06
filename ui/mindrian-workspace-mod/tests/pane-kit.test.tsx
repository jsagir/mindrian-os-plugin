// Plan 11 task 1: the shared pane body kit (369.26-ENGINE-RULES.md, "Pane body recipe").
//
// A tab body is an imported file, so it can take neither `$` nor an atom. It gets plain values in
// (`ctx.body`, `ctx.detailsOpen`) and closures out (`ctx.act`: patch, update, io, refresh,
// readAsset, sampleName, focus). Three layers of proof:
//  - the PURE half (src/pane/kit.ts) is tested directly;
//  - the SHELL (buildPane) hands a body its slice values and the kit closures, tested with a
//    recording act on a pane id the plugin does not claim (engine rule 11);
//  - the CLOSURES (makeAct, makeIo in the hook file) run under the real engine from a test command
//    hook, with the state, mcp, fs and session nouns answered beneath the plugin (engine rule 5).
import type { On } from 'claude-code'
import { read } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { isViewModel } from '../src/model/view-model'
import { allowedServer, asBody, emptyBody, isAssetName, mergeBody, replaceBody } from '../src/pane/kit'
import type { BodyState } from '../src/pane/kit'
import { buildPane } from '../src/pane/pane'
import type { PaneDeps, PaneInput } from '../src/pane/pane'
import type { Actions, ShellActions, TabBody, TabContext } from '../src/pane/types'
import { makeAct, makeIo } from '../src/registrars/pane'
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
  const writers = names.filter((n) => /^(set|write|put|store|state|\$)/.test(n))
  expect(writers).toEqual([])
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

// ---------------------------------------------------------------------------------------------
// The closures under the real engine (makeAct and makeIo, the hook file's own functions)
// ---------------------------------------------------------------------------------------------

const BODY_REF = { plugin: 'mindrian-workspace', key: 'body' } as const
const VIEW_MODEL_REF = { plugin: 'mindrian-workspace', key: 'viewModel' } as const

type Beneath = {
  state: Map<string, unknown>
  versions: Map<string, number>
  mcp: { server: string; tool: string; args: unknown }[]
  reads: string[]
  focused: string[]
}

// What sits beneath the plugin: a small state store (get and set with versions, so `update` works),
// the mcp, fs, session and environment nouns, and ui.focus.
function wireBeneath(on: On, over: { files?: Record<string, string>; env?: Record<string, string> } = {}): Beneath {
  const b: Beneath = { state: new Map(), versions: new Map(), mcp: [], reads: [], focused: [] }
  mock.env(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p', ...(over.env ?? {}) })
  mock.clock(on, { now: 1760000000000 })
  on('state.get', ($$, e) => ({ value: { value: b.state.get(e.key), version: b.versions.get(e.key) ?? 0 } }))
  on('state.set', ($$, e) => {
    b.state.set(e.key, e.value)
    const v = (b.versions.get(e.key) ?? 0) + 1
    b.versions.set(e.key, v)
    return { value: { isSet: true, version: v } }
  })
  on('mcp.call', ($$, e) => {
    b.mcp.push({ server: e.server, tool: e.tool, args: e.args })
    const data =
      e.tool === 'gate_list'
        ? { ok: true, room: 'a', count: 0, gates: [] }
        : { ok: true, segments: { room_binding: { bound: true, source: 'session', registry_fallback: false, slug: 'a' } } }
    return { value: { content: [{ type: 'text', text: JSON.stringify(data) }], isError: false } }
  })
  on('session.cwd', () => ({ value: '/r/a/03_funding' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 40 }, rateLimits: [] } }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', ($$, e) => {
    b.reads.push(e.path)
    const hit = Object.entries(over.files ?? {}).find(([name]) => e.path.endsWith(name))
    if (hit !== undefined) return { value: hit[1] }
    return { value: e.path.endsWith('ROOM.md') ? '---\npurpose: Funding routes\n---\n' : '{"status":"sound","at":1}' }
  })
  on('ui.focus', ($$, e) => {
    b.focused.push(e.key)
    return { value: { isFocused: true } }
  })
  return b
}

type Probe = (act: Actions, $: Parameters<Parameters<On>[1]>[0]) => Promise<unknown>

// Runs `probe` inside a command hook of the test's own (the closures need a hook's `$`), and
// returns what it resolved or the message it threw.
function probeCommand(on: On, probe: Probe, out: { value: unknown; error: string | null }): void {
  on('command.run', { command: 'kit-probe' }, async ($, e) => {
    const act = makeAct($, () => 'tab:room')
    try {
      out.value = await probe(act, $ as never)
      out.error = null
    } catch (error) {
      out.error = error instanceof Error ? error.message : String(error)
    }
    return { text: 'done' }
  })
}

const RUN = (c: Engine) =>
  c.command.run({ command: 'kit-probe', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

test('closures: act.patch merges into one tab of the body key, act.update is a functional update on the same slice', async ($, on) => {
  const beneath = wireBeneath(on)
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  probeCommand(
    on,
    async (act, $$) => {
      await act.patch('think', { model: { u: 1 }, picks: ['a'] })
      await act.patch('think', { picks: ['a', 'b'] })
      await act.patch('room', { actionsOpen: true })
      await act.update('think', (slice) => ({ ...slice, count: Array.isArray(slice.picks) ? slice.picks.length : -1 }))
      return await read($$, BODY_REF)
    },
    out,
  )
  await RUN($)
  expect(out.error).toBeNull()
  expect(out.value).toEqual({
    room: { actionsOpen: true },
    think: { model: { u: 1 }, picks: ['a', 'b'], count: 2 },
    sources: {},
    review: {},
  })
  // Every write went to the one body key and nowhere else.
  expect([...beneath.state.keys()]).toEqual(['body'])
})

test('closures: act.io.mcpCall reaches the Mindrian OS server and refuses every other server without a call', async ($, on) => {
  const beneath = wireBeneath(on)
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  const results: string[] = []
  probeCommand(
    on,
    async (act) => {
      await act.io.mcpCall(MINDRIAN_SERVER, 'gate_list', {})
      for (const server of [BRAIN_SERVER, 'theo', '']) {
        try {
          await act.io.mcpCall(server, 'framework_techniques', { framework: 'x' })
          results.push('reached:' + server)
        } catch (error) {
          results.push('refused:' + server + ':' + (error instanceof Error ? error.message : String(error)))
        }
      }
      return null
    },
    out,
  )
  await RUN($)
  expect(out.error).toBeNull()
  expect(beneath.mcp.map((c) => c.server + ':' + c.tool)).toEqual([MINDRIAN_SERVER + ':gate_list'])
  expect(results.every((r) => r.startsWith('refused:'))).toBe(true)
  expect(results).toHaveLength(3)
})

test('closures: act.readAsset reads one bare name under the plugin assets folder and refuses a path', async ($, on) => {
  const beneath = wireBeneath(on, { files: { 'command-registry.json': '{"rows":[]}' } })
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  const refused: string[] = []
  probeCommand(
    on,
    async (act) => {
      const got = await act.readAsset('command-registry.json')
      for (const bad of ['../x', 'a/b', '..', '']) {
        try {
          await act.readAsset(bad)
          refused.push('read:' + bad)
        } catch {
          refused.push('refused')
        }
      }
      return got
    },
    out,
  )
  await RUN($)
  expect(out.error).toBeNull()
  expect(out.value).toBe('{"rows":[]}')
  expect(refused).toEqual(['refused', 'refused', 'refused', 'refused'])
  const assetReads = beneath.reads.filter((p) => p.includes('/assets/'))
  expect(assetReads).toHaveLength(1)
  expect(assetReads[0]?.endsWith('/assets/command-registry.json')).toBe(true)
})

test('closures: act.refresh writes a live model to the viewModel key and never rejects, even with a dead server', async ($, on) => {
  const beneath = wireBeneath(on)
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  probeCommand(
    on,
    async (act, $$) => {
      await act.refresh()
      return await read($$, VIEW_MODEL_REF)
    },
    out,
  )
  await RUN($)
  expect(out.error).toBeNull()
  expect(isViewModel(out.value)).toBe(true)
  if (isViewModel(out.value)) {
    expect(out.value.source).toBe('live')
    expect(out.value.purpose).toEqual({ state: 'ok', value: 'Funding routes' })
  }
  expect(beneath.mcp.every((c) => c.server === MINDRIAN_SERVER)).toBe(true)
})

test('closures: act.sampleName answers the session sample or the dev switch, else null; act.focus asks the pane for a key', async ($, on) => {
  const beneath = wireBeneath(on, { env: { MOS_WORKSPACE_SAMPLE: 'several' } })
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  probeCommand(
    on,
    async (act, $$) => {
      const fromEnv = await act.sampleName()
      await act.focus('tab:review')
      // The session value wins over the switch.
      beneath.state.set('sample', 'empty')
      const fromState = await act.sampleName()
      beneath.state.set('sample', 'not-a-sample')
      beneath.state.delete('sample')
      void $$
      return [fromEnv, fromState]
    },
    out,
  )
  await RUN($)
  expect(out.error).toBeNull()
  expect(out.value).toEqual(['several', 'empty'])
  expect(beneath.focused).toEqual(['tab:review'])
})

test('closures: act.sampleName is null with no sample and no switch', async ($, on) => {
  wireBeneath(on)
  const out: { value: unknown; error: string | null } = { value: null, error: null }
  probeCommand(on, async (act) => await act.sampleName(), out)
  await RUN($)
  expect(out.error).toBeNull()
  expect(out.value).toBeNull()
})
