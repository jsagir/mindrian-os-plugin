---
title: UI/UX prior-art inventory (pre-step for SEED-104..107)
date: 2026-10-02
kind: research-inventory
scope: every prior MindrianOS UI/UX experience, decision and idea; no new design
required_by: SEED-105 "Pre-step (navigator, 2026-10-02)"; memory feedback_mos_ui_stack_and_v3_design_rule.md line 23
---

# UI/UX prior-art inventory (2026-10-02)

Read-only sweep. Repo paths are relative to `/home/jsagi/dev/MindrianOS-Plugin` unless absolute. `.planning/` is gitignored, so most dates come from frontmatter, directory names or `git log` on the code that shipped. Where a source quote contained an em-dash, it is shown with a hyphen. Anything not verified is marked **(unverified)**.

Location corrections: `/home/jsagi/MindrianOS` holds only `research/` (a mirror of `~/MindrianRooms/rethinking-mindrianos/research`). The V4 rebuild lives at `/home/jsagi/dev/MindrianOS`, and the Academy at `/home/jsagi/dev/MindrianV2` (`/home/jsagi/MindrianV2` does not exist). Two relevant repos were not on the original search list: `/home/jsagi/dev/mindrian-workroom` and `/home/jsagi/dev/mindrian-doc-hub`.

---

## 1. Executive summary

- **Five eras of UI work.**
  1. **V2/V4 apps (Feb-Mar 2026).** Next.js, CopilotKit, React Flow and tldraw; dark De Stijl. Superseded when the product became a plugin.
  2. **Terminal ruling system (Mar 2026 onward).** 4 zones, 5 body shapes, 12 glyphs, then Shape F F.0-F.9 through AskUserQuestion. Shipped, and it is the law today.
  3. **Localhost and HTML views (Mar-Apr 2026).** Dashboard, wiki, 6-view presentation, SnapshotHub, and the three MCP Apps. Shipped, with known defects.
  4. **The visible room (Jul 2026).** BlockNote wiki (Phase 232, shipped), `dev/mindrian-workroom` (Next.js + BlockNote, alive, no auth), and the collaborative-editor seeds 066/072/073 (unbuilt).
  5. **The workspace and shell route (Sep-Oct 2026).** The 260920-bhx task-centered workspace review, sketch 001, spikes 005-007, and SEED-105/107. Reviewed, not built.
- **Shipped:** the CLI ruling system, Shape F renderers, the gate render ladder, statusline cockpit, legacy dashboard, wiki with BlockNote editing, presentation/deck/export/snapshot generators, three MCP Apps (Desktop/Cowork only), and the SSE bus (behind a flag).
- **Unbuilt:** the 260920-bhx workspace, the Phase 136 render spine, the v1.12 MCP Apps host plan, mindrian-platform.html (built but orphaned), collaborative editing, and auth/tenancy for the workroom.
- **The biggest unresolved tensions:**
  - Four or five competing palettes. The 2026-10-02 v3 Workshop Modernism mandate now collides with the shipped M:OS v1.1 bundle.
  - The CLI gate rung: code uses elicitation, while the 2026-10-02 ruling says "normal card on CLI".
  - Two UI substrates already exist (the workroom, and the agent-native plan), plus a CJS-only rule that is lifted on paper but not yet in CLAUDE.md.
  - The in-app agent: agent-native's own agent versus the 260920-bhx Claude Code adapter.

---

## 2. Timeline

