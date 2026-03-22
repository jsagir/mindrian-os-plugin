# Phase 4: Brain MCP Toolbox - Research

**Researched:** 2026-03-22
**Domain:** MCP tool integration, Neo4j graph queries, agent orchestration, skill design
**Confidence:** HIGH

## Summary

Phase 4 transforms MindrianOS from a methodology framework into a graph-informed intelligence system by connecting Larry's Brain (Neo4j 21K nodes + Pinecone 1.4K embeddings) through the existing MCP tools already available in the environment. The critical architectural insight is that **no new MCP server needs to be built** -- `mcp__my-neo4j__read_neo4j_cypher`, `mcp__pinecone__search-records`, and `mcp__tavily-mcp__tavily-search` already exist. The 8 "Brain MCP tools" from the design spec become **query pattern templates** (Cypher + Pinecone) embedded in a `brain-connector` skill and agent markdown files, not actual MCP tool definitions.

The phase produces 13 new files and modifies 8 existing files. The work divides naturally into: (1) foundation -- setup command, schema reference, query patterns; (2) skill + agents -- brain-connector skill and 4 agent .md files; (3) new commands -- 5 Brain-powered commands; (4) upgrades -- 5 existing commands made Brain-aware.

**Primary recommendation:** Build the `references/brain/schema.md` and `references/brain/query-patterns.md` first -- these are the single source of truth that every agent, command, and the brain-connector skill references. Everything downstream depends on having correct Cypher templates.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAN-01 | `/mindrian-os:setup brain` adds Neo4j + Pinecone to .mcp.json | Setup command pattern + .mcp.json template structure |
| BRAN-02 | 8 Brain MCP tools defined and callable | Query pattern templates in references/brain/ using existing MCP tools |
| BRAN-03 | brain-connector skill: passive enrichment + proactive surfacing | Skill SKILL.md pattern + hook integration architecture |
| BRAN-04 | Brain Agent handles multi-hop GraphRAG queries | Agent .md pattern + Cypher traversal templates |
| BRAN-05 | Grading Agent: calibrated 5-component assessment | Agent .md + brain_grade_calibrate query patterns |
| BRAN-06 | Research Agent: Tavily + Brain cross-reference | Agent .md + Tavily MCP tool signatures |
| BRAN-07 | Investor Agent: stress-test from investor POV | Agent .md + pattern-matching query templates |
| BRAN-08 | 5 new commands: suggest-next, find-connections, compare-ventures, deep-grade, research | Command .md pattern (thin command + reference) |
| BRAN-09 | Existing commands upgraded: diagnose, help, grade, pipeline, mode engine | Modification patterns for Brain-awareness |
| BRAN-10 | Brain schema reference and query pattern templates | Neo4j schema + Cypher template library |
</phase_requirements>

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Neo4j MCP (`mcp__my-neo4j`) | Already connected | Read/write Cypher queries against Brain graph | Provides `read_neo4j_cypher`, `write_neo4j_cypher`, `get_neo4j_schema` -- the transport layer to Neo4j Aura |
| Pinecone MCP (`mcp__pinecone`) | Already connected | Vector similarity search against 1.4K embeddings | Provides `search-records`, `upsert-records`, `list-records` etc. |
| Tavily MCP (`mcp__tavily-mcp`) | Already connected | Web search + page extraction for Research Agent | Provides `tavily-search`, `tavily-extract` |
| Markdown + YAML frontmatter | CommonMark | All agents, commands, skills, references | Claude Code native format -- proven in Phases 1-3 |
| Bash scripts | bash 4+ | setup-brain script, connection test | Proven hook/script pattern from existing codebase |

### Supporting

