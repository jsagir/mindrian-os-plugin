---
phase: 199-agentshield-stripe-commercial
plan: 05
type: execute
wave: 3
depends_on: [199-04]
files_modified:
  - .claude/skills/agentshield/SKILL.md
  - commands/agentshield.md
  - data/connector-registry.json
  - data/command-registry.json
  - scripts/doctor.cjs
autonomous: true
requirements: [AS-05, AS-06]

must_haves:
  truths:
    - "/mos:agentshield is a governed, born-wired invocable surface: EXCLUDED-with-reason per Canon Part 11 R1 (a deliberately-run diagnostic, mirroring /mos:doctor's precedent), not a dark, unregistered command"
    - "node scripts/build-connector-registry.cjs --check and node scripts/build-command-registry.cjs --check both exit 0 after the new command lands"
    - "doctor.cjs --acceptance includes a new Class O acceptance point ('agentshield-all-surfaces-clean') that fails if any surface carries an unremediated flagged finding"
  artifacts:
    - path: commands/agentshield.md
      provides: "the /mos:agentshield front door, body_shape E, connector excluded+reason"
    - path: .claude/skills/agentshield/SKILL.md
      provides: "the runner skill that invokes agentshield-run.cjs and renders the Shape E Action Report"
  key_links:
    - from: "commands/agentshield.md"
      to: ".claude/skills/agentshield/SKILL.md"
      via: "Skill tool invocation (not bespoke dispatch, per SEED-016 CC-currency amendment)"
    - from: "scripts/doctor.cjs Class O"
      to: "lib/core/security/agentshield-run.cjs"
      via: "require + runAgentShieldScan() call"
      pattern: "agentshield-run"
---

<objective>
Give the AgentShield scanner its user-facing, governed invocable surface: a plugin skill that runs the full scan and renders it, a thin `/mos:agentshield` command front door that is born WIRED-or-EXCLUDED per Canon Part 11, and a new `doctor.cjs` acceptance point so release gates catch a flagged surface before ship.

Purpose: SEED-016's CC-v1.19 currency amendment is explicit that the runner must be "the Skill tool + plugin skill, not bespoke dispatch," and that Part 11's born-wired gate applies to this new surface.
Output: `.claude/skills/agentshield/SKILL.md`, `commands/agentshield.md`, regenerated registries, `doctor.cjs` Class O.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@docs/MINDRIAN-CANON.md

