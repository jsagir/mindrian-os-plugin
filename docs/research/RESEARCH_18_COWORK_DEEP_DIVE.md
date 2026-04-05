# RESEARCH 18: Claude Cowork Deep Dive

**Date:** 2026-04-03
**Objective:** Understand Cowork architecture, capabilities, and integration surface for MindrianOS
**Overall Confidence:** MEDIUM-HIGH (strong on current features, some gaps on internals)

---

## 1. Current Capabilities (Verified)

### What Cowork IS

Cowork is Claude operating as an autonomous desktop agent inside a sandboxed Linux VM on your machine. It reads, writes, and creates files in folders you explicitly grant access to. It runs multi-step tasks, coordinates sub-agents, connects to external services via MCP, and can be triggered on schedules or from your phone via Dispatch.

**Key distinction from Claude Code:** Cowork targets non-technical knowledge workers with a GUI-first experience. Claude Code targets developers with a CLI-first experience. Both share the same underlying agent architecture (Claude Agent SDK), plugin format, and MCP protocol.

### Platform Availability

| Platform | Launch Date | Status |
|----------|------------|--------|
| macOS | Jan 12, 2026 | GA (research preview label) |
| Windows | Feb 10, 2026 | GA, full feature parity |
| Mobile (Dispatch) | Jan 2026 | iOS companion for remote task assignment |
| Android | Q2 2026 (planned) | Beta |

### Plan Access

| Plan | Price | Cowork Access | Notes |
|------|-------|---------------|-------|
| Free | $0 | NO | No Cowork |
| Pro | $20/mo | YES | Full Cowork |
| Max 5x | $100/mo | YES | 5x Pro usage |
| Max 20x | $200/mo | YES | 20x Pro usage |
| Team Standard | $20-25/seat/mo | YES | Min 5 seats, max 150 |
| Team Premium | $100-125/seat/mo | YES | 5x standard usage |
| Enterprise | Custom | YES | SSO, SCIM, audit logs, admin controls |

**Confidence: HIGH** - sourced from official pricing page and help center.

### Core Feature Set (as of April 2026)

1. **File operations** - Read, write, create, delete within mounted folders
2. **Sub-agent coordination** - Parallel task execution (10 files in ~4 min vs ~30 min serial)
3. **MCP connectors** - 25+ enterprise connectors (Google Workspace, Slack, DocuSign, FactSet, Apollo, etc.)
4. **Plugins** - Skills + connectors + slash commands + sub-agents bundled as markdown files
5. **Scheduled tasks** - Recurring or on-demand via `/schedule`
6. **Dispatch** - Persistent phone-to-desktop conversation thread for remote task assignment
7. **Computer use** - Point, click, navigate screen (shipped March 2026)
8. **Projects** - Persistent workspaces with memory, instructions, files, and scheduled tasks
9. **Plugin Create** - Built-in wizard for authoring custom plugins
10. **Global and folder instructions** - Context that persists across sessions

---

## 2. Architecture Details

### VM Sandbox Architecture

**Confidence: HIGH** - multiple technical sources confirm.

Cowork runs inside a lightweight Linux VM:

- **macOS:** Uses Apple's `VZVirtualMachine` framework (same tech as Docker Desktop on macOS)
- **Windows:** Equivalent VM isolation (details less documented, but full parity confirmed)
- **VM image:** Custom Linux root filesystem, ARM64 on Apple Silicon

**Security layers (defense in depth):**

1. **Hard isolation** - VZVirtualMachine framework boots custom Linux rootfs. Agent can ONLY access explicitly mounted folders.
2. **Soft isolation** - Inside VM: bubblewrap + seccomp confines processes. Bubblewrap restricts filesystem view and namespaces. Seccomp filters syscalls.
3. **Network isolation** - Three independent layers: blocked syscalls, MITM proxy with ephemeral CA, domain allowlist. Only Anthropic API and explicitly allowed domains permitted.

### Filesystem Model

