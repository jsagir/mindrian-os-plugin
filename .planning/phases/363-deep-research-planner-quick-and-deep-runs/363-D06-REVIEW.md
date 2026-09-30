---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 21
artifact: D-06 review sheet (unscored)
produced_by: 363-21 Task 1 (executor playing Larry; the executor does not score)
plan_base: bc2cf50eb1881d405f0563f5a9cf5233243cba5e
date: 2026-09-30
rubric: 363-D06-RUBRIC.md
decisions: [D-00, D-06, D-18]
---

# Phase 363 - D-06 Review Sheet: the /mos:map-unknowns research plan

Status: built, NOT scored. The scoring sheets and the Navigator verdict below are blank on purpose
(T-363-52: the executor never grades its own output).

## 1. The stated question (verbatim)

> Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?

## 2. How this plan was produced (read this first)

- Command followed: `commands/map-unknowns.md` as shipped by 363-19, in order: Setup, the Session
  Flow matrix walked one quadrant at a time, then the Research planner section steps 1 to 9
  (step 1, the one-line offer, had no live navigator to answer it; step 2, `pending --room <room>`,
  was run AFTER the plan step by mistake of order and returned `{"ok":true,"cards":[]}` for both
  rooms, so no room-started card was waiting; step 8, the hand-off, is only text).
- There was NO live navigator. The executor played both Larry and the matrix answers, so the
  matrix below comes from the stated question and from what the fixture room holds, not from a
  person's own thinking. This is a limit of the harness, not of the command; the optional live
  check in Task 2 (how-to-verify step 5) removes it.
- The fixture rooms are synthetic scratch rooms under the session scratchpad, never under
  `~/MindrianRooms`. The room holds generic notes on surface fouling in closed water loops,
  incumbents that rely on periodic chemical dosing, and a whitespace gap term
  "acoustic biofilm disruption". It holds nothing about hospitals.
- The question set was written once and not tuned against the rubric. It was changed exactly once,
  in response to the plan step's own instruction (step 7): attempt 1 came back with status
  `needs_lens_leaves` on both engines, and the card asked for sub-questions for the four diffusion
  lens dimensions. The executor added a fifth key-line branch (K5) and leaves L9 to L12 for them and
  planned again. Nothing else changed between attempt 1 and attempt 2.
- Why the diffusion lens was selected: the executor wrote unlock-chain steps with `kind: adoption`
  (L2, L4 chains); the planner reports `lenses_selected: diffusion, source sr_step, reason "A
  roadmap unlock chain has an adoption step."`. Step 5 of the command says to add the diffusion
  lens when the question is about a dual-use or deep-tech technology's adoption; the executor did not
  add a `lens_selection` entry of its own. The navigator may judge whether L9 to L12 belong.
- Same question set for both engines: the two question-set files are byte-identical (sha256
  `b37f3f5adf646d7947ec0e298699cda4a141e322db22e4903b22e0d90a0c8319`). Only the room differs (USER.md canonical role founder vs researcher), which is what
  switches the engine.
- No network: only `node scripts/research-planner.cjs plan <qs.json> --room <room> --mode deep` ran.
  The researcher run reports `structure_source: theo_ledger`, which is the shipped local ledger file
  (no Brain or web call).
- Commands run (scratch paths abbreviated `$S`):
  `TMPDIR=$S/rooms node -e 'buildRoom363({role})'` (once per role), then for each engine
  `node scripts/research-planner.cjs plan $S/qs/<qs>.json --room <room> --mode deep` twice
  (attempt 1 = `needs_lens_leaves`, attempt 2 = `ready`). The cards below are attempt 2 verbatim.

### The matrix as Larry walked it (inputs to the question set)

| Quadrant | What Larry put in it | Where it came from |
|----------|----------------------|--------------------|
| Known knowns (unchecked) | Acoustic methods remove biofilm from pipe walls; the method is low-cost; chemical flushing is what hospitals do today | The stated question's own premises, and the room's competitors note |
| Blind spots | What water-safety and infection-control teams require; what happens to detached biofilm and regrowth; how far acoustic energy reaches along a pipe | What people outside the navigator's view (infection control, microbiology, acoustics) would know |
| Hidden knowns | Which lines foul first, and what the facilities team suspects about why | Tacit knowledge; not researchable |
| Unknown unknowns | What adjacent industries that fight pipe fouling would show | The only leaf kind this dimension allows (origin mece_gap) |

The perspective block (tension, unquantified goal with a stated falsifier, Technical Roadmap /
programs, the three forum passes in order, three MECE paths with a 10X resurvey path, one physics
and three assumed limiters with unlock chains) is inside the question-set files below.

## 3. Engine A: constraint-layer engine (founder room)

Room role: founder. Engine reported in plan.json perspective: constraint-layer. Attempt 1 run rp-2026-09-30-d2e8450f (needs_lens_leaves). Attempt 2 run rp-2026-09-30-df286585 (ready).

### A.1 Question-set file (verbatim, the file the plan step read)

File: `qs-founder.json` in the scratch dir (outside the room).

<details><summary>question-set JSON</summary>

