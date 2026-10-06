// Plan 07 (replaces the plan 01 seam): the pane's hooks. The pane draws only when a person opens
// it (the workspace command now, the band's o key in plan 08), so it seats at any width, and it never
// asks the surface to hold other plugins' toasts (a pane that stays open must not).
//
// ENGINE RULES (369.26-ENGINE-RULES.md) shape this file:
//  - `$` never crosses an import and never sits in an object, so every read of `$` and every action
//    closure is written HERE, and the shell view (src/pane/pane.tsx) is a pure function that gets
//    plain values and the closures (rule 1);
//  - each atom is declared in this file with a literal reference (rule 2), starting values come
//    from INITIAL (plain data);
//  - the render hook only reads; every write is in a press, select, open, close, turn or command
//    handler (rule 4).
// The plan's renderPane($, e, deps) therefore became buildPane(el, input, deps) plus this hook, and
// the tab bodies get closures (`act`) instead of `$`.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { registerWorkspaceCommand } from '../command/workspace'
import type { LiveIo } from '../model/live/io'
import { refreshViewModel } from '../model/live/refresh'
import { chooseViewModel } from '../model/read'
import { allowedServer, asBody, isAssetName, mergeBody, replaceBody } from '../pane/kit'
import { buildPane } from '../pane/pane'
import { paneLayout } from '../pane/layout'
import { closeDecision, closedFor, flipped } from '../pane/state'
import { tabFocusKey } from '../pane/tab-strip'
import { tabBodies } from '../pane/tab-bodies'
import type { ShellActions } from '../pane/types'
import type { TabId } from '../runtime/ids'
import { INITIAL } from '../state/atoms'
import { decideMode } from '../theme/plain'
import { PALETTE_ASSET } from '../theme/theme'

// The pane id as a literal of this file, because the engine's listing (and its scan of a matcher)
// reads a literal or a const of the same file, not an imported one; tests/pane.test.tsx mounts the real
// pane on PANE_ID in src/runtime/ids.ts, so a drift makes every registrar arm fail.
const PANE = 'mindrian-workspace'

const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)
const keysOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'keysOpen' } as const, INITIAL.keysOpen)
const explainOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'explainOpen' } as const, INITIAL.explainOpen)
const detailsOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'detailsOpen' } as const, INITIAL.detailsOpen)
const plainAtom = atom({ plugin: 'mindrian-workspace', key: 'plain' } as const, INITIAL.plain)
const sampleAtom = atom({ plugin: 'mindrian-workspace', key: 'sample' } as const, INITIAL.sample)
const viewModelAtom = atom({ plugin: 'mindrian-workspace', key: 'viewModel' } as const, INITIAL.viewModel)
// Plan 11: the one generic body state (a slice of JSON per tab). Declared here once, read by the
// render hook and written only by act.patch and act.update below.
const bodyAtom = atom({ plugin: 'mindrian-workspace', key: 'body' } as const, INITIAL.body)

// The narrow set of reads a body's loader may make (plan 06's recipe, ENGINE-RULES rule 14), built
// over this file's `$` with every name spelled as a literal. Differences from the model
// registrar's copy: `mcpCall` refuses every server except the Mindrian OS server, so a body can
// never reach the Brain (Canon Part 8); there is no write here. Exported for the kit's tests.
export function makeIo($: EngineInterface): LiveIo {
  return {
    mcpCall: (server, tool, args) =>
      allowedServer(server) ? $.mcp.call(server, tool, args) : Promise.reject(new Error('server_not_allowed')),
    envGet: (name) => {
      if (name === 'MINDRIAN_ROOMS_HOME') return $.env.get('MINDRIAN_ROOMS_HOME')
      if (name === 'HOME') return $.env.get('HOME')
      return $.env.get('USERPROFILE')
    },
    cwd: () => $.session.cwd(),
    fsExists: (path) => $.fs.exists(path),
    fsRead: (path) => $.fs.read(path),
    usage: () => $.session.usage(),
    now: () => $.clock.now(),
  }
}

// The closures a body and the shell's buttons run, over this hook's `$`. `focusKey` says which
// keyed control to focus after a tab press (null: none), because only the render hook knows the
// width and the mode that decide what the strip drew.
//
// Plan 11 added the body kit (369.26-ENGINE-RULES.md, "Pane body recipe"): `io`, `patch`, `update`,
// `refresh`, `readAsset`, `sampleName` and `focus`. A body gets these closures and never `$`.
// Exported for the kit's tests (a test hook builds a real act over its own `$`).
export function makeAct($: EngineInterface, focusKey: (tab: TabId) => string | null): ShellActions {
  const io = makeIo($)
  const act: ShellActions = {
    setTab: async (tab) => {
      await update($, tabAtom, () => tab)
      const key = focusKey(tab)
      if (key !== null) {
        // The first control of the new view (UI-SPEC 8.3). Best effort: a refused move is ignored.
        await act.focus(key)
      }
      try {
        await tabBodies[tab]?.onOpen?.(act)
      } catch {
        // A body that fails to load costs nothing: it draws its own unavailable state.
      }
    },
    fill: async (promptText) => {
      const filled = await $.prompt.fill({ text: promptText, mode: 'replace' })
      return filled.isFilled
    },
    toast: (message) => {
      $.ui.toast(message)
    },
    toggleKeys: async () => {
      await update($, keysOpenAtom, (open) => !open)
    },
    toggleExplain: async () => {
      await update($, explainOpenAtom, (open) => !open)
    },
    toggleDetails: async (tab) => {
      await update($, detailsOpenAtom, (rec) => flipped(rec, tab))
    },
    io,
    patch: async (tab, partial) => {
      await update($, bodyAtom, (rec) => mergeBody(asBody(rec), tab, partial))
    },
    update: async (tab, fn) => {
      await update($, bodyAtom, (rec) => {
        const body = asBody(rec)
        return replaceBody(body, tab, fn(body[tab]))
      })
    },
    refresh: async () => {
      try {
        const vm = await refreshViewModel(io)
        await update($, viewModelAtom, () => vm)
      } catch {
        // Never rejects: a dead server or a refused write leaves the model as it was.
      }
    },
    readAsset: async (name) => {
      if (!isAssetName(name)) throw new Error('bad_asset_name')
      return await $.fs.read(`${$.plugin.root}/assets/${name}`)
    },
    sampleName: async () => {
      const fromAtom = await read($, sampleAtom)
      const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')
      const sample = chooseViewModel(fromAtom, fromEnv, null)
      return sample === null ? null : sample.sampleName
    },
    focus: async (key) => {
      try {
        await $.ui.focus({ requestId: PANE, key })
      } catch {
        // A refused move is ignored on purpose.
      }
    },
  }
  return act
}

