---
phase: 401
kind: design (EGM Elephant, narrow)
revision: r1
date: 2026-11-27
status: for one narrow Goldfish round
inputs: 401-CONTEXT.md, 401-RESEARCH.md (every number and file:line below comes from it)
---

# Phase 401 DESIGN: hygiene and cheap context cuts (the rest, after F1)

## 1. Goals

- G1. No shipped command, skill, agent or reference names a Brain tool that does not exist on the surface where the text runs.
- G2. The folder `mcp-server-brain/` is gone and no live code path needs it (R4).
- G3. The MCP tool list does not send the same `$schema` line 76 times.
- G4. The 6 expired commands are gone, with their rows and pins moved in one commit set.
- G5. The firing block is short, and it has one source.
- G6. Size limits exist as tests, so the surface stays small.
- G7. The Part 8 matchers, their fixtures and the release guards stay byte-unchanged by this phase.

## 2. Non-goals

- F1 (separate plan, OR-14).
- Any edit of hooks/hooks.json, lib/core/brain-response-sanitize.cjs:151, data/theo-tool-classes.json or scripts/release.sh.
- "State repeated parameter rules once in the server instructions" (study Phase A row 5). It is cut: only 268 B of parameter text repeats, and the instructions have 1 free byte after 405 (RESEARCH section 3).
- A new include mechanism for skills. An include that the host expands saves no tokens (RESEARCH section 4).
- Removal of history: docs/, CHANGELOG.md and r-and-d/ are not swept.
- Nav-block trims (owner item O7).
- A strip of frontmatter comment lines and phase-id lines (study Phase A row 4). It edits the same lines as F1; it belongs to the F1 plan or a follow-up, not here.

## 3. Rules for every sweep

