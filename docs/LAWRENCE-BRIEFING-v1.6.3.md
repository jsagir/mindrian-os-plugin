# Lawrence Briefing: MindrianOS v1.6.3 "Powerhouse"

**For:** Prof. Lawrence Aronhime (co-founder)
**From:** Jonathan Sagir
**Date:** April 1, 2026
**Status:** Shipped and live

---

## What Happened in One Session

In a single working session, MindrianOS went from v5.0 (a teaching assistant that runs one framework at a time) to v1.6.3 (a parallel-processing venture intelligence engine with cross-domain discovery, proactive Brain-driven suggestions, and an adaptive visual hub).

140 commits. 210 files changed. 43,775 new lines. 13 phases executed across 2 milestones, most running in parallel. E2E validated at 90/90 checks (100%).

Everything still runs on your PWS methodology. The 26 frameworks, the teaching voice, the grading rubric, the mode engine -- all intact. What changed is the ENGINE underneath.

---

## The Journey: v5.0 to v1.6.3

### v5.0 (Where We Were)
52 commands, 8 agents, 49 MCP tools. Students install, Larry talks, Data Room captures work in 8 sections, knowledge graph connects entries. Presentation system generates 6 views. It works. But: serial execution only, no cross-domain discovery, system waits to be asked.

### v1.6.0 Powerhouse (The Engine)
8 phases built in parallel. The transformation:

**Model Routing** -- Larry now uses the right AI model for each task. Opus (expensive, best reasoning) for teaching and grading. Sonnet (mid-tier) for structured work. Haiku (cheap, fast) for scanning. Students control this with `/mos:models`. The system auto-adapts based on venture stage: early exploration uses cheap models, investment-stage work uses Opus everywhere. Cost reduction: 60-86% with no quality loss where it matters.

**Hook Expansion** -- 6 new automated triggers wired into the intelligence pipeline. Larry never loses context during long sessions (PreCompact/PostCompact). External edits auto-detected (FileChanged). Room auto-switches when you change directories (CwdChanged). Agent results auto-filed (SubagentStop). Pipeline stages auto-tracked (TaskCompleted). The nervous system of the plugin.

**Parallel Agents** -- Three frameworks running simultaneously instead of one at a time. `/mos:act --swarm` identifies the 3 weakest sections and attacks them all at once. 45 minutes of work in 5. Also: 6 De Bono hats generated simultaneously, 8 sections graded in parallel, 3-angle research at once.

**Spectral OM-HMM** -- Mathematical measurement of integrative thinking quality. Based on Seabrook & Wiskott's Markov chain spectral theory (2022). Each sentence classified by thinking mode (analytical, integrative, descriptive, evaluative, creative). A transition matrix built. The spectral gap (second eigenvalue) measures how rapidly the student moves between modes. Fast mixing = rich cross-domain thinking. Slow mixing = stuck in one mode. This replaces the crude keyword-density measure. Now when the system finds a "breakthrough connection" between artifacts, it's validated by the quality of thinking in both artifacts, not just keyword overlap.

**Design-by-Analogy Pipeline** -- The analogy engine. 5 stages: Decompose (SAPPhIRE functional encoding), Abstract (strip domain language, map to TRIZ parameters), Search (internal KuzuDB + Brain + external web via Tavily), Transfer (build correspondence tables), Validate (stress-test structural mappings). Built on Altshuller's TRIZ (39 engineering parameters, 40 inventive principles from 2.5M patents), Chakrabarti's SAPPhIRE ontology, and Gentner's Structure-Mapping Theory. The command `/mos:find-analogies` discovers solutions from completely different industries that share the student's problem structure.

**Sentinel Intelligence** -- `/mos:scout` runs 5 automated checks: weekly room health (what changed, what stagnated), daily grant deadline monitoring, weekly competitor watch, weekly HSI recomputation (refreshes innovation connections), and state snapshots for version tracking. The Room monitors itself.

