# 403-02 SUMMARY

## OR-47, before the first edit

1. A professional would also compare output quality across a second host version. This adds work beyond this task, so it remains a report item.
2. The raw material is the 7 agent files and leg S7 at BASE, plus the host record in 403-PROBE.md.
3. The methods are the recorded list positions, a focused CommonJS test, the S7 byte guard, the phase runner, static checks, and baseline comparisons.
4. Outside evidence includes the second reader count of host transcripts, the red tests before agent edits, existing contract tests, and the live host run planned for 403-03. The second reader step is done. The live host run remains open.
5. OR-47, Task 2: The changes are one frontmatter line in each of 7 agent files and 3 ledger values. The raw material is the 403-PROBE.md values and those 7 files. The method uses the recorded list positions and edits the ledger row in place. Outside evidence is the red legs L1, L5, and S7 turning green, with host runs planned in 403-03.

## Task 0

### Steps 2 to 4

- PROVEN: START is 4dddb97ed833aaebc61eb19b2798bffbad378a30 on branch work/403-isolated. The worktree was clean before this SUMMARY edit, and BASE is an ancestor.
- CITED: The one accepted post-BASE exception is commit 4dddb97ed, `fix(403-pre)`. It re-pinned K6 and K8 in tests/test-363-runner-contract.cjs, which were red on BASE because of stale pins, and added one file under .planning/quick/. Rule T2 accepts this exception. All other post-BASE commits touch only .planning/phases/403-isolated-lens-agents/.
- PROVEN: 403-PROBE.md exists. Its Leg V and Leg P1 verdicts are pass. Leg P3 is pass.
- CITED: The second reader step is done, based on the lane session re-count.
- CITED: The triple-dash scan printed nothing. tests/test-400-job-sentences.cjs printed `ok: S7` and `ok` on all 15 legs: S0 to S7, M1 to M4, and F1 to F3. The earlier spawnSync EPERM result was a sandbox artifact and is replaced by this host result.

### Step 5: agent positions

- PROVEN: agents/chain-step-reviewer.md has block-list key tools. Its last item is line 8, `  - Read`. The next line is line 9, `# == Phase 347 Plan 10 CIRS R1 exclude (Canon Part 11), SHARED-10 ==`.
- PROVEN: agents/meeting-perspective-extractor.md has block-list key tools. Its last item is line 8, `  - Read`. The next line is line 9, `# == Phase 265 Plan 19 CIRS R1 exclude (Canon Part 11) ==`.
- PROVEN: agents/vault-section-reviewer.md has block-list key tools. Its last item is line 8, `  - Read`. The next line is line 9, `# == Phase 265 Plan 21 CIRS R1 exclude (Canon Part 11) ==`.
- PROVEN: agents/research-lane-analyst.md has block-list keys tools and allowed-tools. The later list ends at line 14, `  - Read`. The next line is line 15, `# == Phase 363 Plan 18 CIRS R1 exclude (Canon Part 7, Canon Part 11) ==`.
- PROVEN: agents/analogy-query-fetcher.md has block-list key tools. Its last item is line 10, `  - Read`. The next line is line 11, `# == Phase 265 Plan 21 CIRS R1 exclude (Canon Part 11) ==`.
- PROVEN: agents/competitor-watch-fetcher.md has block-list key tools. Its last item is line 10, `  - Read`. The next line is line 11, `# == Phase 265 code-review CR-01 fix (Canon Part 8, Part 11 exclude) ==`.
- PROVEN: agents/dominant-design-researcher.md has block-list keys tools and allowed-tools. The later list ends at line 21, `  - Read`. The next line is line 22, `# == Phase 361 Plan 04 CIRS R1 exclude (Canon Part 7, Canon Part 11) ==`.
- PROVEN: The next line in each case is a column-zero comment. None of these files has a top-level omitClaudeMd key.

### Step 6: S7 form

- PROVEN: `s7_form: byte-compare`.
- PROVEN: The deciding line is `if (kept.join('\n') !== base) miss.push('agent ' + f + ' (changed beyond the 4 job lines)');`.
- PROVEN: The BASE constant in the file is `const BASE = 'c1e496ae8';`.

### Step 7: shared files

- PROVEN: agents/investor.md has 1 occurrence of `mcp__pinecone-brain__search-records`.
- PROVEN: data/capability-ledger.json has 0 occurrences of `mcp-per-tool-alwaysload-hot-list`.
- PROVEN: The `omitclaudemd-agent-frontmatter` row starts at line 511. Its status is dormant and its destination is agents/research-lane-analyst.md.

### Steps 8 and 9: baseline

CITED: The lane session ran each baseline command with temporary HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, and a closed Brain port. Each exit code follows.