1. Measure first. Each slice starts with `node scripts/dev/401-measure.cjs` (slice 1) and records the count in its SUMMARY. A count that differs from this design is reported, not forced.
2. Edit sources only. commands/ is the source of the mirrors; skills mirrors come from `node scripts/build-skill-mirrors.cjs`; dist/ comes from `node scripts/build-dist-bundles.cjs`. Do not edit a generated file by hand.
3. A slice that edits commands/, skills/ or agents/ starts after F1 is on main.
4. A pinned test or fixture moves only in the slice that names it, with the reason in the commit message. Do not weaken a check.
5. The keep-list test of slice 1 must be green before and after every slice.
6. Common gates for every slice: `node scripts/build-skill-mirrors.cjs --check`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-shape-declaration.cjs`, `node scripts/run-harness.cjs --check`, `node scripts/doctor.cjs --acceptance`, tests/test-401-frontmatter-split.cjs (from F1), tests/test-401-keep-list.cjs, tests/test-396-theo-route-matrix.cjs, tests/test-391-agent-tools-naming.cjs, tests/test-400-description-budget.cjs.
7. A slice that changes skills/ ends with one separate commit "regenerate dist". The first such commit is large (dist is at beta.52).

## 4. Slices

### Slice 1: keep-list guard and the measuring script

Safe before the 405 foundation: YES (new files only).

- Create scripts/dev/401-measure.cjs: prints, from disk, the counts of RESEARCH section 0 (pattern, files, occurrences, by folder) and the tool-list bytes. Read only. `--json` for tests.
- Create tests/test-401-keep-list.cjs with these legs:
  - L1 the literal `pws-brain-mcp` is in hooks/hooks.json (2 matcher lines), in BRAIN_SHAPED_TOOL_MATCHER and in `retired_servers` of data/theo-tool-classes.json. The leg checks the substring only, so 405 slice 10 can add its literal.
  - L2 each file of keep-list A (section 5.1) holds `mcp__mindrian-brain__` at least once.
  - L3 each file of keep-list B class K (section 5.2) holds `mcp-server-brain`.
  - L4 a mutation arm: a planted copy with the literal removed fails L1, L2 and L3.
- Create tests/run-all-401.sh (F1 may have made it; then extend it).
- AC1.1 the test is green on main as it is today. AC1.2 the mutation arm fails for each leg. AC1.3 the script counts equal RESEARCH section 0 on commit 08c1633aa, or the SUMMARY lists each difference.

### Slice 2: remove mcp-server-brain/ (R4)

Safe before the 405 foundation: YES, after F1 and after owner items O1, O2, O3. It touches no 405 file because scripts/release.sh stays as it is.

- Pattern: `mcp-server-brain`. Count: 15 files in the folder, 57 files outside it.
- Codemod: none. Hand edits by class (RESEARCH 2.2):
  - Folder: `git rm -r mcp-server-brain/`.
  - Class D: delete tests/127.1-query-embedder.test.cjs, tests/test-127.2-00-brain-edge-bundle.sh, lib/memory/mcp-server-brain-deps.test.cjs; remove their rows in lib/memory/run-feynman-tests.cjs:947-968 and :1709, tests/run-all-3696.sh:167, tests/fixtures/3696-known-failures.json:24-25, tests/run-all-127.sh:22; remove .gitignore:93-94 and .env.brain.template:31.
  - Class E: reword 5 comments and pointers so that they do not name the folder (lib/core/arbitration.cjs:65, lib/core/doctor/mcp-surface-module.cjs:35, lib/memory/test-rs-brain-substrate-shape.cjs:14, tests/test-brain-client-params.cjs:7-8 and :45, skills/brain-connector/SKILL.md:30).
  - Class O, default design (if the owner accepts the recommendations of O2 and O3): move brain-admin.cjs to scripts/brain-admin.cjs with no code change except its `.env` path, and change the 9 calls in commands/admin.md; delete scripts/export-pinecone-embeddings.cjs and scripts/load-embeddings-into-neo4j.cjs with tests/fixtures/127.1/ if nothing else reads it; in scripts/admin-brain-write.cjs and lib/brain/curation-batch.cjs replace the driver path with a typed refusal `brain_backend_retired` and one plain line (curation-batch.cjs:125-132 already has this shape).
  - Class K and class H: no edit.
- Pinned tests and fixtures that move: tests/fixtures/3696-known-failures.json (1 entry out), lib/memory/run-feynman-tests.cjs (2 rows out), tests/run-all-127.sh (1 row out), and the tests that name the 4 operator scripts (tests/test-252-guard-census.cjs, tests/test-quick-260910-h32-no-brain-write-from-scripts.cjs, tests/test-l8g-theo-bare.cjs, tests/run-all-132.sh, lib/memory/curation-batch.test.cjs): the planner reads each one and lists the exact row before the edit.
- AC2.1 `git ls-files mcp-server-brain` is empty. AC2.2 `git grep -l mcp-server-brain -- . ':!docs' ':!CHANGELOG.md' ':!.planning'` returns exactly the class K files plus data/capability-ledger.json; the keep-list test pins this set as an exact set (leg L3 becomes "exactly"). AC2.3 `/mos:admin` runs its `list` call against the new path on a dev checkout, or the owner chose to retire it. AC2.4 no file under lib/, scripts/, commands/, skills/ builds a path that contains `mcp-server-brain`. AC2.5 scripts/release.sh and both step-hash fixtures are byte-unchanged (`git diff --stat` shows none of them). AC2.6 tests/run-all-341.sh and tests/run-all-310.sh pass.
- Extra gates: `bash tests/run-all-127.sh`, `bash tests/run-all-132.sh`, `bash tests/run-all-3696.sh`, `node lib/memory/run-feynman-tests.cjs`.

### Slice 3: Brain tool names and stale server names

Safe before the 405 foundation: file-disjoint, but it WAITS for 405 slice 10 and the SP8 verdict. Reason: SP8 gives the real prefix on the Desktop Code tab, and slice 10 is the one edit of the matchers; then the machine-read names are written once. Waiting costs nothing: the model resolves the wrong prose name today (RESEARCH 1.1). Also after F1 (F1 moves or drops the same `allowed-tools` lines).

Decision D3.1, which name is right:

| Place | Form | Reason |
|---|---|---|
| Machine-read fields (`allowed-tools` in commands and mirrors; agent `tools:`) | `mcp__plugin_mos_mindrian-brain__<tool>`, only for the 6 tools the shim registers | the host matches the exact string; proven on the CLI; expected on the Desktop Code tab (SP8) |
| Prose in commands, skills, agents, references | the bare tool name plus the server: "the `brain_ask` tool of the mindrian-brain server" | right under every prefix: plugin scope, user scope, a bridged chat server; no prefix to go stale |
| One reference table, references/brain/query-patterns.md | bare name, then the full name for each surface, and the line "in the Desktop chat this server is absent; say so" | one place holds the prefixes |
| Desktop chat | no mindrian-brain name is right there (the server does not load) | chat method comes from theo-context (405 section 3.6); chat behaviour of commands is the 405 end slice |

- Pattern 1: `mcp__mindrian-brain__([a-z_0-9]+|\*)`. Count: 115 files, 262 occurrences; in scope 41 files (16 commands, 17 skills, 6 agents, 2 references).
- Pattern 2 (dead tool names): `read_neo4j_cypher`, `get_neo4j_schema` in commands and skills (8 + 9 and 4 + 5 files).
- Pattern 3 (stale servers in shipped text): `mcp__neo4j-brain__`, `mcp__pinecone-brain__`, the "(Desktop/Cowork MCP)" and "(legacy)" lines of skills/brain-connector/SKILL.md:32-33 and :198, references/brain/schema.md:10-13 and :68-77, lib/core/rs-nl-to-query.cjs:13 (1 comment).
- Codemod: create scripts/dev/401-brain-name-codemod.cjs (dev only, `--check` and write modes, idempotent). Rules: (1) in an `allowed-tools` list, rewrite an entry whose tool is one of the 6 shim tools to the plugin-scoped name and delete an entry whose tool is not one of the 6; (2) in prose and comments of commands/, agents/, references/brain/, skills/brain-connector/, rewrite `mcp__mindrian-brain__X` in backticks to the bare `X` and add "of the mindrian-brain server" once per paragraph; (3) delete a fallback clause that names `read_neo4j_cypher` or `get_neo4j_schema` (4 command bodies: deep-grade.md:74, diagnose.md:64, grade.md:74, pipeline.md:86; compare-ventures.md:92). Rule (3) has 5 sites; do them by hand and review each.
- Then: `node scripts/build-skill-mirrors.cjs`, then the dist commit.
- Pinecone entries in 3 agent `tools:` lists: removed only with owner item O4; then tests/test-391-agent-tools-naming.cjs APPLIED_TOOLS (:48, :54, :58) moves in the same commit with the owner record.
- Pinned tests that move: lib/memory/brain-server-resolution.test.cjs (:100 CANONICAL_PREFIX becomes the plugin-scoped prefix; remove `query` from AFFECTED_COMMANDS because the command is retired; T4 is repaired or the SUMMARY names it as an old failure, not weakened); lib/core/mullins-scaffold.cjs:240 and lib/core/mullins-scaffold.test.cjs:82 move together to the plugin-scoped name (2 lines).
- Keep-list: section 5.1.
- Create tests/test-401-brain-tool-names.cjs: N1 zero `mcp__mindrian-brain__` in commands/, skills/, agents/, references/; N2 every `mcp__plugin_mos_mindrian-brain__X` in a machine-read field has X in the tool names read from scripts/mindrian-brain-mcp-client.cjs; N3 zero `read_neo4j_cypher`, `get_neo4j_schema`, `mcp__neo4j-brain__` in commands/, skills/, agents/; N4 mutation arms.
- AC3.1 the measuring script reports 0 in-scope files and the keep-list files unchanged (`git diff --stat` names none of them). AC3.2 tests N1 to N4 pass. AC3.3 the three matcher strings are byte-identical to the state after 405 slice 10 (tests/test-396-theo-route-matrix.cjs). AC3.4 the registries and the harness manifest do not change (`--check` gates; `git diff --stat data/` is empty, except agent rows if O4 is yes). AC3.5 LIVE, one CLI session: a command of the sweep (for example /mos:rs-explain) calls `mcp__plugin_mos_mindrian-brain__brain_ask` with no permission prompt when F1 made its `allowed-tools` live, and the Part 8 PreToolUse hook still runs on that call. AC3.6 if SP8 reports another prefix on the Desktop Code tab, the codemod writes both names in the machine-read fields and N2 accepts both.
- Part 8 note: a live `allowed-tools` entry removes the permission prompt for the 6 Brain tools in 10 commands. The guard hook is independent of the permission system and still inspects every call. `brain_write` is in no `allowed-tools` list today and the codemod adds none.

### Slice 4: strip the repeated `$schema`

WAITS for the 405 foundation (it touches scripts/mindrian-mcp-server.cjs and tests/test-270-tool-schema-budget.cjs) and runs after or with the Phase 402 `_meta` change, so that test-270 is re-based once per phase, not twice in one week.

- Pattern: the top-level key `$schema` of `inputSchema` and `outputSchema` in the `tools/list` result. Count: 76 x 57 B = 4,332 B (mindrian-os, the measured unit of test-270), plus 26 x 57 B = 1,482 B in outputSchema, plus 6 x 57 B = 342 B in the brain shim.
- Mechanism: create lib/mcp/strip-schema-uri.cjs with `stripSchemaUri(tools)` (pure; deletes only the top-level key whose value is the 2020-12 URI) and `install(mcpServer)` (wraps the stored `tools/list` handler). Call `install` once after the last registration in scripts/mindrian-mcp-server.cjs and in scripts/mindrian-brain-mcp-client.cjs. The wrap reads the stored handler through the SDK accessor (RESEARCH section 3). GUESS: the accessor is usable from plugin code; if not, the planner uses a public route and records it. A value other than the 2020-12 URI is left in place (fail safe).
- Keep-list: nested `$schema` text inside lib/core/pitch-feedback-schemas.cjs, skillopt-schemas.cjs, lib/import/manifest.schema.json and the UI bundles (not tool-list data); tests/fixtures/267/wire-snapshot-*.json (the helper normalises the key).
- Pinned tests and fixtures that move: tests/test-270-tool-schema-budget.cjs AFTER (totalSchemaBytes, totalBytes, approxTokens, with a dated comment block as the file's rule asks); tests/fixtures/384-s7-tools-list-golden.json (rewrite with the test's own write mode, after its state today is known).
- Create tests/test-401-schema-strip.cjs: T1 no tool of either server has a top-level `$schema`; T2 the list minus the key deep-equals the list of a server run with the strip off (env switch for the test only); T3 a `tools/call` with a wrong argument type is still refused (validation unchanged); T4 the measured saving is at least 4,332 B on the test-270 measure.
- AC4.1 T1 to T4 pass. AC4.2 test-270 passes with the new AFTER and the count unchanged by this slice. AC4.3 the 267 wire tests pass with their fixtures unchanged. AC4.4 LIVE or transcript check: one CLI session shows the tools without `$schema` in the request shape and one tool call works.
- Saving: about 1.1k tokens per session while all tools load up front; less after 402 defers tools.

### Slice 5: remove the 6 expired commands

WAITS for the 405 foundation (registries, harness manifest, help groups and count pins move; 405 slices 2, 7 and 13 move the same files) and for owner item O5.

- Pattern: per command `(/mos:NAME\b|commands/NAME\.md|skills/NAME/|"NAME"|'NAME')` for NAME in hmi-status, organize, heal, visualize, mva-report, mva-brief. Count: RESEARCH section 6 (11 to 13 data files each).
- Method: the precedent commit d2b487fd7, one commit per command or one per pair, in this order: mva-report, mva-brief (decided by D8), then visualize, organize, hmi-status, heal.
- Steps per command: delete commands/NAME.md and skills/NAME/; add one entry to data/command-deprecations.json (`retired_in` = the next release, `replaced_by` from `deprecated_redirect`, `decided_by: navigator`, `record` = this plan); run the generators (build-command-registry, build-connector-registry, build-orchestration-projection, build-render-coverage, build-harness-manifest, build-decision-advisor-table, the mos-face and workspace-mod command lists); edit the hand-kept ledgers the precedent edited; delete code that only the command used, after the planner proves no redirect target calls it (scripts/heal-command.cjs, scripts/hmi-status-command.cjs are the open cases).
- Keep-list: CHANGELOG.md, docs history, data/command-deprecations.json (the new entries), tests that name the command to prove it is gone, `.planning/`, r-and-d/.
- Pinned tests and fixtures that move: tests/test-400-job-sentences.cjs (113 becomes 107; 73 becomes 70), tests/test-400-capability-cynefin-labels.cjs (73 becomes 70 and the Q5 tallies), data/run-step-capabilities.json and tests/fixtures/399/recorded-job-command-yes-no.json (3 names out; the list is made from the book inventory, so the planner states how the 3 rows leave: a regenerate or a dated manual row), tests/test-400-description-budget.cjs (leg B1 gains a rule: a file may leave the set when data/command-deprecations.json names its command; the fixture drops 12 rows and the total), tests/test-389-retire-brief.cjs (test 1 becomes "both stub files are absent", test 3 becomes "the deprecation entry exists"), tests/test-389-session-report.cjs (takes its "absent" branch), tests/fixtures/341-registry-drift-baseline.json, tests/fixtures/267/shape-violations-baseline.txt, data/harness-manifest.json.
- AC5.1 `ls commands | wc -l` is 107 and skills is 119. AC5.2 `node scripts/check-registry-drift.cjs` passes with 6 new entries. AC5.3 the per-command pattern returns only keep-list files. AC5.4 each redirect target works: `/mos:doctor --heal-room`, `/mos:doctor --ui-compliance --json`, `/mos:rooms organize`, `/mos:dashboard --mermaid`, `/mos:session-report`, `/mos:structure-argument` (one run each, output in the SUMMARY). AC5.5 `bash tests/run-all-389.sh`, `run-all-399.sh`, `run-all-400.sh` pass. AC5.6 the count pins of 405 (GOVERNED, PURE_READ, test-270) do not move.
- Saving: about 870 lines on disk and 6 names in the skill listing.

### Slice 6: short firing block from the one generator

WAITS for 405 slice 12 (the Shape F contract v2 fixes the words) and for the 405 foundation (rooms.md and doctor.md carry the block).

- Decision D6.1: no include file. The generator scripts/stamp-firing-block.cjs is the one source already. The slice shortens CANONICAL_FIRING_BLOCK and bumps the marker to v3.
- Pattern: the block between `<!-- mos:firing-block v2 -->` and `<!-- /mos:firing-block -->`. Count: 170 files, 998 B each.
- Step 0: explain the 11 pending files of `--check` (RESEARCH section 4). Do not stamp before the cause is known.
- New text, at most 400 B, 4 rules: fire the declared shape as a card when the fork is real and unanswered; do not fire when the navigator already answered; never print the selector as text or build a widget; a text list is the floor where no card tool exists. It names no lib/ file and no host-specific tool, so that the chat reads it correctly; the exact words follow the Shape F contract v2 and the OR-20 order (job, Feynman rule, research rules).
- Codemod: `node scripts/stamp-firing-block.cjs` (strip any marker version, insert v3), then `node scripts/build-skill-mirrors.cjs`; the 2 hand-kept skills (client-discovery-interview, mullins-scaffold) get the same block by the same script or by hand, as the script decides today.
- Pinned tests that move: tests/test-209-stamp-firing-block.cjs, test-209-declared-implies-wired.cjs, test-219-qualify.cjs, test-265-declaration-truth.cjs (marker version and any text pin); scripts/check-shape-declaration.cjs and scripts/build-render-coverage.cjs follow the exported STAMP_MARKER with no edit; data/render-coverage-registry.json regenerates.
- AC6.1 `stamp-firing-block --check` exits 0. AC6.2 170 files carry v3 and 0 carry v2. AC6.3 the block is at most 400 B. AC6.4 the wired counts of `check-shape-declaration` and `check-render-coverage` equal the counts before the slice. AC6.5 a Jev replay or 3 live commands (one F.1, one F.8, one F.9) still fire the card on a real fork and stay silent on an answered one.
- Saving: about 600 B (150 tokens) per command or skill invocation; about 100 KB on disk; 0 at session start.

### Slice 7: caps and the size test

WAITS for the 405 foundation (405 adds description bytes and edits doctor.md; a cap set before it would block or be re-based).

- Create tests/test-401-size-caps.cjs:
  - Z1 surface description cap: every `description` of a command, skill or agent is at most CAP_DESC bytes (owner item O6; recommended 300 B). Uses `descriptionOf` of test-400-description-budget.cjs (export it; 1 line).
  - Z2 file size: a command, skill or agent file is at most 24,000 B, except the files in tests/fixtures/401/size-exceptions.json, each with its byte ceiling taken at slice time; an exception may shrink, never grow; a new file gets no exception.
  - Z3 MCP tool description: every tool description of the mindrian-os and mindrian-brain servers is at most 2,048 B (half of the 4,096-character host limit for a tool loaded up front). Uses the lister of test-270 (export `listToolsOverStdio`; 1 line).
  - Z4 mutation arms for Z1 to Z3.
- Trims for Z1 at 300 B: 5 hand-kept skills (trending-to-absurd, mullins-scaffold, mos-deck-engine, client-discovery-interview, intelligence-orchestrator) and 2 agents (dominant-design-researcher, analogy-query-fetcher). Each trimmed text keeps the "when to use" words, because the Desktop chat finds a skill by its description (program C22). No command or mirror needs a trim at 300 B.
- Relation to test-270: test-270 keeps the total (10 percent drift) and the exact count; Z3 adds the limit for one tool. test-270 is not re-based by this slice. Relation to test-400-description-budget: it keeps "no growth against the base"; Z1 adds the absolute limit. Trims lower the bytes, which leg B1 allows.
- If gate_answer is above 2,048 B after 405 slice 3, this slice trims it and test-270 follows inside its tolerance.
- AC7.1 Z1 to Z4 pass. AC7.2 test-400-description-budget passes with its fixture unchanged. AC7.3 the 7 trimmed descriptions still name their trigger words (a row per file in the SUMMARY: before, after). AC7.4 dist regenerated; the Zed catalog budget check of tests/test-234-dist-bundle.cjs passes.
- Saving: up to 1,885 B in a host that lists descriptions; 0 in the owner's host today. The value is the limit, not the bytes.

## 5. Keep-lists

### 5.1 Keep-list A: files that keep `mcp__mindrian-brain__` (35 files; with the 41 in-scope files, the 3 moved files and the 36 generated dist files this is 115)

| Group | Files | Reason |
|---|---|---|
| Part 8 matcher and guard fixtures (10) | tests/test-260906-gr1-brain-shaped-tool-gate.cjs, test-260917-dgf-part8-hook-disposition.cjs, test-386-b2-brain-write-blocked.cjs, test-386-web-credential-hook.cjs, test-395-egress-leaks.cjs, test-396-theo-route-matrix.cjs, test-brain-response-sanitize.cjs, test-366-guard-navigator-release.cjs, test-245-brain-envelope-shape.cjs, tests/fixtures/392-part8-replay/route-matrix.json | they prove that the guard inspects the project-scope and user-scope name; a rewrite removes the proof |
| History constants (1) | tests/test-391-agent-tools-naming.cjs (ALLOWED_BEFORE, rule A13) | records the state before owner card C1 |
| Comments on the matcher scopes (4) | lib/core/brain-response-sanitize.cjs, scripts/part8-egress-guard-hook.cjs, scripts/brain-response-sanitize-hook.cjs, lib/core/security/agentshield-scanner.cjs | they document why the unscoped form is covered |
| Synthetic hook inputs (2) | scripts/measure-hook-cold-start.cjs:174, tools/perf/perf-harness.cjs:70 | any name that the matcher catches is correct there |
| Comments on past fixes (3) | scripts/migrate-skill-frontmatter.cjs:30, lib/memory/run-feynman-tests.cjs:935, tests/run-all-296.sh:27 | history |
| History (3) | CHANGELOG.md, docs/2026-05-12-brain-query-path-optimization.md, docs/257-NOTE-part8-enforcement-locus-rulings.md | records |
| Saved copies (12) | r-and-d/breakthrough-engines/** | an index of copies, not wired, no reader |

Moves (not on the keep-list): lib/memory/brain-server-resolution.test.cjs, lib/core/mullins-scaffold.cjs and its test.

### 5.2 Keep-list B: files that keep `mcp-server-brain`

- Class K (exact set, pinned by the keep-list test): scripts/release.sh, scripts/check-release-payload-ceiling.cjs, tests/test-341-payload-shrinkwrap-present.cjs, tests/test-267-mcpv2-sdk-era.cjs, lib/core/room-auto-create.test.cjs, lib/core/venture-shape-nudge.test.cjs, tests/test-room-auto-create-fingerprint-integration.cjs, tests/test-render-v2-provenance.cjs, lib/core/room-auto-create.cjs, lib/core/breakthrough/detectors.cjs. Reason: each one blocks the folder from a release or from a require. They stay correct when the folder is gone, and they stop it from coming back.
- Class H: docs/ (21 files), CHANGELOG.md, data/capability-ledger.json. Reason: records of past work.
- This keep-list is a reading of R4 ("every reference"). Owner item O1 confirms or rejects it.

### 5.3 Keep-list C: `pws-brain-mcp` (all 75 files stay)

hooks/hooks.json:208 and :332, lib/core/brain-response-sanitize.cjs:151, data/theo-tool-classes.json:13, scripts/part8-real-calls-extract.cjs:51-52, commands/doctor.md:86 with its mirror, 25 tests, 34 docs. Reason: owner ruling 2026-11-18. Phase 401 makes 0 edits for this pattern.

## 6. File table

| Slice | Create | Modify | Delete |
|---|---|---|---|
| 1 | scripts/dev/401-measure.cjs, tests/test-401-keep-list.cjs, tests/run-all-401.sh (or extend) | none | none |
| 2 | scripts/brain-admin.cjs (moved, if O2 = move) | commands/admin.md and its mirror, lib/core/arbitration.cjs, lib/core/doctor/mcp-surface-module.cjs, lib/memory/test-rs-brain-substrate-shape.cjs, tests/test-brain-client-params.cjs, skills/brain-connector/SKILL.md, scripts/admin-brain-write.cjs, lib/brain/curation-batch.cjs, lib/memory/run-feynman-tests.cjs, tests/run-all-3696.sh, tests/run-all-127.sh, tests/fixtures/3696-known-failures.json, .gitignore, .env.brain.template, tests/test-401-keep-list.cjs, dist/ | mcp-server-brain/ (15), tests/127.1-query-embedder.test.cjs, tests/test-127.2-00-brain-edge-bundle.sh, lib/memory/mcp-server-brain-deps.test.cjs, scripts/export-pinecone-embeddings.cjs, scripts/load-embeddings-into-neo4j.cjs (if O3 = delete) |
| 3 | scripts/dev/401-brain-name-codemod.cjs, tests/test-401-brain-tool-names.cjs | 16 commands and their 16 mirrors, skills/brain-connector/SKILL.md, 6 agents, references/brain/query-patterns.md, references/brain/schema.md, lib/core/rs-nl-to-query.cjs, lib/memory/brain-server-resolution.test.cjs, lib/core/mullins-scaffold.cjs and its test, tests/test-391-agent-tools-naming.cjs (only if O4 = yes), dist/ | none |
| 4 | lib/mcp/strip-schema-uri.cjs, tests/test-401-schema-strip.cjs | scripts/mindrian-mcp-server.cjs (1 call), scripts/mindrian-brain-mcp-client.cjs (1 call), tests/test-270-tool-schema-budget.cjs (AFTER), tests/fixtures/384-s7-tools-list-golden.json | none |
| 5 | none | data/command-deprecations.json, the generated registries and ledgers of the precedent, data/run-step-capabilities.json, the tests and fixtures named in the slice, lib/mos-face/dist, ui/ command lists, dist/ | 6 commands, 6 skills, code that only they used |
| 6 | none | scripts/stamp-firing-block.cjs, 84 commands, 86 skills, 4 tests, data/render-coverage-registry.json, dist/ | none |
| 7 | tests/test-401-size-caps.cjs, tests/fixtures/401/size-exceptions.json | 5 skills, 2 agents, tests/test-400-description-budget.cjs (1 export), tests/test-270-tool-schema-budget.cjs (1 export), dist/ | none |

## 7. Order against Phase 405

| Slice | Before the 405 foundation | Gate |
|---|---|---|
| 1 keep-list guard | YES, any time | none |
| 2 R4 removal | YES | F1 on main; O1, O2, O3 answered; main not frozen |
| 3 Brain names | WAITS | F1 on main; 405 slice 10 merged; SP8 verdict |
| 4 `$schema` strip | WAITS | 405 foundation merged; planned with the 402 `_meta` change |
| 5 expired commands | WAITS | 405 foundation merged; O5 answered |
| 6 firing block | WAITS | 405 slice 12 merged (Shape F contract v2) |
| 7 caps and size test | WAITS | 405 foundation merged; O6 answered; last slice of 401 |

Order inside the waiting group: 3, 5, 6, 7 (each edits commands and regenerates mirrors and dist; one at a time); 4 is independent of them. Before Phase 404 starts: slices 3 and 5 are done, so recipes are written on clean names and on 107 commands.

This differs from 401-405-PROGRAM.md note E6 in one point: R4 does not touch scripts/release.sh in this design, so it does not overlap 405 slice 9.

## 8. Risks

1. R4 breaks an operator tool that someone still uses (/mos:admin, the curation scripts). Control: O2 and O3 before the slice; AC2.3.
2. A sweep rewrites a Part 8 fixture. Control: slice 1 runs first; the codemod has a fixed folder scope; AC3.1.
3. Live `allowed-tools` (after F1) plus correct names removes permission prompts for Brain reads in 10 commands. This is the intended meaning of the field, but it is a behaviour change. Control: AC3.5; the guard hook still runs; `brain_write` is never listed.
4. The bare-name prose form is resolved less well than a full name. GUESS, low. Control: AC3.5 and one more command; fallback: write the full CLI name in prose.
5. The `$schema` strip uses an SDK accessor that a later SDK version removes. Control: the helper fails safe (no strip, a stderr line), and T1 fails the build.
6. The first dist regeneration is a large diff and may differ by machine. Control: its own commit; open check 4 of the RESEARCH is run in slice 2.
7. Count pins of Phase 400 move in slice 5 while 404 reads the same list. Control: slice 5 before 404.
8. The short firing block changes card behaviour. Control: AC6.5; the words come from the Shape F contract.
9. The description cap hurts skill discovery in the chat (C22). Control: 300 B, not 200 B; AC7.3.
10. test-270 is re-based by 401, 402, 404, 405 and 400.5. Control: slice 4 is the only 401 re-base and it is planned with 402.

## 9. Owner items (one question each)

- O1. R4 says "every reference". May the name `mcp-server-brain` stay in history files (docs, changelog) and in the checks that stop the folder from shipping again? Recommendation: YES. The checks are the lock on the door; the docs are the record.
- O2. `/mos:admin` (key list, create, revoke) runs one file inside the folder. Move that one file to scripts/ so the command keeps working, or retire the key commands? Recommendation: MOVE it. It is one file with no dependencies.
- O3. Four operator scripts need the old Neo4j driver in the folder. Delete the two one-time migration scripts and make the two write tools answer "this Brain back end is retired"? Recommendation: YES.
- O4. Three agents (brain-query, investor, research) still list the retired Pinecone search tool, from your card C1 of 2026-11-08. Remove it? Recommendation: YES. The tool does not exist.
- O5. Six commands are past their removal date (hmi-status, organize, heal, visualize, mva-report, mva-brief). Remove all six after the 405 foundation? The command count goes from 113 to 107 and the run-step list from 73 to 70. Recommendation: YES.
- O6. Description limit: 300 B (7 files to trim, discovery in chat stays safe) or 200 B from the study (20 files to trim)? Recommendation: 300 B.
- O7. The ROADMAP title of 401 names "nav-block trims". The nav block lives in scripts/intent-classifier.cjs, which 402 (K3) and 400.5 change. Move the nav-block trims to 402? Recommendation: YES.

## 10. What a reviewer should attack

- Is any file on a keep-list wrongly kept or wrongly moved (section 5 against RESEARCH 1.4 and 2.2)?
- Does decision D3.1 (bare names in prose) hold on all three surfaces?
- Is slice 2 really free of 405 files?
- Is the wait of slice 3 for slice 10 needed, or only prudent?
- Does any AC depend on a number that F1 will change?
