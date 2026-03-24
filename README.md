# MindrianOS

**An operating system for venture thinking.**

MindrianOS is a plugin for Claude Code that turns your terminal into an innovation workspace. It pairs you with Larry -- a thinking partner modeled on 30+ years of teaching innovation methodology at Johns Hopkins -- and builds a structured Data Room as you explore your venture idea.

One command to install. Zero configuration. Larry starts talking.

---

## The Idea

Most AI tools give you answers. MindrianOS gives you a thinking partner.

Larry doesn't dump frameworks. He listens, reframes, challenges, and guides you through a structured methodology -- the Problem-Solving Workspace (PWS) -- developed over three decades of teaching entrepreneurs, engineers, and innovators how to navigate complex, undefined problems.

---

## Quick Start

### Install

```bash
# Add the MindrianOS marketplace (one time)
claude plugin marketplace add jsagir/mindrian-marketplace

# Install the plugin
claude plugin install mindrian-os@mindrian-marketplace
```

### Start

Just talk:

```
> I have an idea for a platform that connects local farmers with urban restaurants...
```

Larry responds. Your Data Room starts building. No setup required.

Or start with structure:

```
/mindrian-os:new-project
```

---

## What You Get

### Larry

A thinking partner, not a chatbot. Modeled on Prof. Lawrence Aronhime's teaching methodology:

- **Provocative** -- "You're thinking about this as a marketplace problem. What if it's actually a logistics problem?"
- **Structured** -- 26 innovation frameworks applied invisibly, earned through conversation
- **Adaptive** -- mode engine shifts between conceptual, storytelling, problem-solving, and assessment
- **Honest** -- tells you what's weak in your thinking before investors do

### Data Room

Eight structured sections that build automatically as you work:

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

### Visual Dashboard

```
/mindrian-os:room view
```

Opens a localhost dashboard showing your Data Room as an interactive knowledge graph. Nodes represent insights colored by section. Edges show how ideas connect -- INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO. Chat box for natural language queries about your room.

Built in the De Stijl design tradition -- geometric, functional, no decoration that doesn't earn its place.

### Professional Export

```
/mindrian-os:export thesis     # Multi-page investment thesis
/mindrian-os:export summary    # 1-2 page executive summary
/mindrian-os:export report     # Due diligence report with TOC
/mindrian-os:export profile    # Professional venture profile
```

De Stijl formatted PDFs generated directly from your Data Room content.

---

## 41 Commands

### Infrastructure

| Command | Purpose |
|---------|---------|
| `/mindrian-os:new-project` | Start a new venture project |
| `/mindrian-os:help` | Larry recommends what to work on next |
| `/mindrian-os:status` | View Data Room state and venture stage |
| `/mindrian-os:room` | Manage Data Room -- view, export, launch dashboard |
| `/mindrian-os:export` | Generate professional PDFs |
| `/mindrian-os:pipeline` | Run multi-step framework chains |
| `/mindrian-os:setup` | Connect optional Brain integration |
| `/mindrian-os:update` | Check for and install plugin updates |
| `/mindrian-os:radar` | Discover new platform capabilities |

### 26 Methodology Commands

Innovation frameworks delivered through Larry's teaching voice. Each one guides you through a structured session, produces artifacts filed to your Data Room, and connects to what you've already explored.

**Defining the Problem Space**
- `beautiful-question` -- Reframe your challenge into a question worth answering
- `explore-domains` -- Map innovation domains and find where fields collide
- `map-unknowns` -- Surface what you know, don't know, and can't see
- `diagnose` -- Classify your problem type and get framework recommendations
- `root-cause` -- Trace problems to their source (5 Whys, Fishbone, Fault Tree)
- `build-knowledge` -- Climb Ackoff's Pyramid from data to wisdom

**Understanding the Market**
- `analyze-needs` -- Jobs to Be Done analysis
- `explore-trends` -- Push current trends to their logical extreme
- `analyze-timing` -- S-Curve analysis for technology and market readiness
- `macro-trends` -- Identify large-scale shifts affecting your domain
- `user-needs` -- Deep dive into user behavior and motivation
- `explore-futures` -- Long-range futures exploration and weak signals

**Challenging Your Thinking**
- `challenge-assumptions` -- Devil's Advocate stress test
- `validate` -- Check claims against evidence
- `find-bottlenecks` -- Reverse Salient analysis
- `dominant-designs` -- Analyze convergence patterns in your market
- `think-hats` -- Six perspectives on your problem simultaneously

**Building Your Solution**
- `structure-argument` -- Minto Pyramid for logical argument construction
- `scenario-plan` -- Map plausible futures and prepare for each
- `analyze-systems` -- Decompose complex systems into layers
- `systems-thinking` -- Feedback loops, stocks, flows, leverage points
- `lean-canvas` -- Business model on one page
- `leadership` -- What kind of leader does your venture need
- `explore-futures` -- Cross-framework synthesis of future scenarios

**Evaluating Your Venture**
- `grade` -- Honest assessment of your venture thinking
- `build-thesis` -- Structure your investment narrative
- `score-innovation` -- Cross-domain innovation opportunity scoring

