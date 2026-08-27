# HANDOFF: Goal-Directed Phase Sweep (Phases 265-271)

**Date:** 2026-08-27
**Session goal (standing `/goal` directive, still active):** "do research in all commands and make the optimal to their goal utilizing sub-agents dispatching, whether parallel and/or sequential" -- expanded mid-session to "do all the GSD phases until a final ready to cut a new version with this optimality." Explicit boundary: drive everything through to release-gate-passing, but **do not run `scripts/release.sh <version>`** without explicit navigator go-ahead.

**Read this first if you're a fresh session picking this up.** This sweep ran for many hours across a heavily shared working tree (at least 3 other concurrent sessions were active on this same repo at various points -- `jsagi-da`, `jsagi-0f`, `jsagi-6e`). Every phase below was independently re-verified, not just trusted from its own executor's self-report, per a discipline this session learned the hard way on Phase 266 (see "The core lesson" below).

---

## Phase status at handoff time

| Phase | Status | Notes |
|---|---|---|
| **265** (Capability Radar Absorption + Routing) | **COMPLETE** | 23/23 plans, 5 waves (collapsed from 6 by DAG), independently re-verified twice (mechanical + adversarial code review). Two real security/HITL bugs found and fixed post-hoc (see below). |
| **266** (MCP Layer Correctness Fixes) | **COMPLETE** | 5/5 plans (04 required a gap-closure pass, 266-05). Real gap caught by independent verification: a per-call timeout budget that didn't hold in aggregate (60s vs 30s host budget) -- fixed and re-measured (15.2s post-fix). |
| **267** (MCP Stateless Protocol Migration) | **BLOCKED** | Corrected scope: local `mindrian-os` server only (Brain-server migration is Theo's job, not this repo's). Blocked on an un-investigated upstream `ext-apps` peer-dependency pin. **Do not plan or execute until that blocker clears or is confirmed workaroundable.** |
| **267.1** (Hooked Model Completeness Audit) | **COMPLETE** | 6/6 plans. Found real gaps: Reward leg is a promise with no wired call; Investment leg (`~/.mindrian-user.md`) had zero writers. Navigator ruled: score stands (30/70), SEED-021 fix reversed and deferred to 267.2, sequencing confirmed. Phase 267.2/267.3 registered as follow-ups. |
| **267.2** (First-Install Hooked Loop Repair) | Registered, not planned | Inherits: W0 (revert 267.1's SEED-021 line + invert its test pin), W1 (Reward routing -- now carries an explicit navigator design input: replace the static cold-start menu with a Brain-backed, context-sensitive greeting that asks new/continuing/curating/first-time/just-talk, empirically validate before building), W2 (Investment writer -- **now largely obsoleted by Phase 270's plan 270-11**, which ships a caller for the exact same `writeUserMdAtomic` function; check 270's final status before replanning this). Sequenced behind Phase 269. |
| **267.3** (Guard Jurisdiction) | Registered, not planned | Independent of 269. The one 267.1 finding with no collision (the enforcement linter only scans `commands/*.md`, never hooks -- `scripts/session-start` is invisible to its own guard). |
| **268** (Transition Selected Workflows to MCP Tools) | Scoped, not planned | W1: promote `find-bottlenecks`/RS-engine (real `outputSchema`) and `eureka` (onto the native Tasks extension) to MCP tools. W2: token-economics sweep of ~30 "runs code" commands with designed schemas, not just verdicts. |
| **269** (Moat Shift -- Install/Update Entitlement Gate) | **01-04 done, 05 blocked externally** | Navigator-locked: Brain/Theo access becomes keyless/unconditional at cutover; the entitlement check moves to install/update time via the unified existing Brain-key credential; gate mechanism is refuse-to-operate, stays public (no privatized distribution). `decisions.md` #1/#5 and `moat.md` updated and live on disk. 269-05 (the website-facing spec doc) correctly halted: 3 of 6 Theo-readiness preconditions fail (Theo's own Phase 8/9 both still `Plans: TBD`). **Nothing to force here -- re-check when Theo's roadmap moves.** |
| **270** (Memory and Context Operator MCP) | **In progress** | Research rejected the original "one mega-tool" premise after finding this repo already tried that pattern once (`tool-router.cjs`) and it dropped per-operation safety tracking -- verdict: collapse duplicative reads, keep every write atomic. 12 plans, 7 waves. Wave 1's decision gate answered (DEPTH_CAP: keep the frozen cap, expose structure beyond it; identity-write: ship the caller now, defer the trigger to 267.2; 13 undeclared MCP tools: exempt like `eureka_critic`). Resumed past the gate; waves 2-7 were running at last report. **Check `a10c9b22d96329dd2`'s next notification for the real outcome** -- do not assume it finished. |
| **271** (Bare Reference-Path Resolution Audit) | Filed, not planned | Triggered by a concurrent session's RCA (`.planning/debug/file-meeting-missing-reference-files.md`): `commands/file-meeting.md` had 19 bare `references/...` citations that resolve against session cwd instead of the plugin install dir -- fixed for that one file, verified, **not yet released**. Independently re-confirmed: 45 of 113 `commands/*.md` files share the exact pattern. This phase audits the other ~44 (a bare mention isn't automatically a bug -- confirm each), anchors genuine hits, and adds a structural lint so the class can't silently reappear. |

