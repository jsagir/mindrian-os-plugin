// Plan 11: "What to do next" (UI-SPEC 7.3 SuggestedMovePanel, heading P30). The step is data from the
// model; under it P31 with the reason when one is recorded, else P32. A step that is not recorded
// (M04), unreadable (M03) or still being looked up (M04: the deck has no wording of its own for it)
// is its own words and draws NO button: nothing is made up, and a decision that waits never becomes
// the next step (UI-SPEC 10.4).
//
// The primary button (P33, key next:prefill, hotkey n) only ADDS words to the prompt box: the
// recorded command when the model carries one, else the plain sentence Q01. The person reads it and
// presses Enter. Nothing here submits or runs anything (T-369.26-11-01).
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import type { ViewModel } from '../../model/view-model'
import { prefillPrompt, prefillRecorded } from '../../runtime/prefill'
import { ink } from '../ink'
import type { TabContext } from '../types'
import { panel } from './panel'

// True when there is a recorded step to act on (so the P33 button is drawn).
export function showsPrefill(vm: ViewModel): boolean {
  return vm.next.step.state === 'ok'
}

export function suggestedMovePanel(ctx: TabContext): RenderElement {
  const { Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const next = ctx.vm.next
  const step = next.step
  if (step.state !== 'ok') {
    const words = step.state === 'unavailable' ? text('M03') : text('M04')
    return panel(ctx, 'room:next', text('P30'), [
      <Text key="room:next-missing" {...color}>
        {words}
      </Text>,
    ])
  }
  const reasonWords = next.reason.state === 'ok' ? text('P31', { reason: next.reason.value }) : text('P32')
  const command = next.command
  return panel(ctx, 'room:next', text('P30'), [
    <Text key="room:next-step" {...color}>
      {step.value}
    </Text>,
    <Text key="room:next-reason" {...color}>
      {reasonWords}
    </Text>,
    <Button
      key="next:prefill"
      label={text('P33')}
      hotkey="n"
      variant="primary"
      onPress={() => {
        // The recorded command when the record carries one (data), else the plain sentence Q01.
        // Both only fill the prompt box and toast P34 or P35.
        void (command !== null ? prefillRecorded(ctx.act, command) : prefillPrompt(ctx.act, 'Q01'))
      }}
    />,
  ])
}
