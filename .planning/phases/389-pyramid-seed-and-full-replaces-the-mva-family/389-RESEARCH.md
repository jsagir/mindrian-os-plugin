# Phase 389: Pyramid: seed and full (replaces the MVA family) - Research

**Researched:** 2026-11-07
**Domain:** Plugin surface retirement and replacement inside a born-wired registry system (commands, skills, hook, data registries), plus a Minto/SCQA pyramid method at two depths.
**Confidence:** HIGH for what the code does today (read and run). MEDIUM for the target design (it is a design, not yet proven). Items marked UNVERIFIED are named.
**Repo state read:** worktree /home/jsagi/dev/MindrianOS-Plugin-release, HEAD ce3886f73, plugin version 2.0.0-beta.80 (`node lib/core/repo-version.cjs`). Read-only. No code was edited. The only commands run were reads, greps and two test runs with a scratch HOME.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (`skip_discuss: true` in `.planning/config.json`). The constraints below come from `389-PRD.md`. The PRD says its source is a set of HYPOTHESES from the owner's parallel session. Nothing here is a locked owner decision except where the owner is named.

### Locked Decisions
- None recorded. Owner questions 1 and 2 below are OPEN and must be put as cards at planning time.

### Claude's Discretion (design input from the PRD, to be verified, not locked)
- One framework, The Pyramid Principle, two depths: Seed (no room) and Full (a room exists).
- Part 7 check first: prefer a seed mode inside `structure-argument` over a new command.
- One gate: build a room (wire to /mos:new-project), keep going, or challenge.
- Retire candidates: mva-option, the mva-pipeline skill, option-router. Rename mva-report to session-report. Every retirement goes through a caller proof and an owner card. Nothing is deleted in the PRD itself.
- Part 8: only generic handles go to the Brain and to Tavily; the Phase 386 context-based sprout route applies.

### Owner questions (RECOMMENDED by the parallel session; the owner decides)
1. Keep the auto-trigger hook, or command only? RECOMMENDED: command-only entry, plus Larry offers it in conversation. Delete the MVA detection hook and its state file only after a caller proof.
2. Keep the Vercel share step? RECOMMENDED: keep, opt-in, default off, with a card that names Vercel and what leaves the machine.

### Deferred Ideas (OUT OF SCOPE)
- None listed in the PRD. Phase 390 (recalibrate or cut stale surfaces) is a separate phase and owns the keep/recalibrate/cut table; its table row for mva-pipeline says "follows Phase 389" (`.planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md` line 49).

### PRD rules
Reproduce and prove callers first, failing test first, fixture rooms only, born-wired registries regenerated through the generators (Part 11), no push/tag/release, `git commit --only`.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs were given. `.planning/ROADMAP.md` line 4102 lists "Requirements: TBD" and "Goal: [To be planned]". The planner should mint IDs from the "Plan seams" list at the end of this file.
</phase_requirements>

## Summary

The MVA family is a pre-room "30-second brief" pipeline. A UserPromptSubmit hook classifies each prompt, writes a state file holding only a hash of the sentence, a command runs 6 parallel "cells" under a 45 s budget, renders blocks plus a 3-option footer, builds a deck, and optionally deploys it to Vercel. The family has 4 commands, 4 skills, 1 hook, 2 scripts, 12 `lib/core/mva-*.cjs` modules, 7 files in `lib/agents/mva/`, 1 data file of Brain handles, and about 5 test files plus the `tests/run-all-118.sh` runner. "MVA" has no single definition in the repo: `commands/mva-brief.md` says "Minimum Viable Argument", `lib/core/claude-routing.cjs:52` says "minimum viable answer". [VERIFIED: grep]

Three facts from reading the code change the shape of the plan, and the PRD and the Part 7 reuse check understate or miss them.

1. **The current "brief" does not depend on the user's idea.** The orchestrator and state file hold only `sentence_sha256`. Brain agent 1 sends the fixed query "ventures comparable to early-stage consumer SaaS". Brain agent 2 sends the fixed query "cross-domain analogy frameworks". The Tavily cell uses a hardcoded query. The classic-traps cell is a no-op that returns `empty` (BUG 2 note in `brain-classic-traps.cjs`). The red/black hat cell picks 1 of 12 canned questions by hash. The deck builder prints only an 8-character hash marker. [VERIFIED: read `data/mva-agent-prompts.json`, `lib/agents/mva/*.cjs`, `lib/core/mva-deck-builder.cjs:16,301`] So the PRD mapping "similar cases = Situation, traps and black hat = Complication" describes intent, not what the code does. A real seed must have the host model (Larry) write the Situation, Complication and Question from the sentence. The plugin has no model of its own (`lib/core/part8-split-route.cjs` header says so). The outside evidence can only be keyword "sprouts" derived from the sentence.
2. **The first-install reward depends on the hook and the runner.** `scripts/first-install-router.cjs` `_fireReward()` (about lines 447-500) reads `mva-state.readPending()` (written by `scripts/mva-detect.cjs`) and spawns `scripts/mva-run.cjs` as a detached child. `data/first-reward-surfaces.json` declares `session-start:FIRST_INSTALL` with reward `instant_brief`. The Part 7 check (B4) rated this "comment-level only, UNVERIFIED". It is runtime coupling. [VERIFIED: read] Removing the hook, `mva-state`, `mva-orchestrator` or `mva-run` without a replacement breaks the Phase 267.2 first-install reward leg and its tests (`tests/test-267-2-pre-room-reward.cjs`, `tests/test-267-2-wr-02-reward-sentence-correlation.cjs`).
3. **A larger pyramid engine already exists and the Part 7 check did not search it.** `lib/core/research-planner/pyramid.cjs` (Phase 363) has `buildPyramid`, `checkPyramid`, `rollUp`, `weakestBranch`. It already models SCQA, a governing question, a key line and leaves, with MECE checks through `lib/core/issue-tree.cjs`. Its own CONTEXT.md lists `/mos:structure-argument` and `/mos:mos-reason` as the surfaces the pyramid "rolls up into". It is built around question sets and closed framework templates, not a one-sentence venture, so it fits the Full depth better than the Seed.

The Part 7 conclusion stands: a Seed depth belongs inside `structure-argument`, keeping `sub_mode: pyramid-argument`, so no new command and no new connector row. The plan needs a clear answer to the first-install dependency before any retirement step.

