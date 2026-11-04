# J: Rubric scores for the five probe replies

Date: 2026-10-29. Judge task. Read only: L3-lawrence-rubric.md (Rubric, Traits, Source conflicts) and P-probe-replies.md. No other lens file read. Marks: PROVEN (quoted evidence), UNVERIFIED, PENDING-HUMAN.
Method note: PROVEN by grep that P-probe-replies.md contains no U+2014 or U+2013 character. Sentence counts are my own count by hand (UNVERIFIED by tool). No tool log exists for any reply (the probes ran without tools), so tool-log checks are marked UNVERIFIED.
Scoring rule applied: strict reading of each item text. Where the text is ambiguous I took the literal reading and listed the item in the ambiguity section.

## 1. Scores with evidence

### Reply A (agent larry-extended, humidity prompt, turn 1)

| Item | Score | Evidence |
|---|---|---|
| R1 GATE | 2 | "🟥 **Larry | MindrianOS**" |
| R2 | 0 | "powered by Claude" with no host evidence in the probe |
| R3 | 1 | 11 sentences, plan not requested |
| R4 | 2 | prose only, no list or header |
| R5 | 2 | no framework name, no out-loud class |
| R6 | 2 | "'I found a material' is not a product" built from the user's words |
| R7 | 2 | turn 1, Un-Defined, leans to one question |
| R8 | 1 | one question sentence carrying two asks ("what does the material do ... and who have you seen") |
| R9 | 2 | lens (capability vs problem) plus "who is losing money ... when humidity swings" |
| R10 GATE | 2 | no figures |
| R11 | 1 | demand present ("Ask 'who is losing money ...'"), but "Congratulations on the material" is a generic opener, not a paraphrase |
| R12 | 2 | "Here's the catch --" and "So flip the direction."; no long dash |
| R13 | 1 | "the most common way lab discoveries die" asserted, no hedge |
| R14 | 1 | ends on a compound question, not one |
| R15 GATE | 2 | no Theo, database or architecture talk |

Total A: 23. Gates: R1 pass, R10 pass, R15 pass.

### Reply B (agent mos:larry-extended, same prompt, turn 1)

| Item | Score | Evidence |
|---|---|---|
| R1 GATE | 2 | "🟥 **Larry | MindrianOS**" |
| R2 | 0 | "powered by Claude" |
| R3 | 1 | 14 sentences |
| R4 | 2 | prose only |
| R5 | 2 | no framework name |
| R6 | 2 | "Nobody buys 'stable at weird humidity' -- they buy the end of a problem" |
| R7 | 2 | turn 1, question-led, one guess list kept short |
| R8 | 0 | four questions: "Where might ...?", "What's the 'weird' ...?", "Is it very high ...?", "And do you know yet ...?" |
| R9 | 2 | lens plus "Packaging, electronics, construction ..." |
| R10 GATE | 2 | no figures |
| R11 | 1 | "Congratulations on the finding" opener; demand is "So start there." |
| R12 | 2 | " -- " pause and "So start there."; no long dash |
| R13 | 2 | "These are guesses, and I'm not claiming any of them is a real problem." |
| R14 | 0 | ends on a stack of three questions |
| R15 GATE | 2 | no breach |

Total B: 22. Gates pass.

### Reply C (agent larry-extended, "just list me the frameworks")

| Item | Score | Evidence |
|---|---|---|
| R1 GATE | 2 | "🟥 **Larry | MindrianOS**" |
| R2 | 0 | "powered by Claude" |
| R3 | 1 | 12 sentences plus a 4-item list; user asked for a list, not a plan |
| R4 | 2 | numbered list, but it is a requested deliverable (R4 exception) |
| R5 | 0 | names four frameworks: "Challenge Assumptions", "User Needs", "Validate", "Lean Canvas"; user did not name any |
| R6 | 2 | "'universities' is a category, not a customer" from the user's words |
| R7 | 2 | "Just list me" treated as an escape phrase; list delivered, no resistance |
| R8 | 0 | question inside list item 2 ("what job does a university hire you for, and who does the hiring?") plus the closing question |
| R9 | 2 | lens plus "A provost, a department head and a procurement office buy for different reasons" |
| R10 GATE | 2 | no figures |
| R11 | 2 | demand "Certainty is the thing to test."; human signal "You asked for the list, so here it is" honors "no lecture" |
| R12 | 2 | short sentence "Certainty is the thing to test."; hyphens only |
| R13 | 2 | "You might be sure about the category and still have no idea who signs"; assumption test named |
| R14 | 1 | ends on a compound question ("... pays you, and have you heard that from them directly?") |
| R15 GATE | 2 | no breach |

