# MindrianOS Plugin full system code review

Date: 2026-09-20  
Scope: repository-wide review of the plugin, including the localhost workspace POC and the seams that connect CLI, MCP, room storage, graph state, chat, and Brain access.  
Method: purpose-first review. Each major code area was mapped to its role in the system, then checked at the boundaries where data, authority, and state move between areas.

## System purpose and puzzle map

MindrianOS is a local room system with five cooperating layers:

| Layer | Purpose | Evidence checked |
| --- | --- | --- |
| Prompt and context | Turn user intent into bounded work with room context | `commands/`, `skills/`, `agents/`, `pipelines/` |
| Harness | Decide paths, validate inputs, and expose safe capabilities | `lib/mcp/`, connector registries, session binding |
| Loop | Run a bounded operation and stop at a useful result | tool handlers, graph operations, reasoning operations |
| Graph and room state | Persist user-owned knowledge locally and project it to views | `lib/core/`, SQLite graph, room artifacts |
| Brain boundary | Use remote methodology without sending user-owned room content | `lib/core/brain-client.cjs`, `lib/core/part8-egress-guard.cjs` |

The architecture is strongest when one chokepoint owns each concern: one room resolver, one graph navigation surface, one egress guard, and one generated connector registry. The main risk is that several seams report success while silently omitting a write, hiding a capability, or accepting a path outside the room. That makes the pieces look healthy in isolation while the assembled system loses its guarantees.

## Findings

### F-01 High: MCP room resources allow path traversal

`lib/mcp/resources.cjs:128-160` joins the user-controlled `sectionName` directly to the room directory. The template list contains trusted section names, but the read handler accepts arbitrary URI parameters and does not enforce a safe slug or verify that the resolved path remains under the room root. A request for `room://section/../some-sibling` can therefore read markdown from outside the selected section, and a deeper traversal can escape the room entirely if the target directory exists.

This breaks the room boundary at a read-only surface that is intended to be safe for Desktop browsing. The same file already defines `SAFE_SLUG_RE` for another resource, and the tool handlers use a safer section resolver, so this is a seam inconsistency rather than an unavoidable design limitation.

Fix by validating the parameter and resolving it through one containment-checked helper. Reject any value that is not a known discovered section, or whose `path.resolve()` result is not beneath the room root. Apply the same rule to `reasoning://section/{name}` and make that template enumerable so its allowed names come from the same registry.

### F-02 High: stale-lock recovery can delete another process's live lock

`lib/core/write-lock.cjs:25-83` correctly uses atomic creation, but `releaseLock(roomDir)` at lines 99-110 unlinks the lock by path without checking ownership. `lib/core/graph-ops.cjs:17-28` always calls that release in `finally`.

The failure sequence is: process A acquires the lock and pauses longer than the five-second stale threshold; process B removes A's lock and acquires a replacement; A resumes and runs its `finally`; A then deletes B's live lock. A third writer can enter while B is still using SQLite. The result is exactly the kind of cross-process corruption the lock was introduced to prevent.

Use an ownership token in the lock payload and pass that token to release. Release only when the on-disk token still matches the caller's token. A PID check alone is insufficient because the stale-recovery path intentionally permits ownership to change.

### F-03 High: assistant markdown is rendered as executable HTML

`lib/chat/chat-panel.js:20-44` escapes only fenced code blocks. Ordinary assistant text passes through `renderMarkdown()` without HTML escaping, then is assigned to `innerHTML` at lines 379 and 539. A model response containing an HTML element or event handler can execute in the dashboard origin. The same pattern appears for generated tool components at lines 649-655.

Model output, tool output, and room-derived text must be treated as untrusted display data. Replace the hand-written renderer with a sanitizer that escapes text before applying a strictly allowlisted markdown transformation, or render through DOM text nodes. Sanitize component output separately and add a regression test with an `onerror` payload.

### F-04 High reliability: MCP registration failures disappear without an operational signal

`lib/mcp/register-core-tools.cjs:39-75` catches contract registration, module loading, and every module's `register()` failure, then continues without recording the failure. This preserves boot, but the running server can expose a partial tool surface while reporting no degraded state. The generated connector registry can therefore describe tools that are absent from the live process.

