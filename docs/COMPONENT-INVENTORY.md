# MindrianOS Component Inventory

> Authoritative, exhaustive list of every shipped component. Generated 2026-06-07 from the live repo.
> Counts: **91 commands + 11 skills + 9 agents + 18 hook scripts** (the `run-hook.cmd` dispatcher
> routes ~11 named sub-hooks). 5 commands are deprecated redirects.

## The four component types
- **command** - a `/mos:*` slash command (`commands/*.md`). You type it. Often a thin front-door that invokes a skill, agent, or script.
- **skill** - auto-activated context (`skills/*/SKILL.md`). Loads itself when the situation matches; governs HOW Larry behaves. Not user-invoked.
- **agent** - a subagent (`agents/*.md`) that runs in its own context for a focused job, often proactively.
- **hook** - event-driven script (`hooks/hooks.json`) firing on a lifecycle event. Never user-invoked.

---

## COMMANDS (type: command) - 91

### Methodology / frameworks (33)
- `analyze-needs` - score customer jobs by importance vs satisfaction
- `analyze-systems` - decompose a system into layers + leverage points
- `analyze-timing` - place a tech on the S-Curve timing clock
- `beautiful-question` - reframe as Why / What-if / How
- `build-knowledge` - climb Ackoff's DIKW pyramid (up + down) across the room
- `build-thesis` - the Ten-Questions investment thesis gate
- `challenge-assumptions` - Devil's Advocate stress-test
- `compare-ventures` - compare vs ventures that tried this before
- `diagnose` - classify problem type against the PWS matrix
- `dominant-designs` - Utterback-Abernathy dominant-design spotting
- `explore-domains` - IKA + Feynman domain decomposition
- `explore-futures` - TTA + Scenario + S-Curve synthesis
- `explore-trends` - push trends to extremes to surface future problems
- `find-analogies` - cross-domain analogies (SAPPhIRE + TRIZ)
- `find-bottlenecks` - lagging components via Reverse Salient
- `find-connections` - cross-domain patterns touching your work
- `lean-canvas` - the 9-box Lean Canvas in one page
- `leadership` - diagnose the leadership shape the team needs
- `macro-trends` - PEST across a domain
- `map-unknowns` - known / unknown / unknowable (Rumsfeld)
- `mullins` - Mullins 7-Domains opportunity assessment
- `persona` - Six-Hats lenses from room data
- `root-cause` - 5-Whys / Fishbone / Fault Tree
- `scenario-plan` - 2x2 scenario matrix of futures
- `score-innovation` - cross-domain innovation via HSI
- `structure-argument` - Minto + SCQA + MECE
- `systems-thinking` - feedback loops, stocks, flows
- `think-hats` - De Bono's Six Thinking Hats
- `user-needs` - needs mapped by importance vs satisfaction
- `validate` - importance-satisfaction validation
- `value-proposition` - score the value proposition against 3 gates
- `hat-briefing` - consolidate Six-Hats briefings from hat memory
- `mva-brief` - run the 30-second MVA pipeline on a venture sentence

### Grading / assessment (2)
- `grade` - grade problem-discovery quality (6 components)
- `deep-grade` - grade a venture against 100+ calibrated projects

### Orchestration / routing (8)
- `act` - Larry's best-pick methodology for the room state
- `mos` - state-aware router to the right next surface
- `pipeline` - chain a multi-step methodology pipeline
- `suggest-next` - next move from the room graph
- `operator` - show/set the conversation operator (state machine)
- `jtbd` - show/set the active job-to-be-done signal
- `models` - view/switch model-routing profiles
- `mva-option` - route the 3-option footer after an MVA brief

### Reverse Salient / Engine 1 (4)
- `rs-fetch` - full Reverse Salient discovery pipeline for a topic
- `rs-explain` - natural-language to graph entry point, Larry-voiced
- `rs-experts` - resolve the expert network via Aura Cypher
- `rs-thesis` - read the thesis from a prior RS discovery

