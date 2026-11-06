---
status: investigating
kind: rca
trigger: "part8-over-blocks-ordinary-theo-and-context-questions"
issue_id: "E-OVER"
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T11:00:00Z
updated: 2026-11-06T16:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 8c1af79b1 (working tree of /home/jsagi/dev/MindrianOS-Plugin-release, plugin 2.0.0-beta.80), after plans 386-25, 386-28, 386-30, 386-31, 386-37 and 386-39.
- **WIRE claims probe against:** none. No Brain call, no network. `globalThis.fetch` is a thrower with a counter (0 calls). Throwaway HOME. Synthetic rooms built at run time.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run in this session), UNVERIFIED or ASSUMED. Source: EGRESS-CLAIMS-CHECK.md claim e (CONFIRMED) and section F of AUDITOR-FINDINGS-source.md (auditor hypotheses).

## Current Focus

hypothesis: ordinary Theo and context questions are blocked by 3 causes: (1) the capital-letter name rule, (2) ordinary business words on the default-deny list, (3) the my or our rule and a sticky unreadable-database result.
test: classify() on synthetic strings with no room bound, a per-pattern count over the corpora, a fixture room with an unreadable room.db, and the shape helper of plan 386-37 over the blocked questions, the negatives and the audit probe set.
expecting: the name rule is the main over-block on the corpus; the deny list over-blocks ordinary words that the corpora hardly contain; the unreadable database is cached.
next_action: owner decision recorded 2026-11-06 (decision: option-e, context-based decomposition; see the Owner decision block). The owner must now acknowledge the residual exposure (Task 3 of plan 386-32). Plans 386-33 and 386-40 read the Owner acknowledgement block.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: auditor egress message (hypothesis), claim e of EGRESS-CLAIMS-CHECK.md
- Date first observed: 2026-11-05
- Related debug sessions: part8-no-shape-test-for-sprouts-and-bodies (plan 386-37), part8-egress-guard-under-blocks-key-shape-and-spelled-money (plan 386-31), part8-egress-guard-name-class-blocks-unknown-tool-names (resolved)

## Problem Statement

The guard blocks ordinary methodology questions that name an author, a month, a place, a company or one of the plugin's own nouns, or that use a business word such as runway. A bound room whose room.db cannot be read blocks every free-form question, and the failure stays cached after the file is readable again. The owner principle of 2026-11-06 says a short keyword query may leave the room, and the guard must not cripple contextualised work.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: an ordinary short keyword question passes; a credential, an email address or a room term still blocks.
actual: 6 of 6 capital-letter questions block while their lower-case twins pass; 12 of 12 ordinary deny-list questions block; 36 of 535 extended questions block by the name rule and 1 by a deny pattern; an unreadable room.db blocks every question, including a 3-word one, and keeps blocking after the file mode is restored.
errors: none. The blocks are class room_content (token class name) and content_set, or room_check_unavailable.
reproduction:
  1. Scratch scripts (not committed): /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/m32.cjs and m32b.cjs.
  2. classify({question}, {toolName: 'brain_ask', roomDir: null}) on the strings below.
  3. Fixture room from tests/helpers/synthetic-room-db.cjs (gate-empty), chmod 000 on room.db, restore the mode (mtime and size unchanged), call again without `_resetLexiconCache()`.
started: the name rule and the deny list date from Phase 369.2 (theoVerdict) and Phase 196 (FORBIDDEN_PATTERNS).

## Scope and Impact

- Affected surfaces: cli (hook and belt), desktop and cowork (belt).
- Affected commands: every free-form Theo or Brain question (brain_ask, brain_query, brain_search, search).
- Severity: medium (ordinary work fails; no leak).
- Blast radius of a change in the shared deny list (FORBIDDEN_PATTERNS): about 45 modules (list below). A change in theoVerdict reaches only the Brain free-form line.

## Eliminated

- hypothesis: "my or our questions block almost every free-form question". NOT CONFIRMED as stated. PRIVATE_POSSESSIVE needs my or our, at most one word, then one of 11 venture nouns (startup, company, venture, product, customers, users, pivot, team, investors, revenue, pricing). PROVEN: "my team missed the launch" blocks; "how do I use my notes with the lean canvas" and "what does our method guide say about premortems" allow. The rule over-blocks method questions that use a venture noun, not all my or our questions.
- The 26 frozen positives are not blocked by any of the 3 causes (0 of 26 blocked with no room).

