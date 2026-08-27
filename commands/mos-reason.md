---
name: mos-reason
command: mos:reason
description: Generate Feynman-MINTO reasoning for a section
help_jtbd: "Get Larry's reasoning trace on a specific question."
body_shape: C
hitl_shape: "F.9"
hitl_why: "Within one section the four Feynman stages still proceed in a fixed order (F.9, an ordered walk); across sections the room's populated sections are now an independently dispatched, any-order set of jobs (Phase 265-14), so F.9 describes the intra-section walk only, not the cross-section topology."
# Phase 265-14 reward-before-investment declaration (backfilling a pre-existing
# gap, found blocking this plan's commit gate). mos-reason asks nothing beyond
# invocation: it reads a section's existing artifacts and streams the Feynman
# stage 1/2/4/5 output (essence, plain language, mental model, sweet spot,
# governing thought) directly, no form, menu, or upload required first. This
# mirrors the sibling swarm commands act.md and persona.md, whose reward is
# the same shape: structured output handed over immediately on invocation.
interactive_first_reward: schema_preview
usage: /mos:reason [--section <name>] [--regenerate-all]
serves_jtbd: ["explore"]
teaching: "When a section needs Feynman-MINTO reasoning generated against its artifacts, /mos:mos-reason produces the pyramid: governing thought down to grounded support. Larry's structured thinking surface."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["The Pyramid Principle"]
produces: "room/**/reasoning/*"
inputs: []
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  # Task is pre-approval here (see docs/SUBAGENT-DISPATCH-GRANTS.md): Phase 1 below
  # dispatches one subagent per populated room section in one turn (up to 11 on a
  # full --regenerate-all run), and without the grant each spawn triggers the normal
  # per-agent permission prompt. allowed-tools is a pre-approval list, not a
  # restriction list, so this removes prompts rather than granting a capability the
  # command did not already have. Registry row: data/subagent-dispatch-grants.json
  # (commands/mos-reason.md, token Task, status pending until plan 265-23 ratifies).
  - Task
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: minto-reason
  framework: "The Pyramid Principle"
  posture: push_forward
  hierarchy_rank: 21
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:reason -- Feynman-MINTO Orchestrator (Phase 81 Revision 2)

You are the orchestrator of the Feynman-MINTO hybrid reasoning engine. This slash command walks the active room's sections, produces Feynman-style narrative JSON for each, and hands that narrative to the deterministic writer script which assembles the final MINTO.md.

**You are the LLM.** No API key is set, no external model is called, no per-run budget is tracked. The cost to the user is whatever their existing Claude session already costs them for any other slash command. Same meter, no new meter.

**Stages 3 (Expose Confusion) and 6 (Teach It Back) are intentionally skipped** in this automated pipeline per phase 81 Decision D-2. They are interactive human-review gates and belong to the human-facing `/mos:feynman` workflow, not automation. Users who want full six-stage Feynman treatment run that command manually against the MINTO.md output.

**Tri-polar surface coverage (FEYNMINTO-10):** this slash command works identically on Claude Code CLI, Claude Desktop, and Cowork because all three surfaces run slash commands inside the same Claude session model. There is no surface-specific code path. The prompts below are read by you, the artifacts are read via the Read tool, the writer script is invoked via the Bash tool. All three surfaces support all three.

## Execution Protocol (three phases: sequential migration and enumeration, parallel per-section dispatch, sequential consolidation)

Phase 265-14 replaced the previous flat Step 0 through Step 9 walk with a hybrid protocol.
Every script invocation, every JSON schema bound, and every prompt body below is unchanged from
the prior revision; only the dispatch topology changed. Two things a naive parallelization would
get wrong, and this protocol handles both:

- **The migration backup is a real ordering dependency.** PHASE 0 below (`--regenerate-all` via
  `scripts/vault-regenerate-all.cjs`) MUST complete, and its `.migration-backup/YYYY-MM-DD-HHMMSS/`
  tree MUST exist, before PHASE 1 dispatches a single subagent. Fanning out before that backup
  exists risks a subagent overwriting a pre-migration `MINTO.md` with no recovery path. This is a
  load-bearing ordering guard, not a preference.
- **The sequential loop used to provide accidental cross-section coherence.** Before this change,
  the orchestrator had already seen earlier sections' governing thoughts by the time it reasoned
  about later ones. Independent subagents lose that entirely, so PHASE 2 makes an explicit
  cross-section coherence check that reports contradictions to the navigator instead of silently
  losing them.

### PHASE 0: Sequential Migration and Section Enumeration (orchestrator only, blocking)

