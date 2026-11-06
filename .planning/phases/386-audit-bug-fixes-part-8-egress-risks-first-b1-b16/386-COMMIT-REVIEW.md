# Phase 386 commit review for the push gate

Nothing was pushed, tagged or released. The main session reviews every commit ahead of origin before any push. A fix on main is not live until a release carries it and a user updates.

guard-fingerprint: c0ece99d22d55a53f35273eaa34ce88ca2d106a8fe31e7b159af17144e2d0551
guard-commit: 73d6cef3c
plugin-version: 2.0.0-beta.80

The release which carries this fingerprint carries this guard, and the release notes must quote it. The fingerprint is a sha256 over the git blob hashes of 11 guard files at the guard commit (brain-client, brain-response-sanitize, cross-room-aggregator, part8-egress-guard, part8-room-lexicon, research-planner/audit-ledger, research-planner/egress-policy, rs-egress-prompts, web-path-gate, part8-egress-guard-hook, web-credential-guard-hook).

accepted-sprout-negatives: X8
probe-private-sprouts-released: C:negatives:X8 C:plurai:24 C:plurai:26 C:plurai:29 C:plurai:31
deferred: newline-split words beating the deny list on non-question tools (auditor claim, not verified, not planned in Phase 386)
deferred: a check against the released version is only the recorded fingerprint above, not a doctor check or a release gate

## Not fixed

Rows of 386-OUTCOMES.md whose status is not FIXED:

S3: NOT-MEASURED BEGIN IMMEDIATE on the database open path is a source observation. No lock contention was measured, so the finding is not closed from average open times. No work item in this phase.
B3-OP: HANDED-OFF plans 07 and 08. Owner decision unwire (2026-11-06): the operator state feature stays off. Plan 386-08 is a recorded skip (the repair did not run). Plan 385-12 item R2 holds the ruling for the PostToolUse and UserPromptSubmit entries. No product change in this phase.
B12: SKIPPED plan 20. Owner decision option-a (2026-11-06): keep lib/core/temporal/supersession-gate.cjs as a documented, tested planned contract. No wire, no removal, no code change. Plan 385-12 item R9 records the same ruling. Phase 350 has no owner and no date.
B15: HANDED-OFF plan 17 to Phase 385 plan 385-11. The plan 386-17 RCA verdict is NO SIGNAL (the host sets no CLAUDE_TOOL_COMMAND and lists no SlashCommand tool). Owner decision 2026-11-06: the command-invocation telemetry is not rebuilt on UserPromptExpansion. Plan 385-11 removed the dead SlashCommand hook (commit 33c004d2a). No product change in this phase.
E-PINE: HANDED-OFF plan 38 to Phase 385 plan 385-12. Owner decision option B (2026-11-06): lib/core/pinecone-inference.cjs is DEAD (0 runtime callers); the owner states the build does not use Pinecone, so it is a removal candidate. No product change in this phase.

No row is PENDING-DECISION, PARTIAL or DROPPED. B8 and B10 were reproduced, so they are FIXED, not DROPPED.

## Test and gate runs on the final tree (guard commit 73d6cef3c)

All runs used `< /dev/null` and a timeout. No background suite was started by this plan. Two stale background suite runs from other work existed on the machine and were not touched.

| Command | Exit | Result |
|---------|------|--------|
| bash tests/run-all-386.sh | 0 | PASS=37 FAIL=0 SKIP=0. The shape test, the probe gate, the sprouts-required test, the split-route test and the audio disclosure test are PASSED. The probe gate printed no SKIP line. |
| bash tests/run-all-196.sh | 0 | Passed 7, Failed 0 |
| node tests/test-3692-guard-survey-gate.cjs | 0 | GATE PASS; 26 positive, 522 extended and 10 negative strings measured against the baseline; 0 fetch calls |
| bash tests/run-all-245.sh | 0 on the second run | The first run was PASS=18 FAIL=1 (test-245-egress-contentless, one arm saw class room_check_skipped for the plain-question classify call). The same test passed 3 of 3 alone and the rerun was PASS=19 FAIL=0. Treated as a load flake while other suites ran; cause UNVERIFIED. |
| bash tests/run-all-3692.sh | 1 | PASSED=70 FAILED=3. The 3 failures are the known reds: rs-fetcher academic, mux card before answer, no new dependency (flexsearch). |
| bash tests/run-all-252.sh | 1 | test-252-guard-census: census.1 and census.5b fail. Known reds. The unclassified guard files named by census.1 are lib/core/doctor/research-providers-module.cjs, lib/lens-engine/source-lens-driver.cjs and scripts/session-verify-probe.cjs; none was added by this phase. |
| bash tests/run-all-366.sh | 1 | PASSED=75 FAILED=1. The failure is the leg 380 gate wiring (the face panel line is not in the latest released section). Known red. |
| node scripts/build-connector-registry.cjs --check | 0 | OK |
| node scripts/build-orchestration-projection.cjs --check | 0 | OK |
| node scripts/check-render-coverage.cjs | 0 | 198 wired, 2 excluded, 0 unwired |
| node scripts/doctor.cjs --acceptance | 0 | 25/25 points passed |

Known pre-existing reds, not caused by this phase (listed by the owner of the run, not re-run on the commit before the first 386 commit): test-252-guard-census census.1 and census.5b; check-pending-breakthrough Test 12; test-237-autonomy-parity Leg 5; test-connector-tier-d-hooks CHECK 4; test-connector-part8-boundary CHECK 2; run-all-179 leg 179-08; test-244-doctor-fts-health; test-359-prose-budget; run-all-341 four release-step tripwires; run-all-366 leg 380 gate-wiring; run-all-3692 (rs-fetcher academic Springer api_key, mux card-before-answer, no-new-dependency flexsearch). Also failing before and after plan 386-47: test-233-graph-heal-pipeline (G3 control) and test-237-approve-executes (arm 7). Those suites were not all re-run by plan 386-21.

One failure this phase caused and fixed in this plan: 7 tests read their RCA file at the old path after the close-out moved the file to .planning/debug/resolved. Commit 73d6cef3c makes each test try both paths. run-all-386 is green after it.

CHANGELOG.md and .planning/debug/knowledge-base.md already held em dashes from older entries (107 and 4 lines). This phase added none.

## Part 8 principle check

Owner principle of 2026-11-06 (PRD): sprouts go out, bodies stay, never cripple contextualised work; credentials always block. Every plan that adds or changes a block rule was reviewed.

