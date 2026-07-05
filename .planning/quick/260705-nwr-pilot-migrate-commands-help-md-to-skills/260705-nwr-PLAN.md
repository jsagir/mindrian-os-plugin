---
phase: quick-260705-nwr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - skills/help/SKILL.md
  - data/connector-coverage-ledger.json
  - data/connector-registry.json
autonomous: false
requirements: [QUICK-260705-NWR]

must_haves:
  truths:
    - "skills/help/SKILL.md exists and is byte-identical to commands/help.md"
    - "commands/help.md is unmodified (pilot is reversible by deleting skills/help/)"
    - "All CIRS gates pass: build-connector-registry --check, check-shape-declaration, check-render-coverage, check-help-coverage, build-orchestration-projection --check"
    - "/mos:help registers and runs on the Windows machine via the skills/ path (human-verified)"
  artifacts:
    - path: "skills/help/SKILL.md"
      provides: "The /mos:help surface delivered via the skills/ loading path"
      contains: "connector:"
    - path: "data/connector-coverage-ledger.json"
      provides: "Regenerated CIRS R1 ledger including the new skill surface as excluded"
  key_links:
    - from: "skills/help/SKILL.md"
      to: "scripts/build-connector-registry.cjs"
      via: "connector.excluded frontmatter block (CIRS R1 wired-XOR-excluded)"
      pattern: "excluded: true"
    - from: "skills/help/SKILL.md"
      to: "scripts/check-shape-declaration.cjs"
      via: "hitl_shape/hitl_why frontmatter (R16 declaration mandate)"
      pattern: "hitl_shape"
---

<objective>
Pilot-migrate exactly ONE command (commands/help.md) into skills/help/SKILL.md so the Windows commands/-loading defect can be tested with a low-risk, reversible change before committing to migrating all 107 commands.

Purpose: On Windows installs, this plugin's commands/*.md files fail to register ("No commands match") while skills/ from the SAME plugin load fine. A control test with an unrelated marketplace plugin reproduced the identical symptom, so this is a Claude Code commands/-loading defect. Per Anthropic docs, commands/ is the legacy flat-file path and skills/ is the recommended path; both create the same slash command.

Output: skills/help/SKILL.md (byte-identical mirror of commands/help.md), regenerated CIRS data artifacts, one atomic commit, and exact Windows verification steps.
</objective>

<context>
@./CLAUDE.md
@commands/help.md