Both sub-steps below run in the orchestrator's own context, in order, and both fully complete
before PHASE 1 dispatches any subagent.

#### 0a. Handle --regenerate-all (migration mode)

If the user passed `--regenerate-all`, this is a migration run that rewrites
every existing MINTO.md in the room to the post-81 Feynman-MINTO format.

Before PHASE 1 begins, run the deterministic backup and
tier-0 safety pass via the Bash tool:

```
node scripts/vault-regenerate-all.cjs <roomDir>
```

The helper creates `<roomDir>/.migration-backup/YYYY-MM-DD-HHMMSS/`, copies
every pre-existing `MINTO.md` into it preserving the section sub-path, and
runs `runTier0` for every section so the filesystem is in a readable state
even if the PHASE 1 fan-out below aborts midway through. It also writes a
per-section `report.md` in the backup directory.

Surface the helper's stdout to the user so they can see the backup location.
Then continue with PHASE 0b and PHASE 1 below exactly as written. The
subagents dispatched in PHASE 1 will overwrite the tier-0 files with
Feynman-MINTO narrative produced in each subagent's own context. Net
effect: the backup folder holds the pre-migration state, the final files
hold the tier-1 narrative, and there is no data loss regardless of which
subagent errors or where.

**This step must complete, and the backup tree must exist on disk, before any subagent is
dispatched in PHASE 1.** This is not a stylistic ordering; it is the mitigation for T-265-60
(an agent tampering with a pre-migration MINTO.md before the backup exists).

If `--regenerate-all` is NOT present, skip step 0a entirely and start at 0b.

#### 0b. Identify the active room and target sections

The active room is the current working directory unless the user passed a different room path. Use `pwd` via Bash if unsure.

If the user passed `--section <name>`, the target set is exactly that one section. Otherwise, enumerate every subdirectory of the room whose name matches a canonical Data Room section (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team, team-execution, legal-ip, financial-model, meetings, opportunity-bank) and whose folder contains at least one artifact markdown file nested under a named subfolder per Decision 16.

Skip empty sections silently (the same enumerate-and-prune rule `grade --full` uses). A section with no artifacts has nothing to reason about.

For each target section, also read its pre-existing `MINTO.md` (if any) NOW and record its
character-derived token count as `old_tokens` (0 if the file does not yet exist). PHASE 2's
per-section report needs this "old" number, and it must be captured here, before PHASE 1 writes
anything, or the comparison is meaningless.

### PHASE 1: Parallel Section Fan-Out (one subagent per populated section)

Size the fan through `planDispatch`, not a hardcoded N:

```
node lib/core/dispatch-optimizer.cjs plan <roomDir>
```

`planDispatch(roomDir, {remainingContext, maxBudget, preferredModel})` returns
`{agents, model, sections, cost, budget, downgrade, reasoning}`, including an automatic model
downgrade when the budget is tight. Resolve the model ONCE in the orchestrator, not once per
subagent, via:

```
node lib/core/model-profiles.cjs resolve <roomDir> framework-runner
```

`framework-runner` is the right `MODEL_PROFILES` entry for this generative reasoning work
(`{quality: opus, balanced: opus, budget: sonnet}`), the same tier `/mos:act` uses for full
methodology sessions, distinct from the lighter `grading` and `persona-analyst` tiers `grade`
and `persona` resolve. If the resolved model is `skip`, tell the user reasoning is not available
at the current venture stage and STOP rather than dispatching anyway.

Name `subagent_type: framework-runner` explicitly in the dispatch instruction (not a file path --
an Agent tool call that cannot resolve a `subagent_type` is a hard error listing available agents
since 2.1.235). `agents/framework-runner.md` exists on disk and matches this name.

