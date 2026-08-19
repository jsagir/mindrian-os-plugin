# MindrianOS RCA / Debug-Report Template

A root-cause-analysis report in MindrianOS is a **machine-readable incident spec**. Write it so a coding agent (Claude Code, the `gsd-debugger` agent, `/gsd:audit-fix`) can map every field straight to an action with no guessing.

This template is not a new format. It IS the GSD debug-session format already used across `.planning/debug/*.md`, enriched with four agent-input sections (Scope and Impact, Required Code Changes, Tests, Non-Code Follow-ups) and MindrianOS-specific gates. A file written to this template is consumed by `/gsd:debug` unchanged.

Hard rule: NO em-dashes anywhere in an RCA file. Use hyphens. This is a project-wide rule and it applies to this artifact like every other.

---

## 1. Where it lives and how GSD reviews it

| Aspect | Rule |
|--------|------|
| File path | `.planning/debug/<slug>.md` (the `<slug>` IS the `trigger`) |
| Repo | Always `/home/jsagi/MindrianOS-Plugin` (the only dev workspace). Never the plugin cache. |
| Pickup | `/gsd:debug <slug>` resumes it; the orchestrator lists every non-resolved `.planning/debug/*.md` as an active session |
| Status lifecycle | `gathering` -> `investigating` -> `fixing` -> `resolved` (frontmatter `status:`) |
| On resolve | Move the file to `.planning/debug/resolved/`, then add a one-block summary to `.planning/debug/knowledge-base.md` so `gsd-debugger` can surface it as a known-pattern hypothesis next time |
| Commit | `.planning/` files are committed with `git add -f` when the repo ignores `.planning/`; match the pattern of the files already in `.planning/debug/resolved/` |
| Knowledge base | `.planning/debug/knowledge-base.md` carries: slug, date, error-pattern keywords, root cause, fix, files changed. One block per resolved session. |

Live examples in this repo to read as reference:
- `.planning/debug/resolved/mcp-servers-cache-missing-node-modules.md` (a full resolved session)
- `.planning/debug/brain-raw-cypher-admin-gate-starves-baseline.md` (root cause found, fix pending)
- `.planning/debug/release-sh-post-publish-gates-misfire.md` (investigation captured)
- `.planning/debug/windows-build-brain-python-qa.md` (a `kind: qa-sweep` variant)

---

## 2. Agent-friendly principles (MindrianOS-tuned)

- Fixed section order, fixed headings, every time. The agent keys off them.
- Key-value fields and bullet lists over prose paragraphs.
- Reference code by `path/from/repo/root.cjs` + function name + line range. The repo root is always `/home/jsagi/MindrianOS-Plugin`, so paths are repo-relative.
- Make the root cause and the required changes explicit, never implied. Write "because X in `file.cjs:NN`, change Y" not "the handler seems wrong".
- Separate the short-term patch from the long-term fix so the agent can implement either or both.
- Quantify. Never "sometimes" or "seems broken". Write "3 of 10 runs", "only on Windows Git Bash", "exit 127".
- Each field is single-purpose. Do not mix reproduction steps with root-cause guesses.
- APPEND-only sections (`Eliminated`, `Evidence`) are never rewritten. OVERWRITE sections (`Current Focus`, `Resolution`) reflect NOW.
- `Symptoms` is IMMUTABLE once the investigation starts.

---

## 2.5. Source-of-Truth Preamble (MANDATORY)

Every QA / audit prompt and every RCA filing MUST state explicitly which source-of-truth its claims read against. Without this preamble, audits can land on stale install caches while their wire probes hit the deployed server -- producing false-positive findings that waste investigation cycles and erode the audit's signal-to-noise ratio.

Add this block at the top of every audit prompt, and copy the resolved values into the RCA's `Meta` section:

