# Phase 369: UI shell, an agent-native app over the MindrianOS MCP server - Research

**Researched:** 2026-10-02
**Domain:** Node 22 type stripping and plugin packaging; SQLite change capture; MCP SDK v2 sessionful HTTP; RxDB pull-only projection; Next 16 / agent-native chassis comparison; human-only gate answers; Design Canon v3 inputs
**Confidence:** HIGH on repo facts and measured runtime behavior; MEDIUM on chassis packaging (the bake-off is the measurement); LOW on the Claude adapter's commercial terms (flagged)

This file fills what `369-INPUT.md` and `369-CONTEXT.md` do not hold. It does not re-derive them. Every repo fact carries a file and line; every runtime number was measured in this session (method stated) or is cited from a spike README. Hyphens only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `369-CONTEXT.md` `<decisions>`.)

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

(Copied verbatim from `369-CONTEXT.md`.)

- Plan order inside wave 0 and the exact split between the constitution edit, the floor bump and the cold-start
  measurement.
- The `room_changes` paging shape (page size, cursor encoding, retention floor value) within the contract above.
- The module system of the new UI package (agent-native and RxDB are ESM-first; `lib/core` stays CJS), to be stated
  explicitly in the plan rather than left implicit.
- The bake-off's measurement harness (how reconnect, startup errors and packaging are scored) within the judged list.
- The wording of the Desktop/Cowork "runs on your machine" line and of the SKILL.md exception.

### Folded Todos (verbatim)

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

### Deferred Ideas (OUT OF SCOPE)

(Copied verbatim from `369-CONTEXT.md` `<deferred>`.)

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
</user_constraints>

<phase_requirements>
## Phase Requirements (proposed families; the planner mints the IDs)

The phase's IDs are "TBD (minted at plan time)". The house pattern is a phase-suffixed family per concern (GATE357,
DDR361, V365, EPV366, MCPV2). Proposed families, mapped to card deliverables (1)-(14) and to the locked decisions:

| Family (proposed) | Deliverable / decision | What the IDs cover | Research support (section below) |
|---|---|---|---|
| `TS369-01..` | (1), D-17 | constitution edit (CLAUDE.md + its GSD source `.planning/codebase/CONVENTIONS.md`, `.planning/spikes/CONVENTIONS.md`), floor `>=22.18.0` across package.json / npm-shrinkwrap.json / CLAUDE.md stack block / `.planning/research/STACK.md` / `tests/test-236-engines-floor.cjs`, erasable-only enforcement gate, installed-layout test, hook cold-start baseline, clean-machine install, release.sh / RULE 5 / payload ceiling for the UI artifact, module-system statement | Pattern 1, Pitfalls 1-4 |
| `CHG369-01..` | (2) change log, D-18 | `room_change_log` DDL + epoch + floor, trigger capture in the same transaction, transaction helper, writer inventory coverage test, compaction, migration re-install | Pattern 2, Writer Inventory |
| `FEED369-01..` | (2), (12), D-18 | `room_changes` MCP read tool (delta, snapshot, `checkpoint_expired`), `room.changed` additive SSE kind, cross-process watcher in the daemon, vocabulary pin test, baseline refreshes (tool count, connectors, schema budget) | Patterns 3-4 |
| `SESS369-01..` | (2), D-19 | sessionful acceptance against the shipped 267 server: bind, mint, answer, reconnect, cross-client isolation, modern-era arm, inherited `CLAUDE_CODE_SESSION_ID` hazard | Pattern 5 |
| `GREC369-01..` | (11), D-16 | durable consumption rule, idempotent replay, expected revision, room recorded at mint, explicit expired / stale / room_switched states | Pattern 10 |
| `HUM369-01..` | (10), D-15 | per-action exposure policy, human-only approve over a browser-bound session, agent self-approval refused | Pattern 9 |
| `BAKE369-01..` | D-05..D-07 | same slice twice, production-built, the nine judged measures, the Decision Gate record | Pattern 6 |
| `SHELL369-01..` | (3), D-06, D-08, D-13, D-14 | task-shaped actions, generated 1:1 adapter (internal), no second store, telemetry off, loopback, scaffold hygiene, MIT notice, Claude adapter proof, local auth, safe rendering, the one recoverable journey | Patterns 6, 9, 11 |
| `RXP369-01..` | (4) | RxDB on Dexie, pull only, RESYNC, projection schema, disposability, the six hazards | Pattern 7 |
| `CANON369-01..` | (5), (14), D-01, D-11 | SKILL.md scoped exception, bundled fonts, tokens, contrast law, tiles paired with written status, CTA contract, offline assets | Pattern 12 |
| `HOOK369-01..` | (6), D-09, D-10 | first screen (current question, changes since last visit, next decision), IA | Pattern 12 |
| `TRI369-01..` | (7), (8), D-02, D-03 | Desktop/Cowork line, parked `mindrian-platform.html` header, C10/C11 seed, hand-off action stays deferred | Summary |
| `IND369-01..` | D-04 | the co-designed session indicator (design gate, signed note, one component) | Pattern 12 |
| `CM369-01..` | (9) counter-metrics | gate latency, catch-up time, lost writes; counts only (Phase 343 rule, SEED-074) | Validation Architecture |

Existing requirement families this phase touches (do not re-mint, cite): MCPV2-02 (tool count 45 pinned through
`tests/fixtures/267/wire-snapshot-zod4.json`), MCPV2-06 (flag-ON era routing, `tests/test-267-mcpv2-flag-on.cjs`),
MCPV2-08 (connector baseline, already RED at 31 vs 32), MCPV2-12 (payload ceiling 1982 entries, 32,873,598 bytes),
MCPV2-13 (Desktop smoke owed), MCPV2-15 / SEED-108 (RCA 7, preseeded session id), MCPV2-17 (Host/Origin guards).
`.planning/REQUIREMENTS.md` lines 4346-4446.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives the planner must verify each plan against (`CLAUDE.md`, read 2026-10-02):

- **GSD owns all dev work.** No direct repo edits outside a GSD workflow; the wave 0 constitution edit itself goes through GSD.
- **Workspace guard.** Work only in `/home/jsagi/dev/MindrianOS-Plugin/`; read the version with `node lib/core/repo-version.cjs`, never a tree search.
- **Canon Part 8.** Room data never egresses to the Brain; the shell contacts no outside host (no Google Fonts, no rxdb.info, no agent-native analytics).
- **Canon Part 3.** Material choices render through Shape F; the web button is a Shape F render, never a new widget.
- **Canon Part 7.** Reuse before build: justify every net-new surface (a new command, a new MCP tool) against commands/agents/pipelines/skills on disk.
- **Canon Part 9.** room.db is the local mind; only a human confirms a truth-claim node.
- **Canon Part 11 (CIRS).** Every invocable surface is born WIRED or EXCLUDED with a declared HITL shape (`connectors` export on a tool module; `hitl_shape` frontmatter on a command), checked by `scripts/build-connector-registry.cjs --check` and `scripts/check-shape-declaration.cjs`.
- **Canon Part 12.** Larry's five squares are the state language; withhold grades and praise.
- **Tri-Polar.** Weigh every feature on CLI, Desktop, Cowork; a skip is a stated call (D-03 is that call).
- **Conventions today (wave 0 rewrites the first):** "CJS only, no TypeScript" (`CLAUDE.md:134`, generated from `.planning/codebase/CONVENTIONS.md:5`); switch-case argv routers, no Commander/yargs; bash scripts authoritative.
- **No em-dashes anywhere.** Hyphens only, in code, docs and commit messages.
- **Verification.** Phase tests run as `bash tests/run-all-<phase>.sh`; release gates `scripts/verify-release`, `scripts/release.sh`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`.
- **Grounding sources.** Library facts from Context7 / official docs; icm-architect for room and local-graph structure; claude-code-guide for hooks and MCP.
- **Dev-research compositing.** Architecture-touching findings are filed in the phase AND in the rethinking room (the executor's job at close, not this file's).
- **Tracked planning files.** `.planning/` is gitignored but phase dirs are force-tracked: new phase files need `git add -f`.

## Summary

Phase 369 is buildable on the current tree with three corrections to what the planning inputs assume, all found by
reading code this session. First, the gate ledger, the session binding and the change feed all hinge on the legacy
sessionful MCP path: the flag-ON daemon serves 2025-era requests through a session-keyed transport map and 2026-era
requests through a stateless per-request handler (`bin/mindrian-mcp-server.cjs:438, 451-487, 503-507`), and in the
stateless leg `extra.sessionId` is absent, so `room_bind` returns `no_session_id` unless the daemon happens to carry
an inherited `CLAUDE_CODE_SESSION_ID` (`lib/core/session-binding.cjs` `resolveEffectiveSessionId`;
`lib/mcp/daemon-lifecycle.cjs:297` copies the spawner's whole environment). The shell's MCP client must therefore be
an `@modelcontextprotocol/client` `Client` with `versionNegotiation` left at its default `'legacy'` mode (the SDK's
own documented default), and the acceptance test must prove that path and pin what the modern path does.

Second, the change log is best captured by SQLite triggers on `nodes` and `edges`, not by editing writers one by one.
The writer inventory below lists 60 mutation statements across 22 files (56 in 21 CJS files, 4 in one Python
script), including three raw node inserts that are not the
two exclusions `node-insert.cjs` names (`spine-events.cjs:293`, `room-birth.cjs:206,226`), SessionStart hook scripts,
and a Python writer (`scripts/rs-engine.py:460-539`). A trigger runs inside the triggering statement's transaction, so
"same transaction as every canonical mutation" holds by construction for every process and language, and a rollback
removes the log row (measured below). The inventory then becomes the test matrix that proves coverage, which is what
D-18 asks for. Triggers are dropped when a table is rebuilt, so they must be re-created after migrations on every
write-door open.

Third, the packaging constraints are tighter than "build the UI at release". The Claude Code loader runs
`npm ci --ignore-scripts` with no `--omit` flag and the shrinkwrap must hold zero dev entries
(`tests/test-341-shrinkwrap-no-dev.cjs`), so TypeScript, React, Next, Vite, RxDB and BlockNote can never enter the root
`package.json`, not even as devDependencies. The Phase 232 wiki editor already solved this: a walled-off
`lib/wiki/editor-src/` package with its own lockfile, excluded from `files`, building into a committed
`lib/wiki/editor-dist/`. The shell and the type-check tooling follow that precedent. Measured this session: the first
`.ts` file a process loads costs about 44 ms of cold start (p50 66.5 ms vs 22.0 ms for an equivalent `.cjs`, n=30,
Node 22.23.1), a one-time stripper initialization, which is why hooks stay `.cjs` and why no hook's require graph may
reach a `.ts` file until measured.

**Primary recommendation:** order the work as wave 0 (constitution + floor + gates), then the MCP-side feed (triggers,
`room_changes`, `room.changed`, sessionful acceptance), then the bake-off on a shared feed/replica/adapter core, then
the shell on the winner after Phase 289 lands; every UI and tooling dependency lives in walled-off packages, never in
the root manifest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Room truth, change capture | Database (room.db + triggers) | - | Triggers make capture atomic for every writer process (CLI hooks, scripts, Python, MCP daemon) |
| Change feed read (`room_changes`), snapshot | MCP server daemon | lib/core/navigation read helper | D-18: MCP-only access; the daemon may open room.db, the shell may not |
| Cross-process wake-up (`room.changed`) | MCP server daemon (WAL watch + `PRAGMA data_version`) | Shell server (cursor poll net) | Only the daemon may touch room.db files; the shell polls `room_changes` as the safety net |
| Gate mint, ledger, ratify | MCP server daemon | - | Sessions own gates; Phase 289 + deliverable 11 fixes land here |
| Task-shaped actions, exposure policy, browser auth | Shell server (localhost Node) | - | Composition and authorization server-side, never in React or the prompt loop |
| MCP client per browser session (legacy sessionful) | Shell server | - | A gate must be answered on the session that minted it |
| Claude adapter (selected context in, proposal out) | Shell server spawning local Claude Code | MCP server (read tools only) | D-14; the adapter never holds the human session |
| Read copy (projection) | Browser (RxDB on Dexie) | - | Disposable; pull only; no push handler |
| Rendering, Canon v3, focus, contrast | Browser | Static assets (release-built) | Fonts and scripts bundled; no outside hosts |
| Session indicator | Browser | Shell server (connection state) | Co-designed (D-04) |

## Standard Stack

### Core (versions verified on the npm registry 2026-10-02)

| Library | Version (latest / pin) | Purpose | Why standard here |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/client` | 2.2.0 latest; plugin pins ^2.1.0 (2.1.0 installed) | Shell server's MCP client, legacy sessionful mode | Already the in-repo client (`lib/mcp/adapter-client.cjs:24`); default `versionNegotiation` is `'legacy'` [VERIFIED: installed package `dist/index.d.cts` lines 1730-1812] |
| `rxdb` | 17.5.0 (Apache-2.0) | Browser read copy, `replicateRxCollection` pull only | Spike 006 measured it; free Dexie storage; `NON_PREMIUM_COLLECTION_LIMIT = 13` [VERIFIED: rxdb.info/replication.html; installed source `utils-premium.js:12`] |
| `rxjs` | 7.8.2 | `pull.stream$` Subject | RxDB peer [VERIFIED: npm registry] |
| `dexie` | 4.4.6 | IndexedDB under `getRxStorageDexie` | RxDB free storage [VERIFIED: npm registry; spike 006 install] |
| `next` | workroom pin 16.2.10; latest 16.3.8 | Workroom chassis build (if it wins) | D-05; `output: 'standalone'` or static export [CITED: nextjs.org/docs (v16.3.8) output, fonts] |
| `react`, `react-dom` | workroom pin 19.2.4; latest 19.3.0 | UI | Both candidates [VERIFIED: npm registry] |
| `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` | PIN 0.51.4 (latest 0.55.0, MPL-2.0) | Read-only document display | Must match Phase 232 `lib/wiki/editor-src/package.json` (0.51.4) so the shell does not fork the wiki component [VERIFIED: repo file] |
| `@agent-native/core` | 0.198.8 (MIT declared; tarball ships no MIT text) | Donor / candidate chassis | Spike 007; `defineAction` with `agentTool`, `mcpTool`, `authorize` [CITED: agent-native.com/docs/actions-defining] |
| `zod` | plugin ^4.2.0 (4.6.5 latest) | Action schemas | Same zod as the MCP server [VERIFIED: package.json] |
| `typescript` | 7.0.2 latest | Type-check only (`tsc --noEmit`), never a runtime dep | Verified this session to enforce `erasableSyntaxOnly` (TS1294) and `verbatimModuleSyntax` (TS1287/TS1295/TS1484) [VERIFIED: local run] |

