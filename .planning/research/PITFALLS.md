# Domain Pitfalls

**Domain:** Adding MCP server delivery, shared core, remote room, Opportunity Bank, Funding Room, and AI Personas to existing 41-command Claude Code plugin
**Researched:** 2026-03-24

## Critical Pitfalls

Mistakes that cause rewrites, architectural dead-ends, or broken existing functionality.

### Pitfall 1: Tool Explosion Kills MCP Server Usability

**What goes wrong:** The plugin has 41 commands. Naively exposing each as an MCP tool means 41+ tool definitions injected into Desktop/Cowork context before any conversation starts. Real-world data shows 5 MCP servers with 30 tools each consume 30,000-60,000 tokens just in tool metadata -- 25-30% of a 200K context window. Cursor hard-limits at 40 MCP tools total. Claude Desktop users connecting MindrianOS MCP alongside GitHub MCP and a filesystem MCP will hit tool selection failures where the LLM misfires on similarly-named tools (e.g., `analyze_needs` vs `analyze_systems` vs `analyze_timing`).

**Why it happens:** Direct mapping from CLI commands to MCP tools feels natural -- "just expose everything." But CLI commands are human-navigated (users read help text, pick deliberately). MCP tools are LLM-navigated (fuzzy pattern matching on tool names and descriptions). The navigation model is fundamentally different.

**Consequences:** Desktop/Cowork users get worse responses than CLI users because tool metadata drowns the context. Tool selection accuracy drops. Users blame Larry, not the tool count. The MCP server becomes a liability instead of an expansion.

**Warning signs:**
- MCP tool descriptions total more than 15K tokens
- LLM selects wrong methodology tool (e.g., calls `explore_trends` when user asked for `explore_domains`)
- Desktop sessions hit compaction faster than CLI sessions
- Users on Desktop report Larry "not knowing" capabilities that work fine on CLI

**Prevention:**
- Use a hierarchical router pattern: expose 5-8 high-level tools (e.g., `larry_methodology`, `data_room`, `meeting`, `pipeline`, `export`) that internally dispatch to specific commands
- Each high-level tool takes a `command` parameter with an enum of sub-commands -- this is how gsd-tools.cjs already works
- Use MCP Resources (not Tools) for read-only data like room state, meeting archives, and knowledge graph views -- Resources are application-controlled, not model-controlled, so they do not bloat the tool selection prompt
- Keep total MCP tool count under 15, ideally under 10
- Test tool selection accuracy by asking ambiguous questions and measuring whether the right tool fires

**Detection:** Count total token cost of MCP tool definitions. Anything over 10K tokens is a red flag. Log tool selection accuracy on Desktop.

**Phase to address:** Phase 1 (MCP server design). Tool surface must be designed before any tools are implemented. Retrofitting a hierarchical router onto 41 flat tools is a rewrite.

---

### Pitfall 2: Shared Core Extraction Breaks Existing Plugin Commands

**What goes wrong:** The plugin currently has 41 working commands, 20 scripts, 6 skills, 5 agents, and 3 hooks that work as an integrated unit. Extracting a "shared core" library so both the plugin AND the MCP server can use the same logic requires touching every command's internals. A premature abstraction -- pulling out shared logic before fully understanding how MCP tools differ from CLI commands -- creates a wrong abstraction that both consumers must work around with parameters and conditional paths. Sandi Metz's law: "duplication is far cheaper than the wrong abstraction."

**Why it happens:** DRY principle feels correct. The instinct is "extract shared logic first, then build MCP tools on top." But the plugin's commands were designed for Claude-reads-markdown orchestration (CLI), while MCP tools are JSON-schema functions called by any MCP client. Input validation, output formatting, error handling, and state management differ between the two surfaces. Abstracting before understanding these differences produces a shared core that serves neither surface well.

**Consequences:** Existing plugin commands that worked perfectly start failing because shared core refactoring changed their assumptions. Two bug surfaces (plugin AND MCP) instead of one. The shared core accumulates conditional branches (`if (surface === 'cli') ... else if (surface === 'mcp') ...`) until it is harder to maintain than two separate implementations would have been.

