# Phase 370 decision cards: the review contract for grade and deep-grade

Written: 2026-11-08 by plan 370-03. HEAD when written: 5d396ee96 (the sealed HEAD is on the machine line below). Contract version: 1.

This card decides nothing. The owner answers one line per group.

Nothing is edited by this phase until an answer is recorded. No push, tag or release follows from an answer.

## Summary at a glance

There are three groups and eight items. Each group has one answer line. All answers read PENDING.

| Group | Subject | Items | Token for the recommendations | What RECOMMENDED would cause later |
|-------|---------|-------|-------------------------------|------------------------------------|
| G1 | What the student sees | 4 (O1, O2, O4A, O4B) | RECOMMENDED | No score table and no letter grade in the review. Length caps once you give three values. No persona quote. Comparisons that name no other project. |
| G2 | How strict the check is | 1 (O3) | RECOMMENDED | The words database and graph pass only when the student's own text uses them. All hard names still fail. |
| G3 | Where the check runs | 3 (O6A, O6B, O8) | RECOMMENDED | The release check blocks a release if a template regresses. The Claude Code hook only logs. A review is known by its file header. |

The three values for O2 (G1): the most words in the review body, the most reflection questions in the Strategic Challenge, and where the first two cross-domain ideas sit.

## How to answer

You can answer in one word per group, or pick items one by one.

- KEEP-ALL: change nothing in the group (the old rule stays for every item).
- RECOMMENDED: take the recommendation printed on every card of the group.
- CUSTOM: name one option for every item of the group, as Ox=OPTION pairs.

```
G1 RECOMMENDED
G2 KEEP-ALL
G3 CUSTOM O6A=ADVISORY O6B=LOG-ONLY O8=FRONTMATTER
```

The main session writes the token into the answer line of the group. If O2 is SET-CAPS, the main session also writes your three values into the three O2-VALUE lines, and plan 370-04 stops until they are not PENDING. The executor of this plan wrote no answer. Every answer line below reads PENDING.

## Words in this card

- Review body: the part a student reads.
- File header: the block at the top of a review file. It may keep tool names and provenance.
- Denylist: the list of names that must not appear in the review body. It is built from the repo files at check time.
- Hard term: a name that fails under every option (agent names, MCP, Neo4j, Brain, Theo, slash commands, tool ids, room file names).
- Soft term: a plain word that a student venture may really use. There are two: database and graph.
- Filing door: the tool that files a review on Desktop and Cowork (artifact_file).
- Hook: a check that runs when Claude Code writes a file. It runs on the Claude Code CLI only.
- Tags: PROVEN means I ran the command or read the line in this session (2026-11-08). UNVERIFIED means I did not run it. Cowork is UNVERIFIED on every card.
- Canon Part 8: this card holds names, counts and line numbers only. No room was read.

HEAD-AT-DECISION: 46b7dd8c39dd86904ce8e299625ded8c27250413

## G1 What the student sees

### O1 score table and grade in the review

Question: should the student's review show a score table and a letter grade, or keep the numbers out of the review body?

Facts:
- commands/grade.md line 250 says "You MUST ALWAYS show the scoring table". references/methodology/grade.md line 145 says the table MUST appear in EVERY output, line 26 lists leaving it out as an anti-pattern, and the template table starts at line 164. (PROVEN)
- commands/deep-grade.md lines 167 to 170: the percentile is computed in the orchestrator and shown with "~" and a small-sample note. (PROVEN)
- docs/MINDRIAN-CANON.md Part 12, line 744: "Never grade (no scorecards ...)". CLAUDE.md says default to withholding grades. The locked shape in the ROADMAP has no table. (PROVEN)
- Search for the text "P0 CONSTRAINT" in tests/: no hit. The hits are in commands/grade.md, references/methodology/grade.md and the generated mirror skills/grade/SKILL.md. (PROVEN)
- tests/test-265-deep-grade-rubric.cjs pins the agent's internal "### Rubric Scores" table (agents/grading.md line 169). That table stays in the internal record under every option. (PROVEN)

Surfaces: CLI, Desktop and Cowork all read the same two files. Cowork UNVERIFIED.

KEEP means: the old rule stays. The contract gains one optional "Scores" section after Strategic Challenge.
WITHHOLD means: no letter grade, no percentile and no component table in the review. The numbers stay in the file header and in chat when the student asks.
GRADE-ONLY means: a letter grade and a percentile line may appear in the Executive Summary. No component table.

Cost of each non-KEEP option: WITHHOLD edits the P0 line in two files and the artifact template table, then the skill mirrors are regenerated. GRADE-ONLY edits the same P0 lines and adds one summary line rule. KEEP edits the fewest lines but needs one new optional section in the contract data and its check.

