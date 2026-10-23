import type { EngineInterface } from 'claude-code'

import type { Advice } from '../types'
import { WHY } from './commands'
import { PROPOSALS } from './proposals'
import type { Proposals } from './proposals'

// The panel asks Theo what to do next, every couple of turns.
//
// What leaves the machine (Canon Part 8, plan 380-04, decision D-03). Three calls, and
// only three:
//   1. The question to the guarded shim tool. It carries a framework name, a problem type
//      and, on by default, a cleaned excerpt of the person's OWN recent words (owner ruling
//      2026-10-21, kept as written). The excerpt is at most 240 characters. Links, emails,
//      file paths, code, key-like strings and names are removed first (sanitize, stripNames).
//      It is shown in full in the panel, and /mos-words turns it off.
//   2. The same question to the raw theo server, only when the shim failed or was denied.
//      With the proposal shimOnlyExcerpt on (hooks/proposals.ts) it carries handles only,
//      because the raw server never passes lib/core/part8-egress-guard.cjs.
//   3. A search on the raw theo server. Its query is always one string of HANDLE_QUERIES:
//      a framework name or a problem type, never a word taken from the person's text.
// Never assistant text, room files, claims or artifacts. Larry's own brain_* calls are not
// touched by this: they stay generic.

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

// The closed set of strings the search call may send as its query: the framework names of
// the rules, the fallback framework and the four problem types. Nothing else, ever.
export const HANDLE_QUERIES: string[] = [...RULES.map(rule => rule.framework), FALLBACK, 'Un-Defined', 'Ill-Defined', 'Well-Defined', 'Wicked']

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

const NAME = '(a name)'

// S3: the words that may start a sentence without being a name. A closed list of function
// words: articles, pronouns, conjunctions, auxiliary verbs, question words, prepositions and
// common adverbs. A word that is also a given name (will, may) is left out on purpose.
export const COMMON_STARTS: ReadonlySet<string> = new Set(
  (
    'the a an we our ours us i my me mine it its this that these those there here they their them you your yours he she his her him ' +
    'what why how when where who whom which whose if but and or nor so yet because since while although though as unless until whether ' +
    'can could should would do does did don doesn didn is are was were am be been being have has had haven hasn hadn isn aren wasn weren ' +
    'won wouldn couldn shouldn cannot not no yes now then also maybe just some each all any every one only still even again once often ' +
    'sometimes always never please let first next finally instead however today yesterday tomorrow soon later already almost really ' +
    'about after before for from in on of with without to at by up out over under between during into through against among near ' +
    'both either neither many much more most less few other another such same own very too'
  ).split(' '),
)

// The words of the framework names and problem types, the product names, the pronoun I, the
// weekday and month names and a few plain acronyms are not names of a venture or a person.
const ALLOW: ReadonlySet<string> = new Set([
  ...HANDLE_QUERIES.flatMap(query => query.toLowerCase().split(/[^a-z]+/)).filter(word => word !== ''),
  ...'theo pws mindrianos jtbd swot pest api ai ux mvp roi kpi'.split(' '),
  ...'monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december'.split(' '),
])

// The cue words of every rule, each as a whole-token test, so a cue word at the start of a
// sentence (Customers, Symptom, Blocked) survives: the classifier needs it.
const CUES = RULES.map(rule => new RegExp(`^(?:${rule.words.source})$`, 'i'))

const isCue = (word: string): boolean => CUES.some(cue => cue.test(word))

