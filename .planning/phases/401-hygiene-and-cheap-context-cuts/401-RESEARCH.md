# Phase 401 RESEARCH: facts from disk for the six sweeps

**Measured:** 2026-11-27, worktree /home/jsagi/dev/MindrianOS-Plugin-405, branch work/405-desktop, commit 08c1633aa, plugin 2.0.0-beta.94.
**Method:** `git grep` over tracked files; `.planning/` is excluded from every count unless a line says otherwise. Tool lists were read from the two local servers over stdio with a scratch script (no repo file written; `NODE_PATH` pointed at the node_modules of the main checkout, because this worktree has none).
**Marks:** PROVEN (seen in a file or a run), CITED (from 400.1-RESEARCH.md or a doc), UNVERIFIED (not run), GUESS (inference).
**Scratch files:** /tmp/claude-1000/-home-jsagi/804181bb-a061-4e73-9011-b268caba748f/scratchpad/e401/ (list-tools.cjs, measure.cjs, desc.cjs, fb.sh, tools-os.json, tools-brain.json).

## 0. Summary of corrected numbers

| Item | ROADMAP or 400.1 number | Disk today | Mark |
|---|---|---|---|
| Files with `mcp__mindrian-brain__` | 115 | 115 files, 262 occurrences | PROVEN |
| Files that name `mcp-server-brain` outside the folder | 53 | 57 | PROVEN |
| `$schema` bytes in the mindrian-os tool list | 4,332 B | 4,332 B (76 x 57 B) in inputSchema; 1,482 B more in 26 outputSchema; 342 B in the brain shim | PROVEN |
| mindrian-os tool surface (description + inputSchema) | 85,599 B (test-270 AFTER) | 86,250 B, 76 tools (plus 0.76 percent) | PROVEN |
| Expired commands | 6 | 6 | PROVEN |
| Firing block | 13 lines x 170 files | 170 files, 998 B each, 169,652 B, 1 variant | PROVEN |
| Description bytes commands / skills / agents | 7,122 / 11,887 / 3,195 | the same | PROVEN |

## 1. Sweep (a): the unscoped tool name

### 1.1 Which name exists on which surface

- The plugin name is `mos` (.claude-plugin/plugin.json:2). The server key is `mindrian-brain` (.mcp.json:8). PROVEN.
- CLI: the host name of each tool is `mcp__plugin_mos_mindrian-brain__<tool>`. CITED: 400.1-RESEARCH.md K6 (the unscoped name never appears as a tool or a call in the owner transcripts; the scoped name appears 2,472 to 2,653 times per tool). Also tests/test-391-agent-tools-naming.cjs:41-44 ("PROVEN on claude 2.1.319").
- Desktop Code tab, local session: full Claude Code (CITED: 400.1 K2). The Desktop copy `mos-desktop` has plugin.json name `mos` (CITED: 401-405-PROGRAM.md C6), so the expected prefix is the same. UNVERIFIED until 405 spike SP8 (405-DESIGN.md:166).
- Desktop chat: the plugin MCP servers do not load (CITED: 400.1 K2, platform-support table). The mindrian-brain shim is not in the chat extension (405-DESIGN.md section 3.6). A bridged local server shows as `mcp__remote-devices__<server>__<tool>` (405-DESIGN.md:166; field evidence, spike level). So no name with the `plugin_mos_` prefix exists in the chat.
- A user-level or project-level server named `mindrian-brain` gives `mcp__mindrian-brain__<tool>`. The Part 8 guard treats that route as untrusted for the paste branch (scripts/part8-egress-guard-hook.cjs:261-267). PROVEN.
- The shim registers 6 tools: brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write (scripts/mindrian-brain-mcp-client.cjs:235, :314, :334, :348, :365, :378; run output). PROVEN.
- The names `read_neo4j_cypher` and `get_neo4j_schema` exist on no shipped server. They are in 8 commands and 9 skills (`read_neo4j_cypher`) and 4 commands and 5 skills (`get_neo4j_schema`). PROVEN.
- The model resolves a wrong prefix in prose to the right tool: commands/act.md:168 says `mcp__mindrian-brain__brain_ask` and the host records only the scoped call (CITED: 400.1 K6). So the exact string matters in machine-read fields (`allowed-tools`, agent `tools:`), not in prose. GUESS for the strength of this rule; one live check is an acceptance item.

