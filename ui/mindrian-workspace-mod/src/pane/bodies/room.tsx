// Plan 11 (replaces the plan 01 seam): the Room tab, the first tab a person sees. It answers the four
// first-visit questions in one screen (UI-SPEC 6.2, 7.3, 13.2): where you are, what this folder is
// for, what to do next with one reason, and what is waiting on you. Anything the model could not read
// is its own words in its own place, never a guess (UI-SPEC 10.4).
//
// Order, top to bottom: the where line (blue), the purpose panel (P20), the next-step panel (P30),
// the waiting panel (P40), the result panels (P55 and P56, only once the runtime recorded a result),
// then the place where plan 15 adds the actions button (P52). The shell draws the details button
// below this body; its block already holds P60 to P66, so this body adds no `detailsExtra`.
//
// With no data room bound the body draws ONLY the where line, which then reads P12 (UI-SPEC 10.3:
// P12 on every tab, no card). Nothing here writes or submits: the only things a person can press
// add words to the prompt box (P33) or go to another tab (P43).
//
// Engine rules (369.26-ENGINE-RULES.md): no `$` and no atom in this file; the body reads `ctx.body`
// and the model, and acts through `ctx.act` (the plan 11 body kit).
import type { RenderElement } from 'claude-code'

import type { KeySpec, TabBody, TabContext } from '../types'
import { jobPanel } from '../room/job-panel'
import { resultPanel } from '../room/result-panel'
import { showsPrefill, suggestedMovePanel } from '../room/suggested-move'
import { showsJump, waitingPanel } from '../room/waiting-panel'
import { whereLine } from '../room/where-line'

function view(ctx: TabContext): RenderElement {
  const { Box } = ctx.el
  if (!ctx.vm.place.isBound) {
    return (
      <Box key="room:body" flexDirection="column">
        {whereLine(ctx)}
      </Box>
    )
  }
  const result = resultPanel(ctx)
  return (
    <Box key="room:body" flexDirection="column">
      {whereLine(ctx)}
      {jobPanel(ctx)}
      {suggestedMovePanel(ctx)}
      {waitingPanel(ctx)}
      {result}
      {/* plan 15: the actions button (P52) and its list go here */}
    </Box>
  )
}

// n H01 then v H02, each only when its button is drawn (plan 15 inserts m H03 between them).
function keys(ctx: TabContext): KeySpec[] {
  if (!ctx.vm.place.isBound) return []
  const list: KeySpec[] = []
  if (showsPrefill(ctx.vm)) list.push({ key: 'n', labelId: 'H01' })
  if (showsJump(ctx)) list.push({ key: 'v', labelId: 'H02' })
  return list
}

export const roomBody: TabBody = {
  view,
  keys,
  explainId: 'X01',
  // Opening the tab reads the live model again, so the waiting count and the health are current. A
  // sample is fixed data: it makes no call.
  onOpen: async (act) => {
    if ((await act.sampleName()) !== null) return
    await act.refresh()
  },
}
