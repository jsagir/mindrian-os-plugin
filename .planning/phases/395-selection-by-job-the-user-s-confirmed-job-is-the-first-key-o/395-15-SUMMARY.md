---
phase: 395-selection-by-job
plan: 15
subsystem: command-headers
tags: [bridge-b, framework-registry, pws-sources-supreme]
requires: [395-10, 395-12]
provides: [2 PwS-backed frameworks on 2 command headers (Part 1)]
affects: [data/command-registry.json, data/brain-orchestration-projection.json, data/harness-manifest.json]
key-files:
  created: []
  modified: [commands/challenge-assumptions.md, skills/challenge-assumptions/SKILL.md, commands/macro-trends.md, skills/macro-trends/SKILL.md, data/command-registry.json, data/brain-orchestration-projection.json, data/harness-manifest.json, ui/mindrian-workspace-mod/assets/command-registry.json]
decisions:
  - "Part 1 applies only the 2 KEEP rows of section 13; the 7 HELD rows wait for the section 11 NEEDS_HUMAN answer; no test pin is relaxed."
  - "Owner ruling 2026-11-16 option (a): 4 header pins relax to keep-old-list-first; the 5 PwS-backed held rows are applied; Theory of Constraints and SAPPhIRE Model stay held (SRC-0)."
  - "Part 2 judges the 455 extra rows: 4 KEEP (5 Whys Technique on /mos:root-cause; CIAs approach and Black Hat Thinking on /mos:challenge-assumptions; Macro Trends/Macro Trending on /mos:mullins), 2 not applied (SRC-0), 449 reject."
part2:
  base_commit: 26c43d45dcb8ef115801ca89f1931288fa2c5fe7
  branch: wt/395-15-part2
  commits: [f7f367d71, ffc7f0ba1]
  files: 22
metrics:
  completed: 2026-11-16
  part1_tasks: 1
  part1_files: 8
---

# Phase 395 Plan 15: Bridge B, new frameworks in the command headers - Summary

## Part 1 (executor, 2026-11-16)

One-liner: `/mos:challenge-assumptions` gets `Pre-mortem Analysis` (SRC-1, catalog) and `/mos:macro-trends` gets `Macro Trends/Macro Trending` (SRC-2), appended after the listed name; the 3 derived files and the asset copy are regenerated.

Base commit (P0): `281a89f48a4c3bf7eaeb283bffc0a1b8276f4618`. Part 1 commit: `574664de9`. HEAD did not change between P0 and the commit.

### Changes

| File | Change |
|---|---|
| `commands/challenge-assumptions.md`, `skills/challenge-assumptions/SKILL.md` | `frameworks: ["Red Teaming", "Pre-mortem Analysis"]` |
| `commands/macro-trends.md`, `skills/macro-trends/SKILL.md` | `frameworks: ["PEST Analysis", "Macro Trends/Macro Trending"]` |
| `data/command-registry.json` | R1, 113 commands |
| `data/brain-orchestration-projection.json` | R2 (389 nodes, 83 edges); `data/orchestration-command-ledger.json` rewritten with the same bytes |
| `data/harness-manifest.json` | R3 |
| `ui/mindrian-workspace-mod/assets/command-registry.json` | R4 byte copy |

Each Find text matched exactly 1 time (count checked by script before each write).

### Verification (all PROVEN)

* Scratch scripts: extracted from the plan text by script; each is byte-equal (`cmp`) to the planner copy. Scratch dir: `/tmp/claude-1000/-home-jsagi/ed9f3b90-f4bf-4117-b6b6-f138961b043c/scratchpad/p15exec`.
* P1 `work/395-selection-by-job`; P2 base-ok; P2b input-committed; P2c `5e4f6d98...c2a9675`; P2d inputs-unchanged; P2e source A `ecba5862...ff1078a`, source B `9b077395...d2e738e4` (both match); P3 empty; P4 to P7 rc=0; P8-equal.
* P9 baseline: `commands=113`; rc not 0: G17 (assets/framework-names.json drift, D6), T09, T10, T11, T13, T15, T16, T17. Bars: B1 13 of 33, B2 8 of 38, B3 24 of 33, B4 4 of 5. Same as the planner dry run at `7c0687de4`.
* P10: `W1 OK 2 names`, rc=0. The guard file was last changed by `93b785273` (386-33); 395-13 is not committed, so W1b (section 9.5) stays open.
* V0: exactly the 8 planned lines.
* V1: `V1 OK`.
* C1: `CMP OK`, rc=0. T08 rc 0 -> 1 on the HEAD leg only ("still declares /mos:eureka, unchanged", 1 line), as the plan expects. After the commit, T08 rc=0 with 0 FAIL lines.
* SOFT line (report only): G11 `check-framework-vocabulary-drift.cjs` counts registry and projection frameworks 30 -> 32 (the 2 new names).
* Pre-commit hooks at commit: registry, connector, projection, vocabulary, mirrors, harness-manifest OK; reward-rule linter 2 of 2 compliant; shape-declaration advisory WARN (55, pre-existing, not blocking).

### Environment

Every repository run used a fresh `mktemp -d` HOME under the scratch dir, `MINDRIAN_ROOMS_HOME=$T/rooms`, `TMPDIR=$T`, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9` (plan rule 8, dead port, no network), `MINDRIAN_BRAIN_KEY` and `CLAUDE_CODE_SESSION_ID` unset, and `< /dev/null`.

### Deviations from Plan

* Plan rule 11 says "Do not commit". The main session told the executor to commit Part 1 with `git commit --only`. The executor committed after C1 passed, then ran T08 on the new HEAD (rc=0, as section 9.6 requires).
* The main session prompt said to unset `MINDRIAN_BRAIN_URL`. The executor used the plan rule 8 value `http://127.0.0.1:9` instead, so that no test can reach the default live Brain URL. The baseline and the after run used the same value.

### Not done in Part 1

* Section 11 NEEDS_HUMAN (relax 4 test pins for 7 HELD rows): pending with the owner. No pin was relaxed.
* W1b (section 9.5): run after 395-13 is committed.
* Part 2 (section 12): a separate executor.

## Self-Check: PASSED

* FOUND: commit `574664de9` on `work/395-selection-by-job`.
* FOUND: the 8 files of the commit (`git show --stat HEAD`).

## Part 2 and the held-row follow-on (executor, 2026-11-16)

One-liner: by owner ruling (a), the 4 header pins now keep the old list first, and the 5 PwS-backed held rows are applied. The judgment of the 455 extra rows keeps 4 rows on 3 commands: `/mos:root-cause` + `5 Whys Technique`, `/mos:challenge-assumptions` + `CIAs approach to challenging analytical assumptions` and `Black Hat Thinking`, `/mos:mullins` + `Macro Trends/Macro Trending`.

Worktree `/home/jsagi/dev/MindrianOS-Plugin-395-15p2`, branch `wt/395-15-part2`. Base commit (P0): `26c43d45dcb8ef115801ca89f1931288fa2c5fe7` (holds the Part 1 commit `574664de9`). HEAD did not change between the baseline and the after run.

### Owner ruling recorded

OWNER RULING 2026-11-16 on the section 11 NEEDS_HUMAN: option (a) "Yes, PwS-backed only". The 4 pins relax only to "the old list stays first, in order; names may be appended" (D2). The 5 held rows that a PwS source names are applied. `Theory of Constraints` (/mos:find-bottlenecks) and `SAPPhIRE Model` (/mos:find-analogies) stay held (SRC-0). The plan says the ruling also covers the Part 2 rows on the 6 pinned commands (J5); so a J5 row that passes J1 to J4, J2 SRC-1 or SRC-2 and J3 is applied, not held. Only 1 row met that: `5 Whys Technique` on `/mos:root-cause`.