### 1.2 Count by folder (115 files)

dist 36 (18 under dist/generic-claude-dir, 18 under dist/zed), skills 17, commands 16, tests 12, r-and-d 12, lib 6, agents 6, scripts 4, references 2, docs 2, tools 1, CHANGELOG.md 1. PROVEN.

### 1.3 Shipped surfaces (commands, skills, agents, references): 41 files

- Commands (16): act (3), compare-ventures (4), deep-grade (1), diagnose (1), find-analogies (3), find-connections (2), grade (1), intel-pipeline (2), pipeline (1), rs-experts (1), rs-explain (2), rs-fetch (2), rs-thesis (2), scheduled-tasks (1), scout (2), suggest-next (3).
- Use in `allowed-tools` lists: act.md:55-56, compare-ventures.md:29-31, find-analogies.md:44-46, find-connections.md:30-31, intel-pipeline.md:43-44, rs-explain.md:31-32, rs-fetch.md:38-39, scheduled-tasks.md:27, scout.md:37-38, suggest-next.md:29-31 (10 commands, 23 entries; 7 of the entries are `read_neo4j_cypher`).
- Use in frontmatter comments: rs-experts.md:31, rs-thesis.md:32.
- Use in body prose: act.md:168, compare-ventures.md:92, deep-grade.md:74, diagnose.md:64, grade.md:74, pipeline.md:86, rs-thesis.md:98.
- Skills (17): 16 are mirrors of the commands above (scripts/build-skill-mirrors.cjs; `--check` reports "112 mirrors match"). 1 is hand-kept: skills/brain-connector/SKILL.md:32.
- Agents (6): prose and comments only. analogy-query-fetcher.md:13, brain-query.md:34, :60, :62, competitor-watch-fetcher.md:14, grading.md:34, :51, :56, :60, investor.md:34, :66, :75, :77, :79, research.md:39, :68. The `tools:` lists already hold the scoped name (tests/test-391-agent-tools-naming.cjs:47-61 pins them).
- References (2): references/brain/query-patterns.md:9, :12, :31 and references/brain/schema.md:10-13. agents/investor.md:66 tells the agent to read query-patterns.md.
- None of these 41 files is commands/rooms.md, setup.md or doctor.md (the 405 files). None is digested by data/harness-manifest.json (it digests agents/larry-extended.md and skills/larry-personality/SKILL.md; 401-405-PROGRAM.md matrix row 5). PROVEN by the file lists.
- The generated registries hold no `allowed-tools` data and no Brain tool name: 0 hits in data/command-registry.json, connector-registry.json, render-coverage-registry.json, brain-orchestration-projection.json, harness-manifest.json. PROVEN.

### 1.4 Files that must keep the unscoped name

| File | Lines | Why it holds the name |
|---|---|---|
| tests/test-260906-gr1-brain-shaped-tool-gate.cjs | :99, :119-126, :212-214 | proves that the matcher catches the project-scope name |
| tests/test-260917-dgf-part8-hook-disposition.cjs | :31, :107 | project-scope disposition branch |
| tests/test-386-b2-brain-write-blocked.cjs | :83, :120 | both name forms are blocked |
| tests/test-386-web-credential-hook.cjs | :51 | hook input fixture |
| tests/test-395-egress-leaks.cjs | :380 | a name match alone does not open the paste branch |
| tests/test-396-theo-route-matrix.cjs | :47 | route matrix; this test also pins the 3 matchers byte-identical |
| tests/test-brain-response-sanitize.cjs | :259-260 | `isBrainTool` on the project-scope name |
| tests/test-366-guard-navigator-release.cjs | :164 | guard classify with a project-scope name |
| tests/test-245-brain-envelope-shape.cjs | :85 | constant PROJECT_SCOPED_STATS |
| tests/fixtures/392-part8-replay/route-matrix.json | :19 | replay fixture |
| tests/test-391-agent-tools-naming.cjs | :68-78, :351, :365 | ALLOWED_BEFORE history and rule A13 |
| tests/run-all-296.sh | :27 | comment |
| lib/core/brain-response-sanitize.cjs | :48, :214, :252 | comments that document the scopes the matcher covers |
| scripts/part8-egress-guard-hook.cjs | :40, :261, :388 | comments on the trust rule |
| scripts/brain-response-sanitize-hook.cjs | :12 | comment |
| scripts/measure-hook-cold-start.cjs | :174 | synthetic hook input for a matcher that holds `brain` |
| tools/perf/perf-harness.cjs | :70 | synthetic hook input |
| lib/core/security/agentshield-scanner.cjs | :173 | comment: both forms resolve the same |
| scripts/migrate-skill-frontmatter.cjs | :30 | comment on a past fix |
| lib/memory/run-feynman-tests.cjs | :935 | comment |
| docs/2026-05-12-brain-query-path-optimization.md, docs/257-NOTE-part8-enforcement-locus-rulings.md, CHANGELOG.md | | history |
| r-and-d/breakthrough-engines/ (12 files) | | an index of saved copies, "not yet wired" (r-and-d/breakthrough-engines/README.md:1-3); no generator and no test reads it (0 hits in scripts, tests, lib, package.json) |