## Evidence

### Cause 1: the name rule (`_hasUnknownProperName`, theoVerdict step 4)

Pairs, roomDir null, brain_ask (verdict class, token class):

| Capital-letter form | Verdict | Lower-case twin |
|---|---|---|
| What did Christensen say about disruption | block room_content/name | allow generic_question |
| Ask Larry about the Data Room | block room_content/name | allow generic_question |
| how does the plan change after a review in March | block room_content/name | allow generic_question |
| how do startups in Berlin pick a framework | block room_content/name | allow generic_question |
| how did Shopify choose a pricing framework | block room_content/name | allow generic_question |
| how should Thessaly Gripper design a test | block room_content/name | allow generic_question |

What each exempt list holds today (read from lib/core/part8-egress-guard.cjs): QUESTION_FUNCTION_WORDS (question grammar words); METHODOLOGY_TOKEN_SET (framework, chain, swot, porter and similar methodology words); COMMAND_SLUG_SET (the slugs of data/command-registry.json); CANONICAL_PHRASES (every framework name of data/framework-names.json, blanked as a whole phrase in lower case); CYPHER_KEYWORDS; METHODOLOGY_TECHNIQUE_WORDS (premortem); METHODOLOGY_HEAD_NOUNS (framework, method, model, principle, pyramid, matrix, analysis, canvas, theory and their plurals: 13 words); TITLECASE_TOOL_HEAD_NOUNS (interview, check, whys). No list holds a month, a weekday, a plugin noun (Larry, Brain, Data Room, MindrianOS), a place or an author.

Tests that cover the rule: tests/test-part8-name-class-methodology-names.cjs (16 passed, 3 skipped, 1 known under-block, run in this session) and tests/test-3692-lexicon-generic-entries.cjs (8 passed, 1 failed: arm L6, X4 expects class room_content/identifier and now gets content_set after plan 386-31; the key id still blocks; a stale expectation, not a leak; not touched here).

On the corpora (no room): 36 of 535 extended questions are blocked by the name rule (class room_content, token class name), 0 of 26 positives. 1 more extended question (C32) is blocked by a deny pattern.

### Cause 2: ordinary business words on the default-deny list (FORBIDDEN_PATTERNS, theoVerdict step 1)

Ordinary methodology questions, roomDir null, brain_ask. All 12 block as content_set:

| Word or form | Synthetic ordinary question | Verdict |
|---|---|---|
| runway | what is a runway in the lean startup method | block content_set |
| ARR | what does ARR measure in a SaaS metrics framework | block content_set |
| standup | how long should a standup meeting run in scrum | block content_set |
| meeting with | how should I structure a meeting with stakeholders | block content_set |
| N percent | what does 80 percent of effects from 20 percent of causes mean in the pareto principle | block content_set |
| city gazetteer | how did Tel Aviv become a hub in innovation studies | block content_set |
| Series A | what is a Series A in venture funding terms | block content_set |
| burn rate | how do you read a burn rate chart | block content_set |
| 3x growth | what makes 3x growth hard to sustain | block content_set |
| dollar magnitude | what does a $5 price mean in unit economics | block content_set |
| venture noun (Corp) | what is the Acme Corp case in strategy teaching | block content_set |
| bare magnitude | how is 2M users different from 20K users in a market model | block content_set |

Per-pattern hits on the corpora (no room; the 26 positives, the 535 extended questions, the 10 negatives; ids only):

- email: 0, 0, 1 (X3)
- dollar magnitude: 0, 0, 2 (X1, X8)
- quoted-person, meeting with, SSN-like, phone-like, name plus degree, percent, financial idiom, active users, name plus comma plus degree, city gazetteer: 0, 0, 0
- bare magnitude: 0, 0, 2 (X1, X8)
- meeting or verbatim marker (standup, meeting transcript, board notes ...): 0, 1 (C32), 0
- venture proper noun suffix (Corp, Inc, Ltd, Robotics ...): 0, 0, 2 (X5, X9)
- 12 credential shapes (plan 386-31): 0, 0, 1 (X4)

Reading: the corpora hold almost no ordinary business words, so they cannot show this over-block. The measure is the 12 synthetic questions above, not the corpora. Any narrowing must be measured on both.

