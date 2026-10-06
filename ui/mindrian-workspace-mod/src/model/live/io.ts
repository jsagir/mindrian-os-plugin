// Plan 06: the narrow set of reads the live fetchers are allowed to make. A fetcher takes this
// object, never `$`.
//
// ENGINE RULE (369.26-ENGINE-RULES.md rule 1, measured): `$` does not cross an import. So no
// fetcher can take `$` and be called from another file. The one file that owns `$` (the hook in
// src/registrars/model.ts) builds this object with `$` spelled at each call site, and hands it to
// the fetchers. As a bonus a fetcher is testable with a plain stand-in (the engine's own test `$`
// has no env, fs or state noun, rule 5), and this type is the whole list of what the mod may read:
// there is no write, no gate answer, and the only MCP server a fetcher names is passed per call.
//
// Env names are a closed union because the engine wants each `$.env.get` name as a literal.
export type EnvName = 'MINDRIAN_ROOMS_HOME' | 'HOME' | 'USERPROFILE'

export type LiveIo = {
  // The result as MCP returns it ({ content, isError }); parsed by parseToolText.
  mcpCall: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>
  envGet: (name: EnvName) => Promise<string | undefined>
  cwd: () => Promise<string>
  fsExists: (path: string) => Promise<boolean>
  fsRead: (path: string) => Promise<string>
  // The session usage, no breakdown (the plain call costs nothing).
  usage: () => Promise<unknown>
  now: () => Promise<number>
}

// Absolute paths with forward slashes and no doubled or trailing slash (Node accepts them on
// every platform). Pure.
export function normalizePath(p: string): string {
  const slashed = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed
}
