# 401-01 Summary

## Review fixes
- `measure.cjs` now uses `git ls-files -z` before its sorted walk fallback, avoiding fragile index parsing; the keep-list mutation arms now require failures to name the mutated path.

## OR-47: Task 1
1. A top professional also checks that the measurement tool stays read-only and that its counts match independent disk scans.
2. The raw material is the tracked tree at BASE-01, the plan-listed files, and live `tools/list` replies from both MCP entry points.
3. The methods are tracked-file enumeration, literal scans, frontmatter parsing, marker extraction, and hermetic MCP subprocess calls. The tools are Node.js, Git, and the repository helper.
4. Outside evidence from the lane session and reviewer is pending.

## OR-47: Task 2
1. A top professional also verifies that each mutation arm fails for the intended leg and reports the affected path.
2. The raw material is the 45 guarded paths, the hook matchers, the sanitizer declaration and export, and the retired server data.
3. The methods are root-relative reads, isolated temporary copies, literal removal, and the existing runner helper. The tools are Node.js and Bash.
4. Outside evidence from the lane session and reviewer is pending.

## Preflight
- BASE-01: b2e7e9d049d637e48e87c86eb8d45063dc6a1e56
- Stage tip: 4314d335a
- Working branch: work/401-hygiene
- Working tree before edits: clean
- Required existing files: all present
- Required absent files: tools/401/measure.cjs and tests/test-401-keep-list.cjs
- Frontmatter split check: exit 0
- Tool grants check: exit 0
- `pws-brain-mcp` in hooks/hooks.json: 2
- Matcher declaration count: 1
- Dependencies: MCP SDK unavailable from the worktree. Sibling node_modules is available through NODE_PATH.

## Measured counts
The origin values below come from the plan context. The BASE-01 values come from the working index. The current uncommitted files are not in the index and are excluded by the specified tracked-file rule.

| Measure | Origin value | BASE-01 value | Cause of difference |
|---|---:|---:|---|
| `mcp__mindrian-brain__` holding files and occurrences | 115 files, 262 occurrences | 105 files, 236 occurrences | The F1 plan removed Brain entries from commands and mirrors. It also added test arms that hold the pattern. Net change is 10 fewer files and 26 fewer occurrences. |
| In-scope files under commands, skills, agents, references | Not supplied | 27 files | Measured from disk. |
| `pipelines/` files holding `mcp__mindrian-brain__` | Not supplied | 1 file | The boundary plan left the unscoped name in pipelines/analogy/03-search.md. |
| `mcp-server-brain` holding files outside its folder | 57 files | 57 files | No difference. |
| Tracked files inside `mcp-server-brain/` | 15 files in the folder; 5 hold the literal | 15 tracked files; 5 hold the literal | No difference. |
| All `mcp-server-brain` holding files and occurrences | Not supplied | 62 files, 192 occurrences | 57 are outside the folder and 5 are inside it. |
| `pws-brain-mcp` holding files | 75 files | 75 files | No difference. The measured occurrence count is 200. |
| Dead tool literals in commands, skills, agents, references | Not supplied | `read_neo4j_cypher`: 6 files, 7 occurrences; `get_neo4j_schema`: 9, 10; `mcp__neo4j-brain__`: 6, 8; `mcp__pinecone-brain__`: 4, 10 | No origin values were supplied. |
| Firing blocks | Not supplied | v2: 170 blocks across 170 files; 997 bytes per first block; 2 distinct texts | No origin values were supplied. |
| Expired command and skill paths | Not supplied | All 6 command files and all 6 skill directories exist | No origin values were supplied. |
| Description values | Not supplied | 22,655 bytes; 7 files exceed 300 bytes | No origin values were supplied. |

The Phase 401 tooling group currently has these tracked files that hold one or more measured literals: `tests/test-401-frontmatter-split.cjs` and `tests/test-401-no-brain-preapproval.cjs`. The new files from this plan are untracked and therefore absent from this tracked-index measurement. The script includes their paths after they are tracked.

| Literal | Holding files with group | Occurrences with group | Holding files without group | Occurrences without group |
|---|---:|---:|---:|---:|
| `mcp__mindrian-brain__` | 105 | 236 | 103 | 233 |
| `mcp-server-brain` | 62 | 192 | 60 | 188 |
| `pws-brain-mcp` | 75 | 200 | 73 | 197 |