Keep sibling isolation, but collect `{ module, phase, error }` diagnostics and expose them through startup logs and a health or contract resource. A boot that cannot register a declared capability should be visibly degraded, not indistinguishable from a complete boot.

### F-05 Medium-high: `extract_shallow` advertises graph writes but performs none in its live wiring

`lib/mcp/tools/dual-path.cjs:50-77` calls `shallowDocParser.extractShallow(text, sessionId)` without a database handle. In `lib/core/shallow-doc-parser.cjs:140-195`, `setFocus` runs only when `opts.db` exists, and `safeRecord()` calls `navigation.recordMemoryEvent` only if that function is exported. The current navigation surface does not export it. The tool therefore returns an in-memory `{ user, venture, claims }` result while its description and connector metadata claim graph writes through the navigation chokepoint.

Choose one honest contract: make this a pure parser and rename its description and registry metadata, or give it a governed room/database write path and verify the resulting nodes and events. A false-success write contract is especially damaging because downstream callers cannot tell that persistence was skipped.

### F-06 Medium, POC blocker: localhost workspace writes have no browser-origin or request ownership check

`docs/reviews/localhost-poc/server.cjs:45-60` binds to loopback, but accepts `POST /api/document` and `POST /api/graph/ask` from any local web page. There is no `Origin` or `Host` allowlist, CSRF token, session ownership check, or request-size handling that preserves the connection after an oversized body. A malicious local page can cause the user's browser to write arbitrary markdown into the selected room.

This is acceptable only as an explicitly disposable POC. Before treating the localhost interface as a daily workspace, add a per-process capability token, reject unexpected `Host` and `Origin` values, return consistent CORS policy, and use atomic document writes. The room mode also creates `workspace-poc.md` at the room root, while the repository's artifact topology places generated artifacts in dedicated folders; promote that file location only after the persistence contract is decided.

### F-07 Medium: the acceptance gate did not terminate in the review environment

`node scripts/doctor.cjs --acceptance` produced no progress output and was still running after approximately 90 seconds. A bounded retry with `timeout 20s` exited 124. This is not enough evidence to assign a code root cause, but it is a release-process failure: the primary acceptance command has no visible phase progress and no bounded completion behavior.

Instrument the doctor command with phase logging and explicit timeouts around network, dependency, and child-process checks. Record the failing phase in CI so an environment problem cannot look like a healthy acceptance run.

## What is working

The repository has useful structural guardrails. The substrate diff check, connector registry check, orchestration projection check, render coverage check, and `git diff --check` all passed during this review. The Brain client and Part 8 egress guard are separated from room storage, and no direct room-content-to-Brain bypass was found in the inspected paths. The graph and dashboard tests exercised the local graph feed and passed.

Those checks validate individual contracts. They do not yet validate the cross-layer properties above: resource containment, lock ownership, output sanitization, complete registration, and truthful persistence.

## Recommended repair order

1. Close the resource traversal and chat XSS paths before exposing the MCP or browser surfaces to real rooms.
2. Make lock release ownership-aware, then add a two-process stale-recovery test.
3. Make registration degradation observable and make `extract_shallow`'s persistence contract truthful.
4. Harden the localhost POC before treating it as a local workspace, including origin checks and atomic room writes.
5. Add bounded, phase-labelled acceptance checks and a system test that exercises one edit from browser to room file to graph projection.

## Verification record

Passed:

- `node scripts/check-substrate.cjs --diff`
- `node scripts/build-connector-registry.cjs --check`
- `node scripts/build-orchestration-projection.cjs --check`
- `node scripts/check-render-coverage.cjs`
- `git diff --check`
- Existing dashboard graph and memory dashboard tests

Blocked or incomplete:

- `node scripts/doctor.cjs --acceptance` did not complete within the review window and requires phase-level diagnosis.

## Corrections (Phase 354, 2026-09-23)

