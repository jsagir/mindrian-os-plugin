<!--
  Phase 265 Plan 19 -- the extraction-perspectives reference: the five
  whole-transcript lens definitions dispatched by commands/file-meeting.md's
  Step 3a (DISPATCH) as PARALLEL subagents, one per perspective, before Step 3b
  (CONSOLIDATION, orchestrator-only) reconciles their output into one claim set
  and hands it, unchanged in kind, to the existing F.8 nugget routing gate.

  This file does not invent a new vocabulary. Every perspective is mapped onto
  the two ALREADY-FROZEN taxonomies this repo ships:
    - the 6-type SEGMENT taxonomy in segment-classification.md
      (decision / action-item / insight / advice / question / noise)
    - the 6-enum knowledge_type taxonomy in knowledge-typing.md
      (fact / causal / heuristic / anomaly_cue / mental_model / assumption),
      frozen in lib/core/navigation/typed-claim.cjs's KNOWLEDGE_TYPES Set.

  Each perspective reads the WHOLE transcript. None of them decides a target
  section (that is section-mapping.md's job, an orchestrator-side concern the
  workers never see) and none of them writes anything (writeClaimNode is called
  exactly once per consolidated claim, from the single main-thread db handle, in
  Step 3b sub-step 5).

  NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
-->

# Extraction Perspectives -- the Five Whole-Transcript Lenses

Purpose: recall. One unified pass over a long meeting misses what only one lens
would have noticed. This file defines FIVE perspectives that each read the
FULL transcript independently, looking for a different slice of the same two
frozen taxonomies, so the union of what they find is closer to complete than
any single pass could be.

Each perspective definition below follows the same structure so
`commands/file-meeting.md`'s dispatch can render all five uniformly: name and
purpose, primary segment types, primary knowledge types, what it must NOT do,
and the uniform return schema (byte-identical across all five, given at the
end of this file rather than repeated five times, with only `perspective` set
to the lens name that produced each row).

---

## 1. Decisions and Commitments

**Purpose:** Find what was decided, who owns what, what was committed to, and
what was explicitly deferred or rejected.

**Primary segment types:** `decision`, `action-item`.

**Primary knowledge types:** `fact`, `assumption`.

**What this lens must NOT do:**
- It does not decide the target room section for anything it finds -- that
  routing decision belongs to `section-mapping.md`, applied downstream of
  consolidation, never inside this lens.
- It does not write anything. It returns structured data only.
- It does not judge whether another lens already found the same segment.
  Two lenses seeing the same segment is the expected case, not a bug this
  lens should try to avoid; consolidation (Step 3b sub-step 1) owns dedup.

---

## 2. Technical Claims and Causal Mechanisms

**Purpose:** Find assertions about how something works, cause-and-effect
statements, and numbers. This lens carries the strongest obligation to run the
conditions/counter_conditions contrastive probe from `knowledge-typing.md`
("when does this hold, when does this break"), because a causal claim without
its breaking conditions is the weakest kind of claim in the graph.

**Primary segment types:** `insight`.

**Primary knowledge types:** `fact`, `causal`.

**What this lens must NOT do:**
- It does not decide the target room section.
- It does not write anything. It returns structured data only.
- It does not judge whether another lens already found the same segment.

---

## 3. Open Questions and Unknowns

**Purpose:** Find what nobody in the room could answer, what was asked and not
resolved, and what was assumed without evidence.

**Primary segment types:** `question`.

**Primary knowledge types:** `assumption`, `anomaly_cue`.

**What this lens must NOT do:**
- It does not decide the target room section.
- It does not write anything. It returns structured data only.
- It does not judge whether another lens already found the same segment.

---

## 4. Risks, Blockers and Anomaly Cues

**Purpose:** Find the thing that surprised someone, the thing that did not fit,
the dependency nobody owns. This lens is EXPLICITLY instructed to inspect
segments the other four would classify as `noise`: `references/taxonomy/TAXONOMY.md`
records the Fragment concept -- meeting "noise" segments that still carry
micro-knowledge, saved instead of discarded -- and this is the lens most
likely to find one.

**Primary segment types:** any segment type, including `noise`.

**Primary knowledge types:** `anomaly_cue`, `assumption`.

**What this lens must NOT do:**
- It does not decide the target room section.
- It does not write anything. It returns structured data only.
- It does not judge whether another lens already found the same segment.
- It does not discard a `noise`-flagged segment on its own authority just
  because the other four lenses would skip it; if it carries a claim, the
  claim is returned like any other.

---

## 5. Stakeholder Dynamics and Working Models

