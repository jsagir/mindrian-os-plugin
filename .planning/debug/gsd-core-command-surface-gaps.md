---
status: investigating
kind: rca
trigger: "gsd-core-command-surface-gaps"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: n/a
canon_parts: []
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `@opengsd/gsd-core@1.3.1` installed at `~/.claude/gsd-core/` (VERSION file confirmed). This is a THIRD-PARTY package, repository `github.com/open-gsd/gsd-core`, issues tracker `github.com/open-gsd/gsd-core/issues` (both confirmed via `npm view` this session) -- NOT MindrianOS-Plugin's own code. This file exists to document the findings clearly enough to file upstream; it is not expected to be fixed inside this repo.
- **Date of audit:** 2026-07-17.
- **Re-verification rule:** all three findings below were reproduced live this session by direct CLI invocation, not inferred from documentation alone.

## Problem Statement

Three places where `@opengsd/gsd-core`'s documented/expected command-surface behavior did not match what actually ran, discovered while planning and executing MindrianOS-Plugin's own Phase 230.

## Findings

### 1. Documented "auto-detect next unplanned phase" does not work

`workflows/ai-integration-phase.md` and `workflows/plan-phase.md` both document the phase argument as: "Phase number: — optional, auto-detects next unplanned phase if omitted." Live reproduction:

```
$ node gsd-core/bin/gsd-tools.cjs query init.plan-phase ""
Error: phase required for init plan-phase

$ node gsd-core/bin/gsd-tools.cjs query roadmap.get-phase ""
{"found": false, "phase_number": ""}
```

Neither call resolves to an actual "next unplanned phase" -- an empty/missing phase argument simply errors or returns not-found. The auto-detect behavior described in the command's own frontmatter does not exist at the `gsd-tools.cjs` layer. (Whether it's meant to be resolved one layer up, in the orchestrating LLM's own reading of ROADMAP.md, is unclear from the docs -- if so, the docs should say that instead of describing it as an automatic behavior.)

### 2. `phase.add` does not split a long description into title vs. goal

```
$ node gsd-core/bin/gsd-tools.cjs query phase.add "MindrianOS Skill Fleet Optimization -- fleet-wide trigger-accuracy + code-quality pipeline across all 124 skills. [... full paragraph ...]"
{
  "phase_number": 230,
  "name": "MindrianOS Skill Fleet Optimization -- fleet-wide trigger-accuracy + code-quality pipeline across all 124 skills. [... entire input string verbatim ...]",
  ...
}
```

The entire input string lands as the phase's `name`/title in `ROADMAP.md`'s `### Phase {N}: {name}` header, and the `**Goal:**` field is left as the literal placeholder `[To be planned]`. A long, goal-shaped description is not distinguished from a short title -- there's no heuristic (e.g. "if input exceeds N characters, treat the first sentence as title and the rest as Goal") and no warning that this will happen. Discovered only because a downstream tool (`gsd-plan-checker`, MindrianOS-Plugin's own agent) caught the resulting empty Goal field during a later verification pass -- `phase.add` itself gives no signal that anything is off.

### 3. `state.add-roadmap-evolution` is documented as directly CLI-callable but isn't

`workflows/add-phase.md` step "update_project_state" and `workflows/edit-phase.md` step "write_updated_phase" both show it invoked exactly like this:

```bash
gsd_run query state.add-roadmap-evolution \
  --phase {target} \
  --action edited \
  --note "edited fields: {changed_field_list}"
```

Live reproduction of that exact invocation:

```
$ node gsd-core/bin/gsd-tools.cjs query state.add-roadmap-evolution --phase 230 --action added --note "..."
Error: state add-roadmap-evolution is SDK-only. Use: gsd-tools query state.add-roadmap-evolution ...
```

The error message tells the caller to use the exact command that just failed -- it's circular and gives no actual path forward for a plain CLI invocation. If this verb genuinely requires the SDK/agent runtime rather than the raw CLI shim, the two workflow docs that show it as a literal bash command block should say so, or the CLI shim should proxy it.

## Impact on MindrianOS-Plugin (context, not upstream's problem to fix)

None of these blocked MindrianOS-Plugin's Phase 230 -- each was worked around live in-session (phase number resolved manually with navigator confirmation; the mis-split title/goal was caught and corrected by `gsd-plan-checker` before it shipped; the Roadmap Evolution note was written directly via the `Edit` tool instead of the CLI). Filed here so the workaround isn't the only record, and so upstream has a real, reproducible report if MindrianOS-Plugin's maintainer chooses to file it.

## Next action

Navigator decides whether to file this at `github.com/open-gsd/gsd-core/issues` (via `gh issue create`, this session has `gh` CLI access) or keep it as a local reference only.
