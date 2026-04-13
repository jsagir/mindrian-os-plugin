---
type: artifact
title: Data layer
created: 2026-04-14
---

# Data layer

All state lives as markdown files with YAML frontmatter plus a small number of JSON files for state snapshots. There is no database, no SQLite, no Redis. The filesystem is the database.

This is a deliberate constraint. Adding a database would create a dual source of truth between the filesystem and the database, and the filesystem would always drift first because humans edit files directly.

The read model for queries is built on the fly by scanning the filesystem. For rooms with under ten thousand files this is fast enough and requires zero cache invalidation.
