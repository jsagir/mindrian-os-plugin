# Phase 390: Re-run of the Phase 385 no-caller scan and the caller matrix

**Written:** 2026-11-08 by plan 390-02 (wave 1, read-only). Changes no product file.
**Raw output:** `390-scan-output.txt` in this folder (verbatim stdout, not edited after it was written).
**Evidence tags:** PROVEN = I ran the command in this session. UNVERIFIED = not run or not observable here. ASSUMED = taken from another record.
**Rule for the reader:** this record is the first pass of a caller proof (D-08). It is a cost indicator. It is NOT a cut verdict. Every cut still needs the owner card, a per-module ruling (D-04) and a Desktop and Cowork check (D-08, D-09).

## 1. Run

| Item | Value |
|------|-------|
| Command | `nice -n 19 node .planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-no-caller-scan.cjs > 390-scan-output.txt` (no argument, stdout only) |
| Working directory | `/home/jsagi/dev/MindrianOS-Plugin-release` (branch main) |
| HEAD when the raw file was written | `1960c31e90b8d65dd62999c0b58ee87a02734748` (docs(389-02)) |
| Exit code | 0 (PROVEN) |
| Date | 2026-11-08 |
| Re-runs | Runs at HEADs `fb6266d83` (lib/core scanned 566), `09b721ce8`, `ce0babce7` and `e7c2d736d` (567) gave the same dead-set counts. The raw file was rewritten at `1960c31e9` because commit `e7c2d736d` (389-03) added a new script, `scripts/pyramid-seed-run.cjs`, which the scan lists as test-only (see "Difference"). PROVEN, each run diffed against the previous output. |
| Tree state | Phase 389 executors commit to this tree while this plan runs. The scan reads tracked files. The lib/core dead-set counts did not move during the plan. The `scanned:` lines and the scripts scope test-only line move whenever a 389 commit adds a module or a script that has no production caller yet. A fresh scan after a later 389 commit can differ from the raw file for that reason only. |

Counts. The baseline column is the planner baseline at HEAD `dcbe73eee` (written into plan 390-02).

| Scope and line | This run (HEAD 09b721ce8) | Planner baseline (dcbe73eee) | Same |
|----------------|---------------------------|------------------------------|------|
| lib/core scanned | 568 | 565 | no (+3) |
| lib/core no-reference | 0 (0 lines) | 0 | yes |
| lib/core test-only | 18 (4268 lines) | 18 (4268 lines) | yes |
| lib/core closure extra | 2 (260 lines) | 2 (260 lines) | yes |
| lib/core dead set | 20 modules, 4528 lines | 20, 4528 | yes |
| scripts plus lib/hmi plus lib/workflow scanned | 376 | 374 | no (+2) |
| scripts scope no-reference | 8 (2004 lines) | 8 (2004 lines) | yes |
| scripts scope test-only | 39 (15190 lines) | 38 (14963 lines) | no (+1, 227 lines) |
| scripts scope closure extra | 9 (4640 lines) | 9 (4640 lines) | yes |
| scripts scope total | 56 modules, 21834 lines | 55, 21607 | no (+1, 227 lines) |

**Difference.** The lib/core dead set is equal to the baseline. The scripts scope dead set has one extra test-only script. Everything else is the `scanned:` lines.

- lib/core scanned +3. Three new production modules were added after the baseline commit. `lib/core/radar/changelog-slice.cjs` came with `198ed4ddd` (Phase 391-01). `lib/core/pyramid-seed-record.cjs` came with `09b721ce8` (Phase 389-05). `lib/core/pyramid-seed-cells.cjs` came with `e7c2d736d` (Phase 389-03). None enters the dead set. The first is loaded by `scripts/radar-changelog-slice.cjs`, which `commands/radar.md` runs. The second is named by path only in prose (`commands/ignite.md` lines 60 and 92, `commands/new-project.md` line 64 and the skill copies), not by a `require`; the scan counts a prose path as a reference, so it is in the same class as `session-register` (section 4). The third is required by `scripts/pyramid-seed-run.cjs:221`. The last two belong to Phase 389 and are not 390 candidates. PROVEN by `git diff --name-status dcbe73eee HEAD`, `git grep` and the absence of all three names in the raw file.
- scripts scanned +2. `scripts/radar-changelog-slice.cjs` came with `7dce93392` (Phase 391-03); `commands/radar.md` line 67 runs it, so it is not dead. `scripts/pyramid-seed-run.cjs` came with `e7c2d736d` (Phase 389-03). Nothing in a production file names it yet (only its own test), so the scan lists it as test-only (227 lines). It is in-flight Phase 389 work: a later 389 plan is expected to wire it. It is NOT a 390 candidate (D-12). Without it the scripts scope equals the baseline. PROVEN.
- `git diff --name-status dcbe73eee HEAD -- lib/core scripts lib/hmi lib/workflow` before the 389-05 commit listed exactly these additions (plus edits to existing files and no deletion). PROVEN.

