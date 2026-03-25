---
name: wiki
description: Open the Data Room wiki — browse room sections as Wikipedia-style pages
allowed-tools: Bash
---
# /mos:wiki

Open the localhost wiki dashboard for the current Data Room.

## What it does
Launches a local Express server that renders room/ .md files as Wikipedia-style pages with:
- Section navigation sidebar
- Table of contents per page
- Infobox from YAML frontmatter
- [[wikilink]] cross-references
- De Stijl dark theme (with light mode toggle)

## Usage
Run: `bash scripts/serve-wiki`

The wiki opens in your default browser. Press Ctrl+C in the terminal to stop.

## Notes
- Port: 8421 (auto-increments if busy, range 8421-8430)
- Read-only: edit files in your IDE, wiki auto-refreshes (coming soon)
- Graph dashboard remains at port 8420 via /mos:visualize
