---
status: investigating
kind: rca
trigger: "stale-install-cache-audit-anti-pattern"
issue_id: ""
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7]
created: 2026-05-23T04:35:00Z
updated: 2026-05-23T04:35:00Z
---

## Current Focus

hypothesis: QA audits that read source code from the marketplace install cache (`~/.claude/plugins/mindrian-os/`) instead of the live deployed surface produce false-positive findings when the install cache is older than the fix that closed the gap. The 2026-05-23 deep-audit pass surfaced two such false positives (NF-2026-05-23-01 + the curated-op-surface-missing claim) because the auditor's source read landed in a pre-fix install cache while their wire probe hit the post-fix deployed server. The contract mismatch IS itself a pattern - it will recur every time the fix chain lands after a marketplace cache is cut.
test: read the 2026-05-23 deep-audit transcript; verify both invalidated findings hinge on the same install-cache-vs-deployed-server delta. Cross-check by reading the current deployed source on `origin/main` against the install cache the auditor was reading.
expecting: confirmed - both invalid claims trace to source-code reads of stale install cache content. The deployed wire behaved post-fix; the local code reads were pre-fix.
next_action: ship a "Source-of-Truth Preamble" requirement for QA harnesses: every audit prompt must state explicitly which source-of-truth its claims will be read against, and any source-code claim must be re-verified against `origin/main` HEAD before it is filed as a finding.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.25 (deployed) vs 1.13.0-beta.24 (auditor's install cache)
- Reported by: post-audit reconciliation pass, 2026-05-23
- Date first observed: 2026-05-23
- Related debug sessions: brain-post-fix-qa.md (the audit that surfaced this pattern); .planning/debug/windows-build-brain-python-qa.md (earlier sweep, same source-of-truth caveat applies)

## Problem Statement

QA auditors testing the Brain surface from a Windows machine were reading source code from the marketplace install cache while their wire probes hit the live Render-deployed server. Because the live Render server auto-deploys from `origin/main` and the install cache only refreshes at marketplace update time, the two source-of-truth surfaces drift the moment a fix lands. Two technical findings from the 2026-05-23 deep audit were invalidated by this drift; the audit method itself is the pattern worth naming.

## Symptoms

expected: Audit findings name the deployed surface accurately. A claim of the form "the deployed brain_ask uses string-interpolation at line N" must hold against the source file the Render service is currently running.
actual: The deep-audit pass cited `mcp-server-brain/lib/brain-ask.cjs:164-172` as the site of a moat hole. That line range matches the pre-fix code at `~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak/mcp-server-brain/lib/brain-ask.cjs:164`. The deployed source at `origin/main` HEAD `0280d8fb` uses proper parameter binding at line 582 instead. Same auditor's wire probe correctly observed the post-fix behavior.
errors: None. No exit code. The mismatch surfaces as filed findings that look real but do not reproduce against the deployed surface.
reproduction:
  1. Install plugin from marketplace at version N (cache snapshot of `origin/main` at the version N release commit).
  2. Wait. A fix lands on `origin/main` as commit N+k.
  3. Render auto-deploys; the deployed server is now at commit N+k.
  4. Auditor runs a wire probe against the deployed server (post-fix behavior).
  5. Auditor reads source from the local install cache (pre-fix code at version N).
  6. Auditor files a finding citing a code site that no longer exists on the deployed surface.
started: This is the default state of any plugin with a marketplace cache and an auto-deployed remote server. It is not introduced by any specific commit; it is a structural property of the deployment topology.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the same install cache mechanic on all three)
- Affected commands: all QA harnesses that read source code from the install cache
- Affected users: every external beta-tester running source-code audits, especially those on Windows where the dev workspace may not exist on disk at all
- Version range: structural, not version-bound
- Severity: low - the audit method is fixable with documentation. The deployment topology itself does not need to change.
- Blast radius: every future QA sweep that follows the same source-read-from-install-cache pattern; every CHANGELOG entry that closes a "finding" only to have it re-filed by the next external tester reading the same stale cache.

## Eliminated

- hypothesis: "Render is not auto-deploying; the deployed server is at an old commit too."
  evidence: `mcp-server-brain/render.yaml` declares `autoDeploy: true` connected to `jsagir/mindrian-os-plugin`. The 2026-05-23 wire probes returned populated DirectiveEnvelopes that the pre-fix code path could not produce. The deployed server is on the latest commit.
  timestamp: 2026-05-23T04:35:00Z

- hypothesis: "The auditor was deliberately reading the install cache for a reason."
  evidence: The auditor's transcript explicitly noted `git rev-parse HEAD` returned "fatal: not a git repository" from the install path. The auditor knew the install cache was not a git checkout but proceeded with source reads anyway, because the dev workspace was not available on the Windows machine.
  timestamp: 2026-05-23T04:35:00Z

## Evidence

- timestamp: 2026-05-23T04:35:00Z
  checked: deployed source at `origin/main` HEAD `0280d8fb`, file `mcp-server-brain/lib/brain-ask.cjs`
  found: line 582 uses `await session.run(pattern.cypher, { keyword: String(keyword), limit: neo4j.int(limit) })` - proper parameter binding.
  implication: the deployed surface has the fix.

