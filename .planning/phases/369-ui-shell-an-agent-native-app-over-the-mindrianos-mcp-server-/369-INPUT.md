---
phase: 369
kind: planning-input
recorded: 2026-10-02
promotes: [SEED-105, SEED-107]
weighs: [SEED-006, SEED-020, SEED-036, SEED-066, SEED-067, SEED-071, SEED-072, SEED-073, SEED-091, SEED-104, SEED-106]
spikes: [005-mcp-http-reach, 006-room-pull-checkpoint, 007-agent-native-wraps-mcp]
sources:
  - .planning/seeds/SEED-105-ui-shell-agent-native-wrapping-mcp-tools.md (idea, constraints, enrichment, navigator rule, pre-step, inventory gap)
  - .planning/seeds/SEED-107-cjs-only-lifted-typescript-adoption.md (the ruling, what CJS protected, candidate shape, done-when)
  - .planning/spikes/005-mcp-http-reach/README.md, 006-room-pull-checkpoint/README.md, 007-agent-native-wraps-mcp/README.md (all VALIDATED; results.json per spike)
  - .planning/research/2026-10-02-UI-UX-PRIOR-ART-INVENTORY.md (five eras, 11 threads, 16 conflicts, 14 open questions, reuse candidates)
  - rethinking-mindrianos/research/2026-10-02-ui-shell-and-theo-relationship-from-a-science-session.md
  - docs/reviews/2026-09-20-localhost-workspace-review.md (260920-bhx, disposition "ready for design review")
  - .planning/sketches/MANIFEST.md (sketch 001, three variants, no winner)
  - ~/dev/mindrian-website/docs/DESIGN-CANON.md (Design Canon v3 Workshop Modernism, derived 2026-10-02)
  - ~/dev/mindrian-workroom/package.json (Next 16.2.10, React 19.2.4, @blocknote/core 0.51.4)
  - .planning/seeds/SEED-006, SEED-020 (shape-f), SEED-066, SEED-067, SEED-071, SEED-072, SEED-073, SEED-091, SEED-036
  - lib/mcp/gate-ledger.cjs (consumeGate, about line 100), lib/mcp/tools/gate.cjs (ladder comment lines 9-14), lib/mcp/sse-event-bus.cjs
  - memory rule 2026-10-02 (feedback_mos_ui_stack_and_v3_design_rule): stack and styling for every MindrianOS UI task
status: input only; /gsd-discuss-phase 369 turns this into CONTEXT, then /gsd-plan-phase 369 into plans
---

# Phase 369 planning input: the UI shell, with every prior finding in one place

