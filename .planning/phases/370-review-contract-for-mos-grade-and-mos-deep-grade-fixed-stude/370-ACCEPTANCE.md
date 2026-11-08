# Phase 370 Acceptance: review contract for /mos:grade and /mos:deep-grade

Date: 2026-11-08. Base commit of plan 370-11: adf5939cc. Local only. No backend call was made (Canon Part 8).

Reading note: the Result and section 3 are plain. Sections 1, 2, 4 and 5 name scripts and files because they are the evidence.

## Result

1. A grade or deep-grade review now has one fixed shape: Executive Summary first, then five fixed sections, then an optional last note "For advanced students". Code checks it.
2. The internal names (agents, tools, commands, paths, backends) are a denylist generated from disk. A review that holds one is refused.
3. Three doors are on by owner answer: the filing door (O8 FRONTMATTER), the Write hook in LOG-ONLY mode (O6B), the release doctor gate as BLOCKER (O6A). No door was declined.
4. The reader-facing review carries no score, no grade line and no persona block (O1 WITHHOLD, O4A DROP). Named projects are anonymized (O4B): a person must judge that, code cannot.
5. Still open: see the carry-over list at the end. The words "defined in plain words" and "anonymized" are a human rubric and stay UNVERIFIED by code.

Owner answers in force (2026-11-08): O1 WITHHOLD, O2 KEEP (no numeric caps), O3 EXEMPT-IF-IN-SOURCE, O4A DROP, O4B ANONYMIZE, O6A BLOCKER, O6B LOG-ONLY, O8 FRONTMATTER.

What was withheld from the reader (Canon Part 12, answer O1): the score table, any score or grade heading, the letter-grade line and any percentile claim. Probes in section 3 show the check refuses each.

## 1. Tri-Polar table

Source: `node tests/test-370-tripolar.cjs` (6 arms, PASS 6 FAIL 0). The same fixture gives the same (rule, class, line) triples through the module, the wrapper, the door and the hook (tier S soft terms left out, because the hook skips them).

| Surface | Door | Result | Owner item | Note |
|---------|------|--------|------------|------|
| Claude Code CLI | wrapper `check-review-contract.cjs check` | PASS | none | exit 1 on a fault, rule, class and line only |
| Claude Code CLI | Write hook | PASS in LOG-ONLY | O6B | shipped mode logs and never blocks; enforce path proven on a temp contract copy (exit 2, same triples) |
| Claude Desktop | MCP filing door | PASS | O8 | refuses before any write; the door is the shared code path |
| Cowork | MCP filing door | PASS on the shared path; live Cowork behavior UNVERIFIED | O8 | no Cowork host here; the door runs the same function as Desktop |
| Release train | doctor coverage-gate, `check-review-contract.cjs --check` | PASS | O6A | blocker severity; exit 0 on the real repo |

DECLINED legs: none. The parity test prints `DECLINED <item>` for any leg the contract turns off, proven on synthetic blocks (arm T3). A leg that is on with missing code fails the test.

Shared code path: all doors call `checkReview` in `lib/core/review-contract.cjs` over `data/review-contract.json`. UNVERIFIED: how Claude Desktop and Cowork hosts display the refusal text to a person; no host here.

## 2. Gates run in this session

| Command | Result |
|---------|--------|
| `TEST_370_REQUIRE_ALL=1 bash tests/run-all-370.sh` | PASS=14 FAIL=0 SKIP=0 (12 test files, mirrors check, no-dash fence) |
| `node tests/test-370-tripolar.cjs` | PASS 6 FAIL 0 |
| `node tests/test-3696-reply-checks.cjs` | PASS 143 FAIL 0 |
| `node tests/test-265-deep-grade-rubric.cjs` | 8 passed, 0 failed |
| `node tests/test-383-sourced-number.cjs` | PASS 2, FAIL 1 (U1), PENDING 1: baseline, hit is commands/file-meeting.md line 1197, a file Phase 370 never touched |
| `node scripts/build-skill-mirrors.cjs --check` | OK, 112 mirrors match |
| `node scripts/build-connector-registry.cjs --check` | OK |
| `node scripts/build-orchestration-projection.cjs --check` | OK |
| `node scripts/check-render-coverage.cjs` | 0 gap |
| `node scripts/check-plugin-path-anchoring.cjs` | 0 violations |
| `node scripts/doctor.cjs --acceptance --only=coverage-gate` | PASS 1/1 (baseline in plan 370-10: PASS 1/1) |
| dist guard | BASE read and non-empty; `git diff --name-only BASE HEAD -- dist` empty; `git log --grep='(370-' -- dist` empty; no dist skill status change |

## 3. Lawrence review standard against the post-fix fixture

Fixture: `tests/fixtures/370/post-fix.md`. Important: this is a built fixture, not a live review of a real student team. UNVERIFIED: that a live Larry run keeps to the shape. The next real run should be read by a person.

### Proven by code

| Standard item | How checked | Command | Result |
|---------------|-------------|---------|--------|
| Executive summary first | first `##` heading, rule shape_order | `node scripts/check-review-contract.cjs check tests/fixtures/370/post-fix.md` and `grep -n '^## ' ...` | pass: heading at line 9 is Executive Summary |
| 3 to 5 revision points, as bullets with bold takeaways | rule revision_points_count (min 3, max 5, under the summary) | same check | pass: 4 points |
| Cross-domain ideas at most 2 in the body; extras only under the last note | rule cross_domain_count | same check | pass: 2 in the body, 1 under "For advanced students" |
| No internal tool, agent, command, path or backend names | rule internal_name, list generated from disk | same check; pre-fix fixture shows it fires | pass on post-fix |
| No tool-analysis section | forbidden_section tool_analysis | same check | pass; pre-fix fixture fires at line 40 |
| No score, no grade line (O1) | forbidden_section score_heading and body rules | probe: post-fix plus a "Final Grade" heading | refused: `forbidden_section score_heading line 50` |
| No Professor Perspective block (O4A) | forbidden_section persona_perspective | probe: post-fix plus a "Professor Perspective" heading | refused: `forbidden_section persona_perspective line 50` |
| No em dash or en dash | rule em_dash; grep of the fixture | `LC_ALL=C.UTF-8 grep -cP '[\x{2013}\x{2014}]' tests/fixtures/370/post-fix.md` | 0 hits; probe with an em dash refused: `em_dash dash line 50` |
| Soft terms (plain words such as "database") follow the O3 policy | soft_terms.policy exempt_if_in_source | tripolar arm T4 | module, wrapper and door refuse a soft term with no student source; hook does not report it |