**Warning signs:**
- Shared functions taking a `surface` or `mode` parameter to change behavior
- Plugin command tests failing after "no-op" refactoring to extract shared core
- MCP tools that return data in a format that only makes sense for CLI rendering
- More than 3 abstraction layers between user request and actual file I/O

**Prevention:**
- Follow the Rule of Three: do NOT extract shared logic until you have implemented the same operation three times (CLI command, MCP tool, and one more consumer like the dashboard)
- Start with duplication: copy plugin logic into MCP tool handlers. Let duplicated code show you what is actually shared vs. what only appears similar
- Extract bottom-up, not top-down: share utility functions (file reading, state computation, room path resolution) before sharing high-level orchestration
- Keep the existing plugin commands completely untouched during initial MCP development. MCP tools can call the same scripts the hooks already call -- the scripts/ directory IS the shared core
- The scripts/ directory (compute-state, analyze-room, build-graph, etc.) is already surface-agnostic. Point MCP tools at these same scripts rather than refactoring commands

**Detection:** Run the full existing test suite after every shared core change. Any failing test means the extraction went too far.

**Phase to address:** Phase 1 (shared core design). The decision of WHAT to share must happen before any extraction. But actual extraction should be gradual across phases, not a big-bang refactor.

---

### Pitfall 3: Remote Room MCP Exposes User Data Without Auth

**What goes wrong:** "Room as Remote MCP" means a user's Data Room -- containing meeting transcripts, speaker profiles with web-researched backgrounds, financial models, competitive analysis, team assessments -- becomes accessible over a network. The MCP specification's authentication is optional and the SDK has no built-in auth mechanisms. A 2026 Trend Micro survey found 492 MCP servers publicly exposed with zero client authentication. If the Room MCP launches without auth, anyone who discovers the endpoint gets full read access to proprietary venture intelligence.

**Why it happens:** Local MCP via stdio is inherently secure (same machine, same user). The jump to remote MCP feels like "just change the transport." But stdio-to-HTTP changes the threat model entirely: network exposure, credential management, session persistence, token handling. Developers building for a small team ("it's just us three") skip auth, then the server gets discovered or shared beyond the intended group.

**Consequences:** Venture-sensitive data leaks: investor conversations, competitive intelligence, team assessments, financial projections. Even "read-only" leaks of meeting transcripts could expose confidential discussions. Legal liability for the platform. Trust destruction with early adopters.

**Warning signs:**
- Remote MCP endpoint accessible without any token or credential
- Credentials stored in plaintext in config files
- No audit trail of who accessed what room data
- HTTP (not HTTPS) used in any configuration example or documentation
- Long-lived static tokens with no expiry or rotation

**Prevention:**
- Phase 1: Ship Room MCP as stdio-only (local collaborative access via shared filesystem or git). Remote comes later
- When remote is added: implement OAuth 2.1 per MCP spec, with Resource Indicators (RFC 8707) to scope tokens to specific rooms
- Never expose the full room -- use MCP Resources with explicit user selection of what to share, not blanket access
- Implement per-room access control: room owner grants read/write per team member
- All remote transport must be Streamable HTTP over TLS (HTTPS only), never plain HTTP
- Store no credentials in the MCP server config file -- use environment variables or a credential store
- Log all remote access with timestamp, user identity, and accessed resource

**Detection:** Security audit before any remote MCP release. Penetration test the endpoint. Check for plaintext credentials in any config file.

**Phase to address:** Phase 3 (Room as Remote MCP). Must NOT ship remote access without auth. If auth is not ready, ship local-only and defer remote.

---

### Pitfall 4: Feature Parity Drift Between Plugin and MCP Surfaces

**What goes wrong:** The dual delivery rule says "every feature ships as both a plugin command and MCP tool." In practice, the plugin gets features first (it is the development environment), and MCP tools lag behind. Over time: plugin has 45 commands, MCP server has 30 tools. A user on Desktop asks Larry to "file this meeting" and gets "I don't have that capability" while CLI users have had it for weeks. The surfaces drift apart silently because there is no automated check for parity.

