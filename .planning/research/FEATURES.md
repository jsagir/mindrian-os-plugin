# Feature Research: v3.0 MCP Platform & Intelligence Expansion

**Domain:** MCP server delivery, grant discovery/management, AI personas, collaborative room access
**Researched:** 2026-03-24
**Confidence:** MEDIUM (MCP patterns HIGH, grant APIs MEDIUM, personas MEDIUM, remote MCP LOW)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are non-negotiable for v3.0 to feel complete. These are expectations set by existing MCP servers, grant tools, and the v2.0 plugin itself.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **MCP tool endpoints for core commands** | Any MCP server must expose tools. Desktop/Cowork users have zero CLI access -- tools ARE the interface. Every existing MCP server ships tools. | MEDIUM | Wrap 41 existing commands as MCP tools. CLI Wrapper pattern (JSON config to MCP tools) is well-established. Use `tools/list` + `tools/call` protocol. Shared core library = single implementation, two delivery layers. |
| **MCP resources for room state** | Resources are read-only data MCP servers expose. Room sections, STATE.md, team profiles are naturally resources. Desktop users need to browse room state without running commands. | MEDIUM | Expose room/ folder tree as `room://` URI scheme. STATE.md as `room://state`. Each DD section as `room://problem-definition`, etc. MIME type = text/markdown. |
| **MCP prompts for methodology workflows** | Prompts are reusable instruction templates -- the third MCP primitive. 25 methodology bots map directly to prompts with arguments (venture context, stage, focus area). | LOW | Each methodology bot becomes an MCP prompt with typed arguments. Users pick from prompt list in Desktop/Cowork instead of memorizing `/mindrian-os:` commands. |
| **mindrian-tools.cjs CLI entry point** | GSD pattern proven: single .cjs file as tool entry point. Plugin commands need scriptable, non-interactive execution for hooks and agents. | LOW | Mirror gsd-tools.cjs architecture. Subcommands map to plugin commands. Already designed in PROJECT.md. |
| **Grant pipeline status tracking** | Every grant management tool (Instrumentl, Fundsprout, Fluxx) tracks grants through lifecycle stages with deadlines, amounts, and status. Users expect a Kanban-like pipeline. Table stakes for any grant feature. | MEDIUM | Stages: Discovered > Researched > Applying > Submitted > Under Review > Awarded/Rejected > Active > Reporting > Closed. Stored as structured markdown in room/funding/. |
| **Grant opportunity metadata** | Grant tracking requires: funder name, program name, amount range, deadline, eligibility, fit score, URL, submission requirements. Without these fields, the feature is a toy. | LOW | JSON or YAML frontmatter in each grant file. Same ICM artifact pattern used for meeting files. |
| **Opportunity Bank as room section** | Existing 8 DD sections set the pattern. New intelligence features need room storage. Opportunity Bank is just another section following the same pattern. | LOW | `room/opportunities/` with STATE.md. Follows exact same pattern as room/market-analysis/ etc. |
| **Funding Room as sub-room** | v2.0 already has room hierarchy. Funding Room follows the same sub-room pattern with specialized sections. | LOW | `room/funding/` with sub-sections: `non-dilutive/`, `dilutive/`, `grants/`. Each with STATE.md. |

### Differentiators (Competitive Advantage)

