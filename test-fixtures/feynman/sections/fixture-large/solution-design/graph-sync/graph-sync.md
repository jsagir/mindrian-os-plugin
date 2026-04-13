---
type: artifact
title: Graph sync
created: 2026-04-14
---

# Graph sync

Detected edges are synced to the optional LazyGraph backend when the user has connected one. The sync is one-way from filesystem to graph. The filesystem remains authoritative.

Graph sync is opt-in. Users without a graph backend see every feature work identically; only cross-room traversal is absent. This preserves the one-command install rule.

Conflict resolution is trivially simple: the filesystem always wins. The graph is a derived view.
