---
phase: quick-260705-jeq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/command-registration-check.cjs
  - tests/test-command-registration-check.cjs
  - scripts/verify-release
  - scripts/install-pre-commit.sh
  - scripts/doctor.cjs
  - commands/doctor.md
  - tests/test-doctor-report-registration-bug.cjs
  - data/help-groups.json
  - lib/memory/help-renderer.test.cjs
  - tests/test-help-selector-lanes.cjs
  - tests/test-help-cards-render.cjs
  - commands/help.md
  - scripts/help-renderer.cjs
autonomous: false
requirements: [QUICK-260705-JEQ]
must_haves:
  truths:
    - "node scripts/doctor.cjs --report-registration-bug prints a paste-ready Anthropic bug report to stdout, exits 0, and never contains the words 'healthy' or 'fixed' as a status claim (D-01, D-02)"
    - "The report runs every locally-checkable cause (install-cache drift, enabledPlugins silent-disable, legacy config pin, marketplace-clone git dirt, version-of-record legs, on-disk command count, static frontmatter preconditions) and shows each CLEAN or flags it loudly as fix-locally-first"
    - "Bare /mos:help renders Card 1 of 3 family cards; all 11 families are reachable across the 3 cards; a family with more than 4 commands shows the escape-hatch line 'N more in this lane - type /mos:help <family-id> to see all' (D-03, D-05)"
    - "/mos:help <family-id> renders that family's full command list sourced from data/help-groups.json, never from prose duplicated in help.md (D-04)"
    - "node scripts/check-help-coverage.cjs exits 0 after the re-group; the 5 deprecated commands stay off every card (D-06)"
    - "A FAIL-class registration precondition (broken frontmatter fence, tab in YAML, illegal name, case-insensitive collision) blocks both scripts/verify-release and the pre-commit hook"
  artifacts:
    - path: "lib/core/command-registration-check.cjs"
      provides: "Static precondition sweep for command registration, reusable + CLI-runnable"
      exports: ["sweepCommandRegistration"]
    - path: "scripts/doctor.cjs"
      provides: "--report-registration-bug sibling mode"
      contains: "reportRegistrationBug"
    - path: "data/help-groups.json"
      provides: "11 re-grouped families, same command union, deprecated_aliases untouched"
      contains: "\"groups\""
    - path: "commands/help.md"
      provides: "3-card F.1 selector body + family text-list path, zero stale 4-lane claims"
    - path: "tests/test-doctor-report-registration-bug.cjs"
      provides: "Locks the diagnostic-only contract"
    - path: "tests/test-command-registration-check.cjs"
      provides: "Locks FAIL/WARN classes + live-tree-clean invariant"
  key_links:
    - from: "scripts/doctor.cjs"
      to: "lib/core/command-registration-check.cjs"
      via: "require"
      pattern: "command-registration-check"
    - from: "scripts/doctor.cjs --report-registration-bug"
      to: "existing evidence collectors"
      via: "function reuse, no reimplementation"
      pattern: "collectVersionOfRecord|checkPluginEnabled|readLegacyConfigPin"
    - from: "commands/help.md"
      to: "data/help-groups.json"
      via: "help-renderer delegation (loadGroups)"
      pattern: "help-renderer|help-groups"
    - from: "scripts/verify-release"
      to: "lib/core/command-registration-check.cjs"
      via: "release gate invocation"
      pattern: "command-registration-check"
    - from: "scripts/install-pre-commit.sh"
      to: "lib/core/command-registration-check.cjs"
      via: "pre-commit hook invocation (both hook-body copies + the up-to-date grep chain)"
      pattern: "command-registration-check"
---

<objective>
Close the 2026-07-05 commands-registration investigation with two deliverables:

