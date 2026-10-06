// Plan 07: the pane shell, a pure view. buildPane(el, input, deps) returns the tree for one frame:
// the tab strip first (no title row of its own, C-18), the notes, then the active tab's body. The
// hook file (src/registrars/pane.tsx) reads state and the environment, builds `input` and the
// action closures, and calls this. Nothing here touches `$`: the engine scan follows `$` only in
// the file that holds it (369.26-ENGINE-RULES.md rule 1), which is also why the plan's
// renderPane($, e, deps) is this view function instead.
import type { RenderElement } from 'claude-code'

import { text } from '../copy/text'
import type { ViewModel } from '../model/view-model'
import type { TabId } from '../runtime/ids'
import type { Mode } from '../theme/plain'
import type { Theme } from '../theme/theme'
import { ink, page } from './ink'
import { paneLayout } from './layout'
import { tabStrip } from './tab-strip'
import type { Surface } from './tab-strip'
import type { KeySpec, PaneEl, ShellActions, TabBody, TabContext } from './types'

export type { ShellActions } from './types'

export type PaneInput = {
  surface: Surface
  tab: TabId
  // Null when no live model has been read yet and no sample is set: the shell draws only the strip.
  vm: ViewModel | null
  mode: Mode
  theme: Theme | null
  bodyColumns: number
  isFocused: boolean
  working: boolean
  keysOpen: boolean
  explainOpen: boolean
  detailsOpen: Record<TabId, boolean>
  act: ShellActions
}

export type PaneDeps = { bodies: Record<TabId, TabBody | undefined> }

// A body that throws costs nothing: the shell draws without it.
export function safeView(body: TabBody | undefined, ctx: TabContext | null): RenderElement | null {
  if (body === undefined || ctx === null) return null
  try {
    return body.view(ctx)
  } catch {
    return null
  }
}

export function safeKeys(body: TabBody | undefined, ctx: TabContext | null): KeySpec[] {
  if (body === undefined || ctx === null) return []
  try {
    return body.keys(ctx)
  } catch {
    return []
  }
}

export function buildPane(el: PaneEl, input: PaneInput, deps: PaneDeps): RenderElement {
  const { Box, Text } = el
  const { mode, theme, tab } = input
  const layout = paneLayout(input.bodyColumns)
  const body = deps.bodies[tab]
  const ctx: TabContext | null =
    input.vm === null
      ? null
      : {
          el,
          vm: input.vm,
          theme,
          mode,
          bodyColumns: input.bodyColumns,
          isFocused: input.isFocused,
          tab,
          act: input.act,
        }

  const strip = tabStrip(el, {
    tab,
    mode,
    theme,
    layout,
    surface: input.surface,
    onTab: (id) => {
      void input.act.setTab(id)
    },
  })

  // Notes, each at most once: the sample banner, the mode note, the narrow note, the working note.
  const notes: string[] = []
  if (input.vm !== null && input.vm.source === 'sample') notes.push(text('N04'))
  if (mode.note === 'N01') notes.push(text('N01'))
  if (mode.note === 'N03') notes.push(text('N03'))
  if (layout.widthNote) notes.push(text('N05'))
  if (input.working) notes.push(text('P05'))

  const bodyEl = safeView(body, ctx)

  return (
    <Box flexDirection="column" width={input.bodyColumns} {...page(mode, theme)}>
      {strip}
      {notes.map((note) => (
        <Text {...ink(mode, theme)}>{note}</Text>
      ))}
      {bodyEl}
    </Box>
  )
}
