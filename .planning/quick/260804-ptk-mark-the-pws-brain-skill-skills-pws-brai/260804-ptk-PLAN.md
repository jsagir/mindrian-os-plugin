---
phase: quick-260804-ptk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/pws-brain.md
  - skills/pws-brain/SKILL.md
autonomous: true
requirements: [QUICK-PWS-BRAIN-RETIRE-01]

must_haves:
  truths:
    - "A navigator opening the pws-brain surface learns, before any mechanics, that both compared routes are superseded and that the live backend is the unified pws-brain-mcp Memgraph service"
    - "The retirement is stated in three places a reader or a tool can reach it: the frontmatter description, the connector.reason, and a note directly under the H1"
    - "The unified backend is named concretely (pws-brain-mcp, https://pws-brain-mcp.onrender.com) with its in-repo proof point (lib/core/brain-client.cjs BRAIN_URL default)"
    - "The comparison-harness mechanics (Part 8 Boundary, Pre-flight, Run the comparison, Present the report, Zone 4) survive intact as historical reference, not deleted"
    - "skills/pws-brain/SKILL.md stays a byte-valid generated mirror of commands/pws-brain.md, so build-skill-mirrors --check stays green"
    - "No runtime file changes: lib/core/brain-client.cjs and every other .cjs is byte-identical to before this plan"
    - "The four blocker gates (mirrors, connector, projection, render) are green after the edit, not merely assumed green"
    - "Zero em-dashes in either touched file"
  artifacts:
    - path: "commands/pws-brain.md"
      provides: "The SOURCE-OF-TRUTH retirement marking: rewritten frontmatter description, rewritten connector.reason, and a retirement note under the H1"
      contains: "pws-brain-mcp"
    - path: "skills/pws-brain/SKILL.md"
      provides: "The regenerated mirror carrying the identical retirement marking"
      contains: "pws-brain-mcp.onrender.com"
  key_links:
    - from: "commands/pws-brain.md"
      to: "skills/pws-brain/SKILL.md"
      via: "node scripts/build-skill-mirrors.cjs (commands/ is the single source of truth; the skill is GENERATED)"
      pattern: "pws-brain-mcp"
    - from: "skills/pws-brain/SKILL.md"
      to: "lib/core/brain-client.cjs"
      via: "named citation of the hardcoded BRAIN_URL default as the proof the migration already shipped"
      pattern: "brain-client\\.cjs"
---

<objective>
Mark the pws-brain evaluation harness as RETIRED / superseded, and point navigators at the
unified pws-brain-mcp Memgraph backend instead of a two-way comparison against a backend pair
that no longer represents production.

Purpose: the harness compares Route A (`mindrian-brain` MCP over Neo4j plus Pinecone) against
Route B (`neo4j-agent` Aura Agent over the same Neo4j graph). Both routes were superseded by the
2026-07-22 Memgraph migration. `lib/core/brain-client.cjs` already hardcodes
`https://pws-brain-mcp.onrender.com` as its `BRAIN_URL` default, so a navigator running this
harness today measures a backend pair production no longer uses and reads the result as if it
were live truth.

Output: `commands/pws-brain.md` edited at the source, `skills/pws-brain/SKILL.md` regenerated
from it. Docs-only. Zero runtime code touched.
</objective>

<critical_finding>
## The task brief says "edit skills/pws-brain/SKILL.md". Editing that file directly BREAKS a release gate.

