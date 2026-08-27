---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
plan: 02
subsystem: mcp-layer
tags: [mcp, tool-router, larry-context, wire-test, canon-part-11]
dependency-graph:
  requires: []
  provides:
    - "room_state static instruction description (456 chars, names all 5 commands)"
    - "loadLarryContext returning only {full}, compact field deleted"
    - "tests/test-266-room-state-description.cjs wire pin"
  affects:
    - lib/mcp/tool-router.cjs
    - lib/mcp/larry-context.cjs
tech-stack:
  added: []
  patterns:
    - "Wire probe over stdio (spawn bin/mindrian-mcp-server.cjs, initialize -> tools/list) to assert runtime-assembled tool description shape, cloned in shape from tests/test-234-tool-description-floor.cjs"
key-files:
  created:
    - tests/test-266-room-state-description.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/larry-context.cjs
decisions:
  - "Fix is removal, not a smarter slice: an arbitrary byte offset into voice-dna.md prose can never reliably land on a sentence boundary, so the description is authored prose, not borrowed bytes"
  - "compact field deleted from loadLarryContext's return and its one reader in tool-router.cjs; larryContext parameter itself is left in registerRouterTools' signature since it is called positionally from bin/mindrian-mcp-server.cjs and narrowing the signature is a wider change than this fast phase takes"
metrics:
  duration: "~35 minutes"
  completed: 2026-08-27
---

# Phase 266 Plan 02: Remove voice-dna splice from room_state tool description Summary

Deleted the `${compact.slice(0, 80)}` splice that spliced the first 80 characters of
`references/personality/voice-dna.md` (a markdown H1 opener) onto every `room_state` tool
description shipped to every host on every surface, replacing it with a static 456-character
authored instruction naming all five dispatched commands, and removed the now-dead `compact`
field from `loadLarryContext` end to end.

## What Was Built

**Task 1 - Wire probe test (`tests/test-266-room-state-description.cjs`).** Cloned
`listToolsOverStdio` in shape from `tests/test-234-tool-description-floor.cjs` (hermetic mkdtemp
HOME, `MINDRIAN_BRAIN_KEY` deleted, SIGKILL-and-rmSync cleanup, harness-honesty guard that fails
loudly on a wedged server or empty tool list). Spawns the real MCP server over stdio, drives a
genuine `initialize` -> `notifications/initialized` -> `tools/list` sequence, and asserts 8 facets
of `room_state`'s assembled description: presence in the catalog, no `#` character, no embedded
newline, absence of the `Voice DNA` / `professor` fingerprints, the D-03 120-char floor, a capital
start and sentence-punctuation end, all five command names present (`status`, `analyze`,
`compute-state`, `get-state`, `suggest-next`), and no em-dash. Run alone against the pre-fix code,
it failed 6 of 12 checks (the exact defect: raw `#` heading, embedded `\n\n`, the `Voice DNA` and
`professor` fingerprints, a mid-word cut instead of sentence punctuation, and zero command names
present), proving the pins bite before any fix landed.

**Task 2 - Replace the splice, delete the dead path.** In `lib/mcp/tool-router.cjs`, replaced the
template-literal description at the `room_state` registration with a static 456-character string
that clears the 120-char D-03 floor, stays under the 600-char ceiling, starts with a capital, ends
with a period, carries no em-dash, and names all five commands. Deleted the
`const compact = (larryContext && larryContext.compact) || '';` binding and updated the JSDoc
`@param` to `{{ full: string }}`. Added a comment above the new description explaining why it is
authored rather than sliced, referencing the pinning test. In `lib/mcp/larry-context.cjs`, deleted
the `compact` computation, changed the return to `{ full }`, and updated both the file header and
the `@returns` JSDoc. `lib/mcp/prompts.cjs`'s `.full`-only consumption was left untouched and
verified still loads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Em-dash literal inside the new test file's own em-dash check**

- **Found during:** Task 1, acceptance-criteria verification (`LC_ALL=C.UTF-8 grep -cP
  '\x{2014}' tests/test-266-room-state-description.cjs` must return 0).
- **Issue:** The check `d.indexOf('—') === -1` (checking the wire value for an em-dash)
  necessarily needs the em-dash and en-dash code points as data, but writing them as literal
  UTF-8 characters in the source file trips the same em-dash sweep the acceptance criteria uses
  to catch prose violations of the CLAUDE.md hard rule.
- **Fix:** Replaced the two literal characters with escaped code points (`—`, `–`) so
  the runtime check behaves identically but the file itself carries zero em-dash/en-dash bytes.
- **Files modified:** `tests/test-266-room-state-description.cjs`
- **Commit:** `7d0bfdf8`

**2. [Rule 1 - Bug] Comment accidentally reintroduced the literal word "compact"**

- **Found during:** Task 2, acceptance criterion `grep -c 'compact' lib/mcp/tool-router.cjs`
  must return 0.
