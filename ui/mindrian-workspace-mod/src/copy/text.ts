// Plan 02: text(id, data) is the only way a string reaches the screen.
// A placeholder with no data is a type error at the call site and an Error at run time; so is a key the
// string does not use. A typo in a call site must surface in a test, never as a visible brace.
import { COPY } from './deck'
import type { CopyId } from './deck'

// The names inside {braces} of a string literal type, as a union (never when there are none).
type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never

// undefined for an id with no placeholder; otherwise one key per placeholder (a count is a number).
export type CopyData<Id extends CopyId> = [Placeholders<(typeof COPY)[Id]>] extends [never]
  ? undefined
  : { [K in Placeholders<(typeof COPY)[Id]>]: K extends 'n' ? number : string }

type TextArgs<Id extends CopyId> = [CopyData<Id>] extends [undefined] ? [data?: undefined] : [data: CopyData<Id>]

const PLACEHOLDER = /\{([^}]*)\}/g

export function text<Id extends CopyId>(id: Id, ...args: TextArgs<Id>): string {
  const template: string = COPY[id]
  const data = (args[0] ?? {}) as Record<string, string | number>
  const wanted = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) wanted.add(match[1] ?? '')
  for (const name of wanted) {
    if (!(name in data)) throw new Error(`missing_copy_data:${name}`)
  }
  for (const name of Object.keys(data)) {
    if (!wanted.has(name)) throw new Error(`unexpected_copy_data:${name}`)
  }
  return template.replace(PLACEHOLDER, (_whole, name: string) => String(data[name]))
}