## 2. lib/core dead set (copied from the raw file)

18 test-only modules, 4268 lines.

| Module | Lines |
|--------|-------|
| behavioral/observation-schema | 86 |
| card-fire-gate | 107 |
| coverage-monitor | 183 |
| cross-room-triggers | 222 |
| expert-genesis | 437 |
| futures/subsystem-render | 164 |
| graph-refine-loop | 194 |
| ignite-branch-gate | 66 |
| metrics/larryreach-loop-health | 142 |
| navigation/memory-cortex-packet | 274 |
| nl-graph-queries | 187 |
| reader/ab-harness | 177 |
| recovery/controller | 1008 |
| salient-governance | 315 |
| synthetic-expert-behavior-gate | 99 |
| synthetic-expert-construction-gate | 170 |
| temporal/supersession-gate | 290 |
| tone-filter | 147 |

2 closure extras, 260 lines: planning/artifact-brain-packet (212), ralph-loop-gate (48). Dead set total: 20 modules, 4528 lines.

## 3. Reconciliation with 385-PROOF section 10 and audit section G

385-PROOF section 10 recorded: 562 scanned, 2 no-reference (deep-links, platform-gates), 19 test-only (4392 lines), 2 closure (260 lines), 23 modules and 4854 lines in the dead set. Audit section G (HEAD 4b74ae939) recorded 565 scanned, 0 no-reference, 18 test-only, 2 closure, 20 in the dead set.

| Module | 385-PROOF s10 | This run | Verdict | Reason |
|--------|---------------|----------|---------|--------|
| deep-links (no-reference) | listed | absent | GONE | removed by `aea41ed9f` (385-04) |
| platform-gates (no-reference) | listed | absent | GONE | removed by `633e41708` (385-05) |
| behavioral/observation-schema | test-only | test-only | SAME | |
| card-fire-gate | test-only | test-only | SAME | |
| coverage-monitor | test-only | test-only | SAME | |
| cross-room-triggers | test-only | test-only | SAME | |
| expert-genesis | test-only | test-only | SAME | |
| futures/subsystem-render | test-only | test-only | SAME | |
| graph-refine-loop | test-only | test-only | SAME | |
| ignite-branch-gate | test-only | test-only | SAME | |
| metrics/larryreach-loop-health | test-only | test-only | SAME | |
| navigation/memory-cortex-packet | test-only | test-only | SAME | |
| nl-graph-queries | test-only | test-only | SAME | |
| part8-sprout-shape | test-only (124 lines) | absent | GONE | wired into production, see below |
| reader/ab-harness | test-only | test-only | SAME | |
| recovery/controller | test-only | test-only | SAME | |
| salient-governance | test-only | test-only | SAME | |
| synthetic-expert-behavior-gate | test-only | test-only | SAME | |
| synthetic-expert-construction-gate | test-only | test-only | SAME | |
| temporal/supersession-gate | test-only | test-only | SAME | |
| tone-filter | test-only | test-only | SAME | |
| closure: planning/artifact-brain-packet | closure | closure | SAME | |
| closure: ralph-loop-gate | closure | closure | SAME | |
| any module new to the dead set | n/a | none | NEW: none | |

**part8-sprout-shape (PROVEN by git log and git grep).** The file came with `f16751402` (feat 386-37, "sprout and body shape test (no verdict change)"), 2026-11-06 09:51. At that time only tests loaded it, so the 385 scan listed it as test-only. Commit `e7dc09253` (feat 386-42, 2026-11-06 12:58, "the context-based split route and the typed sprouts_required outcome") added `lib/core/part8-split-route.cjs`, which requires it at lines 90 and 192. `lib/core/part8-egress-guard.cjs` line 1322 also requires it. The file now has production callers, so it left the dead set. The list lost exactly one name and 124 lines: 4392 minus 124 gives 4268, which equals the new test-only total. Note on the recorded HEAD: 385-PROOF section 12 names HEAD `361463852` for its scan, but `f16751402` is not an ancestor of `361463852` (it came 30 seconds later). So the sha in 385-PROOF section 12 is not the tree that the section 10 scan saw. The sha of that scan is UNVERIFIED; the order of events above is PROVEN.