O2 KEEP: the contract sets no numeric caps (`limits` is empty). No cap row exists.

### Judged by a person: UNVERIFIED by code

| Standard item | Why code cannot prove it | File to read |
|---------------|--------------------------|--------------|
| Short | no word limit exists (O2 KEEP). The fixture has 343 words including the header. A person decides if that is short enough. | tests/fixtures/370/post-fix.md |
| Only taught terms; every other term defined in plain words or cut | no taught-terms list exists. Code sees names and shape only. | tests/fixtures/370/post-fix.md, and any live review |
| Named-project comparisons anonymized (O4B ANONYMIZE) | code cannot tell a real project name from a plain noun | any live review; the instruction text is in commands/grade.md and commands/deep-grade.md |
| Cross-domain notes are condensed and useful | code counts them, a person judges them | tests/fixtures/370/post-fix.md |
| The review reads as plain, direct help for a student | taste | tests/fixtures/370/post-fix.md |

## 4. Before and after (rule, class, line only; no text)

Pre-fix fixture `tests/fixtures/370/pre-fix.md`: `node scripts/check-review-contract.cjs check` exits 1, `RESULT FAIL 13`:

```
internal_name  agent_name       line 9    (tier H1)
revision_points_count  count    line 11
forbidden_section  tool_analysis  line 40
internal_name  agent_name       line 42   (tier H1)
extra_section  shape            line 44
internal_name  backend_name     line 44   (tier E1)
internal_name  soft_term        line 44   (tier S)
internal_name  backend_name     line 46   (tier E1)
internal_name  command          line 46   (tier H2)
internal_name  path_or_id       line 46   (tier H4)
internal_name  tool_id          line 46   (tier H3)
extra_section  shape            line 52
cross_domain_count  count       line 56
```

Post-fix fixture `tests/fixtures/370/post-fix.md`: exit 0, output `OK review-contract v1`.

## 5. Carry-overs

Each item has a next step or owner.

1. **Dist skill copies are stale on purpose.** The dist copies of grade and deep-grade (generic-claude-dir and zed) were not regenerated. The release step rebuilds them. Next step: the release cut. Guard: no dist change since the base commit.
2. **Filing folder is undecided.** `/mos:grade` files to problem-definition; `/mos:deep-grade` files to competitive-analysis. The frontmatter `produces` also differs (`room/**/grades/*` against `room/**/deep-grades/*`). OWNER QUESTION: one folder for both, or keep two.
3. **The --full roll-up no longer shows scores (O1).** The chat-only roll-up has no score table. This is intended by the owner answer. Anyone who used the roll-up scores sees a change.
4. **Persona and "Assessment Thinking Chain" wording in a teaching-backend query.** The query text in the setup step of the grading file was reworded when the persona and that phrase were removed. The answer of the backend may change. UNVERIFIED: no backend call is allowed here (Canon Part 8). Next step: compare on the next live run.
5. **Hook skips parent-folder cases (path rule and H10e).** The hook skips folders named pipelines, tests, .planning, references, agents, commands, skills only in the path relative to the payload cwd or inside the repo root. A review under a parent folder with such a name is still checked (arm H10d). A review written with the cwd set to a folder above such a folder is skipped (stated limit, arm H10e). The hook also fails open on any error.
6. **Edit and MultiEdit are not covered by the hook.** The hook reads the whole file from the Write tool only. The door, the pre-file wrapper and the doctor template lint cover those.
7. **A review with no frontmatter escapes the door and the hook (O8 FRONTMATTER).** Arm W6 of the door test pins this as a stated limit. Cover: the pre-file wrapper in the command step and the doctor template lint.
8. **Command-picker copy.** `commands/deep-grade.md` still says "100+ student calibration" in `help_jtbd` and "100+ real student projects" in `teaching`. This is picker text, not review text. Next step: the owner decides if it stays.
9. **Known U1 failure of the sourced-number sweep.** `tests/test-383-sourced-number.cjs` U1 fails on commands/file-meeting.md line 1197. Baseline, not caused by Phase 370.
10. **Other review writers are out of scope:** grade-grant, grant-reviewer, vault-section-reviewer and chain-step-reviewer write reviews that this contract does not check.
11. **No taught-terms list exists.** "Only taught terms" stays a human rubric.
12. **Reviews already filed in rooms are not rewritten.**
13. **Baseline red, not caused here:** test-render-gate-wiring, test-skill-mirrors-tripwire (install-pre-commit.sh lacks the guard text); run-all-178, run-all-223 (see 370-10-SUMMARY.md).
14. **Release suite registration:** done. `tests/run-all-370.sh` is a hard run line in `tests/run-all-366.sh`. Nothing held uncommitted in that file at the time.
15. **Not run:** the full `node scripts/doctor.cjs --acceptance` roll-up and run-all-366.sh as a whole (long). Only the coverage-gate point and the new run-all-370.sh were run. UNVERIFIED for the rest.
