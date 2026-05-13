# /mos: Command Frontmatter Contract

> The `/mos:` command frontmatter is the single source of truth for the framework <-> command mapping. This doc is the contract. Phase 122 (Workflow Layer) added the five keys below on top of the existing `name` / `description` / `serves_jtbd` / `allowed-tools` / `body_shape` / `argument-hint` / `ui_reference` fields. It sits next to `skills/ui-system/SKILL.md` -- the command-side analogue of the UI ruling system.
>
> See also: `docs/WORKFLOWS.md` -- the closed-loop picture (the Brain <-> registry <-> Larry join, the five reliability rules, the Canon Part 8 boundary, the resolver/recommender surface).

---

## 1. Why this exists

`frameworks:` in each command's frontmatter is the SOLE place the framework-to-command mapping is declared (reliability rule 1, see `.planning/WORKFLOW-LAYER-SPEC.md`). Nothing else -- no skill, no doc, no hardcoded map in `lib/core/` -- may assert it. `data/command-registry.json` is GENERATED from this frontmatter by `scripts/build-command-registry.cjs` (Phase 122-02); it is never hand-written. A CI tripwire (the pre-commit hook and the Feynman test runner) fails the build if (a) the committed registry is stale vs. the command frontmatter, or (b) a command declares a `frameworks:` entry that is not a resolvable Brain framework name (validated against `data/framework-names.json`, the FEEDS_INTO-linked subset mirrored from a Brain query at build time).

Commands NEVER enter the Brain (Canon Part 8 -- the Graph Boundary). The Brain is a repository of strategic thinking tools, not user data and not plugin internals. The command registry is plugin-local: it is validated AGAINST the Brain's framework names, never written back. `data/framework-names.json` is the only Brain-derived artifact in this loop, and it carries only generic `:Framework` node names -- no user content, no plugin commands.

This extends the existing command frontmatter; it does not introduce a new metadata store. The same `commands/*.md` files that `lib/core/frontmatter-schemas.cjs` and `scripts/frontmatter-schema-validator.cjs` already parse gain five new keys -- nothing more.

## 2. The five new keys

| Key | Type | Required | Meaning |
|-----|------|----------|---------|
| `kind` | enum: `methodology` \| `utility` \| `meta` | yes | `methodology` = real work over the room graph + Brain (not template-fill). `utility` = `/mos:status`, `/mos:help`, `/mos:rooms`, etc. `meta` = orchestrators: `/mos:pipeline`, `/mos:act`, `/mos:suggest-next`. |
| `frameworks` | array of strings | yes | The EXACT Brain `:Framework` name(s) this command runs. `[]` for `utility` and `meta`. Copy the exact string from the Brain -- see section 4. |
| `produces` | string (room artifact glob) or `null` | yes | The room artifact pattern this command writes, e.g. `room/market-analysis/jtbd-analysis/*`. `null` for `utility`/`meta`. |
| `inputs` | array of strings | yes | The expected room state for this command to be useful, e.g. `["a customer segment defined"]`. `[]` is valid. |
| `autonomous_safe` | boolean | yes | May `/mos:act` run this command unattended? `false` = it needs a human in the loop (e.g. a synthesis or decision step). |

All five are required on every command file. `methodology` commands have a non-empty `frameworks` list; `utility` and `meta` commands have `frameworks: []` (no false framework claims).

## 3. The two YAML examples

### A `kind: methodology` command (analyze-needs)

```yaml
---
name: analyze-needs
description: Score customer jobs with importance and satisfaction
# --- existing fields stay: serves_jtbd, allowed-tools, body_shape, argument-hint, ui_reference ---
serves_jtbd: ["find-problem"]
# --- NEW Phase 122 fields ---
kind: methodology                              # methodology | utility | meta
frameworks: ["Jobs to Be Done (JTBD)"]         # EXACT Brain :Framework name(s); [] for utility/meta
produces: "room/market-analysis/jtbd-analysis/*"
inputs: ["a customer segment defined", "at least one job-to-be-done hypothesis"]
autonomous_safe: true                          # may /mos:act run it unattended?
allowed-tools: [Read, Write, Bash, Glob]
---
```

### A `kind: meta` command (pipeline)

```yaml
---
name: pipeline
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
---
```

### `teaching` (new in Phase 104.1)

Larry-voice 1-2 sentence explanation of when to invoke this command. Used by Phase 125 F-Selector Ranker to render investment-aware "why" strings (low-investment users see this; high-investment users see the terser `jtbd_summary` derived from taxonomy; mid-band sees both stitched).

**Constraints:**
- 1-2 sentences (sentence count <= 2; terminal punctuation: `.`, `!`, `?`)
- 50-300 characters total
- NO em-dashes (project hard rule; use double-hyphens `--` or hyphens)
- Larry-voice: pedagogical tone; ledes with WHY before WHAT; avoids undefined jargon
- Self-contained: a fresh user should know whether to invoke after reading

**Lede patterns (lean):**
- "When you [job], [framework] [transform]"
- "In the [situation], [command] [output]"
- "Most [users/teams] [problem]; [command] [solution]"

