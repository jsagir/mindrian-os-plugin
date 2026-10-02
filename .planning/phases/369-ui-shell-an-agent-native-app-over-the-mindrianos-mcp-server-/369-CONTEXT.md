# Phase 369: UI shell, an agent-native app over the MindrianOS MCP server - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 369 ships the fourth MindrianOS surface: a browser workspace for one room whose ONLY access to room data is the
MindrianOS MCP server (Streamable HTTP, per-connection session mode). Three promises define done: (a) a decision gate
is a real button with the recommended option preselected, sharing one tested gate superset with the CLI card; (b) the
room view stays current without a reload through a one-way browser read copy (RxDB on Dexie, pull only, disposable);
(c) every pixel follows Design Canon v3 Workshop Modernism. The phase closes on ONE recoverable journey: open the
correct room, inspect evidence, make a human decision, see its persisted result, restart and recover it.

Inside the boundary: wave 0 (the CJS-only rule lifted plugin-wide and the TypeScript shape decided, hooks and the MCP
server staying JS initially, UI built at release); the MCP-side work the shell needs first (one append-only
`room_change_log` written in the same transaction as every canonical mutation, a `room_changes` MCP read surface, a
`room.changed` SSE wake-up kind, a sessionful acceptance test against the Phase 267 server, the ledger durability rule);
the chassis bake-off (workroom vs agent-native, one production-built slice in each, decided at a Decision Gate); the
shell itself with task-shaped actions over a generated 1:1 adapter; the read copy; the Canon v3 skin with a scoped
amendment to `skills/ui-system/SKILL.md`; the Hooked first screen; the co-designed session indicator.

Outside the boundary (deferred, see below): a plugin-wide v3 restyle; rebuilding the three MCP Apps on the shell's
components; a hosted deployment with a tenant database; Cowork multi-user editing over WebSockets; the executable
workspace loop (task execution, cancellation, return to work); governed BlockNote editing; a first-class graph view.

Dependencies: Phase 289 (the CLI card ruling and the four gate defects) gates the gate-button plans only; wave 0, the
MCP-side change log and the bake-off do not wait for it. Phase 267 (closed 2026-10-02) is the server the shell talks to;
its follow-ons MCPV2-13 and the desktop session-binding fallback are inherited here.

</domain>

<decisions>
## Implementation Decisions

### How this discuss ran (provenance the planner should know)
The Phase 369 card's hard pre-step says discuss opens on the prior-art inventory's 14 open questions and 16 conflicts.
It did, on 2026-10-02, in advisor mode. The navigator chose to discuss ONE area with research (styling and reach,
Q4 / Q9 / Q11 / Q14) and LOCKED the other three areas at the third-pass defaults recorded in `369-INPUT.md` section 13
table 4 (chassis bake-off Q1; first open Q2 / Q6 / Q7 / Q12 / Q13; who may press what Q3 / Q5 / deliverable 10).
Q8 and Q10 were pre-answered by evidence and confirmed by silence. Every default below is therefore a navigator
decision, not a planner guess; the planner does not reopen them. Evidence and reasons live in `369-INPUT.md`
(sections 3, 7, 9, 13) and are not duplicated here.

### Styling and reach (discussed with research, 2026-10-02)
- **D-01 (Q4, Canon v3 scope):** v3 governs the new shell ONLY. `skills/ui-system/SKILL.md` (today lines 18-25 make
  M:OS v1.1 mandatory for any HTML surface and say every future HTML surface inherits it) gains a dated, scoped
  exception naming the shell. The exception also states: the shell bundles its fonts (Fraunces, DM Sans, Bodoni Moda)
  and scripts, no outside hosts (SKILL.md line 22 and Canon Part 8; spikes 006 and 007 reached Google Fonts and that
  stops). Shipped v1.1 generators are untouched. A plugin-wide reconciliation of v1.1 and v3 is its own later phase.