```json
{
  "schema": "mos.research-question-set/1",
  "template_id": "map-unknowns",
  "command": "/mos:map-unknowns",
  "stated_question": "Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?",
  "scqa": {
    "situation": "Hospitals keep their water lines safe today by flushing them with chemicals on a schedule.",
    "complication": "Chemical flushing is disruptive and recurring, and an acoustic method is a cheaper-sounding alternative whose real performance in a hospital line is untested.",
    "question": "What must be true for a low-cost acoustic method to replace chemical flushing in hospital water lines?",
    "answer_hypothesis": null
  },
  "mode_hint": "deep",
  "perspective": {
    "tension": {
      "statement": "Everyone agrees cleaner hospital water lines without recurring chemical flushing would be worth having. Nobody has shown that acoustic energy can do the cleaning along a real pipe run.",
      "agreed_value": "cleaner water lines without recurring chemical flushing",
      "disputed_feasibility": "acoustic removal along a real pipe run"
    },
    "goal": {
      "target": "Removal of biofilm from a hospital water line by an acoustic method",
      "unit": null,
      "threshold": null,
      "quantified": false,
      "falsifier": "Not quantified: the stated question says well enough but names no number. Published field results showing acoustic removal far short of what chemical flushing achieves on a real pipe run would prove the direction wrong."
    },
    "rung_phrase": {
      "roadmap_type": "Technical Roadmap",
      "idea_kind": "programs"
    },
    "forum": [
      {
        "role": "frustrated_insider",
        "pass_order": 1,
        "contributed": [
          "Facilities teams find chemical flushing labor heavy and disruptive, and the biofilm still comes back.",
          "What a hospital is judged on is its water-safety plan and pathogen counts at the tap, not how much biofilm a method removes."
        ],
        "none_reason": null
      },
      {
        "role": "fresh_entrant",
        "pass_order": 2,
        "contributed": [
          "Removal may be the wrong target: fewer places for biofilm to attach would mean less to remove.",
          "Why does the cleaning have to be a scheduled batch job rather than something that runs continuously in the line?"
        ],
        "none_reason": null
      },
      {
        "role": "physics_grounder",
        "pass_order": 3,
        "contributed": [
          "Sound energy in a fluid-filled pipe loses strength with distance, so coverage of a long run is a physical question before it is a cost question.",
          "Breaking the biofilm matrix loose is a different physical act from killing the organisms inside it."
        ],
        "none_reason": null
      }
    ],
    "paths": [
      { "id": "P1", "label": "Remove biofilm at the pipe wall with acoustic energy", "from_10x": false, "raised_by": "frustrated_insider" },
      { "id": "P2", "label": "Prevent biofilm from attaching in the first place", "from_10x": false, "raised_by": "fresh_entrant" },
      { "id": "P3", "label": "Resurvey the goal: what keeps patients safe from waterborne pathogens at all", "from_10x": true, "raised_by": "physics_grounder" }
    ],
    "limiters": [
      {
        "id": "L1",
        "path_id": "P1",
        "leaf_id": "L6",
        "statement": "Acoustic energy falls off with distance along a fluid-filled pipe",
        "column": "physics",
        "derivation_claim": "Viscous and wall losses make sound strength fall with distance in a fluid-filled pipe.",
        "question": null,
        "raised_by": "physics_grounder"
      },
      {
        "id": "L2",
        "path_id": "P1",
        "leaf_id": "L4",
        "statement": "Success is measured as biofilm removed, not as pathogens at the tap",
        "column": "assumed",
        "question": "What if we attacked the measure of success, which this field treats as fixed at how much biofilm a method removes, when a hospital is judged on pathogen counts at the tap?",
        "raised_by": "frustrated_insider"
      },
      {
        "id": "L3",
        "path_id": "P2",
        "leaf_id": "L5",
        "statement": "Cleaning has to be a scheduled batch job done after biofilm has formed",
        "column": "assumed",
        "question": "What if we attacked the batch schedule, which this field treats as fixed, and asked whether cleaning or prevention could run continuously in the line?",
        "raised_by": "fresh_entrant"
      },
      {
        "id": "L4",
        "path_id": "P1",
        "leaf_id": "L1",
        "statement": "A new method has to replace chemical flushing rather than shrink how often it is needed",
        "column": "assumed",
        "question": "What if we attacked the requirement to replace chemical flushing, which this field treats as all or nothing, and asked how much flushing an acoustic method could remove?",
        "raised_by": "fresh_entrant"
      }
    ],
    "unlock_chains": [
      {
        "limiter_id": "L2",
        "steps": [
          { "text": "Water-safety teams accept a pathogen-count criterion for any line treatment", "pushed_by": "field", "kind": "field" },
          { "text": "Device makers test against that criterion instead of a removal percentage", "pushed_by": "field", "kind": "field" },
          { "text": "Hospitals adopt treatments that pass it", "pushed_by": "field", "kind": "adoption" }
        ]
      },
      {
        "limiter_id": "L3",
        "steps": [
          { "text": "Continuous treatments get trialled in a pilot ward", "pushed_by": "field", "kind": "field" },
          { "text": "Schedules shrink as regrowth data accumulates", "pushed_by": "field", "kind": "field" }
        ]
      },
      {
        "limiter_id": "L4",
        "steps": [
          { "text": "Partial reduction of flushing is accepted as a valid outcome", "pushed_by": "field", "kind": "field" },
          { "text": "Hospitals adopt partial replacement", "pushed_by": "field", "kind": "adoption" }
        ]
      }
    ],
    "tensions": []
  },
  "key_line": [
    { "id": "K1", "label": "Known knowns", "dimension": "mu:known_known" },
    { "id": "K2", "label": "Blind spots", "dimension": "mu:blind_spot" },
    { "id": "K3", "label": "Hidden knowns", "dimension": "mu:hidden_known" },
    { "id": "K4", "label": "Unknown unknowns", "dimension": "mu:unknown_unknown" },
    { "id": "K5", "label": "Adoption of a replacement method", "dimension": "df:first_adopters" }
  ],
  "leaves": [
    {
      "id": "L1",
      "parent": "K1",
      "question": "Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?",
      "origin": "user_stated",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Field results showing acoustic removal in real water lines falls well short of chemical flushing." },
      "slots": { "term": "acoustic biofilm removal" }
    },
    {
      "id": "L2",
      "parent": "K1",
      "question": "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?",
      "origin": "framework_dimension",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe." },
      "slots": { "term": "ultrasonic biofilm removal" }
    },
    {
      "id": "L3",
      "parent": "K1",
      "question": "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?",
      "origin": "framework_dimension",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing." },
      "slots": { "term": "acoustic water treatment cost" }
    },
    {
      "id": "L4",
      "parent": "K2",
      "question": "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Guidance and audits showing hospitals accept a replacement on removal performance alone." },
      "slots": { "term": "Legionella control in hospital plumbing" }
    },
    {
      "id": "L5",
      "parent": "K2",
      "question": "What happens to the biofilm that breaks loose, and how quickly does it grow back?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Studies showing detached biofilm is harmless and does not regrow within the flushing interval." },
      "slots": { "term": "biofilm regrowth after removal" }
    },
    {
      "id": "L6",
      "parent": "K2",
      "question": "How far along a pipe does acoustic energy reach, and what cuts it short?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs." },
      "slots": { "term": "acoustic attenuation in pipes" }
    },
    {
      "id": "L7",
      "parent": "K3",
      "question": "Which water lines in the building foul first, and what does the facilities team already suspect about why?",
      "origin": "framework_dimension",
      "dimension": "mu:hidden_known",
      "lens": "mu.reveal",
      "researchable": false,
      "not_researchable_reason": "tacit knowledge the team must surface",
      "falsifier": { "text": "" },
      "slots": {}
    },
    {
      "id": "L8",
      "parent": "K4",
      "question": "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?",
      "origin": "mece_gap",
      "dimension": "mu:unknown_unknown",
      "lens": "mu.reveal",
      "researchable": true,
      "falsifier": { "text": "A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture." },
      "slots": { "term": "pipe fouling control" }
    },
    {
      "id": "L9",
      "parent": "K5",
      "question": "Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?",
      "origin": "framework_dimension",
      "dimension": "df:first_adopters",
      "lens": "df.first_adopters",
      "researchable": true,
      "falsifier": { "text": "Cases showing non-chemical water line treatment never spread beyond the first buyers." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L10",
      "parent": "K5",
      "question": "What must a hospital already have in place to absorb a new water line treatment method?",
      "origin": "framework_dimension",
      "dimension": "df:absorptive_capacity",
      "lens": "df.absorptive_capacity",
      "researchable": true,
      "falsifier": { "text": "Cases where hospitals absorbed a new water line treatment without the stated capacity." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L11",
      "parent": "K5",
      "question": "Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?",
      "origin": "framework_dimension",
      "dimension": "df:civil_defense_crossing",
      "lens": "df.civil_defense_crossing",
      "researchable": true,
      "falsifier": { "text": "Cases where the crossing between civil and defense water systems was blocked or never attempted." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L12",
      "parent": "K5",
      "question": "Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?",
      "origin": "framework_dimension",
      "dimension": "df:timing",
      "lens": "df.timing",
      "researchable": true,
      "falsifier": { "text": "Rate data placing chemical flushing and acoustic treatment at the same stage of adoption." },
      "slots": { "technology": "non-chemical water line treatment" }
    }
  ],
  "coverage_notes": [
    {
      "dimension": "mu:hidden_known",
      "reason": "tacit knowledge the team must surface",
      "note": "This is for the team to say out loud, not for the literature."
    },
    {
      "dimension": "mu:unknown_unknown",
      "reason": "unknowable by definition",
      "note": "The only kind of leaf this dimension allows is one that asks what adjacent evidence would reveal something nobody has named; L8 is that leaf."
    }
  ],
  "lens_selection": []
}
```

