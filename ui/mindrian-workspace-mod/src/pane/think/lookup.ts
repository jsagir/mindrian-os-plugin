// Plan 16: the pure half of the one guarded lookup (Canon Part 8, R-24). The Think tab's "Look up
// general guidance" button may cause ONE Brain call, and the only thing that call may carry is the
// name of a method from the framework-name canon. This file decides what counts as such a name and
// maps the answer; the call itself sits in the `act.guidance` closure in src/registrars/pane.tsx
// (the one file that holds `$`), which asks this file before it sends anything.
//
// No value import and no `$` here: tests/test-369.26-part8.cjs loads this file directly through
// Node's own type stripping to prove it agrees with the egress guard on every canon name and every
// room-content canary, so it must stay a plain erasable module.
import type { Actions } from '../types'

// The charset and length the egress guard (lib/core/part8-egress-guard.cjs FRAMEWORK_NAME_RE) and
// Theo itself accept for a framework handle. A name outside it is never sent.
const HANDLE_SHAPE = /^[A-Za-z0-9 '(),./-]{1,128}$/

// The longest text a lookup result may show (UI-SPEC 7.4, MarkdownProps).
export const GUIDANCE_MAX = 10000

// The lowercased canon names found in the text of the framework-names asset, or [] when the text is
// not that file (never throws). An empty list accepts nothing, as the guard does on an empty canon.
export function parseCanon(canonText: string): string[] {
  let doc: unknown
  try {
    doc = JSON.parse(canonText)
  } catch {
    return []
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return []
  const names = (doc as { framework_names?: unknown }).framework_names
  if (!Array.isArray(names)) return []
  const out: string[] = []
  for (const name of names) {
    if (typeof name === 'string' && HANDLE_SHAPE.test(name)) out.push(name.toLowerCase())
  }
  return out
}

// True only for a string that fits the charset and length rule AND equals a canon name after
// lowercasing (never a substring, never a prefix). `canon` is the output of parseCanon.
export function inCanon(handle: unknown, canon: readonly string[]): handle is string {
  if (typeof handle !== 'string' || !HANDLE_SHAPE.test(handle)) return false
  return canon.includes(handle.toLowerCase())
}

// The same check from the text of the framework-names asset (what the closure reads).
export function isCanonicalHandle(handle: unknown, canonText: string): handle is string {
  return inCanon(handle, parseCanon(canonText))
}

export type GuidanceText = { kind: 'ok'; text: string } | { kind: 'failed' }

// The text of a tool reply, `{ content: [{ type: 'text', text }], isError }`: the first text block,
// cut at GUIDANCE_MAX. An error reply, a reply with no text and a blank text are all failed.
export function textFromReply(reply: unknown): GuidanceText {
  if (typeof reply !== 'object' || reply === null || Array.isArray(reply)) return { kind: 'failed' }
  const rec = reply as { content?: unknown; isError?: unknown }
  if (rec.isError === true || !Array.isArray(rec.content)) return { kind: 'failed' }
  for (const block of rec.content) {
    if (typeof block !== 'object' || block === null) continue
    const b = block as { type?: unknown; text?: unknown }
    if (b.type === 'text' && typeof b.text === 'string') {
      if (b.text.trim().length === 0) return { kind: 'failed' }
      return { kind: 'ok', text: b.text.slice(0, GUIDANCE_MAX) }
    }
  }
  return { kind: 'failed' }
}

export type GuidanceResult = GuidanceText | { kind: 'refused' }

// Ask for general guidance on one method. Everything that can go wrong is a result, never a throw:
// a closure that refused the handle is `refused`, and a closure that threw, a rejected call, an
// error reply and a reply with no text are `failed`.
export async function lookupGuidance(act: Pick<Actions, 'guidance'>, handle: string): Promise<GuidanceResult> {
  let answer: Awaited<ReturnType<Actions['guidance']>>
  try {
    answer = await act.guidance(handle)
  } catch {
    return { kind: 'failed' }
  }
  if (answer.kind === 'refused') return { kind: 'refused' }
  if (answer.kind === 'failed') return { kind: 'failed' }
  return textFromReply(answer.reply)
}