### External intelligence / opportunities (7)
- `research` - research the web, wire findings as typed graph evidence
- `scout` - sentinel scans across the room
- `radar` - track Claude capabilities relevant to MindrianOS
- `opportunities` - discover/manage grants in the Opportunity Bank
- `funding` - track grant opportunities through their lifecycle
- `whitespace` - detect whitespace gaps in coverage
- `diagnostics` - Wave-1 algorithmic fingerprint (renaming to `fingerprint` v1.14)

### Room management (9)
- `new-project` - start a venture project + create its room
- `onboard` - guided walkthrough, build your first room
- `room` - view/launch/navigate the Data Room
- `rooms` - list / switch / archive rooms
- `status` - governing thought per section + health glyphs
- `setup` - configure optional integrations (Brain, Velma)
- `doctor` - diagnose/repair the install (drift, sentinels, UI compliance, Brain smoke)
- `organize` - *(deprecated -> `rooms organize`)*
- `heal` - *(deprecated -> `doctor --heal-room`)*

### Meetings (3)
- `file-meeting` - file a transcript into the Data Room
- `reanalyze` - re-analyze filed meetings for new patterns
- `speakers` - who spoke + their roles

### Knowledge graph / memory / reasoning (9)
- `graph` - explore the knowledge graph by asking questions
- `causal` - trace causal edges in the graph
- `memory` - inspect/operate the three memory layers
- `brain-derive` - derive BRAIN.md for section(s)
- `mos-reason` - Feynman-MINTO reasoning for a section
- `dial-memory-refresh` - refresh the Dial Memory section per room section
- `feynman-timeline-refresh` - refresh FEYNMAN.md Timeline section
- `explain-decision` - show the Navigation Engine decision trace for the last turn
- `query` - *(deprecated -> `graph`)*

### Output / export / presentation (9)
- `dashboard` - open the Data Room dashboard (Mondrian grid)
- `present` - generate the 6-view presentation
- `publish` - publish the presentation to Vercel
- `export` - export a room view to De Stijl HTML
- `snapshot` - package a shareable room snapshot
- `vault` - export the room as an Obsidian vault
- `wiki` - the Data Room wiki of sections
- `splash` - the Mondrian banner
- `visualize` - *(deprecated -> `dashboard --mermaid`)*

### System / admin / meta (7)
- `admin` - manage Brain API keys
- `update` - check for + install MindrianOS updates
- `help` - selector-menu help (4 lanes as question-tabs)
- `auto-explore` - manually trigger auto-explore (Desktop fallback for the hook)
- `dogfood-flush` - drain the dog-food queue into the mindrian room
- `scheduled-tasks` - define Cowork scheduled tasks
- `hmi-status` - *(deprecated -> `doctor --ui-compliance`)*

**Deprecated redirects (5):** `organize`, `heal`, `query`, `visualize`, `hmi-status` (removal v1.14.0).

---

## SKILLS (type: skill - auto-activated) - 11
- `larry-personality` - Larry's dual-mode conversation engine + Ask-Tell dial; the core voice; freezes the 5 reach_ids + 3 postures
- `conversation-mode` - behavior for no-room sessions (Just Talk / Explore+Capture / Build a Room)
- `context-engine` - session context + USER.md memory + context-aware greetings
- `pws-methodology` - framework routing/awareness; which method fits; resolver discipline
- `room-passive` - Data Room awareness + filing intelligence (active when room/ exists)
- `room-proactive` - surfaces gaps, contradictions, convergence
- `brain-connector` - Brain enrichment (passive weave + proactive contradictions)
- `mva-pipeline` - auto-fires the 30-second MVA brief on a venture sentence
- `mullins-scaffold` - scaffolds a room around the Mullins 7 Domains
- `mos-deck-engine` - the in-product Feynman 6-stage deck engine (twin of the feynman-engine skill)
- `ui-system` - the CLI UI Ruling System (4-zone anatomy, glyphs, body shapes); the surface resolver

---