### Supporting

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `vite` | 8.3.2 | Agent-native candidate build (spike 007 scaffold used Vite 8.1) | Only if the scaffold wins (D-07) [ASSUMED: version line from spike 007 README] |
| `@fontsource-variable/fraunces`, `@fontsource-variable/dm-sans`, `@fontsource/bodoni-moda`, `@fontsource-variable/jetbrains-mono` | 5.3.0 (OFL-1.1) | Bundled fonts, no outside host | Vite candidate; for Next use `next/font/local` over the same files or `next/font/google` (self-hosted at build) [ASSUMED: package names from training; slopcheck OK] |
| `express` | plugin ^5.1.0 (root dep already) | Optional plugin-side shell server if the chassis ships static assets | Zero new root deps [VERIFIED: package.json] |
| `chokidar` | plugin ^4.0.3 (root dep already) | Optional watcher (tree-watcher precedent) | Prefer `fs.watch` on the `.mindrian/` dir as spike 006 did; chokidar if cross-platform quirks bite [VERIFIED: package.json, `lib/mcp/tree-watcher.cjs`] |
| `playwright` | 1.63.0 (spike-local, chromium cached) | E2E: catch-up, egress, journey | Already used by spikes 006/007 [VERIFIED: `npx --no-install playwright --version` in spike 006] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite triggers for capture | Editing every writer to append a log row | Misses Python and script writers, needs about 60 edits, and cannot be proven atomic for raw autocommit statements; triggers are structural |
| `room_changes` as a tool | an MCP resource template | Tools give zod-validated paging args and `isError`; both are session-bound; a tool adds to the pinned tool count (see Pitfall 9) |
| Legacy sessionful client | Modern 2026 client with an explicit `sessionId` arg | `room_bind` warns `carries_to_later_calls: false` (`tool-router.cjs:2113-2124`); gates and writes would key on a model-supplied id; rejected |
| `typescript` in root devDependencies | walled-off `tools/ts-check/` package | Root devDeps would put `dev: true` rows in the shrinkwrap the loader installs (`test-341-shrinkwrap-no-dev.cjs`) |

**Installation (walled-off packages only, never the root manifest):**
```bash
# type-check tooling (wave 0), own lockfile, excluded from package.json "files"
npm --prefix tools/ts-check install --save-dev typescript@7.0.2 @types/node@22
# UI package (after the bake-off), own lockfile, excluded from "files"; built output committed or built in release.sh
npm --prefix ui/shell install <winner's deps> rxdb@17.5.0 rxjs@7.8.2 @blocknote/core@0.51.4 @blocknote/react@0.51.4 @blocknote/mantine@0.51.4
```

**Version verification:** `npm view <pkg> version` run 2026-10-02 for every package above (results in the tables).

## Package Legitimacy Audit

slopcheck ran (`slopcheck scan --json` over a probe manifest, 2026-10-02). `npm view <pkg> scripts.postinstall scripts.install` returned empty for all.

