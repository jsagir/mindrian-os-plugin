# Phase 267: MCP Stateless Protocol Migration -- Handoff

Status: IN PROGRESS, paused by navigator request 2026-09-24. Safe to resume any time. NOT a release blocker (see "Release status" below).
Owner: Claude Code GSD in `/home/jsagi/dev/MindrianOS-Plugin` on Ubuntu WSL.
Paused by the user mid-267-07 (letting it finish its own current task rather than interrupt mid-edit) with an explicit "halt and continue later" -- not a failure, not a blocker hit.

## Mission

Migrate the local `mindrian-os` MCP server (both stdio and HTTP branches), the brain stdio shim, and the two in-repo MCP clients from SDK v1 to the v2 package family (`@modelcontextprotocol/{server,core,client}`), hand-migrating all 51 variadic registration sites (no codemod -- measured to do nothing useful on this repo's CJS `require()` style). `mcp-server-brain/` (dead service), Theo (separate repo, its own v1-pin decision), and `lib/core/brain-client.cjs` (hand-rolled 2025-era client) are explicitly OUT OF SCOPE -- do not touch, do not "helpfully" migrate them.

Full detail lives in two files, both already written and locked -- **read both in full before doing anything**:
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-CONTEXT.md` -- locked scope, sequencing, three navigator rulings (elicitation-gate UX, zod-boundary discipline, accept-looser-zod-schemas), cross-repo boundaries.
- `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-RESEARCH.md` -- the 2026-09-23 force-refresh (677+ lines, HIGH confidence, everything live-verified this session, not inferred from docs). The ORIGINAL 2026-08-27 research's premise and primary recommendation are both WRONG and superseded -- do not read that history and re-derive the old (withdrawn) Brain-server-first split.

## Release status (answering the obvious question first)

**Phase 267 is NOT needed to cut a release.** The repo is fully functional on the v1 SDK today. Every landed plan is a clean, independently-tested, zero-regression commit -- there is no half-migrated broken intermediate state by design (dependency bump first in 267-03, hand-migrate one file at a time while v1's `McpServer` import stays live, the actual SDK swap doesn't happen until 267-11 of 18). A release can be cut at ANY commit in this sequence.

## Current status (2026-09-24, as of pause)

**5 plans fully landed and checked off in ROADMAP.md:** 267-01 (test scaffolding + baseline), 267-02 (7 RCAs filed), 267-03 (zod 4 + SDK 1.30.1 bump, zero regressions), 267-05 (brain shim canary migration, proved the v1->v2 pattern), 267-06 (12 of 51 registration sites: tool-router.cjs, contract-version.cjs).

**267-04: 2/3 tasks done, genuinely blocked on a human action, NOT resumable by an agent.** The tee-probe tool is built and CLI-verified (`267-TRIPOLAR-PROBES.md` has the CLI result already). Task 3 needs the navigator to physically run two ~5-minute probes:
- **Claude Desktop:** add the `mindrian-os-tee` config block (exact snippet, absolute paths already filled, in `267-TRIPOLAR-PROBES.md`'s Desktop section) via Settings -> Developer -> Edit Config, restart Desktop, say "list my rooms" once, `cat /tmp/mos-tee-desktop.jsonl`, paste back the first 3 lines, then remove the block and restart again.
- **Cowork:** in a Cowork session ask Larry to run `status_read`; in that VM's terminal run `ps aux | grep mindrian-mcp-server` and `env | grep -E "CLAUDE_SURFACE|COWORK_SESSION_ID"`, paste the output. `cowork-deferred` is an accepted answer if no VM is reachable.
- If Desktop's handshake shows `server/discover` or a `2026-07-28` initialize (unlike CLI, which measured 2025-era on stdio), the navigator ALSO needs to rule: accept rung-(b) AskUserQuestion on Desktop, or hold the `serveStdio` adoption there. This gates 267-11 specifically; nothing else downstream needs it until then.
- Only 267-11 (wave 9) and 267-18 (close-out) depend on this data. Everything else can proceed without it.

**267-07: IN PROGRESS when paused, NOT yet landed.** Confirmed via `git log --oneline --grep="267-07"` at pause time: RCA 3 fixed (gate.cjs's stale elicitation comment -- Claude Code 2.1.280+ actually declares elicitation now), gate.cjs migrated (2 sites), a fixture fix, chain.cjs migrated (2 sites). Last known dirty file before pause: `lib/mcp/tools/claim-verify.cjs` (mid-edit, its own target file per the plan -- this is expected in-progress state, not drift). **First action on resume: run `git log --oneline --grep="267-07" -10` and `git status --short`.** If a `docs(267-07): complete...` commit exists, 267-07 is done -- read its SUMMARY.md and move to 267-08. If not, and `claim-verify.cjs` (or whichever file) is mid-dirty with no orphan process, the plan's own executor either finished on its own after the pause or needs a fresh executor spawned to finish it (read `267-07-PLAN.md`'s remaining tasks and continue from the last committed task -- do NOT restart from Task 1 if earlier tasks already landed cleanly).

**Remaining after 267-07: 267-08 through 267-18 (11-12 plans).** Full locked sequence:

| Plan | Locked stage | What |
|---|---|---|
| 267-08 | W2 | more registration rewrites |
| 267-09 | W2 | RCA 4 fix (prompts.cjs bogus args schema) + more sites, completes ALL 51 local-server sites |
| 267-10 | W2 | RCA 2 fix (app-views.cjs `schema:` -> `inputSchema:` bug) + ext-apps 2.x + realpath containment on the newly-live `room_path` (security-hardened per plan-checker W2 -- resolved path must be strictly inside a room, not the rooms-home root itself) |
| 267-11 | W2 | swap the actual `McpServer` import to v2 + `serveStdio` on stdio -- **gated on 267-04's Desktop result** |
| 267-12 | W3 | RCA 1 fix: `createMcpHandler` on the flag-OFF HTTP branch (the real, independently-broken one-request-per-process bug) |
| 267-13 | W3 | RCA 5 fix (SIGTERM no-exit, proven to be in shared `registerShutdownHandler`, not HTTP-specific) + RCA 6 fix (Express 5 EADDRINUSE false-"started" bug) |
| 267-14 | W3 | flag-ON daemon: `isLegacyRequest` + `legacy:'reject'` routing (keeps room-binding sessionful, unchanged architecture per CTX ruling) |
| 267-15 | W3 | the two in-repo MCP clients migrate; RCA 7 (flag-ON shim session-id rejection) gets PINNED here with an explicit test proving today's broken behavior -- this is NOT a bug to fix in this phase, CONTEXT.md rules re-architecting room-binding identity out of scope. Read the RCA text: with the flag on, the DOCUMENTED hook-driven case is the one that's broken, not an edge case. |
| 267-16 | W4 | move remaining v1-importing tests to v2 |
| 267-17 | W4 | remove the v1 SDK dependency from package.json/package-lock.json/npm-shrinkwrap.json LAST |
| 267-18 | close | final gates, Tri-Polar verification (needs 267-04's Cowork result or an explicit deferral), requirement registration (MCPV2-01..19 into REQUIREMENTS.md), 4 follow-up seeds, dual-home research trail |

An independent `gsd-plan-checker` review already passed this whole 18-plan set (0 blockers, 5 warnings; the 2 real ones -- RCA 7's understated impact, and the room_path==home security gap -- are already fixed in the plan files themselves, commit `211030b13`). No need to re-check the plans, just execute them.

## How to resume (exact commands)

1. `cd /home/jsagi/dev/MindrianOS-Plugin && git status --short` and `git log --oneline -5` to see the live state.
2. **Check for other active Claude sessions first** (see "Concurrent sessions" below) -- this repo has had 6+ other Claude Code sessions working it simultaneously all day. Use whatever cross-session tooling is available (`ListAgents` in Claude Code) before assuming a clean solo tree.
3. Resolve 267-07's actual state per "Current status" above.
4. For each remaining plan (267-08 onward, in order -- the dependency chain is strictly linear, `use_worktrees=false` so execution is fully sequential anyway), spawn an executor with the plan file, `267-CONTEXT.md`, `267-RESEARCH.md`, and the immediately-prior plan's `SUMMARY.md` as required reading. `gsd-executor` was briefly unavailable mid-session (a peer's GSD plugin reload) and came back on its own -- if it's missing again, `general-purpose` with the same detailed instructions works as a drop-in (this session used it once, for 267-07, successfully).
5. **Mandatory conventions established this session, all plans already instructed to follow them, keep enforcing on any fresh spawn:**
   - `git commit --only -- <files>` for every commit, NEVER `gsd-tools query commit --files` (that tool commits whatever is currently staged, ignoring its own `--files` arg -- it swept peer work into commits twice during Phase 354).
   - `git status --short` immediately before every commit; unstage anything not yours with `git restore --staged <path>` (index-only, safe).
   - STATE.md: append an ADDITIVE note under "Current Position", never overwrite Phase/Plan/Status -- another session (Phase 355) owns that field live, all day, throughout this one.
   - `gsd-tools query roadmap.update-plan-progress` has repeatedly introduced unrelated blank-line drift in OTHER phases' ROADMAP sections and once incorrectly flipped a still-blocked plan's checkbox (267-04) to `[x]` based on SUMMARY.md presence alone, not actual completion -- always diff the full ROADMAP.md change before committing, hand-edit if needed.
   - Never touch `mcp-server-brain/`, `/home/jsagi/Theo`, or `lib/core/brain-client.cjs`.

## Concurrent sessions (as of pause, 2026-09-24)

This repo had AT LEAST these other active Claude Code sessions today, all coordinating cleanly via cross-session messages: jsagi-d9 (Phase 355), jsagi-a7 (closed Phase 356), jsagi-e0 (Phases 357/359/360, had one `git reset --hard` incident recovering wiped uncommitted files -- resolved, nothing of this phase's was affected), jsagi-c2, jsagi-8f (release management -- cut/postponed beta.48/49, may still be active). **Do not assume a solo tree.** Multiple real collisions happened and were all resolved cleanly this session; the pattern is: check first, coordinate, never revert unowned diffs, `git commit --only`.

## Pre-existing, permanently-unowned dirty/untracked files -- NEVER touch, NEVER stage, NEVER commit

As of pause: `scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`, `evals/plurai/211-baseline.json` (its diff is just a `date` field, someone else's eval run), `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` (untracked), `docs/reviews/mindrian-system-atlas.html` (untracked). None of these are Phase 267's; they were pre-existing before this phase started and were confirmed-unowned repeatedly across many hours by multiple sessions.

## Deferred items log

`.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/deferred-items.md` accumulates pre-existing, out-of-scope test failures found along the way (none are this phase's to fix). Check it, add to it, never silently drop an entry.

## Claude Code start message

"Work in /home/jsagi/dev/MindrianOS-Plugin on WSL. Resume Phase 267 (MCP SDK v1->v2 migration, local server only). Read this handoff in full, then `.planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-CONTEXT.md` and `267-RESEARCH.md`. Check other active Claude sessions on this machine before touching anything shared. Resolve 267-07's actual current state, then continue executing 267-08 through 267-18 in order, one gsd-executor spawn per plan, enforcing the git-commit-only and additive-STATE.md conventions this handoff documents. Phase 267 is not a release blocker -- do not let release-cut urgency from another session change this phase's own pace or scope."
