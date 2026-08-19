---
quick_id: 260819-bql
phase: quick/260819-bql
plan: 01
subsystem: lib/mcp
tags: [mcp, write-path, claude-code, host-tier, rca]
requires: []
provides:
  - "isWritePathEnabled returns true for the claude-code host"
affects:
  - lib/mcp/tools/graph.cjs (graph_write, memory_event)
  - lib/mcp/tools/views.cjs (artifact_file)
key-decisions:
  - "Option A (enable the write path on Claude Code) taken over option B (keep refusing, redirect Larry's fallback) - the RCA's recommended option, since the three tools already ARE the governed Part 9 door."
key-files:
  created:
    - .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md
  modified:
    - lib/mcp/mcp-first-flag.cjs
    - lib/mcp/tools/graph.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/chain.cjs
    - docs/ENV-TUNING.md
    - tests/test-234-host-tier.cjs
    - .planning/debug/knowledge-base.md
metrics:
  duration: "~35 min"
  completed: 2026-08-19
---

# Quick Task 260819-bql: Fix MCP write path disabled on Claude Code host Summary

Flipped `isWritePathEnabled`'s claude-code branch from `false` to `true` so
`graph_write`, `memory_event`, and `artifact_file` execute through
`navigation.cjs` on the home Claude Code host instead of refusing every call
and pushing the model toward an ungoverned direct-disk write.

## What Was Built

**Task 1 - the gate flip and doctrine repair** (commit `5f0a5599`):
- `lib/mcp/mcp-first-flag.cjs`: one-line change in `isWritePathEnabled`
  (`tier.host === 'claude-code'` now returns `true`, was `false`). The
  `unknown`-host check stays ahead of it, so an unidentified/pre-initialize
  caller never reaches the new true branch.
- Corrected the Phase 234-05 header doctrine block's false premise ("On
  Claude Code that is harmless: slash commands and hooks do the writing")
  with a dated 2026-08-19 amendment, and rewrote the `isWritePathEnabled`
  JSDoc precedence list from 3 cases to 4 (explicit flag -> claude-code ->
  other tier0 -> everything else).
- Replaced the `writePathRefusal` hint string in both `lib/mcp/tools/graph.cjs`
  and `lib/mcp/tools/views.cjs` (independent copies, byte-identical text)
  with language describing the surviving false population (unidentified/
  pre-initialize client, or a tier1 host with its own hook channel - Grok
  Build, OpenCode) instead of the retired "non-Claude-Code host" framing.
- Added one-line dated amendments to the `graph.cjs`/`views.cjs` header
  blocks (registration-vs-permission split still holds; only who lands on
  the permitted side changed).
- Corrected `lib/mcp/tools/chain.cjs`'s stale reasoning for why `chain_run`
  is deliberately NOT gated on `isWritePathEnabled` - kept the conclusion
  (chain_run's own gate ladder is a stronger, more specific control), fixed
  the now-false premise.
- `docs/ENV-TUNING.md`: added a sentence to the `MINDRIAN_MCP_FIRST` table
  row noting Claude Code is now in the default-on population.

**Task 2 - re-pinned tests** (commit `8495e15c`):
- `tests/test-234-host-tier.cjs` PART A5: inverted the flag-unset +
  claude-code unit check to assert `true`; added a load-bearing-floor
  comment above the unknown/novel-host checks; rewrote the
  `MINDRIAN_MCP_FIRST=cli + claude-code on DESKTOP -> OFF` regression check
  to use Grok Build instead (a host that stays in the false population,
  since claude-code no longer is one).
- PART B (live JSON-RPC drive): the `claude` drive's assertions inverted
  (B3: now proves PERMITTED - parseable payload, `reason !==
  'write_path_disabled'`, `ok === true`, no `isError`; B4:
  `capability_floor.write_path_enabled` now asserted `true` on claude-code).
  Added a THIRD drive, `unidentified` (`SomeNewClientNeverSeenBefore`), that
  carries the honest-refusal proof formerly pinned to claude-code: tools
  still discoverable, `graph_write` refused with `write_path_disabled`, an
  actionable hint, `isError: true`, a stale-prose guard on the hint text,
  and `capability_floor.write_path_enabled === false` with
  `host_tier.host === 'unknown'`. B5 (explicit flag override) left
  unchanged and still passes.
- Added a dated amendment to the file's own header doctrine comment
  recording the reversal and where the refusal proof moved to.
- `tests/test-198-contract-schema.test.cjs`: inspected per the plan's
  conditional instruction; no assertion or comment in that file claims
  claude-code is the refusing case, so it was left untouched.

**Task 3 - closed the RCA** (commit `2c240cc0`):
- Moved `.planning/debug/mcp-write-path-disabled-on-cli-host.md` to
  `.planning/debug/resolved/`, set `status: resolved`, and replaced the
  "DECISION REQUIRED" block with the decision actually taken (option A),
  naming every file/line changed and which of the RCA's originally-listed
  tests landed here vs. remain open.
- Recorded the release-lockstep reality in the resolved RCA: this is a
  `main`-branch commit, not yet live for any running session.
- Left "Non-Code Follow-ups" open and explicit: the artifact_id +
  memory_event loop-closure seam test, and the rethinking-mindrianos
  reconciliation sweep for past direct-disk filings missing artifact_id.
- Appended a summary entry to `.planning/debug/knowledge-base.md` in the
  file's existing format (symptom, root cause, fix, verification, files
  changed, pattern lesson).

