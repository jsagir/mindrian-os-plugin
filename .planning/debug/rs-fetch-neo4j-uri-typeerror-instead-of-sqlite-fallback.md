---
status: resolved
kind: rca
trigger: "rs-fetch-neo4j-uri-typeerror-instead-of-sqlite-fallback"
issue_id: "B10"
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: no_key
canon_parts: [8]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

verdict: REPRODUCED

hypothesis: detectTier in scripts/rs-discovery-engine.cjs returns tier1 whenever NEO4J_URI is a non-empty string, but nothing in the rs-fetch path builds a driver. rs-neo4j-writer writeDiscovery then throws TypeError (opts.driver required). The catch block rethrows it because it is not AuraUnreachableError.
test: Child process run of scripts/rs-fetch-command.cjs on a fixture room, NEO4J_URI at a closed loopback port, fake credentials, fetch replaced by a counter. Control with NEO4J_URI unset.
expecting: exit 1 with the TypeError text when set, exit 0 with tier0 when unset.
next_action: Failing test, then guard the missing driver in the tier1 branch.

## Source-of-Truth Preamble

- CODE claims read against: branch main @ 7f92d560f (worktree /home/jsagi/dev/MindrianOS-Plugin-release)
- WIRE claims probe against: none (no network; fetch replaced by a counter, loopback port 1 never contacted)
- Date of audit: 2026-11-06
- Re-verification rule: all claims were run on a fixture room.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: current main
- Reported by: auditor finding B10 (inferred), reproduced here
- Date first observed: 2026-11-06
- Related debug sessions: none

## Problem Statement

With NEO4J_URI set, /mos:rs-fetch ends with exit 1 and a TypeError message instead of using the SQLite tier. A user with the optional Aura variable set cannot run the command.

## Symptoms

expected: With the Aura writer not usable, rs-fetch falls back to the SQLite tier and exits 0 with a result.
actual: exit 1, stderr line "rs-fetch error: rs-neo4j-writer: opts.driver required (call rs-output-dispatch ...)". Stdout is empty, so --json does not parse.
errors: TypeError raised in lib/core/rs-neo4j-writer.cjs writeDiscovery (type name only).
reproduction:
  1. Make a temp fixture room directory.
  2. Set NEO4J_URI=bolt://127.0.0.1:1, NEO4J_USER and NEO4J_PASSWORD to fake values, MINDRIAN_ROOM to the fixture, no Brain key.
  3. Run node scripts/rs-fetch-command.cjs "synthetic topic" --json with fetch replaced by a counter.
  4. Observe exit code 1.
started: Phase 89.5 (rs-fetch CLI never passes a driver; the tier rule reads the env variable only).

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (same script).
- Affected commands: /mos:rs-fetch.
- Affected users: any user with NEO4J_URI set in the environment.
- Version range: Phase 89.5 to present.
- Severity: low.
- Blast radius: only the tier1 branch of the output layer in runDiscovery.

## Eliminated

- hypothesis: The run reaches a real network endpoint.
  evidence: fetch was replaced by a counter. The count was 2 in both the set run and the unset control (same count), so the Aura variable added no network call. Port 1 was never contacted because no driver exists.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: scripts/rs-discovery-engine.cjs detectTier and the tier1 catch block; lib/core/rs-neo4j-writer.cjs exports and writeDiscovery
  found: detectTier returns tier1 on a non-empty NEO4J_URI. runDiscovery calls neo4jWriter.writeDiscovery with driver opts.driver, which rs-fetch-command never sets. writeDiscovery throws TypeError when opts.driver is missing. AuraUnreachableError is exported and is a class; the catch block re-throws any other error. Places where an undefined value is used: opts.driver (passed through, then checked by the writer).
  implication: The thrown error is a TypeError, never an AuraUnreachableError, so the fallback never runs.
- timestamp: 2026-11-06T00:00:00Z
  checked: child process runs (set versus unset)
  found: NEO4J_URI set gives exit 1, empty stdout, TypeError text on stderr. NEO4J_URI unset gives exit 0, stdout parses as JSON, tier tier0.
  implication: Confirms the cause is the env variable path.

## Technical Root Cause

- Site: scripts/rs-discovery-engine.cjs function `runDiscovery`, the `tier === 'tier1'` branch (Output Layer), with `detectTier`.
- Cause: the tier rule accepts NEO4J_URI as proof that Aura is usable, but no driver is ever built from it. The tier1 branch calls the writer without a driver, and the writer's guard error is not in the fallback set.
- Why it surfaces now: it appears only when NEO4J_URI is in the environment.

## Required Code Changes

- Change 1:
  - Location: scripts/rs-discovery-engine.cjs, function `runDiscovery`, tier1 branch
  - Current behavior: calls the Aura writer without a driver and rethrows the TypeError.
  - Required behavior: when no usable driver exists (opts.driver missing or without a session function), skip the Aura write, print one stderr notice, and write to the SQLite tier with fallback_reason no_aura_driver and tier tier0. Keep the tier choice rule, the Aura success path with a driver, the AuraUnreachableError fallback, and the rule that ExternalEgressViolation bubbles up.
  - Short-term patch: this change.
  - Long-term fix: build a driver from NEO4J_URI in a separate plan if the owner wants live Aura in rs-fetch. Out of scope here.

## Tests to Add or Update

- Test 1:
  - Type: integration (child process)
  - Location: tests/test-386-rs-fetch-neo4j-fallback.cjs
  - Given: a fixture room, NEO4J_URI at a closed loopback port, fake credentials, fetch counter
  - When: rs-fetch runs with --json
  - Then: exit 0, JSON parses, tier tier0, fallback_reason present (N1); with NEO4J_URI unset the tier is tier0 with no fallback_reason (N2)
  - Runner registration: automatic, tests/run-all-386.sh globs tests/test-386-*.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md, knowledge-base.md: owned by plan 386-21.

## Resolution

root_cause: tier1 is chosen from NEO4J_URI alone, but rs-fetch never builds a driver, so the Aura writer throws TypeError which was not in the fallback set.
fix: in the tier1 catch block of runDiscovery, a TypeError with no usable opts.driver now takes the SQLite fallback (fallback_reason no_aura_driver, one stderr notice). The writer is still called first, so the existing mocked-writer test keeps its contract. ExternalEgressViolation and any TypeError with a driver still bubble up. A pre-call guard was tried first and rejected: it broke lib/memory/test-rs-discovery-engine.cjs T2, which expects the writer to be attempted.
verification: node tests/test-386-rs-fetch-neo4j-fallback.cjs (all arms ok). lib/memory/test-rs-discovery-engine.cjs rc 0, lib/memory/test-rs-explain-command.cjs rc 0. lib/memory/rs-discovery-engine.test.cjs fails at t2 (classification literal) both before and after, so that failure is pre-existing and unrelated.
files_changed:
  - scripts/rs-discovery-engine.cjs (tier1 catch block)
  - tests/test-386-rs-fetch-neo4j-fallback.cjs (new)
commits: see git log for 386-13