## AGENTS (type: agent - subagents) - 9
- `larry-extended` - Larry as a full subagent for venture conversations + room reasoning
- `framework-runner` - runs one /mos:* methodology in isolation, files the artifact
- `brain-query` - natural-language to Cypher against the Brain; never exposes raw data
- `research` - Tavily + Brain cross-referenced external intelligence with provenance
- `grading` - PROACTIVELY grades artifacts vs calibrated projects
- `investor` - PROACTIVELY raises investor objections near a pitch/gate (adversarial)
- `opportunity-scanner` - PROACTIVELY scans grants when room signals match
- `persona-analyst` - De Bono hats / multi-perspective / tension-map views
- `reverse-salient-agent` - surfaces reverse-salient findings as Decision Gates (Engine 1) *(Wave-2 body is a STUB - built in Phase 144)*

---

## HOOKS (type: hook - event-driven) - 18 scripts + the run-hook.cmd dispatcher

### Standalone hook scripts (18, in hooks/)
- `sessionstart-coordinator.cjs` (SessionStart) - orchestrates session-start surfaces
- `sessionstart-npm-reconcile.cjs` (SessionStart) - reconcile npm/install version
- `sessionstart-post-update-preflight.cjs` (SessionStart) - post-update preflight check
- `check-pending-breakthrough.cjs` (SessionStart) - surface a pending breakthrough (SENS-07)
- `mva-detect.cjs` (UserPromptSubmit) - classify a venture sentence -> MVA brief
- `brain-derivation-drain.cjs` (UserPromptSubmit) - drain the BRAIN.md derivation queue
- `operator-update.cjs` (UserPromptSubmit + Stop) - update the conversation operator state
- `jtbd-update.cjs` (UserPromptSubmit + Stop) - update the active JTBD signal (SENS-05)
- `auto-explore-drain.cjs` (UserPromptSubmit) - drain queued auto-explore (SENS-01)
- `auto-explore-fingerprint.cjs` (PostToolUse) - first-material fingerprint -> auto-explore (SENS-01)
- `frontmatter-schema-validator.cjs` (PostToolUse) - validate artifact frontmatter
- `async-artifact-auto-commit.cjs` (PostToolUse) - auto-commit to data-room branch
- `memory-completion-detector.cjs` (PostToolUse) - detect memory-completion events
- `query-efficiency-telemetry.cjs` (PostToolUse) - LOCAL query-efficiency telemetry
- `brain-response-sanitize-hook.cjs` (PostToolUse) - Part-8 PII redaction on Brain egress
- `telemetry-command-invocation.cjs` (PostToolUse) - LOCAL command-invocation telemetry
- `hmi-compliance-poll.cjs` (Stop) - UI ruling-system compliance poll
- `run-hook.cmd` - the dispatcher (see sub-hooks below)

### run-hook.cmd sub-hooks (~11, named routes)
- `write-scope-check` (PreToolUse) - active-room write guard
- `post-write` (PostToolUse) - cross-relationship cascade scan (SENS-06)
- `intent-classifier` (UserPromptSubmit) - navigation intent classification
- `session-start` (SessionStart) - workspace guard + room analyze
- `on-stop` (Stop) - session snapshot
- `on-agent-complete` (SubagentStop) - post-subagent cascade
- `on-task-complete` (TaskCompleted) - task-complete handling
- `on-file-changed` (FileChanged) - room re-analysis on file change
- `on-cwd-changed` (CwdChanged) - cwd guard
- `pre-compact` (PreCompact) - memory handoff before compaction
- `post-compact` (PostCompact) - memory re-injection after compaction

---

## Totals
| Type | Count |
|---|---|
| Commands | 91 (5 deprecated) |
| Skills | 11 |
| Agents | 9 |
| Hook scripts | 18 (+ ~11 run-hook.cmd sub-hooks) |
| **Distinct components** | **~140** |

See `.planning/research/LARRYREACH-CONNECTOR-AUDIT.md` for which of these need connector frontmatter to join the 143.3 spine.
