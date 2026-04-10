# MindrianOS Plugin Optimization Review
**Date:** April 1, 2026 | **Version:** v1.6.1 | **Codebase:** ~125K lines, 362 files

---

## Executive Summary

The plugin architecture is strong -- clean layer separation, intelligent degradation (Tier 0-2), ICM-native design. But it has accumulated technical debt in three areas that need immediate attention:

1. **Context window bloat** -- 55KB auto-loaded per session, ui-system alone is 28.7KB (52%)
2. **Code duplication** -- parseFrontmatter written 3 times, file I/O patterns inconsistent
3. **Sync I/O without error handling** -- 66 readFileSync calls, only 36% wrapped in try-catch

---

## P0: Context Window Bloat (Biggest ROI)

Every byte loaded into skills/commands eats context budget. This is the #1 optimization target.

### Auto-Loaded Skills: 55KB/session

| Skill | Size | % Budget | Action |
|-------|------|----------|--------|
| **ui-system** | 28.7KB | **52%** | CRITICAL: Move glyph tables, color maps, zone examples to /references/. Keep SKILL.md to 8-10KB max. Make lazy-loaded. |
| room-proactive | 8.0KB | 14% | Trim examples, keep rules only |
| larry-personality | 5.5KB | 10% | OK |
| room-passive | 5.3KB | 10% | OK |
| brain-connector | 4.3KB | 8% | OK |
| context-engine | 3.8KB | 7% | OK |
| pws-methodology | 0.03KB | <1% | OK |

**Target:** Cut from 55KB to 30KB/session by trimming ui-system and room-proactive.

### Largest Commands (loaded on invoke)

| Command | Size | Lines | Action |
|---------|------|-------|--------|
| file-meeting.md | 28.4KB | 705 | Split into 3 sub-commands (parse, file, update-graph) |
| rooms.md | 14.5KB | 553 | Extract multi-room ops to shared lib |
| setup.md | 14.3KB | 413 | Acceptable for one-time use |
| act.md | 14.1KB | 379 | Extract framework selection logic to lib |
| new-project.md | 14.1KB | 354 | Acceptable for one-time use |

**Target:** file-meeting.md from 28.4KB to <15KB by splitting pipeline steps.

---

## P0: Crash-Risk File Operations

4 unguarded readFileSync/writeFileSync in artifact-id.cjs that will crash the process if file is locked, missing, or permissions change:

```
artifact-id.cjs:63  - fs.readFileSync (NO try-catch)
artifact-id.cjs:85  - fs.writeFileSync (NO try-catch)
artifact-id.cjs:102 - fs.readFileSync (NO try-catch)
artifact-id.cjs:139 - fs.writeFileSync (NO try-catch)
```

Also: presentation-server.cjs line 63 has fs.readFileSync inside an Express request handler -- blocking the event loop on every HTTP request.

**Fix:** Wrap all 4 in try-catch. Convert presentation-server to async. Estimated: 2 hours.

---

## P1: Code Duplication

### Triple-duplicated YAML frontmatter parser (240+ lines)

| File | Implementation | Lines |
|------|---------------|-------|
| opportunity-ops.cjs | Basic parseFrontmatter | ~100 |
| persona-ops.cjs | Similar implementation | ~70 |
| reasoning-ops.cjs | Enhanced with nesting | ~70 |

**Fix:** Extract to `lib/core/frontmatter-parser.cjs`. One implementation, three exports (basic, nested, serializer). Note: gray-matter is already in package.json but NOT used anywhere -- the custom parser was written 3 times instead of using the installed dependency.

### File I/O pattern inconsistency

66 synchronous file operations across lib/, using 3 different patterns:
- Bare `fs.readFileSync` (no guard)
- `fs.existsSync` check then read
- `safeReadFile` helper (exists in index.cjs but underused)

**Fix:** Standardize on safeReadFile/safeWriteFile wrappers everywhere. Estimated: 4 hours.

---

## P1: Bloated Files (>600 lines, need splitting)