Consumers of FORBIDDEN_PATTERNS, auditQueryString and auditQueryObject (grep of lib, scripts, bin; the test column names a test that mentions the module, not a proof that it asserts the rule):

- Brain line: lib/core/part8-egress-guard.cjs (tests/test-3692-theo-verdict.cjs, tests/test-3692-guard-survey-gate.cjs), lib/hmi/brain-review-packet.cjs (tests/test-148-brain-review-egress.cjs).
- Shared definition and re-export: lib/core/cross-room-aggregator.cjs (lib/memory/cross-room-aggregator.test.cjs), lib/core/rs-egress-prompts.cjs (tests/test-148-brain-review-egress.cjs, tests/test-361-lane-queries.cjs), lib/core/rs-egress-violations.cjs.
- Research stack (structured bundles through auditQueryObject): rs-query-matrix, rs-query-to-text, rs-domain-analyzer, rs-fetcher-experts, rs-chain-feeder, rs-commercial-assessor, rs-breakthrough-scorer, rs-neo4j-writer, rs-sqlite-mirror, rs-nl-to-query, rs-mind-map, rs-thesis-generator, rs-expert-mapper, rs-innovation-classifier, rs-differential-scorer, rs-preprocessor, rs-brain-substrate, rs-brain-substrate-prompts, rs-pinecone-bridge (tests: lib/memory/test-rs-*.cjs and tests/test-355-*).
- Other: bono/cell-fanout, bono/persona-research, bridge-writer, domain-insight-sweep, dominant-design/lane-queries, eureka-critic, pinecone-inference, recovery/controller, research-corpus, research-planner/families, security/agentshield-scanner, semantic-index/online-pattern-query, shallow-doc-parser, hmi/cross-room-memory, hmi/dial-label-composer, mcp/tools/rs-experts-find (no test names it), mcp/tools/rs-thesis-read (no test names it), memory/validators/brain-md-invariants, memory/validators/brain-substrate-invariants, scripts/rs-discovery-engine, scripts/rs-experts-command, scripts/rs-thesis-command, scripts/scout-cadence-runner.

Design consequence: a narrowing written into the shared FORBIDDEN_PATTERNS loosens all of these. The sprout bypass and the shape-bound narrowing belong in `theoVerdict` (the Brain free-form line) so the research-stack consumers keep the full list.

### Cause 3: my or our, and the room database

- "my team missed the launch": block room_content/private_context. "which framework fits my customers and my pricing" (X10): block room_content/private_context. PROVEN.
- Fixture room gate-empty, room.db chmod 000 (process is not root, uid 1000): every free-form question blocks as room_check_unavailable, including "lean canvas pricing" (3 words). PROVEN.
- After restoring the mode (mtime and size unchanged, so the cache key `mtimeMs:size` is equal), the next call without `_resetLexiconCache()` still returns block room_check_unavailable. After `_resetLexiconCache()` it returns allow generic_question. PROVEN: the failure is cached in `_cache` of lib/core/part8-room-lexicon.cjs (`loadRoomLexicon` stores `{ ok: false }`) until the db, wal or ROOM.md stat changes.

### The shape of the blocked questions (plan 386-37 helper, thresholds: sprout up to 12 words, 1 sentence, no newline, no quote, no first-person statement)

negatives_sprout_count: 6
negatives_sprout_ids: X3,X4,X6,X7,X8,X10
negatives_sprout_always_block_ids: X3,X4,X6

The 10 negatives (id, shape, words, verdict today, synthetic string; the AWS-style key id is masked):

- X1 edge 13, block content_set: "Orla Venn said her company reached $4.2M revenue last quarter, which framework fits?"
- X2 edge 12, block room_content/private_context: "our startup pivoted to selling to hospitals, which framework fits that move"
- X3 sprout 7, block content_set: "which framework should orla.venn@fennickrobotics.example use for pricing" (an email address: always blocks)
- X4 sprout 6, block content_set: "explain the lean canvas <aws-style key id> framework" (a credential shape: always blocks)
- X5 edge 16, block content_set: "Fennick Robotics plans to sell the Thessaly gripper to Harbor Quill Partners after the Tuesday pilot"
- X6 sprout 10, block room_content/identifier: "what framework applies to artifact MOS2026X7 in the pricing section" (an artifact-style identifier: always blocks)
- X7 sprout 9, block room_content/private_context: "this is confidential: which framework tests the riskiest assumption" (would leave)
- X8 sprout 8, block content_set: "which framework helps when the budget is $750K" (a money figure; would leave)
- X9 edge 14, block content_set: "on 14 March 2026 Fennick Robotics Ltd signed the term sheet, which framework fits"
- X10 sprout 8, block room_content/private_context: "which framework fits my customers and my pricing" (would leave)

