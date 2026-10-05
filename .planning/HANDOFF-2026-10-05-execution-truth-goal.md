# Handoff 2026-10-05: a new session runs `/goal` to fix every issue on the critical path

Written by session jsagi-70 at the navigator's request. Read this first, then the four documents it points at. Everything here was measured in the tree on 2026-10-05; treat anything else as history.

## The goal line to paste

```
/goal Fix every issue on the critical path in .planning/CRITICAL-PATH-2026-10-05-any-user-mac-win.md, in its order, through GSD: first the brief's Phase 0 (a read-only status table for every failure id against the current tree: reproduced, fixed, obsolete, needs evidence; raw outputs kept as fixtures); then the beta.59 quicks (no key on the Theo path; rooms on stock Mac and Windows; Desktop copy without the workspace build and the marketplace hotfix; basket and grant as cards); then adopt the real-room release rule in release.sh; then plan and execute Phase 369.2 from its brief; then 369.3, 369.4, 369.5, 369.6 in order, cutting a release behind the real-room rule after each; stop at every Decision Gate and report with measured numbers only.
```

## Where everything is

| What | Where | State on 2026-10-05 |
|---|---|---|
| The plugin | `/home/jsagi/dev/MindrianOS-Plugin`, branch `main`, HEAD 7ac63cdac, 0 ahead of origin | label 2.0.0-beta.58 (in progress); last cut v2.0.0-beta.57 on npm `latest` and `next`; the installed cache on this machine is beta.57 |
| The critical path | `.planning/CRITICAL-PATH-2026-10-05-any-user-mac-win.md` | eleven ordered fixes, the beta.59 list, the per-report coverage of Lawrence's Mac |
| The program | `.planning/seeds/SEED-PROGRAM-execution-truth-2026-10-05.md` | every filed item mapped once onto 369.2 to 369.6 |
| The phase brief | `.planning/phases/369.2-research-searches-online-for-real/369.2-ENGINEERING-BRIEF.md` | authoritative: the invariant, CODE/HARNESS/AI/UI register, Phase 0 to 4, 26 closure tests, behaviors to preserve |
| The register and the annex | same directory: `369.2-ISSUE-REGISTER.md`, `369.2-LARRY-ANNEX.md`, `369.2-INPUT.md` | SW-01..22, ACT, OK, REV; A01-A04, C01-C20; the input lists every ruling |
| The seeds | `.planning/seeds/SEED-114` to `SEED-120` | 115 promoted to 369.2; 114 and 117 to 369.3; 119 to 369.5; 116 to 369.6; 118 and 120 distributed |
| The roadmap | `.planning/ROADMAP.md` | 369.2 CRITICAL NEXT with its governing frame and three rulings; 369.3 to 369.6 inserted, 0 plans each; 370 waits |
| Research prompts | `.planning/research/PROMPT-architecture-and-redundancy-investigation-2026-10-05.md`, `ICM-PHASES-INTERROGATION-2026-10-05.md` | the redundancy prompt (13 candidates, three Theo surfaces); the ICM interrogation (ten contradictions with file:line) |
| The marketplace | `~/dev/mindrian-marketplace` (symlink `~/mindrian-marketplace`), branch `master`, HEAD f58ec49 | catalog at beta.57 with the Desktop copy; Desktop sync FAILS today (see item 3) |
| theo-context | `~/dev/theo-context`, HEAD 36bb39c, 15 files dirty from another session | the no-auth service at https://theo-context.onrender.com/mcp; my fix 5fb4e0f removed the `\p{..}` pattern from `canon_search`; registered in Claude Code user scope and in mos-platform's `.mcp.json` |
| Theo | `~/Theo`, HEAD 2d39df5 | Phase 25 closed; Phase 26 (Trending to the Absurd forward row + re-pin) is the navigator's, not yet run; the release bridge exits 30 until it lands |
| m:os-platform | `~/dev/mos-platform`, HEAD f31e379, 2 ahead of origin (unpushed) | greenfield; GSD-only; environment quick 261005-jtv done (`.mcp.json`, `docs/CAPABILITIES.md`); Figma OAuth pending the navigator's click |

## Rulings in force (navigator, 2026-10-04 and 2026-10-05; verbatim sources in the seeds)