**Primary recommendation:** Build Seed as a third value of the "Quick pass or deep dive?" fork in `structure-argument`, with a no-room branch that ends in a conversation receipt. Re-point the first-install reward leg to the new Seed path in the SAME plan that retires the hook. Retire in the order hook (after re-point), mva-pipeline skill, mva-option command and router, then the rest, each behind an owner card, using the `/mos:query` retirement commit (29f8b57b1, 23 files) as the file-list template and `data/command-deprecations.json` as the record.

## Architectural Responsibility Map

This is a plugin, so the tiers are plugin surfaces, not web tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frame: write Situation, Complication, Question from one sentence | Host model (Larry, command markdown) | none | The plugin has no model. `part8-split-route.cjs` says the host model splits text into typed claims. A CJS module cannot write SCQA. |
| Classify "is this a venture sentence" | Hook / CJS (`mva-classifier.cjs`) | `selector-decisions.cjs` (writes scalar `venture_classified`) | Cheap, deterministic, already shared by 3 non-MVA callers. |
| Outside evidence (similar cases, funding, analogies) | CJS cell runner calling `brain-client.cjs` and Tavily | Part 8 egress guard (`part8-split-route.cjs`) | Network calls live in CJS. Only keyword sprouts may leave. |
| Parallel Test step with budget | CJS (`mva-dispatcher`, `mva-budget`, `mva-agent-contract`) | none | Already generic: takes any `{id, fn}` tuple. |
| Argue / render one page | Command markdown (structure-argument) | `mva-progressive-renderer.cjs` (optional) | Rendering text is prompt work. The renderer is only used by the orchestrator. |
| Decision gate (build room / keep going / challenge) | Command markdown + AskUserQuestion (Shape F) | `mva-option-router.cjs` for the `--from-brief` hand-off | Part 3 / Part 11 gate. |
| Share a brief to a public URL | CJS (`mva-vercel-deploy.cjs`) | Owner card before send | Third-party egress. Owner decides what leaves. |
| Registration of surfaces | Generators in `scripts/build-*.cjs` writing `data/*.json` | Release gate | Part 11 born-wired. Never hand-edit generated data. |

## Standard Stack

No new packages. The phase reuses repo code and Node 22 built-ins.

### Core (reuse, Part 7)
| Module | Role | Why |
|--------|------|-----|
| `commands/structure-argument.md`, `skills/structure-argument/SKILL.md`, `references/methodology/structure-argument.md` (158 lines; Quick vs Deep at lines 155-158) | The one pyramid command. Gets a Seed depth. | Already owns SCQA, MECE, the fork, `sub_mode: pyramid-argument`, `hierarchy_rank: 31`. No agent. |
| `lib/core/mva-dispatcher.cjs` + `mva-budget.cjs` + `mva-agent-contract.cjs` | Parallel cell runner under a budget | Constants `GLOBAL_BUDGET_MS = 45000`, `PER_AGENT_CAP_MS = 35000` (`mva-budget.cjs:24-25`). The dispatcher accepts any `{id, fn}` tuple. |
| `lib/core/research-planner/pyramid.cjs` (`buildPyramid`, `checkPyramid`, `rollUp`, `weakestBranch`) and `lib/core/issue-tree.cjs` | Pyramid structure and MECE check for the Full depth | Pure, local, no network. Pitfall 19 in its header: `validateMECE` alone never earns the words "MECE verified". |
| `lib/core/part8-split-route.cjs`, `lib/core/part8-sprout-shape.cjs`, `lib/core/brain-client.cjs` | Part 8 compliant outside calls | Phase 386 plan 42. Guard returns typed `sprouts_required` for a raw body. |
| `lib/core/mva-classifier.cjs` | Venture-sentence classifier | Required by `lib/workflow/selector-decisions.cjs:55`, `lib/core/semantic-index/entity-classifier.cjs:53`, `lib/wiki/briefing.cjs:29`, `lib/core/venture-shape-nudge.cjs` (doc), `scripts/entity-extract.cjs`. Not dead. |
| `lib/core/mva-rule-linter.cjs` | Reward-before-investment lint, release gate | Required by `scripts/check-reward-before-investment.cjs:71`, `scripts/hooks/pre-commit`, `scripts/verify-release`. Not MVA-specific. Rename only. |
| `data/command-deprecations.json` + `scripts/check-registry-drift.cjs` | Retirement record | Existing precedent entries: `/mos:query`, `/mos:pws-brain`. |
| `scripts/soft-alias-runner.cjs` | Soft alias for a rename | 4 stubs still use it. Its header says removal target v1.14.0 for those. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Seed depth in structure-argument | New `/mos:pyramid` command | Adds a command, a connector row and registry churn across about 13 data files. Rejected by the PRD Part 7 rule. |
| Reuse `research-planner/pyramid.cjs` for Seed | Markdown-only SCQA | The planner pyramid needs a `mos.research-question-set/1` and a template id (`Q.validateQuestionSet`). Heavy for one sentence. Use it for Full, not Seed. |
| Hard delete of `/mos:mva-report` | Rename with soft alias | `mva-report` is a conversation-flow receipt used by the tester cohort (`commands/mva-report.md` Notes). A rename without an alias strands tester instructions. |

**Installation:** none. **Package Legitimacy Audit:** no external package is recommended, so slopcheck was not run. `package.json` must not change (CLAUDE.md: UI and build packages never enter root package.json; `tests/test-341-shrinkwrap-no-dev.cjs`).

## Architecture Patterns

### System Architecture Diagram (target, Seed then Full)

