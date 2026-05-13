<div align="center">
  <img src="https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg" alt="MindrianOS" width="160" />

  # MindrianOS

  **Compass and map for the wicked navigator.**

  The Claude Code plugin that turns the venture from a folder you archive
  into a closed conversation loop you walk through. Powered by PWS, the practical
  innovation methodology developed by [Prof. Lawrence Aronhime](https://www.linkedin.com/in/lawrence-aronhime-8363894/)
  over 30+ years at Johns Hopkins University.
  Built by [Jonathan Sagir](https://www.linkedin.com/in/jonathansagir/).

  [![Plugin Version](https://img.shields.io/badge/plugin-v1.13.0_(currently_beta.12)-blue)](https://github.com/jsagir/mindrian-os-plugin)
  [![Milestone](https://img.shields.io/badge/milestone-The_Closed_Loop-success)](docs/MINDRIAN-CANON.md)
  [![License](https://img.shields.io/badge/license-BSL_1.1-orange)](LICENSE)
  [![Commands](https://img.shields.io/badge/commands-85-green)](commands/)
  [![Skills](https://img.shields.io/badge/skills-10-cyan)](skills/)
  [![Agents](https://img.shields.io/badge/agents-9-orange)](agents/)
  [![Hook surfaces](https://img.shields.io/badge/hook_surfaces-4-red)](scripts/)
  [![Edge Types](https://img.shields.io/badge/cascade_edges-12-yellow)](docs/MINDRIAN-CANON.md#part-4---every-choice-is-graph-data)
  [![Node](https://img.shields.io/badge/node-%3E%3D22.5.0-brightgreen)](.claude-plugin/plugin.json)
  [![Surfaces](https://img.shields.io/badge/surfaces-CLI_+_Desktop_+_Cowork-brightgreen)](#three-surfaces)

  [Website](https://mindrianos-jsagirs-projects.vercel.app) |
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) |
  [Brain Access](https://mindrianos-jsagirs-projects.vercel.app/brain-access) |
  [Canon](docs/MINDRIAN-CANON.md)

</div>

---

## v1.13.0 -- The Closed Loop

The thesis of this milestone, in one sentence: **turn MindrianOS from "the back half of a hook" into a closed habit loop with a first-15-minute imprint.**

What that means concretely:

1. **Larry leads turn 1.** Conversation IS the front door. Commands are internals.
2. **The local SQL graph remembers.** `room.db` is the navigable working memory of the venture; files are the human-readable surface.
3. **The Brain reasons over typed packets.** Methodology only; never your data. Part 8 (the Graph Boundary) is enforced structurally by the Brain Context Packet Contract, not just procedurally audited.
4. **First material kicks off the triple-filter math layer.** Whitespace plus reverse salient plus cross-domain match, surfaced on your next turn as a Decision Gate (Explore / Skip / Later).
5. **Every choice is graph data.** APPROVE, REJECT (with reason), DEFER each produce a typed edge with the three contexts that were on screen at the moment of decision.

Currently shipping as `v1.13.0-beta.12`. Final `v1.13.0` is imminent. The capstones already in beta.12: Phase 121.5 Terminal Coherence and Phase 122 Workflow Layer.

---

## What's Inside the Closed Loop

| Capability | Where it lives | Why it matters |
|-----------|----------------|----------------|
| **Larry as default** (Phase 114) | `agents/larry-extended.md`, settings.json subagent preload | Turn 1 is a Larry-led conversation. No cold start, no command surfing required. |
| **Owned Emotion + Dual-Path First Touch** (Phase 115) | `skills/larry-personality/`, first-touch hooks | Material request OR surgical opener. Visible structure inside the conversation. |
| **Unresolved Tension Hook** (Phase 116) | Memory event log, room.db tension nodes | Larry remembers contradictions across sessions and re-opens them when relevant. |
| **Auto-Explore on first material** (Phase 117) | `commands/auto-explore.md`, PostToolUse hook on Write\|Edit\|MultiEdit | Triple-filter math (whitespace + reverse salient + cross-domain) fires in the background. Findings surface ~10s later via F.1 Decision Gate. |
| **30-Second MVA + Reward-Before-Investment** (Phase 118) | `commands/mva.md`, first-conversation pipeline | Turn 1 always produces a Minimum Viable Artifact. The room is a receipt of what conversation produced, not a setup wizard. |
| **Room-as-Receipt invariant** (Phase 119) | `lib/core/room-ops.cjs` | Formal invariant that every conversation populates the room atomically; broken state is detectable, not silent. |
| **Breakthrough Scan / Category G** (Phase 120) | `commands/scout.md` | Positive variable reward: surprising convergences, not just contradictions. |
| **Workflow Layer** (Phase 122) | `data/command-registry.json`, `lib/workflow/command-resolver.cjs`, `lib/brain/chain-recommender.cjs` | Framework-to-command becomes a CI-enforced guarantee. Hallucinated commands cannot be emitted. |
| **Terminal Coherence Capstone** (Phase 121.5) | SessionStart Coordinator, `output-styles/destijl.md`, two-row statusline, canonical `references/visual/palette.json` | Every UI surface harmonized into one Claude Code terminal experience. |
| **Brain Context Packet Contract** (Phase 110) | `lib/brain/brain-client.cjs`, wire schema enforcement | Brain queries are typed packets, never free-form. Part 8 is structurally enforced. |
| **SQL Navigation Spine** (Phase 109, Canon Part 9) | `lib/core/navigation.cjs` (13 functions, single chokepoint) | Larry navigates `room.db` as a graph instead of scanning folders. Instrumented test asserts zero non-SQLite reads. |
| **Memory Event Log** (Phase 108/109) | First-class `memory_event` nodes in `room.db` | Every navigation step writes an event. Audit trail is graph data, not log files. |
| **Install-cache Windows hardening** (Phase 95.6) | `install.sh`, `scripts/doctor.cjs` class H | Skill-loop no longer halts mid-install. Statusline registered first. `.install-receipt.json` records progress. |
| **`npx @mindrian_os/install`** (Phase 122 / capstone) | `bin/cli.js`, `lib/core/active-plugin-root.cjs` | Real one-command installer. The single resolver retires the entire "wrong plugin path" bug family across doctor / update / statusline. |

---

## Three Surfaces

Every feature in MindrianOS works across three Claude surfaces by design.

| Surface | Setup | Best for |
|---------|-------|----------|
| **Claude Code CLI** | `npx @mindrian_os/install` or `claude plugin install mos@mindrian-marketplace` | Full power. Hooks fire, scripts run, full UI Ruling System, exports, statusline. |
| **Claude Desktop** | Plugin install auto-registers the local MCP server | Conversational. Talk to Larry, browse the room, inline MCP Apps (dashboard / wiki / graph). |
| **Cowork** | Same plugin, Streamable HTTP transport | Multi-user. Shared `00_Context/`, scheduled tasks, persistent hats, session catch-up. |

---

## Install

### Option A: npm (recommended for v1.13.0)

```bash
npx @mindrian_os/install
```

Detects `claude` on PATH, runs `claude plugin marketplace add jsagir/mindrian-marketplace`, then `claude plugin install mos@mindrian-marketplace`, then stamps the statusline. Restart Claude Code; Larry starts talking.

```bash
# Manage afterward:
mindrian-os update           # marketplace + plugin update via active-plugin-root resolver
mindrian-os doctor --all     # diagnose every drift class with --fix suggestions
```

### Option B: Plugin Marketplace

```bash
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mos@mindrian-marketplace
```

### Option C: One-line shell install

```bash
curl -sL https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/install.sh | bash
```

### Option D: Manual clone

```bash
git clone https://github.com/jsagir/mindrian-os-plugin.git ~/mindrian-os-plugin
cd ~/mindrian-os-plugin && bash install.sh
```

### Optional: Brain MCP

The Brain is a remote methodology server (32K+ teaching-graph nodes). Optional and never required. Request access at [mindrianos-jsagirs-projects.vercel.app/brain-access](https://mindrianos-jsagirs-projects.vercel.app/brain-access). After approval, paste the key into `~/.mindrian.env`, `MINDRIAN_BRAIN_KEY` in your shell, or the per-room `.env`. The plugin's resolver picks it up from any of these.

### A note on permission prompts during install

Claude Code asks you to approve each shell command it runs. 10 or more prompts during install is normal. Pick "always allow" (option 2) the first time you see a matcher you're happy approving. The rest of the install will not re-prompt.

Touch-first Windows devices: connect an external keyboard before installing.

### If the install halts

Older versions of `install.sh` could halt on a missing skill file. Current versions warn and continue. If you hit a halted install, the recovery is the same shape every time:

```bash
INSTALL_DIR="$HOME/.claude/plugins/mindrian-os"
for f in "$INSTALL_DIR/agents/"*.md; do ln -sf "$f" "$HOME/.claude/agents/$(basename "$f")"; done
bash "$INSTALL_DIR/install.sh"     # idempotent: re-running fixes most cases
node "$INSTALL_DIR/scripts/doctor.cjs" --statusline-visibility --fix
```

Inside Claude Code, `/mos:doctor --all` should then report all-green or name what is missing. The class H drift detector covers the install-incomplete failure mode.

---

## Permissions

MindrianOS reads broadly inside your workspace and writes only to `~/MindrianRooms/` (your rooms) and `./.mindrian/` (per-session state). It never writes to brain.mindrian.ai. Every `/mos:*` command respects the [Canon Part 8 Graph Boundary](docs/MINDRIAN-CANON.md#part-8---the-graph-boundary-security-constitution).

Two options for handling permission prompts:

### Option 1: Pre-approve via settings.json (recommended)

Paste the canonical matcher set from [`docs/settings-template.json`](docs/settings-template.json) into `~/.claude/settings.json`. Per-subcommand matchers (`Bash(git diff:*)` rather than bare `Bash`) give fine-grained control without friction.

```json
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(node bin/mindrian-tools.cjs:*)",
      "Bash(node scripts/*.cjs:*)",
      "Read(**)",
      "Write(~/MindrianRooms/**)",
      "Write(./.mindrian/**)",
      "WebFetch(domain:api.grants.gov)",
      "WebFetch(domain:api.tavily.com)"
    ]
  }
}
```

Full 19-matcher block in [`docs/settings-template.json`](docs/settings-template.json). Claude Code merges it with any existing entries.

### Option 2: Nuclear

Start Claude Code with `claude --dangerously-skip-permissions` and no prompts fire for the session. The read/write surface is bounded (workspace + your rooms), so this is a reasonable choice for methodology workflow. Review the flag's [full warning](https://docs.claude.com/en/docs/claude-code/settings#permissions-dangerous) before using it.

---

## How To Use It

### Before Your First Session

A Room is not a folder of documents. It is a Living Data Room: filesystem + intelligence layer + cross-relationship scan, all local, all yours. Every time you file an artifact, MindrianOS scans the other sections of the room and surfaces edges (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) so Larry can tell you what changed in the rest of the venture. You start a room with `/mos:new-project` and switch between rooms with `/mos:rooms`.

### Two ways into the same logic

Type the command, or talk to Larry. If you know the move, `/mos:find-analogies` is the keyboard shortcut. If you do not yet know the framework, "find me a design analogy from biology for my pricing problem" routes through the Workflow Layer to the same place, with teaching along the way. Both paths point at the same underlying methodology; neither is better than the other.

### A first session

```bash
# 1. Start the room (Larry leads)
/mos:new-project

# 2. Pick the next move (Mode A if Brain reachable, else Local-Only Navigation Engine)
/mos:suggest-next

# 3. Run methodology (one /mos: per framework, chainable)
/mos:beautiful-question
/mos:analyze-needs

# 4. File a meeting (paste, file, or audio via Velma)
/mos:file-meeting

# 5. Ask your graph
/mos:query "what contradicts my pricing model?"

# 6. Snapshot for sharing
/mos:dashboard
```

Don't know which command? Just talk. Larry routes through `lib/workflow/command-resolver.cjs` to the right `/mos:*`.

---

## The Command Surface (85 commands, grouped)

The plugin ships 85 user-facing commands. They cluster into seven families. Larry routes between them via the Workflow Layer; you can also call them directly.

| Family | Examples | Purpose |
|--------|----------|---------|
| **Methodology** | `/mos:think-hats`, `/mos:lean-canvas`, `/mos:scenario-plan`, `/mos:mullins`, `/mos:systems-thinking`, `/mos:five-whys`, `/mos:hat-briefing` | Frameworks from the PWS canon, each backed by an agent or skill. |
| **Engine 1 (Act 1 intelligence)** | `/mos:explore-domains`, `/mos:whitespace`, `/mos:find-bottlenecks`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`, `/mos:diagnostics` | The triple-filter math layer (whitespace + reverse salient + cross-domain). |
| **Room navigation** | `/mos:new-project`, `/mos:rooms`, `/mos:room`, `/mos:status`, `/mos:suggest-next`, `/mos:wiki`, `/mos:dashboard`, `/mos:query` | Open / switch / inspect rooms and the local graph. |
| **Meeting intelligence** | `/mos:file-meeting`, `/mos:speakers` | Paste, file, or transcribe via Velma. Speaker identification, role classification, action-item tracking. |
| **Funding** | `/mos:opportunities`, `/mos:funding` | Opportunity Bank (HSI-scored, Brain-enriched suggestions) + 4-stage lifecycle. |
| **Workflow** | `/mos:pipeline`, `/mos:act`, `/mos:next`, `/mos:resume-work`, `/mos:scout` | Compose chains, run autonomous methodology with `--chain`, scheduled sentinel tasks. |
| **Admin and diagnostics** | `/mos:doctor`, `/mos:admin`, `/mos:settings`, `/mos:update`, `/mos:help` | Health checks, key management, configuration. |

Full inventory: `commands/`.

---

## The Two Graphs

```
Brain  (remote, optional)                    Room Graph  (local, always on)
Methodology graph                            YOUR venture's structure
~32K nodes, ~65K+ relationships              SQLite (room.db)
Framework chains + calibrated grading        Grows as you file artifacts
Connects via API key                         12 cascade edge types
NEVER receives your data (Part 8)            Never egresses anywhere
```

**Cascade edge types** (room graph): INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, BELONGS_TO, CAUSES, CASCADES_TO, EXTRACTED_FROM, HSI_CONNECTION, REVERSE_SALIENT, ANALOGY_MATCH.

**The Memory Triple** lives on disk as human-readable markdown alongside `room.db`:

- `FEYNMAN.md` -- first-principles plain-language summary of the section
- `MINTO.md` -- top-down structured argument
- `BRAIN.md` -- Brain-derived patterns and predictions for the section
- (plus `ROOM.md`, `STATE.md`, `USER.md` -- identity, decisions, navigator profile)

Files preserve meaning. SQL remembers and navigates. Brain reasons over structured packets. Larry explains and acts. The human confirms truth. (Canon Part 9.)

---

## Larry's Thinking Traces

Larry shows his reasoning, not just the answer.

```
Larry's Thinking
  Problem        Wicked (8/10 characteristics)
  Stage          Pre-Opportunity
  Method         Bono Six Hats (divergent exploration)
  Chain          Bono -> JTBD -> Market Sizing
  Filing         problem-definition/
  Confidence     0.82 (Mode A, Brain reachable)
  Brain links    3 connections, 2 cross-references
```

Mode-adaptive: hidden when Larry is asking questions, visible when teaching, structured at every Decision Gate. The visual grammar is the [De Stijl Output Style](output-styles/destijl.md), and the four-zone body shape contract is enforced by the SessionStart Coordinator (Phase 121.5).

---

## The Decision Gate

Every material choice in the system passes through a tri-context Decision Gate that takes three contexts and returns one of APPROVE, REJECT (with reason), or DEFER.

The three contexts:

- **LOCAL**: room state, prior decisions, assumption registry, recent meetings.
- **BRAIN**: framework chaining rules, phase progressions. Generic strategic intelligence, never user data.
- **SIGNAL**: outside world (public grants, market data, scheduled sweeps).

The Decision Gate offers a closed vocabulary of ten verbs (Run Methodology / Reformulate / Spawn Sub-Agent / Navigate Graph / Devil's Advocate / Scenario Plan / Synthesize / Bank Opportunity / Defer / Free-Text). Verbs cluster into five Shape F sub-shapes (Next Move / Path Control / Rabbit-Hole Depth / Insight Extraction / Branch Resolution). Every selector is rendered through the same primitive.

Full grammar: [Canon Part 3](docs/MINDRIAN-CANON.md#part-3---the-tri-context-decision-gate). Selector contract: Phase 88.2.

---

## The Graph Boundary (Why It Matters)

```
The Brain is a repository of strategic thinking tools.
It is not, and must never become, a repository of user data.

LOCAL data    -> BRAIN:        NO
BRAIN methodology -> LOCAL:    YES
LOCAL edges   -> LOCAL graph:  YES
LOCAL edges   -> BRAIN:        NO
SIGNAL        -> LOCAL:        YES
SIGNAL        -> BRAIN:        NO
```

Brain queries carry only generic framework handles, phase identifiers, sha256 hashes, and enum scalars. Brain Context Packet Contract (Phase 110) enforces this at the wire schema; brain-boundary scan enforces it at the PR layer; the Phase 122 e2e test runs a `Command`-node grep sweep that fails the build if user-data assertion ever leaks into `skills/`, `agents/`, or `references/`.

Full constitution: [Canon Part 8](docs/MINDRIAN-CANON.md#part-8---the-graph-boundary-security-constitution).

---

## Plugin Structure

```
mindrian-os-plugin/
├── .claude-plugin/plugin.json        # Plugin manifest
├── bin/
│   ├── cli.js                        # `npx @mindrian_os/install` entry point
│   ├── mindrian-tools.cjs            # Shared CJS tool entry
│   └── mindrian-mcp-server.cjs       # Local MCP server (Desktop/Cowork)
├── commands/                         # 85 user-facing commands (/mos:*)
├── skills/                           # 10 auto-activating skills
├── agents/                           # 9 sub-agents (Larry, research, grading, ...)
├── data/
│   ├── command-registry.json         # Generated framework-to-command registry (Phase 122)
│   ├── framework-names.json          # FEEDS_INTO-linked framework allowlist
│   └── deployment-surfaces.json      # Phase 123 install-state manifest
├── lib/
│   ├── core/
│   │   ├── navigation.cjs            # SQL navigation spine (13 fn, single chokepoint)
│   │   ├── active-plugin-root.cjs    # The ONE plugin-root resolver (Phase 122 capstone)
│   │   ├── resolve-brain-key.cjs     # Single Brain-key resolver
│   │   └── ...                       # room-ops, state-ops, graph-ops, opportunity-ops
│   ├── workflow/
│   │   └── command-resolver.cjs      # The only framework-to-command door
│   ├── brain/
│   │   ├── brain-client.cjs          # Brain MCP client (typed packet only)
│   │   └── chain-recommender.cjs     # FEEDS_INTO traversal
│   └── memory/                       # Memory triple/quadruple readers + e2e tests
├── mcp-server-brain/                 # Brain hosting server (Streamable HTTP, remote)
├── scripts/
│   ├── session-start                 # SessionStart Coordinator
│   ├── post-write / post-compact     # Cascade pipeline hooks
│   ├── doctor.cjs                    # Drift detection (classes A through J)
│   ├── statusline-mos                # Two-row statusline (Phase 121.5)
│   └── build-command-registry.cjs    # Generator + --check tripwire
├── references/                       # PWS frameworks, methodology canon, personas
├── output-styles/destijl.md          # The De Stijl output style (force-for-plugin)
├── dashboard/                        # Cytoscape.js knowledge graph + chat
├── pipelines/                        # ICM stage contracts
├── tests/                            # Feynman runner + per-phase test suites
├── docs/
│   ├── MINDRIAN-CANON.md             # The 10-part constitutional document
│   ├── CANON-PHASE-MAP.md            # Canon-to-phase implementation map
│   ├── WORKFLOWS.md                  # Workflow Layer reference (Phase 122)
│   └── COMMAND-FRONTMATTER.md        # The five new frontmatter keys
└── CHANGELOG.md                      # All shipped versions, top-down
```

---

## Architecture (Short Version)

MindrianOS sits on three foundations:

1. **Simon's Architecture of Complexity** (1962). Room sections are near-decomposable subsystems. Hierarchy is the universal form of any persisting complex system. The folder structure IS the near-decomposable hierarchy.
2. **Rittel & Webber's Wicked Problems** (1973). The venture is a wicked problem, not a project plan. The Data Room manages it as such.
3. **Van Clief & McDermott's ICM** (2026). Folder structure IS the code. Each ICM layer (Identity / Routing / Contracts / Reference / Artifacts) maps to a canon Part.

The Memory Triple (FEYNMAN / MINTO / BRAIN) is the human-readable substrate. `room.db` is the navigable working memory. The Brain (when reachable) reasons over typed packets. Larry navigates. The human confirms.

Full theoretical grounding: [Canon](docs/MINDRIAN-CANON.md) and the Canon-Phase Map.

---

## Updating

Two independent update channels exist in Claude Code. Both are off by default for third-party plugins. This is correct-by-design: users should never get breaking changes pushed without consent.

To get an update manually:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

Or, equivalently, from the shell:

```bash
mindrian-os update
```

If you want to be on the edge: toggle marketplace auto-update on (`/plugin` -> Marketplaces -> select `mindrian-marketplace` -> auto-update on). Pre-release versions (`-beta.N` suffixes) are opt-in only via `--version` flag.

---

## Releasing (maintainer)

Every plugin release synchronizes six places in lockstep and publishes the npm package:

1. `CHANGELOG.md` has the version entry at the top
2. `.claude-plugin/plugin.json` `version` matches
3. `package.json` `version` matches
4. `packages/npm-installer/package.json` `version` matches (where present)
5. `git tag v<version>` exists pointing at the release commit
6. `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` is pinned to the tag

Then `npm publish` with `--tag next` for pre-release suffixes (`-beta.N`, `-alpha.N`, `-rc.N`, `-next.N`) or `--tag latest` for clean `X.Y.Z`. `scripts/release.sh` Step 9.5 enforces the npm gate.

Workspace rule: the canonical dev workspace is `/home/jsagi/MindrianOS-Plugin/`. `~/.claude/plugins/mindrian-os/` is NOT a dev workspace. The SessionStart workspace guard refuses to execute in the plugin cache directory.

Full process: [docs/release-process.md](docs/release-process.md) (or `.claude/includes/release-process.md`).

---

## Telemetry and Privacy

- **Local telemetry**: `~/.mindrian/telemetry/query-efficiency.jsonl` (Plan 88.1-16). Scalar counts + LOCAL slug only. Zero network surface.
- **Brain wire**: typed packets only (Phase 110). Brain query payload is structurally incapable of carrying user content.
- **`/mos:scout`** + sentinel sweeps run locally; outbound calls (grants.gov, Tavily, arxiv) are hat-scoped and listed explicitly.
- **No anonymous usage analytics**, **no telemetry beacon**, **no auto-update of plugin code without your action** (third-party plugins are pull-only by Anthropic's design).

---

## Links

- **Website**: [mindrianos-jsagirs-projects.vercel.app](https://mindrianos-jsagirs-projects.vercel.app)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Brain Access**: [Request API Key](https://mindrianos-jsagirs-projects.vercel.app/brain-access)
- **Canon**: [docs/MINDRIAN-CANON.md](docs/MINDRIAN-CANON.md)
- **Canon-Phase Map**: [docs/CANON-PHASE-MAP.md](docs/CANON-PHASE-MAP.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Prof. Lawrence Aronhime**: [LinkedIn](https://www.linkedin.com/in/lawrence-aronhime-8363894/), PWS methodology
- **Jonathan Sagir**: [LinkedIn](https://www.linkedin.com/in/jonathansagir/), MindrianOS developer

---

## License

Source-available (BSL 1.1), not open source. See [LICENSE](LICENSE). Copyright Jonathan Sagir and PWS / Mindrian.
