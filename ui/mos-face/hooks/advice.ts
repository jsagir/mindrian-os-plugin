import type { EngineInterface } from 'claude-code'

import type { Advice } from '../types'
import { WHY } from './commands'

// The panel asks Theo what to do next, every couple of turns.
//
// What Theo receives. Canon Part 8 kept Theo to framework names and problem types.
// On 2026-10-21 the owner ruled that this panel may also send the person's OWN
// recent words, so the suggestions fit the actual situation. The ruling is narrow:
//   - only the person's own prompts, never assistant text, room files, claims or artifacts;
//   - links, emails, file paths, code and key-like strings are stripped first;
//   - a short excerpt, never the whole talk;
//   - always visible in the panel (what was sent), and one click turns it off.
// Larry's own brain_* calls are not touched by this: they stay generic.

type Engine = EngineInterface

export type ProblemType = 'Un-Defined' | 'Ill-Defined' | 'Well-Defined' | 'Wicked'

export type Handle = {
  framework: string
  problemType: ProblemType
  matched: string[]
}

const RULES: { framework: string; words: RegExp }[] = [
  { framework: 'Root Cause Analysis', words: /\b(root cause|symptom\w*|keeps? (happening|breaking|failing|coming back)|regress\w*|bug|recurring)\b/gi },
  { framework: 'Red Teaming', words: /\b(assum\w*|prove|validate|claim\w*|evidence|doubt\w*|challenge\w*|devil\w*|verify)\b/gi },
  { framework: 'Reverse Salient Analysis', words: /\b(stuck|bottleneck\w*|blocked|lagging|slow\w*|holds? (us|it|things) back)\b/gi },
  { framework: 'Scenario Planning', words: /\b(future|scenario\w*|trend\w*|uncertain\w*|forecast\w*|next (year|decade))\b/gi },
  { framework: 'Jobs to Be Done (JTBD)', words: /\b(customer\w*|user needs?|jtbd|persona\w*|audience|job to be done)\b/gi },
  { framework: 'Four Lenses of Innovation', words: /\b(analog\w*|another field|other (domain|industry)|borrow\w*|inspiration)\b/gi },
  { framework: 'Lean Canvas', words: /\b(business model|pricing|revenue|investor\w*|pitch\w*|funding|market size)\b/gi },
  { framework: 'Knowns and Unknowns Matrix Framework', words: /\b(unknowns?|not sure|unclear|don'?t know)\b/gi },
  { framework: 'Systems Thinking', words: /\b(feedback loops?|dependenc\w*|ecosystem\w*|knock-?on|second-order)\b/gi },
  { framework: 'Dominant Design', words: /\b(winner|competitor\w*|market leader|dominant design)\b/gi },
]

const FALLBACK = 'Problem Definition Transformation Framework'

// Singular and plural are one cue: "ecosystem" and "ecosystems" count once.
const stem = (word: string): string => word.toLowerCase().replace(/(ing|ed|es|s)$/, '')

function count(text: string, words: RegExp): string[] {
  return [...text.matchAll(words)].map(m => m[0].toLowerCase())
}

function distinct(words: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const word of words) {
    const key = stem(word)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(word)
    }
  }

  return out
}

export function classify(user: string, answer: string): Handle {
  let best = { framework: FALLBACK, score: 0, matched: [] as string[] }
  for (const rule of RULES) {
    const inUser = count(user, rule.words)
    const inAnswer = count(answer, rule.words)
    const score = inUser.length * 2 + inAnswer.length
    if (score > best.score) {
      best = { framework: rule.framework, score, matched: distinct([...inUser, ...inAnswer]).slice(0, 4) }
    }
  }
  // One common word is not a cue. It takes two different cue words to count.
  if (best.matched.length < 2) best = { framework: FALLBACK, score: 0, matched: [] }
  const both = `${user} ${answer}`
  let problemType: ProblemType = 'Ill-Defined'
  if (/\b(stakeholders?|ethic\w*|polic(y|ies)|society|conflict|trade-?offs?)\b/i.test(both)) problemType = 'Wicked'
  else if (/\b(future|explore|opportunit\w*|possibilit\w*|what could)\b/i.test(both)) problemType = 'Un-Defined'
  else if (/\b(fix|implement\w*|build|deploy\w*|error|how do i)\b/i.test(both)) problemType = 'Well-Defined'
  return { framework: best.framework, problemType, matched: best.matched }
}

export function questionFor(h: Handle, words = ''): string {
  const ask = `For a ${h.problemType} problem, what comes next after the ${h.framework} framework, and which commands carry it?`

  return words === '' ? ask : `The person says: "${words}". ${ask}`
}

// ---- The person's own words, cleaned --------------------------------------------

const SECRET = /\b(sk|pk|ghp|gho|ghs|xox[abp]|AKIA|eyJ)[A-Za-z0-9_\-.]{8,}\b/g