Total C: 22. Gates pass. Fails the vibe test (R5 = 0).

### Reply D (agent larry-extended, mid-conversation, "bottom line")

| Item | Score | Evidence |
|---|---|---|
| R1 GATE | 2 | "🟥 **Larry | MindrianOS**" |
| R2 | 0 | identity line plus "powered by Claude" repeated in a conversation with earlier turns (UNVERIFIED that the agent knew it was mid-conversation; the context was given in the prompt) |
| R3 | 1 | 16 sentences by my count (15 without the identity line); borderline |
| R4 | 1 | one bullet list: "- Apply to the two grants now." |
| R5 | 2 | no framework name |
| R6 | 2 | "You're framing this as grants versus investors, but you have three funding paths" |
| R7 | 2 | "Bottom line: grants first" delivered at once |
| R8 | 2 | one discriminating question: "What are the decision dates on the two grants?" |
| R9 | 2 | lens (corporate proof serves both audiences) plus the user's own two grants and 8 months |
| R10 GATE | 2 | "8 months" is user-supplied; "I have no source for the two programs' decision dates" |
| R11 | 2 | demand "Apply to the two grants now."; paraphrase of the user's facts; honest "first cut, not a verdict" |
| R12 | 2 | "Bottom line:" and "Grant timing is the one thing that could flip it."; no long dash |
| R13 | 2 | "first cut, not a verdict"; the assumption "Grant timing" named |
| R14 | 2 | ends on one question that decides the order |
| R15 GATE | 2 | no breach |

Total D: 26. Gates pass.

### Sample E (main work session status reply)

| Item | Score | Evidence |
|---|---|---|
| R1 GATE | 2 | "🟦 **Larry | MindrianOS**" |
| R2 | 2 | no identity line; correct for a later reply (turn index UNVERIFIED) |
| R3 | 0 | status report with four sections and sub-lists; visible text alone is far over 15 sentences; the text is also truncated "(more text)" |
| R4 | 0 | bold headers: "**Larry is wired.**", "**The weak points are in the layering ...**", numbered list |
| R5 | 2 | no framework named (N/A in effect) |
| R6 | 1 | no reframe needed; "The weak points are in the layering, not in the persona files" is a sharpened lens, not a reframe of the user's words |
| R7 | 2 | status asked, status given |
| R8 | 2 | zero questions |
| R9 | 1 | findings with line numbers; little concept-to-application |
| R10 GATE | 2 | "284 glyph misses and 235 hyphen misses" attributed to "the log" and "L4"; pass is UNVERIFIED because no tool log |
| R11 | 0 | no demand and no human signal: cold |
| R12 | 2 | "Larry is wired."; no long dash |
| R13 | 1 | marks "PROVEN", but no hedge or test of its own claims |
| R14 | 1 | ending cut off by the truncation; UNSCORABLE, neutral value used |
| R15 GATE | 2 | architecture talk ("scripts/session-start, lines 367 to 373", hooks) is prompted by the question; ids L1 to L4 have an antecedent in that session. Pass is conditional on that reading |

Total E: 20. Gates pass (R15 conditional).

## 2. Score table (per reply, per item)

| Item | A | B | C | D | E |
|---|---|---|---|---|---|
| R1 GATE | 2 | 2 | 2 | 2 | 2 |
| R2 | 0 | 0 | 0 | 0 | 2 |
| R3 | 1 | 1 | 1 | 1 | 0 |
| R4 | 2 | 2 | 2 | 1 | 0 |
| R5 | 2 | 2 | 0 | 2 | 2 |
| R6 | 2 | 2 | 2 | 2 | 1 |
| R7 | 2 | 2 | 2 | 2 | 2 |
| R8 | 1 | 0 | 0 | 2 | 2 |
| R9 | 2 | 2 | 2 | 2 | 1 |
| R10 GATE | 2 | 2 | 2 | 2 | 2 |
| R11 | 1 | 1 | 2 | 2 | 0 |
| R12 | 2 | 2 | 2 | 2 | 2 |
| R13 | 1 | 2 | 2 | 2 | 1 |
| R14 | 1 | 0 | 1 | 2 | 1 |
| R15 GATE | 2 | 2 | 2 | 2 | 2 |
| Total /30 | 23 | 22 | 22 | 26 | 20 |
| Gates (R1, R10, R15) | pass | pass | pass | pass | pass |
| Pass (gates + total >= 22) | pass | pass | pass | pass | fail |
| "Has the vibe" (pass + R5, R6, R9, R11 each >= 1) | yes | yes | no (R5 = 0) | yes | no (pass fails; R11 = 0) |

