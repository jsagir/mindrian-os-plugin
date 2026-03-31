---
name: MindrianOS Taxonomy
version: 1.0.0
updated: 2026-03-31
status: living-document
rule: EVERY command, skill, agent, script, and Larry response MUST use these terms. No synonyms. No freestyle naming.
---

# MindrianOS Taxonomy -- The Definitive Naming System

> This is a LIVING DOCUMENT. Updated whenever new concepts are added. Every piece of MindrianOS -- code, docs, Larry's voice, onboarding, error messages -- uses these exact terms. No exceptions.

## Why This Exists

Users, Larry, code, and docs must speak the same language. "Room" always means Room. "Entry" always means Entry. "Spark" always means Spark. Consistency builds trust. Inconsistency builds confusion.

**Rule:** If a term isn't in this taxonomy, it doesn't exist in MindrianOS. Add it here first, then use it everywhere.

---

## The Space

| Term | What It Is | Where It Lives | Icon |
|------|-----------|----------------|------|
| **MindrianOS** | The operating system for structured thinking | Plugin root | -- |
| **Room** | A self-contained knowledge space for one project. The fundamental unit. | `room/` or `rooms/{name}/` | -- |
| **Registry** | Tracks all rooms: which is active, git state, deploy URL | `.rooms/registry.json` | -- |

## Inside a Room

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Section** | A domain of knowledge (problem, market, solution, team...). Like a wing of a building. | `room/{section}/` |
| **Entry** | Any markdown knowledge artifact filed in a section. The standard unit of captured knowledge. | `room/{section}/{name}.md` |
| **Asset** | A binary file -- PDF, image, video, audio -- with a markdown wrapper for frontmatter. | `room/assets/{section}/` |
| **Manifest** | Auto-generated index of all assets with metadata. | `room/ASSET_MANIFEST.md` |
| **Blueprint** | Section descriptor: what this section is for, starter questions, default methodologies. | `room/{section}/ROOM.md` |

## Micro-Knowledge

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Spark** | The smallest unit of knowledge. One thought, one link, one quote, one pushback. Zero-friction capture. | `room/.sparks/{date}.md` |
| **Catch** | The act of capturing a spark. Larry auto-detects or user says "catch that." | Passive (Larry) or active (user) |
| **Ember** | 3+ sparks converging on the same theme. Larry detects and surfaces. | KuzuDB SPARK_CONVERGES edge |
| **Crystallize** | Promote accumulated sparks into a full Entry with frontmatter and section filing. | `/mos:crystallize` |
| **Residue** | 0-3 sparks extracted at session end from conversation. Auto-captured. | on-stop hook |
| **Fragment** | Meeting "noise" segments that contain micro-knowledge. Saved instead of discarded. | Meeting filing step |

## The Pulse (Context Files)

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **State** | Quantitative pulse: computed stats, entries, sections, stage, progress. | `room/STATE.md` |
| **Thesis** | Qualitative pulse: Minto pyramid -- governing thought, arguments, evidence. | `room/MINTO.md` |
| **Profile** | Who the user is: background, expertise, working style. Global across rooms. | `room/USER.md` |
| **Mission** | What the user is trying to accomplish in THIS room. The room's JTBD. | `room/JTBD.md` |
| **Decision** | A choice made at a decision point, with reasoning and alternatives considered. | `room/{section}/DECISION.md` |
| **Claims** | Tracked assumptions with validity status (unvalidated/validated/invalidated). | `room/assumptions.json` |

## People

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **People** | The human layer: team members, mentors, advisors, stakeholders. | `room/team/` |
| **Member** | One person with role, expertise, meeting history, contact. | `room/team/{category}/{slug}/PROFILE.md` |
| **Lenses** | AI perspective personas (De Bono Six Hats) generated from room data. | `room/personas/` |

## Conversations

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Conversation** | Any dialogue that generates knowledge. Not just meetings -- calls, chats, interviews. | `room/meetings/{date}-{name}/` |
| **Segment** | One classified piece of a conversation: insight, decision, action, advice, question. | Filed to section with frontmatter |
| **Commitment** | Something someone promised to do. Has owner + deadline + status. | `room/action-items.md` |
| **Echoes** | Themes recurring across multiple conversations. Cross-meeting intelligence. | `room/MEETINGS-INTELLIGENCE.md` |

## The Fabric (Knowledge Graph)

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Fabric** | KuzuDB -- the invisible backbone connecting all entries. Users never see it directly. | `.lazygraph/` |
| **Thread** | A typed relationship between two entries. The connections that make the room intelligent. | KuzuDB edge |
| **Thread Types** | INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES | Edge labels |
| **Surprise** | HSI-discovered non-obvious connection between entries. The hidden link nobody expected. | HSI_CONNECTION edge |
| **Bottleneck** | Reverse Salient -- where the room's understanding lags behind its ambition. (Hughes 1983) | REVERSE_SALIENT edge |
| **Weave** | The graph.json export that renderers consume. The Fabric made visible. | `dashboard/graph.json` |

## Signals (Intelligence)

| Term | What It Is | When It Fires |
|------|-----------|---------------|
| **Blind Spot** | An empty section or missing perspective. Something you haven't explored. | GAP detection |
| **Tension** | Two entries that say opposite things. A contradiction worth investigating. | CONTRADICT detection |
| **Pattern** | Same theme appearing in 3+ entries independently. Convergence = confidence growing. | CONVERGE detection |
| **Signal** | Any intelligence Larry surfaces without being asked. Max 1-2 per session, context-relevant. | Proactive intelligence |
| **Radar** | The ambient intelligence bar in every output (Zone 3). Where signals appear. | UI Zone 3 |

