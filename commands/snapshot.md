---
name: snapshot
description: Package a Data Room snapshot for sharing
help_jtbd: "Capture a snapshot of your room at this moment."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It offers one snapshot action to approve or defer."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 17): first delivery at commands/snapshot.md:148, two persisted self-contained HTML files (lobby plus hub) explicitly shareable via email or Vercel deploy.
interactive_first_reward: live_deliverable
argument-hint: '[<room-path>] [--open]'
serves_jtbd: ["prepare-pitch", "audit-room"]
teaching: "When you need a frozen Data Room artifact to share with someone outside the team, /mos:snapshot packages everything into a portable bundle. Read-only by design."
# Phase 237-05: declares the server-executable join the chain-step dispatcher consumes.
executable:
  script: scripts/generate-hub.cjs
  args:
    - ${ROOM_DIR}
  produces: exports/hub.html
disable-model-invocation: true
usage: /mos:snapshot [ROOM_PATH] [--output PATH] [--open]
category: export
surface: cli, desktop, cowork
requires: room
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Captures a room snapshot on explicit navigator request or schedule; a maintenance / archival action, not contextually triggered."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:snapshot

Generate a **Data Room export package** -- an editorial 3-door lobby (`index.html`) plus the full single-file museum (`hub.html`). Warm De Stijl themed, shareable via email, deployable to Vercel/Render in one step.

**Two outputs, one command:**

| File | Purpose | Feel |
|------|---------|------|
| `index.html` | The **lobby** -- 3 doors picked adaptively from what your room has | Editorial landing page. What you show someone first. |
| `hub.html` | The **museum** -- every artifact across every section, single file | Complete reference. Linked from Door 2 of the lobby. |

## Door Selection (lobby)

- **Door 2 (CENTER)** is always **Full Data Room** -- links to `hub.html`
- **Doors 1 & 3 (flanks)** are picked adaptively from detected deliverables, priority-ranked:
  1. Feynman Deck (presentation.html)
  2. Bank of Opportunities (opportunity-bank/)
  3. Investment Thesis (build-thesis artifact)
  4. Mullins 7 Domains (mullins artifact)
  5. Deep Grade (deep-grade artifact)
  6. Six Hats Personas
  7. Devil's Advocate (challenge-assumptions)
  8. Meeting Intelligence (meetings/)
  9. Knowledge Graph (dashboard.html)
- If fewer than 2 detected, starter "invitation" cards fill the gaps (never a broken grid)

## What It Does

1. Reads the Room at `ROOM_PATH` (defaults to `./room`)
2. Recursively scans all sections (standard + custom) and nested `.md` files
3. Reads `STATE.md` for venture name, stage, and optional `tagline:` frontmatter field
4. Runs **two generators in sequence**:
   - `generate-hub.cjs` → `room/exports/hub.html` (the museum, full content inline)
   - `generate-lobby.cjs` → `room/exports/index.html` (the 3-door lobby, links to hub.html)
5. Both outputs: v1.9.8 brand lockup (logo top-right, "Made by Mindrian" footer), warm De Stijl palette, zero npm dependencies

## Output

```
room/exports/
├── index.html      # Lobby (3 doors, adaptive) -- served as site root
└── hub.html        # Museum (full content) -- Door 2 destination
```

## How to Run

```bash
# Default: generate BOTH index.html (lobby) and hub.html (museum)
node scripts/generate-hub.cjs ./room
node scripts/generate-lobby.cjs ./room

# Lobby only (museum already fresh)
node scripts/generate-lobby.cjs ./room
```

## Flags

| Flag | What It Does |
|------|-------------|
| `--output PATH` | Write the HTML to a specific location instead of room/exports/hub.html |
| `--open` | Open the snapshot in the default browser after generation |

## Usage

```bash
# Basic: snapshot the current room
/mos:snapshot

# Snapshot a specific room
/mos:snapshot ~/rooms/my-venture

# Generate with custom output name
/mos:snapshot --output ./synteris-hub.html

# Generate and immediately view
/mos:snapshot --open
```

## Implementation

When the user runs `/mos:snapshot`:

1. **Check the room exists.** If `room/` directory does not exist, tell the user to run `/mos:new-project`.

2. **Run BOTH generators in sequence:**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-hub.cjs" ./room
   node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-lobby.cjs" ./room
   ```
   Order matters -- lobby references hub.html, so hub.html must exist first (or at least be scheduled to exist on deploy).

3. **If `--open` flag:** Open the **lobby** (not the museum) in the browser:
   ```bash
   # macOS
   open room/exports/index.html
   # Linux
   xdg-open room/exports/index.html
   # Windows
   explorer.exe room/exports/index.html
   ```

4. **Report the result:**
   > "Your Data Room export package is ready. `room/exports/index.html` is the lobby (3 doors), `room/exports/hub.html` is the museum (everything). Send the lobby to people -- it's what you show first. Deploy the whole `exports/` folder to Vercel and visitors land on the lobby by default."

5. **If some sections are empty**, mention them, but note the lobby handles it gracefully:
   > "Some sections are empty ({list}), but the lobby detected {N} deliverables and filled the doors. Starter invitation cards fill any remaining slots."

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Runs both generators, outputs paths, optional `--open` launches lobby in browser |
| **Desktop** | Larry says "I've created your Data Room lobby -- three doors picked based on what your room has. Here's what I chose and why." |
| **Cowork** | Generates to shared `00_Context/exports/` so team members can access |

## Technical

- **Scripts:** `scripts/generate-hub.cjs` + `scripts/generate-lobby.cjs`
- **Zero npm dependencies:** Uses only Node.js built-ins
- **Single file:** Everything inline -- CSS, content, navigation. No shared.css, no shared.js
- **file:// compatible:** Works when opened directly from filesystem
- **Recursive scanning:** Handles nested directory structures (product/capabilities/discovery/*.md)
- **Custom sections:** Auto-detects and renders any non-standard room sections
- **Signature footer:** "Built with MindrianOS" + Mondrian color bar

## Legacy Multi-File Export

The previous 7-view multi-file SnapshotHub is still available via:
```bash
node scripts/generate-snapshot.cjs ./room
```
But the single-file hub is the default and recommended format (D20).