| Plan | What it adds or changes | Principle check | Result | Final outcome |
|------|-------------------------|-----------------|--------|---------------|
| 04 | brain_write blocked by tool name | stores data, not a query sprout; the PRD keeps it blocked | consistent | B2: FIXED |
| 05, 22, 23, 24 | approval card, credential check and audit record on the 3 older web paths | credential only, no word list; owner decision of 2026-11-06 | consistent | S2: FIXED; E-GATE: FIXED; E-GG: FIXED; E-RS: FIXED |
| 03, 35 | RCA and decision record; lazy require | no content scan; no verdict change | consistent | S2: FIXED; E-LAZY: FIXED |
| 25 | allow arms for typed read tools | handles by exact shape; free text decided as brain_ask decides it (parity), so no new leak; the sprout bypass waits for the owner decision | consistent | E-TYPED: FIXED |
| 26, 27, 42 | ambiguous, body and private-claim text get the typed outcome sprouts_required and a split guide | context-based, not a bare block: the host model breaks the text into typed claims, keeps the room claims local, sends only sprouts; sprouts proceed; the response never echoes the text | owner decision option-e | E-AMB: FIXED; E-SPROUT-DESIGN: FIXED |
| 28 | job key parity, exact packet keys | adds no block; arms compare verdicts | consistent | E-JOB: FIXED |
| 29, 30 | fail closed when the guard cannot run, plus one count-only outage line | outage rule; a broken guard blocks sprouts too; the outage line holds a timestamp, the tool-name class and the failure mode, never payload | owner decision (option A and the outage line, 2026-11-06) | E-FAIL: FIXED |
| 31 | credential shapes always block; money, percent and k-suffix patterns removed | a word list on ordinary keywords is the wrong tool | narrowed; money turned into an owner decision in plan 32 | E-KEY: FIXED |
| 32, 33 | over-blocking fix (option-e) | sprout bypass, a body, an edge that fails a prose rule and a private-marker sprout answered sprouts_required, bodies keep narrowed rules, credentials and structured identifiers always block; the accepted ids are pinned in the test and the gate baseline; the owner acknowledged the residual exposure (owner_ack: yes) | owner decision, shape design | E-OVER: FIXED |
| 36 | credential-only hook for web lines | no content check | consistent | E-WEBHOOK: FIXED |
| 34 | strengthened tests | no verdict change; they assert the final verdicts and the exact class sprouts_required | consistent | E-TEST: FIXED |
| 47 | no move-aside of room.db for a false unreadable | no egress; the open path and migration safety unchanged; the recovery moves a file only for a real not-a-database file | consistent | B19: FIXED |
| 46 | obfuscated email and international phone-like forms | extends the always-block identifier rules only; shape-bound patterns measured against the corpora; money forms stay body-only | consistent | E-IDENT: FIXED |
| 43 | guidance for the persona, skills and references | guidance only; teaches the sprout rule and the refusal handling | consistent | E-SPROUT-GUIDE: FIXED |
| 44, 45 | B17 section table and B18 room.db message | no egress; B18 changes no open mode without an owner decision | consistent | B17: FIXED; B18: FIXED |
| 37 | sprout and body shape helper | no verdict change | design basis | E-SHAPE: FIXED |
| 38 | Pinecone inference dead or live | decision only | owner decision | E-PINE: HANDED-OFF |
| 39, 40 | audit probe fixtures and the probe gate | tests and data only; no verdict change; they pin the post-fix verdicts and name every private-claim sprout that leaves as written | consistent | E-PROBE: FIXED |
| 41 | audio disclosure lines (Modulate) | a disclosure, not a gate; the audio file is a whole body of data and the owner chose to leave it and document it (2026-11-06) | owner decision | E-MODULATE: FIXED |
| A2-1 to A2-4 (second audit) | gates for the Anthropic-key features (wiki briefing, chat, entity classifier and similar) | outside this phase by the principle; the plan 01 RCA note is the only record | no work item | no row |

## Commits

Range: the parent of 107126158 (the first Phase 386 commit) to 73d6cef3c, filtered to subjects that contain 386. A commit without a 386 plan label is marked UNEXPECTED. A file outside the files_modified list of its plan is marked UNEXPECTED (this list is a path or folder prefix check; plans list files loosely, so the marks are a prompt to look, not proof of a problem). The commit that adds this file is not in the list.

The 5 commits without a plan label are planning-document commits (phase and roadmap setup, a record of later owner decisions, the audit delta) and are expected to be reviewed as such.

- 107126158 docs(385,386): add cleanup and audit-bug phases with PRDs and auditor findings source  [UNEXPECTED (no 386 plan label)]
  files: .planning/ROADMAP.md, .planning/audits/AUDITOR-FINDINGS-source.md, .planning/phases/385-behaviour-preserving-cleanup-remove-what-does-nothing-audito/385-PRD.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-PRD.md
- d5968db9c docs(386): plan audit bug fixes, Part 8 egress risks first (B1-B16, 21 plans)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-01-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-02-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-03-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-04-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-06-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-07-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-08-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-09-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-10-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-11-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-12-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-13-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-14-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-15-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-16-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-17-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-18-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-19-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-20-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md
- 33aa80aba docs(386): revise plans after plan-checker pass
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-09-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-10-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-11-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-12-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-13-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-14-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-16-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-18-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md
- 91cfc081d docs(386): second plan revision (anchored verdict, skip rules, hidden CHANGELOG tags)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-06-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-08-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-15-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-17-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-19-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md
- f2c7505e0 docs(385,386): roadmap goals and plan counts, CLEAN385 requirements  [UNEXPECTED (no 386 plan label)]
  files: .planning/REQUIREMENTS.md, .planning/ROADMAP.md
- 075e15d62 docs(386): file the auditor egress audit final message as source
  files: .planning/audits/AUDITOR-FINDINGS-source.md
- e7c0b315d docs(386): check the auditor egress claims against the repo
  files: .planning/audits/EGRESS-CLAIMS-CHECK.md
- a4969e25b docs(386): record owner egress ruling and audit additions in the PRD
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-PRD.md
- 4b6233ce1 docs(386): add egress audit plans 22-34, record the owner decision, update the close plan
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-03-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-22-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-23-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-24-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-25-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-27-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-28-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-29-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-30-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-31-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-PLAN.md
- e83c30410 docs(384): record later owner decisions (split doctor gate, Eureka option A, 386 hardening)  [UNEXPECTED (no 386 plan label)]
  files: .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/384-OWNER-DECISIONS.md
- 8bee5f739 docs(386): revise plans after the checker pass, add plans 35 (lazy import) and 36 (web credential hook)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-22-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-23-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-24-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-25-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-27-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-28-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-29-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-30-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-31-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-35-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md
- c283c5093 docs(386-01): RCA for the shadowed BYOAPI chat proxy in the wiki server (B1)
  files: .planning/debug/wiki-server-shadowed-byoapi-chat-proxy-latent-part8-egress.md
