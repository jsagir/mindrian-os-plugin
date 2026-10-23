import type { FaceState, Move } from '../types'

// The Theo face: poses and rasterizers, as pure functions. Nothing here draws.

// ---- Brand colors (De Stijl primaries from the brand book) -----------------

export const PAPER = '#F7F5EE'
export const INK = '#111111'
export const WHITE = '#FFFFFF'
export const BLUE = '#1F3FBF'
export const RED = '#D6281F'
export const YELLOW = '#F2C200'
export const MUTED = '#4B4943'
export const HOLLOW = '#8F8B80'

export const MOVE_BG: Record<Move, string> = {
  none: MUTED,
  blue: BLUE,
  red: RED,
  yellow: YELLOW,
  black: INK,
  white: WHITE,
}
export const MOVE_FG: Record<Move, string> = {
  none: PAPER,
  blue: PAPER,
  red: PAPER,
  yellow: INK,
  black: PAPER,
  white: INK,
}
export const MOVE_NAME: Record<Move, string> = {
  none: 'host',
  blue: 'building',
  red: 'challenging',
  yellow: 'contradiction',
  black: 'gate',
  white: 'hand-over',
}

// ---- Theo face poses, copied from robot-faces.json v2.6.0 (t_* states) ------

export type Pose = {
  e1: [number, number, number, number]
  e2: [number, number, number, number]
  s: [number, number, number, number, number]
  plane: string
  c1: string
  c2: string
  hollow: boolean
  edge: number
  run: boolean
}

export const POSES: Record<FaceState, Pose> = {
  rest: { e1: [312, 120, 46, 46], e2: [312, 300, 46, 46], s: [110, 205, 0, 250, 34], plane: WHITE, c1: INK, c2: INK, hollow: false, edge: 1, run: false },
  listen: { e1: [312, 128, 50, 50], e2: [312, 292, 50, 50], s: [110, 205, 10, 250, 34], plane: WHITE, c1: INK, c2: INK, hollow: false, edge: 1, run: false },
  search: { e1: [312, 120, 46, 46], e2: [312, 300, 46, 46], s: [110, 205, 8, 250, 34], plane: BLUE, c1: PAPER, c2: INK, hollow: false, edge: 1, run: true },
  found: { e1: [312, 120, 56, 56], e2: [312, 300, 56, 56], s: [110, 205, 22, 250, 34], plane: BLUE, c1: PAPER, c2: INK, hollow: false, edge: 2, run: false },
  none: { e1: [300, 120, 40, 40], e2: [324, 300, 40, 40], s: [110, 205, 90, 250, 28], plane: WHITE, c1: MUTED, c2: MUTED, hollow: false, edge: 0, run: false },
  refused: { e1: [312, 120, 46, 46], e2: [312, 300, 46, 46], s: [110, 205, -26, 250, 34], plane: INK, c1: PAPER, c2: INK, hollow: false, edge: 3, run: false },
  handover: { e1: [312, 120, 50, 50], e2: [312, 300, 50, 50], s: [96, 205, 12, 250, 34], plane: WHITE, c1: WHITE, c2: WHITE, hollow: true, edge: 1, run: false },
}

export const LABEL: Record<FaceState, string> = {
  rest: 'Rest',
  listen: 'Listening',
  search: 'Searching',
  found: 'Found',
  none: 'Nothing found',
  refused: 'Boundary',
  handover: 'Hand over',
}

// Plain-text faces for the one-line style (they also work with color stripped).
export const LINE_FACE: Record<FaceState, string> = {
  rest: '[o|o]',
  listen: '[O/o]',
  search: '[o/O]>',
  found: '[O/O]!',
  none: '[. - .]',
  refused: '[x|x]',
  handover: '[o|o]*',
}

// ---- The six workshop faces (final frame of each scene in robot-faces.json) --

export type Crew = {
  id: string
  label: string
  question: string
  parts: [number, number, number, number, string][]
  e1: [number, number, number]
  e2: [number, number, number]
  sl: [number, number, number]
}

