// Plan 07: the hint line, tier 1 of three (UI-SPEC 8.4). Only the keys that work now: the tab's
// own first four keys as dim text (each tab body draws its own pressable buttons with those
// hotkeys, and a letter must be unique among everything drawn at once, so the line only names
// them), then Help as a pressable plain button, Explain this when it fits, then Esc. When the pane
// does not hold the keyboard the whole line is replaced by N06, because a hotkey pressed while the
// person is typing in the prompt box must never fire (R-03).
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ink } from './ink'
import { HINT_TAB_KEYS } from './state'
import type { KeySpec, PaneEl, ShellActions } from './types'

export type HintInput = {
  // The whole key list of the tab (the line shows the first four).
  keys: KeySpec[]
  isFocused: boolean
  bodyColumns: number
  // While the all-keys panel is open it carries the Explain button, so the line gives it up.
  keysOpen: boolean
  mode: Mode
  theme: Theme | null
  act: ShellActions
}

const line = (k: KeySpec): string => k.key + ': ' + text(k.labelId)

export function hintLine(el: PaneEl, a: HintInput): RenderElement {
  const { Box, Text, Button } = el
  const color = ink(a.mode, a.theme)

  if (!a.isFocused) {
    return (
      <Box key="hint-line">
        <Text dimColor {...color}>
          {text('N06')}
        </Text>
      </Box>
    )
  }

  const shown = a.keys.slice(0, HINT_TAB_KEYS)
  const esc = 'Esc: ' + text('H06')
  const help = 'h: ' + text('H05')
  const explain = 'e: ' + text('H18')
  const width = [...shown.map(line), help, explain, esc].reduce((sum, s) => sum + s.length, 0) + 2 * (shown.length + 2)
  const withExplain = !a.keysOpen && width <= a.bodyColumns

  return (
    <Box key="hint-line" flexDirection="row" flexWrap="wrap" columnGap={2}>
      {shown.map((k) => (
        <Text dimColor {...color}>
          {line(k)}
        </Text>
      ))}
      <Button
        key="help"
        label={text('H05')}
        hotkey="h"
        plain
        onPress={() => {
          void a.act.toggleKeys()
        }}
      />
      {withExplain ? (
        <Button
          key="explain"
          label={text('H18')}
          hotkey="e"
          plain
          onPress={() => {
            void a.act.toggleExplain()
          }}
        />
      ) : null}
      <Text dimColor {...color}>
        {esc}
      </Text>
    </Box>
  )
}