```
 user types one venture sentence (no room)
        |
        v
 [entry]  command: /mos:structure-argument  (depth fork: Quick | Deep | Seed)
        |    (hook entry only if owner card 1 says keep)
        v
 [1 Capture]  sentence stays in conversation memory (never to Brain)
        |
        v
 [2 Frame]  host model writes draft Situation, Complication, Question
        |   silent problem type -> generic handles (framework names, enums)
        v
 [card]  F.x gate BEFORE any outside fetch (B1: autonomous_safe is a
        |   per-command flag; a chain must halt here)
        v
 [3 Test]  dispatcher runs cells under 45 s budget  ----> Brain (sprouts only via brain-client)
        |   cells: similar cases, analogies, funding, red/black hat ---> Tavily (sprouts only)
        |   (dashboard_graph dropped: no room in Seed)
        v
 [4 Argue]  answer first, grouped support, strongest objection, one page
        |   output = conversation receipt (no room to file into)
        v
 [5 Decide gate]  build a room | keep going | challenge
        |            |              |
        |            |              +--> /mos:challenge-assumptions
        |            +--> stay in conversation
        +--> /mos:new-project (or /mos:ignite --from-brief <sha8>)
                 |
                 v  room now exists
        [Full]  structure-argument deep depth on room evidence
                 buildPyramid/checkPyramid (research-planner) upgrade the seed
                 filing gate: "File this to problem-definition?" -> room/**/argument/*
```

### Recommended change set (by surface)
```
commands/structure-argument.md        # add Seed value, no-room branch, pre-fetch card
skills/structure-argument/SKILL.md    # same change, mirror (generated dist/ copies follow the build)
references/methodology/structure-argument.md  # Seed section next to "Quick Pass vs Deep Dive"
lib/core/pyramid-seed-*.cjs           # cell helper reusing dispatcher/budget/contract (renamed from mva-*)
data/pyramid-seed-prompts.json        # renamed from data/mva-agent-prompts.json, sprouts only
commands/mva-report.md -> session-report.md   # rename with deprecation record
commands/mva-brief.md, mva-option.md; skills/mva-brief, mva-option, mva-pipeline  # retire, behind owner cards
```

### What each MVA surface does today (verified by reading)

| Surface | Today | Fate in the design |
|---------|-------|--------------------|
| `commands/mva-brief.md` (88 lines) | Runs `scripts/mva-run.cjs`, relays stdout verbatim, 3-option footer. `hitl_shape: F.1`, `interactive_first_reward: instant_brief`, `connector.sub_mode: mva-brief`, `hierarchy_rank: 10`. Line 81 still says option 2 is a "stub for v1.13.0". | Replaced by the Seed depth. Retire behind a card. |
| `commands/mva-option.md` (121 lines) | Routes 1/2/3 after a brief via `mva-option-router.routeOption`. Line 87 says option 2 is `phase_119_stub`. Code says `ignite_from_brief`. | Retire candidate. Its job moves to the Decide gate. |
| `skills/mva-pipeline/SKILL.md` (160 lines) | `auto-activate: state-file`, trigger `~/.mindrian/mva/<session-id>.json` with `pending && !running`. Relays the brief. Lines about option 2 still say stub. Allowlisted out-of-spine: `data/connector-out-of-spine-allowlist.json:61`. | Loses its trigger when the hook goes. Retire. |
| `commands/mva-report.md` (78 lines) | Emits a conversation-flow report from the current chat. `connector.excluded: true`, `hitl_shape: none`, LOCAL only. Not part of the pipeline at all despite the name. | Rename to `session-report`. Keep behavior. |
| `skills/mva-brief`, `skills/mva-option`, `skills/mva-report` | Skill mirrors of the commands. | Follow their command. |
| `scripts/mva-detect.cjs` (229 lines) | UserPromptSubmit hook, `timeout: 3` (`hooks/hooks.json:354`). Classifies each prompt. Writes pending state with the hash only. Registered in `data/hooks-markers.json`, `data/arbitration-rule-catalogue.json` (id `mva-detect`), pinned by `tests/test-261029-qef-hook-timeouts.cjs:123`, `tests/test-connector-tier-d-hooks.cjs:42`, `tests/fixtures/369/hook-cold-start-baseline.json:692`. | Removal needs a first-install re-point (below). |
| `scripts/mva-run.cjs` (36 lines) | Runs `runPipeline`. Called by mva-brief and by `first-install-router` `_fireReward`. | Follows the orchestrator decision. |
| `lib/core/mva-orchestrator.cjs` (365 lines) | Reads pending, runs dispatcher, renders, builds deck, deploys to Vercel if configured, writes `~/.mindrian/mva/state.json` and `briefs/<sha8>.json`. Callers outside the family: `scripts/mva-run.cjs`, `scripts/room-naming-selector.cjs` (header), `scripts/session-start:736` (comment), `data/first-reward-surfaces.json`, tests. | See risk R2. |
| `lib/core/mva-option-router.cjs` (414 lines) | `OPTION_BEHAVIOR[2]` and `resolveOption2()` return `ignite_from_brief`. `STUB_MESSAGE_119` is `null`. Read by `commands/ignite.md:60,92` and `commands/new-project.md:55-64` (`--from-brief <sha8>`). | Live path to /mos:ignite. Keep until Decide is re-pointed. |
| `lib/core/mva-deck-builder.cjs` (452) and `mva-vercel-deploy.cjs` (168) | Build an HTML deck, POST it to `api.vercel.com/v13/deployments` when a Vercel token resolves; otherwise write a local file. Today it is default on when a token exists, best-effort. | Opt-in per owner card 2. |
| `lib/agents/mva/*` (6 cells + `index.cjs`) | See the cell table below. | Keep the contract and dispatcher. Re-write the cell inputs. |

### The six cells today vs the PRD mapping

| Cell id | What the code does | Uses the user's sentence? |
|---------|--------------------|---------------------------|
| `brain_similar` | `brainClient.search("ventures comparable to early-stage consumer SaaS", ...)` from `data/mva-agent-prompts.json` | No. Fixed query. |
| `brain_cross_domain` | `search("cross-domain analogy frameworks", limit 1)` | No. Fixed query. |
| `brain_classic_traps` | Returns `{status:'empty', reason:'failuremode_nodes_not_yet_seeded'}` without calling the Brain | No. Dead cell. |
| `tavily_funding` | Tavily with a hardcoded string literal. Returns `empty` without `TAVILY_API_KEY` | No. |
| `six_hats_red_black` | Picks 1 of 12 canned questions by hash | Only via the hash. |
| `dashboard_graph` | Reads the active room graph through `navigation.cjs` | Needs a room. |

Consequence: "Situation = similar cases" cannot be built by re-using these cells unchanged. The Seed Test step needs new, sentence-derived sprouts (keywords, problem type, framework names) produced by the host model, checked by the Part 8 guard, then sent through `brain-client`.

