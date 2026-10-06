// Plan 03: the one theme. A component asks for a job (a Canon v5 ROLE since C-30: evidence,
// contradiction, assumption, structure, paper, plus logoGreen), never a color. Values come from assets/palette.json (a derived copy of
// references/visual/palette.json, guarded by tests/test-369.26-palette-sync.cjs), read at run
// time through $.fs.read of $.plugin.root. No color value is written in this file: the legal
// text-on-block pairs are the measured ones from the UI-SPEC Color table.
import type { EngineInterface } from 'claude-code'

// C-30 (Canon v5): the job name IS the role, so a job can only be used for its role (guard G12).
//   evidence       blue: the person's sources and the count of evidence
//   contradiction  yellow: two credible readings that disagree (NOT drawn anywhere: no source)
//   assumption     red: an assumption that needs examination (the no-evidence list)
//   structure      black: structure and the human gate (frame, bars, chips, the decision plane)
//   paper          cream: the human canvas (place, purpose, next, the page, all reading)
export type JobName = 'evidence' | 'contradiction' | 'assumption' | 'structure' | 'paper' | 'logoGreen'
export type Theme = Record<JobName, string>

// A job that can be a block behind words. logoGreen is the logo's sliver only, never a block.
export type BlockJob = Exclude<JobName, 'logoGreen'>

// Job to the NAME of its palette.json base key. The values are never held here.
// The palette's grey meta key is not used by this mod (C-20); muted text is dimColor on the text's own color.
export const PALETTE_KEY: Readonly<Record<JobName, string>> = {
  evidence: 'mondrian_blue',
  contradiction: 'mondrian_yellow',
  assumption: 'mondrian_red',
  structure: 'mondrian_black',
  paper: 'cream',
  logoGreen: 'success_green',
}

const JOBS: readonly JobName[] = ['evidence', 'contradiction', 'assumption', 'structure', 'paper', 'logoGreen']

// A seven-character hash-hex value, built from character classes (no literal color).
const HEX_VALUE = /^#[0-9A-Fa-f]{6}$/

// Where the mod reads its palette: its own copy, inside the plugin root (UI-SPEC R-04).
export const PALETTE_ASSET = 'assets/palette.json'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Pure: the palette text to a Theme, or null when the text is not JSON, has no `base`, lacks one
// of the six keys, or holds a value that is not a seven-character hex. Never throws.
export function parseTheme(raw: string): Theme | null {
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

// Reads the palette from the plugin's own root. Never throws: a failed read or an invalid palette
// returns null, and the caller turns plain mode on with note N03. There is no baked-in fallback
// (that would be a hardcoded color).
//
// ENGINE RULE (measured in plan 03): the engine's static scan follows `$` only into functions
// declared in the SAME file, never across an import. So `$` stays in this file; a hook file that
// needs the theme spells its own `$.fs.read(...)` and hands the text to parseTheme.
export async function loadTheme($: EngineInterface): Promise<Theme | null> {
  let raw: string
  try {
    raw = await $.fs.read(`${$.plugin.root}/${PALETTE_ASSET}`)
  } catch {
    return null
  }
  return parseTheme(raw)
}

// The legal text-on-background pairs, exactly the measured ones (UI-SPEC Color table):
// paper on evidence 9.82 is cream on blue, structure on contradiction 8.17 is black on yellow,
// paper on assumption 5.56, paper on structure 17.13 (cream words on the black plane), structure on
// paper 17.13 (black words on the page). Everything else is refused.
export const ALLOWED_PAIRS: readonly { text: BlockJob; bg: BlockJob }[] = [
  { text: 'paper', bg: 'evidence' },
  { text: 'structure', bg: 'contradiction' },
  { text: 'paper', bg: 'assumption' },
  { text: 'paper', bg: 'structure' },
  { text: 'structure', bg: 'paper' },
]

// Throws for any pair that is not in ALLOWED_PAIRS: cream on yellow, yellow text on cream, black on
// blue, blue or red text on black, yellow on red, and anything involving logoGreen.
export function assertAllowedPair(text: JobName, bg: JobName): void {
  if (!ALLOWED_PAIRS.some((p) => p.text === text && p.bg === bg)) {
    throw new Error(`theme: ${text} text on ${bg} is not an allowed pair`)
  }
}
export const assertPairAllowed = assertAllowedPair

// C-30 (alignment doc 4.8): the adjacency law. Two planes may TOUCH only when their edge ratio is
// at least 3.0: paper with evidence, assumption or structure; structure with assumption or
// contradiction; evidence with contradiction. Forbidden to touch: evidence with
// assumption (1.77), evidence with structure (1.75), assumption with contradiction (2.65),
// contradiction with paper (2.10, unless bordered black). Between forbidden neighbors the band
// draws a paper cell and the pane a blank row. Pure; used by tests and by FrameCell, not a runtime
// throw.
export const ALLOWED_EDGES: readonly { a: BlockJob; b: BlockJob }[] = [
  { a: 'paper', b: 'evidence' },
  { a: 'paper', b: 'assumption' },
  { a: 'paper', b: 'structure' },
  { a: 'structure', b: 'assumption' },
  { a: 'structure', b: 'contradiction' },
  { a: 'evidence', b: 'contradiction' },
]

// True when the two planes may touch (order does not matter; two planes of one job are one plane).
export function edgeAllowed(a: BlockJob, b: BlockJob): boolean {
  if (a === b) return true
  return ALLOWED_EDGES.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
}

// Throws for two planes that may not touch.
export function assertEdgeAllowed(a: BlockJob, b: BlockJob): void {
  if (!edgeAllowed(a, b)) throw new Error(`theme: ${a} may not touch ${b}`)
}

// The text job each block carries; every entry is in ALLOWED_PAIRS.
const TEXT_ON: Readonly<Record<BlockJob, BlockJob>> = {
  evidence: 'paper',
  contradiction: 'structure',
  assumption: 'paper',
  structure: 'paper',
  paper: 'structure',
}

export type BlockProps = { backgroundColor: string; color: string }

// The style props for a Box or Text that is a block of this job. Plain mode never calls this
// (paintProps in plain.ts returns {}).
export function blockStyle(theme: Theme, job: BlockJob): BlockProps {
  const textJob = TEXT_ON[job]
  assertAllowedPair(textJob, job)
  return { backgroundColor: theme[job], color: theme[textJob] }
}

// The five Larry marks (Canon Part 12, copy deck L01 to L05): a 2-cell block then one word. In the
// mod a square is drawn only when its color role is true (C-30, OQ-18): "Challenging" opens an
// assumption (red); "Building" and "Another view" carry NO square (blue is evidence, yellow is a
// contradiction, and neither word says so); the two held-back marks keep their jobs.
export type LarryMarkId = 'L01' | 'L02' | 'L03' | 'L04' | 'L05'

const LARRY_JOB: Readonly<Record<LarryMarkId, BlockJob | null>> = {
  L01: null, // building: word only
  L02: 'assumption', // challenging
  L03: null, // another view: word only
  L04: 'structure', // a decision
  L05: 'paper', // handing over
}

export function larryMark(
  theme: Theme,
  which: LarryMarkId,
): { id: LarryMarkId; job: BlockJob | null; backgroundColor: string | null } {
  const job = LARRY_JOB[which]
  return { id: which, job, backgroundColor: job === null ? null : theme[job] }
}
