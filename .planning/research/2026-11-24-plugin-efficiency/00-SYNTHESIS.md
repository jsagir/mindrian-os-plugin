# MindrianOS efficiency: synthesis and ranked plan (2026-11-24)

Inputs: 01-egm-mechanisms.md, 02-mos-surface-audit.md, 03-mos-runtime-cost.md, 04-mos-orchestration-theo-recipes.md (this folder). Builds on Phase 399 (decision advisor, done, unpushed) and Phase 400 (job sentences, Cynefin layer, relay; planning). Numbers are the researchers' measurements on this worktree; tokens = bytes / 4.

## The diagnosis in one paragraph

MindrianOS stores its method as prose and loads its whole toolbox up front. EGM stores its method as roles and loads nothing until asked. MindrianOS already owns the better source for method (Theo has runnable steps for 30 of the 38 frameworks the plugin names; 50 of 51 methodology commands name one of them), but only 1 command reads them; the other 50 run from 4,398 lines of local method files plus 8,772 lines of command prose and 8,526 lines of mirrors. At run time a session costs about 49k tokens before the first prompt (about 32k if the agent's 4 preloaded skills do not load), of which the MCP tool surface alone is about 21.7k (2.8 times the doctor budget), and 48 of its 76 tools were never called in 60 days of the owner's use.

## Two sources of "what runs next" (keep both, add no third)

- Theo answers HOW and IN WHAT ORDER: framework steps, run plan (sequence, any-order, choice, repeat-return), step rubric.
- The decision model (399 table, 400 domain and move type) answers WHICH NEXT: the shortlist inside the one existing selector (composeNextMove, composeWorkflow).
- A thin recipe runs only after the selector chose the command. Neither source enters an isolated reviewer's prompt (EGM rule).

## Ranked plan (proposed phases after 400)

### Phase A: hygiene and cheap context cuts (low risk)
| Item | Evidence | Saving |
|---|---|---|
| Remove stale pre-Theo Brain references (mindrian-brain.onrender.com 32 files, pws-brain-mcp 74, pinecone-brain 12, neo4j-brain comments); regenerate stale dist/; verify unscoped mcp__mindrian-brain__* names (39 files) | 04 s6.1 | correctness |
| Remove the 6 expired deprecated commands (after 400 labels them, O-12) | 02 | about 876 lines |
| Firing block (13 lines x 170 files) to one shared include; other repeated protocol blocks to one file each | 02 | about 2,400+ lines |
| Strip frontmatter comment lines (1,356) and phase-id lines (688) that do not run, keeping the load-bearing comments named in build-skill-mirrors.cjs | 02 | about 2,000 lines |
| Strip `$schema` repeats from MCP tool schemas; state repeated param rules once in the server instructions | 03 #1b, #1c | about 2.5-3k tokens per session |
| Nav block: dedupe the quoted claim, drop null fields, keep under its 1,100 B budget; binding card once per session; drop the empty post-write line; stop-word filter on Convergence lines | 03 #6, #11, #12, #17 | 150-285 tokens per affected turn |
| Cap skill descriptions at 200 B | 03 #18 | 3-4 KB in a clean host |
| Size test per skill and command body (EGM 24,000 B rule) | 01 #12 | keeps it small |

### Phase B: runtime surface (medium risk, owner card from Phase 392 needed)
| Item | Evidence | Saving |
|---|---|---|
| Per-tool alwaysLoad: the 18 hot tools stay loaded, the rest deferred | 03 #1 | about 15.5k tokens per session |
| Eureka and RS tools (27, 28.5 KB, 2 calls in 60 days) register only when Eureka is enabled | 03 #1a | about 7.1k tokens |
| Verify whether larry-extended preloads its 4 skills (68 KB); trim to what the main thread needs | 03 #2 | up to 8.5k tokens |
| Process-per-hook consolidation: session-start one process (2.4 s), on-stop batch the 6 recompiles and go async (1.2 s per turn), merge 4 small prompt hooks | 03 #9, #14, #15 | about 1.5 s per session, 1 s per turn |
| Card-fire stale-gate false blocks (699 in 30 days; each forces a model turn) | 03 #16 | 1 model turn per false block |
| Opt-in orchestration skills: disable-model-invocation on process skills (only 6 of 125 set true today) | 01 #1, 02 | most of 13.4 KB of listing text in a clean host |

### Phase C: agents as isolated lenses (EGM)
| Item | Evidence | Effect |
|---|---|---|
| Reviewer agents set omitClaudeMd, read-only tools, model inherit, no memory; a live isolation probe test | 01 #4, 02, 04 s3 | review independence; 0 of 17 set it today |
| Merge into lens-worker (5 read-only workers), evaluator (investor, grading, grant consolidate, black hat) and fetcher (3 fetchers), each with a Mode | 02, 04 s3 | fewer files, one contract each |
| One generic review-loop engine plus thin stage tables; synthesizer layer; convergence rules; paraphrase-first naive reader | 01 #2, #5, #7, #9 | grade, critique and review skills become rows |

### Phase D: methodology commands as thin Theo recipes
| Item | Evidence | Effect |
|---|---|---|
| A framework_steps tool on the existing mindrian-brain shim (Desktop and Cowork have no route today), typed egress arm, field whitelist | 04 s2.1, s6 | recipes work on all three surfaces |
| scripts/framework-recipe.cjs: read one framework's steps and run plan, never rank | 04 s5 | no second resolver |
| Pilot 2 recipes: challenge-assumptions (any-order fan-out) and root-cause (choice, repeat-return via gate cards) | 04 s5, s7 | 280 -> about 48 lines for challenge-assumptions |
| Per-recipe scenario files with recorded Theo fixtures and negative legs, judged through Jev | 01 #15, 04 s4 | behaviour is tested, not just code |
| Roll out to the methodology commands; local reference files become the labelled fallback or go (owner ruling) | 04 | up to 4,398 reference lines plus most command body prose |

### Deferred / not now
- Dropping the generated command mirrors (about 22,000 repo lines, 0 context saving): only after Phase D, because 399 pins and the registry derive from commands/.
- Advisor shortlist replacing nav-block reach rows and session nudges (about 750 B per block, 800 B per session): needs the advisor on by default, which is not ruled.
- Chaining by job-sentence slots (failed test, F-08).

## Owner rulings needed before planning
1. When Theo has no steps for a framework: strict refusal, or the labelled local fallback (theo-structure D-09)?
2. Do draft Theo steps run by default (37 of 38 frameworks are draft, AI-authored)?
3. Per-tool alwaysLoad (Phase 392 card): hot tools loaded, the rest deferred?
4. The legacy mcp-server-brain/ folder (own render.yaml): delete, or keep marked historical?

## Notes
- The four research subagents could not write outside the worktree (worktree path guard); the main session saved their files here.
- One researcher sent 6 framework-name-only calls through the raw Theo server, which bypasses the Part 8 egress guard. No room content was sent. Recipes must use the guarded client or the shim only.
- Phase 400 constraint passed to its planner: job sentence slots go in their own frontmatter keys, never in `description:` (avoids about 50 KB of always-loaded text).

## Owner rulings (card, 2026-11-24)
- R1 No Theo steps: labelled local fallback ("plugin reference, not Theo") plus an enrichment queue entry, as /mos:dominant-designs does (theo-structure D-09 stands).
- R2 Draft Theo steps run by default; the navigator is told once that the method is a draft.
- R3 Per-tool alwaysLoad: the 18 hot tools load up front, the rest defer to tool search; check Desktop and Cowork deferral first (closes the Phase 392 card for this item).
- R4 Delete the legacy mcp-server-brain/ folder and every reference to it (git history keeps it).