Under the plain sprout rule alone X7, X8 and X10 would leave the room. Under option-e (the split route of plan 386-42) X7 and X10 hold a private-claim marker (a private word, a my or our possessive), so they are answered with sprouts_required: their claim stays local and only a generic sprout leaves. X8 holds no marker (a money figure in a short question), so it still leaves as written.

negatives_sprout_split_ids: X7,X10
residual_plain_sprout_ids: X8

residual_unreadable_db_lexicon: yes

Measured on a fixture room (gate-scaffold, uid 1000, so chmod 000 applies): with room.db readable, a sprout that holds a room term (kind room_file, 3 words) is blocked as room_content/room_file; with room.db unreadable, today the same sprout and a sprout with no room term are both blocked as room_check_unavailable (no question passes). Under the target design (table row R6) a sprout with no hit from the rules that need no database becomes allow with class room_check_skipped, so the sprout with the room term leaves the room as written, because the lexicon cannot be read. That is a new exposure created by the fix, and the owner must acknowledge it. Edges and bodies in that state get sprouts_required, not allow.

The 37 extended questions that are blocked with no room bound (36 by the name rule, 1 by content_set): 29 are sprouts at 12 words and 8 are edges (C18, C21, C31, C42, C44, C64, C68, C91).

- Sprouts (29): C1, C2, C9, C12, C15, C25, C26, C27, C30, C32, C40, C48, C52, C54, C58, C59, C63, C65, C70, C76, C79, C80, C81, C82, C84, C86, C89, C95, C97. Each is a plugin or methodology how-to question (for example "how do I export a Data Room view to De Stijl HTML", "how do I run Mullins 7-Domains on a business opportunity", "how do I rotate through De Bono's Six Thinking Hats").
- Edges (8): C18 (15 words), C21 (15), C31 (14), C42 (14), C44 (27), C64 (14), C68 (24), C91 (15).
- sprout_max_words 12 versus 15: at 12 words 29 of the 37 are sprouts and 8 are edges. At 15 words 35 are sprouts and 2 are edges (C44 and C68 stay edges). Raising to 15 frees 6 product questions and also turns 4 more audit-probe private claims into sprouts (C:plurai:17, C:plurai:23, C:plurai:28, C:354-private:0) and 2 more negatives (X1 and X9: a person with a revenue figure, and a company that signed a term sheet) that would then leave. The 26 positives reach exactly 12 words, so 12 is the lowest limit that keeps them sprouts (plan 386-37). Measured recommendation: keep 12.
- What blocks the 8 edges (remove one token at a time, token flips the verdict to allow): C18 "Dial", C21 "Live", C31 "Timeline", C42 "Brain", C44 "Larry", C68 "Data"; C64 (F.1 Decision Gate) and C91 (MindrianOS plus Claude Code) need 2 tokens. All are the plugin's own public nouns. PROVEN for the single-token flips; the full pass after a vocabulary exemption is UNVERIFIED until plan 386-33 builds it.

### Probe set (tests/fixtures/386-audit-probes, groups 354-private and violation, no room bound)

Rows whose baseline-before verdict is block, whose text is a sprout by classifyShape and holds no credential shape, email address, phone-like number, SSN-like number or identifier: 16 (9 of 354-private, 7 of violation). 2 violation rows hold an email address and always block (C:plurai:19, C:plurai:27). C:354-private:0 is an edge (14 words). Today all 16 block, by content_set (deny words and venture nouns), room_content/name or room_content/private_context.

probe_private_sprout_count: 16
probe_private_sprout_ids: C:plurai:22,C:plurai:24,C:plurai:25,C:plurai:26,C:plurai:29,C:plurai:31,C:plurai:32,C:354-private:1,C:354-private:2,C:354-private:3,C:354-private:4,C:354-private:5,C:354-private:6,C:354-private:7,C:354-private:8,C:354-private:9