The scanned total moved from 562 to 568. The exact arithmetic is UNVERIFIED because the tree of the 385 scan is not known. Between `361463852` and HEAD, `git diff --name-status` shows these production adds in lib/core: doctor/eureka-engine-readiness-module, eureka/eureka-engine-enable, eureka/eureka-engine-requirements, eureka/eureka-engine-resolver, part8-outage-log, part8-split-route, part8-sprout-shape, pyramid-seed-cells, pyramid-seed-record, radar/changelog-slice, web-path-gate. It shows these deletions: deep-links, pinecone-inference, platform-gates, room-type-detector.

**385-PROOF R9 still holds for every row.** R9 says "keep all, delete none without a per-module ruling" (385-PROOF section 10, restated in 390-CONTEXT D-04). All 18 test-only modules and both closure extras are still in the tree and still unwired. This plan keeps all of them. A cut needs a new per-module ruling (OD-1, OD-2, OD-3, OD-14).

## 4. Caller matrix

26 rows: the 13 orphan names of the PRD, `navigation/synthetic-expert` as the live control, and the 12 dead-set modules the table did not cover. Measured at HEAD `09b721ce8`; re-run at `ce0babce7`, `e7c2d736d` and `1960c31e9` gave the same 26 rows (PROVEN).

### Commands

Every count is a number of tracked files, from `git grep -l -P` (PROVEN). The module's own file is dropped from every count. Shell variables used below: `$K` is the key, `$B` is the last segment of the key.

- Pattern for a top-level module: `(?<![A-Za-z0-9_-])$B(?![A-Za-z0-9_-])`. Pattern for a module in a sub folder: `(?<![A-Za-z0-9_-])(FOLDER(/|['"]\s*,\s*['"])$B)(?![A-Za-z0-9_-])`, so that both `recovery/controller.cjs` and `path.join(..., 'recovery', 'controller.cjs')` match and the generic base name `controller` alone does not.
- Exclusions (E) for NR, CODE, PROSE, HOOK, DESKTOP and MCPB: `':(exclude)tests' ':(exclude)evals' ':(exclude)docs' ':(exclude).planning' ':(exclude)r-and-d' ':(exclude)dist' ':(exclude)CHANGELOG.md' ':(exclude,glob)**/*.test.cjs' ':(exclude,glob)**/test-*'`.
- NR: `git grep -l -P "require\(.*PATTERN" -- . E`
- CODE: `git grep -l -P PATTERN -- lib scripts bin hooks E`
- PROSE: `git grep -l -P PATTERN -- commands skills agents pipelines data teams references templates E`
- HOOK: `git grep -l -P PATTERN -- hooks/hooks.json settings.json .mcp.json .claude-plugin`
- DESKTOP: `git grep -l -P PATTERN -- ui lib/mos-face lib/mcp E`. MCPB: `git grep -l -P PATTERN -- mcp-server-brain E`
- TESTS: `git grep -l -P PATTERN -- tests evals ':(glob)**/*.test.cjs' ':(glob)**/test-*'`
- RD: `git ls-files r-and-d | grep -E "/$B\.(cjs|ts|js)$"`
- Scan class: read from `390-scan-output.txt`.
- Extra check for a place the columns do not cover: the same pattern over the whole tracked tree minus the folders above gave one hit in total, `lab/plurai-suite/judges.cjs:34`, a comment that names `lib/core/methodology-ingest.cjs`. For the 12 sub folder modules, a search for the bare file name with an extension (`$B.cjs`, `$B.ts`, `$B.js`) in all production files found no form that the folder pattern misses.

### Matrix

