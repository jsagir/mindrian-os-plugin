# Phase 229: HUJI Pitch Feedback Module - CONTEXT

**Gathered:** 2026-07-15 (live conversation with navigator + 4-agent repo sweep)
**Status:** business terms locked, architecture direction locked, fit-gap evidence landing

## The Job (customer-stated)

- **Customer:** Amnon Dekel, Hebrew University of Jerusalem (WhatsApp thread 5-6.7.2026)
- **Ask:** module that takes a pitch VIDEO (up to 5 minutes) as input and returns TEXT feedback
- **Scale:** pilot on a digital course, 200+ students, every student submits a presentation
- **This is MindrianOS's first paying job.** Opportunity filed: `~/MindrianRooms/mindrianOS/opportunity-bank/2026-07-15-huji-pitch-feedback-pilot.md`

## Business Decisions (LOCKED 15.7.2026, navigator-approved)

1. **Pricing posture: cheap pilot, land the logo.** ~$900 total (200+ units at $4-5/unit) as paid discovery; HUJI becomes the reference customer; real pricing arrives with the semester license.
2. **Two-line quote structure (navigator's own framing):** (a) feedback generation marginal cost $4-5/unit; (b) feedback tuning/calibration as a SEPARATE visible line item, waived or discounted for the pilot. The semester re-anchor is pre-seeded in writing.
3. **Critical path:** sample video from Amnon -> ONE demo feedback artifact -> the demo IS the sale. Rubric request goes out with the price quote.

## Architecture Direction (navigator-locked this session)

**Deep-grade-first composition (Canon Part 7, reuse before build):**
- `/mos:deep-grade` = the calibrated spine
- `/mos:build-thesis` = ten-questions validation gate
- `/mos:mullins` = market / technology / risk validation (7-domains)
- `/mos:structure-argument` + Minto reasoning engine = feedback delivered as a MECE pyramid (governing thought first, 2-3 branches at the student's level)

**Calibration-phase ruling (navigator, 15.7.2026):** the feedback recipient is a student in a 200-person course, NOT a founder at a thesis gate. Running the full investor gauntlet unmodified is a pedagogical failure mode ("half the class fails question 2 and learns nothing"). Therefore the module includes an explicit CALIBRATION PHASE with the HUJI team + Amnon: the course rubric decides WHICH of the ten questions the course actually teaches and at WHAT depth. Validation battery is TIERED BY RUBRIC; deep-grade spine always on; Minto pyramid is the delivery format. The rubric workshop with HUJI is a phase deliverable, not prep work.

## Constraints

- **Canon Part 8 (Graph Boundary):** student pitch content NEVER egresses to Brain. Calibration crosses the wire as generic handles/enums only. This shapes the feedback module architecture, not just plumbing.
- **Canon Part 12:** feedback tone - never grade-and-compliment theater; teachable order; formative not just summative.
- **Tri-Polar rule:** pilot can be CLI-run by Jonathan (service-as-product), but design should not paint Desktop/Cowork into a corner.
- **Cost ceiling:** ~$4-5/unit all-in quoted to customer; unit economics must hold at 200+ submissions.

## Fit-Gap Evidence (repo sweep, 2026-07-15, dev repo)

### Sweep 1 - Grading surfaces (COMPLETE)
- All grading surfaces are ROOM-CENTRIC and TEXT-ONLY. Only door for a room-less document: grading agent's "submitted document" fallback (`agents/grading.md` line 56).
- **The 6-component rubric is problem-discovery-specific and explicitly ANTI-pitch** (`references/methodology/grade.md` line 30: grading a pitch is a listed anti-pattern). A pitch transcript maps onto the F-grade pattern by construction. Rubric adaptation is REQUIRED, not optional.
- **THREE inconsistent rubrics** across surfaces: 6-component (references/methodology/grade.md), 5-component Brain path (commands/grade.md line 77), 7-section agent rubric (agents/grading.md lines 86-102). Must be reconciled or explicitly selected for this module.
- **deep-grade's advertised calibration is partly unshipped:** `brain_grade_calibrate` / `brain_gap_assess` tools DO NOT EXIST (spec-only, 2026-03-22 design doc). Real path: `brain_ask` curated Cypher intent (`brain-ask.cjs` lines 256-264) over `Example` nodes. Agent hardcodes SIX graded submissions, not "100+" (grading.md lines 63-70). Marketing claim vs reality gap - must not be repeated to HUJI.
- **No batch mode.** One venture per run. `--full` fans out per-section of ONE room, not N submissions.
- **Venture-stage gating breaks room-less runs:** `model-profiles.cjs` greps STATE.md for Stage; Pre-Opportunity -> grading=skip -> hard stop.
- deep-grade HARD-REQUIRES Brain (stops at Tier 0); /mos:grade degrades gracefully.

### Sweep 2 - Media ingestion (COMPLETE)
- **mp4 cannot be ingested today.** `scripts/transcribe-audio` allowlist = mp3|m4a|wav only. No --video flag, no ffmpeg/demux anywhere in repo.
- Velma (Modulate) is the only transcription engine: optional, paid key (VELMA_API_KEY), ~$0.03/hr, diarization + timestamps + emotions. Endpoint never verified live in-repo (mock-fixture tests only) - VERIFY BEFORE DEMO.
- No visual channel: no frame extraction, no slide OCR. A pitch's deck/demo visuals are lost entirely (audio words only).
- **No wire from transcript to any grading/feedback command.** The connection must be built.
- Transcription is bash+curl, CLI-surface only.

### Sweep 3 - Batch/scale + Brain calibration (COMPLETE)
- **No batch/cohort orchestrator exists.** pipeline/act-chain/act-swarm are all single-room; swarm axis is sections-of-one-room, capped by single-session token budget far below 200. N=200 is an orchestration-layer build (outer loop + per-submission isolation + aggregation), NOT a grading-logic build.
- Reusable bricks: `agents/framework-runner.md` (isolated, parallelizable, structured result contract), `agents/grading.md` (single-submission scorer, scores locally per Part 8), `lib/core/chain-executor.cjs::runChain`, `scripts/transcribe-audio`.
- **Calibration reality:** `brain_grade_calibrate`/`brain_gap_assess` are dead references (Cypher-pattern names, never shipped as tools). Real wire: `brain_ask` curated intent over `Example` nodes. In-repo anchors: 6 graded submissions (range 43-93, mean 67.8). "100+" claim unverified (Canon D1: sub-counts unasserted). NEVER repeat "100+" to HUJI.
- **Canon Part 8 is categorical:** student pitch transcript may NOT cross to Brain (FERPA persona named in canon). Scoring happens locally; only generic rubric/calibration handles cross the wire. For a university customer this is a FEATURE (privacy story) - sell it.
- HITL friction: grade/deep-grade carry F.8 gates; unattended 200x runs need an autonomous_safe batch posture design.

### Sweep 4 - Validation battery + Minto composition (COMPLETE)
- All four target commands (`deep-grade`, `build-thesis`, `mullins`, `structure-argument`) are autonomous_safe=true, resolvable via `composeWorkflow`, runnable on the shared runChain spine TODAY as an ad-hoc framework-name chain - but the sequence is registered NOWHERE (closest named pipeline: `thesis` = structure-argument -> challenge-assumptions -> build-thesis, different set/order).
- **Methodology-native order is mullins BEFORE build-thesis** (GREEN Mullins -> build-thesis); structure-argument is a packaging/communication step (pyramid last).
- Ten-Questions gate: 10 binary evidence-scored questions, 6/10 threshold that HALTS below - must become score-and-continue for feedback use. Mullins: 7 domains RED/YELLOW/GREEN, weakest-domain caps. validate/analyze-needs: importance-satisfaction tables. structure-argument: SCQA + MECE tree. **Output contracts are already feedback-shaped; inputs are the problem.**
- All surfaces are conversational Socratic prompt files assuming a live founder + a venture room; stage handoff is via room-artifact frontmatter scanning. Both Minto engines are room-bound (reasoning-ops hard-fails without STATE.md; vault-section-minto-generator silently produces nothing on an empty room).
- **The clean seam:** (a) ephemeral/synthetic room per submission (scratch STATE.md), (b) transcript->evidence extraction adapter per command (extract, don't interrogate), (c) score-and-continue mode neutralizing the 6/10 halt, (d) new registered recipe `PWS_grading` in native order: deep-grade -> mullins -> build-thesis(scored, non-gating) -> structure-argument(pyramid packaging), (e) batch orchestrator looping (a)-(d) over N submissions with aggregation.

**Recipe name (navigator ruling, 15.7.2026): `PWS_grading`** - the registered command-resolver recipe/pipeline identifier for this 4-command chain. Not "pitch-feedback" (that name stays only as the phase-directory/opportunity label, not the invocable recipe name).

## Customer Sample Data (arrived 15.7.2026, mid-session)

- Amnon sent 2 sample pitches as **diarized timestamped TRANSCRIPTS** (not videos) - format "Speaker N: (M:SS)". Filed verbatim: `samples/sample-1-safescan.md` (hardware allergen detector), `samples/sample-2-study-app.md` (mobile learning app).
- **Implication: HUJI's platform already produces transcripts.** If true for all 200 submissions, video ingestion drops off the pilot critical path entirely (transcript-in contract; video = v2). CONFIRM with Amnon: "does every submission come with this transcript?"
- Samples reveal the implicit course skeleton: problem -> value -> prototype -> risks+mitigation -> critical path -> team -> gaps. Venture-creation course assignment, NOT investor pitch. ~2 min, non-native English speakers - feedback must be language-gentle.
- Eval note: sample 2 names its own gaps ("deeper market research, competitor analysis") - feedback engine must REWARD metacognition, not double-punish the gap. Sample 1 asserts unevidenced tech claims ("smart light sensor") - where tiered Mullins tech-validation earns its place.

## Navigator Rulings (15.7.2026, mid-session)

1. **"We grade using OUR methods."** Prior HUJI grading is unknown and irrelevant - Amnon is paying to see what Mindrian methodology says about his students. Demo runs pure Mindrian; the calibration workshop with HUJI tunes DEPTH (which questions, what tier), never method.
2. Calibration phase with the HUJI team + Amnon is confirmed as an explicit phase deliverable.
3. **Intake = room-builder (navigator requirement, 15.7.2026).** Transcript intake must do proper ENTITY EXTRACTION and WISDOM NUGGETS exactly like the shipped file-meeting system: Claimify 4-pass (selection -> disambiguation -> decomposition -> typing) through navigation.writeClaimNode, typed claim nodes with review_status, nugget extraction. The ephemeral room is genuinely POPULATED by intake, so the downstream grading chain gets the room structure it expects - no shims.
4. **Multi-artifact submissions: deck/paper + transcript cross-referencing.** Port the navigator's legacy "Claims-Aware Presentation Fusion & Analysis Engine" prompt (filed verbatim-with-ruling: `assets/claims-fusion-engine-prompt.md`) as the intake fusion stage. Mode A (COMPLETE FUSION: match transcript segments to slides, preserve exact text from both, mark claim gaps/contradictions) + the extraction discipline (every name, citation, URL, statistic) PORT. **Modes B/C (generate missing transcript / construct missing slides) are DISABLED for assessment use** - grading generated content is the fabricated-critique failure mode (domain failure mode #1). Missing-artifact gaps are NAMED in feedback, never filled. Pedagogical bonus: claims are graded on their strongest presentation across artifacts (evidence on a slide counts even if fumbled verbally).

## Calibration Corpus (Notion, discovered 15.7.2026)

- Navigator's Notion holds the FULL LarrAI review corpus: "CS - LarrAI reviews" page -> "AI larry Reviews" database (37 rows, April-Dec 2025): real CS/ECE student team pitch reviews (with recordings + decks attached), graded assessment reports, IRIS reviews, feedback-process logs with bias detection.
- 12 fixtures pulled to `calibration/`: 4 graded anchors (Circular Manufacturing, AI-in-Education D+, LDES B, Dental Healthcare A- 87.2), 2 feedback-process logs, Mullins report, 5 pitch reviews incl. **"DNA Data Storage - TRANSCRIPT ONLY"** - a Larry review generated from a bare transcript, the exact HUJI modality, with proven output format.
- **Anchor hygiene correction (15.7.2026, full-text re-read of all 4 graded anchors):** Circular Manufacturing's page-header "43/100" and AI-in-Education's headline "48.5/100" are both STALE - each fixture's own detailed component table computes a different number (Circular: **24/100** exact; AI-Ed: **42.5/100** exact, confirmed by its own JSON handoff), inherited-but-not-recomputed from an earlier draft pass within the same document. Full finding + reasoning: `calibration/INDEX.md` "Anchor Hygiene Corrections" section. Practical impact on this phase: NONE on the eval design's own bucketed normalization (AI-SPEC Section 5's <50%=band-1 rule puts both the stale and canonical numbers in the same band), but the raw numbers cited elsewhere should use the canonical figures, not the frontmatter `grade:` headline.
- Student names REDACTED to initials in fixtures (no-real-names rule). All fixtures LOCAL ONLY (Part 8).
- Eval design implication: judge-with-anchors - generated feedback scored against how Larry actually reviewed comparable work across the 43-87.2 range; the corpus replaces the unverified "100+" claim with a real, inspectable anchor set.

## Framework Preferences (from navigator profile + repo conventions)

- CJS only, no TypeScript; lib/core/*.cjs shared core; bash scripts stay authoritative; no new server infrastructure.
- Model access: Claude via the plugin's existing model-profiles routing. Video/audio: ffmpeg demux + transcription (Velma if live, else fallback engine TBD by selector).
- Reuse before build (Canon Part 7): the module composes existing commands; net-new surfaces must be justified against the 25 methodology commands.

## Open Questions for AI-SPEC

1. Video understanding depth for v1: audio-transcript-only vs transcript + slide frames (vision)? Cost ceiling says transcript-first; pitch quality assessment may need slides.
2. Which rubric is the module's spine: adapted 6-component, agent 7-section, or a new pitch-course rubric derived in the HUJI calibration workshop?
3. Batch runner shape: 200 submissions through what orchestration (pipeline? act-swarm? plain script loop)? Isolation and resume semantics?
4. Calibration data path under Part 8: what generic handles can cross to Brain; does the pilot even need Brain, or is rubric-grounded local grading enough for v1?
5. Feedback output contract: one Minto-pyramid markdown per student? Delivered how (file per student, LMS-ready CSV+md bundle)?
6. Eval strategy: how do we know feedback quality is "better than a TA" - who judges, against what reference set (the sample video + Amnon's judgment is the seed eval).