**Pre-verified facts (do NOT re-research; these were confirmed against code.claude.com/docs/en/skills and this repo's gate script sources on 2026-07-05):**

1. **Precedence (verified in docs):** "if a skill and a command share the same name, the skill takes precedence." Plugin skills use the `plugin-name:skill-name` namespace. So with both files present, `/mos:help` resolves to the skill; deleting `skills/help/` reverts cleanly to the command. The precedence assumption from the task constraints is CONFIRMED, not assumed.

2. **Skill command name (verified in docs):** comes from the DIRECTORY name (`skills/help/SKILL.md` -> `/mos:help`). The frontmatter `name:` field is a display label only (except for a plugin-root SKILL.md, which this is not). So `name: help` carries over harmlessly.

3. **Frontmatter mapping (verified in docs frontmatter reference):** `name`, `description`, `argument-hint`, and `allowed-tools` (YAML list accepted) are all directly supported SKILL.md fields. All fields are optional; unknown/custom fields (`help_jtbd`, `body_shape`, `hitl_shape`, `hitl_why`, `body_shape_detail`, `serves_jtbd`, `teaching`, `ui_reference`, `connector`) do not error - this repo's existing skills (room-proactive, ui-system) already carry custom fields like `connector` and `hitl_stages`. Therefore a byte-identical copy is a VALID SKILL.md and is the maximally faithful mapping. No field is dropped, no field needs translation.

4. **CIRS gate impact (verified in gate script sources):**
   - `scripts/build-connector-registry.cjs` walks `skills/*/SKILL.md` (listSourceFiles, ~line 273) and its `--check` byte-compares the tracked `data/connector-registry.json` AND `data/connector-coverage-ledger.json` (~lines 817-825). Adding skills/help/SKILL.md adds a new surface to the ledger -> the tracked ledger goes STALE -> the default (write) run MUST be executed and the regenerated data/ files committed. The copied `connector.excluded: true` + `reason` block is REQUIRED - without it the new skill surface classifies as `gap` and the born-wired gate fails closed.
   - `scripts/check-shape-declaration.cjs` walks `skills/*/SKILL.md` (collectSurfaces, ~line 675). The copied `hitl_shape: F.1` + `hitl_why` make it a DECLARED surface; the declared count is enumerated from disk at run time (126 -> 127, never a frozen literal, per CLAUDE.md Part 11). The Phase 209-03 body/grant predicates are scoped to `klass === 'command'` only and skip for skills. Advisory (WARN) as of Phase 210, but this change should produce zero new warnings.
   - `scripts/check-render-coverage.cjs` reads `data/render-coverage-registry.json`, whose markdown keyspace is built from `commands/*.md` ONLY (build-render-coverage.cjs buildMdKeyspace, ~line 333). Untouched: commands/help.md stays, its `wired: true` entry stands, no staleness.
   - `data/command-registry.json` is generated by `scripts/build-command-registry.cjs`, which walks `commands/` ONLY (~line 231). Untouched; the existing `/mos:help` entry stands. NO new entry needed.
   - `scripts/check-help-coverage.cjs` walks `commands/` ONLY (~line 90). Untouched.

5. **Decision made (not silently applied - stating it here):** NO behavior-changing frontmatter is added to the SKILL.md (no `disable-model-invocation`, no `user-invocable`, no `context: fork`). Docs state commands and skills "work the same way"; adding invocation-control fields would make the pilot measure two variables at once. Parity first; tuning is a follow-up if the full migration proceeds.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mirror commands/help.md as skills/help/SKILL.md</name>
  <files>skills/help/SKILL.md</files>
  <action>
    Create the directory `skills/help/` and copy `commands/help.md` to `skills/help/SKILL.md` byte-for-byte (`mkdir -p skills/help && cp commands/help.md skills/help/SKILL.md`). Do NOT edit any frontmatter field or body line - per the pre-verified facts above, the byte-identical copy is a valid SKILL.md, every commands/*.md field either maps directly (name, description, argument-hint, allowed-tools) or is a tolerated custom field carried verbatim (help_jtbd, body_shape, hitl_shape, hitl_why, body_shape_detail, serves_jtbd, teaching, ui_reference, connector). The `connector.excluded: true` block MUST be present in the copy (it is - it comes along in the byte copy) or the born-wired gate fails closed. Do NOT modify or delete commands/help.md. Do NOT touch any of the other 106 commands/*.md files - explicitly out of scope for this pilot. Do NOT add data/command-registry.json entries by hand (that file is generated from commands/ only and is unaffected).
  </action>
  <verify>
    <automated>diff commands/help.md skills/help/SKILL.md && git diff --stat -- commands/ | grep -c "" | grep -qx "0" && echo PARITY-OK</automated>
  </verify>
  <done>skills/help/SKILL.md exists, `diff commands/help.md skills/help/SKILL.md` is empty, and `git status` shows commands/ untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Regenerate CIRS artifacts, run the full gate sweep, commit atomically</name>
  <files>data/connector-coverage-ledger.json, data/connector-registry.json</files>
  <action>
    First regenerate the connector artifacts so the tracked ledger includes the new skill surface: run `node scripts/build-connector-registry.cjs` (the default WRITE mode - this is required because --check byte-compares the tracked ledger, which is now stale by exactly one excluded skill surface). Inspect `git diff data/` and confirm the ledger delta is ONLY the new skills/help surface classified as excluded (plus any count fields the generator maintains); if the diff touches anything about OTHER surfaces, STOP and report - that means an assumption in this plan is wrong.

    Then run the full gate sweep and require all clean:
    1. `node scripts/build-connector-registry.cjs --check` (born-wired gate, now against the regenerated ledger)
    2. `node scripts/check-shape-declaration.cjs` (expect declared count to go from 126 to 127, zero violations; it is advisory as of Phase 210 but any NEW warning naming skills/help/SKILL.md is a failure for this pilot)
    3. `node scripts/check-render-coverage.cjs` (must pass untouched - its md keyspace is commands/*.md only)
    4. `node scripts/check-help-coverage.cjs` (must pass untouched - commands/help.md still carries help_jtbd)
    5. `node scripts/build-orchestration-projection.cjs --check`
    6. `node scripts/doctor.cjs --acceptance` (roll-up)

    If any gate fails in a way that requires changing files beyond skills/help/SKILL.md and the regenerated data/ artifacts, STOP and report it as a decision point (scope expansion needs user approval) rather than fixing it inline.

    Commit atomically (all in one commit): `git add skills/help/SKILL.md data/connector-coverage-ledger.json data/connector-registry.json` plus any other data/ file the generator legitimately rewrote, with message `pilot(help): mirror commands/help.md as skills/help/SKILL.md (Windows commands-loading defect workaround)`. Do NOT run scripts/release.sh or bump any version - this is a pilot commit, not a release.
  </action>
  <verify>
    <automated>node scripts/build-connector-registry.cjs --check && node scripts/check-shape-declaration.cjs && node scripts/check-render-coverage.cjs && node scripts/check-help-coverage.cjs && node scripts/build-orchestration-projection.cjs --check && git log -1 --stat | grep -q "skills/help/SKILL.md" && echo GATES-AND-COMMIT-OK</automated>
  </verify>
  <done>All five gate scripts plus doctor --acceptance pass; one atomic commit contains skills/help/SKILL.md and the regenerated data/ artifacts; working tree is clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>skills/help/SKILL.md now mirrors commands/help.md, all CIRS gates pass, and the change is committed. Per the official docs, the skill takes precedence over the same-named command, so /mos:help now loads via the skills/ path - the path that works on the affected Windows machine.</what-built>
  <how-to-verify>
    On the Windows machine where commands/*.md fail to register:
    1. Push this commit to origin main (from this dev workspace, per the WORKSPACE GUARD), then on Windows update the plugin install to include it. If the marketplace pin has not been re-tagged, install/refresh from the repo directly so the new commit is in the plugin cache - do NOT cut a release just for this test.
    2. Restart Claude Code, type `/mos:` and check the autocomplete: `/mos:help` should now appear (previously "No commands match").
    3. Run `/mos:help` - expect the Card 1 family selector (AskUserQuestion, 4 families). Also run `/mos:help --list` and confirm the renderer text view prints.
    4. Sanity check on a machine where commands/ DOES load (this Linux box): run `/mos:help` and confirm behavior is unchanged (skill precedence means the identical skill body serves it - output should be indistinguishable).
    5. If the Windows test FAILS: revert by deleting skills/help/ (`git revert` the pilot commit) - commands/help.md was never touched, so rollback is one commit.
  </how-to-verify>
  <resume-signal>Type "approved" if /mos:help registers and runs on Windows via the skill, or describe what happened. Approval green-lights planning the full 107-command migration as a proper phase; failure means we file the Windows findings and revert.</resume-signal>
</task>

</tasks>

<verification>
- `diff commands/help.md skills/help/SKILL.md` is empty (byte-identical mirror).
- `git log -1` shows exactly one pilot commit touching skills/help/SKILL.md + regenerated data/ artifacts, nothing else.
- Gate sweep clean: build-connector-registry --check, check-shape-declaration (127 declared, 0 violations), check-render-coverage, check-help-coverage, build-orchestration-projection --check, doctor --acceptance.
- Windows machine: /mos:help appears in autocomplete and runs (human checkpoint).
</verification>

<success_criteria>
- The Windows commands-loading defect is bypassed for /mos:help via the skills/ path, verified on the affected machine.
- Zero regression on machines where commands/ loads (skill precedence serves an identical body).
- Rollback is a single revert (commands/help.md untouched; the other 106 commands untouched).
- A clear go/no-go signal exists for the full 107-command migration phase.
</success_criteria>

<output>
This is a quick task; no phase SUMMARY.md. On completion, report the commit hash, the gate sweep results, and the Windows checkpoint outcome inline.
</output>