- **D-02 (Q9, MCP Apps and the orphan page):** the three MCP App views (`lib/mcp/app-views.cjs` registers dashboard,
  wiki, graph; `lib/mcp/surface-detect.cjs` turns them off on the CLI, so they never compete with the shell on one
  surface) stay the Desktop/Cowork face. Suitable shell components are shared into them only after the shell is proven
  in production, never in this phase. `lib/mcp/app-html/mindrian-platform.html` (1,841 lines, placeholder
  `callServerTool` at 1709-1711, loaded by nothing) is PARKED with a dated header saying it is parked and not loaded;
  it is not deleted. The dark-theme and CDN debt in the shipped app HTML (conflicts C10, C11) is filed as a seed so it
  stays on record. The "MCP Apps Tier 1 is the product" plan (conflict C12) is retired as the main investment; each
  surface owns its job.
- **D-03 (Q11, reach; settled by evidence, no card):** v1 runs on the user's machine only, from Claude Code or a
  localhost browser. Desktop and Cowork show one plain line ("this runs on your machine from Claude Code") and never
  simulate execution (`docs/reviews/2026-09-20-localhost-workspace-review.md` line 164). Hosting with a tenant
  database (SEED-091) is a separate identity and tenancy scope for a later phase; SEED-067 means it would also need
  its own model key and cost model.
- **D-04 (Q14, the session indicator):** the shell's indicator (room, MCP session, connection state) is CO-DESIGNED
  with the navigator under the statusline co-design rule, as a design gate inside this phase: one AskUserQuestion
  session starting from the four tiers in `docs/STATUSLINE-CONTRACT.md` (Anti-Dealer invariant, line 92), a signed
  design note in the phase directory, then one shell component. The gate does not block other plans.

### Chassis bake-off (locked at the third-pass default)
- **D-05 (Q1):** the workroom (`~/dev/mindrian-workroom`, Next 16.2.10 + React 19.2.4 + BlockNote 0.51.4) is the
  PROVISIONAL chassis and the agent-native scaffold (spike 007) the donor. The decision is made by building the SAME
  vertical slice twice, production-built in BOTH candidates: open a room, show a BlockNote document, ask Claude
  whether a claim has enough evidence, a Mindrian action mints a Shape F gate as real UI, Confirm writes room.db,
  `change_seq` increments, the wake-up fires, RxDB pulls, the evidence view updates. Judged on: architecture
  distorted, workroom code surviving, how cleanly selected UI state reaches Claude, new persistent-state assumptions,
  reconnect after a dropped connection, startup errors (spike 007's database-error toast means the scaffold is not a
  clean baseline), dependency removal, direct-file-write replacement, packaging.
- **D-06 (two guards, SEED-066 and the action layer):** every read and write in the slice goes through the action
  layer (the workroom reads `~/MindrianRooms` directly through Next API routes today, and that path is replaced, not
  wrapped); the GPL-3.0 `xl-*` BlockNote exporters are out before any commercial build.
- **D-07 (how the result is used):** the bake-off ends in a Decision Gate to the navigator (AskUserQuestion with the
  measured comparison), never an executor verdict. If the comparison splits, the default holds (workroom chassis) and
  the losing candidate's winning parts are transplanted; that follows from "workroom chassis, agent-native donor" and
  is the only tie-break rule. The UI build tool follows the winner (Next for the workroom, Vite for the scaffold);
  the binding rule is release-built UI assets, never a build on the user's machine.

### First open and v1 scope (locked at the third-pass default)
- **D-08 (Q13, scope):** v1 is a room REVIEW-AND-DECISION surface. The executable workspace loop (task execution,
  cancellation, document editing, return to work) is v2. The phase closes on the one recoverable journey named in
  the boundary. Local authentication, room isolation, safe content rendering and offline assets are acceptance
  criteria carried from the 2026-09-20 review.
- **D-09 (Q12, the first screen):** the opening screen shows the current question, what changed since the last visit,
  and the next decision. On a first-ever visit it shows present evidence and the next decision; it never invents a
  change history. "What changed since you were here" is the Hooked variable reward.
