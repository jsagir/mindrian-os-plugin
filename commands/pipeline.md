---
name: pipeline
description: Chain a multi-step methodology pipeline
help_jtbd: "Chain methodologies stage-by-stage."
body_shape: E
hitl_stages:
  - stage: "build-path"
    shapes: ["F.2"]
    mode: "ordered"
  - stage: "ordered-stages"
    shapes: ["F.9"]
    mode: "ordered"
hitl_why: "A multi-stage pipeline runs a dependency path (F.2) as a fixed-order stage walk (F.9)."
# Phase 267.3-04, ruled in 267.3-CLASSIFICATION.md (Row 12): first delivery at commands/pipeline.md:65, the Brain-derived framework chain printed as an ordered run order the command then goes on to execute, on the --from-problem-type / --from-framework path.
interactive_first_reward: schema_preview
argument-hint: '[pipeline-name] [--from-problem-type <x>] [--from-framework <x>]'
serves_jtbd: ["plan-execution"]
teaching: "When you want several methodologies chained instead of run one-by-one, /mos:pipeline executes a multi-step pipeline with the room as the connecting tissue. Week 7 pattern."
# --- Phase 122 workflow-layer frontmatter ---
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: pipeline-chain
  posture: push_forward
  hierarchy_rank: 7
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.0
---

# /mos:pipeline

You are Larry. This command orchestrates multi-step methodology chains -- connected sequences where each framework's output feeds the next as structured input.

## Runtime: the shared runChain spine

The pipeline does NOT hand-roll its own stage walk. It is a CONSUMER of the ONE shared gated loop in `lib/core/chain-executor.cjs` `runChain` (the spine extracted in Wave 2; act and ignite ride it too -- no consumer owns a loop). The pipeline composes its stage chain (the resolver-composed `/mos:` sequence, below) and then calls `runChain`, supplying callbacks only:

- `provenanceFn` = `lib/mcp/pipeline-state.cjs` `makeProvenanceFn(chainName)`. The pipeline is the consumer that stamps each stage artifact's `pipeline` + `pipeline_stage` frontmatter (the framework-runner contract). act and ignite pass `provenanceFn: null`; the pipeline is the one that supplies it.
- `postureFn` = `lib/core/recipe-maps.cjs` `postureForCommand` (the ONE posture authority, joined from the LOCAL command-registry).
- the default `gateFn` (push-forward only when the step is autonomous_safe, the inbound quality is not low, and the step is reversible).
- `onStep` = dispatch the per-stage framework-runner (one framework per call), returning `{ chain_output, quality }`.

The ~60 duplicated stage-walk lines this command used to carry are now the shared runChain spine (de-dup). The user contract below -- stage-by-stage with checkpoints, resumability, additive artifacts -- is unchanged in behavior; only the runtime moved onto the spine.

## Brain-Derived Chains -- `--from-problem-type <x>` / `--from-framework <x>`