Name check (D11): `Reverse Salient` is not in `data/framework-names.json` (the filter stops it on J1 name). The held row uses `Reverse Salient Analysis`, the names-file spelling that `/mos:find-bottlenecks` lists.

### Final frameworks lists (old list first, new names appended in J7 order)

| Command | New list | New names | Why |
|---|---|---|---|
| `/mos:dominant-designs` | Dominant Design, Era of Ferment Analysis | 1 | held row 3 (SRC-2 AGREE), ruling (a) |
| `/mos:scientific-roadmap` | Scientific Roadmapping, Hypothesis-Driven Problem Solving, Reverse Salient Analysis | 1 | held row 4 (SRC-1 B, UNKNOWN), ruling (a) |
| `/mos:find-analogies` | Four Lenses of Innovation, TRIZ / Genrich Altshuller Innovation Algorithm | 1 | held row 7 (SRC-1 B, UNKNOWN), ruling (a) |
| `/mos:find-connections` | Usher's Model of Cumulative Synthesis, Extensive Searching | 1 | held row 8 (SRC-1 A, UNKNOWN), ruling (a) |
| `/mos:root-cause` | Root Cause Analysis, 5 Whys Technique, Systems Thinking | 2 | Part 2 KEEP (SRC-2 AGREE, the command runs it) before held row 9 (SRC-2 CONFLICT, shared trigger) |
| `/mos:challenge-assumptions` | Red Teaming, Pre-mortem Analysis, CIAs approach to challenging analytical assumptions, Black Hat Thinking | 2 (+1 of Part 1 = cap 3) | Part 2 KEEP: CIA (SRC-1 B, AGREE) before Black Hat (SRC-1 B, UNKNOWN) |
| `/mos:mullins` | Mullins Model, Macro Trends/Macro Trending | 1 | Part 2 KEEP (SRC-2, CONFLICT A Ill-Defined vs B Un-Defined, both edges kept) |

Routing (D4, PROVEN by V1): every existing framework keeps its first command. New keys and their only command: `Era of Ferment Analysis` /mos:dominant-designs, `TRIZ / Genrich Altshuller Innovation Algorithm` /mos:find-analogies, `Extensive Searching` /mos:find-connections, `5 Whys Technique` /mos:root-cause, `CIAs approach to challenging analytical assumptions` and `Black Hat Thinking` /mos:challenge-assumptions. Existing keys appended after their home: `Reverse Salient Analysis` (first stays /mos:find-bottlenecks), `Systems Thinking` (first stays /mos:analyze-systems), `Macro Trends/Macro Trending` (first stays /mos:macro-trends).

### Source anchors of the 4 Part 2 KEEP rows (paraphrase only; no source prose copied)

Source A = the PwS course text, Source B = the 343 catalog, at the paths and sha256 of plan section 0.1 (P2e PROVEN unchanged).

* `5 Whys Technique` on /mos:root-cause: A lines 2456 and 2464, Well-Defined section, the root-cause slides: the five-why chain and the point that the last answer often points to a process. B bytes 6796 and 6844, Well-Defined section, root-cause cluster next to the listed `Root Cause Analysis` (6775). SRC-2, AGREE. Method: `references/methodology/root-cause.md` lines 34 to 39 run 5 Whys as method 1 of 5.
* `CIAs approach to challenging analytical assumptions` on /mos:challenge-assumptions: A not named. B byte 4907 (and 4936), Un-Defined section, the red-teaming and adversarial cluster with Red Teaming (4595), Devil's Advocacy (4704) and assumption challenging (4842). SRC-1 (B), AGREE with the listed `Red Teaming`. Method: the command stress-tests each load-bearing assumption on its own (hitl_why, F.8 basket).
* `Black Hat Thinking` on /mos:challenge-assumptions: A not named (terms `black hat`: 0 lines). B byte 10841, creative-thinking section (not a problem type), the Six Hats technique list: critical identification of risks and problems. SRC-1 (B), UNKNOWN. Method: the command frontmatter `lens_set: ['black-hat']`, single rotation.
* `Macro Trends/Macro Trending` on /mos:mullins: A line 1217 (Ill-Defined exercise on macro-changes, with 1214 to 1223, see section 3 row 2), B bytes 2289 and 2309, Un-Defined section. SRC-2, CONFLICT (A Ill-Defined, B Un-Defined); both edges kept. The listed `Mullins Model` has a B entry only in the validation section (14916), so UNKNOWN against it. Method: `references/methodology/mullins-7-domains.md` line 28 (Domain 2 asks whether macro trends favor the opportunity) and line 101 (/mos:macro-trends feeds Domain 2), so the command takes it as an input.

### Notable rejections (judgment, A1 "prefer fewer, sure additions")

* `Opposite Plan` on /mos:challenge-assumptions and `Scientific Roadmapping` on /mos:systems-thinking: not applied, SRC-0 (no PwS source names them; D10).
* `Is it Real / Problem Validation Framework` on /mos:validate-proposition: SRC-2, but it is Gate 1 of the listed PWS Value Proposition; a part of a listed framework adds no method (D1, as the Part 1 build-thesis row).
* `Technology Adoption Lifecycle` on /mos:diffusion: near the trigger "who adopts first", but the command runs supply-side ACE; a demand-side adopter-group theory is a different method.
* `User Experience Mapping` and `Understanding Needs Method` on /mos:analyze-needs and /mos:user-needs: source A presents JTBD as a different, more intensive way than mapping a user experience (talk track 3630 to 3633), and places Understanding Needs as a lens of the Four Lenses scan (1013, 1024). Different method.
* `System Archetypes`, `The Iceberg Model`, `Causal Loop Diagrams`, `Stock and Flow Diagrams` on /mos:root-cause: systems methods; the systems hand-off is already Systems Thinking.
* `Dominant Design Framework` on 8 commands: near duplicate of `Dominant Design` (home /mos:dominant-designs); a second name would give the same method a second home (D1, D4).
* `Intensive Searching` on /mos:explore-domains: source A defines it as a deep dive into 1 domain (line 963); the command opens with intersectional collision, which A calls extensive searching.

Coordinator note (Theo jsagi-5c, check of b9b8420c): Theo links are job-level, so commands of the same job get the same list, with ties by name. The judgment treats every row as a candidate only; J2 and J3 are the filter; no row was ordered or kept by Theo order or by name.

### Verification (PROVEN unless marked)