1. **Part 1 (doctor):** a new read-only `scripts/doctor.cjs --report-registration-bug` sibling mode that proves every locally-checkable cause of "commands do not register despite a valid install" is CLEAN and assembles a ready-to-paste Anthropic bug report (root cause is a confirmed Claude Code core bug, host-side, not fixable from this repo - see `.planning/debug/every-mos-command-unknown.md` 2026-07-05 resolution). Includes a reusable static precondition sweep (`lib/core/command-registration-check.cjs`) also wired as a release gate and pre-commit check.
2. **Part 2 (help):** rewrite `commands/help.md` from the stale "4-lane" claim to the real 11 command families as a 3-card F-shape selector (AskUserQuestion contract: max 4 questions/call, max 4 options/question), backed by a re-grouped `data/help-groups.json` as the single source of truth.

Purpose: the navigator never reconstructs this investigation by hand again, and `/mos:help` finally tells the truth about the command surface.
Output: new doctor mode + helper + gates, re-grouped help data, rewritten help.md, updated tests, all suites green.

**Decision IDs used below** (traceability handles for the prose decisions locked in `260705-jeq-CONTEXT.md`, in document order):
- D-01: bug report prints to stdout (JSON via --json, human text otherwise); not a file, not clipboard.
- D-02: NEW read-only reporting mode, not a --fix; never claims "healthy"/"fixed"; labeled escalate-to-Anthropic.
- D-03: escape hatch for >4-command families = one text line under the tab's 4 options; no card-of-cards mechanism.
- D-04: extend data/help-groups.json to the 11 families (re-group, no parallel schema); no hardcoded family list in help.md prose.
- D-05: 3 cards, 4+4+3 split, exact family-to-card grouping as locked; each card its own AskUserQuestion call, not auto-chained.
- D-06: the 5 deprecated commands (heal, hmi-status, query, organize, visualize) stay in deprecated_aliases only, never on a card; do not regress 100% non-admin coverage.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260705-jeq-doctor-diagnostic-for-claude-code-comman/260705-jeq-CONTEXT.md
@.planning/quick/260705-jeq-doctor-diagnostic-for-claude-code-comman/260705-jeq-RESEARCH.md
@.planning/debug/every-mos-command-unknown.md
@.planning/debug/windows-install-update-ux.md
@data/help-groups.json
@scripts/help-renderer.cjs
@scripts/check-help-coverage.cjs
@commands/help.md
@lib/core/check-plugin-enabled.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib/core/command-registration-check.cjs precondition sweep + release/pre-commit gates</name>
  <files>lib/core/command-registration-check.cjs, tests/test-command-registration-check.cjs, scripts/verify-release, scripts/install-pre-commit.sh</files>
  <behavior>
    - sweepCommandRegistration(commandsDir) returns { pass, failures: [{ file, rule, detail }], warnings: [...], scanned }
    - FAIL class (causes silent registration skip): (a) unbalanced frontmatter fences (file must open with a `---` line and have a closing `---` line); (b) tab characters inside the frontmatter block; (c) command name (file basename minus .md) not matching /^[a-z0-9-]+$/; (d) case-insensitive basename collision across commands/*.md
    - WARN class (registers but renders badly): description missing from frontmatter, or longer than 60 chars
    - CLI mode (require.main === module): exit 1 on any FAIL, exit 0 on warnings-only (warnings printed to stderr), scans the repo's commands/ by default, optional dir argument
    - Live-tree invariant: running the sweep against this repo's real commands/ dir today returns pass:true with zero failures (107 files scanned)
  </behavior>
  <action>
    Create `lib/core/command-registration-check.cjs` per the behavior block. This is the "precondition sweep" reconciled from the navigator's independent Windows-side draft - ONE implementation, living in lib/core/ per this repo's existing pattern of reusable checks that doctor.cjs sibling-flag dispatch imports (Canon Part 7). CJS only, Node built-ins only (fs, path), zero network, pure file reads. No `commands` manifest field exists in .claude-plugin/plugin.json (verified in RESEARCH), so the sweep's scope is the auto-discovered commands/*.md set; skip subdirectories (none exist today; a subdirectory found is a WARN, not a FAIL).

    Wire two gates:
    1. `scripts/verify-release`: add a new numbered section (after the existing help-renderer palette section near line 175, following the script's pass/fail helper convention) running `node "$PLUGIN_ROOT/lib/core/command-registration-check.cjs"`; FAIL-class violations call fail() (non-zero release verdict), warnings call warn().
    2. `scripts/install-pre-commit.sh`: add `node .../lib/core/command-registration-check.cjs || { echo "command-registration precondition FAIL - a command would silently not register" >&2; exit 1; }` next to BOTH existing check-help-coverage.cjs call sites (the hook-body template near line 202 and the second copy near line 297), and add `grep -q "command-registration-check.cjs"` to the up-to-date detection chain at line 37 so stale installed hooks are re-offered.

    Test `tests/test-command-registration-check.cjs`: fixture files in a hermetic tmp dir (never the real commands/) covering each FAIL rule, the WARN-only exit-0 path, and one final assertion running the sweep against the REAL commands/ dir expecting zero failures (locks the live tree clean and proves the gate will not brick the next release). No em-dashes anywhere.
  </action>
  <verify>
    <automated>node tests/test-command-registration-check.cjs && node lib/core/command-registration-check.cjs && bash -n scripts/verify-release && bash -n scripts/install-pre-commit.sh</automated>
  </verify>
  <done>Helper exists with FAIL/WARN classes as specified; CLI exit contract holds; both gates invoke it; test suite green including the live-tree-clean assertion.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: doctor.cjs --report-registration-bug sibling mode (D-01, D-02)</name>
  <files>scripts/doctor.cjs, commands/doctor.md, tests/test-doctor-report-registration-bug.cjs</files>
  <behavior>
    - `node scripts/doctor.cjs --report-registration-bug` exits 0 whenever the report assembles (even offline); non-zero only if the assembler itself throws
    - Human output contains: an escalate-to-Anthropic header, an environment-facts section, a ruled-out checklist with one line per local cause, a control-test line, and provenance pointers to the two debug files
    - Output NEVER contains a "healthy" or "fixed" status claim, and never the string "supabase"
    - `--report-registration-bug --json` prints a single valid JSON object with the same facts
    - If any local check is NOT clean, the corresponding line is flagged loudly ("fix locally first - this occurrence may not be the core bug") and the mode still exits 0
  </behavior>
  <action>
    Add the sibling flag following the `--check-rs-engine` precedent exactly (RESEARCH-verified wiring points): `reportRegistrationBug: false` in the parseArgs flags object (line ~105) + an `else if (arg === '--report-registration-bug')` branch (~228); do NOT add it to the `--all` activation block (~255) - copy --check-rs-engine's exclusion-rationale comment; one line in usageText() (~286); early-return dispatch block in main() right after --check-rs-engine (~4354), honoring flags.json inline.

    The assembler is NEW (no bug-report precedent exists in the repo) but every FACT comes from existing collectors - reuse, do not reimplement (Canon Part 7): `checkPluginEnabled()` (lib/core/check-plugin-enabled.cjs), `readInstalledPluginsVersion(home)` (line ~1718; key is the namespaced "mos@mindrian-marketplace" - a bare "mos" lookup misses it), `readLegacyConfigPin(home)`/`resolveLegacyConfigPinEntry(data)` (~1746/1783, handles the nested 3rd-gen schema), `readInstalledPluginsInstallPath(home)` (~1797), `detectMarketplaceCacheInstall(home)` (~1815), `readPathBinVersion(home)` (~1842), `collectVersionOfRecord(home, ...)` (~1865), `computeVersionDivergences(versions)` (~1882), `resolveActivePluginRoot()` (lib/core/active-plugin-root.cjs), and Task 1's `sweepCommandRegistration()`.

    Report sections, in order:
    1. Header: paste-ready Anthropic bug report for the plugin command-registration subsystem; explicit label "diagnostic only - escalate to Anthropic, nothing to fix locally" (D-02).
    2. Environment facts: plugin version legs {IP, AV, SR, LV, PB} + divergences; process.platform + os.release(); Claude Code version via a guarded best-effort `execFileSync('claude', ['--version'])` with a "fill in: run claude --version" placeholder on any failure (report must assemble offline - RESEARCH open question 2 resolved); commands/*.md count at the active plugin root; one manifest line: plugin.json declares NO `commands` field, i.e. the standard auto-discovery contract every surveyed marketplace plugin uses - the failure is in the host's registration of that contract.
    3. Ruled-out checklist, one PASS/CLEAN-or-FLAGGED line each: (a) install-cache drift; (b) enabledPlugins silent-disable (class N); (c) legacy config.json pin vs installed_plugins.json agreement (F11 class); (d) marketplace clone git-dirty state - NEW small guarded probe `execFileSync('git', ['-C', dir, 'status', '--porcelain'])` against the mindrian-marketplace clone dir (path from detectMarketplaceCacheInstall), swallow-and-note if git or the dir is absent; (e) version-of-record legs all agree; (f) command files present on disk; (g) static precondition sweep (Task 1 helper) zero FAILs.
    4. Control-test narrative, GENERIC wording only: "a control test against another installed marketplace plugin's commands reproduced the identical failure" - never name a specific plugin (the earlier supabase control was invalid; the valid control is documented in every-mos-command-unknown.md's 2026-07-05 resolution).
    5. Provenance: pointers to `.planning/debug/every-mos-command-unknown.md` and `.planning/debug/windows-install-update-ux.md` (F8/F11 are ruled-out SIBLING causes, distinct from this core bug).

    Output to stdout only (D-01) - never write a file (and if that ever changes, no `:` in filenames, the F11 Windows backup bug). Use execFileSync with argument arrays, never string-interpolated shell commands. Update `commands/doctor.md`: argument-hint + description mention the new flag; add a short mode section in the body (preserve any `<!-- mos:firing-block v1 -->` marker and the hitl declarations byte-untouched).

    Test `tests/test-doctor-report-registration-bug.cjs`: spawn the mode, assert exit 0; human output contains the escalate label, all 7 ruled-out line markers, the provenance paths; asserts output does NOT match /healthy/i, does NOT match /\bfixed\b/i, does NOT contain "supabase"; --json output JSON.parses and carries the same top-level keys.
  </action>
  <verify>
    <automated>node tests/test-doctor-report-registration-bug.cjs && node scripts/doctor.cjs --report-registration-bug >/dev/null && node scripts/doctor.cjs --acceptance</automated>
  </verify>
  <done>Mode assembles on this machine, exit 0, diagnostic-only contract locked by test, doctor --acceptance still 14/14 (mode is NOT in --all, no class-flag regression), doctor.md documents the flag.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Confirm the reconstructed 11-family command map before it becomes data</name>
  <files>none - approval only; the approved map is written to disk in Task 4</files>
  <action>
    Present the map below to the navigator VERBATIM and wait for approval before any help-groups.json byte changes. Why this checkpoint exists: the verbatim 11-family command list the CONTEXT points to ("enumerated in the quick-task dispatch prompt") did not survive into planning and exists nowhere on disk - only the 11 family NAMES and the card grouping are locked (D-05). The map below is the deterministic reconstruction from the current help-groups.json union (100 commands, union preserved byte-identical so the coverage gate stays green; deprecated 5 and admin 2 excluded per D-06). CONTEXT forbids re-deriving groupings silently, so this map ships only after explicit navigator approval or corrections.

    Proposed map (family id / label / lane / commands):

    **Card 1**
    1. `start-here` "Start Here" (lane start): ignite, new-project, onboard, splash, discover, help, mos, stance
    2. `rooms-data-room` "Rooms & Data Room" (lane start): rooms, room, dashboard, wiki, graph, vault, snapshot, export
    3. `frame-the-problem` "Frame the Problem" (lane methodology): beautiful-question, root-cause, user-needs, analyze-needs, map-unknowns, challenge-assumptions, jtbd
    4. `run-a-methodology` "Run a Methodology" (lane methodology): structure-argument, lean-canvas, value-proposition, mullins, build-thesis, mva-brief, mva-option, mva-report, mos-reason, think-hats, hat-briefing, persona, scenario-plan, compare-ventures, leadership, bono, models, systems-thinking

    **Card 2**
    5. `explore-futures-trends` "Explore Futures & Trends" (lane explore): explore-domains, explore-trends, explore-futures, macro-trends, dominant-designs, futures, trending-to-absurd, diffusion, analyze-timing, whitespace, auto-explore
    6. `intelligence-research` "Intelligence & Research" (lane explore): brain-derive, find-analogies, find-bottlenecks, find-connections, rs-fetch, rs-thesis, rs-experts, rs-explain, research, validate, score-innovation, diagnostics, causal, analyze-systems
    7. `opportunities-funding-meetings` "Opportunities, Funding & Meetings" (lane explore): opportunities, funding, scout, speakers, file-meeting
    8. `present-publish` "Present & Publish" (lane view): publish, present, deck, show

    **Card 3**
    9. `orchestrate-automate` "Orchestrate & Automate" (lane explore): act, pipeline, operator, scheduled-tasks, suggest-next, skill
    10. `memory-state-engine` "Memory, State & Engine" (lane view): memory, memory-cortex-reach, dial-memory-refresh, feynman-timeline-refresh, status, radar, grade, deep-grade, reanalyze, diagnose, explain-decision
    11. `system-maintenance` "System & Maintenance" (lane view): setup, update, doctor, build-knowledge, agentshield, correct-reference-now, ingest-methodology, new-surface

    Glyphs: redistribute the existing 11-glyph set (one per family; e.g. start-here ▶, rooms-data-room ⬡, system-maintenance ⚙; sensible assignment, approved as part of this checkpoint). Every family carries a lane from the existing closed 4-key enum (start|methodology|explore|view) - a bogus lane silently vanishes from the --list view (RESEARCH pitfall 1).
  </action>
  <verify>Navigator reply received: "approved", or corrections listed as "command -> family" moves (any correction must keep the union byte-identical).</verify>
  <done>The final 11-family map (as approved or corrected) is recorded in the executor's working notes and becomes the sole input to Task 4.</done>
  <resume-signal>Type "approved" or list corrections as "command -> family" moves.</resume-signal>
</task>

<task type="auto">
  <name>Task 4: Re-group data/help-groups.json to the approved 11 families + update the binding tests (D-04, D-05, D-06)</name>
  <files>data/help-groups.json, lib/memory/help-renderer.test.cjs, tests/test-help-selector-lanes.cjs, tests/test-help-cards-render.cjs</files>
  <action>
    Rewrite ONLY the `groups[]` array of data/help-groups.json to the Task-3-approved map (ids, labels, glyphs, lane per family, commands redistributed with the union byte-identical to today's 100). Keep the existing schema exactly (D-04: re-group, no parallel schema): version, canon_parts, decisions stay; update `phase` to "quick-260705-jeq" and refresh the `_note` prose to describe families instead of the old group names; `deprecated_aliases` byte-untouched (D-06); `_lanes` byte-untouched (the renderer's LANE_ORDER/LANE_META hardcode those 4 keys). Every family's `lane` MUST be one of start|methodology|explore|view (RESEARCH pitfall 1: an unknown lane silently drops the family from the text view with no error, and the coverage gate will not catch it).

    Update the tests that bind to labels (per RESEARCH's break table), preserving their intent:
    - `lib/memory/help-renderer.test.cjs`: keep `groups.length === 11` and every-non-admin-command-in-exactly-one-group; update the ASCII-output-contains-every-group-label assertion to the 11 new labels.
    - `tests/test-help-selector-lanes.cjs`: should pass unchanged (asserts lanes are in the 4-enum and cover every non-admin command exactly once) - run it, fix only if a fixture pins old ids.
    - `tests/test-help-cards-render.cjs`: should pass unchanged (asserts the 4 _lanes labels + every non-admin command renders) - run it, fix only if pinned to old labels.
    Do NOT weaken any assertion; label updates only. No em-dashes in labels or notes.
  </action>
  <verify>
    <automated>node scripts/check-help-coverage.cjs && node lib/memory/help-renderer.test.cjs && node tests/test-help-selector-lanes.cjs && node tests/test-help-cards-render.cjs && node scripts/help-renderer.cjs 2>/dev/null | head -5</automated>
  </verify>
  <done>help-groups.json carries the approved 11 families; command union unchanged (coverage gate exit 0, 100% non-admin coverage preserved); all three help test suites green; every family visible in the --list text view.</done>
</task>

<task type="auto">
  <name>Task 5: Rewrite commands/help.md to the 3-card F-shape selector + family text-list path (D-03, D-04, D-05)</name>
  <files>commands/help.md, scripts/help-renderer.cjs</files>
  <action>
    **Renderer (small addition, one source of truth per D-04):** add a `--group <id>` CLI flag to scripts/help-renderer.cjs that renders a single family's full command list (label, glyph, each command with its help_jtbd line) as plain scrollable text, reusing loadGroups() and the existing per-command jtbd join; unknown id prints the 11 valid ids and exits 1. Do not touch LANE_ORDER/LANE_META or the default full-list path (verify-release greps this file for the DS palette - keep those lines byte-stable).

    **help.md frontmatter sweep** (RESEARCH pitfall 2 - ALL four stale fields, this is the exact stale-literal drift class fixed elsewhere today): `description` -> an 11-family phrasing, 60 chars or less (Task 1's own WARN rule; e.g. "11-family command map, cards + per-command help"); `help_jtbd` and `teaching` -> drop every "4 lanes"/"one call" claim, describe the 3-card family map; `body_shape_detail` -> "F.1 Next Move (11 families as 3 sequential cards via AskUserQuestion, max 4 questions x 4 options per call)"; `argument-hint` -> "[command-name | family-id | 2 | 3 | --list]". Keep `hitl_shape: "F.1"`, `hitl_why`, `allowed-tools` (AskUserQuestion stays granted), `connector.excluded: true`, and any `<!-- mos:firing-block v1 -->` body marker byte-untouched (it is Phase 209's B3 wired predicate).

    **Body rewrite - the Default selector section:**
    - Bare `/mos:help` = Card 1: ONE AskUserQuestion call, 4 questions (one per Card-1 family, header = family label + glyph), each with up to 4 command options. Options and counts are read from data/help-groups.json at run time - NEVER hardcode family contents or counts in prose (D-04).
    - Escape hatch (D-03): when a family has more than 4 commands, render this exact text line under that tab's options: "N more in this lane - type /mos:help <family-id> to see all". N computed from the data at render time.
    - Card navigation (D-05, cards never auto-chain): after Card 1's call, print one line: 'More families: type "/mos:help 2" (Explore, Intelligence, Opportunities, Present) or "/mos:help 3" (Orchestrate, Memory, System)'. `/mos:help 2` and `/mos:help 3` each render their card as its own single AskUserQuestion call with the same escape-hatch rule.
    - Bare-argument resolution order, stated explicitly in the body (RESEARCH pitfall 5): (1) exact command name -> existing per-command tldr path; (2) family id, with case-insensitive family-LABEL match as a courtesy (RESEARCH open question 3 resolved); (3) literal 2 or 3 -> that card; (4) otherwise the existing unknown-command suggestion path. No family id collides with a command name today; the order makes future collisions deterministic.
    - Family text-list path: `/mos:help <family-id>` delegates verbatim to `node scripts/help-renderer.cjs --group <id>` (same delegation pattern the --list path already uses).
    - Keep unchanged: `--list`/`--all` renderer delegation, per-command help path with admin guard, admin detection, troubleshooting, Larry voice rules (Canon Part 12 - never grade, never compliment).

    After editing, confirm zero stale claims remain: no "4-lane", no "4 lanes", no "one AskUserQuestion call" phrasing anywhere in help.md. No em-dashes.
  </action>
  <verify>
    <automated>node scripts/help-renderer.cjs --group start-here | head -5 && ! grep -qE "4-lane|4 lanes" commands/help.md && ! grep -q -- "—" commands/help.md && node scripts/check-help-coverage.cjs && node scripts/check-shape-declaration.cjs --check && node scripts/check-render-coverage.cjs && bash scripts/verify-release</automated>
  </verify>
  <done>help.md describes and drives the 3-card 11-family selector with the exact escape-hatch line and explicit argument resolution order; family lists come only from help-groups.json via the renderer; all stale 4-lane literals gone; shape-declaration, render-coverage, help-coverage, and the full verify-release gate (now including the Task 1 registration sweep) all green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| doctor mode -> child processes | shells out to `git` and `claude --version` |
| bug report -> external paste target | report text leaves the machine when the navigator pastes it to Anthropic |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jeq-01 | Tampering/Elevation | doctor child-process probes | mitigate | execFileSync with argument arrays only, never string-interpolated shell; both probes guarded try/catch with placeholder fallback |
| T-jeq-02 | Information Disclosure | assembled bug report | mitigate | report carries only versions, counts, paths under ~/.claude, and platform facts - never room content, env secrets, or user data (Canon Part 8 boundary untouched: zero Brain wire in this task) |
| T-jeq-SC | Tampering | npm/pip/cargo installs | accept | no package installs in this task (Node built-ins only); no legitimacy gate needed |
</threat_model>

<verification>
Full-pass after all tasks:
- `node tests/test-command-registration-check.cjs && node tests/test-doctor-report-registration-bug.cjs`
- `node scripts/doctor.cjs --acceptance` (14/14, unchanged - new mode is NOT in --all)
- `node scripts/check-help-coverage.cjs && node lib/memory/help-renderer.test.cjs && node tests/test-help-selector-lanes.cjs && node tests/test-help-cards-render.cjs`
- `bash scripts/verify-release` exit 0 (proves the new gate does not brick the next cut)
- `! grep -rqE "—" commands/help.md commands/doctor.md lib/core/command-registration-check.cjs` (no em-dashes)
</verification>

<success_criteria>
- Both deliverables shipped from ONE reconciled implementation set (no second competing checker): doctor mode imports the same sweep the release gate and pre-commit hook run.
- `--report-registration-bug` is diagnostic-only, stdout-only, generic control-plugin wording, provenance-linked, offline-safe.
- `/mos:help` reflects the real 11 families across 3 cards with the locked escape hatch, sourced solely from help-groups.json; coverage stays 100% non-admin; the 5 deprecated commands stay off cards.
- All existing gates green; no assertion weakened; no em-dashes.
</success_criteria>

<output>
Create `.planning/quick/260705-jeq-doctor-diagnostic-for-claude-code-comman/260705-jeq-SUMMARY.md` when done.

**Follow-up seeds to record in the SUMMARY (explicitly OUT of this task's scope - do not build now):**
1. `check-stale-literals.cjs` sweep - the deeper pattern behind every bug found this session is a hardcoded literal drifting from an auto-discovered source of truth (the "45 commands" banner literal, the "4-lane" help claim, the swallowed "vunknown"). A sibling sweep that inventories such literals is a suggested SEED for a future quick task.
2. F8 loud-restart cue after plugin update (still open in windows-install-update-ux.md).
3. F11 item (b): /mos:update reconcile-or-retire of the legacy config.json (still open).
</output>
