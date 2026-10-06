// Plan 11: "Waiting on you" (UI-SPEC 7.3 WaitingPanel, heading P40). None P41, one P42, several P44
// with the real count; a count the model could not read is its own missing words. The jump button
// (P43, hotkey v) is drawn only when at least one decision waits and goes to the Review tab. It is
// `v`, never `d`, because `d` means Decide later inside Review (UI-SPEC 8.2).
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { missing } from '../details-block'
import { ground, ink } from '../ink'
import type { TabContext } from '../types'
import { panel } from './panel'

// How many decisions wait, or null when the model could not say.
export function waitingCount(ctx: TabContext): number | null {
  const waiting = ctx.vm.waiting
  return waiting.state === 'ok' ? Math.max(0, Math.floor(waiting.value)) : null
}

export function waitingWords(ctx: TabContext): string {
  const waiting = ctx.vm.waiting
  if (waiting.state !== 'ok') return missing(waiting)
  const n = Math.max(0, Math.floor(waiting.value))
  if (n === 0) return text('P41')
  if (n === 1) return text('P42')
  return text('P44', { n })
}

// True when the P43 button is drawn (the body's key list asks too).
export function showsJump(ctx: TabContext): boolean {
  const n = waitingCount(ctx)
  return n !== null && n >= 1
}

export function waitingPanel(ctx: TabContext): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const children = [
    <Text key="room:waiting-words" {...color}>
      {waitingWords(ctx)}
    </Text>,
  ]
  if (showsJump(ctx)) {
    children.push(
      <Box key="waiting:review-ground" {...ground(ctx.mode, ctx.theme)}>
        <Button
          key="waiting:review"
          label={text('P43')}
          hotkey="v"
          onPress={() => {
            void ctx.act.setTab('review')
          }}
        />
      </Box>,
    )
  }
  return panel(ctx, 'room:waiting', text('P40'), children)
}
