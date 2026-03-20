# Phase 1: Install and Larry Talks - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Zero-config plugin install: user runs one command and Larry responds immediately with his teaching personality. Data Room initializes with project-aware sections. Hooks manage state computation and session continuity. Plugin works across CLI, Desktop, and Cowork. Build the full-power version first — free/paid tier split is deferred.

</domain>

<decisions>
## Implementation Decisions

### Room Initialization
- Rooms are per-project (not per-user). Each new project gets its own Data Room via `/mindrian-os:new-project`
- The 8 base sections are a starting template, not fixed. Structure follows ICM nested folder tree — rooms are like sub-agent contexts with sub-sub-agents
- Base room sections should be informed by **real due diligence data room standards** — researcher must investigate DD structure to ensure investor alignment
- Generic parent room names (problem-definition, market-analysis, etc.) with context-specific sub-room names (team/advisors, legal/ndas)
- Folder structure supports arbitrary nesting depth from day one, even though Larry doesn't suggest sub-rooms in Phase 1
- Each room gets a **ROOM.md** (ICM Layer 0 identity) — starts minimal (purpose + starter questions), evolves as methodologies interact with it
- Room routing: methodologies have default target rooms, but Larry can override based on content analysis and ROOM.md rules
- Empty rooms show **starter questions** — 2-3 seed questions that the relevant methodology would answer
- One project per workspace in Phase 1

### Room State (STATE.md)
- STATE.md is **computed from filesystem truth** via hook scripts, not maintained incrementally by Claude
- Rich state with all metadata: entry summaries, methodology provenance, gap analysis per room, room connections map
- Connections tracked as cross-references between rooms (e.g., team/advisors → legal/agreements)
- Brain has 9 DataRoomSections in graph (including research_angles, literary_analysis beyond base 8) — room structure should accommodate these

### Room Management Commands
- `/mindrian-os:new-project` — Larry does a **deep exploration** (5-10 min conversation) about the venture, then creates rooms tailored to what was shared
- `/mindrian-os:room view` — Room overview with completeness, recent activity, gaps
- `/mindrian-os:room add` — Add custom room or sub-room manually
- `/mindrian-os:room export` — **Structured folder export** (clean copy of room tree without internal metadata)
- Data Room is DD-aligned from start — base rooms work for building AND align with due diligence expectations

### Larry Personality
- **Understated and curious**: "I'm Larry. What are you working on?" — named casually, no biography
- Core Larry DNA: **the challenge** — pushes back on weak thinking, asks for evidence, doesn't validate lazy reasoning. "Grade on thinking, not polish."
- All 4 V2 voice aspects from day one: storytelling, challenging, mode switching, lexicon/terminology
- Phase 1 mode engine: **Larry's natural judgment** — no formula. Phase 4 Brain provides calibration data for tuned 40:30:20:10 distribution
- **Contextual boundaries**: Larry is always methodology-aware. Inside a project/room he's focused on innovation. Outside, he helps with anything but brings innovation perspective. No hard walls.
- When user asks random (non-methodology) questions: **helps + nudges** — answers but may add "By the way, if this is for your venture, we could use Domain Explorer to map this space systematically."
- **USER.md** — separate user context file in the room captures user-specific context (name, background, learning style) that Larry references across sessions
- **Context-aware return greeting**: Larry references where they left off, gaps remaining, suggested next action

### Larry Porting Strategy
- **Direct port** of all 8 V2 Larry files (STYLE_GUIDE, MODE_CALIBRATION, INSIGHT_MODE, INVESTIGATIVE_MODE, LEXICON, FRAMEWORK_CHAINS, SKILL, SYSTEM_PROMPT_V2) into Claude Code equivalents
- Researcher must examine **V2, V3, and V4** of Mindrian to determine best file structure (merge, split, or match)
- AssessmentPhilosophy from Brain: "If the student hasn't made me feel uneasy or surprised, they haven't gone far enough" — this IS Larry

### Plugin Discoverability
- `/mindrian-os:help` — **Larry recommends** 2-3 relevant commands based on current room state. Full list via `/help --all`
- `/mindrian-os:status` — shows: room overview, venture stage, suggested next action (no tier info for now — build full version first)
- Command names are **action-oriented** — derived from Brain bot descriptions (e.g., "Trend exploration" → `/mindrian-os:explore-trends`)
- **Progressive disclosure** by VentureStage — start showing only 5-6 core commands, more appear as user progresses
- **Larry infers + confirms** venture stage from room state: "Looks like you have a clear problem. Ready to design solutions?"
- Full command list: researcher must examine V4 Claude Desktop project specs + V2 prompts + Brain bots to build the definitive list (Brain has 15 bots, V2 has 25 prompts, V4 has 16 project specs — researcher reconciles)