1. The web search lines are free: no egress policy, fence or term filter; the one grant per run showing the exact strings is the only gate; every canvas perspective reaches the web. Canon Part 8 stays and means one thing: no room content to Theo.
2. Theo needs no key (measured: `tools/list` and `brain_stats` answer with no Authorization header). The plugin's own `MINDRIAN_BRAIN_KEY` gate, bearer, Tier 0 and `no_key` are removed outright; no key ever appears in user interaction.
3. The name is Theo on every surface; `brain_*` verbs may keep aliases one release.
4. Phase 369.2 is critical and next; its definition of done is the canvas layer working end to end on a real room (every perspective producing; the four template-only commands running through the planner; the SEED-118 room's twelve defects not reproducing).
5. Every Larry line names the job and the move, never a leaf id, a lane letter or a verdict code.
6. No cut without a real-room run read by a human (adopt in release.sh before beta.59).
7. Theo Phase 26 is the navigator's own task; the plugin does not wait for it; cuts use the three audited opt-outs until it lands.

## Measured facts a new session must not re-derive

- `datetime.UTC` is still at four sites: `scripts/room-registry:296`, `:515`, `scripts/resolve-room:157`, `scripts/on-cwd-changed:97`. Stock macOS python3 is 3.9.6; native Windows has no `python3`.
- `lib/core/brain-client.cjs:40` points at `https://theo-mcp.onrender.com`; lines ~492 and ~712 send a bearer Theo ignores; absent key returns "Tier 0, no Brain" / `no_key`.
- `lib/core/part8-egress-guard.cjs:60-110` allows a free-form Theo question only with one of 37 methodology tokens; `lib/workflow/cross-room-aggregator.cjs` refuses any query naming Haifa, Beersheba, Be'er Sheva, Ramat Gan, Tel Aviv, Jerusalem, Herzliya, Netanya.
- `lib/core/research-planner/families.cjs` now has `composableQuery` (web, 200 chars, room phrases) beside `composableTerm` (Theo, strict); quick v16 (commits 6d789ed8a, affafb368, 7b83bfb26, ad5991618, 39d085926); run-all-366 70/0, run-all-363 45/4 with four pre-existing reds (216 shape strict, 220, 221, 3551 incl. the ledger missing /mos:scientific-roadmap, 361 incl. test-fileval-readback "database is not open", no-new-dependency drift).
- The Desktop payload's only non `[A-Za-z0-9._/-]` paths are 48 bracketed and 2 `@` names, all inside `lib/ui-shell/dist`; the navigator's local-zip import of the full payload failed with "Zip file contains path with invalid characters"; the verdict on the no-shell zip (`mos-desktop-2.0.0-beta.57-noshell.zip` in Downloads) is still owed by the navigator.
- The in-progress version label is always one behind the cut (tags 51, 53, 55, 57); the next cut will be beta.59.
- `/mos:dashboard` has five renderers; only the shell has a control path; the shell's full stack is written up in session jsagi-70's reply of 2026-10-05 (the eight layers); the ICM interrogation lists two JTBD job lists (13 and 20) and many active-room authorities.

## Rules for the new session (the shared tree is the same)

- GSD owns all MindrianOS-Plugin dev work. Quick plans may be orchestrator-authored when the navigator's budget says so; every plan is recorded; executors are Sonnet unless ruled otherwise; never the Fable model for subagents.
- Commits: `git add <paths>` (`-f` under `.planning/`) then `git commit --only -- <paths>`; never `git add .`/`-A`, `commit -a`, `stash`, `reset`, `--no-verify`. Hand-edit STATE.md and ROADMAP.md as the orchestrator only; never through `gsd-tools state.*` writers.
- Never kill a `mindrian-mcp-server` or shell you did not start; no `npm install` at the repo root (`npm ci --ignore-scripts` only); one browser e2e at a time; the shell dist rebuilds in the same commit as any `ui/` change.
- Hyphens only, never em-dashes or en-dashes (`/usr/bin/grep -P '[\x{2013}\x{2014}]'`).
- Every number stated is sourced or absent; hypotheses before evidence are called hypotheses; a correction repairs the artifact and records the rule.
- Canon Part 8: no room content to Theo. Part 9: only a human confirms. A yes is a card, never prose.
- Lawrence's reading standard for anything reader-facing: short, summary first, taught terms only, no internal tool or agent names.
- Do not yank beta.57; do not hand-build rooms; do not remove any guard in the brief's "Behaviors to preserve".

## Open human items (the navigator, not the session)

- The Desktop verdict on the no-shell zip (decides whether item 3 is content or Desktop-side).
- Figma OAuth for mos-platform (the link was issued; re-issue with `mcp__figma__authenticate` if expired).
- Theo Phase 26 (forward row + re-pin), then a clean bridge.
- D-15: rotate the mindrian-brain credential held in `claude_desktop_config.json.bak-369.1-20261004T115920Z`, then delete the backup.
- Probe marketplace cleanup (`jsagir/mindrian-marketplace-probe`) after the Desktop sync is proven on production.
- The Lawrence mail draft (`~/Downloads`-side files `lawrence-beta57-mail.html/.txt` in the session scratchpad; v3 canon) still needs a Gmail path: connector in a fresh session, consent script, or paste.
- Codex Phase 0 audit (`/codex:rescue`, medium) is an option once its quota is up; the brief in the phase directory is its task.

## First five moves for the new session, in order

1. `git -C /home/jsagi/dev/MindrianOS-Plugin status --short` must be clean except untracked; read STATE.md's Next line and the critical path section 3.
2. Phase 0: spawn one read-only agent to produce the status table for every failure id (CODE, HARNESS, AI, UI, SW) against the current tree, with raw outputs as fixtures under `.planning/phases/369.2-.../fixtures/`; commit it as `369.2-PHASE0-STATUS.md`.
3. Quick: no key on the Theo path (SEED-119 plan 1), RED test first, brain egress suites moved, a fresh home gets a Theo answer on turn one.
4. Quick: rooms on Mac and Windows (`timezone.utc` x4, stderr surfaced, `room.db` readback, agent stops on failure), tested under Python 3.9 and with no python3 on PATH.
5. Quick: Desktop copy without `lib/ui-shell/dist` (builder rule in Step 6.8 + marketplace hotfix), then the navigator verifies Add marketplace on Desktop. Then the release rule, then `/gsd-plan-phase 369.2`.
