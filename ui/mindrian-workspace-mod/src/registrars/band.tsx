// Plan 05 (replaces the plan 01 seam wholesale; plan 08 extends it): the orientation band above the
// prompt, event `ui.render` on `AbovePrompt`.
//
// The hook yields to the engine's own drawing (`next(e)`) when a survey holds the band, when the
// window is under four rows, for tiers T1 and T0 and for any room that is not bound (those are plan
// 08's; a test pins that), and when the mod has no view model to draw. It never writes state, never
// starts a timer, and never reads the surface size: the tier comes from `maxRows` and `bodyColumns`.
//
// ENGINE RULES (369.26-ENGINE-RULES.md): `$` does not cross an import and a state read needs a
// literal reference at the call site. So every read is spelled here, in this file, and only plain
// values go to the pure functions (chooseViewModel, decideMode, renderBand).
import { read } from 'claude-code'
import type { Register } from 'claude-code'

import { renderBand } from '../band/band'
import { pickTier } from '../band/tier'
import { chooseViewModel } from '../model/read'
import { PALETTE_ASSET } from '../theme/theme'
import { decideMode } from '../theme/plain'

export const registerBand: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { hasSurvey, isWorking, maxRows, bodyColumns } = e.props

    // Cheap yields first, before anything is read.
    const tier = pickTier(bodyColumns, maxRows, hasSurvey)
    if (tier !== 'T3-wide' && tier !== 'T3-compact') return next(e)

    // Which view model to draw: the sample switch, then the live value (plan 04's rule).
    const fromAtom = await read($, { plugin: 'mindrian-workspace', key: 'sample' } as const)
    const fromEnv = await $.env.get('MOS_WORKSPACE_SAMPLE')
    const live = await read($, { plugin: 'mindrian-workspace', key: 'viewModel' } as const)
    const vm = chooseViewModel(fromAtom, fromEnv, live)
    if (vm === null || !vm.place.isBound) return next(e)

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
    const band = renderBand(el, vm, mode.theme, mode, { bodyColumns, maxRows, hasSurvey, isWorking }, {})
    return band === null ? next(e) : band
  })
}