| key | scan class | NR | CODE | PROSE | HOOK | DESKTOP | MCPB | TESTS | RD | verdict |
|-----|-----------|----|------|-------|------|---------|------|-------|----|---------|
| expert-genesis | test-only | 0 | 1 | 0 | 0 | 0 | 0 | 1 | yes | COMMENT-ONLY |
| grill-engine | not in dead set | 0 | 1 | 0 | 0 | 0 | 0 | 4 | no | COMMENT-ONLY |
| fusion-router | not in dead set | 0 | 3 | 2 | 0 | 0 | 0 | 5 | no | COMMENT-ONLY |
| nl-graph-queries | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 1 | no | TEST-ONLY |
| methodology-ingest | not in dead set | 0 | 1 | 4 | 0 | 0 | 0 | 2 | no | WIRED-IN-PROSE-ONLY |
| ralph-loop-gate | closure | 0 | 2 | 0 | 0 | 0 | 0 | 4 | no | COMMENT-ONLY |
| tone-filter | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 1 | no | TEST-ONLY |
| voice-transition-detector | not in dead set | 0 | 1 | 0 | 0 | 0 | 0 | 1 | no | COMMENT-ONLY |
| cross-room-triggers | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 1 | no | TEST-ONLY |
| coverage-monitor | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 1 | no | TEST-ONLY |
| session-register | not in dead set | 0 | 1 | 2 | 0 | 0 | 0 | 2 | no | WIRED-IN-PROSE-ONLY |
| synthetic-expert-construction-gate | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 4 | no | TEST-ONLY |
| synthetic-expert-behavior-gate | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 4 | no | TEST-ONLY |
| navigation/synthetic-expert | not in dead set | 3 | 4 | 0 | 0 | 0 | 0 | 8 | no | LIVE |
| behavioral/observation-schema | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 2 | no | TEST-ONLY |
| card-fire-gate | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 3 | no | TEST-ONLY |
| futures/subsystem-render | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 3 | no | TEST-ONLY |
| graph-refine-loop | test-only | 0 | 4 | 2 | 0 | 0 | 0 | 4 | no | WIRED-IN-PROSE-ONLY |
| ignite-branch-gate | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 3 | no | TEST-ONLY |
| metrics/larryreach-loop-health | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 1 | no | TEST-ONLY |
| navigation/memory-cortex-packet | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 5 | no | TEST-ONLY |
| reader/ab-harness | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 2 | no | TEST-ONLY |
| recovery/controller | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 3 | no | TEST-ONLY |
| salient-governance | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 4 | no | TEST-ONLY |
| temporal/supersession-gate | test-only | 0 | 0 | 0 | 0 | 0 | 0 | 3 | no | TEST-ONLY |
| planning/artifact-brain-packet | closure | 0 | 1 | 0 | 0 | 0 | 0 | 1 | no | COMMENT-ONLY |

Deciding lines for each row whose verdict is not TEST-ONLY (read, not counted):