- 3565a7c60 docs(386-03): re-verify Semantic Scholar RCA and reproduce on a fixture room
  files: .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
- 5f157ca22 docs(386-03): record owner decision option A for the Semantic Scholar path
  files: .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
- 794c02fa7 test(386-01): pin B1 no BYOAPI proxy and a reachable pdf route (RED)
  files: tests/run-all-386.sh, tests/test-386-wiki-no-byoapi-proxy.cjs
- ef2b01749 docs(386-03): add plan summary for the Semantic Scholar RCA
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-03-SUMMARY.md
- d5ffb7330 docs(386): checker second pass on plans 35 and 36
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-35-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md
- 89fac7b2b fix(386-01): remove the shadowed BYOAPI chat proxy and make the pdf route reachable
  files: lib/wiki/wiki-server.cjs
- acc4940bb docs(386-02): RCA for B2, brain_write ambiguous verdict proceeds on the whitespace pipeline
  files: .planning/debug/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md
- 42212a152 docs(386-02): partial summary, RCA done, owner decision pending
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-02-SUMMARY.md
- 65c97e89e docs(386-01): record the B1 resolution in the RCA
  files: .planning/debug/wiki-server-shadowed-byoapi-chat-proxy-latent-part8-egress.md
- f2cbd59c8 docs(386-01): summary for the B1 wiki BYOAPI proxy fix
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-01-SUMMARY.md
- a90dcf141 docs(386-02): record owner decision option A for B2, mark plan complete
  files: .planning/debug/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-02-SUMMARY.md
- fc151a874 docs(386): record the owner's Part 8 principle (sprouts out, bodies stay) in the PRD
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-PRD.md
- e155a9bfd docs(386): review the plans against the owner Part 8 principle, add plans 37 (sprout/body shape) and 38 (Pinecone decision)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-04-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-25-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-27-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-28-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-29-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-30-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-31-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-37-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-38-PLAN.md
- d082d322a docs(386-12): RCA for B8, verdict REPRODUCED (FEYNMAN.md counted as an artifact by the stale rule)
  files: .planning/debug/dial-memory-rewrite-marks-sections-stale.md
- cf6f0d2d7 docs(386-06): RCA for registry readers that never resolve the keyed shape
  files: .planning/debug/registry-readers-legacy-shape-never-resolve.md
- 38df8b772 test(386-04): pin B2 brain_write blocked and no room text sent (RED)
  files: tests/test-386-b2-brain-write-blocked.cjs
- 717ae8343 docs(386-17): RCA for B15, the SlashCommand telemetry hook has no host signal (handed to 385-11)
  files: .planning/debug/telemetry-command-invocation-env-var-never-set.md
- 1f8cbd42a docs(386-17): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-17-SUMMARY.md
- 85e3cee25 test(386-12): pin that a dial-memory refresh does not mark sections stale (RED)
  files: tests/test-386-dial-memory-stale.cjs
- 73997c440 test(386-06): pin registry readers on the keyed shape (RED)
  files: tests/test-386-registry-readers.cjs
- 7f92d560f docs(386-07): RCA for the dormant operator-update registry read (B3)
  files: .planning/debug/operator-update-registry-read-dormant-feature.md
- 3d1f47fed fix(386-12): a dial-memory refresh no longer marks an unchanged section stale  [UNEXPECTED files outside the plan list: lib/core/folder-memory-async.cjs, lib/core/folder-memory.cjs]
  files: lib/core/folder-memory-async.cjs, lib/core/folder-memory.cjs
- 39ffbc2c0 docs(386-12): RCA resolution for B8
  files: .planning/debug/dial-memory-rewrite-marks-sections-stale.md
- c7dd771bd docs(386-12): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-12-SUMMARY.md
- 3e4ac78ea docs(386): checker fixes on the sprout rule (accepted sprout negatives, owner sees the leak risk, parity route for typed free text)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-03-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-22-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-23-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-24-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-25-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-35-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-37-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-38-PLAN.md
- 33af7ee46 fix(386-06): resolve the active room through the canonical resolver in 3 readers
  files: lib/hmi/across-session-memory.cjs, scripts/hmi-status-command.cjs, scripts/memory-completion-detector.cjs
- 45996dab4 docs(386-06): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-06-SUMMARY.md
- 846bfa48e docs(386-20): RCA for the unwired supersession gate (B12)
  files: .planning/debug/supersession-gate-no-runtime-caller.md
- 772b4e026 docs(386-13): RCA for B10, verdict REPRODUCED (tier1 chosen from NEO4J_URI with no driver)
  files: .planning/debug/rs-fetch-neo4j-uri-typeerror-instead-of-sqlite-fallback.md
- 696b9ce3a test(386-13): pin the SQLite fallback when the Aura writer is unreachable (RED)
  files: tests/test-386-rs-fetch-neo4j-fallback.cjs
- cf1914cd1 fix(386-13): fall back to SQLite when the Aura writer fails
  files: scripts/rs-discovery-engine.cjs
- e7d7e3ca8 docs(386-13): RCA resolution for B10
  files: .planning/debug/rs-fetch-neo4j-uri-typeerror-instead-of-sqlite-fallback.md
- 989a3eeed docs(386-38): RCA for the Pinecone inference module, verdict DEAD (A2-5)
  files: .planning/debug/pinecone-inference-dead-or-live.md
- d14709d42 docs(386-13): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-13-SUMMARY.md
- e6ab6286b docs(386-18): RCA for B16, graph-doctor reads ctx.roomDir that the doctor engine never sets
  files: .planning/debug/graph-doctor-module-ctx-roomdir-never-set.md
- 0d6fa0e2d docs(386-09): RCA for the dev-clone topology probe environment
  files: .planning/debug/session-start-env-assignment-after-node-e-dev-clone-branch-dead.md
- 64d65d7d3 docs(386-33): exactness check for accepted_sprout_negatives, state option B and C
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md
- a9c756075 test(386-09): pin the dev-clone topology probe environment (RED)
  files: tests/test-386-session-start-topology-env.cjs
- 17ab325a7 docs(386-37): RCA and corpus shape measurement for the sprout and body shape test
  files: .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md
- 4cb862239 fix(386-04): block brain_write at the guard, send no room text, report blocked honestly  [UNEXPECTED files outside the plan list: tests/test-brain-client-params.cjs]
  files: lib/core/part8-egress-guard.cjs, scripts/discovery-cycle.cjs, scripts/part8-egress-guard-hook.cjs, scripts/whitespace-to-brain.cjs, tests/run-all-196.sh, tests/test-brain-client-params.cjs
- 30a79afd7 test(386-18): pin the graph-doctor module to the requested room (RED)
  files: tests/test-386-graph-doctor-room-ctx.cjs
