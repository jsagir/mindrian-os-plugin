---
status: resolved
kind: rca
trigger: "brain-three-ticket-reconciliation-2026-05-23"
issue_id: "BUG-2026-05-23-01, BUG-2026-05-23-01b, SPEC-2026-05-23-02"
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 8]
created: 2026-05-23T19:30:00Z
updated: 2026-05-23T19:30:00Z
resolved: 2026-05-23
resolved_by: source-of-truth reconciliation against origin/main HEAD
resolved_disposition: false-positive (stale-cache audit pattern)
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `00e19f5aa34236cc68135cc3895c7f026b676f15` (plugin 1.13.0-beta.29)
- **WIRE claims probe against:** not probed in this reconciliation; the three tickets cite source-code claims only, so the reconciliation is a source read
- **Date of audit:** 2026-05-23
- **Re-verification rule:** every source-code claim in the three submitted tickets was re-read against origin/main HEAD before this finding was filed. All three claims invalidated by direct line-cited evidence (see Evidence section).

## Current Focus

hypothesis: The three tickets (BUG-01, BUG-01b, SPEC-02) submitted 2026-05-23 describe pre-fix-chain code as if it were current. The fix chain c40afc71..d957a515 the tickets list under "fix chain under test" IS the fix; those commits already landed on origin/main and shipped in v1.13.0-beta.26 onward.
test: read each cited file at origin/main HEAD; compare to the "Actual" behavior claimed in each ticket.
expecting: every ticket's "Actual" string does not match the current source.
next_action: NONE. Resolution recorded. Knowledge-base entry added so the next /gsd:debug session surfaces this pattern when a sibling audit lands.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.29
- HEAD sha: 00e19f5aa34236cc68135cc3895c7f026b676f15
- Reported by: external triage handoff (three tickets pasted into chat)
- Date first observed: 2026-05-23
- Related debug sessions:
  - `.planning/debug/brain-post-fix-qa.md` (parent QA-sweep, status: resolved, closed 2026-05-23T04:35Z)
  - `.planning/debug/resolved/brain-topk-uncapped-advisory.md` (Ticket 01b prior filing, resolved by Phase 127.2 Plan 00)
  - `.planning/debug/resolved/v1.13.0-beta.26-post-ship-qa-sweep.md` (the post-ship sweep that closed the same chain)

## Problem Statement

Three RCA-shaped tickets arrived in chat asserting moat-bypass defects in `mcp-server-brain/lib/brain-ask.cjs`. All three describe code that no longer exists on origin/main; the cited "fix chain under test" IS the fix that already shipped. No code change is required. The exposure is to investigation budget, not to the Brain moat.

## Symptoms

expected: tickets describe defects that match current `origin/main` source; `/gsd:debug` opens, fix lands, tests added.
actual: tickets describe pre-fix source; line-cited evidence at origin/main HEAD contradicts every "Actual" claim.
errors: none at runtime. The defect is in the audit pipeline, not in code.
reproduction:
  1. Read each ticket's "Actual" block.
  2. `git show HEAD:mcp-server-brain/lib/brain-ask.cjs | sed -n '<cited lines>p'`.
  3. Observe the current source does not match the cited "Actual".
started: tickets dated 2026-05-23T07:17:00Z; HEAD at that timestamp was already past the fix chain.

## Scope and Impact

- Affected surfaces: none at runtime. The Brain moat is intact on origin/main and on the deployed server.
- Affected commands: none. brain_ask + brain_search + brain_query + the curated-op surface all behave as the post-fix design specifies.
- Affected users: none. End users see correctly-bounded behavior.
- Version range: tickets reference behavior consistent with pre-beta.26 source (the fix chain shipped in beta.26 per `.planning/debug/resolved/v1.13.0-beta.26-post-ship-qa-sweep.md`). Current HEAD is beta.29.
- Severity: low (no production exposure; the cost is the budget burned by the next agent that tries to fix non-existent defects).
- Blast radius: the audit prompt template. Any sibling Wave-N audit that runs without the Source-of-Truth Preamble can reproduce this exact failure mode.

## Eliminated

- hypothesis: the fix chain landed but was reverted.
  evidence: `git log --oneline -- mcp-server-brain/lib/brain-ask.cjs` shows c40afc71, 4a7cbfbe, 2f0e4e79, d957a515 present in the current history with no revert commit; 6bafb646 (Brain Edge Bundle) sits on top.
  timestamp: 2026-05-23T19:25:00Z