- expert-genesis: `lib/core/synthetic-expert-construction-gate.cjs:40` is a comment ("derived from the domain/subdomain lens (expert-genesis.cjs ..."). The file that holds it is itself in the dead set. RD yes: a copy exists under `r-and-d/breakthrough-engines/engines/bono/lib/core/expert-genesis.cjs`, so a cut does not orphan the copy but the copy is a separate file.
- grill-engine: `lib/core/part8-egress-guard.cjs:1168` and `:1241` are comments ("grill-engine bias techniques"). No runtime link. The four test files are `tests/test-205-grill-engine.cjs`, `tests/test-213-part8-boundary.cjs` (line 51 loads it through `require(path.join(REPO, 'lib', 'core', 'grill-engine.cjs'))`, a Part 8 boundary test), `tests/test-213-touchpoints.cjs` and `tests/test-355-direction-readers.cjs`.
- fusion-router: CODE lines are comments (`lib/core/eureka/lateral-engine-adapter.cjs:7` and `:9`, `lib/core/eureka/portfolio-dimensions.cjs:28`, `lib/core/navigation/typed-frame.cjs:520`). The two PROSE hits (`commands/find-analogies.md:153`, `skills/find-analogies/SKILL.md:144`) name "the fusion-router never-fabricate rule" inside a sentence about honesty. It is a rule name, not an instruction to call the module. So not a wire.
- methodology-ingest: `commands/ingest-methodology.md:25`, `:70`, `:74` and `skills/ingest-methodology/SKILL.md:22`, `:67`, `:71` say the engine is `lib/core/methodology-ingest.cjs` and that the command is "WIRED". The two registry hits (`data/connector-registry.json`, `data/brain-orchestration-projection.json`) hold the string `methodology-ingest` as a `sub_mode` name, not a path. The one CODE hit is `scripts/methodology-ingest-local.sh:2`, a header comment. No code loads the module. The prose claims a wire that does not exist.
- ralph-loop-gate: `lib/core/card-fire-gate.cjs:15` and `lib/core/synthetic-expert-construction-gate.cjs:23` are comments in two dead-set modules ("the ralph-loop-gate.cjs precedent"). This is why the scan puts it in the closure.
- voice-transition-detector: `lib/core/fork-declaration.cjs:41` is a comment ("lib/core/voice-transition-detector.cjs:22-25 already ..."). The module exists and its own test loads it.
- session-register: `commands/ignite.md:80`, `:166` and `:198` (and `skills/ignite/SKILL.md` at the matching lines) tell Larry to call `resolveSessionRegister(role_blend)` and `composePersonaContext(roleBlend)` from `lib/core/session-register.cjs`; `:138` lists the file among the five that a role key change touches. `lib/core/user-md-ops.cjs:228` is a comment. No code requires the module. This is an instruction to Larry, not a wire (pitfall 1 of 390-RESEARCH.md). The 389-05 plan edits the same ignite lines (section 6).
- navigation/synthetic-expert: LIVE. `lib/core/navigation.cjs:65`, `lib/core/expert-genesis.cjs:44` and `scripts/close-loop.cjs:44` call `require` on it. Only `navigation.cjs` and `close-loop.cjs` are live callers; `expert-genesis.cjs` is itself test-only.
- graph-refine-loop: CODE hits are comments (`lib/core/navigation/spine-events.cjs:157`, `lib/core/room-db.cjs:165`, `lib/core/semantic-index/analogy-fitness.cjs:34` and `:289`, `scripts/analogy-fitness-report.cjs:26`). The PROSE hits are `commands/find-analogies.md:411` and `skills/find-analogies/SKILL.md:402`: "Preview it through `graph-refine-loop` with `dryRun` left at its default TRUE". This is an instruction in a command, not a code call.
- planning/artifact-brain-packet: `lib/core/navigation/memory-cortex-packet.cjs:7` is a comment ("This module MIRRORS lib/core/planning/artifact-brain-packet.cjs"). That file is a dead-set module. This is why the scan puts it in the closure.

Notes:

- HOOK, DESKTOP and MCPB are 0 for all 26 rows. None of `hooks/hooks.json`, `settings.json`, `.mcp.json`, `.claude-plugin`, `ui/`, `lib/mos-face/`, `lib/mcp/` or `mcp-server-brain/` names any of them (PROVEN by the commands above). The mirror copies under top-level `dist/` that name `fusion-router`, `methodology-ingest`, `session-register` and `graph-refine-loop` are skill-prose copies, not independent callers.
- Cowork use is not observable here and is UNVERIFIED for every row (D-08).
- A multi-line `require(` is missed by the NR count.
- The matrix is a cost indicator and not a cut verdict. A TEST-ONLY row still has a test that would need an owner ruling (OD-1, OD-2, OD-3, OD-14). A COMMENT-ONLY row has text that would need an edit. A WIRED-IN-PROSE-ONLY row has a command or skill that tells Larry to call a module that nothing loads.
- Verdict counts: LIVE 1, TEST-ONLY 16, COMMENT-ONLY 6, WIRED-IN-PROSE-ONLY 3 (total 26).

### Why five modules are absent from the dead set

`fusion-router`, `grill-engine`, `methodology-ingest`, `session-register` and `voice-transition-detector` are named in the PRD as orphans. Their NR is 0 (no `require` outside tests), yet the scan does not list them. The scan counts a path-like token that ends in a code extension and has the module name as its last segment, in a tracked non-test file, as a reference. A comment or a line of prose is enough. The token that does it:

- fusion-router: `lib/core/fusion-router.cjs:283` in `lib/core/eureka/lateral-engine-adapter.cjs:7`, and `fusion-router.cjs` in `portfolio-dimensions.cjs:28` and `navigation/typed-frame.cjs:520` (all comments).
- grill-engine: `lib/core/grill-engine.cjs` in a comment at `lib/core/part8-egress-guard.cjs:1168`.
- methodology-ingest: `lib/core/methodology-ingest.cjs` in `commands/ingest-methodology.md:25`, `:70`, `:74` and the skill copy (prose).
- session-register: `lib/core/session-register.cjs` in `commands/ignite.md:166`, `:198` and the skill copy (prose), and `session-register.cjs` in a comment at `lib/core/user-md-ops.cjs:228`.
- voice-transition-detector: `lib/core/voice-transition-detector.cjs:22-25` in a comment at `lib/core/fork-declaration.cjs:41`.