```markdown
## Source-of-Truth Preamble

- **CODE claims read against:** <one of: `origin/main` HEAD @ <sha>, install cache `~/.claude/plugins/mindrian-os/` @ <plugin-version>, branch `<name>` @ <sha>, specific tag `<vX.Y.Z>`>
- **WIRE claims probe against:** <one of: deployed Brain server `pws-brain-mcp.onrender.com` @ <date>, local stdio shim `bin/mindrian-brain-mcp-client.cjs` @ <plugin-version>, mock server `<path>`>
- **Date of audit:** <YYYY-MM-DD>
- **Re-verification rule:** any source-code claim filed below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.
```

**Why this exists (the 2026-05-23 false-positive pattern):** the Windows beta-tester deep audit on 2026-05-23 filed two findings (NF-2026-05-23-01 + the curated-op-surface-missing claim) that died on reconciliation because the auditor's source read landed in a pre-fix install cache (beta.24) while their wire probe hit the post-fix deployed server (beta.25). Both invalid claims traced to the same delta. The pattern WILL recur every time a fix chain lands after a marketplace cache is cut. The Preamble does not prevent the delta -- it makes the delta visible so the reconciliation happens BEFORE findings are filed.

This rule applies to: every `kind: rca` filing, every `kind: qa-sweep` filing, every `/gsd:debug` session opened from a Windows / beta / Wave-N tester audit, every `/gsd:audit-fix` invocation, and every external audit prompt template shared with testers.

Checklist row (add to your existing audit checklist):
- [ ] Source-of-Truth Preamble filled before any finding filed

---

## 3. The Markdown template (copy-paste)

```markdown
---
status: gathering            # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "<slug>"            # the file slug; /gsd:debug keys off this
issue_id: ""                 # optional external tracker ID (Linear/GitHub/etc.)
severity: medium             # blocker | high | medium | low
surfaces: [cli]              # which Tri-Polar surfaces: cli | desktop | cowork
brain_mode: full-loop        # full-loop | no_key | unreachable | tier_denied | not_ready (the refusal-messaging.cjs kinds)
canon_parts: []              # Canon parts the bug or fix touches, e.g. [8, 9]
created: <YYYY-MM-DDTHH:MM:SSZ>
updated: <YYYY-MM-DDTHH:MM:SSZ>
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: <the current best explanation, one or two sentences>
test: <how the hypothesis is being checked>
expecting: <what a confirmed hypothesis looks like>
next_action: <the single next concrete step>

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: <e.g. 1.13.0-beta.24>
- Reported by: <name or role, or "Windows beta-test pass">
- Date first observed: <YYYY-MM-DD>
- Related debug sessions: <slugs of sibling .planning/debug files, or none>

## Problem Statement

One or two sentences. No more. What is broken, for whom.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: <correct behavior, user and system perspective>
actual: <observed behavior, with exact error text and exit codes>
errors: <verbatim error strings, MODULE_NOT_FOUND lines, stack crash sites>
reproduction: <numbered, deterministic steps>
  1. <command or /mos: invocation>
  2. <action>
  3. <observe>
started: <when it began; which version or commit introduced it if known>

## Scope and Impact

- Affected surfaces: <cli | desktop | cowork - which of the three break>
- Affected commands: </mos:* commands or scripts that fail>
- Affected users: <all installs | non-admin keys only | Windows only | etc.>
- Version range: <first-bad version - last-checked version>
- Severity: <blocker | high | medium | low>
- Blast radius: <other components that share the same root cause>

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: <ruled-out explanation>
  evidence: <why it was ruled out>
  timestamp: <YYYY-MM-DDTHH:MM:SSZ>

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: <YYYY-MM-DDTHH:MM:SSZ>
  checked: <what was inspected - a file, a live query, a test run>
  found: <the concrete fact>
  implication: <what it means for the hypothesis>

## Technical Root Cause

The real underlying cause in implementation terms. Promote this from a guess to
a confirmed statement only when the Evidence supports it.

- Site: <repo-relative path>:<line range> function `<name>`
- Cause: <the incorrect logic, missing branch, contract change, or config issue>
- Why it surfaces now: <the trigger - a version bump, a race, an env difference>

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: <path/to/file.cjs>:<line range>, function `<name>`
  - Current behavior: <1-2 lines>
  - Required behavior: <1-2 lines, imperative - "change X to Y", "add guard for null">
  - Short-term patch: <the minimal fix, if different from the full fix>
  - Long-term fix: <the structural fix, if the patch is only a stopgap>
- Change 2:
  - ...

## Tests to Add or Update

- Test 1:
  - Type: <unit | integration | e2e>
  - Location: <repo-relative path to the test file>
  - Given: <precondition>
  - When: <action>
  - Then: <assertion>
  - Runner registration: <register in the Feynman runner / tests/run-all-*.sh if applicable>
- Test 2:
  - ...

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version.
- Release lockstep: if the fix ships, the 7-place lockstep applies (plugin.json,
  package.json, package-lock.json, CHANGELOG, git tag, marketplace.json, install
  minisite). See .claude/includes/release-process.md.
- Canon: if the fix touches a Canon concept, update docs/CANON-PHASE-MAP.md in
  the same commit; declare canon_parts in the phase frontmatter.
- knowledge-base.md: on resolve, add the summary block.
- Docs / monitoring / process notes: <anything a human must do>

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: <final confirmed statement>
fix: <what was actually done>
verification: <commands run and their output - evidence, not assertion>
files_changed:
  - <path> (<what changed>)
commits: <hashes, once committed>
```