### 1.5 Files that move with the sweep

- lib/memory/brain-server-resolution.test.cjs:100 pins `CANONICAL_PREFIX = 'mcp__mindrian-brain__'` for the `allowed-tools` lists of the commands. PROVEN. The test is red today for 2 other reasons: T1 "query: file missing" (the command /mos:query was retired, data/command-deprecations.json:4-11) and T4 (docs/install/BRAIN-SETUP.md has no `mcpServers` snippet). Run result: 3 of 5 pass. PROVEN.
- lib/core/mullins-scaffold.cjs:240 returns `tool: 'mcp__mindrian-brain__brain_ask'`; lib/core/mullins-scaffold.test.cjs:82 pins it. The only reader of the field is the test (grep for `buildBrainFolderQuery`); the skill text points to the function by name (skills/mullins-scaffold/SKILL.md:112). PROVEN.
- dist/ (36 files) is generated by scripts/build-dist-bundles.cjs. dist/BUNDLE-VERSION.json says `source_version: 2.0.0-beta.52`, so dist is stale by 42 betas today. PROVEN.

### 1.6 Other stale Brain names (same files or same job)

| Pattern | Files | Where | Finding |
|---|---|---|---|
| `pws-brain-mcp` | 75 | docs 34, tests 25, lib 4, dist 4, data 2, skills 1, scripts 1, hooks 1, commands 1, CLAUDE.md 1, CHANGELOG 1 | Must stay in hooks/hooks.json:208 and :332, lib/core/brain-response-sanitize.cjs:151 and data/theo-tool-classes.json:13 (`retired_servers`). scripts/part8-real-calls-extract.cjs:51-52 mirrors the matcher. commands/doctor.md:86 documents the brain-origin doctor point. No shipped file tells the model to call it. Edits needed: 0. |
| `mindrian-brain.onrender.com` | 32 | tests 14, docs 10, lib 6, r-and-d 1, CHANGELOG 1 | The 6 lib files are 5 tests (fixtures and negative assertions, for example lib/core/telemetry/validator.test.cjs:166-172) and 1 comment (lib/core/rs-nl-to-query.cjs:13). lib/core/brain-client.cjs:24 is the one source of the live URL. Edits needed: 1 comment. |
| `pinecone-brain` | 12 | agents 3, lib 3, references 2, dist 2, tests 1, CHANGELOG 1 | `mcp__pinecone-brain__search-records` is in the `tools:` list of agents/brain-query.md:10, investor.md:10, research.md:17 and in their prose (:62, :68). Pinecone is retired (project CLAUDE.md stack table). tests/test-391-agent-tools-naming.cjs:48, :54, :58 pins these lists from owner card C1 (APPLY-ALL, 2026-11-08). |
| `neo4j-brain` | 19 | dist 4, agents 4, lib 3, docs 3, references 2, skills 1, scripts 1, CHANGELOG 1 | agents: comment lines :34 and :39. skills/brain-connector/SKILL.md:33, :198. references/brain/schema.md:68, :77 and causal-enrichment.cypher:3, :13, :148. |

## 2. Sweep (b): mcp-server-brain/ (R4)

### 2.1 The folder

- 15 tracked files, 160 KB: .env.example, CLAUDE.md, brain-admin.cjs, lib/ (6 files), package.json, render.yaml, server.cjs, sql/ (2 files), test-brain.cjs. PROVEN.
- Its own guide says the deployment is historical and superseded (mcp-server-brain/CLAUDE.md:5). PROVEN.
- The folder is not in the npm payload: package.json `files` does not list it; scripts/release.sh:1137 and scripts/check-release-payload-ceiling.cjs:52 refuse a tarball that holds it. PROVEN.