- **D-10 (Q6, information architecture):** primary navigation Work / Evidence / Decisions / Deliverables, with Rooms
  as the context selector and connection details in a secondary status surface. The task-centered DIRECTION of the
  2026-09-20 review is adopted; its executable-workspace IMPLEMENTATION is not approved by this phase.
- **D-11 (Q7, tiles and "one decision per view"):** the room view is task-centered. The five-square tile room stays a
  labeled front-page illustration until a slice proves it as a working evidence-and-decisions view; a tile never
  carries a state alone (rust = challenged or fixed, white = empty or delivered, always paired with a written status).
  "One decision per view" means one focused approval with its evidence reachable, not hidden context.
- **D-12 (Q13-graph):** the graph is a secondary tab. Typed room.db edges (SEED-026) gate graph correctness, not the
  shell; evidence inspection leads.
- **D-13 (Q2, BlockNote):** BlockNote DISPLAYS documents in v1. Governed editing (direct save replaced by a gated MCP
  action with expected revision and idempotency key) is not in v1 unless the navigator explicitly includes it; no
  second direct-save path is built.

### Who may press what (locked at the third-pass default)
- **D-14 (Q3, the agent inside the UI):** the local Claude Code adapter is proven FIRST: it receives selected context
  from the shell and returns governed proposals through the action layer. agent-native's own model loop needs a
  second model key and its own cost model (SEED-067) and enters only by a separate navigator ruling.
- **D-15 (deliverable 10, exposure policy):** every public action declares an authorization and exposure policy:
  agent-callable, human-only, or both. The generated 1:1 MCP adapter layer is exposed to neither humans nor agents.
  `gate_answer` and every truth-claim confirmation accept only a human-originated call; a caller-supplied `principal`
  field is never proof of a human; human origin is established by a session bound to a browser interaction.
  Acceptance test: the agent proposes a claim and tries to approve it through the same action and is refused.
- **D-16 (Q5, ordering with Phase 289):** Phase 289 lands first for the gate-button plans: the ledger consumes a gate
  only after every check passes (today `consumeGate` deletes before the TTL and session checks and `gate_answer`
  validates chosen option, resume owner and bound room afterwards), the recommended option id rides in the gate
  contract, "normal card on CLI" (the CLI already renders at rung (b) on a 2026-era connection; the ruling goes into
  code, observed behaviour does not change), elicitation `default` where elicitation survives; both protocol eras
  tested. Deliverable (11) of this phase owns when consumption becomes durable, including refused answers and
  persistence failures; the unbound-write refusal already in the tree is pending validation, not implementation.

