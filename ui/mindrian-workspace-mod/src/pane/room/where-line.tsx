// Plan 11: the where line, the first row of the Room tab (UI-SPEC 7.3 JobPanel, 10.3). Inside a
// folder it reads P10, at the top of the data room P11, with no data room bound P12. A place the
// model could not read says so in the band's own words (B14), never a guess. In color mode it is a
// bold label on the page (C-30, C-32: where you are is orientation, not evidence, so no blue block);
// plain mode draws the same words.
import type { RenderElement } from 'claude-code'

import { splitLabel } from '../../band/blocks'
import { text } from '../../copy/text'
import type { Place } from '../../model/view-model'
import { ink } from '../ink'
import type { TabContext } from '../types'

// The words, pure. Exported so the body can test them without a mount.
export function whereWords(place: Place): string {
  if (!place.isBound) return text('P12')
  const room = place.room.state === 'ok' ? place.room.value : undefined
  const folder = place.folder.state === 'ok' ? place.folder.value : undefined
  if (room === undefined || folder === undefined) return text('B14')
  if (folder === null) return text('P11', { room })
  return text('P10', { room, folder })
}

export function whereLine(ctx: TabContext): RenderElement {
  const { Box, Text } = ctx.el
  const [label, rest] = splitLabel(whereWords(ctx.vm.place))
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key="room:where">
      {label === '' ? (
        <Text wrap="truncate-end" {...color}>
          {rest}
        </Text>
      ) : (
        <Text wrap="truncate-end" {...color}>
          <Text bold>{label}</Text>
          {rest}
        </Text>
      )}
    </Box>
  )
}
