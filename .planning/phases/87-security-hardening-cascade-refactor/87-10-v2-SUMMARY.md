---
phase: 87-security-hardening-cascade-refactor
plan: 10-v2
subsystem: release-gate
tags: [release, v1.10.12, stream-b, 5-gate, bsl-sweep, chat-presence, awaiting-tag]
requirements_closed: [CASCADE-01, CASCADE-02, CASCADE-03, CASCADE-04, CASCADE-05, CASCADE-06, DASH-04]
dependency_graph:
  requires: [87-03, 87-04, 87-05, 87-06, 87-07, 87-09, 87-10]
  provides: [v1.10.12 release commit, BSL sweep pass, phase 87 Stream B closure]
  affects: [CHANGELOG.md, .claude-plugin/plugin.json, package.json]
tech_stack:
  added: []
  patterns: [5-gate release protocol, git-diff-based BSL sweep, inverse chat-presence gate]
key_files:
  created: [.planning/phases/87-security-hardening-cascade-refactor/87-10-v2-SUMMARY.md]
  modified: [CHANGELOG.md, .claude-plugin/plugin.json, package.json, lib/memory/mcp-input-validation.test.cjs, lib/memory/sync-async-entry-points.test.cjs]
decisions:
  - "v1.10.12 Stream B release ships via 5-gate protocol: CHANGELOG + plugin.json + package.json bumped in one atomic commit (gates 1-3 done); git tag + marketplace.json ref pin gated on human verify (gates 4-5)."
  - "BSL sweep via git diff --name-only --diff-filter=A v1.10.11..HEAD found 2 test files (mcp-input-validation.test.cjs, sync-async-entry-points.test.cjs) with BSL marker outside the head -25 window or in @license BSL-1.1 dash form; normalized both to canonical 'BSL 1.1. Copyright (c) Mindrian 2026.' so the sweep passes cleanly."
  - "Chat-presence gate is the inverse of v1.10.11's chat-hide gate: dashboard.html must now contain chat-panel references (grep -c returns 3, >=1 required). 87-09's Task 9-2b mounted the panel."
  - "Engines-field hotfix (commit ad2a15e, pre-v1.10.12) verified: grep -c '\"engines\"' .claude-plugin/plugin.json returns 0."
release:
  tag: v1.10.12
  commit: b30484d
  pushed: false
  marketplace_pin_commit: null
  status: awaiting-tag
  date: 2026-04-19
metrics:
  duration: ~15min
  completed: 2026-04-19
  plans_aggregated: 6
  commits_in_range: 24
  files_changed_range: 35
  loc_added_range: 5028
  loc_deleted_range: 1269
  feynman_before: 22
  feynman_after: 28
---

# Phase 87 Plan 10-v2: v1.10.12 Release Gate (Stream B) Summary

**One-liner:** Stream B closure of Phase 87 — maintainability + intelligence release aggregating cascade dedup (87-03), sync/async two-entry-point split (87-04), MCP input validation (87-05), indexArtifact transaction wrap (87-06), Brain session cache + bounded LRU (87-07), and BYO API chat with Bearer+CSRF+Origin-bound auth (87-09); shipped via 5-gate protocol with gates 1-3 locked in this plan and gates 4-5 awaiting human verify.

## 5-Gate Release Protocol Status

| Gate | Target                                    | Status        | Evidence                                                                     |
|------|-------------------------------------------|---------------|------------------------------------------------------------------------------|
| 1    | `CHANGELOG.md [1.10.12]` entry at top     | CLOSED        | `grep -c "^## \[1\.10\.12\]" CHANGELOG.md` -> 1                              |
| 2    | `.claude-plugin/plugin.json` version      | CLOSED        | `grep '"version"' .claude-plugin/plugin.json` -> `1.10.12`                   |
| 3    | `package.json` version                    | CLOSED        | `grep '"version"' package.json` -> `1.10.12`                                 |
| 4    | `git tag v1.10.12` at release commit      | PENDING       | Awaiting user "approved" -- orchestrator / Task 10v2-4 creates and pushes    |
| 5    | marketplace.json `ref: v1.10.12`          | PENDING       | Awaiting user "approved" -- orchestrator / Task 10v2-4 pins + commits        |

Release commit: **`b30484d`** -- "release: v1.10.12 -- cascade refactor + sync/async split + MCP validation + transactions + Brain cache + BYO chat"

## Task Breakdown

### Task 10v2-0: BSL 1.1 license header sweep (git-diff enumerated)