### Anti-Patterns to Avoid
- **Deleting a module because its name starts with `mva-`.** `mva-classifier` and `mva-rule-linter` have live non-MVA callers. Move or rename, do not delete.
- **Hand-editing generated registries.** Run the generators (`build-connector-registry.cjs`, `build-orchestration-projection.cjs`, `check-render-coverage.cjs`, `build-render-coverage.cjs`, the command-registry and ledger builders). The PRD rule says the same.
- **Sending the sentence to the Brain or to Tavily.** Part 8. Use sprouts through the Phase 386 route.
- **A fetch before the card.** B1. A chain runner runs any `autonomous_safe` step without a gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel cells with a clock | New Promise.all + timers | `mva-dispatcher` + `mva-budget` + `mva-agent-contract` (rename) | Already tested (dispatcher 216 test lines, budget 68). |
| Splitting a sentence into private claims and public sprouts | A new splitter | `part8-split-route.cjs`, `part8-sprout-shape.cjs`, `typed-claim.cjs` | Phase 386 owner direction; the guard is the backstop. |
| MECE / pyramid check | New checker | `research-planner/pyramid.cjs` `checkPyramid`, `issue-tree.cjs` | Header Pitfall 19. |
| Retirement bookkeeping | Ad hoc deletes | `data/command-deprecations.json` entry + commit 29f8b57b1 file list | The drift check passes a removed command only with a valid entry. |
| Soft rename | Custom redirect | `scripts/soft-alias-runner.cjs` stub pattern | One runner, no per-stub logic. |
| Decision cards | Hand-built menus | AskUserQuestion with the Shape F renderer (`lib/hmi/shape-f1-renderer.cjs`), per the `mos:firing-block v2` in each command | Part 3 / Part 11. |
| Share to a public URL | New uploader | Keep `mva-vercel-deploy.cjs` behind a flag, or drop it | Owner card 2. |

**Key insight:** most of the family is infrastructure that survives a rename. The design question is mostly about the hook, the first-install dependency and the Vercel step.

## Runtime State Inventory