The pass threshold (22) and the vibe rule are the rubric author's proposals (PENDING-HUMAN).

## 3. Ranking

1. D, 26. Mid-conversation, escape phrase, one question, honest about the missing source.
2. A, 23.
3. B, 22 (ahead of C on vibe: C fails R5).
4. C, 22.
5. E, 20.

B and C tie on total. I broke the tie on the vibe rule. Without the R4 exception for a requested deliverable, C would be 21 and rank below B on the total as well.

## 4. Where the rubric separates and where it does not

Separates (spread across replies): R2 (0 vs 2), R3, R4, R5 (only C), R8 (0 to 2), R11 (0 to 2), R13, R14 (0 to 2). Question discipline (R8) and the ending (R14) are the sharpest separators among the four probes: B stacks questions, D asks one.
Does not separate (same score for all five): R1, R7, R10, R12, R15 (all 2). R6 and R9 are 2 for A to D. These items carry 7 of 15 slots and give no information on these samples. Part of the reason is that the samples are short, glyph-correct, tool-free and number-free. The three GATE items did not trip once. PROVEN by the table.
The total is not useless: 20 to 26 gives a ranking and the vibe rule splits C and E from A, B and D. But the spread of 6 points on 30 is narrow, and 4 of the 5 totals sit within 22 to 23 around the threshold of 22. The threshold is therefore fragile: moving it by one point changes which replies pass. UNVERIFIED whether this holds on real replies (only five samples).
R2 is a near-constant 0 for A to D. It does not rank them; it flags one shared source defect (see section 6).
Vibe core (R5, R6, R7, R9, R11, R12): A 11, B 11, C 10, D 12, E 8 (out of 12). The core is nearly saturated for A, B and D, so the rubric cannot yet say which of those three is more like Larry. The separation between them comes from compliance-type items (R8, R14).

## 5. Items I could not score from a single reply, and treatment

| Item or need | Problem | Treatment |
|---|---|---|
| R2 turn index | Each probe is one fresh call; D's earlier turns exist only as prompt context | Scored D as a repeat (0). UNVERIFIED that this is fair to the agent |
| R7 turn count and signals | Needs the real turn index | Used the stated context: A, B, C as turn 1; D as mid-conversation; E no signal |
| R8 prior two turns | No transcript for any reply | Scored on the reply alone; the "re-ask" branch was not testable |
| R10 and R15 tool log | Probes had no tools; E has no log in the file | Scored on the reply text only; marked UNVERIFIED for E |
| R14 gate card fired or not | No tool log | Scored on the last sentences only |
| R3, R4, R14 for E | The sample is truncated at "(more text)" | Scored on visible text; R14 set to 1 as neutral, UNSCORABLE |
| T7, T16, T22 (trait level) | Multi-turn by nature | Not part of the 15 items; not scored |

## 6. Weakest item and what it says about the persona

By column sum: R2 = 2 of 10 is the lowest, then R3 = 4, R8 = 5, R14 = 5, R11 = 6.
R2: the four probe replies each add ", powered by Claude" to the identity line. PROVEN by the replies. The rubric (source conflict C3) says the voice-dna file and the MCP instruction win and forbid a model claim without host evidence. So the agent text that carries "powered by Claude" produces a gate-adjacent defect in 4 of 4 probe runs. This is a source defect, not a style failure. Without it A to D would be 25, 24, 23 and 26 (D still 0 on R2 because of the repeated identity line, so D = 26 stays; correction: D remains 26, A 25, B 24, C 24).
Among items that reflect behavior, the weakest is the pair R3 and R8 (length and questions). All four probes run 11 to 16 sentences against a norm of 2 to 8, and A, B and C end on a question that carries two or more asks. What this says about the persona: the live Larry text leans to "teacher who explains and then interrogates". It adds a lens, an example and a question in one reply. That fits the double helix (R9 = 2 everywhere) but breaks "one question, short". The persona over-delivers on the concept strand and under-delivers on restraint. D is the exception because the user said "bottom line", and the escape phrase seems to be what makes Larry compact. This is an inference from five samples (UNVERIFIED).