</details>

### A.2 Attempt 1 card (the plan step asked for the diffusion leaves)

```text
Card shape: F.6
Title: Plan review: lens needs questions
Question: Add or change questions, or stop?
Options: Add or change questions (Recommended); Stop
Status: needs_lens_leaves   Run id: rp-2026-09-30-d2e8450f   Mode: deep   structure_source: local_template
Errors: ["lens_leaves_missing:df:first_adopters", "lens_leaves_missing:df:absorptive_capacity", "lens_leaves_missing:df:civil_defense_crossing", "lens_leaves_missing:df:timing"]
Warnings: ["goal_not_quantified: a target, unit and threshold make the goal rankable", "rung_unplaced: place the rung before choosing a roadmap type"]
Lenses selected: [{"lens": "diffusion", "source": "sr_step", "reason": "A roadmap unlock chain has an adoption step.", "signals": ["sr_step"]}]

## A selected lens has no sub-questions yet

Add a sub-question for each of these before anything runs:
- First adopters: no sub-question covers this yet
- Absorptive capacity: no sub-question covers this yet
- Civil and defense crossing: no sub-question covers this yet
- Timing: no sub-question covers this yet
- [root] Possible overlap (not mutually exclusive): "Hidden knowns / L7: Which water lines in the building foul first, and what does the facilities team already suspect about why?" vs "Unknown unknowns / L8: What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?" share {what, water}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" share {acoustic, biofilm}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, method, low-cost}.
- [root/1] Possible overlap (not mutually exclusive): "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, pipe}.
- [root/2] Possible overlap (not mutually exclusive): "L5: What happens to the biofilm that breaks loose, and how quickly does it grow back?" vs "L6: How far along a pipe does acoustic energy reach, and what cuts it short?" share {how, does, what}.
- Leaf L2 repeats the stated question instead of asking something new: "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?".
- Leaf L3 repeats the stated question instead of asking something new: "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?".
- Leaf L4 repeats the stated question instead of asking something new: "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?".
- Leaf L7 repeats the stated question instead of asking something new: "Which water lines in the building foul first, and what does the facilities team already suspect about why?".
- Leaf L8 repeats the stated question instead of asking something new: "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?".
```

### A.3 F.6 card, attempt 2 (verbatim, unchanged)

```text
Card shape: F.6
Title: Plan review: deep research run
Question: Run this plan as written, edit it, or stop?
Options: Run this deep research run (Recommended); Edit the plan; Stop without running
Status: ready   Run id: rp-2026-09-30-df286585   Mode: deep   structure_source: local_template
Errors: []
Warnings: ["goal_not_quantified: a target, unit and threshold make the goal rankable", "rung_unplaced: place the rung before choosing a roadmap type"]
Lenses selected: [{"lens": "diffusion", "source": "sr_step", "reason": "A roadmap unlock chain has an adoption step.", "signals": ["sr_step"]}]

--- body_md ---
## Plan for this deep research run

Question: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?
Governing question: What must be true for a low-cost acoustic method to replace chemical flushing in hospital water lines?
Results go to: section market-analysis

### Sub-questions and the exact searches

1. Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Field results showing acoustic removal in real water lines falls well short of chemical flushing.
   - round one search, sent exactly as written: "acoustic biofilm removal"
   - round one search, sent exactly as written: "acoustic biofilm removal" AND (limitation OR failure OR "no effect")

2. Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe.
   - round one: no search text yet

3. Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing.
   - round one: no search text yet

4. What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Guidance and audits showing hospitals accept a replacement on removal performance alone.
   - round one search, sent exactly as written: "Legionella control in hospital plumbing" AND (alternative OR substitute)
   - round one search, sent exactly as written: "Legionella control in hospital plumbing" AND (limitation OR failure OR "no effect")

5. What happens to the biofilm that breaks loose, and how quickly does it grow back?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Studies showing detached biofilm is harmless and does not regrow within the flushing interval.
   - round one: no search text yet

6. How far along a pipe does acoustic energy reach, and what cuts it short?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs.
   - round one: no search text yet

7. Which water lines in the building foul first, and what does the facilities team already suspect about why?
   - lens: mu.reveal; asked by: /mos:map-unknowns; searches: openalex
   - not run: tacit knowledge the team must surface

8. What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?
   - lens: mu.reveal; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture.
   - round one search, sent exactly as written: "pipe fouling control"
   - round one search, sent exactly as written: "pipe fouling control" AND (success OR adoption OR "case study")

9. Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?
   - lens: df.first_adopters; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases showing non-chemical water line treatment never spread beyond the first buyers.
   - round one search, sent exactly as written: "non-chemical water line treatment" AND (adoption OR diffusion)

10. What must a hospital already have in place to absorb a new water line treatment method?
   - lens: df.absorptive_capacity; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases where hospitals absorbed a new water line treatment without the stated capacity.
   - round one: no search text yet

11. Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?
   - lens: df.civil_defense_crossing; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases where the crossing between civil and defense water systems was blocked or never attempted.
   - round one: no search text yet

12. Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?
   - lens: df.timing; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Rate data placing chemical flushing and acoustic treatment at the same stage of adoption.
   - round one: no search text yet

If the audit refuses any search text, that sub-question runs on the room only and says so.

### Budget (caps, not targets)
- Max searches (cap): 16
- Searches per round (cap): 2; results per search (cap): 5
- Rounds (cap): 2; lanes requested (cap): 4
- Time (cap): 20 min
- Counterevidence: on
- Stops on: cap, saturation, budget, time

### Research perspective
- Tension: Everyone agrees cleaner hospital water lines without recurring chemical flushing would be worth having. Nobody has shown that acoustic energy can do the cleaning along a real pipe run.
- Goal: Removal of biofilm from a hospital water line by an acoustic method (not yet quantified)
- What would prove it wrong: Not quantified: the stated question says well enough but names no number. Published field results showing acoustic removal far short of what chemical flushing achieves on a real pipe run would prove the direction wrong.
- Roadmap type: Technical Roadmap; kind of idea: programs

Forum, run one voice at a time:
- frustrated insider (pass 1): raised Facilities teams find chemical flushing labor heavy and disruptive, and the biofilm still comes back., What a hospital is judged on is its water-safety plan and pathogen counts at the tap, not how much biofilm a method removes.
- fresh entrant (pass 2): raised Removal may be the wrong target: fewer places for biofilm to attach would mean less to remove., Why does the cleaning have to be a scheduled batch job rather than something that runs continuously in the line?
- physics grounder (pass 3): raised Sound energy in a fluid-filled pipe loses strength with distance, so coverage of a long run is a physical question before it is a cost question., Breaking the biofilm matrix loose is a different physical act from killing the organisms inside it.

Paths:
- P1: Remove biofilm at the pipe wall with acoustic energy
- P2: Prevent biofilm from attaching in the first place
- P3: Resurvey the goal: what keeps patients safe from waterborne pathogens at all (from the 10X resurvey)

Limiters sorted by what kind of wall each one is:

| Physics limiters (derived) | Assumed limiters (not yet re-tested) |
|---|---|
| L1: Acoustic energy falls off with distance along a fluid-filled pipe | L2: Success is measured as biofilm removed, not as pathogens at the tap |
|  | L3: Cleaning has to be a scheduled batch job done after biofilm has formed |
|  | L4: A new method has to replace chemical flushing rather than shrink how often it is needed |

Ranked by what each one unlocks downstream: [object Object], [object Object], [object Object], [object Object]
- L2 unlocks a chain of 3 steps
- L3 unlocks a chain of 2 steps
- L4 unlocks a chain of 2 steps

### Checks on the plan
- [root] Possible overlap (not mutually exclusive): "Hidden knowns / L7: Which water lines in the building foul first, and what does the facilities team already suspect about why?" vs "Unknown unknowns / L8: What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?" share {what, water}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" share {acoustic, biofilm}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, method, low-cost}.
- [root/1] Possible overlap (not mutually exclusive): "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, pipe}.
- [root/2] Possible overlap (not mutually exclusive): "L5: What happens to the biofilm that breaks loose, and how quickly does it grow back?" vs "L6: How far along a pipe does acoustic energy reach, and what cuts it short?" share {how, does, what}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L10: What must a hospital already have in place to absorb a new water line treatment method?" share {what, water, line, treatment}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L11: Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?" share {water, line, treatment, water, what, made}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L12: Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?" share {treatment, hospitals}.
- [root/5] Possible overlap (not mutually exclusive): "L10: What must a hospital already have in place to absorb a new water line treatment method?" vs "L11: Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?" share {water, line, treatment, water, what}.
- Leaf L2 repeats the stated question instead of asking something new: "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?".
- Leaf L3 repeats the stated question instead of asking something new: "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?".
- Leaf L4 repeats the stated question instead of asking something new: "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?".
- Leaf L7 repeats the stated question instead of asking something new: "Which water lines in the building foul first, and what does the facilities team already suspect about why?".
- Leaf L8 repeats the stated question instead of asking something new: "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?".
- Leaf L10 repeats the stated question instead of asking something new: "What must a hospital already have in place to absorb a new water line treatment method?".
- Leaf L11 repeats the stated question instead of asking something new: "Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?".
- Leaf L12 repeats the stated question instead of asking something new: "Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?".

### Questions not yet asked
- None found.

### Not researchable in this run
- mu:hidden_known: tacit knowledge the team must surface
```

