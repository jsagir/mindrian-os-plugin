# Phase 229 - Dr. Framework v3.0 Architecture Decision (navigator ruling, 2026-07-16)

**Status:** DECIDED - navigator wants a NEW SESSION for this, framed specifically around
this document. Do not build any of this in the current session. This file is the
complete handoff: the source architecture, the mapping against what Phase 229 already
shipped, and the open decision the new session must resolve first.

**Why a new session:** the current session has been running continuously through the
full Phase 229 build (planning, execution, live debugging across 7 deferred-item rounds,
the Vercel showcase) and is very long. The navigator wants this specific decision -
whether/how to adopt the Dr. Framework v3.0 report architecture - handled fresh, not
bolted onto an already dense context window.

---

## 1. The source: Dr. Framework v3.0 (navigator-supplied, verbatim)

This is the actual architecture of the OLD ad-hoc process that produced the calibration
corpus fixtures (LDES, Dental Healthcare, AI-in-Education, Circular Manufacturing, DnATA,
DNA-storage - see `calibration/INDEX.md`). Phase 229's `PWS_grading` pipeline was built
by reverse-engineering OUTPUT examples from that corpus, not from this architecture spec
- this document was not available until this point in the build.

### System Prompt Architecture

**Meta-Layer (Module 0): Core Engine & Meta-Framework**
- Role Definition (Identity)
- Meta-Cognitive Principles (5)
- Assessment Context Protocol
- Handoff Standard (state management)

**Execution Modules (1-5)** - each follows: Objective -> Execution Protocol (numbered
steps) -> Module Output (structured dict) -> Handoff (transition message)

- **Module 1 - Graph Analysis:** Neo4j, READ-ONLY Cypher queries
- **Module 2 - Pattern Discovery:** SQL/vector search patterns
- **Module 3 - External Validation:** web search query patterns (real citations)
- **Module 4 - Synthesis**
- **Module 5 - Report Generation:** produces the final 11-section report

**Control Layer:**
- Execution Modes (3 types): Full Sequential (0->5), Partial Analysis (selected modules
  only), Progressive with Checkpoints (pause/resume)
- Checkpoint Protocol: `{module_id, state snapshot, can_resume_from: [list],
  evidence_collected: count}`
- Quality Gates, Evidence Requirements

**Report Structure (Module 5 output, 11 sections):**
```
Header -> Summary -> Reality Check -> Faculty -> Experts -> Research ->
Cognitive -> Challenges -> Recommendations -> Cross-Domain -> Roadmap -> Metrics
```

**Key design patterns:**
- Standardized I/O per module; state carried in an `AssessmentState` object
- Evidence Chain: every insight tagged to source, trail maintained across modules,
  attribution in final report
- Token optimization: modular execution avoids loading all content at once; checkpoints
  allow progressive processing

---

## 2. Mapping against what Phase 229 actually shipped (this session, 2026-07-16)

| Dr. Framework module | What it does | Phase 229 equivalent | Gap |
|---|---|---|---|
| Module 0 - Core Engine | Role, meta-cognitive principles, handoff/state standard | `rubric-huji.md` + `CONTRACTS.md` | Roughly equivalent, less formal |
| Module 1 - Graph Analysis | Neo4j read-only, analyzes an EXISTING venture graph | None directly - HUJI submissions are fresh transcripts, not an ongoing graphed venture. `huji-intake.cjs`'s `populateRoom` (dual-write into room.db graph + markdown, DI-4 fix) is the closest analog, but it POPULATES a room rather than MINING an existing one | Structural: the old framework assumed an in-progress venture with history; ours grades an isolated one-shot transcript |
| Module 2 - Pattern Discovery | SQL/vector search for patterns | Loosely: `deep-grade`'s Brain read-only enrichment (`brain_ask`, generic handles only, Part 8 boundary) | Real but thin compared to a dedicated pattern-discovery module |
| Module 3 - External Validation | Web search, real citations | **Not built.** This is exactly "v1.1 addition #1" (research citations) already queued in `DEFERRED-SCOPE-v1.1.md` | Direct match - build per that spec |
| Module 4 - Synthesis | Pulls findings together | `build-thesis` (scored) + `structure-argument` (Minto packaging) | Reasonable match |
| Module 5 - Report Generation | The 11-section report | **The real gap.** Current output is a compressed 4-part Minto pyramid (governing thought + 2-3 branches + next steps + one grade number) | This is what the new session needs to resolve |

### The 11 Dr. Framework sections vs. what exists today

