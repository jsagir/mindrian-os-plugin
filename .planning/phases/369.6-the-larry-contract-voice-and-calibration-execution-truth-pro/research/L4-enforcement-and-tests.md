# L4: enforcement and tests for Larry's voice and behaviour

Date: 2026-10-29. Lens L4. Read-only. Status marks: PROVEN (read or ran), UNVERIFIED, PENDING-HUMAN.

Path note (PROVEN): /home/jsagi/MindrianOS-Plugin holds only an empty .git/hooks stub and no files. The real dev repo is /home/jsagi/dev/MindrianOS-Plugin (branch release/beta.77-changelog-carry, HEAD ddf79f26d). All paths below are relative to that repo. The installed plugin (cache beta.75) ships no tests/ folder (ls shows 0 entries), so tests exist only in the dev repo.

## Question

What mechanically protects Larry's voice and behaviour today, what protects only the machinery, and which voice traits have no test? Does the memory claim "v1.15.beta.x made Larry less Larry through hard-fail compliance" hold against the code?

## Inventory table

| Protection | Type | File | Hard or judgment | Status |
|---|---|---|---|---|
| Voice section: 3-8 sentences, signature openers, the Reframe, hyphens only | prose | agents/larry-extended.md lines 43-53 | JUDGMENT | PROVEN prose only; no test counts sentences or finds a reframe |
| Cardinal Sin (never dump frameworks, never classify out loud) | prose | agents/larry-extended.md line 95-97; skills/larry-personality/SKILL.md | JUDGMENT | PROVEN prose. tests/test-359-prose-budget.cjs only uses the heading as a section boundary (line 28, 93) |
| Never Do / Always Do (no "Great question") | prose | agents/larry-extended.md lines 155-165 | JUDGMENT | PROVEN prose. Only a Plurai CSV row models it (see below) |
| Voice glyph opens every turn (5 De Stijl squares) | Stop hook, LOG ONLY | scripts/check-voice-style.cjs (header: "NEVER blocks", rung 2) | JUDGMENT in effect (evidence log) | PROVEN; writes ~/.mindrian/voice-style.jsonl |
| Hyphens-only rule | same Stop hook, LOG ONLY | scripts/check-voice-style.cjs | JUDGMENT in effect | PROVEN |
| Glyph detector and mapping (markForMove, detectVoiceMark, spoof rejection) | unit test | tests/test-larry-voice-mark-182.cjs, test-243-voice-glyph-honest.cjs, test-205-voice-mark-hybrid.cjs, test-voice-glyph-advisory.cjs, test-stance-voice-glyph-override.cjs, test-voice-transition-detection-187.cjs, test-298-voice-log.cjs | HARD-FAIL on the machinery (build or test run) | PROVEN, all green (see runs) |
| Voice-contract score in APO lab (veto softened to score) | lab code plus test | lab/apo/apo-loop.cjs; tests/test-voice-contract-signal.cjs, test-202-voice-contract-gate.cjs | HARD-FAIL on lab selection logic only; not on live replies | PROVEN green |
| Turn-1 voice rubric (first person, <=8 sentences, signature opener, no emoji, no /mos:, no dashes) | live-model test | tests/test-114-turn-1-voice.sh, tests/fixtures/114-larry-voice-rubric.md | JUDGMENT (silently skips) | PROVEN: exits 0 when claude CLI missing, flag missing, env MINDRIAN_SKIP_LIVE_CLAUDE=1, call fails, or empty reply |
| Default activation, persona_variants frontmatter (9 keys plus default), agent body documents them | static test | tests/test-114-larry-default-activation.sh, test-115-persona-variants.sh | HARD-FAIL on file shape | PROVEN green |
| Persona route, ignite persona seed, persona override seam | unit test | tests/test-265-persona-route.cjs, test-bch-17-ignite-persona.cjs, test-persona-override.cjs | HARD-FAIL on routing logic | PROVEN green |
| Post-gate handoff seam (suggest, gate, wait; auto-sequence halts on material step) | doctrine plus logic test | tests/test-356-larry-contract.cjs, test-larry-handoff-seam.cjs | HARD-FAIL on doctrine presence and halt logic | PROVEN green |
| Elevation doctrine floor, frozen six, circularity | doctrine-presence test | tests/test-205-elevation-doctrine-floor.cjs, test-205-frozen-six-guard.cjs | HARD-FAIL on text presence | PROVEN present (not run here) |
| Stop-hook card gate (declared fork must fire a card) | Stop hook, BLOCKS turn | scripts/check-card-fire.cjs (decision:block envelope, line 13); lib/core/gate-relevance.cjs | HARD-FAIL, bounded (retry ceiling, session ceiling, yes/no exemption, already-answered) | PROVEN code; related tests mostly green, one stale (see runs) |
| Card before answer (gate_answer PreToolUse) | PreToolUse hook, denies | scripts/card-before-answer-hook.cjs; tests/test-mux-card-before-answer.cjs | HARD-FAIL | PROVEN; 2 of 19 assertions fail in my copy (see runs) |
| ASCII box ban, declared-implies-rendered | local judge | tests/test-209-card-fire-gate.cjs, test-209-backstop-tuning.cjs, test-238-card-fire-corpus.cjs | HARD-FAIL on corpus | PROVEN green |
| UI compliance (4 zones, glyph vocabulary, /mos:doctor --ui-compliance) | doctor module plus output style | output-styles/destijl.md; tests/test-doctor-ui-self-compliant.cjs, test-hmi-compliance-e2e.cjs; scripts/hmi-compliance-poll.cjs (Stop) | HARD-FAIL for doctor self-compliance; Stop hook only reports | PROVEN; e2e has 1 stale failure |
| Output-style voice rules ("CLI Larry": terse, no "Great question") | prose | output-styles/destijl.md lines 53-55 | JUDGMENT | PROVEN prose. Note: this style says terse and structural; larry-extended says warm and conversational. They pull apart |
| Larry pedagogy voice eval (7 labelled rows: compliant versus violation) | Plurai CSV judge | evals/plurai/02-larry-pedagogy-voice.csv (8 lines incl. header); evals/plurai/09-apo-output-voice.csv | JUDGMENT (offline, not referenced by any test or script: grep over tests, scripts, lib, .github finds no caller) | PROVEN unwired. Memory note says Plurai is dead; evals should run through Jev. Not run |
| Voice-style promotion check (log to enforce) | doctor module | lib/core/doctor/voice-style-log-module.cjs, lib/hmi/voice-style-log.cjs::evaluatePromotion | JUDGMENT (computes a verdict, enforces nothing) | PROVEN code |
| Theo tools persona_card, larry_move | MCP tools | remote Theo | ABSENT locally | UNVERIFIED; not read (remote service, and plugin lens scope) |
| First-reply shape: one acknowledgment, one reframe, one question | none | none | ABSENT | PROVEN: grep for "Cardinal Sin\|3-8 sentence\|Very simply\|escape hatch\|great question" across tests, evals, lab found no assertion on live reply shape other than the 114 rubric (skips) and the unwired Plurai CSV |

