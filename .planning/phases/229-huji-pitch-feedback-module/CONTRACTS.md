# Phase 229 - Wave 0 CONTRACTS

**Resolved:** 2026-07-16 (empirical repo read + live spikes, Plan 229-01 Task 2)
**Status:** all 5 RESEARCH open questions (A1-A5) settled to concrete build decisions.

> Every decision below is grounded in a file:line read or a runnable spike, NOT a
> guess. Downstream plans build against these; they do not re-litigate them. The
> recipe name is `PWS_grading` everywhere invocable (navigator ruling 15.7.2026);
> "pitch-feedback" survives only as the phase-directory / opportunity-bank label.

---

## PIPELINE_ARG (Q1 / A3) - how `/mos:pipeline PWS_grading` resolves

**DECISION.** `/mos:pipeline <name>` resolves a NAMED pipeline by loading
`pipelines/<name>/CHAIN.md` and then walking numbered stage contracts
`pipelines/<name>/{NN}-{methodology}.md` on the shared `runChain` spine. This is a
DIFFERENT resolver from the SENS-10 `recipe-maps.cjs` cause->recipe path. Therefore
`PWS_grading` needs BOTH homes, because they answer to two different consumers:

1. **`pipelines/PWS_grading/CHAIN.md` + four numbered stage contracts** - REQUIRED so
   the shipped `/mos:pipeline PWS_grading` resolver actually runs the chain. Stage
   files in methodology-native order:
   - `01-deep-grade.md`
   - `02-mullins.md`
   - `03-build-thesis.md`   (scored, non-gating - see SCORED_MODE)
   - `04-structure-argument.md`  (Minto pyramid packaging, last)
   Each stage contract declares Input Extraction / Stage Instructions / Output
   Contract, referencing the existing `/mos:` command (no new commands - Canon Part 7).
2. **`recipe-maps.cjs` `NAMED_RECIPES` registration** - the posture/order AUTHORITY
   (see RECIPE_HOME). A single queryable source of the ordered bare-command list, so
   the orchestrator, the autonomy validator, and any tooling read ONE ordering, and
   the `CHAIN.md` stage files stay a mirror of it, never a competing order.

**Invocation string the orchestrator spawns** (per AI-SPEC 3 entry point): inside each
headless session, the prompt string is a slash command, expanded in `-p` mode:
`/mos:pipeline PWS_grading`. The transcript/evidence path is NOT a `/mos:pipeline`
flag (its argv contract has no transcript slot - see EVIDENCE). It is passed via the
scratch room: Stage A writes `evidence.json` + populated `room.db` into the
per-submission scratch room, and the session runs with `cwd = <scratch room>` so every
stage command reads the room it was written to expect (frontmatter stage-handoff, the
way the commands already talk to each other). The batch model ID is pinned via the
scratch room `.config.json` `model_overrides` (resolveModel cascade step 1), never a
`/mos:pipeline` argument.

**EVIDENCE.**
- `commands/pipeline.md:96-101` (Chain Selection): "If user specifies a pipeline name
  ... Load `pipelines/{name}/CHAIN.md` and proceed to Stage 1." Stage Execution Loop at
  `commands/pipeline.md:113` reads `pipelines/{chain}/{NN}-{methodology}.md`.
- `commands/pipeline.md:56-62` (runtime): the pipeline is a CONSUMER of the ONE shared
  `runChain` in `lib/core/chain-executor.cjs`; postureFn = `recipe-maps.postureForCommand`.
- `scripts/pipeline-command.cjs:62-77` (`parseArgs`): argv contract is
  `{ fromProblemType, fromFramework, roomDir, pipelineName }` - a positional
  `pipelineName` + `--from-problem-type` / `--from-framework` / `--room`. NO transcript
  or evidence-path flag exists. The named-pipeline path does not even touch this helper
  (helper is only the Brain-derived `--from-*` path, `commands/pipeline.md:63-66`).
- `references/pipeline/chains-index.md` "Adding New Chains": new chain = a
  `pipelines/{chain-name}/` dir + `CHAIN.md` + numbered stage contracts + an index entry.