- User selects folders to mount into the VM at session start
- Claude can read/write/create/delete ONLY within mounted folders
- No access to Documents, Desktop, or other system folders unless explicitly granted
- Folder acts as persistent context boundary - intermediate artifacts written to working directory

**Key implication for MindrianOS:** Our plugin needs to work within whatever folder the user mounts. We cannot assume access to `~/.claude/` or any path outside the mounted project folder.

### Projects System

Projects are the persistence layer for Cowork:

| Feature | Without Project | With Project |
|---------|----------------|--------------|
| File access | YES | YES |
| Memory | NO | YES (scoped to project) |
| Custom instructions | NO | YES |
| Scheduled tasks | NO | YES |
| Persistent workspace | NO | YES |

- Projects are **local to machine** - no cloud sync
- Memory is **scoped per project** - does not leak across projects
- Auto-memory accumulates build commands, debugging insights, architecture notes, style preferences
- Projects are desktop-only and stored locally

**CRITICAL: Cowork projects do NOT support team sharing yet.** Anthropic has stated team sharing is coming but no date. This is a major gap for multi-user scenarios.

### Agent Model

**Confidence: MEDIUM-HIGH**

- Built on Claude Agent SDK (same foundation as Claude Code)
- Standard agent tool configuration with conversational task interface
- Can spin up sub-agents for parallel processing
- Sub-agents share the mounted filesystem as coordination mechanism
- Agent teams use orchestrator-subagent model: one plans, multiple execute
- Coordination through shared filesystem and tool call results (not direct agent-to-agent messaging)

**Agent lifecycle:**
1. User describes task in Cowork chat
2. Claude plans and breaks into subtasks
3. Sub-agents execute in parallel within VM
4. Results written to filesystem and reported back
5. User steers/approves throughout

**Environment variable of note:** `CLAUDE_CODE_IS_COWORK` exists in the codebase, indicating Cowork-specific behavior paths.

### MCP Integration

**Confidence: HIGH**

MCP is the universal connector protocol for Cowork:

- Open standard introduced by Anthropic in late 2024
- Connectors allow Claude to pull/push data from external systems
- 25+ enterprise connectors as of Feb 2026 (Google Workspace, Slack, DocuSign, FactSet, Apollo, etc.)
- Custom connectors via remote MCP (documented in help center)
- MCP Apps extension: tools can return interactive UI components (dashboards, forms, viewers) that render in the agent interface

**MCP in Cowork vs CLI:**
- CLI: configured via `claude_desktop_config.json` or project `.mcp.json`
- Cowork: configured through the Customize menu (GUI), or via plugin definitions
- Both share the same MCP protocol
- Plugin marketplace syncs MCP servers along with skills and commands

**Important:** The `mcpServers` field in a subagent definition is NOT applied when running as a teammate. Teammates load MCP servers from project/user settings.

---

## 3. Plugin Architecture (Critical for MindrianOS)

### Plugin Format

A plugin is a **markdown file** containing:
- Metadata (name, version, permissions)
- Skills declarations
- Connector (MCP) declarations
- Slash command declarations
- Sub-agent declarations

This is the SAME format for both Claude Code CLI and Cowork. A single plugin works in both surfaces.

### Distribution Channels

| Method | Surface | Best For |
|--------|---------|----------|
| `/plugin install` CLI | Claude Code | Individual developers |
| Plugin marketplace (GitHub repo) | Both | Teams, open source distribution |
| Private marketplace (admin UI) | Cowork | Enterprise orgs |
| GitHub sync (private repo) | Cowork | Version-controlled enterprise plugins |
| Manual ZIP upload | Cowork admin | Quick iteration, one-off tools |

**Key finding:** A private plugin marketplace is a single GitHub repo that both Claude Code and Cowork can read. This is the unified distribution channel.

### Enterprise Plugin Management

