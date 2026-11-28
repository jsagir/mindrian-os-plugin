# Plan 401-02 Summary

## Task 1 OR-47 pass

1. A top professional would also verify the release payload and network refusal in a clean checkout. Those checks are outside this task run.
2. Raw material: the current admin write script has an execute path after a Brain pre-check. The curation batch opens a Neo4j driver from the legacy folder. The keep-list guard currently checks only its fixed ten paths. The runner currently has five legs.
3. Methods and tools: use CommonJS tests with Node built-ins, a temporary home for each run, the sibling checkout for dependencies, and the existing runner helpers. Keep the test red on the named legs.
4. Outside evidence: the lane session supplied the gate baseline files. No separate reviewer result is available yet.

## Task 1 preflight

- BASE-02: 735433584c59db5c51994cd86e6a42c8d756fd0f
- HEAD: 735433584c59db5c51994cd86e6a42c8d756fd0f
- Branch: work/401-hygiene
- Initial worktree status: clean
- Exact root `.env` check: `ABSENT`
- `mcp-server-brain/node_modules`: absent
- `mcp-server-brain/.env`: absent
- `tools/brain-admin`: absent
- Tracked files under `mcp-server-brain`: 15
- Admin tool references in `commands/admin.md`: 9
- Required preflight files: all present
- `isAvailable()` lines: `function isAvailable() {`; `return typeof BRAIN_URL === 'string' && BRAIN_URL.length > 0;`; `}`
- Dependency probe with sibling NODE_PATH: zod and gray-matter load. `@modelcontextprotocol/sdk/server/mcp.js` is missing.

## Gate baseline supplied by lane session

| Gate | Exit | Gate | Exit |
|---|---:|---|---:|
| CG1 | 0 | XG1 | 1 |
| CG2 | 0 | XG2 | 0 |
| CG3 | 0 | XG3 | 1 |
| CG4 | 0 | XG4 | 0 |
| CG5 | 0 | XG5 | 1 |
| CG6 | 0 | XG6 | 1 |
| CG7 | 1 | XG7 | 1 |
| CG8 | 0 | XG8 | 0 |
| CG9 | 0 | XG9 | 0 |
| CG10 | 0 | XG10a | 1 |
| CG11 | 0 | XG10b | 1 |
| CG12 | 0 | XG11 | 0 |
| CG13 | 0 | XG12 | 1 |
| CG14 | 0 | XG13 | 0 |
|  |  | XG14a | 0 |
|  |  | XG14b | 0 |
|  |  | XG14c | 0 |

Baseline output files are under `evidence/401-02/before/`. Their failing leg names still need recording from the full outputs.

## Planner readings and open items

- PR-1: place the operator tool check after the admin identity check and before subcommand parsing.
- PR-2: refuse `--execute` only when `--dry-run` is absent.
- PR-3: remove the orphan comment in `.gitignore`; remove the named obsolete prose from `.env.brain.template`; preserve the complete `getNeo4jCreds reads` sentence.
- PA-1: APPLY is present in the executor prompt. This run is Task 1 only, so Task 2 Step 5b is not in scope here.
- UNVERIFIED: whether Theo still reads the Supabase key table. Continue per the lane clarification.

## Outside evidence

PENDING (not the builder)

## Task 1 work and results