Features that make v3.0 more than "just an MCP wrapper." These create lock-in and justify the platform expansion.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Proactive grant scouting agent** | No MCP server does proactive opportunity discovery. Most grant tools require users to search. MindrianOS reads the room (problem definition, market analysis, team profile) and FINDS matching grants without being asked. This is the Opportunity Bank's killer feature. | HIGH | Agent reads room state, extracts keywords/domain/geography/stage, queries grant APIs (Candid Grants API, Grants.gov, SBIR scraper via Apify). Scores matches against room context. Files discoveries to room/opportunities/. Runs on schedule or SessionStart. |
| **Room-aware grant matching** | Grant tools match on keywords. MindrianOS matches on the FULL room context -- problem definition, market analysis, team capabilities, financial model, competitive landscape. This is structural matching, not keyword matching. | HIGH | Cross-references room sections to build rich query. E.g., "team has AI expertise" + "targeting healthcare market" + "pre-revenue stage" = specific grant programs. Depends on room having content in multiple sections. |
| **AI Team Personas from room intelligence** | Not generic "pretend to be an expert." Personas generated FROM the room's actual content -- a domain expert who has read every meeting transcript, every artifact, every cross-reference. The persona IS the room's intelligence wearing a face. | MEDIUM | Generate persona prompt from room state: domain expertise (from market-analysis), team dynamics (from meetings), problem understanding (from problem-definition). Use De Bono's Six Hats as structure (already exists as think-hats command). Personas are constrained specialists, not general chatbots. |
| **Persona dependency chain (coherence cascade)** | Research shows personas work when sequenced with dependency chains -- each persona reads prior outputs. MindrianOS can chain personas: Market Expert > Technical Expert > Financial Expert > Devil's Advocate, each inheriting context. | MEDIUM | Follows the "10-step dependency chain" pattern from Mandal (2026). Each persona step reads all prior persona outputs. Creates what research calls "coherence cascade" -- early decisions flow through all subsequent analysis. Pipeline chaining (Week 7 pattern) already supports this. |
| **Selective persona activation (PRISM insight)** | Research (arXiv 2603.18507) proves personas improve alignment tasks but DAMAGE accuracy on knowledge retrieval. MindrianOS should use personas for analysis/synthesis/challenge tasks, NOT for factual lookups. Route intelligently. | LOW | Larry handles knowledge retrieval (no persona overlay). Personas activate for: stakeholder simulation, perspective challenging, scenario analysis, pitch practice. Never for: data lookup, fact checking, grading. |
| **Grant lifecycle as GSD-style process** | Each grant gets its own mini-workflow with stages, tasks, and deliverables -- like a GSD milestone per grant. No other tool treats grants as structured projects with AI assistance at each stage. | MEDIUM | Per-grant folder: `room/funding/grants/NSF-SBIR-2026/` with stages: research.md, eligibility.md, narrative-draft.md, budget.md, submission-checklist.md, reports/. STATE.md tracks stage progression. Larry assists at each stage. |
| **Cross-grant intelligence** | Same pattern as cross-meeting intelligence. Detect overlap between grants (same funder, same deadline period), contradictions (budget commitments exceeding capacity), convergence (multiple grants pointing to same R&D direction). | MEDIUM | Reuse cross-meeting intelligence architecture. INFORMS/CONTRADICTS/CONVERGES/ENABLES relationships between grant artifacts and other room sections. "Your NSF narrative contradicts the market size in your financial model." |
| **MCP prompts with room context injection** | Standard MCP prompts are static templates. MindrianOS prompts automatically inject current room state as context. User picks "Minto Pyramid" prompt, and it arrives pre-loaded with their venture's latest state. | LOW | Each prompt's handler reads room STATE.md + relevant section before generating the prompt message. Desktop/Cowork users get context-aware methodology without manual copy-paste. |
| **Room as collaborative resource (Remote MCP)** | Cowork teams share room state via MCP resources. One team member files a meeting, another sees updated STATE.md and new cross-references immediately. No custom sync -- MCP resource protocol handles it. | HIGH | Requires MCP server running with access to shared filesystem (Cowork workspace). Resources emit change notifications when room files update. Session management for concurrent access. This is the hardest feature -- MCP session state is still evolving (2026 roadmap item). |