- Existing precedent dirs verified on disk: `pipelines/{discovery,thesis,analogy}/CHAIN.md`.

**A3 RESOLVED:** the in-session `/mos:pipeline PWS_grading` DOES run `runChain` over the
chain; the orchestrator never imports `runChain`. No thin wrapper command is needed - the
named-pipeline resolver already exists; Wave-work only adds the `PWS_grading` chain dir.

**CONSUMED-BY:** seam (d) recipe registration + `pipelines/PWS_grading/` authoring
(the recipe plan, ~Plan 05); seam (e) batch orchestrator prompt string (~Plan 07).

---

## INTAKE_PATH (Q2 / A5) - how transcript -> typed claim nodes runs headlessly

**DECISION.** The intake adapter drives `navigation.writeClaimNode(openRoomDb(scratchRoomDir), params)`
DIRECTLY from a headless Stage A prompt scoped to `Read` + `Bash(node lib/core/*)`. It
does NOT invoke the interactive `/mos:file-meeting` command. Rationale: `file-meeting`
carries an F.8 nugget-routing HITL and uses `AskUserQuestion` - it would block an
unattended `--permission-mode dontAsk` session (RESEARCH A5 risk). The Claimify WRITER is
a plain function callable without the command, so we reuse the MACHINERY (Claimify 4-pass:
selection -> disambiguation -> decomposition -> typing) while bypassing the interactive
shell. Tool-scope decision: Stage A = `--allowedTools "Read"` (extraction) plus a scoped
`Bash(node lib/core/*)` leg only where the writer must run; network tools stay denied
(student content cannot leak - Canon Part 8).

**Writer-spike result (run 2026-07-16 against a freshly scaffolded scratch room.db):**
```
scratch room: STATE.md with "Stage: Validation"; openRoomDb() created .mindrian/room.db
write1: {"ok":true,"node_id":"claim:safescan-001:16b1a9","knowledge_type":"fact"}
write2: {"ok":true,"node_id":"claim:safescan-001:172608","knowledge_type":"assumption"}
claim_rows: 2  [both type='claim', review_status='proposed']
SPIKE_OK: true
```
Proves: `openRoomDb(scratchRoomDir)` scaffolds and opens the SQLite handle; two
`writeClaimNode(db, params)` calls persist typed claim nodes with `review_status='proposed'`
(never auto-confirmed - only a human `confirmNode` promotes, Canon Part 9), with the
verbatim `quote` + `evidenced` disposition riding the additive `extraProps` blob. No
interactive command, no HITL, no shim.