Phase 354 (`docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md`) independently
researched every finding above, published a disposition ledger
(`docs/reviews/phase-354-disposition-ledger.md`), implemented and verified repairs, and closed
out with `docs/reviews/phase-354-close-out.md`. The corrections below name each overstatement
in this review and its corrected finding, with an evidence link. Nothing above this section was
edited or deleted.

| Overstatement in this review | Corrected finding | Evidence |
|---|---|---|
| The subjective 5/10 (plugin) and 6/10 (integration) ratings in the opening summary | Not measurements. Phase 354's handoff itself states this explicitly ("its title overstated coverage... the conversation's 5/10 plugin and 6/10 integration ratings are subjective estimates, not measured acceptance criteria"); the actual measured record is `docs/reviews/phase-354-disposition-ledger.md`'s Final disposition section (11 of 13 IDs FIXED-VERIFIED) and `docs/reviews/phase-354-close-out.md`'s Measured gates table. | `docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md` "Mission" section; `docs/reviews/phase-354-disposition-ledger.md` Section 11 |
| The percent-encoded URI traversal claim (implied raw traversal through `lib/mcp/resources.cjs`) | Did NOT escape through the installed MCP SDK's URI-template matcher (`room://section/..%2Foutside` resolves `inside:false, outside:false`, no disclosure). The real containment gap was a pre-existing room symlink escaping both `room://section/{name}` and `reasoning://section/{name}`, fixed in Plan 354-05. | `docs/reviews/phase-354-disposition-ledger.md` SYS-01 row and Section 4 ("MCP URI percent-encoding traversal"); `docs/reviews/phase-354-probes/resources.cjs` re-run output |
| The implied "blanket graph-rebuild destruction" concern | REFUTED as current behavior: graph rebuild is scoped and transactional; rebuild-preservation tests passed. No fix was planned or needed for this. | `docs/reviews/phase-354-disposition-ledger.md` Section 4 |
| An unscoped reading of the taxonomy-vocabulary casing defect as affecting `recommendChain` | Taxonomy casing was limited to the `taxonomy_ladder` path (`lib/core/strategy/rung-vocabulary.cjs`, `taxonomy-climb.cjs`); `recommendChain` already performed correct origin-specific normalization and was NOT touched by the fix. | `docs/reviews/phase-354-disposition-ledger.md` Section 4; Plan 354-10 (`tests/test-354-taxonomy-ladder-casing.cjs`) |
| `extract_shallow`'s connector metadata implied to promise governed writes | The connector's own `hitl_why` already honestly stated zero graph writes; the actual defect was a description/prose mismatch (the tool description and `agents/larry-extended.md` claimed writes the code never performed), corrected to honest-parsing-only (D-354-SYS05), not by adding write behavior. | `docs/reviews/phase-354-disposition-ledger.md` SYS-05 row and Decision D-354-SYS05; Plan 354-15 |
| F-07's "the acceptance gate did not terminate in the review environment" implied a runner defect/hang | UNRESOLVED, not a confirmed product defect at research time; instrumented (per-point timing, `runBoundedChild`, stderr progress) and reran clean in Plan 354-13, classified **WORKING**: the symptom was a visibility gap (no per-point progress, 4 unbounded child spawns), not a hang -- both a pre-tag and a full rerun completed within bound with zero timeouts and zero orphan processes. | `.planning/debug/sys-07-acceptance-timing.md` (SYS-07 RCA, Resolution section) |
| The plugin's release notification (`repository_dispatch: theo-resync`) implied to prove Theo consumes and re-emits the command registry | Sending the event is not proof it is received. Confirmed a tracked cross-repository gap (THEO-02): Theo's own `.github/workflows/` has no `theo-resync` consumer workflow at any commit inspected (`4ae9843` at planning time, `98e337d` at close-out); a live `release.sh --dry-run` shows the registry stamp is currently MISMATCHED (6 betas of drift). Not fixed unilaterally from this repo; coordinated with, not duplicating, Phase 351. Status: BLOCKED, not resolved. | `docs/reviews/phase-354-disposition-ledger.md` THEO-02 row; `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-THEO-EVIDENCE.md` |