### Anti-Features (Do NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full grant submission portal** | "Let me submit grants from MindrianOS!" | Grant submission portals (Grants.gov, Submittable) have strict formatting, e-signature, and compliance requirements. Building submission is a massive liability. | Generate grant-ready documents (narrative, budget, supporting docs). User submits through official portals. Link to portal in grant file. |
| **Real-time grant database** | "Why not scrape all grants continuously?" | Grant databases are massive (275K+ on Fundsprout alone). Maintaining a local mirror is infeasible. API costs scale with queries. Rate limits apply. | Use external APIs on-demand (Candid, Grants.gov, Apify SBIR scraper). Cache results in room/opportunities/. Refresh on user request or scheduled scan. |
| **Persona memory across sessions** | "My Market Expert persona should remember our last conversation." | Persona state bloats context. Personas should be stateless -- regenerated from room state each time. Room IS the memory. Adding persona-specific memory creates drift between persona knowledge and room truth. | Personas regenerated from current room state every invocation. Room state IS persona memory. If room changed, persona adapts automatically. |
| **Custom persona creation UI** | "Let me design my own AI team members with a wizard." | Scope creep. Persona generation should be automatic from room intelligence. Manual creation produces generic, unhelpful personas. | Auto-generate personas from room content + De Bono hats + domain detection. User can tweak via natural language ("make the market expert more skeptical") not through a configuration UI. |
| **MCP server with its own web dashboard** | "Add a web UI for the MCP server management." | v1.0 anti-feature: no web UI. MCP server is invisible infrastructure. Claude surfaces ARE the UI. Adding a dashboard recreates the V2 problem. | Server exposes health via standard MCP ping. Diagnostics via `/mindrian-os:status` command or MCP tool. |
| **Collaborative editing / CRDT** | "Multiple users editing the same room file simultaneously." | CRDTs are enormously complex. Cowork already handles collaborative editing. Building our own concurrent editing is reinventing the platform. | File-level ownership: one writer at a time, others read via MCP resources. Cowork's native collaboration handles multi-user editing. Room STATE.md uses append-only pattern for concurrent safety. |
| **Payment/subscription management for grants** | "Track grant payments and disbursements." | Financial management is a regulated domain. Grant accounting requires compliance features (A-133 audit, OMB circulars). Building this is a liability. | Track grant amounts and milestones. Link to external accounting tools. Focus on narrative/strategic management, not financial accounting. |
| **Persistent persona agents running in background** | "Keep my AI team always running, watching for things." | Background agents consume compute, create unexpected costs, and generate noise. Proactive intelligence on SessionStart is the right cadence. | Personas invoke on-demand or at session boundaries. Proactive scanning runs at SessionStart (existing pattern), not continuously. |

---

## Feature Dependencies

```
MCP Server (shared core library)
    |
    +--> MCP Tools (wraps 41 commands)
    |       +-- requires: shared core extracting command logic from .md files
    |
    +--> MCP Resources (room state)
    |       +-- requires: room/ folder structure (already exists v2.0)
    |       +-- enables: Remote Room (collaborative access)
    |
    +--> MCP Prompts (methodology templates)
    |       +-- requires: 25 methodology bot definitions (already exist)
    |       +-- enhanced by: room context injection
    |
    +--> mindrian-tools.cjs
            +-- requires: shared core (same library MCP tools use)

Opportunity Bank (room/opportunities/)
    |
    +--> requires: Room structure (exists v2.0)
    +--> requires: MCP server OR CLI (at least one delivery surface)
    |
    +--> Proactive Grant Scouting Agent
    |       +-- requires: Opportunity Bank section exists
    |       +-- requires: Room has content (problem-def, market, team)
    |       +-- requires: External API access (Candid, Grants.gov)
    |       +-- enhanced by: Brain MCP (richer matching)
    |
    +--> Room-Aware Grant Matching
            +-- requires: Proactive scouting agent
            +-- requires: Multiple room sections populated

Funding Room (room/funding/)
    |
    +--> requires: Room structure (exists v2.0)
    +--> requires: Opportunity Bank (grants flow from discovery to management)
    |
    +--> Per-Grant GSD Process
    |       +-- requires: Funding Room sections exist
    |       +-- enhanced by: Larry assistance per stage
    |
    +--> Cross-Grant Intelligence
            +-- requires: Multiple grants in pipeline
            +-- reuses: Cross-meeting intelligence architecture (exists v2.0)

AI Team Personas
    |
    +--> requires: Room has content (personas generated FROM room)
    +--> requires: think-hats command (exists v2.0 -- De Bono structure)
    |
    +--> Persona Dependency Chain
    |       +-- requires: Pipeline chaining (exists v2.0)
    |       +-- requires: Multiple persona definitions
    |
    +--> Selective Activation (PRISM routing)
            +-- requires: Persona definitions
            +-- requires: Task classification (alignment vs knowledge)

Remote Room (collaborative MCP)
    |
    +--> requires: MCP Server running
    +--> requires: MCP Resources for room state
    +--> requires: Cowork workspace (shared filesystem)
    +--> blocked by: MCP session state still evolving (2026 roadmap)
```

### Dependency Notes

- **MCP Server is the gateway**: Everything in v3.0 flows through the shared core library. Build this first.
- **Opportunity Bank before Funding Room**: Grants are discovered before they are managed. Discovery populates the pipeline.
- **Personas require room content**: Empty rooms produce empty personas. Personas are a mid/late-stage feature, not day-one.
- **Remote Room is highest-risk**: MCP collaborative session state is a 2026 roadmap item for the protocol itself. MindrianOS may need to work within limitations or use file-level locking as a workaround.
- **Cross-grant intelligence reuses cross-meeting architecture**: Same INFORMS/CONTRADICTS/CONVERGES pattern, different artifacts. Low incremental complexity.

