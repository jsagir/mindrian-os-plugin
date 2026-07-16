---
stage: 4
methodology: structure-argument
chain: PWS_grading
input_from: build-thesis
output_to: null
room_section: argument
---

# Stage 4: Structure Argument (Minto Pyramid Packaging)

## Input Extraction

Extract from the Stage 3 artifact (scan `room/financial-model/` for the most
recent artifact with `pipeline: PWS_grading` and `pipeline_stage: 3` in
frontmatter):

- **Per-question scores + evidence** -- the scored (non-gating) Ten-Questions
  read; each score still carries its transcript quote/timestamp
- **Strengths and gaps** across deep-grade, mullins, and the scored thesis -- the
  raw material to package as the student-facing feedback

structure-argument runs LAST: it is the Minto packaging step, not a new analysis.
Do NOT introduce claims absent from the upstream evidence.

## Stage Instructions

Run `/mos:structure-argument` against the scratch room to package the feedback as
a Minto Pyramid tiered to the student's level:

- **Governing thought first** -- one clear top-line the student can act on
- **2-3 MECE branches** -- each branch names the criterion (feed-up), what this
  pitch did against it with the quoted evidence (feed-back), and ONE concrete
  next step at course level (feed-forward)
- **Every quoted span is byte-verbatim.** Each quote you deliver is a single
  contiguous run copied character for character from the transcript: no ellipsis
  joins across non-adjacent fragments (never `"biosensor engineer... a mobile app
  developer"`), no cleaned disfluencies (keep `vali- validating`, `surprising--
  important`), nothing added or dropped inside the span. Quote less, but exactly -
  the delivered quotes are re-checked against the transcript by the D1 verifier
  before the artifact is written (see rubric-huji.md Section 3b).
- Length proportionate to a 2-minute pitch; never a 4,000-word essay
- Credit self-identified gaps and deepen them (HOW to do the work, not THAT it is
  missing); never punish disfluencies or non-native phrasing

When the methodology produces its artifact, add pipeline provenance to
frontmatter:

```yaml
pipeline: PWS_grading
pipeline_stage: 4
pipeline_input: "Scored Ten-Questions read from stage 3"
```

## Output Contract

Final stage -- no `output_to`. This completes the PWS Grading Pipeline.

### What the Full PWS Grading Pipeline Produced

Across all 4 stages, the scratch Room now contains:

| Room Section | Artifact | From Stage |
|-------------|----------|------------|
| deep-grades | Calibrated grade at course tier | Stage 1 |
| mullins | 7-Domains market/venture read | Stage 2 |
| financial-model | Scored Ten-Questions thesis (non-gating) | Stage 3 |
| argument | Minto Pyramid feedback (governing thought + 2-3 branches) | Stage 4 |

The provenance chain (`pipeline: PWS_grading`, `pipeline_stage: 1/2/3/4`)
connects all four artifacts, showing how a quote-anchored evidence JSON became
packaged formative feedback through the navigator-locked native-order chain.
