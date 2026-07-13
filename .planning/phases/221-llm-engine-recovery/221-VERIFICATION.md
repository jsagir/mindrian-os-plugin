# Phase 221: Verification (precondition table, recorded live pre-cut)

**Status:** IN PROGRESS. This file records the 221-05 Task 1 precondition gate as it stands
today. It is NOT the full 221-05 closeout (that also covers the CHANGELOG assembly - already
landed separately, commit `edcc4180` - README refresh, website capability copy, and the
executed five-gate release itself). This section exists so the precondition state is real,
evidenced, and inspectable ahead of the cut, not re-derived from memory at cut time (D-10).

## 1. Precondition table (221-05-PLAN.md Task 1, checked live 2026-07-13)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | `219-RELEASE-STAGING.md` exists | PASS | present, staged drafts verified read in full this session |
| 2 | 219 corepower confirmation recorded (not a placeholder) | PASS (as WAIVED) | `219-VERIFICATION.md` Section 4.3: "STATUS: WAIVED (navigator override, 2026-07-13) - NOT a PASS" - a real recorded decision, not an empty placeholder |
| 3 | `220-RELEASE-STAGING.md` exists | PASS | present, staged drafts verified read in full this session |
| 4 | 220 readiness recorded | **OPEN - the one real blocker** | `220-VERIFICATION.md`: "Awaiting navigator confirmation" of the SENS-15 live-card checkpoint. Cannot be fired from this session - confirmed live: this MCP session is bound to an unrelated real room (`motj-ecosystem/sub-rooms/jonathan-contractor-motj`), and `room_bind` to a clean test room (`ador-ip-test`) fails with `no_session_id` (the same infra limitation noted earlier this session). Needs the navigator to run `220-NAVIGATOR-VERIFICATION-PROMPT.md` in a real room-bound session and paste back the ticked checklist. |
| 5 | 221 gates: `bash tests/run-all-221.sh` FAIL=0 | **WAIVED (see 2.1 below)** | Every 219/220/221 test file green standalone. The 2 aggregate FAILs are both the SAME pre-existing, unrelated, tracked issue (2.1), not a new regression. |
| 6 | `node scripts/doctor.cjs --acceptance` green | **WAIVED (see 2.2 below)** | 14/15 points pass. The 1 failure (`verify-release-clean-tree`) is pre-existing, unrelated tree drift (2.2), not new. |
| 7 | `node scripts/build-connector-registry.cjs --check` green | PASS | `connector-registry: OK` |
| 8 | `git diff --exit-code package.json .claude-plugin/plugin.json` (no premature hand-bump) | PASS | clean |

## 2. Waivers recorded (navigator override, 2026-07-13) - NOT a PASS on either, knowing risk acceptance, same pattern as the 219 corepower waiver

### 2.1 The `--strict` shape-declaration gate (216-03), cascading into 220/221's regression legs

**Root cause (verified live, not assumed):** `scripts/check-shape-declaration.cjs`'s `--strict`
mode hard-fails on 3 skills - `skills/update/SKILL.md`, `skills/vault/SKILL.md`,
`skills/visualize/SKILL.md` - each of which declares BOTH a genuine `hitl_shape`
(they really do offer a one-action approve/defer decision) AND `connector.excluded:true`
(they are legitimately never reached via the proactive reach/connector spine - each is a
deliberately-invoked lifecycle/maintenance/deprecated surface with no problem-state trigger).
This is not a bug in these 3 skills; it is ONE frontmatter field (`connector.excluded`) doing
double duty for two different concepts ("has no fork" vs. "not reached via the governed
connector spine"), already root-caused and explicitly deferred in
`.planning/debug/knowledge-base.md` (2026-07-xx, the conversation-mode RCA): "a genuine
architectural fix requires splitting them into distinct fields (not done this session)."

Per Phase 210 policy this gate is advisory (WARN, non-blocking) in normal mode; it hard-fails
only under `--strict`, and `tests/run-all-216.sh` intentionally exercises `--strict` as a
meta-test that strict mode itself still works - not as a real release gate. It cascades into
`tests/run-all-220.sh` and `tests/run-all-221.sh` purely because both chain the 216 regression
leg, making an unrelated, pre-existing, already-tracked architectural question read as a fresh
FAIL in this release's own aggregate.

**Navigator decision (2026-07-13):** waive, same as corepower. Recorded here as a knowing,
informed acceptance - not fixed, not hidden. The real fix (splitting the frontmatter field) is
real future work, separate from this release wave; it is not re-filed here since
`knowledge-base.md` already carries it.

### 2.2 The 2026-07-12 tree drift (`verify-release-clean-tree`)

**Root cause:** pre-existing, explicitly flagged uncommitted work from a prior session
(`.planning/SESSION-HANDOFF-2026-07-12.md` line 59): a `/mos:eureka html` subcommand
(`commands/eureka.md` + `skills/eureka/SKILL.md` argument-hint diff, `scripts/eureka-html-report.cjs`)
and PWS wisdom-nugget Brain-ingestion prep (`cypher/pws-brain-ingest.cypher`,
`data/pws-brain-nuggets.json`, `scripts/ingest-pws-nuggets-pinecone.py`, `scripts/ingest_neo4j.py`),
explicitly marked "not yours to resolve as part of this task - just don't let release.sh sweep
them in by accident." Confirmed still present, untouched, exactly as flagged.

**Navigator decision (2026-07-13):** waive, same as corepower. `release.sh` must NOT sweep
this drift into the release commit - whoever picks it up next commits it deliberately, on its
own terms, separately from this release.

## 3. Net position

The joint 219+220+221 engine work is real, tested, and green end to end. The ONLY thing still
genuinely blocking 221-05 dispatch is precondition #4 above (the 220 URL-card live checkpoint) -
a navigator-only action this session cannot perform (confirmed: no working room-bind path to a
clean test room from here). Once that checklist is pasted back and confirmed, 221-05 is
dispatchable with every other precondition already honestly resolved (green or explicitly
waived) above.