---

## MVP Definition

### Launch With (v3.0 Core)

- [ ] **MCP Server with shared core** -- This IS v3.0. Desktop/Cowork users get nothing without it. Expose tools + resources + prompts.
- [ ] **mindrian-tools.cjs** -- CLI tools entry point. Enables hook scripts and agent tool calls.
- [ ] **Opportunity Bank room section** -- `room/opportunities/` with manual and agent-assisted discovery. Low complexity, high value signal.
- [ ] **Funding Room structure** -- `room/funding/` sub-rooms with per-grant folders. Structure only, intelligence later.
- [ ] **Basic grant lifecycle tracking** -- STATUS field per grant (Discovered > Researched > Applying > Submitted > Awarded/Rejected). Minimum viable pipeline.

### Add After Validation (v3.x)

- [ ] **Proactive grant scouting agent** -- Add once room content is typically populated enough to generate meaningful queries. Trigger: users asking "find me grants" manually more than twice.
- [ ] **AI Team Personas (auto-generated)** -- Add once room state is rich enough to produce non-generic personas. Trigger: users have 3+ methodology sessions and 2+ meetings filed.
- [ ] **Persona dependency chain** -- Add once single-persona interaction is validated. Trigger: users finding single persona responses valuable.
- [ ] **Cross-grant intelligence** -- Add once users have 3+ grants in pipeline. Trigger: users managing multiple grants simultaneously.
- [ ] **Room context injection in MCP prompts** -- Enhance prompts after basic prompts are working. Low complexity, high impact.
- [ ] **Room-aware grant matching** -- After proactive scouting proves useful. Requires room with content in 4+ sections.

### Future Consideration (v4+)

- [ ] **Remote Room (collaborative MCP)** -- Defer until MCP protocol stabilizes session state management. The 2026 MCP roadmap lists this as active work. Building on shifting foundations is risky.
- [ ] **Grant API integrations (Candid, Grants.gov)** -- Defer paid API integrations until grant feature adoption is validated. Start with manual discovery + web search agent.
- [ ] **Persona marketplace** -- Community-created persona templates. Only valuable with established user base.
- [ ] **Cross-user grant intelligence** -- Anonymized patterns from all users' grant outcomes. Requires significant user base (Brain flywheel).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Depends On |
|---------|------------|---------------------|----------|------------|
| MCP Server (shared core + tools) | HIGH | HIGH | P1 | Nothing (foundation) |
| MCP Resources (room state) | HIGH | MEDIUM | P1 | MCP Server |
| MCP Prompts (methodology) | MEDIUM | LOW | P1 | MCP Server |
| mindrian-tools.cjs | HIGH | LOW | P1 | Shared core |
| Opportunity Bank (room section) | MEDIUM | LOW | P1 | Room (exists) |
| Funding Room (structure) | MEDIUM | LOW | P1 | Room (exists) |
| Grant lifecycle tracking | MEDIUM | MEDIUM | P1 | Funding Room |
| Room context injection | HIGH | LOW | P2 | MCP Prompts |
| Proactive grant scouting | HIGH | HIGH | P2 | Opportunity Bank + room content |
| AI Team Personas (basic) | MEDIUM | MEDIUM | P2 | Room content + think-hats |
| Per-grant GSD process | MEDIUM | MEDIUM | P2 | Funding Room |
| Persona dependency chain | MEDIUM | MEDIUM | P2 | Basic personas |
| Cross-grant intelligence | MEDIUM | LOW | P2 | 3+ grants in pipeline |
| Room-aware matching | HIGH | HIGH | P3 | Proactive scouting |
| Remote Room (collaborative) | HIGH | HIGH | P3 | MCP Server + protocol maturity |
| Selective persona routing | LOW | LOW | P3 | Personas working |

**Priority key:**
- P1: Must ship for v3.0 to deliver value. MCP server + room expansion.
- P2: Makes v3.0 sticky. Proactive intelligence + personas.
- P3: Future expansion. Blocked by external dependencies or user base size.

---

## Competitor/Reference Analysis

### MCP Server Patterns