- Admins: Organization settings > Plugins
- Can auto-install plugins for all org members
- Per-user provisioning available
- Plugin Create built-in wizard for custom plugins
- New unified "Customize" menu consolidates plugins, skills, connectors

### Anthropic's Official Plugin Repos

- `anthropics/claude-plugins-official` - curated, high-quality plugins
- `anthropics/knowledge-work-plugins` - open source knowledge worker plugins
- Third-party marketplaces emerging (claudemarketplaces.com, etc.)

**MindrianOS implication:** We should publish MindrianOS as a plugin marketplace (GitHub repo) that works in BOTH Claude Code CLI and Cowork. The plugin format is unified. This is the correct distribution strategy.

---

## 4. Hooks & Automation

### Claude Code Hooks (CLI)

Hooks are shell commands at specific lifecycle points:
- PreToolUse, PostToolUse
- PreCompile, PostCompile
- Deterministic (always fire, not LLM-decided)
- Configured in project settings

### Cowork Automation

Cowork does NOT have the same hook system as Claude Code CLI. Instead, automation comes through:

1. **Scheduled tasks** (`/schedule`) - recurring or on-demand, cloud-based scheduling
2. **Dispatch** - phone-to-desktop persistent thread, trigger tasks remotely
3. **Computer use** - Claude navigates screen, opens apps, fills spreadsheets
4. **Plugin slash commands** - custom triggers packaged in plugins
5. **Sub-agent orchestration** - complex multi-step workflows

**No file-watcher triggers exist today.** Cowork cannot react to filesystem events. The KAIROS feature (see upcoming) would address this.

**No PostToolUse hooks in Cowork.** This is CLI-only. Cowork relies on plugin-defined behaviors instead.

---

## 5. Upcoming Developments

### Confirmed / Announced

| Feature | Status | Source | Confidence |
|---------|--------|--------|------------|
| Android beta | Q2 2026 | Official roadmap | HIGH |
| Enterprise SSO expansion | May 2026 | Official roadmap | HIGH |
| Analytics dashboard | Q2 2026 | Official roadmap | HIGH |
| Team project sharing | Announced "coming" | Help center | MEDIUM |
| MCP Apps (interactive UI) | Shipped | Blog posts | HIGH |

### From ccleaks.com (Feature-Flagged, Not Shipped)

**Confidence: LOW-MEDIUM** - these are real implementations behind feature flags, not stubs, but shipping timeline unknown.

| Feature | Description | MindrianOS Relevance |
|---------|-------------|---------------------|
| **KAIROS** | Persistent background agent that watches, logs, and acts proactively. Maintains append-only daily logs. Runs "dreaming" process at night to consolidate memory. Operates even when terminal is closed. Can notify user via phone. | HUGE - this is exactly the "Larry watches your project" vision. MindrianOS should design for a world where KAIROS exists. |
| **BUDDY** | Companion/assistant feature (details less clear) | Moderate - potential integration point |
| **ULTRAPLAN** | Advanced planning capability | Moderate - could enhance roadmap features |
| **Channels** | MCP server that pushes external events into running sessions | HIGH - enables event-driven MindrianOS workflows |
| **Remote Control** | Control local Claude Code from any device | Moderate - extends Dispatch concept |

### Source Code Leak Context

On March 31, 2026, Anthropic accidentally published source maps in an npm release, exposing:
- 512,000+ lines of TypeScript
- 44 hidden feature flags
- 108+ gated modules
- Custom context compression system
- Granular per-tool permissions
- Multi-agent coordinator

Anthropic filed 8,000+ DMCA takedowns. The ccleaks.com site documents findings.

---

## 6. MindrianOS Integration Opportunities

### Strategy: Unified Plugin, Dual Surface

MindrianOS should be a **single plugin marketplace** (GitHub repo) installable in both Claude Code CLI and Cowork. The plugin format is identical. This means:

1. **CLI users:** `/plugin marketplace add mindrian-marketplace/mos` then install skills
2. **Cowork users:** Organization admin adds GitHub repo, auto-installs for team
3. **Same plugin definitions** work in both surfaces