---

## The core lesson this whole sweep operated under

Phase 266's own gap (a fix that passed its own tests but didn't hold under adversarial/independent re-verification) became the standing discipline for every phase after it: **never mark a phase complete on green tests alone.** Phase 265 applied this at the end by running a full adversarial code review after all 23 plans passed their own tests -- it found two real bugs (see below) that no plan's own acceptance criteria could have caught, because each plan was checking its own promise, not verifying it against the wire.

## Two real bugs the adversarial review caught (Phase 265, both fixed)

1. **`commands/scout.md`'s competitor fan-out actually had Write + Brain access**, despite its own prose promising "writes nothing, no Brain." Fixed by minting `agents/competitor-watch-fetcher.md`, genuinely read-only.
2. **`commands/vault.md` had a real human-gate bypass regression** -- it re-invoked a file-routing step *before* asking the navigator to confirm, instead of after. Fixed by reordering.

Both are documented in `265-REVIEW.md`. Lower-severity findings (WR-01/03/04, IN-01/02) are deliberately deferred there too, not silently dropped.

## A real, tracked-but-unfixed gap: file-meeting's dedup is exact-match, not semantic

Mid-sweep, a concurrent investigation correctly identified that this repo already has everything needed for semantic claim deduplication/axial-coding via `lib/core/eureka/embedding-spine.cjs` (pure-JS, `@huggingface/transformers`, zero Python -- SEED-013/Phase 134 shipped this) and `vector-store.cjs` (sqlite-vec-backed similarity search), and that reaching for Python packages (semantic-clustify, dedupe, Splink) would have violated both SEED-013 (no Python on the user's machine) and Canon Part 7 (reuse before build). This was relayed to the running Phase 265 process before plan 265-19 executed. Verdict, confirmed empirically: **265-19's dedup is segment_id-exact, not semantic** -- narrower than first suspected but real. Recorded as a ledger row in plan 265-23, not fixed inline (correctly -- an already plan-checker-verified plan shouldn't be silently rewritten mid-execution). **This is a good candidate for its own small follow-up phase**, using the reuse shape already scoped: embed via `embedding-spine.cjs` -> query `vector-store.cjs` for nearest neighbors above a threshold -> mint a `REFINES` edge instead of a new node.

## Cross-repo state (three repos touched this session)

- **`/home/jsagi/dev/MindrianOS-Plugin/`** -- this repo, everything above.
- **`/home/jsagi/Theo/`** (separate repo, its own GSD `.planning/`) -- Theo is the confirmed designated Brain replacement (per its own `package.json`: "MindrianOS's consolidated MCP server over the Book of Innovation graph"), already ahead on `@modelcontextprotocol/sdk@1.30.0` and `zod@4.4.3`. Its own Phase 9 ("Brain-Contract Cutover") was seeded this session with a "Resolved 2026-08-27" note answering its `brain_ask`/`brain_query`/`brain_search` open doctrine question (keyless/unconditional at cutover, per Phase 269's decision) -- the other three open doctrine questions there are untouched. Theo's Phase 9 itself is still blocked on its own Phase 6/8 (`Plans: TBD`) -- this is what Phase 269-05 and Phase 267.2's full closure are both waiting on.
- **`/home/jsagi/dev/mindrian-website/`** -- read-only investigation this session (Gaurav Thorat's double-sign-in root cause: no canonical-domain redirect between `mindrian-os.com` and `mindrianos-jsagirs-projects.vercel.app` in `next.config.ts`/`AuthButton.tsx`/`auth/callback/route.ts`). Deliberately deferred, now explicitly tied to Phase 269's install/update entitlement gate -- same files, same auth flow, two reasons to touch it. **No edits made there this session.**

## Known, recurring operational bugs hit repeatedly this session (not this sweep's to fix, but worth knowing)

- **STATE.md resync-clobber bug**: `gsd-tools` STATE.md-writing verbs (`state.begin-phase`, `phase.complete`, etc.) have overwritten STATE.md's frontmatter with stale content **9+ confirmed times** this session alone. Every occurrence was caught via a pre/post diff, reverted, and hand-documented in STATE.md's own NOTE blocks following established precedent. If you hit a 10th, do the same -- diff before every `state.*`/`phase.*` write, never trust it blindly.
- **Room-bind gate bleed**: this session's tooling repeatedly fired a "which room should this session write to" card with a different room list almost every turn, despite this being pure dev-repo GSD work with zero room-artifact filing. Explicitly answered "dev repo, no room" and separately confirmed as known noise -- a fresh session may see this recur and should apply the same judgment (a dev-repo GSD session doesn't need a room bind).
- **`phase.add`/`phase.insert` heading bug**: consistently dumps the full phase description into the ROADMAP.md H3 heading instead of a short title. Every phase created this session (265/266/267.1/269/270/271) needed a manual follow-up edit to split it into a short title + a proper `**Goal:**` body. Expect this on the next phase you create too.

## Explicit "do not" list for whoever picks this up

- Do not run `scripts/release.sh <version>` without explicit navigator go-ahead -- irreversible (git tag, live marketplace, auto-updates every installed tester).
- Do not plan or execute Phase 267 until the `ext-apps` blocker is resolved or the navigator redirects.
- Do not re-fix `commands/file-meeting.md`'s bare-path bug -- already done, verified, just unshipped. Phase 271 is about the *other* ~44 files.
- Do not silently rebuild Phase 270's rejected "mega-tool" design if you see it proposed again -- the research explicitly tested and rejected it against this repo's own `tool-router.cjs` precedent.
- Do not treat a green test suite alone as proof a phase is done. Independently re-verify, especially for anything touching timing, aggregate behavior, or a promise made in prose ("writes nothing," "gate-preserving") rather than enforced in code.

## Immediate next steps, in likely order

1. Get Phase 270's actual final report (waves 2-7 outcome) -- was running at handoff time.
2. Decide whether to plan/execute Phase 271 (bare-path audit, ~44 files) now that 265/266 are clear.
3. Decide whether to plan Phase 268 (MCP tool promotion) or 267.2/267.3 (Hooked Model follow-ups) next.
4. Once 265/266/267.1/269(as far as it can go)/270/271 are all settled: run `scripts/verify-release` to check actual release-readiness against the five-gate lockstep, before considering a version cut.
5. Separately, unrelated to the phase sweep: Gaurav Thorat's Windows CLI-preinstall/EBADENGINE doc gaps are still open, small, and independent -- a good `/gsd-quick` candidate whenever convenient.