This file is the research the navigator asked to be IN the phase ("build the uiux phases with all research
in them", 2026-10-02). It consolidates; it does not re-derive. Where two sources disagree, both are kept and
the conflict is numbered (section 5). Counts and citations only; no room content. Hyphens only.

## 0. Rulings in force (dated, binding)

| Date | Ruling | Source |
|---|---|---|
| 2026-06-06 | The AskUserQuestion card (Shape F) IS the Mindrian UI style, for `/mos:help` and every chooser, not only the dev dial | SEED-020 (shape-f), Canon Part 3 |
| 2026-07-18 | Terminal first, workspace later; AFFiNE and Docmost disqualified; assemble from parts we control | SEED-066 |
| 2026-07-19 | BlockNote work split by surface: `/mos:wiki` stays Express+CJS (Phase 232, shipped); `dev/mindrian-workroom` kept alive as the hosted/Cowork prototype | SEED-006 expansion note, SEED-091 |
| 2026-07-21 | The collaborative-editor direction (BlockNote + Yjs, RxDB as cache) is "the one direction I'll go with", with the SEED-066/071 corrections applied | SEED-072 |
| 2026-07-22 | Filesystem + `room.db` stay canonical; Yjs and RxDB are disposable projections; RxDB free tier only, never its paid SQLite adapter | SEED-073 |
| 2026-09-20 | Task-centered workspace direction; Claude Code is the execution engine; Claude adapter proof is the first implementation gate; do not reskin the old dashboard | bhx review, "Review decisions" |
| 2026-09-23 | "Let elicitation take over on CLI" (gate rung) | `lib/mcp/tools/gate.cjs:9-14` |
| 2026-10-02 | "Normal card on CLI": a gate is the AskUserQuestion rung and never also an elicitation (reverses the 2026-09-23 ruling; code not yet updated; folded into Phase 289) | SEED-104 quick 261002-0n4 note |
| 2026-10-02 | Stack, always together: icm-workspace-architect, websocket-engineer, RxDB (browser read copy, one way), agent-native (shell; actions = MCP tools) | SEED-105 navigator rule, memory rule |
| 2026-10-02 | Styling ONLY with Design Canon v3 Workshop Modernism; the 2026-10-02 mockup palette is superseded | SEED-105 navigator rule, `docs/DESIGN-CANON.md` |
| 2026-10-02 | Pre-step: read and discuss the UI/UX prior-art inventory before any UI work on SEED-104..107; discussion first | SEED-105 pre-step |
| 2026-10-02 | "the ui worth sacrificing the CJS-only hard rule !"; scope card: "Whole plugin may go TypeScript" | SEED-107 |
| 2026-10-02 | The UI seed gets its own phase (this one); SEED-107 rides as wave 0 | fold decision, `2026-10-02-seeds-101-107-fold-map.md` |

## 1. The idea (SEED-105) and the stack, one job per layer

BuilderIO agent-native (TypeScript/React) defines each capability once as a zod-schema **action**: the agent
calls it as a tool, the UI calls it from code, and it is exposed over HTTP, MCP, A2A and CLI. MindrianOS already
defines its MCP tools with zod schemas, so every tool maps one-to-one onto an action. The UI is an agent-native
app whose actions are thin wrappers over the existing MindrianOS MCP server (Streamable HTTP, already served).

- **agent-native**: actions only; the MCP tools exposed as UI calls and agent tools. The only write path.
- **RxDB in the browser**: a cached, offline-capable copy of the room for instant views (Dexie/IndexedDB, free).
  It replaces agent-native's own Postgres data layer for room views; never run both for room data.
- **`room.db` + `navigation.cjs`**: the only truth. Sync flows one way, room to browser. Writes go only through
  the MCP actions. No `pushHandler` for room data; a browser never pushes a confirmed claim.

What it unlocks: decision gates as real buttons with a preselected recommendation (kills the SEED-104
"not set" elicitation class); shared application state mapped onto `context_assemble focus_node_id` (select a
node, Larry's context centers on it); an implementation substrate for the 260920-bhx workspace.

Non-negotiable constraints carried from the seed: no second store for room state (Canon Part 9); the in-app
agent is not Larry-with-hooks, so gates, the Part 8 egress guard and card enforcement hold server-side (Phase
198 MCP-first) and every Brain/Theo call goes through the guarded shim (THEO-04); the Hooked model is the lens
for the first screen; Tri-Polar: a fourth surface, not a replacement. The seed's constraint 2 ("plugin stays
CJS-only") is SUPERSEDED by SEED-107.

Realtime: start with the existing server-sent events bus (`status_read` publishes `status-segment`), one-way
push covers "the room changed, refresh". WebSockets only for Cowork-style multi-user concurrent editing.

## 2. What the three spikes measured (throwaway room copies; the real room untouched)

### Spike 005: MCP over HTTP can drive the UI's decision gates (VALIDATED)
- Default HTTP mode (no sessions, legacy shared transport) FAILED for the SDK client (empty "Error POSTing to
  endpoint"); a raw `initialize` works, the follow-up requests on the shared transport do not. **Do not build the
  UI on this mode.**
- Per-connection session mode (`MINDRIAN_MCP_FIRST=cowork`) VALIDATED: connect about 26 ms; 45 tools listed;
  `room_bind` bound the throwaway room; `gate_render` returned `renderer: askuserquestion` with structured zones
  (header, body, footer), so the UI renders real buttons from the zones, no elicitation dialog; `gate_answer` on
  the same connection ratified (memory_event + decision node written); `room_state status` p50 4 ms, p90 5 ms,
  max 6 ms (10 calls, loopback).
- **Cross-connection answer refused** (`session_mismatch`): a gate belongs to the session that minted it. A
  Cowork view where person B approves person A's gate needs an explicit hand-off action, not a shared button
  (the 2026-10-02 Cowork mockup assumed otherwise).
- Lessons: check which room the reached server is bound to (a leftover server on the port silently served the
  wrong room); `graph_query` with no focus returns empty and asks for a node id; SIGTERM did not stop the HTTP
  server, SIGKILL did.

### Spike 006: a browser copy of the room that stays current, one way (VALIDATED, with a different checkpoint than SEED-105 names)
RxDB 17.5.0, `replicateRxCollection`, pull only, `pull.stream$` with `RESYNC` on reconnect; journal mode results
(three repeats):

| Probe | Result |
|---|---|
| P1 cold catch-up, 202 nodes + 30 edges | 110-168 ms in page, 3 pull requests; navigation to ready 439-544 ms |
| P2 live write to on screen (12 `claim_write`) | call p50 7 ms; write to render p50 19-28 ms, p95 22-29 ms |
| P3 `gate_render` to `gate_answer` on the page's subject claim | ratified; status change on screen 23-28 ms after the answer; new decision node appeared; same page load |
| P4 burst, 200 concurrent writes | all on screen 42-69 ms after the last call; 0 missing |
| P5 pull server killed, 6 writes, restart | converged 1.0-1.4 s after restart (EventSource retry 1 s dominates); 0 missing |
| P6 superseded entry | left the view in 22-38 ms; kept as an RxDB tombstone (`_deleted`), not erased |
| P7 hard delete (graph-rebuild while live) | journal: converged, 0 stale; timestamp mode: 10 stale rows |
| P8 warm reload | 36 ms, 0 documents pulled (checkpoint persisted in IndexedDB) |
| P11 scale, +2,000 writes (2,420 nodes) | converged 107-130 ms after the last write; refresh p50 5 ms, p95 10-13 ms; cold catch-up 530-1,078 ms; timestamp mode lost 21 of 2,000 |
| P9 egress and push | hosts contacted: `127.0.0.1:3871`, `fonts.googleapis.com`, `fonts.gstatic.com` only; 0 non-GET requests; POST to the pull server answers 405 |
| P10 plugin SSE bus during all writes | 0 frames |

### Spike 007: one click on a real research-grant gate, through agent-native (VALIDATED on the machine-verifiable part; the navigator's own click is still owed)
- License, checked first at commit `8aae00fb` (2026-10-01): root `package.json` says ISC (private monorepo root),
  root README says MIT, one LICENSE file (`packages/vscode-extension/LICENSE.md`, MIT, Builder.io), npm
  `@agent-native/core@0.198.8` declares MIT but its tarball ships no MIT text (three font licences only). Reading:
  MIT by every published declaration; nothing blocks commercial use; carry the MIT notice by hand; check the
  three OFL font licences if the fonts ship.
- Actions: `defineAction({ schema: zod, http, run })`, served at `/_agent-native/actions/<name>`; React hooks from
  `@agent-native/core/client/hooks` (the README path `client` is refused by 0.198). It CAN consume external MCP
  servers as agent tools (`mcp-client/`, `mcp.config.json`, stdio or http, tools named `mcp__<server>__<tool>`,
  OAuth) and exposes its own actions as MCP. Telemetry to `analytics.agent-native.com` by default; off with
  `DO_NOT_TRACK=1` or `AGENT_NATIVE_TELEMETRY_DISABLED=1`.
- Results: gate on screen 6.6-17.3 s in dev (Vite compiles), 0.65-1.2 s production; recommended option
  preselected 3 of 3 arms; click to the room's answer 60-116 ms dev, 66-68 ms production; click to the decision
  visible in the 006 RxDB view 69-125 ms dev, 73 ms production; "Not now" answered and saved nothing; browser
  hosts 127.0.0.1 and Google Fonts only; no non-loopback sockets; no room data in agent-native's database.
- Build: `pnpm build` 77 s, 27.4 MB (8.9 MB gzip). Production refuses PGlite and wants `DATABASE_URL`; chat,
  automations and integrations error at boot; actions and the gate route need no database and keep working.
- Trail facts that bind the build: the scaffold writes `CLAUDE.md`, `.claude/skills` and `.mcp.json` into the app
  folder and that CLAUDE.md auto-loaded into the Claude session; `agent-native dev` binds `*:8080` and runs a PTY
  server on `127.0.0.1:42003`; a "Not now" answer returns `ok: true, ratified: false` (treat `ok` as success);
  the gate first rendered inside agent-native's chat shell (white sidebar, Inter, rounded panel) which breaks one
  decision per view, so `/gate` is rendered full-bleed; `mos-ui/` is git-ignored and rebuilt from `setup.sh` in 17 s.

### The ten measured contradictions to the seed text (inputs, not footnotes)
From spike 006:
1. `{last_modified_at, id}` cannot be the checkpoint: `last_modified_at` is NULL on 171 of 174 inserted rows, and
   any `{timestamp, id}` checkpoint drops same-millisecond writes (49 and 179 of 2,000 in stress; 21 of 2,000 at
   scale). The real build needs a writer-side monotonic change sequence (`change_seq` or a change log) written
   inside the navigation chokepoint's own transaction; the spike's server-side journal is the stand-in.
2. The existing SSE bus does not fire on room writes; only `status_read` publishes. Either the chokepoint publishes
   a `room-changed` kind on commit (the bus lives in the MCP server process, so only that process's writes reach
   it) or the UI server watches `room.db`.
3. Hard deletes exist (`lazygraph-ops` reindex, `typed-entity` legacy purge, `rs-engine`); "superseded maps to
   `_deleted`" is not the whole delete story; tombstones or an id reconcile are required.
4. The 500-document cap belongs to RxDB's SQLite trial storage, not Dexie; the binding free-tier limit is
   `NON_PREMIUM_COLLECTION_LIMIT = 13` open collections. RxDB dev-mode injects an iframe from rxdb.info; never
   load it (Part 8).
5. No MCP tool reaches `supersede()` (`supersession-gate.cjs` WD-348-3); the mapping is verified, the trigger is
   not reachable from a UI today.
From spike 007:
6. "PGlite may hold UI session data" is a dev-only truth; production requires a hosted Postgres for agent-native's
   own tables, or the UI drops its chat/automation features and uses actions and routes only.
7. agent-native cannot consume the MindrianOS MCP server as agent tools today: its SDK v2 client opens with a
   session-less `server/discover`, the v1 per-connection server answers HTTP 400, and the connect guard records the
   failure. A loopback shim answering that probe with JSON-RPC `-32601` over HTTP 200 makes it work (45 tools, a
   gate minted and ratified through `McpClientManager`). An HTTP 404 still fails.
8. A refused cross-session answer cancels the owner's gate: `lib/mcp/gate-ledger.cjs` `consumeGate` deletes the
   entry before the session check (scripted in `stages/02_actions/burn-probe.cjs`). Anyone who learns a gate id can
   cancel someone else's decision. (Folded into Phase 289.)
9. The gate contract does not carry the recommendation (`recommended: null`, `preChecked: []`); only
   `card.options[].recommended` holds it. Same gap behind SEED-104's "not set" dialog. (Phase 289.)
10. The scaffold's CLAUDE.md bleeds into Claude sessions, its CLI phones home by default, and its dev server
    listens on every interface.

## 3. Prior art the phase must weigh (from the 2026-10-02 inventory)

Five eras: V2/V4 apps (Feb-Mar 2026, Next.js, CopilotKit, React Flow, tldraw, superseded when the product became
a plugin); the terminal ruling system (Mar 2026 on; 4 zones, 5 body shapes, 12 glyphs, Shape F F.0-F.9 through
AskUserQuestion; shipped and the law today); localhost and HTML views (Mar-Apr; dashboard, wiki, 6-view
presentation, SnapshotHub, three MCP Apps; shipped with known defects); the visible room (Jul; BlockNote wiki
Phase 232 shipped, `dev/mindrian-workroom` alive with no auth, collaborative-editor seeds 066/072/073 unbuilt);
the workspace and shell route (Sep-Oct; bhx review, sketch 001, spikes 005-007, SEED-105/107; reviewed, not built).

Shipped: the CLI ruling system, Shape F renderers, the gate render ladder, statusline cockpit, legacy dashboard,
wiki with BlockNote editing, presentation/deck/export/snapshot generators, three MCP Apps (Desktop/Cowork only),
the SSE bus (behind a flag). Unbuilt: the bhx workspace, the Phase 136 render spine, the v1.12 MCP Apps host plan,
`mindrian-platform.html` (built, orphaned), collaborative editing, auth/tenancy for the workroom.

The workroom, measured 2026-09-07 (SEED-091): `npm run dev` ready in 429 ms, Next.js 16.2.10 + React 19.2.4 +
BlockNote (core/mantine/react + `xl-docx-exporter` + `xl-pdf-exporter`), the room-grid dashboard renders 32 real
rooms (55 with sub-rooms) with real stages, reads and writes room `.md` files via API routes, deployed to Vercel
once, last touched 2026-07-18. Missing: auth (`.env.local` has one key), a tenant concept, a README. Its
`globals.css` chose M:OS v1.1 over the website canon in July. Its `xl-*` exporters are GPL-3.0 (SEED-066); Phase
232 substituted MIT `pdfmake` + `docx`. A three-screen "Workroom, Signed In" mockup exists (2026-09-07).

The bhx review (2026-09-20, disposition "ready for design review", implementation not approved): the central
question on opening is "What am I trying to resolve, what do I know, and what needs my attention next?"; a graph is
not the opening task; primary navigation Work / Evidence / Decisions / Deliverables / Rooms; connection details and
diagnostics in a secondary status surface; review decisions: approve the task-centered direction and a separate new
UI entry point; browser-owned execution plus observation of terminal work with explicit handoff; Claude adapter
proof as the first implementation gate; keep room state and domain governance authoritative; reuse tested services
behind new adapters; suggested (not measured) targets: useful room view within 2 s, committed artifact visible
within 1 s, cancellation acknowledged within 1 s.

Sketch 001 (Mindrian Workroom Shell): three variants (React + Vite + xyflow), "90% modern, calm, precise, 10% De
Stijl as semantic punctuation", conversation as the primary surface, AG-UI-style typed events; no winner selected.

MCP Apps: `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` said "Tier 1 is the product"; SEED-072 notes MCP Apps'
`postMessage` bridge is user-initiated and so is a different question from SEED-065's pure-MCP push ceiling; the
three inline views register only on Desktop/Cowork. Reuse candidates for the shell are in the inventory section 6.

## 4. Settled; do not re-litigate

- SEED-066: AFFiNE (proprietary EE licence on the sync server; README contradicts LICENSE; de-branding sold as
  Enterprise) and Docmost (AGPL-3.0 section 13) are disqualified. BlockSuite MPL-2.0 with HIGH relicensing risk.
  BlockNote MPL-2.0 core, GPL-3.0 `xl-*`. OpenHands MIT only after deleting `enterprise/`, registered trademark.
  Clean: Yjs (MIT, no CLA), Tiptap core (MIT), Hocuspocus (MIT, owned by Tiptap GmbH). Always read the LICENSE
  file, never the README; check trademark separately.
- SEED-073: never point RxDB's storage adapter at `room.db` (paid Pro adapter); RxDB free tier as a
  query-populated cache is sufficient; Yjs/Hocuspocus does not conflict with the shipped wikilink-pill transforms
  (`textRunsToWikilinks` / `wikilinksToTextRuns`); `scripts/serve-dashboard-live` already ships fs.watch + SSE
  reactive updates, so RxDB is about client-side query ergonomics, not about having reactivity at all. PowerSync,
  ElectricSQL, CR-SQLite (stale since 2024-10-25, live queries never finished) and SQLite Sync (Elastic License
  2.0, hosted-service restriction) were checked and rejected for this job.
- SEED-072: start any collaborative-workspace work from SEED-066 + SEED-071 + the room.db-population priority;
  the 2026-07-20 external survey is supplementary; BlockNote must be dynamically imported client-side only in
  Next.js; `uploadFile` is the hook for custom block storage.
- SEED-071: ingestion (MarkItDown) is sequenced behind the extraction-gate fix; LangExtract has no Anthropic
  provider (a new-vendor Part 8 decision, not a library choice).
- SEED-067: subscription passthrough is contractually forbidden by Anthropic; an in-app agent that is not Claude
  Code needs its own key and cost model (inventory C6).
- SEED-091: OpenCode and AgentOS rejected as foundations on four axes (delivery model, runtime, stack, moat);
  keep the client-server idea (one server, N clients) which Phase 198 needs.

## 5. Conflicts (inventory section 5, condensed; every one needs a ruling at discuss)

| # | Conflict | Sides |
|---|---|---|
| C1 | Palette and typography | v3 Workshop Modernism (paper `#F5F0E6`, rust/cobalt/ochre, Fraunces/DM Sans/Bodoni) vs shipped M:OS v1.1 (`#F4F2EC`, `#E11D22`, `#1E52E0`, `#FFC400`, one grotesk) and `references/visual/palette.json`; `skills/ui-system/SKILL.md:20` "No generator invents its own palette" holds two systems until reconciled |
| C2 | De Stijl primaries vs meaning-only colour | the five voice squares survive in v3; only the hues change |
| C3 | CJS-only vs TypeScript | CLAUDE.md Conventions still live; SEED-107 lifts it; this phase's wave 0 |
| C4 | CLI gate rung | `gate.cjs:9-14` elicitation vs the 2026-10-02 "normal card on CLI" ruling; root of SEED-104 defect 3; Phase 289 |
| C5 | Room home: grid vs task | memory rule "Mondrian grid is standard" (with its own sunset clause) vs Phase 232 Room Home vs bhx Work tab vs v3 tile room |
| C6 | Who the in-app agent is | agent-native's own loop (needs a key) vs the bhx local Claude Code adapter; SEED-067 |
| C7 | Which UI codebase | SEED-091 workroom vs SEED-105 agent-native app vs sketch 001; SEED-105 never weighed the workroom |
| C8 | Realtime choice | SSE first vs websocket-engineer always in the stack (compatible as design guidance; the SSE bus emitted 0 frames in 006) |
| C9 | Shape F count | canon ten shapes vs five F-sub-shapes vs SKILL F.0-F.7 vs destijl F.0-F.6 |
| C10 | No-CDN rule vs shipped HTML | SKILL.md:26 "never a CDN" vs MCP app-html (jsdelivr, cdnjs, Google Fonts), wiki (unpkg), presentation (marked, d3); spikes 006/007 contacted Google Fonts |
| C11 | Dark vs cream | Phase 19 wiki dark vs v1.1 "never black" vs v3 paper; MCP app-html still dark |
| C12 | MCP Apps as the product | "Tier 1 is the product" vs a standalone fourth surface |
| C13 | Editing model | Phase 232 direct unguarded save vs bhx expected revision + idempotency key vs SEED-105 writes only via gated MCP actions |
| C14 | BlockNote exporters licence | `xl-*` GPL-3.0 avoided in the plugin vs used by the workroom |
| C15 | Academy layout | full-screen swap vs 40/60 panels (historical) |
| C16 | Phase 232 UI-SPEC vs disk | the workroom prototype "removed from disk" per spec vs present and running on 2026-09-07 |

## 6. The 14 open questions (inventory section 7); discuss-phase agenda, in order

1. Which codebase is the UI: revive the workroom, start the agent-native app, or grow from sketch 001?
2. What does "the BlockNote capability" mean: the shipped Phase 232 wiki editor, the workroom editor, or BlockNote
   as the main document surface of the new shell (then direct save becomes a governed MCP action; SEED-072/073
   join the related list)?
3. Who is the agent inside the UI: agent-native's own model loop (own key, own cost model) or the bhx local Claude
   Code adapter (adapter proof first)?
4. Does v3 Workshop Modernism replace M:OS v1.1 across the plugin (wiki, decks, exports, MCP app-html, mail) or
   only in the new UI (then SKILL.md:20 needs an amendment)?
5. Which CLI gate rung wins, and does the SEED-104 fix (Phase 289) land before the UI build so the web button and
   the CLI card share one tested superset?
6. Do the bhx review decisions count as approved (the IA Work / Evidence / Decisions / Deliverables / Rooms; Claude
   adapter proof first)?
7. Does v3's "one decision per view" plus the five-square tile room become the product's room view, replacing the
   Mondrian grid standard and Room Home?
8. TypeScript timing: does SEED-107's constitution edit land before the shell build (this phase's wave 0 says yes)?
9. Where do MCP Apps stand: keep the three inline views as the Desktop/Cowork face, retire them, or rebuild them on
   the new UI's components? What happens to the orphan `mindrian-platform.html`?
10. Realtime scope for v1: enable the SSE bus without the MCP-first flag and give it `room-changed`, `gate-fired`
    and `reconcile-raised` publishers before RxDB? Is Cowork multi-user (WebSockets, the 005 hand-off action) in v1?
11. Desktop/Cowork: CLI/localhost only, reporting unsupported execution elsewhere, or hosted (SEED-091 tenant DB)?
12. Hooked first screen: the one variable reward on first open (bhx central question or v3 four questions).
13. Graph: a secondary tab (232, bhx) or a first-class view (sketch 001 variant B, xyflow)? Does SEED-026 gate it?
14. Statusline co-design: does the UI's session indicator fall under the statusline co-design rule?

Evidence-backed defaults the planner may propose (the navigator rules): Q5 yes, Phase 289 first (two spikes hit the
same ledger and contract gaps); Q8 yes, wave 0; Q10 publish `room-changed` from the chokepoint and add
`change_seq` (006 contradictions 1 and 2) before any RxDB code; Q11 CLI/localhost v1 (bhx item 8); Q3 adapter proof
first unless the navigator accepts a second model key (SEED-067).

## 7. Design Canon v3 Workshop Modernism (the only styling source; `~/dev/mindrian-website/docs/DESIGN-CANON.md`)

Tokens: `--paper #F5F0E6` (about 70 percent of every screen by area), `--paper-deep #E9DFCF`, `--paper-light
#FCF9F2`, `--ink #14202B`, `--ink-soft #46535D`, `--line` ink at 1 or 2 px (never a tinted grey), `--rust #A8462D`
(fixed structure, the red tile, the one UI accent on paper), `--cobalt #2457A5` (current state, "you are here"),
`--ochre #D49A20` (next action, the CTA triangle), `--success #2F6849`, `--error #A12E2E`. Retired: v2 teal, v2
mustard, the tinted hairline. Colour is never decoration and never the only carrier of a state; every tile grid
carries a mono legend.

Contrast law (measured 2026-10-02, WCAG 2.1 AA): ink on paper 14.5; ink-soft on paper 7.0; rust on paper 5.2;
cobalt on paper 6.2; ochre on ink 6.6; ochre on paper 2.2 FAILS even the 3:1 graphics floor; cobalt on ink 2.4 and
rust on ink 2.8 FAIL on dark islands; ochre on paper-deep 1.9 FAILS (ink outline required); rust on paper-deep 4.45
large text and UI only. Focus ring on paper: 2 px ochre outline with a 1 px ink edge.

State language: the five Larry squares as tiles (blue cobalt building; red rust challenged or fixed; yellow ochre
with ink outline contradiction; black ink decision gate; white paper-light with ink outline handed over or empty),
and three control shapes (rust square fixed; cobalt circle current, one per view; ochre triangle next, one per
view). Typography: Fraunces for headlines and product statements (italic for the accent word), DM Sans for body,
navigation, forms, CTAs and system copy, Bodoni Moda rare. Form: radius 0 everywhere; 1 or 2 px ink rules are the
architecture; no shadows, glass, gradients, pills or rounded cards; strict 12-column desktop grid. CTA: one
dominant action per key view; an ink rectangle, 2 px ink border, minimum height 56 px, a 24 px marker column with
the ochre triangle, a two-line label naming the outcome (Join M:OS, Open the active room, Ask Larry about this
step; never Submit, Learn more, Next), a consequence line in the house voice. Spike 007's gate view already follows
this (paper, Fraunces headline with the accent in rust, ruled answer box, ink Confirm bar with the ochre triangle,
"Saves this decision to the room. Nothing is searched yet.").

## 8. Wave 0: SEED-107, CJS-only lifted without breaking install, hooks or the release lockstep

The ruling supersedes CLAUDE.md Conventions ("CJS only, no TypeScript: `lib/core/*.cjs` ships as source; every
output is an inspectable edit surface") and `.planning/spikes/CONVENTIONS.md` line 8 ("Node 22 CJS, zero npm
deps"). Until this phase lands, CLAUDE.md still says CJS-only; the edit goes through GSD, never silently.

What the rule protected (keep these, change the means): no build step on the user's machine (install is `claude
plugin install` plus the npm-shrinkwrap loader, RULE 8); hook cold start inside the 2000 ms budgets spike 003
measured; inspectable source; the release lockstep (`scripts/release.sh`, RULE 5 assume no build artifact).

Candidate shape to evaluate (not decided): erasable-only TypeScript run natively by Node (verify the exact Node
line where type stripping is unflagged against the repo floor `>=22.16.0`, the floor set by `node:sqlite`'s
`timeout` option; a raised floor is a release-note-level change; erasable syntax only, no enums, namespaces or
parameter properties); the UI package (agent-native + RxDB, React) as a normal Vite build shipping built assets, the
one place a build step is unavoidable (spike 007: 77 s, 27.4 MB); hooks and the MCP server stay plain JS until a
cold-start measurement says otherwise; mixed CJS/ESM interop decided explicitly (agent-native and RxDB are
ESM-first). Done when: CLAUDE.md and CONVENTIONS rewritten via GSD with a canon/decision row; the TS shape decided
with a measured hook cold-start number and a clean-machine install test; release.sh and RULE 5 updated if any build
artifact ships. Note for the planner: on this WSL machine `/usr/bin/node` is v20; every command runs with the nvm
v22.23.1 PATH first (366 handoff anti-pattern).

RESOLVED 2026-10-02 (second opinion, `369-SECOND-OPINION-2026-10-02.md`, citing the Node 22.16.0 TypeScript docs and the 22.18.0
release notes): at 22.16.0 type stripping still needs the experimental flag; it runs unflagged from 22.18.0. The
floor rises to `>=22.18.0` at wave 0 (release-note-level). Core rule: erasable-only `.ts` (no enum, no namespaces,
no parameter properties, no TS path aliases, explicit extensions, `import type`, no TSX, `erasableSyntaxOnly` and
`verbatimModuleSyntax`); UI is a Vite build with TSX; hooks stay `.cjs` until measured.

## 9. MCP-side work the shell needs first (files named)

| Fix | Where | Evidence |
|---|---|---|
| Session check before consume | `lib/mcp/gate-ledger.cjs` `consumeGate` (about line 100) | 007 trail 3, `burn-probe.cjs`; Phase 289 |
| `recommended` in the gate contract | gate render contract (`recommended: null`, `preChecked: []`) | 007 trail 5; SEED-104 "not set"; Phase 289 |
| Normal card on CLI, no double elicitation | `lib/mcp/tools/gate.cjs:9-14`, `detectClientCapabilities` about line 311 | SEED-104; Phase 289 |
| SDK-v2 `server/discover` handshake: shipped by Phase 267 (closed 2026-10-02, 18 of 18, 72f16523e); 369 re-runs the agent-native connect against the shipped server | Phase 267 plans; `bin/mindrian-mcp-server.cjs` | 007 trail 6, `discover-shim.cjs` (retires with 267) |
| `room-changed` on the SSE bus from the chokepoint | `lib/core/navigation.cjs`, `lib/mcp/sse-event-bus.cjs` | 006 contradiction 2 (0 frames) |
| Writer-side `change_seq` in the chokepoint's transaction | `lib/core/node-insert.cjs`, `lib/core/navigation/transitions.cjs` | 006 contradiction 1 |
| Tombstones or id reconcile for hard deletes | `lazygraph-ops`, `typed-entity` purge, `rs-engine` | 006 contradiction 3 |
| A governed path to `supersede()` from a UI | `supersession-gate.cjs` WD-348-3 | 006 contradiction 5 |
| Do not build on default (session-less) HTTP mode | `MINDRIAN_MCP_FIRST=cowork` per-connection mode | 005 results |

## 10. One description, many surfaces (SEED-106 item 7; weighed here, not in 366.1)

Theo holds 113 MindrianCommand nodes re-emitted from the plugin's command registry by `repository_dispatch`.
If `data/command-registry.json` became the single description every surface is generated from (command
frontmatter, MCP tool definitions under a description budget, the website list per SEED-036, Theo's command
layer, and this shell's action definitions), drift becomes a build error. Cloudflare Forge (OpenAPI to SDK, CLI,
docs, MCP; Apache-2.0; TypeScript) is the pattern, not an adoptable dependency (no OpenAPI here). Measured
correction 2026-10-02: the mindrian-os server instructions are 1984 bytes, under the 2,048-character cap, enforced
by `lib/mcp/no-instructions.test.cjs`; the truncation seen in sessions was the user-level `pws-brain-mcp` entry in
`~/.claude.json`, which this repo does not ship and which also bypasses the guarded shim (THEO-04 shape).

## 11. Canon the phase answers to

Part 8 (no room content to the Brain; the shell's replication stays on the machine or the team's server; no
telemetry hosts; no rxdb.info iframe), Part 9 (room.db is the local mind; only a human confirms a truth claim;
no browser push), Part 3 (Shape F is the universal chooser; the web button is a Shape F render), Part 10
(conversation is the surface; the shell shows Larry beside the work), Part 11 (every invocable surface born
WIRED or EXCLUDED with a HITL shape), Part 12 (the five squares open every Larry turn; the tiles carry them),
Part 7 (reuse before build: the workroom, Phase 232, the three MCP Apps, `serve-dashboard-live`, the Shape F
renderers are all prior surfaces this phase must justify against), Tri-Polar, the Hooked first step, and the
Phase 343 counter-metric rule (counts only, SEED-074).

## 13. Second opinion (Codex, 2026-10-02): adopted, corrected, with sources

Full text: `369-SECOND-OPINION-2026-10-02.md`. Consulted by the navigator with the plain-text brief from the Downloads bundle.

| # | Recommendation | Verdict | Why, against our evidence |
|---|---|---|---|
| 1 | Task-shaped actions over 1:1 primitive adapters; composition server-side | ADOPTED | the same rule Phase 270 set for the memory operator; a dropped connection must not leave half an intention done; deliverable (3) rewritten |
| 2 | One append-only `room_change_log` + `change_seq` in the same transaction; SSE = wake-up only; pull = delta; `checkpoint_expired` + snapshot on compaction | ADOPTED | solves spike 006 contradictions 1-3 in one structure; sits on the single write path Phases 273 and 348 already made; deliverable (2) rewritten |
| 3 | Fix `server/discover` semantics in 369; migrate to SDK v2 later as its own change | CORRECTED | the migration is Phase 267, closed 2026-10-02 (18 of 18 plans, 72f16523e: local MCP server family on SDK v2, v2 McpServer + `serveStdio` on stdio, flag-ON HTTP routed by protocol era, `server/discover` handled; Claude Code 2.1.287 already opens stdio with `server/discover`, 267-TRIPOLAR-PROBES.md); 369 ships no shim and inherits two 267 follow-ons: MCPV2-13 (human Desktop/Cowork smoke) and the desktop session-binding fallback (process-scoped stdio session key; writes refuse when unbound) |
| 4 | RxDB as a UI projection schema (about six collections), disposable by constitution | ADOPTED | SEED-073 verbatim, independently re-derived; removes the 13-collection concern; deliverable (4) rewritten |
| 5 | Workroom as chassis, agent-native as donor; decide by the same vertical slice built twice, judged on four things | ADOPTED WITH TWO GUARDS | the slice must force every read and write through the action layer (the workroom reads `~/MindrianRooms` directly via Next API routes today) and drop the GPL-3.0 `xl-*` exporters (SEED-066); now the discuss Q1 default |
| 6 | Node floor: unflagged type stripping needs `>=22.18.0`, not 22.16.0; erasable-only rule list; UI Vite build; hooks stay JS | ADOPTED | our brief hedged ("verify the exact Node line") where it should have checked; section 8 and deliverable (1) corrected |
| P0 | ledger consume-before-session bug, shared `recommended` field and gate superset, then `change_seq + log + room.changed` | ADOPTED | matches Phase 289 as the dependency plus deliverable (2) |

Codex's framing sentence, kept: "Claude can operate MindrianOS. Claude does not become MindrianOS." It is Canon
Part 9 (only a human confirms a truth claim) said from the UI side.

A second, independent Codex review (same day, run against the exported bundle; it did not rerun the spikes):

| # | Finding | Verdict | Why, against our evidence |
|---|---|---|---|
| R2-1 | "Only a human confirms" needs an enforceable human-vs-agent distinction on `gate_answer`; session ownership proves who minted, not that a person clicked; acceptance test: the agent cannot approve its own proposed claim | ADOPTED, deliverable (10) | today `gate_answer` is an MCP tool any caller on the owning session can invoke; Phase 259 (gate trust) and 357 (gate-triad ledger) are the places to build on |
| R2-2 | The validated replication path is not MCP: spike 006 used its own pull server over navigation.cjs with fs.watch and an in-memory journal; terminal-process writes are invisible to an in-process bus | ADOPTED, deliverable (12) | hooks and scripts write room.db outside the MCP server; the 0 frames in spike 006 are this fact; the feed becomes a `room_changes` MCP read surface and the wake-up watches room.db/WAL or polls the cursor |
| R2-3 | Gate recovery: durable outcomes, idempotent retries, expected-revision checks, explicit expired/stale states; restart, room switch, claim changed under an open gate | ADOPTED, deliverable (11) | `gate_render`'s own contract says the ledger is in-memory and ids do not survive a restart; the 2026-09-20 review already asked for idempotency keys and expected revisions |
| R2-4 | The card could pass with a live view plus a working button while the work loop stays unresolved; decide v1 scope (review surface vs executable workspace) and require one complete journey; carry forward local auth, room isolation, safe rendering, offline assets | ADOPTED, deliverable (13) | the recoverable journey (open the correct room, inspect evidence, human decision, persisted result, restart and recover) is now the acceptance spine and the chassis-test slice |
| R2-5 | Canon v3 is a website canon; rust means challenged and fixed, white means empty and delivered; pair tiles with written statuses; "one decision per view" is a focused approval, not hidden context | ADOPTED, deliverable (14) | the canon itself says shapes support labels and never replace them and colour is never the only carrier of a state; the tile room is unproven as a working evidence view |
| R2-6 | Narrowly scoped discovery compatibility fix; SDK migration separate | CORRECTED | same as row 3: Phase 267 shipped the migration and the discovery handling; no shim in 369 |
| R2-7 | Keep hooks and server JS initially; build the UI at release; Node refuses stripping under `node_modules`, ignores tsconfig, does not type-check; test the installed layout | ADOPTED as the stricter wave-0 default | the plugin installs from an npm tarball through the loader; the installed layout, not the checkout, is what must run |
| R2-8 | UX: Work / Evidence / Decisions / Deliverables with Rooms as the context selector and graph secondary; opening screen = current question, changes since last visit, next decision | ADOPTED as the Q6, Q12 and Q13 defaults | matches the 2026-09-20 review and gives the Hooked first screen its variable reward ("what changed since you were here") |
| R2-9 | Chassis test: the same production-built slice in each (bind room, show evidence, render gate, approve or defer, reconnect); compare retained code, direct-file-write replacement, dependency removal, startup errors, packaging; spike 007's database-error toast means the scaffold is not a clean baseline | ADOPTED, merged into the Q1 default | adds reconnect and packaging to the first review's four judgments |

## 12. Source index

`.planning/seeds/SEED-105-ui-shell-agent-native-wrapping-mcp-tools.md`; `SEED-107-cjs-only-lifted-typescript-adoption.md`;
`.planning/spikes/005-mcp-http-reach/`, `006-room-pull-checkpoint/`, `007-agent-native-wraps-mcp/` (README.md, results.json,
stages/); `.planning/spikes/MANIFEST.md` line 15; `.planning/research/2026-10-02-UI-UX-PRIOR-ART-INVENTORY.md` (426 lines);
`docs/reviews/2026-09-20-localhost-workspace-review.md`; `.planning/quick/260920-bhx-localhost-review/`;
`.planning/sketches/MANIFEST.md`; `~/dev/mindrian-website/docs/DESIGN-CANON.md` and
`docs/superpowers/specs/2026-10-01-design-canon-v3-workshop-modernism.md`; `~/dev/mindrian-workroom/`;
`skills/ui-system/SKILL.md`, `skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md`; `lib/wiki/editor-src/`;
`docs/research/MCP-APPS-STRATEGIC-RESEARCH.md`; seeds 006, 020 (shape-f), 036, 066, 067, 071, 072, 073, 091, 104, 106;
`rethinking-mindrianos/research/2026-10-02-ui-shell-and-theo-relationship-from-a-science-session.md`,
`2026-10-02-seeds-101-107-fold-map.md`; the Downloads bundle `MindrianOS-UIUX-seeds-2026-10-02/` (seed and spike
exports, byte-identical to the repo copies on 2026-10-02).
