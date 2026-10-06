// Plan 12: "What we think so far" (UI-SPEC 7.4 UnderstandingPanel, heading P70). The sentence is data
// from the recorded source (the folder's governing thought, read as text); P72 shows the count of
// evidence pieces only when a source records one (no live source does today); the P73 button goes to
// the Sources tab. A sentence that is not there is its own missing words (M04, or M03 when it could
// not be read), never a guess and never a reassuring line (UI-SPEC 10.4).
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../../copy/text'
import { missing } from '../details-block'
import { ink } from '../ink'
import { panel } from '../room/panel'
import type { TabContext } from '../types'
import type { ThinkModel } from './model'

// True when the P73 button is drawn (the body's key list asks too).
export function showsEvidence(model: ThinkModel): boolean {
  return model.understanding.state === 'ok'
}

export function understandingPanel(ctx: TabContext, model: ThinkModel): RenderElement {
  const { Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const seen = model.understanding
  if (seen.state !== 'ok') {
    return panel(ctx, 'think:understanding', text('P70'), [
      <Text key="think:understanding-missing" {...color}>
        {missing(seen)}
      </Text>,
    ])
  }
  const children: RenderNode[] = [
    <Text key="think:understanding-sentence" {...color}>
      {seen.value.sentence}
    </Text>,
  ]
  const count = seen.value.evidenceCount
  if (count !== null) {
    children.push(
      <Text key="think:understanding-count" {...color}>
        {text('P72', { n: Math.max(0, Math.floor(count)) })}
      </Text>,
    )
  }
  children.push(
    <Button
      key="think:evidence"
      label={text('P73')}
      hotkey="v"
      onPress={() => {
        void ctx.act.setTab('sources')
      }}
    />,
  )
  return panel(ctx, 'think:understanding', text('P70'), children)
}