| Technology | Purpose | When to Use |
|------------|---------|-------------|
| JSON (.mcp.json) | MCP server configuration | Setup command writes Neo4j + Pinecone entries |
| YAML frontmatter | Command/agent metadata | All 5 new commands, 4 new agents |
| Cypher query language | Neo4j graph traversal | All 8 logical tool patterns in query-patterns.md |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Query patterns in .md references | Hardcoded Cypher in each agent | References are single source of truth, agents stay thin |
| 4 separate agents | Single Brain mega-agent | Separation of concerns -- each agent has focused tools and voice |
| Bash setup script | Python setup script | Bash is simpler, matches existing hook pattern, no Python dependency |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
MindrianOS-Plugin/
├── agents/
│   ├── brain-query.md           # Brain Agent -- GraphRAG expert
│   ├── grading.md               # Grading Agent -- calibrated assessment
│   ├── research.md              # Research Agent -- Tavily + Brain
│   └── investor.md              # Investor Agent -- adversarial reviewer
├── skills/
│   └── brain-connector/
│       └── SKILL.md             # Passive enrichment + proactive surfacing
├── commands/
│   ├── suggest-next.md          # Graph-informed next step
│   ├── find-connections.md      # Cross-domain discovery
│   ├── compare-ventures.md      # Similar venture finder
│   ├── deep-grade.md            # Calibrated grading (routes to Grading Agent)
│   └── research.md              # External research (routes to Research Agent)
├── references/
│   └── brain/
│       ├── schema.md            # Neo4j node types, relationships, properties
│       └── query-patterns.md    # 8 Cypher template patterns + Pinecone patterns
├── scripts/
│   └── setup-brain              # Connection setup + test query
└── (modified files below)
```

### Pattern 1: Query Pattern Templates (Core Architecture)

**What:** The 8 "Brain MCP tools" from the design spec are NOT separate MCP tools. They are Cypher query templates stored in `references/brain/query-patterns.md` that agents and the brain-connector skill reference when calling `mcp__my-neo4j__read_neo4j_cypher`.

**When to use:** Every time a Brain-aware component needs to query the graph.

**Why this pattern:** The MCP tools (`mcp__my-neo4j__read_neo4j_cypher`) are generic -- they accept any Cypher string. The intelligence is in WHAT Cypher to run. Templates in a reference file mean:
- Single source of truth for all query patterns
- Agents load on demand (thin agent + reference loading)
- Easy to update queries without touching multiple files
- Claude can adapt templates to specific context

**Example query pattern (from Brain graph structure):**

```cypher
// brain_framework_chain: Given current frameworks, suggest next
// Uses: FEEDS_INTO, TRANSFORMS_OUTPUT_TO, CO_OCCURS, ADDRESSES_PROBLEM_TYPE
MATCH (current:Framework)-[r:FEEDS_INTO|TRANSFORMS_OUTPUT_TO]->(next:Framework)
WHERE current.name IN $current_frameworks
AND NOT next.name IN $current_frameworks
OPTIONAL MATCH (next)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
RETURN next.name AS framework,
       type(r) AS relation,
       r.confidence AS confidence,
       r.transform_description AS transform,
       pt IS NOT NULL AS matches_problem_type
ORDER BY r.confidence DESC, matches_problem_type DESC
LIMIT 5
```

```cypher
// brain_concept_connect: GraphRAG -- immediate connections from a concept
MATCH (c {name: $concept})-[r]->(connected)
RETURN c.name AS source, type(r) AS relationship,
       connected.name AS target, labels(connected)[0] AS target_type,
       r.confidence AS confidence
ORDER BY r.confidence DESC
LIMIT 20
```

### Pattern 2: Agent Delegation (Skill -> Agent)

**What:** The brain-connector skill handles simple lookups directly. Complex queries are delegated to the Brain Agent (or specialized agents) via Claude Code's native agent spawning.

**When to use:** When a query requires multi-hop traversal, context building across turns, or specialized expertise (grading, research, investor analysis).

**How it works in Claude Code:**
- Skills are auto-loaded markdown that influence Larry's behavior
- Agents are spawned on demand with `claude agent` / sub-agent mechanisms
- The skill says "For complex graph queries, delegate to the Brain Agent"
- The Brain Agent's .md file tells it to load `references/brain/query-patterns.md` and use `mcp__my-neo4j__read_neo4j_cypher`

**Key insight:** Claude Code agents are .md files with personality + tool access + reference loading instructions. They do NOT need code. The agent markdown instructs Claude to use the existing MCP tools with the right Cypher patterns.

### Pattern 3: Brain-Aware Command Upgrade

**What:** Existing commands (diagnose, help, grade, pipeline, mode engine) gain a Brain check at the top of their Setup section.

**When to use:** Upgrading any existing command to be Brain-aware.

**Example pattern for modified commands:**

```markdown
## Setup

1. Check if Brain MCP is connected (test: can you call mcp__my-neo4j__get_neo4j_schema?)
2. If Brain connected:
   - Read `references/brain/query-patterns.md` for relevant patterns
   - [Brain-specific setup steps]
