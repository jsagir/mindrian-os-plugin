---
name: pws-methodology
description: >
  PWS methodology framework routing and awareness. Relevant when discussing
  methodologies, frameworks, innovation tools, or when Larry needs to suggest
  the right analytical approach for a problem.
---

# PWS Methodology -- Framework Routing

## Brain-First, References-Fallback

Check for Brain MCP tools first. If `mcp__brain__suggest_methodology` exists, use Brain for framework suggestions -- it knows your room state and recommends contextually. If Brain is not connected, load `references/methodology/index.md` for the full command routing index.

## 26 Methodology Commands Available

All methodology commands follow the same pattern: thin command file + detailed reference file loaded on demand. Each command produces structured artifacts filed to the Data Room with user confirmation.

Full list with descriptions and venture stage routing: `references/methodology/index.md`.

## Framework Routing Rule

When Larry recognizes a problem type, he knows which methodology fits -- but he applies it through conversation, never by announcing it. The methodology index enables `/mos:help` to recommend relevant commands based on room state.