| Date | Artifact | Path | Decided / proposed | Status | Relevance to SEED-104..107 |
|---|---|---|---|---|---|
| 2026-02-21 | V2 De Stijl design law | `/home/jsagi/dev/MindrianV2/.claude/rules/figma-design-system.md` | Radius 0, semantic color, Bebas+Inter, React Flow straight edges | superseded | origin of "radius 0, color as meaning" |
| 2026-03-10 | V4 wireframes WIRE-01..07 | `/home/jsagi/dev/MindrianOS/docs/wireframes/WIREFRAMES.md` | Three-panel workspace; BlockNote toolbar | superseded | earliest workspace + BlockNote layout |
| 2026-03-15 | V4 Phase 09 De Stijl frontend | `/home/jsagi/dev/MindrianOS/.planning/phases/09-de-stijl-frontend/09-CONTEXT.md` | Mondrian treemap; custom SSE; BlockNote and Yjs deferred (:218, :221) | superseded | "solo first, teams later" precedent |
| 2026-03-15 | Academy minichat spec | `/home/jsagi/dev/MindrianV2/docs/superpowers/specs/2026-03-15-task-picker-minichat-design.md` | Full-screen swap, two views, no panels | shipped (V2) | one-view-at-a-time precedent |
| 2026-03-22 | Phase 03.1 Data Room Dashboard | memory `project_dataroom_dashboard.md` | Localhost Cytoscape viewer + chat | shipped (4/5 gaps) | ancestor of port 3131 |
| 2026-03-26 | Phase 21 CLI UI Ruling System | `.planning/phases/21-cli-ui-ruling-system/21-CONTEXT.md`; `skills/ui-system/SKILL.md` | 4 zones, 5 body shapes, 12 glyphs, 5 ANSI colors, CLI master | shipped | still the law for terminal output |
| 2026-03-26 | Phase 19 wiki | `lib/wiki/wiki-server.cjs`; memory `project_phase19_wiki_dashboard.md` | Wikipedia-style localhost wiki, graph homepage, dark default | shipped, partly superseded | reuse candidate |
| 2026-03-26 | Room dashboard standard | memory `feedback_room_dashboard_structure.md:7` | Mondrian grid export is "the STANDARD ... until a new UI/UX is designed" | superseded (in effect) | sunset clause triggered by SEED-105 |
| 2026-03-26 | WIKI-PLATFORMS | `.planning/research/WIKI-PLATFORMS.md` | No editor ("the moment we add editing, we've become Wiki.js"); Express + markdown-it | reversed by Phase 232 | shows editing was a deliberate reversal |
| 2026-03-30 | 6-view presentation system | `scripts/generate-presentation.cjs`; memory `project_v5_presentation_system.md` | Dashboard/Wiki/Deck/Insights/Diagrams/Graph, two themes | shipped | export reuse |
| 2026-03-31..04-01 | Phases 30-41, 48-51 | `templates/presentation/`, `dashboard/export-template.html` | Presentation, BYOAPI chat, snapshot, hub, Constellation | shipped | export reuse; BYOAPI chat is a known XSS/key risk |
| 2026-04-06 | MCP Apps (v3-era "60-01") | `lib/mcp/app-views.cjs`, `lib/mcp/app-html/*.html` | `ui://mindrian-os/room-dashboard`, `room-wiki`, `room-graph` | shipped (Desktop/Cowork only) | inline views on hookless surfaces |
| 2026-04-09 | MCP-APPS strategic research | `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` | "Verdict: YES - Rebuild MindrianOS as MCP-Native with Dual Distribution" | not adopted | competing "MCP Apps is the UI" thesis |
| 2026-04-11 | MCP platform app brief | `docs/design/MCP-PLATFORM-APP-BRIEF.md`; `lib/mcp/app-html/mindrian-platform.html` | One universal app with modes | built, orphaned | 1841-line prototype nobody loads |
| 2026-04-16 | ui-ux-pathways | `.planning/research/ui-ux-pathways/INDEX.md` | "The terminal (Claude Code) is the execution engine. The browser is the control surface." Option F localhost selected; Electron rejected | partly built (Phase 87) | same thesis as 260920-bhx |
| 2026-04-18 | Six-hats review | `.planning/REVIEWS/2026-04-18-six-hats.md` | "'rewrite in React.' No."; vendor CDN deps; no responsive design | advisory | counter-voice to the React route |
| 2026-04-19 | Phase 87-08/09 live dashboard | `scripts/serve-dashboard-live`; `.planning/phases/87-*/87-CONTEXT.md:280` | Port 3131, 127.0.0.1 only, BYO chat | shipped | the "old 3131 UI" that bhx rules out |
| 2026-04-20..05-02 | Phase 88.2 selector block | `.planning/phases/88.2-*/88.2-CONTEXT.md:19` | "AskUserQuestion is the implementing primitive" | shipped | gate cards |
| 2026-04-24 | v1.12 MCP Apps host kickoff | `.planning/milestones/v1.12.0-KICKOFF.md:394, :475` | ui-adapter, Shape F as MCP Apps; "rendering surface, NOT a storage layer"; "No cloud backend" | unbuilt; rulings stand | the no-second-store rule predates SEED-105 |
| 2026-04-29 | cool-ui style reference; moat survey; gamified review | `.planning/research/cool-ui-style-reference.md`, `uiux-moat-*.md`, `gamified-review-via-askuserquestion.md` | "NEVER prose-prompt for confirmation. The selector IS the surface." | canonical reference / research | gate UX doctrine |
| 2026-05-01 | Phases 100/101 | `lib/hmi/selector-dispatcher.cjs` | The lib/hmi single door; Shapes G/H | shipped | reuse |
| 2026-05-07 | SEED-006 / v1.14 Visible Room | `.planning/seeds/SEED-006-*.md`; `.planning/milestones/v1.14.0-VISIBLE-ROOM-ROADMAP.md` | Fuse SnapshotHub and wiki | expanded into Phase 232 | wiki lineage |
| 2026-05-10 | UI-UX convergence draft | `docs/UI-UX-CONVERGENCE-2026-05-10/` | "no token core"; the ui-system skill over-claims | working draft, unratified | token-core gap still open |
| 2026-05-16 | Phase 121.5 terminal coherence | `.planning/phases/121.5-*/` | Two-row statusline, terminal-capability | shipped | statusline |
| 2026-05-31 | Phase 136 Liquid State render spine | `.planning/phases/136-*/` | Headless core + thin clients over SSE, `mos tui`, web twin | **unbuilt** (SUMMARYs are doctor stubs) | closest prior "one core, many surfaces" design |
| 2026-06-06 | SEED-020 | `.planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md` | "THE TOGGLE VIEW ... IS THE STYLE I WANT FOR MINDRIAN" | dormant, partly applied | card look as the brand of decision |
| 2026-06-09 | SEED-021 | `.planning/seeds/SEED-021-*.md` | "No card, no picture" atomic coupling | dormant | gate rendering |
| 2026-06-12 | Hooked first step (BIRTH-FLOW Decision 8) | memory `feedback_hooked_model_first_steps.md` | First step of any surface is a full Hook cycle | hard rule | first screen of SEED-105 |
| 2026-06-28 | Statusline contract | `docs/STATUSLINE-CONTRACT.md` | 4 tiers, "LOCKED 2026-06-28" | shipped | session indicator analog |
| 2026-07-01 | Phase 188 F.0-F.9 | `docs/MINDRIAN-CANON.md:166-183` | Closed ten-shape family | shipped | gate vocabulary for buttons |
| 2026-07-02 | Phase 190 / 210 R16 | `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` | Born-declared HITL shape; 210 made it advisory | shipped | every new surface declares its shape |
| 2026-07-09 | Phase 198 MCP-first | `lib/mcp/gate-render.cjs`, `lib/mcp/sse-event-bus.cjs` | 3-rung gate ladder; SSE bus; daemon + multi-client | shipped (flag-gated) | substrate SEED-105 wraps |
| 2026-07-16..17 | mindrian-workroom built | `/home/jsagi/dev/mindrian-workroom/` | Next 16 + React 19 + BlockNote; Room Home; PDF/DOCX | built, parked | an existing UI the shell could replace or absorb |
| 2026-07-16 | M:OS design system v1.1 | `skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md`; `lib/ui/design-system.cjs` | De Stijl x Swiss Broadside, cream, one grotesk | shipped (232-01, quick 260723-m5d) | conflicts with v3 |
| 2026-07-18 | SEED-066 | `.planning/seeds/SEED-066-*.md` | AFFiNE/Docmost disqualified; BlockNote xl-* GPL; "terminal-first, workspace-later" | open | licence gate |
| 2026-07-19..20 | Phase 232 BlockNote Wiki Convergence | `.planning/phases/232-blocknote-wiki-convergence-*/` | "Split by surface"; Room Home replaces graph homepage; direct save | shipped | **the BlockNote capability** |
| 2026-07-20..22 | SEED-072 / SEED-073 + research trail | `.planning/seeds/SEED-072-*.md`, `SEED-073-*.md` | Navigator-chosen collab direction; filesystem canonical, Yjs/RxDB disposable | chosen / open, unscoped | RxDB one-way rule origin |
| 2026-08-03 | Sketch 001 workroom shell | `.planning/sketches/001-mindrian-workroom-shell/`, `.planning/sketches/MANIFEST.md` | React+Vite+xyflow, 3 variants, AG-UI events, "90% modern ... 10% De Stijl" | awaiting review, no winner | prior shell mockups |
| 2026-08-19 | runtime-instructions | `lib/mcp/runtime-instructions.cjs` | Larry loop via MCP instructions under the 2048 cap | shipped | Desktop/Cowork behaviour |
| 2026-09-07 | SEED-091 | `.planning/seeds/SEED-091-resume-mindrian-workroom-auth-tenant-db.md` | Workroom "is the real UI, already built, just missing auth and a tenant DB" | dormant | direct rival or input to SEED-105 |
| 2026-09-20 | Quick 260920-bhx | `docs/reviews/2026-09-20-localhost-workspace-review.md`; `.planning/quick/260920-bhx-localhost-review/` | Task-centered workspace (Work/Evidence/Decisions/Deliverables/Rooms), Claude adapter first | review complete, app unbuilt | SEED-105's trigger and spec |
| 2026-09-20 | localhost POC | `docs/reviews/localhost-poc/` | node:http POC with revisioned document save, Host/Origin/token | prototype | reuse for security patterns |
| 2026-09-23 | Phase 354-08 | commit 0cdcb11ca | Host check on legacy dashboard GETs (fixes bhx NF-04) | shipped | hardening |
| 2026-09-23 / 10-02 | CLI elicitation rulings | `lib/mcp/tools/gate.cjs:9-14`; `references/capability-radar/changelog-cache.md:26` | 09-23 "let elicitation take over on CLI"; 10-02 "Normal card on CLI" | code reflects 09-23 only | SEED-104 third defect |
| 2026-10-01 | Website canon v2 | `/home/jsagi/dev/mindrian-website/docs/superpowers/specs/2026-10-01-mos-website-rethink-design.md` (D-10) | Cream/rust craft, Fraunces/DM Sans | superseded by v3 | palette lineage |
| 2026-10-01 | Spike 006 room-pull-checkpoint | `.planning/spikes/006-room-pull-checkpoint/` | RxDB-style pull converged; plugin SSE bus 0 frames | results on disk; MANIFEST says PENDING | evidence for one-way sync |
| 2026-10-02 | Website canon v3 Workshop Modernism | `/home/jsagi/dev/mindrian-website/docs/DESIGN-CANON.md` (D-29) | Paper/ink, rust/cobalt/ochre as meaning, radius 0 | law for the website; extended to the UI by memory rule | mandated style |
| 2026-10-02 | Spike 005 mcp-http-reach | `.planning/spikes/005-mcp-http-reach/` | Per-connection HTTP works; stateless fails; gates session-owned | validated | transport for the shell |
| 2026-10-02 | Spike 007 agent-native-wraps-mcp | `.planning/spikes/007-agent-native-wraps-mcp/` | The SEED-105 core test | pending | kill/pass of SEED-105 |
| 2026-10-02 | SEED-104 / 105 / 106 / 107 | `.planning/seeds/SEED-10[4-7]-*.md` | Grant loop + CLI card; agent-native shell; Theo insights; CJS-only lifted | dormant | the subject |
| 2026-10-02 | Memory rule: UI stack + v3 | `/home/jsagi/.claude/projects/-home-jsagi/memory/feedback_mos_ui_stack_and_v3_design_rule.md` | icm-workspace-architect + websocket-engineer + RxDB + agent-native; v3 only; whole plugin may go TS | hard rule | governs all UI work |

