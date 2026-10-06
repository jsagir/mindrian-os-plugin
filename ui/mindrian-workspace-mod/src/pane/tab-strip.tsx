// Plan 07: the tab strip (UI-SPEC 6.2, 7.2 PaneTabs, 10.6, 12.2). Four buttons keyed tab:room,
// tab:think, tab:sources, tab:review, labels P01 to P04, and NO letter or digit keys: digits stay free for the
// decision card (C-24). The strip is a black heading bar (C-29: a Button label is the host's light
// color, so it needs a black or blue ground, never the cream page); the active tab is a blue block
// with the primary variant, the others sit on black. In plain mode the active tab is a bold inverse
// label with a greater-than mark and nothing is colored. Under 30 columns the strip becomes a Select
// (also on the black bar) on terminal and desktop (buttons stay on vscode and mobile).
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import { TAB_IDS } from '../runtime/ids'
import type { TabId } from '../runtime/ids'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { block, ground } from './ink'
import type { PaneLayout } from './layout'
import type { PaneEl } from './types'

export type Surface = 'terminal' | 'desktop' | 'vscode' | 'mobile'

export type TabStripInput = {
  tab: TabId
  mode: Mode
  theme: Theme | null
  layout: PaneLayout
  surface: Surface
  onTab: (tab: TabId) => void
}

const LABEL = { room: 'P01', think: 'P02', sources: 'P03', review: 'P04' } as const

export function tabLabel(tab: TabId): string {
  return text(LABEL[tab])
}

// The keyed button the shell asks the engine to focus after a tab press (UI-SPEC 8.3): the active
// tab's own button, or in plain mode (where the active tab is a label, not a button) the first
// button of the strip.
export function tabFocusKey(tab: TabId, plain: boolean, narrow: boolean, surface: Surface): string {
  if (narrow && (surface === 'terminal' || surface === 'desktop')) return 'tab:select'
  if (!plain) return 'tab:' + tab
  const first = TAB_IDS.find((id) => id !== tab)
  return 'tab:' + (first ?? tab)
}

export function tabStrip(el: PaneEl, a: TabStripInput): RenderElement {
  const { Box, Text, Button } = el

  if (a.layout.tabsAsSelect && 'Select' in el && (a.surface === 'terminal' || a.surface === 'desktop')) {
    const { Select } = el
    return (
      <Box flexDirection="row" {...ground(a.mode, a.theme, 'frame', { wide: true })}>
        <Select
          key="tab:select"
          options={TAB_IDS.map((id) => ({ value: id, label: tabLabel(id) }))}
          value={a.tab}
          onSelect={(value) => {
            const picked = TAB_IDS.find((id) => id === value)
            if (picked !== undefined) a.onTab(picked)
          }}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1} {...block(a.mode, a.theme, 'frame')}>
      {TAB_IDS.map((id) => {
        const active = id === a.tab
        if (active && a.mode.plain) {
          // Plain mode: the active tab is a bold inverse label with a greater-than mark.
          return (
            <Text bold inverse>
              {'> ' + tabLabel(id)}
            </Text>
          )
        }
        return (
          <Box {...ground(a.mode, a.theme, active ? 'where' : 'frame')}>
            <Button
              key={'tab:' + id}
              label={tabLabel(id)}
              {...(active ? { variant: 'primary' as const } : {})}
              onPress={() => {
                a.onTab(id)
              }}
            />
          </Box>
        )
      })}
    </Box>
  )
}