Each (key, synthetic string, verdict today):

- C:plurai:22 "Our burn rate is 140K per month against 900K runway, which framework?" block content_set
- C:plurai:24 "The Beersheba pilot logged 62 percent churn last sprint, recommend a move." block content_set
- C:plurai:25 "The investor emailed: we pass unless you show 3x growth, what next?" block content_set
- C:plurai:26 "The Ramat Gan fintech has 12000 active users, which methodology?" block content_set
- C:plurai:29 "Board notes: the CFO resigned Tuesday, recommend a stabilization framework." block content_set
- C:plurai:31 "Analyze the go-to-market for Nimbus Robotics at phase 2." block content_set
- C:plurai:32 "What move fits our team 3-day sprint on the Tel Aviv contract?" block content_set
- C:354-private:1 "Apply first-principles thinking to my acquisition of Meridian Robotics before March." block content_set
- C:354-private:2 "Which framework fits our secret merger with Solstice Ventures?" block content_set
- C:354-private:3 "Recommend a methodology for the Blackwood expansion our board approved yesterday." block room_content/name
- C:354-private:4 "Use Porter's five forces on our confidential Northwind deal." block room_content/private_context
- C:354-private:5 "What chain of frameworks should I use for our Ashgrove pilot launch?" block room_content/name
- C:354-private:6 "Apply design-thinking to my proprietary Halcyon roadmap for next quarter." block room_content/name
- C:354-private:7 "Use the value-chain framework to analyze our merger with Cobalt Systems." block room_content/name
- C:354-private:8 "Recommend a technique for our undisclosed Ridgeline acquisition next spring." block room_content/name
- C:354-private:9 "Which methodology should I use for our secret Ferrow expansion plan?" block room_content/name

Marker split of the 16 (a plain regex on my, our, we, I and the private words confidential, secret, proprietary, undisclosed, private; plan 386-33 fixes the exact marker set): 12 hold a marker and would be answered with sprouts_required (C:plurai:22, C:plurai:25, C:plurai:32 and C:354-private:1 to 9); 4 hold no marker and would leave as written (C:plurai:24, C:plurai:26, C:plurai:29, C:plurai:31). The owner is shown all 16 because the marker set is not final until plan 386-33.

probe_private_sprout_plain_ids: C:plurai:24,C:plurai:26,C:plurai:29,C:plurai:31

Plan 386-40 requires that every private-claim sprout that leaves the room after plan 386-33 is one of these keys.

### Corpus gate and protective counter-examples (today, no room; all block)

- R1 email in a sprout (X3, 7 words): block content_set
- R1 credential shape in a sprout (X4, 6 words): block content_set
- R1 identifier in a sprout (X6, 10 words): block room_content/identifier
- R1 room term in a sprout (fixture room gate-scaffold, 6 words, entry kind room_file): block room_content/room_file. The gate retention counts (claim 7 of 7, person 1 of 1, room_file 1 of 1, room_name 6 of 6, room_term 41 of 41, venture_name 1 of 1) show the lexicon refuses its own entries.
- R2 two unknown names in an edge (17 words): block room_content/name
- R3 figures and idioms in an edge (21 words, burn rate with 140K and a 900K runway): block content_set
- R4 first-person statement in an edge (X2, 12 words): block room_content/private_context
- R4 first-person statement in a body (36 words): block room_content/private_context
- R5 edge with an unreadable room.db: block room_check_unavailable

## Technical Root Cause

- Cause 1: `_hasUnknownProperName` treats every TitleCase word that is not sentence-initial and not in the exempt lists as a person or venture name. It has no calendar words, no plugin nouns and no shape test, so authors, months, places, companies and the plugin's own nouns block while their lower-case twin passes. The rule decides by spelling, not by what the string is.
- Cause 2: theoVerdict step 1 runs the shared FORBIDDEN_PATTERNS (written for structured room bundles) on every free-form question. Words such as runway, ARR, standup, percent and 8 city names are ordinary in a methodology question, and each blocks with no figure or private claim near it.
- Cause 3: PRIVATE_POSSESSIVE matches a venture noun after my or our whether the string is a question or a statement; and `loadRoomLexicon` caches `{ ok: false }` under a stat key that a chmod does not change, so one failed read blocks every question until a file changes.
- Why it surfaces now: the owner principle of 2026-11-06 says shape, not a word list, separates a sprout from a body. Plan 386-37 now measures shape.

