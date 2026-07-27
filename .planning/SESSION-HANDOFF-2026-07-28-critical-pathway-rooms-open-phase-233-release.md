# SESSION HANDOFF - 2026-07-28 - Critical Pathway built, rooms-open fixed, Phase 233 shipped, v1.15.3-beta.50 released

**Theme:** Started from "what's upcoming in the seed backlog" and turned into a full close-the-loop
arc: designed a formal seed-to-phase triage process, used it to find and fix a proven live bug
(`rooms-open` reporting success while doing nothing), planned and executed SEED-037's residual
scope as Phase 233 end to end (plan -> execute -> code review -> fix -> verify), and shipped
all of it as a real, live, independently-verified release. This file is the retrievable index.

## THE GOLD (what to remember)

### 1. The Critical Pathway (`.planning/seeds/INDEX.md`, Operations runbook, 5th entry)

A formal 5-stage process for handling the seed backlog, added this session after two live
near-misses proved each stage's value: **SCORE** (4 tiers: proven-live-defect >
critical-unclaimed > chosen-direction-unscoped > exploratory) -> **CONSULT**
(`langtalks-graph-expert` mandatory for anything Claude-Code/agent-engineering-shaped;
"not in corpus" is a valid answer) -> **REUSE-CHECK** (Part 7 -- grep the FULL seed corpus +
`.planning/debug/` open AND resolved, not just INDEX.md's stale tables) -> **PROMOTE** (proven
bug -> `/gsd-debug` directly, skip re-diagnosing; real unknown -> `/gsd-plan-phase`) ->
**EXECUTE one at a time** (don't start item N+1 while N is running; re-score after each close).

This is not theoretical -- it caught two real near-misses live this session (see below) and is
the reason Phase 233 turned out to be ~60% already-shipped work instead of a fresh phase.

### 2. `rooms-open` false-success bug -- found, root-caused, fixed, shipped

`orchestration`'s `rooms-open` command had **no implementation at all**: it fell through to a
generic reference-echo fallback (shared by 18 of 22 orchestration commands) that built a
plausible "Room State" success payload from disk docs + a boot-frozen room snapshot + an echo
of the caller's own argument, then asserted "Room operation complete." Zero product code ever
called `room-registry set-active`. Fixed with a new `lib/core/room-open.cjs` chokepoint that
calls the real writer and gates `ok:true` behind a `get-active` read-back -- success is now
structurally impossible without the switch actually landing. Sibling mutating commands
(`rooms-new`/`close`/`archive`) get an honest NOT EXECUTED banner instead of the same false
claim. 10 hermetic tests, all asserting registry ground truth. Commit `cef8ba05`.

Sibling half (`room_bind` `no_session_id` on stdio) was **already fixed** before this session
started (`.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`,
commit `c123f3d7`) -- caught by REUSE-CHECK before nearly duplicating the debug session.

### 3. Phase 233 (SEED-037 residual) -- planned, executed, reviewed, fixed, verified, CLOSED

SEED-037's own RCA (`.planning/debug/graph-derive-silent-clear-dead-api-derivation.md`)
already had 3 of 5 original root causes fixed by Phase 224-02 (2026-07-23, four days before
this session even started) -- REUSE-CHECK caught this too, so Phase 233 was scoped to ONLY
the residual "Still OPEN" register (4b/4c/4d/4e/9-defect-4/9-defect-5), reserved as Phase 233,
planned as 3 waves, executed, code-reviewed (1 critical + 4 warning found), all 5 fixed with
negative self-tests, verified (12/12 observable truths, all 6 requirement IDs confirmed),
marked COMPLETE in ROADMAP.md.

**Best beat, worth re-reading if you want the shape of the whole session:** the exact
"confident success reported over an empty/wrong result" failure class this phase exists to
close recurred INSIDE the fix, twice -- once in the new doctor check's own status/detail
self-contradiction (CR-01, code review), once in the heal-pipeline printing "wrote 20
connection edges" into a room that finished with zero because a rebuild step wiped what an
earlier stage had just written (found only by running the pipeline against real data, not by
reading the code). Both fixed, both proven with negative self-tests (revert, confirm the test
fails on old code, re-apply).

**Full commit range:** `cef8ba05` (rooms-open) through `02506ba3` (phase marked complete) --
see `git log --oneline cef8ba05..02506ba3` for the whole trail if you need it.

### 4. v1.15.3-beta.50 -- cut, released, independently verified live

Ran `scripts/release.sh --prerelease --allow-ahead` (one pre-flight failure first: a stale
`skills/doctor/SKILL.md` mirror from Phase 233's new doctor class, fixed via
`node scripts/build-skill-mirrors.cjs`, commit `21455db9`). Full release succeeded:

- Tag `v1.15.3-beta.50` confirmed on origin via `git ls-remote` (not just the script's report)
- `npm view @mindrian_os/cli@1.15.3-beta.50 version` confirms the real npm registry has it
- `mindrian-os.com` live-polled and confirmed serving the new version (234s)
- Marketplace catalog confirmed at `1.15.3-beta.50`
- `doctor --acceptance` (full): 15/15
- `plugin.json` now correctly at `1.15.3-beta.51` (next in-progress line)

**This means:** the `rooms-open` fix, all of Phase 233, AND two pre-existing but
never-released `check-card-fire.cjs` fixes (see #5) are now genuinely live and installable
via `claude plugin update mos`, not just committed.

### 5. The deployment-gap RCA -- STILL OPEN, explains a LOT, read this before doing more card-fire work

`.planning/debug/live-session-running-stale-plugin-cache-fixes-inert.md` (status:
`investigating`, four independently-documented occurrences across three weeks). Claude Code
plugins execute from an installed marketplace cache pinned to a released version, NOT the dev
repo directly, and a running session doesn't hot-reload even after a release ships (in-memory
require-cache). This is why the notification-only-turn gate misfire (see #6) kept firing live
throughout this ENTIRE session even though its fix (`18cc9b8b`) was already merged five days
before this session started -- it just was never released until today's beta.50 cut. Also
cross-links a documented upstream Anthropic bug (`claude plugin update` can misreport
"already at latest" when it isn't -- `docs/upstream-reports/2026-04-28-claude-plugin-update-misreports-state.md`).

**Open next_action from that RCA, unchanged:** cut releases regularly (now done, at least
once); point affected testers at `/mos:doctor --fix` as first-line workaround over repeated
`claude plugin update` retries.

### 6. `check-card-fire.cjs` cluster -- PARTIALLY fixed and NOW LIVE, re-score before doing more

Two fixes already existed on `main` before this session, now actually shipped for the first
time via beta.50:
- `18cc9b8b` -- stops force-firing Decision Gates on notification-only turns (zero
  human-authored preceding text). This is THE bug that fired the F.8/F.1 room-bind and reach
  cards repeatedly, incorrectly, all through this very session -- every single time skipped
  as noise rather than dispatched, per the standing judgment-gated rule. **A fresh session
  after this release is the first real chance to observe whether it actually stops.**
- `f63d1ddc` -- removes an invalid Stop-hook `hookSpecificOutput` shape that was silently
  replacing calm decision text with a raw JSON-validation dump; closed structurally via a new
  release-time schema check.

**Still genuinely open in this cluster** (per `/home/jsagi/.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`
in the PERSONAL notes repo, not this one -- 8 logged instances as of 2026-07-22):
- Instance 6: `room-registry list` trusts a stored registry field instead of cross-checking
  disk (a DIFFERENT bug from anything fixed this session).
- The "answered gate re-fires within the TTL window" idempotency gap
  (`.planning/debug/card-fire-answered-gate-refires-within-ttl-window.md`, status:
  investigating, NOT touched this session).
- Instance 8, hedged/plausible: an `ascii-box-backstop-no-card` false positive on a plain
  clarifying question, not confirmed independent of a concurrently-legitimate gate.

**Recommended first move in a new session:** re-verify live whether `18cc9b8b` actually stops
the notification-only misfire now that it's released (this session literally cannot test this
-- it's running stale in-memory code per #5). If confirmed working, re-score the remaining
open instances (they may or may not still reproduce) before promoting the residual scope to
its own phase.

### 7. SEED-074 and SEED-075 -- reviewed, correctly self-gated, NOT actioned

`SEED-074` (local graph read layer lacks salience/query-time-joins) and `SEED-075` (grading
against an ungrounded framework produces false contradiction-confidence) were both reviewed
this session. Both are genuinely well-formed, already ran CONSULT + REUSE-CHECK before this
session's Critical Pathway even existed, and are correctly held as Tier 3 (exploratory,
explicitly gated, not yet triggered). Do not promote either without their own stated trigger
firing. SEED-074's own "suggested first move" (a density read on doctor output) was ALREADY
separately shipped via Phase 232.1, four days before this session started -- confirm before
assuming it's still undone.

### 8. Instatic (`github.com/corebunch/instatic`) -- assessed, NOT a wiki replacement

Navigator asked whether it should replace the SEED-006/SEED-054(RAG) wiki-sprint plan. Verdict:
no -- wrong data model (its own Postgres/SQLite tables vs. this repo's markdown+room.db graph),
wrong deployment bet (needs a hosted server+DB+auth, breaks Tier-0 zero-infra), wrong JTBD
(building new marketing sites vs. rendering an existing knowledge graph). MIT license does
clear the one bar that killed Docmost/AFFiNE in SEED-066, for what it's worth. Might be worth a
second look ONLY if the room's external-facing SnapshotHub arc ever wants a real visual-builder
layer -- a different seed than the internal wiki, don't conflate them. Not filed as a seed
(genuinely novel, checked via room_search, nothing to cite).

## KEY DECISIONS / REFRAMES (this session)

- **REUSE-CHECK before PROMOTE, always** -- proven twice: SEED-037 was ~60% already shipped
  (Phase 224-02), and `room_bind`'s stdio bug was already fixed before this session started.
  Ten minutes of checking saves weeks of re-solving.
- **A "fixed, durably" claim two commits deep doesn't mean live** -- the deployment-gap RCA
  (#5) is the sharpest version of this lesson this session surfaced: code on `main` has zero
  effect on any running session until a release ships AND is actually picked up.
- **Ground truth over prose, at every layer** -- this session independently re-verified
  background-agent claims repeatedly (an "Idle." notification that actually held real
  committed work; a code-review agent's mid-stream API failure that still wrote a complete,
  valid REVIEW.md) rather than trusting status strings. Same discipline applied to the release
  itself: tag/npm/website/marketplace all checked directly, not just the script's own "complete"
  banner.
- **Engine-fired reach cards this whole session were noise, correctly skipped** -- dozens of
  F.1/F.8 gates fired against rooms and artifacts with zero connection to the actual
  conversation (a stale `claim:derive` artifact, `jonathan-contractor-motj`, `oldroom`, random
  room-bind prompts). Per the standing judgment-gated rule, none were dispatched. This turned
  out to BE live evidence of the exact bug fixed in `18cc9b8b` (#6) -- the notification-only
  force-fire mechanism -- reproducing turn after turn in real time throughout the session.

## PROVENANCE / OPEN THREADS FOR THE NEXT SESSION

1. **Verify `18cc9b8b` actually works now that beta.50 is live** -- start a fresh session
   (this handoff exists for exactly that), watch whether the F.1/F.8 notification-only misfire
   still reproduces. This is the single highest-value first check.
2. **Re-score the `check-card-fire.cjs` cluster's remaining open instances** (see #6) once
   #1 is confirmed one way or the other -- do NOT assume they're all fixed, do NOT assume
   none of them are.
3. **`.planning/debug/card-fire-answered-gate-refires-within-ttl-window.md`** -- status
   `investigating`, root cause already hypothesized (no "answered" flag on gate mints), not
   touched this session. Candidate for the next `/gsd-debug continue card-fire-answered-gate-refires-within-ttl-window`.
4. **`deferred-items.md` in Phase 233's directory** -- 3 small items logged, non-blocking:
   an opt-in Pinecone Tier 2 egress needing a Part 8 ruling, a sibling nodeify-scope gap
   between JS/Python walkers, and `scripts/__pycache__/*.pyc` files tracked in git (also
   independently re-confirmed dirtying the tree this session -- worth a `.gitignore` entry +
   `git rm --cached` as its own small task).
5. **`.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`**
   lives in the PERSONAL notes repo (`/home/jsagi`), not this one -- read it fresh, it may
   have new instances logged since 2026-07-22 that this session never checked.
6. **Rest of the Jul-7 seed triage's Top 10**, ordered per that triage unless re-scoring moves
   them: SEED-054 (BQ + RAG), SEED-023 (meeting DIKW v2), SEED-031 (regulation layer),
   SEED-052 (GSD-each-command), SEED-053 (run_chain MCP tool), SEED-006 (wiki sprint, now
   composes with SEED-054-RAG), SEED-025 (Futures Wheel grand vision), SEED-012 (Feynman
   Mom-Test panel). None of these were touched this session.
7. **SEED-062 through SEED-073** (host-runtime / collaborative-editor direction) -- navigator
   already chose a direction (2026-07-21) but it is still not scoped into a phase. Untouched
   this session.

---
*Written 2026-07-28, end of session. Repo: `/home/jsagi/dev/MindrianOS-Plugin`, branch `main`,
HEAD at the time of writing: `02506ba3` (release commits) then bumped to beta.51 by the release
script's own next-bump commit.*