**Why it happens:** Developers naturally build and test on the surface they use (CLI). MCP tools require additional work (schema definition, input validation, output formatting). When under deadline pressure, the MCP version gets deferred. There is no CI check that flags "command X exists without corresponding MCP tool Y." Documentation drifts as well: the help command lists capabilities that only exist on one surface.

**Consequences:** Users who discover MindrianOS on Desktop (the intended growth surface for non-technical team members) get a degraded experience compared to CLI. User reports of "missing features" that actually exist but only on the other surface. Support burden increases. The "one product, two surfaces" promise erodes into "two half-products."

**Warning signs:**
- MCP tool count diverges from plugin command count with no tracking
- User reports of missing features that exist on the other surface
- Release notes mention features without specifying which surfaces support them
- No automated parity test in CI

**Prevention:**
- Maintain a parity matrix (command name, CLI status, MCP status, last verified date) as a checked-in file that CI validates
- Build MCP tool and plugin command simultaneously -- never ship one without at least a stub for the other
- The mindrian-tools.cjs entry point (GSD pattern) should serve both surfaces: CLI commands call it, MCP tools call it. Same entry point = automatic parity
- Use schema drift detection (Specmatic-style): tool schema in MCP must match command signature in plugin
- Each release must include a parity check as part of the release process

**Detection:** CI job that compares the list of commands/ files against the MCP server's tool registry. Any mismatch fails the build.

**Phase to address:** Phase 1 (architecture). The mindrian-tools.cjs pattern must be established from the start. Parity checks in CI from Phase 2 onward.

---

### Pitfall 5: MCP Transport Choice Locks Out Desktop/Cowork Users

**What goes wrong:** Claude Desktop requires MCP servers configured via claude_desktop_config.json. If the Room MCP uses Streamable HTTP (the modern transport), but Claude Desktop only supports stdio for local servers, the server never connects. Conversely, if you build stdio-only, remote collaborative access (the whole point of Room as Remote MCP) is impossible. SSE transport was deprecated in MCP spec 2026-03-26, so building on SSE creates immediate tech debt.

**Why it happens:** The MCP transport landscape shifted in early 2026. SSE was deprecated in favor of Streamable HTTP. But client support varies: Claude Desktop supports stdio natively for local servers. Streamable HTTP is the standard for remote servers. Building for one transport without planning for the other leaves a surface unsupported.

**Consequences:** Desktop users cannot connect to Room MCP. Or: remote team members cannot access shared room state. The collaborative access promise -- the core value of v3.0 -- fails at the transport layer before any feature code runs.

**Warning signs:**
- MCP server only implements one transport
- No testing of the server with Claude Desktop's actual config loading
- Windows users hit path issues with stdio (must use `cmd /c` wrapper)
- Config examples use hardcoded paths that break cross-platform

**Prevention:**
- Implement both stdio (for local Desktop/CLI) and Streamable HTTP (for remote/Cowork) from the start
- stdio for local: zero-config, same-machine access. This is the default
- Streamable HTTP for remote: requires auth, TLS, deployed endpoint. This is the upgrade path
- Test with actual Claude Desktop on Windows, Mac, and Linux -- path handling differs
- Use the `command` + `args` pattern in claude_desktop_config.json that is proven to work (node path to server script)
- Never use SSE -- it is officially deprecated

**Detection:** Integration test: install MCP server, add to claude_desktop_config.json, verify tools appear in Claude Desktop. Test on all three platforms.

**Phase to address:** Phase 1 (MCP server skeleton). Transport must be dual from the start. Adding a second transport later requires architectural changes.

## Moderate Pitfalls

### Pitfall 6: Opportunity Bank / Funding Room Scope Creep Into Full CRM

**What goes wrong:** "Opportunity Bank" starts as a room section with proactive grant discovery. Feature requests expand it: track application status, manage deadlines, store reviewer contacts, log follow-ups, integrate with grant portals, generate compliance reports. The Funding Room similarly expands: dilutive vs. non-dilutive sub-rooms, investor pipeline tracking, term sheet comparison, cap table modeling. Before you know it, you are building Salesforce inside a Claude Code plugin.

**Why it happens:** Grant and funding workflows are inherently complex. Each user has a slightly different process. The temptation is to accommodate every workflow variation. The plugin's file-based architecture (markdown in folders) makes it easy to add "just one more section" without feeling the weight of the feature.