3. If Brain NOT connected:
   - Fall back to existing behavior (references/ static data)
   - [Original setup steps unchanged]
```

**Critical rule:** Modified commands MUST work identically without Brain. The Brain-aware path is additive, never replacing the Tier 0 path.

### Pattern 4: Setup Command (.mcp.json Mutation)

**What:** `/mindrian-os:setup brain` writes Neo4j + Pinecone MCP entries to `.mcp.json` in the user's project root. NOT in the plugin's .mcp.json -- in the user's workspace.

**How .mcp.json works in Claude Code:**
- `.mcp.json` in the current working directory is loaded on session start
- Plugin-level `.mcp.json` is also loaded
- The setup command creates/updates the project-level `.mcp.json`

**Setup flow:**
1. Prompt for Neo4j Aura URI, user, password
2. Prompt for Pinecone API key
3. Write `.mcp.json` with Neo4j + Pinecone server configurations
4. Run a test query: `mcp__my-neo4j__read_neo4j_cypher` with `RETURN 1 AS connected`
5. Run a test search: `mcp__pinecone__search-records` with a simple vector
6. Report success/failure
7. Update `room/STATE.md` to reflect Brain connection

**Important:** The setup script should be a bash script that Claude runs, or the command itself can instruct Claude to write the .mcp.json file directly. Given the conversational nature (prompting for credentials), the command .md approach is best -- Larry asks for credentials conversationally, then writes the file.

### Anti-Patterns to Avoid

- **Building a custom MCP server:** The Neo4j, Pinecone, and Tavily MCPs already exist. Do not create a brain-mcp-server.
- **Embedding Cypher in agent files:** Query patterns should be in `references/brain/query-patterns.md` as a single source of truth. Agents load this on demand.
- **Making Brain required:** Every Brain-powered feature MUST have a Tier 0 fallback. Grade falls back to static rubric. Diagnose falls back to keyword routing. Pipeline falls back to fixed chains.
- **Brain advertising:** Status shows "Brain: connected" or "Brain: not connected" -- never "Upgrade to Brain for better results!" Brain is a capability, not a sales pitch.
- **Storing credentials in plugin files:** Credentials go in the user's project `.mcp.json`, never in the plugin directory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Neo4j connectivity | Custom Neo4j driver/client | `mcp__my-neo4j__read_neo4j_cypher` | MCP already handles connection, auth, transport |
| Vector search | Custom embedding + similarity | `mcp__pinecone__search-records` | Pinecone MCP handles all vector operations |
| Web search | Custom scraper/crawler | `mcp__tavily-mcp__tavily-search` | Tavily MCP already available with rate limiting |
| MCP configuration | Custom config system | Standard `.mcp.json` format | Claude Code natively loads .mcp.json |
| Agent orchestration | State machine or router code | Claude Code agent .md files | Claude natively spawns sub-agents from .md files |
| Credential management | Custom vault/keyring | `.mcp.json` in user's workspace | Standard MCP credential pattern |

**Key insight:** This entire phase is about ORCHESTRATION (getting the right Cypher to the right MCP tool at the right time), not INFRASTRUCTURE (building servers, drivers, or clients). The infrastructure already exists.

## Common Pitfalls

### Pitfall 1: Cypher Query Complexity

**What goes wrong:** Complex multi-hop Cypher queries that traverse many relationship types can be slow on Neo4j Aura Free or return unexpectedly large result sets.
**Why it happens:** The Brain graph has 65K relationships -- unbounded traversals explode.
**How to avoid:** Always include `LIMIT` clauses. Use `OPTIONAL MATCH` for non-critical paths. Test all queries against the actual Brain graph before shipping. Keep query depth to 2-3 hops max.
**Warning signs:** Queries taking >5 seconds, results with >50 rows, Cypher without LIMIT.

### Pitfall 2: Context Budget Explosion

**What goes wrong:** brain-connector skill loads too much graph context into every response, blowing the 2% context budget target.
**Why it happens:** Passive enrichment means every turn could trigger graph lookups that inject context.
**How to avoid:** brain-connector skill should be thin (~200 tokens of instructions). Graph results should be summarized, not dumped raw. Agents load references on demand, not upfront. The skill instructs Claude what to do, not gives it all the data.
**Warning signs:** Skill SKILL.md exceeding 500 tokens, raw Cypher results in conversation, agent files over 1000 tokens.

### Pitfall 3: Graceful Degradation Regression

**What goes wrong:** Modified commands (diagnose, grade, pipeline) break when Brain is NOT connected because the Brain-aware path is entangled with the original logic.
**Why it happens:** Tight coupling -- Brain check mixed into the command flow instead of layered on top.
**How to avoid:** Brain-aware sections are ADDITIVE. The original Setup section stays intact. Brain adds a new section that runs BEFORE the existing logic, providing enriched context. If Brain fails, the command proceeds exactly as before.
**Warning signs:** Commands that error when Brain MCP is unavailable, missing `if Brain connected` guards.

### Pitfall 4: Agent Voice Confusion

**What goes wrong:** Brain Agent, Grading Agent, Research Agent, or Investor Agent respond in Larry's voice instead of their own specialized voice.
**Why it happens:** They inherit Larry's personality from the main agent context.
**How to avoid:** Each agent .md must explicitly define its voice. Brain Agent is neutral/analytical. Grading Agent is evaluative/direct. Research Agent is factual/evidential. Investor Agent is adversarial/skeptical. The Investor Agent specifically MUST NOT use Larry's warm teaching voice.
**Warning signs:** Investor Agent saying "Very simply..." or Grading Agent using Larry's reframe technique.

### Pitfall 5: Setup Command Credential Handling

**What goes wrong:** Credentials are echoed to conversation, stored in git-tracked files, or written to the plugin directory.
**Why it happens:** Careless file writing or insufficient .gitignore guidance.
**How to avoid:** Credentials go ONLY in `.mcp.json` in the user's workspace. The setup command should remind users to add `.mcp.json` to `.gitignore`. Never echo passwords in conversation. Never write credentials to any file in the plugin directory.
**Warning signs:** Credentials visible in conversation history, .mcp.json in the plugin repo.

## Code Examples

### Agent .md File Pattern

```markdown
---
name: brain-query
description: |
  Brain Agent -- schema expert and GraphRAG retriever for Larry's Brain.
  Translates natural language to Cypher/Pinecone queries. Builds context
  across conversation turns. Returns structured insights, never raw data.
