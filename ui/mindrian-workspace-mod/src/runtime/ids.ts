// Plan 01: the names every later plan shares. Changing one here changes it everywhere.

export const PLUGIN_NAME = 'mindrian-workspace'
export const PANE_ID = 'mindrian-workspace'

// The MCP server names as /mcp lists them for the installed plugin (plan 17 verifies both).
export const MINDRIAN_SERVER = 'plugin:mos:mindrian-os'
export const BRAIN_SERVER = 'plugin:mos:mindrian-brain'

export const TAB_IDS = ['room', 'think', 'sources', 'review'] as const
export type TabId = (typeof TAB_IDS)[number]