Recommendation: WITHHOLD. Reason: Canon Part 12 withholds grades by default, and the locked shape has no table.

OPTIONS O1: KEEP | WITHHOLD | GRADE-ONLY ; RECOMMENDED: WITHHOLD

### O2 length and question counts

Question: how long may a review be, and how many reflection questions may it hold?

Facts:
- The paper author said "still too long" first (SEED-102 line 22; 370-INPUT.md line 19). (PROVEN)
- The ROADMAP fixes only 3 to 5 revision points and at most 2 cross-domain ideas. (PROVEN)
- No word cap exists anywhere. data/review-contract.json line 36 holds "limits": {}. (PROVEN)
- This card proposes no number. You give the three values, or you answer KEEP.

Surfaces: the check is the same code on CLI, Desktop and Cowork. Cowork UNVERIFIED.

Each value: body_words_max is a whole number of words for the review body. reflection_questions_max is a whole number of reflection questions in Strategic Challenge. cross_domain_under is research_reframe, strategic_challenge or NONE, the place where the first two cross-domain ideas sit. If you set a place, the "For advanced students" note stays allowed, so extras there still pass (D-01 stays satisfiable).

If O2 is SET-CAPS, the main session writes your three values into the lines below, and plan 370-04 stops until they are not PENDING.

Cost of each non-KEEP option: SET-CAPS makes the check fail a review that is too long or has too many questions. KEEP leaves length to the human rubric only.

Recommendation: SET-CAPS. Reason: the author's first complaint was length, and only a number makes the check able to fail it.

OPTIONS O2: KEEP | SET-CAPS ; RECOMMENDED: SET-CAPS
O2-VALUE body_words_max: PENDING
O2-VALUE reflection_questions_max: PENDING
O2-VALUE cross_domain_under: PENDING

### O4A the persona quote

Question: should the review keep a quote in the voice of a professor whose real surname is in the text?

Facts:
- The quote section is in agents/grading.md lines 151 to 153, 164 to 165 and 213, in commands/grade.md line 187 and in commands/deep-grade.md line 174. (PROVEN)
- The section carries a professor's surname in tracked files and in the student-facing body. (PROVEN)
- House rule: no individual's name on a public PwS surface and no real names in tracked repos.
- The section is not in the locked shape.

Surfaces: the same text feeds CLI, Desktop and Cowork. Cowork UNVERIFIED.

KEEP means: the quote section stays as it is.
NO-NAME means: one short quote stays as a block quote at the end of the Executive Summary, with no personal name.
DROP means: no persona quote.

Cost of each non-KEEP option: NO-NAME edits the quote section in four places and adds a rule to the contract text. DROP removes the section in the same places and the matching line in the internal template.

Recommendation: DROP. Reason: it leaves the locked shape and removes the surname with the least text.

OPTIONS O4A: KEEP | NO-NAME | DROP ; RECOMMENDED: DROP

### O4B other students' projects in comparison lines

Question: may a review name another student's project when it compares?

Facts:
- agents/grading.md lines 64 to 71 hold the anchor table (internal). Line 149 and line 212 tell the model to write "the [named submission] did X, your submission does Y". (PROVEN)
- A named comparison in a student-facing review discloses another cohort's project. (PROVEN, by the text)
- No code can detect this in a live review. It is UNVERIFIED by code. Templates are linted. The human rubric reads it.

Surfaces: the same text feeds CLI, Desktop and Cowork. Cowork UNVERIFIED.

KEEP means: named comparisons stay.
ANONYMIZE means: the comparison stays but names no project ("a higher-scoring submission in the same course").
DROP means: no comparison lines.

Cost of each non-KEEP option: ANONYMIZE edits three lines of the agent text and its template. DROP removes the comparison step, which weakens the "top improvements" lines.

Recommendation: ANONYMIZE. Reason: the comparison helps the student, and the name adds only a disclosure risk.

OPTIONS O4B: KEEP | ANONYMIZE | DROP ; RECOMMENDED: ANONYMIZE

GROUP G1: O1, O2, O4A, O4B
GROUP-SHA256 G1: acfc6ff5d982131c65632961b05824fcd170c0bb9f3cbb89a89542e5cc8fd87f
OWNER-ANSWER G1: PENDING

## G2 How strict the check is

### O3 the soft terms "database" and "graph"

Question: when a student's own venture is about a database or a graph, may the review use those two plain words?

