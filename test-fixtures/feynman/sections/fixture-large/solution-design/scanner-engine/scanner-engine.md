---
type: artifact
title: Scanner engine
created: 2026-04-14
---

# Scanner engine

The room scanner walks the filesystem and emits a structured view of every section, artifact, and cross-reference. It is a pure function from directory tree to JSON.

The scanner handles all the edge cases of real-world directories: empty sections, orphaned artifacts, legacy flat files, nested sub-rooms. It never mutates state. Mutations go through the writer scripts.

The scanner is the foundation of every other subsystem. If the scanner drifts, every downstream check drifts with it.
