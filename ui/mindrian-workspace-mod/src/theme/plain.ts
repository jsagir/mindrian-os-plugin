// Plan 03: plain mode, decided in one place (UI-SPEC section 12.1). When plain mode is on, nothing
// this module returns carries a color or backgroundColor prop. The triggers, in order:
//   1. the person's switch (kept with $.store), note N01
//   2. the palette cannot be read or holds a bad value, note N03, no theme (never a baked-in color)
//   3. NO_COLOR set to any non-empty value, or TERM equal to dumb, note N01
// Step 3 is the UI-SPEC's R-15 candidate: the spec marked it UNVERIFIED because it assumed no
// environment access, and $.env.get exists; plan 17 item 11 measures what the host then does.
//
// ENGINE RULE (measured in plan 03): the engine's static scan follows `$` only into functions
// declared in the SAME file, never across an import, and a state read or write needs its atom or
// reference spelled in the same file too. So the decision itself is pure (decideMode, no `$`) and
// is what other plans call; resolveMode and setPlain hold the `$` reads and writes in this file for
// a hook declared here or for a hook file that spells the same three reads itself.
import type { EngineInterface } from 'claude-code'

import { PALETTE_ASSET, blockStyle, parseTheme } from './theme'
import type { BlockJob, BlockProps, Theme } from './theme'

export type Mode = { plain: boolean; note: 'N01' | 'N03' | null; theme: Theme | null }

// What the decision reads, all plain values: the stored switch (any value), the palette file text
// (null when the read failed), and the two environment variables.
export type ModeInputs = {
  switchOn: unknown
  paletteText: string | null
  noColor: string | undefined
  term: string | undefined
}

export function decideMode(input: ModeInputs): Mode {
  // 1. The person's switch.
  if (input.switchOn === true) return { plain: true, note: 'N01', theme: null }

  // 2. The palette. A failed or invalid read is N03, not N01: the person did not ask for it.
  const theme = input.paletteText === null ? null : parseTheme(input.paletteText)
  if (theme === null) return { plain: true, note: 'N03', theme: null }

  // 3. The environment: any non-empty NO_COLOR, or TERM equal to dumb.
  if ((input.noColor !== undefined && input.noColor !== '') || input.term === 'dumb') {
    return { plain: true, note: 'N01', theme: null }
  }

  return { plain: false, note: null, theme }
}

// The reads for decideMode, spelled where `$` is in scope. The three names are string literals
// (the engine lists them in validate).
export async function resolveMode($: EngineInterface): Promise<Mode> {
  const switchOn = await $.store.get('plain')
  let paletteText: string | null
  try {
    paletteText = await $.fs.read(`${$.plugin.root}/${PALETTE_ASSET}`)
  } catch {
    paletteText = null
  }
  const noColor = await $.env.get('NO_COLOR')
  const term = await $.env.get('TERM')
  return decideMode({ switchOn, paletteText, noColor, term })
}

// Keeps the person's choice for the next session (the store) and draws the next frame (the state
// value a render hook reads). The state reference is spelled here, with literal plugin and key.
export async function setPlain($: EngineInterface, on: boolean): Promise<void> {
  await $.store.set('plain', on)
  await $.state.set({ plugin: 'mindrian-workspace', key: 'plain' } as const, on)
}

// The Box props for a bordered panel in plain mode: a border and nothing colored.
export function plainBox(): { borderStyle: 'single' } {
  return { borderStyle: 'single' }
}

// The color props for a block of this job: none in plain mode (or with no theme), else the block's
// background and its legal text color.
export function paintProps(mode: Mode, theme: Theme | null, job: BlockJob): Partial<BlockProps> {
  if (mode.plain || theme === null) return {}
  return blockStyle(theme, job)
}