**Purpose:** Find how people in the room think about the problem, whose
judgment is being deferred to, rules of thumb offered, and the abstract models
a later `INSTANTIATES` edge (minted at consolidation, Step 3b sub-step 3) would
attach a concrete claim to.

**Primary segment types:** `advice`.

**Primary knowledge types:** `heuristic`, `mental_model`.

**What this lens must NOT do:**
- It does not decide the target room section.
- It does not write anything. It returns structured data only.
- It does not judge whether another lens already found the same segment.
- It does not itself mint the `INSTANTIATES` edge to a concrete example --
  that is cross-claim edge work, and cross-claim edges require seeing the
  FULL consolidated claim set, which only the orchestrator ever holds.

---

## The Uniform Return Schema

Every perspective returns an array of objects in this EXACT shape. The field
names and order are byte-identical across all five perspectives so
consolidation (Step 3b) can merge the five arrays without a per-perspective
adapter:

```
{
  segment_id,          // stable id for the segment this claim came from
  speaker_id,          // the Step 2 roster speaker id
  segment_type,        // one of the frozen 6: decision | action-item | insight
                        // | advice | question | noise
  priority,            // HIGHEST | HIGH | MEDIUM | LOW (segment-classification.md)
  claim_text,          // the atomic claim text (stays LOCAL, never to Brain)
  knowledge_type,      // one of the frozen 6: fact | causal | heuristic |
                        // anomaly_cue | mental_model | assumption
  conditions,          // "when does this hold?" ('' if none stated)
  counter_conditions,  // "when does this break?" ('' if none stated)
  valid_from,          // ISO date or '' (TV-01)
  valid_until,         // ISO date or '' (TV-01)
  disambiguation,      // 'ambiguous' ONLY for an unresolved referent, else omitted
  confidence,          // scalar in [0, 1]
  reasoning_line,       // Larry's one-line classification reasoning for this claim
  perspective,         // the lens name that produced this row (one of the five
                        // headings above)
}
```

A perspective that finds nothing returns an empty array. It never invents a
claim to fill the gap, and it never writes `writeClaimNode`, `writeEdge`, or
any artifact -- extraction is judgment over the transcript, filing is the
orchestrator's job downstream of the F.8 gate.

---

## Why five and not four or eight

The five perspectives above are a judgment call anchored on the two frozen
enums, not a measured optimum. Three properties make five the right number
here:

1. **Near-complete coverage of both enums.** Between the five lenses, every
   member of the 6-value `knowledge_type` enum (`fact`, `causal`, `heuristic`,
   `anomaly_cue`, `mental_model`, `assumption`) and every member of the 6-value
   segment taxonomy (`decision`, `action-item`, `insight`, `advice`,
   `question`, `noise`) appears as a primary anchor for at least one lens.
2. **Each has a distinct failure mode when a single unified pass runs
   instead.** A decisions-focused pass under-reports anomaly cues (lens 4's
   territory); a facts-focused pass under-reports the mental models a later
   `INSTANTIATES` edge needs (lens 5's territory); a single pass biased toward
   whichever type it classifies first will systematically under-serve the
   others. Five separate lenses, each with ONE dominant purpose, do not
   compete against each other for the same attention budget.
3. **Five sits inside the existing `FUTURES_FANOUT_CAP` default of 5**
   (`lib/core/futures/orchestrator.cjs`), so no batching idiom is required to
   dispatch all five perspectives in a single fan-out.

No claim is made that five is the measured-optimal number of lenses for
recall; it is the number that maps cleanly onto the two taxonomies this repo
already freezes, at a fan-out size the existing cost governor already
supports without a new cap.

---

## The cost, stated plainly

Five whole-transcript passes cost roughly FIVE TIMES the transcript tokens,
plus five reference payloads (each worker's own perspective definition plus
`segment-classification.md` plus `knowledge-typing.md`). This is bought for
RECALL, not for wall-clock speed or token savings, and the navigator has
explicitly valued that trade.

The measured figures behind this, per the deep-dive research: a one-hour
meeting runs about 9,000 words (roughly 13k tokens at typical conversational
density); the largest transcript in this repo is 19,208 words (roughly 26k
tokens). `commands/file-meeting.md`'s own Transcript size probe, wired by plan
265-10, is where a navigator is told the run is large -- at 12,000 words or
more -- before extraction starts, so the cost of a long meeting is a stated,
reasoned choice rather than a silent quality loss.

This reference file and `commands/file-meeting.md`'s dispatch section both
record this cost honestly. Total tokens go UP by roughly the number of
perspectives (five), and that is the accepted price for not missing a claim
that only one lens would have noticed.