- 722d97c22 docs(386-14): RCA for B13, target PRESENT (since-last-session counts since the last turn)
  files: .planning/debug/last-session-md-rewritten-every-turn.md
- e62c99d82 test(386-37): pin the sprout and body shape test (RED)
  files: tests/test-386-sprout-body-shape.cjs
- 569bcc137 test(386-14): pin the since-last-session baseline to the session (RED)
  files: tests/test-386-last-session-baseline.cjs
- 5551afcec fix(386-09): pass PLUGIN_ROOT_FOR_RESOLVE to node as an environment variable
  files: scripts/session-start, tests/test-386-session-start-topology-env.cjs
- aec3a86cb docs(386-09): RCA resolution block
  files: .planning/debug/session-start-env-assignment-after-node-e-dev-clone-branch-dead.md
- 41351a05d docs(386-09): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-09-SUMMARY.md
- 2edcbfd89 docs(386-07): record the owner decision (unwire) and the plan summary
  files: .planning/debug/operator-update-registry-read-dormant-feature.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-07-SUMMARY.md
- df7bf2180 docs(386-20): record the owner decision (option-a) and the plan summary
  files: .planning/debug/supersession-gate-no-runtime-caller.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-20-SUMMARY.md
- a5acc8a86 docs(386-38): record the owner decision (option-b) and the plan summary
  files: .planning/debug/pinecone-inference-dead-or-live.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-38-SUMMARY.md
- f16751402 feat(386-37): sprout and body shape test (no verdict change)
  files: lib/core/part8-sprout-shape.cjs
- 1a3375db0 docs(386-37): fill the RCA resolution for the shape helper
  files: .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md
- a722aae9c fix(386-14): measure since-last-session from the previous session, not the previous turn
  files: scripts/on-stop
- 056d48aca docs(386-14): RCA resolution for B13
  files: .planning/debug/last-session-md-rewritten-every-turn.md
- a1a3d29c6 docs(386-14): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-14-SUMMARY.md
- d56f67775 docs(386-37): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-37-SUMMARY.md
- 5254a1ffc docs(audit): delta of the third audit handoff against the current repo and plans 386/387  [UNEXPECTED (no 386 plan label)]
  files: .planning/audits/AUDIT-3-DELTA.md
- 1f313d2ce docs(386-11): RCA for the strikes count and the room.db creation in the check-pending hooks
  files: .planning/debug/check-pending-ambiguous-three-strikes-count-compactions.md, .planning/debug/check-pending-breakthrough-creates-room-db.md
- 807624078 docs(386-16): RCA for B14, target PRESENT (memory hook gates on basename only)
  files: .planning/debug/memory-artifact-graph-hook-reconciles-wrong-room.md
- 5f6dfb6a6 test(386-16): pin the memory hook to the room that owns the written file (RED)
  files: tests/test-386-memory-artifact-hook-room-scope.cjs
- 8c3a13c24 docs(386-22): RCA for the missing approval and audit record on the 3 older web paths
  files: .planning/debug/web-paths-no-approval-or-audit-record.md
- f1d26593c test(386-11): pin strikes per session and no room.db creation (RED)
  files: tests/test-386-check-pending-hooks.cjs
- 265bc2475 test(386-22): pin the shared web-path gate (RED)
  files: tests/test-386-web-path-gate.cjs
- 0b100bb0e fix(386-18): graph-doctor reads the requested room from the doctor context
  files: scripts/doctor.cjs
- 83dfc010b fix(386-11): count strikes per session and never create room.db in the breakthrough hook
  files: scripts/check-pending-ambiguous.cjs, scripts/check-pending-breakthrough.cjs
- cd7dabfe6 docs(386-11): RCA resolution blocks
  files: .planning/debug/check-pending-ambiguous-three-strikes-count-compactions.md, .planning/debug/check-pending-breakthrough-creates-room-db.md
- 7e8448bf8 docs(386-18): resolve the B16 RCA and add the plan summary
  files: .planning/debug/graph-doctor-module-ctx-roomdir-never-set.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-18-SUMMARY.md
- b0dad7549 fix(386-16): reconcile only the room that owns the written file
  files: scripts/memory-artifact-graph-hook.cjs
- 1e62d6cfe docs(386-16): RCA resolution for B14
  files: .planning/debug/memory-artifact-graph-hook-reconciles-wrong-room.md
- 049dbe743 docs(386-11): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-11-SUMMARY.md
- d6dbe9abe feat(386-22): shared web-path gate and the 3 older web providers
  files: data/egress-policy.json, lib/core/research-planner/egress-policy.cjs, lib/core/web-path-gate.cjs
- 960f14b2f docs(386): third audit edits on plans 35 and 36
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-35-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md
- bf5f38ddd docs(386-22): RCA resolution and plan summary
  files: .planning/debug/web-paths-no-approval-or-audit-record.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-22-SUMMARY.md
- 078a07429 docs(386-16): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-16-SUMMARY.md
- 900c1e2b0 docs(386-19): RCA for B11, the framework_run halt gate is never minted
  files: .planning/debug/framework-run-halt-card-never-minted-unknown-gate.md
- dd03c5316 docs(386-36): add network-zero arm WH8 and no-key-bytes-in-refusal arm WH9
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md
- 72f73eb73 test(386-19): pin that a framework_run halt gate is answerable (RED)
  files: tests/test-386-framework-run-halt-gate-minted.cjs
- 5f0af41be docs(386-35): RCA and fresh-process module counts before the lazy timeline runner
  files: .planning/debug/folder-memory-eager-timeline-runner-widens-guard-dependencies.md
- b0f365410 test(386-35): pin the lazy timeline runner with an equivalence check (RED)
  files: tests/test-386-folder-memory-lazy-timeline.cjs
- c0e9b2563 docs(386-04): close the B2 RCA resolution block with verification and the disposition matrix
  files: .planning/debug/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md
- 46ba22f2c fix(386-19): mint the framework_run halt gate so gate_answer can resolve it
  files: lib/mcp/tools/sensors.cjs
- 6d85c2336 docs(386-04): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-04-SUMMARY.md
- 98130697b docs(386-19): resolve the B11 RCA and add the plan summary
  files: .planning/debug/framework-run-halt-card-never-minted-unknown-gate.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-19-SUMMARY.md
- b7323cdc1 fix(386-35): load the timeline runner only when extractFeynmanBody runs
  files: lib/core/folder-memory-async.cjs, lib/core/folder-memory.cjs
- f0df97036 docs(386-35): RCA after counts, resolution and plan summary
  files: .planning/debug/folder-memory-eager-timeline-runner-widens-guard-dependencies.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-35-SUMMARY.md
- fca1650e4 docs(386-08): record the repair gate lines and the skip (owner chose unwire)
  files: .planning/debug/operator-update-registry-read-dormant-feature.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-08-SUMMARY.md
