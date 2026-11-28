---
status: fixing
kind: qa-sweep
trigger: persona-deep-first-live-run-defects
severity: critical
created: 2026-11-26
phase_link: 400.2 (persona, hats and research bundle), merged 899b28d2a
owner_ruling: "need to put it in gsd as bug fix critical next" (2026-11-26)
---

# QA sweep: first live deep run of /mos:persona (Phase 400.2)

## Source-of-Truth Preamble

- **CODE claims read against:** branch `work/400.2-persona-hats-research` in `/home/jsagi/dev/MindrianOS-Plugin-399` (v2.0.0-beta.92, HEAD 1dcb7a2fe), since merged to main as 899b28d2a. Re-verify every finding against `origin/main` HEAD before a fix lands.
- **WIRE claims probe against:** none (local door `scripts/persona-hats.cjs` and local agent runs only; providers openalex, arxiv, host-web).
- **Date of audit:** 2026-11-26
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a fix.

## Meta

- Session: jsagi-53 (Claude Code CLI, WSL2 Linux).
- Room: `/home/jsagi/MindrianRooms/riemann-claim-hats` (scratch room created for this run).
- Run id: `20261126-064225-17e6`. Review filed at `personas/hat-reviews/20261126-064225-17e6-what-does-a-result-that/`.
- Mode: deep. Counts recorded at merge: agent_runs 20 (6 builders, 4 handle agents plus 4 resumes, 5 readers, 1 Blue), stops 3, cards 11, plus 2 rulings.
- This run is the VERIFICATION human item 1 ("one live deep run on a scratch room") of 400.2.

## Symptoms (immutable)

| # | Severity | Symptom | Observed value |
|---|---|---|---|
| S1 | CRITICAL | `status` reports `room_ok: true` on a freshly born room that holds only scaffold files (ROOM.md, MINTO.md, FEYNMAN.md, BRIEF.md per section). Deep mode would build six personas from empty scaffolds. | `sections_with_artifacts: 11` on a room with 0 real artifacts (before two notes were filed by hand) |
| S2 | CRITICAL | `accept-persona` returns `persona_files` with every value `null` after six accepts, while commands/persona.md Step 4 and Step 6 tell the orchestrator to read the persona file name from `persona_files.<hat>`. | `"persona_files": {"white": null, ..., "blue": null}` with `accept_done: true` |
| S3 | MAJOR | Every built persona file is named after the domain `data-room-state`, not the room topic. | `personas/white-data-room-state.md` ... `personas/blue-data-room-state.md`; frontmatter `domain: "data-room-state"` |
| S4 | MAJOR | Green's approved door searches return mostly off-topic evidence (black holes, post-mortem privacy law, natural law theory) for the strings "empirical law before theory analogous solutions" and "black box model validation analogous solutions". | 10 green evidence items, at least 5 unrelated by title |
| S5 | MAJOR | Reader agents' own searches carried person names (Scholze, Gonthier) and specific room detail; the check flagged `self_search_room_detail_suspected:1` for white, yellow and green only AFTER the strings had left the machine. | 3 of 4 researching hats flagged |
| S6 | MAJOR | The rulings card offers side_a, side_b, both_hold and defer. The navigator answered "larry decide" in free text; the door has no delegated-ruling value, so the orchestrator had to pick both_hold and write the delegation into the reason line. | 1 of 2 rulings delegated |
| S7 | MINOR | Host Kaggle searches (`site:kaggle.com/datasets ...`) returned 0 kaggle.com pages; results were arxiv and huggingface. | 2 of 2 Kaggle searches off-site |
| S8 | MINOR | Blue cannot report which sub-question each hat covered: the ledger has no per-sub-question coverage. | Blue `skipped` line 3 |
| S9 | ENV GAP | All four handle agents failed their Write with the PreToolUse "Worktree path guard" because the orchestrator session's cwd was inside a git worktree (`MindrianOS-Plugin-399`) when it dispatched them. Retried after the orchestrator left the worktree. | 4 of 4 first attempts blocked |
| S10 | MINOR | `nature_handle` "how organisms use signals they cannot explain" refused as `handle_not_generic_shape`; green had no AskNature lens this run. | 1 refused string |