`skills/pws-brain/SKILL.md` is a **GENERATED MIRROR**, not a hand-authored file. It is one of 111
mirrors produced by `scripts/build-skill-mirrors.cjs` from `commands/pws-brain.md`, which is the
documented **single source of truth** (see that script's header: "WHY commands/ STAYS THE SINGLE
SOURCE OF TRUTH (read-only here)"). The mirror exists to work around a confirmed Windows
Claude Code command-registration host bug.

Proof, verified at plan time:
- `node scripts/build-skill-mirrors.cjs --check` returns exit 0:
  `OK (111 mirrors match expected content; skip-list verified: trending-to-absurd)`
- The only skip-listed (genuinely hand-authored) skill is `trending-to-absurd`. `pws-brain` is
  NOT skip-listed, so it is generated.
- The staleness gate is a **blocker** in two places: `scripts/verify-release:327` and the
  `doctor --acceptance` gate list (`scripts/doctor.cjs`, id `skill-mirrors`).

So a direct edit to `skills/pws-brain/SKILL.md` would desync it from its command and turn the
release gate red. The intent of the brief is honored exactly; only the mechanism changes:
**edit `commands/pws-brain.md`, then regenerate the mirror.** Both files end up carrying the
retirement marking, which is what the brief asked for.

The "no runtime files" constraint is fully honored: `commands/pws-brain.md` is a markdown
surface definition, not runtime code. `lib/core/brain-client.cjs` is read-only reference here.

### What does NOT go stale (verified at plan time, so do not regenerate it)

- `data/command-registry.json` bakes only `body_shape`, `serves_jtbd`, `teaching`, `jtbd_label`,
  `jtbd_summary`, and structural fields for `/mos:pws-brain`. It does **not** bake `description`
  or `connector.reason`. This plan leaves `teaching`, `body_shape`, and `serves_jtbd` unchanged,
  so the registry stays in sync. Confirmed: `node scripts/build-command-registry.cjs --check`
  returns `command-registry: OK`.
- `data/connector-coverage-ledger.json` stores only `{surface, source, state, class}` for
  pws-brain (`state: excluded`, `class: utility-excluded`). It does not store the reason string,
  and this plan does not change `excluded: true`, so the state is unchanged.
- `data/brain-orchestration-projection.json` stores only `{id, kind, methodology_tier, name}`.

### Explicitly OUT OF SCOPE (deliberate calls, not oversights)

- **`dist/` bundles are NOT regenerated.** `dist/generic-claude-dir/.claude/skills/pws-brain/SKILL.md`
  and `dist/zed/.agents/skills/pws-brain/SKILL.md` are git-tracked and generated from `skills/`,
  but `node scripts/build-dist-bundles.cjs --check-stale` reports the bundle **already stale at
  baseline for an unrelated reason**: "generated from 1.15.3-beta.51, the live plugin is
  1.16.0-beta.8". Regenerating would sweep a large version-wide diff across 111+ skills into a
  docs-only quick task. No gate blocks on dist staleness (`build-dist-bundles` appears in neither
  `verify-release` nor `release.sh`). Leave it to the next release cut.
- **`teaching:` is left unchanged.** It already reads "An evaluation harness, not a production
  surface," which stays accurate, and changing it would force a `data/command-registry.json`
  regeneration for no gain.
- **`CHANGELOG.md` is not touched.** Flagging for the navigator: retiring a navigator-visible
  surface is arguably changelog-worthy at the next beta cut. Out of scope per the task brief's
  explicit file constraint; say the word to add it.
</critical_finding>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# The file to edit (SOURCE OF TRUTH)
@commands/pws-brain.md

# The generated mirror (regenerate, never hand-edit)
@skills/pws-brain/SKILL.md

# Read-only reference: proves the Memgraph migration already shipped (do NOT edit)
@lib/core/brain-client.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mark the retirement in commands/pws-brain.md (source of truth)</name>
  <files>commands/pws-brain.md</files>
  <action>
Make exactly three edits to `commands/pws-brain.md`. Do NOT touch
`skills/pws-brain/SKILL.md` in this task (Task 2 regenerates it). Do NOT delete any existing
section. Preserve the file's existing voice and its numbered/H2 section structure. No em-dashes
anywhere (repo hard rule, use hyphens).

**Edit 1 - frontmatter `description`.** Replace the existing single-line `description:` value
with a value that opens with the retirement state, names both superseded routes, and names the
replacement. Keep it a single double-quoted YAML scalar on one line (the frontmatter parser in
`scripts/build-command-registry.cjs` handles simple scalars only, so do not convert it to a
block scalar). Target content:

  RETIRED TEST HARNESS (superseded 2026-07-22): compared the then-production mindrian-brain MCP
  against the neo4j-agent Aura Agent over Neo4j. Both routes are superseded by the unified
  pws-brain-mcp Memgraph backend. Kept for deliberate historical re-runs only.

**Edit 2 - `connector.reason`.** Replace the existing `reason:` value under the `connector:`
block. It must stay a single double-quoted YAML scalar on one line (a missing or unparseable
reason is a hard build error in `scripts/build-connector-registry.cjs`, D-172-a "no surface dark
by accident"). Keep `excluded: true` unchanged and keep the closing Part 11 R1 clause verbatim so
the CIRS classification still reads correctly. Target content:

  RETIRED evaluation harness (declared 2026-07-16, superseded 2026-07-22). It compared the
  then-production mindrian-brain backend against the neo4j-agent Aura Agent candidate over the
  same live Neo4j graph. BOTH routes are now superseded by the unified pws-brain-mcp Memgraph
  backend (https://pws-brain-mcp.onrender.com), already the hardcoded BRAIN_URL default in
  lib/core/brain-client.cjs. Kept on disk as historical reference for a deliberate re-run; fires
  no reach, opens no spine wire, never sensor-triggered (Part 11 R1 EXCLUDED-with-reason, mirrors
  /mos:agentshield).

Leave the `# --- Quick-260716-VFT CIRS R1 exclude (Canon Part 11) ---` comment block above
`connector:` as-is.

**Edit 3 - retirement note in the body.** Insert a blockquote note immediately after the
`# /mos:pws-brain` H1 and BEFORE the existing `**EXPERIMENTAL.**` paragraph. Do not modify or
delete the `**EXPERIMENTAL.**` paragraph or anything after it. The note must: state RETIRED/STALE
with the 2026-07-22 date, state that BOTH Route A and Route B are superseded, name the unified
`pws-brain-mcp` Memgraph backend with its URL `https://pws-brain-mcp.onrender.com`, cite
`lib/core/brain-client.cjs`'s hardcoded `BRAIN_URL` default and its 2026-07-22 Memgraph-migration
header as the in-repo proof, tell the reader NOT to run this to learn how the Brain behaves, and
state that everything below is preserved as historical reference for a deliberate re-run.

Do NOT change `teaching:`, `body_shape:`, `body_shape_detail:`, `serves_jtbd:`, `hitl_shape:`,
`hitl_why:`, `help_jtbd:`, `argument-hint:`, `allowed-tools:`, or `disable-model-invocation:`.
Changing `teaching`, `body_shape`, or `serves_jtbd` would stale `data/command-registry.json`.
  </action>
  <verify>
    <automated>test -z "$(grep -n '—' commands/pws-brain.md)" && grep -q 'pws-brain-mcp.onrender.com' commands/pws-brain.md && grep -q 'RETIRED' commands/pws-brain.md && grep -q 'brain-client.cjs' commands/pws-brain.md && grep -q '^## Part 8 Boundary (LOCKED)' commands/pws-brain.md && grep -q '^## Run the comparison' commands/pws-brain.md && grep -q '^## Zone 4 (Action Footer)' commands/pws-brain.md && node -e "const fs=require('fs');const t=fs.readFileSync('commands/pws-brain.md','utf8');const m=t.match(/^---\n([\s\S]*?)\n---\n/);if(!m)throw new Error('no frontmatter');const fm=m[1];for(const k of ['teaching:','body_shape:','serves_jtbd:'])if(!fm.includes(k))throw new Error('lost '+k);if(!/excluded:\s*true/.test(fm))throw new Error('excluded flipped');if(!/reason:\s*\"/.test(fm))throw new Error('reason not a quoted scalar');console.log('frontmatter OK')"</automated>
  </verify>
  <done>
`commands/pws-brain.md` carries the retirement in its `description`, its `connector.reason`, and
a blockquote note under the H1. All five original H2 sections still present. `excluded: true`,
`teaching`, `body_shape`, and `serves_jtbd` unchanged. Zero em-dashes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Regenerate the skill mirror and clear all four blocker gates</name>
  <files>skills/pws-brain/SKILL.md</files>
  <action>
Regenerate the generated mirror from the edited source, then prove every gate that this change
can reach is green. Never hand-edit `skills/pws-brain/SKILL.md`.

1. Run `node scripts/build-skill-mirrors.cjs` (no flags) to regenerate all mirrors from
   `commands/`. Expect only `skills/pws-brain/SKILL.md` to change; the generator applies the two
   documented exception classes (DESENSITIZE, SKILL-SPEC NORMALIZATION), which is why the skill
   carries `license:`/`compatibility:` fields and a flattened `allowed-tools:` line that the
   command does not. That divergence is correct and expected; do not try to reconcile it.

2. Confirm the diff is exactly the two intended files and nothing else:
   `git status --porcelain` must list only `commands/pws-brain.md` and
   `skills/pws-brain/SKILL.md`. If any `data/*.json`, `dist/**`, or `lib/**` file appears,
   STOP and report rather than committing it. In particular `lib/core/brain-client.cjs` must be
   untouched.

3. Run the four blocker gates plus the command-registry check. All must exit 0:
   - `node scripts/build-skill-mirrors.cjs --check`
   - `node scripts/build-connector-registry.cjs --check`
   - `node scripts/build-orchestration-projection.cjs --check`
   - `node scripts/check-render-coverage.cjs`
   - `node scripts/build-command-registry.cjs --check`

   The connector gate is the one most likely to speak up, because it walks BOTH `commands/*.md`
   and every `skills/<name>/SKILL.md` and hard-fails on `excluded:true` with no reason. If it
   fails, the cause is almost certainly a malformed `reason:` scalar in Task 1 (an unescaped
   inner double quote, or the value wrapped onto a second line). Fix the YAML in
   `commands/pws-brain.md`, re-run step 1, then re-run the gates.

4. Advisory only, not a blocker: `node scripts/check-shape-declaration.cjs --check` should stay
   at its baseline. It WARNs rather than blocks (Phase 210, item 210-A).

Do NOT run `node scripts/build-dist-bundles.cjs` (see the OUT OF SCOPE note: the bundle is
already stale from unrelated version drift and regenerating sweeps a large unrelated diff).
  </action>
  <verify>
    <automated>node scripts/build-skill-mirrors.cjs --check && node scripts/build-connector-registry.cjs --check && node scripts/build-orchestration-projection.cjs --check && node scripts/check-render-coverage.cjs && node scripts/build-command-registry.cjs --check && grep -q 'pws-brain-mcp.onrender.com' skills/pws-brain/SKILL.md && grep -q 'RETIRED' skills/pws-brain/SKILL.md && test -z "$(grep -n '—' skills/pws-brain/SKILL.md)" && test -z "$(git status --porcelain | grep -v -E 'commands/pws-brain\.md|skills/pws-brain/SKILL\.md')" && git diff --quiet -- lib/core/brain-client.cjs && echo ALL_GATES_GREEN</automated>
  </verify>
  <done>
`skills/pws-brain/SKILL.md` is a regenerated, in-sync mirror carrying the retirement marking.
All four blocker gates plus the command-registry check exit 0. `git status --porcelain` lists
exactly two files. `lib/core/brain-client.cjs` is byte-identical.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigator -> Brain backend | The retired harness sends navigator-authored question text to two external MCP backends. This plan changes no send path, but it is the reason the Part 8 screen in the body must survive intact. |
| repo source -> generated artifacts | `commands/` is the source of truth; `skills/`, `data/*.json`, and `dist/**` are generated. A hand-edit to a generated file silently desyncs the tree. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ptk-01 | Tampering | `skills/pws-brain/SKILL.md` | mitigate | Never hand-edit the mirror. Task 2 regenerates via `build-skill-mirrors.cjs` and proves sync with `--check`, the same gate that blocks `verify-release` and `doctor --acceptance`. |
| T-ptk-02 | Denial of Service (build) | `connector.reason` YAML scalar | mitigate | `build-connector-registry.cjs` hard-fails on `excluded:true` with a missing/unparseable reason (D-172-a). Task 1 constrains the value to a single quoted scalar; Task 2's gate run proves it parses. |
| T-ptk-03 | Information Disclosure | Part 8 Brain boundary | accept | This plan is docs-only and adds no send path. The existing Part 8 GENERIC-ONLY screen and both Pre-flight availability checks are explicitly preserved, so the boundary the harness already enforced is unchanged. |
| T-ptk-04 | Repudiation | stale `dist/**` bundles | accept | Bundles already stale at baseline from unrelated version drift (1.15.3-beta.51 vs 1.16.0-beta.8); no gate blocks on it. Documented as an explicit deferred call rather than a silent gap; resolves at the next release cut. |
| T-ptk-SC | Tampering | npm/pip/cargo installs | mitigate | Not applicable: this plan installs zero packages and changes zero dependency manifests. |
</threat_model>

<verification>
Run from `/home/jsagi/dev/MindrianOS-Plugin/` (WORKSPACE GUARD: never the `~/.claude/plugins/`
install cache).

1. `node scripts/build-skill-mirrors.cjs --check` -> exit 0, "111 mirrors match expected content"
2. `node scripts/build-connector-registry.cjs --check` -> exit 0
3. `node scripts/build-orchestration-projection.cjs --check` -> exit 0
4. `node scripts/check-render-coverage.cjs` -> exit 0
5. `node scripts/build-command-registry.cjs --check` -> `command-registry: OK`
6. `grep -n '—' commands/pws-brain.md skills/pws-brain/SKILL.md` -> no output
7. `git status --porcelain` -> exactly two entries, both pws-brain surface files
8. `git diff --quiet -- lib/core/brain-client.cjs` -> exit 0 (runtime untouched)
9. Read `skills/pws-brain/SKILL.md`: the retirement note sits under the H1, and the Part 8
   Boundary, Pre-flight, Run the comparison, Present the report, and Zone 4 sections are all
   still present.
</verification>

<success_criteria>
- Both `commands/pws-brain.md` and the regenerated `skills/pws-brain/SKILL.md` state RETIRED /
  superseded in the frontmatter `description`, in `connector.reason`, and in a note under the H1.
- Both name `pws-brain-mcp` and `https://pws-brain-mcp.onrender.com` as the unified replacement,
  and cite `lib/core/brain-client.cjs`'s hardcoded `BRAIN_URL` default as the in-repo proof.
- All five comparison-harness sections survive as historical reference; nothing deleted.
- All four blocker gates plus the command-registry check exit 0.
- Exactly two files changed. Zero runtime code touched. Zero em-dashes.
</success_criteria>

<output>
Create `.planning/quick/260804-ptk-mark-the-pws-brain-skill-skills-pws-brai/260804-ptk-SUMMARY.md` when done.

The summary MUST record the architectural finding for future sessions: `skills/*/SKILL.md` are
GENERATED MIRRORS of `commands/*.md` (111 of them, only `trending-to-absurd` is hand-authored and
skip-listed). Any future task phrased as "edit skills/<name>/SKILL.md" must edit
`commands/<name>.md` and regenerate, or it turns the `build-skill-mirrors --check` release gate
red.
</output>