## Test run results

Method: copied the dev repo to a scratch folder (excluded .git, .planning, node_modules symlinked, ui, dist, dashboard), set HOME to a scratch dir, set MINDRIAN_SKIP_LIVE_CLAUDE=1, ran each with `timeout 120 node <file>` (or `bash <file>`) from tests/. Nothing was written to the dev repo. Caveat: the copy lacks ui, dist, dashboard and git history, so failures that depend on those may be copy artifacts; I mark that below.

| Test | Command | Exit | Result |
|---|---|---|---|
| test-356-larry-contract.cjs | node | 0 | PASS (11 checks) |
| test-202-voice-contract-gate.cjs | node | 0 | ALL PASS (LLM leg skipped offline) |
| test-breakthrough-d17-voice-audit.cjs | node | 0 | pass |
| test-larry-handoff-seam.cjs | node | 0 | pass (Node warning about BEHAVIORAL_CHANNEL_CEILING property, non-fatal) |
| test-voice-glyph-advisory.cjs | node | 0 | 4 passed, 0 failed |
| test-243-voice-glyph-honest.cjs | node | 0 | 18 passed, 0 failed |
| test-larry-voice-mark-182.cjs | node | 0 | Failed: 0 |
| test-205-voice-mark-hybrid.cjs | node | 0 | PASS (7 assertions; LLM only for the single-glyph beat) |
| test-voice-contract-signal.cjs | node | 0 | 3 passed, 0 failed |
| test-stance-voice-glyph-override.cjs | node | 0 | PASS |
| test-voice-transition-detection-187.cjs | node | 0 | Failed: 0 |
| test-298-voice-log.cjs | node | 0 | 10 passed, 0 failed |
| test-209-card-fire-gate.cjs | node | 0 | PASS (7) |
| test-209-backstop-tuning.cjs | node | 0 | PASS (13) |
| test-238-card-fire-corpus.cjs | node | 0 | PASS (32) |
| test-198-stop-gate-retry-ceiling.test.cjs | node | 0 | PASS (15) |
| test-doctor-ui-self-compliant.cjs | node | 0 | 4 passed |
| test-persona-override.cjs | node | 0 | 5/5 |
| test-265-persona-route.cjs | node | 0 | PASS=33 FAIL=0 |
| test-bch-17-ignite-persona.cjs | node | 0 | PASS |
| test-reverse-salient-persona.cjs | node | 0 | pass |
| test-larry-theo-face-apps.cjs | node | 0 | 2 checks passed |
| test-114-larry-default-activation.sh | bash | 0 | 4 of 4 |
| test-115-persona-variants.sh | bash | 0 | 7 of 7 |
| test-114-turn-1-voice.sh | bash (MINDRIAN_SKIP_LIVE_CLAUDE=1) | 0 | SKIPPED, counts as pass. Would call `claude --print`, so I did not run it live |
| test-card-fire-relevance-gate.cjs | node | 1 | 6 passed, 5 failed. The 5 RED legs are labelled "EXPECTED until plan 210-05", but plan 210-05 has a SUMMARY. Actual reason returned is `backstop-uncorroborated-by-side-channel` (check-card-fire.cjs line 652), a later relaxation, so the test is stale. Leg 3 (genuine fork must still intercept) reports false; PROVEN the assertion fails, UNVERIFIED whether the real hook still intercepts a genuine fork without a side-channel signal |
| test-hmi-compliance-e2e.cjs | node | 1 | 10 passed, 1 failed: "expected 4 Stop entries, got 8". Stale test (Stop block has 8 entries in hooks/hooks.json) |
| test-mux-card-before-answer.cjs | node | 1 | PASS=17 FAIL=2. S3: lib/mcp/startup-operations.cjs mintGate site stores no renderer (likely real). D1: skill mirror "dashboard (MISSING)" (likely copy artifact, dashboard folder excluded) |
| test-statusline-glyph-isolation.cjs | node | 1 | Fails on .mindrian/brain-substrate-cache.json containing emoji. File is gitignored (.gitignore line 41); copy artifact, not a repo defect |