| Package | Registry | Age / last publish | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| rxdb | npm | modified 2026-08-20 | github.com/pubkey/rxdb | [OK] | Approved |
| rxjs | npm | 2026-08-04 | github.com/reactivex/rxjs | [OK] | Approved |
| dexie | npm | 2026-09-10 | github.com/dexie/Dexie.js | [OK] | Approved |
| @agent-native/core | npm | 2026-10-02 (nightlies daily) | github.com/BuilderIO/agent-native | [OK] | Approved for the bake-off; pin 0.198.8 (the nightly churn is a risk, not a block) |
| next | npm | 2026-10-02 | github.com/vercel/next.js | [OK] | Approved |
| react / react-dom | npm | 2026-09-29 | github.com/react/react | [OK] | Approved |
| @blocknote/core, /react, /mantine | npm | 2026-09-22 | github.com/TypeCellOS/BlockNote | [OK] | Approved at 0.51.4; `@blocknote/xl-*` are `GPL-3.0 OR PROPRIETARY` (registry) and stay OUT (D-06) |
| typescript | npm | 2026-10-02 | github.com/microsoft/TypeScript | [OK] | Approved (tooling package only) |
| vite | npm | 2026-10-01 | github.com/vitejs/vite | [OK] | Approved if the scaffold wins |
| @fontsource-variable/fraunces, /dm-sans, /jetbrains-mono; @fontsource/bodoni-moda | npm | 2026-07-19 | github.com/fontsource/font-files | [OK] | Approved; names are [ASSUMED] (training), planner may keep a `checkpoint:human-verify` |
| @modelcontextprotocol/client | npm | 2026-09-28 | (already vendored, VETTED by MCPV2-10) | [OK] | Approved |
| zod | npm | 2026-09-25 | (already vendored) | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                     Browser (localhost page, release-built assets, no outside hosts)
   +------------------------------------------------------------------------------------+
   | Work | Evidence | Decisions | Deliverables      Rooms selector    session indicator |
   |   React views  <---- RxDB queries <---- RxDB (Dexie)  [disposable projection]       |
   |        |                                  ^  pull handler(checkpoint {epoch, seq})  |
   |   click Confirm (human gesture)           |  stream$ <- 'RESYNC' on hint/reconnect  |
   +--------|----------------------------------|-----------------------------------------+
            | POST /actions/approveDecision    | GET /feed/changes?after=..   SSE /feed/hint
            | (HttpOnly cookie, CSRF, Origin)  |                                ^
            v                                  |                                |
   +------------------------------------------------------------------------------------+
   | Shell server (Node, 127.0.0.1 only)                                                 |
   |  auth: browser session -> MCP client (legacy sessionful, one per browser session)   |
   |  task actions: openRoom, approveDecision(human-only), proposeDecision(agent), ...   |
   |  generated 1:1 MCP adapter (internal, exposed to nobody)                            |
   |  Claude adapter: spawn local Claude Code headless with read-only MCP tools ->       |
   |        structured proposal -> server validates -> gate_render on the HUMAN session  |
   |  feed relay: room_changes pages; subscribes daemon /event; polls cursor as net     |
   +----------|------------------------------------------|-------------------------------+
              | Streamable HTTP /mcp (2025 era, mcp-session-id)   | GET /event (SSE, flag-ON)
              v                                          |
   +------------------------------------------------------------------------------------+
   | MindrianOS MCP daemon (bin/mindrian-mcp-server.cjs, flag-ON, 127.0.0.1)             |
   |  legacy session map -> room_bind (session-binding.cjs) -> gate_render / gate_answer |
   |  gate ledger (in-memory; Phase 289 consume-after-checks; durable outcome rule)      |
   |  room_changes tool -> read-only door -> room_change_log + projection join           |
   |  room watcher: fs.watch(<room>/.mindrian/) + PRAGMA data_version -> publish         |
   |        'room.changed' {roomId, latestSeq} on sse-event-bus                          |
   +----------|-------------------------------------------------------------------------+
              | node:sqlite (write door: openRoomDb; read door: ?mode=ro)
              v
   +------------------------------------------------------------------------------------+
   | <room>/.mindrian/room.db (WAL)  nodes / edges  --AFTER INSERT/UPDATE/DELETE-->     |
   |                                 room_change_log (change_seq, same transaction)     |
   +------------------------------------------------------------------------------------+
              ^                      ^                        ^
       CLI hooks (other process)  scripts/*.cjs, rs-engine.py   MCP tool writers
```

### Recommended Project Structure

```
tools/ts-check/          # walled-off: package.json + lockfile with typescript; tsconfig.core.json; excluded from "files"
ui/shell/                # walled-off UI package (winner of the bake-off): own package.json + lockfile; excluded from "files"
ui/shared/               # feed client, RxDB projection schema, MCP legacy client wrapper, Claude adapter (shared by both bake-off candidates)
ui/bakeoff/              # setup scripts + overlays per candidate (spike 007 pattern); generated apps git-ignored; results.json tracked
lib/ui-shell/dist/       # shipped, release-built assets (Phase 232 editor-dist precedent)
lib/core/navigation/room-change-log.cjs   # DDL + trigger install + epoch/floor + withRoomTx helper (inside the chokepoint dir)
lib/core/navigation/room-projection.cjs   # read-only projection join for room_changes (re-exported by navigation.cjs)
lib/mcp/tools/feed.cjs   # room_changes registration + connectors export (tool-module seam, register-core-tools.cjs)
lib/mcp/room-watcher.cjs # per-room WAL watch + data_version gate -> sse-event-bus 'room.changed'
tests/test-369-*.cjs, tests/run-all-369.sh, tests/helpers/mcp-daemon-369.cjs, tests/fixtures/369/
```

### Pattern 1: Wave 0 mechanics (gap 1)

**What the installed layout is (observed on this machine):** the marketplace source is npm (`RULE 5` place 5). Claude
Code stages the package into `~/.claude/plugins/npm-cache/node_modules/@mindrian_os/cli/` and runs the plugin from
`~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/` (`installed_plugins.json` `installPath` for 2.0.0-beta.53),
which holds `lib/`, `node_modules/` and `npm-shrinkwrap.json` as siblings. The run path is NOT under a `node_modules`
segment, so erasable `.ts` in `lib/core` would strip there; the staging path and a global `npm i -g @mindrian_os/cli`
(`.../lib/node_modules/@mindrian_os/cli/`) ARE under `node_modules`, where Node refuses. [VERIFIED: filesystem; the
layout is observed behavior of Claude Code 2.1.287, not documented, so it is A9 in the Assumptions Log]

**What Node does (measured this session, Node 22.23.1):**
- A `.ts` file required from `.cjs` outside `node_modules` runs; the same tree copied under `node_modules/pkg/` throws
  `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`; a symlink pointing into a `node_modules` tree also throws (Node
  resolves the real path). An `enum` throws a SyntaxError at load. [VERIFIED: scratch experiment]
- Docs: type stripping "enabled by default" and "no longer emits an experimental warning" as of v22.18.0; Node "does
  not read tsconfig.json"; "no type checking is performed"; extensions are mandatory in `require()` and `import`;
  `.tsx` unsupported; `.cts` always CJS, `.mts` always ESM. [CITED: nodejs.org/docs/latest-v22.x/api/typescript.html]
- `require(esm)` is unflagged since v22.12.0 and silent since v22.13.0, but throws `ERR_REQUIRE_ASYNC_MODULE` on
  top-level await. [CITED: nodejs.org/docs/latest-v22.x/api/modules.html]
- Cold start (n=30 spawns, p50 / p95): `.cjs` 22.0 / 24.1 ms; first `.ts` 66.5 / 68.8 ms; first `.mts` 67.4 / 69.9 ms;
  ten `.ts` files 68.8 / 71.8 ms; empty `node -e 0` 21.4 / 23.6 ms. So the stripper costs about 44 ms once per
  process, then about 0.3 ms per extra small file. [VERIFIED: scratch benchmark, WSL2 Linux 6.18]

**Module system for lib/core `.ts` (must be stated in the plan):** the root `package.json` has no `"type"`, so a `.ts`
file is CommonJS. With `module: nodenext` + `verbatimModuleSyntax`, TypeScript 7.0.2 rejects ESM `import`/`export` in a
CJS `.ts` (TS1287, TS1295) and `import = require` is not erasable. Two shapes pass both `tsc` and Node (verified):
(a) CJS-style `.ts`: `const x = require('./x.cjs') as typeof import('./x.cjs')`, `module.exports = {...}`,
`import type { T } from './types.ts'`; (b) ESM `.mts` with `export`, loaded by CJS callers through `require(esm)`
(no top-level await). Recommendation: shape (a) for anything a `.cjs` caller requires, so the CJS graph stays
synchronous and `require()` call sites only change their extension.

**Enforcement tooling:** `tools/ts-check/tsconfig.core.json` with exactly the Node-recommended set
(`noEmit`, `target esnext`, `module nodenext`, `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`,
`verbatimModuleSyntax`) plus `allowImportingTsExtensions` and `strict`; a gate script runs `tsc -p` over
`lib/**/*.ts`, `lib/**/*.mts`, `lib/**/*.cts` (zero files today, so it passes vacuously until code lands) and a
fixture of forbidden syntax that must fail. `tsc` already raises TS1294 for enum, namespace and parameter properties
under `erasableSyntaxOnly` (verified), so no extra lint plugin is needed; add a grep check for `paths` in any
tsconfig and for `.tsx` under `lib/`. Wire it into `scripts/release.sh` beside the existing `--check` gates
(lines 482-532) and into the pre-commit only if the navigator wants it blocking.

**Files that change at the floor bump (all must move together):** `package.json` `engines.node`;
`npm-shrinkwrap.json` root `engines` (regenerated at release Step 6.7); `CLAUDE.md` stack block (GSD-generated from
`.planning/research/STACK.md`, so edit the source too or the next regeneration reverts it); `CLAUDE.md:134`
Conventions (generated from `.planning/codebase/CONVENTIONS.md:5`, same rule); `.planning/spikes/CONVENTIONS.md:8`;
`tests/test-236-engines-floor.cjs` (pins `>=22.16.0` in `EXPECTED_FLOOR` and asserts CLAUDE.md states the same floor,
scenarios 1-4); `CHANGELOG.md` `[Unreleased]` (release-note-level). `tests/test-276-busy-timeout-propagation.cjs`
comments mention 22.16 as the timeout floor and stay true.

**Hook cold-start measurement (before any hook moves):** spawn each hook command from `hooks/hooks.json` N times
with a representative stdin payload and record p50/p95 against its declared `timeout`. Budgets today: PreToolUse
2000 ms, UserPromptSubmit 1500-3000 ms across 8 hooks, Stop 3000 ms (plus one 5 ms entry), SessionStart up to 120000
ms. Because UserPromptSubmit fires 8 hook processes per prompt, a 44 ms stripper init in each would cost about
350 ms per prompt in aggregate; the rule "hooks stay `.cjs`" therefore also needs a STATIC require-graph test: no
module reachable from any hook entry may be `.ts`/`.mts`/`.cts` until the measurement says otherwise.

**Clean-machine install test:** Docker CLI 29.8.0 is present but the daemon is not running, and Node 22.18.0 is not
installed (nvm has 22.22.2 and 22.23.1). Practical recipe on this box: `npm pack` the repo, unpack into a hermetic
`$HOME` laid out as `cache/mindrian-marketplace/mos/<ver>/`, run `npm ci --ignore-scripts` there (the loader's
command per RULE 8), start `bin/mindrian-mcp-server.cjs` and read its `started` line (the probe
`scripts/collect-cold-install-evidence.cjs` already uses), require a `.ts` probe from the installed path, and assert
the refusal when the same file sits under `npm-cache/node_modules/`. A true clean machine (Node exactly 22.18.0) needs
either the Docker daemon or a CI job (the only workflow today is `agentshield-scan.yml`, node '22'); mark that leg
exit 77 (SKIPPED ENV GAP) locally.

**RULE 5 / release.sh if a build artifact ships:** the UI assets are not a lockstep place (they carry no version
string), so RULE 5's numbered list does not grow; what changes is (1) `package.json` `files` gains the dist path and
excludes the UI source and the tooling package (the `!lib/wiki/editor-src` precedent), (2) release.sh gains a UI
freshness gate (build, or `--check` a committed dist against a source hash) next to the existing `--check` gates,
(3) the `release-payload-ceiling` policy (20,000 entries / 256 MiB; today 1,982 entries, 32,873,598 bytes) must still
pass with the dist included, (4) RULE 6: release-infra changes ship as a beta first. Note: `npm pack` includes a
nested `node_modules/` directory when it sits under a listed `files` path (verified with npm 10.9.8), so a Next
`standalone` output with traced `node_modules` WOULD ship; its entry count is a bake-off packaging measure.

### Pattern 2: The change log by trigger capture (gap 2)

**What:** one table, one epoch, one floor, six triggers, one transaction helper, all installed at the write door.

Installed idempotently by the write door (the `openRoomDb` -> `initSchema` path), AFTER migrations run. The DDL is
described as columns here, not as literal SQL, because the Phase 108 schema drift guard scans every staged file for
table and index DDL (Pitfall 15):

| Object | Shape |
|---|---|
| table `room_change_log` | `change_seq INTEGER PRIMARY KEY`; `entity_type TEXT NOT NULL` ('node' or 'edge'); `entity_id TEXT NOT NULL` (node id; edge = `source || char(31) || type || char(31) || target`); `operation TEXT NOT NULL` with a CHECK for 'upsert' or 'delete'; `entity_revision INTEGER` (recommendation: the row's own `change_seq`); `transaction_id TEXT` (set by the tx helper, NULL for raw autocommit writers); `changed_at TEXT NOT NULL` defaulting to `strftime('%Y-%m-%dT%H:%M:%fZ','now')` |
| index on `room_change_log` | `(entity_type, entity_id, change_seq)` for expected-revision lookups |
| table `room_tx_context` | one row (`id INTEGER PRIMARY KEY` with CHECK `id = 1`, `tx TEXT`) |
| six triggers | `rcl_nodes_ai` / `rcl_nodes_au` / `rcl_nodes_ad` and `rcl_edges_ai` / `rcl_edges_au` / `rcl_edges_ad`, each `AFTER INSERT|UPDATE|DELETE ON nodes|edges`, each inserting one `room_change_log` row (`NEW.id` or `OLD.id`; 'upsert' for insert and update, 'delete' for delete) with `transaction_id = (SELECT tx FROM room_tx_context WHERE id = 1)`; created with `IF NOT EXISTS` |

**Measured semantics (node:sqlite, SQLite 3.51.3, this session):** plain INSERT logs one upsert; `INSERT ... ON
CONFLICT DO UPDATE` fires the UPDATE trigger (one upsert); `INSERT OR IGNORE` that ignores logs nothing; `INSERT OR
REPLACE` logs one upsert (the implicit delete fires no DELETE trigger, as the docs say: delete triggers fire on REPLACE
"if and only if recursive triggers are enabled" [CITED: sqlite.org/lang_conflict.html]); an INSERT inside `BEGIN
IMMEDIATE ... ROLLBACK` leaves neither the row nor the log row; a second connection sees the log row and its `PRAGMA
data_version` changes after the first connection commits; 20,000 inserts in one transaction took 80 ms with the
trigger vs 39 ms without. `db.isTransaction` is a boolean on `DatabaseSync`. [VERIFIED: scratch experiment]

**Why triggers satisfy D-18:** a trigger's statements run as part of the statement that fired it, so every writer,
in every process and language, logs in its own transaction. Constraint from the docs: a non-TEMP trigger may only
touch tables in the same database ("For non-TEMP triggers, the table to be modified or queried must exist in the same
database"), which is why the transaction context is a regular table, not a TEMP one; and "Triggers are automatically
dropped when the table that they are associated with is dropped" [CITED: sqlite.org/lang_createtrigger.html], which is
why the install runs after migrations on every write-door open (Pitfall 6).

**The tx helper (the house idiom, `lib/core/frame-provenance.cjs:439-440`):**
`const owns = db.isTransaction !== true; if (owns) db.exec('BEGIN IMMEDIATE')`, then
`UPDATE room_tx_context SET tx = ? WHERE id = 1` (insert-or-replace the single row), run the composition, clear the
row, `COMMIT`. Writers that today run `db.exec('BEGIN')` unconditionally must adopt the same `owns` idiom before any
caller composes them inside an outer transaction, or the nested BEGIN throws: `transitions.cjs:256`
(`promoteNodeStatus`, reached by `confirmNode` from `gate_answer`), `focus.cjs:50`, `file-evidence-readback.cjs:80`,
`room-discard-cascade.cjs:99`, `ambient-run.cjs:573`, `lazygraph-ops.cjs:626, 732`, `breakthrough/schema.cjs:117`.

**Epoch and floor:** mint `change_log_epoch` (random id) in the `identity` table when the log table is first created;
re-mint it whenever the log is reset, the database file is reborn, or a migration rebuilds `nodes`/`edges` (rows copied
during a rebuild carry no log rows). Keep `change_log_floor` (lowest retained seq) beside it. Compaction (planner's
discretion on policy and numbers): coalesce rows older than the retention window to the latest row per entity, drop
delete rows older than the window, raise the floor. Never compact rows newer than the oldest live client checkpoint
the server knows of, if it tracks one; otherwise clients past the floor get `checkpoint_expired`.

**Do not use JSON functions in triggers.** The Python writer (`scripts/rs-engine.py`) runs on whatever SQLite its
interpreter links (3.45.1 here, JSON built in, but older builds lack it); a trigger that calls a missing function fails
the writer's statement. Use `||` and `char(31)` for the composite edge key.

#### WRITER INVENTORY (the coverage matrix; every row needs a test that its mutation yields log rows and a rollback yields none)

Search used: `grep -rnE "(INSERT( OR [A-Z]+)? INTO|UPDATE|DELETE FROM|REPLACE INTO)\s+\"?(nodes|edges)\b"` over
`lib scripts bin hooks` excluding tests and migrations, then each hit resolved to its enclosing function. Note:
`scripts/check-substrate.cjs` `RE_RAW_WRITE` (`/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(nodes|edges|memory_event)\b/i`)
does NOT match `INSERT OR IGNORE INTO`, so the substrate guard misses rows N4 and N5; the inventory test must use the
wider pattern.

| # | Class | File : function (decl line) | Statement lines | Transaction owner |
|---|---|---|---|---|
| N1 | node insert (THE chokepoint) | `lib/core/node-insert.cjs : insertNode` (202) | 250, 263 | caller (autocommit by default) |
| N2 | node insert, named exclusion 1 | `lib/core/navigation/memory-events.cjs : logEvent` (851) | 895 | caller |
| N3 | node insert, named exclusion 2 (bulk) | `lib/core/rs-sqlite-mirror.cjs : writeDiscovery` (361) | 407 | own handle via `room-db.cjs` opener |
| N4 | node insert, UNNAMED bypass | `lib/core/navigation/spine-events.cjs : _emitWithOperatorEdge` (272) | 293 (INSERT OR IGNORE) | autocommit |
| N5 | node insert, UNNAMED bypass | `lib/core/navigation/room-birth.cjs : drainBirthGateAnswers` (154) | 206, 226 (INSERT OR IGNORE) | autocommit |
| U1 | node update (truth state) | `lib/core/navigation/transitions.cjs : promoteNodeStatus` (90) | 264, 268, 271 | OWN `BEGIN` at 256, unconditional |
| U2 | node update | `lib/core/navigation/typed-domain.cjs : writeDomainNode` (98) | 156 | autocommit |
| U3 | node update | `lib/core/navigation/typed-frame.cjs : writeFrameNode` (317) | 392 | autocommit |
| U4 | node update | `lib/core/navigation/abstraction-claim.cjs : persistAbstractionLevel` (70) | 172 | autocommit |
| U5 | node update | `lib/core/navigation/grant-rubric.cjs : writeGrantRubricGraph` (79) | 121 | autocommit |
| U6 | node update | `lib/core/navigation/room-birth.cjs : writeSectionNodes` (277) | 297 | autocommit |
| U7 | node update | `lib/core/breakthrough/verb-dispatch.cjs : dispatchVerb` (168) | 206 | autocommit |
| U8 | node update | `lib/core/breakthrough/scanner.cjs : surfaceBreakthrough` (264) | 422 | autocommit |
| U9 | node update, SessionStart HOOK | `scripts/check-pending-ambiguous.cjs : throttleAndCollect` (121) | 154 | autocommit, other process |
| E1 | edge insert (THE chokepoint) | `lib/core/navigation/edges.cjs : writeEdge` (1048) | 1104, 1115 | caller |
| E2 | edge insert | `lib/core/navigation/ingestion.cjs : storeBrainSuggestions` (24) | 83 (INSERT OR IGNORE) | autocommit |
| E3 | edge upsert | `lib/core/graph-ops.cjs : persistDecisionEdge` (186), `indexOpportunity` (215) | 196; 250, 262 | open-use-close via lazygraph |
| E4 | edge upserts (11 functions) | `lib/core/lazygraph-ops.cjs : _indexArtifactBody` (550), `createAnalogyEdge` (1051), `createIsomorphismEdge` (1078), `createResolutionEdge` (1104), `createExtractedFromEdge` (1173), `createCascadesToEdge` (1194), `enrichContradictionWithTRIZ` (1268), `linkWhitespaceToArtifact` (1373), `linkWhitespaceToSection` (1390), `linkDiscoveryCycleSource` (1408), `upsertEdge` (1438) | 577, 1061, 1086, 1113, 1175, 1202, 1304, 1376, 1393, 1412, 1461 | `indexArtifact` owns BEGIN at 626; others autocommit |
| E5 | edge bulk script | `scripts/build-ecosystem-graph.cjs : buildEcosystemGraph` (302) | 352, 393, 415, 423, 443, 477 | script, other process |
| E6 | edge bulk script | `scripts/hsi-to-graph.cjs : main` (104) | DELETE 197-198, INSERT 202 | script, other process |
| D1 | HARD DELETE (reindex) | `lib/core/lazygraph-ops.cjs : clearIndexerOwnedRows` (134) via `rebuildGraph` (702) | 139, 150, 158 | `rebuildGraph` owns BEGIN 732 / COMMIT 895 |
| D2 | HARD DELETE (legacy purge) | `lib/core/navigation/typed-entity.cjs : purgeLegacySelfReferentialEntities` (306) | SQL consts 303-304, run 376-385 | OWN BEGIN |
| D3 | HARD DELETE | `lib/core/rs-engine.cjs : writeReverseSalientEdges` (407) | 412 | autocommit |
| D4 | HARD DELETE strings | `lib/core/rs-sqlite-mirror.cjs : buildRollbackSql` (334) | 336-341 (returned SQL, run by the dispatch caller) | caller |
| P1 | PYTHON writer | `scripts/rs-engine.py` (behind the rs backend flag; `commands/find-bottlenecks.md:67`) | nodes 460, 477; edges DELETE 534, INSERT 539 | `sqlite3.connect`, other process |
| R1 | whole-room removal | `lib/core/room-discard-cascade.cjs` (placeholder discard: memory_event in a tx, then `fs.rmSync` of the room) | 99-113 | own BEGIN; then the db file is gone (epoch / room-removed handling, RXP hazard) |
| X1 | external writer (to be REPLACED, D-06) | `~/dev/mindrian-workroom/scripts/graph-sync-worker.cjs` calls plugin `graph-ops.indexArtifact` after a direct file write | - | out of the slice |
| M1 | table rebuild (drops triggers) | `lib/core/migrations/phase-109-nodes-provenance.cjs` (builds a `nodes_new` table at 292, then renames it) | - | own BEGIN 377 |

Not in the v1 log (non-graph tables; state the exclusion in the plan): `memory-ops.cjs` `identity`/`facts`/`fragments`/`assumptions`
(184, 224, 263, 338, 391), `scripts/memory-lifecycle.cjs` fragments (314, 319), `lazygraph-ops.cjs` `stakeholders` (291, 339),
`navigation/focus.cjs` `session_focus` (53), `decisions_index`, `calibration_observations`, `ranker_weights`.
`lib/core/navigation/graph-integrity-counts.cjs:145` is a string in a message, not a write.

### Pattern 3: `room_changes` MCP read surface (gap 3)

**Registration seam:** add `lib/mcp/tools/feed.cjs` exporting `register(server, ctx)` and a `connectors` array;
`lib/mcp/register-core-tools.cjs` discovers every `tools/*.cjs` by sorted readdir and calls `register` (lines 79-107),
so no router edit is needed. Copy the shape of `lib/mcp/tools/status.cjs`: `server.registerTool(name, {title,
description, inputSchema: z.object(...)}, async (args, extra) => {...})`, resolve the room with
`resolveEffectiveSessionId(undefined, extra)` then `resolveMcpSessionRoom({sessionId, ctx})`, return
`{content:[{type:'text', text: JSON.stringify(payload)}], isError?}`. Connector entry: `hitl_shape: 'none'`,
`hitl_why` "pure read", `layer` and `layer_why` per the rubric (status.cjs lines 192-205).

**Read path:** open with `navigation.openRoomDbReadOnlyForCaller` (the `?mode=ro` door, `spine-events.cjs:523`),
never the write door (it migrates on open, `spine-events.cjs:479-512`). If `room_change_log` is absent (a room no
write door has opened since the install), answer `{ok:false, reason:'change_log_absent', snapshot_required:true}`;
the first write through the write door installs it.

**Recommended shape (discretion: page size, cursor encoding, retention numbers):**
- Input: `{ after?: number|null, epoch?: string|null, limit?: 1..500 (default 200, the batch size spike 006 used),
  collection?: 'nodes'|'relations'|..., mode?: 'delta'|'snapshot', snapshot_cursor?: string }`.
- Delta answer: `{ ok, room, epoch, floor, from, through, latest_seq, has_more, changes: [{ seq, entity_type,
  entity_id, op, revision, tx, at, doc? }] }`, deletes as rows with no `doc`; upserts carry the CURRENT projected
  document joined at read time (intermediate states are skipped, which is correct for a projection).
- `after < floor` or `epoch` mismatch: `{ ok:false, reason:'checkpoint_expired' | 'epoch_changed', epoch, floor,
  snapshot_revision: latest_seq }`.
- Snapshot mode: pages ordered by entity key with `as_of_seq` captured at the first page; the client then resumes
  deltas from `as_of_seq`. Changes made while paging are replayed by the delta (idempotent upserts), so no long read
  transaction across MCP calls is needed.

**What adding a tool breaks (refresh in the same plan):** the live tool count 45 pinned through
`tests/fixtures/267/wire-snapshot-zod4.json` (`tests/test-267-mcpv2-registration-api.cjs:406-412`); the connector
baseline in `tests/test-267-mcpv2-cirs-gates.cjs` (already RED at 31 vs 32); `data/mcp-tool-connectors.json` via
`node scripts/build-connector-registry.cjs`; the documented byte history in `tests/test-270-tool-schema-budget.cjs`
(each addition is recorded with before/after bytes, lines 260-325). Keep the server instructions untouched (1984
bytes under the 2,048 cap, `lib/mcp/no-instructions.test.cjs`).

### Pattern 4: The `room.changed` wake-up (gap 4)

**Vocabulary:** append `'room.changed'` to `EVENT_KINDS` (`lib/mcp/sse-event-bus.cjs:15`); `publish()` silently drops
any kind not in the list (lines 76-79). There is NO existing test that pins the frozen vocabulary (searched: only
`tests/test-198-local-only.test.cjs` lists the file, for the Part 8 local-only grep). Wave 0 of the feed should ADD
that pin: the first three kinds unchanged and in order, `room.changed` appended, nothing removed. Keep the file free
of any Brain/network token (the Part 8 floor greps it).

**What spike 006 actually used:** `fs.watch` on the room's `.mindrian/` directory, filtering names that start with
`room.db` (WAL mode makes `room.db-wal` the file that changes), gated by `PRAGMA data_version`, with a 500 ms poll as
the safety net; fs.watch fired first in 632 of 633 scans (spike 006 README, trail 3; `stages/01_pull-server/server.cjs`
176-257). The plugin bus emitted 0 frames because only `status_read` publishes (`lib/mcp/tools/status.cjs:179`).

**Where it lives:** in the MCP daemon (`lib/mcp/room-watcher.cjs`), because only the daemon may open room.db. Start a
watcher lazily per room on the first `room_changes` call for that room, stop it after an idle window; on a trigger,
read `SELECT max(change_seq)` on ONE long-lived read-only connection (data_version is only meaningful on the same
connection: "It is only meaningful to compare the PRAGMA data_version values returned by the same database connection
at two different points in time" [CITED: sqlite.org/pragma.html#pragma_data_version]) and publish
`room.changed {roomId, latestSeq}` when it moved. The `/event` route exists only flag-ON (`bin/mindrian-mcp-server.cjs:517-521`),
which the shell's daemon is anyway. The shell server subscribes to `/event` (Node 22 has no global EventSource
unflagged; read the fetch body stream) and relays to the browser as an RxDB `RESYNC`; it also polls `room_changes`
on an interval as the net for missed hints and daemon restarts (spike 006 P5: EventSource retry 1 s dominated a
1.0-1.4 s convergence).

### Pattern 5: Sessionful acceptance against the Phase 267 server (gap 5)

**How the flag-ON router classifies:** `isLegacyRequest` returns true "only for requests with no per-request `_meta`
envelope claim", including `initialize`, claim-less POSTs and body-less GET/DELETE session operations; a
`server/discover` probe from a negotiating client always carries the claim (installed
`@modelcontextprotocol/server` 2.1.0, `dist/index.cjs` 1196-1265). Legacy goes to `serveLegacySession` (one
`NodeStreamableHTTPServerTransport` per initialize, `sessionIdGenerator: randomUUID`, a fresh `McpServer` per session,
400 on an unknown `mcp-session-id`, lines 451-487); everything else goes to
`createMcpHandler(() => createServer(), { legacy: 'reject' })` (line 438), a per-request server with no session.

**Which client options produce legacy requests:** `new Client({name, version}, {capabilities: {}})` with
`versionNegotiation` absent or `{ mode: 'legacy' }`: "The default is 'legacy': absent (or mode: 'legacy'), connect()
runs the plain 2025 sequence, byte-identical to today's behavior (no probe, no new headers)"; `mode: 'auto'` probes
`server/discover` and, on definitive modern evidence, attaches the `_meta` envelope to every request (installed
`@modelcontextprotocol/client` 2.1.0, `dist/index.d.cts` 1704-1812). Spike 007's agent-native `McpClientManager` probed
`server/discover`, i.e. it negotiates, so through agent-native's own MCP client the shell would land on the stateless
modern leg. The shell must use its own client in legacy mode (what spike 007's bridge did, on the v1 SDK then).

**What the modern leg does today (code reading):** no `extra.sessionId`, so `resolveEffectiveSessionId` falls to
`process.env.CLAUDE_CODE_SESSION_ID`, then the stdio key (never registered on HTTP), then null; `room_bind` then
answers `no_session_id` (`lib/mcp/tool-router.cjs:2086-2089`). BUT `ensureDaemon` spawns the daemon with
`Object.assign({}, process.env, ...)` (`lib/mcp/daemon-lifecycle.cjs:297`) and nothing scrubs
`CLAUDE_CODE_SESSION_ID`, so a daemon woken by a CLI hook inherits that CLI session's id and every modern-era request
would bind, mint and answer under the CLI session's key. Plan either a scrub in `ensureDaemon` (and in the shell's
launcher) or an explicit test that pins the behavior; this is adjacent to RCA 7 / SEED-108 (MCPV2-15).

**The test (extend, do not fork, `tests/test-267-mcpv2-flag-on.cjs` arms 1-3 and `tests/helpers/mcp-wire-267.cjs`
`hermeticEnv`):** spawn the daemon with `MINDRIAN_TRANSPORT=http MINDRIAN_MCP_FIRST=cowork` in a hermetic rooms home
with fixture rooms; then
1. bind: legacy client A `room_bind(room-x)` -> `effective: true`, `carries_to_later_calls: true`, session file under `.rooms/sessions/<sid>.json`;
2. mint: A `gate_render` (subject a fixture claim) -> `renderer: askuserquestion` (daemon surface `cowork` is a Claude host surface in `detectClientCapabilities`), gate id;
3. isolation: legacy client B (unbound, then bound to room-y) answers A's gate -> `session_mismatch`; after Phase 289, A's own answer still ratifies (today it gets `unknown_or_expired_gate`, the `burn-probe.cjs` finding);
4. answer: A `gate_answer(approve)` -> decision node `decision:gate:<id>` present in room-x only;
5. reconnect: kill and restart the daemon (SIGTERM exits since MCPV2-14); A's next call -> 400 `No valid session ID`; A re-initializes, must `room_bind` again (the old binding file is keyed to the dead session id), the old gate id is `unknown_or_expired_gate`, and the persisted decision is recoverable by id (deliverable 11 replay);
6. modern arm: an `auto` client against the same daemon with `CLAUDE_CODE_SESSION_ID` scrubbed -> `room_bind` `no_session_id` (pins "modern identity not proven, legacy path chosen explicitly"); and with it set -> documents the inheritance hazard until fixed.

### Pattern 6: The chassis bake-off harness (gap 6)

**Shared core, so the comparison isolates the chassis:** both candidates import the same `ui/shared/` modules: the
legacy MCP client wrapper (one client per browser session key, idle sweep, reconnect-and-rebind, spike 007
`overlay/server/lib/mos-mcp.ts` shape moved to `@modelcontextprotocol/client` v2), the `room_changes` pull handler and
RxDB projection, and the Claude adapter (Pattern 11).

**Workroom candidate, what must be replaced (D-06), measured inventory of `~/dev/mindrian-workroom` (2,645 lines TS/TSX,
not under any git repository, so snapshot it before transplanting):**
- direct fs reads in server components: `src/app/page.tsx` (`listRooms`), `src/app/room/[room]/page.tsx`
  (`getRoomTree`, `getRoomFamily`, `getRoomState`, `getCohortFolderMembers`), `src/app/room/[room]/cohort/page.tsx`,
  `src/app/room/[room]/cohort/[member]/page.tsx` (all from `src/lib/rooms.ts`, 571 lines);
- API routes: `api/rooms` (list), `api/rooms/[room]/tree`, `article` GET and PUT (PUT writes the file then spawns
  `scripts/graph-sync-worker.cjs` into the plugin's `graph-ops.indexArtifact`), `assets` (upload write), `assets/[...file]`
  and `raw/[...file]` (file reads), `briefing` (Vercel AI SDK `generateText` with `anthropic/claude-sonnet-5` through the
  AI Gateway, a second model path with room content leaving the machine: SEED-067 and Part 8, remove);
- `src/lib/export.ts` imports `@blocknote/xl-pdf-exporter` / `xl-docx-exporter` (GPL-3.0 OR PROPRIETARY on the registry): remove;
- fonts: `src/app/layout.tsx` uses `next/font/google` Inter + JetBrains Mono; v3 needs Fraunces / DM Sans / Bodoni Moda
  (+ JetBrains Mono for mono labels per the canon's typography contract); `next/font` self-hosts at build ("no requests
  are sent to Google by the browser") [CITED: nextjs.org/docs/app/getting-started/fonts, v16.3.8], or `next/font/local`;
- `next.config.ts` has no `output`; packaging options are `output: 'standalone'` (server.js + traced node_modules;
  `public/` and `.next/static/` copied by hand; `PORT`/`HOSTNAME` env) [CITED: nextjs.org/docs/app/api-reference/config/next-config-js/output]
  or a static export served by a plugin-side CJS server (dynamic segments like `room/[room]` then need client routing).

**Agent-native candidate, from spike 007 and the official option list:** `defineAction({ description, schema, run,
http?, agentTool?, mcpTool?, publicAgent?, toolCallable?, authorize?, readOnly?, needsApproval? })` in `actions/*.ts`
(one default export per file, mounted at startup), served as `POST /_agent-native/actions/<name>`;
`agentTool: false` hides it from the agent tool list, `mcpTool: false` (defaults to `agentTool`) hides it from MCP and
A2A, `authorize` is a guard function [CITED: agent-native.com/docs/actions-defining]; UI calls through
`useActionQuery` / `useActionMutation` / `callAction` from `@agent-native/core/client/hooks` (the README's
`@agent-native/core/client` path is refused by 0.198, spike 007). Run actions-and-routes without chat, automations and
Postgres: production refuses PGlite, chat/automations/integrations error at boot, actions and the gate route keep
working (spike 007 trail 7); the database-error toast is itself a "startup errors" data point. Hygiene from
`stages/01_scaffold/setup.sh`: `DO_NOT_TRACK=1 AGENT_NATIVE_TELEMETRY_DISABLED=1`, delete the scaffold's `CLAUDE.md`,
`.claude/`, `.mcp.json`; serve the production build on `127.0.0.1` (dev binds `*:8080` plus a PTY server on
`127.0.0.1:42003`); render `/gate` full-bleed; carry the MIT notice by hand; drop the v1 SDK the spike added.

**Scoring harness (discretion; propose `ui/bakeoff/measure.cjs` writing `results.json`):**

| Measure | How to score it |
|---|---|
| architecture distorted | files changed outside `ui/` to support the candidate (`git diff --stat`), plus a written note per change |
| workroom code surviving | retained lines out of the 2,645 snapshot (diff against the snapshot) |
| selected state reaches Claude | the adapter test asserts the selected node id arrives in the adapter's input and the proposal names it; count hops |
| new persistent-state assumptions | enumerate stores the running app creates (cookies, localStorage, IndexedDB names, files, databases) by inspection + Playwright storage dump |
| reconnect | Playwright: kill the daemon, write 6 changes from another process, restart; time to convergence and missing count (spike 006 P5 method); also drop the shell-to-daemon socket |
| startup errors | cold production start: console errors + server stderr lines, count |
| dependency removal | deps removed (xl-*, ai, PGlite/chat, v1 SDK) and the build still green |
| direct-file-write replacement | grep of the candidate's server code for `fs.`/`execFile`/`child_process` outside the adapter = 0 |
| packaging | production build seconds, bytes, entry count (feed into `scripts/check-release-payload-ceiling.cjs`), runs from the installed layout with no build on the user's machine, time to first paint |

The result goes to the navigator as an AskUserQuestion Decision Gate with this table (D-07).

### Pattern 7: RxDB read copy (gap 7)

- Pull-only: "Omit the push configuration entirely"; `pull.handler(lastCheckpoint, batchSize) -> {documents,
  checkpoint}`; `pull.stream$` emits batches or `'RESYNC'` ("When the client reconnects ... emit the string 'RESYNC' to
  trigger checkpoint-based catching up"); deletes via `_deleted: true` (or `deletedField`); `waitForLeadership`
  defaults true when `multiInstance` is true, so one tab replicates [CITED: rxdb.info/replication.html]. Spike 006's
  working code: `createRxDatabase({ name, storage: getRxStorageDexie(), multiInstance: false })`, two
  `replicateRxCollection` calls with `live: true, retryTime: 1000, pull: { batchSize: 200, handler, stream$ }` and no
  push (`stages/02_browser-replica/src/app.js` 112-158).
- Checkpoint = `{ epoch, seq }` (the server's), never a timestamp (spike 006: `{timestamp, id}` lost 21 to 179 of
  2,000 same-millisecond writes).
- 13-collection limit is GLOBAL to the page (`OPEN_COLLECTIONS` in `rx-collection.js:109-113`, waits then throws).
  Six collections per room means two open rooms = 12; close the previous room's database before opening another, or
  collapse `decisions`/`activity`/`artifacts` into typed queries over `nodes` (3 collections per room). Discretion;
  state the choice.
- Dev-mode off: never import `rxdb/plugins/dev-mode` (it injects `https://rxdb.info/html/dev-mode-iframe.html`,
  `plugins/dev-mode/dev-mode-tracking.js:68`); CI greps the built bundle for that URL (spike 006 method: 0 hits) and a
  Playwright egress test asserts only `127.0.0.1` is contacted.
- Projection schema migration: do not write `migrationStrategies` for a disposable projection; RxDB migrates stored
  docs but "the replication pull-checkpoint will not be migrated" [CITED: rxdb.info/migration-schema.html]. Put the
  projection version and the server epoch in the database name (`mos-<roomKey>-<epoch>-p<N>`) and on a mismatch call
  `removeRxDatabase(name, storage)` (exported, `rx-database.d.ts:229`) and re-pull from a snapshot.
- Free plugins available in the open-source package: `leader-election`, `local-documents`, `cleanup` (tombstone
  purge), `replication`, `storage-dexie` (installed rxdb 17.5.0 `dist/esm/plugins/`). Store the "last visit" seq for
  D-09 in a local document; if the projection is rebuilt and it is gone, show the first-visit screen (never an invented
  history).
- Hazards to test (deliverable 4): stale checkpoint after compaction (`checkpoint_expired` -> rebuild), UI schema bump
  (name change -> remove + rebuild), crash mid-batch (RxDB writes a pull batch then the checkpoint; re-pull is
  idempotent), multiple tabs (leader election), browser data after a removed room (`room_list` no longer has it ->
  `removeRxDatabase`), hard deletes (delete rows -> `_deleted`).

### Pattern 8: The gate button and the shared superset (gap 8)

What `gate_render` returns on the shell's connection today: the daemon's surface is `cowork`, a Claude host surface,
and the shell declares no elicitation, so `detectClientCapabilities` picks rung (b) `askuserquestion`
(`lib/mcp/tools/gate.cjs:321-333`). That rung builds a Shape F.8 envelope (`lib/hmi/shape-f8-renderer.cjs`, note the
path: CONTEXT names `lib/mcp/shape-f1-renderer.cjs`, the real file is `lib/hmi/shape-f1-renderer.cjs`) with `zones`
(`header`, `body`, `signals` when a floor notice exists, `footer`) and `contract` (`shape`, `multiSelect`,
`superset_options[{id, label, description, rank, preview}]`, `notice`) (`lib/mcp/gate-render.cjs:388-425`).
The web button renders from `rendered.contract.superset_options`, never from the zones' text.

What Phase 289 changes and the collision to flag: Phase 289 (d) carries the recommended option id into the contract.
`lib/hmi/shape-f8-renderer.test.cjs:46-47` asserts F.8 has NO single recommended marker (F.8 is a toggle set by design,
D-06 of its phase), and the gate input schema has no `recommended` field (`gateOptionSchema`, `gate.cjs:335-341`, only
`rank`). So the recommended id must be added at the gate-render layer (a `contract.recommended_id` plus
`superset_options[].recommended`), not inside the F.8 renderer, or single-select gates move to the F.5 shape that has a
recommended marker. Shared superset test: extend `tests/test-198-gate-renderers.test.cjs` (the renderer ladder test)
with one fixture card asserted through rung (b) and through the web adapter's mapping, plus the drift snapshot fields
named in the folded registry-drift todo.

### Pattern 9: Human-only `gate_answer` and the exposure policy (gap 9)

What exists today: session ownership (the ledger keys gates by session, `gate-ledger.cjs:46-50, 64-71`); the unbound
write refusal (`resolveMcpWriteRoom`, `gate.cjs:501-517`); and an agent-identity guard on truth-claim promotion that
keys on a caller-supplied string (`AGENT_IDENTITIES = {larry, brain, system, assistant}`, `transitions.cjs:20-26,
250-253`; `confirm-node.cjs` resolves `byUser` from USER.md). That last guard is exactly the "caller-supplied principal"
D-15 says is never proof. Phase 259 is the Brain 429 / floor-void work (TRUST-01/02, `REQUIREMENTS.md:53-61`) and
Phase 357 has "no runtime ledger" (`REQUIREMENTS.md:3043-3050`): neither provides a human-origin mechanism, so it is
built here.

Concrete design (the planner may tighten):
1. Every shell action declares `exposure: 'agent' | 'human' | 'both'` in its definition (on agent-native this is
   `agentTool`/`mcpTool`/`authorize`; on the workroom a small `defineShellAction` wrapper with the same three fields).
   The generated 1:1 adapter is a server-internal module with no route and no tool export.
2. Human origin = a request that carries the browser session cookie (HttpOnly, SameSite=Strict, server-side session
   map), passes Host/Origin validation and CSRF, and carries a single-use render nonce bound to `{gate_id, browser
   session}` that the server issued when it rendered that gate. The Claude adapter never receives the cookie or the
   nonce; its calls enter through the agent route with `principal: agent` set by the server, not by the caller.
3. The gate is minted on the browser session's MCP session (human session), so even a direct MCP `gate_answer` from
   another session is `session_mismatch` (and after Phase 289 does not burn the gate).
4. Acceptance test: the adapter proposes a claim (`proposeDecision`), the server mints the gate on the human session,
   then the adapter calls `approveDecision` with a forged `principal: 'human'` and the gate id -> refused
   (`human_only`); a direct MCP `gate_answer` from the adapter's own MCP session -> `session_mismatch`; the browser
   click -> ratified.

### Pattern 10: Recovery contract (deliverable 11; consumes Phase 289)

- Durable anchor that already exists: an approve writes `decision:gate:<gate_id>` (`REASONING_NODE_ID`,
  `reasoning-write.cjs:82-93`). On a ledger miss, `gate_answer` should look it up and return `{ok:true, replayed:true,
  decision_node_id}` instead of `unknown_or_expired_gate`. Reject/defer write only a memory_event; give it
  `dedupe_key: 'gate_answer:' + gate_id` (logEvent's 60 s dedupe, `memory-events.cjs:864-880`) and look it up by
  `json_extract(properties,'$.gate_id')` for replay.
- Consumption becomes durable only when the ratification COMMITs: wrap the ratification writes (memory_event,
  decision node, SOURCED_FROM/USES_FRAMEWORK edges, `confirmNode`) in the tx helper and delete the ledger entry after
  COMMIT; on a persistence failure the gate stays answerable. Chain resume (`material_step`) runs after the commit,
  outside that transaction.
- Record at mint what the answer must re-check: the bound room (today `_mintLiveGate` stores only card, sessionId,
  kind, `gate.cjs:291-298`, so after a room switch on the same session `resolveMcpWriteRoom` would land the decision in
  the NEW room) and the subject node's latest `change_seq` (expected revision). Answer-time refusals: `room_switched`,
  `stale_subject`, `gate_expired` (TTL), `unknown_gate`, `already_answered` (replay), each a distinct state the UI renders.

### Pattern 11: The Claude adapter proof (D-14)

Local Claude Code 2.1.287 exposes `-p/--print`, `--output-format`, `--json-schema`, `--mcp-config`,
`--strict-mcp-config`, `--allowedTools`, `--plugin-dir`, `--no-session-persistence`, `--permission-mode`
[VERIFIED: local `claude --help`]. Bounded proof: the shell server spawns one headless call with a JSON schema for a
proposal (`{subject_node_id, verdict_options[], recommended_id, evidence_node_ids[], rationale}`), an MCP config that
exposes only read tools (`room_state`, `claim_read`, `graph_query`, `context_assemble`) on the adapter's OWN MCP
session, the selected node id in the prompt (an opaque local id, Part 8 clean), and no write tools in `--allowedTools`.
The server validates the proposal with zod and mints the gate on the human session (Pattern 9). The registerCapability
kernel the folded F7 todo names does not exist in `lib/` (searched) and Phases 212/213 are not live cards in
ROADMAP.md, so the adapter cannot register through it yet: record that as a planning note, not a blocker.
Commercial terms of running the user's own Claude Code headless on their behalf are unverified (review line 87 asks
for exactly that check): A1.

### Pattern 12: Design contract inputs for the gsd-ui-phase step (gap 10)

Sources the UI-SPEC must cite (external repo, read-only): tokens in
`/home/jsagi/dev/mindrian-website/website/src/app/globals.css` lines 6-16 (`--paper #F5F0E6` ... `--error #A12E2E`)
with Tailwind utilities at 24-36; the canon text `docs/DESIGN-CANON.md` sections 3 (colour), 4 (contrast law, the
measured table), 5 (state language: five squares + three control shapes), 7 (typography: Fraunces, DM Sans, Bodoni Moda,
JetBrains Mono for commands and status), 8 (radius 0, ink rules, 12-column grid), 9 (CTA anatomy: ink rectangle, 2 px
border, min height 56 px, 24 px marker column with the ochre triangle, two-line outcome label, consequence line, the
states list), 11 (motion: one easing `cubic-bezier(.22, 1, .36, 1)`, timings, reduced motion collapses to final
state); the website loads fonts with `next/font/google` (`website/src/app/layout.tsx:3, 18-21`). The tile-room spec
is `docs/superpowers/specs/2026-10-02-tile-room-visual-system.md`. Shell-specific rules from the locked decisions:
tiles always paired with a written status (D-11), one current circle and one next triangle per view, ochre never text
on paper (2.2:1), a 1 px ink outline on any ochre shape on paper, focus ring 2 px ochre with 1 px ink edge. The
session indicator starts from the four tiers and INV-SL-1..n of `docs/STATUSLINE-CONTRACT.md` (Anti-Dealer section,
line 92 onward). The SKILL.md exception lands after line 27 of `skills/ui-system/SKILL.md` (section 0's "Applies to"
list), dated, naming the shell and the bundled-fonts / no-outside-hosts rule.

### Anti-Patterns to Avoid
- **Using agent-native's own MCP client for room access:** it negotiates the modern era (spike 007), which lands on the stateless leg with no session binding.
- **Adding UI or TypeScript packages to the root manifest:** dev entries reach every user through the loader's `npm ci`.
- **Publishing `room.changed` from writer code paths:** writers in other processes never reach the daemon's bus; the watcher observes the database.
- **Opening room.db from the shell server:** breaks MCP-only access (D-18) and the substrate guard (M2/M3 in `check-substrate.cjs`).
- **A `{timestamp, id}` checkpoint, or a mirror of room.db tables in RxDB:** measured lost writes; the projection is a UI schema.
- **Minting the gate on the adapter's session:** the human button could never answer it (`session_mismatch`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Same-transaction change capture | per-writer append calls (60 statements, 22 files) | SQLite AFTER triggers | covers every process and language; atomic by construction |
| Cross-process change detection | timers diffing row counts | `fs.watch` on `.mindrian/` + `PRAGMA data_version` on one connection | spike 006 measured it; documented SQLite semantics |
| Browser replication protocol | a custom fetch loop with IndexedDB | `replicateRxCollection` pull-only with `stream$`/`RESYNC` | checkpointing, retries, leader election are solved |
| MCP session handling | raw JSON-RPC over fetch | `@modelcontextprotocol/client` `Client` + `StreamableHTTPClientTransport` (legacy mode) | session id, SSE, reconnect semantics |
| Erasable-TS enforcement | regex linting | `tsc --noEmit` with `erasableSyntaxOnly` + `verbatimModuleSyntax` | verified to flag enum, namespace, parameter properties, CJS/ESM mismatches |
| Fonts | CSS `@import` from Google | `next/font` (self-hosted at build) or `@fontsource-variable/*` bundled | no outside host at runtime |
| Loopback DNS-rebinding guard | hand-written Host checks | the SDK's `localhostHostValidation` / `localhostOriginValidation` pattern (already used by the daemon) or the same check in the shell server | tested in MCPV2-17 |
| Tokens and nonces | Math.random | `crypto.randomUUID` / `randomBytes` | ASVS V6 |

**Key insight:** the hard parts (capture, replication, sessions) each have one solved primitive; the phase's own code
is the composition and the policy (exposure, recovery states), which is where the tests should concentrate.

## Runtime State Inventory

The change log adds persistent state to every room.db, and wave 0 changes the runtime floor, so the five categories apply.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Every room's `<room>/.mindrian/room.db` (three schema variants live: 16-, 12- and 3-column `nodes`, `lib/core/navigation/CONTEXT.md`) gains `room_change_log`, `room_tx_context`, six triggers, `identity` rows `change_log_epoch`/`change_log_floor`. Rooms never opened by the write door after release have no log | code edit (install at the write door, after migrations); no bulk migration; `room_changes` answers `change_log_absent` until first write |
| Live service config | The flag-ON daemon pidfile `<rooms home>/.rooms/daemon/mcp-daemon.json`; session binding files `.rooms/sessions/<sid>.json` (orphaned on daemon restart, keyed to dead session ids) | none for the feed; the shell must re-bind after reconnect (Pattern 5 step 5) |
| OS-registered state | None found (no launchd/systemd/Task Scheduler entries; the daemon is spawned detached by `ensureDaemon`) - verified by reading `daemon-lifecycle.cjs` | none |
| Secrets / env vars | `CLAUDE_CODE_SESSION_ID` inherited by the daemon (`daemon-lifecycle.cjs:297`); `MINDRIAN_MCP_FIRST` must name the daemon's surface for write tools to pass `isWritePathEnabled` (`mcp-first-flag.cjs:131-145`); agent-native telemetry env (`DO_NOT_TRACK`) | code edit (scrub or pin by test); launcher sets the flag explicitly |
| Build artifacts / installed packages | Installed plugin copies under `~/.claude/plugins/cache/mindrian-marketplace/mos/<ver>/` run whatever was released; browser IndexedDB databases created by the shell outlive rooms and releases | `removeRxDatabase` on room removal / projection bump; the floor bump is release-note-level |

## Common Pitfalls

### Pitfall 1: Root manifest pollution
**What goes wrong:** adding `typescript`, `next`, `rxdb` etc. to the root `package.json` (even as devDependencies) puts them in the shrinkwrap the loader installs on every machine.
**Why:** the loader runs `npm ci --ignore-scripts` with no `--omit` (`tests/test-341-shrinkwrap-no-dev.cjs` header); `shrinkwrap-gate.sh` refuses `dev: true` entries.
**How to avoid:** walled-off packages with their own lockfiles, excluded from `files` (Phase 232 `lib/wiki/editor-src` precedent, `package.json` `files` has `!lib/wiki/editor-src`).
**Warning signs:** `test-341-shrinkwrap-no-dev.cjs` red; release Step 6.7 failure; payload ceiling jump.

### Pitfall 2: Generated CLAUDE.md sections revert the constitution edit
**What goes wrong:** editing `CLAUDE.md:134` directly; the next GSD regeneration restores "CJS only".
**Why:** the block is `<!-- GSD:conventions-start source:CONVENTIONS.md -->` from `.planning/codebase/CONVENTIONS.md`; the stack block comes from `.planning/research/STACK.md`.
**How to avoid:** edit both the source files and CLAUDE.md in the same plan; `test-236` asserts CLAUDE.md states the floor.

### Pitfall 3: A hook quietly reaching a `.ts` module
**What goes wrong:** a shared `lib/core` module becomes `.ts` and every hook that requires it pays about 44 ms per process.
**How to avoid:** static require-graph test from every `hooks.json` entry; cold-start baseline recorded before any move.

### Pitfall 4: Wrong Node on PATH
**What goes wrong:** `/usr/bin/node` is v20.19.5 on this machine, below both floors; tests "pass" on the wrong runtime or fail opaquely.
**How to avoid:** every command with the nvm v22.23.1 PATH first (366 handoff anti-pattern, INPUT section 8); `test-236` scenario 2 checks the running version.

### Pitfall 5: Modern-era client silently unbound or bound to the wrong session
**What goes wrong:** a negotiating client lands on the stateless leg: `no_session_id`, or the inherited `CLAUDE_CODE_SESSION_ID` of whichever CLI session woke the daemon.
**How to avoid:** legacy mode in the shell's client; the modern arm in the acceptance test; scrub the env var at spawn.

### Pitfall 6: Triggers vanish after a table rebuild
**What goes wrong:** a migration that rebuilds `nodes` (phase-109 provenance: build `nodes_new`, copy, rename) drops the triggers; capture stops with no error.
**How to avoid:** create triggers with `IF NOT EXISTS` after migrations on every write-door open; re-mint the epoch when a rebuild ran; a test that runs the migration on a legacy fixture and asserts the six triggers exist after open.

### Pitfall 7: Nested BEGIN when composing writers
**What goes wrong:** wrapping `gate_answer`'s writes in a transaction makes `promoteNodeStatus`'s unconditional `BEGIN` (`transitions.cjs:256`) throw "cannot start a transaction within a transaction".
**How to avoid:** convert the eight unconditional-BEGIN sites listed in Pattern 2 to the `owns = db.isTransaction !== true` idiom first.

### Pitfall 8: The substrate guard misses `INSERT OR IGNORE`
**What goes wrong:** the inventory is generated from `check-substrate.cjs`'s regex and misses N4, N5, E2.
**How to avoid:** the inventory test uses the wider pattern in Pattern 2; consider widening `RE_RAW_WRITE` too (it is a CI guard, Canon Part 9).

### Pitfall 9: Adding a tool breaks pinned baselines
**What goes wrong:** `room_changes` turns the live tool count 45 into 46 and the 267 wire snapshot, connector baseline and schema-budget history go red.
**How to avoid:** regenerate `tests/fixtures/267/wire-snapshot-zod4.json`, `data/mcp-tool-connectors.json`, and record bytes in `test-270-tool-schema-budget.cjs` in the same plan; keep the instructions under 2,048.

### Pitfall 10: The write-path gate refuses the shell
**What goes wrong:** `claim_write`, `graph_write`, `artifact_file`-class tools refuse an unknown client name unless `isMcpFirst(surface)` is true (`mcp-first-flag.cjs:131-145`; called at `claim.cjs:91`, `graph.cjs:102`, `views.cjs:115`).
**How to avoid:** the launcher sets `MINDRIAN_MCP_FIRST` to include the daemon surface (`cowork` or `all`), or the shell's client name is added to `HOST_TIER_MAP` (`surface-detect.cjs:174-195`) by a stated decision. `gate_answer` itself is not behind this gate.

### Pitfall 11: Room switch re-targets an open gate
**What goes wrong:** the ledger does not record the room at mint; after `room_bind` to another room on the same session, an approve lands in the new room.
**How to avoid:** record the room at mint and refuse `room_switched` (Pattern 10).

### Pitfall 12: BlockNote version fork
**What goes wrong:** the shell pulls BlockNote 0.55.0 while the wiki editor pins 0.51.4; two renderers drift.
**How to avoid:** pin 0.51.4 in the shell; upgrade both together in a later phase.

### Pitfall 13: Data version read on a fresh connection
**What goes wrong:** opening a new connection per check makes `PRAGMA data_version` meaningless.
**How to avoid:** one long-lived read-only connection per watched room.

### Pitfall 14: 13-collection ceiling on room switch
**What goes wrong:** opening a second and third room without closing the first exceeds the global open-collection limit; RxDB waits then throws.
**How to avoid:** close the previous room's database, or fewer collections per room.

### Pitfall 15: The Phase 108 schema drift guard blocks the commit
**What goes wrong:** the pre-commit hook `scripts/check-schema-aliases.cjs` scans the staged diff of EVERY file
(including `.planning/` plans and research docs) for table DDL and index DDL whose table name is not in
`.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml`, and refuses the commit (observed when this
file was first committed with literal DDL for `room_change_log` and `room_tx_context`).
**How to avoid:** the change-log plan's first task adds both tables to `aliases.yml` with `resolution: NEW` and a
`canon_parts` list (Part 9; Part 4 if the planner ties it to typed graph events) before any DDL is staged; plans
describe DDL in prose or tables until then. Never `--no-verify` (RULE 9).

## Code Examples

### The shell's MCP client in legacy sessionful mode (server side)
```js
// Source: @modelcontextprotocol/client 2.1.0 typings (versionNegotiation default 'legacy'); lib/mcp/adapter-client.cjs:24,76-77
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
async function openHumanSession(port, roomSlug) {
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + port + '/mcp'));
  const client = new Client({ name: 'mindrian-shell', version: '1.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'legacy' } }); // explicit: the session map needs 2025-era requests
  await client.connect(transport);
  const bind = await client.callTool({ name: 'room_bind', arguments: { room: roomSlug } });
  return { client, transport, bind, sessionId: transport.sessionId };
}
```

### Pull-only RxDB replication over the shell's feed relay
```js
// Source: spike 006 stages/02_browser-replica/src/app.js 112-158; rxdb.info/replication.html
const rNodes = replicateRxCollection({
  collection: db.nodes,
  replicationIdentifier: 'room-nodes:' + roomKey + ':' + epoch,
  live: true,
  retryTime: 1000,
  pull: {
    batchSize: 200,
    handler: async (checkpoint, batchSize) => {
      const r = await fetch('/feed/changes?collection=nodes&limit=' + batchSize +
        (checkpoint ? '&after=' + checkpoint.seq + '&epoch=' + checkpoint.epoch : ''), { cache: 'no-store' }).then((x) => x.json());
      if (r.reason === 'checkpoint_expired' || r.reason === 'epoch_changed') throw new ProjectionResetError(r); // caller removes + rebuilds
      return { documents: r.changes.map(toDoc), checkpoint: { epoch: r.epoch, seq: r.through } };
    },
    stream$: hint$.asObservable(), // emits 'RESYNC' on each room.changed hint and on reconnect
  },
  // push: deliberately absent
});
```

### Trigger install, idempotent, after migrations
```js
// Source: measured in this session against node:sqlite (SQLite 3.51.3); sqlite.org/lang_createtrigger.html
function installChangeLog(db) {
  db.exec(CHANGE_LOG_DDL);            // the two tables, the index and six IF NOT EXISTS triggers described above
  const row = db.prepare("SELECT value FROM identity WHERE key = 'change_log_epoch'").get();
  if (!row) db.prepare("INSERT INTO identity (key, value, updated_at) VALUES ('change_log_epoch', ?, ?)")
    .run(require('node:crypto').randomUUID(), new Date().toISOString());
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node --experimental-strip-types` | type stripping on by default, no warning | Node v22.18.0 | floor `>=22.18.0` (D-17) |
| `--experimental-require-module` | `require(esm)` unflagged | Node v22.12.0 (silent since v22.13.0) | `.mts` usable from CJS (no top-level await) |
| MCP SDK v1 single shared transport | v2 `createMcpHandler` + `isLegacyRequest` routing, sessionful legacy map kept | Phase 267, 2026-10-02 | the shell picks the legacy era explicitly |
| `{timestamp, id}` checkpoints | writer-side monotonic sequence | spike 006, 2026-10-02 | `room_change_log` |
| `typescript` 5.x | 7.0.2 latest (2026-07-08), still honors `erasableSyntaxOnly` / `verbatimModuleSyntax` | 2026 | tooling package pins 7.0.2 |

**Deprecated / outdated in the inputs:** the discovery shim (retired by 267); spike 007's `@modelcontextprotocol/sdk@1.29.0` bridge (v1 removed by MCPV2-18); CONTEXT's path `lib/mcp/shape-f1-renderer.cjs` (real: `lib/hmi/shape-f1-renderer.cjs`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Spawning the user's own Claude Code headless (`claude -p`) from the shell is acceptable under Anthropic's terms and SEED-067 | Pattern 11 | the adapter proof needs a different mechanism (e.g. the interactive CLI session picks up the selection) |
| A2 | Trigger capture is an acceptable implementation of D-18's "same transaction" (it is a HOW, but a reviewer may expect writer edits) | Pattern 2 | about 60 writer edits and no coverage of Python/scripts |
| A3 | A single-use bootstrap code exchanged for an HttpOnly cookie is acceptable local auth, given the review's "avoid tokens in URLs" (`2026-09-20-localhost-workspace-review.md:122`) | Pattern 9, Security | needs another bootstrap (e.g. a code typed from the CLI) |
| A4 | `@fontsource-variable/*` and `@fontsource/bodoni-moda` are the right font packages | Standard Stack | swap for `next/font/google` self-hosting or local files |
| A5 | Agent-native's build tool line is Vite 8 (spike 007 says Vite 8.1) | Standard Stack | packaging measure differs |
| A6 | A Next static export can host the workroom slice with client routing for `room/[room]` | Pattern 6 | standalone output (ships traced `node_modules`) instead |
| A7 | `entity_revision` = the row's `change_seq` is enough for expected-revision checks | Pattern 2, 10 | add a per-entity counter |
| A8 | RxDB `leader-election` works with Dexie `multiInstance: true` in the open-source package without premium | Pattern 7 | single-tab mode with a lock |
| A9 | Claude Code always runs the plugin from `cache/<marketplace>/<plugin>/<version>/`, never from `npm-cache/node_modules/` (observed for beta.53, undocumented) | Pattern 1 | `.ts` in `lib/core` would fail on install; the installed-layout test is the guard |
| A10 | The `room_tx_context` single-row table is a safe way to stamp `transaction_id` across processes (writes are serialized by SQLite) | Pattern 2 | leave `transaction_id` NULL for trigger rows and stamp only inside the helper |

## Open Questions

1. **Single-document read through MCP.** BlockNote display (D-13) needs one artifact's markdown; no MCP surface returns one file (the `room://section/{sectionName}` resource returns every `.md` in a section, `lib/mcp/resources.cjs:113-198`; `room_content` manages entities). Recommendation: a `room://artifact/{section}/{file}` resource template reusing the same `isRealpathContained` guard, or a read op on the feed tool; decide in the feed plan.
2. **Where the shell server lives.** A plugin-side CJS server (express already a root dep) serving release-built static assets plus actions keeps root deps unchanged; a Next standalone or agent-native Nitro server ships its own runtime. The bake-off's packaging measure decides; the plan should name both.
3. **Shell launch surface.** A new command adds a surface (Part 7 justification, Part 11 born-wired, website command count 113) versus extending `/mos:dashboard` (`[live|stop|open]`, `hitl_shape: F.1`). Navigator call.
4. **The shell's host identity.** Add the shell to `HOST_TIER_MAP`, or rely on the flag? Only matters if v1 writes beyond `gate_answer`.
5. **Artifact changes and the feed.** Artifact files change on disk; they reach the log only when an indexer writes their nodes (the PostToolUse graph hooks). Files written outside Claude Code without indexing never appear. Acceptable for v1 review-and-decision; state it.
6. **Retention numbers.** No measurement exists for log growth per day in a real room (rebuildGraph logs a delete and an upsert per indexer node per run). Measure on a fixture room in the feed plan before choosing a window.

## Risks (deferred items that may press in)

- **Executable workspace creep:** the Claude adapter proof (D-14) is a slice of browser-owned execution. Keep it to one bounded, read-only, schema-constrained call; streaming, cancellation and resume stay v2.
- **Governed editing creep:** "show a BlockNote document" must stay read-only (`editable={false}`, no save route); any save path is the deferred governed-editing item.
- **Phase 289 schedule:** the gate-button, recovery and human-only plans wait on it; wave 0, the feed and the bake-off do not (D-16). If 289 slips, the bake-off slice can still click Confirm on today's ledger, with the burn behavior recorded, not fixed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (nvm) | everything | yes | v22.23.1, v22.22.2 | - |
| `/usr/bin/node` | nothing (trap) | yes | v20.19.5 | put nvm first on PATH |
| Node exactly 22.18.0 | floor proof | no | - | CI job or Docker; local leg exit 77 |
| npm | packaging tests | yes | 10.9.8 | - |
| pnpm | agent-native scaffold | yes | 12.3.4 | - |
| Claude Code CLI | adapter proof, CLI probes | yes | 2.1.287 | - |
| Docker | clean-machine test | CLI 29.8.0, daemon NOT running | - | hermetic `$HOME` + staged layout |
| Playwright + Chromium | E2E, egress, journey | yes (spike-local) | 1.63.0, chromium-1217 | - |
| python3 + sqlite3 | Python writer trigger test | yes | 3.12.3, SQLite 3.45.1 | skip leg exit 77 |
| sqlite3 CLI | none required | no | - | node:sqlite |
| Network to npm | installing walled-off packages | yes | - | - |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** Docker daemon and Node 22.18.0 (clean-machine and exact-floor legs).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | House pattern: plain Node CJS scripts with PASS/FAIL counters and `node:assert/strict` (1,281 of 1,374 `tests/test-*.cjs` files do not use `node:test`); phase aggregator `tests/run-all-<phase>.sh` with `run` / `run_if` legs, exit 77 = SKIPPED (ENV GAP), an em-dash guard leg (model: `tests/run-all-267.sh`, `run-all-357.sh`) |
| Config file | none (scripts); UI package tests run under the UI package's own scripts plus Playwright from the spike-local install or a walled-off dev package |
| Quick run command | `node tests/test-369-<topic>.cjs` |
| Full suite command | `bash tests/run-all-369.sh` |

### Phase Requirements -> Test Map

| Req family | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS369 | erasable gate passes on tree, fails on forbidden fixture | unit | `node tests/test-369-ts-erasable-gate.cjs` | no, Wave 0 |
| TS369 | floor is `>=22.18.0` in package.json and CLAUDE.md; reasons stated | unit | `node tests/test-236-engines-floor.cjs` (updated) | yes (update) |
| TS369 | installed layout runs; `.ts` refused under `node_modules` | integration | `node tests/test-369-installed-layout.cjs` | no, Wave 0 |
| TS369 | no hook reaches a TS module; cold-start baseline recorded | static + measurement | `node tests/test-369-hook-require-graph.cjs`; `node scripts/measure-hook-cold-start.cjs --json` (one-time record) | no |
| TS369 | clean machine at exactly 22.18.0 | integration | same as installed-layout with `NODE_BIN` pinned; exit 77 locally | no |
| CHG369 | triggers + epoch installed after migrations, all three schema variants | unit | `node tests/test-369-change-log-ddl.cjs` | no |
| CHG369 | every inventory row logs; rollback logs nothing; inventory regex finds no unlisted site | unit | `node tests/test-369-writer-inventory.cjs` | no |
| CHG369 | another process's write appears; Python writer fires triggers | integration | `node tests/test-369-change-log-cross-process.cjs` | no |
| FEED369 | paging, deletes as rows, `checkpoint_expired`, `epoch_changed`, snapshot then tail | integration | `node tests/test-369-room-changes.cjs` | no |
| FEED369 | vocabulary pin; `room.changed` published on a cross-process write | unit + integration | `node tests/test-369-sse-room-changed.cjs` | no |
| FEED369 | baselines refreshed (tool count, connectors, schema budget) | regression | `node tests/test-267-mcpv2-registration-api.cjs`; `node scripts/build-connector-registry.cjs --check`; `node tests/test-270-tool-schema-budget.cjs` | yes |
| SESS369 | bind, mint, isolation, answer, reconnect, modern arm | integration (live daemon) | `node tests/test-369-sessionful-acceptance.cjs` | no |
| GREC369 | replay after lost response; restart; room switch; stale subject; persistence failure leaves gate answerable | integration | `node tests/test-369-gate-recovery.cjs` | no (needs Phase 289) |
| HUM369 | agent self-approval refused; forged principal ignored; browser click ratifies | integration | `node tests/test-369-human-only.cjs` | no |
| RXP369 | catch-up, live update, 200-burst 0 missing, kill/restart converge, hard delete, warm reload 0 docs, multi-tab, compaction rebuild, schema bump rebuild, removed room purge | e2e (Playwright) | `node tests/e2e-369/replica.cjs` | no |
| CANON369 | only 127.0.0.1 contacted; bundle has no `rxdb.info`/`fonts.googleapis`; radius 0; ochre never text on paper | e2e + static | `node tests/e2e-369/egress-and-canon.cjs` | no |
| SHELL369 | the one recoverable journey (open correct room, inspect evidence, decide, persisted, restart both servers, recover) | e2e | `node tests/e2e-369/journey.cjs` | no |
| BAKE369 | nine measures recorded for both candidates | harness | `node ui/bakeoff/measure.cjs --candidate workroom|agent-native` | no |
| CM369 | counts for gate latency, catch-up time, lost writes emitted | unit | inside replica/journey e2e outputs | no |

### Manual-only (cannot be automated)

- The navigator's own click test on the winning chassis (and spike 007's still-owed click).
- The D-04 co-design session and its signed design note.
- The D-07 Decision Gate on the bake-off table.
- Visual review against Canon v3 (screenshots attached; contrast is automated, composition is not).
- Desktop and Cowork showing the one plain line (D-03); MCPV2-13's human Desktop smoke is still owed and is not this phase's gate.

### Sampling Rate
- **Per task commit:** the plan's own `tests/test-369-*.cjs` file(s) + `node scripts/check-substrate.cjs --diff`.
- **Per wave merge:** `bash tests/run-all-369.sh`.
- **Phase gate:** `bash tests/run-all-369.sh`, `bash tests/run-all-267.sh`, `bash tests/run-all-238.sh` (ledger), `bash tests/run-all-198.sh` (MCP-first), `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`, then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-369.sh` with every leg pre-declared as `run_if` (the 267/357 "written once" rule)
- [ ] `tests/helpers/mcp-daemon-369.cjs` (hermetic flag-ON daemon spawn and port read, lifted from `test-267-mcpv2-flag-on.cjs` 90-166 and `helpers/mcp-wire-267.cjs` `hermeticEnv`)
- [ ] `tests/fixtures/369/writer-inventory.json` (the table above as data) and a fixture-room builder (the `tests/helpers/fixture-room-*.cjs` pattern) with all three schema variants
- [ ] `tools/ts-check/` walled-off package (typescript 7.0.2, `@types/node@22`) and `tsconfig.core.json`
- [ ] SSE vocabulary pin test (none exists today)
- [ ] Playwright entry for e2e (reuse the spike 006 install or add a walled-off dev package)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | local bootstrap code exchanged once for a server-side session (A3); no provider or Brain credentials in the browser (review line 107) |
| V3 Session Management | yes | HttpOnly, SameSite=Strict cookie; server-side map browser session -> MCP client; idle expiry (spike 007 bridge used 30 min) |
| V4 Access Control | yes | per-action exposure policy; human-only approve with a render nonce; gates owned by the minting session; room recorded at mint |
| V5 Input Validation | yes | zod at the action layer and again at the MCP tool (`gate_answer` schema, `validateChosenAgainstCard`); path containment via `isRealpathContained` |
| V6 Cryptography | yes (tokens) | `crypto.randomUUID` / `randomBytes`; never hand-rolled |
| V12 Files and Resources | limited | no uploads in v1 (the workroom's `assets` POST is removed) |
| V14 Configuration | yes | bind 127.0.0.1 only; Host/Origin validation (MCPV2-17 pattern); CSP with no outside hosts; telemetry env off |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DNS rebinding to the localhost shell or daemon | Spoofing | Host and Origin allow-lists (daemon already 403s, `bin/mindrian-mcp-server.cjs:489-496`) |
| CSRF on approve | Tampering | SameSite=Strict + CSRF token + render nonce |
| XSS from room content in views or BlockNote | Tampering / Elevation | render text, never raw HTML; BlockNote read-only; spike 007 rendered card markdown as plain text |
| Gate id leak used to cancel a decision | Denial of Service | Phase 289 consume-after-checks; gate ids never shown cross-session |
| Agent approving its own proposal | Elevation | human-only exposure, nonce, separate MCP session |
| Cross-room write after a room switch | Tampering | room recorded at mint, `room_switched` refusal |
| Modern-era request bound to an inherited CLI session | Spoofing | legacy client; scrub `CLAUDE_CODE_SESSION_ID` at spawn |
| Outside-host egress (Google Fonts, rxdb.info iframe, agent-native analytics) | Information Disclosure | bundled fonts, no dev-mode, `DO_NOT_TRACK=1`, Playwright egress test |
| Scaffold `CLAUDE.md` bleeding into Claude sessions | Tampering | delete on setup (spike 007 `setup.sh`) |
| Room content to a second model (workroom briefing via AI Gateway) | Information Disclosure | remove the `ai` path (D-14, SEED-067) |

## Sources

### Primary (HIGH confidence)
- Repo code read this session (file:line cited inline): `bin/mindrian-mcp-server.cjs`, `lib/core/session-binding.cjs`, `lib/mcp/daemon-lifecycle.cjs`, `lib/mcp/gate-ledger.cjs`, `lib/mcp/tools/gate.cjs`, `lib/mcp/gate-render.cjs`, `lib/hmi/shape-f8-renderer.test.cjs`, `lib/mcp/sse-event-bus.cjs`, `lib/mcp/register-core-tools.cjs`, `lib/mcp/tools/status.cjs`, `lib/mcp/resources.cjs`, `lib/mcp/mcp-first-flag.cjs`, `lib/mcp/surface-detect.cjs`, `lib/core/navigation.cjs`, `lib/core/navigation/*`, `lib/core/node-insert.cjs`, `lib/core/rs-sqlite-mirror.cjs`, `lib/core/lazygraph-ops.cjs`, `lib/core/room-db.cjs`, `scripts/check-substrate.cjs`, `scripts/rs-engine.py`, `hooks/hooks.json`, `package.json`, `tests/test-236-engines-floor.cjs`, `tests/test-341-shrinkwrap-no-dev.cjs`, `tests/test-267-mcpv2-flag-on.cjs`, `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 / RULE 8, `.planning/REQUIREMENTS.md`
- Installed SDK sources: `@modelcontextprotocol/server` 2.1.0 `dist/index.cjs` (isLegacyRequest), `@modelcontextprotocol/client` 2.1.0 `dist/index.d.cts` (versionNegotiation); rxdb 17.5.0 installed source (limits, dev-mode iframe, removeRxDatabase)
- nodejs.org/docs/latest-v22.x/api/typescript.html; nodejs.org/docs/latest-v22.x/api/modules.html
- sqlite.org/lang_createtrigger.html; sqlite.org/lang_conflict.html; sqlite.org/pragma.html#pragma_data_version
- rxdb.info/replication.html; rxdb.info/migration-schema.html
- nextjs.org/docs (v16.3.8): app/getting-started/fonts; app/api-reference/config/next-config-js/output
- agent-native.com/docs/actions-defining; github.com/BuilderIO/agent-native README
- Spike READMEs 006 and 007 (measured, VALIDATED 2026-10-02) and their source files
- Experiments run this session in the scratchpad: type stripping in and out of `node_modules`, TS 7.0.2 erasable checks, cold-start benchmark, trigger semantics and overhead, `npm pack` nested `node_modules`

### Secondary (MEDIUM confidence)
- Local `claude --help` (Claude Code 2.1.287) for headless flags
- `~/.claude/plugins/installed_plugins.json` and cache layout (observed, undocumented)
- `/home/jsagi/dev/mindrian-website/docs/DESIGN-CANON.md`, `website/src/app/globals.css`, `website/src/app/layout.tsx`
- `/home/jsagi/dev/mindrian-workroom/` source

### Tertiary (LOW confidence)
- Font package names (training, slopcheck OK); Vite line for agent-native (spike README only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (registry-verified versions; installed sources read)
- Architecture: HIGH for the MCP-side feed, sessions and wave 0 mechanics (code read and measured); MEDIUM for packaging (the bake-off measures it)
- Pitfalls: HIGH (each one reproduced or read in code)
- Claude adapter terms: LOW (A1)

**Research date:** 2026-10-02
**Valid until:** 2026-10-16 for agent-native (nightly releases daily) and Next; 2026-11-01 for the repo facts if Phase 289 and peer phases have not moved the gate files

## RESEARCH COMPLETE
