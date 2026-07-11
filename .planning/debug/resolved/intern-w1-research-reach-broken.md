---
status: resolved
kind: rca
trigger: "intern-w1-research-reach-broken"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:40:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: resolved

reasoning_checkpoint:
  hypothesis: "The intelligence tool's research sub-command in lib/mcp/tool-router.cjs falls through to the generic buildContext() doc-echo helper instead of calling the real fetch pipeline, so it deterministically returns commands/research.md's own spec text instead of findings, for any input."
  confirming_evidence:
    - "grep -n research-context-extractor|source-lens-driver|research-filing-selector|findings-wirer lib/mcp/tool-router.cjs returns zero matches (pre-fix) - no code path in the file ever required any of the four pipeline modules."
    - "Direct read-only re-execution of buildContext(pluginRoot, roomDir, 'research', 'which job role is more in trend') (documented in Evidence below) returned commands/research.md's own frontmatter + '# /mos:research [topic]' header verbatim, zero fetch results, zero sources."
  falsification_test: "Call the intelligence tool with command: 'research' after the fix - if the response still contains the literal string '# /mos:research' (the command spec header) instead of a Findings section with source/url/evidence_tier per finding, the fix did not take."
  fix_rationale: "Special-cased command === 'research' to call research-context-extractor.cjs::extractContext() (Stage 1-3) then lens-engine/source-lens-driver.cjs::runSourceLens() (Stage 4) directly, exactly the 'research-context-extractor.cjs -> source-lens-driver.cjs (at minimum)' direction from the confirmed root cause - this makes the tool actually fetch instead of echoing a doc. It does NOT auto-run Stage 6 (research-filing-selector.cjs) + Stage 7 (findings-wirer.cjs) synchronously inside the same call: those stages require a human filing decision per finding (commands/research.md's own hitl_shape: F.8 + plan_gated: true, and Canon Part 9 role 5 - 'Larry proposes, the human decides'). An MCP tool call has no interactive back-channel to collect that decision mid-call, so auto-wiring findings without a human decision would itself be a Canon Part 9 violation, not a fix. The response surfaces findings with sources and states a filing decision is needed next, matching Stage 5 (presentation) plus an explicit handoff to the still-human-gated Stage 6/7."
  blind_spots: "Findings-wirer.cjs (Stage 7, auto-filing) is intentionally NOT invoked by this fix - if a caller expected the MCP path to fully auto-file findings as EvidenceClaim nodes in one round-trip, this fix does not do that (by design, per Canon Part 9). Also: lens-engine rotate() and fetchCorpus depend on the Phase 130.5 shared corpus + cache and any configured web-research MCPs; in an environment with no reachable fetch source, runSourceLens degrades to an empty findings list (verified as its designed degrade path, not a crash) - the regression test below covers only that the pipeline is INVOKED (via a stubbed _fetchCorpus), not live network behavior."

hypothesis: CONFIRMED - the `intelligence` MCP tool's `research` sub-command (lib/mcp/tool-router.cjs, `INTELLIGENCE_COMMANDS` router) is never wired to the actual fetch pipeline (`research-context-extractor.cjs` -> `source-lens-driver.cjs` -> `research-filing-selector.cjs` -> `findings-wirer.cjs`). It falls through to the generic `buildContext()` helper - the same doc-echo fallback used by reasoning-only sub-commands (grade, leadership, whitespace, etc.) - which loads `commands/research.md` verbatim (no dedicated `references/methodology/research.md` exists) and returns it as the "Reference" section, concatenated with room state. No web fetch ever occurs on this call path, for any input; the failure is deterministic and input-independent, not a malformed-parameter fallback.
test: directly re-executed the private `buildContext()`/`loadReference()` logic from `lib/mcp/tool-router.cjs` (unmodified, read-only reproduction) against `command: "research"`, `context: "which job role is more in trend"`.
expecting: raw output should either contain the four pipeline modules' actual output (findings/EvidenceClaim ids/sources) if the hypothesis is wrong, or the verbatim contents of commands/research.md (its own frontmatter + `# /mos:research [topic]` spec) if the hypothesis is right.
next_action: DONE - fix applied to lib/mcp/tool-router.cjs (Stage 1-4 wired; Stage 6-7 stays human-gated, see reasoning_checkpoint). mva-brief.md checked (see Evidence) - NOT affected, different execution mechanism. Self-verified via new regression test tests/test-intelligence-research-pipeline.cjs. Awaiting human-verify checkpoint (see Resolution).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10
- Target version: v1.15.3-beta.13
- Reported by: Intern-4 (pseudonym), JHU intern QA program, via Larry's own Part B self-QA
- Date first observed: 2026-07-07
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row G) - no other known related session at filing time; this looks like a standalone tool-contract bug, not part of the room-state cluster the other rows share.