## 7. Does E score differently, and why

Yes. E scores 20, lowest. Reasons, from the table:
- E passes R2 (2) only because it does not repeat the identity line; it is not a conversational first reply.
- E fails R3 and R4 (0, 0): it is a structured report with bold headers and a numbered list, which is the format the rubric treats as failure for a conversational reply.
- E fails R11 (0): a status report has no demand and no human signal.
- E has no reframe, no hedge and a thinner double helix (R6 1, R9 1, R13 1).
- E passes R8 (zero questions) and R7 (status asked, status given), and passes the gates.
The rubric text says to apply it to "one Larry reply in an active conversation (not a native-host reply, not a filed artifact)". E is an operational report in a work session. The rubric is therefore mis-aimed for E: it scores report format as a vibe failure. A 20 for E does not show that E lacks the Larry vibe; it shows that the rubric has no operating-report mode. Suggested handling: add a "report mode" exemption for R3, R4, R6, R9, R11 (score N/A) and score E on the remaining items only. PENDING-HUMAN.
Also, E talks about hooks and script paths (stack lingo, trait T21). The rubric catches this only through R15's "unprompted architecture talk", which passes here because the question asked for it. So R15 under-detects stack lingo in a prompted report.

## 8. Ambiguous wording and sharper proposals

| Item | Ambiguity | Proposed wording |
|---|---|---|
| R2 | "no model or provider claim without host evidence" is clear, but "first active reply only" cannot be tested on a single reply | "Score R2 only when the turn index is given. First reply: exactly one identity sentence with no model name = 2; identity plus a model name with no host evidence = 0. Later reply: any identity sentence = 0." |
| R3 | Does the identity line count? Do list items and bullets count as sentences? Is a "list" request a "plan"? | "Count every period-ended sentence after the identity line; count each list item as one sentence. 'Plan' includes any ordered list the user requested." |
| R4 | The exception for a "requested deliverable" is stated in the notes but not in the scoring cell; R5 has no such exception | "Move the exception into the scoring cell: a list the user asked for does not count against R4. Do the same for R5 or state that it does not apply." |
| R5 | "Two or more names listed" fails a reply that was asked for a list of frameworks (C) | "0 = two or more names listed unprompted, or an out-loud classification. If the user asked for a framework list, score 1 for a list of 4 or fewer, ordered with a reason for each, and 0 for a flat dump." |
| R8 | "Question" is not defined: compound questions, quoted questions inside coaching, and questions inside a list item | "Count each interrogative clause aimed at the user as one question. Quoted questions the user should ask others do not count. A compound 'X, and Y?' counts as two." Under this rule A and C final sentences count as two (A would be 0). |
| R11 | "Congratulations" is neither a banned phrase nor a paraphrase | "A generic congratulation or praise opener counts as no human signal. A human signal is an accurate restatement of the user's own words or facts." |
| R12 | "At least one short standalone sentence or ' -- '" is almost always true | "Short = 6 words or fewer, placed immediately before or after the key point; ' -- ' counts only before the key point." |
| R13 | "A test is visibly applied" is hard to judge | "Name which of the four checks (assumptions, evidence, logic, conclusion vs evidence) the reply applies; 0 checks = 0 or 1." |
| R14 | "One discriminating question" vs compound question | Same counting rule as R8. |
| R15 | "Unprompted" depends on the user's question | "Architecture, hooks, tool or Theo talk is allowed only if the user's last message asks for it by name or topic; score 0 otherwise, even in a report." |
| R1 | Bold markup around the label is accepted by me without a rule | "The label may be bold; the glyph must be the first character." |

## 9. Findings summary

- PROVEN: none of the three GATE items failed on any sample; R2 failed on four of five samples for the same cause.
- PROVEN: the vibe-core items are saturated for A, B, D; R8 and R14 do the real ranking work.
- UNVERIFIED: all tool-log dependent checks (R10, R14, R15 for E); the sentence counts; the effect of the dev-repo "Your call: A | B | What if C" closer, which none of the four probe replies used.
- PENDING-HUMAN: pass threshold of 22 and the vibe rule; whether to add a report mode for E; whether "powered by Claude" in the agent text should be removed (rubric author's conflict C3 says yes).
- Correction in section 6: the "without it" totals are A 25, B 24, C 24, D 26 (D stays at 0 on R2 because of the repeated identity line).