@.claude/skills/docu-optimizer/SKILL.md
@commands/doctor.md
@commands/graph.md
@lib/core/security/agentshield-run.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: skill + command</name>
  <files>.claude/skills/agentshield/SKILL.md, commands/agentshield.md</files>
  <read_first>
    .claude/skills/docu-optimizer/SKILL.md (frontmatter + structure precedent);
    commands/doctor.md (EXCLUDED connector precedent + body_shape E precedent);
    commands/graph.md (voice-rules / glyph-vocabulary precedent for command
    body prose).
  </read_first>
  <action>
    Write `.claude/skills/agentshield/SKILL.md` with frontmatter
    `name: agentshield`, `description: "Scan MindrianOS's own plugin surfaces (MCP tool descriptions, hooks, skills, CLAUDE.md permissions, package.json dependencies) for known attack-class patterns"`,
    `argument-hint: [--json|--surface &lt;name&gt;|--write-baseline]`,
    `allowed-tools: [Read, Bash]`, `license: BSL 1.1`. Body: instruct Claude to
    invoke `lib/core/security/agentshield-run.cjs`'s `runAgentShieldScan()`
    (via a short `node -e` Bash call or the CLI wrapper once 199-07 lands
    it), then render the result as a Shape E Action Report: per-surface status
    rows, `[clean]` / `[N flagged]` markers using ONLY the 12-glyph
    vocabulary, a total-findings summary line, and a Feynman-simplified
    one-line explanation of any flagged finding's attack class (no jargon,
    per the project's Explanations directive). Voice rules identical to
    commands/graph.md: conversational, direct, no filler, no emoji, no
    em-dashes.

    Write `commands/agentshield.md` as the thin front door: frontmatter
    `name: agentshield`, `description: "Scan the plugin's own agent-config surfaces (MCP, hooks, skills, CLAUDE.md, supply chain) for known attack patterns"`,
    `help_jtbd: "Scan the plugin's own agent-config surfaces for known attack patterns before you trust a fresh MCP server, hook, or skill."`,
    `body_shape: E (Action Report)`, `allowed-tools: [Bash, Read]`. Add a
    `connector:` block set to
    `{excluded: true, reason: "Utility command. A deliberately-run security scan the navigator or release pipeline invokes on demand; it inspects the plugin's own config surfaces, it never reacts to a navigator problem-state (Part 11 R1 EXCLUDED-with-reason, mirrors /mos:doctor)."}`
    -- cite Canon Part 11 explicitly in a code comment directly above the
    block, exactly as commands/doctor.md does. Body: a short instruction to
    invoke the `agentshield` Skill via the Skill tool (do NOT hand-roll a
    bespoke dispatch script -- this is the CC-v1.19 currency requirement from
    SEED-016).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('commands/agentshield.md','utf8'); if(!/excluded:\s*true/.test(t)) throw new Error('connector block missing excluded:true')"</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    Both files exist with valid frontmatter; commands/agentshield.md's
    connector block parses as EXCLUDED with a non-empty reason string citing
    Part 11.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: regenerate registries + doctor Class O</name>
  <files>data/connector-registry.json, data/command-registry.json, scripts/doctor.cjs</files>
  <read_first>
    scripts/doctor.cjs (the buildAcceptanceChecklist tail + the
    'activation-reached-the-wire' Class N entry -- the precedent to append
    after); scripts/build-connector-registry.cjs; scripts/build-command-registry.cjs
    (--check semantics).
  </read_first>
  <action>
    Run `node scripts/build-connector-registry.cjs` and
    `node scripts/build-command-registry.cjs` (no `--check`) to regenerate
    data/connector-registry.json and data/command-registry.json including the
    new agentshield command; the deterministic serializer should produce a
    clean additive diff. Re-run both with `--check` to confirm zero exit.

    Add a new entry to `buildAcceptanceChecklist()` in scripts/doctor.cjs,
    appended immediately after the `activation-reached-the-wire` (Class N)
    entry and before the closing `];`:
    `id: 'agentshield-all-surfaces-clean'`,
    `label: 'Class O: AgentShield reports zero flagged findings across all 5 plugin surfaces'`,
    `severity: 'blocker'`, `applies_to: ['pre-tag','full']`, and a
    `run: async function()` that -- respecting the existing
    `DOCTOR_TEST_MODE`/`DOCTOR_TEST_FAIL_POINT` synthesized-failure convention
    used by every other checklist entry -- requires
    `lib/core/security/agentshield-run.cjs`, calls `runAgentShieldScan()`, and
    returns `ok: result.totalFlagged === 0` (an `ambiguous` verdict WARNS via
    the `finding` string but does not fail the blocker, mirroring the existing
    warn-vs-blocker distinction elsewhere in the file); `finding` is a
    one-line summary of the first flagged entry when not ok; `detail` carries
    `{ totalFlagged, totalAmbiguous, surfaces: result.surfaces }`. This is an
    ADD-ONLY edit -- do not modify any existing checklist entry's logic.
  </action>
  <verify>
    <automated>node scripts/doctor.cjs --acceptance --pre-tag; node scripts/build-connector-registry.cjs --check; node scripts/build-command-registry.cjs --check</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    New Class O entry present in buildAcceptanceChecklist(), returns
    ok:true on the current clean repo, both registry --check commands exit 0.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| new invocable surface | `/mos:agentshield` is a new command; Part 11's born-wired gate governs whether it may enter the system at all. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-05-01 | Elevation of Privilege | new invocable surface (/mos:agentshield) | mitigate | EXCLUDED-with-reason per Part 11 R1, not silently dark; born-wired gate satisfied via the connector-registry --check tripwire. |
| T-199-05-02 | Tampering | doctor.cjs edit | mitigate | ADD-ONLY append after the last existing entry; no existing acceptance point's logic touched (mirrors the file's own SCOPE GUARD: ADD-ONLY precedent). |
| T-199-05-SC | Tampering (supply chain) | npm installs | N/A | Zero new dependencies. |
</threat_model>

## Artifacts this phase produces

- `.claude/skills/agentshield/SKILL.md` -- the runner skill (Shape E Action Report render).
- `commands/agentshield.md` -- the `/mos:agentshield` front door, EXCLUDED-with-reason per Part 11.
- `data/connector-registry.json`, `data/command-registry.json` -- regenerated, `--check` clean.
- `scripts/doctor.cjs` -- new Class O acceptance point.

<verification>
`node scripts/doctor.cjs --acceptance --pre-tag` passes the new Class O point on the current clean repo. Both `--check` commands exit 0.
</verification>

<success_criteria>
- `/mos:agentshield` is born WIRED-or-EXCLUDED per Canon Part 11.
- Registries regenerated and clean.
- doctor.cjs Class O passes on the current repo.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-05-SUMMARY.md` when done
</output>