// Strip what should never travel, then keep a short excerpt.
export function sanitize(text: string, max = 240): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/(?:~|\/home|\/Users|\/tmp|[A-Za-z]:\\)[\w./\\~-]*/g, ' ')
    .replace(SECRET, ' ')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, ' ')
    .replace(/["]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return clip(cleaned, max)
}

// The words worth sending: the newest sentence of the person's own that carries a
// cue, else the newest substantial message. Never the assistant, never the room.
export function wordsFor(matched: string[], messages: string[]): string {
  const cue = subjectOf(matched, messages)
  if (cue !== '') return sanitize(cue)
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = sanitize(messages[i] ?? '')
    if (text.length >= 20) return text
  }

  return ''
}

type Option = { framework?: string; commands?: string[]; theo_rank?: number }

function parse(text: string): { options: Option[]; guided: string } {
  const start = text.indexOf('{')
  if (start < 0) return { options: [], guided: '' }
  try {
    const env = JSON.parse(text.slice(start)) as {
      next_gate?: { options?: Option[] }
      directive?: { guided?: { questions?: string[] } }
    }
    const options = [...(env.next_gate?.options ?? [])].sort((a, b) => (a.theo_rank ?? 99) - (b.theo_rank ?? 99))
    const q = env.directive?.guided?.questions
    return { options, guided: Array.isArray(q) && typeof q[0] === 'string' ? q[0] : '' }
  } catch {
    return { options: [], guided: '' }
  }
}


// ---- Words pick chapters --------------------------------------------------------
// Theo's brain_ask chooses its options from the problem type alone, so the words
// never change them (tested 2026-10-21: two unrelated sentences, identical options).
// Theo's keyword search does follow the words. So the words search the book, and
// each chapter that comes back points at the command that teaches it.

const CHAPTER_COMMAND: Record<string, { framework: string; command: string }> = {
  redteam: { framework: 'Red Teaming', command: '/mos:challenge-assumptions' },
  nested: { framework: 'Nested Hierarchies', command: '/mos:structure-argument' },
  decomplex: { framework: 'Decomplexification', command: '/mos:analyze-systems' },
  ch02b: { framework: 'Scenario Analysis', command: '/mos:scenario-plan' },
  ch03: { framework: 'Trend Analysis', command: '/mos:explore-trends' },
  ch04: { framework: 'Dominant Design', command: '/mos:dominant-designs' },
  ch07: { framework: 'Reverse Salient Analysis', command: '/mos:find-bottlenecks' },
  bottleneck: { framework: 'Bottleneck Analysis', command: '/mos:find-bottlenecks' },
  fastdiag: { framework: 'Fast Diagnosis', command: '/mos:diagnose' },
  momtest: { framework: 'The Mom Test', command: '/mos:user-needs' },
  bmd: { framework: 'Business Model Design', command: '/mos:lean-canvas' },
  beautiful: { framework: 'Beautiful Question', command: '/mos:beautiful-question' },
  bono: { framework: 'Six Thinking Hats', command: '/mos:think-hats' },
  sciroad: { framework: 'Scientific Roadmap', command: '/mos:scientific-roadmap' },
}

const STOP = new Set(
  'about after again also because been being best both could does doing done from have here into just like make many more most much only other over same should some such than that their them then there these they this those through very what when where which while will with would your known'.split(' '),
)

export function searchTerms(words: string): string {
  const seen = new Set<string>()
  for (const raw of words.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    if (!STOP.has(raw)) seen.add(raw)
    if (seen.size >= 8) break
  }

  return [...seen].join(' ')
}

type Row = { chapterId?: string }

export function chaptersToPicks(rows: Row[], skip: string[]): { framework: string; command: string }[] {
  const out: { framework: string; command: string }[] = []
  for (const row of rows) {
    const pick = CHAPTER_COMMAND[row.chapterId ?? '']
    if (pick && WHY[pick.command] && !skip.includes(pick.command) && !out.some(o => o.command === pick.command)) out.push(pick)
  }

  return out
}

async function searchChapters($: Engine, words: string, skip: string[]): Promise<{ framework: string; command: string }[]> {
  const query = searchTerms(words)
  if (query === '') return []
  try {
    const ran = await $.tool.call({ tool: 'mcp__theo__search', query, topK: 12 } as never)
    const out = ran as { deny?: string; isError?: boolean; text?: string }
    if (out.deny !== undefined || out.isError) return []
    const text = String(out.text ?? '')
    const start = text.indexOf('{')
    const data = JSON.parse(text.slice(start)) as { rows?: Row[] }

    return chaptersToPicks(data.rows ?? [], skip)
  } catch {
    return []
  }
}

const TOOLS = ['mcp__plugin_mos_mindrian-brain__brain_ask', 'mcp__theo__brain_ask']

