---
status: resolved
kind: rca
trigger: "part8-egress-guard-room-lexicon-false-positive-blocks-theo"
issue_id: ""
severity: blocker
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8, 12]
created: 2026-10-12T13:40:00Z
updated: 2026-10-12T17:30:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 63b25583d, local dev workspace /home/jsagi/dev/MindrianOS-Plugin
- **WIRE claims probe against:** none in the investigation. The guard runs locally before any Brain call; the reproduction calls the guard module directly, never Theo.
- **Date of audit:** 2026-10-12
- **Re-verification rule:** a source claim is re-verified against `main` @ 63b25583d or later before it lands as a finding; otherwise tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED IN PART (diagnosis done, no fix applied). The room lexicon (lib/core/part8-room-lexicon.cjs makeEntry 87-119 and matchLexicon 226-246) is the rule. It keeps lexicon entries that are generic words or PWS scaffold names (core section titles such as business-model, single TitleCase words such as Design, Value, Customer minted as company entities by a fallback extractor) and refuses any question that contains one as a whole token phrase. It does NOT fire on "most of the corpus" and NOT in the two rooms named in the brief: 0 of 26 questions blocked with no room, 0 of 26 in rethinking-mindrianos, 0 of 26 in egain-des-liquid-conductor. It fires in 9 of 34 local rooms (30 of 884 evaluations, 3.4 percent; worst room 9 of 26).
test: DONE. Direct calls to classify() with brain_ask and roomDir set to scratch copies of all 34 local room.db files. No network (fetch replaced, 0 calls). Scripts and counts under .planning/debug/part8-egress-guard-room-lexicon-false-positive-blocks-theo/ (scripts, outputs; private/ holds room text and is git-ignored).
expecting: n/a (done)
next_action: RESOLVED 2026-10-12. S1 landed (261012-sbz), the survey gate rides the release suite (261012-sc0), the refusal names kind and count (261012-sph). Open elsewhere: GAP1 and GAP2 in part8-egress-guard-under-blocks-key-shape-and-spelled-money (investigating); the Segment residual pinned in the gate baseline; the fixture-name hygiene quick. Nothing pushed yet.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.66 on main (last cut beta.65)
- Reported by: navigator (Jonathan Sagir), 2026-10-12, mid-session, from a live Larry turn
- Date first observed: 2026-10-12 (the navigator's words; earlier occurrences unknown)
- Related debug sessions: part8-egress-guard-blocks-pws-brain-mcp-unconditionally (2026-08-27, status gathering; a hook-level block of every read, a different symptom); resolved/part8-egress-guard-hook-fixture-stale-after-239-02

## Problem Statement

Larry cannot ask Theo a methodology question when the question's generic words also appear in the bound room. The guard that exists to stop room content reaching the Brain is stopping the Brain from being reached at all.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: A generic methodology question (framework names, problem types, canon vocabulary, no room-specific bytes) passes the Part 8 guard and reaches brain_ask, whatever the bound room contains. Only room content is refused.
actual: The navigator's live Larry turn reported, verbatim: "The egress guard is blocking the question, probably because words like "business model" match text in the room. I'll try the framework-routing call, which sends framework names only." The methodology question was never asked; the fallback sent framework names only.
errors: the guard's refusal payload text is not captured in the report; the reason slug is unknown (to be captured by reproduction)
reproduction:
  1. Bind a venture room whose text contains "business model" (most rooms under ~/MindrianRooms do).
  2. Ask Larry a methodology question that contains the phrase, for example "which framework tests a business model's riskiest assumption first".
  3. Observe the brain_ask refusal and the fallback to a framework-name call.
  Local reproduction without a model: call the guard's classify function with the same question and the room bound; compare with no room bound.
started: unknown; the room lexicon and the guard predate this report; the navigator noticed it on 2026-10-12

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the guard runs in lib/core before every brain_* call; the hook form runs on CLI)
- Affected commands: brain_ask, brain_search, brain_query and every reach or command that asks Theo a free-form methodology question (feyminto/theo-ask, grill-engine, bono/persona-research, rs-expert-brain-projection, intel-pipeline, url-ingest call the guard)
- Affected users: every install with a bound room that contains common PWS vocabulary, which is every venture room
- Version range: unknown first-bad; present on main @ 63b25583d
- Severity: blocker (Larry's methodology path to the Brain fails in the normal case, not an edge case)
- Blast radius: every surface that depends on a free-form Theo answer; the framework-name fallback silently narrows the answer

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Most rooms and most generic questions are blocked" (the session trigger claim)
  evidence: PROVEN false as stated. 0 of 26 blocked with no room; 0 of 26 with rethinking-mindrianos bound; 0 of 26 with egain-des-liquid-conductor bound. Blocked only in 9 of 34 room copies (30 of 884 evaluations).
  timestamp: 2026-10-12T20:40:00Z
- hypothesis: The claim-coverage rule (strict majority, 3 or more content tokens) causes the false blocks
  evidence: PROVEN not the cause. Induced blocks by token_class on the 26 set: room_term 14, room_file 16, claim 0. On the 522-question extended set: room_term 273, room_file 74, claim 1 (of 16,490 evaluations). rethinking-mindrianos holds 3,440 claim entries and blocked 0 of the 26.
  timestamp: 2026-10-12T20:40:00Z
- hypothesis: The closed-vocabulary fast path (_proveTypedQuestion, guard 845-875) is broken
  evidence: PROVEN working. Questions made only of closed vocabulary (for example N3 "ill-defined and a wicked problem") return allow typed_question before the lexicon is read, even in a room whose lexicon holds an Ill-Defined entry. The gap is the questions that carry one word outside the closed lists: they fall through to the lexicon.
  timestamp: 2026-10-12T20:40:00Z
- hypothesis: CONTENT-SET scan (step 1), PRIVATE_POSSESSIVE, PRIVATE_CONFIDENTIAL, identifier rule or proper-name rule cause the 26 blocks
  evidence: PROVEN not the cause for the 26. They are room independent and the 26 pass with no room. (A separate room-independent effect exists on the extended set: 37 of 522 questions built from command descriptions are blocked with no room by the proper-name and content-set rules. That is outside this report.)
  timestamp: 2026-10-12T20:40:00Z
- hypothesis: This is the same defect as part8-egress-guard-blocks-pws-brain-mcp-unconditionally (2026-08-27)
  evidence: Different. That session records a hook block of normalize_framework_name and operate_framework calls (typed tools, ambiguous branch, F.1 card) before the lexicon existed (the lexicon landed 2026-10-05). Overlap: both are Part 8 guard false blocks of generic methodology. Not merged.
  timestamp: 2026-10-12T20:40:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-12T13:40:00Z
  checked: lib/core/part8-egress-guard.cjs structure (grep of top-level functions and constants) and its callers
  found: 1,219 lines; constants METHODOLOGY_VOCAB (line 86), FREEFORM_KEYS (110), GENERIC_HANDLE (114), QUESTION_FUNCTION_WORDS (755), METHODOLOGY_TOKEN_SET (777), COMMAND_SLUG_SET (808), CANONICAL_PHRASES (820), TOKEN_CLASSES (896), METHODOLOGY_HEAD_NOUNS (910), PRIVATE_POSSESSIVE (929), THEO_STRING_CEILING 4000 (931); functions scanForContent (125), _extractFreeFormString (230), _proveTypedQuestion (845); a sibling module lib/core/part8-room-lexicon.cjs; 9 callers in lib/core
  implication: the guard already has a methodology vocabulary allow path (_proveTypedQuestion, METHODOLOGY_TOKEN_SET, CANONICAL_PHRASES); the question is why a generic question still fails it when a room is bound

- timestamp: 2026-10-12T20:45:00Z
  checked: decision path for a free-form brain_ask with a bound room (hook scripts/part8-egress-guard-hook.cjs:259-265, belt lib/core/brain-client.cjs:449-455, gate brain-client.cjs:918 for ask/search/smartSearch, query at :735)
  found: all four entry points call the same function. In order, inside lib/core/part8-egress-guard.cjs: (1) classify:1138-1141 scanForContent over the whole payload (Canon FORBIDDEN_PATTERNS in lib/core/cross-room-aggregator.cjs:92-111) -> block content_set; (2) classify:1169-1174 hands a free-form string to theoVerdict:1041; (3) theoVerdict:1046-1048 no string -> block unknown; (4) :1051-1053 _safeAudit again -> block content_set; (5) :1056-1058 _proveTypedQuestion (closed vocabulary, 845-875) -> allow typed_question; (6) :1060-1076 room lexicon: :1066 and :1072 -> block room_check_unavailable, :1074-1075 matchLexicon hit -> block room_content with a token_class; (7) :1079-1081 length over 4000 (THEO_STRING_CEILING :931), PRIVATE_POSSESSIVE (:929) or PRIVATE_CONFIDENTIAL (:930) -> block room_content/private_context; (8) :1082-1084 _hasUnknownIdentifier (935-942) -> block room_content/identifier; (9) :1087-1089 _hasUnknownProperName (948-1024) -> block room_content/name; (10) :1092 allow generic_question.
  implication: rule (6) is the only room-dependent refusal. It is the only rule that can produce a different verdict for the same question in different rooms.

- timestamp: 2026-10-12T20:50:00Z
  checked: reproduction with classify({question}, {toolName:'brain_ask', roomDir}) over scratch COPIES of the room.db files (the real rooms were not opened; no network; fetch replaced and counted, 0 calls). Scripts: scripts/run-guard.cjs, scripts/survey-delta.cjs. Outputs: outputs/baseline-*.json, outputs/survey-baseline.json (room names replaced by R01..R34; map in private/).
  found: 26 questions (6 named + 20 derived from data/framework-names.json at stride 20 with 4 fixed templates). No room bound: 26 allow, 0 false positives (typed_question 2 or more, generic_question the rest). rethinking-mindrianos bound (3,461 lexicon entries: 3,440 claim, 19 room_file, 1 venture_name, 1 room_name): 0 false positives. egain-des-liquid-conductor bound (69 entries: 49 claim, 19 room_file, 1 room_name): 0 false positives. All 34 local room copies: 9 rooms with false positives, 30 of 884 evaluations (3.4 percent), token_class room_term 14 and room_file 16, claim 0. Per named question, rooms blocking (of 34): N1 "riskiest assumption of a business model" 9; N2 "lean canvas and value proposition canvas" 2; N3 "ill-defined and wicked" 0 (fast path); N4 "after jobs to be done" 0; N5 "explain dominant design" 2; N6 "customer segment in the lean canvas" 2. Worst rooms: 9 of 26 and 7 of 26.
  implication: the symptom is real but narrower than the trigger claims. The two rooms named in the brief do not reproduce it for these 26 questions. The navigator's live room is unknown (UNVERIFIED); the transcript of the live Larry turn is not on this machine (searched ~/.claude/projects, only the paste in this session was found).

- timestamp: 2026-10-12T20:55:00Z
  checked: which lexicon entry matched, per false positive (scripts/diag.cjs; entry text in private/ only)
  found: two feeders, both whole-token-phrase containment in matchLexicon:236. Feeder 1, kind room_file: Artifact nodes titled with a CORE_SECTIONS slug from lib/core/section-registry.cjs:15-27 (business-model, financial-model, competitive-analysis, market-analysis, solution-design, legal-ip, team-execution, opportunity-bank). These are scaffold names, present in many rooms; business-model alone blocks N1 in 8 rooms. Feeder 2, kind room_term: nodes of type company or technology whose name is one plain English word or a PWS concept pair, in rooms where the entity extractor ran with evidenceTier fallback and epistemic_type extracted_fact (type counts only: 810 of 823 entities in one room are typed company; names such as a one-word TitleCase noun survive makeEntry because only a lowercase single word is dropped, lexicon:104-107). On the extended set (522 questions) room-induced blocks are 348 of 16,490 evaluations (2.1 percent) in 13 of 34 rooms: room_term 273, room_file 74, claim 1.
  implication: makeEntry's generic filter (lexicon:98-101) tests tokens against four closed lists only: QUESTION_FUNCTION_WORDS, METHODOLOGY_TOKEN_SET, COMMAND_SLUG_SET and CANONICAL_PHRASES (guard:755, 777, 808, 820). Plain words and scaffold names are in none of them, so entries made only of such words are kept. There is no score and no threshold for names: any whole-phrase hit blocks. The only threshold is on claims: strict majority of content tokens and at least 3 (lexicon CLAIM_MIN_TOKENS 49, need = floor(n/2)+1 at :116).

- timestamp: 2026-10-12T21:00:00Z
  checked: history and recorded decisions
  found: git log -S shows one commit for the lexicon and for theoVerdict: d2e40e885, 2026-10-05, feat(369.2-01), CODE-07, J4 (ruling 2026-10-05). No later change to part8-room-lexicon.cjs. The plan (369.2-01-PLAN.md:147) and summary (369.2-01-SUMMARY.md:85) say "generic-only entries dropped"; the code drops only closed-vocabulary entries. The research file lists the risk as assumption A3 (.planning/phases/369.2-research-searches-online-for-real/369.2-RESEARCH.md:604): "an entity named customer segment would block the J4 question in that room; the fixture tests both directions, and the navigator may prefer a narrower lexicon (names only)", and open question 4 at :614. tests/test-3692-theo-verdict.cjs tests one lexicon block ("solar cold locker", V1f at :292) and no generic-word entry. The prior false block was SEED-106 item 1 (2026-10-02, generic words refused as freeform_unmatched); 369.2 closed that and introduced this one.
  implication: not WORKING-as-designed (the recorded decision says generic entries are dropped). The A3 risk was foreseen and left without a measured test.

- timestamp: 2026-10-12T21:05:00Z
  checked: what the user and Larry see (lib/core/brain-client.cjs:854-885, scripts/part8-egress-guard-hook.cjs:283, lib/core/refusal-messaging.cjs:276 and :386-394, lib/core/feyminto/theo-ask.cjs:61)
  found: the refusal names the CLASS of the matched entry, never the words. In-process text: "The question names something from this room (a term this room uses), so it was not sent to Theo. Ask it in general terms." (label for room_file: "room artifact title"). Hook text: "Canon Part 8: outbound Theo payload carries room content (room_content, room_term). Blocked." CLI refusal copy: "The Brain boundary refused that brain_ask call (class: room_content). This is a constitutional refusal, not a failure." and "Try rephrasing in generic methodology terms, or we continue without the Brain for this turn." next_moves: rephrase_generically, continue_without. The fallback is a Larry decision: handle-only reads (find_frameworks_for_problem_type, commands_for_problem_type, recommend_chain, framework_neighborhood) pass through guard arms 576-597 and never reach the lexicon; theo-ask.cjs sends handles only and records "not asked: the question named something from this room" when every read is refused. The free-form question is dropped; nothing retries it with the matched words removed.
  implication: Larry cannot tell WHICH word matched, so it guessed ("probably because words like business model"). The guess matches Feeder 1 and Feeder 2 only by accident.

- timestamp: 2026-10-12T21:10:00Z
  checked: negative corpus (10 strings, all synthetic) with no room and with each of the 34 rooms bound; two fix-shape-independent probes
  found: all 10 refused with no room and in every one of the 34 rooms. Rules: X1 person name plus revenue figure content_set (currency pattern); X2 "our startup pivoted to" room_content/private_context (PRIVATE_POSSESSIVE); X3 email content_set; X4 uppercase key shape room_content/identifier; X5 proper-noun sentence content_set (venture proper-noun pattern); X6 artifact id room_content/identifier; X7 confidential sentence room_content/private_context; X8 money figure ($750K) content_set; X9 date plus company name content_set (venture proper-noun pattern); X10 possessive private phrase room_content/private_context. None of the 10 is refused by the lexicon, so the lexicon is not what protects them. Two first-draft negatives were ALLOWED by the current guard with or without a room: GAP1 a vendor-prefixed mixed-case API key, GAP2 a spelled-out money figure ("750000 dollars"). I replaced them in the 10 with variants the guard refuses and kept GAP1 and GAP2 as separate probes.
  implication: the lexicon is the only layer for room-specific content with no pattern shape (a person name, a venture name, a claim), so the fix shapes are scored on lexicon retention as well (next entry). GAP1 and GAP2 are a different defect, not caused by or fixed by this work.

- timestamp: 2026-10-12T21:20:00Z
  checked: four scratch prototypes of lexicon patches (scripts/build-protos.cjs; copies live under the session scratch folder, the real files were not touched). Retention probe: for every lexicon entry the baseline protects (9,135 entries over 34 rooms: claim 6,884, room_term 1,252, room_file 937, room_name 31, venture_name 20, person 11), ask "which framework fits <entry text>" and count entries the shape no longer refuses (scripts/retention.cjs).
  found: baseline 26-set 30/884, extended 348/16,490, lost 0. S1: 6/884, 50/16,490, lost 205 (room_file 71, room_term 134; claim, person, venture_name, room_name 0). S2: 0/884, 1/16,490, lost 752 (room_file 157, room_term 595). S3: 1/884, 10/16,490, lost 938 (room_file 83, room_term 855). S4: 15/884, 281/16,490, lost 53 (room_file 47, room_term 6). All four keep 10 of 10 negatives refused in all 34 rooms and with no room. A 25-entry sample of what S1 drops is all plain words, PWS terms or plugin names (checked by hand, private/); S3 drops a one-word institution name and S2 drops plugin and persona names, which is the Part 8 cost of those two shapes.
  implication: S1 removes 80 percent of the 26-set false positives and 86 percent of the extended ones at a cost of 205 generic-looking entries; S4 is the smallest change and the safest but leaves most of Feeder 2.

- timestamp: 2026-10-12T21:25:00Z
  checked: field telemetry (hook memory_event nodes with source_path part8:egress-guard in the egain copy)
  found: between 2026-10-05 and 2026-10-06 the room recorded 327 block/room_content, 565 allow/generic_question, 152 allow/typed_question (31 percent of free-form Theo verdicts blocked as room_content). The record keeps no token_class and no question text, and the burst matches test and evaluation runs, not a live user day. No events after 2026-10-08.
  implication: UNVERIFIED context only. It shows room_content blocks are common in a real room, but it cannot separate true from false positives.

## Technical Root Cause

Rule: the room lexicon, in lib/core/part8-room-lexicon.cjs. makeEntry (lines 87-119) decides which room names enter the lexicon. Its generic-entry filter (98-101) drops an entry only when every token is in four closed lists (function words, methodology tokens, command slugs, canonical framework phrases). It does not know plain English words, PWS scaffold names (the 11 CORE_SECTIONS titles in lib/core/section-registry.cjs:15-27) or extractor noise. Entries of kind room_file (Artifact titles) and room_term (company, technology, market, product, organization, entity names) built from such words are kept. matchLexicon (226-246, phrase test at :236) then refuses a question that contains any kept entry as a whole token phrase, with no rarity test and no length test for names. theoVerdict (guard:1074-1075) turns that hit into block room_content with token_class room_term or room_file. The closed-vocabulary fast path (guard:1056) protects only questions made entirely of closed vocabulary, so one extra plain word sends the question to the lexicon.

Why only some rooms: the entry must exist. 9 of 34 local rooms hold such an entry (an Artifact titled with a section slug, or a one-word generic entity). The two rooms named in the brief hold none that hit the 26 questions, so the bug does not show there.

Introduced: commit d2e40e885, 2026-10-05, Phase 369.2 Plan 01 (CODE-07, J4). Recorded risk: 369.2-RESEARCH.md:604 (A3). The plan text says generic-only entries are dropped; the code drops only the closed lists. Tests do not cover a generic-word entry.

What the user sees: only the class of the match ("a term this room uses" or "room artifact title"), so the matched words are never shown. Larry falls back to handle-only calls, which drops the question.

Classification: NEW FAILURE. It is not WORKING-as-designed (the recorded design says generic entries are dropped), and no tracked slug covers it (the 2026-08-27 session is a different, earlier symptom). It belongs to the SEED-106 item 1 family (generic methodology refused by the guard).

Measured size: 26-question set, 30 of 884 evaluations (3.4 percent) in 9 of 34 rooms, 0 with no room bound, 0 in the two named rooms. Extended set of 522 questions: 348 of 16,490 (2.1 percent), 13 of 34 rooms.

## Required Code Changes

DECIDED by the navigator 2026-10-12 (three answers on one card):
1. Shape S1: subtract methodology vocabulary at lexicon build. One /gsd-quick, runs right after 261012-rey, ahead of the search-sweep quicks. Tests 1 to 4 below ship with it. The fixture room.db is SYNTHETIC (built by the test), never a copy of a real room.
2. The survey harness (34 rooms x 522 questions, retention probe, 10 negatives) becomes a release gate in a second /gsd-quick, with SYNTHETIC fixture rooms generated by a script (no scrubbed real room.db in the repo: the no-real-names rule and Part 8 both forbid it) and a hard leg in the release gate suite (the same pattern 261012-rey uses for the adapter budget). It fails the cut if induced false positives on the 26 set exceed 0 or any negative passes.
3. Companion A (the refusal names the matched entry KIND and token count, never the word; test V5 stays true) is its own quick after the gate. Companion B (GAP1 vendor-prefixed API key and GAP2 spelled-out money figure pass the guard) is opened as its own debug session: part8-egress-guard-under-blocks-key-shape-and-spelled-money.

Shapes as filed before the decision; the navigator picked S1; the fix runs through /gsd-quick. All shapes touch only the lexicon build (makeEntry) for kinds room_term and room_file. Claim, person, venture_name and room_name entries stay untouched in every shape (retention 100 percent in all four, measured). All four keep the 10 negatives refused (10 of 10, no room and 34 rooms).

S1. Subtract generic methodology vocabulary at build time. Drop a room_term or room_file entry when every token is in the union of tokens of CANONICAL_PHRASES, COMMAND_SLUG_SET, METHODOLOGY_TOKEN_SET, QUESTION_FUNCTION_WORDS and the CORE_SECTIONS slugs and labels. Files: lib/core/part8-room-lexicon.cjs (makeEntry, plus a lazily built token set; the guard exports the sets already; section-registry.cjs is already a pure module). Effect: 26-set 30 to 6 of 884; extended 348 to 50 of 16,490; 205 of 9,135 protected entries no longer protected (room_file 71, room_term 134), sample all plain words, PWS terms or plugin names. Part 8 risk: low to medium. A real company whose whole name is made of methodology words ("Design Matrix") would stop being protected as a room term; venture_name from ROOM.md and the content rules still cover the room's own name. Recommended.

S2. S1 plus repo prose vocabulary. Add every word of commands/*.md and docs/MINDRIAN-CANON.md to the generic set (ship it as a generated data file, not a runtime scan). Files: lib/core/part8-room-lexicon.cjs, a new generated data file, its build script. Effect: 26-set 0 of 884; extended 1 of 16,490; 752 protected entries dropped (room_file 157, room_term 595), including plugin and persona names. Part 8 risk: medium. The word list decides what counts as room-specific, so a venture named with a common word loses protection, and the list must be refreshed with the plugin.

S3. Minimum length for names. Require room_term and room_file entries to have 3 or more tokens (or a digit or underscore). Files: lib/core/part8-room-lexicon.cjs. Effect: 26-set 1 of 884; extended 10 of 16,490; 938 protected entries dropped (room_file 83, room_term 855), including one-word institution names found in the sample. Part 8 risk: high. Most real company and technology names have 1 or 2 tokens, so this removes the protection the lexicon exists to give. Not recommended; listed because it is the "n-gram" candidate and it is now measured.

S4. Narrow scaffold list. Drop room_file and room_term entries whose token string equals a CORE_SECTIONS slug or label. Files: lib/core/part8-room-lexicon.cjs only. Effect: 26-set 30 to 15 of 884; extended 348 to 281 of 16,490; 53 protected entries dropped (room_file 47, room_term 6). Fixes Feeder 1 (scaffold titles) and none of Feeder 2. Part 8 risk: lowest. Good as a first step or as the unit-test fixture list for S1.

Companion (any shape, optional, needs a navigator decision on the no-echo rule): let the refusal say which entry KIND matched and how many tokens it has, so Larry can reword; the current tests (test-3692 V5) forbid echoing the matched term, so the change stays within "class, never the token" and does not egress anything (the guard and Larry are both local).

Separate defect, not part of this fix: GAP1 and GAP2 in the Evidence section (vendor-prefixed mixed-case API key and spelled-out money figure) pass the current guard with or without a room. Open its own /gsd-debug session if the navigator agrees.

## Tests to Add or Update

1. New test, suggested name tests/test-3692-lexicon-generic-entries.cjs, added to tests/run-all-3692.sh next to the existing test-3692-theo-verdict line (:85). Build a fixture room.db with: Artifact nodes titled with each CORE_SECTIONS slug; company and technology entities named by single plain words and by PWS concept pairs. Bind it. Assert the 6 named questions and the 20 derived questions (generate them from scripts/corpus.cjs in this session folder, or copy the generator) all return allow. Assert the same 26 allow with no room bound.
2. Retention test in the same file: with the same room bound, a person full name, a two-word company name, a venture_name, a claim sentence and a one-word institution name each still return block room_content with the right token_class (the shape S1 must keep all of these; if the one-word institution name is built from methodology words it is the documented exception).
3. Negative corpus test: the 10 strings in scripts/corpus.cjs (NEGATIVES) with the fixture room bound and with none; all 10 block, and the class per string matches the table in the Evidence section (X1, X3, X5, X8, X9 content_set; X2, X7, X10 private_context; X4, X6 identifier). This protects Part 8 against any later lexicon change.
4. Update tests/test-3692-theo-verdict.cjs V1f only if the chosen shape changes the fixture term "solar cold locker" (it is 3 plain words; under S1 it must still block, so assert that explicitly).
5. Extend the Evidence-section measurement into a repeatable check: a script that runs scripts/survey-delta.cjs against a fixture directory of scrubbed room.db files and fails if induced false positives on the 26 set exceed 0.

## Non-Code Follow-ups

- Canon Part 8 stays absolute: any fix must still refuse real room content (names, numbers, artifact ids, possessive private phrases). The fix must be shown against a negative corpus as well as the positive one.
- CHANGELOG.md Fixed entry; release lockstep if it ships.
- knowledge-base.md block on resolve.
- Fixture hygiene follow-up (found 2026-10-12 while building the gate corpus, not fixed here): 10 pre-existing tracked test files from Phase 369.2 (tests/test-3692-*.cjs, tests/fixtures/release-room-seed118/*.json, lib/core/part8-egress-guard.test.cjs, lib/core/cross-room-aggregator.cjs) use "Harbor Freight Partners" and "Nimbus Robotics" as synthetic venture names; Harbor Freight is a real company. The new corpus and the new tests use invented names (Fennick Robotics, Harbor Quill Partners). Open a small quick to rename the 25 occurrences; the debug corpus.cjs under this session's scripts/ carries the same two names and must be scrubbed before that folder is committed.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: lib/core/part8-room-lexicon.cjs makeEntry (87-119) keeps room_file and room_term entries built from plain words and PWS scaffold names (its generic filter knows only four closed lists), and matchLexicon (226-246, phrase test :236) refuses any question containing one as a whole token phrase, with no rarity test. Introduced by d2e40e885 (369.2-01, 2026-10-05); risk recorded as A3 in 369.2-RESEARCH.md:604. 30 of 884 evaluations (3.4 percent) over 34 local rooms, 9 rooms affected, 0 with no room and 0 in the two rooms named in the brief.
fix: S1 landed (quick 261012-sbz, 2026-10-12). lib/core/part8-room-lexicon.cjs makeEntry drops a room_term or room_file entry when every token is in the union of CANONICAL_PHRASES, COMMAND_SLUG_SET, METHODOLOGY_TOKEN_SET, QUESTION_FUNCTION_WORDS and the CORE_SECTIONS slugs and labels (lazy _genericTokenSet, exported as a test seam; fails closed as room_check_unavailable). matchLexicon, the guard, brain-client, refusal-messaging and the hook are byte-unchanged. Pending in this session's scope: the survey gate (quick 261012-sc0) and companion A, the refusal that names kind and count (quick 261012-sph).
verification: tests/test-3692-lexicon-generic-entries.cjs RED 5 pass 4 fail -> GREEN 9 pass 0 fail (synthetic fixture: 26 positives 11 blocked -> 0; 10 negatives blocked with the expected classes with and without a room; retention set blocks per kind; V1f "solar cold locker" still blocks); tests/test-3692-theo-verdict.cjs green; lib/core/part8-egress-guard.test.cjs green; the CLI hook agrees with classify (N1 and N5 exit 0, the person question and X2 exit 2); run-all-3692 70 -> 71 passed, 0 failed; survey on the 34 scratch room copies: 26-set 30 -> 6 of 884 (9 rooms -> 1), extended 348 -> 50 of 16,490, 0 negative leaks, retention lost 205 of 9,135 (room_file 71, room_term 134; claim, person, venture_name, room_name 0). Each re-run by the orchestrator except the survey.
files_changed:
  - lib/core/part8-room-lexicon.cjs (S1 rule in makeEntry, _genericTokenSet)
  - tests/test-3692-lexicon-generic-entries.cjs (new, 9 legs), tests/run-all-3692.sh (1 leg)
  - CHANGELOG.md (1 Fixed bullet)
commits: S1 3fea3e954, c8e59445d, docs 9bbf24a7b; gate da09144cf, 46a87b29c, 102813ce6, ff9497912, docs 3677f2a9e; refusal d2fbe07e4, c0b947538, 8e3d55455, docs 990ad8d46; none pushed
known_residual: an entity named Segment or Customer Segment still blocks a customer-segment question (6 of 884 remain, 1 room); pinned by exact pair in the gate baseline (261012-sc0), so any second residual fails the cut