Not run: the live `claude --print` leg of test-114-turn-1-voice.sh, the LLM legs of tests 202 and 205, any Plurai or Jev eval.

Field evidence (PROVEN, ~/.mindrian/voice-style.jsonl, 9042 rows, epoch ms 1788876153269 to 1793262142856): policy_id counts include voice-glyph-present 284, voice-hyphens-only 235, voice-fork-as-card 1104, plus gate-policy rows. The rows record violations but cannot say how many Larry turns there were (no denominator), and some may be non-Larry turns. UNVERIFIED rate.

## Verification of the enforcement regression watch note

Claim (feedback_1_15_enforcement_regression_watch.md): v1.15.beta.x turned Larry voice behaviours into HARD-FAIL/BINDING checks (Phases 178, 182, 192, 202, 205, 209), which made Larry feel mechanical.

- PARTLY CONFIRMED as history: PROVEN that Phase 210 (".planning/phases/210-*", CONTEXT lines 8-20) was created to undo exactly these, and its 7 plans all have SUMMARY files.
- REFUTED as present state for the voice: PROVEN that tests/test-voice-contract-signal.cjs passes (veto became score), test-voice-glyph-advisory.cjs passes (glyph softened), and the live voice check scripts/check-voice-style.cjs is explicitly log only and never blocks. Numbered-prose forks no longer force-fire (test-card-fire-relevance-gate legs 6-8 pass; the backstop arm is retired).
- STILL PRESENT: the Stop-hook card gate can still block a turn (check-card-fire.cjs line 13, 600-605) for a declared fork with no card. It is bounded (retry and session ceilings, yes/no exemption).
- NEW FINDING, opposite direction: enforcement was softened on the machinery, but nothing replaced it for the voice itself. The things that would keep Larry sounding like Larry (reframe, one question, warmth, no framework dump, 3-8 sentences) were never hard-fail and are not tested either. So erosion is now free of friction: the log shows 284 missing-glyph rows and nothing acts on them.
- Open: whether the 5 stale RED legs hide a real regression in the "genuine fork still intercepts" floor. UNVERIFIED.

