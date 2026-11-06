---
status: resolved
kind: rca
trigger: "dial-memory-rewrite-marks-sections-stale"
issue_id: "B8"
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

verdict: REPRODUCED

hypothesis: The stale rule counts FEYNMAN.md as a section artifact. The session-start dial-memory rewrite (and the timeline rewrite) advances the FEYNMAN.md mtime past MINTO.md, so every section with a FEYNMAN.md reads as artifacts_newer_than_minto.
test: Fixture room, one section with artifact.md, FEYNMAN.md and MINTO.md (MINTO newer). Read readTriple, run refreshSection, read readTriple again.
expecting: fresh before, stale (artifacts_newer_than_minto) after.
next_action: Failing test, then exclude FEYNMAN.md from the artifact mtime walk in the sync and async readers.

## Source-of-Truth Preamble

- CODE claims read against: branch main @ e155a9bfd (worktree /home/jsagi/dev/MindrianOS-Plugin-release)
- WIRE claims probe against: none (local only, no Brain call)
- Date of audit: 2026-11-06
- Re-verification rule: all claims below were run on a fixture room in a temp dir.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: current main
- Reported by: auditor finding B8 (inferred, not run), reproduced here
- Date first observed: 2026-11-06
- Related debug sessions: none

## Problem Statement

A refresh of FEYNMAN.md by the dial-memory runner makes an unchanged section read as stale. The staleness signal then fires on every session start for every section that has a FEYNMAN.md.

## Symptoms

expected: A section whose artifacts did not change after MINTO.md was generated stays fresh after a dial-memory refresh.
actual: After the refresh, readTriple returns is_stale true with stale_reason artifacts_newer_than_minto.
errors: none (wrong verdict, no exception).
reproduction:
  1. Create a fixture section with artifact.md (old mtime), FEYNMAN.md (old mtime) and MINTO.md (mtime 30 minutes after both).
  2. Call lib/core/folder-memory.cjs readTriple(section). Result: is_stale false.
  3. Call lib/core/feynman/dial-memory-runner.cjs refreshSection(room, section, {db}). Result: status refreshed.
  4. Call readTriple(section) again. Result: is_stale true, stale_reason artifacts_newer_than_minto.
started: Phase 143.1-05 (the dial-memory runner, second FEYNMAN.md writer); the timeline-runner of Phase 124 has the same effect.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (shared lib/core reader).
- Affected commands: any consumer of readTriple stale flag (session-start MINTO banner, triple-context formatter, mos-status, health score).
- Affected users: all rooms with a FEYNMAN.md in a section.
- Version range: Phase 143.1-05 to present.
- Severity: low (false staleness signal, no data loss, no egress).
- Blast radius: folder-memory.cjs and folder-memory-async.cjs share the same RESERVED set. The timeline-runner (a second writer of FEYNMAN.md) advances the same mtime.

## Eliminated

- hypothesis: The stale rule compares frontmatter watermarks (dial_memory_last_rendered).
  evidence: computeStale in lib/core/folder-memory-shared.cjs compares only last_generated_at from MINTO.md and file mtimes. The dial watermark key is not read.
  timestamp: 2026-11-06T00:00:00Z
- hypothesis: The stale rule reads room.db rows.
  evidence: collectArtifactMtimes in lib/core/folder-memory.cjs uses fs.statSync on section files only.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: computeStale and collectArtifactMtimes (sync and async) source
  found: The compared timestamps are file mtimes. Every top-level .md file in the section, except names in RESERVED (ROOM.md, STATE.md, MINTO.md, TEAM-STATE.md), counts as an artifact. FEYNMAN.md is not in RESERVED. Stale when any artifact mtime is more than 1000 ms after the MINTO.md mtime.
  implication: A rewrite of FEYNMAN.md that lands after MINTO.md marks the section stale. Of the 3 candidate timestamps (file mtimes, frontmatter watermarks, room.db rows), the rewrite changes the file mtime, and that is the one compared.
- timestamp: 2026-11-06T00:00:00Z
  checked: fixture room run (scratchpad repro, mtimes set with utimes, booleans only)
  found: before refresh is_stale false, stale_reason null, MINTO newer than FEYNMAN true. After refresh is_stale true, stale_reason artifacts_newer_than_minto, FEYNMAN newer than MINTO true, artifact.md newer than MINTO false.
  implication: The only file that moved is FEYNMAN.md. The flip is caused by the rewrite alone. MINTO generated before the rewrite (the real session order) flips the same way.

## Technical Root Cause

- Site: lib/core/folder-memory.cjs collectArtifactMtimes and RESERVED; the same pair in lib/core/folder-memory-async.cjs.
- Cause: FEYNMAN.md is a generated memory file with two automatic writers (timeline-runner, dial-memory-runner), but the artifact walk treats it as a user artifact. Each automatic rewrite advances its mtime.
- Why it surfaces now: the session-start cascade rewrites FEYNMAN.md for every section on every start, after MINTO.md was generated.

## Required Code Changes

- Change 1:
  - Location: lib/core/folder-memory.cjs, constant RESERVED
  - Current behavior: FEYNMAN.md counts as an artifact.
  - Required behavior: add FEYNMAN.md to RESERVED so the walk skips it, like ROOM.md and STATE.md.
  - Short-term patch: restore the old mtime in dial-memory-runner after the write. Rejected: the timeline-runner is a second writer, so the patch would fix half of the cause.
  - Long-term fix: this change.
- Change 2:
  - Location: lib/core/folder-memory-async.cjs, constant RESERVED
  - Required behavior: same change, so sync and async readers agree.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-dial-memory-stale.cjs
  - Given: a fixture section with MINTO newer than its artifacts and FEYNMAN.md
  - When: refreshSection runs
  - Then: readTriple stays fresh (D1); a real artifact edit after MINTO is stale (D2); the dial watermark is still written (D3)
  - Runner registration: automatic, tests/run-all-386.sh globs tests/test-386-*.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md, knowledge-base.md: owned by plan 386-21.

## Resolution

root_cause: FEYNMAN.md (generated, auto-rewritten by two writers) was counted as a section artifact by the stale rule, so each rewrite read as artifacts_newer_than_minto.
fix: FEYNMAN.md added to the RESERVED set in the sync and async folder-memory readers. The fix site moved from dial-memory-runner.cjs (plan text) to the readers, because the timeline-runner is a second writer of the same file. A real artifact edit is still stale (D2).
verification: node tests/test-386-dial-memory-stale.cjs (all arms ok), tests/test-dial-memory-runner.cjs, tests/test-dial-memory-renderer.cjs, lib/memory/folder-memory.test.cjs, lib/memory/folder-memory-quadruple.test.cjs, lib/memory/feynman-minto-guardian.test.cjs all exit 0.
files_changed:
  - lib/core/folder-memory.cjs (RESERVED gains FEYNMAN.md)
  - lib/core/folder-memory-async.cjs (RESERVED gains FEYNMAN.md)
  - tests/test-386-dial-memory-stale.cjs (new)
commits: see git log for 386-12