| File | Lines | Split Into |
|------|-------|-----------|
| wiki-layout.cjs | 1,459 | wiki-render-zones.cjs, wiki-render-blocks.cjs, wiki-render-toc.cjs |
| opportunity-ops.cjs | 1,127 | funding-ops.cjs, opportunity-discovery.cjs, signal-analysis.cjs |
| generate-snapshot.cjs | 1,148 | snapshot-data.cjs, snapshot-html.cjs, snapshot-template.cjs |
| compute-hsi.py | 818 | hsi-algorithm.py, hsi-ingestion.py |
| build-graph | 734 | graph-schema.cjs, graph-ingest.cjs |
| file-meeting.md | 705 | file-meeting-parse.md, file-meeting-store.md, file-meeting-graph.md |

**Estimated effort:** 2-3 sprints for all 6.

---

## P1: Script Fragmentation (55 scripts -> ~25)

### Consolidation opportunities:

| Current | Count | Consolidate To |
|---------|-------|---------------|
| sentinel-health, sentinel-deadlines, sentinel-competitors, sentinel-hsi | 4 | single sentinel-runner with --mode flag |
| compute-hsi, compute-state, compute-team, compute-meetings-intelligence, compute-opportunity-state | 5 | intelligence-pipeline with stage selection |
| generate-snapshot, generate-presentation, generate-export | 3 | export-engine with format plugins |
| session-start, room-registry, resolve-room | 3 | room-context-manager |

**Result:** 55 -> ~40 scripts (15 eliminated). Reduces mental model complexity for contributors.

---

## P1: Command Directory Redundancy

### Merge candidates:

| Current Commands | Merge Into | Savings |
|-----------------|-----------|---------|
| analyze-systems, analyze-needs, analyze-timing | analyze.md --dimension={systems,needs,timing} | ~600 lines |
| explore-domains, explore-trends, explore-futures | explore.md --scope={domains,trends,futures} | ~500 lines |
| grade.md + deep-grade.md | grade.md --depth={standard,deep} | ~200 lines |
| find-connections, find-analogies, find-bottlenecks | find.md --type={connections,analogies,bottlenecks} | ~400 lines |

**Total savings:** ~1,700 lines, ~20KB of command files.

---

## P2: Inconsistencies

### File extensions
- lib/core/: `.cjs` (consistent)
- lib/chat/: `.js` (inconsistent)
- lib/graph/: `.js` (inconsistent)

**Rule needed:** `.cjs` = CommonJS (Node), `.js` = browser-compatible only.

### Naming conventions (4 patterns used interchangeably)
- dash-separated: `opportunity-ops.cjs` (filenames)
- snake_case: `model_profile` (some exports)
- camelCase: `parseVentureStage` (functions)
- UPPER_CASE: `MODEL_PROFILES` (constants)

**Rule needed:** camelCase for functions/vars, UPPER_CASE for constants, dash-case for filenames. Document in CLAUDE.md.

### State management patterns
- `getState()` reads from disk
- `computeState()` generates on-demand
- `getFundingState()` mixed
- No clear contract for when data is cached vs. fresh

**Fix:** Document state contract: get* = read cached, compute* = regenerate, list* = enumerate.

### Dual graph implementations
- `graph-ops.cjs`: graph build operations
- `lazygraph-ops.cjs`: lazy evaluation version
- No documentation on when to use which

**Fix:** Document or consolidate. If lazygraph supersedes graph-ops, deprecate the older one.

---

## P2: Testing Gaps

### Current state:
- 63 test files, 524K lines -- but 90% is fixture data (meeting transcripts, room artifacts)
- Shell script integration tests only
- NO unit test framework (Jest, Mocha, Pytest)
- NO coverage reporting

### Critical untested paths:
- `compute-hsi.py` (HSI scoring algorithm)
- `build-graph` (knowledge graph construction)
- `analyze-room` (cross-section relationship detection)
- `detect-reverse-salients.py` (reverse salient identification)
- `parseFrontmatter` (used everywhere, written 3 times)

**Recommendation:** Add Jest for JS, Pytest for Python. Target 80% coverage on lib/core/. Estimated: 1 sprint for framework + 20 critical tests.

---

## P2: Reference Duplication

