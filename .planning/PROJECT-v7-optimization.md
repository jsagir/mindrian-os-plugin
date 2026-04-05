# MindrianOS Plugin Optimization (v7.0)

## What This Is

A performance and code health optimization of the MindrianOS Plugin (v1.6.x). No new features. Pure improvement of what exists: faster session startup, smaller context footprint, fewer crashes, cleaner code, better caching.

## Core Value

Users experience faster session starts (target: <1s vs current 1.5-3.5s), more context window headroom (target: 30KB vs 55KB system overhead), and zero crash-risk file operations.

## Why This Needs To Exist

Three deep-dive agent analyses (April 1, 2026) revealed performance bottlenecks invisible to users but compounding with every session:

1. **Session startup takes 1.5-3.5s** -- compute-state runs 4+ times/session (800ms-1.5s each), resolve-room spawns Python3 on every hook call (10-15x/session), context-monitor scans all sections on every statusline render (20-50x/session)
2. **55KB auto-loaded per session** -- ui-system alone is 28.7KB (52% of skill budget). 18KB recoverable.
3. **Zero caching layer** -- discoverSections() called 5-8x with no memoization, STATE.md read from 11+ independent locations, same directories scanned repeatedly
4. **4 crash-risk file operations** -- unguarded readFileSync/writeFileSync in artifact-id.cjs
5. **240+ lines duplicated** -- parseFrontmatter written 3x while gray-matter sits unused in package.json
6. **7 files exceed 600 lines** -- wiki-layout.cjs (1,459), opportunity-ops.cjs (1,127), generate-snapshot.cjs (1,148)

## Who It's For

All MindrianOS users (CLI, Desktop, Cowork). Improvements are invisible -- everything just gets faster and more reliable.

## Current State (Pre-Optimization Baseline)

- Session start: 1.5-3.5s synchronous blocking
- Context budget: 55KB/session system overhead (10.2% of 200K window)
- Caching: NONE in lib/core/
- Crash-risk operations: 4 unguarded in artifact-id.cjs
- Code duplication: parseFrontmatter x3 (240+ lines)
- Bloated files: 7 files >600 lines
- Scripts: 55 (fragmented)
- Commands: 62 (redundant analyze-*, explore-*, find-*)
- Test coverage: ~0% on lib/core/

## Success Criteria

1. Session start < 1 second (from 1.5-3.5s)
2. Context overhead < 32KB/session (from 55KB)
3. Zero crash-risk file operations
4. Zero duplicated parseFrontmatter implementations
5. No file in lib/ exceeds 500 lines
6. Module-level caching for discoverSections(), getState(), resolveRoom()
7. context-monitor < 50ms per invocation (from 250-500ms)
8. compute-state < 200ms when cached (from 800-1.5s)
9. Jest test framework with >50% coverage on lib/core/

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Extract shared frontmatter-parser.cjs, NOT use gray-matter | Phase 10 zero-dep-in-core decision was intentional |
| Cache invalidation via file mtime, not watchers | Simpler, no background processes |
| Fine granularity (8-12 phases) | Many independent changes, parallel execution safe |
| No feature freeze | Optimization is additive, not restructuring |
| Starts AFTER v6.2 ships | No conflicts with Phase 51 SnapshotHub |

## Requirements

### Active

- [ ] OPT-01: Trim ui-system SKILL.md from 28.7KB to <10KB
- [ ] OPT-02: Trim room-proactive SKILL.md from 8KB to ~5KB
- [ ] OPT-03: Split file-meeting.md (705 lines) into sub-commands
- [ ] OPT-04: Wrap 4 unguarded file ops in artifact-id.cjs with try-catch
- [ ] OPT-05: Fix presentation-server.cjs sync read in Express handler
- [ ] OPT-06: Extract parseFrontmatter to shared lib/core/frontmatter-parser.cjs
- [ ] OPT-07: Standardize all file I/O on safeReadFile/safeWriteFile wrappers
- [ ] OPT-08: Add module-level cache for discoverSections() with mtime invalidation
- [ ] OPT-09: Add module-level cache for getState() with mtime invalidation
- [ ] OPT-10: Cache resolve-room result in env var (invalidate on CwdChanged only)
- [ ] OPT-11: Cache context-monitor section state (invalidate on FileChanged only)
- [ ] OPT-12: Make learn-from-usage async (currently blocking 100-200ms)
- [ ] OPT-13: Make build-jtbd-nudges async or cached (blocking 200-400ms)
- [ ] OPT-14: Make detect-integrations cached for 1 hour (blocking 150-300ms)
- [ ] OPT-15: Consolidate compute-state subprocess spawns (4 spawns -> 1 process)
- [ ] OPT-16: Single-pass directory scan in compute-state (currently walks tree 4+ times)
- [ ] OPT-17: Split wiki-layout.cjs (1,459 lines) into 3 focused modules
- [ ] OPT-18: Split opportunity-ops.cjs (1,127 lines) into focused modules
- [ ] OPT-19: Split generate-snapshot.cjs (1,148 lines) into focused modules
- [ ] OPT-20: Merge analyze-* commands (4 -> 1 with --dimension flag)
- [ ] OPT-21: Merge explore-* commands (3 -> 1 with --scope flag)
- [ ] OPT-22: Merge find-* commands (3 -> 1 with --type flag)
- [ ] OPT-23: Consolidate sentinel-* scripts (4 -> 1)
- [ ] OPT-24: Consolidate compute-* scripts (5 -> 1 pipeline)
- [ ] OPT-25: Standardize .cjs vs .js file extensions
- [ ] OPT-26: Document state management contract (get* vs compute* vs list*)
- [ ] OPT-27: Add Jest framework + 15 critical path unit tests
- [ ] OPT-28: Add Pytest + 5 HSI/reverse-salient tests
- [ ] OPT-29: Resolve graph-ops.cjs vs lazygraph-ops.cjs duplication
- [ ] OPT-30: Fix O(n^2) cross-reference detection in compute-state

### Out of Scope

- New features or commands
- UI/UX changes to presentation views
- Brain MCP server optimization (separate repo)
- Restructuring the 3-layer architecture
- Changing the 7-skill count or agent specialization

## Context

**Analysis artifacts:**
- ~/MindrianOS-Plugin/OPTIMIZATION-REVIEW.md (initial review)
- ~/persona-sim/PERSONA-SIM-REVIEW-20260401.md (persona sim product review)
- 3 deep-dive agent analyses (session-start hot paths, context injection, caching gaps)

## Evolution

This document evolves at phase transitions and milestone boundaries.
Updates tracked per standard GSD process.

---
*Last updated: 2026-04-01 after initialization*