// A word starts a sentence when only spaces, quotes, brackets or list marks lie between it
// and the start of the text, a full stop, a question mark, an exclamation mark or a line break.
function startsSentence(whole: string, offset: number): boolean {
  let i = offset - 1
  while (i >= 0 && /[ \t"'\u201C\u201D\u2018\u2019(\[{*_#>-]/.test(whole.charAt(i))) i--
  if (i < 0) return true

  return /[.?!\u2026\n\r]/.test(whole.charAt(i))
}

// Remove the names from prose, with the rule S1 plus S2 plus S3 of plan 380-04:
//   S1 known names: the room slug, each part of it (3 letters or more), the workspace folder
//      name and the session folder name, whole words, any case. A part that is a plain
//      function word (the, and) is not a name and is left out of the list.
//   S2 proper names: a capitalized word that does not start a sentence, and any all-caps word
//      of 2 letters or more, unless it is on the allow-list.
//   S3 sentence starts: the first word of each sentence, unless it is a common word, a cue
//      word of a rule or an allow-listed word.
// A run of replaced words collapses to one placeholder. Residual risk: a name typed in
// lowercase in the middle of a sentence, or in a script without capital letters, is caught
// only when it equals a known name.
export function stripNames(text: string, known: string[] = []): string {
  const names = new Set<string>()
  for (const raw of known) {
    const whole = raw.trim().toLowerCase()
    if (whole.length >= 3) names.add(whole)
    for (const part of whole.split(/[-_.\s]+/)) {
      if (part.replace(/[^\p{L}]/gu, '').length >= 3 && !COMMON_STARTS.has(part)) names.add(part)
    }
  }

  const replaced = text.replace(/\p{L}[\p{L}\p{N}'\u2019]*/gu, (token: string, offset: number, whole: string) => {
    const base = token.replace(/['\u2019]+$/, '').replace(/['\u2019]s$/i, '')
    const lower = base.toLowerCase()
    const head = lower.split(/['\u2019]/)[0] ?? lower
    if (names.has(lower)) return NAME
    if (head === 'i' || ALLOW.has(lower)) return token
    const letters = base.replace(/[^\p{L}]/gu, '')
    if (letters.length >= 2 && base === base.toUpperCase() && base !== base.toLowerCase()) return NAME
    if (startsSentence(whole, offset)) {
      return COMMON_STARTS.has(lower) || COMMON_STARTS.has(head) || isCue(lower) || ALLOW.has(head) ? token : NAME
    }

    return /^\p{Lu}/u.test(base) ? NAME : token
  })

  return replaced.replace(/\(a name\)(?:[\s-]*\(a name\))+/g, NAME)
}

// Strip what should never travel, then keep a short excerpt. known: the names this machine
// already knows (room slug, workspace and session folder), removed from the prose.
export function sanitize(text: string, max = 240, known: string[] = []): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/(?:~|\/home|\/Users|\/tmp|[A-Za-z]:\\)[\w./\\~-]*/g, ' ')
    .replace(SECRET, ' ')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, ' ')

  return clip(
    stripNames(cleaned, known)
      .replace(/["]/g, "'")
      .replace(/\s+/g, ' ')
      .trim(),
    max,
  )
}

// The words worth sending: the newest sentence of the person's own that carries a
// cue, else the newest substantial message. Never the assistant, never the room.
export function wordsFor(matched: string[], messages: string[], known: string[] = []): string {
  const cue = subjectOf(matched, messages)
  if (cue !== '') return sanitize(cue, 240, known)
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = sanitize(messages[i] ?? '', 240, known)
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


// ---- The framework picks chapters ------------------------------------------------
// Theo's keyword search answers with chapters. The query is the framework name of the
// handle and nothing else: never a word of the person (plan 380-04, decision D-03). Each
// chapter that comes back points at the command that teaches it.

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

type Row = { chapterId?: string }

export function chaptersToPicks(rows: Row[], skip: string[]): { framework: string; command: string }[] {
  const out: { framework: string; command: string }[] = []
  for (const row of rows) {
    const pick = CHAPTER_COMMAND[row.chapterId ?? '']
    if (pick && WHY[pick.command] && !skip.includes(pick.command) && !out.some(o => o.command === pick.command)) out.push(pick)
  }

  return out
}

async function searchChapters($: Engine, h: Handle, skip: string[]): Promise<{ framework: string; command: string }[]> {
  // Handles only: the query is one string of the closed set, or there is no call at all.
  const query = h.framework
  if (!HANDLE_QUERIES.includes(query)) return []
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

const SHIM = 'mcp__plugin_mos_mindrian-brain__brain_ask'
const RAW = 'mcp__theo__brain_ask'
// The guarded shim first, the raw theo server only after it failed or was denied.
const TOOLS = [SHIM, RAW]

// Does the first value of the environment switch turn the excerpt off at session start?
// With the envSwitch proposal off, the variable is ignored. Returns whether words start on.
export function wordsStartOn(envValue: string | undefined, proposals: Proposals = PROPOSALS): boolean {
  if (!proposals.envSwitch) return true
  const value = (envValue ?? '').trim().toLowerCase()

  return !(value === 'off' || value === '0' || value === 'false')
}

// The plain texts of /mos-advice and /mos-words. advice: what an ask sends while the excerpt
// is on or off. words: what /mos-words says after it set the excerpt on or off. Both tell
// the truth about now, and the second says how long the setting lasts.
export function wordsTexts(isOn: boolean, proposals: Proposals = PROPOSALS): { advice: string; words: string } {
  const lasting = proposals.envSwitch
    ? ' A new session starts with the excerpt on, unless MOS_FACE_WORDS=off is set in the settings environment.'
    : ' A new session starts with the excerpt on again.'

  return isOn
    ? {
        advice: 'Asking Theo. A framework name, a problem type and a short excerpt of your own words are sent. Run /mos-words to stop the excerpt.',
        words:
          'Theo now also gets a short excerpt of your own recent words, with links, emails, paths, code, key-like strings and names removed. Never the assistant, never the room. Run /mos-words to stop. This lasts until this session ends.' +
          lasting,
      }
    : {
        advice: 'Asking Theo. Only a framework name and a problem type are sent.',
        words: 'Theo now gets only a framework name and a problem type. This lasts until this session ends.' + lasting,
      }
}

export async function askTheo(
  $: Engine,
  h: Handle,
  turn: number,
  avoid: string[] = [],
  words = '',
  skipCommands: string[] = [],
  proposals: Proposals = PROPOSALS,
): Promise<Advice> {
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
    sent: '',
    question: questionFor(h),
    guided: '',
    note: '',
  }

  // The excerpt counts as sent once a call that carried it was made and not denied. A call
  // that failed after it left may still have delivered it, so a failure does not erase it.
  let wentOut = ''
  for (const tool of TOOLS) {
    // The excerpt rides the guarded shim. The raw server gets it only when the proposal
    // shimOnlyExcerpt is off (the owner ruling as written).
    const carries = words !== '' && (tool === SHIM || !proposals.shimOnlyExcerpt)
    base.question = questionFor(h, carries ? words : '')
    try {
      const ran = await $.tool.call({ tool, question: base.question } as never)
      const out = ran as { deny?: string; isError?: boolean; text?: string }
      if (out.deny !== undefined) {
        // A denied call sent nothing.
        base.note = 'Theo was not asked: the call was not allowed'
        continue
      }
      if (carries) wentOut = words
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
        base.sent = wentOut
        return base
      }
      // The framework leads: commands from chapters its name found come first, then the
      // problem-type chain, never repeating a command just shown. The search sends the
      // framework name only.
      const fromHandle = await searchChapters($, h, skipCommands)
      const merged = [...fromHandle.map(p => p.command), ...commands.filter(c => !skipCommands.includes(c))]
      const ordered = [...new Set(merged)]
      const top = (ordered.length > 0 ? ordered : commands).slice(0, 3)
      const led = fromHandle[0]
      return {
        ...base,
        status: 'ok',
        framework: led?.framework ?? options[0]?.framework ?? h.framework,
        commands: top,
        whys: top.map(command => WHY[command] ?? ''),
        framings: [],
        matched: [],
        sent: wentOut,
        guided,
        note: led ? 'chosen from the framework' : sameAgain ? 'Theo suggested the same frameworks again, so the talk gives it nothing new to go on' : '',
      }
    } catch {
      if (carries) wentOut = words
      base.note = 'Theo could not be reached from here'
    }
  }
  base.sent = wentOut

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
