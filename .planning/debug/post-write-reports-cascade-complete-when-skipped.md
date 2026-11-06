---
status: fixing
kind: rca
trigger: "post-write-reports-cascade-complete-when-skipped"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-11-06T14:00:00Z
updated: 2026-11-06T14:00:00Z
---

target: PRESENT

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ c44e8aef0 plus peers' working tree, in the dev workspace copy /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 15).
- **WIRE claims probe against:** none. No network. Fixture rooms in a temporary folder and a temporary HOME.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: write_cascade_side_channel in scripts/post-write hard-codes cascade_status "complete", and the advisory text depends only on whether SECTION is known. Neither reads what the cascade returned.
test: Run scripts/post-write on a default-layout fixture, a rooms-layout fixture and a forced cascade error. Read cascade_status and the advisory prefix.
expecting: "complete" and "queued MINTO regen" in all 3 cases.
next_action: Derive the status from the cascade output and pass it to the writer and the advisory.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main
- Reported by: auditor finding B7 and T04
- Date first observed: 2026-11-05
- Related debug sessions: memory-completion-detector-duplicate-completions

## Problem Statement

scripts/post-write writes `cascade_status: "complete"` to last-cascade.json and prints "queued MINTO regen" when the cascade was skipped or failed. A reader of that file cannot tell a run from a skip.

## Symptoms

expected: skipped cascade gives cascade_status skipped, failed cascade gives failed, a real run gives complete. The advisory line does not say queued or complete for a skip.
actual: all 3 give complete, and the advisory begins "queued MINTO regen for".
errors: none (the status lies)
reproduction:
  1. Fixture room with STATE.md and .room-root, path without /room/ or /rooms/.
  2. Run scripts/post-write with a PostToolUse JSON on stdin for a synthetic .md file in a section.
  3. Read .mindrian/last-cascade.json cascade_status and the advisory.
started: Phase 95-02 introduced the side channel with a literal status.

## Evidence

- Anchor 1: scripts/post-write, function `write_cascade_side_channel`, jq object key `cascade_status: "complete"` (a literal).
- Anchor 2: scripts/post-write, variable `SM_TEXT`, chosen only by `SM_SECTION = unknown`.
- Anchor 3: lib/core/intelligence-cascade.cjs `runCascade` returns `skipped: true` plus `skipReason` for a path without /room/ or /rooms/ (function isRoomFile). `CASCADE_OUTPUT` fallback on a child failure is `{"error":"cascade failed"}`.
- PROVEN (fixture run), default layout: `mindrian-tools.cjs cascade` output has skipped true, no error key. post-write exit 0. last-cascade.json cascade_status `complete`. Advisory prefix `queued MINTO regen for`.
- PROVEN (fixture run), rooms layout: cascade_status `complete`, same advisory prefix. This is the correct status here.
- PROVEN (fixture run), forced child failure (node stub that exits 1): CASCADE_OUTPUT is the error fallback. cascade_status `complete`, same advisory prefix.
- UNVERIFIED (read from the code, not run): when the cascade output is not valid JSON, `jq --argjson` fails and the writer returns without writing, so the previous last-cascade.json stays in place. The fix covers it and the test pins it.
- Not widened: isRoomFile in intelligence-cascade.cjs and a bash pre-check are out of scope (Phase 384 and 385 own the skip).

## Technical Root Cause

The writer never reads the cascade result: the status is a literal, and the advisory text is chosen from the section name. A skipped or failed cascade is therefore reported as complete. A non-JSON result leaves a stale file in place.

## Required Code Changes

- scripts/post-write: add `cascade_status_of` (jq on CASCADE_OUTPUT): `failed` for an error key or non-JSON output, `skipped` when skipped is true, else `complete`.
- write_cascade_side_channel: take the status as an argument, write it, and write a `cascade_id` (timestamp, pid and a random number) so a reader can tell one record from the next. Replace non-JSON output with the error object so a stale file is overwritten with failed.
- Advisory: for skipped say `post-write: cascade skipped for <basename>`; for failed say `post-write: cascade failed for <basename>`; keep today's text for complete.

## Tests to Add

- tests/test-386-cascade-status-and-completion.cjs: W1 skipped, W2 complete pin, W3 failed.

## Resolution

Fixed in plan 386-15. scripts/post-write now has cascade_status_of (failed for an error key or non-JSON output, skipped when skipped is true, else complete); the writer takes the status, overwrites a stale record with failed for non-JSON output, and the advisory says skipped or failed. The 8-key side-channel contract is unchanged (no new key). Two older tests (test-cascade-side-channel, test-cascade-surface-e2e) had pinned the false complete status on default-layout fixtures and now expect skipped. Proof: tests/test-386-cascade-status-and-completion.cjs W1 to W3. Not moved to resolved; plan 386-21 does that.
