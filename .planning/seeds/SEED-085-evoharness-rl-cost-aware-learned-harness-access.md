---
id: SEED-085
status: dormant
planted: 2026-09-03
planted_during: Seed Ledger session (post seed-promotion batch, phases 277-338) - navigator surfaced arXiv 2608.05446 while reviewing the ICM-layered book, specifically against SEED-032 (harness-as-code, Phase 298) and SEED-062 (close the engine gap, Phase 319)
trigger_when: "when Phase 319 (SEED-062, close the engine gap - no agentic runtime) or Phase 298 (SEED-032, harness-as-code) is discussed or planned; when the regulation layer (SEED-031/042, Phase 297/304) is redesigned and needs a real policy for WHEN Larry pays the cost of a reach/gate versus acting alone; or when room memory (STATE.md, memory_event, .planning/seeds/ itself) is redesigned and a persistent/progress/experience split is on the table."
scope: medium
---

# SEED-085: EvoHarness-RL - treat "when to touch the harness" as a learned, cost-aware policy, not a hand-written rule

## Why This Matters

Navigator surfaced arXiv 2608.05446, "EvoHarness-RL: Learning Self-Evolving Runtime Harness for
Long-Horizon LLM Agents" (Xuying Ning, UIUC; Dongqi Fu, Meta AI; et al., Aug 2026), while looking
at the freshly-published Seed Ledger and specifically flagging it against the harness/engine-gap
family (SEED-032, SEED-062) - this repo's own standing open questions about what its agent
harness even IS and whether it has a real runtime. Read directly (`arxiv.org/html/2608.05446v1`),
not from the title alone.

The paper's actual claim is narrower and more useful than "self-evolving harness" sounds: it
treats **harness usage itself as a learnable policy decision**, not a manual prompt-engineering
choice. Two problems it names are problems this repo already has, unnamed:

1. **Extracting useful state from noisy interaction traces** - this repo's own STATE.md
   resync-clobber bug (20+ documented occurrences, named in this session's own
   `docs/2026-09-01-HANDOFF-...md` and multiple prior handoffs) is exactly this failure mode:
   the harness's own state-tracking is unreliable, and nothing in this codebase currently learns
   from *when* the resync clobbers versus when it doesn't.
2. **Deciding when external-state access is worth its computational cost** - this is, almost
   word for word, what the Ask-Tell Dial / regulation layer (SEED-031, SEED-042, Phase 297/304)
   is trying to hand-specify with rules and gates. EvoHarness-RL's finding: after training, the
   harness "anneals" toward roughly one scaffold call per episode instead of many - the model
   learns to trust its own working memory except when it genuinely needs the harness, rather than
   following a fixed schedule of when to check in.

## The mechanism worth knowing, not necessarily porting whole

**Belief-Progress-Experience (BPE) interface** - three typed channels a harness exposes to an
agent:
- **Belief (B)**: persistent environment state
- **Progress (P)**: execution status and subgoal structure
- **Experience (E)**: cross-episode reusable knowledge

**Four meta-actions**: `track` (read belief), `commit` (write progress), `recall` (retrieve
experience), `note` (record new experience). This is a strikingly close structural analog to
what this repo's room already has informally and unnamed: STATE.md is Progress, the local graph
(room.db) is closer to Belief, and `.planning/seeds/` + `memory_event` writes are Experience -
but nothing here currently treats them as one typed interface with one policy governing when an
agent touches which channel. They are three separately-evolved subsystems that happen to
resemble BPE's three channels after the fact.

**Two-stage training** (SFT bootstrap on successful trajectories with BPE actions, then
cost-aware GRPO optimizing which harness accesses maximize task success within a budget) is the
RL-specific part and the least directly applicable to this repo today - this repo has no training
loop and Phase 298/319 are about declaring/building a harness in the first place, not fine-tuning
a model against one. Worth naming as a possible Phase 2 once a harness exists, not a
Phase 298/319 requirement.

**Results, for calibration, not for import**: 96.9% success on ALFWorld's seen split, 86.6% on
unseen, beating SkillOS (80.2%) and SkillRL (89.9%); the harness design alone lifted frontier
models too (Claude Opus 4.5 +2.1%, GPT-5 +25.7%) when given the same BPE scaffold without
retraining - suggesting the *interface design* carries real signal independent of the RL
training, which is the part most transferable to a codebase with no training loop of its own.

## What NOT to steal / re-propose

Do not read this as "go implement RL training for MindrianOS." The transferable idea is narrow:
name Belief/Progress/Experience as the three typed channels this repo's memory subsystems already
approximate, and treat "does Larry touch the harness right now" as a single governed policy
question (already the Ask-Tell Dial's job) rather than three uncoordinated systems (STATE.md
writes, room.db writes, seed-planting) each with their own ad-hoc trigger logic. The GRPO/cost
optimization is the paper's actual contribution and is explicitly out of scope here absent a
training loop - naming it, not building it, per this repo's own SEED-062 finding that there is no
agentic runtime here yet to train against.

## Scope Estimate

**Medium** - not a new subsystem, a *naming and reconciliation* pass across three that already
exist (STATE.md, room.db, seeds/memory_event), done once Phase 319 (SEED-062) or Phase 298
(SEED-032) is actually being planned. Could ship as a section within either phase rather than its
own phase - a planner should make that call at discuss-phase time, not this seed.

## Breadcrumbs

- `.planning/seeds/SEED-032-harness-as-code.md` - the "declare what the harness even is" seed this pairs with directly.
- `.planning/seeds/SEED-062-the-engine-gap-no-agentic-runtime-in-this-codebase.md` - "no agentic runtime" is the precondition EvoHarness-RL's training loop assumes exists; read together.
- `.planning/seeds/SEED-031-regulation-layer-larry-as-connector.md` / `SEED-042-always-on-act-redteam-toggle.md` - the existing, hand-specified version of "when does Larry pay the cost of touching the harness."
- `.planning/seeds/SEED-040-hitl-memory-governance.md` - "what/how/who the room remembers" is this repo's own unnamed Belief/Experience split question.
- `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` and every prior handoff citing "STATE.md resync-clobber, 20+ occurrences" - the concrete, already-documented instance of BPE's "extracting useful state from noisy interaction traces" problem, unnamed until now.
- Source: `https://arxiv.org/html/2608.05446v1` (fetched and read directly 2026-09-03, not summarized from title/share-link alone).

## Notes

Filed live against the freshly-published Seed Ledger's L0/L3 split (this repo's own CLAUDE.md
Appendix B: Identity through Artifacts). This seed sits at the L0/L1 boundary - it's simultaneously
a harness *identity* question (what is the harness) and a *routing* question (when does an agent
touch it) - which is itself a small piece of evidence that the ICM layer boundaries are porous at
exactly the harness/regulation seam, worth flagging to whoever plans Phase 298 or Phase 304.