### Brain Integration Architecture
- Brain behavior when connected: **subtly richer** — Larry doesn't announce Brain, suggestions are just better
- **Gentle awareness**: Larry occasionally mentions what Brain would add. Not pushy, transparent.
- Brain fallback: **silent fallback + status indicator** — Larry uses references/ without mentioning it. /status shows Brain connection state.
- Phase 1 must create **Brain-ready interfaces** — define the interfaces/hooks where Brain will plug in. Phase 1 uses static references through those same interfaces.

### References Organization
- Organized by **ICM layer**: references/layer-2/ (stage contracts), references/layer-3/ (framework definitions)
- **Skill loads routing index**: larry-personality skill loads a lightweight index of all references (names + one-liners). Full content loads on demand per command.
- Build full-power version first. Free/paid tier split decided after full functionality is proven.

### Brain Delta (for when tier split happens)
- Contextual chaining (Brain knows YOUR room state and recommends perfect next framework)
- Calibrated grading (100+ real projects vs generic rubric)
- Cross-project patterns (anonymized patterns across all users)

### Claude's Discretion
- Larry agent file size — balance personality vs context budget
- Room privacy handling for sensitive sections (legal, financial)
- Exact hook implementation details (SessionStart, PostToolUse, Stop)
- Context budget optimization — which skills auto-load vs on-demand

</decisions>

<specifics>
## Specific Ideas

- Rooms follow ICM paper (2603.16021v2) nested folder tree — a room is like a sub-agent with sub-sub-agents
- Team room example: includes people + advisory team as sub-room, connected to legal room's NDA agreements sub-folder
- Brain AssessmentPhilosophy: "Grade on thinking, not polish. I don't care if the slide looks pretty." — Larry's core identity
- Brain's VentureStage routing (Pre-Opportunity → Lawrence + Trending to the Absurd + Scenario Analysis + Beautiful Question) should inform progressive disclosure
- Brain has FEEDS_INTO and TRANSFORMS_OUTPUT_TO relationships — these become pipeline chaining rules
- 4 CognitiveModeStates in Brain (analytical, breakthrough, operational, synthesis) plus 8 specialized states — these inform Larry's mode engine

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `settings.json` already sets `"agent": "larry-extended"` — default agent configured
- Empty directory scaffolding exists: commands/, skills/, agents/, hooks/, pipelines/, references/, scripts/
- `skills/` has 6 subdirectories pre-created: connector-awareness, context-engine, larry-personality, pws-methodology, room-passive, room-proactive
- `references/` has 3 subdirectories: methodology, personality, tools
- V2 Larry source: 8 files in `MindrianV2/prompts/larry_skill/` (STYLE_GUIDE, MODE_CALIBRATION, INSIGHT_MODE, INVESTIGATIVE_MODE, LEXICON, FRAMEWORK_CHAINS, SKILL, SYSTEM_PROMPT_V2)
- `docs/THE-BRAIN.md` — full Brain MCP tool specs and architecture
- `docs/ARCHITECTURE-DEEP-DIVE.md` — architecture reference
- `docs/IDEA-DOCUMENT.md` — complete idea document

### Established Patterns
- ICM (Interpretable Context Methodology) — folder structure IS orchestration
- GSD state management — STATE.md pattern from ~/.claude/get-shit-done/
- Plugin conventions from superpowers and elevenlabs plugins (verified by research)

### Integration Points
- Brain Neo4j Aura at brain.mindrian.ai — MCP server (Phase 4, but interfaces designed in Phase 1)
- V4 MindrianOS at /home/jsagi/MindrianOS/ — 16 Claude Desktop project specs for methodology definitions
- V2 MindrianV2 at /home/jsagi/MindrianV2/ — 25 prompts, mode engine, intelligence pipeline
- V3 MindrianV3 at /home/jsagi/MindrianV3/ — additional Larry evolution

### Source Material Locations
- V2 prompts: `/home/jsagi/MindrianV2/prompts/`
- V2 Larry skill: `/home/jsagi/MindrianV2/prompts/larry_skill/`
- V4 research: `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/` (16 Claude Desktop project specs)
- V4 design docs: `/home/jsagi/MindrianOS/docs/design/`

</code_context>

<deferred>
## Deferred Ideas

- Sub-room suggestions by Larry (Phase 3+ — HIER-01/02/03 in v2 requirements). Phase 1 supports nesting structurally but Larry doesn't suggest sub-rooms yet.
- Free/paid tier split — build full-power version first, decide split after. Captured as Brain Delta decisions above.
- The 9th DataRoomSection "research_angles" and "literary_analysis" from Brain — consider adding to base template or as auto-suggested rooms.
- Cross-user intelligence (Brain flywheel) — design for it, implement much later.

</deferred>

---

*Phase: 01-install-and-larry-talks*
*Context gathered: 2026-03-20*