- Created `tests/test-401-admin-tool-not-shipped.cjs` with P1 to P4.
- Created `tests/test-401-brain-backend-retired.cjs` with R1 to R4.
- Changed L3 to compare the exact tracked set. Added EXPECTED_K and a new-file mutation arm.
- Added the two test legs to `tests/run-all-401.sh`.
- Fast checks passed: three `node --check` commands, `bash -n tests/run-all-401.sh`, and `git diff --check`.
- A test run attempted P1 to P4. P1 passed. P2 and P3 could not measure the payload because the sandbox returned EPERM while spawning Node for npm pack. P4 failed as expected because the tool has not moved.
- A test run attempted R1 to R4 with `--red-before`. All four legs failed as expected. R1 also hit sandbox EPERM while spawning Node, so its intended refusal behavior remains unverified here.
- The initial keep-list run used a fallback walk after its git subprocess received EPERM. That run showed the expected extra paths, but L4 control failed. The final test now uses git ls-files for a worktree and removes the legacy literal from the control fixture. Do not run this leg here. The lane session must stage the four Task 1 files and run it.
- Expected staged red lines: `ok: P1 ok: P2 ok: P3 FAIL: P4 `; `FAIL: R1 FAIL: R2 FAIL: R3 FAIL: R4 `; `ok: L1 ok: L2 FAIL: L3 ok: L4 `.
- Expected L3 extra paths are recorded in `evidence/401-02/mid/test-401-keep-list.txt`. The list has 24 paths outside the legacy folder and 5 paths inside it. Expected missing paths: none.
- No git write or gate run was performed.

COMMIT POINT 1: tests/test-401-admin-tool-not-shipped.cjs tests/test-401-brain-backend-retired.cjs tests/test-401-keep-list.cjs tests/run-all-401.sh test(401-02): add the payload test, the refusal test and the exact keep-list set (red: P4, R1 R2 R3 R4, L3)

## Report

STATUS: PARTIAL
CHANGED: 401-02-SUMMARY.md, tests/test-401-admin-tool-not-shipped.cjs, tests/test-401-brain-backend-retired.cjs, tests/test-401-keep-list.cjs, tests/run-all-401.sh
VERIFIED: clean BASE-02 preflight; exact `.env` result ABSENT; syntax checks; shell syntax check; git diff --check; baseline exit codes copied
UNVERIFIED: staged test outputs; npm payload leg because sandbox spawn returned EPERM; R1 refusal behavior because sandbox spawn returned EPERM; Theo key table use; reviewer evidence
RISKS: the lane session must run the staged Step 6 tests before commit point 1
NEXT: stage the four listed paths in the lane session, run the three tests, and commit with the listed message

## Task 2 OR-47 pass

1. A top professional would also check the package file list and the refusal audit in a clean archive. The lane session owns that outside evidence.
2. Raw material: the admin tool reads a local `.env` file and contains four em dashes. The write wrapper has a live Neo4j path. The curation batch opens a direct driver after a credential check. The two embedding scripts remain in the tree.
3. Methods and tools: copy the admin tool to its approved path, edit the named sections, regenerate the admin mirror, and run only the named fast checks and tests. Use a temporary home and the sibling dependency path.
4. Outside evidence: the lane session supplied Task 1 red outputs and the gate baseline. No Task 2 reviewer result is available yet.

Task 1 lane-session evidence: P4, R1 to R4, and L3 were red as planned. The L3 extra paths are in `evidence/401-02/task1/red-L.txt`.

## Task 2 work and results

- Copied the admin tool to `tools/brain-admin/brain-admin.cjs`, removed the old copy, and replaced its four em dashes with hyphens.
- Added `tools/brain-admin/.env.example` with blank variable values. The `.env` ignore check named the expected rule, and the example file was not ignored.
- The moved tool start check exited 1 and printed `SUPABASE_URL not set` on stderr. It made no network call.
- Changed the nine command calls to the new tool path. Added the Step 1b operator check and applied PA-1 to the brain-write instructions. The generated admin mirror was rebuilt and passed `--check`.
- Added the typed refusal to `scripts/admin-brain-write.cjs`. Removed its driver credential and write helpers and the execute path. Removed the two retired embedding scripts.
- Changed `curation-batch.cjs` so its driver loader throws the typed refusal and its live path calls that loader first. Removed the retired audit helper. Preserved the credential loader and export.
- Task 1 test correction: R4 used an invalid batch ID. Changed it to the valid Phase 132 format required by `makeBatch`.
- Passed: `node --check` for all three changed JavaScript files; skill mirror generation and `--check`; the moved-tool start check; R2, R3, and R4; `.env` ignore checks; zero retired tokens in both write files; ten command references to the new tool; zero old folder tokens in the command and mirror; and absence of both embedding scripts.
- The R1 test could not spawn its child Node process. The sandbox returned EPERM. The P2 and P3 legs could not run `npm pack`; the sandbox returned EPERM. P1 and P4 passed.
- The broader Task 2 test result was R2 and R3 and R4 passed; R1 remains unverified in this sandbox. P1 and P4 passed; P2 and P3 remain unverified in this sandbox.
- CG14, XG14, and all XG runs were skipped as assigned to the lane session.