export const CREW: Crew[] = [
  { id: 'challenge', label: 'Challenge', question: 'What would make this claim fail?', parts: [[62, 40, 52, 120, 'r'], [126, 40, 58, 120, 'k'], [118, 26, 6, 148, 'k'], [136, 132, 16, 16, 'y'], [152, 116, 16, 16, 'y'], [168, 100, 16, 16, 'y']], e1: [90, 84, 18], e2: [150, 70, 18], sl: [30, 100, -18] },
  { id: 'perspectives', label: 'Perspectives', question: 'What changes when we look from another position?', parts: [[62, 60, 36, 36, 'w'], [106, 60, 36, 36, 'w'], [150, 60, 36, 36, 'b'], [62, 104, 36, 36, 'w'], [106, 104, 36, 36, 'r'], [150, 104, 36, 36, 'w']], e1: [168, 78, 14], e2: [80, 122, 14], sl: [30, 100, 8] },
  { id: 'connections', label: 'Connections', question: 'Could this structure help in another room?', parts: [[62, 50, 44, 100, 'w'], [144, 50, 44, 100, 'd'], [106, 96, 38, 8, 'k'], [118, 86, 14, 28, 'b']], e1: [84, 100, 14], e2: [166, 100, 14], sl: [30, 100, 10] },
  { id: 'structure', label: 'Structure', question: 'Which parts does this question depend on?', parts: [[62, 76, 34, 48, 'k'], [112, 34, 72, 41.3, 'b'], [96, 52.7, 16, 4, 'k'], [112, 79.3, 72, 41.3, 'b'], [96, 98, 16, 4, 'k'], [112, 124.7, 72, 41.3, 'd'], [96, 143.3, 16, 4, 'k'], [96, 52.7, 4, 94.7, 'k']], e1: [148, 145.3, 14], e2: [148, 54.7, 14], sl: [30, 100, 0] },
  { id: 'intent', label: 'Intent', question: 'What progress is this person trying to make?', parts: [[64, 84, 32, 32, 'b'], [96, 98, 44, 4, 'k'], [140, 56, 44, 88, 'r']], e1: [162, 80, 14], e2: [162, 120, 14], sl: [48, 100, 22] },
  { id: 'experiment', label: 'Experiment', question: 'What is the smallest useful thing to test next?', parts: [[62, 142, 27.5, 30, 'b'], [93.5, 112, 27.5, 60, 'b'], [125, 82, 27.5, 90, 'd'], [156.5, 52, 27.5, 120, 'w']], e1: [107.25, 98, 14], e2: [138.75, 68, 14], sl: [30, 100, 16] },
]

// ---- Rasterizers ------------------------------------------------------------
// The state faces follow drawState() in workshop-robots.js on a 400 x 400 tile:
// a paper tile, a colored plane at the upper right, a black divider, a ground
// line (with a gap for a boundary), a rotated slash, two eyes, and a small
// square that runs on the line. The crew faces follow buildFace() on 200 x 200.
// Both are reduced to n x n pixels, drawn two pixels per terminal row.