`/mos:pipeline --from-problem-type ill-defined` (or `--from-framework "Beautiful Question Framework"`) does NOT run a static named pipeline -- it Brain-derives the framework chain and runs the resolver-composed `/mos:` command sequence end to end:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline-command.cjs" --from-problem-type ill-defined --room ./room
```

The helper calls `lib/brain/chain-recommender.cjs` `recommendFrameworkChain` (a FEEDS_INTO traversal -- framework names + problem-type enums only; Canon Part 8: never a command string, never user content), composes that chain into `/mos:` commands via `lib/workflow/command-resolver.cjs` `composeWorkflow` (the SOLE framework -> command path, reading only the generated `data/command-registry.json`), and prints the run order. Then run the printed `/mos:` commands in sequence using the Stage Execution Loop machinery below -- one resolved command per step. For a step whose framework has no `/mos:` command, the helper prints "no /mos: for <framework> -- run it manually; continuing"; skip that step (or run the framework manually) and continue. Every command the helper prints exists in the registry -- the resolver only ever returns registered commands, so you never invoke a `/mos:` that does not exist.

`--from-problem-type` accepts the canonical `UDP` / `IDP` / `WDP` tokens and the `undefined` / `ill-defined` / `well-defined` aliases. With neither flag and no named pipeline, the helper falls back to the room's `ProblemType` from `room/STATE.md`.

## Brain Enhancement (Optional)

Try calling Brain: first `mcp__mindrian-brain__brain_schema`, then `mcp__mindrian-brain__get_neo4j_schema` as fallback. If it succeeds, Brain mode is active. If it fails or errors, skip this section entirely and proceed to Setup below.

**If Brain connected:**

1. Read `${CLAUDE_PLUGIN_ROOT}/references/brain/query-patterns.md` for `brain_framework_chain` pattern
2. When the user says just "pipeline" with no name, use Brain to suggest dynamic chains based on room state:
   - Run `brain_framework_chain` with current room frameworks to discover graph-informed sequences
   - Present Brain-recommended chains alongside the static Discovery/Thesis pipelines from chains-index.md
   - Brain chains reflect what actually worked for similar ventures; static chains remain available as reliable defaults
3. When a specific pipeline is selected, Brain can also optimize stage transitions by checking `brain_gap_assess` between stages to surface prerequisites that might need attention before proceeding

Proceed to Setup below with this additional context. Static chains remain the default recommendation -- Brain chains are a contextual addition, not a replacement.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/pipeline/chains-index.md` for available pipelines
2. Read `room/STATE.md` for venture context (if exists)
3. Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/problem-types.md` for routing awareness (if recommending)

## Session Flow

### Chain Selection

**If user passes `--from-problem-type <x>` or `--from-framework <x>`:**
Run the helper above (`scripts/pipeline-command.cjs`) to Brain-derive the chain and get the resolver-composed `/mos:` run order, then execute those commands in sequence via the Stage Execution Loop. This is the dynamic, graph-derived path -- no `CHAIN.md` file involved.

**If user specifies a pipeline name** (e.g., `/mos:pipeline discovery`):
Load `pipelines/{name}/CHAIN.md` and proceed to Stage 1.

**If user says just "pipeline" with no name:**
Recommend based on venture stage and room state:
- Pre-Opportunity or Discovery stage -> suggest **discovery** pipeline
- Design or Investment stage -> suggest **thesis** pipeline

Present both options with brief descriptions from the chains-index. Let the user choose. Do not auto-select.

### Pipeline Resumption Check

Resume reads from `lib/mcp/pipeline-state.cjs` ONLY -- the SOLE chain-state source of truth (B1, D-166-02). Before starting Stage 1, call `reconcileResume(roomDir)`: it returns the resume position (`chain_position` = the last completed stage) and the `nextStage` to run, sourced from `room/.mindrian/pipeline-state.json`. The Wave-1 isNext hard gate (`checkPosition`) prevents re-running an already-completed stage on resume.

The artifact-frontmatter scan (scanning the Room for existing artifacts with `pipeline: {chain}` in frontmatter, keyed by `pipeline_stage` values) is a SECONDARY confirming index ONLY -- a human-readable mirror, never a competing chain-state source. `reconcileResume` cross-checks it: when the scan AGREES with pipeline-state.json it confirms the position; when the scan DISAGREES, the helper trusts pipeline-state.json (the sole truth) and flags the frontmatter STALE (never the reverse -- the scan never overrides the store). This is the user-facing half of the B1 reconciliation: two resume memories can no longer compete, because exactly one store is authoritative.

If a resume position is found:
- Offer: "I see you've already completed Stage {N} of the {chain} pipeline (per pipeline-state.json). Want to continue from Stage {N+1}? Or start fresh?"

### Stage Execution Loop

For each stage in the chain:

1. **Read the stage contract:** `pipelines/{chain}/{NN}-{methodology}.md`

2. **Extract input from previous stage** (if not Stage 1):
   - Read the previous stage's `room_section` from its contract
   - Scan that room section for the most recent artifact with `pipeline: {chain}` and `pipeline_stage: {N-1}` in frontmatter
   - Extract the data specified in the previous stage's Output Contract
   - Present to user: "From your {previous methodology} work, I'm bringing forward: {extracted data}"

3. **Run the methodology:**
   - Execute the methodology command (e.g., `/mos:explore-domains`) with the extracted context pre-loaded as additional context
   - Let the methodology run its full session -- do not shortcut or abbreviate

4. **Add pipeline provenance to artifact:**
   The provenance stamp is supplied to `runChain` as `provenanceFn = makeProvenanceFn(chainName)` (lib/mcp/pipeline-state.cjs); it stamps each stage artifact with the `pipeline` + `pipeline_stage` fields per the framework-runner contract. Ensure these fields land in the YAML frontmatter (the `pipeline_input` line is a human-readable note, not chain state):
   ```yaml
   pipeline: {chain-name}
   pipeline_stage: {stage-number}
   pipeline_input: "{brief description of what was extracted from previous stage}"
   ```
   This frontmatter is the SECONDARY confirming index for resume; the authoritative chain state lives in `room/.mindrian/pipeline-state.json`.

5. **Stage transition:**
   - If more stages remain: "Stage {N} complete. Continue to {next stage name}? Or take a different path?"
   - If final stage: proceed to Pipeline Complete summary

### User Exit (Any Point)

If user wants to exit mid-pipeline:
- Summarize what was completed so far (which stages, what artifacts were produced, where they were filed)
- Remind them: "You can resume later -- I'll detect your existing pipeline artifacts by their provenance metadata and offer to pick up where you left off."
- Do not pressure them to continue. Pipelines are suggested sequences, not mandatory.

### Pipeline Complete

When all stages are done:
- Summarize the full chain: what was produced at each stage, where each artifact was filed
- Show the provenance chain: how the output of each stage fed the next
- Suggest next steps based on what the pipeline revealed

## Behavioral Rules

1. **Pipelines are SUGGESTED sequences, not mandatory.** User can exit at any point. Never guilt-trip about incomplete pipelines.
2. **Never modify previous stage artifacts.** Each stage creates its own artifact. The chain is additive, not destructive.
3. **All methodologies remain independently invocable.** Pipeline wraps them with input/output context. It does not change how the methodology works.
4. **Pipeline resumability.** Resume reads `lib/mcp/pipeline-state.cjs` via `reconcileResume` -- the SOLE chain-state truth (B1, D-166-02). If a resume position exists, always offer to resume from the next incomplete stage before starting fresh. The artifact-frontmatter scan is a SECONDARY confirming index, not a competing source: on disagreement the store wins and the frontmatter is flagged stale.
5. **Present extracted input transparently.** Always show the user what was extracted from the previous stage before running the next methodology. They should see the chain of reasoning.