**Platform Optimization** -- Session-start restructured for prompt cache hits (faster startup). CLAUDE.md split into modular @include sections (loads only what's needed). Deep link protocol (claude-cli:// URLs for room navigation). Environment variable tuning for long sessions.

**Future-Proofing** -- Prepared for Claude Code features not yet released: KAIROS (persistent memory across sessions), Coordinator Mode (multi-agent orchestration), Daemon Mode (background processing). Room format designed to be day-one compatible when these ship. Also: formal MWP specification document (525 lines, 13 academic references) and moat mandate for the development team.

### v6.2 RoomHub + SnapshotHub (The Surface)
5 phases built in parallel. The visual layer:

**Adaptive Room Detection** -- The system reads the Room's state, section names, and entry content to classify it as venture, website, research, or general. Everything adapts: stats bar, section labels, intelligence focus, graph emphasis. A venture room gets investor-ready output. A website room gets design-system output. A research room gets academic output. Proven with 3 reference rooms: PWS website, ALIGN X Milken, demo cancer research.

**12-Thread Constellation Graph** -- Interactive knowledge graph showing all 12 relationship types with De Stijl color coding. Spectral coloring maps thinking-mode diversity to visual intensity. Surprise connections (HSI) animate with particles. Bottleneck connections pulse with innovation thesis tooltips. Analogy bridges render as dashed cross-domain lines. Toggle filters in sidebar.

**5 Showcase Views** -- Overview (adaptive hub page), Library (3-panel entry browser with search), Narrative (fullscreen slide deck), Synthesis (charts, bottleneck heat maps, surprise clusters), Blueprint (SVG architecture from graph edges).

**Generative Fabric Chat** -- A chat panel embedded in every view that queries the knowledge graph via natural language. Students ask questions about their own Room data. Graph clicks inject context into chat ("Tell me about this connection"). Uses the student's own Claude API key (BYOAPI pattern -- we never see their key).

**SnapshotHub Export** -- `/mos:snapshot` generates a standalone 7-view HTML folder. Responsive (phone to desktop). Works offline. Shared CSS with De Stijl tokens. "Built with MindrianOS" signature footer with Mondrian color bar. Version history from room snapshots.

### v1.6.3 (The Brain)
The intelligence layer that makes suggestions proactive:

**Brain Command Engine** -- Commands are now first-class nodes in the Neo4j teaching graph. Each Command node has JTBD fields (when/want/so), trigger conditions (which Room signals activate it), framework chains (what it follows), and venture-stage relevance. The Brain walks 2-3 hops to find the most relevant command for the student's current state.

**JTBD Contextual Discovery** -- Every 3-7 conversational turns, Larry surfaces one command the student hasn't tried yet. Uses the JTBD formula from your analyze-needs framework: "When [situation], you want to [motivation], so you can [outcome]." The suggestion is grounded in the student's actual Room state -- tensions, bottlenecks, gaps, convergences -- not generic feature descriptions.

**Fabric-Driven Suggestions** -- Larry queries the knowledge graph (KuzuDB) for surprising relationships the student hasn't noticed. Two entries that contradict each other. A hidden structural similarity between sections. A bottleneck where understanding lags behind ambition. Each finding maps to a specific command that addresses it.

**3-Tier Intelligence:** Brain-connected users get Level 3 (calibrated from 100+ real projects, sequence-aware, stage-matched). Room-only users get Level 2 (local graph heuristics, good but not cross-venture calibrated). No-room users get Level 1 (generic stage defaults). Brain enriches. It never gates.

**Onboarding Invitation** -- When a student asks anything about how to use MindrianOS, Larry answers first, then invites: "Want the full tour? `/mos:onboard` -- 7 steps, 3 minutes."

---

## The Academic Foundation (Beyond PWS)

Your PWS methodology is the curriculum. These researchers provide the architectural and mathematical foundation:

**Herbert Simon (1962)** -- Architecture of Complexity. Room sections ARE near-decomposable subsystems. Cross-section edges ARE weak interactions between subsystems. Innovation concentrates at these boundaries. The folder structure IS Simon's hierarchy made operational.

**Horst Rittel & Melvin Webber (1973)** -- Wicked Problems. Every venture exhibits all 10 characteristics of wicked problems. The Room manages wickedness by decomposing it into near-independent sections that can evolve without destroying each other.

**Jake Van Clief & David McDermott (2026)** -- Interpretable Context Methodology (ICM). The academic paper proving that folder structure replaces multi-agent framework orchestration. Our Room IS the architecture. No orchestration code needed.

**Philip Tetlock (2015)** -- Superforecasting. The intelligence layer IS disciplined Bayesian belief revision. Convergence = confidence growing. Contradiction = beliefs need revision. Each filing triggers cross-section scanning.

**Thomas Hughes (1983)** -- Reverse Salients. In any expanding system, some components lag behind others. HSI finds which Room sections are the reverse salients -- where the venture's understanding is weakest relative to its ambition.

**W. Ross Ashby (1956)** -- Law of Requisite Variety. A control system must have as much variety as the system it controls. 26 frameworks + parallel execution + analogy engine = requisite variety for wicked venture problems. A single methodology (Design Thinking alone, Lean Startup alone) lacks sufficient variety.

**Eddie Seabrook & Laurenz Wiskott (2022)** -- Spectral Theory of Markov Chains. Eigenvalue analysis of transition matrices applied to thinking-mode detection. The spectral gap quantifies integrative thinking quality. Fast mixing = diverse thinking. Absorbing states = shallow analysis.

**Genrich Altshuller (1999)** -- TRIZ. 39 engineering parameters and 40 inventive principles derived from 2.5 million patent abstractions. Powers the contradiction resolution in Design-by-Analogy. Domain-agnostic by design.

**Amaresh Chakrabarti** -- SAPPhIRE Model. 7-layer functional ontology (State, Action, Part, Phenomenon, Input, Real Effect, Effect) for encoding any system -- biological, engineered, or organizational -- in a form that enables cross-domain matching.

**Dedre Gentner (1983)** -- Structure-Mapping Theory. Two systems are analogous not because they look alike but because their relational structure is preserved under mapping. The mathematical foundation for why analogies from unrelated fields can solve your specific problem.

**Barbara Minto (1987)** -- Pyramid Principle. SCQA (Situation, Complication, Question, Answer) + MECE (Mutually Exclusive, Collectively Exhaustive). Per-section REASONING.md files use Minto structure with dependency tracking between sections.

**Clayton Christensen & Anthony Ulwick** -- Jobs-to-Be-Done. The core job: "Reduce the time between insight and validated decision across every dimension of the venture simultaneously." Every feature is evaluated against this job. The JTBD formula ("When/want/so") now drives Larry's contextual command suggestions.

**Frank Knight (1921)** -- Risk vs Uncertainty. Risk is calculable. Uncertainty is not. Ventures navigate uncertainty, not risk. Simon's hierarchy makes uncertainty navigable without pretending it's calculable.

**Ikujiro Nonaka (1995)** -- Knowledge Creation Theory. SECI model (Socialization, Externalization, Combination, Internalization). Using a methodology is externalization -- making tacit knowledge explicit. The Room fills with explicit artifacts. Future ventures internalize those patterns.

**Jay Forrester & Donella Meadows** -- Systems Dynamics. Reinforcing loops, balancing loops, stocks, flows, delays, leverage points. The `/mos:systems-thinking` framework teaches students to see their venture as a dynamic system.

**Edward de Bono (1985)** -- Six Thinking Hats. Multi-perspective analysis. AI personas as structured perspective lenses. Now generated in parallel.

---

## The Moat

This is the business case, Lawrence.

**What anyone can copy:**
- Our 26 methodology prompts (based on published frameworks)
- Our folder structure (markdown + JSON)
- Our command names

**What CANNOT be copied:**

1. **Your Teaching Graph (Neo4j -- 21,000+ nodes, 65,000+ relationships).** Not a catalog. A MAP of how frameworks connect, chain, and apply. Which sequences actually produced results. Which problem types respond to which frameworks. This is 30 years of your classroom encoded as data.

2. **Your Grading Intelligence.** Calibrated from 100+ real student projects. Component weights, grade distributions, feedback patterns, vision-to-execution gap detection. No synthetic benchmark can replicate this.

3. **Your Mode Engine.** The 40:30:20:10 distribution (conceptual:storytelling:problem-solving:assessment). Voice modulation patterns mapped to mode shifts. Tuned from real classroom recordings.

4. **The 7-Layer Integration.** Folder hierarchy + artifact provenance + cascade pipeline + MINTO reasoning + HSI spectral discovery + proactive intelligence loop + Brain enrichment. All operating simultaneously on every user action. Copying one layer is easy. Making all 7 work together requires understanding Simon, Rittel-Webber, Minto, Hughes, Ashby, Seabrook-Wiskott, and Altshuller simultaneously. And having the teaching data to calibrate it.

5. **The Command Engine.** Commands as first-class Brain nodes with JTBD triggers, framework chains, and venture-stage relevance. The Brain tells Larry WHAT to suggest, WHEN, and WHY -- backed by data from 100+ real ventures.

The moat formula: **Prompts can be copied. The graph that knows WHEN to use WHICH prompt, in WHAT sequence, calibrated by REAL teaching data -- that's the moat.**

Every week of operation deepens it. Every user decision (approve/reject/defer) becomes graph data. Every HSI computation refines innovation connections. Every Brain query enriches the local knowledge graph. The system compounds.

---

## The Complete Command Taxonomy (63 Commands, JTBD Framed)

Each command described as the job it gets done: **When [situation], you want to [motivation], so you can [outcome].**

### Getting Started (7 commands)

**/mos:new-project**
When you're starting a new venture and have no structure, you want a Data Room set up with the right sections, so you can start capturing insights from day one.

**/mos:onboard**
When you've just installed MindrianOS and don't know where to start, you want a guided walkthrough of what Larry can do, so you can be productive immediately.

**/mos:help**
When you're not sure which command fits your current situation, you want Larry to recommend based on your Room state, so you can pick the right tool without reading documentation.

**/mos:status**
When you want to know where your venture stands, you want a dashboard of section health, gaps, and signals, so you can decide what to work on next.

**/mos:setup**
When you want deeper intelligence from Brain, transcription, or meeting sources, you want a guided connection flow, so you can enable enrichment in one step.

**/mos:update**
When a new version is available, you want to see what changed and why it matters to you, so you can decide whether to update now.

**/mos:splash**
When you want to see the MindrianOS identity, you want the Mondrian banner displayed, so you can confirm the plugin is active and which version you're running.

### Room Management (5 commands)

**/mos:room**
When you want to browse or manage your Data Room, you want section detail and filing options, so you can navigate your venture's knowledge structure.

**/mos:rooms**
When you're working on multiple ventures simultaneously, you want to switch between Rooms without losing context, so you can maintain separate knowledge spaces.

**/mos:query**
When you have a specific question about your venture data, you want to ask the knowledge graph in plain language, so you can get answers grounded in your own filed work.

**/mos:wiki**
When you want to browse your Room as interconnected pages, you want a Wikipedia-style viewer with hyperlinks between entries, so you can explore relationships visually.

**/mos:graph**
When you want to see the raw knowledge graph, you want direct KuzuDB exploration, so you can understand the connections between your entries.

### Defining the Problem (6 commands)

**/mos:beautiful-question**
When your problem feels vague and you can't articulate it sharply, you want a provocative reframing that opens new directions, so you can move from "I have an idea" to "I have a question worth answering."

**/mos:explore-domains**
When you don't know which domain your problem lives in, you want to map the innovation landscape around your topic, so you can find where the real opportunity concentrates.

**/mos:map-unknowns**
When you suspect there are things you don't know you don't know, you want a structured inventory of your blind spots, so you can decide which unknowns to investigate first.

**/mos:diagnose**
When your venture is stuck and you can't identify why, you want a problem classification (wicked/complex/simple, defined/ill-defined), so you can pick the right analytical approach.

**/mos:root-cause**
When you're treating symptoms instead of causes, you want to trace the problem chain backward to its origin, so you can fix the source instead of patching the surface.

**/mos:build-knowledge**
When you need to deepen understanding in a specific area, you want structured knowledge building with evidence, so you can fill gaps with substance rather than assumptions.

### Understanding the Market (6 commands)

**/mos:analyze-needs**
When you don't know what job your customer hires your product to do, you want to discover the struggling moment that triggers switching behavior, so you can build something people actually hire instead of something they ignore.

**/mos:explore-trends**
When you want to know what's changing in your market, you want trend analysis showing direction and speed, so you can time your entry and position against movement.

**/mos:analyze-timing**
When you're not sure if now is the right moment to build, you want timing analysis (why now, why not before, what changed), so you can articulate urgency to investors and team.

**/mos:macro-trends**
When you need the big-picture forces shaping your market, you want PESTLE-level analysis (political, economic, social, tech, legal, environmental), so you can see tailwinds and headwinds beyond your industry.

**/mos:user-needs**
When you want to understand what your users actually go through, you want a process-level user journey analysis, so you can find friction points where your solution creates value.

**/mos:explore-futures**
When you want to prepare for multiple possible outcomes, you want scenario exploration of how your market might evolve, so you can build resilience into your strategy.

### Challenging Your Thinking (5 commands)

**/mos:challenge-assumptions**
When your Room has claims nobody has stress-tested, you want to find which assumptions are load-bearing and which are wishful thinking, so you can de-risk before investing time on a false foundation.

**/mos:validate**
When you have a thesis but no proof it holds under scrutiny, you want evidence-based validation of your core claims, so you can know what's validated versus what's hoped.

**/mos:find-bottlenecks**
When progress feels slower than it should, you want to identify what's constraining your system, so you can focus effort on the one thing that would unblock everything else.

**/mos:dominant-designs**
When you want competitive positioning, you want to map existing dominant designs and find whitespace, so you can differentiate rather than compete head-on.

**/mos:think-hats**
When you're thinking about a problem from only one angle, you want structured multi-perspective analysis (6 De Bono hats), so you can see what a data analyst, a skeptic, a creative, and an optimist would each say.

### Building Your Solution (6 commands)

**/mos:structure-argument**
When your thinking is scattered and you can't explain it clearly, you want a Minto Pyramid (governing thought + MECE supporting arguments), so you can communicate your thesis in 60 seconds.

**/mos:scenario-plan**
When you face multiple strategic paths, you want structured scenario analysis with decision criteria, so you can choose with eyes open rather than defaulting to the first option.

**/mos:analyze-systems**
When you want to understand how parts of your venture interact, you want systems decomposition showing components and interfaces, so you can build modular rather than monolithic.

**/mos:systems-thinking**
When you want to see your venture as a dynamic system, you want loop diagrams showing reinforcing and balancing forces, so you can find leverage points where small changes produce big effects.

**/mos:lean-canvas**
When you need a one-page business model, you want a Lean Canvas filled from your Room data, so you can test business model hypotheses without writing a 50-page plan.

**/mos:leadership**
When you're building a team and need to think about execution, you want leadership framework analysis, so you can match team structure to venture stage requirements.

### Evaluating Your Venture (3 commands)

**/mos:grade**
When you have content in your Room but don't know how strong it is, you want an honest assessment calibrated against 100+ real projects, so you can fix weak spots before they become deal-breakers.

**/mos:build-thesis**
When you need to articulate why this venture matters, you want a structured investment thesis built from your Room evidence, so you can make the case to investors, partners, or yourself.

**/mos:score-innovation**
When you want to know how innovative your approach actually is, you want a scored assessment on novelty, feasibility, and market fit, so you can calibrate ambition against reality.

### Intelligence + Discovery (7 commands)

**/mos:find-analogies**
When you're stuck on a problem that feels unique to your domain, you want to discover that other industries already solved the same structural conflict, so you can adapt their approach instead of inventing from scratch. Modes: `--brain` (teaching graph), `--external` (web search).

**/mos:find-connections**
When you want to know what links your work to other domains, you want cross-domain pattern discovery from the Brain, so you can see bridges you'd never think to look for.

**/mos:compare-ventures**
When you want to know who else tried something similar, you want anonymized pattern matching from 100+ real ventures, so you can learn from their sequence without repeating their mistakes.

**/mos:research**
When you need external evidence on a specific topic, you want web research cross-referenced with your Room data, so you can ground decisions in current facts rather than assumptions.

**/mos:reason**
When a Section's argument needs rigorous structure, you want Minto/MECE reasoning with dependency tracking to other Sections, so you can build bulletproof arguments with verifiable claims.

**/mos:scout**
When your Room hasn't been health-checked and deadlines are approaching, you want a full sentinel scan (health, grants, competitors, innovation connections), so you can focus on what matters without worrying about what you missed.

**/mos:radar**
When you want to know about new platform capabilities, you want a scan of what's available, so you can use features you didn't know existed.

### Meetings + People (5 commands)

**/mos:file-meeting**
When you just had a meeting and the insights are about to evaporate, you want automatic speaker identification, segment classification, and section filing, so you can turn a conversation into permanent Room intelligence.

**/mos:persona**
When you've been thinking from one angle for too many sessions, you want 6 AI expert perspectives (De Bono hats) generated from your Room data, so you can catch what a skeptic, creative, or data analyst would see. Flag: `--parallel` for simultaneous generation.

**/mos:speakers**
When you want to review who contributed what across meetings, you want speaker profiles with their key contributions and roles, so you can track stakeholder perspectives over time.

**/mos:reanalyze**
When new context changes how you interpret a past meeting, you want to re-run intelligence on existing meeting archives, so you can extract insights you missed the first time.

**/mos:visualize**
When you want rich visual diagrams of your Room data, you want generated charts and graphs, so you can communicate complex relationships visually.

### Funding + Opportunities (2 commands)

**/mos:opportunities**
When you're building something fundable but haven't explored non-dilutive money, you want grants matched to your domain, stage, and geography, so you can fund development without giving up equity.

**/mos:funding**
When you're actively pursuing funding, you want lifecycle tracking (Discovered > Researched > Applying > Submitted), so you can manage multiple applications without losing track of deadlines.

### Parallel Power (5 commands) -- NEW in v1.6.0

**/mos:act --swarm**
When three or more Sections have Blind Spots and you only have 30 minutes, you want to fill all gaps at once, so you can move to validation with a complete Room. 3 frameworks in parallel, 5 minutes instead of 45.

**/mos:persona --parallel**
When you need multiple expert perspectives and don't want to wait, you want all 6 De Bono hats generated simultaneously, so you can have the full perspective set in 2 minutes.

**/mos:grade --full**
When you have 3+ Sections and need a comprehensive assessment, you want every Section stress-tested in parallel, so you can know exactly where you rank and what to fix before pitching. 2 minutes.

**/mos:research --broad**
When you need market intelligence from multiple angles, you want academic, market, and competitor research gathered simultaneously, so you can make decisions based on comprehensive evidence.

**/mos:models**
When you're burning through tokens on routine work, you want to control which AI model handles which task, so you can keep the best reasoning for teaching while using cheaper models for scanning. Saves 60-86%.

### Autonomous + Brain (3 commands)

**/mos:act**
When you want Larry to pick the right framework for your situation, you want autonomous framework selection based on your problem type and Room state, so you can make progress without choosing the wrong tool. Flags: `--swarm` (parallel), `--chain` (sequence), `--dry-run` (preview).

**/mos:suggest-next**
When you don't know what to work on next, you want a Brain-informed recommendation based on what worked for similar ventures, so you can follow a proven path rather than guessing.

**/mos:deep-grade**
When you want your venture assessed against real student data, you want calibrated grading from the Brain's 100+ project database, so you can see your percentile ranking and exactly what separates you from the top tier.

### Export + Sharing (5 commands)

**/mos:export**
When you need to share your work in a professional format, you want generated reports (thesis, summary, due diligence, profile, meeting report), so you can communicate depth without requiring tool access.

**/mos:snapshot**
When you want to share your Room's intelligence as a living hub, you want a 7-view interactive HTML export (Overview, Library, Narrative, Synthesis, Blueprint, Constellation, Chat), so you can give anyone a browser-based window into your thinking.

**/mos:present**
When you want to generate and open the 6-view presentation, you want one command that builds and launches, so you can go from Room to shareable output in seconds.

**/mos:publish**
When you want your Data Room presentation live on the web, you want one-click Vercel deployment, so you can share a URL instead of files.

**/mos:dashboard**
When you want the interactive graph dashboard with chat, you want it opened in your browser, so you can explore your Room visually while talking to Larry.

### Infrastructure (5 commands)

**/mos:pipeline**
When you want to chain multiple frameworks where each output feeds the next, you want multi-step pipeline execution, so you can build layered analysis without manually connecting steps.

**/mos:admin**
When you need to manage Brain API keys (create, revoke, extend, usage), you want a self-teaching admin panel, so you can control access without touching the database directly. (Owner only.)

---

## What This All Adds Up To

63 commands. Every one framed as a job the student hires it to do.

The student never reads this list. They discover commands through Larry's proactive JTBD suggestions every 3-7 turns, grounded in their specific Room state. The Brain knows which command to suggest next based on what actually worked for 100+ real ventures.

The system compounds. Every filed artifact creates new graph edges. Every edge enables new suggestions. Every suggestion leads to new filings. The Room gets smarter with every interaction.

Your methodology is the soul. The Powerhouse is the engine. Together, they make every student a powerhouse of structured thinking.

---

## Complete Command Status Table (v1.6.3)

| # | Command | JTBD: "When... you want... so you can..." | Status |
|---|---------|-------------------------------------------|--------|
| 1 | `/mos:new-project` | When starting fresh, want a structured Room, so you capture insights from day one | Live |
| 2 | `/mos:onboard` | When just installed, want a guided walkthrough, so you're productive immediately | Live |
| 3 | `/mos:help` | When unsure which command fits, want Larry's recommendation, so you pick the right tool | Live |
| 4 | `/mos:status` | When checking venture health, want a dashboard of gaps and signals, so you decide what's next | Live |
| 5 | `/mos:setup` | When wanting deeper intelligence, want guided Brain/Velma connection, so you enable enrichment | Live |
| 6 | `/mos:update` | When new version exists, want JTBD-framed changelog, so you know why you should care | Live |
| 7 | `/mos:splash` | When confirming plugin is active, want the Mondrian banner, so you see version and identity | Live |
| 8 | `/mos:room` | When browsing your Data Room, want section detail and filing, so you navigate your knowledge | Live |
| 9 | `/mos:rooms` | When working multiple ventures, want to switch Rooms, so you maintain separate knowledge spaces | Live |
| 10 | `/mos:query` | When you have a specific question, want to ask the graph in plain language, so you get data-grounded answers | Live |
| 11 | `/mos:wiki` | When exploring connections, want Wikipedia-style viewer, so you browse entries as linked pages | Live |
| 12 | `/mos:graph` | When wanting raw graph access, want direct KuzuDB exploration, so you see all connections | Live |
| 13 | `/mos:beautiful-question` | When problem feels vague, want a provocative reframing, so you move from idea to question worth answering | Live |
| 14 | `/mos:explore-domains` | When unsure which domain your problem lives in, want landscape mapping, so you find where opportunity concentrates | Live |
| 15 | `/mos:map-unknowns` | When suspecting hidden blind spots, want structured inventory, so you decide which unknowns to investigate first | Live |
| 16 | `/mos:diagnose` | When venture is stuck, want problem classification, so you pick the right analytical approach | Live |
| 17 | `/mos:root-cause` | When treating symptoms not causes, want backward tracing, so you fix the source not the surface | Live |
| 18 | `/mos:build-knowledge` | When needing depth in a specific area, want structured knowledge building, so you fill gaps with substance | Live |
| 19 | `/mos:analyze-needs` | When unsure what job customers hire for, want to discover the struggling moment, so you build what people actually hire | Live |
| 20 | `/mos:explore-trends` | When wanting market direction, want trend analysis, so you time entry and position against movement | Live |
| 21 | `/mos:analyze-timing` | When unsure if now is the right moment, want timing analysis, so you articulate urgency to investors | Live |
| 22 | `/mos:macro-trends` | When needing big-picture forces, want PESTLE analysis, so you see tailwinds and headwinds | Live |
| 23 | `/mos:user-needs` | When understanding user journeys, want process-level analysis, so you find friction points | Live |
| 24 | `/mos:explore-futures` | When preparing for multiple outcomes, want scenario exploration, so you build resilience | Live |
| 25 | `/mos:challenge-assumptions` | When claims are untested, want stress-testing, so you de-risk before building on false foundations | Live |
| 26 | `/mos:validate` | When thesis lacks proof, want evidence-based validation, so you know what's validated vs hoped | Live |
| 27 | `/mos:find-bottlenecks` | When progress feels slow, want constraint identification, so you focus on the one thing that unblocks everything | Live |
| 28 | `/mos:dominant-designs` | When seeking competitive whitespace, want dominant design mapping, so you differentiate not compete | Live |
| 29 | `/mos:think-hats` | When stuck in one perspective, want 6 structured viewpoints, so you see what skeptics and creatives see | Live |
| 30 | `/mos:structure-argument` | When thinking is scattered, want Minto Pyramid, so you explain your thesis in 60 seconds | Live |
| 31 | `/mos:scenario-plan` | When facing multiple paths, want structured scenario analysis, so you choose with eyes open | Live |
| 32 | `/mos:analyze-systems` | When understanding component interactions, want systems decomposition, so you build modular not monolithic | Live |
| 33 | `/mos:systems-thinking` | When wanting to see dynamic forces, want loop diagrams, so you find leverage points | Live |
| 34 | `/mos:lean-canvas` | When needing a one-page business model, want Lean Canvas from Room data, so you test hypotheses fast | Live |
| 35 | `/mos:leadership` | When building a team, want leadership framework analysis, so you match team structure to venture stage | Live |
| 36 | `/mos:grade` | When unsure how strong your work is, want honest assessment vs 100+ real projects, so you fix before it's too late | Live |
| 37 | `/mos:build-thesis` | When articulating why this matters, want structured investment thesis, so you make the case | Live |
| 38 | `/mos:score-innovation` | When wanting innovation calibration, want scored assessment, so you calibrate ambition vs reality | Live |
| 39 | `/mos:find-analogies` | When stuck on a "unique" problem, want cross-domain structural matches, so you adapt instead of invent | Live (v1.6.0) |
| 40 | `/mos:find-connections` | When wanting cross-domain links, want Brain pattern discovery, so you see bridges you'd never think of | Live (Brain) |
| 41 | `/mos:compare-ventures` | When wanting to learn from others, want anonymized pattern matching, so you learn from their sequence | Live (Brain) |
| 42 | `/mos:research` | When needing external evidence, want web research cross-referenced with Room, so decisions use current facts | Live |
| 43 | `/mos:reason` | When a Section needs rigorous argument, want Minto/MECE with dependency tracking, so you build bulletproof claims | Live |
| 44 | `/mos:scout` | When Room hasn't been health-checked, want full sentinel scan, so nothing falls through the cracks | Live (v1.6.0) |
| 45 | `/mos:radar` | When wanting new capabilities, want platform scan, so you use features you didn't know existed | Live |
| 46 | `/mos:file-meeting` | When insights are about to evaporate, want automatic filing with speaker ID, so conversations become Room intelligence | Live |
| 47 | `/mos:persona` | When thinking from one angle too long, want 6 AI expert perspectives, so you catch what you're missing | Live |
| 48 | `/mos:persona --parallel` | When needing perspectives fast, want all 6 hats simultaneously, so you get the full set in 2 minutes | Live (v1.6.0) |
| 49 | `/mos:speakers` | When reviewing who said what, want speaker profiles, so you track stakeholder perspectives over time | Live |
| 50 | `/mos:reanalyze` | When new context changes interpretation, want re-run on past meetings, so you extract missed insights | Live |
| 51 | `/mos:visualize` | When wanting visual diagrams, want generated charts and graphs, so you communicate complex relationships visually | Live |
| 52 | `/mos:opportunities` | When haven't explored non-dilutive funding, want grants matched to domain/stage, so you fund without giving equity | Live |
| 53 | `/mos:funding` | When pursuing funding actively, want lifecycle tracking, so you manage applications without missing deadlines | Live |
| 54 | `/mos:act` | When wanting Larry to pick the right framework, want autonomous selection, so you make progress without choosing wrong | Live |
| 55 | `/mos:act --swarm` | When 3+ Sections have gaps and only 30 minutes, want all filled at once, so you move to validation complete | Live (v1.6.0) |
| 56 | `/mos:act --chain` | When needing a framework sequence, want 3-5 frameworks chained, so each output feeds the next | Live |
| 57 | `/mos:grade --full` | When needing comprehensive assessment, want all 8 Sections graded in parallel, so you see where investors push back | Live (v1.6.0) |
| 58 | `/mos:research --broad` | When needing multi-angle intelligence, want 3 parallel research agents, so decisions use comprehensive evidence | Live (v1.6.0) |
| 59 | `/mos:models` | When burning tokens on routine work, want per-agent model control, so you keep quality where it matters, cut cost elsewhere | Live (v1.6.0) |
| 60 | `/mos:suggest-next` | When unsure what to work on, want Brain-informed next step, so you follow what worked for similar ventures | Live (Brain) |
| 61 | `/mos:deep-grade` | When wanting calibrated assessment, want grading vs 100+ real projects, so you see your percentile and what separates you from top | Live (Brain) |
| 62 | `/mos:export` | When sharing work professionally, want generated reports, so you communicate depth without requiring tool access | Live |
| 63 | `/mos:snapshot` | When sharing Room intelligence, want 7-view interactive HTML hub, so anyone with a browser sees your thinking | Live (v6.2) |
| 64 | `/mos:present` | When wanting presentation generated and opened, want one command, so you go from Room to output in seconds | Live |
| 65 | `/mos:publish` | When wanting Data Room live on web, want one-click Vercel deploy, so you share a URL not files | Live |
| 66 | `/mos:dashboard` | When wanting interactive graph with chat, want browser launch, so you explore Room visually with Larry | Live |
| 67 | `/mos:pipeline` | When chaining frameworks, want multi-step execution, so each output feeds the next automatically | Live |
| 68 | `/mos:admin` | When managing Brain API keys, want create/revoke/extend panel, so you control access (owner only) | Live (Admin) |

**Status key:**
- **Live** -- fully operational in v1.6.3
- **Live (v1.6.0)** -- added in Powerhouse upgrade, operational
- **Live (v6.2)** -- added in RoomHub upgrade, operational
- **Live (Brain)** -- requires Brain API key for full capability (works without at reduced intelligence)
- **Live (Admin)** -- owner-only visibility

**Total: 68 entries (63 base commands + 5 flag variants that function as distinct capabilities)**