**writeClaimNode contract (for the intake plan):** `params` requires `knowledge_type`
(one of the 6-member enum `{fact, causal, heuristic, anomaly_cue, mental_model, assumption}`)
and non-empty `text`; optional `sessionId`, `sourceSegment` (the M:SS timestamp),
`sourceSpeaker`, `disambiguation:'ambiguous'` (unresolved only), and `extraProps` (carries
`quote`/`evidenced`/provenance additively; protected keys filtered). Returns
`{ok, node_id, knowledge_type}` or `{ok:false, reason}`. Wisdom-nugget extraction ports the
same way (navigator ruling 3). Stage A prompt baseline = the ported fusion engine
(`assets/claims-fusion-engine-prompt.md`), Mode A + extraction discipline ONLY; Modes B/C
DISABLED (fabricated-critique failure mode #1).

**EVIDENCE.**
- `lib/core/navigation.cjs:209` re-exports `typedClaim.writeClaimNode`.
- `lib/core/navigation/typed-claim.cjs:95-172` `writeClaimNode(db, params)`: validates
  `knowledge_type` against `KNOWLEDGE_TYPES` (`:51-53`), mints `type='claim'`,
  `review_status='proposed'` on INSERT (`:161-165`), DO UPDATE excludes review_status
  (no downgrade).
- `lib/core/room-db.cjs:100` `openRoomDb(roomDir, opts)`: creates `.mindrian/room.db`,
  WAL + `timeout:5000`, inits lazygraph + memory schema.
- `skills/file-meeting/SKILL.md:286-372` Claimify 4-pass reference; `:354` "For EACH atomic
  claim, call `navigation.writeClaimNode(db, params)`"; `:372` writer mints proposed.
- `commands/file-meeting.md:6` `hitl_shape: "F.8"`, `:18` uses `AskUserQuestion` - the
  interactive HITL we bypass.

**A5 RESOLVED:** a callable non-interactive intake path EXISTS and is proven by the spike;
the intake adapter is safe under `--permission-mode dontAsk`.

**CONSUMED-BY:** seam (b) transcript->evidence intake adapter (~Plan 04).

---

## SCORED_MODE (Q3 / A1) - neutralizing the build-thesis 6/10 halt

**DECISION.** The 6/10 "Binary gate" in build-thesis is a PROMPT-LEVEL natural-language
instruction, not a CJS gate - there is no code threshold to patch. Two layers, two moves:

- **Chain-level HITL (code):** ride the `autonomous_safe: true` posture end-to-end. All four
  target commands are `autonomous_safe`, so `runChain`'s `gateFn` auto-runs each step and
  never reaches a material human gate under `dontAsk`. `validateChainAutonomy` is expected
  to report zero blockers (verify at recipe-build time).
- **Prompt-level 6/10 (natural language):** neutralize at the RUBRIC/PROMPT layer, not via a
  CLI flag (commands are markdown, take no flags) and not via a command fork (a fork breaks
  the frozen-prefix cache + drifts from shipped build-thesis).
  - **PRIMARY:** a frozen `rubric-huji.md` passed via `--append-system-prompt-file`
    instructing build-thesis to SCORE all ten questions and CONTINUE unconditionally (never
    halt below 6/10; emit per-question scores as feedback input). Keeps the prefix
    bit-identical across 200 runs (cache + grading provenance).
  - **FALLBACK:** a scored-variant reference file `references/methodology/build-thesis-scored.md`
    invoked by the `PWS_grading` recipe, used ONLY if the demo shows a residual halt.

**Deciding test:** the demo run (`--suite demo`) is the arbiter of whether the rubric-file
override alone stops the prompt-level halt. Try PRIMARY first (cheapest, cache-friendly);
adopt FALLBACK only on observed halt. This is a testable seam, not a guess.

**EVIDENCE.**
- `commands/build-thesis.md:15` `autonomous_safe: true`; `:6` `hitl_shape: "F.9"`.
- `commands/build-thesis.md:66` "Ten Questions Rapid Assessment -- Binary gate (6/10 to
  proceed)"; `:56` reads `references/methodology/build-thesis.md` for the gate - both
  natural-language, no CJS enforcement.
- `lib/core/chain-executor.cjs` `runChain` gates each step via posture from
  `recipe-maps.postureForCommand`; `autonomous_safe` steps auto-run (RESEARCH Seam c,
  Pitfall 3).

**A1 RESOLVED (to a tested plan):** rubric-file override is the primary mechanism with a
concrete fallback; the demo decides. Low risk, fully reversible.

**CONSUMED-BY:** seam (c) score-and-continue neutralization + the frozen `rubric-huji.md`
authoring (~Plan 05).

---

## AUTH_PATH (Q4) - headless session authentication source

**DECISION.** Two-stage auth split, matching the plugin-need of each stage:
- **Stage A (extraction):** `--bare` + `ANTHROPIC_API_KEY`. `--bare` skips plugin
  discovery (fast, deterministic across machines); the extraction prompt needs no plugin,
  only `Read` (+ a scoped `Bash(node lib/core/*)` writer leg). `--bare` skips OAuth/keychain,
  so the API key env var is the credential source.
- **Stage B (grading spine):** `--plugin-dir <dev-repo-checkout>` (the plugin's `/mos:`
  commands MUST load). Deterministic plugin load; uses the standard OAuth/keychain session
  (NOT `--bare`, because `--bare --plugin-dir` would drop keychain and force an API key even
  for the plugin path). Pilot is CLI-run by Jonathan, so keychain is available.

Source decision recorded so the orchestrator sets `ANTHROPIC_API_KEY` in the Stage A spawn
env and relies on keychain for Stage B. A preflight `stream-json` run asserts
`system/init` `plugins` contains the plugin and `plugin_errors` is absent, failing the
batch closed if Stage B's plugin did not load.

