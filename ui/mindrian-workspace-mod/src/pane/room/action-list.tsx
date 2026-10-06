// Plan 15: "More things to do here" (UI-SPEC 7.3 ActionList, heading P123). Opened by the P52
// button on the Room tab (key m); this file draws the list under it. Each row is a registry row:
// its one-line reason (data), an "Add to my prompt" button (P122, no hotkey) and, only while the
// shell's details are open for the Room tab, the command's name (P124, the one place a name may
// appear). A press only adds the command to the prompt box for the person to read and send; the
// mod never runs a command and never submits (T-369.26-15-01).
//
// The folder filter is a Select where the surface draws one (terminal, desktop, vscode) and one
// button per option on mobile (its table has no Select; the resolved table lists one anyway, so the
// surface is asked for by name). Its first option is P121 and the rest are
// the folders of the job canon. There is no problem-type filter: the registry has no such field,
// and a control with nothing behind it is not drawn (UI-SPEC R-11).
//
// C-29: every control (Button, Select) sits on a black chip; the selected filter option is marked
// with a greater-than sign (C-30, C-32), never a color; the details line is plain black text on the cream page, never dim.
//
// A pure view: no `$`, no atom, no color value. State is the Room slice of the body kit, read from
// `ctx.body.room`; writes happen in the presses below, never while drawing.
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { prefillRecorded } from '../../runtime/prefill'
import { ground, ink, selectedLabel, soft } from '../ink'
import type { TabContext } from '../types'
import { panel } from './panel'
import { ALL_FOLDERS, effectiveFilter, filterRows, pickFolder, readActionsState } from './registry-model'
import type { ActionRow, ActionsLoad } from './registry-model'

type FilterOption = { value: string; label: string }

// P121 first, then one option per folder the canon knows, as the canon spells it.
function filterOptions(load: Extract<ActionsLoad, { state: 'ok' }>): FilterOption[] {
  return [{ value: ALL_FOLDERS, label: text('P121') }, ...Object.keys(load.canon).map((folder) => ({ value: folder, label: folder }))]
}

function currentFolder(ctx: TabContext): string | null {
  const folder = ctx.vm.place.folder
  return folder.state === 'ok' ? folder.value : null
}

// The P120 label and the picker, on this surface.
function filterControl(ctx: TabContext, load: Extract<ActionsLoad, { state: 'ok' }>, chosen: string): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const options = filterOptions(load)
  if (ctx.surface !== 'mobile' && 'Select' in ctx.el) {
    const { Select } = ctx.el
    return (
      <Box key="room:actions-filter" flexDirection="row" columnGap={1}>
        <Text {...color}>{text('P120')}</Text>
        <Box key="room:actions-filter-ground" {...ground(ctx.mode, ctx.theme)}>
          <Select
            key="actions:filter"
            options={options}
            value={chosen}
            onSelect={(value) => {
              void pickFolder(ctx.act, load, value)
            }}
          />
        </Box>
      </Box>
    )
  }
  return (
    <Box key="room:actions-filter" flexDirection="column">
      <Text {...color}>{text('P120')}</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {options.map((option, index) => (
          <Box key={'actions:filter-ground-' + index} {...ground(ctx.mode, ctx.theme)}>
            <Button
              key={'actions:filter-' + index}
              label={option.value === chosen ? selectedLabel(option.label) : option.label}
              plain
              onPress={() => {
                void pickFolder(ctx.act, load, option.value)
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function rowView(ctx: TabContext, row: ActionRow, index: number): RenderElement {
  const { Box, Text, Button } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  return (
    <Box key={'room:action-' + index} flexDirection="column" marginTop={1}>
      <Text {...color}>{row.summary}</Text>
      <Box key={'action-ground:' + index} {...ground(ctx.mode, ctx.theme)}>
        <Button
          key={'action:' + index}
          label={text('P122')}
          onPress={() => {
            // Only add the command, exactly as the registry stores it, to the prompt box.
            void prefillRecorded(ctx.act, row.command)
          }}
        />
      </Box>
      {ctx.detailsOpen ? (
        <Text {...soft(ctx.mode)} {...color}>
          {text('P124', { name: row.command })}
        </Text>
      ) : null}
    </Box>
  )
}

// The open list. Nothing is drawn for a closed one (the body draws only the P52 button then).
export function actionList(ctx: TabContext): RenderElement {
  const { Text } = ctx.el
  const color = ink(ctx.mode, ctx.theme)
  const state = readActionsState(ctx.body.room)

  if (state.load === null) {
    // The read is still on its way: the heading alone.
    return panel(ctx, 'room:actions-list', text('P123'), [])
  }
  if (state.load.state === 'unavailable') {
    return panel(ctx, 'room:actions-list', text('P123'), [
      <Text key="room:actions-missing" {...color}>
        {text('M03')}
      </Text>,
    ])
  }
  const load = state.load
  const chosen = effectiveFilter(load.canon, state.picked, currentFolder(ctx))
  const rows = filterRows(load.rows, load.canon, chosen)
  return panel(ctx, 'room:actions-list', text('P123'), [
    filterControl(ctx, load, chosen),
    ...rows.map((row, index) => rowView(ctx, row, index)),
  ])
}