## Test Results

All three suites run with `node` after edits, per plan `<verification>`:

```
node tests/test-234-host-tier.cjs        -> 101 passed, 0 failed (exit 0)
node tests/test-198-contract-schema.test.cjs -> PASS, 113 assertions (exit 0)
node tests/test-248-resolver-census.cjs  -> 4/4 green (exit 0)
```

`test-234-host-tier.cjs` now proves, live over real stdio JSON-RPC against
three client identities (foreign tier0 host, claude-code, unidentified
client):
- Discovery is unconditional across all three (`graph_write`, `memory_event`,
  `artifact_file` all present in `tools/list`).
- `claude-code` and the foreign host both reach the real `navigation.cjs`
  write path and succeed (`ok: true`, no `isError`).
- The unidentified client is still refused out loud
  (`ok: false, reason: 'write_path_disabled'`, actionable hint, `isError:
  true`), and `capability_floor` reports `write_path_enabled: false` with
  `host_tier.host: 'unknown'` for it.
- The explicit `MINDRIAN_MCP_FIRST=all` override still works on a tier1
  host (B5, unchanged).

`test-248-resolver-census.cjs`'s census.2 check (the only executable
`isMcpFirst(` call outside its own definition is the internal one inside
`isWritePathEnabled`) still holds, confirming this fix did not add a second
call site.

## Deviations from Plan

None - plan executed exactly as written. `tests/test-198-contract-schema.test.cjs`
was inspected per the plan's own conditional instruction ("Touch only the
comment at lines ~122-123 if it reads as though claude-code is the refusing
case") and found not to make that claim, so it was correctly left untouched
rather than edited unnecessarily.

## Notes on Scope

Per the constraints for this quick task, `runtime-instructions.cjs`,
`bin/mindrian-mcp-server.cjs`'s instructions-at-initialize wiring, and
`lib/mcp/no-instructions.test.cjs` (the recently-merged 2026-08-18/19 seeds
work) were not touched - out of this plan's `files_modified` list.

Several unrelated pre-existing uncommitted changes were present in the
working tree at commit time (a Brain hostname migration across
`commands/setup.md`, `hooks/hooks.json`, and others; assorted untracked
`.planning/debug/*.md` files from other concurrent sessions). None of these
were staged or committed by this task - each commit staged only the files
named in the plan's `files_modified` list.

## NOT LIVE UNTIL RELEASED

This fix lands on `main` only. No running Claude Code session picks it up
until it ships via `scripts/release.sh <version>` (the five-gate lockstep),
and a session already in flight keeps its cached plugin even after that
release lands. The resolved RCA records this explicitly so it is not
mistaken for a live fix at merge time.

## Self-Check: PASSED

- FOUND: lib/mcp/mcp-first-flag.cjs
- FOUND: lib/mcp/tools/graph.cjs
- FOUND: lib/mcp/tools/views.cjs
- FOUND: lib/mcp/tools/chain.cjs
- FOUND: docs/ENV-TUNING.md
- FOUND: tests/test-234-host-tier.cjs
- FOUND: .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md
- FOUND: .planning/debug/knowledge-base.md (entry present)
- FOUND commit 5f0a5599
- FOUND commit 8495e15c
- FOUND commit 2c240cc0