Dispatch every target section's subagent in ONE message so the spawns actually batch. Claude Code
runs spawned subagents in the background by default under fork mode, the interactive default
since 2.1.232 -- do NOT pass any manual background-execution parameter to the Agent tool call;
the platform removes that kind of parameter from the Agent tool entirely once
fork mode is on (code.claude.com/docs/en/sub-agents). The platform caps concurrent subagents at 20
(`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); clamp N to 20 as the standing rule even though the
section count here (at most 11) is already well under the cap, so a future author does not
reintroduce an unbounded fan-out.

Print a status block before waiting, mirroring `grade --full` and `persona --parallel`:

```
[MOS-REASON] Dispatching N agents

  Agent 1: problem-definition     [running]
  Agent 2: market-analysis        [running]
  ...

  Model: {resolved model} (all agents)
  Sections: {N} populated of {total enumerated}
  Waiting for all agents to complete...
```

#### Each subagent's contract (one section)

- **Input:** roomDir, its section slug, the resolved model, and the four Feynman prompt bodies
  (Stage 1, 2, 4, 5) as DATA, not as a re-typed literal.
- **CRITICAL, and this is the constraint that shapes the whole design: do NOT inline a third copy
  of the prompts in the subagent definition.** `lib/memory/feynman-prompts-drift.test.cjs`
  enforces byte equality between `lib/memory/feynman-prompts.cjs` and the sentinel blocks kept
  below in this file. A third literal copy pasted into an agent prompt would either break that
  test or require it to grow a third arm it was never designed to own. Instead, the orchestrator
  reads the four prompt bodies at dispatch time directly from the library source of truth:

  ```
  node -e "const p = require('./lib/memory/feynman-prompts.cjs'); console.log(JSON.stringify(p));"
  ```

  and passes `STAGE_1_ESSENCE`, `STAGE_2_PLAIN_LANGUAGE`, `STAGE_4_MENTAL_MODEL`, and
  `STAGE_5_SWEET_SPOT` as data in each subagent's dispatch prompt. The sentinel-wrapped copy below
  stays exactly where it is, byte-identical, and exists ONLY so the drift test keeps enforcing
  byte equality on the two remaining copies (library + this file's documentation); it is never a
  third editable source and it is never re-typed into the subagent definition.
- **Work:** run `node scripts/vault-section-minto-generator.cjs <roomDir> --plan --section <name>`,
  parse the JSON, Read EVERY listed artifact IN FULL (not just the excerpt -- the excerpts in the
  payload are first-line previews; Feynman stages 1, 2, 4, 5 need the full body to do honest
  work), apply the four Feynman stages received as input, assemble the merged narrative object
  honoring every character bound, write a temp JSON file, validate it parses, run the write phase,
  and delete the temp file on success while KEEPING it on failure for debugging. The full step
  detail (JSON schemas, temp-file paths, validation commands) is unchanged from the prior
  revision and appears below this contract.
- **Returns:** `{section, ok, governing_thought, key_claims[], old_tokens, new_tokens, error?}`.
  The subagent returns the governing thought and key claims AS DATA, not just a status line,
  because PHASE 2's coherence check needs them.
- **Constraint:** a subagent writes only its own section's `MINTO.md` and its own temp file. It
  never writes another section's output and never edits room state outside its own section.
- **On per-section failure:** if the plan-phase invocation errors, or the write-phase invocation
  fails schema validation, the subagent surfaces the error in its own return (`ok: false, error:
  "..."`) rather than retrying or touching another section. This mirrors the original loop's own
  stated behavior ("surface it to the user and move on to the next section") -- the difference is
  that "moving on" is now automatic, because every other section's subagent is already running
  independently in its own context.

The remaining step-by-step detail every subagent follows (unchanged from the prior revision, and
kept here as the canonical reference the orchestrator hands each subagent as instructions):

### Step 2: Invoke the plan phase for the subagent's own section

Run via the Bash tool:

```
node scripts/vault-section-minto-generator.cjs <roomDir> --plan --section <section-name>
```

Capture stdout. It is a JSON object conforming to the shape:

```
{
  "section_path": "...",
  "section_name": "...",
  "artifacts": [ { "path": "...", "title": "...", "excerpt": "..." }, ... ],
  "target_minto_path": "...",
  "structural": { "frontmatter": {...}, "mece_tree": "...", "cross_refs": [...], "sources": [...], "navigation": {...}, "gaps": [...], "governing_thought_placeholder": "..." }
}
```

Parse the JSON. If the artifacts array is empty, return `{section, ok: false, error: "no artifacts"}` without writing anything. If stderr contains an error, surface it in the returned `error` field.

### Step 3: Read the artifacts in full

Each entry in `artifacts` has a `path` relative to the section directory. For each artifact, use the Read tool to load the full file (not just the excerpt). The excerpts in the payload are first-line previews; Feynman stages 1, 2, 4, 5 need the full body to do honest work.

### Step 4: Apply Feynman stages 1, 2, 4, 5 in your own reasoning

Apply the four prompts below (received from the orchestrator as data, per this contract's CRITICAL
note above -- never re-typed here) in sequence to the section artifacts. Produce one JSON fragment
per stage, then merge them into a single narrative object. Do not call any external tool for this
step. You are the reasoner.

Substitute `{section_name}` with the actual section slug and `{artifacts}` with a rendered list of `- Title: excerpt` pairs (or the full artifact bodies if you prefer; the prompts work on either).

<!-- STAGE_1_ESSENCE start -->
You are running Feynman Stage 1 (Reduce to Essence) on a Data Room section.

Section: {section_name}

Artifacts in this section:
{artifacts}

Task: read the artifacts above and strip the section to its irreducible
fundamental truth. Remove jargon, remove implementation detail, remove
anything that a smart reader would already know. What remains is the one
essential claim this section makes about the venture.

Constraints:
- One sentence only.
- Maximum 200 characters.
- Plain language, concrete nouns, active verbs.
- No hyphens used as dashes. No em-dashes. No en-dashes.
- No hedging phrases like "it seems" or "arguably".
- If the section contains no usable signal, return a one-sentence honest
  placeholder describing the gap rather than fabricating content.

Output contract: return a single JSON object on one line, no prose, no
markdown fences. Shape:
{"essence": "<one sentence max 200 chars>"}
<!-- STAGE_1_ESSENCE end -->

<!-- STAGE_2_PLAIN_LANGUAGE start -->
You are running Feynman Stage 2 (Translate to Plain Language) on a Data
Room section.

Section: {section_name}

Artifacts in this section:
{artifacts}

Task: rewrite what this section is saying as if you were explaining it to
a smart generalist investor who sees a thousand pitches a year. Short
sentences. Everyday words. Concrete descriptions over abstract terms. No
academic tone. The reader should feel the point is obvious on first read.

Constraints:
- Exactly two sentences.
- Maximum 400 characters total including spaces.
- Zero hyphens acting as dashes. Zero em-dashes. Zero en-dashes.
- No filler phrases like "in essence" or "at a high level".
- Replace any word you would not say out loud in a conversation.
- If you need jargon, you do not yet understand it.

Output contract: return a single JSON object on one line, no prose, no
markdown fences. Shape:
{"plain_language": "<two sentences max 400 chars total>"}
<!-- STAGE_2_PLAIN_LANGUAGE end -->

<!-- STAGE_4_MENTAL_MODEL start -->
You are running Feynman Stage 4 (Build Mental Model) on a Data Room
section.

Section: {section_name}

Artifacts in this section:
{artifacts}

Task: build one analogy that makes this section instantly graspable.
Name a familiar source domain. Map two to four specific pieces of the
source domain onto the target concept. Then state where the analogy
breaks so the reader does not over-extend it.

Constraints:
- analogy: one sentence naming the analogy. Maximum 150 characters.
- mapping: two to four sentences describing how the source maps to the
  target. Maximum 500 characters total.
- limits: one sentence stating where the analogy stops being accurate.
  Maximum 150 characters.
- Zero em-dashes. Zero en-dashes. Hyphens only when joining compound words.
- The analogy must be something a non-technical reader already knows.
- If no honest analogy fits, return a one-sentence analogy of the gap
  itself rather than forcing a bad fit.

Output contract: return a single JSON object on one line, no prose, no
markdown fences. Shape:
{"mental_model": {"analogy": "<max 150>", "mapping": "<max 500>", "limits": "<max 150>"}}
<!-- STAGE_4_MENTAL_MODEL end -->

<!-- STAGE_5_SWEET_SPOT start -->
You are running Feynman Stage 5 (Simplify Until It Breaks) on a Data Room
section. You also produce the Minto-style governing thought and key claims
for the MINTO.md header in the same pass.

Section: {section_name}

Artifacts in this section:
{artifacts}

Task: find the simplest version of this section that is still true.
Keep stripping detail until the next strip would make it wrong. That is
the sweet spot. Then state the governing thought (the single top-of-pyramid
claim this section makes) and the three to five key claims that support it.

Constraints:
- governing_thought: one sentence, maximum 250 characters, Minto-style
  top-of-pyramid claim for this section.
- sweet_spot: two to four sentences, maximum 600 characters total, the
  understanding you want the reader to carry away.
- key_claims: array of 3 to 5 strings. Each claim maximum 200 characters.
  Each claim in plain language, each claim supporting the governing
  thought, each claim independently checkable against the artifacts.
- Zero em-dashes. Zero en-dashes. Hyphens only for compound words.
- No repetition across claims. No filler claims added to reach the minimum.
  If only three honest claims exist, return three.

Output contract: return a single JSON object on one line, no prose, no
markdown fences. Shape:
{"governing_thought": "<max 250>", "sweet_spot": "<max 600>", "key_claims": ["<max 200>", "<max 200>", "<max 200>"]}
<!-- STAGE_5_SWEET_SPOT end -->

### Step 5: Assemble the narrative JSON object

Merge the four stage outputs into one object conforming to the R-3 schema from `.planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md`:

```
{
  "section": "<section-name>",
  "essence": "<from stage 1>",
  "plain_language": "<from stage 2>",
  "governing_thought": "<from stage 5>",
  "mental_model": { "analogy": "...", "mapping": "...", "limits": "..." },
  "sweet_spot": "<from stage 5>",
  "key_claims": [ "...", "...", "..." ]
}
```

No em-dashes (U+2014) or en-dashes (U+2013) in any string. Hyphens only for compound words. The deterministic validator in `lib/memory/narrative-schema.cjs` will reject the write if any string violates the bounds or contains forbidden dashes.

### Step 6: Write the narrative JSON to a temp file

Primary path:

```
/tmp/mos-reason-<section-name>-<timestamp>.json
```

If `/tmp` is not writable (containerized Cowork environments sometimes are not), fall back to:

```
<roomDir>/.mos-reason-tmp/<section-name>-<timestamp>.json
```

Create the fallback directory first via `mkdir -p` if needed. `<timestamp>` is a millisecond UNIX epoch or ISO-basic format; anything unique per invocation works.

Use the Write tool to emit the JSON file. Validate it is parseable by running `node -e "JSON.parse(require('fs').readFileSync('<path>','utf-8'))"` via Bash before proceeding. If parse fails, fix the JSON and try again.

### Step 7: Invoke the write phase

Run via Bash:

```
node scripts/vault-section-minto-generator.cjs <roomDir> --write --section <section-name> --narrative <tempfile-path>
```

Capture stdout and stderr. A successful run prints `wrote MINTO.md: <abs-path>`. A schema violation prints `ERROR: narrative schema validation failed: ...` and exits non-zero. If it fails, leave the temp file in place for debugging, surface the error to the user, and move on to the next section.

### Step 8: Clean up the temp file

On success, `rm` the temp file via Bash. On failure, keep it so the user can inspect it.

### PHASE 2: Sequential Consolidation (orchestrator only)

Once every PHASE 1 subagent has returned (or been waited on to completion), the orchestrator runs
four steps in its own context, in order. Nothing in this phase is delegated to a subagent.

1. **Report per-section results.** For each returned section, report one line in the format:

   ```
   <section-name>: <old-tokens> -> <new-tokens> tokens, tier-1 (Feynman-MINTO)
   ```

   Approximate token count from character count divided by 4. Old token count is the `old_tokens`
   captured in PHASE 0b, before any subagent wrote anything. New token count comes from the
   subagent's returned `new_tokens`. Note sections that were skipped (empty, per PHASE 0b's prune)
   or errored (per each subagent's `ok: false, error`) on their own lines.

   End with a single summary line: `/mos:reason complete -- N sections regenerated, M skipped`.

2. **CROSS-SECTION COHERENCE CHECK (new -- the part naive parallelization would miss).** Compare
   the `governing_thought` value returned by every subagent across all sections and flag direct
   contradictions -- for example financial-model asserting a price point that business-model
   contradicts. This exists because the sequential loop this protocol replaces used to provide
   this coherence by accident: the orchestrator had already seen earlier sections' governing
   thoughts by the time it reasoned about later ones. Independent subagents lose that entirely, so
   the check becomes explicit here rather than silently disappearing. This is a REPORT-AND-FLAG
   step, never an auto-edit: surface any contradiction found to the navigator as its own line in
   the output, consistent with this repo's proposed-not-confirmed discipline (Canon Part 3). Do
   not rewrite either section's `governing_thought` to resolve the contradiction; that decision
   belongs to the navigator, not to this command.

3. **No artifact dedup needed, and state why.** Inputs are disjoint by construction (each
   subagent reads only its own section's artifacts) and outputs are disjoint by construction (each
   subagent writes only its own section's `MINTO.md`), so two subagents cannot produce duplicate
   `MINTO.md` files. Nothing to reconcile here beyond the coherence check in step 2.

4. **Trigger the cascade.** Parallel per-section reasoning generates cross-section observations,
   mirroring `grade.md` step 6 and `persona.md` step 6:

   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/compute-hsi.py" room
   ```

## Notes

- Decision 17 (slash-command-as-orchestrator, no external API, no budget machinery) lands in CHANGELOG during plan 81-04. This slash command IS Decision 17 in practice.
- The four prompt strings inlined above are duplicated from `lib/memory/feynman-prompts.cjs` verbatim. A drift-check test at `lib/memory/feynman-prompts-drift.test.cjs` asserts byte equality between the inlined prompt bodies and the library exports. If you edit one, you must edit the other or the test will fail.
- The tier-0 fallback path (no Claude session in the loop, bare-shell invocation) is wired in plan 81-03 and is not the concern of this slash command.

---
*MindrianOS Feynman-MINTO orchestrator. Phase 81 Revision 2. Claude is the LLM.*