---

## 4. The JSON variant

When a tool emits the RCA for an agent instead of a human, emit this alongside or instead of the Markdown. Field names match the Markdown sections.

```json
{
  "meta": {
    "trigger": "<slug>",
    "issue_id": "",
    "status": "investigating",
    "kind": "rca",
    "severity": "high",
    "surfaces": ["cli"],
    "brain_mode": "full-loop",
    "canon_parts": [8],
    "repo": "/home/jsagi/MindrianOS-Plugin",
    "plugin_version": "1.13.0-beta.24",
    "first_seen": "2026-05-22T08:10:00Z"
  },
  "problem_statement": "One or two sentences.",
  "symptoms": {
    "expected": "",
    "actual": "",
    "errors": "",
    "reproduction": ["step 1", "step 2"],
    "started": ""
  },
  "scope_impact": {
    "affected_surfaces": ["cli", "desktop", "cowork"],
    "affected_commands": ["/mos:whitespace"],
    "affected_users": "non-admin Brain keys",
    "version_range": "1.13.0-beta.21 - present",
    "blast_radius": ["fetch-brain-baseline.cjs", "rs-explain", "rs-thesis"]
  },
  "technical_root_cause": {
    "site": "scripts/fetch-brain-baseline.cjs:98-143",
    "function": "main",
    "cause": "Issues raw Cypher via brain.query(); raw Cypher is admin-gated since beta.21.",
    "why_now": "The Brain-query moat guard shipped in beta.21/22."
  },
  "evidence": [
    { "timestamp": "2026-05-22T00:00:00Z", "checked": "live brain_query", "found": "admin-gate refusal payload", "implication": "non-admin keys get {text:...} not rows" }
  ],
  "required_code_changes": [
    {
      "location": "scripts/fetch-brain-baseline.cjs:98-143",
      "function": "main",
      "current_behavior": "Fetches frameworks with raw Cypher; mis-parses the refusal as empty success.",
      "required_behavior": "Fetch via brain_search/brain_ask; detect the refusal and call writeEmptyResult with a reason.",
      "short_term_patch": "Detect the {text:...} refusal, stop reporting it as a 0-framework success.",
      "long_term_fix": "Migrate the baseline fetch off admin-gated raw Cypher."
    }
  ],
  "tests": [
    {
      "type": "unit",
      "location": "scripts/fetch-brain-baseline.test.cjs",
      "given": "brain.query returns an admin-gate refusal",
      "when": "the baseline fetch runs",
      "then": "writeEmptyResult is called with reason brain-query-admin-gated"
    }
  ],
  "follow_ups": ["CHANGELOG Fixed entry", "knowledge-base.md summary on resolve"],
  "resolution": {
    "root_cause": "",
    "fix": "",
    "verification": "",
    "files_changed": [],
    "commits": []
  }
}
```

---

## 5. MindrianOS-specific gates (every RCA must answer these)

A generic RCA stops at "what is the code fix". A MindrianOS RCA must also clear these gates before the Resolution can be called complete:

1. **Canon Part 8 - the Graph Boundary.** Does the fix touch any Brain wire (a `brain_*` MCP call, `brain-client.cjs`, an `mcp-server-brain/` path)? If yes, the RCA must state explicitly that no user-specific bytes reach the Brain. LOCAL data to BRAIN is never allowed. If the fix is ambiguous on this, it goes through separate review.
2. **Tri-Polar - the three surfaces.** Does the fix behave correctly on CLI, Desktop, AND Cowork? A fix verified on one surface only is incomplete. State which surfaces were verified and which are verified by construction.
3. **Cross-platform.** If the fix touches process spawning, paths, or shell behavior, it must be correct on Windows, Mac, and Linux. Linux-verified-only is a partial result. Say so.
4. **Release lockstep.** If the fix ships in a release, the 7-place lockstep applies. The RCA's Non-Code Follow-ups must name it.
5. **No em-dashes.** The fix's code comments, the CHANGELOG entry, the commit message, and this RCA file all use hyphens.
6. **Reuse before build (Canon Part 7).** If the fix adds a new command, skill, agent, or hook, the RCA must answer which existing surface it extends and why repointing was insufficient.

---

## 6. How QA fills it so the agent gets it

- Avoid vague phrases. Replace "seems broken" / "sometimes" with a count and a condition: "fails 3 of 10 runs, only on Windows Git Bash".
- Keep each field single-purpose. Reproduction steps carry no explanation; the explanation lives in Technical Root Cause.
- In Technical Root Cause, QA pastes or summarizes the dev investigation so the agent only has to implement, not re-investigate.
- In Required Code Changes, use imperative language: "change X to Y", "add a guard for the {text:...} payload", "split the function".
- Classify, do not just report. A symptom that traces to a known tracked bug gets cross-referenced to that debug session, not re-opened. A symptom that is an environment gap (missing dependency, missing key) is labeled as such, not as a code defect.
- When the root cause is not yet known, `status` stays `investigating` and the `Resolution.root_cause` says "PENDING". Never write a fabricated root cause to look finished.

---

## 7. Relationship to GSD

This template is the GSD debug-session format with four sections added (Scope and Impact, Required Code Changes, Tests to Add or Update, Non-Code Follow-ups) and MindrianOS frontmatter fields added (`kind`, `severity`, `surfaces`, `brain_mode`, `canon_parts`, `issue_id`).

A file written to this template is fully backward-compatible with `/gsd:debug`: the orchestrator reads `trigger`, `status`, `Current Focus`, `Symptoms`, `Eliminated`, `Evidence`, and `Resolution` exactly as before. The added sections are inert to the orchestrator and load-bearing for the human and the coding agent.

Workflow:
1. `/gsd:debug <slug>` creates or resumes the file.
2. The `gsd-debugger` agent fills `Symptoms`, appends `Evidence`, narrows `Current Focus`.
3. When the root cause is found, it fills `Technical Root Cause`, `Required Code Changes`, and `Tests`.
4. A human confirms the fix direction (Canon Part 9 - the human confirms truth).
5. On resolve: `status: resolved`, move to `.planning/debug/resolved/`, add the `knowledge-base.md` block, honor the Non-Code Follow-ups.