This closes the discrepancy in audit section G (D-04). It is not a cut verdict.

### Dynamic require sites

Command: `git grep -n -P "require\((?!['\"])" -- lib scripts bin hooks mcp-server-brain` minus the test exclusions (tests/, evals/, `*.test.cjs`, `test-*`). Result: 625 hit lines (PROVEN). Triage, by script plus hand reading:

| Group | Count | Reading |
|-------|-------|---------|
| Comment lines that contain the text `require(` | 55 | not calls |
| `require(path.join(...))` or `path.resolve(...)` whose arguments are all string literals or `__dirname`-style constants | 360 | a fixed path. None of the 360 contains any of the 25 key stems (script check, 0 hits) |
| Any other argument (a variable, a named PATH constant, `process.argv`, `process.env`, a template, a call that continues on the next line) | 210 in 91 files | read in full |

Read: 625 of 625 hit lines were listed, and all 210 non-literal hits were read by me. Result: none builds one of the 26 keys. Reasons:

1. None of the 91 files that hold a non-literal hit contains any of the 25 key stems anywhere in its text (a `grep -E` over those 91 files gave 0 hits, PROVEN). A name can only be built there from outside data.
2. The sites where the name does come from data: `scripts/build-harness-manifest.cjs:678` loads `byte_budget.path` from `data/harness-policies/*.json`; the only such value found is `lib/mcp/runtime-instructions.cjs` (`data/harness-policies/contract-parity-larry.json`). `scripts/build-connector-registry.cjs:349`, `:366`, `:450` load the MCP router, the contract version file and the files under `lib/mcp/tools`, all set by constants in that script (lines 404 to 419). `lib/mcp/register-core-tools.cjs:91` and `scripts/feynman-minto-guardian.cjs:128` load every file of one fixed folder (`lib/mcp/tools`, the validators folder). `lib/core/research-planner/perspectives/index.cjs:74` loads the perspective ids it registers. `scripts/verify-phase-132.cjs:121` loads a literal list. `lib/core/mcp-dep-heal.cjs` (callers pass `@modelcontextprotocol/server`, `@modelcontextprotocol/server/stdio`, `zod`) and `lib/core/eureka-deps-resolver.cjs` load npm package names. `lib/core/platform.cjs:136` loads `.claude-plugin/plugin.json`. The four hits in `lib/ui-shell/dist/server/.next/...` are the bundler runtime of a built UI and load chunks.
3. `scripts/intent-classifier.cjs` holds 31 of the hits; they are multi-line `require(` calls with a literal `path.join(...)` on the next line. The NR count misses a multi-line `require`, but this file does not name any of the 25 stems (point 1).
4. The `.sh` and extensionless scripts (`scripts/release.sh`, `scripts/session-start`, `scripts/self-update`, `scripts/on-stop`) use `node -e` with `require(process.argv[1])` or an environment variable. They load `lib/core/*` modules by a literal suffix or semver and plugin.json. None names a key.

UNVERIFIED: a name that comes from a user room file or a user message at run time. No such site was found, and a user room was not read (Canon Part 8).

A name built from parts across two lines (for example a template string that joins a folder and a file stem) would show in the 210 as a non-literal. None of those 210 holds a stem of a key. So no site can build any of the 26 names.

## 5. scripts scope

Scope B: scripts (cjs and sh) plus lib/hmi plus lib/workflow. 376 scanned. Lists copied from the raw file. The 39th test-only entry, `scripts/pyramid-seed-run` (227 lines), is in-flight Phase 389 work (section 1), not a 390 candidate.

8 no-reference (2004 lines): lib/hmi/f9-ordered-capture-cli (138), scripts/198-rollback-rehearsal (233), scripts/apply-teaching-content (298), scripts/audit-active-phase-resolver (160), scripts/huji-pin-smoketest (454), scripts/sweep-skill-descriptions (263), scripts/vault-integration-test (318), scripts/write-bridge-artifacts (140).

