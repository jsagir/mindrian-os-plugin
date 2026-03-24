# MindrianOS — What We Built and Why

**For:** Lawrence Aronhime
**From:** Jonathan Sagir
**Date:** March 2026
**Context:** Following the Tyler Josephson feedback session

---

## Lawrence, Here's What Happened

After our conversation with Tyler, we took everything — his feedback, your teaching methodology, and the vision for what Mindrian should become — and rebuilt it from the ground up as a Claude Code plugin called MindrianOS.

This document shows you what it does, how it works, and why it matters. I'll connect Tyler's specific feedback points to what we actually built.

---

## The Core Idea (In Your Words)

> "Students use software all the time. Let's develop one that helps them think rather than does the work for them."

That's exactly what MindrianOS does. It's Larry — modeled on you — as an AI thinking partner. Not a chatbot that gives answers. A provocative, warm, demanding co-founder who asks the right questions at the right time.

---

## What Tyler Said → What We Built

### Tyler: "The fork in the road detection would help a lot"

Tyler wanted the system to detect when a user reaches a decision point and offer options — "it seems like you might want this mode or this other one."

**What we built:** 26 methodology commands that Larry recommends based on where the user IS in their journey. The system classifies the problem type (undefined → ill-defined → well-defined) and suggests 2-3 frameworks ranked by fit. Larry says things like:

> "You've mapped the landscape and tested perspectives. Now you need evidence. Here are your options: `/mos:validate` to check your claims, or `/mos:challenge-assumptions` to stress-test before you build on this."

The user always chooses. Larry always suggests. The fork is real — it's not a predetermined path.

### Tyler: "Balance between pushback and 'take me somewhere interesting'"

Tyler's core tension: the system pushes back (good for students), but when an advanced user wants to explore unconventional ideas, the pushback becomes frustrating. He said the system kept defending the status quo when he wanted to think beyond it.

**What we built:** Larry's mode engine distributes responses across four modes:
- **Conceptual (40%)** — frameworks applied invisibly
- **Storytelling (30%)** — cross-domain examples that open thinking
- **Problem-solving (20%)** — direct engagement with the user's specific challenge
- **Assessment (10%)** — honest evaluation

The balance shifts based on conversation context. Early in a session, Larry explores. Mid-session, Larry challenges. Late in a session, Larry synthesizes. An advanced user who pushes back gets recognized — Larry shifts from "have you considered the status quo?" to "let's see where that takes us."

With Brain MCP connected, this distribution becomes calibrated from real teaching data — your actual 30-year pattern of when to push and when to explore.

### Tyler: "Choose your own adventure — manually pick a different agent at any point"

Tyler wanted to be able to say "I'm tired of defining the problem, I want to brainstorm" — and switch modes mid-conversation.

**What we built:** 38 commands the user can invoke at any time. They're not locked into a sequence. If Larry suggests `/mos:validate` but the user wants `/mos:think-hats` (six perspectives at once), they just run it. Larry adapts.

Beyond that, 5 specialized agents the user can invoke:
- **Brain Agent** — deep knowledge graph queries
- **Grading Agent** — honest calibrated assessment
- **Research Agent** — external web search with synthesis
- **Investor Agent** — adversarial stress-testing from investor POV

The user can call these at any time. Larry doesn't block them. Choose your own adventure, with Larry as the guide who always has a suggestion but never forces a path.

### Tyler: "Data visualization is about narrative. What is the story you're trying to tell?"

Tyler was teaching a data visualization course and wanted Mindrian to help think about HOW to visualize data, not just analyze it.

**What we built:** A visual Data Room dashboard that shows the user's entire venture thinking as an interactive knowledge graph. Nodes are insights colored by topic (8 semantic colors). Edges show connections: INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO.

The user opens it with `/mos:room view` and sees their thinking laid out as a connected graph in a web browser. It's the narrative of their venture — visually.

### Tyler: "It didn't necessarily have all the scientific context... tedious asking for more info"

Tyler felt the system asked questions it should already know the answers to — forcing him to provide context that a frontier model should already have.

**What we built:** Larry's commands use `disable-model-invocation: true` — they DON'T auto-trigger. The user invokes them intentionally. When invoked, Larry reads the user's existing Data Room first (all their previous work), then applies the framework WITH that context. He doesn't start from zero each time.

