# Quick Task 260705-jeq: Doctor registration-bug diagnostic + /mos:help 11-family reshape - Research

**Researched:** 2026-07-05
**Domain:** doctor.cjs mode architecture + help-groups.json machinery (this repo)
**Confidence:** HIGH (every claim below verified by direct file read in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Part 1: `--report-registration-bug` prints the assembled bug-report text to stdout (JSON via `--json`, human text otherwise). Not a file, not clipboard.
- Part 1: NEW read-only reporting mode, NOT a `--fix` action. Never claims "healthy"/"fixed"; explicitly labeled escalate-to-Anthropic.
- Part 2: escape hatch for >4-command families is a text line under each tab's 4 options: "N more in this lane - type /mos:help <family-name> to see all". No third card-of-cards mechanism.
- Part 2: extend `data/help-groups.json`'s existing group structure to the corrected 11 families (rename/re-group, no parallel schema). One source of truth; no hardcoded family list in help.md prose.
- Part 2: 3 cards, 4+4+3 split. Card 1 = Start Here / Rooms & Data Room / Frame the Problem / Run a Methodology. Card 2 = Explore Futures & Trends / Intelligence & Research / Opportunities Funding & Meetings / Present & Publish. Card 3 = Orchestrate & Automate / Memory State & Engine / System & Maintenance. Each card its own AskUserQuestion call, not chained automatically.
- Deprecated: the 5 deprecated commands (heal, hmi-status, query, organize, visualize) stay in `deprecated_aliases` only; never on a card; do not regress the 100% non-admin coverage.

### Specifics
Full 11-family -> command list is enumerated verbatim in the quick-task dispatch prompt; use it as-is, do not re-derive.

### Canonical References
- `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md`, `.planning/debug/windows-install-update-ux.md` (F8, F11) - provenance only; this task's root cause (Claude Code core registration bug, confirmed 2026-07-05) is DISTINCT from F11.
- AskUserQuestion contract (verified this session): max 4 questions/call, max 4 options/question.
</user_constraints>

## Summary

Both surfaces are small, well-factored, and extendable without schema invention. The help machinery already has exactly 11 groups (so the change is a re-group/rename, not a count change - one test even locks `groups.length === 11`), and doctor.cjs has a proven "sibling flag with own dispatch + own exit contract" pattern (`--check-rs-engine`, `--claims`, `--bind-check`) that the new reporting mode should copy verbatim. There is NO existing bug-report assembler anywhere in the repo - build the text assembler fresh, but source every fact from doctor's existing evidence-collector functions (Part 7 reuse).

**Primary recommendation:** Part 1 = new sibling flag dispatched early in `main()` reusing `collectVersionOfRecord` + `checkPluginEnabled` + `readLegacyConfigPin` + `detectMarketplaceCacheInstall`. Part 2 = rewrite the 11 `groups[]` entries in help-groups.json (keeping the `lane` field valid) + rewrite help.md's body + frontmatter prose; the coverage gate needs zero code change.

## Surface 1: help machinery (data + renderer + gate + command)

### data/help-groups.json (219 lines) - exact current schema

Top-level: `{ version: 1, phase, canon_parts[], decisions[], _note, groups[], deprecated_aliases{}, _lanes{} }`.

Each group: `{ id, label, glyph, commands: [bare-names], lane }` where `lane` is one of the closed enum `start | methodology | explore | view` (`_lanes` maps lane key -> display label).

**Current groups are ALREADY 11:** getting-started, problem-discovery, structured-thinking, perspectives, intelligence-brain, working, reviewing, export, publish, hub, infrastructure. So the 11-family rewrite is a pure re-group: rename ids/labels/glyphs and redistribute the same command union. **Data-only change, no schema change.**

`deprecated_aliases` (keys: heal, query, organize, hmi-status, visualize -> redirect strings) doubles as the machine-checked exclusion registry. Leave untouched.

### scripts/help-renderer.cjs (237 lines) - how it consumes the data

- `loadGroups()` parses the JSON; `renderHelpCards(groups, useColor)` is the single text-view path (truecolor and ASCII are the same layout).
- **Lane keys are load-bearing:** `LANE_ORDER = ['start','methodology','explore','view']` (line 99) and `LANE_META` (line 100) hardcode the 4 lanes' colors/glyphs. `commandsForLane()` (line 134) filters groups strictly by `g.lane` - **a group whose `lane` value is not one of the 4 known keys silently vanishes from the text view.** Pitfall #1 below.
- Group labels/glyphs render as sub-headers inside their lane (line 203-206), so the new 11 family labels surface in the text view automatically once the data is edited.
- Deprecated commands are skipped at render time via frontmatter `deprecated: true` (line 126-129) - durability layer independent of the data file.
- Per-command `help_jtbd:` is joined from each `commands/<name>.md` frontmatter.

### scripts/check-help-coverage.cjs (189 lines) - what the gate validates

Six checks, none lane-aware, none group-count-aware: (a) every commands/*.md has `help_jtbd`; (b) every non-admin, non-deprecated command appears in SOME group; (c) no group entry references a nonexistent file; (d) every `deprecated: true` command is a `deprecated_aliases` key; (e) no deprecated command inside a group; (f) no `deprecated_aliases` key without a file. Wired into pre-commit (scripts/install-pre-commit.sh:202). **A re-group that preserves the command union passes with zero code change.**

### commands/help.md (143 lines) - what the rewrite replaces

Frontmatter today: `name: help`, `description` claims **"4-lane command map"**, `help_jtbd` claims "4 lanes", `argument-hint: "[command-name | --list]"`, `body_shape: F.1`, `hitl_shape: "F.1"`, `hitl_why`, `body_shape_detail: F.1 Next Move (two-axis lanes-as-tabs via one AskUserQuestion call)`, `teaching` claims "4 lanes", `allowed-tools` includes AskUserQuestion + Skill, `connector.excluded: true`.

Body today: ONE AskUserQuestion call with up to 4 questions (one per lane); pagination via a `More ->` 4th option (3+1 pattern) per lane; `--list`/`--all` -> renderer verbatim; per-command help path (`/mos:help [command]`, tldr card, admin guard); admin detection; troubleshooting; voice rules. Line 60 already says "11 canonical groups (10 user-facing + Infrastructure)".

Rewrite touches: `description`, `help_jtbd`, `teaching`, `body_shape_detail` (stale "4-lane"/"one call" claims - the exact stale-copy bug class), the "Default" selector section (3 cards of family-tabs replacing 4 lane-tabs + `More ->` pagination), `argument-hint` gains the `<family-name>` path, and a new "family text list" section for `/mos:help <family-name>`. `hitl_shape: F.1` stays (check-shape-declaration.cjs only requires presence). Keep: renderer delegation, per-command help, admin detection, voice rules.

### Tests that will break on re-group (must be updated in the same task)

| Test | Assertion that binds |
|------|----------------------|
| `lib/memory/help-renderer.test.cjs` | `groups.length === 11` (fine); every non-admin command in exactly one group; **ASCII output contains every group label** - labels change |
| `tests/test-help-selector-lanes.cjs` | every group's `lane` in the closed 4-enum; lanes cover every non-admin command exactly once |
| `tests/test-help-cards-render.cjs` | all 4 `_lanes` labels appear; every non-admin command renders in both modes |
| `tests/test-help-coverage-gate.cjs`, `lib/memory/help-coverage.test.cjs` | coverage-gate fixtures (union-based, likely unaffected) |

Also `scripts/verify-release:174-194` greps help-renderer.cjs for the DS palette (unaffected by a data-only change).

## Surface 2: doctor.cjs mode/flag architecture (5,415 lines)

### Two flag species

1. **Class flags (A-R):** results land in `report.checks[...]`, rendered by `renderHumanReport(report)` (line 3644) / `computeSummary` (3857), class-flag-always-exit-0 invariant, activated by `--all`.
2. **Sibling flags with OWN dispatch + own exit contract:** dispatched in `main()` (line 4153) BEFORE the class-flag block, each an early-return `if (flags.X) { ...; process.exit(...); return; }` block. Existing precedents: `--bind-check` (4164), `--acceptance` (4210), `--claims` (4285), `--dogfood-acceptance` (4298), `--check-rs-engine` (4340), `--post-update` (4371), standalone `--brain-smoke` (4409). Each honors `flags.json` inline (JSON.stringify the result object) vs human text lines.

**The new `--report-registration-bug` fits the sibling pattern exactly** (like `--check-rs-engine`: a self-contained probe, "NOT in --all because --all is for class A-M drift detection"). Wiring points:

- `parseArgs` (line 105): add `reportRegistrationBug: false` to the flags object + one `else if (arg === '--report-registration-bug')` branch (line ~228). Do NOT add to the `--all` activation block (line 255).
- `usageText()` (line 286): add one flag line.
- `main()`: add the dispatch block early (recommended: right after `--check-rs-engine` at ~4354, before `--post-update`). Print report, `process.exit(0)` always when the report assembles (diagnostic-only per locked decision; exit non-zero only if the assembler itself throws, mirroring the `--check-rs-engine` catch shape).
- `commands/doctor.md`: `argument-hint` (line 5) + description need the new flag; body gets a short mode section.

### Evidence collectors already present (Part 7 - reuse, do not rebuild)

| Function | Line | Returns |
|----------|------|---------|
| `checkPluginEnabled()` (lib/core/check-plugin-enabled.cjs) | ext | `{ installed, enabled, key, settings_path }` - the class N silent-disable signal |
| `readInstalledPluginsVersion(home)` | 1718 | modern installed_plugins.json version (key `"mos@mindrian-marketplace"` - a bare "mos" grep misses it) |
| `resolveLegacyConfigPinEntry(data)` / `readLegacyConfigPin(home)` | 1746/1783 | legacy plugins/config.json pin (handles the nested `repositories.<mp>.plugins.<plugin>.version` 3rd-gen schema) - the F11 signal |
| `readInstalledPluginsInstallPath(home)` | 1797 | resolved install path |
| `detectMarketplaceCacheInstall(home)` | 1815 | cache topology |
| `readPathBinVersion(home)` | 1842 | PATH bin version |
| `collectVersionOfRecord(home, resolverResult, record)` | 1865 | `{ IP, AV, SR, LV, PB }` string legs |
| `computeVersionDivergences(versions)` | 1882 | pairwise disagreement list |
| `resolveActivePluginRoot()` (lib/core/active-plugin-root.cjs) | ext | the active install root (count `commands/*.md` there for the report) |

### Bug-report precedent: NONE exists

`grep -ril "bug.report|ready-to-paste|github issue"` across scripts/, lib/, commands/ returns nothing. Closest human-report shapes: `renderActionReport` in scripts/post-update-activation.cjs and the `--acceptance` PASS/FAIL point lines. **Build the assembler fresh**; its value is the ruled-out checklist:

The report's diagnostic logic = "valid install, yet commands did not register." The mode should run the known local-cause detectors and show each is CLEAN, so what remains is the core bug: (1) class A install-cache drift - clean; (2) class N `enabledPlugins` silent-disable - enabled; (3) F11 `legacy-config-pin-drift` (already a Class I finding since quick 260705-f6k, same day) - agree; (4) marketplace clone `~/.claude/plugins/marketplaces/mindrian-marketplace` git-dirty check (the Linux 2026-07-05 sub-cause from the bisect file item A.3) - note: doctor has the paths but no existing git-status probe for the marketplace clone; small new helper (`git -C <dir> status --porcelain`, guarded); (5) version-of-record legs all agree; (6) command file count present on disk at the active root. Then environment facts: plugin version, command count, OS/platform, Claude Code version if obtainable (open question 3), and pointers to the two prior debug files for provenance.

## Manifest verification (focus question)

- `.claude-plugin/plugin.json` (21 lines): **confirmed - NO `commands` field.** Only name/description/version/author/homepage/repository/license/keywords. Claude Code auto-discovers `commands/`.
- No installed third-party plugin declares one either: elevenlabs stt/tts and plurai evals manifests (checked in `~/.claude/plugins/marketplaces/`) all omit `commands` - auto-discovery is the universal path in practice.
- The field DOES exist as documented spec: the official plugin-dev skill (`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md`, ~line 222) documents optional `"commands": "./custom-commands"` (string or array of relative `./` paths) that SUPPLEMENTS default auto-discovery. Useful contrast line for the bug report: the plugin follows the mainstream auto-discovery contract that every surveyed plugin uses; the failure is in the host's registration of that contract.

## Common Pitfalls

1. **Renderer silently drops mis-laned groups.** `commandsForLane()` filters on the 4-key lane enum; a re-grouped family given a bogus/absent `lane` vanishes from the `--list` text view with no error (the coverage gate won't catch it - it's not lane-aware, but `tests/test-help-selector-lanes.cjs` Assertion 1 will). Every one of the 11 new families MUST carry a valid `lane` from the existing 4-key set.
2. **Stale hardcoded copies in help.md frontmatter.** `description`, `help_jtbd`, `teaching`, `body_shape_detail` all say "4 lanes"/"one AskUserQuestion call" - this is the exact drift class the CONTEXT forbids reintroducing. Sweep all four fields, not just the body.
3. **installed_plugins.json key is namespaced.** Match the full `"mos@mindrian-marketplace"` key (F11 recurrence note: a plain "mos" grep misses it). `readInstalledPluginsVersion` already handles this - another reason to reuse it.
4. **Do not add the new flag to `--all`.** `--all` is the class A-M drift roster; `--check-rs-engine` documents the exclusion rationale to copy.
5. **help.md `<family-name>` vs `[command-name]` argument collision.** The per-command help path already claims the bare-argument slot; the family-list path must check family ids first (or command names first - pick one and state it), since none of the 11 family names collide with a command name today, but the resolution order must be explicit in the body.
6. **Windows-safe file ops if the mode writes anything.** It shouldn't (stdout only, locked decision) - but if a temp/backup ever creeps in, no `:` in filenames (the F11 --fix backup bug, fixed same day).

## Open Questions

1. **Where the confirmed core-bug evidence lives.** CONTEXT asserts the Claude Code core registration bug was confirmed 2026-07-05 and is distinct from F11/marketplace-clone drift, but no on-disk debug file yet documents that distinct confirmation (bisect item A.3 documents the Linux marketplace-clone sub-cause; F11 recurrence documents the Windows legacy-pin sub-cause, with the "loader confused by disagreeing version records -> partial/inconsistent registration" theory flagged OPEN at windows-install-update-ux.md:141). Recommendation: the planner should source the bug-report template's narrative text from the dispatch prompt / navigator session, and the report should link both debug files as ruled-out siblings.
2. **Capturing the Claude Code version in the report.** doctor.cjs never shells to `claude`. Options: `claude --version` via child_process (guarded, best-effort), or omit with a "fill in: run claude --version" placeholder line. Recommendation: best-effort probe with placeholder fallback - the report must still assemble offline.
3. **Whether `/mos:help <family-name>` should also accept the family label** (e.g. "Start Here") vs only the id. Recommendation: accept id, match label case-insensitively as a courtesy; the escape-hatch line prints the exact accepted token.

## Sources (all HIGH confidence - direct reads this session)

- `data/help-groups.json`, `scripts/help-renderer.cjs`, `scripts/check-help-coverage.cjs`, `commands/help.md`, `commands/doctor.md`, `.claude-plugin/plugin.json` - full reads
- `scripts/doctor.cjs` lines 1-330 (parseArgs/usage), 1706-1966 (evidence collectors), 3644+ (renderHumanReport), 4153-4420 (main dispatch), 5100-5203 (class N + finalize)
- `lib/core/check-plugin-enabled.cjs` (exports), `scripts/install-pre-commit.sh`, `scripts/verify-release` (gate wiring)
- Tests: `lib/memory/help-renderer.test.cjs`, `tests/test-help-selector-lanes.cjs`, `tests/test-help-cards-render.cjs`
- `.planning/debug/every-mos-command-unknown.md`, `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` (A.3 confirmed item), `.planning/debug/windows-install-update-ux.md` (F8/F11/F13)
- `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/plugin-structure/references/manifest-reference.md` (official `commands` field spec); elevenlabs + plurai installed manifests (contrast)