39 test-only (15190 lines): lib/hmi/f3-depth-capture-cli (77), lib/hmi/f4-scope-capture-cli (86), lib/hmi/hats-persona-cache (142), lib/workflow/f3-depth-consumer (98), lib/workflow/f4-scope-consumer (112), lib/workflow/memory-cascade-f9-adapter (273), lib/workflow/memory-governance-closer (384), scripts/198-plurai-gate-check (118), scripts/backfill-layer (497), scripts/build-framework-command-ledger (609), scripts/build-research-shape-ledger (371), scripts/cache-hitrate-report (216), scripts/check-deck-design (104), scripts/check-floor-ledger (373), scripts/check-graph-export-typemap (118), scripts/check-research-isomorphism (446), scripts/coherence-smoke-test (489), scripts/collect-cold-install-evidence (413), scripts/cross-room-detect (195), scripts/ctxl-eval (860), scripts/empathy-observation-emit (108), scripts/extract-dogfood-stop-events (1058), scripts/generate-chat-embed (179), scripts/hmi-status-command (505), scripts/hooked-rescore-117 (224), scripts/huji-run-one-async (305), scripts/judge-355-usefulness (521), scripts/label-355-gold (872), scripts/measure-relevance-signals-362 (451), scripts/migrate-room-sections-v275 (556), scripts/migrate-telemetry-v1 (384), scripts/probe-brain-contract (489), scripts/pyramid-seed-run (227), scripts/reassign-primary (125), scripts/skillopt-funnel (1076), scripts/skillopt-genqueries (571), scripts/skillopt-merge (656), scripts/spike-366 (782), scripts/telemetry-command-invocation (120).

9 closure extras (4640 lines): lib/workflow/f9-ordered-consumer (199), lib/workflow/reconcile-f9-adapter (299), scripts/189-plurai-gate-check (88), scripts/audit-body-shape-coverage (213), scripts/capture-355-theo-responses (491), scripts/measure-355-hit-rate (1666), scripts/skillopt-codereview (830), scripts/skillopt-eval (519), scripts/spike-366-prepare (335).

Change against 385-PROOF section 11 (373 scanned, 9 no-reference with 2718 lines, 37 test-only with 14843 lines). The no-reference list lost scripts/extract-room-intelligence (714 lines): `67c3d61cf` (385-06) removed it. 2718 minus 714 equals 2004. The test-only list gained scripts/telemetry-command-invocation (120 lines): `33c004d2a` (385-11) removed its hook entry from hooks/hooks.json, so only tests name it now. 14843 plus 120 equals 14963, and 14963 plus the 389-03 script (227) equals 15190. All three are PROVEN by git log and by the arithmetic.

385-PROOF section 11 (R10) keeps all of these ("keep all, delete none"). This phase does not analyse them. The scripts scope is outside the 26 matrix rows.

## 6. Phase 389 state

This section is the one place that holds the state of Phase 389 for plan 390-02. Other 390 files copy it from here. THE STATE IS LIVE. Four executors write to this tree at the same time as this plan, so the counts below are a reading at one moment and can be out of date when you read them.

Reading (phase folder `.planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family`):

| Time (UTC, 2026-11-08) | PLAN files | SUMMARY files | SUMMARY files present |
|------------------------|-----------|---------------|-----------------------|
| 05:26 (start of this plan) | 14 | 1 | 389-01 |
| 05:28 | 14 | 3 | 389-01, 389-03, 389-05 |
| 05:31 (last reading before the commit) | 14 | 4 | 389-01, 389-02, 389-03, 389-05 |

Verdict word: **part executed**. Plans 389-01 to 389-14 are all planned. Only the plans in the last row have a SUMMARY file. The phase is not complete.

**Plan overlaps.** The table lists each 389 plan whose `files_modified` names a path that 390-RESEARCH.md also names. Re-derived from the 14 plan files in this session (PROVEN); not copied from the plan text.