| Pattern | How Others Do It | Our Approach |
|---------|-----------------|--------------|
| CLI-to-MCP wrapping | CLI Wrapper (mcpmarket.com): JSON config maps CLI subcommands to MCP tools with type-safe params | mindrian-tools.cjs as CLI layer, shared core library for both CLI and MCP. Not a wrapper -- native dual delivery. |
| Resource exposure | Neo4j MCP: exposes graph data as resources with URI scheme | `room://` URI scheme for room sections. `room://state` for aggregated STATE.md. MIME type text/markdown. |
| Prompt templates | Standard pattern: static templates with typed arguments | Context-aware prompts: inject current room state before serving prompt. No other MCP server does this. |
| Tool granularity | Best practice: one clear purpose per tool. Avoid mega-tools. | One tool per command (41 tools). Group by category: methodology/, room/, meeting/, brain/. |

### Grant Discovery Tools

| Tool | What They Do | How We Differ |
|------|-------------|---------------|
| Instrumentl | All-in-one grant discovery + tracking. AI matching on mission. $179+/mo | We discover grants based on FULL room context (8 DD sections), not just mission statement. Integrated into venture workflow, not a separate tool. |
| Fundsprout | AI-powered discovery across 275K opportunities. RFP analysis. | Similar AI matching, but ours is embedded in the venture intelligence system. Grants inform the Data Room, not a separate silo. |
| Candid API | Programmatic grant search by subject, geography, population. REST API. Published daily. | Primary data source for our scouting agent. Candid provides data; we provide context-aware matching + room integration. |
| Grants.gov | Official federal grant listings. Keyword search. Free. | Secondary data source. We add intelligence layer on top of raw listings. |
| Apify SBIR Scraper | Scrapes NIH RePORTER, Grants.gov, Duke. Returns structured data. | Useful for SBIR-specific discovery. Integrate as one data source among several. |

### Grant Management Tools

| Tool | Lifecycle Coverage | How We Differ |
|------|-------------------|---------------|
| Fluxx | Full lifecycle from discovery to reporting. $49+/mo | We don't replace Fluxx for financial tracking. We handle strategic grant management: narrative development, alignment checking, cross-grant intelligence. |
| Submittable | Application management + review workflows | Submission-side tool. We're on the seeker side: find, prepare, track. |
| Asana/Monday for Grants | Generic project management adapted for grants | No venture intelligence integration. We connect grants to room state: "This grant aligns with your market analysis." |

### AI Persona Systems

| System | Approach | How We Differ |
|--------|---------|---------------|
| PartyKit Thinking Hats | Each hat = separate chat room with dedicated AI chatbot. Spatial UI. | We already have think-hats command. Personas extend this: not just hats, but domain experts generated from room content. |
| Jenova AI Role Creation | Business-focused persona generation for operations. Generic roles. | Our personas are venture-specific: generated FROM the room's actual data, not generic role templates. |
| PRISM (arXiv 2603.18507) | Intent-based persona routing. Activates personas only when beneficial. | Apply PRISM insight: personas for analysis/synthesis, NOT for knowledge retrieval. Larry stays as the knowledge layer. |
| Mandal (2026) Coherence Cascade | 10-step dependency chain of specialized personas. Sequential, each reads prior. | Directly applicable to our pipeline chaining. Market Expert > Technical Expert > Financial Expert > Devil's Advocate. Each reads all prior outputs. |

---

## Grant API Landscape (for Proactive Scouting)

| API/Source | Access | Data Quality | Cost | Best For |
|------------|--------|-------------|------|----------|
| **Candid Grants API** | REST, API key, published daily | HIGH -- compiled from 990s, direct reporting, multiple sources | Paid (tiered) | Foundation/private grants, funder intelligence |
| **Grants.gov API** | REST, free | HIGH -- official federal source | Free | Federal grants only |
| **Apify SBIR Scraper** | REST, Apify account | MEDIUM -- scraped, may lag | Pay-per-use (Apify credits) | SBIR/STTR/NIH specifically |
| **OpenGrants** | No public API (web only) | MEDIUM -- 20K+ curated opportunities | Subscription | Broad discovery, consultant marketplace |
| **Web search (Tavily/Brave)** | Via existing MCP tools | LOW -- unstructured, noisy | Existing tool cost | Catch-all for grants not in databases |

**Recommendation:** Start with Grants.gov (free, federal) + web search (already available). Add Candid API when grant feature adoption justifies the cost. SBIR scraper for tech ventures specifically.

---

## Persona Architecture Insights

### What Makes Personas Useful (Research-Backed)