---

## 3. Threads

### (a) Terminal / CLI UI ruling system (sources: 14)

- **Phase 21 (2026-03-26).** `.planning/phases/21-cli-ui-ruling-system/21-CONTEXT.md`.
  - D-03: four zones. D-04: "Zone 4 (Action Footer) is NEVER omitted".
  - D-06..10: body shapes A-E. D-11: 12 glyphs. D-12: no emoji.
  - D-13/14: 5 ANSI colors. D-18: CLI is master, Desktop degrades.
- **Current authority: `skills/ui-system/SKILL.md`.**
  - :31 "Every output has exactly 4 zones in fixed order."
  - :54-80 body shapes A Mondrian Board, B Semantic Tree, C Room Card, D Document View, E Action Report. :58 says body shape and Shape F are orthogonal axes.
  - :332 "NO EMOJI. EVER." (the statusline is the carve-out).
  - :371-392 dual palette chosen by surface.
  - :440 "CLI is master template."
  - Mirror: `output-styles/destijl.md:12-51`. Memory: `project_mos_ui_ruling_system.md`.
- **Shape F.**
  - Canon `docs/MINDRIAN-CANON.md:166-183` defines F.0-F.9: "closed ten-shape family" (:181), "All implemented via AskUserQuestion primitive" (:183).
  - Renderers: `lib/hmi/shape-f0..f9-renderer.cjs`, `lib/hmi/selector-dispatcher.cjs` (the single door, with the trailer at :550-574).
  - Consumer guide: `docs/F-SELECTOR-CONSUMER-GUIDE.md`. Phases 88.2, 101, 143.1, 188, 190, 192, 209 and 210.
- **Seeds.**
  - SEED-020 (Shape F is the universal UI).
  - SEED-021 ("No card, no picture"; F.7-max keyboard dial).
- **Phase 136 Liquid State (unbuilt).**
  - D-09: "SEAMLESS is the hard requirement ... `mos tui` is demoted to an OPT-IN power surface."
  - D-10: headless core + thin clients over SSE.
  - D-14: token core, "color always glyph-backed".
- **Research.**
  - `.planning/research/cool-ui-style-reference.md` (2026-04-29): rules not boxes, glyph status grid.
  - `.planning/research/2026-06-08-keyboard-tui-capability-cockpit-research.md`: raw-mode TUIs fail under the agent Bash tool and on Windows.
  - `prototypes/ink-tui/` contains only node_modules.
  - Memory: `feedback_terminal_ux_patterns.md` (flows not commands, 2-3 next actions), `feedback_banner_mondrian.md`.
- **Statusline.**
  - `docs/STATUSLINE-CONTRACT.md` (LOCKED 2026-06-28; 4 tiers; "Anti-Dealer product invariant (NORMATIVE)" :92).
  - Code: `lib/statusline/*`, `scripts/statusline-mos*`, `scripts/context-monitor`.
  - Memory `feedback_121_5_statusline_co_design.md`: "Two-row is a CANDIDATE, not the answer"; co-designed with the navigator.
- **Drift.**
  - SKILL.md:56,84 says F.0-F.7.
  - `output-styles/destijl.md:34-40` lists F.0-F.6.
  - Canon :205 still says "one of the five F-sub-shapes", while :181 says ten.

### (b) Decision gates, card rendering, elicitation (sources: 16)

- **Canon Part 3.** `docs/MINDRIAN-CANON.md:139-205`: tri-context gate, 10 closed verbs (:149-164). :205: "This gate is the universal UX primitive ... No bespoke dialogs, no framework-specific modals."
- **Render ladder.** `lib/mcp/gate-render.cjs` (Phase 198-05).
  - Rungs: (a) MCP elicitation, "LOSSY on the wire"; (b) AskUserQuestion adapter; (c) structured text.
  - SUPERSET_SCHEMA `mindrian.gate.superset.v1` (:64-97).
  - :316 "Rung (a) has no signals zone".
- **Tools.** `lib/mcp/tools/gate.cjs` (gate_render / gate_answer). `lib/mcp/gate-ledger.cjs` (single-use, session-scoped). `lib/mcp/gate-dedup.cjs`.
- **CLI rung rulings in conflict.**
  - `lib/mcp/tools/gate.cjs:9-14`: "rung (a) is the live CLI gate path by navigator ruling (CTX 2026-09-23, 'let elicitation take over on CLI')".
  - `references/capability-radar/changelog-cache.md:26`: "the navigator's 2026-10-02 'Normal card on CLI' ruling stands".
  - `~/MindrianRooms/rethinking-mindrianos/research/2026-10-02-ui-shell-and-theo-relationship-from-a-science-session.md:22-24`: "Navigator ruling 2026-10-02: normal card on the CLI."
  - Evidence trail: `.planning/phases/267-*/267-RESEARCH.md:20,69` (Claude Code 2.1.280 declares elicitation).
- **SEED-104.** Third defect: "two cards for one decision, one of them unusable". It shows `"Research grant: Approve this research grant?: not set"`.
- **Supporting phases.**
  - Phase 178 R15 render coverage (`scripts/check-render-coverage.cjs`).
  - Phase 357 gate-triad ledger; 359 missed-fork; 360 room-bind F.8 picker; 362 card false block.
  - Phase 365 why-line on all three rungs.
  - Quicks 260819-c55 and 260903-h27.
- **Research.** `.planning/research/gamified-review-via-askuserquestion.md`, `uiux-moat-strategy.md`, `uiux-moat-survey.md`, `engagement-design-patterns.md` (2026-04-29).
- **Spike 005.** "A Cowork view where person B approves person A's gate needs an explicit hand-off action, not a shared button" (`session_mismatch`).

### (c) Data Room dashboard, wiki, graph viz, MCP Apps (sources: 22)

- **Legacy dashboards.**
  - `scripts/serve-dashboard` (static, Python http.server, ports 8420-8430).
  - `scripts/serve-dashboard-live` (Phase 87-08; port 3131 with fallback 3132-3140; direct Anthropic chat at :740; SSE `/events` at :852).
  - `dashboard/index.html` (Mondrian grid). Memory `feedback_room_dashboard_structure.md`.
- **Wiki.**
  - `lib/wiki/wiki-server.cjs`: Express, port 8421, loopback per quick 260923-lu5. Routes include /api/save, /api/sse, /api/briefing and /wiki/graph.
  - Phase 19 (dark default) was later reversed by v1.1 cream. `WIKIPEDIA-DESIGN-SPEC.md`.
  - Phase 232 Room Home: `lib/wiki/room-home.cjs`, `briefing.cjs`.
