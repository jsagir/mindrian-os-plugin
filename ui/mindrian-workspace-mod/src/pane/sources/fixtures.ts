// Plan 13: sample sources for the Sources tab (UI-SPEC 10.3, the render check). In sample mode the
// loader answers from here through the same model seam, with no MCP call. Every title and folder
// ends with "(sample)" so a fixture is never mistaken for a real fact, and every path begins with
// `sample-` so it can never collide with a real artifact. The texts are fictional.
import type { SourceRow, SourcesLoad } from './model'

const INTERVIEW: SourceRow = {
  title: 'Interview with a clinic owner (sample)',
  where: 'evidence (sample)',
  path: 'sample-evidence/interview/interview.md',
}
const MARKET: SourceRow = {
  title: 'Market size estimate (sample)',
  where: 'market (sample)',
  path: 'sample-market/size/size.md',
}
const LONG: SourceRow = {
  title: 'Long interview transcript (sample)',
  where: 'evidence (sample)',
  path: 'sample-evidence/transcript/transcript.md',
}
const SURVEY: SourceRow = {
  title: 'Customer survey results (sample)',
  where: 'evidence (sample)',
  path: 'sample-evidence/survey/survey.md',
}

// A text over the 10,000 character limit, so the "only the first part" line can be drawn.
function longText(): string {
  const line = 'The owner said the grant window closes soon and the paperwork is the hard part. (sample)\n'
  let body = '# Long interview transcript (sample)\n\n'
  while (body.length < 12000) body += line
  return body
}

const TEXTS: Record<string, string> = {
  [INTERVIEW.path]:
    '# Interview with a clinic owner (sample)\n\nThe owner wants a faster way to apply for funding.\n\n- Paperwork takes weeks.\n- The window closes in the spring.\n\nThis is sample text, not a real interview.',
  [MARKET.path]:
    '# Market size estimate (sample)\n\nAbout two thousand clinics could use this. This is sample text, not a real estimate.',
  [LONG.path]: longText(),
  [SURVEY.path]:
    '# Customer survey results (sample)\n\nTwelve of twenty clinics said funding is their first problem. This is sample text, not a real survey.',
}

const WITH_DATA: SourceRow[] = [INTERVIEW, MARKET, LONG]

// The list a sample shows, by sample name. null for a name that is not a sample. The empty sample
// has none; the unreadable sample cannot be read; a sample with no room has none (the tab draws the
// "not in a data room" line before it ever asks).
export function sampleSources(name: string | null): SourcesLoad | null {
  switch (name) {
    case 'empty':
    case 'noroom':
      return { state: 'ok', value: [] }
    case 'unreadable':
      return { state: 'unavailable' }
    case 'several':
      return { state: 'ok', value: [...WITH_DATA, SURVEY] }
    case 'wide':
    case 'narrow':
    case 'missing':
    case 'limit':
    case 'drift':
    case 'broken':
    case 'nofile':
      return { state: 'ok', value: [...WITH_DATA] }
    default:
      return null
  }
}

// The text of a sample row, or null for a path that is not a sample row.
export function sampleText(path: string): string | null {
  return Object.prototype.hasOwnProperty.call(TEXTS, path) ? (TEXTS[path] ?? null) : null
}
