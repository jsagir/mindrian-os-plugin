// Plan 07: the all-keys panel, tier 2 of three (UI-SPEC 8.5). Opened by `h`: every key that works
// in this tab with its plain label, Explain this, then how to move around. In plain mode it is a
// bordered box (12.2).
//
// Plan 08 adds the band's keys as pressable buttons (UI-SPEC 10.5, INV-SL-4): Open workspace always,
// Run a checkup only when the room has a problem, Save my thinking only at the context limit. A
// one-row band cannot show them, so Help is where a problem's one-tap fix lives. They only move
// to a tab or add a sentence to the prompt box (src/runtime/prefill.ts); none submits or writes.
// C-29: each button sits on its own black chip (the host's light label color needs a black ground).
import type { RenderElement } from 'claude-code'

import type { FixFlags } from '../band/alerts'
import { text } from '../copy/text'
import { prefillPrompt } from '../runtime/prefill'
import type { Mode } from '../theme/plain'
import { plainBox } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ground, ink } from './ink'
import type { KeySpec, PaneEl, ShellActions } from './types'

export type KeysPanelInput = {
  // The tab's whole key list (body keys, then the details key where armed).
  keys: KeySpec[]
  mode: Mode
  theme: Theme | null
  act: ShellActions
  // Which of the band's keys are armed; absent draws none of them.
  fixes?: FixFlags
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
      {a.fixes === undefined ? null : (
        <Box key="keys:open-ground" {...ground(a.mode, a.theme)}>
          <Button
            key="keys:open"
            label={text('B84')}
            hotkey="o"
            plain
            onPress={() => {
              void a.act.setTab(a.fixes?.openTab ?? 'room')
            }}
          />
        </Box>
      )}
      {a.fixes !== undefined && a.fixes.checkup ? (
        <Box key="keys:checkup-ground" {...ground(a.mode, a.theme)}>
          <Button
            key="keys:checkup"
            label={text('B44')}
            hotkey="r"
            plain
            onPress={() => {
              void prefillPrompt(a.act, 'Q06')
            }}
          />
        </Box>
      ) : null}
      {a.fixes !== undefined && a.fixes.save ? (
        <Box key="keys:save-ground" {...ground(a.mode, a.theme)}>
          <Button
            key="keys:save"
            label={text('B55')}
            hotkey="k"
            plain
            onPress={() => {
              void prefillPrompt(a.act, 'Q07')
            }}
          />
        </Box>
      ) : null}
      <Box key="keys:explain-ground" {...ground(a.mode, a.theme)}>
        <Button
          key="explain"
          label={text('H18')}
          hotkey="e"
          plain
          onPress={() => {
            void a.act.toggleExplain()
          }}
        />
      </Box>
      <Text bold {...color}>
        {text('H21')}
      </Text>
      <Text {...color}>{text('H22')}</Text>
    </Box>
  )
}
