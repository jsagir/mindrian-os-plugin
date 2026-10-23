// The 11 canon states, by the ids of the canon asset (mos-brand book e947a5d, segment identity/theo,
// asset-fa8504998f.json). The panel draws the face of each one from that asset. Phase 380 plan 13, D-10.
export type FaceId =
  | 'rest'
  | 'listen'
  | 'search'
  | 'found'
  | 'challenge'
  | 'contradiction'
  | 'reframe'
  | 'limit'
  | 'decision'
  | 'boundary'
  | 'handover'

// The seven older state names that the vendored glossary file (hooks/glossary.ts) is keyed by. That
// file is the owner's, and nothing in this package edits it, so its key set stays as it is. The
// panel's own state is FaceId; hooks/voice.ts glossaryWords turns a FaceId into these keys.
export type FaceState = 'rest' | 'listen' | 'search' | 'found' | 'none' | 'refused' | 'handover'

export type FaceStyle = 'tile' | 'mini' | 'line'

export type Move = 'none' | 'blue' | 'red' | 'yellow' | 'black' | 'white'

export type TheoStatus = 'running' | 'ok' | 'empty' | 'error' | 'blocked'

export type TheoCall = {
  id: string
  tool: string
  via: string
  ms: number | null
  status: TheoStatus
  isAgent: boolean
  isAuto: boolean
}

// What Theo last advised. The question carried a framework name and a problem
// type, and - unless /mos-words turned it off - a cleaned excerpt of the person's own
// recent words (names, links, paths, code and keys removed), only through the guarded
// shim. `sent` holds that excerpt when it went out, and is empty when it did not. Never
// assistant text, room files or claims.
export type Advice = {
  status: 'idle' | 'asking' | 'ok' | 'failed'
  at: number
  turn: number
  handle: string
  framework: string
  commands: string[]
  whys: string[]
  framings: string[]
  matched: string[]
  sent: string
  question: string
  guided: string
  note: string
}

export type TheoTotals = {
  total: number
  ok: number
  empty: number
  error: number
  blocked: number
}

export type Section = { name: string; files: number; status?: string }

export type Stale = { section: string; reason: string }

export type RoomInfo = {
  slug: string
  path: string
  stage: string
  entries: number | null
  computed: string
  roomsOnMachine: number
  sections: Section[]
  stale: Stale[]
  health: string
  healthAt: string
}

// 'structure' is the room's index graph (sections and artifacts); 'memory' is the
// claim and event store read straight from room.db when the MindrianOS tools are out of reach.
export type GraphInfo = {
  nodes: number
  edges: number
  confirmed: number | null
  proposed: number | null
  contradictions: number
  types: [string, number][]
  lastChange: string
  kind: 'structure' | 'memory'
}

// The binding is a fact the MindrianOS tools report, not something to infer.
export type Binding = {
  bound: boolean
  slug: string
  source: string
  identityReady: boolean
  identityReason: string
  writePath: boolean | null
  note: string
}

// How the room's claims have been checked. A count is not a verdict.
export type ClaimsInfo = {
  total: number
  checked: number
  disputed: number
  inconclusive: number
  unchecked: number
}

export type Reach = {
  host: string
  status: number | null
  ms: number | null
}

export type Snapshot = {
  at: number
  room: RoomInfo | null
  graph: GraphInfo | null
  theo: Reach
  prewarmOk: boolean | null
  prewarmAt: string
  website: Reach
  pluginActive: string
  pluginInstalled: string
  notes: string[]
  source: 'mindrian-os' | 'files'
  binding: Binding | null
  claims: ClaimsInfo | null
}

declare module 'claude-code' {
  interface PluginState {
    'mos-face': {
      face: FaceId
      detail: string
      mos: number
      move: Move
      frame: number
      isHidden: boolean
      isChipOff: boolean
      style: FaceStyle
      spoken: number
      theo: TheoCall[]
      theoTurn: TheoTotals
      theoTotals: TheoTotals
      flag: string
      isSuggestOff: boolean
      advice: Advice
      isAutoOff: boolean
      paneAsked: boolean
      bound: string | null
      boundHow: string
      workspace: string
      wordsOn: boolean
      isPlain: boolean
      refreshNote: string
      openSection: string
      openBlock: string
      sectionFiles: string[]
      freshNames: string[]
      lit: Record<string, number>
      litWhy: Record<string, string>
      snap: Snapshot | null
      isRefreshing: boolean
      // The canon face asset as checked text, or an empty string when it could not be read; and the plain
      // sentence that says so (Phase 380 plan 13, D-10).
      faceAsset: string
      faceAssetNote: string
    }
  }
}
