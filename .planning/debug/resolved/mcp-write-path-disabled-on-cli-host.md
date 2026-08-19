---
status: resolved
kind: rca
slug: mcp-write-path-disabled-on-cli-host
date: 2026-08-19
reporter: navigator (live session, this host)
resolved: 2026-08-19
resolved_by: quick task 260819-bql
---

## Current Focus

RESOLVED 2026-08-19 (quick task 260819-bql). Option A taken: isWritePathEnabled
now returns true for the claude-code host. See "Decision Taken" below.

NOT LIVE UNTIL RELEASED. This change lands on `main` only; it reaches no
running session until it ships via `scripts/release.sh <version>` (the
five-gate lockstep), and a session already in flight keeps its cached plugin
even after that release lands. Do not treat the live Larry flow as fixed
until a release ships and is actually picked up by a fresh session.

## Meta

- Surface: Claude Code CLI, plugin cache mos 2.0.0-beta.5
- Where seen: Larry session filing into a room; message rendered twice:
  "MCP write path is disabled on this host - filing directly to the room on
  disk instead."
- Related: Phase 234-05 (D-04/D-05, Gap D), Phase 198-02 (D-07),
  .planning/phases/234-.../234-05-PLAN.md

## Problem Statement

On a Claude Code host, the MCP write tools (artifact_file, memory_event,
graph_write) are visible in tools/list but refuse every call, so the model
falls back to writing artifacts directly to the room folder on disk -
bypassing the navigation.cjs chokepoint (no artifact_id injection, no
immediate memory_event journal entry, no typed graph write).

## Symptoms

