---
name: mos-reason
command: mos:reason
description: Generate Feynman-MINTO reasoning for a section
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get Larry's reasoning trace on a specific question."
body_shape: C
hitl_shape: "F.9"
hitl_why: "The Feynman-MINTO reasoning proceeds in a fixed order, an ordered walk."
usage: /mos:reason [--section <name>] [--regenerate-all]
serves_jtbd: ["explore"]
teaching: "When a section needs Feynman-MINTO reasoning generated against its artifacts, /mos:mos-reason produces the pyramid: governing thought down to grounded support. Larry's structured thinking surface."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["The Pyramid Principle"]
produces: "room/**/reasoning/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
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

## Execution Protocol (follow these steps exactly, in order)

### Step 0: Handle --regenerate-all (migration mode)

If the user passed `--regenerate-all`, this is a migration run that rewrites
every existing MINTO.md in the room to the post-81 Feynman-MINTO format.

Before the main per-section loop begins, run the deterministic backup and
tier-0 safety pass via the Bash tool:

```
node scripts/vault-regenerate-all.cjs <roomDir>
```

The helper creates `<roomDir>/.migration-backup/YYYY-MM-DD-HHMMSS/`, copies
every pre-existing `MINTO.md` into it preserving the section sub-path, and
runs `runTier0` for every section so the filesystem is in a readable state
even if the tier-1 loop below aborts midway through. It also writes a
per-section `report.md` in the backup directory.

Surface the helper's stdout to the user so they can see the backup location.
Then continue with Steps 1 through 9 below exactly as written. The tier-1
loop will overwrite the tier-0 files with Feynman-MINTO narrative produced
in your session. Net effect: the backup folder holds the pre-migration
state, the final files hold the tier-1 narrative, and there is no data
loss regardless of where in the loop an error happens.

If `--regenerate-all` is NOT present, skip this step entirely and start at
Step 1.

### Step 1: Identify the active room and target sections

The active room is the current working directory unless the user passed a different room path. Use `pwd` via Bash if unsure.

If the user passed `--section <name>`, the target set is exactly that one section. Otherwise, enumerate every subdirectory of the room whose name matches a canonical Data Room section (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team, team-execution, legal-ip, financial-model, meetings, opportunity-bank) and whose folder contains at least one artifact markdown file nested under a named subfolder per Decision 16.

Skip empty sections silently. A section with no artifacts has nothing to reason about.

### Step 2: Invoke the plan phase for each target section

For each target section, run via the Bash tool:

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

Parse the JSON. If the artifacts array is empty, skip the section. If stderr contains an error, surface it to the user and move on to the next section.

### Step 3: Read the artifacts in full

Each entry in `artifacts` has a `path` relative to the section directory. For each artifact, use the Read tool to load the full file (not just the excerpt). The excerpts in the payload are first-line previews; Feynman stages 1, 2, 4, 5 need the full body to do honest work.

### Step 4: Apply Feynman stages 1, 2, 4, 5 in your own reasoning

You apply the four prompts below in sequence to the section artifacts. Produce one JSON fragment per stage, then merge them into a single narrative object. Do not call any external tool for this step. You are the reasoner.

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

### Step 9: Report per-section results

After all sections are processed, report one line per section in the format:

```
<section-name>: <old-tokens> -> <new-tokens> tokens, tier-1 (Feynman-MINTO)
```

Approximate token count from character count divided by 4. Old token count comes from reading the pre-existing MINTO.md (if any) before the write phase ran; 0 if the file did not exist. Note sections that were skipped (empty or error) on their own lines.

End with a single summary line: `/mos:reason complete -- N sections regenerated, M skipped`.

## Notes

- Decision 17 (slash-command-as-orchestrator, no external API, no budget machinery) lands in CHANGELOG during plan 81-04. This slash command IS Decision 17 in practice.
- The four prompt strings inlined above are duplicated from `lib/memory/feynman-prompts.cjs` verbatim. A drift-check test at `lib/memory/feynman-prompts-drift.test.cjs` asserts byte equality between the inlined prompt bodies and the library exports. If you edit one, you must edit the other or the test will fail.
- The tier-0 fallback path (no Claude session in the loop, bare-shell invocation) is wired in plan 81-03 and is not the concern of this slash command.

---
*MindrianOS Feynman-MINTO orchestrator. Phase 81 Revision 2. Claude is the LLM.*
