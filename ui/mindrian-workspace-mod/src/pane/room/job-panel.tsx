// Plan 11: "What this folder is for" (UI-SPEC 7.3 JobPanel, heading P20). The purpose is data: a
// single line is a Text, a multi-line purpose is Markdown (the engine caps it). A purpose that is
// not there is its own missing words in the same place (M01 no room file, M02 no purpose written,
// M03 cannot read), never a related fact and never a reassuring sentence (UI-SPEC 10.4).
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { missing } from '../details-block'
import { ink } from '../ink'
import type { TabContext } from '../types'
import { panel } from './panel'

export function jobPanel(ctx: TabContext): RenderElement {
  const { Text, Markdown } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const purpose = ctx.vm.purpose
  let body: RenderElement
  if (purpose.state === 'ok') {
    body = purpose.value.includes('\n') ? (
      <Markdown key="room:purpose-text" text={purpose.value} />
    ) : (
      <Text key="room:purpose-text" {...color}>
        {purpose.value}
      </Text>
    )
  } else {
    body = (
      <Text key="room:purpose-missing" {...color}>
        {missing(purpose)}
      </Text>
    )
  }
  return panel(ctx, 'room:purpose', text('P20'), [body])
}
