import type { EngineInterface } from 'claude-code'

// The canon Theo faces, drawn from the canon asset (Phase 380 plan 12, D-10, MOD380-09).
//
// Source: mos-brand book e947a5d (read only), segment identity/theo, asset asset-fa8504998f.json
// (the geometry of the 11 states on a 400 unit master) and the renderer asset-d96217b320.js. The
// asset is copied byte for byte into assets/ (tests/test-380-theo-faces.cjs pins its sha256). This
// file holds NO pose number: the geometry is read from the asset text at run time. What it does
// hold are the fixed numbers of the canon renderer's 400 unit box (the frame, the bar thickness,
// the edge), which are not poses.
//
// Three steps, all pure functions:
//   loadFaceAsset(text)       parse and check the asset; null on any fault
//   composeFace(asset, id)    the parts the canon renderer draws, in its order
//   rasterFace(asset, id, n)  the parts as an n by n block grid of palette colors, no animation
//
// Nothing here loops or ticks: the canon renderer eases between states over 760 ms, a terminal
// cannot ease, so the face changes state at once and never moves for decoration (mos-brand book
// e947a5d, segment experience/terminal: the face may change between states and never loops).
// The old drawings stay in face.ts until plan 380-13 swaps the panel over.

// ---- palette (mos-brand book e947a5d, foundations/color) --------------------------------------

const C_PAPER = '#F7F5EE'
const C_INK = '#111111'
const C_WHITE = '#FFFFFF'
const C_COBALT = '#1F3FBF'
const C_RED = '#D6281F'
const C_YELLOW = '#F2C200'
const C_SOFT = '#4B4943'
const TOKENS: readonly string[] = [C_PAPER, C_INK, C_WHITE, C_COBALT, C_RED, C_YELLOW, C_SOFT]

// ---- the fixed numbers of the canon renderer's 400 unit box ----------------------------------

const BOX = 400
const FRAME_AT = 7 // the frame rectangle starts here, and its stroke is twice this wide
const FRAME_SIZE = 386
const TOP = 14 // the planes and bars start at the top edge of the frame
const EDGE = 386 // and end at the right and bottom edge of the frame
const BAR_HALF = 7 // half the thickness of the two ink bars
const HOLLOW_STROKE = 8 // the outline of a hollow shape
const FRAME_OVERSTATE = 2 // the frame is drawn as a one cell ring only while a cell is under 2 times its stroke

// ---- types ------------------------------------------------------------------------------------

export type CanonState =
  | 'rest'
  | 'listen'
  | 'search'
  | 'found'
  | 'challenge'
  | 'contradiction'
  | 'reframe'
  | 'limit'
  | 'decision'
  | 'boundary'
  | 'handover'

const STATE_IDS: readonly CanonState[] = [
  'rest',
  'listen',
  'search',
  'found',
  'challenge',
  'contradiction',
  'reframe',
  'limit',
  'decision',
  'boundary',
  'handover',
]

export type FacePose = {
  e1: [number, number, number, number]
  e2: [number, number, number, number]
  s: [number, number, number, number, number]
  r: [number, number]
  plane: string
  c1: string
  c2: string
  hollow: boolean
}

export type FaceState = { id: CanonState; label: string; source: string; pose: FacePose }

export type FaceAsset = { version: string; states: FaceState[] }

export type PartName = 'ground' | 'plane' | 'vertical' | 'horizontal' | 'bar' | 'one' | 'two' | 'frame'

// One drawn part. x, y, width and height are on the 400 unit master. The bar is a rectangle
// centered on its own origin (x and y are negative), drawn after translate(rotate.x, rotate.y) and
// rotate(rotate.deg), the way the canon renderer draws it.
export type Part = {
  name: PartName
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke?: string
  strokeWidth?: number
  rotate?: { x: number; y: number; deg: number }
}

// Where the asset sits: the dev folder first, the shipped dist second (plan 380-08 copies it there).
export const FACE_ASSET_PATHS: string[] = ['assets/asset-fa8504998f.json', 'lib/mos-face/dist/assets/asset-fa8504998f.json']

// ---- loading ----------------------------------------------------------------------------------

const isNumbers = (value: unknown, length: number): boolean =>
  Array.isArray(value) && value.length === length && value.every(one => typeof one === 'number' && Number.isFinite(one) && Math.abs(one) <= 2000)

