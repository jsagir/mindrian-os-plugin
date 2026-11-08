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

HEAD-AT-DECISION: 0000000000000000000000000000000000000000

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
GROUP-SHA256 G1: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G1: PENDING

<!-- gsd:write-continue -->