* Preconditions: Q0 inputs2-committed; Q1 extra `b35b037f...19d6aa`, no-cap `b9b8420c...53f661c` (both match); Q2 names `574664de9`; P2d (against `574664de9`) inputs-unchanged; P2e source A `ecba5862...ff1078a`, source B `9b077395...d2e738e4` (both match); P3 empty (also for `tests`); P4 to P7 rc=0; P8-equal. P1: the branch is `wt/395-15-part2` by the main session order, not `work/395-selection-by-job`.
* F1 filter on the registry after Part 1: rows 455; J1 name 41; J4 20 (forecast 16; Part 1 added keys); pass 350; pass on a pinned command 44; 28 commands with an unpinned pass row; 63 distinct frameworks in the pass rows.
* J2 source classes of the 394 pass rows: SRC-2 89, SRC-1 248, SRC-0 57. The search used the name, the short form (split at ` / `, `/` or ` (`), each alias twin, and 6 added terms: `5 why`, `five why`, `black hat`, `map a user experience`, `understanding needs`, `analytical assumption`, `macro trend`.
* A1 guard check: `W1 OK 9 names`, rc=0 (all 9 new names, on base `26c43d45d`; the guard file there is the pre-395-13 file).
* P9 baseline at `26c43d45d`: `commands=113`; rc not 0: G17, T09, T10, T11, T13, T15, T16, T17, TX-test-209-declared-implies-wired, TX-test-3551-tri-polar, TX-test-356-ledger-build, TX-test-l8g-theo-bare, TX-test-vi3-icm-walk. Bars: B1 13 of 33, B2 8 of 38, B3 24 of 33, B4 4 of 5. TX list: 94 tests (the files that name 1 of the 7 changed commands, less the T group).
* V0: the 7 command files, their 7 mirrors, the 4 files of R1 to R4, and the 4 test files; no other line.
* V1: `V1 OK`.
* C1: `CMP FAIL`, rc=1, with 1 HARD test: `tests/test-3692-four-commands.cjs` FC1b compares the frontmatter of the 4 door commands on disk with `git show HEAD:`, so `find-analogies.md` and `find-connections.md` fail before the commit. This is a HEAD leg of the same class as the T08 leg. No other HARD line. SC bars and counts unchanged; commands 113.
* After commit `ffc7f0ba1`: `tests/test-3692-four-commands.cjs` rc=0 (PASS 13, FAIL 0, as the baseline); T08 rc=0 with 0 FAIL lines; registry, projection, harness-manifest and skill-mirrors `--check` rc=0; the asset copy is equal.
* The 4 relaxed tests: T02, T03, T04 rc=0 before and after; T11 rc=1 before and after with the same failure-line set (leg P2 only; leg P3 passes).
* SOFT lines (report only): G11 framework count 32 -> 38 in the registry and the projection (6 new keys); T02 leg title text; TX-test-363-acceptance-whitespace timing metrics; TX-test-3692-wording report length and receipt timestamp.
* Pre-commit hooks at both commits: pass (command-registration sweep PASS, 113 scanned, 39 pre-existing description-length WARN lines).

### Environment

