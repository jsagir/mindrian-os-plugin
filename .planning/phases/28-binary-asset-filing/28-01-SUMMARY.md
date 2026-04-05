---
phase: 28-binary-asset-filing
plan: 01
title: Binary Asset Filing Pipeline
subsystem: asset-management
tags: [binary-filing, manifest, post-write, assets]
dependency_graph:
  requires: [scripts/git-ops, scripts/classify-insight, lib/core/room-ops.cjs]
  provides: [scripts/file-asset, lib/core/asset-ops.cjs, ASSET_MANIFEST.md]
  affects: [scripts/post-write, commands/new-project.md, commands/file-meeting.md]
tech_stack:
  added: []
  patterns: [execSync-wrapper, manifest-table-parsing, binary-extension-classification]
key_files:
  created:
    - scripts/file-asset
    - lib/core/asset-ops.cjs
  modified:
    - scripts/post-write
    - commands/new-project.md
    - commands/file-meeting.md
decisions:
  - "Manifest regenerated from filesystem scan on every filing (not incremental append)"
  - "Meeting audio wrappers go to meetings/{id}/ directory, not assets/"
  - "Binary detection in post-write exits early (skips classify-insight for non-markdown)"
  - "Room dir walk-up moved before .md guard so binary files can resolve room context"
metrics:
  duration: 2min
  completed: 2026-03-29
  tasks: 2
  files: 5
---

# Phase 28 Plan 01: Binary Asset Filing Pipeline Summary

Binary asset filing with classify/copy/wrap/manifest pipeline wiring PDFs, images, video, and audio into the room as first-class artifacts with markdown wrappers and auto-updated ASSET_MANIFEST.md.

## What Was Built

### scripts/file-asset (194 lines)
Bash script that files a binary asset into a room:
- Classifies type from extension (pdf, image, video, audio, document, archive)
- Copies binary to assets/{section}/ and creates markdown wrapper with frontmatter
- --meeting flag for meeting audio (no copy, wrapper links to transcript)
- --manifest-only flag regenerates ASSET_MANIFEST.md without filing
- Auto-regenerates manifest by scanning assets/ and meetings/ directories
- Git commits asset, wrapper, and manifest via git-ops

### lib/core/asset-ops.cjs (137 lines)
Node.js wrapper following room-ops.cjs pattern (execSync, zero npm deps):
- fileAsset(roomDir, filePath, section, options) - calls file-asset script
- readManifest(roomDir) - parses ASSET_MANIFEST.md table into structured array
- updateManifest(roomDir) - regenerates manifest via --manifest-only
- getAssetsBySection(roomDir, section) - filter by section
- getAssetsByType(roomDir, type) - filter by type (image, pdf, video, etc.)

### scripts/post-write (extended)
- Binary file detection added BEFORE .md processing path
- Room dir walk-up refactored to run for ALL file types (not just .md)
- Binary extensions route to file-asset in background, then exit (skip classify-insight)
- Existing .md processing path unchanged

### commands/new-project.md (extended)
- assets/ directory added to Step 4 room structure creation
- Note documenting that subdirectories are created on demand by file-asset

### commands/file-meeting.md (extended)
- Audio filing now registers in ASSET_MANIFEST.md via file-asset --meeting
- Documents the markdown wrapper with transcript link pattern

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b5b98c5 | Create file-asset script and asset-ops.cjs module |
| 2 | aee7e2d | Wire post-write hook + extend new-project and file-meeting |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED
