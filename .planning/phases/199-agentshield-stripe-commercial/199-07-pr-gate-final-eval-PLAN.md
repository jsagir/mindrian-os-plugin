---
phase: 199-agentshield-stripe-commercial
plan: 07
type: execute
wave: 4
depends_on: [199-05, 199-06]
files_modified:
  - .github/workflows/agentshield-scan.yml
  - scripts/agentshield-scan-cli.cjs
  - references/security/agentshield-baseline.json
  - tests/run-all-199.sh
  - evals/plurai/199-baseline.json
autonomous: true
requirements: [AS-08, AS-09]

must_haves:
  truths:
    - "A GitHub Actions workflow fires on any PR touching .mcp.json, hooks/**, .claude/skills/**, skills/**, CLAUDE.md, .claude/rules/**, package.json, agents/**, or commands/**, and runs the CJS scanner; only findings NOT present in references/security/agentshield-baseline.json fail the job (baseline-delta mode -- legacy patterns never retroactively block a PR)"
    - "evals/plurai/199-baseline.json's final state confirms both: (a) 100% frozen-scalar parity against the original 196 CSV, (b) the new AgentShield-surface CSV's precision/recall, and is marked phase_gate:'PASSED'"
    - "tests/run-all-199.sh is fully green end-to-end (0 SKIP, 0 FAIL) after this plan, including a synthetic e2e smoke leg"
  artifacts:
    - path: .github/workflows/agentshield-scan.yml
      provides: "PR-gate CI workflow, baseline-delta enforcement"
    - path: references/security/agentshield-baseline.json
      provides: "the committed known-findings snapshot legacy PRs are diffed against"
---

<objective>
Close the phase with the two remaining SEED-016 deliverables the CC-currency amendment says stay unaffected by native Claude Code: the GitHub Actions PR-gate (baseline-delta mode so false positives never block a legacy PR), and the final Plurai eval gate proving both frozen-scalar parity with the original Phase-196 boundary set and a genuine precision/recall reading on the new AgentShield surface set. Finish with a fully green `tests/run-all-199.sh`.