export function rasterState(p: Pose, tick: number, n: number): string[][] {
  const px = 400 / n
  const g: string[][] = Array.from({ length: n }, () => Array<string>(n).fill(PAPER))
  const rx = 236
  const ry = 225
  const mid = (rx + 386) / 2
  const th = [0, 14, 26, 14][p.edge] ?? 14
  const halfLine = p.edge === 2 ? px : px * 0.35
  const [sx, sy, a, len, thick] = p.s
  const rad = (a * Math.PI) / 180
  const halfThick = Math.max(thick, px) / 2
  const minEye = px * 0.3

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (c + 0.5) * px
      const y = (r + 0.5) * px

      if (x >= rx + 7 && x <= 386 && y >= 14 && y <= ry - 7) g[r][c] = p.plane
      if (Math.abs(x - rx) <= px / 2) g[r][c] = INK
      if (th > 0 && x >= rx && x <= 386 && Math.abs(y - ry) <= halfLine) {
        const isGap = p.edge === 3 && Math.abs(x - mid) < px * 0.55
        if (!isGap) g[r][c] = INK
      }

      const dx = x - sx
      const dy = y - sy
      const u = dx * Math.cos(rad) + dy * Math.sin(rad)
      const v = -dx * Math.sin(rad) + dy * Math.cos(rad)
      if (Math.abs(u) <= halfThick && Math.abs(v) <= len / 2) {
        g[r][c] = p.hollow ? HOLLOW : INK
      }

      ;[p.e1, p.e2].forEach(([ex, ey, ew, eh], i) => {
        if (Math.abs(x - ex) <= Math.max(ew / 2, minEye) && Math.abs(y - ey) <= Math.max(eh / 2, minEye)) {
          g[r][c] = p.hollow ? HOLLOW : i ? p.c2 : p.c1
        }
      })
    }
  }

  if (p.run) {
    const progress = (tick % 8) / 7
    const x = rx + 6 + progress * (386 - rx - 38)
    const c = Math.min(n - 1, Math.max(0, Math.floor(x / px)))
    const r = Math.min(n - 1, Math.floor(ry / px))
    g[r][c] = WHITE
  }

  return g
}

export function rasterCrew(role: Crew, n: number): string[][] {
  const px = 200 / n
  const g: string[][] = Array.from({ length: n }, () => Array<string>(n).fill(WHITE))
  const fills: Record<string, string> = { k: INK, r: RED, b: BLUE, y: YELLOW, w: WHITE, p: PAPER, d: HOLLOW }
  const rad = (role.sl[2] * Math.PI) / 180

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (c + 0.5) * px
      const y = (r + 0.5) * px

      role.parts.forEach(([ex, ey, ew, eh, f]) => {
        if (x >= ex - px * 0.2 && x <= ex + ew + px * 0.2 && y >= ey - px * 0.2 && y <= ey + eh + px * 0.2) {
          g[r][c] = fills[f] ?? WHITE
        }
      })

      const dx = x - role.sl[0]
      const dy = y - role.sl[1]
      const u = dx * Math.cos(rad) + dy * Math.sin(rad)
      const v = -dx * Math.sin(rad) + dy * Math.cos(rad)
      if (Math.abs(u) <= Math.max(6, px * 0.5) && Math.abs(v) <= 42) g[r][c] = INK

      ;[role.e1, role.e2].forEach(([ex, ey, es]) => {
        if (Math.abs(x - ex) <= Math.max(es / 2, px * 0.5) && Math.abs(y - ey) <= Math.max(es / 2, px * 0.5)) {
          g[r][c] = INK
        }
      })
    }
  }

  return g
}


export function moveOf(glyph: string): Move {
  if (glyph === '🟦') return 'blue'
  if (glyph === '🟥') return 'red'
  if (glyph === '🟨') return 'yellow'
  if (glyph === '⬛') return 'black'
  return 'white'
}

export type Run = { top: string; bottom: string; w: number }

// Two pixels per terminal row: merge neighbours of the same colors into runs.
// Works for any rectangle of pixels, not only the square faces.
export function gridRuns(grid: string[][]): Run[][] {
  const width = grid[0]?.length ?? 0
  const rows: Run[][] = []
  for (let k = 0; k < Math.floor(grid.length / 2); k++) {
    const runs: Run[] = []
    for (let c = 0; c < width; c++) {
      const top = grid[k * 2]?.[c] ?? '#FFFFFF'
      const bottom = grid[k * 2 + 1]?.[c] ?? '#FFFFFF'
      const last = runs[runs.length - 1]
      if (last && last.top === top && last.bottom === bottom) last.w += 1
      else runs.push({ top, bottom, w: 1 })
    }
    rows.push(runs)
  }
  return rows
}