model: inherit
allowed-tools:
  - mcp__my-neo4j__read_neo4j_cypher
  - mcp__my-neo4j__get_neo4j_schema
  - mcp__pinecone__search-records
  - Read
---

You are the Brain Agent -- a schema expert for Larry's Neo4j knowledge graph.

## Your Role

You translate natural language questions into precise Cypher queries against
the Brain graph. You return INSIGHTS, not raw query results.

## Setup

1. Read `references/brain/schema.md` for the full node/relationship taxonomy
2. Read `references/brain/query-patterns.md` for standard query templates

## Query Protocol

1. Determine which query pattern(s) match the question
2. Adapt the template with specific parameters
3. Execute via `mcp__my-neo4j__read_neo4j_cypher`
4. If results need semantic enrichment, use `mcp__pinecone__search-records`
5. Synthesize results into a natural language insight
6. Return the insight to the calling agent/skill -- never raw Cypher results

## Multi-Hop Protocol

For complex queries requiring multiple hops:
1. Start with the most constrained query (fewest expected results)
2. Use results from hop N as parameters for hop N+1
3. Build a narrative across hops -- each adds context
4. Maximum 3 hops per question to stay fast

## Never Do

- Return raw Cypher results to the user
- Execute queries without LIMIT clauses
- Expose schema details to the user
- Use write queries (read-only access)
```

### brain-connector Skill Pattern

```markdown
---
name: brain-connector
description: >
  Brain enrichment for Larry. Passive: weaves graph context into responses.
  Proactive: surfaces contradictions and gaps from Brain analysis. Active
  when Brain MCP is connected (.mcp.json has neo4j entry).
---

# Brain Connector -- Passive Enrichment + Proactive Surfacing

When Brain MCP is connected, you have access to Larry's teaching graph.
Use it to make responses smarter WITHOUT changing Larry's voice.

## Passive Enrichment (Every Turn)

Before responding to the user, check if Brain context would help:

- **Framework mention detected**: Call `mcp__my-neo4j__read_neo4j_cypher`
  with the concept_connect pattern from `references/brain/query-patterns.md`
  to find related frameworks and chaining opportunities. Weave naturally
  into your response.