## Required Code Changes

<!-- Only after the owner decision. None in this plan. Option-e target design (owner principle and owner direction of 2026-11-06). -->

All rows are prose only. Plan 386-33 builds the rows with needed_by_route yes. None deletes a pattern; each narrows one or routes it to the split outcome. The sprout/body shape test is classifyShape of lib/core/part8-sprout-shape.cjs (sprout up to 12 words, one sentence, no newline, no quote, no first-person statement). The sprout bypass and the narrowing live in `theoVerdict` (the Brain free-form line), never in the shared FORBIDDEN_PATTERNS, so the research-stack consumers keep the full list.

| id | current rule | measured effect on the corpora | narrowed rule or new outcome (prose, shape-bound) | protective counter-example that must still be refused (block or sprouts_required) | needed_by_route |
|---|---|---|---|---|---|
| R1 | theoVerdict steps 1 and 4 run the deny list, the name rule, my or our and confidential on every string | 29 of the 37 blocked extended questions are sprouts; 16 probe private claims and X7, X8, X10 are sprouts | A clear sprout with no private-claim marker skips: the name rule, deny words (runway, ARR, MRR, burn rate, Series, 3x growth, standup and the verbatim markers), the city gazetteer, money, percent and k-suffix forms, the venture proper-noun suffixes. Stays on for every shape: email address, SSN-like, phone-like, the 12 credential shapes, the identifier rule, name plus degree, quoted-person, the room lexicon. sprout_max_words stays 12 (X1 and X9 stay edges at 13 and 14 words) | X3 (email), X4 (key id), X6 (identifier), a room term in a sprout: block with their own classes | yes |
| R2 | PRIVATE_POSSESSIVE blocks my or our plus a venture noun; the confidential rule blocks private words; both in any string and with a plain block class | blocks X7, X10, "my team missed the launch"; passes "my notes", "our method guide" | A sprout that holds a private-claim marker (a my, our or we clause, a first-person statement, or a private word such as confidential, secret, proprietary, undisclosed) is answered sprouts_required (verdict block, no text echoed). The claim stays local; only a generic sprout leaves. Built in plan 386-33 (correction of this row): the marker is any my or our followed by a word, a first or we clause after punctuation, a first-person statement, or a private word. The broad possessive is needed so that the 12 marked probe strings are split as acknowledged; the cost is that an ordinary sprout such as how do I use my notes with the lean canvas is also answered sprouts_required (0 hits on the 26 positives, the 535 extended questions, the 16 compliant and the 31 generic 354 questions) | X7 and X10 and the 12 marker probe rows: sprouts_required, never allow | yes |
| R3 | an edge or a body that fails a prose rule (the name rule, a deny word, a money figure, a first-person statement) gets a plain block class (room_content/name, content_set, room_content/private_context) | 36 of 535 extended questions by the name rule; 8 of them are edges that carry only plugin nouns | An edge or a body that fails a prose rule is answered sprouts_required instead of a plain class. An edge that passes every prose rule stays allow. Credentials, structured identifiers and room-lexicon terms keep their own block classes | two unknown names in a 17 word edge, the burn rate and runway edge (21 words), X1, X2, X5, X9, the 36 word statement body: sprouts_required | yes |
| R4 | the name rule has no calendar, plugin-noun or shipped-vocabulary exemption | 8 of the 37 blocked extended questions are edges with only plugin nouns (C18, C21, C31, C42, C44, C64, C68, C91) | Optional narrowing for an edge or a body: exempt month and weekday names and the TitleCase tokens of the shipped vocabulary (command registry, section labels, framework names), built at run time. Not needed by the route: without it those 8 edges get the split guide instead of a block. | two unknown names in an edge still fail the name rule and get sprouts_required | no |
| R5 | the money, percent and k-suffix forms and the city gazetteer block any shape | X8 and the 12 ordinary deny-list questions | Body-only rows: these forms count as a prose-rule failure for an edge or a body (sprouts_required), never for a sprout. The spelled-money forms of plan 386-31 are in the same rows. The k-suffix and bare magnitude forms follow the same rule | X1 (an edge with $4.2M), the spelled money edge (budget is seven hundred fifty thousand dollars): sprouts_required | yes |
| R6 | an unreadable room.db blocks every free-form question (room_check_unavailable) | a 3 word sprout is blocked | A sprout with no hit from the rules that need no database is allow with class room_check_skipped. An edge or a body is answered sprouts_required (token_class room_check_unavailable, the reason says the room check could not run). Cost: in this state a sprout that holds a room-lexicon term leaves as written, because the lexicon cannot be read (residual_unreadable_db_lexicon: yes) | an edge with an unreadable room.db: sprouts_required, never allow | yes |
| R7 | `loadRoomLexicon` caches `{ ok: false }` under the stat key mtime:size | the failure survives a chmod restore (PROVEN) | A failed read is never cached; a successful read stays cached by stat key | after the chmod restore the next call reads the database again and returns the room verdict | yes |
| R8 | no shape test in the guard | sprout limit 12 vs 15 measured above | the guard calls classifyShape (plan 386-37); the limit stays 12 | X1 and X9 stay edges and are refused | yes (inside R1) |