COMMIT POINT 2: tools/brain-admin/brain-admin.cjs tools/brain-admin/.env.example commands/admin.md skills/admin/SKILL.md mcp-server-brain/brain-admin.cjs feat(401-02): move the Brain admin key tool to tools/brain-admin, outside the npm package, and point /mos:admin at it (owner ruling O2)

COMMIT POINT 3: scripts/admin-brain-write.cjs lib/brain/curation-batch.cjs scripts/export-pinecone-embeddings.cjs scripts/load-embeddings-into-neo4j.cjs fix(401-02): the 2 direct Neo4j write paths answer brain_backend_retired; delete the 2 retired embedding scripts (owner ruling O3)

## Report

STATUS: PARTIAL
CHANGED: Task 2 source files and two script deletions listed above; no commits were made by the builder
VERIFIED: three JavaScript syntax checks; skill mirror build and check; moved-tool start check; R2, R3, R4; ignore checks; required grep checks; script absence; git diff --check
UNVERIFIED: R1 and P2/P3 due sandbox EPERM; outside evidence; CG14, XG14, other XG runs; substrate count; lane session commits
RISKS: outside evidence and the lane session commits remain pending
NEXT: lane session runs the assigned checks and commits the paths at commit points 2 and 3

## Task 3 OR-47 pass

1. A top professional would also review the deletion set against tracked references and check the retired folder from a clean archive. The lane session owns archive evidence.
2. Raw material: the live tree has 14 tracked files under `mcp-server-brain/`. The runner pins 202 substrate violations. The legacy loader script held 3 findings.
3. Methods and tools: update the named baseline pin, remove only named files and rows, preserve the scoped tool-name comment, and run the named fast checks with a temporary home.
4. Outside evidence: the lane session supplied the Task 2 results: R1 to R4 and P1 to P4 passed; refusal stderr, exit 1, and the audit outcome were correct. No separate reviewer result is available.

Task 2 lane-session result: commits `4ce8db8fa`, `759dea778`, and correction `4d58f8d76`. The correction fixed the R4 batch ID. R1 to R4 passed; P1 to P4 passed. The refusal printed its required stderr line, exited 1, and wrote `{"outcome":"refused","reason":"brain_backend_retired"}`. XG2, XG8, XG11, and XG14 exit codes matched baseline. XG6, XG7, and XG13 had the same failing lines as baseline.

COMMIT POINT A: tests/run-all-261127-bnd.sh test(401-02): the substrate baseline pin moves from 202 to 199 (the deleted load-embeddings script held 3 findings)


## Step A and Task 3 results

- Substrate baseline: 202 before deletion; 199 after deletion, as reported by the lane session. The removed loader held 3 findings.
- Changed only the substrate baseline label and expected text from 202 to 199 in `tests/run-all-261127-bnd.sh`.
- Task 3 removed the three named tests, the 14 tracked files under `mcp-server-brain/`, and the named runner and fixture rows. The JSON fixture parsed successfully.
- The Feynman runner now omits the two deleted suite rows. Its query-embedder comment names the retired server. The `mcp__mindrian-brain__` comment remains unchanged.
- The 5 class E pointers were reworded as specified. The `.gitignore` block and obsolete `.env.brain.template` sentences were removed.
- AC2.4 search: no output; exit 1 because there were no matches. Reference count outside docs, CHANGELOG, planning, and dist: 14.
- Keep-list test: L1 and L2 printed ok. The test stopped before L3 because its child `git ls-files` process returned EPERM. The lane session must repeat it after staging. Expected staged line: `ok: L1 ok: L2 FAIL: L3 ok: L4 `. Expected L3 extras: the 4 dist skill files; expected missing paths: none.
- CG1 passed. CG12 (`check-frontmatter-split`) passed. The known-failure JSON parsed. `git diff --check` passed.
- Release payload ceiling and release hash files were unchanged; the requested diff stat was empty.