Schema/taxonomy information duplicated across:
- `/references/methodology/` AND command YAML frontmatter
- `/references/brain/` AND `lib/core/brain-client.cjs`
- `/references/opportunities/` AND `lib/core/opportunity-ops.cjs`

**Fix:** Single source of truth in /references/. Code imports from references. Never duplicate schema.

---

## P3: Dependency Cleanup

### gray-matter paradox
- gray-matter is installed (in package.json)
- Custom YAML parser written 3 times instead of using it
- Either use gray-matter or remove from package.json

### asciichart minimal usage
- 1 usage in visual-ops.cjs
- Not a problem, but worth noting as a candidate for removal if visual-ops is refactored

---

## Architecture Strengths (Don't Touch)

These are well-designed and should be preserved:

1. **Layer separation** -- commands -> skills -> agents -> lib -> scripts. Clean, no circular deps in the hot path.
2. **Intelligent degradation** -- Tier 0 (plugin only) -> Tier 1 (room) -> Tier 2 (Brain). Works without any external services.
3. **Skill count** -- 7 skills is right-sized. Each non-redundant, well-scoped.
4. **Agent specialization** -- 8 agents, 59-189 lines each. Tight. No overlap.
5. **Hook system** -- 9 hooks, loosely coupled. Clean dispatch.
6. **Pipeline architecture** -- 3 pipelines with stage contracts. ICM Layer 2 done right.
7. **Zero dead code** -- No TODOs, FIXMEs, or commented-out blocks. Excellent discipline.
8. **Minimal root config** -- All complexity delegated to proper layers.

---

## Sprint Plan

### Sprint 1 (Highest ROI -- context budget + crash prevention)
- [ ] Trim ui-system SKILL.md from 28.7KB to 10KB (move tables to /references/)
- [ ] Wrap 4 unguarded file ops in artifact-id.cjs
- [ ] Fix presentation-server.cjs sync read in request handler
- [ ] Extract parseFrontmatter to shared module (or use gray-matter)
- **Estimated:** 8-12 hours. Saves 18KB context/session, eliminates 4 crash paths.

### Sprint 2 (Code health)
- [ ] Standardize file I/O on safeReadFile/safeWriteFile
- [ ] Split wiki-layout.cjs (1,459 lines) into 3 modules
- [ ] Split file-meeting.md (705 lines) into sub-commands
- [ ] Document .cjs vs .js rule, naming conventions, state contracts
- **Estimated:** 16-20 hours.

### Sprint 3 (Consolidation)
- [ ] Merge analyze-* commands (4 -> 1)
- [ ] Merge explore-* commands (3 -> 1)
- [ ] Merge find-* commands (3 -> 1)
- [ ] Consolidate sentinel-* scripts (4 -> 1)
- [ ] Consolidate compute-* scripts (5 -> 1)
- **Estimated:** 12-16 hours. Eliminates ~15 files.

### Sprint 4 (Testing)
- [ ] Add Jest config + 10 core unit tests
- [ ] Add Pytest config + 5 HSI/reverse-salient tests
- [ ] CI pipeline for test execution
- **Estimated:** 12 hours for framework + first 15 tests.

### Sprint 5 (Polish)
- [ ] Split remaining bloated files (opportunity-ops, generate-snapshot, compute-hsi)
- [ ] Single source of truth for schema/taxonomy
- [ ] Clarify graph-ops vs lazygraph-ops
- [ ] Architecture diagram + dependency graph
- **Estimated:** 16-20 hours.

**Total optimization effort: 65-80 hours across 5 sprints. No feature freeze required.**

---

## Metrics Summary

| Metric | Current | After Optimization |
|--------|---------|-------------------|
| Context loaded/session | 55KB | ~30KB |
| Files | 362 | ~330 |
| Scripts | 55 | ~40 |
| Commands | 62 | ~50 |
| Crash-risk file ops | 4 | 0 |
| Duplicated parseFrontmatter | 3 copies (240 lines) | 1 shared module |
| Files >600 lines | 7 | 1-2 |
| Test coverage | ~0% | 80% on lib/core/ |
| Dead dependencies | 1 (gray-matter unused) | 0 |

---

*Generated from MindrianOS-Plugin v1.6.1 code analysis, April 1, 2026.*