| Baseline leg | Exit |
| --- | ---: |
| L2_jobsent | 0 |
| L3_391 | 0 |
| L4_363 | 0 |
| L5_361 | 0 |
| L6_265 | 0 |
| L7_connreg | 0 |
| L8_proj | 0 |
| L9_shape | 0 |
| L10_harness | 0 |
| L11_dist | 1 |
| test-400-job-sentence-lib | 0 |
| test-400-review-lists | 0 |
| test-400-description-budget | 0 |
| test-391-ledger-rows | 0 |
| test-265-supersede-chain | 0 |
| test-265-ledger-freshness | 0 |
| sweep_test-347-layer-graph-declaration | 0 |
| sweep_test-347-reviewer-honesty | 0 |
| sweep_test-347-reviewer-not-worker | 0 |
| sweep_test-361-agent-contract | 0 |
| sweep_test-361-command-contract | 0 |
| sweep_test-363-runner-contract | 0 |
| sweep_test-363.1-agent-isolation | 0 |
| sweep_test-391-agent-tools-naming | 0 |

- CITED: Leg 11 reports `dist bundle STALE`, the allowed known red. Legs 2 to 10 are green. Step 9 passes. The worktree was clean after the runs.

## Task 1

- Implemented the helper list, position test, phase runner, and S7 pre-pass because s7_form is byte-compare.
- The runner uses caller-provided NODE_PATH and MINDRIAN_HOME through its inherited environment.
- No tests were run in this sandbox. The lane session will run them after handoff.
- Planned Task 1 commit paths: tests/helpers/omit-claudemd-list.cjs, tests/test-403-omit-claudemd.cjs, tests/run-all-403.sh, tests/test-400-job-sentences.cjs.
- Planned message: test(403-02): add the omitClaudeMd list, the position test, the S7 pre-pass and the phase runner (red: L1, L5, S7)

## Task 1 result (lane session, outside the sandbox)

- Red set after Task 1, PROVEN: test-403 L1 FAIL (names the 7 agents), L2 ok, L3 ok, L4 ok, L5 FAIL; leg S7 FAIL with "omitClaudeMd lines: 0" for the 7 agents; every other leg of tests/test-400-job-sentences.cjs ok. Runner: PASSED=8 FAILED=2 SKIPPED=0 KNOWN=1.
- Commit: 0d148642c test(403-02). The helpers run and run_known equal the bodies in tests/run-all-363.sh (PROVEN by diff). File mode 100644.

## Task 2 result

- Step 1, PROVEN: `git diff --numstat -- agents` printed 7 lines of `1 0`. Each line sits directly after the last list item (tools, or allowed-tools for research-lane-analyst and dominant-design-researcher).
- Step 2, PROVEN: ledger row omitclaudemd-agent-frontmatter: status adopting, destination tests/helpers/omit-claudemd-list.cjs, evidence gained the K5 probe sentence (values from 403-PROBE.md: 2026-11-28, 2.1.332, true, 37). numstat 3 3.
- Step 3, PROVEN: first run found a defect of a Task 1 file: leg L3 inserted the key also when the file held it, so the control text held 2 key lines. Fixed by the contract text ("when it holds no key yet"). After the fix test-403 L1 to L5 ok; S7 ok.
- Runner after, PROVEN: PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1 (the dist leg, signature "dist bundle STALE").
- Baseline before and after, PROVEN: the 3 tests of AC-A6, the 3 ledger readers and the 8 sweep tests exit 0 before and 0 after. No result got worse.
- Commit: aaa62fe1c feat(403-02) (the 8 paths of Task 2 and the L3 fix).
- Pre-commit guard: the first try refused because the guard ran the connector check with no NODE_PATH (the worktree has no node_modules, so the MCP tool files did not load). The second try set NODE_PATH for the guard; the guard passed. No --no-verify.
- Step 4 privacy scan on the 9 committed paths and this SUMMARY: nothing found (PROVEN).
- Other gates on aaa62fe1c, PROVEN: run-all-401 PASSED=4 FAILED=0; run-all-261127-bnd PASS=79 FAIL=0; run-all-402 PASS=24 FAIL=0 SKIP=0; check-frontmatter-split --check OK; check-tool-grants --check OK.

## Saving case

saving_case 1, memory_file_removed true, bytes_removed_per_spawn 37 (scratch canary files only; CITED from 403-PROBE.md).

## Outside evidence

1. Failure that turns into a pass: done (red legs L1, L5, S7 in 0d148642c; green in aaa62fe1c).
2. Tests that the builder did not write: done (S7, 391, 363 K7, 361, the 5 common gates, the sweep; exit codes before and after above).
3. Host run of a shipped file: open, plan 403-03. The key is set; the host proof is plan 403-03.

STATUS: DONE
CHANGED: 0d148642c, aaa62fe1c (12 files of files_modified)
VERIFIED: bash tests/run-all-403.sh PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1; the other gates above
UNVERIFIED: the host effect on a shipped file (plan 403-03)
RISKS: 401 slices 3, 5, 7 and 402 slice 4 share files with this plan; the work that merges second rebases
NEXT: run plan 403-03