- **MCP Apps.**
  - `lib/mcp/app-views.cjs:237, :262, :291` register `ui://mindrian-os/room-dashboard|room-wiki|room-graph`.
  - They register only when `capabilities.apps` is true; `lib/mcp/surface-detect.cjs:22-26` sets cli apps:false, desktop and cowork true.
  - HTML: `lib/mcp/app-html/{dashboard,wiki,graph}.html` (ext-apps from jsdelivr, Cytoscape from cdnjs, Google Fonts).
  - Known bug: 267-RESEARCH C-12, "`app-views.cjs` `schema:` key drops all three MCP Apps input schemas" (fix queued in 267-10).
  - Orphan: `lib/mcp/app-html/mindrian-platform.html` (1841 lines, stubbed `callServerTool` at :1709-1711).
- **Unbuilt plans.** `docs/research/MCP-APPS-STRATEGIC-RESEARCH.md` (Tier 1 MCP Apps "is the product") and `.planning/milestones/v1.12.0-KICKOFF.md` (ui-adapter, Shape F as MCP Apps).
- **Graph viz.**
  - Cytoscape from CDN: `templates/constellation.html`, wiki, dashboard.
  - Canvas 2D: `lib/graph/canvas-graph.js` (Phase 29).
  - Phase 162 graph spine (PARTIAL: W3-W7 pending).
  - SEED-026: graph must build from room.db typed edges (open).
- **The wiki becomes an editor.** 2026-07-19 trail ruling: "Room Home replaces graph-as-homepage". The bhx review :19 agrees: "A graph ... is not the opening task."
- **view_compile.** `lib/mcp/tools/views.cjs:14-22`: only `wiki` compiles; dashboard, deck, insights, diagrams and graph are "not yet wired".

### (d) Presentation, export, deck, snapshot (sources: 12)

- **Generators.**
  - `scripts/generate-presentation.cjs`: 6 views, ROOM_DATA injection, marked and d3 from CDN.
  - `generate-hub.cjs`, `generate-deck.cjs`, `generate-snapshot`, `generate-lobby`, `render-pdf`.
  - `lib/presentation/presentation-server.cjs` (port 8422, SSE reload).
  - `lib/quickview/hub-server.cjs` (port 8450, POST /api/command).
- **Phases.** 25, 30, 31, 32 (BYOAPI chat), 40, 41, 48-51 (SnapshotHub), 88.7, and 175 (`/mos:deck` consolidation; VERIFICATION human_needed 8/9). `skills/mos-deck-engine/SKILL.md` is a deprecated redirect.
- **Design wiring.** Quick 260723-m5d wired every generator to `mosStyleTag()` from `lib/ui/design-system.cjs`.
- **Memory.** `project_data_room_presentation_system.md`, `project_v5_presentation_system.md` (two themes, branding "NON-NEGOTIABLE"), `project_snapshot_hub_standard.md` ("Missing piece: BYOAPI chat ... via localhost"), `project_export_design_brief.md` (AD-4 hardcode tokens; AD-13 website design system everywhere except intelligence-map.html).
- **BlockNote export.** Phase 232 added per-article PDF/DOCX via MIT pdfmake + docx, avoiding the GPL BlockNote xl-* exporters. Static `/mos:wiki --export` bundle is read-only.

### (e) Localhost workspace / browser app (sources: 11)

- **The ui-ux-pathways thesis (2026-04-16).** `.planning/research/ui-ux-pathways/INDEX.md`: "The terminal (Claude Code) is the execution engine. The browser is the control surface." `alternatives-considered.md`: "Option F: Localhost Node server inside the plugin (SELECTED)"; Electron rejected; "The browser tab IS the product." `phase-87-operational-buttons.md`: concept, never built as specified.
- **Quick 260920-bhx (2026-09-20, commit 61c0fe266).** Report `docs/reviews/2026-09-20-localhost-workspace-review.md`; disposition (:3) "ready for design review; implementation is not approved or complete".
  - :9 "Do not base the new experience on the layout, routes, chat panel, or data assumptions of `http://localhost:3131`."
  - :15 central question: "What am I trying to resolve, what do I know, and what needs my attention next?"
  - :21-27 navigation: Work / Evidence / Decisions / Deliverables / Rooms.
  - :31 session states: "Connected must mean an acknowledged live connection".
  - :52-62 nine-step journey.
  - :76-83 modes. Simultaneous control is "Not a launch promise".
  - :120 protocol objects: Workspace, Session, Task, ArtifactRevision, Decision, Event, with an expected revision, an idempotency key and a cursor.
  - :145-153 five stages, with the adapter proof first.
  - :174-177 review decisions, which await navigator approval.
- **Baseline defects of 3131.**
  - NF-01: `ROOM_DATA` stays `{}`. Still open: `templates/presentation/dashboard.html:661`.
  - NF-02: SSE triggers no refetch.
  - NF-03: mobile overflow.
  - NF-04: foreign Host accepted. Fixed in 354-08.
  - QA appendix: `.planning/debug/localhost-workspace-review.md`.
- **POC.** `docs/reviews/localhost-poc/` (port 3196; sha256 revision; 409 on stale). Reviewed in `docs/reviews/2026-09-23-deep-system-research.md:100-106` (lossy save, cross-origin write).
- **Sketch 001.** `.planning/sketches/001-mindrian-workroom-shell/` (React+Vite+@xyflow/react; variants A Living Workroom, B Spatial Room, C Larry Focus; awaiting review).
- **mindrian-workroom.** `/home/jsagi/dev/mindrian-workroom/`, plus SEED-091. Not its own git repo (unverified whether it is tracked anywhere). Source last modified 2026-07-17.
- **SEED-105 + spikes 005/006/007.** See section 6.

### (f) Website design canons v1 to v3, and their relation to the product UI (sources: 10)

- **v1 "De Stijl on paper"** (commit 79cba12, 2026-06-04): RYB primaries rationed (`#d40000`, `#ffd500`, `#0033a0`), Bebas/Inter, radius 0, the Reach motif.
- **v2** (commit e089745, 2026-10-01, D-10): cream `#f3ead8`, rust `#A63D2F`, mustard, teal; Fraunces/DM Sans.
- **v3 Workshop Modernism** (`/home/jsagi/dev/mindrian-website/docs/DESIGN-CANON.md`, D-29, 2026-10-02; source spec `docs/superpowers/specs/2026-10-01-design-canon-v3-workshop-modernism.md`).
  - :5 "radius 0, colour only as meaning, motion only as a change of state."
  - :52-71 five-square tile language plus square/circle/triangle controls; "one current circle and one next triangle per view."
  - :8 "The site must feel like the product".
  - Tile room: `docs/superpowers/specs/2026-10-02-tile-room-visual-system.md`.
- **v3 is not yet in website code.** `website/src/app/globals.css:7-8` still carries v2 tokens. The sweep is planned in `.planning/quick/261002-300-*/`.
- **Scope.** The canon is titled "M:OS Website - Design Canon". It never states that it governs the plugin or room UI. That extension comes only from the 2026-10-02 memory rule and SEED-105:100-108.
- **Product-side systems in parallel.**
  - Plugin M:OS v1.1 (`skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md`): paper `#F4F2EC`, red `#E11D22`, blue `#1E52E0`, yellow `#FFC400`, one grotesk.
  - `references/visual/palette.json` (muted `#A63D2F/#1E3A6E/#C8A43C`, used by the MCP app-html).
  - The workroom `src/app/globals.css:3-13` follows v1.1 and "supersedes the earlier port from mindrian-website's DESIGN-CANON.md".
  - Mail uses v1.1 (memory `feedback_mail_draft_design_system.md`).
- **Earlier website work.** Memory `project_website_design_review.md`, `project_website_redesign_v2.md`, `project_pws_website_session.md`; `/home/jsagi/dev/mindrian-website/docs/superpowers/specs/2026-03-22-website-redesign-design.md` (adopted V2 dark De Stijl).

### (g) Desktop / Cowork surfaces and multi-user (sources: 13)