**Example:**
```yaml
teaching: "When you need to find which assumption is most fragile, the Devil's Advocate stress-tests the case against itself. Best when an idea feels too clean to be true."
```

### `jtbd_label` and `jtbd_summary` (derived, NOT authored)

These two registry fields are NEVER written into per-command frontmatter. The Phase 104.1 build script extension (`scripts/build-command-registry.cjs`) derives both at registry-build time from the JTBD taxonomy via `serves_jtbd[0]` per Canon Part 7 (Reuse Before Build).

- `jtbd_label` = capitalize+space-replace of `serves_jtbd[0]` (e.g., `find-bottleneck` -> `Find Bottleneck`)
- `jtbd_summary` = `lib/hmi/jtbd-taxonomy.json` entry's `one_line` field, verbatim

If `serves_jtbd` is absent or empty, both fields are null in the registry. Phase 125 Plan 05 ranker fails-closed on null per its D6.

## 4. Picking the right framework name

The string in `frameworks:` must be the EXACT name of the Brain `:Framework` node -- specifically a node that is FEEDS_INTO-linked (the traversable subset, about 105 of the 748 nodes). Near-duplicates exist: `"JTBD"` vs. `"Jobs to Be Done (JTBD)"` vs. `"Jobs-to-be-Done"` -- only one of those resolves. A wrong string FAILS the build, with the list of close matches printed, so a wrong guess is caught at commit time, not shipped.

`frameworks: ["Amazon"]` (a junk `:Framework` node that exists in the graph but is not a methodology) MUST fail the tripwire -- the allowlist is the FEEDS_INTO-linked subset, not all 748 nodes.

Cross-reference `data/framework-names.json` (shipped by 122-02) once it exists; until then, for a name not in the short FEEDS_INTO-linked list confirmed live in `.planning/phases/122-workflow-layer/122-RESEARCH.md` Lens 2, pick the cleanest canonical form -- the 122-02 generator `--check` mode will catch a wrong one.

FEEDS_INTO-linked names confirmed live (copy the exact string):
`Beautiful Question Framework`, `Domain Selection`, `Jobs to Be Done (JTBD)`, `Six Thinking Hats`, `PWS Value Proposition`, `Cynefin Framework`, `Systems Thinking`, `Root Cause Analysis`, `S-Curve Analysis`, `Lean Canvas`, `Reverse Salient Analysis`, `Wicked Problem Detection Framework`, `Scenario Planning`, `Red Teaming`, `PWS Triple Validation Compass`, `Knowns and Unknowns Matrix Framework`, `The Pyramid Principle`, `MECE`, `HSI Semantic Surprise Analysis Assistant`.

## 5. The cohort-first retrofit rule

The algorithmic cohort -- HSI (`/mos:score-innovation`), whitespace (`/mos:whitespace`), explore-domains (`/mos:explore-domains`, `/mos:explore-trends`, `/mos:macro-trends`), deep research + Six Hats (`/mos:research`, `/mos:think-hats`, `/mos:persona`, `/mos:hat-briefing`, `/mos:scenario-plan`), the reverse-salient pipeline (`/mos:rs-fetch`, `/mos:rs-experts`, `/mos:rs-thesis`, `/mos:rs-explain`, `/mos:find-bottlenecks`), cross-domain pattern engines (`/mos:find-connections`, `/mos:find-analogies`, `/mos:compare-ventures`), diagnostics (`/mos:diagnostics`, `/mos:diagnose`, `/mos:causal`, `/mos:mos-reason`, `/mos:root-cause`), scoring / grading (`/mos:analyze-needs`, `/mos:user-needs`, `/mos:validate`, `/mos:validate-proposition`, `/mos:grade`, `/mos:deep-grade`, `/mos:mullins`), systems / timing (`/mos:systems-thinking`, `/mos:analyze-systems`, `/mos:analyze-timing`, `/mos:dominant-designs`, `/mos:explore-futures`), and argument / knowledge (`/mos:structure-argument`, `/mos:build-thesis`, `/mos:build-knowledge`, `/mos:map-unknowns`, `/mos:beautiful-question`, `/mos:lean-canvas`) -- gets retrofitted FIRST. These are the commands whose chaining unlocks the most value.

Utility commands (`/mos:status`, `/mos:help`, `/mos:rooms`, `/mos:organize`, ...) and meta orchestrators (`/mos:pipeline`, `/mos:act`, `/mos:suggest-next`) get `kind: utility` / `kind: meta` and `frameworks: []`; they are not on the critical path for the retrofit ordering.

## 6. Forward references

After Phase 122, `docs/THE-BRAIN.md` and `skills/pws-methodology/SKILL.md` point here for the framework <-> command mapping rule. `docs/WORKFLOWS.md` (Phase 122-05) documents the Brain <-> registry <-> Larry join end to end. The 122-02 generator (`scripts/build-command-registry.cjs`) reads this contract; the 122-03 resolver (`lib/workflow/command-resolver.cjs`) reads only the generated `data/command-registry.json` at runtime.
