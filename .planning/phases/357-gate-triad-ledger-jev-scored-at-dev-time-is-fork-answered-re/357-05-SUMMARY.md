---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 05
subsystem: testing
tags: [card-fire, corpus, fixtures, debug-cases, live-evidence, sanitization]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 01
    provides: "scripts/card-fire-replay-corpus.cjs (loadCorpus, validateEntry), empty-entries debug-cases.json / live-2026-09-23.json fixture files"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 02
    provides: "scripts/replay-card-fire.cjs (the replay harness, --code-root pre-phase), tests/test-357-replay.cjs (L6 live-anchor leg, SKIP-gated until this plan)"
provides:
  - "tests/fixtures/card-fire-replay/debug-cases.json: 16 authored entries covering all 10 resolved card-fire RCAs, the two V3 human-upstream carve-out cases, and one routed-in intent-classifier regression control"
  - "tests/fixtures/card-fire-replay/live-2026-09-23.json: the two 2026-09-23 session 56924067 live false blocks, paraphrased and verdict-preserving, reproducing FALSE_BLOCK on the archived pre-phase code root"
  - "tests/test-357-replay.cjs L6 leg now active (was SKIP) and passing"
affects: [357-06, 357-07, 357-08, 357-09, 357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debug entries that target a not-yet-shipped fix (D-07's three harness-misclassification cases) are authored with expected_verdict_class 'pass' but deliberately reproduce FALSE_BLOCK on today's code (pre-phase and HEAD alike, since D-07/D-08a land in plan 07) -- the corpus records the DESIRED post-fix verdict, not today's actual one, exactly like known_miss does for the text-dependent prose fork"
    - "Live entries reuse the same transcript+sidechannel envelope mode as the debug harness cases (Pattern 1), so the paraphrase exercises the REAL turn-text.cjs / card-fire-sidechannel.cjs code path rather than freezing a pre-fix classification via direct fields (Pitfall 2)"
    - "Sanitization keeps the token-OVERLAP CLASS (chrome vs content) and its count, never the raw text: live-01 overlaps on a real content token (a candidate room stand-in), live-02 overlaps on exactly one F.1 dial-chrome token ('gate'), matching the raw evidence's decisive property while paraphrasing every word"

key-files:
  created: []
  modified:
    - tests/fixtures/card-fire-replay/debug-cases.json
    - tests/fixtures/card-fire-replay/live-2026-09-23.json

key-decisions:
  - "PLAN_BASE = afbcde0674503592b249c6a0c91f39cd87342f98 (HEAD at plan start; no peer diff existed on either target file before editing, confirmed via git status --short on both paths)"
  - "R-D snapshot re-verified before Task 2 reads: sha256sum -c ~/.cache/mindrian-dev/357-raw/SHA256SUMS reported OK for all 5 files (4 session jsonl + card-fire-intercepts.log) before any raw inspection"
  - "live-2026-09-23-01 models the F.8 room-bind gate minted on the hand-back turn (R-E), NOT the F.1 fleet-census reach; the transcript narrative uses a neutral 'status roll-up' framing instead of any fleet-census wording, so the fixture cannot be mistaken for modeling the superseded F.1 anchor"
  - "live-2026-09-23-02's F.1 subject is built from the renderDial layout (header line ending '- REACH - decision gate', LOCAL/BRAIN/SIGNAL context line, gauge line, 'Choose next reach:' prompt, a memory_artifact:research/... body row, 'top-N of M' footer) per dial-presenter.cjs, and the human turn shares exactly one token with it, 'gate', which is F.1 dial chrome (from the header's own '- REACH - decision gate' wording), not real content -- reproducing D-08a's decisive over-broad-relevance property"
  - "No fixture correction was needed: all 16 debug entries and both live entries produced the exact outcome the plan specified on the first replay run (--code-root pre-phase), verified analytically against classifyCardFire's branch order before writing the fixtures and confirmed by the harness"

requirements-completed: [GATE357-01, GATE357-02]

# Metrics
duration: 55min
completed: 2026-09-23
---

# Phase 357 Plan 05: Debug and Live Corpus Authoring Summary

**Authors 16 hand-labeled `debug-cases.json` envelopes (one per resolved card-fire RCA, plus the two V3 carve-out cases and a routed-in intent-classifier control) and the two sanitized `live-2026-09-23.json` false-block anchors, proving on the archived pre-phase code that both live blocks and three named debug entries reproduce as FALSE_BLOCK exactly as SPEC R1(b)/(c) and R2 require, with zero raw evidence text committed and zero code change.**

## Performance

- **Duration:** ~55 min (context gathering plus fixture authoring and verification; excludes this summary)
- **PLAN_BASE:** `afbcde0674503592b249c6a0c91f39cd87342f98`
- **Task 1 commit:** `bcb2c2129`
- **Task 2 commit:** `d0e17b371`
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both fixture files; 0 created, 0 runtime files touched)

## Accomplishments

- `debug-cases.json` filled with 16 entries. Every resolved card-fire RCA (`backstop-benign-list-defeats-relevance-gate`, `card-fire-answered-gate-refires-within-ttl-window`, `card-fire-block-surface`, `card-fire-over-enforcement`, `card-fire-relevance-check-gap`, `card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance`, `stop-hook-fires-card-on-option-shaped-prose-sentence`, `room-bind-gate-fires-on-notification-only-turns` x2, `intern-w1-card-discipline-decay` x2, `reach-gate-stale-turn-input`) has a replayable envelope citing its RCA in `why`; the two V3 human-upstream carve-out cases (Skill-body meta, image-placeholder meta, both directly after a human prompt) are present and expected to keep blocking both before and after D-07; `reach-gate-stale-turn-input` carries `routed_in: 'intent-classifier'` as an informational, non-validated field.
- `live-2026-09-23.json` filled with `live-2026-09-23-01` (F.8 hand-back anchor, R-E correction) and `live-2026-09-23-02` (D-08a, F.1 chrome-token overlap), both `transcript+sidechannel` mode, both paraphrased from the local-only R-D snapshot, sanitization statement unchanged.
- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --source debug --json`: 16 entries, 0 errors, 0 parity mismatches; FALSE_BLOCK for exactly `debug-room-bind-task-notification`, `debug-harness-peer-after-tool-result`, `debug-harness-idle-notice` (the three D-07 targets); KNOWN_MISS for `debug-intern-w1-prose-fork`; OK for the other 12. Matches the plan's required outcome table exactly, on the first run, with no fixture corrections needed.
- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --source live --json`: 2 entries, both FALSE_BLOCK, cli reason `reached-registry-gate-no-card` on both, 0 parity mismatches, exit 1.
- `node tests/test-357-replay.cjs`: L6 (the live-anchor leg, previously SKIP) is now active and passing: "L6: the two 2026-09-23 live anchors reproduce as FALSE_BLOCK against the pre-phase code root".
- `node -e` shape check confirms `live-2026-09-23-01.envelope.sidechannel_records[0].shape === 'F.8'` and `live-2026-09-23-02.envelope.sidechannel_records[0].shape === 'F.1'` (R-E ordering).
- Leak checks: `grep -ciE "[A-Za-z0-9._%+-]+@|/home/|MindrianRooms|[0-9a-f]{8}-[0-9a-f]{4}-"` on both fixture files is 0; em-dash guard (`grep -c $'\xe2\x80\x94'`) is 0 on both files; no scratch file was ever written inside the repo (all raw-snapshot inspection ran as inline `node -e`/`sha256sum` commands against `~/.cache/mindrian-dev/357-raw/`, never a script on disk in the repo or the scratchpad needed for this plan's scope).

## Task Commits

Each task was committed atomically:

1. **Task 1: Source (b), one or more entries per resolved RCA plus the carve-out and harness cases** - `bcb2c2129` (test)
2. **Task 2: Source (c), the two 2026-09-23 live false blocks, reconstructed from the R-D snapshot** - `d0e17b371` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `tests/fixtures/card-fire-replay/debug-cases.json` - 16 authored debug entries (source (b))
- `tests/fixtures/card-fire-replay/live-2026-09-23.json` - 2 sanitized live entries (source (c))

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- Every debug entry's expected verdict, reason, and mode were derived analytically from `classifyCardFire`'s exact branch order (`scripts/check-card-fire.cjs:523-748`) and `gate-relevance.cjs`'s token rules (`GATE_BOILERPLATE_TOKENS`, `MIN_USER_SUBJECT_TOKENS`, prefix-stem overlap) BEFORE writing any fixture text, then confirmed against the real harness. This is why zero fixture corrections were needed on the first run (contrast the plan's own contingency instruction to "fix the fixture, not the code, if any other id is not OK").
- `debug-reach-gate-stale-turn-input`'s subject text intentionally avoids any "fleet census" framing (unlike the live evidence it is routed in from) to keep it a clean, self-contained regression control independent of the R-E anchor's own narrative.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were needed; every fixture entry produced its specified outcome on the first replay run.

## Known, Expected, Temporary Regression (not a deviation - scoped to plan 07)

Adding real debug and live content that specifically targets the not-yet-shipped D-07 (harness-preceding-record misclassification) and D-08a (F.1 dial-chrome relevance over-broadening) fixes necessarily makes `tests/test-357-replay.cjs`'s **L1** leg ("a green full-corpus run must exit 0") fail against **today's code** (HEAD, not just the archived pre-phase root), because D-07/D-08a have not landed yet (`check-card-fire.cjs`, `gate-relevance.cjs`, and `lib/hmi/turn-text.cjs` are explicitly out of this plan's `files_modified` and are reserved for plan 357-07).

- `node scripts/replay-card-fire.cjs --surface both --json` (full corpus, HEAD code root, no `--source` filter): `false_blocks: 5` (the 3 debug D-07 targets plus both live entries), exit 1.
- This was ALREADY true after Task 1 alone (3 false blocks from the debug fixtures), before Task 2 touched anything -- confirmed by running `--source debug` on HEAD immediately after the Task 1 commit.
- `bash tests/run-all-357.sh`'s `"357: replay harness and parity (GATE357-02, GATE357-06)"` leg will report this same failure until 357-07 lands.
- This mirrors the exact, already-established precedent from 357-01-SUMMARY.md's documented L3 red leg ("expected until plans 04/05/06 land") and R-J's ruling ("Pre-existing reds ... are recorded as known, not fixed in 357"). The corpus is CORRECT (it records the desired post-fix verdict in `expected_verdict_class`, exactly like the `known_miss` mechanism records a desired-but-unreached verdict for the prose fork); the runtime code that will make L1 green again is 357-07's job, not this plan's.
- Verified this is not masked by weakening anything: `--code-root pre-phase --surface both --source debug|live` (the specific checks this plan's own Task 1/Task 2 verify commands require) both pass exactly as specified. L6 (this plan's actual target leg) is active and green.

## Issues Encountered

None beyond the documented, expected L1 regression above (not an issue in this plan's own deliverable; it is the corpus doing its job of exposing the two not-yet-fixed defect classes it was authored to prove).

## User Setup Required

None - no external service configuration required. No secrets, no network egress. `~/.cache/mindrian-dev/357-raw/` was read-only (`sha256sum -c` verified before and used only via inline `node -e`/shell inspection, never copied or committed).

## Pre-Phase Outcome Per Debug ID (Task 1)

| id | outcome | cli reason |
|----|---------|------------|
| debug-backstop-benign-list | OK | no-gate-signal |
| debug-answered-gate-refires | OK | no-gate-signal |
| debug-block-surface-simple-binary | OK | gate-is-simple-binary |
| debug-over-enforcement-stale-terse | OK | gate-irrelevant-to-turn |
| debug-relevance-check-gap-no-subject | OK | primary-gate-existence-unconfirmed |
| debug-stale-f1-irrelevant | OK | gate-irrelevant-to-turn |
| debug-option-shaped-prose-f8-chrome | OK | gate-irrelevant-to-turn |
| debug-room-bind-tool-result | OK | preceding-turn-synthetic-no-user-engagement |
| debug-room-bind-task-notification | **FALSE_BLOCK** | reached-registry-gate-no-card |
| debug-intern-w1-labeled-fork | OK | ascii-box-backstop-no-card |
| debug-intern-w1-prose-fork | **KNOWN_MISS** | no-gate-signal |
| debug-reach-gate-stale-turn-input | OK | reached-registry-gate-no-card |
| debug-carveout-skill-meta-after-human | OK | reached-registry-gate-no-card |
| debug-carveout-image-meta-after-human | OK | reached-registry-gate-no-card |
| debug-harness-peer-after-tool-result | **FALSE_BLOCK** | reached-registry-gate-no-card |
| debug-harness-idle-notice | **FALSE_BLOCK** | reached-registry-gate-no-card |

No fixture corrections were needed - every id landed on its planned outcome on the first replay.

## Structural Timeline of Both Live Stops (types, isMeta, origin.kind, ages - no text)

**live-2026-09-23-01 (F.8 hand-back anchor, R-E):**

| # | type | isMeta | origin.kind | note |
|---|------|--------|-------------|------|
| 1 | user | - | human | initiating prompt |
| 2 | assistant | - | - | dispatches a background check (tool_use) |
| 3 | user | - | - | tool_result (synthetic, no human text field) |
| 4 | assistant | - | - | brief ack |
| 5 | user | **true** | **peer** | the hand-back record (misread as typed pre-D-07) |
| 6 | assistant | - | - | final output, no options, no question |

Side channel: ONE fresh F.8 record, age_ms 7000 (well under the 120000 fresh window).

**live-2026-09-23-02 (D-08a, F.1 chrome overlap):**

| # | type | isMeta | origin.kind | note |
|---|------|--------|-------------|------|
| 1 | assistant | - | - | prior assistant record |
| 2 | user | - | **human** | real human-typed question (D-07 does not apply) |
| 3 | assistant | - | - | final output, no options, no question |

Side channel: ONE fresh F.1 record, age_ms 30000 (well under the 120000 fresh window).

## Overlap Class and Count Per Live Entry (never the raw text)

- **live-2026-09-23-01:** overlap class = **content** (a single non-boilerplate candidate-name token shared between the hand-back record and the F.8 subject); count = 1. This is a real, if incidental, content overlap - it is NOT cleared by the already-shipped F.8 `GATE_BOILERPLATE_TOKENS` fix, and IS cleared once D-07 reclassifies the preceding record as harness (source, not relevance, is what changes).
- **live-2026-09-23-02:** overlap class = **chrome** (exactly one token, drawn from the F.1 dial's own static header wording); count = 1. This is the exact decisive property D-08a's fix (extending `GATE_BOILERPLATE_TOKENS` to F.1's own static chrome) targets - the human turn carries several of its own subject tokens, but shares none with the gate's real, distinguishing content.

## Leak-Check Results

- `grep -ciE "[A-Za-z0-9._%+-]+@|/home/|MindrianRooms|[0-9a-f]{8}-[0-9a-f]{4}-" tests/fixtures/card-fire-replay/live-2026-09-23.json` -> `0`
- `grep -ciE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|/home/|MindrianRooms" tests/fixtures/card-fire-replay/debug-cases.json` -> `0`
- Room-directory-name sweep against every entry under `~/MindrianRooms/`: no room-specific hit (the only case-insensitive substring hits were on the sanitized, intentional words "mindrianOS" and "rooms" that already appear in every existing 238-corpus F.8 fixture, per the established `-- mindrianOS -- bind session -- select rooms --` chrome precedent; no actual room-directory name leaked).
- `grep -c "$(printf '\xe2\x80\x94')"` (em-dash guard) on both files -> `0`.
- `git status --short` after both commits shows no new untracked file under the repo from raw-snapshot inspection; the pre-existing modified/untracked files visible in `git status` (`lib/core/floor-disclosure.cjs`, `scripts/check-floor-ledger.cjs`, `data/floor-ledger.json`, `docs/ENV-TUNING.md`, `tests/test-355-floor-sweep.cjs`, `scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, and several unrelated `docs/reviews/*` / `.planning/quick/*` paths) are peer-session diffs from concurrent Phase 355 work on the shared `main` tree, present before this plan started and untouched by it (verified: neither of this plan's two commits, diffed against their own parent, touches anything outside its own declared `files_modified`).

## Verification Results

- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --source debug --json` -> 16 entries, 0 errors, 0 parity mismatches, FALSE_BLOCK exactly for the 3 named D-07 targets, KNOWN_MISS for the prose fork, OK otherwise.
- `node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --source live --json` -> 2 entries, both FALSE_BLOCK, cli reason `reached-registry-gate-no-card`, 0 parity mismatches, exit 1.
- `node tests/test-357-corpus-loader.cjs` -> L1, L2, L4, L5, L6 pass; L3 (sources and floor, SPEC R1) remains red only because `dogfood` still has 0 entries and the 45-entry floor (36 today) is not yet met - both expected until 357-06 lands dogfood entries, per the plan's own Task 1 instruction to run this check.
- `node tests/test-357-replay.cjs` -> 10/11 legs pass; L6 is active and green; L1 fails as the documented, expected, plan-07-scoped regression above; L7 remains SKIP (baseline lands in 357-09).
- Protected-file check (this plan's own 2 commits only): `git diff --name-only <commit>~1 <commit> -- lib/mcp/brain-router.cjs lib/core/write-lock.cjs lib/core/part8-egress-guard.cjs scripts/doctor.cjs lib/core/graph-ops.cjs scripts/eval-icm-writers.cjs tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs lib/core/navigation.cjs docs/OPEN-HANDOFFS.md` -> empty for both commits.
- No-runtime-change check (this plan's own 2 commits only): `git diff --name-only <commit>~1 <commit> -- lib hooks scripts` -> empty for both commits.
- Em-dash guard: `grep -c $'\xe2\x80\x94'` -> `0` on both fixture files.

## Next Phase Readiness

- `debug-cases.json` and `live-2026-09-23.json` are the targets 357-07's D-07 and D-08a fixes must turn to pass without creating new misses: after 357-07 lands, `debug-room-bind-task-notification`, `debug-harness-peer-after-tool-result`, `debug-harness-idle-notice`, `live-2026-09-23-01`, and `live-2026-09-23-02` must all flip from FALSE_BLOCK to OK, and `debug-intern-w1-prose-fork` must remain KNOWN_MISS (never silently fixed by an unrelated change).
- 357-06 (dogfood) still needs to land >=1 dogfood entry and reach the 45-entry SPEC R1 floor (36 today: 18 from source (a), 16 from source (b), 2 from source (c)) before the corpus loader's L3 leg goes green.
- 357-09's baseline/mutation legs (L7, `--mutation`) remain correctly gated on `baseline.json`, which does not exist yet.
- The L1 regression documented above is squarely 357-07's fix target, not a blocker for 357-06 (dogfood authoring) to proceed in parallel.
- Per this plan's own scope contract, no STATE.md / ROADMAP.md / REQUIREMENTS.md write was made; `requirements-completed: [GATE357-01, GATE357-02]` is recorded in this file's frontmatter for the orchestrator to apply.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 05*
*Completed: 2026-09-23*

## Self-Check: PASSED

Both target files verified present on disk with non-empty `entries` arrays (`tests/fixtures/card-fire-replay/debug-cases.json`, 16 entries; `tests/fixtures/card-fire-replay/live-2026-09-23.json`, 2 entries). Both commits (`bcb2c2129` Task 1, `d0e17b371` Task 2) verified present in `git log --oneline`. No missing items.
