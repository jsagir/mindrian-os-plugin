// Plan 07: the four tab bodies keyed by tab id. The shell takes its bodies from here; plans 11 to
// 14 replace the four seam files this imports (each is `undefined` until its plan lands, and a tab
// whose body is undefined draws only the shell). Plan 18 asserts all four are defined at the end.
import type { TabId } from '../runtime/ids'
import { reviewBody } from './bodies/review'
import { roomBody } from './bodies/room'
import { sourcesBody } from './bodies/sources'
import { thinkBody } from './bodies/think'
import type { TabBody } from './types'

export const tabBodies: Record<TabId, TabBody | undefined> = {
  room: roomBody,
  think: thinkBody,
  sources: sourcesBody,
  review: reviewBody,
}