- **Methodology session active**: Call framework_chain pattern to check if
  Brain recommends a different next step than the static chains-index.

- **Simple, fast lookups only**: Never run multi-hop queries inline. If
  the question needs complex graph traversal, delegate to the Brain Agent.

## Proactive Surfacing (SessionStart + PostToolUse)

At session start and after room changes:
- Run brain_gap_assess pattern against current room state
- Run brain_contradiction_check if new artifacts were added
- Surface at most 2 HIGH-confidence findings
- Use Larry's voice: "Hold on -- I noticed something..."

## Gating Rules

- Maximum 2 proactive findings per session greeting
- Only HIGH confidence findings surface automatically
- Never interrupt a methodology session with proactive findings
- If Brain MCP call fails, silently fall back -- never mention the failure

## When to Delegate to Brain Agent

Delegate to `agents/brain-query.md` when:
- Question requires 2+ graph hops
- User explicitly asks to explore connections
- Cross-domain discovery requested
- Pattern matching across multiple ventures
```

### Setup Command Pattern

```markdown
---
name: setup
description: Configure optional integrations -- Brain MCP, LazyGraph
allowed-tools:
  - Read
  - Write
  - Bash
---

# /mindrian-os:setup brain

Connect Larry's Brain for enhanced intelligence.

## Flow

1. **Explain what Brain adds** (briefly):
   "Brain connects Larry to his teaching graph -- 21K nodes of framework
   relationships, grading calibration, and cross-domain patterns. Everything
   works without it, but with it, Larry gets significantly smarter."