### A.4 Leaf table

| Leaf id | Dimension | Origin | Question | Falsifier | Researchable or reason |
|---------|-----------|--------|----------|-----------|------------------------|
| L1 | mu:known_known | user_stated | Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing? | Field results showing acoustic removal in real water lines falls well short of chemical flushing. | researchable |
| L2 | mu:known_known | framework_dimension | Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces? | Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe. | researchable |
| L3 | mu:known_known | framework_dimension | Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line? | Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing. | researchable |
| L4 | mu:blind_spot | framework_dimension | What do water-safety and infection-control teams require before they accept anything in place of chemical flushing? | Guidance and audits showing hospitals accept a replacement on removal performance alone. | researchable |
| L5 | mu:blind_spot | framework_dimension | What happens to the biofilm that breaks loose, and how quickly does it grow back? | Studies showing detached biofilm is harmless and does not regrow within the flushing interval. | researchable |
| L6 | mu:blind_spot | framework_dimension | How far along a pipe does acoustic energy reach, and what cuts it short? | Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs. | researchable |
| L7 | mu:hidden_known | framework_dimension | Which water lines in the building foul first, and what does the facilities team already suspect about why? | (none: not researchable) | not researchable: tacit knowledge the team must surface |
| L8 | mu:unknown_unknown | mece_gap | What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet? | A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture. | researchable |
| L9 | df:first_adopters | framework_dimension | Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first? | Cases showing non-chemical water line treatment never spread beyond the first buyers. | researchable |
| L10 | df:absorptive_capacity | framework_dimension | What must a hospital already have in place to absorb a new water line treatment method? | Cases where hospitals absorbed a new water line treatment without the stated capacity. | researchable |
| L11 | df:civil_defense_crossing | framework_dimension | Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible? | Cases where the crossing between civil and defense water systems was blocked or never attempted. | researchable |
| L12 | df:timing | framework_dimension | Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals? | Rate data placing chemical flushing and acoustic treatment at the same stage of adoption. | researchable |

## 4. Engine B: scientific-roadmapping engine (researcher room)

Room role: researcher. Engine reported in plan.json perspective: scientific-roadmapping. Attempt 1 run rp-2026-09-30-292fe7a4 (needs_lens_leaves). Attempt 2 run rp-2026-09-30-07d6653c (ready).

### B.1 Question-set file (verbatim, the file the plan step read)

File: `qs-researcher.json` in the scratch dir (outside the room).

<details><summary>question-set JSON</summary>

