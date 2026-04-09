---
name: snapshot
description: Generate a shareable single-file Data Room snapshot -- De Stijl tabbed hub with all content inline
usage: /mos:snapshot [ROOM_PATH] [--output PATH] [--open]
category: export
surface: cli, desktop, cowork
requires: room
allowed-tools:
  - Bash
  - Read
---

# /mos:snapshot

Generate a **single standalone HTML file** containing your entire Data Room -- De Stijl themed, tabbed navigation, all content inline, shareable via email or deployable to Vercel/Render.

## What It Does

1. Reads the Room at `ROOM_PATH` (defaults to `./room`)
2. Recursively scans all sections (standard + custom) and nested `.md` files
3. Reads `STATE.md` for venture name, stage, and key insight
4. Generates a **single HTML file** with:
   - De Stijl header with Mondrian color bars
   - Sticky tabbed navigation (auto-generated from sections)
   - Overview tab with venture card, insight box, stats
   - Each section as a tab with articles rendered as colored cards
   - All CSS inline, markdown converted to HTML
   - Zero external dependencies (except Google Fonts + Chart.js CDN)

## Output

```
room/exports/hub.html          # Default output
```

Or specify a custom path:

```
room/exports/my-snapshot.html  # With --output flag
```

## How to Run

```bash
# Default: generate hub.html in room/exports/
node scripts/generate-hub.cjs ./room

# Custom output path
node scripts/generate-hub.cjs ./room --output ./my-export.html
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

2. **Run the hub generator:**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-hub.cjs" ./room
   ```

3. **If `--open` flag:** Open the result in browser:
   ```bash
   # macOS
   open room/exports/hub.html
   # Linux
   xdg-open room/exports/hub.html
   # Windows
   explorer.exe room/exports/hub.html
   ```

4. **Report the result:**
   > "Your Data Room snapshot is at `room/exports/hub.html`. Single file -- open it in any browser, send it by email, or deploy to Vercel. All your content is inline."

5. **If some sections are empty**, mention them:
   > "A few sections are still empty ({list}). Fill those and re-export for a stronger snapshot."

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Runs `generate-hub.cjs`, outputs path, optional `--open` launches browser |
| **Desktop** | Larry says "I've created a shareable snapshot of your Data Room. Here's the file." |
| **Cowork** | Generates to shared `00_Context/exports/` so team members can access |

## Technical

- **Script:** `scripts/generate-hub.cjs`
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