This phase renames and removes surfaces, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `~/.mindrian/mva/<session-id>.json` (pending state), `~/.mindrian/mva/state.json` (manifest), `~/.mindrian/mva/briefs/<sha8>.json` (side file read by `ignite --from-brief`), `~/.mindrian/mva/briefs/<sha8>.html` (deploy fallback), `~/.mindrian/telemetry/v1.13/mva.jsonl` (legacy dual-write; `docs/TELEMETRY-SCHEMA.md:58` says "Retires in v1.14.0"), `<roomDir>/.mindrian/mva-brief.json` (read by `scripts/room-naming-selector.cjs:72-74`), first-install router state under `firstInstallDir()`. Room data: UNVERIFIED whether any real room stores `mva-brief.json` (no room data touched, per the task). | Code edit for new writers. No migration needed if the old files are simply no longer written. Leave existing user files in place; do not delete user data. Decide whether `--from-brief` keeps reading the old side-file format. |
| Live service config | Telemetry event names `mva_pipeline_started`, `mva_agent_returned`, `mva_brief_rendered`, `mva_option_selected`, `mva_brief_deployed`, `mva_pipeline_failed` are frozen in `lib/core/telemetry/schema.cjs:79` ("must mirror lib/core/mva-telemetry.cjs verbatim") and `docs/TELEMETRY-SCHEMA.md`. Theo's command layer is re-emitted at each release cut and lists plugin commands. The Vercel project/deployments named `mos-brief-<sha8>` exist on third-party accounts (not in git). Theo-side state: UNVERIFIED (Brain unreachable this session: `pws-brain-mcp` returned 503 and `theo` was not queried). | Telemetry rename is a schema change with tests. Theo and the Desktop copy follow at the next cut (same as the `/mos:query` commit message). Old Vercel deployments are not touched. |
| OS-registered state | Hook registration in `hooks/hooks.json:354` (plugin cache, re-read on update). `data/hooks-markers.json` and `data/arbitration-rule-catalogue.json` describe the hook. No OS scheduler entry found by grep. | Remove the hook row, the catalogue row and the marker note in one commit; re-run the hook census tests listed in Risks. |
| Secrets and env vars | `VERCEL_TOKEN` via `lib/core/resolve-vercel-key.cjs` (callers: `mva-vercel-deploy.cjs` only, by grep), `TAVILY_API_KEY` (cell 4), `ANTHROPIC_API_KEY` (classifier Haiku path, which sends the user's sentence to Anthropic; Part 8 governs the Brain only, per the classifier header). | If share is dropped, `resolve-vercel-key.cjs` and its test become dead (callers not checked beyond grep). Names are not renamed. |
| Build artifacts / installed packages | `dist/generic-claude-dir/.claude/skills/{mva-brief,mva-option,mva-pipeline,mva-report}/SKILL.md` and `dist/zed/.agents/skills/...` are TRACKED (273 tracked files under `dist/`) and generated by `scripts/build-dist-bundles.cjs`. Also `lib/mos-face/dist/commands.js`, `ui/mos-face/hooks/commands.ts`, `ui/mos-face/scripts/face-commands.cjs`, `ui/mindrian-workspace-mod/assets/command-registry.json`. Phase 388 is changing what ships. | Regenerate through the builders; do not hand-edit. Check Phase 388 first for overlap. |

**Canonical question answered:** after every repo file changes, users still hold the old `~/.mindrian/mva/*` files, old Vercel deployments, installed plugin copies with the old commands (a stale user is correct by design: `release-process.md`), and Theo/Desktop copies that list the old commands until the next cut.

## Common Pitfalls

### Pitfall 1: Removing the hook breaks first-install
**What goes wrong:** `first-install-router._fireReward` reads `mva-state.readPending()`. No hook means no pending record, so skip reason `no_pending`, so the FIRST_INSTALL "Instant Brief" never fires. Tests 267.2 and 267.3 red. [VERIFIED: read]
**How to avoid:** Plan the re-point first: the router fires the Seed path (or an honest skip) and `data/first-reward-surfaces.json` + `lib/core/mva-rule-linter.cjs` `REWARD_TYPES` stay consistent (set-equality is test-enforced; `instant_brief` is also declared by `ignite`, `new-project`, `rs-experts`).
**Warning signs:** `tests/test-267-2-pre-room-reward.cjs`, `tests/test-267.3-session-start-declaration.cjs`, `tests/test-267.3-surface-declarations.cjs`.

### Pitfall 2: The router is a live path, not a stub
**What goes wrong:** Docs say option 2 is a stub, so a planner deletes `mva-option-router` as dead. `commands/ignite.md:60,92` and `commands/new-project.md:55-64` read `resolveOption2`. [VERIFIED]
**How to avoid:** Move `resolveOption2`/side-file reading to the Decide step first, then retire.

### Pitfall 3: The old tests already fail, so "tests green" is not a baseline
**What goes wrong:** A plan that says "keep run-all-118 green" asks for something that is not true today.
**Baseline I ran (scratch HOME, 2026-11-07):** `bash tests/run-all-118.sh` gave 16 suites, 13 passed, 3 failed: `lib/agents/mva/test-all-six-agents.cjs` (Test 3 expects classic-traps `ok`, gets `empty`; Test 4 expects reason `brain_unavailable`), `lib/core/mva-deck-builder.test.cjs` (Test 12 palette parity: expected 0, actual 6), `lib/core/mva-option-router.test.cjs` (13 of 18 pass; 5 fail because they still assert `phase_119_stub`, e.g. line 460). `tests/test-mva-from-brief.cjs` passes 21/21. [VERIFIED: ran]
**How to avoid:** Record this baseline in plan 01. A retirement removes failing tests with their module; a rewrite starts from failing-first tests on the new behavior.

### Pitfall 4: Text edits stale the irreversibility ledger
**What goes wrong:** `lib/core/irreversibility-ledger.cjs` counts an entry only when `text_hash` = sha256 of `[command, teaching, jtbd_summary]` for the current registry row. Changing `teaching` or `help_jtbd` of structure-argument stales its entry (`flag: false`, `p_irreversible: 0.07`) and `scripts/build-command-irreversibility-ledger.cjs --check` reports stale commands (lines 696-704). The ledger needs a Jev call to rescore. [VERIFIED: read; the `--check` run itself was not executed]
**How to avoid:** Change the body, not `teaching`/`help_jtbd`, or budget for a rescore step. State this in the plan.

### Pitfall 5: `autonomous_safe` is per command, not per sub-mode
**What goes wrong:** `structure-argument` declares `autonomous_safe: true`. Chain code (`lib/core/chain-executor.cjs:901,928`) reads `verdict.autonomous_safe` from the command row. A Seed branch inside the command inherits it. The resolver's treatment of a sub-mode is UNVERIFIED.
**Precedent:** `/mos:research` is also `autonomous_safe: true`, fetches the web, and protects egress with an F.6 plan card and an F.0 grant (`commands/research.md` frontmatter). Phase 356's handoff says `/mos:research` and `/mos:show` are the only 2 commands where the ledger changes runtime behavior.
**How to avoid:** Put an in-command card before any fetch (the research precedent), and test that `chain_run` halts at it. Flipping the flag to `false` would also change existing chains that include structure-argument (`pipelines/thesis/01-structure-argument.md`, `pipelines/PWS_grading/CHAIN.md` and others), so that is a separate owner decision.

### Pitfall 6: Name collision on "pyramid"
**What goes wrong:** "Pyramid" already names the Ackoff DIKW pyramid (`commands/build-knowledge.md`, sub_mode `ackoff-pyramid`), the FeyMinto per-folder MINTO.md layer (`commands/mos-reason.md`, framework "The Pyramid Principle", with `lib/core/feyminto/*` and `lib/memory/validators/minto-invariants.cjs`), and the research-planner pyramid. A new command or a vague doc will mix them.
**How to avoid:** Keep the Seed under `structure-argument`; say "Minto pyramid (SCQA)" in all copy.

### Pitfall 7: The share step's privacy meaning flips
**What goes wrong:** PRD owner card 2 says "the brief carries the user's venture text". Today it does not (hash marker only). A Seed pyramid does carry venture text (Situation, Complication, Answer), so "default off, card names Vercel" becomes a real requirement for the NEW artifact, and the old default-on-if-token behavior must not carry over.
**How to avoid:** Any deck from the new pyramid is built after an explicit card. Part 8 covers the Brain only; the owner decides what else leaves the machine.

### Pitfall 8: Generated copies and registries
**What goes wrong:** Hand edits to `data/*.json`, `dist/**`, `ui/**/command-registry.json` drift. `tests/fixtures/341-registry-drift-baseline.json` and `scripts/check-registry-drift.cjs` fail a missing command without a deprecation entry.
**How to avoid:** Follow the `29f8b57b1` file list (below) and run the generators.

## Code Examples

### Deprecation record (existing format)
```json
// Source: data/command-deprecations.json (existing entries /mos:query, /mos:pws-brain)
{
  "command": "/mos:mva-option",
  "retired_in": "<next version>",
  "replaced_by": "/mos:structure-argument",
  "reason": "<one sentence>",
  "decided_by": "navigator",
  "date": "<date>",
  "record": "<phase 389 plan, commit>"
}
```

### File list a command retirement touched (template)
```
// Source: git show --stat 29f8b57b1 (retire /mos:query, 23 files, 25 insertions, 266 deletions)
commands/<x>.md, skills/<x>/SKILL.md, CHANGELOG.md,
data/{brain-orchestration-projection,command-registry,connector-coverage-ledger,
      connector-out-of-spine-allowlist,harness-manifest,help-groups,hitl-shape-backfill,
      layer-backfill,orchestration-command-ledger,render-coverage-registry,
      section-command-relevance}.json,
data/jev-labels/command-irreversibility.json,
tests/fixtures/341-registry-drift-baseline.json, tests/test-209-declared-implies-wired.cjs,
ui/mindrian-workspace-mod/assets/command-registry.json
```
For the MVA commands add: `data/connector-registry.json`, `data/command-irreversibility-ledger.json`, `data/section-command-ledger.json`, `data/room-blueprints.json`, `data/connector-out-of-spine-allowlist.json:61` (mva-pipeline), `lib/mos-face/dist/commands.js`, `ui/mos-face/hooks/commands.ts`, `ui/mos-face/scripts/face-commands.cjs` (mva-report), `tests/test-192-menu-sweep-live-selectors.cjs`, `scripts/migrate-skill-frontmatter.cjs:79`, `dist/**`. [VERIFIED: `git grep -l` output for each name]

### Seed depth in the fork (sketch for the command body)
```
Ask: "Quick pass, deep dive, or seed?"
Seed (no room): do not read room/STATE.md. Write Situation, Complication, Question from the
sentence. If the Complication does not fit in one sentence, say so (reference Phase 1 rule).
BEFORE any outside lookup: fire the card that names what leaves (generic keywords only).
After Argue: no filing prompt. Show the conversation receipt, then the Decide gate.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Option 2 stub (Phase 119 message) | `ignite_from_brief` (Phase 155-04) | Phase 155-04 | Docs (`commands/mva-option.md:87`, `skills/mva-option/SKILL.md:88`, `skills/mva-pipeline`, `commands/mva-brief.md:81`) and 5 router tests are stale. |
| Brain `brain_query` for classic traps | No-op cell | 2026-05-22 BUG 2 fix | One of 6 cells does nothing. |
| Bare block for Part 8 text | Context-based sprout route, typed `sprouts_required` | Phase 386, 2026-11-06 | The Seed's outside calls must use it. |
| Per-writer telemetry | One writer + frozen schema, `mva-telemetry.cjs` is a shim | Phase 121 | Event renames are schema changes. |

**Deprecated/outdated in the PRD wording:**
- "Option 2 is a stub" (already corrected in the PRD problem section).
- "About 14 `lib/core/mva-*.cjs` modules": `ls` shows 12 non-test modules (agent-contract, budget, classifier, deck-builder, dispatcher, option-router, orchestrator, progressive-renderer, rule-linter, state, telemetry, vercel-deploy), plus one smoke test file.
- "Depends on Phases 385 to 387": `.planning/ROADMAP.md` line 4106 says "Depends on: Phase 388". Reconcile before planning.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The resolver and chain runner treat `autonomous_safe` per command row, so a Seed branch inherits `true`. Read in `chain-executor.cjs`; the command-resolver path for a sub-mode was not traced. | Pitfall 5 | A card might be unnecessary, or insufficient. Trace before coding. |
| A2 | `lib/core/telemetry/schema.cjs` event names can be renamed with a schema and test change. | Runtime State | If a writer validates names on disk, old jsonl lines may fail to parse. Not run. |
| A3 | No real room stores `.mindrian/mva-brief.json`. Only `scripts/room-naming-selector.cjs` reads it. | Runtime State | Rename may orphan data. No room data was read, by task rule. |
| A4 | The PRD claim "the navigation engine already runs each turn" supports a no-hook offer. I found `venture-shape-nudge.cjs`, which needs a room.db and counts N=3 venture turns (`VENTURE_NUDGE_THRESHOLD = 3`), and `selector-decisions.cjs` writes the scalar `venture_classified`. I did not find a no-room per-turn offer. | Pitfall 1, Open Q1 | Command-only entry may leave no-room users with no offer at all. |
| A5 | `resolve-vercel-key.cjs` has no other callers than `mva-vercel-deploy.cjs`. Grep covered tracked files outside `.planning` and `dist`. | Runtime State | Deleting it could break an unseen caller. |
| A6 | Tavily and the Brain are reachable at run time on a normal install. Not tested: this session's `pws-brain-mcp` returned 503 (retired backend, not Theo). `TAVILY_API_KEY` presence was not probed. | Environment | Seed returns fewer cells; the dispatcher already degrades to `empty`. |

## Open Questions

1. **How does the first-install reward survive the hook's removal?**
   - Known: `_fireReward` needs `readPending()` and spawns `mva-run.cjs`. The reward is declared `instant_brief` in `data/first-reward-surfaces.json`.
   - Unclear: whether the owner wants a Seed on first install (it needs the host model, which a detached child does not have) or an honest skip.
   - Recommendation: card to the owner in plan 01 with a recommendation: keep `mva-detect` and `mva-state` until the router is re-pointed, remove them last. The router already classifies on its own; test whether it can write its own pending record.
2. **Command-only entry versus no-room users (owner card 1).** Known: `venture-shape-nudge` needs a room.db. Unclear: who offers the Seed to a no-room user. Recommendation: Larry's session-start prose and `first-install-router` route to `/mos:structure-argument` seed; accept that mid-session discovery relies on Larry's judgment (Tri-Polar: Desktop and Cowork have no hooks anyway).
3. **Vercel share (owner card 2).** Known: today default-on with a token, hash-only deck. Recommendation: opt-in, default off, the card shows the page text that would be public and names Vercel. Drop the deck builder if no owner word keeps it.
4. **B1 posture.** In-command card before fetch (research precedent) versus a flag change. Recommendation: the card, plus a chain test.
5. **Do the Seed cells keep a Brain call at all?** Known: today's two Brain calls are fixed strings, so they give the same answer for every idea. Recommendation: spend plan 02 on measuring whether sprout-based Brain calls return useful cases for 3 fixture sentences before wiring them; if the Brain gives nothing, Seed ships as a pure host-model pyramid with the red/black-hat challenge and no fetch. That also removes B1 for the first cut.
6. **Phase 118 six-agent mismatch.** PRD says Phase 118 planned research, persona, market, evidence, contradiction, synthesis. `118-CONTEXT.md` lines 46-47 confirm. No action beyond not citing 118 as the spec.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All tests, generators | yes | v22.23.1 (floor 22.18.0) | none needed |
| bash | `tests/run-all-*.sh` | yes | used | none needed |
| Brain (Theo) via `brain-client` | Seed cells | UNVERIFIED | `pws-brain-mcp` returned 503 this session; Theo not probed | Cells return `empty`; Seed still runs |
| Tavily (`TAVILY_API_KEY`) | funding cell | not probed | none | cell returns `empty` in under 50 ms (cell header) |
| Vercel token | share step | not probed | none | local file fallback |
| Jev (TypeSafe) | rescore of the irreversibility ledger if structure-argument text hash changes | not probed | none | avoid `teaching`/`help_jtbd` edits |

**Missing dependencies with no fallback:** none found.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` for `lib/**/*.test.cjs`, plain check/pass scripts for `tests/test-*.cjs`, bash runners `tests/run-all-<phase>.sh` |
| Config file | none. Convention: a `tests/run-all-389.sh` created by the phase (pattern in `tests/run-all-118.sh`) |
| Quick run command | `HOME=<scratch> bash tests/run-all-389.sh` (to create) |
| Full suite command | `bash tests/run-all-118.sh; bash tests/run-all-267.sh; node scripts/build-connector-registry.cjs --check; node scripts/build-orchestration-projection.cjs --check; node scripts/check-render-coverage.cjs; node scripts/doctor.cjs --acceptance` |

Use a scratch HOME for every run (the MVA code writes under `~/.mindrian`).

### Phase Requirements -> Test Map (proposed IDs)
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| P389-01 | Baseline recorded: 13 of 16 suites pass in run-all-118 | smoke | `HOME=<scratch> bash tests/run-all-118.sh` | yes |
| P389-02 | Seed branch exists in structure-argument; no-room branch writes no `room/**` file | unit/static | new `tests/test-389-seed-structure.cjs` | Wave 0 |
| P389-03 | Seed makes no fetch before the card; chain halts there | integration | new test with `chain-executor` fixture | Wave 0 |
| P389-04 | Part 8: no sentence in any Brain or Tavily body; guard returns `sprouts_required` for a body | unit | extend `tests/test-220-part8-egress.cjs` style | Wave 0 |
| P389-05 | First-install reward leg still fires or skips honestly after re-point | integration | `tests/test-267-2-pre-room-reward.cjs` (update) | yes |
| P389-06 | Each retired command has a deprecation record and the drift check passes | gate | `node scripts/check-registry-drift.cjs` | yes |
| P389-07 | Born-wired and render coverage gates pass after regeneration | gate | the three `--check` commands | yes |
| P389-08 | Hook census tests pass after hook row removal | unit | `tests/test-261029-qef-hook-timeouts.cjs`, `tests/test-connector-tier-d-hooks.cjs`, `tests/test-quick-260911-juq-hooks-json-top-level.cjs`, `tests/test-346-catalogue-schema.cjs` | yes |
| P389-09 | `session-report` keeps the report structure; old name resolves via alias | unit | new static test | Wave 0 |
| P389-10 | No em-dash in new files | static | grep in the new tests | Wave 0 |

### Sampling Rate
- Per task commit: the one new test file plus the touched registry `--check`.
- Per wave merge: `run-all-389.sh`, `run-all-118.sh` (expect the recorded baseline, or fewer failures), `run-all-267.sh`.
- Phase gate: the full suite line above, then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/test-389-seed-structure.cjs` (P389-02, P389-09, P389-10)
- [ ] `tests/test-389-seed-egress.cjs` (P389-03, P389-04)
- [ ] `tests/run-all-389.sh`
- [ ] A fixture sentence set (3 sentences, no real user content) and a fixture room for Full
- [ ] A written baseline of the 3 failing 118 suites so removals are judged against it

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json` (absent means enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | none for this phase |
| V3 Session Management | no | none |
| V4 Access Control | partly | Brain entitlement is at install time, not per query (CLAUDE.md decisions #1). Do not add a per-query check. |
| V5 Input Validation | yes | Venture sentence is untrusted text; bound its length (the classifier already bounds 12 to 600 characters); never interpolate it into a shell or a path; sha8 is validated by `SHA8_RE = /^[0-9a-f]{8}$/` in the router (path traversal mitigation T-155-04-01). |
| V6 Cryptography | no | sha256 from `node:crypto` only |
| V8 Data Protection / egress | yes | Part 8 guard, `part8-egress-guard.cjs`, sprouts only; card before third-party send |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User sentence sent to Brain | Information disclosure | Sprouts only through `brain-client` and the Part 8 guard; test P389-04 |
| User text sent to Vercel by default | Information disclosure | Opt-in, default off, card names the third party |
| Prompt injection from fetched pages into the host model | Tampering | Treat fetched text as evidence, never as instructions (Theo guide wording); quote with a source |
| Path traversal in `--from-brief <sha8>` | Tampering | Keep `SHA8_RE` validation when moving `resolveOption2` |
| Hash-pinned ledger bypass | Tampering | Ledger is add-only; keep it that way |
| Hook timeout or crash blocking a turn | DoS | Existing invariant: hooks never block; keep that if any hook stays |

## Part 11 consequences (born-wired and HITL shape)

- Structure-argument stays WIRED (`connector.sub_mode: pyramid-argument`, `reach_id: context_block`, `hitl_shape: F.9`). A Seed value is inside that row, so no new row. A new `sub_mode` would touch `data/connector-registry.json` and the render-coverage registries and needs the generators (Part 7 check B3).
- The Seed introduces a genuine fork (the pre-fetch card and the Decide gate). The F.9 declaration ("ordered walk") is still accurate for the pyramid build. The Decide gate is a second fork; consider switching to `hitl_stages` (Form B in `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`) so the command declares both: stage "pyramid build" F.9 ordered, stage "seed fetch card" gate, stage "decide" F.1 gate. `scripts/check-shape-declaration.cjs` is an advisory WARN as of Phase 210 (not a block), but the declaration is still mandatory.
- Removing `mva-brief` (connector row `hierarchy_rank: 10`, `reach_id: deep_research`, `sensor_triggers: [SENS-01]`) removes a WIRED row and a sensor trigger. Check that `SENS-01` still has another consumer (UNVERIFIED), and regenerate `data/connector-coverage-ledger.json`.
- `mva-report` is `connector.excluded: true` with a reason. A rename keeps the exclude and updates the reason text path. `hitl_shape: none` stays.
- `skills/mva-pipeline` is out-of-spine allowlisted (`data/connector-out-of-spine-allowlist.json:61`) and referenced by `tests/test-209-declared-implies-wired.cjs` and `scripts/build-render-coverage.cjs:369` (comment). Remove the allowlist entry with the skill.
- `interactive_first_reward` values stay valid. `instant_brief` remains in the vocabulary because ignite/new-project/rs-experts declare it. Do not remove it from `REWARD_TYPES`.
- Surface counts are enumerated from disk; do not write a literal count in any doc (CLAUDE.md Part 11 line).

## Risks (users of the old commands)

| # | Risk | Evidence | Mitigation |
|---|------|----------|------------|
| R1 | Users and testers type `/mos:mva-brief`, `/mos:mva-option`, `/mos:mva-report` and get "unknown command" | Commands are in the previous release; a command missing from the registry passes drift only with a deprecation entry | Deprecation entries; soft-alias stubs for `mva-report` and `mva-brief` for one release, using `soft-alias-runner.cjs` |
| R2 | First-install reward breaks | Pitfall 1 | Re-point before removal |
| R3 | `/mos:ignite --from-brief` and `/mos:new-project` read the router and side-file | `commands/ignite.md:60,92`, `commands/new-project.md:55-64` | Update both docs and keep the side-file read until Decide moves |
| R4 | Tester cohort instructions point at `/mos:mva-report` | `commands/mva-report.md` Notes cite `docs/testers/weekly-cohort/2026-07-01-standup.md` and `lab/eval/report-from-transcript.cjs` | Alias; update docs; do not change the report structure |
| R5 | Stale installs: third-party plugins do not auto-update | `release-process.md` "How Users Upgrade" | Keep aliases one release; CHANGELOG entry |
| R6 | Theo and Desktop copies list removed commands until the next cut | `29f8b57b1` message | Note in plan close-out; no push in this phase |
| R7 | UI surfaces (mos-face) list `/mos:mva-report` descriptions | `ui/mos-face/hooks/commands.ts:495`, `face-commands.cjs:99` | Regenerate; check the mos-face tests (29 tests per memory note, UNVERIFIED here) |
| R8 | Hook removal changes cold-start baseline fixtures | `tests/fixtures/369/hook-cold-start-baseline.json:692` | Re-baseline through its own generator, not by hand |
| R9 | Parallel session collisions on `data/*.json` and the shared tree | Phase 388 is active in this worktree (untracked `tests/test-388-ship-less.cjs`, modified `388-measure.cjs` at start) | `git commit --only`; check `git status` before each commit; do not run generators while a peer executes |
| R10 | `dist/**` copies change in the same commit as sources | 273 tracked files in `dist/` | Run `scripts/build-dist-bundles.cjs`; confirm with Phase 388 which of these stay tracked |

## Plan seams (suggested, for the planner)

1. **389-01 Prove callers and record baseline.** Re-run the caller greps, record the 13/16 baseline, correct the stale text (`commands/mva-option.md:87`, `skills/mva-option/SKILL.md:88`, `commands/mva-brief.md:81`, `skills/mva-pipeline`) and the 5 stale router test asserts. Failing test first.
2. **389-02 Owner cards (stop point).** Card 1 hook, card 2 share, B1 posture, first-install re-point, alias period. NEEDS_HUMAN returns, one question each.
3. **389-03 Seed in structure-argument.** Fork value, no-room branch, pre-fetch card, conversation receipt, Decide gate. Tests P389-02/03/04.
4. **389-04 Seed cells.** Rename dispatcher/budget/contract to `pyramid-seed-*`, sprout-based inputs, drop `dashboard_graph`, measure on 3 fixture sentences (Open Q5).
5. **389-05 Full upgrade.** Wire `buildPyramid/checkPyramid` for the room case and the seed-to-full upgrade. Fixture room only.
6. **389-06 Re-point first-install and Decide hand-off.** Router, `ignite --from-brief`, `new-project`.
7. **389-07 Retire in order**, one commit each, each with its card result: hook, mva-pipeline, mva-option + router, mva-brief, then orchestrator/state/renderer, then deck/deploy per card 2. Rename `mva-report` to `session-report`, `mva-classifier` and `mva-rule-linter` rename-only.
8. **389-08 Regenerate and gate.** Generators, drift check, doctor acceptance, CHANGELOG, deprecation entries. No push, no tag.

## Sources

### Primary (HIGH confidence, read in this repo at HEAD ce3886f73)
- `.planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-PRD.md`; `.planning/audits/PHASE-389-PART7-REUSE-CHECK.md`; `.planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md`; `.planning/ROADMAP.md` lines 4102-4120; `.planning/phases/386-.../386-PRD.md`, `386-OUTCOMES.md`
- `commands/{mva-brief,mva-option,mva-report,structure-argument,ignite,new-project}.md`; `skills/{mva-pipeline,structure-argument}/SKILL.md`; `references/methodology/structure-argument.md`
- `lib/core/mva-{orchestrator,option-router,budget,classifier,state,vercel-deploy,deck-builder}.cjs`; `lib/agents/mva/*.cjs`; `data/mva-agent-prompts.json`; `scripts/{mva-detect,mva-run,first-install-router,session-start}`; `hooks/hooks.json:354`; `data/first-reward-surfaces.json`; `data/command-deprecations.json`; `data/command-irreversibility-ledger.json`; `lib/core/irreversibility-ledger.cjs`; `lib/core/research-planner/pyramid.cjs` and `CONTEXT.md`; `lib/core/part8-split-route.cjs`; `lib/core/venture-shape-nudge.cjs`; `lib/core/chain-executor.cjs`
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`; `docs/TELEMETRY-SCHEMA.md`; `docs/2026-09-23-HANDOFF-phase-356-irreversibility-ledger.md`; project `CLAUDE.md` and `.claude/includes/*`
- `git show --stat 29f8b57b1` (retirement template)
- Test runs on 2026-11-07 with a scratch HOME: `bash tests/run-all-118.sh` (13/16), `node lib/core/mva-option-router.test.cjs` (13/18), `node tests/test-mva-from-brief.cjs` (21/21)

### Secondary / Tertiary
- None. No web source was needed: the question is about this repo. Context7 and web search were not used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. All modules read and callers grepped.
- Architecture: MEDIUM. The Seed design is untested; Open Q5 may change the cell design.
- Pitfalls: HIGH for 1-4 and 7-8 (read or run); MEDIUM for 5 (resolver sub-mode path not traced).

**Gaps (UNVERIFIED):** the `SENS-01` consumers after `mva-brief` leaves; whether `--check` on the ledger fails on a stale hash (read, not run); resolver treatment of a sub-mode; telemetry rename effect on existing jsonl; Theo-side command lists; mos-face test status; real-room use of `mva-brief.json`.

**Research date:** 2026-11-07
**Valid until:** 2026-11-14 (the tree is moving: Phases 384 to 388 are landing in the same worktree).
