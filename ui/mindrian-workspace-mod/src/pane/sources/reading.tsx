// Plan 13: the reading view (UI-SPEC 7.5, heading P105). The artifact's text as Markdown, at most
// 10,000 characters (the model already cut it); P107 when the artifact is longer; the Back button
// (P106, key b) returns to the list. An unreadable artifact says M03 and still offers Back, so a
// person is never stuck. The Markdown element gets no link handler: a link in a person's own file
// is drawn, never followed from here. Reading never writes to the room.
import type { RenderElement, RenderNode } from 'claude-code'

import { text } from '../../copy/text'
import { ink } from '../ink'
import { panel } from '../room/panel'
import type { TabContext } from '../types'
import { closeReading } from './model'
import type { Reading } from './model'

export function readingView(ctx: TabContext, reading: Reading): RenderElement {
  const { Text, Markdown, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const back = (
    <Button
      key="sources:back"
      label={text('P106')}
      hotkey="b"
      onPress={() => {
        void closeReading(ctx.act)
      }}
    />
  )
  if (reading.state === 'unavailable') {
    return panel(ctx, 'sources:reading', text('P105'), [
      <Text key="sources:reading-title" bold {...color}>
        {reading.title}
      </Text>,
      <Text key="sources:reading-unavailable" {...color}>
        {text('M03')}
      </Text>,
      back,
    ])
  }
  const parts: RenderNode[] = [
    <Text key="sources:reading-title" bold {...color}>
      {reading.title}
    </Text>,
    <Markdown key="sources:reading-text" text={reading.text} />,
  ]
  if (reading.isCut) {
    parts.push(
      <Text key="sources:reading-cut" {...color}>
        {text('P107')}
      </Text>,
    )
  }
  parts.push(back)
  return panel(ctx, 'sources:reading', text('P105'), parts)
}