- **Tri-Polar rule.** CLAUDE.md. Memory `feedback_three_surfaces.md`: CLI power-user, Desktop conversational, Cowork collaborative.
- **Surface rendering.**
  - `skills/ui-system/SKILL.md:438-442`: "Desktop degrades: no box chars ... Cowork matches CLI."
  - Canon :711-721 voice signature on every surface.
  - Canon :723-732: the Modality Remote "MUST remain reachable on every surface".
- **Hookless runtime.** `lib/mcp/runtime-instructions.cjs`: the Larry loop via MCP instructions, under the 2048-byte cap.
- **Transport.** Cowork HTTP at `127.0.0.1:3847/mcp` (`bin/mindrian-mcp-server.cjs:24,44`). Phase 198 D-01: "multiple clients (CLI + Desktop) attach to the same server". D-07 per-surface flag.
- **Multi-user rulings.**
  - v1.12 kickoff :475 "No cloud backend."
  - SEED-039 per-session binding (Phases 194, 225, 360 shipped).
  - Spike 005 session-owned gates.
  - SEED-091 tenant-DB open question (SQLite per tenant versus shared Postgres).
- **Workroom role.** The 2026-07-19 trail keeps the workroom "proving out the hosted/Cowork multi-user surface". Phase 232 D-11 left Desktop/Cowork unflagged.
- **Honest parity.** bhx acceptance item 8: "Desktop/Cowork must report unsupported execution honestly rather than simulate it."
- **Other.** Phase 234 foreign-host human check "NOT been attempted". SEED-065 MCP ceiling (persona and proactivity cannot ship over MCP). Research `docs/research/RESEARCH_18_COWORK_DEEP_DIVE.md`, `RESEARCH_20_COMMAND_COWORK_AUDIT.md`.

### (h) Realtime / sync (sources: 10)

- **SSE producers.** `lib/wiki/wiki-watcher.cjs`, `lib/presentation/presentation-watcher.cjs`, `scripts/serve-dashboard-live:852`, `lib/mcp/sse-event-bus.cjs`.
  - The bus's EVENT_KINDS are status-segment, gate-fired and reconcile-raised. Only status-segment is published (`lib/mcp/tools/status.cjs:179`).
  - The `/event` route exists only with the MCP-first flag on (`bin/mindrian-mcp-server.cjs:386-389`).
- **No WebSocket server anywhere** in lib, scripts or bin. `lib/wiki/wiki-chat.cjs` is a stub.
- **Seeds.**
  - SEED-073: "Filesystem/SQLite stays canonical - Yjs and RxDB are disposable, regenerable projections of it, never a second source of truth" (open).
  - SEED-105 enrichment: one-way pull, "No `pushHandler` for room data"; RxDB SQLite storage is a paid Premium plugin.
- **Spike 006** (`.planning/spikes/006-room-pull-checkpoint/results.json`, 2026-10-01): convergence passed. "P10_plugin_sse_bus: 0 frames". MANIFEST still says PENDING.
- **Prior designs.** Phase 136 D-10 (headless core over SSE, unbuilt). The bhx report proposes revisioned, cursor-resumable events.
- **Research.** The 2026-07-20 handoff (`~/MindrianRooms/rethinking-mindrianos/research/2026-07-20-collaborative-editor-and-local-first-stack-handoff/*.md:344-347`) names the markdown-versus-RxDB source-of-truth fork. V4 deferred Yjs to v4.1 (`/home/jsagi/dev/MindrianOS/.planning/phases/01-design-document/01-CONTEXT.md:78`).

### (i) Block editor, canvas, BlockNote (sources: 18)

**BlockNote finding: it exists, it shipped, and it is the most likely meaning of "the BlockNote capability we talked about".**

- **Shipped in the plugin.**
  - Phase 232 (`.planning/phases/232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc/`, 2026-07-19..20, 6/6).
  - `232-SPEC.md:9`: "`/mos:wiki` gains a BlockNote-powered editing surface (ported from the `dev/mindrian-workroom` ...".
  - `232-SPEC.md:47-48`: "BlockNote+React client-side bundle served by the existing Express server; the plugin's own runtime dependency tree gains no Next.js/React/BlockNote entries."
  - `232-UI-SPEC.md:62`: "BlockNote (`@blocknote/react`) supplies the editor primitive ONLY, themed to M:OS tokens".
  - `232-UI-SPEC.md:190`: "BlockNote ships default rounded corners, soft shadows, and its own font - all of which violate the canonical flat/rectilinear/one-grotesk laws."
  - `lib/wiki/editor-src/README.md:33`: "The three `@blocknote/*` versions are pinned EXACT (no caret) to `0.51.4`."
  - `commands/wiki.md:54`: "BlockNote editing surface with direct save-to-markdown".
  - `CHANGELOG.md:1618-1627`: "BlockNote Wiki Convergence (Phase 232): `/mos:wiki` gets a real editing surface ... zero React/Next.js/BlockNote added to the install footprint."
  - `.planning/STATE.md:8772`: "BlockNote editor walled into lib/wiki/editor-src/ with its own package.json".
- **Origin and the split.**
  - `.planning/seeds/SEED-006-mindrian-wiki-sprint-the-visible-room.md:13-14`: "the source prototype is dev/mindrian-workroom ("the blocknote test"), a BlockNote-powered editing surface Jonathan wants ported in."
  - `~/MindrianRooms/rethinking-mindrianos/research/2026-07-19-blocknote-wiki-convergence/2026-07-19-blocknote-wiki-convergence.md:39-43`: "Delivery lane: 'split by surface.' ... `dev/mindrian-workroom` is not retired - it keeps proving out the hosted/Cowork multi-user surface separately."
- **The workroom.**
  - `/home/jsagi/dev/mindrian-workroom/package.json:12-16`: `@blocknote/core|mantine|react|xl-docx-exporter|xl-pdf-exporter` ^0.51.4.
  - Files: `src/components/article-editor.tsx`, `src/lib/blocknote-theme.ts`, `src/lib/export.ts`.
  - `.planning/seeds/SEED-091-*.md:32`: "Next.js 16.2.10 + React 19.2.4 + BlockNote (core/mantine/react + xl-docx-exporter + xl-pdf-exporter)".
- **Collaboration and licences.**
  - `.planning/seeds/SEED-066-*.md:53`: "**BlockNote** -- MPL-2.0 core, **GPL-3.0** for `packages/xl-*`".
  - `.planning/seeds/SEED-072-*.md:57-58`: "BlockNote's `xl-*` export packages are GPL-3.0, not MIT (SEED-066). Phase 232 already independently avoided them".
  - `SEED-072:40`: Yjs is "BlockNote's native collaboration substrate".
  - `.planning/seeds/SEED-073-*.md:29, :34, :63`: mirror BlockNote state into RxDB; "does adopting Hocuspocus/Yjs collaboration on top of the shipped BlockNote"; "solo-mode BlockNote".
  - Quick 260721-ey5 cross-links `~/MindrianRooms/rethinking-mindrianos/research/2026-07-21-blocknote-primary-source-guide/`.
  - `2026-07-22-single-user-editor-alternatives-vs-blocknote/*.md:50`: "It already runs BlockNote in solo mode."
- **Earlier eras.**
  - `/home/jsagi/dev/MindrianOS/docs/design/03-API-INTERFACES.md:1214`: "Rooms are BOTH chat AND document. A room is a BlockNote-style editable document where chat messages insert blocks."
  - `/home/jsagi/dev/MindrianOS/.planning/phases/09-de-stijl-frontend/09-CONTEXT.md:218`: "BlockNote full document editor mode - future phase".
  - `/home/jsagi/dev/MindrianOS/.planning/research/ELECTRON_DESKTOP_REFERENCE.md:4`: "React + TanStack Router + BlockNote editor + Yjs collaboration".
  - `/home/jsagi/dev/MindrianV2/docs/pws-assessments/claims-reverse-salient-analysis.md:102-104`: BlockNote + BlockSuite Edgeless "PLANNING ONLY ... Zero implementation".