export const registerPane: Register = (on) => {
  registerWorkspaceCommand(on)

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const tab = await read($, tabAtom)
    const keysOpen = await read($, keysOpenAtom)
    const explainOpen = await read($, explainOpenAtom)
    const detailsOpen = await read($, detailsOpenAtom)
    const body = asBody(await read($, bodyAtom))
    // The Pane props carry no working flag. The store holds the id of the session whose turn is
    // running (written by the turn hooks below), so a flag a crashed session left behind is another
    // session's id and reads as idle here.
    const workingFor = await $.store.get('working')
    let working = false
    try {
      working = typeof workingFor === 'string' && workingFor !== '' && workingFor === (await $.session.id())
    } catch {
      working = false
    }

    // Which model to draw: the session's sample, the dev env switch, then the live value.
    const fromAtom = await read($, sampleAtom)
    const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')
    const live = await read($, viewModelAtom)
    const vm = chooseViewModel(fromAtom, fromEnv, live)

    // The mode, decided from plain values read here (the person's switch, the palette, the env).
    // The state value is what redraws the pane when `workspace plain` flips it; the store is what
    // survives a restart. Either one says plain.
    const plainState = await read($, plainAtom)
    const switchOn = plainState === true || (await $.store.get('plain')) === true
    let paletteText: string | null
    try {
      paletteText = await $.fs.read(`${$.plugin.root}/${PALETTE_ASSET}`)
    } catch {
      paletteText = null
    }
    const noColor = await $.env.get('NO_COLOR')
    const term = await $.env.get('TERM')
    const mode = decideMode({ switchOn, paletteText, noColor, term })

    const surface = e.surface
    const layout = paneLayout(e.props.bodyColumns)
    const act = makeAct($, (id) => tabFocusKey(id, mode.plain, layout.tabsAsSelect, surface))

    return buildPane(
      el,
      {
        surface,
        tab,
        vm,
        mode,
        theme: mode.theme,
        bodyColumns: e.props.bodyColumns,
        isFocused: e.props.isFocused,
        working,
        keysOpen,
        explainOpen,
        detailsOpen,
        body,
        act,
      },
      { bodies: tabBodies },
    )
  })

  // A person's Esc closes the open sub-panel first (explain, then all keys, then details), and the
  // pane only when none is open. Answering without next keeps the pane open.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const explain = await read($, explainOpenAtom)
    const keys = await read($, keysOpenAtom)
    const details = (await read($, detailsOpenAtom))[await read($, tabAtom)]
    const which = closeDecision(e.origin.kind, { explain, keys, details })
    if (which === 'explain') {
      await update($, explainOpenAtom, () => false)
      return { value: undefined }
    }
    if (which === 'keys') {
      await update($, keysOpenAtom, () => false)
      return { value: undefined }
    }
    if (which === 'details') {
      const tab = await read($, tabAtom)
      await update($, detailsOpenAtom, (rec) => closedFor(rec, tab))
      return { value: undefined }
    }
    // The pane really closes: start the next opening from a clean frame.
    const closed = await next(e)
    await update($, explainOpenAtom, () => false)
    await update($, keysOpenAtom, () => false)
    return closed
  }).catch(($, e, next) => next(e))

  // The engine raised ui.open for the pane: the active tab's body loads its data.
  on('ui.open', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    const tab = await read($, tabAtom)
    try {
      await tabBodies[tab]?.onOpen?.(makeAct($, () => null))
    } catch {
      // ignored on purpose
    }
    return result
  }).catch(($, e, next) => next(e))

  // P05 "Larry is working": a turn starting and completing say it. These write the store, not a
  // state key, on purpose: plan 06's turn.complete refresh is tested to write the viewModel key and
  // nothing else. The drawing does not subscribe to the store, so the pane is told to draw again.
  on('turn.start', async ($, e, next) => {
    await $.store.set('working', await $.session.id())
    $.ui.invalidate('ui.render')
    return next(e)
  })
  // plan 06's model registrar already hooks turn.complete with no matcher, and the engine refuses
  // two unmatched hooks on one event in one module, so this one names every way a turn can end
  // (TurnCompleteReason) as a one-of matcher.
  on('turn.complete', { reason: ['answer', 'aborted', 'error', 'refusal'] }, async ($, e, next) => {
    await $.store.set('working', '')
    $.ui.invalidate('ui.render')
    return next(e)
  })
}
