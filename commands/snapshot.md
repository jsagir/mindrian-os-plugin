---
name: snapshot
description: Freeze your RoomHub into a shareable static HTML export
usage: /mos:snapshot [ROOM_PATH] [--offline] [--open]
category: export
surface: cli, desktop, cowork
requires: room
---

# /mos:snapshot

Freeze the current Room into a **SnapshotHub** - a self-contained folder of co-located HTML files that can be shared, archived, or opened offline.

## What It Does

1. Reads the Room at `ROOM_PATH` (defaults to `./room`)
2. Scans all Sections, Entries, Fabric (graph.json), and State
3. Generates **7 Showcase views** as co-located HTML files with shared CSS/JS
4. Writes a `manifest.json` with Room metrics and snapshot metadata
5. Adds a version history sidebar from `room/.snapshots/` (if available)
6. Outputs everything to `room/exports/{YYYY-MM-DD-HHmm}/`

## Output Structure

```
room/exports/2026-03-31-1430/
  index.html          # Overview (dashboard)
  library.html        # Entry browser (wiki)
  narrative.html      # Deck slides
  synthesis.html      # Insights + stats
  blueprint.html      # Diagrams (Mermaid)
  constellation.html  # Knowledge graph (Cytoscape)
  chat.html           # Fabric chat (requires API key)
  shared.css          # Shared De Stijl styles
  shared.js           # Shared navigation + utilities
  manifest.json       # Room metrics + snapshot metadata
```

## Flags

| Flag | What It Does |
|------|-------------|
| `--offline` | Inline all CDN dependencies (Cytoscape.js, FlexSearch, Mermaid.js, Chart.js). Produces larger files but works with zero network. |
| `--open` | Open the snapshot in the default browser after generation. |

## Usage

```bash
# Basic: snapshot the current room
/mos:snapshot

# Snapshot a specific room
/mos:snapshot ~/rooms/my-venture

# Offline-capable export
/mos:snapshot --offline

# Generate and immediately view
/mos:snapshot --open
```

## Summary Output

After generation, Larry reports:

```
SnapshotHub generated: 7 views, 42 entries, 12 threads
  Location: room/exports/2026-03-31-1430/
  Open: file:///.../room/exports/2026-03-31-1430/index.html
```

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Runs `generate-snapshot.cjs`, outputs path, optional `--open` launches browser |
| **Desktop** | Larry says "I've frozen your Room into a shareable snapshot. Here's the link." |
| **Cowork** | Generates to shared `00_Context/exports/` so team members can access |

## Technical

- **Script:** `scripts/generate-snapshot.cjs`
- **Zero dependencies:** Uses only Node.js built-ins
- **Incremental manifests:** Each snapshot appends to `room/exports/manifest.json`
- **file:// compatible:** All views work when opened directly from filesystem (chat requires API key)
- **Signature footer:** Every view includes "Built with MindrianOS" + Mondrian color bar

## Requirements

- SNAP-01: Static HTML to room/exports/{YYYY-MM-DD-HHmm}/
- SNAP-02: All 7 views as co-located HTML + shared CSS/JS
- SNAP-03: manifest.json with Room metrics
- SNAP-04: Version history sidebar from room/.snapshots/
- POLISH-01: Responsive 375px-1440px
- POLISH-02: CDN default, --offline inlines all deps
- POLISH-03: Works on file:// protocol
- POLISH-04: Signature footer + Mondrian bar in all views
