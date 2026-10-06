// Plan 05 (replaces the plan 01 seam wholesale), extended by plan 08: the orientation band above
// the prompt, event `ui.render` on `AbovePrompt`.
//
// The hook draws every tier and case: three rows at T3-wide and T3-compact, one row at T1 and T0,
// one row at any width for a room that is not bound (src/band/band.tsx `drawBand` routes them). It
// yields to the engine's own drawing (`next(e)`) only for a survey, a window under four rows, and
// when the mod has no view model to draw. It never writes state while drawing, never starts a
// timer, and never reads the surface size: the tier comes from `maxRows` and `bodyColumns`.
//
// Plan 08 keys: `o` opens the workspace, `h` opens the all-keys panel, `r` and `k` add a sentence
// to the prompt box. None runs work and none submits (src/runtime/prefill.ts has no submit).
//
// ENGINE RULES (369.26-ENGINE-RULES.md): `$` does not cross an import and a state read needs a
// literal reference at the call site. So every read is spelled here, in this file, the press
// closures are built here over this file's `$` (`makeBandAct`), and only plain values and those
// closures go to the pure functions (chooseViewModel, decideMode, drawBand).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { fixFlags } from '../band/alerts'
import { drawBand } from '../band/band'
import type { BandActions } from '../band/hint-row'
import { pickTier } from '../band/tier'
import { text } from '../copy/text'
import { chooseViewModel } from '../model/read'
import type { TabId } from '../runtime/ids'
import { prefillPrompt } from '../runtime/prefill'
import type { PrefillIo } from '../runtime/prefill'
import { INITIAL } from '../state/atoms'
import { PALETTE_ASSET } from '../theme/theme'
import { decideMode } from '../theme/plain'

// The pane id as a literal of this file (the engine reads a literal or a same-file const).
const PANE = 'mindrian-workspace'

const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)
const keysOpenAtom = atom({ plugin: 'mindrian-workspace', key: 'keysOpen' } as const, INITIAL.keysOpen)

// What a band key does, closures over this hook's `$`. `tab` is where `o` lands when the pane is
// not open yet: Review when a decision waits, else Room (C-11).
function makeBandAct($: EngineInterface, tab: TabId): BandActions {
  const io: PrefillIo = {
    fill: async (words) => (await $.prompt.fill({ text: words, mode: 'replace' })).isFilled,
    toast: (message) => {
      $.ui.toast(message)
    },
  }
  // The engine's own record of this plugin's open panes; unreadable counts as closed.
  const paneIsOpen = async (): Promise<boolean> => {
    try {
      return (await $.ui.panes()).some((pane) => pane.id === PANE)
    } catch {
      return false
    }
  }
  return {
    open: async () => {
      // With the pane already open the key only gives it focus: its tab stays where the person left it.
      if (!(await paneIsOpen())) await update($, tabAtom, () => tab)
      await $.ui.open({ id: PANE, title: text('P00'), focus: true, closeOnEscape: true })
    },
    help: async () => {
      // Open: the panel opens or shuts. Closed: Room opens with the panel already open (UI-SPEC 8.5).
      if (await paneIsOpen()) {
        await update($, keysOpenAtom, (open) => !open)
        return
      }
      await update($, tabAtom, () => 'room')
      await update($, keysOpenAtom, () => true)
      await $.ui.open({ id: PANE, title: text('P00'), focus: true, closeOnEscape: true })
    },
    checkup: async () => {
      await prefillPrompt(io, 'Q06')
    },
    save: async () => {
      await prefillPrompt(io, 'Q07')
    },
  }
}

export const registerBand: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { hasSurvey, isWorking, maxRows, bodyColumns } = e.props

    // Cheap yields first, before anything is read.
    if (pickTier(bodyColumns, maxRows, hasSurvey) === 'yield') return next(e)

    // Which view model to draw: the sample switch, then the live value (plan 04's rule).
    const fromAtom = await read($, { plugin: 'mindrian-workspace', key: 'sample' } as const)
    const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')
    const live = await read($, { plugin: 'mindrian-workspace', key: 'viewModel' } as const)
    const vm = chooseViewModel(fromAtom, fromEnv, live)
    if (vm === null) return next(e)

    // How to paint: the person's switch (state or the kept store value), the palette text, and the
    // two environment names (plan 03's rule).
    const statePlain = await read($, { plugin: 'mindrian-workspace', key: 'plain' } as const)
    const storePlain = await $.store.get('plain')
    let paletteText: string | null
    try {
      paletteText = await $.fs.read(`${$.plugin.root}/${PALETTE_ASSET}`)
    } catch {
      paletteText = null
    }
    const noColor = await $.env.get('NO_COLOR')
    const term = await $.env.get('TERM')
    const mode = decideMode({
      switchOn: statePlain === true || storePlain === true,
      paletteText,
      noColor,
      term,
    })

    const el = $.ui.resolve(e)
    const act = makeBandAct($, fixFlags(vm).openTab)
    const band = drawBand(el, vm, mode.theme, mode, { bodyColumns, maxRows, hasSurvey, isWorking }, act)
    return band === null ? next(e) : band
  })
}