## Common gates
The lane session ran the baseline and the after run (after the 2 commits, in one temp home, NODE_PATH set). Each exit code after equals its exit code before. CG11 after: PASSED=5 FAILED=0 KNOWN=0. CG14 after: PASS=79 FAIL=0. Outputs: evidence/401-01/before/ and evidence/401-01/after/.

| Gate | Before | After |
|---|---:|---|
| CG1 | 0 | 0 |
| CG2 | 0 | 0 |
| CG3 | 0 | 0 |
| CG4 | 0 | 0 |
| CG5 | 0 | 0 |
| CG6 | 0 | 0 |
| CG7 | 1 (21/25) | 1 (21/25, same 4 failed points) |
| CG8 | 0 | 0 |
| CG9 | 0 | 0 |
| CG10 | 0 | 0 |
| CG11 | 0 | 0 |
| CG12 | 0 | 0 |
| CG13 | 0 | 0 |
| CG14 | 0 | 0 |

CG7 passed 21 of 25 points before the edits. Its expected temporary-home failures were install-state, version-of-record-published, session-start-active-version, and activation-reached-the-wire. The saved outputs are in evidence/401-01/before/.

## Outside evidence
Run by the lane session, not by the builder.
- (a) Independent count at the branch tip 547600583: `git grep -l` gives 105 files for `mcp__mindrian-brain__`, 62 for `mcp-server-brain` (all tracked, with the 5 inside the folder), 75 for `pws-brain-mcp`. They equal the `--json` values. PROVEN.
- (b) Outside mutation on a `git archive HEAD` export: the literal `pws-brain-mcp` removed from the first hooks matcher gives `FAIL: L1 retired literal -- hooks matchers`, exit 1. The literal `mcp-server-brain` removed from the copy of scripts/release.sh gives `FAIL: L3 KEEP_K -- L3 missing scripts/release.sh`, exit 1. In both runs L4 also fails on its control arm, because the arms copy from the mutated root; that is expected. PROVEN.
- Full measure with the tool list (outside the sandbox): exit 0. scripts/mindrian-mcp-server.cjs: 76 tools, 38,236 B of descriptions, 48,014 B of input schemas, 532 B of input `$schema` keys, 182 B of output `$schema` keys, largest description gate_answer 2,028 B. scripts/mindrian-brain-mcp-client.cjs: 6 tools, 1,319 B, 2,468 B, 42 B, 0 B, largest brain_ask 775 B. Saved as evidence/401-01/measure-full.json. PROVEN.
- The G7 failure that the builder saw in the runner is a sandbox effect: outside the sandbox the runner passes 5 of 5 legs. PROVEN.

## EGM run data
Plan check: 1 read-only agent, 72,322 tokens, 1 MAJOR finding (NODE_PATH rule), applied. Builder: 3 Codex runs (run 1 stopped in the gate baseline: run-harness hangs in the Codex sandbox; run 2 built the files; run 3 applied 2 review fixes: the hand parser of the git index removed in favour of `git ls-files -z`, and arms (d) and (e) now also check that the failure names the mutated path). Codex tokens: 31,858, 76,639 and 32,347. Findings: the guard and measure checks pass; the runner reports G7 mutation-arm failures in the tool-grants test under this sandbox.

## Commit points
COMMIT POINT 1: tools/401/measure.cjs feat(401-01): add the read-only measuring script of Phase 401
COMMIT POINT 2: tests/test-401-keep-list.cjs tests/run-all-401.sh test(401-01): add the keep-list guard and its runner leg

## Report
STATUS: DONE
CHANGED: 6aa71e90d (tools/401/measure.cjs), 547600583 (tests/test-401-keep-list.cjs, tests/run-all-401.sh). Plan file commits: 8a50a63b3.
VERIFIED: node tests/test-401-keep-list.cjs: 4 passed, 0 failed; bash tests/run-all-401.sh: PASSED=5 FAILED=0; CG1 to CG14 after equal before; outside evidence (a) and (b) above.
UNVERIFIED: NONE for this plan.
RISKS: the Codex sandbox cannot run some gates (run-harness, npm pack); the lane session runs them.
NEXT: build plan 401-02 on this tip.
