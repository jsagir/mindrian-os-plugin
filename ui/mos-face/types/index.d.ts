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

// The kinds of thing the panel removes from the person's words before they are sent. The sent line names
// the kind and never the removed text (Phase 380 plan 16, D-03).
export type RemovedKind = 'link' | 'email' | 'path' | 'code' | 'key' | 'long-name' | 'name' | 'cut'

// What happened to the person's words in one ask. none: no words were due or no call settled (the sent
// line is the handles-only text). not-asked: every call was refused or the tool is missing. sent: a call
// that carried the words was answered. unsure: a call that carried them failed on the way, so they may
// have been received.
export type Delivery =
  | { kind: 'none' }
  | { kind: 'not-asked'; why: 'denied' | 'unavailable' }
  | { kind: 'sent'; excerpt: string; left: readonly RemovedKind[] }
  | { kind: 'unsure'; excerpt: string; left: readonly RemovedKind[] }

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
  delivery: Delivery
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

// The room's recorded job, reduced to what the Job line needs (Phase 380 plan 14, D-09). enteredAt and
// the id come from the plugin's own job state file; nothing else of that file is kept.
export type JobRecord = {
  id: string
  manual: boolean
  confidence: number
  enteredAt: number
}

// The status line's own local files, reduced to what the panel shows (Phase 380 plan 15, D-08). A field is
// null (or empty) when its file was not read; nothing is guessed. who is 'claude' (the host voice), 'theo'
// (the persona, which the panel calls Theo) or empty; direction is 'to-claude', 'to-theo' or empty.
export type VoiceLocal = {
  color: string
  move: string
  who: string
  switched: boolean
  direction: string
}

export type StatusLocal = {
  at: number
  nextMove: string | null
  brain: 'ok' | 'error' | null
  postUpdate: boolean
  voice: VoiceLocal | null
  stance: string | null
  update: string | null
  operator: string | null
  health: 'sound' | 'drift' | 'broken' | null
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
      // The Job line (plan 14, D-09): the compact text of the room's recorded job (an empty string when
      // there is none), whether the person hid the line, and the job it was hidden for (an empty string
      // means hidden whatever the job is).
      jobRecord: string
      jobHidden: boolean
      jobHiddenFor: string
      // The status line's own local files, read once for each refresh tick (plan 15, D-08); null before the first read.
      statusLocal: StatusLocal | null
      // The room tree (plan 380-18): the page and the filter of the browse view, and how many names of an
      // opened folder were left out by the cap.
      treePage: number
      treeFilter: string
      sectionMore: number
    }
  }
}
