---
type: architecture-vision
status: validated-by-discussion
source: Session 2026-04-16, post-v1.10.9 shipping discussion
contributors: Jonathan Sagir, Larry (Claude session)
---

# MindrianOS Desktop: Bidirectional Browser Control Surface

## The Vision (one paragraph)

The browser becomes the primary interface for MindrianOS. Users see their Data Room as a visual knowledge graph with typed edges, navigate between artifacts via clickable wikilinks, read intelligence alerts (convergence, contradictions, gaps), and click operational buttons that trigger methodology commands in Claude Code. Claude Code becomes the execution engine that users rarely need to interact with directly. The visual layer reads from the room filesystem and SQLite database (room.db) and costs zero LLM tokens to render.

## Architecture

```
Browser (localhost:3131)                 Claude Code (terminal)
┌──────────────────────────────┐         ┌─────────────────────┐
│                              │         │                     │
│  Cytoscape.js Graph          │         │  Larry conversation │
│  (reads room.db edges)       │         │  Methodology engine │
│                              │         │  Filing pipeline    │
│  Wiki Panel                  │←──SSE───│  Intelligence       │
│  (reads room/*.md)           │  push   │  cascade writes     │
│  (wikilinks = clickable nav) │         │  to room.db + room/ │
│                              │         │                     │
│  Intelligence Strip          │         │                     │
│  (convergence, contradictions│         │                     │
│   gaps, action items)        │         │                     │
│                              │         │                     │
│  ┌─────────────────────────┐ │         │                     │
│  │  [FILL GAP: team]   btn │─┼──cmd──→│  /mos:room team     │
│  │  [RUN JTBD]          btn │ │        │  /mos:analyze-needs │
│  │  [BUILD THESIS]      btn │ │        │  /mos:build-thesis  │
│  │  [PREP MEETING]      btn │ │        │  /mos:file-meeting  │
│  └─────────────────────────┘ │         │                     │
│                              │         │                     │
└──────────────────────────────┘         └─────────────────────┘
         ↕ bidirectional ↕
```

## Three data flows

### Flow 1: Room state to browser (passive, zero tokens)

```
room/*.md + room.db → Node fs.watch + SQLite read → SSE push → browser DOM update
```

The localhost Node server watches the room directory and periodically reads room.db for new edges. On change, it pushes a small JSON payload via Server-Sent Events to the browser. Cytoscape.js adds/removes graph nodes. The wiki panel refreshes the changed artifact. The intelligence strip updates. No LLM involvement. No token cost.

### Flow 2: User action to Claude Code (operational buttons)

Three implementation tiers, shipping in sequence:

**v1 (Phase 86, days): Clipboard bridge.**
User clicks "Fill gap: market-analysis" in the browser. The button copies `/mos:analyze-needs --section market-analysis` to the system clipboard. A toast says "Command copied -- paste in Claude Code to run." User switches to terminal, pastes, hits enter. Larry runs.

Ugly. Works. Proves the UX without solving the hard IPC problem.

**v2 (Phase 87, weeks): Command queue file.**
Browser writes to `room/.mindrian/command-queue.json`:
```json
[{"command": "/mos:analyze-needs", "args": {"section": "market-analysis"}, "queued_at": "2026-04-16T..."}]
```
A Claude Code hook (UserPromptSubmit or session-start) reads the queue on next interaction and surfaces it: "I see you queued a JTBD analysis from the dashboard. Run it now?" One paste step eliminated. Claude Code proposes, user approves.

**v3 (when Claude Code supports it): RemoteTrigger API.**
The browser POSTs directly to Claude Code's remote trigger endpoint. The command executes without the user touching the terminal. The browser becomes the sole interface. Terminal becomes the engine room users never need to open.

RemoteTrigger exists in Claude Code's deferred tools list (seen at session start 2026-04-16). Availability and stability TBD. When it stabilizes, v3 becomes the default path.

### Flow 3: Claude Code writes, browser reacts (the intelligence loop)

```
Larry files artifact → PostToolUse hook → intelligence cascade → room.db updated
                                                                      ↓
                                                               fs.watch fires
                                                                      ↓
                                                          SSE push to browser
                                                                      ↓
                                                    Graph adds new node + edges
                                                    Intelligence strip shows alert
                                                    Gap indicators update
```

This is the feedback loop that makes the visual layer feel alive. Larry does something in the terminal, and the browser reacts within milliseconds. No page reload. No regeneration. Just DOM patching from SSE events.

## Why this matters for each user archetype

| User | Terminal comfort | Needs the browser because |
|------|-----------------|--------------------------|
| Jonathan (developer) | High | Wants to see the graph while talking to Larry. Two windows, two jobs. |
| Lawrence (professor) | Medium | Wants to see his room as a wiki for curriculum design. PDF export for JHU. |
| Lital's Technion students | Low | Will NOT use a terminal. Need buttons to run methodologies. |
| Noga's Merck colleagues | Zero | Need a shareable dashboard they can click through. No install. |
| Program managers (Lital) | Low | Need portfolio-level views across multiple venture rooms. |

The terminal-only product maxes out at the Jonathan/Lawrence archetype. The browser control surface unlocks everyone else.

## What already exists (prerequisites met by v1.10.10)

| Component | Status | Where |
|-----------|--------|-------|
| HTML templates (dashboard, wiki, deck, graph, insights) | Shipped | templates/presentation/*.html |
| De Stijl CSS design system | Shipped | templates/shared.css |
| Cytoscape.js graph visualization | Shipped | templates/presentation/dashboard.html |
| Room SQLite database (room.db) with typed edges | Shipped (v1.10.8 Phase 84) | room/.mindrian/room.db |
| node:sqlite cross-platform access | Shipped (v1.10.9 Phase 85) | lib/core/*.cjs via require('node:sqlite') |
| Wikilink engine ([[cross-references]]) | Shipped (v1.10.0 Phase 76) | lib/vault/wikilink-injector.cjs |
| generate-presentation.cjs (full HTML builder) | Shipped | scripts/generate-presentation.cjs |
| Intelligence cascade (INFORMS, CONTRADICTS, CONVERGES) | Shipped | scripts/intelligence-cascade.cjs |
| PostToolUse hook firing on every write | Shipped (v1.10.7 Phase 83) | hooks/hooks.json |
| Brain Cypher queries working | Shipped (v1.10.9 Finding I fix) | lib/core/brain-client.cjs |
| Python ML auto-install for whitespace | Shipped (v1.10.10 Plan 85-10) | scripts/lib/ensure_ml_deps.py |

Every prerequisite is already in production. Phase 86 wires them to a browser tab.

## Business model implication

The VIEWER (passive room visualization) ships free inside the plugin, covered by BSL 1.1. The CONTROL SURFACE (operational buttons that drive Claude Code) is the potential premium tier. Free users see everything. Paying users act on it.

This mirrors: Figma (free viewer, paid editor), Notion (free reader, paid contributor), GitHub (free read, paid private repos).

Decision deferred to GTM strategy. Filed at [[mindrian-gtm/gtm-strategy/bsl-1.1-ip-protection]].