- **Issue:** The first draft of the explanatory comment above the new `room_state` description
  used the phrase "splice compact.slice(0, 80)", which itself contains the literal substring
  `compact` the acceptance criteria checks for zero-occurrences of.
- **Fix:** Reworded the comment to describe the same defect without using the identifier name
  (e.g. "the first 80 characters of a trimmed voice-dna.md excerpt").
- **Files modified:** `lib/mcp/tool-router.cjs`
- **Commit:** `6f42861f`

### Out-of-Scope Findings (logged, not fixed)

Running `bash tests/run-all-234.sh` as the plan's item-5 baseline-regression check returned
`PASS=9 FAIL=2`. Both failures are in files this plan never touches:

1. `test-234-dist-bundle.cjs` -- a `dist/` bundle staleness mismatch (generated skill catalog
   entries `generic/rooms`, `zed/rooms`, `generic/setup`, `zed/setup` not matching what the test
   expects). Root cause is in the dist-bundle generator, unrelated to `room_state`.
2. `test-234-free-core-network-scan.cjs` -- `lib/mcp/tools/sensors.cjs:12` requires
   `../../brain/chain-recommender.cjs`, tripping the free-core network-token sweep.

Neither file is touched by this plan (`lib/mcp/tool-router.cjs`, `lib/mcp/larry-context.cjs`,
`tests/test-266-room-state-description.cjs` are the only files modified/created). Per the executor
scope boundary, out-of-scope pre-existing failures are logged, not fixed. Logged to
`.planning/deferred-items.md` (gitignored, local reference only).

## Verification

All items from the plan's `<verification>` block, run after Task 2:

1. `node tests/test-266-room-state-description.cjs` -- exit 0, 12 passed, 0 failed.
2. `node tests/test-234-tool-description-floor.cjs` -- exit 0, 35 passed, 0 failed (no regression).
3. `grep -c compact lib/mcp/tool-router.cjs lib/mcp/larry-context.cjs` -- 0 for both.
4. `node scripts/build-connector-registry.cjs --check` -- OK. `node
   scripts/build-orchestration-projection.cjs --check` -- OK.
5. `bash tests/run-all-234.sh` -- PASS=9 FAIL=2, both pre-existing failures unrelated to this
   plan's files (see Out-of-Scope Findings above); no NEW failing leg introduced by this plan.

Additional acceptance-criteria checks executed and passed:
- `node -e "..."` probing `loadLarryContext` confirms `compact` is gone and `full` is unregressed
  (`full=14111` chars).
- `node -e "require('./lib/mcp/prompts.cjs')"` confirms the other `loadLarryContext` consumer
  still resolves.
- `LC_ALL=C.UTF-8 grep -cP '\x{2014}'` reports 0 for both modified files.

## Must-Haves Verification

- **Truth: "The room_state tool description a host receives is clean prose: no markdown
  heading, no embedded newline, no sentence cut mid-word"** -- verified over the wire by
  `tests/test-266-room-state-description.cjs`, 0 failed.
- **Truth: "room_state's description still clears the D-03 120-character instruction floor on
  its own, without borrowing bytes from voice-dna.md"** -- description measured at 456
  characters, static string, zero references to `larryContext`/`compact` in the registration.
- **Truth: "The dead compact splice is gone from every seam that produced it, not just muted at
  the call site"** -- `compact` deleted from both the reader (`tool-router.cjs`) and the
  producer (`larry-context.cjs`); zero remaining `larryContext.compact` references anywhere in
  `lib/`, `bin/`, `scripts/`, `tests/`.
- **Artifact: `lib/mcp/tool-router.cjs` contains `room_state`** -- confirmed, registered with
  the new static description.
- **Artifact: `lib/mcp/larry-context.cjs` provides `loadLarryContext` returning only `full`** --
  confirmed via the `-e` probe above.
- **Artifact: `tests/test-266-room-state-description.cjs` provides the wire probe** --
  confirmed, created and passing.
- **Key link: `tests/test-266-room-state-description.cjs` -> `bin/mindrian-mcp-server.cjs` via
  spawned stdio `initialize` + `tools/list`** -- confirmed by `grep -c listToolsOverStdio`
  (3 occurrences: definition + 2 call sites) and a live passing run.

## Known Stubs

None.

## Threat Flags

None. This plan's changes are description-text-only (no new tool, no schema change, no new
network reach); all threats from the plan's `<threat_model>` were disposed `mitigate` or
`accept` with verification already covered above.

## Self-Check: PASSED

- FOUND: `tests/test-266-room-state-description.cjs`
- FOUND: `lib/mcp/tool-router.cjs` (modified)
- FOUND: `lib/mcp/larry-context.cjs` (modified)
- FOUND commit `7d0bfdf8` in `git log --oneline --all`
- FOUND commit `6f42861f` in `git log --oneline --all`
