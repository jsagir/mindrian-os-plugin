---
type: artifact
title: Reasoning renderer
created: 2026-04-14
---

# Reasoning renderer

The reasoning renderer takes the structural payload from the plan phase and a narrative JSON object, and produces the final MINTO.md file. It is a pure assembly function with zero external calls.

The renderer is byte-stable given the same inputs and a frozen date stamp. This is what makes the integration tests deterministic.

The renderer is the boundary between the reasoning work (Claude inside the slash command session) and the storage work (bytes on disk).
