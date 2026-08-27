---
stage: 3
methodology: build-thesis
chain: PWS_grading
input_from: mullins
output_to: structure-argument
room_section: financial-model
scored_mode: true
---

# Stage 3: Build Thesis (Scored, Non-Gating)

## Input Extraction

Extract from the Stage 2 artifact (scan `room/mullins/` for the most recent
artifact with `pipeline: PWS_grading` and `pipeline_stage: 2` in frontmatter):

- **7-Domains read** -- the market/industry/team context each of the ten
  questions is scored against
- **Evidence-anchored strengths and gaps** -- still tied to transcript
  quotes/timestamps; the ten questions are answered from THIS evidence, never
  from invented content

## Stage Instructions

Run `/mos:build-thesis` against the scratch room.

**SCORE-AND-CONTINUE (this stage is non-gating).** The shipped build-thesis body
carries a prompt-level 6/10 "Binary gate" that STOPS below threshold. In this
chain that halt is neutralized: SCORE all ten questions and CONTINUE
unconditionally. Never halt below 6/10. Emit the per-question 0/1 scores WITH
their one-line evidence as feedback input for the packaging stage, not as a
go/no-go gate. The primary mechanism is the frozen course-tier rubric
`${CLAUDE_PLUGIN_ROOT}/references/methodology/rubric-huji.md` appended at session level via
`--append-system-prompt-file`; `${CLAUDE_PLUGIN_ROOT}/references/methodology/build-thesis-scored.md` is
the demo-verified fallback scored variant if a residual halt is observed.

Course-tier discipline: score the ten questions at the depth the assignment
teaches. Do NOT fail a course pitch on unit economics, moat, defensibility, or
valuation the assignment never asked for. Credit self-identified gaps; never
double-punish metacognition. Never penalize disfluencies, diarization noise, or
non-native phrasing.

When the methodology produces its artifact, add pipeline provenance to
frontmatter:

```yaml
pipeline: PWS_grading
pipeline_stage: 3
pipeline_input: "7-Domains read from stage 2"
```

## Output Contract

Writes a scored Ten-Questions thesis artifact to the `financial-model` room
section. The artifact carries per-question scores and evidence, NOT a
gate-passed/failed halt.

`output_to: structure-argument` -- Stage 4 packages the surviving points into a
Minto Pyramid.