- **Not in any SEED-104..107 text.** None of the four 2026-10-02 seeds mentions BlockNote, SEED-066/072/073, or Phase 232. SEED-105's `related:` list omits them.
- **Canvas and other editors.**
  - tldraw: only in MindrianV2 (`frontend/package.json:42`, `frontend/src/components/canvas/`). Zero in the plugin.
  - xyflow / React Flow: MindrianV2 project map (`frontend/package.json:26`) and plugin sketch 001 variant B only.
  - "MOS-CANVAS" (SEED-097; `2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md`) is a research-perspectives concept, **not** a visual canvas.
  - Notion: only as the schema source in SEED-084 / Phase 275. AFFiNE and Docmost are disqualified (SEED-066).

### (j) Hooked first step and onboarding UX (sources: 10)

- **Rule.** `docs/reward-before-investment-rule.md:21`: "No flow in MindrianOS may require user input beyond one sentence before delivering its first variable reward." Phase 118 linter; fail-closed in 267.3.
- **Mandate.** Memory `feedback_hooked_model_first_steps.md` (BIRTH-FLOW Decision 8, 2026-06-12): the first step of any surface is a full Hook cycle.
- **Retired gate.** Canon :414 (Appendix D 31, Phase 180): "the Hooked ratification gate is RETIRED ... the Manipulation Matrix ... is KEPT."
- **SEED-105 constraint 4.** "Hooked model is the mandatory lens for the first screen."
- **Audits.** `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-hooked-first-install-audit/`; `2026-09-03-first-install-hooked-loop-repair/`; Phase 267.1 and 267.2 (passed); `2026-06-09-hooked-model-larryreach-loop-audit.md` (45/70).
- **Onboarding phases.** 35 (7-step walkthrough), 75, 115 dual path, 143.4 `/mos:discover`, 155/204/227 `/mos:ignite` (the front door). SEED-060 ignite timing turns 1-4 (open).
- **Larry.** Memory `feedback_larry_pedagogical_guided_first.md`: GUIDED by default; the navigator owns gates.
- **Website side.** v3 CTA contract (`DESIGN-CANON.md` section 9): banned labels Submit, Learn more, Get started.

### (k) Academy (MindrianV2) UI specs (sources: 7)

- **Stack.** `/home/jsagi/dev/MindrianV2/CLAUDE.md:45-58`: Next 14, React 18, CopilotKit 1.51 (AG-UI), React Flow, Excalidraw, tldraw.
- **Layout.** `CLAUDE.md:364-367`: 22/53/25 three panels plus a status bar.
- **Requirements.** `.planning/REQUIREMENTS.md:20-45`: MODE-01..03 (MODE-03 "2-panel layout: curriculum sidebar (30%) + Larry chat (70%)"), RUBRIC-01..04 (a live 6-bar rubric strip), TEACH-05. All marked complete.
- **Minichat spec.** `docs/superpowers/specs/2026-03-15-task-picker-minichat-design.md`: "Option A: Full-Screen Swap. Two views, one at a time". This conflicts with memory `project_academy_minichat_ui_spec.md` (Task Panel 40% + Mini Chat 60%).
- **Design law.** `.claude/rules/figma-design-system.md`: radius 0, semantic color, React Flow straight edges.
- **Lessons and status.** AFFiNE lessons in `docs/competitor-research/Mindrian_V2_What_We_Need_To_Do.md:490-508`: "same entries viewable as list, canvas, dashboard, graph, slides"; CLAIM / EVIDENCE / CHALLENGE blocks. Memory `project_mindrianv2_phase16.md`, `project_academy_v22_decomposition.md`. Local testing was blocked by a CopilotChat composer bug (memory index).

---

## 4. Rulings and hard constraints already on record

| # | Ruling (quoted) | Source |
|---|---|---|
| 1 | "This gate is the universal UX primitive ... No bespoke dialogs, no framework-specific modals." | `docs/MINDRIAN-CANON.md:205` |
| 2 | "F.0-F.9 is the closed ten-shape family ... A new sub-shape requires a canon amendment" | `docs/MINDRIAN-CANON.md:181` |
| 3 | "AskUserQuestion is the implementing primitive. The plugin does not invent a selector mechanism." | `.planning/phases/88.2-*/88.2-CONTEXT.md:19` |
| 4 | "Fire the card, never draw the box"; "No card, no picture." | `skills/ui-system/SKILL.md:96`; SEED-021 |
| 5 | "NEVER prose-prompt for confirmation. The selector IS the surface." | `.planning/research/cool-ui-style-reference.md:144` |
| 6 | "Every output has exactly 4 zones in fixed order." "NO EMOJI. EVER." "CLI is master template." | `skills/ui-system/SKILL.md:31, :332, :440` |
| 7 | "If it renders as a page, it obeys M:OS. No generator invents its own palette or typography." Inline SVG, "never a CDN". | `skills/ui-system/SKILL.md:20-26` |
| 8 | Styling "ONLY the M:OS Design Canon v3: Workshop Modernism" for the UI route; the earlier ad-hoc primary palette is superseded | SEED-105:100-108; memory `feedback_mos_ui_stack_and_v3_design_rule.md:17-19` |
| 9 | UI stack: icm-workspace-architect + websocket-engineer + RxDB (read copy) + agent-native (actions = MCP tools) | same memory :11-15; SEED-105:100-103 |
| 10 | "No second store for room state." "sync flows one way, from the room to the browser." "No `pushHandler` for room data." "Do not use RxDB as the room store." | SEED-105:32, :79, :85, :89 |
| 11 | "Yjs and RxDB are disposable, regenerable projections of it, never a second source of truth" | SEED-073 title |
| 12 | "MCP Apps is a rendering surface, NOT a storage layer." "No cloud backend. Cowork does NOT introduce a MindrianOS-hosted server for user data." | `.planning/milestones/v1.12.0-KICKOFF.md:394, :475` |
| 13 | "Do not base the new experience on ... `http://localhost:3131`"; "Make Claude adapter proof the first implementation gate"; simultaneous control is "Not a launch promise" | `docs/reviews/2026-09-20-localhost-workspace-review.md:9, :83, :176` |
| 14 | "The browser never holds provider credentials or Brain credentials." | same review, Architecture section |
| 15 | "Dashboard server ... binds 127.0.0.1 only. Explicit refusal to bind 0.0.0.0." | `.planning/phases/87-*/87-CONTEXT.md:280` |
| 16 | "Gates, the Part 8 egress guard and card enforcement must hold server-side"; "Every Brain/Theo call goes through the guarded shim." | SEED-105 constraint 3 |
| 17 | "No flow in MindrianOS may require user input beyond one sentence before delivering its first variable reward." | `docs/reward-before-investment-rule.md:21` |
| 18 | "Hooked model is the mandatory lens for the first screen."; the app is "a fourth surface on top of CLI/Desktop/Cowork, not a replacement." | SEED-105 constraints 4-5 |
| 19 | "Before building a new command, skill, agent, or hook, the builder must search the methodology surface first ... 'which existing surface does this replace or extend, and why is repointing insufficient?'" | `docs/MINDRIAN-CANON.md:256-258` (Part 7) |
| 20 | "Desktop/Cowork must report unsupported execution honestly rather than simulate it." | bhx review, acceptance item 8 |
| 21 | Statusline contract "LOCKED 2026-06-28"; co-designed with the navigator, "Two-row is a CANDIDATE, not the answer" | `docs/STATUSLINE-CONTRACT.md`; memory `feedback_121_5_statusline_co_design.md` |
| 22 | Licences: AFFiNE/Docmost disqualified; BlockNote xl-* GPL-3.0; subscription passthrough forbidden | SEED-066:53; SEED-072:57; SEED-067 |
| 23 | A gate belongs to the session that minted it; do not build a UI on stateless HTTP mode | `.planning/spikes/005-mcp-http-reach/README.md` |
| 24 | "the UI is worth sacrificing the CJS-only hard rule"; whole plugin may go TypeScript, via GSD (not a silent edit) | SEED-107:16-21; memory rule :21 |
| 25 | Every public MindrianOS HTML page carries the Clarity snippet (wmu6iasq77) | memory `feedback_clarity_on_every_page.md` |
| 26 | No em-dashes; no real names in tracked repos; all plugin dev through GSD | memory `feedback_no_emdashes.md`, `feedback_no_real_names_in_repo.md`, `feedback_gsd_owns_all_mindrianos_dev_work.md` |

