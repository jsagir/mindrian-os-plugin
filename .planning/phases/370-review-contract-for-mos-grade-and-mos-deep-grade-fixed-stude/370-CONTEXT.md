# Phase 370: Review contract for /mos:grade and /mos:deep-grade - Context

**Gathered:** 2026-11-08 by the planner from the ROADMAP Phase 370 entry, 370-INPUT.md, 370-RESEARCH.md and the owner brief of 2026-11-08. No discuss-phase ran (config workflow.skip_discuss is true). Every decision below is a ruling already written in the ROADMAP, in SEED-102 or in the brief. Nothing here is new product policy. Owner questions O1 to O9 are NOT decided here: they go on one card (plan 370-03) and stay PENDING until the owner answers.

**Phase dependency:** none (ROADMAP). The grade surface was untouched since 2026-10-01 except commit 12f26104c (383-08), which swapped literal figures for placeholders in agents/grading.md. The ROADMAP line "zero commits" is therefore not exact. It does not change the plan.

<decisions>
## Implementation Decisions (locked)

- **D-01:** The reader-facing body of every grade or deep-grade review has ONE fixed shape, in this order: Executive Summary (short paragraph, then 3 to 5 key revision points as bullets with bold takeaways); Reality Check; Faculty Questions; Expert Conversations; Research Validation + Reframe; Strategic Challenge (one consolidated big question plus reflection questions). Cross-domain ideas: at most 2 in the body; extras only under an optional last note headed "For advanced students". (ROADMAP Goal; SEED-102.)
- **D-02:** Never a tool-analysis section, a methodology-score-by-tool section, or an "improvement recommendations mapped to agents" section.
- **D-03:** Methods are named only as taught in the course (Meadows' leverage points, causal loops, stocks and flows). Any other term is defined in-line in plain words or cut. Code cannot prove "defined in plain words"; that part stays a human rubric (Lawrence review standard). The code enforces names, shape and counts only.
- **D-04:** The check is code, never a model judgment. It runs on the reader-facing BODY only. Frontmatter and provenance keep handles. It fails the output on any `*Agent` class name, MCP, Neo4j, Brain, `/mos:`, Theo, and graph or database names.
- **D-05:** The contract is data (`data/review-contract.json`), with the human-readable prose in the grading reference home (`references/methodology/grade.md`, section "Review contract"). A drift test pins the two together. `commands/grade.md`, `commands/deep-grade.md` and `agents/grading.md` read it.
- **D-06:** Reuse before build (Canon Part 7). The check lives in one new pure module, `lib/core/review-contract.cjs`, and reuses `lib/hmi/larry-reply-checks.cjs` (NEVER_SAY_TERMS, findIdLeak, the verdict shape). No second linter framework. `lib/core/tone-filter.cjs` is NOT extended (see Deviations).
- **D-07:** Tri-Polar. The same module result holds on the CLI (pre-file wrapper, optional hook), on Desktop and Cowork (the MCP filing door `artifact_file`), and at release (doctor gate).
- **D-08:** Fixtures use pseudonyms only and synthetic venture text. The offending names (agent class names, "Network Analysis MCP", the Neo4j heading) came from another pipeline; the fixtures plant them. No real student, advisor or cohort project name goes into any tracked file this phase writes.
- **D-09:** Acceptance is the Lawrence review standard (short, executive summary first, taught terms only, no tool or agent names, no tool-analysis section). One before and after fixture: the pre-fix fixture FAILS the check, the post-fix fixture PASSES it and is read against the rubric.
- **D-10:** The denylist is GENERATED from disk at check time and takes a `repoRoot` parameter (agents/*.md, data/command-registry.json, data/mcp-tool-connectors.json). No count and no agent name is frozen in code. Agent names, commands and tool ids are generated and never hand-kept. The hand-kept parts are the internal_terms of the contract (E1: named backends such as MCP, Neo4j, Brain, Theo, and the room file names), the soft_terms, the forbidden heading and body patterns, and the generic path, prefix and *Agent regexes in the module; each has a `why` or a code comment. A test fails if a hand-kept term equals a generated name. A test points `repoRoot` at a temp tree and watches the list grow and shrink.
- **D-11:** Owner decisions O1 to O9 (research, Open Questions) are the owner's. Plan 370-03 writes one card with an answer gate, every answer PENDING, and ends in ONE NEEDS_HUMAN line. No number is invented (O2). No answer is written by an executor.
- **D-12:** Every plan that acts on an owner answer starts with the answer gate (`370-gate.cjs`). A gate result of exit 1 stops the plan with a NEEDS_HUMAN line. Exit 2 means the owner chose KEEP for the governing item: the plan is declined or takes its KEEP branch, as its text says.
- **D-13:** Command frontmatter stays byte-stable (hitl_shape, connector block, produces, allowed-tools). Skill mirrors are regenerated with `scripts/build-skill-mirrors.cjs`, never hand-edited. No dist regeneration in this phase. A pinned string in `tests/test-265-deep-grade-rubric.cjs` moves only together with that test, with a note.
- **D-14:** Git and tree hygiene. `git add -f` on exact paths for new .planning files; `git commit --only <exact paths>`; never `git add -A`, `git stash`, `git reset --hard`, `--no-verify`; never push, tag or release. Executors do not edit STATE.md, ROADMAP.md or REQUIREMENTS.md. No em dashes or en dashes anywhere. A peer session may hold uncommitted files in this tree.
- **D-15:** Out of scope: the Academy feedback track (MindrianV2), the Theo MOS-LEARNING docs, and the other review writers (`grade-grant`, `grant-reviewer`, `vault-section-reviewer`, `chain-step-reviewer`). The contract file names `applies_to` for grade and deep-grade only (research O7 default, shown as a note on the card).
- **D-16:** Canon Part 8. The module and every script of this phase make no Brain call and no network call, and do not require `brain-client.cjs`. Violation output carries a rule id, a class and a line number only, never the matched text and never body text.
- **D-17:** Baselines that must not get worse: `tests/test-265-deep-grade-rubric.cjs` (8 pass, 0 fail), `tests/test-3696-reply-checks.cjs` (143 pass, 0 fail), `tests/test-383-sourced-number.cjs` (2 pass, 1 FAIL known as U1, 1 pending; the figure U1 is not caused by this phase and is not fixed here; new text uses placeholders), `node scripts/build-skill-mirrors.cjs --check`.

### Claude's Discretion (choices made by the planner, each stated where used)

- Module name and place: `lib/core/review-contract.cjs`; CLI wrapper `scripts/check-review-contract.cjs`; hook script `scripts/review-contract-hook.cjs`.
- Retry bound: a drafted review is rewritten and re-checked at most 3 times, then Larry refuses honestly in plain words (Decision 8, honest refusal) and files nothing.
- Classification of a review artifact is by frontmatter (`methodology: grade` or `deep-grade`, or a `review_contract:` key), never by path (research Pitfall 7). Gated by owner item O8.
- Wave numbering: GSD frontmatter waves start at 1. The brief's "Wave 0" is waves 1 and 2 here (tests first, then the module). The owner card is wave 3.
- Defaults for the notes O5, O7, O9 and the extra note N1 (shown on the card as notes, no machine line): O5 no taught-terms list is built and no taught-terms warning is added (no list exists; invent none); O7 the other review writers are out; O9 the `--full` roll-up stays chat-only and is never the filed review; N1 the Sci-Fi Connection and Visual Synthesis leave the reader-facing body (they sit outside the locked shape) and are not required of the agent.
- Terms `server`, `hook` and `index` stay OFF the denylist: they are plain words with high false-positive rates, and the ROADMAP list does not name them. `database` and `graph` are the two "soft terms" governed by owner item O3.
</decisions>

## Deviations from the ROADMAP and 370-INPUT.md text (recorded)

1. **No tone-filter extension.** 370-INPUT.md says to extend `lib/core/tone-filter.cjs`. Research measured it: it rewrites text and never fails, it is gated to professor, researcher or sensitive-domain audiences, and only `tests/test-205-decision-axes.cjs` loads it. A fail-closed check cannot be built on a rewriting filter. The reuse anchor is the never-say machinery in `lib/hmi/larry-reply-checks.cjs`. The Part 8 egress guard is a deny-pattern style precedent only; the new module does not import it.
2. **"Denylist lint" becomes "code check beside the output lints".** One pure function and one thin CLI wrapper, with the larry-reply-checks verdict shape.
3. **"Contract as data in the grading reference home" is split in two files.** Machine form `data/review-contract.json` (precedent: data/hitl-shape-declaration-schema.json); human form `references/methodology/grade.md` section "Review contract" (the file the Desktop `grade-venture` prompt loads). A drift test pins them. `references/methodology/deep-grade.md` does not exist; the prompt falls back to grade.md, so the contract stays in grade.md.
4. **"graph or database names".** Read as: product and compound names fail always (`knowledge graph`, `graph database`, `Neo4j`, `Memgraph`, `Cypher`, `SQLite`, `room.db`). The bare nouns `graph` and `database` are the soft terms; their policy (strict, exempt if the student's own text uses them, or compound only) is owner item O3. Until the owner answers, the shipped default policy is `strict`.
5. **Requirements** were "TBD". Minted by hand at plan time: REV370-01 to REV370-12 (registered in .planning/REQUIREMENTS.md).
6. **Tests live where the repo keeps them** (`tests/`, not shipped in the npm pack). The shipped check script therefore has a fixtures leg that runs only when `tests/` exists in the layout (see plan 370-10).

## Interface contract (shared by plans 370-01, 370-02 and every later plan)

`lib/core/review-contract.cjs` exports:

- `CONTRACT_VERSION` (number, 1).
- `loadContract({ repoRoot, contractPath, contract })` returns the contract object (from `contract` if given, else the file). Throws an Error with `code === 'REVIEW_CONTRACT_INVALID'` when a required key is missing.
- `buildDenylist({ repoRoot, contract })` returns `{ entries, counts }`. Each entry is `{ tier, class, label, source, flags }` (`source` and `flags` build the RegExp; `label` is the generated term text, used by tests and never printed in a violation). `counts` is `{ agents, commands, tools }`, read from disk each call. Tiers: H1 agent names (class `agent_name`), H2 commands (`command`), H3 tool ids (`tool_id`), H4 paths, file names and ids (`path_or_id`), E1 named backends (`backend_name`), S soft terms (`soft_term`).
- `splitArtifact(text)` returns `{ frontmatter, body, bodyStartLine }`. `frontmatter` is the text between the first two `---` fence lines, or `null`. Tolerates a BOM and CRLF. `bodyStartLine` is the 1-based file line of the first body line.
- `isReviewArtifact(text, { contract })` returns true when the frontmatter has `methodology:` equal to `grade` or `deep-grade`, or a `review_contract:` key.
- `checkReview(text, { repoRoot, contract, sourceText, softTerms })` returns `{ ok, violations, contract_version }`. `softTerms` is `'policy'` (default) or `'skip'` (the hook uses `'skip'`). Each violation is `{ rule, tier, class, line }` with a 1-based file line. Rule ids: `internal_name`, `shape_order`, `missing_section`, `extra_section`, `forbidden_section`, `forbidden_pattern`, `revision_points_count`, `cross_domain_count`, `cross_domain_position`, `length`, `reflection_questions_count`, `em_dash`. The result never holds matched text or body text.
- `collectSourceText(roomDir, { maxFiles, maxBytes })` returns the student-authored text of a room: `.md` files in section folders, bounded, symlinks skipped, excluding BRAIN.md, STATE.md, REASONING.md, ROOM.md, any file for which `isReviewArtifact` is true, and the folders `grades` and `deep-grades`.

`data/review-contract.json` top-level keys: `review_contract` (1), `applies_to`, `sections` (six objects `{id, heading}`, exact heading strings), `optional_tail` (ordered; an item has `{id, heading}` or `{id, heading_pattern}`; starts as the single item `advanced` with heading "For advanced students"), `forbidden_headings` (`{id, pattern, why}`, tested at every heading level), `forbidden_body_patterns` (`{id, pattern, why}`, starts empty), `counts` (`revision_points {min 3, max 5, under executive_summary}`, `cross_domain_ideas {max 2, marker "Cross-domain"}`), `limits` (starts `{}`; keys `body_words_max`, `reflection_questions_max`, `cross_domain_under`; a numeric value needs a string `limits_source` that starts with "370-DECISION.md O2"), `internal_terms` (E1 entries `{term, pattern, flags, why, exempt_if_in_source}`), `soft_terms` (`{policy, terms, why}`; policy is `strict`, `exempt_if_in_source` or `compound_only`), `owner_answers` and `enforcement` (both added by plan 370-04: `owner_answers` maps O1, O2, O3, O4A, O4B, O6A, O6B, O8 to the resolved option word; `enforcement` holds `door` (off or frontmatter), `hook_mode` (off, log-only or enforce), `doctor_severity` (off, advisory or blocker) and `source`).

Shape rules (mechanical, fence-aware for headings): `##` headings must equal the ordered `sections` list, then optional tail items in order, nothing else. A `#` title line and `###` sub-headings are free. Revision points are the list items under the Executive Summary heading. A cross-domain idea is a list item that starts with a bold label starting with the marker. The denylist scan does NOT skip fenced code (a leak inside a fence is still a leak). Text is normalized (NFKC, zero-width and soft-hyphen characters removed) before the scan; newlines are never removed, so line numbers stay true.

## Wave map

| Wave | Plan | What | Autonomous | Gate |
|------|------|------|------------|------|
| 1 | 370-01 | Tests RED first: fixtures, helper, runner with found-eq-0 guard, schema, denylist, rules tests | yes | none |
| 2 | 370-02 | Contract data and the pure module; tests GREEN | yes | none |
| 3 | 370-03 | Gate script and owner card 370-DECISION.md; ends in one NEEDS_HUMAN line | no | none |
| 4 | 370-04 | Apply the owner answers to the contract data | yes | G1, G2, G3 answered |
| 5 | 370-05 | `artifact_file` refusal in views.cjs | yes | O8 |
| 5 | 370-06 | Optional PreToolUse hook | yes | O6B and O8 |
| 5 | 370-07 | Internal record and rendered body: reference + grading agent | yes | G1 |
| 5 | 370-08 | Pre-file CLI wrapper | yes | G1, G2 |
| 6 | 370-09 | Render step and pre-file step in the two commands, mirrors | yes | G1 |
| 7 | 370-10 | Doctor coverage-gate entry and static template lint | yes | O6A |
| 8 | 370-11 | Close: Tri-Polar parity, acceptance record, runner registration | yes | none |

## Canonical References

- .planning/ROADMAP.md (Phase 370 entry), .planning/phases/370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude/370-INPUT.md, 370-RESEARCH.md, .planning/seeds/SEED-102-review-contract-grade-deep-grade.md
- lib/hmi/larry-reply-checks.cjs (NEVER_SAY_TERMS line 60, toolIds line 118, verdict line 243, findIdLeak line 527, findMachineryNarration line 564)
- lib/mcp/tools/views.cjs (fileArtifact line 176, refusal shape lines 185-196)
- scripts/doctor.cjs (coverage-gate gates[] near line 1230), scripts/write-scope-check.cjs (exit 2 blocks, fail open), lib/hmi/voice-style-log.cjs (appendVoiceStyleRow)
- tests/test-265-deep-grade-rubric.cjs, tests/run-all-265.sh (runner model), tests/test-261029-qef-hook-timeouts.cjs (hook record model)
- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-gate.cjs and 390-DECISION.md (answer gate and owner card model); 390-05-PLAN.md (card plan model)
- CLAUDE.md: Canon Parts 7, 8, 11, 12; Tri-Polar rule

## Deferred Ideas (OUT OF SCOPE)

- Academy feedback (MindrianV2) and Theo MOS-LEARNING docs (separate tracks).
- The other review writers (grade-grant, grant-reviewer, vault-section-reviewer, chain-step-reviewer).
- A taught-terms list and a taught-terms warning (note O5; no list exists).
- Fixing the pre-existing figure failure U1 in tests/test-383-sourced-number.cjs.
- Rewriting review artifacts already filed in users' rooms; the check applies to new filings only.
- Command-picker copy that says "100+ student calibration" (commands/deep-grade.md frontmatter; adjacent leak L11, frontmatter stays byte-stable).
</content>
