// Plan 05: the orientation band at the two three-row tiers (UI-SPEC 6.1, 10.1, 10.3). A pure view
// function: the element table, the view model, the theme, the mode and the band's own props in; a
// tree out. It reads `maxRows` and `bodyColumns` from props only (never the window size from anywhere else), draws no
// timer and no animation, and never writes state.
//
// Layout: a root row `bodyColumns` wide. Left, the logo (10 columns, 3 rows). Right, three rows of
// one line each, blocks separated by one black frame column (a ' | ' in plain mode):
//   row 1  place, waiting, context (the context block jumps to the front at 80 percent or more)
//   row 2  purpose, then the health block only when the room needs a checkup or is broken
//   row 3  next step, then the right slot (plan 08: the Open and Help keys)
// The version is never drawn (C-10, OQ-04: there is no verified source). Healthy rooms draw no
// health block (C-15).
//
// Tiers T1 and T0 and the rooms that are not bound are plan 08's: this returns null for them and
// the registrar yields to the engine's own drawing.
import type { RenderElement, RenderNode } from 'claude-code'

import type { ViewModel } from '../model/view-model'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { FrameCell } from './blocks'
import type { El } from './blocks'
import { LogoCell } from './logo'
import { pickTier } from './tier'
import { ContextTile, HealthTile, NextTile, PlaceTile, PurposeTile, WaitingTile, WorkingNote } from './tiles'

// What the engine hands the band (AbovePromptProps), reduced to what the band reads.
export type BandProps = {
  bodyColumns: number
  maxRows: number
  hasSurvey: boolean
  isWorking: boolean
}

// Seams plan 08 fills with buttons (Save my thinking, the checkup, the key hints). Empty here.
export type BandSlots = {
  row1Fix?: RenderNode
  row2Fix?: RenderNode
  row3Right?: RenderNode
}

// The items of one row with a frame cell between each pair; absent items (null) leave no gap.
function joined(el: El, theme: Theme | null, mode: Mode, items: Array<RenderNode | null | undefined>): RenderNode[] {
  const present = items.filter((i): i is RenderNode => i !== null && i !== undefined)
  const out: RenderNode[] = []
  present.forEach((item, at) => {
    if (at > 0) out.push(FrameCell(el, theme, mode))
    out.push(item)
  })
  return out
}

export function renderBand(
  el: El,
  vm: ViewModel,
  theme: Theme | null,
  mode: Mode,
  props: BandProps,
  slots: BandSlots,
): RenderElement | null {
  const tier = pickTier(props.bodyColumns, props.maxRows, props.hasSurvey)
  if (tier !== 'T3-wide' && tier !== 'T3-compact') return null
  const { Box } = el

  const showBar = tier === 'T3-wide'
  const place = PlaceTile(el, vm.place, theme, mode)
  const waiting = WaitingTile(el, vm.waiting, theme, mode)
  const context = ContextTile(el, vm.context, theme, mode, showBar)
  const working = WorkingNote(el, props.isWorking, theme, mode)

  // At the limit the context block (with its Save fix) comes to the front of row 1.
  const atLimit = vm.context.state === 'ok' && vm.context.value >= 80
  const row1 = atLimit
    ? joined(el, theme, mode, [context, slots.row1Fix, place, waiting, working])
    : joined(el, theme, mode, [place, waiting, context, slots.row1Fix, working])

  const row2 = joined(el, theme, mode, [
    PurposeTile(el, vm.purpose, theme, mode),
    HealthTile(el, vm.health, theme, mode),
    slots.row2Fix,
  ])
  const row3 = joined(el, theme, mode, [NextTile(el, vm.next, theme, mode), slots.row3Right])

  return (
    <Box flexDirection="row" width={props.bodyColumns} height={3}>
      {LogoCell(el, 'tall', theme, mode)}
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Box flexDirection="row" height={1}>
          {row1}
        </Box>
        <Box flexDirection="row" height={1}>
          {row2}
        </Box>
        <Box flexDirection="row" height={1}>
          {row3}
        </Box>
      </Box>
    </Box>
  )
}