## Tools (What Larry Uses)

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Tool** | One of 26+ PWS methodology frameworks as a `/mos:` slash command. | `commands/{name}.md` |
| **Playbook** | The methodology's full reference material. The theory behind the tool. | `references/methodology/{name}.md` |
| **Script** | Bash/CJS/Python automation that runs in background. The machinery. | `scripts/{name}` |
| **Operator** | CJS module wrapping a script for programmatic use. | `lib/core/{name}-ops.cjs` |
| **Skill** | Always-on rule set Larry follows every session. Auto-loaded, never invoked. | `skills/{name}/SKILL.md` |
| **Agent** | Subagent with isolated context for specific tasks. Delegated work. | `agents/{name}.md` |

## Pipelines (How Things Chain)

| Term | What It Is | Where It Lives |
|------|-----------|----------------|
| **Pipeline** | Ordered chain of tools where each output feeds the next input. | `pipelines/{name}/` |
| **Stage** | One tool in the chain with input/output contract. | `pipelines/{name}/{nn}-{tool}.md` |
| **Handoff** | What one stage passes to the next. Structured output contract. | Frontmatter: requires/provides |
| **Trail** | Metadata tracking which pipeline produced an entry. Provenance. | Frontmatter: pipeline, pipeline_stage |

## Autonomous Work

| Term | What It Is | How It Works |
|------|-----------|-------------|
| **Autopilot** | Larry acts independently -- selects + runs the best framework for current state. | `/mos:act` |
| **Navigation** | Brain query or local routing table picks the right tool. Framework selection. | Act Step 3 |
| **Trace** | Larry shows WHY he picked this framework before running it. Thinking transparency. | Act Step 2 (Shape E) |
| **Sequence** | 3-5 tools in series, each output feeds the next. Chain mode. | `--chain` flag |
| **Preview** | Show the execution plan without running anything. Safe look-ahead. | `--dry-run` flag |
| **Sandbox** | Framework runs in subagent context. Main session stays clean. | `agents/framework-runner.md` |

## The Cascade (Filing Pipeline)

| Step | Name | What Happens | Timing |
|------|------|-------------|--------|
| 1 | **Classify** | What section does this belong to? | Sync, <100ms |
| 2 | **Stamp** | Inject artifact hash ID into frontmatter | Sync, <50ms |
| 3 | **Weave** | Create KuzuDB node + detect Thread edges | Sync, <500ms |
| 4 | **Refresh** | Recompute State from filesystem | Background |
| 5 | **Map** | Rebuild Weave (graph.json) from Fabric | Background |
| 6 | **Discover** | HSI + Reverse Salient computation (Surprises + Bottlenecks) | Background |
| 7 | **Version** | Git commit with provenance message | Background |
| 8 | **Publish** | Push to GitHub, Vercel redeploys Showcase | Background |

## Showcase (Presentation Views)

| Term | What It Is | File |
|------|-----------|------|
| **Showcase** | All 6 HTML views generated from a room. The room made visible. | `/mos:export presentation` |
| **Overview** | Dashboard: stats, cards, video, assets, opportunities | `dashboard.html` |
| **Library** | Wiki: 3-panel article browser with search + TOC | `wiki.html` |
| **Narrative** | Deck: fullscreen presentation slides from Thesis + entries | `deck.html` |
| **Synthesis** | Insights: stat counters, timelines, funnels, heat maps | `insights.html` |
| **Blueprint** | Diagrams: SVG architecture from graph edges | `diagrams.html` |
| **Constellation** | Graph: Canvas knowledge graph with particles + glow | `graph.html` |

## CLI Visual Identity (De Stijl Terminal)

| Term | What It Is |
|------|-----------|
| **Four Zones** | Header, Body, Radar, Footer -- every output follows this anatomy |
| **Shapes** | 5 body layouts: Board, Tree, Card, Document, Report |
| **Glyphs** | 12 approved symbols for status/type indicators |
| **Palette** | 5 ANSI colors: cream, red, blue, yellow, muted |
| **Greeting** | Cold/warm/signals contract at session start |
| **Signature** | MindrianOS logo + "Built with MindrianOS" + Mondrian color bar |

## Onboarding

| Term | What It Is | When It Happens |
|------|-----------|----------------|
| **Welcome** | First-time MindrianOS onboarding. Larry learns who you are. | First install detection |
| **Briefing** | Per-room clarification. Larry learns what you're building HERE. | `/mos:new-project` |
| **Quick Briefing** | 3 questions: what, who, when. Fast start. | User chooses quick |
| **Deep Briefing** | JTBD interview: situation, motivation, outcome, anxieties. Rich context. | User chooses deep |
| **Refresh** | After-update flow: what's new + core features reminder. | `/mos:update` |

---

## Usage Rules

1. **Larry ALWAYS uses these terms** in conversation. "I'll file this as an Entry in your market-analysis Section." Not "I'll save this document to the folder."

2. **Error messages use these terms.** "No Room found in this workspace" not "No room/ directory."

3. **Onboarding teaches these terms.** The Welcome and Briefing flows introduce the vocabulary naturally.

4. **Code comments use these terms.** `// Weave: create KuzuDB node + detect Threads` not `// index artifact in graph database`

5. **This file is the source of truth.** If a term isn't here, it doesn't exist in MindrianOS. Add it here FIRST, then use it everywhere.

---

*Living document. Last updated: 2026-03-31. Version 1.0.0.*
