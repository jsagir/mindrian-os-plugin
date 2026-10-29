import type { Advice, FaceId, Snapshot, StatusLocal, TheoCall, TheoTotals } from '../types'
import { DOCTOR, STATE_COMMANDS, TERM_COMMANDS, WHY } from './commands'
import { NO_HOST, factLabel, nextMove, pluginFacts, reachFailed, roomFacts } from './status'

// The state pane as plain data, so the layout can be read and tested without
// drawing anything. The panel is calm by default: one "now" line, and blocks
// that each fold to a single line and open on a click. The blocks follow Theo's
// own answer to "what should a navigator see at a glance": mutually exclusive
// buckets, the answer first, nothing that does not change the next move.
//
// Two facts that are easy to confuse are kept apart and named the same way
// everywhere:
//   reads  - the room the registry calls active; the panel shows its state
//   writes - the room this session is bound to; nothing is filed anywhere else
// They can differ, and the panel says so instead of showing one as the other.

export type Kind = 'plain' | 'dim' | 'strong' | 'gap' | 'sections' | 'commands'
export type Row = { text: string; kind: Kind }

export type Block = {
  key: 'session' | 'room' | 'graph' | 'theo' | 'site' | 'next'
  title: string
  summary: string
  rows: Row[]
}

export type PaneInput = {
  snap: Snapshot | null
  bound: string | null
  boundHow: string
  workspace: string
  advice: Advice
  totals: TheoTotals
  calls: TheoCall[]
  now: number
  width: number
  // The status line's own local files (plan 15, D-08); absent before the first read.
  local?: StatusLocal | null
  // The id of the room's recorded job, the last leg of the Next move (plan 15).
  jobId?: string
}