| Section | Exists in Phase 229 output? | Notes |
|---|---|---|
| Header | Partial | Just a filename-style title, not a formal header block |
| Summary | Partial | Compressed into the governing-thought line |
| Reality Check | Partial | Folded into the branches, not a separate section |
| Faculty (adversarial reasoning challenges) | **No** | Mapped to queued "Six Hats" addition (partial overlap, not identical) |
| Experts (simulated practitioner conversations) | **No** | Also mapped to queued "Six Hats" addition (partial overlap, not identical - Faculty and Experts were TWO separate sections in the original, Six Hats was proposed as one combined multi-perspective section) |
| Research (external validation + citations) | **No** | Matches queued "citation layer" addition directly |
| Cognitive (bias analysis, named biases + confidence scores) | **No** | Not discussed until this comparison surfaced it - genuinely new gap |
| Challenges (expanded strategic questions) | Partial | Somewhat present in the branches' rhetorical framing, not a distinct section |
| Recommendations (the homework) | **No** | Matches queued "Path to A+" addition directly |
| Cross-Domain (inspiration from other industries) | **No** | Not discussed until this comparison surfaced it - genuinely new gap |
| Roadmap | **No** | Not discussed - a sequencing/timeline view distinct from Recommendations |
| Metrics (visible weighted grading breakdown table) | **No** | Only one overall number (e.g. "7/10") is shown; no component breakdown table like the Notion fixtures had |

---

## 3. The tension the new session must resolve first

The navigator's calibration-phase ruling (locked earlier in Phase 229, `229-CONTEXT.md`)
was that a full investor-gauntlet report would demoralize a 200-person course cohort
("half the class fails question 2 and learns nothing") - hence the compressed 4-part
Minto pyramid instead of the old process's full elaborate report.

**Working hypothesis to test in the new session (not yet a decision):** structural
completeness (how many sections) and severity calibration (how hard the tone pushes,
whether it credits self-named gaps, course-tier vs. investor-tier depth) may be two
SEPARABLE design axes, not one. It may be possible to adopt the full Dr. Framework
11-section skeleton while keeping every section's actual content at course-tier depth
and Part-12-compliant tone (formative, credits metacognition, never punishes
disfluencies) - rich in shape, gentle in weight. This needs to be validated, not assumed.

## 4. What the new session should do first

1. Re-read this file in full, plus `DEFERRED-SCOPE-v1.1.md` (the 3 already-queued
   additions and their locked design decisions - Tavily for research, domain/subdomain
   hat naming, one-call-generate + one-call-synthesize for hats).
2. Re-read `229-CONTEXT.md`'s calibration-phase ruling and `229-AI-SPEC.md` Section 1b
   (Part 12 tone rules) before proposing any report restructure - the tone rules are
   locked, not open for re-litigation; only the STRUCTURE is in question.
3. Present the navigator with a concrete decision: which of the three build-order
   options from this session's card apply now that the full architecture is visible -
   (a) rebuild Module 5 (report shape) only, keeping the existing pipeline; (b) adopt
   the full 6-module architecture including Module 1/2 as real pipeline stages; (c) a
   scoped subset. Get a fresh, informed decision - the navigator's answer in THIS
   session ("start a new session with this decision in this framing") means the choice
   itself is deferred, not pre-selected.
4. Read the two real demo artifacts already generated and gate-clean:
   `demo/feedback-sample-1.md` (SafeScan, 7/10) and `demo/feedback-sample-2.md`
   (study-app, 8/10) - these are the CURRENT baseline the new report shape must equal
   or exceed, not regress from (same evidence-grounding rigor, same anti-fabrication
   discipline, same cost-consciousness).
5. Read the live Vercel showcase (`https://huji-grading-showcase.vercel.app`) as the
   current rendering target - any new report shape will need a corresponding template
   update there too.

## 5. Everything else from this session remains valid and unblocked

- The core pipeline (Stage A intake, Stage B `/mos:pipeline PWS_grading`, batch
  orchestrator, judge calibration at Spearman 0.883-0.901) is DONE, gate-clean, and
  committed on `main`. This architecture decision is about the REPORT SHAPE
  (Module 5 / the Minto-pyramid-vs-11-section question), not a re-do of the working
  pipeline.