COMMIT POINT 4: mcp-server-brain tests/127.1-query-embedder.test.cjs tests/test-127.2-00-brain-edge-bundle.sh lib/memory/mcp-server-brain-deps.test.cjs lib/memory/run-feynman-tests.cjs tests/run-all-3696.sh tests/fixtures/3696-known-failures.json tests/run-all-127.sh .gitignore .env.brain.template chore(401-02): remove the legacy mcp-server-brain folder with the tests and runner rows that served it (owner ruling R4). Body pins: 1 known-failures entry removed, 2 Feynman rows removed, 1 run-all-127 row removed, and 1 run-all-3696 row removed.

COMMIT POINT 5: lib/core/arbitration.cjs lib/core/doctor/mcp-surface-module.cjs lib/memory/test-rs-brain-substrate-shape.cjs tests/test-brain-client-params.cjs skills/brain-connector/SKILL.md docs(401-02): reword 5 pointers that named the removed folder

COMMIT POINT A: tests/run-all-261127-bnd.sh test(401-02): the substrate baseline pin moves from 202 to 199 (the deleted load-embeddings script held 3 findings)


## Task 3 report

STATUS: PARTIAL
CHANGED: tests/run-all-261127-bnd.sh and the Task 3 removal, runner, fixture, and pointer files listed above; no git writes were made
VERIFIED: JSON parse; AC2.4 search had no matches; reference count 14; CG1 and CG12 passed; release and hash diff was empty; git diff --check passed
UNVERIFIED: staged L3 result; lane session commits; outside archive evidence
RISKS: the keep-list child git process returned EPERM before L3
NEXT: lane session stages and commits at commit points A, 4, and 5, then repeats the staged keep-list test

## Lane session state (BLOCKED at Task 3 commit 4)

Commits made on work/401-hygiene for this plan: 82f0288ef (Task 1 red tests), 4d58f8d76 (R4 batch id correction), 4ce8db8fa (tool move, PA-1 applied), 759dea778 (refusal, 2 scripts deleted), 68145f747 (substrate pin 202 to 199), 54f551528 (5 pointers reworded).

Substrate pin: the deleted scripts/load-embeddings-into-neo4j.cjs (O3) held 3 findings of `node scripts/check-substrate.cjs --baseline`. The count went from 202 to 199; the other 199 lines are the same (compared line by line). tests/run-all-261127-bnd.sh pinned 202. The plan does not name this pin. The lane session moved it to 199 in its own commit, so that G-BND stays PASS=79. The orchestrator can revert 68145f747 if it does not accept the move.

Deviation repaired before staging: the builder removed the sentence "v1.11.2 defaults to users pointing `mindrian-brain` at their own Neo4j MCP." from .env.brain.template; PR-3 keeps it. A second builder run restored it.

Task 3 checks after staging (PROVEN): `git ls-files mcp-server-brain` prints 0 lines; 14 files outside docs, CHANGELOG.md, .planning and dist hold the folder name; the AC2.4 grep prints nothing; leg line `ok: L1 ok: L2 FAIL: L3 ok: L4` with L3 extra = the 4 dist files only and 0 missing; the line 935 of lib/memory/run-feynman-tests.cjs is byte-identical; scripts/release.sh, scripts/check-release-payload-ceiling.cjs and the 2 step-hash fixtures have no diff from BASE-02.