- artifact_file / memory_event return
  {ok:false, reason:'write_path_disabled', hint:'Set MINDRIAN_MCP_FIRST or
  connect from a recognized non-Claude-Code host once initialize completes.'}
- Larry narrates the fallback and files via Write/Bash directly to disk.
- Home-repo history shows the pattern live: a run of
  "rethinking-mindrianos: file ..." commits are direct disk filings.
- Message appears twice per filing turn (two refused calls: artifact_file
  then memory_event, each triggering the same fallback prose).

## Scope and Impact

- Every Claude Code session with MINDRIAN_MCP_FIRST unset (the default -
  it is set nowhere: not in .mcp.json, not in settings.json).
- Impact: the room graph silently diverges from disk between stop-gate
  close-outs. folder-memory / minto-debouncer reconcile SOME of it at Stop,
  but artifact_id injection and the per-filing memory_event are lost, and a
  session that never reaches a clean stop-gate reconciles nothing.
- This is the "silent one-way mirror" (Gap D) reborn on the HOME surface -
  the exact pattern 234-05 was built to kill on foreign hosts.

## Eliminated

- NOT an env accident: MINDRIAN_MCP_FIRST unset is the designed default
  (D-07 byte-identical-legacy).
- NOT a host-detection bug: detectHostTier correctly identifies claude-code;
  case 3 of isWritePathEnabled returns false BY DESIGN
  (lib/mcp/mcp-first-flag.cjs:114-128).
- NOT a regression in beta.5: the gate moved from registration-time to
  call-time in 234-05; the refusal is the intended behavior of that design.

## Evidence

- lib/mcp/mcp-first-flag.cjs:88-95 - precedence: explicit flag > tier0
  non-Claude-Code host > false for claude-code ("its slash commands and
  hooks already do the writing, so its legacy default is preserved").
- lib/mcp/tools/graph.cjs:93-101 - writePathRefusal, the per-call gate.
- lib/mcp/tools/views.cjs:91 - same gate on artifact_file.
- Installed .mcp.json: no env block; ~/.claude/settings*.json: no
  MINDRIAN_MCP_FIRST.

## Technical Root Cause

Phase 234-05 separated discovery from permission: the write tools are now
ALWAYS visible, but on claude-code the permission check still encodes the
legacy premise "slash commands and hooks do the writing on this host." That
premise is false for the live Larry flow: hooks log events but do NOT file
artifacts on the model's behalf. So the model sees the tool, calls it, gets
refused, and improvises an ungoverned disk write. Making the tools visible
without granting permission on the home host created a NEW failure mode the
old registration-time gate never had: a visible door that always says no,
with "write to disk yourself" as the natural fallback. Any "should always be
true" (disk == graph) without sensor + actuator is a wish, not a loop
(docs/172-SYSTEMS-MODEL.md).

## Decision Taken (2026-08-19, quick task 260819-bql)

Option A, as recommended. The three write tools (graph_write, memory_event,
artifact_file) ARE the governed Part 9 door - everything they do routes
through navigation.cjs - so refusing them on the home host protected nothing
and provoked the ungoverned direct-disk bypass this RCA documents. Option B
was NOT taken: it would have left two write roads (the governed door plus
Larry's disk fallback) instead of closing to one.

**What changed:**

- `lib/mcp/mcp-first-flag.cjs`: `isWritePathEnabled`'s claude-code branch
  flipped from `return false` to `return true` (one line). The unknown-host
  check stays ahead of it, so an unidentified caller still never reaches the
  new true branch.
- Two hint strings (`lib/mcp/tools/graph.cjs`, `lib/mcp/tools/views.cjs`),
  byte-identical across both files, rewritten to describe the new false
  population (an unidentified/pre-initialize client, or a tier1 host with its
  own hook channel) instead of the retired "non-Claude-Code host" framing.
- Four comment blocks corrected: the `mcp-first-flag.cjs` Phase 234-05 header
  doctrine block and its `isWritePathEnabled` JSDoc precedence list (now four
  cases), `graph.cjs`/`views.cjs`'s registration-vs-permission header
  amendments, and `chain.cjs`'s stale reasoning (its conclusion - chain_run's
  own gate ladder is a stronger, more specific control than a blanket
  write-path flag - is unchanged; only the now-false premise was corrected).
- `docs/ENV-TUNING.md`'s `MINDRIAN_MCP_FIRST` table row amended to state that
  Claude Code is now in the default-on population.
- `tests/test-234-host-tier.cjs` re-pinned: the A5 unit check for
  flag-unset + claude-code inverted to assert `true`; the
  `MINDRIAN_MCP_FIRST=cli + claude-code on DESKTOP` regression check rewritten
  against Grok Build (a host still in the false population, since claude-code
  no longer is); the live-wire honest-refusal proof (Part B, formerly pinned
  against claude-code) relocated to a third drive against an unidentified
  client. All 101 checks pass; test-198-contract-schema.test.cjs (113
  assertions) and test-248-resolver-census.cjs (4 checks) both still green.

**Which "Tests to Add or Update" landed here:** the unit leg (claude-code +
unset flag -> true) and the live-wire leg (a real stdio JSON-RPC drive
proving claude-code's graph_write reaches the real navigation.cjs write path)
both landed, in `tests/test-234-host-tier.cjs`. The seam test asserting a
filed artifact carries BOTH an artifact_id AND a memory_event row (the
loop-closure check) is NOT in this quick task - left as an open follow-up
below, not claimed as done.

## Non-Code Follow-ups (OPEN)

- Sweep room repos for past direct-disk filings missing artifact_id
  (rethinking-mindrianos at minimum) and reconcile the journal. Real work,
  not touched by this quick task.
- Add the loop-closure seam test (artifact_id + memory_event row together)
  named above, not delivered here.
- NOT LIVE UNTIL RELEASED (see "Current Focus" above): fold this fix into the
  next `scripts/release.sh` cut before reporting the live Larry flow as fixed.

## MindrianOS-specific gates

- Canon Part 8: no Brain involvement; local-only. PASS either option.
- Part 9: option A strengthens the chokepoint; the status quo undermines it.
- Tri-Polar: option A makes CLI/Desktop/Cowork behave identically.
- Release lockstep: ships only via scripts/release.sh.