- hypothesis: the auditor read the install cache rather than the dev workspace.
  evidence: matches the canonical stale-cache pattern documented in RCA-TEMPLATE.md Section 2.5; cannot prove which cache without the auditor's preamble, but the pattern is consistent with every line-cited claim being one fix-chain-ago.
  timestamp: 2026-05-23T19:25:00Z

## Evidence

- timestamp: 2026-05-23T19:20:00Z
  checked: `mcp-server-brain/lib/brain-ask.cjs:587-602` (the Neo4j fallback path Ticket 01 names)
  found: the path runs `await session.run(pattern.cypher, { keyword: String(keyword), limit: neo4j.int(limit) })`. There is no `.replace(/\$keyword/g, ...)` and no `.replace(/\$limit/g, ...)` in the file. The keyword and limit are passed as a `$`-bound parameter map.
  implication: Ticket 01's "Actual" claim ("$keyword interpolated as quoted string with only single-quote escape; $limit interpolated as String(limit) directly") is contradicted by source.

- timestamp: 2026-05-23T19:21:00Z
  checked: `mcp-server-brain/lib/brain-ask.cjs:545-552` (the Pinecone forward Ticket 01b names)
  found: `const MAX_TOPK = parseInt(process.env.BRAIN_MAX_TOPK || '100', 10); const limit = Math.min(topK || 5, MAX_TOPK);`. The header comment explicitly cites "NF-2026-05-23-01b" (the exact issue ID in Ticket 01b's meta) as the closed advisory it implements.
  implication: Ticket 01b is the same finding that was already filed, fixed, and resolved on 2026-05-23 under `.planning/debug/resolved/brain-topk-uncapped-advisory.md`.

- timestamp: 2026-05-23T19:22:00Z
  checked: `mcp-server-brain/lib/pinecone-tools.cjs:41-46` (the brain_search forward Ticket 01b also names)
  found: identical clamp pattern: `const MAX_TOPK = parseInt(process.env.BRAIN_MAX_TOPK || '100', 10); const safeTopK = Math.min(topK || 5, MAX_TOPK);` forwarded into `searchParams.query.topK`. Header comment notes "mirror of the brain-ask.cjs guard; both Pinecone forward sites must own the moat consistently."
  implication: Ticket 01b's second cited call-site is also already capped.

- timestamp: 2026-05-23T19:23:00Z
  checked: `mcp-server-brain/lib/brain-ask.cjs:100-220` and `:506-525` (the curated-op surface Ticket 02 claims is missing)
  found: `resolveCuratedOp(op, params)` at line ~100, `CURATED_FRAMEWORK_CHAIN_SLICE` constants nearby, `runCuratedOp(driver, op, params)` at line 189, and the brain_ask tool description at line 506 explicitly documents `op` mode with all three names (`list_frameworks`, `framework_edges`, `framework_chain_slice`). The handler dispatches to `runCuratedOp` at line ~520 when `op` is present.
  implication: Ticket 02's claim ("No `op` parameter exists. No `list_frameworks` or `framework_edges` source file exists in the plugin. Only `framework_chain_slice` is implemented") is contradicted by source. All three curated ops exist and are reachable through the `op` MODE of the `brain_ask` tool (not as separate tools, by design; see `mcp-server-brain/CLAUDE.md` "Deferred Tool Loading" rule capping the startup tool count at ~10-15).

- timestamp: 2026-05-23T19:24:00Z
  checked: `mcp-server-brain/CLAUDE.md` "D-MOAT-3 (curated-op surface) -- the second option, now SHIPPED" section
  found: prose explicitly documents the curated-op surface as shipped with all three ops, all D-MOAT-2 bounds applied, and notes "the startup tool count stays at 6."
  implication: the maintainer documentation already records the surface as live; Ticket 02's "two possible paths -- spec author picks" framing assumes a deploy gap that does not exist.

- timestamp: 2026-05-23T19:25:00Z
  checked: `git log --oneline c40afc71^..d957a515 -- mcp-server-brain/lib/brain-ask.cjs`
  found: c40afc71, 4a7cbfbe, 2f0e4e79, d957a515 are all present in current history; 6bafb646 (Phase 127.2 Brain Edge Bundle) sits above them adding the BRAIN_MAX_TOPK clamp Ticket 01b describes as required.
  implication: the "fix chain under test" cited in the tickets is the fix chain that already shipped. The tickets are auditing the post-fix state but describing the pre-fix code.

## Technical Root Cause

The defect is in the audit pipeline, not the code.

- Site: the audit prompt template used to generate the three tickets did not include the Source-of-Truth Preamble (RCA-TEMPLATE.md Section 2.5).
- Cause: without the preamble, the auditor's source read can land in a stale install cache (typical: `~/.claude/plugins/mindrian-os/` at one of the older betas) while their wire probe can hit the post-fix deployed server. Every claim "Actual" string reflects the cache; every "fix chain under test" reflects the chain whose presence on the deployed server suggests the cache should already match. The two views disagree silently.
- Why it surfaces now: this is the second occurrence of the exact pattern. The first was the 2026-05-23 Windows deep audit that surfaced NF-2026-05-23-01 + the curated-op-surface-missing claim; both died on reconciliation. RCA-TEMPLATE.md Section 2.5 was added in response to that incident. The current tickets did not adopt the new template. The pattern WILL recur every time a fix chain lands after a marketplace cache is cut.

## Required Code Changes

None. Filing a code change against valid current code would introduce regression risk for zero benefit.

## Tests to Add or Update

None at the unit / integration / e2e level (no code change is required). The pattern is a process gap.

- Process test (audit-prompt-side):
  - Type: doc / template
  - Location: any audit prompt that gets shared with Wave-N testers or that runs via `/gsd:audit-fix` against the Brain surface
  - Given: the prompt requests RCA-formatted findings
  - When: a finding is filed
  - Then: the prompt MUST emit the Source-of-Truth Preamble (CODE source, WIRE source, audit date, re-verification rule) as the FIRST block of the RCA, ahead of the meta frontmatter or the problem statement
  - Runner registration: not applicable; this is a template / prompt-shape obligation, not a runtime check

## Non-Code Follow-ups

- CHANGELOG.md: no entry. This is a process finding, not a shipped code change. Filing it as Fixed in a version chunk would falsely suggest a fix landed.
- Release lockstep: not applicable (no version bump).
- Canon: not applicable. The relevant canon parts (6 Product-as-Venture, 8 Graph Boundary) are honored; this filing demonstrates Part 6 dog-fooding (the plugin's own RCA template caught a defect in the plugin's own audit pipeline).
- knowledge-base.md: ADD a summary block keyed off "stale-cache audit pattern" so the next `gsd-debugger` session surfaces this as a known-pattern hypothesis when a sibling audit lands.
- Audit-prompt patch: future Wave-N audit prompts that touch the Brain surface MUST include the Source-of-Truth Preamble verbatim from RCA-TEMPLATE.md Section 2.5. The preamble does not prevent the cache delta; it forces the auditor to surface the delta BEFORE findings are filed, which is what the reconciliation requires.

## Resolution

root_cause: three tickets describe pre-fix-chain source as if it were current; the cited fix chain IS the fix and already shipped (c40afc71, 4a7cbfbe, 2f0e4e79, d957a515 present on origin/main; 6bafb646 added the BRAIN_MAX_TOPK clamp above them). No code defect exists.
fix: NONE in code. Process fix: any future Wave-N audit prompt against the Brain surface includes RCA-TEMPLATE.md Section 2.5 Source-of-Truth Preamble verbatim.
verification:
  - `sed -n '587,602p' mcp-server-brain/lib/brain-ask.cjs` shows parameter-bound `session.run` (Ticket 01 invalidated)
  - `sed -n '545,552p' mcp-server-brain/lib/brain-ask.cjs` shows BRAIN_MAX_TOPK clamp (Ticket 01b invalidated)
  - `sed -n '41,46p' mcp-server-brain/lib/pinecone-tools.cjs` shows sibling clamp (Ticket 01b second site invalidated)
  - `grep -n "resolveCuratedOp\|runCuratedOp\|CURATED_FRAMEWORK_CHAIN_SLICE" mcp-server-brain/lib/brain-ask.cjs` returns multiple matches (Ticket 02 invalidated)
  - `git log --oneline c40afc71^..6bafb646 -- mcp-server-brain/lib/brain-ask.cjs` shows full fix chain present (audit's "under test" chain is in main)
files_changed:
  - .planning/debug/resolved/brain-three-ticket-reconciliation-2026-05-23.md (this file)
  - .planning/debug/knowledge-base.md (append summary block; same commit)
commits: pending (single commit with `git add -f` per .planning gitignore convention)
