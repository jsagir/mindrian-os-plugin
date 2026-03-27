---
name: wiki
description: Open the Data Room wiki — browse room sections as Wikipedia-style pages
body_shape: D (Document View)
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash
---
# /mos:wiki

Open the localhost wiki dashboard for the current Data Room.

## What it does
Launches a local Express server that renders room/ .md files as Wikipedia-style pages with:
- Section navigation sidebar (collapsible folder tree)
- Table of contents per page
- Infobox from YAML frontmatter
- [[wikilink]] cross-references as clickable hyperlinks
- KuzuDB graph edges as "See also" and backlinks
- Interactive knowledge graph view (home page)
- Full-text search across all pages
- Dark/light mode toggle
- Onboarding tour for first-time users (guided walkthrough with skip)
- De Stijl design

## Usage

```bash
# Open the wiki locally
bash scripts/serve-wiki

# Export as static HTML for sharing
bash scripts/serve-wiki --export
```

## Flags

- **No flags** — Opens wiki in browser at localhost:8421
- **`--export`** — Generates a static HTML bundle in `export/wiki/` that can be:
  - Deployed to Render or Vercel for team sharing
  - Sent as a zip file
  - Hosted anywhere as static files

## Sharing Your Data Room

Want to share with teammates or investors?

1. Run `/mos:wiki --export` to generate static HTML
2. Deploy to Vercel: `cd export/wiki && npx vercel`
3. Or deploy to Render: push `export/wiki/` to a repo with a `render.yaml`
4. Or just zip and send: `zip -r data-room.zip export/wiki/`

**Privacy note:** The exported HTML contains your room content. Share only what you intend to share. MindrianOS does not host or access your data.

## First-Time Experience

New users get an automatic guided tour:
1. Highlights each wiki zone (header, sidebar, content, infobox, search, footer)
2. Explains what each part does
3. "Next" to continue, "Skip tour" to dismiss
4. Tour never shows again after completion (stored in localStorage)

## Notes
- Port: 8421 (auto-increments if busy, range 8421-8430)
- Read-only: edit files in your IDE, wiki auto-refreshes via file watcher
- Graph dashboard remains at port 8420 via /mos:visualize
- Chat panel is present (stub — full Larry integration coming)