1. **Constrained specialization**: Each persona focuses on ONE domain, takes everything else as given (Mandal 2026)
2. **Sequential dependency**: Persona B reads Persona A's output. Creates coherence cascade. (Mandal 2026)
3. **Generated from data, not templates**: Personas built from room content produce venture-specific insights. Generic "market expert" prompts produce generic advice. (PersonaCite, arXiv 2601.22288)
4. **Selective activation**: Use personas for analysis/synthesis/challenge. Never for factual recall. (PRISM, arXiv 2603.18507)

### What Makes Personas Gimmicky (Research-Backed)

1. **Generic role prompts**: "You are a marketing expert" without context produces canned advice
2. **Blanket persona application**: Applying personas to ALL tasks damages accuracy on knowledge retrieval (PRISM)
3. **No dependency chain**: Independent personas contradict each other. No coherence. (Mandal 2026)
4. **Persona as personality gimmick**: Adding a name and backstory without domain constraint is theater, not intelligence

### MindrianOS Persona Design Principles

- Personas are **generated from room state**, not predefined templates
- Personas follow **De Bono's Six Hats** as structural framework (already built: think-hats command)
- Personas are **chained via pipeline** (Week 7 pattern), each reading prior outputs
- Personas are **never used for knowledge retrieval** -- Larry handles that
- Personas are **stateless** -- regenerated from current room state each invocation
- Personas can include **team-member-informed perspectives** -- if room/team/ has profiles with domain expertise, personas can represent "what would [team member role] think?"

---

## Sources

### MCP Server Patterns
- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25) -- HIGH confidence
- [WorkOS MCP Features Guide](https://workos.com/blog/mcp-features-guide) -- HIGH confidence (tools/resources/prompts breakdown)
- [2026 MCP Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) -- HIGH confidence (session state, scalability)
- [CLI Wrapper MCP Pattern](https://mcpmarket.com/server/cli-wrapper) -- MEDIUM confidence (wrapping pattern)
- [MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md) -- MEDIUM confidence
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/) -- MEDIUM confidence

### Grant Discovery & Management
- [Fundsprout: 12 Best Grant Discovery Platforms 2026](https://www.fundsprout.ai/resources/grant-discovery-platforms) -- MEDIUM confidence
- [Candid Grants API Developer Portal](https://developer.candid.org/) -- HIGH confidence (official)
- [Grants.gov Grant Lifecycle](https://www.grants.gov/learn-grants/grants-101/the-grant-lifecycle) -- HIGH confidence (official)
- [Instrumentl: Grant Application Pipelines](https://www.instrumentl.com/blog/how-to-create-grant-application-pipelines) -- MEDIUM confidence
- [Apify SBIR Grants Scraper](https://apify.com/parseforge/sbir-government-grants-scraper/api) -- MEDIUM confidence
- [Optimy: Grant Management System Guide 2026](https://www.optimy.com/blog-optimy/grant-management-system) -- MEDIUM confidence

### AI Personas
- [PRISM: Expert Personas Improve Alignment but Damage Accuracy (arXiv 2603.18507)](https://arxiv.org/html/2603.18507) -- HIGH confidence (peer research)
- [Mandal: Role-Based Agent Personas -- Specialization Beats Generalization](https://www.sagarmandal.com/2026/03/15/agentic-engineering-part-3-role-based-agent-personas-why-specialization-beats-generalization/) -- MEDIUM confidence
- [PersonaCite: Agentic Synthetic AI Personas (arXiv 2601.22288)](https://arxiv.org/html/2601.22288v1) -- HIGH confidence (peer research)
- [Jenova AI: AI Persona Simulation](https://www.jenova.ai/en/resources/ai-persona-simulation) -- LOW confidence (vendor)

### Collaborative MCP / Remote Room
- [MCP 2026 Roadmap -- Session State](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) -- HIGH confidence
- [MCP Transport Future](https://blog.modelcontextprotocol.io/posts/2025-12-19-mcp-transport-future/) -- MEDIUM confidence
- [WorkOS: MCP Enterprise Readiness](https://workos.com/blog/2026-mcp-roadmap-enterprise-readiness) -- MEDIUM confidence

---
*Feature research for: MindrianOS v3.0 MCP Platform & Intelligence Expansion*
*Researched: 2026-03-24*
*Prior version archived: FEATURES-v1.md (v1.0 research from 2026-03-19)*