### Brain-Powered Commands (Optional)

When connected to Brain (Neo4j knowledge graph + Pinecone embeddings):

| Command | Purpose |
|---------|---------|
| `/mindrian-os:suggest-next` | Graph-informed next step based on similar ventures |
| `/mindrian-os:find-connections` | Cross-domain pattern discovery |
| `/mindrian-os:compare-ventures` | Find similar ventures and extract lessons |
| `/mindrian-os:deep-grade` | Calibrated assessment from 100+ real student projects |
| `/mindrian-os:research` | External web research with semantic cross-reference |

---

## Architecture

MindrianOS operates across three layers:

```
Plugin Layer        Brain Layer              Room Layer
(this repo)         (optional, remote)       (your workspace)

Skills              Neo4j                    room/
Commands      <-->  21K nodes          <-->  8 sections
Agents              65K relationships        Artifacts
Hooks               Pinecone                 STATE.md
Pipelines           1.4K embeddings          Exports
References
```

**Plugin** provides the methodology, personality, and orchestration -- all as markdown files that the AI reads and follows.

**Brain** adds intelligence from a knowledge graph built from 59 innovation books, 59 tools, curriculum connections, and 100+ real student project calibration data. Optional -- everything works without it.

**Room** is your private workspace. All data stays on your machine. The room directory structure IS your venture state, following the ICM principle that folder hierarchy encodes orchestration logic.

### Specialized Agents

| Agent | Role |
|-------|------|
| **Larry** | Main thinking partner -- warm, provocative, methodology-driven |
| **Brain Agent** | GraphRAG retriever for complex knowledge graph queries |
| **Grading Agent** | Calibrated venture assessment with component scoring |
| **Research Agent** | External web search with synthesis and provenance |
| **Investor Agent** | Adversarial stress-testing from investor perspective |

### Intelligence Pipeline

The plugin includes passive and proactive intelligence:

- **Passive**: Every Larry response is enriched by room context and (when connected) Brain graph patterns
- **Proactive**: After you create artifacts, the system detects gaps, contradictions, and convergence signals across your Data Room -- surfaced only when confidence is high

---

## Optional: Connect Brain

For deeper intelligence powered by a 23K-node knowledge graph with 170K+ relationships:

```
/mindrian-os:setup brain
```

Larry walks you through connecting Neo4j Aura and Pinecone. Once connected:

- Framework recommendations based on what worked for similar ventures
- Calibrated grading from 100+ real student projects
- Cross-domain pattern discovery across 59 books and 59 innovation tools
- Contradiction detection powered by semantic analysis

Everything degrades gracefully. Brain makes Larry smarter; Larry works fine without it.

---

## Privacy

Everything runs locally. Your Data Room is a folder on your machine. No data leaves your computer unless you explicitly connect Brain (optional, remote knowledge graph) or use the Research Agent (web search).

---

## Methodology

MindrianOS implements the Problem-Solving Workspace (PWS) methodology, a structured approach to venture innovation that guides users through problem definition, market analysis, solution design, and investment readiness.

The teaching methodology draws from:
- 30+ years of innovation education at Johns Hopkins University
- The Aronhime Method: structured problem-solving through progressive framework application
- 59 innovation frameworks organized by problem type (undefined, ill-defined, well-defined, wicked)
- Calibration data from 100+ real student venture projects

The plugin architecture follows the Interpretable Context Methodology (ICM):

> Van Clief, J. & McDermott, D. (2026). *Interpretable Context Methodology: Folder Structure as Agentic Architecture.* arXiv:2603.16021v2. doi:10.48550/arXiv.2603.16021

ICM's core insight -- that filesystem hierarchy can replace traditional orchestration code when working with AI agents -- directly shapes how MindrianOS uses folder structure as state management, pipeline contracts as workflow definitions, and markdown files as executable instructions.

---

## Learning System

MindrianOS learns from how you use it. Every session, it analyzes your usage patterns and adapts:

- **Framework preferences** -- which methodologies you gravitate toward and which you avoid
- **Section imbalances** -- where you over-invest and where blind spots form
- **Stage velocity** -- how quickly you move through venture stages
- **Engagement depth** -- session frequency, pipeline adoption, export usage

These learnings are stored locally in `room/.learnings.md` and fed to Larry at each session start. Larry adapts his suggestions, recommendations, and framework choices based on YOUR actual behavior -- not generic advice.

All analytics stay on your machine. You can delete `room/.analytics.json` and `room/.learnings.md` anytime.

---

## Links

- [PWS at Johns Hopkins](https://www.linkedin.com/company/problem-solving-workspace/) -- Problem-Solving Workspace LinkedIn
- [Jonathan Sagir](https://www.linkedin.com/in/jonathansagir/) -- Creator of MindrianOS
- [mindrian.ai](https://mindrian.ai) -- Mindrian homepage

---

## License

Proprietary. Copyright Jonathan Sagir / Mindrian.

For licensing inquiries: [mindrian.ai](https://mindrian.ai)