### Specific Integration Points

#### A. Plugin as Primary Distribution

- Package MindrianOS skills as plugin markdown files
- Each "skill" (consultant, researcher, etc.) becomes a sub-agent definition
- MCP servers declared in plugin metadata
- Slash commands (`/mos:act`, `/mos:rooms`, etc.) map directly to plugin commands

#### B. Cowork Projects as Rooms

- Each MindrianOS "room" maps naturally to a Cowork project
- Project memory = room context accumulation
- Project instructions = room CLAUDE.md / reasoning files
- Project files = room artifacts, deliverables, data room content

#### C. Scheduled Tasks for Recurring Intelligence

- Daily briefings via `/schedule`
- Automated report generation
- Periodic knowledge graph updates
- Market monitoring tasks

#### D. MCP Apps for Data Room Views

- MCP Apps return interactive UI components
- Data room dashboard, wiki, graph views could render as MCP App components
- This is the path to rich visual output in Cowork without a separate web server

#### E. Dispatch for Mobile Access

- Users can trigger MindrianOS tasks from phone
- "Generate a briefing on X" while away from desk
- Results waiting when they return

#### F. Preparing for KAIROS

Design MindrianOS artifacts (REASONING.md, room state files, knowledge graph) as things a background agent can consume. When KAIROS ships:
- It could watch room folders for changes
- Proactively update knowledge graphs
- Trigger re-analysis when source documents change
- Consolidate insights during "dreaming" phase

### What MindrianOS Should NOT Do in Cowork

1. **Do not assume filesystem access outside mounted folders** - the VM sandbox prevents this
2. **Do not rely on PostToolUse hooks** - these are CLI-only
3. **Do not assume multi-user shared state** - Cowork projects are local, not shared (yet)
4. **Do not assume network access** - outbound is restricted to allowlisted domains
5. **Do not use `~/.claude/` paths** - Cowork VM has its own filesystem; use project-relative paths

---

## 7. Competitive Landscape

### Cowork's Unique Position

| Tool | Primary Audience | Autonomy Level | Key Strength |
|------|-----------------|----------------|-------------|
| **Cowork** | Knowledge workers | HIGH (autonomous agent) | Deep reasoning, file operations, MCP ecosystem, plugin system |
| **Cursor** | Developers | MEDIUM (guided agent) | IDE integration, project-aware coding |
| **GitHub Copilot** | Developers | LOW (suggestions) | Affordability, VS Code native, multi-model |
| **Devin** | Dev teams | HIGH (autonomous) | Repetitive tasks, migrations | Well-defined tasks only |
| **Windsurf** | Developers | MEDIUM | IDE with AI flows |

### What Makes Cowork Unique (and Why MindrianOS Should Leverage It)

1. **Open MCP architecture** - Not locked to one vendor's tools. Can connect to anything. MindrianOS benefits because our MCP servers work natively.

2. **Plugin format as markdown** - Lowest friction distribution. No compilation, no build step. A skill is a markdown file. MindrianOS skills are already close to this format.

3. **Sub-agent orchestration** - Cowork can spin up parallel workers. MindrianOS consultant/researcher/analyst skills can run as sub-agents simultaneously.

4. **Scheduled tasks** - No competitor has this. Recurring intelligence gathering is a MindrianOS differentiator that Cowork uniquely enables.

5. **Non-developer audience** - Cowork serves knowledge workers, PMs, analysts, consultants. This IS the MindrianOS target audience. Cursor/Copilot serve developers.

6. **MCP Apps (interactive UI)** - Return rich visual components. No competitor offers this for non-code outputs.

### Market Position

Claude Code became the #1 most-loved developer tool: 46% of developers rated it their favorite (vs Cursor 19%, Copilot 9%). Cowork extends this to non-developers. The combined Claude Code + Cowork ecosystem is the strongest distribution channel for MindrianOS.