## Gaps

1. Machinery tested, voice not. Glyph, mapping, spoof rejection, transition debounce: heavily tested (7+ files). Reframe, Cardinal Sin, 3-8 sentences, signature openers, "warm but demanding", no sycophancy, first-reply shape, escape hatch: zero running assertions.
2. The only voice-shape tests are (a) test-114-turn-1-voice.sh, which skips silently and returns exit 0 in every degraded case, and (b) 02-larry-pedagogy-voice.csv, which has 7 rows, is Plurai-bound (service reported dead in owner memory) and is called by nothing.
3. Rubric 4 of the 114 rubric ("no emoji", Unicode category So) contradicts the Part 12 glyph mandate: a leading colored square is category So. If the live leg ran against a glyph-opening reply it would fail. PROVEN by reading test-114-turn-1-voice.sh lines 85-95 and agents/larry-extended.md lines 55-66. UNVERIFIED by live run.
4. Rubric 3 (reply must start with a signature opener prefix) also conflicts with the rule that every reply starts with the glyph then "Larry | MindrianOS".
5. Two voice definitions conflict: output-styles/destijl.md "terse, structural, no conversational filler" versus larry-extended "conversational, warm". No test arbitrates.
6. Persona-variant tests check frontmatter shape (9 keys plus default) but 7 of 10 variants are the identical default string (agents/larry-extended.md lines 14-23), so variants differ in only 3 cases. Shape is protected; difference is not.
7. No test reads the persona_card or larry_move output; Theo-side persona is outside local protection. UNVERIFIED.
8. Voice log has no denominator and no promotion trigger wired to a block; evaluatePromotion exists but nothing consumes it to act.
9. Stale or broken guards that reduce trust: test-card-fire-relevance-gate (5 stale REDs), test-hmi-compliance-e2e (Stop count), test-mux S3.
10. "Powered by Claude" in larry-extended line 40 versus the MCP server instruction "never claim Claude or GPT without host evidence": identity wording is not tested for agreement. UNVERIFIED which text the user sees.

## Proposed tests

Smallest set (8). "Offline" means pure string/regex or fixture checks, no model.