const isToken = (value: unknown): value is string => typeof value === 'string' && TOKENS.includes(value)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// Parse and check the asset text. Any fault gives null: the panel then falls back to words.
export function loadFaceAsset(text: string): FaceAsset | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data) || !Array.isArray(data.states) || data.states.length !== STATE_IDS.length) return null
  const states: FaceState[] = []
  for (const raw of data.states as unknown[]) {
    if (!isRecord(raw) || !isRecord(raw.pose)) return null
    const id = raw.id
    if (typeof id !== 'string' || !STATE_IDS.includes(id as CanonState) || states.some(one => one.id === id)) return null
    if (typeof raw.label !== 'string' || raw.label.trim() === '') return null
    if (typeof raw.source !== 'string' || raw.source.trim() === '') return null
    const p = raw.pose
    if (!isNumbers(p.e1, 4) || !isNumbers(p.e2, 4) || !isNumbers(p.s, 5) || !isNumbers(p.r, 2)) return null
    if (!isToken(p.plane) || !isToken(p.c1) || !isToken(p.c2) || typeof p.hollow !== 'boolean') return null
    states.push({
      id: id as CanonState,
      label: raw.label,
      source: raw.source,
      pose: {
        e1: p.e1 as FacePose['e1'],
        e2: p.e2 as FacePose['e2'],
        s: p.s as FacePose['s'],
        r: p.r as FacePose['r'],
        plane: p.plane,
        c1: p.c1,
        c2: p.c2,
        hollow: p.hollow,
      },
    })
  }

  return { version: typeof data.version === 'string' ? data.version : '', states }
}

export type FaceRead = { asset: FaceAsset | null; path: string | null; reason: string }

// Read the asset through the engine. Both candidates are tried in order. When both fail the answer
// is null with a plain sentence, and no pose is invented.
export async function readFaceAsset($: EngineInterface): Promise<FaceRead> {
  for (const relative of FACE_ASSET_PATHS) {
    try {
      const text = await $.fs.read(`${$.plugin.root}/${relative}`)
      const asset = loadFaceAsset(String(text))
      if (asset !== null) return { asset, path: relative, reason: '' }
    } catch {
      // Try the next place.
    }
  }

  return { asset: null, path: null, reason: 'The Theo face drawings could not be read, so the panel shows words only.' }
}

// ---- composition ------------------------------------------------------------------------------

// The parts of one state in the canon draw order: the ground, the plane, the upright bar, the
// level bar, the tilted bar, the two eyes, the frame. The numbers come from the pose.
export function composeFace(asset: FaceAsset, id: string): Part[] | null {
  const state = asset.states.find(one => one.id === id)
  if (state === undefined) return null
  const p = state.pose
  const [rx, ry] = p.r
  const [sx, sy, deg, length, thick] = p.s
  const outline = p.hollow ? { stroke: C_INK, strokeWidth: HOLLOW_STROKE } : { stroke: C_INK, strokeWidth: 0 }
  const eye = (name: 'one' | 'two', box: FacePose['e1'], color: string): Part => ({
    name,
    x: box[0] - box[2] / 2,
    y: box[1] - box[3] / 2,
    width: box[2],
    height: box[3],
    fill: p.hollow ? C_WHITE : color,
    ...outline,
  })

  return [
    { name: 'ground', x: 0, y: 0, width: BOX, height: BOX, fill: C_PAPER },
    { name: 'plane', x: rx + BAR_HALF, y: TOP, width: EDGE - BAR_HALF - rx, height: ry - TOP - BAR_HALF, fill: p.plane },
    { name: 'vertical', x: rx - BAR_HALF, y: TOP, width: BAR_HALF * 2, height: BOX - TOP * 2, fill: C_INK },
    { name: 'horizontal', x: rx, y: ry - BAR_HALF, width: EDGE - rx, height: BAR_HALF * 2, fill: C_INK },
    {
      name: 'bar',
      x: -thick / 2,
      y: -length / 2,
      width: thick,
      height: length,
      fill: p.hollow ? C_WHITE : C_INK,
      ...outline,
      rotate: { x: sx, y: sy, deg },
    },
    eye('one', p.e1, p.c1),
    eye('two', p.e2, p.c2),
    { name: 'frame', x: FRAME_AT, y: FRAME_AT, width: FRAME_SIZE, height: FRAME_SIZE, fill: 'none', stroke: C_INK, strokeWidth: FRAME_AT * 2 },
  ]
}