---

## 8. Gaps & Unknowns

### Critical Unknowns

| Question | Why It Matters | How to Resolve |
|----------|---------------|----------------|
| How exactly does MCP Apps UI rendering work? | Determines if data room views can render in Cowork | Build a proof-of-concept MCP App |
| What's the exact plugin markdown schema? | Need to package MindrianOS correctly | Read official plugin docs, examine `anthropics/claude-plugins-official` repo |
| Can plugins declare project-level file conventions? | Determines if MindrianOS can auto-create `.planning/` structure | Test with a plugin that writes files |
| When will Cowork project sharing ship? | Affects multi-user room collaboration | Monitor Anthropic announcements |
| What are the VM's resource limits? | Affects KuzuDB, Pinecone client, heavy processing | Benchmark inside Cowork VM |
| Does the VM persist between sessions? | Affects installed tools, caches, database state | Test empirically |
| How does `CLAUDE_CODE_IS_COWORK` affect behavior? | May need Cowork-specific code paths | Examine source / test |

### Known Limitations

1. **No team sharing for Cowork projects** - local only, each user has their own project
2. **No file-watcher triggers** - cannot react to filesystem changes (yet)
3. **No PostToolUse hooks** - CLI-only feature
4. **Network restrictions** - outbound limited to allowlisted domains
5. **No cloud sync** - project data stays on local machine
6. **Memory scoped per project** - knowledge doesn't transfer between projects

### Research Gaps

- No clear documentation on `00_Context/` folder convention - this may be a community pattern rather than official Anthropic standard
- Exact MCP server lifecycle in Cowork (start/stop/restart) not well documented
- Plugin permission model (what can a plugin request access to) needs empirical testing
- Whether Cowork respects CLAUDE.md files in the same way Claude Code does

---

## 9. Recommended Next Steps for MindrianOS

### Immediate (This Sprint)

1. **Examine `anthropics/claude-plugins-official` repo** to understand exact plugin format
2. **Package one MindrianOS skill as a Cowork-compatible plugin** (start with consultant skill)
3. **Test plugin installation** in both Claude Code CLI and Cowork Desktop

### Short Term (Next 2-4 Weeks)

4. **Build a proof-of-concept MCP App** that renders a simple data room view
5. **Create a MindrianOS plugin marketplace repo** on GitHub
6. **Test scheduled task integration** for recurring briefings

### Medium Term (Next Quarter)

7. **Design room-as-project mapping** - formalize how MindrianOS rooms map to Cowork projects
8. **Build Dispatch-compatible task templates** for mobile access
9. **Prepare KAIROS-ready artifact format** - design files that a background agent can consume

---

## 10. Sources

