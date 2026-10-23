import { expect, test } from 'claude-code/testing'

import { LABEL, gridRuns } from '../hooks/face'
import { FACE_STATES } from '../hooks/face-events'
import { loadFaceAsset, rasterFace } from '../hooks/theo-face'
import { ASSET_TEXT } from './face-fixture'

// Phase 380 plan 13 (D-10, MOD380-09), W11: the contact sheet source.
//
// This test rasterizes each of the 11 canon states at n 12 through the real loader (the asset text
// comes from the generated fixture) and prints each grid as ANSI half-block text between the lines
// FACESHEET_BEGIN and FACESHEET_END, one block per state, headed by the canon label. The script
// scripts/face-sheet.cjs runs this test, reads the block and builds the contact sheet PNG.
//
// A block starts with the line "FACE <id> <label>" and holds n / 2 rows of text. Each row paints the
// top pixel with the foreground color and the bottom pixel with the background color of a half block,
// the way the panel does. Only palette colors come out of the rasterizer.
// Hyphens only.

const SIZE = 12
const ESC = String.fromCharCode(27)

const rgb = (hex: string): string => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(';')

const log = (globalThis as unknown as { console: { log: (text: string) => void } }).console.log

test('W11 sheet: each of the 11 states is rasterized at n 12 through the real loader and printed as ANSI between FACESHEET_BEGIN and FACESHEET_END', () => {
  const asset = loadFaceAsset(ASSET_TEXT)
  expect(asset).not.toBeNull()
  if (asset === null) return

  const lines: string[] = ['FACESHEET_BEGIN']
  let blocks = 0
  for (const id of FACE_STATES) {
    const grid = rasterFace(asset, id, SIZE)
    expect(`${id} ${grid !== null}`).toBe(`${id} true`)
    if (grid === null) continue
    lines.push(`FACE ${id} ${LABEL[id]}`)
    for (const runs of gridRuns(grid)) {
      lines.push(`${runs.map(run => `${ESC}[38;2;${rgb(run.top)}m${ESC}[48;2;${rgb(run.bottom)}m${'▀'.repeat(run.w)}`).join('')}${ESC}[0m`)
    }
    blocks += 1
  }
  lines.push('FACESHEET_END')
  for (const line of lines) log(line)

  expect(blocks).toBe(11)
  expect(lines.filter(line => line.startsWith('FACE ')).length).toBe(11)
  expect(lines.length).toBe(11 * (1 + SIZE / 2) + 2)
  // The label heads each block, and it is the asset label.
  expect(lines).toContain('FACE limit Nothing found')
  expect(lines).toContain('FACE search Searching')
})
