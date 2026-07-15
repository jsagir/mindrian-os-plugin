---
stage: 1
methodology: deep-grade
chain: PWS_grading
input_from: null
output_to: mullins
room_section: deep-grades
---

# Stage 1: Deep Grade (Calibrated Quality Baseline)

## Input Extraction

First stage. Uses the quote-anchored evidence JSON and the populated scratch room
produced by Stage A intake (`evidence.json` + typed claim nodes in `room.db`). No
prior pipeline artifact needed.

Read the room's populated sections (problem, value proposition, evidence claims,
self-identified gaps) as scaffolded by the intake pass. Every substantive read
traces to a verbatim transcript quote or timestamp already captured in the
evidence JSON. Do NOT introduce any claim absent from that evidence.

## Stage Instructions

Run `/mos:deep-grade` against the scratch room.

Course-tier calibration (per the frozen rubric appended at session level): grade
the thinking quality a first-venture undergraduate demonstrated, NOT an
investor-grade venture. Evidence-vs-assertion awareness is rewarded at intro
depth. Disfluencies, diarization noise, and non-native phrasing are NEVER graded
as content weaknesses.

When the methodology produces its artifact, add pipeline provenance to
frontmatter:

```yaml
pipeline: PWS_grading
pipeline_stage: 1
pipeline_input: "Evidence JSON + populated scratch room (Stage A intake)"
```

## Output Contract

Writes a calibrated grade artifact to the `deep-grades` room section. The grade
and its evidence-anchored rationale become the baseline the next stage reads.

`output_to: mullins` -- Stage 2 consumes this quality baseline as the starting
read for the 7-Domains market/venture analysis.