// Words a person should see, not the machinery's.
export function plain(text: string): string {
  return text
    .replace(/\bBrain methodology graph\b/g, 'Theo')
    .replace(/\bBrain\b/g, 'Theo')
    .replace(/\bthe knowledge graph\b/g, 'your data room')
    .replace(/\bthe room'?s graph\b/g, 'your data room')
    .replace(/\broom graph\b/g, 'data room')
    .replace(/\bgraph\b/g, 'data room')
}

export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}~`
}

export function clock(ms: number): string {
  if (!ms) return 'never'
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

function ago(ms: number, now: number): string {
  if (!ms) return 'never'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

function reach(r: { host: string; status: number | null; ms: number | null }): string {
  if (r.host === NO_HOST) return 'not checked, no Theo host is recorded'
  if (r.status === null) return `${r.host} - no answer`
  const t = r.ms === null ? '' : ` ${r.ms < 1000 ? `${Math.round(r.ms)}ms` : `${(r.ms / 1000).toFixed(1)}s`}`
  return `${r.host} - ${r.status}${t}`
}

// The one line to look at first, in full and in short. The order is the order of
// consequence. The panel shows the full text; the status line shows the short one,
// so the two can never disagree.
export type Now = { text: string; short: string; command: string; label: string }

export function nowLine(i: PaneInput): Now {
  const { snap, bound, advice, totals } = i
  if (!snap) return { text: 'Reading this machine...', short: '', command: '', label: '' }
  // A failed check after an update outranks the rest: it is the status line's own corrective.
  if (i.local?.postUpdate === true) {
    return {
      text: 'The check after the update found a problem. Run /mos:doctor --fix',
      short: 'check after the update found a problem',
      command: '/mos:doctor --fix',
      label: 'Fix',
    }
  }
  const reading = snap.room?.slug
  if (!bound) {
    return {
      text: reading
        ? `Reading ${reading}. This session is not bound to write to it.`
        : 'No room is being read, and none is bound to this session.',
      short: 'not bound to a room, nothing will be filed',
      command: '/mos:rooms',
      label: 'Fix',
    }
  }
  if (snap.binding && snap.binding.slug !== '' && !snap.binding.identityReady) {
    return {
      text: 'This room has no identity yet, so its reasoning cannot be trusted to belong to it',
      short: 'room identity missing',
      command: '/mos:doctor --heal-room',
      label: 'Fix',
    }
  }
  if (totals.error > 0 || totals.blocked > 0) {
    const bad = totals.error + totals.blocked
    return {
      text: `Theo had ${totals.error} failed and ${totals.blocked} blocked call${bad === 1 ? '' : 's'}`,
      short: `Theo had ${bad} failed call${bad === 1 ? '' : 's'}`,
      command: '/mos:doctor',
      label: 'Fix',
    }
  }
  if (reachFailed(snap.theo) || i.local?.brain === 'error') {
    return { text: 'Theo is not answering its health check', short: 'Theo is not answering', command: '/mos:doctor', label: 'Fix' }
  }
  // The room check found a problem: the status line carries the same corrective (every state that shows a problem shows its fix).
  if (i.local?.health === 'drift' || i.local?.health === 'broken') {
    return { text: 'The room check found a problem', short: 'room check found a problem', command: '/mos:doctor --fix', label: 'Fix' }
  }
  if (snap.room && snap.room.stale.length > 0) {
    const n = snap.room.stale.length
    return {
      text: `${n} section${n === 1 ? '' : 's'} have reasoning older than their files`,
      short: `${n} stale summar${n === 1 ? 'y' : 'ies'}`,
      command: '/mos:reason',
      label: 'Fix',
    }
  }
  if (snap.website.status === null || snap.website.status >= 500) {
    return { text: 'The website is not answering', short: 'website not answering', command: '', label: '' }
  }
  if (snap.pluginActive !== 'unknown' && snap.pluginInstalled !== 'unknown' && snap.pluginActive !== snap.pluginInstalled) {
    return {
      text: `Plugin ${snap.pluginInstalled} is installed; ${snap.pluginActive} is active - restart to switch`,
      short: 'restart to switch plugin',
      command: '',
      label: '',
    }
  }
  if (advice.status === 'ok' && advice.commands[0]) {
    return {
      text: `Theo suggests ${advice.framework || 'a next step'}`,
      short: 'Theo suggests',
      command: advice.commands[0],
      label: 'Try',
    }
  }
  return { text: 'All quiet. Ready when the question is', short: '', command: '', label: '' }
}

// The pinned status line: the NOW line in one breath, and nothing at all when
// all is quiet. Context, stage and version belong to the plugin's own line.
export function statusText(i: PaneInput): string | undefined {
  const n = nowLine(i)
  if (n.short === '') return undefined

  return `/m:os  ${n.short}${n.command ? `  ${n.command}` : ''}`
}

export function stateBlocks(i: PaneInput): Block[] {
  const w = i.width
  const { snap, bound, advice, totals, calls } = i
  const make = (
    key: Block['key'],
    title: string,
    summary: string,
    build: (add: (kind: Kind, text: string) => void) => void,
  ): Block => {
    const rows: Row[] = []
    build((kind, text) => rows.push({ kind, text: kind === 'sections' || kind === 'commands' ? '' : plain(text) }))
    return { key, title, summary: plain(summary), rows }
  }

  const reading = snap?.room?.slug ?? null

  const session = make(
    'session',
    'Session',
    bound ? `writes to ${bound}` : 'not bound - nothing will be filed',
    add => {
      add('plain', `writes  ${bound ? `bound to ${bound}` : 'not bound - run /mos:rooms to bind'}`)
      add('dim', `        ${i.boundHow}`)
      add('plain', `reads   ${reading ?? 'no room'}${reading ? " (the registry's active room)" : ''}`)
      add('plain', `folder  ${i.workspace !== '' ? `${i.workspace} (this terminal sits inside it)` : 'this terminal is not inside a room'}`)
      if (i.workspace !== '' && reading && i.workspace !== reading) {
        add('strong', `⚠ the terminal is in ${i.workspace}, but ${reading} is the room read`)
      }
      if (reading && bound && reading !== bound) add('strong', '⚠ the room read differs from the room bound')
      if (snap) add('plain', `plugin  ${snap.pluginActive} active, ${snap.pluginInstalled} installed`)
    },
  )

  const r = snap?.room ?? null
  const room = make(
    'room',
    'Room',
    r
      ? `${r.slug} - ${r.stage} - ${r.entries ?? '?'} entries${r.stale.length > 0 ? ' - stale reasoning' : ''}`
      : 'not read',
    add => {
      if (!r) {
        add('dim', 'No room could be read')
        return
      }
      add('plain', `reading ${r.slug} (${bound === r.slug ? 'bound' : 'not bound'})`)
      add('plain', `stage ${r.stage}   entries ${r.entries ?? '?'}`)
      add('dim', `state read ${r.computed || 'unknown'}   health ${r.health}`)
      add('dim', snap?.source === 'mindrian-os' ? 'read through the MindrianOS tools' : 'read from files: the MindrianOS tools were out of reach')
      add('dim', 'entries are what MindrianOS counts; files on disk can be more')
      snap?.notes.slice(0, 3).forEach(note => add('dim', `note: ${note}`))
      if (r.stale.length > 0) add('strong', `⚠ stale reasoning: ${r.stale.map(s => s.section).slice(0, 4).join(', ')}`)
      add('sections', '')
    },
  )

  const g = snap?.graph ?? null
  const c = snap?.claims ?? null
  const graphSummary = c
    ? `${c.total} claims, ${c.checked} checked${g ? ` - ${g.nodes} nodes` : ''}`
    : g
      ? `${g.nodes} nodes - ${g.contradictions} contradictions`
      : 'not read'
  const graph = make('graph', 'Graph', graphSummary, add => {
    if (!g && !c) {
      add('dim', 'Not read')
      return
    }
    if (!c && snap?.source === 'mindrian-os') add('dim', 'claims were not read (see the notes in Room)')
    if (c) {
      add('plain', `claims ${c.total}`)
      add('plain', `checked ${c.checked}   disputed ${c.disputed}   unchecked ${c.unchecked}`)
      add('dim', 'A count is not a verdict. Only a person confirms a claim.')
    }
    if (g) {
      add('plain', `${g.kind === 'structure' ? 'structure' : 'memory'}: ${g.nodes} nodes, ${g.edges} edges`)
      if (g.types.length > 0) add('dim', g.types.slice(0, 4).map(([name, n]) => `${name} ${n}`).join(', '))
      if (g.confirmed !== null && g.proposed !== null) add('plain', `confirmed ${g.confirmed}   proposed ${g.proposed}`)
      add(g.contradictions > 0 ? 'strong' : 'plain', `${g.contradictions > 0 ? '⚠ ' : ''}contradictions held ${g.contradictions}`)
      if (g.lastChange) add('dim', `last change ${g.lastChange}`)
    }
  })

  const reachWord = !snap ? 'not read' : snap.theo.host === NO_HOST ? 'not checked' : snap.theo.status === null ? 'no answer' : `answers ${snap.theo.status}`
  const theo = make(
    'theo',
    'Theo',
    `${reachWord} - ${totals.total} call${totals.total === 1 ? '' : 's'}${totals.error ? `, ${totals.error} failed` : ''}`,
    add => {
      if (snap) {
        add('plain', `health   ${reach(snap.theo)}`)
        add('dim', `warm-up  ${snap.prewarmOk === null ? 'no record' : snap.prewarmOk ? 'ok' : 'failed'}${snap.prewarmAt ? `  ${snap.prewarmAt}` : ''}`)
      }
      const countText = [`${totals.ok} ok`, `${totals.empty} empty`, `${totals.error} error`, `${totals.blocked} blocked`].join(', ')
      add('plain', `calls    ${totals.total} this session (${countText})`)
      add('dim', `by you ${calls.filter(c => !c.isAuto).length}   by this panel ${calls.filter(c => c.isAuto).length}`)
    },
  )

  const site = make('site', 'Site', snap ? reach(snap.website) : 'not read', add => {
    add(snap ? 'plain' : 'dim', snap ? reach(snap.website) : 'Not read')
  })

  const first = advice.status === 'ok' ? advice.commands[0] : undefined
  const next = make(
    'next',
    'Next',
    advice.status === 'asking' ? 'asking Theo...' : first ? first : 'asked every second turn',
    add => {
      if (advice.status === 'asking') {
        add('dim', 'Asking Theo...')
      } else if (advice.status === 'ok' && advice.commands.length > 0) {
        add('dim', `asked about ${advice.handle}, ${ago(advice.at, i.now)}`)
        if (advice.note) add('dim', advice.note)
        add('commands', '')
        if (advice.guided) add('plain', `"${advice.guided}"`)
      } else if (advice.status === 'failed') {
        add('dim', advice.note || 'Theo could not be asked')
      } else {
        add('dim', 'Theo is asked every second turn, once the talk gives something to go on. /mos-advice asks now')
      }
    },
  )

  return [room, graph, theo, next, session, site]
}

// The row of lights: one short word per part of the system, each a button for
// that part's details. The words carry the meaning; no color is needed.
export type Light = { key: Block['key']; label: string }

export function panelLights(i: PaneInput): Light[] {
  const { snap, bound, totals } = i
  const room = !snap?.room ? 'Room none' : snap.room.stale.length > 0 ? 'Room stale' : 'Room ok'
  const graph = !snap?.graph ? 'Graph ?' : snap.graph.contradictions > 0 ? `Graph ⚠${snap.graph.contradictions}` : 'Graph ok'
  const theoNow = !snap
    ? 'Theo ?'
    : totals.error > 0 || reachFailed(snap.theo) || i.local?.brain === 'error'
      ? 'Theo down'
      : snap.theo.host === NO_HOST && i.local?.brain !== 'ok'
        ? 'Theo ?'
        : 'Theo ok'
  const site = !snap ? 'Site ?' : snap.website.status === null || snap.website.status >= 500 ? 'Site down' : 'Site ok'
  const session = 'Session'

  return [
    { key: 'session', label: session },
    { key: 'room', label: room },
    { key: 'graph', label: graph },
    { key: 'theo', label: theoNow },
    { key: 'site', label: site },
  ]
}


// The whole state as plain linear text: the same facts as the panel, for a screen
// reader, a log, or a terminal that draws no pictures. Words only; no color, no glyph
// carries meaning.
export type TextInput = PaneInput & { context: string; sections: boolean; job?: string }

export function stateText(i: TextInput): string {
  const { snap, bound, advice, totals } = i
  const now = nowLine({ ...i, bound: bound ?? snap?.room?.slug ?? 'unbound' })
  const lines: string[] = []
  lines.push(`/m:os state, read ${snap ? clock(snap.at) : 'never'}${snap ? ` through ${snap.source === 'mindrian-os' ? 'the MindrianOS tools' : 'files'}` : ''}`)
  lines.push(`WRITES TO: ${bound ?? 'nothing, this session is not bound'}`)
  lines.push(`READS: ${snap?.room?.slug ?? 'no room'}`)
  if (i.workspace !== '') lines.push(`FOLDER: ${i.workspace}`)
  lines.push(`NOW: ${now.text}${now.command ? ` (${now.command})` : ''}`)
  if (i.context !== '') lines.push(`CONTEXT: ${i.context}`)
  if (snap?.room) {
    const r = snap.room
    lines.push(`ROOM ${r.slug}: stage ${r.stage}, ${r.entries ?? 'unknown'} entries, state read ${r.computed || 'unknown'}`)
    if (r.stale.length > 0) lines.push(`STALE REASONING: ${r.stale.map(s => s.section).join(', ')}`)
    if (i.sections) for (const s of r.sections) lines.push(`  section ${s.name}: ${s.files} entries${s.status ? `, ${s.status}` : ''}`)
  }
  // The status line facts and the room and filing facts, as plain lines (plan 15, D-08). They come from the
  // same rows as the panel, so the two cannot disagree.
  const local = i.local ?? null
  for (const fact of [...roomFacts(snap, local, bound), ...pluginFacts(snap, local)]) {
    lines.push(`${fact.id === 'theo' ? 'THEO STATE' : factLabel(fact.id, false)}: ${fact.value}`)
  }
  lines.push(`NEXT MOVE: ${nextMove(advice.status === 'ok' ? (advice.commands[0] ?? null) : null, local?.nextMove ?? null, i.jobId ?? '').words}`)
  if (snap?.claims) {
    const c = snap.claims
    lines.push(`CLAIMS: ${c.total} in all, ${c.checked} checked, ${c.disputed} disputed, ${c.unchecked} unchecked. A count is not a verdict.`)
  }
  if (snap?.graph) {
    const g = snap.graph
    lines.push(`GRAPH (${g.kind}): ${g.nodes} nodes, ${g.edges} edges, ${g.contradictions} contradictions held`)
  }
  if (snap) {
    lines.push(`THEO: health ${reach(snap.theo)}; ${totals.total} calls this session (${totals.ok} ok, ${totals.empty} empty, ${totals.error} error, ${totals.blocked} blocked)`)
    lines.push(`SITE: ${reach(snap.website)}`)
    lines.push(`PLUGIN: ${snap.pluginActive} active, ${snap.pluginInstalled} installed`)
  }
  if (advice.status === 'ok' && advice.commands.length > 0) {
    lines.push(`NEXT, from Theo (${advice.framework || 'a next step'}):`)
    advice.commands.slice(0, 3).forEach((command, n) => {
      lines.push(`  ${n + 1}. ${command} - when ${(WHY[command] ?? '').replace(/^When\s+/i, '').split(/,\s*\/mos:/)[0] ?? ''}`)
    })
  } else {
    lines.push('NEXT: Theo suggests once the talk gives something to go on')
  }
  // The Job line follows NEXT, as in the panel (plan 380-14, D-09).
  if (i.job !== undefined && i.job !== '') lines.push(i.job)
  if (snap && snap.notes.length > 0) for (const n of snap.notes.slice(0, 4)) lines.push(`NOTE: ${n}`)

  return plain(lines.join('\n'))
}

// ---- The command waiting dim in the prompt box ------------------------------------------------

// 1 to 3 commands: the doctor first when Theo is in trouble, then the shown term's framework, then the
// state's own. STATE_COMMANDS holds at least one real command for each of the 11 canon states, so the
// prompt box never gets an empty or invented suggestion (tests/face-events.test.ts, W10).
export function recommend(state: FaceId, term: string, hasTheoTrouble: boolean): string[] {
  const list: string[] = []
  if (hasTheoTrouble && DOCTOR) list.push(DOCTOR)
  const t = TERM_COMMANDS[term]
  if (t) list.push(...t.commands)
  list.push(...(STATE_COMMANDS[state] ?? []))

  return [...new Set(list)].slice(0, 3)
}

// The text waiting dim in the prompt box: the command, then the situation it is for. Tab puts it in
// the box for editing; Enter runs it.
export function suggestionText(command: string): string {
  const why = WHY[command] ?? ''
  const clause = why.replace(/^When\s+/i, '').split(/,\s*\/mos:/)[0] ?? ''
  const text = clause ? `${command} ${clause}` : command

  return text.length > 110 ? `${text.slice(0, 109)}~` : text
}
