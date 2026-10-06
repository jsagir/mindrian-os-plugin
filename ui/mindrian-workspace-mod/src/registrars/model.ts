// Plan 06 (replaces the plan 01 seam): the live model refreshes at session start and after every
// turn. A refresh that fails never blocks the session or the turn: the hook always passes the event
// on, and a failed source is its own Seen state inside the model.
//
// ENGINE RULE (369.26-ENGINE-RULES.md): `$` does not cross an import and a state write needs a
// literal reference in the file that holds `$`, so this file owns both. makeIo builds the narrow
// set of reads the fetchers may make, with `$` and every env name spelled right here; the fetchers
// in src/model/live never see `$`. The only MCP calls the fetchers make are status_read and
// gate_list on the Mindrian OS server (read only, nothing sent to the Brain: Canon Part 8).
import { update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { refreshViewModel } from '../model/live/refresh'
import type { LiveIo } from '../model/live/io'

function makeIo($: EngineInterface): LiveIo {
  return {
    mcpCall: (server, tool, args) => $.mcp.call(server, tool, args),
    // Each name is a string literal at its own call site (the engine lists what a module reads).
    envGet: (name) => {
      if (name === 'MINDRIAN_ROOMS_HOME') return $.env.get('MINDRIAN_ROOMS_HOME')
      if (name === 'HOME') return $.env.get('HOME')
      return $.env.get('USERPROFILE')
    },
    cwd: () => $.session.cwd(),
    fsExists: (path) => $.fs.exists(path),
    fsRead: (path) => $.fs.read(path),
    usage: () => $.session.usage(),
    now: () => $.clock.now(),
  }
}

async function refreshNow($: EngineInterface): Promise<void> {
  try {
    const vm = await refreshViewModel(makeIo($))
    await update($, { plugin: 'mindrian-workspace', key: 'viewModel' } as const, () => vm)
  } catch (_error) {
    // The event still goes on: a dead server or a refused write must not stall the session.
  }
}

export const registerModel: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await refreshNow($)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    await refreshNow($)
    return next(e)
  })
}
