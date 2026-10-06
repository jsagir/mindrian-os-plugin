// Plan 07: the all-keys panel, tier 2 of three (UI-SPEC 8.5). Opened by `h`: every key that works
// in this tab with its plain label, Explain this, then how to move around. In plain mode it is a
// bordered box (12.2).
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Mode } from '../theme/plain'
import { plainBox } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ink } from './ink'
import type { KeySpec, PaneEl, ShellActions } from './types'

export type KeysPanelInput = {
  // The tab's whole key list (body keys, then the details key where armed).
  keys: KeySpec[]
  mode: Mode
  theme: Theme | null
  act: ShellActions
}

export function keysPanel(el: PaneEl, a: KeysPanelInput): RenderElement {
  const { Box, Text, Button } = el
  const color = ink(a.mode, a.theme)
  const rows: KeySpec[] = [...a.keys, { key: 'h', labelId: 'H05' }]
  return (
    <Box key="keys-panel" flexDirection="column" {...(a.mode.plain ? plainBox() : {})}>
      <Text bold {...color}>
        {text('H20')}
      </Text>
      {rows.map((k) => (
        <Text {...color}>{k.key + ': ' + text(k.labelId)}</Text>
      ))}
      <Button
        key="explain"
        label={text('H18')}
        hotkey="e"
        plain
        onPress={() => {
          void a.act.toggleExplain()
        }}
      />
      <Text bold {...color}>
        {text('H21')}
      </Text>
      <Text {...color}>{text('H22')}</Text>
    </Box>
  )
}
