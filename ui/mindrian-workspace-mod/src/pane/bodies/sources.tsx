// Plan 13 (replaces the plan 01 seam): the Sources tab (UI-SPEC 7.5, 6.2, 13.2). It lists where the
// evidence behind the waiting decisions comes from, one row per source, and reads one in the pane
// without leaving it. Only what resolves through the room is drawn (UI-SPEC 10.4).
//
// The list loads when the tab opens (`onOpen`); in sample mode the list comes from the labeled
// fixtures through the same model seam, with no MCP call. State is the `sources` slice of the one
// `body` key (`rows`, `reading`), narrowed by `isSourcesState`: no atom, no `.d.ts`. Engine rules
// (369.26-ENGINE-RULES.md): no `$` and no atom here; the body reads `ctx.body` and acts through
// `ctx.act` (the plan 11 body kit).
//
// With no data room bound the body draws only P12 (UI-SPEC 10.3). The Back key `b` (H07) exists only
// while a reading is open; the shell appends `s` and `h`.
import type { RenderElement } from 'claude-code'

import { text } from '../../copy/text'
import { ink } from '../ink'
import { sourcesList } from '../sources/list'
import { sampleSources } from '../sources/fixtures'
import { closeReading, isSourcesState, loadSources } from '../sources/model'
import type { Reading, SourcesLoad, SourcesState } from '../sources/model'
import { readingView } from '../sources/reading'
import type { KeySpec, TabBody, TabContext } from '../types'

function stateOf(ctx: TabContext): SourcesState {
  const slice = ctx.body.sources
  return isSourcesState(slice) ? slice : {}
}

// The list to draw: a sample's own list, else what the last load wrote (null until it has).
function rowsOf(ctx: TabContext): SourcesLoad | null {
  if (ctx.vm.source === 'sample') return sampleSources(ctx.vm.sampleName)
  return stateOf(ctx).rows ?? null
}

function readingOf(ctx: TabContext): Reading | null {
  return stateOf(ctx).reading ?? null
}

function view(ctx: TabContext): RenderElement {
  const { Box, Text } = ctx.el
  if (!ctx.vm.place.isBound) {
    return (
      <Box key="sources:body" flexDirection="column">
        <Text {...ink(ctx.mode, ctx.theme)}>{text('P12')}</Text>
      </Box>
    )
  }
  const reading = readingOf(ctx)
  return (
    <Box key="sources:body" flexDirection="column">
      {reading !== null ? readingView(ctx, reading) : sourcesList(ctx, rowsOf(ctx))}
    </Box>
  )
}

function keys(ctx: TabContext): KeySpec[] {
  if (!ctx.vm.place.isBound) return []
  return readingOf(ctx) !== null ? [{ key: 'b', labelId: 'H07' }] : []
}

export const sourcesBody: TabBody = {
  view,
  keys,
  explainId: 'X03',
  // Opening the tab closes any reading that was open and loads the list again.
  onOpen: async (act) => {
    await closeReading(act)
    await loadSources(act)
  },
}