**Consequences:** Months spent on grant/funding workflow features that 10% of users need. The core value proposition (Larry + methodology + Data Room intelligence) gets neglected. The plugin becomes bloated with specialized features. Context budget consumed by funding management skills that most users never trigger.

**Warning signs:**
- Opportunity Bank has more than 5 custom fields per opportunity
- Funding Room sub-rooms exceed 3 levels of nesting
- Users request features that exist in dedicated grant management tools (GrantHub, Submittable)
- The pipeline logic requires date tracking, reminders, and external API calls

**Prevention:**
- Opportunity Bank is a ROOM SECTION, not a product. It stores structured insights about opportunities, filed by Larry from meetings and research. Maximum: opportunity name, source, relevance score, status (discovered/evaluating/applying/awarded/passed), and notes
- Funding Room follows GSD-style process: each grant/opportunity gets a sub-folder with a simple state file. No custom fields, no deadline management, no external API integration
- Explicitly OUT OF SCOPE: application form filling, deadline reminders, reviewer contact management, compliance tracking, cap table modeling. These are solved problems with dedicated tools
- The intelligence value is in DISCOVERY and CONNECTIONS: "This grant's focus areas overlap with your problem definition and market analysis." That is what Larry does. The workflow management is someone else's problem
- If a user asks for CRM features, the answer is: "Integrate with your existing tool via MCP" (many CRM MCP servers exist)

**Phase to address:** Phase 3 (Opportunity Bank) and Phase 4 (Funding Room). Scope must be locked before implementation begins.

---

### Pitfall 7: AI Team Personas That Hallucinate Expertise They Do Not Have

**What goes wrong:** AI Team Member Personas are "domain experts generated from room intelligence + Bono perspectives." The persona for "CFO perspective" confidently generates financial projections with no grounding in real financial data. The "Legal counsel" persona gives regulatory guidance that sounds authoritative but is fabricated. Users treat persona outputs as expert opinions because the persona's name and framing implies expertise. Research shows domain-specific hallucination rates remain high: legal (18.7%), medical (15.6%), coding (17.8%).

**Why it happens:** The persona is a prompt wrapper around the same LLM. Adding a persona name ("Sarah, CFO") and role description does not give the LLM actual financial expertise. But the framing creates trust: users rated AI-generated persona outputs as more credible when the persona had a name and role, even when the outputs were identical to non-persona outputs. The anthropomorphization effect is documented and measurable.

**Consequences:** Users make venture decisions based on hallucinated "expert" advice. Legal liability if a "legal counsel" persona gives incorrect regulatory guidance. Reputation damage when users discover personas are just prompt wrappers. Over-anthropomorphization creates emotional attachment to personas that provide no real value.

**Warning signs:**
- Personas make specific claims about regulations, tax codes, or legal requirements
- Personas generate numerical projections (financial, market sizing) without citing sources
- Users reference persona opinions in investor meetings as if from real advisors
- Personas maintain consistent "personalities" across sessions but inconsistent factual claims

**Prevention:**
- Personas must be explicitly framed as PERSPECTIVE TOOLS, not expert advisors. Use De Bono's thinking hats framing: "This is the financial perspective on your venture" not "This is your CFO Sarah's analysis"
- Every persona output must include a disclaimer: "This perspective is generated from your room data and general knowledge. It is not professional [financial/legal/technical] advice"
- Personas ONLY synthesize from room data -- they do not generate new facts. A financial perspective says "Your room data shows X revenue projection -- here are questions to validate it" not "Based on market conditions, revenue should be Y"
- Limit persona capabilities: perspectives and questions, never recommendations or projections
- Brain-enriched personas (Tier 1) can reference teaching graph connections but still must not fabricate domain-specific facts
- Track if users are over-relying on persona outputs by monitoring citation patterns

**Detection:** Review persona outputs for specific factual claims not grounded in room data. Any financial projection, legal citation, or regulatory claim not traceable to a room artifact is a hallucination.

**Phase to address:** Phase 5 (AI Personas). Ship as "perspective lenses" not "team members." The framing prevents the worst outcomes.

---