Rows with needed_by_route yes are built by plan 386-33 (R1, R2, R3, R5, R6, R7, R8). R4 is not built unless the owner asks for it.

Not changed under any row: the 12 credential shapes, the email, SSN-like and phone-like patterns, the identifier rule, the room lexicon (except the unreadable-database state in R6), the brain_write block (plan 386-04), the plan 386-31 rules, and the shared FORBIDDEN_PATTERNS list.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a new tests/test-386-over-block-narrowing.cjs (plan 386-33)
  - Given: the sprout, edge and body strings above, the 10 negatives, the 16 probe keys, a fixture room with an unreadable room.db
  - When: classify runs with and without the room
  - Then: the acknowledged set (residual_plain_sprout_ids, the probe_private_sprout_plain_ids and the unreadable-database sprout case) is the only private-claim set that leaves as written; every marker sprout, edge and body counter-example is answered sprouts_required; credentials, identifiers and room terms block; the unreadable database follows R6 and R7
- Test 2: tests/test-3692-guard-survey-gate.cjs baseline is re-stamped by plan 386-33 with the acknowledged ids.
- Test 3: tests/test-3692-lexicon-generic-entries.cjs arm L6 expects class room_content/identifier for X4; it now gets content_set (plan 386-31). Update that expectation in plan 386-33.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: owned by plan 386-21.
- Canon Part 8: no wire is touched here. Synthetic strings only. No room content in this file.
- Tri-Polar: one classify function serves the hook and the belt, so the change reaches CLI, Desktop and Cowork alike.
- Release lockstep: applies only if a fix ships.
- Fixture note: scratch files lived under the session scratchpad. No repo product file was edited.

## Owner decision

decision: option-e
date: 2026-11-06

Owner's words, verbatim, spelling as typed: "follow last asnwer for this one as well"

The answer it points to (plan 386-26), verbatim, spelling as typed: "block ? i dont think a block will wor it need to be context based, like the file-a meeting style where it braeks it up to claims, facts hypthtesesys ect ..."

