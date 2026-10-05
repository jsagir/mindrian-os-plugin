// Plan 03: the one theme. A component asks for a job (where, yourMove, problem, frame, reading,
// logoGreen), never a color. Values come from assets/palette.json (a derived copy of
// references/visual/palette.json, guarded by tests/test-369.26-palette-sync.cjs), read at run
// time through $.fs.read of $.plugin.root. No color value is written in this file: the legal
// text-on-block pairs are the measured ones from the UI-SPEC Color table.
import type { EngineInterface } from 'claude-code'

export type JobName = 'where' | 'yourMove' | 'problem' | 'frame' | 'reading' | 'logoGreen'
export type Theme = Record<JobName, string>

// A job that can be a block behind words. logoGreen is the logo's sliver only, never a block.
export type BlockJob = Exclude<JobName, 'logoGreen'>

// Job to the NAME of its palette.json base key. The values are never held here.
// The palette's grey meta key is not used by this mod (C-20); muted text is dimColor on the text's own color.
export const PALETTE_KEY: Readonly<Record<JobName, string>> = {
  where: 'mondrian_blue',
  yourMove: 'mondrian_yellow',
  problem: 'mondrian_red',
  frame: 'mondrian_black',
  reading: 'cream',
  logoGreen: 'success_green',
}

const JOBS: readonly JobName[] = ['where', 'yourMove', 'problem', 'frame', 'reading', 'logoGreen']

// A seven-character hash-hex value, built from character classes (no literal color).
const HEX_VALUE = /^#[0-9A-Fa-f]{6}$/

const ASSET = 'assets/palette.json'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Reads the palette from the plugin's own root. Never throws: a read failure, a parse failure,
// a missing key or a value that is not a seven-character hex returns null, and the caller turns
// plain mode on with note N03. There is no baked-in fallback (that would be a hardcoded color).
export async function loadTheme($: EngineInterface): Promise<Theme | null> {
  let raw: string
  try {
    raw = await $.fs.read(`${$.plugin.root}/${ASSET}`)
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || !isRecord(parsed.base)) return null
  const base = parsed.base
  const out: Partial<Theme> = {}
  for (const job of JOBS) {
    const value = base[PALETTE_KEY[job]]
    if (typeof value !== 'string' || !HEX_VALUE.test(value)) return null
    out[job] = value
  }
  return out as Theme
}

// The legal text-on-background pairs, exactly the measured ones (UI-SPEC Color table):
// reading on where 9.82, frame on yourMove 8.17, reading on problem 5.56, reading on frame
// 17.13, frame on reading 17.13. Everything else is refused.
export const ALLOWED_PAIRS: readonly { text: BlockJob; bg: BlockJob }[] = [
  { text: 'reading', bg: 'where' },
  { text: 'frame', bg: 'yourMove' },
  { text: 'reading', bg: 'problem' },
  { text: 'reading', bg: 'frame' },
  { text: 'frame', bg: 'reading' },
]

// Throws for any pair that is not in ALLOWED_PAIRS: cream on yellow, yellow text on cream, black on
// blue, blue or red text on black, yellow on red, and anything involving logoGreen.
export function assertAllowedPair(text: JobName, bg: JobName): void {
  if (!ALLOWED_PAIRS.some((p) => p.text === text && p.bg === bg)) {
    throw new Error(`theme: ${text} text on ${bg} is not an allowed pair`)
  }
}
export const assertPairAllowed = assertAllowedPair

// The text job each block carries; every entry is in ALLOWED_PAIRS.
const TEXT_ON: Readonly<Record<BlockJob, BlockJob>> = {
  where: 'reading',
  yourMove: 'frame',
  problem: 'reading',
  frame: 'reading',
  reading: 'frame',
}

export type BlockProps = { backgroundColor: string; color: string }

// The style props for a Box or Text that is a block of this job. Plain mode never calls this
// (paintProps in plain.ts returns {}).
export function blockStyle(theme: Theme, job: BlockJob): BlockProps {
  const textJob = TEXT_ON[job]
  assertAllowedPair(textJob, job)
  return { backgroundColor: theme[job], color: theme[textJob] }
}

// The five Larry marks (Canon Part 12, copy deck L01 to L05): a 2-cell block then one word.
export type LarryMarkId = 'L01' | 'L02' | 'L03' | 'L04' | 'L05'

const LARRY_JOB: Readonly<Record<LarryMarkId, BlockJob>> = {
  L01: 'where', // building
  L02: 'problem', // challenging
  L03: 'yourMove', // another view
  L04: 'frame', // a decision
  L05: 'reading', // handing over
}

export function larryMark(theme: Theme, which: LarryMarkId): { id: LarryMarkId; job: BlockJob; backgroundColor: string } {
  const job = LARRY_JOB[which]
  return { id: which, job, backgroundColor: theme[job] }
}