Dynamic enumeration via `git diff --name-only --diff-filter=A v1.10.11..HEAD` produced 12 Stream B added code files (6 in `lib/core/`, 6 in `lib/memory/`). `templates/chat-panel.html` was added separately because it was rewritten (not added) in 87-09 and therefore doesn't appear in `--diff-filter=A`.

Sweep found 2 genuinely-missing BSL markers:

- `lib/memory/mcp-input-validation.test.cjs`: had `@license BSL-1.1` (dash form) at line 18; the sweep grep `"BSL 1\.1|Business Source License"` looks for space form. Normalized to canonical `BSL 1.1. Copyright (c) Mindrian 2026.` in the JSDoc preamble.
- `lib/memory/sync-async-entry-points.test.cjs`: had `License: BSL 1.1` at line 28, past the `head -25` inspection window. Moved canonical marker into the JSDoc preamble at line 5.

Four false-positive "duplicates" were the canonical two-line pattern (`BSL 1.1. Copyright (c) Mindrian 2026.` followed by `(Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)`), which the dup detector double-counted across the two keywords. Verified by eye; not flagged.

Post-normalization: 0 missing, 0 real duplicates across all 13 files.

**Commit:** `8cdc5ba` -- chore(87-10-v2): BSL 1.1 header normalization for 2 Stream B test files

### Task 10v2-1: Full green-gate test sweep + chat-panel presence

**Feynman suite:** 28/28 passed, 0 failed, 0 skipped.

Stream B test files (all green):
- `lib/memory/mcp-input-validation.test.cjs` -- 35 ok
- `lib/memory/index-artifact-transaction.test.cjs` -- happy-path + rollback + lock-release all ok
- `lib/memory/sync-async-entry-points.test.cjs` -- sync/async key parity + caller audit ok
- `lib/memory/brain-cache-lru.test.cjs` -- LRU + sha256 + pending-promise + TTL ok
- `lib/memory/bearer-token.test.cjs` -- all 6 R-87-09-CSRF gaps + rate limit + zero-log ok
- `lib/memory/chat-context.test.cjs` -- 5 intent patterns all under 5K tokens ok

**Cascade-e2e fixture:** exit 0, exact-match vs frozen baseline `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}`. 87-03's deduplication refactor preserved behavior through 87-04 sync/async, 87-06 transaction, and 87-07 LRU swaps.

**Chat-panel presence gate (inverse of v1.10.11):**

```
grep -c "chat-panel\|mos-chat-container" templates/presentation/dashboard.html
-> 3
```

v1.10.12 dashboard.html now carries 3 chat-UI references (was 0 in v1.10.11). Transition boundary respected.

### Task 10v2-2: CHANGELOG + plugin.json + package.json bump

`[1.10.12]` entry prepended to CHANGELOG.md with structured Added / Fixed / Security / Changed / Compat / Testing sections aggregating:

- DASH-04 (BYO chat panel)
- CASCADE-01, CASCADE-02 (cascade dedup via `_runCascadeSteps`)
- CASCADE-03, CASCADE-05 (MCP input validation: Zod regex + `safeResolveSection` + opportunitySchema)
- CASCADE-04 (indexArtifact explicit BEGIN/COMMIT + `_indexArtifactBody` helper for `rebuildGraph` consistency)
- CASCADE-06 (sync/async split + bounded LRU at 3 cascade cache sites)
- v1.10.11 update-blocker hotfix explicitly documented (engines field removed, commit ad2a15e)

Also proved:

```
grep -cE "CASCADE-0[1-6]|DASH-04" CHANGELOG.md
-> 7  (distinct lines; matches acceptance >= 7)

grep -cE "plan 87-0[3-7]|plan 87-09" CHANGELOG.md
-> 14  (matches acceptance >= 6)
```

Plugin.json version: `1.10.11 -> 1.10.12`. Package.json version: `1.10.11 -> 1.10.12`.

Post-edit re-verification: feynman 28/28 + cascade-e2e exit 0.

**Commit:** `b30484d` -- release: v1.10.12 -- cascade refactor + sync/async split + MCP validation + transactions + Brain cache + BYO chat

### Task 10v2-3: Human checkpoint (this plan stops here)

Checkpoint presented to user below under the "Awaiting" section. Gates 1-3 + all automated tests + BSL sweep + chat-presence gate + hotfix verification complete. Gates 4-5 require user "approved" before tagging and marketplace pinning.

### Task 10v2-4: Git tag + push + marketplace ref pin (PENDING)

Not executed in this run. On user approval, the orchestrator (or follow-up agent) will:

1. `git tag -a v1.10.12 b30484d -m "..."`
2. `git push origin main --tags`
3. Edit `~/mindrian-marketplace/.claude-plugin/marketplace.json`: change `plugins[0].version` and `plugins[0].source.ref` from `1.10.11` / `v1.10.11` to `1.10.12` / `v1.10.12`.
4. Commit + push the marketplace repo.

## Engines-Field Hotfix Verification

```
grep -c '"engines"' .claude-plugin/plugin.json
-> 0
```

Hotfix commit `ad2a15e` ("fix: remove 'engines' field from plugin.json (v1.10.11 update blocker)") is the commit immediately before the BSL normalization and the release commit. The Node version floor remains in `package.json` where npm and the MCP server see it.

## Stream B Aggregate

- **6 plans closed in v1.10.12:** 87-03 (cascade dedup), 87-04 (sync/async split), 87-05 (MCP validation), 87-06 (indexArtifact transaction), 87-07 (Brain cache + LRU), 87-09 (BYO chat)
- **v1.10.11..HEAD range:** 24 commits, 35 files changed, +5028 / -1269 LOC
- **New Stream B files (12 added + 1 rewritten):** 6 in `lib/core/` (bearer-token, chat-context-builder, lru-cache, room-ops-sync, room-ops-async, room-ops-shared), 6 in `lib/memory/` (test files for bearer-token, brain-cache-lru, chat-context, index-artifact-transaction, mcp-input-validation, sync-async-entry-points), plus `templates/chat-panel.html` fully rewritten
- **Feynman suite:** 22/22 (at v1.10.11) -> 28/28 (+6 new test files)
- **Cascade-e2e frozen baseline** exact-match preserved through every refactor: `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}`
- **Zero new runtime dependencies** (all Node builtins + existing deps)
- **BSL 1.1** preserved on all 13 new/rewritten files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BSL sweep grep pattern mismatch (dash vs space form)**

- **Found during:** Task 10v2-0 sweep
- **Issue:** `lib/memory/mcp-input-validation.test.cjs` used `@license BSL-1.1` (dash); `sync-async-entry-points.test.cjs` had `License: BSL 1.1` at line 28, past the 25-line sweep window. Both would have caused the sweep to fail with MISSING.
- **Fix:** Prepended canonical marker `BSL 1.1. Copyright (c) Mindrian 2026.` into the JSDoc preamble of each file. Non-functional, header-only change.
- **Files modified:** `lib/memory/mcp-input-validation.test.cjs`, `lib/memory/sync-async-entry-points.test.cjs`
- **Commit:** `8cdc5ba`

### Scope Boundary

**Not touched:** `dashboard/graph.json` showed as modified after running cascade-e2e tests (runtime artifact regeneration). Out of scope for this plan; left uncommitted. Pre-existing tracked runtime artifact pattern, recommend future conversion to `.gitignore` + fresh generation by dashboard server.

## Deferred Items

None.

## Known Stubs

None -- v1.10.12 ships the full BYO chat + cascade refactor + Brain cache feature set. Pattern 3 (stakeholder attribution) graceful-empty fallback is not a stub; it's the contracted Phase 84-05 degradation path when the stakeholders table is empty on a given room.

## Self-Check: PASSED

- [x] `CHANGELOG.md` contains `## [1.10.12]` at top
- [x] `.claude-plugin/plugin.json` version == `1.10.12`
- [x] `package.json` version == `1.10.12`
- [x] `grep -c '"engines"' .claude-plugin/plugin.json` == `0`
- [x] `grep -c "chat-panel\|mos-chat-container" templates/presentation/dashboard.html` == `3` (>= 1)
- [x] `node lib/memory/run-feynman-tests.cjs` exit `0`, 28/28 passed
- [x] `node test/fixtures/cascade-e2e/cascade-e2e.test.cjs` exit `0`, exact baseline match
- [x] BSL sweep 0 missing across 13 Stream B files
- [x] Release commit `b30484d` exists
- [x] BSL fix commit `8cdc5ba` exists
- [x] Engines hotfix commit `ad2a15e` exists
- [x] SUMMARY.md created at `.planning/phases/87-security-hardening-cascade-refactor/87-10-v2-SUMMARY.md`

## Awaiting

User approval to:

1. Create annotated tag `git tag -a v1.10.12 b30484d`
2. Push tags to origin (`git push origin main --tags`)
3. Edit `~/mindrian-marketplace/.claude-plugin/marketplace.json`: bump `version` `1.10.11 -> 1.10.12` and `source.ref` `v1.10.11 -> v1.10.12`
4. Commit + push the marketplace repo with message `pin: mos v1.10.12`

Then Phase 87 closes across both v1.10.11 (Stream A) and v1.10.12 (Stream B).
