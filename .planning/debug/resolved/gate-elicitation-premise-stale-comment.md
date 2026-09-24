---
status: resolved
kind: rca
trigger: "gate-elicitation-premise-stale-comment"
issue_id: ""
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [3, 11]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T12:10:06Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `lib/mcp/tools/gate.cjs:145-152` and `:9-10` assert "Claude Code/Desktop/Cowork do not declare it [the elicitation client capability]" (citing RESEARCH A2, issue #2799 open). This premise is now stale: a live wire tee of Claude Code 2.1.280 (print mode) shows `initialize` declaring `capabilities: {"roots":{"listChanged":true},"elicitation":{}}`. The code itself (`detectClientCapabilities`) is correct as written -- it already reads real capabilities off `server.server.getClientCapabilities()` -- only the comment's factual premise is wrong, which risks misleading a future maintainer into "fixing" a ladder that does not need fixing, or into fighting the now-live elicitation rung as if it were a bug.
test: Cite the research session's live wire tee (2026-09-23) and re-confirm the comment text is unchanged on the current tree (2026-09-24).
expecting: (met) the comment still reads the stale premise; the code's actual behavior already matches the corrected premise.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-07 (per `267-CONTEXT.md` "Elicitation gate UX": rewrite the comment; do not suppress or force rung (b)).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: Phase 267 research pass (2026-09-23), live wire tee against Claude Code 2.1.280
- Date first observed: 2026-09-23 (267-RESEARCH.md Summary, third bullet; 267-CONTEXT.md "Elicitation gate UX")
- Related debug sessions: none

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** Claude Code 2.1.280, print mode, live `initialize` capabilities tee, captured during the 267-RESEARCH.md force-refresh pass (2026-09-23); not re-run during 267-02 execution (a live Claude Code wire tee is outside this plan's hermetic-stdio-server reproduction scope -- the code-comment claim itself, and the code's own current behavior, ARE re-verified below against this tree)
- **Date of audit:** 2026-09-24 (comment re-confirmed unchanged on the current tree); underlying wire tee dated 2026-09-23 (267-RESEARCH.md)
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`. The wire-tee claim (Claude Code 2.1.280 declares `elicitation:{}`) is provisional on that same host version -- a maintainer picking this RCA up on a newer Claude Code release should re-tee before trusting the corrected premise unchanged.

## Problem Statement

`lib/mcp/tools/gate.cjs`'s code comments assert Claude Code/Desktop/Cowork do not declare the MCP `elicitation` client capability; Claude Code 2.1.280 now does, making gate rung (a) (inline `elicitInput`) the live CLI gate path today, not the dormant one the comments describe.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Code comments describing a client-capability-detection premise stay accurate as host behavior changes, so a maintainer reading them trusts what the ladder actually does today.
actual: Two comment blocks in `lib/mcp/tools/gate.cjs` state the opposite of what a live Claude Code 2.1.280 `initialize` handshake now sends.
errors: none (this is a documentation-accuracy defect, not a runtime error; `detectClientCapabilities` itself is implemented correctly and needs no functional change).
reproduction:
  1. Read `lib/mcp/tools/gate.cjs:9-10` and `:196-199`.
  2. Compare against a live Claude Code 2.1.280 `initialize` request's `capabilities` object (267-RESEARCH.md's wire tee, print mode, 2026-09-23): `{"roots":{"listChanged":true},"elicitation":{}}`.
  3. Observe the comment's premise ("do not declare it") contradicts the live capability declaration.
started: The comment predates 2.1.280 (the "265 audit premise" per 267-RESEARCH.md); it became stale when Claude Code 2.1.280 shipped `elicitation:{}` in its `initialize` capabilities, sometime before the 2026-09-23 research pass observed it live.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (all three are named in the stale comment's `CLAUDE_HOST_SURFACES` list and in the prose premise).
- Affected commands: `gate_render` (the MCP tool whose renderer-ladder selection this comment documents).
- Affected users: any maintainer or future debugging session reading `gate.cjs` who trusts the comment over the live behavior; end users are not directly affected (the CODE already reads real capabilities, so runtime behavior is already correct -- see Eliminated).
- Version range: comment unchanged from before 2026-09-23 through the current HEAD (`782ecc466`).
- Severity: low (no functional defect; a documentation-accuracy risk that could cause a FUTURE functional defect if a maintainer "fixes" the ladder based on the stale premise).
- Blast radius: isolated to the two comment blocks named above; `detectClientCapabilities`'s actual implementation logic is unaffected and correct.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: `detectClientCapabilities` (the executable code, not the comment) has a bug that ignores a real elicitation declaration and always falls to rung (b)/(c).
  evidence: Read `lib/mcp/tools/gate.cjs:206-219`. The function calls `server.server.getClientCapabilities()` live at request time and sets `elicitation = !!(caps && caps.elicitation)` -- it does NOT hardcode `false` or otherwise ignore a real declaration. The Phase 265 R-5 schema fix already shipped and `tests/test-265-gate-render-elicit-schema.cjs` passes per 267-RESEARCH.md. The bug is confined to the prose comment describing this code, not the code's own logic.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/tools/gate.cjs:1-11` (file-header comment block)
  found: |
    ```
    // gate_render composes the Mindrian gate superset card via the renderer
    // ladder (lib/mcp/gate-render.cjs) for the CALLING client's own capabilities
    // (real elicitation capability negotiated at MCP initialize time; a
    // recognized Claude host surface falls to the thin-adapter AskUserQuestion
    // rung; everything else gets the headless structured-text rung -- RESEARCH
    // A2 re-check: Claude Code/Desktop still do not declare the elicitation
    // client capability, issue #2799 still open as of this build; the ladder
    // keeps all three rungs regardless).
    ```
  implication: The stale premise is present verbatim, unchanged, on the current tree.

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/tools/gate.cjs:195-203` (the `detectClientCapabilities` doc comment, cited by the plan as `:145-152` in the pre-267 line numbering -- current tree has it at `:196-199`)
  found: |
    ```
    /**
     * detectClientCapabilities -- the ladder's capability read. Real elicitation
     * capability comes from the MCP initialize handshake (server.server.
     * getClientCapabilities()). Claude Code/Desktop/Cowork do not declare it
     * (RESEARCH A2, issue #2799 open) -- they are identified by the D-07
     * MINDRIAN_MCP_FIRST surface list on ctx.surface instead. Any other caller
     * (VS Code, MCP Inspector, an unrecognized surface) falls to the headless
     * text rung.
     */
    ```
  implication: A second, independent instance of the same stale claim, directly above the function whose behavior it describes.

- timestamp: 2026-09-23 (267-RESEARCH.md Summary, third bullet; cited, not re-run in this session)
  checked: a live wire tee in front of Claude Code 2.1.280, print mode
  found: Claude Code 2.1.280's `initialize` request declares `capabilities: {"roots":{"listChanged":true},"elicitation":{}}`.
  implication: The comment's premise ("Claude Code/Desktop/Cowork do not declare it") is now false for Claude Code specifically. Desktop and Cowork remain unprobed (267-RESEARCH.md A2, still open) -- the comment should say so precisely rather than grouping all three hosts under one unverified claim.

## Technical Root Cause

- Site: `lib/mcp/tools/gate.cjs:9-10` (file-header comment) and `:198-199` (function doc comment), function `detectClientCapabilities`.
- Cause: a code comment encoding a specific host-behavior fact (issue #2799, "Claude Code/Desktop/Cowork do not declare elicitation") that was true when written (the 265 audit) and has since changed for at least one of the three named hosts (Claude Code 2.1.280 now declares it), without the comment being updated alongside the host's own changelog entry.
- Why it surfaces now: Phase 267's research pass is the first to run a live wire tee against a current Claude Code build while specifically checking the elicitation capability, because the SDK-version migration required understanding exactly which gate rung would be live post-migration.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `lib/mcp/tools/gate.cjs:9-10` (file-header comment) and `:196-199` (function doc comment), function `detectClientCapabilities`
  - Current behavior: both comments assert Claude Code/Desktop/Cowork do not declare the `elicitation` client capability.
  - Required behavior: rewrite both comments to the current, precisely-scoped fact: Claude Code declares `elicitation:{}` as of build 2.1.280, live-verified 2026-09-23 (a live wire tee, print mode); Desktop and Cowork remain UNPROBED (267-RESEARCH.md assumption A2, still open) -- do not claim their behavior matches Claude Code's until each is independently verified. Note that a 2026-07-28-pinned connection (the modern protocol era) still returns `undefined` from `getClientCapabilities()` under the SDK's own legacy-shim behavior, so `elicitation` there is negotiation-dependent, not a fixed fact either.
  - Short-term patch: same as required behavior -- this is a comment-text rewrite with no code-logic change (per `267-CONTEXT.md`: "Update the stale comment ... Do not suppress or force rung (b) AskUserQuestion instead").
  - Long-term fix: none beyond the comment rewrite is required by this RCA. `267-CONTEXT.md`'s navigator ruling is explicit: let elicitation take over on CLI; a future task should verify Desktop/Cowork's actual capability declaration (267-RESEARCH.md "Claude's Discretion" -- whether that verification is a Wave 0 manual probe or deferred is the planner's call, not decided by this RCA).
- Owning plan: 267-07 (per `267-CONTEXT.md` and `267-RESEARCH.md`'s wave structure, Wave 0).

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `tests/test-267-mcpv2-gate-premise.cjs` (267-07 to create)
  - Given: the current file text of `lib/mcp/tools/gate.cjs`
  - When: the test greps the two comment blocks named above
  - Then: neither comment block contains the literal stale phrase "do not declare it" / "do not declare the elicitation" without a version-scoped, dated correction alongside it (e.g. assert the corrected text mentions "2.1.280" and "elicitation" together, and does NOT unconditionally claim Desktop/Cowork non-declaration)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-07 ships in ("corrected the stale gate.cjs elicitation-capability comment; Claude Code 2.1.280 now declares elicitation, gate rung (a) is live on CLI").
- Release lockstep: applies when 267-07 ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: this touches Part 3 (Tri-Context Decision Gate) only as documentation accuracy -- no `docs/CANON-PHASE-MAP.md` update is required since no gate BEHAVIOR changes, only its documented premise.
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: whoever next verifies Desktop's or Cowork's actual `elicitation` capability declaration should update this same comment again with a dated, live-verified fact rather than carrying an assumption forward.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): no Brain wire involved. `gate_render`/`gate_answer` never touch `brain_*` or `brain-client.cjs`.
  2. Tri-Polar: the comment names all three surfaces. The fix must state clearly which surface's behavior is LIVE-VERIFIED (Claude Code only, as of 2.1.280) versus UNVERIFIED (Desktop, Cowork) -- this RCA's Required Code Changes says so explicitly rather than letting the corrected comment overclaim on the other two surfaces.
  3. Cross-platform: not applicable -- this is a comment-only change with no process/path/shell surface.
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, corrected comment text, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): not applicable -- no new surface is added; only an existing comment's factual premise is corrected.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above. `lib/mcp/tools/gate.cjs`'s two comment blocks (`:4-11` file-header, `:196-207` `detectClientCapabilities` JSDoc) asserted a host-behavior fact (issue #2799, "Claude Code/Desktop/Cowork do not declare elicitation") that was true at the 265 audit and stopped being true for Claude Code specifically once build 2.1.280 shipped `elicitation: {}` in its `initialize` capabilities, without the comment being updated alongside. `detectClientCapabilities`'s own executable logic (`server.server.getClientCapabilities()`, read live at call time) was never wrong and needed no change.

fix: test-first per CTX-TESTFIRST. `tests/test-267-mcpv2-gate-premise.cjs` committed RED (`2f14c7eb8`) against the unmigrated comment text (source arm failed: still contained "do not declare it", no "2.1.280" mention; behavior arm already green, proving the ladder's own logic was never the bug). Rewrote ONLY the two comment blocks in `lib/mcp/tools/gate.cjs` (fix commit `aafa47ce7`) to state: capability comes from the MCP initialize handshake; Claude Code declares `elicitation: {}` as of build 2.1.280 (live wire tee, 2026-09-23; re-confirmed at 2.1.281, 2026-09-24, `267-TRIPOLAR-PROBES.md`), so rung (a) (inline `elicitInput`) is the live CLI gate path by navigator ruling (CTX 2026-09-23, "let elicitation take over on CLI"); Desktop and Cowork are stated as UNPROBED as of 2026-09-24 (`267-TRIPOLAR-PROBES.md` Task 3, still pending) rather than lumped into the retracted "do not declare" claim; a 2026-07-28-pinned connection still returns `undefined` from `getClientCapabilities()`, falling to rung (b)/(c); `CLAUDE_HOST_SURFACES` still identifies Claude hosts for rung (b). Comment-only change, zero code-line diff (proven below). No rung was suppressed or forced, per the CTX ruling.

verification:
```
$ node tests/test-267-mcpv2-gate-premise.cjs
PASS: gate.cjs comment text no longer asserts Claude hosts "do not declare" elicitation
PASS: gate.cjs comment text mentions elicitation together with the verified build 2.1.280
PASS: a fake server declaring elicitation:{} reports elicitation:true
PASS: a fake server whose getClientCapabilities() returns undefined reports elicitation:false
PASS: a fake server whose getClientCapabilities() throws reports elicitation:false (caught, not propagated)
PASS=5 FAIL=0 (exit 0)

$ node tests/test-198-gate-renderers.test.cjs
PASS: test-198-gate-renderers (SPEC-4: one gate, three renderers, three identical gate_answer payloads)
(exit 0)

$ node tests/test-265-gate-render-elicit-schema.cjs
PASS: test-265-gate-render-elicit-schema (all 5 arms: single-select, multi-select, label-not-slug, sdk, answer-identity)
(exit 0)

$ grep -c "do not declare it" lib/mcp/tools/gate.cjs
0
$ grep -c "2.1.280" lib/mcp/tools/gate.cjs
2
$ git diff aafa47ce7~1 aafa47ce7 -- lib/mcp/tools/gate.cjs | grep "^[-+]" | grep -v "^[-+]\s*\(//\|\*\|/\*\*\)" | grep -v "^[-+][-+]" | wc -l
0   (comment-only commit, confirmed)
```

files_changed: `lib/mcp/tools/gate.cjs` (comment-only), `tests/test-267-mcpv2-gate-premise.cjs` (new).

commits: `2f14c7eb8` (test, RED) then `aafa47ce7` (fix, comment-only, GREEN). Landed as Task 1 of `267-07-PLAN.md`; gate.cjs's separate registration-API rewrite (`server.tool` -> `server.registerTool`) is Task 2's own commit `b9eaa80d9`, unrelated to this RCA's fix.