---

## 5. Conflicts and contradictions

| # | Conflict | Side A | Side B | Note |
|---|---|---|---|---|
| C1 | **Palette / typography** | v3 Workshop Modernism: paper `#F5F0E6`, rust/cobalt/ochre, Fraunces/DM Sans/Bodoni (SEED-105:104; website DESIGN-CANON.md) | Shipped plugin M:OS v1.1: paper `#F4F2EC`, red `#E11D22`, blue `#1E52E0`, yellow `#FFC400`, "one grotesk" (`skills/ui-system/design-system/M-OS-DESIGN-SYSTEM.md`); also `references/visual/palette.json` muted set in MCP app-html; sketch 001 theme; workroom v1.1 | SKILL.md:20 "No generator invents its own palette" will hold two systems at once until reconciled. The workroom chose v1.1 over the website canon in July (`globals.css:3-13`), and the memory rule now reverses that. |
| C2 | **De Stijl primaries vs. meaning-only color** | v1 website and Phase 102 D-06b: HTML uses Mondrian primaries (`skills/ui-system/SKILL.md:371-392`) | v3: "colour only as meaning", ochre never text on paper | The five voice squares survive in v3 (:52-71), so the semantics carry over; only the hues change. |
| C3 | **CJS-only vs. TypeScript** | CLAUDE.md:134 (still live); SEED-105 constraint 2 "plugin stays CJS-only"; Phase 232 D-01/02 walled build; spikes CONVENTIONS "zero npm deps" | SEED-107 (same day, later): "Whole plugin may go TypeScript" | SEED-105 body was not updated after SEED-107. CLAUDE.md stays authoritative until the GSD phase lands. |
| C4 | **CLI gate rung** | `lib/mcp/tools/gate.cjs:9-14`: elicitation is the live CLI path (2026-09-23 ruling) | 2026-10-02 "Normal card on CLI" (`references/capability-radar/changelog-cache.md:26`) | Code is not updated. This is the root of SEED-104 defect 3. |
| C5 | **Room home: grid vs. task** | Memory `feedback_room_dashboard_structure.md:7` "Mondrian grid ... STANDARD"; Phase 19 graph-as-homepage | Phase 232 "Room Home replaces graph-as-homepage"; bhx review: task-centered Work tab, "graph ... is not the opening task"; v3 tile room as a front-page visual | The memory's own sunset clause ("until a new UI/UX is designed") is now triggered. |
| C6 | **Who the in-app agent is** | SEED-105: agent-native in-app agent calling MCP actions ("not Larry-with-hooks") | bhx review: "Claude Code is the execution engine", via a local Claude adapter; SEED-067 forbids subscription passthrough | Unresolved. An agent-native agent needs its own model key, which reopens cost and terms questions. |
| C7 | **Which UI codebase** | SEED-091: the workroom "is the real UI, already built" (Next.js + BlockNote) | SEED-105: a new agent-native app (separate repo); sketch 001 (React+Vite+xyflow); bhx: "Build a new browser application" | SEED-105 does not cite SEED-091's workroom code as a reuse candidate, only the auth link. |
| C8 | **Realtime choice** | SEED-105 + 2026-10-02 trail :28: SSE first, WebSockets only for multi-user | Memory rule: websocket-engineer is always in the stack | Compatible if websocket-engineer is design guidance only. Note that the SSE bus is flag-gated and emitted 0 frames in spike 006. |
| C9 | **Shape F count** | Canon :181 ten shapes | Canon :205 "five F-sub-shapes"; SKILL.md:56,84 F.0-F.7; destijl.md F.0-F.6 | Internal drift; matters for button vocabularies. |
| C10 | **No-CDN rule vs. shipped HTML** | SKILL.md:26, SPEC.md:56 "never a CDN" | MCP app-html (jsdelivr, cdnjs, Google Fonts), wiki (unpkg Cytoscape), presentation (marked, d3) | bhx flagged offline asset failure. |
| C11 | **Dark vs. cream** | Phase 19 wiki "Default: dark"; V2/V4 dark De Stijl; MCP graph.html dark tokens | v1.1 "never black"; v3 paper | Wiki is resolved to cream; the MCP app-html is not. |
| C12 | **MCP Apps as the product** | `MCP-APPS-STRATEGIC-RESEARCH.md`: "Tier 1 is the product" | SEED-105: a standalone app is the fourth surface; MCP Apps register only on Desktop/Cowork | The two can coexist, but which one gets the investment is undecided. |
| C13 | **Editing model** | Phase 232: direct unguarded save, conflict risk "explicitly accepted" | bhx: expected revision + idempotency key; SEED-105: writes only via MCP actions with gates | A BlockNote save in the new shell would have to become a governed action. |
| C14 | **BlockNote exporters licence** | SEED-066/072: xl-* GPL-3.0, avoided in the plugin | Workroom `package.json` uses `xl-docx-exporter` and `xl-pdf-exporter` | Matters only if the workroom ships commercially. |
| C15 | **Academy layout** | V2 spec: full-screen swap | Memory: 40/60 panels | Historical; resolve only if the Academy patterns are reused. |
| C16 | **Phase 232 UI-SPEC vs. disk** | `232-UI-SPEC.md:27,47`: the workroom prototype and `blocknote-theme.ts` were "removed from disk" | `/home/jsagi/dev/mindrian-workroom/src/lib/blocknote-theme.ts` exists, and SEED-091 ran the app 2026-09-07 | It was restored or moved at some point after the spec (unverified when). |

---

## 6. Reuse candidates for the SEED-105 UI (Canon Part 7)