Every repository run used a fresh `mktemp -d` HOME under `/tmp/claude-1000/-home-jsagi/ed9f3b90-f4bf-4117-b6b6-f138961b043c/scratchpad/p15/part2`, `MINDRIAN_ROOMS_HOME=$T/rooms`, `TMPDIR=$T`, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9`, `MINDRIAN_BRAIN_KEY` and `CLAUDE_CODE_SESSION_ID` unset, and `< /dev/null`. No network call, no live Theo read, no MCP call.

### Deviations from Plan

* [Owner ruling] A4 said "this plan does not edit a test". The owner ruling (a) of 2026-11-16 allows the 4 pins to relax; each now keeps the old list first, in order (commit `f7f367d71`).
* [Rule 3] Plan A5 says to restore a command when a T or TX test gets a new HARD line. The only HARD line is a HEAD leg (FC1b of test-3692-four-commands) that cannot pass before a commit. The executor committed and ran the test again on the new HEAD (rc=0, same as baseline) instead of holding /mos:find-analogies and /mos:find-connections.
* Plan rule 11 says "Do not commit". The main session ordered commits with `--only`. STATE.md and ROADMAP.md are not updated on this branch, so that the merge does not collide with the 395-13 executor on the main branch.

### Open

* W1b (section 9.5): after the main session merges this branch onto a HEAD that holds the 395-13 commit, run `p15-w1.js` with the 9 new names plus the 2 Part 1 names.
* Held, not applied: `Theory of Constraints` on /mos:find-bottlenecks and `SAPPhIRE Model` on /mos:find-analogies (SRC-0). No Part 2 row is held: under ruling (a) a J5 row that passes is applied, and only `5 Whys Technique` passed.

### Part 2 decision table (all 455 rows of the extra input)

Columns: J1-J4 is the filter result; Class, type is the J2 class and the type note against the listed frameworks; Source anchor is the first A line and B byte offset with its section (A sections from plan 3.1; `later` = lines 2730 to 2800; B sections from the byte map); Decision; Reason (J3 in 1 line). The 5 held rows are Part 1 input rows and are not in this table; their source check is plan section 3.

Counts: reject 449, KEEP 4, not applied 2, total 455

#### /mos:analyze-needs (listed: Jobs to Be Done (JTBD); kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, AGREE | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command scores customer jobs by importance and satisfaction; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | J4 moves the first command of Beautiful Question Framework from /mos:beautiful-question | - | - | reject | J4 moves the first command of Beautiful Question Framework from /mos:beautiful-question (D4 routing) |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores customer jobs by importance and satisfaction; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command scores customer jobs by importance and satisfaction; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores customer jobs by importance and satisfaction; a filter against the first plausible cause is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), AGREE | A 963 IllDef, 1013 IllDef; B none | reject | The command scores customer jobs by importance and satisfaction; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 5820 IllDef | reject | The command scores customer jobs by importance and satisfaction; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command scores customer jobs by importance and satisfaction; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | J4 moves the first command of Root Cause Analysis from /mos:causal | - | - | reject | J4 moves the first command of Root Cause Analysis from /mos:causal (D4 routing) |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command scores customer jobs by importance and satisfaction; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), AGREE | A none; B 8031 WellDef | reject | The command scores customer jobs by importance and satisfaction; a library of recurring system patterns is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command scores customer jobs by importance and satisfaction; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), AGREE | A none; B 8083 WellDef | reject | The command scores customer jobs by importance and satisfaction; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, AGREE | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | Source A places Understanding Needs as a lens of the Four Lenses opportunity scan; the command scores jobs, a different method (as Four Lenses in Part 1). |
| User Experience Mapping | find-problem | pass | SRC-1 (A), AGREE | A 3630 IllDef; B none | reject | Near the trigger (steps that matter most and work worst), but source A presents JTBD as a different, more intensive way than mapping a user experience. Different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command scores customer jobs by importance and satisfaction; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores customer jobs by importance and satisfaction; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 8434 WellDef | reject | The command scores customer jobs by importance and satisfaction; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command scores customer jobs by importance and satisfaction; empathy for needs that data miss is a different method. |

#### /mos:analyze-systems (listed: Systems Thinking; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Reverse Salient | find-bottleneck | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |

#### /mos:analyze-timing (listed: S-Curve Analysis; Adoption-Capacity Theory; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command places 1 technology on its S-Curve by a performance metric; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | J4 moves the first command of Dominant Design from /mos:dominant-designs | - | - | reject | J4 moves the first command of Dominant Design from /mos:dominant-designs (D4 routing) |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6391 IllDef | reject | The reference reads a cracking dominant design, but this name is a near duplicate of Dominant Design (home /mos:dominant-designs); a second name would give it a second home (D1, D4). |
| Macro Trends/Macro Trending | understand-market | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends | - | - | reject | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends (D4 routing) |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5509 IllDef | reject | The command places 1 technology on its S-Curve by a performance metric; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | An adoption curve by adopter groups is not the performance S-Curve that the command places a technology on. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command places 1 technology on its S-Curve by a performance metric; following where value moves in a shifting market is a different method. |

#### /mos:beautiful-question (listed: Beautiful Question Framework; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, UNKNOWN | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command reframes a challenge as Why / What-if / How; a chain of why questions down to a cause is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command reframes a challenge as Why / What-if / How; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command reframes a challenge as Why / What-if / How; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command reframes a challenge as Why / What-if / How; a filter against the first plausible cause is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), AGREE | A 963 IllDef, 1013 IllDef; B none | reject | The command reframes a challenge as Why / What-if / How; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 5820 IllDef | reject | The command reframes a challenge as Why / What-if / How; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command reframes a challenge as Why / What-if / How; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | J4 moves the first command of Root Cause Analysis from /mos:causal | - | - | reject | J4 moves the first command of Root Cause Analysis from /mos:causal (D4 routing) |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command reframes a challenge as Why / What-if / How; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8031 WellDef | reject | The command reframes a challenge as Why / What-if / How; a library of recurring system patterns is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command reframes a challenge as Why / What-if / How; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8083 WellDef | reject | The command reframes a challenge as Why / What-if / How; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, AGREE | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command reframes a challenge as Why / What-if / How; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass | SRC-1 (A), AGREE | A 3630 IllDef; B none | reject | The command reframes a challenge as Why / What-if / How; mapping the steps of a user experience is a different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command reframes a challenge as Why / What-if / How; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | Near duplicate of the listed Beautiful Question Framework (D1). |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8434 WellDef | reject | The command reframes a challenge as Why / What-if / How; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command reframes a challenge as Why / What-if / How; empathy for needs that data miss is a different method. |

#### /mos:bono (listed: Six Thinking Hats; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Lean Startup | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command runs a hat-bound research debate over a what-if hypothesis; the pivot-or-persevere loop of Lean Startup is a different method. |
| Mullins Model | decide-pursue | J4 moves the first command of Mullins Model from /mos:mullins | - | - | reject | J4 moves the first command of Mullins Model from /mos:mullins (D4 routing) |
| Mullins Model for the Business Case / Mullins Model Validation | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command runs a hat-bound research debate over a what-if hypothesis; the Mullins seven domains screen is a different method. |

#### /mos:build-thesis (listed: PWS Value Proposition; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| HEART Framework | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 17903 story, 17907 story | reject | The command runs the Ten-Questions investment gate; a pitch method for a skeptical investor is a different method. |
| Lean Startup | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command runs the Ten-Questions investment gate; the pivot-or-persevere loop of Lean Startup is a different method. |
| Mullins Model | decide-pursue | J4 moves the first command of Mullins Model from /mos:mullins | - | - | reject | J4 moves the first command of Mullins Model from /mos:mullins (D4 routing) |
| SUCCESs Framework | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 18156 story | reject | The command runs the Ten-Questions investment gate; a message stickiness method is a different method. |
| The Golden Circle | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command runs the Ten-Questions investment gate; a why-first opening is a different method. |

#### /mos:causal (listed: Root Cause Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, AGREE | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | pass | SRC-2, UNKNOWN | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a filter against the first plausible cause is a different method. |
| High-Performing Teams | find-bottleneck | pass | SRC-0 | A none; B none | reject; SRC-0 | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; team delivery is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), UNKNOWN | A 963 IllDef, 1013 IllDef; B none | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 5820 IllDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; the whole PwS problem-finding method is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), AGREE | A none; B 8031 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a library of recurring system patterns is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), AGREE | A none; B 8083 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; the layers below events (patterns, structures, beliefs) is a different method. |
| Theory of Constraints | find-bottleneck | pass | SRC-0 | A none; B none | reject; SRC-0 | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; finding the one station that limits a flow is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, UNKNOWN | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass | SRC-1 (A), UNKNOWN | A 3630 IllDef; B none | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; mapping the steps of a user experience is a different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 8434 WellDef | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command extracts cause, mechanism and effect triples from 1 artifact into the graph; empathy for needs that data miss is a different method. |

#### /mos:challenge-assumptions (listed: Red Teaming; Pre-mortem Analysis; kept 2)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 8152 WellDef | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a ranking of places to act in a system is a different method. |
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs the black-hat Devil's Advocate pass on load-bearing claims; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | KEEP | The command runs the black-hat lens (lens_set black-hat, single rotation); a timed pass on risks and weak points is that lens. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), AGREE | A none; B 4907 UnDef, 4936 UnDef | KEEP | The command stress-tests each load-bearing assumption on its own (F.8 basket); a key assumptions check that asks what evidence would falsify each one is that method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | It plans tests of assumptions over time; the command reads risk against standing claims now. Different stance. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, UNKNOWN | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | not applied (no PwS source) | Fits the trigger (unchecked risky assumptions), but no PwS source names it (D10). |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a systems map of loops and leverage is a different method. |
| TRIZ / Genrich Altshuller Innovation Algorithm | surface-contradiction | pass | SRC-1 (B), UNKNOWN | A none; B 11627 creative, 11654 creative | reject | Resolving a contradiction is a solving method; the command only exposes weak claims. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs the black-hat Devil's Advocate pass on load-bearing claims; a step-by-step proof ladder is a different method. |

#### /mos:diagnose (listed: Problem Definition Transformation Framework; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Lean Startup | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command classifies the problem type against the PwS matrix; the pivot-or-persevere loop of Lean Startup is a different method. |
| Mullins Model | decide-pursue | J4 moves the first command of Mullins Model from /mos:mullins | - | - | reject | J4 moves the first command of Mullins Model from /mos:mullins (D4 routing) |
| Mullins Model for the Business Case / Mullins Model Validation | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command classifies the problem type against the PwS matrix; the Mullins seven domains screen is a different method. |

#### /mos:diffusion (listed: Adoption-Capacity Theory; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command runs the supply-side Adoption-Capacity Engine (FI and OC against actor capacity); reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | J4 moves the first command of Dominant Design from /mos:dominant-designs | - | - | reject | J4 moves the first command of Dominant Design from /mos:dominant-designs (D4 routing) |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); ACE does not read design convergence (D1, D4). |
| Macro Trends/Macro Trending | understand-market | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends | - | - | reject | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends (D4 routing) |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5509 IllDef | reject | The command runs the supply-side Adoption-Capacity Engine (FI and OC against actor capacity); a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | Near the trigger (who adopts first), but the command runs supply-side ACE; demand-side adopter groups are a different theory. Not sure enough. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command runs the supply-side Adoption-Capacity Engine (FI and OC against actor capacity); following where value moves in a shifting market is a different method. |

#### /mos:dominant-designs (listed: Dominant Design; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass (pin test-361 leg 2, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command runs the Utterback-Abernathy dominant design read; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design Framework | understand-market | pass (pin test-361 leg 2, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 6391 IllDef | reject | Near duplicate of the listed Dominant Design (D1). |
| Macro Trends/Macro Trending | understand-market | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends | - | - | reject | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends (D4 routing) |
| Near-Term Trend Analysis | understand-market | pass (pin test-361 leg 2, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 5509 IllDef | reject | The command runs the Utterback-Abernathy dominant design read; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass (pin test-361 leg 2, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 6464 IllDef | reject | The command runs the Utterback-Abernathy dominant design read; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass (pin test-361 leg 2, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 5725 IllDef, 30434 priority | reject | The command runs the Utterback-Abernathy dominant design read; following where value moves in a shifting market is a different method. |

#### /mos:explore-domains (listed: Domain Selection; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, UNKNOWN | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | pass | SRC-2, UNKNOWN | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command maps candidate domains by intersectional collision and IKA scoring; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command maps candidate domains by intersectional collision and IKA scoring; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a map of feedback loops between causes is a different method. |
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command maps candidate domains by intersectional collision and IKA scoring; reading the fade of an old industry and the new creation as one process is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command maps candidate domains by intersectional collision and IKA scoring; a filter against the first plausible cause is a different method. |
| Era of Ferment Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6301 IllDef | reject | Design competition is not domain mapping; the home of this new key is /mos:dominant-designs (held row, owner ruling (a)). |
| Forecast Combination Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 4343 UnDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; combining forecasts into one estimate is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), UNKNOWN | A 963 IllDef, 1013 IllDef; B none | reject | Source A defines it as a deep dive into 1 domain; the command opens with intersectional collision across domains, which source A calls extensive searching. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 5820 IllDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, UNKNOWN | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command maps candidate domains by intersectional collision and IKA scoring; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | pass | SRC-2, UNKNOWN | A 2455 WellDef; B 6775 WellDef, 30368 priority | reject | The command maps candidate domains by intersectional collision and IKA scoring; tracing a symptom to its root cause is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8031 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a library of recurring system patterns is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a sequence of demand-side adopter groups is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command maps candidate domains by intersectional collision and IKA scoring; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8083 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, UNKNOWN | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command maps candidate domains by intersectional collision and IKA scoring; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass | SRC-1 (A), UNKNOWN | A 3630 IllDef; B none | reject | The command maps candidate domains by intersectional collision and IKA scoring; mapping the steps of a user experience is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command maps candidate domains by intersectional collision and IKA scoring; following where value moves in a shifting market is a different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command maps candidate domains by intersectional collision and IKA scoring; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command maps candidate domains by intersectional collision and IKA scoring; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8434 WellDef | reject | The command maps candidate domains by intersectional collision and IKA scoring; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command maps candidate domains by intersectional collision and IKA scoring; empathy for needs that data miss is a different method. |

#### /mos:explore-trends (listed: S-Curve Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command pushes trends to extremes; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | pass | SRC-2, UNKNOWN | A 1100 IllDef, 1107 IllDef; B 6279 IllDef, 6328 IllDef | reject | The command pushes trends to extremes; the dominant design read is a different method. |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); the command extrapolates trends (D1, D4). |
| Macro Trends/Macro Trending | understand-market | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends | - | - | reject | J4 moves the first command of Macro Trends/Macro Trending from /mos:macro-trends (D4 routing) |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5509 IllDef | reject | The command pushes trends to extremes; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | The command pushes trends to extremes; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command pushes trends to extremes; following where value moves in a shifting market is a different method. |

#### /mos:find-bottlenecks (listed: Reverse Salient Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |

#### /mos:futures (listed: Futures Wheel; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, UNKNOWN | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command builds a consequence wheel from a seed; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | pass | SRC-2, AGREE | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command builds a consequence wheel from a seed; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command builds a consequence wheel from a seed; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command builds a consequence wheel from a seed; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command builds a consequence wheel from a seed; a filter against the first plausible cause is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), AGREE | A 963 IllDef, 1013 IllDef; B none | reject | The command builds a consequence wheel from a seed; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 5820 IllDef | reject | The command builds a consequence wheel from a seed; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command builds a consequence wheel from a seed; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | pass | SRC-2, UNKNOWN | A 2455 WellDef; B 6775 WellDef, 30368 priority | reject | The command builds a consequence wheel from a seed; tracing a symptom to its root cause is a different method. |
| SAPPhIRE Model | connect-domains | pass | SRC-0 | A none; B none | reject; SRC-0 | The command builds a consequence wheel from a seed; structural analogy encoding is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command builds a consequence wheel from a seed; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8031 WellDef | reject | The command builds a consequence wheel from a seed; a library of recurring system patterns is a different method. |
| TRIZ / Genrich Altshuller Innovation Algorithm | connect-domains | pass | SRC-1 (B), UNKNOWN | A none; B 11627 creative, 11654 creative | reject | The command builds a consequence wheel from a seed; contradiction solving with inventive principles is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command builds a consequence wheel from a seed; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8083 WellDef | reject | The command builds a consequence wheel from a seed; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, AGREE | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command builds a consequence wheel from a seed; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass | SRC-1 (A), AGREE | A 3630 IllDef; B none | reject | The command builds a consequence wheel from a seed; mapping the steps of a user experience is a different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command builds a consequence wheel from a seed; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command builds a consequence wheel from a seed; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8434 WellDef | reject | The command builds a consequence wheel from a seed; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command builds a consequence wheel from a seed; empathy for needs that data miss is a different method. |

#### /mos:grade-grant (listed: none; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Lean Startup | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command grades a grant draft against a fixed IIA rubric; the pivot-or-persevere loop of Lean Startup is a different method. |
| Mullins Model | decide-pursue | J4 moves the first command of Mullins Model from /mos:mullins | - | - | reject | J4 moves the first command of Mullins Model from /mos:mullins (D4 routing) |
| Mullins Model for the Business Case / Mullins Model Validation | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command grades a grant draft against a fixed IIA rubric; the Mullins seven domains screen is a different method. |
| Three Components of Innovation | decide-pursue | pass | SRC-1 (B), UNKNOWN | A none; B 443 found | reject | The innovation criterion of a grant rubric is near, but the command grades against the fixed IIA rubric, not this model. |

#### /mos:lean-canvas (listed: Lean Canvas; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 8152 WellDef | reject | The command fills the 9 boxes of the Lean Canvas; a ranking of places to act in a system is a different method. |
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command fills the 9 boxes of the Lean Canvas; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command fills the 9 boxes of the Lean Canvas; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command fills the 9 boxes of the Lean Canvas; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command fills the 9 boxes of the Lean Canvas; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command fills the 9 boxes of the Lean Canvas; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | The command fills the 9 boxes of the Lean Canvas; a key assumptions check is a different method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command fills the 9 boxes of the Lean Canvas; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command fills the 9 boxes of the Lean Canvas; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command fills the 9 boxes of the Lean Canvas; a plan that lists assumptions and tests them one by one is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The canvas belongs to the Lean Startup family, but the command fills 9 boxes and runs no pivot-or-persevere loop. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command fills 9 boxes and runs no build-measure-learn loop. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command fills the 9 boxes of the Lean Canvas; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command fills the 9 boxes of the Lean Canvas; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command fills the 9 boxes of the Lean Canvas; an anti-plan that exposes unchecked assumptions is a different method. |
| Pre-mortem Analysis | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4103 UnDef | reject | The command fills the 9 boxes of the Lean Canvas; a failure story written in advance is a different method. |
| Rapid Prototyping | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13770 validation | reject | The command fills the 9 boxes of the Lean Canvas; building a prototype is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command fills the 9 boxes of the Lean Canvas; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command fills the 9 boxes of the Lean Canvas; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command fills the 9 boxes of the Lean Canvas; a systems map of loops and leverage is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command fills the 9 boxes of the Lean Canvas; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command fills the 9 boxes of the Lean Canvas; a step-by-step proof ladder is a different method. |

#### /mos:macro-trends (listed: PEST Analysis; Macro Trends/Macro Trending; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command runs the PEST macro sweep; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | pass | SRC-2, AGREE | A 1100 IllDef, 1107 IllDef; B 6279 IllDef, 6328 IllDef | reject | The command runs the PEST macro sweep; the dominant design read is a different method. |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), AGREE | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); not a PEST sweep (D1, D4). |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), AGREE | A none; B 5509 IllDef | reject | The command runs the PEST macro sweep; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), AGREE | A none; B 6464 IllDef | reject | The command runs the PEST macro sweep; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), AGREE | A none; B 5725 IllDef, 30434 priority | reject | The command runs the PEST macro sweep; following where value moves in a shifting market is a different method. |

#### /mos:map-unknowns (listed: Knowns and Unknowns Matrix Framework; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 8152 WellDef | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a ranking of places to act in a system is a different method. |
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots known, unknown and unknowable in a Rumsfeld matrix; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a key assumptions check is a different method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots known, unknown and unknowable in a Rumsfeld matrix; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | Near the research-plan follow-on, but the command plots a Rumsfeld matrix; an assumption test plan is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, UNKNOWN | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots known, unknown and unknowable in a Rumsfeld matrix; an anti-plan that exposes unchecked assumptions is a different method. |
| Red Teaming | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4595 UnDef, 4629 UnDef | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; an adversarial challenge of the plan is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a systems map of loops and leverage is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command plots known, unknown and unknowable in a Rumsfeld matrix; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots known, unknown and unknowable in a Rumsfeld matrix; a step-by-step proof ladder is a different method. |

#### /mos:mullins (listed: Mullins Model; kept 1)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command runs the Mullins 7 domains screen; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | pass | SRC-2, UNKNOWN | A 1100 IllDef, 1107 IllDef; B 6279 IllDef, 6328 IllDef | reject | The command runs the Mullins 7 domains screen; the dominant design read is a different method. |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); not one of the 7 domains (D1, D4). |
| Macro Trends/Macro Trending | understand-market | pass | SRC-2, CONFLICT | A 1217 IllDef, 2751 later; B 2289 UnDef, 2309 UnDef | KEEP | Domain 2 (macro market) of the reference asks whether macro trends favor the opportunity, and the reference names /mos:macro-trends as its input. |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5509 IllDef | reject | The command runs the Mullins 7 domains screen; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | The command runs the Mullins 7 domains screen; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command runs the Mullins 7 domains screen; following where value moves in a shifting market is a different method. |

#### /mos:research (listed: Hypothesis-Driven Problem Solving; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command fetches web evidence and wires it into the graph, a research tool; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | pass | SRC-2, UNKNOWN | A 1100 IllDef, 1107 IllDef; B 6279 IllDef, 6328 IllDef | reject | The command fetches web evidence and wires it into the graph, a research tool; the dominant design read is a different method. |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); the command is a research tool (D1, D4). |
| Macro Trends/Macro Trending | understand-market | pass | SRC-2, CONFLICT | A 1217 IllDef, 2751 later; B 2289 UnDef, 2309 UnDef | reject | The command fetches web evidence and wires it into the graph, a research tool; listing the macro trends is a different method. |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5509 IllDef | reject | The command fetches web evidence and wires it into the graph, a research tool; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 6464 IllDef | reject | The command fetches web evidence and wires it into the graph, a research tool; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 5725 IllDef, 30434 priority | reject | The command fetches web evidence and wires it into the graph, a research tool; following where value moves in a shifting market is a different method. |

#### /mos:root-cause (listed: Root Cause Analysis; kept 1)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, AGREE | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | KEEP | The reference runs 5 Whys as method 1 of 5 and the description names 5-Whys; the command runs it as a step. J5 pin relaxed by owner ruling (a). |
| Beautiful Question Framework | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, UNKNOWN | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | Linked causes are near, but loop mapping is the method of /mos:systems-thinking, not of the 5 cause-tracing methods. |
| Decomplexifying | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | Near the trigger (not the first plausible cause), but no PwS source names it and the command does not run it. |
| Intensive Searching | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (A), UNKNOWN | A 963 IllDef, 1013 IllDef; B none | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 5820 IllDef | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; the whole PwS problem-finding method is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | Stock and flow mapping is the method of /mos:systems-thinking, not of the 5 cause-tracing methods. |
| System Archetypes | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 8031 WellDef | reject | Shared trigger (a problem that keeps returning) only; a pattern library is a different method, and the systems hand-off is already Systems Thinking. Prefer fewer. |
| The Golden Circle | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 8083 WellDef | reject | Below-the-surface layers are near, but the command traces causes with its 5 named methods; a systems layer model is a different method. Prefer fewer. |
| Understanding Needs Method | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-2, UNKNOWN | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (A), UNKNOWN | A 3630 IllDef; B none | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; mapping the steps of a user experience is a different method. |
| Well-Defined Problem Framework | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), AGREE | A none; B 8434 WellDef | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass (pin test-363 P3, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command runs 5-Whys, Fishbone and Fault Tree on a recurring symptom; empathy for needs that data miss is a different method. |

#### /mos:rs-experts (listed: Reverse Salient Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| SAPPhIRE Model | connect-domains | pass | SRC-0 | A none; B none | reject; SRC-0 | The command lists authors from the local paper corpus and runs no analysis method; structural analogy encoding is a different method. |
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |
| TRIZ / Genrich Altshuller Innovation Algorithm | connect-domains | pass | SRC-1 (B), UNKNOWN | A none; B 11627 creative, 11654 creative | reject | The command lists authors from the local paper corpus and runs no analysis method; contradiction solving with inventive principles is a different method. |

#### /mos:rs-explain (listed: Reverse Salient Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |

#### /mos:rs-fetch (listed: Reverse Salient Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |

#### /mos:rs-thesis (listed: Reverse Salient Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Scientific Roadmapping | find-bottleneck | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap | - | - | reject | J4 moves the first command of Scientific Roadmapping from /mos:scientific-roadmap (D4 routing) |

#### /mos:scenario-plan (listed: Scenario Planning; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Sustaining vs Disruptive Innovation | compare-options | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command builds a 2x2 matrix on 2 uncertainties; the sustaining-or-disruptive check is a different method. |

#### /mos:scientific-roadmap (listed: Scientific Roadmapping; Hypothesis-Driven Problem Solving; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Ackoff Pyramid | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | Near (assumed limits), but the command interrogates limits of a HOW roadmap, not analytic assumptions of a claim. Not sure enough. |
| Continuous Discovery | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; a plan that lists assumptions and tests them one by one is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-2, AGREE | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; an anti-plan that exposes unchecked assumptions is a different method. |
| PWS Value Proposition | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-2, AGREE | A 2646 WellDef, 2648 WellDef; B 14748 validation, 14752 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the 3 VP gates is a different method. |
| Pre-mortem Analysis | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 4103 UnDef | reject | A failure story of a plan is not the ranking of assumed limits of the HOW. |
| Rapid Prototyping | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 13770 validation | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; building a prototype is a different method. |
| Red Teaming | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 4595 UnDef, 4629 UnDef | reject | An adversarial challenge of a plan is not the ranking of assumed limits of the HOW. |
| Reverse Salient | find-bottleneck | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Sustaining vs Disruptive Innovation | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; the sustaining-or-disruptive check is a different method. |
| Validation Ladder | validate-idea | pass (pin test-364 C1, relaxed by owner ruling (a)) | SRC-0 | A none; B none | reject; SRC-0 | The command ranks the assumed limits of the HOW and hands hypotheses to /mos:research; a step-by-step proof ladder is a different method. |

#### /mos:score-innovation (listed: HSI Semantic Surprise Analysis Assistant; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command ranks candidates by HSI semantic surprise; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command ranks candidates by HSI semantic surprise; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command ranks candidates by HSI semantic surprise; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command ranks candidates by HSI semantic surprise; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command ranks candidates by HSI semantic surprise; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | The command ranks candidates by HSI semantic surprise; a key assumptions check is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command ranks candidates by HSI semantic surprise; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command ranks candidates by HSI semantic surprise; a plan that lists assumptions and tests them one by one is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, UNKNOWN | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command ranks candidates by HSI semantic surprise; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command ranks candidates by HSI semantic surprise; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command ranks candidates by HSI semantic surprise; the build-measure-learn loop is a different method. |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command ranks candidates by HSI semantic surprise; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command ranks candidates by HSI semantic surprise; the Mullins seven domains screen is a different method. |
| Pre-mortem Analysis | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4103 UnDef | reject | The command ranks candidates by HSI semantic surprise; a failure story written in advance is a different method. |
| Red Teaming | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4595 UnDef, 4629 UnDef | reject | The command ranks candidates by HSI semantic surprise; an adversarial challenge of the plan is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command ranks candidates by HSI semantic surprise; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | compare-options | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command ranks candidates by HSI semantic surprise; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command ranks candidates by HSI semantic surprise; a systems map of loops and leverage is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command ranks candidates by HSI semantic surprise; a customer interview method is a different method. |

#### /mos:structure-argument (listed: The Pyramid Principle; MECE (Mutually Exclusive, Collectively Exhaustive); kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), AGREE | A none; B 8152 WellDef | reject | The command restructures an argument with Minto, SCQA and MECE; a ranking of places to act in a system is a different method. |
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command restructures an argument with Minto, SCQA and MECE; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command restructures an argument with Minto, SCQA and MECE; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command restructures an argument with Minto, SCQA and MECE; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command restructures an argument with Minto, SCQA and MECE; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command restructures an argument with Minto, SCQA and MECE; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | The command restructures an argument with Minto, SCQA and MECE; a key assumptions check is a different method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command restructures an argument with Minto, SCQA and MECE; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command restructures an argument with Minto, SCQA and MECE; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command restructures an argument with Minto, SCQA and MECE; a plan that lists assumptions and tests them one by one is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, AGREE | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command restructures an argument with Minto, SCQA and MECE; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command restructures an argument with Minto, SCQA and MECE; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command restructures an argument with Minto, SCQA and MECE; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command restructures an argument with Minto, SCQA and MECE; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command restructures an argument with Minto, SCQA and MECE; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command restructures an argument with Minto, SCQA and MECE; an anti-plan that exposes unchecked assumptions is a different method. |
| Red Teaming | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4595 UnDef, 4629 UnDef | reject | The command restructures an argument with Minto, SCQA and MECE; an adversarial challenge of the plan is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command restructures an argument with Minto, SCQA and MECE; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command restructures an argument with Minto, SCQA and MECE; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command restructures an argument with Minto, SCQA and MECE; a systems map of loops and leverage is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command restructures an argument with Minto, SCQA and MECE; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command restructures an argument with Minto, SCQA and MECE; a step-by-step proof ladder is a different method. |

#### /mos:systems-thinking (listed: Systems Thinking; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Reverse Salient | find-bottleneck | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Scientific Roadmapping | find-bottleneck | pass | SRC-0 | A none; B none | not applied (no PwS source) | Passes D4 (D11 forecast), but no PwS source names Scientific Roadmapping or Tech Tree Mapping (D10); also a constraint view, not a loop map. |

#### /mos:trending-to-absurd (listed: Trending to the Absurd; S-Curve Analysis; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| Creative Destruction | understand-market | pass | SRC-1 (B), UNKNOWN | A none; B 17270 bizmodel, 17334 bizmodel | reject | The command pushes graph-seeded trends to an absurd extreme; reading the fade of an old industry and the new creation as one process is a different method. |
| Dominant Design | understand-market | pass | SRC-2, AGREE | A 1100 IllDef, 1107 IllDef; B 6279 IllDef, 6328 IllDef | reject | The command pushes graph-seeded trends to an absurd extreme; the dominant design read is a different method. |
| Dominant Design Framework | understand-market | pass | SRC-1 (B), AGREE | A none; B 6391 IllDef | reject | Near duplicate of Dominant Design (home /mos:dominant-designs); the command extrapolates trends (D1, D4). |
| Macro Trends/Macro Trending | understand-market | pass | SRC-2, CONFLICT | A 1217 IllDef, 2751 later; B 2289 UnDef, 2309 UnDef | reject | The command pushes graph-seeded trends to an absurd extreme; listing the macro trends is a different method. |
| Near-Term Trend Analysis | understand-market | pass | SRC-1 (B), AGREE | A none; B 5509 IllDef | reject | The command pushes graph-seeded trends to an absurd extreme; a short-horizon scan of consumers, technology and competitors is a different method. |
| Technology Adoption Lifecycle | understand-market | pass | SRC-1 (B), AGREE | A none; B 6464 IllDef | reject | The command pushes graph-seeded trends to an absurd extreme; a sequence of demand-side adopter groups is a different method. |
| Value Migration | understand-market | pass | SRC-1 (B), AGREE | A none; B 5725 IllDef, 30434 priority | reject | The command pushes graph-seeded trends to an absurd extreme; following where value moves in a shifting market is a different method. |

#### /mos:user-needs (listed: Jobs to Be Done (JTBD); kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, AGREE | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command plots importance against satisfaction; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | pass | SRC-2, AGREE | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command plots importance against satisfaction; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots importance against satisfaction; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command plots importance against satisfaction; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots importance against satisfaction; a filter against the first plausible cause is a different method. |
| Intensive Searching | find-problem | pass | SRC-1 (A), AGREE | A 963 IllDef, 1013 IllDef; B none | reject | The command plots importance against satisfaction; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 5820 IllDef | reject | The command plots importance against satisfaction; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, AGREE | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command plots importance against satisfaction; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | pass | SRC-2, AGREE | A 2455 WellDef; B 6775 WellDef, 30368 priority | reject | The command plots importance against satisfaction; tracing a symptom to its root cause is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command plots importance against satisfaction; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), AGREE | A none; B 8031 WellDef | reject | The command plots importance against satisfaction; a library of recurring system patterns is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command plots importance against satisfaction; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), AGREE | A none; B 8083 WellDef | reject | The command plots importance against satisfaction; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, AGREE | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | Source A places Understanding Needs as a lens of the Four Lenses opportunity scan; the command plots importance against satisfaction (as Four Lenses in Part 1). |
| User Experience Mapping | find-problem | pass | SRC-1 (A), AGREE | A 3630 IllDef; B none | reject | Near the trigger (steps that matter most and work worst), but source A presents JTBD as a different, more intensive way than mapping a user experience. Different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command plots importance against satisfaction; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command plots importance against satisfaction; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), AGREE | A none; B 8434 WellDef | reject | The command plots importance against satisfaction; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command plots importance against satisfaction; empathy for needs that data miss is a different method. |

#### /mos:validate (listed: Jobs to Be Done (JTBD); kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), AGREE | A none; B 8152 WellDef | reject | The command measures an idea by importance-satisfaction scoring against a segment; a ranking of places to act in a system is a different method. |
| Ackoff Pyramid | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command measures an idea by importance-satisfaction scoring against a segment; tracing a claim back to observation is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command measures an idea by importance-satisfaction scoring against a segment; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command measures an idea by importance-satisfaction scoring against a segment; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), AGREE | A none; B 4907 UnDef, 4936 UnDef | reject | The command measures an idea by importance-satisfaction scoring against a segment; a key assumptions check is a different method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command measures an idea by importance-satisfaction scoring against a segment; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; a plan that lists assumptions and tests them one by one is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, AGREE | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; a check with real people that the problem exists is a different method. |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command measures an idea by importance-satisfaction scoring against a segment; an anti-plan that exposes unchecked assumptions is a different method. |
| Red Teaming | validate-idea | pass | SRC-1 (B), AGREE | A none; B 4595 UnDef, 4629 UnDef | reject | The command measures an idea by importance-satisfaction scoring against a segment; an adversarial challenge of the plan is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command measures an idea by importance-satisfaction scoring against a segment; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command measures an idea by importance-satisfaction scoring against a segment; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command measures an idea by importance-satisfaction scoring against a segment; a systems map of loops and leverage is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command measures an idea by importance-satisfaction scoring against a segment; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command measures an idea by importance-satisfaction scoring against a segment; a step-by-step proof ladder is a different method. |

#### /mos:validate-proposition (listed: PWS Value Proposition; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 12 Leverage Points | validate-idea | pass | SRC-1 (B), AGREE | A none; B 8152 WellDef | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a ranking of places to act in a system is a different method. |
| Avoiding Bad Data | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 15196 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; discounting compliments and vague promises in interviews is a different method. |
| BONO-Innovation Framework | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10648 creative, 27184 meta | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the BONO hypothesis-to-verdict debate is a different method. |
| Black Hat Thinking | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 10841 creative | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a timed pass on risks and weak points is a different method. |
| Build-Measure-Learn Cycle | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13383 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the smallest build-measure test of an assumption is a different method. |
| CIAs approach to challenging analytical assumptions | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4907 UnDef, 4936 UnDef | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a key assumptions check is a different method. |
| Continuous Discovery | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a weekly customer interview habit is a different method. |
| Customer Development | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14165 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; validating customer segments before building is a different method. |
| Discovery-Driven Planning | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13861 validation, 13886 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a plan that lists assumptions and tests them one by one is a different method. |
| HEART Framework | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 17903 story, 17907 story | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a pitch method for a skeptical investor is a different method. |
| Is it Real / Problem Validation Framework | validate-idea | pass | SRC-2, AGREE | A 2634 WellDef, 4299 WellDef; B 14430 validation, 14538 validation | reject | The Real check is already Gate 1 of the listed PWS Value Proposition; a part of a listed framework adds no method (D1, as in Part 1). |
| Lean Startup | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the pivot-or-persevere loop of Lean Startup is a different method. |
| Lean Startup (Build-Measure-Learn) | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 13309 validation, 13327 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the build-measure-learn loop is a different method. |
| Logic Trees (Issue, Hypothesis, Decision) | validate-idea | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Minimum Viable Product / MVP | validate-idea | pass | SRC-2, UNKNOWN | A 318 intro; B 13442 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the smallest build that tests the riskiest assumption is a different method. |
| Mullins Model for the Business Case / Mullins Model Validation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14916 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the Mullins seven domains screen is a different method. |
| Opposite Plan | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; an anti-plan that exposes unchecked assumptions is a different method. |
| Red Teaming | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 4595 UnDef, 4629 UnDef | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; an adversarial challenge of the plan is a different method. |
| SUCCESs Framework | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 18156 story | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a message stickiness method is a different method. |
| Scientific Method | validate-idea | pass | SRC-2, CONFLICT | A 3847 IllDef; B 9148 WellDef | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a falsifiable hypothesis and its cheapest test is a different method. |
| Sustaining vs Disruptive Innovation | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 16812 bizmodel | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; the sustaining-or-disruptive check is a different method. |
| Systems Thinking | validate-idea | pass | SRC-2, CONFLICT | A 2030 Wicked, 2032 Wicked; B 3184 UnDef, 7700 WellDef | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a systems map of loops and leverage is a different method. |
| The Golden Circle | prepare-pitch | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a why-first opening is a different method. |
| The Mom Test | validate-idea | pass | SRC-1 (B), UNKNOWN | A none; B 14107 validation | reject | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a customer interview method is a different method. |
| Validation Ladder | validate-idea | pass | SRC-0 | A none; B none | reject; SRC-0 | The command scores the 3 PwS VP gates (Real, Win, Worth) with sequential math; a step-by-step proof ladder is a different method. |

#### /mos:whitespace (listed: HSI Semantic Surprise Analysis Assistant; kept 0)

| Framework | Job | J1-J4 | Class, type | Source anchor | Decision | Reason |
|---|---|---|---|---|---|---|
| 5 Whys Technique | find-problem | pass | SRC-2, UNKNOWN | A 2456 WellDef, 2464 WellDef; B 6796 WellDef, 6844 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; a chain of why questions down to a cause is a different method. |
| Beautiful Question Framework | find-problem | pass | SRC-2, UNKNOWN | A 1409 IllDef, 3735 IllDef; B 12280 creative, 12361 creative | reject | The command runs HSI over the room corpus for under-explored zones; a Why / What-if / How reframing is a different method. |
| Biodesign | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs HSI over the room corpus for under-explored zones; collecting and filtering clinical needs is a different method. |
| Causal Loop Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1942 Wicked, 4000 Wicked; B 7845 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; a map of feedback loops between causes is a different method. |
| Decomplexifying | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs HSI over the room corpus for under-explored zones; a filter against the first plausible cause is a different method. |
| Four Lenses of Innovation | find-problem | pass | SRC-2, UNKNOWN | A 1013 IllDef; B 21947 analytic, 21993 analytic | reject | An opportunity scan by 4 lenses is not the HSI gap scan of the room corpus. |
| Intensive Searching | find-problem | pass | SRC-1 (A), UNKNOWN | A 963 IllDef, 1013 IllDef; B none | reject | The command runs HSI over the room corpus for under-explored zones; a deep dive into a single domain is a different method. |
| Issue tree | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Jobs to Be Done | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Life Cycle Analysis | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 9937 lifecycle | reject | The command runs HSI over the room corpus for under-explored zones; a product life cycle waste scan is a different method. |
| Logic Trees | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Market Process Theory Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 5820 IllDef | reject | The command runs HSI over the room corpus for under-explored zones; looking for gaps that alert people notice is a different method. |
| Outcome-Driven Innovation | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| PWS Methodology | find-problem | pass | SRC-2, UNKNOWN | A 99 intro, 102 intro; B 148 header, 473 found | reject | The command runs HSI over the room corpus for under-explored zones; the whole PwS problem-finding method is a different method. |
| Root Cause Analysis | find-problem | pass | SRC-2, UNKNOWN | A 2455 WellDef; B 6775 WellDef, 30368 priority | reject | The command runs HSI over the room corpus for under-explored zones; tracing a symptom to its root cause is a different method. |
| Scenario Analysis | find-problem | J1 name | - | - | reject | J1 name: the exact name is not in data/framework-names.json |
| Stock and Flow Diagrams | find-problem | pass | SRC-2, CONFLICT | A 1927 Wicked, 1941 Wicked; B 7973 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; a map of stocks and flows is a different method. |
| System Archetypes | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8031 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; a library of recurring system patterns is a different method. |
| The Golden Circle | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 18462 story | reject | The command runs HSI over the room corpus for under-explored zones; a why-first opening is a different method. |
| The Iceberg Model | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8083 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; the layers below events (patterns, structures, beliefs) is a different method. |
| Understanding Needs Method | find-problem | pass | SRC-2, UNKNOWN | A 1024 IllDef, 1230 IllDef; B 22153 analytic, 22352 analytic | reject | The command runs HSI over the room corpus for under-explored zones; the Understanding Needs lens of the Four Lenses scan is a different method. |
| User Experience Mapping | find-problem | pass | SRC-1 (A), UNKNOWN | A 3630 IllDef; B none | reject | The command runs HSI over the room corpus for under-explored zones; mapping the steps of a user experience is a different method. |
| Well-Defined Problem Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 1062 found | reject | The command runs HSI over the room corpus for under-explored zones; rewriting a vague problem as a bounded statement is a different method. |
| Why-What If-How model | find-problem | pass | SRC-0 | A none; B none | reject; SRC-0 | The command runs HSI over the room corpus for under-explored zones; the Why / What-if / How reframing is a different method. |
| Wicked Problem Detection Framework | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 8434 WellDef | reject | The command runs HSI over the room corpus for under-explored zones; a test of whether a problem is wicked is a different method. |
| Wired to Care | find-problem | pass | SRC-1 (B), UNKNOWN | A none; B 29380 addl | reject | The command runs HSI over the room corpus for under-explored zones; empathy for needs that data miss is a different method. |

### Part 2 Self-Check: PASSED

* FOUND: commits `f7f367d71` and `ffc7f0ba1` on `wt/395-15-part2` (`git log --oneline -3`).
* FOUND: the 22 files of the 2 commits; post-commit deletion check: no deleted file.
* FOUND: 455 table rows (4 KEEP, 2 not applied, 449 reject).