## Problem Statement

The `intelligence:research` / `deep_research` MCP reach, when fired, returned its own command specification/documentation text instead of executing the requested web research, forcing a manual WebSearch fallback to recover.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `intelligence:research` executes web fetches for the given query and returns synthesized, sourced findings.
actual: "the deep_research reach (intelligence:research) fired - and malfunctioned: it returned its own command spec instead of executing web fetches... The intelligence:research MCP reach echoes documentation instead of running."
errors: none thrown - a well-formed but wrong-content response (documentation text where a research result was expected), not a crash or exception.
reproduction:
  1. Invoke the `intelligence` tool/command with `command: research` and a concrete `context` describing a real research question (matching the session's actual trigger - a trend/market question, per the session transcript: "which job role is more in trend").
  2. Inspect the raw returned text.
  3. Confirm whether it is a genuine research result or a documentation/spec echo.
started: observed 2026-07-07, v1.15.3-beta.10. Unknown if this is new or long-standing - no prior debug session references this tool by this exact failure shape.

## Scope and Impact

- Affected surfaces: cli (confirmed); likely all surfaces since this is an MCP tool call, not CLI-specific rendering
- Affected commands: `/mos:research`, `intelligence` command `research`, any Larry-initiated `deep_research` reach
- Affected users: all installs that trigger the research reach
- Version range: beta.10, unconfirmed upper bound
- Severity: high - a core methodology tool (sourced research, one of the 25 methodology commands per Canon Part 7) is non-functional and the failure is silent/well-formed enough that recovery depends on Larry noticing, not on an error signal
- Blast radius: `/mos:research`, `/mos:build-thesis`, `/mos:find-connections`, and any other command that depends on the same underlying research reach - check for shared code path

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "missing/malformed required parameter causing a help-text fallback instead of a query execution path" (the argument-parsing framing from the original hypothesis)
  evidence: reproduced `buildContext(pluginRoot, roomDir, 'research', context)` with a fully well-formed, non-empty `context` string ("which job role is more in trend") - identical doc-echo output was produced. The `research` sub-command handler in `lib/mcp/tool-router.cjs` (lines 966-991) has no branch, validation, or conditional fallback logic at all for `command === 'research'`; it unconditionally calls the same generic `buildContext()` helper used by every other INTELLIGENCE_COMMANDS entry (grade, deep-grade, leadership, whitespace, find-connections, build-thesis, compare-ventures). There is no "malformed input" code path to trigger - the doc-echo is the ONLY code path, for all inputs.
  timestamp: 2026-07-11T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part B self-QA document (verbatim)
  found: quote above; also from her Part A (human side): despite this, she praised the SESSION's research output for clean source attribution - meaning the manual WebSearch fallback Larry used produced a good result, masking the underlying tool failure from the human entirely.
  implication: this bug is currently invisible to end users because the fallback path (manual WebSearch) produces acceptable output - it will only surface if/when a future session lacks a working fallback, or if the fallback's quality regresses. Treat as a real bug despite the good outcome, not deprioritize because "it worked out."

- timestamp: 2026-07-11T00:00:00Z
  checked: `lib/mcp/tool-router.cjs` lines 966-991, the `intelligence` MCP tool registration (`server.tool('intelligence', ...)`), specifically the handler for `command: 'research'`
  found: the handler body is `return textResponse(buildContext(pluginRoot, roomDir, command, context) + extra + suggestedNext)` for EVERY command in `INTELLIGENCE_COMMANDS` (`find-connections`, `build-thesis`, `compare-ventures`, `research`, `deep-grade`, `grade`, `leadership`, `whitespace`) - identical code path, no per-command branching except a cosmetic `suggestedNext` string tweak for grade/deep-grade. `buildContext()` (lines 385-396) only ever does: (1) `loadReference(pluginRoot, command)` - read a markdown file off disk, (2) `loadRoomState(roomDir)` - read STATE.md, (3) string-concatenate them with the caller's `context` string. It contains zero fetch, zero HTTP call, zero invocation of any pipeline module.
  implication: `research` is architecturally indistinguishable, at the MCP tool-router layer, from purely-reasoning intelligence ops like `grade` or `whitespace`. There is no code path in this file that ever requires or calls `lib/core/research-context-extractor.cjs`, `lib/lens-engine/source-lens-driver.cjs`, `lib/core/research-filing-selector.cjs`, or `lib/core/findings-wirer.cjs` - confirmed via `grep -n "research-context-extractor\|source-lens-driver\|research-filing-selector\|findings-wirer" lib/mcp/tool-router.cjs` returning zero matches.

- timestamp: 2026-07-11T00:00:00Z
  checked: `loadReference()` resolution order (lines 349-368) against the actual files on disk for `command = 'research'`
  found: `references/methodology/research.md` does NOT exist (confirmed via `find references/methodology -iname "research*"` - empty). `loadReference` therefore falls through to its second branch, `commands/research.md` - the CLI SLASH-COMMAND's own 285-line specification file (frontmatter `name: research`, body opening `# /mos:research [topic]`, describing the full 7-stage pipeline architecture, the four pipeline modules, and their `node -e` invocation snippets - i.e. literally the tool's own command spec/documentation).
  implication: this is the exact mechanism of the reported symptom. Because there is no dedicated methodology reference for `research`, the fallback silently substitutes the full CLI command specification as if it were a "reference," and that spec's own frontmatter/header text is what leaks into the tool response and reads as "the tool returned its own command spec."