| Need | Existing surface | Path | Caveat |
|---|---|---|---|
| Action layer (zod schemas) | MCP tools | `lib/mcp/tools/*.cjs`, `lib/mcp/tool-router.cjs` | Already zod; one-to-one with agent-native actions per SEED-105 |
| Transport | Streamable HTTP per-connection mode | `bin/mindrian-mcp-server.cjs:321, :353`; `lib/mcp/daemon-lifecycle.cjs` (port 3847 / discovered) | Spike 005: use per-connection mode, not stateless |
| Gate buttons | Superset card schema + ledger | `lib/mcp/gate-render.cjs:64-97`; `lib/mcp/gate-ledger.cjs`; `lib/mcp/tools/gate.cjs` | Add a "web button" consumer of the superset; gates are session-owned |
| Shape vocabulary for buttons | F.0-F.9 renderers' option logic | `lib/hmi/shape-f*-renderer.cjs`, `selector-dispatcher.cjs`, `docs/F-SELECTOR-CONSUMER-GUIDE.md` | Text renderers; reuse option sets, recommended-marker rules (>= 0.70), and F.8 pre-check logic |
| Push "room changed" | SSE event bus | `lib/mcp/sse-event-bus.cjs`; route `bin/mindrian-mcp-server.cjs:386-389` | Flag-gated; only status-segment publishes; gate-fired and reconcile-raised have no publisher |
| Read-copy pull | Spike 006 pull server | `.planning/spikes/006-room-pull-checkpoint/` | Results on disk; verdict not recorded in the manifest |
| Focus/selection to Larry | `context_assemble focus_node_id` | `lib/mcp/tools/context.cjs` | Named in SEED-105 |
| Session/room ownership | Binding and presence | `lib/core/session-binding.cjs`, `lib/core/session-presence.cjs`, `lib/mcp/session-room.cjs`, `lib/mcp/session-registry.cjs`, `lib/mcp/session-catchup.cjs` | bhx: evaluate unbound behavior before using as an auth boundary |
| Governed writes | `artifact_file`, `claim_write`, `graph_write`, navigation chokepoint | `lib/mcp/tools/views.cjs`, `lib/core/navigation.cjs` | The only write path |
| Room Home panel | Room home + briefing | `lib/wiki/room-home.cjs`, `lib/wiki/briefing.cjs` | Briefing uses a raw Anthropic fetch (232 D-06) |
| Article editing | BlockNote island | `lib/wiki/editor-src/` (esbuild, pinned 0.51.4), `lib/wiki/editor-dist/`, `src/wikilink-transforms.cjs`, `wikilink-spec.jsx` | Save is direct and unguarded today (C13); theme must move to v3 |
| Full Next.js UI precedent | mindrian-workroom | `/home/jsagi/dev/mindrian-workroom/src/` (room grid, room page, article-editor, export, destijl-card) | No auth or tenancy; reads the filesystem directly (violates "writes only through MCP actions") |
| Wiki pages / search / links | Page renderer, search, graph links | `lib/wiki/page-renderer.cjs`, `wiki-search.cjs`, `graph-links.cjs` | `view_compile` already wires the page renderer |
| Inline host views | MCP Apps | `lib/mcp/app-views.cjs`, `lib/mcp/app-html/` | Desktop/Cowork only; schema bug C-12 |
| Graph view | Canvas 2D graph, Cytoscape config | `lib/graph/canvas-graph.js`, `graph-detail-panel.js`, `constellation-config.cjs` | SEED-026: must build from room.db typed edges |
| Export/deliverables | Generators | `scripts/generate-presentation.cjs`, `generate-hub.cjs`, `generate-deck.cjs`; wiki `--export` | Call via adapters (bhx), do not embed old dashboards |
| Status/session indicator | Statusline cockpit | `lib/statusline/cockpit-renderer.cjs`, `docs/STATUSLINE-CONTRACT.md` | Co-design rule applies |
| Local-service security | Workspace POC | `docs/reviews/localhost-poc/server.cjs` (Host allowlist, exact Origin, token, sha256 revision, 409) | Review findings in `docs/reviews/2026-09-23-deep-system-research.md:100-106` |
| Prior mockups | Sketch 001; SEED-105 artifact; bhx mockup | `.planning/sketches/001-mindrian-workroom-shell/`; claude.ai artifact XDbDX2i2jC8CUxGWmNQdEt; `docs/reviews/localhost-workspace-mockup.html` | All predate the v3 mandate |
| Design tokens | v3 tokens CSS (spike 006 config) | `.planning/spikes/006-room-pull-checkpoint/_config/canon-v3-tokens.css` | The only v3 token file in the plugin tree |
| Do not reuse as a base | Port-3131 dashboard and BYOAPI chat | `scripts/serve-dashboard-live`, `templates/presentation/dashboard.html`, `lib/chat/chat-panel.js` | bhx :9; XSS in chat-panel (`docs/reviews/2026-09-20-full-system-code-review.md:41`) |

---

## 7. Open questions for the navigator (before any UI work)

1. **Which codebase is the UI?** Options: revive `dev/mindrian-workroom` (SEED-091, Next.js + BlockNote, already working), start a new agent-native app (SEED-105), or grow from sketch 001. SEED-105 never weighs the workroom. (Sources: C7; SEED-091; SEED-105; `.planning/sketches/MANIFEST.md`.)
2. **"The BlockNote capability we talked about": does it mean the shipped Phase 232 wiki editor, the workroom editor, or BlockNote as the main document surface of the new shell?** If it is the shell, the direct-save model (C13) must become a governed MCP action, and SEED-072/073 must join SEED-105's related list. (Sources: thread (i); SEED-072; SEED-073.)
3. **Who is the agent inside the UI?** Options: agent-native's own model loop calling MCP actions (needs an API key and its own cost model), or the bhx local Claude Code adapter (Claude Code stays the engine; adapter proof first). (Sources: C6; bhx :174-177; SEED-067.)
4. **Does v3 Workshop Modernism replace M:OS v1.1 across the plugin**, covering wiki, decks, exports, MCP app-html and mail, or only in the new UI? If only the UI, SKILL.md:20's one-system rule needs an amendment. (Sources: C1, C2, C11; SKILL.md:18-27.)
5. **Which CLI gate rung wins?** The 2026-10-02 "normal card on CLI" ruling is not in code (`gate.cjs:9-14`). Should SEED-104's fix land it before the UI spike, so the web button and the CLI card share one tested superset? (Sources: C4; SEED-104.)
6. **Do the 260920-bhx review decisions (:174-177) count as approved?** In particular the IA (Work / Evidence / Decisions / Deliverables / Rooms) and "Claude adapter proof first". SEED-105 cites bhx as its spec, but the disposition is still "ready for design review". (Sources: thread (e).)
7. **Does v3's "one decision per view" plus the five-square tile room become the product's room view,** replacing the Mondrian grid standard and Room Home? (Sources: C5; DESIGN-CANON.md :52-74; memory `feedback_room_dashboard_structure.md:7`.)
8. **TypeScript timing.** Does SEED-107's GSD phase (CLAUDE.md:134 rewrite, hook cold-start measurement) have to land before spike 007, or can the spike run in a separate repo first, as SEED-105 originally said? (Sources: C3; SEED-107 "Done when".)
9. **Where do MCP Apps stand?** Keep the three inline views as the Desktop/Cowork face and fix C-12, retire them, or rebuild them on the new UI's components (`@mcp-ui` pattern)? And what happens to the orphan `mindrian-platform.html`? (Sources: C12; thread (c).)
10. **Realtime scope for v1.** Should the SSE bus be enabled without the MCP-first flag and given publishers for gate-fired and reconcile-raised, before RxDB? Spike 006 measured 0 frames. Is Cowork multi-user (WebSockets, spike 005 hand-off action) in or out of v1? (Sources: C8; thread (h).)
11. **Desktop/Cowork.** Is the new UI CLI/localhost only, reporting unsupported execution elsewhere (bhx item 8), or must it also run hosted (SEED-091 tenant DB, "No cloud backend" v1.12 :475)? (Sources: thread (g).)
12. **Hooked first screen.** What is the one variable reward on first open (reward-before-investment rule :21)? The bhx central question and v3 "four questions at a glance" are candidates. (Sources: thread (j); SEED-105 constraint 4.)
13. **Graph.** Is the graph a secondary tab (232, bhx) or a first-class view (sketch 001 variant B, xyflow)? Does SEED-026 (typed edges from room.db) gate it? (Sources: thread (c); thread (i).)
14. **Statusline co-design.** Does the UI's session indicator fall under the statusline co-design rule? (Sources: memory `feedback_121_5_statusline_co_design.md`; bhx :31.)
