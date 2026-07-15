# Phase 229: HUJI Pitch Feedback Module - Research

**Researched:** 2026-07-15
**Domain:** Batch AI pipeline (transcript -> evidence -> methodology chain -> Minto feedback) via plugin-native headless `claude -p` orchestration
**Confidence:** HIGH (implementation surface verified against live repo + live CLI; architecture already locked by AI-SPEC)

> **Framing.** The AI-SPEC already made every hard architecture call (no external framework, headless `claude -p` orchestration, three-tier model routing, 10-dimension eval). This research does NOT re-litigate those. It documents the CONCRETE IMPLEMENTATION SURFACE: the exact repo files, function signatures, and seams the planner's tasks must call, hook, or extend. Every code claim below is grepped/read from the live repo at HEAD; every CLI claim is verified against `claude 2.1.210` on this machine.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Business (LOCKED 15.7.2026, navigator-approved):**
1. Pricing posture: cheap pilot, land the logo. ~$900 total (200+ units at $4-5/unit) as paid discovery; HUJI becomes reference customer.
2. Two-line quote: (a) feedback generation marginal cost $4-5/unit; (b) feedback tuning/calibration as a SEPARATE visible line item, waived/discounted for the pilot.
3. Critical path: sample video from Amnon -> ONE demo feedback artifact -> the demo IS the sale.

**Architecture direction (navigator-locked):**
- Deep-grade-first composition (Canon Part 7, reuse before build): `/mos:deep-grade` = calibrated spine; `/mos:build-thesis` = ten-questions validation gate; `/mos:mullins` = market/tech/risk validation; `/mos:structure-argument` + Minto = feedback as a MECE pyramid.
- Methodology-native order: **mullins BEFORE build-thesis** (GREEN Mullins -> build-thesis); structure-argument is packaging (pyramid last).
- The 5 build seams: (a) ephemeral/synthetic room per submission, (b) transcript->evidence extraction adapter per command, (c) score-and-continue mode neutralizing the 6/10 halt, (d) new registered recipe `PWS_grading` in native order, (e) batch orchestrator looping (a)-(d) over N with aggregation.
- Explicit CALIBRATION PHASE with HUJI team + Amnon: the course rubric decides WHICH ten questions the course teaches and at WHAT depth. Validation battery TIERED BY RUBRIC; deep-grade spine always on; Minto pyramid is delivery format. Rubric workshop is a phase deliverable, not prep.

**Navigator rulings (15.7.2026):**
1. "We grade using OUR methods." Demo runs pure Mindrian; calibration tunes DEPTH, never method.
2. Calibration phase with HUJI + Amnon is an explicit phase deliverable.
3. Intake = room-builder. Transcript intake does proper ENTITY EXTRACTION + WISDOM NUGGETS exactly like the shipped file-meeting system: Claimify 4-pass through `navigation.writeClaimNode`, typed claim nodes with review_status, nugget extraction. The ephemeral room is genuinely POPULATED by intake - no shims.
4. Multi-artifact submissions: port the "Claims-Aware Presentation Fusion & Analysis Engine" prompt as intake fusion. Mode A (COMPLETE FUSION) + extraction discipline PORT. Modes B/C (generate missing transcript/slides) DISABLED for assessment. Missing-artifact gaps are NAMED, never filled. Claims graded on strongest presentation across artifacts.