### 2.2 The 57 referencing files, by class

Count by folder: docs 21, tests 10, lib 10, scripts 5, dist 4, skills 2, data 1, commands 1, CHANGELOG.md 1, .gitignore 1, .env.brain.template 1. PROVEN.

Class K, guards that block the folder from a release or from a require (keep):
- scripts/release.sh:1122, :1132, :1137, :1139, :1147 (Step 9.5 payload blacklist). Each `# --- Step` block of this file is hashed in tests/fixtures/341-release-step-block-hashes.txt and 310-release-step-block-hashes.txt (read by tests/run-all-341.sh and run-all-310.sh). 405 slice 9 edits the same script and both fixtures (405-DESIGN.md section 8).
- scripts/check-release-payload-ceiling.cjs:52 (FORBIDDEN_PREFIXES).
- tests/test-341-payload-shrinkwrap-present.cjs:130, :145.
- tests/test-267-mcpv2-sdk-era.cjs:80 (skips the folder in a scan).
- lib/core/room-auto-create.test.cjs:150, lib/core/venture-shape-nudge.test.cjs:149-152, tests/test-room-auto-create-fingerprint-integration.cjs:236 (assert "no require of mcp-server-brain").
- tests/test-render-v2-provenance.cjs:476 (token list).
- Comments that state the same rule: lib/core/room-auto-create.cjs:23, lib/core/breakthrough/detectors.cjs:11.

Class H, history (keep): docs/ (21 files), CHANGELOG.md, data/capability-ledger.json:350 (evidence text of a past entry).

Class D, files and rows that test or serve the folder itself (go with it):
- tests/127.1-query-embedder.test.cjs:39 (requires mcp-server-brain/lib/query-embedder.cjs).
- tests/test-127.2-00-brain-edge-bundle.sh:32-109 (greps mcp-server-brain/lib files).
- lib/memory/mcp-server-brain-deps.test.cjs (whole file); its rows in lib/memory/run-feynman-tests.cjs:947-968 and :1709, tests/run-all-3696.sh:167, tests/fixtures/3696-known-failures.json:24-25, tests/run-all-127.sh:22.
- .gitignore:93-94; .env.brain.template:31.

Class E, comments and pointers (edit): lib/core/arbitration.cjs:65, lib/core/doctor/mcp-surface-module.cjs:35, lib/memory/test-rs-brain-substrate-shape.cjs:14, tests/test-brain-client-params.cjs:7-8, :45, skills/brain-connector/SKILL.md:30 ("operators who bundle `mcp-server-brain/`").