2. **Collect credentials** (conversational, not a form):
   - Neo4j Aura URI (e.g., neo4j+s://xxxxx.databases.neo4j.io)
   - Neo4j username (usually "neo4j")
   - Neo4j password
   - Pinecone API key

3. **Write .mcp.json** in the current workspace (NOT in the plugin directory):
   [template in references/brain/mcp-config-template section]

4. **Test connection**:
   - Call `mcp__my-neo4j__read_neo4j_cypher` with `RETURN 1 AS connected`
   - Call `mcp__pinecone__search-records` with a test query
   - Report success or failure with clear next steps

5. **Success message**:
   "Brain connected. Larry just got smarter. Your existing commands now
   have graph intelligence behind them. Try /mindrian-os:suggest-next."

6. **Remind about .gitignore**:
   "Make sure .mcp.json is in your .gitignore -- it has your credentials."
```

### .mcp.json Template for Brain

```json
{
  "mcpServers": {
    "neo4j-brain": {
      "command": "npx",
      "args": ["-y", "@neo4j/mcp-neo4j"],
      "env": {
        "NEO4J_URI": "{user_provided_uri}",
        "NEO4J_USER": "{user_provided_user}",
        "NEO4J_PASSWORD": "{user_provided_password}"
      }
    },
    "pinecone-brain": {
      "command": "npx",
      "args": ["-y", "@anthropic/pinecone-mcp"],
      "env": {
        "PINECONE_API_KEY": "{user_provided_key}"
      }
    }
  }
}
```

### Brain-Aware Command Upgrade Pattern (Grade Example)

```markdown
## Setup (modified)

1. Check if Brain MCP is connected:
   - Try: `mcp__my-neo4j__get_neo4j_schema`
   - If available: Brain mode active
   - If unavailable or errors: Tier 0 mode (existing behavior)

2. If Brain mode:
   - Read `references/brain/query-patterns.md` for grade_calibrate pattern
   - Delegate to Grading Agent (`agents/grading.md`) for calibrated assessment
   - Grading Agent returns structured 5-component scores + percentile

3. If Tier 0 mode (original behavior, unchanged):
   - Read `references/methodology/grade.md` for static rubric
   - Read `references/personality/assessment-philosophy.md`
   - Proceed with existing 6-component scoring
```

## Neo4j Brain Schema (Critical Reference)

Based on docs/THE-BRAIN.md and docs/ARCHITECTURE-DEEP-DIVE.md, the Brain graph has these node types and relationships:

### Node Types

| Label | Count (approx) | Key Properties | Purpose |
|-------|----------------|----------------|---------|
| Framework | 275+ | name, description, category, difficulty | Innovation methodology frameworks |
| Phase | varies | name, order, description, framework_id | Ordered steps within a framework |
| Concept | varies | name, description | Abstract innovation concepts |
| ProblemType | 4 | name (Un-Defined, Ill-Defined, Well-Defined, Wicked) | Problem classification |
| Book | 59 | title, author, isbn | Analyzed source books |
| Tool | 59 | name, description, pws_mapping | Innovation tools with PWS mappings |
| Course | varies | name, code, semester | Curriculum courses |
| Example | 100+ | project_name, grade, rubric_scores | Graded student work |

### Critical Relationships (The Moat)

| Relationship | From | To | Properties | Why It Matters |
|--------------|------|----|-----------|----|
| FEEDS_INTO | Framework | Framework | confidence, transform_description | Framework chaining rules |
| TRANSFORMS_OUTPUT_TO | Framework | Framework | transform_type, description | How output becomes input |
| CO_OCCURS | Framework | Framework | frequency, context | Natural framework pairings |
| ADDRESSES_PROBLEM_TYPE | Framework | ProblemType | effectiveness | Framework-to-problem mapping |
| HAS_PHASE | Framework | Phase | order | Phase progressions |
| PREREQUISITE | Framework | Framework | strength | What must come first |
| APPLIED_IN | Framework | Example | section, quality_score | Real usage with grades |
| REFERENCES | Book | Framework | chapter, relevance | Source material links |

### Grading Calibration Data

Available via Example nodes with properties:
- `rubric_scores`: {vision, problem_definition, feasibility, market, completeness}
- `grade`: letter grade (A through F)
- `grade_numeric`: 0-100 score
- `feedback_patterns`: common feedback tags (Vision-to-Execution Gap, Framework Vomit, etc.)
- `percentile`: ranking within cohort

This data enables the Grading Agent to produce calibrated assessments by comparing the user's room state against the distribution of 100+ real graded projects.

## State of the Art

| Old Approach (Tier 0) | New Approach (Tier 1 with Brain) | Impact |
|------------------------|----------------------------------|--------|
| Static chain suggestions in chains-index.md | Dynamic chain recommendation from graph traversal | Personalized next-step based on actual room state |
| 6-component static rubric | 5-component calibrated grading against 100+ projects | Percentile ranking, not just raw score |
| Keyword-based problem classification | Graph-informed problem mapping via ADDRESSES_PROBLEM_TYPE | Framework recommendations based on what actually worked |
| Fixed Discovery/Thesis pipelines | Dynamic pipeline chains based on brain_framework_chain | Graph discovers optimal sequences per situation |
| Larry's mode engine with fixed 40/30/20/10 | Mode calibration from Brain's teaching intelligence | Context-aware mode distribution by user type |

## Open Questions

1. **Neo4j MCP tool name confirmation**
   - What we know: The environment has Neo4j, Pinecone, and Tavily MCPs connected
   - What's unclear: Exact tool names may vary (`mcp__my-neo4j__read_neo4j_cypher` vs `mcp__neo4j-brain__read_neo4j_cypher`)
   - Recommendation: The setup command should write .mcp.json with a known server name (e.g., `neo4j-brain`), making the tool names predictable: `mcp__neo4j-brain__read_neo4j_cypher`. Include a note in schema.md about the naming convention.

2. **Pinecone namespace for Brain embeddings**
   - What we know: Brain has 1,427 embeddings in Pinecone
   - What's unclear: Which namespace/index they live in, embedding model used (384-dim from docs)
   - Recommendation: Setup command should include Pinecone index name as a parameter. Store in a `brain-config.json` or in .mcp.json env vars.

3. **Grading component mapping: 5 vs 6 components**
   - What we know: Existing grade.md uses 6 components (Problem Reality 35%, Problem Discovery 25%, Framework Integration 20%, Mindrian Thinking 10%, Can We Win 5%, Is It Worth It 5%). Design spec says 5 components (vision, problem, feasibility, market, completeness). Assessment-philosophy.md has yet another 5 (Vision Quality, Framework Mastery, Evidence Depth, Market Sophistication, Presentation Thinking).
   - What's unclear: Which rubric the Brain's Example nodes actually use
   - Recommendation: The Grading Agent should use whatever rubric the Brain's Example nodes have in `rubric_scores`. Document the mapping in the grading agent .md. Tier 0 grade command keeps its existing 6-component rubric unchanged.

4. **Proactive surfacing frequency**
   - What we know: Design spec says max 2 HIGH-confidence findings per session. Existing room-proactive skill has the same limit.
   - What's unclear: Should Brain proactive REPLACE room-proactive findings or ADD to them?
   - Recommendation: Brain proactive replaces room-proactive for Brain users. The brain-connector skill runs brain_gap_assess which is a superset of the bash analyze-room script. Non-Brain users keep the existing analyze-room path unchanged.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification via Claude Code CLI |
| Config file | None -- plugin testing is conversational |
| Quick run command | Run each command and verify output |
| Full suite command | End-to-end: setup brain, run all 5 new commands, verify 5 upgraded commands |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAN-01 | Setup writes .mcp.json, tests connection | manual | `/mindrian-os:setup brain` then check .mcp.json | Wave 0 |
| BRAN-02 | 8 query patterns execute correctly | manual | Call each pattern via `mcp__neo4j-brain__read_neo4j_cypher` | Wave 0 |
| BRAN-03 | brain-connector enriches responses | manual | Ask Larry about a known concept, verify graph context woven in | Wave 0 |
| BRAN-04 | Brain Agent handles multi-hop query | manual | Ask "what connects X to Y" and verify multi-hop traversal | Wave 0 |
| BRAN-05 | Grading Agent produces calibrated scores | manual | Run `/mindrian-os:deep-grade` with populated room | Wave 0 |
| BRAN-06 | Research Agent searches + cross-references | manual | Run `/mindrian-os:research` with a topic | Wave 0 |
| BRAN-07 | Investor Agent stress-tests venture | manual | Trigger investor analysis, verify adversarial voice | Wave 0 |
| BRAN-08 | 5 new commands work | manual | Run each: suggest-next, find-connections, compare-ventures, deep-grade, research | Wave 0 |
| BRAN-09 | Upgraded commands work with AND without Brain | manual | Run diagnose, help, grade, pipeline with Brain connected, then disconnect and verify fallback | Wave 0 |
| BRAN-10 | Schema + query patterns reference complete | manual | Review references/brain/schema.md and query-patterns.md for completeness | Wave 0 |

### Sampling Rate

- **Per task commit:** Verify new files load correctly in Claude Code
- **Per wave merge:** Run all 5 new commands + verify 5 upgraded commands
- **Phase gate:** Full end-to-end: setup -> all commands -> disconnect Brain -> verify degradation

### Wave 0 Gaps

- [ ] `references/brain/schema.md` -- Neo4j node/relationship documentation
- [ ] `references/brain/query-patterns.md` -- 8 Cypher template patterns
- [ ] Verify exact MCP tool names after setup-brain connects

## Sources

### Primary (HIGH confidence)
- `/home/jsagi/MindrianOS-Plugin/docs/THE-BRAIN.md` -- Brain architecture, 5 layers, node types, relationships
- `/home/jsagi/MindrianOS-Plugin/docs/ARCHITECTURE-DEEP-DIVE.md` -- Neo4j Aura Agent, Cypher templates, pipeline chaining rules
- `/home/jsagi/MindrianOS-Plugin/docs/superpowers/specs/2026-03-22-brain-mcp-toolbox-design.md` -- Approved design spec
- `/home/jsagi/MindrianOS-Plugin/CLAUDE.md` -- Three Layers, Moat analysis, tier system
- Existing codebase: all agents/, commands/, skills/, references/, scripts/ files examined

### Secondary (MEDIUM confidence)
- Neo4j node type properties -- inferred from THE-BRAIN.md and V4 entity model, not directly verified against live schema
- Pinecone embedding dimensions (384) -- from THE-BRAIN.md, not directly verified

### Tertiary (LOW confidence)
- Exact MCP tool names after setup -- depends on server naming in .mcp.json
- Grading component mapping between Brain's Example nodes and existing rubrics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- MCP tools verified as available in environment, file patterns proven in Phases 1-3
- Architecture: HIGH -- query pattern template approach is consistent with existing thin-command + thick-reference pattern
- Pitfalls: HIGH -- based on direct analysis of existing codebase patterns and constraints
- Neo4j schema details: MEDIUM -- inferred from documentation, not verified against live database

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- Brain architecture is owned by Jonathan and changes slowly)