Facts:
- The ROADMAP says "graph or database names" fail. data/review-contract.json lines 55 to 58 hold the two soft terms and the shipped policy, strict. (PROVEN)
- Hard names never pass under any option: agent names, MCP, Neo4j, Memgraph, Cypher, Brain, Theo, SQLite, room.db, "knowledge graph", "graph database", the four room file names, slash commands and tool ids (data/review-contract.json lines 38 to 53). (PROVEN)
- Brain and Theo are case-sensitive hard terms. A student whose name or venture is Theo, or a neuroscience venture that writes the word Brain with a capital, would be flagged. The strict default stands until you answer, and no option exempts these two words. (PROVEN: flags are empty on lines 42 and 43)
- Source text for the exemption comes from lib/core/review-contract.cjs collectSourceText (line 564). It reads .md files inside section folders. It skips dot-names, symlinks, the folders grades, deep-grades and node_modules (line 546), the files BRAIN.md, STATE.md, REASONING.md and ROOM.md (line 545) and any file that is itself a review (line 580). (PROVEN)
- The soft-term policy is applied at lines 496 to 509 of the same file. (PROVEN)
- The CLI hook has no student text, so it skips soft terms. The filing door will read the room (plan 370-05). The pre-file wrapper takes source files (plan 370-08). (UNVERIFIED: both are planned, not built)

Surfaces: CLI hook skips soft terms. Desktop and Cowork reach the filing door. Cowork UNVERIFIED.

KEEP means: strict. The two words fail everywhere in the review body.
EXEMPT-IF-IN-SOURCE means: a soft term passes when the student's own section text uses the word. The word fails otherwise.
COMPOUND-ONLY means: the bare words pass. Only compound names such as graph database, knowledge graph and Neo4j fail.

Cost of each non-KEEP option: EXEMPT-IF-IN-SOURCE changes one policy word in the data file, but a student who writes "database" once lets the review use it everywhere. COMPOUND-ONLY changes the same word and lets a bare "the database" about the platform slip through. KEEP fails a correct review of a database or graph venture.

Recommendation: EXEMPT-IF-IN-SOURCE. Reason: it protects students whose venture needs the words and still blocks platform talk.

OPTIONS O3: KEEP | EXEMPT-IF-IN-SOURCE | COMPOUND-ONLY ; RECOMMENDED: EXEMPT-IF-IN-SOURCE

GROUP G2: O3
GROUP-SHA256 G2: 6a1310688bc4250c3d3fff43d58108c660a82fc8ae52ce5e0c60f182f386ed8f
OWNER-ANSWER G2: PENDING

## G3 Where the check runs

### O6A the release check (doctor gate)

Question: if a shipped template or test fixture breaks the review contract, should a release be refused, or only warned about?

Facts:
- scripts/doctor.cjs line 1230 starts the gates list. The gates connector, projection, framework-vocabulary, render (line 1245) and skill-mirrors (line 1252) block, because the roll-up is ok only when the script exits 0. (PROVEN)
- The siblings shape-declaration (line 1261), tool-honesty (line 1272) and theo-mcp-exposure (line 1286) are advisory because their scripts exit 0 and only warn. (PROVEN)
- The new gate would check fixtures and shipped templates only, offline, never student text. Its false-positive risk is low. (ASSUMED, from the plan)

Surfaces: release time only. It does not run on a student's machine. Cowork UNVERIFIED.

KEEP means: no doctor entry.
ADVISORY means: a warning only; a release goes out with a regression.
BLOCKER means: a release is refused when a template or fixture regresses.

Cost of each non-KEEP option: BLOCKER can stop a release for a fixture mistake. ADVISORY lets a leak ship, and nobody may read the warning. Both add one entry and one script to scripts/doctor.cjs.

Recommendation: BLOCKER. Reason: the gate is offline and fixture-based, so a failure is a real regression.

OPTIONS O6A: KEEP | ADVISORY | BLOCKER ; RECOMMENDED: BLOCKER

### O6B the Claude Code hook

Question: when Claude Code writes a review file with the plain Write tool, should a hook only log a problem, or block the write?

Facts:
- hooks/hooks.json has four PreToolUse entries today. The first is write-scope-check for Write, Edit and MultiEdit with timeout 3. (PROVEN)
- scripts/write-scope-check.cjs header (lines 3 to 15): exit 2 blocks, any parse failure exits 0 (fail open), "a false block is worse than a false allow". (PROVEN)
- scripts/check-voice-style.cjs header (lines 1 to 45): the Phase 369.6 ladder logs first and never blocks. (PROVEN)
- Cost of one more node start on every Write call: about 20 ms. Command: `for i in 1 2 3 4 5 6 7 8 9 10; do node -e 0; done` timed with date +%s%N; two runs gave 22.2 ms and 18.7 ms per start (Node v22.23.1). (PROVEN)
- Hook rules from plan 370-06: Write tool only, so Edit and MultiEdit are not covered. It skips files that are not .md, files inside the plugin repo root and files under the repo-source folders pipelines, tests, .planning, references, agents, commands and skills (named in the path below the working folder). A repo spec with a grade header is never checked. It skips soft terms. It fails open on any error. (UNVERIFIED: planned, not built)
- Latency budget (arm H11, median of 20 spawns): at most the bare node start plus 50 ms for a non-review write, and plus 150 ms for a review write. (UNVERIFIED: planned)