### Official Anthropic Documentation
- [Get started with Cowork](https://support.claude.com/en/articles/13345190-get-started-with-cowork) - Help Center
- [Use Cowork on Team and Enterprise plans](https://support.claude.com/en/articles/13455879-use-cowork-on-team-and-enterprise-plans) - Help Center
- [Organize your tasks with projects in Cowork](https://support.claude.com/en/articles/14116274-organize-your-tasks-with-projects-in-cowork) - Help Center
- [Schedule recurring tasks in Cowork](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-cowork) - Help Center
- [Use plugins in Cowork](https://support.claude.com/en/articles/13837440-use-plugins-in-cowork) - Help Center
- [Manage Cowork plugins for your organization](https://support.claude.com/en/articles/13837433-manage-cowork-plugins-for-your-organization) - Help Center
- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) - Help Center
- [Assign tasks to Claude from anywhere in Cowork](https://support.claude.com/en/articles/13947068-assign-tasks-to-claude-from-anywhere-in-cowork) - Help Center
- [Plugins for Claude Code and Cowork](https://claude.com/plugins) - Anthropic
- [Cowork and plugins for teams across the enterprise](https://claude.com/blog/cowork-plugins-across-enterprise) - Anthropic Blog
- [Customize Cowork with plugins](https://claude.com/blog/cowork-plugins) - Anthropic Blog
- [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) - Claude Code Docs
- [Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide) - Claude Code Docs
- [Sandboxing](https://code.claude.com/docs/en/sandboxing) - Claude Code Docs
- [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) - Claude API Docs

### Anthropic Official Blog & Announcements
- [Introducing Cowork](https://claude.com/blog/cowork-research-preview) - Research preview announcement (Jan 2026)
- [Anthropic Announces Claude CoWork](https://www.infoq.com/news/2026/01/claude-cowork/) - InfoQ (Jan 2026)
- [Cowork product page](https://claude.com/product/cowork) - Anthropic

### Technical Architecture
- [Inside Claude Cowork: How Anthropic's Autonomous Agent Actually Works](https://blog.pluto.security/p/inside-claude-cowork-how-anthropics) - Pluto Security
- [Claude Cowork Architecture: How Anthropic Built a Desktop Agent That Actually Respects Your Files](https://medium.com/@Micheal-Lanham/claude-cowork-architecture-how-anthropic-built-a-desktop-agent-that-actually-respects-your-files-cf601325df86) - Medium
- [Claude Cowork Architecture Deep Dive: VM Isolation, MCP, and Agentic Loop](https://claudecn.com/en/blog/claude-cowork-architecture/) - Claude CN
- [Cowork Security Architecture Deep Dive](https://claudecn.com/en/blog/claude-cowork-security-architecture/) - Claude CN

### Source Leak Intelligence
- [ccleaks.com](https://ccleaks.com) - Leaked source documentation
- [ccleaks architecture](https://ccleaks.com/architecture) - Boot sequence, tool system
- [ccleaks news](https://ccleaks.com/news) - Updates
- [Claude Code Leaked Source: BUDDY, KAIROS & Every Hidden Feature](https://wavespeed.ai/blog/posts/claude-code-leaked-source-hidden-features/) - WaveSpeed AI
- [Inside Claude Code's leaked source: swarms, daemons, and 44 features](https://thenewstack.io/claude-code-source-leak/) - The New Stack
- [Claude Code Source Leak: Everything Found](https://claudefa.st/blog/guide/mechanics/claude-code-source-leak) - ClaudeFast

### Reviews & Guides
- [First impressions of Claude Cowork](https://simonw.substack.com/p/first-impressions-of-claude-cowork) - Simon Willison
- [Claude Cowork Tutorial](https://www.datacamp.com/tutorial/claude-cowork-tutorial) - DataCamp
- [Claude Cowork: The Ultimate Guide for PMs](https://www.productcompass.pm/p/claude-cowork-guide) - Product Compass
- [Context Management Strategies for Claude CoWork](https://iceberglakehouse.com/posts/2026-03-context-claude-cowork/) - Iceberg Lakehouse

### Competitive Analysis
- [Cursor vs Claude Code vs GitHub Copilot 2026](https://www.nxcode.io/resources/news/cursor-vs-claude-code-vs-github-copilot-2026-ultimate-comparison) - NxCode
- [Claude Cowork vs Cursor vs GitHub Copilot: Complete 2026 Comparison](https://coworkhow.com/guides/cowork-vs-cursor-copilot) - CoworkHow

### GitHub Repositories
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) - Official plugin directory
- [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) - Knowledge worker plugins
- [anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) - Sandbox tooling

### Enterprise & Windows
- [Anthropic updates Claude Cowork tool](https://www.cnbc.com/2026/02/24/anthropic-claude-cowork-office-worker.html) - CNBC (Feb 2026)
- [Anthropic Brings Claude Cowork to Windows](https://www.unite.ai/anthropic-brings-claude-cowork-to-windows-with-full-feature-parity/) - Unite.AI
- [Claude Cowork Plugins for Enterprise Guide](https://almcorp.com/blog/claude-cowork-plugins-enterprise-guide/) - ALM Corp