```json
{
  "schema": "mos.research-question-set/1",
  "template_id": "map-unknowns",
  "command": "/mos:map-unknowns",
  "stated_question": "Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?",
  "scqa": {
    "situation": "Hospitals keep their water lines safe today by flushing them with chemicals on a schedule.",
    "complication": "Chemical flushing is disruptive and recurring, and an acoustic method is a cheaper-sounding alternative whose real performance in a hospital line is untested.",
    "question": "What must be true for a low-cost acoustic method to replace chemical flushing in hospital water lines?",
    "answer_hypothesis": null
  },
  "mode_hint": "deep",
  "perspective": {
    "tension": {
      "statement": "Everyone agrees cleaner hospital water lines without recurring chemical flushing would be worth having. Nobody has shown that acoustic energy can do the cleaning along a real pipe run.",
      "agreed_value": "cleaner water lines without recurring chemical flushing",
      "disputed_feasibility": "acoustic removal along a real pipe run"
    },
    "goal": {
      "target": "Removal of biofilm from a hospital water line by an acoustic method",
      "unit": null,
      "threshold": null,
      "quantified": false,
      "falsifier": "Not quantified: the stated question says well enough but names no number. Published field results showing acoustic removal far short of what chemical flushing achieves on a real pipe run would prove the direction wrong."
    },
    "rung_phrase": {
      "roadmap_type": "Technical Roadmap",
      "idea_kind": "programs"
    },
    "forum": [
      {
        "role": "frustrated_insider",
        "pass_order": 1,
        "contributed": [
          "Facilities teams find chemical flushing labor heavy and disruptive, and the biofilm still comes back.",
          "What a hospital is judged on is its water-safety plan and pathogen counts at the tap, not how much biofilm a method removes."
        ],
        "none_reason": null
      },
      {
        "role": "fresh_entrant",
        "pass_order": 2,
        "contributed": [
          "Removal may be the wrong target: fewer places for biofilm to attach would mean less to remove.",
          "Why does the cleaning have to be a scheduled batch job rather than something that runs continuously in the line?"
        ],
        "none_reason": null
      },
      {
        "role": "physics_grounder",
        "pass_order": 3,
        "contributed": [
          "Sound energy in a fluid-filled pipe loses strength with distance, so coverage of a long run is a physical question before it is a cost question.",
          "Breaking the biofilm matrix loose is a different physical act from killing the organisms inside it."
        ],
        "none_reason": null
      }
    ],
    "paths": [
      { "id": "P1", "label": "Remove biofilm at the pipe wall with acoustic energy", "from_10x": false, "raised_by": "frustrated_insider" },
      { "id": "P2", "label": "Prevent biofilm from attaching in the first place", "from_10x": false, "raised_by": "fresh_entrant" },
      { "id": "P3", "label": "Resurvey the goal: what keeps patients safe from waterborne pathogens at all", "from_10x": true, "raised_by": "physics_grounder" }
    ],
    "limiters": [
      {
        "id": "L1",
        "path_id": "P1",
        "leaf_id": "L6",
        "statement": "Acoustic energy falls off with distance along a fluid-filled pipe",
        "column": "physics",
        "derivation_claim": "Viscous and wall losses make sound strength fall with distance in a fluid-filled pipe.",
        "question": null,
        "raised_by": "physics_grounder"
      },
      {
        "id": "L2",
        "path_id": "P1",
        "leaf_id": "L4",
        "statement": "Success is measured as biofilm removed, not as pathogens at the tap",
        "column": "assumed",
        "question": "What if we attacked the measure of success, which this field treats as fixed at how much biofilm a method removes, when a hospital is judged on pathogen counts at the tap?",
        "raised_by": "frustrated_insider"
      },
      {
        "id": "L3",
        "path_id": "P2",
        "leaf_id": "L5",
        "statement": "Cleaning has to be a scheduled batch job done after biofilm has formed",
        "column": "assumed",
        "question": "What if we attacked the batch schedule, which this field treats as fixed, and asked whether cleaning or prevention could run continuously in the line?",
        "raised_by": "fresh_entrant"
      },
      {
        "id": "L4",
        "path_id": "P1",
        "leaf_id": "L1",
        "statement": "A new method has to replace chemical flushing rather than shrink how often it is needed",
        "column": "assumed",
        "question": "What if we attacked the requirement to replace chemical flushing, which this field treats as all or nothing, and asked how much flushing an acoustic method could remove?",
        "raised_by": "fresh_entrant"
      }
    ],
    "unlock_chains": [
      {
        "limiter_id": "L2",
        "steps": [
          { "text": "Water-safety teams accept a pathogen-count criterion for any line treatment", "pushed_by": "field", "kind": "field" },
          { "text": "Device makers test against that criterion instead of a removal percentage", "pushed_by": "field", "kind": "field" },
          { "text": "Hospitals adopt treatments that pass it", "pushed_by": "field", "kind": "adoption" }
        ]
      },
      {
        "limiter_id": "L3",
        "steps": [
          { "text": "Continuous treatments get trialled in a pilot ward", "pushed_by": "field", "kind": "field" },
          { "text": "Schedules shrink as regrowth data accumulates", "pushed_by": "field", "kind": "field" }
        ]
      },
      {
        "limiter_id": "L4",
        "steps": [
          { "text": "Partial reduction of flushing is accepted as a valid outcome", "pushed_by": "field", "kind": "field" },
          { "text": "Hospitals adopt partial replacement", "pushed_by": "field", "kind": "adoption" }
        ]
      }
    ],
    "tensions": []
  },
  "key_line": [
    { "id": "K1", "label": "Known knowns", "dimension": "mu:known_known" },
    { "id": "K2", "label": "Blind spots", "dimension": "mu:blind_spot" },
    { "id": "K3", "label": "Hidden knowns", "dimension": "mu:hidden_known" },
    { "id": "K4", "label": "Unknown unknowns", "dimension": "mu:unknown_unknown" },
    { "id": "K5", "label": "Adoption of a replacement method", "dimension": "df:first_adopters" }
  ],
  "leaves": [
    {
      "id": "L1",
      "parent": "K1",
      "question": "Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?",
      "origin": "user_stated",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Field results showing acoustic removal in real water lines falls well short of chemical flushing." },
      "slots": { "term": "acoustic biofilm removal" }
    },
    {
      "id": "L2",
      "parent": "K1",
      "question": "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?",
      "origin": "framework_dimension",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe." },
      "slots": { "term": "ultrasonic biofilm removal" }
    },
    {
      "id": "L3",
      "parent": "K1",
      "question": "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?",
      "origin": "framework_dimension",
      "dimension": "mu:known_known",
      "lens": "mu.verify",
      "researchable": true,
      "falsifier": { "text": "Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing." },
      "slots": { "term": "acoustic water treatment cost" }
    },
    {
      "id": "L4",
      "parent": "K2",
      "question": "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Guidance and audits showing hospitals accept a replacement on removal performance alone." },
      "slots": { "term": "Legionella control in hospital plumbing" }
    },
    {
      "id": "L5",
      "parent": "K2",
      "question": "What happens to the biofilm that breaks loose, and how quickly does it grow back?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Studies showing detached biofilm is harmless and does not regrow within the flushing interval." },
      "slots": { "term": "biofilm regrowth after removal" }
    },
    {
      "id": "L6",
      "parent": "K2",
      "question": "How far along a pipe does acoustic energy reach, and what cuts it short?",
      "origin": "framework_dimension",
      "dimension": "mu:blind_spot",
      "lens": "mu.blind_spot",
      "researchable": true,
      "falsifier": { "text": "Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs." },
      "slots": { "term": "acoustic attenuation in pipes" }
    },
    {
      "id": "L7",
      "parent": "K3",
      "question": "Which water lines in the building foul first, and what does the facilities team already suspect about why?",
      "origin": "framework_dimension",
      "dimension": "mu:hidden_known",
      "lens": "mu.reveal",
      "researchable": false,
      "not_researchable_reason": "tacit knowledge the team must surface",
      "falsifier": { "text": "" },
      "slots": {}
    },
    {
      "id": "L8",
      "parent": "K4",
      "question": "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?",
      "origin": "mece_gap",
      "dimension": "mu:unknown_unknown",
      "lens": "mu.reveal",
      "researchable": true,
      "falsifier": { "text": "A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture." },
      "slots": { "term": "pipe fouling control" }
    },
    {
      "id": "L9",
      "parent": "K5",
      "question": "Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?",
      "origin": "framework_dimension",
      "dimension": "df:first_adopters",
      "lens": "df.first_adopters",
      "researchable": true,
      "falsifier": { "text": "Cases showing non-chemical water line treatment never spread beyond the first buyers." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L10",
      "parent": "K5",
      "question": "What must a hospital already have in place to absorb a new water line treatment method?",
      "origin": "framework_dimension",
      "dimension": "df:absorptive_capacity",
      "lens": "df.absorptive_capacity",
      "researchable": true,
      "falsifier": { "text": "Cases where hospitals absorbed a new water line treatment without the stated capacity." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L11",
      "parent": "K5",
      "question": "Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?",
      "origin": "framework_dimension",
      "dimension": "df:civil_defense_crossing",
      "lens": "df.civil_defense_crossing",
      "researchable": true,
      "falsifier": { "text": "Cases where the crossing between civil and defense water systems was blocked or never attempted." },
      "slots": { "technology": "non-chemical water line treatment" }
    },
    {
      "id": "L12",
      "parent": "K5",
      "question": "Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?",
      "origin": "framework_dimension",
      "dimension": "df:timing",
      "lens": "df.timing",
      "researchable": true,
      "falsifier": { "text": "Rate data placing chemical flushing and acoustic treatment at the same stage of adoption." },
      "slots": { "technology": "non-chemical water line treatment" }
    }
  ],
  "coverage_notes": [
    {
      "dimension": "mu:hidden_known",
      "reason": "tacit knowledge the team must surface",
      "note": "This is for the team to say out loud, not for the literature."
    },
    {
      "dimension": "mu:unknown_unknown",
      "reason": "unknowable by definition",
      "note": "The only kind of leaf this dimension allows is one that asks what adjacent evidence would reveal something nobody has named; L8 is that leaf."
    }
  ],
  "lens_selection": []
}
```