- Tasks 2/3 of Plan 229-09 (Amnon's verdict, the HUJI calibration workshop) are still
  pending and independent of this decision - though the navigator may reasonably want
  to resolve the report-shape question BEFORE showing Amnon anything, given how much
  richer the Dr. Framework structure is.
- The plugin-version-pinning recommendation (git-tag the checkout before the real
  200-student batch, per the install-cache-divergence hazard found during live
  debugging) still stands regardless of this decision.

---

## 6. RESOLVED (navigator ruling, new session, 2026-07-16)

The navigator supplied a second artifact this session: the same system's OPERATIONAL
layer (tool-call sequence, Chain-of-Thought, state management, quality gates,
execution modes) - not just the report-shape architecture from Section 1. That
changed two things and left the report-shape call from Section 1's mapping intact
on everything else.

### 6a. Correction to Section 2's Module 1 mapping

Section 2 said "Module 1 - Graph Analysis: None directly - HUJI submissions are
fresh transcripts, not an ongoing graphed venture." That was too pessimistic. The
operational artifact's actual Cypher queries `Framework` / `DifferentialAnalysis` /
`InnovationOpportunity` nodes with `effectiveness_score` / `breakthrough_potential`
- a GENERIC methodology/pattern graph, not a per-venture graph. Live Brain schema
check this session confirms: `Framework`, `Pattern`, `Opportunity` node labels and
`differential_score` / `breakthrough_potential` / `hsi_score` properties already
exist in the real graph (our own HSI/differential scoring, same idea). Module 1 is
substantially what `brain_ask` already exercises inside `deep-grade` - not a gap.

### 6b. Operational-layer lessons (steal 2, reject 1)

- **Steal:** explicit numeric pass/fail gates per pipeline stage ("≥3 frameworks",
  "≥70% validated"), not prose judgment. G6 (the ~900-word cap) is already this
  pattern. Extend it to Addition 1 (research validation, v1.1): a hard "X% of
  load-bearing claims Tavily-confirmed" threshold when that ships, not a vibe check.
- **Steal:** "Progressive with checkpoints" execution mode - wrong for the 200-
  student unattended batch, right for the HUJI calibration workshop (Amnon's team
  previews a partial run before the rubric commits).
- **Reject:** "state lives in the conversation context, no external storage
  needed." Fine for one navigator running one live assessment; does not survive
  200 independent submissions needing resume/parallelize/audit. `lib/core/
  chain-executor.cjs::runChain`'s disk-checkpoint pattern is the correct fit here,
  not this one.

### 6c. Final ruling on Module 5 (report shape) - navigator approved

**Decision: keep the current Minto pyramid shape. Add only a compact weighted
Metrics table, plus an optional single Brain-sourced cross-domain analogy line
folded into an existing branch (made cheap and Part-8-safe by 6a's correction).
Faculty / Experts / Cross-Domain / Roadmap are explicitly NOT adopted as separate
formal sections.**

Reasoning that closed it:
1. **Hard technical constraint, not aesthetics.** G6 already fails any pyramid
   over ~900 words. The two real demo artifacts are 616 and 770 words for 3
   branches. Four more formal sections structurally blows the gate regardless of
   how gently each is worded.
2. **Form signals audit independent of tone.** A named "Faculty" or "Challenges"
   section tells a first-time student they are being gauntlet-reviewed, which is
   the exact demoralization failure mode the 15.7.2026 calibration ruling
   (`229-CONTEXT.md`) already killed. Softening the prose inside a section named
   "Challenges" does not undo what the header itself signals.
3. The navigator's own working hypothesis from Section 3 ("structural
   completeness and severity calibration may be separable axes") is HALF right,
   not fully right: it holds for a Metrics table (just a table, ~30 words, no
   tone risk) and for a single analogy line (now cheap per 6a). It does not hold
   for the four investor-gauntlet-shaped sections, where the section boundary
   itself - not the words inside it - is the problem.

Research, Recommendations ("Path to A+"), and the Six-Hats-style multi-perspective
section remain queued per `DEFERRED-SCOPE-v1.1.md`, unaffected by this ruling,
build them regardless.

**Status: CLOSED.** Next actionable step: scope the Metrics table + analogy-line
addition as its own small plan (not yet written) whenever the navigator resumes
build work on Phase 229 v1.1.

---

## 7. Two follow-on rulings, same session (2026-07-16)

**7a. Voice anchor: the calibration corpus is not stylistically uniform.** The
navigator asked for feedback pedagogy to be "Larry style," pointing at the Notion
corpus. Checked two fixtures directly: fixture 11 (Surveillance opportunity
review, `T.A.: Professor Lawrence "Larry" Aronhime` - human-authored) is the
authentic voice: short punchy declaratives, real reframes, a rhetorical question
doing the opening work ("Are you solving for better surveillance, or for better
security? There's a profound difference."). Fixture 08 (DNA Data Storage - the
exact HUJI transcript-input MODALITY anchor) is written in a bullet-heavy
strategic-consulting register ("Unconscious intersection innovation mastery") -
useful for structure, not for voice. Ruling: fixture 11 is the voice target,
fixture 08 stays a structure/modality target only, never a voice target. Encoded
into `references/methodology/rubric-huji.md` Section 3 (Tone Constitution) this
session. The two already-shipped demo artifacts were spot-checked against this
and already lean toward fixture 11's register (reframe + contrast pattern) - this
was a tightening/anchoring move, not a rebuild.

**7b. Six Hats framing (Addition 3, DEFERRED-SCOPE-v1.1.md) sharpened.** The hats
discussion is not six generic critique angles - it is anchored to one literal
question, "how can this become an A+, what needs to be done," with each hat
arguing that question from its own domain-derived vantage, in tension with the
others; the synthesis call resolves the disagreement into a concrete next-step
ordering. Encoded into `DEFERRED-SCOPE-v1.1.md` Addition 3 this session. Does not
change the build-order or the 2-extra-calls-per-student cost model already locked
there - framing only.
