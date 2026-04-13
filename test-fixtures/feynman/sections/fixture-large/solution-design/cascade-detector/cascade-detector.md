---
type: artifact
title: Cascade detector
created: 2026-04-14
---

# Cascade detector

When an artifact is filed, the cascade detector scans for edges to other sections. Five edge types are detected: INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES.

Detection is a mix of structural rules (wikilink references, frontmatter cross-refs) and content heuristics (shared entity names, opposite claim patterns). The heuristics are intentionally conservative so false positives stay rare.

Detected cascades are surfaced to the user as proposals, never applied automatically. The user approves, rejects with a reason, or defers.
