---
status: resolved
trigger: "brain_ask blocks 5 of 12 generic methodology exam questions as room_content / token_class name; questions carry capitalized tool names Theo does not know (Problem Interview, Opportunity Fitness Check, Five Whys, 5 Whys Technique). Lowercase re-ask passes. Second defect: brain_ask DirectiveEnvelope directive + next_gate are identical for every question."
created: 2026-10-18
updated: 2026-10-18
related:
  - .planning/debug/resolved/part8-egress-guard-room-lexicon-false-positive-blocks-theo.md
  - .planning/debug/245-part8-contentless-block.md
  - /home/jsagi/PWS-Book/corpus/research/theo-learning-baseline-2026-10-18.md (Baseline B section)
---

# Debug: Part 8 egress guard blocks unknown capitalized tool names as `name`

## Symptoms

- **Expected:** a generic methodology question (no room content, no personal data) passes the PreToolUse hook `scripts/part8-egress-guard-hook.cjs` and reaches `brain_ask`. Plugin 2.0.0-beta.69's classifier is reported to allow these (`allow, generic_question`).
- **Actual:** 5 of 12 questions block with:
  `Canon Part 8: outbound Theo payload carries room content (room_content, name). Blocked.`
- **Blocked questions (verbatim):**
  - Q2 "When should you use a Problem Interview, and what does it let you distinguish?"
  - Q5 "What are the seven lenses of the Opportunity Fitness Check?"
  - Q7 "Which chapters teach Five Whys, and for which problem type?"
  - Q8 "Which PWS core idea does the Problem Interview serve?"
  - Q11 "Are \"5 Whys Technique\" and \"Five Whys Technique\" the same framework?"
- **Allowed questions (verbatim, control set):**
  - "When would a navigator hire a Pre-Mortem, and for what outcome?"
  - "What kind of entity is Lean Canvas: a framework, a method, or a canvas/template?"
  - "Which techniques make up Scientific Roadmapping?"
  - "What primary source supports the steps of Process Mapping?"
  - "After a Jobs to Be Done analysis, which tool comes next and what is handed over?"
  - "After analyzing a system, which tool finds where it is constrained?"
  - "Is OODA for agentic AI a separate framework or a case study of the OODA Loop?"
- **Diagnostic:** Q2 in lowercase ("when should you use a problem interview, and what does it let you distinguish?") was ALLOWED.
- **Bound room at the time:** jhtv-oliver-kuntz (resolver via `resolveLexiconRoom`). A grep of that room's .md files for the blocked tool names found no match, so the room lexicon is probably not the source. The class is `name` (a proper-name heuristic), not a lexicon kind.
- **Timeline:** seen 2026-10-18 on beta.69 (first run after update from beta.59).
- **Reproduction:** call `mcp__plugin_mos_mindrian-brain__brain_ask` with Q2 above, or feed the hook a PreToolUse payload with that question.

## Hypothesis (initial, unverified)

The guard's proper-name detector treats a capitalized multi-word phrase as a person name unless the phrase is in a known framework allow-list. Tools Theo does not know yet (exactly the tools a learning session must ask about) cannot be asked. Q7 "Five Whys" blocks although "5 Whys Technique" exists in Theo, so the allow-list probably holds a different spelling.

## Second defect (separate, record only unless same root)

All 7 allowed calls returned the same DirectiveEnvelope: directive.framework "Four Lenses of Innovation", problem_type IllDefined (heuristic), the same next_gate options (Four Lenses, JTBD, Cross-Disciplinary Thinking, Process Mapping). Only grounding.rows varied. Investigate whether the plugin shim or Theo builds this; fix only if it is in this repo and in scope; otherwise file a seed.

## Constraints