### Pitfall 8: Shared Core Introduces Abstraction Layers That Obscure Debugging

**What goes wrong:** The current plugin is debuggable: a command is a markdown file, a script is a Node.js file, a hook calls a script. When something breaks, the path from symptom to cause is short. Introducing a shared core library (mindrian-core) adds indirection: command calls core function, core function calls utility, utility reads config, config determines behavior. When a meeting filing fails on MCP, the debugging path now traverses the MCP transport layer, the tool handler, the core library, the utility functions, and the filesystem operations. Five layers instead of two.

**Why it happens:** Good software engineering says "extract common logic." But each abstraction layer adds debugging cost. In a plugin environment where the developer cannot attach a debugger (Claude Code runs the code, not you), extra layers are especially painful. Stack traces through abstraction layers are harder to read in log output than direct file-to-function paths.

**Prevention:**
- Keep the abstraction stack shallow: maximum 3 layers (entry point -> business logic -> file I/O)
- Use the existing scripts/ directory as the shared core. Scripts are already standalone Node.js files that can be called from hooks, commands, or MCP tool handlers
- Every shared function must include structured logging with the calling context (which surface, which command/tool, which room)
- Avoid class hierarchies and inheritance -- use simple functions that take explicit parameters
- Each MCP tool handler should be a thin wrapper around a script call, not a deep abstraction chain

**Phase to address:** Phase 1-2 (shared core design). Keep it flat and obvious.

---

### Pitfall 9: Remote Room File Conflicts from Concurrent Team Access

**What goes wrong:** Room as Remote MCP means multiple team members can modify the same room simultaneously. User A files a meeting while User B runs a methodology session that writes to the same room section. Both write to STATE.md. Last writer wins. User A's meeting filing overwrites User B's methodology output, or vice versa. There is no locking mechanism in the file-based room architecture.

**Why it happens:** The room was designed for single-user access (one Claude instance, one filesystem). The ICM architecture (folder structure IS orchestration) assumes one writer at a time. Extending to multi-user access without adding concurrency control is like sharing a Google Doc without the collaboration engine -- just a file that two people overwrite.

**Consequences:** Lost data. Corrupted STATE.md files. Meeting archives that are partially overwritten by concurrent methodology sessions. User trust destruction when work disappears.

**Warning signs:**
- Multiple users writing to the same room within the same minute
- STATE.md content that does not match the filesystem (classic drift, now caused by concurrent writes)
- Room sections with entries that reference artifacts that do not exist (written by one user, overwritten by another)

**Prevention:**
- Phase 1 (local MCP): Room access is single-writer via stdio -- no concurrency issue. Ship this first
- Phase 2 (remote MCP): Use git as the concurrency layer. Room IS a git repository. Each team member's Claude instance works on a branch. Merges happen explicitly (or via auto-merge for non-conflicting files)
- Alternative: Cowork already handles collaboration natively. Room as Remote MCP should leverage Cowork's 00_Context/ shared state rather than building custom concurrency
- At minimum: file-level locking via lockfiles (write a `.lock` file before modifying, remove after). Not perfect but prevents the worst corruption
- STATE.md should be computed (regenerated from filesystem), never incrementally updated. Concurrent regeneration produces the same result -- idempotent
- Clearly document which room operations are safe for concurrent access (reading) and which require coordination (writing)

**Detection:** Integration test with two simultaneous writers to the same room section. If data is lost, the concurrency model is broken.

**Phase to address:** Phase 3 (Room as Remote MCP). Must have a concurrency strategy before shipping remote write access.

---

### Pitfall 10: Testing Burden Doubles Without Test Infrastructure

**What goes wrong:** Before v3.0: test the plugin on CLI. After v3.0: test every feature on CLI (plugin command), Desktop (MCP tool via claude_desktop_config.json), and Cowork (MCP tool via shared context). That is 3x the test surface. Manual testing of 41 commands across 3 surfaces = 123 test scenarios per release. Without automation, releases slow to a crawl or ship untested.

**Why it happens:** The v1.0/v2.0 testing was manageable because it was one surface. Adding MCP doubles the delivery layer. Adding remote access triples the configuration space. Each new surface introduces platform-specific bugs (Windows path handling, macOS permission dialogs, Linux environment differences).

