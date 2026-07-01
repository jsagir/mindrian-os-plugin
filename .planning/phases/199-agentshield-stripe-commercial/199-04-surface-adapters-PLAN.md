---
phase: 199-agentshield-stripe-commercial
plan: 04
type: execute
wave: 2
depends_on: [199-03]
files_modified:
  - lib/core/security/agentshield-run.cjs
autonomous: true
requirements: [AS-03, AS-04]

must_haves:
  truths:
    - "Five gatherers exist (gatherMcpToolDescriptions, gatherHookCommands, gatherSkillFiles, gatherClaudeMdPermissions, gatherSupplyChainTargets), each reading a REAL plugin surface and returning {surface, id, target} entries -- no gatherer hardcodes a scanning decision, it only produces targets for scanSurface()"
    - "runAgentShieldScan(opts) calls scanSurface() once per gathered target across all 5 non-brain surfaces, aggregates into one report shaped for a Shape E Action Report render"
    - "A live self-scan of the current MindrianOS-Plugin repo returns zero flagged findings on every surface (dog-fooding proof, Canon Part 6)"
  artifacts:
    - path: lib/core/security/agentshield-run.cjs
      provides: "the 5 gatherers + runAgentShieldScan() orchestrator"
      exports: ["gatherMcpToolDescriptions", "gatherHookCommands", "gatherSkillFiles", "gatherClaudeMdPermissions", "gatherSupplyChainTargets", "runAgentShieldScan"]
  key_links:
    - from: "lib/core/security/agentshield-run.cjs"
      to: "lib/core/security/agentshield-scanner.cjs"
      via: "require + scanSurface() call per gathered target"
      pattern: "scanSurface\\("
---

<objective>
Build the I/O layer that gathers real bytes from the plugin's own five non-Brain surfaces (.mcp.json + MCP server source, hooks/hooks.json, .claude/skills + skills/ SKILL.md files, CLAUDE.md + .claude/rules, package.json dependencies) and feeds them through the 199-03 engine, then aggregates into one scan report.

Purpose: separates "what to scan" (this plan) from "how to classify" (199-03), following the interface-first ordering rule -- the engine stays pure and surface-agnostic, the gatherers own all filesystem I/O.
Output: `lib/core/security/agentshield-run.cjs`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@lib/core/security/agentshield-scanner.cjs
@lib/core/security/agentshield-adapters.test.cjs
@.mcp.json
@hooks/hooks.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: mcp + hook + skill gatherers</name>
  <files>lib/core/security/agentshield-run.cjs</files>
  <read_first>
    .mcp.json; hooks/hooks.json; .claude/skills/docu-optimizer/SKILL.md (a real
    skill file to confirm the glob target shape);
    lib/core/security/agentshield-adapters.test.cjs (the contract to satisfy).
  </read_first>
  <action>
    Implement gatherMcpToolDescriptions() -- reads .mcp.json's `mcpServers`
    map, and for each configured server's entry-point file (bin/mindrian-mcp-server.cjs,
    bin/mindrian-brain-mcp-client.cjs) statically extracts `description:`
    string literals via a bounded regex scan of the source text (a STATIC
    extraction, NOT a live MCP handshake -- this plan never starts a server),
    returning one `{surface:'mcp_tool_description', id:'&lt;serverName&gt;.&lt;line-or-index&gt;', target:&lt;description string&gt;}`
    per match. Implement gatherHookCommands() -- reads hooks/hooks.json, walks
    every hook-type array, extracts each `command` string, returns one entry
    per hook with `id` = hook-type + array-index. Implement gatherSkillFiles()
    -- globs `.claude/skills/*/SKILL.md` and `skills/*/SKILL.md`, returns one
    entry per file with `target` = full file contents and `id` = the relative
    path. Wire all three into `scanSurface()` from 199-03 and confirm each
    produces the expected verdict on the CURRENT repo state (all clean
    expected); if a legitimate pattern in the SHIPPED codebase trips a false
    positive, narrow the offending references/security/cve-db.json rule
    (mirror 196-03's real fix where a shared pattern over-blocked a legitimate
    author name) rather than special-casing the gatherer.
  </action>
  <verify>
    <automated>node lib/core/security/agentshield-adapters.test.cjs</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    All three gatherers exported, produce &gt;=1 real entry each against the
    live repo, and every entry currently scans clean.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: claudemd + supply-chain gatherers + orchestrator</name>
  <files>lib/core/security/agentshield-run.cjs</files>
  <read_first>
    CLAUDE.md; package.json; evals/plurai/199-baseline.json (parity target
    reference).
  </read_first>
  <action>
    Implement gatherClaudeMdPermissions() -- reads CLAUDE.md (project root)
    plus any `.claude/rules/*.md`, returns one entry per file with `target` =
    full file contents (the claudemd_permission rules fire on the whole file,
    since the attack class is "a permission-granting line ANYWHERE in the
    file", not a per-line concern). Implement gatherSupplyChainTargets() --
    reads package.json's `dependencies`, returns one
    `{surface:'supply_chain', id:name, target:{name, version}}` per
    dependency. Implement `runAgentShieldScan(opts)` -- calls all 5 gatherers,
    runs `scanSurface()` on every produced target, and returns
    `{ scannedAt: &lt;ISO timestamp&gt;, surfaces: { &lt;surface&gt;: { verdict: 'clean'|'flagged'|'ambiguous' (worst-of across that surface's entries: flagged &gt; ambiguous &gt; clean), findingCount } }, totalFlagged, totalAmbiguous, findings: [ {surface, id, ruleId, reason} ] (non-clean entries only) }`.
    Do NOT gather or scan brain_egress here -- that surface is already
    exercised at the classify()/PreToolUse-hook layer shipped by Phase 196;
    AgentShield's orchestrator covers the 5 NEW surfaces only, per this
    phase's own scope.
  </action>
  <verify>
    <automated>node lib/core/security/agentshield-adapters.test.cjs; bash tests/run-all-199.sh</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    runAgentShieldScan() returns the documented shape; a live self-scan of the
    current repo is clean on every surface; all 12 package.json dependencies
    resolve VETTED/clean per cve-db.json's allowlist.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| gatherer file reads | Gatherers read .mcp.json, hooks/hooks.json, SKILL.md files, CLAUDE.md, package.json -- all plugin-local, repo-tracked files. No user room data, no Brain wire. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-04-01 | Tampering | gatherers read, never write, the scanned surfaces | mitigate by construction | No gatherer opens any file in write mode. |
| T-199-04-02 | Elevation of Privilege | hook-command gathering | mitigate | gatherHookCommands extracts the command STRING only; it never executes it. |
| T-199-04-03 | Denial of Service | glob over .claude/skills and skills/ | accept | Repo-local glob, bounded by the plugin's own file count, one directory level only. |
| T-199-04-SC | Tampering (supply chain) | npm installs | N/A | Zero new dependencies. |
</threat_model>

## Artifacts this phase produces

- `lib/core/security/agentshield-run.cjs` -- 5 real-file gatherers + the `runAgentShieldScan()` orchestrator, producing one aggregated report across all 5 non-Brain surfaces.

<verification>
`node lib/core/security/agentshield-adapters.test.cjs` fully green including the live self-scan assertion. `bash tests/run-all-199.sh` shows the adapters leg PASSED.
</verification>

<success_criteria>
- 5 gatherers + orchestrator implemented and exported.
- Live self-scan of the current repo is clean on every surface.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-04-SUMMARY.md` when done
</output>
