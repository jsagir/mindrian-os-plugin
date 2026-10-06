// Plan 11 (replaces the plan 01 seam): the Room tab, the first tab a person sees. It answers the four
// first-visit questions in one screen (UI-SPEC 6.2, 7.3, 13.2): where you are, what this folder is
// for, what to do next with one reason, and what is waiting on you. Anything the model could not read
// is its own words in its own place, never a guess (UI-SPEC 10.4).
//
// Order, top to bottom: the where line (words on the page), the purpose panel (P20), the next-step panel (P30),
// the waiting panel (P40), the result panels (P55 and P56, only once the runtime recorded a result),
// then the "More things to do here" button (P52, key m; plan 15) and, only while it is open, the
// list under it (src/pane/room/action-list.tsx). The list is closed by default and each time the tab
// opens; its state is the Room slice of the body kit. The shell draws the details button
// below this body; its block already holds P60 to P66, so this body adds no `detailsExtra`.
//
// With no data room bound the body draws ONLY the where line, which then reads P12 (UI-SPEC 10.3:
// P12 on every tab, no card). Nothing here writes or submits: the only things a person can press
// add words to the prompt box (P33) or go to another tab (P43).
//
// Engine rules (369.26-ENGINE-RULES.md): no `$` and no atom in this file; the body reads `ctx.body`
// and the model, and acts through `ctx.act` (the plan 11 body kit).
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { ground } from '../ink'
import type { KeySpec, TabBody, TabContext } from '../types'
import { actionList } from '../room/action-list'
import { jobPanel } from '../room/job-panel'
import { readActionsState, toggleActions } from '../room/registry-model'
import { resultPanel } from '../room/result-panel'
import { showsPrefill, suggestedMovePanel } from '../room/suggested-move'
import { showsJump, waitingPanel } from '../room/waiting-panel'
import { whereLine } from '../room/where-line'

// The P52 button (P53 while the list is open): one deliberate press opens or closes the list.
function actionsButton(ctx: TabContext, open: boolean, state: ReturnType<typeof readActionsState>): RenderElement {
  const { Box, Button } = ctx.el
  return (
    <Box key="actions:row" marginTop={1}>
      <Box key="actions:ground" {...ground(ctx.mode, ctx.theme)}>
        <Button
          key="room:actions"
          label={text(open ? 'P53' : 'P52')}
          hotkey="m"
          onPress={() => {
            void toggleActions(ctx.act, state)
          }}
        />
      </Box>
    </Box>
  )
}

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
  const actions = readActionsState(ctx.body.room)
  return (
    <Box key="room:body" flexDirection="column">
      {whereLine(ctx)}
      {jobPanel(ctx)}
      {suggestedMovePanel(ctx)}
      {waitingPanel(ctx)}
      {result}
      {actionsButton(ctx, actions.open, actions)}
      {actions.open ? actionList(ctx) : null}
    </Box>
  )
}

// n H01, v H02, then m H03 (UI-SPEC 8.4), each only when its button is drawn; the m button is drawn
// whenever a data room is bound.
function keys(ctx: TabContext): KeySpec[] {
  if (!ctx.vm.place.isBound) return []
  const list: KeySpec[] = []
  if (showsPrefill(ctx.vm)) list.push({ key: 'n', labelId: 'H01' })
  if (showsJump(ctx)) list.push({ key: 'v', labelId: 'H02' })
  list.push({ key: 'm', labelId: 'H03' })
  return list
}

export const roomBody: TabBody = {
  view,
  keys,
  explainId: 'X01',
  // Opening the tab closes the action list (collapsed each time) and reads the live model again, so
  // the waiting count and the health are current. A sample is fixed data: it makes no call.
  onOpen: async (act) => {
    await act.patch('room', { actionsOpen: false })
    if ((await act.sampleName()) !== null) return
    await act.refresh()
  },
}
