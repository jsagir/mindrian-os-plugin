# 392-14 Canon Custodian preparation (D-06)

Prepared 2026-11-10 on branch work/part8-shape-packet at 08f2405b3. This document is the only file this step writes. No canon byte, no CLAUDE.md byte and no doc byte changes before the Custodian answers.

The code already enforces the rule (plans 392-09 to 392-13, waves 5 to 8). The constitution still states the old absolute wording. This document holds the exact proposed text, the evidence each sentence rests on, the one-commit lockstep plan, and the checkpoint card.

## 0. Facts read from the tree (PROVEN)

| Fact | Value | Where |
|---|---|---|
| Canon version (header) | `Version: 1.28` | docs/MINDRIAN-CANON.md:3 |
| Canon date (header) | `Date: 2026-09-16` | docs/MINDRIAN-CANON.md:4 (the Date line moved with the 1.28 bump in af1f36843) |
| Canon footer | `_Mindrian Canon v1.28 - MindrianOS Plugin_` | docs/MINDRIAN-CANON.md:926 (file has 928 lines) |
| Last Appendix D entry | 41 (Phase 348, 2026-09-16) | docs/MINDRIAN-CANON.md:870 |
| Next entry number | 42 | the plan assumed 42; confirmed |
| Version target | 1.28 -> 1.29 | the plan assumed 1.28 -> 1.29; confirmed |
| Map reference line | `Canon reference: docs/MINDRIAN-CANON.md (v1.28)` | docs/CANON-PHASE-MAP.md:6 |
| Map Part 8 section | `### Part 8 - The Graph Boundary (Security Constitution)` | docs/CANON-PHASE-MAP.md:144 |
| Map last version row | `v1.28` row (Phase 348 Plan 09, entry 41) | docs/CANON-PHASE-MAP.md:530 |
| Floor tests pinning `1.28` | exactly 7 files | `grep -l "1\.28" tests/test-canon-*.cjs` |
| Em dashes in the three doc files | 0 | `grep -cP "\x{2014}"` on the canon, CLAUDE.md and the map |
| Shim path in CLAUDE.md :215 | `bin/mindrian-brain-mcp-client.cjs` is a 396-byte forwarding wrapper to `scripts/mindrian-brain-mcp-client.cjs` (Phase 369.1, D-10) | bin/mindrian-brain-mcp-client.cjs |
| Shape vocabulary | problem_type 4, stage 6, role 7, domain_tag 11, constraint_categories 9 members; schema_version 1 | data/brain-shape-vocabulary.json |

Suites run before any change (all green, PROVEN, this machine, 2026-11-10):

| Suite | Result |
|---|---|
| `bash tests/run-all-340.sh` | Passed 9, Failed 0, Skipped 0, exit 0 |
| `node tests/test-canon-frozen-scalars-floor.cjs` | PASSED, exit 0 |
| `node tests/test-canon-entry-31-two-gauge-floor.cjs` | PASS 56 assertions |
| `node tests/test-canon-entry-36-shape-declaration-floor.cjs` | PASS 63 assertions |
| `node tests/test-canon-entry-38-sourced-claims-floor.cjs` | PASS 58 assertions |
| `node tests/test-canon-entry-39-graph-substrate-floor.cjs` | PASS 103 assertions |
| `node tests/test-canon-entry-40-corpus-figures-floor.cjs` | PASS 82 assertions |
| `node tests/test-canon-entry-41-supersession-narrowing-floor.cjs` | PASS 71 assertions |
| `node tests/test-canon-part-9-ratification.cjs` | 9/9 passed |
| `bash tests/run-all-396.sh` | PASS=20 FAIL=0 SKIP=0, exit 0 (20 test files discovered) |
| `node tests/test-396-loop-l1-wire-bytes.cjs` | 8 passed, 0 failed, exit 0 |

## 1. The proposed text, old and new, side by side

The owner's sentence (396-CONTEXT.md D-06, verbatim): **"No raw room text leaves. A closed-vocabulary problem shape plus the generic question may."**

The sentence is placed verbatim once in Part 8. Every other line below carries the same words in its own grammar. Line numbers are the current lines on 08f2405b3.

### 1.1 docs/MINDRIAN-CANON.md

Seven existing lines change and two blocks are inserted. The frozen scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) are not on any of these lines.

**Line 3 (header version)**

- OLD: `Version: 1.28`
- NEW: `Version: 1.29`

**Line 4 (header date)**

- OLD: `Date: 2026-09-16`
- NEW: `Date: <the date of the Custodian's answer>`

