# HANDOFF: v2.0.0 "Build the Loop" close-out runbook

**Date:** 2026-08-10 (end of the all-day build session on the WSL dev machine)
**For:** the next session (any machine; commands below assume the WSL dev checkout)
**State:** ALL machine-executable work of milestone v2.0.0 is DONE, pushed to
`jsagir/mindrian-os-plugin` main (HEAD at or after `aad6ba38`). What remains is the operator
ceremony below, in order. Nothing here is unknown work - every step has a plan, a probe, or
a one-line command.

---

## 1. Where the milestone stands

- Phases 246-252: researched, planned, checker-gated, executed. **Phase 248 fully CLOSED**
  (CTX-01/02/03 checked; the July room_bind RCA moved to `.planning/debug/resolved/`).
- The honesty rail is live in dev: four refusal kinds, shim conflation fixed, doctrine
  killed at 10 of 11 sites (site 11 flips in 252's release), `refusal-messaging.cjs` is the
  chokepoint's real name now.
- The doctrine amendment is RATIFIED (`docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md`),
  doc-now/rows-at-sweep; rows flip inside the v2.0.0-beta.1 release commit (252-03).
- SEED-011 Option A is BUILT: `/register` endpoint (brain repo, LOCAL commits, unpushed) +
  plugin silent-registration ladder leg (keyed users always win).
- Cache hygiene landed: full nav block 1,432 -> 816 B, repeat turns -> 45 B; budget fence
  1,100 B; analyzer `scripts/cache-hitrate-report.cjs`.
- Enrichment machinery live: queue seeded with 24 census gaps; floor gate honestly RED
  (4/28 flagships at >= 3/4); alias collapse + live enrichment await the ceremony.
- Requirements: ~11 of 23 checked in `.planning/REQUIREMENTS.md`; each unchecked one is
  named to a gate below.

## 2. TODAY'S CRITICAL LIVE FINDING (read before anything else)

**beta.13's shipped plugin Brain path NEVER WORKED in production.** Executed live 2026-08-10
(`.planning/phases/246-live-verification-graph-census/246-01-LIVE-RESULT.md`): the shipped
brain-client returns null against the server deployed 2026-08-09; the beta.13 shim then
mislabels that as "MINDRIAN_BRAIN_KEY not set". The DEV client works perfectly with the same
key (28,325 nodes). So: every beta.13 install has a dead Brain leg wearing a wrong error
message, npm @latest serves that installer, and **v2.0.0-beta.1 is the fix vehicle - this
raises the release from ceremony to outage fix.** Also: /health stayed green throughout -
AVAIL-01 monitoring must probe through the shipped-client path, never /health alone.

## 3. THE RUNBOOK - in order, with resume signals

**Step 1 - push the brain repo (ONE command, unblocks everything):**
```bash
cd ~/dev/ProblemsWorthSolving-Brain && git log --oneline origin/main..HEAD   # expect 8 commits incl. 01ac1fc register
git push origin main
```
Render autodeploys both brain services from main. Then (any session can do this part):
watch the deploy via the render MCP (`list_deploys` for srv-d9gfa03tqb8s73csfmtg until
live), probe `POST https://pws-brain-mcp.onrender.com/register` (expect 200 with a token
for a fresh UUIDv4, 400 malformed, 429 on hammering), re-run
`node scripts/probe-brain-contract.cjs` from the plugin repo (the 4 previously-expected
failures should flip green EXCEPT index dispositions - the 7 drops still need the
CONTRACT-05 read tier or a local-twin surgery, deferred).
NOTE: the auto-mode classifier BLOCKED this session's unattended push - the push wants a
human keystroke or an explicit permission rule. Do not launder it through a subagent.

**Step 2 - Gate 0: the foreign-host verify (human hands, ~20 min):**
Install MindrianOS on ONE foreign host (VS Code, Cursor, Goose, or Zed) and observe it
load. This closes Phase 234-08 Task 2 (`.planning/phases/234-*/234-08-PLAN.md`), the last
substance of Gate 0. Record the observation in that plan's checkpoint.

**Step 3 - cut v2.0.0-beta.1:**
```bash
cd ~/dev/MindrianOS-Plugin && bash scripts/release.sh --start-prerelease
```
Gate 1 is already RESOLVED (v1.16.0 train folds in; beta.13 is its last car). 252-03's
release checkpoint governs: the cut carries the amendment-row flip + sweep together (the
lockstep). release.sh now auto-promotes npm @latest (navigator directive 2026-08-10).
Expect the marketplace + website lockstep steps; the npm publish had one transient DNS
retry precedent (recovery steps print on failure).

**Step 4 - post-release verification sitting:**
- `/plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` + RESTART.
- The five-step Brain test (docs/brain-audit-2026-08-10/...-brain-service-audit.md section
  12, PASS/FAIL/BLOCKED semantics) - this is what finally CLOSES LOOP-01.
- 250-04 Task 3's ten-step three-surface matrix (fresh-install, keyed-user, refusal legs,
  provenance absence) - closes HONEST-03.