Reading (the main session's reading, to be checked by the owner), in 4 short lines:

1. The rows marked needed_by_route yes (R1, R2, R3, R5, R6, R7, R8) are built by plan 386-33.
2. A clear sprout passes without the name rule and the deny-word rules.
3. A body, an edge that fails a prose rule and a short private claim are answered sprouts_required: the claim stays local, only a generic sprout leaves.
4. Credentials, structured identifiers and room-lexicon terms never leave.

Gate checks made before this block was written: the plan 386-42 RCA says design_can_work: yes, and no row marked needed_by_route yes needs room text on the wire (the sprouts travel as ordinary brain_ask and brain_search calls).

## Owner acknowledgement

owner_ack: yes
owner_ack_ids: X8
owner_ack_probe_ids: C:plurai:24,C:plurai:26,C:plurai:29,C:plurai:31
split_probe_ids: C:plurai:22,C:plurai:25,C:plurai:32,C:354-private:1,C:354-private:2,C:354-private:3,C:354-private:4,C:354-private:5,C:354-private:6,C:354-private:7,C:354-private:8,C:354-private:9
owner_ack_unreadable_db_lexicon: yes
owner_ack_date: 2026-11-06

Source: the owner answered the plan 386-32 checkpoint on cards on 2026-11-06; the answers were relayed by the coordinating session. Owner choices, quoted verbatim:

1. Residual strings: "Acknowledge the 5 (Recommended)". The 5 are X8 and the four unmarked probe strings C:plurai:24, C:plurai:26, C:plurai:29 and C:plurai:31. The owner did not choose the figure rule and did not choose the proper-name rule. The 12 marked probe strings are split, not sent; they are not part of the acknowledged-leaving set and are listed above as split_probe_ids.
2. Unreadable room.db: "Short sprouts go, credentials still block (Recommended)". A short string that holds a room-lexicon term may leave while the room cannot be read; longer text is split (sprouts_required); credentials, emails and structured identifiers still block. The owner did not choose block-everything.

## Resolution

root_cause: three causes (the owner principle of 2026-11-06 says shape, not a word list, separates a sprout from a body). The name rule decides by spelling and has no calendar, plugin-noun or shape exemption. The shared deny list runs ordinary business words on every free-form string. The my or our rule ignores question versus statement, and a failed room database read is cached under a stat key that a chmod does not change.
fix: plan 386-33 (option-e). The Canon list is split into ALWAYS_PATTERNS (credentials, email, phone-like, SSN-like, name plus degree, quoted-person) and PROSE_PATTERNS (word lists), FORBIDDEN_PATTERNS stays the union. The guard decides a free-form string that is not an assembled Cypher template by shape (classifyShape): credentials, identifiers and room-lexicon terms block with their own class in every shape; a body is sprouts_required (body_shape); an edge is sprouts_required (edge_rule) when a prose rule, the private-context rules, the name rule or a first-person statement fires, else allow; a clear sprout skips the word lists and is allow, unless it holds a private-claim marker (my or our plus a word, a first-person clause, a private word), which is sprouts_required (private_marker). Unreadable room.db: a sprout is allow (room_check_skipped), an edge or a body is sprouts_required (room_check_unavailable). loadRoomLexicon caches only a successful read. The cypher key of brain_query keeps the old rules (repo code paths, plan 386-26). The survey gate reads accepted_sprout_negatives (X8), stamped with --stamp --accept.
verification: tests/test-386-over-blocking-narrowed.cjs (RED 28c44303c, GREEN 93b785273) all arms pass including OBN2, OBA1, OBK1, OBK2; corpus gate PASS with ext.blocked_no_room 37 to 8, ext.induced_total 0, pos26.blocked_no_room 0, retention and must_refuse unchanged; run-all-196, run-all-245, run-all-386 (31/31) pass; run-all-252 shows only census.1 and census.5b; the measured plain-sprout leavers equal the acknowledgement (negatives X8; probes C:plurai:24, 26, 29, 31). Pre-existing reds not caused here: test-rs-fetcher-academic, test-rs-chain-feeder-core, test-rs-nl-to-query, test-rs-sqlite-mirror, test-355-direction-agreement, test-mux-card-before-answer, no-new-dependency (flexsearch), plus census.1 and census.5b.
files_changed: lib/core/part8-egress-guard.cjs, lib/core/cross-room-aggregator.cjs, lib/core/rs-egress-prompts.cjs, lib/core/part8-room-lexicon.cjs, lib/core/brain-client.cjs, tests/test-3692-guard-survey-gate.cjs, tests/fixtures/3692/guard-survey-baseline.json, tests/test-386-over-blocking-narrowed.cjs
tests_flipped (class or sprout-case assertions, flipped in place with a plan 386-33 comment): lib/core/part8-egress-guard.test.cjs (PB8-09 four acknowledged rows), tests/test-386-key-shapes-and-money.cjs (K7c), tests/test-386-typed-theo-allow-arms.cjs (TB4, TB5), tests/test-3692-lexicon-generic-entries.cjs (L6), tests/test-part8-name-class-methodology-names.cjs (C2, C3, N1 to N3 now probe an edge), tests/test-3692-theo-verdict.cjs (V1b, V1d, V1g, V2e), tests/test-245-brain-envelope-shape.cjs (funding round anchors), tests/test-213-part8-boundary.cjs, tests/test-257-brain-tool-egress-invariant.cjs (Arm 4), tests/test-354-egress-typed-question.cjs, tests/test-3692-closure.cjs (D11), tests/test-3692-w1-closure.cjs (C5)
commits: 28c44303c (RED), 93b785273 (GREEN), the test flip commit after it