RESOLVED BLOCKER: commit 4 (the folder, the 3 tests, the runner rows) was refused by the pre-commit hook. scripts/check-schema-aliases.cjs ran its table regex over the whole staged diff, removed lines included, so the removed DDL lines of mcp-server-brain/sql/01-brain-api-keys.sql (2 key tables) read as new tables. Hook output: evidence/401-02/blocked/schema-guard.txt. Orchestrator decision (1): the guard scans only the added lines. Fix commit 79c9f7c6c with the new test tests/test-401-guard-added-lines.cjs (G1 an added unknown table fails, G2 a removed table passes, G3 the line filter, G4 an index on an unknown table fails, G5 an allowed table passes; red before: G1, green after: 5 of 5). Then commit 4 went in the normal way: ffa5d16af. No --no-verify, no hook switch.

## Second lane run: Task 3 commit 4 and Task 4

### OR-47 pass (Task 4)

1. A top professional would also regenerate dist from a clean tree, run the generator twice to prove it is stable, and check the generated tree for machine paths.
2. Rawest material: the source skills under skills/, the generator scripts/build-dist-bundles.cjs, and the dist tree last built at 2.0.0-beta.52.
3. Methods and tools: the generator with a temp home and a closed Brain port, --check-stale, tests/test-234-dist-bundle.cjs, tests/test-401-no-brain-preapproval.cjs, tests/test-401-keep-list.cjs, git diff --stat for the 2 runs.
4. Outside evidence: test-234 compares each bundled SKILL.md byte by byte with its source, and the 401-03a live check (PASS) shows the hosts ask before a Brain read tool.

### Commits

- 79c9f7c6c fix(401-guard): orchestrator decision (1). The schema alias guard scans only the added lines of the staged diff. New test tests/test-401-guard-added-lines.cjs. Red before: G1. Green after: 5 of 5.
- ffa5d16af Task 3 commit 4: the folder deletion (23 paths). No --no-verify.
- 57896e315 merge of stage/400.5-405 into the lane (no conflict).
- 105deb380 dist regeneration: 273 tracked dist files before, 271 after; 4 files named the folder before, 0 after; 8 bundled skills with no source removed.
- c698842b8 the pre-approval leg of tests/run-all-401.sh is a plain leg.

### Substrate pin check (orchestrator decision 2)

The scan of scripts/check-substrate.cjs (scanFiles) on scripts/load-embeddings-into-neo4j.cjs at revision 759dea778^ gives exactly 3 findings, rule m4-cypher-interpolation, lines 339, 348 and 450. The other deleted script, scripts/export-pinecone-embeddings.cjs, gives 0. The pin move 202 to 199 (68145f747) stays. PROVEN.

### Task 4 checks (PROVEN)

- Before: test-401-no-brain-preapproval leg line `ok: Q1 ok: Q2 FAIL: Q3 ok: Q4 ok: Q5 ok: Q6`, exit 1 (red proof of the runner change). test-234 red on 4 checks (skill names of the 2 bundles, byte identity, measurement).
- After: keep-list `ok: L1 ok: L2 ok: L3 ok: L4`; pre-approval Q1 to Q6 ok; test-234 OK; --check-stale exit 0; second generator run gives the same diff stat; no dist file names the folder; the generator wrote only under dist/; every bundled skill folder has a source folder; dist/generic-claude-dir/.mcp.json is ignored by git.
- tools/401/measure.cjs --no-tools: legacy-folder tracked_inside_folder 0 (evidence/401-02/after/measure.txt).

### Gates after (PROVEN, evidence/401-02/after-gates/)

All exit 0: run-all-401 (PASSED=7 KNOWN=0), run-all-261127-bnd (PASS=79), run-all-402, run-all-403 (PASSED=11), check-frontmatter-split, check-tool-grants, build-connector-registry, build-orchestration-projection, check-render-coverage, run-harness --check (12 pass, 0 fail), build-dist-bundles --check-stale, build-skill-mirrors --check.

### Open item

3 source skills (admin, dogfood-flush, help) hold a literal operator home path in their operator-check text. dist copies them byte for byte, as before the regeneration (the old dist held the same lines, plus doctor). This plan does not change source skills. Not fixed here.
