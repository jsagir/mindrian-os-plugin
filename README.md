<div align="center">
  <img src="https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg" alt="MindrianOS" width="160" />

  # MindrianOS

  **Your project becomes your co-founder.**

  Powered by PWS -- the practical innovation methodology developed by
  [Prof. Lawrence Aronhime](https://www.linkedin.com/in/lawrence-aronhime-8363894/) over 30+ years at Johns Hopkins University.
  Built by [Jonathan Sagir](https://www.linkedin.com/in/jonathansagir/).

  [![Plugin Version](https://img.shields.io/badge/plugin-v0.5.0-blue)](https://github.com/jsagir/mindrian-os-plugin)
  [![Commands](https://img.shields.io/badge/commands-41-green)](https://github.com/jsagir/mindrian-os-plugin)
  [![Frameworks](https://img.shields.io/badge/PWS_frameworks-26-orange)](https://github.com/jsagir/mindrian-os-plugin)
  [![Brain Nodes](https://img.shields.io/badge/brain_nodes-23K+-purple)](https://github.com/jsagir/mindrian-os-plugin)

</div>

---

## Quick Start

```bash
# Add the MindrianOS marketplace (one time)
claude plugin marketplace add jsagir/mindrian-marketplace

# Install the plugin
claude plugin install mindrian-os@mindrian-marketplace
```

Larry starts talking. The Room starts listening. No setup required.

---

## What Is MindrianOS?

A Claude Code plugin built on **PWS (Problems Worth Solving)** -- the practical innovation methodology that turns undefined problems into fundable ventures.

Most AI tools give you answers. MindrianOS gives you a thinking partner. Larry doesn't dump frameworks. He listens, reframes, challenges, and guides you through a structured methodology developed over three decades of teaching entrepreneurs, engineers, and innovators how to navigate complex, undefined problems.

---

## PWS Inside MindrianOS

PWS is the building blocks. MindrianOS is the operating system that runs them.

**5 Venture Stages. 26 framework commands. One intelligent progression.**

| Stage | What You're Doing | PWS Frameworks |
|-------|------------------|----------------|
| **Pre-Opportunity** | Still looking for problems | Scenario Analysis, Beautiful Question, Trending to the Absurd |
| **Opportunity Identified** | Found a problem, understanding it deeply | JTBD, Nested Hierarchies, Domain Explorer |
| **Problem Validated** | Confirmed the problem is real and worth solving | Root Cause, Systems Thinking, Red Team |
| **Solution Designed** | Building and testing solutions | Lean Canvas, Minto, HSI Cross-Domain Scoring |
| **Investment Ready** | Preparing for funding | Investment Thesis, Deep Grade, Scenario Plan |

Larry knows which stage you're in and which framework you need before you do.

---

## Start Working

Just talk:

```
> I have an idea for a platform that connects local farmers with urban restaurants...
```

Larry responds. Your Data Room starts building. No setup required.

Or start with structure:

```
/mos:new-project
```

---

## What You Get

### Larry

A thinking partner, not a chatbot. Modeled on Prof. Aronhime's teaching methodology:

- **Provocative** -- "You're thinking about this as a marketplace problem. What if it's actually a logistics problem?"
- **Structured** -- 26 PWS frameworks applied invisibly, earned through conversation
- **Adaptive** -- mode engine shifts between conceptual, storytelling, problem-solving, and assessment
- **Honest** -- tells you what's weak in your thinking before investors do

### Data Room

Self-organizing workspace that builds automatically as you work:

| Section | What It Captures |
|---------|-----------------|
| Problem Definition | The question worth answering |
| Market Analysis | Who has this problem and how badly |
| Solution Design | Your technical approach |
| Business Model | How you capture value |
| Competitive Analysis | Who else and why you're different |
| Team & Execution | Who builds this and how |
| Legal & IP | Protection strategy |
| Financial Model | The numbers that matter |

Every artifact Larry helps you create gets filed automatically with provenance metadata -- which framework produced it, when, and why.

### Meeting Intelligence (v2.0)

```
Paste transcript / provide file / provide audio
    -> Larry identifies speakers (12 roles, auto-profiles)
    -> Classifies segments (insight, decision, action-item...)
    -> Files to Data Room sections with attribution
    -> Builds meeting archive (7-file package)
    -> Detects convergence and contradictions across meetings
    -> Tracks action items across meeting history
    -> Updates knowledge graph with meeting/speaker/concept nodes
```

### Team Room

Living team directory that evolves with your venture:
- ICM nested folder profiles for every team member, mentor, advisor
- Role-gap analysis: which perspectives are missing
- Knowledge landscape: who knows what, where expertise concentrates
- Cross-meeting patterns: recurring concerns, influence shifts

### MCP Server (v3.0)

Full MindrianOS on Claude Desktop and Cowork — no CLI required:

```json
// Add to claude_desktop_config.json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"]
    }
  }
}
```

- 6 hierarchical MCP tools route all 41 commands (~4,500 tokens vs 30-60K flat)
- 5 MCP Resources for read-only room browsing (`room://` URI scheme)
- 5 MCP Prompts with Larry personality injection
- CLI/MCP parity: every command works on every surface

### Brain Hosting (v3.0)

Self-hosted Brain MCP server for paid tier:

```bash
cd mcp-server-brain && npm install && npm start
# Or deploy to Render with render.yaml (one click)
```

- 5 Brain tools (3 Neo4j graph + 2 Pinecone semantic) behind API key auth
- Users get API key → connect Brain from any surface
- Single consolidated Pinecone index (`pws-brain`) with 12K+ records

### Knowledge Graph

Three-layer interactive graph (Structure / Content / Intelligence):
- Meeting, speaker, and concept nodes with [[wikilink]] connections
- Timeline mode with chronological meeting layout
- Layer toggles and preset views (Room, Meetings, Team, Intel)
- Edge animations: REINFORCES pulses green, CONTRADICTS pulses red

### Professional Export

```
/mos:export thesis          # Multi-page investment thesis
/mos:export summary         # 1-2 page executive summary
/mos:export report          # Due diligence report with TOC
/mos:export profile         # Professional venture profile
/mos:export meeting-report  # Minto-structured meeting intelligence
```

De Stijl formatted PDFs generated directly from your Data Room content.

---

## How to Use MindrianOS

MindrianOS runs on all three Claude surfaces:

| Surface | Strengths | Best For |
|---------|----------|----------|
| **Claude Code** | Full power. Hooks fire, scripts execute, Data Room updates in real-time. | Daily venture work, meeting filing, exports |
| **Claude Desktop** | Full MCP access. 6 tools, 5 resources, 5 prompts. Larry's personality shines. | Exploration, brainstorming, methodology sessions |
| **Cowork** | Multi-user MCP. Shared Data Room through 00_Context/. | Team ventures, collaborative sessions |

---

## 41 Commands

### Infrastructure

| Command | Purpose |
|---------|---------|
| `new-project` | Start a new venture project |
| `help` | Larry recommends what to work on next |
| `status` | View Data Room state and venture stage |
| `room` | Manage Data Room -- view, export, launch dashboard |
| `export` | Generate professional PDFs |
| `pipeline` | Run multi-step framework chains |
| `setup` | Connect Brain, transcription, or meeting sources |
| `update` | Check for and install plugin updates |
| `radar` | Discover new platform capabilities |

### 26 PWS Methodology Commands

**Defining the Problem Space:**
`beautiful-question` | `explore-domains` | `map-unknowns` | `diagnose` | `root-cause` | `build-knowledge`

**Understanding the Market:**
`analyze-needs` | `explore-trends` | `analyze-timing` | `macro-trends` | `user-needs` | `explore-futures`

**Challenging Your Thinking:**
`challenge-assumptions` | `validate` | `find-bottlenecks` | `dominant-designs` | `think-hats`

**Building Your Solution:**
`structure-argument` | `scenario-plan` | `analyze-systems` | `systems-thinking` | `lean-canvas` | `leadership`

**Evaluating Your Venture:**
`grade` | `build-thesis` | `score-innovation`

### Meeting Intelligence

| Command | Purpose |
|---------|---------|
| `file-meeting` | File transcript (paste, --file, --audio, --latest) |

### Brain-Powered (Optional)

| Command | Purpose |
|---------|---------|
| `suggest-next` | Graph-informed next step |
| `find-connections` | Cross-domain pattern discovery |
| `compare-ventures` | Find similar ventures and extract lessons |
| `deep-grade` | Calibrated assessment from 100+ real projects |
| `research` | External research with semantic cross-reference |

---

## Architecture

```
MindrianOS-Plugin/
├── .claude-plugin/plugin.json  # Plugin manifest (v0.5.0)
├── bin/
│   ├── mindrian-tools.cjs      # CLI entry point (4 subcommand groups)
│   └── mindrian-mcp-server.cjs # MCP server (stdio transport)
├── lib/core/                   # Shared modules (CLI + MCP use the same code)
│   ├── room-ops.js             # Room CRUD operations
│   ├── state-ops.js            # State computation
│   ├── meeting-ops.js          # Meeting intelligence
│   ├── graph-ops.js            # Knowledge graph builder
│   └── section-registry.js     # Dynamic section discovery
├── mcp-server-brain/           # Standalone Brain hosting (Express + StreamableHTTP)
├── commands/                   # 41 commands (/mos:*)
├── skills/                     # Auto-activated intelligence (6 skills)
├── agents/                     # Larry, Brain, Grading, Research, Investor
├── hooks/                      # SessionStart, PostToolUse, Stop
├── scripts/                    # compute-state, build-graph, render-pdf, etc.
├── references/                 # PWS framework definitions + meeting protocols
├── templates/                  # PDF templates (De Stijl styled)
├── dashboard/                  # Knowledge graph viewer + chat
├── pipelines/                  # ICM stage contracts
└── CLAUDE.md                   # Architecture guide
```

Three layers:

| Layer | What | Who Owns It |
|-------|------|-------------|
| **Plugin** | Skills, commands, agents, hooks, PWS frameworks, MCP server | This repo (marketplace) |
| **Brain** | Neo4j 23K nodes + Pinecone 12K embeddings + teaching intelligence | Self-hosted MCP or Brain API key (optional) |
| **Room** | Your workspace, entries, team, meetings, exports | You -- all data stays local |

---

## Optional: Connect Brain

For deeper intelligence powered by a 23K-node knowledge graph:

```
/mos:setup brain
```

Brain adds: framework recommendations from similar ventures, calibrated grading from 100+ real projects, cross-domain pattern discovery, contradiction detection powered by semantic analysis.

Everything degrades gracefully. Brain makes Larry smarter; Larry works fine without it.

---

## Roadmap

| Version | Milestone | Status |
|---------|-----------|--------|
| v1.0 | MVP — 41 commands, Data Room, Dashboard | Shipped 2026-03-22 |
| v2.0 | Meeting Intelligence — filing, team room, cross-meeting intel | Shipped 2026-03-24 |
| v3.0 | MCP Platform — dual delivery, Brain hosting | Shipped 2026-03-25 |
| v3.1 | Opportunity Bank + Funding Room — grant discovery, funding lifecycle | Planned |
| v3.2 | AI Team Personas — domain expert perspectives, Six Hats integration | Planned |
| v3.3 | User Knowledge Graph — KuzuDB embedded graph, natural language queries | Planned |

---

## Privacy

Everything runs locally. Your Data Room is a folder on your machine. No data leaves your computer unless you explicitly connect Brain (optional) or use web research.

---

## Links

- **Website**: [mindrianos-jsagirs-projects.vercel.app](https://mindrianos-jsagirs-projects.vercel.app)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Prof. Lawrence Aronhime**: [LinkedIn](https://www.linkedin.com/in/lawrence-aronhime-8363894/) -- PWS methodology inventor
- **Jonathan Sagir**: [LinkedIn](https://www.linkedin.com/in/jonathansagir/) -- MindrianOS developer
- **PWS LinkedIn**: [Problems Worth Solving](https://www.linkedin.com/company/problem-solving-workspace/)

---

<details>
<summary><strong>Theoretical References</strong></summary>

MindrianOS and PWS are grounded in established research:

| Source | Contribution |
|--------|-------------|
| Simon (1962) | Architecture of Complexity -- near-decomposable hierarchies (the room structure) |
| Rittel & Webber (1973) | Wicked Problems -- ventures as wicked problems (the Data Room manages them) |
| Van Clief & McDermott (2026) | ICM -- folder structure as agentic architecture |
| Tetlock (2015) | Superforecasting -- intelligence layer as Bayesian updating |
| Hughes (1983) | Reverse Salients -- finding where venture understanding lags |
| Knight (1921) | Risk vs Uncertainty -- MindrianOS navigates uncertainty |
| Ashby (1956) | Law of Requisite Variety -- tools must match system complexity |

</details>

---

## License

Proprietary. Copyright Jonathan Sagir & PWS / Mindrian.

For licensing inquiries: [mindrian.ai](https://mindrian.ai)
