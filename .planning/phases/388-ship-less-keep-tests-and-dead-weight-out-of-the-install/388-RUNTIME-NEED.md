# Phase 388 plan 02: RUNTIME-NEED report

Question: for each of the 462 candidates of 388-candidates.tsv, does anything read it at run time? Answer per file is in 388-safe-set.tsv (columns path, class, verdict, flags, evidence-count, first-evidence). No product file was changed. Marks: PROVEN = I ran it and read the output. UNVERIFIED = not run. ASSUMED = premise.

Tools in this phase folder: 388-runtime-need-scan.cjs (static scan, 8 self-tests, test 6 is a mutation that flips NEEDED to SAFE), 388-fs-trace-preload.cjs and 388-installed-diff.cjs (trace and differential run, 5 self-test groups, including a mutation that makes compare exit 1 and a trace-check that exits 1 when a SAFE path is touched). 388-probe-full.json is the recorded full install (two runs). It is the before state for plan 388-04.

## 1. Method and what each proof covers

| Proof | What it covers | What it does not cover |
|---|---|---|
| Static scan | Literal paths, require and import, path.join and path.resolve with literal segments, file names with extension (also fonts, images, query files), extensionless script names, dynamic reads (readdir, glob, spawn of node with a variable script, require with a variable, join with a variable tail), data/*.json citations (field read and then spawned, required or checked), release and test readers as DEV-ONLY, payload pins. Comments are ignored. | Names computed from pieces at run time. Reads by bash or python scripts. Commands that Claude runs from markdown text. |
| Installed-layout trace | The package packed with `npm pack`, laid out under a scratch HOME like the loader does, then 40 hook commands, the real MCP server (two client identities), `doctor --json` and `doctor --acceptance --json`, with a preload that records every fs call that names a path inside the install (all node child processes inherit it through NODE_OPTIONS). | Child processes that are not node (bash hook scripts, python). Branches the probes did not reach. |
| Differential run | Same probes on the full install (twice, for the stability filter) and on a copy with the SAFE files deleted. Compared: hook exit code, timeout, missing-module text, normalised stdout hash, MCP tool list for both identities, read-only tool answers, every doctor point status. | Same gaps as the trace. |

Environment for every probe (PROVEN by the code): scratch HOME and rooms folder, Brain URL http://127.0.0.1:9, all variables with KEY, TOKEN, SECRET or PASSWORD in the name removed, no Eureka variable, synthetic fixture room, no network call. The layout is the `linked` mode of tests/helpers/eureka-installed-layout-387.cjs (the repo node_modules is linked in; no `npm ci`).

## 2. Static result, then what the trace changed

First static result (PROVEN, 388-runtime-need-scan.cjs scan): SAFE 358 files (5,331,282 bytes), NEEDED 57, UNCERTAIN 33, RULED-KEEP 14.

The trace then touched 132 of those 358 SAFE files in a real reader (see section 3). Those rows moved from SAFE to UNCERTAIN with trace evidence (388-installed-diff.cjs reclassify). A closure pass added more moves by hand, each with a quoted reason in the row:
- data/flagship-floor-set.json: SAFE to UNCERTAIN, because scripts/check-flagship-floor.cjs:74 (a script that stays) reads it.
- lib/mcp/assets/DM-SANS-OFL.txt, FIGTREE-OFL.txt, FONT-SOURCES.md: SAFE to NEEDED. They are the licence and provenance text of the two fonts the server serves (lib/mcp/room-assets.cjs:9). Ship them with the fonts.
- lib/__init__.py and lib/core/__init__.py: SAFE to UNCERTAIN (python package markers for lib/core/rs_*.py, python children are not traced).

Final counts (PROVEN, from 388-safe-set.tsv):

| Class | SAFE | NEEDED | UNCERTAIN | RULED-KEEP |
|---|---|---|---|---|
| T1 test-file (251 files, 3,310,317 bytes) | 208 files, 2,526,701 bytes | 2 files, 38,836 | 41 files, 744,780 | - |
| T2 test-runner (2 files, 158,125 bytes) | 0 | 0 | 2 files, 158,125 | - |
| T3 fixture (0 files) | - | - | - | - |
| T4 bytecode-cache (11 files, 216,053 bytes) | 8 files, 91,666 | 0 | 3 files, 124,387 | - |
| T5 doc-in-code (54 files, 202,427 bytes) | 0 | 51 files, 157,460 | 3 files, 44,967 | - |
| T6 dev-tool-script (16 files, 441,123 bytes) | 0 | 2 files, 18,530 | 14 files, 422,593 | - |
| T7 unreached-module (114 files, 1,404,118 bytes) | 4 files, 85,067 | 5 files, 110,383 | 105 files, 1,208,668 | - |
| T8 test-only-module (14 files, 41,849 bytes) | - | - | - | 14 files, 41,849 (Phase 385 ruling R9 and R10) |
| All (462 files, 5,774,012 bytes) | 220 files, 2,703,434 bytes (5.84 percent of unpackedSize) | 60 files, 325,209 | 168 files, 2,703,520 | 14 files, 41,849 |

Flags on SAFE rows: DEV-ONLY on 133 (only tests, release scripts or build scripts in the repo name them; the install does not), DATA-CITED-NOT-CHECKED on 1, PAYLOAD-PINNED on 0.

The 220 SAFE files (PROVEN, listed in the tsv): 208 `*.test.cjs` files in lib/ (lib/memory 117, lib/core 65 and subfolders, lib/hmi, lib/import, lib/workflow, lib/conversation, lib/render, lib/vault), 8 Python `.pyc` files, 3 data files (data/arbitration-rule-catalogue.json, data/capability-map-registry.json, data/connector-out-of-spine-allowlist.json) and lib/mcp/app-html/mindrian-platform.html.

The reader that came closest to needing each class:
- T1: skills/mos-reason/SKILL.md:197 names lib/memory/feynman-prompts-drift.test.cjs and scripts/post-compact:300 names lib/memory/post-compact-reinjection.test.cjs (both NEEDED). For the 208 SAFE tests the closest reader is the doctor source scans in section 3, which read the file text but do not need it.
- T2: lib/memory/run-feynman-tests.cjs lists 137 of the SAFE tests by name. It is UNCERTAIN only because `doctor.cjs` reads every file under scripts/ and lib/ scans touched it. It is useless without its tests (see section 6).
- T4: Python rebuilds `.pyc` files on demand; scripts/check-worktree-hygiene.cjs names the folder, not a file.
- T5: 51 NEEDED. Most are file-name collisions (ROOM.md, CONTEXT.md, STATE.md, README.md appear as strings in code). That is the conservative rule, not proof of use.
- T6: data/harness-policies/release-payload-ceiling.json and gate-graph-derive-health.json name their runner script, and scripts/run-harness.cjs:188 spawns it (NEEDED). The other 14 are read by doctor lint scans (section 3).
- T7: two fonts (lib/mcp/room-assets.cjs:9) and a query file (references/brain/graph-architecture.md:24) are NEEDED; 71 are UNCERTAIN because doctor scans touched them; 34 are UNCERTAIN for other reasons: 31 by dynamic reads (scripts/run-harness.cjs lists data/harness-policies, scripts/check-hitl-stages.cjs lists data/hitl-stages-fixtures, lib/core/eureka/grade-grant.cjs lists data/grant-rubric-fixtures), plus data/flagship-floor-set.json and the two python package markers. Two single-file sites (lib/mcp/daemon-lifecycle.cjs spawn, lib/core/doctor/class-m-brain-smoke.cjs) make two T1 files UNCERTAIN.

## 3. Trace result

Distinct installed files opened by a real reader, node_modules excluded (PROVEN, 388-probe-full.json run1): hooks (union of 40 commands) 380; MCP server 356 for claude-code and 351 for claude-ai; `doctor --json` 405; `doctor --acceptance --json` 1,732.

`trace-check --full 388-probe-full.json --safe 388-safe-set.tsv` exits 0: no SAFE path was opened, stat-ed, listed or required by any hook, the MCP server or a doctor run. Proof that the check can fail: against the first static list (358 SAFE) it exits 1 and names 132 paths.

What touched the 132 paths (PROVEN): `scripts/doctor.cjs` (point python-floor, `walkScripts` at doctor.cjs:2194 reads every file under scripts/ to grep for three forbidden Python APIs) and `scripts/check-render-coverage.cjs` (scans lib/ source files). These are source lints. They read the file text. They do not need the file. Statuses did not change when the files were deleted (section 4). Those 132 rows stay in the install for now, as UNCERTAIN, and are an owner fork for plan 388-03 (shrink the lint coverage or keep it).

Touches by a packaging walk are counted apart: all 220 final SAFE files were stat-ed by `npm pack --dry-run` inside `doctor --acceptance` (the release-payload-ceiling policy, spawned by scripts/run-harness.cjs). That is a file count, not a use. `trace-check` prints `SAFE paths touched only by a packaging walk: 220`.

## 4. Differential result

PROVEN, 388-installed-diff.cjs compare (full install twice versus reduced install; reduced removed 226 files, a superset of the final 220):
- Hooks: 40 distinct commands, all exit 0, no timeout, no missing-module text, in the full runs and in the reduced run. The same normalised stdout hash in every stable case.
- MCP tools: 75 tools for claude-code and 75 for claude-ai, identical lists in all three runs.
- Read-only tool calls (4 tools with readOnlyHint, 8 calls unbound and bound): identical answers.
- Doctor: 50 points. 0 points were unstable between the two full runs. 0 points differ in the reduced run. `doctor --json` exit 0; `doctor --acceptance --json` exit 1 in both modes (red points are red in both and are not a finding).
- Syntax check of 87 scripts that commands and skills name after CLAUDE_PLUGIN_ROOT: the same in both modes (85 ok, 2 `bash -n` errors in both: scripts/render-pdf and scripts/serve-dashboard-live).
- compare exit 0: "no difference in any stable probe".

## 5. Doctor reads

| Reader | Line | What it reads | What it answers when the path is absent |
|---|---|---|---|
| scripts/doctor.cjs | 2435 and 2441 | `<pluginRoot>/tests/<driver file>` for each acceptance driver | `driver missing: <file>`, point ok:false. tests/ is not shipped today, so this answer already appears in every install. |
| scripts/doctor.cjs | 2500 and 2506 | `tests/claim-harness/run-all-claims.sh` | `claim harness missing: tests/claim-harness/run-all-claims.sh`. Already the answer in every install. |
| lib/core/doctor/room-map-module.cjs | 67 | string compare against `tests/fixtures/icm-rooms` | No read. A path prefix test only. |
| lib/core/doctor/section-ruling-module.cjs | 75 | same prefix test | No read. |
| lib/core/doctor/verify-surface-module.cjs | 43 | `tests/test-cascade-surface-e2e.cjs` | `status: skip`, detail `class D test runner not found`. Already the answer in every install. |
| scripts/doctor.cjs | 2194 to 2215 | every file under scripts/ (python-floor lint) | Fewer files scanned. No status change in the differential. |
| scripts/check-render-coverage.cjs | whole file | lib/ source files and data/render-coverage-registry.json | Fewer files scanned. No status change in the differential. |
| scripts/run-harness.cjs | 188 and 201 | data/harness-policies/*.json, then spawns the `runner` script | The two runner scripts in the policies are NEEDED; no other candidate is a runner. |

Result: no doctor point changes its answer when the 226 files are deleted (PROVEN). The tests/ reads were already "absent" in every real install.

## 6. Owner-visible effects

1. A user can no longer run a shipped test from the installed plugin. Today it works: 3 of 4 sampled shipped tests ran from the extracted package (lib/core/mva-budget.test.cjs, lib/core/room-name-validator.test.cjs, lib/import/branding.test.cjs passed; lib/memory/nav-dial.test.cjs passed 16 of 17) - PROVEN. Class T1 (208 files, 2,526,701 bytes). This is a developer or support use (ASSUMED; no command or skill names these tests).
2. The test runner lib/memory/run-feynman-tests.cjs (157,044 bytes) names 137 of the SAFE tests. If the tests go and the runner stays, the runner reports missing files. It is kept for now only because doctor reads touched it. Owner fork: the runner and its 137 tests leave together (recommended) or stay together.
3. No doctor point changes (section 4, section 5). The doctor source lints read fewer files if the 132 UNCERTAIN lint-touched files are removed later.
4. No hook, MCP tool list or read-only tool answer changes (section 4).
5. One data citation stops being true and no reader notices: data/first-reward-surfaces.json names lib/core/mva-rule-linter.test.cjs; the reader only parses the text (flag DATA-CITED-NOT-CHECKED). data/capability-ledger.json (line 457) and data/harness-policies/contract-parity-larry.json (`pinned_by`) name lib/mcp/no-instructions.test.cjs; that file is UNCERTAIN (a spawn site in lib/mcp/daemon-lifecycle.cjs), so it stays. scripts/run-harness.cjs parses `pinned_by` only as an allowed field name (line 90): no existence check - PROVEN by reading.
6. The Desktop copy (release.sh Step 6.8, built from the pack payload minus bin/ and lib/ui-shell/dist) would shrink by the same 220 files and 2,703,434 bytes (arithmetic, UNVERIFIED, the build was not run). The build limits in scripts/release-lib/build-desktop-artifact.cjs (4,500 files, 180 MB) are maxima, and the script has no list of required files that includes a SAFE path (PROVEN by reading).
7. Existing tests that pin the presence of a removed file: none. I read the ten tests and scripts that inspect the pack (test-341-payload-ceiling, test-341-payload-shrinkwrap-present, test-369-walled-manifest, test-369-installed-layout, test-369.1-desktop-artifact, test-369.1-bin-relocation, test-369.1-sharp-out, test-380-installed-layout, test-quick-261106-critic-baseline-ships, test-387-eureka-installed-layout) plus build-desktop-artifact.cjs, check-release-payload-ceiling.cjs and shrinkwrap-gate.sh. The scanner flags PAYLOAD-PINNED on 0 SAFE rows. The 5 UNCERTAIN rows with that flag (for example scripts/measure-hook-cold-start.cjs, mentioned by tests/test-369-installed-layout.cjs:280) are loaded from the repo, not from the pack; they stay anyway.
8. The ability to run a shipped Python helper is unchanged: `.pyc` files are rebuilt by Python when needed (ASSUMED, Python was not traced). Only 8 `.pyc` files are SAFE.
9. The font licence and provenance files stay (NEEDED), because the fonts ship (licence obligation).

## 7. UNVERIFIED

- Only 4 of 75 MCP tools carry readOnlyHint and were called (8 calls). The other 71 tools were listed, not called. No eureka tool was called.
- The bound room call returned the same text as the unbound call (room-dashboard shows `untitled`): the room binding may not have taken effect, so the bound arm is UNVERIFIED.
- 40 hook commands ran with one synthetic payload each. The network-capable hook scripts/sessionstart-npm-reconcile.cjs was not run (it can call `npm install`). Hook events the payload did not trigger, and hook branches behind real state, were not exercised.
- Commands, skills, agents and pipelines that Claude runs from markdown: 87 named scripts were syntax-checked only (node --check, bash -n, python ast), not executed.
- Child processes that are not node (bash hook scripts, python, git) are not traced. There is no strace in this environment.
- The per machine `npm ci` tree was not built (offline rule). The linked layout uses the repo node_modules, so a node_modules-relative read is not covered.
- Dynamic reads whose directory the scanner could not resolve: 140 reader files have at least one `readdir` or glob argument that is a parameter or a call result (listed by `scan` as UNRESOLVED). The trace covers only the branches the probes reached.
- Paths computed at run time from pieces (for example a name built from a prefix and a counter) cannot be seen by the static scan.
- macOS and Windows installs, and Desktop (claude.ai) installs, were not run.
- The probes ran against the working tree at HEAD 73d6cef3c (the head field of 388-probe-full.json) with peers committing in the same tree. The package under test was packed from that tree during the run.
- The reduced run deleted 226 files, the final SAFE set has 220. The 6 files that moved after the run were all moved toward "kept", so the final set is a subset of what was tested. Subset deletion was not run separately.