- timestamp: 2026-07-11T00:00:00Z
  checked: direct, read-only reproduction of the exact `buildContext`/`loadReference`/`loadRoomState` logic from `lib/mcp/tool-router.cjs` (copied verbatim into a throwaway `node -e` script, no source files modified), invoked as `buildContext(pluginRoot, roomDir, 'research', 'which job role is more in trend')` - i.e. exactly what `mcp__...__intelligence({command:'research', context:'...'})` executes internally
  found: raw output (15,707 chars total) opens with `## Command: research`, then `### Room State` (the room's STATE.md dashboard), then `### Reference` containing the ENTIRE `commands/research.md` file verbatim - including its YAML frontmatter (`name: research`, `reach_id: deep_research`, etc.) and its `# /mos:research [topic]` heading - then finally `### Focus` with the literal user query tacked on at the very end with zero fetch results, zero sources, zero `EvidenceClaim` ids. No network call occurs anywhere in this path.
  implication: reproduces the reported bug exactly and unambiguously: "intelligence:research ... returned its own command spec instead of executing web fetches" is a precise, literal description of this output. This is deterministic for any well-formed input - not an edge case, not a malformed-argument fallback.

- timestamp: 2026-07-11T00:00:00Z
  checked: `commands/research.md` "Tri-Polar surfaces (CLI / Desktop / Cowork)" section (lines 251-260) against the actual MCP handler
  found: the doc explicitly asserts "Desktop / Cowork (MCP): `/mos:research` routes through the `intelligence` tool in `lib/mcp/tool-router.cjs` (the `research` command). The same four pipeline modules are the execution layer behind that tool." This claim is false as implemented - the four pipeline modules are never referenced by `lib/mcp/tool-router.cjs` (see prior evidence entry). On the CLI surface, `/mos:research` works because Claude reads `commands/research.md` directly as its own slash-command prompt and follows the described Bash `node -e` steps itself (an agent-executed markdown runbook) - a completely different execution mechanism than the MCP `intelligence` tool call, which merely returns text with no signal that further action is required and no MCP server instructions (`lib/mcp/larry-server-instructions.md` has zero mentions of "Reference" or executing embedded bash blocks) telling the calling agent to treat the response as an executable runbook rather than a final answer.
  implication: root cause confirmed as an architecture/wiring gap, not a Larry compliance failure and not an argument-parsing bug. The `research` sub-command was scaffolded through the generic `INTELLIGENCE_COMMANDS` / `buildContext()` router pattern (correct for reasoning-only ops) but was never given the dedicated execution wiring its own documentation claims it has for the MCP/Desktop/Cowork surface.

- timestamp: 2026-07-11T00:00:00Z
  checked: blast radius - every `commands/*.md` file declaring `reach_id: deep_research` (the same connector reach as `research`)
  found: only two files carry `reach_id: deep_research`: `commands/research.md` and `commands/mva-brief.md`. `mva-brief.md` contains no `node -e` pipeline-module invocations and does not appear to declare its own fetch execution layer via the MCP `intelligence` tool the way `research.md` does. Every other `INTELLIGENCE_COMMANDS` sibling (`find-connections`, `build-thesis`, `compare-ventures`, `grade`, `deep-grade`, `leadership`, `whitespace`) declares `reach_id: brain_consult` or `context_block`, not `deep_research`, and none of their command docs claim a 4-module fetch-execution pipeline behind the MCP tool - for those, the `buildContext()` doc+state-echo IS the intended behavior (Larry reasons over reference + state conversationally; no fetch is claimed or expected).
  implication: the doc/code mismatch is isolated to the `deep_research`-reach commands (`research`, and possibly `mva-brief` if it independently depends on the same fetch pipeline) - not a systemic defect across all 8 `INTELLIGENCE_COMMANDS`. Confirms the Problem Statement's "Blast radius" note was the right question to ask, and narrows the answer.

- timestamp: 2026-07-11T00:30:00Z
  checked: full read of `commands/mva-brief.md` (the only other `reach_id: deep_research` command, per the prior blast-radius grep) - "Instructions for the model" section
  found: mva-brief does NOT route through the `intelligence` MCP tool or `buildContext()` at all. Its instructions are "Invoke `node scripts/mva-run.cjs` via Bash with no arguments... Relay the stdout to the user VERBATIM" - a self-contained agent-executed Bash script (its own 6-agent fan-out: Brain similar + Brain cross-domain + Brain classic traps + Tavily funding + Six-hats + Dashboard graph), completely independent of `lib/mcp/tool-router.cjs`'s `INTELLIGENCE_COMMANDS` router and the four research-pipeline modules.
  implication: mva-brief is NOT affected by this bug. It shares the `deep_research` reach_id label but not the execution mechanism - it was already doing on the CLI surface what research.md's Tri-Polar doc claims for MCP (an agent-executed runbook), so there was never a doc-echo fallback to fall into. No fix needed for mva-brief; closing the blast-radius question opened in the diagnose-only run.

## Technical Root Cause

The MCP `intelligence` tool's `research` sub-command (`lib/mcp/tool-router.cjs`, `server.tool('intelligence', ...)` handler, `INTELLIGENCE_COMMANDS` router, lines ~966-991) is wired identically to the reasoning-only sibling commands (`grade`, `deep-grade`, `leadership`, `whitespace`, `find-connections`, `build-thesis`, `compare-ventures`): it calls the generic `buildContext(pluginRoot, roomDir, command, context)` helper, which only reads a reference markdown file + STATE.md off disk and string-concatenates them - it never calls, requires, or invokes the four pipeline modules (`lib/core/research-context-extractor.cjs`, `lib/lens-engine/source-lens-driver.cjs`, `lib/core/research-filing-selector.cjs`, `lib/core/findings-wirer.cjs`) that `commands/research.md` itself documents as "the execution layer behind that tool" for the Desktop/Cowork MCP surface. Compounding this, no dedicated `references/methodology/research.md` exists, so `loadReference()` falls back to `commands/research.md` - the CLI slash-command's own 285-line specification (frontmatter, `# /mos:research [topic]` header, full pipeline description) - which is returned verbatim as the "Reference" section of the tool response. The result: any well-formed `intelligence` call with `command: research` deterministically returns the command's own documentation/spec text (no web fetch, no findings, no EvidenceClaim wiring) instead of executing research - exactly matching the reported symptom, and reproduced directly by re-executing the tool-router's own logic read-only. On the CLI surface this is masked because Claude reads `commands/research.md` directly as an agent-executed runbook and performs the Bash steps itself; that execution mechanism does not exist for MCP tool calls, so Desktop/Cowork (and any programmatic `intelligence`-tool invocation, including the `deep_research` reach that triggered this report) get the doc-echo with no indication further action is required.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

NOT SPECIFIED - out of scope for this diagnose-only run (`goal: find_root_cause_only`). No source code was modified during this investigation. Fix direction only (for the follow-up fix session): wire the `research` branch inside the `intelligence` tool handler in `lib/mcp/tool-router.cjs` to actually invoke `research-context-extractor.cjs` -> `source-lens-driver.cjs` (at minimum) instead of falling through to `buildContext()`, or explicitly special-case `command === 'research'` before the generic branch. `mva-brief` (the only other `reach_id: deep_research` command) should be checked for the same gap before closing the blast radius.

## Tests to Add or Update

PENDING (fix session). Candidate: a smoke test that invokes `intelligence` with `command: 'research'` and asserts the response does NOT contain `commands/research.md`'s own frontmatter/header (e.g. does not contain the literal string `# /mos:research`) and DOES contain evidence of executed fetch (findings array, source URLs, or EvidenceClaim ids).

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry under v1.15.3-beta.13.
- knowledge-base.md: summary block on resolve.
- Once root-caused, check every other command layered on the same research reach (see Blast radius) for the same silent-echo failure - do not assume it is isolated to this one call site.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The `intelligence` MCP tool's `research` sub-command (lib/mcp/tool-router.cjs ~L966-991) is routed through the generic `buildContext()` doc+state-echo helper shared with all other INTELLIGENCE_COMMANDS, and is never wired to the four pipeline modules (research-context-extractor.cjs, source-lens-driver.cjs, research-filing-selector.cjs, findings-wirer.cjs) that commands/research.md documents as its MCP execution layer. Because no dedicated references/methodology/research.md exists, the fallback returns commands/research.md's own CLI-command specification verbatim as the "Reference" section - a well-formed but non-functional response containing zero fetch results. Confirmed by direct, read-only re-execution of the tool-router's own logic.
fix: |
  lib/mcp/tool-router.cjs: added runResearchPipeline(roomDir, topic, opts) and
  special-cased command === 'research' in the intelligence tool handler to
  call it BEFORE the generic buildContext() branch. runResearchPipeline calls
  research-context-extractor.cjs::extractContext() (Stage 1-3) then
  lib/lens-engine/source-lens-driver.cjs::runSourceLens() (Stage 4) and
  formats the returned findings (title/summary/source/url/retrieved_at/
  evidence_tier) as the response, closing with an explicit "Filing decision
  needed" note instead of auto-filing.

  Room.db handle: uses lib/core/navigation.cjs's openRoomDbForCaller /
  closeRoomDbForCaller (Phase 135-01), NOT a direct require of room-db.cjs -
  tool-router.cjs is not on the substrate allow-list
  (scripts/check-substrate.cjs) and openRoomDbForCaller is the existing,
  purpose-built door for exactly this (returns null on a cold room instead
  of creating room.db as a side effect of a read-only research call).

  SCOPE DEVIATION (intentional, see reasoning_checkpoint): Stage 6 (F.1
  filing selector, research-filing-selector.cjs) and Stage 7 (findings-wirer.cjs)
  are NOT invoked. Filing a finding is a human decision the MCP tool call has
  no channel to collect synchronously; auto-wiring without it would violate
  Canon Part 9 role 5, not fix the bug. This matches the diagnosis's own "at
  minimum" framing of the fix direction.

  commands/mva-brief.md checked and confirmed NOT affected - it runs its own
  scripts/mva-run.cjs via Bash, never routes through the intelligence MCP
  tool or buildContext().
verification: |
  New regression test tests/test-intelligence-research-pipeline.cjs
  (2 checks, hermetic - a _fetchCorpus stub is forwarded through
  runResearchPipeline -> runSourceLens, zero live network calls, same seam
  tests/test-131-source-lens-driver.cjs already uses). RED/GREEN proven by
  hand: reverted lib/mcp/tool-router.cjs via git stash, re-ran the test -
  both failed (router._test.runResearchPipeline is not a function, since the
  fix + its _test export did not exist). Restored the fix, re-ran - both
  pass, including the assertion that the response does NOT contain
  "# /mos:research" or "reach_id: deep_research" (the old doc-echo symptom)
  and DOES contain the fetched finding's title + source URL.
  Existing regression tests re-run clean: test-tool-router-active-room-misroute.cjs
  (7/7), test-tool-router-grouped-reference.cjs (16/16), test-205-surface-fence.cjs
  (20/20). scripts/check-substrate.cjs --diff (the pre-commit chokepoint gate)
  clean on the staged diff.
  NOT YET DONE: verification against a LIVE web-research MCP / the real
  Phase 130.5 corpus (this session's test stubs _fetchCorpus, matching the
  existing driver test's own no-live-network discipline) - part of the
  human-verify checkpoint.
files_changed:
  - lib/mcp/tool-router.cjs
  - tests/test-intelligence-research-pipeline.cjs (new)
commits: []