export async function askTheo($: Engine, h: Handle, turn: number, avoid: string[] = [], words = '', skipCommands: string[] = []): Promise<Advice> {
  const question = questionFor(h, words)
  const base: Advice = {
    status: 'failed',
    at: await $.clock.now(),
    turn,
    handle: `${h.framework} / ${h.problemType}`,
    framework: '',
    commands: [],
    whys: [],
    framings: [],
    matched: [],
    sent: words,
    question,
    guided: '',
    note: '',
  }

  for (const tool of TOOLS) {
    try {
      const ran = await $.tool.call({ tool, question } as never)
      const out = ran as { deny?: string; isError?: boolean; text?: string }
      if (out.deny !== undefined) {
        base.note = 'Theo was not asked: the call was not allowed'
        continue
      }
      if (out.isError) {
        base.note = 'Theo did not answer'
        continue
      }
      const parsed = parse(String(out.text ?? ''))
      // Skip frameworks already shown; if Theo offers nothing else, say so plainly.
      const fresh = parsed.options.filter(option => !avoid.includes(option.framework ?? ''))
      const sameAgain = parsed.options.length > 0 && fresh.length === 0
      const options = sameAgain ? parsed.options : fresh
      const guided = parsed.guided
      const commands: string[] = []
      for (const option of options) {
        for (const slug of option.commands ?? []) {
          const command = `/mos:${slug}`
          if (WHY[command] && !commands.includes(command)) commands.push(command)
        }
      }
      if (commands.length === 0) {
        base.note = 'Theo answered, but named no command to use'
        base.framework = options[0]?.framework ?? ''
        base.guided = guided
        base.status = 'ok'
        return base
      }
      // The person's words lead: commands from chapters their words found come
      // first, then the problem-type chain, never repeating a command just shown.
      const fromWords = words === '' ? [] : await searchChapters($, words, skipCommands)
      const merged = [...fromWords.map(p => p.command), ...commands.filter(c => !skipCommands.includes(c))]
      const ordered = [...new Set(merged)]
      const top = (ordered.length > 0 ? ordered : commands).slice(0, 3)
      const led = fromWords[0]
      return {
        ...base,
        status: 'ok',
        framework: led?.framework ?? options[0]?.framework ?? h.framework,
        commands: top,
        whys: top.map(command => WHY[command] ?? ''),
        framings: [],
        matched: [],
        sent: words,
        guided,
        note: led ? 'chosen from your words' : sameAgain ? 'Theo suggested the same frameworks again, so the talk gives it nothing new to go on' : '',
      }
    } catch {
      base.note = 'Theo could not be reached from here'
    }
  }

  return base
}

// ---- Framing a command in the person's own situation ---------------------------
// The command goes into the prompt box with a short, plain subject taken from
// what the person actually said, so Enter runs it already pointed at their case.
// This stays on this machine: it fills the person's own box and is never sent
// anywhere until they press Enter.

function clean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')

  return (space > 40 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')
}

// The newest sentence the person said that carries one of the cue words that
// chose this advice. Only a sentence with a cue counts: an old, unrelated line
// is never a subject, and with no cue there is no subject at all.
export function subjectOf(matched: string[], messages: string[]): string {
  if (matched.length === 0) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const sentences = clean(messages[i] ?? '')
      .split(/(?<=[.!?])\s+/)
      .filter(one => one.length >= 12)
    const hit = sentences.find(one => matched.some(word => one.toLowerCase().includes(word)))
    if (hit) return clip(hit, 120)
  }

  return ''
}

export function frameFor(command: string, matched: string[], messages: string[]): string {
  const subject = subjectOf(matched, messages)
  if (subject !== '') return `${command} ${subject}`
  const clause = (WHY[command] ?? '').replace(/^When\s+/i, '').split(/,\s*\/mos:/)[0] ?? ''

  return clause !== '' ? `${command} ${clip(clause, 110)}` : command
}

// ---- Theo suggests, Larry contextualizes ---------------------------------------
// A click on a suggestion does not just paste a command. It writes a question
// for Larry into the person's prompt box: which framework Theo suggested, why
// it might fit this room and this moment, and what to do first. The person
// presses Enter; Larry answers with the real context. Everything here stays on
// this machine until then, and is the person's own box to edit.

export type ThinkInput = {
  command: string
  framework: string
  whyLine: string
  room: string | null
  stage: string
  stale: string[]
  subject: string
}

// The plain situation a command is for: the part of its teaching line before the
// command name, without the tool names that come after it.
export function situationOf(whyLine: string): string {
  return (whyLine.replace(/^When\s+/i, '').split(/,\s*\/mos:/)[0] ?? '').trim()
}

export function thinkPrompt(input: ThinkInput): string {
  const situation = situationOf(input.whyLine)
  const parts: string[] = []
  parts.push(
    input.framework !== ''
      ? `Theo suggests the ${input.framework} framework, through ${input.command}${situation ? ` (when ${situation})` : ''}.`
      : `Theo suggests ${input.command}${situation ? ` (when ${situation})` : ''}.`,
  )
  if (input.room) {
    const stale = input.stale.length > 0 ? `; reasoning is stale in ${input.stale.slice(0, 3).join(', ')}` : ''
    parts.push(`My room is ${input.room}, stage ${input.stage}${stale}.`)
  }
  if (input.subject !== '') parts.push(`What I said that points here: "${input.subject}".`)
  parts.push(
    `Think it through with me in plain words: why does this fit my situation right now, what would I use it for, and what is the first step? If it fits, say so and I will run ${input.command}.`,
  )

  return parts.join(' ')
}
