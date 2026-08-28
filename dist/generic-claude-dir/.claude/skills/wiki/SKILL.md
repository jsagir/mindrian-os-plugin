---
name: wiki
description: Open the Data Room wiki of room sections
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Open your room as a localhost wiki, hyperlinks via graph."
body_shape: D (Document View)
hitl_shape: "F.1"
hitl_why: "The wiki view offers one next move on which article to open."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 25): first delivery at commands/wiki.md:48, the bare-invocation live Express server rendering room content, ephemeral, nothing persisted unless --export.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["audit-room", "prepare-pitch"]
teaching: "When you want to read the Data Room as linked wiki pages, /mos:wiki opens the wiki view. Section by section, with cross-references rendered as hyperlinks."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read AskUserQuestion
# --- Phase 172-16 CIRS R1 WIRE (Canon Part 11; navigator-directed 2026-06-23) ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: room-wiki
  framework: null
  posture: hold
  hierarchy_rank: 12
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
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
# /mos:wiki

Open the localhost wiki dashboard for the current Data Room.

## What it does
Launches a local Express server that renders room/ .md files as Wikipedia-style pages with:
- Room Home dashboard (landing page) + knowledge graph tab
- BlockNote editing surface with direct save-to-markdown
- Per-article PDF and Word (DOCX) export
- Section navigation sidebar (collapsible folder tree)
- Table of contents per page
- Infobox from YAML frontmatter
- [[wikilink]] cross-references as clickable hyperlinks
- SQLite graph edges as "See also" and backlinks
- Full-text search across all pages
- Dark/light mode toggle
- De Stijl design

## Usage

```bash
# Open the wiki locally
bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/serve-wiki"

# Export as static HTML for sharing
bash "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/serve-wiki" --export
```

## Flags

- **No flags** - Opens wiki in browser at localhost:8421
- **`--export`** - Generates a static HTML bundle in `export/wiki/` that can be:
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

## Notes
- Port: 8421 (auto-increments if busy, range 8421-8430)
- Direct save: editing an article and clicking Save rewrites its .md file in place. There is no confirmation dialog and no conflict check, so a concurrent external edit (your IDE, another Claude Code session) can be overwritten.
- Graph dashboard remains at port 8420 via /mos:visualize
- Chat panel is present (stub - full Larry integration coming)