- 244423288 docs(386-25): RCA for the typed Theo tools that fall to ambiguous (root cause written)
  files: .planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md
- d099bcd92 docs(386-10): RCA for the double session row and the unreadable post-compact side channel
  files: .planning/debug/post-compact-two-session-rows-and-sessionstart-envelope-fallback.md, .planning/debug/restore-post-compact-context-contribute-always-empty.md
- ec571ef22 docs(386-29): RCA of the Part 8 guard fail-open exits, proven with test doubles
  files: .planning/debug/part8-guard-fails-open-on-load-or-throw.md
- a4c934e67 test(386-25): pin allow arms for the typed Theo read tools (RED)
  files: tests/test-386-typed-theo-allow-arms.cjs
- e05745b94 test(386-10): pin one session row per compaction and a readable post-compact side channel (RED)
  files: tests/test-386-post-compact-session-rows.cjs, tests/test-386-restore-post-compact-context.cjs
- 66d2d3a14 test(386-05): pin the approval gate, credential check and audit record for the Semantic Scholar path (RED)
  files: tests/test-386-semantic-scholar-approval.cjs
- 539c6905f docs(386-29): record owner decision option-a plus outage count, add plan summary
  files: .planning/debug/part8-guard-fails-open-on-load-or-throw.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-29-SUMMARY.md
- 529ebdbbe fix(386-25): allow arms for the typed Theo read tools
  files: .planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md, lib/core/part8-egress-guard.cjs
- f5dfe4645 fix(386-10): one session row per compaction, a valid PostCompact envelope and a readable side channel
  files: scripts/memory-lifecycle.cjs, scripts/post-compact, scripts/restore-post-compact-context.cjs, tests/test-386-post-compact-session-rows.cjs
- c44e8aef0 docs(386-10): record the B5 and B9 resolutions in the RCA files
  files: .planning/debug/post-compact-two-session-rows-and-sessionstart-envelope-fallback.md, .planning/debug/restore-post-compact-context-contribute-always-empty.md
- d70d8d09f docs(386-25): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-25-SUMMARY.md
- dd33d4ee7 docs(386-10): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-10-SUMMARY.md
- 4910b4f36 docs(386-28): RCA for the job key that skips the room-word rules
  files: .planning/debug/part8-job-key-skips-room-word-rules.md
- 8d793693b fix(386-05): approval token, credential check and audit record for the Semantic Scholar path  [UNEXPECTED files outside the plan list: tests/test-363-command-contract.cjs]
  files: commands/whitespace.md, scripts/query-semantic-scholar.cjs, scripts/whitespace-command.cjs, skills/whitespace/SKILL.md, tests/test-363-command-contract.cjs
- c5342b1b9 test(386-28): pin that a job key does not skip the room-word rules (RED)
  files: tests/test-386-job-key-shortcut.cjs
- 48d198d26 docs(386-15): RCA for the dishonest cascade status and the repeated completions
  files: .planning/debug/memory-completion-detector-duplicate-completions.md, .planning/debug/post-write-reports-cascade-complete-when-skipped.md
- 888feff1c docs(386-05): close the Semantic Scholar RCA resolution block
  files: .planning/debug/whitespace-external-semantic-scholar-ungated-egress.md
- 280cc9562 test(386-15): pin an honest cascade status and one completion per cascade (RED)
  files: tests/test-386-cascade-status-and-completion.cjs
- 26fb34290 docs(386-05): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-SUMMARY.md
- 0149225cd docs(386-23): RCA for the grants.gov scan that sends room words without approval
  files: .planning/debug/grants-gov-scan-sends-room-words-without-approval.md
- ce05bffaf test(386-23): pin approval, credential check and audit record for the grants.gov path (RED)
  files: tests/test-386-grants-gov-approval.cjs
- d4e295b38 fix(386-28): a job key no longer skips the room-word rules
  files: .planning/debug/part8-job-key-skips-room-word-rules.md, lib/core/part8-egress-guard.cjs
- f73a68afe docs(386-28): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-28-SUMMARY.md
- 4445e09d0 docs(386-31): RCA for the key shapes and spelled money the guard lets through (root cause written)
  files: .planning/debug/part8-egress-guard-under-blocks-key-shape-and-spelled-money.md
- b7fd80ea7 test(386-31): pin credential shapes and keyword queries (RED)
  files: tests/test-386-key-shapes-and-money.cjs
- 0e5fc4523 fix(386-23): approval, credential check and audit record for the grants.gov path
  files: agents/opportunity-scanner.md, lib/core/opportunity-ops.cjs, lib/core/scheduled-scanner.cjs, lib/mcp/tool-router.cjs, scripts/mindrian-tools.cjs
- 294219d4a docs(386-23): resolve the funding search RCA and add the plan summary
  files: .planning/debug/grants-gov-scan-sends-room-words-without-approval.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-23-SUMMARY.md
- 84151d83e fix(386-15): write the real cascade status and count a completion once  [UNEXPECTED files outside the plan list: tests/test-cascade-side-channel.cjs, tests/test-cascade-surface-e2e.cjs]
  files: scripts/memory-completion-detector.cjs, scripts/post-write, tests/test-cascade-side-channel.cjs, tests/test-cascade-surface-e2e.cjs
- a625d16fb docs(386-15): record the B7 resolutions in the RCA files
  files: .planning/debug/memory-completion-detector-duplicate-completions.md, .planning/debug/post-write-reports-cascade-complete-when-skipped.md
- 578193b22 docs(386-15): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-15-SUMMARY.md
- eb6fa300e docs(386-24): RCA for research-speaker sending names before the user is asked
  files: .planning/debug/research-speaker-sends-names-before-the-user-is-asked.md
- 796e69566 fix(386-31): block credential shapes
  files: .planning/debug/part8-egress-guard-under-blocks-key-shape-and-spelled-money.md, lib/core/cross-room-aggregator.cjs, lib/core/rs-egress-prompts.cjs, tests/fixtures/3692/guard-survey-baseline.json
- 87dafaa3f test(386-24): pin approval before research-speaker sends (RED)
  files: tests/test-386-research-speaker-approval.cjs
- 084b73951 docs(386-31): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-31-SUMMARY.md
- 28b6f4011 docs(386): add probe fixtures and gate plans (39, 40), audio disclosure plan (41), outage-count line (29, 30), accepted-sprout set fix (32, 33), mirror notes (05, 24)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-05-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-24-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-29-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-30-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-39-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-40-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-41-PLAN.md
- a0ad2fb19 fix(386-24): ask before research-speaker sends, credential check and audit record  [UNEXPECTED files outside the plan list: tests/test-261030-eo7-research-speaker-apply-context.cjs, tests/test-261030-eo7-research-speaker-urlencode.cjs]
  files: commands/file-meeting.md, scripts/research-speaker, skills/file-meeting/SKILL.md, tests/test-261030-eo7-research-speaker-apply-context.cjs, tests/test-261030-eo7-research-speaker-urlencode.cjs
