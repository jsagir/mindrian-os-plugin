---
type: artifact
title: CLI surface
created: 2026-04-14
---

# CLI surface

The CLI surface is the primary development target. Every feature ships here first and must work under plugin install without configuration.

Hooks fire at session start, at pre-tool-use, and at post-file-write. Scripts run with full filesystem access. The user interacts through slash commands and through direct shell invocations.

The CLI surface is where power users live. It is the reference implementation for everything else.