**Constraints:**
- Canon Part 8 (Graph Boundary): student pitch content NEVER egresses to Brain. Only generic handles/enums cross the wire. This is a FEATURE (privacy story) - sell it.
- Canon Part 12: feedback tone - never grade-and-compliment theater; teachable order; formative not summative.
- Tri-Polar rule: pilot CLI-run by Jonathan; design must not paint Desktop/Cowork into a corner.
- Cost ceiling: ~$4-5/unit all-in; unit economics must hold at 200+.
- Framework: CJS only, no TypeScript; lib/core/*.cjs shared core; bash scripts authoritative; no new server infrastructure. Reuse before build.

### Claude's Discretion
- Batch runner shape details (concurrency pool size, checkpoint format) within the AI-SPEC guidance.
- Whether the demo spine drops to sonnet if indistinguishable from opus under Amnon's judgment (explicit eval question, not a silent swap).
- Exact scratch-room STATE.md minimum content and cleanup/archival policy.

### Deferred Ideas (OUT OF SCOPE)
- Video/mp4 ingestion (transcript-in contract for v1; video = v2 - HUJI's platform already produces diarized transcripts, CONFIRM with Amnon).
- Slide-frame vision / visual channel (transcript-first per cost ceiling).
- Message Batches API seam (50% discount not needed; NOT ZDR-eligible; stay on headless CLI).
- Filing graded HUJI submissions as Brain calibration anchors (student content crossing the boundary; needs separate consent; NOT Phase 229).
- Brain WRITES of any kind (module is READ-ONLY enrichment, generic handles only).
- Semester-scale continuous runs / self-hosted Phoenix / grade-attached contestability (v2).
</user_constraints>

<phase_requirements>
## Phase Requirements

No `REQUIREMENTS.md` REQ-IDs are mapped to Phase 229 (net-new business-opportunity phase, not roadmap-sequenced). The de-facto requirement set is the AI-SPEC's 10 evaluation dimensions (D1-D10) plus the 5 build seams. The planner should adopt the D1-D10 identifiers as the requirement axis (matching the in-repo `tests/run-all-NNN.sh` convention where D-dimension legs map to REQ ids - see `tests/run-all-226.sh`).

| ID | Description | Research Support |
|----|-------------|------------------|
| D1 | Transcript-evidence grounding (zero fabrication) | CJS quote verifier over evidence.json + feedback.md against source transcript; EvidenceSchema `quote` fields (§4b) |
| D2 | Intake fidelity (extraction completeness) | Claimify 4-pass reuse via `navigation.writeClaimNode`; labeled-inventory recall on samples |
| D3 | Cohort score consistency (severity drift) | Pinned model ID in batch.config.json; duplicate-anchor probes; drift stats |
| D4 | Part 8 query hygiene | Reuse `lib/core/part8-egress-guard.cjs` `classify`/`scanForContent` on Brain-query log |
| D5 | Minto/MECE structure validity | zod `FeedbackResultSchema` (governing thought + 2-3 branches + teachable step) |
| D6 | Part 12 tone (formative, language-gentle, metacognition) | LLM judge (calibrated) + human review; `self_identified_gaps` schema field |
| D7 | Course-tier calibration + feed-forward | Rubric file tiering; LLM judge + TA blind comparison |
| D8 | Anti-templating / individuation | CJS shingle-Jaccard similarity over delivered artifacts + judge swap test |
| D9 | Per-unit cost adherence | `total_cost_usd` from `--output-format json` envelope; `--max-budget-usd 3.00` fuse |
| D10 | Batch resume / isolation correctness | Filesystem ledger + `.done` markers; scratch-room-per-submission isolation |

The 5 build seams (a-e) map to plans; each seam's concrete call site is in "Architecture Patterns" below.
</phase_requirements>

## Summary

Phase 229 builds a two-layer batch pipeline. The **outer layer** is a net-new CJS orchestrator (`scripts/huji-batch.cjs`) that loops N=200 submissions, spawning one isolated headless `claude -p` session per submission and checkpointing to the filesystem. The **inner layer** is entirely composed from surfaces that already ship: a `PWS_grading` recipe runs the `deep-grade -> mullins -> build-thesis(scored) -> structure-argument` chain on the existing `runChain` spine, fed by an intake adapter that reuses the file-meeting Claimify machinery to populate an ephemeral scratch room. Almost nothing is a from-scratch build; the work is wiring, one recipe registration, one orchestrator, one score-and-continue neutralization, and an eval harness.

The single most important structural fact the planner must internalize: **the batch orchestrator does NOT call `runChain` in-process.** It spawns a headless session that runs the plugin's own `/mos:pipeline PWS_grading` command, and THAT command runs `runChain` inside its own context window ([CITED: 229-AI-SPEC.md §3 Entry Point + Key Abstractions]). This is what gives per-student process isolation, a clean per-unit cost line, and Part-8 containment. The orchestrator's job is spawn + args + checkpoint + resume + aggregate; it never imports the chain.

Every version gate and CLI flag the AI-SPEC assumed is VERIFIED live on this machine: `claude 2.1.210` (>= 2.1.205), `node v22.23.1` (>= 22.5.0), `zod 3.25.76` vendored, and `require('zod/v4').z.toJSONSchema` resolves as a function under CJS (the AI-SPEC flagged this as "verify at build time" - it works, so schemas need not be hand-written). All of `--json-schema`, `--bare`, `--max-budget-usd`, `--no-session-persistence`, `--plugin-dir` are present in `claude --help`.

**Primary recommendation:** Build the outer orchestrator + eval harness net-new; reuse everything inner via direct function calls (`navigation.writeClaimNode`, `openRoomDb`, `birthRoom`/`scaffoldRoomSkeleton`, `part8-egress-guard.classify`) and one `recipe-maps.cjs` recipe registration. Neutralize the 6/10 gate at the rubric/prompt layer (not a command fork, not a CLI flag), and ride the `autonomous_safe` posture end-to-end so the runChain material gate never halts an unattended session.

## Architectural Responsibility Map

> Tiers here are pipeline layers, not web tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| N=200 loop, checkpoint, resume, aggregation | Batch orchestrator (`scripts/huji-batch.cjs`, net-new) | Filesystem state | The one genuine build; per-AI-SPEC §2 the only thing not already shipping |
| Per-submission isolation + cost line | Headless session (`claude -p`, one per unit) | — | Own context window + JSON result contract = clean isolation boundary [CITED: §3] |
| Transcript -> evidence JSON + room population | Intake adapter (Stage A, in-session or pre-session) | Shared core (`navigation.cjs`, `room-db.cjs`) | Claimify reuse; room-builder duty (navigator ruling 3) |
| deep-grade -> mullins -> build-thesis -> structure-argument | Shared core `runChain` (`chain-executor.cjs`) | Registry + recipe-maps | Chain runs INSIDE the session, not in the orchestrator |
| Model routing / cost ceiling | `model-profiles.cjs` cascade | scratch `.config.json` overrides | One governed routing door; no second brain (Canon Part 7) |
| Ephemeral room scaffold + STATE.md stage | `birthRoom`/`scaffoldRoomSkeleton` + direct STATE.md write | `compute-state` (avoid - see Pitfall 3) | model-profiles greps `Stage:` for grading legality |
| Part 8 query hygiene (D4) | `part8-egress-guard.cjs` (exists) | Brain-query log | Constitutional gate; reuse, never hand-roll |
| Brain enrichment (optional) | Brain MCP READ-ONLY, generic handles | Local anchor corpus (Tier 0) | Scoring is local; Brain unreachable -> local fixtures [CITED: §4 Brain posture] |
| Eval (code checks + judge) | `scripts/huji-eval.cjs` + `tests/run-all-229.sh` (net-new) | 12 calibration fixtures on disk | Plugin-native harness; Phoenix consciously declined [CITED: §5] |

## Standard Stack

Nothing new is installed. The "stack" is the repo's own composition spine + the Claude Code CLI already on the machine.

### Core (all in-repo / already present)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `claude` CLI | 2.1.210 (>= 2.1.205 required) | Headless per-submission session runner (`-p`) | Below 2.1.205 `--json-schema` silently ignores invalid schemas [VERIFIED: `claude --version`] |
| Node.js | v22.23.1 (>= 22.5.0 required) | CJS orchestrator + shared core runtime | Repo engine constraint [VERIFIED: `node --version`] |
| `zod` | 3.25.76 (vendored, package.json) | Evidence + result schema validation | MCP SDK's validator; already in-stack [VERIFIED: `require('./node_modules/zod/package.json')`] |
| `zod/v4` `z.toJSONSchema` | resolves under CJS | Serialize zod -> JSON Schema for `--json-schema` | Function present [VERIFIED: `require('zod/v4').z.toJSONSchema` typeof function] - hand-writing JSON Schema NOT needed |
| `node:child_process` `spawn`/`spawnSync` | built-in | Session spawner (args array, no shell) | AVOID `execSync` (Pitfall 2) |

### Supporting (in-repo reuse surfaces - the whole point of this phase)
| Surface | File:Line | Purpose | How Used |
|---------|-----------|---------|----------|
| `runChain(steps, opts)` | `lib/core/chain-executor.cjs:432` | The ONE gated chain loop | Called by the in-session pipeline command, NOT the orchestrator |
| `composeWorkflow(cause)` | `lib/core/framework-chain-composer.cjs:495` | cause -> `[{step,command,autonomous_safe,posture,gate}]`, posture from registry | Resolves the PWS_grading recipe to ordered steps |
| `composeWorkflow(frameworkChain)` + `validateChainAutonomy` | `lib/workflow/command-resolver.cjs:110,131` | framework-name list -> steps; autonomy blocker check | Distinct 2nd resolver; validates all 4 are autonomous_safe |
| `postureForCommand` / `recipeForCause` / `SENS10_CAUSE_RECIPES` | `lib/core/recipe-maps.cjs:177,322,282` | The posture authority + cause->recipe map | Register `PWS_grading` recipe here (bare command strings) |
| `navigation.writeClaimNode(db, params)` | `lib/core/navigation.cjs:209` (re-exports `typedClaim.writeClaimNode`) | Mint typed claim node, `review_status='proposed'` | Intake adapter calls per atomic claim (Claimify) |
| `navigation.writeEdge` + `ALLOWED_EDGE_TYPES` | `lib/core/navigation.cjs` + `lib/core/navigation/edges.cjs` | Typed claim edges | Intake links claims across segments/slides |
| `openRoomDb(roomDir, opts)` | `lib/core/room-db.cjs:100` | Open scratch room.db SQLite handle | Intake writes claims into the ephemeral room |
| `birthRoom(opts)` | `lib/core/navigation/room-birth.cjs:645` (re-exp `navigation.birthRoom:509`) | Room creation backend | Scaffold each scratch room |
| `scaffoldRoomSkeleton(roomDir, opts)` | `lib/core/room-skeleton-scaffold.cjs:262` | Fill canonical 8-section ICM skeleton | Called by birthRoom |
| `resolveModel(roomDir, agentType)` / `parseVentureStage` | `lib/core/model-profiles.cjs:119,100` | 5-step model cascade; regex `Stage:` from STATE.md | Grading legality + pinned model routing |
| `classify(payload,{toolName})` / `scanForContent` | `lib/core/part8-egress-guard.cjs:231,97` | Part 8 egress guard | D4/G3 query-hygiene gate - reuse, never hand-roll |
| file-meeting Claimify 4-pass | `skills/file-meeting/SKILL.md:286` + `commands/file-meeting.md:286` | Reference implementation of the intake pipeline | Port the machinery; do not reimplement |
| `data/command-registry.json` | 110 commands, `commands[]` | Authority for autonomous_safe + posture | All 4 targets verified `autonomous_safe:true kind:methodology` |

### Alternatives Considered
Already ruled out in AI-SPEC §2 (do not revisit): Claude Agent SDK (fallback only, confined to the orchestrator seam if headless CLI proves brittle), LangChain.js/LangGraph.js (ELIMINATED - graph framework for linear chain, bypasses model-profiles, Canon Part 7 violation), Python frameworks (ELIMINATED - no-Python-on-core-path).

## Package Legitimacy Audit

**None required.** This phase installs zero external packages. All dependencies are (a) in-repo CJS modules, (b) the `claude` CLI already on the machine, (c) `zod` already vendored in `node_modules`. No `npm install` step exists in the plan. slopcheck / registry verification is N/A.

## Architecture Patterns

### System Architecture Diagram

```
Amnon's platform (diarized transcripts, +optional deck/paper)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ scripts/huji-batch.cjs  (NET-NEW outer orchestrator)                 │
│  - reads batch.config.json (PINNED full model ID, pluginDir, budget) │
│  - preflight: 1 stream-json run asserts system/init plugins loaded   │
│  - concurrency pool 3-4; per submission:                             │
│       ├─ scaffold scratch room  (birthRoom + write STATE.md          │
│       │        "Stage: Validation" directly; .config.json overrides) │
│       ├─ spawnSync('claude', [...])   ONE session per submission      │
│       └─ checkpoint batch-state.json (atomic write-temp-rename)       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ spawns (args array, NO shell)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ headless  claude -p  session   (isolated context, own permissions)   │
│                                                                       │
│  STAGE A  intake / Claims-Aware Fusion (haiku, --bare, Read-only)     │
│   transcript(+deck) → mode-detect (A=fuse | transcript-only)          │
│   → Claimify 4-pass → navigation.writeClaimNode(openRoomDb(room),…)   │
│   → evidence.json  (zod --json-schema validated)                      │
│        │                                                              │
│        ▼                                                              │
│  STAGE B  PWS_grading recipe on runChain  (opus, plugin session)   │
│   deep-grade → mullins → build-thesis(SCORED,non-gating)              │
│                                      → structure-argument (Minto)     │
│   each step reads prior artifact from scratch room (frontmatter)      │
│   Brain: READ-ONLY, generic handles only (or Tier 0 local anchors)    │
│        │                                                              │
│        ▼                                                              │
│  feedback.md (Minto pyramid) + result.json (structured_output,        │
│               total_cost_usd, pinned model_id, session_id)            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ orchestrator: zod re-validate → write .done
                            ▼
   out/<id>/{evidence.json, feedback.md, result.json, .done}
                            │
                            ▼
   scripts/huji-eval.cjs  (code checks + LLM judge) → cohort report
   → Jonathan sampling pass → Amnon demo verdict → students
```

### Seam-by-seam call sites (the planner's task map)

**Seam (a) - Ephemeral scratch room per submission.**
- Create: `navigation.birthRoom(opts)` -> `scaffoldRoomSkeleton(roomDir, opts)` (8-section ICM skeleton). `lib/core/navigation/room-birth.cjs:645`, `lib/core/room-skeleton-scaffold.cjs:262`.
- **STATE.md is the tripwire.** `model-profiles.parseVentureStage` (`model-profiles.cjs:100`) regex-matches `/(?:Venture\s+)?Stage:\s*(.+)/i`. `STAGE_PROFILES`: `Pre-Opportunity` -> grading=`null` (SKIP = hard stop at chain step 1); `Validation` -> grading=`opus`. The scratch STATE.md MUST contain a literal `Stage: Validation` line. [VERIFIED: read `model-profiles.cjs:37,39,45,100-108`]
- **Do NOT derive Stage via `scripts/compute-state`.** That script computes stage from filesystem section presence (`compute-state:92-101`): a fully-scaffolded room (all 8 sections populated) computes to `Design`/`Investment`, not `Validation`. Write STATE.md directly with the static `Stage: Validation` marker. `parseVentureStage` needs only the literal line. [VERIFIED: read `compute-state:85-105`]
- Per-room `.config.json` with `model_overrides` -> the pinned batch model (cascade step 1 override in `resolveModel`).

**Seam (b) - Transcript->evidence intake adapter (room-builder duty, Claimify reuse).**
- Reference: `skills/file-meeting/SKILL.md:286` "Step 3: Claimify Extraction (4-Pass Pipeline)": selection -> disambiguation -> decomposition -> typing.
- Exact calls: open the room db with `openRoomDb(scratchRoomDir)` (`room-db.cjs:100`); for EACH atomic claim call `navigation.writeClaimNode(db, params)` (`navigation.cjs:209`) with params including `disambiguation` ('ambiguous' only for unresolved), minting `type='claim'`, `review_status='proposed'` (NEVER auto-confirmed - only human `confirmNode` promotes). Link with `navigation.writeEdge` using `ALLOWED_EDGE_TYPES` from `lib/core/navigation/edges.cjs`. [VERIFIED: read `file-meeting/SKILL.md:286-382`]
- Also do wisdom-nugget extraction like file-meeting (navigator ruling 3).
- Stage A prompt baseline = the ported fusion engine (`assets/claims-fusion-engine-prompt.md`), Mode A + extraction discipline ONLY; Modes B/C DISABLED (fabricated-critique failure mode). [CITED: 229-AI-SPEC.md §4 Stage A spec]

**Seam (c) - Score-and-continue neutralization of the 6/10 gate.** (See dedicated section below.)

**Seam (d) - Register the `PWS_grading` recipe.**
- Home: `lib/core/recipe-maps.cjs`. Pattern: `SENS10_CAUSE_RECIPES` (`recipe-maps.cjs:282`) is a frozen map of cause-enum -> **bare command string arrays** (no autonomous_safe literals - posture is sourced separately via `postureForCommand`). `recipeForCause(cause)` (`:322`) returns `string[]`. [VERIFIED: read `recipe-maps.cjs:261-325`]
- Native order (navigator-locked): `['/mos:deep-grade', '/mos:mullins', '/mos:build-thesis', '/mos:structure-argument']`.
- The AI-SPEC §3 project structure names `lib/core/recipe-maps.cjs` as "register the PWS_grading named recipe here (exists)".
- `curated_chains` in the registry is keyed 0-17; NO existing PWS_grading chain (closest named pipeline is `thesis` = structure-argument -> challenge-assumptions -> build-thesis, a different set/order). This recipe is genuinely net-new registration. [VERIFIED: read registry `curated_chains` keys]
- All 4 commands resolve to `autonomous_safe:true` in `data/command-registry.json`; `validateChainAutonomy` (`command-resolver.cjs:131`) will report `runnable:true` with zero blockers. [VERIFIED: node query of registry]

**Seam (e) - Batch orchestrator.** Net-new `scripts/huji-batch.cjs` per AI-SPEC §3 entry point. Uses `spawnSync`/`spawn` with args array, `--plugin-dir`, PINNED `--model` full ID, `--output-format json`, `--json-schema`, `--permission-mode dontAsk`, `--allowedTools`, `--max-turns 40`, `--max-budget-usd 3.00`, `--no-session-persistence`. Filesystem state: `batch-state.json` ledger (atomic write-temp-rename) + `out/<id>/.done` idempotency marker (written ONLY after zod validation passes AND feedback.md non-empty). Retry 2x, fresh scratch room per attempt, then `failures.md`. [CITED: 229-AI-SPEC.md §3,§4 State Management]

### The score-and-continue neutralization point (Seam c - critical)

**Root-cause finding: the 6/10 halt is a PROMPT-LEVEL instruction, not a code gate.** `commands/build-thesis.md` Session Flow reads: "2. Ten Questions Rapid Assessment -- Binary gate (6/10 to proceed). 3. Deep Dive (if gate passed)." The gate logic lives in the natural-language command body + `references/methodology/build-thesis.md`; there is no CJS enforcement of the 6/10 threshold. [VERIFIED: read `build-thesis.md:62-78`]

There are therefore TWO halts to neutralize, at two layers:

1. **Chain-level HITL material halt (code).** `runChain` (`chain-executor.cjs:432`) gates each step: `gateFn(step, posture, previousOutput)` returns a verb; any verb !== `'run'` hands to `onHalt` and stops the chain (`:513-540`). Posture comes from `postureForCommand`. In a headless `--permission-mode dontAsk` session, a gate that waits for a human aborts the run (AI-SPEC Pitfall 4). Mitigation: all 4 commands are already `autonomous_safe:true`, and `build-thesis.md` frontmatter is `autonomous_safe: true`. Ride the autonomous_safe posture end-to-end so runChain auto-runs the steps and does NOT reach a material gate. `validateChainAutonomy` confirms zero blockers. [VERIFIED]
2. **Prompt-level 6/10 halt (natural language).** Neutralize at the RUBRIC/PROMPT layer, NOT via a new CLI flag (commands are markdown, they take no flags) and preferably NOT via a command fork (a fork breaks the frozen-prefix cache and drifts from the shipped build-thesis). **Recommended mechanism:** a frozen `rubric-huji.md` passed via `--append-system-prompt-file` that instructs build-thesis to SCORE all ten questions and CONTINUE unconditionally (never halt below 6/10, emit per-question scores as feedback input). This keeps the prefix bit-identical across 200 runs (cache + provenance) and threads the scored mode as data, not as a code branch.

**Open decision for the planner (flag to navigator):** confirm whether build-thesis will reliably honor an appended-system-prompt override of its own "Binary gate (6/10)" body instruction, or whether a scored-variant reference file (e.g. `references/methodology/build-thesis-scored.md`) invoked by the `PWS_grading` recipe is more robust. Recommendation: try the rubric-file override first (cheapest, cache-friendly); fall back to a scored variant reference if the demo shows the command still halts. This is a testable seam - the demo run will reveal it.

### Anti-Patterns to Avoid
- **`execSync` with shell-quoted prompts.** `scripts/label-topic-forest.cjs:81` is the in-repo precedent to AVOID: ``execSync(`claude -p '${escaped}'`)`` with `prompt.replace(/'/g, "'\\''")`. It (1) blocks the event loop - serializes 200 submissions into ~30h wall time, (2) breaks on transcript apostrophes, (3) is injection-prone. Use `spawn`/`spawnSync` with an args array, no shell; pipe long content via file paths, not argv (stdin capped at 10MB since CLI v2.1.128). This is a real precedent for what NOT to do. [VERIFIED: read `label-topic-forest.cjs:75-90`]
- **Orchestrator importing `runChain`.** Do not `require('chain-executor.cjs')` in `huji-batch.cjs`. The chain runs inside the session via the plugin command; importing it collapses the isolation boundary and the free per-unit cost line.
- **`--continue`/`--resume` across submissions.** That leaks student A's pitch into student B's feedback. Session isolation IS the context strategy (AI-SPEC §4).
- **Running `compute-state` on scratch rooms.** Overwrites the required `Stage: Validation` marker with a filesystem-derived stage.
- **Brain writes / student-specific query payloads.** Any Brain query containing a venture name/quote/identifier is a Part 8 breach even on a read (D4/G3, zero tolerance).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transcript -> typed claims | A bespoke extractor | file-meeting Claimify 4-pass via `navigation.writeClaimNode` | Navigator ruling 3 + Canon Part 7; the room must be genuinely populated so downstream commands find expected structure |
| Room creation | Manual `mkdir` + template strings | `birthRoom` -> `scaffoldRoomSkeleton` | Canonical 8-section ICM skeleton + ROOM.md identity files; born-wired |
| The 4-step chain loop | A custom sequencer | `runChain` on the `PWS_grading` recipe | One gated loop; second brain = Canon Part 7 violation |
| Model routing / cost tiering | A per-stage model switch in the orchestrator | `model-profiles.cjs` cascade + scratch `.config.json` overrides | One governed routing door; the $4-5 ceiling is enforced there |
| Part 8 query hygiene check | A regex you write | `part8-egress-guard.classify` / `scanForContent` | Constitutional guard already audited; reuse is the D4 measurement |
| Structured-output validation | Manual JSON parsing | zod schemas + `--json-schema` (CLI) + `safeParse` (orchestrator) | Belt-and-suspenders; catches CLI-version regressions |
| zod -> JSON Schema | Hand-written JSON Schema files | `require('zod/v4').z.toJSONSchema(schema)` | VERIFIED resolves under CJS on this machine |

**Key insight:** This phase's value is almost entirely in composition and wiring. The only genuinely new code is the outer orchestrator, the recipe registration, the score-and-continue rubric override, the two zod schemas, and the eval harness. Everything that touches student content (extraction, room population, scoring, hygiene) reuses shipped, audited surfaces - which is exactly what keeps the Part 8 privacy story defensible.

## Common Pitfalls

### Pitfall 1: Model alias drift mid-cohort (fairness bug)
**What goes wrong:** `--model opus` retargets when Anthropic ships a new model; students 1-120 graded by a different model than 121-200.
**How to avoid:** Pin the FULL model ID (`claude-opus-4-8`) in `batch.config.json` at batch start; pass explicitly; record in every `result.json`. Gate G4 halts the batch on any `model_id` mismatch. [CITED: §3 Pitfall 1]
**Warning sign:** Any `result.json` `model_id` differs from the pinned ID.

### Pitfall 2: Scratch STATE.md missing a grading-legal stage
**What goes wrong:** `model-profiles.parseVentureStage` finds no `Stage:` or finds `Pre-Opportunity` -> grading resolves to `null` -> chain dies at step 1 with a confusing "skip".
**How to avoid:** Write `Stage: Validation` literally into each scratch STATE.md; never run `compute-state` on the scratch room. [VERIFIED: `model-profiles.cjs:37-45,100-108`]
**Warning sign:** deep-grade halts immediately; `resolveModel(room,'grading')` returns null.

### Pitfall 3: HITL gate halts an unattended session
**What goes wrong:** A build-thesis/deep-grade Decision Gate (F.8/F.9) waits for a human under `--permission-mode dontAsk` and aborts.
**How to avoid:** Ride `autonomous_safe` end-to-end (all 4 already are); neutralize the 6/10 prompt gate at the rubric layer (Seam c); verify with `validateChainAutonomy` (zero blockers expected).
**Warning sign:** Session hangs to `--max-turns` then dies; `haltedAt.reason = 'gate_halt'`.

### Pitfall 4: `execSync` serialization + quote injection
**What goes wrong:** Blocking spawns + shell-quoted transcripts (the `label-topic-forest.cjs` pattern) serialize the batch and break on apostrophes.
**How to avoid:** `spawn`/`spawnSync`, args array, no shell, file-path input. [VERIFIED anti-pattern at `label-topic-forest.cjs:81`]

### Pitfall 5: Scratch room.db residue at N=200
**What goes wrong:** Each scratch room opens a SQLite `room.db`; 200 undeleted rooms + `--no-session-persistence` omitted = disk clutter and resume ambiguity.
**How to avoid:** `--no-session-persistence` on every spawn; archive/delete scratch rooms after `.done`; close db handles.
**Warning sign:** Growing `rooms/` dir; open file handles.

### Pitfall 6: Rate-limit collision under parallelism
**What goes wrong:** Parallel sessions share one API key's rate limits; throughput collapses silently.
**How to avoid:** Cap concurrency at 3-4; treat repeated `rate_limit` retries (stream-json `system/api_retry`) as a signal to drop to serial, not to add retries on top. [CITED: §3 Pitfall 6]

## Code Examples

### Verifying the chain resolves and is fully autonomous (build-time check)
```javascript
// Source: lib/workflow/command-resolver.cjs:110,131 (VERIFIED signatures)
const { composeWorkflow, validateChainAutonomy } = require('./lib/workflow/command-resolver.cjs');
const wf = composeWorkflow(['PWS Deep Grade', 'Mullins', 'PWS Value Proposition', 'Minto']);
const audit = validateChainAutonomy(wf);   // { runnable: true, blockers: [] } expected
// Alternatively the recipe path: lib/core/framework-chain-composer.cjs:495
//   composeWorkflow(cause) -> [{ step, command, autonomous_safe, posture, gate }]
//   posture sourced from recipe-maps.postureForCommand (the ONE posture door)
```

### Intake: reuse the Claimify writer (Stage A room-builder)
```javascript
// Source: skills/file-meeting/SKILL.md:354-372 + lib/core/navigation.cjs:209, lib/core/room-db.cjs:100
const navigation = require('./lib/core/navigation.cjs');
const { openRoomDb } = require('./lib/core/room-db.cjs');
const db = openRoomDb(scratchRoomDir);
for (const claim of atomicClaims) {           // from Claimify 4-pass over the transcript
  navigation.writeClaimNode(db, {
    text: claim.text,
    quote: claim.quote,                        // verbatim - anti-hallucination anchor (D1)
    disambiguation: claim.ambiguous ? 'ambiguous' : undefined,
    // writeClaimNode mints type='claim', review_status='proposed' (never auto-confirmed)
  });
}
// link claims with navigation.writeEdge(...) using ALLOWED_EDGE_TYPES (navigation/edges.cjs)
```

### Scratch STATE.md minimum (the grading-legal stage marker)
```markdown
# STATE.md  (write DIRECTLY - do NOT run scripts/compute-state)
Stage: Validation
```
```javascript
// Why: lib/core/model-profiles.cjs:100-108,37-45 (VERIFIED)
//   parseVentureStage matches /(?:Venture\s+)?Stage:\s*(.+)/i
//   STAGE_PROFILES.Validation.grading === 'opus'  (Pre-Opportunity.grading === null = skip)
```

### Part 8 query-hygiene gate (D4 / G3)
```javascript
// Source: lib/core/part8-egress-guard.cjs:231,97 (VERIFIED exports)
const { classify, scanForContent } = require('./lib/core/part8-egress-guard.cjs');
const verdict = classify(brainQueryPayload, { toolName: 'brain_ask' });
// verdict.class hit OR any evidence.json entity string found in payload -> HALT ENTIRE BATCH (G3)
```

## Runtime State Inventory

> Not a rename/refactor phase, but it CREATES ephemeral runtime state at N=200. Flagged so the planner adds cleanup tasks.

| Category | Items | Action Required |
|----------|-------|-----------------|
| Stored data | 200x scratch `rooms/<id>/room.db` SQLite + populated claim nodes (LOCAL only, Part 8) | Close handles; archive/delete after `.done` |
| Live service config | None - no external service registration | None |
| OS-registered state | None (overnight run is a plain process; no cron/scheduler registration in pilot) | None - verified: orchestrator is a foreground/background node process |
| Secrets/env vars | `ANTHROPIC_API_KEY` (if `--bare` auth path chosen; OAuth/keychain otherwise). `VELMA_API_KEY` NOT needed (transcript-in v1). | Decide auth path at plan time (§3: `--bare --plugin-dir` skips keychain, needs API key) |
| Build artifacts | `batch-state.json`, `out/<id>/`, `failures.md` OUTSIDE the repo (`~/MindrianRooms/huji-pilot-batch/`) | Do not commit; workspace lives outside the dev repo |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `claude` CLI | Every per-submission session | ✓ | 2.1.210 (>= 2.1.205) | none - hard requirement |
| Node.js | Orchestrator + core | ✓ | v22.23.1 (>= 22.5.0) | none |
| `zod` | Schema validation | ✓ | 3.25.76 vendored | none |
| `zod/v4` `toJSONSchema` | Schema -> `--json-schema` | ✓ | resolves as function under CJS | hand-write 2 small JSON Schema files |
| `--json-schema`,`--bare`,`--max-budget-usd`,`--no-session-persistence`,`--plugin-dir` | Orchestrator spawn | ✓ | present in `claude --help` | none |
| Customer samples | Demo / eval seed | ✓ | `samples/sample-1-safescan.md`, `sample-2-study-app.md` | none |
| Calibration fixtures | Judge anchors | ✓ | 12 fixtures in `calibration/` (01-12) on disk | none |
| ffmpeg | mp4 demux (v2 only) | ✓ | 6.1.1 | N/A for v1 (transcript-in) |
| `VELMA_API_KEY` | Audio transcription (v2 only) | ✗ | not set | N/A for v1 (transcript-in); VERIFY endpoint before any v2 demo |

**Missing dependencies with no fallback:** None. Every v1 dependency is present.
**Missing dependencies with fallback:** VELMA/ffmpeg are v2-only; the transcript-in contract removes them from the pilot critical path (CONFIRM with Amnon that all 200 submissions arrive as transcripts).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` - section REQUIRED. The project's Nyquist shape is `tests/run-all-NNN.sh` bash aggregators + per-leg CJS tests, with D-dimension legs mapped to requirement ids and a mandatory HUMAN calibration checkpoint (precedent: `tests/run-all-226.sh`). This translates the AI-SPEC §5 eval strategy - do not re-invent it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` + bash aggregator (repo convention; NO jest/pytest). `NODE_OPTIONS` preload per run-all-212/226 pattern |
| Config file | none - `tests/run-all-229.sh` is the aggregator (Wave 0 creates it) |
| Quick run command | `bash tests/run-all-229.sh` (structural legs; no model calls; deterministic) |
| Full suite command | `bash tests/run-all-229.sh && node scripts/huji-eval.cjs --suite code --strict` |
| Judge/anchor suite (model calls, ~$2) | `node scripts/huji-eval.cjs --suite anchors --judge` (fails closed < 0.7 correlation) |
| Demo acceptance (the sale) | `node scripts/huji-eval.cjs --suite demo` (both samples end-to-end, emits the 2 artifacts) |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| D1 | Every quote in evidence.json/feedback.md exists verbatim in transcript | unit (code) | `node scripts/huji-eval.cjs --check quote-verifier` | ❌ Wave 0 |
| D2 | Labeled entity/claim inventory 100% recalled into evidence.json | unit (code) | `node scripts/huji-eval.cjs --check inventory-recall` | ❌ Wave 0 |
| D3 | Duplicate-anchor probes within 1 band; identical pinned model_id | integration (code) | `node scripts/huji-eval.cjs --check drift` | ❌ Wave 0 |
| D4 | Zero student-specific strings in any Brain query payload | unit (code) | reuse `part8-egress-guard.classify` over query log | ✅ guard exists / ❌ harness leg W0 |
| D5 | `FeedbackResultSchema` validates (governing thought + 2-3 branches + step) | unit (zod) | `node scripts/huji-eval.cjs --check schema` | ❌ Wave 0 (schema + leg) |
| D6 | Formative tone; metacognition credited; disfluencies never punished | LLM judge + human | `node scripts/huji-eval.cjs --suite anchors --judge` | ❌ Wave 0 + human checkpoint |
| D7 | Feed-up/feed-back/feed-forward per branch at course depth | LLM judge + human (TA blind) | `--suite anchors --judge` + calibration workshop | ❌ Wave 0 + human |
| D8 | Pairwise shingle-Jaccard < threshold; swap test passes | unit (code) + judge | `node scripts/huji-eval.cjs --check similarity` | ❌ Wave 0 |
| D9 | `total_cost_usd` <= $3.00/unit | unit (code) | `node scripts/huji-eval.cjs --check cost-ledger` | ❌ Wave 0 |
| D10 | Kill/resume skips `.done`; zero cross-student bleed | integration (harness) | `bash tests/run-all-229.sh` (kill/resume + cross-bleed grep) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/run-all-229.sh` (fast, deterministic, no model calls).
- **Per wave merge:** `bash tests/run-all-229.sh && node scripts/huji-eval.cjs --suite code --strict`.
- **Before any batch / after any prompt/rubric/model/schema change:** `node scripts/huji-eval.cjs --suite anchors --judge` (judge calibration protocol, fails closed under 0.7).
- **Phase gate:** structural suite green + the mandatory HUMAN calibration checkpoint (Amnon's "better than a TA" verdict on the 2 demo artifacts). Per the run-all-226 precedent, human calibration is a real leg, NEVER an automated assertion.

### Wave 0 Gaps
- [ ] `tests/run-all-229.sh` - aggregator (model on run-all-226.sh; D1-D10 structural legs + kill/resume + cross-bleed grep)
- [ ] `scripts/huji-eval.cjs` - code checks (quote verifier, inventory recall, drift stats, similarity index, cost ledger, hygiene scan) + headless `claude -p --bare` judge spawner (sonnet judging opus, `--json-schema` judge schema)
- [ ] `.planning/phases/229-.../schemas/evidence.schema.json` + `feedback-result.schema.json` (from zod via `zod/v4` `toJSONSchema`)
- [ ] `.planning/phases/229-.../eval/` - labeled inventories (Jonathan labels 2 samples), judge prompt, judge schema, probe manifest
- [ ] Judge calibration protocol harness (6 usable graded anchors; Spearman >= 0.7; human re-rank correlation >= 0.7)
- [ ] Synthetic probes: duplicate-anchor (positions 1/50/100/150/200), near-duplicate fairness pair, injection probe (apostrophes + "ignore previous instructions"), degenerate inputs (empty/15s/all-noise transcript)

No test framework install needed (Node built-in + bash). The 14 seed artifacts (2 samples + 12 fixtures) EXIST on disk - do not invent a dataset.

## Security Domain

`security_enforcement` is not disabled; the dominant control here is **Canon Part 8 (student content non-egress)**, which subsumes the classic ASVS surface for this batch/CLI system.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (API) | Anthropic OAuth/keychain OR `ANTHROPIC_API_KEY` (decide at plan time; `--bare --plugin-dir` skips keychain) |
| V3 Session Management | yes | Session isolation per submission; `--no-session-persistence`; never `--continue`/`--resume` across students |
| V4 Access Control | yes | `--permission-mode dontAsk` + explicit `--allowedTools` (Stage A: `Read`; Stage B: `Read,Write,Edit,Bash(node lib/core/*)`); network tools denied |
| V5 Input Validation | yes | zod `--json-schema` (CLI) + `safeParse` (orchestrator); quote verifier; injection probe in eval set |
| V6 Cryptography | no | No secrets minted; transit is TLS to Anthropic API (out of scope to hand-roll) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection in transcript ("ignore previous instructions") | Tampering/Elevation | args-array spawn (no shell); Stage A extraction discipline; injection probe in eval set (§5) |
| Shell-quote injection via `execSync` | Tampering | AVOID `execSync`; `spawnSync` args array (Pitfall 4) |
| Student content egress to Brain (even on a read) | Information Disclosure | `part8-egress-guard.classify` over every query payload; generic handles only; G3 halts batch (zero tolerance) |
| Cross-student context bleed | Information Disclosure | One session per submission; scratch-room-per-submission; cross-bleed grep in D10 |
| Fabricated attribution (hallucinated critique) | Spoofing (trust) | Quote-grounding gate G1; evidence.json is the only thing graded; Modes B/C disabled |
| Model-alias drift (fairness) | Repudiation | Pinned full model ID; G4 halts on mismatch |
| Israel Privacy Law Amendment 13 | Compliance | HUJI is controller (owns consent/notice); Mindrian is processor; Message Batches API NOT ZDR-eligible -> stay on headless CLI. Flag consent to Amnon as HUJI's side. [CITED: §1b Regulatory] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An `--append-system-prompt-file` rubric instruction reliably overrides build-thesis's markdown "Binary gate (6/10)" body without a command fork | Seam c | If the command still halts, need a scored-variant reference file; demo run reveals it (low risk, testable) |
| A2 | Writing STATE.md with a literal `Stage: Validation` is sufficient and no chain step re-runs `compute-state` to overwrite it | Seam a / Pitfall 2 | If a command recomputes stage mid-chain, grading could flip to skip; verify no in-chain compute-state call |
| A3 | The in-session `/mos:pipeline PWS_grading` invocation runs `runChain` over the recipe (orchestrator never imports runChain) | Summary / diagram | If pipeline command cannot take a recipe name arg, may need a thin in-session wrapper command; confirm `/mos:pipeline` arg contract at plan time |
| A4 | All 200 HUJI submissions arrive as diarized transcripts (not raw video) | Deferred / Env | If video, v1 needs ffmpeg+Velma ingestion back on critical path; CONFIRM with Amnon (customer question already flagged) |
| A5 | file-meeting Claimify machinery can be driven headlessly against a scratch room without the interactive nugget-routing HITL | Seam b | If the routing gate is unavoidable, intake needs an autonomous_safe extraction path; file-meeting is `autonomous_safe:false` (utility) so this is a real risk - verify a callable non-interactive path exists |

## Open Questions

1. **`/mos:pipeline` recipe-name argument contract.**
   - What we know: the recipe registers in `recipe-maps.cjs`; the AI-SPEC entry point spawns `/mos:pipeline PWS_grading`.
   - What's unclear: exact arg shape `/mos:pipeline` accepts (recipe name? transcript path? both?) and whether it resolves recipe-maps recipes vs registry `curated_chains`.
   - Recommendation: read `commands/pipeline.md` (or equivalent) during Wave 0; confirm before writing the orchestrator prompt string.

2. **file-meeting non-interactive intake path (A5).**
   - What we know: file-meeting is `autonomous_safe:false` and carries nugget-routing HITL; the Claimify WRITER (`navigation.writeClaimNode`) is a plain function.
   - What's unclear: whether the intake adapter calls the writer directly (bypassing the interactive command) or must run some part of the command.
   - Recommendation: drive `navigation.writeClaimNode`/`openRoomDb` directly from a headless Stage A prompt with `Read` + a scoped `Bash(node lib/core/*)`; do NOT invoke the interactive `/mos:file-meeting` command. Verify the writer works against a freshly scaffolded scratch room.db.

3. **build-thesis scored-mode robustness (A1).**
   - What we know: the 6/10 gate is prompt-level; autonomous_safe handles the code halt.
   - What's unclear: whether a rubric override alone stops the prompt-level halt.
   - Recommendation: test on the demo; keep a scored-variant reference file as the fallback in the plan.

4. **Auth path for headless sessions.**
   - What we know: `--bare --plugin-dir` skips OAuth/keychain and needs `ANTHROPIC_API_KEY`; without `--bare`, `--plugin-dir` loads deterministically but uses keychain.
   - Recommendation: Stage A uses `--bare` (no plugin needed) + API key; Stage B uses `--plugin-dir` (plugin needed). Decide the API-key vs keychain source at plan time.

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `execSync('claude -p ...')` shell-quoted (`label-topic-forest.cjs`) | `spawnSync` args array, no shell, file-path input | this phase | Non-blocking, injection-safe, parallelizable |
| Room-bound single-venture grading (`--full` = sections of one room) | Batch outer loop, one isolated session per submission | this phase | N=200 orchestration (net-new, not a grading-logic change) |
| `brain_grade_calibrate`/`brain_gap_assess` (spec-only, NEVER shipped) | `brain_ask` curated intent over `Example` nodes (read-only, generic handles) OR Tier 0 local anchors | shipped reality | Do NOT repeat the unverified "100+ submissions" claim to HUJI; real anchor set = 12 fixtures |
| Hand-written JSON Schema for `--json-schema` | `require('zod/v4').z.toJSONSchema(schema)` under CJS | verified this session | One schema source of truth; less drift |

**Deprecated/outdated:** `brain_grade_calibrate` / `brain_gap_assess` tool names (dead references, never shipped - do not call). The "100+ graded submissions" marketing claim (unverified; real corpus = 6 in-repo anchors + 12 Notion fixtures).

## Sources

### Primary (HIGH confidence)
- Live repo read/grep at HEAD: `lib/core/chain-executor.cjs` (runChain:432, exports:899), `lib/core/framework-chain-composer.cjs` (composeWorkflow:495), `lib/workflow/command-resolver.cjs` (composeWorkflow:110, validateChainAutonomy:131), `lib/core/recipe-maps.cjs` (postureForCommand:177, recipeForCause:322, SENS10_CAUSE_RECIPES:282), `lib/core/navigation.cjs` (writeClaimNode:209, birthRoom:509), `lib/core/room-db.cjs` (openRoomDb:100), `lib/core/model-profiles.cjs` (parseVentureStage:100, STAGE_PROFILES:37-45), `lib/core/part8-egress-guard.cjs` (classify:231, scanForContent:97), `lib/core/navigation/room-birth.cjs` (birthRoom:645), `lib/core/room-skeleton-scaffold.cjs` (scaffoldRoomSkeleton:262), `commands/build-thesis.md`, `skills/file-meeting/SKILL.md` (Claimify:286-382), `scripts/compute-state` (stage:85-105), `scripts/transcribe-audio` (allowlist:19), `scripts/label-topic-forest.cjs` (execSync:81), `data/command-registry.json` (110 commands, autonomy flags).
- Live CLI/runtime: `claude --version` (2.1.210), `claude --help` (flag presence), `node --version` (v22.23.1), `require('zod/...')` (3.25.76 + zod/v4 toJSONSchema resolves).
- `229-AI-SPEC.md` (framework decision, §3 entry point, §4 implementation, §4b best practices, §5 eval, §6 guardrails) - the locked design contract.
- `229-CONTEXT.md` (business terms, navigator rulings, 4-agent fit-gap sweep).
- `assets/claims-fusion-engine-prompt.md` (Stage A intake baseline, Mode A only).
- `$HOME/.claude/gsd-core/templates/VALIDATION.md`, `tests/run-all-226.sh` (Nyquist validation shape precedent).

### Secondary (MEDIUM confidence)
- AI-SPEC §1b research citations (Hattie & Timperley; LLM-feedback faithfulness; Israel Amendment 13) - already vetted by gsd-domain-researcher; not re-verified this session.

### Tertiary (LOW confidence)
- None. This research is codebase-grounded; no unverified web claims were introduced.

## Metadata

**Confidence breakdown:**
- Standard stack / call sites: HIGH - every function signature grepped from live repo with file:line; CLI flags verified live.
- Architecture / seams: HIGH - matches AI-SPEC locked design; call sites confirmed present.
- Score-and-continue neutralization: MEDIUM - root cause (prompt-level, not code) verified; the exact override mechanism (rubric file vs variant reference) is a testable open decision (A1).
- Intake reuse: MEDIUM-HIGH - writer functions verified; the non-interactive drive path (A5) needs a Wave 0 confirmation.
- Pitfalls: HIGH - each traced to a specific file:line or the AI-SPEC.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 days; stable in-repo surfaces. Re-verify CLI flag behavior if `claude` CLI crosses a minor version, and the `/mos:pipeline` arg contract at plan time.)