The proactive intelligence system also works in the background: after every artifact created, the system detects gaps, contradictions, and convergence across the room — then surfaces only HIGH-confidence findings. Larry doesn't ask "what's your market?" if the user already wrote a market analysis. He says "I noticed your market analysis says X, but your competitive analysis says Y. Which is it?"

### Tyler: "I want to import data... and then get out of that data what it says"

Tyler and your son both wanted CSV data import with analysis.

**What we built for now:** The Research Agent can pull external data via web search (Tavily integration). The export system generates professional PDFs from the Data Room content. Data Room artifacts support structured tables and data within methodology sessions.

**What's planned:** Direct data upload and analysis is on the v2 roadmap. The architecture supports it — the Data Room is just a folder, and the learning system already reads everything in it.

### Tyler: "Mobile doesn't work"

Tyler said the dashboard is too crowded on mobile. You were surprised anyone would use it on a phone.

**What we built:** MindrianOS as a Claude Code plugin runs in the terminal — not a web app. The dashboard is localhost only (for the knowledge graph visualization). The actual conversation with Larry happens in Claude Code, which works on any device that runs Claude. No mobile UI to break.

### Tyler: "Feedback forms built into the app"

Tyler suggested a way for users to give feedback after each conversation.

**What we built:** A local analytics and learning system:
- **Analytics:** tracks which commands users run, which room sections they build, session frequency, model choice
- **Learning:** analyzes patterns and generates behavioral insights that Larry reads each session
- Larry adapts: "You've been deep in market analysis. Your competitive analysis room is empty. Want to stress-test your assumptions?"

All data stays local. Users own their usage data. They can delete it anytime.

---

## What Jonathan Pitched → What We Built

### Jonathan: "The Data Room should be like a graph with ever-expanding relationships"

The vision of a knowledge graph where new connections emerge as you add information — relationships between nodes that you didn't explicitly create but that the system discovers.

**What we built:** Exactly this. The Data Room is 8 sections (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model). As artifacts accumulate:

