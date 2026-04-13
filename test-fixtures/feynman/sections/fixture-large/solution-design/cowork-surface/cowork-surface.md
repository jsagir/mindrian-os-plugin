---
type: artifact
title: Cowork surface
created: 2026-04-14
---

# Cowork surface

The Cowork surface is a multi-user environment where several agents share one room. The room is on shared storage and every agent reads and writes the same filesystem.

Concurrency is handled through atomic rename writes and through the cascade detector recognizing that multiple recent edits may need to be reviewed together. There is no distributed lock.

Cowork is the collaboration surface. Same engine, team chrome.
