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

import { chooseViewModel } from '../model/read'
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
// reads a literal or a const of the same file, not an imported one; tests/pane.test.tsx asserts it
// equals PANE_ID in src/runtime/ids.ts.
const PANE = 'mindrian-workspace'

const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)
const keysOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'keysOpen' } as const, INITIAL.keysOpen)
const explainOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'explainOpen' } as const, INITIAL.explainOpen)
const detailsOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'detailsOpen' } as const, INITIAL.detailsOpen)
const sampleAtom = atom({ plugin: 'mindrian-workspace', key: 'sample' } as const, INITIAL.sample)
const viewModelAtom = atom({ plugin: 'mindrian-workspace', key: 'viewModel' } as const, INITIAL.viewModel)

// The closures a body and the shell's buttons run, over this hook's `$`. `focusKey` says which
// keyed control to focus after a tab press (null: none), because only the render hook knows the
// width and the mode that decide what the strip drew.
function makeAct($: EngineInterface, focusKey: (tab: TabId) => string | null): ShellActions {
  const act: ShellActions = {
    setTab: async (tab) => {
      await update($, tabAtom, () => tab)
      const key = focusKey(tab)
      if (key !== null) {
        try {
          // The first control of the new view (UI-SPEC 8.3). Best effort: a refused move is ignored.
          await $.ui.focus({ requestId: PANE, key })
        } catch {
          // ignored on purpose
        }
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
  }
  return act
}

export const registerPane: Register = (on) => {
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const tab = await read($, tabAtom)
    const keysOpen = await read($, keysOpenAtom)
    const explainOpen = await read($, explainOpenAtom)
    const detailsOpen = await read($, detailsOpenAtom)
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
    const switchOn = await $.store.get('plain')
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