- c266cb827 docs(386-24): resolve the research-speaker RCA and add the plan summary
  files: .planning/debug/research-speaker-sends-names-before-the-user-is-asked.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-24-SUMMARY.md
- 63266115b test(386-39): pin the audit probe fixture hygiene and baseline (RED)
  files: tests/test-386-audit-probe-fixtures.cjs
- c19a5ba36 test(386-30): pin a guard that fails closed with a count-only outage line (RED)
  files: tests/test-386-guard-fails-closed.cjs
- e07255de5 test(386-39): vetted audit probe fixtures and the offline loader
  files: tests/fixtures/386-audit-probes/adversarial-cases.json, tests/fixtures/386-audit-probes/corpora-cases.json, tests/fixtures/386-audit-probes/p-cases.json, tests/helpers/audit-probe-loader.cjs
- 36e96903a test(386-39): record the audit probe baseline before plans 28, 31 and 33  [UNEXPECTED files outside the plan list: tests/fixtures/386-audit-probes/baseline-head-matrix.json]
  files: tests/fixtures/386-audit-probes/README.md, tests/fixtures/386-audit-probes/baseline-before.json, tests/fixtures/386-audit-probes/baseline-head-matrix.json
- 4b4e6abec docs(386): checker fixes on plans 36, 39, 41 and 28 (probe baseline from a git archive export of f0df97036, blob hash pin, web hook outage line, PreToolUse count recorded)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-28-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-39-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-41-PLAN.md
- d0e8b68e7 test(386-39): align the loader and baseline with the revised plan  [UNEXPECTED files outside the plan list: tests/fixtures/386-audit-probes/baseline-head-matrix.json]
  files: tests/fixtures/386-audit-probes/README.md, tests/fixtures/386-audit-probes/baseline-before.json, tests/fixtures/386-audit-probes/baseline-head-matrix.json, tests/helpers/audit-probe-loader.cjs, tests/test-386-audit-probe-fixtures.cjs
- d7f7add94 docs(386-39): add the plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-39-SUMMARY.md
- 64f7f6260 test(386-41): pin the audio disclosure lines (RED)
  files: tests/test-386-transcribe-audio-disclosure.cjs
- 11966721f docs(386-41): say that the audio file leaves the machine for Modulate
  files: README.md, commands/file-meeting.md, commands/setup.md, skills/file-meeting/SKILL.md, skills/setup/SKILL.md
- e66cf9d59 docs(386-41): add the plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-41-SUMMARY.md
- aeb2935e2 fix(386-30): the Part 8 guard fails closed with a typed reason and a count-only outage line
  files: lib/core/brain-client.cjs, lib/core/part8-outage-log.cjs, scripts/part8-egress-guard-hook.cjs, tests/part8-egress-guard-hook.test.cjs
- 7f078287a docs(386-30): close the guard fail-closed RCA Resolution and add the plan summary
  files: .planning/debug/part8-guard-fails-open-on-load-or-throw.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-30-SUMMARY.md
- 8c1af79b1 docs(386-26): RCA and census for the disposition of an ambiguous verdict (decision pending)
  files: .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md
- 24144cc21 docs(386-32): RCA, measurements and rule-change table for the over-blocking (decision pending)
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- 5e2b22424 docs(386): record the owner's context-based direction for ambiguous calls and over-blocking
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-PRD.md
- 633c83561 docs(386): owner direction option-e (context-based split route) for plans 26, 27, 32, 33; new plans 42 (split route design), 43 (guidance), 44 (B17), 45 (B18)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-27-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-40-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-42-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-43-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-44-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-45-PLAN.md
- 32d6592c6 docs(386-36): RCA for the web lines without a credential check, hooks.json reader baseline
  files: .planning/debug/web-lines-have-no-credential-check-before-send.md
- 77e722ab9 test(386-36): pin the credential-only web hook (RED)
  files: tests/test-386-web-credential-hook.cjs
- 5445710e6 feat(386-36): credential-only PreToolUse hook for the web lines
  files: data/arbitration-rule-catalogue.json, hooks/hooks.json, scripts/web-credential-guard-hook.cjs, tests/test-261029-qef-hook-timeouts.cjs
- 4babb3d76 docs(386-36): resolution block of the RCA and the plan summary
  files: .planning/debug/web-lines-have-no-credential-check-before-send.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-36-SUMMARY.md
- bbed8d94d docs(386): checker fixes on option-e plans (owner acknowledgement checkpoint in 32, claim-run leak check in 42, class pins and mutation controls in 40, unreadable db outcome in 33)
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-40-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-42-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-43-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-44-PLAN.md
- 8941520ab docs(386-40): align the unreadable room.db truth with sprouts_required and pin the token class that tells PGX1 apart
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-40-PLAN.md
- d1c5b4d0a docs(386-42): RCA of the missing split route for bodies and private claims
  files: .planning/debug/part8-no-split-route-for-bodies-and-private-claims.md
- 8716bfa2f test(386-42): pin the context-based split route end to end (RED)
  files: tests/test-386-sprout-split-route.cjs
- e7dc09253 feat(386-42): the context-based split route and the typed sprouts_required outcome
  files: lib/core/part8-split-route.cjs, tests/test-386-sprout-split-route.cjs
- 4466d732b docs(386-42): resolution block of the split route RCA
  files: .planning/debug/part8-no-split-route-for-bodies-and-private-claims.md
- 58df961b1 test(386-43): pin the sprout guidance in the persona, skills and references (RED)
  files: tests/test-386-sprout-guidance.cjs
- 1597fefae docs(386-43): teach the sprout rule and the sprouts_required refusal (3 of 4 files)
  files: agents/brain-query.md, references/brain/query-patterns.md, skills/brain-connector/SKILL.md
- 13e5af602 docs(386-42): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-42-SUMMARY.md
- 0ed2f6d41 docs(386-43): persona pointer and the full sprout guidance in a Brain reference  [UNEXPECTED files outside the plan list: data/harness-manifest.json, references/brain/sprout-split-route.md]
  files: data/harness-manifest.json, references/brain/sprout-split-route.md, skills/larry-personality/SKILL.md, tests/test-386-sprout-guidance.cjs
- 570ae3605 docs(386-43): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-43-SUMMARY.md
- 28e4e5ded docs(386-26): record the owner decision option-e and the missing census lines
  files: .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md
