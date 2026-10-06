// Plan 14 (replaces the plan 01 seam): the Review tab, the docked decision card the whole phase is named
// for (UI-SPEC 7.6, 6.2, 10.6, 13.2, 8.1). It draws the waiting decisions from the recorded contract
// and presses the mod's one room write through plan 10's answer machine: one press saves, never
// optimistic, and Decide later makes no call at all. The state is the `review` slice of the one `body`
// key (route B, see src/pane/review/review-io.ts); this file holds no `$` and no atom.
//
// Keys: `1` to `3` choose that recorded choice (H15), `d` decide later (H16), `i` ask a card from
// another conversation here (H19), each only when its button is drawn and (as a hotkey) only while the
// pane holds the keyboard. `o`, `r`, `k`, `h` and `e` belong to the band and the shell and are not used.
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { choiceOptions } from '../../model/mappers'
import { ink } from '../ink'
import { DecisionList, listState } from '../review/decision-list'
import { cardPlan } from '../review/proposal-card'
import type { KeySpec, TabBody, TabContext } from '../types'

function keys(ctx: TabContext): KeySpec[] {
  const state = listState(ctx)
  if (state.kind !== 'cards' || state.open === null) return []
  const plan = cardPlan(state.open, state.review)
  const list: KeySpec[] = []
  if (plan.showChoices) {
    const n = choiceOptions(state.open).length
    list.push({ key: n === 1 ? '1' : `1-${n}`, labelId: 'H15' })
  }
  if (plan.showLater) list.push({ key: 'd', labelId: 'H16' })
  if (plan.showAsk) list.push({ key: 'i', labelId: 'H19' })
  return list
}

// Under the shell's details button: each recorded choice's description, in full, so a description that
// does not fit the compact card is one press away (UI-SPEC 13.2).
function detailsExtra(ctx: TabContext): RenderElement | null {
  const state = listState(ctx)
  if (state.kind !== 'cards' || state.open === null) return null
  const described = state.open.options.filter((o) => o.description !== null && o.description !== '')
  if (described.length === 0) return null
  const { Box, Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key="review:details-extra" flexDirection="column">
      <Text bold {...color}>
        {text('D02')}
      </Text>
      {described.map((o) => (
        <Text {...color}>{`${o.label}: ${o.description}`}</Text>
      ))}
    </Box>
  )
}

export const reviewBody: TabBody = {
  view: DecisionList,
  keys,
  explainId: 'X04',
  detailsExtra,
  // Opening the tab clears the "just settled" sentence and reads the live model again, so the waiting
  // decisions are current. A sample is fixed data: it makes no call.
  onOpen: async (act) => {
    await act.patch('review', { settled: undefined })
    if ((await act.sampleName()) !== null) return
    await act.refresh()
  },
}
