// Plan 13: the Sources list (UI-SPEC 7.5 SourcesList, heading P100). One row per source: the title
// (data, the artifact's own heading), P102 with where it is stored, and a P103 button. Rows carry no
// letter key: Tab or the arrows walk them and Enter presses (UI-SPEC 7.5). A path or a node id is
// never drawn (UI-SPEC 13.2: no file path, node id or tool name on screen). Empty is P104,
// unreadable is M03, and before the first load finishes only the heading is drawn.
//
// A pure view: no `$`, no atom, no color value. Pressing a row runs `openSource` through the body
// kit's `act`; the press handler is the only place anything is written (engine rule 4).
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { plainBox } from '../../theme/plain'
import { ink } from '../ink'
import { panel } from '../room/panel'
import type { TabContext } from '../types'
import { openSource } from './model'
import type { SourceRow, SourcesLoad } from './model'

function row(ctx: TabContext, source: SourceRow, index: number): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key={`sources:row:${index}`} flexDirection="column" {...(ctx.mode.plain ? plainBox() : {})}>
      <Text bold {...color}>
        {source.title}
      </Text>
      {source.where !== null ? (
        <Text {...color}>{text('P102', { where: source.where })}</Text>
      ) : null}
      <Button
        key={`source:${index}`}
        label={text('P103')}
        onPress={() => {
          void openSource(ctx.act, source)
        }}
      />
    </Box>
  )
}

// `load` is null until the first load has finished (live mode only).
export function sourcesList(ctx: TabContext, load: SourcesLoad | null): RenderElement {
  const { Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  if (load === null) return panel(ctx, 'sources:list', text('P100'), [])
  if (load.state === 'unavailable') {
    return panel(ctx, 'sources:list', text('P100'), [
      <Text key="sources:unavailable" {...color}>
        {text('M03')}
      </Text>,
    ])
  }
  if (load.value.length === 0) {
    return panel(ctx, 'sources:list', text('P100'), [
      <Text key="sources:empty" {...color}>
        {text('P104')}
      </Text>,
    ])
  }
  return panel(
    ctx,
    'sources:list',
    text('P100'),
    load.value.map((source, index) => row(ctx, source, index)),
  )
}