**EVIDENCE.**
- AI-SPEC 3 Entry Point Pattern + Key mechanics: "`--bare --plugin-dir` is the strictest
  form but skips OAuth/keychain (needs `ANTHROPIC_API_KEY`)"; "without `--bare`, `claude -p`
  auto-discovers ... The deterministic form is `--plugin-dir <path>`."
- RESEARCH Open Question 4 recommendation: Stage A `--bare` + API key; Stage B `--plugin-dir`.
- RESEARCH Runtime State Inventory: `ANTHROPIC_API_KEY` needed if `--bare` path chosen;
  `VELMA_API_KEY` NOT needed (transcript-in v1).

**CONSUMED-BY:** seam (e) batch orchestrator spawn args + env (~Plan 07); preflight leg.

---

## RECIPE_HOME (Q5) - where the ordered chain is registered

**DECISION.** Add a NEW `NAMED_RECIPES` frozen const + `recipeForName(name)` accessor to
`lib/core/recipe-maps.cjs`, mirroring the shipped `SENS10_CAUSE_RECIPES` / `recipeForCause`
pattern exactly:
- `NAMED_RECIPES` = a `Object.freeze` map of recipe-name -> a frozen array of BARE command
  strings (NO `autonomous_safe` literals fabricated here; posture is sourced separately via
  `postureForCommand`, the ONE posture authority - the T-166-02 / T-205-06-E rule).
- `recipeForName(name)` -> `string[]`: unknown / empty name -> `[]`; returns a fresh
  slice-copy of the frozen source (never the frozen array); NEVER throws.
- The one registered entry, in methodology-native order (navigator-locked):
  ```js
  PWS_grading: Object.freeze([
    '/mos:deep-grade',
    '/mos:mullins',
    '/mos:build-thesis',
    '/mos:structure-argument',
  ])
  ```
- Recipe name is EXACTLY `PWS_grading` (never "pitch-feedback"). The `pipelines/PWS_grading/`
  stage-contract order (PIPELINE_ARG) MIRRORS this list; this const is the authority.

This is genuinely net-new: the registry `curated_chains` (keyed 0-17) has no `PWS_grading`;
the closest named pipeline `thesis` is a different set/order. `NAMED_RECIPES` is a sibling
map to `SENS10_CAUSE_RECIPES`, not a modification of it.

**EVIDENCE.**
- `lib/core/recipe-maps.cjs:282-320` `SENS10_CAUSE_RECIPES` - `Object.freeze` map of
  cause-enum -> frozen bare-command-string arrays, no autonomous_safe literals (comment at
  `:270-278`).
- `lib/core/recipe-maps.cjs:322-326` `recipeForCause(cause)` - unknown/empty -> `[]`,
  `recipe.slice()` fresh copy, never throws, postures sourced by caller. The exact shape to
  mirror for `recipeForName`.
- `lib/core/recipe-maps.cjs:377` `module.exports` - export `NAMED_RECIPES` + `recipeForName`
  alongside the existing accessors.
- Native order authority: 229-CONTEXT.md Sweep 4 (mullins BEFORE build-thesis;
  structure-argument last) + AI-SPEC 3 recipe-name ruling.

**CONSUMED-BY:** seam (d) recipe registration (~Plan 05); read by the autonomy validator and
the orchestrator's stage-order check.

---

## Cross-cutting invariants (all downstream plans honor)

- **Recipe name:** `PWS_grading` for every invocable surface; "pitch-feedback" only labels
  the phase dir / opportunity file.
- **Order:** `deep-grade -> mullins -> build-thesis(scored, non-gating) -> structure-argument`.
  One authority (`NAMED_RECIPES`); `CHAIN.md` mirrors it.
- **Part 8:** student content stays local; only generic methodology handles cross to Brain
  (READ-ONLY, zero writes). Intake claim nodes are LOCAL room.db only.
- **Isolation:** one scratch room + one headless session per submission; never
  `--continue`/`--resume` across submissions; never run `compute-state` on a scratch room
  (it would overwrite the required literal `Stage: Validation`).