- 251-02 Task 3: 10+ turn session, `node scripts/cache-hitrate-report.cjs <session>.jsonl`,
  expect hit_rate >= 0.91 + live suppression - closes CACHE-03.
- Real-host Desktop/Cowork room_bind legs (the CTX-03 named deferral in the resolved RCA).

**Step 5 - the enrichment ceremony (needs CONTRACT-05 or the local twin):**
249-03's plan: alias collapse (6 multi-match names), first ingest_framework dry-run diff
with the APPROVE/REJECT/DEFER fork, floor re-probe. Blocked on raw-Cypher access: the
navigator RULED bounded read tier (CONTRACT-05, not yet built - it is 247/CONTRACT-05
server work in the brain repo). Until built, the only paths are a temporary
BRAIN_HTTP_ADMIN=allow window or the local twin. 252-02 stays honestly paused until the
floor goes green.

**Step 6 - odds and ends:**
- Suspend `mindrian-brain` (srv-d71t3vm3jp1c739i9fig) via Render dashboard after confirming
  no external key-holders (approved 2026-08-10); delete its dead `~/.claude.json` entry.
- AVAIL-01: stand up the scheduled shipped-client probe with out-of-band alerting (a cloud
  schedule or GitHub Action running probe-brain-contract.cjs; /health is proven
  insufficient).
- File the upstream Claude Code bug (malformed updatedToolOutput throws instead of falling
  back - repro in docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md section 5).
- Milestone close: /gsd-complete-milestone v2.0.0 once SWEEP-02/03 land in the release.

## 4. Traps this session paid for (do not re-pay)

- A running session NEVER hot-reloads the plugin cache; headless `claude -p` from a shell
  does not thread MINDRIAN_BRAIN_KEY into MCP children the way you expect - probe the shim
  over stdio directly when in doubt.
- /health green does NOT mean the Brain path works (proven today).
- Two executors sharing one checkout WILL race the git index - serialize or use targeted
  adds only.
- `query_relationship` BFS on langtalks returns zero-edge payloads - relationship_path only.
- The GSD progress counter counts SUMMARY existence, not content - a checkpoint SUMMARY
  reads as "complete" to the tooling; correct it manually (precedent in 246-01).
- Line numbers drift within hours - cite by content.
- `.planning/*` is gitignored; anything that must travel gets `git add -f` and a docs/
  pointer (this file follows its own rule).

## 5. PASTE-READY LOOP GOAL for the new session

Start the new session in `/home/jsagi/dev/MindrianOS-Plugin` and paste exactly:

```
/loop close out milestone v2.0.0 per docs/2026-08-10-HANDOFF-v2-close-out-runbook.md - work the runbook top to bottom: verify the brain push landed (ask me to run the one git push command if not - the classifier requires my keystroke), then watch the Render deploy and run every probe in Step 1, walk me through Gate 0's foreign-host verify, drive the release cut ceremony at my keyboard, run the post-release verification sitting with me, and keep the loop alive until LOOP-01, HONEST-03, CACHE-03 and SWEEP-03 are checked in REQUIREMENTS.md or a step is genuinely blocked on infrastructure I have not provided. Surface every operator moment as a card the second it becomes actionable. Fable plans and researches, sonnet implements, per .planning/config.json.
```

The loop's success condition, judged against REQUIREMENTS.md: LOOP-01, CONTRACT-02/03,
HONEST-03, CACHE-02/03, SWEEP-01/02/03 checked (or explicitly blocked-with-reason on
CONTRACT-05 / the enrichment floor), the v2.0.0-beta.1 tag on origin, and npm serving it.

## 6. Session-scoped state that does NOT carry over

The task list (15 tasks) is session-local - its state is mirrored in this runbook. The
navigator's rulings are all committed in REQUIREMENTS/ROADMAP/amendment docs, nothing
lives only in chat. The fable-plans/sonnet-implements model routing is in
`.planning/config.json` and persists.