Purpose: no phase closes without a passing Plurai baseline; the PR-gate is the durable enforcement mechanism the whole phase exists to ship.
Output: `.github/workflows/agentshield-scan.yml`, `scripts/agentshield-scan-cli.cjs`, `references/security/agentshield-baseline.json`, finalized `evals/plurai/199-baseline.json`, fully green `tests/run-all-199.sh`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@scripts/part8-egress-guard-hook.cjs
@lib/core/security/agentshield-run.cjs
@evals/plurai/199-baseline.json
@tests/run-all-196.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: CLI wrapper + baseline</name>
  <files>scripts/agentshield-scan-cli.cjs, references/security/agentshield-baseline.json</files>
  <read_first>
    scripts/part8-egress-guard-hook.cjs (argv/exit-code CLI wrapper
    conventions); lib/core/security/agentshield-run.cjs (the
    runAgentShieldScan() shape to wrap).
  </read_first>
  <action>
    Write scripts/agentshield-scan-cli.cjs: a thin CLI over
    lib/core/security/agentshield-run.cjs. Default mode -- run the scan, diff
    `findings` against references/security/agentshield-baseline.json (a
    committed array of `{surface, id, ruleId}` triples representing
    ALREADY-KNOWN/accepted findings), print a human-readable report, exit 1
    if any finding is NOT present in the baseline (a genuinely NEW finding),
    exit 0 otherwise (baseline-delta mode: legacy findings recorded in the
    baseline never fail the gate). `--json` -- machine-readable stdout.
    `--write-baseline` -- overwrite references/security/agentshield-baseline.json
    with the CURRENT scan's findings (an explicit, PR-reviewable act, never
    automatic). Run `node scripts/agentshield-scan-cli.cjs --write-baseline`
    once now to seed references/security/agentshield-baseline.json from the
    current clean repo state (expect an empty findings array, since 199-04
    already proved the live repo scans clean on every surface); commit that
    seeded baseline.
  </action>
  <verify>
    <automated>node scripts/agentshield-scan-cli.cjs; node scripts/agentshield-scan-cli.cjs --json</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    CLI exists; baseline file committed with the current (clean) findings;
    default-mode exit code 0 on the clean repo.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: PR-gate workflow + final Plurai parity + e2e smoke</name>
  <files>.github/workflows/agentshield-scan.yml, evals/plurai/199-baseline.json, tests/run-all-199.sh</files>
  <read_first>
    evals/plurai/199-baseline.json (current state from 199-02); tests/run-all-196.sh
    (the e2e smoke leg 196-05 appended, as the pattern to mirror for the final
    leg here).
  </read_first>
  <action>
    Write `.github/workflows/agentshield-scan.yml`: trigger `pull_request`
    with a `paths:` filter listing `.mcp.json`, `hooks/**`,
    `.claude/skills/**`, `skills/**`, `CLAUDE.md`, `.claude/rules/**`,
    `package.json`, `agents/**`, `commands/**`; one job,
    `runs-on: ubuntu-latest`, checkout (`actions/checkout@v4`) + setup-node
    (`actions/setup-node@v4`, pinned to the Node major version matching
    package.json's `engines` field, &gt;=22) + `node scripts/agentshield-scan-cli.cjs`;
    fail the job on a non-zero exit; upload the `--json` output as a workflow
    artifact. Add a comment in the workflow noting this is a repo-governance
    CI file, not a plugin-distributed artifact -- it never ships to end
    users' installs.

    Update evals/plurai/199-baseline.json to its FINAL state: re-verify (via
    `node lib/core/security/agentshield-scanner.test.cjs`) that the
    `brain_egress_parity_reference` verdict_map still matches
    evals/plurai/196-baseline.json byte-for-byte (frozen scalars), and that
    `agentshield_surface_baseline`'s verdict_map now reflects 199-03's SHIPPED
    classifier rather than only the Task-2 hand-labeled degrade -- if any CVE-DB
    gap-closing pass in 199-03 changed a borderline row's true verdict,
    reconcile the CSV's Label column and the baseline together and document
    why in the SUMMARY, rather than silently forcing parity. Set a top-level
    `phase_gate: 'PASSED'` field once both parity checks hold.

    Append the final Wave-4 e2e smoke leg to tests/run-all-199.sh, replacing
    the Wave-4 placeholder comment 199-01 left: drive one flagged fixture and
    one clean fixture through scanSurface() for EACH of the 6 surfaces
    (read-only, fixtures only, no live repo mutation), assert the drift gate
    renders `{Investigate, Defer}` for a flagged case, and assert
    `node scripts/agentshield-scan-cli.cjs` exits 0 against the live repo.
    Run `bash tests/run-all-199.sh` and confirm 0 SKIP / 0 FAIL.
  </action>
  <verify>
    <automated>bash tests/run-all-199.sh; node -e "const b=require('./evals/plurai/199-baseline.json'); if(b.phase_gate!=='PASSED') throw new Error('Plurai gate not passed')"</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    Workflow file exists with the correct paths filter and baseline-delta
    invocation; 199-baseline.json carries `phase_gate:'PASSED'`;
    tests/run-all-199.sh is fully green with 0 SKIP and 0 FAIL.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| PR-gate CI | Runs on every PR touching a governed surface; a compromised workflow or a hidden baseline edit are both repo-visible via the PR diff itself. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-07-01 | Tampering | a PR modifying the workflow file itself to disable the gate | accept (out of code scope) | Standard repo branch-protection/CODEOWNERS on `.github/workflows/**` is a repo-settings concern, not a code deliverable; flagged for navigator awareness. |
| T-199-07-02 | Tampering | a PR modifying agentshield-baseline.json to hide a new finding | mitigate | The baseline is a tracked, reviewed file; any change to it is exactly as visible in the PR diff as any other code change. |
| T-199-07-SC | Tampering (supply chain) | GH Actions `actions/checkout` / `actions/setup-node` | mitigate | Pinned to major-version tags (`@v4`), no floating `@main`. |
</threat_model>

## Artifacts this phase produces

- `.github/workflows/agentshield-scan.yml` -- the PR-gate, baseline-delta CI workflow.
- `scripts/agentshield-scan-cli.cjs` -- CLI wrapper (default/--json/--write-baseline).
- `references/security/agentshield-baseline.json` -- committed known-findings snapshot.
- Finalized `evals/plurai/199-baseline.json` with `phase_gate:'PASSED'`.
- Fully green `tests/run-all-199.sh` (0 SKIP, 0 FAIL) -- the phase-closing verification gate.

<verification>
`bash tests/run-all-199.sh` exits 0 with 0 SKIP and 0 FAIL. `evals/plurai/199-baseline.json` carries `phase_gate:'PASSED'`. `node scripts/agentshield-scan-cli.cjs` exits 0 on the current repo.
</verification>

<success_criteria>
- PR-gate workflow present with baseline-delta semantics.
- Plurai eval gate PASSED (frozen-scalar parity + new surface baseline).
- tests/run-all-199.sh fully green with 0 SKIP.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-07-SUMMARY.md` when done
</output>
