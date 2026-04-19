---
section: solution-design/ui-ux-pathways
parent: solution-design
purpose: Visual control surface architecture for MindrianOS -- from passive dashboard to bidirectional browser platform
created: 2026-04-16
source: Session discussion 2026-04-16 (Jonathan + Larry), post-v1.10.9/v1.10.10 shipping
status: active-design
---

# UI/UX Pathways

This sub-room captures the product vision, architecture options, and implementation path for MindrianOS's visual layer -- the browser-based control surface that complements Claude Code's terminal interface.

## Origin

Emerged organically during the v1.10.9 shipping session on 2026-04-16. After shipping 10 plans across Windows and Mac, the question surfaced: "What about putting a UI back on Claude Code?" The discussion evolved from a simple localhost dashboard to a full bidirectional control surface where the browser DRIVES Claude Code actions, not just displays room state.

## Key insight

The terminal (Claude Code) is the execution engine. The browser is the control surface. They share the room filesystem and room.db (SQLite). Claude's token budget goes to THINKING, not RENDERING. The visual layer costs zero tokens because it reads directly from the filesystem and database that Claude already writes to.

## Artifacts in this sub-room

| Artifact | What it captures |
|----------|-----------------|
| architecture-vision.md | The full bidirectional control surface vision (MindrianOS Desktop) |
| phase-86-localhost-spec.md | Phase 86 spec: localhost server + SQLite graph + wikilinks + live-reload |
| phase-87-operational-buttons.md | Phase 87 spec: clipboard bridge -> command queue -> RemoteTrigger |
| token-economics.md | Why the visual layer costs zero tokens and how it stays that way |
| alternatives-considered.md | Quarto, Electron, Chrome extension, Tauri, PWA -- evaluated and ranked |

## Cross-references

- [[solution-design/ttfv-reverse-salient]] -- "verbal explanations fail, live demos convert" (Claim 1 from Noga meeting) directly motivates the visual layer
- [[solution-design/pws-mindrianos-workshop-integration]] -- Lital's Technion students need buttons, not terminal commands
- [[competitive-analysis/causal-claims-from-meetings]] -- Claims 1, 2, 6, 7, 9 all point at the visual control surface as the product gap