- GSD owns this repo's dev work. TDD mode on: write a failing regression test first.
- Canon Part 8 must stay intact: a real person name or room content must still block. Do not weaken the guard globally; fix the false positive narrowly. Add tests for both directions (generic tool names allow; a real person name like a two-word human name still blocks).
- The working tree has unrelated uncommitted files (.gitignore, docs/design/*). Never touch, stage or revert them. Commit only owned files with `git commit --only <paths>`.
- Do not push. Do not release.
- No em-dashes. No real names in tracked files (use pseudonyms in fixtures).

## Current Focus

hypothesis: CONFIRMED and FIXED (navigator option B). The 5 questions each held one TitleCase run outside every exemption of _hasUnknownProperName. The head nouns interview, check and whys now exempt those runs.
test: DONE. Adjusted test 10 passed, 0 failed, 3 skipped (XFAIL), 1 known-under-block. Real hook: Q2, Q5, Q7, Q8, Q11 and the lowercase twin exit 0; two-word human names exit 2. Four baseline suites and run-all-3692 compared before and after.
expecting: n/a (resolved)
next_action: none. Session archived to .planning/debug/resolved/ and the knowledge base. The commit is local only (no push, no release).

reasoning_checkpoint:
  hypothesis: "The 5 reported questions block because each holds exactly one TitleCase run outside every exemption of _hasUnknownProperName. A TitleCase word within 2 tokens of a METHODOLOGY_HEAD_NOUNS word is exempt (:996-1000). Adding the head nouns interview (Q2, Q8), check (Q5) and whys (Q7, Q11) exempts those runs, so the 5 questions allow."
  confirming_evidence:
    - "Power set of the 4 candidates (interview, check, whys, technique) over the real guard source loaded in memory: the set {interview, check, whys} allows 5 of 5; no smaller set does."
    - "Ablation: without interview Q2 and Q8 block; without check Q5 blocks; without whys Q7 blocks. technique adds nothing once whys is present (Q11 allows through whys)."
    - "Group C (5 human-name questions) stays blocked as room_content/name under all 16 subsets; the lowercase twin and the 7 controls stay allowed."
  falsification_test: "If any of Q2, Q5, Q7, Q8, Q11 still blocks with the 3 nouns in the real file, or any of H1..H5 allows, the hypothesis is wrong. Both are checked by the adjusted test (A1, C2) and by the real hook (A2, C3)."
  fix_rationale: "Navigator option B: a plain noun addition to the existing head-noun mechanism. It changes the allow policy by the approved amount and no further. No new rule, no new data file, no alias normalization."
  blind_spots: "The head-noun match is case-blind and position-blind, so the new nouns also exempt a person name near the plain English words check and interview (proven by in-memory probes, e.g. a pseudonym plus the verb check). That is the leak the navigator accepted with option B; it is documented by test leg K1 and SEED-130. The other Part 8 suites might encode an old behavior; checked by the baseline-versus-after comparison."

## Evidence

- timestamp: 2026-10-18 (this session)
  checked: real hook scripts/part8-egress-guard-hook.cjs fed a PreToolUse JSON for mcp__plugin_mos_mindrian-brain__brain_ask, HOME and USERPROFILE pointed at an empty scratch dir (no room registry, no room bound), PART8_FORCE_BRAIN_AVAILABLE=1. Driver: scratchpad run-hook.cjs.
  found: Q2, Q5, Q7, Q8, Q11 exit 2 with the exact stderr "Canon Part 8: outbound Theo payload carries room content (room_content, name). Blocked." The lowercase Q2 and all 7 control questions exit 0. 13 of 13 outcomes match the report with NO room bound.
  implication: PROVEN. The block does not depend on a room. The room lexicon is not involved.

- timestamp: 2026-10-18
  checked: theoVerdict/classify with roomDir = the real bound room (resolveLexiconRoom returned /home/jsagi/MindrianRooms/jhtv-oliver-kuntz, lexicon ok, 32 entries, loaded through the read-only door openRoomDbReadOnlyForCaller; no write, no hook telemetry) and with a synthetic fixture room.
  found: identical verdicts to the no-room run for Q2 (block name), lowercase Q2 (allow), Q5, Q7, Q8, Q11 (block name), Pre-Mortem control (allow). token_class is "name", never a lexicon kind (room_term, claim, person, venture_name, room_name, room_file).
  implication: PROVEN. The matched rule is step 4 (content rules) of theoVerdict, after the lexicon returned no hit. The result does not depend on one private room.

- timestamp: 2026-10-18
  checked: which code emits class name. Source read of lib/core/part8-egress-guard.cjs.
  found: theoVerdict returns _theoBlock('room_content', 'name', ...) at :1114-1116 when _hasUnknownProperName(str, isCypher) is true. _hasUnknownProperName is :948-1024. It (a) blanks every CANONICAL_PHRASES entry found in the lowercased string (:951-963); (b) walks words matching /[A-Za-z]+(?:-[A-Za-z]+)*/ (:980); (c) considers only a word matching /^[A-Z][a-z]/ (:987); (d) skips it when hyphenated (:991), sentence-initial (:992), a QUESTION_FUNCTION_WORDS / METHODOLOGY_TOKEN_SET / COMMAND_SLUG_SET / Cypher / METHODOLOGY_TECHNIQUE_WORDS member (:993-995), or within 2 tokens of a METHODOLOGY_HEAD_NOUNS word (:996-1000); (e) expands the word to its adjacent TitleCase run and skips the run when any run word is a methodology token or head noun, or the word just outside the run is a head noun (:1001-1020); (f) otherwise returns true (:1021).
  implication: PROVEN by reading and by the annotated run below. The rule has no notion of a person. It flags every TitleCase run it cannot prove is a methodology name.

- timestamp: 2026-10-18
  checked: annotated copy of _hasUnknownProperName (scratchpad annotate.cjs, loads the repo source with log lines added, repo file untouched) over the 12 questions.
  found: Q2 and Q8: "Problem" skipped (closed-vocabulary word, QUESTION_FUNCTION_WORDS has "problem"), "Interview" FLAGGED, run "Problem Interview". Q5: "Opportunity" FLAGGED, run "Opportunity Fitness Check" (no head noun among the three words). Q7: "Five" FLAGGED, run "Five Whys". Q11: "5 Whys Technique" is blanked as a canonical phrase, "Five Whys Technique" FLAGGED.
  implication: PROVEN. Question (1) answered. Each blocked question holds exactly one run outside every exemption.

- timestamp: 2026-10-18
  checked: why the 7 control questions and lowercase Q2 pass (same annotated run).
  found: Pre-Mortem: hyphenated compound exemption (:991). Lean Canvas, Scientific Roadmapping, Process Mapping, OODA Loop: blanked as canonical phrases (:953-962; they are in data/framework-names.json). OODA and AI: all-capital words fail /^[A-Z][a-z]/ (:987). "After analyzing a system": the only TitleCase word is sentence-initial. "Jobs to Be Done analysis": passes ONLY because the head noun "analysis" is adjacent to the run (:1019). Lowercase Q2: the rule only looks at words that start with a capital letter followed by a lowercase letter, so the lowercase phrase never enters the loop.
  implication: PROVEN. Question (2) answered. The controls pass by 4 different exemptions, one of them by accident (see the Jobs to Be Done probe below). The rule keys on capitalization, so lowercase is invisible to it.

- timestamp: 2026-10-18
  checked: why "Five Whys" blocks (spelling versus the allow-list). Substring search of data/framework-names.json (framework_names 421 + curated_extras 1) for "five whys", "5 whys", "problem interview", "opportunity fitness check".
  found: only "5 Whys Technique" exists (lowercased "5 whys technique"). "five whys", "five whys technique", "problem interview" and "opportunity fitness check" have 0 matches. The blanking test is lowercased(question).indexOf(fullPhrase), so "Five Whys" does not contain "5 whys technique". Normalizing the digit to a word ("five whys technique") would still not match "Five Whys" alone.
  implication: PROVEN. Question (3) answered. Not only a spelling mismatch: the allow-list holds one name in one spelling, and the question uses a shorter alias and a different numeral. A digit-word normalization alone does not fix Q7.

- timestamp: 2026-10-18
  checked: where the allow-list comes from and whether it is stale for beta.69. Compared repo and installed copy ~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.69/.
  found: CANONICAL_PHRASES (part8-egress-guard.cjs:820-828) is built once at module load from data/framework-names.json via _loadJsonSafe (:797-804): lowercase, longest first. The file is a Theo list_frameworks snapshot: snapshot_date 2026-10-14, theo_stamp mapped_by command-registry@2.0.0-beta.68, source_sha256 50384c9e..., 422 names. The installed beta.69 copy of part8-egress-guard.cjs, part8-room-lexicon.cjs, part8-egress-guard-hook.cjs and data/framework-names.json are byte-identical to the repo files (cmp, 4 of 4 SAME). The repo reads 2.0.0-beta.70.
  implication: PROVEN. Question (4) answered. The source is data/framework-names.json, not another snapshot. It was not refreshed for beta.69 (stamp says beta.68). It is NOT the cause for these 5 questions: per the baseline file, Theo has no Framework node for Problem Interview or Opportunity Fitness Check (FRAMEWORK_NOT_FOUND, "No Framework node") and only "5 Whys Technique" for the fifth. A refresh would add none of them. UNVERIFIED: I did not call Theo live for list_frameworks; the Theo side rests on the baseline file dated 2026-10-18 and on the snapshot.

- timestamp: 2026-10-18
  checked: can the rule tell a methodology tool from a person? Pseudonym probes through theoVerdict with no room (scratchpad trace.cjs).
  found: "Which framework did Marrowby Pell use?" block name. "What did Marrowby Pell say?" block name. "What does Fennick Harlow think about the Lean Canvas?" block name. "Which framework did Fennick Robotics use?" block content_set (the CONTENT-SET venture pattern fires first). The structure of "Problem Interview" and "Marrowby Pell" is the same: two TitleCase words, outside the allow-list, outside every exemption.
  implication: PROVEN. No structural test separates them. The only separator is a vocabulary. This is why the fix is a policy decision: the guard must be told which capitalized phrases are generic.

- timestamp: 2026-10-18
  checked: existing tests that depend on the name rule (tests/test-3692-theo-verdict.cjs PRIVATE_CORPUS, tests/test-354-egress-typed-question.cjs lineage).
  found: ran the 10 PRIVATE_CORPUS canaries through theoVerdict with no room bound. 6 of 10 are refused with class room_content / token_class name and no other layer: Blackwood expansion, Ashgrove pilot, Halcyon roadmap, "merger with Cobalt Systems", Ridgeline acquisition, Ferrow expansion. 2 more are refused by content_set (Meridian Robotics, Solstice Ventures), 1 by private_context ("confidential Northwind deal", where the name rule also fires), 1 by private_context (the cedar/juniper sentence).
  implication: PROVEN. The name rule is the only refusing layer for 6 of the 10 private canaries, with no room bound. It is the Part 8 backstop for a name the room never recorded. Removing or loosening it globally would drop that backstop. Confirms the checkpoint rule.

- timestamp: 2026-10-18
  checked: side defect, alias normalization. For every snapshot name, ask "Which tool follows <name>?" as the data spells it, then in the bare form (strip "(alias)" and keep the first side of " / ").
  found: 422 of 422 names allow as the data spells them. 26 names carry an alias (8 with parentheses, 18 with a slash). 15 of those 26 block in bare form. Examples: "Jobs to Be Done", "Minimum Viable Product", "Diffusion of Innovations", "Problem Taxonomy", "IDEO Deep Dive", "Systematic Inventive Thinking". "Which tool follows Jobs to Be Done?" blocks (name), while the control "After a Jobs to Be Done analysis" passes only through the head noun "analysis".
  implication: PROVEN. A PLAIN BUG, separate from the reported symptom: the blanking step compares the question to the full snapshot string, so a bare name never matches an entry that has an alias suffix. A flagship framework (Jobs to Be Done) cannot be asked bare. It does not fix any of the 5 reported questions.

- timestamp: 2026-10-18
  checked: capitalization blind spot and head-noun leak (pseudonyms).
  found: "what does fennick harlow think about the lean canvas?" ALLOWED (generic_question). "Which Marrowby Pell Framework fits an ill-defined problem?" ALLOWED (head noun "Framework" exempts the adjacent name). "Which framework did Marrowby Pell Interview use?" blocked.
  implication: PROVEN. Two existing under-blocks of the name rule, NOT caused by this session and NOT fixed: (a) a lowercased person name passes, so "ask it in lowercase" works for the same reason a lowercase person name leaks; (b) a person name within 2 tokens of a head noun is exempt. Any fix option that adds head nouns (option B below) enlarges (b). Record as a separate seed candidate.

- timestamp: 2026-10-18
  checked: the red test. tests/test-part8-name-class-methodology-names.cjs, synthetic fixture room, HOME isolated, fetch guard.
  found: 7 passed, 6 failed. RED: A1 no room and fixture room (5 of 5 reported questions blocked, name), A2 hook exit 2 on Q2, B1 no room and fixture room (3 of 3 aliased bare names blocked), B2 (15 bare forms blocked). GREEN: N0, C1 controls plus lowercase twin (both room states), C2 five unrecorded human-name questions block as room_content/name (both room states), C3 hook exits 2 on a human name and its stderr names the class and not the token, C4 no network.
  implication: PROVEN red. Group A and B turn green with the chosen fix. Group C must stay green after any fix (Canon Part 8 direction).

- timestamp: 2026-10-18
  checked: SECOND DEFECT, who builds the identical directive and next_gate. Source read of scripts/mindrian-brain-mcp-client.cjs (the file .mcp.json launches; bin/mindrian-brain-mcp-client.cjs is an 8-line forwarding shim to it) and lib/core/brain-client.cjs; a stubbed run of _composeTheoAsk with three different questions and three different row sets (scratchpad envelope.cjs, no network).
  found: THE PLUGIN builds it, in this repo. scripts/mindrian-brain-mcp-client.cjs:193 calls brainClient.ask(question) with no problem_type. lib/core/brain-client.cjs ask() (:1396-1410) receives Theo's reply, which has answer_mode structured_rows and rows only, no directive. It then calls _composeTheoAsk (:1170-1345). That function takes the rung from _inferRungFromQuestion (:1111-1133: a keyword table, default IllDefined, "which" and "should we" are IllDefined markers), makes ONE recommend_chain(rung, 4) call, and writes directive.guided.framework = first option, directive.guided.stage = rung, next_gate.options = the chain, grounding.problem_type_source = "heuristic". The question text enters only through that keyword table. With 3 different questions that all land on IllDefined the stub run gave identical directive and identical next_gate (3 of 3) and 3 different grounding.rows.
  implication: PROVEN. By design of quick 260910-hni and phase 339 compose, not a Theo fault. Effect: next_gate and directive restate the chain of the guessed rung, not an answer to the question. The tool description at scripts/mindrian-brain-mcp-client.cjs:189 says they are "composed from the graph-grounded rows behind the answer plus a recommended framework chain", but only the chain feeds them; rows feed grounding.rows alone. NOT fixed (per instruction). Candidate: let the caller pass problem_type (ask(question, { problem_type }) already supports it, 354-09), or derive options from the rows' frameworks, or correct the description. File as a seed.

- timestamp: 2026-10-18 (resume, option B)
  checked: BASELINE before any edit. tests/test-3692-theo-verdict.cjs, tests/test-3692-lexicon-generic-entries.cjs, tests/test-3692-guard-survey-gate.cjs, lib/core/part8-egress-guard.test.cjs, and `bash tests/run-all-3692.sh` (19 min 21 s).
  found: theo-verdict 26 PASS / 1 FAIL (V6: hook p95 1042 ms against a 400 ms limit, a latency leg on this machine); lexicon-generic-entries 10 PASS / 0 FAIL; guard-survey-gate 6 PASS / 0 FAIL (GATE: PASS, MEASURED_SHA256 d332fbc2...); part8-egress-guard.test 8 PASS / 0 FAIL; run-all-3692 PASSED=70 FAILED=2 (theo-verdict via V6, and "366 guard navigator release" via tests/test-361-theo-parity.cjs leg 3b, a PROCESS_STEP_ID regex parity mismatch between Theo and the plugin; run alone it exits 1, PASSED=7 FAILED=1).
  implication: PROVEN. Both failures exist before the edit and have nothing to do with head nouns.

- timestamp: 2026-10-18
  checked: power set of the 4 candidate nouns (interview, check, whys, technique), 16 subsets, real guard source loaded in memory with the noun added (repo file untouched), over Q2, Q5, Q7, Q8, Q11, the 5 human-name questions H1..H5 and 3 leak probes.
  found: the smallest set that allows all 5 questions is {interview, check, whys}. interview allows Q2 and Q8. check allows Q5. whys allows Q7 and Q11. technique allows only Q11, which whys already allows, so technique is not needed and was not added. H1..H5 stay blocked under all 16 subsets.
  implication: PROVEN. Three plain nouns are enough. No new rule is needed for Q7 or Q11.

- timestamp: 2026-10-18
  checked: ablation on the EDITED repo file (scratchpad ablate.cjs removes one noun in memory).
  found: without interview Q2 and Q8 block (name); without check Q5 blocks; without whys Q7 and Q11 block; full set allows all 5.
  implication: PROVEN. Each added noun is needed; each was removed, shown to re-block its question, and restored (the repo file was never changed by the ablation).

- timestamp: 2026-10-18
  checked: the leak the widening creates, pseudonym probes in memory before and after.
  found: before the three nouns all of these block (room_content, name); after, all allow: "Which framework did Marrowby Pell Interview use?", "Which question set does Fennick Harlow Check use?", "Which tool follows the Five Whys of Marrowby Pell?", "Did Marrowby Pell check the plan?", "Summarize the interview Marrowby Pell gave". "What did Marrowby Pell say?" still blocks.
  implication: PROVEN. The head-noun match is case-blind and position-blind, and check and interview are ordinary English words, so a lowercase verb also exempts the name beside it. This is the larger leak the navigator accepted with option B. Documented by test leg K1 (tag KNOWN-UNDER-BLOCK) and SEED-130.

- timestamp: 2026-10-18
  checked: AFTER the edit. Adjusted test, the 4 suites, run-all-3692 (20 min 21 s), the real hook, 11 extra Part 8 suites.
  found: adjusted test exit 0, 10 passed 0 failed 3 skipped 1 known-under-block (A1 x2 and A2 now green; B1 x2 and B2 XFAIL with "alias normalization not approved"; C1 x2, C2 x2, C3, C4 green; K1 KNOWN-UNDER-BLOCK 8 of 8 probe runs). theo-verdict 26 PASS / 1 FAIL (same V6 latency leg, p95 796 ms); lexicon-generic-entries 10/0; guard-survey-gate 6/0 with DELTA, GATE and MEASURED_SHA256 lines byte-identical to the baseline; part8-egress-guard.test 8/0; run-all-3692 PASSED=71 FAILED=2 (the same two as the baseline; the extra pass is the new leg). Real hook with HOME isolated: Q2, Q5, Q7, Q8, Q11, the lowercase twin and the 7 controls exit 0; "What did Marrowby Pell say?", the pilot question, Odalys Brennick + Problem Interview, and Marrowby Pell + Opportunity Fitness Check exit 2 with the class in stderr and no name. Extra suites (205 grill engine, 354 taxonomy ladder casing, 369.26 part8, 36925 theo ask, 361 egress shapes, 364 part8, 360 tripwire, part8 e2e smoke, 257 refusal egress kind, 260906 gr1) all exit 0. tests/test-252-guard-census.cjs exits 1 on two unclassified files (lib/core/doctor/research-providers-module.cjs, lib/lens-engine/source-lens-driver.cjs) that this change does not touch.
  implication: PROVEN. No regression against the baseline. Canon Part 8 direction holds for a two-word human name with no head noun beside it.

## Eliminated

- hypothesis: the room lexicon (bound room jhtv-oliver-kuntz) produces the block
  evidence: same verdicts with no room bound, with the real bound room (32 entries) and with a synthetic fixture room; token_class is "name", which is not a lexicon kind; the lexicon returned no hit before step 4 ran.
  timestamp: 2026-10-18

- hypothesis: the CONTENT-SET scan (scanForContent) or the identifier rule causes the block
  evidence: the verdict class is room_content/name, not content_set; _hasUnknownIdentifier returned false for all 12 questions; _safeAudit passed.
  timestamp: 2026-10-18

- hypothesis: the hook adds the block, the in-process classify would allow
  evidence: hook (exit 2) and theoVerdict/classify (block name) agree on all 13 outcomes.
  timestamp: 2026-10-18

- hypothesis: the installed beta.69 differs from the repo, so the repo reproduction is not valid
  evidence: part8-egress-guard.cjs, part8-room-lexicon.cjs, part8-egress-guard-hook.cjs and data/framework-names.json are byte-identical in the installed beta.69 copy (cmp).
  timestamp: 2026-10-18

- hypothesis: the framework-names snapshot is stale for beta.69 and a refresh fixes the 5 questions
  evidence: the snapshot (2026-10-14, beta.68 stamp) is older than beta.69, but Theo has no node for Problem Interview or Opportunity Fitness Check and only "5 Whys Technique" for the fifth (baseline file). A refresh adds none of the names. Not the cause.
  timestamp: 2026-10-18

- hypothesis: a pure spelling or normalization mismatch ("Five" versus "5") explains Q7 and Q11
  evidence: "five whys" is not a substring of any entry; the entry is "5 whys technique". Digit-to-word normalization would still not make "Five Whys" match "Five Whys Technique". The mismatch is a missing alias, not a spelling error. (A normalization bug does exist for parenthetical and slash aliases, see Evidence, but it does not touch these 5 questions.)
  timestamp: 2026-10-18

## Resolution

root_cause: lib/core/part8-egress-guard.cjs _hasUnknownProperName (called from theoVerdict step 4) flags every TitleCase word run that is not (a) a substring match of a data/framework-names.json entry, (b) hyphenated, (c) an acronym, (d) a closed-vocabulary word, or (e) within 2 tokens of a head noun or inside a run that holds a methodology word. Problem Interview, Opportunity Fitness Check, Five Whys and Five Whys Technique are outside all five exemptions because Theo does not know them (the snapshot holds "5 Whys Technique" only) and the words interview, check and whys were not head nouns. The rule cannot tell a tool from a person; it blocks what it cannot prove generic. It never inspects lowercase words, so the lowercase twin passes. Room independent.
fix: navigator option B (approved 2026-10-18 through the coordinator). METHODOLOGY_HEAD_NOUNS gained three nouns: interview (unblocks Q2 and Q8), check (unblocks Q5), whys (unblocks Q7 and Q11). technique was tested and is NOT needed (Q11 allows through whys). No option A data file, no alias normalization, no other guard, lexicon, hook, data or ontology change. Test adjusted to option B: groups A1/A2 green; B1/B2 tagged XFAIL "alias normalization not approved"; group C green; new leg K1 tagged KNOWN-UNDER-BLOCK documents the leak the widening opens (SEED-130). Test added to tests/run-all-3692.sh.
verification: adjusted test exit 0 (10 passed, 0 failed, 3 skipped, 1 known-under-block); red before the edit (8 passed, 3 failed: A1 x2, A2). Ablation: each noun removed in turn re-blocks its question. Baseline vs after: theo-verdict 26/1 -> 26/1 (V6 latency leg, pre-existing), lexicon-generic-entries 10/0 -> 10/0, guard-survey-gate 6/0 -> 6/0 (output identical), part8-egress-guard.test 8/0 -> 8/0, run-all-3692 PASSED 70 FAILED 2 -> PASSED 71 FAILED 2 (same two pre-existing failures). Real hook: 5 reported questions, lowercase twin and 7 controls exit 0; two-word human names exit 2, stderr names the class and not the token. UNVERIFIED: the real-world plugin (installed beta.69 copy) is unchanged until a release; a human has not re-asked the five questions through the live MCP tool.
files_changed:
  - lib/core/part8-egress-guard.cjs
  - tests/test-part8-name-class-methodology-names.cjs (new)
  - tests/run-all-3692.sh
  - .planning/debug/resolved/part8-egress-guard-name-class-blocks-unknown-tool-names.md (this file)
  - .planning/debug/knowledge-base.md
  - .planning/seeds/SEED-129-part8-name-rule-never-inspects-a-lowercased-person-name.md
  - .planning/seeds/SEED-130-part8-head-noun-exemption-lets-a-person-name-through-now-wider.md
  - .planning/seeds/SEED-131-brain-ask-directive-and-next-gate-identical-for-every-question.md
  - .planning/seeds/SEED-132-part8-name-rule-alias-normalization-bare-framework-names-block.md

second_defect:
  finding: built by the plugin, in this repo. lib/core/brain-client.cjs _composeTheoAsk via ask(); caller scripts/mindrian-brain-mcp-client.cjs:193 passes no problem_type; rung from _inferRungFromQuestion (default IllDefined). Theo returns rows only. Not fixed. Filed as SEED-131.
  note: .mcp.json launches scripts/mindrian-brain-mcp-client.cjs. bin/mindrian-brain-mcp-client.cjs is an 8-line forwarding shim (Phase 369.1 D-10).

seeds_filed:
  - SEED-129: a lowercased person name is never inspected by the name rule
  - SEED-130: a person name beside a head noun is exempt; the widening adds interview, check, whys
  - SEED-131: brain_ask directive and next_gate restate the guessed rung's chain, not the question
  - SEED-132: alias normalization (15 of 26 aliased names block in bare form); not approved
