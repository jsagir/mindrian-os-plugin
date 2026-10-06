// Plan 12 (replaces the plan 01 seam): the Think tab, first half. It shows what we think so far, what
// we are unsure about, and the points with no evidence yet (UI-SPEC 7.4, 13.2, R-09; WS-13), each
// only from a recorded source or as its own missing-data words. Plan 16 adds the help area below.
//
// Order, top to bottom: the understanding panel, the state note (a search under way, or a gap
// exists), then the unsure-about block and the gap list as SIBLINGS (side by side from 72 columns,
// one under the other below that; blocks never nest). With no data room bound the body draws only
// P12 (UI-SPEC 10.3). Nothing here writes a room file or submits anything.
//
// Data: `onOpen` loads the model into the `think` slice of the body kit (once per open and per tab
// press, never on a turn); the view reads it from `ctx.body.think` and narrows it with
// `isThinkState`. No `$` and no atom in this file (369.26-ENGINE-RULES.md, "Pane body recipe").
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { ink } from '../ink'
import { isThinkState, loadThink, picksOf } from '../think/model'
import { showsEvidence, understandingPanel } from '../think/understanding'
import { gapList, stateNote, uncertaintyBlock } from '../think/uncertainty'
import type { KeySpec, TabBody, TabContext } from '../types'

// The two blocks sit side by side from this body width (the same cut the decision card uses for its
// choice row, UI-SPEC 10.6), else one under the other.
const SIDE_BY_SIDE_AT = 72

function view(ctx: TabContext): RenderElement {
  const { Box, Text } = ctx.el
  if (!ctx.vm.place.isBound) {
    return (
      <Box key="think:body" flexDirection="column">
        <Box key="think:noroom" flexDirection="row">
          <Text {...ink(ctx.mode, ctx.theme)}>{text('P12')}</Text>
        </Box>
      </Box>
    )
  }
  const slice = ctx.body.think
  // No model yet (the load has not finished): nothing is drawn, and nothing is guessed.
  if (!isThinkState(slice)) return <Box key="think:body" flexDirection="column" />

  const model = slice.model
  const titles = model.gaps.state === 'ok' ? model.gaps.value.points : []
  const picks = picksOf(slice.picks, titles)
  const row = ctx.bodyColumns >= SIDE_BY_SIDE_AT
  return (
    <Box key="think:body" flexDirection="column">
      {understandingPanel(ctx, model)}
      {stateNote(ctx, model)}
      <Box key="think:blocks" flexDirection={row ? 'row' : 'column'} gap={1} marginTop={1}>
        {uncertaintyBlock(ctx, model)}
        {gapList(ctx, model, picks)}
      </Box>
      {/* plan 16: the help area (P80 and its buttons) goes here */}
    </Box>
  )
}

// v H17 when the P73 button is drawn (plan 16 adds g, w, a).
function keys(ctx: TabContext): KeySpec[] {
  if (!ctx.vm.place.isBound) return []
  const slice = ctx.body.think
  if (!isThinkState(slice)) return []
  return showsEvidence(slice.model) ? [{ key: 'v', labelId: 'H17' }] : []
}

export const thinkBody: TabBody = {
  view,
  keys,
  explainId: 'X02',
  // Opening the tab reads the live model again (so the place is current when the pane opened here
  // first) and loads this tab's own data. A sample is fixed data: it makes no call.
  onOpen: async (act) => {
    if ((await act.sampleName()) === null) await act.refresh()
    await loadThink(act)
  },
}