- timestamp: 2026-05-23T04:35:00Z
  checked: stale install cache at `~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak/mcp-server-brain/lib/brain-ask.cjs`
  found: line 164 reads `.replace(/\$keyword/g, \`'${keyword.replace(/'/g, "\\\\'")}'\`)` - the pre-fix string-interpolation pattern the auditor quoted verbatim.
  implication: the pattern the auditor saw IS real in stale cache content. It is not real on the deployed surface.

- timestamp: 2026-05-23T04:35:00Z
  checked: deployed Zod schema for `brain_ask` at `mcp-server-brain/lib/brain-ask.cjs:508-512`
  found: `op: z.enum(['list_frameworks', 'framework_edges', 'framework_chain_slice']).optional()` and `params: z.object({}).passthrough().optional()` are registered.
  implication: the curated-op surface IS live. The auditor's "no `op` parameter" claim came from reading either a stale Zod schema or a stale tool-list cache on the MCP client side.

## Technical Root Cause

- Site: not a code site; a process site
- Cause: The plugin's deployment topology is dual-source: (a) the marketplace install cache at `~/.claude/plugins/mindrian-os/`, refreshed only on `claude plugin update`; and (b) the Render-deployed server, refreshed on every `git push` to `origin/main`. QA harnesses that conflate the two will produce false positives whenever they drift.
- Why it surfaces now: The c40afc71..d957a515 fix chain landed on `origin/main` and was auto-deployed to Render. The marketplace was not updated yet (the beta.24 install cache is what the auditor had). The auditor ran their audit during the window between fix-deployed and install-cache-refreshed.

## Required Code Changes

- Change 1 (template, not code):
  - Location: `docs/RCA-TEMPLATE.md` (top of the kind: qa-sweep variant section)
  - Current behavior: The template lets QA harnesses choose any source-of-truth without preamble.
  - Required behavior: Add a "Source-of-Truth Preamble" requirement at the top of every kind: qa-sweep file:
    ```
    BEFORE filing any source-code claim, the auditor MUST:
      1. State explicitly which source-of-truth the source-code claim was read against
         (one of: origin/main HEAD <sha>, install cache at <path> at version <N>,
         dev workspace at <path> at HEAD <sha>).
      2. If the source is the install cache, re-verify the claim against origin/main
         HEAD before filing.
      3. If the dev workspace is not on the QA machine, fetch the relevant file
         from origin/main via `git show origin/main:<path>` or the GitHub raw URL,
         and cite the HEAD sha.
    Wire probes are unaffected by this rule - they hit whatever surface the wire
    routes them to, and that surface is named in the State-at-top section.
    ```
  - Short-term patch: add the preamble to the template; document in `mcp-server-brain/CLAUDE.md` so Brain-related sweeps surface it first.
  - Long-term fix: the same preamble + a CI check that scans `.planning/debug/*.md` for source-code claims missing a HEAD-sha citation, and flags them in the next review pass.

- Change 2 (optional):
  - Location: `scripts/doctor.cjs` (add a new `--audit-surface` class)
  - Current behavior: `scripts/doctor.cjs` runs install-cache health checks but does not surface the install-cache-vs-deployed-server delta to the auditor.
  - Required behavior: add a class that prints a short report comparing the install cache HEAD vs `origin/main` HEAD, and the install cache's `brain-ask.cjs` sha vs the deployed server's response (or vs `origin/main`'s sha).
  - Short-term patch: skip; the template change is sufficient.
  - Long-term fix: build the doctor class if false positives recur.

## Tests to Add or Update

- Test 1:
  - Type: unit (against the template, not code)
  - Location: `tests/test-rca-template-source-of-truth-preamble.cjs` (new)
  - Given: a `kind: qa-sweep` file under `.planning/debug/`
  - When: the file's markdown body cites a source-code line (`<path>:<line>` or a code fence with a file annotation)
  - Then: the file MUST also cite the HEAD sha the source was read against
  - Runner registration: register in the Feynman runner alongside the existing CANON gate (Phase 122 pattern)

## Non-Code Follow-ups

- CHANGELOG.md: add a Changed entry under the next version: "QA sweep template now requires a Source-of-Truth Preamble; source-code claims must cite the HEAD sha they were read against to prevent install-cache-vs-deployed-server false positives."
- `docs/RCA-TEMPLATE.md`: add the preamble block per Change 1.
- `mcp-server-brain/CLAUDE.md`: cross-reference this RCA in the project notes so the next external Brain auditor reads the preamble first.
- knowledge-base.md: on resolve, add the summary block with keywords: install cache, deployed surface, source-of-truth, false positive, audit anti-pattern, marketplace cache drift.

## MindrianOS gates

1. **Canon Part 8 (Graph Boundary):** Process change only; no code touching the Brain wire.
2. **Tri-Polar (three surfaces):** The pattern affects audits on all three surfaces; the preamble fix propagates by virtue of being in the template.
3. **Cross-platform:** Process change; no platform behavior touched.
4. **Release lockstep:** Standard 7-place lockstep on the next release that ships the template change.
5. **No em-dashes:** Template language and CHANGELOG entry use hyphens only.
6. **Reuse before build (Canon Part 7):** Extends the existing RCA template; no new harness or surface.

## Resolution

root_cause: <pending - template change not yet shipped>
fix: <pending>
verification: <pending>
files_changed: <pending>
commits: <pending>