Class O, operator tools that need the folder to work:
- commands/admin.md:112, :116, :174, :219, :251, :271, :301, :320, :350 run `mcp-server-brain/brain-admin.cjs` (9 calls). The mirror skills/admin/SKILL.md and 2 dist copies hold the same calls. brain-admin.cjs has zero npm dependencies and talks to a Supabase table through `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (mcp-server-brain/brain-admin.cjs:8, :74-84). On an npm install the path does not exist (2.1). Whether Theo still reads this key table is UNVERIFIED.
- scripts/admin-brain-write.cjs:83-86 and lib/brain/curation-batch.cjs:110-132 load `neo4j-driver` from mcp-server-brain/node_modules. curation-batch.cjs already refuses with a message when the driver is absent (:125-132).
- scripts/export-pinecone-embeddings.cjs:81-97, :338 and scripts/load-embeddings-into-neo4j.cjs:66-98, :168 (the Phase 127.1 one-time migration to a Neo4j index; both back ends are retired).
- These 4 scripts are named by other tests and scripts: tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs, tests/test-252-guard-census.cjs, tests/test-l8g-theo-bare.cjs, tests/run-all-132.sh, scripts/verify-phase-132.cjs, lib/memory/curation-batch.test.cjs, tests/fixtures/127.1/. PROVEN by grep. The effect of a removal on each is UNVERIFIED.

Generated: dist (4 files) follows skills/.

## 3. Sweep (c): `$schema`

- Source: the tool schemas are zod 4 objects; the SDK converts them at list time (`standardSchemaToJsonSchema`, node_modules/@modelcontextprotocol/server/dist/src-CgFsfg3E.cjs:5370; called in the `tools/list` handler, mcp-DUcCQSTW.cjs:1721-1732). Installed versions: @modelcontextprotocol/server 2.1.0, zod 4.6.5. No file under lib/mcp or scripts writes `$schema` for the tool list. PROVEN.
- Value: `"$schema":"https://json-schema.org/draft/2020-12/schema",` = 57 B, once per inputSchema (76) and once per outputSchema (26 tools). PROVEN by the run.
- The SDK reads a schema with no `$schema` as dialect 2020-12 (dialects-D8eXzoGv.cjs: `if (!("$schema" in schema) ...) return "2020-12"`). So a strip does not change the meaning. PROVEN for the SDK; the host rule is CITED from 400.1 (the host sends the key to the API, 73 of 73 tools).
- A handler can be replaced after registration: `Server.setRequestHandler` stores into `_requestHandlers` (src-CgFsfg3E.cjs:6853); a protected accessor `_getRequestHandler(method)` returns the stored handler (:6324-6326). PROVEN that the accessor exists; its use from plugin code is UNVERIFIED.
- Server construction: scripts/mindrian-mcp-server.cjs:232 (`new McpServer`), tools registered from :254 on. Shim: scripts/mindrian-brain-mcp-client.cjs:187. Both files are in the 405 matrix (row 11) for the first one only.
- Pins that see the key:
  - tests/test-270-tool-schema-budget.cjs: `measure()` counts `JSON.stringify(inputSchema)` (:152), so a strip lowers totalSchemaBytes by 4,332. AFTER = toolCount 76, totalSchemaBytes 47,835, totalBytes 85,599 (:532-541); tolerance 10 percent (:621-624). After a strip on today's tree: 81,918 B, minus 4.30 percent against AFTER. The count check is exact (:616). The file's rule: a re-base needs its plan and reason (:243-262).
  - tests/helpers/mcp-wire-267.cjs:268-285 `normalizeSchema` already deletes the top-level `$schema`, so the 267 wire tests do not move. PROVEN.
  - tests/fixtures/384-s7-tools-list-golden.json holds 99 `$schema` keys; tests/test-384-s7-mcp-start.cjs:175-181 compares the list to the golden and expects 73 tools. Its state today is UNVERIFIED (the live count is 76).
  - tests/fixtures/267/wire-snapshot-zod4.json holds 79 keys (normalised on read).
- outputSchema: 32,893 B over 26 tools. test-270 does not count it. Whether the host sends it to the model is UNVERIFIED.
- Repeated parameter text: 148 parameter descriptions, 13,316 B; only 5 strings repeat, 268 B in total. The node id item schema repeats 21 times (90 B each, in the Eureka tools). PROVEN. The server instructions have 0 free bytes today and 1 after 405 slice 7 (401-405-PROGRAM.md C14).

## 4. Sweep (d): repeated blocks

- The only large repeated block in commands is the firing block: 10 lines of 84 commands; next is one line in 27 files. PROVEN by a line count over commands/*.md (lines of 60 characters or more, 15 files or more).
- Firing block: marker `<!-- mos:firing-block v2 -->` to `<!-- /mos:firing-block -->`; 84 commands and 86 skills (84 mirrors plus client-discovery-interview and mullins-scaffold); 998 B each; 1 text variant. PROVEN.
- Generator: scripts/stamp-firing-block.cjs (CANONICAL_FIRING_BLOCK :66-78, STAMP_MARKER :53). The marker is the "wired" predicate for scripts/check-shape-declaration.cjs:78, :317-323 and scripts/build-render-coverage.cjs:56, :335, :444. Tests: tests/test-209-stamp-firing-block.cjs, test-209-declared-implies-wired.cjs, test-219-qualify.cjs, test-265-declaration-truth.cjs.
- `node scripts/stamp-firing-block.cjs --check` exits 1 today with 11 pending files (doctor, dominant-designs, eureka-portfolio, find-analogies, find-bottlenecks, find-connections, qualify-opportunity, radar, room, scout, skill). PROVEN. The cause is UNVERIFIED.
- The block text names AskUserQuestion and two lib/hmi files. It loads only when a command or skill is invoked (about 250 tokens per invocation). It costs 0 at session start.
- An include that the host expands in place gives the same bytes to the model. So an include saves disk lines, not tokens. Only a shorter text saves tokens. The text already has one source (the generator).
- The Shape F contract v2 is written by 405 slice 12 (lib/hmi/shape-contract-v2.cjs; OR-21). commands/rooms.md and doctor.md carry the block and are 405 files.
- Whether `CLAUDE_PLUGIN_ROOT` is set for a skill in the Desktop chat is UNVERIFIED (405 spike SP1; 401-405-PROGRAM.md island 1.2 risk 3).

## 5. Sweep (e): description cap and size test

- Surface descriptions (bytes of the `description` value): commands 7,122 (113 files), skills 11,887 (125), agents 3,195 (17). PROVEN.

| Cap | Commands over | Skills over | Agents over | Bytes above the cap |
|---|---|---|---|---|
| 200 B | 2 | 10 | 8 | 121 + 2,545 + 504 = 3,170 |
| 300 B | 0 | 5 | 2 | 0 + 1,824 + 61 = 1,885 |
| 500 B | 0 | 5 | 0 | 824 |

- Over 300 B: skills trending-to-absurd 901, mullins-scaffold 739, mos-deck-engine 619, client-discovery-interview 548, intelligence-orchestrator 517 (all hand-kept, not mirrors); agents dominant-design-researcher 356, analogy-query-fetcher 305. Over 200 B in commands: doctor 262 (a 405 file), scientific-roadmap 259.
- In the owner's host the skill listing shows 120 mos names with 0 descriptions (CITED: 400.1 K9 row "mos lines in the host skill listing"). So the cap saves 0 tokens there and up to the table value in a host that lists descriptions.
- Existing guard: tests/test-400-description-budget.cjs. Leg B1 (:111-118) requires the same file set as tests/fixtures/400/description-bytes-baseline.json (255 files, total 22,655), no growth per file and no growth of the total. `--write-baseline` reads the base commit c1e496ae8 only (:8, :60-76). So a removed or a new surface file fails B1 until the fixture rule changes. PROVEN.
- File sizes: commands total 1,330,775 B, 14 files over 24,000 B (largest commands/file-meeting.md 63,159). Skills total 1,606,229 B, 18 over 24,000 B (largest skills/file-meeting 68,196). Agents: 0 over 24,000 B (largest agents/larry-extended.md 15,848). No test holds a file size limit today (grep for 24000 in tests and scripts: 0 relevant hits). PROVEN. F1 changes these numbers by the comment-line edit.
- MCP tool descriptions (mindrian-os): 38,236 B over 76 tools; largest gate_answer 2,028 B, gate_render 1,681, research_run 1,308; 7 tools over 1,000 B; 0 over 2,048 B. Host limit for a tool loaded up front: 4,096 characters (CITED: 400.1 K2). 405 slice 3 adds 384 B to 8 descriptions (401-405-PROGRAM.md budget table). test-270 has a total drift alarm and an exact count, and no limit for one tool. tests/test-234-tool-description-floor.cjs holds a minimum, not a maximum (named in test-270:58).
- test-270 exports `BASELINE, AFTER, DELTA, measure` (:574, :676); it does not export `listToolsOverStdio` (:59).

## 6. Sweep (f): expired commands

| Command | `deprecated_removal` | Redirect | Lines (command / skill) |
|---|---|---|---|
| hmi-status | v1.14.0 (commands/hmi-status.md:18-20) | doctor --ui-compliance --json | 81 / 79 |
| organize | v1.14.0 (:22-24) | rooms organize | 84 / 79 |
| heal | v1.14.0 (:18-20) | doctor --heal-room | 80 / 77 |
| visualize | v1.14.0 (:18-20) | dashboard --mermaid | 77 / 75 |
| mva-report | v2.0.0-beta.86 (:22-24) | session-report | 76 / 77 |
| mva-brief | v2.0.0-beta.86 (:22-24) | structure-argument | 76 / 77 |

- The current version is 2.0.0-beta.94 (`node lib/core/repo-version.cjs`). All 6 are past their date. PROVEN.
- Precedent: commit d2b487fd7 (Phase 389 plan 08, /mos:mva-option), 39 files: the command, the skill, 12 data files, data/command-deprecations.json (+1 entry), data/harness-manifest.json, tests/fixtures/341-registry-drift-baseline.json, lib/mos-face/dist/commands.js and manifest.json, ui/mos-face/hooks/commands.ts, ui/mindrian-workspace-mod/assets/command-registry.json, docs, tests. PROVEN.
- data/command-deprecations.json is hand-kept; each entry needs `decided_by` and `record` (:2, :4-11). scripts/check-registry-drift.cjs:59 reads it.
- Each of the 6 names is in 11 to 13 data files (command-registry, connector-coverage-ledger, brain-orchestration-projection, help-groups, hitl-shape-backfill, layer-backfill, orchestration-command-ledger, render-coverage-registry, section-command-relevance, command-irreversibility-ledger, jev-labels/command-irreversibility; some also connector-out-of-spine-allowlist, run-step-capabilities, section-command-ledger) and in tests/fixtures/267/shape-violations-baseline.txt, 341-registry-drift-baseline.json, 400/description-bytes-baseline.json. PROVEN.
- Count pins that move:
  - 113 commands: tests/test-400-job-sentences.cjs:78-89, :145-151; data/harness-manifest.json `source_count: 113`.
  - 73 run-step commands: tests/test-400-capability-cynefin-labels.cjs:302-303, :350; tests/test-400-job-sentences.cjs:59-60. organize, mva-brief and mva-report are on data/run-step-capabilities.json (3 hits), which is made from the book inventory (`source`, `source_sha256`). tests/fixtures/399/recorded-job-command-yes-no.json holds the same 3 names.
  - Stub pins: tests/test-389-retire-brief.cjs:62-68 (both mva-brief stub files exist), :144-160 (allowed file list); tests/test-389-session-report.cjs:142-153 (has a branch for "both old files are absent").
  - tests/test-400-description-budget.cjs leg B1 (same file set).
- Code that serves an expired command: scripts/heal-command.cjs, scripts/hmi-status-command.cjs, lib/memory/heal-command.test.cjs, lib/memory/doctor-deprecation-surface.test.cjs, lib/hmi/jtbd-taxonomy.json, output-styles/destijl.md, scripts/build-orchestration-projection.cjs. Whether `doctor --heal-room` and `doctor --ui-compliance` call the two scripts is UNVERIFIED (the planner must read them before a delete).
- data/room-blueprints.json names none of the 6. PROVEN. So the room byte pins of tests/test-vi3-icm-walk.cjs (they measure ROOM.md and other room files, :230-250, :333-383) do not move with a command edit. This answers the GUESS of 401-405-PROGRAM.md C21 for the sweeps of this design; F1 must check it for itself.

## 7. Overlap with Phase 405 (file level)

| 401 sweep | 405 file it would touch | 405 slice |
|---|---|---|
| (a) names | none (41 surface files; no matcher; no fixture) | slice 10 edits the matchers; SP8 fixes the Desktop prefix |
| (b) R4 | none when scripts/release.sh stays as it is; commands/admin.md is not a 405 file | slice 9 owns release.sh and both hash fixtures |
| (c) `$schema` | scripts/mindrian-mcp-server.cjs; tests/test-270-tool-schema-budget.cjs | slices 1, 5a; 3, 13, 14 |
| (d) firing block | commands/rooms.md, doctor.md and mirrors; the Shape F text | slices 2, 10, 12 |
| (e) caps | commands/doctor.md (description 262 B); tool descriptions; test-270 | slices 2, 3, 13, 14 |
| (f) expired commands | data/command-registry.json, connector-registry.json, harness-manifest.json, help-groups.json | slice 2 (`/mos:rooms adopt`), 7, 13 |

dist/: 405 slice 9 writes its artifact outside the repo and does not change .gitignore (405-DESIGN.md slice 9 AC9.3; program C15 resolved). So dist/ stays tracked and 401 may regenerate it.

## 8. Open checks (not run)

1. test-270 and the 405 gates were not run in this worktree (no node_modules). The tool numbers come from the scratch run.
2. The cause of the 11 pending files of `stamp-firing-block --check`.
3. The state of tests/test-384-s7-mcp-start.cjs and tests/test-234-dist-bundle.cjs today.
4. Whether `node scripts/build-dist-bundles.cjs` gives the same output on every machine (it reads `~/.claude/plugins/` metadata, scripts/build-dist-bundles.cjs:36-40).
5. Whether a bare tool name in prose resolves as well as a full name (one live CLI check).
6. The Desktop Code tab prefix (405 SP8).
7. Whether Theo still uses the Supabase key table that brain-admin.cjs manages.