**Consequences:** Regressions ship undetected. Features that work on the developer's surface break on users' surfaces. Release cadence slows. Quality degrades as the team manually tests an ever-growing matrix.

**Prevention:**
- Build the parity test framework in Phase 1: a script that validates every command has a corresponding MCP tool and vice versa
- Automated integration tests that call MCP tools via the MCP inspector (available in the SDK) -- no need for a full Claude Desktop instance
- Use schema drift detection: tool schemas defined in code must match the actual tool behavior
- Focus manual testing on the happy path for each surface. Automated tests cover edge cases
- Consider a test matrix that prioritizes: CLI (primary dev surface), Desktop (primary user surface), Cowork (team surface). Not everything needs testing on all three -- prioritize based on feature usage patterns

**Phase to address:** Phase 1 (test infrastructure). Must exist before any MCP tools are built. Every subsequent phase adds tests, not test infrastructure.

## Minor Pitfalls

### Pitfall 11: MCP Resource URIs That Break Across Operating Systems

**What goes wrong:** MCP Resources use URIs (`file:///path/to/room/state.md`). Windows paths use backslashes and drive letters (`C:\Users\...`). Linux/Mac use forward slashes. If resource URIs are constructed by string concatenation from filesystem paths, they break on at least one platform.

**Prevention:** Use Node.js `url.pathToFileURL()` for all resource URI construction. Never construct URIs from strings. Test on Windows explicitly.

**Phase to address:** Phase 1 (MCP server implementation).

---

### Pitfall 12: Opportunity Discovery Agents Burn API Credits on Low-Value Searches

**What goes wrong:** "Proactive grant/opportunity discovery agents" run web searches and API calls to find relevant grants. Each search costs API credits (Brain MCP calls, web search tool calls). If the agent runs on every session start or room analysis, it burns credits on searches that return the same results as yesterday.

**Prevention:** Cache discovery results with a 7-day TTL. Only re-search when room content changes significantly (new section filled, new meeting filed). Rate-limit discovery to once per day maximum. Show users the cost: "Discovery agent used 3 searches. Found 2 new opportunities."

**Phase to address:** Phase 3 (Opportunity Bank).

---

### Pitfall 13: Funding Room Status Tracking Without Notifications Creates Stale Data

**What goes wrong:** Grant applications have deadlines, reviewer feedback rounds, and status changes. If the Funding Room tracks status but has no notification mechanism (no email, no calendar, no external integration), statuses go stale. A grant marked "submitted" stays "submitted" forever because nobody remembers to update it.

**Prevention:** Do NOT build notification infrastructure. The Funding Room is a snapshot tool, not a workflow engine. Larry can remind users during SessionStart: "You have 2 grants in 'submitted' status -- any updates?" This is conversational, not infrastructure.

**Phase to address:** Phase 4 (Funding Room).

---

### Pitfall 14: Brain MCP Becomes Required Dependency for New v3.0 Features

**What goes wrong:** v1.0 and v2.0 followed the "Tier 0 fully functional" principle -- Brain enhances but is never required. New v3.0 features (AI Personas that reference teaching graph, Opportunity Bank that uses Brain for relevance scoring, Funding Room that uses graph intelligence for grant matching) quietly require Brain MCP to function well. Tier 0 degradation goes from "slightly less intelligent" to "basically broken."

**Warning signs:**
- New features have code paths that only execute when Brain is connected
- Tier 0 testing is skipped because the developer always has Brain connected
- AI Persona quality is dramatically worse without Brain enrichment
- Opportunity relevance scoring returns generic results without Brain

**Prevention:** Test every new feature with Brain MCP disconnected FIRST. If Tier 0 is not useful, the feature design is wrong. Brain should add depth and precision, not enable basic functionality. Add a CI check that runs tests without Brain MCP configured.

