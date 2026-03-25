<div align="center">
  <img src="https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg" alt="MindrianOS" width="160" />

  # MindrianOS

  **Your project becomes your co-founder.**

  Powered by PWS -- the practical innovation methodology developed by
  [Prof. Lawrence Aronhime](https://www.linkedin.com/in/lawrence-aronhime-8363894/) over 30+ years at Johns Hopkins University.
  Built by [Jonathan Sagir](https://www.linkedin.com/in/jonathansagir/).

  [![Plugin Version](https://img.shields.io/badge/plugin-v0.9.0-blue)](https://github.com/jsagir/mindrian-os-plugin)
  [![Commands](https://img.shields.io/badge/commands-45-green)](https://github.com/jsagir/mindrian-os-plugin)
  [![MCP Tools](https://img.shields.io/badge/MCP_tools-49-teal)](https://github.com/jsagir/mindrian-os-plugin)
  [![Agents](https://img.shields.io/badge/agents-7-orange)](https://github.com/jsagir/mindrian-os-plugin)
  [![Brain Nodes](https://img.shields.io/badge/brain_nodes-23K+-purple)](https://github.com/jsagir/mindrian-os-plugin)

  [Website](https://mindrianos-jsagirs-projects.vercel.app) |
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) |
  [Brain Access](https://mindrianos-jsagirs-projects.vercel.app/brain-access) |
  [Roadmap](https://mindrianos-jsagirs-projects.vercel.app/roadmap)

</div>

---

## Quick Start

```bash
# Add the marketplace (one time)
claude plugin marketplace add jsagir/mindrian-marketplace

# Install MindrianOS
claude plugin install mos@mindrian-marketplace
```

Larry starts talking. The Room starts listening. No setup required.

---

## Three Ways to Use MindrianOS

| Surface | Setup | Best For |
|---------|-------|----------|
| **Claude Code CLI** | `claude plugin install mos@mindrian-marketplace` | Full power -- hooks, scripts, Data Room, exports |
| **Claude Desktop** | One line in `claude_desktop_config.json` | Conversational -- talk to Larry, browse your room |
| **Cowork** | Same MCP config, shared `00_Context/` | Team ventures -- multi-user Data Room |

### Claude Desktop / Cowork Setup

```json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
      "env": {
        "MINDRIAN_ROOM": "/path/to/your/room"
      }
    }
  }
}
```

Restart Desktop. 6 hierarchical tools, 5 resources, 5 prompts appear. Larry works identically.

---

## What You Get

### Larry -- Your Thinking Partner

Not a chatbot. A teaching agent modeled on Prof. Aronhime's methodology:

- **Provocative** -- "You're thinking about this as a marketplace problem. What if it's actually a logistics problem?"
- **Structured** -- 26 PWS frameworks applied invisibly, earned through conversation
- **Transparent** -- shows his thinking with visual traces (problem type, chosen framework, why)
- **Honest** -- tells you what's weak in your thinking before investors do

> **Larry's Thinking**
> Problem -- Wicked (8/10 characteristics)
> Stage -- Pre-Opportunity
> Method -- Bono Six Hats *divergent exploration needed*
> Chain -- Bono -> JTBD -> Market Sizing
> *3 Brain connections - 2 cross-references*

### Data Room -- Self-Organizing Intelligence

| Section | What It Captures |
|---------|-----------------|
| problem-definition/ | The question worth answering |
| market-analysis/ | Who has this problem and how badly |
| solution-design/ | Your technical approach |
| business-model/ | How you capture value |
| competitive-analysis/ | Who else and why you're different |
| team-execution/ | Who builds this and how |
| legal-ip/ | Protection strategy |
| financial-model/ | The numbers that matter |
| opportunity-bank/ | Discovered grants and opportunities |
| funding/ | Active funding lifecycle tracking |
| personas/ | AI team perspective lenses |
| meetings/ | Meeting archives with speaker intelligence |
| team/ | Team member profiles and knowledge landscape |

### Embedded Knowledge Graph (KuzuDB LazyGraph)

Per-project graph database that grows with your venture:

```
.md files = what's INSIDE each section (intra-section context)
LazyGraph = relationships BETWEEN sections (inter-room intelligence)
```

- 5 edge types: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES
- Natural language queries: `/mos:query "What contradicts my pricing model?"`
- Auto-updates via post-write hook -- file an artifact, graph grows
- Zero server, zero setup (KuzuDB is embedded, like SQLite for graphs)

### Two-Graph Architecture

```
Brain (Neo4j, remote)              Room Graph (KuzuDB, local)
23K nodes of methodology           YOUR venture's relationships
170K+ framework connections        Grows as you file artifacts
Serves via MCP API key             Embedded, zero server

         Brain tells you HOW to think
         Room Graph tells you WHAT your data says
         Together = far more powerful than either alone
```

### Meeting Intelligence

```bash
/mos:file-meeting                    # Paste a transcript
/mos:file-meeting --file notes.txt   # Provide a file
/mos:file-meeting --audio call.mp3   # Transcribe audio (Velma)
/mos:file-meeting --latest           # Auto-fetch from Read AI
```

Larry identifies speakers (12 roles), classifies segments, files to Data Room sections with attribution, builds meeting archive (7 files), detects convergence and contradictions, tracks action items.

### Opportunity Bank + Funding Room

```bash
/mos:opportunities              # Context-driven grant discovery
/mos:funding                    # Track funding lifecycle
```

Larry reads your room data (problem domain, geography, stage) and discovers relevant grants. Confirm-first UX -- review before filing. 4-stage lifecycle: Discovered > Researched > Applying > Submitted.

### AI Team Personas (De Bono Six Hats)

```bash
/mos:persona                    # Generate 6 perspective lenses from room data
/mos:persona invoke black       # Get the Risk Assessor's take
```

| Hat | Persona | Focus |
|-----|---------|-------|
| White | Data Analyst | Facts, numbers, gaps in data |
| Red | Intuitive Advisor | Gut feelings, emotional reactions |
| Black | Risk Assessor | What could go wrong, why this fails |
| Yellow | Opportunity Scout | Benefits, value, upside potential |
| Green | Creative Strategist | Alternatives, lateral thinking |
| Blue | Process Architect | Meta-thinking, what's missing from the process |

Every output carries a "perspective lens" disclaimer. These are thinking tools, not expert advice.

### Professional Export

```bash
/mos:export thesis          # Multi-page investment thesis
/mos:export summary         # 1-2 page executive summary
/mos:export report          # Due diligence report with TOC
/mos:export profile         # Professional venture profile
/mos:export meeting-report  # Minto-structured meeting intelligence
```

De Stijl formatted PDFs generated from your Data Room content.

---

## Connect the Brain (Optional)

The Brain adds 23K nodes of teaching intelligence. Everything works without it -- Brain makes Larry smarter.

**Request access:** [mindrianos-jsagirs-projects.vercel.app/brain-access](https://mindrianos-jsagirs-projects.vercel.app/brain-access)

After approval, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mindrian-brain": {
      "url": "https://mindrian-brain.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

| Capability | Without Brain | With Brain |
|-----------|--------------|-----------|
| Larry personality | Full | Full |
| 26 methodology commands | All | All + graph-informed recommendations |
| Data Room intelligence | Keyword-based | + framework chain suggestions |
| Grading | Basic rubric | Calibrated against 100+ real projects |
| Cross-domain connections | Manual | Automatic pattern discovery |

**Brain-powered commands:** `/mos:suggest-next`, `/mos:find-connections`, `/mos:compare-ventures`, `/mos:deep-grade`, `/mos:research`

---

## All 45 Commands

### Infrastructure (always available)

| Command | Purpose |
|---------|---------|
| `/mos:new-project` | Start a new venture project |
| `/mos:help` | Larry recommends what to work on next |
| `/mos:status` | View Data Room state and venture stage |
| `/mos:room` | Manage Data Room -- view, export, launch dashboard |
| `/mos:export` | Generate professional PDFs |
| `/mos:pipeline` | Run multi-step framework chains |
| `/mos:setup` | Connect Brain, transcription, or meeting sources |
| `/mos:update` | Check for and install plugin updates |
| `/mos:radar` | Discover new platform capabilities |

### 26 PWS Methodology Commands

**Defining the Problem Space:**
`/mos:beautiful-question` | `/mos:explore-domains` | `/mos:map-unknowns` | `/mos:diagnose` | `/mos:root-cause` | `/mos:build-knowledge`

**Understanding the Market:**
`/mos:analyze-needs` | `/mos:explore-trends` | `/mos:analyze-timing` | `/mos:macro-trends` | `/mos:user-needs` | `/mos:explore-futures`

**Challenging Your Thinking:**
`/mos:challenge-assumptions` | `/mos:validate` | `/mos:find-bottlenecks` | `/mos:dominant-designs` | `/mos:think-hats`

**Building Your Solution:**
`/mos:structure-argument` | `/mos:scenario-plan` | `/mos:analyze-systems` | `/mos:systems-thinking` | `/mos:lean-canvas` | `/mos:leadership`

**Evaluating Your Venture:**
`/mos:grade` | `/mos:build-thesis` | `/mos:score-innovation`

### Intelligence + Meeting + Funding

| Command | Purpose |
|---------|---------|
| `/mos:file-meeting` | File transcript (paste, --file, --audio, --latest) |
| `/mos:opportunities` | Context-driven grant discovery |
| `/mos:funding` | Funding lifecycle tracking |
| `/mos:persona` | Generate AI team perspectives (De Bono) |
| `/mos:query` | Natural language graph queries |

### Brain-Powered (requires Brain API key)

| Command | Purpose |
|---------|---------|
| `/mos:suggest-next` | Graph-informed next step |
| `/mos:find-connections` | Cross-domain pattern discovery |
| `/mos:compare-ventures` | Find similar ventures and extract lessons |
| `/mos:deep-grade` | Calibrated assessment from 100+ real projects |
| `/mos:research` | External research with semantic cross-reference |

---

## Architecture

```
MindrianOS-Plugin/
├── .claude-plugin/plugin.json  # Plugin manifest (v0.9.0)
├── bin/
│   ├── mindrian-tools.cjs      # Shared CLI entry point
│   └── mindrian-mcp-server.cjs # MCP server (Desktop/Cowork)
├── lib/
│   ├── core/                   # Shared modules (room-ops, state-ops, graph-ops,
│   │                           #   meeting-ops, opportunity-ops, persona-ops,
│   │                           #   lazygraph-ops, section-registry)
│   ├── mcp/                    # MCP tools, resources, prompts, Larry context
│   └── parity/                 # CLI/MCP parity check (CI gate)
├── mcp-server-brain/           # Brain hosting (Express + Supabase auth)
├── commands/                   # 45 commands (/mos:*)
├── skills/                     # Auto-activated intelligence (6 skills)
├── agents/                     # 7 agents
├── hooks/                      # SessionStart, PostToolUse, PostWrite, Stop
├── scripts/                    # compute-state, build-graph, analyze-room, etc.
├── references/                 # PWS frameworks, meeting protocols, personas
├── templates/                  # PDF templates (De Stijl styled)
├── dashboard/                  # Knowledge graph viewer + chat
├── pipelines/                  # ICM stage contracts
├── tests/                      # 8 test suites, 100+ assertions
└── CLAUDE.md                   # Architecture (Simon + ICM + Wicked Problems)
```

**Three layers:**

| Layer | What | Who Owns It |
|-------|------|-------------|
| **Plugin** | Skills, commands, agents, hooks, MCP server | This repo |
| **Brain** | Neo4j 23K nodes + Pinecone 12K vectors + teaching intelligence | Hosted MCP (optional, API key) |
| **Room** | Your workspace, entries, team, meetings, graph, exports | You -- all data stays local |

---

## Milestones

### v1.0 MVP (shipped 2026-03-22)
One-command install. Larry talks immediately. 26 methodology commands. Data Room with 8 DD sections. De Stijl dashboard with knowledge graph. PDF export (thesis, summary, report, profile). Brain MCP integration. Self-update system.

### v2.0 Meeting Intelligence (shipped 2026-03-24)
Meeting filing pipeline (paste/file/audio + Velma transcription). Speaker identification with 12 roles. Team room with profiles and knowledge landscape. Cross-meeting intelligence (convergence, contradictions, action items). Three-layer knowledge graph with timeline mode. Minto meeting-report PDF.

### v3.0 MCP Platform & Intelligence Expansion (shipped 2026-03-25)
- **Phase 10:** Shared core library (`mindrian-tools.cjs` + `lib/core/` modules)
- **Phase 11:** MCP server for Desktop/Cowork (6 hierarchical tools, 5 resources, 5 prompts)
- **Phase 12:** Brain hosting on Render with Supabase-backed API key management
- **Phase 13:** Opportunity Bank + Funding Room (context-driven grants, 4-stage lifecycle)
- **Phase 14:** AI Team Personas (De Bono Six Hats from room intelligence)
- **Phase 15:** User Knowledge Graph (KuzuDB LazyGraph, NL queries, hook-driven updates)
- **UX:** `/mos:` prefix, thinking traces, visual confirmations, room-aware status line

---

## Privacy

Everything runs locally. Your Data Room is a folder on your machine. No data leaves unless you explicitly connect Brain (optional API key) or use web research.

---

## Links

- **Website**: [mindrianos-jsagirs-projects.vercel.app](https://mindrianos-jsagirs-projects.vercel.app)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Brain Access**: [Request API Key](https://mindrianos-jsagirs-projects.vercel.app/brain-access)
- **PWS LinkedIn**: [Problems Worth Solving](https://www.linkedin.com/company/problem-solving-workspace/)
- **Prof. Lawrence Aronhime**: [LinkedIn](https://www.linkedin.com/in/lawrence-aronhime-8363894/)
- **Jonathan Sagir**: [LinkedIn](https://www.linkedin.com/in/jonathansagir/)

---

<details>
<summary><strong>Theoretical Foundations</strong></summary>

| Source | Contribution to MindrianOS |
|--------|---------------------------|
| **Simon (1962)** | Architecture of Complexity -- room sections as near-decomposable subsystems |
| **Rittel & Webber (1973)** | Wicked Problems -- the Data Room manages ventures as wicked problems |
| **Van Clief & McDermott (2026)** | ICM -- folder structure as agentic architecture |
| **Tetlock (2015)** | Superforecasting -- intelligence layer as Bayesian updating |
| **Hughes (1983)** | Reverse Salients -- LazyGraph finds where venture understanding lags |
| **Knight (1921)** | Risk vs Uncertainty -- MindrianOS navigates uncertainty |
| **Ashby (1956)** | Law of Requisite Variety -- 26 frameworks match venture complexity |
| **De Bono (1985)** | Six Thinking Hats -- AI personas as structured perspective lenses |

</details>

---

## License

Proprietary. Copyright Jonathan Sagir & PWS / Mindrian.

For licensing inquiries: [mindrian.ai](https://mindrian.ai)
