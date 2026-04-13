---
type: artifact
title: Export pipeline
created: 2026-04-14
---

# Export pipeline

The export pipeline produces six views of any room: dashboard, wiki, deck, diagrams, graph, todos. All six are generated from the same filesystem state so they cannot drift.

Each view is a standalone static site that a user can open in a browser without any server running. The dashboards use the De Stijl visual system and are fully interactive through client-side JavaScript only.

The export pipeline is the presentation layer for investors and partners. It is how a private room becomes a shareable artifact.