- **Cross-references** are detected automatically (artifact in market-analysis references competitive-analysis → INFORMS edge)
- **Convergence signals** emerge (18 terms appearing in 3+ sections = themes you didn't name but that keep appearing)
- **Contradictions** surface (your TAM says $2B but your scenario plan assumes a niche market)

The knowledge graph dashboard visualizes all of this. It's the Megan story — micro-knowledge from scattered sources, connected by relationships, surfacing insights the user didn't see.

### Jonathan: "Proactive agents that work while you're asleep"

The vision of agents that find opportunities, connections, and gaps without being asked.

**What we built:** The proactive intelligence system fires automatically:
- **SessionStart:** analyze-room detects gaps, contradictions, convergence. Larry opens with awareness: "Your competitive analysis is empty — and I've seen ventures like yours stumble there."
- **PostToolUse:** after every artifact is created, the classification system files it and checks for new patterns
- **Learning system:** after 3+ sessions, generates behavioral insights that modify Larry's suggestions

With Brain MCP: the proactive system gets semantic intelligence — not just keyword matching but actual graph traversal to find patterns similar ventures encountered.

### Jonathan: "The human in the loop decides what goes in"

The Data Room doesn't populate itself. The user decides what's kept.

**What we built:** Exactly this principle. Larry suggests filing artifacts to room sections. The user confirms: "File this to market-analysis?" The user can redirect. The user can delete. The room is curated by human judgment, relationships are discovered by the system.

---

## The Full User Journey (What We Tested)

We simulated a complete user: Dr. Elena Vasquez, NASA JPL scientist, 15 years in thermal protection systems. She developed a novel heat shield material — 40% lighter, 60% cheaper than SpaceX's PICA-X. Brilliant scientist, zero business experience.

### 10 Methodology Sessions

| # | What Larry Did | What Elena Learned |
|---|---------------|-------------------|
| 1 | "What are you working on?" | Her real problem isn't technical — it's market risk |
| 2 | Mapped 3 innovation domains | Found 3 intersection opportunities she hadn't considered, including EV batteries ($2B market) |
| 3 | Pushed 5 trends to extremes | The window is 2026-2029. After that, vehicle designs lock in for a generation |
| 4 | JTBD analysis for 3 customer types | Discovered that "career safety" is the #1 emotional job across all customers |
| 5 | Devil's Advocate on 5 assumptions | "Cheaper" destroyed as value prop. Reframed to "saves 400kg of dry mass = $2M more payload per flight" |
| 6 | S-curve timing analysis | Classic Christensen disruption: enter low-end, march upmarket |
| 7 | Six Hats — 5 go-to-market strategies | Defense-First + Foundry Model chosen. SpaceX partnership rejected (captive supplier risk) |
| 8 | Lean Canvas business model | 60-70% gross margins, $0.5M Y1 → $8-15M Y3 |
| 9 | Minto Pyramid investment argument | $8-10M Series A, exit via defense prime acquisition at 12-17x return |
| 10 | Grade | B+ (82/100). Vision 8.2, Execution 3.8. 90-day action plan produced |

### What the System Did Automatically

- Tracked venture stage progression: Pre-Opportunity → Discovery → Design → Investment
- Filed 10 artifacts across 6 room sections with provenance metadata
- Detected 20 cross-references between sections
- Found 18 convergence themes across 3+ sections
- Flagged 2 gaps (legal-ip and team-execution empty) — same gaps the grade independently identified
- Generated a 33-page investment thesis PDF in De Stijl design
- Built a knowledge graph: 18 nodes, 33 edges

### The Key Intelligence Moment

After 10 sessions, Larry diagnosed that the problem space had **evolved**. What started as "should I commercialize this?" decomposed into 5 specific, well-defined problems:

1. **IP License** — negotiate Bayh-Dole transfer from JPL (critical path)
2. **First Customer** — get evaluation agreement from Rocket Lab
3. **Manufacturing Scale-Up** — prove room-temperature curing at production volume
4. **Qualification Timeline** — create credible 18-month qualification plan
5. **Funding Gap** — bridge from SBIR to Series A

Each with clear parameters, constraints, success metrics, and a recommended DIFFERENT framework to address it.

**This is exactly what you teach:** You don't solve a complex problem. You work it until it decomposes into well-defined subproblems. Then you solve those.

---

## The Question You've Been Asking

> "Does it help me get an idea faster than I otherwise would have gotten?"

From the simulation: Dr. Vasquez went from "I have a material" to a graded investment thesis with 5 specific execution problems in 10 sessions. The system:

1. **Reframed her value proposition** (cheaper → mass savings = payload revenue) in Session 5
2. **Identified an adjacent market** (EV batteries, $2B) she'd never considered in Session 2
3. **Destroyed a dangerous assumption** (compete with SpaceX → classic Christensen disruption) in Session 6
4. **Surfaced a convergence signal** (qualification appearing in 4 sections = the real moat, not technology) automatically
5. **Detected the vision-execution gap** (8.2 vs 3.8) with a specific 90-day action plan

Would she have gotten there on her own? Eventually. In 10 sessions instead of 2 years? That's the claim.

---

## The Architecture (ICM)

The plugin is built on the Interpretable Context Methodology by Van Clief & McDermott (2026), which argues that folder structure itself can serve as agentic architecture. In MindrianOS:

- The Data Room **directory** IS the venture state
- Pipeline **contracts** ARE the workflow
- Markdown **files** ARE the executable instructions
- Larry **reads the room** and responds accordingly

No state machine. No routing engine. No orchestration code. The documentation is the code.

> Van Clief, J. & McDermott, D. (2026). "Interpretable Context Methodology: Folder Structure as Agentic Architecture." arXiv:2603.16021v2.

---

## What's Next

| Item | Status |
|------|--------|
| Plugin installable from marketplace | Done — 2 commands |
| 38 commands (26 methodology + 5 Brain + 7 infrastructure) | Done |
| Visual Data Room dashboard | Done |
| De Stijl PDF export (thesis, summary, report, profile) | Done |
| Analytics + learning system | Done |
| Brain MCP integration (Neo4j + Pinecone) | Architecture done, needs hosted server |
| Trained Lawrence model (paid tier) | Planned — fine-tune on real teaching data |
| Data upload + analysis (Tyler's request) | Planned for v2 |

---

## Install

```bash
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mindrian-os@mindrian-marketplace
```

Larry starts talking.

---

**Repository:** https://github.com/jsagir/mindrian-os-plugin
**Website:** https://mindrianos-jsagirs-projects.vercel.app