1. test-larry-voice-shape-offline.cjs. Asserts, over a fixture corpus of labelled replies (reuse and extend 02-larry-pedagogy-voice.csv rows into tests/fixtures/larry-voice-corpus.json): sentence count 2-8 for compliant rows, no banned sycophancy phrases ("Great question", "I'd be happy to help", "It's important to note"), no numbered framework list at turn 1, no dashes U+2013/U+2014, exactly one question mark in the final sentence for a first reply. Offline. Fails if the corpus rows are mislabelled by the checker. Hard-fail.
2. test-larry-first-reply-contract.cjs. Pure function checkFirstReply(text): glyph then "Larry | MindrianOS", one acknowledgment sentence, one reframe pattern ("But what if", "That's not a problem", "What's the problem"), one closing question. Tested against 6 good and 6 bad fixtures. Offline. Becomes the shared checker for tests 1, 5 and the Stop hook.
3. test-larry-doctrine-presence.cjs. Asserts agent body and SKILL still contain the load-bearing strings: Cardinal Sin heading and "NEVER dump frameworks", "3-8 sentences", signature openers list, the Reframe, escape hatch wording, "Never Do" anti-sycophancy list; and that voice-dna.md and larry-extended agree on the sentence band. Offline. Catches silent prose deletion (the most likely erosion path).
4. test-voice-rubric-glyph-consistency.cjs. Asserts tests/fixtures/114-larry-voice-rubric.md and test-114-turn-1-voice.sh do not contradict the glyph mandate (rubric 3 and 4 allow a leading De Stijl glyph and label). Offline. Fixes gap 3 and 4.
5. test-114-turn-1-voice live leg, rewritten to fail loudly. Keep live, but exit non-zero in CI when `LARRY_VOICE_REQUIRE_LIVE=1` and the model is unreachable; use checkFirstReply from test 2. Needs a live model.
6. test-larry-persona-variants-distinct.cjs. Asserts the variants that the persona tests claim as distinct (founder, researcher, investor) differ from default, and the count of identical variants stays at or below a recorded ceiling. Offline.
7. test-voice-log-denominator.cjs. Asserts check-voice-style.cjs also appends a turn-count row (or the log module exposes violations per Larry turn) so a rate exists, and that doctor reports the rate and flags above a set threshold as a warning, not a block. Offline with fixture transcripts.
8. test-larry-judge-eval (live, Jev). Run the corpus from test 1 through the Jev judge (not Plurai) for the tonal traits rule-checkers cannot see: warm but demanding, reframe quality, no framework dump on first contact, escape hatch honoured when the user says "just tell me". Needs a live model. Run nightly or at release, report-only gate with a baseline file like evals/plurai/*-baseline.json.

Also repair, not new: refresh test-card-fire-relevance-gate (flip the 5 stale REDs to the shipped contract or restore the intercept), update the Stop-count constant in test-hmi-compliance-e2e, fix the mintGate renderer at lib/mcp/startup-operations.cjs if S3 reproduces in the real repo.

## What cannot be verified

- Live behaviour of Larry in a real session: I did not call any model. Every voice claim above is about code and tests, not about how replies sound. PENDING-HUMAN: owner listening test against the Lawrence style guide.
- Whether the failures in test-mux D1 and test-statusline-glyph-isolation reproduce in the real repo (my copy omitted dashboard, ui, dist and used a cached .mindrian file). Rerun in the dev repo by the owner or an executor with write permission.
- Whether the card gate still intercepts a genuine fork with no side-channel corroboration (test leg 3 fails; cause not traced).
- The rate of voice violations (no denominator in ~/.mindrian/voice-style.jsonl) and which rows came from non-Larry turns.
- Theo persona_card and larry_move behaviour (remote), and whether Plurai or Jev currently run the pedagogy eval.
- Prior-version comparison: I did not run these tests against pre-1.15 commits, so "less Larry since 1.15" is not measured, only the enforcement history is read.