| 389 plan (wave) | Path in files_modified that 390-RESEARCH.md also names | 390 candidate it touches |
|-----------------|--------------------------------------------------------|--------------------------|
| 389-05 (2) | commands/ignite.md, skills/ignite/SKILL.md, dist/zed/.agents/skills/ignite/SKILL.md | session-register prose and OD-4A (ignite prose that tells Larry to call resolveSessionRegister) |
| 389-06 (3) | data/brain-orchestration-projection.json, data/connector-coverage-ledger.json, lib/mos-face/dist/commands.js, ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts | generated registries that every command cut regenerates |
| 389-07 (4) | hooks/hooks.json, scripts/session-start | the hook list (mva-detect is Phase 389 owner question 1) and the session doctrine text |
| 389-08 (5) | commands/vault.md, data/help-groups.json, data/connector-registry.json, data/connector-out-of-spine-allowlist.json, data/brain-orchestration-projection.json, data/connector-coverage-ledger.json, lib/mos-face/dist/commands.js, scripts/build-render-coverage.cjs, tests/test-209-declared-implies-wired.cjs, ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts | data/help-groups.json (OD-11 would also edit it); vault.md and the render-coverage script and test-209 are in the vault and mullins family rows; the registries are shared |
| 389-09 (6) | data/help-groups.json, data/connector-registry.json, data/brain-orchestration-projection.json, data/connector-coverage-ledger.json, lib/mos-face/dist/commands.js, ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts | data/help-groups.json (OD-11); shared registries |
| 389-10 (7) | scripts/session-start | session doctrine text |
| 389-11 (8) | data/help-groups.json, data/connector-registry.json, data/brain-orchestration-projection.json, data/connector-coverage-ledger.json, lib/mos-face/dist/commands.js, ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts | data/help-groups.json (OD-11); shared registries |
| 389-13 (10) | scripts/verify-release | the REQUIRED_SKILLS line the pws-methodology row cites |

The 389-01 to 389-04, 389-12 and 389-14 plans name no path that 390-RESEARCH.md names. Two kinds of overlap exist. The specific ones are the ignite prose (389-05) and `data/help-groups.json` (389-08, 389-09, 389-11). The shared ones are the generated registries, the Desktop command registry files and `lib/mos-face/dist/commands.js`. Any command cut regenerates the shared ones, so every later 390 cut plan touches them.

**Rule.** A later 390 wave that edits a file in the table runs only after the 389 plan that edits that file has a SUMMARY file. Concretely: an ignite prose edit (OD-4A) waits for 389-05 (which has a SUMMARY since the 05:28 reading); an edit of `data/help-groups.json` (OD-11) waits for 389-08, 389-09 and 389-11; a regeneration of the shared registries waits for 389-06, 389-08, 389-09 and 389-11. Re-read this section and the phase folder at the time a later wave starts. Do not trust the table above for the state at that time.

**MVA-family modules in the dead sets.** Search of both scopes in `390-scan-output.txt`, case-insensitive, for the text `mva`: **NONE** (grep exit code 1, PROVEN). The lib/core MVA files that exist (`mva-agent-contract`, `mva-budget`, `mva-classifier`, `mva-deck-builder`, `mva-dispatcher`, `mva-option-router`, `mva-orchestrator`, `mva-progressive-renderer`, `mva-rule-linter`, `mva-state`, `mva-telemetry`, `mva-vercel-deploy`) all have production callers, so none is in a dead set. Phase 389 owns the MVA family. No card in 390-DECISION.md offers one (D-12).

## 7. What this record does NOT prove

In plain words:

1. A comment counts as a caller. The scan counts a path-like token in a comment. Five modules (section 4) are absent from the dead set only for that reason, and two closure extras (`ralph-loop-gate`, `planning/artifact-brain-packet`) are in the closure only because dead modules name them in comments.
2. A prose-only or registry-only caller is missed by the NR count and is counted as a reference by the scan. Prose that tells Larry to call a function is not a wire (see `session-register`, `methodology-ingest`, `graph-refine-loop`).
3. A path built from parts is missed. The dynamic require list in section 4 was read by hand, but a name that arrives from a user, a data file outside the tracked set, or an environment variable cannot be seen.
4. A multi-line `require(` is missed by the NR count.
5. Desktop and Cowork use is not observable here. The DESKTOP and MCPB counts only show that the tracked Desktop and brain-server sources do not name a module. They do not show how a person uses it. Cowork is UNVERIFIED for every row (D-08).
6. Session-log evidence, where another file cites it, comes from one machine and Claude Code only. It chooses what to check. It never proves a module unused (D-07).
7. The top-level `dist/` folder and `r-and-d/` were excluded from the counts, as the plan says. `dist/` holds generated copies of skill prose (for example `dist/zed/.agents/skills/ignite/SKILL.md` names `session-register`). Those copies change when the source prose changes. They are not independent callers.
8. This record reads names, counts and line numbers only. No user room was read (Canon Part 8).