</details>

### B.2 Attempt 1 card (the plan step asked for the diffusion leaves)

```text
Card shape: F.6
Title: Plan review: lens needs questions
Question: Add or change questions, or stop?
Options: Add or change questions (Recommended); Stop
Status: needs_lens_leaves   Run id: rp-2026-09-30-292fe7a4   Mode: deep   structure_source: theo_ledger
Errors: ["lens_leaves_missing:df:first_adopters", "lens_leaves_missing:df:absorptive_capacity", "lens_leaves_missing:df:civil_defense_crossing", "lens_leaves_missing:df:timing"]
Warnings: ["rung_unplaced: place the rung before choosing a roadmap type"]
Lenses selected: [{"lens": "diffusion", "source": "sr_step", "reason": "A roadmap unlock chain has an adoption step.", "signals": ["sr_step"]}]

## A selected lens has no sub-questions yet

Add a sub-question for each of these before anything runs:
- First adopters: no sub-question covers this yet
- Absorptive capacity: no sub-question covers this yet
- Civil and defense crossing: no sub-question covers this yet
- Timing: no sub-question covers this yet
- [root] Possible overlap (not mutually exclusive): "Hidden knowns / L7: Which water lines in the building foul first, and what does the facilities team already suspect about why?" vs "Unknown unknowns / L8: What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?" share {what, water}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" share {acoustic, biofilm}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, method, low-cost}.
- [root/1] Possible overlap (not mutually exclusive): "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, pipe}.
- [root/2] Possible overlap (not mutually exclusive): "L5: What happens to the biofilm that breaks loose, and how quickly does it grow back?" vs "L6: How far along a pipe does acoustic energy reach, and what cuts it short?" share {how, does, what}.
- Leaf L2 repeats the stated question instead of asking something new: "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?".
- Leaf L3 repeats the stated question instead of asking something new: "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?".
- Leaf L4 repeats the stated question instead of asking something new: "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?".
- Leaf L8 repeats the stated question instead of asking something new: "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?".
- Leaf L7 repeats the stated question instead of asking something new: "Which water lines in the building foul first, and what does the facilities team already suspect about why?".
```

### B.3 F.6 card, attempt 2 (verbatim, unchanged)

