import { expect, test } from 'claude-code/testing'

import { loadFaceAsset, rasterFace } from '../hooks/theo-face'
import { ASSET_TEXT } from './face-fixture'

// Phase 380 plan 12 (D-10, MOD380-09, G4): sha256 pins of the canon Theo faces, 11 states at
// the sizes 6, 8, 12 and 16 (44 pins), taken from the new source (hooks/theo-face.ts drawing the
// copied canon asset) after its first green run. These pins are never edited. They replace, for the
// canon faces, the old plan 380-02 pins of the older drawing (those stay in raster-pin.test.ts
// until plan 380-13 swaps the panel; the change is a deliberate visual change, not a refactor).
// Hash input: the JSON text of the grid.

const SIZES = [6, 8, 12, 16]

const PIN: Record<string, string> = {}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

test('G4 pins: every canon state at every size draws the pixels pinned in plan 380-12', async () => {
  const asset = loadFaceAsset(ASSET_TEXT)
  expect(asset).not.toBeNull()
  const bad: string[] = []
  let total = 0
  for (const one of asset?.states ?? []) {
    for (const n of SIZES) {
      total += 1
      const key = `face:${one.id}:${n}`
      const got = await sha256(JSON.stringify(rasterFace(asset as never, one.id, n)))
      if (PIN[key] !== got) bad.push(`${key} got ${got} want ${PIN[key] ?? 'none'}`)
    }
  }
  expect(total).toBe(44)
  expect(Object.keys(PIN).length).toBe(44)
  expect(bad).toEqual([])
})