**Line 98 (Part 2, the team's REMOTE BRAIN tool line, inside the code block; leading whitespace kept)**

- OLD: `- REMOTE BRAIN  Call, read, and use Brain intelligence. Methodology queries, framework chaining rules, teaching patterns calibrated from the curriculum. Stateless per Part 8. Queries carry only generic handles (framework names, phase identifiers, problem types), never user content.`
- NEW: `- REMOTE BRAIN  Call, read, and use Brain intelligence. Methodology queries, framework chaining rules, teaching patterns calibrated from the curriculum. Stateless per Part 8. Queries carry only generic handles (framework names, phase identifiers, problem types) and the closed-vocabulary problem shape beside the generic question, never raw room text.`

Note for the floor test: this line sits in the Part 2 slice, not the Part 8 slice. The plan's absence check for "never user content" and "Queries carry only generic handles" must be scoped to the Part 2 slice (or to this exact sentence), or it passes for the wrong reason.

**Line 284 (Part 8, the boundary statement, inside the code block)**

- OLD: `Allowed Brain queries carry only generic framework handles and phase identifiers. "What chains from SWOT to Porter Five Forces at phase 2?" is allowed. "Here is Lawrence's financial model - what does the Brain say?" is a breach.`
- NEW: `Allowed Brain queries carry only generic framework handles, phase identifiers and the closed-vocabulary problem shape. No raw room text leaves. A closed-vocabulary problem shape plus the generic question may. "What chains from SWOT to Porter Five Forces at phase 2?" is allowed. "Here is Lawrence's financial model - what does the Brain say?" is a breach.`

**Insert after line 284 (new paragraph, inside the same code block, one blank line before it): the two defining sentences, the three membership checks, the invariant restated**

```
The problem shape is a closed-vocabulary packet of six fields - schema_version, problem_type, stage, role, domain_tag, constraint_categories - and every member comes from data/brain-shape-vocabulary.json (one file, one vocabulary, shared with Theo); the packet carries enum ids only, never a free string. One builder, lib/core/brain-shape-packet.cjs, builds the shape from the bound room's own state, and a model-supplied shape is ignored, never trusted. Three membership checks guard the wire - the shim's zod enums (scripts/mindrian-brain-mcp-client.cjs), the brain-client validator (validateShapePacket) and the egress guard's typed arm (lib/core/part8-egress-guard.cjs) - and a shape that fails any one of them is refused, never repaired. The LOCAL data -> BRAIN: NO invariant above is UNCHANGED and remains binding for raw text: the shape is not room text, it is the room's position in a closed grid.
```

**Line 342 (Part 9, principle 3)**

- OLD: `3. **Brain reasons over structured packets, never raw memory.** Brain (the remote methodology repository) receives typed Brain Context Packets generated by SQL - never raw artifact text, never filenames, never user-identifying content (per Part 8 boundary). Brain returns advisory suggestions: recommended next move, framework chain, contradictions to investigate. Brain is the *external cortex* - it interprets patterns, but never owns the truth.`
- NEW: `3. **Brain reasons over structured packets, never raw memory.** Brain (the remote methodology repository) receives typed Brain Context Packets generated by SQL - never raw room text, never filenames, never user-identifying content; the closed-vocabulary problem shape plus the generic question is the one typed packet that crosses (per Part 8 boundary). Brain returns advisory suggestions: recommended next move, framework chain, contradictions to investigate. Brain is the *external cortex* - it interprets patterns, but never owns the truth.`

**Line 368 (Part 9, the summary bullet)**

- OLD: `- Brain calls are typed packets, not free-form prompts. The wire schema makes Part 8 leakage structurally hard, not just procedurally audited.`
- NEW: `- Brain calls are typed packets, not free-form prompts: the generic question plus the closed-vocabulary problem shape (data/brain-shape-vocabulary.json), never raw room text. The wire schema makes Part 8 leakage structurally hard, not just procedurally audited.`

**Insert after line 870 (Appendix D, new entry 42, one blank line before it)**

```
42. **Part 8 restated: no raw room text leaves; a closed-vocabulary problem shape plus the generic question may (Phase 392, <date>).** Phase 392 (part-8-problem-shape-packet) changes Part 8 from "filter the free text we send to the Brain" to "send only a closed-vocabulary problem shape plus the generic question; never raw room text". The owner's sentence, placed verbatim in Part 8's boundary statement: "No raw room text leaves. A closed-vocabulary problem shape plus the generic question may." The shape is a packet of six fields (schema_version, problem_type, stage, role, domain_tag, constraint_categories); every member comes from data/brain-shape-vocabulary.json, the one vocabulary shared with Theo; the packet carries enum ids only. One builder (lib/core/brain-shape-packet.cjs) builds it from the bound room's own state; a model-supplied shape is ignored. Three membership checks guard the wire: the shim's zod enums (scripts/mindrian-brain-mcp-client.cjs), the brain-client validator (validateShapePacket) and the egress guard's typed arm (lib/core/part8-egress-guard.cjs classify step 1d); a shape that fails any one is refused with a typed block (shape_invalid, the field named), never repaired. What is NOT changed, stated so the amendment cannot be over-read: the LOCAL data -> BRAIN: NO invariant stays binding for raw text; artifact bodies, meeting content, personal identifiers and proprietary numbers are still a breach; brain_write stays blocked; the PR gate, the boundary scan and the Canon Custodian review apply in full. This entry RATIFIES already-shipped code rather than minting a new mechanism: the typed arm (plan 392-09), the session-owned lexicon (392-11), the shape on the wire behind a capability probe (392-12) and the loop proofs L1 and L3 plus the live bare-versus-shaped acceptance (392-13) were green before any canon byte changed; the capture server proves that no room word leaves in any captured byte (tests/test-396-loop-l1-wire-bytes.cjs). This was approved by the Canon Custodian at a blocking checkpoint on <date> BEFORE any canon byte was written (D-06); the Custodian's answer, verbatim: "<CUSTODIAN ANSWER>". The Custodian confirmed the version target v1.28 -> v1.29. Entry 31's self-binding clause (no further Appendix D entry until entry 31 returns a live two-gauge reading) was RELEASED for this amendment by the Part-10 navigator-authority override (entry 20), recorded truthfully - no two-gauge reading was taken or fabricated, the release rests on navigator authority, the deferred reading stays a named debt, mirroring entries 32/33/34/35/36/37/38/39/40/41. Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/25/26/27/36/37/38/39/40/41. The amendment mints NO new reach, NO new edge type, NO new node type, and opens NO Brain wire: the shape rides on the existing brain_ask and recommend_chain calls as one optional field the Brain advertises. The frozen Part 3 scalars are byte-identical: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate are UNCHANGED. Requirement id: 392-SC8 (canon half). Implementing phase: 392 (plans 09 to 13 are the code); this Phase 392 Plan 14 is the canon ratification. Landed as ONE atomic lockstep wave so CI never went RED: the Part 8 boundary statement and its defining paragraph + the Part 2 REMOTE BRAIN tool line + the two Part 9 lines (principle 3 and the typed-packets bullet) + this Appendix D entry 42 + the header/footer Version 1.28 -> 1.29 + the CANON-PHASE-MAP reference line, Part 8 row and v1.29 version-history row + the new canonical FLOOR test (`tests/test-canon-entry-42-shape-packet-floor.cjs`, registered in `tests/run-all-340.sh` - slice-scoped presence-and-absence assertions inside Part 8, Part 2 and Part 9, entry 42 body isolation, prior entries 1-41 preserved, frozen scalars byte-present, version 1.29, never a raw count of Appendix D entries) + the parallel `CLAUDE.md` Part 8 Canon Compliance Core bullet and its two Brain boundary lines carrying the same words in the SAME commit (closing 340-RESEARCH.md Pitfall 3) + seven existing canon FLOOR tests' version anchors moved 1.28 -> 1.29 (`tests/test-canon-entry-31-two-gauge-floor.cjs`, `tests/test-canon-entry-36-shape-declaration-floor.cjs`, `tests/test-canon-entry-38-sourced-claims-floor.cjs`, `tests/test-canon-entry-39-graph-substrate-floor.cjs`, `tests/test-canon-entry-40-corpus-figures-floor.cjs`, `tests/test-canon-entry-41-supersession-narrowing-floor.cjs`, `tests/test-canon-part-9-ratification.cjs`, each with its prior-entry loop and frozen-scalar assertions unweakened) + the frozen-scalar FLOOR test (`tests/test-canon-frozen-scalars-floor.cjs`) kept GREEN, all moving together. Header/footer Version 1.28 -> 1.29. Canon version bumped to 1.29.
```

**Line 926 (footer)**

- OLD: `_Mindrian Canon v1.28 - MindrianOS Plugin_`
- NEW: `_Mindrian Canon v1.29 - MindrianOS Plugin_`

Count: 7 existing canon lines change (3, 4, 98, 284, 342, 368, 926); 2 blocks are inserted (the defining paragraph after 284, entry 42 after 870).

### 1.2 docs/CANON-PHASE-MAP.md

**Line 6 (reference line)**

- OLD: `Canon reference: docs/MINDRIAN-CANON.md (v1.28)`
- NEW: `Canon reference: docs/MINDRIAN-CANON.md (v1.29)`

**Part 8 Map section (after line 144's table, appended as the last row of that table)**

```
| shipped | Phase 392 part-8-problem-shape-packet: Part 8 restated as "No raw room text leaves. A closed-vocabulary problem shape plus the generic question may." The shape (schema_version, problem_type, stage, role, domain_tag, constraint_categories; every member from data/brain-shape-vocabulary.json) is built from the bound room by one builder (lib/core/brain-shape-packet.cjs), checked by exact enum membership in the shim, the brain-client and the egress guard's typed arm, and rides on brain_ask and recommend_chain behind a capability probe; the capture server proves no room word leaves (tests/test-396-loop-l1-wire-bytes.cjs) | Phase 392 Plans 09-13 (code), Plan 14 (canon, Appendix D entry 42, v1.29) |
```

**Version history (new row after line 530, same column format as the v1.28 row)**

```
| v1.29         | TBD      | <date> | Phase 396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s Plan 14: entry 42, Part 8 restated for the closed-vocabulary problem shape (canon_parts 6/8/9). CUSTODIAN-GATED (D-06): the Task-1 blocking checkpoint HALTED for the Canon Custodian's answer before any canon byte was written; the Custodian replied "<CUSTODIAN ANSWER>" on <date>, confirming the version target v1.28 -> v1.29. Appendix D entry 42 records: Part 8's boundary statement now says "No raw room text leaves. A closed-vocabulary problem shape plus the generic question may." and defines the shape (six fields, every member from data/brain-shape-vocabulary.json, one builder lib/core/brain-shape-packet.cjs, a model-supplied shape ignored) and the three membership checks (shim zod enums, brain-client validateShapePacket, the guard's typed arm); the Part 2 REMOTE BRAIN tool line and the two Part 9 lines (principle 3, the typed-packets bullet) carry the same words; the LOCAL data -> BRAIN: NO invariant stays binding for raw text. This entry RATIFIES already-shipped code (plans 392-09, 392-11, 392-12, 392-13, all green before the ruling). Entry 31's self-binding clause was RELEASED for this amendment by the Part-10 navigator-authority override (entry 20), recorded truthfully, mirroring entries 32-41. Applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/25/26/27/36-41. FROZEN SCALARS byte-identical: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate UNCHANGED; mints NO new reach, NO new edge type, NO new node type, opens NO Brain wire. `CLAUDE.md`'s Part 8 Canon Compliance Core bullet and its two Brain boundary lines carry the same words in the SAME commit, closing 340-RESEARCH.md Pitfall 3. ONE atomic lockstep wave (the Part 8 boundary statement and defining paragraph + the Part 2 line + the two Part 9 lines + Appendix D entry 42 + this row + the Part 8 Map row + the new canonical FLOOR test tests/test-canon-entry-42-shape-packet-floor.cjs registered real in tests/run-all-340.sh + seven existing canon FLOOR tests' version anchors bumped 1.28 -> 1.29 + the frozen-scalar FLOOR test kept GREEN) so CI never went RED. MINDRIAN-CANON.md header/footer Version 1.28 -> 1.29; CANON-PHASE-MAP reference line v1.28 -> v1.29. Fences: tests/test-canon-entry-42-shape-packet-floor.cjs green; tests/test-canon-frozen-scalars-floor.cjs green; the seven anchored FLOOR tests green at v1.29; bash tests/run-all-340.sh exit 0; bash tests/run-all-396.sh exit 0. Requirement id: 392-SC8 (canon half). Implementing phase: 392 (plans 09-13 the code); this Plan 14 is the canon ratification. Map + canon text change. |
```

### 1.3 CLAUDE.md (three lines)

**Line 51 (Canon Compliance Core, the Part 8 bullet)**

- OLD: `- **Part 8 - Graph Boundary (LOCAL -> BRAIN: NO).** User data NEVER egresses to the Brain; it serves generic methodology only. Writing user-specific bytes to Brain is a constitutional breach. Deep dive: docs/MINDRIAN-CANON.md (Part 8).`
- NEW: `- **Part 8 - Graph Boundary (LOCAL -> BRAIN: NO).** No raw room text leaves. A closed-vocabulary problem shape plus the generic question may (every member from data/brain-shape-vocabulary.json, built from the bound room by one builder, Appendix D entry 42). The Brain serves generic methodology only. Writing user-specific bytes to Brain is a constitutional breach. Deep dive: docs/MINDRIAN-CANON.md (Part 8).`

Wording choice for the Custodian (W1): the OLD bullet says "User data NEVER egresses to the Brain". The shape is derived from the room (its stage, role, domain tag, constraint categories) as closed enum ids. The NEW bullet replaces that clause with the owner's sentence and keeps "Writing user-specific bytes to Brain is a constitutional breach" verbatim, as the plan requires. The alternative is to keep "User data NEVER egresses to the Brain" beside the new sentence; the two then read as a tension on one line. Recommendation: replace, as written above.

**Line 158 (the Architecture block, Connector Spine; this line sits inside the `GSD:architecture-start source:ARCHITECTURE.md` fence, and no other tracked .md file carries the sentence, so the edit lands in CLAUDE.md itself)**

- OLD: `- The Brain boundary holds: LOCAL data never egresses; only generic framework handles and enums cross the wire.`
- NEW: `- The Brain boundary holds: raw room text never egresses; only generic framework handles, the closed-vocabulary problem shape (data/brain-shape-vocabulary.json, the one vocabulary) plus the generic question cross the wire.`

**Line 215 (the Theo grounding-source paragraph; one clause added inside the existing parenthesis, nothing else changed)**

- OLD (the changed span): `MUST go through the guarded `mindrian-brain` MCP shim (`bin/mindrian-brain-mcp-client.cjs`), never mcp__theo__* directly`
- NEW (the changed span): `MUST go through the guarded `mindrian-brain` MCP shim (`bin/mindrian-brain-mcp-client.cjs`; no raw room text leaves it, a closed-vocabulary problem shape from data/brain-shape-vocabulary.json plus the generic question may), never mcp__theo__* directly`

Note (W2, factual, not a wording question): `bin/mindrian-brain-mcp-client.cjs` is a forwarding wrapper to `scripts/mindrian-brain-mcp-client.cjs` (Phase 369.1, D-10). The path stays valid. The plan says "add nothing else" for this task, so the path is not changed here.

After the three edits: `grep -c "closed-vocabulary problem shape" CLAUDE.md` returns 3 (the plan expects 2 or 3); `grep -cP "\x{2014}" CLAUDE.md` returns 0.

### 1.4 The seven floor-test anchors (current literal -> new literal)

Every `1.28` literal, assertion or comment, moves to `1.29`; the plan's verify requires zero `1\.28` matches across the seven files. Assertion regexes are listed first; comment lines follow.

| File | Line | Current literal | New literal |
|---|---|---|---|
| tests/test-canon-entry-31-two-gauge-floor.cjs | 158 | `/^Version: 1\.28$/m` | `/^Version: 1\.29$/m` |
| | 159 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 44, 156 | comments "now at 1.28 ... Phase 348's entry 41" | "now at 1.29 after Phase 392's entry 42" |
| tests/test-canon-entry-36-shape-declaration-floor.cjs | 156 | `/^Version: 1\.28$/m` | `1\.29` |
| | 157 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 162 | `/v1\.28/.test(map)` (map token) | `/v1\.29/` |
| | 35, 36, 154, 160 | comments | 1.29, Phase 392 entry 42 |
| tests/test-canon-entry-38-sourced-claims-floor.cjs | 157 | `/^Version: 1\.28$/m` | `1\.29` |
| | 158 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 40, 155 | comments | 1.29, Phase 392 entry 42 |
| tests/test-canon-entry-39-graph-substrate-floor.cjs | 222 | `/^Version: 1\.28$/m` | `1\.29` |
| | 223 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 220 | comment | 1.29, Phase 392 entry 42 |
| tests/test-canon-entry-40-corpus-figures-floor.cjs | 232 | `/^Version: 1\.28$/m` | `1\.29` |
| | 233 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 239 | `/v1\.28/.test(map)` (map token) | `/v1\.29/` |
| | 74, 230, 236 | comments | 1.29, Phase 392 entry 42 |
| tests/test-canon-entry-41-supersession-narrowing-floor.cjs | 219 | `/^Version: 1\.28$/m` | `1\.29` |
| | 220 | `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/` | `v1\.29` |
| | 234 | `/^Canon reference: docs\/MINDRIAN-CANON\.md \(v1\.28\)\s*$/m` | `\(v1\.29\)` |
| | 236 | `/\|\s*v1\.28\s*\|[^\n]*entry 41/` (the v1.28 history row names entry 41) | see E1 below |
| | 6, 60, 61, 66, 67, 217, 230 | comments | reworded without the 1.28 literal, history kept true ("the version after 1.27") |
| tests/test-canon-part-9-ratification.cjs | 119 | comment "(v1.28)" (the assertion itself reads the live canon header, no literal) | "(v1.29)" |

E1 (executor decision, named for the Custodian's record): the entry-41 test at :236 pins the v1.28 version-history row by its version literal. The v1.28 row stays in the map after the lockstep, so the semantic still holds, but the plan's verify forbids any `1\.28` literal in the seven files. Proposal: keep the semantic and drop the exact version pin: `/\|\s*v1\.\d+\s*\|[^\n]*entry 41/` (a version-history row names entry 41). The entry-42 floor test pins the v1.29 row and entry 42 by its own literal.

### 1.5 The new floor test and the runner

- New file `tests/test-canon-entry-42-shape-packet-floor.cjs`, pattern of the entry-41 test: slice by `## Part 8 - ` / `## Part 2 - ` / `## Part 9 - ` / `## Appendix D`. Asserts: the owner's sentence present exactly once in the Part 8 slice; the old sentence "Allowed Brain queries carry only generic framework handles and phase identifiers." absent from the Part 8 slice; the defining paragraph's tokens (the six field names, data/brain-shape-vocabulary.json, lib/core/brain-shape-packet.cjs, validateShapePacket, lib/core/part8-egress-guard.cjs, "refused, never repaired", "LOCAL data -> BRAIN: NO invariant above is UNCHANGED") inside the Part 8 slice; "never user content" and "Queries carry only generic handles (framework names, phase identifiers, problem types), never" absent from the Part 2 slice and "never raw room text" present there; "never raw artifact text" absent from the Part 9 slice and "never raw room text" present there; entry 42 heading present, body names Phase 392, the Custodian approval language, the entry-31 release language, the mints-nothing statement, the frozen-scalar restatement byte-identical, 392-SC8; prior entries 1 to 41 preserved per number in the Appendix D slice; MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 byte-present; header `Version: 1.29` and footer `v1.29`; CLAUDE.md carries "closed-vocabulary problem shape" at least twice and "Writing user-specific bytes to Brain is a constitutional breach"; the map reference line reads v1.29 and a v1.29 row names entry 42. Never a raw count of Appendix D entries.
- `tests/run-all-340.sh`: register the new test by name (the runner lists each canon test by path; the pattern of lines 91-92).

## 2. Evidence table: what each sentence rests on

| Proposed sentence (short form) | Code that enforces it | Test that proves it | SUMMARY that records it |
|---|---|---|---|
| No raw room text leaves | lib/core/part8-egress-guard.cjs (typed arm, classify step 1d; lexicon, sprout, credential and body rules as a belt on the free-text key), lib/core/brain-client.cjs callTool belt, scripts/mindrian-brain-mcp-client.cjs | tests/test-396-loop-l1-wire-bytes.cjs (8 arms: body exactly [question, shape] or [question]; no lexicon word, no credential shape in any captured byte, shim and in-process); tests/test-396-typed-shape-arm.cjs A0-A14 (18 checks); tests/test-396-bypass-1 to -6 | 396-13-SUMMARY.md (L1), 396-09-SUMMARY.md, 396-05-SUMMARY.md |
| A closed-vocabulary problem shape plus the generic question may | lib/core/brain-client.cjs ask(): wire exactly {question, shape} when the Brain advertises the field, {question} otherwise; recommend_chain {problem_type: shape.problem_type, max_steps, shape} | tests/test-396-wire-shape.cjs W0-W16 (18 checks); tests/test-396-loop-l1-wire-bytes.cjs; live acceptance 396-ACCEPTANCE.md (four verdicts WIN/WIN/WIN/PASS against theo-mcp 3e6946be, ids and labels only) | 396-12-SUMMARY.md, 396-13-SUMMARY.md |
| Six fields, every member from data/brain-shape-vocabulary.json, enum ids only | lib/core/brain-shape-packet.cjs (SHAPE_KEYS, ENUM_LISTS, loadVocabulary, validateShapePacket); data/brain-shape-vocabulary.json schema_version 1 | tests/test-396-shape-packet.cjs (83 checks); tests/test-396-vocabulary-drift.cjs (89 checks; Theo's five enums equal) | 396-08-SUMMARY.md, 396-02-SUMMARY.md |
| One builder builds the shape from the bound room; a model-supplied shape is ignored | lib/core/brain-shape-packet.cjs buildShapePacket (reads STATE.md, USER.md, jtbd-state.json of the room only); scripts/mindrian-brain-mcp-client.cjs handler ignores the supplied shape and builds the room shape when the session owns a bound room (grounding.model_shape_ignored); lib/mcp/brain-router.cjs brainRoute uses the same builder | tests/test-396-shape-packet.cjs; tests/test-396-wire-shape.cjs (shim arm) | 396-08-SUMMARY.md, 396-12-SUMMARY.md |
| Three membership checks: shim zod enums, brain-client validator, guard arm | scripts/mindrian-brain-mcp-client.cjs:245-251 z.strictObject with z.enum per field, constraint_categories max 5; lib/core/brain-client.cjs _validateShapeLazy / validateShapePacket at :1297 and :1687; lib/core/part8-egress-guard.cjs :1154-1200 (shape_invalid with the field, unexpected_key, question_too_long cap 240, shape_validated on every verdict) | tests/test-396-typed-shape-arm.cjs; tests/test-396-wire-shape.cjs; tests/test-396-bypass-2-sibling-key.cjs | 396-09-SUMMARY.md, 396-12-SUMMARY.md |
| The lexicon that decides "room text" belongs to the session (two sessions never share one) | lib/core/part8-room-lexicon.cjs resolveLexiconRoom({sessionId, requireOwnership}) typed status and lexicon_scope; unreadable room blocks room_check_unavailable | tests/test-396-session-owned-lexicon.cjs L0-L12 (18 checks) | 396-11-SUMMARY.md (F8 PROVEN: CLAUDE_CODE_SESSION_ID reaches the shim) |
| Larry recombines locally (the wire carries the question and the shape; the room words stay in the local assembly) | lib/core/part8-split-route.cjs assembleLocal through runSplitRoute | tests/test-396-loop-l3-recombine.cjs | 396-13-SUMMARY.md (L3) |
| Mints no reach, edge, node or Brain wire | the shape rides on the existing brain_ask and recommend_chain calls as one optional field behind brainAcceptsShape | tests/test-396-wire-shape.cjs (schema A: bare call unchanged); tests/test-canon-frozen-scalars-floor.cjs | 396-12-SUMMARY.md |
| Legitimate method questions are not over-blocked (the reason the rule changed) | the typed arm | tests/fixtures/392-part8-replay/matrix-after-arm.json: extended_blocked 8 of 535, must_refuse_blocked 10 of 10 (every group equal to beta.81) | 396-09-SUMMARY.md, 396-WAVES.md |

Open (not claimed): the human grounding verdict of the live acceptance is PENDING (396-ACCEPTANCE.md, the owner reads two row-id lists). It is not an input to the canon wording; the wording states what crosses the wire, not that the shaped answers are better.

## 3. The one-commit lockstep (to run only after the ruling)

Precondition: the Custodian answered "approve as written" or "approve with wording changes" (the changes applied to section 1 first). Task 2 (RED floor test, then the lockstep) and Task 3 (CLAUDE.md) of 396-14-PLAN.md land in the same commit so CI never goes red (the plan allows CLAUDE.md "in the same commit or the next"; the same commit is chosen because the entry-42 floor test reads CLAUDE.md).

Order of work:

1. Write `tests/test-canon-entry-42-shape-packet-floor.cjs`; run it; it must FAIL on the current canon (RED).
2. Apply section 1.1 (canon), 1.2 (map), 1.3 (CLAUDE.md), 1.4 (seven anchors), 1.5 (runner registration). Fill `<date>` and `<CUSTODIAN ANSWER>` verbatim.
3. Run: `node tests/test-canon-entry-42-shape-packet-floor.cjs && bash tests/run-all-340.sh && node tests/test-canon-frozen-scalars-floor.cjs && bash tests/run-all-396.sh`; then `grep -c "Version 1.29" docs/MINDRIAN-CANON.md` (expect the header; the footer uses `v1.29`), the plan's zero-`1\.28` count over the seven files, `grep -c "closed-vocabulary problem shape" CLAUDE.md` (expect 3), `grep -cP "\x{2014}"` on the three doc files (expect 0 each).
4. One commit, exact paths, `git add -f` then `git commit --only`:

```
git add -f docs/MINDRIAN-CANON.md docs/CANON-PHASE-MAP.md CLAUDE.md \
  tests/test-canon-entry-42-shape-packet-floor.cjs tests/run-all-340.sh \
  tests/test-canon-entry-31-two-gauge-floor.cjs tests/test-canon-entry-36-shape-declaration-floor.cjs \
  tests/test-canon-entry-38-sourced-claims-floor.cjs tests/test-canon-entry-39-graph-substrate-floor.cjs \
  tests/test-canon-entry-40-corpus-figures-floor.cjs tests/test-canon-entry-41-supersession-narrowing-floor.cjs \
  tests/test-canon-part-9-ratification.cjs
git commit --only <the same 12 paths> -m "feat(392-14): Canon Part 8 restated for the closed-vocabulary problem shape (entry 42, v1.28->v1.29)" \
  -m "- Part 8: No raw room text leaves. A closed-vocabulary problem shape plus the generic question may. (Custodian-approved <date>, D-06)
- Part 2 REMOTE BRAIN line and Part 9 lines 342, 368 carry the same words
- Appendix D entry 42; header, date and footer 1.28 -> 1.29
- CANON-PHASE-MAP: reference line v1.29, Part 8 row, v1.29 history row
- CLAUDE.md :51, :158, :215 in the same commit (Pitfall 3)
- new floor test test-canon-entry-42-shape-packet-floor.cjs registered in run-all-340.sh; seven anchors 1.28 -> 1.29

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

File list (12 files, 1 new): docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, CLAUDE.md, tests/test-canon-entry-42-shape-packet-floor.cjs (new), tests/run-all-340.sh, and the seven anchored floor tests.

Then: 396-14-SUMMARY.md (approval text and date, entry 42, 1.28 -> 1.29, the commit id) and the 396-WAVES.md row for wave 9, in a separate docs commit. No push, no amend. The foreign .planning/ROADMAP.md, .planning/STATE.md and .planning/phases/393-* stay untouched.

## 4. The checkpoint card

```
## CHECKPOINT REACHED

Type: human-verify (gate: blocking) - Canon Custodian ruling, D-06
Plan: 392-14
Progress: 0/3 tasks complete (Task 1 is this checkpoint; Tasks 2 and 3 wait for the answer)

What the code already enforces (PROVEN, 2026-11-10, branch work/part8-shape-packet at 08f2405b3):
- bash tests/run-all-396.sh: PASS=20 FAIL=0 SKIP=0
- node tests/test-396-loop-l1-wire-bytes.cjs: 8 passed, 0 failed (the wire carries exactly the question plus the shape; no room word in any captured byte)
- bash tests/run-all-340.sh: Passed 9, Failed 0 (the canon floor is green before the change)
- The seven anchored floor tests and the frozen-scalars test: green at v1.28

What the Custodian approves:
1. The Part 8 sentence, verbatim, at docs/MINDRIAN-CANON.md:284:
   "No raw room text leaves. A closed-vocabulary problem shape plus the generic question may."
2. The defining paragraph that follows it (six fields; every member from data/brain-shape-vocabulary.json; one builder lib/core/brain-shape-packet.cjs; a model-supplied shape ignored; three membership checks: shim zod enums, brain-client validateShapePacket, the guard's typed arm; the LOCAL data -> BRAIN: NO invariant unchanged for raw text).
3. The three related lines in the same words: canon :98 (Part 2 REMOTE BRAIN), :342 and :368 (Part 9).
4. Appendix D entry 42 (the Custodian's answer is recorded in it verbatim with the date) and the version bump 1.28 -> 1.29 (header, date, footer).
5. CANON-PHASE-MAP: the reference line v1.29, the Part 8 row, the v1.29 history row.
6. CLAUDE.md :51, :158, :215 in the same words. Wording choice W1: :51 drops "User data NEVER egresses to the Brain" in favour of the owner's sentence and keeps "Writing user-specific bytes to Brain is a constitutional breach" verbatim (recommended); the alternative keeps both clauses on one line.
7. Lockstep mechanics: one commit (12 files), the new floor test, the seven anchors 1.28 -> 1.29, E1 (the entry-41 test drops its exact v1.28 pin on the history row, keeps the row-names-entry-41 semantic).

The full old-and-new text is in .planning/phases/396-part-8-problem-shape-packet-measure-close-the-six-bypasses-s/396-14-CUSTODIAN-PREP.md, section 1.

The three answers:
A. "approve as written" - the lockstep runs exactly as section 3 describes; the answer and the date go into entry 42 verbatim.
B. "approve with wording changes: <name them>" - the named lines are changed in the prep document first, then the lockstep runs; the edited sentence and the date go into entry 42 verbatim.
C. "hold" - nothing runs; the branch stays at 08f2405b3 plus this preparation document; Tasks 2 and 3 of 392-14 stay open.

No canon byte, no CLAUDE.md byte and no doc byte changes before the answer. The only file written in this step is this preparation document.
```