- 09b864ec2 docs(386-26): plan summary; fix pointer size in the 386-43 summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-26-SUMMARY.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-43-SUMMARY.md
- 10536cca0 test(386-27): pin the sprouts_required outcome on the hook, callTool and query (RED)
  files: tests/test-386-sprouts-required-outcome.cjs
- 5992a1f65 fix(386-27): the hook, callTool and query answer a raw body or an ambiguous edge with sprouts_required  [UNEXPECTED files outside the plan list: lib/core/part8-split-route.cjs]
  files: lib/core/brain-client.cjs, lib/core/part8-split-route.cjs, scripts/part8-egress-guard-hook.cjs
- f5132cb03 docs(386-27): fill the RCA resolution with disposition sprouts_required
  files: .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md
- e4940f2dd docs(386-27): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-27-SUMMARY.md
- 44e980eb3 docs(386-32): RCA rule-change table for option-e with needed_by_route, split ids and residual exposure
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- 67a679f69 docs(386-32): record the owner decision option-e in the over-block RCA
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- 8a5abcd1c docs(386-32): record the owner acknowledgement of the residual exposure
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- 519456eab docs(386-32): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-32-SUMMARY.md
- 28c44303c test(386-33): pin the context-based outcomes and the retried room database read (RED)
  files: tests/test-386-over-blocking-narrowed.cjs
- 93b785273 fix(386-33): sprouts pass, bodies and private claims get sprouts_required, a failed room database read is retried  [UNEXPECTED files outside the plan list: lib/core/brain-client.cjs, lib/core/part8-egress-guard.test.cjs, tests/test-245-brain-envelope-shape.cjs, tests/test-3692-lexicon-generic-entries.cjs, tests/test-3692-theo-verdict.cjs, tests/test-386-key-shapes-and-money.cjs, tests/test-386-typed-theo-allow-arms.cjs, tests/test-part8-name-class-methodology-names.cjs]
  files: lib/core/brain-client.cjs, lib/core/cross-room-aggregator.cjs, lib/core/part8-egress-guard.cjs, lib/core/part8-egress-guard.test.cjs, lib/core/part8-room-lexicon.cjs, lib/core/rs-egress-prompts.cjs, tests/fixtures/3692/guard-survey-baseline.json, tests/test-245-brain-envelope-shape.cjs, tests/test-3692-guard-survey-gate.cjs, tests/test-3692-lexicon-generic-entries.cjs, tests/test-3692-theo-verdict.cjs, tests/test-386-key-shapes-and-money.cjs, tests/test-386-typed-theo-allow-arms.cjs, tests/test-part8-name-class-methodology-names.cjs
- 5487ae636 test(386-33): flip the class and sprout-case assertions of five suites in place  [UNEXPECTED files outside the plan list: tests/test-213-part8-boundary.cjs, tests/test-257-brain-tool-egress-invariant.cjs, tests/test-354-egress-typed-question.cjs, tests/test-3692-closure.cjs, tests/test-3692-w1-closure.cjs]
  files: tests/test-213-part8-boundary.cjs, tests/test-257-brain-tool-egress-invariant.cjs, tests/test-354-egress-typed-question.cjs, tests/test-3692-closure.cjs, tests/test-3692-w1-closure.cjs
- a6cd170f7 docs(386-33): fill the over-block RCA resolution
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- d135338b0 docs(386-33): correct the R2 row of the over-block RCA (broad possessive marker)
  files: .planning/debug/part8-over-blocks-ordinary-theo-and-context-questions.md
- 7e3defb91 docs(386-33): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-33-SUMMARY.md
- 736b25377 docs(386-34): RCA and weak-assertion table for the not-allow-only Part 8 tests
  files: .planning/debug/part8-tests-assert-not-allow-only.md
- c91aa1798 test(386-34): mutation proof for the Part 8 verdict tests (RED)
  files: tests/helpers/part8-verdict-mutation-386.cjs, tests/test-386-guard-test-mutation-proof.cjs
- 2ea06d90d test(386-34): assert exact verdict classes in the Part 8 tests
  files: tests/test-254-ambiguous-disclosure.cjs, tests/test-354-egress-typed-question.cjs, tests/test-354-taxonomy-ladder-casing.cjs, tests/test-361-egress-shapes.cjs, tests/test-gct-process-step-id-parity.cjs
- 834b83fb2 docs(386-34): fill the not-allow-only RCA resolution
  files: .planning/debug/part8-tests-assert-not-allow-only.md
- 4028f4631 docs(386-44): RCA for the path-like row in the room section table
  files: .planning/debug/room-section-table-lists-the-room-own-windows-path.md
- c6c364eb3 test(386-44): pin that a section row is never a path (RED)
  files: tests/test-386-section-table-no-path-rows.cjs
- c4b21b798 test(386-40): pin the audit probe gate after plans 28, 31 and 33 (control: replay of the baseline fails)
  files: tests/fixtures/386-audit-probes/expectations.json, tests/test-386-audit-probe-gate.cjs
- 9284e47e5 docs(386-40): plan summary for the audit probe regression gate
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-40-SUMMARY.md
- 2e37f4068 fix(386-44): a section row is never a path  [UNEXPECTED files outside the plan list: lib/core/platform.cjs, lib/core/resolve-active-room.cjs, lib/core/room-db.cjs, lib/core/room-render-analyze.cjs]
  files: lib/core/platform.cjs, lib/core/resolve-active-room.cjs, lib/core/room-db.cjs, lib/core/room-render-analyze.cjs, lib/core/room-render-state.cjs, lib/core/section-registry.cjs
- 93df525bb docs(386-44): fill the path-like section row RCA resolution
  files: .planning/debug/room-section-table-lists-the-room-own-windows-path.md
- e05e7b99b docs(386-44): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-44-SUMMARY.md
- 43cbedaed docs(386): add plan 46 (E-IDENT: obfuscated email and international phone-like forms join the always-block rules); plan 21 moves to wave 10
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-46-PLAN.md
- 9fe6a0c9a docs(386-45): RCA for the false damaged report on a Windows drive
  files: .planning/debug/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md
- 6d32d1668 docs(386-46): RCA for obfuscated email and international phone-like forms
  files: .planning/debug/part8-always-block-misses-obfuscated-email-and-international-phone.md
- 893828652 test(386-46): pin the obfuscated email and international phone forms (RED)
  files: tests/test-386-identifier-forms.cjs
- 80f7a29e6 fix(386-46): block obfuscated email and international phone-like forms
  files: lib/core/cross-room-aggregator.cjs, tests/fixtures/386-audit-probes/expectations.json
- 6cf09d543 docs(386-46): fill the RCA resolution for obfuscated email and international phone forms
  files: .planning/debug/part8-always-block-misses-obfuscated-email-and-international-phone.md