Surfaces: hooks fire on the CLI only. Desktop and Cowork get the filing door instead. Cowork UNVERIFIED.

KEEP means: no hook. The CLI is protected by the pre-file wrapper and the doctor gate.
LOG-ONLY means: the hook records rule, class and line to a local log and never blocks.
ENFORCE means: the hook exits 2 with the rule list and the write is refused.

Cost of each non-KEEP option: LOG-ONLY adds about 20 ms to every Write call and writes a local log row on a hit. ENFORCE adds the same time and can stop a user on a wrong match. The hook is never the only protection.

Recommendation: LOG-ONLY. Reason: it follows the 369.6 ladder (log first), and a false block is worse than a false allow.

OPTIONS O6B: KEEP | LOG-ONLY | ENFORCE ; RECOMMENDED: LOG-ONLY

### O8 how a file is known to be a review

Question: should the tools decide that a file is a review by its file header, or not classify files at all?

Facts:
- Three filing paths exist in the text: commands/grade.md line 16 `produces: "room/**/grades/*"`; the lines "File this ... to problem-definition?" in commands/grade.md lines 227 and 255; commands/deep-grade.md line 198 and agents/grading.md line 207 file to room/competitive-analysis/. (PROVEN)
- A path rule would miss real files, because the folders differ. (PROVEN, from the three paths)
- A review written with no header escapes the filing door and the hook. This is a stated limit. The pre-file wrapper and the doctor gate still apply. (ASSUMED, from the plan)
- The filing-folder question is not decided here. `produces:` stays byte-stable (D-13).

Surfaces: the filing door serves Desktop and Cowork; the hook serves the CLI. Cowork UNVERIFIED.

KEEP means: no classification. Plans 370-05 (filing door) and 370-06 (hook) are declined, and only the pre-file wrapper and the doctor gate protect.
FRONTMATTER means: a file whose header has methodology: grade or deep-grade, or a review_contract key, is a review.

Cost of FRONTMATTER: the door and the hook run, and a review with no header is not checked by them. Cost of KEEP: the door and the hook never run, and Desktop and Cowork have no write-time check.

Recommendation: FRONTMATTER. Reason: it is the only rule that holds across the three folders.

OPTIONS O8: KEEP | FRONTMATTER ; RECOMMENDED: FRONTMATTER

GROUP G3: O6A, O6B, O8
GROUP-SHA256 G3: 8e63aeb5e4a45fb005657a35fbfbb2ce09f5769fa6fcd98cf0c2a13a651b04d3
OWNER-ANSWER G3: PENDING

## Notes: plan defaults you can overrule

These four notes have no answer line. The plan default stands unless you say otherwise.

- O5 taught-terms list. Default: no list exists, none is built, and no taught-terms warning is added. The code checks names, shape and counts only. The human review rubric reads whether terms are taught. You can overrule: name an owner and a place for a list.
- O7 scope boundary. Default: grade and deep-grade only. The writers grade-grant, grant-reviewer, vault-section-reviewer and chain-step-reviewer are out of scope. You can overrule: ask for one of them in a later phase.
- O9 the --full report. Default: the section roll-up stays chat-only progress and is never the filed review. The filed review follows the fixed shape. You can overrule: ask for the roll-up to become part of the filed review.
- N1 Sci-Fi Connection and Visual Synthesis. Default: they sit outside the locked shape, so they leave the review body and the agent is not required to write them. You can overrule: you may want one cross-domain idea under "For advanced students" instead.

## What happens after your answer

- A gated plan runs only for an answered group. Plans 370-04 to 370-10 each start with the gate command and stop on exit 1 (blocked) or exit 2 (you said keep).
- An answer of KEEP for an item makes the plan that serves it do nothing or take its KEEP branch. O8 KEEP declines plans 370-05 and 370-06. O6B KEEP declines plan 370-06. O6A KEEP declines plan 370-10.
- Nothing is pushed, tagged or released by these plans. A change reaches users only after a release is cut and picked up.

## How the answer is recorded

The main session writes your token into the OWNER-ANSWER line of each group, writes the O2 values into the O2-VALUE lines, and commits that one edit with git commit --only on this one path. The options and the hash on the group lines are sealed: if an option line changes after your answer, the gate refuses the answer and asks again.