```text
Card shape: F.6
Title: Plan review: deep research run
Question: Run this plan as written, edit it, or stop?
Options: Run this deep research run (Recommended); Edit the plan; Stop without running
Status: ready   Run id: rp-2026-09-30-07d6653c   Mode: deep   structure_source: theo_ledger
Errors: []
Warnings: ["rung_unplaced: place the rung before choosing a roadmap type"]
Lenses selected: [{"lens": "diffusion", "source": "sr_step", "reason": "A roadmap unlock chain has an adoption step.", "signals": ["sr_step"]}]

--- body_md ---
## Plan for this deep research run

Question: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?
Governing question: What must be true for a low-cost acoustic method to replace chemical flushing in hospital water lines?
Results go to: section market-analysis

### Sub-questions and the exact searches

1. Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Field results showing acoustic removal in real water lines falls well short of chemical flushing.
   - round one: no search text yet

2. Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe.
   - round one: no search text yet

3. Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?
   - lens: mu.verify; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing.
   - round one: no search text yet

4. What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Guidance and audits showing hospitals accept a replacement on removal performance alone.
   - round one: no search text yet

5. What happens to the biofilm that breaks loose, and how quickly does it grow back?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Studies showing detached biofilm is harmless and does not regrow within the flushing interval.
   - round one search, sent exactly as written: "Cleaning has to be a scheduled batch job done after biofilm has formed" AND ("fundamental limit" OR "theoretical limit" OR bound)
   - round one search, sent exactly as written: "Cleaning has to be a scheduled batch job done after biofilm has formed" AND (overcome OR circumvent OR "new approach")

6. How far along a pipe does acoustic energy reach, and what cuts it short?
   - lens: mu.blind_spot; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs.
   - round one search, sent exactly as written: "Acoustic energy falls off with distance along a fluid-filled pipe" AND ("fundamental limit" OR "theoretical limit" OR bound)
   - round one search, sent exactly as written: "Acoustic energy falls off with distance along a fluid-filled pipe" AND (overcome OR circumvent OR "new approach")

7. What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?
   - lens: mu.reveal; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture.
   - round one: no search text yet

8. Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?
   - lens: df.first_adopters; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases showing non-chemical water line treatment never spread beyond the first buyers.
   - round one: no search text yet

9. What must a hospital already have in place to absorb a new water line treatment method?
   - lens: df.absorptive_capacity; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases where hospitals absorbed a new water line treatment without the stated capacity.
   - round one: no search text yet

10. Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?
   - lens: df.civil_defense_crossing; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Cases where the crossing between civil and defense water systems was blocked or never attempted.
   - round one: no search text yet

11. Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?
   - lens: df.timing; asked by: /mos:map-unknowns; searches: openalex
   - would be disproved by: Rate data placing chemical flushing and acoustic treatment at the same stage of adoption.
   - round one: no search text yet

12. Which water lines in the building foul first, and what does the facilities team already suspect about why?
   - lens: mu.reveal; asked by: /mos:map-unknowns; searches: openalex
   - not run: tacit knowledge the team must surface

If the audit refuses any search text, that sub-question runs on the room only and says so.

### Budget (caps, not targets)
- Max searches (cap): 16
- Searches per round (cap): 2; results per search (cap): 5
- Rounds (cap): 2; lanes requested (cap): 4
- Time (cap): 20 min
- Counterevidence: on
- Stops on: cap, saturation, budget, time

### Research perspective
- Tension: Everyone agrees cleaner hospital water lines without recurring chemical flushing would be worth having. Nobody has shown that acoustic energy can do the cleaning along a real pipe run.
- Goal: Removal of biofilm from a hospital water line by an acoustic method (not yet quantified)
- What would prove it wrong: Not quantified: the stated question says well enough but names no number. Published field results showing acoustic removal far short of what chemical flushing achieves on a real pipe run would prove the direction wrong.
- Roadmap type: Technical Roadmap; kind of idea: programs

Forum, run one voice at a time:
- frustrated insider (pass 1): raised Facilities teams find chemical flushing labor heavy and disruptive, and the biofilm still comes back., What a hospital is judged on is its water-safety plan and pathogen counts at the tap, not how much biofilm a method removes.
- fresh entrant (pass 2): raised Removal may be the wrong target: fewer places for biofilm to attach would mean less to remove., Why does the cleaning have to be a scheduled batch job rather than something that runs continuously in the line?
- physics grounder (pass 3): raised Sound energy in a fluid-filled pipe loses strength with distance, so coverage of a long run is a physical question before it is a cost question., Breaking the biofilm matrix loose is a different physical act from killing the organisms inside it.

Paths:
- P1: Remove biofilm at the pipe wall with acoustic energy
- P2: Prevent biofilm from attaching in the first place
- P3: Resurvey the goal: what keeps patients safe from waterborne pathogens at all (from the 10X resurvey)

Limiters sorted by what kind of wall each one is:

| Physics limiters (derived) | Assumed limiters (not yet re-tested) |
|---|---|
| L1: Acoustic energy falls off with distance along a fluid-filled pipe | L2: Success is measured as biofilm removed, not as pathogens at the tap |
|  | L3: Cleaning has to be a scheduled batch job done after biofilm has formed |
|  | L4: A new method has to replace chemical flushing rather than shrink how often it is needed |

Ranked by what each one unlocks downstream: [object Object], [object Object], [object Object], [object Object]
- L2 unlocks a chain of 3 steps
- L3 unlocks a chain of 2 steps
- L4 unlocks a chain of 2 steps

### Checks on the plan
- [root] Possible overlap (not mutually exclusive): "Hidden knowns / L7: Which water lines in the building foul first, and what does the facilities team already suspect about why?" vs "Unknown unknowns / L8: What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?" share {what, water}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" share {acoustic, biofilm}.
- [root/1] Possible overlap (not mutually exclusive): "L1: Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, method, low-cost}.
- [root/1] Possible overlap (not mutually exclusive): "L2: Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?" vs "L3: Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?" share {acoustic, pipe}.
- [root/2] Possible overlap (not mutually exclusive): "L5: What happens to the biofilm that breaks loose, and how quickly does it grow back?" vs "L6: How far along a pipe does acoustic energy reach, and what cuts it short?" share {how, does, what}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L10: What must a hospital already have in place to absorb a new water line treatment method?" share {what, water, line, treatment}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L11: Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?" share {water, line, treatment, water, what, made}.
- [root/5] Possible overlap (not mutually exclusive): "L9: Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first?" vs "L12: Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?" share {treatment, hospitals}.
- [root/5] Possible overlap (not mutually exclusive): "L10: What must a hospital already have in place to absorb a new water line treatment method?" vs "L11: Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?" share {water, line, treatment, water, what}.
- Leaf L2 repeats the stated question instead of asking something new: "Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces?".
- Leaf L3 repeats the stated question instead of asking something new: "Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line?".
- Leaf L4 repeats the stated question instead of asking something new: "What do water-safety and infection-control teams require before they accept anything in place of chemical flushing?".
- Leaf L8 repeats the stated question instead of asking something new: "What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet?".
- Leaf L10 repeats the stated question instead of asking something new: "What must a hospital already have in place to absorb a new water line treatment method?".
- Leaf L11 repeats the stated question instead of asking something new: "Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible?".
- Leaf L12 repeats the stated question instead of asking something new: "Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals?".
- Leaf L7 repeats the stated question instead of asking something new: "Which water lines in the building foul first, and what does the facilities team already suspect about why?".

### Questions not yet asked
- None found.

### Not researchable in this run
- mu:hidden_known: tacit knowledge the team must surface
```

### B.4 Leaf table

Note: on this engine's card the sub-questions are numbered by position and the hidden-known leaf L7 is printed last (card item 12); the ids below are the leaf ids.

| Leaf id | Dimension | Origin | Question | Falsifier | Researchable or reason |
|---------|-----------|--------|----------|-----------|------------------------|
| L1 | mu:known_known | user_stated | Will a low-cost acoustic method remove biofilm from hospital water lines well enough to replace chemical flushing? | Field results showing acoustic removal in real water lines falls well short of chemical flushing. | researchable |
| L2 | mu:known_known | framework_dimension | Is acoustic removal of biofilm shown on real pipe walls outside the lab, or only on flat test surfaces? | Studies showing acoustic biofilm removal only on flat lab surfaces and never on installed pipe. | researchable |
| L3 | mu:known_known | framework_dimension | Is an acoustic method actually low-cost per metre of pipe once it is installed along a whole line? | Cost reports showing acoustic treatment per metre of installed pipe costs as much as or more than routine chemical flushing. | researchable |
| L4 | mu:blind_spot | framework_dimension | What do water-safety and infection-control teams require before they accept anything in place of chemical flushing? | Guidance and audits showing hospitals accept a replacement on removal performance alone. | researchable |
| L5 | mu:blind_spot | framework_dimension | What happens to the biofilm that breaks loose, and how quickly does it grow back? | Studies showing detached biofilm is harmless and does not regrow within the flushing interval. | researchable |
| L6 | mu:blind_spot | framework_dimension | How far along a pipe does acoustic energy reach, and what cuts it short? | Measurements showing acoustic energy stays effective along the full length of typical hospital pipe runs. | researchable |
| L7 | mu:hidden_known | framework_dimension | Which water lines in the building foul first, and what does the facilities team already suspect about why? | (none: not researchable) | not researchable: tacit knowledge the team must surface |
| L8 | mu:unknown_unknown | mece_gap | What would industries that fight fouling inside pipes show us that nobody in hospital water safety has named yet? | A broad survey of pipe-fouling control finding no failure mode missing from the hospital picture. | researchable |
| L9 | df:first_adopters | framework_dimension | Which hospitals or wards tried a non-chemical water line treatment first, and what made them go first? | Cases showing non-chemical water line treatment never spread beyond the first buyers. | researchable |
| L10 | df:absorptive_capacity | framework_dimension | What must a hospital already have in place to absorb a new water line treatment method? | Cases where hospitals absorbed a new water line treatment without the stated capacity. | researchable |
| L11 | df:civil_defense_crossing | framework_dimension | Has a water line treatment that worked in civil buildings crossed into defense or shipboard water systems, or the other way round, and what made that possible? | Cases where the crossing between civil and defense water systems was blocked or never attempted. | researchable |
| L12 | df:timing | framework_dimension | Where do chemical flushing and acoustic treatment each sit on their adoption curves in hospitals? | Rate data placing chemical flushing and acoustic treatment at the same stage of adoption. | researchable |