- 59a976d59 docs(386-46): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-46-SUMMARY.md
- dd3616797 docs(386,387,388): roadmap status and requirement ids (EUR387, SHIP388)  [UNEXPECTED (no 386 plan label)]
  files: .planning/REQUIREMENTS.md, .planning/ROADMAP.md
- e19197237 docs(386-34): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-34-SUMMARY.md
- 2d4c3947b test(386-45): pin typed causes for an unreadable room.db (RED)
  files: tests/test-386-room-db-unreadable-message.cjs
- 575616b8b fix(386-45): say the real cause when room.db cannot be opened  [UNEXPECTED files outside the plan list: lib/core/graph-backfill.cjs, lib/core/navigation/room-identity.cjs, scripts/session-start]
  files: lib/core/graph-backfill.cjs, lib/core/navigation/room-identity.cjs, lib/core/room-readiness.cjs, scripts/session-start, tests/test-386-room-db-unreadable-message.cjs
- efab47263 docs(386-45): fill the RCA resolution and record the owner decision (not-needed)
  files: .planning/debug/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md
- 4b1f33a20 fix(386-45): move the read-only probe to the spine door  [UNEXPECTED files outside the plan list: lib/core/navigation/room-identity.cjs, lib/core/navigation/spine-events.cjs]
  files: .planning/debug/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md, lib/core/navigation/room-identity.cjs, lib/core/navigation/spine-events.cjs, lib/core/room-readiness.cjs
- 1be0793de docs(386-45): plan summary
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-45-SUMMARY.md
- d2e096b67 docs(386): add plan 47 (B19: an approved recovery must not move a healthy room.db aside after a false unreadable); plan 21 lists B19
  files: .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-21-PLAN.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-47-PLAN.md
- c11f3533e docs(386-47): RCA for B19, an approved recovery moves a healthy room.db aside on a false unreadable
  files: .planning/debug/approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable.md
- 0744227d9 test(386-47): pin that a false unreadable never moves room.db aside (RED)
  files: tests/test-386-no-move-aside-on-false-unreadable.cjs
- 545d5fe83 fix(386-47): an approved recovery moves room.db aside only for a real not-a-database file  [UNEXPECTED files outside the plan list: lib/mcp/session-room.cjs]
  files: lib/core/graph-backfill.cjs, lib/core/navigation/room-identity.cjs, lib/core/room-readiness.cjs, lib/mcp/room-readiness-gate.cjs, lib/mcp/session-room.cjs, tests/test-386-no-move-aside-on-false-unreadable.cjs
- f7524d938 docs(386-47): RCA resolution and plan summary
  files: .planning/debug/approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-47-SUMMARY.md
- f0b2e99bd docs(386): changelog, knowledge base and resolved RCA files
  files: .planning/debug/knowledge-base.md, .planning/debug/resolved/approved-recovery-moves-a-healthy-room-db-aside-on-a-false-unreadable.md, .planning/debug/resolved/check-pending-ambiguous-three-strikes-count-compactions.md, .planning/debug/resolved/check-pending-breakthrough-creates-room-db.md, .planning/debug/resolved/dial-memory-rewrite-marks-sections-stale.md, .planning/debug/resolved/folder-memory-eager-timeline-runner-widens-guard-dependencies.md, .planning/debug/resolved/framework-run-halt-card-never-minted-unknown-gate.md, .planning/debug/resolved/grants-gov-scan-sends-room-words-without-approval.md, .planning/debug/resolved/graph-doctor-module-ctx-roomdir-never-set.md, .planning/debug/resolved/last-session-md-rewritten-every-turn.md, .planning/debug/resolved/memory-artifact-graph-hook-reconciles-wrong-room.md, .planning/debug/resolved/memory-completion-detector-duplicate-completions.md, .planning/debug/resolved/part8-always-block-misses-obfuscated-email-and-international-phone.md, .planning/debug/resolved/part8-ambiguous-verdict-is-sent-on-own-shim.md, .planning/debug/resolved/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md, .planning/debug/resolved/part8-egress-guard-under-blocks-key-shape-and-spelled-money.md, .planning/debug/resolved/part8-guard-fails-open-on-load-or-throw.md, .planning/debug/resolved/part8-job-key-skips-room-word-rules.md, .planning/debug/resolved/part8-no-shape-test-for-sprouts-and-bodies.md, .planning/debug/resolved/part8-no-split-route-for-bodies-and-private-claims.md, .planning/debug/resolved/part8-over-blocks-ordinary-theo-and-context-questions.md, .planning/debug/resolved/part8-tests-assert-not-allow-only.md, .planning/debug/resolved/post-compact-two-session-rows-and-sessionstart-envelope-fallback.md, .planning/debug/resolved/post-write-reports-cascade-complete-when-skipped.md, .planning/debug/resolved/registry-readers-legacy-shape-never-resolve.md, .planning/debug/resolved/research-speaker-sends-names-before-the-user-is-asked.md, .planning/debug/resolved/restore-post-compact-context-contribute-always-empty.md, .planning/debug/resolved/room-db-reported-unreadable-on-a-windows-drive-from-wsl.md, .planning/debug/resolved/room-section-table-lists-the-room-own-windows-path.md, .planning/debug/resolved/rs-fetch-neo4j-uri-typeerror-instead-of-sqlite-fallback.md, .planning/debug/resolved/session-start-env-assignment-after-node-e-dev-clone-branch-dead.md, .planning/debug/resolved/web-lines-have-no-credential-check-before-send.md, .planning/debug/resolved/web-paths-no-approval-or-audit-record.md, .planning/debug/resolved/whitespace-external-semantic-scholar-ungated-egress.md, .planning/debug/resolved/whitespace-to-brain-brain-write-room-derived-text-ambiguous-proceeds.md, .planning/debug/resolved/wiki-server-shadowed-byoapi-chat-proxy-latent-part8-egress.md, .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/386-OUTCOMES.md, CHANGELOG.md
- 73d6cef3c fix(386-21): tests read a resolved RCA from .planning/debug/resolved  [UNEXPECTED files outside the plan list: tests/test-386-folder-memory-lazy-timeline.cjs, tests/test-386-identifier-forms.cjs, tests/test-386-over-blocking-narrowed.cjs, tests/test-386-sprout-body-shape.cjs, tests/test-386-sprout-guidance.cjs, tests/test-386-sprout-split-route.cjs, tests/test-386-web-credential-hook.cjs]
  files: tests/test-386-folder-memory-lazy-timeline.cjs, tests/test-386-identifier-forms.cjs, tests/test-386-over-blocking-narrowed.cjs, tests/test-386-sprout-body-shape.cjs, tests/test-386-sprout-guidance.cjs, tests/test-386-sprout-split-route.cjs, tests/test-386-web-credential-hook.cjs