// ---- rasterizing ------------------------------------------------------------------------------
//
// The rule, in plain words. The 400 unit tile is cut into n by n cells. A cell takes the fill of
// the last part (in the canon draw order) that covers the cell's center. There is no blending, so
// only palette colors can come out.
//   - A bar or an eye thinner than one cell is widened to one cell about its center, so a thin
//     line (the 14 unit bars, the 12 unit eyes of Boundary) never disappears.
//   - A stroked outline (the hollow faces) is an outline of cells. When the stroke is thinner than a
//     cell, which holds at every size the panel draws, the outline is the one cell ring of the
//     shape, and the cells inside it keep the fill. When the stroke is a cell or thicker, it is the
//     band between the shape grown by half the stroke and the shape shrunk by half the stroke.
//   - The frame: the true band when its stroke is a cell or thicker. When it is thinner than a
//     cell it is a one cell ring at the edge of the tile, but only while a cell is under twice the
//     stroke (size 15 and up). At the coarser sizes a ring would be most of the face (plan 380-12:
//     PNG of sizes 6 and 8 with the ring was nearly all ink), so the frame is left out there, as the
//     older drawing left it out. This is a recorded deviation from the plan text.
//   - The tilted bar is tested after turning the cell center back by the bar's angle.
//   - A cell on the edge of a shape belongs to it on its left and top side only (half open
//     interval), so a shape that is exactly one cell wide covers one cell, not two.

type Shape = { cx: number; cy: number; hw: number; hh: number; cos: number; sin: number }

const shapeOf = (cx: number, cy: number, width: number, height: number, deg: number, widen: number): Shape => {
  const rad = (deg * Math.PI) / 180

  return { cx, cy, hw: Math.max(width, widen) / 2, hh: Math.max(height, widen) / 2, cos: Math.cos(rad), sin: Math.sin(rad) }
}

const grow = (s: Shape, by: number): Shape => ({ ...s, hw: s.hw + by, hh: s.hh + by })

const covers = (s: Shape, x: number, y: number): boolean => {
  if (s.hw <= 0 || s.hh <= 0) return false
  const dx = x - s.cx
  const dy = y - s.cy
  const u = dx * s.cos + dy * s.sin
  const v = -dx * s.sin + dy * s.cos

  return u >= -s.hw && u < s.hw && v >= -s.hh && v < s.hh
}

const maskOf = (n: number, px: number, s: Shape): boolean[][] =>
  Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => covers(s, (c + 0.5) * px, (r + 0.5) * px)))

// The cells of a mask that touch a cell outside the mask (or the edge of the grid) on a side.
const ringOf = (mask: boolean[][]): boolean[][] =>
  mask.map((row, r) =>
    row.map((on, c) => on && !(mask[r - 1]?.[c] === true && mask[r + 1]?.[c] === true && row[c - 1] === true && row[c + 1] === true)),
  )

export function rasterFace(asset: FaceAsset, id: string, n: number): string[][] | null {
  const parts = composeFace(asset, id)
  if (parts === null || !Number.isInteger(n) || n < 2) return null
  const px = BOX / n
  const grid: string[][] = Array.from({ length: n }, () => Array<string>(n).fill(C_PAPER))
  const paint = (mask: boolean[][], color: string): void => {
    mask.forEach((row, r) => row.forEach((on, c) => {
      const line = grid[r]
      if (on && line !== undefined) line[c] = color
    }))
  }

  for (const part of parts) {
    if (part.name === 'ground') continue
    const rotate = part.rotate
    const cx = rotate !== undefined ? rotate.x : part.x + part.width / 2
    const cy = rotate !== undefined ? rotate.y : part.y + part.height / 2
    const deg = rotate !== undefined ? rotate.deg : 0
    const thin = part.name !== 'plane' && part.name !== 'frame'
    const stroke = part.stroke !== undefined && (part.strokeWidth ?? 0) > 0 ? part.stroke : null
    const strokeWidth = part.strokeWidth ?? 0

    if (part.name === 'frame') {
      // No fill. The band is centered on the frame rectangle.
      if (stroke === null) continue
      const outer = shapeOf(cx, cy, part.width + strokeWidth, part.height + strokeWidth, 0, 0)
      if (strokeWidth < px) {
        // A ring is one cell. It overstates the stroke by px / strokeWidth. Past 2 times the face
        // would be mostly frame (measured at sizes 6 and 8: nearly all ink), so the frame is left out.
        if (px < strokeWidth * FRAME_OVERSTATE) paint(ringOf(maskOf(n, px, outer)), stroke)
      } else {
        const band = maskOf(n, px, outer)
        const inner = maskOf(n, px, grow(outer, -strokeWidth))
        paint(band.map((row, r) => row.map((on, c) => on && inner[r]?.[c] !== true)), stroke)
      }
      continue
    }

    const base = shapeOf(cx, cy, part.width, part.height, deg, thin ? px : 0)
    const mask = maskOf(n, px, base)
    if (stroke === null) {
      paint(mask, part.fill)
    } else if (strokeWidth < px) {
      paint(mask, part.fill)
      paint(ringOf(mask), stroke)
    } else {
      paint(maskOf(n, px, grow(base, strokeWidth / 2)), stroke)
      paint(maskOf(n, px, grow(base, -strokeWidth / 2)), part.fill)
    }
  }

  return grid
}