## Classification

- S1, S2: NEW FAILURE (critical: S1 lets deep mode run on an empty room; S2 breaks the documented hand-off between Step 3 and Steps 4 and 6).
- S3, S4, S5, S6: NEW FAILURE (major).
- S7, S8, S10: NEW FAILURE (minor).
- S9: ENV GAP (interaction of the deep cycle with the worktree path guard hook; the command text should name it).

## Evidence (append-only)

- `status` output before filing: `room_ok: true, sections_with_artifacts: 11, venture_name_present: true`, all hats `missing`.
- `write-persona` output: six `proposed` files, all `personas/<hat>-data-room-state.md`.
- `accept-persona` output: `persona_files` all null, `handles_needed: [white, black, yellow, green]`.
- `plan-research` output: green `nature.state = not_planned:handle_not_generic_shape`; `refused_shown` holds the nature handle.
- `run-research` output: `evidence_items` 10 per researching hat; `counts.strings_approved 8, strings_refused 1`.
- `check` output: `rule_lines` `self_search_room_detail_suspected:1` for white, yellow, green.
- Review artifact: green evidence titles include "Hairy Black Holes in a Box", "Post-mortem privacy 2.0", "Natural Law Theory and the Is-Ought Problem".

- 2026-11-26 (jsagi-b3): S1 and S2 FIXED in 9c4e45b10, merged b0779f9cd, shipped in v2.0.0-beta.93 (origin/main f328ed520). Root cause: roomArtifactIndex in lib/core/persona-ops.cjs counted and hashed scaffold files; walkIndexable now skips them through scaffold-predicate isScaffoldFile (lazy require). New legs F13, F14 (test-4002-persona-freshness) and D29, D30 (test-4002-door-order).
- 2026-11-26 (jsagi-53): S3, S4, S6 to S10 and S5 (owner ruling "A: screen with a hook") in progress on branch work/400.2.1-persona-defects (EGM, rounds 1 and 2 committed, round 3 running); rebase on origin/main before merge.

## Suspected root causes (to verify)

- S1: `status` counts any section file as an artifact; it should exclude ICM scaffold files (ROOM.md, MINTO.md, FEYNMAN.md, BRIEF.md, STATE.md, USER.md).
- S2: `accept-persona` does not populate `persona_files` from the accepted persona files (or reads a field `write-persona` never set).
- S3: the persona domain is derived from a generic room-state token, not from the room name, purpose or brief target.
- S4: the green qualifier "analogous solutions" plus lexical openalex/arxiv matching pulls homonyms; needs a relevance floor or a reranker.
- S5: own-search screening is a prompt rule only; screen self_search_strings before WebSearch via a hook, or remove free web search from readers.
- S6: add a `delegated` ruling value (navigator delegates to Larry) with the Larry pick and a stored delegation flag.

## Required changes (draft, for the phase plan)

1. `status`: exclude scaffold files from `sections_with_artifacts`; `room_ok` false when no real artifact exists.
2. `accept-persona`: return the real file name in `persona_files.<hat>`; test that Step 4 and Step 6 inputs resolve.
3. Persona domain from the room purpose or brief target; regression test on a fresh room.
4. Relevance floor for door evidence; record dropped items.
5. Pre-send screen for reader self-searches (PreToolUse hook on WebSearch inside a hat run) or a contract change.
6. Delegated ruling value in `record-ruling` and the rulings card.
7. Minor: Kaggle off-site handling message, Blue per-sub-question coverage, nature-handle guidance, and a commands/persona.md note on dispatching from outside a worktree.

## Current Focus

Insert as a critical bug-fix phase directly after 400.2 per owner ruling; plan with GSD.