**Phase to address:** Every phase. This is a standing principle, not a one-time fix.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| MCP server design | Tool explosion (41 tools = context death) | Hierarchical router, max 10 tools, use Resources for read-only data |
| Shared core extraction | Breaking existing 41 commands during refactor | Scripts/ IS the shared core. Point MCP tools at scripts, don't refactor commands |
| CLI tools layer (mindrian-tools.cjs) | Duplicating logic already in scripts/ | Single entry point that dispatches to existing scripts |
| Room as Remote MCP | User data exposure without auth | Ship stdio-only first, add auth before remote |
| Room as Remote MCP | Concurrent write conflicts | Git-based branching, or Cowork-native collaboration |
| Opportunity Bank | Scope creep into full CRM | Room section only: discovery + connections, not workflow management |
| Funding Room | Building notification/deadline infrastructure | Conversational reminders via Larry, no infrastructure |
| AI Personas | Hallucinated expert advice users trust | Perspective lenses, not experts. Disclaimer on every output |
| AI Personas | Over-anthropomorphization | De Bono hats framing, never give personas proper names |
| Dual delivery (CLI + MCP) | Feature parity drift | Parity matrix in CI, shared entry point (mindrian-tools.cjs) |
| Dual delivery testing | 3x test surface without automation | Parity tests + MCP inspector automation from Phase 1 |
| Transport choice | SSE deprecated, stdio-only locks out remote | Dual transport: stdio (local) + Streamable HTTP (remote) |
| Brain dependency | New features quietly require Brain | Test every feature Brain-disconnected first |

## Sources

- [Why MCP Tool Overload Happens and How to Solve It](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) -- Tool explosion data, 150 tools = 30-60K tokens (MEDIUM confidence)
- [MCP Tool Count Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1251) -- ~50 tool practical limit, Cursor 40-tool hard cap (MEDIUM confidence)
- [MCP Best Practices by Phil Schmid](https://www.philschmid.de/mcp-best-practices) -- Focused server design, workflow-oriented tools (MEDIUM confidence)
- [MCP Server Best Practices 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026) -- Resource modeling, tool vs resource distinction (MEDIUM confidence)
- [MCP Resources Spec](https://modelcontextprotocol.info/docs/concepts/resources/) -- Resources are read-only, application-controlled (HIGH confidence)
- [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- SSE deprecated, Streamable HTTP standard (HIGH confidence)
- [SSE vs Streamable HTTP](https://brightdata.com/blog/ai/sse-vs-streamable-http) -- Why MCP deprecated SSE (MEDIUM confidence)
- [MCP Security Survival Guide](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/) -- Auth pitfalls, 492 exposed servers (MEDIUM confidence)
- [Securing MCP Servers](https://www.infracloud.io/blogs/securing-mcp-servers/) -- OAuth 2.1, credential management (MEDIUM confidence)
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) -- Official auth guidance (HIGH confidence)
- [Specmatic MCP Schema Drift Detector](https://specmatic.io/updates/testing-mcp-servers-how-specmatic-mcp-auto-test-catches-schema-drift-and-automates-regression/) -- Automated parity testing (MEDIUM confidence)
- [The Wrong Abstraction by Sandi Metz](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) -- Premature abstraction costs (HIGH confidence)
- [Rule of Three for Refactoring](https://understandlegacycode.com/blog/refactoring-rule-of-three/) -- When to extract shared code (HIGH confidence)
- [AI-Generated Personas and Hallucination Risk](https://dl.acm.org/doi/10.1145/3708359.3712160) -- Users trust hallucinated persona outputs (MEDIUM confidence)
- [Generative AI Personas Considered Harmful](https://www.sciencedirect.com/science/article/pii/S1071581925002149) -- 20 challenges of algorithmic personas (MEDIUM confidence)
- [AI Hallucination Statistics 2026](https://suprmind.ai/hub/insights/ai-hallucination-statistics-research-report-2026/) -- Domain-specific hallucination rates (MEDIUM confidence)
- [Dangers of Anthropomorphizing AI](https://openethics.ai/when-machines-feel-too-real-the-dangers-of-anthropomorphizing-ai/) -- Trust and over-reliance risks (MEDIUM confidence)
- [Claude Desktop MCP Setup](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) -- Official Desktop MCP config (HIGH confidence)
- [MCP Config File Guide](https://mcpplaygroundonline.com/blog/complete-guide-mcp-config-files-claude-desktop-cursor-lovable) -- Cross-platform config pitfalls (MEDIUM confidence)