## 5. Assumed limiters and whether the stated question named them (D-18 step 6)

Both engines carry the same limiters (same question set). Every assumed limiter is written as a question of the form "what if we attacked ..., which this field treats as fixed?".

| Limiter | Column | Statement | Question (assumed only) | Named in the stated question? |
|---------|--------|-----------|-------------------------|-------------------------------|
| L1 | physics | Acoustic energy falls off with distance along a fluid-filled pipe | (physics: no question) | No. Not named (a physics limiter, a candidate to verify). |
| L2 | assumed | Success is measured as biofilm removed, not as pathogens at the tap | What if we attacked the measure of success, which this field treats as fixed at how much biofilm a method removes, when a hospital is judged on pathogen counts at the tap? | No as a doubt. The stated question says remove biofilm well enough, so removal is its unstated measure of success and is treated as fixed. |
| L3 | assumed | Cleaning has to be a scheduled batch job done after biofilm has formed | What if we attacked the batch schedule, which this field treats as fixed, and asked whether cleaning or prevention could run continuously in the line? | No. The stated question says chemical flushing without questioning that cleaning is a scheduled batch step. |
| L4 | assumed | A new method has to replace chemical flushing rather than shrink how often it is needed | What if we attacked the requirement to replace chemical flushing, which this field treats as all or nothing, and asked how much flushing an acoustic method could remove? | The words replace chemical flushing are in the stated question as the goal; the all-or-nothing framing is treated as fixed and is not named as a doubt. |

Stated by the executor, not scored: limiters L2, L3 and L4 are assumed; L1 is a physics candidate. The navigator decides R6.

## 6. D-00 gate result (from the plan step, both engines)

- Structural D-00 gate (`pyramid.d00` in each plan.json): passes = true on both engines. Leaves
  beyond the stated question (researchable and origin not user_stated), both engines:
  L2, L3, L4, L5, L6, L8, L9, L10, L11, L12 (10 leaves). The one user_stated leaf is L1. L7 is not
  researchable so it does not count toward the gate.
- Card status on both: `ready`, errors `[]`, "Questions not yet asked: None found."
- Separate from the gate, the card's "Checks on the plan" section lists a restatement warning for
  8 of the 11 non-stated leaves (both engines): L2, L3, L4, L7, L8, L10, L11, L12. The warning text
  is "repeats the stated question instead of asking something new". It is produced by the shared-word
  overlap check in `lib/core/research-planner/pyramid.cjs` (lines 309 to 316), not by a judgement of
  meaning. It is a warning, not an error, and does not change the status. The navigator scores R1
  per leaf regardless.

## 7. Observations about the tool output (factual, not scored, for the navigator and phase close)

1. Both cards print "Ranked by what each one unlocks downstream: [object Object], [object Object],
   [object Object], [object Object]" before the readable per-limiter lines. The plan step renders the
   ranking array as objects.
2. Several sub-questions print "round one: no search text yet" on both cards. Engine A: items 2, 3, 5,
   6, 10, 11, 12. Engine B: items 1, 2, 3, 4, 7, 8, 9, 10, 11.
3. Engine B built the round-one searches for L5 and L6 from the LIMITER sentences linked through
   `leaf_id` (for example "Cleaning has to be a scheduled batch job done after biofilm has formed"
   AND (...)), not from the slot terms the executor wrote for those leaves ("biofilm regrowth after
   removal", "acoustic attenuation in pipes"). The searches for L1 and L4 that Engine A composed from
   slot terms are "no search text yet" on Engine B. The searches are shown "exactly as written" on the
   cards for the navigator to read.
4. The restatement warning is a shared-word heuristic (section 6).
5. Both cards show the goal as "not yet quantified". Engine A reports the warning
   `goal_not_quantified` (in both attempts); Engine B does not report it. Both report `rung_unplaced`.

## 8. Scoring sheets (BLANK: the navigator scores; copy of the rubric table, one row per leaf)

Criteria are defined in `363-D06-RUBRIC.md` (R1 beyond stated, R2 framework-grounded, R3 falsifiable, R4 researchable or honestly not, R5 non-duplicative, R6 assumed limiter not named by the navigator, R7 would you have asked it unprompted; R7 "No" is the good answer).

### Sheet A: constraint-layer engine (founder room)

| Leaf id | Origin | R1 | R2 | R3 | R4 | R5 | R7 | Reason (one line) |
|---------|--------|----|----|----|----|----|----|-------------------|
| L1 | user_stated |  |  |  |  |  |  |  |
| L2 | framework_dimension |  |  |  |  |  |  |  |
| L3 | framework_dimension |  |  |  |  |  |  |  |
| L4 | framework_dimension |  |  |  |  |  |  |  |
| L5 | framework_dimension |  |  |  |  |  |  |  |
| L6 | framework_dimension |  |  |  |  |  |  |  |
| L7 | framework_dimension |  |  |  |  |  |  |  |
| L8 | mece_gap |  |  |  |  |  |  |  |
| L9 | framework_dimension |  |  |  |  |  |  |  |
| L10 | framework_dimension |  |  |  |  |  |  |  |
| L11 | framework_dimension |  |  |  |  |  |  |  |
| L12 | framework_dimension |  |  |  |  |  |  |  |

Plan-level: R6 (assumed limiter not named by the navigator): Yes / No - which limiter:

Pass rule result: condition 1 __ / condition 2 __ / condition 3 __ / condition 4 __ -> PASS / FAIL

### Sheet B: scientific-roadmapping engine (researcher room)

| Leaf id | Origin | R1 | R2 | R3 | R4 | R5 | R7 | Reason (one line) |
|---------|--------|----|----|----|----|----|----|-------------------|
| L1 | user_stated |  |  |  |  |  |  |  |
| L2 | framework_dimension |  |  |  |  |  |  |  |
| L3 | framework_dimension |  |  |  |  |  |  |  |
| L4 | framework_dimension |  |  |  |  |  |  |  |
| L5 | framework_dimension |  |  |  |  |  |  |  |
| L6 | framework_dimension |  |  |  |  |  |  |  |
| L7 | framework_dimension |  |  |  |  |  |  |  |
| L8 | mece_gap |  |  |  |  |  |  |  |
| L9 | framework_dimension |  |  |  |  |  |  |  |
| L10 | framework_dimension |  |  |  |  |  |  |  |
| L11 | framework_dimension |  |  |  |  |  |  |  |
| L12 | framework_dimension |  |  |  |  |  |  |  |

Plan-level: R6 (assumed limiter not named by the navigator): Yes / No - which limiter:

Pass rule result: condition 1 __ / condition 2 __ / condition 3 __ / condition 4 __ -> PASS / FAIL

Pass rule (from the rubric), all four must hold:

1. R3, R4 and R5 hold for every researchable leaf.
2. R1 and R2 both hold for at least 3 leaves.
3. R6 holds for at least 1 limiter.
4. R7 is "no" for at least 2 leaves.

## Navigator verdict