### Wave 0 and realtime (pre-answered by evidence, confirmed)
- **D-17 (Q8, TypeScript):** wave 0 is the constitution edit through GSD: CLAUDE.md Conventions ("CJS only, no
  TypeScript") and `.planning/spikes/CONVENTIONS.md` rewritten; the Node floor rises from `>=22.16.0` to `>=22.18.0`
  (first line where type stripping runs unflagged, Node 22.18.0 release notes); core `.ts` is erasable-only (no enum,
  no namespaces, no parameter properties, no TS path aliases, explicit extensions, `import type`, no TSX,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`); hooks AND the MCP server stay `.cjs` initially; erasable `.ts` enters
  `lib/core` only after the installed-layout test passes (Node refuses stripping under `node_modules`, ignores
  tsconfig, does not type-check); the UI is built at release time; a hook cold-start number exists before any hook
  moves (spike 003 budgets, 2000 ms); a clean-machine install passes; `scripts/release.sh` and RULE 5 are updated if
  any build artifact ships.
- **D-18 (Q10, realtime v1):** the durable feed comes before any RxDB code: `room_change_log` (`change_seq` INTEGER
  PRIMARY KEY, entity_type, entity_id, operation upsert or delete, entity_revision, transaction_id, changed_at) written
  in the SAME transaction as every canonical mutation, coverage proven against a writer INVENTORY (nodes, edges,
  deletes, bulk paths, transaction ownership; `navigation.cjs` is an API boundary that re-exports writers, and
  `node-insert.cjs` names two exclusions), never against a list of chokepoint functions. The feed is served through a
  `room_changes` MCP read surface (room id, db epoch, ordered cursor, retention floor, snapshot reset; deletes as rows;
  `checkpoint_expired` plus a snapshot revision on compaction). Realtime = cursor polling plus ONE new additive SSE
  kind `room.changed {roomId, latestSeq}` as a hint (the bus vocabulary is frozen additive-only; existing kinds stay);
  the wake-up observes writes from other processes (CLI hooks and scripts write room.db outside the MCP server), so
  room.db/WAL watching or the cursor poll, never the in-process bus alone. No multi-user in v1. Neither removing the
  MCP-first flag nor wiring every publisher is a prerequisite.
- **D-19 (sessionful acceptance):** the re-run of spike 007's agent-native connect against the shipped Phase 267
  server is an acceptance test of SESSIONFUL behaviour (bind, mint, answer, reconnect, cross-client isolation),
  because the flag-ON router sends modern 2026-era requests past the legacy session map that `session-binding.cjs`
  keys room binding on; connect-and-list-tools proves nothing. Either modern request identity is proven or the shell
  uses the legacy sessionful path explicitly. No discovery shim is built.

### Claude's Discretion
- Plan order inside wave 0 and the exact split between the constitution edit, the floor bump and the cold-start
  measurement.
- The `room_changes` paging shape (page size, cursor encoding, retention floor value) within the contract above.
- The module system of the new UI package (agent-native and RxDB are ESM-first; `lib/core` stays CJS), to be stated
  explicitly in the plan rather than left implicit.
- The bake-off's measurement harness (how reconnect, startup errors and packaging are scored) within the judged list.
- The wording of the Desktop/Cowork "runs on your machine" line and of the SKILL.md exception.

### Folded Todos
- **Registry-drift gate keyed to F-shape** (`.planning/todos/pending/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md`):
  the drift check (`scripts/check-registry-drift.cjs`; Phase 355 D-26 noted it compares only the `command` key in
  `data/command-registry.json`, so an MCP-side rename passes) does not cover the gate contract fields the web button
  renders. Fit: when Phase 289 and this phase add the recommended option id to the gate contract, the shared superset
  test (CLI card and web button) is the place to add the contract fields and MCP tool names to the drift snapshot, or
  to file the gap explicitly. Planning note, not a new capability.
- **Mirror the gate_render description fix into Theo** (`.planning/todos/pending/2026-09-07-theo-gate-render-description-mirror-fix.md`):
  Theo ships its own `gate_render` (`~/Theo/src/mcp/operational/gate-render.ts`) and its description still carries the
  pre-276-11 text. Fit: any gate-contract change this phase or Phase 289 makes (recommended id, durability rule) owes
  the same mirror; the planner writes a handoff line to `~/Theo/.planning/` rather than editing Theo from here
  (cross-repo). Planning note.
- **F7 rescope: Phases 212/213 against registerCapability** (`.planning/todos/pending/2026-07-08-f7-rescope-212-213-against-registercapability.md`):
  the capability-registration kernel (propose-critique-integrate interface, ratified F7 2026-07-08) is the interface
  hand-built offer wiring was supposed to register against. Fit: the Claude adapter proof (D-14) registers through
  that interface rather than minting another hand-built triad; the planner checks the state of Phases 212/213 before
  designing the adapter. Planning note.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase's own input (read first, in this order)
- `.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-INPUT.md` - the consolidated
  planning input: rulings, stack, spike measurements, the ten measured contradictions, prior art, settled seeds, the
  16 conflicts, the 14 questions, Design Canon v3, the SEED-107 wave 0, the MCP-side fixes table (section 9, files
  named), the one-description pattern, canon, source index; section 13 holds three Codex passes folded (tables 1-4)
- `.planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-SECOND-OPINION-2026-10-02.md` -
  the three Codex reviews verbatim (reasons behind the defaults)
- `.planning/ROADMAP.md` "### Phase 369" card - goal, pre-step, deliverables (1)-(14), depends-on; and the "### Phase
  289" card - the four gate defects (a)-(d) this phase depends on
- `.planning/research/2026-10-02-UI-UX-PRIOR-ART-INVENTORY.md` - five eras of UI work, 11 threads, 16 conflicts, 14
  questions (lines 401 and 403: graph gating and the statusline co-design mapping)

### Spikes (measured facts, VALIDATED 2026-10-01/02)
- `.planning/spikes/MANIFEST.md` lines 15, 51-53 - the SEED-105 navigator rule and the three spike rows
- `.planning/spikes/005-mcp-http-reach/README.md` - per-connection session mode, `session_mismatch`, `room_state` p50
- `.planning/spikes/006-room-pull-checkpoint/README.md` - the checkpoint and replication measurements, contradictions 1-5
- `.planning/spikes/007-agent-native-wraps-mcp/README.md` and `stages/02_actions/burn-probe.cjs` - the click test,
  licence findings, the ledger burn, the scaffold hazards (transport findings SUPERSEDED by Phase 267)
- `.planning/sketches/MANIFEST.md` - sketch 001, three shell variants, no winner

### Reviews and design direction
- `docs/reviews/2026-09-20-localhost-workspace-review.md` - task-centered workspace review (direction approved,
  implementation not; line 164 honest unsupported execution)
- `.planning/quick/260920-bhx-localhost-review/` - the review's quick folder
- `/home/jsagi/dev/mindrian-website/docs/DESIGN-CANON.md` and
  `/home/jsagi/dev/mindrian-website/docs/superpowers/specs/2026-10-01-design-canon-v3-workshop-modernism.md` -
  Design Canon v3, the ONLY styling source for the shell (external repo, read-only)
- `skills/ui-system/SKILL.md` lines 18-26 - the shipped v1.1 ruling the scoped exception amends; line 22 no external
  hosts; line 26 never a CDN
- `skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md` - the v1.1 palette that stays on every other surface
- `docs/STATUSLINE-CONTRACT.md` - four tiers, Anti-Dealer invariant (line 92); starting point for D-04

### MCP server, gate machinery and the write path (files the fixes land in)
- `bin/mindrian-mcp-server.cjs` lines 416-423, 436-443, 497-507 - flag-ON era routing, flag-OFF stateless handler
- `lib/core/session-binding.cjs` - room binding keyed by the transport-minted session id
- `lib/mcp/gate-ledger.cjs` lines 97-105 - `consumeGate` deletes before every check
- `lib/mcp/tools/gate.cjs` lines 9-14, 321-333, 450-515 - the old CLI ruling, `detectClientCapabilities`, `gate_answer`
- `lib/mcp/gate-render.cjs` and `lib/mcp/shape-f1-renderer.cjs` - the Shape F renderers the web button must share
- `lib/mcp/sse-event-bus.cjs` lines 7-15 - the frozen additive-only vocabulary `room.changed` joins
- `lib/core/navigation.cjs` lines 24-35, 125-132; `lib/core/navigation/transitions.cjs` 256-300;
  `lib/core/navigation/edges.cjs`; `lib/core/node-insert.cjs` lines 3-8; `lib/core/rs-sqlite-mirror.cjs` - the writer
  inventory starts here
- `lib/core/navigation/CONTEXT.md` - the local graph's two write chokepoints and provenance contract
- `lib/mcp/app-views.cjs` lines 295, 321, 351; `lib/mcp/surface-detect.cjs` lines 22-26; `lib/mcp/app-html/*.html` -
  the three MCP Apps and the orphan `mindrian-platform.html`
- `.planning/phases/267-*/267-TRIPOLAR-PROBES.md` lines 69-87 - the CLI at rung (b) on a 2026-era connection
- `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` - the retired "Tier 1 is the product" plan (sections 1.3, 1.6 host limits)
- `lib/wiki/editor-src/` - the Phase 232 BlockNote wiki editor and its save contract (must not be forked)

### Constitution and rules
- `CLAUDE.md` Conventions ("CJS only, no TypeScript") and `.planning/spikes/CONVENTIONS.md` - wave 0 rewrite targets
- `docs/MINDRIAN-CANON.md` Parts 3 (Shape F universal chooser), 7 (reuse before build), 8 (graph boundary), 9 (local
  mind, only a human confirms), 11 (CIRS), 12 (pedagogy)
- `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 (lockstep) and RULE 8 (shrinkwrap install) - what a shipped build
  artifact must satisfy
- Seeds: `.planning/seeds/SEED-105-*.md` (the idea), `SEED-107-*.md` (CJS-only lifted), `SEED-073` (disposable
  projections), `SEED-066` (licences), `SEED-067` (no passthrough), `SEED-091` (workroom), `SEED-104` (gate defects),
  `SEED-106` (one description, many surfaces), `SEED-036`, `SEED-072`, `SEED-006`, `SEED-020`, `SEED-026`

### Folded todos
- `.planning/todos/pending/2026-07-03-registry-drift-gate-prevent-silent-command-disappearance-key.md`
- `.planning/todos/pending/2026-09-07-theo-gate-render-description-mirror-fix.md`
- `.planning/todos/pending/2026-07-08-f7-rescope-212-213-against-registercapability.md`

### External codebases
- `/home/jsagi/dev/mindrian-workroom/` - the provisional chassis (Next 16.2.10, React 19.2.4, BlockNote 0.51.4)
- the agent-native scaffold from spike 007 (`.planning/spikes/007-agent-native-wraps-mcp/`, `setup.sh` reproduces it)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Shape F renderers (`lib/mcp/gate-render.cjs`, `lib/mcp/shape-f1-renderer.cjs`, the Phase 143.1 reach-list renderer):
  the web button is a fourth render of the same gate contract, never a new widget
- The MCP server (`bin/mindrian-mcp-server.cjs`, Phase 267, SDK v2, flag-ON per-connection sessions): the shell's
  only door; `server/discover` already handled, no shim
- The three MCP App views and their HTML (`lib/mcp/app-views.cjs`, `lib/mcp/app-html/`): stay as the Desktop/Cowork
  face; component sharing later
- The Phase 232 BlockNote wiki editor (`lib/wiki/editor-src/`): the display component and the save contract the shell
  must not fork
- The serve-dashboard-live script (fs.watch plus SSE) and `lib/mcp/sse-event-bus.cjs`: prior art for the wake-up
- `lib/core/navigation.cjs` and its writers: the only truth; the change log joins their transactions
- `docs/STATUSLINE-CONTRACT.md`: the four-tier vocabulary the session indicator extends
- `~/dev/mindrian-workroom`: working room grid over real rooms, BlockNote wired, no auth, direct file reads to replace

### Established Patterns
- Single SQL chokepoint, typed edges only through navigation; `node-insert.cjs` as the single node-write helper with
  two named exclusions (memory-events dedupe, rs-sqlite-mirror bulk path)
- Frozen additive-only SSE vocabulary (`status-segment`, `gate-fired`, `reconcile-raised`)
- In-memory gate ledger, single-use gates, session-keyed room binding; gates belong to the session that minted them
- CJS core shipped as inspectable source; install from an npm tarball through the loader with `npm-shrinkwrap.json`
  (RULE 8), so the INSTALLED layout, not the checkout, is what must run
- "No external hosts" and "never a CDN" (SKILL.md 22, 26) against shipped HTML that still loads CDNs (C10 debt)
- Reuse before build (Canon Part 7); Tri-Polar (every feature weighed on CLI, Desktop, Cowork); Hooked first step

### Integration Points
- `bin/mindrian-mcp-server.cjs` flag-ON HTTP: where the shell connects; the sessionful acceptance test lives here
- A new `room_changes` MCP tool or resource; a new `room.changed` SSE kind; `room_change_log` table in room.db
- `skills/ui-system/SKILL.md`: the scoped v3 exception
- `CLAUDE.md` Conventions, `.planning/spikes/CONVENTIONS.md`, `package.json` engines, `scripts/release.sh` RULE 5:
  wave 0 touch points
- `lib/mcp/app-html/mindrian-platform.html`: the dated parked header
- Phase 289's ledger and contract fixes: the gate-button plans consume them

</code_context>

<specifics>
## Specific Ideas

- Navigator, 2026-10-02, verbatim: "the ui worth sacrificing the CJS-only hard rule !"; on the scope card "Whole plugin
  may go TypeScript" over "a UI package only" and "a separate UI repo".
- Codex's framing sentence, kept as the UI-side statement of Canon Part 9: "Claude can operate MindrianOS. Claude does
  not become MindrianOS."
- The first screen answers "what am I trying to resolve, what do I know, what needs my attention next", with "what
  changed since you were here" as the variable reward.
- Canon v3 specifics the shell must honour: paper and ink; rust / cobalt / ochre only as meaning; Fraunces, DM Sans,
  Bodoni Moda; radius 0; one decision per view; the five Larry squares as the state language; the CTA contract (ink
  bar, ochre triangle, consequence line); the measured contrast law (ochre never text on paper, 2.2:1).
- A gate belongs to the session that minted it; person B approving person A's gate is an explicit hand-off action,
  never a shared button (spike 005 `session_mismatch`).
- Counter-metrics per Phase 343 on gate latency, catch-up time and lost writes; counts only (SEED-074).

</specifics>

<deferred>
## Deferred Ideas

- Plugin-wide reconciliation of M:OS v1.1 and Canon v3 (wiki, decks, exports, snapshots, MCP App HTML, mail): its own
  phase, after the shell proves v3 in production.
- Rebuilding the three MCP Apps on the shell's components (needs a build inside the host frame's size limits; Desktop
  and Cowork smoke MCPV2-13 still owed): after the shell ships.
- Dark-theme and CDN debt in the shipped MCP App HTML (conflicts C10, C11): file as a seed during this phase.
- Hosted deployment with a tenant database (SEED-091) and its own model key and cost model (SEED-067): a separate
  identity and tenancy phase.
- Cowork multi-user editing over WebSockets (the 005 hand-off action as the multi-writer case): v2.
- The executable workspace loop (task execution, cancellation, document editing, return to work): v2.
- Governed BlockNote editing (direct save replaced by a gated action with expected revision and idempotency key):
  v2 unless explicitly pulled into v1 by the navigator.
- A first-class graph view (sketch 001 variant B, xyflow): gated by SEED-026 typed edges.
- `data/command-registry.json` as the single description the action layer, MCP definitions, website list and Theo's
  command layer generate from (SEED-106 item 7, the Forge pattern): weighed at plan, built only if the action
  definitions need it.
- The navigator's own spike 007 click test (the spike is VALIDATED headless, "awaiting navigator click").

### Reviewed Todos (not folded)
- Never git stash mid-merge-conflict-resolution (tooling hygiene; unrelated to this phase)
- Ingest the skill-description trigger-design insight into Brain (Brain ingestion; unrelated)
- Deck generation ignores an explicit slide count on the first pass (deck generation; unrelated)
- Audit autonomous_safe posture against the reversibility x consequence grid (harness audit; relevant to chain
  execution, not to this shell's human-only gate rule)
- run-all-223 DESENSITIZE asymmetry, SENS-05 sensor mirror empty (harness test; unrelated)
- Dev-time Jev ledger for the Dominant Design reach (sensors; unrelated)

</deferred>

---

*Phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server*
*Context gathered: 2026-10-02*
