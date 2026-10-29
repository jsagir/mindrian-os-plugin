import { expect, test } from 'claude-code/testing'

import { contextCanvas } from '../hooks/meter'

// Phase 380 plan 02 (T-380-04), kept in plan 13: sha256 pins of the context canvas, wide and compact
// (18 pins). The pins are the original ones of plan 02 and are not edited: the canvas is not part of
// the Theo face and D-10 did not change it. They lived in raster-pin.test.ts, next to the 84 state
// pins and the 18 crew pins of the older face drawings; plan 380-13 retired those 102 face pins (a
// deliberate visual change, README section Visual change) and moved these 18 here, value for value.
// Hash input: the JSON text of the raster output.

const PERCENTS = [0, 1, 17, 50, 62, 80, 99, 100]

const PIN: Record<string, string> = {
  'meter:wide:0': '33108a66e56e889f274986b6ba667d615994d88dc1148a7ba29ef679581c7189',
  'meter:compact:0': '2c4bb7dec20a2d182c277ee3f5cb3eacae720cd3d438fbc44dce8891cd40918a',
  'meter:wide:1': 'ff57d29d9506da2a110a6c0c96a1414e7c4031befc00e5f21f444afed9f409c5',
  'meter:compact:1': '5cc4c83bc284b09c3abff3afbc291b5fa35e842eede7cfbc3c1d67c2f693bf9f',
  'meter:wide:17': '6c68d7ba83241bb0dd737fc05d13dc5e6d1d1fcd90ae3e0bdd9202926fe2672c',
  'meter:compact:17': 'eca464cb382185c2e720b2d5539a24f7c161870c0ebab451191b0241f33c74b6',
  'meter:wide:50': 'bc2a096e48d4bf8949ab70350d788d233d183eda193512a9e2506609fbf5dffe',
  'meter:compact:50': 'c0fcdf1cb57841f26135d3e47f516ad3c04edccca2b2375918ec89416b30b6b9',
  'meter:wide:62': '655baee4203fff1d74f7509a74d15328b798f6a34c96ea18e39a8e2b1b60dc7e',
  'meter:compact:62': 'cbea16f95ffaca5af8293fd77f63b4cc5bedc3d9d13bc4b996634e99bd3284f3',
  'meter:wide:80': 'd23ebedfe8e7fcd2f3ffe95ecf3282499383ecf822b25ff2ccaa55917767c5b8',
  'meter:compact:80': '17ada5cde0b14edac849b1ccb224021b7ad3ca0ca6b43a0657235a1774892af5',
  'meter:wide:99': '22a915542954d969f44f94f111ac965bcff651e94047d2a475db9b2d7a1d1ca7',
  'meter:compact:99': '8135aa81f903c92f512eb2e7de4213c8c8c2224526c88841b2fda73318a56ea3',
  'meter:wide:100': 'ceb8ac7a29a0a3a04207423605608269caa2c095dfe1fc36d113f87c73cf52ae',
  'meter:compact:100': 'f40415970ad0551159d1fb07a16bec81b8eac409ec964cbc4d7a705047d10937',
  'meter:wide:undefined': '33108a66e56e889f274986b6ba667d615994d88dc1148a7ba29ef679581c7189',
  'meter:compact:undefined': '2c4bb7dec20a2d182c277ee3f5cb3eacae720cd3d438fbc44dce8891cd40918a',
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function mismatches(items: [string, string][]): Promise<string[]> {
  const bad: string[] = []
  for (const [key, text] of items) {
    const got = await sha256(text)
    if (PIN[key] !== got) bad.push(`${key} got ${got} want ${PIN[key] ?? 'none'}`)
  }
  return bad
}

test('R3: the context canvas, wide and compact, draws the same pixels as in plan 380-02', async () => {
  const items: [string, string][] = []
  for (const pct of PERCENTS) {
    items.push([`meter:wide:${pct}`, JSON.stringify(contextCanvas(pct, 32, 12))])
    items.push([`meter:compact:${pct}`, JSON.stringify(contextCanvas(pct, 32, 8))])
  }
  items.push(['meter:wide:undefined', JSON.stringify(contextCanvas(undefined, 32, 12))])
  items.push(['meter:compact:undefined', JSON.stringify(contextCanvas(undefined, 32, 8))])
  expect(items.length).toBe(PERCENTS.length * 2 + 2)
  expect(await mismatches(items)).toEqual([])
})
